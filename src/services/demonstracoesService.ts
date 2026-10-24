import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { Demonstracao, StatusDemonstracaoDinamico } from '../types';
import { getActiveUserUnit, itemMatchesUserUnit, getUnitEquivalents } from './sessionHelper';
import { UNIDADE_PADRAO_SISTEMA, normalizarUnidadeNegocio } from '../constants/unidades';
import { usuariosService } from './usuariosService';

/**
 * POLIHUB — MÓDULO DEMONSTRAÇÕES
 * Tabela Supabase: public.demonstracoes
 * Campos: id, unidade_negocio, produto, produto_id, codigo_produto, endereco, colaborador, data_coletada, data_devolvida, observacao, created_at, updated_at
 * REGRA OBRIGATÓRIA: NÃO EXISTE COLUNA 'status' NO BANCO DE DADOS.
 * O status é calculado dinamicamente com base em data_devolvida.
 */
export const CAMPOS_DEMONSTRACOES =
  'id, unidade_negocio, produto, produto_id, codigo_produto, endereco, colaborador, data_coletada, data_devolvida, observacao, created_at, updated_at';

const LOCAL_STORAGE_DEMONSTRACOES = 'polihub_demonstracoes';

// Helper to generate RFC4122 v4 UUID
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

/**
 * Calcula o status exclusivamente pela presença da data de devolução
 * REGRA CRUCIAL: data_devolvida IS NULL -> 'Demonstração' | data_devolvida IS NOT NULL -> 'Devolvido'
 */
export function calcularStatusDinamico(dataDevolvida?: string | null): StatusDemonstracaoDinamico {
  return dataDevolvida && dataDevolvida.trim().length > 0 ? 'Devolvido' : 'Demonstração';
}

function getLocalDemonstracoes(): Demonstracao[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DEMONSTRACOES);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Erro ao carregar demonstracoes do localStorage:', err);
  }

  // Registros iniciais de demonstração (se vazio)
  const agora = new Date();
  const duasHorasAtras = new Date(agora.getTime() - 2 * 3600 * 1000).toISOString();
  const ontem = new Date(agora.getTime() - 26 * 3600 * 1000).toISOString();
  const ontemDevolvido = new Date(agora.getTime() - 20 * 3600 * 1000).toISOString();

  const iniciais: Demonstracao[] = [
    {
      id: generateUUID(),
      unidade_negocio: 'Goiânia',
      produto: 'Elemento Filtrante de Ar Primário Linha Pesada P-550',
      codigo_produto: '7891234560011',
      endereco: 'R01-P03-N1',
      colaborador: 'usr-default-01',
      colaborador_nome: 'Luiz Fernando',
      colaborador_codigo: 'OP-1042',
      data_coletada: duasHorasAtras,
      data_devolvida: null, // Em Aberto -> 'Demonstração'
      observacao: 'Retirado para demonstração com cliente Auto Peças Araguaia.',
      created_at: duasHorasAtras,
      updated_at: duasHorasAtras,
    },
    {
      id: generateUUID(),
      unidade_negocio: 'Goiânia',
      produto: 'Filtro Óleo Lubrificante Linha Pesada L-820',
      codigo_produto: '7891234560028',
      endereco: 'R02-P01-N2',
      colaborador: 'usr-default-02',
      colaborador_nome: 'Mariana Silva (Gestora)',
      colaborador_codigo: 'GS-2005',
      data_coletada: ontem,
      data_devolvida: ontemDevolvido, // Devolvido -> 'Devolvido'
      observacao: 'Apresentação no cliente Filtros Centro-Oeste. Produto devolvido em perfeito estado.',
      created_at: ontem,
      updated_at: ontemDevolvido,
    },
  ];

  saveLocalDemonstracoes(iniciais);
  return iniciais;
}

function saveLocalDemonstracoes(demonstracoes: Demonstracao[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_DEMONSTRACOES, JSON.stringify(demonstracoes));
  } catch (err) {
    console.warn('Erro ao salvar demonstracoes no localStorage:', err);
  }
}

export interface FiltrosDemonstracao {
  search?: string;
  status?: 'Todos' | 'Demonstração' | 'Devolvido';
  unidade_negocio?: string;
  colaboradorId?: string;
}

export const demonstracoesService = {
  /**
   * Lista as demonstrações aplicando isolamento multiunidade e ordenação obrigatória:
   * 1. 'Demonstração' (em aberto)
   * 2. 'Devolvido'
   * Dentro de cada grupo, mais recentes primeiro.
   */
  async listar(filtros?: FiltrosDemonstracao): Promise<Demonstracao[]> {
    const targetUnit = normalizarUnidadeNegocio(
      filtros?.unidade_negocio || getActiveUserUnit() || UNIDADE_PADRAO_SISTEMA
    );
    const unitEquivalents = getUnitEquivalents(targetUnit);

    let registros: Demonstracao[] = [];
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('demonstracoes')
          .select(CAMPOS_DEMONSTRACOES);

        if (unitEquivalents.length === 1) {
          query = query.eq('unidade_negocio', unitEquivalents[0]);
        } else {
          query = query.in('unidade_negocio', unitEquivalents);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          registros = data as Demonstracao[];
        }
      } catch (err) {
        console.warn('Erro ao consultar public.demonstracoes no Supabase, usando local:', err);
      }
    }

    if (registros.length === 0) {
      const allLocal = getLocalDemonstracoes();
      registros = allLocal.filter((d) => itemMatchesUserUnit(d.unidade_negocio, targetUnit));
    }

    // Carregar usuários para enriquecer colaborador_nome
    let usuariosMap = new Map<string, { nome: string; codigo?: string }>();
    try {
      const usuarios = await usuariosService.listarTodos();
      usuarios.forEach((u) => {
        usuariosMap.set(u.id, { nome: u.nome, codigo: u.codigo });
      });
    } catch (e) {
      console.warn('Erro ao obter usuários para enriquecer demonstrações:', e);
    }

    // Mapear campos dinâmicos
    let processados: Demonstracao[] = registros.map((d) => {
      const uInfo = usuariosMap.get(d.colaborador);
      const statusDinamico = calcularStatusDinamico(d.data_devolvida);

      return {
        ...d,
        colaborador_nome: uInfo?.nome || d.colaborador_nome || 'Colaborador não identificado',
        colaborador_codigo: uInfo?.codigo || d.colaborador_codigo || null,
        status_dinamico: statusDinamico,
      };
    });

    // Filtro de Status dinâmico (sem coluna no banco)
    if (filtros?.status && filtros.status !== 'Todos') {
      if (filtros.status === 'Demonstração') {
        processados = processados.filter((d) => !d.data_devolvida);
      } else if (filtros.status === 'Devolvido') {
        processados = processados.filter((d) => !!d.data_devolvida);
      }
    }

    // Filtro por Colaborador
    if (filtros?.colaboradorId) {
      processados = processados.filter((d) => d.colaborador === filtros.colaboradorId);
    }

    // Filtro de Busca Textual
    if (filtros?.search && filtros.search.trim()) {
      const q = filtros.search.trim().toLowerCase();
      processados = processados.filter((d) =>
        (d.produto || '').toLowerCase().includes(q) ||
        (d.codigo_produto || '').toLowerCase().includes(q) ||
        (d.endereco || '').toLowerCase().includes(q) ||
        (d.colaborador_nome || '').toLowerCase().includes(q) ||
        (d.observacao || '').toLowerCase().includes(q)
      );
    }

    // ORDENAÇÃO OBRIGATÓRIA (Item 10):
    // 1. Demonstração (data_devolvida === null)
    // 2. Devolvido (data_devolvida !== null)
    // Dentro de cada grupo: registros mais recentes primeiro (data_coletada desc)
    processados.sort((a, b) => {
      const aAberto = !a.data_devolvida;
      const bAberto = !b.data_devolvida;

      if (aAberto && !bAberto) return -1;
      if (!aAberto && bAberto) return 1;

      // Dentro do mesmo grupo, mais recentes primeiro
      const timeA = new Date(a.data_coletada).getTime() || 0;
      const timeB = new Date(b.data_coletada).getTime() || 0;
      return timeB - timeA;
    });

    return processados;
  },

  /**
   * Obtém demonstração por ID
   */
  async obterPorId(id: string): Promise<Demonstracao | null> {
    const lista = await this.listar();
    return lista.find((d) => d.id === id) || null;
  },

  /**
   * REGRA OBRIGATÓRIA (Item 9):
   * Verifica se o produto já possui uma demonstração em aberto (data_devolvida IS NULL).
   * Retorna o registro em aberto se existir, ou null se estiver liberado para nova retirada.
   */
  async verificarProdutoEmAberto(
    identificadorProduto: {
      produto_id?: string | null;
      codigo_produto?: string | null;
      descricao_produto: string;
    },
    unidadeNegocio: string
  ): Promise<Demonstracao | null> {
    const lista = await this.listar({ unidade_negocio: unidadeNegocio });
    const emAberto = lista.filter((d) => !d.data_devolvida);

    const descLimpa = identificadorProduto.descricao_produto.trim().toLowerCase();
    const codLimpo = (identificadorProduto.codigo_produto || '').trim().toLowerCase();
    const idLimpo = identificadorProduto.produto_id;

    for (const dem of emAberto) {
      // 1. Match por produto_id
      if (idLimpo && dem.produto_id && dem.produto_id === idLimpo) {
        return dem;
      }
      // 2. Match por codigo_produto
      if (codLimpo && dem.codigo_produto && dem.codigo_produto.trim().toLowerCase() === codLimpo) {
        return dem;
      }
      // 3. Match por nome exato do produto
      if (dem.produto && dem.produto.trim().toLowerCase() === descLimpa) {
        return dem;
      }
    }

    return null;
  },

  /**
   * FLUXO DE SAÍDA (Item 4 e 6):
   * Registra a saída de um produto para demonstração comercial.
   * data_coletada = agora; data_devolvida = null.
   */
  async criarDemonstracao(
    dados: {
      unidade_negocio?: string;
      produto: string;
      produto_id?: string | null;
      codigo_produto?: string | null;
      endereco: string;
      colaborador: string;
      observacao?: string | null;
    },
    userNivel?: string | null
  ): Promise<Demonstracao> {
    if (userNivel) {
      const nivelNorm = userNivel.trim().toLowerCase();
      if (nivelNorm !== 'gestor' && nivelNorm !== 'administrador' && nivelNorm !== 'assistente') {
        throw new Error('Acesso negado: Somente usuários com nível Gestor ou Assistente podem adicionar registros de demonstração.');
      }
    }

    const unidade = normalizarUnidadeNegocio(dados.unidade_negocio || getActiveUserUnit() || UNIDADE_PADRAO_SISTEMA);

    if (!dados.produto || !dados.produto.trim()) {
      throw new Error('O produto é obrigatório para registrar a demonstração.');
    }
    if (!dados.endereco || !dados.endereco.trim()) {
      throw new Error('O endereço do produto é obrigatório.');
    }
    if (!dados.colaborador || !dados.colaborador.trim()) {
      throw new Error('O colaborador responsável pela retirada é obrigatório.');
    }

    // REGRA DE BLOQUEIO (Item 9): Verificar se já existe demonstração em aberto
    const demExistente = await this.verificarProdutoEmAberto(
      {
        produto_id: dados.produto_id,
        codigo_produto: dados.codigo_produto,
        descricao_produto: dados.produto,
      },
      unidade
    );

    if (demExistente) {
      const dtFormatada = new Date(demExistente.data_coletada).toLocaleString('pt-BR');
      throw new Error(
        `Este produto já está registrado em uma demonstração em aberto.\n\n` +
        `• Produto: ${demExistente.produto}\n` +
        `• Responsável: ${demExistente.colaborador_nome || 'Colaborador'}\n` +
        `• Endereço: ${demExistente.endereco}\n` +
        `• Retirada em: ${dtFormatada}`
      );
    }

    const agora = new Date().toISOString();
    const nova: Demonstracao = {
      id: generateUUID(),
      unidade_negocio: unidade,
      produto: dados.produto.trim(),
      produto_id: dados.produto_id || null,
      codigo_produto: dados.codigo_produto ? dados.codigo_produto.trim() : null,
      endereco: dados.endereco.trim(),
      colaborador: dados.colaborador.trim(),
      data_coletada: agora,
      data_devolvida: null, // Em Aberto -> 'Demonstração'
      observacao: dados.observacao ? dados.observacao.trim() : null,
      created_at: agora,
      updated_at: agora,
      status_dinamico: 'Demonstração',
    };

    // Tentar persistir no Supabase
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const payload = {
          id: nova.id,
          unidade_negocio: nova.unidade_negocio,
          produto: nova.produto,
          produto_id: nova.produto_id,
          codigo_produto: nova.codigo_produto,
          endereco: nova.endereco,
          colaborador: nova.colaborador,
          data_coletada: nova.data_coletada,
          data_devolvida: null,
          observacao: nova.observacao,
        };

        const { data, error } = await supabase
          .from('demonstracoes')
          .insert(payload)
          .select(CAMPOS_DEMONSTRACOES)
          .single();

        if (!error && data) {
          nova.id = data.id;
        }
      } catch (err) {
        console.warn('Erro ao salvar demonstracao no Supabase, mantendo cópia local:', err);
      }
    }

    // Salvar localmente
    const all = getLocalDemonstracoes();
    all.unshift(nova);
    saveLocalDemonstracoes(all);

    return nova;
  },

  /**
   * FLUXO DE DEVOLUÇÃO (Item 8):
   * Registra a devolução do produto.
   * Preenche data_devolvida com agora e atualiza observação.
   * Não permite segunda devolução se já estiver devolvido.
   */
  async registrarDevolucao(
    id: string,
    dadosDevolucao: { observacao?: string | null },
    userNivel?: string | null
  ): Promise<Demonstracao> {
    if (userNivel) {
      const nivelNorm = userNivel.trim().toLowerCase();
      if (nivelNorm !== 'gestor' && nivelNorm !== 'administrador' && nivelNorm !== 'assistente') {
        throw new Error('Acesso negado: Somente usuários de nível Gestor ou Assistente podem registrar devoluções.');
      }
    }
    const all = getLocalDemonstracoes();
    const index = all.findIndex((d) => d.id === id);

    let registroAtual: Demonstracao | null = null;
    if (index >= 0) {
      registroAtual = all[index];
    } else {
      registroAtual = await this.obterPorId(id);
    }

    if (!registroAtual) {
      throw new Error('Registro de demonstração não encontrado.');
    }

    // Não permitir registrar segunda devolução
    if (registroAtual.data_devolvida) {
      throw new Error('Esta demonstração já foi devolvida anteriormente.');
    }

    const agora = new Date().toISOString();
    const observacaoAtualizada = dadosDevolucao.observacao !== undefined
      ? dadosDevolucao.observacao?.trim() || null
      : registroAtual.observacao;

    const atualizado: Demonstracao = {
      ...registroAtual,
      data_devolvida: agora,
      observacao: observacaoAtualizada,
      updated_at: agora,
      status_dinamico: 'Devolvido',
    };

    // Atualizar no Supabase
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('demonstracoes')
          .update({
            data_devolvida: agora,
            observacao: observacaoAtualizada,
            updated_at: agora,
          })
          .eq('id', id);
      } catch (err) {
        console.warn('Erro ao atualizar devolucao no Supabase:', err);
      }
    }

    if (index >= 0) {
      all[index] = atualizado;
    } else {
      all.unshift(atualizado);
    }
    saveLocalDemonstracoes(all);

    return atualizado;
  },

  /**
   * Atualização de registro de demonstração por Gestor ou Assistente.
   * Permite editar observação, colaborador, endereço, data_coletada e data_devolvida.
   */
  async atualizarDemonstracao(
    id: string,
    dadosAtualizados: {
      observacao?: string | null;
      colaborador?: string;
      endereco?: string;
      data_coletada?: string;
      data_devolvida?: string | null;
    },
    userNivel?: string | null
  ): Promise<Demonstracao> {
    if (userNivel) {
      const nivelNorm = userNivel.trim().toLowerCase();
      if (nivelNorm !== 'gestor' && nivelNorm !== 'administrador' && nivelNorm !== 'assistente') {
        throw new Error('Acesso negado: Somente usuários de nível Gestor ou Assistente podem editar registros de demonstração.');
      }
    }

    const all = getLocalDemonstracoes();
    const index = all.findIndex((d) => d.id === id);

    let registroAtual: Demonstracao | null = null;
    if (index >= 0) {
      registroAtual = all[index];
    } else {
      registroAtual = await this.obterPorId(id);
    }

    if (!registroAtual) {
      throw new Error('Registro de demonstração não encontrado para edição.');
    }

    const agora = new Date().toISOString();
    const dataDevolvidaFinal =
      dadosAtualizados.data_devolvida !== undefined
        ? dadosAtualizados.data_devolvida
        : registroAtual.data_devolvida;

    const atualizado: Demonstracao = {
      ...registroAtual,
      colaborador: dadosAtualizados.colaborador ? dadosAtualizados.colaborador.trim() : registroAtual.colaborador,
      endereco: dadosAtualizados.endereco ? dadosAtualizados.endereco.trim() : registroAtual.endereco,
      observacao: dadosAtualizados.observacao !== undefined ? dadosAtualizados.observacao?.trim() || null : registroAtual.observacao,
      data_coletada: dadosAtualizados.data_coletada || registroAtual.data_coletada,
      data_devolvida: dataDevolvidaFinal,
      updated_at: agora,
      status_dinamico: calcularStatusDinamico(dataDevolvidaFinal),
    };

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('demonstracoes')
          .update({
            colaborador: atualizado.colaborador,
            endereco: atualizado.endereco,
            observacao: atualizado.observacao,
            data_coletada: atualizado.data_coletada,
            data_devolvida: atualizado.data_devolvida,
            updated_at: agora,
          })
          .eq('id', id);
      } catch (err) {
        console.warn('Erro ao atualizar demonstração no Supabase:', err);
      }
    }

    if (index >= 0) {
      all[index] = atualizado;
    } else {
      all.unshift(atualizado);
    }
    saveLocalDemonstracoes(all);

    return atualizado;
  },

  /**
   * Exclusão de registro (SOMENTE Gestor)
   */
  async excluir(id: string, userNivel?: string | null): Promise<void> {
    if (userNivel) {
      const nivelNorm = userNivel.trim().toLowerCase();
      if (nivelNorm !== 'gestor' && nivelNorm !== 'administrador') {
        throw new Error('Acesso negado: Somente usuários com nível Gestor podem excluir registros de demonstração.');
      }
    }

    const all = getLocalDemonstracoes().filter((d) => d.id !== id);
    saveLocalDemonstracoes(all);

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('demonstracoes').delete().eq('id', id);
      } catch (err) {
        console.warn('Erro ao excluir demonstracao no Supabase:', err);
      }
    }
  },

  /**
   * Totalizadores rápidos para os badges do topo
   */
  async obterMetricas(unidadeNegocio?: string): Promise<{
    total: number;
    emDemonstracao: number;
    devolvidos: number;
  }> {
    const lista = await this.listar({ unidade_negocio: unidadeNegocio });
    const emDemonstracao = lista.filter((d) => !d.data_devolvida).length;
    const devolvidos = lista.filter((d) => !!d.data_devolvida).length;

    return {
      total: lista.length,
      emDemonstracao,
      devolvidos,
    };
  },
};
