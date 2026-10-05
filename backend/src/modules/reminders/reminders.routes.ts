import express from 'express';
import * as XLSX from 'xlsx';
import { remindersService } from './reminders.service';
import { authenticateToken } from '../../core/middleware/auth';
import { tenantMiddleware } from '../../shared/middleware/tenant.middleware';

const router = express.Router();

// Apply auth + tenant middleware to all routes
router.use(authenticateToken);
router.use(tenantMiddleware.use.bind(tenantMiddleware));

// GET /api/reminders/template-excel - Descargar plantilla Excel limpia y editable
router.get('/template-excel', async (req: any, res: any) => {
  try {
    const wb = XLSX.utils.book_new();

    const headers = ['telefono', 'nombre_completo', 'placa', 'dni', 'fecha_revision', 'dias'];

    // dias se calcula solo en Excel: días transcurridos desde fecha_revision (columna E)
    // =SI(E2="";"";HOY()-E2) -> se guarda en inglés (=IF/ TODAY) y Excel lo muestra localizado.
    // Fecha base = columna E (fecha_revision); resultado = número entero con formato General.
    const formulaCell = (rowNumber: number, cachedValue: number) => ({
      f: `=IF(E${rowNumber}="","",TODAY()-E${rowNumber})`,
      t: 'n' as const,
      v: cachedValue,
      z: 'General',
    });

    const sampleData: any[][] = [
      ['999888777', 'Juan Pérez García', 'ABC-123', '45678901', '15/08/2026', formulaCell(2, 37)],
      ['999777666', 'María López Martínez', 'XYZ-456', '12345678', '20/08/2026', formulaCell(3, 32)],
      ['999666555', 'Carlos Rodríguez Soto', 'DEF-789', '87654321', '25/08/2026', formulaCell(4, 27)],
    ];

    const wsData = [headers, ...sampleData];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Configurar anchos de columna amplios para fácil lectura y edición
    ws['!cols'] = [
      { wch: 18 },  // telefono
      { wch: 28 },  // nombre_completo
      { wch: 15 },  // placa
      { wch: 15 },  // dni
      { wch: 18 },  // fecha_revision
      { wch: 12 },  // dias
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Contactos');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=plantilla_recordatorios.xlsx');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(Buffer.from(buffer));
  } catch (err: any) {
    console.error('[Reminders] Error generating template:', err);
    res.status(500).json({ error: 'No se pudo generar la plantilla' });
  }
});

// POST /api/reminders/template-excel-dynamic - Generar Excel dinámico desde variables del template
router.post('/template-excel-dynamic', async (req: any, res: any) => {
  try {
    const { variables, templateName } = req.body;
    if (!Array.isArray(variables) || variables.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de variables' });
    }

    const wb = XLSX.utils.book_new();
    const headers = ['telefono', ...variables];

    const sampleRow1 = ['999888777', ...variables.map((v: string) => {
      const lower = v.toLowerCase();
      if (lower.includes('nom') || lower.includes('cli')) return 'Juan Pérez';
      if (lower.includes('plac') || lower.includes('veh')) return 'ABC-123';
      if (lower.includes('fec') || lower.includes('date')) return '15/08/2026';
      if (lower.includes('dni') || lower.includes('doc')) return '45678901';
      if (lower.includes('monto') || lower.includes('precio')) return '150.00';
      return `Valor ${v}`;
    })];

    const sampleRow2 = ['999777666', ...variables.map((v: string) => {
      const lower = v.toLowerCase();
      if (lower.includes('nom') || lower.includes('cli')) return 'María López';
      if (lower.includes('plac') || lower.includes('veh')) return 'XYZ-456';
      if (lower.includes('fec') || lower.includes('date')) return '20/08/2026';
      if (lower.includes('dni') || lower.includes('doc')) return '12345678';
      if (lower.includes('monto') || lower.includes('precio')) return '150.00';
      return `Valor ${v}`;
    })];

    const wsData = [headers, sampleRow1, sampleRow2];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = headers.map((h: string) => ({ wch: Math.max(h.length + 8, 20) }));

    XLSX.utils.book_append_sheet(wb, ws, 'Contactos');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=plantilla_${templateName || 'template'}.xlsx`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(Buffer.from(buffer));
  } catch (err: any) {
    console.error('[Reminders] Error generating dynamic template:', err);
    res.status(500).json({ error: 'No se pudo generar la plantilla' });
  }
});

// POST /api/reminders/parse-excel - Parsear Excel y devolver contactos
router.post('/parse-excel', async (req: any, res: any) => {
  try {
    const { fileName, base64Data } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'Se requiere el contenido del archivo (base64Data)' });
    }

    const result = await remindersService.parseExcel(fileName, base64Data);
    res.json(result);
  } catch (err: any) {
    console.error('[Reminders] Error parsing Excel:', err);
    res.status(500).json({ error: 'No se pudo leer el archivo Excel. Verifica que sea un archivo .xlsx o .xls válido.' });
  }
});

// GET /api/reminders/export/general - Exportar reporte consolidado de todos los recordatorios en Excel
router.get('/export/general', async (req: any, res: any) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) return res.status(404).json({ error: 'Organization not found' });

    const { buffer, fileName } = await remindersService.exportGeneralRemindersExcel(orgId);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(Buffer.from(buffer));
  } catch (err: any) {
    console.error('[Reminders] Error exporting general report:', err);
    res.status(500).json({ error: 'No se pudo generar el reporte general en Excel' });
  }
});

// GET /api/reminders - Listar recordatorios
router.get('/', async (req: any, res: any) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) return res.status(404).json({ error: 'Organization not found' });

    const reminders = await remindersService.listReminders(orgId);
    res.json(reminders);
  } catch (err: any) {
    console.error('[Reminders] Error listing reminders:', err);
    res.status(500).json({ error: 'No se pudieron cargar los recordatorios' });
  }
});

// GET /api/reminders/:id/export-excel - Exportar reporte detallado de contactos y estados en Excel
router.get('/:id/export-excel', async (req: any, res: any) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) return res.status(404).json({ error: 'Organization not found' });

    const { buffer, fileName } = await remindersService.exportReminderReportExcel(req.params.id, orgId);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(Buffer.from(buffer));
  } catch (err: any) {
    console.error('[Reminders] Error exporting reminder report:', err);
    res.status(500).json({ error: err.message || 'No se pudo generar el reporte del recordatorio en Excel' });
  }
});

// GET /api/reminders/:id/contacts-all - Obtener todos los contactos de un recordatorio sin paginar
router.get('/:id/contacts-all', async (req: any, res: any) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) return res.status(404).json({ error: 'Organization not found' });

    const contacts = await remindersService.getAllReminderContacts(req.params.id, orgId);
    res.json(contacts);
  } catch (err: any) {
    console.error('[Reminders] Error getting all contacts:', err);
    res.status(500).json({ error: 'No se pudieron cargar todos los contactos' });
  }
});

// GET /api/reminders/:id - Detalle de recordatorio
router.get('/:id', async (req: any, res: any) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) return res.status(404).json({ error: 'Organization not found' });

    const reminder = await remindersService.getReminder(req.params.id, orgId);
    if (!reminder) return res.status(404).json({ error: 'Recordatorio no encontrado' });

    const contacts = await remindersService.getReminderContacts(
      req.params.id,
      orgId,
      Math.min(parseInt(req.query.limit as string) || 200, 500),
      parseInt(req.query.offset as string) || 0
    );
    const logs = await remindersService.getReminderLogs(req.params.id, orgId);

    res.json({ ...reminder, ...contacts, logs });
  } catch (err: any) {
    res.status(404).json({ error: 'Recordatorio no encontrado' });
  }
});

// POST /api/reminders - Crear recordatorio
router.post('/', async (req: any, res: any) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) return res.status(404).json({ error: 'Organization not found' });

    const { name, messageTemplate, whatsappConnectionId, scheduleType, scheduledAt, recurringCron, recurringTimezone, delayMs, contacts, imageBase64, metaTemplateName, metaTemplateLanguage } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre del recordatorio es obligatorio' });
    }
    if (!messageTemplate || !messageTemplate.trim()) {
      return res.status(400).json({ error: 'El mensaje del recordatorio es obligatorio' });
    }
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Debes cargar al menos un contacto' });
    }

    const reminder = await remindersService.createReminder({
      organizationId: orgId,
      name: name.trim(),
      messageTemplate: messageTemplate.trim(),
      whatsappConnectionId: whatsappConnectionId || null,
      scheduleType: scheduleType || 'now',
      scheduledAt: scheduledAt || null,
      recurringCron: recurringCron || null,
      recurringTimezone: recurringTimezone || null,
      delayMs,
      contacts,
      createdBy: (req as any).userId || null,
      imageBase64: imageBase64 || null,
      metaTemplateName: metaTemplateName || null,
      metaTemplateLanguage: metaTemplateLanguage || 'es',
    });

    res.status(201).json(reminder);
  } catch (err: any) {
    console.error('[Reminders] Error creating reminder:', err);
    res.status(500).json({ error: 'No se pudo crear el recordatorio' });
  }
});

// PUT /api/reminders/:id - Actualizar recordatorio
router.put('/:id', async (req: any, res: any) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) return res.status(404).json({ error: 'Organization not found' });

    const updates: any = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.messageTemplate !== undefined) updates.message_template = req.body.messageTemplate;
    if (req.body.whatsappConnectionId !== undefined) updates.whatsapp_connection_id = req.body.whatsappConnectionId;
    if (req.body.scheduleType !== undefined) updates.schedule_type = req.body.scheduleType;
    if (req.body.scheduledAt !== undefined) updates.scheduled_at = req.body.scheduledAt;
    if (req.body.recurringCron !== undefined) updates.recurring_cron = req.body.recurringCron;
    if (req.body.delayMs !== undefined) updates.delay_ms = Math.max(Number(req.body.delayMs) || 3000, 500);

    const reminder = await remindersService.updateReminder(req.params.id, orgId, updates);
    res.json(reminder);
  } catch (err: any) {
    console.error('[Reminders] Error updating reminder:', err);
    res.status(404).json({ error: 'Recordatorio no encontrado' });
  }
});

// POST /api/reminders/:id/send - Iniciar envío
router.post('/:id/send', async (req: any, res: any) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) return res.status(404).json({ error: 'Organization not found' });

    const result = await remindersService.startSending(req.params.id, orgId);
    res.json(result);
  } catch (err: any) {
    console.error('[Reminders] Error starting send:', err);
    res.status(400).json({ error: err.message || 'No se pudo iniciar el envío' });
  }
});

// POST /api/reminders/:id/pause - Pausar envío
router.post('/:id/pause', async (req: any, res: any) => {
  try {
    const result = await remindersService.pauseSending(req.params.id);
    res.json(result);
  } catch (err: any) {
    console.error('[Reminders] Error pausing send:', err);
    res.status(400).json({ error: err.message || 'No se pudo pausar el envío' });
  }
});

// POST /api/reminders/:id/resume - Reanudar envío
router.post('/:id/resume', async (req: any, res: any) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) return res.status(404).json({ error: 'Organization not found' });

    const result = await remindersService.resumeSending(req.params.id, orgId);
    res.json(result);
  } catch (err: any) {
    console.error('[Reminders] Error resuming send:', err);
    res.status(400).json({ error: err.message || 'No se pudo reanudar el envío' });
  }
});

// POST /api/reminders/:id/cancel - Cancelar recordatorio
router.post('/:id/cancel', async (req: any, res: any) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) return res.status(404).json({ error: 'Organization not found' });

    const result = await remindersService.cancelReminder(req.params.id, orgId);
    res.json(result);
  } catch (err: any) {
    console.error('[Reminders] Error cancelling reminder:', err);
    res.status(400).json({ error: err.message || 'No se pudo cancelar el recordatorio' });
  }
});

// DELETE /api/reminders/:id - Eliminar recordatorio
router.delete('/:id', async (req: any, res: any) => {
  try {
    const orgId = req.organizationId;
    if (!orgId) return res.status(404).json({ error: 'Organization not found' });

    const result = await remindersService.deleteReminder(req.params.id, orgId);
    res.json(result);
  } catch (err: any) {
    console.error('[Reminders] Error deleting reminder:', err);
    res.status(500).json({ error: 'No se pudo eliminar el recordatorio' });
  }
});

export default router;
