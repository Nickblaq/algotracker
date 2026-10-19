'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, type ReactNode } from 'react';
import { useMemoryStore } from '@/hooks/useMemoryStore';
import { ToastStack } from '@/components/ToastStack';
import { ChatIcon, GraphIcon } from '@/components/icons';

type Store = ReturnType<typeof useMemoryStore>;

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within AppShell');
  return ctx;
}

const NAV_ITEMS = [
  { path: '/chat', label: 'Chat', Icon: ChatIcon },
  { path: '/memories', label: 'Memories', Icon: GraphIcon },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const store = useMemoryStore();
  const pathname = usePathname();

  return (
    <StoreContext.Provider value={store}>
      <a href="#main" className="sr-only">
        Skip to content
      </a>

      <div className="app-shell">
        <header className="top-nav">
          <div className="nav-brand">
            <Link href="/chat" className="nav-logo-link" aria-label="Hierarchical Memory home">
              <span className="nav-logo" aria-hidden="true">
                H
              </span>
            </Link>
            <div className="nav-titles">
              <div className="nav-title">Hierarchical Memory</div>
              <div className="nav-subtitle">Weighted graph for LLMs</div>
            </div>
          </div>

          <nav className="nav-links" aria-label="Primary">
            {NAV_ITEMS.map(({ path, label, Icon }) => {
              const active = pathname === path;
              return (
                <Link
                  key={path}
                  href={path}
                  className={`nav-link ${active ? 'active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="nav-actions">
            <div
              className={`status-badge ${
                store.apiConnected === null
                  ? 'status-pending'
                  : store.apiConnected
                    ? 'status-connected'
                    : 'status-disconnected'
              }`}
              role="status"
              aria-live="polite"
            >
              <span className="status-dot" />
              <span>
                {store.apiConnected === null
                  ? 'Connecting'
                  : store.apiConnected
                    ? 'Live'
                    : 'Offline'}
              </span>
            </div>
          </div>
        </header>

        {store.apiConnected === false && (
          <div className="error-banner" role="alert">
            Backend not reachable — start it with <code>uvicorn server.main:app</code>
          </div>
        )}

        <main className="page-content" id="main">
          {children}
        </main>

        <nav className="bottom-nav" aria-label="Primary">
          {NAV_ITEMS.map(({ path, label, Icon }) => {
            const active = pathname === path;
            return (
              <Link
                key={path}
                href={path}
                className={`bottom-nav-item ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={20} />
                {label}
                {path === '/memories' && store.stats.totalMemories > 0 && (
                  <span className="bottom-nav-badge" aria-label={`${store.stats.totalMemories} memories`}>
                    {store.stats.totalMemories > 99 ? '99+' : store.stats.totalMemories}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <ToastStack toasts={store.toasts} onDismiss={store.dismissToast} />
      </div>
    </StoreContext.Provider>
  );
}
