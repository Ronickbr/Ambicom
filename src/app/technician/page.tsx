import React, { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { Link } from "react-router-dom";
import {
    ClipboardList,
    Clock,
    Search,
    AlertTriangle,
    CheckCircle2,
    Loader2,
    Filter,
    ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNavigate } from "react-router-dom";
import { Product } from "@/lib/types";

export default function TechnicianPage() {
    const { profile, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const isAuthorized = profile?.role === "TECNICO" || profile?.role === "SUPERVISOR" || profile?.role === "GESTOR" || profile?.role === "ADMIN";

    useEffect(() => {
        if (!authLoading && !isAuthorized) {
            toast.error("Acesso restrito a equipe técnica");
            navigate("/");
            return;
        }

        const fetchQueue = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .from("products")
                    .select("*")
                    .eq("status", "CADASTRO")
                    .order("created_at", { ascending: true });

                if (error) throw error;
                setProducts((data as Product[]) || []);
            } catch (error) {
                console.error("Erro ao buscar fila:", error);
                toast.error("Erro ao carregar fila técnica");
            } finally {
                setIsLoading(false);
            }
        };

        if (isAuthorized) {
            fetchQueue();
        }
    }, [authLoading, isAuthorized, navigate]);

    const filteredProducts = products.filter(p =>
        (p.internal_serial || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.model || "").toLowerCase().includes(searchTerm.toLowerCase())
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
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Sincronizando Fila</p>
                        <p className="text-[8px] text-muted-foreground/40 uppercase tracking-widest">Carregando ativos pendentes de inspeção</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="max-w-7xl mx-auto space-y-10 pb-12">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                <ClipboardList className="h-4 w-4" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Operações de Campo</span>
                        </div>
                        <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-white uppercase italic">Fila <span className="text-primary not-italic font-light">Técnica</span></h1>
                        <p className="text-muted-foreground font-medium text-[10px] sm:text-sm mt-1 opacity-70 italic px-1">Ativos aguardando inspeção, checklist e validação técnica.</p>
                    </div>
                    <div className="glass-card flex items-center gap-4 py-4 px-8 border-white/5 bg-neutral-900/50 shadow-inner w-full md:w-auto justify-between md:justify-start">
                        <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20 shadow-sm"><Clock className="h-5 w-5" /></div>
                        <div>
                            <div className="text-[9px] uppercase font-black text-muted-foreground tracking-widest leading-none mb-1">SLA Médio</div>
                            <div className="text-lg font-black text-white italic tracking-widest">4.5 <span className="text-[10px] not-italic font-medium opacity-50">h/unidade</span></div>
                        </div>
                    </div>
                </div>

                {/* Search Interface */}
                <div className="flex flex-col md:flex-row items-center gap-4 py-2">
                    <div className="relative flex-1 group w-full px-1 sm:px-0">
                        <Search className="absolute left-5 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Localizar ativo por Serial..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-2xl border border-white/10 bg-neutral-900/50 py-3 sm:py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all text-white shadow-inner backdrop-blur-sm placeholder:text-muted-foreground/30 font-medium"
                        />
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                        <button className="flex-1 md:flex-none px-8 h-14 bg-neutral-900/50 rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-white flex items-center justify-center gap-3 hover:bg-white/5 transition-all shadow-inner">
                            <Filter className="h-4 w-4 text-primary" />
                            Filtros Avançados
                        </button>
                    </div>
                </div>

                {filteredProducts.length > 0 ? (
                    <div className="glass-card overflow-hidden rounded-2xl border border-white/10 shadow-2xl p-0">
                        <div className="relative group/table" data-scroll="right">
                            {/* Horizontal Scroll Indicators */}
                            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-neutral-900 to-transparent z-20 pointer-events-none opacity-0 group-has-[[data-scroll='left']]:opacity-100 group-has-[[data-scroll='both']]:opacity-100 transition-opacity" />
                            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-neutral-900 via-neutral-900/80 to-transparent z-20 pointer-events-none opacity-0 group-has-[[data-scroll='right']]:opacity-100 group-has-[[data-scroll='both']]:opacity-100 transition-opacity" />

                            <div
                                className="overflow-x-auto scrollbar-hide"
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
                                <table className="w-full text-left text-sm border-collapse min-w-[700px] sm:min-w-full">
                                    <thead className="bg-white/5 text-muted-foreground uppercase text-[9px] sm:text-[10px] font-black tracking-widest border-b border-white/5 sticky top-0 z-30 backdrop-blur-md">
                                        <tr>
                                            <th className="px-4 sm:px-6 py-5 whitespace-nowrap sticky left-0 bg-neutral-900/95 z-40 border-r border-white/5 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">Ativo / Identificação</th>
                                            <th className="px-4 sm:px-6 py-5 whitespace-nowrap">Marca / Fabricante</th>
                                            <th className="px-4 sm:px-6 py-5 text-center whitespace-nowrap">Status Lab</th>
                                            <th className="px-4 sm:px-6 py-5 whitespace-nowrap">Entrada</th>
                                            <th className="px-4 sm:px-6 py-5 text-right whitespace-nowrap pr-6 sm:pr-10">Checklist</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredProducts.map((product) => (
                                            <tr
                                                key={product.id}
                                                className="group hover:bg-white/[0.02] transition-all cursor-pointer"
                                                onClick={() => navigate(`/technician/checklist/${product.id}`)}
                                            >
                                                <td className="px-4 sm:px-6 py-5 whitespace-nowrap sticky left-0 bg-neutral-900/95 group-hover:bg-neutral-800/95 transition-colors z-30 border-r border-white/5 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">
                                                    <div className="flex items-center gap-3 sm:gap-4">
                                                        <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-all border border-amber-500/10 shadow-inner">
                                                            <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-black text-white text-[13px] sm:text-base group-hover:text-primary transition-colors leading-tight uppercase italic truncate max-w-[120px] sm:max-w-none">{product.model}</span>
                                                            <span className="font-mono text-[9px] sm:text-[10px] text-muted-foreground uppercase mt-0.5 tracking-widest bg-white/5 w-fit px-1.5 py-0.5 rounded border border-white/5">
                                                                {product.internal_serial}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                                                    <span className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] group-hover:text-white transition-colors">
                                                        {product.brand}
                                                    </span>
                                                </td>
                                                <td className="px-4 sm:px-6 py-5 text-center whitespace-nowrap">
                                                    <span className="inline-flex px-2 sm:px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[8px] sm:text-[10px] font-black uppercase tracking-wider shadow-sm">
                                                        Pendente
                                                    </span>
                                                </td>
                                                <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] sm:text-xs font-bold text-white/80">{new Date(product.created_at).toLocaleDateString("pt-BR")}</span>
                                                        <span className="text-[9px] sm:text-[10px] text-muted-foreground/40 font-mono tracking-tighter uppercase">{new Date(product.created_at).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 sm:px-6 py-5 text-right whitespace-nowrap pr-6 sm:pr-10">
                                                    <button
                                                        className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all border border-primary/20 shadow-lg active:scale-90 ml-auto"
                                                    >
                                                        <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="glass-card flex flex-col items-center justify-center py-32 text-center border-dashed border border-white/5 bg-neutral-900/20">
                        <div className="h-24 w-24 rounded-full bg-white/5 flex items-center justify-center mb-8 relative">
                            <CheckCircle2 className="h-10 w-10 text-emerald-500/50" />
                            <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-pulse" />
                        </div>
                        <h3 className="text-3xl font-black text-white mb-3 uppercase tracking-tighter">Fila Zerada</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto text-sm leading-relaxed italic opacity-70">
                            Excelente trabalho. Não existem ativos pendentes de inspeção técnica no momento.
                        </p>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
