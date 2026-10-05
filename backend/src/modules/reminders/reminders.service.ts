import * as XLSX from 'xlsx';
import { supabase } from '../../core/config/supabase';
import { multiWhatsAppService } from '../integrations/multiWhatsAppService';
import { whatsappCloudService } from '../integrations/platform/whatsappCloudService';

const PHONE_HEADER_PATTERN = /cel|celular|telefono|tel[eé]fono|phone|movil|m[oó]vil|whatsapp|numero|n[uú]mero|mobile|contacto/i;

export interface ParsedContact {
  phone: string;
  variables: Record<string, string>;
}

export interface ParsedExcel {
  headers: string[];
  phoneKey: string;
  rows: ParsedContact[];
  total: number;
}

export interface ReminderRow {
  id: string;
  organization_id: string;
  name: string;
  message_template: string;
  whatsapp_connection_id: string | null;
  status: string;
  schedule_type: string;
  scheduled_at: string | null;
  recurring_cron: string | null;
  recurring_timezone: string | null;
  delay_ms: number;
  total: number;
  sent: number;
  failed: number;
  last_sent_at: string | null;
  next_run_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface SendState {
  reminderId: string;
  paused: boolean;
  cancelled: boolean;
}

function normalizePhone(raw: any): string {
  if (raw === null || raw === undefined) return '';
  let str = '';
  if (typeof raw === 'number') {
    str = raw.toLocaleString('fullwide', { useGrouping: false });
  } else {
    str = String(raw).trim();
    if (/[eE]\+?/.test(str)) {
      const num = Number(str);
      if (!isNaN(num)) {
        str = num.toLocaleString('fullwide', { useGrouping: false });
      }
    }
  }
  const digits = str.replace(/\D/g, '');
  if (digits.length === 9 && !digits.startsWith('51')) {
    return '51' + digits;
  }
  return digits;
}

// Convierte valores de celdas: fechas de Excel (serial numérico u objeto Date) a YYYY-MM-DD.
// Solo convierte si la columna parece fecha, para no corromper variables numéricas (DNI, montos, etc.).
const DATE_HINT_PATTERN = /fecha|fec\.?|date|vence|vencimiento|revis|dia|day|nacimiento|nac\b|hora|fecha_revision/i;

function normalizeCellValue(value: any, key: string): string {
  if (typeof value === 'string') return value.trim();

  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const looksDate = DATE_HINT_PATTERN.test(key);
  if (
    looksDate &&
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 20000 &&
    value <= 70000
  ) {
    const parsed: any = XLSX.SSF.parse_date_code(value);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      const m = String(parsed.m).padStart(2, '0');
      const d = String(parsed.d).padStart(2, '0');
      return `${parsed.y}-${m}-${d}`;
    }
  }

  return String(value ?? '').trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function renderTemplate(template: string, variables: Record<string, string> = {}): string {
  let text = template;
  for (const [key, value] of Object.entries(variables || {})) {
    if (value === undefined || value === null) continue;
    const re = new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, 'gi');
    text = text.replace(re, String(value));
  }
  text = text.replace(/\{\{\s*[\w\s-]+\s*\}\}/g, '');
  return text;
}

export function parseExcelBase64(base64Data: string): ParsedExcel {
  const buffer = Buffer.from(base64Data, 'base64');
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, cellNF: false, cellText: true });

  // Buscar la hoja más adecuada que tenga datos y columna de teléfono
  let selectedSheet: any = null;
  let bestJson: Array<Record<string, any>> = [];
  let bestPhoneKey = '';

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const json: Array<Record<string, any>> = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    if (json.length > 0) {
      const headers = Object.keys(json[0]);
      const foundPhone = headers.find((h) => PHONE_HEADER_PATTERN.test(h));
      if (foundPhone) {
        selectedSheet = sheet;
        bestJson = json;
        bestPhoneKey = foundPhone;
        break;
      } else if (bestJson.length === 0) {
        bestJson = json;
      }
    }
  }

  if (bestJson.length === 0) {
    return { headers: [], phoneKey: '', rows: [], total: 0 };
  }

  const headers = Object.keys(bestJson[0]).map((h) => h.trim()).filter(Boolean);
  const phoneKey = bestPhoneKey || headers.find((h) => PHONE_HEADER_PATTERN.test(h)) || headers[0];

  const rows: ParsedContact[] = [];
  for (const row of bestJson) {
    const rawPhone = row[phoneKey];
    const phone = normalizePhone(rawPhone);
    if (!phone) continue;

    const variables: Record<string, string> = {};
    for (const h of headers) {
      variables[h] = normalizeCellValue(row[h], h);
    }

    rows.push({ phone, variables });
  }

  return { headers, phoneKey, rows, total: rows.length };
}

async function countContacts(reminderId: string, status: string): Promise<number> {
  const { count, error } = await supabase
    .from('reminder_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('reminder_id', reminderId)
    .eq('status', status);
  if (error) {
    console.error('[Reminders] Error counting contacts:', error);
    return 0;
  }
  return count || 0;
}

async function updateProgress(reminderId: string) {
  const [sent, failed] = await Promise.all([
    countContacts(reminderId, 'sent'),
    countContacts(reminderId, 'failed'),
  ]);
  await supabase
    .from('reminders')
    .update({ sent, failed, updated_at: new Date().toISOString() })
    .eq('id', reminderId);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class RemindersService {
  private activeSends: Map<string, SendState> = new Map();

  isSending(reminderId: string): boolean {
    return this.activeSends.has(reminderId);
  }

  async recoverInterruptedReminders() {
    const { error } = await supabase
      .from('reminders')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('status', 'sending');
    if (error) {
      const msg = error.message || '';
      if (error.code === '42P01' || error.code === 'PGRST205' || msg.includes('not find the table') || msg.includes('relation')) {
        console.log('\x1b[33m⚠️  [Recordatorios]\x1b[0m Tabla no existe aún. Omitiendo recuperación.');
      } else {
        console.error('\x1b[31m❌ [Recordatorios]\x1b[0m Error recuperando:', error.message);
      }
    } else {
      console.log('\x1b[32m✅ [Recordatorios]\x1b[0m Recuperación de envíos interrumpidos completada');
    }
  }

  async parseExcel(fileName: string | undefined, base64Data: string): Promise<ParsedExcel> {
    const result = parseExcelBase64(base64Data);
    console.log(`[Reminders] Parsed "${fileName || 'sin nombre'}" -> ${result.total} contactos, columna teléfono: "${result.phoneKey}"`);
    return result;
  }

  async createReminder(data: {
    organizationId: string;
    name: string;
    messageTemplate: string;
    whatsappConnectionId: string | null;
    scheduleType?: string;
    scheduledAt?: string | null;
    recurringCron?: string | null;
    recurringTimezone?: string | null;
    delayMs?: number;
    contacts: ParsedContact[];
    createdBy?: string | null;
    imageBase64?: string | null;
    metaTemplateName?: string | null;
    metaTemplateLanguage?: string | null;
  }) {
    const total = data.contacts.length;
    const status = data.scheduleType === 'now' ? 'draft' : 'scheduled';

    const insertData: any = {
      organization_id: data.organizationId,
      name: data.name,
      message_template: data.messageTemplate,
      whatsapp_connection_id: data.whatsappConnectionId,
      schedule_type: data.scheduleType || 'now',
      status,
      delay_ms: data.delayMs && data.delayMs > 0 ? data.delayMs : 6000,
      total,
      created_by: data.createdBy || null,
    };

    if (data.scheduledAt) insertData.scheduled_at = data.scheduledAt;
    if (data.recurringCron) insertData.recurring_cron = data.recurringCron;
    if (data.recurringTimezone) insertData.recurring_timezone = data.recurringTimezone;

    if (data.scheduleType === 'now') {
      insertData.next_run_at = new Date().toISOString();
    } else if (data.scheduleType === 'once' && data.scheduledAt) {
      insertData.next_run_at = data.scheduledAt;
    } else if (data.scheduleType === 'recurring') {
      // For daily recurring, set next_run_at to the scheduled time today (or tomorrow if past)
      const scheduledDate = data.scheduledAt ? new Date(data.scheduledAt) : new Date();
      const now = new Date();
      if (scheduledDate <= now) {
        scheduledDate.setDate(scheduledDate.getDate() + 1);
      }
      insertData.next_run_at = scheduledDate.toISOString();
    }
    if (data.imageBase64) insertData.image_base64 = data.imageBase64;
    if (data.metaTemplateName) insertData.meta_template_name = data.metaTemplateName;
    if (data.metaTemplateLanguage) insertData.meta_template_language = data.metaTemplateLanguage;

    const { data: reminder, error } = await supabase
      .from('reminders')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    const contacts = data.contacts.map((c) => ({
      reminder_id: reminder.id,
      phone: c.phone,
      variables: c.variables,
      status: 'pending',
    }));

    if (contacts.length > 0) {
      for (let i = 0; i < contacts.length; i += 500) {
        const { error: insertError } = await supabase
          .from('reminder_contacts')
          .insert(contacts.slice(i, i + 500));
        if (insertError) {
          console.error('[Reminders] Error inserting contacts:', insertError);
          throw insertError;
        }
      }
    }

    return reminder;
  }

  async listReminders(organizationId: string): Promise<ReminderRow[]> {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as ReminderRow[];
  }

  async getReminder(reminderId: string, organizationId: string) {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('id', reminderId)
      .eq('organization_id', organizationId)
      .single();

    if (error || !data) return null;
    return data;
  }

  async getReminderContacts(reminderId: string, organizationId: string, limit = 200, offset = 0) {
    const { data: contacts, error, count } = await supabase
      .from('reminder_contacts')
      .select('*', { count: 'exact' })
      .eq('reminder_id', reminderId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { contacts: contacts || [], count: count || 0 };
  }

  async getAllReminderContacts(reminderId: string, organizationId: string) {
    const reminder = await this.getReminder(reminderId, organizationId);
    if (!reminder) throw new Error('Recordatorio no encontrado');

    const PAGE_SIZE = 1000;
    let allContacts: any[] = [];
    let offset = 0;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await supabase
        .from('reminder_contacts')
        .select('*')
        .eq('reminder_id', reminderId)
        .order('created_at', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;
      if (data && data.length > 0) {
        allContacts = allContacts.concat(data);
        offset += PAGE_SIZE;
        if (data.length < PAGE_SIZE) {
          keepFetching = false;
        }
      } else {
        keepFetching = false;
      }
    }

    return allContacts;
  }

  async exportReminderReportExcel(reminderId: string, organizationId: string): Promise<{ buffer: Buffer; fileName: string }> {
    const reminder = await this.getReminder(reminderId, organizationId);
    if (!reminder) throw new Error('Recordatorio no encontrado');

    const contacts = await this.getAllReminderContacts(reminderId, organizationId);

    // Extraer todas las variables únicas encontradas en los contactos
    const variableKeysSet = new Set<string>();
    contacts.forEach((c) => {
      if (c.variables && typeof c.variables === 'object') {
        Object.keys(c.variables).forEach((k) => variableKeysSet.add(k));
      }
    });
    const variableKeys = Array.from(variableKeysSet);

    // Mapeo de estados legibles
    const statusLabels: Record<string, string> = {
      sent: 'ENTREGADO / ENVIADO',
      failed: 'FALLIDO / NO ENTREGADO',
      pending: 'PENDIENTE',
      skipped: 'OMITIDO',
    };

    // Encabezados de la tabla de detalle
    const headers = [
      '#',
      'Teléfono',
      'Estado de Entrega',
      'Fecha y Hora de Envío',
      'Mensaje Enviado',
      'Motivo de Error / Detalle',
      ...variableKeys.map((k) => `Var: ${k}`),
    ];

    // Filas de detalle
    const dataRows = contacts.map((c, index) => {
      const renderedMsg = renderTemplate(reminder.message_template, c.variables || {});
      const sentTimeStr = c.sent_at ? new Date(c.sent_at).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : '—';
      const statusLabel = statusLabels[c.status] || (c.status ? c.status.toUpperCase() : 'PENDIENTE');

      const varValues = variableKeys.map((k) => c.variables?.[k] ?? '');

      return [
        index + 1,
        c.phone || '',
        statusLabel,
        sentTimeStr,
        renderedMsg,
        c.error_message || (c.status === 'sent' ? 'Sin errores' : '—'),
        ...varValues,
      ];
    });

    const wb = XLSX.utils.book_new();

    // Hoja 1: Detalle de Contactos
    const wsDetailData = [headers, ...dataRows];
    const wsDetail = XLSX.utils.aoa_to_sheet(wsDetailData);

    // Ancho de columnas
    wsDetail['!cols'] = [
      { wch: 6 },   // #
      { wch: 16 },  // Teléfono
      { wch: 24 },  // Estado
      { wch: 22 },  // Fecha Envío
      { wch: 60 },  // Mensaje
      { wch: 35 },  // Error
      ...variableKeys.map((k) => ({ wch: Math.max(k.length + 8, 16) })),
    ];

    XLSX.utils.book_append_sheet(wb, wsDetail, 'Detalle de Envíos');

    // Hoja 2: Resumen Ejecutivo
    const total = contacts.length || reminder.total || 0;
    const sent = contacts.filter((c) => c.status === 'sent').length;
    const failed = contacts.filter((c) => c.status === 'failed').length;
    const pending = contacts.filter((c) => c.status === 'pending').length;
    const successRate = total > 0 ? `${Math.round((sent / total) * 100)}%` : '0%';

    const scheduleLabels: Record<string, string> = {
      now: 'Inmediato',
      once: 'Una vez',
      recurring: 'Recurrente',
    };

    const summaryData = [
      ['REPORTE EJECUTIVO DE RECORDATORIO'],
      [''],
      ['Propiedad', 'Valor'],
      ['Nombre del Recordatorio', reminder.name],
      ['ID Recordatorio', reminder.id],
      ['Estado Actual', reminder.status?.toUpperCase()],
      ['Tipo de Programación', scheduleLabels[reminder.schedule_type] || reminder.schedule_type],
      ['Total de Contactos', total],
      ['Mensajes Entregados con Éxito', sent],
      ['Mensajes Fallidos / No Entregados', failed],
      ['Mensajes Pendientes', pending],
      ['Tasa de Efectividad / Entrega', successRate],
      ['Fecha de Creación', reminder.created_at ? new Date(reminder.created_at).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : '—'],
      ['Último Envío Realizado', reminder.last_sent_at ? new Date(reminder.last_sent_at).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : '—'],
      ['Próxima Ejecución Programada', reminder.next_run_at ? new Date(reminder.next_run_at).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : '—'],
      ['Plantilla Meta / Mensaje Base', reminder.meta_template_name || 'Personalizado'],
      ['Texto Base del Mensaje', reminder.message_template],
      [''],
      ['Generado el', new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 32 }, { wch: 70 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Ejecutivo');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const cleanName = (reminder.name || 'recordatorio')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .substring(0, 30);
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `reporte_recordatorio_${cleanName}_${dateStr}.xlsx`;

    return { buffer, fileName };
  }

  async exportGeneralRemindersExcel(organizationId: string): Promise<{ buffer: Buffer; fileName: string }> {
    const reminders = await this.listReminders(organizationId);

    const scheduleLabels: Record<string, string> = {
      now: 'Inmediato',
      once: 'Una vez',
      recurring: 'Recurrente',
    };

    const statusLabels: Record<string, string> = {
      draft: 'Borrador',
      scheduled: 'Programado',
      sending: 'Enviando',
      paused: 'Pausado',
      completed: 'Completado',
      cancelled: 'Cancelado',
      failed: 'Fallido',
    };

    const headers = [
      '#',
      'Nombre del Recordatorio',
      'Tipo de Envío',
      'Estado',
      'Total Contactos',
      'Entregados con Éxito',
      'Fallidos / No Entregados',
      'Pendientes',
      '% Efectividad',
      'Fecha Creación',
      'Último Envío',
      'Próxima Ejecución',
    ];

    let totalContactsAll = 0;
    let totalSentAll = 0;
    let totalFailedAll = 0;

    const rows = reminders.map((r, i) => {
      const pending = Math.max(0, (r.total || 0) - (r.sent || 0) - (r.failed || 0));
      const rate = r.total > 0 ? `${Math.round(((r.sent || 0) / r.total) * 100)}%` : '0%';

      totalContactsAll += (r.total || 0);
      totalSentAll += (r.sent || 0);
      totalFailedAll += (r.failed || 0);

      return [
        i + 1,
        r.name,
        scheduleLabels[r.schedule_type] || r.schedule_type,
        statusLabels[r.status] || r.status,
        r.total || 0,
        r.sent || 0,
        r.failed || 0,
        pending,
        rate,
        r.created_at ? new Date(r.created_at).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : '—',
        r.last_sent_at ? new Date(r.last_sent_at).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : '—',
        r.next_run_at ? new Date(r.next_run_at).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : '—',
      ];
    });

    const wb = XLSX.utils.book_new();
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws['!cols'] = [
      { wch: 6 },   // #
      { wch: 30 },  // Nombre
      { wch: 15 },  // Tipo
      { wch: 16 },  // Estado
      { wch: 16 },  // Total
      { wch: 20 },  // Enviados
      { wch: 22 },  // Fallidos
      { wch: 14 },  // Pendientes
      { wch: 14 },  // Efectividad
      { wch: 20 },  // Creación
      { wch: 20 },  // Último envío
      { wch: 20 },  // Próxima ejecución
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Lista de Recordatorios');

    // Hoja Resumen Consolidado
    const generalRate = totalContactsAll > 0 ? `${Math.round((totalSentAll / totalContactsAll) * 100)}%` : '0%';
    const summaryData = [
      ['REPORTE CONSOLIDADO GENERAL DE RECORDATORIOS'],
      [''],
      ['Métrica', 'Total'],
      ['Total de Campañas / Recordatorios', reminders.length],
      ['Total de Contactos Gestionados', totalContactsAll],
      ['Total Mensajes Entregados con Éxito', totalSentAll],
      ['Total Mensajes Fallidos', totalFailedAll],
      ['Tasa Global de Entrega / Éxito', generalRate],
      [''],
      ['Fecha de Generación', new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 35 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen General');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `reporte_general_recordatorios_${dateStr}.xlsx`;

    return { buffer, fileName };
  }

  async getReminderLogs(reminderId: string, organizationId: string) {
    const { data: logs, error } = await supabase
      .from('reminder_logs')
      .select('*')
      .eq('reminder_id', reminderId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return logs || [];
  }

  async updateReminder(reminderId: string, organizationId: string, updates: any) {
    const { data, error } = await supabase
      .from('reminders')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', reminderId)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteReminder(reminderId: string, organizationId: string) {
    const state = this.activeSends.get(reminderId);
    if (state) {
      state.cancelled = true;
      this.activeSends.delete(reminderId);
    }
    const { error } = await supabase
      .from('reminders')
      .delete()
      .eq('id', reminderId)
      .eq('organization_id', organizationId);

    if (error) throw error;
    return { success: true };
  }

  async startSending(reminderId: string, organizationId: string) {
    if (this.activeSends.has(reminderId)) {
      throw new Error('El recordatorio ya se está enviando');
    }

    const reminder = await this.getReminder(reminderId, organizationId);

    if (!reminder.whatsapp_connection_id) {
      throw new Error('El recordatorio no tiene una conexión WhatsApp asignada');
    }

    // Try Baileys first
    let connection = multiWhatsAppService.getConnection(reminder.whatsapp_connection_id);
    let isCloudApi = false;

    // If not found in Baileys, try Cloud API
    if (!connection || connection.status !== 'connected') {
      const { data: platformConn } = await supabase
        .from('platform_connections')
        .select('*')
        .eq('id', reminder.whatsapp_connection_id)
        .eq('status', 'connected')
        .single();

      if (platformConn) {
        await whatsappCloudService.initializeConnection(platformConn);
        const cloudConn = whatsappCloudService['connections'].get(platformConn.id);
        if (cloudConn) {
          connection = cloudConn as any;
          isCloudApi = true;
          console.log(`[Reminders] Using Cloud API for ${reminder.name}, phone_number_id: ${cloudConn.config?.phoneNumberId}, template: ${reminder.meta_template_name}`);
        }
      }
    }

    if (!connection || (connection as any).status !== 'connected') {
      throw new Error('La conexión WhatsApp no está conectada. Verifica el estado del dispositivo.');
    }

    await supabase
      .from('reminders')
      .update({ status: 'sending', last_sent_at: new Date().toISOString() })
      .eq('id', reminderId);

    const logEntry = await supabase
      .from('reminder_logs')
      .insert({
        reminder_id: reminderId,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    const state: SendState = { reminderId, paused: false, cancelled: false };
    this.activeSends.set(reminderId, state);

    this.runSendLoop(state, reminder, connection, logEntry?.data?.id, isCloudApi).catch((err) => {
      console.error('[Reminders] Send loop error:', err);
      this.activeSends.delete(reminderId);
    });

    return { success: true, status: 'sending' };
  }

  async pauseSending(reminderId: string) {
    const state = this.activeSends.get(reminderId);
    if (!state) {
      await supabase
        .from('reminders')
        .update({ status: 'paused' })
        .eq('id', reminderId);
      return { success: true, status: 'paused' };
    }
    state.paused = true;
    await supabase
      .from('reminders')
      .update({ status: 'paused' })
      .eq('id', reminderId);
    return { success: true, status: 'paused' };
  }

  async resumeSending(reminderId: string, organizationId: string) {
    const state = this.activeSends.get(reminderId);
    if (!state) {
      return this.startSending(reminderId, organizationId);
    }
    state.paused = false;
    await supabase
      .from('reminders')
      .update({ status: 'sending' })
      .eq('id', reminderId);
    return { success: true, status: 'sending' };
  }

  async cancelReminder(reminderId: string, organizationId: string) {
    const state = this.activeSends.get(reminderId);
    if (state) {
      state.cancelled = true;
      this.activeSends.delete(reminderId);
    }
    await supabase
      .from('reminders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', reminderId)
      .eq('organization_id', organizationId);
    return { success: true };
  }

  private async runSendLoop(state: SendState, reminder: any, connection: any, logId?: string, isCloudApi = false) {
    const adapter = isCloudApi
      ? whatsappCloudService.createServiceAdapter(connection)
      : multiWhatsAppService.createWaServiceAdapter(connection);
    const delayMs = Math.max(Number(reminder.delay_ms) || 3000, 500);

    try {
      while (state.paused && !state.cancelled) {
        await sleep(500);
      }
      if (state.cancelled) return;

      const { data: contacts } = await supabase
        .from('reminder_contacts')
        .select('*')
        .eq('reminder_id', reminder.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      // Detecta una sola vez (y no por contacto) si la plantilla aprobada de Meta usa
      // parámetros posicionales ({{1}}) o nombrados ({{nombre}}). Meta lanza #132000 si
      // enviamos parameter_name a una plantilla posicional (o index a una nombrada).
      let tplUseNamedParams = true;
      let tplLang = (reminder.meta_template_language || 'es') as string;
      if (isCloudApi && reminder.meta_template_name) {
        tplLang = reminder.meta_template_language || 'es';
        try {
          const templates = await whatsappCloudService.getMetaTemplates(connection.id);
          const metaTpl = (templates || []).find(
            (t: any) => t.name === reminder.meta_template_name && t.language === tplLang
          ) || (templates || []).find((t: any) => t.name === reminder.meta_template_name);
          const body = (metaTpl?.components || []).find((c: any) => c.type === 'BODY') || {};
          const raw: any[] = body.variables || [];
          if (raw.length > 0) {
            tplUseNamedParams = raw.some((v: any) => !/^\d+$/.test(String(v?.name ?? '')));
          } else {
            tplUseNamedParams = /\{\{\s*[A-Za-z_]/.test(String(body.text || ''));
          }
        } catch (e: any) {
          console.warn(`[Reminders] No se pudo verificar formato de plantilla (${e?.message || e}); asume nombrado.`);
        }
        console.log(`[Reminders] Plantilla "${reminder.meta_template_name}" lang=${tplLang} formato=${tplUseNamedParams ? 'nombrado' : 'posicional'}`);
      }

      let currentSent = await countContacts(reminder.id, 'sent');
      let currentFailed = await countContacts(reminder.id, 'failed');

      for (const contact of contacts || []) {
        if (state.cancelled) return;

        while (state.paused && !state.cancelled) {
          await sleep(500);
        }
        if (state.cancelled) return;

        try {
          const text = renderTemplate(reminder.message_template, contact.variables);
          const phone = normalizePhone(contact.phone);
          if (isCloudApi && reminder.meta_template_name) {
            const langCode = tplLang;
            if (!(adapter as any).sendTemplateMessage) {
              throw new Error('sendTemplateMessage no disponible en el adaptador');
            }
            // Extrae las variables en el orden en que aparecen en el mensaje ({{var}}).
            let varNames = [...reminder.message_template.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
            if (varNames.length === 0 && contact.variables && typeof contact.variables === 'object') {
              varNames = Object.keys(contact.variables);
            }
            const parameters = varNames.map((name, i) => {
              const base: any = { type: 'text', text: String(contact.variables?.[name] ?? '') };
              if (tplUseNamedParams) {
                base.parameter_name = name;
              } else {
                base.index = i + 1;
              }
              return base;
            });
            console.log(`[Reminders] Template: "${reminder.meta_template_name}", lang: ${langCode}, formato: ${tplUseNamedParams ? 'nombrado' : 'posicional'}, vars: [${varNames.join(', ')}]`);
            if (varNames.length > 0) {
              await (adapter as any).sendTemplateMessage(phone, reminder.meta_template_name, langCode, [
                { type: 'body', parameters },
              ]);
            } else {
              console.log(`[Reminders] Sending template without parameters`);
              await (adapter as any).sendTemplateMessage(phone, reminder.meta_template_name, langCode);
            }
          } else if (reminder.image_base64 && !isCloudApi) {
            await (adapter as any).sendImageMessage(phone, reminder.image_base64, text);
          } else {
            await adapter.sendTextMessage(phone, text);
          }

          currentSent++;
          await supabase
            .from('reminder_contacts')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              error_message: null,
            })
            .eq('id', contact.id);

        } catch (err: any) {
          const metaError = err?.response?.data?.error || err?.response?.data;
          const errorMsg = metaError
            ? `Meta API ${metaError.code || ''}: ${metaError.message || JSON.stringify(metaError)}`
            : String(err?.message || err);
          console.error(`[Reminders] Send FAILED for ${contact.phone}: ${errorMsg}`);

          currentFailed++;
          await supabase
            .from('reminder_contacts')
            .update({
              status: 'failed',
              sent_at: new Date().toISOString(),
              error_message: errorMsg,
            })
            .eq('id', contact.id);
        }

        // Actualizar progreso en tiempo real en la tabla principal
        await supabase
          .from('reminders')
          .update({
            sent: currentSent,
            failed: currentFailed,
            updated_at: new Date().toISOString(),
          })
          .eq('id', reminder.id);

        // Log progress visually
        const processed = currentSent + currentFailed;
        const total = reminder.total;
        const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
        const filled = Math.round(pct / 10);
        const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
        console.log(`\x1b[36m⏱️ [Recordatorio]\x1b[0m ${reminder.name} | Progreso: \x1b[32m[${bar}]\x1b[0m ${pct}% (${processed}/${total})`);

        await sleep(delayMs);
      }
      const [sentCount, failedCount] = await Promise.all([
        countContacts(reminder.id, 'sent'),
        countContacts(reminder.id, 'failed'),
      ]);

      if (logId) {
        await supabase
          .from('reminder_logs')
          .update({
            total_sent: sentCount,
            total_failed: failedCount,
            finished_at: new Date().toISOString(),
          })
          .eq('id', logId);
      }

      const newStatus = reminder.schedule_type === 'recurring' ? 'scheduled' : 'completed';
      const updateData: any = { status: newStatus, updated_at: new Date().toISOString() };

      // For recurring, calculate next_run_at (next day at same time)
      if (reminder.schedule_type === 'recurring') {
        const tz = reminder.recurring_timezone || 'America/Lima';
        const lastRun = new Date();
        lastRun.setDate(lastRun.getDate() + 1);
        updateData.next_run_at = lastRun.toISOString();
      } else {
        updateData.next_run_at = null;
      }

      await supabase
        .from('reminders')
        .update(updateData)
        .eq('id', reminder.id);
    } finally {
      this.activeSends.delete(reminder.id);
    }
  }

  startScheduler() {
    console.log('[Reminders] ⏰ Scheduler de recordatorios iniciado (cada 30 segundos)');

    setInterval(async () => {
      try {
        const now = new Date().toISOString();
        const { data: dueReminders } = await supabase
          .from('reminders')
          .select('*')
          .eq('status', 'scheduled')
          .lte('next_run_at', now)
          .not('next_run_at', 'is', null);

        if (!dueReminders || dueReminders.length === 0) return;

        console.log(`[Reminders] 📋 ${dueReminders.length} recordatorio(s) programado(s) listos para enviar`);

        for (const reminder of dueReminders) {
          if (this.activeSends.has(reminder.id)) continue;

          console.log(`[Reminders] 🚀 Enviando recordatorio programado: "${reminder.name}" (${reminder.schedule_type})`);
          try {
            await this.startSending(reminder.id, reminder.organization_id);
          } catch (err: any) {
            console.error(`[Reminders] ❌ Error iniciando recordatorio "${reminder.name}":`, err.message || err);
          }
        }
      } catch (err: any) {
        console.error('[Reminders] ⚠️ Error en scheduler:', err.message || err);
      }
    }, 30_000);
  }
}

export const remindersService = new RemindersService();
