import React, { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import {
    XCircle,
    AlertCircle,
    CheckCircle2,
    Package,
    ArrowRight,
    Search,
    Filter,
    ClipboardCheck,
    Truck,
    Clock,
    Loader2,
    ShieldCheck,
    FileSearch,
    History as HistoryIcon
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNavigate } from "react-router-dom";
import { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProductWithLogs extends Product {
    product_logs: {
        data: {
            checklist?: Record<string, boolean>;
            checklist_labels?: Record<string, string>;
            observations?: string;
            technician_timestamp?: string;
        };
        created_at: string;
    }[];
}

export default function ApprovalsPage() {
    const { profile, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [products, setProducts] = useState<ProductWithLogs[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedProduct, setSelectedProduct] = useState<ProductWithLogs | null>(null);

    const isAuthorized = profile?.role === "SUPERVISOR" || profile?.role === "GESTOR" || profile?.role === "ADMIN";

    useEffect(() => {
        if (!authLoading && !isAuthorized) {
            toast.error("Acesso exclusivo para supervisores");
            navigate("/");
            return;
        }
        if (isAuthorized) {
            fetchPendingApprovals();
        }
    }, [authLoading, isAuthorized, navigate]);

    const fetchPendingApprovals = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from("products")
                .select(`
    *,
    product_logs(
        data,
        created_at
    )
        `)
                .eq("status", "EM AVALIAÇÃO")
                .order("updated_at", { ascending: false });

            if (error) throw error;
            setProducts((data as any[]) || []);
        } catch (error) {
            console.error("Erro ao buscar aprovações:", error);
            toast.error("Erro ao carregar fila de aprovação");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAction = async (productId: string, action: "APPROVE" | "REJECT") => {
        setIsProcessing(productId);
        const newStatus = action === "APPROVE" ? "EM ESTOQUE" : "CADASTRO";

        try {
            const { error: updateError } = await supabase
                .from("products")
                .update({ status: newStatus })
                .eq("id", productId);

            if (updateError) throw updateError;

            const { error: logError } = await supabase
                .from("product_logs")
                .insert({
                    product_id: productId,
                    old_status: "EM AVALIAÇÃO",
                    new_status: newStatus,
                    actor_id: profile?.id,
                    data: {
                        action: action,
                        reviewer_role: profile?.role,
                        timestamp: new Date().toISOString()
                    }
                });

            if (logError) throw logError;

            toast.success(action === "APPROVE" ? "Produto Aprovado!" : "Produto Rejeitado", {
                description: action === "APPROVE" ? "Item liberado para o estoque." : "Retornado para o cadastro."
            });

            setProducts(prev => prev.filter(p => p.id !== productId));
            if (selectedProduct?.id === productId) setSelectedProduct(null);
        } catch (error) {
            const err = error as Error;
            toast.error("Erro ao processar ação", { description: err.message });
        } finally {
            setIsProcessing(null);
        }
    };

    const filteredProducts = products.filter(p =>
        (p.internal_serial || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.model || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.brand || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (authLoading) return null;

    if (!isAuthorized) return null;

    if (isLoading) {
        return (
            <MainLayout>
                <div className="max-w-7xl mx-auto flex h-[80vh] flex-col items-center justify-center space-y-6">
                    <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse" />
                        <Loader2 className="h-16 w-16 animate-spin text-primary relative z-10 opacity-40" />
                    </div>
                    <div className="text-center space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Acessando Central de Revisão</p>
                        <p className="text-[8px] text-muted-foreground/40 uppercase tracking-widest">Validando protocolos de segurança industrial</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="max-w-7xl mx-auto space-y-10 pb-12">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                <ShieldCheck className="h-4 w-4" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Conformidade & QA</span>
                        </div>
                        <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-white uppercase italic">Central de <span className="text-primary not-italic font-light">Revisão</span></h1>
                        <p className="text-muted-foreground font-medium text-[10px] sm:text-sm mt-1 opacity-70 italic px-1">Validação de qualidade, triagem técnica e liberação de ativos.</p>
                    </div>
                    <div className="glass-card flex items-center gap-4 py-3 px-6 sm:py-4 sm:px-8 border-white/5 bg-neutral-900/50 shadow-inner w-full md:w-auto">
                        <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 shadow-sm shrink-0"><Clock className="h-5 w-5" /></div>
                        <div>
                            <div className="text-[9px] uppercase font-black text-muted-foreground tracking-widest leading-none mb-1">Fila Atual</div>
                            <div className="text-base sm:text-lg font-black text-white italic tracking-widest">{products.length} <span className="text-[10px] not-italic font-medium opacity-50">itens pendentes</span></div>
                        </div>
                    </div>
                </div>

                {/* Search Interface */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 py-2 px-1 sm:px-0">
                    <div className="relative flex-1 group w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar por Modelo, Serial ou Marca..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-2xl border border-white/10 bg-neutral-900/50 py-3 sm:py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all text-white shadow-inner backdrop-blur-sm placeholder:text-muted-foreground/30 font-medium"
                        />
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button className="flex-1 sm:flex-none px-4 sm:px-8 h-12 sm:h-14 bg-neutral-900/50 rounded-2xl border border-white/10 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-white flex items-center justify-center gap-2 sm:gap-3 hover:bg-white/5 transition-all shadow-inner whitespace-nowrap">
                            <Filter className="h-4 w-4 text-primary" />
                            Marca
                        </button>
                        <button
                            onClick={() => toast.info("Histórico em desenvolvimento")}
                            className="flex-1 sm:flex-none px-4 sm:px-8 h-12 sm:h-14 bg-neutral-900/50 rounded-2xl border border-white/10 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-white flex items-center justify-center gap-2 sm:gap-3 hover:bg-white/5 transition-all shadow-inner whitespace-nowrap"
                        >
                            <HistoryIcon className="h-3.5 w-3.5 text-primary" />
                            Histórico
                        </button>
                    </div>
                </div>

                {filteredProducts.length > 0 ? (
                    <div className="grid gap-4 sm:gap-8 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                        {filteredProducts.map((product) => {
                            const lastLogWithChecklist = product.product_logs?.find(l => l.data?.checklist);
                            const checklist = lastLogWithChecklist?.data?.checklist || {};
                            const itemsCount = Object.keys(checklist).length || 0;
                            const checkedCount = Object.values(checklist).filter(v => v === true).length || 0;

                            return (
                                <div
                                    key={product.id}
                                    onClick={() => setSelectedProduct(product)}
                                    className="glass-card group hover:border-primary/50 transition-all duration-500 overflow-hidden flex flex-col border-white/5 bg-neutral-900/30 cursor-pointer relative"
                                >
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                    <div className="p-5 sm:p-8 space-y-6 flex-1">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 group-hover:bg-primary group-hover:text-white transition-all shadow-inner border border-primary/20 shrink-0">
                                                <Package className="h-6 w-6 sm:h-7 sm:w-7" />
                                            </div>
                                            <span className="font-mono text-[10px] bg-white/5 px-3 py-1.5 rounded-xl text-muted-foreground border border-white/5 shadow-sm group-hover:text-primary transition-colors truncate max-w-[120px]">
                                                {product.internal_serial}
                                            </span>
                                        </div>

                                        <div className="space-y-1">
                                            <h3 className="font-black text-lg sm:text-xl text-white group-hover:text-primary transition-colors uppercase italic tracking-tight line-clamp-2">{product.model}</h3>
                                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em]">{product.brand}</p>
                                        </div>

                                        <div className="space-y-3 pt-4 border-t border-white/5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Status Técnico</span>
                                                    <span className="text-xs font-bold text-white/80 italic">{checkedCount} de {itemsCount} OK</span>
                                                </div>
                                                <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                                                    <CheckCircle2 className={cn("h-5 w-5", checkedCount === itemsCount ? "text-emerald-500" : "text-amber-500")} />
                                                </div>
                                            </div>
                                            <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/5">
                                                <div
                                                    className={cn(
                                                        "h-full rounded-full transition-all duration-1000",
                                                        checkedCount === itemsCount ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" : "bg-gradient-to-r from-amber-600 to-amber-400"
                                                    )}
                                                    style={{ width: itemsCount > 0 ? `${(checkedCount / itemsCount) * 100}% ` : '0%' }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-6 bg-white/5 border-t border-white/5 grid grid-cols-5 gap-3" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => handleAction(product.id, "APPROVE")}
                                            disabled={!!isProcessing}
                                            className="col-span-4 h-14 bg-white text-black hover:bg-primary hover:text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 active:scale-95 shadow-lg group/btn overflow-hidden relative"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000" />
                                            {isProcessing === product.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                                            Aprovar
                                        </button>
                                        <button
                                            onClick={() => handleAction(product.id, "REJECT")}
                                            disabled={!!isProcessing}
                                            className="col-span-1 h-14 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center active:scale-95 group/reject"
                                            title="Rejeitar"
                                        >
                                            <XCircle className="h-6 w-6" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="glass-card flex flex-col items-center justify-center py-32 text-center border-dashed border border-white/5 bg-neutral-900/20">
                        <div className="h-24 w-24 rounded-full bg-white/5 flex items-center justify-center mb-8 relative">
                            <FileSearch className="h-10 w-10 text-muted-foreground/20" />
                            <div className="absolute inset-0 rounded-full border-2 border-primary/10 border-t-primary animate-spin" style={{ animationDuration: '8s' }} />
                        </div>
                        <h3 className="text-3xl font-black text-white mb-3 uppercase tracking-tighter">Fila de Revisão Limpa</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto text-sm leading-relaxed italic opacity-70">
                            Não existem novas inspeções técnicas pendentes.
                        </p>
                    </div>
                )}
            </div>

            {/* Detailed Product Modal */}
            {selectedProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedProduct(null)} />
                    <div className="glass-card w-full max-w-5xl bg-[#0a0a0a] border border-white/10 max-h-[95vh] overflow-y-auto relative z-10 animate-in zoom-in-95 duration-200">
                        <div className="p-4 sm:p-10 space-y-6 sm:space-y-8">
                            {/* Modal Header */}
                            <div className="flex justify-between items-start gap-4 sm:gap-6 border-b border-white/5 pb-6 sm:pb-8">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                            <Package className="h-4 w-4" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Detalhamento Técnico</span>
                                    </div>
                                    <h2 className="text-2xl sm:text-4xl font-black text-white uppercase italic tracking-tighter">
                                        {selectedProduct.model}
                                    </h2>
                                    <p className="text-muted-foreground text-xs uppercase font-black tracking-widest">
                                        {selectedProduct.brand} • <span className="text-white/60 font-mono">{selectedProduct.internal_serial}</span>
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedProduct(null)}
                                    className="h-10 w-10 rounded-full border border-white/10 flex items-center justify-center text-muted-foreground hover:bg-white/5 hover:text-white transition-all"
                                >
                                    <XCircle className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Photos Section */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <Package className="h-4 w-4 text-primary" />
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Evidências Visuais (Mandatório)</h3>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <p className="text-[8px] font-black text-muted-foreground uppercase text-center">Ambiente / Produto</p>
                                        <div className="aspect-video rounded-2xl bg-white/5 border border-white/10 overflow-hidden relative group">
                                            {selectedProduct.photo_product ? (
                                                <img src={selectedProduct.photo_product} alt="Produto" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full opacity-20">
                                                    <Package className="h-8 w-8 mb-2" />
                                                    <span className="text-[10px] font-black uppercase">Sem Foto</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-[8px] font-black text-muted-foreground uppercase text-center">Etiqueta de Modelo</p>
                                        <div className="aspect-video rounded-2xl bg-white/5 border border-white/10 overflow-hidden relative group">
                                            {selectedProduct.photo_model ? (
                                                <img src={selectedProduct.photo_model} alt="Modelo" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full opacity-20">
                                                    <Package className="h-8 w-8 mb-2" />
                                                    <span className="text-[10px] font-black uppercase">Sem Foto</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-[8px] font-black text-muted-foreground uppercase text-center">Número de Série</p>
                                        <div className="aspect-video rounded-2xl bg-white/5 border border-white/10 overflow-hidden relative group">
                                            {selectedProduct.photo_serial ? (
                                                <img src={selectedProduct.photo_serial} alt="Série" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full opacity-20">
                                                    <Package className="h-8 w-8 mb-2" />
                                                    <span className="text-[10px] font-black uppercase">Sem Foto</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-[8px] font-black text-muted-foreground uppercase text-center">Detalhamento Avaria</p>
                                        <div className="aspect-video rounded-2xl bg-white/5 border border-white/10 overflow-hidden relative group">
                                            {selectedProduct.photo_defect ? (
                                                <img src={selectedProduct.photo_defect} alt="Avaria" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full opacity-20">
                                                    <AlertCircle className="h-8 w-8 mb-2" />
                                                    <span className="text-[10px] font-black uppercase">Sem Foto</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Reports & Data */}
                            <div className="grid lg:grid-cols-3 gap-8 sm:gap-12">
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="h-4 w-4 text-primary" />
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Checklist Técnico</h3>
                                    </div>
                                    <div className="space-y-3">
                                        {(() => {
                                            const lastLog = selectedProduct.product_logs?.find(l => l.data?.checklist);
                                            const checklist = lastLog?.data?.checklist || {};
                                            const labels = lastLog?.data?.checklist_labels || {};

                                            if (Object.keys(checklist).length === 0) {
                                                return <p className="text-sm italic text-muted-foreground/40">Nenhum dado de checklist disponível.</p>;
                                            }

                                            return Object.entries(checklist).map(([id, ok]) => (
                                                <div key={id} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
                                                    <span className="text-sm font-bold text-white/80 uppercase italic tracking-tight">{labels[id] || id}</span>
                                                    <div className={cn(
                                                        "h-6 w-12 rounded-full flex items-center justify-center text-[8px] font-black uppercase tracking-widest border",
                                                        ok
                                                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                                            : "bg-red-500/10 text-red-500 border-red-500/20"
                                                    )}>
                                                        {ok ? "OK" : "FALHA"}
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    <div className="flex items-center gap-3">
                                        <ShieldCheck className="h-4 w-4 text-primary" />
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Dados Técnicos</h3>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1">
                                        {[
                                            { label: "Voltagem", value: selectedProduct.voltage },
                                            { label: "Gás Refrigerante", value: selectedProduct.refrigerant_gas },
                                            { label: "Carga de Gás", value: selectedProduct.gas_charge },
                                            { label: "Compressor", value: selectedProduct.compressor },
                                            { label: "Frequência", value: selectedProduct.frequency },
                                            { label: "Cor", value: selectedProduct.color },
                                            { label: "PNC/ML", value: selectedProduct.pnc_ml },
                                            { label: "Fabricação", value: selectedProduct.manufacturing_date },
                                        ].filter(item => item.value).map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center py-2 px-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                                                <span className="text-[10px] font-black uppercase text-muted-foreground/60">{item.label}</span>
                                                <span className="text-xs font-bold text-white">{item.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <Search className="h-4 w-4 text-primary" />
                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Observações</h3>
                                        </div>
                                        <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 text-sm text-white/80 leading-relaxed italic min-h-[160px]">
                                            {selectedProduct.product_logs?.find(l => l.data?.observations)?.data?.observations || "Nenhuma observação técnica registrada."}
                                        </div>
                                    </div>

                                    <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                                        <div>
                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Finalizado em</p>
                                            <p className="text-sm font-black text-white italic">
                                                {(() => {
                                                    const dateStr = selectedProduct.product_logs?.find(l => l.data?.technician_timestamp)?.data?.technician_timestamp;
                                                    return dateStr ? new Date(dateStr).toLocaleString("pt-BR") : "Data não registrada";
                                                })()}
                                            </p>
                                        </div>
                                        <HistoryIcon className="h-6 w-6 text-primary/40" />
                                    </div>
                                </div>
                            </div>

                            {/* Modal Actions */}
                            <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row gap-4">
                                <button
                                    onClick={() => handleAction(selectedProduct.id, "APPROVE")}
                                    disabled={!!isProcessing}
                                    className="flex-1 h-16 bg-white text-black hover:bg-primary hover:text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-4 active:scale-95 shadow-xl relative overflow-hidden group/btn"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000" />
                                    {isProcessing === selectedProduct.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                                    Aprovar e Liberar Ativo
                                </button>
                                <button
                                    onClick={() => handleAction(selectedProduct.id, "REJECT")}
                                    disabled={!!isProcessing}
                                    className="px-10 h-16 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-4 font-black text-xs uppercase tracking-[0.2em] active:scale-95"
                                >
                                    <XCircle className="h-6 w-6" />
                                    Rejeitar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
