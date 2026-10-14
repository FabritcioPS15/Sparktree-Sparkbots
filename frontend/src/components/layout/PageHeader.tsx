import React from 'react';
import { BannerPattern } from './BannerPattern';

interface PageHeaderMeta {
  label: string;
  value: string | number;
  icon?: any;
  color?: 'accent' | 'emerald' | 'blue' | 'amber' | 'violet' | 'red';
}

interface PageHeaderProps {
  title: string;
  highlight?: React.ReactNode;
  description: string;
  icon?: any;
  action?: React.ReactNode;
  meta?: PageHeaderMeta[];
}

const pillColors: Record<string, string> = {
  accent: 'bg-accent-500/10 text-accent-600 dark:text-accent-400 border border-accent-500/20',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20',
  red: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
};

export const PageHeader = ({ title, highlight, description, icon: Icon, action, meta }: PageHeaderProps) => {
  return (
    <div className="-mx-4 md:-mx-6 mb-5">
      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-[#0a0a0a] px-6 md:px-10 py-4 md:py-5 overflow-hidden border-b border-slate-100 dark:border-slate-800/40 shadow-sm">
        
        {/* Diamond pattern background */}
        <BannerPattern className="absolute inset-0 pointer-events-none" />

        {/* Left accent bar */}
        <div className="absolute left-0 top-2 bottom-2 w-1.5 bg-gradient-to-b from-accent-500 via-accent-500/70 to-accent-500/20 rounded-r-full" />

        <div className="flex items-center gap-4 relative z-10 min-w-0">
          {Icon && (
            <div className="hidden sm:flex p-2.5 bg-accent-500/15 rounded-xl text-accent-500 dark:text-accent-400 border border-accent-500/30 dark:border-accent-500/20 shadow-lg shadow-accent-500/25 shrink-0">
              <Icon className="w-5 h-5" strokeWidth={1.5} />
            </div>
          )}
          <div className="min-w-0 space-y-1">
            <div className="relative">
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2 flex-wrap">
                <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {title}
                </h1>
                {highlight && (
                  <span className="text-lg md:text-xl font-bold text-accent-500 dark:text-accent-400 tracking-tight">
                    {highlight}
                  </span>
                )}
              </div>
              <div className="mt-1 h-0.5 w-12 bg-gradient-to-r from-accent-500 to-accent-500/30 rounded-full" />
            </div>
            {description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                {description}
              </p>
            )}
            {meta && meta.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {meta.map((item, i) => {
                  const MIcon = item.icon;
                  return (
                    <div key={i} className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold ${pillColors[item.color || 'accent']}`}>
                      {MIcon && <MIcon className="w-3.5 h-3.5" />}
                      <span>{item.label} <span className="font-black">{item.value}</span></span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {action && (
          <div className="relative z-10 flex items-center shrink-0">
            {action}
          </div>
        )}
      </div>
    </div>
  );
};
