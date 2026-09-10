import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, Play, Pause, Trash2, Eye, Plus, Megaphone, RefreshCw, AlertTriangle } from 'lucide-react';
import { Loader } from '../../../components/ui/Loader';
import { HeaderButton } from '../../../components/ui/HeaderButton';
import { CountBadge } from '../../../components/ui/CountBadge';
import { KebabMenu } from '../../../components/ui/KebabMenu';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { PageContainer } from '../../../components/layout/PageContainer';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageBody } from '../../../components/layout/PageBody';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Modal } from '../../../components/ui/Modal';
import { SearchBar } from '../../../components/ui/SearchBar';
import { Dropdown } from '../../../components/ui/Dropdown';
import { ViewToggle, ViewMode } from '../../../components/ui/ViewToggle';
import { useNotifications } from '../../../contexts/NotificationContext';
import { CreateCampaignModal } from '../components/CreateCampaignModal';
import {
  getCampaigns, getCampaign, sendCampaign, pauseCampaign, resumeCampaign, deleteCampaign,
} from '../../../services/api';

interface Campaign {
  id: string;
  name: string;
  message_template: string;
  whatsapp_connection_id: string | null;
  status: string;
  delay_ms: number;
  total: number;
  sent: number;
  failed: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

interface CampaignDetail extends Campaign {
  contacts: Array<{
    id: string;
    phone: string;
    variables: Record<string, string>;
    status: string;
    error_message: string | null;
    sent_at: string | null;
  }>;
  count: number;
}

const campaignStatusMeta: Record<string, { variant: string; label: string }> = {
  draft: { variant: 'default', label: 'Borrador' },
  ready: { variant: 'primary', label: 'Lista' },
  sending: { variant: 'info', label: 'Enviando' },
  paused: { variant: 'warning', label: 'Pausada' },
  completed: { variant: 'success', label: 'Completada' },
  cancelled: { variant: 'danger', label: 'Cancelada' },
};

export const Campaigns = () => {
  const { addNotification } = useNotifications();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasActiveSend = useCallback((list: Campaign[]) => {
    return list.some((c) => c.status === 'sending' || c.status === 'paused');
  }, []);

  const loadCampaigns = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const rows = await getCampaigns();
      const list = Array.isArray(rows) ? rows : [];
      setCampaigns(list);

      // Reanudar/detener polling según haya envíos activos
      const active = hasActiveSend(list);
      if (active && !pollRef.current) {
        pollRef.current = setInterval(() => loadCampaigns(true), 3000);
      } else if (!active && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setLoading(false);
    }
  }, [hasActiveSend]);

  useEffect(() => {
    loadCampaigns();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadCampaigns]);

  const openDetail = async (campaign: Campaign) => {
    setDetailLoading(true);
    try {
      const row = await getCampaign(campaign.id);
      setDetail(row);
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo cargar el detalle de la campaña.' });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSend = async (campaign: Campaign) => {
    try {
      await sendCampaign(campaign.id);
      addNotification({ type: 'success', title: 'Enviando', message: `Campaña "${campaign.name}" iniciada.` });
      await loadCampaigns(true);
      if (detail?.id === campaign.id) openDetail(campaign);
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Error', message: err?.response?.data?.error || 'No se pudo iniciar el envío.' });
    }
  };

  const handlePause = async (campaign: Campaign) => {
    try {
      await pauseCampaign(campaign.id);
      addNotification({ type: 'warning', title: 'Envío pausado', message: `La campaña "${campaign.name}" fue pausada.` });
      await loadCampaigns(true);
      if (detail?.id === campaign.id) openDetail(campaign);
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Error', message: err?.response?.data?.error || 'No se pudo pausar el envío.' });
    }
  };

  const handleResume = async (campaign: Campaign) => {
    try {
      await resumeCampaign(campaign.id);
      addNotification({ type: 'success', title: 'Enviando', message: `La campaña "${campaign.name}" se reanudó.` });
      await loadCampaigns(true);
      if (detail?.id === campaign.id) openDetail(campaign);
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Error', message: err?.response?.data?.error || 'No se pudo reanudar el envío.' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCampaign(deleteTarget.id);
      setCampaigns((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      if (detail?.id === deleteTarget.id) setDetail(null);
      setDeleteTarget(null);
      addNotification({ type: 'success', title: 'Campaña eliminada', message: `Se eliminó "${deleteTarget.name}".` });
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo eliminar la campaña.' });
    } finally {
      setDeleting(false);
    }
  };

  const statusVariant = (status: string) => (campaignStatusMeta[status]?.variant as any) || 'default';

  const canSend = (c: Campaign) => c.status !== 'sending' && c.total > 0;

  const columns = [
    { key: 'name', header: 'Campaña', render: (v: string, row: Campaign) => (
      <div className="min-w-0">
        <p className="font-bold text-slate-900 dark:text-white truncate">{v}</p>
        <p className="text-[10px] text-slate-400">{new Date(row.created_at).toLocaleString()}</p>
      </div>
    )},
    { key: 'status', header: 'Estado', render: (v: string) => <StatusBadge status={v} variant={statusVariant(v)} /> },
    { key: 'progress', header: 'Progreso', render: (_v: unknown, row: Campaign) => {
      const pct = row.total > 0 ? Math.min(100, Math.round(((row.sent + row.failed) / row.total) * 100)) : 0;
      return (
        <div className="w-40">
          <div className="flex justify-between text-[10px] font-bold mb-1">
            <span className="text-slate-500 dark:text-slate-400">{row.sent + row.failed}/{row.total}</span>
            <span className="text-accent-500">{pct}%</span>
          </div>
          <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${row.failed > 0 && row.sent === 0 ? 'bg-red-500' : 'bg-gradient-to-r from-accent-500 to-accent-600'}`} style={{ width: `${pct}%` }} />
          </div>
          {row.failed > 0 && <p className="text-[9px] text-red-400 mt-0.5">{row.failed} fallaron</p>}
        </div>
      );
    }},
    { key: 'actions', header: '', className: 'w-12', render: (_v: unknown, row: Campaign) => {
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
      actions.push({ label: 'Eliminar', icon: <Trash2 className="w-3.5 h-3.5" />, onClick: () => setDeleteTarget(row), variant: 'danger' });
      return <KebabMenu actions={actions} />;
    }},
  ];

  const detailProgress = detail && detail.total > 0
    ? Math.min(100, Math.round(((detail.sent + detail.failed) / detail.total) * 100))
    : 0;

  return (
    <PageContainer>
      <PageHeader
        title="Campañas de Mensajes"
        description="Sube un Excel con contactos y envía mensajes personalizados por WhatsApp automáticamente"
        icon={Megaphone}
        meta={[
          { label: 'Campañas', value: campaigns.length, icon: Megaphone, color: 'accent' },
          { label: 'Activas', value: campaigns.filter((c) => c.status === 'sending' || c.status === 'paused').length, icon: Send, color: 'emerald' },
        ]}
        action={
          <div className="flex items-center gap-3">
            <CountBadge count={campaigns.length} />
            <HeaderButton onClick={() => setShowCreate(true)} icon={<Plus className="w-4 h-4" />}>
              Nueva Campaña
            </HeaderButton>
          </div>
        }
      />
      <PageBody>
        <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden p-6">
          {/* ── Barra de filtros unificada ── */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <SearchBar
              placeholder="Buscar campaña por nombre..."
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
                  { value: 'ready', label: 'Lista' },
                  { value: 'sending', label: 'Enviando' },
                  { value: 'paused', label: 'Pausada' },
                  { value: 'completed', label: 'Completada' },
                  { value: 'cancelled', label: 'Cancelada' },
                ]}
              />
              <ViewToggle value={viewMode} onChange={setViewMode} />
            </div>
          </div>

          {(() => {
            const filtered = campaigns.filter(c => {
              const matchesSearch = !searchTerm || c.name.toLowerCase().includes(searchTerm.toLowerCase());
              const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
              return matchesSearch && matchesStatus;
            });

            if (filtered.length === 0 && !loading) {
              return (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="p-4 bg-accent-500/10 rounded-2xl mb-4">
                    <Megaphone className="w-10 h-10 text-accent-500" />
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">
                    {searchTerm || filterStatus !== 'all' ? 'Sin resultados' : 'Aún no tienes campañas'}
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mb-5">
                    {searchTerm || filterStatus !== 'all'
                      ? 'Ajusta los filtros para ver resultados.'
                      : 'Carga un Excel con los teléfonos de tus clientes y envía mensajes personalizados automáticamente.'}
                  </p>
                  {!searchTerm && filterStatus === 'all' && (
                    <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-5 h-10 bg-gradient-to-r from-accent-500 to-accent-600 text-black text-sm font-black rounded-xl hover:opacity-90 transition-all">
                      <Plus className="w-4 h-4" /> Crear mi primera campaña
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
                  emptyMessage="No hay campañas disponibles"
                />
              );
            }

            // Grid view
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((campaign) => {
                  const pct = campaign.total > 0 ? Math.min(100, Math.round(((campaign.sent + campaign.failed) / campaign.total) * 100)) : 0;
                  return (
                    <div
                      key={campaign.id}
                      onClick={() => openDetail(campaign)}
                      className="group bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-4 hover:border-accent-500/40 hover:shadow-lg hover:shadow-accent-500/5 transition-all cursor-pointer"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-accent-500/10 flex items-center justify-center">
                            <Megaphone className="w-5 h-5 text-accent-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight truncate max-w-[150px]">{campaign.name}</p>
                            <p className="text-[10px] text-slate-400">{new Date(campaign.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <StatusBadge status={campaign.status} variant={statusVariant(campaign.status)} />
                      </div>

                      {/* Progress */}
                      <div className="mb-3">
                        <div className="flex justify-between text-[10px] font-bold mb-1">
                          <span className="text-slate-500">{campaign.sent + campaign.failed}/{campaign.total} envíos</span>
                          <span className="text-accent-500">{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              campaign.failed > 0 && campaign.sent === 0 ? 'bg-red-500' : 'bg-gradient-to-r from-accent-500 to-accent-600'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {campaign.failed > 0 && <p className="text-[9px] text-red-400 mt-0.5">{campaign.failed} fallaron</p>}
                      </div>

                      {/* Actions row */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/50">
                        <div className="flex items-center gap-1">
                          {campaign.status === 'sending' ? (
                            <button onClick={(e) => { e.stopPropagation(); handlePause(campaign); }} className="flex items-center gap-1 px-2 h-7 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg text-[10px] font-bold hover:bg-amber-500/20 transition-colors">
                              <Pause className="w-3 h-3" /> Pausar
                            </button>
                          ) : campaign.status === 'paused' ? (
                            <button onClick={(e) => { e.stopPropagation(); handleResume(campaign); }} className="flex items-center gap-1 px-2 h-7 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-bold hover:bg-emerald-500/20 transition-colors">
                              <Play className="w-3 h-3" /> Reanudar
                            </button>
                          ) : (
                            <button onClick={(e) => { e.stopPropagation(); handleSend(campaign); }} disabled={!canSend(campaign)} className="flex items-center gap-1 px-2 h-7 bg-accent-500/10 text-accent-600 dark:text-accent-400 rounded-lg text-[10px] font-bold hover:bg-accent-500/20 transition-colors disabled:opacity-40">
                              <Send className="w-3 h-3" /> Enviar
                            </button>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(campaign); }}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
            Usa los mensajes con moderación y dentro del horario permitido por WhatsApp. Envíos masivos sin consentimiento pueden ocasionar el bloqueo de tu número.
          </span>
        </div>
      </PageBody>

      <CreateCampaignModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => loadCampaigns()}
      />

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        size="full"
        title={detail?.name || 'Detalle de campaña'}
        icon={<Megaphone className="w-5 h-5 text-accent-500" />}
        footer={
          detail && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                {detail.status === 'sending' ? (
                  <button onClick={() => handlePause(detail)} className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold bg-amber-500 text-black hover:bg-amber-600 transition-all">
                    <Pause className="w-4 h-4" /> Pausar
                  </button>
                ) : detail.status === 'paused' ? (
                  <button onClick={() => handleResume(detail)} className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold bg-emerald-500 text-black hover:bg-emerald-600 transition-all">
                    <Play className="w-4 h-4" /> Reanudar
                  </button>
                ) : (
                  <button onClick={() => handleSend(detail)} disabled={!canSend(detail)} className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold bg-accent-500 text-black hover:bg-accent-600 transition-all disabled:opacity-40">
                    <Send className="w-4 h-4" /> Enviar
                  </button>
                )}
                <button onClick={() => setDeleteTarget(detail)} className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold text-red-500 hover:bg-red-500/10 transition-all">
                  <Trash2 className="w-4 h-4" /> Eliminar
                </button>
              </div>
              <button onClick={() => loadCampaigns(true)} className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all">
                <RefreshCw className="w-4 h-4" /> Actualizar
              </button>
            </div>
          )
        }
      >
        {detailLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader size="md" />
          </div>
        ) : detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-4">
              <StatusBadge status={detail.status} variant={statusVariant(detail.status)} />
              <div className="flex-1 min-w-[200px]">
                <div className="flex justify-between text-[10px] font-bold mb-1">
                  <span className="text-slate-500 dark:text-slate-400">Enviados {detail.sent} · Fallidos {detail.failed} · Pendientes {detail.total - detail.sent - detail.failed}</span>
                  <span className="text-accent-500">{detailProgress}%</span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-accent-500 to-accent-600 rounded-full transition-all" style={{ width: `${detailProgress}%` }} />
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Inicio: {detail.started_at ? new Date(detail.started_at).toLocaleString() : '—'}
                <br />
                Fin: {detail.finished_at ? new Date(detail.finished_at).toLocaleString() : '—'}
              </p>
            </div>

            <div className="px-4 py-3 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-slate-700">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mensaje</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono">{detail.message_template}</p>
            </div>

            <div>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Contactos ({detail.count})
              </p>
              <div className="max-h-[320px] overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-700 rounded-xl">
                <table className="w-full">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900">
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2">Teléfono</th>
                      <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2">Estado</th>
                      <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2 hidden md:table-cell">Variables</th>
                      <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2 hidden lg:table-cell">Enviado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.contacts.map((c) => (
                      <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800/50">
                        <td className="px-3 py-2 text-sm font-mono text-slate-700 dark:text-slate-300">{c.phone}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={c.status} variant={c.status === 'sent' ? 'success' : c.status === 'failed' ? 'danger' : 'warning'} />
                        </td>
                        <td className="px-3 py-2 hidden md:table-cell">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {Object.entries(c.variables).slice(0, 4).map(([k, v]) => (
                              <span key={k} className="px-1.5 py-0.5 text-[9px] font-mono bg-accent-500/10 text-accent-600 dark:text-accent-400 rounded">{k}: {String(v).slice(0, 14)}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-400 hidden lg:table-cell">{c.sent_at ? new Date(c.sent_at).toLocaleTimeString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {detail.contacts.length === 0 && (
                  <div className="flex items-center justify-center py-8 text-sm text-slate-400">Sin contactos</div>
                )}
              </div>
              {detail.count > detail.contacts.length && (
                <p className="text-[10px] text-slate-400 mt-1">Mostrando los primeros {detail.contacts.length} contactos.</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar campaña"
        message={`¿Eliminar "${deleteTarget?.name || ''}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleting}
      />
    </PageContainer>
  );
};
