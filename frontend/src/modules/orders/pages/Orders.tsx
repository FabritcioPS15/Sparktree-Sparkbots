import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, ShoppingCart } from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { HeaderButton } from '../../../components/ui/HeaderButton';
import { CountBadge } from '../../../components/ui/CountBadge';
import { PageContainer } from '../../../components/layout/PageContainer';
import { PageBody } from '../../../components/layout/PageBody';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Dropdown } from '../../../components/ui/Dropdown';
import { SearchBar } from '../../../components/ui/SearchBar';
import { ViewToggle, ViewMode } from '../../../components/ui/ViewToggle';
import { Modal } from '../../../components/ui/Modal';
import { KebabMenu } from '../../../components/ui/KebabMenu';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Loader } from '../../../components/ui/Loader';
import { useNotifications } from '../../../contexts/NotificationContext';
import { getOrders, createOrder, deleteOrder } from '../../../services/api';

interface Order {
  id: string; customer: string; items: number; total: number;
  status: 'pending' | 'paid' | 'sent' | 'delivered' | 'cancelled';
  date: string; channel: string;
}

const mockOrders: Order[] = [
  { id: 'ORD-001', customer: 'Juan Pérez', items: 3, total: 150.00, status: 'pending', date: '2024-01-15', channel: 'WhatsApp' },
  { id: 'ORD-002', customer: 'María García', items: 1, total: 75.00, status: 'paid', date: '2024-01-14', channel: 'Instagram' },
  { id: 'ORD-003', customer: 'Carlos López', items: 5, total: 320.00, status: 'sent', date: '2024-01-13', channel: 'WhatsApp' },
  { id: 'ORD-004', customer: 'Ana Martínez', items: 2, total: 120.00, status: 'delivered', date: '2024-01-12', channel: 'Messenger' },
  { id: 'ORD-005', customer: 'Pedro Sánchez', items: 4, total: 280.00, status: 'cancelled', date: '2024-01-11', channel: 'Telegram' },
];

const CHANNELS = ['WhatsApp', 'Instagram', 'Messenger', 'Telegram', 'TikTok'];

const todayStr = () => new Date().toISOString().split('T')[0];

const mapOrder = (row: any): Order => ({
  id: row.id,
  customer: row.customer,
  items: Number(row.items || 0),
  total: Number(row.total || 0),
  status: row.status,
  date: row.order_date || '',
  channel: row.channel || 'WhatsApp',
});

export const Orders = () => {
  const { addNotification } = useNotifications();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterChannel, setFilterChannel] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getOrders();
        if (!cancelled) setOrders((Array.isArray(rows) ? rows : []).map(mapOrder));
      } catch (err) {
        console.error('Failed to load orders:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleCreate = async (customer: string, _product: string, amount: string) => {
    try {
      const created = await createOrder({
        customer,
        items: 1,
        total: Number(amount) || 0,
        status: 'pending',
        date: todayStr(),
        channel: 'WhatsApp',
      });
      setOrders(prev => [mapOrder(created), ...prev]);
      addNotification({ type: 'success', title: 'Pedido creado', message: `Se ha creado el pedido para ${customer}` });
      setShowCreateModal(false);
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo crear el pedido.' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const order = deleteTarget;
    setDeleteTarget(null);
    setOrders(prev => prev.filter(o => o.id !== order.id));
    try {
      await deleteOrder(order.id);
      addNotification({ type: 'success', title: 'Pedido eliminado', message: `Se ha eliminado el pedido de ${order.customer}` });
    } catch (err) {
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo eliminar el pedido.' });
    }
  };

  const columns = [
    { key: 'id', header: 'Orden ID' },
    { key: 'customer', header: 'Cliente' },
    { key: 'items', header: 'Items' },
    { key: 'total', header: 'Total', render: (v: number) => `$${v.toFixed(2)}` },
    { key: 'status', header: 'Estado', render: (v: string) => <StatusBadge status={v} /> },
    { key: 'date', header: 'Fecha' },
    { key: 'channel', header: 'Canal' },
    { key: 'actions', header: '', className: 'w-12', render: (_v: unknown, row: Order) => (
      <KebabMenu actions={[
        { label: 'Ver detalle', icon: <Edit className="w-3.5 h-3.5" />, onClick: () => {} },
        { label: 'Eliminar', icon: <Trash2 className="w-3.5 h-3.5" />, onClick: () => { setDeleteTarget(row); }, variant: 'danger' },
      ]} />
    )},
  ];

  const filtered = orders.filter(o =>
    (o.customer.toLowerCase().includes(searchTerm.toLowerCase()) || o.id.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filterChannel === 'all' || o.channel === filterChannel) &&
    (filterStatus === 'all' || o.status === filterStatus)
  );

  return (
    <PageContainer>
      <PageHeader
        title="Pedidos"
        description="Gestiona las órdenes generadas desde el catálogo"
        icon={ShoppingCart}
        action={
          <div className="flex items-center gap-3">
            <CountBadge count={orders.length} />
            <HeaderButton onClick={() => setShowCreateModal(true)} icon={<Plus className="w-4 h-4" />}>
              Nuevo Pedido
            </HeaderButton>
          </div>
        }
      />
      <PageBody>
        {loading && (
          <div className="mb-4 text-xs text-slate-400 flex items-center gap-2"><Loader size="xs" /> Cargando pedidos...</div>
        )}
        <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden p-6">
          <div className="flex items-center gap-3 mb-4">
            <SearchBar value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} placeholder="Buscar por cliente o ID..." className="flex-1" />
            <Dropdown value={filterStatus} onChange={(v) => { setFilterStatus(v); setCurrentPage(1); }} options={[
              { value: 'all', label: 'Todos los estados' },
              { value: 'pending', label: 'Pendiente' },
              { value: 'paid', label: 'Pagado' },
              { value: 'sent', label: 'Enviado' },
              { value: 'delivered', label: 'Entregado' },
              { value: 'cancelled', label: 'Cancelado' },
            ]} />
            <Dropdown value={filterChannel} onChange={(v) => { setFilterChannel(v); setCurrentPage(1); }} options={[
              { value: 'all', label: 'Todos los canales' },
              ...CHANNELS.map(c => ({ value: c, label: c })),
            ]} />
            <ViewToggle value={viewMode} onChange={setViewMode} />
          </div>

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((order) => (
                <div key={order.id} className="group bg-slate-50 dark:bg-black/30 rounded-2xl p-5 border border-slate-100 dark:border-slate-800/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2.5 bg-accent-500/10 rounded-xl text-accent-500"><ShoppingCart className="w-5 h-5" /></div>
                    <StatusBadge status={order.status} />
                  </div>
                  <h3 className="font-black text-slate-900 dark:text-white text-sm mb-1">{order.customer}</h3>
                  <p className="text-[10px] text-slate-400 font-mono mb-2">{order.id}</p>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-slate-500">{order.items} items · {order.channel}</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">${order.total.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">{order.date}</span>
                    <button className="p-1.5 rounded-lg text-slate-400 hover:text-accent-500 hover:bg-accent-500/10 transition-all"><Edit className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleteTarget(order)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <DataTable data={filtered} columns={columns}
              pagination={{ currentPage, totalPages: Math.ceil(filtered.length / 10) || 1, onPageChange: setCurrentPage }}
            />
          )}
        </div>
      </PageBody>

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nuevo Pedido"
        icon={<ShoppingCart className="w-5 h-5 text-accent-500" />}
      >
        <form onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; const name = (form.elements.namedItem('name') as HTMLInputElement).value; const product = (form.elements.namedItem('product') as HTMLInputElement).value; const amount = (form.elements.namedItem('amount') as HTMLInputElement).value; handleCreate(name, product, amount); }} className="space-y-4">
          <input type="text" name="name" placeholder="Nombre del cliente" required className="w-full px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all font-bold text-sm text-slate-900 dark:text-white placeholder-slate-400/60" />
          <input type="text" name="product" placeholder="Producto" required className="w-full px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all font-bold text-sm text-slate-900 dark:text-white placeholder-slate-400/60" />
          <input type="number" name="amount" placeholder="Monto" required className="w-full px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all font-bold text-sm text-slate-900 dark:text-white placeholder-slate-400/60" />
          <button type="submit" className="w-full py-3.5 bg-gradient-to-r from-accent-500 to-accent-600 text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:from-accent-600 hover:to-accent-700 transition-all shadow-md">Crear Pedido</button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar pedido"
        message={`¿Eliminar el pedido de ${deleteTarget?.customer || ''}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
      />
    </PageContainer>
  );
};
