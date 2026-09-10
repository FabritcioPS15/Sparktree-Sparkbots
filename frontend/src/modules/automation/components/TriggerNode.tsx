import { Handle, Position } from '@xyflow/react';
import { Zap } from 'lucide-react';

export const TriggerNode = ({ data }: any) => {
  return (
    <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-lg border border-accent-200 dark:border-accent-900/50 w-64 overflow-hidden transition-all hover:shadow-accent-500/10 group node-container">
      <Handle type="source" position={Position.Bottom} className="!bg-white dark:!bg-slate-700 !border-accent-400 group-hover:!bg-accent-500" />
      <div className="bg-black dark:bg-gray-900 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-accent-400" />
          <h3 className="font-black text-[10px] text-white uppercase tracking-widest">Disparador</h3>
        </div>
        <div className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse" />
      </div>
      <div className="p-4 bg-white dark:bg-gray-950 group-hover:bg-accent-50/30 dark:group-hover:bg-accent-950/20 transition-colors">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2.5 block">Palabras Clave</label>
        <div className="flex flex-wrap gap-1.5">
          {data.keywords && data.keywords.length > 0 ? (
            data.keywords.map((kw: string, i: number) => (
              <span key={i} className="px-2.5 py-1 bg-accent-50 dark:bg-accent-500/10 text-[9px] font-black text-accent-600 dark:text-accent-300 rounded-lg border border-accent-200 dark:border-accent-800/50 uppercase tracking-tight">
                {kw}
              </span>
            ))
          ) : (
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest italic">Sin configurar</span>
          )}
        </div>
      </div>
    </div>
  );
};