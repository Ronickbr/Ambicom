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
    Printer,
    Camera,
    History as HistoryIcon,
    ChevronRight,
    Trash2
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNavigate } from "react-router-dom";
import { Product, ChecklistItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

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
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedProduct, setSelectedProduct] = useState<ProductWithLogs | null>(null);
    const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
    const [checklistSchema, setChecklistSchema] = useState<ChecklistItem[]>([]);

    const isAuthorized = profile?.role === "SUPERVISOR" || profile?.role === "GESTOR" || profile?.role === "ADMIN";

    useEffect(() => {
        if (!authLoading && !isAuthorized) {
            toast.error("Acesso exclusivo para supervisores");
            navigate("/");
            return;
        }
        if (isAuthorized) {
            fetchPendingApprovals();
            fetchChecklistSchema();
        }
    }, [authLoading, isAuthorized, navigate]);

    const fetchChecklistSchema = async () => {
        try {
            // Primeiro busca as categorias ativas
            const { data: settingsData } = await supabase
                .from("system_settings")
                .select("value")
                .eq("key", "checklist_categories")
                .single();

            let activeCategories: string[] = [];
            if (settingsData?.value) {
                activeCategories = typeof settingsData.value === 'string'
                    ? JSON.parse(settingsData.value)
                    : settingsData.value;
            }

            const { data, error } = await supabase
                .from("checklist_items")
                .select("*")
                .eq("is_active", true)
                .order("category", { ascending: true });

            if (error) throw error;

            // Filtra os itens apenas para as categorias ativas
            const validItems = (data || []).filter(item =>
                activeCategories.length === 0 || activeCategories.includes(item.category)
            );

            setChecklistSchema(validItems);
        } catch (error) {
            logger.error("Erro ao buscar esquema do checklist:", error);
        }
    };

    const fetchPendingApprovals = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from("products")
                .select(`
                    *,
                    product_logs (
                        data,
                        created_at
                    )
                `)
                .eq("status", "EM AVALIAÇÃO")
                .order("updated_at", { ascending: false })
                .order("created_at", { foreignTable: "product_logs", ascending: false })
                .limit(50); // Limite adicionado para melhorar a performance

            if (error) throw error;
            setProducts((data as any[]) || []);
        } catch (error) {
            logger.error("Erro ao buscar aprovações:", error);
            toast.error("Erro ao carregar fila de aprovação");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAction = async (productId: string, action: "APPROVE" | "REJECT") => {
        setIsProcessing(productId);
        const newStatus = action === "APPROVE" ? "EM ESTOQUE" : "REPROVADO";

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

            if (action === "APPROVE") {
                toast.success("Produto Aprovado!", {
                    description: "Item liberado para o estoque. Deseja imprimir a etiqueta?",
                    action: {
                        label: "Imprimir",
                        onClick: () => {
                            const product = products.find(p => p.id === productId);
                            if (product) handlePrintLabel(product);
                        }
                    }
                });
            } else {
                toast.error("Produto Reprovado", {
                    description: "Enviado ao estoque com status de reprovação."
                });
            }

            setProducts(prev => prev.filter(p => p.id !== productId));
            if (selectedProduct?.id === productId) setSelectedProduct(null);
        } catch (error) {
            const err = error as Error;
            toast.error("Erro ao processar ação", { description: err.message });
        } finally {
            setIsProcessing(null);
        }
    };

    const handlePrintLabel = async (product: Product) => {
        const { printLabels } = await import("@/lib/export-utils");
        await printLabels([product]);
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
                        <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-foreground uppercase italic">Central de <span className="text-primary not-italic font-light">Revisão</span></h1>
                        <p className="text-muted-foreground font-medium text-[10px] sm:text-sm mt-1 opacity-70 italic px-1">Validação de qualidade, triagem técnica e liberação de ativos.</p>
                    </div>
                    <div className="glass-card flex items-center gap-4 py-3 px-6 sm:py-4 sm:px-8 border-border/10 bg-card/50 shadow-inner w-full md:w-auto">
                        <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 shadow-sm shrink-0"><Clock className="h-5 w-5" /></div>
                        <div>
                            <div className="text-[9px] uppercase font-black text-muted-foreground tracking-widest leading-none mb-1">Fila Atual</div>
                            <div className="text-base sm:text-lg font-black text-foreground italic tracking-widest">{products.length} <span className="text-[10px] not-italic font-medium opacity-50">itens pendentes</span></div>
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
                            className="w-full rounded-2xl border border-border/20 bg-card/50 py-3 sm:py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all text-foreground shadow-inner backdrop-blur-sm placeholder:text-muted-foreground/30 font-medium"
                        />
                    </div>

                </div>

                {filteredProducts.length > 0 ? (
                    <div className="space-y-4">
                        {/* Mobile Compact View */}
                        <div className="md:hidden space-y-3 px-2">
                            {filteredProducts.map((product) => {
                                const lastLogWithChecklist = product.product_logs?.find(l => l.data?.checklist);
                                const checklist = lastLogWithChecklist?.data?.checklist || {};
                                const activeItemIds = checklistSchema.map(i => i.id);
                                const itemsCount = activeItemIds.length || 0;
                                const checkedCount = activeItemIds.filter(id => checklist[id] === true).length || 0;
                                const isExpanded = expandedId === product.id;

                                return (
                                    <div
                                        key={product.id}
                                        className={cn(
                                            "bg-card/40 border border-border/10 rounded-2xl overflow-hidden transition-all duration-300",
                                            isExpanded ? "ring-1 ring-primary/30 bg-card/60 shadow-lg" : "hover:bg-card/50"
                                        )}
                                    >
                                        {/* Main Row */}
                                        <div
                                            onClick={() => setExpandedId(isExpanded ? null : product.id)}
                                            className="p-4 flex items-center justify-between cursor-pointer active:bg-foreground/5"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="h-9 w-9 rounded-xl bg-foreground/5 flex items-center justify-center text-muted-foreground shrink-0 border border-border/10">
                                                    <Package className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="text-[10px] font-mono font-black text-primary/70 block leading-none mb-1">
                                                        {product.internal_serial}
                                                    </span>
                                                    <h4 className="font-black text-foreground text-sm uppercase italic truncate">
                                                        {product.model}
                                                    </h4>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <div className="flex flex-col items-end mr-1">
                                                    <span className="text-[8px] font-black text-muted-foreground uppercase opacity-50">Status OK</span>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-[10px] font-black text-foreground/70">{checkedCount}/{itemsCount}</span>
                                                        <div className={cn("h-2 w-2 rounded-full", checkedCount === itemsCount ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]")} />
                                                    </div>
                                                </div>
                                                <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300", isExpanded && "rotate-90")} />
                                            </div>
                                        </div>

                                        {/* Expanded Content */}
                                        {isExpanded && (
                                            <div className="px-4 pb-4 pt-2 border-t border-border/5 bg-foreground/5 animate-in slide-in-from-top-2 duration-300">
                                                <div className="grid grid-cols-2 gap-4 mb-4">
                                                    <div className="space-y-1">
                                                        <p className="text-[8px] font-black text-muted-foreground uppercase opacity-50">Marca / Fabricante</p>
                                                        <p className="text-[10px] font-black text-foreground uppercase tracking-widest leading-none">{product.brand}</p>
                                                    </div>
                                                    <div className="space-y-1 text-right">
                                                        <p className="text-[8px] font-black text-muted-foreground uppercase opacity-50">Última Atualização</p>
                                                        <p className="text-[10px] font-bold text-foreground">
                                                            {new Date(product.updated_at).toLocaleDateString("pt-BR")}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleAction(product.id, "APPROVE")}
                                                            disabled={!!isProcessing}
                                                            className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-[10px] font-black uppercase tracking-widest shadow-lg relative overflow-hidden"
                                                        >
                                                            {isProcessing === product.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                                                            Aprovar
                                                        </button>
                                                        <button
                                                            onClick={() => handleAction(product.id, "REJECT")}
                                                            disabled={!!isProcessing}
                                                            className="h-12 w-12 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
                                                        >
                                                            <XCircle className="h-5 w-5" />
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={() => setSelectedProduct(product)}
                                                        className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-foreground/5 text-muted-foreground hover:bg-foreground/10 transition-all text-[9px] font-black uppercase tracking-widest border border-border/10"
                                                    >
                                                        <FileSearch className="h-4 w-4" />
                                                        Ver Detalhes Técnicos
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block relative group/table" data-scroll="right">
                            {/* Horizontal Scroll Indicators */}
                            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-20 pointer-events-none opacity-0 group-has-[[data-scroll='left']]:opacity-100 group-has-[[data-scroll='both']]:opacity-100 transition-opacity" />
                            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background via-card/80 to-transparent z-20 pointer-events-none opacity-0 group-has-[[data-scroll='right']]:opacity-100 group-has-[[data-scroll='both']]:opacity-100 transition-opacity" />

                            <div
                                className="overflow-x-auto scrollbar-hide glass-card border-border/10 bg-card/30 shadow-2xl rounded-2xl"
                                onScroll={(e) => {
                                    const target = e.currentTarget;
                                    const group = target.parentElement;
                                    if (group) {
                                        const scrollLeft = target.scrollLeft;
                                        const maxScroll = target.scrollWidth - target.clientWidth;
                                        let status = 'none';
                                        if (maxScroll > 0) {
                                            if (scrollLeft <= 10) status = 'right';
                                            else if (scrollLeft >= maxScroll - 10) status = 'left';
                                            else status = 'both';
                                        }
                                        group.setAttribute('data-scroll', status);
                                    }
                                }}
                            >
                                <table className="w-full text-left border-collapse min-w-[900px] sm:min-w-full">
                                    <thead className="bg-foreground/5 text-muted-foreground uppercase text-[9px] sm:text-[10px] font-black tracking-widest border-b border-border/10 sticky top-0 z-30 backdrop-blur-md">
                                        <tr>
                                            <th className="px-4 sm:px-6 py-5 whitespace-nowrap sticky left-0 bg-card/95 z-40 border-r border-border/10 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">Serial / Identificação</th>
                                            <th className="px-4 sm:px-6 py-5 whitespace-nowrap">Produto / Modelo</th>
                                            <th className="px-4 sm:px-6 py-5 whitespace-nowrap">Marca / Fabricante</th>
                                            <th className="px-4 sm:px-6 py-5 whitespace-nowrap">Status Técnico</th>
                                            <th className="px-4 sm:px-6 py-5 text-right whitespace-nowrap pr-6 sm:pr-10">Ações de Aprovação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/20">
                                        {filteredProducts.map((product) => {
                                            const lastLogWithChecklist = product.product_logs?.find(l => l.data?.checklist);
                                            const checklist = lastLogWithChecklist?.data?.checklist || {};
                                            const activeItemIds = checklistSchema.map(i => i.id);
                                            const itemsCount = activeItemIds.length || 0;
                                            const checkedCount = activeItemIds.filter(id => checklist[id] === true).length || 0;

                                            return (
                                                <tr
                                                    key={product.id}
                                                    onClick={() => setSelectedProduct(product)}
                                                    className="group hover:bg-foreground/5 transition-colors cursor-pointer"
                                                >
                                                    <td className="px-4 sm:px-6 py-6 whitespace-nowrap sticky left-0 bg-card/95 group-hover:bg-card/95 transition-colors z-30 border-r border-border/10 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">
                                                        <span className="font-mono text-[10px] sm:text-[11px] bg-foreground/5 px-2.5 py-1.5 rounded-xl text-primary border border-primary/10 group-hover:bg-primary group-hover:text-primary-foreground transition-all uppercase tracking-widest font-black">
                                                            {product.internal_serial}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 sm:px-6 py-6 whitespace-nowrap">
                                                        <span className="font-black text-[13px] sm:text-base text-foreground uppercase italic tracking-tight group-hover:text-primary transition-colors">
                                                            {product.model}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 sm:px-6 py-6 whitespace-nowrap">
                                                        <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em] group-hover:text-foreground">
                                                            {product.brand}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 sm:px-6 py-6 whitespace-nowrap">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex flex-col min-w-[80px] sm:min-w-[100px]">
                                                                <span className="text-[8px] sm:text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1.5">
                                                                    {checkedCount}/{itemsCount} OK
                                                                </span>
                                                                <div className="h-1 sm:h-1.5 w-full bg-card/40 rounded-full overflow-hidden p-[1px] border border-border/10">
                                                                    <div
                                                                        className={cn(
                                                                            "h-full rounded-full transition-all duration-1000",
                                                                            checkedCount === itemsCount ? "bg-emerald-500" : "bg-amber-500"
                                                                        )}
                                                                        style={{ width: itemsCount > 0 ? `${(checkedCount / itemsCount) * 100}%` : '0%' }}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <CheckCircle2 className={cn("h-4 w-4 sm:h-5 sm:w-5 shrink-0", checkedCount === itemsCount ? "text-emerald-500" : "text-amber-500")} />
                                                        </div>
                                                    </td>
                                                    <td className="px-4 sm:px-6 py-6 text-right whitespace-nowrap pr-6 sm:pr-10">
                                                        <div className="flex items-center justify-end gap-1.5 sm:gap-2" onClick={e => e.stopPropagation()}>
                                                            <button
                                                                onClick={() => handleAction(product.id, "APPROVE")}
                                                                disabled={!!isProcessing}
                                                                className="h-9 sm:h-11 px-4 sm:px-6 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg sm:rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 sm:gap-2 active:scale-95 shadow-lg group/btn overflow-hidden relative min-w-[100px] sm:min-w-[120px]"
                                                            >
                                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000" />
                                                                {isProcessing === product.id ? <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : <ShieldCheck className="h-3 w-3 sm:h-4 sm:w-4" />}
                                                                Aprovar
                                                            </button>
                                                            <button
                                                                onClick={() => handleAction(product.id, "REJECT")}
                                                                disabled={!!isProcessing}
                                                                className="h-9 w-9 sm:h-11 sm:w-11 rounded-lg sm:rounded-xl bg-red-500/10 text-red-500 border border-red-500/10 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center active:scale-95 group/reject"
                                                                title="Reprovar"
                                                            >
                                                                <XCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="glass-card flex flex-col items-center justify-center py-32 text-center border-dashed border border-border/10 bg-card/20">
                        <div className="h-24 w-24 rounded-full bg-foreground/5 flex items-center justify-center mb-8 relative">
                            <FileSearch className="h-10 w-10 text-muted-foreground/20" />
                            <div className="absolute inset-0 rounded-full border-2 border-primary/10 border-t-primary animate-spin" style={{ animationDuration: '8s' }} />
                        </div>
                        <h3 className="text-3xl font-black text-foreground mb-3 uppercase tracking-tighter">Fila de Revisão Limpa</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto text-sm leading-relaxed italic opacity-70">
                            Não existem novas inspeções técnicas pendentes.
                        </p>
                    </div>
                )}
            </div>

            {/* Detailed Product Modal */}
            {selectedProduct && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="absolute inset-0" onClick={() => setSelectedProduct(null)} />
                    <div className="glass-card w-full max-w-5xl bg-card border border-border/20 max-h-[95vh] flex flex-col relative z-10 animate-in zoom-in-95 duration-300 shadow-2xl rounded-2xl overflow-hidden">

                        {/* Header Fixo */}
                        <div className="shrink-0 bg-card/95 backdrop-blur-md border-b border-border/10 p-6 sm:p-8 flex justify-between items-start gap-4 sm:gap-6 z-20">
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                        <Package className="h-4 w-4" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Detalhamento Técnico</span>
                                </div>
                                <h2 className="text-2xl sm:text-4xl font-black text-foreground uppercase italic tracking-tighter">
                                    {selectedProduct.model}
                                </h2>
                                <p className="text-muted-foreground text-xs uppercase font-black tracking-widest">
                                    {selectedProduct.brand} • <span className="text-foreground/60 font-mono">{selectedProduct.internal_serial}</span>
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedProduct(null)}
                                className="h-10 w-10 rounded-full border border-border/20 flex items-center justify-center text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-all"
                            >
                                <XCircle className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Conteúdo Rolável */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-10 space-y-6 sm:space-y-8 scrollbar-thin">
                            {/* Photos Section */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <Camera className="h-4 w-4 text-primary" />
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Evidência Visual do Ativo</h3>
                                </div>
                                <div className="flex justify-center">
                                    {(() => {
                                        const photo = selectedProduct.photo_product || selectedProduct.photo_model || selectedProduct.photo_serial || selectedProduct.photo_defect;
                                        const label = selectedProduct.photo_product ? "VISTA GERAL" :
                                            selectedProduct.photo_model ? "ETIQUETA MODELO" :
                                                selectedProduct.photo_serial ? "ETIQUETA SERIAL" :
                                                    selectedProduct.photo_defect ? "EVIDÊNCIA DEFEITO" : "FOTO";

                                        return (
                                            <div
                                                className="group relative w-full max-w-md aspect-[3/4] rounded-3xl bg-card/40 border border-border/20 overflow-hidden cursor-zoom-in active:scale-95 transition-all shadow-2xl"
                                                onClick={() => photo && setFullImageUrl(photo)}
                                            >
                                                {photo ? (
                                                    <>
                                                        <img
                                                            src={photo}
                                                            alt="Produto"
                                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8">
                                                            <span className="text-xs font-black text-primary uppercase tracking-[0.3em] mb-2">{label}</span>
                                                            <p className="text-[10px] text-foreground/60 font-medium italic">Clique para zoom de alta definição</p>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center gap-4 opacity-20">
                                                        <Camera className="h-12 w-12 text-muted-foreground" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">Nenhuma Imagem Registrada</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Reports & Data */}
                            <div className="grid lg:grid-cols-3 gap-8 sm:gap-12">
                                <div className="space-y-6">
                                    {(() => {
                                        const lastLog = selectedProduct.product_logs?.find(l => l.data?.checklist);
                                        const checklist = lastLog?.data?.checklist || {};
                                        const labels = lastLog?.data?.checklist_labels || {};

                                        if (Object.keys(checklist).length === 0) {
                                            return <p className="text-sm italic text-muted-foreground/40">Nenhum dado de checklist disponível.</p>;
                                        }

                                        // Filtra os itens do log que ainda existem no esquema atual
                                        const filteredItems = checklistSchema.filter(item => checklist.hasOwnProperty(item.id));

                                        // Agrupa por categoria
                                        const groupedItems = filteredItems.reduce((acc, item) => {
                                            if (!acc[item.category]) acc[item.category] = [];
                                            acc[item.category].push(item);
                                            return acc;
                                        }, {} as Record<string, ChecklistItem[]>);

                                        const categories = Object.keys(groupedItems).sort();

                                        if (categories.length === 0) {
                                            return <p className="text-sm italic text-muted-foreground/40">Os itens deste checklist não coincidem com o protocolo atual.</p>;
                                        }

                                        return categories.map(category => (
                                            <div key={category} className="space-y-3">
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/60 border-b border-primary/10 pb-2 mb-4 italic">{category}</h4>
                                                <div className="grid gap-2">
                                                    {groupedItems[category].map((item) => {
                                                        const ok = checklist[item.id];
                                                        return (
                                                            <div key={item.id} className={cn(
                                                                "flex items-center justify-between p-4 rounded-xl border transition-all",
                                                                ok ? "bg-emerald-500/5 text-emerald-600 dark:text-emerald-500 border-emerald-500/10" : "bg-red-500/5 text-red-600 dark:text-red-500 border-red-500/10"
                                                            )}>
                                                                <span className="text-xs font-bold uppercase italic tracking-tight">{item.label}</span>
                                                                <div className={cn(
                                                                    "h-6 w-12 rounded-full flex items-center justify-center text-[8px] font-black uppercase tracking-widest border",
                                                                    ok
                                                                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-500 border-emerald-500/20"
                                                                        : "bg-red-500/20 text-red-600 dark:text-red-500 border-red-500/20"
                                                                )}>
                                                                    {ok ? "OK" : "FALHA"}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ));
                                    })()}
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
                                            <div key={idx} className="flex justify-between items-center py-2 px-4 border-b border-border/10 last:border-0 hover:bg-foreground/5 transition-colors">
                                                <span className="text-[10px] font-black uppercase text-muted-foreground/60">{item.label}</span>
                                                <span className="text-xs font-bold text-foreground">{item.value}</span>
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
                                        <div className="p-6 rounded-2xl bg-foreground/5 border border-border/10 text-sm text-foreground/80 leading-relaxed italic min-h-[160px]">
                                            {selectedProduct.product_logs?.find(l => l.data?.observations)?.data?.observations || "Nenhuma observação técnica registrada."}
                                        </div>
                                    </div>

                                    <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                                        <div>
                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Finalizado em</p>
                                            <p className="text-sm font-black text-foreground italic">
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
                            <div className="shrink-0 bg-card/95 backdrop-blur-md border-t border-border/10 p-6 sm:p-8 flex flex-col sm:flex-row gap-4 z-20">
                                <button
                                    onClick={() => handleAction(selectedProduct.id, "REJECT")}
                                    disabled={!!isProcessing}
                                    className="flex-1 h-14 rounded-2xl bg-foreground/5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 font-black uppercase tracking-widest text-[10px] transition-all border border-border/20 hover:border-red-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                                >
                                    {isProcessing === selectedProduct.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <XCircle className="h-5 w-5" />}
                                    Recusar Revisão
                                </button>
                                <button
                                    onClick={() => handleAction(selectedProduct.id, "APPROVE")}
                                    disabled={!!isProcessing}
                                    className="flex-1 h-14 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-primary/20 border-t border-border/40 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                                >
                                    {isProcessing === selectedProduct.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                                    Aprovar & Disponibilizar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Full Image Zoom Modal */}
            {fullImageUrl && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <button
                        onClick={() => setFullImageUrl(null)}
                        className="absolute top-6 right-6 h-12 w-12 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all z-10 shadow-lg"
                    >
                        <XCircle className="h-6 w-6" />
                    </button>
                    <img
                        src={fullImageUrl}
                        alt="Visualização ampliada"
                        className="max-w-full max-h-[90vh] aspect-[9/16] object-cover rounded-xl shadow-2xl animate-in zoom-in-95 duration-300"
                    />
                </div>
            )}
        </MainLayout>
    );
}
