/**
 * POLIHUB — MÓDULO PEDIDOS: CHAMADOS LOGÍSTICOS
 * Tabela Supabase: public.chamados
 * 
 * Regras:
 * - NUNCA SELECT * — Seleção explícita de campos para menor consumo e latência.
 * - Usuários visualizam exclusivamente os chamados que eles próprios abriram.
 * - Apenas usuários com nível Assistente ou Gestor podem finalizar chamados.
 * - Suporta produtos múltiplos com quantidades ou transportadora única (JSON/JSONB).
 */

import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { ChamadoLogistico, StatusChamado, TipoProblemaChamado, ProdutoTransportadoraChamado, ItemProdutoChamado, TransportadoraChamado } from '../types';
import { getLocalChamados, saveLocalChamados } from './mockStorage';
import { podeFinalizarChamado } from '../utils/permissoes';
import { atualizacoesService } from './atualizacoesService';

const CAMPOS_CHAMADOS =
  'id, unidade_negocio, data, usuario_abertura, usuario_abertura_id, cliente, nota_fiscal, tipo_problema, produto_transportadora, status, resolucao, data_conclusao, usuario_fechamento, usuario_fechamento_id, created_at, updated_at';

export interface FiltrosListagemChamados {
  usuarioId?: string | null;
  usuarioNome?: string | null;
  unidadeNegocio: string;
  status?: StatusChamado | 'Todos';
  tipoProblema?: TipoProblemaChamado | 'Todos';
  search?: string;
  dataInicio?: string;
  dataFim?: string;
}

export const chamadosService = {
  /**
   * 1. Lista os chamados do usuário logado na unidade de negócio informada.
   * Regra estrita: Cada usuário visualiza SOMENTE os chamados que ele próprio abriu.
   */
  async listarChamados(filtros: FiltrosListagemChamados): Promise<ChamadoLogistico[]> {
    const supabase = getSupabase();
    const termo = filtros.search?.trim().toLowerCase();
    let lista: ChamadoLogistico[] = [];

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('chamados')
          .select(CAMPOS_CHAMADOS)
          .eq('unidade_negocio', filtros.unidadeNegocio)
          .order('data', { ascending: false });

        // Restrição individual: apenas chamados abertos pelo próprio usuário
        if (filtros.usuarioId) {
          query = query.eq('usuario_abertura_id', filtros.usuarioId);
        } else if (filtros.usuarioNome) {
          query = query.eq('usuario_abertura', filtros.usuarioNome);
        }

        if (filtros.status && filtros.status !== 'Todos') {
          query = query.eq('status', filtros.status);
        }

        if (filtros.tipoProblema && filtros.tipoProblema !== 'Todos') {
          query = query.eq('tipo_problema', filtros.tipoProblema);
        }

        if (filtros.dataInicio) {
          query = query.gte('data', `${filtros.dataInicio}T00:00:00`);
        }

        if (filtros.dataFim) {
          query = query.lte('data', `${filtros.dataFim}T23:59:59`);
        }

        const { data, error } = await query;
        if (!error && data) {
          lista = data as ChamadoLogistico[];
        } else if (error && error.code !== '42P01') {
          console.warn('Aviso ao consultar public.chamados no Supabase, usando local:', error.message);
          lista = getLocalChamados();
        } else {
          lista = getLocalChamados();
        }
      } catch (err) {
        console.warn('Exceção ao listar chamados do Supabase, usando local:', err);
        lista = getLocalChamados();
      }
    } else {
      lista = getLocalChamados();
    }

    // Filtragem em memória (para dados locais ou refinamento)
    let resultado = lista.filter((c) => {
      // Isolamento por Unidade
      if (c.unidade_negocio && c.unidade_negocio !== filtros.unidadeNegocio) {
        return false;
      }

      // Restrição estrita: Somente chamados do usuário logado
      if (filtros.usuarioId && c.usuario_abertura_id) {
        if (c.usuario_abertura_id !== filtros.usuarioId) return false;
      } else if (filtros.usuarioNome && c.usuario_abertura) {
        if (c.usuario_abertura.toLowerCase() !== filtros.usuarioNome.toLowerCase()) return false;
      }

      // Filtro de Status
      if (filtros.status && filtros.status !== 'Todos' && c.status !== filtros.status) {
        return false;
      }

      // Filtro de Tipo de Problema
      if (filtros.tipoProblema && filtros.tipoProblema !== 'Todos' && c.tipo_problema !== filtros.tipoProblema) {
        return false;
      }

      // Filtro por Data
      if (filtros.dataInicio && c.data < `${filtros.dataInicio}T00:00:00`) {
        return false;
      }
      if (filtros.dataFim && c.data > `${filtros.dataFim}T23:59:59`) {
        return false;
      }

      // Filtro por termo (cliente ou nota fiscal)
      if (termo) {
        const clienteMatch = (c.cliente || '').toLowerCase().includes(termo);
        const nfMatch = (c.nota_fiscal || '').toLowerCase().includes(termo);
        if (!clienteMatch && !nfMatch) return false;
      }

      return true;
    });

    return resultado.sort((a, b) => b.data.localeCompare(a.data));
  },

  /**
   * 2. Obtém detalhes de um chamado específico pelo ID
   */
  async obterChamadoPorId(id: string): Promise<ChamadoLogistico | null> {
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('chamados')
          .select(CAMPOS_CHAMADOS)
          .eq('id', id)
          .single();

        if (!error && data) {
          return data as ChamadoLogistico;
        }
      } catch (err) {
        console.warn('Erro ao obter chamado por ID no Supabase:', err);
      }
    }

    const locais = getLocalChamados();
    return locais.find((c) => c.id === id) || null;
  },

  /**
   * 3. Abertura de Novo Chamado Logístico
   * Qualquer usuário autenticado e autorizado ao módulo Pedidos pode abrir.
   */
  async abrirChamado(params: {
    cliente: string;
    nota_fiscal: string;
    tipo_problema: TipoProblemaChamado;
    produto_transportadora: ProdutoTransportadoraChamado;
    unidade_negocio: string;
    usuario_abertura: string;
    usuario_abertura_id?: string | null;
  }): Promise<ChamadoLogistico> {
    const clienteLimpo = params.cliente?.trim();
    const nfLimpa = params.nota_fiscal?.trim();

    if (!clienteLimpo) {
      throw new Error('O campo Cliente é obrigatório.');
    }
    if (!nfLimpa) {
      throw new Error('O campo Nota Fiscal é obrigatório.');
    }
    if (!params.tipo_problema) {
      throw new Error('Selecione o Tipo de Problema.');
    }

    // Validação da carga estruturada conforme o tipo de problema
    const isProblemaProduto = params.tipo_problema === 'Avaria' || params.tipo_problema === 'Produto errado';
    if (isProblemaProduto) {
      if (!Array.isArray(params.produto_transportadora) || params.produto_transportadora.length === 0) {
        throw new Error('Adicione pelo menos um produto relacionado à ocorrência.');
      }
      for (const item of params.produto_transportadora as ItemProdutoChamado[]) {
        if (!item.produto?.trim()) {
          throw new Error('Todos os produtos devem possuir descrição válida.');
        }
        if (!item.quantidade || item.quantidade <= 0) {
          throw new Error(`Informe uma quantidade válida maior que zero para o produto "${item.produto}".`);
        }
      }
    } else {
      const transp = params.produto_transportadora as TransportadoraChamado;
      if (!transp || !transp.transportadora?.trim()) {
        throw new Error('Selecione a Transportadora relacionada à ocorrência.');
      }
    }

    const nowIso = new Date().toISOString();
    const novoChamado: ChamadoLogistico = {
      id: crypto.randomUUID(),
      unidade_negocio: params.unidade_negocio,
      data: nowIso,
      usuario_abertura: params.usuario_abertura,
      usuario_abertura_id: params.usuario_abertura_id || null,
      cliente: clienteLimpo,
      nota_fiscal: nfLimpa,
      tipo_problema: params.tipo_problema,
      produto_transportadora: params.produto_transportadora,
      status: 'Aberto',
      resolucao: null,
      data_conclusao: null,
      usuario_fechamento: null,
      usuario_fechamento_id: null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('chamados').insert([novoChamado]);
        if (error) {
          console.warn('Erro ao inserir chamado no Supabase, mantendo local:', error.message);
        }
      } catch (err) {
        console.warn('Exceção ao inserir chamado no Supabase:', err);
      }
    }

    // Salva localmente
    const locais = getLocalChamados();
    saveLocalChamados([novoChamado, ...locais]);

    // Registro na auditoria geral
    try {
      await atualizacoesService.registrar({
        unidade_negocio: params.unidade_negocio,
        modulo: 'pedidos',
        tipo: 'novo_chamado',
        titulo: `Chamado #${novoChamado.nota_fiscal} — ${params.tipo_problema}`,
        descricao: `Novo chamado aberto para NF ${novoChamado.nota_fiscal} (${clienteLimpo}) por ${params.usuario_abertura}.`,
        registro_id: novoChamado.id,
        usuario_id: params.usuario_abertura_id || null,
        data_evento: nowIso,
      });
    } catch (e) {
      console.warn('Aviso ao registrar auditoria de chamado:', e);
    }

    return novoChamado;
  },

  /**
   * 4. Encerramento / Finalização do Chamado
   * Exclusivo para usuários com nível Assistente ou Gestor.
   */
  async finalizarChamado(params: {
    id: string;
    resolucao: string;
    usuario_fechamento: string;
    usuario_fechamento_id?: string | null;
    userNivel?: string | null;
    userFuncao?: string | null;
  }): Promise<ChamadoLogistico> {
    // 1. Validação de autorização no backend
    const autorizado = podeFinalizarChamado({
      nivel: params.userNivel,
      funcao: params.userFuncao,
    });

    if (!autorizado) {
      throw new Error('Acesso negado: Somente usuários com nível Assistente ou Gestor possuem permissão para finalizar chamados.');
    }

    // 2. Validação da resolução obrigatória
    const resolucaoLimpa = params.resolucao?.trim();
    if (!resolucaoLimpa) {
      throw new Error('A descrição da Resolução é obrigatória para encerrar o chamado.');
    }

    // 3. Prevenção de encerramento repetido
    const atual = await this.obterChamadoPorId(params.id);
    if (!atual) {
      throw new Error('Chamado não localizado.');
    }
    if (atual.status === 'Concluído') {
      throw new Error('Este chamado já foi encerrado anteriormente.');
    }

    const nowIso = new Date().toISOString();
    const dadosAtualizados: Partial<ChamadoLogistico> = {
      status: 'Concluído',
      resolucao: resolucaoLimpa,
      data_conclusao: nowIso,
      usuario_fechamento: params.usuario_fechamento,
      usuario_fechamento_id: params.usuario_fechamento_id || null,
      updated_at: nowIso,
    };

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('chamados')
          .update(dadosAtualizados)
          .eq('id', params.id);

        if (error) {
          if (
            error.code === '42P01' ||
            error.message.includes('schema cache') ||
            error.message.includes('not find the table')
          ) {
            console.warn('Tabela public.chamados ainda não criada no Supabase, finalizando localmente:', error.message);
          } else {
            throw new Error(`Erro ao finalizar chamado no Supabase: ${error.message}`);
          }
        }
      } catch (err: any) {
        if (err.message && err.message.includes('Supabase:') && !err.message.includes('schema cache')) throw err;
        console.warn('Exceção ao finalizar chamado no Supabase, prosseguindo com fallback local:', err);
      }
    }

    // Atualiza localmente
    const locais = getLocalChamados();
    const chamadoAtualizado: ChamadoLogistico = {
      ...atual,
      ...dadosAtualizados,
    } as ChamadoLogistico;

    saveLocalChamados(locais.map((c) => (c.id === params.id ? chamadoAtualizado : c)));

    // Registro na auditoria geral
    try {
      await atualizacoesService.registrar({
        unidade_negocio: atual.unidade_negocio,
        modulo: 'pedidos',
        tipo: 'chamado_concluido',
        titulo: `Chamado #${atual.nota_fiscal} Concluído`,
        descricao: `Chamado da NF ${atual.nota_fiscal} foi finalizado por ${params.usuario_fechamento} (${params.userNivel || 'Assistente/Gestor'}). Resolução: ${resolucaoLimpa}`,
        registro_id: atual.id,
        usuario_id: params.usuario_fechamento_id || null,
        data_evento: nowIso,
      });
    } catch (e) {
      console.warn('Aviso ao registrar auditoria de chamado finalizado:', e);
    }

    return chamadoAtualizado;
  },
};
