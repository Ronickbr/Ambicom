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
    ChevronLeft,
    ShieldCheck,
    Ban,
    Check,
    Barcode,
    Camera
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNavigate } from "react-router-dom";
import Webcam from "react-webcam";
import { useScan } from "@/hooks/useScan";
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
    const [scanInput, setScanInput] = useState("");
    const [verifiedSerials, setVerifiedSerials] = useState<string[]>([]);
    const scannerRef = React.useRef<HTMLInputElement>(null);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [isFetchingDetails, setIsFetchingDetails] = useState(false);

    // Camera Scanning States
    const { scanImage, ocrLoading } = useScan();
    const webcamRef = React.useRef<Webcam>(null);
    const [showCamera, setShowCamera] = useState(false);

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
        const { data: pData } = await supabase.from("products").select("*").eq("status", "EM ESTOQUE").is("order_id", null);
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

            // 2. Link products to order in products table (optional, but code uses it)
            const { error: productError } = await supabase
                .from("products")
                .update({
                    order_id: (orderData as Order).id
                })
                .in("id", selectedProducts);

            if (productError) throw productError;

            // 3. Insert into order_items table (required for details view)
            const orderItems = selectedProducts.map(productId => ({
                order_id: (orderData as Order).id,
                product_id: productId
            }));

            const { error: itemsError } = await supabase
                .from("order_items")
                .insert(orderItems);

            if (itemsError) throw itemsError;

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
        setVerifiedSerials([]);
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

            // Auto-focus scanner input
            setTimeout(() => scannerRef.current?.focus(), 500);
        } catch (error) {
            console.error("Erro ao buscar detalhes do pedido:", error);
            toast.error("Erro ao carregar detalhes do pedido");
        } finally {
            setIsFetchingDetails(false);
        }
    };

    const handleCaptureToVerify = async () => {
        if (!webcamRef.current) return;
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;

        toast.info("Analisando etiqueta...");
        const data = await scanImage(imageSrc);

        if (data) {
            // Check both internal serial and original serial
            const serialToCheck = (data.internal_serial || data.numero_serie || "").toUpperCase();

            if (!serialToCheck) {
                toast.error("Não foi possível identificar o serial na etiqueta.");
                return;
            }

            const foundItem = selectedOrder?.order_items?.find(
                item => item.products?.internal_serial?.toUpperCase() === serialToCheck ||
                    item.products?.original_serial?.toUpperCase() === serialToCheck
            );

            if (foundItem) {
                const internal = foundItem.products?.internal_serial?.toUpperCase() || "";
                if (verifiedSerials.includes(internal)) {
                    toast.warning("Produto já conferido!");
                } else {
                    setVerifiedSerials(prev => [...prev, internal]);
                    toast.success("Produto conferido via Câmera!", {
                        description: foundItem.products?.model || "Item validado"
                    });
                    setShowCamera(false);
                }
            } else {
                toast.error(`Serial ${serialToCheck} não pertence a este pedido!`);
            }
        }
    };

    const handleScanProduct = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOrder || !scanInput) return;

        const input = scanInput.trim().toUpperCase();

        // Find if this serial exists in the order
        const foundItem = selectedOrder.order_items?.find(
            item => item.products?.internal_serial?.toUpperCase() === input
        );

        if (foundItem) {
            if (verifiedSerials.includes(input)) {
                toast.warning("Produto já conferido!");
            } else {
                setVerifiedSerials(prev => [...prev, input]);
                toast.success("Produto conferido!", {
                    description: foundItem.products?.model || "Item validado"
                });
            }
        } else {
            toast.error("Produto não pertence a este pedido!");
        }

        setScanInput("");
        scannerRef.current?.focus();
    };

    const handleCancelOrder = async (order: Order) => {
        if (!confirm("Deseja realmente cancelar este pedido? Os produtos voltarão ao estoque.")) return;

        setIsSaving(true);
        try {
            // 1. Update order status
            const { error: orderError } = await supabase
                .from("orders")
                .update({ status: "CANCELADO" })
                .eq("id", order.id);

            if (orderError) throw orderError;

            // 2. Fetch product IDs from this order to clear order_id
            // We can do this via products table directly where order_id = order.id
            const { error: productError } = await supabase
                .from("products")
                .update({ order_id: null })
                .eq("order_id", order.id);

            if (productError) throw productError;

            toast.warning("Pedido cancelado com sucesso!");
            setShowDetailsModal(false);
            fetchOrders();
        } catch (error) {
            toast.error("Erro ao cancelar pedido");
        } finally {
            setIsSaving(false);
        }
    };

    const handleFinalizeOrder = async (order: Order) => {
        // Enforce verification for PENDENTE orders
        const totalItems = order.order_items?.length || 0;
        if (verifiedSerials.length < totalItems) {
            toast.error("Conferência incompleta!", {
                description: `Faltam ${totalItems - verifiedSerials.length} produtos para conferir via scanner.`
            });
            return;
        }

        setIsSaving(true);
        try {
            // 1. Update order status
            const { error: orderError } = await supabase
                .from("orders")
                .update({ status: "CONCLUIDO" })
                .eq("id", order.id);

            if (orderError) throw orderError;

            // 2. Fetch product IDs from this order to update status
            const productIds = order.order_items?.map(item => item.products?.id).filter(Boolean);

            if (productIds && productIds.length > 0) {
                const { error: productError } = await supabase
                    .from("products")
                    .update({ status: "VENDIDO" })
                    .in("id", productIds);
                if (productError) throw productError;
            }

            toast.success("Pedido finalizado!", {
                description: `${productIds?.length || 0} produtos marcados como vendidos.`
            });
            setShowDetailsModal(false);
            fetchOrders();
        } catch (error) {
            const err = error as Error;
            toast.error("Erro ao finalizar pedido", { description: err.message });
        } finally {
            setIsSaving(false);
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
                                    <table className="w-full text-left text-sm border-collapse min-w-[800px] sm:min-w-full">
                                        <thead className="bg-white/5 text-muted-foreground uppercase text-[9px] sm:text-[10px] font-black tracking-widest border-b border-white/5 sticky top-0 z-30 backdrop-blur-md">
                                            <tr>
                                                <th className="px-4 sm:px-6 py-5 whitespace-nowrap sticky left-0 bg-neutral-900/95 z-40 border-r border-white/5 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">Código / OS</th>
                                                <th className="px-4 sm:px-6 py-5 whitespace-nowrap">Cliente / Destino</th>
                                                <th className="px-4 sm:px-6 py-5 text-center whitespace-nowrap">Status</th>
                                                <th className="px-4 sm:px-6 py-5 whitespace-nowrap">Data Registro</th>
                                                <th className="px-4 sm:px-6 py-5 text-right whitespace-nowrap pr-6 sm:pr-10">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {filteredOrders.map((order) => (
                                                <tr
                                                    key={order.id}
                                                    className="group hover:bg-white/[0.02] transition-all cursor-pointer"
                                                    onClick={() => handleViewOrder(order)}
                                                >
                                                    <td className="px-4 sm:px-6 py-5 whitespace-nowrap sticky left-0 bg-neutral-900/95 group-hover:bg-neutral-800/95 transition-colors z-30 border-r border-white/5 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all border border-primary/10">
                                                                <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                            </div>
                                                            <span className="font-mono text-xs sm:text-sm font-black text-white/80 group-hover:text-primary transition-colors">
                                                                #{order.id.split("-")[0].toUpperCase()}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                                                        <div className="flex flex-col">
                                                            <span className="text-white font-black text-[13px] sm:text-base leading-tight uppercase italic transition-colors group-hover:text-primary">{(order as any).clients?.name || "N/A"}</span>
                                                            <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5 font-black opacity-60">Venda Direta</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 sm:px-6 py-5 text-center whitespace-nowrap">
                                                        <span className={cn("inline-flex px-2 sm:px-3 py-1 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-wider border shadow-sm", statusStyles[order.status as keyof typeof statusStyles])}>
                                                            {order.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                                                        <div className="flex items-center gap-2 text-muted-foreground text-[10px] sm:text-xs font-black bg-white/5 w-fit px-2 sm:px-3 py-1 sm:py-1 rounded-lg border border-white/5 shadow-inner uppercase tracking-tighter sm:tracking-normal">
                                                            <Calendar className="h-3 w-3 text-primary opacity-60" />
                                                            {new Date(order.created_at).toLocaleDateString("pt-BR")}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 sm:px-6 py-5 text-right whitespace-nowrap pr-6 sm:pr-10">
                                                        <div className="flex items-center justify-end gap-2 sm:gap-3">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleExportPDF(order);
                                                                }}
                                                                className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center text-muted-foreground hover:bg-white/10 rounded-xl transition-all hover:text-white border border-transparent hover:border-white/10"
                                                                title="Exportar PDF"
                                                            >
                                                                <FileDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleViewOrder(order);
                                                                }}
                                                                className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center text-muted-foreground hover:bg-primary rounded-lg sm:rounded-xl transition-all group-hover:text-white hover:scale-110 active:scale-95 border border-transparent hover:border-primary/10 shadow-lg"
                                                            >
                                                                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
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
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] flex items-center gap-2">
                                                <Package className="h-3 w-3" />
                                                Itens do Pedido ({selectedOrder.order_items?.length || 0})
                                            </h3>
                                            {selectedOrder.status === "PENDENTE" && (
                                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                                    Conferência: {verifiedSerials.length} de {selectedOrder.order_items?.length || 0}
                                                </span>
                                            )}
                                        </div>

                                        {selectedOrder.status === "PENDENTE" && (
                                            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 sm:p-6 space-y-4">
                                                <div className="flex flex-col sm:flex-row items-center gap-4">
                                                    <button
                                                        onClick={() => setShowCamera(!showCamera)}
                                                        className={cn(
                                                            "h-14 w-full sm:w-14 rounded-2xl flex items-center justify-center transition-all border shrink-0",
                                                            showCamera ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                                                        )}
                                                    >
                                                        {showCamera ? <X className="h-6 w-6" /> : <Camera className="h-6 w-6" />}
                                                    </button>
                                                    <div className="flex-1 w-full">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2 italic">Aguardando Conferência de ID Interno...</p>
                                                        <form onSubmit={handleScanProduct} className="relative">
                                                            <input
                                                                ref={scannerRef}
                                                                type="text"
                                                                value={scanInput}
                                                                onChange={(e) => setScanInput(e.target.value)}
                                                                placeholder="Escaneie ou digite o ID Interno..."
                                                                className="w-full h-14 bg-black/40 border border-white/10 rounded-xl px-6 text-sm text-white placeholder:text-muted-foreground/30 focus:border-primary/50 transition-all outline-none"
                                                            />
                                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:block">
                                                                <span className="text-[8px] font-bold text-muted-foreground/30 bg-white/5 px-2 py-1 rounded">ENTER</span>
                                                            </div>
                                                        </form>
                                                    </div>
                                                </div>

                                                {showCamera && (
                                                    <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-white/10 animate-in fade-in zoom-in-95 duration-300">
                                                        <Webcam
                                                            ref={webcamRef}
                                                            audio={false}
                                                            screenshotFormat="image/jpeg"
                                                            videoConstraints={{ facingMode: "environment" }}
                                                            className="w-full h-full object-cover"
                                                        />
                                                        <div className="absolute inset-0 border-2 border-primary/30 m-8 rounded-lg pointer-events-none">
                                                            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                                                            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                                                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                                                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                                                        </div>
                                                        <div className="absolute bottom-4 left-0 right-0 flex justify-center px-4">
                                                            <button
                                                                onClick={handleCaptureToVerify}
                                                                disabled={ocrLoading}
                                                                className="w-full max-w-xs h-12 bg-primary hover:bg-primary/90 text-white rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 transition-all shadow-xl disabled:opacity-50"
                                                            >
                                                                {ocrLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                                                                {ocrLoading ? "Validando..." : "Capturar e Validar"}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="glass-card rounded-2xl border border-white/5 p-0 overflow-hidden">
                                            <div className="relative group/table" data-scroll="right">
                                                {/* Horizontal Scroll Indicators */}
                                                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#0a0a0a] to-transparent z-20 pointer-events-none opacity-0 group-has-[[data-scroll='left']]:opacity-100 group-has-[[data-scroll='both']]:opacity-100 transition-opacity" />
                                                <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent z-20 pointer-events-none opacity-0 group-has-[[data-scroll='right']]:opacity-100 group-has-[[data-scroll='both']]:opacity-100 transition-opacity" />

                                                <div
                                                    className="overflow-x-auto scrollbar-hide border border-white/5 rounded-2xl"
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
                                                        <thead className="bg-white/5 text-[9px] font-black text-muted-foreground uppercase tracking-widest border-b border-white/5">
                                                            <tr>
                                                                <th className="px-4 sm:px-6 py-4 sticky left-0 bg-neutral-900 z-30 border-r border-white/5 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">Produto</th>
                                                                <th className="px-4 sm:px-6 py-4">ID Interno</th>
                                                                <th className="px-4 sm:px-6 py-4">S/N Original</th>
                                                                <th className="px-4 sm:px-6 py-4">Marca</th>
                                                                <th className="px-4 sm:px-6 py-4 text-right">Conferência</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-white/5">
                                                            {selectedOrder.order_items?.map((item: any) => {
                                                                const isVerified = verifiedSerials.includes(item.products?.internal_serial?.toUpperCase());
                                                                return (
                                                                    <tr key={item.id} className={cn("transition-colors", isVerified ? "bg-emerald-500/5" : "hover:bg-white/[0.01]")}>
                                                                        <td className="px-4 sm:px-6 py-4 font-black text-white italic uppercase sticky left-0 bg-neutral-900 group-hover:bg-neutral-800 transition-colors z-20 border-r border-white/5 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">{item.products?.model || "N/A"}</td>
                                                                        <td className="px-4 sm:px-6 py-4 font-mono text-[10px] sm:text-xs text-primary font-black uppercase tracking-widest">{item.products?.internal_serial || "N/A"}</td>
                                                                        <td className="px-4 sm:px-6 py-4 font-mono text-[10px] sm:text-xs text-muted-foreground/40">{item.products?.original_serial || "N/A"}</td>
                                                                        <td className="px-4 sm:px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{item.products?.brand || "N/A"}</td>
                                                                        <td className="px-4 sm:px-6 py-4 text-right whitespace-nowrap">
                                                                            {isVerified ? (
                                                                                <span className="inline-flex items-center gap-1.5 text-emerald-500 font-black text-[9px] uppercase tracking-wider bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                                                                                    <Check className="h-3 w-3" /> CONFIRMADO
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-muted-foreground/20 font-black text-[9px] uppercase tracking-widest italic flex items-center justify-end gap-2">
                                                                                    <div className="h-1 w-1 rounded-full bg-muted-foreground/20 animate-pulse" />
                                                                                    Pendente
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                            {(!selectedOrder.order_items || selectedOrder.order_items.length === 0) && (
                                                                <tr>
                                                                    <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground italic">Nenhum item vinculado a este pedido.</td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 sm:p-8 bg-black/40 border-t border-white/5 flex flex-col sm:flex-row gap-4 shrink-0">
                            <button
                                onClick={() => handleExportPDF(selectedOrder)}
                                className="flex-1 h-14 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-3 border border-white/10"
                            >
                                <FileDown className="h-5 w-5" />
                                Exportar PDF
                            </button>

                            {selectedOrder.status === "PENDENTE" && (
                                <button
                                    onClick={() => handleFinalizeOrder(selectedOrder)}
                                    disabled={isSaving}
                                    className="flex-[2] h-14 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-3 disabled:grayscale disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                                    {verifiedSerials.length < (selectedOrder.order_items?.length || 0) ? `Faltam ${(selectedOrder.order_items?.length || 0) - verifiedSerials.length} Itens` : "Finalizar envio do pedido"}
                                </button>
                            )}

                            {selectedOrder.status === "PENDENTE" && (
                                <button
                                    onClick={() => handleCancelOrder(selectedOrder)}
                                    disabled={isSaving}
                                    className="flex-1 h-14 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border border-red-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    <Ban className="h-5 w-5" />
                                    Cancelar Envio
                                </button>
                            )}

                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="flex-1 h-14 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all"
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
