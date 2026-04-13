import { useState, useEffect, useCallback } from "react";
import { printService, ActiveBridge } from "@/lib/print-service";
import { generateLabelsTSPL, printLabels as downloadPDF } from "@/lib/export-utils";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

const STORAGE_KEY = "default_printer";

export function useRemotePrint() {
    const [activeBridges, setActiveBridges] = useState<ActiveBridge[]>([]);
    const [selectedPrinter, setSelectedPrinter] = useState<string>(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem(STORAGE_KEY) || "";
        }
        return "";
    });
    const [isPrinting, setIsPrinting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Carregar pontes ativas
    const refreshBridges = useCallback(async () => {
        try {
            const bridges = await printService.getActiveBridges();
            setActiveBridges(bridges);
        } catch (error) {
            logger.error("Failed to fetch print bridges", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshBridges();
        const interval = setInterval(refreshBridges, 30000);
        return () => clearInterval(interval);
    }, [refreshBridges]);

    // Persistir seleção e sincronizar entre componentes na sessão
    useEffect(() => {
        if (typeof window !== "undefined") {
            const currentSaved = localStorage.getItem(STORAGE_KEY) || "";
            if (currentSaved !== selectedPrinter) {
                logger.info(`Salvando nova impressora no localStorage: "${selectedPrinter}"`);
                if (selectedPrinter) {
                    localStorage.setItem(STORAGE_KEY, selectedPrinter);
                } else {
                    localStorage.removeItem(STORAGE_KEY);
                }
                window.dispatchEvent(new CustomEvent('printer-changed', { detail: selectedPrinter }));
            }
        }
    }, [selectedPrinter]);

    // Escutar mudanças de outros componentes/instâncias
    useEffect(() => {
        const handlePrinterChanged = (e: Event) => {
            const customEvent = e as CustomEvent;
            setSelectedPrinter(prev => {
                if (prev !== customEvent.detail) {
                    logger.info(`Sincronizando estado da impressora: "${customEvent.detail}"`);
                    return customEvent.detail;
                }
                return prev;
            });
        };
        window.addEventListener('printer-changed', handlePrinterChanged);
        return () => window.removeEventListener('printer-changed', handlePrinterChanged);
    }, []);

    /**
     * Envia uma ou mais etiquetas para a impressora selecionada,
     * ou faz o download em PDF como fallback se nenhuma ponte estiver ativa.
     */
    const printLabels = async (data: any | any[]) => {
        const items = Array.isArray(data) ? data : [data];
        
        logger.info("Iniciando processo de exportação/impressão de etiquetas.", { count: items.length, selectedPrinter });

        if (!selectedPrinter) {
            logger.warn("Nenhuma impressora ativa selecionada. Acionando fallback para download de PDF.");
            toast.info("Nenhuma impressora selecionada. Gerando PDF para download...", { duration: 4000 });
            setIsPrinting(true);
            try {
                logger.info("Chamando downloadPDF(items)");
                await downloadPDF(items);
                logger.info("PDF baixado com sucesso no fallback.");
                toast.success("Download do PDF concluído com sucesso!");
                return true;
            } catch (error) {
                console.error("ERRO COMPLETO:", error);
                logger.error("Falha ao gerar o PDF de fallback.", error);
                toast.error("Erro inesperado ao gerar o arquivo PDF.");
                return false;
            } finally {
                setIsPrinting(false);
            }
        }

        setIsPrinting(true);
        try {
            logger.info(`Gerando TSPL para enviar à ponte: ${selectedPrinter}`);
            
            const tsplData = generateLabelsTSPL(items);

            // O bridge imprimirá o arquivo TSPL
            await printService.submitPrintJob({
                payload_type: "tspl",
                payload_data: tsplData,
                printer_target: selectedPrinter
            });

            toast.success(items.length > 1
                ? `Enviadas ${items.length} etiquetas para a fila!`
                : "Etiqueta enviada para impressão!");

            return true;
        } catch (error) {
            toast.error("Erro ao enviar para fila de impressão");
            logger.error("Print submission failed", error);
            return false;
        } finally {
            setIsPrinting(false);
        }
    };

    return {
        activeBridges,
        selectedPrinter,
        setSelectedPrinter,
        isPrinting,
        isLoading,
        printLabels,
        refreshBridges
    };
}
