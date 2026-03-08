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
    const [searchTerm, setSearchTerm] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
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
                        <div className="flex items-center gap-3 mb-2">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                <ShieldCheck className="h-4 w-4" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Controle de Identidade & Acesso</span>
                        </div>
                        <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-white uppercase italic">Gestão de <span className="text-primary not-italic font-light">Membros</span></h1>
                        <p className="text-muted-foreground font-medium text-xs sm:text-sm mt-1 opacity-70 italic">Administração de permissões, cargos e auditoria de segurança.</p>
                    </div>
                    <button onClick={() => setShowAddModal(true)} className="w-full md:w-auto px-8 h-12 sm:h-14 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-3">
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
                            className="w-full rounded-2xl border border-white/10 bg-neutral-900/50 py-3 sm:py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all text-white shadow-inner backdrop-blur-sm placeholder:text-muted-foreground/30"
                        />
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                        <button className="flex-1 md:flex-none px-6 sm:px-8 h-12 sm:h-14 bg-neutral-900/50 rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-white flex items-center justify-center gap-3 hover:bg-white/5 transition-all shadow-inner">
                            <Settings className="h-4 w-4 text-primary" />
                            Políticas
                        </button>
                    </div>
                </div>

                {/* Users Table */}
                <div className="glass-card overflow-hidden rounded-2xl border border-white/10 shadow-2xl p-0">
                    <div className="relative group/table">
                        {/* Horizontal Scroll Indicators */}
                        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-neutral-900 to-transparent z-20 pointer-events-none opacity-0 group-has-[[data-scroll='left']]:opacity-100 transition-opacity" />
                        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-neutral-900 via-neutral-900/80 to-transparent z-20 pointer-events-none opacity-100 group-has-[[data-scroll='right']]:opacity-100 transition-opacity" />

                        <div className="overflow-x-auto scrollbar-hide">
                            <table className="w-full text-left text-sm border-collapse min-w-[800px] sm:min-w-full">
                                <thead className="bg-white/5 text-muted-foreground uppercase text-[9px] sm:text-[10px] font-black tracking-widest border-b border-white/5 sticky top-0 z-30 backdrop-blur-md">
                                    <tr>
                                        <th className="px-4 sm:px-6 py-5 whitespace-nowrap sticky left-0 bg-neutral-900/95 z-40 border-r border-white/5 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">Membro</th>
                                        <th className="px-4 sm:px-6 py-5 whitespace-nowrap">Contato</th>
                                        <th className="px-4 sm:px-6 py-5 text-center whitespace-nowrap">Cargo / Nível</th>
                                        <th className="px-4 sm:px-6 py-5 whitespace-nowrap">Registro</th>
                                        <th className="px-4 sm:px-6 py-5 text-right whitespace-nowrap pr-6 sm:pr-10">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredUsers.map((u) => (
                                        <tr key={u.id} className="group hover:bg-white/[0.02] transition-colors">
                                            <td className="px-4 sm:px-6 py-5 whitespace-nowrap sticky left-0 bg-neutral-900/95 group-hover:bg-neutral-800 transition-colors z-30 border-r border-white/5 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">
                                                <div className="flex items-center gap-3 sm:gap-4">
                                                    <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-primary/10 group-hover:border-primary/30 transition-all shrink-0">
                                                        <UserCircle className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-white text-[13px] sm:text-base group-hover:text-primary transition-colors leading-tight uppercase italic">{u.full_name || "Sem Nome"}</span>
                                                        <span className="text-[8px] sm:text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-0.5 opacity-40">ID: {u.id.substring(0, 8)}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2 text-white/80 font-black text-[11px] sm:text-xs">
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
                                                <div className="flex items-center gap-2 text-muted-foreground text-[10px] sm:text-xs font-black bg-white/5 w-fit px-2 sm:px-3 py-1 rounded-lg border border-white/5 shadow-inner">
                                                    <Calendar className="h-3 w-3 text-primary opacity-60" />
                                                    {new Date(u.created_at || "").toLocaleDateString("pt-BR")}
                                                </div>
                                            </td>
                                            <td className="px-4 sm:px-6 py-5 text-right whitespace-nowrap pr-6 sm:pr-10">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => setEditingUser(u)}
                                                        className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 hover:bg-primary/20 hover:border-primary/50 transition-all text-muted-foreground hover:text-primary active:scale-95"
                                                        title="Editar Membro"
                                                    >
                                                        <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteUser(u.id)}
                                                        className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 hover:bg-red-500/20 hover:border-red-500/50 transition-all text-muted-foreground hover:text-red-500 active:scale-95"
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

                {/* Create Profile Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-500">
                        <div className="glass-card w-full max-w-md space-y-8 border-white/10 shadow-2xl p-10 bg-neutral-900/90 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                            <div className="flex items-center justify-between relative">
                                <div className="space-y-1">
                                    <h2 className="text-3xl font-black text-white tracking-tight">Novo Acesso</h2>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-black">Provisionamento de Credenciais</p>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center text-muted-foreground hover:text-white transition-all hover:bg-red-500/20 hover:text-red-500 border border-white/10">
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
                                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary transition-all font-bold"
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
                                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary transition-all font-bold"
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
                                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary transition-all font-bold"
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
                                                className="w-full bg-neutral-800 border border-white/10 rounded-xl pl-12 pr-10 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary transition-all appearance-none font-bold"
                                                value={newUser.role}
                                                onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                                            >
                                                <option value="TECNICO">Técnico Operacional</option>
                                                <option value="SUPERVISOR">Supervisor de QA</option>
                                                <option value="GESTOR">Gestor Logístico</option>
                                                <option value="ADMIN">Administrador de Sistema</option>
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
                                        className="h-16 bg-primary text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:brightness-110 active:scale-95 disabled:grayscale disabled:opacity-50 transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3 border-t border-white/10"
                                    >
                                        {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                                        Autorizar Acesso
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="h-16 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white"
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-500">
                        <div className="glass-card w-full max-w-md space-y-8 border-white/10 shadow-2xl p-10 bg-neutral-900/90 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                            <div className="flex items-center justify-between relative">
                                <div className="space-y-1">
                                    <h2 className="text-3xl font-black text-white tracking-tight">Editar Perfil</h2>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-black">Atualização de Cadastro</p>
                                </div>
                                <button onClick={() => setEditingUser(null)} className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center text-muted-foreground hover:text-white transition-all hover:bg-red-500/20 hover:text-red-500 border border-white/10">
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
                                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary transition-all font-bold"
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
                                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary transition-all font-bold"
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
                                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary transition-all font-bold"
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
                                                className="w-full bg-neutral-800 border border-white/10 rounded-xl pl-12 pr-10 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary transition-all appearance-none font-bold"
                                                value={editingUser.role}
                                                onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                                            >
                                                <option value="TECNICO">Técnico Operacional</option>
                                                <option value="SUPERVISOR">Supervisor de QA</option>
                                                <option value="GESTOR">Gestor Logístico</option>
                                                <option value="ADMIN">Administrador de Sistema</option>
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
                                        className="h-16 bg-primary text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:brightness-110 active:scale-95 disabled:grayscale disabled:opacity-50 transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3 border-t border-white/10"
                                    >
                                        {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
                                        Salvar Alterações
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditingUser(null)}
                                        className="h-16 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white"
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
