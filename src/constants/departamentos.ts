/**
 * POLIHUB — REORGANIZAÇÃO DE DEPARTAMENTOS, FUNÇÕES E NÍVEIS
 * 
 * 1. DEPARTAMENTOS:
 * - Logística (Unifica "Logística & Recebimento" e "Expedição & Transporte")
 * - Comercial
 * - Financeiro
 * 
 * 2. FUNÇÕES (Filtradas por Departamento):
 * - Logística: Operador Logístico
 * - Comercial: Vendedor, Gerente
 * - Financeiro: Assistente
 * 
 * 3. NÍVEIS:
 * - Operador
 * - Assistente
 * - Gestor
 */

export const DEPARTAMENTOS = ['Logística', 'Comercial', 'Financeiro'] as const;
export type Departamento = (typeof DEPARTAMENTOS)[number];

export const FUNCOES_POR_DEPARTAMENTO: Record<Departamento, readonly string[]> = {
  'Logística': ['Operador Logístico', 'Motorista'],
  'Comercial': ['Vendedor', 'Gerente'],
  'Financeiro': ['Assistente'],
} as const;

export const NIVEIS_USUARIO = ['Operador', 'Assistente', 'Gestor'] as const;
export type NivelUsuario = (typeof NIVEIS_USUARIO)[number];

/**
 * Valida se a combinação de Departamento, Função e Nível é estritamente válida
 */
export function isCombinacaoValida(
  departamento?: string | null,
  funcao?: string | null,
  nivel?: string | null
): boolean {
  if (!departamento || !funcao || !nivel) return false;

  const deptValido = DEPARTAMENTOS.includes(departamento as Departamento);
  if (!deptValido) return false;

  const funcoesPermitidas = FUNCOES_POR_DEPARTAMENTO[departamento as Departamento] || [];
  const funcaoValida = funcoesPermitidas.includes(funcao);

  const nivelNormalizado = nivel.trim().toLowerCase();
  const nivelValido =
    nivelNormalizado === 'operador' ||
    nivelNormalizado === 'assistente' ||
    nivelNormalizado === 'gestor' ||
    nivelNormalizado === 'administrador';

  return deptValido && funcaoValida && nivelValido;
}

/**
 * Normaliza o nome do departamento para um dos 3 departamentos oficiais:
 * - "Logística & Recebimento" -> "Logística"
 * - "Expedição & Transporte" -> "Logística"
 * - "Logística Operacional" -> "Logística"
 * - "Comercial" -> "Comercial"
 * - "Financeiro" -> "Financeiro"
 */
export function normalizarDepartamento(dept?: string | null): Departamento {
  if (!dept) return 'Logística';
  const d = dept
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  if (d.includes('comercial') || d.includes('venda')) {
    return 'Comercial';
  }
  if (d.includes('financ')) {
    return 'Financeiro';
  }
  return 'Logística';
}

/**
 * Normaliza o nível de usuário para os 3 níveis oficiais:
 * - "gestor", "administrador", "gerente" -> "Gestor"
 * - "assistente" -> "Assistente"
 * - "operador", "conferente", etc. -> "Operador"
 */
export function normalizarNivelUsuario(nivel?: string | null): NivelUsuario {
  if (!nivel) return 'Operador';
  const n = nivel
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  if (n === 'gestor' || n === 'administrador') {
    return 'Gestor';
  }
  if (n === 'assistente') {
    return 'Assistente';
  }
  return 'Operador';
}
