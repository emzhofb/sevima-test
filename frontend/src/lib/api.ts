const API_BASE = '/api';

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (response.status === 401) {
    localStorage.removeItem('token');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Unauthorized');
  }

  if (!response.ok) {
    let body: any;
    try {
      body = await response.json();
    } catch {
      /* ignore */
    }
    throw new ApiError(response.status, response.statusText, body);
  }

  if (response.status === 204) return undefined as any;
  return response.json();
}
