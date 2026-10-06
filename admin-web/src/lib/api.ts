const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('roe_access_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('roe_access_token');
      localStorage.removeItem('roe_user');
      window.location.href = '/login';
    }
    throw new Error('Session expirée. Veuillez vous reconnecter.');
  }

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Une erreur est survenue';
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  get: <T = any>(url: string) => apiRequest<T>(url, { method: 'GET' }),
  post: <T = any>(url: string, body?: any) =>
    apiRequest<T>(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T = any>(url: string, body?: any) =>
    apiRequest<T>(url, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T = any>(url: string) => apiRequest<T>(url, { method: 'DELETE' }),
};
