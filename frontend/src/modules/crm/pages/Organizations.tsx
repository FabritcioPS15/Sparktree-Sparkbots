import React, { useState } from 'react';
import { Building2, Plus, Users, Crown, Clock, Edit2, Trash2, Info } from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { HeaderButton } from '../../../components/ui/HeaderButton';
import { CountBadge } from '../../../components/ui/CountBadge';
import { PageContainer } from '../../../components/layout/PageContainer';
import { PageBody } from '../../../components/layout/PageBody';
import { PageLoader } from '../../../components/layout/PageLoader';
import { DataTable } from '../../../components/ui/DataTable';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { KebabMenu } from '../../../components/ui/KebabMenu';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { SearchBar } from '../../../components/ui/SearchBar';
import { Dropdown } from '../../../components/ui/Dropdown';
import { ViewToggle, ViewMode } from '../../../components/ui/ViewToggle';

const MOCK_ORGS = [
  { id: '1', name: 'Acme Corp', plan: 'enterprise', userCount: 150, created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
  { id: '2', name: 'TechFlow', plan: 'pro', userCount: 20, created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() },
  { id: '3', name: 'Studio Creative', plan: 'free', userCount: 3, created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
  { id: '4', name: 'Global Logistics', plan: 'enterprise', userCount: 450, created_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString() },
  { id: '5', name: 'Fintech Solutions', plan: 'pro', userCount: 45, created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() },
  { id: '6', name: 'EduPlatform', plan: 'free', userCount: 5, created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
];

type SortField = 'name' | 'plan' | 'usageTime';
type SortOrder = 'asc' | 'desc';

export const Organizations = () => {
  const [orgs, setOrgs] = useState<any[]>(MOCK_ORGS);
  const [loading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [editingOrg, setEditingOrg] = useState<any>(null);
  const [showPlansInfo, setShowPlansInfo] = useState(false);
  const [formData, setFormData] = useState({ name: '', plan: 'free' });
  const [sortField] = useState<SortField>('name');
  const [sortOrder] = useState<SortOrder>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const itemsPerPage = 10;

  const getOrgUsageTime = (org: any) => {
    if (!org.created_at) return { hours: 0, days: 0 };
    const createdDate = new Date(org.created_at);
    const now = new Date();
    const hoursDiff = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60));
    return { hours: hoursDiff, days: Math.floor(hoursDiff / 24) };
  };

  const handleCreateOrg = (e: React.FormEvent) => {
    e.preventDefault();
    const newOrg = {
      id: Math.random().toString(36).substr(2, 9),
      name: formData.name,
      plan: formData.plan,
      userCount: 1,
      created_at: new Date().toISOString()
    };
    setOrgs([...orgs, newOrg]);
    setIsModalOpen(false);
    setFormData({ name: '', plan: 'free' });
  };

  const handleUpdateOrg = (e: React.FormEvent) => {
    e.preventDefault();
    setOrgs(orgs.map(org => org.id === editingOrg.id ? { ...org, name: formData.name, plan: formData.plan } : org));
    setEditingOrg(null);
    setFormData({ name: '', plan: 'free' });
    setIsModalOpen(false);
  };

  const handleDeleteOrg = () => {
    if (!deleteTarget) return;
    setOrgs(orgs.filter(org => org.id !== deleteTarget));
    setDeleteTarget(null);
  };

  const filteredOrgs = orgs.filter(org => {
    const orgName = org.name || '';
    const orgPlan = org.plan || 'free';
    const matchesSearch = orgName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlan = planFilter === 'all' || orgPlan.toLowerCase() === planFilter.toLowerCase();
    return matchesSearch && matchesPlan;
  });

  const sortedOrgs = [...filteredOrgs].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'name') {
      comparison = (a.name || '').localeCompare(b.name || '');
    } else if (sortField === 'plan') {
      comparison = (a.plan || '').localeCompare(b.plan || '');
    } else if (sortField === 'usageTime') {
      comparison = getOrgUsageTime(a).days - getOrgUsageTime(b).days;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const paginatedOrgs = sortedOrgs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(sortedOrgs.length / itemsPerPage);

  const columns = [
    {
      key: 'name',
      header: 'Empresa',
      render: (_: any, org: any) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 dark:bg-white/5 rounded-xl flex items-center justify-center text-slate-400">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white capitalize">
              {org.name.toLowerCase()}
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'plan',
      header: 'Plan',
      render: (_: any, org: any) => {
        const planMap: Record<string, { variant: 'default' | 'success' | 'info' | 'primary' | 'danger' | 'warning'; label: string }> = {
          free: { variant: 'default', label: 'Free' },
          pro: { variant: 'success', label: 'Pro' },
          enterprise: { variant: 'info', label: 'Enterprise' },
        };
        const plan = (org.plan || 'free').toLowerCase();
        const cfg = planMap[plan] || planMap.free;
        return (
          <Badge variant={cfg.variant} size="xs" shape="rounded" icon={<Crown className="w-2.5 h-2.5" />}>
            {cfg.label}
          </Badge>
        );
      }
    },
    {
      key: 'users',
      header: 'Usuarios',
      render: (_: any, org: any) => (
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <Users className="w-3.5 h-3.5" />
          <span className="font-medium">{org.userCount || 0}</span>
        </div>
      )
    },
    {
      key: 'time',
      header: 'Tiempo',
      render: (_: any, org: any) => (
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-medium">{getOrgUsageTime(org).days}d</span>
        </div>
      )
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      render: (_: any, org: any) => (
        <KebabMenu actions={[
          { label: 'Editar', icon: <Edit2 className="w-3.5 h-3.5" />, onClick: () => { setEditingOrg(org); setFormData({ name: org.name, plan: org.plan }); setIsModalOpen(true); } },
          { label: 'Eliminar', icon: <Trash2 className="w-3.5 h-3.5" />, onClick: () => setDeleteTarget(org.id), variant: 'danger' },
        ]} />
      )
    }
  ];

  if (loading) return <PageLoader sectionName="Organizaciones" />;

  return (
    <>
      <PageContainer>
        <PageHeader
          title="Gestión de"
          highlight="Empresas"
          description="Administra el ecosistema de tenantes."
          icon={Building2}
          action={
            <div className="flex items-center gap-3">
              <HeaderButton
                variant="ghost"
                onClick={() => setShowPlansInfo(true)}
                icon={<Info className="w-4 h-4" />}
              >
              </HeaderButton>
              <CountBadge count={orgs.length} />
              <HeaderButton variant="secondary" onClick={() => setIsModalOpen(true)} icon={<Plus className="w-4 h-4" />}>
                Nueva Empresa
              </HeaderButton>
            </div>
          }
        />

        <PageBody>
          <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden p-6">
          {/* ── Barra de filtros unificada ── */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <SearchBar
                placeholder="Buscar empresas por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="flex items-center gap-2 shrink-0">
                <Dropdown
                  value={planFilter}
                  onChange={setPlanFilter}
                  options={[
                    { value: 'all', label: 'Todos los Planes' },
                    { value: 'free', label: 'Starter' },
                    { value: 'pro', label: 'Growth' },
                    { value: 'enterprise', label: 'Global' },
                  ]}
                />
                <ViewToggle value={viewMode} onChange={setViewMode} />
              </div>
            </div>

            {viewMode === 'table' ? (
              <DataTable
                columns={columns}
                data={paginatedOrgs}
                pagination={{ currentPage, totalPages, onPageChange: setCurrentPage }}
              />
            ) : (
              <>
                {paginatedOrgs.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-semibold">Sin empresas</p>
                    <p className="text-sm">Ajusta los filtros o agrega una nueva empresa.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {paginatedOrgs.map((org) => {
                      const usage = getOrgUsageTime(org);
                      const planMap: Record<string, { variant: 'default' | 'success' | 'info'; label: string }> = {
                        free: { variant: 'default', label: 'Starter' },
                        pro: { variant: 'success', label: 'Growth' },
                        enterprise: { variant: 'info', label: 'Global' },
                      };
                      const plan = (org.plan || 'free').toLowerCase();
                      const cfg = planMap[plan] || planMap.free;
                      return (
                        <div key={org.id} className="group bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-4 hover:border-accent-500/40 hover:shadow-lg hover:shadow-accent-500/5 transition-all">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-accent-500/10 flex items-center justify-center shrink-0">
                                <Building2 className="w-5 h-5 text-accent-500" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white text-sm capitalize leading-tight">{org.name.toLowerCase()}</p>
                                <p className="text-[10px] text-slate-400">{new Date(org.created_at).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <Badge variant={cfg.variant} size="xs" shape="rounded" icon={<Crown className="w-2.5 h-2.5" />}>{cfg.label}</Badge>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/50">
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{org.userCount || 0}</span>
                              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{usage.days}d</span>
                            </div>
                            <KebabMenu actions={[
                              { label: 'Editar', icon: <Edit2 className="w-3.5 h-3.5" />, onClick: () => { setEditingOrg(org); setFormData({ name: org.name, plan: org.plan }); setIsModalOpen(true); } },
                              { label: 'Eliminar', icon: <Trash2 className="w-3.5 h-3.5" />, onClick: () => setDeleteTarget(org.id), variant: 'danger' },
                            ]} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button key={page} onClick={() => setCurrentPage(page)} className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${page === currentPage ? 'bg-accent-500 text-black' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>{page}</button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </PageBody>

        {/* Modal Reusable Structure */}
        {(isModalOpen || editingOrg) && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-[#0f1115] w-full max-w-md rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-2xl overflow-hidden relative">
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent-500/5 blur-3xl rounded-full -mr-16 -mt-16" />

              <div className="p-8 relative z-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-accent-500/10 rounded-2xl text-accent-500 shadow-lg shadow-accent-500/10">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                      {editingOrg ? 'Editar Empresa' : 'Nueva Empresa'}
                    </h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                      {editingOrg ? 'Modifica los datos de la organizaciÃ³n' : 'Registra una nueva empresa en el sistema'}
                    </p>
                  </div>
                </div>

                <form onSubmit={editingOrg ? handleUpdateOrg : handleCreateOrg} className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Nombre Comercial</label>
                    <div className="relative">
                      <input
                        type="text" required
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3.5 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all font-bold text-sm text-slate-900 dark:text-white placeholder-slate-400/60"
                        placeholder="Ej. SparkBot Corporation"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <Building2 className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Tipo de Plan</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'free', label: 'Starter', desc: 'BÃ¡sico', color: 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700' },
                        { value: 'pro', label: 'Growth', desc: 'Profesional', color: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' },
                        { value: 'enterprise', label: 'Global', desc: 'Empresarial', color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' }
                      ].map((plan) => (
                        <button
                          key={plan.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, plan: plan.value })}
                          className={`relative p-3 rounded-xl border-2 transition-all font-black text-[10px] uppercase tracking-widest ${formData.plan === plan.value
                            ? `${plan.color} border-accent-500 shadow-lg shadow-accent-500/20`
                            : `${plan.color} border-transparent hover:border-accent-500/30`
                            }`}
                        >
                          <div className="font-black">{plan.label}</div>
                          <div className="text-[8px] opacity-60 mt-0.5">{plan.desc}</div>
                          {formData.plan === plan.value && (
                            <div className="absolute top-1 right-1 w-2 h-2 bg-accent-500 rounded-full shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => { setIsModalOpen(false); setEditingOrg(null); setFormData({ name: '', plan: 'free' }); }}
                      className="flex-1 py-3.5 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:text-slate-700 transition-colors rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3.5 bg-accent-500 text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-accent-600 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-accent-500/25"
                    >
                      {editingOrg ? 'Actualizar Empresa' : 'Crear Empresa'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Plans Info Modal */}
        <Modal
          open={showPlansInfo}
          onClose={() => setShowPlansInfo(false)}
          title="Planes Disponibles"
          size="lg"
          icon={<Info className="w-5 h-5 text-accent-500" />}
        >
          <div className="space-y-2">
            {[
              { key: 'free', title: 'Starter', desc: 'Perfecto para empezar', features: ['5 usuarios', '1K mensajes', 'Soporte básico'], dot: 'bg-slate-400', badge: 'text-slate-500 bg-slate-50 dark:bg-slate-800' },
              { key: 'pro', title: 'Growth', desc: 'Ideal para equipos', features: ['25 usuarios', '10K mensajes', 'Soporte prioritario'], dot: 'bg-emerald-400', badge: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
              { key: 'enterprise', title: 'Global', desc: 'Máxima capacidad', features: ['Usuarios ∞', 'Mensajes ∞', 'Soporte 24/7'], dot: 'bg-purple-400', badge: 'text-purple-500 bg-purple-50 dark:bg-purple-500/10' },
            ].map((p) => (
              <div key={p.key} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[10px] font-bold ${p.badge}`}>
                  {p.title.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{p.title}</h4>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{p.desc}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {p.features.map((f, i) => (
                      <span key={i} className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md">
                        <span className={`w-1 h-1 rounded-full ${p.dot}`} />
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      </PageContainer>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteOrg}
        title="Eliminar organización"
        message="¿Eliminar esta organización? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        variant="danger"
      />
    </>
  );
};


