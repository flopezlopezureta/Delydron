import { apiFetch } from './client';
import type { ManagedUser, UserRole } from '../types';

export interface CreateUserInput {
  email: string;
  password: string;
  fullName: string;
  role?: UserRole;
}

export interface UpdateUserInput {
  email?: string;
  fullName?: string;
  role?: UserRole;
  isActive?: boolean;
  password?: string;
}

export function listUsers(): Promise<ManagedUser[]> {
  return apiFetch<ManagedUser[]>('/api/users');
}

export function createUser(input: CreateUserInput): Promise<ManagedUser> {
  return apiFetch<ManagedUser>('/api/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateUser(id: string, input: UpdateUserInput): Promise<ManagedUser> {
  return apiFetch<ManagedUser>(`/api/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deactivateUser(id: string): Promise<void> {
  return apiFetch<void>(`/api/users/${id}`, { method: 'DELETE' });
}
