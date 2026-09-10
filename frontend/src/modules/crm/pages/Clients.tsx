import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { MessageSquare, UserCheck, Cpu, Eye, Trash2, UserPlus, User, MoreVertical, UserX } from 'lucide-react';
import { Loader } from '../../../components/ui/Loader';
import { FaWhatsapp, FaTelegram, FaInstagram, FaFacebookMessenger } from 'react-icons/fa';
import { SiTiktok } from 'react-icons/si';
import { Mail } from 'lucide-react';
import { getContacts, deleteUser, deleteUsersBulk, createCrmClient, updateCrmClient, getSystemUsers, assignAgentToConversation } from '../../../services/api';
import { formatPhoneNumber } from '../../../utils/phone';
import { PageHeader } from '../../../components/layout/PageHeader';
import { HeaderButton } from '../../../components/ui/HeaderButton';
import { PageContainer } from '../../../components/layout/PageContainer';
import { PageBody } from '../../../components/layout/PageBody';
import { PageLoader } from '../../../components/layout/PageLoader';
import { ResponsiveList, ResponsiveColumn } from '../../../components/ui/ResponsiveList';
import { SearchBar } from '../../../components/ui/SearchBar';
import { Dropdown } from '../../../components/ui/Dropdown';
import { ViewToggle, ViewMode } from '../../../components/ui/ViewToggle';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { TableCard } from '../../../components/ui/TableCard';
import { useNotifications } from '../../../contexts/NotificationContext';

type SortField = 'phoneNumber' | 'firstInteraction' | 'lastInteraction' | 'totalMessages' | 'attendedBy' | 'usageTime';
type SortOrder = 'asc' | 'desc';

// Dropdown de 3 Puntos para las acciones del cliente
const ClientActionsDropdown = ({
  onViewChat,
  onAssignAgent,
  onEdit,
  onDelete,
}: {
  onViewChat: () => void;
  onAssignAgent: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.right - 180 });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, updatePos]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        !(e.target instanceof Element && e.target.closest('[data-actions-panel]'))
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          updatePos();
          setOpen(!open);
        }}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
        title="Más opciones"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && createPortal(
        <div
          data-actions-panel
          style={{ position: 'fixed', top: pos.top, left: Math.max(10, pos.left), zIndex: 9999 }}
          className="w-48 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl shadow-black/20 py-1.5 animate-in fade-in duration-100 space-y-0.5"
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); onViewChat(); }}
            className="w-full px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors flex items-center gap-2"
          >
            <Eye className="w-3.5 h-3.5 text-accent-500" />
            <span>Ver Chat</span>
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); onAssignAgent(); }}
            className="w-full px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors flex items-center gap-2"
          >
            <UserCheck className="w-3.5 h-3.5 text-blue-500" />
            <span>Asignar Agente</span>
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit(); }}
            className="w-full px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors flex items-center gap-2"
          >
            <User className="w-3.5 h-3.5 text-emerald-500" />
            <span>Editar Cliente</span>
          </button>

          <div className="my-1 border-t border-slate-100 dark:border-slate-700/40" />

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(); }}
            className="w-full px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Eliminar Cliente</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};

export const Clients = () => {
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField] = useState<SortField>('lastInteraction');
  const [sortOrder] = useState<SortOrder>('desc');
  const [users, setUsers] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filterChannel, setFilterChannel] = useState('all');
  const [filterAgent] = useState('all');
  const [filterState, setFilterState] = useState('all');
  const [systemAgents, setSystemAgents] = useState<any[]>([]);

  // Modales
  const [confirmDelete, setConfirmDelete] = useState<{ id: string } | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  // Modal de Asignar Agente
  const [assignModalUser, setAssignModalUser] = useState<any>(null);
  const [selectedAgentForAssign, setSelectedAgentForAssign] = useState('');
  const [assigningAgent, setAssigningAgent] = useState(false);

  const itemsPerPage = 8;

  useEffect(() => {
    fetchClients();
    fetchAgents();
  }, []);

  const fetchClients = () => {
    setLoading(true);
    getContacts()
      .then(data => {
        const usersArray = Array.isArray(data) ? data : [];
        console.log('Datos de contactos recibidos:', usersArray);
        setUsers(usersArray);
      })
      .catch(err => {
        console.error('Failed to fetch contacts', err);
        setUsers([]);
      })
      .finally(() => setLoading(false));
  };

  const fetchAgents = () => {
    getSystemUsers()
      .then(agents => setSystemAgents(agents || []))
      .catch(err => console.error('Error fetching system agents:', err));
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteUser(confirmDelete.id);
      setUsers(prev => prev.filter(u => u.id !== confirmDelete.id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(confirmDelete.id);
        return next;
      });
      addNotification({ type: 'success', title: 'Cliente eliminado', message: 'El cliente ha sido eliminado exitosamente.' });
    } catch (err) {
      console.error('Error deleting user:', err);
      addNotification({ type: 'error', title: 'Error', message: 'No se pudo eliminar el cliente. Vuelve a intentarlo.' });
    } finally {
      setConfirmDelete(null);
    }
  };

  const handleBulkDelete = async () => {
    try {
      await deleteUsersBulk(Array.from(selectedIds));
      setUsers(prev => prev.filter(u => !selectedIds.has(u.id)));
      setSelectedIds(new Set());
      addNotification({ type: 'success', title: 'Eliminación masiva', message: 'Los clientes seleccionados han sido eliminados.' });
    } catch (err) {
      console.error('Error deleting users bulk:', err);
      addNotification({ type: 'error', title: 'Error', message: 'Error al eliminar masivamente. Algunos clientes podrían no haberse borrado.' });
    } finally {
      setConfirmBulkDelete(false);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const phone = (form.elements.namedItem('phone') as HTMLInputElement).value.trim();
    const name = (form.elements.namedItem('name') as HTMLInputElement).value.trim() || 'Sin nombre';
    const email = (form.elements.namedItem('email') as HTMLInputElement)?.value.trim() || '';

    if (!phone) return;

    setCreating(true);
    try {
      if (editingUser) {
        await updateCrmClient(editingUser.id, { name, email, phone, company: '', status: editingUser.status || 'lead', source: 'manual', notes: '' });
        addNotification({ type: 'success', title: 'Cliente actualizado', message: `Se ha actualizado ${name}` });
      } else {
        await createCrmClient({ name, email, phone, company: '', status: 'lead', source: 'manual', notes: '' });
        addNotification({ type: 'success', title: 'Cliente creado', message: `Se ha creado ${name}` });
      }
      setShowCreateModal(false);
      setEditingUser(null);
      fetchClients();
    } catch (err: any) {
      console.error('Error saving client:', err);
      addNotification({ type: 'error', title: 'Error', message: err.response?.data?.error || 'No se pudo guardar el cliente.' });
    } finally {
      setCreating(false);
    }
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setShowCreateModal(true);
  };

  const handleAssignAgent = async () => {
    if (!assignModalUser || !selectedAgentForAssign) return;
    const conversationId = assignModalUser.conversation_id || assignModalUser.id;
    setAssigningAgent(true);
    try {
      await assignAgentToConversation(conversationId, selectedAgentForAssign);
      const agent = systemAgents.find(a => a.id === selectedAgentForAssign);
      addNotification({
        type: 'success',
        title: 'Agente asignado',
        message: `Se asignó el agente ${agent?.name || ''} al cliente.`
      });
      setAssignModalUser(null);
      fetchClients();
    } catch (err: any) {
      console.error('Error assigning agent:', err);
      addNotification({
        type: 'error',
        title: 'Error',
        message: err.response?.data?.error || 'No se pudo asignar el agente.'
      });
    } finally {
      setAssigningAgent(false);
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const detectChannel = (user: any) => {
    let channel = null;

    if (user.platform_type) channel = user.platform_type;
    if (!channel && user.channels && Object.keys(user.channels).length > 0) channel = Object.keys(user.channels)[0];
    if (!channel && user.channel) channel = user.channel;
    if (!channel && user.source) channel = user.source;
    if (!channel && user.platform) channel = user.platform;
    if (!channel && user.lastChannel) channel = user.lastChannel;
    if (!channel && user.conversationChannel) channel = user.conversationChannel;
    if (!channel && user.origin) channel = user.origin;

    if (!channel) return '';

    const normalizedChannel = String(channel).toLowerCase().trim();
    const channelMapping: Record<string, string> = {
      'whatsapp': 'whatsapp',
      'wa': 'whatsapp',
      'wsp': 'whatsapp',
      'instagram': 'instagram',
      'ig': 'instagram',
      'tiktok': 'tiktok',
      'telegram': 'telegram',
      'tg': 'telegram',
      'messenger': 'messenger',
      'facebook_messenger': 'messenger',
      'fb': 'messenger',
      'facebook': 'messenger',
      'email': 'email',
      'mail': 'email',
      'correo': 'email'
    };
    return channelMapping[normalizedChannel] || normalizedChannel;
  };

  const filteredUsers = (users || []).filter(user => {
    const term = (searchTerm || '').trim().toLowerCase();
    const matchesSearch = !term ||
      (user.phone_number && String(user.phone_number).toLowerCase().includes(term)) ||
      (user.profile_name && String(user.profile_name).toLowerCase().includes(term)) ||
      (user.assigned_agent?.name && String(user.assigned_agent.name).toLowerCase().includes(term));

    const matchesChannel = filterChannel === 'all' || detectChannel(user) === filterChannel;

    let matchesAgent = true;
    if (filterAgent === 'unassigned') {
      matchesAgent = !user.assigned_to && !user.assigned_agent;
    } else if (filterAgent !== 'all') {
      matchesAgent = user.assigned_to === filterAgent || user.assigned_agent?.id === filterAgent;
    }

    let matchesState = true;
    if (filterState === 'human') {
      matchesState = user.bot_state === 'handoff';
    } else if (filterState === 'bot') {
      matchesState = user.bot_state !== 'handoff';
    }

    return Boolean(matchesSearch && matchesChannel && matchesAgent && matchesState);
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const aValue = a[sortField] || '';
    const bValue = b[sortField] || '';
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }
    return sortOrder === 'asc' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number);
  });

  const totalPages = Math.ceil(sortedUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = sortedUsers.slice(startIndex, startIndex + itemsPerPage);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Sin fecha';
    return new Date(dateString).toLocaleDateString('es-ES', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getChannelColor = (channel: string) => {
    const channelLower = channel.toLowerCase();
    switch (channelLower) {
      case 'whatsapp':
      case 'whatsapp_cloud':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'instagram':
        return 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20';
      case 'tiktok':
        return 'bg-slate-900/10 text-slate-800 dark:text-slate-200 border-slate-900/20';
      case 'telegram':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'messenger':
        return 'bg-blue-600/10 text-blue-700 dark:text-blue-300 border-blue-600/20';
      case 'email':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const getChannelIcon = (channel: string) => {
    const channelLower = channel?.toLowerCase() || '';
    switch (channelLower) {
      case 'whatsapp':
      case 'whatsapp_cloud':
        return <FaWhatsapp className="w-3.5 h-3.5" />;
      case 'instagram':
        return <FaInstagram className="w-3.5 h-3.5" />;
      case 'tiktok':
        return <SiTiktok className="w-3.5 h-3.5" />;
      case 'telegram':
        return <FaTelegram className="w-3.5 h-3.5" />;
      case 'messenger':
        return <FaFacebookMessenger className="w-3.5 h-3.5" />;
      case 'email':
        return <Mail className="w-3.5 h-3.5" />;
      default:
        return <MessageSquare className="w-3.5 h-3.5" />;
    }
  };

  // formatPhoneNumber imported from utils/phone

  if (loading) return <PageLoader sectionName="Directorio" />;

  const responsiveColumns: ResponsiveColumn<any>[] = [
    {
      key: 'phoneNumber',
      header: 'Teléfono',
      mobilePriority: 'high',
      render: (_: any, user: any) => {
        let realPhone = user.phone_number;
        if (!realPhone || realPhone.length > 15) {
          if (user.custom_attributes) {
            const attrs = user.custom_attributes;
            realPhone = attrs.real_phone_number || attrs.whatsapp_jid || attrs.whatsapp_number || attrs.phone || attrs.phoneNumber;
          }
        }
        if (!realPhone) realPhone = user.phone_number;

        const { prefix, number } = formatPhoneNumber(realPhone);
        const displayNumber = number || realPhone;

        return (
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                {prefix && <span className="font-bold text-accent-500 text-sm">{prefix}</span>}
                <span className="font-bold text-slate-900 dark:text-white text-base">{displayNumber}</span>
              </div>
              <span className="text-xs text-accent-500 flex items-center gap-1 mt-1 font-medium">
                <MessageSquare className="w-3 h-3" /> Ir al chat
              </span>
            </div>
          </div>
        );
      }
    },
    {
      key: 'attendedBy',
      header: 'Estado',
      mobilePriority: 'high',
      render: (_: any, user: any) => (
        <div className="flex items-center gap-2">
          {user.bot_state === 'handoff' ? (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-bold">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Humano</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold">
              <Cpu className="w-3.5 h-3.5" />
              <span>Bot</span>
            </div>
          )}
          <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">{user.bot_state || 'main_menu'}</span>
        </div>
      )
    },
    {
      key: 'channels',
      header: 'Canal',
      mobilePriority: 'high',
      render: (_: any, user: any) => {
        const channel = detectChannel(user);
        return channel ? (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase border ${getChannelColor(channel)}`}>
            {getChannelIcon(channel)}
            <span>{channel}</span>
          </div>
        ) : (
          <span className="text-slate-400 text-xs">Sin canal</span>
        );
      }
    },
    {
      key: 'assignedAgent',
      header: 'Agente Asignado',
      mobilePriority: 'medium',
      render: (_: any, user: any) => {
        const agent = user.assigned_agent || user.assignedAgent;
        const agentName = agent?.name || (user.assigned_to ? 'Agente asignado' : null);

        return agentName ? (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/20 shadow-sm shrink-0">
              {agentName.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-tight truncate max-w-[130px]">{agentName}</span>
              {agent?.email && <span className="text-[10px] text-slate-400 truncate max-w-[130px]">{agent.email}</span>}
            </div>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
            <UserX className="w-3 h-3 text-slate-400" />
            Sin asignar
          </span>
        );
      }
    },
    {
      key: 'serviceNumber',
      header: 'Línea',
      mobilePriority: 'high',
      render: (_: any, user: any) => {
        const lineNumber = user.whatsapp_line_number || user.phone_number;
        const { prefix, number } = formatPhoneNumber(lineNumber);
        return (
          <div className="flex items-center justify-end gap-2 text-slate-600 dark:text-slate-300 text-sm">
            {prefix && <span className="font-bold text-accent-500 text-sm">{prefix}</span>}
            <span className="font-medium">{number || 'Sin línea'}</span>
          </div>
        );
      }
    },
    {
      key: 'lastInteraction',
      header: 'Última interacción',
      mobilePriority: 'medium',
      render: (_: any, user: any) => (
        <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">{formatDate(user.last_active_at)}</span>
      )
    }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Directorio de"
        highlight="Clientes"
        description="Gestión integral de interacciones."
        icon={User}
        action={
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
              <HeaderButton
                variant="ghost"
                onClick={() => setConfirmBulkDelete(true)}
                icon={<Trash2 className="w-4 h-4" />}
                className="hover:!text-red-500 hover:!bg-red-50 dark:hover:!bg-red-500/10"
              >
                Eliminar ({selectedIds.size})
              </HeaderButton>
            )}
            <div className="bg-gray-50 dark:bg-dark-card px-4 h-10 flex items-center gap-3 rounded-lg border border-gray-200 dark:border-white/5">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total: {users.length}</p>
            </div>
            <HeaderButton variant="secondary" onClick={() => setShowCreateModal(true)} icon={<UserPlus className="w-4 h-4" />}>
              Nuevo Cliente
            </HeaderButton>
          </div>
        }
      />

      <PageBody>
        <TableCard>
          {/* ── Barra de filtros unificada ── */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <SearchBar
              placeholder="Buscar por número, nombre o agente..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
            <div className="flex items-center gap-2 shrink-0">
              <Dropdown
                value={filterState}
                onChange={(v) => { setFilterState(v); setCurrentPage(1); }}
                options={[
                  { value: 'all', label: 'Todos los Estados' },
                  { value: 'human', label: 'Humano (Handoff)' },
                  { value: 'bot', label: 'Bot (Automático)' },
                ]}
              />
              <Dropdown
                value={filterChannel}
                onChange={(v) => { setFilterChannel(v); setCurrentPage(1); }}
                options={[
                  { value: 'all', label: 'Todos los Canales' },
                  { value: 'whatsapp', label: 'WhatsApp' },
                  { value: 'instagram', label: 'Instagram' },
                  { value: 'tiktok', label: 'TikTok' },
                  { value: 'telegram', label: 'Telegram' },
                  { value: 'messenger', label: 'Messenger' },
                ]}
              />
              <ViewToggle value={viewMode} onChange={setViewMode} />
            </div>
          </div>

          {viewMode === 'table' ? (
            <ResponsiveList
              columns={responsiveColumns}
              data={paginatedUsers}
              onRowClick={() => navigate('/conversations')}
              onRowSelect={(user) => toggleSelect(user.id, { stopPropagation: () => { } } as any)}
              selectedIds={selectedIds}
              getId={(user) => user.id}
              actions={(user) => [
                {
                  icon: <Eye className="w-4 h-4" />,
                  label: 'Ver Chat',
                  onClick: (e) => { e.stopPropagation(); navigate('/conversations'); },
                  tooltip: 'Ver Chat'
                },
                {
                  element: (
                    <ClientActionsDropdown
                      onViewChat={() => navigate('/conversations')}
                      onAssignAgent={() => {
                        setSelectedAgentForAssign(user.assigned_to || user.assigned_agent?.id || '');
                        setAssignModalUser(user);
                      }}
                      onEdit={() => handleEditUser(user)}
                      onDelete={() => setConfirmDelete({ id: user.id })}
                    />
                  )
                }
              ]}
              pagination={{
                currentPage,
                totalPages,
                onPageChange: setCurrentPage
              }}
            />
          ) : (
            <>
              {paginatedUsers.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-semibold">Sin clientes</p>
                  <p className="text-sm">Ajusta los filtros o agrega un nuevo cliente.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {paginatedUsers.map((user) => {
                    const channel = detectChannel(user);
                    const agent = user.assigned_agent || user.assignedAgent;
                    const agentName = agent?.name || (user.assigned_to ? 'Agente asignado' : null);
                    let realPhone = user.phone_number;
                    if (!realPhone || realPhone.length > 15) {
                      if (user.custom_attributes) {
                        const attrs = user.custom_attributes;
                        realPhone = attrs.real_phone_number || attrs.whatsapp_jid || attrs.whatsapp_number || attrs.phone || attrs.phoneNumber;
                      }
                    }
                    if (!realPhone) realPhone = user.phone_number;
                    const { prefix, number } = formatPhoneNumber(realPhone);
                    return (
                      <div
                        key={user.id}
                        onClick={() => navigate('/conversations')}
                        className="group relative bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-4 hover:border-accent-500/40 hover:shadow-lg hover:shadow-accent-500/5 transition-all cursor-pointer"
                      >
                        {/* Header row */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-500/20 to-accent-600/10 flex items-center justify-center shrink-0">
                              <span className="text-accent-500 font-black text-base">
                                {(user.profile_name || realPhone || '?').charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight">
                                {user.profile_name || 'Sin nombre'}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                {prefix && <span className="text-accent-500 font-bold">{prefix} </span>}{number || realPhone}
                              </p>
                            </div>
                          </div>
                          {channel && (
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase border ${getChannelColor(channel)}`}>
                              {getChannelIcon(channel)}
                              <span>{channel}</span>
                            </div>
                          )}
                        </div>

                        {/* Status row */}
                        <div className="flex items-center justify-between">
                          {user.bot_state === 'handoff' ? (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-bold">
                              <UserCheck className="w-3.5 h-3.5" /><span>Humano</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold">
                              <Cpu className="w-3.5 h-3.5" /><span>Bot</span>
                            </div>
                          )}
                          {agentName ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-[10px] flex items-center justify-center border border-emerald-500/20">
                                {agentName.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate max-w-[100px]">{agentName}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">Sin agente</span>
                          )}
                        </div>

                        {/* Last interaction */}
                        <p className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                          Última interacción: {formatDate(user.last_active_at)}
                        </p>

                        {/* Hover CTA */}
                        <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-accent-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <span className="text-xs font-bold text-accent-500 flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5" /> Ver conversación
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${page === currentPage
                        ? 'bg-accent-500 text-black'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </TableCard>
      </PageBody>

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Eliminar Cliente"
        message="¿Eliminar cliente y sus conversaciones? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        variant="danger"
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={handleBulkDelete}
        title="Eliminar Clientes"
        message={`¿Eliminar los ${selectedIds.size} clientes seleccionados y sus chats?`}
        confirmText={`Eliminar (${selectedIds.size})`}
        variant="danger"
      />

      <Modal
        open={showCreateModal}
        onClose={() => { setShowCreateModal(false); setEditingUser(null); }}
        title={editingUser ? "Editar Cliente" : "Agregar Cliente"}
        icon={<UserPlus className="w-5 h-5 text-accent-500" />}
      >
        <form onSubmit={handleCreateClient} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Teléfono *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent-500 font-bold text-sm">+</span>
              <input
                type="tel"
                name="phone"
                placeholder="5491112345678"
                defaultValue={editingUser?.phone_number || editingUser?.phone || ''}
                required
                className="w-full pl-7 pr-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all font-bold text-sm text-slate-900 dark:text-white placeholder-slate-400/60"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Escribe el número con código de país, ej: 5491112345678</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Nombre</label>
            <input
              type="text"
              name="name"
              placeholder="Nombre del contacto (opcional)"
              defaultValue={editingUser?.profile_name || editingUser?.name || ''}
              className="w-full px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all font-bold text-sm text-slate-900 dark:text-white placeholder-slate-400/60"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Email</label>
            <input
              type="email"
              name="email"
              placeholder="correo@ejemplo.com (opcional)"
              defaultValue={editingUser?.email || ''}
              className="w-full px-4 py-3 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:border-accent-500/50 focus:ring-4 focus:ring-accent-500/5 outline-none transition-all font-bold text-sm text-slate-900 dark:text-white placeholder-slate-400/60"
            />
          </div>
          <button type="submit" disabled={creating} className="w-full py-3.5 bg-gradient-to-r from-accent-500 to-accent-600 text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:from-accent-600 hover:to-accent-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {creating ? <Loader size="xs" /> : <UserPlus className="w-4 h-4" />}
            {creating ? 'Guardando...' : editingUser ? 'Guardar Cambios' : 'Agregar Cliente'}
          </button>
        </form>
      </Modal>

      <Modal
        open={assignModalUser !== null}
        onClose={() => setAssignModalUser(null)}
        title="Asignar Agente"
        icon={<UserCheck className="w-5 h-5 text-accent-500" />}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Selecciona el agente responsable para el cliente <span className="font-bold text-slate-900 dark:text-white">{assignModalUser?.profile_name || assignModalUser?.phone_number}</span>.
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Agente de Atención</label>
            <select
              value={selectedAgentForAssign}
              onChange={(e) => setSelectedAgentForAssign(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-accent-500/20"
            >
              <option value="">-- Seleccionar agente --</option>
              {systemAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.email})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAssignModalUser(null)}
              className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!selectedAgentForAssign || assigningAgent}
              onClick={handleAssignAgent}
              className="flex-1 py-2.5 bg-accent-500 text-black text-sm font-bold rounded-xl hover:bg-accent-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {assigningAgent ? <Loader size="xs" /> : <UserCheck className="w-4 h-4" />}
              {assigningAgent ? 'Guardando...' : 'Asignar'}
            </button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
};
