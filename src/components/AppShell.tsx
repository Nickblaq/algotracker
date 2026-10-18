'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, type ReactNode } from 'react';
import { useMemoryStore } from '@/hooks/useMemoryStore';

type Store = ReturnType<typeof useMemoryStore>;

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within AppShell');
  return ctx;
}

const NAV_ITEMS = [
  { path: '/chat', label: 'Chat', icon: '💬' },
  { path: '/memories', label: 'Memories', icon: '🧠' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const store = useMemoryStore();
  const pathname = usePathname();

  return (
    <StoreContext.Provider value={store}>
      <div className="app-shell">
        <header className="top-nav">
          <div className="nav-brand">
            <Link href="/chat" className="nav-logo-link">
              <div className="nav-logo">H</div>
            </Link>
            <div>
              <div className="nav-title">Hierarchical Memory</div>
              <div className="nav-subtitle">for LLMs</div>
            </div>
          </div>

          <nav className="nav-links">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`nav-link ${pathname === item.path ? 'active' : ''}`}
              >
                <span className="nav-link-icon">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="nav-actions">
            <div
              className={`status-badge ${
                store.apiConnected ? 'status-connected' : 'status-disconnected'
              }`}
            >
              <span className="status-dot" />
              {store.apiConnected ? 'Connected' : 'Offline'}
            </div>
          </div>
        </header>

        {store.apiConnected === false && (
          <div className="error-banner">
            Python backend not reachable — start it with{' '}
            <code>uvicorn server.main:app --port 8000</code>
          </div>
        )}

        <main className="page-content">{children}</main>

        <nav className="bottom-nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`bottom-nav-item ${pathname === item.path ? 'active' : ''}`}
            >
              <span className="bottom-nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </StoreContext.Provider>
  );
}
