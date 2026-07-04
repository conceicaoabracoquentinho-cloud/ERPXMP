import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { SyncProgressModal } from '../sync/SyncProgressModal';

interface MainLayoutProps {
  activeModule: string;
  onNavigate: (module: string) => void;
  title: string;
  subtitle?: string;
  alertCount: number;
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  activeModule,
  onNavigate,
  title,
  subtitle,
  alertCount,
  children,
}) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar activeModule={activeModule} onNavigate={onNavigate} alertCount={alertCount} />
      <div className="lg:pl-64">
        <Header title={title} subtitle={subtitle} alertCount={alertCount} onNavigate={onNavigate} />
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
      <SyncProgressModal />
    </div>
  );
};
