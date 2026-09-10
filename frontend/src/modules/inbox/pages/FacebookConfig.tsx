import { useState } from 'react';
import { FaFacebookMessenger, FaInstagram, FaFacebook } from 'react-icons/fa';
import {
  CheckCircle, AlertTriangle, RefreshCw,
  LogOut, ArrowRight, Info, Clock, Layers, Shield, MessageSquare
} from 'lucide-react';
import { Loader } from '../../../components/ui/Loader';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageBody } from '../../../components/layout/PageBody';
import { PageContainer } from '../../../components/layout/PageContainer';
import { ConnectionLayout, EcosystemStatus } from '../components/ConnectionLayout';
import { useConnections } from '../../../contexts/ConnectionsContext';
import { cn } from '../../../utils/cn';
import { Modal } from '../../../components/ui/Modal';
import { useNotifications } from '../../../contexts/NotificationContext';

type Status = 'disconnected' | 'connecting' | 'selecting_page' | 'connected' | 'token_expired';

interface MessengerData {
  pageId: string;
  pageName: string;
  pageProfilePicUrl: string;
  status: Status;
  connectedAt?: string;
  tokenExpiresAt?: string;
}

const mockPages = [
  { id: 'pg_001', name: 'Página Oficial SparkBot', profilePic: '' },
  { id: 'pg_002', name: 'SparkBot Atención al Cliente', profilePic: '' },
  { id: 'pg_003', name: 'SparkBot Promociones', profilePic: '' },
];

const prerequisites = [
  'El usuario debe ser administrador de una Página de Facebook',
  'La página debe tener Messenger habilitado',
];

export const FacebookConfig = () => {
  const { addNotification } = useNotifications();
  const { addConnection, removeConnection, getConnectionByPlatform } = useConnections();
  const existingConnection = getConnectionByPlatform('facebook_messenger');
  const [data, setData] = useState<MessengerData>({
    pageId: '', pageName: '', pageProfilePicUrl: '', status: existingConnection ? 'connected' : 'disconnected',
  });
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('');
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const dbConnected = !!existingConnection;
  const isConnected = data.status === 'connected' || dbConnected;
  const isExpired = data.status === 'token_expired';
  const isSelecting = data.status === 'selecting_page';

  // Mock: simular que Instagram ya está conectado
  const instagramConnected = !!getConnectionByPlatform('instagram');

  const handleConnect = async () => {
    // TODO: iniciar OAuth real con Meta (permisos pages_messaging, pages_show_list)
    setData(prev => ({ ...prev, status: 'connecting' }));

    setLoading(true);
    setLoadingLabel('Redirigiendo a Facebook...');
    await new Promise(r => setTimeout(r, 1000));

    setLoadingLabel('Autorizando permisos...');
    await new Promise(r => setTimeout(r, 1000));

    setLoading(false);
    // TODO: GET /api/channels/messenger/pages para listar páginas tras el callback
    setData(prev => ({ ...prev, status: 'selecting_page' }));
    setSelectedPage(null);
  };

  const handleConfirmPage = async () => {
    if (!selectedPage) return;
    const page = mockPages.find(p => p.id === selectedPage);
    if (!page) return;

    setLoading(true);
    setLoadingLabel('Conectando página...');
    try {
      await addConnection('facebook_messenger', {
        pageId: page.id,
        pageAccessToken: 'mock_page_token',
        displayName: page.name,
      });
      addNotification({ type: 'success', title: 'Messenger conectado', message: `${page.name} se conectó correctamente.` });
      setData({
        pageId: page.id,
        pageName: page.name,
        pageProfilePicUrl: '',
        status: 'connected',
        connectedAt: new Date().toISOString(),
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch (err) {
      console.error('Error connecting Messenger:', err);
      addNotification({ type: 'error', title: 'Error de conexión', message: 'No se pudo conectar Messenger. Intenta de nuevo.' });
    }
    setLoading(false);
  };

  const handleDisconnect = async () => {
    if (!existingConnection) return;
    setLoading(true);
    try {
      await removeConnection(existingConnection.id);
      addNotification({ type: 'success', title: 'Messenger desconectado', message: 'La página de Messenger fue desconectada correctamente.' });
      setData({ pageId: '', pageName: '', pageProfilePicUrl: '', status: 'disconnected' });
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo desconectar Messenger.' });
      console.error('Error disconnecting Messenger:', err);
    }
    setLoading(false);
    setShowConfirm(false);
  };

  const handleReconnect = () => {
    setData(prev => ({ ...prev, status: 'disconnected' }));
    handleConnect();
  };

  return (
    <PageContainer>
      <PageHeader
        title="Conexión de"
        highlight="Messenger"
        description="Conecta tu Página de Facebook para automatizar mensajes."
        icon={FaFacebookMessenger}
        action={
          isConnected ? (
            <div className="px-4 h-10 rounded-xl flex items-center gap-2 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              Página Conectada
            </div>
          ) : isExpired ? (
            <div className="px-4 h-10 rounded-xl flex items-center gap-2 bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest border border-red-500/20">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              Token Vencido
            </div>
          ) : (
            <div className="px-4 h-10 rounded-xl flex items-center gap-2 bg-white dark:bg-dark-card border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              Sin Conexión
            </div>
          )
        }
      />

      <PageBody>
      <ConnectionLayout sidebar={<EcosystemStatus platform="messenger" />}>

          {/* Instagram connected notice */}
          {instagramConnected && data.status === 'disconnected' && (
            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-3">
              <FaInstagram className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                <span className="font-bold text-slate-900 dark:text-white">Instagram ya conectado</span> con Facebook. Reutiliza la sesión sin re-autorizar.
              </p>
            </div>
          )}

          {/* --- CONNECTED STATE --- */}
          {isConnected && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-4">
                  <div className="relative">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/20">
                      <FaFacebookMessenger size={34} color="white" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center border-[3px] border-white dark:border-dark-card">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="text-center sm:text-left flex-1">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">Messenger Conectado</h3>
                    <p className="text-blue-600 font-bold text-sm">{data.pageName}</p>
                    <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                      <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest rounded-lg">Conectado</span>
                      {data.connectedAt && (
                        <span className="text-[10px] text-slate-400 font-semibold">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {new Date(data.connectedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700/30">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <Layers className="w-3 h-3" /> Página
                    </p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{data.pageName}</p>
                  </div>
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700/30">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> ID
                    </p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                      {data.pageId.slice(0, 8)}...
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowConfirm(true)} disabled={loading}
                    className="flex-1 h-11 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50">
                    <LogOut className="w-3.5 h-3.5" /> Desconectar
                  </button>
                  <button onClick={handleReconnect}
                    className="flex-1 h-11 flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all hover:scale-[1.01] active:scale-[0.99]">
                    <RefreshCw className="w-3.5 h-3.5" /> Reconectar
                  </button>
                </div>
              </div>

              <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Mensajes fuera de 24h requieren plantillas aprobadas por Meta.
                </p>
              </div>
            </div>
          )}

          {/* --- TOKEN EXPIRED STATE --- */}
          {isExpired && (
            <div className="bg-white dark:bg-dark-card rounded-2xl border border-red-200 dark:border-red-900/30 shadow-sm p-5 text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">Token Vencido</h3>
              <p className="text-sm text-slate-500 mb-2">El acceso a Messenger ha expirado. Reconecta tu página para seguir usando la automatización.</p>
              {data.tokenExpiresAt && (
                <p className="text-xs text-slate-400 mb-4">Venció el {new Date(data.tokenExpiresAt).toLocaleDateString('es-ES')}</p>
              )}
              <button onClick={handleReconnect}
                className="inline-flex items-center gap-2 h-11 px-8 bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg">
                <RefreshCw className="w-4 h-4" /> Reconectar Página
              </button>
            </div>
          )}

          {/* --- SELECTING PAGE --- */}
          {isSelecting && (
            <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-lg">
                  <FaFacebookMessenger size={18} color="white" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Selecciona una Página</h3>
                  <p className="text-[10px] text-slate-500">Administras varias páginas de Facebook</p>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                {mockPages.map(page => (
                  <button
                    key={page.id}
                    onClick={() => setSelectedPage(page.id)}
                    className={cn(
                      "w-full p-4 rounded-xl border-2 text-left transition-all",
                      selectedPage === page.id
                        ? 'border-blue-500 bg-blue-500/5 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800/30'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-md shrink-0">
                        <FaFacebookMessenger size={20} color="white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{page.name}</p>
                        <p className="text-xs text-slate-500">ID: {page.id}</p>
                      </div>
                      {selectedPage === page.id && (
                        <CheckCircle className="w-5 h-5 text-blue-500 shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={handleConfirmPage}
                disabled={!selectedPage || loading}
                className="w-full h-11 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                {loading ? <><Loader size="xs" /> {loadingLabel}</> : <><ArrowRight className="w-4 h-4" /> Confirmar Selección</>}
              </button>
            </div>
          )}

          {/* --- DISCONNECTED STATE --- */}
          {data.status === 'disconnected' && (
            <>
              {/* Prerequisites checklist */}
              <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-lg shadow-blue-500/20">
                    <Shield size={16} color="white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">Requisitos Previos</h3>
                    <p className="text-[10px] text-slate-500">Verifica antes de conectar</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {prerequisites.map((text, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 shrink-0 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mt-0.5">
                        <CheckCircle className="w-3 h-3 text-emerald-500" />
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Connect button */}
              <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl shadow-blue-500/20">
                  <FaFacebookMessenger size={28} color="white" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Conectar Messenger</h3>
                <p className="text-sm text-slate-500 mb-4 max-w-md mx-auto">
                  Autoriza el acceso para empezar a automatizar los mensajes de tu página de Facebook.
                </p>

                <button
                  onClick={handleConnect}
                  disabled={loading}
                  className="w-full h-12 flex items-center justify-center gap-3 bg-[#1877F2] hover:bg-[#166fe5] text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {loading ? (
                    <><Loader size="xs" /> {loadingLabel}</>
                  ) : (
                    <><FaFacebook size={18} /> Conectar con Facebook</>
                  )}
                </button>
              </div>

              {/* Note */}
              <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Mensajes fuera de 24h requieren plantillas aprobadas por Meta.
                </p>
              </div>
            </>
          )}
        {/* Confirm disconnect modal */}
        <Modal
          open={showConfirm}
          onClose={() => setShowConfirm(false)}
          title="Desconectar Messenger"
          size="sm"
          icon={<div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-xl flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-500" /></div>}
          footer={
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 h-11 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                Cancelar
              </button>
              <button onClick={handleDisconnect} disabled={loading}
                className="flex-1 h-11 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? 'Desconectando...' : 'Desconectar'}
              </button>
            </div>
          }
        >
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
            Los flujos de automatización dejarán de funcionar para Messenger.
          </p>
        </Modal>
      </ConnectionLayout>
      </PageBody>
    </PageContainer>
  );
};
