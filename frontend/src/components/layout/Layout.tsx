import { ReactNode, useState, createContext, useContext } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

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

export const Layout = ({ children, fullWidth = false, noPadding = false, noHeader = false }: LayoutProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

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
              {children}
            </div>
          </main>
        </div>
      </div>
    </LayoutContext.Provider>
  );
};
