import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hierarchical Memory for LLMs',
  description:
    'A five-tier memory system for LLMs: sensory, short term, long term, episodic and procedural.',
  icons: { icon: '/logo.svg' },
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
