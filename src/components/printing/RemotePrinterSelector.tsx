import React from "react";
import { Printer, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRemotePrint } from "@/hooks/useRemotePrint";

interface RemotePrinterSelectorProps {
    className?: string;
    showLabel?: boolean;
}

export const RemotePrinterSelector: React.FC<RemotePrinterSelectorProps> = ({
    className,
    showLabel = true
}) => {
    const {
        activeBridges,
        selectedPrinter,
        setSelectedPrinter,
        isLoading,
        refreshBridges
    } = useRemotePrint();

    // Flatten available bridges
    const allBridges = activeBridges.map(bridge => ({
        id: bridge.id,
        name: bridge.bridge_name,
        isOnline: true // We consider it online if it's in the active_bridges table recently
    }));

    const isBridgeOnline = allBridges.some(b => b.name === selectedPrinter);

    return (
        <div className={cn("flex flex-col gap-2", className)}>
            {showLabel && (
                <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                        Ponte de Impressão
                    </label>
                    <button
                        onClick={() => refreshBridges()}
                        disabled={isLoading}
                        className="p-1 hover:bg-foreground/5 rounded-md transition-colors disabled:opacity-50"
                        title="Atualizar Status"
                    >
                        <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
                    </button>
                </div>
            )}

            <div className="relative group">
                <Printer className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />

                <select
                    value={selectedPrinter}
                    onChange={(e) => setSelectedPrinter(e.target.value)}
                    className={cn(
                        "w-full h-11 bg-background/50 border border-border/10 rounded-xl pl-10 pr-10 text-xs appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer font-bold",
                        selectedPrinter && isBridgeOnline ? "text-emerald-500" : "text-foreground"
                    )}
                >
                    <option value="">Nenhuma Ponte Selecionada</option>
                    {allBridges.map((bridge) => (
                        <option key={bridge.id} value={bridge.name}>
                            {bridge.name}
                        </option>
                    ))}
                </select>

                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {selectedPrinter ? (
                        isBridgeOnline ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                        )
                    ) : (
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                    )}
                </div>
            </div>

            {selectedPrinter && !isBridgeOnline && activeBridges.length > 0 && (
                <p className="text-[9px] text-amber-500 font-medium px-1 animate-pulse">
                    ⚠️ Ponte offline.
                </p>
            )}
        </div>
    );
};
