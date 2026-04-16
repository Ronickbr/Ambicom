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
    ChevronDown,
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
import { formatTotalVolume, parseVolumeToNumber } from "@/lib/product-utils";

import { RemotePrinterSelector } from "@/components/printing/RemotePrinterSelector";
import { useRemotePrint } from "@/hooks/useRemotePrint";

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
    } catch (err) {
        logger.debug("Falha ao ler EXIF orientation", err);
    }
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
        img.onload = async () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d")!;

            applyExifRotation(ctx, img, orientation, canvas);

            let q = quality;
            let result = canvas.toDataURL("image/jpeg", q);

            while (result.length * 0.75 > maxKB * 1024 && q > 0.2) {
                q -= 0.1; // Aumentado o step de 0.05 para 0.1 para reduzir as iterações e melhorar performance
                result = canvas.toDataURL("image/jpeg", q);
                // Yield para a main thread para não travar a UI
                await new Promise(r => setTimeout(r, 0));
            }

            resolve(result);
        };
        img.onerror = () => resolve(dataUrl); // Fallback em caso de erro
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

// ─── Componente OCR Modal (Isolado para performance) ───────────────────────
const OCRModal = ({
    initialData,
    labelPhoto,
    largeAMinVolume,
    isProcessing,
    onClose,
    onConfirm
}: {
    initialData: any;
    labelPhoto: string | null;
    largeAMinVolume: number;
    isProcessing: boolean;
    onClose: () => void;
    onConfirm: (data: any) => void;
}) => {
    const [ocrForm, setOcrForm] = useState(() => ({ has_water_dispenser: false, ...initialData }));
    const [isFullscreenImage, setIsFullscreenImage] = useState(false);
    const volumeTotal = parseVolumeToNumber(ocrForm.volume_total);
    const isEligibleForLargeA = volumeTotal !== null && volumeTotal >= largeAMinVolume;
    const isLargeAChecked = Boolean(ocrForm.has_water_dispenser) && isEligibleForLargeA;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
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
                            onClick={onClose}
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
                                <div className={cn(
                                    "rounded-2xl border px-4 py-3 flex items-center justify-between gap-4",
                                    isEligibleForLargeA ? "bg-emerald-500/10 border-emerald-500/20" : "bg-foreground/5 border-border/20 opacity-80"
                                )}>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-foreground">Classificar como Grande/A</p>
                                        <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest truncate">
                                            Disponível a partir de {new Intl.NumberFormat("pt-BR").format(largeAMinVolume)} L
                                        </p>
                                    </div>
                                    <label className={cn(
                                        "h-10 w-14 rounded-full border flex items-center p-1 transition-colors shrink-0 cursor-pointer",
                                        isEligibleForLargeA ? "border-emerald-500/30 bg-emerald-500/10" : "border-border/20 bg-foreground/5 cursor-not-allowed"
                                    )}>
                                        <input
                                            type="checkbox"
                                            className="sr-only"
                                            checked={isLargeAChecked}
                                            onChange={(e) => setOcrForm({ ...ocrForm, has_water_dispenser: isEligibleForLargeA ? e.target.checked : false })}
                                            disabled={!isEligibleForLargeA}
                                        />
                                        <span className={cn(
                                            "h-8 w-8 rounded-full transition-all",
                                            isLargeAChecked ? "translate-x-4 bg-emerald-500" : "translate-x-0 bg-muted-foreground/40"
                                        )} />
                                    </label>
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

                        <div className="p-6 border-t border-border/10 bg-foreground/5 flex gap-3 shrink-0">
                            <button
                                onClick={onClose}
                                className="px-6 py-3 bg-foreground/5 hover:bg-foreground/10 text-foreground rounded-xl font-black uppercase tracking-widest text-[10px] transition-all border border-border/10"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => onConfirm({ ...ocrForm, has_water_dispenser: isLargeAChecked })}
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
            </div>

            {/* Fullscreen Image Modal - Movido para dentro do OCRModal */}
            {isFullscreenImage && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in zoom-in-95 duration-200 cursor-zoom-out"
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
        </>
    );
};

// ─── Componente ────────────────────────────────────────────────────────────
const ScanPage = () => {
    const navigate = useNavigate();
    const { profile, loading: authLoading } = useAuth();
    const webcamRef = useRef<Webcam>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const [videoConstraints, setVideoConstraints] = useState<MediaTrackConstraints | boolean>(CAMERA_CONSTRAINTS);
    const [isInitializingCamera, setIsInitializingCamera] = useState(true);
    const [isCapturing, setIsCapturing] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);

    // Hook de Impressão Remota Centralizado
    const {
        selectedPrinter: activePrinter,
        printLabels: executeRemotePrint,
        isPrinting: printingInProgress
    } = useRemotePrint();

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

    const [labelPhoto, setLabelPhoto] = useState<string | null>(null);
    const [scannedData, setScannedData] = useState<any>(null);
    const [largeAMinVolume, setLargeAMinVolume] = useState(600);

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
        const fetchLargeAMin = async () => {
            try {
                const { data, error } = await supabase
                    .from("system_settings")
                    .select("value")
                    .eq("key", "refrigerator_sizes")
                    .maybeSingle();

                if (error) throw error;

                const parsedValue = typeof data?.value === "string" ? JSON.parse(data.value) : data?.value;
                const parsedMin = Number(parsedValue?.large_a_min);
                if (Number.isFinite(parsedMin) && parsedMin > 0) {
                    setLargeAMinVolume(parsedMin);
                }
            } catch (e) {
                logger.error("Erro ao carregar configuração de Grande/A:", e);
            }
        };

        fetchLargeAMin();
    }, []);

    useEffect(() => {
        if (!authLoading && !profile) {
            navigate("/login");
        }
    }, [authLoading, profile, navigate]);

    useEffect(() => {
        isMounted.current = true;

        const initCamera = async () => {
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error("MediaDevices API não suportada neste navegador.");
                }

                // 1. Pedimos permissão básica para listar os dispositivos com nomes
                const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
                
                // Libera o stream temporário para não bloquear a câmera
                tempStream.getTracks().forEach(track => track.stop());

                // 2. Listamos os dispositivos
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(device => device.kind === 'videoinput');

                if (isMounted.current) {
                    setAvailableCameras(videoDevices);
                }

                // 3. Lógica de seleção (Evitar Ultrawide, priorizar principal traseira)
                if (videoDevices.length > 0) {
                    let selectedId = videoDevices[0].deviceId;
                    if (videoDevices.length > 1) {
                        // Filtra todas as câmeras traseiras
                        const backCameras = videoDevices.filter(d => {
                            const label = d.label?.toLowerCase() || '';
                            const isBack = label.includes('back') || label.includes('environment') || label.includes('traseira');
                            // Evitamos excluir apenas "wide" porque iPhones podem nomear a principal como "Back Wide Camera". Focamos em "ultra" e "0.5".
                            const isUltraWide = label.includes('ultra') || label.includes('0.5');
                            const isMacroOrDepth = label.includes('macro') || label.includes('depth');
                            
                            return isBack && !isUltraWide && !isMacroOrDepth;
                        });

                        if (backCameras.length > 0) {
                            // Pega a primeira que sobrou (geralmente a principal)
                            // Tenta priorizar a '0' no Android, pois costuma ser a lente principal de alta resolução
                            const cam0 = backCameras.find(d => d.label?.includes('0'));
                            selectedId = cam0 ? cam0.deviceId : backCameras[0].deviceId;
                        } else {
                            // Fallback caso o filtro seja muito restritivo, pega qualquer uma que seja 'back' e não 'ultra'
                            const anyBack = videoDevices.find(d => d.label?.toLowerCase().includes('back') && !d.label?.toLowerCase().includes('ultra'));
                            selectedId = anyBack ? anyBack.deviceId : videoDevices[videoDevices.length - 1].deviceId;
                        }
                    }

                    if (isMounted.current) {
                        setVideoConstraints({
                            ...CAMERA_CONSTRAINTS,
                            facingMode: undefined, // Remove facingMode pois usaremos deviceId
                            deviceId: { exact: selectedId },
                            advanced: [{ focusMode: "continuous" } as any]
                        });
                    }
                }
            } catch (error) {
                logger.error("Erro ao selecionar câmera específica:", error);
                // Fallback: mantém CAMERA_CONSTRAINTS (que usa facingMode: "environment")
            } finally {
                if (isMounted.current) {
                    setIsInitializingCamera(false);
                }
            }
        };

        initCamera();

        return () => {
            isMounted.current = false;
            if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
            const track = activeTrackRef.current;
            // FIX: Só tenta desligar o flash se a track ainda estiver viva e ativa
            if (track && track.readyState === "live") {
                track.applyConstraints({ advanced: [{ torch: false } as any] })
                    .catch(err => logger.debug("Cleanup: Torch already off or track closed", err));
                // FIX: Fecha a track da câmera para evitar memory leaks
                track.stop();
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
        
        setIsCapturing(true);

        triggerFocusAnimation();

        // FIX: Aumentado de 450ms para 600ms — dispositivos mid-range como
        // o G35 5G precisam de mais tempo para o foco estabilizar após o trigger
        await new Promise(r => setTimeout(r, 600));

        const rawImage = webcamRef.current.getScreenshot();
        
        setIsCapturing(false);

        if (!rawImage) return;

        toast.info("Processando imagem...");

        const compressed = await compressImage(rawImage, MAX_IMAGE_SIZE_KB);

        setLabelPhoto(compressed);

        toast.info("Analisando etiqueta...");

        const data = await scanImage(compressed);
        if (data) {
            setScannedData({
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
                has_water_dispenser: false
            });
            setShowOcrModal(true);
        }
    };

    // ── Impressão Remota ──────────────────────────────────────────────────
    const handleRemotePrint = async (data: any) => {
        await executeRemotePrint(data);
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
                    setScannedData({
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
                        has_water_dispenser: false
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
                    <div className="flex flex-col sm:flex-row items-stretch md:items-center gap-4">
                        <div className="glass-card flex items-center gap-4 py-3 px-6 border-border/10 bg-card/50 shadow-inner justify-between sm:justify-start">
                            <div className={cn("h-8 w-8 rounded-full flex items-center justify-center border shadow-sm", isOnline ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20")}>
                                {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                            </div>
                            <div>
                                <div className="text-[8px] uppercase font-black text-muted-foreground tracking-widest leading-none mb-0.5">Status Rede</div>
                                <div className="text-sm font-black text-foreground italic tracking-widest">
                                    {isOnline ? "ONLINE" : "OFFLINE"}
                                </div>
                            </div>
                        </div>

                        <RemotePrinterSelector className="min-w-[200px]" showLabel={true} />
                    </div>
                </div>

                <div className="grid lg:grid-cols-5 gap-8">
                    <div className="lg:col-span-3 space-y-6">
                        {/* Seletor de Câmeras e Container Principal */}
                        <div className="flex flex-col gap-4">
                            {/* Seletor de Câmera */}
                            {availableCameras.length > 0 && (() => {
                                let currentDeviceId: string | undefined = undefined;
                                if (typeof videoConstraints === 'object' && videoConstraints !== null) {
                                    const deviceIdConstraint = (videoConstraints as any).deviceId;
                                    if (typeof deviceIdConstraint === 'object' && deviceIdConstraint !== null) {
                                        currentDeviceId = deviceIdConstraint.exact;
                                    } else if (typeof deviceIdConstraint === 'string') {
                                        currentDeviceId = deviceIdConstraint;
                                    }
                                }

                                return (
                                    <div className="glass-card p-3 border-border/10 bg-card/50 w-full flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/20">
                                            <Camera className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <label htmlFor="camera-select" className="text-[9px] uppercase font-black text-muted-foreground tracking-widest leading-none mb-1 block">
                                                Câmera Ativa
                                            </label>
                                            <div className="relative">
                                                <select
                                                    id="camera-select"
                                                    value={currentDeviceId || ""}
                                                    onChange={(e) => {
                                                        setCameraReady(false);
                                                        setVideoConstraints({
                                                            ...CAMERA_CONSTRAINTS,
                                                            facingMode: undefined,
                                                            deviceId: { exact: e.target.value },
                                                            advanced: [{ focusMode: "continuous" } as any]
                                                        });
                                                    }}
                                                    className="w-full appearance-none bg-transparent border-none text-sm font-bold text-foreground focus:ring-0 focus:outline-none cursor-pointer truncate pr-8"
                                                >
                                                    {availableCameras.map((cam, idx) => (
                                                        <option key={cam.deviceId} value={cam.deviceId} className="bg-background text-foreground">
                                                            {cam.label || `Câmera ${idx + 1}`}
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                                    <ChevronDown className="h-4 w-4" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="glass-card p-2 border-border/20 bg-black shadow-2xl relative overflow-hidden group max-w-sm mx-auto w-full">
                            <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-card border border-border/10">
                                {!cameraError && !isInitializingCamera ? (
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
                                                disabled={ocrLoading || isCapturing || !cameraReady}
                                                className="w-full max-w-sm h-16 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-4 transition-all shadow-[0_0_40px_rgba(14,165,233,0.4)] active:scale-95 disabled:opacity-50 disabled:grayscale"
                                            >
                                                {(ocrLoading || isCapturing) ? (
                                                    <Loader2 className="h-6 w-6 animate-spin" />
                                                ) : (
                                                    <Camera className="h-6 w-6" />
                                                )}
                                                {isCapturing ? "Focando e Capturando..." : ocrLoading ? "Lendo dados..." : "Extrair Dados da Etiqueta"}
                                            </button>
                                        </div>

                                        <button
                                            className="absolute inset-0 z-[5] cursor-crosshair bg-transparent"
                                            onClick={triggerFocusAnimation}
                                            aria-label="Acionar autofoco"
                                        />

                                        {!cameraReady && (
                                            <div className="absolute inset-0 bg-background/80 backdrop-blur-md flex flex-col items-center justify-center z-50">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                                                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Trocando Câmera...</p>
                                            </div>
                                        )}
                                    </>
                                ) : isInitializingCamera ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
                                        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
                                            <Loader2 className="h-8 w-8 animate-spin" />
                                        </div>
                                        <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Iniciando Câmera</h3>
                                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">Selecionando a melhor lente para leitura...</p>
                                    </div>
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
                </div>

                {/* Lado Direito: Histórico / Ações adicionais */}
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
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
                <OCRModal
                    initialData={scannedData}
                    labelPhoto={labelPhoto}
                    largeAMinVolume={largeAMinVolume}
                    isProcessing={isProcessing}
                    onClose={() => setShowOcrModal(false)}
                    onConfirm={async (finalData) => {
                        if (isProcessing || !labelPhoto) {
                            if (!labelPhoto) toast.error("Foto da etiqueta é obrigatória");
                            return;
                        }
                        const capturedPhotos = { photo_model: labelPhoto };
                        const result = await registerProduct(finalData, capturedPhotos);
                        if (result) {
                            setShowOcrModal(false);
                            await handleRemotePrint(result);
                            if (activePrinter) {
                                toast.success(`Impressão gerada para ${activePrinter}`, { id: 'autoprint' });
                            } else {
                                toast.success("Equipamento cadastrado com sucesso! Iniciando download da etiqueta em PDF.", { duration: 6000 });
                            }
                        }
                    }}
                />
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
