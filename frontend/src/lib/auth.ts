export function getToken(): string | null {
  return localStorage.getItem('token');
}

export function logout() {
  localStorage.removeItem('token');
  window.location.href = '/login';
}

export function getClaims(): { tenant_id: string; user_id: string; role: string } | null {
  const token = getToken();
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1] || ''));
    return payload;
  } catch {
    return null;
  }
}
