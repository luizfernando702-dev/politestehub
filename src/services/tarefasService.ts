/**
 * POLIFILTRO — SERVIÇO DE GESTÃO DE TAREFAS
 * Integração Supabase com RLS, coluna virtual de prazo dinâmico e fallback offline
 */

import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { Tarefa, TarefaStatus, PrazoCalculado, Usuario } from '../types';
import { getLocalTarefas, saveLocalTarefas } from './mockStorage';
import { usuariosService } from './usuariosService';
import { getActiveUserUnit, itemMatchesUserUnit, getUnitEquivalents } from './sessionHelper';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Seleção explícita de colunas para garantir baixo consumo e evitar SELECT *
const TAREFA_FIELDS = 'id, unidade_negocio, nome, responsavel_id, data_limite, data_conclusao, status, ativo, usuario_insercao, data_insercao, usuario_atualizacao, data_atualizacao';
const TAREFA_FIELDS_FALLBACK = 'id, nome, responsavel_id, data_limite, data_conclusao, status, ativo, usuario_insercao, data_insercao, usuario_atualizacao, data_atualizacao';

export interface TarefasFilters {
  search?: string;
  responsavelId?: string;
  status?: TarefaStatus | 'Todos';
  prazo?: PrazoCalculado | 'Todos';
  dataLimite?: string;
}

/**
 * Cálculo dinâmico do Prazo da tarefa (não armazenado no banco)
 * - Concluída: sempre exibe "Concluída", nunca "Prazo estourado"
 * - Data limite anterior a hoje: "Prazo estourado" (vermelho)
 * - Data limite igual a hoje: "Finalizar hoje" (laranja)
 * - Data limite futura: "Dentro do prazo" (verde)
 */
export function calcularPrazoTarefa(status: TarefaStatus, dataLimite: string): PrazoCalculado {
  if (status === 'Concluído') {
    return 'Concluída';
  }
  if (!dataLimite) {
    return 'Dentro do prazo';
  }

  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  const hojeStr = `${ano}-${mes}-${dia}`;

  // Comparações de string ISO YYYY-MM-DD
  if (dataLimite < hojeStr) {
    return 'Prazo estourado';
  }
  if (dataLimite === hojeStr) {
    return 'Finalizar hoje';
  }
  return 'Dentro do prazo';
}

const PRAZO_SORT_ORDER: Record<PrazoCalculado, number> = {
  'Prazo estourado': 1,
  'Finalizar hoje': 2,
  'Dentro do prazo': 3,
  'Concluída': 4,
};

/**
 * Ordenação mandatória da regra de negócio:
 * 1. Prazo estourado
 * 2. Finalizar hoje
 * 3. Dentro do prazo
 * 4. Concluídas
 * Dentro de cada grupo: data limite mais próxima primeiro (ascendente)
 */
export function sortTarefasList(tarefas: Tarefa[]): Tarefa[] {
  return [...tarefas].sort((a, b) => {
    const prazoA = calcularPrazoTarefa(a.status, a.data_limite);
    const prazoB = calcularPrazoTarefa(b.status, b.data_limite);

    const diffPrazo = PRAZO_SORT_ORDER[prazoA] - PRAZO_SORT_ORDER[prazoB];
    if (diffPrazo !== 0) {
      return diffPrazo;
    }

    // Desempate pela data limite mais próxima (ascendente)
    const dateA = a.data_limite || '9999-12-31';
    const dateB = b.data_limite || '9999-12-31';
    const dateComp = dateA.localeCompare(dateB);
    if (dateComp !== 0) return dateComp;

    // Desempate por nome alfabético
    return a.nome.localeCompare(b.nome);
  });
}

export const tarefasService = {
  /**
   * Lista tarefas considerando o nível de acesso do usuário:
   * - Gestor: todas as tarefas ativas
   * - Usuário comum: apenas tarefas onde responsavel_id === user.id
   */
  async listarTarefas(
    user: Usuario,
    filters: TarefasFilters = {}
  ): Promise<Tarefa[]> {
    const isGestor = user.nivel?.toLowerCase() === 'gestor';
    const supabase = getSupabase();
    let tarefas: Tarefa[] = [];
    const usuarios = await usuariosService.listarTodos();
    const userMap = new Map<string, Usuario>(usuarios.map((u) => [u.id, u]));

    const activeUnit = user.unidade_negocio || getActiveUserUnit();

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('tarefas')
          .select(TAREFA_FIELDS)
          .eq('ativo', true);

        // Filtro por unidade de negócio do usuário
        if (activeUnit) {
          query = query.in('unidade_negocio', getUnitEquivalents(activeUnit));
        }

        // Regra de segurança: se não for gestor, filtra obrigatoriamente pelo próprio usuário
        if (!isGestor) {
          query = query.eq('responsavel_id', user.id);
        } else if (filters.responsavelId && filters.responsavelId !== 'Todos') {
          query = query.eq('responsavel_id', filters.responsavelId);
        }

        if (filters.status && filters.status !== 'Todos') {
          query = query.eq('status', filters.status);
        }

        if (filters.dataLimite) {
          query = query.eq('data_limite', filters.dataLimite);
        }

        if (filters.search && filters.search.trim()) {
          query = query.ilike('nome', `%${filters.search.trim()}%`);
        }

        let { data, error }: { data: any; error: any } = await query;

        // Fallback seguro caso a coluna unidade_negocio ainda não exista no Supabase
        if (error && (error.message.includes('unidade_negocio') || error.code === '42703')) {
          let retryQuery = supabase
            .from('tarefas')
            .select(TAREFA_FIELDS_FALLBACK)
            .eq('ativo', true);

          if (!isGestor) {
            retryQuery = retryQuery.eq('responsavel_id', user.id);
          } else if (filters.responsavelId && filters.responsavelId !== 'Todos') {
            retryQuery = retryQuery.eq('responsavel_id', filters.responsavelId);
          }
          if (filters.status && filters.status !== 'Todos') {
            retryQuery = retryQuery.eq('status', filters.status);
          }
          if (filters.dataLimite) {
            retryQuery = retryQuery.eq('data_limite', filters.dataLimite);
          }
          if (filters.search && filters.search.trim()) {
            retryQuery = retryQuery.ilike('nome', `%${filters.search.trim()}%`);
          }

          const retryRes = await retryQuery;
          data = retryRes.data;
          error = retryRes.error;
        }

        if (error) {
          console.warn('Erro ao consultar tarefas no Supabase (utilizando fallback local):', error.message);
          tarefas = getLocalTarefas();
        } else if (data) {
          tarefas = data as Tarefa[];
        }
      } catch (err) {
        console.warn('Falha na conexão de tarefas, utilizando armazenamento local:', err);
        tarefas = getLocalTarefas();
      }
    } else {
      tarefas = getLocalTarefas();
    }

    // Filtra pela unidade se estiver no fallback local
    if (activeUnit) {
      tarefas = tarefas.filter((t: any) => itemMatchesUserUnit(t.unidade_negocio, activeUnit));
    }

    // Filtragem em memória para robustez (segurança adicional e filtro de prazo virtual)
    let filtered = tarefas.filter((t) => t.ativo !== false);

    // Se não for gestor, garante que só vê suas próprias tarefas
    if (!isGestor) {
      filtered = filtered.filter((t) => t.responsavel_id === user.id);
    } else if (filters.responsavelId && filters.responsavelId !== 'Todos') {
      filtered = filtered.filter((t) => t.responsavel_id === filters.responsavelId);
    }

    if (filters.status && filters.status !== 'Todos') {
      filtered = filtered.filter((t) => t.status === filters.status);
    }

    if (filters.dataLimite) {
      filtered = filtered.filter((t) => t.data_limite === filters.dataLimite);
    }

    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim().toLowerCase();
      filtered = filtered.filter((t) => t.nome.toLowerCase().includes(term));
    }

    // Adiciona o prazo calculado e vincula dados do responsável
    const enriched = filtered.map((t) => {
      const resp = userMap.get(t.responsavel_id);
      return {
        ...t,
        responsavel_nome: resp ? resp.nome : t.responsavel_nome || 'Não atribuído',
        responsavel_codigo: resp ? resp.codigo : t.responsavel_codigo || '',
        prazo: calcularPrazoTarefa(t.status, t.data_limite),
      };
    });

    // Filtro por coluna virtual Prazo (se fornecido)
    let finalFiltered = enriched;
    if (filters.prazo && filters.prazo !== 'Todos') {
      finalFiltered = enriched.filter((t) => t.prazo === filters.prazo);
    }

    // Ordenação mandatória
    return sortTarefasList(finalFiltered);
  },

  /**
   * Criação de nova tarefa (Somente Gestor)
   */
  async criarTarefa(
    user: Usuario,
    dados: {
      nome: string;
      responsavel_id: string;
      data_limite: string;
      status?: TarefaStatus;
    }
  ): Promise<Tarefa> {
    const isGestor = user.nivel?.toLowerCase() === 'gestor';
    if (!isGestor) {
      throw new Error('Apenas usuários com perfil de Gestor podem cadastrar novas tarefas.');
    }

    const now = new Date().toISOString();
    const status = dados.status || 'Pendente';
    const data_conclusao = status === 'Concluído' ? now : null;

    const unidadeNegocio = user.unidade_negocio || getActiveUserUnit() || 'Goiânia';

    const novaTarefa: Tarefa = {
      id: generateUUID(),
      unidade_negocio: unidadeNegocio,
      nome: dados.nome.trim(),
      responsavel_id: dados.responsavel_id,
      data_limite: dados.data_limite,
      data_conclusao,
      status,
      ativo: true,
      usuario_insercao: user.nome || user.codigo,
      data_insercao: now,
      usuario_atualizacao: null,
      data_atualizacao: null,
    };

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        let { data, error }: { data: any; error: any } = await supabase
          .from('tarefas')
          .insert(novaTarefa)
          .select(TAREFA_FIELDS)
          .single();

        if (error && (error.message.includes('unidade_negocio') || error.code === '42703')) {
          const { unidade_negocio, ...fallbackPayload } = novaTarefa;
          const retryRes = await supabase
            .from('tarefas')
            .insert(fallbackPayload)
            .select(TAREFA_FIELDS_FALLBACK)
            .single();
          data = retryRes.data;
          error = retryRes.error;
        }

        if (!error && data) {
          // Atualiza também storage local
          const local = getLocalTarefas();
          saveLocalTarefas([data as Tarefa, ...local]);
          return data as Tarefa;
        }
        console.warn('Erro ao inserir tarefa no Supabase, salvando localmente:', error?.message);
      } catch (err) {
        console.warn('Falha ao inserir tarefa no Supabase:', err);
      }
    }

    // Armazenamento local
    const local = getLocalTarefas();
    saveLocalTarefas([novaTarefa, ...local]);
    return novaTarefa;
  },

  /**
   * Atualização de tarefa existente (Somente Gestor)
   */
  async atualizarTarefa(
    user: Usuario,
    id: string,
    atualizacoes: {
      nome?: string;
      responsavel_id?: string;
      data_limite?: string;
      status?: TarefaStatus;
    }
  ): Promise<Tarefa> {
    const isGestor = user.nivel?.toLowerCase() === 'gestor';
    if (!isGestor) {
      throw new Error('Apenas usuários com perfil de Gestor podem editar tarefas.');
    }

    const now = new Date().toISOString();
    const local = getLocalTarefas();
    const existing = local.find((t) => t.id === id);

    let data_conclusao = existing?.data_conclusao ?? null;
    if (atualizacoes.status) {
      if (atualizacoes.status === 'Concluído' && existing?.status !== 'Concluído') {
        data_conclusao = now;
      } else if (atualizacoes.status !== 'Concluído') {
        data_conclusao = null;
      }
    }

    const dbPayload: Partial<Tarefa> = {
      ...atualizacoes,
      data_conclusao,
      usuario_atualizacao: user.nome || user.codigo,
      data_atualizacao: now,
    };

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('tarefas')
          .update(dbPayload)
          .eq('id', id)
          .select(TAREFA_FIELDS)
          .single();

        if (!error && data) {
          const updatedList = local.map((t) => (t.id === id ? { ...t, ...(data as Tarefa) } : t));
          saveLocalTarefas(updatedList);
          return data as Tarefa;
        }
        console.warn('Erro ao atualizar tarefa no Supabase, persistindo localmente:', error?.message);
      } catch (err) {
        console.warn('Falha no update do Supabase:', err);
      }
    }

    const updatedList = local.map((t) => (t.id === id ? { ...t, ...dbPayload } : t));
    saveLocalTarefas(updatedList);
    const updated = updatedList.find((t) => t.id === id);
    if (!updated) {
      throw new Error('Tarefa não encontrada.');
    }
    return updated;
  },

  /**
   * Alteração rápida de status (Somente Gestor)
   */
  async alterarStatus(
    user: Usuario,
    id: string,
    novoStatus: TarefaStatus
  ): Promise<Tarefa> {
    return this.atualizarTarefa(user, id, { status: novoStatus });
  },

  /**
   * Exclusão de tarefa (Somente Gestor)
   * Realiza exclusão lógica (ativo = false) e remove do Supabase
   */
  async excluirTarefa(user: Usuario, id: string): Promise<boolean> {
    const isGestor = user.nivel?.toLowerCase() === 'gestor';
    if (!isGestor) {
      throw new Error('Apenas usuários com perfil de Gestor podem excluir tarefas.');
    }

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        // Exclusão lógica com atualização de auditoria
        const now = new Date().toISOString();
        const { error } = await supabase
          .from('tarefas')
          .update({
            ativo: false,
            usuario_atualizacao: user.nome || user.codigo,
            data_atualizacao: now,
          })
          .eq('id', id);

        if (error) {
          console.warn('Erro ao desativar tarefa no Supabase:', error.message);
        }
      } catch (err) {
        console.warn('Falha na exclusão da tarefa no Supabase:', err);
      }
    }

    // Atualiza lista local
    const local = getLocalTarefas();
    const updated = local.filter((t) => t.id !== id);
    saveLocalTarefas(updated);
    return true;
  },

  /**
   * Métricas resumidas de tarefas para exibição no dashboard ou topo da tela
   */
  async obterMetricas(user: Usuario): Promise<{
    total: number;
    prazoEstourado: number;
    finalizarHoje: number;
    dentroDoPrazo: number;
    concluidas: number;
  }> {
    const tarefas = await this.listarTarefas(user);
    let prazoEstourado = 0;
    let finalizarHoje = 0;
    let dentroDoPrazo = 0;
    let concluidas = 0;

    for (const t of tarefas) {
      const p = t.prazo || calcularPrazoTarefa(t.status, t.data_limite);
      if (p === 'Prazo estourado') prazoEstourado++;
      else if (p === 'Finalizar hoje') finalizarHoje++;
      else if (p === 'Dentro do prazo') dentroDoPrazo++;
      else if (p === 'Concluída') concluidas++;
    }

    return {
      total: tarefas.length,
      prazoEstourado,
      finalizarHoje,
      dentroDoPrazo,
      concluidas,
    };
  },
};
