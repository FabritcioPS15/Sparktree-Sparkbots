import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Plus, Edit, Trash2, Copy, Sparkles, UserCheck, Tag, X, Activity, DollarSign, LifeBuoy, Megaphone, Compass, HelpCircle, Key, MessageSquare, LayoutGrid } from 'lucide-react';
import { ReactFlowProvider } from '@xyflow/react';
import { FlowBuilderContent } from '../components/FlowBuilderContent';
import { flowService, FlowBot } from '../../../services/flowService';
import { flowTemplates, FlowTemplate } from '../flowTemplates';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageContainer } from '../../../components/layout/PageContainer';
import { HeaderButton } from '../../../components/ui/HeaderButton';
import { CountBadge } from '../../../components/ui/CountBadge';
import { KebabMenu } from '../../../components/ui/KebabMenu';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { PageBody } from '../../../components/layout/PageBody';
import { PageLoader } from '../../../components/layout/PageLoader';
import { DataTable } from '../../../components/ui/DataTable';
import { Modal } from '../../../components/ui/Modal';
import { Dropdown } from '../../../components/ui/Dropdown';
import { SearchBar } from '../../../components/ui/SearchBar';
import { ViewToggle, ViewMode } from '../../../components/ui/ViewToggle';
import { useNotifications } from '../../../contexts/NotificationContext';

const CATEGORY_ICONS: Record<string, any> = {
  sales: DollarSign,
  support: LifeBuoy,
  marketing: Megaphone,
  onboarding: Compass,
  other: HelpCircle
};

const CATEGORY_LABELS: Record<string, string> = {
  sales: 'Ventas',
  support: 'Soporte',
  marketing: 'Marketing',
  onboarding: 'Inducción',
  other: 'Otro'
};

const CATEGORY_COLORS: Record<string, string> = {
  sales: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100/50 dark:border-emerald-500/20',
  support: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10 border-blue-100/50 dark:border-blue-500/20',
  marketing: 'text-violet-500 bg-violet-50 dark:bg-violet-500/10 border-violet-100/50 dark:border-violet-500/20',
  onboarding: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-500/10 border-cyan-100/50 dark:border-cyan-500/20',
  other: 'text-slate-500 bg-slate-50 dark:bg-slate-500/10 border-slate-100/50 dark:border-slate-500/20'
};

export const FlowManager = () => {
  const [flows, setFlows] = useState<FlowBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFlow, setEditingFlow] = useState<FlowBot | null>(null);
  const [selectedDetailFlow, setSelectedDetailFlow] = useState<FlowBot | null>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [tempDescription, setTempDescription] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [newFlowData, setNewFlowData] = useState({
    name: '',
    description: '',
    category: 'other' as 'sales' | 'support' | 'marketing' | 'onboarding' | 'other',
    triggers: [] as string[]
  });
  const [selectedTemplate, setSelectedTemplate] = useState<FlowTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FlowBot | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { addNotification } = useNotifications();

  // Load flows from API
  useEffect(() => {
    const loadFlows = async () => {
      try {
        setLoading(true);
        const data = await flowService.getFlows();
        setFlows(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error loading flows:', err);
        setFlows([]);
      } finally {
        setLoading(false);
      }
    };
    loadFlows();
  }, []);

  const refreshFlows = async () => {
    try {
      const data = await flowService.getFlows();
      setFlows(data);
    } catch (err) {
      console.error('Error refreshing flows:', err);
    }
  };

  const filteredAndSortedFlows = (Array.isArray(flows) ? flows : [])
    .filter(flow => {
      const matchesSearch = flow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        flow.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'all' || flow.category === filterCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => new Date(b.lastModified || '').getTime() - new Date(a.lastModified || '').getTime());

  const openFlowBuilder = (flow: FlowBot) => setEditingFlow(flow);
  const closeFlowBuilder = () => {
    setEditingFlow(null);
    refreshFlows(); // Essential to show saved changes when returning to the manager
  };

  const duplicateFlow = async (flow: FlowBot) => {
    try {
      await flowService.duplicateFlow(flow.id);
      addNotification({ type: 'success', title: 'Flujo duplicado', message: `"${flow.name}" fue duplicado correctamente.` });
      await refreshFlows();
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo duplicar el flujo.' });
      console.error('Error duplicating flow:', err);
    }
  };

  const deleteFlow = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await flowService.deleteFlow(deleteTarget.id);
      addNotification({ type: 'success', title: 'Flujo eliminado', message: `"${deleteTarget.name}" fue eliminado correctamente.` });
      await refreshFlows();
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo eliminar el flujo.' });
      console.error('Error deleting flow:', err);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const createFlow = async () => {
    if (!newFlowData.name.trim()) return;
    try {
      setLoading(true);
      const tpl = selectedTemplate;
      const newFlow = await flowService.createFlow({
        ...newFlowData,
        status: 'draft',
        matchingStrategy: tpl?.matchingStrategy,
        reactivationTime: tpl?.reactivationTime,
        nodes: tpl && tpl.nodes.length > 0
          ? tpl.nodes.map((n) => ({ ...n, data: { ...n.data, _updatedAt: Date.now() } }))
          : [{ id: 'trigger_1', type: 'trigger', position: { x: 100, y: 100 }, data: { label: 'Inicio', keywords: newFlowData.triggers } }],
        edges: tpl ? tpl.edges : [],
      });
      addNotification({ type: 'success', title: tpl ? 'Flujo creado desde plantilla' : 'Flujo creado', message: `"${newFlowData.name}" fue creado. Ahora puedes configurarlo.` });
      await refreshFlows();
      setShowCreateForm(false);
      setNewFlowData({ name: '', description: '', category: 'other', triggers: [] });
      setSelectedTemplate(null);
      openFlowBuilder(newFlow);
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo crear el flujo.' });
      console.error('Error creating flow:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = (tpl: FlowTemplate) => {
    setSelectedTemplate(tpl);
    setNewFlowData((prev) => ({
      ...prev,
      name: prev.name.trim() ? prev.name : tpl.name,
      description: tpl.description,
      category: tpl.category as any,
      triggers: tpl.triggers,
    }));
  };

  const paginatedFlows = filteredAndSortedFlows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredAndSortedFlows.length / itemsPerPage);

  const columns = [
    {
      key: 'flow',
      header: 'Flujo',
      render: (_: any, flow: FlowBot) => (
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center p-2 text-white transition-colors duration-500 ${flow.status === 'active' ? 'bg-accent-500 shadow-md shadow-accent-500/20' : 'bg-slate-900'}`}>
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-black text-slate-900 dark:text-white leading-none mb-1.5">{flow.name}</h4>
            <div className="flex items-center gap-1.5">
              {(() => {
                const CatIcon = CATEGORY_ICONS[flow.category] || HelpCircle;
                return (
                  <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border ${CATEGORY_COLORS[flow.category] || CATEGORY_COLORS.other}`}>
                    <CatIcon className="w-2.5 h-2.5" />
                    <span>{CATEGORY_LABELS[flow.category] || 'Otro'}</span>
                  </div>
                );
              })()}
              <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border ${flow.status === 'active' ? 'bg-accent-50 text-accent-600 border-accent-100 dark:bg-accent-500/10 dark:text-accent-400 dark:border-accent-500/20' : 'bg-slate-50 text-slate-400 border-slate-100 dark:bg-slate-800/40 dark:text-slate-500 dark:border-slate-700'}`}>
                {flow.status === 'active' ? 'Activo' : 'Borrador'}
              </span>
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'triggers',
      header: 'Triggers',
      render: (_: any, flow: FlowBot) => (
        <div className="flex items-center gap-1.5">
          <Key className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
            {flow.triggers?.length || 0} {flow.triggers?.length === 1 ? 'disparador' : 'disparadores'}
          </span>
        </div>
      )
    },
    {
      key: 'config',
      header: 'Configuración',
      render: (_: any, flow: FlowBot) => {
        const hasAi = flow.nodes?.some(n => n.type === 'llm' || n.type === 'knowledge_retrieval');
        const hasHandoff = flow.nodes?.some(n => n.type === 'handoff' || (n.type === 'llm' && n.data?.autoHandoff));

        return (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border ${flow.matchingStrategy === 'flexible' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-accent-50 text-accent-600 border-accent-100'}`}>
                {flow.matchingStrategy === 'flexible' ? 'Inteligente' : 'Estricto'}
              </span>
              <span className="text-[10px] font-bold text-slate-400">{flow.nodes?.length || 0} Nodos</span>
            </div>

            <div className="flex items-center gap-1.5">
              {hasAi && (
                <div className="flex items-center justify-center p-1 bg-violet-50 dark:bg-violet-500/10 text-violet-500 dark:text-violet-400 rounded-lg border border-violet-100/50 dark:border-violet-500/20" title="Usa Inteligencia Artificial">
                  <Sparkles className="w-3 h-3" />
                </div>
              )}
              {hasHandoff && (
                <div className="flex items-center justify-center p-1 bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 rounded-lg border border-rose-100/50 dark:border-rose-500/20" title="Soporta Escalado Humano">
                  <UserCheck className="w-3 h-3" />
                </div>
              )}
            </div>
          </div>
        );
      }
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      render: (_: any, flow: FlowBot) => (
        <div onClick={(e) => e.stopPropagation()}>
          <KebabMenu actions={[
            { label: 'Abrir constructor', icon: <Edit className="w-3.5 h-3.5" />, onClick: () => openFlowBuilder(flow) },
            { label: 'Duplicar', icon: <Copy className="w-3.5 h-3.5" />, onClick: () => duplicateFlow(flow) },
            { label: 'Eliminar', icon: <Trash2 className="w-3.5 h-3.5" />, onClick: () => setDeleteTarget(flow), variant: 'danger' },
          ]} />
        </div>
      )
    }
  ];

  const renderEditor = () => {
    if (!editingFlow) return null;
    return createPortal(
      <div className="fixed inset-0 z-[100000] bg-white dark:bg-[#252525] flex flex-col pt-0">
        <ReactFlowProvider>
          <FlowBuilderContent flowData={editingFlow} onBack={closeFlowBuilder} />
        </ReactFlowProvider>
      </div>,
      document.body
    );
  };

  if (loading) return <PageLoader sectionName="Gestor de Flujos" />;

  const totalFlows = flows.length;
  const activeFlows = flows.filter(f => f.status === 'active').length;
  const inactiveFlows = flows.filter(f => f.status !== 'active').length;
  return (
    <PageContainer>
      {renderEditor()}
      <PageHeader
        title="Constructor de"
        highlight="Bots AI"
        description="Configura el comportamiento y las respuestas automatizadas de tu bot."
        icon={Bot}
        meta={[
          { label: 'Flujos', value: totalFlows, icon: LayoutGrid, color: 'accent' },
          { label: 'Activos', value: activeFlows, icon: Activity, color: 'emerald' },
          { label: 'Inactivos', value: inactiveFlows, icon: Activity, color: 'amber' },
        ]}
        action={
          <div className="flex items-center gap-3">
            <CountBadge count={flows.length} />
            <HeaderButton onClick={() => setShowCreateForm(true)} icon={<Plus className="w-4 h-4" />}>
              Nuevo Flujo
            </HeaderButton>
          </div>
        }
      />

      <PageBody scrollable={true}>


        <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden p-6">
          <div className="flex items-center gap-3 mb-4">
            <SearchBar value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar flujos..." className="flex-1" />
            <Dropdown
              value={filterCategory}
              onChange={(v) => setFilterCategory(v)}
              options={[
                { value: 'all', label: 'Categorías (Todas)' },
                { value: 'sales', label: 'Ventas' },
                { value: 'support', label: 'Soporte' },
                { value: 'marketing', label: 'Marketing' },
              ]}
            />
            <ViewToggle value={viewMode} onChange={setViewMode} />
          </div>

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
              {paginatedFlows.map((flow) => (
                <div
                  key={flow.id}
                  onClick={() => {
                    setSelectedDetailFlow(flow);
                    setTempDescription(flow.description || '');
                    setIsEditingDescription(false);
                  }}
                  className="group/card relative cursor-pointer bg-white dark:bg-dark-card rounded-xl p-5 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 flex flex-col min-h-[200px]"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate" title={flow.name}>{flow.name}</h3>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                          {CATEGORY_LABELS[flow.category] || 'Otro'}
                        </span>
                      </div>
                    </div>
                    <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${flow.status === 'active' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {flow.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                    {flow.description || 'Sin descripción.'}
                  </p>

                  <div className="flex items-center gap-4 text-[11px] text-slate-400 dark:text-slate-500 mb-4">
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="w-3 h-3" />
                      {flow.metrics?.conversations || 0} usos
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Key className="w-3 h-3" />
                      {flow.triggers?.length || 0} triggers
                    </span>
                    {flow.nodes?.some(n => n.type === 'llm' || n.type === 'knowledge_retrieval') && (
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        IA
                      </span>
                    )}
                    {flow.nodes?.some(n => n.type === 'handoff' || (n.type === 'llm' && n.data?.autoHandoff)) && (
                      <span className="flex items-center gap-1">
                        <UserCheck className="w-3 h-3" />
                        Handoff
                      </span>
                    )}
                  </div>

                  <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[10px] text-slate-300 dark:text-slate-600 font-medium group-hover/card:opacity-0 transition-opacity">
                      {new Date(flow.updated_at || flow.created_at || flow.lastModified || '').toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                    </span>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200">
                      <button
                        onClick={() => openFlowBuilder(flow)}
                        className="px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-[11px] font-semibold hover:opacity-90 transition-all"
                        title="Abrir Constructor de Flujos"
                      >
                        <Edit className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => duplicateFlow(flow)}
                        className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                        title="Duplicar"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(flow)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={paginatedFlows}
              pagination={{
                currentPage,
                totalPages,
                onPageChange: setCurrentPage
              }}
            />
          )}
        </div>

        <Modal
          open={showCreateForm}
          onClose={() => setShowCreateForm(false)}
          title="Crear Nuevo Flujo"
          size="xl"
          icon={<div className="w-10 h-10 bg-gradient-to-br from-accent-500 to-accent-600 rounded-xl flex items-center justify-center shadow-lg"><Bot className="w-5 h-5 text-black" /></div>}
          footer={
            <div className="flex gap-3">
              <button onClick={() => setShowCreateForm(false)}
                className="flex-1 h-11 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                Cancelar
              </button>
              <button onClick={createFlow}
                className="flex-1 h-11 bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-black rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md">
                Crear Bot
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><LayoutGrid className="w-3 h-3" /> Empezar desde una plantilla <span className="font-medium text-slate-300 normal-case">(opcional)</span></label>
              <div className="grid grid-cols-2 gap-2">
                {flowTemplates.map((tpl) => {
                  const Icon = tpl.icon || Bot;
                  const isSelected = selectedTemplate?.id === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className={`relative text-left p-3 rounded-xl border transition-all ${isSelected
                        ? 'border-accent-500 bg-accent-500/5 ring-2 ring-accent-500/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 hover:border-accent-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent-500" />
                      )}
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${tpl.accent} text-white flex items-center justify-center mb-2`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <p className="text-[12px] font-bold text-slate-800 dark:text-white leading-tight mb-0.5">{tpl.name}</p>
                      <p className="text-[10px] text-slate-400 leading-snug line-clamp-2">{tpl.description}</p>
                    </button>
                  );
                })}
              </div>
              {selectedTemplate && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-accent-600 dark:text-accent-400 font-semibold">
                    ✓ Se cargarán {selectedTemplate.nodes.length} nodos y {selectedTemplate.edges.length} conexiones
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTemplate(null);
                      setNewFlowData((prev) => ({ ...prev, triggers: [] }));
                    }}
                    className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Quitar plantilla
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Bot className="w-3 h-3" /> Nombre del Flujo</label>
              <div className="relative">
                <Bot className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" value={newFlowData.name} onChange={e => setNewFlowData({ ...newFlowData, name: e.target.value })}
                  className="w-full h-10 pl-10 pr-3.5 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition-all placeholder:text-slate-400"
                  placeholder="Ej: Soporte VIP" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Tag className="w-3 h-3" /> Categoría</label>
              <Dropdown
                value={newFlowData.category}
                onChange={v => setNewFlowData({ ...newFlowData, category: v as any })}
                options={[
                  { value: 'sales', label: 'Ventas' },
                  { value: 'support', label: 'Soporte' },
                  { value: 'marketing', label: 'Marketing' },
                  { value: 'other', label: 'Otro' },
                ]}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Key className="w-3 h-3" /> Palabras Clave (Triggers)</label>
              <div className="relative">
                <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" value={newFlowData.triggers.join(', ')}
                  onChange={e => setNewFlowData({ ...newFlowData, triggers: e.target.value.split(',').map(t => t.trim()).filter(t => t !== '') })}
                  className="w-full h-10 pl-10 pr-3.5 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition-all placeholder:text-slate-400"
                  placeholder="Ej: hola, precio, info (separadas por coma)" />
              </div>
            </div>
          </div>
        </Modal>

        {/* Modal de Detalles y Estadísticas de Flujo */}
        <Modal
          open={!!selectedDetailFlow}
          onClose={() => setSelectedDetailFlow(null)}
          title={selectedDetailFlow?.name || 'Detalles del Flujo'}
          size="lg"
          icon={<Bot className="w-5 h-5 text-slate-500" />}
          footer={
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setSelectedDetailFlow(null)}
                className="flex-1 h-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-[13px] font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                Cerrar
              </button>
              {selectedDetailFlow && (
                <button
                  onClick={() => {
                    const flow = selectedDetailFlow;
                    setSelectedDetailFlow(null);
                    openFlowBuilder(flow);
                  }}
                  className="flex-1 h-10 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[13px] font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Abrir Constructor</span>
                </button>
              )}
            </div>
          }
        >
          {selectedDetailFlow && (
            <div className="space-y-5">
              {/* Header: status + category inline */}
              <div className="flex items-center gap-3 text-[12px]">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium ${selectedDetailFlow.status === 'active' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedDetailFlow.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  {selectedDetailFlow.status === 'active' ? 'Activo' : 'Borrador'}
                </span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span className="text-slate-500 dark:text-slate-400">{CATEGORY_LABELS[selectedDetailFlow.category] || 'Sin categoría'}</span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span className="text-slate-400 dark:text-slate-500">{new Date(selectedDetailFlow.updated_at || selectedDetailFlow.created_at || selectedDetailFlow.lastModified || '').toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>

              {/* Descripción editable */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">Descripción</span>
                  {!isEditingDescription && (
                    <button
                      onClick={() => setIsEditingDescription(true)}
                      className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium flex items-center gap-1"
                    >
                      <Edit className="w-3 h-3" /> Editar
                    </button>
                  )}
                </div>
                {isEditingDescription ? (
                  <div className="space-y-2">
                    <textarea
                      value={tempDescription}
                      onChange={(e) => setTempDescription(e.target.value)}
                      className="w-full min-h-[72px] p-3 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 transition-all text-slate-800 dark:text-slate-100 leading-relaxed"
                      placeholder="Describe el propósito de este bot..."
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setIsEditingDescription(false)}
                        className="px-3 py-1.5 text-[12px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await flowService.updateFlow(selectedDetailFlow.id, { description: tempDescription });
                            setSelectedDetailFlow({ ...selectedDetailFlow, description: tempDescription });
                            setIsEditingDescription(false);
                            addNotification({ type: 'success', title: 'Flujo actualizado', message: 'La descripción se guardó correctamente.' });
                            refreshFlows();
                          } catch (err) {
                            addNotification({ type: 'error', title: 'Error', message: 'No se pudo actualizar la descripción.' });
                          }
                        }}
                        className="px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[12px] font-semibold rounded-lg hover:opacity-90 transition-all"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {selectedDetailFlow.description || 'Sin descripción.'}
                  </p>
                )}
              </div>

              {/* Métricas en línea */}
              <div className="flex items-center gap-6 py-3 border-y border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Usos</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{selectedDetailFlow.metrics?.conversations || 0}</p>
                </div>
                <div className="w-px h-8 bg-slate-100 dark:bg-slate-800" />
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Éxito</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{selectedDetailFlow.metrics?.completionRate || 0}%</p>
                </div>
                <div className="w-px h-8 bg-slate-100 dark:bg-slate-800" />
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Nodos</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{selectedDetailFlow.nodes?.length || 0}</p>
                </div>
                {selectedDetailFlow.nodes?.some(n => n.type === 'llm' || n.type === 'knowledge_retrieval') && (
                  <>
                    <div className="w-px h-8 bg-slate-100 dark:bg-slate-800" />
                    <div className="flex items-center gap-1.5 text-[12px] text-violet-500">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="font-medium">IA</span>
                    </div>
                  </>
                )}
              </div>

              {/* Handoff */}
              {(() => {
                const hasHandoff = selectedDetailFlow.nodes?.some(n => n.type === 'handoff' || (n.type === 'llm' && n.data?.autoHandoff));
                const handoffNode = selectedDetailFlow.nodes?.find(n => n.type === 'handoff' || (n.type === 'llm' && n.data?.autoHandoff));
                const threshold = handoffNode?.data?.handoffThreshold || 80;
                if (!hasHandoff) return null;
                return (
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                    <div className="flex items-center gap-2.5">
                      <UserCheck className="w-4 h-4 text-slate-500" />
                      <div>
                        <p className="text-[12px] font-medium text-slate-700 dark:text-slate-300">Escalado a humano</p>
                        <p className="text-[11px] text-slate-400">Umbral de confianza: {threshold}%</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                      Auto-handoff
                    </span>
                  </div>
                );
              })()}

              {/* Triggers */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mb-2 block">Triggers</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedDetailFlow.triggers && selectedDetailFlow.triggers.length > 0 ? (
                    selectedDetailFlow.triggers.map((keyword, index) => (
                      <span key={index} className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-[12px] font-medium text-slate-600 dark:text-slate-400 rounded-lg">
                        <Key className="w-3 h-3 text-slate-400" />
                        {keyword}
                      </span>
                    ))
                  ) : (
                    <span className="text-[12px] text-slate-400">Sin triggers configurados</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </Modal>
      </PageBody>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteFlow}
        title="Eliminar flujo"
        message={`¿Eliminar "${deleteTarget?.name || ''}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleting}
      />
    </PageContainer>
  );
};


