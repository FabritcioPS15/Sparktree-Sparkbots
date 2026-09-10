import { Handle, Position, useNodesData } from '@xyflow/react';
import { CheckCircle2 } from 'lucide-react';

export const ConfirmationNode = ({ id, data: initialData }: any) => {
  const nodeData = useNodesData(id);
  const data = nodeData?.data || initialData;
  const question = data.bodyText || data.question || '¿Confirmas esta acción?';
  const yesLabel = data.yesLabel || '✅ Sí';
  const noLabel = data.noLabel || '❌ No';

  return (
    <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-lg border border-accent-200 dark:border-accent-900/50 w-[320px] overflow-hidden transition-all hover:shadow-accent-500/10 group node-container">
      <Handle type="target" position={Position.Top} className="!bg-white dark:!bg-slate-700 !border-accent-400 group-hover:!bg-accent-500" />
      <div className="bg-black dark:bg-gray-900 px-4 py-3 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-accent-400" />
        <h3 className="font-black text-[10px] text-white uppercase tracking-widest">Confirmación</h3>
      </div>
      <div className="p-4 space-y-3 bg-white dark:bg-gray-950 group-hover:bg-accent-50/30 dark:group-hover:bg-accent-950/20 transition-colors">
        {question ? (
          <p className="text-sm text-slate-700 dark:text-slate-200 font-bold leading-relaxed whitespace-pre-wrap break-words">{question}</p>
        ) : (
          <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest italic">Sin configurar</span>
        )}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="relative">
            <div className="px-3 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-xs font-black text-emerald-600 dark:text-emerald-400 text-center uppercase tracking-widest">
              {yesLabel}
            </div>
            <Handle
              type="source"
              position={Position.Bottom}
              id="confirm_yes"
              className="!left-1/4 !right-auto !bg-white dark:!bg-slate-700 !border-emerald-400 group-hover:!bg-emerald-500"
            />
          </div>
          <div className="relative">
            <div className="px-3 py-2.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-800/50 rounded-xl text-xs font-black text-rose-600 dark:text-rose-400 text-center uppercase tracking-widest">
              {noLabel}
            </div>
            <Handle
              type="source"
              position={Position.Bottom}
              id="confirm_no"
              className="!left-3/4 !right-auto !bg-white dark:!bg-slate-700 !border-rose-400 group-hover:!bg-rose-500"
            />
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-white dark:!bg-slate-700 !border-accent-400 group-hover:!bg-accent-500" />
    </div>
  );
};