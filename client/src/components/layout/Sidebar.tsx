import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { apiFetch } from '../../api/client';
import { ROLE_LABELS } from '../../types';
import { Logo } from './Logo';

// Small stroke-based icon set, hand-drawn to match the app's existing
// hand-written SVG convention (map markers, etc.) rather than pulling in an
// icon library for a dozen glyphs. `currentColor` lets each nav link's own
// text color (active/hover/inactive) drive the icon color for free.
const ICONS: Record<string, ReactNode> = {
  map: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 20l-6 2V6l6-2m0 16l6 2m-6-2V4m6 18l6-2V4l-6 2m0 16V6m0-2l-6 2"
    />
  ),
  mission: <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l7 18-7-4-7 4 7-18z" />,
  base: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 21V9l8-6 8 6v12M4 21h16M9 21v-6h6v6"
    />
  ),
  shield: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3l8 3v6c0 4.5-3.4 7.7-8 9-4.6-1.3-8-4.5-8-9V6l8-3zM12 8v5m0 3h.01"
    />
  ),
  history: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 8v5l3 2m6-2a9 9 0 11-9-9 9 9 0 019 9zM3 12h2m14 0h2m-9-9v2m0 14v2"
    />
  ),
  audit: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 3h6a1 1 0 011 1v1h1a1 1 0 011 1v14a1 1 0 01-1 1H7a1 1 0 01-1-1V6a1 1 0 011-1h1V4a1 1 0 011-1zM9 12h6M9 16h6M9 8h6"
    />
  ),
  chart: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 20V10m6 10V4m6 16v-7m6 7H2" />
  ),
  gear: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10.3 2.3h3.4l.5 2.4a7.6 7.6 0 011.6.9l2.3-.9 1.7 3-1.9 1.5a7.6 7.6 0 010 1.9l1.9 1.5-1.7 3-2.3-.9a7.6 7.6 0 01-1.6.9l-.5 2.4h-3.4l-.5-2.4a7.6 7.6 0 01-1.6-.9l-2.3.9-1.7-3 1.9-1.5a7.6 7.6 0 010-1.9L3.7 9.3l1.7-3 2.3.9c.5-.4 1-.7 1.6-.9l.5-2.4z M12 15a3 3 0 100-6 3 3 0 000 6z"
    />
  ),
  users: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16 11a4 4 0 10-4-4M16 11a4 4 0 01-4 4m4-4a4 4 0 014 4v3M8 15a4 4 0 018 0v3H4v-3a4 4 0 014-4zm4-4a4 4 0 100-8 4 4 0 000 8z"
    />
  ),
  sun: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 4V2m0 20v-2m8-8h2M2 12h2m14.14 6.14l1.42 1.42M4.44 4.44l1.42 1.42m0 12.28l-1.42 1.42M19.56 4.44l-1.42 1.42M16 12a4 4 0 11-8 0 4 4 0 018 0z"
    />
  ),
  moon: <path strokeLinecap="round" strokeLinejoin="round" d="M20.8 14.3A8.3 8.3 0 019.7 3.2a8.3 8.3 0 1011.1 11.1z" />,
};

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      className="shrink-0"
    >
      {ICONS[name]}
    </svg>
  );
}

interface NavItem {
  to: string;
  label: string;
  icon: keyof typeof ICONS;
  end?: boolean;
  roles?: Array<'super_admin' | 'admin' | 'operator' | 'technician' | 'auxiliary'>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operación',
    items: [
      { to: '/', label: 'Mapa', icon: 'map', end: true },
      { to: '/missions', label: 'Misiones', icon: 'mission' },
      { to: '/bases', label: 'Bases', icon: 'base' },
      { to: '/no-fly-zones', label: 'Zonas restringidas', icon: 'shield' },
    ],
  },
  {
    label: 'Datos',
    items: [
      { to: '/deliveries', label: 'Historial', icon: 'history' },
      { to: '/audit', label: 'Auditoría', icon: 'audit', roles: ['admin', 'super_admin'] },
      {
        to: '/analytics',
        label: 'Analítica',
        icon: 'chart',
        roles: ['admin', 'super_admin', 'technician'],
      },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/config', label: 'Configuración', icon: 'gear' },
      { to: '/users', label: 'Usuarios', icon: 'users', roles: ['admin', 'super_admin'] },
    ],
  },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
    isActive ? 'bg-brand text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
  }`;

export function Sidebar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  // Counted server-side in Postgres and bumped once per boot (see
  // versionService.js) — a Docker build can't count "builds so far" on its
  // own (each one starts from nothing), so this can't be a build-time
  // constant; it has to come from somewhere that actually persists across
  // deploys, which for this app is the database it already has.
  const [appVersion, setAppVersion] = useState('...');

  useEffect(() => {
    apiFetch<{ version: string | null }>('/api/version', { skipAuthRedirect: true })
      .then((data) => setAppVersion(data.version || 'dev'))
      .catch(() => setAppVersion('dev'));
  }, []);

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col bg-slate-900">
      <div className="border-b border-slate-800 px-4 py-4">
        <Logo />
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-4">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => !item.roles || (user && item.roles.includes(user.role)));
          if (items.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="mb-1.5 px-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
                    <Icon name={item.icon} />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {user && (
        <div className="border-t border-slate-800 p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <div className="min-w-0">
              <p className="truncate text-sm text-slate-200">{user.fullName}</p>
              <p className="text-xs text-slate-500">{ROLE_LABELS[user.role]}</p>
            </div>
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
          </div>
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-slate-600" title="Versión de la app">
              v{appVersion}
            </span>
            <button
              onClick={logout}
              className="rounded-md bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              Salir
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
