const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const TOKEN_KEY = 'dronecontrol_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function apiBaseUrl() {
  return BASE_URL;
}

interface RequestOptions extends RequestInit {
  skipAuthRedirect?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuthRedirect, headers, ...rest } = options;
  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string> | undefined),
  };

  const token = getToken();
  if (token) finalHeaders['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...rest, headers: finalHeaders });

  if (res.status === 401 && !skipAuthRedirect) {
    setToken(null);
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new Error('unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // `message` is the human-readable explanation some routes add (e.g. why
    // a dispatch was blocked) — prefer it over the bare machine code so the
    // operator sees the actual reason instead of a string like "dispatch_infeasible".
    throw new Error(body.message || body.error || `request_failed_${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
