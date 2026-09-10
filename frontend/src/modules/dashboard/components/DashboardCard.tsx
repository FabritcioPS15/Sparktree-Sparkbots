import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '../../../utils/cn';

interface DashboardCardProps extends Omit<HTMLMotionProps<"div">, "title"> {
  children?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  loading?: boolean;
  noPadding?: boolean;
  className?: string;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  subtitle,
  icon,
  action,
  footer,
  loading = false,
  noPadding = false,
  className,
  children,
  ...props
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "card-panel flex flex-col relative overflow-hidden group",
        className
      )}
      {...props}
    >
      {/* Glossy gradient overlay for premium feel */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/[0.02] dark:to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      
      {loading ? (
        <div className="p-6 space-y-4 animate-pulse">
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
          <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
        </div>
      ) : (
        <>
          {(title || icon || action) && (
            <div className="px-6 pt-6 pb-4 flex items-center justify-between z-10 relative">
              <div className="flex items-center gap-3">
                {icon && (
                  <div className="p-2 bg-slate-100 dark:bg-slate-800/50 rounded-xl text-slate-500 dark:text-slate-400">
                    {icon}
                  </div>
                )}
                <div>
                  {title && <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">{title}</h3>}
                  {subtitle && <p className="text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p>}
                </div>
              </div>
              {action && <div>{action}</div>}
            </div>
          )}

          <div className={cn("flex-1 z-10 relative", !noPadding && "px-6 pb-6 pt-2")}>
            {children}
          </div>

          {footer && (
            <div className="px-6 py-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-800/20 z-10 relative">
              {footer}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};
