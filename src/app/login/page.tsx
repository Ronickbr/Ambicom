import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Mail, Loader2, ShieldCheck, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

export default function LoginPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) throw signInError;

            toast.success("Bem-vindo de volta!", {
                description: "Login realizado com sucesso.",
            });

            // Redirect to dashboard
            navigate("/");
        } catch (error) {
            logger.error("Login error:", error);
            const errorMessage = error instanceof Error ? error.message : "Verifique suas credenciais.";
            toast.error("Erro ao entrar", {
                description: errorMessage,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-accent/20 rounded-full blur-[100px]" />
                <div className="absolute top-1/2 right-1/4 w-[300px] h-[300px] bg-secondary/10 rounded-full blur-[80px]" />
            </div>

            <div className="w-full max-w-md space-y-8 relative">
                {/* Logo Section */}
                <div className="text-center space-y-2">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/10 shadow-2xl mb-4 overflow-hidden">
                        <img src="/logo.png" alt="Ambicom" className="h-full w-full object-cover p-2" />
                    </div>
                    <h1 className="text-4xl font-extrabold text-white tracking-tighter">
                        Ambicom
                    </h1>
                    <p className="text-muted-foreground text-sm font-medium tracking-wide">
                        SISTEMA DE RASTREABILIDADE INDUSTRIAL
                    </p>
                </div>

                {/* Login Card */}
                <div className="glass-card p-6 sm:p-8 border-white/10 shadow-2xl relative group overflow-hidden bg-neutral-950/50 backdrop-blur-xl">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">E-mail Corporativo</label>
                                <div className="relative group/field">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <Mail className="h-4 w-4 text-muted-foreground group-focus-within/field:text-primary transition-colors" />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all text-sm shadow-inner"
                                        placeholder="seu.email@ambicom.com.br"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Senha de Acesso</label>
                                <div className="relative group/field">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <Lock className="h-4 w-4 text-muted-foreground group-focus-within/field:text-primary transition-colors" />
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all text-sm shadow-inner"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Autenticando...
                                </>
                            ) : (
                                <>
                                    Entrar no Sistema
                                    <ShieldCheck className="h-5 w-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-white/5 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-relaxed">
                            Acesso restrito a colaboradores autorizados da Ambicom.<br />
                            Suporte técnico: <span className="text-white">TI@ambicom.com.br</span>
                        </p>
                    </div>
                </div>

                {/* Test Access Section */}
                <div className="pt-4 space-y-4">
                    <div className="flex items-center gap-3 px-2">
                        <div className="h-px flex-1 bg-white/5" />
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] whitespace-nowrap">Ambiente de Teste</span>
                        <div className="h-px flex-1 bg-white/5" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                setEmail("kmkz.clan@gmail.com");
                                setPassword("Nick@11031987");
                                toast.info("Credenciais de ADMIN carregadas");
                            }}
                            className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/5 border border-white/5 hover:border-primary/30 hover:bg-primary/5 transition-all group active:scale-95"
                        >
                            <ShieldCheck className="h-5 w-5 text-primary mb-1 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black text-white uppercase tracking-wider">Admin</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setEmail("gestor@gestor.com");
                                setPassword("gestor@1103");
                                toast.info("Credenciais de GESTOR carregadas");
                            }}
                            className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/5 border border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all group active:scale-95"
                        >
                            <Zap className="h-5 w-5 text-emerald-500 mb-1 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black text-white uppercase tracking-wider">Gestor</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setEmail("supervisor@supervisor.com");
                                setPassword("supervisor@1103");
                                toast.info("Credenciais de SUPERVISOR carregadas");
                            }}
                            className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/5 border border-white/5 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all group active:scale-95"
                        >
                            <ShieldCheck className="h-5 w-5 text-amber-500 mb-1 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black text-white uppercase tracking-wider">Supervisor</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setEmail("tecnico@tecnico.com");
                                setPassword("Tecnico@1103");
                                toast.info("Credenciais de TÉCNICO carregadas");
                            }}
                            className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/5 border border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group active:scale-95"
                        >
                            <Zap className="h-5 w-5 text-blue-500 mb-1 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black text-white uppercase tracking-wider">Técnico</span>
                        </button>
                    </div>

                    <p className="text-[8px] text-muted-foreground text-center uppercase tracking-widest opacity-40">
                        Clique para preencher e clique em "Entrar" para validar
                    </p>
                </div>

                {/* Footer Link */}
                <div className="text-center">
                    <button
                        onClick={() => navigate("/")}
                        className="text-xs text-muted-foreground hover:text-white transition-colors uppercase tracking-widest font-bold opacity-50 hover:opacity-100"
                    >
                        Voltar para a página inicial
                    </button>
                </div>
            </div>
        </div>
    );
}
