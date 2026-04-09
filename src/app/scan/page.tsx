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
    FlashlightOff,
    Printer,
    Globe,
    AlertTriangle,
    Check
} from "lucide-react";
import { toast } from "sonner";
import { printService, ActiveBridge } from "@/lib/print-service";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useScan } from "@/hooks/useScan";
import { logger } from "@/lib/logger";
import { formatTotalVolume } from "@/lib/product-utils";

// ─── Constantes de Câmera ──────────────────────────────────────────────────
// FIX: Resolução reduzida para evitar que o Chrome mobile entre em modo
//      de compatibilidade e desabilite features avançadas (afeta Moto G35 5G).
//      720p é suficiente para OCR e garante acesso ao API de constraints avançadas.
const CAMERA_CONSTRAINTS: MediaTrackConstraints = {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280, min: 640 },
    height: { ideal: 720, min: 480 },
    aspectRatio: { ideal: 16 / 9 },
    frameRate: { ideal: 30, max: 30 },
};

const CAPTURE_QUALITY = 0.85;
const MAX_IMAGE_SIZE_KB = 1024;

// ─── Helpers ───────────────────────────────────────────────────────────────

function getExifOrientation(dataUrl: string): number {
    if (!dataUrl.startsWith("data:image/jpeg")) return 1;

    try {
        const base64 = dataUrl.split(",")[1];
        const bin = atob(base64);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);

        let offset = 2;
        while (offset < buf.length - 1) {
            if (buf[offset] !== 0xFF) break;
            const marker = buf[offset + 1];
            const segLen = (buf[offset + 2] << 8) | buf[offset + 3];

            if (marker === 0xE1) {
                const exifMagic = String.fromCharCode(...Array.from(buf.slice(offset + 4, offset + 10)));
                if (exifMagic.startsWith("Exif")) {
                    const tiffOffset = offset + 10;
                    const isLE = buf[tiffOffset] === 0x49;
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
                        if (tag === 0x0112) {
                            return read16(eOff + 8);
                        }
                    }
                }
            }

            if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) {
                offset += 2;
            } else {
                offset += 2 + segLen;
            }
        }
    } catch { }
    return 1;
}

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
        case 2: ctx.transform(-1, 0, 0, 1, iw, 0); break;
        case 3: ctx.transform(-1, 0, 0, -1, iw, ih); break;
        case 4: ctx.transform(1, 0, 0, -1, 0, ih); break;
        case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
        case 6: ctx.transform(0, 1, -1, 0, ih, 0); break;
        case 7: ctx.transform(0, -1, -1, 0, ih, iw); break;
        case 8: ctx.transform(0, -1, 1, 0, 0, iw); break;
    }
    ctx.drawImage(img, 0, 0);
    ctx.restore();

    return { w: canvas.width, h: canvas.height };
}

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

            while (result.length * 0.75 > maxKB * 1024 && q > 0.2) {
                q -= 0.05;
                result = canvas.toDataURL("image/jpeg", q);
            }

            resolve(result);
        };
        img.src = dataUrl;
    });
}

// FIX: Detecta suporte real de zoom verificando min/max (alguns dispositivos
// expõem zoom=0 ou zoom={} que são inválidos)
function getValidZoom(caps: any, targetMultiplier: number): number | null {
    const zoom = caps?.zoom;
    if (!zoom || typeof zoom !== "object") return null;

    const min = typeof zoom.min === "number" ? zoom.min : 1;
    const max = typeof zoom.max === "number" ? zoom.max : 1;

    if (max <= min || max <= 1) return null; // zoom não funcional

    return Math.min(targetMultiplier, max);
}

// ─── Tipos ─────────────────────────────────────────────────────────────────
type FocusStatus = "idle" | "focusing" | "locked" | "failed";

// ─── FIX: Helper para aplicar constraints avançadas com fallback granular ──
async function applyAdvancedConstraintsSafely(
    track: MediaStreamTrack,
    constraints: Record<string, unknown>
): Promise<void> {
    try {
        if (track.readyState !== "live") return;
        await track.applyConstraints({ advanced: [constraints as any] });
        logger.info("Advanced constraints applied (batch)", constraints);
        return;
    } catch (e) {
        logger.warn("Batch constraints failed, falling back to individual application", e);
    }

    for (const [key, value] of Object.entries(constraints)) {
        try {
            if (track.readyState !== "live") break;
            await track.applyConstraints({ advanced: [{ [key]: value } as any] });
            logger.info(`Constraint applied individually: ${key} =`, value);
        } catch (err) {
            logger.warn(`Constraint not supported, skipping: ${key}`, err);
        }
    }
}

// ─── Componente ────────────────────────────────────────────────────────────
const ScanPage = () => {
    const navigate = useNavigate();
    const { profile, loading: authLoading } = useAuth();
    const webcamRef = useRef<Webcam>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const [videoConstraints, setVideoConstraints] = useState<MediaTrackConstraints | boolean>(CAMERA_CONSTRAINTS);
    const [showHistory, setShowHistory] = useState(false);

    // Estados de Impressão Remota
    const [activeBridges, setActiveBridges] = useState<ActiveBridge[]>([]);
    const [selectedPrinter, setSelectedPrinter] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('default_printer') || "";
        }
        return "";
    });
    const [isPrinting, setIsPrinting] = useState(false);

    // Persistir impressora selecionada
    useEffect(() => {
        if (selectedPrinter) {
            localStorage.setItem('default_printer', selectedPrinter);
        }
    }, [selectedPrinter]);

    const [cameraError, setCameraError] = useState(false);
    const [cameraReady, setCameraReady] = useState(false);

    const [torchOn, setTorchOn] = useState(false);
    const [torchSupported, setTorchSupported] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [focusStatus, setFocusStatus] = useState<FocusStatus>("idle");
    const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isMounted = useRef(true);
    const activeTrackRef = useRef<MediaStreamTrack | null>(null);
    const capsRef = useRef<any>(null);

    const [showOcrModal, setShowOcrModal] = useState(false);
    const [isFullscreenImage, setIsFullscreenImage] = useState(false);

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

    useEffect(() => {
        isMounted.current = true;

        // Carregar pontes de impressão
        printService.getActiveBridges().then(setActiveBridges);

        return () => {
            isMounted.current = false;
            if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
            const track = activeTrackRef.current;
            // FIX: Só tenta desligar o flash se a track ainda estiver viva e ativa
            if (track && track.readyState === "live") {
                track.applyConstraints({ advanced: [{ torch: false } as any] })
                    .catch(err => logger.debug("Cleanup: Torch already off or track closed", err));
            }
        };
    }, []);

    // ── Autofocus ─────────────────────────────────────────────────────────
    const triggerFocusAnimation = useCallback(async () => {
        if (!isMounted.current) return;
        setFocusStatus("focusing");
        if (focusTimerRef.current) clearTimeout(focusTimerRef.current);

        const track = activeTrackRef.current;
        const caps = capsRef.current;

        if (track && caps && track.readyState === "live") {
            try {
                const supportedFocus: string[] = caps.focusMode || [];

                if (supportedFocus.includes("continuous")) {
                    if (supportedFocus.includes("single-shot")) {
                        await track.applyConstraints({ advanced: [{ focusMode: "single-shot" } as any] }).catch(() => { });
                        if (!isMounted.current) return;
                        await new Promise(r => setTimeout(r, 150));
                        if (!isMounted.current) return;
                        await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as any] }).catch(() => { });
                    } else {
                        await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as any] }).catch(() => { });
                    }
                }
            } catch (e) {
                logger.warn("Hardware refocus failed", e);
            }
        }

        if (!isMounted.current) return;
        focusTimerRef.current = setTimeout(() => {
            if (!isMounted.current) return;
            setFocusStatus("locked");
            focusTimerRef.current = setTimeout(() => {
                if (!isMounted.current) return;
                setFocusStatus("idle");
            }, 1200);
        }, 600);
    }, [isMounted]);

    // ── Handlers de câmera ────────────────────────────────────────────────
    const handleCameraError = (err: string | DOMException) => {
        logger.error("Camera access error", err);

        if (typeof videoConstraints !== "boolean" && (videoConstraints as MediaTrackConstraints).width) {
            logger.info("Retrying with basic environment constraint");
            setVideoConstraints({ facingMode: "environment" });
            return;
        }

        if (typeof videoConstraints !== "boolean" && (videoConstraints as any).facingMode === "environment") {
            logger.info("Environment camera not found, falling back to any camera");
            setVideoConstraints(true);
            return;
        }

        setCameraError(true);
    };

    const handleCameraReady = async () => {
        setCameraReady(true);
        logger.info("Camera access granted");

        const stream = webcamRef.current?.video?.srcObject as MediaStream | null;
        if (!stream) return;

        const track = stream.getVideoTracks()[0];
        if (!track) return;

        // FIX: Guarda referências para uso futuro
        activeTrackRef.current = track;

        // FIX: getCapabilities() pode retornar {} em alguns browsers/dispositivos.
        // Sempre verificar se a propriedade existe E tem valor utilizável.
        const caps: any = track.getCapabilities?.() ?? {};
        capsRef.current = caps;

        logger.info("Hardware capabilities detected:", JSON.stringify(caps));

        // Detecta suporte a torch
        setTorchSupported(!!caps.torch);

        // FIX: Monta o objeto de constraints apenas com o que realmente está disponível
        const supportedFocus: string[] = Array.isArray(caps.focusMode) ? caps.focusMode : [];
        const advancedConstraints: Record<string, unknown> = {};

        // Foco: prefere continuous, aceita single-shot, ignora se nenhum disponível
        // FIX: Remove "macro" da lista de prioridade — causa travamento em mid-range
        if (supportedFocus.includes("continuous")) {
            advancedConstraints.focusMode = "continuous";
            logger.info("Focus mode: continuous");
        } else if (supportedFocus.includes("single-shot")) {
            advancedConstraints.focusMode = "single-shot";
            logger.info("Focus mode: single-shot (fallback)");
        } else {
            logger.info("Focus mode: não suportado, deixando o driver decidir");
        }

        // Exposição automática
        if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes("continuous")) {
            advancedConstraints.exposureMode = "continuous";
        }

        // Balanço de branco automático
        if (Array.isArray(caps.whiteBalanceMode) && caps.whiteBalanceMode.includes("continuous")) {
            advancedConstraints.whiteBalanceMode = "continuous";
        }

        // FIX: Zoom com validação real de min/max.
        // Moto G35 5G pode expor zoom mas com range inválido (max=1).
        // Reduzido de 2× para 1.5× para maior compatibilidade.
        const safeZoom = getValidZoom(caps, 1.5);
        if (safeZoom !== null) {
            advancedConstraints.zoom = safeZoom;
            logger.info(`Zoom configurado para ${safeZoom}×`);
        } else {
            logger.info("Zoom não disponível ou range inválido, ignorando");
        }

        // FIX: Usa o helper que aplica individualmente em caso de falha em lote
        if (Object.keys(advancedConstraints).length > 0) {
            await applyAdvancedConstraintsSafely(track, advancedConstraints);
        }

        if (!isMounted.current) return;

        // FIX: Aguarda 300ms após configurar antes de disparar o foco
        // para dar tempo ao hardware de estabilizar (importante no G35 5G)
        await new Promise(r => setTimeout(r, 300));

        if (!isMounted.current) return;
        triggerFocusAnimation();
    };

    // ── Toggle Flash ─────────────────────────────────────────────────────
    const toggleTorch = useCallback(async () => {
        const track = activeTrackRef.current;
        if (!track || track.readyState !== "live") {
            toast.error("Câmera não disponível ou inativa");
            return;
        }

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

        // FIX: Aumentado de 450ms para 600ms — dispositivos mid-range como
        // o G35 5G precisam de mais tempo para o foco estabilizar após o trigger
        await new Promise(r => setTimeout(r, 600));

        const rawImage = webcamRef.current.getScreenshot();
        if (!rawImage) return;

        toast.info("Processando imagem...");

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

    // ── Impressão Remota ──────────────────────────────────────────────────
    const handleRemotePrint = async (data: any, autoPrinterOverride?: string) => {
        const targetPrinter = autoPrinterOverride || selectedPrinter;
        if (!targetPrinter) {
            toast.error("Selecione uma impressora");
            return;
        }

        setIsPrinting(true);
        try {
            const val = (v: any) => v || '-';
            const zplCode = `^XA
^FWB
^PW640
^LL440
^CI28
^FO15,15^A0N,45,45^FDAmbicom^FS
^FO15,65^A0N,15,15^FDR. Wenceslau Marek, 10 - Aguas Belas,^FS
^FO15,80^A0N,15,15^FDSao Jose dos Pinhais - PR, 83010-520^FS
^FO15,100^A0N,25,25^FDSAC: 041 - 3382-5410^FS
^FO270,15^A0N,15,15^FB160,1,0,C^FDPRODUTO^FS
^FO270,30^A0N,15,15^FB160,1,0,C^FDREMANUFATURADO^FS
^FO270,45^A0N,15,15^FB160,1,0,C^FDGARANTIA^FS
^FO270,60^A0N,15,15^FB160,1,0,C^FDAMBICOM^FS
^FO10,120^GB420,500,2^FS
^FO10,180^GB420,0,2^FS
^FO10,280^GB420,0,2^FS
^FO10,350^GB420,0,2^FS
^FO10,420^GB420,0,2^FS
^FO10,490^GB420,0,2^FS
^FO10,550^GB420,0,2^FS
^FO215,120^GB0,60,2^FS
^FO260,280^GB0,70,2^FS
^FO150,350^GB0,140,2^FS
^FO290,350^GB0,270,2^FS
^FO150,550^GB0,70,2^FS
^FO10,125^A0N,15,15^FB205,1,0,C^FDMODELO^FS
^FO10,145^A0N,30,30^FB205,1,0,C^FD${val(data.model || data.modelo)}^FS
^FO215,125^A0N,15,15^FB215,1,0,C^FDVOLTAGEM^FS
^FO215,145^A0N,30,30^FB215,1,0,C^FD${val(data.voltage || data.tensao)}^FS
^FO20,182^BQN,2,4^FDQA,${val(data.internal_serial)}^FS
^FO100,185^A0N,15,15^FB330,1,0,C^FDNUMERO DE SERIE AMBICOM:^FS
^FO100,205^A0N,35,35^FB330,1,0,C^FD${val(data.internal_serial)}^FS
^FO100,245^A0N,25,25^FB330,1,0,C^FD${val(data.commercial_code || data.codigo_comercial)}^FS
^FO10,285^A0N,15,15^FB250,1,0,C^FDPNC/ML^FS
^FO10,305^A0N,40,40^FB250,1,0,C^FD${val(data.pnc_ml)}^FS
^FO260,285^A0N,15,15^FB170,1,0,C^FDFREQUENCIA^FS
^FO260,305^A0N,35,35^FB170,1,0,C^FD${val(data.frequency || data.frequencia || '60 Hz')}^FS
^FO10,355^A0N,15,15^FB140,1,0,C^FDGAS FRIGOR.^FS
^FO10,375^A0N,25,25^FB140,1,0,C^FD${val(data.refrigerant_gas || data.gas_refrigerante)}^FS
^FO150,355^A0N,15,15^FB140,1,0,C^FDCARGA GAS^FS
^FO150,375^A0N,25,25^FB140,1,0,C^FD${val(data.gas_charge || data.carga_gas)}^FS
^FO290,355^A0N,15,15^FB140,1,0,C^FDCOMPRESSOR^FS
^FO290,375^A0N,25,25^FB140,1,0,C^FD${val(data.compressor)}^FS
^FO10,425^A0N,15,15^FB140,1,0,C^FDVOL. FREEZER^FS
^FO10,445^A0N,25,25^FB140,1,0,C^FD${val(data.volume_freezer)}^FS
^FO150,425^A0N,15,15^FB140,1,0,C^FDVOL. REFRIG.^FS
^FO150,445^A0N,25,25^FB140,1,0,C^FD${val(data.volume_refrigerator)}^FS
^FO290,425^A0N,15,15^FB140,1,0,C^FDVOLUME TOTAL^FS
^FO290,445^A0N,25,25^FB140,1,0,C^FD${formatTotalVolume(data.volume_freezer, data.volume_refrigerator, data.volume_total)}^FS
^FO10,495^A0N,15,15^FB280,1,0,C^FDP. DE ALTA / P. DE BAIXA^FS
^FO10,515^A0N,20,20^FB280,1,0,C^FD${val(data.pressure_high_low || data.pressao_alta_baixa)}^FS
^FO290,495^A0N,15,15^FB140,1,0,C^FDCAPAC. CONG.^FS
^FO290,515^A0N,25,25^FB140,1,0,C^FD${val(data.freezing_capacity || data.capacidade_congelamento)}^FS
^FO10,555^A0N,15,15^FB140,1,0,C^FDCORRENTE^FS
^FO10,575^A0N,25,25^FB140,1,0,C^FD${val(data.electric_current || data.corrente_eletrica)}^FS
^FO150,555^A0N,15,15^FB140,1,0,C^FDPOT. DEGELO^FS
^FO150,575^A0N,25,25^FB140,1,0,C^FD${val(data.defrost_power || data.potencia_degelo)}^FS
^FO290,555^A0N,15,15^FB140,1,0,C^FDTAMANHO^FS
^FO290,575^A0N,30,30^FB140,1,0,C^FD${data.size || data.tamanho ? String(data.size || data.tamanho).charAt(0).toUpperCase() : '-'}^FS
^XZ`.replace(/\n/g, '');
            await printService.submitPrintJob({
                payload_type: 'zpl',
                payload_data: zplCode,
                printer_target: targetPrinter
            });
            toast.success("Impressão gerada e enviada para fila!");
        } catch (e) {
            toast.error("Erro ao enviar para fila de impressão");
            logger.error("Print submission failed", e);
        } finally {
            setIsPrinting(false);
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

                                        {cameraReady && (
                                            <div className={cn(
                                                "absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-sm bg-black/40 transition-all duration-300",
                                                focusIndicator.color
                                            )}>
                                                {focusIndicator.icon}
                                                <span className="text-[9px] font-black uppercase tracking-widest">{focusIndicator.label}</span>
                                            </div>
                                        )}

                                        {cameraReady && (
                                            <div className="absolute inset-0 z-10 pointer-events-none">
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

                                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20">
                                                    <Camera className="h-12 w-12 text-white" />
                                                </div>
                                            </div>
                                        )}

                                        {cameraReady && (
                                            <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                                                <div className="px-2 py-1 rounded-md bg-black/50 backdrop-blur-sm border border-white/10">
                                                    <span className="text-[8px] font-black text-white/60 uppercase tracking-widest">HD · 720p</span>
                                                </div>

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
                                                onClick={() => {
                                                    activeTrackRef.current = null;
                                                    capsRef.current = null;
                                                    setCameraError(false);
                                                    setCameraReady(false);
                                                    setVideoConstraints(CAMERA_CONSTRAINTS);
                                                }}
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

                            <div className="space-y-6">
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

                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest border-l-2 border-blue-500 pl-2">Capacidades e Volumes</h4>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="space-y-1.5"><label className="text-[8px] font-black text-muted-foreground uppercase tracking-widest pl-1">Freezer</label><input type="text" value={ocrForm.volume_freezer} onChange={e => setOcrForm({ ...ocrForm, volume_freezer: e.target.value })} className="w-full bg-foreground/5 border border-border/20 rounded-xl px-3 py-2.5 text-xs text-foreground focus:border-primary/50 outline-none transition-all font-bold text-center" /></div>
                                        <div className="space-y-1.5"><label className="text-[8px] font-black text-muted-foreground uppercase tracking-widest pl-1">Refrig.</label><input type="text" value={ocrForm.volume_refrigerator} onChange={e => setOcrForm({ ...ocrForm, volume_refrigerator: e.target.value })} className="w-full bg-foreground/5 border border-border/20 rounded-xl px-3 py-2.5 text-xs text-foreground focus:border-primary/50 outline-none transition-all font-bold text-center" /></div>
                                        <div className="space-y-1.5"><label className="text-[8px] font-black text-muted-foreground uppercase tracking-widest pl-1">Total</label><input type="text" value={ocrForm.volume_total} onChange={e => setOcrForm({ ...ocrForm, volume_total: e.target.value })} className="w-full bg-foreground/5 border border-border/20 rounded-xl px-3 py-2.5 text-xs text-foreground focus:border-primary/50 outline-none transition-all font-bold text-center" /></div>
                                    </div>
                                </div>

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
                                        // Verificação de Auto-Print via Impressora Padrão
                                        if (selectedPrinter) {
                                            handleRemotePrint(result, selectedPrinter);
                                            toast.success(`Impressão gerada para ${selectedPrinter}`, { id: 'autoprint' });
                                        } else {
                                            toast.warning("Equipamento cadastrado! Configure sua impressora padrão em 'Meu Perfil' para imprimir etiquetas automaticamente nas próximas vezes.", { duration: 6000 });
                                        }
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

export default ScanPage;