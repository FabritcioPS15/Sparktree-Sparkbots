import React from 'react';
import { DashboardCard } from './DashboardCard';
import { Activity, UserPlus, MessageSquare, Zap, Link } from 'lucide-react';

interface ActivityItem {
  type: 'user' | 'message' | 'flow' | 'channel';
  title: string;
  time: string;
}

interface ActivityTimelineProps {
  activities?: ActivityItem[];
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Ahora mismo';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Hace ${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Ayer';
  return `Hace ${diffDay} días`;
}

const defaultActivities: ActivityItem[] = [];

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ activities: propActivities }) => {
  const activities = propActivities && propActivities.length > 0 ? propActivities : defaultActivities;

  const getIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'user': return <UserPlus className="w-3.5 h-3.5 text-blue-500" />;
      case 'message': return <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />;
      case 'flow': return <Zap className="w-3.5 h-3.5 text-amber-500" />;
      case 'channel': return <Link className="w-3.5 h-3.5 text-indigo-500" />;
    }
  };

  return (
    <DashboardCard
      title="Actividad Reciente"
      icon={<Activity className="w-4 h-4" />}
    >
      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Activity className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
          <p className="text-sm text-slate-400 font-medium">Sin actividad reciente</p>
          <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">Las acciones aparecerán aquí cuando uses el sistema</p>
        </div>
      ) : (
        <div className="relative mt-2 pl-4">
          <div className="absolute top-2 bottom-2 left-4 w-px bg-slate-200 dark:bg-slate-800 -translate-x-1/2" />
          <div className="space-y-6">
            {activities.map((item, idx) => (
              <div key={idx} className="relative flex items-start gap-4">
                <div className="absolute -left-4 w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700 top-1.5 -translate-x-1/2 ring-4 ring-white dark:ring-[#242424]" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-md">
                      {getIcon(item.type)}
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {item.title}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 font-medium ml-8 mt-0.5">
                    {timeAgo(item.time)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardCard>
  );
};
