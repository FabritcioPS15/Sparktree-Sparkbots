import { useState, useEffect, useRef } from 'react';
import { QrCode, RefreshCw, LogOut, CheckCircle, Smartphone, Cloud, ScanLine, Trash2, ExternalLink, Shield, Webhook, MessageSquare, Pencil, Check } from 'lucide-react';
import { getQRStatus, initializeQR, logoutQR, getSettings, createWhatsAppCloudConnection, updateWhatsAppCloudPhone } from '../../../services/api';
import { useWhatsApp } from '../../../contexts/WhatsAppContext';
import { useConnections } from '../../../contexts/ConnectionsContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageBody } from '../../../components/layout/PageBody';
import { PageContainer } from '../../../components/layout/PageContainer';
import { PageLoader } from '../../../components/layout/PageLoader';
import { ConnectionLayout, FormCard, EcosystemStatus, InputField } from '../components/ConnectionLayout';

export const WhatsAppQR = () => {
  const [data, setData] = useState<{ status: string; qr?: string; phoneNumber?: string }>({ status: 'unknown' });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState<'qr' | 'cloud'>('qr');
  const [showCloudForm, setShowCloudForm] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [cloudCredentials, setCloudCredentials] = useState({
    phoneNumberId: '',
    accessToken: '',
    displayName: '',
    webhookVerifyToken: '',
    phoneNumber: ''
  });
  const hasLoadedOnce = useRef(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const { } = useWhatsApp();
  const { connections, addConnection, removeConnection, refreshConnections } = useConnections();
  const { addNotification } = useNotifications();

  const cloudConnection = connections.find(c => c.platform_type === 'whatsapp' && c.id !== 'whatsapp_session');
  const hasNotifiedConnect = useRef(false);

  const fetchStatus = async () => {
    if (connectionMethod !== 'qr') return;
    try {
      const res = await getQRStatus();
      const wasConnected = data.status === 'connected';
      setData(res);
      setLoading(false);
      hasLoadedOnce.current = true;
      if (res.status === 'connected' && res.phoneNumber) {
        await addConnection('whatsapp', { displayName: 'WhatsApp Business', phoneNumber: res.phoneNumber });
        if (!wasConnected && !hasNotifiedConnect.current) {
          hasNotifiedConnect.current = true;
          addNotification({ type: 'success', title: 'WhatsApp conectado', message: `QR escaneado. Línea ${res.phoneNumber} activa.` });
        }
      }
      if (res.status !== 'connected') {
        hasNotifiedConnect.current = false;
      }
      return res;
    } catch (error) {
      console.error('Error fetching QR status:', error);
      setLoading(false);
      return null;
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const settings = await getSettings();
        setConnectionMethod(settings.connectionMethod || 'qr');
        if ((settings.connectionMethod || 'qr') === 'qr') {
          await fetchStatus();
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    let interval: any;
    if (connectionMethod === 'qr') {
      interval = setInterval(fetchStatus, 5000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [connectionMethod]);

  useEffect(() => {
    if (hasLoadedOnce.current && connectionMethod === 'qr' && !loading && !actionLoading && data.status === 'disconnected' && !data.qr) {
      handleInit();
    }
  }, [data.status, data.qr, loading, actionLoading, connectionMethod]);

  const handleInit = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await initializeQR();
      await fetchStatus();
    } catch (error) {
      console.error('Error initializing QR:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    setConfirmLogout(false);
    setActionLoading(true);
    try {
      await logoutQR();
      setData({ status: 'disconnected' });
      const existingConnection = connections.find(c => c.platform_type === 'whatsapp' && c.id === 'whatsapp_session');
      if (existingConnection) { await removeConnection(existingConnection.id); }
      await fetchStatus();
      addNotification({ type: 'success', title: 'Sesión cerrada', message: 'La sesión de WhatsApp QR ha sido cerrada.' });
    } catch (error) {
      console.error('Error logging out:', error);
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo cerrar la sesión.' });
    }
    setActionLoading(false);
  };

  const handleCloudConnection = async () => {
    if (!cloudCredentials.phoneNumberId || !cloudCredentials.accessToken || !cloudCredentials.displayName || !cloudCredentials.phoneNumber) {
      addNotification({ type: 'warning', title: 'Campos requeridos', message: 'Completa todos los campos obligatorios, incluido el número de WhatsApp.' });
      return;
    }
    setActionLoading(true);
    try {
      await createWhatsAppCloudConnection(cloudCredentials);
      setShowCloudForm(false);
      setConnectionMethod('cloud');
      await refreshConnections();
      addNotification({ type: 'success', title: 'Conexión creada', message: 'WhatsApp Cloud API conectada exitosamente.' });
    } catch (error) {
      console.error('Error creating WhatsApp Cloud connection:', error);
      addNotification({ type: 'error', title: 'Error de conexión', message: 'No se pudo crear la conexión Cloud API.' });
    }
    setActionLoading(false);
  };

  const handleCloudDisconnect = async () => {
    setConfirmDisconnect(false);
    if (!cloudConnection) return;
    setActionLoading(true);
    try {
      await removeConnection(cloudConnection.id);
      await refreshConnections();
      addNotification({ type: 'success', title: 'Conexión eliminada', message: 'La conexión Cloud API fue desconectada.' });
    } catch (error) {
      console.error('Error disconnecting Cloud:', error);
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo desconectar la API.' });
    }
    setActionLoading(false);
  };

  const startEditPhone = () => {
    setPhoneDraft(cloudConnection?.phone_number || '');
    setEditingPhone(true);
  };

  const savePhone = async () => {
    if (!cloudConnection || !phoneDraft.trim()) {
      addNotification({ type: 'warning', title: 'Número requerido', message: 'Ingresa el número real de WhatsApp.' });
      return;
    }
    setActionLoading(true);
    try {
      await updateWhatsAppCloudPhone(cloudConnection.id, phoneDraft.trim());
      await refreshConnections();
      setEditingPhone(false);
      addNotification({ type: 'success', title: 'Número actualizado', message: 'El número al que pertenece la conexión fue actualizado.' });
    } catch (error) {
      console.error('Error updating phone number:', error);
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo actualizar el número de WhatsApp.' });
    }
    setActionLoading(false);
  };

  if (loading) return <PageLoader sectionName="Conexión" />;

  const isQrConnected = data.status === 'connected';
  const isCloudConnected = cloudConnection?.status === 'connected';
  const isConnected = connectionMethod === 'qr' ? isQrConnected : isCloudConnected;

  return (
    <PageContainer>
      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={handleLogout}
        title="Cerrar sesión"
        message="¿Deseas cerrar la sesión activa de WhatsApp?"
        confirmText="Cerrar sesión"
        variant="danger"
        isLoading={actionLoading}
      />
      <ConfirmDialog
        open={confirmDisconnect}
        onClose={() => setConfirmDisconnect(false)}
        onConfirm={handleCloudDisconnect}
        title="Desconectar Cloud API"
        message="¿Deseas desconectar la API de Meta? Los mensajes se detendrán."
        confirmText="Desconectar"
        variant="danger"
        isLoading={actionLoading}
      />
      <PageHeader
        title="Conexión de"
        highlight="WhatsApp"
        description="Vincula la línea que atenderá a tus clientes e iniciará sesión."
        icon={QrCode}
        action={
          <div className={`px-4 h-10 rounded-xl flex items-center gap-2 border text-[10px] font-black uppercase tracking-widest transition-all ${isConnected
            ? 'bg-white dark:bg-dark-card border-accent-500/30 text-accent-500'
            : 'bg-white dark:bg-dark-card border-slate-200 dark:border-slate-700 text-slate-400'
            }`}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${isConnected ? 'bg-accent-500 shadow-[0_0_8px_rgba(55,80,240,0.5)]' : 'bg-slate-300 dark:bg-slate-600'}`} />
            {isConnected ? 'Línea Activa' : 'Sin Conexión'}
          </div>
        }
      />

      <PageBody>
        <ConnectionLayout
          sidebar={<EcosystemStatus platform="whatsapp" />}
        >
          <div className="p-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 grid grid-cols-2">
            <button onClick={() => { setConnectionMethod('qr'); setShowCloudForm(false); }}
              className={`flex-1 h-11 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${connectionMethod === 'qr'
                ? 'bg-accent-500 text-black shadow-lg shadow-accent-500/20'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}>
              <div className="flex items-center justify-center gap-2">
                <ScanLine className="w-4 h-4" />
                <span>Código QR</span>
              </div>
            </button>
            <button onClick={() => { setConnectionMethod('cloud'); setShowCloudForm(true); }}
              className={`flex-1 h-11 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${connectionMethod === 'cloud'
                ? 'bg-accent-500 text-black shadow-lg shadow-accent-500/20'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}>
              <div className="flex items-center justify-center gap-2">
                <Cloud className="w-4 h-4" />
                <span>API de Meta</span>
              </div>
            </button>
          </div>

          {connectionMethod === 'cloud' && (
            isCloudConnected ? (
              <FormCard
                icon={<div className="p-2 bg-gradient-to-br from-accent-500 to-accent-700 rounded-xl shadow-lg shadow-accent-500/25"><Cloud size={18} color="white" /></div>}
                title="Configuración activa — Cloud API"
              >
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-accent-500 to-accent-700 rounded-3xl flex items-center justify-center shadow-2xl shadow-accent-500/30">
                    <CheckCircle className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">CONFIGURACIÓN COMPLETADA</h3>
                    <p className="text-[10px] font-black text-accent-500 uppercase tracking-widest mt-1">WhatsApp Cloud API Activa</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                    <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/50">
                      <div className="p-2 bg-accent-500/10 rounded-lg text-accent-500">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Número al que pertenece</p>
                          <button onClick={startEditPhone}
                            className="text-slate-400 hover:text-accent-500 transition-colors" title="Editar número">
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                        {editingPhone ? (
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              value={phoneDraft}
                              onChange={(e) => setPhoneDraft(e.target.value)}
                              placeholder="+34 600 000 000"
                              className="flex-1 min-w-0 px-2 py-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500"
                            />
                            <button onClick={savePhone} disabled={actionLoading}
                              className="p-1.5 bg-accent-500 text-black rounded-lg hover:bg-accent-600 transition-colors disabled:opacity-50" title="Guardar">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <p className="text-base font-black text-slate-900 dark:text-white leading-none truncate">
                            {cloudConnection?.phone_number || 'Agrega tu número'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/50">
                      <div className="p-2 bg-accent-500/10 rounded-lg text-accent-500">
                        <Cloud className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Nombre</p>
                        <p className="text-base font-black text-slate-900 dark:text-white leading-none">{cloudConnection?.display_name || '—'}</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 font-medium max-w-xs">
                    Los mensajes se procesan a través de la API oficial de Meta.
                  </p>
                  <button onClick={() => setConfirmDisconnect(true)} disabled={actionLoading}
                    className="flex items-center gap-2 text-[10px] font-black text-red-400 uppercase tracking-widest hover:bg-red-500/10 h-10 px-5 rounded-xl transition-all disabled:opacity-50">
                    <Trash2 className="w-3.5 h-3.5" /> Desconectar Cloud API
                  </button>
                </div>
              </FormCard>
            ) : showCloudForm ? (
              <FormCard
                icon={<div className="p-2 bg-gradient-to-br from-accent-500 to-accent-700 rounded-xl shadow-lg shadow-accent-500/25"><Cloud size={18} color="white" /></div>}
                title="Conectar con WhatsApp Cloud API"
              >
                <div className="space-y-4">
                  {/* Guia paso a paso */}
                  <div className="p-4 bg-accent-500/5 border border-accent-500/15 rounded-xl">
                    <p className="text-[10px] font-black text-accent-600 dark:text-accent-300 uppercase tracking-widest mb-3">Cómo obtener tus credenciales</p>
                    <div className="space-y-2.5">
                      <div className="flex items-start gap-2.5">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent-500 text-white text-[9px] font-black flex items-center justify-center mt-0.5">1</span>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">Ve a <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-2 hover:text-accent-500">Meta for Developers</a> y selecciona tu App</p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent-500 text-white text-[9px] font-black flex items-center justify-center mt-0.5">2</span>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">En <strong>WhatsApp &rarr; Getting Started</strong> copia el <strong>Phone Number ID</strong></p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent-500 text-white text-[9px] font-black flex items-center justify-center mt-0.5">3</span>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">En <strong>System Users</strong> genera un token con permisos <strong>whatsapp_business_messaging</strong></p>
                      </div>
                    </div>
                  </div>

                  {/* Campos del formulario */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <InputField
                      label="Phone Number ID"
                      value={cloudCredentials.phoneNumberId}
                      onChange={(v) => setCloudCredentials({ ...cloudCredentials, phoneNumberId: v })}
                      placeholder="123456789012345"
                      required
                      hint="Lo encuentras en Meta for Developers > WhatsApp > Getting Started"
                    />
                    <InputField
                      label="Número de WhatsApp"
                      value={cloudCredentials.phoneNumber}
                      onChange={(v) => setCloudCredentials({ ...cloudCredentials, phoneNumber: v })}
                      placeholder="+34 600 000 000"
                      required
                      hint="El número real al que pertenece esta conexión (no el Phone Number ID)"
                    />
                    <InputField
                      label="Access Token"
                      type="password"
                      value={cloudCredentials.accessToken}
                      onChange={(v) => setCloudCredentials({ ...cloudCredentials, accessToken: v })}
                      placeholder="EAAxxxxxxxxxx"
                      required
                      hint="Token temporal de System Users con permisos de mensajería"
                    />
                    <InputField
                      label="Nombre de Conexión"
                      value={cloudCredentials.displayName}
                      onChange={(v) => setCloudCredentials({ ...cloudCredentials, displayName: v })}
                      placeholder="Mi línea de atención"
                      required
                      hint="Un nombre para identificar esta línea en el panel"
                    />
                    <InputField
                      label="Webhook Verify Token"
                      value={cloudCredentials.webhookVerifyToken}
                      onChange={(v) => setCloudCredentials({ ...cloudCredentials, webhookVerifyToken: v })}
                      placeholder="sparktree_webhook"
                      hint="Token para verificar el webhook. Déjalo vacío para usar el default"
                    />
                  </div>

                  {/* Link a documentación */}
                  <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[10px] font-bold text-accent-500 hover:text-accent-400 transition-colors">
                    <ExternalLink className="w-3 h-3" />
                    Ver guía oficial de Meta para Cloud API
                  </a>

                  {/* Botones */}
                  <div className="flex gap-3 pt-2">
                    <button onClick={handleCloudConnection} disabled={actionLoading}
                      className="flex-1 h-11 bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-black rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99]">
                      {actionLoading ? 'Conectando...' : 'Conectar'}
                    </button>
                    <button onClick={() => setShowCloudForm(false)}
                      className="px-6 h-11 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                      Cancelar
                    </button>
                  </div>
                </div>
              </FormCard>
            ) : (
              <FormCard
                icon={<div className="p-2 bg-gradient-to-br from-accent-500 to-accent-700 rounded-xl shadow-lg shadow-accent-500/25"><Cloud size={18} color="white" /></div>}
                title="WhatsApp Cloud API"
              >
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                    <Cloud className="w-10 h-10 text-accent-500" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium max-w-xs">
                      Conecta tu número de WhatsApp Business a través de la API oficial de Meta para enviar y recibir mensajes.
                    </p>
                  </div>

                  {/* Beneficios */}
                  <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
                    <div className="flex flex-col items-center gap-1.5 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700/30">
                      <MessageSquare className="w-4 h-4 text-accent-500" />
                      <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400">Templates</p>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700/30">
                      <Shield className="w-4 h-4 text-accent-500" />
                      <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400">Oficial Meta</p>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700/30">
                      <Webhook className="w-4 h-4 text-accent-500" />
                      <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400">Webhooks</p>
                    </div>
                  </div>

                  <button onClick={() => setShowCloudForm(true)}
                    className="flex items-center justify-center gap-2 h-11 px-8 bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-black rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all hover:scale-[1.01] active:scale-[0.99]">
                    <Cloud className="w-3.5 h-3.5" />
                    Configurar Cloud API
                  </button>
                </div>
              </FormCard>
            )
          )}

          {connectionMethod === 'qr' && (
            <FormCard
              icon={<div className="p-2 bg-gradient-to-br from-accent-500 to-accent-700 rounded-xl shadow-lg shadow-accent-500/25"><ScanLine size={18} color="white" /></div>}
              title={isConnected ? 'Sesión Activa' : 'Escanea para Iniciar Sesión'}
            >
              {!isConnected ? (
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="p-4 bg-white rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700">
                    {data.qr ? (
                      <img src={data.qr} alt="WhatsApp QR" className="w-64 h-64 rounded-xl" />
                    ) : (
                      <div className="w-64 h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
                        <RefreshCw className="w-10 h-10 animate-spin text-accent-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Generando sesión...</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium max-w-sm">
                    Esta línea será la encargada de enviar todas las respuestas automáticas.
                  </p>
                  <button onClick={handleInit} disabled={actionLoading}
                    className="flex items-center justify-center gap-2 h-11 px-8 bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-black rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Regenerar Código
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-accent-500 to-accent-700 rounded-3xl flex items-center justify-center shadow-2xl shadow-accent-500/30">
                    <CheckCircle className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">SESIÓN INICIADA</h3>
                    <p className="text-[10px] font-black text-accent-500 uppercase tracking-widest mt-1">Línea de Atención Activa</p>
                  </div>
                  <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <div className="p-2 bg-accent-500/10 rounded-lg text-accent-500">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Número Vinculado</p>
                      <p className="text-base font-black text-slate-900 dark:text-white leading-none">{data.phoneNumber || '+34 XXX XXX XXX'}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 font-medium max-w-xs">
                    Todos los clientes registrados serán atendidos automáticamente bajo este número.
                  </p>
                  <button onClick={() => setConfirmLogout(true)} disabled={actionLoading}
                    className="flex items-center gap-2 text-[10px] font-black text-red-400 uppercase tracking-widest hover:bg-red-500/10 h-10 px-5 rounded-xl transition-all disabled:opacity-50">
                    <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión Activa
                  </button>
                </div>
              )}
            </FormCard>
          )}
        </ConnectionLayout>
      </PageBody>
    </PageContainer>
  );
};
