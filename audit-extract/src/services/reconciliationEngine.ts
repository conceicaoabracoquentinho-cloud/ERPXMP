import { Product, Order, ConciliationStatus, AlertSeverity } from '../types';
import { normalizeSKU } from '../utils/normalizers';

export type DiscrepancyType =
  | 'price'
  | 'stock'
  | 'zero_stock_mp'
  | 'zero_stock_erp'
  | 'missing_mp'
  | 'missing_ean'
  | 'inactive'
  | 'order_payment'
  | 'order_commission'
  | 'none';

export interface DiscrepancyAnalysis {
  entityId: string;
  entityType: 'product' | 'order';
  title: string;
  sku: string;
  marketplace: string;
  status: ConciliationStatus;
  severity: AlertSeverity;
  type: DiscrepancyType;
  financialImpact: number;
  reason: string;
  recommendation: string;
  details: {
    erpPrice: number;
    mpPrice: number | null;
    priceDiff: number;
    erpStock: number;
    mpStock: number | null;
    stockDiff: number;
    ean: string;
    codigoErp: string;
    titulo: string;
    categoria: string;
    marca: string;
    fornecedor: string;
    ativoErp: boolean;
    ativoMp: boolean;
  };
}

export class ReconciliationEngine {
  /**
   * Evaluates product conciliation by comparing ERP values against Marketplace values
   */
  static evaluateProduct(product: Product): DiscrepancyAnalysis {
    const sku = normalizeSKU(product.sku);
    const erpPrice = Number(product.preco);
    const mpPrice = product.preco_marketplace !== null ? Number(product.preco_marketplace) : null;
    const erpStock = Number(product.estoque);
    const mpStock = product.estoque_marketplace !== null ? Number(product.estoque_marketplace) : null;
    const mp = product.marketplace || 'Marketplace Geral';
    const ean = product.ean || '';
    const codigoErp = product.codigo_erp || 'N/A';

    const priceDiff = mpPrice !== null ? Math.abs(erpPrice - mpPrice) : 0;
    const stockDiff = mpStock !== null ? Math.abs(erpStock - mpStock) : 0;

    const baseDetails = {
      erpPrice,
      mpPrice,
      priceDiff,
      erpStock,
      mpStock,
      stockDiff,
      ean,
      codigoErp,
      titulo: product.titulo,
      categoria: product.categoria,
      marca: product.marca,
      fornecedor: product.fornecedor,
      ativoErp: product.ativo,
      ativoMp: mpPrice !== null && mpStock !== null && product.ativo,
    };

    // 1. Missing MP Offer (Sem vínculo de oferta no MP)
    if (mpPrice === null || mpStock === null) {
      const impact = Math.round(erpStock * erpPrice);
      return {
        entityId: product.id,
        entityType: 'product',
        title: `Oferta Ausente no Marketplace (${sku})`,
        sku: product.sku,
        marketplace: mp,
        status: 'ausente',
        severity: 'medio',
        type: 'missing_mp',
        financialImpact: impact,
        reason: `O produto "${product.titulo}" (${sku}) possui cadastro no ERP, mas não está publicado no canal ${mp}.`,
        recommendation: `Cadastrar ou vincular o SKU no integrador do ${mp}.`,
        details: baseDetails,
      };
    }

    // 2. Furo de estoque iminente: ERP = 0, MP > 0 (Divergência Crítica)
    if (erpStock === 0 && mpStock > 0) {
      const impact = Math.round(mpStock * erpPrice);
      return {
        entityId: product.id,
        entityType: 'product',
        title: `Risco de Furo de Estoque ERP=0 (${sku})`,
        sku: product.sku,
        marketplace: mp,
        status: 'divergencia_critica',
        severity: 'critico',
        type: 'zero_stock_erp',
        financialImpact: impact,
        reason: `ERP registra 0 un. em estoque, mas a oferta em ${mp} continua ativa com ${mpStock} un. Risco iminente de venda sem produto!`,
        recommendation: `Zerar imediatamente o saldo de estoque no ${mp} para evitar cancelamentos e multas.`,
        details: baseDetails,
      };
    }

    // 3. Perda de vendas: ERP > 0, MP = 0 (Divergência Crítica)
    if (mpStock === 0 && erpStock > 0) {
      const impact = Math.round(erpStock * erpPrice);
      return {
        entityId: product.id,
        entityType: 'product',
        title: `Estoque Zerado em Marketplace (${sku})`,
        sku: product.sku,
        marketplace: mp,
        status: 'divergencia_critica',
        severity: 'critico',
        type: 'zero_stock_mp',
        financialImpact: impact,
        reason: `Possui ${erpStock} un. disponíveis no ERP, porém a oferta no ${mp} está zerada. Perda contínua de receita.`,
        recommendation: `Executar sincronização imediata do saldo de ${erpStock} un. para o ${mp}.`,
        details: baseDetails,
      };
    }

    // 4. Multiple Divergences (Preço AND Estoque)
    if (priceDiff > 0.01 && stockDiff > 0) {
      const impact = Math.round(priceDiff * erpStock + stockDiff * erpPrice);
      return {
        entityId: product.id,
        entityType: 'product',
        title: `Divergência Dupla: Preço e Estoque (${sku})`,
        sku: product.sku,
        marketplace: mp,
        status: 'divergencia_critica',
        severity: 'critico',
        type: 'price',
        financialImpact: impact,
        reason: `Preço ERP R$ ${erpPrice.toFixed(2)} vs MP R$ ${mpPrice.toFixed(2)} (Diff: R$ ${priceDiff.toFixed(2)}) E Estoque ERP (${erpStock} un.) vs MP (${mpStock} un.).`,
        recommendation: `Executar equalização de preço e estoque com base na tabela oficial do ERP.`,
        details: baseDetails,
      };
    }

    // 5. Price Divergence
    if (priceDiff > 0.01) {
      const impact = Math.round(priceDiff * erpStock);
      const isHigh = priceDiff > 50;
      return {
        entityId: product.id,
        entityType: 'product',
        title: `Divergência de Preço de Venda (${sku})`,
        sku: product.sku,
        marketplace: mp,
        status: 'divergencia_leve',
        severity: isHigh ? 'alto' : 'medio',
        type: 'price',
        financialImpact: impact,
        reason: `Preço oficial no ERP (R$ ${erpPrice.toFixed(2)}) difere do preço praticado em ${mp} (R$ ${mpPrice.toFixed(2)}).`,
        recommendation: `Atualizar preço de venda da oferta no ${mp} para R$ ${erpPrice.toFixed(2)}.`,
        details: baseDetails,
      };
    }

    // 6. Stock Divergence
    if (stockDiff > 0) {
      const impact = Math.round(stockDiff * erpPrice);
      return {
        entityId: product.id,
        entityType: 'product',
        title: `Divergência de Saldo de Estoque (${sku})`,
        sku: product.sku,
        marketplace: mp,
        status: 'divergencia_leve',
        severity: 'medio',
        type: 'stock',
        financialImpact: impact,
        reason: `ERP registra ${erpStock} un., enquanto ${mp} registra ${mpStock} un. (Diferença de ${stockDiff} un.).`,
        recommendation: `Transmitir saldo atualizado de ${erpStock} un. do ERP para o ${mp}.`,
        details: baseDetails,
      };
    }

    // 7. EAN Inconsistency / Missing EAN
    if (!ean || ean.trim() === '') {
      return {
        entityId: product.id,
        entityType: 'product',
        title: `Inconsistência de Cadastro: EAN Ausente (${sku})`,
        sku: product.sku,
        marketplace: mp,
        status: 'divergencia_leve',
        severity: 'baixo',
        type: 'missing_ean',
        financialImpact: 0,
        reason: `O código EAN/GTIN do produto não foi informado no cadastro.`,
        recommendation: `Preencher o EAN de fábrica no cadastro para evitar rejeição no integrador.`,
        details: baseDetails,
      };
    }

    // 8. Reconciled
    return {
      entityId: product.id,
      entityType: 'product',
      title: `Produto Conciliado (${sku})`,
      sku: product.sku,
      marketplace: mp,
      status: 'conciliado',
      severity: 'informativo',
      type: 'none',
      financialImpact: 0,
      reason: 'Todos os atributos (Preço, Estoque, EAN, SKU) correspondem 100% entre ERP e Marketplace.',
      recommendation: 'Nenhuma ação necessária.',
      details: baseDetails,
    };
  }

  /**
   * Evaluates order conciliation
   */
  static evaluateOrder(order: Order): DiscrepancyAnalysis {
    const val = Number(order.valor);
    const com = Number(order.comissao);
    const mp = order.marketplace;

    const baseDetails = {
      erpPrice: val,
      mpPrice: val,
      priceDiff: 0,
      erpStock: 1,
      mpStock: 1,
      stockDiff: 0,
      ean: '',
      codigoErp: order.codigo_erp || order.numero,
      titulo: `Pedido ${order.numero} - ${order.cliente}`,
      categoria: 'Vendas',
      marca: mp,
      fornecedor: mp,
      ativoErp: true,
      ativoMp: true,
    };

    if (order.status === 'aguardando' && order.conciliacao === 'divergencia_critica') {
      return {
        entityId: order.id,
        entityType: 'order',
        title: `Pedido Aguardando Baixa Financeira (${order.numero})`,
        sku: order.numero,
        marketplace: mp,
        status: 'divergencia_critica',
        severity: 'alto',
        type: 'order_payment',
        financialImpact: val,
        reason: `Pedido ${order.numero} de R$ ${val.toFixed(2)} em ${mp} está sem confirmação de baixa do repasse bancário.`,
        recommendation: 'Verificar extrato bancário do marketplace e solicitar reconciliação financeira.',
        details: baseDetails,
      };
    }

    if (order.conciliacao === 'divergencia_leve') {
      return {
        entityId: order.id,
        entityType: 'order',
        title: `Divergência de Comissão no Pedido (${order.numero})`,
        sku: order.numero,
        marketplace: mp,
        status: 'divergencia_leve',
        severity: 'medio',
        type: 'order_commission',
        financialImpact: com,
        reason: `Comissão cobrada no pedido ${order.numero} (R$ ${com.toFixed(2)}) diverge da alíquota negociada com ${mp}.`,
        recommendation: 'Abrir chamado com o suporte do marketplace para contestar tarifa de comissão.',
        details: baseDetails,
      };
    }

    return {
      entityId: order.id,
      entityType: 'order',
      title: `Pedido Conciliado (${order.numero})`,
      sku: order.numero,
      marketplace: mp,
      status: 'conciliado',
      severity: 'informativo',
      type: 'none',
      financialImpact: 0,
      reason: 'Valores, comissões e repasses correspondem entre ERP e Marketplace.',
      recommendation: 'Nenhuma ação necessária.',
      details: baseDetails,
    };
  }
}
