import { Handle, Position } from '@xyflow/react';
import { UserCheck } from 'lucide-react';

export const HandoffNode = ({ data }: any) => {
  return (
    <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-lg border border-accent-200 dark:border-accent-900/50 w-64 overflow-hidden transition-all hover:shadow-accent-500/10 group node-container">
      <Handle type="target" position={Position.Top} className="!bg-white dark:!bg-slate-700 !border-accent-400 group-hover:!bg-accent-500" />
      <div className="bg-black dark:bg-gray-900 p-4 flex items-center gap-3 rounded-t-2xl">
        <div className="w-9 h-9 bg-accent-500/10 rounded-xl flex items-center justify-center">
          <UserCheck className="w-5 h-5 text-accent-400" />
        </div>
        <div>
          <h3 className="font-black text-[11px] text-white uppercase tracking-widest">Agente Humano</h3>
          <p className="text-[8px] text-accent-400 font-black uppercase tracking-widest leading-none">Transferir</p>
        </div>
      </div>
      <div className="p-4 bg-white dark:bg-gray-950 group-hover:bg-accent-50/30 dark:group-hover:bg-accent-950/20 transition-colors">
        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
          <p className="text-[10px] text-slate-600 dark:text-slate-300 italic leading-relaxed text-center font-bold">
            "{data.message || 'El bot se pausará para que intervenga un humano.'}"
          </p>
        </div>
        <div className="mt-3 flex justify-center">
          <div className="px-3 py-1 bg-red-50 dark:bg-red-500/10 rounded-full border border-red-200 dark:border-red-800/50">
            <span className="text-[8px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest">Pausa Activada</span>
          </div>
        </div>
      </div>
    </div>
  );
};