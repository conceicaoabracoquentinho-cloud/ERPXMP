import React, { useState, useEffect } from 'react';
import { NAVIGATION_ITEMS, DEFAULT_COMPANY } from '../../config/constants';
import { useSync } from '../../contexts/SyncContext';
import { apiService } from '../../services/apiService';
import { LayoutDashboard, Plug, GitCompareArrows, Package, ShoppingCart, DollarSign, BellRing, History, Download, Settings, Menu, X, Building2 } from 'lucide-react';

type IconType = React.ComponentType<{ className?: string }>;

interface SidebarProps {
  activeModule: string;
  onNavigate: (module: string) => void;
  alertCount: number;
}

const ICON_MAP: Record<string, IconType> = {
  LayoutDashboard,
  Plug,
  GitCompareArrows,
  Package,
  ShoppingCart,
  DollarSign,
  BellRing,
  History,
  Download,
  Settings,
};

export const Sidebar: React.FC<SidebarProps> = ({ activeModule, onNavigate, alertCount }) => {
  const { refreshTrigger } = useSync();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [company, setCompany] = useState({ nome: DEFAULT_COMPANY.nome, plano: DEFAULT_COMPANY.plano });

  useEffect(() => {
    let isMounted = true;
    apiService.getCompany().then((c) => {
      if (isMounted && c) {
        setCompany({ nome: c.nome, plano: c.plano || 'Enterprise' });
      }
    });
    return () => {
      isMounted = false;
    };
  }, [refreshTrigger]);

  const handleNav = (id: string) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Toggle Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-30 rounded-lg border bg-white p-2 shadow-card dark:bg-slate-900 lg:hidden"
        title="Abrir menu"
      >
        <Menu className="h-5 w-5 text-slate-700 dark:text-slate-200" />
      </button>

      {/* Backdrop for mobile drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Navigation Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-white transition-transform duration-200 dark:bg-slate-900 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
              <GitCompareArrows className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-slate-800 dark:text-slate-100">
                API2Sheets
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                Enterprise
              </p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="btn-ghost p-1 lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Módulos da Plataforma
          </p>
          <ul className="space-y-1">
            {NAVIGATION_ITEMS.map((item) => {
              const Icon = ICON_MAP[item.icon] || LayoutDashboard;
              const isActive = activeModule === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleNav(item.id)}
                    className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon
                      className={`h-4.5 w-4.5 shrink-0 ${
                        isActive
                          ? 'text-brand-600 dark:text-brand-400'
                          : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
                      }`}
                    />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.id === 'alerts' && alertCount > 0 && (
                      <span className="rounded-full bg-danger-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                        {alertCount}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer Company Info */}
        <div className="border-t px-5 py-4">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-brand-600 dark:text-brand-400 shrink-0" />
              <div className="truncate">
                <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                  {company.nome}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {company.plano} · Operação Saudável
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
