import React, { useCallback, useEffect, useRef, useState } from "react";
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
    Camera,
    Trash2,
    ArrowRight,
    Printer,
    Eye
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNavigate } from "react-router-dom";
import { Order, Client, Product } from "@/lib/types";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { logger } from "@/lib/logger";
import { formatProductSizeForLabel } from "@/lib/product-utils";

const statusStyles = {
    PENDENTE: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    CONCLUIDO: "bg-green-500/10 text-green-500 border-green-500/20",
    CANCELADO: "bg-red-500/10 text-red-500 border-red-500/20",
};

type OrderDetails = Order & {
    clients?: Partial<Client> & { name?: string | null };
    order_items?: Array<{
        id: string;
        unit_price?: number | null;
        products?: (Partial<Product> & {
            model?: string | null;
            internal_serial?: string | null;
            original_serial?: string | null;
            brand?: string | null;
            size?: string | null;
            has_water_dispenser?: boolean | null;
        }) | null;
    }>;
};

const ORDER_PDF_LOGO_URL = "https://ambicom.com.br/wp-content/uploads/2019/03/logoambicom.jpg";

const ORDER_PDF_CSS = `
@page { size: A4; margin: 16mm; }
html, body { padding: 0; margin: 0; }
* { box-sizing: border-box; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff; color: #111827; }
.order-pdf-page { width: 210mm; min-height: 297mm; margin: 0 auto; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; }
.order-pdf-card { border: 2px solid #111827; padding: 14mm; }
.order-pdf-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10mm; }
.order-pdf-logo { height: 14mm; width: auto; object-fit: contain; }
.order-pdf-title { font-weight: 800; font-size: 18px; letter-spacing: -0.02em; margin: 0; }
.order-pdf-meta { margin-top: 6px; font-size: 10px; color: #111827; display: flex; gap: 10px; flex-wrap: wrap; }
.order-pdf-section { margin-top: 10mm; break-inside: avoid; }
.order-pdf-section-title { display: flex; align-items: center; gap: 8px; margin: 0 0 6mm; font-size: 12px; font-weight: 800; }
.order-pdf-section-title svg { width: 16px; height: 16px; }
.order-pdf-kv { display: grid; grid-template-columns: 160px 1fr; row-gap: 6px; column-gap: 10px; font-size: 11px; }
.order-pdf-k { font-weight: 800; }
.order-pdf-v { font-weight: 600; }
.order-pdf-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.order-pdf-table th, .order-pdf-table td { border: 2px solid #111827; padding: 6px 8px; vertical-align: top; }
.order-pdf-table th { font-weight: 900; background: #ffffff; }
.order-pdf-table td { font-weight: 600; }
.order-pdf-table thead { display: table-header-group; }
.order-pdf-table tr { break-inside: avoid; }
.order-pdf-summary { margin-top: 8mm; break-inside: avoid; }
.order-pdf-right { text-align: right; }
.order-pdf-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
.order-pdf-muted { color: #374151; }
.order-pdf-total-row td { font-weight: 900; }

@media screen {
  body { background: transparent; }
  .order-pdf-page { width: 794px; min-height: 1123px; }
  .order-pdf-card { padding: 56px; }
  .order-pdf-logo { height: 52px; }
}
`;

function formatCurrencyBRL(value: number | null | undefined): string {
    const normalized = Number.isFinite(value as number) ? (value as number) : 0;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(normalized);
}

function calculateItemsTotal(items?: Array<{ unit_price?: number | null }>): number {
    return (items || []).reduce((acc, item) => acc + Number(item.unit_price || 0), 0);
}

function getUnitPriceForClientAndSize(client: any, sizeLabel: string | null | undefined): number {
    const normalized = (sizeLabel || "").trim();
    if (normalized === "Pequeno") return Number(client?.price_small || 0) || 0;
    if (normalized === "Médio" || normalized === "Medio") return Number(client?.price_medium || 0) || 0;
    if (normalized === "Grande") return Number(client?.price_large || 0) || 0;
    if (normalized === "Grande/A") return Number(client?.price_large_a || 0) || 0;
    return 0;
}

function formatOrderCode(orderId: string): string {
    const short = (orderId || "").split("-")[0] || "";
    return short.toUpperCase();
}

function safeText(value: unknown, fallback: string): string {
    const text = typeof value === "string" ? value.trim() : "";
    return text ? text : fallback;
}

function buildOrderSummaryBySize(order: OrderDetails) {
    const items = (order.order_items || [])
        .map(i => ({
            unitPrice: Number(i.unit_price || 0),
            product: i.products || null
        }))
        .filter(i => i.product);

    const orderKey: Record<string, number> = {
        Pequeno: 1,
        "Médio": 2,
        Medio: 2,
        Grande: 3,
        "Grande/A": 4
    };

    const map = new Map<string, { size: string; qty: number; unit: number; total: number }>();

    for (const item of items) {
        const sizeRaw = (item.product as any)?.size as string | null | undefined;
        const hasWater = Boolean((item.product as any)?.has_water_dispenser);
        const sizeLabel = formatProductSizeForLabel(sizeRaw ?? null, hasWater) || "Não informado";

        const current = map.get(sizeLabel) || { size: sizeLabel, qty: 0, unit: item.unitPrice, total: 0 };
        current.qty += 1;
        current.total += item.unitPrice;
        if (!current.unit && item.unitPrice) current.unit = item.unitPrice;
        map.set(sizeLabel, current);
    }

    const rows = Array.from(map.values()).sort((a, b) => {
        const ka = orderKey[a.size] ?? 999;
        const kb = orderKey[b.size] ?? 999;
        if (ka !== kb) return ka - kb;
        return a.size.localeCompare(b.size, "pt-BR");
    });

    const grandTotal = rows.reduce((acc, r) => acc + r.total, 0);
    return { rows, grandTotal };
}

function OrderPdfDocument({ order, issuedAt }: { order: OrderDetails; issuedAt: Date }) {
    const client = (order as any).clients || {};
    const code = formatOrderCode(order.id);
    const { rows, grandTotal } = buildOrderSummaryBySize(order);

    return (
        <div className="order-pdf-page">
            <style>{ORDER_PDF_CSS}</style>
            <div className="order-pdf-card">
                <div className="order-pdf-header">
                    <div>
                        <h1 className="order-pdf-title">Pedido de Venda #{code}</h1>
                        <div className="order-pdf-meta">
                            <span><span className="order-pdf-muted">Data de Emissão:</span> {issuedAt.toLocaleDateString("pt-BR")}</span>
                            <span><span className="order-pdf-muted">Hora:</span> {issuedAt.toLocaleTimeString("pt-BR")}</span>
                        </div>
                    </div>
                    <img className="order-pdf-logo" src={ORDER_PDF_LOGO_URL} alt="Logo Ambicom" />
                </div>

                <div className="order-pdf-section">
                    <div className="order-pdf-section-title">
                        <User className="h-4 w-4" />
                        Informações do Cliente
                    </div>
                    <div className="order-pdf-kv">
                        <div className="order-pdf-k">Nome:</div>
                        <div className="order-pdf-v">{safeText(client?.name, "N/A")}</div>

                        <div className="order-pdf-k">CPF/CNPJ:</div>
                        <div className="order-pdf-v order-pdf-mono">{safeText(client?.tax_id, "N/A")}</div>

                        <div className="order-pdf-k">Contato:</div>
                        <div className="order-pdf-v">{safeText(client?.phone, "N/A")}</div>

                        <div className="order-pdf-k">Endereço:</div>
                        <div className="order-pdf-v">{safeText(client?.address, "Não informado")}</div>
                    </div>
                </div>

                <div className="order-pdf-section">
                    <div className="order-pdf-section-title">
                        <Package className="h-4 w-4" />
                        Itens do Pedido
                    </div>

                    <table className="order-pdf-table">
                        <thead>
                            <tr>
                                <th>Produto</th>
                                <th>S/N Interno</th>
                                <th>S/N Original</th>
                                <th>Marca</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(order.order_items || []).map((item) => {
                                const p: any = item.products || {};
                                return (
                                    <tr key={item.id}>
                                        <td>{safeText(p?.model, "N/A")}</td>
                                        <td className="order-pdf-mono">{safeText(p?.internal_serial, "N/A")}</td>
                                        <td className="order-pdf-mono">{safeText(p?.original_serial, "N/A")}</td>
                                        <td>{safeText(p?.brand, "N/A")}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    <div className="order-pdf-summary">
                        <table className="order-pdf-table">
                            <thead>
                                <tr>
                                    <th>Tamanhos</th>
                                    <th className="order-pdf-right">Quantidade</th>
                                    <th className="order-pdf-right">Valor Uni.</th>
                                    <th className="order-pdf-right">Valor Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(r => (
                                    <tr key={r.size}>
                                        <td>{r.size}</td>
                                        <td className="order-pdf-right">{r.qty}</td>
                                        <td className="order-pdf-right">{formatCurrencyBRL(r.unit)}</td>
                                        <td className="order-pdf-right">{formatCurrencyBRL(r.total)}</td>
                                    </tr>
                                ))}
                                <tr className="order-pdf-total-row">
                                    <td colSpan={3} className="order-pdf-right">Total:</td>
                                    <td className="order-pdf-right">{formatCurrencyBRL(grandTotal || order.total_amount || 0)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function OrdersPage() {
    const { profile, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const PAGE_SIZE = 20;

    const [showAddModal, setShowAddModal] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClient, setSelectedClient] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [isFetchingDetails, setIsFetchingDetails] = useState(false);
    const [mountingOrderItems, setMountingOrderItems] = useState<{ product: Product; unitPrice: number }[]>([]);
    const [mountingScanInput, setMountingScanInput] = useState("");
    const [showMountingCamera, setShowMountingCamera] = useState(false);
    const [detectedScanCode, setDetectedScanCode] = useState("");
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [pdfPreviewOrder, setPdfPreviewOrder] = useState<OrderDetails | null>(null);
    const [pdfPreviewIssuedAt, setPdfPreviewIssuedAt] = useState<Date | null>(null);
    const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
    const [isPreparingPdfPreview, setIsPreparingPdfPreview] = useState(false);
    const pdfPrintableRef = useRef<HTMLDivElement | null>(null);




    useEffect(() => {
        let isChecking = false;

        const startScanner = async () => {
            if (isChecking) return;
            isChecking = true;

            try {
                // Ensure Any previous instance is stopped and cleared
                if (scannerRef.current) {
                    try {
                        if (scannerRef.current.isScanning) {
                            await scannerRef.current.stop();
                        }
                    } catch (e) { /* ignore */ }
                    scannerRef.current = null;
                }

                // Ensure DOM element is ready
                await new Promise(resolve => setTimeout(resolve, 500));

                const element = document.getElementById("mounting-reader");
                if (!element) return;

                const html5QrCode = new Html5Qrcode("mounting-reader");
                scannerRef.current = html5QrCode;

                const config = {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
                };

                const cameras = await Html5Qrcode.getCameras();
                if (cameras && cameras.length > 0) {
                    const backCamera = cameras.find(c =>
                        c.label.toLowerCase().includes("back") ||
                        c.label.toLowerCase().includes("traseira") ||
                        c.label.toLowerCase().includes("rear")
                    );
                    const cameraId = backCamera ? backCamera.id : cameras[0].id;

                    await html5QrCode.start(
                        cameraId,
                        config,
                        (decodedText) => {
                            setDetectedScanCode(decodedText);
                            setMountingScanInput(decodedText);
                        },
                        (errorMessage) => { }
                    );
                } else {
                    await html5QrCode.start(
                        { facingMode: "environment" },
                        config,
                        (decodedText) => {
                            setDetectedScanCode(decodedText);
                            setMountingScanInput(decodedText);
                        },
                        (errorMessage) => { }
                    );
                }
            } catch (err) {
                logger.error("Erro ao iniciar câmera:", err);
                // toast handles errors
            } finally {
                isChecking = false;
            }
        };

        if (showMountingCamera) {
            startScanner();
        }

        return () => {
            if (scannerRef.current) {
                const scanner = scannerRef.current;
                if (scanner.isScanning) {
                    scanner.stop().then(() => {
                        scannerRef.current = null;
                    }).catch(e => {
                        logger.error("Erro ao parar scanner no cleanup:", e);
                    });
                } else {
                    scannerRef.current = null;
                }
            }
        };
    }, [showMountingCamera]);


    const handleScanMountingCode = (code: string) => {
        handleAddProductToOrder(code);
    };

    const ensureClientPricing = async (order: Order): Promise<any | null> => {
        const currentClient = (order as any)?.clients;
        const hasPricing = currentClient && (
            currentClient.price_small !== undefined ||
            currentClient.price_medium !== undefined ||
            currentClient.price_large !== undefined ||
            currentClient.price_large_a !== undefined
        );

        if (hasPricing) return currentClient;

        const clientId = (order as any)?.client_id;
        if (!clientId) return currentClient || null;

        const { data, error } = await supabase
            .from("clients")
            .select("*")
            .eq("id", clientId)
            .maybeSingle();

        if (error) throw error;
        return data || currentClient || null;
    };

    const handleAddProductToOrder = async (code: string) => {
        if (!selectedOrder || selectedOrder.status !== "PENDENTE") {
            toast.error("Selecione um pedido pendente ativo.");
            return;
        }

        if (!code) return;

        const input = code.trim().toUpperCase();

        // Prevent duplicates in current order
        if (selectedOrder.order_items?.some((item: any) =>
            item.products?.internal_serial?.toUpperCase() === input ||
            item.products?.original_serial?.toUpperCase() === input
        )) {
            toast.info("Este item já está na lista!", {
                description: "O produto já foi scaneado e adicionado a este pedido."
            });
            setMountingScanInput("");
            return;
        }


        try {
            // First find the product regardless of status to give better feedback
            const { data: productData, error: productError } = await supabase
                .from("products")
                .select("*")
                .or(`internal_serial.eq."${input}",original_serial.eq."${input}"`)
                .maybeSingle();

            if (productError || !productData) {
                toast.error("Produto não encontrado.", {
                    description: "Verifique o QR Code ou digite o código manualmente."
                });
                return;
            }

            const product = productData as Product;

            // Check if product is available
            if (product.status !== "EM ESTOQUE" || product.order_id !== null) {
                const analysisStatuses = new Set<Product["status"]>([
                    "CADASTRO",
                    "EM AVALIAÇÃO",
                    "TECNICO",
                    "SUPERVISOR",
                    "GESTOR"
                ]);

                const description = (() => {
                    if (product.status === "VENDIDO") return "Este item já foi vendido.";
                    if (product.order_id) return "Este item já está reservado em outro pedido.";
                    if (analysisStatuses.has(product.status)) return "Este item ainda está em análise, aguardando liberação para o estoque.";
                    if (product.status === "LIBERADO") return "Este item foi liberado, mas ainda não consta como em estoque.";
                    if (product.status === "RECUSADO" || product.status === "REPROVADO") return "Este item foi recusado na avaliação e não pode ser adicionado a pedidos.";
                    return `Este item está com status "${product.status}" e não está disponível para venda.`;
                })();

                toast.warning("Produto indisponível!", {
                    description
                });
                return;
            }

            const client = await ensureClientPricing(selectedOrder);
            const sizeLabel = formatProductSizeForLabel(product.size, product.has_water_dispenser) || product.size;
            const unitPrice = getUnitPriceForClientAndSize(client, sizeLabel);

            const { error: updateError } = await supabase
                .from("products")
                .update({ order_id: selectedOrder.id })
                .eq("id", product.id);

            if (updateError) throw updateError;

            const { error: insertError } = await supabase
                .from("order_items")
                .insert([{
                    order_id: selectedOrder.id,
                    product_id: product.id,
                    unit_price: unitPrice
                }]);

            if (insertError) throw insertError;

            toast.success("Produto adicionado!", {
                description: `${product.brand} ${product.model} - R$ ${unitPrice.toFixed(2)}`
            });

            setMountingScanInput("");

            // Reload order details smoothly and silently to keep scanner open
            handleViewOrder(selectedOrder, true);
            fetchOrders(true);
        } catch (err) {
            logger.error("Erro ao buscar/adicionar produto:", err);
            toast.error("Erro ao buscar produto.");
        }
    };

    const syncOrderTotalIfNeeded = async (
        orderId: string,
        items?: Array<{ unit_price?: number | null }>,
        currentTotal?: number | null,
        silent: boolean = false
    ): Promise<number> => {
        const recalculatedTotal = calculateItemsTotal(items);
        const storedTotal = Number(currentTotal || 0);
        const hasDrift = Math.abs(recalculatedTotal - storedTotal) > 0.009;

        if (!hasDrift) return storedTotal;

        const { data: rpcData, error: rpcError } = await supabase
            .rpc("recalculate_order_total", { p_order_id: orderId });

        if (rpcError) throw rpcError;

        if (!silent) {
            toast.info("Total do pedido auto-sincronizado.", {
                description: "Detectamos divergência e ajustamos o valor com base nos itens."
            });
        }

        return Number(rpcData ?? recalculatedTotal);
    };

    const handleRemoveItemFromOrder = async (itemId: string, productId?: string | null) => {
        if (!selectedOrder || selectedOrder.status !== "PENDENTE") return;

        setIsSaving(true);
        try {
            const { error: deleteError } = await supabase
                .from("order_items")
                .delete()
                .eq("id", itemId);

            if (deleteError) throw deleteError;

            if (productId) {
                const { error: updateError } = await supabase
                    .from("products")
                    .update({ order_id: null })
                    .eq("id", productId);

                if (updateError) throw updateError;
            }

            toast.info("Produto removido do pedido.");

            handleViewOrder(selectedOrder, true);
            fetchOrders(true);
        } catch (err) {
            logger.error("Erro ao remover produto:", err);
            toast.error("Erro ao remover produto.");
        } finally {
            setIsSaving(false);
        }
    };

    const isAuthorized = profile?.role === "GESTOR" || profile?.role === "ADMIN" || profile?.role === "TECNICO" || profile?.role === "SUPERVISOR";
    const canCreateOrder = profile?.role === "GESTOR" || profile?.role === "ADMIN" || profile?.role === "SUPERVISOR";

    const canDeleteThisOrder = (order: Order) => {
        if (order.status === 'CONCLUIDO') {
            return profile?.role === 'ADMIN';
        }
        return profile?.role === 'ADMIN' || profile?.role === 'GESTOR' || profile?.role === 'SUPERVISOR';
    };

    useEffect(() => {
        setPage(0);
    }, [searchTerm]);

    const fetchOrders = useCallback(async (silent: boolean = false) => {
        if (!silent) setIsLoading(true);
        try {
            let query = supabase
                .from("orders")
                .select("*, clients!inner(name), order_items(id, products(model, internal_serial, original_serial, brand))", { count: 'exact' })
                .order("created_at", { ascending: false })
                .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

            if (searchTerm) {
                query = query.ilike('id', `%${searchTerm}%`);
            }

            const { data, count, error } = await query;

            if (error) throw error;
            setOrders((data as Order[]) || []);
            setTotalCount(count || 0);
        } catch (error) {
            const err = error as Error;
            logger.error("Erro ao buscar pedidos:", err);
            toast.error("Erro ao carregar pedidos", { description: err.message });
        } finally {
            setIsLoading(false);
        }
    }, [page, searchTerm]);

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
    }, [authLoading, fetchOrders, isAuthorized, navigate]);

    const fetchOrderForPdf = async (orderId: string): Promise<OrderDetails> => {
        const { data, error } = await supabase
            .from("orders")
            .select(`
                *,
                clients (*),
                order_items (
                    id,
                    unit_price,
                    products (*)
                )
            `)
            .eq("id", orderId)
            .single();

        if (error) throw error;
        return data as OrderDetails;
    };

    const openPdfPreview = async (order: Order) => {
        setIsPreparingPdfPreview(true);
        try {
            if (!order?.id) {
                toast.error("Pedido inválido para gerar PDF.");
                return;
            }

            const details = await fetchOrderForPdf(order.id);
            const items = details.order_items || [];

            if (!details.clients || !safeText((details as any).clients?.name, "")) {
                toast.error("Dados do cliente ausentes.", { description: "Verifique o cadastro do cliente antes de gerar o PDF." });
                return;
            }

            if (items.length === 0) {
                toast.error("Pedido sem itens.", { description: "Adicione produtos ao pedido antes de gerar o PDF." });
                return;
            }

            setPdfPreviewOrder(details);
            setPdfPreviewIssuedAt(new Date());
            setShowPdfPreviewModal(true);
        } catch (err) {
            logger.error("Erro ao preparar preview do PDF:", err);
            toast.error("Erro ao preparar preview do PDF.");
        } finally {
            setIsPreparingPdfPreview(false);
        }
    };

    const handlePrintPdfPreview = async () => {
        const content = pdfPrintableRef.current;
        if (!content) {
            toast.error("Não foi possível preparar a impressão.");
            return;
        }

        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        iframe.setAttribute("aria-hidden", "true");
        document.body.appendChild(iframe);

        const doc = iframe.contentDocument;
        const win = iframe.contentWindow;
        if (!doc || !win) {
            iframe.remove();
            toast.error("Impressão indisponível neste navegador.");
            return;
        }

        const title = pdfPreviewOrder ? `Pedido_${formatOrderCode(pdfPreviewOrder.id)}` : "Pedido";
        doc.open();
        doc.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${ORDER_PDF_CSS}</style></head><body></body></html>`);
        doc.close();
        doc.body.innerHTML = content.innerHTML;

        const images = Array.from(doc.images || []);
        if (images.length > 0) {
            await Promise.all(images.map((img) => new Promise<void>((resolve) => {
                if (img.complete) {
                    resolve();
                    return;
                }
                const onDone = () => {
                    img.removeEventListener("load", onDone);
                    img.removeEventListener("error", onDone);
                    resolve();
                };
                img.addEventListener("load", onDone);
                img.addEventListener("error", onDone);
            })));
        }

        const cleanup = () => {
            iframe.remove();
        };

        const onAfterPrint = () => {
            win.removeEventListener("afterprint", onAfterPrint);
            cleanup();
        };
        win.addEventListener("afterprint", onAfterPrint);

        setTimeout(() => {
            try {
                win.focus();
                win.print();
            } catch (e) {
                cleanup();
                toast.error("Falha ao abrir diálogo de impressão.");
            }
        }, 150);
    };

    const handleExportPDF = async (order?: Order) => {
        const { exportToPDF } = await import("@/lib/export-utils");
        if (order) {
            await openPdfPreview(order);
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
        const data = orders.map(o => ({
            "ID Pedido": o.id,
            "Cliente": o.clients?.name || "N/A",
            "Status": o.status,
            "Data": new Date(o.created_at).toLocaleString("pt-BR")
        }));
        exportToExcel(data, "pedidos_scan");
    };

    const prepareNewOrder = async () => {
        setShowAddModal(true);
        setMountingOrderItems([]);
        setMountingScanInput("");
        const { data: cData } = await supabase.from("clients").select("*");
        setClients((cData as Client[]) || []);
    };

    const handleCreateOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClient) {
            toast.error("Selecione um cliente.");
            return;
        }

        setIsSaving(true);
        try {
            const { error: orderError } = await supabase
                .from("orders")
                .insert([{
                    client_id: selectedClient,
                    status: "PENDENTE",
                    total_amount: 0
                }]);

            if (orderError) throw orderError;

            toast.success("Pedido criado com sucesso!", {
                description: "Agora você pode abri-lo para adicionar os produtos."
            });
            setShowAddModal(false);
            setSelectedClient("");
            fetchOrders();
        } catch (error) {
            const err = error as Error;
            toast.error("Erro ao criar pedido", { description: err.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleViewOrder = async (order: Order, silent: boolean = false) => {
        setShowDetailsModal(true);
        if (!silent) setIsFetchingDetails(true);
        setSelectedOrder(prev => (silent && prev?.id === order.id ? prev : order));
        try {
            const { data, error } = await supabase
                .from("orders")
                .select(`
                    *,
                    clients (*),
                    order_items (
                        id,
                        unit_price,
                        products (*)
                    )
                `)
                .eq("id", order.id)
                .single();

            if (error) throw error;
            const detailedOrder = data as Order;

            const client = await ensureClientPricing(detailedOrder);
            const itemsToFix = (detailedOrder.order_items || []).filter((item: any) => {
                const current = Number(item?.unit_price || 0);
                return current <= 0 && item?.products;
            });

            if (client && itemsToFix.length > 0 && detailedOrder.status === "PENDENTE") {
                await Promise.all(itemsToFix.map(async (item: any) => {
                    const sizeLabel = formatProductSizeForLabel(item.products?.size, item.products?.has_water_dispenser) || item.products?.size;
                    const expected = getUnitPriceForClientAndSize(client, sizeLabel);
                    if (!(expected > 0)) return;
                    const { error: updateItemError } = await supabase
                        .from("order_items")
                        .update({ unit_price: expected })
                        .eq("id", item.id);
                    if (updateItemError) throw updateItemError;
                }));

                const { data: refreshed, error: refreshError } = await supabase
                    .from("orders")
                    .select(`
                        *,
                        clients (*),
                        order_items (
                            id,
                            unit_price,
                            products (*)
                        )
                    `)
                    .eq("id", order.id)
                    .single();

                if (refreshError) throw refreshError;
                (detailedOrder as any).order_items = (refreshed as any)?.order_items || (detailedOrder as any).order_items;
                (detailedOrder as any).clients = (refreshed as any)?.clients || (detailedOrder as any).clients;
                (detailedOrder as any).total_amount = (refreshed as any)?.total_amount ?? (detailedOrder as any).total_amount;
            }
            const syncedTotal = await syncOrderTotalIfNeeded(
                detailedOrder.id,
                detailedOrder.order_items,
                detailedOrder.total_amount,
                silent
            );
            setSelectedOrder({
                ...detailedOrder,
                total_amount: syncedTotal
            } as Order);
        } catch (error) {
            logger.error("Erro ao buscar detalhes do pedido:", error);
            toast.error("Erro ao carregar detalhes do pedido");
        } finally {
            setIsFetchingDetails(false);
        }
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

    const handleDeleteOrder = async (order: Order) => {
        if (!canDeleteThisOrder(order)) {
            toast.error("Apenas administradores podem excluir pedidos finalizados.");
            return;
        }
        if (!confirm("Deseja realmente EXCLUIR este pedido permanentemente? Os produtos voltarão ao estoque e a ação é irreversível.")) return;

        setIsSaving(true);
        try {
            const { error: productError } = await supabase
                .from("products")
                .update({ order_id: null, status: "EM ESTOQUE" })
                .eq("order_id", order.id);

            if (productError) throw productError;

            const { error: itemsError } = await supabase
                .from("order_items")
                .delete()
                .eq("order_id", order.id);

            if (itemsError) throw itemsError;

            const { error: orderError } = await supabase
                .from("orders")
                .delete()
                .eq("id", order.id);

            if (orderError) throw orderError;

            toast.success("Pedido excluído com sucesso!");
            if (selectedOrder?.id === order.id) {
                setShowDetailsModal(false);
            }
            fetchOrders();
        } catch (error) {
            toast.error("Erro ao excluir pedido");
        } finally {
            setIsSaving(false);
        }
    };

    const handleFinalizeOrder = async (order: Order) => {
        if (!order.order_items || order.order_items.length === 0) {
            toast.error("Não é possível finalizar um pedido sem produtos.");
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
                        <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-foreground uppercase italic">Logística <span className="text-primary not-italic font-light">& Expedição</span></h1>
                        <p className="text-muted-foreground font-medium text-sm mt-1 opacity-70 italic">Gerenciamento de fluxo de saída e ordens de serviço.</p>
                    </div>
                    {canCreateOrder && (
                        <button
                            onClick={prepareNewOrder}
                            className="w-full md:w-auto h-12 sm:h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-[10px] px-6 sm:px-10 rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-3 whitespace-nowrap"
                        >
                            <Plus className="h-4 w-4" />
                            Novo Pedido
                        </button>
                    )}
                </div>

                <div className="flex flex-col md:flex-row gap-4 py-2">
                    <div className="relative flex-1 group max-w-2xl w-full">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Pesquisar por ID ou Cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-2xl border border-border/20 bg-card/50 py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all text-foreground shadow-inner backdrop-blur-sm"
                        />
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-4 bg-card/50 border border-border/10 rounded-2xl px-6 py-3 shadow-inner">
                            <Download className="h-5 w-5 text-emerald-500" />
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Faturamento</span>
                                <span className="text-sm font-black text-foreground">{orders.length} Totais</span>
                            </div>
                        </div>
                        <div className="flex items-center bg-foreground/5 rounded-xl p-1 border border-border/20 shadow-lg">
                            <button
                                onClick={() => handleExportPDF()}
                                className="p-2.5 hover:bg-foreground/10 rounded-lg text-muted-foreground hover:text-foreground transition-all active:scale-90"
                                title="Exportar PDF"
                            >
                                <FileDown className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => handleExportExcel()}
                                className="p-2.5 hover:bg-foreground/10 rounded-lg text-emerald-500 hover:text-emerald-400 transition-all active:scale-90"
                                title="Exportar Excel"
                            >
                                <Download className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {filteredOrders.length > 0 ? (
                    <div className="space-y-4">
                        {/* Mobile Compact View */}
                        <div className="md:hidden space-y-3 px-2">
                            {filteredOrders.map((order) => {
                                const style = statusStyles[order.status as keyof typeof statusStyles];
                                const isExpanded = expandedId === order.id;
                                return (
                                    <div
                                        key={order.id}
                                        className={cn(
                                            "bg-card/40 border border-border/10 rounded-2xl overflow-hidden transition-all duration-300",
                                            isExpanded ? "ring-1 ring-primary/30 bg-card/60 shadow-lg" : "hover:bg-card/50"
                                        )}
                                    >
                                        {/* Main Row */}
                                        <div
                                            onClick={() => setExpandedId(isExpanded ? null : order.id)}
                                            className="p-4 flex items-center justify-between cursor-pointer active:bg-foreground/5"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                                    <Package className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-mono font-black text-primary/70">#{order.id.split("-")[0].toUpperCase()}</span>
                                                        <span className={cn("text-[8px] font-black uppercase px-2 py-0.5 rounded-full border leading-none", style)}>
                                                            {order.status}
                                                        </span>
                                                    </div>
                                                    <h4 className="font-black text-foreground text-sm uppercase italic truncate">
                                                        {(order as any).clients?.name || "N/A"}
                                                    </h4>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <div className="text-right mr-1">
                                                    <p className="text-[10px] font-black text-foreground/40 uppercase leading-none">Data</p>
                                                    <p className="text-[10px] font-bold text-foreground/60">{new Date(order.created_at).toLocaleDateString("pt-BR")}</p>
                                                </div>
                                                <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300", isExpanded && "rotate-90")} />
                                            </div>
                                        </div>

                                        {/* Expanded Content */}
                                        {isExpanded && (
                                            <div className="px-4 pb-4 pt-2 border-t border-border/5 bg-foreground/5 animate-in slide-in-from-top-2 duration-300">
                                                <div className="grid grid-cols-2 gap-4 mb-4">
                                                    <div className="space-y-1">
                                                        <p className="text-[8px] font-black text-muted-foreground uppercase opacity-50">Local de Destino</p>
                                                        <p className="text-[10px] font-bold text-foreground uppercase">{(order as any).clients?.address || "NÃO INFORMADO"}</p>
                                                    </div>
                                                    <div className="space-y-1 text-right">
                                                        <p className="text-[8px] font-black text-muted-foreground uppercase opacity-50">Valor Total</p>
                                                        <p className="text-[10px] font-bold text-foreground">R$ {order.total_amount?.toFixed(2) || "0.00"}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleViewOrder(order)}
                                                        className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all text-[10px] font-black uppercase tracking-widest border border-primary/20"
                                                    >
                                                        <ArrowRight className="h-4 w-4" />
                                                        Abrir Pedido
                                                    </button>
                                                    <button
                                                        onClick={() => handleExportPDF(order)}
                                                        className="h-12 w-12 flex items-center justify-center rounded-xl bg-white/5 text-muted-foreground hover:bg-white/10 transition-all border border-border/10"
                                                    >
                                                        <FileDown className="h-4 w-4" />
                                                    </button>
                                                    {canDeleteThisOrder(order) && (
                                                        <button
                                                            onClick={() => handleDeleteOrder(order)}
                                                            className="h-12 w-12 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all border border-red-500/20"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block glass-card overflow-hidden rounded-2xl border border-border/20 shadow-2xl p-0">
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
                                    <table className="w-full text-left text-sm border-collapse min-w-[800px] sm:min-w-full">
                                        <thead className="bg-foreground/5 text-muted-foreground uppercase text-[9px] sm:text-[10px] font-black tracking-widest border-b border-border/10 sticky top-0 z-30 backdrop-blur-md">
                                            <tr>
                                                <th className="px-4 sm:px-6 py-5 whitespace-nowrap sticky left-0 bg-card/95 z-40 border-r border-border/10 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">Código / OS</th>
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
                                                    <td className="px-4 sm:px-6 py-5 whitespace-nowrap sticky left-0 bg-card/95 group-hover:bg-card/95 transition-colors z-30 border-r border-border/10 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all border border-primary/10">
                                                                <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                            </div>
                                                            <span className="font-mono text-xs sm:text-sm font-black text-foreground/80 group-hover:text-primary transition-colors">
                                                                #{order.id.split("-")[0].toUpperCase()}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                                                        <div className="flex flex-col">
                                                            <span className="text-foreground font-black text-[13px] sm:text-base leading-tight uppercase italic transition-colors group-hover:text-primary">{(order as any).clients?.name || "N/A"}</span>
                                                            <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5 font-black opacity-60">Venda Direta</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 sm:px-6 py-5 text-center whitespace-nowrap">
                                                        <span className={cn("inline-flex px-2 sm:px-3 py-1 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-wider border shadow-sm", statusStyles[order.status as keyof typeof statusStyles])}>
                                                            {order.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                                                        <div className="flex items-center gap-2 text-muted-foreground text-[10px] sm:text-xs font-black bg-foreground/5 w-fit px-2 sm:px-3 py-1 sm:py-1 rounded-lg border border-border/10 shadow-inner uppercase tracking-tighter sm:tracking-normal">
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
                                                                className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center text-muted-foreground hover:bg-foreground/10 rounded-xl transition-all hover:text-foreground border border-transparent hover:border-border/20"
                                                                title="Exportar PDF"
                                                            >
                                                                <FileDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                            </button>
                                                            {canDeleteThisOrder(order) && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteOrder(order);
                                                                    }}
                                                                    className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center text-muted-foreground hover:bg-red-500/10 rounded-xl transition-all hover:text-red-500 border border-transparent hover:border-red-500/20"
                                                                    title="Excluir Pedido"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleViewOrder(order);
                                                                }}
                                                                className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center text-muted-foreground hover:bg-primary rounded-lg sm:rounded-xl transition-all group-hover:text-primary-foreground hover:scale-110 active:scale-95 border border-transparent hover:border-primary/10 shadow-lg"
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
                            <div className="flex items-center justify-between p-4 border-t border-border/10 bg-card/50">
                                <span className="text-xs text-muted-foreground font-medium">
                                    Mostrando <span className="text-foreground font-bold">{orders.length}</span> de <span className="text-foreground font-bold">{totalCount}</span> pedidos
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPage(p => Math.max(0, p - 1))}
                                        disabled={page === 0}
                                        className="p-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <span className="text-xs font-bold text-foreground px-3 bg-foreground/5 py-2 rounded-lg border border-border/10">
                                        Página {page + 1}
                                    </span>
                                    <button
                                        onClick={() => setPage(p => p + 1)}
                                        disabled={(page + 1) * PAGE_SIZE >= totalCount}
                                        className="p-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="glass-card flex flex-col items-center justify-center py-24 text-center border-dashed border-2 border-border/10 bg-white/[0.01]">
                        <div className="h-24 w-24 rounded-full bg-foreground/5 flex items-center justify-center mb-8 relative shadow-inner">
                            <AlertCircle className="h-12 w-12 text-muted-foreground/20" />
                            <div className="absolute inset-0 rounded-full border border-border/10 animate-pulse" />
                        </div>
                        <h3 className="text-2xl font-black text-foreground mb-2 uppercase tracking-tighter">Sem resultados</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto text-sm leading-relaxed italic opacity-80">
                            {searchTerm ? "Não encontramos nada para sua busca. Tente palavras-chave diferentes." : "O fluxo de faturamento está pronto. Inicie criando um novo pedido de saída."}
                        </p>
                    </div>
                )}

                {/* Modal de Novo Pedido */}
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-500">
                        <div className="glass-card w-full max-w-2xl space-y-6 sm:space-y-8 border-border/20 shadow-2xl p-6 sm:p-10 bg-card/90 relative overflow-y-auto max-h-[95vh]">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                            <div className="flex items-center justify-between relative">
                                <div className="space-y-1">
                                    <h2 className="text-3xl font-black text-foreground tracking-tight">Novo Pedido</h2>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-black">Fluxo de Expedição de Inventário</p>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="h-12 w-12 rounded-2xl bg-foreground/5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all hover:bg-red-500/20 hover:text-red-500 border border-border/20">
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
                                            className="w-full bg-background border border-border/20 rounded-2xl pl-12 pr-10 h-16 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all appearance-none text-foreground shadow-inner font-bold"
                                            value={selectedClient}
                                            onChange={(e) => setSelectedClient(e.target.value)}
                                        >
                                            <option value="" className="bg-background text-muted-foreground">Selecione o cliente / parceiro...</option>
                                            {clients.map(c => (
                                                <option key={c.id} value={c.id} className="bg-background text-foreground">{c.name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground opacity-50 group-focus-within:opacity-100 transition-opacity">
                                            <ChevronRight className="h-5 w-5 rotate-90" />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="submit"
                                        disabled={isSaving || !selectedClient}
                                        className="flex-[2] h-16 bg-primary text-primary-foreground rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:brightness-110 active:scale-95 disabled:grayscale disabled:opacity-50 transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3"
                                    >
                                        {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Plus className="h-6 w-6" />}
                                        Criar Pedido
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="flex-1 h-16 rounded-2xl border border-border/20 bg-foreground/5 hover:bg-foreground/10 transition-all text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground"
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-500">
                    <div className="glass-card w-full max-w-4xl max-h-[95vh] overflow-hidden border-border/20 shadow-2xl bg-card/90 relative flex flex-col">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                        {/* Modal Header */}
                        <div className="p-6 sm:p-8 border-b border-border/20 flex items-center justify-between shrink-0">
                            <div className="space-y-1">
                                <h2 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-3">
                                    Pedido #{selectedOrder.id.split("-")[0].toUpperCase()}
                                    <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border", statusStyles[selectedOrder.status as keyof typeof statusStyles])}>
                                        {selectedOrder.status}
                                    </span>
                                </h2>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-black">Detalhes Completos da Transação</p>
                            </div>
                            <button onClick={() => setShowDetailsModal(false)} className="h-12 w-12 rounded-2xl bg-foreground/5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all hover:bg-red-500/20 hover:text-red-500 border border-border/20">
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
                                    {/* Resumo por Tamanho */}
                                    {selectedOrder.order_items && selectedOrder.order_items.length > 0 && (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                                            {['Pequeno', 'Médio', 'Grande', 'Grande/A'].map(size => {
                                                const count = selectedOrder.order_items?.filter((item: any) => {
                                                    const product = item.products;
                                                    const sizeLabel = formatProductSizeForLabel(product?.size, product?.has_water_dispenser) || product?.size;
                                                    return sizeLabel === size;
                                                }).length || 0;
                                                return (
                                                    <div key={size} className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex flex-col items-center justify-center">
                                                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{size}</span>
                                                        <span className="text-xl font-black text-primary">{count}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Client Info Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] flex items-center gap-2">
                                                <User className="h-3 w-3" />
                                                Dados do Cliente
                                            </h3>
                                            <div className="bg-foreground/5 rounded-2xl p-6 border border-border/10 space-y-4">
                                                <div>
                                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Nome Completo</p>
                                                    <p className="text-foreground font-bold text-lg">{(selectedOrder as any).clients?.name || "N/A"}</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/10">
                                                    <div>
                                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">CPF/CNPJ</p>
                                                        <p className="text-foreground font-mono text-sm">{(selectedOrder as any).clients?.tax_id || "N/A"}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Telefone</p>
                                                        <p className="text-foreground text-sm">{(selectedOrder as any).clients?.phone || "N/A"}</p>
                                                    </div>
                                                </div>
                                                <div className="pt-4 border-t border-border/10">
                                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Endereço</p>
                                                    <p className="text-foreground text-sm">{(selectedOrder as any).clients?.address || "Não informado"}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] flex items-center gap-2">
                                                <Calendar className="h-3 w-3" />
                                                Informações do Pedido
                                            </h3>
                                            <div className="bg-foreground/5 rounded-2xl p-6 border border-border/10 space-y-4 h-full">
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div>
                                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Data de Criação</p>
                                                        <p className="text-foreground font-bold">{new Date(selectedOrder.created_at).toLocaleDateString("pt-BR")}</p>
                                                        <p className="text-[10px] text-muted-foreground">{new Date(selectedOrder.created_at).toLocaleTimeString("pt-BR")}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Última Atualização</p>
                                                        <p className="text-foreground font-bold">{new Date(selectedOrder.updated_at).toLocaleDateString("pt-BR")}</p>
                                                        <p className="text-[10px] text-muted-foreground">{new Date(selectedOrder.updated_at).toLocaleTimeString("pt-BR")}</p>
                                                    </div>
                                                </div>
                                                <div className="pt-4 border-t border-border/10">
                                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">ID Único (UUID)</p>
                                                    <p className="text-muted-foreground font-mono text-[10px] break-all">{selectedOrder.id}</p>
                                                </div>
                                                <div className="pt-4 border-t border-border/10">
                                                    <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">Valor Total do Pedido</p>
                                                    <p className="text-2xl font-black text-foreground italic">R$ {selectedOrder.total_amount?.toFixed(2) || "0.00"}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Products List */}
                                    <div className="space-y-4 pt-4">

                                        {/* Scanner Interface (Only for PENDENTE) */}
                                        {selectedOrder.status === "PENDENTE" && (
                                            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 sm:p-6 space-y-4 mb-4">
                                                <div className="flex flex-col sm:flex-row items-center gap-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowMountingCamera(!showMountingCamera)}
                                                        className={cn(
                                                            "h-14 w-full sm:w-14 rounded-2xl flex items-center justify-center transition-all border shrink-0",
                                                            showMountingCamera ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                                                        )}
                                                    >
                                                        {showMountingCamera ? <X className="h-6 w-6" /> : <Camera className="h-6 w-6" />}
                                                    </button>
                                                    <div className="flex-1 w-full">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2 italic">Aguardando Escaneamento...</p>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={mountingScanInput}
                                                                onChange={(e) => setMountingScanInput(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        handleAddProductToOrder(mountingScanInput);
                                                                    }
                                                                }}
                                                                placeholder="Escaneie ou digite o código do produto..."
                                                                className="w-full h-14 bg-card/40 border border-border/20 rounded-xl px-6 text-sm text-foreground placeholder:text-muted-foreground/30 focus:border-primary/50 transition-all outline-none"
                                                            />
                                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:block">
                                                                <span className="text-[8px] font-bold text-muted-foreground/30 bg-foreground/5 px-2 py-1 rounded">ENTER</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {showMountingCamera && (
                                                    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 sm:p-8 animate-in fade-in duration-300">
                                                        <div className="w-full max-w-4xl relative">
                                                            <div className="absolute -top-16 left-0 right-0 flex items-center justify-between px-4">
                                                                <div className="flex flex-col">
                                                                    <h3 className="text-white text-xl font-black uppercase tracking-tighter italic">Scanner Ativo</h3>
                                                                    <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest">Aponte somente para o QR Code da etiqueta</p>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={async () => {
                                                                        if (scannerRef.current && scannerRef.current.isScanning) {
                                                                            await scannerRef.current.stop();
                                                                            scannerRef.current = null;
                                                                        }
                                                                        setShowMountingCamera(false);
                                                                    }}
                                                                    className="h-12 w-12 rounded-2xl bg-white/10 hover:bg-red-500/20 text-white hover:text-red-500 flex items-center justify-center transition-all backdrop-blur-xl border border-white/10 hover:border-red-500/20 active:scale-95"
                                                                >

                                                                    <X className="h-6 w-6" />
                                                                </button>
                                                            </div>

                                                            <div className="bg-card/40 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl relative aspect-[4/3] sm:aspect-video flex items-center justify-center font-black">
                                                                <div id="mounting-reader" className="w-full h-full object-cover"></div>

                                                                <div className="absolute inset-0 pointer-events-none border-[2px] border-primary/20 rounded-[2.5rem]"></div>
                                                                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-primary/30 shadow-[0_0_15px_rgba(34,197,94,0.5)] animate-infinite-scan z-10"></div>
                                                            </div>

                                                            <div className="mt-8 flex flex-col items-center gap-6">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        handleAddProductToOrder(mountingScanInput || detectedScanCode);
                                                                        setDetectedScanCode("");
                                                                    }}
                                                                    className={cn(
                                                                        "h-24 w-24 rounded-full flex items-center justify-center border-4 active:scale-90 transition-all group relative",
                                                                        (mountingScanInput || detectedScanCode)
                                                                            ? "bg-primary shadow-[0_0_40px_rgba(34,197,94,0.6)] border-white/40"
                                                                            : "bg-muted text-muted-foreground border-white/10 opacity-50 cursor-not-allowed"
                                                                    )}
                                                                    disabled={!mountingScanInput && !detectedScanCode}
                                                                >
                                                                    {(mountingScanInput || detectedScanCode) && (
                                                                        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-full animate-bounce shadow-lg border-2 border-white">
                                                                            CAPTURAR
                                                                        </div>
                                                                    )}
                                                                    <div className="h-16 w-16 rounded-full border-2 border-white/20 flex items-center justify-center">
                                                                        <Camera className={cn("h-8 w-8", (mountingScanInput || detectedScanCode) ? "text-white" : "text-muted-foreground")} />
                                                                    </div>
                                                                </button>

                                                                <div className="flex flex-col items-center gap-3">
                                                                    {(mountingScanInput || detectedScanCode) ? (
                                                                        <div className="bg-primary/20 backdrop-blur-xl px-6 py-3 rounded-2xl border border-primary/30 shadow-2xl animate-in zoom-in-95 duration-200">
                                                                            <p className="text-primary text-[10px] uppercase font-black tracking-widest mb-1 text-center">Código Identificado</p>
                                                                            <p className="text-white text-lg font-mono font-black tracking-tighter">{mountingScanInput || detectedScanCode}</p>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="bg-white/10 backdrop-blur-md px-8 py-3 rounded-full border border-white/10 shadow-xl">
                                                                            <p className="text-white/70 text-[9px] uppercase font-black tracking-[0.4em] italic text-center animate-pulse">Aguardando QR Code...</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between">
                                            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] flex items-center gap-2">
                                                <Package className="h-3 w-3" />
                                                Itens do Pedido ({selectedOrder.order_items?.length || 0})
                                            </h3>
                                        </div>

                                        <div className="space-y-3">
                                            {/* Mobile Items View */}
                                            <div className="md:hidden space-y-2">
                                                {selectedOrder.order_items?.map((item: any) => {
                                                    const isExpanded = expandedItemId === item.id;
                                                    return (
                                                        <div
                                                            key={item.id}
                                                            className={cn(
                                                                "bg-card/40 border border-border/10 rounded-xl overflow-hidden transition-all",
                                                                isExpanded ? "ring-1 ring-primary/30 bg-card/60" : ""
                                                            )}
                                                        >
                                                            <div
                                                                onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                                                                className="p-3 flex items-center justify-between cursor-pointer"
                                                            >
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <div className="h-8 w-8 rounded-lg bg-foreground/5 flex items-center justify-center text-muted-foreground shrink-0 border border-border/10">
                                                                        <Package className="h-3.5 w-3.5" />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <h4 className="font-black text-foreground text-xs uppercase italic truncate">
                                                                            {item.products?.model || "N/A"}
                                                                        </h4>
                                                                        <p className="text-[9px] font-mono text-primary/70 font-black uppercase tracking-widest leading-none mt-1">
                                                                            {item.products?.internal_serial || "N/A"}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    <span className="text-[10px] font-bold text-foreground">R$ {item.unit_price?.toFixed(2) || "0.00"}</span>
                                                                    <ChevronRight className={cn("h-3 w-3 text-muted-foreground transition-all", isExpanded && "rotate-90")} />
                                                                </div>
                                                            </div>

                                                            {isExpanded && (
                                                                <div className="px-3 pb-3 pt-1 border-t border-border/5 bg-foreground/5 animate-in slide-in-from-top-1 duration-200">
                                                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                                                        <div>
                                                                            <p className="text-[8px] font-black text-muted-foreground uppercase opacity-50">S/N Original</p>
                                                                            <p className="text-[10px] font-mono text-foreground/70">{item.products?.original_serial || "N/A"}</p>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <p className="text-[8px] font-black text-muted-foreground uppercase opacity-50">Marca</p>
                                                                            <p className="text-[10px] font-black text-foreground/70 uppercase tracking-widest">{item.products?.brand || "N/A"}</p>
                                                                        </div>
                                                                    </div>
                                                                    {selectedOrder.status === "PENDENTE" && (
                                                                        <button
                                                                            onClick={() => handleRemoveItemFromOrder(item.id, item.products?.id)}
                                                                            className="w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all text-[9px] font-black uppercase tracking-widest border border-red-500/20"
                                                                        >
                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                            Remover do Pedido
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                {(!selectedOrder.order_items || selectedOrder.order_items.length === 0) && (
                                                    <div className="px-6 py-10 text-center text-muted-foreground italic text-xs border border-dashed border-border/20 rounded-2xl">
                                                        Nenhum item vinculado.
                                                    </div>
                                                )}
                                            </div>

                                            {/* Desktop Items Table */}
                                            <div className="hidden md:block glass-card rounded-2xl border border-border/10 p-0 overflow-hidden">
                                                <div className="relative group/table" data-scroll="right">
                                                    <div className="overflow-x-auto scrollbar-hide border border-border/10 rounded-2xl">
                                                        <table className="w-full text-left text-sm border-collapse min-w-[700px] sm:min-w-full">
                                                            <thead className="bg-foreground/5 text-[9px] font-black text-muted-foreground uppercase tracking-widest border-b border-border/10">
                                                                <tr>
                                                                    <th className="px-4 sm:px-6 py-4 sticky left-0 bg-card z-30 border-r border-border/10 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">Produto</th>
                                                                    <th className="px-4 sm:px-6 py-4">ID Interno</th>
                                                                    <th className="px-4 sm:px-6 py-4">S/N Original</th>
                                                                    <th className="px-4 sm:px-6 py-4">Marca</th>
                                                                    <th className="px-4 sm:px-6 py-4">Preço Unit.</th>
                                                                    {selectedOrder.status === "PENDENTE" && <th className="px-4 sm:px-6 py-4 text-right">Ações</th>}
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-white/5">
                                                                {selectedOrder.order_items?.map((item: any) => (
                                                                    <tr key={item.id} className="hover:bg-white/[0.01] transition-colors">
                                                                        <td className="px-4 sm:px-6 py-4 font-black text-foreground italic uppercase sticky left-0 bg-card group-hover:bg-neutral-800 transition-colors z-20 border-r border-border/10 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">{item.products?.model || "N/A"}</td>
                                                                        <td className="px-4 sm:px-6 py-4 font-mono text-[10px] sm:text-xs text-primary font-black uppercase tracking-widest">{item.products?.internal_serial || "N/A"}</td>
                                                                        <td className="px-4 sm:px-6 py-4 font-mono text-[10px] sm:text-xs text-muted-foreground/40">{item.products?.original_serial || "N/A"}</td>
                                                                        <td className="px-4 sm:px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{item.products?.brand || "N/A"}</td>
                                                                        <td className="px-4 sm:px-6 py-4 font-bold text-foreground">R$ {item.unit_price?.toFixed(2) || "0.00"}</td>
                                                                        {selectedOrder.status === "PENDENTE" && (
                                                                            <td className="px-4 sm:px-6 py-3 text-right">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleRemoveItemFromOrder(item.id, item.products?.id)}
                                                                                    className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-500 transition-all inline-flex items-center justify-center shrink-0"
                                                                                >
                                                                                    <Trash2 className="h-4 w-4" />
                                                                                </button>
                                                                            </td>
                                                                        )}
                                                                    </tr>
                                                                ))}
                                                                {(!selectedOrder.order_items || selectedOrder.order_items.length === 0) && (
                                                                    <tr>
                                                                        <td colSpan={selectedOrder.status === "PENDENTE" ? 6 : 5} className="px-6 py-10 text-center text-muted-foreground italic text-xs">Nenhum item vinculado a este pedido.</td>
                                                                    </tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 sm:p-8 bg-card/40 border-t border-border/10 flex flex-col sm:flex-row gap-4 shrink-0">
                            {selectedOrder.status === "PENDENTE" && (
                                <button
                                    onClick={() => handleFinalizeOrder(selectedOrder)}
                                    disabled={isSaving}
                                    className="w-full sm:flex-[2] h-14 bg-emerald-600 hover:bg-emerald-500 text-foreground rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-3 disabled:grayscale disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                                    Finalizar envio do pedido
                                </button>
                            )}

                            {canDeleteThisOrder(selectedOrder) && (
                                <button
                                    onClick={() => handleDeleteOrder(selectedOrder)}
                                    disabled={isSaving}
                                    className="w-full sm:flex-[0.5] sm:flex-none sm:w-14 h-14 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl transition-all border border-red-500/20 flex items-center justify-center disabled:opacity-50"
                                    title="Excluir Pedido Permanentemente"
                                >
                                    <Trash2 className="h-5 w-5" />
                                </button>
                            )}

                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="w-full sm:flex-1 h-14 bg-foreground/5 hover:bg-foreground/10 text-foreground rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all"
                            >
                                {selectedOrder.status === "CONCLUIDO" ? "Sair" : "Aguardar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showPdfPreviewModal && pdfPreviewOrder && pdfPreviewIssuedAt && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-background/90 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="glass-card w-full max-w-6xl max-h-[95vh] overflow-hidden border-border/20 shadow-2xl bg-card/95 relative flex flex-col">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

                        <div className="p-4 sm:p-6 border-b border-border/20 flex items-center justify-between gap-4 shrink-0">
                            <div className="min-w-0">
                                <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight flex items-center gap-2">
                                    <Eye className="h-5 w-5 text-primary" />
                                    Preview do PDF — Pedido #{formatOrderCode(pdfPreviewOrder.id)}
                                </h2>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-black truncate">
                                    Revise antes de imprimir/salvar como PDF
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={handlePrintPdfPreview}
                                    disabled={isPreparingPdfPreview}
                                    className="h-11 sm:h-12 px-4 sm:px-6 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2 text-[10px] sm:text-[11px] font-black uppercase tracking-widest shadow-xl shadow-primary/20"
                                >
                                    <Printer className="h-4 w-4" />
                                    Imprimir / Salvar PDF
                                </button>
                                <button
                                    onClick={() => {
                                        setShowPdfPreviewModal(false);
                                        setPdfPreviewOrder(null);
                                        setPdfPreviewIssuedAt(null);
                                    }}
                                    className="h-11 sm:h-12 w-11 sm:w-12 rounded-2xl bg-foreground/5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all hover:bg-red-500/20 hover:text-red-500 border border-border/20"
                                    title="Fechar"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-foreground/5 p-3 sm:p-6">
                            <div className="mx-auto w-full max-w-[920px]">
                                <div className="rounded-2xl border border-border/20 bg-white shadow-2xl overflow-hidden">
                                    <div ref={pdfPrintableRef}>
                                        <OrderPdfDocument order={pdfPreviewOrder} issuedAt={pdfPreviewIssuedAt} />
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground">
                                    <span className="font-black uppercase tracking-widest opacity-60">Formato A4 • Margens otimizadas</span>
                                    <span className="font-mono opacity-60">{new Date().toLocaleString("pt-BR")}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
