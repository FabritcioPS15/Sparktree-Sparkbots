import { Router, Response } from 'express';
import { multiPlatformService } from './platform/multiPlatformService';
import { whatsappCloudService } from './platform/whatsappCloudService';
import { supabase } from '../../core/config/supabase';
import { tenantMiddleware, TenantRequest } from '../../core/middleware/tenant';

const router = Router();

const SENSITIVE_CONFIG_KEYS = [
  'access_token',
  'refresh_token',
  'bot_token',
  'page_access_token',
  'app_secret',
  'appsecret',
  'webhook_secret',
  'verify_token',
  'webhook_verify_token',
  'phone_number_id',
  'instagram_business_account_id',
  'facebook_page_id',
];

const sanitizeConfig = (config: Record<string, any> | null | undefined): Record<string, any> | undefined => {
  if (!config || typeof config !== 'object') return undefined;
  const safe: Record<string, any> = {};
  for (const [key, value] of Object.entries(config)) {
    if (SENSITIVE_CONFIG_KEYS.includes(key)) continue;
    safe[key] = value;
  }
  return safe;
};

const sanitizeConnection = (conn: any) => {
  if (!conn) return conn;
  return {
    id: conn.id,
    organization_id: conn.organization_id,
    user_id: conn.user_id,
    platform_type: conn.platform_type,
    display_name: conn.display_name,
    platform_account_id: conn.platform_account_id,
    status: conn.status,
    connected_at: conn.connected_at,
    last_connected_at: conn.last_connected_at,
    created_at: conn.created_at,
    config: sanitizeConfig(conn.config),
  };
};

// GET /api/platform/connections
router.get('/connections', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization ID required. Add X-Organization-ID header.' });

    const { data: connections, error } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('organization_id', orgId);

    if (error) {
      if (error.code === '42P01') {
        console.warn('[Platform] Tabla platform_connections no existe aún.');
        return res.json([]);
      }
      console.error('[Platform] Error fetching connections:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json((connections || []).map(sanitizeConnection));
  } catch (error: any) {
    console.error('Error in /platform/connections:', error);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

// GET /api/platform/connections/:id
router.get('/connections/:id', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.organizationId;

    if (!orgId) return res.status(400).json({ error: 'Organization ID required. Add X-Organization-ID header.' });

    const { data: connection, error } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single();

    if (error || !connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const status = await multiPlatformService.getConnectionStatus(id as string);
    return res.json(status);
  } catch (error: any) {
    console.error('Error in /platform/connections/:id:', error);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

// POST /api/platform/connections
router.post('/connections', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const orgId = req.organizationId;
    const userId = Array.isArray(req.headers['x-user-id']) ? req.headers['x-user-id'][0] : req.headers['x-user-id'] as string;
    const { platformType, displayName, config } = req.body;

    if (!orgId) return res.status(400).json({ error: 'Organization ID required. Add X-Organization-ID header.' });
    if (!userId) return res.status(400).json({ error: 'User ID required. Add X-User-ID header.' });
    if (!platformType) return res.status(400).json({ error: 'Platform type required' });
    if (!displayName) return res.status(400).json({ error: 'Display name required' });
    if (!config) return res.status(400).json({ error: 'Config required' });

    // Validate platform type
    const validPlatforms = ['whatsapp', 'telegram', 'instagram', 'tiktok', 'facebook_messenger', 'mercadolibre'];
    if (!validPlatforms.includes(platformType)) {
      return res.status(400).json({ error: `Invalid platform type. Must be one of: ${validPlatforms.join(', ')}` });
    }

    // Validate config based on platform type
    if (platformType === 'whatsapp') {
      if (!config.phone_number_id || !config.access_token) {
        return res.status(400).json({ error: 'WhatsApp Cloud requires phone_number_id and access_token' });
      }
    } else if (platformType === 'telegram') {
      if (!config.bot_token || !config.bot_username) {
        return res.status(400).json({ error: 'Telegram requires bot_token and bot_username' });
      }
    } else if (platformType === 'instagram') {
      if (!config.instagram_business_account_id || !config.facebook_page_id || !config.access_token) {
        return res.status(400).json({ error: 'Instagram requires instagram_business_account_id, facebook_page_id, and access_token' });
      }
    } else if (platformType === 'tiktok') {
      if (!config.access_token) {
        return res.status(400).json({ error: 'TikTok requires access_token' });
      }
    } else if (platformType === 'facebook_messenger') {
      if (!config.page_id || !config.page_access_token || !config.app_id || !config.app_secret) {
        return res.status(400).json({ error: 'Facebook Messenger requires page_id, page_access_token, app_id, and app_secret' });
      }
    } else if (platformType === 'mercadolibre') {
      if (!config.seller_id || !config.access_token || !config.app_id || !config.app_secret) {
        return res.status(400).json({ error: 'Mercado Libre requires seller_id, access_token, app_id, and app_secret' });
      }
    }

    const connection = await multiPlatformService.createConnection(userId, platformType, displayName, config);
    res.json({ message: 'Platform connection created', connection });
  } catch (error: any) {
    console.error('Error in /platform/connections POST:', error);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

// POST /api/platform/connections/:id/start
router.post('/connections/:id/start', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.organizationId;

    if (!orgId) return res.status(400).json({ error: 'Organization ID required. Add X-Organization-ID header.' });

    // Verify connection belongs to organization
    const { data: connection, error } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single();

    if (error || !connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    await multiPlatformService.startConnection(id as string);
    res.json({ message: 'Platform connection started' });
  } catch (error: any) {
    console.error('Error in /platform/connections/:id/start:', error);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

// POST /api/platform/connections/:id/delete
router.post('/connections/:id/delete', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.organizationId;
    const userId = Array.isArray(req.headers['x-user-id']) ? req.headers['x-user-id'][0] : req.headers['x-user-id'] as string;

    if (!orgId) return res.status(400).json({ error: 'Organization ID required. Add X-Organization-ID header.' });
    if (!userId) return res.status(400).json({ error: 'User ID required. Add X-User-ID header.' });

    // Verify connection belongs to organization
    const { data: connection, error } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single();

    if (error || !connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    await multiPlatformService.deleteConnection(id as string, userId);
    res.json({ message: 'Platform connection deleted' });
  } catch (error: any) {
    console.error('Error in /platform/connections/:id/delete:', error);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

// PATCH /api/platform/connections/:id/phone
router.patch('/connections/:id/phone', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.organizationId;
    const { phoneNumber } = req.body;

    if (!orgId) return res.status(400).json({ error: 'Organization ID required. Add X-Organization-ID header.' });
    if (!phoneNumber) return res.status(400).json({ error: 'Phone number is required' });

    const { data: connection, error: fetchError } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single();

    if (fetchError || !connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const currentConfig = connection.config || {};
    const { data: updated, error } = await supabase
      .from('platform_connections')
      .update({ config: { ...currentConfig, phone_number: phoneNumber } })
      .eq('id', id)
      .eq('organization_id', orgId)
      .select()
      .single();

    if (error) {
      console.error('Error updating connection phone number:', error);
      return res.status(500).json({ error: error.message || 'Failed to update phone number' });
    }

    res.json({ message: 'Phone number updated', connection: updated });
  } catch (error: any) {
    console.error('Error in /platform/connections/:id/phone:', error);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

// PATCH /api/platform/connections/:id/waba - Update WABA ID of a connection
router.patch('/connections/:id/waba', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.organizationId;
    const { wabaId } = req.body;

    if (!orgId) return res.status(400).json({ error: 'Organization ID required. Add X-Organization-ID header.' });
    if (!wabaId) return res.status(400).json({ error: 'WABA ID is required' });

    const { data: connection, error: fetchError } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single();

    if (fetchError || !connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const currentConfig = connection.config || {};
    const { data: updated, error } = await supabase
      .from('platform_connections')
      .update({ config: { ...currentConfig, waba_id: wabaId } })
      .eq('id', id)
      .eq('organization_id', orgId)
      .select()
      .single();

    if (error) {
      console.error('Error updating connection WABA ID:', error);
      return res.status(500).json({ error: error.message || 'Failed to update WABA ID' });
    }

    await whatsappCloudService.initializeConnection(updated);

    res.json({ message: 'WABA ID updated', connection: updated });
  } catch (error: any) {
    console.error('Error in /platform/connections/:id/waba:', error);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

// GET /api/platform/connections/:id/marketing-eligibility
router.get('/connections/:id/marketing-eligibility', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization ID required.' });

    const { data: connection, error } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single();

    if (error || !connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    if (connection.platform_type !== 'whatsapp') {
      return res.status(400).json({ error: 'MM API for WhatsApp solo aplica a conexiones WhatsApp Cloud' });
    }

    await whatsappCloudService.initializeConnection(connection);
    const eligibility = await whatsappCloudService.getMarketingMessagesEligibility(id);
    res.json(eligibility);
  } catch (error: any) {
    console.error('Error in /platform/connections/:id/marketing-eligibility:', error);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

// POST /api/platform/connections/:id/marketing-message
router.post('/connections/:id/marketing-message', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization ID required.' });

    const { to, body, messageActivitySharing, templateName, languageCode, components } = req.body;
    if (!to) return res.status(400).json({ error: 'to (número de WhatsApp) es requerido' });

    const { data: connection, error } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single();

    if (error || !connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    if (connection.platform_type !== 'whatsapp') {
      return res.status(400).json({ error: 'MM API for WhatsApp solo aplica a conexiones WhatsApp Cloud' });
    }

    await whatsappCloudService.initializeConnection(connection);
    const result = await whatsappCloudService.sendMarketingMessage(id, to, body || '', {
      messageActivitySharing,
      templateName,
      languageCode,
      components,
    });

    res.json({ message: 'Mensaje de marketing enviado', result });
  } catch (error: any) {
    const metaError = error?.response?.data?.error?.message || error?.response?.data?.error || error.message;
    console.error('Error in /platform/connections/:id/marketing-message:', metaError);
    if (!res.headersSent) res.status(500).json({ error: metaError });
  }
});

// POST /api/platform/whatsapp-cloud
router.post('/whatsapp-cloud', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const orgId = req.organizationId;
    const userId = (req as any).user?.id
      || (Array.isArray(req.headers['x-user-id']) ? req.headers['x-user-id'][0] : req.headers['x-user-id'])
      || (req as any).userId;
    const { phoneNumberId, accessToken, displayName, webhookVerifyToken, phoneNumber, wabaId } = req.body;

    if (!orgId) return res.status(400).json({ error: 'Organization ID required.' });
    if (!phoneNumberId) return res.status(400).json({ error: 'Phone Number ID required' });
    if (!accessToken) return res.status(400).json({ error: 'Access Token required' });
    if (!displayName) return res.status(400).json({ error: 'Display name required' });

    // Create or update connection in database (upsert)
    const { data: connection, error } = await supabase
      .from('platform_connections')
      .upsert({
        ...(userId ? { user_id: userId } : {}),
        organization_id: orgId,
        platform_type: 'whatsapp',
        display_name: displayName,
        platform_account_id: phoneNumberId,
        config: {
          phone_number_id: phoneNumberId,
          access_token: accessToken,
          webhook_verify_token: webhookVerifyToken || `sparktree_${orgId?.slice(0, 8)}_${Date.now().toString(36)}`,
          phone_number: phoneNumber || null,
          ...(wabaId ? { waba_id: wabaId } : {}),
        },
        status: 'connected',
        last_connected_at: new Date().toISOString()
      }, { onConflict: 'organization_id,platform_type,platform_account_id' })
      .select()
      .single();

    if (error) {
      console.error('Error creating WhatsApp Cloud connection DB:', error);
      return res.status(500).json({ error: error.message || error.details || 'Failed to create connection in database' });
    }

    // Initialize connection in service
    await whatsappCloudService.initializeConnection(connection);
    await whatsappCloudService.startConnection(connection.id);

    res.json({
      message: 'WhatsApp Cloud connection created successfully',
      connection: {
        id: connection.id,
        platformType: 'whatsapp',
        displayName: connection.display_name,
        status: 'connected'
      }
    });
  } catch (error: any) {
    console.error('Error in /platform/whatsapp-cloud:', error);
    if (!res.headersSent) res.status(500).json({ error: error.message || 'Server error' });
  }
});

// GET /api/platform/connections/:id/templates
router.get('/connections/:id/templates', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization ID required.' });

    console.log(`[Platform] Fetching templates for connection ${id}, org: ${orgId}`);

    const { data: connection, error } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single();

    if (error || !connection) {
      console.error(`[Platform] Connection ${id} not found for org ${orgId}`);
      return res.status(404).json({ error: 'Connection not found' });
    }

    console.log(`[Platform] Connection found: ${connection.display_name}, platform_account_id: ${connection.platform_account_id}, status: ${connection.status}`);

    await whatsappCloudService.initializeConnection(connection);
    const templates = await whatsappCloudService.getMetaTemplates(id);
    return res.json(templates);
  } catch (error: any) {
    console.error('[Platform] Error fetching Meta templates:', error?.response?.data || error.message);
    if (!res.headersSent) res.status(500).json({ error: error?.response?.data?.error?.message || error.message });
  }
});

// POST /api/platform/connections/:id/templates
router.post('/connections/:id/templates', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization ID required.' });

    const { name, category, language, components } = req.body;
    if (!name || !category || !language || !components) {
      return res.status(400).json({ error: 'name, category, language y components son requeridos' });
    }

    const { data: connection, error } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single();

    if (error || !connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    await whatsappCloudService.initializeConnection(connection);
    const result = await whatsappCloudService.createMetaTemplate(id, { name, category, language, components });
    return res.json({ message: 'Template enviado a Meta para aprobación', template: result });
  } catch (error: any) {
    console.error('Error creating Meta template:', error?.response?.data || error.message);
    const metaError = error?.response?.data?.error?.error_user_msg || error?.response?.data?.error?.message || error.message;
    if (!res.headersSent) res.status(500).json({ error: metaError });
  }
});

// DELETE /api/platform/connections/:id/templates/:templateName
router.delete('/connections/:id/templates/:templateName', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const { id, templateName } = req.params;
    const orgId = req.organizationId;
    const templateId = req.query.templateId as string || '';
    if (!orgId) return res.status(400).json({ error: 'Organization ID required.' });

    const { data: connection, error } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single();

    if (error || !connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    await whatsappCloudService.initializeConnection(connection);
    await whatsappCloudService.deleteMetaTemplate(id, templateId, templateName);
    return res.json({ message: `Template "${templateName}" eliminado` });
  } catch (error: any) {
    console.error('Error deleting Meta template:', error?.response?.data || error.message);
    const metaError = error?.response?.data?.error?.message || error.message;
    if (!res.headersSent) res.status(500).json({ error: metaError });
  }
});

export default router;
