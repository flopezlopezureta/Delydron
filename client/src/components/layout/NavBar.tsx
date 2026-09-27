import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { apiFetch } from '../../api/client';
import { ROLE_LABELS } from '../../types';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded px-3 py-1 text-sm ${isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800'}`;

export function NavBar() {
  const { user, logout } = useAuth();
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
    <header className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
      <div className="flex items-center gap-6">
        <span className="font-semibold tracking-wide">DroneControl</span>
        <nav className="flex gap-1">
          <NavLink to="/" end className={linkClass}>
            Mapa
          </NavLink>
          <NavLink to="/missions" className={linkClass}>
            Misiones
          </NavLink>
          <NavLink to="/bases" className={linkClass}>
            Bases
          </NavLink>
          <NavLink to="/no-fly-zones" className={linkClass}>
            Zonas restringidas
          </NavLink>
          <NavLink to="/deliveries" className={linkClass}>
            Historial
          </NavLink>
          <NavLink to="/config" className={linkClass}>
            Configuración
          </NavLink>
          {(user?.role === 'admin' || user?.role === 'super_admin') && (
            <NavLink to="/users" className={linkClass}>
              Usuarios
            </NavLink>
          )}
          {(user?.role === 'admin' || user?.role === 'super_admin') && (
            <NavLink to="/audit" className={linkClass}>
              Auditoría
            </NavLink>
          )}
          {(user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'technician') && (
            <NavLink to="/analytics" className={linkClass}>
              Analítica
            </NavLink>
          )}
        </nav>
      </div>
      {user && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-300">
            {user.fullName} · {ROLE_LABELS[user.role]}
          </span>
          <span className="text-xs text-slate-500" title="Versión de la app">
            v{appVersion}
          </span>
          <button
            onClick={logout}
            className="rounded bg-slate-700 px-3 py-1 hover:bg-slate-600"
          >
            Salir
          </button>
        </div>
      )}
    </header>
  );
}
