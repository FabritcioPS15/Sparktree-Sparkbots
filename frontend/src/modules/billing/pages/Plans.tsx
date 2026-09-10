import { useState, useEffect } from 'react';
import { Check, CreditCard, AlertTriangle, Zap, Building2, Sparkles } from 'lucide-react';
import { Loader } from '../../../components/ui/Loader';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageBody } from '../../../components/layout/PageBody';
import { Modal } from '../../../components/ui/Modal';
import { getPlans, getSubscription, createSubscription, cancelSubscription } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { cn } from '../../../utils/cn';

interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
  highlighted?: boolean;
  popular?: boolean;
  maxMessages: number;
  maxChannels: number;
  maxContacts?: number;
}

interface Subscription {
  id: string;
  planId: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  plan: Plan;
}

const planIcons: Record<string, any> = {
  free: Zap,
  starter: Sparkles,
  professional: CreditCard,
  enterprise: Building2,
};

const planColors: Record<string, string> = {
  free: 'from-slate-400 to-slate-500',
  starter: 'from-blue-500 to-blue-700',
  professional: 'from-accent-500 to-accent-600',
  enterprise: 'from-purple-500 to-pink-600',
};

const planBorderColors: Record<string, string> = {
  free: 'border-slate-200 dark:border-slate-700',
  starter: 'border-blue-200 dark:border-blue-800',
  professional: 'border-accent-200 dark:border-accent-800',
  enterprise: 'border-purple-200 dark:border-purple-800',
};

export const Plans = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [plansData, subData] = await Promise.all([
        getPlans(),
        user?.organization_id ? getSubscription(user.organization_id).catch(() => null) : Promise.resolve(null),
      ]);
      setPlans(Array.isArray(plansData) ? plansData : []);
      setSubscription(subData);
    } catch (err) {
      setError('Error al cargar los planes. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  const currentPlanId = subscription?.planId || subscription?.plan?.id;

  const handleSelectPlan = (plan: Plan) => {
    if (plan.id === currentPlanId) return;
    setSelectedPlan(plan);
    setShowConfirm(true);
  };

  const handleConfirmUpgrade = async () => {
    if (!selectedPlan || !user?.organization_id) return;
    setActionLoading(true);
    setError('');
    try {
      await createSubscription({
        tenantId: user.organization_id,
        planId: selectedPlan.id,
        cycle: selectedPlan.interval,
      });
      addNotification({ type: 'success', title: 'Plan activado', message: `Suscripción a "${selectedPlan.name}" activada correctamente.` });
      setSuccess(`Suscripción a "${selectedPlan.name}" activada correctamente.`);
      setShowConfirm(false);
      setSelectedPlan(null);
      await fetchData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo activar el plan.' });
      setError('Error al activar el plan. Intenta de nuevo.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;
    setActionLoading(true);
    setError('');
    try {
      await cancelSubscription(subscription.id, true);
      addNotification({ type: 'success', title: 'Suscripción cancelada', message: 'Seguirás activo hasta el final del período.' });
      setSuccess('Suscripción cancelada. Seguirás activo hasta el final del período.');
      setShowCancelConfirm(false);
      await fetchData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo cancelar la suscripción.' });
      setError('Error al cancelar la suscripción.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader size="md" />
      </div>
    );
  }

  return (
    <div className="h-full animate-in fade-in duration-500 flex flex-col gap-1">
      <PageHeader
        title="Planes y"
        highlight="Suscripciones"
        description="Elige el plan que mejor se adapte a tu negocio."
        icon={CreditCard}
      />

      <PageBody scrollable={true}>
        <div className="max-w-5xl mx-auto space-y-8">

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400 flex-1">{error}</p>
              <button onClick={() => setError('')} className="text-red-400/60 hover:text-red-400">✕</button>
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
              <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-400">{success}</p>
            </div>
          )}

          {/* Current Subscription Banner */}
          {subscription && (
            <div className="bg-gradient-to-r from-accent-500/10 via-accent-500/5 to-transparent rounded-2xl border border-accent-500/20 p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-accent-500/10 rounded-xl text-accent-500 shrink-0">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                  <p className="text-[10px] font-black text-accent-500 uppercase tracking-widest mb-1">Plan Actual</p>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                    {subscription.plan?.name || 'Plan activo'}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {subscription.cancelAtPeriodEnd
                      ? 'Cancelado — activo hasta el final del período'
                      : `Renovación: ${new Date(subscription.currentPeriodEnd).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`
                    }
                  </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowCancelConfirm(true)}
                    className="h-10 px-5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">
                    Cancelar Suscripción
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Plan Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlanId;
              const Icon = planIcons[plan.name.toLowerCase()] || Sparkles;

              return (
                <div
                  key={plan.id}
                  className={cn(
                    'relative bg-white dark:bg-dark-card rounded-2xl border-2 shadow-sm transition-all duration-200 hover:shadow-xl hover:scale-[1.02] flex flex-col',
                    isCurrent
                      ? 'border-accent-500 shadow-accent-500/10'
                      : planBorderColors[plan.name.toLowerCase()] || 'border-slate-200 dark:border-slate-700',
                  )}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-accent-500 to-accent-600 text-black text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg">
                      Más Popular
                    </div>
                  )}

                  <div className="p-6 flex flex-col flex-1">
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br shadow-lg',
                      planColors[plan.name.toLowerCase()] || 'from-accent-500 to-accent-600'
                    )}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>

                    <h3 className="text-lg font-black text-slate-900 dark:text-white">{plan.name}</h3>
                    <div className="mt-2 mb-4">
                      <span className="text-3xl font-black text-slate-900 dark:text-white">
                        ${plan.price}
                      </span>
                      <span className="text-sm text-slate-500 ml-1">
                        /{plan.interval === 'monthly' ? 'mes' : 'año'}
                      </span>
                    </div>

                    <div className="space-y-2.5 mb-6 flex-1">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          {plan.maxMessages === -1 ? 'Mensajes ilimitados' : `Hasta ${plan.maxMessages.toLocaleString()} mensajes/mes`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          {plan.maxChannels} {plan.maxChannels === 1 ? 'canal' : 'canales'}
                        </span>
                      </div>
                      {plan.maxContacts && (
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="text-xs text-slate-600 dark:text-slate-400">
                            Hasta {plan.maxContacts.toLocaleString()} contactos
                          </span>
                        </div>
                      )}
                      {plan.features?.filter(f => !f.toLowerCase().includes('mensaje') && !f.toLowerCase().includes('canal') && !f.toLowerCase().includes('contacto')).slice(0, 3).map((feat, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="text-xs text-slate-600 dark:text-slate-400">{feat}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => handleSelectPlan(plan)}
                      disabled={isCurrent || actionLoading}
                      className={cn(
                        'w-full h-11 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                        isCurrent
                          ? 'bg-accent-500/10 text-accent-500 border border-accent-500/20'
                          : 'bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-black shadow-md hover:shadow-lg'
                      )}
                    >
                      {isCurrent ? 'Plan Actual' : 'Seleccionar'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upgrade Confirm Modal */}
        <Modal
          open={showConfirm && !!selectedPlan}
          onClose={() => setShowConfirm(false)}
          title={subscription ? 'Cambiar de Plan' : 'Activar Plan'}
          size="sm"
          icon={<div className="w-10 h-10 bg-accent-500/10 rounded-xl flex items-center justify-center"><Sparkles className="w-5 h-5 text-accent-500" /></div>}
          footer={
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} disabled={actionLoading}
                className="flex-1 h-11 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleConfirmUpgrade} disabled={actionLoading}
                className="flex-1 h-11 bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-black rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {actionLoading ? <><Loader size="sm" /> Activando...</> : 'Confirmar'}
              </button>
            </div>
          }
        >
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
            {selectedPlan && (subscription
              ? `¿Cambiar a "${selectedPlan.name}" por $${selectedPlan.price}/${selectedPlan.interval === 'monthly' ? 'mes' : 'año'}?`
              : `¿Activar el plan "${selectedPlan.name}" por $${selectedPlan.price}/${selectedPlan.interval === 'monthly' ? 'mes' : 'año'}?`)}
          </p>
        </Modal>

        {/* Cancel Subscription Modal */}
        <Modal
          open={showCancelConfirm}
          onClose={() => setShowCancelConfirm(false)}
          title="Cancelar Suscripción"
          size="sm"
          icon={<div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-xl flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-500" /></div>}
          footer={
            <div className="flex gap-3">
              <button onClick={() => setShowCancelConfirm(false)} disabled={actionLoading}
                className="flex-1 h-11 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50">
                Volver
              </button>
              <button onClick={handleCancelSubscription} disabled={actionLoading}
                className="flex-1 h-11 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {actionLoading ? <><Loader size="sm" /> Cancelando...</> : 'Cancelar Suscripción'}
              </button>
            </div>
          }
        >
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
            Seguirás teniendo acceso hasta el final del período de facturación actual.
          </p>
        </Modal>
      </PageBody>
    </div>
  );
};
