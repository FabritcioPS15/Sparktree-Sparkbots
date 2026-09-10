import { Handle, Position, useNodesData } from '@xyflow/react';
import { ListPlus } from 'lucide-react';

export const InteractiveNode = ({ id, data: initialData }: any) => {
  const nodeData = useNodesData(id);
  const data = nodeData?.data || initialData;
  const buttons = data.buttons || [];

  return (
    <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-lg border border-accent-200 dark:border-accent-900/50 w-[320px] overflow-hidden transition-all hover:shadow-accent-500/10 group node-container">
      <Handle type="target" position={Position.Top} className="!bg-white dark:!bg-slate-700 !border-accent-400 group-hover:!bg-accent-500" />
      <div className="bg-black dark:bg-gray-900 px-4 py-3 flex items-center gap-2">
        <ListPlus className="w-4 h-4 text-accent-400" />
        <h3 className="font-black text-[10px] text-white uppercase tracking-widest">Botones Interactivos</h3>
      </div>
      <div className="p-4 space-y-3 bg-white dark:bg-gray-950 group-hover:bg-accent-50/30 dark:group-hover:bg-accent-950/20 transition-colors">
        {data.bodyText ? (
          <p className="text-sm text-slate-700 dark:text-slate-200 font-bold leading-relaxed whitespace-pre-wrap break-words">{data.bodyText}</p>
        ) : (
          <p className="text-xs text-slate-400 italic font-medium">Configura el mensaje principal...</p>
        )}
        <div className="space-y-2 pt-1">
          {buttons.map((btn: any, i: number) => (
            <div key={btn.id || `btn-${i}`} className="relative">
              <div className="px-4 py-2.5 bg-accent-50 dark:bg-accent-500/10 border border-accent-200 dark:border-accent-800/50 rounded-xl text-xs font-black text-accent-600 dark:text-accent-300 text-center uppercase tracking-widest">
                {btn.text || btn.title}
              </div>
              <Handle type="source" position={Position.Right} id={btn.id || `btn-${i}`} className="!w-3.5 !h-3.5 !bg-white dark:!bg-slate-700 !border-accent-400 !right-[-7px] !top-1/2 !translate-y-[-50%] group-hover:!bg-accent-500" />
            </div>
          ))}
          {buttons.length === 0 && (
            <div className="py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest italic">Sin botones</span>
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-white dark:!bg-slate-700 !border-accent-400 group-hover:!bg-accent-500" />
    </div>
  );
};