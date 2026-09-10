import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, AreaChart, Area
} from 'recharts';
import {
  TrendingUp, Users, MessageCircle, Activity, CheckCircle, BarChart3,
  Clock, Target, ArrowUp, ArrowDown
} from 'lucide-react';
import { getAnalytics } from '../../../services/api';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageContainer } from '../../../components/layout/PageContainer';
import { PageBody } from '../../../components/layout/PageBody';
import { PageLoader } from '../../../components/layout/PageLoader';
import { Dropdown } from '../../../components/ui/Dropdown';

interface HourlyActivity {
  hora: number;
  ejecuciones?: number;
  dias_activos?: number;
}

interface AnalyticsData {
  interactionsPerDay: any[];
  topFlows: any[];
  activeUsers: any[];
  weeklySummary: any[];
  dailyFlowSummary: any[];
  hourlyActivity: HourlyActivity[];
  stats: {
    avgResponseTime: number;
    satisfactionRate: number;
    completionRate: number;
    totalUsers: number;
    totalMessages: number;
    totalConversations: number;
  };
}

const generateEmptyData = () => {
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({ date: date.toISOString(), value: 0 });
  }
  return data;
};

const generateHourlyActivityData = (): HourlyActivity[] => {
  const data = [];
  for (let i = 0; i < 24; i++) {
    data.push({ hora: i, ejecuciones: 0, dias_activos: 0 });
  }
  return data;
};

const fetchAnalyticsData = async (): Promise<AnalyticsData> => {
  try {
    const data = await getAnalytics();
    return data;
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return {
      interactionsPerDay: generateEmptyData(),
      topFlows: [],
      activeUsers: generateEmptyData(),
      weeklySummary: [],
      dailyFlowSummary: [],
      hourlyActivity: generateHourlyActivityData(),
      stats: {
        avgResponseTime: 0,
        satisfactionRate: 0,
        completionRate: 0,
        totalUsers: 0,
        totalMessages: 0,
        totalConversations: 0
      }
    };
  }
};

const tooltipStyle = {
  backgroundColor: 'rgba(17, 24, 39, 0.95)',
  backdropFilter: 'blur(8px)',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.1)',
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  color: '#fff',
  fontWeight: 600,
  fontSize: '13px',
  padding: '10px 14px'
};

export const Analytics = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState('all');

  useEffect(() => {
    const fetchRealData = async () => {
      try {
        setLoading(true);
        const analytics = await fetchAnalyticsData();
        setAnalyticsData(analytics);
        setError(null);
      } catch (err) {
        console.error('Failed to load analytics:', err);
        setError('No se pudieron cargar las analíticas');
      } finally {
        setLoading(false);
      }
    };
    fetchRealData();
  }, []);

  if (loading) return <PageLoader sectionName="Analíticas" />;

  if (error) {
    return (
      <div className="h-[calc(100vh-8rem)] min-h-[600px] flex items-center justify-center bg-white/50 dark:bg-dark-card/50 backdrop-blur-xl rounded-[3rem] border border-gray-200 dark:border-gray-800/50">
        <div className="text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <Activity className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-gray-900 dark:text-white font-black text-xl">{error}</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2 font-bold uppercase tracking-widest">Intenta recargar la página</p>
        </div>
      </div>
    );
  }

  if (!analyticsData) return null;

  const { interactionsPerDay, activeUsers, weeklySummary, dailyFlowSummary, hourlyActivity, stats } = analyticsData;
  const safeStats = { ...stats, messageTrend: 0 };
  const safeInteractionsPerDay = Array.isArray(interactionsPerDay) ? interactionsPerDay : [];
  const safeActiveUsers = Array.isArray(activeUsers) ? activeUsers : [];
  const safeWeeklySummary = Array.isArray(weeklySummary) ? weeklySummary : [];
  const safeHourlyActivity = Array.isArray(hourlyActivity) ? hourlyActivity : [];
  const safeDailyFlowSummary = Array.isArray(dailyFlowSummary) ? dailyFlowSummary : [];

  const statCards = [
    { label: 'Tiempo Respuesta', value: safeStats.avgResponseTime > 0 ? `${safeStats.avgResponseTime}s` : '—', icon: Clock, color: 'blue', trend: 0 },
    { label: 'Satisfacción', value: `${safeStats.satisfactionRate}%`, icon: Target, color: 'emerald', trend: 0 },
    { label: 'Finalización', value: `${safeStats.completionRate}%`, icon: CheckCircle, color: 'violet', trend: 0 },
    { label: 'Mensajes', value: safeStats.totalMessages.toLocaleString(), icon: Users, color: 'amber', trend: safeStats.messageTrend || 0 },
  ];

  const cardColors: Record<string, { gradient: string; iconBg: string }> = {
    blue: { gradient: 'from-blue-500/20 to-cyan-500/10', iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
    emerald: { gradient: 'from-emerald-500/20 to-green-500/10', iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    violet: { gradient: 'from-violet-500/20 to-purple-500/10', iconBg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
    amber: { gradient: 'from-amber-500/20 to-orange-500/10', iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  };

  return (
    <PageContainer>
      <PageHeader
        title="Analíticas"
        highlight="Avanzadas"
        description="Descubre patrones y optimiza flujos en tiempo real."
        icon={BarChart3}
        action={
          <div className="flex items-center gap-2">
            <Dropdown
              value={selectedChannel}
              onChange={(v) => setSelectedChannel(v)}
              options={[
                { value: 'all', label: 'Todos los Canales' },
                { value: 'whatsapp', label: 'WhatsApp' },
                { value: 'instagram', label: 'Instagram' },
                { value: 'tiktok', label: 'TikTok' },
                { value: 'telegram', label: 'Telegram' },
                { value: 'messenger', label: 'Messenger' },
              ]}
            />
          </div>
        }
      />

      <PageBody scrollable={true}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {statCards.map((item, idx) => (
            <div
              key={idx}
              className="relative bg-white dark:bg-dark-card rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group overflow-hidden"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${cardColors[item.color]?.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              <div className="absolute -right-6 -top-6 w-20 h-20 bg-white/5 dark:bg-white/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />

              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className={`p-3 rounded-xl ${cardColors[item.color]?.iconBg} border border-white/20`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                  item.trend >= 0
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                }`}>
                  {item.trend >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                  {Math.abs(item.trend)}%
                </div>
              </div>

              <div className="space-y-1 relative z-10">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">{item.label}</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                  {item.value}
                </p>
                <p className="text-[10px] text-slate-400 font-semibold">últimos 30 días</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white dark:bg-dark-card rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl">
                  <MessageCircle className="w-4 h-4 text-emerald-500" />
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Interacciones Diarias</h3>
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mensajes procesados</span>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={safeInteractionsPerDay.length > 0 ? safeInteractionsPerDay : generateEmptyData()} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="interactionsArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#41f0a5" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#41f0a5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.04} vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={12}
                    fontSize={10}
                    fontWeight={600}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis stroke="#94a3b8" axisLine={false} tickLine={false} fontSize={10} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => new Date(value).toLocaleDateString('es-ES', { weekday: 'long', month: 'short', day: 'numeric' })} />
                  <Area type="monotone" dataKey="value" stroke="#41f0a5" strokeWidth={3} fill="url(#interactionsArea)" activeDot={{ r: 6, strokeWidth: 0, fill: '#41f0a5' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-card rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-xl">
                  <Users className="w-4 h-4 text-blue-500" />
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Usuarios Activos</h3>
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuarios únicos/día</span>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={safeActiveUsers.length > 0 ? safeActiveUsers : generateEmptyData()} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="activeUsersArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.04} vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={12}
                    fontSize={10}
                    fontWeight={600}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis stroke="#94a3b8" axisLine={false} tickLine={false} fontSize={10} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => new Date(value).toLocaleDateString('es-ES', { weekday: 'long', month: 'short', day: 'numeric' })} />
                  <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fill="url(#activeUsersArea)" activeDot={{ r: 6, strokeWidth: 0, fill: '#3b82f6' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="bg-white dark:bg-dark-card rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-500/10 rounded-xl">
                  <BarChart3 className="w-4 h-4 text-violet-500" />
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Resumen Semanal</h3>
              </div>
            </div>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={safeWeeklySummary.length > 0 ? safeWeeklySummary.map(w => ({
                  week: `Sem ${new Date(w.semana).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}`,
                  ejecuciones: w.total_ejecuciones || 0,
                  completados: w.completados || 0
                })) : []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.04} vertical={false} />
                  <XAxis dataKey="week" stroke="#94a3b8" axisLine={false} tickLine={false} tickMargin={10} fontSize={10} fontWeight={600} />
                  <YAxis stroke="#94a3b8" axisLine={false} tickLine={false} fontSize={10} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: any, name?: string | number) => {
                    if (name === 'ejecuciones') return [`${value} ejecuciones`, 'Total'];
                    if (name === 'completados') return [`${value} completados`, 'Completados'];
                    return [value, name?.toString() || ''];
                  }} />
                  <Bar dataKey="ejecuciones" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="completados" fill="#41f0a5" radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-card rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-xl">
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Actividad por Hora</h3>
              </div>
            </div>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={safeHourlyActivity.length > 0 ? safeHourlyActivity.map(h => ({
                  hora: `${h.hora}:00`,
                  ejecuciones: h.ejecuciones || 0
                })) : []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.04} vertical={false} />
                  <XAxis dataKey="hora" stroke="#94a3b8" axisLine={false} tickLine={false} tickMargin={10} fontSize={10} fontWeight={600} />
                  <YAxis stroke="#94a3b8" axisLine={false} tickLine={false} fontSize={10} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [`${value} ejecuciones`, 'Ejecuciones']} />
                  <Line type="monotone" dataKey="ejecuciones" stroke="#f59e0b" strokeWidth={3} dot={{ fill: '#f59e0b', r: 3, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-card rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Ejecuciones Diarias</h3>
              </div>
            </div>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={safeDailyFlowSummary.length > 0 ? safeDailyFlowSummary.map(d => ({
                  dia: new Date(d.dia).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
                  total_ejecuciones: d.total_ejecuciones || 0,
                  completados: d.completados || 0
                })) : []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dailyEecuciones" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.04} vertical={false} />
                  <XAxis dataKey="dia" stroke="#94a3b8" axisLine={false} tickLine={false} tickMargin={10} fontSize={10} fontWeight={600} />
                  <YAxis stroke="#94a3b8" axisLine={false} tickLine={false} fontSize={10} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: any, name?: string | number) => {
                    if (name === 'total_ejecuciones') return [`${value} ejecuciones`, 'Total'];
                    if (name === 'completados') return [`${value} completados`, 'Completados'];
                    return [value, name?.toString() || ''];
                  }} />
                  <Line type="monotone" dataKey="total_ejecuciones" stroke="url(#dailyEecuciones)" strokeWidth={3} dot={{ fill: '#10b981', r: 3, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5, strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="completados" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 2, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 4, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 bg-white dark:bg-dark-card rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-500/10 rounded-xl">
                  <Activity className="w-4 h-4 text-rose-500" />
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Actividad General</h3>
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Flujos y ejecuciones</span>
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={safeDailyFlowSummary.length > 0 ? safeDailyFlowSummary.map(d => ({
                  dia: new Date(d.dia).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
                  total_ejecuciones: d.total_ejecuciones || 0,
                  flujos_unicos: d.flujos_unicos || 0
                })) : []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.04} vertical={false} />
                  <XAxis dataKey="dia" stroke="#94a3b8" axisLine={false} tickLine={false} tickMargin={10} fontSize={10} fontWeight={600} />
                  <YAxis stroke="#94a3b8" axisLine={false} tickLine={false} fontSize={10} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: any, name?: string | number) => {
                    if (name === 'total_ejecuciones') return [`${value} ejecuciones`, 'Ejecuciones'];
                    if (name === 'flujos_unicos') return [`${value} flujos`, 'Flujos Únicos'];
                    return [value, name?.toString() || ''];
                  }} />
                  <Line type="monotone" dataKey="total_ejecuciones" stroke="#f43f5e" strokeWidth={3} dot={{ fill: '#f43f5e', r: 3, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5, strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="flujos_unicos" stroke="#41f0a5" strokeWidth={2} dot={{ fill: '#41f0a5', r: 2, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 4, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-card rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center">
            <div className="p-3 bg-emerald-500/10 rounded-xl mb-4">
              <Target className="w-6 h-6 text-emerald-500" />
            </div>
            <div className="text-center">
              <div className="text-4xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                {safeWeeklySummary.length > 0
                  ? Math.round(safeWeeklySummary.reduce((sum: number, w: { tasa_exito: number }) => sum + (w.tasa_exito || 0), 0) / safeWeeklySummary.length)
                  : 0}%
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Tasa de Éxito</p>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">
                Basado en {safeWeeklySummary.length} semanas
              </p>
            </div>
          </div>
        </div>
      </PageBody>
    </PageContainer>
  );
};

export default Analytics;
