import { Handle, Position } from '@xyflow/react';
import { Mail } from 'lucide-react';

export const EmailNode = ({ data }: any) => {
  return (
    <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-lg border border-accent-200 dark:border-accent-900/50 w-64 overflow-hidden transition-all hover:shadow-accent-500/10 group node-container">
      <Handle type="target" position={Position.Top} className="!bg-white dark:!bg-slate-700 !border-accent-400 group-hover:!bg-accent-500" />
      <div className="bg-black dark:bg-gray-900 px-4 py-3 flex items-center gap-2">
        <Mail className="w-4 h-4 text-accent-400" />
        <h3 className="font-black text-[10px] text-white uppercase tracking-widest">Enviar Correo</h3>
      </div>
      <div className="p-4 bg-white dark:bg-gray-950 group-hover:bg-accent-50/30 dark:group-hover:bg-accent-950/20 transition-colors">
        {data.toEmail ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-black text-accent-500 uppercase tracking-widest">Para:</span>
              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">{data.toEmail}</span>
            </div>
            {data.subject && (
              <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate italic">
                {data.subject}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest italic">Sin Destinatario</span>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-white dark:!bg-slate-700 !border-accent-400 group-hover:!bg-accent-500" />
    </div>
  );
};