import { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { MessageCircle, Mail, Lock, ArrowRight, Info, Sparkles, CheckCircle2, Shield, UserCog, Building2, Terminal, Zap } from 'lucide-react';
import { Loader } from '../../../components/ui/Loader';
import { login } from '../../../services/api';

const HOME_BY_ROLE: Record<string, string> = {
  super_admin: '/superadmin/companies',
  admin: '/',
  empresa: '/',
  staff: '/',
  agent: '/conversations',
};

const QUICK_ACCOUNTS = [
  { label: 'Super Administrador', role: 'Super Admin', email: 'admin+fabpsandoval@gmail.com', icon: Shield, color: 'text-purple-400', bg: 'bg-purple-500/10', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  { label: 'Administrador Staff', role: 'Staff', email: 'staff+fabpsandoval@gmail.com', icon: UserCog, color: 'text-amber-400', bg: 'bg-amber-500/10', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  { label: 'Empresa Demo', role: 'Empresa', email: 'empresa@demo.com', icon: Building2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { label: 'Admin Local', role: 'Admin', email: 'admin@localhost', icon: Terminal, color: 'text-sky-400', bg: 'bg-sky-500/10', badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
];

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quickAccount, setQuickAccount] = useState('');

  const { login: setAuthSession } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const data = await login(email, password);
      setAuthSession(data.user, data.organizationId);
      navigate(HOME_BY_ROLE[data.user.role] || '/');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Credenciales inválidas. Por favor intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (accEmail: string) => {
    setIsLoading(true);
    setQuickAccount(accEmail);
    setError('');

    try {
      const data = await login(accEmail, 'admin123');
      setAuthSession(data.user, data.organizationId);
      navigate(HOME_BY_ROLE[data.user.role] || '/');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Error al iniciar sesión rápida.');
    } finally {
      setIsLoading(false);
      setQuickAccount('');
    }
  };

  return (
    <div className="min-h-screen flex bg-[#252525] selection:bg-primary-500/30 overflow-hidden">
      {/* Left Side: Brand & Visuals */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-12 overflow-hidden border-r border-white/5">
        {/* Background Glows */}
        <div className="absolute top-[-20%] left-[-10%] w-[100%] h-[100%] bg-primary-900/10 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[100%] h-[100%] bg-accent-900/10 blur-[150px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />

        <div className="relative z-10 w-full max-w-md space-y-16">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md mb-4 shadow-xl shadow-primary-500/5">
              <MessageCircle className="w-6 h-6 text-primary-400" />
              <span className="text-white font-bold tracking-tight">SparkBot</span>
            </div>

            <div className="space-y-6">
              <h2 className="text-5xl font-bold text-white leading-tight tracking-tight">
                Lleva tu atención al <br />
                <span className="inline-block pb-1 pr-6 text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400 italic">siguiente nivel</span>
              </h2>
              <p className="text-lg text-gray-400 leading-relaxed font-medium">
                La plataforma de automatización multi-agente diseñada para escalar tus operaciones de WhatsApp.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl backdrop-blur-sm group hover:bg-white/[0.04] transition-all duration-500">
              <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Sparkles className="w-5 h-5 text-primary-400" />
              </div>
              <p className="text-sm font-bold text-white">Flujos Inteligentes</p>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">Automatiza el 70% de tus consultas comunes sin esfuerzo.</p>
            </div>
            <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl backdrop-blur-sm group hover:bg-white/[0.04] transition-all duration-500">
              <div className="w-10 h-10 rounded-xl bg-accent-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-5 h-5 text-accent-400" />
              </div>
              <p className="text-sm font-bold text-white">Multi-Usuario</p>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">Colabora con todo tu equipo en tiempo real de forma segura.</p>
            </div>
          </div>
        </div>

        {/* Footer info Left Side */}
        <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-8 text-[10px] font-bold text-gray-600 uppercase tracking-widest pointer-events-none">
          <span>© 2024 SPARKBOT TECH</span>
          <span className="w-1 h-1 bg-gray-800 rounded-full" />
          <span>SaaS Platform V4.2.0-PRO</span>
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 relative overflow-y-auto">
        {/* Mobile/Side Background Glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary-900/10 blur-[100px] rounded-full opacity-50" />
        </div>

        <div className="w-full max-w-lg relative z-10 py-10">
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex p-3 bg-primary-600/10 rounded-2xl border border-primary-500/20 mb-4">
              <MessageCircle className="w-8 h-8 text-primary-400" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">SparkBot</h1>
          </div>

          <div className="space-y-3 mb-8 text-center lg:text-left">
            <h1 className="text-3xl font-bold text-white tracking-tight">Iniciar sesión</h1>
            <p className="text-gray-500 text-sm font-medium leading-relaxed">Bienvenido de nuevo. Gestiona tus comunicaciones de manera centralizada.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2 focus-within:translate-x-1 transition-transform duration-300">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest ml-1">Email Corporativo</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-primary-400 transition-colors" />
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-white/[0.03] border border-white/5 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/50 outline-none transition-all text-white text-sm placeholder:text-gray-600 font-medium"
                  placeholder="nombre@empresa.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2 focus-within:translate-x-1 transition-transform duration-300">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Contraseña</label>
                <Link to="/recover-password" className="text-[10px] text-primary-400 hover:text-primary-300 font-bold transition-colors">¿Olvidaste tu contraseña?</Link>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-primary-400 transition-colors" />
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-white/[0.03] border border-white/5 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/50 outline-none transition-all text-white text-sm placeholder:text-gray-600 font-medium"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-500/5 border border-red-500/10 rounded-xl text-red-500 text-[13px] font-bold animate-in slide-in-from-top-1">
                <Info className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              disabled={isLoading}
              className="w-full py-4 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-primary-600/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group mt-4 relative overflow-hidden"
            >
              {isLoading && !quickAccount ? (
                <Loader size="sm" />
              ) : (
                <>
                  <span className="relative z-10">Acceder al Panel</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform relative z-10" />
                </>
              )}
            </button>
          </form>

          {/* Quick Access */}
          <div className="mt-8 pt-8 border-t border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-3.5 h-3.5 text-primary-400" />
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Acceso rápido</p>
            </div>
            <p className="text-[11px] text-gray-600 mb-4">Entra con un click a cada perfil de demostración.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {QUICK_ACCOUNTS.map((acc) => {
                const Icon = acc.icon;
                const loadingThis = isLoading && quickAccount === acc.email;
                return (
                  <button
                    key={acc.email}
                    onClick={() => handleQuickLogin(acc.email)}
                    disabled={isLoading}
                    className="group flex items-center gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-xl hover:bg-white/[0.06] hover:border-white/15 transition-all text-left active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${acc.bg}`}>
                      {loadingThis ? <Loader size="sm" /> : <Icon className={`w-5 h-5 ${acc.color}`} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white truncate">{acc.label}</span>
                      </div>
                      <span className="text-[10px] text-gray-500 font-medium truncate block">{acc.email}</span>
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${acc.badge}`}>{acc.role}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Register Link */}
          <div className="mt-8 text-center">
            <p className="text-gray-500 text-sm">
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="text-primary-400 hover:text-primary-300 font-bold transition-colors">
                Crear cuenta
              </Link>
            </p>
          </div>

          <p className="text-center text-gray-500 text-[11px] mt-8 font-bold uppercase tracking-wider">
            SparkBot Tech Hub © 2024
          </p>
        </div>
      </div>
    </div>
  );
};
