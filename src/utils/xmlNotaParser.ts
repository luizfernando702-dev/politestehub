/**
 * Utilitário para leitura e extração de dados de XML de Nota Fiscal Eletrônica (NF-e)
 * Projetado para segurança: preços e valores financeiros são estritamente mascarados.
 */

export interface ItemNotaXml {
  numeroItem: number;
  codigo: string;
  descricao: string;
  ncm?: string;
  cfop?: string;
  unidade: string;
  quantidade: number;
  ean?: string;
  informacoesAdicionais?: string;
  // Valores mascarados para segurança de custos
  valorUnitarioMascarado: string;
  valorTotalMascarado: string;
}

export interface DadosNotaXml {
  valido: boolean;
  erro?: string;
  chaveAcesso?: string;
  numeroNota?: string;
  serie?: string;
  tipoOperacao?: 'Entrada' | 'Saída';
  dataEmissao?: string;
  naturezaOperacao?: string;
  emitente?: {
    razaoSocial: string;
    nomeFantasia?: string;
    cnpjCpf: string;
    inscricaoEstadual?: string;
    municipio?: string;
    uf?: string;
  };
  destinatario?: {
    razaoSocial: string;
    cnpjCpf: string;
    municipio?: string;
    uf?: string;
  };
  transporte?: {
    nome?: string;
    cnpjCpf?: string;
    volumes?: number;
    especie?: string;
  };
  itens: ItemNotaXml[];
  totalItens: number;
  totalQuantidade: number;
  valorTotalNotaMascarado: string;
}

/**
 * Função auxiliar que busca conteúdo de uma tag pelo nome (insensível a namespaces)
 */
function getTagText(parent: Element | Document, tagName: string): string {
  // 1. Tenta getElementsByTagName direto
  const direct = parent.getElementsByTagName(tagName);
  if (direct && direct.length > 0 && direct[0].textContent) {
    return direct[0].textContent.trim();
  }

  // 2. Busca por localName se houver namespace (ex: nfe:xProd)
  const allElements = parent.getElementsByTagName('*');
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    if (el.localName === tagName || el.nodeName.toLowerCase() === tagName.toLowerCase()) {
      return el.textContent ? el.textContent.trim() : '';
    }
  }

  return '';
}

/**
 * Formata CPF ou CNPJ com máscara padrão
 */
function formatarCnpjCpf(doc: string): string {
  const clean = doc.replace(/\D/g, '');
  if (clean.length === 14) {
    return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  if (clean.length === 11) {
    return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return doc;
}

/**
 * Faz o parse seguro do XML da Nota Fiscal Eletrônica.
 * Todos os valores monetários são intencionalmente mascarados como 'R$ ••••••'.
 */
export function parseXmlNotaFiscal(xmlString: string): DadosNotaXml {
  if (!xmlString || typeof xmlString !== 'string' || xmlString.trim().length === 0) {
    return {
      valido: false,
      erro: 'Conteúdo XML vazio ou inválido.',
      itens: [],
      totalItens: 0,
      totalQuantidade: 0,
      valorTotalNotaMascarado: 'R$ •••••• (Confidencial)',
    };
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    // Verifica erros de sintaxe do parser
    const parserError = doc.getElementsByTagName('parsererror');
    if (parserError && parserError.length > 0) {
      return {
        valido: false,
        erro: 'Arquivo XML malformado ou corrompido.',
        itens: [],
        totalItens: 0,
        totalQuantidade: 0,
        valorTotalNotaMascarado: 'R$ •••••• (Confidencial)',
      };
    }

    // Chave de acesso (Id no infNFe ou protNFe/chNFe)
    let chaveAcesso = '';
    const infNFe = doc.getElementsByTagName('infNFe')[0] || doc.querySelector('[Id]');
    if (infNFe) {
      const idAttr = infNFe.getAttribute('Id') || '';
      chaveAcesso = idAttr.replace(/^NFe/i, '').trim();
    }
    if (!chaveAcesso) {
      chaveAcesso = getTagText(doc, 'chNFe');
    }

    // Identificação (<ide>)
    const ide = doc.getElementsByTagName('ide')[0] || doc;
    const numeroNota = getTagText(ide, 'nNF');
    const serie = getTagText(ide, 'serie');
    const natOp = getTagText(ide, 'natOp');
    const tpNF = getTagText(ide, 'tpNF');
    const tipoOperacao: 'Entrada' | 'Saída' = tpNF === '0' ? 'Entrada' : 'Saída';

    // Data de emissão (dhEmi ou dEmi)
    let dataEmissao = getTagText(ide, 'dhEmi');
    if (!dataEmissao) {
      dataEmissao = getTagText(ide, 'dEmi');
    }

    // Emitente (<emit>)
    const emit = doc.getElementsByTagName('emit')[0];
    let emitente: DadosNotaXml['emitente'] = undefined;
    if (emit) {
      const cnpj = getTagText(emit, 'CNPJ') || getTagText(emit, 'CPF');
      const xNome = getTagText(emit, 'xNome');
      const xFant = getTagText(emit, 'xFant');
      const ie = getTagText(emit, 'IE');
      const xMun = getTagText(emit, 'xMun');
      const uf = getTagText(emit, 'UF');

      emitente = {
        razaoSocial: xNome || 'Não informado',
        nomeFantasia: xFant || undefined,
        cnpjCpf: formatarCnpjCpf(cnpj),
        inscricaoEstadual: ie || undefined,
        municipio: xMun || undefined,
        uf: uf || undefined,
      };
    }

    // Destinatário (<dest>)
    const dest = doc.getElementsByTagName('dest')[0];
    let destinatario: DadosNotaXml['destinatario'] = undefined;
    if (dest) {
      const cnpjDest = getTagText(dest, 'CNPJ') || getTagText(dest, 'CPF');
      const xNomeDest = getTagText(dest, 'xNome');
      const xMunDest = getTagText(dest, 'xMun');
      const ufDest = getTagText(dest, 'UF');

      destinatario = {
        razaoSocial: xNomeDest || 'Não informado',
        cnpjCpf: formatarCnpjCpf(cnpjDest),
        municipio: xMunDest || undefined,
        uf: ufDest || undefined,
      };
    }

    // Transporte (<transp>)
    const transp = doc.getElementsByTagName('transp')[0];
    let transporte: DadosNotaXml['transporte'] = undefined;
    if (transp) {
      const xNomeTransp = getTagText(transp, 'xNome');
      const cnpjTransp = getTagText(transp, 'CNPJ') || getTagText(transp, 'CPF');
      const qVol = getTagText(transp, 'qVol');
      const esp = getTagText(transp, 'esp');

      transporte = {
        nome: xNomeTransp || undefined,
        cnpjCpf: cnpjTransp ? formatarCnpjCpf(cnpjTransp) : undefined,
        volumes: qVol ? parseInt(qVol, 10) : undefined,
        especie: esp || undefined,
      };
    }

    // Itens (<det>)
    const detElements = doc.getElementsByTagName('det');
    const itens: ItemNotaXml[] = [];
    let totalQuantidade = 0;

    if (detElements && detElements.length > 0) {
      for (let i = 0; i < detElements.length; i++) {
        const det = detElements[i];
        const nItem = parseInt(det.getAttribute('nItem') || String(i + 1), 10);
        const prod = det.getElementsByTagName('prod')[0] || det;

        const cProd = getTagText(prod, 'cProd') || `SKU-${i + 1}`;
        const cEAN = getTagText(prod, 'cEAN');
        const xProd = getTagText(prod, 'xProd') || 'Produto sem descrição';
        const ncm = getTagText(prod, 'NCM');
        const cfop = getTagText(prod, 'CFOP');
        const uCom = (getTagText(prod, 'uCom') || 'UN').toUpperCase();
        const rawQtd = getTagText(prod, 'qCom') || '1';
        const quantidade = parseFloat(rawQtd.replace(',', '.')) || 1;
        const infAdProd = getTagText(det, 'infAdProd');

        totalQuantidade += quantidade;

        itens.push({
          numeroItem: nItem,
          codigo: cProd,
          descricao: xProd,
          ncm: ncm || undefined,
          cfop: cfop || undefined,
          unidade: uCom,
          quantidade,
          ean: cEAN && cEAN !== 'SEM GTIN' ? cEAN : undefined,
          informacoesAdicionais: infAdProd || undefined,
          valorUnitarioMascarado: 'R$ ••••••',
          valorTotalMascarado: 'R$ ••••••',
        });
      }
    } else {
      // Fallback para XMLs que possuem tags <prod> diretamente sem <det>
      const prodElements = doc.getElementsByTagName('prod');
      for (let i = 0; i < prodElements.length; i++) {
        const prod = prodElements[i];
        const cProd = getTagText(prod, 'cProd') || `SKU-${i + 1}`;
        const cEAN = getTagText(prod, 'cEAN');
        const xProd = getTagText(prod, 'xProd') || 'Produto';
        const ncm = getTagText(prod, 'NCM');
        const cfop = getTagText(prod, 'CFOP');
        const uCom = (getTagText(prod, 'uCom') || 'UN').toUpperCase();
        const rawQtd = getTagText(prod, 'qCom') || '1';
        const quantidade = parseFloat(rawQtd.replace(',', '.')) || 1;

        totalQuantidade += quantidade;

        itens.push({
          numeroItem: i + 1,
          codigo: cProd,
          descricao: xProd,
          ncm: ncm || undefined,
          cfop: cfop || undefined,
          unidade: uCom,
          quantidade,
          ean: cEAN && cEAN !== 'SEM GTIN' ? cEAN : undefined,
          valorUnitarioMascarado: 'R$ ••••••',
          valorTotalMascarado: 'R$ ••••••',
        });
      }
    }

    return {
      valido: true,
      chaveAcesso: chaveAcesso || undefined,
      numeroNota: numeroNota || undefined,
      serie: serie || undefined,
      tipoOperacao,
      dataEmissao: dataEmissao || undefined,
      naturezaOperacao: natOp || undefined,
      emitente,
      destinatario,
      transporte,
      itens,
      totalItens: itens.length,
      totalQuantidade,
      valorTotalNotaMascarado: 'R$ •••••• (Confidencial)',
    };
  } catch (error) {
    return {
      valido: false,
      erro: error instanceof Error ? error.message : 'Falha ao processar o arquivo XML.',
      itens: [],
      totalItens: 0,
      totalQuantidade: 0,
      valorTotalNotaMascarado: 'R$ •••••• (Confidencial)',
    };
  }
}
