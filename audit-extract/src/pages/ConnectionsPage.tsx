import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { DataTable, Column } from '../components/common/DataTable';
import { LoadingSpinner, ErrorState, EmptyState } from '../components/common/States';
import { apiService } from '../services/apiService';
import { SyncService } from '../services/syncService';
import { useToast } from '../contexts/ToastContext';
import { useSync } from '../contexts/SyncContext';
import { Plug, RefreshCw, Power, Pencil, Trash2, Zap, CircleCheck as CheckCircle2, OctagonAlert as AlertOctagon, Eye, EyeOff, Key, Lock, ShieldCheck, Search, Activity, Server, Database, Clock, ExternalLink } from 'lucide-react';
import {
  formatDate,
  formatNumber,
  formatDurationMs,
} from '../utils/formatters';
import {
  STATUS_CONNECTION_CONFIG,
  CONNECTION_TYPE_LABELS,
} from '../config/constants';
import { Connection, SyncHistory, ConnectionType, AuthMethod, HttpMethod } from '../types';
import { useAuditContext } from '../hooks/useAuditContext';

const INITIAL_FORM: Omit<Connection, 'id' | 'empresa_id' | 'status' | 'registros' | 'tempo_resposta_ms' | 'ultima_sincronizacao'> = {
  nome: '',
  tipo: 'marketplace',
  fornecedor: '',
  url: '',
  metodo: 'GET',
  autenticacao: 'Bearer',
  intervalo_min: 15,
  ativo: true,
};

interface ConnectionsPageProps {
  initialSelectedId?: string | null;
}

export const ConnectionsPage: React.FC<ConnectionsPageProps> = ({ initialSelectedId }) => {
  const toast = useToast();
  const { refreshTrigger, notifyDataChanged, triggerSyncAll, isSyncingAll } = useSync();
  const auditCtx = useAuditContext();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);

  // Search and Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // Action states
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [quickTestingId, setQuickTestingId] = useState<string | null>(null);
  const [viewConnection, setViewConnection] = useState<Connection | null>(null);
  const [viewHistoryItem, setViewHistoryItem] = useState<SyncHistory | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [credentialInput, setCredentialInput] = useState('');
  const [showCredentialSecret, setShowCredentialSecret] = useState(false);
  const [hasExistingCredential, setHasExistingCredential] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Test inside modal
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; latencyMs: number; message: string } | null>(null);

  // Delete modal
  const [deletingConn, setDeletingConn] = useState<Connection | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadConnections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [conns, hist] = await Promise.all([
        apiService.getConnections(),
        apiService.getSyncHistory(),
      ]);
      setConnections(conns);
      setSyncHistory(hist);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar conexões');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections, refreshTrigger]);

  useEffect(() => {
    if (initialSelectedId && connections.length > 0) {
      const found = connections.find(
        (c) => c.id === initialSelectedId || c.nome.toLowerCase().includes(initialSelectedId.toLowerCase())
      );
      if (found) {
        setSearchTerm('');
        setStatusFilter('todos');
        setTypeFilter('todos');
        setViewConnection(found);
      }
    }
  }, [initialSelectedId, connections]);

  // Executive KPI summary metrics
  const metrics = useMemo(() => {
    const total = connections.length;
    const ativas = connections.filter((c) => c.ativo).length;
    const avgLatency = total > 0 ? Math.round(connections.reduce((acc, c) => acc + c.tempo_resposta_ms, 0) / total) : 0;
    const totalRecords = connections.reduce((acc, c) => acc + c.registros, 0);
    return { total, ativas, avgLatency, totalRecords };
  }, [connections]);

  // Filtered list of connections
  const filteredConnections = useMemo(() => {
    return connections.filter((conn) => {
      const matchesSearch =
        searchTerm === '' ||
        conn.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conn.fornecedor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conn.url.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = typeFilter === 'todos' || conn.tipo === typeFilter;
      const matchesStatus =
        statusFilter === 'todos' ||
        (statusFilter === 'ativas' && conn.ativo) ||
        (statusFilter === 'inativas' && !conn.ativo) ||
        (statusFilter === 'erro' && conn.status === 'erro');

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [connections, searchTerm, typeFilter, statusFilter]);

  const handleSyncSingle = async (conn: Connection) => {
    setSyncingId(conn.id);
    try {
      const report = await SyncService.syncSingle(conn);
      if (report.status === 'sucesso') {
        toast.success(`${conn.nome} sincronizada! ${report.registrosRecebidos} registros processados.`);
      } else {
        toast.error(`Falha ao sincronizar ${conn.nome}: ${report.mensagem}`);
      }
      notifyDataChanged();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro na sincronização');
    } finally {
      setSyncingId(null);
    }
  };

  const handleQuickTest = async (conn: Connection) => {
    setQuickTestingId(conn.id);
    try {
      const res = await apiService.testConnection({ url: conn.url, fornecedor: conn.fornecedor });
      if (res.ok) {
        toast.success(`Teste OK em ${conn.nome}! Latência: ${res.latencyMs}ms.`);
        await apiService.insertAudit({
          usuario: auditCtx.usuario,
          acao: 'teste_conexao',
          modulo: 'Integrações',
          registro: conn.nome,
          antes: null,
          depois: `Conectividade OK (${res.latencyMs}ms)`,
          ip: auditCtx.ip,
          navegador: auditCtx.navegador,
        });
      } else {
        toast.error(`Falha no teste de ${conn.nome}: ${res.message}`);
      }
    } catch {
      toast.error(`Erro ao testar ${conn.nome}.`);
    } finally {
      setQuickTestingId(null);
    }
  };

  const handleToggleActive = async (conn: Connection) => {
    try {
      await apiService.toggleConnection(conn.id, !conn.ativo);
      await apiService.insertAudit({
        usuario: auditCtx.usuario,
        acao: conn.ativo ? 'desativar_conexao' : 'ativar_conexao',
        modulo: 'Integrações',
        registro: conn.nome,
        antes: conn.ativo ? 'Ativo' : 'Inativo',
        depois: conn.ativo ? 'Inativo' : 'Ativo',
        ip: auditCtx.ip,
        navegador: auditCtx.navegador,
      });
      toast.success(conn.ativo ? 'Conexão desativada com sucesso.' : 'Conexão ativada com sucesso.');
      notifyDataChanged();
    } catch {
      toast.error('Erro ao alterar status da conexão.');
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setCredentialInput('');
    setShowCredentialSecret(false);
    setHasExistingCredential(false);
    setFormError(null);
    setTestResult(null);
    setIsModalOpen(true);
  };

  const openEditModal = (conn: Connection) => {
    setEditingId(conn.id);
    setForm({
      nome: conn.nome,
      tipo: conn.tipo,
      fornecedor: conn.fornecedor,
      url: conn.url,
      metodo: conn.metodo,
      autenticacao: conn.autenticacao,
      intervalo_min: conn.intervalo_min,
      ativo: conn.ativo,
    });
    setCredentialInput('');
    setShowCredentialSecret(false);
    setHasExistingCredential(Boolean(conn.token_sec || conn.autenticacao !== 'Nenhuma'));
    setFormError(null);
    setTestResult(null);
    setIsModalOpen(true);
    setViewConnection(null);
  };

  const validateForm = () => {
    if (!form.nome.trim()) {
      setFormError('Nome da conexão é obrigatório.');
      return false;
    }
    if (!form.fornecedor.trim()) {
      setFormError('Fornecedor é obrigatório.');
      return false;
    }
    try {
      new URL(form.url);
    } catch {
      setFormError('URL inválida. Informe uma URL completa (ex: https://api.exemplo.com).');
      return false;
    }
    if (form.intervalo_min < 1) {
      setFormError('O intervalo mínimo de sincronização deve ser de 1 minuto.');
      return false;
    }
    setFormError(null);
    return true;
  };

  const handleSaveConnection = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const payload: Partial<Connection> = {
        ...form,
      };

      if (credentialInput.trim()) {
        payload.token_sec = credentialInput.trim();
      } else if (!editingId && form.autenticacao !== 'Nenhuma') {
        setFormError('Credencial de autenticação é obrigatória para novas conexões com autenticação.');
        setSubmitting(false);
        return;
      }

      if (editingId) {
        await apiService.updateConnection(editingId, payload);
        await apiService.insertAudit({
          usuario: auditCtx.usuario,
          acao: 'editar_conexao',
          modulo: 'Integrações',
          registro: form.nome,
          antes: null,
          depois: credentialInput.trim() ? 'Configuração e credenciais atualizadas' : 'Configuração atualizada (credenciais preservadas)',
          ip: auditCtx.ip,
          navegador: auditCtx.navegador,
        });
        toast.success('Conexão atualizada com sucesso.');
      } else {
        await apiService.createConnection(payload as Omit<Connection, 'id' | 'empresa_id'>);
        await apiService.insertAudit({
          usuario: auditCtx.usuario,
          acao: 'criar_conexao',
          modulo: 'Integrações',
          registro: form.nome,
          antes: null,
          depois: 'Nova conexão cadastrada com credencial criptografada',
          ip: auditCtx.ip,
          navegador: auditCtx.navegador,
        });
        toast.success('Nova conexão cadastrada com sucesso.');
      }
      setIsModalOpen(false);
      notifyDataChanged();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar conexão.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestConnectionModal = async () => {
    if (!form.url) {
      setFormError('Informe a URL para testar.');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiService.testConnection({ url: form.url, fornecedor: form.fornecedor });
      setTestResult(res);
    } finally {
      setTesting(false);
    }
  };

  const handleDeleteConnection = async (conn: Connection) => {
    if (syncingId === conn.id || conn.status === 'sincronizando') {
      toast.error(`A conexão "${conn.nome}" está sincronizando no momento. Aguarde o término para excluir.`);
      setDeletingConn(null);
      return;
    }

    setDeleting(true);
    try {
      await apiService.deleteConnection(conn.id);
      await apiService.insertAudit({
        usuario: auditCtx.usuario,
        acao: 'excluir_conexao',
        modulo: 'Integrações',
        registro: conn.nome,
        antes: conn.nome,
        depois: 'Conexão removida do sistema',
        ip: auditCtx.ip,
        navegador: auditCtx.navegador,
      });
      toast.success(`Conexão "${conn.nome}" excluída com sucesso.`);
      setDeletingConn(null);
      if (viewConnection?.id === conn.id) {
        setViewConnection(null);
      }
      notifyDataChanged();
    } catch {
      toast.error('Erro ao excluir conexão.');
    } finally {
      setDeleting(false);
    }
  };

  const historyColumns: Column<SyncHistory>[] = [
    { key: 'conexao_nome', header: 'Conexão', sortable: true, className: 'font-semibold text-slate-800 dark:text-slate-100' },
    { key: 'inicio', header: 'Início', sortable: true, render: (h) => formatDate(h.inicio) },
    { key: 'duracao_ms', header: 'Duração', render: (h) => formatDurationMs(h.duracao_ms) },
    { key: 'registros_recebidos', header: 'Lidos', render: (h) => formatNumber(h.registros_recebidos) },
    { key: 'registros_alterados', header: 'Alterados', render: (h) => formatNumber(h.registros_alterados) },
    {
      key: 'erros',
      header: 'Erros',
      render: (h) => (
        <span className={h.erros > 0 ? 'font-bold text-danger-600 dark:text-danger-400' : 'text-slate-400'}>
          {h.erros}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (h) => (
        <Badge
          label={h.status === 'concluido' ? 'Concluído' : h.status === 'erro' ? 'Erro' : 'Em andamento'}
          color={
            h.status === 'concluido'
              ? 'text-success-700 dark:text-success-300 bg-success-50 dark:bg-success-950/40'
              : h.status === 'erro'
              ? 'text-danger-700 dark:text-danger-300 bg-danger-50 dark:bg-danger-950/40'
              : 'text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/40'
          }
        />
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (h) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setViewHistoryItem(h)}
          title="Ver detalhes da rotina"
          className="p-1.5"
        >
          <Eye className="h-4 w-4 text-slate-500" />
        </Button>
      ),
    },
  ];

  if (loading) return <LoadingSpinner message="Carregando matriz de integrações..." />;
  if (error) return <ErrorState message={error} onRetry={loadConnections} />;

  return (
    <div className="space-y-6">
      {/* Top Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Conexões</p>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{metrics.total}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-50 text-success-600 dark:bg-success-950 dark:text-success-400">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Integrações Ativas</p>
              <p className="text-xl font-bold text-success-600 dark:text-success-400">{metrics.ativas} de {metrics.total}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Latência Média</p>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{metrics.avgLatency} ms</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-50 text-warning-600 dark:bg-warning-950 dark:text-warning-400">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Registros Mapeados</p>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{formatNumber(metrics.totalRecords)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Header Controls Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              className="input-base pl-9 text-xs"
              placeholder="Pesquisar por nome, fornecedor ou endpoint..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Type Filter */}
          <select
            className="input-base text-xs sm:w-40"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="todos">Todos os Tipos</option>
            <option value="marketplace">Marketplaces</option>
            <option value="erp">ERPs</option>
            <option value="loja">Lojas Virtuais</option>
            <option value="transportadora">Transportadoras</option>
            <option value="pagamento">Pagamento</option>
            <option value="fiscal">Fiscal</option>
          </select>

          {/* Status Filter */}
          <select
            className="input-base text-xs sm:w-36"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="todos">Todos Status</option>
            <option value="ativas">Somente Ativas</option>
            <option value="inativas">Desativadas</option>
            <option value="erro">Com Erro</option>
          </select>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={triggerSyncAll}
            loading={isSyncingAll}
            icon={<RefreshCw className={`h-4 w-4 ${isSyncingAll ? 'animate-spin' : ''}`} />}
          >
            Sincronizar Tudo
          </Button>

          <Button variant="primary" onClick={openCreateModal} icon={<Plug className="h-4 w-4" />}>
            Nova Conexão
          </Button>
        </div>
      </div>

      {/* Connection Cards Grid */}
      {filteredConnections.length === 0 ? (
        <EmptyState
          title="Nenhuma conexão encontrada"
          description="Ajuste os filtros de busca ou cadastre uma nova integração no botão acima."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredConnections.map((conn) => {
            const statusCfg = STATUS_CONNECTION_CONFIG[conn.status] ?? STATUS_CONNECTION_CONFIG.desativado;
            const isSyncing = syncingId === conn.id;
            const isTestingQuick = quickTestingId === conn.id;

            return (
              <Card key={conn.id} hover className="flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400 shadow-sm">
                        <Plug className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{conn.nome}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {CONNECTION_TYPE_LABELS[conn.tipo] ?? conn.tipo} · {conn.fornecedor}
                        </p>
                      </div>
                    </div>
                    <Badge label={statusCfg.label} color={statusCfg.color} dot={statusCfg.dot} />
                  </div>

                  {/* Specs Grid */}
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs border-t border-b py-3 border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="text-slate-400">Registros Mapeados</p>
                      <p className="font-semibold text-slate-700 dark:text-slate-200">
                        {formatNumber(conn.registros)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Latência Média</p>
                      <p className="font-semibold text-slate-700 dark:text-slate-200">
                        {conn.tempo_resposta_ms} ms
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Última Sincronização</p>
                      <p className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                        {formatDate(conn.ultima_sincronizacao)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Recorrência</p>
                      <p className="font-semibold text-slate-700 dark:text-slate-200">
                        {conn.intervalo_min} min
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="mt-4 flex items-center gap-1.5 flex-wrap">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleSyncSingle(conn)}
                    disabled={isSyncing || !conn.ativo}
                    loading={isSyncing}
                    icon={<RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />}
                    className="flex-1 min-w-[100px]"
                  >
                    {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleQuickTest(conn)}
                    loading={isTestingQuick}
                    title="Testar Conectividade agora"
                    className="p-2"
                  >
                    <Zap className={`h-4 w-4 ${isTestingQuick ? 'animate-pulse text-warning-500' : 'text-slate-500'}`} />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditModal(conn)}
                    title="Editar configurações"
                    className="p-2 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewConnection(conn)}
                    title="Ver detalhes técnicos"
                    className="p-2 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>

                  <Button
                    variant={conn.ativo ? 'danger' : 'success'}
                    size="sm"
                    onClick={() => handleToggleActive(conn)}
                    title={conn.ativo ? 'Desativar conexão' : 'Ativar conexão'}
                    className="p-2"
                  >
                    <Power className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletingConn(conn)}
                    title="Excluir integração"
                    className="p-2 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-950/40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sync History Table */}
      <Card title="Histórico de Sincronizações Executadas" description="Registro auditado das rotinas e integrações">
        <DataTable
          columns={historyColumns}
          data={syncHistory}
          getRowId={(h) => h.id}
          pageSize={10}
          searchPlaceholder="Pesquisar histórico por nome da conexão..."
        />
      </Card>

      {/* View Details Modal */}
      <Modal
        open={!!viewConnection}
        onClose={() => setViewConnection(null)}
        title={viewConnection?.nome ?? ''}
        size="md"
        footer={
          viewConnection && (
            <div className="flex gap-2 w-full justify-between items-center">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleQuickTest(viewConnection)}
                icon={<Zap className="h-4 w-4" />}
              >
                Testar Ping
              </Button>

              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => openEditModal(viewConnection)}>
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setDeletingConn(viewConnection);
                    setViewConnection(null);
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Excluir
                </Button>
              </div>
            </div>
          )
        }
      >
        {viewConnection && (
          <div className="space-y-3 text-sm">
            <DetailRow label="ID Interno" value={<span className="font-mono text-xs">{viewConnection.id}</span>} />
            <DetailRow label="Fornecedor" value={viewConnection.fornecedor} />
            <DetailRow label="Tipo de Conexão" value={CONNECTION_TYPE_LABELS[viewConnection.tipo] ?? viewConnection.tipo} />
            <DetailRow
              label="URL Endpoint"
              value={
                <a
                  href={viewConnection.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-400 truncate max-w-xs"
                >
                  {viewConnection.url} <ExternalLink className="h-3 w-3 inline" />
                </a>
              }
            />
            <DetailRow label="Método HTTP" value={<Badge label={viewConnection.metodo} color="text-brand-700 bg-brand-50" />} />
            <DetailRow
              label="Autenticação"
              value={
                <div className="flex items-center gap-2">
                  <Badge label={viewConnection.autenticacao} color="text-slate-700 bg-slate-100 dark:text-slate-300 dark:bg-slate-800" />
                  {viewConnection.autenticacao !== 'Nenhuma' && (
                    <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                      <Lock className="h-3 w-3 text-emerald-500" /> •••••••••••• (Protegida)
                    </span>
                  )}
                </div>
              }
            />
            <DetailRow label="Status Atual" value={STATUS_CONNECTION_CONFIG[viewConnection.status]?.label ?? viewConnection.status} />
            <DetailRow label="Ativo no Sistema" value={viewConnection.ativo ? 'Sim (Ativo)' : 'Não (Desativado)'} />
            <DetailRow label="Intervalo de Recorrência" value={`${viewConnection.intervalo_min} minutos`} />
            <DetailRow label="Total de Registros" value={formatNumber(viewConnection.registros)} />
            <DetailRow label="Tempo Médio de Resposta" value={`${viewConnection.tempo_resposta_ms} ms`} />
            <DetailRow label="Última Sincronização" value={formatDate(viewConnection.ultima_sincronizacao)} />
            <DetailRow label="Data de Cadastro" value={formatDate(viewConnection.criado_em)} />
          </div>
        )}
      </Modal>

      {/* Sync History Details Modal */}
      <Modal
        open={!!viewHistoryItem}
        onClose={() => setViewHistoryItem(null)}
        title="Detalhes da Rotina de Sincronização"
        size="md"
      >
        {viewHistoryItem && (
          <div className="space-y-3 text-sm">
            <DetailRow label="ID da Sincronização" value={<span className="font-mono text-xs">{viewHistoryItem.id}</span>} />
            <DetailRow label="Conexão" value={viewHistoryItem.conexao_nome} />
            <DetailRow label="Horário de Início" value={formatDate(viewHistoryItem.inicio)} />
            <DetailRow label="Horário de Término" value={formatDate(viewHistoryItem.fim)} />
            <DetailRow label="Duração Total" value={formatDurationMs(viewHistoryItem.duracao_ms)} />
            <DetailRow label="Registros Processados" value={formatNumber(viewHistoryItem.registros_recebidos)} />
            <DetailRow label="Registros Atualizados" value={formatNumber(viewHistoryItem.registros_alterados)} />
            <DetailRow label="Ocorrências de Erro" value={viewHistoryItem.erros} />
            <DetailRow
              label="Resultado Global"
              value={
                <Badge
                  label={viewHistoryItem.status === 'concluido' ? 'Concluído com Sucesso' : 'Erro no Processamento'}
                  color={viewHistoryItem.status === 'concluido' ? 'text-success-700 bg-success-50' : 'text-danger-700 bg-danger-50'}
                />
              }
            />

            <div className="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-500 mb-1">Log de Detalhes:</p>
              <p className="text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {viewHistoryItem.detalhes || 'Sem mensagens adicionais.'}
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Create / Edit Form Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Editar Conexão' : 'Nova Conexão de Integração'}
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={handleTestConnectionModal}
              loading={testing}
              disabled={submitting}
              icon={<Zap className="h-4 w-4" />}
            >
              Testar Conexão
            </Button>
            <Button variant="primary" onClick={handleSaveConnection} loading={submitting}>
              Salvar Conexão
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="rounded-xl bg-danger-50 p-3 text-xs font-semibold text-danger-700 dark:bg-danger-950/50 dark:text-danger-300">
              {formError}
            </div>
          )}

          {testResult && (
            <div
              className={`rounded-xl p-3 text-xs font-semibold ${
                testResult.ok
                  ? 'bg-success-50 text-success-700 dark:bg-success-950/50 dark:text-success-300'
                  : 'bg-danger-50 text-danger-700 dark:bg-danger-950/50 dark:text-danger-300'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="mr-1.5 inline h-4 w-4" />
              ) : (
                <AlertOctagon className="mr-1.5 inline h-4 w-4" />
              )}
              {testResult.message} {testResult.ok && `(${testResult.latencyMs}ms)`}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Nome da Integração <span className="text-danger-500">*</span>
            </label>
            <input
              type="text"
              className="input-base text-xs"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Mercado Livre - Loja Oficial"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Tipo
              </label>
              <select
                className="input-base text-xs"
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as ConnectionType })}
              >
                <option value="marketplace">Marketplace</option>
                <option value="erp">ERP</option>
                <option value="loja">Loja Virtual</option>
                <option value="transportadora">Transportadora</option>
                <option value="pagamento">Pagamento</option>
                <option value="fiscal">Fiscal</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Fornecedor <span className="text-danger-500">*</span>
              </label>
              <input
                type="text"
                className="input-base text-xs"
                value={form.fornecedor}
                onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
                placeholder="Ex: Mercado Livre"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              URL Endpoint <span className="text-danger-500">*</span>
            </label>
            <input
              type="text"
              className="input-base text-xs"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://api.mercadolibre.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Método HTTP
              </label>
              <select
                className="input-base text-xs"
                value={form.metodo}
                onChange={(e) => setForm({ ...form, metodo: e.target.value as HttpMethod })}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Autenticação
              </label>
              <select
                className="input-base text-xs"
                value={form.autenticacao}
                onChange={(e) => setForm({ ...form, autenticacao: e.target.value as AuthMethod })}
              >
                <option value="Bearer">Bearer Token</option>
                <option value="OAuth2">OAuth 2.0</option>
                <option value="API Key">API Key</option>
                <option value="Basic">Basic Auth</option>
                <option value="Nenhuma">Nenhuma</option>
              </select>
            </div>
          </div>

          {form.autenticacao !== 'Nenhuma' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <Key className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                  Credencial de Autenticação ({form.autenticacao})
                </label>
                {editingId && hasExistingCredential && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Credencial em uso (Protegida)
                  </span>
                )}
              </div>

              {editingId && hasExistingCredential && !credentialInput && (
                <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>••••••••••••••••••••••••</span>
                  <span className="ml-auto text-[10px] text-slate-400 font-sans">(Preservada)</span>
                </div>
              )}

              <div className="relative">
                <input
                  type={showCredentialSecret ? 'text' : 'password'}
                  className="input-base text-xs pr-9 font-mono"
                  placeholder={
                    editingId && hasExistingCredential
                      ? 'Informe um novo valor para substituir a credencial atual...'
                      : 'Informe a Chave API, Bearer Token, Client Secret...'
                  }
                  value={credentialInput}
                  onChange={(e) => setCredentialInput(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowCredentialSecret(!showCredentialSecret)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title={showCredentialSecret ? 'Ocultar credencial' : 'Exibir credencial'}
                >
                  {showCredentialSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {editingId && hasExistingCredential
                  ? 'Ao deixar o campo em branco, a credencial atual é mantida intacta.'
                  : 'Sua credencial é armazenada com criptografia de ponta a ponta.'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 items-center">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Intervalo de Sincronização (min)
              </label>
              <input
                type="number"
                min={1}
                className="input-base text-xs"
                value={form.intervalo_min}
                onChange={(e) => setForm({ ...form, intervalo_min: Number(e.target.value) })}
              />
            </div>
            <div className="pt-5">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
                  checked={form.ativo}
                  onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                />
                Ativo no Cadastramento
              </label>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={!!deletingConn}
        onClose={() => setDeletingConn(null)}
        onConfirm={() => deletingConn && handleDeleteConnection(deletingConn)}
        title="Confirmar Exclusão de Conexão"
        message={
          <>
            Tem certeza que deseja excluir a conexão <span className="font-bold">{deletingConn?.nome}</span>?
            Todas as estatísticas vinculadas continuarão registradas na trilha de auditoria do sistema.
          </>
        }
        confirmLabel="Excluir Conexão"
        loading={deleting}
      />
    </div>
  );
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b pb-2 border-slate-100 dark:border-slate-800">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-semibold text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  );
}
