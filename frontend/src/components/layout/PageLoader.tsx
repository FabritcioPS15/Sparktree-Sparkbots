import { TopProgressBar } from './TopProgressBar';

interface PageLoaderProps {
  sectionName?: string;
  isInitial?: boolean; // If it's the first load
}

/**
 * Standard loading screen for pages.
 * Unified loader â€” same style for initial load, page transitions and data loading.
 */
export const PageLoader = ({ sectionName, isInitial = false }: PageLoaderProps) => {
  return (
    <div
      className={`flex flex-col flex-1 items-center justify-center relative overflow-hidden animate-in fade-in duration-300 bg-white dark:bg-dark-bg ${
        isInitial ? 'h-screen w-screen' : 'h-full min-h-[400px]'
      }`}
    >
      <TopProgressBar />

      <div className="flex flex-col items-center gap-6 relative z-10">
        {/* Spinner CSS */}
        <div className="loader" />

        <div className="flex flex-col items-center gap-1.5">
          <p className="text-slate-800 dark:text-slate-100 font-bold text-base tracking-tight">
            {sectionName ? (
              <>Cargando <span className="text-accent-500">{sectionName}</span></>
            ) : (
              'Conectando'
            )}
          </p>
          <p className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-[0.35em] flex items-center gap-1.5">
            Por favor espera{' '}
            <span className="flex gap-0.5">
              <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};


