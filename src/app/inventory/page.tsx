import React, { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
    Search,
    Filter,
    History as HistoryIcon,
    Box,
    User,
    Loader2,
    AlertCircle,
    X,
    CheckCircle2,
    ClipboardList,
    ShieldCheck,
    Package,
    ArrowUpRight,
    Edit2,
    Trash2,
    FileDown,
    Download,
    Barcode,
    Layers,
    ChevronLeft,
    ChevronRight,
    Activity,
    UserCheck,
    Clock,
    CheckCircle,
    XCircle
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/AuthProvider";
import { Product, ProductLog } from "@/lib/types";

const statusConfig = {
    'CADASTRO': { label: 'Cadastro', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: Clock },
    'EM AVALIAÇÃO': { label: 'Em Avaliação', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: Activity },
    'EM ESTOQUE': { label: 'Em Estoque', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: Box },
    'VENDIDO': { label: 'Vendido', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20', icon: CheckCircle2 },
    'RECUSADO': { label: 'Recusado', color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: XCircle },
};

interface InventoryProduct extends Product {
    orders: {
        id: string;
        clients: {
            name: string;
        };
    } | null;
    product_logs?: ProductLog[];
}

export default function InventoryPage() {
    const { profile } = useAuth();
    const [products, setProducts] = useState<InventoryProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("EM ESTOQUE");
    const [brandFilter, setBrandFilter] = useState("ALL");
    const [voltageFilter, setVoltageFilter] = useState("ALL");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [availableBrands, setAvailableBrands] = useState<string[]>([]);
    const [availableVoltages, setAvailableVoltages] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const PAGE_SIZE = 50;

    // Fetch unique values for filters
    useEffect(() => {
        const fetchFilters = async () => {
            const { data } = await supabase.rpc('get_inventory_filters');
            if (data) {
                const brands = Array.from(new Set(data.map((p: any) => p.brand))).filter(Boolean) as string[];
                const voltages = Array.from(new Set(data.map((p: any) => p.voltage))).filter(Boolean) as string[];
                setAvailableBrands(brands.sort());
                setAvailableVoltages(voltages.sort());
            }
        };
        fetchFilters();
    }, []);

    // Reset page when filters change
    useEffect(() => {
        setPage(0);
    }, [searchTerm, statusFilter, brandFilter, voltageFilter, startDate, endDate]);
    const [selectedProduct, setSelectedProduct] = useState<InventoryProduct | null>(null);
    const [history, setHistory] = useState<ProductLog[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null);
    const [deletingProduct, setDeletingProduct] = useState<InventoryProduct | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Reset page when filters change
    useEffect(() => {
        setPage(0);
    }, [searchTerm, statusFilter]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchInventory();
        }, 500);
        return () => clearTimeout(timer);
    }, [page, searchTerm, statusFilter, brandFilter, voltageFilter, startDate, endDate]);

    const fetchInventory = async () => {
        setIsLoading(true);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000));

        try {
            let query = supabase
                .from("products")
                .select("*, orders(id, clients(name))", { count: 'exact' }) // Remove product_logs(*), keep orders join if needed or remove for perf
                .order("created_at", { ascending: false })
                .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

            if (searchTerm) {
                query = query.or(`brand.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%,internal_serial.ilike.%${searchTerm}%,original_serial.ilike.%${searchTerm}%`);
            }

            if (statusFilter !== "ALL") {
                query = query.eq('status', statusFilter);
            }

            if (brandFilter !== "ALL") {
                query = query.eq('brand', brandFilter);
            }

            if (voltageFilter !== "ALL") {
                query = query.eq('voltage', voltageFilter);
            }

            if (startDate) {
                query = query.gte('created_at', new Date(startDate).toISOString());
            }

            if (endDate) {
                // Set to end of day
                const endOfDay = new Date(endDate);
                endOfDay.setHours(23, 59, 59, 999);
                query = query.lte('created_at', endOfDay.toISOString());
            }

            const result = await Promise.race([
                query,
                timeoutPromise
            ]) as { data: any, count: number, error: any };

            const { data, count, error: fetchError } = result;

            if (fetchError) throw fetchError;

            setProducts((data as InventoryProduct[]) || []);
            setTotalCount(count || 0);
        } catch (error) {
            const err = error as Error;
            toast.error("Erro ao carregar estoque", { description: err.message });
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === products.length && products.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(products.map(p => p.id)));
        }
    };

    const fetchHistory = async (product: InventoryProduct) => {
        setSelectedProduct(product);
        setIsLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from("product_logs")
                .select("*")
                .eq("product_id", product.id)
                .order("created_at", { ascending: false });
            if (error) throw error;
            setHistory((data as ProductLog[]) || []);
        } catch {
            toast.error("Falha ao carregar histórico");
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingProduct) return;
        setIsSaving(true);
        try {
            const { error: updateError } = await supabase
                .from("products")
                .update({
                    brand: editingProduct.brand,
                    model: editingProduct.model,
                    original_serial: editingProduct.original_serial,
                    voltage: editingProduct.voltage,
                })
                .eq("id", editingProduct.id);
            if (updateError) throw updateError;

            // Log the edit
            await supabase
                .from("product_logs")
                .insert({
                    product_id: editingProduct.id,
                    old_status: editingProduct.status,
                    new_status: editingProduct.status,
                    actor_id: profile?.id,
                    data: {
                        action: "EDIT_TECHNICAL_DATA",
                        editor_role: profile?.role,
                        fields_updated: ["brand", "model", "original_serial", "voltage"],
                        timestamp: new Date().toISOString()
                    }
                });

            toast.success("Dados atualizados!");
            setEditingProduct(null);
            fetchInventory();
        } catch (error) {
            const err = error as Error;
            toast.error("Erro na atualização", { description: err.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingProduct) return;
        setIsSaving(true);
        try {
            const { error: deleteError } = await supabase.from("products").delete().eq("id", deletingProduct.id);
            if (deleteError) throw deleteError;
            toast.success("Registro removido.");
            setDeletingProduct(null);
            fetchInventory();
        } catch (error) {
            const err = error as Error;
            toast.error("Erro ao remover", { description: err.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleExport = async (type: 'PDF' | 'EXCEL') => {
        const { exportToPDF, exportToExcel } = await import("@/lib/export-utils");
        if (type === 'PDF') {
            const headers = ["ID", "Marca", "Modelo", "Status", "Serial"];
            const pdfData = products.map(p => [p.internal_serial, p.brand, p.model, p.status, p.original_serial]);
            exportToPDF("Inventário Industrial", headers, pdfData, "estoque");
        } else {
            const data = products.map(p => ({
                ID: p.internal_serial,
                Marca: p.brand,
                Modelo: p.model,
                Status: p.status,
                Original: p.original_serial,
                Cliente: p.orders?.clients?.name || "-"
            }));
            exportToExcel(data, "estoque_industrial");
        }
        toast.info(`Exportação ${type} iniciada`);
    };

    // Products are already filtered by the database query

    const isAuthorized = profile?.role === "GESTOR" || profile?.role === "ADMIN";

    return (
        <MainLayout>
            <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                <Layers className="h-4 w-4" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Intelligence & Assets</span>
                        </div>
                        <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-white uppercase italic leading-none">
                            Controle de <span className="text-primary tracking-normal font-light not-italic">Inventário</span>
                        </h1>
                        <p className="text-muted-foreground font-medium text-[10px] sm:text-sm mt-2 opacity-70 italic px-1">Monitoramento em tempo real de ativos e equipamentos industriais.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-6">
                        <div className="flex items-center gap-4 bg-neutral-900/50 border border-white/5 rounded-2xl px-6 py-3 shadow-inner justify-between sm:justify-start">
                            <Box className="h-5 w-5 text-primary" />
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Total Ativos</span>
                                <span className="text-sm font-black text-white">{products.length} Unidades</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-center bg-white/5 rounded-xl p-1 border border-white/10 shadow-lg">
                            {selectedIds.size > 0 && (
                                <button
                                    onClick={async () => {
                                        const { printLabels } = await import("@/lib/export-utils");
                                        const selectedProducts = products.filter(p => selectedIds.has(p.id));
                                        await printLabels(selectedProducts);
                                    }}
                                    className="h-10 px-4 bg-primary text-white rounded-lg flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-primary/20 animate-in zoom-in mr-1"
                                >
                                    <Barcode className="h-4 w-4" />
                                    Imprimir ({selectedIds.size})
                                </button>
                            )}
                            <button
                                onClick={() => handleExport('PDF')}
                                className="p-2.5 hover:bg-white/10 rounded-lg text-muted-foreground hover:text-white transition-all active:scale-90 flex-1 sm:flex-none flex justify-center"
                                title="Exportar PDF Geral"
                            >
                                <FileDown className="h-5 w-5" />
                            </button>
                            <div className="w-px h-6 bg-white/10 mx-1" />
                            <button
                                onClick={() => handleExport('EXCEL')}
                                className="p-2.5 hover:bg-white/10 rounded-lg text-emerald-500 hover:text-emerald-400 transition-all active:scale-90 flex-1 sm:flex-none flex justify-center"
                                title="Exportar Excel"
                            >
                                <Download className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-neutral-900/40 p-2 rounded-2xl border border-white/5 mx-2 sm:mx-0 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2 relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Rastrear por ID, Marca, Modelo ou Serial..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full h-12 sm:h-14 bg-transparent border-none rounded-xl pl-12 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all text-white"
                            />
                        </div>
                        <div className="relative">
                            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="w-full h-12 sm:h-14 bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all cursor-pointer text-white font-bold"
                            >
                                <option value="ALL" className="bg-neutral-900">Todos os Status</option>
                                {Object.entries(statusConfig).map(([val, conf]) => (
                                    <option key={val} value={val} className="bg-neutral-900">{conf.label}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={cn(
                                "flex items-center justify-center gap-2 h-12 sm:h-14 rounded-xl border transition-all text-xs font-black uppercase tracking-widest",
                                showFilters ? "bg-primary text-white border-primary" : "bg-white/5 border-white/10 text-muted-foreground"
                            )}
                        >
                            <Filter className="h-4 w-4" />
                            {showFilters ? "Ocultar Filtros" : "Mais Filtros"}
                        </button>
                    </div>

                    {showFilters && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border-t border-white/5 animate-in slide-in-from-top-2 duration-300">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Fabricante</label>
                                <select
                                    value={brandFilter}
                                    onChange={e => setBrandFilter(e.target.value)}
                                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all cursor-pointer font-bold"
                                >
                                    <option value="ALL" className="bg-neutral-900">Todas as Marcas</option>
                                    {availableBrands.map(b => (
                                        <option key={b} value={b} className="bg-neutral-900">{b}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Voltagem</label>
                                <select
                                    value={voltageFilter}
                                    onChange={e => setVoltageFilter(e.target.value)}
                                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all cursor-pointer font-bold"
                                >
                                    <option value="ALL" className="bg-neutral-900">Todas as Voltagens</option>
                                    {availableVoltages.map(v => (
                                        <option key={v} value={v} className="bg-neutral-900">{v}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Deste: (Início)</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all cursor-pointer font-bold"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Até: (Fim)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={e => setEndDate(e.target.value)}
                                        className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all cursor-pointer font-bold flex-1"
                                    />
                                    <button
                                        onClick={() => {
                                            setBrandFilter("ALL");
                                            setVoltageFilter("ALL");
                                            setStartDate("");
                                            setEndDate("");
                                            setStatusFilter("ALL");
                                            setSearchTerm("");
                                        }}
                                        className="h-12 w-12 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
                                        title="Limpar Filtros"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {isLoading ? (
                    <div className="h-[40vh] flex flex-col items-center justify-center gap-6">
                        <div className="relative">
                            <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
                            <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Sincronizando Ativos...</p>
                    </div>
                ) : products.length > 0 ? (
                    <div className="space-y-4">
                        <div className="glass-card overflow-hidden border-white/10 shadow-2xl bg-neutral-900/30 p-0 rounded-2xl">
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
                                    <table className="w-full text-left border-collapse min-w-[700px] sm:min-w-full">
                                        <thead className="bg-white/5 text-muted-foreground uppercase text-[9px] sm:text-[10px] font-black tracking-widest border-b border-white/5 sticky top-0 z-30 backdrop-blur-md">
                                            <tr>
                                                <th className="px-4 py-6 text-center w-12">
                                                    <input
                                                        type="checkbox"
                                                        checked={products.length > 0 && selectedIds.size === products.length}
                                                        onChange={toggleSelectAll}
                                                        className="h-4 w-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary/30 cursor-pointer"
                                                    />
                                                </th>
                                                <th className="px-4 sm:px-6 py-4 whitespace-nowrap sticky left-0 bg-neutral-900/95 z-40 border-r border-white/5 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">Equipamento</th>
                                                <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Última Operação</th>
                                                <th className="px-4 sm:px-6 py-4 text-center whitespace-nowrap">Status Lab</th>
                                                <th className="px-4 sm:px-6 py-4 text-right whitespace-nowrap pr-6 sm:pr-10">Controle</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {products.map((p) => {
                                                const config = statusConfig[p.status as keyof typeof statusConfig];
                                                const isSelected = selectedIds.has(p.id);
                                                return (
                                                    <tr
                                                        key={p.id}
                                                        onClick={() => fetchHistory(p)}
                                                        className={cn(
                                                            "group hover:bg-white/[0.03] transition-all cursor-pointer active:bg-white/[0.05]",
                                                            isSelected && "bg-primary/[0.03]"
                                                        )}
                                                    >
                                                        <td className="px-4 py-6 text-center" onClick={e => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => toggleSelect(p.id)}
                                                                className="h-4 w-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary/30 cursor-pointer"
                                                            />
                                                        </td>
                                                        <td className="px-4 sm:px-6 py-4 sm:py-6 whitespace-nowrap sticky left-0 bg-neutral-900/95 group-hover:bg-neutral-800/95 transition-colors z-30 border-r border-white/5 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">
                                                            <div className="flex items-center gap-3 sm:gap-4">
                                                                <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-primary/50 group-hover:bg-primary/5 transition-all shadow-inner shrink-0">
                                                                    <Layers className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="font-black text-white text-sm sm:text-base group-hover:text-primary transition-colors tracking-tight uppercase italic leading-tight truncate max-w-[120px] sm:max-w-none">{p.brand} {p.model}</p>
                                                                    <div className="flex items-center gap-2 mt-0.5 sm:mt-1">
                                                                        <span className="text-[8px] sm:text-[9px] font-black text-primary uppercase tracking-widest bg-primary/5 px-1 sm:px-1.5 py-0.5 rounded border border-primary/10 shadow-sm shrink-0">{p.voltage || "BIVOLT"}</span>
                                                                        <span className="text-[8px] sm:text-[9px] font-mono text-muted-foreground/60 uppercase truncate">S/N: {p.internal_serial}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 sm:px-6 py-4 sm:py-6 whitespace-nowrap">
                                                            <div className="flex flex-col">
                                                                <span className="text-white font-bold text-[10px] sm:text-xs uppercase italic tracking-tight">{new Date(p.updated_at).toLocaleDateString('pt-BR')}</span>
                                                                <span className="text-[8px] sm:text-[9px] text-muted-foreground/40 uppercase font-black">{new Date(p.updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 sm:px-6 py-4 sm:py-6 text-center whitespace-nowrap">
                                                            {config && (
                                                                <div className={cn(
                                                                    "inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider border shadow-sm",
                                                                    config.color
                                                                )}>
                                                                    <config.icon className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                                                                    {config.label}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 sm:px-6 py-4 sm:py-6 text-right whitespace-nowrap pr-6 sm:pr-10" onClick={e => e.stopPropagation()}>
                                                            <div className="flex items-center justify-end gap-1 sm:gap-2">
                                                                <button
                                                                    onClick={() => fetchHistory(p)}
                                                                    className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center rounded-lg sm:rounded-xl bg-white/5 text-muted-foreground hover:bg-primary/20 hover:text-primary transition-all border border-white/10 shadow-inner group/btn"
                                                                    title="Detalhes e Histórico"
                                                                >
                                                                    <HistoryIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover/btn:scale-110 transition-transform" />
                                                                </button>
                                                                {isAuthorized && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => setEditingProduct({ ...p })}
                                                                            className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center rounded-lg sm:rounded-xl bg-white/5 text-muted-foreground hover:bg-white hover:text-black transition-all border border-white/10 shadow-inner group/btn"
                                                                            title="Editar Ativo"
                                                                        >
                                                                            <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover/btn:scale-110 transition-transform" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setDeletingProduct(p)}
                                                                            className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center rounded-lg sm:rounded-xl bg-white/5 text-muted-foreground hover:bg-red-500/20 hover:text-red-500 transition-all border border-white/10 shadow-inner group/btn"
                                                                            title="Remover Registro"
                                                                        >
                                                                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover/btn:scale-110 transition-transform" />
                                                                        </button>
                                                                    </>
                                                                )}
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

                        <div className="flex items-center justify-between p-4 border border-white/5 rounded-2xl bg-neutral-900/50 shadow-lg">
                            <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                                Mostrando <span className="text-white font-bold">{products.length}</span> de <span className="text-white font-bold">{totalCount}</span> registros
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(0, p - 1))}
                                    disabled={page === 0}
                                    className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-white/5"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="text-[10px] font-black text-white px-4 bg-white/5 h-10 flex items-center rounded-xl border border-white/5 uppercase tracking-widest">
                                    Pág {page + 1}
                                </span>
                                <button
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={(page + 1) * PAGE_SIZE >= totalCount}
                                    className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-white/5"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-[50vh] flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-white/5 rounded-[3rem] bg-white/[0.01] relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Box className="h-20 w-20 text-white/5 mb-8 animate-bounce transition-all duration-1000" />
                        <h3 className="text-3xl font-black uppercase tracking-tighter text-white">Nenhum Registro Localizado</h3>
                        <p className="text-muted-foreground italic text-sm mt-3 max-w-sm mx-auto leading-relaxed">
                            {searchTerm ? "O filtro atual não retornou resultados aproximados. Tente simplificar sua pesquisa." : "Sua base de inventário está vazia. Inicie cadastrando novos equipamentos."}
                        </p>
                    </div>
                )}                          {/* Modal de Edição */}
                {editingProduct && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
                        <div className="glass-card w-full max-w-xl p-6 sm:p-10 border-white/10 shadow-4xl space-y-6 sm:space-y-10 bg-neutral-900 relative overflow-y-auto max-h-[95vh]">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />

                            <div className="flex justify-between items-start relative z-10">
                                <div>
                                    <h2 className="text-4xl font-black uppercase tracking-tighter text-white mb-1">Atualizar Ativo</h2>
                                    <p className="text-[10px] font-black text-primary tracking-[0.4em] uppercase opacity-80">{editingProduct.internal_serial}</p>
                                </div>
                                <button onClick={() => setEditingProduct(null)} className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-neutral-800 transition-all border border-white/10 text-white shadow-lg"><X className="h-6 w-6" /></button>
                            </div>

                            <form onSubmit={handleUpdate} className="space-y-6 relative z-10">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Fabricante / Marca</label>
                                        <input
                                            required
                                            className="w-full h-15 bg-white/5 border border-white/10 rounded-2xl px-5 text-white focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none shadow-inner font-bold transition-all"
                                            value={editingProduct.brand || ""}
                                            onChange={e => setEditingProduct({ ...editingProduct, brand: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Modelo Comercial</label>
                                        <input
                                            required
                                            className="w-full h-15 bg-white/5 border border-white/10 rounded-2xl px-5 text-white focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none shadow-inner font-bold transition-all"
                                            value={editingProduct.model || ""}
                                            onChange={e => setEditingProduct({ ...editingProduct, model: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Número de Serial Original</label>
                                    <input
                                        required
                                        className="w-full h-15 bg-white/5 border border-white/10 rounded-2xl px-5 text-primary font-mono font-black focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none shadow-inner transition-all tracking-widest"
                                        value={editingProduct.original_serial || ""}
                                        onChange={e => setEditingProduct({ ...editingProduct, original_serial: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-6">
                                    <button
                                        type="button"
                                        onClick={() => setEditingProduct(null)}
                                        className="h-16 rounded-2xl border border-white/10 text-muted-foreground font-black uppercase tracking-widest text-[10px] hover:bg-white/5 hover:text-white transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        disabled={isSaving}
                                        className="h-16 rounded-2xl bg-primary text-white hover:bg-primary/90 font-black uppercase tracking-widest text-[10px] transition-all disabled:opacity-50 shadow-xl shadow-primary/20 border-t border-white/20 flex items-center justify-center gap-3"
                                    >
                                        {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                                        Salvar Alterações
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Modal de Exclusão */}
                {deletingProduct && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-6 bg-black/98 backdrop-blur-3xl animate-in zoom-in-95 duration-300">
                        <div className="glass-card w-full max-w-md p-8 sm:p-12 border-red-500/30 shadow-4xl text-center space-y-8 sm:space-y-10 bg-neutral-950 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent" />
                            <div className="h-24 w-24 rounded-3xl bg-red-500/10 flex items-center justify-center mx-auto ring-8 ring-red-500/5 rotate-12 group-hover:rotate-0 transition-transform"><AlertCircle className="h-12 w-12 text-red-500" /></div>
                            <div className="space-y-4">
                                <h2 className="text-3xl font-black uppercase tracking-tighter text-white">Excluir Permanente?</h2>
                                <p className="text-sm text-muted-foreground italic leading-relaxed px-4 opacity-70">
                                    Esta ação é irreversível e irá apagar todos os vínculos e logs do ativo <span className="text-white font-black underline decoration-red-500/50 underline-offset-4">{deletingProduct.internal_serial}</span>.
                                </p>
                            </div>
                            <div className="flex flex-col gap-4">
                                <button
                                    onClick={handleDelete}
                                    disabled={isSaving}
                                    className="h-16 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-red-500/30 transition-all active:scale-95 flex items-center justify-center gap-3"
                                >
                                    {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
                                    Confirmar Destruição
                                </button>
                                <button
                                    onClick={() => setDeletingProduct(null)}
                                    className="h-12 text-muted-foreground hover:text-white font-black text-[10px] uppercase transition-all tracking-[0.3em]"
                                >
                                    Manter Registro Seguro
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Detalhes do Produto & Histórico */}
                {selectedProduct && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
                        <div className="glass-card w-full max-w-5xl p-6 sm:p-10 border-white/10 shadow-5xl max-h-[95vh] flex flex-col bg-neutral-900 absolute overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />

                            <div className="flex justify-between items-start mb-8 relative z-10">
                                <div className="flex gap-4 sm:gap-6 items-center">
                                    <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner">
                                        <Box className="h-6 w-6 sm:h-9 sm:w-9" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter text-white leading-none mb-1">
                                            {selectedProduct.brand} {selectedProduct.model}
                                        </h2>
                                        <div className="flex items-center gap-3">
                                            <p className="text-[9px] sm:text-[10px] font-black text-primary tracking-[0.3em] uppercase opacity-70">Rastreabilidade Terminal • {selectedProduct.internal_serial}</p>
                                            <div className={cn(
                                                "px-2 py-0.5 rounded text-[8px] font-bold uppercase border",
                                                statusConfig[selectedProduct.status as keyof typeof statusConfig]?.color || "border-white/10 text-white"
                                            )}>
                                                {selectedProduct.status}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isAuthorized && (
                                        <div className="hidden sm:flex items-center gap-2 mr-4">
                                            <button
                                                onClick={() => {
                                                    setEditingProduct({ ...selectedProduct });
                                                }}
                                                className="h-10 px-4 rounded-xl bg-white/5 text-xs font-bold hover:bg-white/10 transition-all border border-white/10 text-white"
                                            >
                                                Editar Ativo
                                            </button>
                                        </div>
                                    )}
                                    <button onClick={() => setSelectedProduct(null)} className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-neutral-800 transition-all border border-white/10 text-white shadow-lg">
                                        <X className="h-5 w-5 sm:h-6 sm:w-6" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 sm:pr-6 space-y-8 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-primary/30 transition-colors relative z-10">
                                {/* Photos Section */}
                                <div className="mb-8">
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Evidência Fotográfica</p>
                                        <div className="aspect-video sm:aspect-[21/9] rounded-2xl bg-black/40 border border-white/5 overflow-hidden group relative">
                                            {selectedProduct.photo_product || selectedProduct.photo_model || selectedProduct.photo_serial || selectedProduct.photo_defect ? (
                                                <img
                                                    src={(selectedProduct.photo_product || selectedProduct.photo_model || selectedProduct.photo_serial || selectedProduct.photo_defect) ?? undefined}
                                                    alt="Produto"
                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full opacity-10">
                                                    <Box className="h-12 w-12 mb-2" />
                                                    <span className="text-[10px] font-black uppercase">Imagem não disponível</span>
                                                </div>
                                            )}
                                            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent translate-y-full group-hover:translate-y-0 transition-transform">
                                                <p className="text-[10px] font-black text-white uppercase tracking-wider italic">Registro de Conferência Terminal</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Grid de Dados e Checklist */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">

                                    {/* Coluna 1: Dados Técnicos */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Especificações Atuais</h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { label: "Voltagem", value: selectedProduct.voltage, icon: Package },
                                                { label: "Gás Refrig.", value: selectedProduct.refrigerant_gas, icon: Layers },
                                                { label: "Carga Gás", value: selectedProduct.gas_charge, icon: Layers },
                                                { label: "Compressor", value: selectedProduct.compressor, icon: Box },
                                                { label: "Frequência", value: selectedProduct.frequency, icon: Activity },
                                                { label: "Cor Ativo", value: selectedProduct.color, icon: Edit2 },
                                                { label: "PNC / ML", value: selectedProduct.pnc_ml, icon: Barcode },
                                                { label: "Fabricação", value: selectedProduct.manufacturing_date ? new Date(selectedProduct.manufacturing_date).toLocaleDateString() : "-", icon: ChevronRight },
                                            ].map((spec, i) => (
                                                <div key={i} className="bg-white/[0.03] p-3 rounded-xl border border-white/5 group hover:border-primary/20 transition-all">
                                                    <span className="text-[8px] font-black text-muted-foreground uppercase block mb-1">{spec.label}</span>
                                                    <span className="text-[10px] font-bold text-white uppercase truncate">{spec.value || "N/A"}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Coluna 2: Último Laudo Técnico / Checklist */}
                                    <div className="space-y-6 lg:border-x lg:border-white/5 lg:px-8">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Resultados de Triagem</h3>
                                        </div>

                                        {/* Tenta encontrar o log do técnico mais recente */}
                                        {(() => {
                                            const techLog = history.find(l => l.new_status === 'TECNICO' || l.data?.checklist);
                                            if (!techLog || !techLog.data?.checklist) {
                                                return (
                                                    <div className="h-32 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl opacity-40">
                                                        <ClipboardList className="h-6 w-6 mb-2" />
                                                        <span className="text-[9px] font-bold uppercase tracking-wider text-center px-4">Sem dados de checklist disponíveis</span>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="space-y-4">
                                                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin">
                                                        {Object.entries(techLog.data.checklist).map(([key, val]) => (
                                                            <div key={key} className={cn(
                                                                "p-3 rounded-xl border flex items-center justify-between transition-all",
                                                                val ? "bg-emerald-500/5 text-emerald-500 border-emerald-500/10" : "bg-red-500/5 text-red-500 border-red-500/10"
                                                            )}>
                                                                <span className="text-[10px] font-black uppercase tracking-tight">
                                                                    {techLog.data?.checklist_labels?.[key] || key}
                                                                </span>
                                                                <div className={cn(
                                                                    "px-2 py-0.5 rounded text-[8px] font-black uppercase",
                                                                    val ? "bg-emerald-500/20" : "bg-red-500/20"
                                                                )}>
                                                                    {val ? "OK" : "FALHA"}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {techLog.data?.observations && (
                                                        <div className="mt-4 p-4 rounded-xl bg-neutral-950 border border-white/5 italic">
                                                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                                                                &ldquo;{techLog.data.observations}&rdquo;
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Coluna 3: Linha do Tempo de Movimentações */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(14,165,233,0.5)]" />
                                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Histórico de Fluxo</h3>
                                        </div>

                                        <div className="relative pl-6 border-l border-white/10 space-y-8">
                                            {history.map((log, i) => (
                                                <div key={log.id} className="relative group/log">
                                                    <div className={cn(
                                                        "absolute -left-[1.95rem] top-1 h-3 w-3 rounded-full border-2 bg-neutral-900 z-10 transition-all group-hover/log:scale-125",
                                                        i === 0 ? "border-primary shadow-[0_0_8px_rgba(14,165,233,0.5)]" : "border-white/20"
                                                    )} />
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between gap-4">
                                                            <span className="text-[10px] font-black text-white uppercase tracking-tight truncate">
                                                                {i === 0 ? "Status Atual: " : "Alterado para: "}
                                                                <span className="text-primary">{log.new_status}</span>
                                                            </span>
                                                            <span className="text-[8px] font-bold text-muted-foreground opacity-40 whitespace-nowrap">
                                                                {new Date(log.created_at).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <p className="text-[9px] text-muted-foreground/60 leading-tight">
                                                            Ponto de controle registrado via sistema terminal.
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}

                                            {history.length === 0 && !isLoadingHistory && (
                                                <div className="flex flex-col items-center py-10 opacity-20">
                                                    <HistoryIcon className="h-8 w-8 mb-2" />
                                                    <span className="text-[9px] font-black uppercase">Sem registros</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
