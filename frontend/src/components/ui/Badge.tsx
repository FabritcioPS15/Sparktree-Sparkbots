import React from 'react';
import { cn } from '../../utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'xs' | 'sm' | 'md';
  shape?: 'pill' | 'rounded' | 'square';
  icon?: React.ReactNode;
  dot?: boolean;
  dotColor?: string;
}

const variantStyles: Record<string, string> = {
  default: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  primary: 'bg-accent-500/10 text-accent-600 dark:text-accent-400 border border-accent-500/20',
  success: 'bg-[rgb(var(--badge-success)/0.12)] text-[rgb(var(--badge-success))] dark:text-[rgb(var(--badge-success))] border border-[rgb(var(--badge-success)/0.25)]',
  warning: 'bg-[rgb(var(--badge-warning)/0.12)] text-[rgb(var(--badge-warning))] dark:text-[rgb(var(--badge-warning))] border border-[rgb(var(--badge-warning)/0.25)]',
  danger: 'bg-[rgb(var(--badge-danger)/0.12)] text-[rgb(var(--badge-danger))] dark:text-[rgb(var(--badge-danger))] border border-[rgb(var(--badge-danger)/0.25)]',
  info: 'bg-[rgb(var(--badge-info)/0.12)] text-[rgb(var(--badge-info))] dark:text-[rgb(var(--badge-info))] border border-[rgb(var(--badge-info)/0.25)]',
};

const sizeStyles: Record<string, string> = {
  xs: 'px-1.5 py-0.5 text-[8px]',
  sm: 'px-2 py-0.5 text-[9px]',
  md: 'px-2.5 py-1 text-[10px]',
};

const shapeStyles: Record<string, string> = {
  pill: 'rounded-full',
  rounded: 'rounded-lg',
  square: 'rounded-md',
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'sm', shape = 'pill', icon, dot, dotColor, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-1 font-black uppercase tracking-widest leading-none',
          sizeStyles[size],
          shapeStyles[shape],
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor || 'bg-current')}
            style={dotColor && !dotColor.startsWith('bg-') ? { backgroundColor: dotColor } : undefined}
          />
        )}
        {icon}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
