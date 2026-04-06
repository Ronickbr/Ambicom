import React, { useState, useEffect, useRef, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import Webcam from "react-webcam";
import { supabase } from "@/lib/supabase";
import {
    Loader2,
    CheckCircle,
    Camera,
    RefreshCw,
    FileText,
    Wifi,
    WifiOff,
    History as HistoryIcon,
    ChevronRight,
    X,
    Upload,
    Focus,
    ZapOff,
    Zap,
    Flashlight,
    FlashlightOff
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useScan } from "@/hooks/useScan";
import { logger } from "@/lib/logger";

// ─── Constantes de Câmera ──────────────────────────────────────────────────
const CAMERA_CONSTRAINTS: MediaTrackConstraints = {
    facingMode: { ideal: "environment" },
    width: { ideal: 1920, min: 1280 },
    height: { ideal: 1080, min: 720 },
    aspectRatio: { ideal: 16 / 9 },
    frameRate: { ideal: 30, max: 60 },
};

const CAPTURE_QUALITY = 0.85; // JPEG quality
const MAX_IMAGE_SIZE_KB = 1024; // 1024 KB

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Lê o valor de Orientation do EXIF de um dataURL JPEG.
 * Retorna 1 (sem rotação) caso não encontre ou não seja JPEG.
 *
 * Orientações EXIF → rotação necessária para upright:
 *   1 = 0°   3 = 180°   6 = 90° CW   8 = 90° CCW
 */
function getExifOrientation(dataUrl: string): number {
    if (!dataUrl.startsWith("data:image/jpeg")) return 1;

    try {
        const base64 = dataUrl.split(",")[1];
        const bin = atob(base64);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);

        // Percorre segmentos JPEG procurando APP1 (0xFFE1 = EXIF)
        let offset = 2; // pula SOI (FF D8)
        while (offset < buf.length - 1) {
            if (buf[offset] !== 0xFF) break;
            const marker = buf[offset + 1];
            const segLen = (buf[offset + 2] << 8) | buf[offset + 3];

            if (marker === 0xE1) { // APP1
                // Verifica magic "Exif\0\0"
                const exifMagic = String.fromCharCode(...Array.from(buf.slice(offset + 4, offset + 10)));
                if (exifMagic.startsWith("Exif")) {
                    const tiffOffset = offset + 10;
                    const isLE = buf[tiffOffset] === 0x49; // "II" = little-endian
                    const read16 = (o: number) => isLE
                        ? buf[tiffOffset + o] | (buf[tiffOffset + o + 1] << 8)
                        : (buf[tiffOffset + o] << 8) | (buf[tiffOffset + o + 1]);
                    const read32 = (o: number) => isLE
                        ? buf[tiffOffset + o] | (buf[tiffOffset + o + 1] << 8) | (buf[tiffOffset + o + 2] << 16) | (buf[tiffOffset + o + 3] << 24)
                        : (buf[tiffOffset + o] << 24) | (buf[tiffOffset + o + 1] << 16) | (buf[tiffOffset + o + 2] << 8) | buf[tiffOffset + o + 3];

                    const ifdOffset = read32(4);
                    const numEntries = read16(ifdOffset);
                    for (let e = 0; e < numEntries; e++) {
                        const eOff = ifdOffset + 2 + e * 12;
                        const tag = read16(eOff);
                        if (tag === 0x0112) { // Orientation tag
                            return read16(eOff + 8);
                        }
                    }
                }
            }

            // Marcadores sem segmento (SOI, EOI, RST)
            if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) {
                offset += 2;
            } else {
                offset += 2 + segLen;
            }
        }
    } catch { /* silencia erros de parsing */ }
    return 1;
}

/**
 * Aplica a transformação correta no canvas baseada no valor de Orientation EXIF.
 * Retorna { w, h } com as dimensões já ajustadas para o canvas.
 */
function applyExifRotation(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    orientation: number,
    canvas: HTMLCanvasElement
): { w: number; h: number } {
    const { width: iw, height: ih } = img;
    const rotated = orientation === 6 || orientation === 8;

    canvas.width = rotated ? ih : iw;
    canvas.height = rotated ? iw : ih;

    ctx.save();
    switch (orientation) {
        case 2: ctx.transform(-1, 0, 0, 1, iw, 0); break;  // flip H
        case 3: ctx.transform(-1, 0, 0, -1, iw, ih); break;  // 180°
        case 4: ctx.transform(1, 0, 0, -1, 0, ih); break;  // flip V
        case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;  // 90° CCW + flip H
        case 6: ctx.transform(0, 1, -1, 0, ih, 0); break;  // 90° CW
        case 7: ctx.transform(0, -1, -1, 0, ih, iw); break;  // 90° CW + flip H
        case 8: ctx.transform(0, -1, 1, 0, 0, iw); break;  // 90° CCW
        // default (1): sem transformação
    }
    ctx.drawImage(img, 0, 0);
    ctx.restore();

    return { w: canvas.width, h: canvas.height };
}

/**
 * Comprime um dataURL JPEG/PNG para no máximo `maxKB` kilobytes,
 * corrigindo automaticamente a orientação EXIF.
 */
function compressImage(dataUrl: string, maxKB: number, quality = CAPTURE_QUALITY): Promise<string> {
    return new Promise((resolve) => {
        const orientation = getExifOrientation(dataUrl);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d")!;

            applyExifRotation(ctx, img, orientation, canvas);

            let q = quality;
            let result = canvas.toDataURL("image/jpeg", q);

            // Reduz qualidade iterativamente até atingir o limite
            while (result.length * 0.75 > maxKB * 1024 && q > 0.2) {
                q -= 0.05;
                result = canvas.toDataURL("image/jpeg", q);
            }

            resolve(result);
        };
        img.src = dataUrl;
    });
}


// ─── Tipos ─────────────────────────────────────────────────────────────────
type FocusStatus = "idle" | "focusing" | "locked" | "failed";

// ─── Componente ────────────────────────────────────────────────────────────
export default function ScanPage() {
    const { profile, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const webcamRef = React.useRef<Webcam>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Constraints com fallback progressivo
    const [videoConstraints, setVideoConstraints] = useState<MediaTrackConstraints | boolean>(CAMERA_CONSTRAINTS);
    const [cameraError, setCameraError] = useState(false);
    const [cameraReady, setCameraReady] = useState(false);

    // Flash / Torch
    const [torchOn, setTorchOn] = useState(false);
    const [torchSupported, setTorchSupported] = useState(false);

    // Indicador de foco
    const [focusStatus, setFocusStatus] = useState<FocusStatus>("idle");
    const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // OCR States
    const [showOcrModal, setShowOcrModal] = useState(false);
    const [isFullscreenImage, setIsFullscreenImage] = useState(false);

    // Photos State
    const [labelPhoto, setLabelPhoto] = useState<string | null>(null);
    const [ocrForm, setOcrForm] = useState<any>({
        brand: "",
        model: "",
        original_serial: "",
        commercial_code: "",
        color: "",
        product_type: "",
        pnc_ml: "",
        manufacturing_date: "",
        market_class: "",
        refrigerant_gas: "",
        gas_charge: "",
        compressor: "",
        volume_freezer: "",
        volume_refrigerator: "",
        volume_total: "",
        pressure_high_low: "",
        freezing_capacity: "",
        electric_current: "",
        defrost_power: "",
        frequency: "",
        voltage: "",
    });

    // Custom Hook
    const {
        isProcessing,
        lastScans,
        isOnline,
        ocrResult,
        ocrLoading,
        scanImage,
        notFound,
        setNotFound,
        registerProduct
    } = useScan();

    useEffect(() => {
        if (!authLoading && !profile) {
            navigate("/login");
        }
    }, [authLoading, profile, navigate]);

    // Cleanup focus timer + desligar torch no unmount
    useEffect(() => {
        return () => {
            if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
            // Garante que o flash é desligado ao sair da página
            const stream = webcamRef.current?.video?.srcObject as MediaStream | null;
            if (stream) {
                stream.getVideoTracks().forEach(t => {
                    try { t.applyConstraints({ advanced: [{ torch: false } as any] }); } catch { /* ignore */ }
                });
            }
        };
    }, []);

    // ── Foco Automático simulado ──────────────────────────────────────────
    /**
     * Simula o ciclo de autofocus para dar feedback visual ao usuário.
     * Em browsers que expõem ImageCapture API com focusMode, poderíamos
     * chamar a API real; aqui usamos timing realista (300-800 ms).
     */
    const triggerFocusAnimation = useCallback(async () => {
        setFocusStatus("focusing");
        if (focusTimerRef.current) clearTimeout(focusTimerRef.current);

        // ── Refoco de Hardware Real ──
        const stream = webcamRef.current?.video?.srcObject as MediaStream | null;
        const track = stream?.getVideoTracks()[0];
        if (track && track.applyConstraints) {
            try {
                // Força o motor de foco a "caçar" novamente trocando o modo temporariamente
                const caps = track.getCapabilities() as any;
                if (caps.focusMode?.includes("continuous")) {
                    await track.applyConstraints({ advanced: [{ focusMode: "manual", focusDistance: 0 } as any] });
                    await new Promise(r => setTimeout(r, 100));
                    await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as any] });
                }
            } catch (e) {
                logger.warn("Hardware refocus failed", e);
            }
        }

        focusTimerRef.current = setTimeout(() => {
            const success = true; // No Android, assumimos que o comando foi enviado
            setFocusStatus(success ? "locked" : "failed");

            focusTimerRef.current = setTimeout(() => {
                setFocusStatus("idle");
            }, 1200);
        }, 600);
    }, []);

    // ── Handlers de câmera ────────────────────────────────────────────────
    const handleCameraError = (err: string | DOMException) => {
        logger.error("Camera access error", err);

        if (typeof videoConstraints !== "boolean" && (videoConstraints as MediaTrackConstraints).width) {
            // 1ª tentativa: remover restrições de resolução, manter facingMode
            logger.info("Retrying with basic environment constraint");
            setVideoConstraints({ facingMode: "environment" });
            return;
        }

        if (typeof videoConstraints !== "boolean" && (videoConstraints as any).facingMode === "environment") {
            // 2ª tentativa: qualquer câmera disponível
            logger.info("Environment camera not found, falling back to any camera");
            setVideoConstraints(true);
            return;
        }

        setCameraError(true);
    };

    const handleCameraReady = () => {
        setCameraReady(true);
        logger.info("Camera access granted");

        const stream = webcamRef.current?.video?.srcObject as MediaStream | null;
        if (stream) {
            const track = stream.getVideoTracks()[0];
            if (track) {
                const caps = track.getCapabilities?.() as any;
                setTorchSupported(!!(caps?.torch));

                // ── Aplica Foco Contínuo se suportado pelo hardware (Motorola/Android) ──
                if (caps?.focusMode?.includes("continuous")) {
                    track.applyConstraints({
                        advanced: [{ focusMode: "continuous" } as any]
                    }).then(() => {
                        logger.info("Hardware continuous focus enabled");
                    }).catch(e => {
                        logger.warn("Could not apply hardware focus", e);
                    });
                }
            }
        }
        // Dispara autofocus ao iniciar
        triggerFocusAnimation();
    };

    // ── Toggle Flash ─────────────────────────────────────────────────────
    const toggleTorch = useCallback(async () => {
        const stream = webcamRef.current?.video?.srcObject as MediaStream | null;
        if (!stream) { toast.error("Câmera não disponível"); return; }

        const track = stream.getVideoTracks()[0];
        if (!track) return;

        const next = !torchOn;
        try {
            await track.applyConstraints({ advanced: [{ torch: next } as any] });
            setTorchOn(next);
            if (next) toast.success("Flash ligado");
        } catch (e) {
            toast.error("Flash não suportado neste dispositivo");
            logger.warn("Torch constraint failed", e);
        }
    }, [torchOn]);

    // ── Captura + compressão + OCR ────────────────────────────────────────
    const handleCaptureAndOCR = async () => {
        if (!webcamRef.current) return;

        triggerFocusAnimation();

        // Aguarda o foco antes de capturar (400ms mín.)
        await new Promise(r => setTimeout(r, 450));

        const rawImage = webcamRef.current.getScreenshot();
        if (!rawImage) return;

        toast.info("Processando imagem...");

        // Comprime para máx 500 KB
        const compressed = await compressImage(rawImage, MAX_IMAGE_SIZE_KB);

        setLabelPhoto(compressed);

        toast.info("Analisando etiqueta...");

        const data = await scanImage(compressed);
        if (data) {
            setOcrForm({
                brand: data.fabricante || "",
                model: data.modelo || "",
                original_serial: data.numero_serie || "",
                commercial_code: data.codigo_comercial || "",
                color: data.cor || "",
                product_type: data.tipo || "",
                pnc_ml: data.pnc_ml || "",
                manufacturing_date: data.data_fabricacao || "",
                market_class: data.classe_mercado || "",
                refrigerant_gas: data.gas_refrigerante || "",
                gas_charge: data.carga_gas || "",
                compressor: data.compressor || "",
                volume_freezer: data.volume_freezer || "",
                volume_refrigerator: data.volume_refrigerator || "",
                volume_total: data.volume_total || "",
                pressure_high_low: data.pressao_alta_baixa || "",
                freezing_capacity: data.capacidade_congelamento || "",
                electric_current: data.corrente_eletrica || "",
                defrost_power: data.potencia_degelo || "",
                frequency: data.frequencia || "",
                voltage: data.tensao || "",
            });
            setShowOcrModal(true);
        }
    };

    // ── Upload de arquivo ─────────────────────────────────────────────────
    const handleFileUpload = () => {
        fileInputRef.current?.click();
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const raw = reader.result as string;

                toast.info("Processando arquivo...");
                const compressed = await compressImage(raw, MAX_IMAGE_SIZE_KB);

                setLabelPhoto(compressed);

                toast.info("Analisando arquivo...");
                const data = await scanImage(compressed);
                if (data) {
                    setOcrForm({
                        brand: data.fabricante || "Electrolux",
                        model: data.modelo || "",
                        original_serial: data.numero_serie || "",
                        commercial_code: data.codigo_comercial || "",
                        color: data.cor || "",
                        product_type: data.tipo || "",
                        pnc_ml: data.pnc_ml || "",
                        manufacturing_date: data.data_fabricacao || "",
                        market_class: data.classe_mercado || "",
                        refrigerant_gas: data.gas_refrigerante || "",
                        gas_charge: data.carga_gas || "",
                        compressor: data.compressor || "",
                        volume_freezer: data.volume_freezer || "",
                        volume_refrigerator: data.volume_refrigerator || "",
                        volume_total: data.volume_total || "",
                        pressure_high_low: data.pressao_alta_baixa || "",
                        freezing_capacity: data.capacidade_congelamento || "",
                        electric_current: data.corrente_eletrica || "",
                        defrost_power: data.potencia_degelo || "",
                        frequency: data.frequencia || "",
                        voltage: data.tensao || "",
                    });
                    setShowOcrModal(true);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    if (authLoading) return null;

    // ── Cor e ícone do indicador de foco ─────────────────────────────────
    const focusIndicator = {
        idle: { color: "text-white/40 border-white/20", icon: <Focus className="h-4 w-4" />, label: "Pronto" },
        focusing: { color: "text-amber-400 border-amber-400/60 animate-pulse", icon: <Loader2 className="h-4 w-4 animate-spin" />, label: "Focando..." },
        locked: { color: "text-emerald-400 border-emerald-400/60", icon: <Zap className="h-4 w-4" />, label: "Foco OK" },
        failed: { color: "text-red-400 border-red-400/60", icon: <ZapOff className="h-4 w-4" />, label: "Refocando" },
    }[focusStatus];

    return (
        <MainLayout>
            <div className="max-w-6xl mx-auto space-y-10 pb-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-foreground uppercase italic">Captura de <span className="text-primary not-italic font-light">Etiqueta</span></h1>
                        <p className="text-muted-foreground font-medium text-sm mt-1 opacity-70 italic">Análise via IA para entrada de ativos no fluxo industrial.</p>
                    </div>
                    <div className="glass-card flex items-center gap-4 py-4 px-8 border-border/10 bg-card/50 shadow-inner w-full md:w-auto justify-between md:justify-start">
                        <div className={cn("h-10 w-10 rounded-full flex items-center justify-center border shadow-sm", isOnline ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20")}>
                            {isOnline ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                        </div>
                        <div>
                            <div className="text-[9px] uppercase font-black text-muted-foreground tracking-widest leading-none mb-1">Status da Rede</div>
                            <div className="text-lg font-black text-foreground italic tracking-widest">
                                {isOnline ? "ONLINE" : "OFFLINE"}
                                <span className={cn("text-[10px] not-italic font-medium opacity-50 ml-2", isOnline ? "text-emerald-500" : "text-red-500")}>
                                    {isOnline ? "Conectado" : "Aviso: Sem Sincronia"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid lg:grid-cols-5 gap-8">
                    <div className="lg:col-span-3 space-y-6">
                        {/* Camera Frame */}
                        <div className="glass-card p-2 border-border/20 bg-black shadow-2xl relative overflow-hidden group max-w-sm mx-auto">
                            <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-card border border-border/10">
                                {!cameraError ? (
                                    <>
                                        <Webcam
                                            ref={webcamRef}
                                            audio={false}
                                            screenshotFormat="image/jpeg"
                                            screenshotQuality={CAPTURE_QUALITY}
                                            videoConstraints={videoConstraints}
                                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                            onUserMediaError={handleCameraError}
                                            onUserMedia={handleCameraReady}
                                            forceScreenshotSourceSize
                                            imageSmoothing={false}
                                        />

                                        {/* ── Indicador de foco (canto sup. dir.) ── */}
                                        {cameraReady && (
                                            <div className={cn(
                                                "absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-sm bg-black/40 transition-all duration-300",
                                                focusIndicator.color
                                            )}>
                                                {focusIndicator.icon}
                                                <span className="text-[9px] font-black uppercase tracking-widest">{focusIndicator.label}</span>
                                            </div>
                                        )}

                                        {/* ── Viewfinder Clean (Área de Foco Total) ── */}
                                        {cameraReady && (
                                            <div className="absolute inset-0 z-10 pointer-events-none">
                                                {/* Cantilheiras de Foco Sutis e Totais */}
                                                <div className={cn(
                                                    "absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 rounded-tl transition-colors duration-300",
                                                    focusStatus === "locked" ? "border-emerald-400" : focusStatus === "focusing" ? "border-amber-400" : "border-white/20"
                                                )} />
                                                <div className={cn(
                                                    "absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 rounded-tr transition-colors duration-300",
                                                    focusStatus === "locked" ? "border-emerald-400" : focusStatus === "focusing" ? "border-amber-400" : "border-white/20"
                                                )} />
                                                <div className={cn(
                                                    "absolute bottom-28 left-6 w-8 h-8 border-b-2 border-l-2 rounded-bl transition-colors duration-300",
                                                    focusStatus === "locked" ? "border-emerald-400" : focusStatus === "focusing" ? "border-amber-400" : "border-white/20"
                                                )} />
                                                <div className={cn(
                                                    "absolute bottom-28 right-6 w-8 h-8 border-b-2 border-r-2 rounded-br transition-colors duration-300",
                                                    focusStatus === "locked" ? "border-emerald-400" : focusStatus === "focusing" ? "border-amber-400" : "border-white/20"
                                                )} />

                                                {/* Indicador de Pronto - Sutil */}
                                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20">
                                                    <Camera className="h-12 w-12 text-white" />
                                                </div>
                                            </div>
                                        )}

                                        {/* ── Badge HD + Botão Flash ── */}
                                        {cameraReady && (
                                            <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                                                {/* Badge HD */}
                                                <div className="px-2 py-1 rounded-md bg-black/50 backdrop-blur-sm border border-white/10">
                                                    <span className="text-[8px] font-black text-white/60 uppercase tracking-widest">HD · 720p</span>
                                                </div>

                                                {/* Botão Flash */}
                                                <button
                                                    onClick={toggleTorch}
                                                    title={torchSupported ? (torchOn ? "Desligar flash" : "Ligar flash") : "Flash indisponível"}
                                                    className={cn(
                                                        "h-8 w-8 rounded-full flex items-center justify-center backdrop-blur-sm border transition-all duration-200",
                                                        torchOn
                                                            ? "bg-amber-400/30 border-amber-400/70 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.5)]"
                                                            : torchSupported
                                                                ? "bg-black/50 border-white/20 text-white/60 hover:text-white hover:border-white/40"
                                                                : "bg-black/30 border-white/10 text-white/20 cursor-not-allowed"
                                                    )}
                                                >
                                                    {torchOn
                                                        ? <Flashlight className="h-4 w-4" />
                                                        : <FlashlightOff className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        )}

                                        {/* ── Botão de captura ── */}
                                        <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center px-4">
                                            <button
                                                onClick={handleCaptureAndOCR}
                                                disabled={ocrLoading || !cameraReady}
                                                className="w-full max-w-sm h-16 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-4 transition-all shadow-[0_0_40px_rgba(14,165,233,0.4)] active:scale-95 disabled:opacity-50 disabled:grayscale"
                                            >
                                                {ocrLoading ? (
                                                    <Loader2 className="h-6 w-6 animate-spin" />
                                                ) : (
                                                    <Camera className="h-6 w-6" />
                                                )}
                                                {ocrLoading ? "Lendo dados..." : "Extrair Dados da Etiqueta"}
                                            </button>
                                        </div>

                                        {/* ── Botão de refoco ao clicar no vídeo ── */}
                                        <button
                                            className="absolute inset-0 z-[5] cursor-crosshair bg-transparent"
                                            onClick={triggerFocusAnimation}
                                            aria-label="Acionar autofoco"
                                        />
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
                                        <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-2">
                                            <Camera className="h-8 w-8" />
                                        </div>
                                        <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Câmera Indisponível</h3>
                                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">Verifique as permissões do navegador ou suba uma foto da galeria.</p>
                                        <div className="flex gap-4 w-full max-w-sm">
                                            <button
                                                onClick={() => { setCameraError(false); setCameraReady(false); setVideoConstraints(CAMERA_CONSTRAINTS); }}
                                                className="flex-1 px-6 py-4 bg-foreground/5 hover:bg-foreground/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-foreground transition-all border border-border/10 flex items-center justify-center gap-3"
                                            >
                                                <RefreshCw className="h-4 w-4" />
                                                Tentar Novamente
                                            </button>
                                            <button
                                                onClick={handleFileUpload}
                                                className="flex-1 px-6 py-4 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3"
                                            >
                                                <Upload className="h-4 w-4" />
                                                Subir Foto
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-6">
                        <div className="glass-card bg-card/50 border-border/10 h-full flex flex-col p-8 relative overflow-hidden">
                            <div className="flex items-center gap-3 mb-8">
                                <HistoryIcon className="h-5 w-5 text-primary" />
                                <h2 className="text-[10px] font-black text-foreground uppercase tracking-[0.3em]">Registro de Sessão</h2>
                            </div>

                            <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                                {lastScans.length > 0 ? lastScans.map((product, index) => (
                                    <div key={index} className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-border/10 hover:border-primary/30 transition-all group animate-in slide-in-from-right-4 fade-in duration-500" style={{ animationDelay: `${index * 100}ms` }}>
                                        <div className="h-10 w-10 rounded-xl bg-foreground/5 flex items-center justify-center text-muted-foreground group-hover:text-primary-foreground group-hover:bg-primary/20 transition-all font-mono text-xs font-bold border border-border/10">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-foreground text-sm truncate">{product.internal_serial}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={cn(
                                                    "h-1.5 w-1.5 rounded-full",
                                                    product.status === "CADASTRO" ? "bg-yellow-500" : "bg-emerald-500"
                                                )} />
                                                <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">{product.status}</p>
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="flex flex-col items-center justify-center h-40 text-center space-y-3 opacity-30">
                                        <HistoryIcon className="h-8 w-8 text-muted-foreground" />
                                        <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Nenhuma leitura recente</p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 pt-6 border-t border-border/10 text-center">
                                <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold opacity-40">
                                    Total Sessão: {lastScans.length} Ativos
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* NotFound Modal */}
            {notFound && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card border border-border/20 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl space-y-6 p-8 relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
                        <div className="text-center space-y-2">
                            <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 mx-auto border border-amber-500/20 mb-4">
                                <FileText className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Ativo não Identificado</h3>
                            <p className="text-sm text-muted-foreground italic">O código <span className="text-foreground font-mono font-bold">{notFound}</span> não consta na base de dados.</p>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => { registerProduct({ original_serial: notFound }); }}
                                className="h-14 bg-foreground text-background hover:bg-primary hover:text-primary-foreground rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-3 shadow-lg"
                            >
                                <RefreshCw className="h-4 w-4" />
                                Cadastrar Novo Ativo
                            </button>
                            <button
                                onClick={() => setNotFound(null)}
                                className="h-12 text-muted-foreground hover:text-foreground font-black text-[10px] uppercase transition-all tracking-widest"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* OCR Modal */}
            {showOcrModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card border border-border/20 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-6 border-b border-border/10 bg-foreground/5 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 border border-purple-500/20">
                                    <FileText className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-foreground uppercase tracking-tight">Revisão de Dados</h3>
                                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Confirme as informações extraídas</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowOcrModal(false)}
                                className="h-8 w-8 rounded-lg bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar flex-1 bg-background/20">
                            {/* Visual Preview */}
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Documento Digitalizado</label>
                                <div className="flex justify-center">
                                    <div
                                        className="w-full max-w-[280px] aspect-[9/16] rounded-2xl bg-muted border border-border/20 overflow-hidden relative group cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                                        onClick={() => setIsFullscreenImage(true)}
                                    >
                                        <img
                                            src={labelPhoto ?? undefined}
                                            alt="Etiqueta Capturada"
                                            className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4 pointer-events-none">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                                    <span className="text-[8px] font-black text-white uppercase tracking-widest">Análise de IA Concluída</span>
                                                </div>
                                                <span className="text-[7px] font-bold text-white/70 uppercase tracking-widest ml-4">Clique para ampliar</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Form fields */}
                            <div className="space-y-6">
                                {/* Seção Identificação */}
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-primary uppercase tracking-widest border-l-2 border-primary pl-2">Identificação Extraída</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5 col-span-2">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Fabricante / Marca</label>
                                            <input type="text" value={ocrForm.brand} onChange={e => setOcrForm({ ...ocrForm, brand: e.target.value })} className="w-full bg-foreground/5 border border-border/20 rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-primary/50 outline-none transition-all font-bold" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Modelo</label>
                                            <input type="text" value={ocrForm.model} onChange={e => setOcrForm({ ...ocrForm, model: e.target.value })} className="w-full bg-foreground/5 border border-border/20 rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-primary/50 outline-none transition-all font-bold" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">TIPO</label>
                                            <input type="text" value={ocrForm.product_type} onChange={e => setOcrForm({ ...ocrForm, product_type: e.target.value })} className="w-full bg-foreground/5 border border-border/20 rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-primary/50 outline-none transition-all font-bold" />
                                        </div>
                                        <div className="space-y-1.5 col-span-2">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Número de Série Original</label>
                                            <input type="text" value={ocrForm.original_serial} onChange={e => setOcrForm({ ...ocrForm, original_serial: e.target.value })} className="w-full bg-foreground/5 border border-border/20 rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-primary/50 outline-none transition-all font-bold font-mono uppercase" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Código Comercial</label>
                                            <input type="text" value={ocrForm.commercial_code} onChange={e => setOcrForm({ ...ocrForm, commercial_code: e.target.value })} className="w-full bg-foreground/5 border border-border/20 rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-primary/50 outline-none transition-all font-bold" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Cor</label>
                                            <input type="text" value={ocrForm.color} onChange={e => setOcrForm({ ...ocrForm, color: e.target.value })} className="w-full bg-foreground/5 border border-border/20 rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-primary/50 outline-none transition-all font-bold" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">PNC / ML</label>
                                            <input type="text" value={ocrForm.pnc_ml} onChange={e => setOcrForm({ ...ocrForm, pnc_ml: e.target.value })} className="w-full bg-foreground/5 border border-border/20 rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-primary/50 outline-none transition-all font-bold" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Data Fabricação</label>
                                            <input type="text" value={ocrForm.manufacturing_date} onChange={e => setOcrForm({ ...ocrForm, manufacturing_date: e.target.value })} className="w-full bg-foreground/5 border border-border/20 rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-primary/50 outline-none transition-all font-bold" />
                                        </div>
                                    </div>
                                </div>

                                {/* Seção Performance & Fluidos */}
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest border-l-2 border-emerald-500 pl-2">Desempenho e Fluidos</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5"><label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Gás Refrigerante</label><input type="text" value={ocrForm.refrigerant_gas} onChange={e => setOcrForm({ ...ocrForm, refrigerant_gas: e.target.value })} className="w-full bg-foreground/5 border border-border/20 rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-primary/50 outline-none transition-all font-bold" /></div>
                                        <div className="space-y-1.5"><label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Carga de Gás</label><input type="text" value={ocrForm.gas_charge} onChange={e => setOcrForm({ ...ocrForm, gas_charge: e.target.value })} className="w-full bg-foreground/5 border border-border/20 rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-primary/50 outline-none transition-all font-bold" /></div>
                                        <div className="space-y-1.5"><label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Compressor</label><input type="text" value={ocrForm.compressor} onChange={e => setOcrForm({ ...ocrForm, compressor: e.target.value })} className="w-full bg-foreground/5 border border-border/20 rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-primary/50 outline-none transition-all font-bold" /></div>
                                        <div className="space-y-1.5"><label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Classe / Mercado</label><input type="text" value={ocrForm.market_class} onChange={e => setOcrForm({ ...ocrForm, market_class: e.target.value })} className="w-full bg-foreground/5 border border-border/20 rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-primary/50 outline-none transition-all font-bold" /></div>
                                        <div className="space-y-1.5"><label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Cap. Congelamento</label><input type="text" value={ocrForm.freezing_capacity} onChange={e => setOcrForm({ ...ocrForm, freezing_capacity: e.target.value })} className="w-full bg-foreground/5 border border-border/20 rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-primary/50 outline-none transition-all font-bold" /></div>
                                        <div className="space-y-1.5"><label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Pressões (H/L)</label><input type="text" value={ocrForm.pressure_high_low} onChange={e => setOcrForm({ ...ocrForm, pressure_high_low: e.target.value })} className="w-full bg-foreground/5 border border-border/20 rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-primary/50 outline-none transition-all font-bold" /></div>
                                    </div>
                                </div>

                                {/* Seção Volumes */}
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest border-l-2 border-blue-500 pl-2">Capacidades e Volumes</h4>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="space-y-1.5"><label className="text-[8px] font-black text-muted-foreground uppercase tracking-widest pl-1">Freezer</label><input type="text" value={ocrForm.volume_freezer} onChange={e => setOcrForm({ ...ocrForm, volume_freezer: e.target.value })} className="w-full bg-foreground/5 border border-border/20 rounded-xl px-3 py-2.5 text-xs text-foreground focus:border-primary/50 outline-none transition-all font-bold text-center" /></div>
                                        <div className="space-y-1.5"><label className="text-[8px] font-black text-muted-foreground uppercase tracking-widest pl-1">Refrig.</label><input type="text" value={ocrForm.volume_refrigerator} onChange={e => setOcrForm({ ...ocrForm, volume_refrigerator: e.target.value })} className="w-full bg-foreground/5 border border-border/20 rounded-xl px-3 py-2.5 text-xs text-foreground focus:border-primary/50 outline-none transition-all font-bold text-center" /></div>
                                        <div className="space-y-1.5"><label className="text-[8px] font-black text-muted-foreground uppercase tracking-widest pl-1">Total</label><input type="text" value={ocrForm.volume_total} onChange={e => setOcrForm({ ...ocrForm, volume_total: e.target.value })} className="w-full bg-foreground/5 border border-border/20 rounded-xl px-3 py-2.5 text-xs text-foreground focus:border-primary/50 outline-none transition-all font-bold text-center" /></div>
                                    </div>
                                </div>

                                {/* Seção Elétrica */}
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest border-l-2 border-amber-500 pl-2">Especificações Elétricas</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5"><label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Tensão (Voltagem)</label><input type="text" value={ocrForm.voltage} onChange={e => setOcrForm({ ...ocrForm, voltage: e.target.value })} className="w-full bg-foreground/5 border border-border/20 rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-primary/50 outline-none transition-all font-bold" /></div>
                                        <div className="space-y-1.5"><label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Frequência</label><input type="text" value={ocrForm.frequency} onChange={e => setOcrForm({ ...ocrForm, frequency: e.target.value })} className="w-full bg-foreground/5 border border-border/20 rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-primary/50 outline-none transition-all font-bold" /></div>
                                        <div className="space-y-1.5"><label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Corrente Elétrica</label><input type="text" value={ocrForm.electric_current} onChange={e => setOcrForm({ ...ocrForm, electric_current: e.target.value })} className="w-full bg-foreground/5 border border-border/20 rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-primary/50 outline-none transition-all font-bold" /></div>
                                        <div className="space-y-1.5"><label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Potência Degelo</label><input type="text" value={ocrForm.defrost_power} onChange={e => setOcrForm({ ...ocrForm, defrost_power: e.target.value })} className="w-full bg-foreground/5 border border-border/20 rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-primary/50 outline-none transition-all font-bold" /></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-border/10 bg-foreground/5 flex gap-3 shrink-0">
                            <button
                                onClick={() => setShowOcrModal(false)}
                                className="px-6 py-3 bg-foreground/5 hover:bg-foreground/10 text-foreground rounded-xl font-black uppercase tracking-widest text-[10px] transition-all border border-border/10"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    if (isProcessing || !labelPhoto) {
                                        if (!labelPhoto) toast.error("Foto da etiqueta é obrigatória");
                                        return;
                                    }
                                    const capturedPhotos = { photo_model: labelPhoto };
                                    const result = await registerProduct(ocrForm, capturedPhotos);
                                    if (result) {
                                        setShowOcrModal(false);
                                        // Imprime a etiqueta automaticamente após o cadastro bem-sucedido
                                        const { printLabels } = await import("@/lib/export-utils");
                                        await printLabels([result]);
                                    }
                                }}
                                disabled={isProcessing}
                                className="flex-1 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isProcessing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <CheckCircle className="h-4 w-4" />
                                )}
                                {isProcessing ? "PROCESSANDO..." : "Confirmar e Cadastrar no Banco"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Fullscreen Image Modal */}
            {isFullscreenImage && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/95 backdrop-blur-md animate-in zoom-in-95 duration-200 cursor-zoom-out"
                    onClick={() => setIsFullscreenImage(false)}
                >
                    <button
                        className="absolute top-6 right-6 lg:top-10 lg:right-10 h-10 w-10 md:h-12 md:w-12 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 text-foreground transition-colors z-50 backdrop-blur-md"
                        onClick={() => setIsFullscreenImage(false)}
                    >
                        <X className="h-5 w-5" />
                    </button>
                    <img
                        src={labelPhoto ?? undefined}
                        alt="Etiqueta em Fullscreen"
                        className="max-w-full max-h-[90vh] aspect-[9/16] object-cover rounded-xl shadow-2xl cursor-default pointer-events-none"
                    />
                </div>
            )}

            {/* Inputs de Arquivo Ocultos */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={onFileChange}
            />
        </MainLayout>
    );
}
