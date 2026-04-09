import React, { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import { KeyRound, Printer, Save, Loader2, Globe, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { printService, ActiveBridge } from "@/lib/print-service";

export default function ProfilePage() {
    const { profile } = useAuth();

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

    const [activeBridges, setActiveBridges] = useState<ActiveBridge[]>([]);
    const [selectedPrinter, setSelectedPrinter] = useState<string>("");
    const [isLoadingPrinters, setIsLoadingPrinters] = useState(true);

    // Carregar impressora
    useEffect(() => {
        // Carrega impressora padrão
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('default_printer');
            if (saved) setSelectedPrinter(saved);
        }

        printService.getActiveBridges()
            .then(setActiveBridges)
            .finally(() => setIsLoadingPrinters(false));
    }, []);

    const handlePrinterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSelectedPrinter(val);
        if (val) {
            localStorage.setItem('default_printer', val);
            toast.success(`Impressora padrão definida como ${val}`);
        } else {
            localStorage.removeItem('default_printer');
            toast.success("Impressora padrão limpa");
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!password || !confirmPassword) {
            toast.error("Preencha as senhas");
            return;
        }

        if (password !== confirmPassword) {
            toast.error("As senhas não conferem");
            return;
        }

        if (password.length < 6) {
            toast.error("A senha deve ter pelo menos 6 caracteres");
            return;
        }

        setIsUpdatingPassword(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });

            if (error) throw error;

            toast.success("Senha atualizada com sucesso!");
            setPassword("");
            setConfirmPassword("");
        } catch (error: any) {
            console.error('Erro ao atualizar a senha:', error);
            toast.error(error.message || "Erro ao atualizar a senha");
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    return (
        <MainLayout>
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
                        Meu Perfil
                    </h1>
                    <p className="text-muted-foreground mt-2 font-medium">
                        Gerencie sua conta e suas preferências locais do sistema.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Alterar Senha */}
                    <div className="bg-card border border-border/10 rounded-2xl p-6 shadow-sm flex flex-col h-full relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                            <KeyRound className="w-32 h-32" />
                        </div>
                        <h2 className="text-lg font-black text-foreground uppercase tracking-widest flex items-center gap-2 mb-6">
                            <KeyRound className="w-5 h-5 text-primary" /> Alterar Senha
                        </h2>

                        <form onSubmit={handleUpdatePassword} className="space-y-4 flex-1 flex flex-col justify-between">
                            <div className="space-y-4 relative z-10">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Nova Senha</label>
                                    <input
                                        type="password"
                                        placeholder="Mínimo 6 caracteres"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full bg-foreground/5 border border-border/20 rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary/50 outline-none transition-all font-bold"
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Confirmar Senha</label>
                                    <input
                                        type="password"
                                        placeholder="Repita a nova senha"
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        className="w-full bg-foreground/5 border border-border/20 rounded-xl px-4 py-3 text-sm text-foreground focus:border-primary/50 outline-none transition-all font-bold"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isUpdatingPassword}
                                className="w-full mt-6 px-6 py-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isUpdatingPassword ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" /> Atualizando...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" /> Salvar Nova Senha
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Impressão Remota / Automática */}
                    <div className="bg-card border border-border/10 rounded-2xl p-6 shadow-sm flex flex-col h-full relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                            <Printer className="w-32 h-32" />
                        </div>
                        <h2 className="text-lg font-black text-foreground uppercase tracking-widest flex items-center gap-2 mb-6">
                            <Printer className="w-5 h-5 text-sky-500" /> Impressão Automática
                        </h2>

                        <div className="space-y-6 flex-1 flex flex-col justify-between">
                            <div className="space-y-4 relative z-10">
                                <p className="text-sm text-muted-foreground">
                                    Selecione uma impressora padrão para habilitar a **Impressão Instantânea**. Quando definido, o scanner enviará a etiqueta para a impressora automaticamente sem abrir prompts ou modais de confirmação adicionais.
                                </p>

                                {isLoadingPrinters ? (
                                    <div className="flex items-center justify-center p-8 bg-sky-500/5 rounded-xl border border-sky-500/10">
                                        <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
                                    </div>
                                ) : activeBridges.length > 0 ? (
                                    <div className="space-y-3 bg-sky-500/5 p-4 rounded-xl border border-sky-500/10 mt-4">
                                        <h4 className="text-[10px] font-black text-sky-500 uppercase tracking-widest border-l-2 border-sky-500 pl-2 flex items-center gap-2">
                                            <Globe className="w-3 h-3" /> Pontes Online
                                        </h4>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Impressora Padrão Memory</label>
                                            <select
                                                value={selectedPrinter}
                                                onChange={handlePrinterChange}
                                                className="w-full bg-foreground/5 border border-border/20 rounded-xl px-4 py-3 text-sm text-foreground focus:border-sky-500/50 outline-none transition-all font-bold cursor-pointer"
                                            >
                                                <option value="">Não imprimir automaticamente (Perguntar)</option>
                                                {activeBridges.map(bridge =>
                                                    bridge.available_printers.map(printer => (
                                                        <option key={`${bridge.id}-${printer}`} value={printer}>
                                                            {printer} ({bridge.bridge_name})
                                                        </option>
                                                    ))
                                                )}
                                            </select>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!selectedPrinter) return;
                                                const zplCode = "^XA^FO50,50^A0N,50,50^FDTESTE AMBICOM^FS^XZ";
                                                printService.submitPrintJob({
                                                    payload_type: 'zpl',
                                                    payload_data: zplCode,
                                                    printer_target: selectedPrinter
                                                });
                                                toast.success("Página de teste enviada para " + selectedPrinter);
                                            }}
                                            disabled={!selectedPrinter}
                                            className="w-full mt-2 py-3 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-lg transition-all"
                                        >
                                            <Printer className="w-4 h-4" />
                                            Testar Impressora
                                        </button>
                                    </div>
                                ) : (
                                    <div className="bg-amber-500/5 p-4 rounded-xl border border-amber-500/10 flex items-center gap-3 mt-4">
                                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                                        <div className="text-[10px] text-amber-200/70 leading-relaxed font-medium">
                                            Configuração não disponível.<br />Nenhuma ponte de impressão online (Print Bridge).
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 p-4 rounded-xl border border-border/5 bg-foreground/5 text-xs text-muted-foreground flex items-start gap-3">
                                💡 Suas preferências ficam salvas apenas na memória deste navegador no dispositivo atual (\`localStorage\`).
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
