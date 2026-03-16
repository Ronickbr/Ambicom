import React, { useState, useEffect } from "react";
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
    Upload
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useScan } from "@/hooks/useScan";
import { logger } from "@/lib/logger";

export default function ScanPage() {
    const { profile, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const webcamRef = React.useRef<Webcam>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [videoConstraints, setVideoConstraints] = useState<MediaTrackConstraints | boolean>({
        facingMode: "environment"
    });
    const [cameraError, setCameraError] = useState(false);
    const [uploadType, setUploadType] = useState<'product' | 'model' | 'serial' | 'defect' | null>(null);

    // OCR States
    const [showOcrModal, setShowOcrModal] = useState(false);

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

    const handleCameraError = (err: string | DOMException) => {
        logger.error("Camera access error", err);

        // If "environment" camera not found, fallback to any camera
        if (typeof videoConstraints !== 'boolean' && videoConstraints.facingMode === 'environment') {
            logger.info("Environment camera not found, falling back to default camera");
            setVideoConstraints(true); // Basic true means "any video source"
            return;
        }

        setCameraError(true);
    };

    // Capture and OCR Handler
    const handleCaptureAndOCR = async () => {
        if (!webcamRef.current) return;
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;

        setLabelPhoto(imageSrc);
        toast.info("Analisando etiqueta...");

        const data = await scanImage(imageSrc);
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

    const handleFileUpload = () => {
        fileInputRef.current?.click();
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64String = reader.result as string;
                setLabelPhoto(base64String);
                toast.info("Analisando arquivo...");

                const data = await scanImage(base64String);
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

    return (
        <MainLayout>
            <div className="max-w-6xl mx-auto space-y-10 pb-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white uppercase italic">Captura de <span className="text-primary not-italic font-light">Etiqueta</span></h1>
                        <p className="text-muted-foreground font-medium text-sm mt-1 opacity-70 italic">Análise via IA para entrada de ativos no fluxo industrial.</p>
                    </div>
                    <div className="glass-card flex items-center gap-4 py-4 px-8 border-white/5 bg-neutral-900/50 shadow-inner w-full md:w-auto justify-between md:justify-start">
                        <div className={cn("h-10 w-10 rounded-full flex items-center justify-center border shadow-sm", isOnline ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20")}>
                            {isOnline ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                        </div>
                        <div>
                            <div className="text-[9px] uppercase font-black text-muted-foreground tracking-widest leading-none mb-1">Status da Rede</div>
                            <div className="text-lg font-black text-white italic tracking-widest">
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
                        <div className="glass-card p-2 border-white/10 bg-black shadow-2xl relative overflow-hidden group">
                            <div className="relative aspect-square md:aspect-video rounded-xl overflow-hidden bg-neutral-900 border border-white/5">
                                {!cameraError ? (
                                    <>
                                        <Webcam
                                            ref={webcamRef}
                                            audio={false}
                                            screenshotFormat="image/jpeg"
                                            videoConstraints={videoConstraints}
                                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                            onUserMediaError={handleCameraError}
                                            onUserMedia={() => logger.info("Camera access granted")}
                                        />
                                        {/* Simplified capture button */}
                                        <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center px-4">
                                            <button
                                                onClick={handleCaptureAndOCR}
                                                disabled={ocrLoading}
                                                className="w-full max-w-sm h-16 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-4 transition-all shadow-[0_0_40px_rgba(14,165,233,0.4)] active:scale-95 disabled:opacity-50 disabled:grayscale"
                                            >
                                                {ocrLoading ? (
                                                    <Loader2 className="h-6 w-6 animate-spin" />
                                                ) : (
                                                    <Camera className="h-6 w-6" />
                                                )}
                                                {ocrLoading ? "Lendo dados..." : "Extrair Dados da Etiqueta"}
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
                                        <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-2">
                                            <Camera className="h-8 w-8" />
                                        </div>
                                        <h3 className="text-xl font-black text-white uppercase tracking-tight">Câmera Indisponível</h3>
                                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">Verifique as permissões do navegador ou suba uma foto da galeria.</p>
                                        <div className="flex gap-4 w-full max-w-sm">
                                            <button
                                                onClick={() => setCameraError(false)}
                                                className="flex-1 px-6 py-4 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all border border-white/5 flex items-center justify-center gap-3"
                                            >
                                                <RefreshCw className="h-4 w-4" />
                                                Tentar Novamente
                                            </button>
                                            <button
                                                onClick={handleFileUpload}
                                                className="flex-1 px-6 py-4 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3"
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
                        <div className="glass-card bg-neutral-900/50 border-white/5 h-full flex flex-col p-8 relative overflow-hidden">
                            <div className="flex items-center gap-3 mb-8">
                                <HistoryIcon className="h-5 w-5 text-primary" />
                                <h2 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Registro de Sessão</h2>
                            </div>

                            <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                                {lastScans.length > 0 ? lastScans.map((product, index) => (
                                    <div key={index} className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-primary/30 transition-all group animate-in slide-in-from-right-4 fade-in duration-500" style={{ animationDelay: `${index * 100}ms` }}>
                                        <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground group-hover:text-white group-hover:bg-primary/20 transition-all font-mono text-xs font-bold border border-white/5">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-white text-sm truncate">{product.internal_serial}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={cn(
                                                    "h-1.5 w-1.5 rounded-full",
                                                    product.status === "CADASTRO" ? "bg-yellow-500" : "bg-emerald-500"
                                                )} />
                                                <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">{product.status}</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                    </div>
                                )) : (
                                    <div className="flex flex-col items-center justify-center h-40 text-center space-y-3 opacity-30">
                                        <HistoryIcon className="h-8 w-8 text-muted-foreground" />
                                        <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Nenhuma leitura recente</p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 pt-6 border-t border-white/5 text-center">
                                <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold opacity-40">
                                    Total Sessão: {lastScans.length} Ativos
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* NotFound Modal (Legado/Fallback) */}
            {notFound && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl space-y-6 p-8 relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
                        <div className="text-center space-y-2">
                            <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 mx-auto border border-amber-500/20 mb-4">
                                <FileText className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-black text-white uppercase tracking-tight">Ativo não Identificado</h3>
                            <p className="text-sm text-muted-foreground italic">O código <span className="text-white font-mono font-bold">{notFound}</span> não consta na base de dados.</p>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    registerProduct({ original_serial: notFound });
                                }}
                                className="h-14 bg-white text-black hover:bg-primary hover:text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-3 shadow-lg"
                            >
                                <RefreshCw className="h-4 w-4" />
                                Cadastrar Novo Ativo
                            </button>
                            <button
                                onClick={() => setNotFound(null)}
                                className="h-12 text-muted-foreground hover:text-white font-black text-[10px] uppercase transition-all tracking-widest"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* OCR Modal - Review and Confirm Registration */}
            {showOcrModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 border border-purple-500/20">
                                    <FileText className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white uppercase tracking-tight">Revisão de Dados</h3>
                                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Confirme as informações extraídas</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowOcrModal(false)}
                                className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-white transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1 bg-black/20">
                            {/* Visual Preview */}
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Documento Digitalizado</label>
                                <div className="flex justify-center">
                                    <div className="w-full max-w-[280px] aspect-[3/4] rounded-2xl bg-black border border-white/10 overflow-hidden relative group">
                                        <img
                                            src={labelPhoto ?? undefined}
                                            alt="Etiqueta Capturada"
                                            className="w-full h-full object-cover opacity-80"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                                <span className="text-[8px] font-black text-white uppercase tracking-widest">Análise de IA Concluída</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Form fields for review */}
                            <div className="space-y-6">
                                {/* Seção Identificação */}
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-primary uppercase tracking-widest border-l-2 border-primary pl-2">Identificação Extraída</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5 col-span-2">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Fabricante / Marca</label>
                                            <input
                                                type="text"
                                                value={ocrForm.brand}
                                                onChange={e => setOcrForm({ ...ocrForm, brand: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary/50 outline-none transition-all font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Modelo</label>
                                            <input
                                                type="text"
                                                value={ocrForm.model}
                                                onChange={e => setOcrForm({ ...ocrForm, model: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary/50 outline-none transition-all font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">TIPO</label>
                                            <input
                                                type="text"
                                                value={ocrForm.product_type}
                                                onChange={e => setOcrForm({ ...ocrForm, product_type: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary/50 outline-none transition-all font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1.5 col-span-2">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Número de Série Original</label>
                                            <input
                                                type="text"
                                                value={ocrForm.original_serial}
                                                onChange={e => setOcrForm({ ...ocrForm, original_serial: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary/50 outline-none transition-all font-bold font-mono uppercase"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Código Comercial</label>
                                            <input
                                                type="text"
                                                value={ocrForm.commercial_code}
                                                onChange={e => setOcrForm({ ...ocrForm, commercial_code: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary/50 outline-none transition-all font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Cor</label>
                                            <input
                                                type="text"
                                                value={ocrForm.color}
                                                onChange={e => setOcrForm({ ...ocrForm, color: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary/50 outline-none transition-all font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">PNC / ML</label>
                                            <input
                                                type="text"
                                                value={ocrForm.pnc_ml}
                                                onChange={e => setOcrForm({ ...ocrForm, pnc_ml: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary/50 outline-none transition-all font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Data Fabricação</label>
                                            <input
                                                type="text"
                                                value={ocrForm.manufacturing_date}
                                                onChange={e => setOcrForm({ ...ocrForm, manufacturing_date: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary/50 outline-none transition-all font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Seção Performance & Fluidos */}
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest border-l-2 border-emerald-500 pl-2">Desempenho e Fluidos</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Gás Refrigerante</label>
                                            <input
                                                type="text"
                                                value={ocrForm.refrigerant_gas}
                                                onChange={e => setOcrForm({ ...ocrForm, refrigerant_gas: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary/50 outline-none transition-all font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Carga de Gás</label>
                                            <input
                                                type="text"
                                                value={ocrForm.gas_charge}
                                                onChange={e => setOcrForm({ ...ocrForm, gas_charge: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary/50 outline-none transition-all font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Compressor</label>
                                            <input
                                                type="text"
                                                value={ocrForm.compressor}
                                                onChange={e => setOcrForm({ ...ocrForm, compressor: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary/50 outline-none transition-all font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Classe / Mercado</label>
                                            <input
                                                type="text"
                                                value={ocrForm.market_class}
                                                onChange={e => setOcrForm({ ...ocrForm, market_class: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary/50 outline-none transition-all font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Cap. Congelamento</label>
                                            <input
                                                type="text"
                                                value={ocrForm.freezing_capacity}
                                                onChange={e => setOcrForm({ ...ocrForm, freezing_capacity: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary/50 outline-none transition-all font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Pressões (H/L)</label>
                                            <input
                                                type="text"
                                                value={ocrForm.pressure_high_low}
                                                onChange={e => setOcrForm({ ...ocrForm, pressure_high_low: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary/50 outline-none transition-all font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Seção Volumes */}
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest border-l-2 border-blue-500 pl-2">Capacidades e Volumes</h4>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[8px] font-black text-muted-foreground uppercase tracking-widest pl-1">Freezer</label>
                                            <input
                                                type="text"
                                                value={ocrForm.volume_freezer}
                                                onChange={e => setOcrForm({ ...ocrForm, volume_freezer: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary/50 outline-none transition-all font-bold text-center"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[8px] font-black text-muted-foreground uppercase tracking-widest pl-1">Refrig.</label>
                                            <input
                                                type="text"
                                                value={ocrForm.volume_refrigerator}
                                                onChange={e => setOcrForm({ ...ocrForm, volume_refrigerator: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary/50 outline-none transition-all font-bold text-center"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[8px] font-black text-muted-foreground uppercase tracking-widest pl-1">Total</label>
                                            <input
                                                type="text"
                                                value={ocrForm.volume_total}
                                                onChange={e => setOcrForm({ ...ocrForm, volume_total: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:border-primary/50 outline-none transition-all font-bold text-center"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Seção Elétrica */}
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest border-l-2 border-amber-500 pl-2">Especificações Elétricas</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Tensão (Voltagem)</label>
                                            <input
                                                type="text"
                                                value={ocrForm.voltage}
                                                onChange={e => setOcrForm({ ...ocrForm, voltage: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary/50 outline-none transition-all font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Frequência</label>
                                            <input
                                                type="text"
                                                value={ocrForm.frequency}
                                                onChange={e => setOcrForm({ ...ocrForm, frequency: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary/50 outline-none transition-all font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Corrente Elétrica</label>
                                            <input
                                                type="text"
                                                value={ocrForm.electric_current}
                                                onChange={e => setOcrForm({ ...ocrForm, electric_current: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary/50 outline-none transition-all font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Potência Degelo</label>
                                            <input
                                                type="text"
                                                value={ocrForm.defrost_power}
                                                onChange={e => setOcrForm({ ...ocrForm, defrost_power: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary/50 outline-none transition-all font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-white/5 bg-white/5 flex gap-3 shrink-0">
                            <button
                                onClick={() => setShowOcrModal(false)}
                                className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all border border-white/5"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    if (!labelPhoto) {
                                        toast.error("Foto da etiqueta é obrigatória");
                                        return;
                                    }

                                    const capturedPhotos = {
                                        photo_model: labelPhoto, // Salvamos a foto da etiqueta no campo photo_model do banco
                                    };

                                    const result = await registerProduct(ocrForm, capturedPhotos);
                                    if (result) {
                                        setShowOcrModal(false);
                                    }
                                }}
                                className="flex-1 px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20"
                            >
                                <CheckCircle className="h-4 w-4" />
                                Confirmar e Cadastrar no Banco
                            </button>
                        </div>
                    </div>
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
