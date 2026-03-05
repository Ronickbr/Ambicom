import React, { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
    Plus,
    Search,
    User,
    Loader2,
    AlertCircle,
    X,
    FileDown,
    Download,
    Package,
    Calendar,
    ChevronRight,
    ChevronLeft
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNavigate } from "react-router-dom";
import { Order, Client, Product } from "@/lib/types";

const statusStyles = {
    PENDENTE: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    CONCLUIDO: "bg-green-500/10 text-green-500 border-green-500/20",
    CANCELADO: "bg-red-500/10 text-red-500 border-red-500/20",
};

export default function OrdersPage() {
    const { profile, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const PAGE_SIZE = 20;

    const [showAddModal, setShowAddModal] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
    const [selectedClient, setSelectedClient] = useState("");
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [isFetchingDetails, setIsFetchingDetails] = useState(false);

    const isAuthorized = profile?.role === "GESTOR" || profile?.role === "ADMIN";

    useEffect(() => {
        setPage(0);
    }, [searchTerm]);

    useEffect(() => {
        if (!authLoading && !isAuthorized) {
            toast.error("Acesso restrito");
            navigate("/");
            return;
        }
        if (isAuthorized) {
            const timer = setTimeout(() => {
                fetchOrders();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [authLoading, isAuthorized, navigate, page, searchTerm]);

    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from("orders")
                .select("*, clients!inner(name), order_items(id, products(model))", { count: 'exact' })
                .order("created_at", { ascending: false })
                .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

            if (searchTerm) {
                // Note: Searching on joined tables (clients.name) is tricky in Supabase basic syntax without embedding.
                // We use !inner on clients to filter by client name, OR filter by order ID.
                // However, OR across tables is hard.
                // Simple approach: Search ID only, or use a specific RPC, or just filter by ID for now.
                // Or better: filter on ID OR filter on client name (requires embedding).
                // "id.ilike.%term%,clients.name.ilike.%term%" - this doesn't work easily with joined cols in top level OR.
                // Let's stick to ID search for simplicity, or try to filter on the joined column if possible.
                // Actually, let's search just ID for now to be safe and fast.
                query = query.ilike('id', `%${searchTerm}%`);
            }

            const { data, count, error } = await query;

            if (error) throw error;
            setOrders((data as Order[]) || []);
            setTotalCount(count || 0);
        } catch (error) {
            const err = error as Error;
            console.error("Erro ao buscar pedidos:", err);
            toast.error("Erro ao carregar pedidos", { description: err.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleExportPDF = async (order?: Order) => {
        const { exportToPDF } = await import("@/lib/export-utils");
        if (order) {
            const headers = ["Produto", "S/N Interno", "S/N Original", "Marca"];
            const data = (order.order_items || []).map((item: any) => [
                item.products?.model || "N/A",
                item.products?.internal_serial || "N/A",
                item.products?.original_serial || "N/A",
                item.products?.brand || "N/A"
            ]);
            exportToPDF(`Pedido #${order.id.split("-")[0].toUpperCase()} - ${order.clients?.name}`, headers, data, `pedido_${order.id.split("-")[0]}`);
        } else {
            const headers = ["Pedido ID", "Cliente", "Status", "Data de Criação"];
            const data = orders.map(o => [
                o.id.split("-")[0],
                o.clients?.name || "N/A",
                o.status,
                new Date(o.created_at).toLocaleDateString("pt-BR")
            ]);
            exportToPDF("Relatório de Pedidos - ScanRelatório", headers, data, "pedidos");
        }
    };

    const handleExportExcel = async () => {
        const { exportToExcel } = await import("@/lib/export-utils");
        const data = filteredOrders.map(o => ({
            "ID Pedido": o.id,
            "Cliente": o.clients?.name || "N/A",
            "Status": o.status,
            "Data": new Date(o.created_at).toLocaleString("pt-BR")
        }));
        exportToExcel(data, "pedidos_scan");
    };

    const prepareNewOrder = async () => {
        setShowAddModal(true);
        const { data: cData } = await supabase.from("clients").select("*");
        setClients((cData as Client[]) || []);
        const { data: pData } = await supabase.from("products").select("*").in("status", ["EM ESTOQUE"]);
        setAvailableProducts((pData as Product[]) || []);
    };

    const handleCreateOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClient || selectedProducts.length === 0) {
            toast.error("Selecione um cliente e pelo menos um produto.");
            return;
        }

        setIsSaving(true);
        try {
            const { data: orderData, error: orderError } = await supabase
                .from("orders")
                .insert([{
                    client_id: selectedClient,
                    status: "PENDENTE",
                }])
                .select()
                .single();

            if (orderError) throw orderError;

            const { error: productError } = await supabase
                .from("products")
                .update({
                    order_id: (orderData as Order).id,
                    status: "VENDIDO"
                })
                .in("id", selectedProducts);

            if (productError) throw productError;

            toast.success("Pedido criado com sucesso!", {
                description: `${selectedProducts.length} produtos foram vinculados.`
            });
            setShowAddModal(false);
            setSelectedClient("");
            setSelectedProducts([]);
            fetchOrders();
        } catch (error) {
            const err = error as Error;
            toast.error("Erro ao criar pedido", { description: err.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleViewOrder = async (order: Order) => {
        setSelectedOrder(order);
        setShowDetailsModal(true);
        setIsFetchingDetails(true);
        try {
            const { data, error } = await supabase
                .from("orders")
                .select(`
                    *,
                    clients (*),
                    order_items (
                        id,
                        products (*)
                    )
                `)
                .eq("id", order.id)
                .single();

            if (error) throw error;
            setSelectedOrder(data as Order);
        } catch (error) {
            console.error("Erro ao buscar detalhes do pedido:", error);
            toast.error("Erro ao carregar detalhes do pedido");
        } finally {
            setIsFetchingDetails(false);
        }
    };

    const filteredOrders = orders;

    if (authLoading) return null; // MainLayout gerencia isso

    if (!isAuthorized) return null; // Lógica de redirecionamento no useEffect

    if (isLoading) {
        return (
            <MainLayout>
                <div className="max-w-7xl mx-auto flex h-[60vh] flex-col items-center justify-center space-y-6">
                    <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse" />
                        <Loader2 className="h-10 w-10 animate-spin text-primary relative z-10 opacity-40" />
                    </div>
                    <div className="text-center space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Sincronizando Registros</p>
                        <p className="text-[8px] text-muted-foreground/40 uppercase tracking-widest">Acessando banco de ordens e remessas</p>
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
                                <Package className="h-4 w-4" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Logística & Expedição</span>
                        </div>
                        <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-white uppercase italic">Logística <span className="text-primary not-italic font-light">& Expedição</span></h1>
                        <p className="text-muted-foreground font-medium text-sm mt-1 opacity-70 italic">Gerenciamento de fluxo de saída e ordens de serviço.</p>
                    </div>
                    <button
                        onClick={prepareNewOrder}
                        className="w-full md:w-auto h-12 sm:h-14 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[10px] px-6 sm:px-10 rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-3 whitespace-nowrap"
                    >
                        <Plus className="h-4 w-4" />
                        Novo Pedido
                    </button>
                </div>

                <div className="flex flex-col md:flex-row gap-4 py-2">
                    <div className="relative flex-1 group max-w-2xl w-full">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Pesquisar por ID ou Cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-2xl border border-white/10 bg-neutral-900/50 py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all text-white shadow-inner backdrop-blur-sm"
                        />
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-4 bg-neutral-900/50 border border-white/5 rounded-2xl px-6 py-3 shadow-inner">
                            <Download className="h-5 w-5 text-emerald-500" />
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Faturamento</span>
                                <span className="text-sm font-black text-white">{orders.length} Totais</span>
                            </div>
                        </div>
                        <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/10 shadow-lg">
                            <button
                                onClick={() => handleExportPDF()}
                                className="p-2.5 hover:bg-white/10 rounded-lg text-muted-foreground hover:text-white transition-all active:scale-90"
                                title="Exportar PDF"
                            >
                                <FileDown className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => handleExportExcel()}
                                className="p-2.5 hover:bg-white/10 rounded-lg text-emerald-500 hover:text-emerald-400 transition-all active:scale-90"
                                title="Exportar Excel"
                            >
                                <Download className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {filteredOrders.length > 0 ? (
                    <div className="space-y-4">
                        {/* Desktop Table View */}
                        <div className="hidden md:block glass-card overflow-hidden rounded-2xl border border-white/10 shadow-2xl p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead className="bg-white/5 text-muted-foreground uppercase text-[10px] font-black tracking-widest border-b border-white/5">
                                        <tr>
                                            <th className="px-6 py-5 whitespace-nowrap">Código</th>
                                            <th className="px-6 py-5 whitespace-nowrap">Cliente / Destino</th>
                                            <th className="px-6 py-5 text-center whitespace-nowrap">Status</th>
                                            <th className="px-6 py-5 whitespace-nowrap">Data Estimada</th>
                                            <th className="px-6 py-5 whitespace-nowrap"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredOrders.map((order) => (
                                            <tr
                                                key={order.id}
                                                className="group hover:bg-white/[0.02] transition-all cursor-pointer"
                                                onClick={() => handleViewOrder(order)}
                                            >
                                                <td className="px-6 py-5 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all border border-primary/10">
                                                            <Package className="h-4 w-4" />
                                                        </div>
                                                        <span className="font-mono text-sm font-bold text-white/80 group-hover:text-primary transition-colors">
                                                            #{order.id.split("-")[0].toUpperCase()}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="text-white font-bold text-base leading-tight">{order.clients?.name}</span>
                                                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1 font-bold">Venda Direta</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-center whitespace-nowrap">
                                                    <span className={cn("inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm", statusStyles[order.status as keyof typeof statusStyles])}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 whitespace-nowrap">
                                                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold bg-white/5 w-fit px-3 py-1 rounded-lg border border-white/5 shadow-inner">
                                                        <Calendar className="h-3 w-3 text-primary" />
                                                        {new Date(order.created_at).toLocaleDateString("pt-BR")}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-right whitespace-nowrap">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleViewOrder(order);
                                                        }}
                                                        className="h-10 w-10 flex items-center justify-center text-muted-foreground hover:bg-white/10 rounded-xl transition-all group-hover:text-white hover:scale-110 active:scale-95 border border-transparent hover:border-white/10"
                                                    >
                                                        <ChevronRight className="h-5 w-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile Card View */}
                        <div className="grid grid-cols-1 gap-4 md:hidden">
                            {filteredOrders.map((order) => (
                                <div
                                    key={order.id}
                                    onClick={() => handleViewOrder(order)}
                                    className="glass-card p-5 bg-neutral-900/40 border-white/5 space-y-4 active:scale-[0.98] transition-all"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                                <Package className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Pedido</p>
                                                <p className="text-sm font-mono font-bold text-white tracking-tight">#{order.id.split("-")[0].toUpperCase()}</p>
                                            </div>
                                        </div>
                                        <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border", statusStyles[order.status as keyof typeof statusStyles])}>
                                            {order.status}
                                        </span>
                                    </div>

                                    <div className="pt-2">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-2">Cliente / Destino</p>
                                        <p className="text-lg font-black text-white">{order.clients?.name}</p>
                                    </div>

                                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                        <div className="flex items-center gap-2 text-muted-foreground font-bold">
                                            <Calendar className="h-3.5 w-3.5 text-primary" />
                                            <span className="text-xs">{new Date(order.created_at).toLocaleDateString("pt-BR")}</span>
                                        </div>
                                        <button className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary">
                                            Detalhes <ChevronRight className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-between p-4 border-t border-white/5 bg-neutral-900/50">
                            <span className="text-xs text-muted-foreground font-medium">
                                Mostrando <span className="text-white font-bold">{orders.length}</span> de <span className="text-white font-bold">{totalCount}</span> pedidos
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(0, p - 1))}
                                    disabled={page === 0}
                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="text-xs font-bold text-white px-3 bg-white/5 py-2 rounded-lg border border-white/5">
                                    Página {page + 1}
                                </span>
                                <button
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={(page + 1) * PAGE_SIZE >= totalCount}
                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="glass-card flex flex-col items-center justify-center py-24 text-center border-dashed border-2 border-white/5 bg-white/[0.01]">
                        <div className="h-24 w-24 rounded-full bg-white/5 flex items-center justify-center mb-8 relative shadow-inner">
                            <AlertCircle className="h-12 w-12 text-muted-foreground/20" />
                            <div className="absolute inset-0 rounded-full border border-white/5 animate-pulse" />
                        </div>
                        <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">Sem resultados</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto text-sm leading-relaxed italic opacity-80">
                            {searchTerm ? "Não encontramos nada para sua busca. Tente palavras-chave diferentes." : "O fluxo de faturamento está pronto. Inicie criando um novo pedido de saída."}
                        </p>
                    </div>
                )}

                {/* Modal de Novo Pedido */}
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-500">
                        <div className="glass-card w-full max-w-2xl space-y-6 sm:space-y-8 border-white/10 shadow-2xl p-6 sm:p-10 bg-neutral-900/90 relative overflow-y-auto max-h-[95vh]">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                            <div className="flex items-center justify-between relative">
                                <div className="space-y-1">
                                    <h2 className="text-3xl font-black text-white tracking-tight">Novo Pedido</h2>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-black">Fluxo de Expedição de Inventário</p>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center text-muted-foreground hover:text-white transition-all hover:bg-red-500/20 hover:text-red-500 border border-white/10">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateOrder} className="space-y-8 relative">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1 block">1. Definir Cliente de Destino</label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <select
                                            required
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-10 h-16 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all appearance-none text-white shadow-inner font-bold"
                                            value={selectedClient}
                                            onChange={(e) => setSelectedClient(e.target.value)}
                                        >
                                            <option value="" className="bg-neutral-900 text-muted-foreground">Selecione o cliente / parceiro...</option>
                                            {clients.map(c => (
                                                <option key={c.id} value={c.id} className="bg-neutral-900">{c.name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground opacity-50 group-focus-within:opacity-100 transition-opacity">
                                            <ChevronRight className="h-5 w-5 rotate-90" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between mb-1 ml-1">
                                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">2. Selecionar Itens para Remessa</label>
                                        <span className="text-[10px] font-black px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">{selectedProducts.length} ITENS</span>
                                    </div>
                                    <div className="border border-white/10 rounded-2xl bg-black/40 p-3 max-h-72 overflow-y-auto space-y-2 custom-scrollbar shadow-inner backdrop-blur-sm">
                                        {availableProducts.length > 0 ? availableProducts.map(p => (
                                            <label key={p.id} className={cn("flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer group/item", selectedProducts.includes(p.id) ? "bg-primary/10 border-primary/50 shadow-lg" : "hover:bg-white/5 border-white/5 bg-white/[0.02]")}>
                                                <div className="relative flex items-center justify-center">
                                                    <input
                                                        type="checkbox"
                                                        className="h-6 w-6 rounded-lg border-white/10 bg-white/5 text-primary focus:ring-primary accent-primary cursor-pointer"
                                                        checked={selectedProducts.includes(p.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedProducts([...selectedProducts, p.id]);
                                                            else setSelectedProducts(selectedProducts.filter(id => id !== p.id));
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <p className="font-bold text-sm text-white truncate group-hover/item:text-primary transition-colors">{p.model}</p>
                                                        <span className="font-mono text-[10px] px-2 py-0.5 bg-white/5 rounded text-primary border border-primary/20 font-black uppercase tracking-tighter shadow-sm flex-shrink-0">
                                                            {p.internal_serial}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1 opacity-60">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Liberado Gestor</p>
                                                    </div>
                                                </div>
                                            </label>
                                        )) : (
                                            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 opacity-50">
                                                <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center">
                                                    <Package className="h-8 w-8 text-muted-foreground" />
                                                </div>
                                                <p className="text-xs text-muted-foreground italic leading-relaxed font-medium">Nenhum item disponível no momento.<br />Aguarde a liberação gerencial no inventário.</p>
                                            </div>
                                        )}

                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="submit"
                                        disabled={isSaving || availableProducts.length === 0 || selectedProducts.length === 0}
                                        className="flex-[2] h-16 bg-primary text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:brightness-110 active:scale-95 disabled:grayscale disabled:opacity-50 transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3 border-t border-white/10"
                                    >
                                        {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Download className="h-6 w-6" />}
                                        Finalizar Remessa
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="flex-1 h-16 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Detalhes do Pedido */}
            {showDetailsModal && selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-500">
                    <div className="glass-card w-full max-w-4xl max-h-[95vh] overflow-hidden border-white/10 shadow-2xl bg-neutral-900/90 relative flex flex-col">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                        {/* Modal Header */}
                        <div className="p-6 sm:p-8 border-b border-white/10 flex items-center justify-between shrink-0">
                            <div className="space-y-1">
                                <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                                    Pedido #{selectedOrder.id.split("-")[0].toUpperCase()}
                                    <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border", statusStyles[selectedOrder.status as keyof typeof statusStyles])}>
                                        {selectedOrder.status}
                                    </span>
                                </h2>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-black">Detalhes Completos da Transação</p>
                            </div>
                            <button onClick={() => setShowDetailsModal(false)} className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center text-muted-foreground hover:text-white transition-all hover:bg-red-500/20 hover:text-red-500 border border-white/10">
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 sm:p-8 overflow-y-auto flex-1 custom-scrollbar space-y-10">
                            {isFetchingDetails ? (
                                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Carregando Informações...</p>
                                </div>
                            ) : (
                                <>
                                    {/* Client Info Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] flex items-center gap-2">
                                                <User className="h-3 w-3" />
                                                Dados do Cliente
                                            </h3>
                                            <div className="bg-white/5 rounded-2xl p-6 border border-white/5 space-y-4">
                                                <div>
                                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Nome Completo</p>
                                                    <p className="text-white font-bold text-lg">{(selectedOrder as any).clients?.name || "N/A"}</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                                                    <div>
                                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">CPF/CNPJ</p>
                                                        <p className="text-white font-mono text-sm">{(selectedOrder as any).clients?.tax_id || "N/A"}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Telefone</p>
                                                        <p className="text-white text-sm">{(selectedOrder as any).clients?.phone || "N/A"}</p>
                                                    </div>
                                                </div>
                                                <div className="pt-4 border-t border-white/5">
                                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Endereço</p>
                                                    <p className="text-white text-sm">{(selectedOrder as any).clients?.address || "Não informado"}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] flex items-center gap-2">
                                                <Calendar className="h-3 w-3" />
                                                Informações do Pedido
                                            </h3>
                                            <div className="bg-white/5 rounded-2xl p-6 border border-white/5 space-y-4 h-full">
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div>
                                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Data de Criação</p>
                                                        <p className="text-white font-bold">{new Date(selectedOrder.created_at).toLocaleDateString("pt-BR")}</p>
                                                        <p className="text-[10px] text-muted-foreground">{new Date(selectedOrder.created_at).toLocaleTimeString("pt-BR")}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Última Atualização</p>
                                                        <p className="text-white font-bold">{new Date(selectedOrder.updated_at).toLocaleDateString("pt-BR")}</p>
                                                        <p className="text-[10px] text-muted-foreground">{new Date(selectedOrder.updated_at).toLocaleTimeString("pt-BR")}</p>
                                                    </div>
                                                </div>
                                                <div className="pt-4 border-t border-white/5">
                                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">ID Único (UUID)</p>
                                                    <p className="text-muted-foreground font-mono text-[10px] break-all">{selectedOrder.id}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Products List */}
                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] flex items-center gap-2">
                                            <Package className="h-3 w-3" />
                                            Itens do Pedido ({selectedOrder.order_items?.length || 0})
                                        </h3>
                                        <div className="glass-card rounded-2xl border border-white/5 p-0 overflow-hidden">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-white/5 text-[9px] font-black text-muted-foreground uppercase tracking-widest border-b border-white/5">
                                                    <tr>
                                                        <th className="px-6 py-4">Produto</th>
                                                        <th className="px-6 py-4">S/N Interno</th>
                                                        <th className="px-6 py-4">S/N Original</th>
                                                        <th className="px-6 py-4">Marca</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {selectedOrder.order_items?.map((item: any) => (
                                                        <tr key={item.id} className="hover:bg-white/[0.01]">
                                                            <td className="px-6 py-4 font-bold text-white">{item.products?.model || "N/A"}</td>
                                                            <td className="px-6 py-4 font-mono text-xs text-primary">{item.products?.internal_serial || "N/A"}</td>
                                                            <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{item.products?.original_serial || "N/A"}</td>
                                                            <td className="px-6 py-4 text-xs font-bold uppercase tracking-wider">{item.products?.brand || "N/A"}</td>
                                                        </tr>
                                                    ))}
                                                    {(!selectedOrder.order_items || selectedOrder.order_items.length === 0) && (
                                                        <tr>
                                                            <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground italic">Nenhum item vinculado a este pedido.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 sm:p-8 bg-black/40 border-t border-white/5 flex gap-4 shrink-0">
                            <button
                                onClick={() => handleExportPDF(selectedOrder)}
                                className="flex-1 h-14 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-3 border border-white/10"
                            >
                                <FileDown className="h-5 w-5" />
                                Exportar PDF
                            </button>
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="flex-1 h-14 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20"
                            >
                                Fechar Detalhes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
