import { ExportDatasetId, ExportFormatId } from '../types';
import { formatCurrency, formatDate, formatNumber } from './formatters';

export interface ExportColumn {
  key: string;
  label: string;
  format?: (val: any, row: any) => string;
}

// Map human readable columns per dataset
export const DATASET_COLUMNS: Record<ExportDatasetId, ExportColumn[]> = {
  products: [
    { key: 'sku', label: 'SKU' },
    { key: 'ean', label: 'EAN / GTIN' },
    { key: 'codigo_erp', label: 'Código ERP' },
    { key: 'titulo', label: 'Título do Produto' },
    { key: 'categoria', label: 'Categoria' },
    { key: 'marca', label: 'Marca' },
    { key: 'fornecedor', label: 'Fornecedor' },
    { key: 'custo', label: 'Custo (R$)', format: (v) => formatCurrency(Number(v) || 0) },
    { key: 'preco', label: 'Preço ERP (R$)', format: (v) => formatCurrency(Number(v) || 0) },
    { key: 'preco_marketplace', label: 'Preço Marketplace (R$)', format: (v) => (v != null ? formatCurrency(Number(v)) : 'N/A') },
    { key: 'estoque', label: 'Estoque ERP', format: (v) => formatNumber(Number(v) || 0) },
    { key: 'estoque_marketplace', label: 'Estoque Marketplace', format: (v) => (v != null ? formatNumber(Number(v)) : 'N/A') },
    { key: 'conciliacao', label: 'Status Conciliação' },
    { key: 'marketplace', label: 'Marketplace Principal', format: (v) => v || 'Geral / ERP' },
    { key: 'ativo', label: 'Ativo', format: (v) => (v ? 'Sim' : 'Não') },
    { key: 'atualizado_em', label: 'Última Atualização', format: (v) => (v ? formatDate(v) : 'N/A') },
  ],
  orders: [
    { key: 'numero', label: 'Número do Pedido' },
    { key: 'codigo_erp', label: 'Código ERP', format: (v) => v || 'Pendente' },
    { key: 'marketplace', label: 'Marketplace / Canal' },
    { key: 'cliente', label: 'Cliente' },
    { key: 'valor', label: 'Valor Total (R$)', format: (v) => formatCurrency(Number(v) || 0) },
    { key: 'frete', label: 'Frete (R$)', format: (v) => formatCurrency(Number(v) || 0) },
    { key: 'comissao', label: 'Comissão (R$)', format: (v) => formatCurrency(Number(v) || 0) },
    { key: 'status', label: 'Status Pedido' },
    { key: 'pagamento', label: 'Forma de Pagamento' },
    { key: 'transportadora', label: 'Transportadora' },
    { key: 'conciliacao', label: 'Conciliação' },
    { key: 'data', label: 'Data do Pedido', format: (v) => formatDate(v) },
  ],
  finance: [
    { key: 'id', label: 'ID Lançamento' },
    { key: 'pedido', label: 'Pedido Associado', format: (v) => v || 'Lançamento Avulso' },
    { key: 'tipo', label: 'Tipo de Lançamento' },
    { key: 'valor', label: 'Valor Bruto (R$)', format: (v) => formatCurrency(Number(v) || 0) },
    { key: 'comissao', label: 'Comissão Retida (R$)', format: (v) => formatCurrency(Number(v) || 0) },
    { key: 'margem', label: 'Margem Líquida (%)', format: (v) => `${Number(v || 0).toFixed(1)}%` },
    { key: 'origem', label: 'Canal de Origem' },
    { key: 'data', label: 'Data da Transação', format: (v) => formatDate(v) },
  ],
  alerts: [
    { key: 'id', label: 'ID Alerta' },
    { key: 'titulo', label: 'Título do Alerta' },
    { key: 'severidade', label: 'Severidade' },
    { key: 'status', label: 'Status' },
    { key: 'modulo', label: 'Módulo' },
    { key: 'origem', label: 'Canal / Origem' },
    { key: 'impacto_financeiro', label: 'Risco Financeiro (R$)', format: (v) => formatCurrency(Number(v) || 0) },
    { key: 'mensagem', label: 'Descrição da Ocorrência' },
    { key: 'sugestao', label: 'Sugestão de Correção', format: (v) => v || 'N/A' },
    { key: 'responsavel', label: 'Resolvido Por', format: (v) => v || 'Pendente' },
    { key: 'criado_em', label: 'Data Detecção', format: (v) => formatDate(v) },
  ],
  conciliation: [
    { key: 'numero', label: 'Pedido / Item' },
    { key: 'marketplace', label: 'Marketplace' },
    { key: 'cliente', label: 'Cliente / Parceiro' },
    { key: 'valor', label: 'Valor Esperado (R$)', format: (v) => formatCurrency(Number(v) || 0) },
    { key: 'comissao', label: 'Taxa Cobrada (R$)', format: (v) => formatCurrency(Number(v) || 0) },
    { key: 'conciliacao', label: 'Status de Conciliação' },
    { key: 'status', label: 'Status Operacional' },
    { key: 'data', label: 'Data da Operação', format: (v) => formatDate(v) },
  ],
  audit: [
    { key: 'id', label: 'ID Log' },
    { key: 'usuario', label: 'Usuário' },
    { key: 'acao', label: 'Ação Executada' },
    { key: 'modulo', label: 'Módulo Afetado' },
    { key: 'registro', label: 'Registro / Detalhes' },
    { key: 'antes', label: 'Estado Anterior', format: (v) => v || '-' },
    { key: 'depois', label: 'Estado Atual', format: (v) => v || '-' },
    { key: 'ip', label: 'Endereço IP', format: (v) => v || 'N/A' },
    { key: 'criado_em', label: 'Data e Hora', format: (v) => formatDate(v) },
  ],
  connections: [
    { key: 'nome', label: 'Nome da Conexão' },
    { key: 'fornecedor', label: 'Plataforma / Fornecedor' },
    { key: 'tipo', label: 'Tipo de Conexão' },
    { key: 'status', label: 'Status de Integração' },
    { key: 'autenticacao', label: 'Método Autenticação' },
    { key: 'registros', label: 'Registros Sincronizados', format: (v) => formatNumber(Number(v) || 0) },
    { key: 'tempo_resposta_ms', label: 'Latência (ms)', format: (v) => `${v} ms` },
    { key: 'ultima_sincronizacao', label: 'Última Sync', format: (v) => (v ? formatDate(v) : 'Nunca') },
    { key: 'ativo', label: 'Ativo', format: (v) => (v ? 'Sim' : 'Não') },
  ],
};

/**
 * Format raw objects according to dataset column mappings
 */
export function mapDataForExport(datasetId: ExportDatasetId, rawData: any[]): Record<string, any>[] {
  const cols = DATASET_COLUMNS[datasetId];
  if (!cols) return rawData;

  return rawData.map((row) => {
    const formattedRow: Record<string, any> = {};
    cols.forEach((col) => {
      const val = row[col.key];
      formattedRow[col.label] = col.format ? col.format(val, row) : val ?? '';
    });
    return formattedRow;
  });
}

/**
 * Escape CSV string according to RFC-4180
 */
function escapeCSVField(val: any): string {
  if (val == null) return '""';
  let str = String(val);
  // Prevent CSV formula injection: prefix dangerous chars with a single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate UTF-8 CSV Blob with BOM (\uFEFF) for Excel compatibility
 */
export function generateCSVBlob(mappedData: Record<string, any>[]): { blob: Blob; text: string } {
  if (mappedData.length === 0) {
    const text = '\uFEFFNenhum registro encontrado\n';
    return { blob: new Blob([text], { type: 'text/csv;charset=utf-8;' }), text };
  }

  const headers = Object.keys(mappedData[0]);
  const headerLine = headers.map(escapeCSVField).join(',');

  const rows = mappedData.map((row) =>
    headers.map((h) => escapeCSVField(row[h])).join(',')
  );

  const csvContent = '\uFEFF' + [headerLine, ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  return { blob, text: csvContent };
}

/**
 * Generate formatted JSON Blob
 */
export function generateJSONBlob(rawData: any[]): { blob: Blob; text: string } {
  const jsonContent = JSON.stringify(rawData, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  return { blob, text: jsonContent };
}

/**
 * Generate XML Spreadsheet 2003 (.xlsx) Blob compatible with Microsoft Excel, Calc, etc.
 */
export function generateXLSXBlob(mappedData: Record<string, any>[], title: string): { blob: Blob; text: string } {
  if (mappedData.length === 0) {
    const fallbackText = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Sheet1"><Table><Row><Cell><Data ss:Type="String">Sem Registros</Data></Cell></Row></Table></Worksheet></Workbook>`;
    return { blob: new Blob([fallbackText], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), text: fallbackText };
  }

  const headers = Object.keys(mappedData[0]);

  const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="HeaderStyle">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="DataStyle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${title.replace(/[^\w\s]/gi, '')}">
  <Table>`;

  const headerRowXml = `
   <Row ss:Height="25">
    ${headers.map((h) => `<Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join('')}
   </Row>`;

  const dataRowsXml = mappedData
    .map(
      (row) => `
   <Row ss:Height="20">
    ${headers
      .map((h) => {
        const val = row[h];
        const isNum = typeof val === 'number';
        const type = isNum ? 'Number' : 'String';
        return `<Cell ss:StyleID="DataStyle"><Data ss:Type="${type}">${escapeXml(String(val ?? ''))}</Data></Cell>`;
      })
      .join('')}
   </Row>`
    )
    .join('');

  const xmlFooter = `
  </Table>
 </Worksheet>
</Workbook>`;

  const fullXml = xmlHeader + headerRowXml + dataRowsXml + xmlFooter;
  const blob = new Blob([fullXml], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  return { blob, text: fullXml };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate PDF Printable Document / HTML Document Blob
 */
export function generatePDFDocumentHTML(
  mappedData: Record<string, any>[],
  datasetName: string,
  title: string
): string {
  const now = new Date().toLocaleString('pt-BR');
  const headers = mappedData.length > 0 ? Object.keys(mappedData[0]) : [];

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório - ${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 20px; color: #1e293b; font-size: 12px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px; }
    .header h1 { margin: 0; font-size: 18px; color: #0f172a; }
    .header p { margin: 2px 0 0; font-size: 11px; color: #64748b; }
    .badge { background: #e0f2fe; color: #0369a1; padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 11px; }
    .summary { display: flex; gap: 16px; margin-bottom: 16px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; }
    .summary-item { font-size: 11px; }
    .summary-item strong { color: #0f172a; display: block; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
    th { background-color: #1e293b; color: white; text-align: left; padding: 8px; font-weight: 600; border: 1px solid #1e293b; }
    td { padding: 6px 8px; border: 1px solid #cbd5e1; vertical-align: top; }
    tr:nth-child(even) { background-color: #f8fafc; }
    .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; pt: 8px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>API2Sheets — Relatório de Governância</h1>
      <p>Conjunto de Dados: <strong>${datasetName}</strong> | Gerado em: ${now}</p>
    </div>
    <div class="badge">Oficial & Auditado</div>
  </div>

  <div class="summary">
    <div class="summary-item">Total de Registros: <strong>${mappedData.length}</strong></div>
    <div class="summary-item">Ambiente: <strong>Produção (Cloud Run)</strong></div>
    <div class="summary-item">Trilha de Auditoria: <strong>Ativa (100% Rastreável)</strong></div>
  </div>

  ${
    mappedData.length === 0
      ? '<p>Nenhum registro encontrado para exportação neste conjunto de dados.</p>'
      : `
    <table>
      <thead>
        <tr>
          ${headers.map((h) => `<th>${escapeXml(h)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${mappedData
          .map(
            (row) => `
          <tr>
            ${headers.map((h) => `<td>${escapeXml(String(row[h] ?? ''))}</td>`).join('')}
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `
  }

  <div class="footer">
    <span>Documento gerado por API2Sheets ERP Connector & Multi-Marketplace Sync Engine</span>
    <span>Página 1 de 1</span>
  </div>
</body>
</html>
  `;
}

/**
 * Trigger browser file download directly from Blob
 */
export function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
