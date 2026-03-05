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
  trend: string;
  label: string;
}

export default function Home() {
  const [stats, setStats] = useState<DashboardStat[]>([
    { name: "Patrimônio Ativo", value: "0", icon: Package, color: "text-blue-500", key: "TOTAL", trend: "+12%", label: "Total Geral" },
    { name: "Fila de Inspeção", value: "0", icon: Clock, color: "text-yellow-500", key: "CADASTRO", trend: "-5%", label: "Aguardando" },
    { name: "Pendente Liberação", value: "0", icon: AlertCircle, color: "text-orange-500", key: "EM AVALIAÇÃO", trend: "+8%", label: "Em Análise" },
    { name: "Stock Disponível", value: "0", icon: Box, color: "text-emerald-500", key: "EM ESTOQUE", trend: "+2.4%", label: "Pronto" },
  ]);
  const [recentActivity, setRecentActivity] = useState<DashboardLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [leadTime, setLeadTime] = useState({ avg: "4.2h", status: "Excelente" });

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000));

    try {
      // 1. Fetch Stats efficiently using count
      // Parallel queries for better performance
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
          { name: "Patrimônio Ativo", value: (total.count || 0).toString(), icon: Package, color: "text-blue-500", key: "TOTAL", trend: "+12%", label: "Total Geral" },
          { name: "Fila de Inspeção", value: (cadastro.count || 0).toString(), icon: Clock, color: "text-yellow-500", key: "CADASTRO", trend: "-5%", label: "Aguardando" },
          { name: "Pendente Liberação", value: (tecnico.count || 0).toString(), icon: AlertCircle, color: "text-orange-500", key: "TECNICO", trend: "+8%", label: "Em Análise" },
          { name: "Total Expedido", value: (liberado.count || 0).toString(), icon: CheckCircle2, color: "text-emerald-500", key: "LIBERADO", trend: "+24%", label: "Concluídos" },
        ]);
      }

      // 2. Fetch Recent Activity from product_logs (Limit 5 is fine)
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

      // 3. Simple Lead Time Sim (Real would calculate diff between LEITURA and LIBERADO)
      setLeadTime({ avg: "4.2h", status: "Excelente" });

    } catch (error) {
      console.error("Erro dashboard:", error);
      // Optional: Add UI feedback for error here
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
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                    <TrendingUp className="h-3 w-3" /> {stat.trend}
                  </span>
                </div>
                <div className="space-y-1 relative z-10">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{stat.label}</p>
                  <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tighter">{stat.value}</h3>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
            {/* Recent Activity */}
            <div className="glass-card p-4 sm:p-6 lg:col-span-2 border-white/5 bg-neutral-900/40">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Atividade Recente
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">Últimas movimentações no sistema</p>
                </div>
              </div>
              <div className="space-y-4">
                {recentActivity.length === 0 ? (
                  <div className="text-center p-4 text-muted-foreground text-sm">Nenhuma atividade recente</div>
                ) : (
                  recentActivity.map((log) => (
                    <div key={log.id} className="flex items-center gap-3 sm:gap-4 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <Package className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {log.products?.brand || "Marca N/A"} {log.products?.model || "Modelo N/A"}
                          <span className="ml-2 text-xs text-muted-foreground">({log.products?.internal_serial || "N/A"})</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleDateString()} • {new Date(log.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 whitespace-nowrap">
                        {log.new_status}
                      </div>
                    </div>
                  ))
                )}
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
