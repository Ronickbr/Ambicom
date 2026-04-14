import React, { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import {
    TrendingUp,
    Package,
    AlertCircle,
    Calendar,
    Loader2,
    ShieldCheck,
    FileDown,
    Users,
    Activity,
    Download,
    Clock,
    Box,
    CheckCircle2,
    XCircle,
    ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNavigate } from "react-router-dom";

interface LogWithRelations {
    id: string;
    created_at: string;
    new_status: string;
    products: {
        model: string | null;
        internal_serial: string | null;
    } | {
        model: string | null;
        internal_serial: string | null;
    }[] | null;
    profiles: {
        full_name: string | null;
    } | {
        full_name: string | null;
    }[] | null;
}

export default function ManagerDashboard() {
    const { profile, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState({
        total: 0,
        cadastro: 0,
        avaliacao: 0,
        estoque: 0,
        vendidos: 0
    });
    const [recentLogs, setRecentLogs] = useState<LogWithRelations[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const isAuthorized = profile?.role === "GESTOR" || profile?.role === "ADMIN";

    useEffect(() => {
        if (!authLoading && !isAuthorized) {
            toast.error("Acesso restrito a gestores");
            navigate("/");
            return;
        }
        if (isAuthorized) {
            fetchManagerData();
        }
    }, [authLoading, isAuthorized, navigate]);

    const fetchManagerData = async () => {
        setIsLoading(true);
        try {
            // Fetch Stats efficiently using a single RPC call
            const { data: statsData, error: statsError } = await supabase.rpc('get_dashboard_stats');

            if (statsError) throw statsError;

            const newStats = {
                total: statsData.total || 0,
                cadastro: statsData.cadastro || 0,
                avaliacao: statsData.em_avaliacao || 0,
                estoque: statsData.em_estoque || 0,
                vendidos: statsData.vendidos || 0,
            };
            setStats(newStats);

            // Fetch Recent Logs
            const { data: logs, error: logError } = await supabase
                .from("product_logs")
                .select(`
                    id,
                    created_at,
                    new_status,
                    products (model, internal_serial),
                    profiles (full_name)
                `)
                .order("created_at", { ascending: false })
                .limit(10);

            if (logError) throw logError;

            // Cast manual para garantir tipagem, assumindo que o retorno do supabase bata com a interface
            setRecentLogs((logs as unknown as LogWithRelations[]) || []);

        } catch (error) {
            logger.error("Erro ao carregar dashboard:", error);
            toast.error("Erro ao carregar dados gerenciais");
        } finally {
            setIsLoading(false);
        }
    };

    if (authLoading) return null; // MainLayout gerencia isso

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
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Consolidando Métricas</p>
                        <p className="text-[8px] text-muted-foreground/40 uppercase tracking-widest">Processando indicadores de performance</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    const statusConfig = {
        'CADASTRO': { label: 'Cadastro', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: Clock },
        'EM AVALIAÇÃO': { label: 'Em Avaliação', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: Activity },
        'EM AVALIA├ç├âO': { label: 'Em Avaliação', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: Activity },
        'EM ESTOQUE': { label: 'Em Estoque', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: Box },
        'VENDIDO': { label: 'Vendido', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20', icon: CheckCircle2 },
        'REPROVADO': { label: 'Reprovado', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20', icon: AlertCircle },
    };

    return (
        <MainLayout>
            <div className="max-w-7xl mx-auto space-y-10 pb-12">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                <Activity className="h-4 w-4" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Business Intelligence</span>
                        </div>
                        <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-foreground uppercase italic">Visão <span className="text-primary not-italic font-light">Gerencial</span></h1>
                        <p className="text-muted-foreground font-medium text-xs sm:text-sm mt-1 opacity-70 italic">Análise de fluxo, gargalos e performance operacional.</p>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                        <button className="h-12 px-6 bg-foreground/5 hover:bg-foreground/10 border border-border/20 rounded-xl flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-foreground transition-all whitespace-nowrap">
                            <Calendar className="h-4 w-4 text-primary" />
                            Esta Semana
                        </button>
                        <button
                            onClick={() => {
                                toast.promise(async () => {
                                    const { data, error } = await supabase
                                        .from("products")
                                        .select("internal_serial, original_serial, brand, model, status, voltage, created_at")
                                        .order("created_at", { ascending: false });

                                    if (error) throw error;

                                    const { exportToPDF } = await import("@/lib/export-utils");
                                    const headers = ["ID", "Marca", "Modelo", "Status", "Voltagem", "Serial"];
                                    const pdfData = data.map(p => [p.internal_serial, p.brand, p.model, p.status, p.voltage, p.original_serial]);
                                    exportToPDF("Relatório Gerencial Ambicom", headers, pdfData, "relatorio_gerencial");
                                }, {
                                    loading: 'Gerando PDF...',
                                    success: 'PDF exportado com sucesso!',
                                    error: 'Erro ao gerar PDF',
                                });
                            }}
                            className="h-12 px-6 bg-foreground/5 hover:bg-foreground/10 border border-border/20 rounded-xl flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-foreground transition-all whitespace-nowrap"
                        >
                            <FileDown className="h-4 w-4 text-primary" />
                            PDF
                        </button>
                        <button
                            onClick={() => {
                                // Logic to fetch and export full data
                                toast.promise(async () => {
                                    const { data, error } = await supabase
                                        .from("products")
                                        .select("internal_serial, original_serial, brand, model, status, voltage, created_at")
                                        .order("created_at", { ascending: false });

                                    if (error) throw error;

                                    const { exportToExcel } = await import("@/lib/export-utils");
                                    exportToExcel(data, "relatorio_gerencial_ambicom");
                                }, {
                                    loading: 'Gerando relatório...',
                                    success: 'Relatório exportado com sucesso!',
                                    error: 'Erro ao gerar relatório',
                                });
                            }}
                            className="h-12 px-6 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl flex items-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20 whitespace-nowrap"
                        >
                            <Download className="h-4 w-4" />
                            Excel
                        </button>
                    </div>
                </div>

                {/* KPI Grid */}
                <div className="grid gap-4 sm:gap-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                    <div className="glass-card p-6 bg-card/40 border-border/10 relative overflow-hidden group hover:border-primary/30 transition-all">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Package className="h-24 w-24 text-primary" />
                        </div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                                <Package className="h-6 w-6" />
                            </div>
                            <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground/40 bg-foreground/5 px-2 py-1 rounded-lg border border-border/20">
                                Realtime
                            </span>
                        </div>
                        <div className="space-y-1 relative z-10">
                            <p className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] leading-none mb-1">Volume Total</p>
                            <h3 className="text-2xl sm:text-4xl font-black text-foreground tracking-tighter">{stats.total}</h3>
                        </div>
                    </div>

                    <div className="glass-card p-6 bg-card/40 border-border/10 relative overflow-hidden group hover:border-primary/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                                <Clock className="h-6 w-6" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] leading-none mb-1">Cadastro</p>
                            <h3 className="text-2xl sm:text-4xl font-black text-foreground tracking-tighter">{stats.cadastro}</h3>
                        </div>
                    </div>

                    <div className="glass-card p-6 bg-card/40 border-border/10 relative overflow-hidden group hover:border-primary/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                                <Activity className="h-6 w-6" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] leading-none mb-1">Avaliação</p>
                            <h3 className="text-2xl sm:text-4xl font-black text-foreground tracking-tighter">{stats.avaliacao}</h3>
                        </div>
                    </div>

                    <div className="glass-card p-6 bg-card/40 border-border/10 relative overflow-hidden group hover:border-primary/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                                <Box className="h-6 w-6" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] leading-none mb-1">Estoque</p>
                            <h3 className="text-2xl sm:text-4xl font-black text-foreground tracking-tighter">{stats.estoque}</h3>
                        </div>
                    </div>

                    <div className="glass-card p-6 bg-card/40 border-border/10 relative overflow-hidden group hover:border-primary/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="h-12 w-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 border border-purple-500/20">
                                <CheckCircle2 className="h-6 w-6" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] leading-none mb-1">Vendidos</p>
                            <h3 className="text-2xl sm:text-4xl font-black text-foreground tracking-tighter">{stats.vendidos}</h3>
                        </div>
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
                    {/* Recent Logs Table / List */}
                    <div className="lg:col-span-2 glass-card p-0 border-border/10 bg-card/20 overflow-hidden">
                        <div className="p-6 border-b border-border/10 flex items-center justify-between">
                            <h3 className="text-lg font-black text-foreground uppercase tracking-tight">Trilha de Auditoria</h3>
                            <button className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-foreground transition-colors">Ver Completo</button>
                        </div>
                        <div className="relative group/table">
                            {/* Mobile Compact View */}
                            <div className="md:hidden space-y-3 px-2 py-4">
                                {recentLogs.length === 0 ? (
                                    <div className="px-6 py-20 text-center text-muted-foreground italic text-sm">
                                        Nenhum log registrado
                                    </div>
                                ) : (
                                    recentLogs.map((log) => {
                                        const isExpanded = expandedId === log.id;
                                        const profileName = Array.isArray(log.profiles) ? (log.profiles as any)[0]?.full_name : (log.profiles as any)?.full_name;
                                        const productModel = Array.isArray(log.products) ? (log.products as any)[0]?.model : (log.products as any)?.model;
                                        const productSerial = Array.isArray(log.products) ? (log.products as any)[0]?.internal_serial : (log.products as any)?.internal_serial;
                                        const statusInfo = statusConfig[log.new_status as keyof typeof statusConfig];

                                        return (
                                            <div
                                                key={log.id}
                                                className={cn(
                                                    "bg-card/40 border border-border/10 rounded-2xl overflow-hidden transition-all duration-300",
                                                    isExpanded ? "ring-1 ring-primary/30 bg-card/60 shadow-lg" : "hover:bg-card/50"
                                                )}
                                            >
                                                {/* Main Row */}
                                                <div
                                                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                                                    className="p-4 flex items-center justify-between cursor-pointer active:bg-foreground/5"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="h-9 w-9 rounded-xl bg-foreground/5 flex items-center justify-center text-primary shrink-0 border border-border/10">
                                                            <Activity className="h-5 w-5" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h4 className="font-black text-foreground text-[11px] uppercase italic truncate">
                                                                {productModel || "N/A"}
                                                            </h4>
                                                            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight leading-none mt-1">
                                                                {productSerial || "Sem Serial"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <div className="text-right mr-1">
                                                            <span className={cn(
                                                                "inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border",
                                                                statusInfo?.color || 'bg-foreground/5 border-border/20 text-foreground'
                                                            )}>
                                                                {statusInfo?.label || log.new_status}
                                                            </span>
                                                        </div>
                                                        <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300", isExpanded && "rotate-90")} />
                                                    </div>
                                                </div>

                                                {/* Expanded Content */}
                                                {isExpanded && (
                                                    <div className="px-4 pb-4 pt-2 border-t border-border/5 bg-foreground/5 animate-in slide-in-from-top-2 duration-300">
                                                        <div className="grid grid-cols-1 gap-2">
                                                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-background/40 border border-border/10">
                                                                <div className="flex items-center gap-2">
                                                                    <Users className="h-3.5 w-3.5 text-primary/60" />
                                                                    <p className="text-[9px] font-black text-muted-foreground uppercase opacity-50">Operador</p>
                                                                </div>
                                                                <p className="text-[10px] font-bold text-foreground">{profileName || "Sistema"}</p>
                                                            </div>
                                                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-background/40 border border-border/10">
                                                                <div className="flex items-center gap-2">
                                                                    <Clock className="h-3.5 w-3.5 text-primary/60" />
                                                                    <p className="text-[9px] font-black text-muted-foreground uppercase opacity-50">Horário</p>
                                                                </div>
                                                                <p className="text-[10px] font-bold text-foreground">
                                                                    {new Date(log.created_at).toLocaleDateString("pt-BR")} às {new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-background/40 border border-border/10">
                                                                <div className="flex items-center gap-2">
                                                                    <ShieldCheck className="h-3.5 w-3.5 text-primary/60" />
                                                                    <p className="text-[9px] font-black text-muted-foreground uppercase opacity-50">Log ID</p>
                                                                </div>
                                                                <p className="text-[9px] font-mono font-bold text-muted-foreground">{log.id.substring(0, 12)}...</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Desktop Table View */}
                            <div data-scroll="right" className="hidden md:block">
                                {/* Horizontal Scroll Indicators */}
                                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-neutral-900 to-transparent z-20 pointer-events-none opacity-0 group-has-[[data-scroll='left']]:opacity-100 group-has-[[data-scroll='both']]:opacity-100 transition-opacity" />
                                <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-neutral-900 via-card/80 to-transparent z-20 pointer-events-none opacity-0 group-has-[[data-scroll='right']]:opacity-100 group-has-[[data-scroll='both']]:opacity-100 transition-opacity" />

                                <div
                                    className="overflow-x-auto scrollbar-hide"
                                    onScroll={(e) => {
                                        const target = e.currentTarget;
                                        const group = target.parentElement?.parentElement;
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
                                    <table className="w-full text-left text-sm border-collapse min-w-[700px] sm:min-w-full">
                                        <thead className="bg-foreground/5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/10 sticky top-0 z-30 backdrop-blur-md">
                                            <tr>
                                                <th className="px-4 sm:px-6 py-5 whitespace-nowrap sticky left-0 bg-card/95 z-40 border-r border-border/10 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">Data / Horário</th>
                                                <th className="px-4 sm:px-6 py-5 whitespace-nowrap">Ativo Identificado</th>
                                                <th className="px-4 sm:px-6 py-5 whitespace-nowrap">Operador Responsável</th>
                                                <th className="px-4 sm:px-6 py-5 text-right whitespace-nowrap pr-6 sm:pr-10">Status Transição</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {recentLogs.map((log) => {
                                                const profileName = Array.isArray(log.profiles) ? (log.profiles as any)[0]?.full_name : (log.profiles as any)?.full_name;
                                                const productModel = Array.isArray(log.products) ? (log.products as any)[0]?.model : (log.products as any)?.model;
                                                const productSerial = Array.isArray(log.products) ? (log.products as any)[0]?.internal_serial : (log.products as any)?.internal_serial;
                                                const statusInfo = statusConfig[log.new_status as keyof typeof statusConfig];

                                                return (
                                                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                                                        <td className="px-4 sm:px-6 py-5 whitespace-nowrap sticky left-0 bg-card/95 group-hover:bg-card/95 transition-colors z-30 border-r border-border/10 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">
                                                            <div className="flex flex-col">
                                                                <span className="text-foreground font-bold text-[11px] sm:text-xs">{new Date(log.created_at).toLocaleDateString("pt-BR")}</span>
                                                                <span className="font-mono text-[9px] sm:text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
                                                                    {new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-foreground text-[11px] sm:text-xs uppercase italic group-hover:text-primary transition-colors">{productModel || "N/A"}</span>
                                                                <span className="font-mono text-[9px] sm:text-[10px] text-muted-foreground bg-foreground/5 w-fit px-1.5 py-0.5 rounded border border-border/10 mt-0.5">{productSerial || "N/A"}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                                                            <div className="flex items-center gap-2 sm:gap-3">
                                                                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary/10 flex items-center justify-center text-[9px] sm:text-[10px] font-black text-primary border border-primary/20 shadow-inner">
                                                                    {profileName?.substring(0, 1).toUpperCase() || "?"}
                                                                </div>
                                                                <span className="text-[11px] sm:text-xs font-bold text-foreground/80 group-hover:text-foreground transition-colors">{profileName || "Sistema Automatizado"}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 sm:px-6 py-5 text-right whitespace-nowrap pr-6 sm:pr-10">
                                                            <span className={cn(
                                                                "inline-flex px-2 sm:px-2.5 py-1 rounded-md text-[8px] sm:text-[9px] font-black uppercase tracking-widest shadow-sm border",
                                                                statusInfo?.color || 'bg-foreground/5 border-border/20 text-foreground'
                                                            )}>
                                                                {statusInfo?.label || log.new_status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions / Notifications */}
                    <div className="space-y-6">
                        <div className="glass-card p-6 bg-gradient-to-br from-card/50 to-background/50 border-border/10">
                            <h3 className="text-lg font-black text-foreground uppercase tracking-tight mb-6 opacity-30">Notificações</h3>
                            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                                <div className="h-12 w-12 rounded-full bg-foreground/5 flex items-center justify-center text-muted-foreground/20">
                                    <Activity className="h-6 w-6" />
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/30 leading-relaxed italic">Nenhum evento crítico<br />detectado pelo sistema</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
