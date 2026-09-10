import { Handle, Position, useNodesData } from '@xyflow/react';
import { Phone } from 'lucide-react';

export const CapturePhoneNode = ({ id, data: initialData }: any) => {
  const nodeData = useNodesData(id);
  const data = nodeData?.data || initialData;

  return (
    <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-lg border border-accent-200 dark:border-accent-900/50 w-[320px] overflow-hidden transition-all hover:shadow-accent-500/10 group node-container">
      <Handle type="target" position={Position.Top} className="!bg-white dark:!bg-slate-700 !border-accent-400 group-hover:!bg-accent-500" />
      <div className="bg-black dark:bg-gray-900 px-4 py-3 flex items-center gap-2">
        <Phone className="w-4 h-4 text-accent-400" />
        <h3 className="font-black text-[10px] text-white uppercase tracking-widest">Capturar Celular</h3>
      </div>
      <div className="p-4 space-y-3 bg-white dark:bg-gray-950 group-hover:bg-accent-50/30 dark:group-hover:bg-accent-950/20 transition-colors">
        {data.question ? (
          <p className="text-sm text-slate-700 dark:text-slate-200 font-bold leading-relaxed whitespace-pre-wrap">{data.question}</p>
        ) : (
          <div className="flex items-center justify-center py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest italic">Configura el mensaje...</span>
          </div>
        )}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[8px] font-black bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400 px-2 py-0.5 rounded border border-accent-200 dark:border-accent-800/50 uppercase tracking-wider">
            Se guarda en @telefono
          </span>
          <span className="text-[8px] font-black bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400 px-2 py-0.5 rounded border border-accent-200 dark:border-accent-800/50 uppercase tracking-wider">
            Validación automática
          </span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-white dark:!bg-slate-700 !border-accent-400 group-hover:!bg-accent-500" />
    </div>
  );
};