export function normalizeSKU(sku: string | null | undefined): string {
  if (!sku) return '';
  return sku
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
}

export function normalizeEAN(ean: string | null | undefined): string {
  if (!ean) return '';
  return ean.toString().trim().replace(/\D/g, '');
}

export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toString()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function matchSearchTerm(target: string | null | undefined, query: string): boolean {
  if (!target || !query) return false;
  const normTarget = normalizeText(target);
  const normQuery = normalizeText(query);
  if (normTarget.includes(normQuery)) return true;

  const cleanTarget = normTarget.replace(/[^a-z0-9]/g, '');
  const cleanQuery = normQuery.replace(/[^a-z0-9]/g, '');
  return cleanTarget.length > 0 && cleanQuery.length > 0 && cleanTarget.includes(cleanQuery);
}

