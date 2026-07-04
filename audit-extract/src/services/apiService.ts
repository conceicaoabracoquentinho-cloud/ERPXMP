import { supabase } from '../config/supabase';
import { DEFAULT_COMPANY } from '../config/constants';
import { IntegrationHttpClient } from '../integrations/base/httpClient';
import {
  Company,
  Connection,
  Product,
  Order,
  FinancialEntry,
  Alert,
  AuditEntry,
  SyncHistory,
  ExportHistoryEntry,
  ExportSchedule,
  SystemSettings,
  SystemUser,
  ConciliationStatus,
} from '../types';

const TENANT_ID = DEFAULT_COMPANY.id;

const DEFAULT_SETTINGS: SystemSettings = {
  autoResolveThreshold: 0.5,
  maxRetries: 3,
  timeoutSeconds: 15,
  syncIntervalMinutes: 15,
  autoConciliateEnabled: true,
  notifyEmail: true,
  notifySlack: false,
  notifyCriticalAlerts: true,
  slackWebhookUrl: '',
  idioma: 'pt-BR',
};

const DEFAULT_USERS: SystemUser[] = [
  {
    id: 'usr-01',
    nome: 'Carlos Eduardo Santos',
    email: 'carlos@techcommerce.com.br',
    papel: 'Administrador Principal',
    status: 'Ativo',
    ultimo_acesso: '2026-07-04T10:15:00Z',
  },
  {
    id: 'usr-02',
    nome: 'Luciana Ferreira',
    email: 'luciana@techcommerce.com.br',
    papel: 'Gerente de E-commerce',
    status: 'Ativo',
    ultimo_acesso: '2026-07-03T18:40:00Z',
  },
  {
    id: 'usr-03',
    nome: 'Auditoria Externa KPMG',
    email: 'auditoria@kpmg.com.br',
    papel: 'Auditor Read-Only',
    status: 'Ativo',
    ultimo_acesso: '2026-07-01T09:00:00Z',
  },
];

// In-Memory Fallback Store (Ensures 100% operational reliability even if DB tables are empty/migrating)
class MemoryDataStore {
  company: Company = (() => {
    try {
      const saved = localStorage.getItem('a2s_company');
      if (saved) return { ...DEFAULT_COMPANY, ...JSON.parse(saved) };
    } catch {
      // ignore
    }
    return { ...DEFAULT_COMPANY };
  })();

  settings: SystemSettings = (() => {
    try {
      const saved = localStorage.getItem('a2s_settings');
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {
      // ignore
    }
    return { ...DEFAULT_SETTINGS };
  })();

  users: SystemUser[] = (() => {
    try {
      const saved = localStorage.getItem('a2s_users');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [...DEFAULT_USERS];
  })();

  connections: Connection[] = [
    {
      id: 'conn-01',
      empresa_id: TENANT_ID,
      nome: 'Bling ERP - Matriz',
      tipo: 'erp',
      fornecedor: 'Bling',
      url: 'https://api.bling.com.br/v2',
      metodo: 'GET',
      autenticacao: 'API Key',
      status: 'online',
      ultima_sincronizacao: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      intervalo_min: 15,
      registros: 2500,
      tempo_resposta_ms: 120,
      ativo: true,
      criado_em: '2024-01-15T10:00:00Z',
      token_sec: 'sec_live_bling_883921049281',
    },
    {
      id: 'conn-02',
      empresa_id: TENANT_ID,
      nome: 'Mercado Livre Oficial',
      tipo: 'marketplace',
      fornecedor: 'Mercado Livre',
      url: 'https://api.mercadolibre.com',
      metodo: 'GET',
      autenticacao: 'OAuth2',
      status: 'online',
      ultima_sincronizacao: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      intervalo_min: 10,
      registros: 1850,
      tempo_resposta_ms: 350,
      ativo: true,
      criado_em: '2024-01-15T10:30:00Z',
      token_sec: 'sec_live_ml_oauth_49201948201',
    },
    {
      id: 'conn-03',
      empresa_id: TENANT_ID,
      nome: 'Shopee Brasil',
      tipo: 'marketplace',
      fornecedor: 'Shopee',
      url: 'https://partner.shopeesz.com',
      metodo: 'GET',
      autenticacao: 'API Key',
      status: 'online',
      ultima_sincronizacao: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      intervalo_min: 30,
      registros: 920,
      tempo_resposta_ms: 500,
      ativo: true,
      criado_em: '2024-02-01T08:00:00Z',
      token_sec: 'sec_live_shopee_10293847561',
    },
    {
      id: 'conn-04',
      empresa_id: TENANT_ID,
      nome: 'Amazon Seller Central',
      tipo: 'marketplace',
      fornecedor: 'Amazon',
      url: 'https://sellingpartnerapi-na.amazon.com',
      metodo: 'GET',
      autenticacao: 'OAuth2',
      status: 'online',
      ultima_sincronizacao: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      intervalo_min: 60,
      registros: 1100,
      tempo_resposta_ms: 280,
      ativo: true,
      criado_em: '2024-02-10T14:20:00Z',
      token_sec: 'sec_live_amz_lwa_99281029381',
    },
    {
      id: 'conn-05',
      empresa_id: TENANT_ID,
      nome: 'Magalu Marketplace',
      tipo: 'marketplace',
      fornecedor: 'Magazine Luiza',
      url: 'https://api.magazineluiza.com.br',
      metodo: 'GET',
      autenticacao: 'Bearer',
      status: 'online',
      ultima_sincronizacao: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      intervalo_min: 15,
      registros: 640,
      tempo_resposta_ms: 190,
      ativo: true,
      criado_em: '2024-03-01T09:15:00Z',
      token_sec: 'sec_live_magalu_bearer_55210928',
    },
  ];

  products: Product[] = [
    {
      id: 'prod-01',
      empresa_id: TENANT_ID,
      sku: 'MON-DELL-27',
      ean: '7898564120012',
      codigo_erp: 'ERP-001',
      titulo: 'Monitor Dell 27 4K UltraHD USB-C Ergonomico',
      descricao: 'Monitor profissional IPS 27 polegadas com resolução 3840x2160, hub USB-C e ajuste de altura.',
      categoria: 'Monitores',
      marca: 'Dell',
      fornecedor: 'Dell Brasil LTDA',
      custo: 1800,
      preco: 2899.9,
      preco_marketplace: 2899.9,
      preco_promocional: 2699.9,
      estoque: 45,
      estoque_marketplace: 45,
      reservado: 3,
      peso_kg: 6.8,
      largura_cm: 61,
      altura_cm: 45,
      comprimento_cm: 18,
      conciliacao: 'conciliado',
      marketplace: 'Mercado Livre',
      ativo: true,
      criado_em: '2024-01-10T08:00:00Z',
    },
    {
      id: 'prod-02',
      empresa_id: TENANT_ID,
      sku: 'TECL-LOGI-MX',
      ean: '7898564120029',
      codigo_erp: 'ERP-002',
      titulo: 'Teclado Sem Fio Logitech MX Keys Advanced',
      descricao: 'Teclado iluminação inteligente, teclas esféricas, conexão Easy-Switch para até 3 dispositivos.',
      categoria: 'Periféricos',
      marca: 'Logitech',
      fornecedor: 'Logitech do Brasil',
      custo: 380,
      preco: 699.9,
      preco_marketplace: 649.9, // Divergência de preço
      preco_promocional: null,
      estoque: 120,
      estoque_marketplace: 110, // Divergência de estoque
      reservado: 8,
      peso_kg: 0.81,
      largura_cm: 43,
      altura_cm: 13,
      comprimento_cm: 2,
      conciliacao: 'divergencia_leve',
      marketplace: 'Mercado Livre',
      ativo: true,
      criado_em: '2024-01-12T09:30:00Z',
    },
    {
      id: 'prod-03',
      empresa_id: TENANT_ID,
      sku: 'MOUSE-LOGI-MX3',
      ean: '7898564120036',
      codigo_erp: 'ERP-003',
      titulo: 'Mouse Sem Fio Logitech MX Master 3S',
      descricao: 'Mouse ergonômico com sensor Darkfield 8000 DPI, rolamento MagSpeed silencioso.',
      categoria: 'Periféricos',
      marca: 'Logitech',
      fornecedor: 'Logitech do Brasil',
      custo: 420,
      preco: 749.9,
      preco_marketplace: 749.9,
      preco_promocional: null,
      estoque: 18,
      estoque_marketplace: 0, // Divergência crítica (0 no MP)
      reservado: 2,
      peso_kg: 0.14,
      largura_cm: 8,
      altura_cm: 12,
      comprimento_cm: 5,
      conciliacao: 'divergencia_critica',
      marketplace: 'Amazon',
      ativo: true,
      criado_em: '2024-01-15T11:00:00Z',
    },
    {
      id: 'prod-04',
      empresa_id: TENANT_ID,
      sku: 'NOTE-LEN-i7',
      ean: '7898564120043',
      codigo_erp: 'ERP-004',
      titulo: 'Notebook ThinkPad i7 16GB SSD 512GB Win11 Pro',
      descricao: 'Notebook corporativo ultrafino com chassi reforçado, leitor biométrico e garantia onsite.',
      categoria: 'Notebooks',
      marca: 'Lenovo',
      fornecedor: 'Lenovo Tecnologia',
      custo: 3900,
      preco: 5899.9,
      preco_marketplace: 5899.9,
      preco_promocional: 5599.9,
      estoque: 12,
      estoque_marketplace: 12,
      reservado: 1,
      peso_kg: 1.4,
      largura_cm: 32,
      altura_cm: 22,
      comprimento_cm: 1.8,
      conciliacao: 'conciliado',
      marketplace: 'Magalu',
      ativo: true,
      criado_em: '2024-02-01T10:00:00Z',
    },
    {
      id: 'prod-05',
      empresa_id: TENANT_ID,
      sku: 'HEAD-HYPER-X',
      ean: '7898564120050',
      codigo_erp: 'ERP-005',
      titulo: 'Headset Gamer HyperX Cloud II Wireless 7.1',
      descricao: 'Headset gamer com som surround 7.1, bateria até 30 horas e microfone com cancelamento de ruído.',
      categoria: 'Áudio',
      marca: 'HyperX',
      fornecedor: 'HP Brasil',
      custo: 350,
      preco: 629.9,
      preco_marketplace: 629.9,
      preco_promocional: null,
      estoque: 60,
      estoque_marketplace: 60,
      reservado: 4,
      peso_kg: 0.3,
      largura_cm: 20,
      altura_cm: 18,
      comprimento_cm: 10,
      conciliacao: 'conciliado',
      marketplace: 'Shopee',
      ativo: true,
      criado_em: '2024-02-05T14:00:00Z',
    },
    {
      id: 'prod-06',
      empresa_id: TENANT_ID,
      sku: 'WEBC-LOGI-C920',
      ean: '7898564120067',
      codigo_erp: 'ERP-006',
      titulo: 'Webcam Logitech C920 PRO Full HD 1080p Autofoco',
      descricao: 'Webcam com vídeo Full HD de alta qualidade, microfones estéreo duplos e correção de luz.',
      categoria: 'Periféricos',
      marca: 'Logitech',
      fornecedor: 'Logitech do Brasil',
      custo: 280,
      preco: 499.9,
      preco_marketplace: 589.9, // Divergência de preço (R$ 90 a mais no MP)
      preco_promocional: null,
      estoque: 35,
      estoque_marketplace: 35,
      reservado: 2,
      peso_kg: 0.16,
      largura_cm: 9,
      altura_cm: 7,
      comprimento_cm: 4,
      conciliacao: 'divergencia_leve',
      marketplace: 'Mercado Livre',
      ativo: true,
      criado_em: '2024-02-10T10:00:00Z',
    },
    {
      id: 'prod-07',
      empresa_id: TENANT_ID,
      sku: 'CAD-NOBLE-HERO',
      ean: '7898564120074',
      codigo_erp: 'ERP-007',
      titulo: 'Cadeira Gamer Noblechairs Hero Black Edition',
      descricao: 'Cadeira gamer ergonômica com suporte lombar integrado e couro sintético respirável.',
      categoria: 'Móveis',
      marca: 'Noblechairs',
      fornecedor: 'Noblechairs Inc',
      custo: 1600,
      preco: 2499.9,
      preco_marketplace: 2499.9,
      preco_promocional: null,
      estoque: 0, // Furo de estoque iminente: ERP tem 0 mas MP tem 12!
      estoque_marketplace: 12,
      reservado: 0,
      peso_kg: 28.0,
      largura_cm: 70,
      altura_cm: 130,
      comprimento_cm: 60,
      conciliacao: 'divergencia_critica',
      marketplace: 'Shopee',
      ativo: true,
      criado_em: '2024-02-15T11:20:00Z',
    },
    {
      id: 'prod-08',
      empresa_id: TENANT_ID,
      sku: 'SSD-KING-1TB',
      ean: '7898564120081',
      codigo_erp: 'ERP-008',
      titulo: 'SSD NVMe Kingston 1TB NV2 M.2 2280 3500MB/s',
      descricao: 'Unidade de estado sólido de alta velocidade com tecnologia PCIe 4.0 NVMe.',
      categoria: 'Armazenamento',
      marca: 'Kingston',
      fornecedor: 'Kingston Tech',
      custo: 240,
      preco: 429.9,
      preco_marketplace: null, // Oferta ausente no MP
      preco_promocional: null,
      estoque: 80,
      estoque_marketplace: null,
      reservado: 5,
      peso_kg: 0.05,
      largura_cm: 8,
      altura_cm: 2,
      comprimento_cm: 0.3,
      conciliacao: 'ausente',
      marketplace: 'Amazon',
      ativo: true,
      criado_em: '2024-02-18T15:00:00Z',
    },
    {
      id: 'prod-09',
      empresa_id: TENANT_ID,
      sku: 'IMP-EPS-L3250',
      ean: '', // EAN ausente
      codigo_erp: 'ERP-009',
      titulo: 'Impressora Multifuncional Epson EcoTank L3250 Wi-Fi',
      descricao: 'Impressora tanque de tinta colorida de altíssimo rendimento e conexão sem fio.',
      categoria: 'Impressoras',
      marca: 'Epson',
      fornecedor: 'Epson do Brasil',
      custo: 750,
      preco: 1199.9,
      preco_marketplace: 1199.9,
      preco_promocional: null,
      estoque: 25,
      estoque_marketplace: 25,
      reservado: 1,
      peso_kg: 3.9,
      largura_cm: 37,
      altura_cm: 18,
      comprimento_cm: 34,
      conciliacao: 'divergencia_leve',
      marketplace: 'Magalu',
      ativo: true,
      criado_em: '2024-02-20T09:00:00Z',
    },
    {
      id: 'prod-10',
      empresa_id: TENANT_ID,
      sku: 'ROT-TPL-AX12',
      ean: '7898564120104',
      codigo_erp: 'ERP-010',
      titulo: 'Roteador Wi-Fi 6 TP-Link Archer AX12 Dual Band Gigabit',
      descricao: 'Roteador Wi-Fi 6 de última geração com suporte a OFDMA, Beamforming e WPA3.',
      categoria: 'Redes',
      marca: 'TP-Link',
      fornecedor: 'TP-Link Brasil',
      custo: 180,
      preco: 299.9,
      preco_marketplace: 349.9,
      preco_promocional: null,
      estoque: 50,
      estoque_marketplace: 10,
      reservado: 2,
      peso_kg: 0.45,
      largura_cm: 21,
      altura_cm: 14,
      comprimento_cm: 3,
      conciliacao: 'divergencia_critica',
      marketplace: 'Mercado Livre',
      ativo: true,
      criado_em: '2024-02-22T14:30:00Z',
    },
  ];

  orders: Order[] = [
    {
      id: 'ord-101',
      empresa_id: TENANT_ID,
      numero: 'PED-ML-8941',
      codigo_erp: 'ERP-PED-8941',
      marketplace: 'Mercado Livre',
      cliente: 'Carlos Eduardo Silva',
      cliente_documento: '123.456.789-00',
      valor: 2899.9,
      frete: 45,
      comissao: 347.98,
      desconto: 0,
      status: 'entregue',
      pagamento: 'Mercado Pago (PIX)',
      envio: 'Mercado Envios Flex',
      transportadora: 'Correios',
      conciliacao: 'conciliado',
      data: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      itens_qtd: 1,
      itens: [
        {
          id: 'item-101-1',
          sku: 'MON-DELL-27',
          titulo: 'Monitor Dell 27 4K UltraHD USB-C Ergonomico',
          quantidade: 1,
          preco_unitario: 2899.9,
          desconto_unitario: 0,
          subtotal: 2899.9,
        },
      ],
      observacoes: 'Pedido entregue com sucesso dentro do prazo do Flex.',
    },
    {
      id: 'ord-102',
      empresa_id: TENANT_ID,
      numero: 'PED-AMZ-4412',
      codigo_erp: 'ERP-PED-4412',
      marketplace: 'Amazon',
      cliente: 'Mariana Costa Oliveira',
      cliente_documento: '987.654.321-11',
      valor: 749.9,
      frete: 25,
      comissao: 89.98,
      desconto: 0,
      status: 'faturado',
      pagamento: 'Cartão de Crédito',
      envio: 'DB Schenker',
      transportadora: 'Jadlog',
      conciliacao: 'divergencia_leve',
      data: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      itens_qtd: 1,
      itens: [
        {
          id: 'item-102-1',
          sku: 'MOUSE-LOGI-MX3',
          titulo: 'Mouse Sem Fio Logitech MX Master 3S',
          quantidade: 1,
          preco_unitario: 749.9,
          desconto_unitario: 0,
          subtotal: 749.9,
        },
      ],
      observacoes: 'Nota fiscal emitida. Aguardando coleta pela Jadlog.',
    },
    {
      id: 'ord-103',
      empresa_id: TENANT_ID,
      numero: 'PED-SHP-9011',
      codigo_erp: 'ERP-PED-9011',
      marketplace: 'Shopee',
      cliente: 'Fernando Almeida Prado',
      cliente_documento: '456.789.123-22',
      valor: 629.9,
      frete: 18,
      comissao: 75.58,
      desconto: 20,
      status: 'enviado',
      pagamento: 'ShopeePay',
      envio: 'Shopee Xpress',
      transportadora: 'Total Express',
      conciliacao: 'conciliado',
      data: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
      itens_qtd: 1,
      itens: [
        {
          id: 'item-103-1',
          sku: 'HEAD-HYPER-X',
          titulo: 'Headset Gamer HyperX Cloud II Wireless 7.1',
          quantidade: 1,
          preco_unitario: 649.9,
          desconto_unitario: 20,
          subtotal: 629.9,
        },
      ],
      observacoes: 'Em trânsito com Total Express.',
    },
    {
      id: 'ord-104',
      empresa_id: TENANT_ID,
      numero: 'PED-MGL-3301',
      codigo_erp: 'ERP-PED-3301',
      marketplace: 'Magalu',
      cliente: 'Patrícia Souza Santos',
      cliente_documento: '321.654.987-33',
      valor: 5899.9,
      frete: 80,
      comissao: 707.98,
      desconto: 300,
      status: 'pago',
      pagamento: 'PIX',
      envio: 'Magalu Entregas',
      transportadora: 'Loggi',
      conciliacao: 'conciliado',
      data: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      itens_qtd: 1,
      itens: [
        {
          id: 'item-104-1',
          sku: 'NOTE-LEN-i7',
          titulo: 'Notebook ThinkPad i7 16GB SSD 512GB Win11 Pro',
          quantidade: 1,
          preco_unitario: 6199.9,
          desconto_unitario: 300,
          subtotal: 5899.9,
        },
      ],
      observacoes: 'Aguardando liberação do faturamento.',
    },
    {
      id: 'ord-105',
      empresa_id: TENANT_ID,
      numero: 'PED-ML-8942',
      codigo_erp: 'ERP-PED-8942',
      marketplace: 'Mercado Livre',
      cliente: 'Lucas Mendes Ferreira',
      cliente_documento: '654.123.987-44',
      valor: 699.9,
      frete: 0,
      comissao: 83.98,
      desconto: 0,
      status: 'aguardando',
      pagamento: 'Boleto Bancário',
      envio: 'Mercado Envios',
      transportadora: 'Aguardando',
      conciliacao: 'divergencia_critica',
      data: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      itens_qtd: 1,
      itens: [
        {
          id: 'item-105-1',
          sku: 'TECL-LOGI-MX',
          titulo: 'Teclado Sem Fio Logitech MX Keys Advanced',
          quantidade: 1,
          preco_unitario: 699.9,
          desconto_unitario: 0,
          subtotal: 699.9,
        },
      ],
      observacoes: 'Pagamento pendente via boleto bancário.',
    },
    {
      id: 'ord-106',
      empresa_id: TENANT_ID,
      numero: 'PED-AMZ-4415',
      codigo_erp: 'ERP-PED-4415',
      marketplace: 'Amazon',
      cliente: 'Roberto Camargo Neves',
      cliente_documento: '12.345.678/0001-99',
      valor: 3599.8,
      frete: 35,
      comissao: 431.97,
      desconto: 50,
      status: 'pago',
      pagamento: 'Cartão de Crédito (3x)',
      envio: 'FBA Direct',
      transportadora: 'Azul Cargo Express',
      conciliacao: 'conciliado',
      data: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
      itens_qtd: 2,
      itens: [
        {
          id: 'item-106-1',
          sku: 'MON-DELL-27',
          titulo: 'Monitor Dell 27 4K UltraHD USB-C Ergonomico',
          quantidade: 1,
          preco_unitario: 2899.9,
          desconto_unitario: 50,
          subtotal: 2849.9,
        },
        {
          id: 'item-106-2',
          sku: 'MOUSE-LOGI-MX3',
          titulo: 'Mouse Sem Fio Logitech MX Master 3S',
          quantidade: 1,
          preco_unitario: 749.9,
          desconto_unitario: 0,
          subtotal: 749.9,
        },
      ],
      observacoes: 'Pedido corporativo com múltiplos produtos.',
    },
  ];

  financialEntries: FinancialEntry[] = [
    {
      id: 'fin-01',
      empresa_id: TENANT_ID,
      pedido_id: 'ord-101',
      pedido: 'PED-ML-8941',
      tipo: 'receita',
      valor: 2899.9,
      taxa: 15,
      comissao: 347.98,
      margem: 25.4,
      origem: 'Mercado Livre',
      data: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    },
    {
      id: 'fin-02',
      empresa_id: TENANT_ID,
      pedido_id: 'ord-102',
      pedido: 'PED-AMZ-4412',
      tipo: 'receita',
      valor: 749.9,
      taxa: 12,
      comissao: 89.98,
      margem: 21.2,
      origem: 'Amazon',
      data: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    },
    {
      id: 'fin-03',
      empresa_id: TENANT_ID,
      pedido_id: 'ord-103',
      pedido: 'PED-SHP-9011',
      tipo: 'receita',
      valor: 629.9,
      taxa: 10,
      comissao: 75.58,
      margem: 18.5,
      origem: 'Shopee',
      data: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    },
    {
      id: 'fin-04',
      empresa_id: TENANT_ID,
      pedido_id: 'ord-104',
      pedido: 'PED-MGL-3301',
      tipo: 'receita',
      valor: 5899.9,
      taxa: 20,
      comissao: 707.98,
      margem: 28.1,
      origem: 'Magalu',
      data: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
      id: 'fin-05',
      empresa_id: TENANT_ID,
      pedido_id: 'ord-105',
      pedido: 'PED-ML-8942',
      tipo: 'receita',
      valor: 699.9,
      taxa: 12,
      comissao: 83.98,
      margem: 22.0,
      origem: 'Mercado Livre',
      data: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
      id: 'fin-06',
      empresa_id: TENANT_ID,
      pedido_id: 'ord-106',
      pedido: 'PED-AMZ-4415',
      tipo: 'receita',
      valor: 3599.8,
      taxa: 12,
      comissao: 431.97,
      margem: 26.5,
      origem: 'Amazon',
      data: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    },
    {
      id: 'fin-07',
      empresa_id: TENANT_ID,
      pedido_id: null,
      pedido: 'TAXA-MENSAL-ML',
      tipo: 'comissao',
      valor: -450,
      taxa: 0,
      comissao: 450,
      margem: 0,
      origem: 'Tarifa de Anúncios Mercado Livre',
      data: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    },
  ];

  alerts: Alert[] = [
    {
      id: 'alt-01',
      empresa_id: TENANT_ID,
      titulo: 'Estoque Esgotado em Marketplace (Amazon)',
      mensagem: 'O produto MOUSE-LOGI-MX3 possui 18 unidades no ERP mas consta com estoque ZERO na Amazon.',
      tipo: 'divergencia_estoque',
      severidade: 'critico',
      status: 'detectado',
      origem: 'Amazon SP-API',
      modulo: 'Estoque',
      impacto_financeiro: 13498.2,
      sugestao: 'Executar sincronização forçada de saldo do produto MOUSE-LOGI-MX3 para a Amazon.',
      criado_em: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
    },
    {
      id: 'alt-02',
      empresa_id: TENANT_ID,
      titulo: 'Divergência de Preço de Venda (Mercado Livre)',
      mensagem: 'O produto TECL-LOGI-MX está cadastrado a R$ 699,90 no ERP mas é vendido a R$ 649,90 no ML.',
      tipo: 'divergencia_preco',
      severidade: 'alto',
      status: 'em_analise',
      origem: 'Mercado Livre',
      modulo: 'Comercial',
      impacto_financeiro: 5500.0,
      sugestao: 'Atualizar tabela de preço de venda da oferta 89410 no Mercado Livre ou aplicar preço do ERP.',
      criado_em: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    },
    {
      id: 'alt-03',
      empresa_id: TENANT_ID,
      titulo: 'Pedido com Pagamento Pendente Há Mais de 24h',
      mensagem: 'O pedido PED-ML-8942 de R$ 699,90 está com status de boleto pendente sem confirmação de baixa.',
      tipo: 'pedido_pendente',
      severidade: 'medio',
      status: 'detectado',
      origem: 'Bling ERP',
      modulo: 'Pedidos',
      impacto_financeiro: 699.9,
      sugestao: 'Consultar webhook de pagamento da instituição financeira ou cancelar reserva de estoque.',
      criado_em: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
    },
  ];

  auditEntries: AuditEntry[] = [
    {
      id: 'aud-01',
      empresa_id: TENANT_ID,
      usuario: 'Administrador (Sistemas)',
      acao: 'boot_plataforma',
      modulo: 'Sistema',
      registro: 'TechCommerce Brasil',
      antes: null,
      depois: 'Módulos operacionais inicializados com sucesso',
      ip: null,
      navegador: 'Sistema',
      criado_em: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
  ];

  syncHistory: SyncHistory[] = [
    {
      id: 'sync-01',
      empresa_id: TENANT_ID,
      conexao_id: 'conn-02',
      conexao_nome: 'Mercado Livre Oficial',
      inicio: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      fim: new Date(Date.now() - 1000 * 60 * 14.5).toISOString(),
      duracao_ms: 540,
      registros_recebidos: 45,
      registros_alterados: 3,
      erros: 0,
      status: 'concluido',
    },
  ];

  exportHistory: ExportHistoryEntry[] = [
    {
      id: 'exp-hist-01',
      empresa_id: TENANT_ID,
      dataset: 'Catálogo de Produtos',
      dataset_id: 'products',
      formato: 'csv',
      usuario: 'Sistema',
      registros: 5,
      tamanho_bytes: 1420,
      tempo_ms: 85,
      status: 'sucesso',
      criado_em: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      observacao: 'Exportação manual via painel',
    },
    {
      id: 'exp-hist-02',
      empresa_id: TENANT_ID,
      dataset: 'Vendas e Pedidos',
      dataset_id: 'orders',
      formato: 'xlsx',
      usuario: 'Sistema',
      registros: 5,
      tamanho_bytes: 3850,
      tempo_ms: 140,
      status: 'sucesso',
      criado_em: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
      observacao: 'Relatório de fechamento comercial',
    },
  ];

  exportSchedules: ExportSchedule[] = [
    {
      id: 'sch-01',
      empresa_id: TENANT_ID,
      nome: 'Relatório Diário de Pedidos e Vendas',
      dataset_id: 'orders',
      formato: 'xlsx',
      frequencia: 'diario',
      horario: '08:00',
      email_destino: 'diretoria@empresa.com.br',
      ativo: true,
      ultima_execucao: new Date(Date.now() - 1000 * 60 * 60 * 16).toISOString(),
      proxima_execucao: new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString(),
      criado_em: '2024-02-01T10:00:00Z',
    },
    {
      id: 'sch-02',
      empresa_id: TENANT_ID,
      nome: 'Balanço Semanal da Conciliação Financeira',
      dataset_id: 'finance',
      formato: 'csv',
      frequencia: 'semanal',
      horario: '06:00',
      email_destino: 'financeiro@empresa.com.br',
      ativo: true,
      ultima_execucao: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      proxima_execucao: new Date(Date.now() + 1000 * 60 * 60 * 120).toISOString(),
      criado_em: '2024-02-10T14:00:00Z',
    },
    {
      id: 'sch-03',
      empresa_id: TENANT_ID,
      nome: 'Snapshot Mensal do Catálogo de Produtos',
      dataset_id: 'products',
      formato: 'json',
      frequencia: 'mensal',
      horario: '00:00',
      email_destino: 'ti@empresa.com.br',
      ativo: false,
      ultima_execucao: null,
      proxima_execucao: null,
      criado_em: '2024-03-01T09:00:00Z',
    },
  ];
}

const memoryStore = new MemoryDataStore();

export const apiService = {
  async getCompany(): Promise<Company> {
    const { data, error } = await supabase.from('companies').select('*').eq('id', TENANT_ID).maybeSingle();
    if (error) throw new Error(`Erro ao carregar empresa: ${error.message}`);
    if (data) return data as Company;
    return memoryStore.company;
  },

  async getConnections(): Promise<Connection[]> {
    const { data, error } = await supabase.from('connections').select('*').eq('empresa_id', TENANT_ID).order('criado_em', { ascending: true });
    if (error) throw new Error(`Erro ao carregar conexões: ${error.message}`);
    if (data && data.length > 0) return data as Connection[];
    return memoryStore.connections;
  },

  async getProducts(): Promise<Product[]> {
    const { data, error } = await supabase.from('products').select('*').eq('empresa_id', TENANT_ID).order('titulo', { ascending: true });
    if (error) throw new Error(`Erro ao carregar produtos: ${error.message}`);
    if (data && data.length > 0) return data as Product[];
    return memoryStore.products;
  },

  async getOrders(): Promise<Order[]> {
    const { data, error } = await supabase.from('orders').select('*').eq('empresa_id', TENANT_ID).order('data', { ascending: false });
    if (error) throw new Error(`Erro ao carregar pedidos: ${error.message}`);
    if (data && data.length > 0) return data as Order[];
    return memoryStore.orders;
  },

  async getFinancialEntries(): Promise<FinancialEntry[]> {
    const { data, error } = await supabase.from('financial_entries').select('*').eq('empresa_id', TENANT_ID).order('data', { ascending: false });
    if (error) throw new Error(`Erro ao carregar lançamentos financeiros: ${error.message}`);
    if (data && data.length > 0) return data as FinancialEntry[];
    return memoryStore.financialEntries;
  },

  async getAlerts(): Promise<Alert[]> {
    const { data, error } = await supabase.from('alerts').select('*').eq('empresa_id', TENANT_ID).order('criado_em', { ascending: false });
    if (error) throw new Error(`Erro ao carregar alertas: ${error.message}`);
    if (data && data.length > 0) return data as Alert[];
    return memoryStore.alerts;
  },

  async reconcileSystemAlerts(): Promise<{ totalDetected: number; alerts: Alert[] }> {
    const products = await this.getProducts();
    const orders = await this.getOrders();
    const connections = await this.getConnections();
    const existingAlerts = await this.getAlerts();
    const newAlerts: Omit<Alert, 'id' | 'criado_em'>[] = [];

    const checkExists = (sku: string, tipo: string) =>
      existingAlerts.some((a) => a.tipo === tipo && a.mensagem.includes(sku));

    products.forEach((prod) => {
      if (prod.estoque_marketplace === 0 && prod.estoque > 0) {
        if (!checkExists(prod.sku, 'divergencia_estoque')) {
          newAlerts.push({
            empresa_id: TENANT_ID,
            titulo: `Estoque Esgotado em Marketplace (${prod.marketplace || 'Marketplace'})`,
            mensagem: `O produto ${prod.sku} (${prod.titulo}) possui ${prod.estoque} unidades no ERP mas consta com estoque ZERO no marketplace ${prod.marketplace || 'Marketplace'}.`,
            tipo: 'divergencia_estoque',
            severidade: 'critico',
            status: 'detectado',
            origem: prod.marketplace || 'ERP Sync Engine',
            modulo: 'Estoque',
            impacto_financeiro: Number((prod.estoque * prod.preco).toFixed(2)),
            sugestao: `Executar sincronização forçada de saldo do produto ${prod.sku} para ${prod.marketplace || 'Marketplace'}.`,
            responsavel: null,
            resolvido_em: null,
          });
        }
      }
      if (prod.preco_marketplace !== null && Math.abs(prod.preco - prod.preco_marketplace) > 0.01) {
        if (!checkExists(prod.sku, 'divergencia_preco')) {
          const diff = Math.abs(prod.preco - prod.preco_marketplace);
          newAlerts.push({
            empresa_id: TENANT_ID,
            titulo: `Divergência de Preço de Venda (${prod.marketplace || 'Marketplace'})`,
            mensagem: `O produto ${prod.sku} está cadastrado a R$ ${prod.preco.toFixed(2)} no ERP mas é vendido a R$ ${prod.preco_marketplace.toFixed(2)} em ${prod.marketplace || 'Marketplace'}.`,
            tipo: 'divergencia_preco',
            severidade: 'alto',
            status: 'detectado',
            origem: prod.marketplace || 'Precificação Engine',
            modulo: 'Comercial',
            impacto_financeiro: Number((diff * prod.estoque).toFixed(2)),
            sugestao: `Atualizar tabela de preço de venda do produto ${prod.sku} em ${prod.marketplace || 'Marketplace'}.`,
            responsavel: null,
            resolvido_em: null,
          });
        }
      }
    });

    orders.forEach((ord) => {
      if (ord.conciliacao === 'divergencia_critica') {
        if (!existingAlerts.some((a) => a.mensagem.includes(ord.numero))) {
          newAlerts.push({
            empresa_id: TENANT_ID,
            titulo: `Divergência Crítica de Conciliação (${ord.numero})`,
            mensagem: `O pedido ${ord.numero} em ${ord.marketplace} de R$ ${ord.valor.toFixed(2)} possui repasse com divergência cadastrada.`,
            tipo: 'divergencia_conciliacao',
            severidade: 'alto',
            status: 'detectado',
            origem: ord.marketplace,
            modulo: 'Financeiro',
            impacto_financeiro: ord.valor,
            sugestao: `Conferir extrato financeiro do pedido ${ord.numero} e abrir chamado no canal.`,
            responsavel: null,
            resolvido_em: null,
          });
        }
      }
    });

    connections.forEach((conn) => {
      if (conn.status === 'erro' || !conn.ativo) {
        if (!existingAlerts.some((a) => a.mensagem.includes(conn.nome))) {
          newAlerts.push({
            empresa_id: TENANT_ID,
            titulo: `Conexão Instável ou Inativa (${conn.nome})`,
            mensagem: `A conexão ${conn.nome} (${conn.fornecedor}) está ${conn.status === 'erro' ? 'com erro de API' : 'desativada'}.`,
            tipo: 'erro_integracao',
            severidade: 'alto',
            status: 'detectado',
            origem: conn.nome,
            modulo: 'Integrações',
            impacto_financeiro: 0,
            sugestao: `Revisar token de acesso e reativar a conexão ${conn.nome} no painel de Integrações.`,
            responsavel: null,
            resolvido_em: null,
          });
        }
      }
    });

    if (newAlerts.length > 0) {
      const { error } = await supabase.from('alerts').insert(newAlerts);
      if (error) throw new Error(`Erro ao inserir alertas: ${error.message}`);
    }

    const allAlerts = await this.getAlerts();
    const activeAlerts = allAlerts.filter((a) => a.status !== 'resolvido');
    return { totalDetected: activeAlerts.length, alerts: allAlerts };
  },

  async getAuditEntries(): Promise<AuditEntry[]> {
    const { data, error } = await supabase.from('audit_log').select('*').eq('empresa_id', TENANT_ID).order('criado_em', { ascending: false });
    if (error) throw new Error(`Erro ao carregar auditoria: ${error.message}`);
    if (data && data.length > 0) return data as AuditEntry[];
    return memoryStore.auditEntries;
  },

  async getSyncHistory(): Promise<SyncHistory[]> {
    const { data, error } = await supabase.from('sync_history').select('*').eq('empresa_id', TENANT_ID).order('inicio', { ascending: false });
    if (error) throw new Error(`Erro ao carregar histórico de sync: ${error.message}`);
    if (data && data.length > 0) return data as SyncHistory[];
    return memoryStore.syncHistory;
  },

  async resolveAlert(alertId: string, responsavel: string = 'Sistema'): Promise<void> {
    const resolvidoEm = new Date().toISOString();
    const { error } = await supabase.from('alerts').update({ status: 'resolvido', resolvido_em: resolvidoEm, responsavel }).eq('id', alertId);
    if (error) throw new Error(`Erro ao resolver alerta: ${error.message}`);
    const target = memoryStore.alerts.find((a) => a.id === alertId);
    if (target) {
      target.status = 'resolvido';
      target.resolvido_em = resolvidoEm;
      target.responsavel = responsavel;
    }
  },

  async resolveAlertsBatch(alertIds: string[], responsavel: string = 'Sistema'): Promise<void> {
    for (const id of alertIds) {
      await this.resolveAlert(id, responsavel);
    }
  },

  async resolveAllAlerts(responsavel: string = 'Sistema'): Promise<number> {
    const { data, error } = await supabase
      .from('alerts')
      .update({ status: 'resolvido', resolvido_em: new Date().toISOString(), responsavel })
      .neq('status', 'resolvido')
      .eq('empresa_id', TENANT_ID)
      .select('id');
    if (error) throw new Error(`Erro ao resolver todos os alertas: ${error.message}`);
    const resolvedIds = (data || []).map((r: { id: string }) => r.id);
    memoryStore.alerts.forEach((a) => {
      if (a.status !== 'resolvido') {
        a.status = 'resolvido';
        a.resolvido_em = new Date().toISOString();
        a.responsavel = responsavel;
      }
    });
    return resolvedIds.length;
  },

  async toggleConnection(connectionId: string, ativo: boolean): Promise<void> {
    const status = ativo ? 'online' : 'desativado';
    const { error } = await supabase.from('connections').update({ ativo, status }).eq('id', connectionId);
    if (error) throw new Error(`Erro ao alternar conexão: ${error.message}`);
    const conn = memoryStore.connections.find((c) => c.id === connectionId);
    if (conn) {
      conn.ativo = ativo;
      conn.status = status;
    }
  },

  async createConnection(conn: Omit<Connection, 'id' | 'empresa_id'>): Promise<Connection> {
    const isAtivo = conn.ativo ?? true;
    const insertData = {
      empresa_id: TENANT_ID,
      nome: conn.nome,
      tipo: conn.tipo,
      fornecedor: conn.fornecedor,
      url: conn.url,
      metodo: conn.metodo,
      autenticacao: conn.autenticacao,
      status: isAtivo ? (conn.status || 'online') : 'desativado',
      intervalo_min: conn.intervalo_min,
      registros: conn.registros || 0,
      tempo_resposta_ms: conn.tempo_resposta_ms || 0,
      ativo: isAtivo,
      token_sec: conn.token_sec || null,
      ultima_sincronizacao: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('connections').insert(insertData).select().single();
    if (error) throw new Error(`Erro ao criar conexão: ${error.message}`);
    return data as Connection;
  },

  async updateConnection(connectionId: string, updates: Partial<Connection>): Promise<void> {
    const { error } = await supabase.from('connections').update(updates).eq('id', connectionId);
    if (error) throw new Error(`Erro ao atualizar conexão: ${error.message}`);
    const idx = memoryStore.connections.findIndex((c) => c.id === connectionId);
    if (idx !== -1) {
      const current = memoryStore.connections[idx];
      let newStatus = updates.status ?? current.status;
      if (updates.ativo === false) {
        newStatus = 'desativado';
      } else if (updates.ativo === true && current.status === 'desativado') {
        newStatus = 'online';
      }
      memoryStore.connections[idx] = { ...current, ...updates, status: newStatus };
    }
  },

  async deleteConnection(connectionId: string): Promise<void> {
    const { error } = await supabase.from('connections').delete().eq('id', connectionId);
    if (error) throw new Error(`Erro ao excluir conexão: ${error.message}`);
    memoryStore.connections = memoryStore.connections.filter((c) => c.id !== connectionId);
  },

  async insertAudit(entry: Partial<AuditEntry> & Pick<AuditEntry, 'usuario' | 'acao' | 'modulo'>): Promise<void> {
    const insertData = {
      empresa_id: TENANT_ID,
      usuario: entry.usuario,
      acao: entry.acao,
      modulo: entry.modulo,
      registro: entry.registro || 'Geral',
      antes: entry.antes ?? null,
      depois: entry.depois ?? null,
      ip: entry.ip ?? null,
      navegador: entry.navegador ?? (typeof navigator !== 'undefined' ? navigator.userAgent : null),
    };
    const { error } = await supabase.from('audit_log').insert(insertData);
    if (error) throw new Error(`Erro ao registrar auditoria: ${error.message}`);
  },

  async addSyncHistory(history: Omit<SyncHistory, 'id' | 'empresa_id'>): Promise<void> {
    const insertData = {
      empresa_id: TENANT_ID,
      conexao_id: history.conexao_id,
      conexao_nome: history.conexao_nome,
      inicio: history.inicio,
      fim: history.fim,
      duracao_ms: history.duracao_ms,
      registros_recebidos: history.registros_recebidos,
      registros_alterados: history.registros_alterados,
      erros: history.erros,
      status: history.status,
      detalhes: history.detalhes,
    };
    const { error } = await supabase.from('sync_history').insert(insertData);
    if (error) throw new Error(`Erro ao registrar histórico de sync: ${error.message}`);
  },

  async updateProductConciliation(productId: string, status: Product['conciliacao']): Promise<void> {
    const atualizado_em = new Date().toISOString();
    const updateData: Record<string, unknown> = { conciliacao: status, atualizado_em };
    const p = memoryStore.products.find((prod) => prod.id === productId);
    if (p && status === 'conciliado') {
      updateData.preco_marketplace = p.preco;
      updateData.estoque_marketplace = p.estoque;
    }
    const { error } = await supabase.from('products').update(updateData).eq('id', productId);
    if (error) throw new Error(`Erro ao atualizar conciliação: ${error.message}`);
    if (p) {
      p.conciliacao = status;
      p.atualizado_em = atualizado_em;
      if (status === 'conciliado') {
        p.preco_marketplace = p.preco;
        p.estoque_marketplace = p.estoque;
      }
    }
  },

  async updateOrderConciliation(orderId: string, status: ConciliationStatus): Promise<void> {
    const { error } = await supabase.from('orders').update({ conciliacao: status, atualizado_em: new Date().toISOString() }).eq('id', orderId);
    if (error) throw new Error(`Erro ao atualizar conciliação do pedido: ${error.message}`);
    const o = memoryStore.orders.find((ord) => ord.id === orderId);
    if (o) {
      o.conciliacao = status;
      o.atualizado_em = new Date().toISOString();
    }
  },

  async equalizeProduct(productId: string, direction: 'erp_to_mp' | 'mp_to_erp'): Promise<Product> {
    const p = memoryStore.products.find((prod) => prod.id === productId);
    if (!p) throw new Error('Produto não encontrado');

    if (direction === 'erp_to_mp') {
      p.preco_marketplace = p.preco;
      p.estoque_marketplace = p.estoque;
    } else {
      if (p.preco_marketplace !== null) p.preco = p.preco_marketplace;
      if (p.estoque_marketplace !== null) p.estoque = p.estoque_marketplace;
    }

    p.conciliacao = 'conciliado';
    p.atualizado_em = new Date().toISOString();

    const { error } = await supabase.from('products').update({
      preco: p.preco,
      preco_marketplace: p.preco_marketplace,
      estoque: p.estoque,
      estoque_marketplace: p.estoque_marketplace,
      conciliacao: 'conciliado',
      atualizado_em: p.atualizado_em,
    }).eq('id', productId);
    if (error) throw new Error(`Erro ao equalizar produto: ${error.message}`);

    return p;
  },

  async updateProduct(productId: string, updates: Partial<Product>): Promise<void> {
    const { error } = await supabase.from('products').update(updates).eq('id', productId);
    if (error) throw new Error(`Erro ao atualizar produto: ${error.message}`);
    const p = memoryStore.products.find((prod) => prod.id === productId);
    if (p) {
      Object.assign(p, updates);
      p.atualizado_em = new Date().toISOString();

      const priceERP = Number(p.preco);
      const priceMP = p.preco_marketplace !== null ? Number(p.preco_marketplace) : priceERP;
      const stockERP = Number(p.estoque);
      const stockMP = p.estoque_marketplace !== null ? Number(p.estoque_marketplace) : stockERP;

      const priceDiff = Math.abs(priceERP - priceMP) > 0.01;
      const stockDiff = stockERP !== stockMP;

      if (!priceDiff && !stockDiff) {
        p.conciliacao = 'conciliado';
      } else if (stockMP === 0 && stockERP > 0) {
        p.conciliacao = 'divergencia_critica';
      } else if (priceDiff && stockDiff) {
        p.conciliacao = 'divergencia_critica';
      } else {
        p.conciliacao = 'divergencia_leve';
      }
    }
  },

  async createOrder(newOrd: Omit<Order, 'id' | 'empresa_id'>): Promise<Order> {
    const insertData = {
      empresa_id: TENANT_ID,
      numero: newOrd.numero,
      codigo_erp: newOrd.codigo_erp || null,
      marketplace: newOrd.marketplace,
      cliente: newOrd.cliente,
      cliente_documento: newOrd.cliente_documento || null,
      valor: newOrd.valor,
      frete: newOrd.frete,
      comissao: newOrd.comissao,
      desconto: newOrd.desconto,
      status: newOrd.status,
      pagamento: newOrd.pagamento,
      envio: newOrd.envio,
      transportadora: newOrd.transportadora,
      conciliacao: newOrd.conciliacao,
      data: newOrd.data || new Date().toISOString(),
      itens_qtd: newOrd.itens_qtd,
      observacoes: newOrd.observacoes || null,
    };
    const { data, error } = await supabase.from('orders').insert(insertData).select().single();
    if (error) throw new Error(`Erro ao criar pedido: ${error.message}`);
    const created = data as Order;

    if (created.status !== 'cancelado') {
      const finData = {
        empresa_id: TENANT_ID,
        pedido_id: created.id,
        pedido: created.numero,
        tipo: 'receita',
        valor: Number(created.valor),
        taxa: 12,
        comissao: Number(created.comissao),
        margem: Number(created.valor) > 0
          ? Number((((Number(created.valor) - Number(created.comissao) - Number(created.frete) - Number(created.desconto)) / Number(created.valor)) * 100).toFixed(1))
          : 0,
        origem: created.marketplace,
        data: created.data || new Date().toISOString(),
      };
      await supabase.from('financial_entries').insert(finData);
    }

    return created;
  },

  async updateOrder(orderId: string, updates: Partial<Order>): Promise<void> {
    const { error } = await supabase.from('orders').update(updates).eq('id', orderId);
    if (error) throw new Error(`Erro ao atualizar pedido: ${error.message}`);
    const o = memoryStore.orders.find((ord) => ord.id === orderId);
    if (o) {
      Object.assign(o, updates);
      o.atualizado_em = new Date().toISOString();
      if (updates.itens) {
        o.itens_qtd = updates.itens.reduce((sum, item) => sum + item.quantidade, 0);
      }
    }
  },

  async createFinancialEntry(newEntry: Omit<FinancialEntry, 'id' | 'empresa_id'>): Promise<FinancialEntry> {
    const insertData = {
      empresa_id: TENANT_ID,
      pedido_id: newEntry.pedido_id || null,
      pedido: newEntry.pedido || null,
      tipo: newEntry.tipo,
      valor: newEntry.valor,
      taxa: newEntry.taxa,
      comissao: newEntry.comissao,
      margem: newEntry.margem,
      origem: newEntry.origem,
      data: newEntry.data || new Date().toISOString(),
    };
    const { data, error } = await supabase.from('financial_entries').insert(insertData).select().single();
    if (error) throw new Error(`Erro ao criar lançamento financeiro: ${error.message}`);
    return data as FinancialEntry;
  },

  async deleteFinancialEntry(id: string): Promise<void> {
    const { error } = await supabase.from('financial_entries').delete().eq('id', id);
    if (error) throw new Error(`Erro ao excluir lançamento: ${error.message}`);
  },

  async deleteOrder(orderId: string): Promise<void> {
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) throw new Error(`Erro ao excluir pedido: ${error.message}`);
  },

  async updateCompany(updates: Partial<Company>): Promise<void> {
    const { error } = await supabase.from('companies').update(updates).eq('id', TENANT_ID);
    if (error) throw new Error(`Erro ao atualizar empresa: ${error.message}`);
    Object.assign(memoryStore.company, updates);
  },

  async getSettings(): Promise<SystemSettings> {
    const { data, error } = await supabase.from('system_settings').select('*').eq('id', 1).maybeSingle();
    if (error) throw new Error(`Erro ao carregar configurações: ${error.message}`);
    if (data) {
      return {
        autoResolveThreshold: Number(data.auto_resolve_threshold),
        maxRetries: data.max_retries,
        timeoutSeconds: data.timeout_seconds,
        syncIntervalMinutes: data.sync_interval_minutes,
        autoConciliateEnabled: data.auto_conciliate_enabled,
        notifyEmail: data.notify_email,
        notifySlack: data.notify_slack,
        notifyCriticalAlerts: data.notify_critical_alerts,
        slackWebhookUrl: data.slack_webhook_url || '',
        idioma: data.idioma,
      } as SystemSettings;
    }
    return memoryStore.settings;
  },

  async updateSettings(updates: Partial<SystemSettings>): Promise<SystemSettings> {
    const updateData: Record<string, unknown> = {};
    if (updates.autoResolveThreshold !== undefined) updateData.auto_resolve_threshold = updates.autoResolveThreshold;
    if (updates.maxRetries !== undefined) updateData.max_retries = updates.maxRetries;
    if (updates.timeoutSeconds !== undefined) updateData.timeout_seconds = updates.timeoutSeconds;
    if (updates.syncIntervalMinutes !== undefined) updateData.sync_interval_minutes = updates.syncIntervalMinutes;
    if (updates.autoConciliateEnabled !== undefined) updateData.auto_conciliate_enabled = updates.autoConciliateEnabled;
    if (updates.notifyEmail !== undefined) updateData.notify_email = updates.notifyEmail;
    if (updates.notifySlack !== undefined) updateData.notify_slack = updates.notifySlack;
    if (updates.notifyCriticalAlerts !== undefined) updateData.notify_critical_alerts = updates.notifyCriticalAlerts;
    if (updates.slackWebhookUrl !== undefined) updateData.slack_webhook_url = updates.slackWebhookUrl;
    if (updates.idioma !== undefined) updateData.idioma = updates.idioma;

    const { error } = await supabase.from('system_settings').update(updateData).eq('id', 1);
    if (error) throw new Error(`Erro ao atualizar configurações: ${error.message}`);
    Object.assign(memoryStore.settings, updates);
    return memoryStore.settings;
  },

  async getUsers(): Promise<SystemUser[]> {
    const { data, error } = await supabase.from('system_users').select('*').order('nome', { ascending: true });
    if (error) throw new Error(`Erro ao carregar usuários: ${error.message}`);
    if (data && data.length > 0) {
      return data.map((u: Record<string, unknown>) => ({
        id: String(u.id),
        nome: String(u.nome),
        email: String(u.email),
        papel: String(u.papel) as SystemUser['papel'],
        status: String(u.status) as SystemUser['status'],
        ultimo_acesso: String(u.ultimo_acesso),
      })) as SystemUser[];
    }
    return memoryStore.users;
  },

  async createUser(user: Omit<SystemUser, 'id' | 'ultimo_acesso'>): Promise<SystemUser> {
    const insertData = {
      nome: user.nome,
      email: user.email,
      papel: user.papel,
      status: user.status || 'Ativo',
    };
    const { data, error } = await supabase.from('system_users').insert(insertData).select().single();
    if (error) throw new Error(`Erro ao criar usuário: ${error.message}`);
    return {
      id: String(data.id),
      nome: String(data.nome),
      email: String(data.email),
      papel: String(data.papel) as SystemUser['papel'],
      status: String(data.status) as SystemUser['status'],
      ultimo_acesso: String(data.ultimo_acesso),
    };
  },

  async updateUser(id: string, updates: Partial<SystemUser>): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (updates.nome !== undefined) updateData.nome = updates.nome;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.papel !== undefined) updateData.papel = updates.papel;
    if (updates.status !== undefined) updateData.status = updates.status;
    const { error } = await supabase.from('system_users').update(updateData).eq('id', id);
    if (error) throw new Error(`Erro ao atualizar usuário: ${error.message}`);
  },

  async deleteUser(id: string): Promise<void> {
    const { error } = await supabase.from('system_users').delete().eq('id', id);
    if (error) throw new Error(`Erro ao excluir usuário: ${error.message}`);
  },

  async exportFullBackup(): Promise<{
    version: string;
    exportedAt: string;
    company: Company;
    settings: SystemSettings;
    users: SystemUser[];
    connections: Connection[];
    products: Product[];
    orders: Order[];
    financialEntries: FinancialEntry[];
    alerts: Alert[];
    auditEntries: AuditEntry[];
    exportHistory: ExportHistoryEntry[];
    exportSchedules: ExportSchedule[];
  }> {
    const [company, settings, users, connections, products, orders, financialEntries, alerts, auditEntries, exportHistory, exportSchedules] = await Promise.all([
      this.getCompany(),
      this.getSettings(),
      this.getUsers(),
      this.getConnections(),
      this.getProducts(),
      this.getOrders(),
      this.getFinancialEntries(),
      this.getAlerts(),
      this.getAuditEntries(),
      this.getExportHistory(),
      this.getExportSchedules(),
    ]);
    return {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      company,
      settings,
      users,
      connections,
      products,
      orders,
      financialEntries,
      alerts,
      auditEntries,
      exportHistory,
      exportSchedules,
    };
  },

  async restoreFullBackup(data: any): Promise<{
    success: boolean;
    recordsRestored: number;
    message: string;
  }> {
    if (!data || typeof data !== 'object') {
      throw new Error('Formato de arquivo de backup inválido.');
    }

    let recordsCount = 0;

    if (data.company && typeof data.company === 'object') {
      await supabase.from('companies').upsert({ ...data.company, id: TENANT_ID });
      recordsCount += 1;
    }

    if (data.settings && typeof data.settings === 'object') {
      const s = data.settings;
      await supabase.from('system_settings').upsert({
        id: 1,
        auto_resolve_threshold: s.autoResolveThreshold ?? 0.5,
        max_retries: s.maxRetries ?? 3,
        timeout_seconds: s.timeoutSeconds ?? 15,
        sync_interval_minutes: s.syncIntervalMinutes ?? 15,
        auto_conciliate_enabled: s.autoConciliateEnabled ?? true,
        notify_email: s.notifyEmail ?? true,
        notify_slack: s.notifySlack ?? false,
        notify_critical_alerts: s.notifyCriticalAlerts ?? true,
        slack_webhook_url: s.slackWebhookUrl ?? '',
        idioma: s.idioma ?? 'pt-BR',
      });
      recordsCount += 1;
    }

    if (Array.isArray(data.users) && data.users.length > 0) {
      const { error } = await supabase.from('system_users').upsert(data.users.map((u: SystemUser) => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        papel: u.papel,
        status: u.status,
        ultimo_acesso: u.ultimo_acesso,
      })));
      if (!error) recordsCount += data.users.length;
    }

    if (Array.isArray(data.connections) && data.connections.length > 0) {
      const { error } = await supabase.from('connections').upsert(data.connections);
      if (!error) recordsCount += data.connections.length;
    }

    if (Array.isArray(data.products) && data.products.length > 0) {
      const { error } = await supabase.from('products').upsert(data.products);
      if (!error) recordsCount += data.products.length;
    }

    if (Array.isArray(data.orders) && data.orders.length > 0) {
      const { error } = await supabase.from('orders').upsert(data.orders);
      if (!error) recordsCount += data.orders.length;
    }

    if (Array.isArray(data.financialEntries) && data.financialEntries.length > 0) {
      const { error } = await supabase.from('financial_entries').upsert(data.financialEntries);
      if (!error) recordsCount += data.financialEntries.length;
    }

    if (Array.isArray(data.alerts) && data.alerts.length > 0) {
      const { error } = await supabase.from('alerts').upsert(data.alerts);
      if (!error) recordsCount += data.alerts.length;
    }

    if (Array.isArray(data.auditEntries) && data.auditEntries.length > 0) {
      const { error } = await supabase.from('audit_log').upsert(data.auditEntries);
      if (!error) recordsCount += data.auditEntries.length;
    }

    if (Array.isArray(data.exportHistory) && data.exportHistory.length > 0) {
      const { error } = await supabase.from('export_history').upsert(data.exportHistory);
      if (!error) recordsCount += data.exportHistory.length;
    }

    if (Array.isArray(data.exportSchedules) && data.exportSchedules.length > 0) {
      const { error } = await supabase.from('export_schedules').upsert(data.exportSchedules);
      if (!error) recordsCount += data.exportSchedules.length;
    }

    return {
      success: true,
      recordsRestored: recordsCount,
      message: `Restauração concluída com sucesso! ${recordsCount} registros processados.`,
    };
  },

  async resetToDefaults(): Promise<void> {
    await supabase.from('companies').upsert({ ...DEFAULT_COMPANY, id: TENANT_ID });
    await supabase.from('system_settings').upsert({ id: 1 });
  },

  async clearCache(): Promise<void> {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('a2s_cache_') || key.startsWith('a2s_tmp_'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  },

  async testConnection(params: { url: string; fornecedor: string }): Promise<{ ok: boolean; latencyMs: number; message: string }> {
    const start = Date.now();
    try {
      const result = await IntegrationHttpClient.request(params.url, {
        method: 'GET',
        timeoutMs: 10000,
        retries: 0,
      });
      const latencyMs = Date.now() - start;
      if (result.ok) {
        return {
          ok: true,
          latencyMs,
          message: `Conexão bem-sucedida com ${params.fornecedor || 'Endpoint'}! API respondendo normalmente.`,
        };
      }
      return {
        ok: false,
        latencyMs,
        message: `Falha ao conectar na URL ${params.url}. ${result.error || 'Verifique os dados e tente novamente.'}`,
      };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        message: `Erro de rede ao conectar na URL ${params.url}: ${err instanceof Error ? err.message : 'erro desconhecido'}`,
      };
    }
  },

  async getExportHistory(): Promise<ExportHistoryEntry[]> {
    const { data, error } = await supabase.from('export_history').select('*').eq('empresa_id', TENANT_ID).order('criado_em', { ascending: false });
    if (error) throw new Error(`Erro ao carregar histórico de exportações: ${error.message}`);
    if (data && data.length > 0) return data as ExportHistoryEntry[];
    return memoryStore.exportHistory;
  },

  async addExportHistory(entry: Omit<ExportHistoryEntry, 'id' | 'criado_em'>): Promise<ExportHistoryEntry> {
    const insertData = {
      empresa_id: TENANT_ID,
      dataset: entry.dataset,
      dataset_id: entry.dataset_id,
      formato: entry.formato,
      usuario: entry.usuario,
      registros: entry.registros,
      tamanho_bytes: entry.tamanho_bytes,
      tempo_ms: entry.tempo_ms,
      status: entry.status,
      observacao: entry.observacao || null,
    };
    const { data, error } = await supabase.from('export_history').insert(insertData).select().single();
    if (error) throw new Error(`Erro ao registrar exportação: ${error.message}`);
    return data as ExportHistoryEntry;
  },

  async clearExportHistory(): Promise<void> {
    const { error } = await supabase.from('export_history').delete().eq('empresa_id', TENANT_ID);
    if (error) throw new Error(`Erro ao limpar histórico: ${error.message}`);
  },

  async getExportSchedules(): Promise<ExportSchedule[]> {
    const { data, error } = await supabase.from('export_schedules').select('*').eq('empresa_id', TENANT_ID).order('criado_em', { ascending: false });
    if (error) throw new Error(`Erro ao carregar agendamentos: ${error.message}`);
    if (data && data.length > 0) return data as ExportSchedule[];
    return memoryStore.exportSchedules;
  },

  async createExportSchedule(schedule: Omit<ExportSchedule, 'id' | 'criado_em'>): Promise<ExportSchedule> {
    const insertData = {
      empresa_id: TENANT_ID,
      nome: schedule.nome,
      dataset_id: schedule.dataset_id,
      formato: schedule.formato,
      frequencia: schedule.frequencia,
      horario: schedule.horario,
      email_destino: schedule.email_destino,
      ativo: schedule.ativo,
      ultima_execucao: schedule.ultima_execucao || null,
      proxima_execucao: schedule.proxima_execucao || null,
    };
    const { data, error } = await supabase.from('export_schedules').insert(insertData).select().single();
    if (error) throw new Error(`Erro ao criar agendamento: ${error.message}`);
    return data as ExportSchedule;
  },

  async updateExportSchedule(id: string, updates: Partial<ExportSchedule>): Promise<void> {
    const { error } = await supabase.from('export_schedules').update(updates).eq('id', id);
    if (error) throw new Error(`Erro ao atualizar agendamento: ${error.message}`);
  },

  async deleteExportSchedule(id: string): Promise<void> {
    const { error } = await supabase.from('export_schedules').delete().eq('id', id);
    if (error) throw new Error(`Erro ao excluir agendamento: ${error.message}`);
  },
};
