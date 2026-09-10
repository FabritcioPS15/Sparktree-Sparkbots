import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Send, Play, Pause, Trash2, Eye, Plus, Bell, RefreshCw, AlertTriangle, Clock, RotateCcw, Calendar, Download, CheckCircle, X, Users, LayoutGrid, MessageSquare, Search, MoreVertical } from 'lucide-react';
import { PageContainer } from '../../../components/layout/PageContainer';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageBody } from '../../../components/layout/PageBody';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Loader } from '../../../components/ui/Loader';
import { AnimatedButton } from '../../../components/ui/AnimatedButton';
import { KebabMenu } from '../../../components/ui/KebabMenu';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { SearchBar } from '../../../components/ui/SearchBar';
import { Dropdown } from '../../../components/ui/Dropdown';
import { ViewToggle, ViewMode } from '../../../components/ui/ViewToggle';
import { useNotifications } from '../../../contexts/NotificationContext';
import { CreateReminderModal } from '../components/CreateReminderModal';
import {
  getReminders, getReminder, sendReminder, pauseReminder, resumeReminder, deleteReminder, cancelReminder,
} from '../../../services/api';

interface Reminder {
  id: string;
  name: string;
  message_template: string;
  whatsapp_connection_id: string | null;
  status: string;
  schedule_type: string;
  scheduled_at: string | null;
  recurring_cron: string | null;
  delay_ms: number;
  total: number;
  sent: number;
  failed: number;
  last_sent_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

interface ReminderDetail extends Reminder {
  contacts: Array<{
    id: string;
    phone: string;
    variables: Record<string, string>;
    status: string;
    error_message: string | null;
    sent_at: string | null;
  }>;
  count: number;
  logs: Array<{
    id: string;
    total_sent: number;
    total_failed: number;
    started_at: string;
    finished_at: string | null;
  }>;
}

const reminderStatusMeta: Record<string, { variant: string; label: string }> = {
  draft: { variant: 'default', label: 'Borrador' },
  scheduled: { variant: 'primary', label: 'Programado' },
  sending: { variant: 'info', label: 'Enviando' },
  paused: { variant: 'warning', label: 'Pausado' },
  completed: { variant: 'success', label: 'Completado' },
  cancelled: { variant: 'danger', label: 'Cancelado' },
  failed: { variant: 'danger', label: 'Fallido' },
};

const scheduleTypeMeta: Record<string, { label: string; icon: any }> = {
  now: { label: 'Inmediato', icon: Send },
  once: { label: 'Una vez', icon: Calendar },
  recurring: { label: 'Recurrente', icon: RotateCcw },
};

export const Reminders = () => {
  const { addNotification } = useNotifications();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<ReminderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Reminder | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [detailTab, setDetailTab] = useState('resumen');
  const [contactFilter, setContactFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSchedule, setFilterSchedule] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const filteredContacts = useMemo(() => {
    if (!detail) return [];
    if (!contactFilter.trim()) return detail.contacts;
    return detail.contacts.filter(c => c.phone.includes(contactFilter.trim()));
  }, [detail, contactFilter]);

  const hasActiveSend = useCallback((list: Reminder[]) => {
    return list.some((r) => r.status === 'sending' || r.status === 'paused');
  }, []);

  const loadReminders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const rows = await getReminders();
      const list = Array.isArray(rows) ? rows : [];
      setReminders(list);

      const active = hasActiveSend(list);
      if (active && !pollRef.current) {
        pollRef.current = setInterval(() => loadReminders(true), 3000);
      } else if (!active && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch (err) {
      console.error('Failed to load reminders:', err);
    } finally {
      setLoading(false);
    }
  }, [hasActiveSend]);

  useEffect(() => {
    loadReminders();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadReminders]);

  const openDetail = async (reminder: Reminder) => {
    setDetail({ ...reminder, contacts: [], count: 0, logs: [] });
    setDetailLoading(true);
    try {
      const row = await getReminder(reminder.id);
      setDetail(row);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSend = async (reminder: Reminder) => {
    try {
      await sendReminder(reminder.id);
      addNotification({ type: 'success', title: 'Enviando', message: `Recordatorio "${reminder.name}" iniciado.` });
      await loadReminders(true);
      if (detail?.id === reminder.id) openDetail(reminder);
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Error', message: err?.response?.data?.error || 'No se pudo iniciar el envío.' });
    }
  };

  const handlePause = async (reminder: Reminder) => {
    try {
      await pauseReminder(reminder.id);
      addNotification({ type: 'warning', title: 'Envío pausado', message: `El recordatorio "${reminder.name}" fue pausado.` });
      await loadReminders(true);
      if (detail?.id === reminder.id) openDetail(reminder);
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Error', message: err?.response?.data?.error || 'No se pudo pausar el envío.' });
    }
  };

  const handleResume = async (reminder: Reminder) => {
    try {
      await resumeReminder(reminder.id);
      addNotification({ type: 'success', title: 'Enviando', message: `El recordatorio "${reminder.name}" se reanudó.` });
      await loadReminders(true);
      if (detail?.id === reminder.id) openDetail(reminder);
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Error', message: err?.response?.data?.error || 'No se pudo reanudar el envío.' });
    }
  };

  const handleCancel = async (reminder: Reminder) => {
    try {
      await cancelReminder(reminder.id);
      addNotification({ type: 'success', title: 'Cancelado', message: `Se canceló "${reminder.name}".` });
      await loadReminders(true);
      if (detail?.id === reminder.id) openDetail(reminder);
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo cancelar el recordatorio.' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteReminder(deleteTarget.id);
      setReminders((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      if (detail?.id === deleteTarget.id) setDetail(null);
      addNotification({ type: 'success', title: 'Recordatorio eliminado', message: `Se eliminó "${deleteTarget.name}".` });
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo eliminar el recordatorio.' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleExportPdf = (reminder: ReminderDetail) => {
    const statusInfo = reminderStatusMeta[reminder.status] || { label: reminder.status };
    const scheduleInfo = scheduleTypeMeta[reminder.schedule_type] || { label: reminder.schedule_type };
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo abrir la ventana de impresión. Revisa los permisos del navegador.' });
      return;
    }
    const rows = reminder.contacts.map((c) => `
      <tr>
        <td>${c.phone}</td>
        <td>${statusInfo.label}</td>
        <td>${c.sent_at ? new Date(c.sent_at).toLocaleString() : '—'}</td>
        <td>${c.error_message || '—'}</td>
      </tr>`).join('');
    printWindow.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Recordatorio – ${reminder.name}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #1e293b; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .sub { color: #64748b; font-size: 13px; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
    .card label { font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 700; }
    .card p { margin: 4px 0 0; font-size: 14px; font-weight: 600; }
    .msg { background: #f1f5f9; border-left: 4px solid #6366f1; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px; font-size: 14px; white-space: pre-wrap; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; background: #f1f5f9; padding: 8px 10px; font-size: 11px; color: #475569; }
    td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
    tr:last-child td { border-bottom: none; }
    .footer { margin-top: 32px; font-size: 11px; color: #94a3b8; text-align: right; }
  </style>
</head>
<body>
  <h1>${reminder.name}</h1>
  <p class="sub">Exportado el ${new Date().toLocaleString()}</p>
  <div class="grid">
    <div class="card"><label>Estado</label><p>${statusInfo.label}</p></div>
    <div class="card"><label>Tipo de envío</label><p>${scheduleInfo.label}</p></div>
    <div class="card"><label>Total contactos</label><p>${reminder.total}</p></div>
    <div class="card"><label>Enviados / Fallidos</label><p>${reminder.sent} / ${reminder.failed}</p></div>
    <div class="card"><label>Creado</label><p>${new Date(reminder.created_at).toLocaleString()}</p></div>
    <div class="card"><label>Último envío</label><p>${reminder.last_sent_at ? new Date(reminder.last_sent_at).toLocaleString() : '—'}</p></div>
  </div>
  <p style="font-size:12px;font-weight:700;color:#475569;margin-bottom:6px;">MENSAJE</p>
  <div class="msg">${reminder.message_template}</div>
  <p style="font-size:12px;font-weight:700;color:#475569;margin-bottom:8px;">CONTACTOS (${reminder.contacts.length})</p>
  <table>
    <thead><tr><th>Teléfono</th><th>Estado</th><th>Enviado</th><th>Error</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">Sin contactos</td></tr>'}</tbody>
  </table>
  <div class="footer">Generado por Sparktree &bull; ${reminder.id}</div>
  <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); };<\/script>
</body>
</html>`);
    printWindow.document.close();
  };

  const statusVariant = (status: string) => (reminderStatusMeta[status]?.variant as any) || 'default';
  const canSend = (r: Reminder) => r.status !== 'sending' && r.total > 0;

  const columns = [
    {
      key: 'name', header: 'Recordatorio', render: (v: string, row: Reminder) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent-500/10 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-accent-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate leading-tight">{v}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-slate-400">{new Date(row.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <StatusBadge status={row.status} variant={statusVariant(row.status)} />
                {row.schedule_type && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-accent-500/10 text-accent-600 dark:text-accent-400">
                    {scheduleTypeMeta[row.schedule_type]?.label || row.schedule_type}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'progress', header: 'Progreso', render: (_v: unknown, row: Reminder) => {
        const pct = row.total > 0 ? Math.min(100, Math.round(((row.sent + row.failed) / row.total) * 100)) : 0;
        const isSending = row.status === 'sending';
        const allFailed = row.failed > 0 && row.sent === 0;
        return (
          <div className="w-40">
            <div className="flex justify-between text-[10px] font-bold mb-1">
              <span className="text-slate-500 dark:text-slate-400">{row.sent + row.failed}/{row.total}</span>
              <span className={`${isSending ? 'text-accent-400' : allFailed ? 'text-red-400' : 'text-emerald-500'} transition-colors duration-300`}>{pct}%</span>
            </div>
            <div className={`h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden ${isSending ? 'progress-bar-glow' : ''}`}>
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${isSending ? 'progress-bar-active' : ''} ${allFailed ? 'bg-gradient-to-r from-red-500 to-red-400' :
                  pct === 100 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                    'bg-gradient-to-r from-accent-500 via-accent-400 to-accent-600'
                  }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {row.failed > 0 && <p className="text-[9px] text-red-400 mt-0.5">{row.failed} fallaron</p>}
          </div>
        );
      }
    },
    {
      key: 'actions', header: '', className: 'w-12', render: (_v: unknown, row: Reminder) => {
        const actions: Array<{ label: string; icon: React.ReactNode; onClick: (e: React.MouseEvent) => void; variant?: 'default' | 'danger'; disabled?: boolean }> = [
          { label: 'Ver detalle', icon: <Eye className="w-3.5 h-3.5" />, onClick: () => openDetail(row) },
        ];
        if (row.status === 'sending') {
          actions.push({ label: 'Pausar', icon: <Pause className="w-3.5 h-3.5" />, onClick: () => handlePause(row) });
        } else if (row.status === 'paused') {
          actions.push({ label: 'Reanudar', icon: <Play className="w-3.5 h-3.5" />, onClick: () => handleResume(row) });
        } else {
          actions.push({ label: 'Enviar', icon: <Send className="w-3.5 h-3.5" />, onClick: () => handleSend(row), disabled: !canSend(row) });
        }
        if (row.status !== 'cancelled' && row.status !== 'completed') {
          actions.push({ label: 'Cancelar', icon: <Clock className="w-3.5 h-3.5" />, onClick: () => handleCancel(row) });
        }
        if (row.status !== 'sending' && row.status !== 'paused') {
          actions.push({ label: 'Eliminar', icon: <Trash2 className="w-3.5 h-3.5" />, onClick: () => setDeleteTarget(row), variant: 'danger' });
        }
        return <KebabMenu actions={actions} />;
      }
    },
  ];

  const detailProgress = detail && detail.total > 0
    ? Math.min(100, Math.round(((detail.sent + detail.failed) / detail.total) * 100))
    : 0;

  return (
    <PageContainer>
      <PageHeader
        title="Recordatorios"
        description="Envía mensajes automatizados programados a tus contactos"
        icon={Bell}
        meta={[
          { label: 'Recordatorios', value: reminders.length, icon: Bell, color: 'accent' },
          { label: 'Enviados', value: reminders.reduce((acc, r) => acc + r.sent, 0), icon: CheckCircle, color: 'emerald' },
          { label: 'Activos', value: reminders.filter((r) => r.status === 'sending' || r.status === 'paused').length, icon: Send, color: 'blue' },
          { label: 'Programados', value: reminders.filter((r) => r.status === 'scheduled').length, icon: Clock, color: 'amber' },
        ]}
        action={
          <AnimatedButton variant="accent" onClick={() => setShowCreate(true)} className="!px-4 !h-10 !text-sm !font-bold">
            <Plus className="w-4 h-4" /> Nuevo Recordatorio
          </AnimatedButton>
        }
      />
      <PageBody>
        <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden p-6">
          {/* ── Barra de filtros unificada ── */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <SearchBar
              placeholder="Buscar recordatorio por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="flex items-center gap-2 shrink-0">
              <Dropdown
                value={filterStatus}
                onChange={setFilterStatus}
                options={[
                  { value: 'all', label: 'Todos los Estados' },
                  { value: 'draft', label: 'Borrador' },
                  { value: 'scheduled', label: 'Programado' },
                  { value: 'sending', label: 'Enviando' },
                  { value: 'paused', label: 'Pausado' },
                  { value: 'completed', label: 'Completado' },
                  { value: 'cancelled', label: 'Cancelado' },
                ]}
              />
              <Dropdown
                value={filterSchedule}
                onChange={setFilterSchedule}
                options={[
                  { value: 'all', label: 'Todos los Tipos' },
                  { value: 'now', label: 'Inmediato' },
                  { value: 'once', label: 'Una vez' },
                  { value: 'recurring', label: 'Recurrente' },
                ]}
              />
              <ViewToggle value={viewMode} onChange={setViewMode} />
            </div>
          </div>

          {(() => {
            const filtered = reminders.filter(r => {
              const matchesSearch = !searchTerm || r.name.toLowerCase().includes(searchTerm.toLowerCase());
              const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
              const matchesSchedule = filterSchedule === 'all' || r.schedule_type === filterSchedule;
              return matchesSearch && matchesStatus && matchesSchedule;
            });

            if (filtered.length === 0 && !loading) {
              return (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="p-4 bg-accent-500/10 rounded-2xl mb-4">
                    <Bell className="w-10 h-10 text-accent-500" />
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">
                    {searchTerm || filterStatus !== 'all' || filterSchedule !== 'all' ? 'Sin resultados' : 'Aún no tienes recordatorios'}
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mb-5">
                    {searchTerm || filterStatus !== 'all' || filterSchedule !== 'all'
                      ? 'Ajusta los filtros para ver resultados.'
                      : 'Crea recordatorios para enviar mensajes automatizados a tus contactos programadamente o de forma inmediata.'}
                  </p>
                  {!searchTerm && filterStatus === 'all' && filterSchedule === 'all' && (
                    <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-5 h-10 bg-gradient-to-r from-accent-500 to-accent-600 text-black text-sm font-black rounded-xl hover:opacity-90 transition-all">
                      <Plus className="w-4 h-4" /> Crear mi primer recordatorio
                    </button>
                  )}
                </div>
              );
            }

            if (viewMode === 'table') {
              return (
                <DataTable
                  data={filtered}
                  columns={columns}
                  loading={loading}
                  onRowClick={openDetail}
                  emptyMessage="No hay recordatorios disponibles"
                />
              );
            }

            // Grid view
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((reminder) => {
                  const pct = reminder.total > 0 ? Math.min(100, Math.round(((reminder.sent + reminder.failed) / reminder.total) * 100)) : 0;
                  const ScheduleIcon = scheduleTypeMeta[reminder.schedule_type]?.icon || Bell;
                  return (
                    <div
                      key={reminder.id}
                      onClick={() => openDetail(reminder)}
                      className="group bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-4 hover:border-accent-500/40 hover:shadow-lg hover:shadow-accent-500/5 transition-all cursor-pointer"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-accent-500/10 flex items-center justify-center shrink-0">
                            <Bell className="w-5 h-5 text-accent-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight truncate max-w-[150px]">{reminder.name}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <ScheduleIcon className="w-3 h-3 text-slate-400" />
                              <span className="text-[10px] text-slate-400">{scheduleTypeMeta[reminder.schedule_type]?.label || reminder.schedule_type}</span>
                            </div>
                          </div>
                        </div>
                        <StatusBadge status={reminder.status} variant={statusVariant(reminder.status)} />
                      </div>

                      {/* Progress */}
                      <div className="mb-3">
                        <div className="flex justify-between text-[10px] font-bold mb-1">
                          <span className="text-slate-500">{reminder.sent + reminder.failed}/{reminder.total} envíos</span>
                          <span className="text-accent-500">{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              reminder.failed > 0 && reminder.sent === 0 ? 'bg-red-500' : 'bg-gradient-to-r from-accent-500 to-accent-600'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {reminder.failed > 0 && <p className="text-[9px] text-red-400 mt-0.5">{reminder.failed} fallaron</p>}
                      </div>

                      {/* Actions row */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/50">
                        <div className="flex items-center gap-1">
                          {reminder.status === 'sending' ? (
                            <button onClick={(e) => { e.stopPropagation(); handlePause(reminder); }} className="flex items-center gap-1 px-2 h-7 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg text-[10px] font-bold hover:bg-amber-500/20 transition-colors">
                              <Pause className="w-3 h-3" /> Pausar
                            </button>
                          ) : reminder.status === 'paused' ? (
                            <button onClick={(e) => { e.stopPropagation(); handleResume(reminder); }} className="flex items-center gap-1 px-2 h-7 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-bold hover:bg-emerald-500/20 transition-colors">
                              <Play className="w-3 h-3" /> Reanudar
                            </button>
                          ) : (
                            <button onClick={(e) => { e.stopPropagation(); handleSend(reminder); }} disabled={!canSend(reminder)} className="flex items-center gap-1 px-2 h-7 bg-accent-500/10 text-accent-600 dark:text-accent-400 rounded-lg text-[10px] font-bold hover:bg-accent-500/20 transition-colors disabled:opacity-40">
                              <Send className="w-3 h-3" /> Enviar
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">{new Date(reminder.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        <div className="mt-4 px-4 py-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Los recordatorios recurrentes se reinician automáticamente después de cada envío. Usa los mensajes con moderación y dentro del horario permitido por WhatsApp.
          </span>
        </div>
      </PageBody>

      <CreateReminderModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => loadReminders()}
      />

      {/* ===== DETAIL POPUP ===== */}
      {!!detail && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-popup-title"
        >
          <div className="absolute inset-0 bg-black/60" onClick={() => setDetail(null)} />
          <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh] overflow-hidden">

            {/* ── HEADER ── */}
            <div className="relative shrink-0 px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
              {/* gradiente lateral decorativo */}
              <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-accent-500 via-accent-400 to-accent-600 rounded-l-2xl" />
              <div className="pl-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-500/10 flex items-center justify-center shrink-0 border border-accent-500/20">
                    <Send className="w-4.5 h-4.5 text-accent-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 id="detail-popup-title" className="text-base font-black text-slate-900 dark:text-white truncate">
                        {detail.name}
                      </h2>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        detail.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                        detail.status === 'sending' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' :
                        detail.status === 'paused' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                        detail.status === 'failed' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' :
                        'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          detail.status === 'completed' ? 'bg-emerald-500' :
                          detail.status === 'sending' ? 'bg-blue-500 animate-pulse' :
                          detail.status === 'paused' ? 'bg-amber-500' :
                          detail.status === 'failed' ? 'bg-red-500' : 'bg-slate-400'
                        }`} />
                        {reminderStatusMeta[detail.status]?.label || detail.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {detail.sent} de {detail.total} contactos · {detailProgress}% completado
                    </p>
                  </div>
                  <button
                    onClick={() => setDetail(null)}
                    aria-label="Cerrar"
                    className="shrink-0 w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 flex items-center justify-center transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* barra de progreso compacta */}
                <div className="mt-3">
                  <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        detailProgress === 100 && detail.failed === 0 ? 'bg-emerald-400' :
                        detail.failed > 0 && detail.sent === 0 ? 'bg-red-400' : 'bg-accent-400'
                      }`}
                      style={{ width: `${detailProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── TABS ── */}
            <div className="shrink-0 flex items-center gap-1 px-6 pt-2 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900">
              {[
                { id: 'resumen', label: 'Resumen', icon: LayoutGrid },
                { id: 'contactos', label: `Contactos (${detail.total})`, icon: Users },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = detailTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setDetailTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold border-b-2 -mb-px transition-colors ${
                      active
                        ? 'border-accent-500 text-accent-600 dark:text-accent-400'
                        : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {tab.label}
                  </button>
                );
              })}
            </div>

            {/* ── BODY ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {detailLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader size="md" />
                </div>
              ) : detailTab === 'resumen' ? (
                <div className="p-5 space-y-4">
                  {/* STATS INLINE */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      { label: 'Enviados', value: detail.sent, tone: 'emerald', pct: detail.total ? Math.round((detail.sent / detail.total) * 100) : 0 },
                      { label: 'Pendientes', value: Math.max(detail.total - detail.sent - detail.failed, 0), tone: 'amber', pct: detail.total ? Math.round((Math.max(detail.total - detail.sent - detail.failed, 0) / detail.total) * 100) : 0 },
                      { label: 'Fallidos', value: detail.failed, tone: 'red', pct: detail.total ? Math.round((detail.failed / detail.total) * 100) : 0 },
                    ].map((stat) => (
                      <span key={stat.label} className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-${stat.tone}-500/10 text-${stat.tone}-600 dark:text-${stat.tone}-400 rounded-full text-xs font-bold border border-${stat.tone}-500/20`}>
                        <span className={`w-1.5 h-1.5 rounded-full bg-${stat.tone}-500`} />
                        {stat.value} {stat.label} · {stat.pct}%
                      </span>
                    ))}
                  </div>

                  {/* separador rayado */}
                  <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />

                  {/* MENSAJE */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <MessageSquare className="w-3.5 h-3.5 text-accent-500" />
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Mensaje enviado</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-slate-800 rounded-xl p-4">
                      <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {detail.message_template.replace(/\{\{\s*[\w-]+\s*\}\}/g, '').replace(/\u200B/g, '').trim() || detail.message_template}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  {/* buscador */}
                  <div className="shrink-0 px-6 py-3 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        value={contactFilter}
                        onChange={(e) => setContactFilter(e.target.value)}
                        placeholder="Buscar por número..."
                        className="w-full h-9 pl-8 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500/30"
                      />
                    </div>
                  </div>

                  {/* tabla */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-6 py-2 sticky top-0 bg-slate-50 dark:bg-slate-800/80 backdrop-blur border-b border-slate-100 dark:border-slate-700 z-10">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Contacto</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Estado</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Hora</span>
                    </div>
                    {filteredContacts.length === 0 ? (
                      <div className="py-12 text-center text-sm text-slate-400">
                        {detail.contacts.length === 0 ? 'Sin contactos' : 'Ningún contacto coincide con la búsqueda'}
                      </div>
                    ) : (
                      filteredContacts.map((c) => (
                        <div
                          key={c.id}
                          className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-6 py-3 border-b border-slate-50 dark:border-slate-700/50 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                            <span className="text-sm font-mono text-slate-700 dark:text-slate-300 truncate">{c.phone}</span>
                          </div>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold justify-self-start ${
                            c.status === 'sent' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' :
                            c.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' :
                            'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              c.status === 'sent' ? 'bg-emerald-500' : c.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'
                            }`} />
                            {c.status === 'sent' ? 'ENVIADO' : c.status === 'failed' ? 'FALLIDO' : c.status.toUpperCase()}
                          </span>
                          <p className="text-xs text-slate-400 text-right tabular-nums whitespace-nowrap">
                            {c.sent_at ? new Date(c.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── FOOTER ── */}
            {detail && !detailLoading && (
              <div className="shrink-0 px-6 py-3 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {detail.status === 'sending' ? (
                    <button onClick={() => handlePause(detail)} className="flex items-center gap-1.5 px-4 h-9 rounded-xl text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 transition-all shadow-sm">
                      <Pause className="w-3.5 h-3.5" /> Pausar
                    </button>
                  ) : detail.status === 'paused' ? (
                    <button onClick={() => handleResume(detail)} className="flex items-center gap-1.5 px-4 h-9 rounded-xl text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-sm">
                      <Play className="w-3.5 h-3.5" /> Reanudar
                    </button>
                  ) : (
                    <button onClick={() => handleSend(detail)} disabled={!canSend(detail)} className="flex items-center gap-1.5 px-4 h-9 rounded-xl text-xs font-bold bg-accent-500 text-black hover:bg-accent-600 transition-all shadow-sm disabled:opacity-40">
                      <Send className="w-3.5 h-3.5" /> Enviar
                    </button>
                  )}
                  <button onClick={() => { loadReminders(true); if (detail) openDetail(detail); }} className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* dropdown acciones */}
                <div className="relative">
                  <button onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-white/5 transition-all">
                    <MoreVertical className="w-3.5 h-3.5" /> Más
                  </button>
                  {showMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                      <div className="absolute right-0 bottom-full mb-1 z-20 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
                        <button onClick={() => { handleExportPdf(detail); setShowMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                          <Download className="w-3.5 h-3.5" /> Exportar PDF
                        </button>
                        <div className="h-px bg-slate-100 dark:bg-slate-700" />
                        <button onClick={() => { setDeleteTarget(detail); setShowMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" /> Eliminar campaña
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar recordatorio"
        message={`¿Eliminar "${deleteTarget?.name || ''}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleting}
      />
    </PageContainer>
  );
};
