import express from 'express';
import { supabase } from '../../core/config/supabase';

const router = express.Router();

// GET /api/users/team - Lista de agentes/usuarios de la organización (para asignación)
router.get('/team', async (req, res) => {
  try {
    const orgId = (req as any).organizationId;
    if (!orgId) return res.status(404).json({ error: 'Organization not found' });

    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, name, full_name, avatar_url, role')
      .eq('organization_id', orgId)
      .order('full_name', { ascending: true });

    if (error) throw error;

    const team = (users || []).map(u => ({
      id: u.id,
      email: u.email,
      name: u.full_name || u.name || u.email || '',
      full_name: u.full_name || '',
      avatar_url: u.avatar_url,
      role: u.role
    }));

    res.json(team);
  } catch (error) {
    console.error('Error in /api/users/team:', error);
    res.status(500).json({ error: 'Failed to fetch team users' });
  }
});

// GET /api/users (WhatsApp contacts)
router.get('/', async (req, res) => {
  try {
    const orgId = (req as any).organizationId;
    if (!orgId) return res.status(404).json({ error: 'Organization not found' });

    const limit = Math.min(parseInt(req.query.limit as string, 10) || 200, 500);
    const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

    // Fetch contacts (bounded to prevent unbounded scans)
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, phone_number, profile_name, last_active_at, created_at, bot_state')
      .eq('organization_id', orgId)
      .order('last_active_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (contactsError) throw contactsError;

    const contactIds = contacts.map(c => c.id);
    
    // Fetch message counts
    const { data: counts, error: countsError } = await supabase
      .from('messages')
      .select('contact_id')
      .eq('organization_id', orgId)
      .in('contact_id', contactIds);

    if (countsError) throw countsError;

    const messageCounts = counts.reduce((acc: any, msg: any) => {
      acc[msg.contact_id] = (acc[msg.contact_id] || 0) + 1;
      return acc;
    }, {});

    // Fetch latest conversation for each contact to see which bot/connection they are using
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('contact_id, whatsapp_connection_id, whatsapp_connections(display_name, phone_number)')
      .eq('organization_id', orgId)
      .in('contact_id', contactIds)
      .order('last_message_at', { ascending: false });

    if (convError) throw convError;

    // Map latest conversation to contact
    const contactBotMap = (conversations || []).reduce((acc: any, conv: any) => {
      if (!acc[conv.contact_id]) {
        acc[conv.contact_id] = {
          attendedBy: conv.whatsapp_connections?.display_name || 'Bot SparkBot',
          serviceNumber: conv.whatsapp_connections?.phone_number || 'N/A'
        };
      }
      return acc;
    }, {});

    // Transform to frontend format
    const transformed = contacts.map(c => ({
      id: c.id,
      phoneNumber: c.phone_number,
      name: c.profile_name || 'Usuario Anon',
      firstInteraction: c.created_at,
      lastInteraction: c.last_active_at,
      totalMessages: messageCounts[c.id] || 0,
      botState: c.bot_state,
      attendedBy: contactBotMap[c.id]?.attendedBy || 'Bot SparkBot',
      serviceNumber: contactBotMap[c.id]?.serviceNumber || 'N/A'
    }));

    res.json(transformed);
  } catch (error) {
    console.error('Error in /api/users:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
  try {
    const orgId = (req as any).organizationId;
    const { id } = req.params;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id)
      .eq('organization_id', orgId);

    if (error) throw error;
    res.json({ success: true, message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// POST /api/users/delete-bulk
router.post('/delete-bulk', async (req, res) => {
  try {
    const orgId = (req as any).organizationId;
    const { ids } = req.body;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Invalid IDs' });

    const { error } = await supabase
      .from('contacts')
      .delete()
      .in('id', ids)
      .eq('organization_id', orgId);

    if (error) throw error;
    res.json({ success: true, message: `${ids.length} contacts deleted successfully` });
  } catch (error) {
    console.error('Error in bulk delete:', error);
    res.status(500).json({ error: 'Failed to perform bulk deletion' });
  }
});

export default router;
