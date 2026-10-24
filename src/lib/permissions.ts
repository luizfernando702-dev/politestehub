import { Usuario } from '../types';
import { normalizarTextoPermissao } from '../utils/permissoes';

/**
 * Remove acentos e converte para minúsculas
 */
export const normalizarTexto = normalizarTextoPermissao;

/**
 * 3. NÍVEIS
 * Manter somente:
 * - Operador
 * - Assistente
 * - Gestor
 */
export const isUserGestor = (user?: Usuario | null): boolean => {
  if (!user?.nivel) return false;
  const nivel = normalizarTexto(user.nivel);
  return nivel === 'gestor' || nivel === 'administrador';
};

export const isUserAssistente = (user?: Usuario | null): boolean => {
  if (!user?.nivel) return false;
  const nivel = normalizarTexto(user.nivel);
  return nivel === 'assistente';
};

export const isUserOperador = (user?: Usuario | null): boolean => {
  if (!user?.nivel) return false;
  const nivel = normalizarTexto(user.nivel);
  return nivel === 'operador';
};

/**
 * 1. DEPARTAMENTOS
 * Trabalhar somente com 3 departamentos:
 * - Logística
 * - Comercial
 * - Financeiro
 * 
 * Unificação:
 * - Logística & Recebimento -> Logística
 * - Expedição & Transporte -> Logística
 */
export const isUserLogistica = (user?: Usuario | null): boolean => {
  if (!user?.departamento) return false;
  const dept = normalizarTexto(user.departamento);
  return (
    dept === 'logistica' ||
    dept.includes('logistica') ||
    dept.includes('recebimento') ||
    dept.includes('expedicao') ||
    dept.includes('transporte')
  );
};

// Aliases para manter compatibilidade com componentes existentes
export const isUserLogisticaERecebimento = isUserLogistica;
export const isUserExpedicaoETransporte = isUserLogistica;

export const isUserComercial = (user?: Usuario | null): boolean => {
  if (!user?.departamento) return false;
  const dept = normalizarTexto(user.departamento);
  return dept === 'comercial' || dept.includes('comercial');
};

export const isUserFinanceiro = (user?: Usuario | null): boolean => {
  if (!user?.departamento) return false;
  const dept = normalizarTexto(user.departamento);
  return dept === 'financeiro' || dept.includes('financeiro');
};

/**
 * 5. REGRAS DE PERMISSÕES POR MÓDULO
 *
 * Agendamentos:
 * - Todos visualizam.
 * - Somente Gestor cria, edita e exclui.
 * - Gestor e Assistente podem subir/anexar XML da Nota Fiscal.
 */
export const canUserAccessAgendamentos = (user?: Usuario | null): boolean => Boolean(user);
export const canUserManageAgendamentos = (user?: Usuario | null): boolean => isUserGestor(user);
export const canUserUploadXmlAgendamento = (user?: Usuario | null): boolean => {
  if (!user) return false;
  return isUserGestor(user) || isUserAssistente(user);
};

/**
 * Recebimentos — Menu Principal:
 * - O menu "Recebimentos" fica visível para TODOS os usuários (incluindo Comercial e Financeiro).
 */
export const canUserAccessRecebimento = (user?: Usuario | null): boolean => Boolean(user);

/**
 * Recebimentos — Abas Operacionais (Abertas e Conferidas):
 * - Acessíveis SOMENTE para usuários do departamento Logística (e Gestores).
 */
export const canUserOperarRecebimento = (user?: Usuario | null): boolean => {
  if (!user) return false;
  return isUserLogistica(user) || isUserGestor(user);
};

/**
 * Recebimentos — Aba Gráficos:
 * - Visível SOMENTE para usuários dos departamentos Comercial e Logística.
 */
export const canUserAccessGraficosRecebimento = (user?: Usuario | null): boolean => {
  if (!user) return false;
  return isUserComercial(user) || isUserLogistica(user) || isUserGestor(user);
};

/**
 * Alocação:
 * - Logística (e Gestor com acesso operacional).
 * - Todos da Logística visualizam alterações.
 * - Somente Assistente e Gestor confirmam alterações.
 */
export const canUserAccessAlocacao = (user?: Usuario | null): boolean => {
  if (!user) return false;
  return isUserLogistica(user) || isUserGestor(user);
};

export const canUserConfirmarAlocacao = (user?: Usuario | null): boolean => {
  if (!user) return false;
  return isUserGestor(user) || isUserAssistente(user);
};

/**
 * Pedidos:
 * - Todos visualizam.
 * - Assistente e Gestor criam, editam e excluem.
 */
export const canUserAccessPedidos = (user?: Usuario | null): boolean => Boolean(user);

export const podeGerenciarPedidos = (user?: Usuario | null): boolean => {
  if (!user) return false;
  return isUserGestor(user) || isUserAssistente(user);
};

export const canUserManagePedidos = podeGerenciarPedidos;

/**
 * Tarefas:
 * - Usuário visualiza somente as próprias.
 * - Gestor possui CRUD completo.
 */
export const canUserAccessTarefas = (user?: Usuario | null): boolean => Boolean(user);
export const canUserManageTarefas = (user?: Usuario | null): boolean => isUserGestor(user);

/**
 * Inventário:
 * - Logística (e Gestor com acesso operacional).
 */
export const canUserAccessInventario = (user?: Usuario | null): boolean => {
  if (!user) return false;
  return isUserLogistica(user) || isUserGestor(user);
};

/**
 * Auditoria de Contagens (Listar e Auditar Contagens):
 * - Usuários de nível Gestor ou Assistente possuem acesso total à listagem e a todas as funções
 * (auditoria de divergências, validação de sobressalentes, solicitações de revisão, bloqueio de estoque, invalidação, importação e romaneios).
 */
export const canUserAuditarContagens = (user?: Usuario | null): boolean => {
  if (!user) return false;
  return isUserGestor(user) || isUserAssistente(user);
};

/**
 * Auditoria:
 * - Todos.
 */
export const canUserAccessAuditoria = (user?: Usuario | null): boolean => Boolean(user);

/**
 * Cadastro:
 * - Somente Gestor.
 */
export const canUserAccessCadastros = (user?: Usuario | null): boolean => isUserGestor(user);

/**
 * Relatórios:
 * - Somente Gestor.
 */
export const canUserAccessRelatorios = (user?: Usuario | null): boolean => isUserGestor(user);

/**
 * Controle de Veículos:
 * - Todos os usuários podem visualizar os dados.
 * - Somente usuários de nível Gestor ou Assistente do departamento Logística podem adicionar e editar registros.
 * - A exclusão de registros das tabelas de veículos e abastecimentos é exclusiva do Gestor do departamento Logística.
 */
export const canUserAccessControleVeiculos = (user?: Usuario | null): boolean => Boolean(user);

export const canUserAdicionarEditarVeiculos = (user?: Usuario | null): boolean => {
  if (!user) return false;
  const isLogistica = isUserLogistica(user);
  const isGestorOuAssistente = isUserGestor(user) || isUserAssistente(user);
  return isLogistica && isGestorOuAssistente;
};

export const canUserExcluirVeiculosEAbastecimentos = (user?: Usuario | null): boolean => {
  if (!user) return false;
  return isUserLogistica(user) && isUserGestor(user);
};

export const canUserManageVeiculos = canUserAdicionarEditarVeiculos;
export const canUserOperarVeiculos = canUserAdicionarEditarVeiculos;

/**
 * Módulo de Compras:
 * - Visível para: Usuários do Departamento Comercial e Usuários com nível Gestor
 * - Solicitação: Comercial e Gestores registram solicitações
 * - Aprovação: Exclusivo para Gestores
 * - Atualização para Comprado: Gestores e Comercial (após a aquisição)
 */
export const canUserAccessCompras = (user?: Usuario | null): boolean => {
  if (!user) return false;
  return isUserComercial(user) || isUserGestor(user);
};

export const canUserCreateSolicitacaoCompra = (user?: Usuario | null): boolean => {
  if (!user) return false;
  return isUserComercial(user) || isUserGestor(user);
};

export const canUserAprovarCompra = (user?: Usuario | null): boolean => {
  if (!user) return false;
  return isUserGestor(user);
};

export const canUserMarcarComprado = (user?: Usuario | null): boolean => {
  if (!user) return false;
  return isUserGestor(user) || isUserComercial(user);
};

/**
 * Módulo WhatsApp Business Inteligente:
 * Status: DESATIVADO TEMPORARIAMENTE conforme solicitação do usuário.
 * Toda a implementação, tabelas, credenciais e lógicas estão preservadas para futura reativação.
 */
export const WHATSAPP_MODULE_ENABLED = false;

export const canUserAccessWhatsApp = (user?: Usuario | null): boolean => {
  if (!WHATSAPP_MODULE_ENABLED) return false;
  if (!user) return false;
  return isUserLogistica(user);
};

export const canUserAdminWhatsApp = (
  user?: Usuario | null,
  isGestorWhatsApp?: boolean
): boolean => {
  if (!WHATSAPP_MODULE_ENABLED) return false;
  if (!user || !isUserLogistica(user)) return false;
  // Deve ser gestor da logística E (se houver configuração explícita, estar marcado)
  return isUserGestor(user) && (isGestorWhatsApp !== false);
};

export const canUserSendGroupWhatsApp = (
  user?: Usuario | null,
  podeResponderGrupos?: boolean
): boolean => {
  if (!WHATSAPP_MODULE_ENABLED) return false;
  if (!user || !isUserLogistica(user)) return false;
  // Apenas gestores autorizados podem responder em grupos
  return isUserGestor(user) && Boolean(podeResponderGrupos);
};
