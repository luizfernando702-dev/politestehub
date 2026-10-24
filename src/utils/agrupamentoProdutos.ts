/**
 * Utilitário para agrupamento inteligente de produtos na importação de pedidos de compra e notas fiscais.
 * 
 * Resolve o cenário onde o pedido de compra possui 2, 3 ou mais linhas para o mesmo item
 * (ex: entregas parciais, desdobramentos de compra, lotes), mas na Nota Fiscal vem apenas
 * 1 linha consolidada com a quantidade total somada.
 * 
 * Regra estrita: O agrupamento verifica se as descrições/códigos são rigorosamente iguais.
 * Pequenas diferenças (como "W7MULTI34S" vs "W7MULTI34D", "10mm" vs "12mm") representam
 * produtos totalmente distintos e NUNCA devem ser agrupados.
 */

export interface LinhaProdutoEntrada {
  linha: number;
  produto: string;
  quantidade: number;
  endereco: string | null;
  nota_fiscal: string;
  valido: boolean;
  erro?: string;
  [key: string]: any;
}

export interface DetalheLinhaAgrupada {
  linha: number;
  produtoOriginal: string;
  quantidade: number;
  endereco: string | null;
}

export interface ProdutoAgrupado {
  idTemp: string;
  produto: string;
  quantidade: number;
  endereco: string | null;
  nota_fiscal: string;
  valido: boolean;
  erro?: string;
  linhasOriginais: number[];
  detalhesLinhas: DetalheLinhaAgrupada[];
  foiAgrupado: boolean;
  qtdLinhasAgrupadas: number;
}

/**
 * Remove acentos de uma string.
 */
export function removerAcentos(str: string): string {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normaliza o texto de um produto para comparação:
 * - Converte para minúsculas
 * - Remove acentos
 * - Remove anotações comuns de pedidos de compra no final da descrição (ex: "(Item 01)", "(Ped 123)", "(Lote 02)", etc.)
 * - Unifica pontuações e espaços múltiplos
 */
export function normalizarDescricaoProduto(descricao: string): string {
  if (!descricao) return '';

  let texto = descricao.trim().toLowerCase();

  // Remove acentos
  texto = removerAcentos(texto);

  // Normaliza traços Unicode (en-dash, em-dash, etc) para hífen simples
  texto = texto.replace(/[\u2010-\u2015]/g, '-');

  // Remove anotações típicas de desdobramento de pedidos de compra no final da descrição:
  // Ex: "(Item 01)", "(Ped 1234)", "(Lote 02)", "- Item 2", "- Seq 01", "[Ped 99]"
  texto = texto.replace(/\s*[\(\[](item|ped|pedido|lote|seq|sequencia|ordem|po|remessa)[\s:#-]*\d+[\)\]]/gi, '');
  texto = texto.replace(/\s*[-–—/]\s*(item|ped|pedido|lote|seq|sequencia)[\s:#-]*\d+\b/gi, '');

  // Substitui múltiplos espaços por um único
  texto = texto.replace(/\s+/g, ' ').trim();

  // Remove pontuação das extremidades
  texto = texto.replace(/^[-–—_.:;,/\\ ]+|[-–—_.:;,/\\ ]+$/g, '');

  return texto;
}

/**
 * Tenta extrair código inicial do produto caso exista padrão como:
 * "10293 - PARAFUSO", "POLI-450: VALVULA", "[9981] FILTRO", etc.
 */
export function extrairCodigoProduto(descricao: string): string | null {
  if (!descricao) return null;
  const limpo = descricao.trim();

  // Padrão [CODIGO]
  const matchColchetes = limpo.match(/^\[([A-Za-z0-9._-]+)\]/);
  if (matchColchetes && matchColchetes[1].length >= 3) {
    return matchColchetes[1].toUpperCase();
  }

  // Padrão CODIGO - Descrição ou CODIGO : Descrição ou CODIGO / Descrição
  const matchSeparador = limpo.match(/^([A-Za-z0-9._-]{3,})\s*[-–—:/]\s*.+/);
  if (matchSeparador && matchSeparador[1]) {
    // Evita pegar palavras comuns curtas
    const candidato = matchSeparador[1].toUpperCase();
    if (/\d/.test(candidato) || candidato.length >= 4) {
      return candidato;
    }
  }

  return null;
}

/**
 * Remove código prefixado da descrição para comparar o restante do texto.
 */
export function removerCodigoDaDescricao(descricao: string, codigo: string): string {
  if (!descricao || !codigo) return (descricao || '').trim();
  const escaped = codigo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let limpo = descricao.trim();
  // Se inicia por [CODIGO]
  limpo = limpo.replace(new RegExp(`^\\[${escaped}\\]\\s*[-–—:/]?\\s*`, 'i'), '');
  // Se inicia por CODIGO - ou CODIGO : ou CODIGO /
  limpo = limpo.replace(new RegExp(`^${escaped}\\s*[-–—:/]\\s*`, 'i'), '');
  return limpo.trim();
}

/**
 * Calcula a distância Levenshtein entre duas strings.
 */
export function distanciaLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substituição
          matrix[i][j - 1] + 1,     // inserção
          matrix[i - 1][j] + 1      // deleção
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calcula índice de similaridade entre 0 e 1 (1 = idêntico).
 */
export function calcularSimilaridade(strA: string, strB: string): number {
  const a = normalizarDescricaoProduto(strA);
  const b = normalizarDescricaoProduto(strB);

  if (a === b) return 1.0;
  if (!a || !b) return 0.0;

  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;

  const dist = distanciaLevenshtein(a, b);
  return (maxLen - dist) / maxLen;
}

/**
 * Compara tokens (palavras) ignorando ordem.
 */
export function similaridadePorPalavras(strA: string, strB: string): number {
  const normA = normalizarDescricaoProduto(strA);
  const normB = normalizarDescricaoProduto(strB);

  const tokensA = normA.split(/[\s,.-]+/).filter((t) => t.length > 1);
  const tokensB = normB.split(/[\s,.-]+/).filter((t) => t.length > 1);

  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let intersecao = 0;
  for (const t of setA) {
    if (setB.has(t)) intersecao++;
  }

  const uniao = new Set([...setA, ...setB]).size;
  return intersecao / uniao;
}

/**
 * Verifica se dois produtos devem ser considerados o mesmo item para agrupamento.
 * 
 * Regra: As descrições devem ser rigorosamente iguais (ignorando apenas maiúsculas/minúsculas,
 * acentuação, espaços e anotações de pedido de compra como "- Item 01").
 * 
 * NÃO realiza aproximação por similaridade textual (Levenshtein, Jaccard ou prefixo),
 * pois códigos com pequenas diferenças (ex: W7MULTI34S vs W7MULTI34D) são produtos
 * totalmente distintos na prática.
 */
export function saoProdutosIguais(prodA: string, prodB: string): boolean {
  if (!prodA || !prodB) return false;

  const rawA = prodA.trim();
  const rawB = prodB.trim();
  if (rawA === rawB) return true;

  const normA = normalizarDescricaoProduto(prodA);
  const normB = normalizarDescricaoProduto(prodB);

  // 1. Igualdade estrita após normalização
  if (normA && normB && normA === normB) {
    return true;
  }

  // 2. Extração de códigos (ex: "[W7MULTI34S] PECA" vs "W7MULTI34S - PECA")
  const codA = extrairCodigoProduto(prodA);
  const codB = extrairCodigoProduto(prodB);

  if (codA && codB) {
    // Se ambos possuem código e os códigos diferem, NUNCA são o mesmo produto
    if (codA !== codB) {
      return false;
    }

    // Se os códigos são idênticos, valida se as descrições após o código também são idênticas
    const descA = removerCodigoDaDescricao(prodA, codA);
    const descB = removerCodigoDaDescricao(prodB, codB);
    const normDescA = normalizarDescricaoProduto(descA);
    const normDescB = normalizarDescricaoProduto(descB);

    if (normDescA && normDescB && normDescA === normDescB) {
      return true;
    }
    // Se não sobrou texto de descrição em ambos (eram apenas o código), são iguais
    if (!normDescA && !normDescB) {
      return true;
    }
  }

  return false;
}

/**
 * Alias para compatibilidade com chamadas existentes.
 * Garante que nenhuma chamada externa use aproximação permissiva/fuzzy.
 */
export const saoProdutosSemelhantes = saoProdutosIguais;

/**
 * Agrupa linhas de produtos da planilha com base na igualdade da descrição/código.
 * 
 * Regras:
 * - Agrupa linhas com descrição/código rigorosamente iguais
 * - Soma as quantidades (quantidade_total = sum(quantidades))
 * - Preserva o endereço preferencialmente não-nulo
 * - Mantém o histórico das linhas originais que foram unificadas
 */
export function agruparProdutosExcel(linhas: LinhaProdutoEntrada[]): {
  itensAgrupados: ProdutoAgrupado[];
  totalLinhasOriginais: number;
  totalItensAgrupados: number;
  qtdLinhasConsolidadas: number;
} {
  const grupos: ProdutoAgrupado[] = [];

  for (const item of linhas) {
    // Se a linha for inválida por erro estrutural grave (sem produto), mantém individual
    if (!item.produto || item.produto === '(Vazio)') {
      grupos.push({
        idTemp: `grp-inv-${item.linha}`,
        produto: item.produto || '(Vazio)',
        quantidade: item.quantidade || 0,
        endereco: item.endereco || null,
        nota_fiscal: item.nota_fiscal,
        valido: item.valido,
        erro: item.erro,
        linhasOriginais: [item.linha],
        detalhesLinhas: [
          {
            linha: item.linha,
            produtoOriginal: item.produto,
            quantidade: item.quantidade,
            endereco: item.endereco || null,
          },
        ],
        foiAgrupado: false,
        qtdLinhasAgrupadas: 1,
      });
      continue;
    }

    // Procura grupo existente com produto de descrição igual
    let grupoEncontrado = grupos.find((g) => {
      // Mesma nota fiscal (se houver) e descrição estritamente igual
      const mesmaNF =
        !g.nota_fiscal ||
        !item.nota_fiscal ||
        g.nota_fiscal.trim().toLowerCase() === item.nota_fiscal.trim().toLowerCase();

      return mesmaNF && saoProdutosIguais(g.produto, item.produto);
    });

    if (grupoEncontrado) {
      // Consolida no grupo existente
      grupoEncontrado.quantidade = Number((grupoEncontrado.quantidade + (item.quantidade || 0)).toFixed(2));
      grupoEncontrado.linhasOriginais.push(item.linha);
      grupoEncontrado.detalhesLinhas.push({
        linha: item.linha,
        produtoOriginal: item.produto,
        quantidade: item.quantidade || 0,
        endereco: item.endereco || null,
      });
      grupoEncontrado.foiAgrupado = true;
      grupoEncontrado.qtdLinhasAgrupadas = grupoEncontrado.linhasOriginais.length;

      // Se o grupo não tinha endereço e a nova linha tem, atualiza
      if (!grupoEncontrado.endereco && item.endereco) {
        grupoEncontrado.endereco = item.endereco.trim();
      }

      // Se a nova linha tem uma descrição mais limpa/canônica (ex: sem sufixos de lote/pedido), atualiza
      const normExistente = normalizarDescricaoProduto(grupoEncontrado.produto);
      const normNovo = normalizarDescricaoProduto(item.produto);
      if (normNovo.length > 0 && normNovo.length < normExistente.length && normExistente.includes(normNovo)) {
        grupoEncontrado.produto = item.produto;
      }

      // Se alguma linha anterior era inválida mas essa é válida ou vice-versa
      if (!item.valido && item.erro) {
        grupoEncontrado.erro = grupoEncontrado.erro
          ? `${grupoEncontrado.erro}; L${item.linha}: ${item.erro}`
          : `L${item.linha}: ${item.erro}`;
      }
    } else {
      // Cria novo grupo
      grupos.push({
        idTemp: `grp-${item.linha}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        produto: item.produto,
        quantidade: item.quantidade || 0,
        endereco: item.endereco || null,
        nota_fiscal: item.nota_fiscal,
        valido: item.valido,
        erro: item.erro,
        linhasOriginais: [item.linha],
        detalhesLinhas: [
          {
            linha: item.linha,
            produtoOriginal: item.produto,
            quantidade: item.quantidade || 0,
            endereco: item.endereco || null,
          },
        ],
        foiAgrupado: false,
        qtdLinhasAgrupadas: 1,
      });
    }
  }

  const totalLinhasOriginais = linhas.length;
  const totalItensAgrupados = grupos.length;
  const qtdLinhasConsolidadas = totalLinhasOriginais - totalItensAgrupados;

  return {
    itensAgrupados: grupos,
    totalLinhasOriginais,
    totalItensAgrupados,
    qtdLinhasConsolidadas: Math.max(0, qtdLinhasConsolidadas),
  };
}
