import { useAuth } from '../../hooks/useAuth';

export function NavBar() {
  const { user, logout } = useAuth();

  return (
    <header className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
      <span className="font-semibold tracking-wide">DroneControl</span>
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
