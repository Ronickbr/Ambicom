import React, { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Loader2,
  Activity,
  BarChart3,
  Box
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface DashboardLog {
  id: string;
  new_status: string;
  created_at: string;
  products: {
    brand: string | null;
    model: string | null;
    internal_serial: string | null;
  } | null;
}

interface DashboardStat {
  name: string;
  value: string;
  icon: React.ElementType;
  color: string;
  key: string;
  trend?: string;
  label: string;
}

export default function Home() {
  const [stats, setStats] = useState<DashboardStat[]>([
    { name: "Patrimônio Ativo", value: "0", icon: Package, color: "text-blue-500", key: "TOTAL", label: "Total Geral" },
    { name: "Fila de Inspeção", value: "0", icon: Clock, color: "text-yellow-500", key: "CADASTRO", label: "Aguardando" },
    { name: "Pendente Liberação", value: "0", icon: AlertCircle, color: "text-orange-500", key: "EM AVALIAÇÃO", label: "Em Análise" },
    { name: "Stock Disponível", value: "0", icon: Box, color: "text-emerald-500", key: "EM ESTOQUE", label: "Pronto" },
  ]);
  const [recentActivity, setRecentActivity] = useState<DashboardLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [leadTime, setLeadTime] = useState({ avg: "--", status: "Aguardando Dados" });

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000));

    try {
      const queries = [
        supabase.from("products").select("*", { count: 'exact', head: true }), // Total
        supabase.from("products").select("*", { count: 'exact', head: true }).eq('status', 'CADASTRO'), // Fila
        supabase.from("products").select("*", { count: 'exact', head: true }).eq('status', 'EM AVALIAÇÃO'), // Pendente
        supabase.from("products").select("*", { count: 'exact', head: true }).eq('status', 'EM ESTOQUE'), // Concluido
      ];

      const results = await Promise.race([
        Promise.all(queries),
        timeoutPromise
      ]) as any[];

      if (results) {
        const [total, cadastro, tecnico, liberado] = results;

        setStats([
          { name: "Patrimônio Ativo", value: (total.count || 0).toString(), icon: Package, color: "text-blue-500", key: "TOTAL", label: "Total Geral" },
          { name: "Fila de Inspeção", value: (cadastro.count || 0).toString(), icon: Clock, color: "text-yellow-500", key: "CADASTRO", label: "Aguardando" },
          { name: "Pendente Liberação", value: (tecnico.count || 0).toString(), icon: AlertCircle, color: "text-orange-500", key: "TECNICO", label: "Em Análise" },
          { name: "Total Expedido", value: (liberado.count || 0).toString(), icon: CheckCircle2, color: "text-emerald-500", key: "LIBERADO", label: "Concluídos" },
        ]);
      }

      const { data: logs, error: logsError } = await Promise.race([
        supabase
          .from("product_logs")
          .select(`
                      id,
                      new_status,
                      created_at,
                      products (brand, model, internal_serial)
                  `)
          .order("created_at", { ascending: false })
          .limit(5),
        timeoutPromise
      ]) as any;

      if (logsError) throw logsError;

      setRecentActivity((logs as unknown as DashboardLog[]) || []);

      setLeadTime({ avg: "--", status: "Aguardando Dados" });

    } catch (error) {
      console.error("Erro dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      {isLoading ? (
        <div className="max-w-7xl mx-auto flex h-[60vh] flex-col items-center justify-center space-y-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse" />
            <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10 opacity-40" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Consolidando Dashboards</p>
            <p className="text-[8px] text-muted-foreground/40 uppercase tracking-widest">Sincronizando métricas em tempo real</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6 pb-20 sm:pb-0">
          {/* Header */}
          <div className="flex flex-col gap-1 px-1">
            <h1 className="text-2xl sm:text-4xl font-black tracking-tighter text-white uppercase italic">
              Dashboard <span className="text-primary not-italic font-light">Geral</span>
            </h1>
            <p className="text-muted-foreground font-medium text-[10px] sm:text-base opacity-70">
              Visão geral do sistema e indicadores de performance.
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid gap-4 sm:gap-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {stats.map((stat, i) => (
              <div
                key={i}
                className="glass-card p-4 sm:p-6 bg-neutral-900/40 border-white/5 relative overflow-hidden group hover:border-primary/30 transition-all active:scale-[0.98]"
              >
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <stat.icon className="h-16 w-16 sm:h-24 sm:w-24 text-primary" />
                </div>
                <div className="flex items-center justify-between mb-4">
                  <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-2xl ${stat.color} flex items-center justify-center border border-white/10`}>
                    <stat.icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                </div>
                <div className="space-y-1 relative z-10">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{stat.label}</p>
                  <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tighter">{stat.value}</h3>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
            {/* Recent Activity Table */}
            <div className="glass-card overflow-hidden lg:col-span-2 border border-white/10 bg-neutral-900/40 rounded-2xl shadow-2xl p-0">
              <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Atividade Recente
                </h3>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-50 mt-1">Sincronização de eventos em tempo real</p>
              </div>
              <div className="relative group/table" data-scroll="right">
                {/* Horizontal Scroll Indicators */}
                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-neutral-900 to-transparent z-20 pointer-events-none opacity-0 group-has-[[data-scroll='left']]:opacity-100 group-has-[[data-scroll='both']]:opacity-100 transition-opacity" />
                <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-neutral-900 via-neutral-900/80 to-transparent z-20 pointer-events-none opacity-0 group-has-[[data-scroll='right']]:opacity-100 group-has-[[data-scroll='both']]:opacity-100 transition-opacity" />

                <div
                  className="overflow-x-auto min-h-[300px] scrollbar-hide"
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
                  <table className="w-full text-left border-collapse min-w-[600px] sm:min-w-full">
                    <thead className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-white/5 sticky top-0 z-30 backdrop-blur-md">
                      <tr>
                        <th className="px-6 py-5 whitespace-nowrap sticky left-0 bg-neutral-900 z-40 border-r border-white/5 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">Data / Hora</th>
                        <th className="px-6 py-5">Ativo Patrimonial</th>
                        <th className="px-6 py-5 text-right pr-10">Status Transição</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {recentActivity.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-6 py-20 text-center text-muted-foreground italic text-sm">
                            Nenhum registro de atividade nas últimas 24h
                          </td>
                        </tr>
                      ) : (
                        recentActivity.map((log) => (
                          <tr key={log.id} className="group hover:bg-white/[0.02] transition-colors">
                            <td className="px-6 py-5 whitespace-nowrap sticky left-0 bg-neutral-900/95 group-hover:bg-neutral-800/95 transition-colors z-30 border-r border-white/5 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">
                              <div className="flex flex-col">
                                <span className="text-white font-bold text-xs">{new Date(log.created_at).toLocaleDateString("pt-BR")}</span>
                                <span className="font-mono text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
                                  {new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap">
                              <div className="flex items-center gap-4">
                                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner group-hover:scale-110 transition-transform">
                                  <Box className="h-4 w-4" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-white font-black text-xs uppercase italic tracking-tight group-hover:text-primary transition-colors">
                                    {log.products?.brand || "N/A"} {log.products?.model || "N/A"}
                                  </span>
                                  <span className="font-mono text-[9px] text-muted-foreground uppercase opacity-60">
                                    {log.products?.internal_serial || "N/A"}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-right whitespace-nowrap pr-10">
                              <span className="inline-flex px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest shadow-sm">
                                {log.new_status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Performance Chart Placeholder */}
            <div className="glass-card p-4 sm:p-6 border-white/5 bg-neutral-900/40">
              <div className="mb-6">
                <h3 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Performance
                </h3>
                <p className="text-xs text-muted-foreground mt-1">Métricas de produtividade diária</p>
              </div>
              <div className="h-[200px] sm:h-[300px] w-full flex items-end justify-between gap-2 px-2">
                {[40, 70, 45, 90, 60, 80, 55].map((h, i) => (
                  <div key={i} className="w-full bg-primary/20 rounded-t-lg relative group overflow-hidden" style={{ height: `${h}%` }}>
                    <div className="absolute bottom-0 left-0 w-full bg-primary/50 h-0 transition-all duration-500 group-hover:h-full" />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <span>Seg</span>
                <span>Ter</span>
                <span>Qua</span>
                <span>Qui</span>
                <span>Sex</span>
                <span>Sáb</span>
                <span>Dom</span>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 text-center">
                <p className="text-xs text-muted-foreground">Tempo Médio de Processamento: <span className="text-emerald-500 font-bold">{leadTime.avg}</span> ({leadTime.status})</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
