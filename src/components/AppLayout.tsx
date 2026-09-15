import { Outlet, NavLink, useLocation } from 'react-router';
import { useMemoryStore } from '../hooks/useMemoryStore';
import { createContext, useContext } from 'react';

// Share the store across all pages via context
export const StoreContext = createContext<ReturnType<typeof useMemoryStore> | null>(null);

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within AppLayout');
  return ctx;
}

export function AppLayout() {
  const store = useMemoryStore();
  const location = useLocation();

  const navItems = [
    { path: '/chat', label: 'Chat', icon: '💬' },
    { path: '/memories', label: 'Memories', icon: '🧠' },
    { path: '/analytics', label: 'Analytics', icon: '📊' },
    { path: '/operations', label: 'Operations', icon: '📋' },
    { path: '/tasks', label: 'Tasks', icon: '⚡' },
  ];

  return (
    <StoreContext.Provider value={store}>
      <div className="app-shell">
        {/* Top Navigation */}
        <header className="top-nav">
          <div className="nav-brand">
            <NavLink to="/chat" className="nav-logo-link">
              <div className="nav-logo">H</div>
            </NavLink>
            <div>
              <div className="nav-title">Hierarchical Memory</div>
              <div className="nav-subtitle">for LLMs</div>
            </div>
          </div>

          {/* Desktop nav links */}
          <nav className="nav-links">
            {navItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <span className="nav-link-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="nav-actions">
            <div className={`status-badge ${store.apiConnected ? 'status-connected' : 'status-disconnected'}`}>
              <span className="status-dot" />
              {store.apiConnected ? 'Connected' : 'Offline'}
            </div>
          </div>
        </header>

        {store.apiConnected === false && (
          <div className="error-banner">
            Python backend not reachable — start with <code>uvicorn server.main:app</code>
          </div>
        )}

        {/* Page content */}
        <main className="page-content">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="bottom-nav">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="bottom-nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </StoreContext.Provider>
  );
}
