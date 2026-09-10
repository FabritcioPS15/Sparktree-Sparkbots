import { useState, useEffect, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ExternalLink, ArrowUpRight, ChevronDown, Bot } from 'lucide-react';
import { Loader } from '../../../components/ui/Loader';
import { cn } from '../../../utils/cn';
import { getFlows } from '../../../services/api';

interface ConnectionLayoutProps {
  children: ReactNode;
  sidebar?: ReactNode;
}

export const ConnectionLayout = ({ children, sidebar }: ConnectionLayoutProps) => (
  <div className="flex-1 bg-white dark:bg-dark-card/50 backdrop-blur-md rounded-2xl border border-gray-100 dark:border-gray-800/50 shadow-lg flex flex-col min-h-0">
    <div className="flex-1 p-5 lg:p-6 overflow-y-auto custom-scrollbar">
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 h-full">
        <div className="xl:col-span-3 space-y-4">{children}</div>
        {sidebar && <div className="xl:col-span-2 space-y-4">{sidebar}</div>}
      </div>
    </div>
  </div>
);

interface FormCardProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
}

export const FormCard = ({ icon, title, children, className }: FormCardProps) => (
  <div className={cn("p-5 bg-white dark:bg-slate-900/30 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all duration-300", className)}>
    <div className="flex items-center gap-3 mb-4">
      {icon}
      <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">{title}</h4>
    </div>
    {children}
  </div>
);

interface ConnectedHeroProps {
  icon: ReactNode;
  name: string;
  subtitle: string;
  details?: { label: string; value: string }[];
  onDisconnect: () => void;
  loading?: boolean;
}

export const ConnectedHero = ({ icon, name, subtitle, details, onDisconnect, loading }: ConnectedHeroProps) => (
  <div className="p-5 bg-white dark:bg-slate-900/30 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm">
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
          {icon}
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white dark:border-dark-card">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-black text-slate-900 dark:text-white">{name}</h3>
          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-widest rounded-md">Conectado</span>
        </div>
        <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
      </div>
    </div>

    {details && details.length > 0 && (
      <div className="grid grid-cols-2 gap-2 mb-4">
        {details.map((detail, i) => (
          <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700/30">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{detail.label}</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{detail.value}</p>
          </div>
        ))}
      </div>
    )}

    <button
      onClick={onDisconnect}
      disabled={loading}
      className="w-full h-11 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99]"
    >
      {loading ? 'Desconectando...' : 'Desconectar Conexión'}
    </button>
  </div>
);

interface EcosystemStatusProps {
  platform?: string;
}

const BOT_TYPE_LABELS: Record<string, string> = {
  sales: 'Bot de Ventas',
  support: 'Bot de Soporte',
  marketing: 'Bot de Marketing',
  onboarding: 'Bot de Inducción',
  welcome: 'Bot de Bienvenida',
  other: 'Bot General',
  general: 'Bot General'
};

const BOT_TYPE_COLORS: Record<string, string> = {
  sales: 'bg-accent-500/10 text-accent-500 border-accent-500/20',
  support: 'bg-accent-500/10 text-accent-500 border-accent-500/20',
  marketing: 'bg-accent-500/10 text-accent-500 border-accent-500/20',
  onboarding: 'bg-accent-500/10 text-accent-500 border-accent-500/20',
  welcome: 'bg-accent-500/10 text-accent-500 border-accent-500/20',
  other: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  general: 'bg-slate-500/10 text-slate-500 border-slate-500/20'
};

export const EcosystemStatus = ({ platform }: EcosystemStatusProps) => {
  const [flows, setFlows] = useState<any[]>([]);
  const [flowsLoading, setFlowsLoading] = useState(false);

  useEffect(() => {
    if (!platform) return;
    const loadFlows = async () => {
      setFlowsLoading(true);
      try {
        const data = await getFlows();
        const allFlows = Array.isArray(data) ? data : [];
        setFlows(allFlows.filter((f: any) => f.status === 'active'));
      } catch (err) {
        console.error('Error loading flows:', err);
      } finally {
        setFlowsLoading(false);
      }
    };
    loadFlows();
  }, [platform]);

  const activeFlows = flows.filter((f: any) => f.status === 'active');
  const activeBotTypes = activeFlows
    .map((f: any) => BOT_TYPE_LABELS[f.category] || BOT_TYPE_LABELS.other)
    .filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i);

  return (
    <div className="p-4 bg-white dark:bg-slate-900/30 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 bg-gradient-to-br from-accent-500 to-accent-600 rounded-xl shadow-lg shadow-accent-500/20">
          <Activity className="w-4 h-4 text-white" />
        </div>
        <div>
          <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Automatización activa:</h4>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{platform || 'Integrada'}</p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {activeBotTypes.map((label, i) => (
          <div key={i} className="flex items-center gap-2.5 p-2.5 bg-accent-50 dark:bg-accent-500/10 rounded-xl border border-accent-200 dark:border-accent-500/20">
            <div className="relative">
              <div className="p-1.5 bg-accent-500/10 rounded-lg">
                <Bot className="w-4 h-4 text-accent-500" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent-500 rounded-full animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-slate-900 dark:text-white truncate">{label}</p>
            </div>
            <span className="px-2 py-0.5 bg-accent-500 text-black text-[8px] font-black uppercase tracking-wider rounded-md">Activo</span>
          </div>
        ))}
        {activeBotTypes.length === 0 && (
          <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700/30">
            <div className="p-1.5 bg-slate-500/10 rounded-lg">
              <Bot className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">Bot General</p>
            </div>
            <span className="px-2 py-0.5 bg-slate-500/10 text-slate-500 text-[8px] font-black uppercase tracking-wider rounded-md">Inactivo</span>
          </div>
        )}
      </div>

      {flowsLoading ? (
        <div className="flex justify-center py-3"><Loader size="sm" /></div>
      ) : activeFlows.length > 0 ? (
        <div className="mb-4 space-y-2">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Flujos activos</p>
          {activeFlows.map((flow: any) => (
            <Link key={flow.id || flow._id} to="/flow-manager"
              className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700/30 hover:border-accent-500/30 transition-all group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{flow.name}</p>
                <p className="text-[9px] text-slate-400 truncate">{flow.description}</p>
              </div>
              <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border ${BOT_TYPE_COLORS[flow.category] || BOT_TYPE_COLORS.other}`}>
                {BOT_TYPE_LABELS[flow.category]?.replace('Bot de ', '').replace('Bot ', '') || 'General'}
              </span>
              <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-accent-500 transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          <Link to="/flow-manager" className="block">
            <div className="flex items-start gap-3 p-3.5 bg-accent-500/5 rounded-xl border border-accent-500/10 hover:border-accent-500/30 hover:bg-accent-500/10 transition-all cursor-pointer group">
              <div className="w-6 h-6 shrink-0 bg-gradient-to-br from-accent-500 to-accent-600 text-white text-[10px] font-black rounded-lg flex items-center justify-center">01</div>
              <div className="flex-1">
                <p className="font-black text-slate-900 dark:text-white text-xs uppercase mb-0.5">Sin flujos activos</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">Crea un flujo en el Constructor para activar esta conexión.</p>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-accent-500 transition-colors shrink-0 mt-1" />
            </div>
          </Link>
        </div>
      )}

      <Link to="/flow-manager"
        className="flex items-center justify-center gap-2 w-full h-10 bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-black rounded-xl font-black text-[10px] uppercase tracking-widest transition-all hover:scale-[1.01] active:scale-[0.99]"
      >
        Ir al Constructor
        <ArrowUpRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
};

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  hint?: string;
  multiline?: boolean;
}

export const InputField = ({ label, value, onChange, placeholder, type = 'text', required, hint, multiline }: InputFieldProps) => {
  const inputClass = "w-full px-4 py-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition-all placeholder:text-slate-400";

  return (
    <div>
      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={`${inputClass} resize-none font-mono text-xs`}
          required={required}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClass}
          required={required}
        />
      )}
      {hint && <p className="text-[10px] text-slate-500 mt-1.5">{hint}</p>}
    </div>
  );
};

interface HelpCardProps {
  title: string;
  steps: string[];
  docUrl?: string;
  docLabel?: string;
  variant?: 'accent' | 'blue' | 'pink' | 'gray';
}

export const HelpCard = ({ title, steps, docUrl, docLabel, variant = 'accent' }: HelpCardProps) => {
  const [open, setOpen] = useState(false);
  const cardClass = variant === 'blue'
    ? 'bg-blue-500/5 border-blue-500/10'
    : variant === 'pink'
      ? 'bg-pink-500/5 border-pink-500/10'
      : variant === 'gray'
        ? 'bg-gray-500/5 border-gray-500/10'
        : 'bg-accent-500/5 border-accent-500/10';

  const linkClass = variant === 'blue'
    ? 'text-blue-500 hover:text-blue-400'
    : variant === 'pink'
      ? 'text-pink-500 hover:text-pink-400'
      : variant === 'gray'
        ? 'text-gray-500 hover:text-gray-400'
        : 'text-accent-500 hover:text-accent-400';

  return (
    <div className={`${cardClass} rounded-2xl border overflow-hidden`}>
      <button onClick={() => setOpen(!open)} className="w-full p-3.5 flex items-center justify-between gap-3 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
        <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
          <span className="text-base">📋</span> {title}
        </h4>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`transition-all duration-300 overflow-hidden ${open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-3.5 pb-3.5">
          <ol className="space-y-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed list-decimal list-inside">
            {steps.map((step, i) => (
              <li key={i} className="text-slate-600 dark:text-slate-400">{step}</li>
            ))}
          </ol>
          {docUrl && (
            <a href={docUrl} target="_blank" rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 text-xs ${linkClass} font-semibold mt-3 transition-colors`}>
              {docLabel || 'Ver documentación oficial'}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

interface ErrorBannerProps {
  message: string;
  onClose?: () => void;
}

export const ErrorBanner = ({ message, onClose }: ErrorBannerProps) => (
  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
    <div className="w-5 h-5 shrink-0 bg-red-500/20 rounded-full flex items-center justify-center">
      <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
    <p className="text-sm text-red-400 flex-1">{message}</p>
    {onClose && (
      <button onClick={onClose} className="text-red-400/60 hover:text-red-400 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    )}
  </div>
);

export const SuccessBanner = ({ message }: { message: string }) => (
  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
    <div className="w-5 h-5 shrink-0 bg-emerald-500/20 rounded-full flex items-center justify-center">
      <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
    <p className="text-sm text-emerald-400">{message}</p>
  </div>
);
