import { apiFetch } from './client';
import type { User } from '../types';

export interface LoginResponse {
  token: string;
  user: User;
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipAuthRedirect: true,
  });
}

export function me(): Promise<User> {
  return apiFetch<User>('/api/auth/me');
}
