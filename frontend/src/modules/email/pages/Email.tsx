import { useState, useMemo, useRef, useCallback } from 'react';
import {
  Mail, Send, Plus, Trash2, Star, Search, ChevronRight,
  Bold, Italic, Underline, Link, Paperclip, X, Clock,
  CheckCircle2, Users, AtSign, PenSquare, FileSignature, Inbox,
  Package, BookTemplate, User, Eye
} from 'lucide-react';
import { Loader } from '../../../components/ui/Loader';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PageContainer } from '../../../components/layout/PageContainer';
import { PageBody } from '../../../components/layout/PageBody';
import { useNotifications } from '../../../contexts/NotificationContext';

interface SentEmail {
  id: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  sentAt: Date;
  starred: boolean;
}

interface SocialLink {
  platform: 'linkedin' | 'twitter' | 'instagram' | 'facebook' | 'website';
  url: string;
}

interface Signature {
  id: string;
  name: string;
  isDefault: boolean;
  fullName: string;
  position: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string;
  socialLinks: SocialLink[];
  layout: 'classic' | 'modern' | 'compact' | 'minimal';
  showSeparator: boolean;
  accentColor: string;
  fontSize: 'small' | 'medium' | 'large';
  content: string;
}

const MOCK_SENT: SentEmail[] = [
  {
    id: '1',
    to: 'contacto@empresaabc.com',
    subject: 'Propuesta de servicios SparkBot',
    body: 'Estimado equipo,\n\nAdjunto encontrará nuestra propuesta de servicios para su empresa. Hemos diseñado un plan personalizado que se adapta a las necesidades de su negocio, incluyendo herramientas de automatización, CRM omnicanal y analíticas avanzadas.\n\nQuedamos atentos a cualquier pregunta o comentario.\n\nSaludos cordiales,\nEquipo SparkBot',
    sentAt: new Date(Date.now() - 1000 * 60 * 45),
    starred: true,
  },
  {
    id: '2',
    to: 'gerencia@clientexyz.com',
    cc: 'ventas+fabpsandoval@gmail.com',
    subject: 'Seguimiento reunión del jueves',
    body: 'Buenas tardes,\n\nEscribimos para dar seguimiento a la reunión del jueves pasado. Adjunto la presentación con los puntos clave que discutimos:\n\n1. Integración con WhatsApp Business API\n2. Dashboard de métricas en tiempo real\n3. Migración de datos desde su CRM actual\n\nQuedamos a la espera de su confirmación para iniciar la implementación.\n\nSaludos,\nEquipo SparkBot',
    sentAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
    starred: false,
  },
  {
    id: '3',
    to: 'info@distribuidora.com',
    subject: 'Información sobre plan Growth',
    body: 'Hola,\n\nGracias por su interés en nuestros servicios. El Plan Growth incluye:\n\n• Hasta 5,000 conversaciones/mes\n• Todos los canales (WhatsApp, Instagram, Telegram, Messenger, TikTok)\n• Soporte prioritario 24/7\n• Base de conocimiento ilimitada\n\nEl costo es de $499/mes. ¿Te gustaría agendar una demo?\n\nSaludos,\nEquipo SparkBot',
    sentAt: new Date(Date.now() - 1000 * 60 * 60 * 26),
    starred: false,
  },
  {
    id: '4',
    to: 'director@corporativo.mx',
    subject: 'Cotización personalizada — Q3 2026',
    body: 'Estimado Director,\n\nConforme a su solicitud, adjuntamos la cotización para el tercer trimestre del 2026. La propuesta incluye descuentos por volumen y soporte premium.\n\nQuedamos a su disposición para cualquier ajuste.\n\nAtentamente,\nEquipo SparkBot',
    sentAt: new Date(Date.now() - 1000 * 60 * 60 * 50),
    starred: true,
  },
];

const formatRelative = (d: Date) => {
  const diffMs = Date.now() - d.getTime();
  const m = Math.floor(diffMs / 60000);
  const h = Math.floor(m / 60);
  const days = Math.floor(h / 24);
  if (m < 1) return 'Ahora';
  if (m < 60) return `${m}m`;
  if (h < 24) return `${h}h`;
  return `${days}d`;
};

const formatDateFull = (d: Date) =>
  d.toLocaleString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

type Tab = 'compose' | 'sent' | 'signatures';

const createEmptySig = (): Signature => ({
  id: '',
  name: '',
  isDefault: false,
  fullName: '',
  position: '',
  company: '',
  phone: '',
  email: '',
  website: '',
  logoUrl: '',
  socialLinks: [],
  layout: 'classic',
  showSeparator: true,
  accentColor: '#6366f1',
  fontSize: 'medium',
  content: '',
});

const generateSigHtml = (sig: Signature): string => {
  const nameBlock = `<span style="font-size:${sig.fontSize === 'large' ? '16' : sig.fontSize === 'small' ? '12' : '14'}px;font-weight:700;color:#1e293b;">${sig.fullName || 'Tu Nombre'}</span>`;
  const posBlock = sig.position ? `<span style="font-size:12px;color:#64748b;">${sig.position}</span>` : '';
  const compBlock = sig.company ? `<span style="font-size:12px;color:#64748b;">${sig.company}</span>` : '';
  const sep = sig.showSeparator ? `<hr style="border:none;border-top:1px solid ${sig.accentColor}40;margin:6px 0;width:80px;text-align:left;" />` : '';
  const phoneBlock = sig.phone ? `<span style="font-size:11px;color:#94a3b8;">📞 ${sig.phone}</span>` : '';
  const emailBlock = sig.email ? `<span style="font-size:11px;color:#94a3b8;">✉️ ${sig.email}</span>` : '';
  const webBlock = sig.website ? `<span style="font-size:11px;color:#94a3b8;">🌐 ${sig.website}</span>` : '';
  const logoBlock = sig.logoUrl ? `<img src="${sig.logoUrl}" style="max-height:32px;max-width:100px;margin-bottom:4px;" />` : '';
  const socials = sig.socialLinks.map(s => `<a href="${s.url}" style="text-decoration:none;font-size:11px;color:${sig.accentColor};margin-right:4px;">[${s.platform}]</a>`).join('');

  switch (sig.layout) {
    case 'classic':
      return `<table cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:4px 0;">${logoBlock}${nameBlock}${sep}${posBlock ? '<br/>' + posBlock : ''}${compBlock ? '<br/>' + compBlock : ''}<br/>${phoneBlock}${emailBlock ? '<br/>' + emailBlock : ''}${socials ? '<br/>' + socials : ''}</td></tr></table>`;
    case 'modern':
      return `<table cellpadding="0" cellspacing="0" border="0"><tr><td style="vertical-align:middle;padding-right:10px;">${logoBlock || `<div style="width:36px;height:36px;border-radius:8px;background:${sig.accentColor};display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:16px;">${(sig.fullName || 'T')[0]}</div>`}</td><td style="vertical-align:middle;">${nameBlock}${posBlock ? '<br/>' + posBlock : ''}${compBlock ? '<br/>' + compBlock : ''}<br/><span style="font-size:11px;color:#94a3b8;">${phoneBlock}${emailBlock ? ' | ' + emailBlock : ''}${webBlock ? ' | ' + webBlock : ''}</span></td></tr></table>`;
    case 'compact':
      return `<span style="font-size:13px;font-weight:700;color:#1e293b;">${sig.fullName || 'Tu Nombre'}</span>${sig.position ? `<span style="font-size:11px;color:#64748b;margin:0 4px;">| ${sig.position}</span>` : ''}${sig.company ? `<span style="font-size:11px;color:#64748b;">| ${sig.company}</span>` : ''}<br/><span style="font-size:10px;color:#94a3b8;">${phoneBlock} ${emailBlock} ${webBlock}</span>`;
    case 'minimal':
      return `${nameBlock}${posBlock ? '<br/>' + posBlock : ''}`;
    default:
      return nameBlock;
  }
};

const generateSigText = (sig: Signature): string => {
  const parts: string[] = [];
  if (sig.fullName) parts.push(sig.fullName);
  if (sig.position) parts.push(sig.position);
  if (sig.company) parts.push(sig.company);
  if (sig.phone) parts.push(`Tel: ${sig.phone}`);
  if (sig.email) parts.push(sig.email);
  if (sig.website) parts.push(sig.website);
  if (sig.socialLinks.length) parts.push(sig.socialLinks.map(s => `${s.platform}: ${s.url}`).join(' | '));
  return parts.join('\n');
};

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'compose', label: 'Redactar', icon: PenSquare },
  { key: 'sent', label: 'Enviados', icon: Inbox },
  { key: 'signatures', label: 'Firmas', icon: FileSignature },
];

export const Email = () => {
  const { addNotification } = useNotifications();

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('compose');
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Compose state
  const [fromAddr, setFromAddr] = useState('ventas+fabpsandoval@gmail.com');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [attachedCatalog, setAttachedCatalog] = useState<string | null>(null);
  const [boldActive, setBoldActive] = useState(false);
  const [italicActive, setItalicActive] = useState(false);
  const [underlineActive, setUnderlineActive] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showSignaturePicker, setShowSignaturePicker] = useState(false);
  const [activeTemplateKey, setActiveTemplateKey] = useState<string | null>(null);

  // Sent list state
  const [sentEmails, setSentEmails] = useState<SentEmail[]>(MOCK_SENT);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<SentEmail | null>(null);

  // Signatures state
  const [signatures, setSignatures] = useState<Signature[]>([
    { id: '1', name: 'Principal', isDefault: true, fullName: 'Carlos Mendoza', position: 'Director Comercial', company: 'SparkBot', phone: '+52 55 1234 5678', email: 'carlos+fabpsandoval@gmail.com', website: 'sparkbot.io', logoUrl: '', socialLinks: [{ platform: 'linkedin', url: 'https://linkedin.com/in/carlos' }, { platform: 'twitter', url: 'https://twitter.com/carlos' }], layout: 'classic', showSeparator: true, accentColor: '#6366f1', fontSize: 'medium', content: 'Saludos cordiales,\nCarlos Mendoza\nDirector Comercial\nSparkBot' },
    { id: '2', name: 'Comercial', isDefault: false, fullName: 'Ana López', position: 'Asesor Comercial', company: 'SparkBot', phone: '+52 55 9876 5432', email: 'ana+fabpsandoval@gmail.com', website: 'sparkbot.io', logoUrl: '', socialLinks: [], layout: 'modern', showSeparator: true, accentColor: '#10b981', fontSize: 'medium', content: 'Quedo a tu disposición,\nAna López\nAsesor Comercial\nSparkBot' },
  ]);
  const [editingSig, setEditingSig] = useState<Signature | null>(null);
  const [sigForm, setSigForm] = useState<Signature>(() => createEmptySig());
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const filtered = useMemo(() =>
    sentEmails.filter(e =>
      !searchTerm ||
      e.to.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.subject.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime()),
    [sentEmails, searchTerm]
  );

  const canSend = to.trim() && subject.trim() && body.trim();

  const handleSend = async () => {
    if (bodyRef.current) setBody(bodyRef.current.innerText || '');
    if (!canSend) return;
    setIsSending(true);
    await new Promise(r => setTimeout(r, 900));
    const finalBody = (bodyRef.current?.innerText || body).trim();
    const newEmail: SentEmail = {
      id: Math.random().toString(36).slice(2),
      to: to.trim(),
      cc: cc.trim() || undefined,
      subject: subject.trim(),
      body: finalBody,
      sentAt: new Date(),
      starred: false,
    };
    setSentEmails(prev => [newEmail, ...prev]);
    addNotification({ type: 'success', title: '¡Correo enviado!', message: `Mensaje enviado a ${to.trim()}` });
    if (bodyRef.current) bodyRef.current.innerHTML = '';
    setTo(''); setCc(''); setBcc(''); setSubject(''); setBody('');
    setShowCc(false); setShowBcc(false);
    setActiveTemplateKey(null);
    setIsSending(false);
  };

  const handleClear = () => {
    if (!to && !subject && !body) return;
    setShowDiscardConfirm(true);
  };

  const confirmClear = () => {
    if (bodyRef.current) bodyRef.current.innerHTML = '';
    setTo(''); setCc(''); setBcc(''); setSubject(''); setBody('');
    setShowCc(false); setShowBcc(false);
    setActiveTemplateKey(null);
    setShowDiscardConfirm(false);
  };

  const toggleStar = (id: string) =>
    setSentEmails(prev => prev.map(e => e.id === id ? { ...e, starred: !e.starred } : e));

  const handleDelete = (id: string) => {
    setSentEmails(prev => prev.filter(e => e.id !== id));
    if (selectedEmail?.id === id) setSelectedEmail(null);
    addNotification({ type: 'success', title: 'Correo eliminado', message: 'El mensaje fue eliminado del historial.' });
  };

  const toggleFormat = useCallback((cmd: 'bold' | 'italic' | 'underline') => {
    document.execCommand(cmd);
    const isActive = document.queryCommandState(cmd);
    if (cmd === 'bold') setBoldActive(isActive);
    else if (cmd === 'italic') setItalicActive(isActive);
    else setUnderlineActive(isActive);
    if (bodyRef.current) bodyRef.current.focus();
  }, []);

  const syncFormatState = useCallback(() => {
    setBoldActive(document.queryCommandState('bold'));
    setItalicActive(document.queryCommandState('italic'));
    setUnderlineActive(document.queryCommandState('underline'));
  }, []);

  const handleBodyInput = useCallback(() => {
    if (bodyRef.current) setBody((bodyRef.current.innerText || '').trim());
  }, []);

  const templates: Record<string, string> = {
    welcome: 'Hola,\n\nGracias por contactarnos. Quedamos a tu disposición para cualquier consulta.\n\nSaludos cordiales,\nEquipo SparkBot',
    quote: 'Adjuntamos la cotización solicitada con los detalles de nuestros planes y servicios. Quedamos atentos a cualquier pregunta.\n\nSaludos,\nEquipo SparkBot',
    followup: 'Buen día,\n\nDamos seguimiento a nuestra conversación anterior. ¿Has tenido oportunidad de revisar la información?\n\nQuedamos atentos.\n\nSaludos,\nEquipo SparkBot',
  };

  const insertTemplate = (key: string) => {
    const newText = '\n\n' + templates[key] + '\n\n';
    if (bodyRef.current) {
      bodyRef.current.focus();
      document.execCommand('insertText', false, newText);
      handleBodyInput();
    } else {
      setBody(prev => prev + newText);
    }
    setActiveTemplateKey(key);
    setShowTemplatePicker(false);
  };

  const insertSignature = (sig: Signature) => {
    if (bodyRef.current) {
      bodyRef.current.focus();
      const html = generateSigHtml(sig);
      document.execCommand('insertHTML', false, '<br/>' + html + '<br/>');
      handleBodyInput();
    } else {
      setBody(prev => prev + '\n\n' + sig.content + '\n');
    }
    setShowSignaturePicker(false);
  };

  const openSigEditor = (sig?: Signature) => {
    if (sig) {
      setEditingSig(sig);
      setSigForm({ ...sig });
    } else {
      setEditingSig(null);
      setSigForm(createEmptySig());
    }
  };

  const updateSigForm = (key: keyof Signature, value: any) => {
    setSigForm(prev => {
      const updated = { ...prev, [key]: value };
      updated.content = generateSigText(updated);
      return updated;
    });
  };

  const addSocialLink = () => {
    setSigForm(prev => {
      const updated = { ...prev, socialLinks: [...prev.socialLinks, { platform: 'linkedin' as const, url: '' }] };
      updated.content = generateSigText(updated);
      return updated;
    });
  };

  const updateSocialLink = (i: number, key: 'platform' | 'url', value: string) => {
    setSigForm(prev => {
      const links = [...prev.socialLinks];
      links[i] = { ...links[i], [key]: value as any };
      const updated = { ...prev, socialLinks: links };
      updated.content = generateSigText(updated);
      return updated;
    });
  };

  const removeSocialLink = (i: number) => {
    setSigForm(prev => {
      const links = prev.socialLinks.filter((_, idx) => idx !== i);
      const updated = { ...prev, socialLinks: links };
      updated.content = generateSigText(updated);
      return updated;
    });
  };

  const saveSig = () => {
    if (!sigForm.name.trim()) return;
    const data: Signature = { ...sigForm, content: generateSigText(sigForm) };
    if (editingSig) {
      setSignatures(prev => prev.map(s => s.id === editingSig.id ? { ...data, id: s.id } : s));
    } else {
      setSignatures(prev => [...prev, { ...data, id: Math.random().toString(36).slice(2) }]);
    }
    setEditingSig(null);
    addNotification({ type: 'success', title: editingSig ? 'Firma actualizada' : 'Firma creada', message: `La firma "${data.name}" se ha guardado.` });
  };

  const deleteSig = (id: string) => {
    setSignatures(prev => prev.filter(s => s.id !== id));
    if (editingSig?.id === id) setEditingSig(null);
  };

  const setDefaultSig = (id: string) => {
    setSignatures(prev => prev.map(s => ({ ...s, isDefault: s.id === id })));
  };

  const sigPreviewHtml = useMemo(() => {
    if (!sigForm) return '';
    return generateSigHtml(sigForm);
  }, [sigForm]);

  return (
    <PageContainer>
      <PageHeader
        title="Correo"
        highlight="Electrónico"
        description="Redacta, envía y administra tu correo desde la plataforma."
        icon={Mail}
      />

      <PageBody>
        <div className="flex flex-col md:flex-row gap-5 h-auto md:h-[calc(100vh-200px)] min-h-[400px] md:min-h-[600px]">

          {/* ─── Sidebar ─── */}
          <div className={`${showMobileSidebar ? 'flex' : 'hidden'} md:flex w-full md:w-52 shrink-0 flex-col bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm`}>
            <div className="p-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Mail className="w-4 h-4 text-accent-500" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Opciones</span>
              </div>
            </div>
            <div className="flex-1 p-2 space-y-1">
              {TABS.map(tab => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button key={tab.key} onClick={() => { setActiveTab(tab.key); setSelectedEmail(null); setShowMobileSidebar(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${isActive
                      ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400 shadow-sm border border-accent-500/20'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                      }`}>
                    <TabIcon className="w-4 h-4" strokeWidth={isActive ? 2.5 : 1.5} />
                    {tab.label}
                    {tab.key === 'sent' && (
                      <span className="ml-auto px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black rounded-md">
                        {sentEmails.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── Content Area ─── */}
          <div className="flex-1 flex flex-col bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">

            {/* Mobile Tab Bar */}
            <div className="flex md:hidden items-center gap-1 px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 overflow-x-auto custom-scrollbar">
              {TABS.map(tab => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button key={tab.key} onClick={() => { setActiveTab(tab.key); setSelectedEmail(null); setShowMobileSidebar(false); }}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${isActive
                      ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400 border border-accent-500/20'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}>
                    <TabIcon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Compose */}
            {activeTab === 'compose' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-dark-card">
                  <div className="flex items-center gap-2.5">
                    <PenSquare className="w-4 h-4 text-accent-500" />
                    <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Nuevo Correo</h2>
                  </div>
                  <button onClick={handleClear}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Fields */}
                <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="flex items-center gap-3 px-5 py-2.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-8 shrink-0">De</span>
                    <select value={fromAddr} onChange={e => setFromAddr(e.target.value)}
                      className="flex-1 bg-transparent text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer">
                      <option value="ventas+fabpsandoval@gmail.com">ventas+fabpsandoval@gmail.com</option>
                      <option value="soporte+fabpsandoval@gmail.com">soporte+fabpsandoval@gmail.com</option>
                      <option value="no-reply+fabpsandoval@gmail.com">no-reply+fabpsandoval@gmail.com</option>
                    </select>
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-accent-500/10 text-accent-600 dark:text-accent-400 text-[8px] font-black uppercase tracking-widest rounded-md">
                      <User className="w-2.5 h-2.5" /> {fromAddr.includes('ventas') ? 'Ventas' : fromAddr.includes('soporte') ? 'Soporte' : 'Sistema'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 px-5 py-2.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-8 shrink-0">Para</span>
                    <input type="email" value={to} onChange={e => setTo(e.target.value)}
                      placeholder="destinatario@empresa.com"
                      className="flex-1 bg-transparent text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400/60 outline-none" />
                    <div className="flex items-center gap-1.5">
                      {!showCc && <button onClick={() => setShowCc(true)}
                        className="text-[9px] font-black text-slate-400 hover:text-accent-500 uppercase tracking-widest px-2 py-1 rounded-md hover:bg-accent-50 dark:hover:bg-accent-500/10 transition-all">CC</button>}
                      {!showBcc && <button onClick={() => setShowBcc(true)}
                        className="text-[9px] font-black text-slate-400 hover:text-accent-500 uppercase tracking-widest px-2 py-1 rounded-md hover:bg-accent-50 dark:hover:bg-accent-500/10 transition-all">CCO</button>}
                    </div>
                  </div>
                  {showCc && (
                    <div className="flex items-center gap-3 px-5 py-2.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-8 shrink-0">CC</span>
                      <input type="email" value={cc} onChange={e => setCc(e.target.value)}
                        placeholder="copia@empresa.com"
                        className="flex-1 bg-transparent text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400/60 outline-none" />
                      <button onClick={() => { setShowCc(false); setCc(''); }}
                        className="p-1 text-slate-300 hover:text-red-400 rounded transition-all"><X className="w-3 h-3" /></button>
                    </div>
                  )}
                  {showBcc && (
                    <div className="flex items-center gap-3 px-5 py-2.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-8 shrink-0">CCO</span>
                      <input type="email" value={bcc} onChange={e => setBcc(e.target.value)}
                        placeholder="oculto@empresa.com"
                        className="flex-1 bg-transparent text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400/60 outline-none" />
                      <button onClick={() => { setShowBcc(false); setBcc(''); }}
                        className="p-1 text-slate-300 hover:text-red-400 rounded transition-all"><X className="w-3 h-3" /></button>
                    </div>
                  )}
                  <div className="flex items-center gap-3 px-5 py-2.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-8 shrink-0">Asunto</span>
                    <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                      placeholder="Escribe el asunto del correo"
                      className="flex-1 bg-transparent text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400/60 outline-none" />
                  </div>
                </div>

                {/* Format toolbar */}
                <div className="flex items-center gap-1 px-4 py-2 border-y border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-white/[0.02] flex-wrap">
                  <button onClick={() => toggleFormat('bold')} title="Negrita"
                    className={`p-1.5 rounded-md transition-all ${boldActive ? 'bg-accent-500/15 text-accent-500 shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10'}`}><Bold className="w-3.5 h-3.5" /></button>
                  <button onClick={() => toggleFormat('italic')} title="Cursiva"
                    className={`p-1.5 rounded-md transition-all ${italicActive ? 'bg-accent-500/15 text-accent-500 shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10'}`}><Italic className="w-3.5 h-3.5" /></button>
                  <button onClick={() => toggleFormat('underline')} title="Subrayado"
                    className={`p-1.5 rounded-md transition-all ${underlineActive ? 'bg-accent-500/15 text-accent-500 shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10'}`}><Underline className="w-3.5 h-3.5" /></button>
                  <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
                  <button title="Insertar enlace"
                    className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-all"><Link className="w-3.5 h-3.5" /></button>
                  <button title="Adjuntar archivo"
                    className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-all"><Paperclip className="w-3.5 h-3.5" /></button>
                  <button title="Mencionar contacto"
                    className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-all"><AtSign className="w-3.5 h-3.5" /></button>
                  <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
                  <button onClick={() => setAttachedCatalog(attachedCatalog ? null : 'cat-1')}
                    className={`p-1.5 rounded-md transition-all ${attachedCatalog ? 'bg-accent-500/10 text-accent-500' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10'}`}
                    title={attachedCatalog ? 'Quitar catálogo' : 'Adjuntar catálogo'}>
                    <Package className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
                  <button onClick={() => setShowTemplatePicker(!showTemplatePicker)}
                    className={`p-1.5 rounded-md transition-all ${showTemplatePicker ? 'bg-accent-500/10 text-accent-500' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10'}`}
                    title="Insertar plantilla">
                    <BookTemplate className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setShowSignaturePicker(!showSignaturePicker)}
                    className={`p-1.5 rounded-md transition-all ${showSignaturePicker ? 'bg-accent-500/10 text-accent-500' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10'}`}
                    title="Insertar firma">
                    <FileSignature className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[9px] text-slate-400 ml-1 font-medium">| Selecciona texto y aplica formato</span>
                </div>

                {/* Catalog attachment bar */}
                {attachedCatalog && (
                  <div className="flex items-center gap-2 px-5 py-2 bg-accent-500/[0.03] border-b border-accent-500/10 dark:border-accent-500/20">
                    <Package className="w-3.5 h-3.5 text-accent-500" />
                    <span className="text-[10px] font-semibold text-accent-600 dark:text-accent-400 flex-1">
                      Catálogo adjunto: Productos SparkBot (12 artículos)
                    </span>
                    <button onClick={() => setAttachedCatalog(null)}
                      className="p-0.5 text-slate-400 hover:text-red-500 rounded transition-all">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Template picker (collapsible) */}
                {showTemplatePicker && (
                  <div className="flex items-center gap-2 px-5 py-2 border-b border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-white/[0.01]">
                    <BookTemplate className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Insertar plantilla:</span>
                    {Object.entries(templates).map(([key]) => (
                      <button key={key} onClick={() => insertTemplate(key)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${activeTemplateKey === key
                          ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-accent-100 dark:hover:bg-accent-500/10 hover:text-accent-600 dark:hover:text-accent-400'
                          }`}>
                        {key === 'welcome' ? 'Bienvenida' : key === 'quote' ? 'Cotización' : 'Seguimiento'}
                      </button>
                    ))}
                  </div>
                )}

                {/* Signature picker (collapsible) */}
                {showSignaturePicker && (
                  <div className="flex items-center gap-2 px-5 py-2 border-b border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-white/[0.01]">
                    <FileSignature className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Insertar firma:</span>
                    {signatures.map(sig => (
                      <button key={sig.id} onClick={() => insertSignature(sig)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${sig.isDefault
                          ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-accent-100 dark:hover:bg-accent-500/10 hover:text-accent-600 dark:hover:text-accent-400'
                          }`}>
                        {sig.name} {sig.isDefault ? '(Default)' : ''}
                      </button>
                    ))}
                  </div>
                )}

                {/* Body */}
                <div ref={bodyRef} contentEditable suppressContentEditableWarning
                  onInput={handleBodyInput} onMouseUp={syncFormatState} onKeyUp={syncFormatState}
                  data-placeholder="Escribe el contenido del correo aquí..."
                  className={`flex-1 px-5 py-4 bg-transparent text-sm text-slate-700 dark:text-slate-300 outline-none overflow-y-auto leading-relaxed whitespace-pre-wrap [&:empty:before]:content-[attr(data-placeholder)] [&:empty:before]:text-slate-400/60`} />

                {/* Send bar */}
                <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-gradient-to-r from-white to-slate-50 dark:from-dark-card dark:to-slate-900">
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                    {body.length > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        {body.length} caracteres
                      </span>
                    )}
                  </div>
                  <button onClick={handleSend} disabled={!canSend || isSending}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md ${canSend && !isSending
                      ? 'bg-gradient-to-r from-accent-500 to-accent-600 text-white hover:shadow-accent-500/30 hover:scale-105 active:scale-95'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                      }`}>
                    {isSending ? (
                      <><Loader size="xs" />Enviando...</>
                    ) : (
                      <><Send className="w-3.5 h-3.5" />Enviar</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Sent */}
            {activeTab === 'sent' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <Inbox className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Enviados</h3>
                    <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black rounded-md">
                      {sentEmails.length}
                    </span>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Buscar enviados..."
                      className="pl-8 pr-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:border-accent-500 transition-all w-48" />
                  </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                  <div className={`flex flex-col overflow-y-auto ${selectedEmail ? 'hidden md:flex w-72 shrink-0 border-r border-slate-100 dark:border-slate-800' : 'flex-1 md:flex-none md:w-72 md:shrink-0 md:border-r md:border-slate-100 dark:border-slate-800'}`}>
                    {filtered.length === 0 ? (
                      <div className="flex flex-col items-center justify-center flex-1 py-16 text-slate-400">
                        <Send className="w-10 h-10 mb-3 opacity-30" />
                        <p className="text-sm font-medium">No hay correos enviados</p>
                        <p className="text-xs mt-1">Los correos que envíes aparecerán aquí</p>
                      </div>
                    ) : (
                      filtered.map(email => (
                        <button key={email.id} onClick={() => setSelectedEmail(email)}
                          className={`w-full text-left flex items-start gap-3 px-4 py-3.5 border-b border-slate-50 dark:border-slate-800/50 transition-all hover:bg-slate-50 dark:hover:bg-white/5 ${selectedEmail?.id === email.id ? 'bg-accent-500/5 border-l-2 border-l-accent-500' : ''
                            }`}>
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center text-white text-[11px] font-black shrink-0 shadow-sm">
                            {email.to.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-xs font-bold text-slate-900 dark:text-white truncate flex-1">{email.to}</span>
                              <span className="text-[9px] text-slate-400 shrink-0 flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                {formatRelative(email.sentAt)}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{email.subject}</p>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{email.body.split('\n')[2] || email.body}</p>
                          </div>
                          <button onClick={e => { e.stopPropagation(); toggleStar(email.id); }}
                            className={`shrink-0 mt-0.5 transition-colors ${email.starred ? 'text-amber-400' : 'text-slate-200 dark:text-slate-700 hover:text-amber-400'}`}>
                            <Star className="w-3.5 h-3.5" fill={email.starred ? 'currentColor' : 'none'} />
                          </button>
                        </button>
                      ))
                    )}
                  </div>

                  {selectedEmail && (
                    <div className={`flex-1 flex flex-col overflow-hidden ${selectedEmail ? 'flex' : 'hidden md:flex'}`}>
                      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-white/[0.02]">
                        <button onClick={() => setSelectedEmail(null)}
                          className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 uppercase tracking-widest transition-all">
                          <ChevronRight className="w-3 h-3 rotate-180" />
                          Volver
                        </button>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => toggleStar(selectedEmail.id)}
                            className={`p-2 rounded-lg transition-all ${selectedEmail.starred ? 'text-amber-400 bg-amber-50 dark:bg-amber-500/10' : 'text-slate-400 hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10'}`}
                            title={selectedEmail.starred ? 'Quitar destacado' : 'Destacar'}>
                            <Star className={`w-4 h-4 ${selectedEmail.starred ? 'fill-current' : ''}`} />
                          </button>
                          <button onClick={() => { setTo(selectedEmail.to); setSubject(`Re: ${selectedEmail.subject}`); setBody(''); setActiveTab('compose'); }}
                            className="p-2 rounded-lg text-slate-400 hover:text-accent-500 hover:bg-accent-50 dark:hover:bg-accent-500/10 transition-all"
                            title="Responder">
                            <Plus className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(selectedEmail.id)}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                            title="Eliminar">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto p-6 md:p-8">
                        <div className="max-w-2xl mx-auto">
                          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white leading-snug mb-6">
                            {selectedEmail.subject}
                          </h2>
                          <div className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-700/50 mb-6">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center text-white font-black text-sm shadow-md shrink-0">
                              {selectedEmail.to.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">{selectedEmail.to}</h4>
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black rounded-md uppercase tracking-widest">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> Enviado
                                </span>
                              </div>
                              {selectedEmail.cc && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                                  <Users className="w-3 h-3" /> CC: {selectedEmail.cc}
                                </p>
                              )}
                              <p className="text-[11px] text-slate-400 mt-0.5">{formatDateFull(selectedEmail.sentAt)}</p>
                            </div>
                          </div>
                          <div className="text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                            {selectedEmail.body}
                          </div>
                        </div>
                      </div>

                      <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-white/[0.02]">
                        <button onClick={() => { setTo(selectedEmail.to); setSubject(`Re: ${selectedEmail.subject}`); setBody(''); setActiveTab('compose'); }}
                          className="w-full py-2.5 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:border-accent-500 hover:text-accent-500 hover:bg-accent-50 dark:hover:bg-accent-500/5 transition-all flex items-center justify-center gap-2">
                          <Plus className="w-3.5 h-3.5" />
                          Enviar nuevo correo a este destinatario
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Signatures */}
            {activeTab === 'signatures' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <FileSignature className="w-4 h-4 text-accent-500" />
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Firmas</h3>
                    <span className="px-2 py-0.5 bg-accent-500/10 text-accent-600 dark:text-accent-400 text-[9px] font-black rounded-md">{signatures.length}</span>
                  </div>
                  {!editingSig && (
                    <button onClick={() => openSigEditor()}
                      className="flex items-center gap-2 px-3 py-1.5 bg-transparent border-2 border-slate-900 dark:border-white text-emerald-600 dark:text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 hover:bg-slate-900 dark:hover:bg-white hover:text-emerald-400 dark:hover:text-emerald-500 active:scale-95">
                      <Plus className="w-3 h-3" /> Nueva
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-hidden">
                  {!editingSig ? (
                    <div className="h-full overflow-y-auto p-5">
                      <div className="max-w-2xl mx-auto space-y-4">
                        {signatures.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <FileSignature className="w-10 h-10 mb-3 opacity-30" />
                            <p className="text-sm font-medium">No hay firmas</p>
                            <p className="text-xs mt-1">Crea tu primera firma personalizada</p>
                          </div>
                        )}
                        {signatures.map(sig => (
                          <div key={sig.id} className={`p-5 rounded-2xl border transition-all ${sig.isDefault
                            ? 'bg-accent-500/5 border-accent-500/30 dark:border-accent-500/40 shadow-sm'
                            : 'bg-white dark:bg-slate-800/20 border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'
                            }`}>
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-sm shrink-0" style={{ background: sig.accentColor }}>
                                  {(sig.fullName || 'F')[0]}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{sig.name}</h4>
                                    {sig.isDefault && (
                                      <span className="px-1.5 py-0.5 bg-accent-500/10 text-accent-600 dark:text-accent-400 text-[8px] font-black rounded-md">Default</span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400 mt-0.5">{sig.fullName || 'Sin nombre'} · {sig.layout}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {!sig.isDefault && (
                                  <button onClick={() => setDefaultSig(sig.id)}
                                    className="text-[9px] font-black text-slate-400 hover:text-accent-500 px-2 py-1 rounded-md hover:bg-accent-50 dark:hover:bg-accent-500/10 transition-all">Default</button>
                                )}
                                <button onClick={() => openSigEditor(sig)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-accent-500 hover:bg-accent-50 dark:hover:bg-accent-500/10 transition-all">
                                  <PenSquare className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => deleteSig(sig.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <div className="p-4 bg-white dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-700/30"
                              dangerouslySetInnerHTML={{ __html: generateSigHtml(sig) }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* ─── Editor ─── */
                    <div className="h-full flex flex-col md:flex-row overflow-hidden">
                      {/* Left: Form */}
                      <div className="w-full md:w-[420px] shrink-0 overflow-y-auto border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-5 space-y-5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                            {editingSig ? 'Editar Firma' : 'Nueva Firma'}
                          </h4>
                          <button onClick={() => setEditingSig(null)}
                            className="text-[10px] font-black text-slate-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">Cancelar</button>
                        </div>

                        {/* Name */}
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Nombre interno</label>
                          <input type="text" value={sigForm.name} onChange={e => updateSigForm('name', e.target.value)}
                            placeholder="Ej: Principal, Comercial..."
                            className="w-full h-9 px-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-accent-500 transition-all placeholder:text-slate-400" />
                        </div>

                        {/* Personal info */}
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Información personal</label>
                          <div className="space-y-2">
                            <input type="text" value={sigForm.fullName} onChange={e => updateSigForm('fullName', e.target.value)} placeholder="Nombre completo"
                              className="w-full h-9 px-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-accent-500 transition-all placeholder:text-slate-400" />
                            <div className="flex gap-2">
                              <input type="text" value={sigForm.position} onChange={e => updateSigForm('position', e.target.value)} placeholder="Cargo"
                                className="flex-1 h-9 px-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-accent-500 transition-all placeholder:text-slate-400" />
                              <input type="text" value={sigForm.company} onChange={e => updateSigForm('company', e.target.value)} placeholder="Empresa"
                                className="flex-1 h-9 px-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-accent-500 transition-all placeholder:text-slate-400" />
                            </div>
                          </div>
                        </div>

                        {/* Contact */}
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Contacto</label>
                          <div className="space-y-2">
                            <input type="tel" value={sigForm.phone} onChange={e => updateSigForm('phone', e.target.value)} placeholder="+52 55 1234 5678"
                              className="w-full h-9 px-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-accent-500 transition-all placeholder:text-slate-400" />
                            <input type="email" value={sigForm.email} onChange={e => updateSigForm('email', e.target.value)} placeholder="email@empresa.com"
                              className="w-full h-9 px-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-accent-500 transition-all placeholder:text-slate-400" />
                            <input type="text" value={sigForm.website} onChange={e => updateSigForm('website', e.target.value)} placeholder="sparkbot.io"
                              className="w-full h-9 px-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-accent-500 transition-all placeholder:text-slate-400" />
                          </div>
                        </div>

                        {/* Logo */}
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Logo (URL)</label>
                          <input type="text" value={sigForm.logoUrl} onChange={e => updateSigForm('logoUrl', e.target.value)} placeholder="https://ejemplo.com/logo.png"
                            className="w-full h-9 px-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-accent-500 transition-all placeholder:text-slate-400" />
                        </div>

                        {/* Social links */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Redes sociales</label>
                            <button onClick={addSocialLink}
                              className="text-[9px] font-black text-accent-500 hover:text-accent-600 px-2 py-0.5 rounded-lg hover:bg-accent-50 dark:hover:bg-accent-500/10 transition-all">+ Añadir</button>
                          </div>
                          <div className="space-y-2">
                            {sigForm.socialLinks.map((link, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <select value={link.platform} onChange={e => updateSocialLink(i, 'platform', e.target.value)}
                                  className="h-9 px-2 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-700 dark:text-slate-300 outline-none focus:border-accent-500">
                                  <option value="linkedin">LinkedIn</option>
                                  <option value="twitter">Twitter / X</option>
                                  <option value="instagram">Instagram</option>
                                  <option value="facebook">Facebook</option>
                                  <option value="website">Web</option>
                                </select>
                                <input type="text" value={link.url} onChange={e => updateSocialLink(i, 'url', e.target.value)} placeholder="URL completa"
                                  className="flex-1 h-9 px-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-accent-500 transition-all placeholder:text-slate-400" />
                                <button onClick={() => removeSocialLink(i)}
                                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            {sigForm.socialLinks.length === 0 && (
                              <p className="text-[10px] text-slate-400 italic">Sin redes sociales agregadas</p>
                            )}
                          </div>
                        </div>

                        {/* Style */}
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Estilo</label>
                          <div className="space-y-3">
                            <div className="flex gap-2">
                              {(['classic', 'modern', 'compact', 'minimal'] as const).map(l => (
                                <button key={l} onClick={() => updateSigForm('layout', l)}
                                  className={`flex-1 h-9 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${sigForm.layout === l
                                    ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400 border-accent-500/30'
                                    : 'bg-white dark:bg-slate-800/50 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                    }`}>
                                  {l === 'classic' ? 'Clásico' : l === 'modern' ? 'Moderno' : l === 'compact' ? 'Compacto' : 'Minimal'}
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-3 items-center">
                              <div className="flex-1">
                                <label className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">Tamaño</label>
                                <div className="flex gap-1">
                                  {(['small', 'medium', 'large'] as const).map(f => (
                                    <button key={f} onClick={() => updateSigForm('fontSize', f)}
                                      className={`flex-1 h-8 rounded-lg text-[8px] font-bold uppercase tracking-widest border transition-all ${sigForm.fontSize === f
                                        ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400 border-accent-500/30'
                                        : 'bg-white dark:bg-slate-800/50 text-slate-500 border-slate-200 dark:border-slate-700'
                                        }`}>{f === 'small' ? 'Peq' : f === 'medium' ? 'Med' : 'Gde'}</button>
                                  ))}
                                </div>
                              </div>
                              <div className="w-20">
                                <label className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">Color</label>
                                <input type="color" value={sigForm.accentColor} onChange={e => updateSigForm('accentColor', e.target.value)}
                                  className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer bg-transparent p-0.5" />
                              </div>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={sigForm.showSeparator} onChange={e => updateSigForm('showSeparator', e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-slate-300 text-accent-500 focus:ring-accent-500" />
                              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">Mostrar línea separadora</span>
                            </label>
                          </div>
                        </div>

                        {/* Save */}
                        <button onClick={saveSig}
                          className="w-full h-10 bg-gradient-to-r from-accent-500 to-accent-600 text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-md transition-all">
                          {editingSig ? 'Guardar cambios' : 'Crear firma'}
                        </button>
                      </div>

                      {/* Right: Preview */}
                      <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-dark-card">
                        <div className="flex items-center gap-2 mb-5">
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vista previa</span>
                          <div className="flex-1" />
                          <span className="text-[8px] text-slate-300 dark:text-slate-600 font-mono">
                            {sigForm.layout} · {sigForm.fontSize} · {sigForm.accentColor}
                          </span>
                        </div>
                        <div className="max-w-md mx-auto bg-white dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm p-6">
                          <div className="min-h-[100px]"
                            dangerouslySetInnerHTML={{ __html: sigPreviewHtml }} />
                        </div>
                        <div className="max-w-md mx-auto mt-4">
                          <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Vista texto plano</h5>
                          <pre className="text-[10px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-700/30 p-4 whitespace-pre-wrap">{generateSigText(sigForm) || 'Sin contenido'}</pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </PageBody>

      <ConfirmDialog
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={confirmClear}
        title="Descartar correo"
        message="¿Descartar el correo en redacción? Esta acción no se puede deshacer."
        confirmText="Descartar"
        variant="warning"
      />
    </PageContainer>
  );
};
