import React, { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import {
    ClipboardList,
    Plus,
    Trash2,
    Loader2,
    ShieldAlert,
    AlertTriangle,
    CheckCircle2,
    Save,
    ChevronLeft,
    ChevronUp,
    ChevronDown
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNavigate } from "react-router-dom";
import { logger } from "@/lib/logger";
import { ChecklistItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function AdminChecklistPage() {
    const { profile, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [items, setItems] = useState<ChecklistItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // New item form state
    const [newItemLabel, setNewItemLabel] = useState("");
    const [newItemCategory, setNewItemCategory] = useState("Funcional");

    // Categories state
    const [dynamicCategories, setDynamicCategories] = useState<string[]>(["Funcional", "Estético", "Componentes", "Geral"]);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [isSavingCategory, setIsSavingCategory] = useState(false);
    const [isManagingCategories, setIsManagingCategories] = useState(false);

    const [isReordering, setIsReordering] = useState(false);

    const isAuthorized = profile?.role === "ADMIN";

    useEffect(() => {
        if (!authLoading && !isAuthorized) {
            toast.error("Acesso restrito a administradores");
            navigate("/");
            return;
        }
        if (isAuthorized) {
            fetchData();
        }
    }, [authLoading, isAuthorized, navigate]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch items
            const { data: itemsData, error: itemsError } = await supabase
                .from("checklist_items")
                .select("*")
                .eq("is_active", true)
                .order("category", { ascending: true })
                .order("created_at", { ascending: true });

            if (itemsError) throw itemsError;
            setItems(itemsData || []);

            // Fetch dynamic categories from system_settings
            const { data: settingsData, error: settingsError } = await supabase
                .from("system_settings")
                .select("value")
                .eq("key", "checklist_categories")
                .single();

            if (settingsError && settingsError.code !== 'PGRST116') {
                logger.error("Erro ao carregar categorias:", settingsError);
            } else if (settingsData?.value) {
                const parsedCategories = typeof settingsData.value === 'string'
                    ? JSON.parse(settingsData.value)
                    : settingsData.value;
                if (Array.isArray(parsedCategories)) {
                    setDynamicCategories(parsedCategories);
                    if (parsedCategories.length > 0) {
                        setNewItemCategory(parsedCategories[0]);
                    }
                }
            }
        } catch (error) {
            logger.error("Erro ao carregar dados:", error);
            toast.error("Erro ao carregar itens ou categorias");
        } finally {
            setIsLoading(false);
        }
    };

    const updateCategoriesInDB = async (newList: string[]) => {
        const { error } = await supabase
            .from("system_settings")
            .upsert({
                key: "checklist_categories",
                value: newList,
                updated_by: profile?.id
            }, { onConflict: 'key' });

        if (error) throw error;
    };

    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = newCategoryName.trim();
        if (!trimmedName) return;

        if (dynamicCategories.includes(trimmedName)) {
            toast.error("Esta categoria já existe");
            return;
        }

        setIsSavingCategory(true);
        try {
            const newList = [...dynamicCategories, trimmedName];
            await updateCategoriesInDB(newList);
            setDynamicCategories(newList);
            setNewCategoryName("");
            toast.success("Categoria adicionada!");
        } catch (error) {
            logger.error("Erro ao salvar categoria:", error);
            toast.error("Erro ao salvar categoria");
        } finally {
            setIsSavingCategory(false);
        }
    };

    const handleDeleteCategory = async (catName: string) => {
        const hasItems = items.some(item => item.category === catName);
        if (hasItems) {
            toast.error("Não é possível excluir uma categoria que possui itens vinculados");
            return;
        }

        if (!confirm(`Deseja realmente excluir a categoria "${catName}"?`)) return;

        setIsSavingCategory(true);
        try {
            const newList = dynamicCategories.filter(c => c !== catName);
            await updateCategoriesInDB(newList);
            setDynamicCategories(newList);
            if (newItemCategory === catName) {
                setNewItemCategory(newList[0] || "");
            }
            toast.success("Categoria removida");
        } catch (error) {
            logger.error("Erro ao remover categoria:", error);
            toast.error("Erro ao remover categoria");
        } finally {
            setIsSavingCategory(false);
        }
    };

    const moveCategoryUp = async (index: number) => {
        if (index === 0) return;
        const newList = [...dynamicCategories];
        const temp = newList[index];
        newList[index] = newList[index - 1];
        newList[index - 1] = temp;

        try {
            setDynamicCategories(newList);
            await updateCategoriesInDB(newList);
        } catch (error) {
            logger.error("Erro ao mover categoria:", error);
            toast.error("Erro ao salvar nova ordem");
            fetchData(); // Rollback
        }
    };

    const moveCategoryDown = async (index: number) => {
        if (index === dynamicCategories.length - 1) return;
        const newList = [...dynamicCategories];
        const temp = newList[index];
        newList[index] = newList[index + 1];
        newList[index + 1] = temp;

        try {
            setDynamicCategories(newList);
            await updateCategoriesInDB(newList);
        } catch (error) {
            logger.error("Erro ao mover categoria:", error);
            toast.error("Erro ao salvar nova ordem");
            fetchData(); // Rollback
        }
    };

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemLabel.trim()) {
            toast.error("O nome do item é obrigatório");
            return;
        }

        // Duplication check
        const isDuplicate = items.some(
            item => item.label.toLowerCase() === newItemLabel.trim().toLowerCase() &&
                item.category === newItemCategory
        );

        if (isDuplicate) {
            toast.error("Este item já existe nesta categoria");
            return;
        }

        setIsSaving(true);
        try {
            const { data, error } = await supabase
                .from("checklist_items")
                .insert({
                    label: newItemLabel.trim(),
                    category: newItemCategory,
                    is_optional: true
                })
                .select()
                .single();

            if (error) throw error;

            setItems(prev => [...prev, data as ChecklistItem]);
            setNewItemLabel("");
            toast.success("Item adicionado com sucesso!");
        } catch (error) {
            logger.error("Erro ao adicionar item:", error);
            toast.error("Erro ao salvar o item");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteItem = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este item? Isso não afetará registros históricos, mas ele não aparecerá em novos checklists.")) {
            return;
        }

        setDeletingId(id);
        try {
            const { error } = await supabase
                .from("checklist_items")
                .update({ is_active: false })
                .eq("id", id);

            if (error) throw error;

            setItems(prev => prev.filter(item => item.id !== id));
            toast.success("Item removido com sucesso");
        } catch (error) {
            logger.error("Erro ao remover item:", error);
            toast.error("Erro ao remover o item");
        } finally {
            setDeletingId(null);
        }
    };

    if (authLoading || isLoading) {
        return (
            <MainLayout>
                <div className="max-w-7xl mx-auto flex h-[80vh] flex-col items-center justify-center space-y-6">
                    <Loader2 className="h-12 w-12 animate-spin text-primary opacity-40" />
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Carregando Protocolos</p>
                </div>
            </MainLayout>
        );
    }

    if (!isAuthorized) return null;

    const groupedItems = items.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
    }, {} as Record<string, ChecklistItem[]>);

    // Use dynamicCategories order, but filter to only show categories that have items OR if categories list is explicitly defined
    const categories = dynamicCategories.length > 0 ? dynamicCategories : Object.keys(groupedItems).sort();

    return (
        <MainLayout>
            <div className="max-w-5xl mx-auto space-y-10 pb-24">
                <button
                    onClick={() => navigate("/admin/settings")}
                    className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground hover:text-primary transition-all group"
                >
                    <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                    Voltar para Configurações
                </button>
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                <ClipboardList className="h-4 w-4" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Configurações de Auditoria</span>
                        </div>
                        <h1 className="text-3xl sm:text-5xl font-black tracking-tighter uppercase italic">Gestão do <span className="text-primary not-italic font-light">Protocolo Técnico</span></h1>
                        <p className="text-muted-foreground font-medium text-sm sm:text-base mt-2 opacity-70 italic">Gerencie os requisitos técnicos que compõem o checklist de avaliação.</p>
                    </div>
                </div>

                {/* Categories Management Bar */}
                <div className="glass-card bg-card/20 border-border/10 p-4 sm:p-6 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex-1 flex flex-col sm:flex-row items-center gap-4 w-full">
                        <div className="flex items-center gap-3 shrink-0">
                            <Plus className="h-4 w-4 text-primary" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Nova Categoria Principal</span>
                        </div>
                        <form onSubmit={handleAddCategory} className="flex-1 flex gap-2 w-full">
                            <input
                                type="text"
                                placeholder="Nome da categoria (ex: Elétrica, Hidráulica...)"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                className="flex-1 bg-background/30 border border-border/20 rounded-xl px-4 py-2 text-xs font-bold text-foreground focus:ring-1 focus:ring-primary/40 outline-none transition-all"
                            />
                            <button
                                type="submit"
                                disabled={isSavingCategory}
                                className="h-10 px-6 rounded-xl bg-primary/20 text-primary hover:bg-primary hover:text-primary-foreground font-black uppercase tracking-widest text-[9px] transition-all disabled:opacity-50"
                            >
                                {isSavingCategory ? <Loader2 className="h-3 w-3 animate-spin" /> : "Criar"}
                            </button>
                        </form>
                    </div>

                    <div className="w-px h-8 bg-border/10 hidden sm:block" />

                    <button
                        onClick={() => setIsReordering(!isReordering)}
                        className={cn(
                            "h-10 px-6 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all flex items-center gap-2 border whitespace-nowrap",
                            isReordering
                                ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                                : "bg-card/40 text-muted-foreground border-border/10 hover:border-primary/30 hover:text-primary"
                        )}
                    >
                        {isReordering ? "Concluir Ordenação" : "Reordenar Categorias"}
                    </button>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Form Column */}
                    <div className="space-y-6">
                        <div className="glass-card bg-card/40 border-primary/20 p-6 sm:p-8 space-y-6 sticky top-8">
                            <div className="flex items-center gap-3 border-b border-border/10 pb-4">
                                <Plus className="h-5 w-5 text-primary" />
                                <h3 className="text-sm font-black uppercase tracking-widest">Novo Requisito</h3>
                            </div>

                            <form onSubmit={handleAddItem} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Descrição do Item</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Verificar vedação da porta"
                                        value={newItemLabel}
                                        onChange={(e) => setNewItemLabel(e.target.value)}
                                        className="w-full bg-background/50 border border-border/20 rounded-xl px-4 py-3 text-sm font-bold text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all placeholder:font-medium placeholder:opacity-30"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Categoria Principal</label>
                                    <select
                                        value={newItemCategory}
                                        onChange={(e) => setNewItemCategory(e.target.value)}
                                        className="w-full bg-background border border-border/20 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all cursor-pointer appearance-none shadow-sm"
                                    >
                                        {dynamicCategories.map(cat => (
                                            <option key={cat} value={cat} className="bg-background text-foreground">{cat}</option>
                                        ))}
                                    </select>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Adicionar Requisito
                                </button>
                            </form>

                            <div className="bg-orange-500/5 border border-orange-500/10 rounded-xl p-4 flex gap-3">
                                <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                                <p className="text-[9px] text-muted-foreground font-medium leading-relaxed italic uppercase tracking-tighter">
                                    Novos itens aparecem imediatamente para os técnicos. A exclusão é irreversível para novos registros mas preservada em logs.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* List Column */}
                    <div className="lg:col-span-2 space-y-6">
                        {categories.length === 0 ? (
                            <div className="glass-card flex flex-col items-center justify-center py-20 opacity-40">
                                <ClipboardList className="h-12 w-12 mb-4" />
                                <p className="text-sm font-black uppercase tracking-widest">Nenhum item cadastrado</p>
                            </div>
                        ) : (
                            categories.map((category, index) => (
                                <div key={category} className="space-y-4">
                                    <div className="flex items-center justify-between px-2">
                                        <div className="flex items-center gap-3">
                                            {isReordering && (
                                                <div className="flex items-center gap-1 mr-2">
                                                    <button
                                                        onClick={() => moveCategoryUp(index)}
                                                        disabled={index === 0}
                                                        className="h-6 w-6 rounded-md flex items-center justify-center bg-card/40 border border-border/10 text-muted-foreground hover:text-primary disabled:opacity-20 transition-all font-bold"
                                                    >
                                                        <ChevronUp className="h-3 w-3" />
                                                    </button>
                                                    <button
                                                        onClick={() => moveCategoryDown(index)}
                                                        disabled={index === categories.length - 1}
                                                        className="h-6 w-6 rounded-md flex items-center justify-center bg-card/40 border border-border/10 text-muted-foreground hover:text-primary disabled:opacity-20 transition-all font-bold"
                                                    >
                                                        <ChevronDown className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            )}
                                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary italic">{category}</h3>
                                            {!items.some(i => i.category === category) && (
                                                <button
                                                    onClick={() => handleDeleteCategory(category)}
                                                    className="h-6 w-6 rounded-md flex items-center justify-center text-destructive/40 hover:text-destructive hover:bg-destructive/10 transition-all"
                                                    title="Excluir categoria vazia"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-bold text-muted-foreground opacity-50 uppercase">{groupedItems[category]?.length || 0} itens</span>
                                    </div>

                                    <div className="grid gap-2">
                                        {groupedItems[category] && groupedItems[category].length > 0 ? (
                                            groupedItems[category].map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="glass-card bg-card/20 border-border/10 p-4 rounded-xl flex items-center justify-between group hover:border-primary/20 transition-all"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-8 w-8 rounded-lg bg-foreground/5 flex items-center justify-center">
                                                            <CheckCircle2 className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                                        </div>
                                                        <span className="text-xs sm:text-sm font-bold text-foreground/80 uppercase italic tracking-tight">{item.label}</span>
                                                    </div>

                                                    <button
                                                        onClick={() => handleDeleteItem(item.id)}
                                                        disabled={deletingId === item.id}
                                                        className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                                                        title="Excluir item"
                                                    >
                                                        {deletingId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="py-12 border border-dashed border-border/10 rounded-2xl flex flex-col items-center justify-center opacity-30 grayscale blur-[0.5px] group hover:blur-0 hover:opacity-50 transition-all">
                                                <ShieldAlert className="h-6 w-6 mb-2 text-muted-foreground" />
                                                <p className="text-[10px] font-black uppercase tracking-[0.3em]">Nenhum dado encontrado</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
