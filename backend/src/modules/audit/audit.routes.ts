import { Router } from 'express';
import { auditLogService } from './auditLogService';

const router = Router();

// GET /api/audit-logs
router.get('/', async (req: any, res: any) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });

    const { search, action, userId, page, pageSize } = req.query;
    const result = await auditLogService.list({
      organizationId: orgId,
      search: search as string | undefined,
      action: action as string | undefined,
      userId: userId as string | undefined,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20
    });

    res.json(result);
  } catch (error: any) {
    // Si la tabla no existe (migración pendiente), devolver lista vacía
    console.error('Error listing audit logs:', error);
    res.json({ logs: [], total: 0, page: 1, pageSize: 20 });
  }
});

export default router;