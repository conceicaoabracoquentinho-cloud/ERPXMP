export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export function formatPercent(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals).replace('.', ',')}%`;
}

export function formatDate(dateIso: string | null | undefined): string {
  if (!dateIso) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateIso));
  } catch {
    return dateIso;
  }
}

export function formatTime(dateIso: string | null | undefined): string {
  if (!dateIso) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateIso));
  } catch {
    return dateIso;
  }
}

export function formatDurationMs(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  const seconds = (durationMs / 1000).toFixed(1);
  return `${seconds}s`;
}
