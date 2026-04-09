import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    LayoutDashboard,
    Scan,
    CheckCircle2,
    Users,
    Package,
    ClipboardList,
    ShieldCheck,
    LogOut,
    Menu,
    X,
    Settings,
    Sun,
    Moon,
    UserCog
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { logger } from "@/lib/logger";
import { DebugPanel } from "@/components/DebugPanel";

const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard, roles: ["TECNICO", "SUPERVISOR", "GESTOR", "ADMIN"] },
    { name: "Escanear", href: "/scan", icon: Scan, roles: ["TECNICO", "SUPERVISOR", "GESTOR", "ADMIN"] },
    { name: "Fila Técnica", href: "/technician", icon: ClipboardList, roles: ["TECNICO", "SUPERVISOR", "GESTOR", "ADMIN"] },
    { name: "Central de Revisão", href: "/approvals", icon: CheckCircle2, roles: ["SUPERVISOR", "GESTOR", "ADMIN"] },
    { name: "Estoque", href: "/inventory", icon: Package, roles: ["TECNICO", "SUPERVISOR", "GESTOR", "ADMIN"] },
    { name: "Clientes", href: "/clients", icon: Users, roles: ["GESTOR", "ADMIN"] },
    { name: "Pedidos", href: "/orders", icon: Package, roles: ["TECNICO", "SUPERVISOR", "GESTOR", "ADMIN"] },
    { name: "Usuários", href: "/admin/users", icon: Users, roles: ["ADMIN"] },
    { name: "Configurações", href: "/admin/settings", icon: Settings, roles: ["ADMIN"] },
];

export function MainLayout({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const pathname = location.pathname;
    const { profile, signOut, loading } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const navigate = useNavigate();

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    const userRole = profile?.role || "TECNICO";
    const filteredNavigation = navigation.filter(item => item.roles.includes(userRole));

    const { theme, setTheme } = useTheme();

    const [showRecovery, setShowRecovery] = useState(false);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (loading) {
            timer = setTimeout(() => {
                setShowRecovery(true);
            }, 8000); // Show recovery option after 8 seconds
        }
        return () => clearTimeout(timer);
    }, [loading, userRole]);

    if (loading) {
        return (
            <>
                <DebugPanel />
                <div className="min-h-screen bg-background flex items-center justify-center p-4">
                    <div className="flex flex-col items-center gap-6 animate-in fade-in duration-700">
                        <div className="relative">
                            <div className="absolute inset-0 rounded-full bg-primary/20 blur-3xl animate-pulse" />
                            <LayoutDashboard className="h-16 w-16 text-primary animate-spin-slow relative z-10" />
                        </div>
                        <div className="text-center space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary animate-pulse">Sincronizando Ambiente</p>
                            <p className="text-[8px] text-muted-foreground uppercase tracking-widest opacity-40">Segurança de Dados • Ambicom</p>
                            <p className="text-[8px] text-muted-foreground/20 mt-4 cursor-help" title="Pressione Ctrl+Shift+D para abrir o debug">v1.0.0</p>
                        </div>

                        {showRecovery && (
                            <button
                                onClick={async () => {
                                    await signOut();
                                    window.location.href = '/login';
                                }}
                                className="mt-8 text-xs text-red-400 hover:text-red-300 underline cursor-pointer animate-in fade-in"
                            >
                                Demorando muito? Clique aqui para reiniciar a sessão
                            </button>
                        )}
                    </div>
                </div>
            </>
        );
    }

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            <DebugPanel />
            {/* Sidebar Desktop */}
            <aside className={cn(
                "fixed left-0 top-0 hidden h-full border-r border-border bg-card/30 backdrop-blur-md lg:block transition-all duration-300 ease-in-out z-50",
                isSidebarCollapsed ? "w-20" : "w-64"
            )}>
                <div className={cn(
                    "flex h-16 items-center border-b border-border gap-3 transition-all duration-300",
                    isSidebarCollapsed ? "justify-center px-0" : "px-6"
                )}>
                    <img src="/logo.png" alt="Logo" className="h-8 w-8 rounded-lg bg-primary/20 p-1 shrink-0" />
                    {!isSidebarCollapsed && (
                        <span className="text-xl font-bold tracking-tight text-foreground truncate animate-in fade-in duration-300">Ambicom</span>
                    )}
                </div>

                {/* Collapse Toggle Button */}
                <button
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className="absolute -right-3 top-20 h-6 w-6 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-primary transition-colors shadow-md z-50"
                >
                    <Menu className="h-3 w-3" />
                </button>

                {/* User Profile Summary */}
                <div className={cn("border-b border-border/10 transition-all duration-300", isSidebarCollapsed ? "p-2" : "p-4")}>
                    <div className={cn(
                        "bg-foreground/5 rounded-xl flex items-center border border-border/10 transition-all duration-300",
                        isSidebarCollapsed ? "p-2 justify-center" : "p-3 gap-3"
                    )}>
                        <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                            {profile?.full_name?.substring(0, 2).toUpperCase() || "US"}
                        </div>
                        {!isSidebarCollapsed && (
                            <div className="flex flex-col overflow-hidden animate-in fade-in duration-300">
                                <span className="text-xs font-bold text-foreground truncate">{profile?.full_name || "Usuário"}</span>
                                <span className="text-[8px] font-bold text-primary uppercase tracking-tighter opacity-80">{profile?.role}</span>
                            </div>
                        )}
                    </div>
                </div>

                <nav className={cn("flex flex-col gap-1 transition-all duration-300", isSidebarCollapsed ? "p-2" : "p-4")}>
                    {filteredNavigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                title={isSidebarCollapsed ? item.name : ""}
                                className={cn(
                                    "flex items-center rounded-lg transition-all duration-200 group",
                                    isSidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                        : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                                )}
                            >
                                <item.icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-110", isActive && "animate-pulse")} />
                                {!isSidebarCollapsed && (
                                    <span className="text-sm font-medium truncate animate-in slide-in-from-left-1 duration-300">{item.name}</span>
                                )}
                            </Link>
                        );
                    })}
                </nav>
                <div className={cn("absolute bottom-4 w-full transition-all duration-300 flex flex-col gap-2", isSidebarCollapsed ? "px-2" : "px-4")}>
                    <Link
                        to="/profile"
                        className={cn(
                            "flex items-center rounded-lg font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground group w-full",
                            isSidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
                            pathname === "/profile" && "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary hover:text-primary-foreground"
                        )}
                        title={isSidebarCollapsed ? "Meu Perfil" : ""}
                    >
                        <UserCog className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-110", pathname === "/profile" && "animate-pulse")} />
                        {!isSidebarCollapsed && (
                            <span className="text-sm truncate animate-in slide-in-from-left-1 duration-300">Meu Perfil</span>
                        )}
                    </Link>
                    <button
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className={cn(
                            "flex items-center rounded-lg font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground group w-full",
                            isSidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2"
                        )}
                        title={isSidebarCollapsed ? "Alternar Tema" : ""}
                    >
                        {theme === 'dark' ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
                        {!isSidebarCollapsed && (
                            <span className="text-sm truncate animate-in slide-in-from-left-1 duration-300">
                                {theme === 'dark' ? 'Tema Claro' : 'Tema Escuro'}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={handleSignOut}
                        className={cn(
                            "flex items-center rounded-lg font-medium text-destructive transition-colors hover:bg-destructive/10 group w-full",
                            isSidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2"
                        )}
                        title={isSidebarCollapsed ? "Sair do Sistema" : ""}
                    >
                        <LogOut className="h-4 w-4 shrink-0" />
                        {!isSidebarCollapsed && (
                            <span className="text-sm truncate animate-in slide-in-from-left-1 duration-300">Sair do Sistema</span>
                        )}
                    </button>
                </div>
            </aside>

            {/* Header Mobile */}
            <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md lg:hidden">
                <div className="flex items-center gap-2">
                    <img src="/logo.png" alt="Logo" className="h-8 w-8 rounded-lg p-1" />
                    <span className="text-lg font-bold text-primary">Ambicom</span>
                    {pathname !== '/' && (
                        <span className="text-xs text-muted-foreground border-l border-border pl-2 ml-2 uppercase font-bold tracking-wider">
                            {navigation.find(n => n.href === pathname)?.name || (pathname === '/profile' ? 'Meu Perfil' : 'Página')}
                        </span>
                    )}
                </div>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors">
                    {isMobileMenuOpen ? <X /> : <Menu />}
                </button>
            </header>

            {/* Mobile Menu Backdrop */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Mobile Drawer */}
            <aside className={cn(
                "fixed inset-y-0 left-0 z-50 w-64 transform bg-card/95 backdrop-blur-xl transition-transform duration-300 ease-in-out lg:hidden flex flex-col shadow-2xl border-r border-border/10",
                isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="flex h-16 items-center justify-between px-6 border-b border-border">
                    <span className="text-xl font-bold text-primary">Menu de Acesso</span>
                    <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-muted-foreground">
                        <X className="h-6 w-6" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <nav className="flex flex-col gap-2 p-6">
                        {filteredNavigation.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    to={item.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={cn(
                                        "flex items-center gap-4 rounded-xl px-4 py-4 text-base font-bold transition-all active:scale-95",
                                        isActive
                                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground border border-transparent hover:border-border/10"
                                    )}
                                >
                                    <item.icon className="h-5 w-5" />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
                <div className="p-4 border-t border-border/10 flex flex-col gap-2">
                    <Link
                        to="/profile"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                            "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all border border-transparent",
                            pathname === "/profile"
                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                : "text-muted-foreground hover:bg-foreground/5 hover:border-border/10"
                        )}
                    >
                        <UserCog className="h-4 w-4" />
                        Meu Perfil
                    </Link>
                    <button
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-muted-foreground hover:bg-foreground/5 transition-all border border-transparent hover:border-border/10"
                    >
                        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        {theme === 'dark' ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
                    </button>
                    <button
                        onClick={() => {
                            setIsMobileMenuOpen(false);
                            handleSignOut();
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-destructive bg-destructive/5 hover:bg-destructive/10 transition-all border border-destructive/10"
                    >
                        <LogOut className="h-4 w-4" />
                        Sair do Sistema
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={cn(
                "min-h-screen transition-all duration-300 ease-in-out",
                isSidebarCollapsed ? "lg:pl-20" : "lg:pl-64"
            )}>
                <div className="mx-auto p-2 sm:p-4 md:p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
