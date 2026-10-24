import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Package,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Calendar,
  Building2,
  RefreshCw,
  Play,
  RotateCcw,
  ArrowRight,
  Clock,
  Search,
  X,
  UserCheck,
  ShieldCheck,
  AlertOctagon,
  ShieldAlert,
} from 'lucide-react';
import { RecebimentoProduto, RecebimentoStatus, ResumoNotaRecebimento } from '../../types';
import { recebimentoService } from '../../services/recebimentoService';
import { ConferenciaProdutoModal } from './ConferenciaProdutoModal';
import { DetalhesProdutoModal } from './DetalhesProdutoModal';
import { useSessaoOperacional } from '../../context/SessaoOperacionalContext';
import { useAuth } from '../../context/AuthContext';
import { isUserGestor } from '../../lib/permissions';
import { ConfirmacaoExcepcionalModal } from './ConfirmacaoExcepcionalModal';

interface ListaProdutosConferenciaViewProps {
  nota: ResumoNotaRecebimento;
  onVoltar: () => void;
  onIrParaAlocacao?: () => void;
  onConcluir?: () => void;
  onTrocarOperador?: () => void;
  onNotaFinalizada?: () => void;
}

export const ListaProdutosConferenciaView: React.FC<ListaProdutosConferenciaViewProps> = ({
  nota,
  onVoltar,
  onIrParaAlocacao,
  onTrocarOperador,
  onConcluir,
  onNotaFinalizada,
}) => {
  const { user } = useAuth();
  const isGestor = isUserGestor(user);
  const { operador } = useSessaoOperacional();

  const [produtos, setProdutos] = useState<RecebimentoProduto[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados para finalização excepcional (Gestor)
  const [modalFinalizarAberto, setModalFinalizarAberto] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [erroFinalizar, setErroFinalizar] = useState<string | null>(null);
  const [sucessoFinalizar, setSucessoFinalizar] = useState<string | null>(null);
  const [alertaMensagem, setAlertaMensagem] = useState<string | null>(null);

  // Campo de pesquisa de produto
  const [pesquisaProduto, setPesquisaProduto] = useState<string>('');

  // Modais de Produto
  const [produtoEmConferencia, setProdutoEmConferencia] = useState<RecebimentoProduto | null>(null);
  const [produtoEmDetalhes, setProdutoEmDetalhes] = useState<RecebimentoProduto | null>(null);

  // Confirmação para Zerar Conferência
  const [produtoParaZerar, setProdutoParaZerar] = useState<RecebimentoProduto | null>(null);
  const [zerandoId, setZerandoId] = useState<string | number | null>(null);

  const [dadosAgendamento, setDadosAgendamento] = useState<{
    agendamento_id: string;
    fornecedor: string;
    nota_fiscal: string;
    data: string;
  } | null>(null);

  const carregarProdutos = useCallback(async () => {
    try {
      setLoading(true);
      const data = await recebimentoService.listarProdutosDaNota(nota.nota_fiscal);
      setProdutos(data);
    } catch (err) {
      console.error('Erro ao carregar produtos da nota:', err);
    } finally {
      setLoading(false);
    }
  }, [nota.nota_fiscal]);

  useEffect(() => {
    carregarProdutos();
  }, [carregarProdutos]);

  useEffect(() => {
    async function carregarDadosAgendamento() {
      try {
        const dados = await recebimentoService.obterDadosAgendamentoPorId(
          nota.agendamento_id,
          nota.nota_fiscal
        );
        if (dados && dados.fornecedor) {
          setDadosAgendamento(dados);
        }
      } catch (err) {
        console.warn('Erro ao carregar dados do agendamento para lista:', err);
      }
    }
    carregarDadosAgendamento();
  }, [nota.agendamento_id, nota.nota_fiscal]);

  const nomeFornecedor =
    dadosAgendamento?.fornecedor ||
    (nota.fornecedor &&
    !nota.fornecedor.toLowerCase().includes('fornecedor da nota') &&
    !nota.fornecedor.toLowerCase().includes('fornecedor da carga')
      ? nota.fornecedor
      : 'Fornecedor Cadastrado');

  const dataExibicao = dadosAgendamento?.data || nota.data_recebimento;
  const notaFiscalExibicao = dadosAgendamento?.nota_fiscal || nota.nota_fiscal;

  /**
   * SEÇÃO 10: ORDENAMENTO DOS PRODUTOS
   * Primeiro critério: status
   * 1. Pendente (status === 'Recebido')
   * 2. Crítica (status === 'Crítica')
   * 3. Conferido (status === 'Conferido' || status === 'Alocado')
   * Segundo critério: ordem alfabética pelo nome/código do produto
   */
  const getStatusPeso = (status?: RecebimentoStatus | null): number => {
    if (!status || status === 'Recebido') return 1; // 1. Pendente
    if (status === 'Crítica') return 2;             // 2. Crítica
    return 3;                                      // 3. Conferido
  };

  const produtosOrdenados = useMemo(() => {
    return [...produtos].sort((a, b) => {
      const pesoA = getStatusPeso(a.status);
      const pesoB = getStatusPeso(b.status);

      if (pesoA !== pesoB) {
        return pesoA - pesoB;
      }

      return (a.produto || '').localeCompare(b.produto || '', 'pt-BR', { sensitivity: 'base' });
    });
  }, [produtos]);

  // Produtos filtrados pela caixa de pesquisa (nome ou código)
  const produtosFiltrados = useMemo(() => {
    const termo = pesquisaProduto.trim().toLowerCase();
    if (!termo) return produtosOrdenados;
    return produtosOrdenados.filter((p) => {
      const nome = (p.produto || '').toLowerCase();
      return nome.includes(termo);
    });
  }, [produtosOrdenados, pesquisaProduto]);

  // Cálculos dinâmicos em tempo real
  const totalProdutos = produtos.length;
  const totalConferidos = produtos.filter(
    (p) => p.status === 'Conferido' || p.status === 'Alocado' || p.status === 'Validado'
  ).length;
  const totalCriticas = produtos.filter((p) => p.status === 'Crítica').length;
  const totalPendentes = produtos.filter((p) => !p.status || p.status === 'Recebido').length;

  const porcentagem = totalProdutos > 0 ? Math.round((totalConferidos / totalProdutos) * 100) : 0;
  const todosConferidos = totalProdutos > 0 && totalConferidos === totalProdutos && totalCriticas === 0;
  const possuiCritica = totalCriticas > 0;

  // Regra de prevenção: nota já totalmente finalizada/validada
  const isNotaJaFinalizada =
    produtos.length > 0 &&
    produtos.every((p) => p.status === 'Validado' || p.status === 'Alocado');

  const handleAbrirFinalizar = () => {
    setAlertaMensagem(null);
    setErroFinalizar(null);
    if (isNotaJaFinalizada) {
      setAlertaMensagem('Esta nota fiscal já foi finalizada. Não há itens pendentes para validação.');
      return;
    }
    setModalFinalizarAberto(true);
  };

  const handleConfirmarFinalizar = async () => {
    try {
      setFinalizando(true);
      setErroFinalizar(null);
      const res = await recebimentoService.finalizarNotaFiscalExcepcional({
        notaFiscal: nota.nota_fiscal,
        agendamentoId: nota.agendamento_id,
      });

      setSucessoFinalizar(res.message);
      setModalFinalizarAberto(false);

      const atualizados = await recebimentoService.listarProdutosDaNota(nota.nota_fiscal);
      setProdutos(atualizados);

      if (onNotaFinalizada) {
        setTimeout(() => {
          onNotaFinalizada();
        }, 1800);
      }
    } catch (err: any) {
      console.error('Erro ao finalizar nota fiscal:', err);
      setErroFinalizar(err.message || 'Erro ao finalizar nota fiscal.');
    } finally {
      setFinalizando(false);
    }
  };

  const handleAtualizarItemValidado = (atualizado: RecebimentoProduto) => {
    setProdutos((prev) =>
      prev.map((item) => (String(item.id) === String(atualizado.id) ? atualizado : item))
    );
  };

  /**
   * SEÇÃO 8: ATUALIZAÇÃO AUTOMÁTICA DA LISTA
   * Atualiza somente o produto alterado no estado local:
   * status, conferente_id, conferente_nome, qtd_conferida, reorganizando a lista
   */
  const handleAtualizarItemConferido = (atualizado: {
    id: string | number;
    status: RecebimentoStatus;
    qtdConferida: number;
    conferenteId?: string;
    conferenteNome?: string;
  }) => {
    setProdutos((prev) =>
      prev.map((item) =>
        String(item.id) === String(atualizado.id)
          ? {
              ...item,
              status: atualizado.status,
              qtd_conferida: atualizado.qtdConferida,
              conferente_id: atualizado.conferenteId || item.conferente_id,
              conferente_nome: atualizado.conferenteNome || item.conferente_nome,
              data_conferencia: new Date().toISOString(),
            }
          : item
      )
    );
  };

  /**
   * SEÇÃO 15: ZERAR CONFERÊNCIA
   * - Retorna produto para Pendente;
   * - Limpa qtd_conferida, conferente_id, conferente_nome, data_conferencia;
   * - Reorganiza o produto na lista de pendentes sem recarregar a página.
   */
  const handleConfirmarZerarConferencia = async () => {
    if (!produtoParaZerar) return;
    const produtoId = produtoParaZerar.id;

    try {
      setZerandoId(produtoId);
      await recebimentoService.reabrirConferencia(produtoId);

      setProdutos((prev) =>
        prev.map((item) =>
          String(item.id) === String(produtoId)
            ? {
                ...item,
                status: 'Recebido',
                qtd_conferida: null,
                conferente_id: null,
                conferente_nome: null,
                data_conferencia: null,
                saldo_final: item.quantidade,
              }
            : item
        )
      );
    } catch (err) {
      console.error('Erro ao zerar conferência do produto:', err);
    } finally {
      setZerandoId(null);
      setProdutoParaZerar(null);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-24 md:pb-12 animate-in fade-in duration-200">
      {/* Barra de Navegação Superior e Operador Ativo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          type="button"
          onClick={onVoltar}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition min-h-[44px] self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar aos Detalhes da NF</span>
        </button>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {operador && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400">
                Conferente: <strong className="text-white">{operador.nome}</strong>
              </span>
              {onTrocarOperador && (
                <button
                  type="button"
                  onClick={onTrocarOperador}
                  className="ml-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 hover:underline"
                >
                  (Trocar)
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={carregarProdutos}
            disabled={loading}
            className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition min-h-[44px]"
            title="Recarregar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Card de Resumo e Progresso da Conferência */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Conferência Cega de Produtos
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                {dataExibicao}
              </span>
              <span className="text-xs text-slate-200 flex items-center gap-1 font-semibold bg-slate-800/80 px-2.5 py-0.5 rounded-lg border border-slate-700/60">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                {nomeFornecedor}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-400" />
              <span>Lista de Produtos — NF {notaFiscalExibicao}</span>
            </h2>
          </div>

          {/* Ação de Alocação (quando 100% conferida) */}
          {todosConferidos && onIrParaAlocacao && (
            <div className="flex items-center">
              <button
                type="button"
                onClick={onIrParaAlocacao}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/25 transition min-h-[46px]"
              >
                <span>Liberado: Ir para Alocação</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Métricas Rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total de SKUs</span>
            <span className="text-lg font-black font-mono text-white">{totalProdutos}</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Pendentes</span>
            <span className="text-lg font-black font-mono text-amber-400">{totalPendentes}</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Conferidos</span>
            <span className="text-lg font-black font-mono text-emerald-400">
              {totalConferidos} / {totalProdutos}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Situação</span>
            <span
              className={`text-xs font-bold font-mono px-2 py-0.5 rounded inline-block mt-1 ${
                possuiCritica
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  : todosConferidos
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}
            >
              {possuiCritica
                ? `${totalCriticas} Crítica(s)`
                : todosConferidos
                ? 'Conferida'
                : 'Aberta'}
            </span>
          </div>
        </div>

        {/* Barra de Progresso */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Progresso</span>
            <span className="font-bold text-white font-mono">{porcentagem}%</span>
          </div>
          <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                possuiCritica
                  ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                  : todosConferidos
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : 'bg-gradient-to-r from-blue-500 to-sky-400'
              }`}
              style={{ width: `${porcentagem}%` }}
            />
          </div>
        </div>
      </div>

      {/* CAIXA DE PESQUISA DE PRODUTO */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-lg">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Pesquisar produto por nome ou código..."
            value={pesquisaProduto}
            onChange={(e) => setPesquisaProduto(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-10 py-3 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500 transition min-h-[46px]"
          />
          {pesquisaProduto && (
            <button
              type="button"
              onClick={() => setPesquisaProduto('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-lg"
              title="Limpar busca"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* SEÇÃO 11: Cabeçalho Limpo da Lista (Sem textos descritivos) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Produtos ({produtosFiltrados.length} de {produtos.length})
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-3xl">
            <RefreshCw className="w-6 h-6 text-amber-400 animate-spin mx-auto mb-2" />
            <span className="text-xs text-slate-400">Carregando itens...</span>
          </div>
        ) : produtosFiltrados.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-3xl space-y-2">
            <Package className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">
              {pesquisaProduto
                ? `Nenhum produto encontrado com o termo "${pesquisaProduto}".`
                : 'Nenhum produto cadastrado para esta nota fiscal.'}
            </p>
            {pesquisaProduto && (
              <button
                type="button"
                onClick={() => setPesquisaProduto('')}
                className="text-xs text-amber-400 font-bold hover:underline"
              >
                Limpar pesquisa
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {produtosFiltrados.map((p) => {
              const status = p.status || 'Recebido';
              const isValidado = status === 'Validado';
              const isConferido = status === 'Conferido' || status === 'Alocado';
              const isCritica = status === 'Crítica';
              const isPendente = status === 'Recebido';

              // SEÇÃO 13: Exibir Qtd: X/X SOMENTE se status Conferido E qtd_conferida === quantidade
              const exibirQuantidade =
                (isConferido || isValidado) &&
                p.qtd_conferida !== null &&
                p.qtd_conferida !== undefined &&
                p.qtd_conferida === p.quantidade;

              // SEÇÃO 9: Conferente via relacionamento (ou '—' se pendente)
              const nomeConferente = p.conferente_nome || '—';

              /**
               * SEÇÃO 12: CORES DOS CARDS POR STATUS
               * - Pendente: fundo suavemente alaranjado
               * - Crítica: fundo suavemente avermelhado
               * - Conferido: fundo suavemente esverdeado
               * - Validado: fundo suavemente avermelhado com borda de atenção
               */
              const cardBgClasses = isCritica
                ? 'bg-rose-950/20 border-rose-900/50 hover:border-rose-700/70'
                : isValidado
                ? 'bg-rose-950/20 border-rose-900/40 hover:border-rose-700/60'
                : isConferido
                ? 'bg-emerald-950/20 border-emerald-900/50 hover:border-emerald-700/70'
                : 'bg-amber-950/20 border-amber-900/50 hover:border-amber-700/70';

              return (
                <div
                  key={p.id}
                  onClick={() => setProdutoEmDetalhes(p)}
                  className={`relative rounded-2xl p-4 sm:p-5 border transition-all shadow-md cursor-pointer select-none space-y-3 ${cardBgClasses}`}
                >
                  {/* SEÇÃO 14: LINHA 1 — Informações resumidas (Status à esquerda e Conferente à direita) */}
                  <div className="flex items-center justify-between gap-1.5 sm:gap-2 overflow-hidden whitespace-nowrap text-[11px] sm:text-xs">
                    {/* Status Badge */}
                    <div className="shrink-0">
                      {isCritica ? (
                        <span className="px-2 py-0.5 rounded font-black uppercase tracking-wider text-[10px] sm:text-[11px] bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                          <span>CRÍTICA</span>
                        </span>
                      ) : isValidado ? (
                        <span className="px-2 py-0.5 rounded font-black uppercase tracking-wider text-[10px] sm:text-[11px] bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                          <span>VALIDADO (GESTOR)</span>
                        </span>
                      ) : isConferido ? (
                        <span className="px-2 py-0.5 rounded font-black uppercase tracking-wider text-[10px] sm:text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>CONFERIDO</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded font-black uppercase tracking-wider text-[10px] sm:text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>PENDENTE</span>
                        </span>
                      )}
                    </div>

                    {/* SEÇÃO 9: Nome do Conferente (Sem endereço de alocação!) */}
                    <div className="min-w-0 truncate text-right text-slate-300 text-[11px] sm:text-xs font-medium shrink">
                      <span className="text-slate-500">Conferente: </span>
                      <span className="font-semibold text-white truncate">{nomeConferente}</span>
                    </div>
                  </div>

                  {/* SEÇÃO 14: LINHA 2 — Produto e Quantidade (ao lado do nome quando Conferido e quantidades baterem) */}
                  <div className="flex items-center justify-center gap-2 py-1 min-w-0 flex-wrap">
                    <h3
                      className="text-base sm:text-lg font-black text-white tracking-tight truncate max-w-full"
                      title={p.produto}
                    >
                      {p.produto}
                    </h3>
                    {exibirQuantidade && (
                      <span className="shrink-0 font-mono font-bold text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30 text-[10px] sm:text-xs">
                        Qtd: {p.qtd_conferida}/{p.quantidade}
                      </span>
                    )}
                  </div>

                  {/* SEÇÃO 14 & 15: LINHA 3 — Ação (botão único de largura quase total com stopPropagation) */}
                  <div>
                    {isPendente && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProdutoEmConferencia(p);
                        }}
                        className="w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-slate-950" />
                        <span>CONFERIR</span>
                      </button>
                    )}

                    {isCritica && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProdutoEmConferencia(p);
                        }}
                        className="w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30 transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>RECONFERIR</span>
                      </button>
                    )}

                    {isConferido && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProdutoParaZerar(p);
                        }}
                        disabled={zerandoId === p.id}
                        className="w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-slate-950/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${zerandoId === p.id ? 'animate-spin' : ''}`} />
                        <span>ZERAR CONFERÊNCIA</span>
                      </button>
                    )}

                    {isValidado && (
                      <div className="w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center justify-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-400" />
                        <span>VALIDADO — LIBERADO PARA ALOCAÇÃO</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Confirmação para ZERAR CONFERÊNCIA (Seção 15) */}
      {produtoParaZerar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setProdutoParaZerar(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-black text-white">Zerar Conferência</h4>
                <p className="text-xs text-slate-400">Confirmação de operação</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-1.5">
              <p className="font-bold text-white leading-snug">
                Deseja realmente zerar a conferência deste produto?
              </p>
              <p className="text-slate-400 font-mono text-[11px] truncate">
                {produtoParaZerar.produto}
              </p>
              <p className="text-[11px] text-amber-400/90 pt-1">
                O produto retornará para o status <strong>Pendente</strong> e será reorganizado na lista.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setProdutoParaZerar(null)}
                disabled={zerandoId === produtoParaZerar.id}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarZerarConferencia}
                disabled={zerandoId === produtoParaZerar.id}
                className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-1.5"
              >
                {zerandoId === produtoParaZerar.id ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span>Confirmar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Conferência Cega do Produto */}
      {produtoEmConferencia && (
        <ConferenciaProdutoModal
          produto={produtoEmConferencia}
          notaFiscal={notaFiscalExibicao}
          fornecedor={nomeFornecedor}
          onClose={() => setProdutoEmConferencia(null)}
          onConferenciaConcluida={(resultado) => {
            handleAtualizarItemConferido({
              id: resultado.id,
              status: resultado.status,
              qtdConferida: resultado.qtdConferida,
              conferenteId: resultado.conferenteId,
              conferenteNome: resultado.conferenteNome,
            });
            setProdutoEmConferencia(null);
          }}
        />
      )}

      {/* Modal de Detalhes do Produto (SEÇÃO 16: Abre ao clicar no card) */}
      {produtoEmDetalhes && (
        <DetalhesProdutoModal
          produto={produtoEmDetalhes}
          notaFiscal={notaFiscalExibicao}
          fornecedor={nomeFornecedor}
          dataRecebimento={dataExibicao}
          onClose={() => setProdutoEmDetalhes(null)}
          onIniciarConferencia={(prod) => {
            setProdutoEmDetalhes(null);
            setProdutoEmConferencia(prod);
          }}
          onProdutoValidado={handleAtualizarItemValidado}
        />
      )}
    </div>
  );
};
