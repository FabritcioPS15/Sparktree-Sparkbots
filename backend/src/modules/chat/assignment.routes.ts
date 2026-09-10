import { Router, Response } from 'express';
import { assignmentService } from './assignmentService';
import { supabase } from '../../core/config/supabase';
import { tenantMiddleware, TenantRequest } from '../../core/middleware/tenant';
import { auditLogService } from '../audit/auditLogService';

const router = Router();

const getClientIp = (req: any): string => {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'localhost';
};

// POST /api/assignment/assign - Manual assignment
router.post('/assign', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const orgId = req.organizationId;
    const { conversationId, userId } = req.body;

    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });
    if (!conversationId) return res.status(400).json({ error: 'Conversation ID required' });
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    // Verify conversation belongs to organization
    const { data: conversation, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('organization_id', orgId)
      .single();

    if (error || !conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const result = await assignmentService.assignConversation(conversationId, userId, orgId);

    // Auditoría
    auditLogService.log({
      organizationId: orgId,
      userId: (req as any).user?.id,
      userEmail: (req as any).user?.email,
      action: 'ASSIGN',
      resourceType: 'conversation',
      resourceId: conversationId,
      details: `Conversación asignada manualmente al agente ${userId}`,
      ip: getClientIp(req),
      metadata: { agentId: userId, assignmentType: 'manual' }
    });

    res.json({ message: 'Conversation assigned successfully', conversation: result });
  } catch (error: any) {
    console.error('Error in /assignment/assign:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/assignment/round-robin - Round Robin assignment
router.post('/round-robin', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const orgId = req.organizationId;
    const { conversationId } = req.body;

    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });
    if (!conversationId) return res.status(400).json({ error: 'Conversation ID required' });

    // Verify conversation belongs to organization
    const { data: conversation, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('organization_id', orgId)
      .single();

    if (error || !conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const result = await assignmentService.assignConversationRoundRobin(conversationId, orgId);
    res.json({ message: 'Conversation assigned via round robin', conversation: result });
  } catch (error: any) {
    console.error('Error in /assignment/round-robin:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/assignment/load-balance - Load balance assignment
router.post('/load-balance', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const orgId = req.organizationId;
    const { conversationId } = req.body;

    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });
    if (!conversationId) return res.status(400).json({ error: 'Conversation ID required' });

    // Verify conversation belongs to organization
    const { data: conversation, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('organization_id', orgId)
      .single();

    if (error || !conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const result = await assignmentService.assignConversationLoadBalance(conversationId, orgId);
    res.json({ message: 'Conversation assigned via load balance', conversation: result });
  } catch (error: any) {
    console.error('Error in /assignment/load-balance:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/assignment/unassign - Unassign conversation
router.post('/unassign', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const orgId = req.organizationId;
    const { conversationId } = req.body;

    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });
    if (!conversationId) return res.status(400).json({ error: 'Conversation ID required' });

    // Verify conversation belongs to organization
    const { data: conversation, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('organization_id', orgId)
      .single();

    if (error || !conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const result = await assignmentService.unassignConversation(conversationId, orgId);

    // Auditoría
    auditLogService.log({
      organizationId: orgId,
      userId: (req as any).user?.id,
      userEmail: (req as any).user?.email,
      action: 'UNASSIGN',
      resourceType: 'conversation',
      resourceId: conversationId,
      details: `Asignación de conversación eliminada`,
      ip: getClientIp(req)
    });

    res.json({ message: 'Conversation unassigned successfully', conversation: result });
  } catch (error: any) {
    console.error('Error in /assignment/unassign:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/assignment/transfer - Transfer to agent
router.post('/transfer', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const orgId = req.organizationId;
    const fromUserId = req.headers['x-user-id'] as string;
    const { conversationId, toUserId, reason } = req.body;

    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });
    if (!conversationId) return res.status(400).json({ error: 'Conversation ID required' });
    if (!toUserId) return res.status(400).json({ error: 'Target user ID required' });
    if (!fromUserId) return res.status(400).json({ error: 'From user ID required' });

    // Verify conversation belongs to organization
    const { data: conversation, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('organization_id', orgId)
      .single();

    if (error || !conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const result = await assignmentService.transferConversation(
      conversationId,
      fromUserId,
      toUserId,
      orgId,
      reason
    );

    // Auditoría
    auditLogService.log({
      organizationId: orgId,
      userId: fromUserId,
      userEmail: (req as any).user?.email,
      action: 'TRANSFER',
      resourceType: 'conversation',
      resourceId: conversationId,
      details: `Conversación transferida a ${toUserId}${reason ? ` (${reason})` : ''}`,
      ip: getClientIp(req),
      metadata: { toAgentId: toUserId, reason }
    });

    res.json({ message: 'Conversation transferred successfully', conversation: result });
  } catch (error: any) {
    console.error('Error in /assignment/transfer:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/assignment/transfer-department - Transfer to department
router.post('/transfer-department', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const orgId = req.organizationId;
    const fromUserId = req.headers['x-user-id'] as string;
    const { conversationId, departmentId, reason } = req.body;

    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });
    if (!conversationId) return res.status(400).json({ error: 'Conversation ID required' });
    if (!departmentId) return res.status(400).json({ error: 'Department ID required' });
    if (!fromUserId) return res.status(400).json({ error: 'From user ID required' });

    // Verify conversation belongs to organization
    const { data: conversation, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('organization_id', orgId)
      .single();

    if (error || !conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const result = await assignmentService.transferConversationToDepartment(
      conversationId,
      fromUserId,
      departmentId,
      orgId,
      reason
    );
    res.json({ message: 'Conversation transferred to department successfully', conversation: result });
  } catch (error: any) {
    console.error('Error in /assignment/transfer-department:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/assignment/workload/:userId - Get agent workload
router.get('/workload/:userId', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const orgId = req.organizationId;
    const { userId } = req.params;

    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });

    const workload = await assignmentService.getAgentWorkload(userId as string, orgId);
    res.json(workload);
  } catch (error: any) {
    console.error('Error in /assignment/workload/:userId:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/assignment/availability - Set agent availability
router.post('/availability', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const orgId = req.organizationId;
    const userId = Array.isArray(req.headers['x-user-id']) ? req.headers['x-user-id'][0] : req.headers['x-user-id'] as string;
    const { isAvailable } = req.body;

    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });
    if (!userId) return res.status(400).json({ error: 'User ID required' });
    if (isAvailable === undefined) return res.status(400).json({ error: 'isAvailable required' });

    const workload = await assignmentService.setAgentAvailability(userId, orgId, isAvailable);
    res.json({ message: 'Agent availability updated', workload });
  } catch (error: any) {
    console.error('Error in /assignment/availability:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/assignment/online-status - Set agent online status
router.post('/online-status', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const orgId = req.organizationId;
    const userId = Array.isArray(req.headers['x-user-id']) ? req.headers['x-user-id'][0] : req.headers['x-user-id'] as string;
    const { isOnline } = req.body;

    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });
    if (!userId) return res.status(400).json({ error: 'User ID required' });
    if (isOnline === undefined) return res.status(400).json({ error: 'isOnline required' });

    const workload = await assignmentService.setAgentOnlineStatus(userId, orgId, isOnline);
    res.json({ message: 'Agent online status updated', workload });
  } catch (error: any) {
    console.error('Error in /assignment/online-status:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/assignment/agents - Get all agents in organization
router.get('/agents', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const orgId = req.organizationId;

    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });

    const { data: agents, error } = await supabase
      .from('agent_workload')
      .select(`
        *,
        users(name, email, avatar_url)
      `)
      .eq('organization_id', orgId);

    if (error) throw error;

    res.json(agents);
  } catch (error: any) {
    console.error('Error in /assignment/agents:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
