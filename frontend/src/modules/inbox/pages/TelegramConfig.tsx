import { useState } from 'react';
import { FaTelegram } from 'react-icons/fa';
import {
  Key, CheckCircle, XCircle, AlertTriangle, Eye, EyeOff,
  ExternalLink, ArrowRight, LogOut, Bot, MessageSquare,
  User, Calendar, Shield
} from 'lucide-react';
import { useConnections } from '../../../contexts/ConnectionsContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageBody } from '../../../components/layout/PageBody';
import { PageContainer } from '../../../components/layout/PageContainer';
import { ConnectionLayout, EcosystemStatus } from '../components/ConnectionLayout';
import { cn } from '../../../utils/cn';
import { Modal } from '../../../components/ui/Modal';
import { Loader } from '../../../components/ui/Loader';
import { useNotifications } from '../../../contexts/NotificationContext';

// Regex básico para token de Telegram: numéricos:alfanumérico
const TOKEN_REGEX = /^\d{8,10}:[A-Za-z0-9_-]{35,40}$/;

export const TelegramConfig = () => {
  const { addNotification } = useNotifications();
  const { addConnection, removeConnection, getConnectionByPlatform, isConnecting } = useConnections();
  const existingConnection = getConnectionByPlatform('telegram');
  const isConnected = existingConnection?.status === 'connected';
  const hasFailedConnection = !!existingConnection && !isConnected;

  // Form state
  const [botToken, setBotToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showConfirm, setShowConfirm] = useState(false);

  const validateToken = (token: string): string | null => {
    if (!token.trim()) return 'El token no puede estar vacío.';
    if (!TOKEN_REGEX.test(token.trim())) return 'Formato de token inválido. Debe ser algo como "123456789:ABCdefGHIjklMNOpqrsTUVwxyz".';
    if (token.toLowerCase().includes('invalid')) return 'Token inválido o revocado. Verifica que el token sea correcto en @BotFather.';
    return null;
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateToken(botToken);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const cleanUsername = botToken.split(':')[0];
      // Eliminar conexión fallida previa antes de reconectar (evita duplicados)
      if (existingConnection && !isConnected) {
        try {
          await removeConnection(existingConnection.id);
        } catch (remErr) {
          console.error('Error removing stale Telegram connection:', remErr);
        }
      }
      await addConnection('telegram', {
        botToken: botToken,
        botUsername: cleanUsername,
        displayName: 'Telegram Bot',
        username: cleanUsername,
      });
      addNotification({ type: 'success', title: 'Telegram conectado', message: 'El bot de Telegram se conectó correctamente.' });
      setBotToken('');
    } catch (err: any) {
      console.error('Error connecting Telegram:', err);
      const message = err?.response?.data?.error || err?.message || 'No se pudo conectar Telegram. Verifica el token.';
      setError(message);
      addNotification({ type: 'error', title: 'Error de conexión', message });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!existingConnection) return;
    setLoading(true);
    try {
      await removeConnection(existingConnection.id);
      addNotification({ type: 'success', title: 'Bot desconectado', message: 'El bot de Telegram fue desconectado correctamente.' });
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo desconectar el bot.' });
      console.error('Error disconnecting Telegram:', err);
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Conexión de"
        highlight="Telegram"
        description="Conecta tu bot de Telegram para automatizar la atención al cliente."
        icon={FaTelegram}
        action={
          isConnected ? (
            <div className="px-4 h-10 rounded-xl flex items-center gap-2 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              Bot Activo
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
      <ConnectionLayout sidebar={<EcosystemStatus platform="telegram" />}>
        {isConnected ? (
          /* --- CONNECTED STATE --- */
          <>
            <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-4">
                <div className="relative">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/20">
                    <FaTelegram size={36} color="white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center border-[3px] border-white dark:border-dark-card">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div className="text-center sm:text-left flex-1">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">{existingConnection?.display_name || 'Bot Conectado'}</h3>
                  <p className="text-blue-500 font-bold text-sm">@{existingConnection?.username || 'bot'}</p>
                  <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                    <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Conectado
                    </span>
                    {existingConnection?.connected_at && (
                      <span className="text-[10px] text-slate-400 font-semibold">
                        <Calendar className="w-3 h-3 inline mr-1" />
                        {new Date(existingConnection.connected_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700/30">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <Bot className="w-3 h-3" /> Bot
                  </p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{existingConnection?.display_name || '—'}</p>
                </div>
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700/30">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <User className="w-3 h-3" /> Username
                  </p>
                  <p className="text-sm font-bold text-blue-500">@{existingConnection?.username || '—'}</p>
                </div>
              </div>

              <button
                onClick={() => setShowConfirm(true)}
                className="w-full h-11 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                <LogOut className="w-3.5 h-3.5" />
                Desconectar Bot
              </button>
            </div>

            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-3">
              <MessageSquare className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Bot activo recibiendo mensajes. Los flujos del Constructor funcionan automáticamente.
              </p>
            </div>

            {/* Confirm disconnect modal */}
            <Modal
              open={showConfirm}
              onClose={() => setShowConfirm(false)}
              title="Desconectar Bot"
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
                ¿Estás seguro? Los flujos asociados dejarán de funcionar.
              </p>
            </Modal>
          </>
        ) : (
          <>
            {hasFailedConnection && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 mb-4">
                <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="text-xs text-red-400 leading-relaxed">
                  <span className="font-black uppercase tracking-widest">Conexión anterior con error.</span>
                  <br />
                  El intento anterior no se completó correctamente. Introduce un token válido y vuelve a pulsar
                  <span className="font-bold"> "Validar y Conectar"</span> para reintentar.
                </div>
              </div>
            )}
            {/* Instructions block */}
            <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
                  <FaTelegram size={18} color="white" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Obtén el Token de tu Bot</h3>
                  <p className="text-[10px] text-slate-500">Sigue estos pasos en Telegram</p>
                </div>
              </div>
              <div className="p-5 space-y-0">
                {[
                  { num: '01', text: 'Abre Telegram y busca el contacto oficial', bold: '@BotFather' },
                  { num: '02', text: 'Envía el comando', bold: '/newbot', extra: 'y sigue las instrucciones' },
                  { num: '03', text: 'Elige un nombre y username para tu bot' },
                  { num: '04', text: 'BotFather te entregará un token. Cópialo y pégalo abajo' },
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-4 py-3 border-b border-slate-50 dark:border-slate-800/50 last:border-0">
                    <span className="w-7 h-7 shrink-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white text-[10px] font-black rounded-lg flex items-center justify-center shadow-sm">
                      {step.num}
                    </span>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pt-0.5">
                      {step.text} <span className="font-black text-slate-900 dark:text-white">{step.bold}</span>
                      {step.extra && <span className="text-slate-500"> {step.extra}</span>}
                    </p>
                  </div>
                ))}
              </div>
              <div className="px-5 pb-5">
                <a
                  href="https://t.me/botfather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-400 font-bold transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Abrir @BotFather
                </a>
              </div>
            </div>

            {/* Form */}
            <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
                  <Key size={16} color="white" />
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Conectar tu Bot</h3>
              </div>

              {error && (
                <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <form onSubmit={handleConnect} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Token del Bot <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={botToken}
                      onChange={e => { setBotToken(e.target.value); setError(''); }}
                      placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                      className={cn(
                        "w-full h-11 pl-4 pr-12 bg-white dark:bg-slate-800/50 rounded-xl border text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition-all placeholder:text-slate-400",
                        error ? 'border-red-400 focus:ring-red-500/20' : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20 focus:border-blue-500'
                      )}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">Pega el token que te entregó @BotFather</p>
                </div>

                <button
                  type="submit"
                  disabled={loading || isConnecting('telegram')}
                  className="w-full h-11 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  {loading || isConnecting('telegram') ? (
                    <><Loader size="xs" /> Validando...</>
                  ) : (
                    <><ArrowRight className="w-4 h-4" /> Validar y Conectar</>
                  )}
                </button>
              </form>
            </div>

            {/* Note */}
            <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-start gap-3">
              <Shield className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Requiere mensajes directos sin restricción de grupo. Usa <span className="font-bold text-slate-900 dark:text-white">/setprivacy</span> con @BotFather.
              </p>
            </div>
          </>
        )}
      </ConnectionLayout>
      </PageBody>
    </PageContainer>
  );
};