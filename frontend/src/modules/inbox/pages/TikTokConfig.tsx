import { useState } from 'react';
import { FaTiktok } from 'react-icons/fa';
import {
  CheckCircle, XCircle, AlertTriangle, AlertCircle, ExternalLink, RefreshCw,
  LogOut, Info, Clock, MessageSquare, Shield
} from 'lucide-react';
import { Loader } from '../../../components/ui/Loader';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageBody } from '../../../components/layout/PageBody';
import { PageContainer } from '../../../components/layout/PageContainer';
import { ConnectionLayout, EcosystemStatus } from '../components/ConnectionLayout';
import { useConnections } from '../../../contexts/ConnectionsContext';
import { Modal } from '../../../components/ui/Modal';
import { useNotifications } from '../../../contexts/NotificationContext';

type Status = 'disconnected' | 'requirements_pending' | 'connecting' | 'connected' | 'error' | 'token_expired';

interface TikTokData {
  businessAccountId: string;
  username: string;
  displayName: string;
  profilePicUrl: string;
  status: Status;
  connectedAt?: string;
  errorMessage?: string;
}

const prerequisites = [
  'Cuenta de TikTok convertida a cuenta Business/Empresa',
  'Mensajes directos habilitados para todos',
];

export const TikTokConfig = () => {
  const { addNotification } = useNotifications();
  const { addConnection, removeConnection, getConnectionByPlatform } = useConnections();
  const existingConnection = getConnectionByPlatform('tiktok');
  const [data, setData] = useState<TikTokData>({
    businessAccountId: '', username: '', displayName: '', profilePicUrl: '', status: existingConnection ? 'connected' : 'disconnected',
  });
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('');
  const [requirementsChecked, setRequirementsChecked] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const dbConnected = !!existingConnection;
  const isConnected = data.status === 'connected' || dbConnected;
  const isError = data.status === 'error';
  const isExpired = data.status === 'token_expired';

  const handleConnect = async () => {
    setData(prev => ({ ...prev, status: 'connecting' }));

    setLoading(true);
    setLoadingLabel('Redirigiendo a TikTok...');
    await new Promise(r => setTimeout(r, 1000));

    setLoadingLabel('Autorizando permisos...');
    await new Promise(r => setTimeout(r, 1000));

    setLoading(false);
    try {
      await addConnection('tiktok', {
        accessToken: 'mock_access_token',
        advertiserId: 'tb_789012345',
        displayName: 'TikTok Business',
      });
      addNotification({ type: 'success', title: 'TikTok conectado', message: 'La cuenta de TikTok se conectó correctamente.' });
      setData({
        businessAccountId: 'tb_789012345',
        username: 'sparkbot_oficial',
        displayName: 'SparkBot Business',
        profilePicUrl: '',
        status: 'connected',
        connectedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error connecting TikTok:', err);
      addNotification({ type: 'error', title: 'Error de conexión', message: 'No se pudo conectar TikTok. Intenta de nuevo.' });
    }
  };

  const handleDisconnect = async () => {
    if (!existingConnection) return;
    setLoading(true);
    try {
      await removeConnection(existingConnection.id);
      addNotification({ type: 'success', title: 'TikTok desconectado', message: 'La cuenta de TikTok fue desconectada correctamente.' });
      setData(prev => ({
        ...prev,
        businessAccountId: '', username: '', displayName: '', profilePicUrl: '',
        status: 'disconnected', connectedAt: undefined, errorMessage: undefined,
      }));
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo desconectar TikTok.' });
      console.error('Error disconnecting TikTok:', err);
    }
    setLoading(false);
    setShowConfirm(false);
    setRequirementsChecked(false);
  };

  const handleReconnect = () => {
    setShowConfirm(false);
    setRequirementsChecked(false);
    setData(prev => ({ ...prev, status: 'disconnected', errorMessage: undefined }));
  };

  const handleSimulatePersonalAccount = () => {
    setData({
      businessAccountId: '', username: '', displayName: '', profilePicUrl: '',
      status: 'error',
      errorMessage: 'Esta cuenta es una cuenta personal, no Business. Convierte tu cuenta a TikTok Business antes de conectar.',
    });
  };

  return (
    <PageContainer>
      <PageHeader
        title="Conexión de" highlight="TikTok"
        description="Conecta tu cuenta de TikTok Business para automatizar mensajes directos."
        icon={FaTiktok}
        action={
          isConnected ? (
            <div className="px-4 h-10 rounded-xl flex items-center gap-2 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              Cuenta Conectada
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
      <ConnectionLayout sidebar={<EcosystemStatus platform="tiktok" />}>

          {/* --- CONNECTED STATE --- */}
          {isConnected && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-4">
                  <div className="relative">
                    <div className="w-20 h-20 bg-gradient-to-br from-black to-gray-800 rounded-2xl flex items-center justify-center shadow-xl shadow-black/20">
                      <FaTiktok size={34} color="white" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center border-[3px] border-white dark:border-dark-card">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="text-center sm:text-left flex-1">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">{data.displayName}</h3>
                    <p className="text-slate-500 font-bold text-sm">@{data.username}</p>
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
                      <Shield className="w-3 h-3" /> Business ID
                    </p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white font-mono">{data.businessAccountId}</p>
                  </div>
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700/30">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> @usuario
                    </p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">@{data.username}</p>
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

              <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-2">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    TikTok tiene una ventana de <span className="font-bold text-slate-900 dark:text-white">48 horas</span> después de la última interacción del usuario para responder.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    No se permite mensajería masiva ni listas de difusión tradicionales.
                  </p>
                </div>
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
              <p className="text-sm text-slate-500 mb-4">El acceso a TikTok Business ha expirado. Reconecta para seguir usando la automatización.</p>
              <button onClick={handleReconnect}
                className="inline-flex items-center gap-2 h-11 px-8 bg-gradient-to-r from-black to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg">
                <RefreshCw className="w-4 h-4" /> Reconectar
              </button>
            </div>
          )}

          {/* --- ERROR STATE --- */}
          {isError && (
            <div className="bg-white dark:bg-dark-card rounded-2xl border border-red-200 dark:border-red-900/30 shadow-sm p-5 text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">Cuenta no Business</h3>
              <p className="text-sm text-slate-500 mb-4 max-w-sm mx-auto">{data.errorMessage}</p>
              <a href="https://ads.tiktok.com/help/article?aid=10000123" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 underline mb-4">
                Ver instrucciones para convertir a Business <ExternalLink className="w-3 h-3" />
              </a>
              <div>
                <button onClick={() => setData(prev => ({ ...prev, status: 'disconnected', errorMessage: undefined }))}
                  className="inline-flex items-center gap-2 h-11 px-8 bg-gradient-to-r from-black to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg">
                  Volver a intentar
                </button>
              </div>
            </div>
          )}

          {/* --- DISCONNECTED STATE --- */}
          {(data.status === 'disconnected' || data.status === 'requirements_pending') && (
            <>
              {/* Warning banner */}
              <div className="p-4 bg-amber-400/10 border border-amber-400/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white mb-2">
                      Esta integración solo está disponible para cuentas TikTok Business.
                    </p>
                    <p className="text-xs text-slate-500 mb-3">
                      No disponible para cuentas de EE.UU., EEE, Suiza o Reino Unido.
                    </p>
                    <label className="flex items-start gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={requirementsChecked}
                        onChange={e => setRequirementsChecked(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded border-slate-300 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer"
                      />
                      <span className="text-[11px] text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 leading-relaxed">
                        Confirmo que mi cuenta cumple estos requisitos
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Prerequisites checklist */}
              <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 bg-gradient-to-br from-black to-gray-800 rounded-xl shadow-lg shadow-black/20">
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
                <div className="w-16 h-16 bg-gradient-to-br from-black to-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl shadow-black/20">
                  <FaTiktok size={28} color="white" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Conectar TikTok</h3>
                <p className="text-sm text-slate-500 mb-4 max-w-md mx-auto">
                  Autoriza el acceso para empezar a automatizar mensajes directos desde tu cuenta Business.
                </p>

                <button
                  onClick={handleConnect}
                  disabled={!requirementsChecked || loading}
                  className="w-full h-12 flex items-center justify-center gap-3 bg-gradient-to-r from-black to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {loading ? (
                    <><Loader size="xs" /> {loadingLabel}</>
                  ) : (
                    <><FaTiktok size={16} /> Conectar cuenta de TikTok Business</>
                  )}
                </button>

                {!requirementsChecked && !loading && (
                  <p className="text-[10px] text-slate-400 mt-3">Marca el checkbox de confirmación para habilitar la conexión</p>
                )}
              </div>

              {/* Simulate personal account button (for testing) */}
              <button onClick={handleSimulatePersonalAccount}
                className="w-full text-center text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline underline-offset-2 transition-colors">
                Simular cuenta personal (prueba)
              </button>
            </>
          )}
        {/* Confirm disconnect modal */}
        <Modal
          open={showConfirm}
          onClose={() => setShowConfirm(false)}
          title="Desconectar TikTok"
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
            Los flujos de automatización dejarán de funcionar para TikTok.
          </p>
        </Modal>
      </ConnectionLayout>
      </PageBody>
    </PageContainer>
  );
};
