import React, { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Plus, Search, User, Mail, Phone, MapPin, Loader2, X, ShieldCheck, Pencil, Trash2, Hash, Building2, Settings } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/AuthProvider";
import { Client } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ClientsPage() {
  const { profile } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  // const [stats, setStats] = useState({ total: 0, new: 0, growth: "0%" });
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientForm, setClientForm] = useState({ name: "", tax_id: "", email: "", phone: "", address: "" });
  const [isSaving, setIsSaving] = useState(false);

  const canEdit = profile?.role === "GESTOR" || profile?.role === "ADMIN";

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const clientList = (data as Client[]) || [];
      setClients(clientList);

      // Calculate Stats
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const newThisMonth = clientList.filter(c => new Date(c.created_at) > thirtyDaysAgo).length;
      const total = clientList.length;
      const previousTotal = total - newThisMonth;
      const growth = previousTotal > 0 ? `${Math.round((newThisMonth / previousTotal) * 100)}%` : "100%";

      // setStats({ total, new: newThisMonth, growth });
    } catch (error) {
      const err = error as Error;
      console.error("Erro ao buscar clientes:", err);
      toast.error("Erro ao carregar clientes", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClient = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja remover o parceiro "${name}"? Esta ação não pode ser desfeita.`)) return;

    setIsDeleting(id);
    try {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;

      toast.success("Parceiro removido com sucesso");
      fetchClients();
    } catch (error) {
      const err = error as Error;
      toast.error("Erro ao remover", { description: err.message });
    } finally {
      setIsDeleting(null);
    }
  };

  const formatTaxId = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4").substring(0, 14);
    }
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5").substring(0, 18);
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3").substring(0, 14);
    }
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3").substring(0, 15);
  };

  const handleOpenModal = (client: Client | null = null) => {
    if (client) {
      setEditingClient(client);
      setClientForm({
        name: client.name || "",
        tax_id: client.tax_id || "",
        email: client.email || "",
        phone: client.phone || "",
        address: client.address || ""
      });
    } else {
      setEditingClient(null);
      setClientForm({ name: "", tax_id: "", email: "", phone: "", address: "" });
    }
    setShowModal(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingClient) {
        const { error } = await supabase
          .from("clients")
          .update(clientForm)
          .eq("id", editingClient.id);

        if (error) throw error;
        toast.success("Cliente atualizado!");
      } else {
        const { error } = await supabase
          .from("clients")
          .insert([{
            name: clientForm.name,
            email: clientForm.email,
            phone: clientForm.phone,
            address: clientForm.address,
            tax_id: clientForm.tax_id
          }]);

        if (error) throw error;
        toast.success("Cliente cadastrado!");
      }

      setShowModal(false);
      fetchClients();
    } catch (error) {
      const err = error as Error;
      toast.error("Erro ao salvar", { description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.tax_id || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-6 pb-20 sm:pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-white uppercase italic">
              Gestão de <span className="text-primary not-italic font-light">Clientes</span>
            </h1>
            <p className="text-muted-foreground font-medium text-sm sm:text-base mt-1">
              Administração de base de clientes e contratos.
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => handleOpenModal()}
              className="glass-button px-4 py-2 bg-white text-black hover:bg-white/90 flex items-center gap-2 text-sm font-bold uppercase tracking-wider w-full sm:w-auto justify-center rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              Novo Cliente
            </button>
          )}
        </div>

        {/* Clients Table */}
        <div className="glass-card border-white/5 bg-neutral-900/40 overflow-hidden rounded-xl border">
          <div className="p-4 sm:p-6 border-b border-white/5">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nome ou documento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
          </div>
          <div className="relative group/table" data-scroll="right">
            {/* Horizontal Scroll Indicators */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-neutral-900 to-transparent z-20 pointer-events-none opacity-0 group-has-[[data-scroll='left']]:opacity-100 group-has-[[data-scroll='both']]:opacity-100 transition-opacity" />
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-neutral-900 via-neutral-900/80 to-transparent z-20 pointer-events-none opacity-0 group-has-[[data-scroll='right']]:opacity-100 group-has-[[data-scroll='both']]:opacity-100 transition-opacity" />

            <div
              className="overflow-x-auto scrollbar-hide"
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
              <table className="w-full text-left text-sm border-collapse min-w-[800px] sm:min-w-full">
                <thead className="bg-white/5 text-muted-foreground uppercase text-[9px] sm:text-[10px] font-black tracking-widest border-b border-white/5 sticky top-0 z-30 backdrop-blur-md">
                  <tr>
                    <th className="px-4 sm:px-6 py-5 whitespace-nowrap sticky left-0 bg-neutral-900/95 z-40 border-r border-white/5 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">Identificação / Nome</th>
                    <th className="px-4 sm:px-6 py-5 whitespace-nowrap">Código</th>
                    <th className="px-4 sm:px-6 py-5 whitespace-nowrap">Contato Principal</th>
                    <th className="px-4 sm:px-6 py-5 whitespace-nowrap">Localização</th>
                    <th className="px-4 sm:px-6 py-5 text-right whitespace-nowrap pr-6 sm:pr-10">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <Loader2 className="h-10 w-10 animate-spin text-primary opacity-40" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sincronizando Base de Clientes</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredClients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center text-muted-foreground italic text-sm">
                        Nenhum registro de cliente localizado na busca
                      </td>
                    </tr>
                  ) : (
                    filteredClients.map((client) => (
                      <tr
                        key={client.id}
                        className="group hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-4 sm:px-6 py-5 whitespace-nowrap sticky left-0 bg-neutral-900/95 group-hover:bg-neutral-800/95 transition-colors z-30 border-r border-white/5 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">
                          <div className="flex flex-col">
                            <span className="text-white font-black text-[13px] sm:text-base leading-tight group-hover:text-primary transition-colors uppercase italic">{client.name}</span>
                            <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-widest mt-1 font-black flex items-center gap-1.5 opacity-60">
                              <Building2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                              PF/PJ: {client.tax_id || "N/A"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-primary/10 group-hover:border-primary/30 transition-all text-muted-foreground group-hover:text-primary shadow-inner">
                              <Hash className="h-3 w-3 sm:h-4 sm:w-4" />
                            </div>
                            <span className="font-mono text-[10px] sm:text-xs font-bold text-white/50 group-hover:text-primary transition-colors uppercase">
                              {client.id.substring(0, 8)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                          <div className="flex flex-col gap-1 sm:gap-1.5">
                            <div className="flex items-center gap-2 text-white/80 font-bold text-[10px] sm:text-xs">
                              <Mail className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary opacity-70" />
                              {client.email}
                            </div>
                            {client.phone && (
                              <div className="flex items-center gap-2 text-muted-foreground font-black text-[9px] sm:text-[10px] tracking-wide uppercase">
                                <Phone className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary opacity-50" />
                                {client.phone}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-muted-foreground text-[9px] sm:text-[10px] font-black bg-white/5 w-fit px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-white/5 shadow-inner uppercase">
                            <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary opacity-70" />
                            {client.address ? (client.address.length > 25 ? client.address.substring(0, 25) + '...' : client.address) : "Sem Endereço"}
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-5 text-right whitespace-nowrap pr-6 sm:pr-10">
                          <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                            <button
                              onClick={() => handleOpenModal(client)}
                              className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-white/5 flex items-center justify-center border border-white/10 hover:bg-primary/20 hover:border-primary/50 transition-all text-muted-foreground hover:text-primary shadow-inner active:scale-95"
                              title="Editar Cliente"
                            >
                              <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </button>
                            {canEdit && (
                              <button
                                onClick={() => handleDeleteClient(client.id, client.name)}
                                className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-white/5 flex items-center justify-center border border-white/10 hover:bg-red-500/20 hover:border-red-500/50 transition-all text-muted-foreground hover:text-red-500 shadow-inner active:scale-95"
                                title="Excluir Cliente"
                              >
                                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal de Cadastro/Edição */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-500">
            <div className="glass-card w-full max-w-lg space-y-6 sm:space-y-8 border-white/10 shadow-2xl p-6 sm:p-10 bg-neutral-900/95 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

              <div className="flex items-center justify-between relative">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black text-white tracking-tight">{editingClient ? "Sincronizar Perfil" : "Novo Cadastro"}</h2>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-black">Informações do Cliente / Parceiro</p>
                </div>
                <button onClick={() => setShowModal(false)} className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center text-muted-foreground hover:text-white transition-all hover:bg-red-500/20 hover:text-red-500 border border-white/10">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSaveClient} className="space-y-6 relative">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Nome Completo / Razão Social</label>
                  <div className="relative group/field">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                      <User className="h-4 w-4 text-muted-foreground group-focus-within/field:text-primary transition-colors" />
                    </div>
                    <input
                      required
                      value={clientForm.name}
                      onChange={e => setClientForm({ ...clientForm, name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 text-white transition-all shadow-inner font-bold"
                      placeholder="Nome oficial da entidade"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Documento Identificação</label>
                    <div className="relative group/field">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                        <ShieldCheck className="h-4 w-4 text-muted-foreground group-focus-within/field:text-primary transition-colors" />
                      </div>
                      <input
                        value={clientForm.tax_id}
                        onChange={e => setClientForm({ ...clientForm, tax_id: formatTaxId(e.target.value) })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 font-mono text-white transition-all shadow-inner font-bold"
                        placeholder="CPF ou CNPJ"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Telefone Principal</label>
                    <div className="relative group/field">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                        <Phone className="h-4 w-4 text-muted-foreground group-focus-within/field:text-primary transition-colors" />
                      </div>
                      <input
                        value={clientForm.phone}
                        onChange={e => setClientForm({ ...clientForm, phone: formatPhone(e.target.value) })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 text-white transition-all shadow-inner font-bold"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">E-mail Corporativo</label>
                  <div className="relative group/field">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                      <Mail className="h-4 w-4 text-muted-foreground group-focus-within/field:text-primary transition-colors" />
                    </div>
                    <input
                      type="email"
                      value={clientForm.email}
                      onChange={e => setClientForm({ ...clientForm, email: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 text-white transition-all shadow-inner font-bold"
                      placeholder="email@empresa.com.br"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Endereço de Correspondência</label>
                  <div className="relative group/field">
                    <div className="absolute top-4 left-4 pointer-events-none">
                      <MapPin className="h-4 w-4 text-muted-foreground group-focus-within/field:text-primary transition-colors" />
                    </div>
                    <textarea
                      value={clientForm.address}
                      onChange={e => setClientForm({ ...clientForm, address: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-4 h-28 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 resize-none text-white transition-all shadow-inner font-bold"
                      placeholder="Rua, Número, Bairro, Cidade - Estado"
                    />
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-[2] bg-primary hover:brightness-110 text-white font-black uppercase tracking-[0.2em] text-[10px] h-16 rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 border-t border-white/10 flex items-center justify-center gap-3"
                  >
                    {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <ShieldCheck className="h-6 w-6" />}
                    {editingClient ? "Sincronizar Alterações" : "Efetivar Cadastro"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white h-16"
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
