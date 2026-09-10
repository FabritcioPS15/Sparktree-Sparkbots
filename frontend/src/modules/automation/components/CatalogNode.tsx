import { Handle, Position } from '@xyflow/react';
import { Store } from 'lucide-react';

export const CatalogNode = ({ data }: any) => {
  const product = data.selectedProduct;

  return (
    <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-lg border border-accent-200 dark:border-accent-900/50 w-64 overflow-hidden transition-all hover:shadow-accent-500/10 group node-container">
      <Handle type="target" position={Position.Top} className="!bg-white dark:!bg-slate-700 !border-accent-400 group-hover:!bg-accent-500" />
      <div className="bg-black dark:bg-gray-900 px-4 py-3 flex items-center gap-2">
        <Store className="w-4 h-4 text-accent-400" />
        <h3 className="font-black text-[10px] text-white uppercase tracking-widest">Catálogo</h3>
      </div>
      <div className="p-4 bg-white dark:bg-gray-950 group-hover:bg-accent-50/30 dark:group-hover:bg-accent-950/20 transition-colors">
        {product ? (
          <div className="space-y-3">
            {product.media_url && (
              <div className="aspect-video bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700">
                <img src={product.media_url} alt={product.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="text-xs font-black text-slate-900 dark:text-white truncate">{product.title}</div>
            <div className="text-[10px] font-black text-accent-600 dark:text-accent-400 uppercase tracking-widest">${product.price}</div>
            {product.description && (
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium line-clamp-2">{product.description}</div>
            )}
            {data.catalogName && (
              <div className="text-[8px] text-slate-400 font-black uppercase tracking-widest pt-2 border-t border-slate-100 dark:border-slate-800">{data.catalogName}</div>
            )}
          </div>
        ) : (
          <div className="py-8 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            <Store className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest italic">Sin configurar</span>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-white dark:!bg-slate-700 !border-accent-400 group-hover:!bg-accent-500" />
    </div>
  );
};