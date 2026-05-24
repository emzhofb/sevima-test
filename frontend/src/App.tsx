import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { getToken, logout, getClaims } from './lib/auth';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { WorkflowsPage } from './pages/WorkflowsPage';
import { WorkflowDetailPage } from './pages/WorkflowDetailPage';
import { RunDetailPage } from './pages/RunDetailPage';

function ProtectedLayout() {
  const token = getToken();
  const location = useLocation();
  const claims = getClaims();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Sleek Glassmorphic Sidebar */}
      <aside
        className="glass"
        style={{
          width: 260,
          position: 'fixed',
          top: 16,
          bottom: 16,
          left: 16,
          padding: '30px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          zIndex: 100,
          border: '1px solid var(--card-border)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, background: 'linear-gradient(to right, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'flex', alignItems: 'center', gap: 8 }}>
              FlowForge
            </h2>
            {claims?.tenant_id && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'monospace' }}>
                Tenant: {claims.tenant_id.slice(0, 8)}... ({claims.role})
              </div>
            )}
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link
              to="/"
              style={{
                display: 'block',
                padding: '12px 16px',
                borderRadius: 8,
                color: isActive('/') ? 'white' : 'var(--text-muted)',
                background: isActive('/') ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                border: isActive('/') ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 15,
                transition: 'all 0.2s',
              }}
            >
              Dashboard
            </Link>
            <Link
              to="/workflows"
              style={{
                display: 'block',
                padding: '12px 16px',
                borderRadius: 8,
                color: isActive('/workflows') ? 'white' : 'var(--text-muted)',
                background: isActive('/workflows') ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                border: isActive('/workflows') ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 15,
                transition: 'all 0.2s',
              }}
            >
              Workflows
            </Link>
          </nav>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            Logged in as {claims?.user_id?.slice(0, 8)}...
          </div>
          <button
            className="secondary"
            onClick={logout}
            style={{ width: '100%', padding: '10px 14px', fontSize: 14 }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <main style={{ marginLeft: 292, flex: 1, padding: '32px 32px 32px 16px', minHeight: '100vh' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/workflows" element={<WorkflowsPage />} />
            <Route path="/workflows/:id" element={<WorkflowDetailPage />} />
            <Route path="/runs/:id" element={<RunDetailPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<ProtectedLayout />} />
    </Routes>
  );
}
