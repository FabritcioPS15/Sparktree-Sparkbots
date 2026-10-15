import { ReactNode, useState, useEffect, useRef, createContext, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { PageLoader } from './PageLoader';

interface LayoutContextType {
  isSidebarCollapsed: boolean;
}

const LayoutContext = createContext<LayoutContextType>({ isSidebarCollapsed: false });

export const useLayout = () => useContext(LayoutContext);

interface LayoutProps {
  children: ReactNode;
  fullWidth?: boolean;
  noPadding?: boolean;
  noHeader?: boolean;
}

export const getSectionName = (pathname: string): string => {
  if (pathname === '/' || pathname === '/dashboard') return 'Dashboard';
  if (pathname.startsWith('/clients')) return 'Clientes';
  if (pathname.startsWith('/conversations')) return 'Conversaciones';
  if (pathname.startsWith('/catalogs')) return 'Catálogos';
  if (pathname.startsWith('/leads')) return 'Leads';
  if (pathname.startsWith('/flow-manager') || pathname.startsWith('/flows')) return 'Gestor de Flujos';
  if (pathname.startsWith('/analytics')) return 'Analíticas';
  if (pathname.startsWith('/reports')) return 'Reportes';
  if (pathname.startsWith('/billing/plans')) return 'Planes';
  if (pathname.startsWith('/billing/payments')) return 'Pagos';
  if (pathname.startsWith('/billing/usage')) return 'Uso';
  if (pathname.startsWith('/billing')) return 'Facturación';
  if (pathname.startsWith('/settings')) return 'Ajustes';
  if (pathname.startsWith('/whatsapp-qr')) return 'WhatsApp';
  if (pathname.startsWith('/multi-whatsapp')) return 'WhatsApp Manager';
  if (pathname.startsWith('/whatsapp-templates')) return 'Templates WhatsApp';
  if (pathname.startsWith('/connections')) return 'Conexiones';
  if (pathname.startsWith('/telegram-config')) return 'Telegram';
  if (pathname.startsWith('/instagram-config')) return 'Instagram';
  if (pathname.startsWith('/facebook-config')) return 'Facebook Messenger';
  if (pathname.startsWith('/tiktok-config')) return 'TikTok';
  if (pathname.startsWith('/admin/organizations')) return 'Organizaciones';
  if (pathname.startsWith('/admin/staff')) return 'Personal';
  if (pathname.startsWith('/crm')) return 'CRM';
  if (pathname.startsWith('/pipeline')) return 'Pipeline';
  if (pathname.startsWith('/email')) return 'Correo';
  if (pathname.startsWith('/calendar')) return 'Calendario';
  if (pathname.startsWith('/orders')) return 'Pedidos';
  if (pathname.startsWith('/promotions')) return 'Promociones';
  if (pathname.startsWith('/campaigns')) return 'Campañas';
  if (pathname.startsWith('/reminders')) return 'Recordatorios';
  if (pathname.startsWith('/cotizaciones')) return 'Cotizaciones';
  if (pathname.startsWith('/message-templates')) return 'Plantillas';
  if (pathname.startsWith('/assignment-rules')) return 'Reglas de Asignación';
  if (pathname.startsWith('/business-hours')) return 'Horarios de Atención';
  if (pathname.startsWith('/knowledge-bases') || pathname.startsWith('/knowledge-base')) return 'Base de Conocimiento';
  if (pathname.startsWith('/support')) return 'Atención';
  if (pathname.startsWith('/agents')) return 'Agentes';
  if (pathname.startsWith('/notifications')) return 'Notificaciones';
  if (pathname.startsWith('/webhooks')) return 'Webhooks';
  if (pathname.startsWith('/roles-permissions')) return 'Roles y Permisos';
  if (pathname.startsWith('/audit-logs')) return 'Auditoría';
  if (pathname.startsWith('/superadmin/companies')) return 'Empresas';
  if (pathname.startsWith('/superadmin/business-metrics')) return 'Métricas';
  if (pathname.startsWith('/superadmin/system-logs')) return 'Logs del Sistema';
  if (pathname.startsWith('/ai/providers')) return 'Proveedores LLM';
  return '';
};

const getBasePath = (pathname: string): string => {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return '/';
  if (parts[0] === 'superadmin' || parts[0] === 'admin') {
    return `/${parts[0]}/${parts[1] || ''}`;
  }
  return `/${parts[0]}`;
};

export const Layout = ({ children, fullWidth = false, noPadding = false, noHeader = false }: LayoutProps) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  const prevPathnameRef = useRef(location.pathname);
  const [isPageLoading, setIsPageLoading] = useState(false);

  useEffect(() => {
    const prevPathname = prevPathnameRef.current;
    if (prevPathname === location.pathname) return;
    prevPathnameRef.current = location.pathname;

    // Solo mostrar el loader de navegación al cambiar de sección (base path).
    // Cambios dentro de la misma sección (ej. /conversations -> /conversations/:id) no lo muestran.
    if (getBasePath(prevPathname) === getBasePath(location.pathname)) return;

    setIsPageLoading(true);
    const timer = setTimeout(() => {
      setIsPageLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <LayoutContext.Provider value={{ isSidebarCollapsed }}>
      <div className="flex h-screen bg-[#F8FAFC] dark:bg-[#252525] transition-colors duration-300">
        <Sidebar
          onCollapsedChange={setIsSidebarCollapsed}
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />

        <div className="flex-1 flex flex-col overflow-hidden relative">
          {!noHeader && <Header onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />}

          <main className={`flex-1 overflow-y-auto overflow-x-hidden relative z-10 min-h-0 transition-all duration-300 ${noPadding ? '' : ''}`}>
            <div className={`w-full h-full mx-auto flex flex-col flex-1 min-h-0 ${fullWidth ? '' : 'layout-container'}`}>
              {isPageLoading ? (
                <div className="flex-1 flex items-center justify-center h-full min-h-[400px]">
                  <PageLoader sectionName={getSectionName(location.pathname)} />
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0 w-full animate-in fade-in duration-200">
                  {children}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </LayoutContext.Provider>
  );
};
