import { useState, useEffect } from 'react';
import { FaInstagram } from 'react-icons/fa';
import {
  CheckCircle, AlertTriangle, LogOut, Info,
  Layers, Shield, Settings, Eye, EyeOff
} from 'lucide-react';
import { Loader } from '../../../components/ui/Loader';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageBody } from '../../../components/layout/PageBody';
import { PageContainer } from '../../../components/layout/PageContainer';
import { ConnectionLayout, EcosystemStatus } from '../components/ConnectionLayout';
import { useConnections } from '../../../contexts/ConnectionsContext';
import { Modal } from '../../../components/ui/Modal';
import { useNotifications } from '../../../contexts/NotificationContext';

const prerequisites = [
  'La cuenta de Instagram debe ser una cuenta profesional (Business o Creator)',
  'Debe estar vinculada a una Página de Facebook',
  'Necesitas un Access Token de la Graph API de Meta ( permisos: instagram_manage_messages, pages_messaging )',
];

export const InstagramConfig = () => {
  const { addNotification } = useNotifications();
  const { addConnection, removeConnection, getConnectionByPlatform } = useConnections();
  const existingConnection = getConnectionByPlatform('instagram');

  const [showForm, setShowForm] = useState(!existingConnection);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const [form, setForm] = useState({
    igAccountId: '',
    facebookPageId: '',
    accessToken: '',
    displayName: '',
  });

  const isConnected = !!existingConnection && existingConnection.status === 'connected';
  const hasError = !!existingConnection && existingConnection.status === 'error';

  useEffect(() => {
    if (existingConnection) {
      setShowForm(false);
    }
  }, [existingConnection]);

  const handleSave = async () => {
    if (!form.igAccountId.trim() || !form.facebookPageId.trim() || !form.accessToken.trim()) {
      addNotification({ type: 'error', title: 'Campos requeridos', message: 'Completa el ID de Instagram, el ID de la Página y el Access Token.' });
      return;
    }

    setLoading(true);
    try {
      await addConnection('instagram', {
        instagramBusinessAccountId: form.igAccountId.trim(),
        facebookPageId: form.facebookPageId.trim(),
        accessToken: form.accessToken.trim(),
        displayName: form.displayName.trim() || '@instagram',
      });
      addNotification({ type: 'success', title: 'Instagram conectado', message: 'La cuenta se verificó y conectó correctamente.' });
      setShowForm(false);
      setForm({ igAccountId: '', facebookPageId: '', accessToken: '', displayName: '' });
    } catch (err: any) {
      console.error('Error connecting Instagram:', err);
      addNotification({ type: 'error', title: 'Error de conexión', message: err?.message || 'No se pudo conectar. Verifica tus credenciales.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!existingConnection) return;
    setLoading(true);
    try {
      await removeConnection(existingConnection.id);
      addNotification({ type: 'success', title: 'Instagram desconectado', message: 'La cuenta fue desconectada.' });
      setShowForm(true);
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo desconectar.' });
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Conexión de"
        highlight="Instagram"
        description="Conecta tu cuenta de Instagram Business para automatizar mensajes."
        icon={FaInstagram}
        action={
          isConnected ? (
            <div className="px-4 h-10 rounded-xl flex items-center gap-2 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              Conectado
            </div>
          ) : hasError ? (
            <div className="px-4 h-10 rounded-xl flex items-center gap-2 bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase tracking-widest border border-amber-500/20">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              Error de Token
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
        <ConnectionLayout sidebar={<EcosystemStatus platform="instagram" />}>

          {/* ── CONECTADO ── */}
          {isConnected && !showForm && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-4">
                  <div className="relative">
                    <div className="w-20 h-20 bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-pink-500/20">
                      <FaInstagram size={34} color="white" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center border-[3px] border-white dark:border-dark-card">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="text-center sm:text-left flex-1">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">Instagram Conectado</h3>
                    <p className="text-pink-500 font-bold text-sm">{existingConnection?.display_name || existingConnection?.username || 'Instagram'}</p>
                    <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                      <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest rounded-lg">Activo</span>
                      {existingConnection?.connected_at && (
                        <span className="text-[10px] text-slate-400 font-semibold">
                          desde {new Date(existingConnection.connected_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700/30 mb-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <Layers className="w-3 h-3" /> ID de Cuenta IG Business
                  </p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white font-mono">{existingConnection?.username || existingConnection?.phone_number || '—'}</p>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowConfirm(true)} disabled={loading}
                    className="flex-1 h-11 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50">
                    <LogOut className="w-3.5 h-3.5" /> Desconectar
                  </button>
                  <button onClick={() => setShowForm(true)}
                    className="flex-1 h-11 flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                    <Settings className="w-3.5 h-3.5" /> Configurar
                  </button>
                </div>
              </div>

              <div className="p-4 bg-pink-500/5 border border-pink-500/10 rounded-xl flex items-start gap-3">
                <Info className="w-5 h-5 text-pink-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Los mensajes fuera de una ventana de 24 horas requieren usar plantillas aprobadas por Meta.
                </p>
              </div>
            </div>
          )}

          {/* ── ERROR DE TOKEN ── */}
          {hasError && !showForm && (
            <div className="bg-white dark:bg-dark-card rounded-2xl border border-amber-200 dark:border-amber-900/30 shadow-sm p-5 text-center">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">Error de Verificación</h3>
              <p className="text-sm text-slate-500 mb-4">El Access Token no es válido o los permisos son insuficientes. Verifica tus credenciales.</p>
              <button onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 h-11 px-8 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg">
                <Settings className="w-4 h-4" /> Reconfigurar Credenciales
              </button>
            </div>
          )}

          {/* ── FORMULARIO DE CONFIGURACIÓN ── */}
          {showForm && (
            <div className="space-y-4">
              {/* Requisitos */}
              <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl shadow-lg shadow-pink-500/20">
                    <Shield size={16} color="white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">Requisitos Previos</h3>
                    <p className="text-[10px] text-slate-500">Necesitas estos datos de la consola de Meta</p>
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

              {/* Formulario */}
              <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                    <FaInstagram size={20} color="white" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">Configurar Conexión</h3>
                    <p className="text-xs text-slate-500">Ingresa las credenciales de tu app de Meta</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                      Instagram Business Account ID *
                    </label>
                    <input
                      type="text"
                      value={form.igAccountId}
                      onChange={(e) => setForm({ ...form, igAccountId: e.target.value })}
                      placeholder="17841400123456789"
                      className="w-full px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:border-pink-500/50 focus:ring-4 focus:ring-pink-500/5 outline-none transition-all font-mono text-sm text-slate-900 dark:text-white placeholder-slate-400/60"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Lo encuentras en Configuración de Instagram → Configuración de la API</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                      Facebook Page ID *
                    </label>
                    <input
                      type="text"
                      value={form.facebookPageId}
                      onChange={(e) => setForm({ ...form, facebookPageId: e.target.value })}
                      placeholder="123456789012345"
                      className="w-full px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:border-pink-500/50 focus:ring-4 focus:ring-pink-500/5 outline-none transition-all font-mono text-sm text-slate-900 dark:text-white placeholder-slate-400/60"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">La Página de Facebook vinculada a tu cuenta de Instagram</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                      Access Token *
                    </label>
                    <div className="relative">
                      <input
                        type={showToken ? 'text' : 'password'}
                        value={form.accessToken}
                        onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
                        placeholder="EAAxZC..."
                        className="w-full px-4 pr-12 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:border-pink-500/50 focus:ring-4 focus:ring-pink-500/5 outline-none transition-all font-mono text-sm text-slate-900 dark:text-white placeholder-slate-400/60"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Token de acceso largo (Long-lived) con permisos de Instagram</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                      Nombre de display (opcional)
                    </label>
                    <input
                      type="text"
                      value={form.displayName}
                      onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                      placeholder="@tu_usuario"
                      className="w-full px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:border-pink-500/50 focus:ring-4 focus:ring-pink-500/5 outline-none transition-all font-bold text-sm text-slate-900 dark:text-white placeholder-slate-400/60"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    {existingConnection && (
                      <button
                        onClick={() => setShowForm(false)}
                        className="flex-1 h-12 flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      onClick={handleSave}
                      disabled={loading || !form.igAccountId.trim() || !form.facebookPageId.trim() || !form.accessToken.trim()}
                      className="flex-1 h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                      {loading ? <><Loader size="xs" /> Verificando...</> : <><CheckCircle className="w-4 h-4" /> Conectar Instagram</>}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-pink-500/5 border border-pink-500/10 rounded-xl flex items-start gap-3">
                <Info className="w-5 h-5 text-pink-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  El sistema verificará tu token con la Graph API de Meta. Si es válido, se configurará el webhook automáticamente.
                </p>
              </div>
            </div>
          )}

          {/* Modal confirmar desconexión */}
          <Modal
            open={showConfirm}
            onClose={() => setShowConfirm(false)}
            title="Desconectar Instagram"
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
              Los flujos de automatización dejarán de funcionar para Instagram.
            </p>
          </Modal>
        </ConnectionLayout>
      </PageBody>
    </PageContainer>
  );
};
