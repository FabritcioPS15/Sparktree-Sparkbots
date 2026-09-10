import { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageContainer } from '../../../components/layout/PageContainer';
import { PageBody } from '../../../components/layout/PageBody';
import { DataTable } from '../../../components/ui/DataTable';
import { SearchBar } from '../../../components/ui/SearchBar';
import { Dropdown } from '../../../components/ui/Dropdown';
import { ViewToggle, ViewMode } from '../../../components/ui/ViewToggle';
import { TableCard } from '../../../components/ui/TableCard';
import { GridCard } from '../../../components/ui/GridCard';
import { Badge } from '../../../components/ui/Badge';
import { getAuditLogs } from '../../../services/api';

interface AuditLog {
  id: string;
  user: string;
  action: string;
  resource: string;
  details: string;
  timestamp: string;
  ip: string;
}

const ACTION_VARIANTS: Record<string, 'success' | 'info' | 'danger' | 'default'> = {
  CREATE: 'success',
  UPDATE: 'info',
  DELETE: 'danger',
  LOGIN: 'default',
  ASSIGN: 'info',
  UNASSIGN: 'danger',
  TRANSFER: 'info',
  REACTIVATE_BOT: 'info',
  EXPORT: 'default',
  OTHER: 'default',
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Crear',
  UPDATE: 'Actualizar',
  DELETE: 'Eliminar',
  LOGIN: 'Login',
  ASSIGN: 'Asignar',
  UNASSIGN: 'Desasignar',
  TRANSFER: 'Transferir',
  REACTIVATE_BOT: 'Bot',
  EXPORT: 'Exportar',
  OTHER: 'Otro',
};

const formatTimestamp = (ts: string) => {
  if (!ts) return '';
  const date = new Date(ts);
  if (isNaN(date.getTime())) return ts;
  return date.toLocaleString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const AuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAuditLogs({
        search: searchTerm || undefined,
        action: filterAction,
        page: currentPage,
        pageSize,
      });
      const items = Array.isArray(data?.logs) ? data.logs : [];
      setTotal(data?.total ?? items.length);
      setLogs(items.map((l: any) => ({
        id: l.id || '',
        user: l.user_email || 'system',
        action: l.action || 'OTHER',
        resource: l.resource_type ? `${l.resource_type}${l.resource_id ? ' · ' + l.resource_id.substring(0, 8) : ''}` : '-',
        details: l.details || '-',
        timestamp: formatTimestamp(l.created_at),
        ip: l.ip || '-',
      })));
    } catch (err) {
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterAction, currentPage]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const columns = [
    { key: 'timestamp', header: 'Fecha/Hora' },
    { key: 'user', header: 'Usuario' },
    { key: 'action', header: 'Acción' },
    { key: 'resource', header: 'Recurso' },
    { key: 'details', header: 'Detalles', render: (value: string) => value.substring(0, 40) + (value.length > 40 ? '...' : '') },
    { key: 'ip', header: 'IP' },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Auditoría"
        description="Logs de acciones por usuario/empresa"
      />
      <PageBody>
        <TableCard>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1">
              <SearchBar
                placeholder="Buscar por usuario o acción..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Dropdown
                value={filterAction}
                onChange={(v) => { setFilterAction(v); setCurrentPage(1); }}
                options={[
                  { value: 'all', label: 'Todas las Acciones' },
                  ...Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label })),
                ]}
              />
              <ViewToggle value={viewMode} onChange={setViewMode} />
              <button
                onClick={fetchLogs}
                disabled={loading}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                title="Actualizar"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {loading && logs.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">Cargando registros de auditoría...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">
              No hay registros de auditoría todavía. Las acciones como asignaciones, transferencias y reactivaciones del bot quedarán registradas aquí.
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {logs.map((log) => (
                <GridCard
                  key={log.id}
                  icon={<Activity className="w-5 h-5" />}
                  title={log.resource}
                  subtitle={log.details}
                  status={
                    <Badge variant={ACTION_VARIANTS[log.action] || 'default'} size="xs">
                      {ACTION_LABELS[log.action] || log.action}
                    </Badge>
                  }
                  actions={
                    <>
                      <span className="font-medium truncate max-w-[120px] text-[10px] text-slate-400">{log.user}</span>
                      <span className="text-[10px] text-slate-400">{log.timestamp}</span>
                    </>
                  }
                />
              ))}
            </div>
          ) : (
            <DataTable
              data={logs}
              columns={columns.map(c => c.key === 'action'
                ? { ...c, render: (value: string) => <Badge variant={ACTION_VARIANTS[value] || 'default'} size="xs">{ACTION_LABELS[value] || value}</Badge> }
                : c)}
              pagination={{ currentPage, totalPages: Math.ceil(total / pageSize) || 1, onPageChange: setCurrentPage }}
            />
          )}
        </TableCard>
      </PageBody>
    </PageContainer>
  );
};