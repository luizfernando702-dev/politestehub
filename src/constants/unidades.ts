/**
 * POLIHUB — CONFIGURAÇÃO CENTRALIZADA DE UNIDADES DE NEGÓCIO
 * 
 * Regra:
 * As opções de unidades de negócio são centralizadas aqui para facilitar
 * a inclusão e manutenção de novas unidades sem espalhar condicionais pelo código.
 */

export interface UnidadeNegocioConfig {
  id: string;
  nome: string;
  sigla?: string;
  ativo: boolean;
  descricao?: string;
}

export const UNIDADES_NEGOCIO_PADRAO: UnidadeNegocioConfig[] = [
  {
    id: 'goiania',
    nome: 'Goiânia-GO',
    sigla: 'GYN',
    ativo: true,
    descricao: 'Unidade Matriz / Distribuição Goiânia - GO',
  },
  {
    id: 'mato_grosso',
    nome: 'Mato Grosso',
    sigla: 'MT',
    ativo: true,
    descricao: 'Unidade Filial Mato Grosso - MT',
  },
];

/**
 * Constante mantida para retrocompatibilidade com componentes e builds.
 * A fonte primária de unidades dinâmicas é a tabela Supabase public.unidades_negocio
 * acessada através do unidadesNegocioService.
 */
export const UNIDADES_NEGOCIO = UNIDADES_NEGOCIO_PADRAO;

export const UNIDADE_PADRAO_SISTEMA = 'Goiânia-GO';

/**
 * Retorna a lista de nomes de unidades ativas
 */
export function getUnidadesNomes(): string[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('polihub_unidades_negocio');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const ativas = parsed
            .filter((u: any) => u.ativo !== false)
            .map((u: any) => String(u.nome).trim());
          if (ativas.length > 0) return ativas;
        }
      }
    } catch {
      // fallback
    }
  }
  return UNIDADES_NEGOCIO_PADRAO.filter((u) => u.ativo).map((u) => u.nome);
}

/**
 * Normaliza o nome da unidade para comparações consistentes
 */
export function normalizarUnidadeNegocio(unidade?: string | null): string {
  if (!unidade || typeof unidade !== 'string') return UNIDADE_PADRAO_SISTEMA;
  const limpo = unidade.trim();
  if (limpo.toLowerCase() === 'goiânia' || limpo.toLowerCase() === 'goiania') {
    return 'Goiânia-GO';
  }
  const nomes = getUnidadesNomes();
  const encontrada = nomes.find((n) => n.toLowerCase() === limpo.toLowerCase());
  return encontrada || limpo;
}

/**
 * Compara se duas unidades de negócio são equivalentes,
 * tratando variações como 'Goiânia' e 'Goiânia-GO'.
 */
export function unidadesIguais(u1?: string | null, u2?: string | null): boolean {
  if (!u1 || !u2) return false;
  const n1 = normalizarUnidadeNegocio(u1).toLowerCase();
  const n2 = normalizarUnidadeNegocio(u2).toLowerCase();
  if (n1 === n2) return true;
  const s1 = u1.trim().toLowerCase();
  const s2 = u2.trim().toLowerCase();
  if (s1 === s2) return true;
  if ((s1.includes('goi') || s1.includes('gyn')) && (s2.includes('goi') || s2.includes('gyn'))) {
    return true;
  }
  if (s1.includes('mato') && s2.includes('mato')) {
    return true;
  }
  if ((s1.includes('belo') || s1.includes('bh')) && (s2.includes('belo') || s2.includes('bh'))) {
    return true;
  }
  if ((s1.includes('sao') || s1.includes('são') || s1 === 'sp') && (s2.includes('sao') || s2.includes('são') || s2 === 'sp')) {
    return true;
  }
  const clean1 = s1.replace(/[-/]\s*[a-z]{2}$/i, '').trim();
  const clean2 = s2.replace(/[-/]\s*[a-z]{2}$/i, '').trim();
  if (clean1 && clean1 === clean2) return true;
  return false;
}

/**
 * Valida se um nome de unidade é reconhecido no catálogo
 */
export function isUnidadeValida(unidade?: string | null): boolean {
  if (!unidade || typeof unidade !== 'string') return false;
  const limpo = unidade.trim().toLowerCase();
  const nomes = getUnidadesNomes();
  return nomes.some((n) => n.toLowerCase() === limpo);
}
