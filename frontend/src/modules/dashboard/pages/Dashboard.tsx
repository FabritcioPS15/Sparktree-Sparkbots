import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, MessageSquare, Activity, Box, Zap, ChevronRight, UserPlus, Share2, AlertCircle, LayoutDashboard, Play, ShoppingCart, FileText, Target, Wallet, Calendar, Gift, BellRing } from 'lucide-react';
import { getAnalytics, getDashboardAnalytics, getCrmDashboard, getOrders, getQuotes, getPromotions, getCalendarEvents, getReminders } from '../../../services/api';
import { PageContainer } from '../../../components/layout/PageContainer';
import { PageBody } from '../../../components/layout/PageBody';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageLoader } from '../../../components/layout/PageLoader';
import { useConnections } from '../../../contexts/ConnectionsContext';
import { useAuth } from '../../../contexts/AuthContext';
import { HeaderButton } from '../../../components/ui/HeaderButton';
import { FaWhatsapp, FaTelegram, FaInstagram, FaFacebookMessenger } from 'react-icons/fa';
import { SiTiktok } from 'react-icons/si';

import { MetricCard } from '../components/MetricCard';
import { AIInsights } from '../components/AIInsights';
import { ActivityTimeline } from '../components/ActivityTimeline';
import { MainChart } from '../components/MainChart';
import { DashboardCard } from '../components/DashboardCard';

const formatCurrency = (value: number) =>
  value.toLocaleString('es-ES', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'Buenos días,';
  if (hour >= 12 && hour < 19) return 'Buenas tardes,';
  return 'Buenas noches,';
};

export const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { connections } = useConnections();
  const [messagesData, setMessagesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [crm, setCrm] = useState({ totalClients: 0, totalDeals: 0, totalValue: 0, wonValue: 0 });
  const [moduleCounts, setModuleCounts] = useState({ orders: 0, quotes: 0, promotions: 0, events: 0, reminders: 0 });
  const [dashboardStats, setDashboardStats] = useState({
    totalMessages: 0, messageTrend: 0, totalContacts: 0, contactTrend: 0,
    openConversations: 0, activeFlows: 0, completionRate: 0, avgResponseTime: 0,
  });
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({});
  const [dashboardActivity, setDashboardActivity] = useState<any[]>([]);
  const [dashboardInsights, setDashboardInsights] = useState<any[]>([]);
  const [messagesToday, setMessagesToday] = useState(0);

  const platformData = [
    { id: 'whatsapp', name: 'WhatsApp', icon: FaWhatsapp, color: 'text-emerald-500', route: '/whatsapp-qr' },
    { id: 'instagram', name: 'Instagram', icon: FaInstagram, color: 'text-pink-500', route: '/instagram-config' },
    { id: 'tiktok', name: 'TikTok', icon: SiTiktok, color: 'text-slate-900 dark:text-white', route: '/tiktok-config' },
    { id: 'telegram', name: 'Telegram', icon: FaTelegram, color: 'text-blue-500', route: '/telegram-config' },
    { id: 'messenger', name: 'Messenger', icon: FaFacebookMessenger, color: 'text-blue-600', route: '/facebook-config' }
  ];

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [analyticsData, dashboardData] = await Promise.allSettled([
          getAnalytics(),
          getDashboardAnalytics(selectedTimeRange),
        ]);

        const analytics = analyticsData.status === 'fulfilled' ? analyticsData.value : null;
        const dash = dashboardData.status === 'fulfilled' ? dashboardData.value : null;

        if (analytics) {
          const isConnected = analytics?.whatsapp?.connected || false;
          setMessagesToday(isConnected ? (analytics.stats?.whatsappMessagesToday || 0) : (analytics.stats?.messagesToday || 0));
        }

        if (dash) {
          setMessagesData(dash.chart || []);
          setSparklines(dash.sparklines || {});
          setDashboardStats(dash.stats || {});
          setDashboardActivity(dash.activity || []);
          setDashboardInsights(dash.insights || []);
        } else if (analytics) {
          setMessagesData(analytics.interactionsPerDay || []);
        }

        try {
          const crmData = await getCrmDashboard();
          setCrm({
            totalClients: crmData?.totalClients || 0,
            totalDeals: crmData?.totalDeals || 0,
            totalValue: crmData?.totalValue || 0,
            wonValue: crmData?.wonValue || 0
          });
        } catch (e) {
          console.error('Error fetching CRM metrics:', e);
        }

        try {
          const [orders, quotes, promotions, events, reminders] = await Promise.all([
            getOrders().catch(() => []),
            getQuotes().catch(() => []),
            getPromotions().catch(() => []),
            getCalendarEvents().catch(() => []),
            getReminders().catch(() => [])
          ]);
          setModuleCounts({
            orders: (orders || []).length,
            quotes: (quotes || []).length,
            promotions: (promotions || []).length,
            events: (events || []).filter((ev: any) => new Date(ev.event_date).getTime() >= new Date().setHours(0, 0, 0, 0)).length,
            reminders: (reminders || []).length
          });
        } catch (e) {
          console.error('Error fetching module counts:', e);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();

    // Polling ligero: mantiene los AI Insights frescos (refresca cada 60s sin recargar la página)
    const insightsInterval = setInterval(async () => {
      try {
        const dash = await getDashboardAnalytics(selectedTimeRange);
        if (dash?.insights) setDashboardInsights(dash.insights);
      } catch (e) {
        /* silencioso */
      }
    }, 60000);

    return () => clearInterval(insightsInterval);
  }, [selectedTimeRange]);

  const handleRangeChange = (range: string) => {
    setSelectedTimeRange(range);
    setShowCustomRange(range === 'custom');
  };

  if (loading) return <PageLoader sectionName="Dashboard" />;

  const connectedChannels = connections.filter(c => c.status === 'connected').length;
  const firstName = user?.full_name?.split(' ')[0] || 'usuario';

  const quickActions = [
    { name: 'Nuevo Cliente', path: '/clients', icon: UserPlus, color: 'text-primary-500' },
    { name: 'Nueva Cotización', path: '/cotizaciones', icon: FileText, color: 'text-violet-500' },
    { name: 'Nuevo Pedido', path: '/orders', icon: ShoppingCart, color: 'text-emerald-500' },
    { name: 'Crear Promoción', path: '/promotions', icon: Gift, color: 'text-pink-500' },
    { name: 'Agendar Evento', path: '/calendar', icon: Calendar, color: 'text-amber-500' },
    { name: 'Ver Analíticas', path: '/analytics', icon: Activity, color: 'text-sky-500' },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={getGreeting()}
        highlight={`${firstName} 👋`}
        description="Todo está funcionando correctamente en tu ecosistema inteligente."
        icon={LayoutDashboard}
        meta={[
          { label: 'Conversaciones hoy', value: messagesToday.toLocaleString(), icon: MessageSquare, color: 'accent' },
          { label: 'Canales activos', value: connectedChannels, icon: Share2, color: 'blue' },
          { label: 'Contactos', value: dashboardStats.totalContacts.toLocaleString(), icon: Users, color: 'emerald' },
          { label: 'Alertas críticas', value: '0', icon: AlertCircle, color: 'amber' },
        ]}
        action={
          <div className="flex flex-wrap gap-2">
            <HeaderButton
              variant="ghost"
              onClick={() => navigate('/analytics')}
              icon={<Activity className="w-4 h-4" />}
            >
              Ver Analíticas
            </HeaderButton>
            <HeaderButton
              variant="primary"
              onClick={() => navigate('/flow-manager')}
              icon={<Play className="w-4 h-4" />}
            >
              Crear Flujo
            </HeaderButton>
          </div>
        }
      />

      <PageBody>
        <div className="space-y-5">
          {/* KPIs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <MetricCard
              title="Clientes"
              value={dashboardStats.totalContacts.toLocaleString()}
              icon={<Users className="w-5 h-5" />}
              sparkline={sparklines.contacts || [0]}
              delay={0.1}
            />
            <MetricCard
              title="Oportunidades"
              value={crm.totalDeals.toLocaleString()}
              icon={<Target className="w-5 h-5" />}
              trend={{ value: 0, label: 'en pipeline', direction: 'neutral' }}
              sparkline={[crm.totalDeals]}
              delay={0.2}
            />
            <MetricCard
              title="Mensajes"
              value={dashboardStats.totalMessages.toLocaleString()}
              icon={<MessageSquare className="w-5 h-5" />}
              trend={{ value: dashboardStats.messageTrend, label: 'vs período anterior', direction: dashboardStats.messageTrend > 0 ? 'up' : dashboardStats.messageTrend < 0 ? 'down' : 'neutral' }}
              sparkline={sparklines.messages || [0]}
              delay={0.3}
            />
            <MetricCard
              title="Total Gastado"
              value={formatCurrency(crm.totalValue)}
              icon={<Wallet className="w-5 h-5" />}
              trend={{ value: 0, label: 'valor del pipeline', direction: 'neutral' }}
              sparkline={[crm.totalValue]}
              delay={0.4}
            />
          </div>

          {/* Main Chart */}
          <MainChart
            data={messagesData}
            selectedRange={selectedTimeRange}
            onRangeChange={handleRangeChange}
            showCustomRange={showCustomRange}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />

          {/* Insights + Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <AIInsights insights={dashboardInsights} />
            <ActivityTimeline activities={dashboardActivity} />
          </div>

          {/* Bottom Grids */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Canales */}
            <DashboardCard title="Estado de Canales" icon={<Box className="w-4 h-4" />}>
              <div className="space-y-3 mt-4">
                {platformData.map((platform) => {
                  const connection = connections.find(c => c.platform_type === platform.id);
                  const isConnected = connection?.status === 'connected';
                  const PlatformIcon = platform.icon;
                  return (
                    <div
                      key={platform.id}
                      onClick={() => navigate(platform.route)}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-800/20 hover:border-slate-300 dark:hover:border-white/10 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 bg-white dark:bg-[#242424] rounded-lg border border-slate-100 dark:border-white/5 ${platform.color}`}>
                          <PlatformIcon size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white leading-none">{platform.name}</p>
                          <p className="text-xs font-medium text-slate-500 mt-1">{isConnected ? 'Conectado' : 'Desconectado'}</p>
                        </div>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300 dark:bg-slate-700'}`} />
                    </div>
                  );
                })}
              </div>
            </DashboardCard>

            {/* Quick Actions */}
            <DashboardCard title="Acciones Rápidas" icon={<Zap className="w-4 h-4" />}>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {quickActions.map(action => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.name}
                      onClick={() => navigate(action.path)}
                      className="flex flex-col items-start gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left group"
                    >
                      <Icon className={`w-4 h-4 ${action.color}`} />
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{action.name}</span>
                    </button>
                  );
                })}
              </div>
            </DashboardCard>

            {/* Resumen de Módulos */}
            <DashboardCard title="Resumen de Módulos" icon={<Activity className="w-4 h-4" />}>
              <div className="mt-4 space-y-2.5">
                {[
                  { name: 'Cotizaciones', count: moduleCounts.quotes, path: '/cotizaciones', icon: FileText, color: 'text-violet-500', bg: 'bg-violet-500/10' },
                  { name: 'Pedidos', count: moduleCounts.orders, path: '/orders', icon: ShoppingCart, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                  { name: 'Promociones', count: moduleCounts.promotions, path: '/promotions', icon: Gift, color: 'text-pink-500', bg: 'bg-pink-500/10' },
                  { name: 'Próximos eventos', count: moduleCounts.events, path: '/calendar', icon: Calendar, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                  { name: 'Recordatorios', count: moduleCounts.reminders, path: '/reminders', icon: BellRing, color: 'text-sky-500', bg: 'bg-sky-500/10' },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.name}
                      onClick={() => navigate(item.path)}
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-800/20 hover:border-slate-300 dark:hover:border-white/10 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.bg} ${item.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-white transition-colors">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{item.count}</span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </DashboardCard>
          </div>

        </div>
      </PageBody>
    </PageContainer>
  );
};
