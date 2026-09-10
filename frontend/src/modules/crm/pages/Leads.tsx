import { useState, useEffect } from 'react';
import { Phone, Mail, MessageSquare, TrendingUp, Plus, Eye, Tag, UserPlus } from 'lucide-react';
import { getLeads, updateCrmClient } from '../../../services/api';
import { formatPhoneNumber } from '../../../utils/phone';
import { PageHeader } from '../../../components/layout/PageHeader';
import { HeaderButton } from '../../../components/ui/HeaderButton';
import { CountBadge } from '../../../components/ui/CountBadge';
import { PageContainer } from '../../../components/layout/PageContainer';
import { PageBody } from '../../../components/layout/PageBody';
import { PageLoader } from '../../../components/layout/PageLoader';
import { ResponsiveList, ResponsiveColumn } from '../../../components/ui/ResponsiveList';
import { SearchBar } from '../../../components/ui/SearchBar';
import { Dropdown } from '../../../components/ui/Dropdown';
import { ViewToggle, ViewMode } from '../../../components/ui/ViewToggle';
import { Badge } from '../../../components/ui/Badge';
import { TagChip } from '../../../components/ui/TagChip';
import { TableCard } from '../../../components/ui/TableCard';
import { Modal } from '../../../components/ui/Modal';
import { useNotifications } from '../../../contexts/NotificationContext';

interface Lead {
  id: string;
  _id?: string;
  name: string;
  email?: string;
  phone: string;
  company?: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  priority: 'low' | 'medium' | 'high';
  source: 'website' | 'whatsapp' | 'referral' | 'social' | 'other';
  score: number;
  lastInteraction: string;
  notes: string;
  assignedTo?: string;
  tags: string[];
  conversationsCount: number;
  avgResponseTime?: number;
  budget?: string;
  timeline?: string;
  isHappyPath: boolean;
  flowCompleted: string[];
  currentStage: string;
}

export const Leads = () => {
  const { addNotification } = useNotifications();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const itemsPerPage = 10;

  useEffect(() => {
    let intervalId: any;
    const fetchLeads = async () => {
      try {
        const data = await getLeads();
        const rawLeads = Array.isArray(data) ? data : [];
        const mappedLeads = rawLeads.map((contact: any) => ({
          ...contact,
          id: contact.id || contact._id,
          name: contact.profile_name || contact.name || 'Sin nombre',
          phone: contact.phone_number || contact.phone || 'Sin número',
          company: contact.company || contact.custom_attributes?.company,
          email: contact.email || contact.custom_attributes?.email,
          status: contact.status || contact.custom_attributes?.status || 'new',
          priority: contact.priority || contact.custom_attributes?.priority || 'medium',
          score: contact.custom_attributes?.score || 85,
          currentStage: contact.custom_attributes?.currentStage || 'Interesado',
          isHappyPath: true,
          tags: contact.custom_attributes?.tags || ['HOT LEAD'],
          conversationsCount: contact.conversations_count || 1,
        }));
        setLeads(mappedLeads);
      } catch (error) {
        console.error("Error fetching leads:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLeads();
    intervalId = setInterval(fetchLeads, 15000);
    return () => clearInterval(intervalId);
  }, []);

  const filteredLeads = leads.filter(lead => {
    if (!lead.isHappyPath) return false;
    const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || lead.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'new': return 'primary';
      case 'contacted': return 'warning';
      case 'qualified': return 'success';
      case 'converted': return 'success';
      case 'lost': return 'danger';
      default: return 'default';
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'high': return 'danger';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-gray-700 bg-gray-100';
    if (score >= 60) return 'text-gray-600 bg-gray-100';
    return 'text-gray-500 bg-gray-100';
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'new': return 'Nuevo';
      case 'contacted': return 'Contactado';
      case 'qualified': return 'Calificado';
      case 'converted': return 'Convertido';
      case 'lost': return 'Perdido';
      default: return status;
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return 'Alta';
      case 'medium': return 'Media';
      case 'low': return 'Baja';
      default: return priority;
    }
  };

  const handleEditLead = (lead: Lead) => {
    setEditingLead(lead);
    setEditForm({ name: lead.name, phone: lead.phone, email: lead.email || '' });
  };

  const handleSaveEdit = async () => {
    if (!editingLead) return;
    setSavingEdit(true);
    try {
      await updateCrmClient(editingLead.id, { ...editForm, company: '', status: editingLead.status, source: 'whatsapp', notes: '' });
      addNotification({ type: 'success', title: 'Lead actualizado', message: `${editForm.name} fue actualizado.` });
      setEditingLead(null);
      // Refresh leads
      const data = await getLeads();
      const rawLeads = Array.isArray(data) ? data : [];
      setLeads(rawLeads.map((c: any) => ({
        ...c, id: c.id || c._id, name: c.profile_name || c.name || 'Sin nombre',
        phone: c.phone_number || c.phone || 'Sin número',
      })));
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo guardar.' });
    } finally {
      setSavingEdit(false);
    }
  };

  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const responsiveColumns: ResponsiveColumn<Lead>[] = [
    {
      key: 'lead',
      header: 'Lead / Empresa',
      mobilePriority: 'high',
      render: (lead) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-500/10 flex items-center justify-center font-black text-accent-600 dark:text-accent-400 text-sm group-hover:scale-110 transition-transform">
            {lead.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="font-black text-slate-900 dark:text-white text-sm tracking-tight group-hover:text-accent-600 dark:group-hover:text-accent-400 transition-colors truncate">{lead.name}</div>
            <div className="text-xs font-bold text-slate-400 dark:text-slate-500 truncate">{lead.company || 'Personal'}</div>
            <div className="flex gap-1 mt-1">
              {lead.tags.slice(0, 2).map((tag: any, index: number) => (
                <TagChip key={index} color="slate" size="xs">
                  {tag}
                </TagChip>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'contact',
      header: 'Contacto',
      mobilePriority: 'high',
      render: (lead) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            <div className="p-1 bg-slate-100 dark:bg-slate-800 rounded"><Mail className="w-3 h-3" /></div>
            <span className="truncate">{lead.email || 'Sin correo'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            <div className="p-1 bg-slate-100 dark:bg-slate-800 rounded"><Phone className="w-3 h-3" /></div>
            {(() => { const p = formatPhoneNumber(lead.phone); return p.prefix ? <><span className="text-accent-500">{p.prefix}</span> {p.number}</> : <span>{lead.phone}</span>; })()}
          </div>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Estado & Score',
      mobilePriority: 'medium',
      render: (lead) => (
        <div className="flex items-center gap-4">
          <div className="space-y-1">
            <Badge variant={getStatusVariant(lead.status)} size="xs" dot>
              {getStatusText(lead.status)}
            </Badge>
            <div className="flex items-center gap-1">
              <Badge variant={getPriorityVariant(lead.priority)} size="xs" shape="rounded">
                {getPriorityText(lead.priority)}
              </Badge>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-lg ${getScoreColor(lead.score)}`}>
              {lead.score}
            </div>
            <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 mt-1 uppercase">Score</span>
          </div>
        </div>
      )
    }
  ];

  if (loading) return <PageLoader sectionName="Prospectos" />;

  return (
    <PageContainer>
      <PageHeader
        title="Gestión de"
        highlight="Leads"
        description="Monitoriza a los usuarios que están listos para la conversión."
        icon={TrendingUp}
        action={
          <div className="flex items-center gap-3">
            <CountBadge count={leads.length} />
            <HeaderButton onClick={() => {}} icon={<Plus className="w-4 h-4" />}>
              Nuevo Lead
            </HeaderButton>
          </div>
        }
      />

      <PageBody>
        <TableCard>
          {/* ── Barra de filtros unificada ── */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <SearchBar
              placeholder="Buscar por nombre, empresa o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="flex items-center gap-2 shrink-0">
              <Dropdown
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'Todos los Estados' },
                  { value: 'new', label: 'Nuevos' },
                  { value: 'contacted', label: 'Contactados' },
                  { value: 'qualified', label: 'Calificados' },
                  { value: 'converted', label: 'Convertidos' },
                ]}
              />
              <Dropdown
                value={priorityFilter}
                onChange={setPriorityFilter}
                options={[
                  { value: 'all', label: 'Todas las prioridades' },
                  { value: 'high', label: 'Prioridad Alta' },
                  { value: 'medium', label: 'Prioridad Media' },
                  { value: 'low', label: 'Prioridad Baja' },
                ]}
              />
              <ViewToggle value={viewMode} onChange={setViewMode} />
            </div>
          </div>

          {viewMode === 'table' ? (
            <ResponsiveList
              columns={responsiveColumns}
              data={paginatedLeads}
              onRowClick={(lead) => setSelectedLead(lead)}
              getId={(lead) => lead.id}
              actions={(lead) => [
                { icon: <Eye className="w-4 h-4" />, label: 'Ver Detalle', onClick: () => setSelectedLead(lead), tooltip: 'Ver Detalle' },
                { icon: <MessageSquare className="w-4 h-4" />, label: 'Enviar Mensaje', onClick: () => { }, tooltip: 'Enviar Mensaje' },
              ]}
              pagination={{
                currentPage,
                totalPages,
                onPageChange: setCurrentPage
              }}
            />
          ) : (
            <>
              {paginatedLeads.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-semibold">Sin leads</p>
                  <p className="text-sm">Ajusta los filtros para ver resultados.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {paginatedLeads.map((lead) => (
                    <div
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className="group bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-4 hover:border-accent-500/40 hover:shadow-lg hover:shadow-accent-500/5 transition-all cursor-pointer"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-accent-500/10 flex items-center justify-center font-black text-accent-600 dark:text-accent-400 text-sm">
                            {lead.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{lead.name}</p>
                            <p className="text-xs text-slate-500 font-medium">{lead.company || 'Personal'}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-center">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shadow-sm ${getScoreColor(lead.score)}`}>
                            {lead.score}
                          </div>
                          <span className="text-[8px] font-black text-slate-400 uppercase mt-0.5">Score</span>
                        </div>
                      </div>

                      {/* Tags */}
                      {lead.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap mb-3">
                          {lead.tags.slice(0, 3).map((tag, i) => (
                            <span key={i} className="text-[10px] font-bold px-2 py-0.5 bg-accent-500/10 text-accent-600 dark:text-accent-400 rounded-full">{tag}</span>
                          ))}
                        </div>
                      )}

                      {/* Status & Priority */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                        <Badge variant={getStatusVariant(lead.status)} size="xs" dot>
                          {getStatusText(lead.status)}
                        </Badge>
                        <Badge variant={getPriorityVariant(lead.priority)} size="xs" shape="rounded">
                          {getPriorityText(lead.priority)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${
                        page === currentPage
                          ? 'bg-accent-500 text-black'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </TableCard>

        {/* Modern Lead Detail Modal */}
        <Modal
          open={!!selectedLead}
          onClose={() => setSelectedLead(null)}
          title={selectedLead?.name || ''}
          size="full"
          icon={selectedLead ? <div className="w-10 h-10 bg-accent-600 rounded-xl flex items-center justify-center text-white text-lg font-black shadow-lg">{selectedLead.name.charAt(0)}</div> : undefined}
          className="overflow-hidden"
        >
          {selectedLead && (
            <div className="flex flex-col -m-6">
              <div className="flex gap-3 mt-4 px-6">
                <Badge variant={getStatusVariant(selectedLead.status)} size="md" dot>
                  {getStatusText(selectedLead.status)}
                </Badge>
                <Badge variant={getPriorityVariant(selectedLead.priority)} size="md">
                  Prioridad {getPriorityText(selectedLead.priority)}
                </Badge>
              </div>

              <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-10 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="md:col-span-2 space-y-10">
                    <section className="space-y-6">
                      <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3">
                        <div className="w-8 h-px bg-slate-200 dark:bg-slate-800" />
                        Análisis del Happy Path
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-6 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-700/50">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Presupuesto Estimado</p>
                          <p className="text-xl font-black text-slate-900 dark:text-white">{selectedLead.budget || 'Bajo consulta'}</p>
                        </div>
                        <div className="p-6 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-700/50">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tiempo de Cierre</p>
                          <p className="text-xl font-black text-slate-900 dark:text-white">{selectedLead.timeline || 'Inmediato'}</p>
                        </div>
                      </div>
                      <div className="p-8 bg-accent-500/5 rounded-3xl border border-accent-500/20">
                        <p className="text-[10px] font-black text-accent-500 uppercase tracking-widest mb-4">Notas de la IA</p>
                        <p className="text-slate-700 dark:text-slate-300 font-bold leading-relaxed">{selectedLead.notes}</p>
                      </div>
                    </section>

                    <section className="space-y-6">
                      <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3">
                        <div className="w-8 h-px bg-slate-200 dark:bg-slate-800" />
                        Etiquetas & Segmentación
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedLead.tags.map((tag, index) => (
                          <TagChip key={index} color="primary" size="md" icon={<Tag className="w-3 h-3" />}>
                            {tag.toUpperCase()}
                          </TagChip>
                        ))}
                      </div>
                    </section>
                  </div>

                  <div className="space-y-4">
                    <div className="p-8 bg-slate-900 dark:bg-white rounded-[2.5rem] text-white dark:text-slate-900 shadow-2xl">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Lead Score</p>
                      <p className="text-6xl font-black mb-6">{selectedLead.score}</p>
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                          <p className="text-xs font-bold uppercase opacity-80">Calidad Premium</p>
                        </div>
                        <div className="pt-6 border-t border-white/10 dark:border-slate-200">
                          <p className="text-[10px] font-black uppercase opacity-60 mb-2">Etapa Actual</p>
                          <p className="text-lg font-black uppercase">{selectedLead.currentStage}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Contacto Directo</h4>
                      <div className="p-6 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center shadow-sm">
                            <Mail className="w-5 h-5 text-indigo-500" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</p>
                            <p className="text-sm font-bold truncate">{selectedLead.email || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center shadow-sm">
                            <Phone className="w-5 h-5 text-emerald-500" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WhatsApp</p>
                            <p className="text-sm font-bold truncate">
                              {(() => { const p = formatPhoneNumber(selectedLead.phone); return p.prefix ? <><span className="text-accent-500">{p.prefix}</span> {p.number}</> : selectedLead.phone; })()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-800/50 flex gap-4">
                <button className="flex-1 px-8 py-5 bg-accent-600 text-white font-black rounded-2xl shadow-xl shadow-accent-600/20 hover:scale-105 active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-3">
                  <MessageSquare className="w-5 h-5" />
                  Iniciar Chat WhatsApp
                </button>
                <button onClick={() => { handleEditLead(selectedLead); setSelectedLead(null); }} className="px-8 py-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-black rounded-2xl shadow-sm hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-slate-900 transition-all text-sm uppercase tracking-widest">
                  Editar
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* Modal Editar Lead */}
        <Modal open={editingLead !== null} onClose={() => setEditingLead(null)} title="Editar Lead" icon={<UserPlus className="w-5 h-5 text-accent-500" />}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Nombre</label>
              <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all font-bold text-sm text-slate-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Teléfono</label>
              <input type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="w-full px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all font-bold text-sm text-slate-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Email</label>
              <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all font-bold text-sm text-slate-900 dark:text-white" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditingLead(null)} className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">Cancelar</button>
              <button onClick={handleSaveEdit} disabled={savingEdit} className="flex-1 py-3 bg-accent-500 text-black text-sm font-bold rounded-xl hover:bg-accent-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {savingEdit ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      </PageBody>
    </PageContainer>
  );
};
