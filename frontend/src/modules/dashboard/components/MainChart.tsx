import React, { Suspense, lazy } from 'react';
import dayjs from 'dayjs';
import { DashboardCard } from './DashboardCard';

interface MainChartProps {
  data: any[];
  loading?: boolean;
  selectedRange: string;
  onRangeChange: (range: string) => void;
  showCustomRange: boolean;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

// Lazy-load solo cuando se necesita para reducir el chunk crítico (recharts ~379KB)
const AreaChartLazy = lazy(() =>
  import('recharts').then((m) => ({
    default: ({
      data,
    }: {
      data: any[];
    }) => (
      <m.ResponsiveContainer width="100%" height="100%">
        <m.AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#41f0a5" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#41f0a5" stopOpacity={0} />
            </linearGradient>
          </defs>
          <m.CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.1)" />
          <m.XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#94a3b8' }}
            dy={10}
          />
          <m.YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#94a3b8' }}
          />
          <m.Tooltip
            contentStyle={{
              backgroundColor: 'rgba(17, 24, 39, 0.95)',
              backdropFilter: 'blur(8px)',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              color: '#fff',
              fontWeight: 600,
            }}
            itemStyle={{ color: '#41f0a5' }}
            cursor={{ stroke: 'rgba(148, 163, 184, 0.2)', strokeWidth: 2, strokeDasharray: '4 4' }}
          />
          <m.Area
            type="monotone"
            dataKey="value"
            stroke="#41f0a5"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorValue)"
            activeDot={{ r: 6, strokeWidth: 0, fill: '#41f0a5' }}
          />
        </m.AreaChart>
      </m.ResponsiveContainer>
    ),
  }))
);

// Lazy-load del DatePicker de MUI
const DatePickerLazy = lazy(() =>
  import('@mui/x-date-pickers/DatePicker').then((m) => ({ default: m.DatePicker }))
);

const pickerBaseProps = {
  slotProps: {
    textField: {
      size: 'small' as const,
      sx: {
        '& .MuiInputBase-root': { borderRadius: '8px', backgroundColor: '#fff', border: '1px solid #e2e8f0', height: '36px', fontSize: '14px' },
      },
    },
  },
  sx: { width: '100%' },
};

export const MainChart: React.FC<MainChartProps> = ({
  data,
  loading = false,
  selectedRange,
  onRangeChange,
  showCustomRange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}) => {
  return (
    <DashboardCard
      title="Interacciones"
      subtitle="Volumen de mensajes en el ecosistema"
      action={
        <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg">
          {['7d', '30d', 'custom'].map((range) => (
            <button
              key={range}
              onClick={() => onRangeChange(range)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                selectedRange === range
                  ? 'bg-white dark:bg-[#242424] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {range === '7d' ? 'Semana' : range === '30d' ? 'Mes' : 'Pers.'}
            </button>
          ))}
        </div>
      }
      className="min-h-[400px]"
    >
      {showCustomRange && (
        <div className="flex items-center gap-3 mb-6 p-4 bg-slate-50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-white/5 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
            <div className="flex-1">
              <Suspense fallback={null}>
                <DatePickerLazy
                  value={startDate ? dayjs(startDate) : null}
                  onChange={(v: any) => onStartDateChange(v?.format('YYYY-MM-DD') || '')}
                  {...pickerBaseProps}
                />
              </Suspense>
            </div>
            <span className="hidden sm:block text-xs font-bold text-slate-400">a</span>
            <div className="flex-1">
              <Suspense fallback={null}>
                <DatePickerLazy
                  value={endDate ? dayjs(endDate) : null}
                  onChange={(v: any) => onEndDateChange(v?.format('YYYY-MM-DD') || '')}
                  {...pickerBaseProps}
                />
              </Suspense>
            </div>
          </div>
        </div>
      )}

      <div className="h-[300px] w-full mt-4 relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-dark-bg/60">
            <div className="loader" />
          </div>
        )}
        <Suspense
          fallback={
            <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">
              Cargando gráfico…
            </div>
          }
        >
          <AreaChartLazy data={data} />
        </Suspense>
      </div>
    </DashboardCard>
  );
};
