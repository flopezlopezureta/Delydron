import { apiFetch } from './client';
import type { PublicTracking } from '../types';

// Public endpoint — no token in localStorage is required for this to work,
// but apiFetch attaches one if the visitor happens to also be logged in
// (harmless, the server ignores it). skipAuthRedirect guards against ever
// bouncing an anonymous visitor to /login — the route only ever answers
// 200 or 404, never 401, but this keeps that guarantee even if that changes.
export function getPublicTracking(token: string): Promise<PublicTracking> {
  return apiFetch<PublicTracking>(`/api/track/${encodeURIComponent(token)}`, {
    skipAuthRedirect: true,
  });
}
