# [Epic-14] Login page

**Labels**: `epic-14`, `area-frontend`
**Estimate**: 1.5 jam
**Depends on**: #103, #43 (login API)

## Context

Form login, store JWT di localStorage (atau sessionStorage), redirect ke dashboard.

## Acceptance Criteria

- [ ] Form: tenant_slug, email, password
- [ ] Submit → POST /auth/login
- [ ] Sukses: store token, redirect ke `/`
- [ ] Error: tampilkan message
- [ ] Token attached ke request via custom hook

## Implementation Hints

```tsx
// src/pages/LoginPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function LoginPage() {
  const [form, setForm] = useState({ tenant_slug: '', email: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        setError('Login gagal');
        return;
      }
      const { token } = await res.json();
      localStorage.setItem('token', token);
      navigate('/');
    } catch (err) {
      setError('Network error');
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <input
        placeholder="Tenant slug"
        value={form.tenant_slug}
        onChange={(e) => setForm({ ...form, tenant_slug: e.target.value })}
      />
      <input
        placeholder="Email"
        type="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <input
        placeholder="Password"
        type="password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />
      <button type="submit">Login</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  );
}
```

```tsx
// src/lib/auth.ts
export function getToken(): string | null {
  return localStorage.getItem('token');
}

export function logout() {
  localStorage.removeItem('token');
  window.location.href = '/login';
}
```

## Files Involved

- `packages/web/src/pages/LoginPage.tsx`
- `packages/web/src/lib/auth.ts`

## How to Verify

```bash
pnpm -F @flowforge/web dev
# Buka /login, login dengan user yang sudah dibuat lewat seed
```
