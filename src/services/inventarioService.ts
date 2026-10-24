import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import {
  DetalheContagem,
  FiltrosListagemContagem,
  ItemListagemContagem,
  ItemParaContagem,
  InventarioStatus,
  HistoricoAlteracaoEndereco,
  PaginatedResult,
  PreviaEnderecoContagem,
  RegistroEndereco,
  ResultadoComparacaoContagem,
} from '../types';

export interface MetricasGraficosInventario {
  totalItens: number;
  itensContados: number;
  itensPendentes: number;
  itensSemDivergencia: number;
  acuracidade: number;
  totalFaltas: number;
  totalSobressalentes: number;
  contagensDisponiveis: string[];
  statusCount: {
    pendente: number;
    contada: number;
    revisar: number;
    revisada: number;
    validada: number;
    bloqueada: number;
    invalidada: number;
  };
  topDivergencias: Array<{
    produto: string;
    endereco: string;
    qtd_disponivel: number;
    qtd_contada: number;
    diferenca: number;
    status: InventarioStatus;
  }>;
}

export interface AuditoriaProdutoInventario {
  dataUltimoRecebimento: string | null;
  dataUltimaAlteracaoEndereco: string | null;
  historicoAlteracoes: HistoricoAlteracaoEndereco[];
}
import {
  getLocalTabelaEnderecos,
  getLocalTabelaInventario,
  getLocalUsuarios,
  saveLocalTabelaInventario,
} from './mockStorage';
import { usuariosService } from './usuariosService';
import { getActiveUserUnit, itemMatchesUserUnit, getUnitEquivalents } from './sessionHelper';

// Colunas mínimas para carregar itens para contagem (SEM qtd_disponivel, garantindo conferência cega)
const CAMPOS_CONTAGEM_SEGURA = 'id, produto, endereco';

// Colunas estritas para listagem do gestor (evita SELECT *)
const CAMPOS_LISTAGEM_GESTOR =
  'id, unidade_negocio, produto, endereco, qtd_contada, qtd_disponivel, qtd_atual, peso_total, qtd_reservada, corrigido, data_contagem, status, contagem, usuario_id, usuario_revisao_id, data_revisao, quantidade_revisao, observacao, alteracoes_endereco';
const CAMPOS_LISTAGEM_GESTOR_FALLBACK =
  'id, produto, endereco, qtd_contada, qtd_disponivel, qtd_atual, peso_total, qtd_reservada, corrigido, data_contagem';

const CAMPOS_DETALHE_GESTOR =
  'id, unidade_negocio, produto, endereco, qtd_contada, qtd_disponivel, qtd_atual, peso_total, qtd_reservada, usuario_id, data_contagem, usuario_correcao, corrigido, data_correcao, data_atualizada, status, contagem, usuario_revisao_id, data_revisao, quantidade_revisao, observacao, alteracoes_endereco';
const CAMPOS_DETALHE_GESTOR_FALLBACK =
  'id, produto, endereco, qtd_contada, qtd_disponivel, qtd_atual, peso_total, qtd_reservada, usuario_id, data_contagem, usuario_correcao, corrigido, data_correcao, data_atualizada';

function getPriorityRank(item: {
  qtd_contada?: number | null;
  qtd_disponivel: number;
  corrigido: boolean;
}): number {
  if (item.qtd_contada === null || item.qtd_contada === undefined) {
    return 4; // Não contado fisicamente
  }
  const temDivergencia = Number(item.qtd_contada) !== Number(item.qtd_disponivel);
  if (temDivergencia && !item.corrigido) {
    return 1; // 1. Divergências pendentes de correção
  }
  if (temDivergencia && item.corrigido) {
    return 2; // 2. Divergências já corrigidas
  }
  return 3; // 3. Contagens sem divergência
}

export interface EnderecoContagemInfo extends RegistroEndereco {
  totalProdutos: number;
  totalContados: number;
  incompleto: boolean;
}

export const inventarioService = {
  /**
   * Lista todos os endereços ativos para o usuário selecionar via autocomplete/lista
   */
  async listarEnderecos(targetUnit?: string): Promise<RegistroEndereco[]> {
    const activeUnit = targetUnit || getActiveUserUnit();
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('enderecos')
          .select('id, unidade_negocio, endereco, descricao, ativo')
          .eq('ativo', true)
          .order('endereco', { ascending: true });

        if (activeUnit) {
          query = query.in('unidade_negocio', getUnitEquivalents(activeUnit));
        }

        let { data, error }: { data: any; error: any } = await query;

        if (error && (error.message.includes('unidade_negocio') || error.code === '42703')) {
          const fallbackRes = await supabase
            .from('enderecos')
            .select('id, endereco, descricao, ativo')
            .eq('ativo', true)
            .order('endereco', { ascending: true });
          data = fallbackRes.data;
          error = fallbackRes.error;
        }

        if (!error && data && data.length > 0) {
          let rows = data as RegistroEndereco[];
          if (activeUnit) {
            rows = rows.filter((r) => itemMatchesUserUnit(r.unidade_negocio, activeUnit));
          }
          return rows;
        }
      } catch (err) {
        console.warn('Falha ao buscar endereços no Supabase, usando local:', err);
      }
    }

    let locais = getLocalTabelaEnderecos();
    if (activeUnit) {
      locais = locais.filter((e) => itemMatchesUserUnit(e.unidade_negocio, activeUnit));
    }
    return locais;
  },

  /**
   * Lista todas as contagens distintas disponíveis na tabela inventario
   */
  async listarContagensDisponiveis(targetUnit?: string): Promise<string[]> {
    const activeUnit = targetUnit || getActiveUserUnit();
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('inventario')
          .select('contagem, unidade_negocio')
          .not('contagem', 'is', null);

        if (activeUnit) {
          query = query.in('unidade_negocio', getUnitEquivalents(activeUnit));
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          const contagensSet = new Set<string>();
          for (const item of data) {
            const c = item.contagem?.toString().trim();
            if (c) contagensSet.add(c);
          }
          return Array.from(contagensSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        }
      } catch (err) {
        console.warn('Falha ao listar contagens no Supabase, usando local:', err);
      }
    }

    // Fallback Local
    const locais = getLocalTabelaInventario();
    const contagensSet = new Set<string>();
    for (const item of locais) {
      if (activeUnit && !itemMatchesUserUnit(item.unidade_negocio, activeUnit)) continue;
      const c = item.contagem?.toString().trim();
      if (c) contagensSet.add(c);
    }
    return Array.from(contagensSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  },

  /**
   * Lista exclusivamente endereços que possuem produtos pendentes de contagem para a contagem selecionada.
   * Ordena os endereços em ordem alfabética crescente (A-Z).
   */
  async listarEnderecosPendentesPorContagem(
    nomeContagem: string,
    targetUnit?: string
  ): Promise<EnderecoContagemInfo[]> {
    const cleanContagem = nomeContagem.trim();
    if (!cleanContagem) return [];

    const activeUnit = targetUnit || getActiveUserUnit();
    const supabase = getSupabase();

    let itensContagem: Array<{
      id: any;
      endereco: string;
      produto: string;
      status?: string | null;
      qtd_contada?: number | null;
      unidade_negocio?: string;
    }> = [];

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('inventario')
          .select('id, endereco, produto, status, qtd_contada, unidade_negocio')
          .eq('contagem', cleanContagem);

        if (activeUnit) {
          query = query.in('unidade_negocio', getUnitEquivalents(activeUnit));
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          itensContagem = data;
        } else if (error) {
          console.warn('Erro ao consultar endereços da contagem no Supabase:', error.message);
        }
      } catch (err) {
        console.warn('Exceção ao listar endereços da contagem no Supabase:', err);
      }
    }

    if (itensContagem.length === 0) {
      itensContagem = getLocalTabelaInventario()
        .filter((it) => it.contagem?.trim().toLowerCase() === cleanContagem.toLowerCase())
        .filter((it) => (activeUnit ? itemMatchesUserUnit(it.unidade_negocio, activeUnit) : true))
        .map((it) => ({
          id: it.id,
          endereco: it.endereco,
          produto: it.produto,
          status: it.status,
          qtd_contada: it.qtd_contada,
          unidade_negocio: it.unidade_negocio,
        }));
    }

    // Agrupa contagens por endereço e calcula pendências
    const endMap = new Map<string, { total: number; contados: number; pendentes: number }>();
    for (const it of itensContagem) {
      const e = it.endereco?.trim();
      if (!e) continue;
      const key = e.toUpperCase();
      const cur = endMap.get(key) || { total: 0, contados: 0, pendentes: 0 };
      cur.total += 1;

      // Critério oficial de pendência:
      // Produto é pendente APENAS se ainda não houver quantidade contada registrada (qtd_contada === null || qtd_contada === undefined)
      // e o status não for 'contada', 'validada', 'revisada' ou 'bloqueada'.
      // Quantidade zero (0) é uma contagem válida e NÃO deve ser tratada como ausência de valor.
      const st = (it.status || '').toLowerCase().trim();
      const temContagemRegistrada = it.qtd_contada !== null && it.qtd_contada !== undefined;
      const isPendente =
        !temContagemRegistrada &&
        st !== 'contada' &&
        st !== 'validada' &&
        st !== 'revisada' &&
        st !== 'bloqueada';

      if (isPendente) {
        cur.pendentes += 1;
      } else {
        cur.contados += 1;
      }
      endMap.set(key, cur);
    }

    // Filtra exclusivamente endereços com pendências
    const enderecosPendentesKeys = Array.from(endMap.entries())
      .filter(([_, info]) => info.pendentes > 0)
      .map(([k]) => k);

    if (enderecosPendentesKeys.length === 0) {
      return [];
    }

    // Carrega descrições cadastradas de endereços para enriquecimento visual
    const descricoes = new Map<string, string>();
    try {
      const todosEnderecos = await this.listarEnderecos(activeUnit);
      todosEnderecos.forEach((e) => {
        descricoes.set(e.endereco.trim().toUpperCase(), e.descricao || '');
      });
    } catch {
      // Ignora erro auxiliar
    }

    const resultado: EnderecoContagemInfo[] = [];
    for (const [key, info] of endMap.entries()) {
      if (info.pendentes <= 0) continue;

      const itemRef = itensContagem.find((it) => it.endereco.trim().toUpperCase() === key);
      const enderecoFormatado = itemRef ? itemRef.endereco.trim() : key;

      resultado.push({
        id: `end-${enderecoFormatado}`,
        endereco: enderecoFormatado,
        descricao: descricoes.get(key) || '',
        ativo: true,
        unidade_negocio: activeUnit || 'Goiânia',
        totalProdutos: info.total,
        totalContados: info.contados,
        incompleto: true,
      });
    }

    // Ordenação alfabética crescente estrita (A-Z)
    resultado.sort((a, b) =>
      a.endereco.localeCompare(b.endereco, 'pt-BR', { numeric: true, sensitivity: 'base' })
    );

    return resultado;
  },

  /**
   * Lista endereços com status de conferência física (produtos contados vs pendentes).
   * Permite filtrar para exibir apenas endereços incompletos.
   */
  async listarEnderecosComStatusContagem(apenasIncompletos = false, targetUnit?: string): Promise<EnderecoContagemInfo[]> {
    const activeUnit = targetUnit || getActiveUserUnit();
    const supabase = getSupabase();
    let listaEnderecos: RegistroEndereco[] = [];
    let itensInventario: { endereco: string; qtd_contada?: number | null; unidade_negocio?: string }[] = [];

    if (isSupabaseConfigured && supabase) {
      try {
        let endQuery = supabase
          .from('enderecos')
          .select('id, unidade_negocio, endereco, descricao, ativo')
          .eq('ativo', true)
          .order('endereco', { ascending: true });

        let invQuery = supabase
          .from('inventario')
          .select('unidade_negocio, endereco, qtd_contada');

        if (activeUnit) {
          endQuery = endQuery.in('unidade_negocio', getUnitEquivalents(activeUnit));
          invQuery = invQuery.in('unidade_negocio', getUnitEquivalents(activeUnit));
        }

        const [endRes, invRes] = await Promise.all([endQuery, invQuery]);

        if (endRes.error && (endRes.error.message.includes('unidade_negocio') || endRes.error.code === '42703')) {
          const fallbackEnd = await supabase
            .from('enderecos')
            .select('id, endereco, descricao, ativo')
            .eq('ativo', true)
            .order('endereco', { ascending: true });
          if (!fallbackEnd.error && fallbackEnd.data) {
            listaEnderecos = fallbackEnd.data as RegistroEndereco[];
          }
        } else if (!endRes.error && endRes.data) {
          listaEnderecos = endRes.data as RegistroEndereco[];
        }

        if (invRes.error && (invRes.error.message.includes('unidade_negocio') || invRes.error.code === '42703')) {
          const fallbackInv = await supabase.from('inventario').select('endereco, qtd_contada');
          if (!fallbackInv.error && fallbackInv.data) {
            itensInventario = fallbackInv.data;
          }
        } else if (!invRes.error && invRes.data) {
          itensInventario = invRes.data;
        }

        if (activeUnit) {
          listaEnderecos = listaEnderecos.filter((e) => itemMatchesUserUnit(e.unidade_negocio, activeUnit));
          itensInventario = itensInventario.filter((i) => itemMatchesUserUnit(i.unidade_negocio, activeUnit));
        }
      } catch (err) {
        console.warn('Erro ao consultar status no Supabase, usando local:', err);
      }
    }

    if (listaEnderecos.length === 0) {
      listaEnderecos = getLocalTabelaEnderecos()
        .filter((e) => e.ativo)
        .filter((e) => (activeUnit ? itemMatchesUserUnit(e.unidade_negocio, activeUnit) : true));

      itensInventario = getLocalTabelaInventario()
        .filter((i) => (activeUnit ? itemMatchesUserUnit(i.unidade_negocio, activeUnit) : true))
        .map((i) => ({
          endereco: i.endereco,
          qtd_contada: i.qtd_contada,
          unidade_negocio: i.unidade_negocio,
        }));
    }

    // Agrupa contagens por endereço
    const contagemMap = new Map<string, { total: number; contados: number }>();
    for (const item of itensInventario) {
      const key = item.endereco.trim().toUpperCase();
      const atual = contagemMap.get(key) || { total: 0, contados: 0 };
      atual.total += 1;
      if (item.qtd_contada !== null && item.qtd_contada !== undefined) {
        atual.contados += 1;
      }
      contagemMap.set(key, atual);
    }

    const resultado: EnderecoContagemInfo[] = listaEnderecos.map((end) => {
      const info = contagemMap.get(end.endereco.trim().toUpperCase()) || { total: 0, contados: 0 };
      const incompleto = info.total === 0 || info.contados < info.total;
      return {
        ...end,
        totalProdutos: info.total,
        totalContados: info.contados,
        incompleto,
      };
    });

    if (apenasIncompletos) {
      return resultado.filter((e) => e.incompleto);
    }

    return resultado;
  },

  /**
   * Adiciona um produto físico encontrado no armazém a um endereço no inventário
   * REGRA MANDATÓRIA: Valida duplicidade para impedir adição duplicada do mesmo produto no mesmo endereço.
   */
  async adicionarProdutoAoInventario(params: {
    endereco: string;
    produto: string;
    usuarioId: string;
    contagem?: string;
  }): Promise<ItemParaContagem> {
    const cleanEndereco = params.endereco.trim();
    const cleanProduto = params.produto.trim();

    if (!cleanEndereco) {
      throw new Error('Endereço não informado.');
    }
    if (!cleanProduto) {
      throw new Error('Selecione ou informe o nome do produto.');
    }

    // 1. Validação de Duplicidade no Endereço
    const produtosExistentes = await this.carregarProdutosParaContagem(
      cleanEndereco,
      undefined,
      params.contagem
    );
    const duplicado = produtosExistentes.some(
      (p) => p.produto.trim().toUpperCase() === cleanProduto.toUpperCase()
    );

    if (duplicado) {
      throw new Error(`O produto "${cleanProduto}" já está cadastrado no endereço ${cleanEndereco}.`);
    }

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const payload: Record<string, any> = {
          produto: cleanProduto,
          endereco: cleanEndereco,
          qtd_disponivel: 0,
          qtd_contada: null,
          corrigido: false,
          usuario_id: params.usuarioId,
        };
        if (params.contagem) {
          payload.contagem = params.contagem;
        }

        const { data, error } = await supabase
          .from('inventario')
          .insert([payload])
          .select('id, produto, endereco')
          .single();

        if (!error && data) {
          return {
            id: data.id,
            produto: data.produto,
            endereco: data.endereco,
          };
        }
        if (error) {
          console.warn('Erro ao inserir item de inventário no Supabase, usando local:', error.message);
        }
      } catch (err) {
        console.warn('Exceção ao inserir produto no Supabase:', err);
      }
    }

    // Fallback Local
    const local = getLocalTabelaInventario();
    const novoId = `inv-${Date.now()}`;
    const novoRegistro = {
      id: novoId,
      produto: cleanProduto,
      endereco: cleanEndereco,
      qtd_disponivel: 0,
      qtd_contada: null,
      corrigido: false,
      usuario_id: params.usuarioId,
      contagem: params.contagem || null,
      data_atualizada: new Date().toISOString(),
    };
    saveLocalTabelaInventario([...local, novoRegistro]);

    return {
      id: novoId,
      produto: cleanProduto,
      endereco: cleanEndereco,
    };
  },

  /**
   * Obtém a prévia operacional do endereço selecionado (apenas quantidade de produtos e itens)
   * NUNCA expõe nenhuma quantidade esperada de estoque!
   */
  async obterPreviaEndereco(
    endereco: string,
    targetUnit?: string,
    nomeContagem?: string
  ): Promise<PreviaEnderecoContagem> {
    const cleanEndereco = endereco.trim();
    const activeUnit = targetUnit || getActiveUserUnit();
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('inventario')
          .select('id, produto, unidade_negocio, status, qtd_contada')
          .eq('endereco', cleanEndereco);

        if (nomeContagem?.trim()) {
          query = query.eq('contagem', nomeContagem.trim());
        }

        if (activeUnit) {
          query = query.in('unidade_negocio', getUnitEquivalents(activeUnit));
        }

        let { data, error }: { data: any; error: any } = await query;

        if (error && (error.message.includes('unidade_negocio') || error.code === '42703')) {
          let fallbackQuery = supabase
            .from('inventario')
            .select('id, produto, status, qtd_contada')
            .eq('endereco', cleanEndereco);
          if (nomeContagem?.trim()) {
            fallbackQuery = fallbackQuery.eq('contagem', nomeContagem.trim());
          }
          const fallbackRes = await fallbackQuery;
          data = fallbackRes.data;
          error = fallbackRes.error;
        }

        if (!error && data) {
          let rows = data as { id: any; produto: string; unidade_negocio?: string }[];
          if (activeUnit) {
            rows = rows.filter((r) => itemMatchesUserUnit(r.unidade_negocio, activeUnit));
          }
          return {
            endereco: cleanEndereco,
            totalProdutos: rows.length,
            totalItens: rows.length,
          };
        }
      } catch (err) {
        console.warn('Falha ao buscar prévia no Supabase, usando local:', err);
      }
    }

    let localItems = getLocalTabelaInventario().filter(
      (item) => item.endereco.trim().toUpperCase() === cleanEndereco.toUpperCase()
    );
    if (nomeContagem?.trim()) {
      localItems = localItems.filter(
        (item) => item.contagem?.trim().toLowerCase() === nomeContagem.trim().toLowerCase()
      );
    }
    if (activeUnit) {
      localItems = localItems.filter((i) => itemMatchesUserUnit(i.unidade_negocio, activeUnit));
    }

    return {
      endereco: cleanEndereco,
      totalProdutos: localItems.length,
      totalItens: localItems.length,
    };
  },

  /**
   * Carrega os produtos vinculados ao endereço para início da contagem.
   * Seleciona EXCLUSIVAMENTE 'id, produto, endereco' — nenhuma quantidade confidencial é retornada!
   */
  async carregarProdutosParaContagem(
    endereco: string,
    targetUnit?: string,
    nomeContagem?: string
  ): Promise<ItemParaContagem[]> {
    const cleanEndereco = endereco.trim();
    const activeUnit = targetUnit || getActiveUserUnit();
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('inventario')
          .select('id, produto, endereco, unidade_negocio, status, qtd_contada')
          .eq('endereco', cleanEndereco);

        if (nomeContagem?.trim()) {
          query = query.eq('contagem', nomeContagem.trim());
        }

        if (activeUnit) {
          query = query.in('unidade_negocio', getUnitEquivalents(activeUnit));
        }

        query = query.order('id', { ascending: true });

        let { data, error }: { data: any; error: any } = await query;

        if (error && (error.message.includes('unidade_negocio') || error.code === '42703')) {
          let fallbackQuery = supabase
            .from('inventario')
            .select('id, produto, endereco, status, qtd_contada')
            .eq('endereco', cleanEndereco);
          if (nomeContagem?.trim()) {
            fallbackQuery = fallbackQuery.eq('contagem', nomeContagem.trim());
          }
          const fallbackRes = await fallbackQuery.order('id', { ascending: true });
          data = fallbackRes.data;
          error = fallbackRes.error;
        }

        if (!error && data && data.length > 0) {
          let rows = data as { id: string | number; produto: string; endereco: string; unidade_negocio?: string; status?: string; qtd_contada?: any }[];
          if (activeUnit) {
            rows = rows.filter((r) => itemMatchesUserUnit(r.unidade_negocio, activeUnit));
          }
          // Prioriza itens que ainda estão pendentes (sem contagem registrada e não finalizados)
          const pendentes = rows.filter((r) => {
            const temContagem = r.qtd_contada !== null && r.qtd_contada !== undefined;
            const st = (r.status || '').toLowerCase().trim();
            return !temContagem && st !== 'contada' && st !== 'validada' && st !== 'revisada' && st !== 'bloqueada';
          });
          const finalRows = pendentes.length > 0 ? pendentes : rows;

          return finalRows.map((d) => ({
            id: d.id,
            produto: d.produto,
            endereco: d.endereco,
          }));
        }
      } catch (err) {
        console.warn('Falha ao carregar produtos no Supabase, usando local:', err);
      }
    }

    let local = getLocalTabelaInventario();
    let filtered = local.filter(
      (item) => item.endereco.trim().toUpperCase() === cleanEndereco.toUpperCase()
    );
    if (nomeContagem?.trim()) {
      filtered = filtered.filter(
        (item) => item.contagem?.trim().toLowerCase() === nomeContagem.trim().toLowerCase()
      );
    }
    if (activeUnit) {
      filtered = filtered.filter((item) => itemMatchesUserUnit(item.unidade_negocio, activeUnit));
    }

    const pendentesLocais = filtered.filter((r) => {
      const temContagem = r.qtd_contada !== null && r.qtd_contada !== undefined;
      const st = (r.status || '').toLowerCase().trim();
      return !temContagem && st !== 'contada' && st !== 'validada' && st !== 'revisada' && st !== 'bloqueada';
    });
    const finalLocais = pendentesLocais.length > 0 ? pendentesLocais : filtered;

    return finalLocais.map((item) => ({
      id: item.id,
      produto: item.produto,
      endereco: item.endereco,
    }));
  },

  /**
   * Compara a quantidade informada pelo usuário com 'qtd_disponivel'.
   * REGRA FUNDAMENTAL: O valor de 'qtd_disponivel' NUNCA é retornado para a tela,
   * apenas o veredito ('IGUAL' | 'MENOR' | 'MAIOR').
   */
  async compararContagem(
    id: string | number,
    qtdContada: number
  ): Promise<{ success: boolean; resultado: ResultadoComparacaoContagem; error?: string }> {
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        // Busca pontual estritamente do campo interno de comparação
        const { data, error } = await supabase
          .from('inventario')
          .select('id, qtd_disponivel')
          .eq('id', id)
          .single();

        if (error || !data) {
          return { success: false, resultado: 'IGUAL', error: error?.message || 'Item não localizado' };
        }

        const qtdEsperada = Number(data.qtd_disponivel) || 0;
        let resultado: ResultadoComparacaoContagem = 'IGUAL';

        if (qtdContada === qtdEsperada) {
          resultado = 'IGUAL';
        } else if (qtdContada < qtdEsperada) {
          resultado = 'MENOR';
        } else {
          resultado = 'MAIOR';
        }

        // Retorna APENAS o veredito visual, sem expor qtdEsperada
        return { success: true, resultado };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Falha na verificação';
        return { success: false, resultado: 'IGUAL', error: msg };
      }
    }

    // Fallback Local
    const local = getLocalTabelaInventario();
    const target = local.find((item) => String(item.id) === String(id));

    if (!target) {
      return { success: false, resultado: 'IGUAL', error: 'Registro não encontrado' };
    }

    const qtdEsperada = Number(target.qtd_disponivel) || 0;
    let resultado: ResultadoComparacaoContagem = 'IGUAL';

    if (qtdContada === qtdEsperada) {
      resultado = 'IGUAL';
    } else if (qtdContada < qtdEsperada) {
      resultado = 'MENOR';
    } else {
      resultado = 'MAIOR';
    }

    return { success: true, resultado };
  },

  /**
   * Grava definitivamente a contagem no banco quando o usuário clica em PROSSEGUIR ou PRÓXIMO.
   * Atualiza: status ('contada'), qtd_contada, data_contagem e usuario_id.
   * Considera zero (0) uma contagem válida e não um campo vazio.
   * NUNCA altera qtd_disponivel, qtd_atual, qtd_reservada ou peso_total!
   */
  async gravarContagemDefinitiva(params: {
    id: string | number;
    qtdContada: number;
    usuarioId: string;
  }): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabase();
    const nowIso = new Date().toISOString();
    // Garante que 0 é estritamente preservado como quantidade válida
    const validQtd =
      typeof params.qtdContada === 'number' && !isNaN(params.qtdContada)
        ? params.qtdContada
        : Number(params.qtdContada) || 0;

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('inventario')
          .update({
            status: 'contada',
            qtd_contada: validQtd,
            data_contagem: nowIso,
            usuario_id: params.usuarioId,
          })
          .eq('id', params.id);

        if (error) {
          console.error('Erro ao gravar contagem no Supabase:', error);
          return { success: false, error: error.message };
        }

        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao gravar contagem';
        return { success: false, error: msg };
      }
    }

    // Fallback Local
    const local = getLocalTabelaInventario();
    const updated = local.map((item) => {
      if (String(item.id) === String(params.id)) {
        return {
          ...item,
          status: 'contada' as InventarioStatus,
          qtd_contada: validQtd,
          data_contagem: nowIso,
          usuario_id: params.usuarioId,
        };
      }
      return item;
    });

    saveLocalTabelaInventario(updated);
    return { success: true };
  },

  /**
   * Listagem de contagens para Gestores (Acesso restrito a nivel = 'gestor')
   * Não realiza SELECT *, utiliza paginação e filtros estritos.
   */
  async listarContagens(
    filtros: FiltrosListagemContagem,
    userRole?: string
  ): Promise<{ success: boolean; result?: PaginatedResult<ItemListagemContagem>; error?: string }> {
    const effectiveRole = userRole || filtros.userRole || 'gestor';
    const roleClean = effectiveRole.toLowerCase();
    const isGestorOuAssistente = roleClean === 'gestor' || roleClean === 'assistente';
    const isRevisaoOuRomaneio = filtros.status === 'revisar' || Boolean(filtros.aba);
    if (!isGestorOuAssistente && !isRevisaoOuRomaneio) {
      return {
        success: false,
        error: 'Acesso restrito: Apenas usuários com perfil Gestor ou Assistente podem listar e auditar contagens.',
      };
    }

    const {
      produto,
      endereco,
      dataContagem,
      usuarioId,
      statusCorrecao,
      status,
      contagem,
      aba,
      ordenacao = 'divergencia_prioritaria',
      page = 1,
      pageSize = 10,
    } = filtros;

    const supabase = getSupabase();

    const activeUnit = getActiveUserUnit();

    // 1. Tentar busca no Supabase se configurado
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase.from('inventario').select(CAMPOS_LISTAGEM_GESTOR);

        if (activeUnit) {
          query = query.in('unidade_negocio', getUnitEquivalents(activeUnit));
        }

        if (produto?.trim()) {
          query = query.ilike('produto', `%${produto.trim()}%`);
        }

        if (endereco?.trim()) {
          query = query.ilike('endereco', `%${endereco.trim()}%`);
        }

        if (dataContagem?.trim()) {
          query = query
            .gte('data_contagem', `${dataContagem.trim()}T00:00:00.000Z`)
            .lte('data_contagem', `${dataContagem.trim()}T23:59:59.999Z`);
        }

        if (usuarioId?.trim()) {
          query = query.eq('usuario_id', usuarioId.trim());
        }

        if (statusCorrecao === 'Corrigido') {
          query = query.eq('corrigido', true);
        } else if (statusCorrecao === 'Pendente') {
          query = query.eq('corrigido', false);
        }

        let { data, error }: { data: any; error: any } = await query;

        if (error && (error.message.includes('unidade_negocio') || error.code === '42703')) {
          let retryQuery = supabase.from('inventario').select(CAMPOS_LISTAGEM_GESTOR_FALLBACK);
          if (produto?.trim()) retryQuery = retryQuery.ilike('produto', `%${produto.trim()}%`);
          if (endereco?.trim()) retryQuery = retryQuery.ilike('endereco', `%${endereco.trim()}%`);
          if (dataContagem?.trim()) {
            retryQuery = retryQuery
              .gte('data_contagem', `${dataContagem.trim()}T00:00:00.000Z`)
              .lte('data_contagem', `${dataContagem.trim()}T23:59:59.999Z`);
          }
          if (usuarioId?.trim()) retryQuery = retryQuery.eq('usuario_id', usuarioId.trim());
          if (statusCorrecao === 'Corrigido') retryQuery = retryQuery.eq('corrigido', true);
          else if (statusCorrecao === 'Pendente') retryQuery = retryQuery.eq('corrigido', false);

          const retryRes = await retryQuery;
          data = retryRes.data;
          error = retryRes.error;
        }

        if (!error && data) {
          let rawData = data;
          if (activeUnit) {
            rawData = rawData.filter((d: any) => itemMatchesUserUnit(d.unidade_negocio, activeUnit));
          }
          let items: ItemListagemContagem[] = rawData.map((d: any) => {
            const rawStatus = (d.status as InventarioStatus) || '';
            const temContagem = d.qtd_contada !== null && d.qtd_contada !== undefined;
            let itemStatus: InventarioStatus;
            if (d.corrigido) {
              itemStatus = 'validada';
            } else if (rawStatus && rawStatus !== 'pendente') {
              itemStatus = rawStatus;
            } else if (temContagem) {
              itemStatus = 'contada';
            } else {
              itemStatus = (rawStatus as InventarioStatus) || 'pendente';
            }

            return {
              id: d.id,
              unidade_negocio: d.unidade_negocio || activeUnit || 'Goiânia',
              produto: d.produto,
              endereco: d.endereco,
              qtd_contada: temContagem ? Number(d.qtd_contada) : null,
              qtd_disponivel: Number(d.qtd_disponivel) || 0,
              qtd_atual: d.qtd_atual !== null && d.qtd_atual !== undefined ? Number(d.qtd_atual) : null,
              peso_total: d.peso_total !== null && d.peso_total !== undefined ? Number(d.peso_total) : null,
              qtd_reservada: d.qtd_reservada !== null && d.qtd_reservada !== undefined ? Number(d.qtd_reservada) : null,
              corrigido: Boolean(d.corrigido),
              data_contagem: d.data_contagem || null,
              status: itemStatus,
              contagem: d.contagem || null,
              usuario_id: d.usuario_id || null,
              usuario_revisao_id: d.usuario_revisao_id || null,
              nome_usuario_contagem: d.nome_usuario_contagem,
              nome_usuario_revisao: d.nome_usuario_revisao,
              data_revisao: d.data_revisao || null,
              quantidade_revisao: d.quantidade_revisao !== null && d.quantidade_revisao !== undefined ? Number(d.quantidade_revisao) : null,
              observacao: d.observacao || null,
              alteracoes_endereco: d.alteracoes_endereco || null,
            };
          });

          // Filtros aplicados em memória (contagem, status e abas: Falta / Sobressalentes / Corrigidas)
          if (contagem?.trim()) {
            items = items.filter((i) =>
              (i.contagem || '').toLowerCase().includes(contagem.trim().toLowerCase())
            );
          }

          if (status && status !== 'todos') {
            items = items.filter((i) => i.status === status);
          }

          if (aba === 'falta') {
            items = items.filter((i) => {
              const temContagem = i.qtd_contada !== null && i.qtd_contada !== undefined;
              const ehMenor = temContagem && Number(i.qtd_contada) < Number(i.qtd_disponivel);
              const naoResolvido =
                i.status !== 'validada' && i.status !== 'bloqueada' && i.status !== 'invalidada';
              return ehMenor && naoResolvido;
            });
          } else if (aba === 'sobressalentes') {
            items = items.filter((i) => {
              const temContagem = i.qtd_contada !== null && i.qtd_contada !== undefined;
              const ehMaior = temContagem && Number(i.qtd_contada) > Number(i.qtd_disponivel);
              const naoResolvido =
                i.status !== 'validada' && i.status !== 'bloqueada' && i.status !== 'invalidada';
              return ehMaior && naoResolvido;
            });
          } else if (aba === 'corrigidas') {
            items = items.filter((i) => {
              return (
                i.status === 'validada' ||
                i.status === 'bloqueada' ||
                i.status === 'invalidada' ||
                Boolean(i.corrigido)
              );
            });
          }

          // Ordenação inteligente:
          // 1. Divergências pendentes
          // 2. Divergências corrigidas
          // 3. Sem divergência
          // Dentro de cada grupo: data mais recente primeiro
          items.sort((a, b) => {
            if (ordenacao === 'divergencia_prioritaria') {
              const rankA = getPriorityRank(a);
              const rankB = getPriorityRank(b);
              if (rankA !== rankB) {
                return rankA - rankB;
              }
              const timeA = a.data_contagem ? new Date(a.data_contagem).getTime() : 0;
              const timeB = b.data_contagem ? new Date(b.data_contagem).getTime() : 0;
              return timeB - timeA;
            }

            if (ordenacao === 'data_desc') {
              const timeA = a.data_contagem ? new Date(a.data_contagem).getTime() : 0;
              const timeB = b.data_contagem ? new Date(b.data_contagem).getTime() : 0;
              return timeB - timeA;
            }

            if (ordenacao === 'data_asc') {
              const timeA = a.data_contagem ? new Date(a.data_contagem).getTime() : 0;
              const timeB = b.data_contagem ? new Date(b.data_contagem).getTime() : 0;
              return timeA - timeB;
            }

            if (ordenacao === 'produto_asc') {
              return a.produto.localeCompare(b.produto);
            }

            return 0;
          });

          const total = items.length;
          const totalPages = Math.ceil(total / pageSize) || 1;
          const startIndex = (page - 1) * pageSize;
          const paginatedItems = items.slice(startIndex, startIndex + pageSize);

          return {
            success: true,
            result: {
              data: paginatedItems,
              total,
              page,
              pageSize,
              totalPages,
            },
          };
        }
      } catch (err) {
        console.warn('Falha ao consultar contagens no Supabase, usando local:', err);
      }
    }

    // 2. Fallback Local Storage
    const all = getLocalTabelaInventario();

    let filtered = all.filter((item) => {
      if (activeUnit) {
        if (!itemMatchesUserUnit((item as any).unidade_negocio, activeUnit)) {
          return false;
        }
      }

      if (produto?.trim()) {
        if (!item.produto.toLowerCase().includes(produto.trim().toLowerCase())) {
          return false;
        }
      }

      if (endereco?.trim()) {
        if (!item.endereco.toLowerCase().includes(endereco.trim().toLowerCase())) {
          return false;
        }
      }

      if (dataContagem?.trim()) {
        if (!item.data_contagem || !item.data_contagem.startsWith(dataContagem.trim())) {
          return false;
        }
      }

      if (usuarioId?.trim()) {
        if (item.usuario_id !== usuarioId.trim()) {
          return false;
        }
      }

      if (statusCorrecao === 'Corrigido') {
        if (!item.corrigido) return false;
      } else if (statusCorrecao === 'Pendente') {
        if (item.corrigido) return false;
      }

      if (contagem?.trim()) {
        if (!(item.contagem || '').toLowerCase().includes(contagem.trim().toLowerCase())) {
          return false;
        }
      }

      const rawStatus = (item.status as InventarioStatus) || '';
      const temContagem = item.qtd_contada !== null && item.qtd_contada !== undefined;
      let itemStatus: InventarioStatus;
      if (item.corrigido) {
        itemStatus = 'validada';
      } else if (rawStatus && rawStatus !== 'pendente') {
        itemStatus = rawStatus;
      } else if (temContagem) {
        itemStatus = 'contada';
      } else {
        itemStatus = (rawStatus as InventarioStatus) || 'pendente';
      }

      if (status && status !== 'todos') {
        if (itemStatus !== status) return false;
      }

      if (aba === 'falta') {
        const temContagem = item.qtd_contada !== null && item.qtd_contada !== undefined;
        const ehMenor = temContagem && Number(item.qtd_contada) < Number(item.qtd_disponivel);
        const naoResolvido =
          itemStatus !== 'validada' && itemStatus !== 'bloqueada' && itemStatus !== 'invalidada';
        if (!ehMenor || !naoResolvido) return false;
      } else if (aba === 'sobressalentes') {
        const temContagem = item.qtd_contada !== null && item.qtd_contada !== undefined;
        const ehMaior = temContagem && Number(item.qtd_contada) > Number(item.qtd_disponivel);
        const naoResolvido =
          itemStatus !== 'validada' && itemStatus !== 'bloqueada' && itemStatus !== 'invalidada';
        if (!ehMaior || !naoResolvido) return false;
      } else if (aba === 'corrigidas') {
        const resolvido =
          itemStatus === 'validada' ||
          itemStatus === 'bloqueada' ||
          itemStatus === 'invalidada' ||
          Boolean(item.corrigido);
        if (!resolvido) return false;
      }

      return true;
    });

    // Ordenação
    filtered.sort((a, b) => {
      if (ordenacao === 'divergencia_prioritaria') {
        const rankA = getPriorityRank(a);
        const rankB = getPriorityRank(b);
        if (rankA !== rankB) {
          return rankA - rankB;
        }
        const timeA = a.data_contagem ? new Date(a.data_contagem).getTime() : 0;
        const timeB = b.data_contagem ? new Date(b.data_contagem).getTime() : 0;
        return timeB - timeA;
      }

      if (ordenacao === 'data_desc') {
        const timeA = a.data_contagem ? new Date(a.data_contagem).getTime() : 0;
        const timeB = b.data_contagem ? new Date(b.data_contagem).getTime() : 0;
        return timeB - timeA;
      }

      if (ordenacao === 'data_asc') {
        const timeA = a.data_contagem ? new Date(a.data_contagem).getTime() : 0;
        const timeB = b.data_contagem ? new Date(b.data_contagem).getTime() : 0;
        return timeA - timeB;
      }

      if (ordenacao === 'produto_asc') {
        return a.produto.localeCompare(b.produto);
      }

      return 0;
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const startIndex = (page - 1) * pageSize;
    const paginatedItems: ItemListagemContagem[] = filtered
      .slice(startIndex, startIndex + pageSize)
      .map((item) => ({
        id: item.id,
        unidade_negocio: (item as any).unidade_negocio || activeUnit || 'Goiânia',
        produto: item.produto,
        endereco: item.endereco,
        qtd_contada: item.qtd_contada !== null && item.qtd_contada !== undefined ? Number(item.qtd_contada) : null,
        qtd_disponivel: Number(item.qtd_disponivel) || 0,
        qtd_atual: item.qtd_atual !== null && item.qtd_atual !== undefined ? Number(item.qtd_atual) : null,
        peso_total: item.peso_total !== null && item.peso_total !== undefined ? Number(item.peso_total) : null,
        qtd_reservada: item.qtd_reservada !== null && item.qtd_reservada !== undefined ? Number(item.qtd_reservada) : null,
        corrigido: Boolean(item.corrigido),
        data_contagem: item.data_contagem || null,
        status: (() => {
          const rawSt = (item.status as InventarioStatus) || '';
          const temCont = item.qtd_contada !== null && item.qtd_contada !== undefined;
          if (item.corrigido) return 'validada' as InventarioStatus;
          if (rawSt && rawSt !== 'pendente') return rawSt as InventarioStatus;
          if (temCont) return 'contada' as InventarioStatus;
          return (rawSt as InventarioStatus) || 'pendente';
        })(),
        contagem: item.contagem || null,
        usuario_id: item.usuario_id || null,
        usuario_revisao_id: item.usuario_revisao_id || null,
        data_revisao: item.data_revisao || null,
        quantidade_revisao: item.quantidade_revisao !== null && item.quantidade_revisao !== undefined ? Number(item.quantidade_revisao) : null,
        observacao: item.observacao || null,
        alteracoes_endereco: item.alteracoes_endereco || null,
      }));

    return {
      success: true,
      result: {
        data: paginatedItems,
        total,
        page,
        pageSize,
        totalPages,
      },
    };
  },

  /**
   * Obtém os detalhes completos de um registro para a tela "Detalhes da Contagem"
   */
  async obterDetalheContagem(
    id: string | number,
    userRole?: string
  ): Promise<{ success: boolean; data?: DetalheContagem; error?: string }> {
    const roleClean = userRole?.toLowerCase();
    const isGestorOuAssistente = roleClean === 'gestor' || roleClean === 'assistente';
    if (!isGestorOuAssistente) {
      return {
        success: false,
        error: 'Acesso restrito: Apenas usuários com perfil Gestor ou Assistente podem visualizar os detalhes de inventário.',
      };
    }

    const supabase = getSupabase();
    let rawItem: DetalheContagem | null = null;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('inventario')
          .select(CAMPOS_DETALHE_GESTOR)
          .eq('id', id)
          .maybeSingle();

        if (!error && data) {
          rawItem = {
            ...data,
            corrigido: Boolean(data.corrigido),
          };
        }
      } catch (err) {
        console.warn('Falha ao buscar detalhe no Supabase, usando local:', err);
      }
    }

    if (!rawItem) {
      const local = getLocalTabelaInventario();
      const found = local.find((i) => String(i.id) === String(id));
      if (found) {
        rawItem = {
          ...found,
          corrigido: Boolean(found.corrigido),
        };
      }
    }

    if (!rawItem) {
      return { success: false, error: 'Registro de inventário não encontrado.' };
    }

    // Resolver identificação dos usuários (contagem e correção)
    let usuarios = getLocalUsuarios();
    try {
      const todos = await usuariosService.listarTodos();
      if (todos && todos.length > 0) {
        usuarios = todos;
      }
    } catch {
      usuarios = getLocalUsuarios();
    }

    let usuarioContador = rawItem.usuario_id
      ? usuarios.find(
          (u) =>
            u.id === rawItem?.usuario_id ||
            u.codigo?.toUpperCase() === rawItem?.usuario_id?.toUpperCase()
        )
      : null;

    if (!usuarioContador && rawItem.usuario_id) {
      try {
        usuarioContador = await usuariosService.getById(rawItem.usuario_id);
      } catch {
        // fallback
      }
    }

    let usuarioCorrecao = rawItem.usuario_correcao
      ? usuarios.find(
          (u) =>
            u.id === rawItem?.usuario_correcao ||
            u.codigo?.toUpperCase() === rawItem?.usuario_correcao?.toUpperCase()
        )
      : null;

    if (!usuarioCorrecao && rawItem.usuario_correcao) {
      try {
        usuarioCorrecao = await usuariosService.getById(rawItem.usuario_correcao);
      } catch {
        // fallback
      }
    }

    // Resolver nome de usuário amigável (nunca exibir a chave ID bruta)
    let nomeContagem = usuarioContador?.nome;
    if (!nomeContagem && rawItem.usuario_id) {
      if (rawItem.usuario_id === 'OP-1042' || rawItem.usuario_id === 'usr-default-01') {
        nomeContagem = 'Luiz Fernando';
      } else if (rawItem.usuario_id === 'GS-2005' || rawItem.usuario_id === 'usr-default-02') {
        nomeContagem = 'Mariana Silva (Gestora)';
      } else {
        nomeContagem = 'Operador Responsável';
      }
    }

    let nomeCorrecao = usuarioCorrecao?.nome;
    if (!nomeCorrecao && rawItem.usuario_correcao) {
      if (rawItem.usuario_correcao === 'GS-2005' || rawItem.usuario_correcao === 'usr-default-02') {
        nomeCorrecao = 'Mariana Silva (Gestora)';
      } else if (rawItem.usuario_correcao === 'OP-1042' || rawItem.usuario_correcao === 'usr-default-01') {
        nomeCorrecao = 'Luiz Fernando';
      }
    }

    return {
      success: true,
      data: {
        ...rawItem,
        nome_usuario_contagem: nomeContagem || 'Não informado',
        codigo_usuario_contagem: usuarioContador ? usuarioContador.codigo : (rawItem.usuario_id?.startsWith('OP-') || rawItem.usuario_id?.startsWith('GS-') ? rawItem.usuario_id : undefined),
        nome_usuario_correcao: nomeCorrecao || (rawItem.usuario_correcao ? 'Gestor Responsável' : undefined),
        codigo_usuario_correcao: usuarioCorrecao ? usuarioCorrecao.codigo : (rawItem.usuario_correcao?.startsWith('GS-') || rawItem.usuario_correcao?.startsWith('OP-') ? rawItem.usuario_correcao : undefined),
      },
    };
  },

  /**
   * Marca a divergência como corrigida no sistema.
   * REGRA FUNDAMENTAL: NUNCA altera quantidades de estoque (qtd_disponivel, qtd_atual, etc.).
   * Atualiza EXCLUSIVAMENTE: corrigido = true, usuario_correcao e data_correcao.
   */
  async marcarCorrigido(
    id: string | number,
    usuarioCorrecaoId: string,
    userRole?: string
  ): Promise<{ success: boolean; error?: string; dataCorrecao?: string }> {
    const roleClean = userRole?.toLowerCase();
    const isGestorOuAssistente = roleClean === 'gestor' || roleClean === 'assistente';
    if (!isGestorOuAssistente) {
      return {
        success: false,
        error: 'Acesso restrito: Somente usuários com nível Gestor ou Assistente podem marcar correções.',
      };
    }

    const nowIso = new Date().toISOString();
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('inventario')
          .update({
            corrigido: true,
            usuario_correcao: usuarioCorrecaoId,
            data_correcao: nowIso,
          })
          .eq('id', id);

        if (error) {
          console.error('Erro ao marcar corrigido no Supabase:', error);
          return { success: false, error: error.message };
        }

        return { success: true, dataCorrecao: nowIso };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Falha na atualização de correção';
        return { success: false, error: msg };
      }
    }

    // Fallback Local Storage
    const local = getLocalTabelaInventario();
    let updated = false;

    const next = local.map((item) => {
      if (String(item.id) === String(id)) {
        updated = true;
        return {
          ...item,
          corrigido: true,
          usuario_correcao: usuarioCorrecaoId,
          data_correcao: nowIso,
        };
      }
      return item;
    });

    if (!updated) {
      return { success: false, error: 'Item não localizado no inventário.' };
    }

    saveLocalTabelaInventario(next);
    return { success: true, dataCorrecao: nowIso };
  },

  /**
   * Solicita nova contagem (Status: 'revisar') - Ação exclusiva do Gestor
   */
  async solicitarRevisao(
    id: string | number,
    usuarioId: string,
    observacao?: string
  ): Promise<{ success: boolean; error?: string }> {
    const nowIso = new Date().toISOString();
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('inventario')
          .update({
            status: 'revisar',
            observacao: observacao || null,
            data_atualizada: nowIso,
          })
          .eq('id', id);

        if (error && error.code !== '42703') {
          return { success: false, error: error.message };
        }
      } catch (err: unknown) {
        console.warn('Erro ao atualizar status para revisar no Supabase:', err);
      }
    }

    // Atualiza local
    const local = getLocalTabelaInventario();
    const next = local.map((item) => {
      if (String(item.id) === String(id)) {
        return {
          ...item,
          status: 'revisar' as InventarioStatus,
          observacao: observacao || item.observacao,
          data_atualizada: nowIso,
        };
      }
      return item;
    });
    saveLocalTabelaInventario(next);
    return { success: true };
  },

  /**
   * Confirma divergência durante revisão (status 'bloqueada' se falta, ou 'validada' se sobressalente)
   */
  async confirmarDivergenciaRevisao(
    id: string | number,
    usuarioRevisaoId: string,
    observacao?: string
  ): Promise<{ success: boolean; error?: string }> {
    const nowIso = new Date().toISOString();
    const supabase = getSupabase();

    // Descobrir se é falta ou sobra para definir o status exato
    const local = getLocalTabelaInventario();
    const itemAtual = local.find((i) => String(i.id) === String(id));
    const qtdC = itemAtual?.qtd_contada !== null && itemAtual?.qtd_contada !== undefined ? Number(itemAtual.qtd_contada) : 0;
    const qtdD = Number(itemAtual?.qtd_disponivel) || 0;
    const novoStatus: InventarioStatus = qtdC < qtdD ? 'bloqueada' : 'validada';

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('inventario')
          .update({
            status: novoStatus,
            usuario_revisao_id: usuarioRevisaoId,
            data_revisao: nowIso,
            observacao: observacao || null,
          })
          .eq('id', id);

        if (error && error.code !== '42703') {
          return { success: false, error: error.message };
        }
      } catch (err: unknown) {
        console.warn('Erro no Supabase ao confirmar divergência de revisão:', err);
      }
    }

    const next = local.map((item) => {
      if (String(item.id) === String(id)) {
        return {
          ...item,
          status: novoStatus,
          usuario_revisao_id: usuarioRevisaoId,
          data_revisao: nowIso,
          observacao: observacao || item.observacao,
        };
      }
      return item;
    });
    saveLocalTabelaInventario(next);
    return { success: true };
  },

  /**
   * Registra segunda contagem / correção (status 'revisada', preserva 1ª contagem)
   */
  async corrigirItemInventario(
    id: string | number,
    usuarioId: string,
    novaQtd?: number,
    observacao?: string
  ): Promise<{ success: boolean; error?: string }> {
    const nowIso = new Date().toISOString();
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        const payload: any = {
          status: 'revisada',
          usuario_revisao_id: usuarioId,
          data_revisao: nowIso,
          observacao: observacao || null,
        };
        if (novaQtd !== undefined && novaQtd !== null) {
          payload.quantidade_revisao = novaQtd;
        }

        const { error } = await supabase.from('inventario').update(payload).eq('id', id);
        if (error && error.code !== '42703') {
          return { success: false, error: error.message };
        }
      } catch (err: unknown) {
        console.warn('Erro ao gravar segunda contagem no Supabase:', err);
      }
    }

    const local = getLocalTabelaInventario();
    const next = local.map((item) => {
      if (String(item.id) === String(id)) {
        return {
          ...item,
          status: 'revisada' as InventarioStatus,
          usuario_revisao_id: usuarioId,
          data_revisao: nowIso,
          quantidade_revisao: novaQtd !== undefined ? novaQtd : item.quantidade_revisao,
          observacao: observacao || item.observacao,
        };
      }
      return item;
    });
    saveLocalTabelaInventario(next);
    return { success: true };
  },

  /**
   * Invalida contagem com justificativa obrigatória (status: 'invalidada')
   */
  async invalidarContagem(
    id: string | number,
    usuarioId: string,
    motivo: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!motivo || !motivo.trim()) {
      return { success: false, error: 'A justificativa para invalidação é obrigatória.' };
    }

    const nowIso = new Date().toISOString();
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('inventario')
          .update({
            status: 'invalidada',
            observacao: motivo.trim(),
            usuario_correcao: usuarioId,
            data_correcao: nowIso,
          })
          .eq('id', id);

        if (error && error.code !== '42703') {
          return { success: false, error: error.message };
        }
      } catch (err: unknown) {
        console.warn('Erro ao invalidar contagem no Supabase:', err);
      }
    }

    const local = getLocalTabelaInventario();
    const next = local.map((item) => {
      if (String(item.id) === String(id)) {
        return {
          ...item,
          status: 'invalidada' as InventarioStatus,
          observacao: motivo.trim(),
          usuario_correcao: usuarioId,
          data_correcao: nowIso,
        };
      }
      return item;
    });
    saveLocalTabelaInventario(next);
    return { success: true };
  },

  /**
   * Valida divergência positiva / sobressalente sem ajuste necessário (status: 'validada')
   */
  async validarSobressalente(
    id: string | number,
    usuarioId: string,
    observacao?: string
  ): Promise<{ success: boolean; error?: string }> {
    const nowIso = new Date().toISOString();
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('inventario')
          .update({
            status: 'validada',
            corrigido: true,
            usuario_correcao: usuarioId,
            data_correcao: nowIso,
            observacao: observacao || null,
          })
          .eq('id', id);

        if (error && error.code !== '42703') {
          return { success: false, error: error.message };
        }
      } catch (err: unknown) {
        console.warn('Erro ao validar sobressalente no Supabase:', err);
      }
    }

    const local = getLocalTabelaInventario();
    const next = local.map((item) => {
      if (String(item.id) === String(id)) {
        return {
          ...item,
          status: 'validada' as InventarioStatus,
          corrigido: true,
          usuario_correcao: usuarioId,
          data_correcao: nowIso,
          observacao: observacao || item.observacao,
        };
      }
      return item;
    });
    saveLocalTabelaInventario(next);
    return { success: true };
  },

  /**
   * Importação em lote de contagem Excel (Gestor e Assistente)
   * Registros criados obrigatoriamente com status 'pendente'
   */
  async importarContagemExcel(params: {
    nomeContagem: string;
    unidade: string;
    usuarioId: string;
    itens: Array<{
      produto: string;
      endereco: string;
      qtd_contada?: number | null;
      qtd_disponivel: number;
      qtd_reservada: number;
    }>;
  }): Promise<{ success: boolean; totalCriados: number; error?: string }> {
    const { nomeContagem, unidade, usuarioId, itens } = params;
    const nowIso = new Date().toISOString();
    const supabase = getSupabase();

    const registrosFormatados = itens.map((it, idx) => ({
      produto: it.produto,
      endereco: it.endereco,
      qtd_contada: null, // Criar registros com status 'pendente', mesmo que a planilha contenha quantidade contada
      qtd_disponivel: it.qtd_disponivel || 0,
      qtd_atual: it.qtd_disponivel || 0,
      peso_total: 0,
      qtd_reservada: it.qtd_reservada || 0,
      usuario_id: usuarioId,
      data_atualizada: nowIso,
      data_contagem: null,
      corrigido: false,
      status: 'pendente' as InventarioStatus,
      contagem: nomeContagem,
      unidade_negocio: unidade,
    }));

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('inventario').insert(registrosFormatados);
        if (error && error.code !== '42703') {
          console.error('Erro na inserção em lote no Supabase:', error);
          // prossegue para salvar no storage local para redundância
        } else if (!error) {
          return { success: true, totalCriados: registrosFormatados.length };
        }
      } catch (err: unknown) {
        console.warn('Falha ao inserir contagem no Supabase, salvando local:', err);
      }
    }

    // Salvar no storage local
    const local = getLocalTabelaInventario();
    const novosComId = registrosFormatados.map((r, idx) => ({
      ...r,
      id: `imp-${Date.now()}-${idx}`,
    }));
    saveLocalTabelaInventario([...novosComId, ...local]);

    return { success: true, totalCriados: novosComId.length };
  },

  /**
   * Importa histórico de alterações de endereços e grava na coluna alteracoes_endereco
   */
  async importarHistoricoAlteracoesEndereco(
    itens: HistoricoAlteracaoEndereco[]
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabase();

    // Agrupar por produto
    const porProduto = new Map<string, HistoricoAlteracaoEndereco[]>();
    itens.forEach((it) => {
      const chave = it.produto.trim().toLowerCase();
      const lista = porProduto.get(chave) || [];
      lista.push(it);
      porProduto.set(chave, lista);
    });

    const local = getLocalTabelaInventario();
    let atualizados = 0;

    const next = local.map((inv) => {
      const chave = inv.produto.trim().toLowerCase();
      const novos = porProduto.get(chave);
      if (novos && novos.length > 0) {
        atualizados++;
        let historicoExistente: HistoricoAlteracaoEndereco[] = [];
        if (inv.alteracoes_endereco) {
          try {
            historicoExistente = JSON.parse(inv.alteracoes_endereco);
          } catch {
            historicoExistente = [];
          }
        }
        // Evitar duplicatas por data e localização
        const combinados = [...novos, ...historicoExistente];
        const unicos = Array.from(
          new Map(combinados.map((c) => [`${c.localizacao_anterior}-${c.localizacao_nova}-${c.data_alteracao}`, c])).values()
        );
        return {
          ...inv,
          alteracoes_endereco: JSON.stringify(unicos),
        };
      }
      return inv;
    });

    saveLocalTabelaInventario(next);

    // Também tentar gravar no Supabase se disponível
    if (isSupabaseConfigured && supabase) {
      try {
        for (const [chave, lista] of porProduto.entries()) {
          await supabase
            .from('inventario')
            .update({
              alteracoes_endereco: JSON.stringify(lista),
            })
            .ilike('produto', `%${chave}%`);
        }
      } catch (err) {
        console.warn('Erro ao atualizar alteracoes_endereco no Supabase:', err);
      }
    }

    return { success: true };
  },

  /**
   * Obtém dados de auditoria do produto (último recebimento e última alteração de endereço)
   */
  async obterAuditoriaProduto(
    produto: string,
    unidade?: string
  ): Promise<AuditoriaProdutoInventario> {
    const supabase = getSupabase();
    let dataUltimoRecebimento: string | null = null;
    let dataUltimaAlteracaoEndereco: string | null = null;
    let historicoAlteracoes: HistoricoAlteracaoEndereco[] = [];

    // 1. Buscar último recebimento em recebimentos_produtos ou agendamentos
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: recData } = await supabase
          .from('recebimentos_produtos')
          .select('data_recebimento, created_at, produto')
          .ilike('produto', `%${produto.trim()}%`)
          .order('created_at', { ascending: false })
          .limit(1);

        if (recData && recData.length > 0) {
          dataUltimoRecebimento = recData[0].data_recebimento || recData[0].created_at || null;
        }
      } catch {
        // fallback
      }
    }

    // Fallback local para recebimentos
    if (!dataUltimoRecebimento) {
      try {
        const rawRec = localStorage.getItem('polihub_recebimentos_produtos');
        if (rawRec) {
          const parsed = JSON.parse(rawRec);
          const match = parsed.find(
            (p: any) => p.produto && p.produto.toLowerCase().includes(produto.toLowerCase())
          );
          if (match) {
            dataUltimoRecebimento = match.data_recebimento || match.created_at || null;
          }
        }
      } catch {
        // fallback
      }
    }

    // 2. Buscar histórico de alteração de endereço
    const local = getLocalTabelaInventario();
    const itemInv = local.find(
      (i) => i.produto.toLowerCase().includes(produto.toLowerCase())
    );

    if (itemInv?.alteracoes_endereco) {
      try {
        historicoAlteracoes = JSON.parse(itemInv.alteracoes_endereco);
        if (historicoAlteracoes.length > 0) {
          dataUltimaAlteracaoEndereco = historicoAlteracoes[0].data_alteracao || null;
        }
      } catch {
        // parsing fallback
      }
    }

    return {
      dataUltimoRecebimento,
      dataUltimaAlteracaoEndereco,
      historicoAlteracoes,
    };
  },

  /**
   * Consolida indicadores e acuracidade para a aba Gráficos e Indicadores
   */
  async obterMetricasGraficosInventario(
    unidade?: string,
    contagem?: string
  ): Promise<MetricasGraficosInventario> {
    const targetUnit = unidade || getActiveUserUnit();
    const listaResp = await this.listarContagens({
      unidadeNegocio: targetUnit,
      contagem: contagem || undefined,
      pageSize: 1000,
      userRole: 'gestor',
    });

    const itens = listaResp.result?.data || [];
    const totalItens = itens.length;

    let contados = 0;
    let pendentes = 0;
    let semDivergencia = 0;
    let faltas = 0;
    let sobressalentes = 0;

    const statusCount = {
      pendente: 0,
      contada: 0,
      revisar: 0,
      revisada: 0,
      validada: 0,
      bloqueada: 0,
      invalidada: 0,
    };

    const contagensSet = new Set<string>();
    const topDivergencias: Array<{
      produto: string;
      endereco: string;
      qtd_disponivel: number;
      qtd_contada: number;
      diferenca: number;
      status: InventarioStatus;
    }> = [];

    itens.forEach((it) => {
      if (it.contagem) contagensSet.add(it.contagem);

      const st = it.status || 'pendente';
      if (st in statusCount) {
        statusCount[st]++;
      }

      if (it.qtd_contada === null || it.qtd_contada === undefined) {
        pendentes++;
      } else {
        contados++;
        const c = Number(it.qtd_contada);
        const d = Number(it.qtd_disponivel);
        const diff = c - d;

        if (c === d) {
          semDivergencia++;
        } else if (c < d) {
          faltas++;
          topDivergencias.push({
            produto: it.produto,
            endereco: it.endereco,
            qtd_disponivel: d,
            qtd_contada: c,
            diferenca: diff,
            status: st,
          });
        } else {
          sobressalentes++;
          topDivergencias.push({
            produto: it.produto,
            endereco: it.endereco,
            qtd_disponivel: d,
            qtd_contada: c,
            diferenca: diff,
            status: st,
          });
        }
      }
    });

    topDivergencias.sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca));

    const acuracidade = contados > 0 ? (semDivergencia / contados) * 100 : 100;

    return {
      totalItens,
      itensContados: contados,
      itensPendentes: pendentes,
      itensSemDivergencia: semDivergencia,
      acuracidade,
      totalFaltas: faltas,
      totalSobressalentes: sobressalentes,
      contagensDisponiveis: Array.from(contagensSet),
      statusCount,
      topDivergencias: topDivergencias.slice(0, 5),
    };
  },
};
