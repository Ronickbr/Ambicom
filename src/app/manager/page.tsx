import React, { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import {
    TrendingUp,
    Package,
    AlertCircle,
    Calendar,
    Loader2,
    ShieldCheck,
    Users,
    Activity,
    Download,
    Clock,
    Box,
    CheckCircle2,
    XCircle
} from "lucide-react";
import { toast } from "sonner";
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
            // Fetch Stats efficiently using count
            const queries = [
                supabase.from("products").select("*", { count: 'exact', head: true }), // Total
                supabase.from("products").select("*", { count: 'exact', head: true }).in('status', ['LIBERADO', 'VENDIDO']), // Homologados
                supabase.from("products").select("*", { count: 'exact', head: true }).eq('status', 'CADASTRO'), // Cadastro
                supabase.from("products").select("*", { count: 'exact', head: true }).eq('status', 'EM AVALIAÇÃO'), // Em Avaliação
                supabase.from("products").select("*", { count: 'exact', head: true }).eq('status', 'EM ESTOQUE'), // Em Estoque
                supabase.from("products").select("*", { count: 'exact', head: true }).eq('status', 'VENDIDO'), // Vendidos
            ];

            const results = await Promise.all(queries);

            const newStats = {
                total: results[0].count || 0,
                cadastro: results[1].count || 0,
                avaliacao: results[2].count || 0,
                estoque: results[3].count || 0,
                vendidos: results[4].count || 0
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
            console.error("Erro ao carregar dashboard:", error);
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
        'EM ESTOQUE': { label: 'Em Estoque', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: Box },
        'VENDIDO': { label: 'Vendido', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20', icon: CheckCircle2 },
        'RECUSADO': { label: 'Recusado', color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: XCircle },
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
                        <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-white uppercase italic">Visão <span className="text-primary not-italic font-light">Gerencial</span></h1>
                        <p className="text-muted-foreground font-medium text-xs sm:text-sm mt-1 opacity-70 italic">Análise de fluxo, gargalos e performance operacional.</p>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                        <button className="h-12 px-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white transition-all whitespace-nowrap">
                            <Calendar className="h-4 w-4 text-primary" />
                            Esta Semana
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
                            className="h-12 px-6 bg-primary hover:bg-primary/90 text-white rounded-xl flex items-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20 whitespace-nowrap"
                        >
                            <Download className="h-4 w-4" />
                            Relatório
                        </button>
                    </div>
                </div>

                {/* KPI Grid */}
                <div className="grid gap-4 sm:gap-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                    <div className="glass-card p-6 bg-neutral-900/40 border-white/5 relative overflow-hidden group hover:border-primary/30 transition-all">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Package className="h-24 w-24 text-primary" />
                        </div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                                <Package className="h-6 w-6" />
                            </div>
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                                <TrendingUp className="h-3 w-3" /> +12%
                            </span>
                        </div>
                        <div className="space-y-1 relative z-10">
                            <p className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] leading-none mb-1">Volume Total</p>
                            <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tighter">{stats.total}</h3>
                        </div>
                    </div>

                    <div className="glass-card p-6 bg-neutral-900/40 border-white/5 relative overflow-hidden group hover:border-primary/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                                <Clock className="h-6 w-6" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] leading-none mb-1">Cadastro</p>
                            <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tighter">{stats.cadastro}</h3>
                        </div>
                    </div>

                    <div className="glass-card p-6 bg-neutral-900/40 border-white/5 relative overflow-hidden group hover:border-primary/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                                <Activity className="h-6 w-6" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] leading-none mb-1">Avaliação</p>
                            <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tighter">{stats.avaliacao}</h3>
                        </div>
                    </div>

                    <div className="glass-card p-6 bg-neutral-900/40 border-white/5 relative overflow-hidden group hover:border-primary/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                                <Box className="h-6 w-6" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] leading-none mb-1">Estoque</p>
                            <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tighter">{stats.estoque}</h3>
                        </div>
                    </div>

                    <div className="glass-card p-6 bg-neutral-900/40 border-white/5 relative overflow-hidden group hover:border-primary/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="h-12 w-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 border border-purple-500/20">
                                <CheckCircle2 className="h-6 w-6" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] leading-none mb-1">Vendidos</p>
                            <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tighter">{stats.vendidos}</h3>
                        </div>
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
                    {/* Recent Logs Table */}
                    <div className="lg:col-span-2 glass-card p-0 border-white/5 bg-neutral-900/20 overflow-hidden">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-lg font-black text-white uppercase tracking-tight">Trilha de Auditoria</h3>
                            <button className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-white transition-colors">Ver Completo</button>
                        </div>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    <tr>
                                        <th className="px-6 py-4">Data/Hora</th>
                                        <th className="px-6 py-4">Ativo</th>
                                        <th className="px-6 py-4">Responsável</th>
                                        <th className="px-6 py-4">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {recentLogs.map((log) => {
                                        const profileName = Array.isArray(log.profiles) ? log.profiles[0]?.full_name : log.profiles?.full_name;
                                        const productModel = Array.isArray(log.products) ? log.products[0]?.model : log.products?.model;
                                        const productSerial = Array.isArray(log.products) ? log.products[0]?.internal_serial : log.products?.internal_serial;
                                        const statusInfo = statusConfig[log.new_status as keyof typeof statusConfig];

                                        return (
                                            <tr key={log.id} className="hover:bg-white/5 transition-colors group">
                                                <td className="px-6 py-4 font-mono text-xs text-muted-foreground group-hover:text-white transition-colors">
                                                    {new Date(log.created_at).toLocaleString("pt-BR")}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-white text-xs">{productModel || "N/A"}</span>
                                                        <span className="font-mono text-[10px] text-muted-foreground">{productSerial || "N/A"}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white">
                                                            {profileName?.substring(0, 1) || "?"}
                                                        </div>
                                                        <span className="text-xs font-medium text-white/80">{profileName || "Sistema"}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex px-2 py-1 rounded-md ${statusInfo?.color || 'bg-white/5 border border-white/10 text-white'} text-[10px] font-black uppercase tracking-wider`}>
                                                        {statusInfo?.label || log.new_status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Logs View */}
                        <div className="md:hidden divide-y divide-white/5">
                            {recentLogs.map((log) => {
                                const profileName = Array.isArray(log.profiles) ? log.profiles[0]?.full_name : log.profiles?.full_name;
                                const productModel = Array.isArray(log.products) ? log.products[0]?.model : log.products?.model;
                                const productSerial = Array.isArray(log.products) ? log.products[0]?.internal_serial : log.products?.internal_serial;
                                const statusInfo = statusConfig[log.new_status as keyof typeof statusConfig];

                                return (
                                    <div key={log.id} className="p-4 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-white text-sm tracking-tight">{productModel || "N/A"}</span>
                                                <span className="font-mono text-[9px] text-muted-foreground uppercase">{productSerial || "N/A"}</span>
                                            </div>
                                            <span className={`inline-flex px-2 py-0.5 rounded-md ${statusInfo?.color || 'bg-white/5 border border-white/10 text-white'} text-[8px] font-black uppercase tracking-widest`}>
                                                {statusInfo?.label || log.new_status}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center pt-1">
                                            <div className="flex items-center gap-2">
                                                <div className="h-5 w-5 rounded-full bg-white/5 flex items-center justify-center text-[8px] font-bold text-muted-foreground border border-white/5">
                                                    {profileName?.substring(0, 1) || "?"}
                                                </div>
                                                <span className="text-[10px] font-medium text-muted-foreground">{profileName || "Sistema"}</span>
                                            </div>
                                            <span className="font-mono text-[9px] text-muted-foreground/40">{new Date(log.created_at).toLocaleString("pt-BR", { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Quick Actions / Notifications */}
                    <div className="space-y-6">
                        <div className="glass-card p-6 bg-gradient-to-br from-neutral-900 to-black border-white/5">
                            <h3 className="text-lg font-black text-white uppercase tracking-tight mb-6">Alertas do Sistema</h3>
                            <div className="space-y-4">
                                <div className="flex gap-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                                    <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                                    <div>
                                        <p className="text-xs font-bold text-white mb-1">Gargalo na Triagem</p>
                                        <p className="text-[10px] text-muted-foreground leading-relaxed">O tempo médio de permanência em &quot;CADASTRO&quot; excedeu 4 horas.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                    <TrendingUp className="h-5 w-5 text-blue-500 shrink-0" />
                                    <div>
                                        <p className="text-xs font-bold text-white mb-1">Meta Atingida</p>
                                        <p className="text-[10px] text-muted-foreground leading-relaxed">A equipe de supervisão atingiu 100% da meta diária.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
