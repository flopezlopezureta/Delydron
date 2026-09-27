import { Logo } from './Logo';

interface MobileTopBarProps {
  onOpenSidebar: () => void;
}

// Only ever visible below `lg` (phone/tablet) — on desktop the Sidebar is
// permanently docked so there's nothing here for a hamburger to open.
export function MobileTopBar({ onOpenSidebar }: MobileTopBarProps) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900 lg:hidden">
      <button
        onClick={onOpenSidebar}
        aria-label="Abrir menú"
        className="shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <Logo variant="mark" />
      <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">Delydrone</span>
    </div>
  );
}
