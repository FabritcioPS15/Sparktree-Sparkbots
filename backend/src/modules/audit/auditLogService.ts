import { supabase } from '../../core/config/supabase';

export interface AuditLogEntry {
  organizationId: string;
  userId?: string | null;
  userEmail?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'ASSIGN' | 'UNASSIGN' | 'TRANSFER' | 'REACTIVATE_BOT' | 'EXPORT' | 'OTHER';
  resourceType?: string;
  resourceId?: string;
  details?: string;
  ip?: string;
  metadata?: Record<string, any>;
}

class AuditLogService {
  /**
   * Registra un evento de auditoría de forma no bloqueante.
   * Si la tabla no existe (migración pendiente), falla silenciosamente.
   */
  async log(entry: AuditLogEntry, userIp?: string): Promise<void> {
    try {
      const { error } = await supabase.from('audit_logs').insert({
        organization_id: entry.organizationId,
        user_id: entry.userId || null,
        user_email: entry.userEmail || null,
        action: entry.action,
        resource_type: entry.resourceType || null,
        resource_id: entry.resourceId || null,
        details: entry.details || null,
        ip: entry.ip || userIp || null,
        metadata: entry.metadata || {}
      });
      if (error) {
        console.error('[AuditLog] Error inserting log:', error.message);
      }
    } catch (err) {
      console.error('[AuditLog] Failed to insert log:', err);
    }
  }

  /**
   * Lista los logs de auditoría de una organización con filtros y paginación.
   */
  async list(params: {
    organizationId: string;
    search?: string;
    action?: string;
    userId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const {
      organizationId,
      search,
      action,
      userId,
      page = 1,
      pageSize = 20
    } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (action && action !== 'all') {
      query = query.eq('action', action);
    }

    if (userId && userId !== 'all') {
      query = query.eq('user_id', userId);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    let logs = data || [];

    // Filtro de búsqueda local (por email, recurso o detalles)
    if (search && search.trim()) {
      const term = search.toLowerCase();
      logs = logs.filter((l: any) =>
        (l.user_email || '').toLowerCase().includes(term) ||
        (l.details || '').toLowerCase().includes(term) ||
        (l.resource_type || '').toLowerCase().includes(term) ||
        (l.resource_id || '').toLowerCase().includes(term)
      );
    }

    return {
      logs,
      total: search ? logs.length : (count || 0),
      page,
      pageSize
    };
  }
}

export const auditLogService = new AuditLogService();