import { List, LayoutGrid } from 'lucide-react';
import { cn } from '../../utils/cn';

export type ViewMode = 'table' | 'grid';

export interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

export const ViewToggle = ({ value, onChange, className }: ViewToggleProps) => {
  return (
    <div className={cn("flex items-center dark:bg-dark-card rounded-xl p-1 border border-gray-200 dark:border-white/5", className)}>
      <button
        type="button"
        onClick={() => onChange('table')}
        className={cn(
          "p-1.5 rounded-lg transition-all",
          value === 'table'
            ? 'bg-white dark:bg-white/10 shadow-sm text-accent-500'
            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
        )}
        title="Vista de Tabla"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange('grid')}
        className={cn(
          "p-1.5 rounded-lg transition-all",
          value === 'grid'
            ? 'bg-white dark:bg-white/10 shadow-sm text-accent-500'
            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
        )}
        title="Vista de Cuadrícula"
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
    </div>
  );
};
