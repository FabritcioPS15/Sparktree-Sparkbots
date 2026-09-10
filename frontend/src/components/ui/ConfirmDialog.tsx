import { AlertTriangle, Trash2, Info, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Loader } from './Loader';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

const variantIcons = {
  danger: Trash2,
  warning: AlertTriangle,
  info: Info,
};

export const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) => {
  if (!open) return null;

  const Icon = variantIcons[variant];

  const variantStyles = {
    danger: { icon: 'bg-red-500/10 text-red-500', button: 'bg-red-500 hover:bg-red-600 text-white' },
    warning: { icon: 'bg-amber-500/10 text-amber-500', button: 'bg-amber-500 hover:bg-amber-600 text-white' },
    info: { icon: 'bg-accent-500/10 text-accent-500', button: 'bg-accent-500 hover:bg-accent-600 text-black' },
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#242424] w-full max-w-md rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-2xl overflow-hidden relative animate-in zoom-in-95 fade-in duration-200">
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent-500/5 blur-3xl rounded-full -mr-16 -mt-16" />
        <div className="p-8 relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className={cn("p-3 rounded-2xl shadow-lg", variantStyles[variant].icon)}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{title}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-8">{message}</p>
          <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-3.5 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:text-slate-700 transition-colors rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={cn(
                "flex-1 py-3.5 text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg disabled:opacity-50",
                variantStyles[variant].button
              )}
            >
              {isLoading ? <span className="flex items-center justify-center gap-2"><Loader size="xs" /> Procesando...</span> : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
