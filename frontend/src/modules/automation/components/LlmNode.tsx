import { Handle, Position } from '@xyflow/react';
import { Sparkles, UserCheck } from 'lucide-react';

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  custom: 'Custom',
};

const MODEL_LABELS: Record<string, string> = {
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'gpt-3.5-turbo': 'GPT-3.5 Turbo',
  'claude-3-opus': 'Claude 3 Opus',
  'claude-3-sonnet': 'Claude 3 Sonnet',
  'claude-3-haiku': 'Claude 3 Haiku',
};

export const LlmNode = ({ data }: any) => {
  const provider = data.provider || '';
  const model = data.model || '';
  const systemPrompt = data.systemPrompt || '';
  const autoHandoff = data.autoHandoff || false;
  const handoffThreshold = data.handoffThreshold ?? 0.6;

  return (
    <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-lg border border-accent-200 dark:border-accent-900/50 w-64 overflow-hidden transition-all hover:shadow-accent-500/10 group node-container">
      <Handle type="target" position={Position.Top} className="!bg-white dark:!bg-slate-700 !border-accent-400 group-hover:!bg-accent-500" />
      <div className="bg-black dark:bg-gray-900 p-4 flex items-center gap-3 rounded-t-2xl">
        <div className="w-9 h-9 bg-accent-500/10 rounded-xl flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-accent-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-[11px] text-white uppercase tracking-widest">IA Completa</h3>
          <p className="text-[8px] text-accent-400 font-black uppercase tracking-widest leading-none">LLM</p>
        </div>
        {autoHandoff && (
          <div className="w-6 h-6 bg-red-500/20 rounded-lg flex items-center justify-center" title={`Auto-escalado al ${Math.round(handoffThreshold * 100)}%`}>
            <UserCheck className="w-3.5 h-3.5 text-red-400" />
          </div>
        )}
      </div>
      <div className="p-4 bg-white dark:bg-gray-950 group-hover:bg-accent-50/30 dark:group-hover:bg-accent-950/20 transition-colors space-y-3">
        {provider ? (
          <>
            <div className="flex items-center justify-between px-3 py-2 bg-accent-50 dark:bg-accent-500/10 rounded-xl border border-accent-200 dark:border-accent-800/50">
              <span className="text-[9px] font-black text-accent-600 dark:text-accent-300 uppercase tracking-wider">
                {PROVIDER_LABELS[provider] || provider}
              </span>
              {model && (
                <span className="text-[8px] font-bold text-accent-500 dark:text-accent-400">
                  {MODEL_LABELS[model] || model}
                </span>
              )}
            </div>
            {systemPrompt && (
              <div className="text-[9px] text-slate-500 dark:text-slate-400 font-medium italic leading-relaxed line-clamp-2 px-1">
                "{systemPrompt.substring(0, 80)}{systemPrompt.length > 80 ? '...' : ''}"
              </div>
            )}
            <div className="flex items-center gap-1 text-[8px] text-slate-400 font-bold">
              <Sparkles className="w-3 h-3 text-accent-400" />
              <span>Temp: {data.temperature || 0.7}</span>
            </div>
            {autoHandoff && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-800/50">
                <UserCheck className="w-3 h-3 text-red-500 shrink-0" />
                <span className="text-[8px] font-black text-red-600 dark:text-red-400 uppercase tracking-tight">
                  Auto-escalado: &lt;{Math.round(handoffThreshold * 100)}% confianza
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest italic">Sin configurar</span>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-white dark:!bg-slate-700 !border-accent-400 group-hover:!bg-accent-500" />
    </div>
  );
};