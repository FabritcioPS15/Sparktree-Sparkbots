import { Handle, Position, useNodesData } from '@xyflow/react';
import { MessageSquare } from 'lucide-react';

export const TextNode = ({ id, data: initialData }: any) => {
  const nodeData = useNodesData(id);
  const data = nodeData?.data || initialData;
  const text = data.text || '';

  return (
    <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-lg border border-accent-200 dark:border-accent-900/50 w-[320px] overflow-hidden transition-all hover:shadow-accent-500/10 group node-container">
      <Handle type="target" position={Position.Top} className="!bg-white dark:!bg-slate-700 !border-accent-400 group-hover:!bg-accent-500" />
      <div className="bg-black dark:bg-gray-900 px-4 py-3 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-accent-400" />
        <h3 className="font-black text-[10px] text-white uppercase tracking-widest">Enviar Mensaje</h3>
      </div>
      <div className="p-4 bg-white dark:bg-gray-950 group-hover:bg-accent-50/30 dark:group-hover:bg-accent-950/20 transition-colors">
        {text ? (
          <p className="text-sm text-slate-700 dark:text-slate-200 font-bold leading-relaxed whitespace-pre-wrap break-words">{text}</p>
        ) : (
          <div className="flex items-center justify-center py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest italic">Sin mensaje</span>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-white dark:!bg-slate-700 !border-accent-400 group-hover:!bg-accent-500" />
    </div>
  );
};