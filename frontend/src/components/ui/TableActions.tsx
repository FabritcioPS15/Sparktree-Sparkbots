import React from 'react';
import { cn } from '../../utils/cn';

export interface TableAction {
  icon: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  variant?: 'default' | 'danger' | 'accent';
  tooltip?: string;
}

export interface TableActionsProps {
  actions: TableAction[];
  className?: string;
}

const variantStyles = {
  default: 'text-slate-400 hover:text-accent-500 hover:bg-accent-500/10',
  danger: 'text-slate-400 hover:text-red-500 hover:bg-red-500/10',
  accent: 'text-accent-500 hover:bg-accent-500/20',
};

export const TableActions = ({ actions, className }: TableActionsProps) => {
  return (
    <div className={cn("flex items-center justify-end gap-1", className)}>
      {actions.map((action, index) => (
        <button
          key={index}
          onClick={action.onClick}
          title={action.tooltip || action.label}
          className={cn(
            "p-1.5 rounded-lg transition-all",
            variantStyles[action.variant || 'default']
          )}
        >
          {action.icon}
        </button>
      ))}
    </div>
  );
};
