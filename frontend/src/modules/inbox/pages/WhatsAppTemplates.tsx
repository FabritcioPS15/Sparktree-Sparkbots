import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Plus, Trash2, CheckCircle2, Clock, XCircle, AlertTriangle,
  Copy, Cloud, ExternalLink, Eye, FileText,
  ChevronDown, Globe, Zap, MessageSquare, X, AlertCircle, Shield
} from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageContainer } from '../../../components/layout/PageContainer';
import { PageBody } from '../../../components/layout/PageBody';
import { Modal } from '../../../components/ui/Modal';
import { HeaderButton } from '../../../components/ui/HeaderButton';
import { Loader } from '../../../components/ui/Loader';
import { SearchBar } from '../../../components/ui/SearchBar';
import { Dropdown } from '../../../components/ui/Dropdown';
import { useNotifications } from '../../../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import api, {
  getConnectionTemplates,
  createConnectionTemplate,
  deleteConnectionTemplate,
} from '../../../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MetaTemplate {
  id: string;
  name: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'DISABLED' | 'PAUSED';
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  components: MetaComponent[];
  rejected_reason?: string;
  quality_score?: { score: string; date: string };
}

interface MetaComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  buttons?: MetaButton[];
  example?: any;
}

interface MetaButton {
  type: 'QUICK_REPLY' | 'PHONE_NUMBER' | 'URL';
  text: string;
  phone_number?: string;
  url?: string;
}

interface CloudConnection {
  id: string;
  display_name: string;
  status: string;
  platform_account_id?: string;
}

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, {
  label: string; icon: any; className: string; pulse?: boolean; description: string;
}> = {
  APPROVED: {
    label: 'Aprobado', icon: CheckCircle2,
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
    description: 'Listo para usar en campañas',
  },
  PENDING: {
    label: 'Pendiente', icon: Clock,
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
    pulse: true,
    description: 'Esperando aprobación de Meta (24-48h)',
  },
  REJECTED: {
    label: 'Rechazado', icon: XCircle,
    className: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
    description: 'Meta rechazó este template',
  },
  DISABLED: {
    label: 'Deshabilitado', icon: AlertTriangle,
    className: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20',
    description: 'Template deshabilitado por Meta',
  },
  PAUSED: {
    label: 'Pausado', icon: AlertTriangle,
    className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20',
    description: 'Template pausado temporalmente',
  },
};

const CATEGORY_CONFIG: Record<string, { label: string; className: string }> = {
  MARKETING: { label: 'Marketing', className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  UTILITY: { label: 'Utilidad', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  AUTHENTICATION: { label: 'Autenticación', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
};

const LANGUAGE_LABELS: Record<string, string> = {
  es: 'Español', es_MX: 'Español (MX)', es_AR: 'Español (AR)',
  en_US: 'Inglés (US)', en_GB: 'Inglés (UK)',
  pt_BR: 'Portugués (BR)', pt_PT: 'Portugués',
  fr: 'Francés', de: 'Alemán', it: 'Italiano',
};

// ─── WhatsApp Preview ─────────────────────────────────────────────────────────

const WhatsAppPreview = ({
  header, body, footer, buttons,
}: { header?: string; body: string; footer?: string; buttons?: MetaButton[] }) => {
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-[280px] bg-[#e5ddd5] dark:bg-[#0a1628] rounded-2xl p-3 shadow-xl">
        <div className="bg-[#128C7E] rounded-xl p-2.5 mb-2 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white text-xs font-bold">Tu empresa</p>
            <p className="text-white/70 text-[10px]">Business Account</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1f2937] rounded-xl p-3 shadow-sm relative">
          <div className="absolute -left-2 top-3 w-0 h-0 border-t-[6px] border-t-transparent border-r-[8px] border-r-white dark:border-r-[#1f2937] border-b-[6px] border-b-transparent" />
          {header && (
            <p className="text-[11px] font-black text-slate-900 dark:text-white mb-1.5 leading-snug">{header}</p>
          )}
          <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
            {body || <span className="text-slate-400 italic">Escribe el cuerpo del mensaje...</span>}
          </p>
          {footer && (
            <p className="text-[10px] text-slate-400 mt-1.5 leading-snug">{footer}</p>
          )}
          <p className="text-right text-[9px] text-slate-400 mt-1">{timeStr} ✓✓</p>
        </div>
        {buttons && buttons.length > 0 && (
          <div className="mt-1 space-y-1">
            {buttons.map((btn, i) => (
              <div key={i} className="bg-white dark:bg-[#1f2937] rounded-xl px-3 py-2 text-center shadow-sm">
                <span className="text-[11px] font-bold text-[#128C7E]">{btn.text || `Botón ${i + 1}`}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Create Template Modal ────────────────────────────────────────────────────

const CreateTemplateModal = ({
  open, onClose, connectionId, onCreated,
}: { open: boolean; onClose: () => void; connectionId: string; onCreated: () => void }) => {
  const { addNotification } = useNotifications();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  const [form, setForm] = useState({
    name: '',
    category: 'MARKETING',
    language: 'es',
    headerText: '',
    bodyText: '',
    footerText: '',
  });

  const [buttons, setButtons] = useState<MetaButton[]>([]);

  const setField = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const addButton = () => {
    if (buttons.length >= 3) return;
    setButtons(prev => [...prev, { type: 'QUICK_REPLY', text: '' }]);
  };
  const removeButton = (i: number) => setButtons(prev => prev.filter((_, idx) => idx !== i));
  const updateButton = (i: number, key: string, val: string) => {
    setButtons(prev => prev.map((b, idx) => idx === i ? { ...b, [key]: val } : b));
  };

  const buildComponents = () => {
    const comps: any[] = [];
    if (form.headerText.trim()) {
      const headerComp: any = { type: 'HEADER', format: 'TEXT', text: form.headerText.trim() };
      const headerVars = [...form.headerText.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
      if (headerVars.length > 0) {
        headerVars.forEach((v, i) => { headerVars[i] = v; });
        headerComp.example = { header_text: headerVars.map(v => `[${v}]`) };
      }
      comps.push(headerComp);
    }
    const bodyComp: any = { type: 'BODY', text: form.bodyText.trim() };
    const bodyVars = [...form.bodyText.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
    if (bodyVars.length > 0) {
      bodyComp.example = { body_text_named_params: bodyVars.map(v => ({ parameter_name: v, example: `[${v}]` })) };
    }
    comps.push(bodyComp);
    if (form.footerText.trim()) comps.push({ type: 'FOOTER', text: form.footerText.trim() });
    if (buttons.length > 0) {
      comps.push({
        type: 'BUTTONS',
        buttons: buttons.map(b => ({
          type: b.type,
          text: b.text,
          ...(b.type === 'PHONE_NUMBER' ? { phone_number: b.phone_number } : {}),
          ...(b.type === 'URL' ? { url: b.url } : {}),
        })),
      });
    }
    return comps;
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return addNotification({ type: 'error', title: 'Falta el nombre', message: 'El nombre es obligatorio.' });
    if (!form.bodyText.trim()) return addNotification({ type: 'error', title: 'Falta el cuerpo', message: 'El cuerpo del mensaje es obligatorio.' });
    const nameRegex = /^[a-z0-9_]+$/;
    if (!nameRegex.test(form.name)) return addNotification({ type: 'error', title: 'Nombre inválido', message: 'Solo minúsculas, números y guiones bajos (_).' });

    setSaving(true);
    try {
      const components = buildComponents();
      const hasVars = components.some((c: any) => c.example);
      await createConnectionTemplate(connectionId, {
        name: form.name,
        category: form.category,
        language: form.language,
        ...(hasVars ? { parameter_format: 'named' } : {}),
        components,
      });
      addNotification({ type: 'success', title: '¡Template enviado!', message: 'Meta revisará el template. Puede tardar 24-48 horas.' });
      onCreated();
      onClose();
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Error de Meta', message: err?.response?.data?.error || err.message });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo Template de WhatsApp"
      icon={<Cloud className="w-5 h-5 text-emerald-500" />}
      footer={
        <div className="flex items-center justify-between">
          <button onClick={onClose} disabled={saving} className="px-4 h-10 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={saving} className="flex items-center gap-2 px-5 h-10 rounded-xl text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-all disabled:opacity-40">
            {saving ? <Loader size="xs" /> : <Cloud className="w-4 h-4" />}
            Enviar a Meta
          </button>
        </div>
      }
    >
      {/* Tabs */}
      <div className="flex rounded-xl bg-slate-100 dark:bg-white/5 p-1 mb-5">
        {(['edit', 'preview'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab ? 'bg-white dark:bg-white/10 shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}
          >
            {tab === 'edit' ? '✏️ Editar' : '👁 Preview'}
          </button>
        ))}
      </div>

      {activeTab === 'preview' ? (
        <div className="py-2">
          <WhatsAppPreview
            header={form.headerText || undefined}
            body={form.bodyText || 'Escribe el cuerpo del mensaje...'}
            footer={form.footerText || undefined}
            buttons={buttons.length > 0 ? buttons : undefined}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Nombre del template <span className="text-red-400">*</span>
            </label>
            <input
              value={form.name}
              onChange={e => setField('name', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              placeholder="ej. bienvenida_nuevo_cliente"
              className="w-full mt-1.5 px-4 py-2.5 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all text-sm font-mono text-slate-900 dark:text-white placeholder-slate-400/60"
            />
            <p className="text-[10px] text-slate-400 mt-1">Solo minúsculas, números y guión bajo. Sin espacios.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Categoría</label>
              <select value={form.category} onChange={e => setField('category', e.target.value)} className="w-full mt-1.5 px-3 py-2.5 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm text-slate-900 dark:text-white">
                <option value="MARKETING">Marketing</option>
                <option value="UTILITY">Utilidad</option>
                <option value="AUTHENTICATION">Autenticación</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Idioma</label>
              <select value={form.language} onChange={e => setField('language', e.target.value)} className="w-full mt-1.5 px-3 py-2.5 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm text-slate-900 dark:text-white">
                {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Header <span className="text-slate-400 font-normal normal-case">(opcional)</span></label>
            <input value={form.headerText} onChange={e => setField('headerText', e.target.value)} placeholder="Título en negrita del mensaje" className="w-full mt-1.5 px-4 py-2.5 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-emerald-500/50 outline-none transition-all text-sm text-slate-900 dark:text-white placeholder-slate-400/60" />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cuerpo del mensaje <span className="text-red-400">*</span></label>
            <textarea value={form.bodyText} onChange={e => setField('bodyText', e.target.value)} rows={5} placeholder={'Hola {{nombre_completo}}, su vehículo con placa {{placa}} está por vencer.'} className="w-full mt-1.5 px-4 py-2.5 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-emerald-500/50 outline-none transition-all text-sm font-mono text-slate-900 dark:text-white placeholder-slate-400/60 resize-none" />
            <div className="mt-1.5 px-3 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Variables:</span> Usa <code className="bg-emerald-500/10 text-emerald-600 px-1 rounded font-mono">{'{{nombre}}'}</code>, <code className="bg-emerald-500/10 text-emerald-600 px-1 rounded font-mono">{'{{placa}}'}</code>... nombres descriptivos en minúsculas.
              </p>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Footer <span className="text-slate-400 font-normal normal-case">(opcional)</span></label>
            <input value={form.footerText} onChange={e => setField('footerText', e.target.value)} placeholder="Texto pequeño al final" className="w-full mt-1.5 px-4 py-2.5 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-emerald-500/50 outline-none transition-all text-sm text-slate-900 dark:text-white placeholder-slate-400/60" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Botones <span className="text-slate-400 font-normal normal-case">(máx. 3)</span></label>
              {buttons.length < 3 && (
                <button onClick={addButton} className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Agregar
                </button>
              )}
            </div>
            <div className="space-y-2">
              {buttons.map((btn, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <select value={btn.type} onChange={e => updateButton(i, 'type', e.target.value)} className="text-xs px-2 py-1.5 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-white">
                    <option value="QUICK_REPLY">Respuesta rápida</option>
                    <option value="PHONE_NUMBER">Teléfono</option>
                    <option value="URL">URL</option>
                  </select>
                  <input value={btn.text} onChange={e => updateButton(i, 'text', e.target.value)} placeholder="Texto del botón" className="flex-1 text-xs px-3 py-1.5 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-white placeholder-slate-400/60" />
                  {btn.type === 'PHONE_NUMBER' && <input value={btn.phone_number || ''} onChange={e => updateButton(i, 'phone_number', e.target.value)} placeholder="+52..." className="w-24 text-xs px-2 py-1.5 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-white" />}
                  {btn.type === 'URL' && <input value={btn.url || ''} onChange={e => updateButton(i, 'url', e.target.value)} placeholder="https://..." className="w-32 text-xs px-2 py-1.5 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-white" />}
                  <button onClick={() => removeButton(i)} className="p-1 text-slate-400 hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {buttons.length === 0 && (
                <p className="text-[11px] text-slate-400 text-center py-3 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">Sin botones — click en "Agregar" para incluir</p>
              )}
            </div>
          </div>

          <div className="p-3 bg-amber-500/5 border border-amber-500/15 rounded-xl flex gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Meta revisará el template. Una vez aprobado (24-48h) aparecerá con estado <span className="text-emerald-500 font-bold">APPROVED</span> y podrás usarlo en campañas.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
};

// ─── Template Card ────────────────────────────────────────────────────────────

const TemplateCard = ({
  template, onDelete, onCopy,
}: { template: MetaTemplate; onDelete: () => void; onCopy: () => void }) => {
  const status = STATUS_CONFIG[template.status] || STATUS_CONFIG['DISABLED'];
  const StatusIcon = status.icon;
  const category = CATEGORY_CONFIG[template.category] || { label: template.category, className: 'bg-slate-500/10 text-slate-500' };
  const [expanded, setExpanded] = useState(false);

  const bodyComp = template.components.find(c => c.type === 'BODY');
  const headerComp = template.components.find(c => c.type === 'HEADER');
  const footerComp = template.components.find(c => c.type === 'FOOTER');
  const buttonsComp = template.components.find(c => c.type === 'BUTTONS');

  return (
    <div className={`group bg-white dark:bg-dark-card rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden ${template.status === 'APPROVED' ? 'border-emerald-500/15 dark:border-emerald-500/10' : template.status === 'PENDING' ? 'border-amber-500/15 dark:border-amber-500/10' : template.status === 'REJECTED' ? 'border-red-500/15 dark:border-red-500/10' : 'border-slate-100 dark:border-slate-800/50'}`}>
      <div className={`h-0.5 w-full ${template.status === 'APPROVED' ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : template.status === 'PENDING' ? 'bg-gradient-to-r from-amber-400 to-amber-500' : template.status === 'REJECTED' ? 'bg-gradient-to-r from-red-400 to-red-500' : 'bg-gradient-to-r from-slate-300 to-slate-400'}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${status.className}`}>
                <StatusIcon className={`w-3 h-3 ${status.pulse ? 'animate-pulse' : ''}`} />
                {status.label}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${category.className}`}>{category.label}</span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                <Globe className="w-2.5 h-2.5" />
                {LANGUAGE_LABELS[template.language] || template.language}
              </span>
            </div>
            <h3 className="font-mono text-sm font-bold text-slate-900 dark:text-white truncate">{template.name}</h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onCopy} title="Copiar nombre" className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-all"><Copy className="w-3.5 h-3.5" /></button>
            <button onClick={() => setExpanded(e => !e)} title="Ver preview" className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 transition-all"><Eye className="w-3.5 h-3.5" /></button>
            <button onClick={onDelete} title="Eliminar" className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {bodyComp?.text && (
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 mb-2 font-mono">{bodyComp.text}</p>
        )}

        {template.status === 'REJECTED' && template.rejected_reason && (
          <div className="flex items-start gap-2 mt-2 p-2 bg-red-500/5 border border-red-500/10 rounded-lg">
            <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-red-500 leading-relaxed">{template.rejected_reason}</p>
          </div>
        )}

        {template.status === 'PENDING' && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-amber-500/5 border border-amber-500/10 rounded-lg">
            <Clock className="w-3 h-3 text-amber-500 animate-pulse shrink-0" />
            <p className="text-[10px] text-amber-600 dark:text-amber-400">Meta está revisando este template (24-48h)</p>
          </div>
        )}

        {buttonsComp?.buttons && buttonsComp.buttons.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {buttonsComp.buttons.slice(0, 3).map((btn, i) => (
              <span key={i} className="px-2 py-0.5 text-[10px] font-bold bg-[#128C7E]/10 text-[#128C7E] rounded-full border border-[#128C7E]/20">{btn.text}</span>
            ))}
          </div>
        )}

        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <WhatsAppPreview
              header={headerComp?.text}
              body={bodyComp?.text || ''}
              footer={footerComp?.text}
              buttons={buttonsComp?.buttons}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export const WhatsAppTemplates = () => {
  const { addNotification } = useNotifications();
  const navigate = useNavigate();

  const [cloudConnections, setCloudConnections] = useState<CloudConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [viewMode] = useState<'grid' | 'list'>('grid');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MetaTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await api.get('/platform/connections');
        const waClouds = (resp.data || []).filter((c: any) => c.platform_type === 'whatsapp' && c.status === 'connected');
        setCloudConnections(waClouds);
        if (waClouds.length > 0) setSelectedConnectionId(waClouds[0].id);
      } catch {
        // silent
      } finally {
        setLoadingConnections(false);
      }
    };
    load();
  }, []);

  const loadTemplates = useCallback(async (silent = false) => {
    if (!selectedConnectionId) return;
    if (!silent) setLoading(true);
    else setSyncing(true);
    try {
      const data = await getConnectionTemplates(selectedConnectionId);
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Error al cargar', message: err?.response?.data?.error || err.message });
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [selectedConnectionId, addNotification]);

  useEffect(() => {
    if (selectedConnectionId) loadTemplates();
  }, [loadTemplates, selectedConnectionId]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteConnectionTemplate(selectedConnectionId, deleteTarget.name, deleteTarget.id);
      setTemplates(prev => prev.filter(t => t.id !== deleteTarget.id));
      addNotification({ type: 'success', title: 'Template eliminado', message: `"${deleteTarget.name}" fue eliminado de Meta.` });
      setDeleteTarget(null);
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Error', message: err?.response?.data?.error || err.message });
    } finally {
      setDeleting(false);
    }
  };

  const copyTemplateName = (name: string) => {
    navigator.clipboard.writeText(name);
    addNotification({ type: 'success', title: 'Copiado', message: `"${name}" copiado al portapapeles.` });
  };

  const filtered = templates.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'ALL' || t.status === filterStatus;
    const matchCat = filterCategory === 'ALL' || t.category === filterCategory;
    return matchSearch && matchStatus && matchCat;
  });

  const counts = templates.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (!loadingConnections && cloudConnections.length === 0) {
    return (
      <PageContainer>
        <PageHeader title="Templates de WhatsApp" description="Gestiona los templates oficiales de Meta/WhatsApp Cloud API" icon={Cloud} />
        <PageBody>
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#25D366]/20 to-[#128C7E]/20 flex items-center justify-center">
                <Cloud className="w-10 h-10 text-[#25D366]" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-3 h-3 text-white" />
              </div>
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">Necesitas conectar WhatsApp Cloud API</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-8 leading-relaxed">
              Los templates de Meta solo están disponibles para cuentas de <strong>WhatsApp Business Cloud API</strong>. Conecta tu cuenta para ver, crear y gestionar templates aprobados por Meta.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => navigate('/multi-whatsapp')} className="flex items-center gap-2 px-6 h-11 bg-[#25D366] text-white text-sm font-bold rounded-xl hover:bg-[#128C7E] transition-all shadow-lg shadow-[#25D366]/25">
                <Zap className="w-4 h-4" /> Conectar Cloud API
              </button>
              <a href="https://business.facebook.com/wa/manage/message-templates/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 h-11 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold rounded-xl hover:border-slate-400 transition-all">
                <ExternalLink className="w-4 h-4" /> Meta Business Manager
              </a>
            </div>
          </div>
        </PageBody>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Templates de WhatsApp"
        description="Templates oficiales de Meta — gestiona y crea templates para campañas masivas"
        icon={Cloud}
        meta={[
          { label: 'Aprobados', value: counts['APPROVED'] || 0, icon: CheckCircle2, color: 'emerald' },
          { label: 'Pendientes', value: counts['PENDING'] || 0, icon: Clock, color: 'amber' },
          { label: 'Rechazados', value: counts['REJECTED'] || 0, icon: XCircle, color: 'red' },
        ]}
        action={
          <HeaderButton onClick={() => setShowCreate(true)} disabled={!selectedConnectionId} icon={<Plus className="w-4 h-4" />}>
            Nuevo Template
          </HeaderButton>
        }
      />

      <PageBody>
        {cloudConnections.length > 1 && (
          <div className="mb-4 flex items-center gap-3 p-3 bg-white dark:bg-dark-card rounded-xl border border-slate-100 dark:border-slate-800/50">
            <Cloud className="w-4 h-4 text-[#25D366] shrink-0" />
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cuenta:</span>
            <div className="relative flex-1 max-w-xs">
              <select value={selectedConnectionId} onChange={e => setSelectedConnectionId(e.target.value)} className="w-full pl-3 pr-8 py-1.5 text-sm font-bold dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-white appearance-none">
                {cloudConnections.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
            <a href="https://business.facebook.com/wa/manage/message-templates/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] font-bold text-[#25D366] hover:underline ml-auto">
              <ExternalLink className="w-3 h-3" /> Meta Business Manager
            </a>
          </div>
        )}

        {cloudConnections.length === 1 && (
          <div className="mb-4 flex items-center gap-3 px-4 py-2.5 bg-emerald-500/5 border border-emerald-500/15 rounded-xl">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{cloudConnections[0].display_name}</span>
            <span className="text-[10px] text-slate-400 ml-auto">Conectado · Cloud API</span>
            <a href="https://business.facebook.com/wa/manage/message-templates/" target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#25D366] hover:underline flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> Meta
            </a>
          </div>
        )}

        {/* Status filter pills */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {['ALL', 'APPROVED', 'PENDING', 'REJECTED', 'DISABLED'].map(s => {
            const cfg = s === 'ALL' ? null : STATUS_CONFIG[s];
            const count = s === 'ALL' ? templates.length : (counts[s] || 0);
            return (
              <button key={s} onClick={() => setFilterStatus(s)} className={`flex items-center gap-1.5 px-3 h-8 rounded-full text-[11px] font-bold transition-all ${filterStatus === s ? 'bg-slate-900 dark:bg-white text-white dark:text-black shadow-md' : 'bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-400'}`}>
                {cfg && <cfg.icon className="w-3 h-3" />}
                {s === 'ALL' ? 'Todos' : cfg?.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${filterStatus === s ? 'bg-white/20' : 'bg-slate-100 dark:bg-white/10'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Search + filters */}
        <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-100 dark:border-slate-800/50 p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchBar
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar templates por nombre..."
            />
            <div className="flex items-center gap-2 shrink-0">
              <Dropdown
                value={filterCategory}
                onChange={setFilterCategory}
                options={[
                  { value: 'ALL', label: 'Todas las Categorías' },
                  { value: 'MARKETING', label: 'Marketing' },
                  { value: 'UTILITY', label: 'Utilidad' },
                  { value: 'AUTHENTICATION', label: 'Autenticación' },
                ]}
              />
              <button onClick={() => loadTemplates(true)} disabled={syncing} className="flex items-center gap-2 px-4 h-10 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:border-[#25D366] hover:text-[#25D366] transition-all shrink-0">
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                Sincronizar
              </button>
            </div>
          </div>
        </div>

        {/* Templates */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 flex items-center justify-center mx-auto mb-3">
                <Cloud className="w-6 h-6 text-[#25D366] animate-pulse" />
              </div>
              <p className="text-sm font-bold text-slate-500">Cargando templates de Meta...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-dark-card rounded-xl border border-slate-100 dark:border-slate-800/50">
            <div className="p-4 bg-[#25D366]/10 rounded-2xl mb-4"><FileText className="w-10 h-10 text-[#25D366]" /></div>
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">{templates.length === 0 ? 'No hay templates' : 'Sin resultados'}</h3>
            <p className="text-xs text-slate-400 max-w-sm mb-5">{templates.length === 0 ? 'Crea tu primer template de WhatsApp para empezar a enviar campañas.' : 'Prueba con otros filtros o términos de búsqueda.'}</p>
            {templates.length === 0 && (
              <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-5 h-10 bg-[#25D366] text-white text-sm font-bold rounded-xl hover:bg-[#128C7E] transition-all">
                <Plus className="w-4 h-4" /> Crear template
              </button>
            )}
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' : 'flex flex-col gap-3'}>
            {filtered.map(t => (
              <TemplateCard key={t.id} template={t} onDelete={() => setDeleteTarget(t)} onCopy={() => copyTemplateName(t.name)} />
            ))}
          </div>
        )}

        {templates.length > 0 && (
          <div className="mt-4 flex items-start gap-3 px-4 py-3 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-slate-800 rounded-xl">
            <Shield className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Los templates deben cumplir con las <a href="https://developers.facebook.com/docs/whatsapp/message-templates/guidelines" target="_blank" rel="noopener noreferrer" className="text-[#25D366] hover:underline">políticas de Meta</a>. Los templates APPROVED pueden usarse en campañas de mensajes salientes.
            </p>
          </div>
        )}
      </PageBody>

      {showCreate && selectedConnectionId && (
        <CreateTemplateModal open={showCreate} onClose={() => setShowCreate(false)} connectionId={selectedConnectionId} onCreated={() => loadTemplates(true)} />
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar template"
        icon={<Trash2 className="w-5 h-5 text-red-500" />}
        footer={
          <div className="flex items-center justify-between">
            <button onClick={() => setDeleteTarget(null)} className="px-4 h-10 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all">Cancelar</button>
            <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-2 px-5 h-10 rounded-xl text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-all disabled:opacity-40">
              {deleting ? <Loader size="xs" /> : <Trash2 className="w-4 h-4" />} Eliminar
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            ¿Eliminar el template <span className="font-mono font-bold text-slate-900 dark:text-white">"{deleteTarget?.name}"</span> de Meta?
          </p>
          <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl flex gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-500 leading-relaxed">Esta acción es permanente. Si el template está siendo usado en campañas activas, esas campañas fallarán.</p>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
};
