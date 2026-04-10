import { useState, useEffect, useCallback } from "react";
import { printService, ActiveBridge } from "@/lib/print-service";
import { generateLabelZPL } from "@/lib/export-utils";
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

            // Se a impressora selecionada não existir mais nas pontes, talvez limpar?
            // Por enquanto mantemos a string para persistência
        } catch (error) {
            logger.error("Failed to fetch print bridges", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshBridges();

        // Polling leve para manter o status das pontes atualizado (opcional)
        const interval = setInterval(refreshBridges, 30000);
        return () => clearInterval(interval);
    }, [refreshBridges]);

    // Persistir seleção
    useEffect(() => {
        if (selectedPrinter) {
            localStorage.setItem(STORAGE_KEY, selectedPrinter);
        }
    }, [selectedPrinter]);

    /**
     * Envia uma ou mais etiquetas para a impressora selecionada
     */
    const printLabels = async (data: any | any[]) => {
        if (!selectedPrinter) {
            toast.error("Por favor, selecione uma impressora primeiro.");
            return false;
        }

        setIsPrinting(true);
        try {
            const items = Array.isArray(data) ? data : [data];

            // Gera ZPL concatenado
            const zplCode = items.map(item => generateLabelZPL(item)).join("\n");

            await printService.submitPrintJob({
                payload_type: "zpl",
                payload_data: zplCode,
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
