import React, { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import {
    Shield,
    Mail,
    Calendar,
    Loader2,
    Search,
    X,
    UserCircle,
    ShieldCheck,
    Plus,
    Settings,
    ChevronRight,
    Lock,
    User,
    RefreshCw,
    Trash2
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNavigate } from "react-router-dom";
import { Profile, UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

const ROLES: UserRole[] = ["TECNICO", "SUPERVISOR", "GESTOR", "ADMIN"];

export default function UsersManagementPage() {
    const { profile, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [users, setUsers] = useState<Profile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showPoliciesModal, setShowPoliciesModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // New User State
    const [newUser, setNewUser] = useState({
        email: "",
        password: "",
        fullName: "",
        role: "TECNICO" as UserRole
    });

    const [editingUser, setEditingUser] = useState<Profile | null>(null);

    const isAuthorized = profile?.role === "ADMIN" || profile?.role === "GESTOR";

    useEffect(() => {
        if (!authLoading && !isAuthorized) {
            navigate("/");
        } else if (isAuthorized) {
            fetchUsers();
        }
    }, [authLoading, isAuthorized, navigate]);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setUsers((data as Profile[]) || []);
        } catch {
            toast.error("Erro ao carregar lista de usuários");
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        setIsSaving(true);
        try {
            // Using edge function to update sensitive data (email/password) and metadata
            const { data, error: functionError } = await supabase.functions.invoke("update-user", {
                body: {
                    userId: editingUser.id,
                    email: editingUser.email,
                    password: editingUser.password,
                    role: editingUser.role,
                    fullName: editingUser.full_name
                }
            });

            if (functionError) throw functionError;
            if (data?.error) throw new Error(data.error);

            toast.success("Perfil atualizado com sucesso!");
            setEditingUser(null);
            fetchUsers(); // Refresh the list
        } catch (error) {
            const err = error as Error;
            logger.error("Erro ao atualizar usuário:", err);
            toast.error("Erro ao atualizar perfil", { description: err.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const { data, error } = await supabase.functions.invoke("create-user", {
                body: {
                    email: newUser.email,
                    password: newUser.password,
                    fullName: newUser.fullName,
                    role: newUser.role
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            toast.success("Usuário criado com sucesso!");
            setShowAddModal(false);
            setNewUser({ email: "", password: "", fullName: "", role: "TECNICO" });
            fetchUsers();
        } catch (error) {
            const err = error as Error;
            logger.error("Erro ao criar usuário:", err);
            toast.error("Erro ao criar usuário", { description: err.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm("Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.")) {
            return;
        }

        setIsLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke("delete-user", {
                body: { userId }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            toast.success("Usuário excluído com sucesso!");
            fetchUsers();
        } catch (error) {
            const err = error as Error;
            logger.error("Erro ao excluir usuário:", err);
            toast.error("Erro ao excluir usuário", { description: err.message });
        } finally {
            setIsLoading(false);
        }
    };

    const filteredUsers = users.filter(u =>
        (u.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.role.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (authLoading) return null; // MainLayout gerencia isso

    if (!isAuthorized) return null; // Lógica de redirecionamento no useEffect

    if (isLoading) {
        return (
            <MainLayout>
                <div className="max-w-7xl mx-auto flex h-[80vh] flex-col items-center justify-center space-y-6">
                    <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse" />
                        <Loader2 className="h-16 w-16 animate-spin text-primary relative z-10 opacity-40" />
                    </div>
                    <div className="text-center space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Acessando Registro Central</p>
                        <p className="text-[8px] text-muted-foreground/40 uppercase tracking-widest">Segurança Nível Protocolo 0</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="max-w-7xl mx-auto space-y-6 sm:space-y-10 pb-12">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
                    <div>
                        <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-foreground uppercase italic">Gestão de <span className="text-primary not-italic font-light">Membros</span></h1>
                        <p className="text-muted-foreground font-medium text-xs sm:text-sm mt-1 opacity-70 italic">Administração de permissões, cargos e auditoria de segurança.</p>
                    </div>
                    <button onClick={() => setShowAddModal(true)} className="w-full md:w-auto px-8 h-12 sm:h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-3">
                        <Plus className="h-4 w-4" />
                        NOVO MEMBRO
                    </button>
                </div>

                {/* Search & Filters */}
                <div className="flex flex-col md:flex-row gap-4 py-2">
                    <div className="relative flex-1 group max-w-2xl w-full">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Localizar membro por nome, email ou cargo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-2xl border border-border/20 bg-card/50 py-3 sm:py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all text-foreground shadow-inner backdrop-blur-sm placeholder:text-muted-foreground/30"
                        />
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                        <button onClick={() => setShowPoliciesModal(true)} className="flex-1 md:flex-none px-6 sm:px-8 h-12 sm:h-14 bg-card/50 rounded-2xl border border-border/20 text-[10px] font-black uppercase tracking-widest text-foreground flex items-center justify-center gap-3 hover:bg-foreground/5 transition-all shadow-inner">
                            <Settings className="h-4 w-4 text-primary" />
                            Políticas
                        </button>
                    </div>
                </div>

                {/* Users Table / List */}
                <div className="glass-card overflow-hidden rounded-2xl border border-border/20 shadow-2xl p-0">
                    <div className="relative group/table">
                        {/* Mobile Compact View */}
                        <div className="md:hidden space-y-3 px-2 py-4">
                            {filteredUsers.length === 0 ? (
                                <div className="px-6 py-20 text-center text-muted-foreground italic text-sm">
                                    Nenhum membro localizado
                                </div>
                            ) : (
                                filteredUsers.map((u) => {
                                    const isExpanded = expandedId === u.id;
                                    return (
                                        <div
                                            key={u.id}
                                            className={cn(
                                                "bg-card/40 border border-border/10 rounded-2xl overflow-hidden transition-all duration-300",
                                                isExpanded ? "ring-1 ring-primary/30 bg-card/60 shadow-lg" : "hover:bg-card/50"
                                            )}
                                        >
                                            {/* Main Row */}
                                            <div
                                                onClick={() => setExpandedId(isExpanded ? null : u.id)}
                                                className="p-4 flex items-center justify-between cursor-pointer active:bg-foreground/5"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="h-9 w-9 rounded-xl bg-foreground/5 flex items-center justify-center text-muted-foreground shrink-0 border border-border/10">
                                                        <UserCircle className="h-5 w-5" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="font-black text-foreground text-sm uppercase italic truncate">
                                                            {u.full_name || "Sem Nome"}
                                                        </h4>
                                                        <p className="text-[9px] font-bold text-primary/70 uppercase tracking-widest leading-none mt-1">
                                                            {u.role}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <div className="text-right mr-1">
                                                        <p className="text-[8px] font-black text-foreground/40 uppercase leading-none">Acesso</p>
                                                        <div className={cn(
                                                            "h-2 w-2 rounded-full ml-auto mt-1",
                                                            u.role === "ADMIN" ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" :
                                                                u.role === "GESTOR" ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" :
                                                                    u.role === "SUPERVISOR" ? "bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]" :
                                                                        "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                                        )} />
                                                    </div>
                                                    <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300", isExpanded && "rotate-90")} />
                                                </div>
                                            </div>

                                            {/* Expanded Content */}
                                            {isExpanded && (
                                                <div className="px-4 pb-4 pt-2 border-t border-border/5 bg-foreground/5 animate-in slide-in-from-top-2 duration-300">
                                                    <div className="space-y-4 mb-4">
                                                        <div className="grid grid-cols-1 gap-3">
                                                            <div className="flex items-center gap-3 p-3 rounded-xl bg-background/40 border border-border/10">
                                                                <Mail className="h-4 w-4 text-primary/60" />
                                                                <div className="min-w-0">
                                                                    <p className="text-[8px] font-black text-muted-foreground uppercase opacity-50">E-mail de Acesso</p>
                                                                    <p className="text-xs font-bold text-foreground truncate">{u.email || "Não informado"}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3 p-3 rounded-xl bg-background/40 border border-border/10">
                                                                <Calendar className="h-4 w-4 text-primary/60" />
                                                                <div className="min-w-0">
                                                                    <p className="text-[8px] font-black text-muted-foreground uppercase opacity-50">Data de Registro</p>
                                                                    <p className="text-xs font-bold text-foreground">{new Date(u.created_at || "").toLocaleDateString("pt-BR")}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3 p-3 rounded-xl bg-background/40 border border-border/10">
                                                                <Shield className="h-4 w-4 text-primary/60" />
                                                                <div className="min-w-0">
                                                                    <p className="text-[8px] font-black text-muted-foreground uppercase opacity-50">Identificador Global (ID)</p>
                                                                    <p className="text-[10px] font-mono font-bold text-foreground truncate">{u.id}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => setEditingUser(u)}
                                                            className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-white text-black hover:bg-primary hover:text-primary-foreground transition-all text-[10px] font-black uppercase tracking-widest border border-primary/10 shadow-lg"
                                                        >
                                                            <Settings className="h-4 w-4" />
                                                            Editar Perfil
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteUser(u.id)}
                                                            className="h-12 w-12 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto scrollbar-hide">
                            <table className="w-full text-left text-sm border-collapse min-w-[800px] sm:min-w-full">
                                <thead className="bg-foreground/5 text-muted-foreground uppercase text-[9px] sm:text-[10px] font-black tracking-widest border-b border-border/10 sticky top-0 z-30 backdrop-blur-md">
                                    <tr>
                                        <th className="px-4 sm:px-6 py-5 whitespace-nowrap sticky left-0 bg-card/95 z-40 border-r border-border/10 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">Membro</th>
                                        <th className="px-4 sm:px-6 py-5 whitespace-nowrap">Contato</th>
                                        <th className="px-4 sm:px-6 py-5 text-center whitespace-nowrap">Cargo / Nível</th>
                                        <th className="px-4 sm:px-6 py-5 whitespace-nowrap">Registro</th>
                                        <th className="px-4 sm:px-6 py-5 text-right whitespace-nowrap pr-6 sm:pr-10">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredUsers.map((u) => (
                                        <tr key={u.id} className="group hover:bg-white/[0.02] transition-colors">
                                            <td className="px-4 sm:px-6 py-5 whitespace-nowrap sticky left-0 bg-card/95 transition-colors z-30 border-r border-border/10 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">
                                                <div className="flex items-center gap-3 sm:gap-4">
                                                    <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-foreground/5 flex items-center justify-center border border-border/20 group-hover:bg-primary/10 group-hover:border-primary/30 transition-all shrink-0">
                                                        <UserCircle className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-foreground text-[13px] sm:text-base group-hover:text-primary transition-colors leading-tight uppercase italic">{u.full_name || "Sem Nome"}</span>
                                                        <span className="text-[8px] sm:text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-0.5 opacity-40">ID: {u.id.substring(0, 8)}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2 text-foreground/80 font-black text-[11px] sm:text-xs">
                                                        <Mail className="h-3 w-3 text-primary opacity-50" />
                                                        {u.email || "Sem Email"}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 sm:px-6 py-5 text-center whitespace-nowrap">
                                                <span className={cn(
                                                    "inline-flex px-2 sm:px-3 py-1 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-wider border shadow-sm",
                                                    u.role === "ADMIN" ? "bg-red-500/10 text-red-400 border-red-500/20 shadow-red-500/5" :
                                                        u.role === "GESTOR" ? "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-amber-500/5" :
                                                            u.role === "SUPERVISOR" ? "bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-sky-500/5" :
                                                                "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/5"
                                                )}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                                                <div className="flex items-center gap-2 text-muted-foreground text-[10px] sm:text-xs font-black bg-foreground/5 w-fit px-2 sm:px-3 py-1 rounded-lg border border-border/10 shadow-inner">
                                                    <Calendar className="h-3 w-3 text-primary opacity-60" />
                                                    {new Date(u.created_at || "").toLocaleDateString("pt-BR")}
                                                </div>
                                            </td>
                                            <td className="px-4 sm:px-6 py-5 text-right whitespace-nowrap pr-6 sm:pr-10">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => setEditingUser(u)}
                                                        className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-foreground/5 flex items-center justify-center border border-border/20 hover:bg-primary/20 hover:border-primary/50 transition-all text-muted-foreground hover:text-primary active:scale-95"
                                                        title="Editar Membro"
                                                    >
                                                        <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteUser(u.id)}
                                                        className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-foreground/5 flex items-center justify-center border border-border/20 hover:bg-red-500/20 hover:border-red-500/50 transition-all text-muted-foreground hover:text-red-500 active:scale-95"
                                                        title="Excluir Membro"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Policies Modal */}
                {showPoliciesModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-500">
                        <div className="glass-card w-full max-w-lg space-y-8 border-border/20 shadow-2xl p-10 bg-card/90 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                            <div className="flex items-center justify-between relative">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-black text-foreground tracking-tight uppercase italic">Políticas de <span className="text-primary not-italic font-light">Acesso</span></h2>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-black">Resumo das funções por cargo</p>
                                </div>
                                <button onClick={() => setShowPoliciesModal(false)} className="h-12 w-12 rounded-2xl bg-foreground/5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all hover:bg-red-500/20 hover:text-red-500 border border-border/20">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <div className="space-y-4 relative">
                                <div className="p-4 rounded-xl bg-foreground/5 border border-border/10 space-y-2 hover:bg-foreground/10 transition-colors">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-sm bg-red-500/10 text-red-400 border-red-500/20">ADMIN</span>
                                        <h3 className="font-bold text-sm text-foreground uppercase italic">Administrador de Sistema</h3>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Acesso total. Pode configurar o sistema, gerenciar todos os usuários, visualizar todos os relatórios e definir regras de negócio.</p>
                                </div>

                                <div className="p-4 rounded-xl bg-foreground/5 border border-border/10 space-y-2 hover:bg-foreground/10 transition-colors">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-sm bg-amber-500/10 text-amber-400 border-amber-500/20">GESTOR</span>
                                        <h3 className="font-bold text-sm text-foreground uppercase italic">Gestor Logístico</h3>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Visão gerencial. Visualiza dados estratégicos, avaliações, painéis e pode gerenciar membros (exceto admins).</p>
                                </div>

                                <div className="p-4 rounded-xl bg-foreground/5 border border-border/10 space-y-2 hover:bg-foreground/10 transition-colors">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-sm bg-sky-500/10 text-sky-400 border-sky-500/20">SUPERVISOR</span>
                                        <h3 className="font-bold text-sm text-foreground uppercase italic">Supervisor de QA</h3>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Auditoria técnica. Pode aprovar ou rejeitar laudos, revisar inspeções e acompanhar a qualidade das operações.</p>
                                </div>

                                <div className="p-4 rounded-xl bg-foreground/5 border border-border/10 space-y-2 hover:bg-foreground/10 transition-colors">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-sm bg-emerald-500/10 text-emerald-400 border-emerald-500/20">TECNICO</span>
                                        <h3 className="font-bold text-sm text-foreground uppercase italic">Técnico Operacional</h3>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Acesso base. Responsável por realizar scans de produtos, cadastrar avaliações e gerar laudos em campo.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Create Profile Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-500">
                        <div className="glass-card w-full max-w-md space-y-8 border-border/20 shadow-2xl p-10 bg-card/90 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                            <div className="flex items-center justify-between relative">
                                <div className="space-y-1">
                                    <h2 className="text-3xl font-black text-foreground tracking-tight">Novo Acesso</h2>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-black">Provisionamento de Credenciais</p>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="h-12 w-12 rounded-2xl bg-foreground/5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all hover:bg-red-500/20 hover:text-red-500 border border-border/20">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateUser} className="space-y-6 relative">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nome Completo</label>
                                        <div className="relative group">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <input
                                                type="text"
                                                className="w-full bg-foreground/5 border border-border/20 rounded-xl pl-12 pr-4 py-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all font-bold"
                                                placeholder="Ex: João Silva"
                                                value={newUser.fullName}
                                                onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">E-mail Corporativo</label>
                                        <div className="relative group">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <input
                                                type="email"
                                                className="w-full bg-foreground/5 border border-border/20 rounded-xl pl-12 pr-4 py-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all font-bold"
                                                placeholder="exemplo@empresa.com"
                                                value={newUser.email}
                                                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Senha Inicial</label>
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <input
                                                type="password"
                                                className="w-full bg-foreground/5 border border-border/20 rounded-xl pl-12 pr-4 py-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all font-bold"
                                                placeholder="••••••••"
                                                value={newUser.password}
                                                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cargo / Nível de Acesso</label>
                                        <div className="relative group">
                                            <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <select
                                                className="w-full bg-background border border-border/20 rounded-xl pl-12 pr-10 py-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all appearance-none font-bold shadow-sm"
                                                value={newUser.role}
                                                onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                                            >
                                                <option value="TECNICO" className="bg-background text-foreground">Técnico Operacional</option>
                                                <option value="SUPERVISOR" className="bg-background text-foreground">Supervisor de QA</option>
                                                <option value="GESTOR" className="bg-background text-foreground">Gestor Logístico</option>
                                                <option value="ADMIN" className="bg-background text-foreground">Administrador de Sistema</option>
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground opacity-50">
                                                <ChevronRight className="h-5 w-5 rotate-90" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 flex flex-col gap-3">
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="h-16 bg-primary text-primary-foreground rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:brightness-110 active:scale-95 disabled:grayscale disabled:opacity-50 transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3 border-t border-border/20"
                                    >
                                        {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                                        Autorizar Acesso
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="h-16 rounded-2xl border border-border/20 bg-foreground/5 hover:bg-foreground/10 transition-all text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                {/* Edit User Modal */}
                {editingUser && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-500">
                        <div className="glass-card w-full max-w-md space-y-8 border-border/20 shadow-2xl p-10 bg-card/90 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                            <div className="flex items-center justify-between relative">
                                <div className="space-y-1">
                                    <h2 className="text-3xl font-black text-foreground tracking-tight">Editar Perfil</h2>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-black">Atualização de Cadastro</p>
                                </div>
                                <button onClick={() => setEditingUser(null)} className="h-12 w-12 rounded-2xl bg-foreground/5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all hover:bg-red-500/20 hover:text-red-500 border border-border/20">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <form onSubmit={handleUpdateUser} className="space-y-6 relative">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nome Completo</label>
                                        <div className="relative group">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <input
                                                type="text"
                                                className="w-full bg-foreground/5 border border-border/20 rounded-xl pl-12 pr-4 py-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all font-bold"
                                                placeholder="Ex: João Silva"
                                                value={editingUser.full_name || ""}
                                                onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Novo E-mail (Opcional)</label>
                                        <div className="relative group">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <input
                                                type="email"
                                                className="w-full bg-foreground/5 border border-border/20 rounded-xl pl-12 pr-4 py-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all font-bold"
                                                placeholder="Novo e-mail corporativo"
                                                value={editingUser.email || ""}
                                                onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Alterar Senha (Opcional)</label>
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <input
                                                type="password"
                                                className="w-full bg-foreground/5 border border-border/20 rounded-xl pl-12 pr-4 py-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all font-bold"
                                                placeholder="••••••••"
                                                value={editingUser.password || ""}
                                                onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cargo / Nível de Acesso</label>
                                        <div className="relative group">
                                            <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <select
                                                className="w-full bg-background border border-border/20 rounded-xl pl-12 pr-10 py-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all appearance-none font-bold shadow-sm"
                                                value={editingUser.role}
                                                onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                                            >
                                                <option value="TECNICO" className="bg-background text-foreground">Técnico Operacional</option>
                                                <option value="SUPERVISOR" className="bg-background text-foreground">Supervisor de QA</option>
                                                <option value="GESTOR" className="bg-background text-foreground">Gestor Logístico</option>
                                                <option value="ADMIN" className="bg-background text-foreground">Administrador de Sistema</option>
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground opacity-50">
                                                <ChevronRight className="h-5 w-5 rotate-90" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 flex flex-col gap-3">
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="h-16 bg-primary text-primary-foreground rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:brightness-110 active:scale-95 disabled:grayscale disabled:opacity-50 transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3 border-t border-border/20"
                                    >
                                        {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
                                        Salvar Alterações
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditingUser(null)}
                                        className="h-16 rounded-2xl border border-border/20 bg-foreground/5 hover:bg-foreground/10 transition-all text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
