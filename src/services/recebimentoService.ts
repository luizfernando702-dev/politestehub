import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import {
  Agendamento,
  FiltrosMetricasRecebimento,
  ItemConferenciaCega,
  ItemHistoricoRecebimento,
  MetricasRecebimento,
  RecebimentoProduto,
  RecebimentoStatus,
  RespostaHistoricoRecebimentos,
  ResultadoConferencia,
  ResumoNotaRecebimento,
} from '../types';
import {
  getLocalAgendamentos,
  getLocalFornecedores,
  getLocalRecebimentosProdutos,
  getLocalUsuarios,
  saveLocalRecebimentosProdutos,
} from './mockStorage';
import { saoProdutosSemelhantes } from '../utils/agrupamentoProdutos';
import { pushNotificationService } from './pushNotificationService';
import { getActiveUserUnit, itemMatchesUserUnit, getActiveUserProfile, getUnitEquivalents } from './sessionHelper';
import { UNIDADE_PADRAO_SISTEMA, normalizarUnidadeNegocio } from '../constants/unidades';
import { isUserGestor } from '../lib/permissions';
import { atualizacoesService } from './atualizacoesService';

// CAMPOS EXPLÍCITOS — POLÍTICA: NUNCA SELECT *
export const CAMPOS_RECEBIMENTO =
  'id, unidade_negocio, agendamento_id, data_recebimento, nota_fiscal, produto, endereco, quantidade, saldo_final, qtd_conferida, conferente_id, status, data_conferencia, repositor_id, data_alocacao, novo_endereco';
const CAMPOS_RECEBIMENTO_FALLBACK =
  'id, agendamento_id, data_recebimento, nota_fiscal, produto, endereco, quantidade, saldo_final, qtd_conferida, conferente_id, status, data_conferencia, repositor_id, data_alocacao, novo_endereco';

// CAMPOS RESTRITOS PARA A ABA DE HISTÓRICO "NFs Recebidas" — NUNCA SELECT *
export const CAMPOS_HISTORICO_RECEBIMENTO =
  'id, data_recebimento, produto, nota_fiscal, quantidade, status, agendamento_id, unidade_negocio, data_conferencia, data_alocacao, saldo_final';
const CAMPOS_HISTORICO_RECEBIMENTO_FALLBACK =
  'id, data_recebimento, produto, nota_fiscal, quantidade, status, agendamento_id, data_conferencia, data_alocacao, saldo_final';

// CAMPOS ESPECÍFICOS PARA A ABA DE GRÁFICOS E INDICADORES DE RECEBIMENTO — NUNCA SELECT *
export const CAMPOS_METRICAS_RECEBIMENTO =
  'id, agendamento_id, unidade_negocio, data_recebimento, nota_fiscal, produto, quantidade, qtd_conferida, status, data_conferencia, data_alocacao';
export const CAMPOS_METRICAS_AGENDAMENTOS =
  'id, unidade_negocio, fornecedor, nota_fiscal, status, data_prevista, data_entrega, data_insercao';

export interface FiltrosRecebimento {
  dataRecebimento?: string;
  notaFiscal?: string;
  unidadeNegocio?: string;
}

export interface ResultadoComparacaoCega {
  success: boolean;
  resultado: ResultadoConferencia;
  status: RecebimentoStatus;
  error?: string;
}

/**
 * Normaliza número de Nota Fiscal para comparação (remove pontuação e zeros à esquerda)
 */
export function normalizarNotaFiscal(nf: string | number | null | undefined): string {
  if (nf === null || nf === undefined) return '';
  const str = String(nf).trim().toUpperCase();
  // Remove pontos, traços, barras e espaços
  const limpo = str.replace(/[^A-Z0-9]/gi, '');
  // Remove zeros à esquerda mantendo ao menos um caractere
  return limpo.replace(/^0+/, '') || '0';
}

export const recebimentoService = {
  /**
   * 1. Consulta notas fiscais para o módulo de Recebimento com base em Data e Nota Fiscal.
   * Agrupa itens e calcula progresso da conferência cega.
   */
  async listarNotasParaRecebimento(filtros: FiltrosRecebimento = {}): Promise<ResumoNotaRecebimento[]> {
    const supabase = getSupabase();
    let produtos: RecebimentoProduto[] = [];
    const activeUnit = filtros.unidadeNegocio || getActiveUserUnit();

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('recebimentos_produtos')
          .select(CAMPOS_RECEBIMENTO)
          .order('data_recebimento', { ascending: false });

        if (activeUnit) {
          query = query.eq('unidade_negocio', activeUnit);
        }

        if (filtros.dataRecebimento) {
          query = query.eq('data_recebimento', filtros.dataRecebimento);
        }

        if (filtros.notaFiscal && filtros.notaFiscal.trim()) {
          query = query.ilike('nota_fiscal', `%${filtros.notaFiscal.trim()}%`);
        }

        let { data, error }: { data: any; error: any } = await query;

        // Fallback caso a coluna unidade_negocio ainda não exista no Supabase
        if (error && (error.message.includes('unidade_negocio') || error.code === '42703')) {
          let retryQuery = supabase
            .from('recebimentos_produtos')
            .select(CAMPOS_RECEBIMENTO_FALLBACK)
            .order('data_recebimento', { ascending: false });

          if (filtros.dataRecebimento) {
            retryQuery = retryQuery.eq('data_recebimento', filtros.dataRecebimento);
          }
          if (filtros.notaFiscal && filtros.notaFiscal.trim()) {
            retryQuery = retryQuery.ilike('nota_fiscal', `%${filtros.notaFiscal.trim()}%`);
          }

          const retryRes = await retryQuery;
          data = retryRes.data;
          error = retryRes.error;
        }

        if (!error && data) {
          produtos = data as RecebimentoProduto[];
        } else {
          if (error) {
            console.warn('Erro ao consultar recebimentos_produtos no Supabase, usando local:', error.message);
          }
          produtos = getLocalRecebimentosProdutos();
        }
      } catch (e) {
        console.warn('Exceção ao consultar Supabase, usando fallback local:', e);
        produtos = getLocalRecebimentosProdutos();
      }
    } else {
      produtos = getLocalRecebimentosProdutos();
    }

    // Filtros em memória (para dados locais ou fallback)
    if (activeUnit) {
      produtos = produtos.filter((p) => itemMatchesUserUnit(p.unidade_negocio, activeUnit));
    }
    if (filtros.dataRecebimento) {
      produtos = produtos.filter((p) => p.data_recebimento.startsWith(filtros.dataRecebimento!));
    }
    if (filtros.notaFiscal && filtros.notaFiscal.trim()) {
      const termo = filtros.notaFiscal.trim().toLowerCase();
      produtos = produtos.filter((p) => p.nota_fiscal.toLowerCase().includes(termo));
    }

    // Mapeamento dinâmico de Fornecedor via relacionamento:
    // recebimentos_produtos.agendamento_id -> agendamentos.id -> agendamentos.fornecedor_id -> fornecedores.id
    const mapaFornecedor = new Map<string, string>();

    // 1. Carrega fornecedores cadastrados para resolver nome_fantasia / razao_social
    const fornecedoresLocais = getLocalFornecedores();
    const mapaNomesFornecedores = new Map<string, string>();
    for (const f of fornecedoresLocais) {
      mapaNomesFornecedores.set(f.id, f.nome_fantasia || f.razao_social);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: fornData } = await supabase
          .from('fornecedores')
          .select('id, nome_fantasia, razao_social');
        if (fornData) {
          for (const f of fornData) {
            mapaNomesFornecedores.set(f.id, f.nome_fantasia || f.razao_social);
          }
        }
      } catch (e) {
        console.warn('Erro ao carregar nomes de fornecedores no Supabase:', e);
      }
    }

    // 2. Busca agendamentos correspondentes
    const agendamentoIds = Array.from(new Set(produtos.map((p) => p.agendamento_id).filter(Boolean)));
    if (isSupabaseConfigured && supabase && agendamentoIds.length > 0) {
      try {
        const { data: agData } = await supabase
          .from('agendamentos')
          .select('id, data, fornecedor, fornecedor_id, nota_fiscal')
          .in('id', agendamentoIds);

        if (agData) {
          for (const ag of agData) {
            const nomeReal =
              (ag.fornecedor_id && mapaNomesFornecedores.get(ag.fornecedor_id)) ||
              ag.fornecedor ||
              '';
            if (nomeReal) {
              mapaFornecedor.set(String(ag.id), nomeReal);
              if (ag.nota_fiscal) {
                mapaFornecedor.set(normalizarNotaFiscal(ag.nota_fiscal), nomeReal);
              }
            }
          }
        }
      } catch (e) {
        console.warn('Erro ao mapear agendamentos do Supabase:', e);
      }
    }

    // Complementa com agendamentos locais
    const agendamentosLocais = getLocalAgendamentos();
    for (const ag of agendamentosLocais) {
      const nomeReal =
        (ag.fornecedor_id && mapaNomesFornecedores.get(ag.fornecedor_id)) ||
        ag.fornecedor ||
        '';
      if (nomeReal) {
        if (!mapaFornecedor.has(String(ag.id))) {
          mapaFornecedor.set(String(ag.id), nomeReal);
        }
        if (ag.nota_fiscal && !mapaFornecedor.has(normalizarNotaFiscal(ag.nota_fiscal))) {
          mapaFornecedor.set(normalizarNotaFiscal(ag.nota_fiscal), nomeReal);
        }
      }
    }

    // Agrupar por Nota Fiscal
    const agrupado = new Map<string, RecebimentoProduto[]>();
    for (const p of produtos) {
      const nf = p.nota_fiscal;
      if (!agrupado.has(nf)) {
        agrupado.set(nf, []);
      }
      agrupado.get(nf)!.push(p);
    }

    const resumos: ResumoNotaRecebimento[] = [];

    agrupado.forEach((itens, nf) => {
      const primeiro = itens[0];
      const totalItens = itens.length;
      const totalQuantidade = itens.reduce((acc, curr) => acc + (Number(curr.quantidade) || 0), 0);
      
      const totalConferidos = itens.filter(
        (i) => i.status === 'Conferido' || i.status === 'Alocado' || i.status === 'Validado'
      ).length;
      const totalCriticas = itens.filter((i) => i.status === 'Crítica').length;

      // Porcentagem calculada: conferidos / total de itens
      const porcentagem = totalItens > 0 ? Math.round((totalConferidos / totalItens) * 100) : 0;

      let statusGeral: ResumoNotaRecebimento['status_geral'] = 'Pendente';
      if (totalCriticas > 0) {
        statusGeral = 'Com Crítica';
      } else if (totalConferidos === totalItens && totalItens > 0) {
        statusGeral = '100% Conferido';
      } else if (totalConferidos > 0) {
        statusGeral = 'Em Conferência';
      } else {
        statusGeral = 'Pendente';
      }

      // Procura fornecedor por agendamento_id ou nota_fiscal
      const fornecedor =
        mapaFornecedor.get(String(primeiro.agendamento_id)) ||
        mapaFornecedor.get(normalizarNotaFiscal(nf)) ||
        'Fornecedor não informado';

      resumos.push({
        nota_fiscal: nf,
        agendamento_id: primeiro.agendamento_id,
        data_recebimento: primeiro.data_recebimento,
        fornecedor,
        total_itens: totalItens,
        total_quantidade: totalQuantidade,
        total_conferidos: totalConferidos,
        total_criticas: totalCriticas,
        porcentagem_conferencia: porcentagem,
        status_geral: statusGeral,
      });
    });

    return resumos.sort((a, b) => b.data_recebimento.localeCompare(a.data_recebimento));
  },

  /**
   * 1b. Busca dados do agendamento correspondente pelo ID ou pela NF:
   * recebimentos_produtos.agendamento_id -> agendamentos.id -> agendamentos.fornecedor_id -> fornecedores.id
   * Exibe: nome_fantasia (ou razao_social como segunda opção)
   * NUNCA exibe o texto genérico "Fornecedor da nota"
   */
  async obterDadosAgendamentoPorId(
    agendamentoId?: string | null,
    fallbackNotaFiscal?: string | null
  ): Promise<{
    agendamento_id: string;
    fornecedor: string;
    nota_fiscal: string;
    data: string;
    volumes?: number;
    tipo_volumes?: string;
    transportadora?: string;
  }> {
    const supabase = getSupabase();

    // 1. Tenta buscar no Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        let agendamentoData: any = null;

        if (agendamentoId) {
          const { data, error } = await supabase
            .from('agendamentos')
            .select('id, data, fornecedor, fornecedor_id, nota_fiscal, volumes, tipo_volumes, transportadora')
            .eq('id', agendamentoId)
            .maybeSingle();

          if (!error && data) {
            agendamentoData = data;
          }
        }

        // Se não achou por ID e temos NF de fallback
        if (!agendamentoData && fallbackNotaFiscal && fallbackNotaFiscal.trim()) {
          const nfLimpa = fallbackNotaFiscal.trim();
          const { data, error } = await supabase
            .from('agendamentos')
            .select('id, data, fornecedor, fornecedor_id, nota_fiscal, volumes, tipo_volumes, transportadora')
            .ilike('nota_fiscal', `%${nfLimpa}%`)
            .maybeSingle();

          if (!error && data) {
            agendamentoData = data;
          }
        }

        if (agendamentoData) {
          let nomeFornecedor = '';

          // Se tem fornecedor_id, busca nome_fantasia na tabela fornecedores
          if (agendamentoData.fornecedor_id) {
            const { data: forn, error: fornErr } = await supabase
              .from('fornecedores')
              .select('id, nome_fantasia, razao_social')
              .eq('id', agendamentoData.fornecedor_id)
              .maybeSingle();

            if (!fornErr && forn) {
              nomeFornecedor = forn.nome_fantasia || forn.razao_social || '';
            }
          }

          if (!nomeFornecedor && agendamentoData.fornecedor) {
            nomeFornecedor = agendamentoData.fornecedor;
          }

          if (nomeFornecedor && !nomeFornecedor.toLowerCase().includes('fornecedor da nota')) {
            return {
              agendamento_id: String(agendamentoData.id),
              fornecedor: nomeFornecedor,
              nota_fiscal: agendamentoData.nota_fiscal || fallbackNotaFiscal || '',
              data: agendamentoData.data || '',
              volumes: agendamentoData.volumes,
              tipo_volumes: agendamentoData.tipo_volumes,
              transportadora: agendamentoData.transportadora,
            };
          }
        }
      } catch (err) {
        console.warn('Erro ao consultar agendamento no Supabase:', err);
      }
    }

    // 2. Fallback local em memória
    const agendamentosLocais = getLocalAgendamentos();
    const agLocal =
      (agendamentoId ? agendamentosLocais.find((a) => String(a.id) === String(agendamentoId)) : null) ||
      (fallbackNotaFiscal
        ? agendamentosLocais.find(
            (a) => a.nota_fiscal && normalizarNotaFiscal(a.nota_fiscal) === normalizarNotaFiscal(fallbackNotaFiscal)
          )
        : null);

    if (agLocal) {
      let nomeFornecedor = '';
      if (agLocal.fornecedor_id) {
        const fornecedores = getLocalFornecedores();
        const forn = fornecedores.find((f) => f.id === agLocal.fornecedor_id);
        if (forn) {
          nomeFornecedor = forn.nome_fantasia || forn.razao_social || '';
        }
      }
      if (!nomeFornecedor) {
        nomeFornecedor = agLocal.fornecedor || '';
      }

      return {
        agendamento_id: String(agLocal.id),
        fornecedor:
          nomeFornecedor && !nomeFornecedor.toLowerCase().includes('fornecedor da nota')
            ? nomeFornecedor
            : 'Fornecedor não informado',
        nota_fiscal: agLocal.nota_fiscal || fallbackNotaFiscal || '',
        data: agLocal.data || '',
        volumes: agLocal.volumes,
        tipo_volumes: agLocal.tipo_volumes,
        transportadora: agLocal.transportadora,
      };
    }

    return {
      agendamento_id: agendamentoId || '',
      fornecedor: 'Fornecedor não informado',
      nota_fiscal: fallbackNotaFiscal || '',
      data: '',
    };
  },

  /**
   * 2. Lista os produtos de uma Nota Fiscal específica para a tela de revisão e histórico.
   */
  async listarProdutosDaNota(notaFiscal: string): Promise<RecebimentoProduto[]> {
    const supabase = getSupabase();
    let produtos: RecebimentoProduto[] = [];

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('recebimentos_produtos')
          .select(CAMPOS_RECEBIMENTO)
          .eq('nota_fiscal', notaFiscal)
          .order('id', { ascending: true });

        if (!error && data) {
          produtos = data as RecebimentoProduto[];
        }
      } catch (e) {
        console.warn('Erro ao buscar produtos da nota no Supabase:', e);
      }
    }

    if (produtos.length === 0) {
      const locais = getLocalRecebimentosProdutos();
      produtos = locais.filter((p) => p.nota_fiscal === notaFiscal);
    }

    // Relacionamento com usuarios: resolve conferente_id -> usuarios.nome
    const conferenteIds = Array.from(
      new Set(produtos.map((p) => p.conferente_id).filter(Boolean))
    ) as string[];

    const mapaUsuarios = new Map<string, string>();
    // Preenche com usuários locais
    const usuariosLocais = getLocalUsuarios();
    for (const u of usuariosLocais) {
      mapaUsuarios.set(String(u.id), u.nome);
    }

    if (isSupabaseConfigured && supabase && conferenteIds.length > 0) {
      try {
        const { data: usersData } = await supabase
          .from('usuarios')
          .select('id, nome')
          .in('id', conferenteIds);
        if (usersData) {
          for (const u of usersData) {
            mapaUsuarios.set(String(u.id), u.nome);
          }
        }
      } catch (err) {
        console.warn('Erro ao resolver nomes de conferentes:', err);
      }
    }

    return produtos.map((p) => {
      const nomeConferente = p.conferente_id ? mapaUsuarios.get(String(p.conferente_id)) : null;
      return {
        ...p,
        conferente_nome: nomeConferente || p.conferente_nome || null,
      };
    });
  },

  /**
   * 3. Retorna os produtos para conferência cega (sem expor a quantidade no modelo do frontend para a fila de contagem).
   */
  async listarItensParaConferenciaCega(notaFiscal: string): Promise<ItemConferenciaCega[]> {
    const produtos = await this.listarProdutosDaNota(notaFiscal);
    const primeiro = produtos[0];

    const dadosAg = primeiro
      ? await this.obterDadosAgendamentoPorId(primeiro.agendamento_id, notaFiscal)
      : null;

    const nomeFornecedor = dadosAg?.fornecedor || 'Fornecedor não informado';

    return produtos.map((p) => ({
      id: p.id,
      agendamento_id: p.agendamento_id,
      nota_fiscal: p.nota_fiscal,
      fornecedor: nomeFornecedor,
      produto: p.produto,
      endereco_original: p.endereco,
      status: p.status,
      data_recebimento: p.data_recebimento,
    }));
  },

  /**
   * 4. Registra a conferência do produto (Conferência Cega).
   * Compara com a quantidade esperada da NF:
   * - Se igual: status = 'Conferido'
   * - Se menor: status = 'Crítica'
   * - Se maior: status = 'Crítica'
   */
  async registrarConferenciaItem(params: {
    produtoId: string | number;
    qtdConferida: number;
    usuarioId: string;
    usuarioNome?: string;
  }): Promise<ResultadoComparacaoCega> {
    const { produtoId, qtdConferida, usuarioId } = params;

    const supabase = getSupabase();

    // 1. Tenta via RPC Supabase para conferência cega estrita
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          'conferir_produto_recebimento',
          {
            p_produto_id: produtoId,
            p_qtd_conferida: qtdConferida,
            p_usuario_id: usuarioId,
          }
        );

        if (!rpcError && rpcData && rpcData.success) {
          // Atualiza também no mockStorage para sincronização
          const locais = getLocalRecebimentosProdutos();
          const atualizados = locais.map((p) => {
            if (String(p.id) === String(produtoId)) {
              return {
                ...p,
                qtd_conferida: qtdConferida,
                conferente_id: usuarioId,
                status: rpcData.status as RecebimentoStatus,
                data_conferencia: new Date().toISOString(),
              };
            }
            return p;
          });
          saveLocalRecebimentosProdutos(atualizados);

          return {
            success: true,
            resultado: rpcData.resultado as ResultadoConferencia,
            status: rpcData.status as RecebimentoStatus,
          };
        }
      } catch (e) {
        console.warn('RPC não disponível, prosseguindo com fallback controlado:', e);
      }
    }

    // 2. Fallback / Implementação direta
    // Busca o produto para validar a quantidade esperada
    let item: RecebimentoProduto | null = null;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('recebimentos_produtos')
          .select('id, quantidade, status')
          .eq('id', produtoId)
          .single();
        if (!error && data) {
          item = data as RecebimentoProduto;
        }
      } catch (e) {
        console.warn('Erro ao buscar item no Supabase:', e);
      }
    }

    if (!item) {
      const locais = getLocalRecebimentosProdutos();
      item = locais.find((p) => String(p.id) === String(produtoId)) || null;
    }

    if (!item) {
      return {
        success: false,
        resultado: 'MENOR',
        status: 'Recebido',
        error: 'Produto não localizado para conferência.',
      };
    }

    const qtdEsperada = Number(item.quantidade) || 0;
    let resultado: ResultadoConferencia = 'IGUAL';
    let novoStatus: RecebimentoStatus = 'Conferido';

    if (qtdConferida === qtdEsperada) {
      resultado = 'IGUAL';
      novoStatus = 'Conferido';
    } else if (qtdConferida < qtdEsperada) {
      resultado = 'MENOR';
      novoStatus = 'Crítica';
    } else {
      resultado = 'MAIOR';
      novoStatus = 'Crítica';
    }

    const dataConferencia = new Date().toISOString();

    // Persiste no Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        const { error: updErr } = await supabase
          .from('recebimentos_produtos')
          .update({
            qtd_conferida: qtdConferida,
            conferente_id: usuarioId,
            data_conferencia: dataConferencia,
            status: novoStatus,
          })
          .eq('id', produtoId);

        if (updErr) {
          console.warn('Erro ao atualizar conferência no Supabase:', updErr.message);
        }
      } catch (e) {
        console.warn('Exceção ao atualizar no Supabase:', e);
      }
    }

    // Persiste no Storage local
    const locais = getLocalRecebimentosProdutos();
    const atualizados = locais.map((p) => {
      if (String(p.id) === String(produtoId)) {
        return {
          ...p,
          qtd_conferida: qtdConferida,
          conferente_id: usuarioId,
          data_conferencia: dataConferencia,
          status: novoStatus,
        };
      }
      return p;
    });
    saveLocalRecebimentosProdutos(atualizados);

    return {
      success: true,
      resultado,
      status: novoStatus,
    };
  },

  /**
   * 5. Reabrir conferência de um item (ex: para re-conferência de item em crítica).
   */
  async reabrirConferencia(produtoId: string | number): Promise<void> {
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('recebimentos_produtos')
          .update({
            status: 'Recebido',
            qtd_conferida: null,
            data_conferencia: null,
            conferente_id: null,
          })
          .eq('id', produtoId);
      } catch (e) {
        console.warn('Erro ao reabrir conferência no Supabase:', e);
      }
    }

    const locais = getLocalRecebimentosProdutos();
    const atualizados = locais.map((p) => {
      if (String(p.id) === String(produtoId)) {
        return {
          ...p,
          status: 'Recebido' as RecebimentoStatus,
          qtd_conferida: null,
          data_conferencia: null,
          conferente_id: null,
          conferente_nome: null,
          saldo_final: p.quantidade,
        };
      }
      return p;
    });
    saveLocalRecebimentosProdutos(atualizados);
  },

  /**
   * 6. Salva produtos importados do Excel no recebimento.
   * Regras:
   * - status = 'Recebido'
   * - saldo_final = quantidade
   */
  async salvarImportacaoExcel(params: {
    agendamentoId: string;
    notaFiscal: string;
    dataRecebimento: string;
    itens: Array<{
      produto: string;
      quantidade: number;
      endereco?: string | null;
      nota_fiscal?: string;
    }>;
  }): Promise<{ totalImportados: number; itens: RecebimentoProduto[] }> {
    const { agendamentoId, notaFiscal, dataRecebimento, itens } = params;

    if (!itens || itens.length === 0) {
      throw new Error('Nenhum item válido para importação.');
    }

    // Consolida itens semelhantes como garantia adicional (soma quantidades)
    const itensConsolidados: Array<{
      produto: string;
      quantidade: number;
      endereco?: string | null;
      nota_fiscal?: string;
    }> = [];

    for (const it of itens) {
      const prodNome = it.produto.trim();
      const existente = itensConsolidados.find((c) =>
        saoProdutosSemelhantes(c.produto, prodNome)
      );

      if (existente) {
        existente.quantidade = Number((existente.quantidade + (Number(it.quantidade) || 0)).toFixed(2));
        if (!existente.endereco && it.endereco) {
          existente.endereco = it.endereco.trim();
        }
      } else {
        itensConsolidados.push({
          produto: prodNome,
          quantidade: Number(it.quantidade) || 0,
          endereco: it.endereco?.trim() || null,
          nota_fiscal: it.nota_fiscal,
        });
      }
    }

    const userUnit = getActiveUserUnit() || UNIDADE_PADRAO_SISTEMA;
    const normalizedUnit = normalizarUnidadeNegocio(userUnit);

    const novosRegistros = itensConsolidados.map((item) => ({
      agendamento_id: agendamentoId,
      unidade_negocio: normalizedUnit,
      nota_fiscal: notaFiscal.trim(),
      data_recebimento: dataRecebimento,
      produto: item.produto,
      endereco: item.endereco || null,
      quantidade: Number(item.quantidade) || 0,
      saldo_final: Number(item.quantidade) || 0, // Inicia igual à quantidade recebida
      status: 'Recebido' as RecebimentoStatus,
      qtd_conferida: null,
      conferente_id: null,
      data_conferencia: null,
      repositor_id: null,
      data_alocacao: null,
      novo_endereco: null,
    }));

    const supabase = getSupabase();
    let criados: RecebimentoProduto[] = [];

    if (isSupabaseConfigured && supabase) {
      try {
        let { data, error }: { data: any; error: any } = await supabase
          .from('recebimentos_produtos')
          .insert(novosRegistros)
          .select(CAMPOS_RECEBIMENTO);

        if (error && (error.message.includes('unidade_negocio') || error.code === '42703')) {
          const fallbackRegs = novosRegistros.map(({ unidade_negocio, ...rest }) => rest);
          const retryRes = await supabase
            .from('recebimentos_produtos')
            .insert(fallbackRegs)
            .select(CAMPOS_RECEBIMENTO_FALLBACK);
          data = retryRes.data;
          error = retryRes.error;
        }

        if (!error && data) {
          criados = data as RecebimentoProduto[];
        } else if (error) {
          console.warn('Erro ao salvar importação no Supabase, usando local:', error.message);
        }
      } catch (e) {
        console.warn('Exceção ao inserir no Supabase, usando local:', e);
      }
    }

    if (criados.length === 0) {
      const timestamp = Date.now();
      criados = novosRegistros.map((reg, idx) => ({
        ...reg,
        id: `rec-imp-${timestamp}-${idx}`,
        importado_excel: true,
        origem: 'excel',
        created_at: new Date().toISOString(),
      }));
    } else {
      criados = criados.map((item) => ({
        ...item,
        importado_excel: true,
        origem: 'excel',
      }));
    }

    // Registra IDs importados no cache persistente para identificação rápida
    try {
      const raw = localStorage.getItem('polihub_produtos_excel_ids');
      const ids: string[] = raw ? JSON.parse(raw) : [];
      criados.forEach((c) => ids.push(String(c.id)));
      localStorage.setItem('polihub_produtos_excel_ids', JSON.stringify(Array.from(new Set(ids))));
    } catch {}

    // Salva no mockStorage
    const locais = getLocalRecebimentosProdutos();
    saveLocalRecebimentosProdutos([...locais, ...criados]);

    // Regra 6 e 7: Quando uma nova NF entrar no fluxo de Recebimentos com status 'Recebido', gera o Push
    if (criados.length > 0 && notaFiscal) {
      pushNotificationService.notificarNovaNfRecebida({
        notaFiscal: notaFiscal.trim(),
        quantidadeItens: criados.length,
      });
    }

    return {
      totalImportados: criados.length,
      itens: criados,
    };
  },

  /**
   * 7. Finalização Excepcional de Nota Fiscal (Ação exclusiva de Gestor).
   * Valida TODOS os itens da nota fiscal (inclusive os com crítica ou pendentes),
   * preserva histórico de conferência e divergências,
   * remove a nota fiscal da listagem de pendências de Recebimento
   * e disponibiliza os itens no módulo Alocação.
   */
  async finalizarNotaFiscalExcepcional(params: {
    notaFiscal: string;
    agendamentoId?: string;
  }): Promise<{ success: boolean; totalValidados: number; message: string }> {
    const { notaFiscal, agendamentoId } = params;
    const user = getActiveUserProfile();
    if (!isUserGestor(user)) {
      throw new Error('Ação permitida exclusivamente para usuários com nível Gestor.');
    }

    const activeUnit = getActiveUserUnit() || UNIDADE_PADRAO_SISTEMA;
    const supabase = getSupabase();

    // 1. Localiza todos os produtos da nota (busca direta pelos campos necessários)
    let produtosNota: RecebimentoProduto[] = [];
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('recebimentos_produtos')
          .select(CAMPOS_RECEBIMENTO)
          .eq('nota_fiscal', notaFiscal);

        if (!error && data) {
          produtosNota = data as RecebimentoProduto[];
        }
      } catch (e) {
        console.warn('Erro ao consultar produtos da nota no Supabase:', e);
      }
    }

    if (produtosNota.length === 0) {
      const locais = getLocalRecebimentosProdutos();
      produtosNota = locais.filter((p) => p.nota_fiscal === notaFiscal);
    }

    if (produtosNota.length === 0) {
      throw new Error(`Nenhum produto localizado para a Nota Fiscal ${notaFiscal}.`);
    }

    // Validação estrita de unidade de negócio: usuário não pode finalizar notas de outra unidade
    const algumItemOutraUnidade = produtosNota.some(
      (p) => p.unidade_negocio && !itemMatchesUserUnit(p.unidade_negocio, activeUnit)
    );
    if (algumItemOutraUnidade) {
      throw new Error('Usuário não autorizado a finalizar notas fiscais de outra unidade de negócio.');
    }

    // Regra de prevenção: se TODOS os itens já estiverem validados ou alocados
    const todosJaValidados = produtosNota.every(
      (p) => p.status === 'Validado' || p.status === 'Alocado'
    );
    if (todosJaValidados) {
      throw new Error('Esta nota fiscal já foi finalizada. Não há itens pendentes para validação.');
    }

    const nowIso = new Date().toISOString();

    // 2. Atualiza atomicamente no Supabase todos os itens da nota (exceto os que já estão 'Alocado')
    if (isSupabaseConfigured && supabase) {
      try {
        const { error: updError } = await supabase
          .from('recebimentos_produtos')
          .update({
            status: 'Validado',
          })
          .eq('nota_fiscal', notaFiscal)
          .neq('status', 'Alocado');

        if (updError) {
          throw new Error(`Erro ao finalizar nota fiscal no Supabase: ${updError.message}`);
        }
      } catch (err: any) {
        if (err.message && err.message.includes('Supabase:')) throw err;
        console.warn('Exceção ao atualizar no Supabase, prosseguindo com fallback local:', err);
      }
    }

    // 3. Atualiza local storage mantendo estritamente preservados os dados de conferência e críticas anteriores
    const locais = getLocalRecebimentosProdutos();
    const atualizados = locais.map((p) => {
      if (p.nota_fiscal === notaFiscal && p.status !== 'Alocado') {
        return {
          ...p,
          status: 'Validado' as RecebimentoStatus,
          // Garante saldo_final preenchido se estava indefinido
          saldo_final: p.saldo_final !== undefined && p.saldo_final !== null ? p.saldo_final : p.quantidade,
        };
      }
      return p;
    });
    saveLocalRecebimentosProdutos(atualizados);

    // 4. Registro de auditoria e rastreabilidade (usuário gestor, data/hora, operação e itens)
    try {
      await atualizacoesService.registrar({
        unidade_negocio: produtosNota[0]?.unidade_negocio || activeUnit,
        modulo: 'recebimento',
        tipo: 'finalizacao_excepcional',
        titulo: `NF ${notaFiscal} finalizada (Gestor)`,
        descricao: `Nota fiscal ${notaFiscal} finalizada excepcionalmente pelo Gestor ${user?.nome || 'Gestor'}. Todos os ${produtosNota.length} itens foram validados e liberados para alocação.`,
        registro_id: String(agendamentoId || notaFiscal),
        usuario_id: user?.id || null,
        data_evento: nowIso,
      });
    } catch (auditErr) {
      console.warn('Erro ao registrar auditoria de finalização:', auditErr);
    }

    return {
      success: true,
      totalValidados: produtosNota.length,
      message: 'Nota fiscal finalizada com sucesso. Todos os itens foram validados e estão disponíveis para alocação.',
    };
  },

  /**
   * 8. Validação Excepcional Individual de Produto (Ação exclusiva de Gestor).
   * Valida SOMENTE o produto selecionado, liberando-o para alocação,
   * preservando as informações originais da conferência e eventuais críticas.
   */
  async validarProdutoIndividualExcepcional(produtoId: string | number): Promise<{
    success: boolean;
    produto: RecebimentoProduto;
    message: string;
  }> {
    const user = getActiveUserProfile();
    if (!isUserGestor(user)) {
      throw new Error('Ação permitida exclusivamente para usuários com nível Gestor.');
    }

    const activeUnit = getActiveUserUnit() || UNIDADE_PADRAO_SISTEMA;
    const supabase = getSupabase();

    // 1. Busca produto específico (baixo consumo de dados, sem carregar tudo)
    let item: RecebimentoProduto | null = null;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('recebimentos_produtos')
          .select(CAMPOS_RECEBIMENTO)
          .eq('id', produtoId)
          .single();

        if (!error && data) {
          item = data as RecebimentoProduto;
        }
      } catch (e) {
        console.warn('Erro ao buscar item no Supabase:', e);
      }
    }

    if (!item) {
      const locais = getLocalRecebimentosProdutos();
      item = locais.find((p) => String(p.id) === String(produtoId)) || null;
    }

    if (!item) {
      throw new Error('Produto não localizado para validação.');
    }

    // Validação estrita de unidade de negócio
    if (item.unidade_negocio && !itemMatchesUserUnit(item.unidade_negocio, activeUnit)) {
      throw new Error('Usuário não autorizado a validar produtos de outra unidade de negócio.');
    }

    // Regra de prevenção: se o produto já estiver validado ou alocado
    if (item.status === 'Validado' || item.status === 'Alocado') {
      throw new Error('Este produto já foi validado e está disponível para alocação.');
    }

    const nowIso = new Date().toISOString();

    // 2. Atualiza status no Supabase preservando dados originais
    if (isSupabaseConfigured && supabase) {
      try {
        const { error: updError } = await supabase
          .from('recebimentos_produtos')
          .update({
            status: 'Validado',
          })
          .eq('id', produtoId);

        if (updError) {
          throw new Error(`Erro ao validar produto no Supabase: ${updError.message}`);
        }
      } catch (err: any) {
        if (err.message && err.message.includes('Supabase:')) throw err;
        console.warn('Exceção ao atualizar no Supabase, prosseguindo com fallback local:', err);
      }
    }

    // 3. Atualiza local storage mantendo dados de conferência originais
    const produtoAtualizado: RecebimentoProduto = {
      ...item,
      status: 'Validado' as RecebimentoStatus,
      saldo_final: item.saldo_final !== undefined && item.saldo_final !== null ? item.saldo_final : item.quantidade,
    };

    const locais = getLocalRecebimentosProdutos();
    const atualizados = locais.map((p) => (String(p.id) === String(produtoId) ? produtoAtualizado : p));
    saveLocalRecebimentosProdutos(atualizados);

    // 4. Registro de auditoria
    try {
      await atualizacoesService.registrar({
        unidade_negocio: item.unidade_negocio || activeUnit,
        modulo: 'recebimento',
        tipo: 'validacao_excepcional',
        titulo: `Item ${item.produto} validado (Gestor)`,
        descricao: `Produto "${item.produto}" da NF ${item.nota_fiscal} validado excepcionalmente pelo Gestor ${user?.nome || 'Gestor'} e liberado para alocação.`,
        registro_id: String(item.id),
        usuario_id: user?.id || null,
        data_evento: nowIso,
      });
    } catch (auditErr) {
      console.warn('Erro ao registrar auditoria de validação individual:', auditErr);
    }

    return {
      success: true,
      produto: produtoAtualizado,
      message: 'Produto validado com sucesso e disponibilizado para alocação.',
    };
  },

  /**
   * 15. HISTÓRICO DE RECEBIMENTOS — ABA "NFs Recebidas"
   * Consulta paginada (100 por vez) na tabela recebimentos_produtos.
   * Regras de performance e negócio:
   * - NUNCA usa SELECT *.
   * - Busca apenas Data, Produto, Nota Fiscal, Quantidade, Fornecedor e campos necessários para o status.
   * - Paginação no banco via .range(from, to).
   * - Isolamento obrigatório por unidade de negócio.
   * - Não aplica filtro de status (traz Não conferidos, Conferidos e Alocados).
   * - Não permite alteração (somente consulta/histórico).
   */
  async listarHistoricoRecebimentos({
    pagina = 1,
    limite = 100,
    unidadeNegocio,
  }: {
    pagina?: number;
    limite?: number;
    unidadeNegocio?: string;
  } = {}): Promise<RespostaHistoricoRecebimentos> {
    const supabase = getSupabase();
    const activeUnit = unidadeNegocio || getActiveUserUnit() || UNIDADE_PADRAO_SISTEMA;
    const unitEquivalents = getUnitEquivalents(activeUnit);
    const from = Math.max(0, (pagina - 1) * limite);
    const to = from + limite - 1;

    let totalRegistros = 0;
    let rawItems: any[] = [];

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('recebimentos_produtos')
          .select(CAMPOS_HISTORICO_RECEBIMENTO, { count: 'exact' })
          .order('data_recebimento', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to);

        if (activeUnit) {
          query = query.in('unidade_negocio', unitEquivalents);
        }

        let { data, error, count }: { data: any; error: any; count: any } = await query;

        // Fallback se a coluna unidade_negocio não existir no schema
        if (error && (error.message.includes('unidade_negocio') || error.code === '42703')) {
          const fallbackRes = await supabase
            .from('recebimentos_produtos')
            .select(CAMPOS_HISTORICO_RECEBIMENTO_FALLBACK, { count: 'exact' })
            .order('data_recebimento', { ascending: false })
            .order('id', { ascending: false })
            .range(from, to);
          data = fallbackRes.data;
          error = fallbackRes.error;
          count = fallbackRes.count;
        }

        if (!error && data) {
          rawItems = data;
          totalRegistros = count || data.length;
        } else {
          if (error) {
            console.warn('Erro ao consultar histórico de recebimentos no Supabase:', error.message);
          }
          const localItems = getLocalRecebimentosProdutos().filter((item) =>
            itemMatchesUserUnit(item.unidade_negocio, activeUnit)
          );
          totalRegistros = localItems.length;
          localItems.sort((a, b) => (b.data_recebimento || '').localeCompare(a.data_recebimento || ''));
          rawItems = localItems.slice(from, to + 1);
        }
      } catch (err) {
        console.warn('Exceção ao consultar histórico de recebimentos:', err);
        const localItems = getLocalRecebimentosProdutos().filter((item) =>
          itemMatchesUserUnit(item.unidade_negocio, activeUnit)
        );
        totalRegistros = localItems.length;
        localItems.sort((a, b) => (b.data_recebimento || '').localeCompare(a.data_recebimento || ''));
        rawItems = localItems.slice(from, to + 1);
      }
    } else {
      const localItems = getLocalRecebimentosProdutos().filter((item) =>
        itemMatchesUserUnit(item.unidade_negocio, activeUnit)
      );
      totalRegistros = localItems.length;
      localItems.sort((a, b) => (b.data_recebimento || '').localeCompare(a.data_recebimento || ''));
      rawItems = localItems.slice(from, to + 1);
    }

    // Resolução eficiente de fornecedores (apenas para os itens da página atual)
    const mapaFornecedor = new Map<string, string>();
    const agendamentoIds = Array.from(new Set(rawItems.map((r) => r.agendamento_id).filter(Boolean)));

    if (isSupabaseConfigured && supabase && agendamentoIds.length > 0) {
      try {
        const { data: ags } = await supabase
          .from('agendamentos')
          .select('id, fornecedor, nota_fiscal')
          .in('id', agendamentoIds);

        if (ags) {
          for (const ag of ags) {
            if (ag.fornecedor && ag.fornecedor.trim()) {
              mapaFornecedor.set(String(ag.id), ag.fornecedor.trim());
              if (ag.nota_fiscal) {
                mapaFornecedor.set(normalizarNotaFiscal(ag.nota_fiscal), ag.fornecedor.trim());
              }
            }
          }
        }
      } catch (e) {
        console.warn('Erro ao resolver fornecedores da página de histórico:', e);
      }
    }

    // Complementa com agendamentos locais para agendamento_id ou nota_fiscal
    const agendamentosLocais = getLocalAgendamentos();
    for (const ag of agendamentosLocais) {
      if (ag.fornecedor && ag.fornecedor.trim()) {
        if (!mapaFornecedor.has(String(ag.id))) {
          mapaFornecedor.set(String(ag.id), ag.fornecedor.trim());
        }
        if (ag.nota_fiscal && !mapaFornecedor.has(normalizarNotaFiscal(ag.nota_fiscal))) {
          mapaFornecedor.set(normalizarNotaFiscal(ag.nota_fiscal), ag.fornecedor.trim());
        }
      }
    }

    const itens: ItemHistoricoRecebimento[] = rawItems.map((item) => {
      const fornId = item.agendamento_id ? mapaFornecedor.get(String(item.agendamento_id)) : null;
      const fornNf = item.nota_fiscal ? mapaFornecedor.get(normalizarNotaFiscal(item.nota_fiscal)) : null;
      const fornecedor = fornId || fornNf || 'Fornecedor não informado';

      return {
        id: item.id,
        data_recebimento: item.data_recebimento || '',
        produto: item.produto || '',
        nota_fiscal: item.nota_fiscal || '',
        quantidade: Number(item.quantidade) || 0,
        fornecedor,
        status: item.status || 'Recebido',
        unidade_negocio: item.unidade_negocio,
        data_conferencia: item.data_conferencia,
        data_alocacao: item.data_alocacao,
        saldo_final: item.saldo_final,
      };
    });

    const totalPaginas = Math.max(1, Math.ceil(totalRegistros / limite));

    return {
      itens,
      totalRegistros,
      paginaAtual: pagina,
      totalPaginas,
      limitePorPagina: limite,
    };
  },

  /**
   * 11. OBTÉM MÉTRICAS E INDICADORES PARA A ABA DE GRÁFICOS DO RECEBIMENTO
   * Utiliza apenas colunas explícitas (NUNCA SELECT *), isolamento por unidade de negócio,
   * relacionamentos reais entre agendamentos e recebimentos_produtos e regras de cálculo exatas.
   */
  async obterMetricasRecebimento(
    filtros: FiltrosMetricasRecebimento = {}
  ): Promise<MetricasRecebimento> {
    const supabase = getSupabase();
    const activeUnit = filtros.unidadeNegocio || getActiveUserUnit();

    // 1. Resolução do período
    let dataInicio = filtros.dataInicio;
    let dataFim = filtros.dataFim;
    const dias = filtros.dias !== undefined ? filtros.dias : 30;

    if (!dataInicio && !dataFim && dias > 0) {
      const hoje = new Date();
      const retro = new Date(hoje.getTime() - dias * 24 * 60 * 60 * 1000);
      dataInicio = retro.toISOString().slice(0, 10);
      dataFim = hoje.toISOString().slice(0, 10);
    }

    let rawRecebimentos: Array<{
      id: string | number;
      agendamento_id: string;
      unidade_negocio?: string;
      data_recebimento: string;
      nota_fiscal: string;
      produto: string;
      quantidade: number;
      qtd_conferida?: number | null;
      status: RecebimentoStatus;
      data_conferencia?: string | null;
      data_alocacao?: string | null;
    }> = [];

    let rawAgendamentos: Array<{
      id: string;
      unidade_negocio?: string;
      fornecedor: string;
      nota_fiscal: string;
      status?: string;
      data_prevista?: string;
      data_entrega?: string | null;
      data_insercao: string;
    }> = [];

    // 2. Consulta no Supabase ou fallback local
    if (isSupabaseConfigured && supabase) {
      try {
        let qRec = supabase
          .from('recebimentos_produtos')
          .select(CAMPOS_METRICAS_RECEBIMENTO)
          .order('data_recebimento', { ascending: true });

        if (activeUnit) {
          qRec = qRec.in('unidade_negocio', getUnitEquivalents(activeUnit));
        }
        if (dataInicio) {
          qRec = qRec.gte('data_recebimento', dataInicio);
        }
        if (dataFim) {
          qRec = qRec.lte('data_recebimento', dataFim);
        }

        let qAg = supabase
          .from('agendamentos')
          .select(CAMPOS_METRICAS_AGENDAMENTOS);

        if (activeUnit) {
          qAg = qAg.in('unidade_negocio', getUnitEquivalents(activeUnit));
        }

        const [resRec, resAg] = await Promise.allSettled([qRec, qAg]);

        if (resRec.status === 'fulfilled' && !resRec.value.error && resRec.value.data) {
          rawRecebimentos = resRec.value.data as any;
        } else {
          const locaisRec = getLocalRecebimentosProdutos();
          rawRecebimentos = locaisRec.filter((r) =>
            itemMatchesUserUnit(r.unidade_negocio, activeUnit)
          ) as any;
          if (dataInicio) {
            rawRecebimentos = rawRecebimentos.filter(
              (r) => (r.data_recebimento || '').slice(0, 10) >= dataInicio!
            );
          }
          if (dataFim) {
            rawRecebimentos = rawRecebimentos.filter(
              (r) => (r.data_recebimento || '').slice(0, 10) <= dataFim!
            );
          }
        }

        if (resAg.status === 'fulfilled' && !resAg.value.error && resAg.value.data) {
          rawAgendamentos = resAg.value.data as any;
        } else {
          const locaisAg = getLocalAgendamentos();
          rawAgendamentos = locaisAg.filter((a) =>
            itemMatchesUserUnit(a.unidade_negocio, activeUnit)
          ) as any;
        }
      } catch (err) {
        console.warn('Erro ao consultar métricas no Supabase, usando local:', err);
        const locaisRec = getLocalRecebimentosProdutos();
        rawRecebimentos = locaisRec.filter((r) =>
          itemMatchesUserUnit(r.unidade_negocio, activeUnit)
        ) as any;
        const locaisAg = getLocalAgendamentos();
        rawAgendamentos = locaisAg.filter((a) =>
          itemMatchesUserUnit(a.unidade_negocio, activeUnit)
        ) as any;
      }
    } else {
      const locaisRec = getLocalRecebimentosProdutos();
      rawRecebimentos = locaisRec.filter((r) =>
        itemMatchesUserUnit(r.unidade_negocio, activeUnit)
      ) as any;
      if (dataInicio) {
        rawRecebimentos = rawRecebimentos.filter(
          (r) => (r.data_recebimento || '').slice(0, 10) >= dataInicio!
        );
      }
      if (dataFim) {
        rawRecebimentos = rawRecebimentos.filter(
          (r) => (r.data_recebimento || '').slice(0, 10) <= dataFim!
        );
      }
      const locaisAg = getLocalAgendamentos();
      rawAgendamentos = locaisAg.filter((a) =>
        itemMatchesUserUnit(a.unidade_negocio, activeUnit)
      ) as any;
    }

    // 3. Mapeamentos de agendamentos para vincular fornecedor aos recebimentos
    const agMapById = new Map<string, any>();
    const agMapByNf = new Map<string, any>();
    const fornecedoresDisponiveisSet = new Set<string>();

    rawAgendamentos.forEach((ag) => {
      if (ag.id) agMapById.set(String(ag.id), ag);
      if (ag.nota_fiscal) {
        agMapByNf.set(normalizarNotaFiscal(ag.nota_fiscal), ag);
      }
      if (ag.fornecedor && ag.fornecedor.trim()) {
        fornecedoresDisponiveisSet.add(ag.fornecedor.trim());
      }
    });

    const fornecedorSelecionado =
      filtros.fornecedor && filtros.fornecedor !== 'Todos'
        ? filtros.fornecedor.trim().toLowerCase()
        : null;

    // 4. Associação de fornecedor em cada item de recebimento
    const itensCompletos = rawRecebimentos.map((r) => {
      const ag =
        agMapById.get(String(r.agendamento_id)) ||
        agMapByNf.get(normalizarNotaFiscal(r.nota_fiscal));
      const fornecedor = ag?.fornecedor?.trim() || 'Fornecedor Geral';
      if (fornecedor && fornecedor !== 'Fornecedor Geral') {
        fornecedoresDisponiveisSet.add(fornecedor);
      }
      return {
        ...r,
        fornecedor,
        agendamento: ag || null,
      };
    });

    // Filtra por fornecedor quando selecionado
    const itensFiltrados = fornecedorSelecionado
      ? itensCompletos.filter(
          (item) => item.fornecedor.toLowerCase() === fornecedorSelecionado
        )
      : itensCompletos;

    // 5. Agregações e Cálculos
    const notasDistintasSet = new Set<string>();
    const skusDistintosGeralSet = new Set<string>();
    let totalUnidadesFisicas = 0;
    let totalLinhasProdutos = itensFiltrados.length;

    // Mapeamento por Dia (para cálculo de média diária de SKUs e evolução diária)
    const porDiaMap = new Map<
      string,
      {
        skus: Set<string>;
        notas: Set<string>;
        linhas: number;
        unidades: number;
      }
    >();

    // Mapeamento por Fornecedor
    const porFornecedorMap = new Map<
      string,
      {
        notas: Set<string>;
        linhas: number;
        unidades: number;
        notasCriticas: Set<string>;
        itensCriticos: number;
      }
    >();

    // Mapeamento por Produto
    const porProdutoMap = new Map<
      string,
      {
        quantidadeTotal: number;
        notas: Set<string>;
        rawProduto: string;
      }
    >();

    const notasComDivergenciaGeral = new Set<string>();

    itensFiltrados.forEach((item) => {
      const nfNorm = normalizarNotaFiscal(item.nota_fiscal) || `nf-${item.id}`;
      notasDistintasSet.add(nfNorm);

      const qtdNum = Number(item.quantidade) || 0;
      totalUnidadesFisicas += qtdNum;

      const sku = (item.produto || '').trim();
      if (sku) {
        skusDistintosGeralSet.add(sku);
      }

      // Dia
      const dataStr = (item.data_recebimento || '').slice(0, 10);
      if (dataStr) {
        if (!porDiaMap.has(dataStr)) {
          porDiaMap.set(dataStr, {
            skus: new Set<string>(),
            notas: new Set<string>(),
            linhas: 0,
            unidades: 0,
          });
        }
        const diaData = porDiaMap.get(dataStr)!;
        if (sku) diaData.skus.add(sku);
        diaData.notas.add(nfNorm);
        diaData.linhas += 1;
        diaData.unidades += qtdNum;
      }

      // Fornecedor
      const forn = item.fornecedor || 'Fornecedor Geral';
      if (!porFornecedorMap.has(forn)) {
        porFornecedorMap.set(forn, {
          notas: new Set<string>(),
          linhas: 0,
          unidades: 0,
          notasCriticas: new Set<string>(),
          itensCriticos: 0,
        });
      }
      const fornData = porFornecedorMap.get(forn)!;
      fornData.notas.add(nfNorm);
      fornData.linhas += 1;
      fornData.unidades += qtdNum;

      // Divergência / Crítica
      const isCritica =
        item.status === 'Crítica' ||
        (item.qtd_conferida !== null &&
          item.qtd_conferida !== undefined &&
          Number(item.qtd_conferida) !== Number(item.quantidade));

      if (isCritica) {
        fornData.notasCriticas.add(nfNorm);
        fornData.itensCriticos += 1;
        notasComDivergenciaGeral.add(nfNorm);
      }

      // Produto
      if (!porProdutoMap.has(sku)) {
        porProdutoMap.set(sku, {
          quantidadeTotal: 0,
          notas: new Set<string>(),
          rawProduto: sku,
        });
      }
      const prodData = porProdutoMap.get(sku)!;
      prodData.quantidadeTotal += qtdNum;
      prodData.notas.add(nfNorm);
    });

    // 6. Indicador 3: Média de SKUs recebidos por dia
    const totalDiasComRecebimento = porDiaMap.size;
    let somaSkusDiarios = 0;
    porDiaMap.forEach((d) => {
      somaSkusDiarios += d.skus.size;
    });
    const mediaSkusPorDia =
      totalDiasComRecebimento > 0
        ? Number((somaSkusDiarios / totalDiasComRecebimento).toFixed(1))
        : 0;

    // 7. Indicador 4 & 8: Tempo médio entre agendamento e chegada (dias entre data_insercao e data_entrega)
    // Regra estrita: considerar somente registros com ambas as datas válidas
    let somaDiasGeral = 0;
    let totalAgendamentosValidosTempo = 0;
    const tempoPorFornecedorMap = new Map<
      string,
      { somaDias: number; total: number }
    >();

    // Conjunto de NFs presentes no período para alinhar com o escopo
    const nfsNoEscopo = new Set(
      itensFiltrados.map((i) => normalizarNotaFiscal(i.nota_fiscal))
    );

    const agendamentosParaTempo = rawAgendamentos.filter((ag) => {
      // Se filtramos fornecedor específico
      if (fornecedorSelecionado) {
        if ((ag.fornecedor || '').trim().toLowerCase() !== fornecedorSelecionado) {
          return false;
        }
      }
      // Se há recebimentos no período, avalia os agendamentos associados
      if (nfsNoEscopo.size > 0 && ag.nota_fiscal) {
        return nfsNoEscopo.has(normalizarNotaFiscal(ag.nota_fiscal));
      }
      return true;
    });

    agendamentosParaTempo.forEach((ag) => {
      if (ag.data_insercao && ag.data_entrega) {
        const dIns = new Date(ag.data_insercao);
        const rawEntrega = ag.data_entrega.includes('T')
          ? ag.data_entrega
          : `${ag.data_entrega}T12:00:00`;
        const dEnt = new Date(rawEntrega);

        if (!isNaN(dIns.getTime()) && !isNaN(dEnt.getTime())) {
          const diffMs = dEnt.getTime() - dIns.getTime();
          const diffDias = Math.max(0, diffMs / (1000 * 60 * 60 * 24));

          somaDiasGeral += diffDias;
          totalAgendamentosValidosTempo += 1;

          const forn = ag.fornecedor?.trim() || 'Fornecedor Geral';
          if (!tempoPorFornecedorMap.has(forn)) {
            tempoPorFornecedorMap.set(forn, { somaDias: 0, total: 0 });
          }
          const tForn = tempoPorFornecedorMap.get(forn)!;
          tForn.somaDias += diffDias;
          tForn.total += 1;
        }
      }
    });

    const tempoMedioAgendamentoChegadaDias =
      totalAgendamentosValidosTempo > 0
        ? Number((somaDiasGeral / totalAgendamentosValidosTempo).toFixed(1))
        : null;

    // 8. Indicador 1: Ranking de fornecedores (até 5 fornecedores com maior volume)
    const rankingFornecedores = Array.from(porFornecedorMap.entries())
      .map(([fornecedor, d]) => ({
        fornecedor,
        totalNotas: d.notas.size,
        totalLinhas: d.linhas,
        totalUnidades: d.unidades,
      }))
      .sort((a, b) => b.totalUnidades - a.totalUnidades || b.totalNotas - a.totalNotas)
      .slice(0, 5);

    // 9. Indicador 2: Ranking de produtos (até 5 produtos com maior quantidade recebida)
    const rankingProdutos = Array.from(porProdutoMap.entries())
      .map(([rawProduto, d]) => {
        const extraido = extrairCodigoEDescricaoProduto(rawProduto);
        return {
          descricao: extraido.descricao,
          codigo: extraido.codigo,
          quantidadeTotal: d.quantidadeTotal,
          totalNotas: d.notas.size,
        };
      })
      .sort((a, b) => b.quantidadeTotal - a.quantidadeTotal)
      .slice(0, 5);

    // 10. Indicador 5: Volume de recebimentos por dia (evolução diária)
    const volumePorDia = Array.from(porDiaMap.entries())
      .map(([dataStr, d]) => {
        const partes = dataStr.split('-');
        const dataLabel =
          partes.length === 3 ? `${partes[2]}/${partes[1]}` : dataStr;
        return {
          data: dataStr,
          dataLabel,
          totalNotas: d.notas.size,
          totalItensLinhas: d.linhas,
          totalUnidades: d.unidades,
          totalSkus: d.skus.size,
        };
      })
      .sort((a, b) => a.data.localeCompare(b.data));

    // 11. Indicador 6: Recebimentos por fornecedor (comparação de quantidade de itens)
    const totalGeralUnidadesParaCalc = Math.max(1, totalUnidadesFisicas);
    const recebimentosPorFornecedor = Array.from(porFornecedorMap.entries())
      .map(([fornecedor, d]) => ({
        fornecedor,
        totalUnidades: d.unidades,
        totalNotas: d.notas.size,
        percentualVolume: Math.round(
          (d.unidades / totalGeralUnidadesParaCalc) * 100
        ),
      }))
      .sort((a, b) => b.totalUnidades - a.totalUnidades);

    // 12. Indicador 7: Fornecedores com divergências (notas com produtos em status Crítica)
    const fornecedoresComDivergencias = Array.from(porFornecedorMap.entries())
      .filter(([, d]) => d.notasCriticas.size > 0 || d.itensCriticos > 0)
      .map(([fornecedor, d]) => {
        const totalNotasForn = Math.max(1, d.notas.size);
        return {
          fornecedor,
          totalNotasComCritica: d.notasCriticas.size,
          totalItensCriticos: d.itensCriticos,
          totalNotasFornecedor: d.notas.size,
          percentualCritica: Math.round(
            (d.notasCriticas.size / totalNotasForn) * 100
          ),
        };
      })
      .sort((a, b) => b.totalNotasComCritica - a.totalNotasComCritica);

    // 13. Indicador 8: Tempo de recebimento por fornecedor
    const tempoRecebimentoPorFornecedor = Array.from(
      tempoPorFornecedorMap.entries()
    )
      .map(([fornecedor, d]) => ({
        fornecedor,
        tempoMedioDias: Number((d.somaDias / d.total).toFixed(1)),
        totalAgendamentosAvaliados: d.total,
      }))
      .sort((a, b) => a.tempoMedioDias - b.tempoMedioDias);

    const totalNotasGerais = notasDistintasSet.size;
    const taxaAcuraciaConferencia =
      totalNotasGerais > 0
        ? Math.round(
            ((totalNotasGerais - notasComDivergenciaGeral.size) /
              totalNotasGerais) *
              100
          )
        : 100;

    return {
      periodo: {
        dataInicio: dataInicio || '',
        dataFim: dataFim || '',
        diasFiltro: dias,
        fornecedorFiltro: filtros.fornecedor || 'Todos',
      },
      totais: {
        totalNotas: totalNotasGerais,
        totalLinhasProdutos,
        totalUnidadesRecebidas: totalUnidadesFisicas,
        totalSkusDistintos: skusDistintosGeralSet.size,
        totalDiasComRecebimento,
        mediaSkusPorDia,
        tempoMedioAgendamentoChegadaDias,
        totalAgendamentosValidosTempo,
        totalNotasComDivergencia: notasComDivergenciaGeral.size,
        taxaAcuraciaConferencia,
      },
      rankingFornecedores,
      rankingProdutos,
      volumePorDia,
      recebimentosPorFornecedor,
      fornecedoresComDivergencias,
      tempoRecebimentoPorFornecedor,
      fornecedoresDisponiveis: Array.from(fornecedoresDisponiveisSet).sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
      ),
    };
  },
};

/**
 * Normaliza o status de recebimento para identificação clara solicitada:
 * - Não conferida
 * - Conferida
 * - Alocada
 */
export function normalizarStatusMercadoria(item: {
  status?: string | null;
  data_alocacao?: string | null;
  data_conferencia?: string | null;
  saldo_final?: number | null;
}): 'Não conferida' | 'Conferida' | 'Alocada' {
  const st = String(item.status || '').trim().toLowerCase();
  if (st === 'alocado' || (item.data_alocacao && Number(item.saldo_final) === 0)) {
    return 'Alocada';
  }
  if (st === 'conferido' || st === 'validado' || Boolean(item.data_conferencia)) {
    return 'Conferida';
  }
  return 'Não conferida';
}

/**
 * Identifica se um registro de produto foi importado/inserido via planilha Excel
 */
export function isProdutoImportadoExcel(produto: RecebimentoProduto): boolean {
  if (!produto) return false;
  if (produto.importado_excel === true) return true;
  if (produto.origem === 'excel') return true;
  if (String(produto.id).startsWith('rec-imp') || String(produto.id).startsWith('rec-p')) return true;

  try {
    const raw = localStorage.getItem('polihub_produtos_excel_ids');
    if (raw) {
      const ids: string[] = JSON.parse(raw);
      if (ids.includes(String(produto.id))) return true;
    }
  } catch {}

  // Se o agendamento tiver indicador de importação Excel nos metadados ou se a origem não for expressamente 'manual'
  if (produto.origem !== 'manual' && (produto.origem === 'excel' || produto.importado_excel !== false)) {
    return true;
  }

  return false;
}

/**
 * Extrai código (SKU/referência) e descrição limpa de um nome de produto
 * Exemplos:
 * "POLI-4001 - Farinha Especial 1kg" -> { codigo: "POLI-4001", descricao: "Farinha Especial 1kg" }
 * "Nescafé Tradicional (SKU-8821)" -> { codigo: "SKU-8821", descricao: "Nescafé Tradicional" }
 */
export function extrairCodigoEDescricaoProduto(produtoRaw: string): { codigo: string; descricao: string } {
  if (!produtoRaw) return { codigo: '-', descricao: 'Produto não informado' };
  const str = produtoRaw.trim();

  // Caso 1: Separador com hífen ("CODIGO - DESCRICAO")
  const splitHifen = str.split(/\s*-\s*/);
  if (splitHifen.length >= 2 && splitHifen[0].length <= 25) {
    return {
      codigo: splitHifen[0].trim(),
      descricao: splitHifen.slice(1).join(' - ').trim(),
    };
  }

  // Caso 2: Código entre parênteses ou colchetes
  const matchParenteses = str.match(/[\(\[](SKU-?[A-Z0-9]+|[A-Z0-9\-_]{4,15})[\)\]]/i);
  if (matchParenteses) {
    return {
      codigo: matchParenteses[1].trim(),
      descricao: str.replace(matchParenteses[0], '').trim(),
    };
  }

  return {
    codigo: '-',
    descricao: str,
  };
}
