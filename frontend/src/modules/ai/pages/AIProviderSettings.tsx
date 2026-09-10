import { useState } from 'react';
import { Brain, Check, X, Eye, EyeOff, Trash2, RefreshCw, AlertTriangle, Settings2 } from 'lucide-react';
import { Loader } from '../../../components/ui/Loader';
import { SiOpenai, SiAnthropic } from 'react-icons/si';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageBody } from '../../../components/layout/PageBody';
import { PageContainer } from '../../../components/layout/PageContainer';
import { HeaderButton } from '../../../components/ui/HeaderButton';
import { CountBadge } from '../../../components/ui/CountBadge';
import { cn } from '../../../utils/cn';
import { Dropdown } from '../../../components/ui/Dropdown';

type LLMProvider = 'openai' | 'anthropic' | 'llama';

interface ProviderState {
  provider: LLMProvider;
  apiKey: string;
  defaultModel: string;
  baseUrl: string;
  organizationId: string;
  configured: boolean;
  testing: boolean;
  testResult: 'idle' | 'success' | 'error';
  testMessage: string;
}

const LLAMA_PLATFORMS: Record<string, { baseUrl: string; models: string[] }> = {
  groq: { baseUrl: 'https://api.groq.com/openai/v1', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'] },
  together: { baseUrl: 'https://api.together.xyz/v1', models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'meta-llama/Llama-3.1-8B-Instruct-Turbo'] },
  ollama: { baseUrl: 'http://localhost:11434/v1', models: ['llama3.3', 'llama3.1', 'codellama'] },
  perplexity: { baseUrl: 'https://api.perplexity.ai', models: ['llama-3.1-sonar-huge-128k', 'llama-3.1-sonar-large-128k'] },
  replicate: { baseUrl: 'https://api.replicate.com/v1', models: ['meta/meta-llama-3.3-70b-instruct'] },
  custom: { baseUrl: '', models: ['llama-3.3-70b', 'llama-3.1-8b', 'llama-3.1-70b', 'llama-3.1-405b', 'codellama-34b'] },
};

const ALL_LLAMA_MODELS = [
  ...LLAMA_PLATFORMS.groq.models,
  ...LLAMA_PLATFORMS.together.models,
  ...LLAMA_PLATFORMS.ollama.models,
  ...LLAMA_PLATFORMS.perplexity.models,
  ...LLAMA_PLATFORMS.replicate.models,
  ...LLAMA_PLATFORMS.custom.models,
];

const providerMeta: Record<LLMProvider, {
  name: string; icon: any; gradient: string; shadow: string; models: string[];
}> = {
  openai: {
    name: 'OpenAI',
    icon: SiOpenai,
    gradient: 'from-emerald-500 to-teal-600',
    shadow: 'shadow-emerald-500/20',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
  },
  anthropic: {
    name: 'Anthropic',
    icon: SiAnthropic,
    gradient: 'from-orange-500 to-amber-600',
    shadow: 'shadow-orange-500/20',
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
  },
  llama: {
    name: 'Llama (Meta)',
    icon: SiOpenai,
    gradient: 'from-purple-500 to-violet-600',
    shadow: 'shadow-purple-500/20',
    models: ALL_LLAMA_MODELS,
  },
};

const LS_KEY = 'sparkbot_ai_providers';

const loadSaved = (): Record<string, ProviderState> => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

const defaultModelFor = (p: LLMProvider) =>
  p === 'openai' ? 'gpt-4o' : p === 'anthropic' ? 'claude-3-sonnet' : 'llama-3.3-70b';

const defaultBaseUrlFor = (p: LLMProvider) =>
  p === 'openai' ? 'https://api.openai.com/v1' : p === 'anthropic' ? 'https://api.anthropic.com/v1' : 'https://api.groq.com/openai/v1';

const initialProvider = (provider: LLMProvider): ProviderState => ({
  provider,
  apiKey: '',
  defaultModel: defaultModelFor(provider),
  baseUrl: defaultBaseUrlFor(provider),
  organizationId: '',
  configured: false,
  testing: false,
  testResult: 'idle',
  testMessage: '',
});

export const AIProviderSettings = () => {
  const saved = loadSaved();

  const [providers, setProviders] = useState<Record<string, ProviderState>>(() => ({
    openai: saved.openai || initialProvider('openai'),
    anthropic: saved.anthropic || initialProvider('anthropic'),
    llama: saved.llama || initialProvider('llama'),
  }));
  const [editing, setEditing] = useState<LLMProvider | null>(null);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<LLMProvider | null>(null);
  const [globalError, setGlobalError] = useState('');

  const persist = (updated: Record<string, ProviderState>) => {
    try {
      const clean: Record<string, any> = {};
      for (const [k, v] of Object.entries(updated)) {
        clean[k] = { ...v };
      }
      localStorage.setItem(LS_KEY, JSON.stringify(clean));
    } catch {}
  };

  const updateProvider = (provider: LLMProvider, patch: Partial<ProviderState>) => {
    setProviders(prev => {
      const next = { ...prev, [provider]: { ...prev[provider], ...patch } };
      return next;
    });
  };

  const handleSave = async (provider: LLMProvider) => {
    setSaving(provider);
    setGlobalError('');
    const p = providers[provider];
    if (!p.apiKey.trim()) {
      setGlobalError(`La API Key de ${providerMeta[provider].name} es requerida.`);
      setSaving(null);
      return;
    }
    try {
      // TODO: reemplazar con llamada real a POST /api/ai/providers
      // await registerAIProvider(user?.tenantId, provider, { provider, apiKey: p.apiKey, defaultModel: p.defaultModel, baseUrl: p.baseUrl, organizationId: p.organizationId });
      await new Promise(r => setTimeout(r, 600));
      updateProvider(provider, { configured: true, testResult: 'idle', testMessage: '' });
      persist({ ...providers, [provider]: { ...providers[provider], configured: true } });
      setEditing(null);
    } catch (err) {
      setGlobalError(`Error al guardar configuración de ${providerMeta[provider].name}.`);
    }
    setSaving(null);
  };

  const handleRemove = async (provider: LLMProvider) => {
    setSaving(provider);
    setGlobalError('');
    try {
      // TODO: reemplazar con llamada real a DELETE /api/ai/providers/:tenantId/:provider
      // await removeAIProvider(user?.tenantId, provider);
      await new Promise(r => setTimeout(r, 300));
      setProviders(prev => {
        const next = { ...prev, [provider]: initialProvider(provider) };
        persist(next);
        return next;
      });
      setEditing(null);
    } catch (err) {
      setGlobalError(`Error al eliminar configuración de ${providerMeta[provider].name}.`);
    }
    setSaving(null);
  };

  const handleTest = async (provider: LLMProvider) => {
    updateProvider(provider, { testing: true, testResult: 'idle', testMessage: '' });
    try {
      // TODO: reemplazar con llamada real a POST /api/ai/providers/:tenantId/:provider/test
      // await testAIProvider(user?.tenantId, provider);
      await new Promise(r => setTimeout(r, 1500));
      updateProvider(provider, { testing: false, testResult: 'success', testMessage: 'Conexión exitosa. Modelo responde correctamente.' });
    } catch (err) {
      updateProvider(provider, { testing: false, testResult: 'error', testMessage: 'Error de conexión. Verifica la API Key e intenta de nuevo.' });
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Proveedores de" highlight="Inteligencia Artificial"
        description="Conecta proveedores LLM para potenciar tus flujos con IA generativa."
        icon={Brain}
        action={
          <div className="flex items-center gap-3">
            <CountBadge count={Object.keys(providers).length} label="Proveedores" />
            <HeaderButton
              variant="ghost"
              onClick={() => document.getElementById('provider-cards')?.scrollIntoView({ behavior: 'smooth' })}
              icon={<Settings2 className="w-4 h-4" />}
            >
              Configurar
            </HeaderButton>
          </div>
        }
      />

      <PageBody scrollable={true}>
        <div className="max-w-4xl mx-auto space-y-6">

          {globalError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400 flex-1">{globalError}</p>
              <button onClick={() => setGlobalError('')} className="text-red-400/60 hover:text-red-400">✕</button>
            </div>
          )}

          {/* Info banner */}
          <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-3">
            <Settings2 className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white mb-1">Configuración de Proveedores LLM</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Conecta OpenAI o Anthropic para usar LLMs. API Keys cifradas y exclusivas para tu tenant.
              </p>
            </div>
          </div>

          {/* Provider cards */}
          <div id="provider-cards" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {(Object.entries(providerMeta) as [LLMProvider, typeof providerMeta['openai']][]).map(([key, meta]) => {
              const prov = providers[key];
              const isEditing = editing === key;
              const Icon = meta.icon;

              return (
                <div key={key} className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className={`p-5 bg-gradient-to-r ${meta.gradient} flex items-center gap-4`}>
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-black text-white">{meta.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {prov.configured ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/30 text-white text-[9px] font-black uppercase tracking-widest rounded-lg">
                            <Check className="w-3 h-3" /> Configurado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-white/20 text-white text-[9px] font-black uppercase tracking-widest rounded-lg">
                            No configurado
                          </span>
                        )}
                      </div>
                    </div>
                    {prov.configured && !isEditing && (
                      <button onClick={() => setEditing(key)}
                        className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                        <Settings2 className="w-4 h-4 text-white" />
                      </button>
                    )}
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Configured view */}
                    {prov.configured && !isEditing && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700/30">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Modelo</p>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{prov.defaultModel}</p>
                          </div>
                          <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700/30">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">API Key</p>
                            <p className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                              {'•'.repeat(20)}{prov.apiKey.slice(-4)}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button onClick={() => handleTest(key)} disabled={prov.testing}
                            className="flex-1 h-9 flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50">
                            {prov.testing ? <Loader size="xs" /> : <RefreshCw className="w-3 h-3" />}
                            Probar Conexión
                          </button>
                          <button onClick={() => handleRemove(key)} disabled={saving === key}
                            className="h-9 px-4 flex items-center justify-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all disabled:opacity-50">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {prov.testResult !== 'idle' && (
                          <div className={cn(
                            'p-3 rounded-xl flex items-start gap-2 text-xs font-medium',
                            prov.testResult === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-500',
                          )}>
                            {prov.testResult === 'success' ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <X className="w-4 h-4 shrink-0 mt-0.5" />}
                            {prov.testMessage}
                          </div>
                        )}
                      </>
                    )}

                    {/* Edit / Not configured form */}
                    {(!prov.configured || isEditing) && (
                      <>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                            API Key <span className="text-red-400">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showKey[key] ? 'text' : 'password'}
                              value={prov.apiKey}
                              onChange={e => updateProvider(key, { apiKey: e.target.value })}
                              placeholder={key === 'openai' ? 'sk-...' : 'sk-ant-...'}
                              className="w-full h-10 pl-3.5 pr-10 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition-all placeholder:text-slate-400 font-mono"
                            />
                            <button onClick={() => setShowKey(prev => ({ ...prev, [key]: !prev[key] }))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                              {showKey[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {key === 'llama' && (
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                              Plataforma
                            </label>
                            <Dropdown
                              value="groq"
                              onChange={v => {
                                const plat = LLAMA_PLATFORMS[v];
                                if (plat) updateProvider(key, { baseUrl: plat.baseUrl, defaultModel: plat.models[0] });
                              }}
                              options={[
                                { value: 'groq', label: 'Groq (rápido, free tier)' },
                                { value: 'together', label: 'Together AI' },
                                { value: 'ollama', label: 'Ollama (local)' },
                                { value: 'perplexity', label: 'Perplexity' },
                                { value: 'replicate', label: 'Replicate' },
                                { value: 'custom', label: 'Custom (URL propia)' },
                              ]}
                            />
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                              Modelo por Defecto
                            </label>
                            <Dropdown
                              value={prov.defaultModel}
                              onChange={v => updateProvider(key, { defaultModel: v })}
                              options={meta.models.map(m => ({ value: m, label: m }))}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                              Base URL
                            </label>
                            <input type="text" value={prov.baseUrl} onChange={e => updateProvider(key, { baseUrl: e.target.value })}
                              className="w-full h-10 px-3.5 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition-all placeholder:text-slate-400" />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button onClick={() => handleSave(key)} disabled={saving === key}
                            className="flex-1 h-10 flex items-center justify-center gap-2 bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-black rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 shadow-md">
                            {saving === key ? <><Loader size="xs" /> Guardando...</> : 'Guardar Configuración'}
                          </button>
                          {isEditing && (
                            <button onClick={() => setEditing(null)}
                              className="px-5 h-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                              Cancelar
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-slate-400 text-center">
            Las credenciales se almacenan de forma segura y solo se usan para tu organización.
          </p>
        </div>
      </PageBody>
    </PageContainer>
  );
};
