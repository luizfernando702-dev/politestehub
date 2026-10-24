/**
 * POLIHUB — MÓDULO AUDITORIA DE PRODUTOS
 * Consulta unificada e otimizada do histórico de movimentações nos últimos 30 dias (ou período)
 * através das tabelas operacionais existentes:
 * - public.recebimentos_produtos (Recebimento, Conferência e Alocação)
 * - public.alteracoes_endereco (Trocas e alterações de endereço)
 * - public.inventario (Contagens físicas e correções de contagem)
 *
 * POLÍTICA DE PERFORMANCE SUPABASE:
 * - NUNCA SELECT *
 * - Apenas colunas estritamente necessárias
 * - Sem criação de tabelas de histórico ou duplicação de dados
 * - Isolamento estrito por Unidade de Negócio e RLS
 */

import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import {
  EventoAuditoria,
  PeriodoFiltro,
  Produto,
  ResumoAuditoriaProduto,
  Usuario,
} from '../types';
import {
  getLocalAlteracoesEndereco,
  getLocalProdutos,
  getLocalRecebimentosProdutos,
  getLocalTabelaInventario,
  getLocalUsuarios,
} from './mockStorage';
import { usuariosService } from './usuariosService';
import { getActiveUserUnit, itemMatchesUserUnit, getUnitEquivalents } from './sessionHelper';

// Colunas estritas selecionadas em cada consulta (NUNCA SELECT *)
const CAMPOS_PRODUTOS_BUSCA = 'id, produto, fabricante, endereco, codigo_barras';

const CAMPOS_AUDITORIA_RECEBIMENTO =
  'id, unidade_negocio, agendamento_id, data_recebimento, nota_fiscal, produto, endereco, quantidade, saldo_final, qtd_conferida, conferente_id, status, data_conferencia, repositor_id, data_alocacao, novo_endereco, created_at';

const CAMPOS_AUDITORIA_ALTERACOES =
  'id, unidade_negocio, data, produto, endereco_antigo, endereco_novo, tipo_alteracao, usuario_alteracao, alterado_sistema, usuario_confirmacao, data_confirmacao, created_at';

const CAMPOS_AUDITORIA_ALTERACOES_FALLBACK =
  'id, data, produto, endereco_antigo, endereco_novo, tipo_alteracao, usuario_alteracao, alterado_sistema, created_at';

const CAMPOS_AUDITORIA_INVENTARIO =
  'id, unidade_negocio, produto, endereco, qtd_contada, qtd_disponivel, qtd_atual, qtd_reservada, peso_total, usuario_id, data_contagem, usuario_correcao, data_correcao, corrigido';

/**
 * Normaliza datas para comparação de início e fim no formato ISO
 */
export function normalizarIntervaloDatas(periodo: PeriodoFiltro): { inicioIso: string; fimIso: string; dataInicioYmd: string; dataFimYmd: string } {
  const dataInicioYmd = periodo.dataInicio;
  const dataFimYmd = periodo.dataFim;

  const inicioIso = new Date(`${dataInicioYmd}T00:00:00.000Z`).toISOString();
  const fimIso = new Date(`${dataFimYmd}T23:59:59.999Z`).toISOString();

  return { inicioIso, fimIso, dataInicioYmd, dataFimYmd };
}

/**
 * Cria configuração padrão de período
 */
export function criarPeriodoPadrao(
  tipo: '7d' | '15d' | '30d' | 'personalizado' = '30d',
  customInicio?: string,
  customFim?: string
): PeriodoFiltro {
  const hoje = new Date();
  const fimYmd = hoje.toISOString().slice(0, 10);

  let dias = 30;
  let rotulo = 'Últimos 30 dias';

  if (tipo === '7d') {
    dias = 7;
    rotulo = 'Últimos 7 dias';
  } else if (tipo === '15d') {
    dias = 15;
    rotulo = 'Últimos 15 dias';
  } else if (tipo === 'personalizado' && customInicio && customFim) {
    return {
      tipo: 'personalizado',
      dataInicio: customInicio,
      dataFim: customFim,
      rotulo: `Personalizado (${customInicio.split('-').reverse().join('/')} a ${customFim.split('-').reverse().join('/')})`,
    };
  }

  const dataPassada = new Date(hoje.getTime() - dias * 24 * 60 * 60 * 1000);
  const inicioYmd = dataPassada.toISOString().slice(0, 10);

  return {
    tipo,
    dataInicio: inicioYmd,
    dataFim: fimYmd,
    rotulo,
  };
}

/**
 * Extrai termos chave de busca para o produto (com código, sem código e código de barras)
 * garantindo correspondência mesmo se o produto estiver cadastrado com sufixos ou prefixos distintos
 */
export function extrairTermosBuscaProduto(produto: Produto): string[] {
  const termos: string[] = [];
  const nomeOriginal = produto.produto?.trim();
  if (nomeOriginal) {
    termos.push(nomeOriginal);
    // Remove prefixos como "POLI-4001 - " ou "4001 - "
    const semPrefixo = nomeOriginal.replace(/^[a-zA-Z0-9_-]+\s*[-–]\s*/, '').trim();
    if (semPrefixo && semPrefixo !== nomeOriginal && semPrefixo.length >= 3) {
      termos.push(semPrefixo);
    }
    // Palavras principais se o nome for longo
    const palavras = (semPrefixo || nomeOriginal).split(/\s+/).filter((p) => p.length > 2);
    if (palavras.length >= 2) {
      termos.push(palavras.slice(0, 3).join(' '));
    }
  }
  if (produto.codigo_barras && produto.codigo_barras.trim().length >= 3) {
    termos.push(produto.codigo_barras.trim());
  }
  return Array.from(new Set(termos));
}

/**
 * Verifica se um termo de busca do banco de dados bate com um produto alvo
 * Suporta correspondência direta, reversa, remoção de prefixos e código de barras
 */
function correspondeAoProduto(textoBanco: string | null | undefined, produtoAlvo: Produto): boolean {
  if (!textoBanco) return false;
  const limpoBanco = textoBanco.toLowerCase().trim();
  const nomeAlvo = produtoAlvo.produto.toLowerCase().trim();

  // 1. Correspondência direta ou substring bidirecional
  if (limpoBanco === nomeAlvo || limpoBanco.includes(nomeAlvo) || nomeAlvo.includes(limpoBanco)) {
    return true;
  }

  // 2. Remove prefixos de código em ambos (ex: "POLI-4001 - ", "1042 - ")
  const limpoBancoSemPrefixo = limpoBanco.replace(/^[a-z0-9_-]+\s*[-–]\s*/i, '').trim();
  const nomeAlvoSemPrefixo = nomeAlvo.replace(/^[a-z0-9_-]+\s*[-–]\s*/i, '').trim();

  if (
    limpoBancoSemPrefixo.length >= 3 &&
    (limpoBancoSemPrefixo === nomeAlvoSemPrefixo ||
      limpoBancoSemPrefixo.includes(nomeAlvoSemPrefixo) ||
      nomeAlvoSemPrefixo.includes(limpoBancoSemPrefixo))
  ) {
    return true;
  }

  // 3. Correspondência por código de barras
  if (produtoAlvo.codigo_barras && produtoAlvo.codigo_barras.trim()) {
    const cod = produtoAlvo.codigo_barras.toLowerCase().trim();
    if (limpoBanco.includes(cod)) {
      return true;
    }
  }

  // 4. Se a maioria das palavras chave do produto alvo estão no banco
  const palavras = nomeAlvoSemPrefixo.split(/\s+/).filter((p) => p.length > 2);
  if (palavras.length >= 2) {
    const encontradas = palavras.filter((p) => limpoBanco.includes(p));
    if (encontradas.length / palavras.length >= 0.7) {
      return true;
    }
  }

  return false;
}

export const auditoriaService = {
  /**
   * 1. Pesquisa de produtos com limitação de resultados.
   * Exige ao menos 3 caracteres digitados.
   * Não realiza consultas de movimentações nesta etapa.
   */
  async pesquisarProdutos(termo: string): Promise<Produto[]> {
    const q = termo?.trim();
    if (!q || q.length < 3) {
      return [];
    }

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('produtos')
          .select(CAMPOS_PRODUTOS_BUSCA)
          .or(`produto.ilike.%${q}%,codigo_barras.ilike.%${q}%,fabricante.ilike.%${q}%`)
          .order('produto', { ascending: true })
          .limit(10);

        if (!error && data) {
          return data as Produto[];
        }
        if (error) {
          console.warn('Erro ao pesquisar produtos no Supabase, usando local:', error.message);
        }
      } catch (err) {
        console.warn('Exceção ao pesquisar produtos no Supabase:', err);
      }
    }

    // Fallback local
    const locais = getLocalProdutos();
    const qLower = q.toLowerCase();
    return locais
      .filter(
        (p) =>
          p.produto.toLowerCase().includes(qLower) ||
          (p.codigo_barras && p.codigo_barras.toLowerCase().includes(qLower)) ||
          (p.fabricante && p.fabricante.toLowerCase().includes(qLower))
      )
      .slice(0, 10);
  },

  /**
   * 2. Consulta unificada de todas as movimentações do produto nos últimos 30 dias (ou período informado).
   * Consulta diretamente as 3 tabelas operacionais existentes em paralelo, filtrando por data e unidade de negócio.
   */
  async consultarMovimentacoesProduto(params: {
    produto: Produto;
    periodo: PeriodoFiltro;
    unidadeNegocio: string;
  }): Promise<ResumoAuditoriaProduto> {
    const { produto, periodo, unidadeNegocio } = params;
    const activeUnit = unidadeNegocio || getActiveUserUnit() || 'Goiânia';
    const { inicioIso, fimIso, dataInicioYmd, dataFimYmd } = normalizarIntervaloDatas(periodo);

    // Carrega usuários para resolver colaboradores de forma amigável
    let mapaUsuarios = new Map<string, { nome: string; codigo?: string }>();
    try {
      const usuarios = await usuariosService.listarTodos();
      if (usuarios && usuarios.length > 0) {
        usuarios.forEach((u) => {
          mapaUsuarios.set(u.id, { nome: u.nome, codigo: u.codigo });
          if (u.codigo) {
            mapaUsuarios.set(u.codigo.toUpperCase(), { nome: u.nome, codigo: u.codigo });
          }
        });
      }
    } catch {
      const locais = getLocalUsuarios();
      locais.forEach((u) => {
        mapaUsuarios.set(u.id, { nome: u.nome, codigo: u.codigo });
        if (u.codigo) {
          mapaUsuarios.set(u.codigo.toUpperCase(), { nome: u.nome, codigo: u.codigo });
        }
      });
    }

    const resolverUsuario = (idOuCodigo?: string | null): { nome: string; codigo?: string } => {
      if (!idOuCodigo) return { nome: 'Não informado' };
      const achado = mapaUsuarios.get(idOuCodigo) || mapaUsuarios.get(idOuCodigo.toUpperCase());
      if (achado) return achado;

      // Tratamento para operadores padrões conhecidos
      if (idOuCodigo === 'usr-default-01' || idOuCodigo === 'OP-1042') {
        return { nome: 'Luiz Fernando', codigo: 'OP-1042' };
      }
      if (idOuCodigo === 'usr-default-02' || idOuCodigo === 'GS-2005') {
        return { nome: 'Mariana Silva (Gestora)', codigo: 'GS-2005' };
      }

      return { nome: 'Colaborador Responsável' };
    };

    const supabase = getSupabase();
    let eventosRecebimento: EventoAuditoria[] = [];
    let eventosAlteracao: EventoAuditoria[] = [];
    let eventosInventario: EventoAuditoria[] = [];

    // Termos chave de busca para o produto (com código, sem código e código de barras)
    const termosBusca = extrairTermosBuscaProduto(produto);
    const orClausulaProduto = termosBusca.map((t) => `produto.ilike.%${t}%`).join(',');

    if (isSupabaseConfigured && supabase) {
      try {
        // EXECUÇÃO PARALELA DAS CONSULTAS COM FILTROS NO BANCO (NUNCA SELECT *)
        const [resRecebimentos, resAlteracoes, resInventario] = await Promise.all([
          // 1. Recebimentos, Conferências e Alocações
          supabase
            .from('recebimentos_produtos')
            .select(CAMPOS_AUDITORIA_RECEBIMENTO)
            .or(orClausulaProduto)
            .in('unidade_negocio', getUnitEquivalents(activeUnit)),

          // 2. Alterações de Endereço (Suporta colunas novas, legadas, alterações avulsas e pendentes)
          (async () => {
            try {
              let res: any = await supabase
                .from('alteracoes_endereco')
                .select(CAMPOS_AUDITORIA_ALTERACOES)
                .or(orClausulaProduto);

              if (res.error && (res.error.message.includes('unidade_negocio') || res.error.code === '42703')) {
                res = await supabase
                  .from('alteracoes_endereco')
                  .select(CAMPOS_AUDITORIA_ALTERACOES_FALLBACK)
                  .or(orClausulaProduto);
              }
              return res;
            } catch (err: any) {
              return { data: null, error: err };
            }
          })(),

          // 3. Inventário (Contagens e Correções)
          supabase
            .from('inventario')
            .select(CAMPOS_AUDITORIA_INVENTARIO)
            .or(orClausulaProduto)
            .in('unidade_negocio', getUnitEquivalents(activeUnit)),
        ]);

        // Processa recebimentos_produtos
        if (!resRecebimentos.error && resRecebimentos.data) {
          eventosRecebimento = processarEventosRecebimento(
            resRecebimentos.data,
            produto,
            inicioIso,
            fimIso,
            dataInicioYmd,
            dataFimYmd,
            resolverUsuario
          );
        } else if (resRecebimentos.error) {
          console.warn('Erro ao consultar recebimentos_produtos no Supabase, usando local:', resRecebimentos.error.message);
          eventosRecebimento = processarEventosRecebimento(
            getLocalRecebimentosProdutos().filter((r) => itemMatchesUserUnit(r.unidade_negocio, activeUnit)),
            produto,
            inicioIso,
            fimIso,
            dataInicioYmd,
            dataFimYmd,
            resolverUsuario
          );
        }

        // Processa alteracoes_endereco (inclui avulsas e pendentes de forma segura)
        if (!resAlteracoes.error && resAlteracoes.data) {
          eventosAlteracao = processarEventosAlteracao(
            resAlteracoes.data,
            produto,
            resolverUsuario,
            inicioIso,
            fimIso,
            activeUnit
          );
        } else if (resAlteracoes.error) {
          console.warn('Erro ao consultar alteracoes_endereco no Supabase, usando local:', resAlteracoes.error.message);
          eventosAlteracao = processarEventosAlteracao(
            getLocalAlteracoesEndereco(),
            produto,
            resolverUsuario,
            inicioIso,
            fimIso,
            activeUnit
          );
        }

        // Processa inventario
        if (!resInventario.error && resInventario.data) {
          eventosInventario = processarEventosInventario(
            resInventario.data,
            produto,
            inicioIso,
            fimIso,
            resolverUsuario
          );
        } else if (resInventario.error) {
          console.warn('Erro ao consultar inventario no Supabase, usando local:', resInventario.error.message);
          eventosInventario = processarEventosInventario(
            getLocalTabelaInventario().filter((i) => itemMatchesUserUnit(i.unidade_negocio, activeUnit)),
            produto,
            inicioIso,
            fimIso,
            resolverUsuario
          );
        }
      } catch (err) {
        console.warn('Falha nas consultas paralelas do Supabase, aplicando fallback local:', err);
        // Fallback completo local
        eventosRecebimento = processarEventosRecebimento(
          getLocalRecebimentosProdutos().filter((r) => itemMatchesUserUnit(r.unidade_negocio, activeUnit)),
          produto,
          inicioIso,
          fimIso,
          dataInicioYmd,
          dataFimYmd,
          resolverUsuario
        );
        eventosAlteracao = processarEventosAlteracao(
          getLocalAlteracoesEndereco(),
          produto,
          resolverUsuario,
          inicioIso,
          fimIso,
          activeUnit
        );
        eventosInventario = processarEventosInventario(
          getLocalTabelaInventario().filter((i) => itemMatchesUserUnit(i.unidade_negocio, activeUnit)),
          produto,
          inicioIso,
          fimIso,
          resolverUsuario
        );
      }
    } else {
      // Modo Demonstração / Local
      eventosRecebimento = processarEventosRecebimento(
        getLocalRecebimentosProdutos().filter((r) => itemMatchesUserUnit(r.unidade_negocio, activeUnit)),
        produto,
        inicioIso,
        fimIso,
        dataInicioYmd,
        dataFimYmd,
        resolverUsuario
      );
      eventosAlteracao = processarEventosAlteracao(
        getLocalAlteracoesEndereco(),
        produto,
        resolverUsuario,
        inicioIso,
        fimIso,
        activeUnit
      );
      eventosInventario = processarEventosInventario(
        getLocalTabelaInventario().filter((i) => itemMatchesUserUnit(i.unidade_negocio, activeUnit)),
        produto,
        inicioIso,
        fimIso,
        resolverUsuario
      );
    }

    // CONSOLIDAÇÃO ÚNICA DOS EVENTOS E ORDENAÇÃO CRONOLÓGICA (Mais recente para mais antigo)
    const todosEventos = [...eventosRecebimento, ...eventosAlteracao, ...eventosInventario];
    todosEventos.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());

    // CÁLCULO DOS INDICADORES DO RESUMO (Sem consultas adicionais)
    let totalRecebimentos = 0;
    let totalConferencias = 0;
    let totalAlocacoes = 0;
    let totalAlteracoesEndereco = 0;
    let totalAlteracoesPendentes = 0;
    let totalAlteracoesAvulsas = 0;
    let totalContagens = 0;
    let totalCorrecoes = 0;

    for (const ev of todosEventos) {
      if (ev.tipo === 'RECEBIMENTO') totalRecebimentos++;
      else if (ev.tipo === 'CONFERENCIA_RECEBIMENTO') totalConferencias++;
      else if (ev.tipo === 'ALOCACAO') totalAlocacoes++;
      else if (ev.tipo === 'ALTERACAO_ENDERECO') {
        totalAlteracoesEndereco++;
        if (ev.isPendente) totalAlteracoesPendentes++;
        if (ev.isAvulsa) totalAlteracoesAvulsas++;
      }
      else if (ev.tipo === 'CONTAGEM_INVENTARIO') totalContagens++;
      else if (ev.tipo === 'CORRECAO_CONTAGEM') totalCorrecoes++;
    }

    return {
      produto,
      periodo,
      unidadeNegocio: activeUnit,
      totalRecebimentos,
      totalConferencias,
      totalAlocacoes,
      totalAlteracoesEndereco,
      totalAlteracoesPendentes,
      totalAlteracoesAvulsas,
      totalContagens,
      totalCorrecoes,
      totalGeral: todosEventos.length,
      eventos: todosEventos,
    };
  },
};

/**
 * Processa registros de recebimentos_produtos gerando eventos de Recebimento, Conferência e Alocação
 */
function processarEventosRecebimento(
  registros: any[],
  produto: Produto,
  inicioIso: string,
  fimIso: string,
  dataInicioYmd: string,
  dataFimYmd: string,
  resolverUsuario: (id?: string | null) => { nome: string; codigo?: string }
): EventoAuditoria[] {
  const eventos: EventoAuditoria[] = [];

  for (const item of registros) {
    if (!correspondeAoProduto(item.produto, produto)) {
      continue;
    }

    // 1. EVENTO: RECEBIMENTO
    // Verifica data_recebimento (geralmente YYYY-MM-DD ou ISO)
    const dtRecebimento = item.data_recebimento ? item.data_recebimento.slice(0, 10) : null;
    const dataHoraRecebimento = item.created_at || (dtRecebimento ? `${dtRecebimento}T08:00:00.000Z` : null);

    if (
      dtRecebimento &&
      dtRecebimento >= dataInicioYmd &&
      dtRecebimento <= dataFimYmd &&
      dataHoraRecebimento
    ) {
      eventos.push({
        id: `rec-${item.id}`,
        tipo: 'RECEBIMENTO',
        tipoLabel: 'Recebimento',
        dataHora: dataHoraRecebimento,
        produto: item.produto,
        codigoProduto: produto.codigo_barras || undefined,
        quantidade: item.quantidade !== undefined && item.quantidade !== null ? Number(item.quantidade) : null,
        endereco: item.endereco || 'Sem endereço informado',
        notaFiscal: item.nota_fiscal || 'Não informada',
        status: item.status || 'Recebido',
        responsavelNome: 'Recebimento Logístico',
        unidadeNegocio: item.unidade_negocio,
        tabelaOrigem: 'recebimentos_produtos',
      });
    }

    // 2. EVENTO: CONFERÊNCIA DE RECEBIMENTO
    // Comprovado por data_conferencia presente ou status conferido com data
    if (item.data_conferencia) {
      const dtConfIso = new Date(item.data_conferencia).toISOString();
      if (dtConfIso >= inicioIso && dtConfIso <= fimIso) {
        const usuario = resolverUsuario(item.conferente_id);
        const qtdConf = item.qtd_conferida !== undefined && item.qtd_conferida !== null ? Number(item.qtd_conferida) : Number(item.quantidade);
        const temCritica = item.status === 'Crítica';

        eventos.push({
          id: `conf-${item.id}`,
          tipo: 'CONFERENCIA_RECEBIMENTO',
          tipoLabel: 'Conferência de Recebimento',
          dataHora: dtConfIso,
          produto: item.produto,
          codigoProduto: produto.codigo_barras || undefined,
          quantidade: qtdConf,
          endereco: item.endereco || undefined,
          notaFiscal: item.nota_fiscal || 'Não informada',
          status: temCritica ? 'Divergência / Crítica' : 'Conferido 100%',
          responsavelId: item.conferente_id,
          responsavelNome: usuario.nome,
          responsavelCodigo: usuario.codigo,
          observacao: temCritica ? `Quantidade conferida (${qtdConf}) divergiu do esperado (${item.quantidade}).` : undefined,
          unidadeNegocio: item.unidade_negocio,
          tabelaOrigem: 'recebimentos_produtos',
        });
      }
    }

    // 3. EVENTO: ALOCAÇÃO
    // Comprovado por data_alocacao ou repositor_id preenchido
    if (item.data_alocacao) {
      const dtAlocIso = new Date(item.data_alocacao).toISOString();
      if (dtAlocIso >= inicioIso && dtAlocIso <= fimIso) {
        const usuario = resolverUsuario(item.repositor_id);
        const enderecoDestino = item.novo_endereco || item.endereco || 'Endereço não informado';

        eventos.push({
          id: `aloc-${item.id}`,
          tipo: 'ALOCACAO',
          tipoLabel: 'Alocação',
          dataHora: dtAlocIso,
          produto: item.produto,
          codigoProduto: produto.codigo_barras || undefined,
          quantidade: item.quantidade !== undefined && item.quantidade !== null ? Number(item.quantidade) : null,
          endereco: enderecoDestino,
          notaFiscal: item.nota_fiscal || undefined,
          status: 'Alocado',
          responsavelId: item.repositor_id,
          responsavelNome: usuario.nome,
          responsavelCodigo: usuario.codigo,
          observacao: item.novo_endereco ? `Alocado com novo endereço: ${item.novo_endereco}` : undefined,
          unidadeNegocio: item.unidade_negocio,
          tabelaOrigem: 'recebimentos_produtos',
        });
      }
    }
  }

  return eventos;
}

/**
 * Processa registros de alteracoes_endereco
 */
function processarEventosAlteracao(
  registros: any[],
  produto: Produto,
  resolverUsuario: (id?: string | null) => { nome: string; codigo?: string },
  inicioIso: string,
  fimIso: string,
  activeUnit: string
): EventoAuditoria[] {
  const eventos: EventoAuditoria[] = [];

  for (const item of registros) {
    if (!correspondeAoProduto(item.produto, produto)) {
      continue;
    }

    // Valida unidade de negócio do usuário (se null ou vazia, assume unidade padrão 'Goiânia')
    if (!itemMatchesUserUnit(item.unidade_negocio, activeUnit)) {
      continue;
    }

    const dtIso = item.data
      ? new Date(item.data).toISOString()
      : item.created_at
      ? new Date(item.created_at).toISOString()
      : new Date().toISOString();

    const isPendente = item.alterado_sistema === false;
    const tipoAlt = String(item.tipo_alteracao || 'Avulsa').trim();
    const isAvulsa = tipoAlt.toLowerCase().includes('avulsa');

    // Regra temporal:
    // - Alterações PENDENTES (em aberto) no estoque são ativas e SEMPRE devem ser exibidas
    // - Alterações já confirmadas/concluídas são filtradas pelo período selecionado
    const dentroDoPeriodo = dtIso >= inicioIso && dtIso <= fimIso;
    if (!dentroDoPeriodo && !isPendente) {
      continue;
    }

    const usuario = resolverUsuario(item.usuario_alteracao);

    let statusTexto = isPendente ? 'Pendente de Atualização' : 'Confirmado no Sistema';
    if (isPendente && isAvulsa) {
      statusTexto = 'Pendente (Alteração Avulsa)';
    }

    let observacaoTexto = item.tipo_alteracao
      ? `Origem: ${item.tipo_alteracao}`
      : 'Alteração no estoque';

    if (isPendente) {
      observacaoTexto += ' • Aguardando homologação do gestor';
    } else if (item.data_confirmacao) {
      const dtConf = new Date(item.data_confirmacao).toLocaleDateString('pt-BR');
      observacaoTexto += ` • Confirmado no sistema em ${dtConf}`;
    }

    eventos.push({
      id: `alt-${item.id}`,
      tipo: 'ALTERACAO_ENDERECO',
      tipoLabel: isAvulsa ? 'Alteração de Endereço (Avulsa)' : 'Alteração de Endereço',
      dataHora: dtIso,
      produto: item.produto,
      codigoProduto: produto.codigo_barras || undefined,
      enderecoAnterior: item.endereco_antigo || 'Sem endereço anterior',
      novoEndereco: item.endereco_novo || 'Novo endereço não informado',
      endereco: item.endereco_novo,
      responsavelId: item.usuario_alteracao,
      responsavelNome: item.usuario_nome || usuario.nome,
      responsavelCodigo: item.usuario_codigo || usuario.codigo,
      observacao: observacaoTexto,
      status: statusTexto,
      unidadeNegocio: item.unidade_negocio || activeUnit,
      tabelaOrigem: 'alteracoes_endereco',
      isPendente,
      isAvulsa,
    });
  }

  return eventos;
}

/**
 * Processa registros de inventario gerando eventos de Contagem e Correção
 */
function processarEventosInventario(
  registros: any[],
  produto: Produto,
  inicioIso: string,
  fimIso: string,
  resolverUsuario: (id?: string | null) => { nome: string; codigo?: string }
): EventoAuditoria[] {
  const eventos: EventoAuditoria[] = [];

  for (const item of registros) {
    if (!correspondeAoProduto(item.produto, produto)) {
      continue;
    }

    // 1. EVENTO: CONTAGEM DE INVENTÁRIO
    if (item.data_contagem && item.qtd_contada !== null && item.qtd_contada !== undefined) {
      const dtContIso = new Date(item.data_contagem).toISOString();
      if (dtContIso >= inicioIso && dtContIso <= fimIso) {
        const usuario = resolverUsuario(item.usuario_id);
        const qtdCont = Number(item.qtd_contada);
        const qtdDisp = Number(item.qtd_disponivel || 0);
        const divergente = qtdCont !== qtdDisp;

        eventos.push({
          id: `inv-cont-${item.id}`,
          tipo: 'CONTAGEM_INVENTARIO',
          tipoLabel: 'Contagem de Inventário',
          dataHora: dtContIso,
          produto: item.produto,
          codigoProduto: produto.codigo_barras || undefined,
          quantidade: qtdCont,
          quantidadeAnterior: qtdDisp,
          endereco: item.endereco || 'Não informado',
          responsavelId: item.usuario_id,
          responsavelNome: usuario.nome,
          responsavelCodigo: usuario.codigo,
          status: divergente ? 'Divergência Detectada' : 'Contagem Conforme',
          observacao: `Saldo Disponível: ${qtdDisp} | Atual: ${item.qtd_atual ?? qtdDisp} | Reservado: ${item.qtd_reservada ?? 0}`,
          unidadeNegocio: item.unidade_negocio,
          tabelaOrigem: 'inventario',
        });
      }
    }

    // 2. EVENTO: CORREÇÃO DE CONTAGEM
    // Registrado quando corrigido = true e data_correcao presente
    if (item.corrigido && item.data_correcao) {
      const dtCorrIso = new Date(item.data_correcao).toISOString();
      if (dtCorrIso >= inicioIso && dtCorrIso <= fimIso) {
        const usuario = resolverUsuario(item.usuario_correcao);

        eventos.push({
          id: `inv-corr-${item.id}`,
          tipo: 'CORRECAO_CONTAGEM',
          tipoLabel: 'Correção de Contagem',
          dataHora: dtCorrIso,
          produto: item.produto,
          codigoProduto: produto.codigo_barras || undefined,
          quantidade: item.qtd_contada !== null && item.qtd_contada !== undefined ? Number(item.qtd_contada) : null,
          quantidadeAnterior: item.qtd_disponivel !== null && item.qtd_disponivel !== undefined ? Number(item.qtd_disponivel) : null,
          endereco: item.endereco || 'Não informado',
          responsavelId: item.usuario_correcao,
          responsavelNome: usuario.nome,
          responsavelCodigo: usuario.codigo,
          status: 'Divergência Corrigida',
          observacao: 'Correção homologada pela gestão de inventário.',
          unidadeNegocio: item.unidade_negocio,
          tabelaOrigem: 'inventario',
        });
      }
    }
  }

  return eventos;
}
