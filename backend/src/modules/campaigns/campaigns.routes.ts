import express from 'express';
import { campaignsService } from './campaigns.service';

const router = express.Router();

// POST /api/campaigns/parse-excel - Parsear Excel y devolver contactos
router.post('/parse-excel', async (req: any, res: any) => {
  try {
    const { fileName, base64Data } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'Se requiere el contenido del archivo (base64Data)' });
    }

    const result = await campaignsService.parseExcel(fileName, base64Data);
    res.json(result);
  } catch (err: any) {
    console.error('[Campaigns] Error parsing Excel:', err);
    res.status(500).json({ error: 'No se pudo leer el archivo Excel. Verifica que sea un archivo .xlsx o .xls válido.' });
  }
});

// GET /api/campaigns - Listar campañas
router.get('/', async (req: any, res: any) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) return res.status(404).json({ error: 'Organization not found' });

    const campaigns = await campaignsService.listCampaigns(orgId);
    res.json(campaigns);
  } catch (err: any) {
    console.error('[Campaigns] Error listing campaigns:', err);
    res.status(500).json({ error: 'No se pudieron cargar las campañas' });
  }
});

// GET /api/campaigns/:id - Detalle de campaña
router.get('/:id', async (req: any, res: any) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) return res.status(404).json({ error: 'Organization not found' });

    const campaign = await campaignsService.getCampaign(req.params.id, orgId);
    const contacts = await campaignsService.getCampaignContacts(
      req.params.id,
      orgId,
      Math.min(parseInt(req.query.limit as string) || 200, 500),
      parseInt(req.query.offset as string) || 0
    );

    res.json({ ...campaign, ...contacts });
  } catch (err: any) {
    console.error('[Campaigns] Error fetching campaign:', err);
    res.status(404).json({ error: 'Campaña no encontrada' }); 
  }
});

// POST /api/campaigns - Crear campaña
router.post('/', async (req: any, res: any) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) return res.status(404).json({ error: 'Organization not found' });

    const { name, messageTemplate, whatsappConnectionId, delayMs, contacts, metaTemplateName, metaTemplateLanguage, useMarketingApi } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre de la campaña es obligatorio' });
    }
    if (!messageTemplate || !messageTemplate.trim()) {
      return res.status(400).json({ error: 'El mensaje de la campaña es obligatorio' });
    }
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Debes cargar al menos un contacto' });
    }

    const campaign = await campaignsService.createCampaign({
      organizationId: orgId,
      name: name.trim(),
      messageTemplate: messageTemplate.trim(),
      whatsappConnectionId: whatsappConnectionId || null,
      delayMs,
      contacts,
      createdBy: (req as any).userId || null,
      metaTemplateName: metaTemplateName || null,
      metaTemplateLanguage: metaTemplateLanguage || 'es',
      useMarketingApi: useMarketingApi === true,
    });

    res.status(201).json(campaign);
  } catch (err: any) {
    console.error('[Campaigns] Error creating campaign:', err);
    res.status(500).json({ error: 'No se pudo crear la campaña' });
  }
});

// PUT /api/campaigns/:id - Actualizar campaña (nombre, mensaje, conexión, delay)
router.put('/:id', async (req: any, res: any) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) return res.status(404).json({ error: 'Organization not found' });

    const updates: any = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.messageTemplate !== undefined) updates.message_template = req.body.messageTemplate;
    if (req.body.whatsappConnectionId !== undefined) updates.whatsapp_connection_id = req.body.whatsappConnectionId;
    if (req.body.delayMs !== undefined) updates.delay_ms = Math.max(Number(req.body.delayMs) || 3000, 500);
    if (req.body.useMarketingApi !== undefined) updates.use_marketing_api = req.body.useMarketingApi === true;
    if (req.body.metaTemplateName !== undefined) updates.meta_template_name = req.body.metaTemplateName;
    if (req.body.metaTemplateLanguage !== undefined) updates.meta_template_language = req.body.metaTemplateLanguage;

    const campaign = await campaignsService.updateCampaign(req.params.id, orgId, updates);
    res.json(campaign);
  } catch (err: any) {
    console.error('[Campaigns] Error updating campaign:', err);
    res.status(404).json({ error: 'Campaña no encontrada' });
  }
});

// POST /api/campaigns/:id/send - Iniciar envío
router.post('/:id/send', async (req: any, res: any) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) return res.status(404).json({ error: 'Organization not found' });

    const result = await campaignsService.startSending(req.params.id, orgId);
    res.json(result);
  } catch (err: any) {
    console.error('[Campaigns] Error starting send:', err);
    res.status(400).json({ error: err.message || 'No se pudo iniciar el envío' });
  }
});

// POST /api/campaigns/:id/pause - Pausar envío
router.post('/:id/pause', async (req: any, res: any) => {
  try {
    const result = await campaignsService.pauseSending(req.params.id);
    res.json(result);
  } catch (err: any) {
    console.error('[Campaigns] Error pausing send:', err);
    res.status(400).json({ error: err.message || 'No se pudo pausar el envío' });
  }
});

// POST /api/campaigns/:id/resume - Reanudar envío
router.post('/:id/resume', async (req: any, res: any) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) return res.status(404).json({ error: 'Organization not found' });

    const result = await campaignsService.resumeSending(req.params.id, orgId);
    res.json(result);
  } catch (err: any) {
    console.error('[Campaigns] Error resuming send:', err);
    res.status(400).json({ error: err.message || 'No se pudo reanudar el envío' });
  }
});

// DELETE /api/campaigns/:id - Eliminar campaña
router.delete('/:id', async (req: any, res: any) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) return res.status(404).json({ error: 'Organization not found' });

    const result = await campaignsService.deleteCampaign(req.params.id, orgId);
    res.json(result);
  } catch (err: any) {
    console.error('[Campaigns] Error deleting campaign:', err);
    res.status(500).json({ error: 'No se pudo eliminar la campaña' });
  }
});

export default router;
