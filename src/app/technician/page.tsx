import React, { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
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
                    <div className="grid gap-4">
                        {filteredProducts.map((product) => (
                            <Link
                                key={product.id}
                                to={`/technician/checklist/${product.id}`}
                                className="glass-card group hover:border-primary/50 transition-all duration-300 relative overflow-hidden flex flex-col md:flex-row items-center p-0 bg-neutral-900/30 border-white/5"
                            >
                                <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/50 group-hover:bg-primary transition-colors" />
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none" />

                                <div className="p-4 sm:p-6 md:w-64 border-b md:border-b-0 md:border-r border-white/5 bg-white/[0.02]">
                                    <div className="flex items-center justify-between md:flex-col md:items-start md:gap-3 mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center text-muted-foreground group-hover:text-white transition-colors">
                                                <AlertTriangle className="h-4 w-4" />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Pendente</span>
                                        </div>
                                        <p className="font-mono text-[10px] text-muted-foreground opacity-50 shrink-0">#{product.id.split('-')[0]}</p>
                                    </div>
                                </div>
                                <div className="flex-1 p-5 sm:p-6 flex flex-col md:flex-row items-center md:items-center justify-between gap-6 w-full">
                                    <div className="space-y-1 text-center md:text-left">
                                        <h3 className="text-xl font-black text-white group-hover:text-primary transition-colors tracking-tight uppercase italic break-words">{product.model}</h3>
                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em]">{product.brand} • <span className="font-mono text-white/50">{product.internal_serial}</span></p>
                                    </div>
                                    <div className="flex items-center gap-4 sm:gap-8 flex-row md:flex-row w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-white/5 pt-4 md:pt-0">
                                        <div className="text-left md:text-right">
                                            <p className="text-[8px] sm:text-[9px] text-muted-foreground uppercase font-black tracking-widest mb-1">Entrada</p>
                                            <p className="text-[10px] sm:text-xs font-bold text-white font-mono">{new Date(product.created_at).toLocaleString("pt-BR")}</p>
                                        </div>
                                        <button className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover:bg-primary group-hover:text-white transition-all shadow-lg active:scale-90 shrink-0">
                                            <ArrowRight className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            </Link>
                        ))}
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
