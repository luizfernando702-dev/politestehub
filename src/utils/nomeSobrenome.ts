/**
 * POLIHUB — PADRONIZAÇÃO DE NOME E SOBRENOME (Item 6)
 * 
 * Regras:
 * - Limite de 12 caracteres para Nome e 12 caracteres para Sobrenome.
 * - Formatação automática: Primeira letra maiúscula, restante minúsculas (Title Case).
 *   Ex: FERNANDO -> Fernando, luiz -> Luiz, mARTINS -> Martins.
 * - Preserva espaços para nomes compostos se houver.
 */

/**
 * Formata um campo de nome ou sobrenome para Title Case e limita a 12 caracteres.
 */
export function formatarParteNome(texto?: string | null, maxLen = 12): string {
  if (!texto) return '';
  const limpo = texto.trim();
  if (!limpo) return '';

  const palavras = limpo.split(/\s+/).map((palavra) => {
    if (!palavra) return '';
    return palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase();
  });

  const formatado = palavras.join(' ');
  return formatado.slice(0, maxLen);
}

/**
 * Divide um nome completo existente em primeiro nome e sobrenome,
 * formatando cada um com a regra de capitalização e limite de 12 caracteres.
 */
export function dividirNomeESobrenome(nomeCompleto?: string | null): { nome: string; sobrenome: string } {
  if (!nomeCompleto || !nomeCompleto.trim()) {
    return { nome: '', sobrenome: '' };
  }
  const partes = nomeCompleto.trim().split(/\s+/);
  if (partes.length === 0) return { nome: '', sobrenome: '' };
  if (partes.length === 1) {
    return {
      nome: formatarParteNome(partes[0]),
      sobrenome: '',
    };
  }
  const primeiro = formatarParteNome(partes[0]);
  const restante = formatarParteNome(partes.slice(1).join(' '));
  return {
    nome: primeiro,
    sobrenome: restante,
  };
}

/**
 * Junta primeiro nome e sobrenome garantindo que cada um tenha no máximo 12 caracteres
 * e esteja devidamente capitalizado.
 */
export function juntarNomeESobrenome(primeiroNome: string, sobrenome: string): string {
  const n = formatarParteNome(primeiroNome);
  const s = formatarParteNome(sobrenome);
  if (n && s) return `${n} ${s}`;
  return n || s || '';
}

/**
 * Retorna uma versão compacta "Nome e Sobrenome" para exibição em listas.
 */
export function formatarNomeSobrenomeExibicao(nomeCompleto?: string | null): string {
  if (!nomeCompleto || !nomeCompleto.trim()) return 'Colaborador';
  const partes = nomeCompleto.trim().split(/\s+/);
  if (partes.length === 1) return formatarParteNome(partes[0]);
  const primeiro = formatarParteNome(partes[0]);
  const ultimo = formatarParteNome(partes[partes.length - 1]);
  return `${primeiro} ${ultimo}`;
}

/**
 * Validação de tamanho máximo de 12 caracteres para nome e sobrenome
 */
export function validarTamanhoNomeSobrenome(nome: string, sobrenome: string): { valido: boolean; erro?: string } {
  const n = nome.trim();
  const s = sobrenome.trim();

  if (!n) {
    return { valido: false, erro: 'O nome é obrigatório.' };
  }
  if (n.length > 12) {
    return { valido: false, erro: 'O primeiro nome não pode ultrapassar 12 caracteres.' };
  }
  if (s.length > 12) {
    return { valido: false, erro: 'O sobrenome não pode ultrapassar 12 caracteres.' };
  }

  return { valido: true };
}
