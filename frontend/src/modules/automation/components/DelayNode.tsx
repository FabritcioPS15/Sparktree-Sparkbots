import { Handle, Position } from '@xyflow/react';
import { Clock } from 'lucide-react';

export const DelayNode = ({ data }: any) => {
  const seconds = data.delaySeconds || 3;
  const displayTime = seconds >= 60
    ? `${(seconds / 60).toFixed(1)}m`
    : `${seconds}s`;

  return (
    <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-lg border border-accent-200 dark:border-accent-900/50 w-48 overflow-hidden transition-all hover:shadow-accent-500/10 group node-container">
      <Handle type="target" position={Position.Top} className="!bg-white dark:!bg-slate-700 !border-accent-400 group-hover:!bg-accent-500" />
      <div className="bg-black dark:bg-gray-900 px-4 py-3 flex items-center justify-center gap-2">
        <Clock className="w-4 h-4 text-accent-400" />
        <h3 className="font-black text-[10px] text-white uppercase tracking-widest">Esperar</h3>
      </div>
      <div className="p-6 text-center bg-white dark:bg-gray-950 group-hover:bg-accent-50/30 dark:group-hover:bg-accent-950/20 transition-colors">
        <span className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter">{displayTime}</span>
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-2">Pausa en el flujo</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-white dark:!bg-slate-700 !border-accent-400 group-hover:!bg-accent-500" />
    </div>
  );
};