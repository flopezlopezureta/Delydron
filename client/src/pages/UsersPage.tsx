import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { listUsers, createUser, updateUser, deactivateUser } from '../api/users';
import type { ManagedUser, UserRole } from '../types';

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('operator');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refetch = useCallback(() => {
    return listUsers()
      .then(setUsers)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    refetch().finally(() => setLoading(false));
  }, [refetch]);

  function resetForm() {
    setEmail('');
    setPassword('');
    setFullName('');
    setRole('operator');
    setFormError(null);
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(u: ManagedUser) {
    setEditingId(u.id);
    setEmail(u.email);
    setFullName(u.full_name);
    setPassword('');
    setRole(u.role);
    setFormError(null);
    setShowForm(true);
  }

  async function handleSubmit() {
    setFormError(null);
    if (!email.trim() || !fullName.trim() || (!editingId && !password.trim())) {
      return setFormError('Completá email, contraseña y nombre.');
    }
    setSubmitting(true);
    try {
      if (editingId) {
        await updateUser(editingId, {
          email,
          fullName,
          role,
          ...(password.trim() ? { password } : {}),
        });
      } else {
        await createUser({ email, password, fullName, role });
      }
      resetForm();
      refetch();
    } catch (err) {
      setFormError(
        err instanceof Error && err.message === 'email_already_in_use'
          ? 'Ese email ya está en uso.'
          : err instanceof Error
            ? err.message
            : 'No se pudo guardar el usuario.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRoleChange(u: ManagedUser, newRole: UserRole) {
    setBusyId(u.id);
    setError(null);
    try {
      await updateUser(u.id, { role: newRole });
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el rol.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleActive(u: ManagedUser) {
    setBusyId(u.id);
    setError(null);
    try {
      if (u.is_active) {
        await deactivateUser(u.id);
      } else {
        await updateUser(u.id, { isActive: true });
      }
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el usuario.');
    } finally {
      setBusyId(null);
    }
  }

  if (currentUser && currentUser.role !== 'admin') {
    return (
      <div className="p-4 text-sm text-slate-500">
        Esta sección es solo para administradores.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">Usuarios</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Nuevo usuario
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-4 max-w-lg rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            {editingId ? 'Editar usuario' : 'Nuevo usuario'}
          </h2>
          <label className="mb-1 block text-xs text-slate-600">Nombre completo</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mb-3 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
          <label className="mb-1 block text-xs text-slate-600">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-3 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
          <label className="mb-1 block text-xs text-slate-600">
            Contraseña{editingId && ' (dejar en blanco para no cambiarla)'}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-3 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
          <label className="mb-1 block text-xs text-slate-600">Rol</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            disabled={editingId === currentUser?.id}
            className="mb-3 w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:opacity-50"
          >
            <option value="operator">Operador</option>
            <option value="admin">Admin</option>
          </select>
          {formError && <div className="mb-3 text-sm text-red-600">{formError}</div>}
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? 'Guardando...' : 'Guardar usuario'}
            </button>
            <button
              onClick={resetForm}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading && <div className="text-sm text-gray-500">Cargando usuarios...</div>}
      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
      {!loading && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Rol</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                const busy = busyId === u.id;
                return (
                  <tr key={u.id} className={u.is_active ? '' : 'opacity-50'}>
                    <td className="px-4 py-2 font-medium text-slate-800">{u.full_name}</td>
                    <td className="px-4 py-2 text-slate-600">{u.email}</td>
                    <td className="px-4 py-2">
                      <select
                        disabled={busy || isSelf}
                        value={u.role}
                        onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                        className="rounded border border-slate-300 px-1.5 py-1 text-xs disabled:opacity-50"
                      >
                        <option value="operator">Operador</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{u.is_active ? 'Activo' : 'Inactivo'}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button
                          disabled={busy}
                          onClick={() => startEdit(u)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Editar
                        </button>
                        <button
                          disabled={busy || isSelf}
                          onClick={() => handleToggleActive(u)}
                          title={isSelf ? 'No podés desactivarte a vos mismo.' : undefined}
                          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {u.is_active ? 'Desactivar' : 'Reactivar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-slate-400">
                    No hay usuarios todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
