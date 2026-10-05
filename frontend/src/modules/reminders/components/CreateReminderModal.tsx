import { useState, useRef, useEffect } from 'react';
import {
  UploadCloud, FileSpreadsheet, ChevronLeft, ChevronRight, Send,
  Smartphone, Zap, Check, Calendar, RotateCcw, Clock, FileText, Download, Image, X, Users, Plus, Info
} from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Loader } from '../../../components/ui/Loader';
import { useNotifications } from '../../../contexts/NotificationContext';
import { parseReminderExcel, createReminder, sendReminder, getMessageTemplates, downloadDynamicTemplateExcel, createConnectionTemplate, getConnectionTemplates } from '../../../services/api';
import api from '../../../services/api';

interface ParsedContact {
  phone: string;
  variables: Record<string, string>;
}

interface ParsedExcel {
  headers: string[];
  phoneKey: string;
  rows: ParsedContact[];
  total: number;
}

interface CreateReminderModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (reminder: any) => void;
}

const delayOptions = [
  { value: '1500', label: '1.5 segundos entre mensajes' },
  { value: '3000', label: '3 segundos' },
  { value: '6000', label: '6 segundos (recomendado)' },
  { value: '10000', label: '10 segundos' },
];

const scheduleOptions = [
  { value: 'now', label: 'Inmediato', desc: 'Enviar al crear el recordatorio', icon: Send },
  { value: 'once', label: 'Una vez', desc: 'Programar para una fecha específica', icon: Calendar },
  { value: 'recurring', label: 'Recurrente', desc: 'Enviar periódicamente', icon: RotateCcw },
];

const recurringOptions = [
  { value: 'daily', label: 'Diariamente', cron: '0 9 * * *' },
  { value: 'weekly', label: 'Cada semana (lunes)', cron: '0 9 * * 1' },
  { value: 'biweekly', label: 'Cada 2 semanas', cron: '0 9 */14 * *' },
  { value: 'monthly', label: 'Mensualmente (día 1)', cron: '0 9 1 * *' },
];

const stepsMeta = [
  { label: 'Contactos', desc: 'Carga tu base de datos' },
  { label: 'Mensaje', desc: 'Redacta tu recordatorio' },
  { label: 'Programación', desc: 'Cuándo enviar' },
  { label: 'Revisión', desc: 'Confirma y activa' },
];

// Vista previa de la plantilla Excel estática (coincide con /reminders/template-excel)
const templatePreviewHeaders = ['telefono', 'nombre_completo', 'placa', 'dni', 'fecha_revision', 'dias'];
const templatePreviewRow = ['999888777', 'Juan Pérez García', 'ABC-123', '45678901', '15/08/2026', 'auto'];

export const CreateReminderModal = ({ open, onClose, onCreated }: CreateReminderModalProps) => {
  const { addNotification } = useNotifications();
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  // Guarda la última posición del cursor dentro del textarea. Al hacer clic en un
  // chip de variable el textarea pierde el foco y selectionStart queda obsoleto,
  // así que usamos este ref para insertar siempre en donde dejó el cursor el usuario.
  const caretRef = useRef<number>(0);

  const syncCaret = () => {
    const el = textareaRef.current;
    if (el) caretRef.current = el.selectionStart ?? caretRef.current;
  };

  const handleScroll = () => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const [step, setStep] = useState(1);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedExcel | null>(null);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');

  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [delayMs, setDelayMs] = useState('6000');
  const [scheduleType, setScheduleType] = useState('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [recurringOption, setRecurringOption] = useState('daily');
  const [sendNow, setSendNow] = useState(true);
  const [connections, setConnections] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [metaTemplateName, setMetaTemplateName] = useState('');
  const [metaTemplateLanguage, setMetaTemplateLanguage] = useState('es');
  const [metaTemplates, setMetaTemplates] = useState<any[]>([]);
  const [metaTemplatesLoading, setMetaTemplatesLoading] = useState(false);
  const [metaTemplatesError, setMetaTemplatesError] = useState('');
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [showCreateMetaTemplate, setShowCreateMetaTemplate] = useState(false);
  const [creatingMetaTemplate, setCreatingMetaTemplate] = useState(false);
  const [newMetaTplName, setNewMetaTplName] = useState('');
  const [newMetaTplLanguage, setNewMetaTplLanguage] = useState('es');
  const [newMetaTplCategory, setNewMetaTplCategory] = useState('UTILITY');
  const [newMetaTplBody, setNewMetaTplBody] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setParsed(null);
    setFileName('');
    setParseError('');
    setName('');
    setMessage('');
    setDelayMs('6000');
    setScheduleType('now');
    setScheduledDate('');
    setScheduledTime('09:00');
    setRecurringOption('daily');
    setSendNow(true);
    setCreating(false);
    setSelectedTemplateId('');
    setImageFile(null);
    setImagePreview(null);
    setMetaTemplateName('');
    setMetaTemplateLanguage('es');
    setDownloadingExcel(false);
    (async () => {
      try {
        // Load Baileys connections
        const connRes = await api.get('/whatsapp-connections');
        const connData = connRes.data;
        const connList = Array.isArray(connData) ? connData : (connData?.connections || connData?.data || []);

        // Load Cloud API connections
        try {
          const cloudRes = await api.get('/platform/connections');
          const cloudData = cloudRes.data;
          const cloudList = Array.isArray(cloudData) ? cloudData : (cloudData?.connections || cloudData?.data || []);
          const cloudWhatsapp = cloudList
            .filter((c: any) => c.platform_type === 'whatsapp' && c.status === 'connected')
            .map((c: any) => ({
              id: c.id,
              display_name: `${c.display_name || 'Cloud API'} (Cloud)`,
              phone_number: c.config?.phone_number || c.platform_account_id || '',
              status: c.status,
              source: 'cloud'
            }));
          connList.push(...cloudWhatsapp);
        } catch { /* cloud API not available */ }

        setConnections(connList);
        const connected = connList.find((c: any) => c.status === 'connected');
        setConnectionId(connected?.id || connList[0]?.id || '');
      } catch (e: any) {
        console.error('[Reminders] Error cargando conexiones:', e?.response?.data || e?.message || e);
        setConnections([]);
        setConnectionId('');
      }
      try {
        const tplRes = await getMessageTemplates();
        setTemplates(Array.isArray(tplRes) ? tplRes : []);
      } catch (e: any) {
        console.warn('[Reminders] Error cargando plantillas:', e?.response?.data || e?.message || e);
        setTemplates([]);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!connectionId) return;
    const conn = connections.find((c) => c.id === connectionId);
    console.log('[Reminder] Connection changed:', connectionId, 'source:', conn?.source, 'name:', conn?.display_name);
    if (!conn || conn.source !== 'cloud') {
      console.log('[Reminder] Not cloud source, skipping template load');
      setMetaTemplates([]);
      setMetaTemplatesError('');
      return;
    }
    setMetaTemplatesLoading(true);
    setMetaTemplatesError('');
    console.log('[Reminder] Fetching templates from:', `/platform/connections/${connectionId}/templates`);
    api.get(`/platform/connections/${connectionId}/templates`)
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        console.log('[Reminder] Templates loaded:', data.length, data.map((t: any) => t.name));
        setMetaTemplates(data);
      })
      .catch((err) => {
        console.error('[Reminder] Templates error:', err?.response?.data || err.message);
        setMetaTemplates([]);
        setMetaTemplatesError(err?.response?.data?.error || 'No se pudieron cargar los templates de Meta.');
      })
      .finally(() => setMetaTemplatesLoading(false));
  }, [connectionId, connections]);

  const isCloudConnection = connections.find((c) => c.id === connectionId)?.source === 'cloud';
  const selectedMetaTemplate = metaTemplates.find((t) => t.name === metaTemplateName);

  const extractTemplateVariables = () => {
    if (!selectedMetaTemplate) return [];
    const bodyComp = (selectedMetaTemplate.components || []).find((c: any) => c.type === 'BODY');
    if (!bodyComp?.text) return [];
    return [...bodyComp.text.matchAll(/\{\{\s*([\w-]+)\s*\}\}/g)]
      .map((m) => m[1])
      .filter((v, i, arr) => arr.indexOf(v) === i);
  };

  const templateVars = extractTemplateVariables();

  const handleDownloadTemplateExcel = async () => {
    try {
      setDownloadingExcel(true);
      const blob = await downloadDynamicTemplateExcel(templateVars, metaTemplateName);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${metaTemplateName || 'plantilla'}_datos.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Error', message: err?.response?.data?.error || 'No se pudo descargar la plantilla Excel.' });
    } finally {
      setDownloadingExcel(false);
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls'].includes(ext || '')) {
      setParseError('Solo se permiten archivos .xlsx o .xls');
      return;
    }
    setParsing(true);
    setParseError('');
    try {
      const base64Data = await readFileAsBase64(file);
      const result = await parseReminderExcel(file.name, base64Data);
      if (!result.rows || result.rows.length === 0) {
        setParseError('No se encontraron teléfonos válidos en el archivo.');
        setParsing(false);
        return;
      }
      setParsed(result);
      setFileName(file.name);
      setStep(2);
    } catch (err: any) {
      setParseError(err?.response?.data?.error || 'No se pudo leer el archivo Excel.');
    } finally {
      setParsing(false);
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const insertVariable = (variable: string) => {
    const el = textareaRef.current;
    if (!el) {
      setMessage((prev) => prev + `\u200B${variable}\u200B`);
      return;
    }
    // El textarea se desenfoca al hacer clic en el chip; usa la posición guardada.
    const insertAt = caretRef.current;
    const next = message.slice(0, insertAt) + `\u200B${variable}\u200B` + message.slice(insertAt);
    setMessage(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = insertAt + variable.length + 2;
      caretRef.current = pos;
      el.setSelectionRange(pos, pos);
    });
  };

  const downloadTemplate = async () => {
    try {
      const response = await api.get('/reminders/template-excel', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'plantilla_recordatorios.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addNotification({ type: 'success', title: 'Plantilla descargada', message: 'Abre el archivo en Excel, rellena los datos y guárdalo como .xlsx antes de subirlo.' });
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo descargar la plantilla.' });
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addNotification({ type: 'error', title: 'Formato inválido', message: 'Solo se permiten archivos de imagen.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addNotification({ type: 'error', title: 'Archivo muy grande', message: 'La imagen no puede superar 5MB.' });
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const renderPreview = () => {
    if (!parsed || parsed.rows.length === 0 || !message) return '';
    let preview = message.replace(/\u200B(.*?)\u200B/g, '{{$1}}');
    const sample = parsed.rows[0];
    for (const [key, value] of Object.entries(sample.variables)) {
      preview = preview.replace(new RegExp(`\\{\\{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`, 'gi'), value);
    }
    preview = preview.replace(/\{\{\s*[\w\s-]+\s*\}\}/g, '');
    return preview;
  };

  const handleCreateMetaTemplate = async () => {
    if (!newMetaTplName.trim() || !newMetaTplBody.trim()) {
      addNotification({ type: 'error', title: 'Campos requeridos', message: 'Nombre y cuerpo son obligatorios.' });
      return;
    }
    const conn = connections.find((c) => c.id === connectionId);
    if (!conn || conn.source !== 'cloud') return;
    setCreatingMetaTemplate(true);
    try {
      await createConnectionTemplate(connectionId, {
        name: newMetaTplName.trim(),
        category: newMetaTplCategory,
        language: newMetaTplLanguage,
        components: [
          { type: 'BODY', text: newMetaTplBody.trim() },
        ],
      });
      addNotification({ type: 'success', title: 'Plantilla creada', message: `${newMetaTplName} enviada a Meta para aprobación.` });
      setShowCreateMetaTemplate(false);
      setNewMetaTplName('');
      setNewMetaTplBody('');
      // Refresh template list
      const tpl = await getConnectionTemplates(connectionId);
      setMetaTemplates(Array.isArray(tpl) ? tpl : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear plantilla en Meta';
      addNotification({ type: 'error', title: 'Error', message: msg });
    } finally {
      setCreatingMetaTemplate(false);
    }
  };

  const handleCreate = async () => {
    if (!parsed) return;
    if (!name.trim()) {
      addNotification({ type: 'error', title: 'Falta el nombre', message: 'Ingresa un nombre para el recordatorio.' });
      return;
    }
    if (!message.trim()) {
      addNotification({ type: 'error', title: 'Falta el mensaje', message: 'Redacta el mensaje a enviar.' });
      return;
    }
    const isCloudConnection = connections.find((c) => c.id === connectionId)?.source === 'cloud';
    if (isCloudConnection && !metaTemplateName.trim()) {
      addNotification({ type: 'error', title: 'Falta el template Meta', message: 'Cloud API requiere un template aprobado por Meta para mensajes proactivos.' });
      return;
    }
    setCreating(true);
    try {
      let scheduledAt = null;
      let recurringCron = null;

      if (scheduleType === 'once' && scheduledDate) {
        scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
      } else if (scheduleType === 'recurring') {
        const selectedOpt = recurringOptions.find((o) => o.value === recurringOption);
        recurringCron = selectedOpt?.cron || '0 9 * * *';
        // Use today (or tomorrow if past) at the selected time for the first run
        const now = new Date();
        const [hours, minutes] = (scheduledTime || '09:00').split(':').map(Number);
        const firstRun = new Date();
        firstRun.setHours(hours, minutes, 0, 0);
        if (firstRun <= now) firstRun.setDate(firstRun.getDate() + 1);
        scheduledAt = firstRun.toISOString();
      }

      let imageBase64 = null;
      if (imageFile) {
        imageBase64 = await readFileAsBase64(imageFile);
      }

      const reminder = await createReminder({
        name: name.trim(),
        messageTemplate: message.trim().replace(/\u200B(.*?)\u200B/g, '{{$1}}'),
        whatsappConnectionId: connectionId || null,
        scheduleType,
        scheduledAt,
        recurringCron,
        delayMs: Number(delayMs) || 6000,
        contacts: parsed.rows,
        imageBase64,
        metaTemplateName: metaTemplateName || undefined,
        metaTemplateLanguage: metaTemplateName ? metaTemplateLanguage : undefined,
      });
      addNotification({ type: 'success', title: 'Recordatorio creado', message: `Se cargaron ${parsed.total} contactos.` });

      // Incrementar contador de uso de la plantilla si se seleccionó una
      if (selectedTemplateId) {
        try {
          await api.post(`/message-templates/${selectedTemplateId}/increment-usage`);
        } catch (e) {
          console.warn('No se pudo incrementar el contador de uso de la plantilla');
        }
      }

      if (sendNow && scheduleType === 'now') {
        try {
          await sendReminder(reminder.id);
        } catch (err: any) {
          addNotification({ type: 'warning', title: 'No se inició el envío', message: err?.response?.data?.error || 'Configura la conexión WhatsApp e inicia el envío manualmente.' });
        }
      }
      onCreated(reminder);
      onClose();
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Error', message: err?.response?.data?.error || 'No se pudo crear el recordatorio.' });
    } finally {
      setCreating(false);
    }
  };

  const connectedCount = connections.filter((c) => c.status === 'connected').length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      className="!max-h-[85vh]"
      title="Nuevo Recordatorio"
      subtitle="Carga contactos, personaliza el mensaje y prográma el envío automático"
      icon={<Clock className="w-5 h-5 text-accent-500" />}
    >
      {/* Stepper compacto */}
      <div className="relative mb-6">
        {/* Línea de progreso de fondo */}
        <div className="absolute top-4 left-0 right-0 h-px bg-slate-200 dark:bg-slate-700" />
        {/* Línea de progreso activa con gradiente */}
        <div
          className="absolute top-4 left-0 h-px bg-gradient-to-r from-accent-500 via-accent-400 to-accent-500 transition-all duration-500"
          style={{ width: `${((step - 1) / (stepsMeta.length - 1)) * 100}%` }}
        />
        <div className="relative flex justify-between">
          {stepsMeta.map((s, i) => {
            const idx = i + 1;
            const active = idx === step;
            const done = idx < step;
            return (
              <div key={s.label} className="flex flex-col items-center gap-1.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 transition-all duration-300 ${
                  done ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' :
                  active ? 'bg-accent-500 text-black shadow-lg shadow-accent-500/30 ring-4 ring-accent-500/10' :
                  'bg-white dark:bg-slate-800 text-slate-400 border-2 border-slate-200 dark:border-slate-700'
                }`}>
                  {done ? <Check className="w-4 h-4" /> : idx}
                </div>
                <div className="text-center">
                  <p className={`text-[10px] font-bold leading-none ${active ? 'text-slate-900 dark:text-white' : done ? 'text-emerald-500' : 'text-slate-400'}`}>{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Separador decorativo */}
      <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent mb-5" />

      {/* STEP 1: Excel */}
      {step === 1 && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className="group border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all hover:border-accent-500/60 hover:bg-accent-500/5 cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {parsing ? (
              <>
                <Loader size="md" className="mb-3" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Procesando archivo...</p>
              </>
            ) : (
              <>
                <div className="p-3 bg-accent-500/10 rounded-2xl mb-3 transition-transform group-hover:scale-105">
                  <UploadCloud className="w-8 h-8 text-accent-500" />
                </div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Arrastra tu archivo Excel aquí o <span className="text-accent-500 underline">haz clic para seleccionarlo</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Formatos: .xlsx, .xls — Debe contener una columna con teléfonos (celular, teléfono, whatsapp, número...)
                </p>
              </>
            )}
          </div>
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 bg-emerald-500/5">
              <div className="p-2 bg-emerald-500/10 rounded-lg shrink-0">
                <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-black text-slate-800 dark:text-slate-100">Descargar plantilla Excel</p>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-widest">.xlsx</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  100% editable, lista para copiar/pegar contactos. La columna <span className="text-emerald-600 dark:text-emerald-400 font-bold">telefono</span> es obligatoria.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[10px] font-medium">
                <thead>
                  <tr>
                    {templatePreviewHeaders.map((h, i) => (
                      <th
                        key={h}
                        className={`px-2.5 py-2 text-[9px] font-black uppercase tracking-widest text-white whitespace-nowrap border-r border-[#164a2c] last:border-r-0 ${
                          i === 0 ? 'bg-[#1a5c38]' : 'bg-[#217346]'
                        }`}
                      >
                        <span className={`inline-flex items-center gap-1 ${h === 'telefono' ? 'text-orange-300' : ''}`}>
                          {h === 'telefono' ? <span className="text-[8px] bg-orange-400 text-black px-1 py-px rounded font-black">req*</span> : null}
                          {h}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {templatePreviewHeaders.map((h, i) => (
                      <td key={i} className={`px-2.5 py-2 bg-white dark:bg-slate-900 whitespace-nowrap border-b border-r border-slate-100 dark:border-slate-800 last:border-r-0 ${h === 'dias' ? 'text-emerald-600 dark:text-emerald-400 italic font-bold' : 'text-slate-600 dark:text-slate-300'}`}>
                        {h === 'dias' ? (
                          <span className="inline-flex items-center gap-1" title="Se calcula automáticamente">
                            {templatePreviewRow[i]} <Clock className="w-2.5 h-2.5" />
                          </span>
                        ) : (
                          templatePreviewRow[i]
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
              <Info className="w-3 h-3 text-slate-400 shrink-0" />
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                La columna <span className="font-bold text-emerald-600 dark:text-emerald-400">dias</span> se calcula sola con HOY(): días transcurridos desde <span className="font-bold">fecha_revision</span> (columna E). Si la fecha está vacía, queda vacío.
              </p>
            </div>

            <div className="px-3 py-3">
              <button
                onClick={downloadTemplate}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-lg text-xs font-black bg-[#217346] text-white hover:bg-[#1a5c38] transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" /> Descargar plantilla (.xlsx)
              </button>
            </div>
          </div>

          {parseError && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs font-bold text-red-500">
              {parseError}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => { if (parsed) setStep(2); }}
              disabled={!parsed}
              className="flex items-center gap-2 px-5 h-10 rounded-xl text-sm font-bold bg-accent-500 text-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-600 transition-all"
            >
              Continuar <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Message */}
      {step === 2 && parsed && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
            <FileSpreadsheet className="w-5 h-5 text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{fileName}</p>
              <p className="text-[10px] text-slate-400">
                {parsed.total} contactos detectados · Columna teléfono: <span className="font-mono font-bold">{parsed.phoneKey}</span>
              </p>
            </div>
            <button onClick={() => setStep(1)} className="ml-auto text-[11px] font-bold text-accent-500 hover:underline shrink-0">Cambiar archivo</button>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nombre del recordatorio</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Recordatorio de Pago - Agosto"
              className="w-full mt-1.5 px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all text-sm font-bold text-slate-900 dark:text-white placeholder-slate-400/60"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mensaje</label>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-md text-[10px] font-bold">
                {message.replace(/\u200B/g, '').trim().split(/\s+/).filter(w => w.length > 0).length} palabras
              </span>
            </div>

            {templates.length > 0 && (
              <div className="mt-1.5 mb-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <FileText className="w-3 h-3" /> O selecciona una plantilla
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => {
                    const tplId = e.target.value;
                    setSelectedTemplateId(tplId);
                    if (tplId) {
                      const tpl = templates.find((t) => t.id === tplId);
                      if (tpl) {
                        setMessage(tpl.content.replace(/\{\{(.*?)\}\}/g, '\u200B$1\u200B'));
                        if (!name.trim()) setName(tpl.name);
                      }
                    }
                  }}
                  className="w-full px-3 py-2 dark:bg-white/5 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  <option value="">Escribir mensaje manualmente</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} ({tpl.category}) — {tpl.usage_count || 0} usos
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="relative w-full mt-1.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl focus-within:border-accent-500/50 focus-within:ring-4 focus-within:ring-accent-500/5 transition-all">
              {/* Backdrop for syntax highlighting */}
              <div
                ref={backdropRef}
                className="absolute inset-0 px-4 py-3 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words pointer-events-none overflow-hidden"
              >
                {!message ? (
                  <span className="text-slate-400/60">Escribe tu mensaje aquí... Usa los botones de abajo para insertar datos del contacto</span>
                ) : (
                  message.split(/(\u200B.*?\u200B)/g).map((part: string, i: number) => {
                    if (part.startsWith('\u200B') && part.endsWith('\u200B')) {
                      const variable = part.slice(1, -1);
                      return <span key={i} className="text-accent-600 dark:text-accent-400 bg-accent-500/10">{variable}</span>;
                    }
                    return <span key={i} className="text-slate-900 dark:text-white">{part}</span>;
                  })
                )}
                {message.endsWith('\n') && <br />}
              </div>

              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => {
                  let val = e.target.value;
                  val = val.replace(/\{\{(.*?)\}\}/g, '\u200B$1\u200B');
                  setMessage(val);
                  requestAnimationFrame(syncCaret);
                }}
                onSelect={syncCaret}
                onClick={syncCaret}
                onKeyUp={syncCaret}
                onScroll={handleScroll}
                rows={4}
                spellCheck={false}
                className="w-full h-full px-4 py-3 bg-transparent text-transparent caret-slate-900 dark:caret-white outline-none font-mono text-sm leading-relaxed resize-none relative z-10"
              />
            </div>
            {parsed.headers.length > 0 && (
              <div className="mt-2.5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-md bg-accent-500/10 flex items-center justify-center">
                    <span className="text-accent-500 text-[10px] font-black">+</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Toca para insertar</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {parsed.headers.map((h) => (
                    <button
                      key={h}
                      onClick={() => insertVariable(h)}
                      className="group flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-white/5 dark:to-white/[0.02] text-slate-600 dark:text-slate-300 hover:from-accent-500/10 hover:to-accent-500/5 hover:text-accent-600 dark:hover:text-accent-400 transition-all duration-200 border border-slate-200/60 dark:border-white/10 hover:border-accent-500/30 hover:shadow-sm active:scale-95"
                      title={`Insertar: ${h.replace(/_/g, ' ')}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-400/60 group-hover:bg-accent-500 transition-colors" />
                      {h.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Image className="w-3 h-3" /> Imagen (opcional)
            </label>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            {imagePreview ? (
              <div className="mt-1.5 relative inline-block">
                <img src={imagePreview} alt="Vista previa" className="w-24 h-24 object-cover rounded-xl border border-slate-200 dark:border-slate-700" />
                <button
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all shadow-lg"
                >
                  <X className="w-3 h-3" />
                </button>
                <p className="text-[10px] text-slate-400 mt-1">{imageFile?.name} ({(imageFile?.size || 0 / 1024).toFixed(0)}KB)</p>
              </div>
            ) : (
              <button
                onClick={() => imageInputRef.current?.click()}
                className="mt-1.5 w-full flex items-center gap-3 px-4 py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-500 hover:border-accent-500/50 hover:bg-accent-500/5 transition-all"
              >
                <Image className="w-5 h-5 text-slate-400" />
                <div className="text-left">
                  <p className="font-bold">Agregar imagen al mensaje</p>
                  <p className="text-[10px] text-slate-400">JPG, PNG o WebP (máx. 5MB)</p>
                </div>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Smartphone className="w-3 h-3" /> Conexión WhatsApp
              </label>
              <select
                value={connectionId}
                onChange={(e) => setConnectionId(e.target.value)}
                className="w-full mt-1.5 px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all text-sm font-bold text-slate-900 dark:text-white"
              >
                <option value="">{connections.length === 0 ? 'No hay conexiones' : 'Seleccionar conexión'}</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name}{c.phone_number ? ' · ' + c.phone_number : ''} ({c.status})
                  </option>
                ))}
              </select>
              {connections.length === 0 && (
                <p className="text-[10px] text-amber-500 mt-1">Conecta un WhatsApp antes de enviar.</p>
              )}
              {connectedCount === 0 && connections.length > 0 && (
                <p className="text-[10px] text-amber-500 mt-1">Ninguna conexión en línea.</p>
              )}
              {connections.find((c) => c.id === connectionId)?.source === 'cloud' && (
                <div className="mt-3">
                  <label className="text-[11px] font-bold text-violet-500 uppercase tracking-wider">
                    Cloud API — Template Meta
                  </label>
                  {metaTemplatesLoading ? (
                    <div className="mt-1.5 px-4 py-3 dark:bg-white/5 border border-violet-300 dark:border-violet-700 rounded-xl flex items-center gap-2">
                      <Loader size="xs" />
                      <span className="text-xs text-violet-400">Cargando templates de Meta...</span>
                    </div>
                  ) : metaTemplates.length > 0 ? (
                    <select
                      value={metaTemplateName}
                      onChange={(e) => {
                        const tpl = metaTemplates.find((t) => t.name === e.target.value);
                        setMetaTemplateName(e.target.value);
                        setMetaTemplateLanguage(tpl?.language || 'es');
                        if (tpl) {
                          const bodyComp = tpl.components?.find((c: any) => c.type === 'BODY');
                          if (bodyComp?.text) {
                            setMessage(bodyComp.text.replace(/\{\{(.*?)\}\}/g, '\u200B$1\u200B'));
                          }
                        }
                      }}
                      className="w-full mt-1.5 px-4 py-3 dark:bg-white/5 border border-violet-300 dark:border-violet-700 rounded-xl focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/5 outline-none transition-all text-sm font-bold text-slate-900 dark:text-white"
                    >
                      <option value="">Seleccionar template...</option>
                      {metaTemplates.map((t: any) => (
                        <option key={t.name} value={t.name}>
                          {t.name} — {t.language} ({t.status})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={metaTemplateName}
                      onChange={(e) => setMetaTemplateName(e.target.value)}
                      placeholder="ej: plantillaenvios"
                      className="w-full mt-1.5 px-4 py-3 dark:bg-white/5 border border-violet-300 dark:border-violet-700 rounded-xl focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/5 outline-none transition-all text-sm font-bold text-slate-900 dark:text-white"
                    />
                  )}
                   {metaTemplateName && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[10px] text-violet-400">Idioma:</span>
                      <input
                        type="text"
                        value={metaTemplateLanguage}
                        onChange={(e) => setMetaTemplateLanguage(e.target.value)}
                        className="px-2 py-0.5 w-16 text-[10px] font-mono font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-lg outline-none focus:border-violet-500/50"
                      />
                      <span className="text-[9px] text-slate-400">(ej: es, es_PE, en, en_US)</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowCreateMetaTemplate(!showCreateMetaTemplate)}
                    className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-violet-500 dark:text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 rounded-lg transition-all"
                  >
                    <Plus size={12} />
                    Crear plantilla en Meta
                  </button>
                  {showCreateMetaTemplate && (
                    <div className="mt-2 p-3 rounded-xl border border-violet-300 dark:border-violet-700 bg-violet-500/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-violet-500 uppercase">Nueva plantilla Meta</span>
                        <button type="button" onClick={() => setShowCreateMetaTemplate(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                          <X size={14} />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={newMetaTplName}
                        onChange={(e) => setNewMetaTplName(e.target.value.replace(/[^a-z0-9_]/gi, '').toLowerCase())}
                        placeholder="nombre_plantilla"
                        className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg outline-none focus:border-violet-500/50"
                      />
                      <div className="flex gap-2">
                        <select
                          value={newMetaTplLanguage}
                          onChange={(e) => setNewMetaTplLanguage(e.target.value)}
                          className="flex-1 px-3 py-2 text-xs bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg outline-none"
                        >
                          <option value="es">Español (es)</option>
                          <option value="es_PE">Español PE</option>
                          <option value="en">Inglés (en)</option>
                          <option value="en_US">Inglés US</option>
                          <option value="pt_BR">Portugués BR</option>
                        </select>
                        <select
                          value={newMetaTplCategory}
                          onChange={(e) => setNewMetaTplCategory(e.target.value)}
                          className="flex-1 px-3 py-2 text-xs bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg outline-none"
                        >
                          <option value="UTILITY">Utilitaria</option>
                          <option value="MARKETING">Marketing</option>
                          <option value="AUTHENTICATION">Autenticación</option>
                        </select>
                      </div>
                      <textarea
                        value={newMetaTplBody}
                        onChange={(e) => setNewMetaTplBody(e.target.value)}
                        placeholder="Hola {{1}}, tu pedido {{2}} está listo."
                        rows={3}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg outline-none focus:border-violet-500/50 resize-none"
                      />
                      <p className="text-[9px] text-slate-400">Usa {"{{1}}"}, {"{{2}}"}… para variables dinámicas.</p>
                      <button
                        type="button"
                        onClick={handleCreateMetaTemplate}
                        disabled={creatingMetaTemplate || !newMetaTplName.trim() || !newMetaTplBody.trim()}
                        className="w-full py-2 text-xs font-bold text-white bg-violet-500 hover:bg-violet-600 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {creatingMetaTemplate ? (
                          <><Loader size="xs" /> Enviando a Meta...</>
                        ) : (
                          <><Plus size={12} /> Crear y enviar a aprobación</>
                        )}
                      </button>
                    </div>
                  )}
                  {selectedMetaTemplate && (
                    <div className="space-y-2 mt-3">
                      {(() => {
                        const bodyComp = selectedMetaTemplate.components?.find((c: any) => c.type === 'BODY');
                        if (!bodyComp?.text) return null;
                        return (
                          <div className="px-3 py-2 bg-violet-500/10 border border-violet-500/10 rounded-lg">
                            <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-1">Cuerpo del template:</p>
                            <p className="text-xs text-slate-700 dark:text-slate-300 font-mono">{bodyComp.text}</p>
                          </div>
                        );
                      })()}
                      {templateVars.length > 0 && (
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-[10px] font-bold text-violet-400 uppercase">Variables:</span>
                            <div className="flex flex-wrap gap-1">
                              {templateVars.map(v => (
                                <span key={v} className="px-2 py-0.5 bg-violet-500/15 text-violet-500 rounded-md text-[10px] font-mono font-bold border border-violet-500/20">
                                  {`{{${v}}}`}
                                </span>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={handleDownloadTemplateExcel}
                            disabled={downloadingExcel}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-violet-500 text-white hover:bg-violet-600 transition-all shrink-0 disabled:opacity-50"
                          >
                            {downloadingExcel ? <Loader size="xs" /> : <Download className="w-3 h-3" />}
                            Descargar Excel
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-violet-400 mt-1">
                    Cloud API requiere un template aprobado por Meta. El mensaje se enviará como parámetro del template.
                  </p>
                </div>
              )}
              {metaTemplatesError && isCloudConnection && (
                <div className="mt-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-500">
                  <p className="font-bold mb-1">Error cargando templates:</p>
                  <p>{metaTemplatesError}</p>
                  <p className="text-[10px] text-red-400 mt-1">Verifica: Phone Number ID correcto, Access Token con permisos, y que tengas templates creados en Meta Business Suite.</p>
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-3 h-3" /> Velocidad de envío
              </label>
              <select
                value={delayMs}
                onChange={(e) => setDelayMs(e.target.value)}
                className="w-full mt-1.5 px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all text-sm font-bold text-slate-900 dark:text-white"
              >
                {delayOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">Recomendado: 6s para evitar bloqueos.</p>
            </div>
          </div>

          <div className="px-4 py-4 bg-[#efeae2] dark:bg-[#0b141a] bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-cover bg-center bg-blend-soft-light rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3 bg-white/80 dark:bg-slate-900/80 px-3 py-1.5 rounded-lg backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vista previa</p>
              <div className="flex items-center gap-1">
                <Smartphone className="w-3 h-3 text-slate-400" />
                <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">{parsed.rows[0].phone}</span>
              </div>
            </div>

            <div className="flex flex-col items-end">
              <div className="max-w-[85%] bg-[#d9fdd3] dark:bg-[#005c4b] rounded-2xl rounded-tr-none p-1.5 shadow-sm relative">
                {imagePreview && (
                  <img src={imagePreview} alt="Imagen adjunta" className="w-full h-auto max-h-48 object-cover rounded-xl mb-1" />
                )}
                <div className="px-1.5 pb-4">
                  <p className="text-[13px] leading-relaxed text-[#111b21] dark:text-[#e9edef] whitespace-pre-wrap">{renderPreview() || 'Escribe un mensaje...'}</p>
                </div>
                <div className="absolute bottom-1.5 right-2 text-[9px] text-[#667781] dark:text-[#8696a0] flex items-center gap-1">
                  12:00
                  <svg viewBox="0 0 16 11" width="14" height="10" fill="currentColor" className="text-[#53bdeb]"><path d="M11.8 1.6L13.8 3.6L6.5 10.9L2.5 6.9L4.5 4.9L6.5 6.9L11.8 1.6ZM16 3.6L8.7 10.9L6.7 8.9L14 1.6L16 3.6ZM4.2 10.9L0 6.7L2 4.7L6.2 8.9L4.2 10.9Z"></path></svg>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <button onClick={() => setStep(1)} className="flex items-center gap-2 px-4 h-9 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all">
              <ChevronLeft className="w-3.5 h-3.5" /> Volver
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!name.trim() || !message.trim()}
              className="flex items-center gap-2 px-5 h-10 rounded-xl text-sm font-bold bg-accent-500 text-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-600 transition-all"
            >
              Continuar <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Schedule */}
      {step === 3 && parsed && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {scheduleOptions.map((opt) => {
              const Icon = opt.icon;
              const isActive = scheduleType === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setScheduleType(opt.value)}
                  className={`px-4 py-4 rounded-xl border-2 text-center transition-all ${isActive
                      ? 'border-accent-500 bg-accent-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                >
                  <Icon className={`w-6 h-6 mx-auto mb-2 ${isActive ? 'text-accent-500' : 'text-slate-400'}`} />
                  <p className={`text-sm font-bold ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>{opt.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</p>
                </button>
              );
            })}
          </div>

          {scheduleType === 'once' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fecha</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full mt-1.5 px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Hora</label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full mt-1.5 px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {scheduleType === 'recurring' && (
            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Frecuencia</label>
              <div className="mt-2 space-y-2">
                {recurringOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setRecurringOption(opt.value)}
                    className={`w-full px-4 py-3 rounded-xl border-2 text-left transition-all ${recurringOption === opt.value
                        ? 'border-accent-500 bg-accent-500/10'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                  >
                    <p className={`text-sm font-bold ${recurringOption === opt.value ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>{opt.label}</p>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">Los recordatorios recurrentes se envían a las 9:00 AM y se reinician después de cada envío.</p>
            </div>
          )}

          {scheduleType === 'now' && (
            <label className="flex items-center gap-3 px-4 py-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl cursor-pointer">
              <input type="checkbox" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Enviar inmediatamente al crear</p>
                <p className="text-[10px] text-slate-400">Si la conexión no está lista, se guardará como borrador para enviar después.</p>
              </div>
            </label>
          )}

          {scheduleType === 'once' && !scheduledDate && (
            <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs font-bold text-amber-600 dark:text-amber-400">
              Selecciona una fecha y hora para programar el recordatorio.
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <button onClick={() => setStep(2)} className="flex items-center gap-2 px-4 h-9 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all">
              <ChevronLeft className="w-3.5 h-3.5" /> Volver
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={scheduleType === 'once' && !scheduledDate}
              className="flex items-center gap-2 px-5 h-10 rounded-xl text-sm font-bold bg-accent-500 text-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-600 transition-all"
            >
              Revisar y crear <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Review */}
      {step === 4 && parsed && (
        <div className="space-y-4">
          {/* Stats compactos inline */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-500/10 text-accent-600 dark:text-accent-400 rounded-full text-xs font-bold border border-accent-500/20">
              <Users className="w-3 h-3" />{parsed.total} contactos
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-bold border border-emerald-500/20">
              {message.replace(/\u200B/g, '').trim().split(/\s+/).filter(w => w.length > 0).length} palabras
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
              connections.find((c) => c.id === connectionId)?.status === 'connected'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connections.find((c) => c.id === connectionId)?.status === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {connections.find((c) => c.id === connectionId)?.status === 'connected' ? 'Conectado' : 'Sin conexión'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-700">
              {scheduleType === 'now' && <><Send className="w-3 h-3" />Inmediato</>}
              {scheduleType === 'once' && <><Calendar className="w-3 h-3" />{scheduledDate || 'Programado'}</>}
              {scheduleType === 'recurring' && <><RotateCcw className="w-3 h-3" />{recurringOptions.find((o) => o.value === recurringOption)?.label}</>}
            </span>
          </div>

          {/* Resumen en cards compactas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="px-4 py-3 bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-slate-100 dark:border-slate-800">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{name}</p>
            </div>
            <div className="px-4 py-3 bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-slate-100 dark:border-slate-800">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Programación</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                {scheduleType === 'now' && 'Inmediato'}
                {scheduleType === 'once' && scheduledDate && `${scheduledDate} ${scheduledTime}`}
                {scheduleType === 'recurring' && recurringOptions.find((o) => o.value === recurringOption)?.label}
              </p>
            </div>
          </div>

          <div className="px-4 py-3 bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-slate-100 dark:border-slate-800">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mensaje</p>
            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed line-clamp-3">
              {message.replace(/\u200B(.*?)\u200B/g, '{{$1}}').split(/(\{\{[\w\s-]+\}\})/g).map((part: string, i: number) => {
                if (part.startsWith('{{') && part.endsWith('}}')) {
                  const variable = part.slice(2, -2).trim();
                  return <span key={i} className="font-bold text-accent-600 dark:text-accent-400 bg-accent-500/10 px-1 rounded text-xs">{variable}</span>;
                }
                return <span key={i}>{part}</span>;
              })}
            </p>
          </div>

          {imagePreview && (
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-slate-100 dark:border-slate-800">
              <img src={imagePreview} alt="" className="w-12 h-12 object-cover rounded-lg shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Imagen adjunta</p>
                <p className="text-xs text-slate-500 truncate">{imageFile?.name}</p>
              </div>
            </div>
          )}

          {connections.find((c) => c.id === connectionId)?.status !== 'connected' && (
            <div className="px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] font-bold text-amber-600 dark:text-amber-400">
              La conexión no está en línea. El envío se iniciará cuando esté disponible.
            </div>
          )}

          {/* Navegación */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <button onClick={() => setStep(3)} disabled={creating} className="flex items-center gap-2 px-4 h-9 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all">
              <ChevronLeft className="w-3.5 h-3.5" /> Volver
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-5 h-10 rounded-xl text-sm font-black bg-gradient-to-r from-accent-500 to-accent-600 text-black hover:opacity-90 transition-all shadow-lg shadow-accent-500/20 disabled:opacity-50"
            >
              {creating ? <Loader size="xs" /> : <Send className="w-4 h-4" />}
              {creating ? 'Creando...' : sendNow && scheduleType === 'now' ? 'Crear y Enviar' : 'Crear Recordatorio'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
