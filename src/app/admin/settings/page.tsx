import React, { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import {
    Settings,
    Save,
    Loader2,
    ShieldAlert,
    Hash,
    Info,
    ClipboardList,
    Maximize
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
    const [orderSequenceStart, setOrderSequenceStart] = useState<string>("1");
    const [smallMax, setSmallMax] = useState<string>("300");
    const [mediumMax, setMediumMax] = useState<string>("550");
    const [largeAMin, setLargeAMin] = useState<string>("600");

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
                .select("key, value");

            if (error) throw error;

            if (data) {
                const ambicom = data.find(s => s.key === "ambicom_sequence_start");
                const order = data.find(s => s.key === "order_note_sequence_start");
                const refSize = data.find(s => s.key === "refrigerator_sizes");

                if (ambicom) setSequenceStart(ambicom.value as string);
                if (order) setOrderSequenceStart(order.value as string);
                if (refSize && refSize.value) {
                    const parsedValue = typeof refSize.value === 'string' ? JSON.parse(refSize.value) : refSize.value;
                    setSmallMax(parsedValue.small_max?.toString() || "300");
                    setMediumMax(parsedValue.medium_max?.toString() || "550");
                    setLargeAMin(parsedValue.large_a_min?.toString() || "600");
                }
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
            const orderNumValue = parseInt(orderSequenceStart);

            if (isNaN(numValue) || numValue < 1 || isNaN(orderNumValue) || orderNumValue < 1) {
                toast.error("Os valores devem ser números positivos");
                return;
            }

            const { error: error1 } = await supabase
                .from("system_settings")
                .upsert({
                    key: "ambicom_sequence_start",
                    value: sequenceStart,
                    updated_by: profile?.id
                }, { onConflict: 'key' });

            if (error1) throw error1;

            const { error: error2 } = await supabase
                .from("system_settings")
                .upsert({
                    key: "order_note_sequence_start",
                    value: orderSequenceStart,
                    updated_by: profile?.id
                }, { onConflict: 'key' });

            if (error2) throw error2;

            const sMaxNum = parseInt(smallMax);
            const mMaxNum = parseInt(mediumMax);
            const largeAMinNum = parseInt(largeAMin);

            if (isNaN(sMaxNum) || sMaxNum < 1 || isNaN(mMaxNum) || mMaxNum <= sMaxNum || isNaN(largeAMinNum) || largeAMinNum <= mMaxNum) {
                toast.error("Limites de volume inválidos. O limite do médio deve ser maior que o limite do pequeno e o início do Grande/A deve ser maior que o limite do médio.");
                return;
            }

            const { error: error3 } = await supabase
                .from("system_settings")
                .upsert({
                    key: "refrigerator_sizes",
                    value: { small_max: sMaxNum, medium_max: mMaxNum, large_a_min: largeAMinNum },
                    updated_by: profile?.id
                }, { onConflict: 'key' });

            if (error3) throw error3;

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
                    <h1 className="text-3xl sm:text-5xl font-black tracking-tighter uppercase italic">Configurações do <span className="text-primary not-italic font-light">Sistema</span></h1>
                    <p className="text-muted-foreground font-medium text-sm sm:text-base mt-2 opacity-70 italic">Gerenciamento global de parâmetros e opções do sistema.</p>
                </div>

                <div className="grid gap-8">
                    {/* Security Alert Block */}
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 flex gap-4">
                        <ShieldAlert className="h-6 w-6 text-amber-500 shrink-0" />
                        <div className="space-y-1">
                            <h3 className="text-sm font-black text-foreground uppercase tracking-tight">Zona Crítica</h3>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                Alterações nestes parâmetros afetam diretamente a geração de novos IDs e a integridade de rastreabilidade. Proceda com cautela.
                            </p>
                        </div>
                    </div>

                    {/* Sequence Setting Card */}
                    <form onSubmit={handleSave} className="glass-card bg-muted/30 border-border/10 space-y-8">
                        <div className="flex items-center gap-4 border-b border-border/10 pb-6">
                            <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                                <Hash className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-tight">Sequenciamento de ID Ambicom</h3>
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
                                        className="w-full h-16 bg-background/50 border border-border/50 rounded-2xl pl-10 pr-6 text-2xl font-mono font-black text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none shadow-inner transition-all"
                                        value={sequenceStart}
                                        onChange={(e) => setSequenceStart(e.target.value)}
                                    />
                                </div>
                                <p className="text-[9px] text-muted-foreground leading-relaxed font-medium uppercase tracking-tighter">
                                    O sistema irá gerar o próximo ID baseado no maior valor entre este número e o último registro no banco.
                                </p>
                            </div>

                            <div className="bg-foreground/5 border border-border/10 rounded-2xl p-6 space-y-4">
                                <div className="flex items-center gap-2">
                                    <Info className="h-3.5 w-3.5 text-primary" />
                                    <h4 className="text-[10px] font-black uppercase tracking-widest">Como Funciona</h4>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex gap-3">
                                        <div className="h-4 w-4 rounded-full bg-foreground/10 flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5">1</div>
                                        <p className="text-[10px] text-muted-foreground">Se definir <strong>500</strong> e não houver registros, o primeiro ID será <strong>00500-{new Date().getFullYear()}</strong>.</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="h-4 w-4 rounded-full bg-foreground/10 flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5">2</div>
                                        <p className="text-[10px] text-muted-foreground">Se já houver o ID <strong>00510-{new Date().getFullYear()}</strong> e você mudar para <strong>100</strong>, o próximo será <strong>00511-{new Date().getFullYear()}</strong> para evitar duplicidade.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Order Note Sequence Setting Card */}
                        <div className="pt-8 border-t border-border/10 space-y-8">
                            <div className="flex items-center gap-4 border-b border-border/10 pb-6">
                                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                                    <ClipboardList className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tight">Sequenciamento de Notas de Pedido</h3>
                                    <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-widest">Defina o número inicial para novas notas</p>
                                </div>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] block ml-1">Valor Inicial da Nota</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-amber-500 transition-colors">
                                            <span className="font-mono font-bold text-lg">Nº</span>
                                        </div>
                                        <input
                                            type="number"
                                            min="1"
                                            required
                                            className="w-full h-16 bg-background/50 border border-border/50 rounded-2xl pl-12 pr-6 text-2xl font-mono font-black text-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 outline-none shadow-inner transition-all"
                                            value={orderSequenceStart}
                                            onChange={(e) => setOrderSequenceStart(e.target.value)}
                                        />
                                    </div>
                                    <p className="text-[9px] text-muted-foreground leading-relaxed font-medium uppercase tracking-tighter">
                                        Novos pedidos seguirão esta numeração sequencial.
                                    </p>
                                </div>

                                <div className="bg-foreground/5 border border-border/10 rounded-2xl p-6 space-y-4">
                                    <div className="flex items-center gap-2">
                                        <Info className="h-3.5 w-3.5 text-amber-500" />
                                        <h4 className="text-[10px] font-black uppercase tracking-widest">Observação</h4>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex gap-3">
                                            <div className="h-4 w-4 rounded-full bg-foreground/10 flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5">!</div>
                                            <p className="text-[10px] text-muted-foreground italic">Este valor define o ponto de partida do contador de notas. Se houver notas com números superiores, o sistema continuará do maior valor encontrado.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Refrigerator Sizes Setting Card */}
                        <div className="pt-8 border-t border-border/10 space-y-8">
                            <div className="flex items-center gap-4 border-b border-border/10 pb-6">
                                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                                    <Maximize className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tight">Tamanhos de Refrigeradores</h3>
                                    <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-widest">Defina os limites de volume (em Litros) para classificação</p>
                                </div>
                            </div>

                            <div className="grid sm:grid-cols-4 gap-6">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] block ml-1">Até (Pequeno)</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-emerald-500 transition-colors">
                                            <span className="font-bold text-sm">L</span>
                                        </div>
                                        <input
                                            type="number"
                                            min="1"
                                            required
                                            className="w-full h-14 bg-background/50 border border-border/50 rounded-2xl pl-10 pr-4 text-xl font-black text-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 outline-none shadow-inner transition-all text-center"
                                            value={smallMax}
                                            onChange={(e) => setSmallMax(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] block ml-1">Até (Médio)</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-emerald-500 transition-colors">
                                            <span className="font-bold text-sm">L</span>
                                        </div>
                                        <input
                                            type="number"
                                            min="1"
                                            required
                                            className="w-full h-14 bg-background/50 border border-border/50 rounded-2xl pl-10 pr-4 text-xl font-black text-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 outline-none shadow-inner transition-all text-center"
                                            value={mediumMax}
                                            onChange={(e) => setMediumMax(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] block ml-1">A partir de (Grande/A)</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-emerald-500 transition-colors">
                                            <span className="font-bold text-sm">L</span>
                                        </div>
                                        <input
                                            type="number"
                                            min="1"
                                            required
                                            className="w-full h-14 bg-background/50 border border-border/50 rounded-2xl pl-10 pr-4 text-xl font-black text-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 outline-none shadow-inner transition-all text-center"
                                            value={largeAMin}
                                            onChange={(e) => setLargeAMin(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="bg-foreground/5 border border-border/10 rounded-2xl p-4 space-y-3 flex flex-col justify-center">
                                    <div className="space-y-2">
                                        <p className="text-[10px] text-muted-foreground"><strong>Pequeno:</strong> 0 a {smallMax || "300"} L</p>
                                        <p className="text-[10px] text-muted-foreground"><strong>Médio:</strong> {(parseInt(smallMax) || 300) + 1} a {mediumMax || "550"} L</p>
                                        <p className="text-[10px] text-muted-foreground"><strong>Grande:</strong> Acima de {mediumMax || "550"} L</p>
                                        <p className="text-[10px] text-muted-foreground"><strong>Grande/A:</strong> Marcável no scan a partir de {largeAMin || "600"} L</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Technical Protocol Management Card */}
                        <div className="pt-8 border-t border-border/10 space-y-8">
                            <div className="flex items-center gap-4 border-b border-border/10 pb-6">
                                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                    <ClipboardList className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tight">Protocolo Técnico</h3>
                                    <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-widest">Gestão de itens e categorias do checklist</p>
                                </div>
                            </div>

                            <div className="bg-foreground/5 border border-border/10 rounded-2xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6 transition-all hover:bg-foreground/10 group/card">
                                <div className="space-y-2 text-center sm:text-left">
                                    <p className="text-sm font-bold text-foreground italic uppercase tracking-tight">Itens de Avaliação Técnica</p>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed max-w-md">
                                        Configure os campos obrigatórios e opcionais que os técnicos devem preencher durante a auditoria de ativos. Adicione novas verificações ou remova itens obsoletos.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => navigate("/admin/checklist")}
                                    className="h-12 px-8 rounded-xl bg-background border border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground font-black uppercase tracking-widest text-[9px] transition-all flex items-center gap-2 shrink-0 shadow-lg group-hover/card:scale-105"
                                >
                                    Gerenciar Protocolo
                                    <ClipboardList className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-border/10 flex justify-end">
                            <button
                                disabled={isSaving}
                                className="h-16 px-10 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 font-black uppercase tracking-widest text-[10px] transition-all disabled:opacity-50 shadow-xl shadow-primary/20 flex items-center justify-center gap-3"
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
