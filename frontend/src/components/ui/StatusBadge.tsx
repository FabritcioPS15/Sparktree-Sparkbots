import { Badge } from './Badge';
import { useCustomization, LOCKED_STATUS_VARIANTS } from '../../contexts/CustomizationContext';

export interface StatusBadgeProps {
  status: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
}

const statusLabels: Record<string, string> = {
  pending: 'Pendiente', paid: 'Pagado', sent: 'Enviado', delivered: 'Entregado',
  cancelled: 'Cancelado', active: 'Activo', inactive: 'Inactivo', failed: 'Fallido',
  available: 'Disponible', busy: 'Ocupado', offline: 'Offline',
  error: 'Error', success: 'Éxito', warning: 'Advertencia', info: 'Info',
  connected: 'Conectado', connecting: 'Conectando', disconnected: 'Desconectado',
  draft: 'Borrador', accepted: 'Aceptado', rejected: 'Rechazado', expired: 'Vencido',
};

const defaultVariants: Record<string, string> = {
  pending: 'warning', paid: 'success', sent: 'info', delivered: 'success',
  cancelled: 'danger', active: 'primary', inactive: 'default', failed: 'danger',
  available: 'success', busy: 'warning', offline: 'default',
  error: 'danger', success: 'success', warning: 'warning', info: 'info',
  connected: 'success', connecting: 'warning', disconnected: 'danger',
  draft: 'default', accepted: 'success', rejected: 'danger', expired: 'warning',
};

export const StatusBadge = ({ status, variant, size = 'sm', dot = true }: StatusBadgeProps) => {
  const customization = useCustomization();
  const statusKey = status?.toLowerCase() || 'default';
  const lockedVariant = LOCKED_STATUS_VARIANTS[statusKey];
  const customVariant = customization?.statusColors?.[statusKey];
  const badgeVariant = variant || lockedVariant || customVariant || defaultVariants[statusKey] || 'default';
  const label = statusLabels[statusKey] || status || 'Desconocido';

  return (
    <Badge variant={badgeVariant as any} size={size} dot={dot}>
      {label}
    </Badge>
  );
};
