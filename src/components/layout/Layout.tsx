import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

export const Layout = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-screen bg-surface-900">
    <Sidebar />
    <main className="flex-1 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16 lg:pt-8">
        {children}
      </div>
    </main>
  </div>
);
