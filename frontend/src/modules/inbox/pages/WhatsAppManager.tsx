import { useState, useEffect } from 'react';
import {
  Smartphone,
  Plus,
  Trash2,
  QrCode,
  CheckCircle,
  AlertCircle,
  Clock,
  MessageSquare,
  Settings,
  Link as LinkIcon,
  Cloud,
  Globe,
  Copy,
  Key,
  Zap,
  ExternalLink,
  Check,
  X
} from 'lucide-react';
import api from '../../../services/api';
import { getMarketingMessagesEligibility } from '../../../services/api';
import { PageLoader } from '../../../components/layout/PageLoader';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageBody } from '../../../components/layout/PageBody';
import { PageContainer } from '../../../components/layout/PageContainer';
import { Dropdown } from '../../../components/ui/Dropdown';
import { Modal } from '../../../components/ui/Modal';
import { HeaderButton } from '../../../components/ui/HeaderButton';
import { CountBadge } from '../../../components/ui/CountBadge';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useNotifications } from '../../../contexts/NotificationContext';

interface WhatsAppConnection {
  id: string;
  display_name: string;
  phone_number?: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  qr_code?: string;
  last_connected_at?: string;
  created_at: string;
}

interface Flow {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'draft';
}

interface CloudConnection {
  id: string;
  display_name: string;
  status: 'connected' | 'disconnected' | 'error';
  platform_account_id?: string; // phone_number_id
  config?: {
    phoneNumberId?: string;
    webhookVerifyToken?: string;
    waba_id?: string;
  };
  created_at: string;
}

const MAX_CONNECTIONS = 5;

export const WhatsAppManager = () => {
  const { addNotification } = useNotifications();
  const [activeTab, setActiveTab] = useState<'baileys' | 'cloud'>('baileys');
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const atLimit = connections.length >= MAX_CONNECTIONS;
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<WhatsAppConnection | null>(null);
  const [newConnectionName, setNewConnectionName] = useState('');
  const [qrModal, setQrModal] = useState<{ connection: WhatsAppConnection; qr: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState({ to: '', message: '' });
  const [error, setError] = useState<string | null>(null);

  // Cloud API state
  const [cloudConnections, setCloudConnections] = useState<CloudConnection[]>([]);
  const [cloudForm, setCloudForm] = useState({
    displayName: '',
    phoneNumberId: '',
    accessToken: '',
    webhookVerifyToken: '',
    phoneNumber: '',
    wabaId: '',
  });
  const [savingCloud, setSavingCloud] = useState(false);
  const [cloudSuccess, setCloudSuccess] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [eligibility, setEligibility] = useState<Record<string, any>>({});
  const [editingWabaId, setEditingWabaId] = useState<string | null>(null);
  const [wabaIdDraft, setWabaIdDraft] = useState('');

  const WEBHOOK_URL = `${window.location.protocol}//${window.location.hostname.replace('5173', '3001')}/api/webhook`;

  useEffect(() => {
    loadConnections();
    loadFlows();
    loadCloudConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const response = await api.get('/multi-whatsapp/connections');
      setConnections(response.data);
    } catch (err) {
      setError('Error loading connections');
    } finally {
      setLoading(false);
    }
  };

  const loadCloudConnections = async () => {
    try {
      const response = await api.get('/platform/connections');
      const filtered = (response.data || []).filter((c: any) => c.platform_type === 'whatsapp');
      setCloudConnections(filtered);

      // MM API for WhatsApp: obtener estado de elegibilidad de cada conexión (best-effort)
      filtered.forEach(async (c: any) => {
        try {
          const el = await getMarketingMessagesEligibility(c.id);
          setEligibility(prev => ({ ...prev, [c.id]: el }));
        } catch {
          // endpoint puede no estar disponible (no-WABA) — ignorar
        }
      });
    } catch {
      // tabla puede no existir aún
    }
  };

  const eligibilityBadge = (el: any) => {
    if (!el || el.status === 'UNKNOWN') {
      return { label: 'MM API: verificar', cls: 'bg-gray-500/10 text-gray-500 border-gray-500/20' };
    }
    if (el.eligible) {
      return { label: 'MM API listo', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
    }
    if (el.termsOfServiceSigned) {
      return { label: 'MM API: ToS firmado', cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' };
    }
    return { label: `MM API: ${el.status}`, cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
  };

  const saveCloudConnection = async () => {
    if (!cloudForm.displayName.trim() || !cloudForm.phoneNumberId.trim() || !cloudForm.accessToken.trim()) {
      setError('Nombre, Phone Number ID y Access Token son obligatorios');
      return;
    }
    setSavingCloud(true);
    setError(null);
    try {
      await api.post('/platform/whatsapp-cloud', {
        displayName: cloudForm.displayName.trim(),
        phoneNumberId: cloudForm.phoneNumberId.trim(),
        accessToken: cloudForm.accessToken.trim(),
        webhookVerifyToken: cloudForm.webhookVerifyToken.trim() || 'sparktree_webhook',
        phoneNumber: cloudForm.phoneNumber.trim() || null,
        wabaId: cloudForm.wabaId.trim() || undefined,
      });
      setCloudSuccess('Conexión Cloud API guardada exitosamente.');
      addNotification({ type: 'success', title: 'Cloud API Guardada', message: 'Configura el webhook en Meta Developers.' });
      setCloudForm({ displayName: '', phoneNumberId: '', accessToken: '', webhookVerifyToken: '', phoneNumber: '', wabaId: '' });
      loadCloudConnections();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Error al guardar';
      setError(msg);
    } finally {
      setSavingCloud(false);
    }
  };

  const deleteCloudConnection = async (id: string) => {
    try {
      await api.post(`/platform/connections/${id}/delete`);
      setCloudConnections(prev => prev.filter(c => c.id !== id));
      addNotification({ type: 'success', title: 'Conexión eliminada', message: 'La conexión Cloud API fue eliminada.' });
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(WEBHOOK_URL).then(() => {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    });
  };

  const saveWabaId = async (id: string) => {
    const trimmed = wabaIdDraft.trim();
    if (!trimmed) return;
    try {
      await api.patch(`/platform/connections/${id}/waba`, { wabaId: trimmed });
      setCloudConnections(prev => prev.map(c => c.id === id ? { ...c, config: { ...c.config, waba_id: trimmed } } : c));
      addNotification({ type: 'success', title: 'WABA ID guardado', message: 'Los templates de Meta usarán este WABA ID.' });
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Error al guardar WABA ID');
    } finally {
      setEditingWabaId(null);
      setWabaIdDraft('');
    }
  };

  const loadFlows = async () => {
    try {
      const response = await api.get('/flows');
      setFlows(response.data);
    } catch (err) {
      console.error('Error loading flows:', err);
    }
  };

  const createConnection = async () => {
    if (!newConnectionName.trim()) {
      setError('Connection name is required');
      return;
    }

    try {
      const response = await api.post('/multi-whatsapp/connections', {
        displayName: newConnectionName.trim()
      });

      const newConnection = response.data;
      setConnections(prev => [newConnection, ...prev]);
      setNewConnectionName('');
      setShowCreateForm(false);
      addNotification({ type: 'success', title: 'Conexión creada', message: `"${newConnection.display_name}" está lista para conectar.` });

      // Show QR for new connection
      setTimeout(() => showQRCode(newConnection), 1000);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const showQRCode = async (connection: WhatsAppConnection) => {
    try {
      const response = await api.get(`/multi-whatsapp/connections/${connection.id}/qr`);
      const data = response.data;
      if (data.qr) {
        setQrModal({ connection, qr: data.qr });
      } else {
        setError('QR code not available. Connection might already be active.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const deleteConnection = async (connectionId: string) => {
    try {
      await api.delete(`/multi-whatsapp/connections/${connectionId}`);
      const deleted = connections.find(c => c.id === connectionId);
      setConnections(prev => prev.filter(c => c.id !== connectionId));
      if (deleted) addNotification({ type: 'success', title: 'Conexión eliminada', message: `"${deleted.display_name}" ha sido desconectada.` });
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const assignFlow = async (connectionId: string, flowId: string) => {
    try {
      await api.post(`/multi-whatsapp/connections/${connectionId}/assign-flow`, { flowId });
      addNotification({ type: 'success', title: 'Flow asignado', message: 'Flow asignado exitosamente a la conexión.' });
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const sendTestMessage = async (connectionId: string) => {
    if (!testMessage.to.trim() || !testMessage.message.trim()) {
      setError('Phone number and message are required');
      return;
    }

    try {
      await api.post(`/multi-whatsapp/connections/${connectionId}/test-message`, testMessage);
      addNotification({ type: 'success', title: 'Mensaje enviado', message: 'Mensaje de prueba enviado correctamente.' });
      setTestMessage({ to: '', message: '' });
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-accent-500" />;
      case 'connecting':
        return <Clock className="w-5 h-5 text-amber-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Smartphone className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-accent-500/10 text-accent-600 dark:text-accent-400 border-accent-500/20';
      case 'connecting':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'error':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      default:
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
    }
  };

  if (loading) {
    return <PageLoader sectionName="Multi-WhatsApp" />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Gestión de"
        highlight="WhatsApp"
        description="Gestiona múltiples conexiones y asigna flujos a cada una."
        icon={Smartphone}
        action={
          <div className="flex items-center gap-3">
            <CountBadge count={connections.length} />
            <HeaderButton
              variant="secondary"
              onClick={() => setShowCreateForm(true)}
              disabled={atLimit}
              icon={<Plus className="w-4 h-4" />}
              title={atLimit ? `Máximo de ${MAX_CONNECTIONS} conexiones alcanzado` : undefined}
            >
              Nueva Conexión
            </HeaderButton>
          </div>
        }
      />

      {atLimit && (
        <div className="mx-3 md:mx-4 mb-1 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Máximo de {MAX_CONNECTIONS} alcanzado. Elimina una conexión y crea otra.
          </p>
        </div>
      )}

      <PageBody>
        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 px-4 py-3 rounded-xl mb-4 flex items-center justify-between">
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)} className="ml-4 text-red-500/50 hover:text-red-500 transition-colors">×</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-6 max-w-sm">
          <button
            onClick={() => setActiveTab('baileys')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${activeTab === 'baileys'
              ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
          >
            <QrCode className="w-4 h-4" />
            QR / Baileys
          </button>
          <button
            onClick={() => setActiveTab('cloud')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${activeTab === 'cloud'
              ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
          >
            <Cloud className="w-4 h-4" />
            Cloud API
          </button>
        </div>

        {/* ── BAILEYS TAB ── */}
        {activeTab === 'baileys' && (
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {connections.map((connection) => (
              <div key={connection.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(connection.status)}
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {connection.display_name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {connection.phone_number || 'Not connected'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(connection.status)}`}>
                        {connection.status}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex gap-2">
                      {connection.status !== 'connected' && (
                        <button
                          onClick={() => showQRCode(connection)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors text-sm"
                        >
                          <QrCode className="w-4 h-4" />
                          QR Code
                        </button>
                      )}

                      <button
                        onClick={() => setSelectedConnection(connection)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors text-sm"
                      >
                        <Settings className="w-4 h-4" />
                        Settings
                      </button>
                    </div>

                    <button
                      onClick={() => setDeleteTarget(connection.id)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── CLOUD API TAB ── */}
        {activeTab === 'cloud' && (
          <div className="max-w-3xl mx-auto space-y-6">

            {/* Existing Cloud Connections */}
            {cloudConnections.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Conexiones activas</h3>
                {cloudConnections.map(conn => (
                  <div key={conn.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${conn.status === 'connected' ? 'bg-accent-500' : 'bg-gray-400'
                        }`} />
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">{conn.display_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{conn.config?.phoneNumberId || '—'}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {editingWabaId === conn.id ? (
                            <>
                              <input
                                type="text"
                                value={wabaIdDraft}
                                onChange={e => setWabaIdDraft(e.target.value)}
                                placeholder="WABA ID"
                                className="px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white w-40 outline-none focus:border-accent-500"
                              />
                              <button
                                onClick={() => saveWabaId(conn.id)}
                                className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                title="Guardar WABA ID"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { setEditingWabaId(null); setWabaIdDraft(''); }}
                                className="p-1.5 text-gray-400 hover:bg-gray-500/10 rounded-lg transition-colors"
                                title="Cancelar"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => { setEditingWabaId(conn.id); setWabaIdDraft(conn.config?.waba_id || ''); }}
                              className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border transition-colors ${conn.config?.waba_id
                                ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
                                : 'text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10'
                                }`}
                              title="Editar WABA ID (necesario para plantillas de Meta)"
                            >
                              <Key className="w-3 h-3" />
                              {conn.config?.waba_id ? `WABA: ${conn.config.waba_id}` : 'Añadir WABA ID'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(eligibility as any)[conn.id] && (() => {
                        const b = eligibilityBadge((eligibility as any)[conn.id]);
                        return <span className={`px-2 py-1 text-xs font-medium rounded-full border ${b.cls}`}>{b.label}</span>;
                      })()}
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${conn.status === 'connected'
                        ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400 border-accent-500/20'
                        : 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20'
                        }`}>
                        {conn.status}
                      </span>
                      <button
                        onClick={() => deleteCloudConnection(conn.id)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Success message */}
            {cloudSuccess && (
              <div className="flex items-center gap-3 p-4 bg-accent-500/10 border border-accent-500/20 rounded-xl">
                <CheckCircle className="w-5 h-5 text-accent-500 shrink-0" />
                <p className="text-sm text-accent-700 dark:text-accent-300">{cloudSuccess}</p>
              </div>
            )}

            {/* Webhook URL Card */}
            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-blue-900 dark:text-blue-200">URL del Webhook</h3>
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
                Copia esta URL y pégala en{' '}
                <a
                  href="https://developers.facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold inline-flex items-center gap-1"
                >
                  Meta Developers <ExternalLink className="w-3 h-3" />
                </a>
                {' '}→ Tu App → WhatsApp → Configuración → Webhooks.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-2 text-blue-800 dark:text-blue-300 truncate">
                  {WEBHOOK_URL}
                </code>
                <button
                  onClick={copyWebhookUrl}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${copiedWebhook
                    ? 'bg-accent-500 text-black'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedWebhook ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* Cloud API Credentials Form */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-5">
                <Key className="w-5 h-5 text-accent-500" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Nueva Conexión Cloud API</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Nombre de la conexión</label>
                  <input
                    type="text"
                    placeholder="ej. Ventas Cloud, Soporte Cloud"
                    value={cloudForm.displayName}
                    onChange={e => setCloudForm(p => ({ ...p, displayName: e.target.value }))}
                    className="w-full px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all text-sm text-slate-900 dark:text-white placeholder-slate-400/60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Phone Number ID</label>
                  <input
                    type="text"
                    placeholder="Número ID de tu número de WhatsApp Business"
                    value={cloudForm.phoneNumberId}
                    onChange={e => setCloudForm(p => ({ ...p, phoneNumberId: e.target.value }))}
                    className="w-full px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all text-sm text-slate-900 dark:text-white placeholder-slate-400/60"
                  />
                  <p className="text-xs text-gray-400 mt-1">Encuéntralo en Meta Developers → WhatsApp → Configuración de API</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Número de Teléfono (opcional)</label>
                  <input
                    type="text"
                    placeholder="ej. +51 942 264 697"
                    value={cloudForm.phoneNumber}
                    onChange={e => setCloudForm(p => ({ ...p, phoneNumber: e.target.value }))}
                    className="w-full px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all text-sm text-slate-900 dark:text-white placeholder-slate-400/60"
                  />
                  <p className="text-xs text-gray-400 mt-1">El número real vinculado a esta conexión (se mostrará en las listas)</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">WABA ID (opcional)</label>
                  <input
                    type="text"
                    placeholder="ej. 100000000000000"
                    value={cloudForm.wabaId}
                    onChange={e => setCloudForm(p => ({ ...p, wabaId: e.target.value }))}
                    className="w-full px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all text-sm text-slate-900 dark:text-white placeholder-slate-400/60"
                  />
                  <p className="text-xs text-gray-400 mt-1">ID de la cuenta de WhatsApp Business. Obligatorio para cargar plantillas de Meta. Está en Meta Business Suite → Configuración → Cuenta de WhatsApp</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Access Token</label>
                  <input
                    type="password"
                    placeholder="EAA... (token de sistema o temporal)"
                    value={cloudForm.accessToken}
                    onChange={e => setCloudForm(p => ({ ...p, accessToken: e.target.value }))}
                    className="w-full px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all text-sm text-slate-900 dark:text-white placeholder-slate-400/60"
                  />
                  <p className="text-xs text-gray-400 mt-1">Requiere permiso <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">whatsapp_business_messaging</code></p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Webhook Verify Token</label>
                  <input
                    type="text"
                    placeholder="Token secreto para verificar el webhook (ej. mi_token_secreto)"
                    value={cloudForm.webhookVerifyToken}
                    onChange={e => setCloudForm(p => ({ ...p, webhookVerifyToken: e.target.value }))}
                    className="w-full px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all text-sm text-slate-900 dark:text-white placeholder-slate-400/60"
                  />
                  <p className="text-xs text-gray-400 mt-1">Este mismo token se pega en Meta Developers → Verificar webhook</p>
                </div>

                {/* Info banner */}
                <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    <span className="font-bold">Para iniciar conversaciones</span> solo puedes usar templates aprobados por Meta. Las respuestas a mensajes de usuarios son gratuitas en la ventana de 24 horas.
                  </p>
                </div>

                <button
                  onClick={saveCloudConnection}
                  disabled={savingCloud}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-bold rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingCloud ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  {savingCloud ? 'Guardando...' : 'Guardar Conexión Cloud API'}
                </button>
              </div>
            </div>

            {/* Steps guide */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-4 text-sm">Pasos para configurar Meta Cloud API</h4>
              <ol className="space-y-3">
                {[
                  { step: '1', text: 'Crea una app en developers.facebook.com → tipo Business', },
                  { step: '2', text: 'Activa WhatsApp Business Platform en tu app', },
                  { step: '3', text: 'Agrega un número de teléfono y verifica', },
                  { step: '4', text: 'Copia el Phone Number ID y Access Token de aquí arriba', },
                  { step: '5', text: 'Pega la URL del webhook y el Verify Token en la configuración de webhooks de Meta', },
                  { step: '6', text: 'Crea y somete templates para aprobación de Meta (pueden tardar horas)', },
                ].map(({ step, text }) => (
                  <li key={step} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center shrink-0">{step}</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">{text}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}


      </PageBody>

      {/* Create Connection Modal */}
      <Modal
        open={showCreateForm}
        onClose={() => { setShowCreateForm(false); setNewConnectionName(''); }}
        title="Nueva Conexión WhatsApp"
        icon={<Smartphone className="w-5 h-5 text-accent-500" />}
        size="sm"
      >
        <input
          type="text"
          placeholder="Nombre (ej. Sales Bot, Support Bot)"
          value={newConnectionName}
          onChange={(e) => setNewConnectionName(e.target.value)}
          className="w-full px-4 py-3.5 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all font-bold text-sm text-slate-900 dark:text-white placeholder-slate-400/60"
        />
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => { setShowCreateForm(false); setNewConnectionName(''); }}
            className="flex-1 py-3.5 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:text-slate-700 transition-colors rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            onClick={createConnection}
            className="flex-1 py-3.5 bg-gradient-to-r from-accent-500 to-accent-600 text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:from-accent-600 hover:to-accent-700 transition-all shadow-md"
          >
            Crear
          </button>
        </div>
      </Modal>

      {/* QR Code Modal */}
      <Modal
        open={qrModal !== null}
        onClose={() => setQrModal(null)}
        title="Escanear Código QR"
        icon={<QrCode className="w-5 h-5 text-accent-500" />}
        size="sm"
      >
        {qrModal && (
          <div className="bg-white dark:bg-slate-800/50 p-4 rounded-2xl mb-4">
            <img src={qrModal.qr} alt="QR Code" className="w-full" />
          </div>
        )}
        <button
          onClick={() => setQrModal(null)}
          className="w-full py-3 bg-gradient-to-r from-accent-500 to-accent-600 text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:from-accent-600 hover:to-accent-700 transition-all shadow-md"
        >
          Cerrar
        </button>
      </Modal>

      {/* Connection Settings Modal */}
      <Modal
        open={selectedConnection !== null}
        onClose={() => setSelectedConnection(null)}
        title={selectedConnection?.display_name ?? ''}
        icon={<Settings className="w-5 h-5 text-accent-500" />}
        size="lg"
      >
        {selectedConnection && (
          <div className="space-y-6">
            {/* Flow Assignment */}
            <div>
              <h3 className="font-semibold mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                <LinkIcon className="w-5 h-5" />
                Flow Asignado
              </h3>
              <Dropdown
                value=""
                onChange={(v) => { if (v) assignFlow(selectedConnection.id, v); }}
                placeholder="Selecciona un flow..."
                options={flows.map(flow => ({ value: flow.id, label: `${flow.name} (${flow.status})` }))}
              />
            </div>

            {/* Test Message */}
            <div>
              <h3 className="font-semibold mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Enviar Mensaje de Prueba
              </h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Número telefónico (con código de país)"
                  value={testMessage.to}
                  onChange={(e) => setTestMessage(prev => ({ ...prev, to: e.target.value }))}
                  className="w-full px-4 py-3.5 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all font-bold text-sm text-slate-900 dark:text-white placeholder-slate-400/60"
                />
                <textarea
                  placeholder="Mensaje de prueba"
                  value={testMessage.message}
                  onChange={(e) => setTestMessage(prev => ({ ...prev, message: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3.5 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all font-bold text-sm text-slate-900 dark:text-white placeholder-slate-400/60 resize-none"
                />
                <button
                  onClick={() => sendTestMessage(selectedConnection.id)}
                  disabled={selectedConnection.status !== 'connected'}
                  className="w-full py-3.5 bg-gradient-to-r from-accent-500 to-accent-600 text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:from-accent-600 hover:to-accent-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Enviar Mensaje de Prueba
                </button>
              </div>
            </div>

            {/* Connection Info */}
            <div>
              <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">Información de Conexión</h3>
              <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-4 space-y-2 border border-slate-100 dark:border-slate-700/30">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Estado:</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(selectedConnection.status)}`}>
                    {selectedConnection.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Teléfono:</span>
                  <span className="text-gray-900 dark:text-white">
                    {selectedConnection.phone_number || 'No conectado'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Creada:</span>
                  <span className="text-gray-900 dark:text-white">
                    {new Date(selectedConnection.created_at).toLocaleDateString()}
                  </span>
                </div>
                {selectedConnection.last_connected_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Última conexión:</span>
                    <span className="text-gray-900 dark:text-white">
                      {new Date(selectedConnection.last_connected_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) { deleteConnection(deleteTarget); setDeleteTarget(null); } }}
        title="Eliminar Conexión"
        message="¿Eliminar esta conexión de WhatsApp? Se desconectará el bot y se eliminarán todos los datos asociados."
        confirmText="Eliminar"
        variant="danger"
      />
    </PageContainer>
  );
};

