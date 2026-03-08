import React, { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import {
    Settings,
    Save,
    Loader2,
    ShieldAlert,
    Hash,
    Info
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNavigate } from "react-router-dom";
import { logger } from "@/lib/logger";

export default function AdminSettingsPage() {
    const { profile, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [sequenceStart, setSequenceStart] = useState<string>("1");

    const isAuthorized = profile?.role === "ADMIN";

    useEffect(() => {
        if (!authLoading && !isAuthorized) {
            toast.error("Acesso restrito a administradores");
            navigate("/");
            return;
        }
        if (isAuthorized) {
            fetchSettings();
        }
    }, [authLoading, isAuthorized, navigate]);

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from("system_settings")
                .select("value")
                .eq("key", "ambicom_sequence_start")
                .maybeSingle();

            if (error) throw error;
            if (data?.value) {
                setSequenceStart(data.value as string);
            }
        } catch (error) {
            logger.error("Erro ao carregar configurações:", error);
            toast.error("Erro ao carregar configurações");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const numValue = parseInt(sequenceStart);
            if (isNaN(numValue) || numValue < 1) {
                toast.error("O valor deve ser um número positivo");
                return;
            }

            const { error } = await supabase
                .from("system_settings")
                .upsert({
                    key: "ambicom_sequence_start",
                    value: sequenceStart,
                    updated_by: profile?.id
                }, { onConflict: 'key' });

            if (error) throw error;
            toast.success("Configurações salvas com sucesso!");
        } catch (error) {
            logger.error("Erro ao salvar configurações:", error);
            toast.error("Erro ao salvar configurações");
        } finally {
            setIsSaving(false);
        }
    };

    if (authLoading || isLoading) {
        return (
            <MainLayout>
                <div className="max-w-7xl mx-auto flex h-[80vh] flex-col items-center justify-center space-y-6">
                    <Loader2 className="h-12 w-12 animate-spin text-primary opacity-40" />
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Carregando Configurações</p>
                </div>
            </MainLayout>
        );
    }

    if (!isAuthorized) return null;

    return (
        <MainLayout>
            <div className="max-w-4xl mx-auto space-y-10 pb-12">
                {/* Header Section */}
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                            <Settings className="h-4 w-4" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Painel de Controle</span>
                    </div>
                    <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-white uppercase italic">Configurações do <span className="text-primary not-italic font-light">Sistema</span></h1>
                    <p className="text-muted-foreground font-medium text-sm sm:text-base mt-2 opacity-70 italic">Gerenciamento global de parâmetros e sequenciamento.</p>
                </div>

                <div className="grid gap-8">
                    {/* Security Alert Block */}
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 flex gap-4">
                        <ShieldAlert className="h-6 w-6 text-amber-500 shrink-0" />
                        <div className="space-y-1">
                            <h3 className="text-sm font-black text-white uppercase tracking-tight">Zona Crítica</h3>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                Alterações nestes parâmetros afetam diretamente a geração de novos IDs e a integridade de rastreabilidade. Proceda com cautela.
                            </p>
                        </div>
                    </div>

                    {/* Sequence Setting Card */}
                    <form onSubmit={handleSave} className="glass-card p-8 bg-neutral-900/40 border-white/5 space-y-8">
                        <div className="flex items-center gap-4 border-b border-white/5 pb-6">
                            <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                                <Hash className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white uppercase tracking-tight">Sequenciamento de ID Ambicom</h3>
                                <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-widest">Defina o número inicial para novos ativos</p>
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] block ml-1">Valor Inicial da Sequência</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                                        <span className="font-mono font-bold text-lg">#</span>
                                    </div>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl pl-10 pr-6 text-2xl font-mono font-black text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none shadow-inner transition-all"
                                        value={sequenceStart}
                                        onChange={(e) => setSequenceStart(e.target.value)}
                                    />
                                </div>
                                <p className="text-[9px] text-muted-foreground leading-relaxed font-medium uppercase tracking-tighter">
                                    O sistema irá gerar o próximo ID baseado no maior valor entre este número e o último registro no banco.
                                </p>
                            </div>

                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-4">
                                <div className="flex items-center gap-2">
                                    <Info className="h-3.5 w-3.5 text-primary" />
                                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Como Funciona</h4>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex gap-3">
                                        <div className="h-4 w-4 rounded-full bg-white/10 flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5">1</div>
                                        <p className="text-[10px] text-muted-foreground">Se definir <strong>500</strong> e não houver registros, o primeiro ID será <strong>00500-{new Date().getFullYear()}</strong>.</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="h-4 w-4 rounded-full bg-white/10 flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5">2</div>
                                        <p className="text-[10px] text-muted-foreground">Se já houver o ID <strong>00510-{new Date().getFullYear()}</strong> e você mudar para <strong>100</strong>, o próximo será <strong>00511-{new Date().getFullYear()}</strong> para evitar duplicidade.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-white/5 flex justify-end">
                            <button
                                disabled={isSaving}
                                className="h-16 px-10 rounded-2xl bg-primary text-white hover:bg-primary/90 font-black uppercase tracking-widest text-[10px] transition-all disabled:opacity-50 shadow-xl shadow-primary/20 border-t border-white/20 flex items-center justify-center gap-3"
                            >
                                {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                                Salvar Configurações
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </MainLayout>
    );
}
