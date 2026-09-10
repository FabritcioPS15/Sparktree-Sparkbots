import { motion } from 'framer-motion';
import { Play, Activity, AlertCircle } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';

export const DashboardHero = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8"
    >
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          Buenos días, Fabritcio <span className="animate-wave origin-bottom-right inline-block">👋</span>
        </h1>
        <p className="text-slate-500 font-medium text-base">
          Todo está funcionando correctamente en tu ecosistema inteligente.
        </p>
        
        {/* Quick Summary Badges */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Badge variant="success" size="sm" shape="square" icon={<Activity className="w-3 h-3" />}>99.9% Uptime</Badge>
          <Badge variant="info" size="sm" shape="square" icon={<span className="w-2 h-2 rounded-full bg-current" />}>134 conversaciones hoy</Badge>
          <Badge variant="default" size="sm" shape="square">5 canales activos</Badge>
          <Badge variant="default" size="sm" shape="square" icon={<AlertCircle className="w-3 h-3" />}>0 alertas críticas</Badge>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="px-4 py-2.5 bg-white dark:bg-dark-card border border-[#E5E7EB] dark:border-dark-border text-slate-700 dark:text-slate-300 font-semibold text-sm rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm">
          Ver Analíticas
        </button>
        <button className="px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-black font-semibold text-sm rounded-xl hover:opacity-90 transition-opacity shadow-md flex items-center gap-2">
          <Play className="w-4 h-4" />
          Crear Flujo
        </button>
      </div>
    </motion.div>
  );
};


