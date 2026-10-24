/**
 * Utilitários para tratamento, conversão e formatação de valores monetários e decimais
 * compatíveis com o padrão brasileiro (R$, vírgula decimal, ponto de milhar).
 */

/**
 * Converte qualquer entrada (string formatada com vírgula ou ponto, número ou nulo)
 * em um número de ponto flutuante válido.
 * 
 * Exemplos:
 *  parseMoeda("353,40")   => 353.40  (corrige o bug onde ficava 35340.00)
 *  parseMoeda("353.40")   => 353.40
 *  parseMoeda("1.353,40") => 1353.40
 *  parseMoeda("1,353.40") => 1353.40
 *  parseMoeda("R$ 353,40")=> 353.40
 *  parseMoeda(353.4)      => 353.40
 *  parseMoeda("")         => 0
 */
export function parseMoeda(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let str = String(val).trim();
  // Remove "R$" e espaços
  str = str.replace(/^R\$\s*/i, '').trim();
  if (!str) return 0;

  // Se contiver tanto ponto quanto vírgula
  if (str.includes('.') && str.includes(',')) {
    if (str.indexOf('.') < str.indexOf(',')) {
      // Padrão brasileiro: "1.234,56"
      const limpo = str.replace(/\./g, '').replace(',', '.');
      const num = parseFloat(limpo);
      return isNaN(num) ? 0 : num;
    } else {
      // Padrão americano: "1,234.56"
      const limpo = str.replace(/,/g, '');
      const num = parseFloat(limpo);
      return isNaN(num) ? 0 : num;
    }
  }

  // Se tiver mais de um ponto (ex: "1.000.000")
  if (str.split('.').length > 2) {
    str = str.replace(/\./g, '');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }

  // Se tiver apenas vírgula (ex: "353,40" ou "353,4")
  if (str.includes(',')) {
    const limpo = str.replace(',', '.');
    const num = parseFloat(limpo);
    return isNaN(num) ? 0 : num;
  }

  // Se tiver apenas um ponto (ex: "353.40" ou "353.4")
  // ATENÇÃO: NÃO remover o ponto! O ponto é o separador decimal legítimo.
  if (str.includes('.')) {
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }

  // Número inteiro simples sem separadores (ex: "353")
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Converte números decimais genéricos (ex: litros "45,5" ou KM) para float.
 */
export function parseNumeroDecimal(val: any): number {
  return parseMoeda(val);
}

/**
 * Formata um número para moeda brasileira (R$ 353,40).
 */
export function formatarMoeda(val: number | null | undefined, comPrefixo = true): string {
  if (val === null || val === undefined || isNaN(val)) {
    return comPrefixo ? 'R$ 0,00' : '0,00';
  }
  const formatado = Number(val).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return comPrefixo ? `R$ ${formatado}` : formatado;
}

/**
 * Formata um número para exibição em campo de input (ex: "353,40" ou vazio se zero/nulo).
 */
export function formatarValorInput(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return '';
  const num = typeof val === 'number' ? val : parseMoeda(val);
  if (isNaN(num) || num === 0) return '';
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
