import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { SyncProvider, useSync } from './contexts/SyncContext';
import { AuthProvider } from './contexts/AuthContext';
import { MainLayout } from './components/layout/MainLayout';

import { DashboardPage } from './pages/DashboardPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { ConciliationPage } from './pages/ConciliationPage';
import { ProductsPage } from './pages/ProductsPage';
import { OrdersPage } from './pages/OrdersPage';
import { FinancePage } from './pages/FinancePage';
import { AlertsPage } from './pages/AlertsPage';
import { AuditPage } from './pages/AuditPage';
import { ExportsPage } from './pages/ExportsPage';
import { SettingsPage } from './pages/SettingsPage';

import { apiService } from './services/apiService';
import { NAVIGATION_ITEMS } from './config/constants';

function AppContent() {
  const { refreshTrigger } = useSync();
  const [activeModule, setActiveModule] = useState<string>('dashboard');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [alertCount, setAlertCount] = useState<number>(0);

  const handleNavigate = (module: string, entityId?: string) => {
    setActiveModule(module);
    setSelectedEntityId(entityId || null);
  };

  useEffect(() => {
    const fetchAlertCount = async () => {
      try {
        const alerts = await apiService.getAlerts();
        const activeAlerts = alerts.filter((a) => a.status !== 'resolvido').length;
        setAlertCount(activeAlerts);
      } catch {
        // Fallback silently
      }
    };
    fetchAlertCount();
  }, [activeModule, refreshTrigger]);

  const currentNav = NAVIGATION_ITEMS.find((item) => item.id === activeModule) || NAVIGATION_ITEMS[0];

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return <DashboardPage onNavigate={handleNavigate} />;
      case 'connections':
        return <ConnectionsPage initialSelectedId={selectedEntityId} />;
      case 'conciliation':
        return <ConciliationPage initialSelectedId={selectedEntityId} />;
      case 'products':
        return <ProductsPage initialSelectedId={selectedEntityId} />;
      case 'orders':
        return <OrdersPage initialSelectedId={selectedEntityId} />;
      case 'finance':
        return <FinancePage />;
      case 'alerts':
        return <AlertsPage initialSelectedId={selectedEntityId} />;
      case 'audit':
        return <AuditPage />;
      case 'exports':
        return <ExportsPage />;
      case 'settings':
        return <SettingsPage initialSelectedId={selectedEntityId} />;
      default:
        return <DashboardPage onNavigate={handleNavigate} />;
    }
  };

  return (
    <MainLayout
      activeModule={activeModule}
      onNavigate={handleNavigate}
      title={currentNav.label}
      subtitle={currentNav.description}
      alertCount={alertCount}
    >
      {renderModule()}
    </MainLayout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <SyncProvider>
            <AppContent />
          </SyncProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
