import React, { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import { useParams, useNavigate } from "react-router-dom";
import {
    Loader2,
    ChevronLeft,
    AlertTriangle,
    CheckCircle,
    ClipboardPen,
    Zap
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Product, ChecklistItem } from "@/lib/types";
import { Plus, X } from "lucide-react";
import { logger } from "@/lib/logger";

export default function TechnicianChecklist() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [product, setProduct] = useState<Product | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
    const [checklistData, setChecklistData] = useState<Record<string, boolean>>({});
    const [obs, setObs] = useState("");

    // New field state
    const [isAddingField, setIsAddingField] = useState(false);
    const [newFieldLabel, setNewFieldLabel] = useState("");
    const [newFieldCategory, setNewFieldCategory] = useState("Geral");
    const [isSavingField, setIsSavingField] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Product
                const { data: productData, error: productError } = await supabase
                    .from("products")
                    .select("*")
                    .eq("id", id)
                    .single();

                if (productError) throw productError;
                setProduct(productData as Product);

                // Fetch Checklist Items
                const { data: itemsData, error: itemsError } = await supabase
                    .from("checklist_items")
                    .select("*")
                    .order("created_at", { ascending: true });

                if (itemsError) throw itemsError;

                const items = itemsData as ChecklistItem[];
                setChecklistItems(items);

                const initial: Record<string, boolean> = {};
                items.forEach(item => initial[item.id] = false);
                setChecklistData(initial);
            } catch (error) {
                logger.error("Erro ao carregar dados do checklist:", error);
                toast.error("Erro ao carregar dados");
                navigate("/technician");
            } finally {
                setIsLoading(false);
            }
        };

        if (id) fetchData();
    }, [id, navigate]);

    const toggleItem = (itemId: string) => {
        setChecklistData(prev => ({ ...prev, [itemId]: !prev[itemId] }));
    };

    const handleAddField = async () => {
        if (!newFieldLabel.trim()) {
            toast.error("O nome do campo é obrigatório");
            return;
        }

        setIsSavingField(true);
        try {
            const { data, error } = await supabase
                .from("checklist_items")
                .insert({
                    label: newFieldLabel.trim(),
                    category: newFieldCategory,
                    is_optional: true
                })
                .select()
                .single();

            if (error) throw error;

            const newItem = data as ChecklistItem;
            setChecklistItems(prev => [...prev, newItem]);
            setChecklistData(prev => ({ ...prev, [newItem.id]: false }));
            setNewFieldLabel("");
            setIsAddingField(false);
            toast.success("Novo campo adicionado permanentemente!");
        } catch (error) {
            logger.error("Erro ao adicionar campo:", error);
            toast.error("Erro ao salvar novo campo");
        } finally {
            setIsSavingField(false);
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const { error: updateError } = await supabase
                .from("products")
                .update({
                    status: "EM AVALIAÇÃO"
                })
                .eq("id", id);

            if (updateError) throw updateError;

            const { error: logError } = await supabase
                .from("product_logs")
                .insert({
                    product_id: id,
                    old_status: "CADASTRO",
                    new_status: "EM AVALIAÇÃO",
                    actor_id: (await supabase.auth.getUser()).data.user?.id || null,
                    data: {
                        checklist: checklistData,
                        checklist_labels: checklistItems.reduce((acc, item) => {
                            acc[item.id] = item.label;
                            return acc;
                        }, {} as Record<string, string>),
                        observations: obs,
                        technician_timestamp: new Date().toISOString()
                    }
                });

            if (logError) throw logError;

            toast.success("Checklist finalizado!", {
                description: "Produto enviado para aprovação do Supervisor."
            });
            navigate("/technician");
        } catch (error) {
            const err = error as Error;
            logger.error("Erro ao salvar checklist:", err);
            toast.error("Erro ao finalizar checklist", {
                description: err.message
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <MainLayout>
                <div className="flex h-[80vh] flex-col items-center justify-center space-y-6">
                    <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse" />
                        <Loader2 className="h-16 w-16 animate-spin text-primary relative z-10" />
                    </div>
                </div>
            </MainLayout>
        );
    }

    const allChecked = Object.values(checklistData).every(v => v === true);

    return (
        <MainLayout>
            <div className="max-w-4xl mx-auto space-y-10 pb-24">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground hover:text-primary transition-all group"
                >
                    <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                    Voltar para Fila
                </button>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 sm:gap-8 border-b border-border/10 pb-8 sm:pb-10">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                <ClipboardPen className="h-4 w-4" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Evidência Técnica</span>
                        </div>
                        <h1 className="text-2xl sm:text-4xl font-black tracking-tighter text-foreground uppercase italic leading-none">
                            Validação de <span className="text-primary not-italic font-light tracking-normal">Checklist</span>
                        </h1>
                        <p className="text-muted-foreground font-medium text-xs sm:text-sm italic opacity-70">Auditoria técnica do ativo: <span className="text-foreground font-mono not-italic">{product?.internal_serial}</span></p>
                    </div>
                    <div className="glass-card bg-card border-border/20 p-4 sm:p-6 flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center shadow-2xl w-full md:w-auto min-w-[240px]">
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-0 md:mb-1 opacity-50 text-right">Especificação</span>
                        <div className="text-right">
                            <div className="font-black text-lg sm:text-xl text-foreground tracking-tight uppercase italic mb-0 md:mb-1">{product?.model}</div>
                            <div className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{product?.brand}</div>
                        </div>
                    </div>
                </div>

                <div className="grid lg:grid-cols-5 gap-6 sm:gap-10">
                    <div className="lg:col-span-3 space-y-6 sm:space-y-8">
                        {/* Dynamic Checklist */}
                        <div className="grid gap-3">
                            {checklistItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => toggleItem(item.id)}
                                    className={cn(
                                        "flex items-center justify-between p-4 sm:p-6 rounded-2xl border transition-all duration-300 text-left group",
                                        checklistData[item.id]
                                            ? "bg-primary/5 border-primary/40 shadow-[0_0_20px_rgba(14,165,233,0.1)]"
                                            : "bg-foreground/5 border-border/10 hover:border-border/20"
                                    )}
                                >
                                    <div className="flex items-center gap-4 sm:gap-6">
                                        <div className={cn(
                                            "h-8 w-8 rounded-xl border-2 flex items-center justify-center transition-all duration-500 shrink-0",
                                            checklistData[item.id] ? "bg-primary border-primary rotate-0 scale-110 shadow-lg shadow-primary/20" : "border-border/20 rotate-45 scale-90"
                                        )}>
                                            {checklistData[item.id] && <CheckCircle className="h-5 w-5 text-foreground" />}
                                        </div>
                                        <div>
                                            <div className={cn("text-base sm:text-lg font-black tracking-tight transition-colors italic uppercase", checklistData[item.id] ? "text-primary" : "text-foreground/80")}>
                                                {item.label}
                                            </div>
                                            <div className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest mt-0.5">{item.category}</div>
                                        </div>
                                    </div>
                                    {checklistData[item.id] && (
                                        <div className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest animate-in fade-in zoom-in slide-in-from-right-4 shrink-0 ml-2">
                                            OK
                                            <CheckCircle className="h-3 w-3" />
                                        </div>
                                    )}
                                </button>
                            ))}

                            {/* Add Field Button/Input */}
                            {!isAddingField ? (
                                <button
                                    onClick={() => setIsAddingField(true)}
                                    className="flex items-center justify-center gap-3 p-4 rounded-2xl border border-dashed border-border/40 hover:border-primary/50 hover:bg-primary/5 transition-all group"
                                >
                                    <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                                    <span className="text-sm font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary">Adicionar Novo Campo</span>
                                </button>
                            ) : (
                                <div className="glass-card bg-card border-primary/30 p-6 rounded-2xl space-y-4 animate-in zoom-in-95 duration-200 shadow-2xl">
                                    <div className="flex items-center justify-between pb-2 border-b border-border/10 mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Novo Requisito Técnico</span>
                                        <button onClick={() => setIsAddingField(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Nome do Item</label>
                                            <input
                                                autoFocus
                                                type="text"
                                                value={newFieldLabel}
                                                onChange={(e) => setNewFieldLabel(e.target.value)}
                                                placeholder="Ex: Verificar vedação da porta..."
                                                className="w-full bg-card/40 border border-border/20 rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-all font-bold placeholder:font-medium placeholder:text-muted-foreground/30 italic"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Categoria</label>
                                                <select
                                                    value={newFieldCategory}
                                                    onChange={(e) => setNewFieldCategory(e.target.value)}
                                                    className="w-full bg-card/40 border border-border/20 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-foreground focus:outline-none focus:border-primary/50 transition-all appearance-none cursor-pointer"
                                                >
                                                    <option value="Funcional">Funcional</option>
                                                    <option value="Estético">Estético</option>
                                                    <option value="Componentes">Componentes</option>
                                                    <option value="Geral">Geral</option>
                                                    <option value="Outros">Outros</option>
                                                </select>
                                            </div>
                                            <div className="flex items-end shadow-2xl">
                                                <button
                                                    onClick={handleAddField}
                                                    disabled={isSavingField}
                                                    className="w-full h-[46px] rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 shadow-[0_0_20px_rgba(14,165,233,0.3)] flex items-center justify-center gap-2"
                                                >
                                                    {isSavingField ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                                    Confirmar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-6 sm:space-y-8">
                        {/* Observations */}
                        <div className="glass-card bg-card/40 space-y-4 p-6 sm:p-8 border-border/10">
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="h-4 w-4 text-primary" />
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Observações do Laudo</label>
                            </div>
                            <textarea
                                value={obs}
                                onChange={(e) => setObs(e.target.value)}
                                placeholder="Insira detalhes técnicos adicionais ou identifique anomalias não listadas..."
                                className="w-full h-48 rounded-2xl border border-border/10 bg-card/40 p-6 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all shadow-inner resize-none"
                            />
                        </div>

                        {!allChecked && (
                            <div className="flex items-start gap-4 p-6 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 animate-in shake-in">
                                <AlertTriangle className="h-6 w-6 mt-0.5 shrink-0" />
                                <div className="space-y-1">
                                    <p className="text-xs font-black uppercase tracking-widest">Protocolo Incompleto</p>
                                    <p className="text-[11px] font-medium opacity-80 leading-relaxed italic text-balance">Existem itens pendentes de validação. O registro necessita de 100% de conformidade para processamento automático.</p>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-4 p-2">
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="btn-primary flex-1 h-14 sm:h-16 flex items-center justify-center gap-4 text-xs font-black uppercase tracking-[0.2em] shadow-2xl relative overflow-hidden group/btn disabled:grayscale rounded-xl"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000" />
                                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
                                Finalizar Protocolo
                            </button>
                            <button
                                onClick={() => navigate(-1)}
                                className="px-8 h-14 sm:h-auto rounded-xl border border-border/10 bg-foreground/5 hover:bg-foreground/10 text-[10px] font-black uppercase tracking-[0.2em] transition-all text-muted-foreground hover:text-foreground"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
