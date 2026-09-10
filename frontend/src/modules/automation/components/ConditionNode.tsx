import { Handle, Position } from '@xyflow/react';
import { GitBranch } from 'lucide-react';

export const ConditionNode = ({ data }: any) => {
  const variable = data.variable || '';
  const operator = data.operator || 'exists';
  const value = data.value || '';
  const label = data.conditionLabel || '';

  const operatorLabel: Record<string, string> = {
    exists: 'existe',
    equals: '==',
    notEquals: '!=',
    contains: 'contiene',
    greaterThan: '>',
    lessThan: '<',
    empty: 'vacío',
  };

  return (
    <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-lg border border-accent-200 dark:border-accent-900/50 w-64 overflow-hidden transition-all hover:shadow-accent-500/10 group node-container">
      <Handle type="target" position={Position.Top} className="!bg-white dark:!bg-slate-700 !border-accent-400 group-hover:!bg-accent-500" />
      <div className="bg-black dark:bg-gray-900 p-4 flex items-center gap-3 rounded-t-2xl">
        <div className="w-9 h-9 bg-accent-500/10 rounded-xl flex items-center justify-center">
          <GitBranch className="w-5 h-5 text-accent-400" />
        </div>
        <div>
          <h3 className="font-black text-[11px] text-white uppercase tracking-widest">Condición</h3>
          <p className="text-[8px] text-accent-400 font-black uppercase tracking-widest leading-none">Si / Entonces</p>
        </div>
      </div>
      <div className="p-4 space-y-3 bg-white dark:bg-gray-950 group-hover:bg-accent-50/30 dark:group-hover:bg-accent-950/20 transition-colors">
        {variable ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-accent-50 dark:bg-accent-500/10 rounded-xl border border-accent-200 dark:border-accent-800/50">
            <span className="text-[10px] font-black text-accent-600 dark:text-accent-300 uppercase tracking-wider">
              @{variable} {operatorLabel[operator] || operator} {value ? `"${value}"` : ''}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest italic">Sin configurar</span>
          </div>
        )}
        {label && (
          <div className="text-[9px] text-slate-500 dark:text-slate-400 font-bold text-center italic">{label}</div>
        )}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Sí</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="text-[8px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">No</span>
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} id="true" className="!left-8 !bg-white dark:!bg-slate-700 !border-emerald-400 group-hover:!bg-emerald-500" />
      <Handle type="source" position={Position.Bottom} id="false" className="!right-8 !left-auto !bg-white dark:!bg-slate-700 !border-rose-400 group-hover:!bg-rose-500" />
    </div>
  );
};