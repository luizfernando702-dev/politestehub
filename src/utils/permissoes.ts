/**
 * POLIHUB — REGRAS DE PERMISSÃO E SEGURANÇA OPERACIONAL
 * 
 * 1. Níveis:
 *    - Gestor
 *    - Assistente
 *    - Operador
 * 
 * 2. Departamentos:
 *    - Logística
 *    - Comercial
 *    - Financeiro
 */

export interface UsuarioPermissaoParam {
  nivel?: string | null;
  funcao?: string | null;
  departamento?: string | null;
}

/**
 * Remove acentos e converte para minúsculas para comparações seguras
 */
export function normalizarTextoPermissao(str?: string | null): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Identifica se o usuário possui nível Assistente ou Gestor
 */
export function isAssistenteOuGestor(usuario?: UsuarioPermissaoParam | null): boolean {
  if (!usuario) return false;
  const nivel = normalizarTextoPermissao(usuario.nivel);
  return nivel === 'gestor' || nivel === 'administrador' || nivel === 'assistente';
}

/**
 * Identifica se o usuário possui nível Gestor
 */
export function isGestorPermissao(usuario?: UsuarioPermissaoParam | null): boolean {
  if (!usuario) return false;
  const nivel = normalizarTextoPermissao(usuario.nivel);
  return nivel === 'gestor' || nivel === 'administrador';
}

/**
 * Identifica se o usuário pertence ao departamento Logística
 */
export function isLogisticaPermissao(usuario?: UsuarioPermissaoParam | null): boolean {
  if (!usuario) return false;
  const dept = normalizarTextoPermissao(usuario.departamento);
  return (
    dept === 'logistica' ||
    dept.includes('logistica') ||
    dept.includes('recebimento') ||
    dept.includes('expedicao') ||
    dept.includes('transporte')
  );
}

/**
 * Alocação — Confirmação de Alterações:
 * - Somente Assistente e Gestor confirmam alterações.
 * - Demais usuários da Logística apenas visualizam.
 */
export function podeConfirmarAlteracaoEndereco(usuario?: UsuarioPermissaoParam | null): boolean {
  return isAssistenteOuGestor(usuario);
}

/**
 * Pedidos — Chamados Logísticos:
 * - Exibir o botão Finalizar nos detalhes do chamado somente para usuários com nível Assistente ou Gestor.
 */
export function podeFinalizarChamado(usuario?: UsuarioPermissaoParam | null): boolean {
  return isAssistenteOuGestor(usuario);
}

/**
 * Pedidos:
 * - Todos visualizam.
 * - Assistente e Gestor criam, editam e excluem.
 */
export function podeGerenciarPedidos(usuario?: UsuarioPermissaoParam | null): boolean {
  return isAssistenteOuGestor(usuario);
}

/**
 * Coletas da Expedição:
 * - Assistente e Gestor criam, editam e excluem.
 */
export function podeGerenciarColetas(usuario?: UsuarioPermissaoParam | null): boolean {
  return isAssistenteOuGestor(usuario);
}
