import { Handle, Position } from '@xyflow/react';
import { Webhook } from 'lucide-react';

export const WebhookNode = ({ data }: any) => {
  return (
    <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-lg border border-accent-200 dark:border-accent-900/50 w-64 overflow-hidden transition-all hover:shadow-accent-500/10 group node-container">
      <Handle type="target" position={Position.Top} className="!bg-white dark:!bg-slate-700 !border-accent-400 group-hover:!bg-accent-500" />
      <div className="bg-black dark:bg-gray-900 px-4 py-3 flex items-center gap-2">
        <Webhook className="w-4 h-4 text-accent-400" />
        <h3 className="font-black text-[10px] text-white uppercase tracking-widest">Webhook / API</h3>
      </div>
      <div className="p-4 bg-white dark:bg-gray-950 group-hover:bg-accent-50/30 dark:group-hover:bg-accent-950/20 transition-colors">
        {data.url ? (
          <div className="space-y-2">
            <span className="inline-block px-2 py-0.5 bg-accent-50 dark:bg-accent-500/10 text-[8px] font-black text-accent-600 dark:text-accent-400 rounded-lg border border-accent-200 dark:border-accent-800/50 uppercase tracking-widest">
              {data.method || 'POST'}
            </span>
            <div className="text-[10px] font-mono text-slate-600 dark:text-slate-300 font-bold truncate bg-slate-50 dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700">
              {data.url}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest italic">Sin URL</span>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-white dark:!bg-slate-700 !border-accent-400 group-hover:!bg-accent-500" />
    </div>
  );
};