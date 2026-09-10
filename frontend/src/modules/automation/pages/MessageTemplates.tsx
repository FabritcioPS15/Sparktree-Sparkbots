import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, MessageSquare, FileText, BarChart3, Copy } from 'lucide-react';
import { Loader } from '../../../components/ui/Loader';
import { HeaderButton } from '../../../components/ui/HeaderButton';
import { CountBadge } from '../../../components/ui/CountBadge';
import { KebabMenu } from '../../../components/ui/KebabMenu';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageContainer } from '../../../components/layout/PageContainer';
import { PageBody } from '../../../components/layout/PageBody';
import { DataTable } from '../../../components/ui/DataTable';
import { Modal } from '../../../components/ui/Modal';
import { useNotifications } from '../../../contexts/NotificationContext';
import { SearchBar } from '../../../components/ui/SearchBar';
import { Dropdown } from '../../../components/ui/Dropdown';
import { ViewToggle, ViewMode } from '../../../components/ui/ViewToggle';
import {
  getMessageTemplates, getMessageTemplateStats, createMessageTemplate, updateMessageTemplate, deleteMessageTemplate,
} from '../../../services/api';

interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
  variables: string[];
  usage_count: number;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TemplateStats {
  totalTemplates: number;
  totalUsage: number;
  byCategory: Record<string, number>;
  mostUsed: Array<{ id: string; category: string; usage_count: number }>;
}

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'ventas', label: 'Ventas' },
  { value: 'soporte', label: 'Soporte' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'recordatorio', label: 'Recordatorio' },
  { value: 'cobranza', label: 'Cobranza' },
  { value: 'otro', label: 'Otro' },
];

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
  ventas: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  soporte: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  marketing: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  recordatorio: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  cobranza: 'bg-red-500/10 text-red-600 dark:text-red-400',
  otro: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
};

export const MessageTemplates = () => {
  const { addNotification } = useNotifications();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [stats, setStats] = useState<TemplateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState<MessageTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MessageTemplate | null>(null);
  const [formData, setFormData] = useState({ name: '', category: 'general', content: '' });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [tpls, st] = await Promise.all([
        getMessageTemplates(filterCategory !== 'all' ? filterCategory : undefined),
        getMessageTemplateStats(),
      ]);
      setTemplates(Array.isArray(tpls) ? tpls : []);
      setStats(st);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  }, [filterCategory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setFormData({ name: '', category: 'general', content: '' });
    setEditTemplate(null);
    setShowCreateModal(true);
  };

  const openEdit = (tpl: MessageTemplate) => {
    setFormData({ name: tpl.name, category: tpl.category, content: tpl.content });
    setEditTemplate(tpl);
    setShowCreateModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      addNotification({ type: 'error', title: 'Falta el nombre', message: 'Ingresa un nombre para la plantilla.' });
      return;
    }
    if (!formData.content.trim()) {
      addNotification({ type: 'error', title: 'Falta el contenido', message: 'Escribe el contenido del mensaje.' });
      return;
    }
    setSaving(true);
    try {
      if (editTemplate) {
        await updateMessageTemplate(editTemplate.id, formData);
        addNotification({ type: 'success', title: 'Plantilla actualizada', message: `Se actualizó "${formData.name}".` });
      } else {
        await createMessageTemplate(formData);
        addNotification({ type: 'success', title: 'Plantilla creada', message: `Se creó "${formData.name}".` });
      }
      setShowCreateModal(false);
      await loadData(true);
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Error', message: err?.response?.data?.error || 'No se pudo guardar la plantilla.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMessageTemplate(deleteTarget.id);
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
      addNotification({ type: 'success', title: 'Eliminada', message: `Se eliminó la plantilla "${deleteTarget.name}".` });
      await loadData(true);
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo eliminar la plantilla.' });
    }
  };

  const filtered = templates.filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    {
      key: 'name', header: 'Plantilla', render: (v: string, row: MessageTemplate) => (
        <div className="min-w-0">
          <p className="font-bold text-slate-900 dark:text-white truncate">{v}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{row.content.substring(0, 60)}...</p>
        </div>
      ),
    },
    {
      key: 'category', header: 'Categoría', render: (v: string) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${CATEGORY_COLORS[v] || CATEGORY_COLORS.general}`}>
          {v}
        </span>
      ),
    },
    {
      key: 'variables', header: 'Variables', render: (v: string[]) => (
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {v.slice(0, 3).map((varName) => (
            <span key={varName} className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold bg-gradient-to-br from-accent-500/10 to-accent-500/5 text-accent-600 dark:text-accent-400 rounded-full border border-accent-500/15">
              <span className="w-1 h-1 bg-accent-500 rounded-full" />
              {varName.replace(/_/g, ' ')}
            </span>
          ))}
          {v.length > 3 && <span className="text-[9px] text-slate-400">+{v.length - 3}</span>}
        </div>
      ),
    },
    {
      key: 'usage_count', header: 'Usos', className: 'text-center', render: (v: number) => (
        <span className={`text-sm font-black ${v > 0 ? 'text-accent-500' : 'text-slate-300 dark:text-slate-600'}`}>
          {v || 0}
        </span>
      ),
    },
    {
      key: 'actions', header: '', className: 'w-12', render: (_v: unknown, row: MessageTemplate) => (
        <KebabMenu actions={[
          { label: 'Copiar contenido', icon: <Copy className="w-3.5 h-3.5" />, onClick: () => { navigator.clipboard.writeText(row.content); addNotification({ type: 'success', title: 'Copiado', message: 'Plantilla copiada al portapapeles.' }); } },
          { label: 'Editar', icon: <Edit className="w-3.5 h-3.5" />, onClick: () => openEdit(row) },
          { label: 'Eliminar', icon: <Trash2 className="w-3.5 h-3.5" />, onClick: () => setDeleteTarget(row), variant: 'danger' },
        ]} />
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Plantillas de Mensajes"
        description="Crea y reutiliza mensajes para campañas, recordatorios de revisión vehicular, cobranzas y más"
        icon={MessageSquare}
        meta={[
          { label: 'Plantillas', value: stats?.totalTemplates || 0, icon: FileText, color: 'accent' },
          { label: 'Usos totales', value: stats?.totalUsage || 0, icon: BarChart3, color: 'emerald' },
        ]}
        action={
          <div className="flex items-center gap-3">
            <CountBadge count={templates.length} />
            <HeaderButton onClick={() => setShowCreateModal(true)} icon={<Plus className="w-4 h-4" />}>
              Nueva Plantilla
            </HeaderButton>
          </div>
        }
      />
      <PageBody>
        <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden p-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <SearchBar value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); }} placeholder="Buscar plantillas..." />
            <div className="flex items-center gap-2 shrink-0">
              <Dropdown
                value={filterCategory}
                onChange={(v) => { setFilterCategory(v); }}
                options={[
                  { value: 'all', label: 'Todas las Categorías' },
                  { value: 'transactional', label: 'Transaccional' },
                  { value: 'marketing', label: 'Marketing' },
                  { value: 'notification', label: 'Notificación' },
                  { value: 'greeting', label: 'Saludo' },
                  { value: 'followup', label: 'Seguimiento' },
                  { value: 'reminder', label: 'Recordatorio' },
                  { value: 'other', label: 'Otro' },
                ]}
              />
              <ViewToggle value={viewMode} onChange={setViewMode} />
            </div>
          </div>

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((t) => (
                <div key={t.id} className="group bg-slate-50 dark:bg-black/30 rounded-2xl p-5 border border-slate-100 dark:border-slate-800/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2.5 bg-accent-500/10 rounded-xl text-accent-500"><FileText className="w-5 h-5" /></div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${CATEGORY_COLORS[t.category] || CATEGORY_COLORS.general}`}>{t.category}</span>
                  </div>
                  <h3 className="font-black text-slate-900 dark:text-white text-sm mb-1">{t.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">{t.content}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-accent-500">{t.usage_count || 0} usos</span>
                      <span className="text-[10px] text-slate-400">{new Date(t.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-1">
                      <KebabMenu actions={[
                        { label: 'Editar', icon: <Edit className="w-3.5 h-3.5" />, onClick: () => openEdit(t) },
                        { label: 'Copiar', icon: <Copy className="w-3.5 h-3.5" />, onClick: () => { navigator.clipboard.writeText(t.content); addNotification({ type: 'success', title: 'Copiado', message: 'Plantilla copiada al portapapeles.' }); } },
                        { label: 'Eliminar', icon: <Trash2 className="w-3.5 h-3.5" />, onClick: () => setDeleteTarget(t), variant: 'danger' },
                      ]} />
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && !loading && (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                  <div className="p-4 bg-accent-500/10 rounded-2xl mb-4">
                    <MessageSquare className="w-10 h-10 text-accent-500" />
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">No hay plantillas</h3>
                  <p className="text-xs text-slate-400 max-w-sm mb-5">Crea tu primera plantilla para reutilizar mensajes en campañas y recordatorios.</p>
                  <button onClick={openCreate} className="flex items-center gap-2 px-5 h-10 bg-gradient-to-r from-accent-500 to-accent-600 text-black text-sm font-black rounded-xl hover:opacity-90 transition-all">
                    <Plus className="w-4 h-4" /> Crear plantilla
                  </button>
                </div>
              )}
            </div>
          ) : (
            <DataTable
              data={filtered}
              columns={columns}
              loading={loading}
              emptyMessage="No hay plantillas disponibles"
            />
          )}
        </div>

        {stats && stats.mostUsed.length > 0 && (
          <div className="mt-4 px-4 py-3 bg-accent-500/5 border border-accent-500/20 rounded-xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Más usadas</p>
            <div className="flex flex-wrap gap-2">
              {stats.mostUsed.map((t) => (
                <span key={t.id} className="px-2 py-1 text-[10px] font-bold rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                  {templates.find((tpl) => tpl.id === t.id)?.name || t.id} <span className="text-accent-500">({t.usage_count})</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </PageBody>

      {/* Modal Crear/Editar */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={editTemplate ? 'Editar Plantilla' : 'Nueva Plantilla'}
        icon={<MessageSquare className="w-5 h-5 text-accent-500" />}
        footer={
          <div className="flex items-center justify-between">
            <button onClick={() => setShowCreateModal(false)} disabled={saving} className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 h-10 rounded-xl text-sm font-bold bg-accent-500 text-black hover:bg-accent-600 transition-all disabled:opacity-40">
              {saving ? <Loader size="xs" /> : null}
              {editTemplate ? 'Guardar cambios' : 'Crear plantilla'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nombre</label>
            <input
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Ej. Bienvenida, Confirmación de pedido..."
              className="w-full mt-1.5 px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all text-sm font-bold text-slate-900 dark:text-white placeholder-slate-400/60"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Categoría</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
              className="w-full mt-1.5 px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all text-sm font-bold text-slate-900 dark:text-white"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Contenido del mensaje</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
              rows={6}
              placeholder="Escribe tu mensaje aquí... Puedes usar variables como nombre, placa, etc."
              className="w-full mt-1.5 px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all text-sm text-slate-900 dark:text-white placeholder-slate-400/60 font-mono leading-relaxed resize-none"
            />
            <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-accent-500/5 border border-accent-500/10 rounded-lg">
              <span className="text-accent-500 text-[11px] font-bold">Tip:</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Usa <code className="px-1 py-0.5 bg-accent-500/10 text-accent-600 dark:text-accent-400 rounded font-mono text-[10px]">{'{{nombre}}'}</code> para personalizar el mensaje con datos del contacto</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal Confirmar Eliminación */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar plantilla"
        message={`¿Eliminar "${deleteTarget?.name || ''}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
      />
    </PageContainer>
  );
};
