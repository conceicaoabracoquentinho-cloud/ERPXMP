import React, { useState, useMemo, useEffect } from 'react';
import { Search, ListFilter as Filter, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { matchSearchTerm } from '../../utils/normalizers';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  className?: string;
  filter?: {
    options: { value: string; label: string }[];
    getValue?: (item: T) => string;
  };
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  emptyMessage?: string;
  getRowId: (item: T) => string;
  onSelectionChange?: (selectedIds: string[]) => void;
  batchActions?: (selectedIds: string[]) => React.ReactNode;
}

function useDebounce<T>(value: T, delayMs: number = 250): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handler);
  }, [value, delayMs]);
  return debounced;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  searchable = true,
  searchPlaceholder = 'Pesquisar...',
  pageSize = 10,
  emptyMessage = 'Nenhum registro encontrado.',
  getRowId,
  onSelectionChange,
  batchActions,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 250);

  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [currentPage, setCurrentPage] = useState(1);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, columnFilters]);

  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(Array.from(selectedIds));
    }
  }, [selectedIds, onSelectionChange]);

  const filteredData = useMemo(() => {
    let result = data;

    // Search filter
    if (debouncedSearch.trim()) {
      result = result.filter((item) =>
        columns.some((col) => {
          const val = item[col.key as string];
          return val != null && matchSearchTerm(String(val), debouncedSearch);
        })
      );
    }

    // Column dropdown filters
    const activeFilters = Object.entries(columnFilters).filter(([, val]) => val);
    if (activeFilters.length > 0) {
      result = result.filter((item) =>
        activeFilters.every(([key, filterVal]) => {
          const col = columns.find((c) => String(c.key) === key);
          const rawVal = col?.filter?.getValue
            ? col.filter.getValue(item)
            : String(item[key] ?? '');
          return rawVal === filterVal;
        })
      );
    }

    return result;
  }, [data, debouncedSearch, columns, columnFilters]);

  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData;
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      const valA = a[sortColumn];
      const valB = b[sortColumn];

      if (valA === valB) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;

      const cmp = String(valA).localeCompare(String(valB), 'pt-BR', { numeric: true });
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredData, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, safePage, pageSize]);

  const handleSort = (key: string) => {
    if (sortColumn === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(key);
      setSortDirection('asc');
    }
  };

  const isAllPageSelected =
    paginatedData.length > 0 && paginatedData.every((item) => selectedIds.has(getRowId(item)));

  const toggleSelectAllPage = () => {
    const pageIds = paginatedData.map(getRowId);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col">
      {searchable && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="input-base pl-9 text-xs sm:text-sm"
            />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {sortedData.length} registro(s)
          </span>
        </div>
      )}

      {/* Filter Row */}
      {columns.some((c) => c.filter) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            <Filter className="h-3.5 w-3.5" /> Filtros:
          </span>
          {columns
            .filter((c) => c.filter)
            .map((col) => (
              <select
                key={String(col.key)}
                value={columnFilters[String(col.key)] ?? ''}
                onChange={(e) =>
                  setColumnFilters((prev) => {
                    const next = { ...prev };
                    if (e.target.value) {
                      next[String(col.key)] = e.target.value;
                    } else {
                      delete next[String(col.key)];
                    }
                    return next;
                  })
                }
                className="input-base w-auto py-1.5 text-xs"
              >
                <option value="">{col.header}: Todos</option>
                {col.filter!.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ))}

          {Object.keys(columnFilters).length > 0 && (
            <button
              onClick={() => setColumnFilters({})}
              className="inline-flex items-center gap-1 text-xs text-danger-600 hover:text-danger-700 dark:text-danger-400"
            >
              <X className="h-3 w-3" /> Limpar
            </button>
          )}
        </div>
      )}

      {/* Batch Selection Banner */}
      {selectedIds.size > 0 && batchActions && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border bg-brand-50 px-3.5 py-2.5 dark:bg-brand-950">
          <span className="text-xs font-medium text-brand-700 dark:text-brand-300">
            {selectedIds.size} item(ns) selecionado(s)
          </span>
          <div className="flex items-center gap-2">{batchActions(Array.from(selectedIds))}</div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
          >
            <X className="h-3 w-3" /> Limpar seleção
          </button>
        </div>
      )}

      {/* Table Element */}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left dark:bg-slate-800/60">
            <tr>
              {batchActions && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={isAllPageSelected}
                    onChange={toggleSelectAllPage}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  onClick={() => col.sortable && handleSort(String(col.key))}
                  className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${
                    col.sortable ? 'cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200' : ''
                  } ${col.className ?? ''}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortColumn === String(col.key) && (
                      <span className="text-brand-500">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (batchActions ? 1 : 0)}
                  className="px-4 py-10 text-center text-sm text-slate-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((item) => {
                const id = getRowId(item);
                const isSelected = selectedIds.has(id);
                return (
                  <tr
                    key={id}
                    className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                      isSelected ? 'bg-brand-50/60 dark:bg-brand-950/40' : ''
                    }`}
                  >
                    {batchActions && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(id)}
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={String(col.key)}
                        className={`px-4 py-3 text-slate-700 dark:text-slate-200 ${col.className ?? ''}`}
                      >
                        {col.render ? col.render(item) : String(item[col.key as string] ?? '—')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Página {safePage} de {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="btn-ghost px-2.5 py-1 disabled:opacity-40"
              title="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="btn-ghost px-2.5 py-1 disabled:opacity-40"
              title="Próxima página"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
