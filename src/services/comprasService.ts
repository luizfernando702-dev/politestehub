import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import {
  SolicitacaoCompra,
  FiltrosCompra,
  RespostaPaginadaCompras,
  MetricasCompras,
  Produto,
  Usuario,
  DemandaCompra,
  UrgenciaCompra,
} from '../types';
import {
  getLocalCompras,
  saveLocalCompras,
  getLocalProdutos,
  getLocalUsuarios,
} from './mockStorage';
import { getUnitEquivalents, itemMatchesUserUnit } from './sessionHelper';
import { produtosService } from './produtosService';
import { usuariosService } from './usuariosService';
import { normalizeProduto } from './produtosService';

// Colunas explícitas para consultas de Compras com relacionamento direto para produtos
const COMPRAS_COLUNAS_SELECT =
  'id, data_insercao, id_produto, quantidade, quantidade_aprovada, demanda, urgencia, id_solicitante, status, id_usuario_aprovacao, data_aprovacao, motivo_recusa, id_usuario_compra, data_compra, observacao, unidade_negocio, produtos:id_produto(id, produto, fabricante, endereco, codigo_barras)';

// Coluna de fallback simples caso o join falhe
const COMPRAS_COLUNAS_FALLBACK =
  'id, data_insercao, id_produto, quantidade, quantidade_aprovada, demanda, urgencia, id_solicitante, status, id_usuario_aprovacao, data_aprovacao, motivo_recusa, id_usuario_compra, data_compra, observacao, unidade_negocio';

class ComprasService {
  /**
   * Helper para enriquecer os dados relacionais (Produto e Usuários)
   */
  private async enriquecerSolicitacoes(solicitacoes: SolicitacaoCompra[]): Promise<SolicitacaoCompra[]> {
    if (solicitacoes.length === 0) return [];

    const supabase = getSupabase();
    const mapaProdutos = new Map<string, Produto>();
    const mapaUsuarios = new Map<string, Usuario>();

    // 1. Extrair produtos pré-carregados pelo PostgREST join
    for (const item of solicitacoes) {
      const pJoin = (item as any).produtos;
      if (pJoin && (pJoin.produto || pJoin.nome)) {
        const norm = normalizeProduto(pJoin);
        mapaProdutos.set(norm.id, norm);
        mapaProdutos.set(norm.id.toLowerCase().trim(), norm);
      }
    }

    // 2. Identificar quais id_produto ainda não foram mapeados
    const idsFaltantes = Array.from(
      new Set(
        solicitacoes
          .map((s) => (s.id_produto || (s as any).produto_id || '')?.toString().trim())
          .filter((id): id is string => Boolean(id && id.length > 0 && !mapaProdutos.has(id) && !mapaProdutos.has(id.toLowerCase())))
      )
    );

    // 3. Buscar pontualmente no Supabase os produtos faltantes pelos seus IDs
    if (idsFaltantes.length > 0 && isSupabaseConfigured && supabase) {
      try {
        const { data: dbProds, error: errDbProds } = await supabase
          .from('produtos')
          .select('id, produto, fabricante, endereco, codigo_barras')
          .in('id', idsFaltantes);

        if (!errDbProds && Array.isArray(dbProds)) {
          for (const raw of dbProds) {
            const norm = normalizeProduto(raw);
            mapaProdutos.set(norm.id, norm);
            mapaProdutos.set(norm.id.toLowerCase().trim(), norm);
          }
        }
      } catch (err) {
        console.warn('Aviso ao buscar produtos por ID no Supabase:', err);
      }
    }

    // 4. Complementar com catálogo local para IDs mockados
    const locais = getLocalProdutos();
    for (const p of locais) {
      if (!mapaProdutos.has(p.id)) {
        mapaProdutos.set(p.id, p);
        mapaProdutos.set(p.id.toLowerCase().trim(), p);
      }
    }

    // 5. Carregar dados de usuários
    try {
      const usuarios = await usuariosService.listarTodos();
      usuarios.forEach((u) => {
        mapaUsuarios.set(u.id, u);
        mapaUsuarios.set(u.id.toLowerCase().trim(), u);
      });
    } catch {
      const usrsLocais = getLocalUsuarios();
      usrsLocais.forEach((u) => {
        mapaUsuarios.set(u.id, u);
        mapaUsuarios.set(u.id.toLowerCase().trim(), u);
      });
    }

    // 6. Montar objetos enriquecidos
    return solicitacoes.map((item) => {
      const prodId = (item.id_produto || (item as any).produto_id || '')?.toString().trim();
      let prod = prodId ? (mapaProdutos.get(prodId) || mapaProdutos.get(prodId.toLowerCase()) || null) : null;

      if (!prod && (item as any).produtos) {
        prod = normalizeProduto((item as any).produtos);
      }

      const prodNome =
        prod?.produto ||
        (item.produto_nome && item.produto_nome !== 'Produto não identificado' ? item.produto_nome : '') ||
        (item as any).nome_produto ||
        (item as any).descricao_produto ||
        'Produto não identificado';

      const prodFabricante =
        prod?.fabricante ||
        (item.produto_fabricante && item.produto_fabricante !== 'Fabricante não informado' ? item.produto_fabricante : '') ||
        (item as any).fabricante_produto ||
        (item as any).marca_produto ||
        'Fabricante não informado';

      const prodCodigoBarras = prod?.codigo_barras || item.produto_codigo_barras || (item as any).codigo_barras || null;
      const prodEndereco = prod?.endereco || item.produto_endereco || (item as any).endereco || null;

      const solicitante =
        (item.id_solicitante ? (mapaUsuarios.get(item.id_solicitante) || mapaUsuarios.get(item.id_solicitante.toLowerCase())) : null) ||
        (item as any).solicitante ||
        null;

      const aprovador = item.id_usuario_aprovacao
        ? (mapaUsuarios.get(item.id_usuario_aprovacao) || mapaUsuarios.get(item.id_usuario_aprovacao.toLowerCase()) || null)
        : null;

      const comprador = item.id_usuario_compra
        ? (mapaUsuarios.get(item.id_usuario_compra) || mapaUsuarios.get(item.id_usuario_compra.toLowerCase()) || null)
        : null;

      return {
        ...item,
        produto: prod || null,
        produto_nome: prodNome,
        produto_fabricante: prodFabricante,
        produto_codigo_barras: prodCodigoBarras,
        produto_endereco: prodEndereco,
        solicitante: solicitante || null,
        solicitante_nome: solicitante?.nome || item.solicitante_nome || 'Usuário Solicitante',
        solicitante_departamento: solicitante?.departamento || item.solicitante_departamento || 'Comercial',
        solicitante_foto: solicitante?.foto || null,
        usuario_aprovacao: aprovador || null,
        usuario_aprovacao_nome: aprovador?.nome || item.usuario_aprovacao_nome,
        usuario_compra: comprador || null,
        usuario_compra_nome: comprador?.nome || item.usuario_compra_nome,
      };
    });
  }

  /**
   * Ordenador de regra de negócio:
   * 1. Status 'Solicitado' primeiro, depois 'Aprovado'
   * 2. Data de inserção mais recente primeiro
   */
  private ordenarSolicitacoes(itens: SolicitacaoCompra[]): SolicitacaoCompra[] {
    return [...itens].sort((a, b) => {
      // Prioridade de status: Solicitado (1) -> Aprovado (2) -> Recusado (3) -> Comprado (4)
      const pesoStatus = (st: string) => {
        if (st === 'Solicitado') return 1;
        if (st === 'Aprovado') return 2;
        if (st === 'Recusado') return 3;
        if (st === 'Comprado') return 4;
        return 5;
      };

      const pesoA = pesoStatus(a.status);
      const pesoB = pesoStatus(b.status);

      if (pesoA !== pesoB) {
        return pesoA - pesoB;
      }

      // Tie breaker: data mais recente primeiro
      return new Date(b.data_insercao).getTime() - new Date(a.data_insercao).getTime();
    });
  }

  /**
   * 2. ABA SOLICITAÇÕES — LISTAGEM E PAGINAÇÃO (50 por página)
   * Lista SOMENTE produtos com status 'Solicitado' ou 'Aprovado'.
   * Ordenando primeiro Solicitado e depois Aprovado.
   * Não exibe 'Comprado' nem 'Recusado'.
   */
  async listarSolicitacoesPaginadas(
    filtros?: FiltrosCompra,
    pagina = 1,
    limite = 50
  ): Promise<RespostaPaginadaCompras> {
    const supabase = getSupabase();
    const from = (pagina - 1) * limite;
    const to = from + limite - 1;

    // Status permitidos na aba Solicitações: somente Solicitado e Aprovado
    const statusPermitidos = ['Solicitado', 'Aprovado'];
    let statusFiltro = statusPermitidos;
    if (filtros?.status && filtros.status !== 'Todos') {
      if (Array.isArray(filtros.status)) {
        statusFiltro = filtros.status.filter((s) => statusPermitidos.includes(s));
      } else if (statusPermitidos.includes(filtros.status)) {
        statusFiltro = [filtros.status];
      }
    }

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('compras')
          .select(COMPRAS_COLUNAS_SELECT, { count: 'exact' })
          .in('status', statusFiltro);

        if (filtros?.unidade_negocio) {
          query = query.in('unidade_negocio', getUnitEquivalents(filtros.unidade_negocio));
        }

        if (filtros?.urgencia && filtros.urgencia !== 'Todos') {
          query = query.eq('urgencia', filtros.urgencia);
        }

        if (filtros?.demanda && filtros.demanda !== 'Todos') {
          query = query.eq('demanda', filtros.demanda);
        }

        if (filtros?.solicitanteId && filtros.solicitanteId !== 'Todos') {
          query = query.eq('id_solicitante', filtros.solicitanteId);
        }

        if (filtros?.gestorAprovacaoId && filtros.gestorAprovacaoId !== 'Todos') {
          if (filtros.gestorAprovacaoId === 'pendente') {
            query = query.is('id_usuario_aprovacao', null);
          } else {
            query = query.eq('id_usuario_aprovacao', filtros.gestorAprovacaoId);
          }
        }

        if (filtros?.produtoId && filtros.produtoId !== 'Todos') {
          query = query.eq('id_produto', filtros.produtoId);
        }

        if (filtros?.dataInicio) {
          query = query.gte('data_insercao', `${filtros.dataInicio}T00:00:00.000Z`);
        }

        if (filtros?.dataFim) {
          query = query.lte('data_insercao', `${filtros.dataFim}T23:59:59.999Z`);
        }

        // Ordenação: Solicitado primeiro (S > A em descending), tie-breaker por data
        query = query
          .order('status', { ascending: false })
          .order('data_insercao', { ascending: false })
          .range(from, to);

        const { data, count, error } = await query;

        if (!error && Array.isArray(data)) {
          let enriquecidas = await this.enriquecerSolicitacoes(data as SolicitacaoCompra[]);

          // Filtro em memória de fabricante e busca textual
          if (filtros?.fabricante && filtros.fabricante !== 'Todos') {
            enriquecidas = enriquecidas.filter(
              (item) => item.produto_fabricante?.toLowerCase() === filtros.fabricante?.toLowerCase()
            );
          }

          if (filtros?.termoBusca && filtros.termoBusca.trim()) {
            const termo = filtros.termoBusca.toLowerCase().trim();
            enriquecidas = enriquecidas.filter(
              (item) =>
                item.produto_nome?.toLowerCase().includes(termo) ||
                item.produto_fabricante?.toLowerCase().includes(termo) ||
                item.solicitante_nome?.toLowerCase().includes(termo) ||
                item.observacao?.toLowerCase().includes(termo) ||
                item.produto_codigo_barras?.toLowerCase().includes(termo)
            );
          }

          const ordenadas = this.ordenarSolicitacoes(enriquecidas);
          const totalRegistros = typeof count === 'number' ? count : ordenadas.length;

          return {
            itens: ordenadas,
            totalRegistros,
            paginaAtual: pagina,
            totalPaginas: Math.max(1, Math.ceil(totalRegistros / limite)),
            limitePorPagina: limite,
          };
        } else if (error) {
          console.warn('Erro ao consultar compras paginadas no Supabase:', error.message);
        }
      } catch (err) {
        console.warn('Exceção ao listar compras paginadas:', err);
      }
    }

    // Fallback Local
    let locais = getLocalCompras().filter((item) => statusFiltro.includes(item.status));

    if (filtros?.unidade_negocio) {
      locais = locais.filter((item) =>
        itemMatchesUserUnit(item.unidade_negocio, filtros.unidade_negocio)
      );
    }

    if (filtros?.urgencia && filtros.urgencia !== 'Todos') {
      locais = locais.filter((item) => item.urgencia === filtros.urgencia);
    }

    if (filtros?.demanda && filtros.demanda !== 'Todos') {
      locais = locais.filter((item) => item.demanda === filtros.demanda);
    }

    if (filtros?.solicitanteId && filtros.solicitanteId !== 'Todos') {
      locais = locais.filter((item) => item.id_solicitante === filtros.solicitanteId);
    }

    if (filtros?.gestorAprovacaoId && filtros.gestorAprovacaoId !== 'Todos') {
      if (filtros.gestorAprovacaoId === 'pendente') {
        locais = locais.filter((item) => !item.id_usuario_aprovacao);
      } else {
        locais = locais.filter((item) => item.id_usuario_aprovacao === filtros.gestorAprovacaoId);
      }
    }

    if (filtros?.produtoId && filtros.produtoId !== 'Todos') {
      locais = locais.filter((item) => item.id_produto === filtros.produtoId);
    }

    if (filtros?.dataInicio) {
      locais = locais.filter((item) => item.data_insercao >= `${filtros.dataInicio}T00:00:00.000Z`);
    }

    if (filtros?.dataFim) {
      locais = locais.filter((item) => item.data_insercao <= `${filtros.dataFim}T23:59:59.999Z`);
    }

    let enriquecidas = await this.enriquecerSolicitacoes(locais);

    if (filtros?.fabricante && filtros.fabricante !== 'Todos') {
      enriquecidas = enriquecidas.filter(
        (item) => item.produto_fabricante?.toLowerCase() === filtros.fabricante?.toLowerCase()
      );
    }

    if (filtros?.termoBusca && filtros.termoBusca.trim()) {
      const termo = filtros.termoBusca.toLowerCase().trim();
      enriquecidas = enriquecidas.filter(
        (item) =>
          item.produto_nome?.toLowerCase().includes(termo) ||
          item.produto_fabricante?.toLowerCase().includes(termo) ||
          item.solicitante_nome?.toLowerCase().includes(termo) ||
          item.observacao?.toLowerCase().includes(termo) ||
          item.produto_codigo_barras?.toLowerCase().includes(termo)
      );
    }

    const ordenadas = this.ordenarSolicitacoes(enriquecidas);
    const totalRegistros = ordenadas.length;
    const paginados = ordenadas.slice(from, from + limite);

    return {
      itens: paginados,
      totalRegistros,
      paginaAtual: pagina,
      totalPaginas: Math.max(1, Math.ceil(totalRegistros / limite)),
      limitePorPagina: limite,
    };
  }

  /**
   * 6. ABA GERIR APROVADOS — Listar produtos com status 'Aprovado' (Sem Paginação)
   */
  async listarAprovados(unidadeNegocio?: string): Promise<SolicitacaoCompra[]> {
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('compras')
          .select(COMPRAS_COLUNAS_SELECT)
          .eq('status', 'Aprovado')
          .order('data_aprovacao', { ascending: false });

        if (unidadeNegocio) {
          query = query.in('unidade_negocio', getUnitEquivalents(unidadeNegocio));
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          return await this.enriquecerSolicitacoes(data as SolicitacaoCompra[]);
        }
      } catch (err) {
        console.warn('Erro ao listar aprovados no Supabase:', err);
      }
    }

    // Fallback local
    const locais = getLocalCompras().filter((item) => {
      const matchStatus = item.status === 'Aprovado';
      const matchUnit = !unidadeNegocio || itemMatchesUserUnit(item.unidade_negocio, unidadeNegocio);
      return matchStatus && matchUnit;
    });

    return await this.enriquecerSolicitacoes(locais);
  }

  /**
   * 7. ABA COMPRADOS — LISTAGEM E PAGINAÇÃO (50 por página sob demanda)
   */
  async listarCompradosPaginados(
    filtros?: FiltrosCompra,
    pagina = 1,
    limite = 50
  ): Promise<RespostaPaginadaCompras> {
    const supabase = getSupabase();
    const from = (pagina - 1) * limite;
    const to = from + limite - 1;

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('compras')
          .select(COMPRAS_COLUNAS_SELECT, { count: 'exact' })
          .eq('status', 'Comprado');

        if (filtros?.unidade_negocio) {
          query = query.in('unidade_negocio', getUnitEquivalents(filtros.unidade_negocio));
        }

        if (filtros?.solicitanteId && filtros.solicitanteId !== 'Todos') {
          query = query.eq('id_solicitante', filtros.solicitanteId);
        }

        if (filtros?.produtoId && filtros.produtoId !== 'Todos') {
          query = query.eq('id_produto', filtros.produtoId);
        }

        if (filtros?.dataInicio) {
          query = query.gte('data_insercao', `${filtros.dataInicio}T00:00:00.000Z`);
        }

        if (filtros?.dataFim) {
          query = query.lte('data_insercao', `${filtros.dataFim}T23:59:59.999Z`);
        }

        query = query.order('data_compra', { ascending: false }).range(from, to);

        const { data, count, error } = await query;

        if (!error && Array.isArray(data)) {
          let enriquecidas = await this.enriquecerSolicitacoes(data as SolicitacaoCompra[]);

          if (filtros?.fabricante && filtros.fabricante !== 'Todos') {
            enriquecidas = enriquecidas.filter(
              (item) => item.produto_fabricante?.toLowerCase() === filtros.fabricante?.toLowerCase()
            );
          }

          if (filtros?.termoBusca && filtros.termoBusca.trim()) {
            const termo = filtros.termoBusca.toLowerCase().trim();
            enriquecidas = enriquecidas.filter(
              (item) =>
                item.produto_nome?.toLowerCase().includes(termo) ||
                item.produto_fabricante?.toLowerCase().includes(termo) ||
                item.solicitante_nome?.toLowerCase().includes(termo) ||
                item.observacao?.toLowerCase().includes(termo)
            );
          }

          const totalRegistros = typeof count === 'number' ? count : enriquecidas.length;

          return {
            itens: enriquecidas,
            totalRegistros,
            paginaAtual: pagina,
            totalPaginas: Math.max(1, Math.ceil(totalRegistros / limite)),
            limitePorPagina: limite,
          };
        }
      } catch (err) {
        console.warn('Erro ao consultar comprados paginados no Supabase:', err);
      }
    }

    // Fallback local
    let locais = getLocalCompras().filter((item) => item.status === 'Comprado');

    if (filtros?.unidade_negocio) {
      locais = locais.filter((item) =>
        itemMatchesUserUnit(item.unidade_negocio, filtros.unidade_negocio)
      );
    }

    if (filtros?.solicitanteId && filtros.solicitanteId !== 'Todos') {
      locais = locais.filter((item) => item.id_solicitante === filtros.solicitanteId);
    }

    if (filtros?.produtoId && filtros.produtoId !== 'Todos') {
      locais = locais.filter((item) => item.id_produto === filtros.produtoId);
    }

    if (filtros?.dataInicio) {
      locais = locais.filter((item) => item.data_insercao >= `${filtros.dataInicio}T00:00:00.000Z`);
    }

    if (filtros?.dataFim) {
      locais = locais.filter((item) => item.data_insercao <= `${filtros.dataFim}T23:59:59.999Z`);
    }

    let enriquecidas = await this.enriquecerSolicitacoes(locais);

    if (filtros?.fabricante && filtros.fabricante !== 'Todos') {
      enriquecidas = enriquecidas.filter(
        (item) => item.produto_fabricante?.toLowerCase() === filtros.fabricante?.toLowerCase()
      );
    }

    if (filtros?.termoBusca && filtros.termoBusca.trim()) {
      const termo = filtros.termoBusca.toLowerCase().trim();
      enriquecidas = enriquecidas.filter(
        (item) =>
          item.produto_nome?.toLowerCase().includes(termo) ||
          item.produto_fabricante?.toLowerCase().includes(termo) ||
          item.solicitante_nome?.toLowerCase().includes(termo) ||
          item.observacao?.toLowerCase().includes(termo)
      );
    }

    enriquecidas.sort(
      (a, b) => new Date(b.data_compra || b.data_insercao).getTime() - new Date(a.data_compra || a.data_insercao).getTime()
    );

    const totalRegistros = enriquecidas.length;
    const paginados = enriquecidas.slice(from, from + limite);

    return {
      itens: paginados,
      totalRegistros,
      paginaAtual: pagina,
      totalPaginas: Math.max(1, Math.ceil(totalRegistros / limite)),
      limitePorPagina: limite,
    };
  }

  /**
   * 7.4. ABA COMPRADOS — Exportação Completa de Planilha
   * Recupera TODOS os registros correspondentes aos filtros ativos (não apenas 50 da página atual)
   */
  async listarTodosCompradosParaExportacao(filtros?: FiltrosCompra): Promise<SolicitacaoCompra[]> {
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('compras')
          .select(COMPRAS_COLUNAS_SELECT)
          .eq('status', 'Comprado')
          .order('data_compra', { ascending: false });

        if (filtros?.unidade_negocio) {
          query = query.in('unidade_negocio', getUnitEquivalents(filtros.unidade_negocio));
        }

        if (filtros?.solicitanteId && filtros.solicitanteId !== 'Todos') {
          query = query.eq('id_solicitante', filtros.solicitanteId);
        }

        if (filtros?.produtoId && filtros.produtoId !== 'Todos') {
          query = query.eq('id_produto', filtros.produtoId);
        }

        if (filtros?.dataInicio) {
          query = query.gte('data_insercao', `${filtros.dataInicio}T00:00:00.000Z`);
        }

        if (filtros?.dataFim) {
          query = query.lte('data_insercao', `${filtros.dataFim}T23:59:59.999Z`);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          let enriquecidas = await this.enriquecerSolicitacoes(data as SolicitacaoCompra[]);

          if (filtros?.fabricante && filtros.fabricante !== 'Todos') {
            enriquecidas = enriquecidas.filter(
              (item) => item.produto_fabricante?.toLowerCase() === filtros.fabricante?.toLowerCase()
            );
          }

          if (filtros?.termoBusca && filtros.termoBusca.trim()) {
            const termo = filtros.termoBusca.toLowerCase().trim();
            enriquecidas = enriquecidas.filter(
              (item) =>
                item.produto_nome?.toLowerCase().includes(termo) ||
                item.produto_fabricante?.toLowerCase().includes(termo) ||
                item.solicitante_nome?.toLowerCase().includes(termo) ||
                item.observacao?.toLowerCase().includes(termo)
            );
          }

          return enriquecidas;
        }
      } catch (err) {
        console.warn('Erro ao exportar compras no Supabase:', err);
      }
    }

    // Fallback local
    const res = await this.listarCompradosPaginados(filtros, 1, 5000);
    return res.itens;
  }

  /**
   * Validação automática: verifica se já existe uma solicitação do mesmo produto com status 'Solicitado' ou 'Aprovado'
   */
  async verificarSolicitacaoExistente(
    idProduto: string,
    unidadeNegocio?: string
  ): Promise<SolicitacaoCompra | null> {
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('compras')
          .select(COMPRAS_COLUNAS_SELECT)
          .eq('id_produto', idProduto)
          .in('status', ['Solicitado', 'Aprovado'])
          .order('data_insercao', { ascending: false })
          .limit(1);

        if (unidadeNegocio) {
          query = query.in('unidade_negocio', getUnitEquivalents(unidadeNegocio));
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const [enriquecida] = await this.enriquecerSolicitacoes([data[0] as SolicitacaoCompra]);
          return enriquecida || (data[0] as SolicitacaoCompra);
        }
      } catch (err) {
        console.warn('Erro ao verificar duplicidade no Supabase:', err);
      }
    }

    // Fallback local
    const locais = getLocalCompras();
    const existente = locais.find((item) => {
      const matchStatus = item.status === 'Solicitado' || item.status === 'Aprovado';
      const matchProd = item.id_produto === idProduto;
      const matchUnit = !unidadeNegocio || itemMatchesUserUnit(item.unidade_negocio, unidadeNegocio);
      return matchStatus && matchProd && matchUnit;
    });

    if (existente) {
      const [enriquecida] = await this.enriquecerSolicitacoes([existente]);
      return enriquecida || existente;
    }

    return null;
  }

  /**
   * 5. REGISTRAR NOVA SOLICITAÇÃO DE COMPRA
   */
  async criarSolicitacao(dados: {
    id_produto: string;
    quantidade: number;
    demanda: DemandaCompra;
    urgencia: UrgenciaCompra;
    id_solicitante: string;
    observacao?: string | null;
    unidade_negocio: string;
  }): Promise<SolicitacaoCompra> {
    const qtdNum = Number(dados.quantidade);
    if (!dados.quantidade || isNaN(qtdNum) || qtdNum <= 0 || !Number.isInteger(qtdNum)) {
      throw new Error('A quantidade solicitada é obrigatória e deve ser um número inteiro positivo.');
    }

    if (!dados.demanda || !['Estoque', 'Sob Encomenda', 'Consumos'].includes(dados.demanda)) {
      throw new Error('O tipo de demanda é obrigatório. Selecione Estoque, Sob Encomenda ou Consumos.');
    }

    if (!dados.urgencia || !['Média', 'Rápida', 'Urgente'].includes(dados.urgencia)) {
      throw new Error('O nível de urgência é obrigatório. Selecione Média, Rápida ou Urgente.');
    }

    const novaSolicitacao: SolicitacaoCompra = {
      id: crypto.randomUUID ? crypto.randomUUID() : `comp-${Date.now()}`,
      data_insercao: new Date().toISOString(),
      id_produto: dados.id_produto,
      quantidade: qtdNum,
      quantidade_aprovada: null,
      demanda: dados.demanda,
      urgencia: dados.urgencia,
      id_solicitante: dados.id_solicitante,
      status: 'Solicitado',
      id_usuario_aprovacao: null,
      data_aprovacao: null,
      id_usuario_compra: null,
      data_compra: null,
      observacao: dados.observacao?.trim() || null,
      unidade_negocio: dados.unidade_negocio || 'Goiânia',
    };

    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('compras')
          .insert({
            id: novaSolicitacao.id,
            data_insercao: novaSolicitacao.data_insercao,
            id_produto: novaSolicitacao.id_produto,
            quantidade: novaSolicitacao.quantidade,
            demanda: novaSolicitacao.demanda,
            urgencia: novaSolicitacao.urgencia,
            id_solicitante: novaSolicitacao.id_solicitante,
            status: novaSolicitacao.status,
            id_usuario_aprovacao: null,
            data_aprovacao: null,
            observacao: novaSolicitacao.observacao,
            unidade_negocio: novaSolicitacao.unidade_negocio,
          })
          .select('id')
          .single();

        if (!error && data) {
          novaSolicitacao.id = data.id;
        } else if (error) {
          console.warn('Aviso ao inserir no Supabase compras, salvando local:', error.message);
        }
      } catch (err) {
        console.warn('Exceção ao inserir compra no Supabase:', err);
      }
    }

    const locais = getLocalCompras();
    locais.unshift(novaSolicitacao);
    saveLocalCompras(locais);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('polihub_badges_refresh'));
    }

    const [enriquecida] = await this.enriquecerSolicitacoes([novaSolicitacao]);
    return enriquecida || novaSolicitacao;
  }

  /**
   * 3. EDIÇÃO DAS PRÓPRIAS SOLICITAÇÕES
   * - Cada usuário pode editar somente as próprias solicitações
   * - A solicitação deve estar com status 'Solicitado'
   * - Preserva o solicitante original e mantém o status 'Solicitado'
   */
  async editarSolicitacao(
    id: string,
    idUsuario: string,
    dados: {
      id_produto: string;
      quantidade: number;
      demanda: DemandaCompra;
      urgencia: UrgenciaCompra;
      observacao?: string | null;
    }
  ): Promise<SolicitacaoCompra> {
    const qtdNum = Number(dados.quantidade);
    if (!dados.quantidade || isNaN(qtdNum) || qtdNum <= 0 || !Number.isInteger(qtdNum)) {
      throw new Error('A quantidade informada deve ser um número inteiro positivo.');
    }

    if (!dados.demanda || !['Estoque', 'Sob Encomenda', 'Consumos'].includes(dados.demanda)) {
      throw new Error('O tipo de demanda é obrigatório. Selecione Estoque, Sob Encomenda ou Consumos.');
    }

    if (!dados.urgencia || !['Média', 'Rápida', 'Urgente'].includes(dados.urgencia)) {
      throw new Error('O nível de urgência é obrigatório. Selecione Média, Rápida ou Urgente.');
    }

    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      // 1. Validar posse e status antes da alteração
      const { data: existente, error: errBusca } = await supabase
        .from('compras')
        .select('id, id_solicitante, status, demanda, urgencia')
        .eq('id', id)
        .single();

      if (errBusca || !existente) {
        throw new Error('Solicitação não encontrada no banco de dados.');
      }

      if (existente.id_solicitante !== idUsuario) {
        throw new Error('Permissão negada: você só pode editar suas próprias solicitações.');
      }

      if (existente.status !== 'Solicitado') {
        throw new Error(`Esta solicitação já está ${existente.status} e não pode mais ser editada.`);
      }

      // 2. Executar atualização protegida
      const { error: errUpdate } = await supabase
        .from('compras')
        .update({
          id_produto: dados.id_produto,
          quantidade: qtdNum,
          demanda: dados.demanda,
          urgencia: dados.urgencia,
          observacao: dados.observacao?.trim() || null,
        })
        .eq('id', id)
        .eq('id_solicitante', idUsuario)
        .eq('status', 'Solicitado');

      if (errUpdate) {
        console.warn('Erro ao atualizar solicitação no Supabase:', errUpdate.message);
      }
    }

    // Atualiza local
    const locais = getLocalCompras();
    const index = locais.findIndex((c) => c.id === id);
    if (index !== -1) {
      if (locais[index].id_solicitante !== idUsuario) {
        throw new Error('Permissão negada: você só pode editar suas próprias solicitações.');
      }
      if (locais[index].status !== 'Solicitado') {
        throw new Error(`Esta solicitação já está ${locais[index].status} e não pode ser editada.`);
      }

      locais[index] = {
        ...locais[index],
        id_produto: dados.id_produto,
        quantidade: qtdNum,
        demanda: dados.demanda,
        urgencia: dados.urgencia,
        observacao: dados.observacao?.trim() || null,
      };
      saveLocalCompras(locais);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('polihub_badges_refresh'));
    }

    const atualizada = locais[index] || ({ id } as SolicitacaoCompra);
    const [enriquecida] = await this.enriquecerSolicitacoes([atualizada]);
    return enriquecida || atualizada;
  }

  /**
   * 2.3. APROVAÇÃO OU RECUSA PELO GESTOR (MODAL DE APROVAÇÃO)
   * - Permite aprovar com quantidade original ou ajustada
   * - Permite recusar a solicitação
   * - Preserva a quantidade solicitada original e registra o gestor e data
   */
  async aprovarOuRecusarSolicitacao(dados: {
    id: string;
    idGestor: string;
    decisao: 'Aprovado' | 'Recusado';
    quantidadeAprovada?: number;
    motivoRecusa?: string;
  }): Promise<SolicitacaoCompra> {
    const agora = new Date().toISOString();
    const supabase = getSupabase();

    let qtdAprovadaFinal: number | null = null;
    if (dados.decisao === 'Aprovado') {
      const q = Number(dados.quantidadeAprovada);
      if (!dados.quantidadeAprovada || isNaN(q) || q <= 0 || !Number.isInteger(q)) {
        throw new Error('A quantidade aprovada deve ser um número inteiro positivo.');
      }
      qtdAprovadaFinal = q;
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const payload: Record<string, any> = {
          status: dados.decisao,
          id_usuario_aprovacao: dados.idGestor,
          data_aprovacao: agora,
        };

        if (dados.decisao === 'Aprovado') {
          payload.quantidade_aprovada = qtdAprovadaFinal;
        }

        const { error } = await supabase
          .from('compras')
          .update(payload)
          .eq('id', dados.id)
          .eq('status', 'Solicitado'); // Garante que apenas solicitações pendentes sejam decididas

        if (error) {
          console.warn('Erro ao atualizar decisão no Supabase:', error.message);
        }
      } catch (err) {
        console.warn('Exceção ao aprovar/recusar compra no Supabase:', err);
      }
    }

    // Atualiza local
    const locais = getLocalCompras();
    const index = locais.findIndex((c) => c.id === dados.id);
    if (index !== -1) {
      locais[index] = {
        ...locais[index],
        status: dados.decisao,
        quantidade_aprovada: qtdAprovadaFinal,
        id_usuario_aprovacao: dados.idGestor,
        data_aprovacao: agora,
      };
      saveLocalCompras(locais);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('polihub_badges_refresh'));
    }

    const atualizada = locais[index] || ({ id: dados.id } as SolicitacaoCompra);
    const [enriquecida] = await this.enriquecerSolicitacoes([atualizada]);
    return enriquecida || atualizada;
  }

  /**
   * 6.2. MARCAR COMPRADOS EM LOTE (Aba Gerir Aprovados)
   * Atualiza para 'Comprado' SOMENTE os itens selecionados que ainda estejam com status 'Aprovado'.
   */
  async marcarCompradosEmLote(
    ids: string[],
    idUsuario: string
  ): Promise<{ processados: string[]; falhas: string[] }> {
    if (ids.length === 0) return { processados: [], falhas: [] };

    const agora = new Date().toISOString();
    const supabase = getSupabase();
    const processados: string[] = [];
    const falhas: string[] = [];

    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Consulta o estado atual de cada item selecionado para não sobrescrever caso tenha mudado
        const { data: itens, error: errConsulta } = await supabase
          .from('compras')
          .select('id, status')
          .in('id', ids);

        if (!errConsulta && Array.isArray(itens)) {
          const idsValidos = itens.filter((i) => i.status === 'Aprovado').map((i) => i.id);
          const idsInvalidos = itens.filter((i) => i.status !== 'Aprovado').map((i) => i.id);

          falhas.push(...idsInvalidos);

          if (idsValidos.length > 0) {
            const { error: errUpdate } = await supabase
              .from('compras')
              .update({
                status: 'Comprado',
                id_usuario_compra: idUsuario,
                data_compra: agora,
              })
              .in('id', idsValidos)
              .eq('status', 'Aprovado');

            if (!errUpdate) {
              processados.push(...idsValidos);
            }
          }
        }
      } catch (err) {
        console.warn('Exceção ao marcar comprados em lote no Supabase:', err);
      }
    }

    // Atualiza storage local
    const locais = getLocalCompras();
    ids.forEach((id) => {
      const idx = locais.findIndex((c) => c.id === id);
      if (idx !== -1) {
        if (locais[idx].status === 'Aprovado') {
          locais[idx].status = 'Comprado';
          locais[idx].id_usuario_compra = idUsuario;
          locais[idx].data_compra = agora;
          if (!processados.includes(id)) processados.push(id);
        } else {
          if (!falhas.includes(id)) falhas.push(id);
        }
      }
    });
    saveLocalCompras(locais);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('polihub_badges_refresh'));
    }

    return { processados, falhas };
  }

  /**
   * Obter solicitação única por ID
   */
  async obterPorId(id: string): Promise<SolicitacaoCompra | null> {
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('compras')
          .select(COMPRAS_COLUNAS_SELECT)
          .eq('id', id)
          .single();
        if (!error && data) {
          const [enriquecida] = await this.enriquecerSolicitacoes([data as SolicitacaoCompra]);
          return enriquecida || data;
        }
      } catch (err) {
        console.warn('Erro ao obter compra por ID:', err);
      }
    }

    const local = getLocalCompras().find((c) => c.id === id);
    if (!local) return null;
    const [enriquecida] = await this.enriquecerSolicitacoes([local]);
    return enriquecida || local;
  }

  /**
   * Marcar uma solicitação individual como Comprado
   */
  async marcarComoComprado(id: string, idUsuario: string): Promise<SolicitacaoCompra> {
    await this.marcarCompradosEmLote([id], idUsuario);
    const item = await this.obterPorId(id);
    return item || ({ id, status: 'Comprado' } as SolicitacaoCompra);
  }

  /**
   * Aprovação rápida mantendo a quantidade original
   */
  async aprovarSolicitacao(id: string, idGestor: string): Promise<SolicitacaoCompra> {
    const item = await this.obterPorId(id);
    return this.aprovarOuRecusarSolicitacao({
      id,
      idGestor,
      decisao: 'Aprovado',
      quantidadeAprovada: item?.quantidade || 1,
    });
  }

  /**
   * Cancelar ou Excluir Solicitação
   */
  async excluirSolicitacao(id: string): Promise<void> {
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('compras').delete().eq('id', id);
      } catch (err) {
        console.warn('Exceção ao excluir solicitação no Supabase:', err);
      }
    }

    const locais = getLocalCompras().filter((c) => c.id !== id);
    saveLocalCompras(locais);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('polihub_badges_refresh'));
    }
  }

  /**
   * Quantidade de solicitações no status 'Solicitado' para o badge do menu
   */
  async obterTotalSolicitados(unidadeNegocio?: string): Promise<number> {
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('compras')
          .select('id', { count: 'exact', head: true })
          .in('status', ['Solicitado', 'solicitado']);

        if (unidadeNegocio) {
          const equivs = getUnitEquivalents(unidadeNegocio);
          query = query.or(`unidade_negocio.in.(${equivs.join(',')}),unidade_negocio.is.null`);
        }

        const { count, error } = await query;
        if (!error && typeof count === 'number') {
          return count;
        }
        if (error) {
          console.warn('Erro ao consultar contagem de compras no Supabase, usando local:', error.message);
        }
      } catch (err) {
        console.warn('Erro ao buscar contagem de compras no Supabase:', err);
      }
    }

    const locais = getLocalCompras();
    return locais.filter((c) => {
      const st = (c.status || '').toLowerCase().trim();
      const matchStatus = st === 'solicitado';
      const matchUnit =
        !unidadeNegocio || !c.unidade_negocio || itemMatchesUserUnit(c.unidade_negocio, unidadeNegocio);
      return matchStatus && matchUnit;
    }).length;
  }

  /**
   * Métricas para aba de gráficos
   */
  async obterMetricas(unidadeNegocio?: string, dias = 30): Promise<MetricasCompras> {
    // Busca dados consolidados
    let todas: SolicitacaoCompra[] = [];
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        let q = supabase.from('compras').select(COMPRAS_COLUNAS_SELECT);
        if (unidadeNegocio) {
          q = q.in('unidade_negocio', getUnitEquivalents(unidadeNegocio));
        }
        const { data, error } = await q;
        if (!error && Array.isArray(data)) {
          todas = await this.enriquecerSolicitacoes(data as SolicitacaoCompra[]);
        }
      } catch (e) {
        console.warn('Erro ao carregar metricas do Supabase:', e);
      }
    }

    if (todas.length === 0) {
      todas = await this.enriquecerSolicitacoes(getLocalCompras());
    }

    const dataLimite = dias > 0 ? new Date(Date.now() - dias * 86400000).toISOString() : null;
    const filtradas = dataLimite ? todas.filter((s) => s.data_insercao >= dataLimite) : todas;

    let total = filtradas.length;
    let solicitados = 0;
    let aprovados = 0;
    let comprados = 0;
    let urgentes = 0;
    let rapidas = 0;
    let medias = 0;
    let totalItensQuantidade = 0;

    const demandas = {
      estoque: 0,
      sobEncomenda: 0,
      consumos: 0,
      necessidade: 0,
      compras: 0,
    };

    const fabricantesMap = new Map<string, { quantidade: number; totalSolicitacoes: number }>();
    const produtosMap = new Map<string, { produto: string; fabricante: string; totalSolicitacoes: number; quantidadeTotal: number }>();

    for (const item of filtradas) {
      totalItensQuantidade += item.quantidade || 0;

      if (item.status === 'Solicitado') solicitados++;
      else if (item.status === 'Aprovado') aprovados++;
      else if (item.status === 'Comprado') comprados++;

      if (item.urgencia === 'Urgente') urgentes++;
      else if (item.urgencia === 'Rápida') rapidas++;
      else if (item.urgencia === 'Média') medias++;

      if (item.demanda === 'Estoque') {
        demandas.estoque++;
      } else if (item.demanda === 'Sob Encomenda' || item.demanda === 'Necessidade') {
        demandas.sobEncomenda++;
        if (item.demanda === 'Necessidade') demandas.necessidade++;
      } else if (item.demanda === 'Consumos' || item.demanda === 'Compras') {
        demandas.consumos++;
        if (item.demanda === 'Compras') demandas.compras++;
      }

      const fab = item.produto_fabricante || 'Outros';
      const fabData = fabricantesMap.get(fab) || { quantidade: 0, totalSolicitacoes: 0 };
      fabData.quantidade += item.quantidade || 0;
      fabData.totalSolicitacoes += 1;
      fabricantesMap.set(fab, fabData);

      const prodNome = item.produto_nome || 'Produto';
      const prodData = produtosMap.get(item.id_produto) || {
        produto: prodNome,
        fabricante: fab,
        totalSolicitacoes: 0,
        quantidadeTotal: 0,
      };
      prodData.totalSolicitacoes += 1;
      prodData.quantidadeTotal += item.quantidade || 0;
      produtosMap.set(item.id_produto, prodData);
    }

    const topFabricantes = Array.from(fabricantesMap.entries())
      .map(([fabricante, data]) => ({
        fabricante,
        quantidade: data.quantidade,
        totalSolicitacoes: data.totalSolicitacoes,
      }))
      .sort((a, b) => b.totalSolicitacoes - a.totalSolicitacoes)
      .slice(0, 6);

    const topProdutos = Array.from(produtosMap.values())
      .sort((a, b) => b.quantidadeTotal - a.quantidadeTotal)
      .slice(0, 6);

    return {
      total,
      solicitados,
      aprovados,
      comprados,
      urgentes,
      rapidas,
      medias,
      porDemanda: demandas,
      totalItensQuantidade,
      topFabricantes,
      topProdutos,
    };
  }
}

export const comprasService = new ComprasService();
