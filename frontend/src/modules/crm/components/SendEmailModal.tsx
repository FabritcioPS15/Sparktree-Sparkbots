import { useState } from 'react';
import { Mail, Send, Plus, Trash2, Tag, FileText, User } from 'lucide-react';
import { Loader } from '../../../components/ui/Loader';
import { Modal } from '../../../components/ui/Modal';

interface SendEmailModalProps {
  open: boolean;
  onClose: () => void;
  catalog?: any;
}

type EmailType = 'catalog' | 'quote';

interface Recipient {
  id: string;
  email: string;
}

export const SendEmailModal = ({ open, onClose, catalog }: SendEmailModalProps) => {
  const [emailType, setEmailType] = useState<EmailType>('catalog');
  const [recipients, setRecipients] = useState<Recipient[]>([{ id: '1', email: '' }]);
  const [subject, setSubject] = useState(
    catalog ? `Catálogo: ${catalog.name}` : ''
  );
  const [message, setMessage] = useState(
    catalog
      ? `Estimado cliente,\n\nAdjunto encontrará nuestro catálogo "${catalog.name}".\n\n${catalog.description ? catalog.description + '\n\n' : ''}Quedamos a su disposición para cualquier consulta.\n\nSaludos cordiales.`
      : ''
  );
  const [quoteDiscount, setQuoteDiscount] = useState('');
  const [quoteValidDays, setQuoteValidDays] = useState('15');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const addRecipient = () =>
    setRecipients(prev => [...prev, { id: Date.now().toString(), email: '' }]);

  const removeRecipient = (id: string) =>
    setRecipients(prev => prev.filter(r => r.id !== id));

  const updateRecipient = (id: string, email: string) =>
    setRecipients(prev => prev.map(r => (r.id === id ? { ...r, email } : r)));

  const validRecipients = recipients.filter(r => r.email.includes('@'));

  const buildMailtoLink = () => {
    const to = validRecipients.map(r => r.email).join(',');
    const sub = encodeURIComponent(subject);
    let body = message;

    if (emailType === 'quote' && catalog?.items?.length) {
      body += '\n\n--- COTIZACIÓN ---\n';
      catalog.items.forEach((item: any, idx: number) => {
        const price = parseFloat(item.price) || 0;
        const discountPct = parseFloat(quoteDiscount) || 0;
        const final = price * (1 - discountPct / 100);
        body += `\n${idx + 1}. ${item.title || 'Sin nombre'}`;
        if (item.price) body += ` — $${price.toFixed(2)}`;
        if (discountPct > 0) body += ` (${discountPct}% dto. → $${final.toFixed(2)})`;
        if (item.description) body += `\n   ${item.description}`;
      });
      body += `\n\nValidez: ${quoteValidDays} días`;
    }

    return `mailto:${to}?subject=${sub}&body=${encodeURIComponent(body)}`;
  };

  const handleSend = async () => {
    if (validRecipients.length === 0 || !subject.trim()) return;
    setSending(true);
    await new Promise(r => setTimeout(r, 600));
    window.location.href = buildMailtoLink();
    setSending(false);
    setSent(true);
    setTimeout(() => {
      setSent(false);
      onClose();
    }, 1500);
  };

  const handleClose = () => {
    setSent(false);
    onClose();
  };

  const tabBase =
    'flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-widest transition-all border-b-2';
  const tabActive = 'border-accent-500 text-accent-500';
  const tabInactive =
    'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300';

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Enviar por correo"
      subtitle={catalog ? `Catálogo: ${catalog.name}` : undefined}
      icon={<Mail className="w-5 h-5 text-accent-500" />}
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            {validRecipients.length > 0
              ? `${validRecipients.length} destinatario${validRecipients.length > 1 ? 's' : ''}`
              : 'Sin destinatarios válidos'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSend}
              disabled={sending || validRecipients.length === 0 || !subject.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-accent-500 hover:bg-accent-600 text-black rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sent ? (
                '✓ Abierto'
              ) : sending ? (
                <>
                  <Loader size="xs" />
                  Preparando...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Enviar
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      {/* TYPE TABS */}
      <div className="flex border-b border-slate-100 dark:border-slate-800 -mt-1 mb-5">
        <button
          onClick={() => setEmailType('catalog')}
          className={`${tabBase} ${emailType === 'catalog' ? tabActive : tabInactive}`}
        >
          <FileText className="w-3.5 h-3.5" />
          Catálogo
        </button>
        <button
          onClick={() => setEmailType('quote')}
          className={`${tabBase} ${emailType === 'quote' ? tabActive : tabInactive}`}
        >
          <Tag className="w-3.5 h-3.5" />
          Cotización
        </button>
      </div>

      <div className="space-y-5">
        {/* RECIPIENTS */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] flex items-center gap-1.5">
              <User className="w-3 h-3" />
              Destinatarios
            </label>
            <button
              onClick={addRecipient}
              className="text-[10px] font-black text-accent-500 hover:text-accent-600 uppercase tracking-widest flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Agregar
            </button>
          </div>
          <div className="space-y-2">
            {recipients.map((r, idx) => (
              <div key={r.id} className="flex items-center gap-2">
                <input
                  type="email"
                  value={r.email}
                  onChange={e => updateRecipient(r.id, e.target.value)}
                  placeholder={`correo${idx + 1}@ejemplo.com`}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-accent-500 transition-colors"
                />
                {recipients.length > 1 && (
                  <button
                    onClick={() => removeRecipient(r.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* SUBJECT */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2">
            Asunto
          </label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Asunto del correo..."
            className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-accent-500 transition-colors"
          />
        </div>

        {/* QUOTE EXTRA OPTIONS */}
        {emailType === 'quote' && (
          <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-accent-500/5 border border-accent-500/20">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2">
                Descuento (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={quoteDiscount}
                onChange={e => setQuoteDiscount(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg text-sm font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-accent-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2">
                Validez (días)
              </label>
              <input
                type="number"
                min="1"
                value={quoteValidDays}
                onChange={e => setQuoteValidDays(e.target.value)}
                placeholder="15"
                className="w-full px-3 py-2 rounded-lg text-sm font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-accent-500 transition-colors"
              />
            </div>
          </div>
        )}

        {/* ITEMS PREVIEW (quote) */}
        {emailType === 'quote' && catalog?.items?.length > 0 && (
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2">
              Items incluidos ({catalog.items.length})
            </label>
            <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
              {catalog.items.map((item: any, idx: number) => {
                const price = parseFloat(item.price) || 0;
                const disc = parseFloat(quoteDiscount) || 0;
                const final = disc > 0 ? price * (1 - disc / 100) : null;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs"
                  >
                    <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[60%]">
                      {idx + 1}. {item.title || 'Sin nombre'}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.price && (
                        <>
                          {final !== null ? (
                            <>
                              <span className="line-through text-slate-400">${price.toFixed(2)}</span>
                              <span className="font-black text-green-600">${final.toFixed(2)}</span>
                            </>
                          ) : (
                            <span className="font-bold text-slate-600 dark:text-slate-400">${price.toFixed(2)}</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MESSAGE */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2">
            Mensaje
          </label>
          <textarea
            rows={5}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Escribe el cuerpo del correo..."
            className="w-full px-4 py-3 rounded-xl text-sm font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-accent-500 transition-colors resize-none custom-scrollbar"
          />
          <p className="text-[10px] text-slate-400 mt-1.5">
            💡 Se abrirá tu cliente de correo con el mensaje prellenado.
          </p>
        </div>
      </div>
    </Modal>
  );
};
