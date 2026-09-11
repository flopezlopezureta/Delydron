import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded px-3 py-1 text-sm ${isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800'}`;

export function NavBar() {
  const { user, logout } = useAuth();

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
          <NavLink to="/deliveries" className={linkClass}>
            Historial
          </NavLink>
        </nav>
      </div>
      {user && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-300">
            {user.fullName} · {user.role}
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
