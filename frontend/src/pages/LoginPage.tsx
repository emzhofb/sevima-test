import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function LoginPage() {
  const [form, setForm] = useState({ tenant_slug: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        let errBody: any;
        try {
          errBody = await res.json();
        } catch {
          // ignore
        }
        setError(errBody?.message || 'Login failed. Please check your credentials.');
        return;
      }
      const { token } = await res.json();
      localStorage.setItem('token', token);
      navigate('/');
    } catch (err) {
      setError('Network error. Failed to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: 20 }}>
      <div className="glass" style={{ width: '100%', maxWidth: 420, padding: '40px 30px', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)' }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, textAlign: 'center', background: 'linear-gradient(to right, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          FlowForge
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', marginBottom: 30 }}>
          Enter credentials to access your dashboard
        </p>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>Tenant Slug</label>
            <input
              placeholder="e.g. acme"
              value={form.tenant_slug}
              onChange={(e) => setForm({ ...form, tenant_slug: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>Email Address</label>
            <input
              placeholder="name@company.com"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>Password</label>
            <input
              placeholder="••••••••"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 14px', borderRadius: 8, color: 'var(--danger)', fontSize: 14 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{ marginTop: 10, fontSize: 15, padding: 12 }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
