import React, { useEffect, useState, useCallback, useRef } from 'react';
import { DashboardCard } from './DashboardCard';
import { Sparkles, TrendingUp, Bot, MessageCircle, AlertTriangle, RefreshCw, ChevronRight } from 'lucide-react';

interface Insight {
  type: 'growth' | 'bot' | 'traffic' | 'alert';
  text: string;
}

interface AIInsightsProps {
  insights?: Insight[];
}

const defaultInsights: Insight[] = [
  { type: 'traffic', text: 'Conecta tus canales para empezar a recibir datos.' },
];

const ROTATION_MS = 4500;

export const AIInsights: React.FC<AIInsightsProps> = ({ insights: propInsights }) => {
  const insights = propInsights && propInsights.length > 0 ? propInsights : defaultInsights;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reinicia el índice si cambia la lista (nuevo rango / refresh)
  useEffect(() => {
    setIndex(0);
    if (insights.length <= 1) setPaused(false);
  }, [insights]);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % Math.max(insights.length, 1));
  }, [insights.length]);

  useEffect(() => {
    if (insights.length <= 1 || paused) return;
    intervalRef.current = setInterval(next, ROTATION_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [insights.length, paused, next, index]);

  // Reinicia la barra de progreso en cada índice
  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.style.animation = 'none';
      void progressRef.current.offsetWidth; // reflow
      progressRef.current.style.animation = '';
    }
  }, [index, paused]);

  const current = insights[index % insights.length];

  const getIcon = (type: Insight['type']) => {
    switch (type) {
      case 'growth': return <TrendingUp className="w-4 h-4 text-emerald-500" />;
      case 'bot': return <Bot className="w-4 h-4 text-accent-500" />;
      case 'traffic': return <MessageCircle className="w-4 h-4 text-blue-500" />;
      case 'alert': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    }
  };

  const getAccent = (type: Insight['type']) => {
    switch (type) {
      case 'growth': return 'from-emerald-500/20 to-emerald-500/0 text-emerald-600 dark:text-emerald-400';
      case 'bot': return 'from-accent-500/20 to-accent-500/0 text-accent-600 dark:text-accent-400';
      case 'traffic': return 'from-blue-500/20 to-blue-500/0 text-blue-600 dark:text-blue-400';
      case 'alert': return 'from-amber-500/20 to-amber-500/0 text-amber-600 dark:text-amber-400';
    }
  };

  return (
    <DashboardCard
      title="AI Insights"
      subtitle={paused ? 'Resumen pausado' : insights.length > 1 ? 'Resumen IA en rotación' : 'Conclusión de SparkBot AI'}
      icon={<Sparkles className="w-4 h-4" />}
    >
      <style>{`
        @keyframes aiProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>

      <div className="space-y-3 pt-2">
        {/* Insight activo */}
        <div
          key={index}
          className={`relative flex items-start gap-3 p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-gradient-to-br ${getAccent(current.type)} animate-in fade-in slide-in-from-bottom-1 duration-300 cursor-pointer overflow-hidden`}
          onClick={() => setPaused((p) => !p)}
          title={paused ? 'Reanudar rotación' : 'Pausar rotación'}
        >
          <div className="p-2 bg-white dark:bg-slate-900/60 rounded-lg shrink-0 mt-0.5 shadow-sm">
            {getIcon(current.type)}
          </div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug">
            {current.text}
          </p>

          {/* Barra de progreso de rotación */}
          {insights.length > 1 && !paused && (
            <div className="absolute bottom-0 left-0 h-0.5 bg-white/50 dark:bg-white/10 w-full">
              <div
                ref={progressRef}
                className="h-full bg-current opacity-60"
                style={{ animation: `aiProgress ${ROTATION_MS}ms linear forwards` }}
              />
            </div>
          )}
        </div>

        {/* Controles de navegación */}
        {insights.length > 1 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {insights.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => { e.stopPropagation(); setIndex(idx); setPaused(false); }}
                  className={`h-1.5 rounded-full transition-all duration-300 ${idx === index ? 'w-5 bg-accent-500' : 'w-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300'}`}
                  title={`Ver insight ${idx + 1}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPaused((p) => !p)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-accent-500 hover:bg-accent-500/10 transition-colors"
                title={paused ? 'Reanudar' : 'Pausar'}
              >
                <RefreshCw className="w-3.5 h-3.5" style={paused ? {} : { animation: 'spin 6s linear infinite' }} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-accent-500 hover:bg-accent-500/10 transition-colors"
                title="Siguiente insight"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Contador */}
        {insights.length > 1 && (
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Insight {index + 1} de {insights.length}
          </p>
        )}
      </div>
    </DashboardCard>
  );
};