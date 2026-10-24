import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { AlteracaoEndereco, RecebimentoProduto, ResumoNotaAlocacao } from '../types';
import {
  getLocalRecebimentosProdutos,
  saveLocalRecebimentosProdutos,
  getLocalAlteracoesEndereco,
  saveLocalAlteracoesEndereco,
  getLocalUsuarios,
  getLocalAgendamentos,
  getLocalFornecedores,
  getLocalProdutos,
} from './mockStorage';
import { usuariosService } from './usuariosService';
import { produtosService } from './produtosService';
import { normalizarNotaFiscal } from './recebimentoService';
import { isEnderecoSemLocacao, validarEnderecoDestino } from '../lib/enderecos';
import { podeConfirmarAlteracaoEndereco, UsuarioPermissaoParam } from '../utils/permissoes';
import { getActiveUserUnit, itemMatchesUserUnit } from './sessionHelper';
import { UNIDADE_PADRAO_SISTEMA, normalizarUnidadeNegocio } from '../constants/unidades';

// Campos explícitos (POLÍTICA: NUNCA SELECT *)
const CAMPOS_RECEBIMENTOS =
  'id, unidade_negocio, agendamento_id, data_recebimento, nota_fiscal, produto, endereco, quantidade, saldo_final, qtd_conferida, conferente_id, status, data_conferencia, repositor_id, data_alocacao, novo_endereco';
const CAMPOS_RECEBIMENTOS_FALLBACK =
  'id, agendamento_id, data_recebimento, nota_fiscal, produto, endereco, quantidade, saldo_final, qtd_conferida, conferente_id, status, data_conferencia, repositor_id, data_alocacao, novo_endereco';
const CAMPOS_ALTERACOES =
  'id, unidade_negocio, data, produto, endereco_antigo, endereco_novo, tipo_alteracao, usuario_alteracao, alterado_sistema, usuario_confirmacao, usuario_confirmacao_nome, data_confirmacao';
const CAMPOS_ALTERACOES_FALLBACK =
  'id, data, produto, endereco_antigo, endereco_novo, tipo_alteracao, usuario_alteracao, alterado_sistema';

/**
 * Ordenação do módulo Gerir Alterações:
 * Pendentes de alteração primeiro (alterado_sistema = false),
 * seguidos pelos já confirmados (alterado_sistema = true),
 * e dentro do mesmo status, pelas datas mais recentes primeiro.
 */
export const compararAlteracoesPorStatus = (a: AlteracaoEndereco, b: AlteracaoEndereco): number => {
  const prioridadeA = a.alterado_sistema ? 1 : 0; // 0 = Pendente, 1 = Concluído
  const prioridadeB = b.alterado_sistema ? 1 : 0;
  if (prioridadeA !== prioridadeB) {
    return prioridadeA - prioridadeB;
  }
  const tA = a.data ? new Date(a.data).getTime() : 0;
  const tB = b.data ? new Date(b.data).getTime() : 0;
  return tB - tA;
};

/**
 * Extrai o primeiro nome / marca principal do fabricante.
 * Ex: 'DONALDSON DO BRASIL' -> 'DONALDSON'
 *     'Nestlé Brasil' -> 'Nestlé'
 *     'M. Dias Branco' -> 'M. Dias'
 */
export function extrairPrimeiroNomeFabricante(nome?: string | null): string {
  if (!nome || !nome.trim()) return 'Geral';
  const limpo = nome.trim();
  if (limpo.toLowerCase().includes('não informado')) {
    return 'Geral';
  }
  const partes = limpo.split(/\s+/);
  if (partes.length === 0) return 'Geral';
  if (partes[0].endsWith('.') && partes.length > 1) {
    return `${partes[0]} ${partes[1]}`;
  }
  return partes[0];
}

/**
 * Ordenação mandatória dos produtos pendentes de alocação:
 * 1. Data mais recente para mais antiga (data_recebimento descendente)
 * 2. Número da nota fiscal (ascendente)
 * 3. Nome do produto de A a Z (alfabético ascendente)
 */
export function compararProdutosPendentesAlocacao(
  a: RecebimentoProduto,
  b: RecebimentoProduto
): number {
  // 1. Data mais recente para mais antiga
  const dataA = a.data_recebimento ? a.data_recebimento.slice(0, 10) : '';
  const dataB = b.data_recebimento ? b.data_recebimento.slice(0, 10) : '';
  if (dataA !== dataB) {
    return dataB.localeCompare(dataA);
  }

  // 2. Número da nota
  const nfA = (a.nota_fiscal || '').trim();
  const nfB = (b.nota_fiscal || '').trim();
  const nfComp = nfA.localeCompare(nfB, undefined, { numeric: true, sensitivity: 'base' });
  if (nfComp !== 0) {
    return nfComp;
  }

  // 3. E depois produto de A a Z
  const prodA = (a.produto || '').trim();
  const prodB = (b.produto || '').trim();
  return prodA.localeCompare(prodB, 'pt-BR', { sensitivity: 'base', numeric: true });
}

export interface FiltrosProdutosPendentesAlocacao {
  busca?: string;
  dataRecebimento?: string;
  notaFiscal?: string;
  unidadeNegocio?: string;
}

export interface FiltrosNotasAlocacao {
  dataRecebimento?: string;
  notaFiscal?: string;
  unidadeNegocio?: string;
}

export interface FiltrosAlteracoes {
  busca?: string;
  status?: 'todos' | 'pendente' | 'concluido';
  unidadeNegocio?: string;
}

export const alocacaoService = {
  /**
   * 0. Consulta todos os produtos pendentes de alocação (status 'Conferido' ou 'Validado' e saldo_final > 0).
   * Exibido como tela inicial do menu "Nota para alocação".
   * Ordenado por: Data mais recente > Número da Nota > Produto A-Z.
   */
  async listarProdutosPendentesAlocacao(
    filtros: FiltrosProdutosPendentesAlocacao = {}
  ): Promise<RecebimentoProduto[]> {
    const supabase = getSupabase();
    let produtos: RecebimentoProduto[] = [];
    const activeUnit = filtros.unidadeNegocio || getActiveUserUnit();

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('recebimentos_produtos')
          .select(CAMPOS_RECEBIMENTOS)
          .in('status', ['Conferido', 'Validado'])
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

        if (error && (error.message.includes('unidade_negocio') || error.code === '42703')) {
          let retryQuery = supabase
            .from('recebimentos_produtos')
            .select(CAMPOS_RECEBIMENTOS_FALLBACK)
            .in('status', ['Conferido', 'Validado'])
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
          produtos = getLocalRecebimentosProdutos();
        }
      } catch (e) {
        console.warn('Exceção ao consultar produtos pendentes no Supabase:', e);
        produtos = getLocalRecebimentosProdutos();
      }
    } else {
      produtos = getLocalRecebimentosProdutos();
    }

    // Filtra apenas produtos pendentes de alocação (Conferido / Validado com saldo pendente a alocar)
    produtos = produtos.filter(
      (p) =>
        (p.status === 'Conferido' || p.status === 'Validado') &&
        (p.saldo_final === undefined || Number(p.saldo_final) > 0)
    );

    if (activeUnit) {
      produtos = produtos.filter((p) => itemMatchesUserUnit(p.unidade_negocio, activeUnit));
    }

    if (filtros.dataRecebimento) {
      produtos = produtos.filter((p) => p.data_recebimento.startsWith(filtros.dataRecebimento!));
    }

    if (filtros.notaFiscal && filtros.notaFiscal.trim()) {
      const nfClean = filtros.notaFiscal.trim().toLowerCase();
      produtos = produtos.filter((p) => (p.nota_fiscal || '').toLowerCase().includes(nfClean));
    }

    // Mapeamento de fornecedores e fabricantes
    const mapaFornecedores = new Map<string, string>();
    const fornecedoresLocais = getLocalFornecedores();
    for (const f of fornecedoresLocais) {
      mapaFornecedores.set(f.id, f.nome_fantasia || f.razao_social);
    }

    // Mapeamento de catálogo de produtos para obter fabricante
    const mapaCatalogoFabricante = new Map<string, string>();
    const produtosCatalogoLocais = getLocalProdutos();
    for (const cp of produtosCatalogoLocais) {
      if (cp.fabricante) {
        mapaCatalogoFabricante.set(cp.produto.trim().toLowerCase(), cp.fabricante);
      }
    }

    // Busca agendamentos para enriquecer com o fornecedor / fabricante
    const agendamentoIds = Array.from(new Set(produtos.map((p) => p.agendamento_id).filter(Boolean)));
    const agendamentosLocais = getLocalAgendamentos();
    const mapaAgendamentoFornecedor = new Map<string, string>();

    for (const ag of agendamentosLocais) {
      const nomeReal =
        (ag.fornecedor_id && mapaFornecedores.get(ag.fornecedor_id)) ||
        ag.fornecedor ||
        '';
      if (nomeReal) {
        mapaAgendamentoFornecedor.set(String(ag.id), nomeReal);
        if (ag.nota_fiscal) {
          mapaAgendamentoFornecedor.set(normalizarNotaFiscal(ag.nota_fiscal), nomeReal);
        }
      }
    }

    if (isSupabaseConfigured && supabase && agendamentoIds.length > 0) {
      try {
        const { data: agData } = await supabase
          .from('agendamentos')
          .select('id, data, fornecedor, fornecedor_id, nota_fiscal')
          .in('id', agendamentoIds);

        if (agData) {
          for (const ag of agData) {
            const nomeReal =
              (ag.fornecedor_id && mapaFornecedores.get(ag.fornecedor_id)) ||
              ag.fornecedor ||
              '';
            if (nomeReal) {
              mapaAgendamentoFornecedor.set(String(ag.id), nomeReal);
              if (ag.nota_fiscal) {
                mapaAgendamentoFornecedor.set(normalizarNotaFiscal(ag.nota_fiscal), nomeReal);
              }
            }
          }
        }
      } catch (e) {
        console.warn('Erro ao mapear agendamentos para produtos pendentes:', e);
      }
    }

    // Enriquece os produtos com o fabricante e fornecedor
    const produtosEnriquecidos = produtos.map((p) => {
      const fabCatalogo = mapaCatalogoFabricante.get((p.produto || '').trim().toLowerCase());
      const fornAgendamento =
        mapaAgendamentoFornecedor.get(String(p.agendamento_id)) ||
        mapaAgendamentoFornecedor.get(normalizarNotaFiscal(p.nota_fiscal)) ||
        '';

      const fabricante = p.fabricante || fabCatalogo || fornAgendamento || 'Não informado';
      const fornecedor = p.fornecedor || fornAgendamento || 'Não informado';

      return {
        ...p,
        fabricante,
        fornecedor,
      };
    });

    // Filtro de busca textual geral (se informado)
    let resultado = produtosEnriquecidos;
    if (filtros.busca && filtros.busca.trim()) {
      const termo = filtros.busca.trim().toLowerCase();
      resultado = resultado.filter((p) => {
        const prod = (p.produto || '').toLowerCase();
        const nf = (p.nota_fiscal || '').toLowerCase();
        const end = (p.endereco || '').toLowerCase();
        const nEnd = (p.novo_endereco || '').toLowerCase();
        const fab = (p.fabricante || '').toLowerCase();
        const forn = (p.fornecedor || '').toLowerCase();
        return (
          prod.includes(termo) ||
          nf.includes(termo) ||
          end.includes(termo) ||
          nEnd.includes(termo) ||
          fab.includes(termo) ||
          forn.includes(termo)
        );
      });
    }

    // Aplica a ordenação mandatória:
    // 1. Data mais recente para mais antiga
    // 2. Número da nota
    // 3. E depois produto de A a Z
    return resultado.sort(compararProdutosPendentesAlocacao);
  },

  /**
   * 1. Consulta notas fiscais para alocação com base no filtro de Data ou Nota Fiscal.
   * REGRA CRÍTICA: Exibe no módulo Alocação APENAS os produtos com status = 'Conferido'.
   * Não exibe produtos com status 'Recebido', 'Crítica' ou 'Alocado'.
   */
  async listarNotasParaAlocacao(filtros: FiltrosNotasAlocacao = {}): Promise<ResumoNotaAlocacao[]> {
    const supabase = getSupabase();
    let produtos: RecebimentoProduto[] = [];
    const activeUnit = filtros.unidadeNegocio || getActiveUserUnit();

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('recebimentos_produtos')
          .select(CAMPOS_RECEBIMENTOS)
          .in('status', ['Conferido', 'Validado']) // Produtos liberados após conferência ou validação excepcional
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

        if (error && (error.message.includes('unidade_negocio') || error.code === '42703')) {
          let retryQuery = supabase
            .from('recebimentos_produtos')
            .select(CAMPOS_RECEBIMENTOS_FALLBACK)
            .in('status', ['Conferido', 'Validado'])
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

    // Aplica filtro de status ('Conferido' ou 'Validado') no array local
    produtos = produtos.filter((p) => p.status === 'Conferido' || p.status === 'Validado');

    if (activeUnit) {
      produtos = produtos.filter((p) => itemMatchesUserUnit(p.unidade_negocio, activeUnit));
    }

    // Aplica filtros em memória se veio do local
    if (filtros.dataRecebimento) {
      produtos = produtos.filter((p) => p.data_recebimento.startsWith(filtros.dataRecebimento!));
    }
    if (filtros.notaFiscal && filtros.notaFiscal.trim()) {
      const nfClean = filtros.notaFiscal.trim().toLowerCase();
      produtos = produtos.filter((p) => p.nota_fiscal.toLowerCase().includes(nfClean));
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

    // Agrupa por nota fiscal
    const agrupadoPorNota = new Map<string, RecebimentoProduto[]>();
    for (const p of produtos) {
      const chave = p.nota_fiscal;
      if (!agrupadoPorNota.has(chave)) {
        agrupadoPorNota.set(chave, []);
      }
      agrupadoPorNota.get(chave)!.push(p);
    }

    const resumos: ResumoNotaAlocacao[] = [];
    agrupadoPorNota.forEach((itens, nf) => {
      const primeiro = itens[0];
      const totalItens = itens.length;
      const totalQuantidade = itens.reduce((acc, curr) => acc + (Number(curr.quantidade) || 0), 0);
      const totalSaldoPendente = itens.reduce((acc, curr) => acc + (Number(curr.saldo_final) || 0), 0);

      let statusAlocacao: 'Pendente' | 'Parcial' | 'Concluído' = 'Pendente';
      if (totalSaldoPendente === 0) {
        statusAlocacao = 'Concluído';
      } else if (totalSaldoPendente < totalQuantidade) {
        statusAlocacao = 'Parcial';
      }

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
        total_saldo_pendente: totalSaldoPendente,
        status_alocacao: statusAlocacao,
      });
    });

    // Ordenar por data decrescente
    return resumos.sort((a, b) => b.data_recebimento.localeCompare(a.data_recebimento));
  },

  /**
   * 2. Lista os produtos vinculados a uma Nota Fiscal específica disponíveis para alocação (status = 'Conferido').
   */
  async listarProdutosDaNota(notaFiscal: string): Promise<RecebimentoProduto[]> {
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('recebimentos_produtos')
          .select(CAMPOS_RECEBIMENTOS)
          .eq('nota_fiscal', notaFiscal)
          .in('status', ['Conferido', 'Validado']) // Produtos liberados após conferência ou validação excepcional
          .order('produto', { ascending: true });

        if (!error && data) {
          return (data as RecebimentoProduto[]).sort((a, b) =>
            (a.produto || '').localeCompare(b.produto || '', 'pt-BR', { sensitivity: 'base' })
          );
        }
      } catch (e) {
        console.warn('Erro ao buscar produtos da nota no Supabase:', e);
      }
    }

    // Fallback local ordenado em ordem alfabética por produto
    const locais = getLocalRecebimentosProdutos();
    return locais
      .filter((p) => p.nota_fiscal === notaFiscal && (p.status === 'Conferido' || p.status === 'Validado'))
      .sort((a, b) => (a.produto || '').localeCompare(b.produto || '', 'pt-BR', { sensitivity: 'base' }));
  },

  /**
   * 3. Retorna um produto recebido pelo ID.
   */
  async obterProdutoPorId(id: string | number): Promise<RecebimentoProduto | null> {
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('recebimentos_produtos')
          .select(CAMPOS_RECEBIMENTOS)
          .eq('id', id)
          .single();

        if (!error && data) {
          return data as RecebimentoProduto;
        }
      } catch (e) {
        console.warn('Erro ao obter produto por id:', e);
      }
    }

    const locais = getLocalRecebimentosProdutos();
    return locais.find((p) => String(p.id) === String(id)) || null;
  },

  /**
   * 4. Cadastra os produtos recebidos de uma Nota Fiscal.
   * REGRA DE ACESSO: Permitido exclusivamente para nivel = 'gestor'.
   */
  async cadastrarProdutosRecebimento(params: {
    agendamento_id: string;
    nota_fiscal: string;
    data_recebimento: string;
    produtos: Array<{ produto: string; quantidade: number; endereco?: string | null }>;
    usuario_nivel?: string;
  }): Promise<RecebimentoProduto[]> {
    // Validação estrita de perfil Gestor (case-insensitive)
    const nivelNorm = (params.usuario_nivel || '').trim().toLowerCase();
    if (nivelNorm !== 'gestor' && nivelNorm !== 'administrador') {
      throw new Error('Acesso negado: Apenas usuários com nível "gestor" possuem permissão para cadastrar produtos recebidos.');
    }

    if (!params.produtos || params.produtos.length === 0) {
      throw new Error('Informe ao menos um produto recebido.');
    }

    const novosRegistros = params.produtos.map((p) => ({
      agendamento_id: params.agendamento_id,
      nota_fiscal: params.nota_fiscal,
      data_recebimento: params.data_recebimento,
      produto: p.produto.trim(),
      endereco: p.endereco?.trim() || null,
      quantidade: Number(p.quantidade) || 0,
      saldo_final: p.endereco?.trim() ? 0 : (Number(p.quantidade) || 0),
      status: 'Recebido' as const,
    }));

    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('recebimentos_produtos')
          .insert(novosRegistros)
          .select(CAMPOS_RECEBIMENTOS);

        if (!error && data) {
          return data as RecebimentoProduto[];
        }
        if (error) {
          console.warn('Erro ao inserir no Supabase recebimentos_produtos, gravando local:', error.message);
        }
      } catch (e) {
        console.warn('Exceção ao inserir no Supabase, usando local:', e);
      }
    }

    // Gravação local
    const locais = getLocalRecebimentosProdutos();
    const criados: RecebimentoProduto[] = novosRegistros.map((item, index) => ({
      ...item,
      id: `rec-${Date.now()}-${index}`,
      created_at: new Date().toISOString(),
    }));

    saveLocalRecebimentosProdutos([...locais, ...criados]);
    return criados;
  },

  /**
   * 5. Lista produtos recebidos vinculados a um agendamento.
   * Busca por agendamento_id e, complementarmente, por nota_fiscal para garantir
   * que produtos importados via Excel sejam sempre localizados em qualquer status
   * (Pendente, Recebido, Conferido, Crítica, Validado, Alocado).
   */
  async listarProdutosRecebidosPorAgendamento(
    agendamentoId: string,
    notaFiscal?: string | null
  ): Promise<RecebimentoProduto[]> {
    const supabase = getSupabase();
    const cleanNf = notaFiscal ? normalizarNotaFiscal(notaFiscal) : '';

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('recebimentos_produtos')
          .select(CAMPOS_RECEBIMENTOS);

        if (cleanNf && agendamentoId) {
          query = query.or(`agendamento_id.eq.${agendamentoId},nota_fiscal.ilike.%${notaFiscal?.trim()}%`);
        } else {
          query = query.eq('agendamento_id', agendamentoId);
        }

        const { data, error } = await query.order('id', { ascending: true });

        if (!error && data && data.length > 0) {
          return data as RecebimentoProduto[];
        }
        if (error) {
          console.warn('Erro ao listar produtos por agendamento no Supabase, tentando busca direta por agendamento_id:', error.message);
          // Fallback para query simples
          const retryRes = await supabase
            .from('recebimentos_produtos')
            .select(CAMPOS_RECEBIMENTOS)
            .eq('agendamento_id', agendamentoId)
            .order('id', { ascending: true });
          if (!retryRes.error && retryRes.data && retryRes.data.length > 0) {
            return retryRes.data as RecebimentoProduto[];
          }
        }
      } catch (e) {
        console.warn('Erro ao listar produtos por agendamento:', e);
      }
    }

    const locais = getLocalRecebimentosProdutos();
    const porId = locais.filter((p) => String(p.agendamento_id) === String(agendamentoId));
    if (porId.length > 0) return porId;

    if (cleanNf) {
      const porNf = locais.filter((p) => normalizarNotaFiscal(p.nota_fiscal) === cleanNf);
      if (porNf.length > 0) return porNf;
    }

    return porId;
  },

  /**
   * 6. Registra solicitação de alteração de endereço (public.alteracoes_endereco).
   * REGRA CRÍTICA:
   * - NÃO substitui o campo `endereco` original informado no recebimento.
   * - Salva o novo endereço em `novo_endereco`.
   * - Insere registro na tabela `alteracoes_endereco` com:
   *   produto, endereco_antigo, endereco_novo, tipo_alteracao = 'Via nota de entrada',
   *   usuario_alteracao, alterado_sistema = false.
   */
  async registrarAlteracaoEndereco(dados: {
    produtoId?: string | number;
    produto: string;
    enderecoAntigo: string;
    enderecoNovo: string;
    usuarioId: string;
    usuarioNome?: string;
    usuarioCodigo?: string;
    tipoAlteracao?: string;
    quantidadeAlocada?: number;
  }): Promise<AlteracaoEndereco> {
    if (!dados.enderecoNovo || !dados.enderecoNovo.trim()) {
      throw new Error('O novo endereço é obrigatório.');
    }

    const tipo = dados.tipoAlteracao || 'Avulsa';
    // Validação mandatória: Sem Locação (*S/L_GO) não pode ser endereço final
    const validacao = validarEnderecoDestino(
      dados.enderecoNovo,
      tipo === 'Recebimento NF' ? 'alocacao' : 'avulsa'
    );
    if (!validacao.valido) {
      throw new Error(validacao.erro || 'Endereço inválido.');
    }

    // REGRA MANDATÓRIA POLIHUB: SEMPRE gravar alterado_sistema = false,
    // independentemente do usuário operacional ou gestor possuir nível gestor.
    const alteradoSistema = false;
    const enderecoAntigoTratado = isEnderecoSemLocacao(dados.enderecoAntigo)
      ? 'Sem Locação'
      : dados.enderecoAntigo || 'Sem endereço';
    const activeUnit = getActiveUserUnit() || 'Goiânia';
    const agoraIso = new Date().toISOString();

    const novaAlteracao = {
      unidade_negocio: activeUnit,
      data: agoraIso,
      created_at: agoraIso,
      produto: dados.produto,
      endereco_antigo: enderecoAntigoTratado,
      endereco_novo: dados.enderecoNovo.trim(),
      tipo_alteracao: tipo,
      usuario_alteracao: dados.usuarioId,
      alterado_sistema: alteradoSistema,
    };

    const supabase = getSupabase();
    let gravada: AlteracaoEndereco | null = null;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('alteracoes_endereco')
          .insert([novaAlteracao])
          .select(CAMPOS_ALTERACOES)
          .single();

        if (error && (error.message.includes('unidade_negocio') || error.code === '42703')) {
          const { unidade_negocio, ...fallbackPayload } = novaAlteracao;
          const { data: retryData, error: retryErr } = await supabase
            .from('alteracoes_endereco')
            .insert([fallbackPayload])
            .select(CAMPOS_ALTERACOES_FALLBACK)
            .single();
          if (!retryErr && retryData) {
            gravada = { ...retryData, unidade_negocio: activeUnit } as AlteracaoEndereco;
          }
        } else if (!error && data) {
          gravada = data as AlteracaoEndereco;
        } else if (error) {
          console.warn('Erro ao gravar alteracao no Supabase:', error.message);
        }

        // Atualiza novo_endereco na tabela recebimentos_produtos mantendo endereco original intacto
        if (dados.produtoId) {
          const { error: updErr } = await supabase
            .from('recebimentos_produtos')
            .update({
              novo_endereco: dados.enderecoNovo.trim(),
            })
            .eq('id', dados.produtoId);

          if (updErr) {
            console.warn('Erro ao atualizar novo_endereco no recebimento no Supabase:', updErr.message);
          }
        }
      } catch (e) {
        console.warn('Exceção ao gravar no Supabase:', e);
      }
    }

    // Fallback / sincronização local garantindo todos os campos para Auditoria
    const locais = getLocalAlteracoesEndereco();
    const itemLocal: AlteracaoEndereco = {
      id: gravada?.id || `alt-${Date.now()}`,
      unidade_negocio: gravada?.unidade_negocio || activeUnit,
      data: gravada?.data || agoraIso,
      created_at: gravada?.created_at || agoraIso,
      produto: dados.produto,
      endereco_antigo: enderecoAntigoTratado,
      endereco_novo: dados.enderecoNovo.trim(),
      tipo_alteracao: tipo,
      usuario_alteracao: dados.usuarioId,
      usuario_nome: dados.usuarioNome,
      usuario_codigo: dados.usuarioCodigo,
      alterado_sistema: alteradoSistema,
    };

    saveLocalAlteracoesEndereco([itemLocal, ...locais.filter((l) => l.id !== itemLocal.id)]);

    // Atualiza produto recebido local (preserva endereco, grava novo_endereco)
    if (dados.produtoId) {
      const produtosLocais = getLocalRecebimentosProdutos();
      const atualizados = produtosLocais.map((p) => {
        if (String(p.id) === String(dados.produtoId)) {
          return {
            ...p,
            novo_endereco: dados.enderecoNovo.trim(),
          };
        }
        return p;
      });
      saveLocalRecebimentosProdutos(atualizados);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('polihub_badges_refresh'));
    }

    return itemLocal;
  },

  /**
   * 6a. Confirmação de alocação no MESMO endereço (prefixos compatíveis):
   * - Salva repositor_id, data_alocacao, status = 'Alocado', saldo_final = 0
   * - Endereço original é preservado
   * - NÃO cria registro em alteracoes_endereco
   */
  async confirmarAlocacaoMesmoEndereco(params: {
    produtoId: string | number;
    repositorId: string;
    repositorNome?: string;
  }): Promise<RecebimentoProduto> {
    const { produtoId, repositorId, repositorNome } = params;

    // Regra Obrigatória POLIHUB: Um produto que está como Sem Locação (*S/L_GO)
    // NÃO pode ter sua alocação confirmada mantendo Sem Locação. O usuário deve informar endereço válido.
    const produtoAtual = await alocacaoService.obterProdutoPorId(produtoId);
    if (produtoAtual && isEnderecoSemLocacao(produtoAtual.endereco)) {
      throw new Error(
        'Informe um endereço válido para realizar a alocação. O produto está atualmente como Sem Locação.'
      );
    }

    const dataAlocacao = new Date().toISOString();
    const supabase = getSupabase();
    let produtoAtualizado: RecebimentoProduto | null = null;

    if (isSupabaseConfigured && supabase) {
      try {
        const payload = {
          repositor_id: repositorId,
          data_alocacao: dataAlocacao,
          status: 'Alocado',
          saldo_final: 0,
        };

        const { data, error } = await supabase
          .from('recebimentos_produtos')
          .update(payload)
          .eq('id', produtoId)
          .select(CAMPOS_RECEBIMENTOS)
          .single();

        if (!error && data) {
          produtoAtualizado = data as RecebimentoProduto;
        } else if (error) {
          console.warn('Erro ao confirmar alocação mesmo endereço no Supabase:', error.message);
        }
      } catch (e) {
        console.warn('Exceção ao confirmar alocação mesmo endereço:', e);
      }
    }

    const produtosLocais = getLocalRecebimentosProdutos();
    const atualizados = produtosLocais.map((p) => {
      if (String(p.id) === String(produtoId)) {
        const item: RecebimentoProduto = {
          ...p,
          repositor_id: repositorId,
          repositor_nome: repositorNome || p.repositor_nome,
          data_alocacao: dataAlocacao,
          status: 'Alocado',
          saldo_final: 0,
        };
        produtoAtualizado = item;
        return item;
      }
      return p;
    });
    saveLocalRecebimentosProdutos(atualizados);

    if (!produtoAtualizado) {
      throw new Error('Produto para alocação não encontrado.');
    }

    return produtoAtualizado;
  },

  /**
   * 6b. Confirmação de alteração de endereço (prefixos divergentes):
   * - Atualiza recebimentos_produtos com novo_endereco, repositor_id, data_alocacao, status = 'Alocado', saldo_final = 0
   * - Preserva endereco original
   * - Insere em alteracoes_endereco com tipo_alteracao = 'Recebimento NF' e alterado_sistema = true
   */
  async confirmarAlocacaoComAlteracaoEndereco(params: {
    produtoId: string | number;
    produto: string;
    enderecoOriginal: string;
    novoEndereco: string;
    repositorId: string;
    repositorNome?: string;
    usuarioCodigo?: string;
  }): Promise<{ produto: RecebimentoProduto; alteracao: AlteracaoEndereco }> {
    const {
      produtoId,
      produto,
      enderecoOriginal,
      novoEndereco,
      repositorId,
      repositorNome,
      usuarioCodigo,
    } = params;

    const dataAlocacao = new Date().toISOString();
    const novoEnderecoLimpo = novoEndereco.trim();

    // Validação mandatória: Sem Locação (*S/L_GO) não pode ser endereço final
    const validacao = validarEnderecoDestino(novoEnderecoLimpo, 'alocacao');
    if (!validacao.valido) {
      throw new Error(validacao.erro || 'Informe um endereço válido para realizar a alocação.');
    }

    const enderecoAntigoLimpo = isEnderecoSemLocacao(enderecoOriginal)
      ? 'Sem Locação'
      : enderecoOriginal?.trim() || 'Sem endereço';
    const supabase = getSupabase();

    let produtoAtualizado: RecebimentoProduto | null = null;
    let alteracaoGravada: AlteracaoEndereco | null = null;

    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Atualizar recebimentos_produtos mantendo endereco original
        const { data: dataProd, error: errorProd } = await supabase
          .from('recebimentos_produtos')
          .update({
            novo_endereco: novoEnderecoLimpo,
            repositor_id: repositorId,
            data_alocacao: dataAlocacao,
            status: 'Alocado',
            saldo_final: 0,
          })
          .eq('id', produtoId)
          .select(CAMPOS_RECEBIMENTOS)
          .single();

        if (!errorProd && dataProd) {
          produtoAtualizado = dataProd as RecebimentoProduto;
        } else if (errorProd) {
          console.warn('Erro ao atualizar recebimento com novo_endereco:', errorProd.message);
        }

        // 2. Registrar em alteracoes_endereco com tipo_alteracao = 'Recebimento NF'
        // REGRA MANDATÓRIA POLIHUB: SEMPRE gravar alterado_sistema = false,
        // independentemente do usuário operacional ou gestor.
        const activeUnitAloc = getActiveUserUnit() || 'Goiânia';
        const novaAlt = {
          unidade_negocio: activeUnitAloc,
          data: dataAlocacao,
          created_at: dataAlocacao,
          produto,
          endereco_antigo: enderecoAntigoLimpo,
          endereco_novo: novoEnderecoLimpo,
          tipo_alteracao: 'Recebimento NF',
          usuario_alteracao: repositorId,
          alterado_sistema: false,
        };

        const { data: dataAlt, error: errorAlt } = await supabase
          .from('alteracoes_endereco')
          .insert([novaAlt])
          .select(CAMPOS_ALTERACOES)
          .single();

        if (errorAlt && (errorAlt.message.includes('unidade_negocio') || errorAlt.code === '42703')) {
          const { unidade_negocio, ...fallbackPayload } = novaAlt;
          const { data: retryAlt, error: retryAltErr } = await supabase
            .from('alteracoes_endereco')
            .insert([fallbackPayload])
            .select(CAMPOS_ALTERACOES_FALLBACK)
            .single();
          if (!retryAltErr && retryAlt) {
            alteracaoGravada = { ...retryAlt, unidade_negocio: activeUnitAloc } as AlteracaoEndereco;
          }
        } else if (!errorAlt && dataAlt) {
          alteracaoGravada = dataAlt as AlteracaoEndereco;
        } else if (errorAlt) {
          console.warn('Erro ao registrar histórico de alteração no Supabase:', errorAlt.message);
        }
      } catch (e) {
        console.warn('Exceção ao gravar alteração de endereço no Supabase:', e);
      }
    }

    // Sincronização local em memória
    const produtosLocais = getLocalRecebimentosProdutos();
    const atualizados = produtosLocais.map((p) => {
      if (String(p.id) === String(produtoId)) {
        const item: RecebimentoProduto = {
          ...p,
          novo_endereco: novoEnderecoLimpo,
          repositor_id: repositorId,
          repositor_nome: repositorNome || p.repositor_nome,
          data_alocacao: dataAlocacao,
          status: 'Alocado',
          saldo_final: 0,
        };
        produtoAtualizado = item;
        return item;
      }
      return p;
    });
    saveLocalRecebimentosProdutos(atualizados);

    const activeUnitAlocLocal = getActiveUserUnit() || 'Goiânia';
    const itemAlt: AlteracaoEndereco = alteracaoGravada || {
      id: `alt-${Date.now()}`,
      unidade_negocio: activeUnitAlocLocal,
      data: dataAlocacao,
      produto,
      endereco_antigo: enderecoAntigoLimpo,
      endereco_novo: novoEnderecoLimpo,
      tipo_alteracao: 'Recebimento NF',
      usuario_alteracao: repositorId,
      usuario_nome: repositorNome,
      usuario_codigo: usuarioCodigo,
      alterado_sistema: false,
      created_at: dataAlocacao,
    };

    const locaisAlt = getLocalAlteracoesEndereco();
    saveLocalAlteracoesEndereco([itemAlt, ...locaisAlt]);

    if (!produtoAtualizado) {
      throw new Error('Produto para alocação não encontrado.');
    }

    return { produto: produtoAtualizado, alteracao: itemAlt };
  },

  /**
   * 6c. Conclui a alocação física do produto no endereço.
   * REGRA CRÍTICA:
   * - Registra repositor_id, data_alocacao, novo_endereco (se alterado)
   * - status = 'Alocado'
   * - saldo_final = 0
   */
  async concluirAlocacaoProduto(params: {
    produtoId: string | number;
    enderecoFinal?: string;
    repositorId: string;
    repositorNome?: string;
  }): Promise<RecebimentoProduto> {
    const { produtoId, enderecoFinal, repositorId } = params;
    const dataAlocacao = new Date().toISOString();
    const supabase = getSupabase();

    let produtoAtualizado: RecebimentoProduto | null = null;

    if (isSupabaseConfigured && supabase) {
      try {
        const payload: Record<string, any> = {
          status: 'Alocado',
          saldo_final: 0,
          repositor_id: repositorId,
          data_alocacao: dataAlocacao,
        };
        if (enderecoFinal && enderecoFinal.trim()) {
          payload.novo_endereco = enderecoFinal.trim();
        }

        const { data, error } = await supabase
          .from('recebimentos_produtos')
          .update(payload)
          .eq('id', produtoId)
          .select(CAMPOS_RECEBIMENTOS)
          .single();

        if (!error && data) {
          produtoAtualizado = data as RecebimentoProduto;
        }
      } catch (e) {
        console.warn('Erro ao concluir alocação no Supabase:', e);
      }
    }

    const produtosLocais = getLocalRecebimentosProdutos();
    const atualizados = produtosLocais.map((p) => {
      if (String(p.id) === String(produtoId)) {
        const item: RecebimentoProduto = {
          ...p,
          status: 'Alocado',
          saldo_final: 0,
          repositor_id: repositorId,
          repositor_nome: params.repositorNome || p.repositor_nome,
          data_alocacao: dataAlocacao,
          novo_endereco: enderecoFinal?.trim() || p.novo_endereco || null,
        };
        produtoAtualizado = item;
        return item;
      }
      return p;
    });

    saveLocalRecebimentosProdutos(atualizados);

    if (!produtoAtualizado) {
      throw new Error('Produto para alocação não encontrado.');
    }

    return produtoAtualizado;
  },

  /**
   * 7. Lista as alterações de endereço (public.alteracoes_endereco) para a tela "Gerir Alterações".
   */
  async listarAlteracoesEndereco(filtros: FiltrosAlteracoes = {}): Promise<AlteracaoEndereco[]> {
    const supabase = getSupabase();
    const activeUnit = filtros.unidadeNegocio || getActiveUserUnit();

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('alteracoes_endereco')
          .select(CAMPOS_ALTERACOES)
          .order('data', { ascending: false });

        if (activeUnit) {
          query = query.eq('unidade_negocio', activeUnit);
        }

        if (filtros.status === 'pendente') {
          query = query.eq('alterado_sistema', false);
        } else if (filtros.status === 'concluido') {
          query = query.eq('alterado_sistema', true);
        }

        if (filtros.busca && filtros.busca.trim()) {
          const termo = filtros.busca.trim();
          query = query.or(`produto.ilike.%${termo}%,endereco_novo.ilike.%${termo}%,endereco_antigo.ilike.%${termo}%`);
        }

        let { data, error }: { data: any; error: any } = await query;

        if (error && (error.message.includes('unidade_negocio') || error.code === '42703')) {
          let retryQuery = supabase
            .from('alteracoes_endereco')
            .select(CAMPOS_ALTERACOES_FALLBACK)
            .order('data', { ascending: false });

          if (filtros.status === 'pendente') {
            retryQuery = retryQuery.eq('alterado_sistema', false);
          } else if (filtros.status === 'concluido') {
            retryQuery = retryQuery.eq('alterado_sistema', true);
          }

          if (filtros.busca && filtros.busca.trim()) {
            const termo = filtros.busca.trim();
            retryQuery = retryQuery.or(`produto.ilike.%${termo}%,endereco_novo.ilike.%${termo}%,endereco_antigo.ilike.%${termo}%`);
          }

          const retryRes = await retryQuery;
          data = retryRes.data;
          error = retryRes.error;
        }

        if (!error && data) {
          let items = data as AlteracaoEndereco[];
          if (activeUnit) {
            items = items.filter((alt) => itemMatchesUserUnit(alt.unidade_negocio, activeUnit));
          }

          // Preenche os nomes de usuários sem exibir chave ID bruta
          let usuarios = getLocalUsuarios();
          try {
            const todos = await usuariosService.listarTodos();
            if (todos && todos.length > 0) {
              usuarios = todos;
            }
          } catch {
            usuarios = getLocalUsuarios();
          }

          const formatados = items.map((alt) => {
            const usr = usuarios.find(
              (u) =>
                u.id === alt.usuario_alteracao ||
                u.codigo?.toUpperCase() === alt.usuario_alteracao?.toUpperCase()
            );

            let nome = usr?.nome;
            if (!nome && alt.usuario_alteracao) {
              if (alt.usuario_alteracao === 'OP-1042' || alt.usuario_alteracao === 'usr-default-01') {
                nome = 'Luiz Fernando';
              } else if (alt.usuario_alteracao === 'GS-2005' || alt.usuario_alteracao === 'usr-default-02') {
                nome = 'Mariana Silva (Gestora)';
              } else if (
                alt.usuario_nome &&
                alt.usuario_nome !== alt.usuario_alteracao &&
                !alt.usuario_nome.startsWith('usr-')
              ) {
                nome = alt.usuario_nome;
              } else {
                nome = 'Operador Responsável';
              }
            }

            // Resolução do usuário de confirmação
            let nomeConfirmador = alt.usuario_confirmacao_nome;
            if (!nomeConfirmador && alt.usuario_confirmacao) {
              const usrConf = usuarios.find(
                (u) =>
                  u.id === alt.usuario_confirmacao ||
                  u.codigo?.toUpperCase() === alt.usuario_confirmacao?.toUpperCase()
              );
              if (usrConf) {
                nomeConfirmador = usrConf.nome;
              }
            }

            return {
              ...alt,
              usuario_nome: nome || 'Operador Responsável',
              usuario_codigo:
                usr?.codigo ||
                (alt.usuario_alteracao?.startsWith('OP-') || alt.usuario_alteracao?.startsWith('GS-')
                  ? alt.usuario_alteracao
                  : undefined),
              usuario_confirmacao_nome: nomeConfirmador || alt.usuario_confirmacao_nome || undefined,
            };
          });

          // Ordenação estrita: pendentes de alteração primeiro, depois confirmados
          return formatados.sort(compararAlteracoesPorStatus);
        }
      } catch (e) {
        console.warn('Erro ao consultar alteracoes_endereco no Supabase:', e);
      }
    }

    // Fallback local
    let locais = getLocalAlteracoesEndereco();
    if (activeUnit) {
      locais = locais.filter((a) => itemMatchesUserUnit(a.unidade_negocio, activeUnit));
    }
    if (filtros.status === 'pendente') {
      locais = locais.filter((a) => !a.alterado_sistema);
    } else if (filtros.status === 'concluido') {
      locais = locais.filter((a) => a.alterado_sistema);
    }

    if (filtros.busca && filtros.busca.trim()) {
      const termo = filtros.busca.trim().toLowerCase();
      locais = locais.filter(
        (a) =>
          a.produto.toLowerCase().includes(termo) ||
          a.endereco_novo.toLowerCase().includes(termo) ||
          a.endereco_antigo.toLowerCase().includes(termo)
      );
    }

    let usuariosLocais = getLocalUsuarios();
    try {
      const todos = await usuariosService.listarTodos();
      if (todos && todos.length > 0) {
        usuariosLocais = todos;
      }
    } catch {
      usuariosLocais = getLocalUsuarios();
    }

    const formatadosLocais = locais.map((alt) => {
      const usr = usuariosLocais.find(
        (u) =>
          u.id === alt.usuario_alteracao ||
          u.codigo?.toUpperCase() === alt.usuario_alteracao?.toUpperCase()
      );

      let nome = usr?.nome;
      if (!nome && alt.usuario_alteracao) {
        if (alt.usuario_alteracao === 'OP-1042' || alt.usuario_alteracao === 'usr-default-01') {
          nome = 'Luiz Fernando';
        } else if (alt.usuario_alteracao === 'GS-2005' || alt.usuario_alteracao === 'usr-default-02') {
          nome = 'Mariana Silva (Gestora)';
        } else if (
          alt.usuario_nome &&
          alt.usuario_nome !== alt.usuario_alteracao &&
          !alt.usuario_nome.startsWith('usr-')
        ) {
          nome = alt.usuario_nome;
        } else {
          nome = 'Operador Responsável';
        }
      }

      let nomeConfirmador = alt.usuario_confirmacao_nome;
      if (!nomeConfirmador && alt.usuario_confirmacao) {
        const usrConf = usuariosLocais.find(
          (u) =>
            u.id === alt.usuario_confirmacao ||
            u.codigo?.toUpperCase() === alt.usuario_confirmacao?.toUpperCase()
        );
        if (usrConf) {
          nomeConfirmador = usrConf.nome;
        }
      }

      return {
        ...alt,
        usuario_nome: nome || 'Operador Responsável',
        usuario_codigo:
          usr?.codigo ||
          alt.usuario_codigo ||
          (alt.usuario_alteracao?.startsWith('OP-') || alt.usuario_alteracao?.startsWith('GS-')
            ? alt.usuario_alteracao
            : undefined),
        usuario_confirmacao_nome: nomeConfirmador || alt.usuario_confirmacao_nome || undefined,
      };
    });

    // Ordenação estrita: pendentes de alteração primeiro, depois confirmados
    return formatadosLocais.sort(compararAlteracoesPorStatus);
  },

  /**
   * 8. Confirma a alteração no sistema (public.alteracoes_endereco).
   * Define alterado_sistema = true.
   * REGRA DE ACESSO:
   * Podem confirmar:
   * - usuário com nivel = "gestor"
   * OU
   * - usuário com funcao = "Assistente Logistico"
   */
  async confirmarAlteracaoSistema(
    alteracaoId: string,
    usuario?: { id?: string; nivel?: string; funcao?: string; nome?: string } | string | null
  ): Promise<AlteracaoEndereco> {
    const usuarioParam: UsuarioPermissaoParam =
      typeof usuario === 'string'
        ? { nivel: usuario }
        : usuario || {};

    // 1. Validação estrita de autorização
    if (!podeConfirmarAlteracaoEndereco(usuarioParam)) {
      throw new Error(
        'Acesso negado: Somente usuários com nível "gestor" ou função "Assistente Logístico" possuem permissão para confirmar a alteração no sistema.'
      );
    }

    let resultadoFinal: AlteracaoEndereco | null = null;
    const dataConfirmacao = new Date().toISOString();
    const nomeConfirmador =
      (typeof usuario === 'object' ? usuario?.nome : undefined) ||
      (usuarioParam.nivel === 'gestor' || usuarioParam.nivel === 'administrador' ? 'Gestor' : 'Assistente Logístico');

    // 2. Chamada à API no backend (Node.js)
    try {
      const resp = await fetch('/api/alocacao/confirmar-alteracao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alteracaoId,
          usuarioId: typeof usuario === 'object' ? usuario?.id : undefined,
          usuarioNivel: usuarioParam.nivel,
          usuarioFuncao: usuarioParam.funcao,
          usuarioNome: nomeConfirmador,
        }),
      });

      if (!resp.ok) {
        const erroJson = await resp.json().catch(() => ({}));
        if (resp.status === 403) {
          throw new Error(
            erroJson?.error || 'Acesso negado: Somente usuários com nível "gestor" ou função "Assistente Logístico" possuem permissão para confirmar a alteração no sistema.'
          );
        }
      } else {
        const resJson = await resp.json();
        if (resJson?.data) {
          resultadoFinal = resJson.data as AlteracaoEndereco;
        }
      }
    } catch (apiErr: any) {
      if (
        apiErr?.message?.includes('Acesso negado') ||
        apiErr?.message?.includes('não autorizada') ||
        apiErr?.message?.includes('403')
      ) {
        throw apiErr;
      }
      console.warn('[AlocacaoService] Falha na rota /api/alocacao/confirmar-alteracao, prosseguindo com persistência direta:', apiErr);
    }

    // 3. Atualização direta no Supabase como garantia
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const auditPayload: Record<string, any> = {
          alterado_sistema: true,
          data_confirmacao: dataConfirmacao,
          usuario_confirmacao_nome: nomeConfirmador,
        };
        if (typeof usuario === 'object' && usuario?.id && UUID_REGEX.test(usuario.id)) {
          auditPayload.usuario_confirmacao = usuario.id;
        }

        let { data, error } = await supabase
          .from('alteracoes_endereco')
          .update(auditPayload)
          .eq('id', alteracaoId)
          .select(CAMPOS_ALTERACOES);

        if (error || !data || data.length === 0) {
          const retryRes = await supabase
            .from('alteracoes_endereco')
            .update({ alterado_sistema: true })
            .eq('id', alteracaoId)
            .select(CAMPOS_ALTERACOES_FALLBACK);

          if (!retryRes.error && retryRes.data && retryRes.data.length > 0) {
            resultadoFinal = retryRes.data[0] as AlteracaoEndereco;
          }
        } else {
          resultadoFinal = data[0] as AlteracaoEndereco;
        }
      } catch (e) {
        console.warn('Aviso ao sincronizar alteracoes_endereco no Supabase:', e);
      }
    }

    // 4. ATUALIZAÇÃO MANDATÓRIA LOCAL (Garante que a UI e cache reflitam status Concluído na hora)
    const locais = getLocalAlteracoesEndereco();
    let alteradoLocal: AlteracaoEndereco | null = null;

    const novosLocais = locais.map((item) => {
      if (String(item.id) === String(alteracaoId)) {
        alteradoLocal = {
          ...item,
          alterado_sistema: true,
          data_confirmacao: dataConfirmacao,
          usuario_confirmacao_nome: nomeConfirmador,
          usuario_confirmacao: typeof usuario === 'object' ? usuario?.id : undefined,
        };
        return alteradoLocal;
      }
      return item;
    });

    novosLocais.sort(compararAlteracoesPorStatus);
    saveLocalAlteracoesEndereco(novosLocais);

    // 5. Sincroniza o catálogo de produtos com o novo endereço
    const itemFinal = resultadoFinal || alteradoLocal;
    if (itemFinal?.produto && itemFinal?.endereco_novo) {
      try {
        await produtosService.atualizarEnderecoPorNome(itemFinal.produto, itemFinal.endereco_novo);
      } catch (errSync) {
        console.warn('Aviso ao sincronizar endereço na tabela produtos:', errSync);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('polihub_badges_refresh'));
      window.dispatchEvent(new CustomEvent('polihub_alteracoes_refresh'));
    }

    return (
      resultadoFinal ||
      alteradoLocal || {
        id: alteracaoId,
        alterado_sistema: true,
        data: dataConfirmacao,
        produto: '',
        endereco_antigo: '',
        endereco_novo: '',
        tipo_alteracao: 'Outros',
        usuario_alteracao: typeof usuario === 'object' ? usuario?.id || '' : '',
      }
    );
  },

  /**
   * 9. Busca produtos para alteração direta (Filtro 3 — "Alterar Local").
   * Exibe a lista de produtos da nova tabela de produtos (public.produtos).
   */
  async buscarProdutosParaAlteracaoDireta(termo?: string): Promise<
    Array<{
      produto: string;
      endereco_atual: string;
      origem: string;
      fabricante?: string;
      id_referencia?: string | number;
    }>
  > {
    try {
      const listaProdutos = await produtosService.list(termo);
      return listaProdutos.map((p) => ({
        produto: p.produto,
        endereco_atual: p.endereco?.trim() || 'Sem endereço cadastrado',
        origem: p.fabricante ? `Fabricante: ${p.fabricante}` : 'Catálogo de Produtos',
        fabricante: p.fabricante || undefined,
        id_referencia: p.id,
      }));
    } catch (e) {
      console.warn('Erro ao buscar produtos para alteração direta na tabela de produtos:', e);
      return [];
    }
  },
};
