import { Handle, Position } from '@xyflow/react';
import { Library } from 'lucide-react';

export const KnowledgeRetrievalNode = ({ data }: any) => {
  const kbName = data.knowledgeBaseName || '';
  const queryTemplate = data.queryTemplate || '';
  const topK = data.topK || 3;

  return (
    <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-lg border border-accent-200 dark:border-accent-900/50 w-64 overflow-hidden transition-all hover:shadow-accent-500/10 group node-container">
      <Handle type="target" position={Position.Top} className="!bg-white dark:!bg-slate-700 !border-accent-400 group-hover:!bg-accent-500" />
      <div className="bg-black dark:bg-gray-900 p-4 flex items-center gap-3 rounded-t-2xl">
        <div className="w-9 h-9 bg-accent-500/10 rounded-xl flex items-center justify-center">
          <Library className="w-5 h-5 text-accent-400" />
        </div>
        <div>
          <h3 className="font-black text-[11px] text-white uppercase tracking-widest">Base de Conocimiento</h3>
          <p className="text-[8px] text-accent-400 font-black uppercase tracking-widest leading-none">RAG</p>
        </div>
      </div>
      <div className="p-4 bg-white dark:bg-gray-950 group-hover:bg-accent-50/30 dark:group-hover:bg-accent-950/20 transition-colors space-y-3">
        {kbName ? (
          <>
            <div className="flex items-center gap-2 px-3 py-2 bg-accent-50 dark:bg-accent-500/10 rounded-xl border border-accent-200 dark:border-accent-800/50">
              <Library className="w-3.5 h-3.5 text-accent-500 shrink-0" />
              <span className="text-[9px] font-black text-accent-600 dark:text-accent-300 uppercase tracking-wider truncate">
                {kbName}
              </span>
            </div>
            {queryTemplate && (
              <div className="text-[9px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed px-1">
                Query: <span className="font-bold italic">"{queryTemplate.substring(0, 60)}{queryTemplate.length > 60 ? '...' : ''}"</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-[8px] text-slate-400 font-bold">
              <span>Top {topK} resultados</span>
              {data.minSimilarity && (
                <span>· min {Math.round((data.minSimilarity || 0.7) * 100)}%</span>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest italic">Sin KB asignada</span>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-white dark:!bg-slate-700 !border-accent-400 group-hover:!bg-accent-500" />
    </div>
  );
};