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
    XCircle,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Move,
    Camera
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { handleError } from "@/lib/errors";

import { useAuth } from "@/components/providers/AuthProvider";
import { Product, ProductLog } from "@/lib/types";
import { calculateProductSize, formatTotalVolume } from "@/lib/product-utils";

const statusConfig = {
    'CADASTRO': { label: 'Cadastro', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: Clock },
    'EM AVALIAÇÃO': { label: 'Em Avaliação', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: Activity },
    'EM ESTOQUE': { label: 'Em Estoque', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: Box },
    'VENDIDO': { label: 'Vendido', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20', icon: CheckCircle2 },
    'REPROVADO': { label: 'Reprovado', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20', icon: AlertCircle },
};

interface InventoryProduct extends Product {
    orders: ({
        id: string;
        clients: {
            name: string;
        };
    } | {
        id: string;
        clients: {
            name: string;
        };
    }[]) | null;
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
    const [typeFilter, setTypeFilter] = useState("ALL");
    const [classFilter, setClassFilter] = useState("ALL");
    const [gasFilter, setGasFilter] = useState("ALL");
    const [availableBrands, setAvailableBrands] = useState<string[]>([]);
    const [availableVoltages, setAvailableVoltages] = useState<string[]>([]);
    const [availableTypes, setAvailableTypes] = useState<string[]>([]);
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);
    const [availableGases, setAvailableGases] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [visibleFiltersMetadata, setVisibleFiltersMetadata] = useState<string[]>(['brand', 'voltage', 'type', 'class', 'gas']);
    const ALL_FILTERS = [
        { id: 'brand', label: 'Fabricante' },
        { id: 'voltage', label: 'Voltagem' },
        { id: 'type', label: 'Tipo de Produto' },
        { id: 'class', label: 'Classe/Mercado' },
        { id: 'gas', label: 'Gás Refrigerante' }
    ];
    const PAGE_SIZE = 50;

    // Fetch unique values for filters
    useEffect(() => {
        const fetchFilters = async () => {
            try {
                // Tenta usar a RPC para os filtros principais (mais performático)
                const { data: rpcData } = await supabase.rpc('get_inventory_filters');

                if (rpcData && rpcData.length > 0) {
                    const brands = Array.from(new Set(rpcData.map((p: any) => p.brand))).filter(Boolean) as string[];
                    const voltages = Array.from(new Set(rpcData.map((p: any) => p.voltage))).filter(Boolean) as string[];
                    setAvailableBrands(brands.sort());
                    setAvailableVoltages(voltages.sort());
                }

                // Busca os outros filtros de forma otimizada (apenas as colunas necessárias)
                // Nota: Idealmente isso deveria estar em uma RPC também para evitar download de muitos dados
                const { data } = await supabase
                    .from('products')
                    .select('product_type, market_class, refrigerant_gas')
                    .limit(1000); // Limite de amostragem para evitar excesso de dados no client

                if (data) {
                    const types = Array.from(new Set(data.map((p: any) => p.product_type))).filter(Boolean) as string[];
                    const classes = Array.from(new Set(data.map((p: any) => p.market_class))).filter(Boolean) as string[];
                    const gases = Array.from(new Set(data.map((p: any) => p.refrigerant_gas))).filter(Boolean) as string[];

                    setAvailableTypes(types.sort());
                    setAvailableClasses(classes.sort());
                    setAvailableGases(gases.sort());
                }
            } catch (error) {
                console.error("Erro ao carregar filtros:", error);
            }
        };
        fetchFilters();
    }, []);

    // Reset page when filters change
    useEffect(() => {
        setPage(0);
    }, [searchTerm, statusFilter, brandFilter, voltageFilter, typeFilter, classFilter, gasFilter]);

    const [selectedProduct, setSelectedProduct] = useState<InventoryProduct | null>(null);
    const [history, setHistory] = useState<ProductLog[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null);
    const [deletingProduct, setDeletingProduct] = useState<InventoryProduct | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const fetchInventory = React.useCallback(async () => {
        setIsLoading(true);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000));

        try {
            let query = supabase
                .from("products")
                .select("*, orders(id, clients(name))", { count: 'exact' }) // Remove product_logs(*), keep orders join if needed or remove for perf
                .order("created_at", { ascending: false })
                .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

            if (searchTerm) {
                query = query.or(`brand.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%,internal_serial.ilike.%${searchTerm}%,original_serial.ilike.%${searchTerm}%,product_type.ilike.%${searchTerm}%,market_class.ilike.%${searchTerm}%,refrigerant_gas.ilike.%${searchTerm}%,voltage.ilike.%${searchTerm}%,pnc_ml.ilike.%${searchTerm}%,commercial_code.ilike.%${searchTerm}%`);
            }

            if (statusFilter === "EM ESTOQUE") {
                query = query.in('status', ['EM ESTOQUE', 'REPROVADO']);
            } else if (statusFilter !== "ALL") {
                query = query.eq('status', statusFilter);
            }

            if (brandFilter !== "ALL") {
                query = query.eq('brand', brandFilter);
            }

            if (voltageFilter !== "ALL") {
                query = query.eq('voltage', voltageFilter);
            }

            if (typeFilter !== "ALL") {
                query = query.eq('product_type', typeFilter);
            }

            if (classFilter !== "ALL") {
                query = query.eq('market_class', classFilter);
            }

            if (gasFilter !== "ALL") {
                query = query.eq('refrigerant_gas', gasFilter);
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
            handleError(error, "Erro ao carregar estoque");
        } finally {
            setIsLoading(false);
        }
    }, [page, searchTerm, statusFilter, brandFilter, voltageFilter, typeFilter, classFilter, gasFilter]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchInventory();
        }, 500);
        return () => clearTimeout(timer);
    }, [page, searchTerm, statusFilter, brandFilter, voltageFilter, typeFilter, classFilter, gasFilter, fetchInventory]);

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
        } catch (error) {
            handleError(error, "Falha ao carregar histórico");
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingProduct) return;
        setIsSaving(true);
        try {
            const productSize = await calculateProductSize(editingProduct.volume_total);
            const { error: updateError } = await supabase
                .from("products")
                .update({
                    brand: editingProduct.brand,
                    model: editingProduct.model,
                    original_serial: editingProduct.original_serial,
                    voltage: editingProduct.voltage,
                    commercial_code: editingProduct.commercial_code,
                    color: editingProduct.color,
                    product_type: editingProduct.product_type,
                    pnc_ml: editingProduct.pnc_ml,
                    manufacturing_date: editingProduct.manufacturing_date,
                    market_class: editingProduct.market_class,
                    refrigerant_gas: editingProduct.refrigerant_gas,
                    gas_charge: editingProduct.gas_charge,
                    compressor: editingProduct.compressor,
                    volume_freezer: editingProduct.volume_freezer,
                    volume_refrigerator: editingProduct.volume_refrigerator,
                    volume_total: editingProduct.volume_total,
                    pressure_high_low: editingProduct.pressure_high_low,
                    freezing_capacity: editingProduct.freezing_capacity,
                    electric_current: editingProduct.electric_current,
                    defrost_power: editingProduct.defrost_power,
                    frequency: editingProduct.frequency,
                    size: productSize,
                    status: editingProduct.status,
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
                        fields_updated: ["all_technical_fields"],
                        timestamp: new Date().toISOString()
                    }
                });

            toast.success("Dados atualizados!");
            setEditingProduct(null);
            fetchInventory();
        } catch (error) {
            handleError(error, "Erro na atualização");
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
            handleError(error, "Erro ao remover");
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
                Cliente: (Array.isArray(p.orders) ? p.orders[0]?.clients?.name : p.orders?.clients?.name) || "-"
            }));
            exportToExcel(data, "estoque_industrial");
        }
        toast.info(`Exportação ${type} iniciada`);
    };

    // Products are already filtered by the database query

    const isAuthorized = profile?.role === "GESTOR" || profile?.role === "ADMIN" || profile?.role === "TECNICO" || profile?.role === "SUPERVISOR";

    return (
        <MainLayout>
            <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
                    <div>
                        <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-foreground uppercase italic leading-none">
                            Controle de <span className="text-primary tracking-normal font-light not-italic">Inventário</span>
                        </h1>
                        <p className="text-muted-foreground font-medium text-[10px] sm:text-sm mt-2 opacity-70 italic px-1">Monitoramento em tempo real de ativos e equipamentos industriais.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-6">
                        <div className="flex items-center gap-4 bg-card/60 border border-border/10 rounded-2xl px-6 py-4 shadow-inner justify-between sm:justify-start">
                            <Box className="h-6 w-6 text-primary" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Total Ativos</span>
                                <span className="text-base font-black text-foreground">{products.length} Unidades</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 sm:flex items-center justify-center bg-foreground/5 rounded-2xl p-1.5 border border-border/20 shadow-lg gap-1">
                            {selectedIds.size > 0 && (
                                <button
                                    onClick={async () => {
                                        const selectedProducts = products.filter(p => selectedIds.has(p.id));
                                        const targetPrinter = localStorage.getItem('default_printer');
                                        if (targetPrinter) {
                                            const promise = new Promise(async (resolve, reject) => {
                                                try {
                                                    const { printService } = await import("@/lib/print-service");
                                                    const orientation = localStorage.getItem('print_orientation') || 'portrait';
                                                    let combinedZpl = "";
                                                    const val = (v: any) => v || '-';

                                                    for (const p of selectedProducts) {
                                                        const fullSize = p.size || await calculateProductSize(p.volume_total);
                                                        const displaySize = fullSize === 'Pequeno' ? 'P' : fullSize === 'Médio' ? 'M' : fullSize === 'Grande' ? 'G' : "-";

                                                        let zplCode = "";

                                                        if (orientation === 'landscape') {
                                                            zplCode = `^XA
^PW640
^LL440
^CI28
^FO638,5^A0R,45,45^FDAmbicom^FS
^FO588,5^A0R,15,15^FB240,1,0,L^FDR. Wenceslau Marek, 10 - Aguas Belas,^FS
^FO573,5^A0R,15,15^FB240,1,0,L^FDSao Jose dos Pinhais - PR, 83010-520^FS
^FO553,5^A0R,20,20^FB240,1,0,L^FDSAC: 041 - 3382-5410^FS
^FO638,270^A0R,15,15^FB160,1,0,C^FDPRODUTO^FS
^FO623,270^A0R,15,15^FB160,1,0,C^FDREMANUFATURADO^FS
^FO608,270^A0R,15,15^FB160,1,0,C^FDGARANTIA^FS
^FO593,270^A0R,15,15^FB160,1,0,C^FDAMBICOM^FS
^FO5,5^GB515,430,2^FS
^FO465,5^GB0,430,2^FS
^FO5,210^GB515,0,2^FS
^FO527,5^A0R,15,15^FB205,1,0,C^FDMODELO^FS
^FO507,5^A0R,30,30^FB205,1,0,C^FD${val(p.model)}^FS
^FO527,210^A0R,15,15^FB205,1,0,C^FDVOLTAGEM^FS
^FO507,210^A0R,30,30^FB205,1,0,C^FD${val(p.voltage)}^FS
^FO5,280^GB460,0,2^FS
^FO365,5^GB0,205,2^FS
^FO297,5^GB0,205,2^FS
^FO229,5^GB0,205,2^FS
^FO161,5^GB0,205,2^FS
^FO93,5^GB0,205,2^FS
^FO229,107^GB68,0,2^FS
^FO161,107^GB68,0,2^FS
^FO5,107^GB68,0,2^FS
^FO377,280^GB0,150,2^FS
^FO289,280^GB0,150,2^FS
^FO201,280^GB0,150,2^FS
^FO113,280^GB0,150,2^FS
^FO373,65^BQN,2,4^FDQA,${val(p.internal_serial)}^FS
^FO355,5^A0R,15,15^FB205,1,0,C^FDPNC/ML^FS
^FO335,5^A0R,30,30^FB205,1,0,C^FD${val(p.pnc_ml)}^FS
^FO287,5^A0R,15,15^FB102,1,0,C^FDGAS FRIGOR.^FS
^FO265,5^A0R,22,22^FB102,1,0,C^FD${val(p.refrigerant_gas)}^FS
^FO287,107^A0R,15,15^FB102,1,0,C^FDCARGA GAS^FS
^FO265,107^A0R,22,22^FB102,1,0,C^FD${val(p.gas_charge)}^FS
^FO219,5^A0R,15,15^FB102,1,0,C^FDVOL. FREEZER^FS
^FO197,5^A0R,22,22^FB102,1,0,C^FD${val(p.volume_freezer)}^FS
^FO219,107^A0R,15,15^FB102,1,0,C^FDVOL. REFRIG.^FS
^FO197,107^A0R,22,22^FB102,1,0,C^FD${val(p.volume_refrigerator)}^FS
^FO151,5^A0R,15,15^FB205,1,0,C^FDP. DE ALTA / P. DE BAIXA^FS
^FO127,5^A0R,18,18^FB205,1,0,C^FD${val(p.pressure_high_low)}^FS
^FO83,5^A0R,15,15^FB102,1,0,C^FDCORRENTE^FS
^FO61,5^A0R,22,22^FB102,1,0,C^FD${val(p.electric_current)}^FS
^FO83,107^A0R,15,15^FB102,1,0,C^FDPOT. DEGELO^FS
^FO61,107^A0R,22,22^FB102,1,0,C^FD${val(p.defrost_power)}^FS
^FO15,220^A0N,15,15^FDNUMERO DE SERIE AMBICOM:^FS
^FO15,238^A0N,30,30^FD${val(p.internal_serial)}^FS
^FO15,263^A0N,15,15^FD${val(p.commercial_code)}^FS
^FO430,280^A0R,45,45^FB150,1,0,C^FD${val(p.frequency || '60 Hz')}^FS
^FO357,280^A0R,15,15^FB150,1,0,C^FDCOMPRESSOR^FS
^FO327,280^A0R,20,20^FB150,1,0,C^FD${val(p.compressor)}^FS
^FO269,280^A0R,15,15^FB150,1,0,C^FDVOLUME TOTAL^FS
^FO245,280^A0R,30,30^FB150,1,0,C^FD${formatTotalVolume(p.volume_freezer, p.volume_refrigerator, p.volume_total) || '-'}^FS
^FO181,280^A0R,15,15^FB150,1,0,C^FDCAPAC. CONG.^FS
^FO157,280^A0R,25,25^FB150,1,0,C^FD${val(p.freezing_capacity)}^FS
^FO93,280^A0R,15,15^FB150,1,0,C^FDTAMANHO^FS
^FO69,280^A0R,30,30^FB150,1,0,C^FD${displaySize}^FS
^XZ`.replace(/\n/g, '');
                                                        } else {
                                                            zplCode = `^XA
^PW440
^LL640
^CI28
^FO15,15^A0N,45,45^FDAmbicom^FS
^FO15,65^A0N,15,15^FB240,1,0,L^FDR. Wenceslau Marek, 10 - Aguas Belas,^FS
^FO15,80^A0N,15,15^FB240,1,0,L^FDSao Jose dos Pinhais - PR, 83010-520^FS
^FO15,100^A0N,20,20^FB240,1,0,L^FDSAC: 041 - 3382-5410^FS
^FO270,15^A0N,15,15^FB160,1,0,C^FDPRODUTO^FS
^FO270,30^A0N,15,15^FB160,1,0,C^FDREMANUFATURADO^FS
^FO270,45^A0N,15,15^FB160,1,0,C^FDGARANTIA^FS
^FO270,60^A0N,15,15^FB160,1,0,C^FDAMBICOM^FS
^FO10,120^GB420,500,2^FS
^FO10,180^GB420,0,2^FS
^FO215,120^GB0,500,2^FS
^FO10,125^A0N,15,15^FB205,1,0,C^FDMODELO^FS
^FO10,145^A0N,30,30^FB205,1,0,C^FD${val(p.model)}^FS
^FO215,125^A0N,15,15^FB205,1,0,C^FDVOLTAGEM^FS
^FO215,145^A0N,30,30^FB205,1,0,C^FD${val(p.voltage)}^FS
^FO285,180^GB0,440,2^FS
^FO10,280^GB205,0,2^FS
^FO10,348^GB205,0,2^FS
^FO10,416^GB205,0,2^FS
^FO10,484^GB205,0,2^FS
^FO10,552^GB205,0,2^FS
^FO112,348^GB0,68,2^FS
^FO112,416^GB0,68,2^FS
^FO112,552^GB0,68,2^FS
^FO285,268^GB145,0,2^FS
^FO285,356^GB145,0,2^FS
^FO285,444^GB145,0,2^FS
^FO285,532^GB145,0,2^FS
^FO60,190^BQN,2,4^FDQA,${val(p.internal_serial)}^FS
^FO10,290^A0N,15,15^FB205,1,0,C^FDPNC/ML^FS
^FO10,310^A0N,30,30^FB205,1,0,C^FD${val(p.pnc_ml)}^FS
^FO10,358^A0N,15,15^FB102,1,0,C^FDGAS FRIGOR.^FS
^FO10,380^A0N,22,22^FB102,1,0,C^FD${val(p.refrigerant_gas)}^FS
^FO112,358^A0N,15,15^FB102,1,0,C^FDCARGA GAS^FS
^FO112,380^A0N,22,22^FB102,1,0,C^FD${val(p.gas_charge)}^FS
^FO10,426^A0N,15,15^FB102,1,0,C^FDVOL. FREEZER^FS
^FO10,448^A0N,22,22^FB102,1,0,C^FD${val(p.volume_freezer)}^FS
^FO112,426^A0N,15,15^FB102,1,0,C^FDVOL. REFRIG.^FS
^FO112,448^A0N,22,22^FB102,1,0,C^FD${val(p.volume_refrigerator)}^FS
^FO10,494^A0N,15,15^FB205,1,0,C^FDP. DE ALTA / P. DE BAIXA^FS
^FO10,518^A0N,18,18^FB205,1,0,C^FD${val(p.pressure_high_low)}^FS
^FO10,562^A0N,15,15^FB102,1,0,C^FDCORRENTE^FS
^FO10,584^A0N,22,22^FB102,1,0,C^FD${val(p.electric_current)}^FS
^FO112,562^A0N,15,15^FB102,1,0,C^FDPOT. DEGELO^FS
^FO112,584^A0N,22,22^FB102,1,0,C^FD${val(p.defrost_power)}^FS
^FO222,610^A0B,15,15^FDNUMERO DE SERIE AMBICOM:^FS
^FO240,610^A0B,30,30^FD${val(p.internal_serial)}^FS
^FO265,610^A0B,15,15^FD${val(p.commercial_code)}^FS
^FO285,215^A0N,45,45^FB145,1,0,C^FD${val(p.frequency || '60 Hz')}^FS
^FO285,288^A0N,15,15^FB145,1,0,C^FDCOMPRESSOR^FS
^FO285,318^A0N,20,20^FB145,1,0,C^FD${val(p.compressor)}^FS
^FO285,376^A0N,15,15^FB145,1,0,C^FDVOLUME TOTAL^FS
^FO285,400^A0N,30,30^FB145,1,0,C^FD${formatTotalVolume(p.volume_freezer, p.volume_refrigerator, p.volume_total) || '-'}^FS
^FO285,464^A0N,15,15^FB145,1,0,C^FDCAPAC. CONG.^FS
^FO285,488^A0N,25,25^FB145,1,0,C^FD${val(p.freezing_capacity)}^FS
^FO285,552^A0N,15,15^FB145,1,0,C^FDTAMANHO^FS
^FO285,576^A0N,30,30^FB145,1,0,C^FD${displaySize}^FS
^XZ`.replace(/\n/g, '');
                                                        }

                                                        combinedZpl += zplCode;
                                                    }

                                                    await printService.submitPrintJob({
                                                        payload_type: 'zpl',
                                                        payload_data: combinedZpl,
                                                        printer_target: targetPrinter
                                                    });

                                                    resolve(true);
                                                } catch (err) {
                                                    reject(err);
                                                }
                                            });

                                            toast.promise(promise, {
                                                loading: 'Enviando p/ fila de impressão...',
                                                success: () => {
                                                    setSelectedIds(new Set());
                                                    return `Enviadas ${selectedProducts.length} etiquetas para impressão!`;
                                                },
                                                error: 'Erro na impressão automática'
                                            });
                                        } else {
                                            // Fallback para baixar o PDF comum
                                            const { printLabels } = await import("@/lib/export-utils");
                                            await printLabels(selectedProducts);
                                        }
                                    }}
                                    className="col-span-1 h-12 px-4 bg-primary text-primary-foreground rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-primary/20 animate-in zoom-in"
                                >
                                    <Barcode className="h-5 w-5" />
                                    <span className="hidden xs:inline">Etiquetas ({selectedIds.size})</span>
                                    <span className="xs:hidden">{selectedIds.size}</span>
                                </button>
                            )}
                            <button
                                onClick={() => handleExport('PDF')}
                                className={cn(
                                    "p-3.5 hover:bg-white/10 rounded-xl text-muted-foreground hover:text-foreground transition-all active:scale-90 flex justify-center border border-transparent",
                                    selectedIds.size > 0 ? "col-span-1" : "col-span-1"
                                )}
                                title="Exportar PDF Geral"
                            >
                                <FileDown className="h-6 w-6" />
                            </button>
                            <button
                                onClick={() => handleExport('EXCEL')}
                                className="p-3.5 hover:bg-emerald-500/10 rounded-xl text-emerald-500 hover:text-emerald-400 transition-all active:scale-90 flex justify-center border border-transparent"
                                title="Exportar Excel"
                            >
                                <Download className="h-6 w-6" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-card/40 p-2 sm:p-3 rounded-3xl border border-border/10 mx-2 sm:mx-0 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="sm:col-span-2 relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Rastrear por ID, Marca, Modelo..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full h-14 bg-background/50 border border-border/10 rounded-2xl pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-foreground font-medium"
                            />
                        </div>
                        <div className="relative">
                            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="w-full h-14 bg-background/50 border border-border/10 rounded-2xl pl-10 pr-4 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer text-foreground font-bold shadow-sm"
                            >
                                <option value="ALL">Todos Status</option>
                                {Object.entries(statusConfig).map(([val, conf]) => (
                                    <option key={val} value={val}>{conf.label}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={cn(
                                "flex items-center justify-center gap-2 h-14 rounded-2xl border transition-all text-[10px] font-black uppercase tracking-widest",
                                showFilters ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" : "bg-foreground/5 border-border/10 text-muted-foreground hover:bg-foreground/10"
                            )}
                        >
                            <HistoryIcon className="h-4 w-4" />
                            {showFilters ? "Fechar Filtros" : "Mais Opções"}
                        </button>
                    </div>

                    {showFilters && (
                        <div className="border-t border-border/5 mt-2 animate-in slide-in-from-top-2 duration-300">
                            {/* Filter Management Bar */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-4 bg-white/[0.01]">
                                <span className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest">Colunas Visíveis:</span>
                                <div className="flex flex-wrap gap-2">
                                    {ALL_FILTERS.map(f => {
                                        const isVisible = visibleFiltersMetadata.includes(f.id);
                                        return (
                                            <button
                                                key={f.id}
                                                onClick={() => {
                                                    if (isVisible) setVisibleFiltersMetadata(prev => prev.filter(id => id !== f.id));
                                                    else setVisibleFiltersMetadata(prev => [...prev, f.id]);
                                                }}
                                                className={cn(
                                                    "px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border",
                                                    isVisible
                                                        ? "bg-primary/20 text-primary border-primary/30 shadow-sm"
                                                        : "bg-foreground/5 text-muted-foreground border-border/10 opacity-60 hover:opacity-100"
                                                )}
                                            >
                                                {f.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4">
                                {visibleFiltersMetadata.includes('brand') && (
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Fabricante</label>
                                        <select
                                            value={brandFilter}
                                            onChange={e => setBrandFilter(e.target.value)}
                                            className="w-full h-12 bg-background border border-border/20 rounded-xl px-4 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all cursor-pointer font-bold shadow-sm"
                                        >
                                            <option value="ALL" className="bg-background">Todas as Marcas</option>
                                            {availableBrands.map(b => (
                                                <option key={b} value={b} className="bg-background">{b}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                {visibleFiltersMetadata.includes('voltage') && (
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Voltagem</label>
                                        <select
                                            value={voltageFilter}
                                            onChange={e => setVoltageFilter(e.target.value)}
                                            className="w-full h-12 bg-background border border-border/20 rounded-xl px-4 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all cursor-pointer font-bold shadow-sm"
                                        >
                                            <option value="ALL" className="bg-background">Todas as Voltagens</option>
                                            {availableVoltages.map(v => (
                                                <option key={v} value={v} className="bg-background">{v}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                {visibleFiltersMetadata.includes('type') && (
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Tipo de Produto</label>
                                        <select
                                            value={typeFilter}
                                            onChange={e => setTypeFilter(e.target.value)}
                                            className="w-full h-12 bg-background border border-border/20 rounded-xl px-4 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all cursor-pointer font-bold shadow-sm"
                                        >
                                            <option value="ALL" className="bg-background">Todos os Tipos</option>
                                            {availableTypes.map(t => (
                                                <option key={t} value={t} className="bg-background">{t}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                {visibleFiltersMetadata.includes('class') && (
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Classe/Mercado</label>
                                        <select
                                            value={classFilter}
                                            onChange={e => setClassFilter(e.target.value)}
                                            className="w-full h-12 bg-background border border-border/20 rounded-xl px-4 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all cursor-pointer font-bold shadow-sm"
                                        >
                                            <option value="ALL" className="bg-background">Todas as Classes</option>
                                            {availableClasses.map(c => (
                                                <option key={c} value={c} className="bg-background">{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                {visibleFiltersMetadata.includes('gas') && (
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Gás Refrigerante</label>
                                        <div className="flex gap-2">
                                            <select
                                                value={gasFilter}
                                                onChange={e => setGasFilter(e.target.value)}
                                                className="w-full h-12 bg-background border border-border/20 rounded-xl px-4 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all cursor-pointer font-bold flex-1 shadow-sm"
                                            >
                                                <option value="ALL" className="bg-background">Todos os Gases</option>
                                                {availableGases.map(g => (
                                                    <option key={g} value={g} className="bg-background">{g}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={() => {
                                                    setBrandFilter("ALL");
                                                    setVoltageFilter("ALL");
                                                    setTypeFilter("ALL");
                                                    setClassFilter("ALL");
                                                    setGasFilter("ALL");
                                                    setStatusFilter("ALL");
                                                    setSearchTerm("");
                                                }}
                                                className="h-12 w-12 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-foreground transition-all group/clear"
                                                title="Limpar Filtros"
                                            >
                                                <Trash2 className="h-4 w-4 group-active/clear:scale-90 transition-transform" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {isLoading ? (
                    <div className="space-y-4">
                        {/* Mobile Skeletons */}
                        <div className="md:hidden space-y-3 px-2">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="h-20 bg-card/20 border border-border/5 rounded-2xl animate-pulse flex items-center px-4 gap-4">
                                    <div className="h-6 w-6 rounded-md bg-foreground/5" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-2 w-24 bg-foreground/10 rounded" />
                                        <div className="h-3 w-40 bg-foreground/10 rounded" />
                                    </div>
                                    <div className="h-6 w-16 bg-foreground/5 rounded-full" />
                                </div>
                            ))}
                        </div>
                        {/* Desktop Skeletons */}
                        <div className="hidden md:block glass-card border-border/10 overflow-hidden rounded-2xl">
                            <div className="h-12 bg-foreground/5 border-b border-border/5" />
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="h-16 flex items-center px-6 gap-6 border-b border-border/5 animate-pulse">
                                    <div className="h-4 w-4 bg-foreground/5 rounded" />
                                    <div className="h-4 w-48 bg-foreground/5 rounded" />
                                    <div className="h-4 w-32 bg-foreground/5 rounded" />
                                    <div className="h-4 w-32 bg-foreground/5 rounded" />
                                    <div className="h-6 w-20 bg-foreground/5 rounded-full ml-auto" />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : products.length > 0 ? (
                    <div className="space-y-4">
                        {/* Mobile Compact View */}
                        <div className="md:hidden space-y-3 px-2">
                            {products.map((p) => {
                                const config = statusConfig[p.status as keyof typeof statusConfig];
                                const isExpanded = expandedId === p.id;
                                const isSelected = selectedIds.has(p.id);
                                return (
                                    <div
                                        key={p.id}
                                        className={cn(
                                            "bg-card/40 border border-border/10 rounded-2xl overflow-hidden transition-all duration-300",
                                            isExpanded ? "ring-1 ring-primary/30 bg-card/60" : "hover:bg-card/50",
                                            isSelected && "border-primary/30"
                                        )}
                                    >
                                        {/* Main Row */}
                                        <div
                                            onClick={() => setExpandedId(isExpanded ? null : p.id)}
                                            className="p-4 flex items-center justify-between cursor-pointer active:bg-foreground/5"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="flex-shrink-0" onClick={(e) => { e.stopPropagation(); toggleSelect(p.id); }}>
                                                    <div className={cn(
                                                        "h-5 w-5 rounded border border-border/40 flex items-center justify-center transition-all",
                                                        isSelected ? "bg-primary border-primary" : "bg-foreground/5"
                                                    )}>
                                                        {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                                                    </div>
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-mono font-bold text-primary">{p.internal_serial}</span>
                                                        {config && (
                                                            <div className={cn("h-1.5 w-1.5 rounded-full", config.color.split(' ')[1].replace('text-', 'bg-'))} />
                                                        )}
                                                    </div>
                                                    <h4 className="font-black text-foreground text-sm uppercase italic truncate">
                                                        {p.brand} {p.model}
                                                    </h4>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                {config && (
                                                    <span className={cn("text-[8px] font-black uppercase px-2 py-0.5 rounded-full border", config.color)}>
                                                        {config.label}
                                                    </span>
                                                )}
                                                <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300", isExpanded && "rotate-90")} />
                                            </div>
                                        </div>

                                        {/* Expanded Content */}
                                        {isExpanded && (
                                            <div className="px-4 pb-4 pt-2 border-t border-border/5 bg-foreground/5 animate-in slide-in-from-top-2 duration-300">
                                                <div className="grid grid-cols-2 gap-4 mb-4">
                                                    <div className="space-y-1">
                                                        <p className="text-[8px] font-black text-muted-foreground uppercase opacity-50">Tipo / Classe</p>
                                                        <p className="text-[10px] font-bold text-foreground uppercase">{p.product_type || "N/A"} • {p.market_class || "STD"}</p>
                                                    </div>
                                                    <div className="space-y-1 text-right">
                                                        <p className="text-[8px] font-black text-muted-foreground uppercase opacity-50">Voltagem / Gás</p>
                                                        <p className="text-[10px] font-bold text-foreground uppercase">{p.voltage || "BIV"} • {p.refrigerant_gas || "N/A"}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => fetchHistory(p)}
                                                        className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all text-[10px] font-black uppercase tracking-widest border border-primary/20"
                                                    >
                                                        <HistoryIcon className="h-4 w-4" />
                                                        Histórico
                                                    </button>
                                                    {isAuthorized && (
                                                        <>
                                                            <button
                                                                onClick={() => setEditingProduct({ ...p })}
                                                                className="h-12 w-12 flex items-center justify-center rounded-xl bg-white/5 text-muted-foreground hover:bg-white/10 transition-all border border-border/10"
                                                            >
                                                                <Edit2 className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeletingProduct(p)}
                                                                className="h-12 w-12 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all border border-red-500/20"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block glass-card overflow-hidden border-border/20 shadow-2xl bg-card/30 p-0 rounded-2xl">
                            <div className="relative group/table" data-scroll="right">
                                {/* Horizontal Scroll Indicators */}
                                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-neutral-900 to-transparent z-20 pointer-events-none opacity-0 group-has-[[data-scroll='left']]:opacity-100 group-has-[[data-scroll='both']]:opacity-100 transition-opacity" />
                                <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-neutral-900 via-card/80 to-transparent z-20 pointer-events-none opacity-0 group-has-[[data-scroll='right']]:opacity-100 group-has-[[data-scroll='both']]:opacity-100 transition-opacity" />

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
                                        <thead className="bg-foreground/5 text-muted-foreground uppercase text-[9px] sm:text-[10px] font-black tracking-widest border-b border-border/10 sticky top-0 z-30 backdrop-blur-md">
                                            <tr>
                                                <th className="px-4 py-6 text-center w-12 sticky left-0 z-50 bg-card/95 border-r border-border/10">
                                                    <input
                                                        type="checkbox"
                                                        checked={products.length > 0 && selectedIds.size === products.length}
                                                        onChange={toggleSelectAll}
                                                        className="h-4 w-4 rounded border-border/40 bg-foreground/5 text-primary focus:ring-primary/30 cursor-pointer"
                                                    />
                                                </th>
                                                <th className="px-4 sm:px-6 py-4 whitespace-nowrap sticky left-12 bg-card/95 z-40 border-r border-border/10 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">Equipamento</th>
                                                <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Especificações</th>
                                                <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Rastreabilidade</th>
                                                <th className="px-4 sm:px-6 py-4 text-center whitespace-nowrap">Status</th>
                                                <th className="px-4 sm:px-6 py-4 text-right whitespace-nowrap pr-6 sm:pr-10">Ações</th>
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
                                                            "group border-b border-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer active:bg-white/[0.06] relative overflow-hidden",
                                                            isSelected && "bg-primary/[0.05]"
                                                        )}
                                                    >
                                                        <td className="px-4 py-6 text-center sticky left-0 z-40 bg-card/95 group-hover:bg-card/95 transition-colors border-r border-border/10" onClick={e => e.stopPropagation()}>
                                                            {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-[0_0_15px_rgba(14,165,233,0.5)]" />}
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => toggleSelect(p.id)}
                                                                className="h-4 w-4 rounded border-border/40 bg-foreground/5 text-primary focus:ring-primary/30 cursor-pointer"
                                                            />
                                                        </td>
                                                        <td className="px-4 sm:px-6 py-4 sm:py-6 whitespace-nowrap sticky left-12 bg-card/95 group-hover:bg-card/95 transition-colors z-30 border-r border-border/10 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">
                                                            <div className="flex items-center gap-3 sm:gap-4">
                                                                <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-foreground/5 flex items-center justify-center border border-border/20 group-hover:border-primary/50 group-hover:bg-primary/5 transition-all shadow-inner shrink-0">
                                                                    <Layers className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="font-black text-foreground text-sm sm:text-base group-hover:text-primary transition-colors tracking-tight uppercase italic leading-tight truncate max-w-[120px] sm:max-w-none">{p.brand} {p.model}</p>
                                                                    <div className="flex items-center gap-2 mt-0.5 sm:mt-1">
                                                                        <span className="text-[8px] sm:text-[9px] font-black text-primary uppercase tracking-widest bg-primary/5 px-1 sm:px-1.5 py-0.5 rounded border border-primary/10 shadow-sm shrink-0">{p.voltage || "BIVOLT"}</span>
                                                                        <span className="text-[8px] sm:text-[9px] font-mono text-muted-foreground/60 uppercase truncate">S/N: {p.internal_serial}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 sm:px-6 py-4 sm:py-6 whitespace-nowrap">
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-foreground font-bold text-[10px] sm:text-[11px] uppercase tracking-tight">{p.product_type || "N/A"}</span>
                                                                    {p.size && (
                                                                        <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">{p.size}</span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 focus:outline-none">
                                                                    <span className="text-[8px] font-black text-muted-foreground uppercase opacity-40">{p.refrigerant_gas || "S/GÁS"}</span>
                                                                    <div className="h-1 w-1 rounded-full bg-foreground/10" />
                                                                    <span className="text-[8px] font-black text-muted-foreground uppercase opacity-40">{p.market_class || "STAND."}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 sm:px-6 py-4 sm:py-6 whitespace-nowrap">
                                                            <div className="flex flex-col">
                                                                <span className="text-foreground font-mono font-bold text-[10px] sm:text-xs">S/N: {p.internal_serial}</span>
                                                                <span className="text-[8px] sm:text-[9px] text-muted-foreground/40 font-mono uppercase tracking-tight">ORIG: {p.original_serial || "N/A"}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 sm:px-6 py-4 sm:py-6 text-center whitespace-nowrap">
                                                            {config && (
                                                                <div className={cn(
                                                                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border transition-all duration-500 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.5)] backdrop-blur-md group-hover:scale-105",
                                                                    config.color
                                                                )}>
                                                                    <div className="relative">
                                                                        <config.icon className="h-2.5 w-2.5 relative z-10" />
                                                                        <div className="absolute inset-0 blur-sm bg-current opacity-50" />
                                                                    </div>
                                                                    {config.label}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 sm:px-6 py-4 sm:py-6 text-right whitespace-nowrap pr-6 sm:pr-10" onClick={e => e.stopPropagation()}>
                                                            <div className="flex items-center justify-end gap-1 sm:gap-2">
                                                                <button
                                                                    onClick={() => fetchHistory(p)}
                                                                    className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center rounded-lg sm:rounded-xl bg-foreground/5 text-muted-foreground hover:bg-primary/20 hover:text-primary transition-all border border-border/20 shadow-inner group/btn"
                                                                    title="Detalhes e Histórico"
                                                                >
                                                                    <HistoryIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover/btn:scale-110 transition-transform" />
                                                                </button>
                                                                {isAuthorized && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => setEditingProduct({ ...p })}
                                                                            className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center rounded-lg sm:rounded-xl bg-foreground/5 text-muted-foreground hover:bg-white hover:text-black transition-all border border-border/20 shadow-inner group/btn"
                                                                            title="Editar Ativo"
                                                                        >
                                                                            <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover/btn:scale-110 transition-transform" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setDeletingProduct(p)}
                                                                            className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center rounded-lg sm:rounded-xl bg-foreground/5 text-muted-foreground hover:bg-red-500/20 hover:text-red-500 transition-all border border-border/20 shadow-inner group/btn"
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

                        <div className="flex items-center justify-between p-4 border border-border/10 rounded-2xl bg-card/50 shadow-lg">
                            <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                                Mostrando <span className="text-foreground font-bold">{products.length}</span> de <span className="text-foreground font-bold">{totalCount}</span> registros
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(0, p - 1))}
                                    disabled={page === 0}
                                    className="h-10 w-10 flex items-center justify-center rounded-xl bg-foreground/5 hover:bg-foreground/10 text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-border/10"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="text-[10px] font-black text-foreground px-4 bg-foreground/5 h-10 flex items-center rounded-xl border border-border/10 uppercase tracking-widest">
                                    Pág {page + 1}
                                </span>
                                <button
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={(page + 1) * PAGE_SIZE >= totalCount}
                                    className="h-10 w-10 flex items-center justify-center rounded-xl bg-foreground/5 hover:bg-foreground/10 text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-border/10"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-[50vh] flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-border/10 rounded-[3rem] bg-white/[0.01] relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Box className="h-20 w-20 text-foreground/5 mb-8 animate-bounce transition-all duration-1000" />
                        <h3 className="text-3xl font-black uppercase tracking-tighter text-foreground">Nenhum Registro Localizado</h3>
                        <p className="text-muted-foreground italic text-sm mt-3 max-w-sm mx-auto leading-relaxed">
                            {searchTerm ? "O filtro atual não retornou resultados aproximados. Tente simplificar sua pesquisa." : "Sua base de inventário está vazia. Inicie cadastrando novos equipamentos."}
                        </p>
                    </div>
                )}                          {/* Modal de Edição */}
                {editingProduct && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-background/95 backdrop-blur-2xl animate-in fade-in duration-300">
                        <div className="glass-card w-full max-w-xl p-6 sm:p-10 border-border/20 shadow-4xl space-y-6 sm:space-y-10 bg-card relative overflow-y-auto max-h-[95vh]">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />

                            <div className="flex justify-between items-start relative z-10">
                                <div>
                                    <h2 className="text-4xl font-black uppercase tracking-tighter text-foreground mb-1">Atualizar Ativo</h2>
                                    <p className="text-[10px] font-black text-primary tracking-[0.4em] uppercase opacity-80">{editingProduct.internal_serial}</p>
                                </div>
                                <button onClick={() => setEditingProduct(null)} className="h-12 w-12 rounded-2xl bg-foreground/5 flex items-center justify-center hover:bg-neutral-800 transition-all border border-border/20 text-foreground shadow-lg"><X className="h-6 w-6" /></button>
                            </div>

                            <form onSubmit={handleUpdate} className="space-y-8 relative z-10">
                                <div className="space-y-6">
                                    {/* Grupo: Identificação Principal */}
                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/70 mb-4 flex items-center gap-2">
                                            <div className="h-1 w-4 bg-primary/30 rounded-full" /> Identificação e Rastreabilidade
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Fabricante / Marca</label>
                                                <input
                                                    required
                                                    className="w-full h-11 bg-foreground/5 border border-border/20 rounded-xl px-4 text-foreground focus:ring-1 focus:ring-primary/30 focus:border-primary/50 outline-none font-bold transition-all text-sm"
                                                    value={editingProduct.brand || ""}
                                                    onChange={e => setEditingProduct({ ...editingProduct, brand: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Modelo Comercial</label>
                                                <input
                                                    required
                                                    className="w-full h-11 bg-foreground/5 border border-border/20 rounded-xl px-4 text-foreground focus:ring-1 focus:ring-primary/30 focus:border-primary/50 outline-none font-bold transition-all text-sm"
                                                    value={editingProduct.model || ""}
                                                    onChange={e => setEditingProduct({ ...editingProduct, model: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Serial Original</label>
                                                <input
                                                    required
                                                    className="w-full h-11 bg-foreground/5 border border-border/20 rounded-xl px-4 text-primary font-mono font-black focus:ring-1 focus:ring-primary/30 focus:border-primary/50 outline-none transition-all tracking-widest text-sm"
                                                    value={editingProduct.original_serial || ""}
                                                    onChange={e => setEditingProduct({ ...editingProduct, original_serial: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">PNC / ML</label>
                                                <input
                                                    className="w-full h-11 bg-foreground/5 border border-border/20 rounded-xl px-4 text-foreground focus:ring-1 focus:ring-primary/30 focus:border-primary/50 outline-none font-bold transition-all text-sm"
                                                    value={editingProduct.pnc_ml || ""}
                                                    onChange={e => setEditingProduct({ ...editingProduct, pnc_ml: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Código Comercial</label>
                                                <input
                                                    className="w-full h-11 bg-foreground/5 border border-border/20 rounded-xl px-4 text-foreground focus:ring-1 focus:ring-primary/30 focus:border-primary/50 outline-none font-bold transition-all text-sm"
                                                    value={editingProduct.commercial_code || ""}
                                                    onChange={e => setEditingProduct({ ...editingProduct, commercial_code: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Tipo de Produto</label>
                                                <input
                                                    className="w-full h-11 bg-foreground/5 border border-border/20 rounded-xl px-4 text-foreground focus:ring-1 focus:ring-primary/30 focus:border-primary/50 outline-none font-bold transition-all text-sm"
                                                    value={editingProduct.product_type || ""}
                                                    onChange={e => setEditingProduct({ ...editingProduct, product_type: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Cor</label>
                                                <input
                                                    className="w-full h-11 bg-foreground/5 border border-border/20 rounded-xl px-4 text-foreground focus:ring-1 focus:ring-primary/30 focus:border-primary/50 outline-none font-bold transition-all text-sm"
                                                    value={editingProduct.color || ""}
                                                    onChange={e => setEditingProduct({ ...editingProduct, color: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Classe / Mercado</label>
                                                <input
                                                    className="w-full h-11 bg-foreground/5 border border-border/20 rounded-xl px-4 text-foreground focus:ring-1 focus:ring-primary/30 focus:border-primary/50 outline-none font-bold transition-all text-sm"
                                                    value={editingProduct.market_class || ""}
                                                    onChange={e => setEditingProduct({ ...editingProduct, market_class: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Fabricação</label>
                                                <input
                                                    type="date"
                                                    className="w-full h-11 bg-foreground/5 border border-border/20 rounded-xl px-4 text-foreground focus:ring-1 focus:ring-primary/30 focus:border-primary/50 outline-none font-bold transition-all text-sm"
                                                    value={editingProduct.manufacturing_date ? (() => {
                                                        const d = new Date(editingProduct.manufacturing_date);
                                                        return isNaN(d.getTime()) ? "" : d.toISOString().split('T')[0];
                                                    })() : ""}
                                                    onChange={e => setEditingProduct({ ...editingProduct, manufacturing_date: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Grupo: Elétrica e Performance */}
                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/70 mb-4 flex items-center gap-2">
                                            <div className="h-1 w-4 bg-primary/30 rounded-full" /> Elétrica e Performance
                                        </h3>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Voltagem</label>
                                                <input
                                                    className="w-full h-11 bg-foreground/5 border border-border/20 rounded-xl px-4 text-foreground focus:ring-1 focus:ring-primary/30 focus:border-primary/50 outline-none font-bold transition-all text-xs"
                                                    value={editingProduct.voltage || ""}
                                                    onChange={e => setEditingProduct({ ...editingProduct, voltage: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Corrente (A)</label>
                                                <input
                                                    className="w-full h-11 bg-foreground/5 border border-border/20 rounded-xl px-4 text-foreground focus:ring-1 focus:ring-primary/30 focus:border-primary/50 outline-none font-bold transition-all text-xs"
                                                    value={editingProduct.electric_current || ""}
                                                    onChange={e => setEditingProduct({ ...editingProduct, electric_current: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Frequência</label>
                                                <input
                                                    className="w-full h-11 bg-foreground/5 border border-border/20 rounded-xl px-4 text-foreground focus:ring-1 focus:ring-primary/30 focus:border-primary/50 outline-none font-bold transition-all text-xs"
                                                    value={editingProduct.frequency || ""}
                                                    onChange={e => setEditingProduct({ ...editingProduct, frequency: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Potência Degelo</label>
                                                <input
                                                    className="w-full h-11 bg-foreground/5 border border-border/20 rounded-xl px-4 text-foreground focus:ring-1 focus:ring-primary/30 focus:border-primary/50 outline-none font-bold transition-all text-xs"
                                                    value={editingProduct.defrost_power || ""}
                                                    onChange={e => setEditingProduct({ ...editingProduct, defrost_power: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Grupo: Refrigeração e Volumes */}
                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/70 mb-4 flex items-center gap-2">
                                            <div className="h-1 w-4 bg-primary/30 rounded-full" /> Refrigeração e Capacidades
                                        </h3>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Gás</label>
                                                <input
                                                    className="w-full h-11 bg-foreground/5 border border-border/20 rounded-xl px-4 text-foreground focus:ring-1 focus:ring-primary/30 focus:border-primary/50 outline-none font-bold transition-all text-xs"
                                                    value={editingProduct.refrigerant_gas || ""}
                                                    onChange={e => setEditingProduct({ ...editingProduct, refrigerant_gas: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Carga Gás</label>
                                                <input
                                                    className="w-full h-11 bg-foreground/5 border border-border/20 rounded-xl px-4 text-foreground focus:ring-1 focus:ring-primary/30 focus:border-primary/50 outline-none font-bold transition-all text-xs"
                                                    value={editingProduct.gas_charge || ""}
                                                    onChange={e => setEditingProduct({ ...editingProduct, gas_charge: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Compressor</label>
                                                <input
                                                    className="w-full h-11 bg-foreground/5 border border-border/20 rounded-xl px-4 text-foreground focus:ring-1 focus:ring-primary/30 focus:border-primary/50 outline-none font-bold transition-all text-xs"
                                                    value={editingProduct.compressor || ""}
                                                    onChange={e => setEditingProduct({ ...editingProduct, compressor: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Vol. Freezer</label>
                                                <input
                                                    className="w-full h-11 bg-foreground/5 border border-border/20 rounded-xl px-4 text-foreground focus:ring-1 focus:ring-primary/30 focus:border-primary/50 outline-none font-bold transition-all text-xs"
                                                    value={editingProduct.volume_freezer || ""}
                                                    onChange={e => setEditingProduct({ ...editingProduct, volume_freezer: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Vol. Refrig.</label>
                                                <input
                                                    className="w-full h-11 bg-foreground/5 border border-border/20 rounded-xl px-4 text-foreground focus:ring-1 focus:ring-primary/30 focus:border-primary/50 outline-none font-bold transition-all text-xs"
                                                    value={editingProduct.volume_refrigerator || ""}
                                                    onChange={e => setEditingProduct({ ...editingProduct, volume_refrigerator: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Vol. Total</label>
                                                <input
                                                    className="w-full h-11 bg-foreground/5 border border-border/20 rounded-xl px-4 text-foreground focus:ring-1 focus:ring-primary/30 focus:border-primary/50 outline-none font-bold transition-all text-xs"
                                                    value={editingProduct.volume_total || ""}
                                                    onChange={e => setEditingProduct({ ...editingProduct, volume_total: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Capac. Congel.</label>
                                                <input
                                                    className="w-full h-11 bg-foreground/5 border border-border/20 rounded-xl px-4 text-foreground focus:ring-1 focus:ring-primary/30 focus:border-primary/50 outline-none font-bold transition-all text-xs"
                                                    value={editingProduct.freezing_capacity || ""}
                                                    onChange={e => setEditingProduct({ ...editingProduct, freezing_capacity: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Pressão (H/L)</label>
                                                <input
                                                    className="w-full h-11 bg-foreground/5 border border-border/20 rounded-xl px-4 text-foreground focus:ring-1 focus:ring-primary/30 focus:border-primary/50 outline-none font-bold transition-all text-xs"
                                                    value={editingProduct.pressure_high_low || ""}
                                                    onChange={e => setEditingProduct({ ...editingProduct, pressure_high_low: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Status Ativo</label>
                                                <select
                                                    className="w-full h-11 bg-foreground/5 border border-border/20 rounded-xl px-4 text-foreground focus:ring-1 focus:ring-primary/30 focus:border-primary/50 outline-none font-bold transition-all text-xs appearance-none cursor-pointer"
                                                    value={editingProduct.status}
                                                    onChange={e => setEditingProduct({ ...editingProduct, status: e.target.value as any })}
                                                >
                                                    {Object.entries(statusConfig).map(([val, conf]) => (
                                                        <option key={val} value={val} className="bg-card">{conf.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-6">
                                    <button
                                        type="button"
                                        onClick={() => setEditingProduct(null)}
                                        className="h-14 rounded-2xl border border-border/20 text-muted-foreground font-black uppercase tracking-widest text-[10px] hover:bg-foreground/5 hover:text-foreground transition-all shadow-lg shadow-black/20"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        disabled={isSaving}
                                        className="h-14 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 font-black uppercase tracking-widest text-[10px] transition-all disabled:opacity-50 shadow-xl shadow-primary/20 border-t border-border/40 flex items-center justify-center gap-3 active:scale-95"
                                    >
                                        {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                                        Atualizar Ativo
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Modal de Exclusão */}
                {deletingProduct && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-6 bg-background/98 backdrop-blur-3xl animate-in zoom-in-95 duration-300">
                        <div className="glass-card w-full max-w-md p-8 sm:p-12 border-red-500/30 shadow-4xl text-center space-y-8 sm:space-y-10 bg-neutral-950 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent" />
                            <div className="h-24 w-24 rounded-3xl bg-red-500/10 flex items-center justify-center mx-auto ring-8 ring-red-500/5 rotate-12 group-hover:rotate-0 transition-transform"><AlertCircle className="h-12 w-12 text-red-500" /></div>
                            <div className="space-y-4">
                                <h2 className="text-3xl font-black uppercase tracking-tighter text-foreground">Excluir Permanente?</h2>
                                <p className="text-sm text-muted-foreground italic leading-relaxed px-4 opacity-70">
                                    Esta ação é irreversível e irá apagar todos os vínculos e logs do ativo <span className="text-foreground font-black underline decoration-red-500/50 underline-offset-4">{deletingProduct.internal_serial}</span>.
                                </p>
                            </div>
                            <div className="flex flex-col gap-4">
                                <button
                                    onClick={handleDelete}
                                    disabled={isSaving}
                                    className="h-16 rounded-2xl bg-red-500 hover:bg-red-600 text-foreground font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-red-500/30 transition-all active:scale-95 flex items-center justify-center gap-3"
                                >
                                    {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
                                    Confirmar Destruição
                                </button>
                                <button
                                    onClick={() => setDeletingProduct(null)}
                                    className="h-12 text-muted-foreground hover:text-foreground font-black text-[10px] uppercase transition-all tracking-[0.3em]"
                                >
                                    Manter Registro Seguro
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Detalhes do Produto & Histórico */}
                {selectedProduct && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-background/95 backdrop-blur-2xl animate-in fade-in duration-300">
                        <div className="glass-card w-full max-w-5xl p-6 sm:p-10 border-border/20 shadow-5xl max-h-[95vh] flex flex-col bg-card absolute overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />

                            <div className="flex justify-between items-start mb-8 relative z-10">
                                <div className="flex gap-4 sm:gap-6 items-center">
                                    <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner">
                                        <Box className="h-6 w-6 sm:h-9 sm:w-9" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter text-foreground leading-none mb-1">
                                            {selectedProduct.brand} {selectedProduct.model}
                                        </h2>
                                        <div className="flex items-center gap-3">
                                            <p className="text-[9px] sm:text-[10px] font-black text-primary tracking-[0.3em] uppercase opacity-70">Rastreabilidade Terminal • {selectedProduct.internal_serial}</p>
                                            <div className={cn(
                                                "px-2 py-0.5 rounded text-[8px] font-bold uppercase border",
                                                statusConfig[selectedProduct.status as keyof typeof statusConfig]?.color || "border-border/20 text-foreground"
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
                                                className="h-10 px-4 rounded-xl bg-foreground/5 text-xs font-bold hover:bg-foreground/10 transition-all border border-border/20 text-foreground"
                                            >
                                                Editar Ativo
                                            </button>
                                        </div>
                                    )}
                                    <button onClick={() => setSelectedProduct(null)} className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-foreground/5 flex items-center justify-center hover:bg-neutral-800 transition-all border border-border/20 text-foreground shadow-lg">
                                        <X className="h-5 w-5 sm:h-6 sm:w-6" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 sm:pr-6 space-y-8 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-primary/30 transition-colors relative z-10">
                                {/* Photos Section */}
                                <div className="mb-8">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <Camera className="h-4 w-4 text-primary" />
                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Evidência Fotográfica</p>
                                        </div>
                                        <div className="flex justify-center">
                                            {(() => {
                                                const photo = selectedProduct.photo_product || selectedProduct.photo_model || selectedProduct.photo_serial || selectedProduct.photo_defect;
                                                const label = selectedProduct.photo_product ? "VISTA GERAL" :
                                                    selectedProduct.photo_model ? "ETIQUETA MODELO" :
                                                        selectedProduct.photo_serial ? "ETIQUETA SERIAL" :
                                                            selectedProduct.photo_defect ? "EVIDÊNCIA DEFEITO" : "FOTO";

                                                return (
                                                    <div
                                                        className="group relative w-full max-w-md aspect-[9/16] rounded-3xl bg-card/40 border border-border/20 overflow-hidden cursor-zoom-in active:scale-95 transition-all shadow-2xl"
                                                        onClick={() => photo && setFullImageUrl(photo)}
                                                    >
                                                        {photo ? (
                                                            <>
                                                                <img
                                                                    src={photo}
                                                                    alt="Produto"
                                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                                />
                                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8">
                                                                    <span className="text-xs font-black text-primary uppercase tracking-[0.3em] mb-2">{label}</span>
                                                                    <p className="text-[10px] text-foreground/60 font-medium italic">Clique para zoom de alta definição</p>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="w-full h-full flex flex-col items-center justify-center gap-4 opacity-20">
                                                                <Camera className="h-12 w-12 text-muted-foreground" />
                                                                <span className="text-[10px] font-black uppercase tracking-widest">Nenhuma Imagem Registrada</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
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
                                                <div key={i} className="bg-white/[0.03] p-3 rounded-xl border border-border/10 group hover:border-primary/20 transition-all">
                                                    <span className="text-[8px] font-black text-muted-foreground uppercase block mb-1">{spec.label}</span>
                                                    <span className="text-[10px] font-bold text-foreground uppercase truncate">{spec.value || "N/A"}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Coluna 2: Último Laudo Técnico / Checklist */}
                                    <div className="space-y-6 lg:border-x lg:border-border/10 lg:px-8">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Resultados de Triagem</h3>
                                        </div>

                                        {/* Tenta encontrar o log do técnico mais recente */}
                                        {(() => {
                                            const techLog = history.find(l => l.new_status === 'TECNICO' || l.data?.checklist);
                                            if (!techLog || !techLog.data?.checklist) {
                                                return (
                                                    <div className="h-32 flex flex-col items-center justify-center border border-dashed border-border/20 rounded-2xl opacity-40">
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
                                                        <div className="mt-4 p-4 rounded-xl bg-neutral-950 border border-border/10 italic">
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

                                        <div className="relative pl-6 border-l border-border/20 space-y-8">
                                            {history.map((log, i) => (
                                                <div key={log.id} className="relative group/log">
                                                    <div className={cn(
                                                        "absolute -left-[1.95rem] top-1 h-3 w-3 rounded-full border-2 bg-card z-10 transition-all group-hover/log:scale-125",
                                                        i === 0 ? "border-primary shadow-[0_0_8px_rgba(14,165,233,0.5)]" : "border-border/40"
                                                    )} />
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between gap-4">
                                                            <span className="text-[10px] font-black text-foreground uppercase tracking-tight truncate">
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

            {/* Photo Zoom Modal */}
            {fullImageUrl && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 backdrop-blur-2xl animate-in fade-in duration-300">
                    <div className="absolute top-6 right-6 z-50 flex items-center gap-4">
                        <div className="flex items-center gap-1 bg-foreground/5 border border-border/20 rounded-2xl p-1.5 backdrop-blur-xl">
                            <button
                                onClick={() => setZoom(prev => Math.min(prev + 0.5, 5))}
                                className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-foreground/10 text-foreground transition-all"
                                title="Zoom In"
                            >
                                <ZoomIn className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => {
                                    setZoom(1);
                                    setPosition({ x: 0, y: 0 });
                                }}
                                className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-foreground/10 text-foreground transition-all"
                                title="Reset"
                            >
                                <RotateCcw className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => setZoom(prev => Math.max(prev - 0.5, 1))}
                                className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-foreground/10 text-foreground transition-all"
                                title="Zoom Out"
                            >
                                <ZoomOut className="h-5 w-5" />
                            </button>
                        </div>
                        <button
                            onClick={() => {
                                setFullImageUrl(null);
                                setZoom(1);
                                setPosition({ x: 0, y: 0 });
                            }}
                            className="h-12 w-12 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center hover:bg-red-500 hover:text-foreground transition-all shadow-lg"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    <div
                        className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
                        onMouseDown={(e) => {
                            if (zoom > 1) {
                                setIsDragging(true);
                                setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
                            }
                        }}
                        onMouseMove={(e) => {
                            if (isDragging && zoom > 1) {
                                setPosition({
                                    x: e.clientX - dragStart.x,
                                    y: e.clientY - dragStart.y
                                });
                            }
                        }}
                        onMouseUp={() => setIsDragging(false)}
                        onMouseLeave={() => setIsDragging(false)}
                    >
                        <img
                            src={fullImageUrl}
                            alt="Zoom"
                            className="max-w-[90vw] max-h-[90vh] aspect-[9/16] object-cover transition-transform duration-200 select-none shadow-2xl rounded-xl"
                            style={{
                                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                                transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                            }}
                            draggable={false}
                        />

                        {zoom === 1 && (
                            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-3 bg-foreground/5 border border-border/20 rounded-full backdrop-blur-md opacity-50">
                                <Move className="h-4 w-4 text-foreground" />
                                <span className="text-[10px] font-black text-foreground uppercase tracking-widest">Use o scroll ou botões para analisar detalhes</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
