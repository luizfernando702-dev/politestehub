/**
 * POLIHUB — Tratamento Central de Endereçamento e Sem Locação (*S/L_GO)
 * 
 * Regra Obrigatória:
 * O valor "*S/L_GO" representa um produto que atualmente não possui localização definida.
 * Deve ser interpretado internamente e exibido ao usuário como "Sem Locação".
 * Não pode ser utilizado como endereço final de uma alocação ou alteração avulsa.
 */

export const ENDERECO_SEM_LOCACAO_RAW = '*S/L_GO';
export const ENDERECO_SEM_LOCACAO_LABEL = 'Sem Locação';

/**
 * Verifica se um endereço é nulo, vazio ou representa "Sem Locação" (*S/L_GO).
 */
export function isEnderecoSemLocacao(endereco?: string | null): boolean {
  if (!endereco) return false;
  const limpo = endereco.trim().toUpperCase();
  return (
    limpo === ENDERECO_SEM_LOCACAO_RAW.toUpperCase() ||
    limpo === '*S/L' ||
    limpo === 'S/L' ||
    limpo === 'SEM LOCAÇÃO' ||
    limpo === 'SEM LOCACAO' ||
    limpo === 'SEM LOCAL' ||
    limpo === 'SEM ENDEREÇO' ||
    limpo === 'SEM ENDERECO'
  );
}

/**
 * Retorna o rótulo amigável para exibição visual do endereço.
 * Se for *S/L_GO ou vazio, exibe "Sem Locação".
 */
export function formatarEnderecoDisplay(endereco?: string | null, fallback = 'Sem Locação'): string {
  if (!endereco || !endereco.trim()) return fallback;
  if (isEnderecoSemLocacao(endereco)) {
    return ENDERECO_SEM_LOCACAO_LABEL;
  }
  return endereco.trim();
}

/**
 * Valida se um novo endereço informado para alocação ou alteração avulsa é válido.
 * Sem Locação (*S/L_GO) é estritamente proibido como endereço final.
 */
export function validarEnderecoDestino(
  novoEndereco?: string | null,
  contexto: 'alocacao' | 'avulsa' = 'alocacao'
): { valido: boolean; erro?: string } {
  if (!novoEndereco || !novoEndereco.trim()) {
    return {
      valido: false,
      erro: 'Informe um endereço físico válido para salvar.',
    };
  }

  const limpo = novoEndereco.trim();

  if (limpo.length < 3) {
    return {
      valido: false,
      erro: 'O endereço deve possuir pelo menos 3 caracteres.',
    };
  }

  if (isEnderecoSemLocacao(limpo)) {
    return {
      valido: false,
      erro:
        contexto === 'alocacao'
          ? 'Informe um endereço válido para realizar a alocação. O produto está atualmente como Sem Locação.'
          : 'Informe um endereço válido para realizar a alteração. O produto está atualmente como Sem Locação.',
    };
  }

  return { valido: true };
}
