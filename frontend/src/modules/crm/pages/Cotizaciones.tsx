import { useState, useMemo, useEffect } from 'react';
import { Plus, FileText, Eye, Trash2, Send, Download, Copy, Edit3, X, Percent, Calendar, DollarSign, ClipboardList, ShoppingCart, History } from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { HeaderButton } from '../../../components/ui/HeaderButton';
import { PageContainer } from '../../../components/layout/PageContainer';
import { PageBody } from '../../../components/layout/PageBody';
import { DataTable, Column } from '../../../components/ui/DataTable';
import { SearchBar } from '../../../components/ui/SearchBar';
import { Dropdown } from '../../../components/ui/Dropdown';
import { ViewToggle, ViewMode } from '../../../components/ui/ViewToggle';
import { TableCard } from '../../../components/ui/TableCard';
import { KebabMenu } from '../../../components/ui/KebabMenu';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Modal } from '../../../components/ui/Modal';
import { CountBadge } from '../../../components/ui/CountBadge';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Loader } from '../../../components/ui/Loader';
import { useNotifications } from '../../../contexts/NotificationContext';
import { getQuotes, createQuote, updateQuote, deleteQuote, createOrder } from '../../../services/api';

interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface HistoryEntry {
  date: string;
  action: string;
  user: string;
}

interface Quote {
  id: string;
  number: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  date: string;
  expiryDate: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  items: QuoteItem[];
  taxRate: number;
  discount: number;
  notes: string;
  createdBy: string;
  history: HistoryEntry[];
}

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const calcSubtotal = (items: QuoteItem[]) => items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
const calcTax = (sub: number, rate: number) => sub * (rate / 100);
const calcTotal = (sub: number, tax: number, disc: number) => sub + tax - disc;

let nextItemId = 100;
const emptyItem = (): QuoteItem => ({ id: String(nextItemId++), description: '', quantity: 1, unitPrice: 0 });
const emptyItems = (): QuoteItem[] => [emptyItem()];

const today = () => new Date().toISOString().split('T')[0];
const future = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().split('T')[0]; };
const nextNumber = (quotes: Quote[]) => `COT-${new Date().getFullYear()}-${String(quotes.length + 1).padStart(3, '0')}`;

const initialQuotes: Quote[] = [
  { id: '1', number: 'COT-2026-001', clientName: 'Tech Solutions SRL', clientEmail: 'contacto@techsolutions.com', clientPhone: '+54 11 5555-0101', date: '2026-07-01', expiryDate: '2026-07-31', status: 'sent', items: [{ id: '1', description: 'Consultoría inicial', quantity: 1, unitPrice: 500 }, { id: '2', description: 'Desarrollo Web', quantity: 1, unitPrice: 1500 }, { id: '3', description: 'Hosting 1 año', quantity: 1, unitPrice: 300 }], taxRate: 21, discount: 0, notes: '', createdBy: 'Admin', history: [{ date: '2026-07-01', action: 'Creada', user: 'Admin' }, { date: '2026-07-02', action: 'Enviada al cliente', user: 'Admin' }] },
  { id: '2', number: 'COT-2026-002', clientName: 'Digital Agency MX', clientEmail: 'info@digitalagency.mx', clientPhone: '+52 55 1234-5678', date: '2026-07-05', expiryDate: '2026-08-05', status: 'draft', items: [{ id: '4', description: 'Campaña Google Ads', quantity: 2, unitPrice: 800 }, { id: '5', description: 'Diseño Gráfico', quantity: 1, unitPrice: 400 }], taxRate: 16, discount: 100, notes: 'Pendiente de revisión por el cliente.', createdBy: 'Admin', history: [{ date: '2026-07-05', action: 'Creada', user: 'Admin' }] },
  { id: '3', number: 'COT-2026-003', clientName: 'Global Trade Corp', clientEmail: 'ops@globaltrade.com', clientPhone: '+1 305 555-0202', date: '2026-07-10', expiryDate: '2026-08-10', status: 'accepted', items: [{ id: '6', description: 'Software ERP', quantity: 1, unitPrice: 4000 }, { id: '7', description: 'Capacitación', quantity: 3, unitPrice: 500 }], taxRate: 21, discount: 275, notes: 'Aprobado con 5% descuento comercial.', createdBy: 'Admin', history: [{ date: '2026-07-10', action: 'Creada', user: 'Admin' }, { date: '2026-07-11', action: 'Enviada al cliente', user: 'Admin' }, { date: '2026-07-15', action: 'Aceptada por el cliente', user: 'Admin' }] },
  { id: '4', number: 'COT-2026-004', clientName: 'InnovaSoft', clientEmail: 'ventas@innovasoft.com', clientPhone: '+56 2 2999-3030', date: '2026-07-12', expiryDate: '2026-08-12', status: 'rejected', items: [{ id: '8', description: 'App Mobile', quantity: 1, unitPrice: 3500 }], taxRate: 21, discount: 0, notes: 'Cliente eligió otro proveedor.', createdBy: 'Admin', history: [{ date: '2026-07-12', action: 'Creada', user: 'Admin' }, { date: '2026-07-13', action: 'Enviada al cliente', user: 'Admin' }, { date: '2026-07-20', action: 'Rechazada por el cliente', user: 'Admin' }] },
  { id: '5', number: 'COT-2026-005', clientName: 'Comercial Andina', clientEmail: 'admin@comercialandina.com', clientPhone: '+57 1 555-4040', date: '2026-07-15', expiryDate: '2026-08-15', status: 'expired', items: [{ id: '9', description: 'Consultoría Logística', quantity: 2, unitPrice: 1200 }, { id: '10', description: 'Software Tracking', quantity: 1, unitPrice: 1800 }], taxRate: 21, discount: 0, notes: '', createdBy: 'Admin', history: [{ date: '2026-07-15', action: 'Creada', user: 'Admin' }, { date: '2026-07-16', action: 'Enviada al cliente', user: 'Admin' }, { date: '2026-08-16', action: 'Vencida automáticamente', user: 'Sistema' }] },
  { id: '6', number: 'COT-2026-006', clientName: 'DataCloud Services', clientEmail: 'hello@datacloud.io', clientPhone: '+1 415 555-0505', date: '2026-07-18', expiryDate: '2026-08-18', status: 'sent', items: [{ id: '11', description: 'Infraestructura Cloud', quantity: 1, unitPrice: 5000 }, { id: '12', description: 'Soporte Premium (12 meses)', quantity: 1, unitPrice: 2400 }], taxRate: 21, discount: 500, notes: 'Descuento por fidelidad.', createdBy: 'Admin', history: [{ date: '2026-07-18', action: 'Creada', user: 'Admin' }, { date: '2026-07-19', action: 'Enviada al cliente', user: 'Admin' }] },
  { id: '7', number: 'COT-2026-007', clientName: 'Distribuidora Norte', clientEmail: 'compras@distrinorte.com', clientPhone: '+54 341 555-6060', date: '2026-07-20', expiryDate: '2026-08-20', status: 'draft', items: [{ id: '13', description: 'Web Corporativa', quantity: 1, unitPrice: 2200 }, { id: '14', description: 'Mantenimiento Mensual', quantity: 6, unitPrice: 150 }], taxRate: 21, discount: 0, notes: '', createdBy: 'Vendedor', history: [{ date: '2026-07-20', action: 'Creada', user: 'Vendedor' }] },
  { id: '8', number: 'COT-2026-008', clientName: 'EcoSolutions', clientEmail: 'info@ecosolutions.org', clientPhone: '+55 11 9999-7070', date: '2026-07-25', expiryDate: '2026-08-25', status: 'accepted', items: [{ id: '15', description: 'Plataforma Sustentable', quantity: 1, unitPrice: 6000 }], taxRate: 21, discount: 300, notes: '', createdBy: 'Admin', history: [{ date: '2026-07-25', action: 'Creada', user: 'Admin' }, { date: '2026-07-26', action: 'Enviada al cliente', user: 'Admin' }, { date: '2026-07-28', action: 'Aceptada por el cliente', user: 'Admin' }] },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'draft', label: 'Borrador' },
  { value: 'sent', label: 'Enviado' },
  { value: 'accepted', label: 'Aceptado' },
  { value: 'rejected', label: 'Rechazado' },
  { value: 'expired', label: 'Vencido' },
];

const mapQuote = (row: any): Quote => ({
  id: row.id,
  number: row.number,
  clientName: row.client_name,
  clientEmail: row.client_email || '',
  clientPhone: row.client_phone || '',
  date: row.quote_date,
  expiryDate: row.expiry_date,
  status: row.status,
  items: (row.quote_items || []).map((i: any) => ({
    id: i.id,
    description: i.description,
    quantity: Number(i.quantity || 0),
    unitPrice: Number(i.unit_price || 0),
  })),
  taxRate: Number(row.tax_rate || 0),
  discount: Number(row.discount || 0),
  notes: row.notes || '',
  createdBy: row.created_by || 'Admin',
  history: row.history || [],
});

export const Cotizaciones = () => {
  const { addNotification } = useNotifications();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<Quote | null>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Quote | null>(null);

  const [formClientName, setFormClientName] = useState('');
  const [formClientEmail, setFormClientEmail] = useState('');
  const [formClientPhone, setFormClientPhone] = useState('');
  const [formExpiryDate, setFormExpiryDate] = useState(future(30));
  const [formItems, setFormItems] = useState<QuoteItem[]>(emptyItems());
  const [formTaxRate, setFormTaxRate] = useState(21);
  const [formDiscount, setFormDiscount] = useState(0);
  const [formNotes, setFormNotes] = useState('');

  const formSubtotal = useMemo(() => calcSubtotal(formItems), [formItems]);
  const formTax = useMemo(() => calcTax(formSubtotal, formTaxRate), [formSubtotal, formTaxRate]);
  const formTotal = useMemo(() => calcTotal(formSubtotal, formTax, formDiscount), [formSubtotal, formTax, formDiscount]);

  const itemsPerPage = 8;

  const totals = useMemo(() => {
    const totalAmount = quotes.reduce((s, q) => s + calcTotal(calcSubtotal(q.items), calcTax(calcSubtotal(q.items), q.taxRate), q.discount), 0);
    return {
      totalAmount,
      draftCount: quotes.filter(q => q.status === 'draft').length,
      sentCount: quotes.filter(q => q.status === 'sent').length,
      acceptedCount: quotes.filter(q => q.status === 'accepted').length,
      expiredCount: quotes.filter(q => q.status === 'expired').length,
    };
  }, [quotes]);

  const filtered = useMemo(() => {
    let result = quotes.filter(q =>
      q.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.clientEmail.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filterStatus !== 'all') result = result.filter(q => q.status === filterStatus);
    return result;
  }, [quotes, searchTerm, filterStatus]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const addHistory = (_quote: Quote, action: string): HistoryEntry => ({ date: today(), action, user: 'Admin' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getQuotes();
        if (!cancelled) setQuotes((Array.isArray(rows) ? rows : []).map(mapQuote));
      } catch (err) {
        console.error('Failed to load quotes:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setQuotes(prev => prev.filter(q => q.id !== target.id));
    setConfirmDelete(null);
    try {
      await deleteQuote(target.id);
      addNotification({ type: 'warning', title: 'Cotización eliminada', message: `Cotización ${target.number} eliminada` });
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo eliminar la cotización.' });
    }
  };

  const handleSend = async (quote: Quote) => {
    try {
      const updated = await updateQuote(quote.id, {
        status: 'sent',
        history: [...quote.history, addHistory(quote, 'Enviada al cliente')],
      });
      setQuotes(prev => prev.map(q => q.id === quote.id ? mapQuote(updated) : q));
      addNotification({ type: 'success', title: 'Cotización enviada', message: `Cotización ${quote.number} enviada al cliente` });
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo enviar la cotización.' });
    }
  };

  const handleMarkAccepted = async (quote: Quote) => {
    try {
      const updated = await updateQuote(quote.id, {
        status: 'accepted',
        history: [...quote.history, addHistory(quote, 'Aceptada por el cliente')],
      });
      setQuotes(prev => prev.map(q => q.id === quote.id ? mapQuote(updated) : q));
      addNotification({ type: 'success', title: 'Cotización aceptada', message: `Cotización ${quote.number} marcada como aceptada` });
      setShowDetailModal(null);
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo actualizar la cotización.' });
    }
  };

  const handleMarkRejected = async (quote: Quote) => {
    try {
      const updated = await updateQuote(quote.id, {
        status: 'rejected',
        history: [...quote.history, addHistory(quote, 'Rechazada por el cliente')],
      });
      setQuotes(prev => prev.map(q => q.id === quote.id ? mapQuote(updated) : q));
      addNotification({ type: 'warning', title: 'Cotización rechazada', message: `Cotización ${quote.number} marcada como rechazada` });
      setShowDetailModal(null);
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo actualizar la cotización.' });
    }
  };

  const handleDuplicate = async (quote: Quote) => {
    try {
      const newNumber = nextNumber(quotes);
      const created = await createQuote({
        number: newNumber,
        clientName: quote.clientName,
        clientEmail: quote.clientEmail,
        clientPhone: quote.clientPhone,
        date: today(),
        expiryDate: quote.expiryDate,
        status: 'draft',
        items: quote.items.map(i => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
        taxRate: quote.taxRate,
        discount: quote.discount,
        notes: quote.notes,
        createdBy: 'Admin',
        history: [{ date: today(), action: 'Duplicada desde ' + quote.number, user: 'Admin' }],
      });
      setQuotes(prev => [mapQuote(created), ...prev]);
      addNotification({ type: 'success', title: 'Cotización duplicada', message: `Cotización duplicada como ${newNumber}` });
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo duplicar la cotización.' });
    }
  };

  const handleConvertToOrder = async (quote: Quote) => {
    try {
      const sub = calcSubtotal(quote.items);
      const total = calcTotal(sub, calcTax(sub, quote.taxRate), quote.discount);
      const created = await createOrder({
        customer: quote.clientName,
        items: quote.items.length,
        total,
        status: 'pending',
        date: today(),
        channel: 'WhatsApp',
      });
      addNotification({ type: 'success', title: 'Pedido creado', message: `Pedido ${created.id} creado desde ${quote.number}` });
      setShowDetailModal(null);
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo crear el pedido.' });
    }
  };

  const openCreate = () => {
    setEditingQuote(null);
    setFormClientName(''); setFormClientEmail(''); setFormClientPhone('');
    setFormExpiryDate(future(30)); setFormItems(emptyItems());
    setFormTaxRate(21); setFormDiscount(0); setFormNotes('');
    setShowCreateModal(true);
  };

  const openEdit = (quote: Quote) => {
    setEditingQuote(quote);
    setFormClientName(quote.clientName); setFormClientEmail(quote.clientEmail); setFormClientPhone(quote.clientPhone);
    setFormExpiryDate(quote.expiryDate); setFormItems(quote.items.map(i => ({ ...i })));
    setFormTaxRate(quote.taxRate); setFormDiscount(quote.discount); setFormNotes(quote.notes);
    setShowCreateModal(true);
  };

  const handleSave = async () => {
    if (!formClientName.trim()) { addNotification({ type: 'warning', title: 'Campo requerido', message: 'El nombre del cliente es obligatorio' }); return; }
    if (formItems.length === 0 || formItems.every(i => !i.description.trim())) { addNotification({ type: 'warning', title: 'Items vacíos', message: 'Agrega al menos un item válido' }); return; }
    try {
      if (editingQuote) {
        const updated = await updateQuote(editingQuote.id, {
          clientName: formClientName,
          clientEmail: formClientEmail,
          clientPhone: formClientPhone,
          expiryDate: formExpiryDate,
          items: formItems.map(i => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
          taxRate: formTaxRate,
          discount: formDiscount,
          notes: formNotes,
          history: [...editingQuote.history, addHistory(editingQuote, 'Editada')],
        });
        setQuotes(prev => prev.map(q => q.id === editingQuote.id ? mapQuote(updated) : q));
        addNotification({ type: 'success', title: 'Cotización actualizada', message: `Cotización ${editingQuote.number} actualizada correctamente` });
      } else {
        const newNumber = nextNumber(quotes);
        const created = await createQuote({
          number: newNumber,
          clientName: formClientName,
          clientEmail: formClientEmail,
          clientPhone: formClientPhone,
          date: today(),
          expiryDate: formExpiryDate,
          status: 'draft',
          items: formItems.map(i => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
          taxRate: formTaxRate,
          discount: formDiscount,
          notes: formNotes,
          createdBy: 'Admin',
          history: [{ date: today(), action: 'Creada', user: 'Admin' }],
        });
        setQuotes(prev => [mapQuote(created), ...prev]);
        addNotification({ type: 'success', title: 'Cotización creada', message: `Cotización ${newNumber} creada correctamente` });
      }
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo guardar la cotización.' });
    }
    setShowCreateModal(false); setEditingQuote(null);
  };

  const updateItem = (id: string, field: keyof QuoteItem, value: string | number) => {
    setFormItems(prev => prev.map(i => i.id === id ? { ...i, [field]: field === 'description' ? String(value) : Math.max(0, Number(value) || 0) } : i));
  };

  const removeItem = (id: string) => {
    setFormItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev);
  };

  const addItem = () => {
    setFormItems(prev => [...prev, emptyItem()]);
  };

  const columns: Column<Quote>[] = [
    { key: 'number', header: 'N° Cotización' },
    { key: 'clientName', header: 'Cliente' },
    { key: 'date', header: 'Fecha', render: (_, row) => new Date(row.date).toLocaleDateString() },
    { key: 'expiryDate', header: 'Vence', render: (_, row) => {
      const remaining = Math.ceil((new Date(row.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return <span className={remaining < 0 ? 'text-red-500 font-semibold' : remaining < 7 ? 'text-amber-500' : ''}>{new Date(row.expiryDate).toLocaleDateString()}</span>;
    }},
    { key: 'total', header: 'Total', render: (_, row) => {
      const sub = calcSubtotal(row.items); const t = calcTotal(sub, calcTax(sub, row.taxRate), row.discount);
      return <span className="font-semibold text-slate-900 dark:text-white">${fmt(t)}</span>;
    }},
    { key: 'items', header: 'Items', render: (_, row) => <span className="text-slate-500">{row.items.length}</span> },
    { key: 'status', header: 'Estado', render: (_, row) => <StatusBadge status={row.status} size="sm" /> },
    {
      key: 'id', header: '', className: 'w-12',
      render: (_, row) => (
        <KebabMenu actions={[
          { label: 'Ver detalle', icon: <Eye className="w-3.5 h-3.5" />, onClick: () => setShowDetailModal(row) },
          { label: 'Editar', icon: <Edit3 className="w-3.5 h-3.5" />, onClick: () => openEdit(row) },
          ...(row.status === 'draft' ? [{ label: 'Enviar', icon: <Send className="w-3.5 h-3.5" />, onClick: () => handleSend(row) }] : []),
          { label: 'Duplicar', icon: <Copy className="w-3.5 h-3.5" />, onClick: () => handleDuplicate(row) },
          { label: 'Descargar PDF', icon: <Download className="w-3.5 h-3.5" />, onClick: () => {} },
          { label: 'Eliminar', icon: <Trash2 className="w-3.5 h-3.5" />, onClick: () => setConfirmDelete(row), variant: 'danger' as const },
        ]} />
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader title="Cotizaciones" description="Gestiona tus presupuestos y cotizaciones" icon={FileText} action={
        <div className="flex items-center gap-3">
          <CountBadge count={quotes.length} />
          <HeaderButton onClick={openCreate} icon={<Plus className="w-4 h-4" />}>
            Nueva Cotización
          </HeaderButton>
        </div>
      } />

      <PageBody>
        {loading && (
          <div className="mb-4 text-xs text-slate-400 flex items-center gap-2"><Loader size="xs" /> Cargando cotizaciones...</div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          {[
            { label: 'Total Cotizado', value: `$${fmt(totals.totalAmount)}`, icon: DollarSign, color: 'text-accent-500', bg: 'bg-accent-500/10' },
            { label: 'Borrador', value: totals.draftCount, icon: FileText, color: 'text-slate-500', bg: 'bg-slate-500/10' },
            { label: 'Enviadas', value: totals.sentCount, icon: Send, color: 'text-sky-500', bg: 'bg-sky-500/10' },
            { label: 'Aceptadas', value: totals.acceptedCount, icon: ClipboardList, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            { label: 'Vencidas', value: totals.expiredCount, icon: Calendar, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-white/5 rounded-xl border border-slate-100 dark:border-slate-800/50 shadow-sm">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center ${color}`}><Icon className="w-4 h-4" /></div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
                <p className="text-sm font-black text-slate-900 dark:text-white truncate">{typeof value === 'string' ? value : value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <SearchBar value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} placeholder="Buscar por número, cliente o email..." />
          <div className="flex items-center gap-2 shrink-0">
            <Dropdown value={filterStatus} onChange={(v) => { setFilterStatus(v); setCurrentPage(1); }} options={STATUS_OPTIONS.map(o => ({ value: o.value, label: o.label }))} />
            <ViewToggle value={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginated.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-400">
                <FileText className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm font-semibold">No hay cotizaciones</p>
                <p className="text-xs mt-1">Crea una nueva cotización para empezar</p>
              </div>
            ) : paginated.map((q) => {
              const sub = calcSubtotal(q.items); const total = calcTotal(sub, calcTax(sub, q.taxRate), q.discount);
              return (
                <div key={q.id} className="group bg-white dark:bg-white/5 rounded-2xl p-5 border border-slate-100 dark:border-slate-800/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2.5 bg-accent-500/10 rounded-xl text-accent-500"><FileText className="w-5 h-5" /></div>
                    <StatusBadge status={q.status} size="sm" dot />
                  </div>
                  <h3 className="font-black text-slate-900 dark:text-white text-sm mb-1">{q.clientName}</h3>
                  <p className="text-[10px] text-slate-400 font-mono mb-2">{q.number}</p>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-slate-500">{q.items.length} items</span>
                    <span className="text-sm font-black text-accent-500">${fmt(total)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/50">
                    <span className="text-[10px] text-slate-400">Vence: {new Date(q.expiryDate).toLocaleDateString()}</span>
                    <div className="flex gap-1">
                      <button onClick={() => setShowDetailModal(q)} className="p-1.5 rounded-lg text-slate-400 hover:text-accent-500 hover:bg-accent-500/10 transition-all"><Eye className="w-3 h-3" /></button>
                      {q.status === 'draft' && <button onClick={() => handleSend(q)} className="p-1.5 rounded-lg text-slate-400 hover:text-accent-500 hover:bg-accent-500/10 transition-all"><Send className="w-3 h-3" /></button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <TableCard>
            <DataTable data={paginated} columns={columns} emptyMessage="No se encontraron cotizaciones"
              pagination={{ currentPage, totalPages: totalPages || 1, onPageChange: setCurrentPage }} />
          </TableCard>
        )}
      </PageBody>

      {/* Create / Edit Modal */}
      <Modal open={showCreateModal} onClose={() => { setShowCreateModal(false); setEditingQuote(null); }}
        title={editingQuote ? `Editar ${editingQuote.number}` : 'Nueva Cotización'}
        subtitle={editingQuote ? 'Modifica los datos del presupuesto' : 'Completa los datos del presupuesto'}
        icon={<FileText className="w-5 h-5 text-accent-500" />} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cliente *</p>
              <input value={formClientName} onChange={e => setFormClientName(e.target.value)} placeholder="Nombre del cliente" className="w-full px-3 py-2.5 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all text-sm text-slate-900 dark:text-white placeholder-slate-400/60" />
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Email</p>
              <input value={formClientEmail} onChange={e => setFormClientEmail(e.target.value)} placeholder="cliente@email.com" className="w-full px-3 py-2.5 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all text-sm text-slate-900 dark:text-white placeholder-slate-400/60" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Teléfono</p>
              <input value={formClientPhone} onChange={e => setFormClientPhone(e.target.value)} placeholder="+54 11 5555-0101" className="w-full px-3 py-2.5 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all text-sm text-slate-900 dark:text-white placeholder-slate-400/60" />
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Válido hasta</p>
              <input type="date" value={formExpiryDate} onChange={e => setFormExpiryDate(e.target.value)} className="w-full px-3 py-2.5 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all text-sm text-slate-900 dark:text-white" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Items</p>
              <button onClick={addItem} className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold text-accent-500 hover:bg-accent-500/10 rounded-lg transition-all"><Plus className="w-3 h-3" /> Agregar</button>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {formItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <input value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} placeholder="Descripción" className="flex-1 min-w-0 px-3 py-2 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all text-xs text-slate-900 dark:text-white placeholder-slate-400/60" />
                  <input type="number" value={item.quantity || ''} onChange={e => updateItem(item.id, 'quantity', e.target.value)} placeholder="Cant" className="w-16 px-2 py-2 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all text-xs text-slate-900 dark:text-white text-center" />
                  <input type="number" value={item.unitPrice || ''} onChange={e => updateItem(item.id, 'unitPrice', e.target.value)} placeholder="P.U." className="w-24 px-2 py-2 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all text-xs text-slate-900 dark:text-white text-right" />
                  <span className="text-xs font-semibold text-slate-500 w-20 text-right">${fmt(item.quantity * item.unitPrice)}</span>
                  <button onClick={() => removeItem(item.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all shrink-0"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">IVA (%)</p>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="number" value={formTaxRate || ''} onChange={e => setFormTaxRate(Number(e.target.value) || 0)} className="w-full pl-9 pr-3 py-2.5 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all text-sm text-slate-900 dark:text-white" />
              </div>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Descuento ($)</p>
              <input type="number" value={formDiscount || ''} onChange={e => setFormDiscount(Number(e.target.value) || 0)} className="w-full px-3 py-2.5 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all text-sm text-slate-900 dark:text-white" />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700/50 space-y-0.5">
            <div className="flex justify-between text-xs"><span className="text-slate-500">Subtotal</span><span className="font-semibold text-slate-700 dark:text-slate-300">${fmt(formSubtotal)}</span></div>
            {formDiscount > 0 && <div className="flex justify-between text-xs"><span className="text-slate-500">Descuento</span><span className="font-semibold text-red-500">-${fmt(formDiscount)}</span></div>}
            <div className="flex justify-between text-xs"><span className="text-slate-500">IVA ({formTaxRate}%)</span><span className="font-semibold text-slate-700 dark:text-slate-300">${fmt(formTax)}</span></div>
            <div className="flex justify-between text-sm pt-1.5 border-t border-slate-200 dark:border-slate-700"><span className="font-bold text-slate-900 dark:text-white">Total</span><span className="font-black text-accent-500">${fmt(formTotal)}</span></div>
          </div>

          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Notas</p>
            <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} placeholder="Condiciones, observaciones..." className="w-full px-3 py-2.5 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all text-xs text-slate-900 dark:text-white placeholder-slate-400/60 resize-none" />
          </div>

          <button onClick={handleSave} className="w-full py-3 bg-gradient-to-r from-accent-500 to-accent-600 text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:opacity-90 transition-all shadow-md">
            {editingQuote ? 'Guardar Cambios' : 'Crear Cotización'}
          </button>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!showDetailModal} onClose={() => setShowDetailModal(null)}
        title={showDetailModal?.number || ''} subtitle={showDetailModal?.clientName || ''}
        icon={<FileText className="w-5 h-5 text-accent-500" />} size="lg">
        {showDetailModal && (() => {
          const sub = calcSubtotal(showDetailModal.items);
          const tax = calcTax(sub, showDetailModal.taxRate);
          const total = calcTotal(sub, tax, showDetailModal.discount);
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cliente</p>
                  <p className="font-semibold text-slate-900 dark:text-white">{showDetailModal.clientName}</p>
                  <p className="text-slate-500 text-xs">{showDetailModal.clientEmail}</p>
                  <p className="text-slate-500 text-xs">{showDetailModal.clientPhone}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado</p>
                  <StatusBadge status={showDetailModal.status} size="md" dot />
                  <p className="text-[10px] text-slate-400 mt-2">Creado por: {showDetailModal.createdBy}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha</p>
                  <p className="text-slate-700 dark:text-slate-300">{new Date(showDetailModal.date).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Válido hasta</p>
                  <p className="text-slate-700 dark:text-slate-300">{new Date(showDetailModal.expiryDate).toLocaleDateString()}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Items</p>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-x-auto">
                  <table className="w-full min-w-[400px] text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                      <tr><th className="px-3 py-2">Descripción</th><th className="px-3 py-2 text-center">Cant</th><th className="px-3 py-2 text-right">P. Unit</th><th className="px-3 py-2 text-right">Total</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {showDetailModal.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-300 font-medium">{item.description}</td>
                          <td className="px-3 py-2 text-center text-slate-500">{item.quantity}</td>
                          <td className="px-3 py-2 text-right text-slate-500">${fmt(item.unitPrice)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-900 dark:text-white">${fmt(item.quantity * item.unitPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {showDetailModal.notes && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Notas</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-white/5 rounded-xl p-3">{showDetailModal.notes}</p>
                </div>
              )}

              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-1">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span className="font-semibold text-slate-700 dark:text-slate-300">${fmt(sub)}</span></div>
                {showDetailModal.discount > 0 && <div className="flex justify-between text-sm"><span className="text-slate-500">Descuento</span><span className="font-semibold text-red-500">-${fmt(showDetailModal.discount)}</span></div>}
                <div className="flex justify-between text-sm"><span className="text-slate-500">IVA ({showDetailModal.taxRate}%)</span><span className="font-semibold text-slate-700 dark:text-slate-300">${fmt(tax)}</span></div>
                <div className="flex justify-between text-base pt-2 border-t border-slate-200 dark:border-slate-700"><span className="font-bold text-slate-900 dark:text-white">Total</span><span className="font-black text-accent-500 text-lg">${fmt(total)}</span></div>
              </div>

              {showDetailModal.history.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><History className="w-3 h-3" /> Historial</p>
                  <div className="space-y-1">
                    {showDetailModal.history.map((h, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-2 h-2 rounded-full bg-accent-500/50 shrink-0" />
                        <span className="text-slate-400 w-20 shrink-0">{new Date(h.date).toLocaleDateString()}</span>
                        <span className="text-slate-600 dark:text-slate-400">{h.action}</span>
                        <span className="text-slate-400 ml-auto">{h.user}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {showDetailModal.status === 'draft' && (
                  <button onClick={() => { handleSend(showDetailModal); setShowDetailModal(null); }} className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-accent-500 to-accent-600 text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:opacity-90 transition-all shadow-md"><Send className="w-3 h-3" /> Enviar</button>
                )}
                {showDetailModal.status === 'sent' && (
                  <>
                    <button onClick={() => handleMarkAccepted(showDetailModal)} className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:opacity-90 transition-all shadow-md"><ClipboardList className="w-3 h-3" /> Aceptar</button>
                    <button onClick={() => handleMarkRejected(showDetailModal)} className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:opacity-90 transition-all shadow-md"><X className="w-3 h-3" /> Rechazar</button>
                  </>
                )}
                {showDetailModal.status === 'accepted' && (
                  <button onClick={() => handleConvertToOrder(showDetailModal)} className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-accent-500 to-accent-600 text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:opacity-90 transition-all shadow-md"><ShoppingCart className="w-3 h-3" /> Convertir a Pedido</button>
                )}
                <button onClick={() => handleDuplicate(showDetailModal)} className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 dark:hover:bg-white/20 transition-all"><Copy className="w-3 h-3" /> Duplicar</button>
                <button onClick={() => {}} className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 dark:hover:bg-white/20 transition-all"><Download className="w-3 h-3" /> PDF</button>
                <button onClick={() => setShowDetailModal(null)} className="px-4 py-2.5 bg-slate-100 dark:bg-white/5 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all">Cerrar</button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={handleDelete}
        title="Eliminar Cotización" message={`¿Estás seguro de eliminar ${confirmDelete?.number}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar" cancelText="Cancelar" variant="danger" />
    </PageContainer>
  );
};
