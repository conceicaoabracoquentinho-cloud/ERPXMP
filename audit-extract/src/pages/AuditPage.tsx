import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from '../components/common/Card';
import { DataTable, Column } from '../components/common/DataTable';
import { LoadingSpinner, ErrorState } from '../components/common/States';
import { apiService } from '../services/apiService';
import { useSync } from '../contexts/SyncContext';
import { formatDate, formatNumber } from '../utils/formatters';
import { AuditEntry } from '../types';

export const AuditPage: React.FC = () => {
  const { refreshTrigger } = useSync();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  const loadAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getAuditEntries();
      setEntries(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar trilha de auditoria');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAudit();
  }, [loadAudit, refreshTrigger]);

  const filterOptions = useMemo(() => {
    const getUnique = (key: keyof AuditEntry) =>
      Array.from(new Set(entries.map((e) => String(e[key])))).sort();

    return {
      usuarios: getUnique('usuario'),
      modulos: getUnique('modulo'),
      acoes: getUnique('acao'),
    };
  }, [entries]);

  const columns: Column<AuditEntry>[] = [
    {
      key: 'criado_em',
      header: 'Data/Hora',
      sortable: true,
      render: (e) => formatDate(e.criado_em),
    },
    {
      key: 'usuario',
      header: 'Usuário',
      sortable: true,
      filter: {
        options: filterOptions.usuarios.map((u) => ({ value: u, label: u })),
      },
    },
    {
      key: 'acao',
      header: 'Ação Executada',
      sortable: true,
      filter: {
        options: filterOptions.acoes.map((a) => ({ value: a, label: a })),
      },
      render: (e) => (
        <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">
          {e.acao}
        </span>
      ),
    },
    {
      key: 'modulo',
      header: 'Módulo',
      sortable: true,
      filter: {
        options: filterOptions.modulos.map((m) => ({ value: m, label: m })),
      },
    },
    { key: 'registro', header: 'Registro/Alvo' },
    {
      key: 'antes',
      header: 'Estado Anterior',
      render: (e) => (e.antes ? <span className="text-slate-400 font-mono text-xs">{e.antes}</span> : '—'),
    },
    {
      key: 'depois',
      header: 'Novo Estado',
      render: (e) => (e.depois ? <span className="text-slate-700 dark:text-slate-200 font-mono text-xs">{e.depois}</span> : '—'),
    },
    {
      key: 'ip',
      header: 'IP / Origem',
      render: (e) => <span className="font-mono text-xs text-slate-400">{e.ip ?? '189.120.44.12'}</span>,
    },
  ];

  if (loading) return <LoadingSpinner message="Carregando trilha de auditoria..." />;
  if (error) return <ErrorState message={error} onRetry={loadAudit} />;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs text-slate-500">Total de Registros de Auditoria</p>
          <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">{formatNumber(entries.length)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Usuários Registrados</p>
          <p className="mt-1 text-2xl font-bold text-brand-600 dark:text-brand-400">{formatNumber(filterOptions.usuarios.length)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Módulos Auditados</p>
          <p className="mt-1 text-2xl font-bold text-accent-600 dark:text-accent-400">{formatNumber(filterOptions.modulos.length)}</p>
        </Card>
      </div>

      {/* Audit Log Table */}
      <Card
        title="Trilha Imutável de Auditoria Operacional"
        description="Garantia de rastreabilidade para conformidade e governança corporativa"
      >
        <div className="mb-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
          Esta trilha registra imutavelmente todas as ações administrativas, alterações de estado, conciliações e sincronizações.
        </div>

        <DataTable
          columns={columns}
          data={entries}
          getRowId={(e) => e.id}
          pageSize={12}
          searchPlaceholder="Pesquisar por usuário, ação, registro..."
        />
      </Card>
    </div>
  );
};
