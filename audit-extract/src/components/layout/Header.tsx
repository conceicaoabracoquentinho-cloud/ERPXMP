import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useSync } from '../../contexts/SyncContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { DEFAULT_COMPANY } from '../../config/constants';
import { apiService } from '../../services/apiService';
import { Product, Order, Connection, Alert, SystemUser } from '../../types';
import { matchSearchTerm } from '../../utils/normalizers';
import { Search, RefreshCw, Bell, Circle as HelpCircle, Sun, Moon, Building2, Loader as Loader2, Package, ShoppingCart, Plug, BellRing, X, BookOpen, UserCheck, CheckCheck, User, ShieldCheck, FileText, Keyboard, FileSliders as Sliders, ChevronRight, Sparkles } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  alertCount: number;
  onNavigate?: (module: string, entityId?: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, alertCount, onNavigate }) => {
  const { theme, toggleTheme } = useTheme();
  const { triggerSyncAll, isSyncingAll, refreshTrigger, notifyDataChanged } = useSync();
  const toast = useToast();

  // Company state
  const [companyName, setCompanyName] = useState(DEFAULT_COMPANY.nome);

  useEffect(() => {
    let isMounted = true;
    apiService.getCompany().then((c) => {
      if (isMounted && c && c.nome) {
        setCompanyName(c.nome);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [refreshTrigger]);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const [searchResults, setSearchResults] = useState<{
    products: Product[];
    orders: Order[];
    connections: Connection[];
    alerts: Alert[];
    users: SystemUser[];
    companyMatches: boolean;
  }>({
    products: [],
    orders: [],
    connections: [],
    alerts: [],
    users: [],
    companyMatches: false,
  });

  // Notifications state
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activeAlertsList, setActiveAlertsList] = useState<Alert[]>([]);
  const [resolvingNotifications, setResolvingNotifications] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Profile Popover state
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Help Modal state
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  // Close overlays on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global Keyboard Shortcuts (Cmd/Ctrl+K, '/', Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setProfileOpen(false);
        setHelpModalOpen(false);
        setMobileSearchOpen(false);
      }

      const activeElem = document.activeElement;
      const isInput =
        activeElem instanceof HTMLInputElement ||
        activeElem instanceof HTMLTextAreaElement ||
        (activeElem as HTMLElement)?.isContentEditable;

      if ((e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) && !isInput) {
        e.preventDefault();
        setMobileSearchOpen(true);
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Live search calculation with debounce & race-condition protection
  useEffect(() => {
    let isCancelled = false;

    if (!searchTerm.trim()) {
      setSearchResults({
        products: [],
        orders: [],
        connections: [],
        alerts: [],
        users: [],
        companyMatches: false,
      });
      setSearchOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const currentQuery = searchTerm;
        const [prods, ords, conns, alrts, usrs, comp] = await Promise.all([
          apiService.getProducts(),
          apiService.getOrders(),
          apiService.getConnections(),
          apiService.getAlerts(),
          apiService.getUsers(),
          apiService.getCompany(),
        ]);

        if (isCancelled) return;

        const matchedProducts = prods
          .filter(
            (p) =>
              matchSearchTerm(p.sku, currentQuery) ||
              matchSearchTerm(p.codigo_erp, currentQuery) ||
              matchSearchTerm(p.titulo, currentQuery) ||
              matchSearchTerm(p.ean, currentQuery) ||
              matchSearchTerm(p.marca, currentQuery) ||
              matchSearchTerm(p.fornecedor, currentQuery) ||
              matchSearchTerm(p.categoria, currentQuery)
          )
          .slice(0, 5);

        const matchedOrders = ords
          .filter(
            (o) =>
              matchSearchTerm(o.numero, currentQuery) ||
              matchSearchTerm(o.codigo_erp, currentQuery) ||
              matchSearchTerm(o.cliente, currentQuery) ||
              matchSearchTerm(o.marketplace, currentQuery) ||
              matchSearchTerm(o.cliente_documento, currentQuery)
          )
          .slice(0, 5);

        const matchedConnections = conns
          .filter(
            (c) =>
              matchSearchTerm(c.nome, currentQuery) ||
              matchSearchTerm(c.fornecedor, currentQuery) ||
              matchSearchTerm(c.tipo, currentQuery)
          )
          .slice(0, 5);

        const matchedAlerts = alrts
          .filter(
            (a) =>
              matchSearchTerm(a.titulo, currentQuery) ||
              matchSearchTerm(a.mensagem, currentQuery) ||
              matchSearchTerm(a.modulo, currentQuery) ||
              matchSearchTerm(a.origem, currentQuery)
          )
          .slice(0, 5);

        const matchedUsers = usrs
          .filter(
            (u) =>
              matchSearchTerm(u.nome, currentQuery) ||
              matchSearchTerm(u.email, currentQuery) ||
              matchSearchTerm(u.papel, currentQuery)
          )
          .slice(0, 3);

        const companyMatches = comp
          ? matchSearchTerm(comp.nome, currentQuery) ||
            matchSearchTerm(comp.razao_social, currentQuery) ||
            matchSearchTerm(comp.cnpj, currentQuery) ||
            matchSearchTerm(comp.email, currentQuery)
          : false;

        if (!isCancelled) {
          setSearchResults({
            products: matchedProducts,
            orders: matchedOrders,
            connections: matchedConnections,
            alerts: matchedAlerts,
            users: matchedUsers,
            companyMatches,
          });
          setSearchOpen(true);
        }
      } catch {
        // Fallback silently
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm]);

  const loadNotifications = async () => {
    try {
      const alrts = await apiService.getAlerts();
      setActiveAlertsList(alrts.filter((a) => a.status !== 'resolvido').slice(0, 8));
    } catch {
      // Fallback
    }
  };

  const handleToggleNotifications = () => {
    if (!notificationsOpen) {
      loadNotifications();
    }
    setNotificationsOpen(!notificationsOpen);
  };

  const handleResolveAllNotifications = async () => {
    setResolvingNotifications(true);
    try {
      const alrts = await apiService.getAlerts();
      const unresolved = alrts.filter((a) => a.status !== 'resolvido');
      
      for (const a of unresolved) {
        await apiService.resolveAlert(a.id, 'Todas resolvidas pelo painel do Header');
      }

      await apiService.insertAudit({
        usuario: 'Carlos Eduardo Santos',
        modulo: 'Notificações',
        acao: 'Resolução em Lote',
        registro: 'Notificações',
        antes: `${unresolved.length} ativas`,
        depois: 'Todas resolvidas',
      });

      toast.success('Todas as ocorrências ativas foram marcadas como resolvidas!');
      setActiveAlertsList([]);
      setNotificationsOpen(false);
      notifyDataChanged();
    } catch {
      toast.error('Erro ao resolver ocorrências.');
    } finally {
      setResolvingNotifications(false);
    }
  };

  const totalResultsCount =
    searchResults.products.length +
    searchResults.orders.length +
    searchResults.connections.length +
    searchResults.alerts.length +
    searchResults.users.length +
    (searchResults.companyMatches ? 1 : 0);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-white/85 px-4 backdrop-blur-md dark:bg-slate-900/85 lg:px-6">
        {/* Title & Subtitle */}
        <div className="ml-12 lg:ml-0 flex-1 min-w-0">
          <h1 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {/* Global Search Input (Desktop & Tablet) */}
        <div ref={searchRef} className="relative hidden md:block">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => {
                if (searchTerm.trim()) setSearchOpen(true);
              }}
              placeholder="Pesquisar em toda a operação (SKU, Pedido, Cliente...)"
              className="input-base w-72 lg:w-96 pl-9 pr-14 text-xs shadow-sm focus:w-80 lg:focus:w-[28rem] transition-all"
            />
            {searchTerm ? (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                /
              </span>
            )}
          </div>

          {/* Search Dropdown Overlay */}
          {searchOpen && (
            <div className="absolute right-0 left-0 top-full mt-2 z-50 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-slide-in">
              {totalResultsCount === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                  Nenhum registro localizado para "<strong className="text-slate-700 dark:text-slate-200">{searchTerm}</strong>".
                </div>
              ) : (
                <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                  {/* Company Match */}
                  {searchResults.companyMatches && (
                    <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-2.5 dark:border-brand-900/50 dark:bg-brand-950/40">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> Empresa Mestre
                      </p>
                      <button
                        onClick={() => {
                          setSearchOpen(false);
                          setSearchTerm('');
                          onNavigate?.('settings', 'company');
                        }}
                        className="flex w-full items-center justify-between rounded-lg p-2 text-left hover:bg-white dark:hover:bg-slate-800 transition-colors"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                            {companyName}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            Dados Cadastrais & CNPJ Mestre
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </button>
                    </div>
                  )}

                  {/* Products Matches */}
                  {searchResults.products.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5 text-brand-500" /> Catálogo de Produtos ({searchResults.products.length})
                      </p>
                      <div className="space-y-1">
                        {searchResults.products.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setSearchOpen(false);
                              setSearchTerm('');
                              onNavigate?.('products', p.id);
                            }}
                            className="flex w-full items-center justify-between rounded-xl p-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors group"
                          >
                            <div className="truncate pr-2">
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400">
                                {p.titulo}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                                <span>SKU: {p.sku}</span>
                                <span>·</span>
                                <span>ERP: {p.codigo_erp}</span>
                              </p>
                            </div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 shrink-0 font-mono">
                              R$ {Number(p.preco).toFixed(2)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Orders Matches */}
                  {searchResults.orders.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <ShoppingCart className="h-3.5 w-3.5 text-success-500" /> Pedidos de Venda ({searchResults.orders.length})
                      </p>
                      <div className="space-y-1">
                        {searchResults.orders.map((o) => (
                          <button
                            key={o.id}
                            onClick={() => {
                              setSearchOpen(false);
                              setSearchTerm('');
                              onNavigate?.('orders', o.id);
                            }}
                            className="flex w-full items-center justify-between rounded-xl p-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors group"
                          >
                            <div>
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 font-mono group-hover:text-brand-600 dark:group-hover:text-brand-400">
                                {o.numero}
                              </p>
                              <p className="text-[10px] text-slate-400">{o.cliente} · {o.marketplace}</p>
                            </div>
                            <span className="text-xs font-bold text-success-600 dark:text-success-400 shrink-0 font-mono">
                              R$ {Number(o.valor).toFixed(2)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Connections Matches */}
                  {searchResults.connections.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Plug className="h-3.5 w-3.5 text-sky-500" /> Integrações & Canais ({searchResults.connections.length})
                      </p>
                      <div className="space-y-1">
                        {searchResults.connections.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setSearchOpen(false);
                              setSearchTerm('');
                              onNavigate?.('connections', c.id);
                            }}
                            className="flex w-full items-center justify-between rounded-xl p-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                          >
                            <div>
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                {c.nome}
                              </p>
                              <p className="text-[10px] text-slate-400">{c.fornecedor} · {c.tipo}</p>
                            </div>
                            <span className="text-[10px] font-bold uppercase text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                              {c.status}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Alerts Matches */}
                  {searchResults.alerts.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <BellRing className="h-3.5 w-3.5 text-danger-500" /> Ocorrências & Alertas ({searchResults.alerts.length})
                      </p>
                      <div className="space-y-1">
                        {searchResults.alerts.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => {
                              setSearchOpen(false);
                              setSearchTerm('');
                              onNavigate?.('alerts', a.id);
                            }}
                            className="flex w-full items-center justify-between rounded-xl p-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                          >
                            <div className="truncate pr-2">
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                                {a.titulo}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">{a.mensagem}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Users Matches */}
                  {searchResults.users.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-indigo-500" /> Usuários do Sistema ({searchResults.users.length})
                      </p>
                      <div className="space-y-1">
                        {searchResults.users.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => {
                              setSearchOpen(false);
                              setSearchTerm('');
                              onNavigate?.('settings', u.id);
                            }}
                            className="flex w-full items-center justify-between rounded-xl p-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                          >
                            <div>
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                {u.nome}
                              </p>
                              <p className="text-[10px] text-slate-400">{u.email} · {u.papel}</p>
                            </div>
                            <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md">
                              {u.status}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile Search Icon Toggle */}
        <button
          onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
          className="btn-ghost p-2 md:hidden"
          title="Abrir Pesquisa Global"
        >
          <Search className="h-5 w-5 text-slate-600 dark:text-slate-300" />
        </button>

        {/* Actions Group */}
        <div className="ml-auto flex items-center gap-2">
          {/* Prominent Sincronizar Tudo Button */}
          <Button
            variant="primary"
            size="sm"
            onClick={triggerSyncAll}
            loading={isSyncingAll}
            icon={isSyncingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            title="Sincronizar todas as integrações cadastradas em lote"
            className="shadow-sm whitespace-nowrap"
          >
            {isSyncingAll ? 'Sincronizando...' : 'Sincronizar Tudo'}
          </Button>

          {/* Notifications Dropdown */}
          <div ref={notificationsRef} className="relative">
            <button
              onClick={handleToggleNotifications}
              className="btn-ghost relative p-2"
              title="Central de Notificações"
              aria-label="Notificações"
            >
              <Bell className="h-5 w-5 text-slate-600 dark:text-slate-300" />
              {alertCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-danger-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900 animate-pulse">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 z-50 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-slide-in">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5 mb-2.5">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <BellRing className="h-4 w-4 text-brand-600 dark:text-brand-400" /> Ocorrências Ativas ({alertCount})
                  </p>
                  <div className="flex items-center gap-2">
                    {alertCount > 0 && (
                      <button
                        onClick={handleResolveAllNotifications}
                        disabled={resolvingNotifications}
                        className="text-[10px] font-semibold text-emerald-600 hover:underline dark:text-emerald-400 flex items-center gap-1"
                        title="Resolver todas as notificações ativas"
                      >
                        {resolvingNotifications ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCheck className="h-3 w-3" />
                        )}
                        Resolver Todas
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setNotificationsOpen(false);
                        onNavigate?.('alerts');
                      }}
                      className="text-[11px] font-semibold text-brand-600 hover:underline dark:text-brand-400"
                    >
                      Ver Todas
                    </button>
                  </div>
                </div>

                {activeAlertsList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
                    <CheckCheck className="h-8 w-8 text-emerald-500 mx-auto opacity-80" />
                    <p className="font-semibold text-slate-700 dark:text-slate-200">Operação 100% Saudável</p>
                    <p>Nenhuma pendência ou inconsistência aberta no momento.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {activeAlertsList.map((al) => (
                      <div
                        key={al.id}
                        onClick={() => {
                          setNotificationsOpen(false);
                          onNavigate?.('alerts', al.id);
                        }}
                        className="group rounded-xl border border-slate-100 bg-slate-50/50 p-2.5 hover:border-brand-200 hover:bg-brand-50/40 dark:border-slate-800 dark:bg-slate-850 dark:hover:border-brand-900/50 dark:hover:bg-slate-800 cursor-pointer transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                            {al.titulo}
                          </p>
                          <span className="text-[9px] font-bold uppercase text-slate-400 font-mono">
                            {al.origem}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                          {al.mensagem}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Help & Shortcuts Button */}
          <button
            onClick={() => setHelpModalOpen(true)}
            className="btn-ghost p-2 hidden sm:flex"
            title="Central de Ajuda & Atalhos do Teclado"
          >
            <HelpCircle className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          </button>

          {/* Theme Toggle (Light / Dark) */}
          <button
            onClick={toggleTheme}
            className="btn-ghost p-2"
            title={theme === 'light' ? 'Alternar para Modo Escuro (Dark Mode)' : 'Alternar para Modo Claro (Light Mode)'}
            aria-label="Alternar Tema Claro e Escuro"
          >
            {theme === 'light' ? (
              <Moon className="h-5 w-5 text-slate-600" />
            ) : (
              <Sun className="h-5 w-5 text-amber-400" />
            )}
          </button>

          {/* User & Company Badge Dropdown */}
          <div ref={profileRef} className="relative ml-1">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 transition-colors text-left"
              title="Menu do Usuário e Perfil Mestre"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white font-bold text-xs shadow-sm">
                CE
              </div>
              <div className="hidden lg:block">
                <p className="text-xs font-bold leading-tight text-slate-800 dark:text-slate-100 truncate max-w-[120px]">
                  {companyName}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-none">
                  Carlos Eduardo
                </p>
              </div>
            </button>

            {/* Profile Popover Overlay */}
            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 z-50 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-slide-in">
                <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 mb-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white font-bold text-sm shadow-md">
                    CE
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      Carlos Eduardo Santos
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      carlos.eduardo@techcommerce.com.br
                    </p>
                    <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="h-2.5 w-2.5" /> Administrador Principal
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      onNavigate?.('settings', 'company');
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Building2 className="h-4 w-4 text-slate-400" /> Configurações da Empresa
                  </button>

                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      onNavigate?.('settings', 'users');
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                  >
                    <UserCheck className="h-4 w-4 text-slate-400" /> Usuários e Permissões (RBAC)
                  </button>

                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      onNavigate?.('audit');
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                  >
                    <FileText className="h-4 w-4 text-slate-400" /> Trilha de Auditoria Geral
                  </button>

                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      setHelpModalOpen(true);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                  >
                    <HelpCircle className="h-4 w-4 text-slate-400" /> Manual & Teclas de Atalho
                  </button>

                  <div className="border-t border-slate-100 dark:border-slate-800 my-1 pt-1">
                    <button
                      onClick={() => {
                        toggleTheme();
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        {theme === 'light' ? <Moon className="h-4 w-4 text-slate-400" /> : <Sun className="h-4 w-4 text-amber-400" />}
                        Modo Escuro
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        {theme === 'dark' ? 'Ativo' : 'Inativo'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Search Overlay Bar */}
      {mobileSearchOpen && (
        <div className="sticky top-16 z-30 border-b bg-white p-3 shadow-md dark:bg-slate-900 md:hidden animate-slide-in">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar SKU, Pedido, Cliente, Conexão..."
              className="input-base w-full pl-9 pr-9 text-xs"
            />
            <button
              onClick={() => {
                setSearchTerm('');
                setMobileSearchOpen(false);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Help Modal & Shortcuts */}
      <Modal
        open={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
        title="Central de Ajuda e Atalhos do Sistema"
        size="lg"
      >
        <div className="space-y-5 text-xs sm:text-sm">
          <div className="flex items-center gap-3 rounded-2xl bg-brand-50 p-3.5 text-brand-800 dark:bg-brand-950/60 dark:text-brand-200">
            <BookOpen className="h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
            <p>
              O <strong>API2Sheets Enterprise</strong> é a plataforma mestre de sincronização em tempo real entre ERPs, Marketplaces, Financeiro e Planilhas Google.
            </p>
          </div>

          {/* Keyboard Shortcuts List */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/60 space-y-2">
            <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <Keyboard className="h-4 w-4 text-brand-600" /> Atalhos de Teclado Suportados:
            </h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-800">
                <span className="text-slate-600 dark:text-slate-300">Focar Pesquisa Global</span>
                <kbd className="font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-900 border px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                  / ou Ctrl+K
                </kbd>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-800">
                <span className="text-slate-600 dark:text-slate-300">Fechar Janelas & Overlays</span>
                <kbd className="font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-900 border px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                  ESC
                </kbd>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-slate-800 dark:text-slate-100">Guia Rápido de Uso:</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <p className="font-bold text-slate-800 dark:text-slate-100">1. Sincronização em Lote</p>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  O botão <strong>Sincronizar Tudo</strong> atualiza estoques, faturamentos e extratos de todas as conexões cadastradas de uma só vez.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <p className="font-bold text-slate-800 dark:text-slate-100">2. Conciliação Automática</p>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  Alertas de divergência de preço e estoque são gerados automaticamente e auditados com registro imutável.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-100 dark:border-slate-800 pt-3">
            <Button variant="secondary" onClick={() => setHelpModalOpen(false)}>
              Entendido
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
