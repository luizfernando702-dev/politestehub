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
  MapPin,
  Info,
} from 'lucide-react';
import { RecebimentoProduto, ResumoNotaRecebimento } from '../../types';
import { recebimentoService } from '../../services/recebimentoService';
import { ConferenciaProdutoModal } from './ConferenciaProdutoModal';
import { DetalhesProdutoModal } from './DetalhesProdutoModal';

interface RevisarConferenciaViewProps {
  nota: ResumoNotaRecebimento;
  onVoltar: () => void;
  onIrParaAlocacao?: () => void;
}

export const RevisarConferenciaView: React.FC<RevisarConferenciaViewProps> = ({
  nota,
  onVoltar,
  onIrParaAlocacao,
}) => {
  const [produtos, setProdutos] = useState<RecebimentoProduto[]>([]);
  const [loading, setLoading] = useState(true);
  const [reabrindoId, setReabrindoId] = useState<string | number | null>(null);

  // Modais de Produto
  const [produtoEmConferencia, setProdutoEmConferencia] = useState<RecebimentoProduto | null>(null);
  const [produtoEmDetalhes, setProdutoEmDetalhes] = useState<RecebimentoProduto | null>(null);

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
        console.warn('Erro ao carregar dados do agendamento para revisão:', err);
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
      : 'Carregando fornecedor...');

  const dataExibicao = dadosAgendamento?.data || nota.data_recebimento;
  const notaFiscalExibicao = dadosAgendamento?.nota_fiscal || nota.nota_fiscal;

  // Produtos ordenados em ordem alfabética pelo código/nome do produto
  const produtosOrdenados = useMemo(() => {
    return [...produtos].sort((a, b) =>
      (a.produto || '').localeCompare(b.produto || '', 'pt-BR', { sensitivity: 'base' })
    );
  }, [produtos]);

  // Cálculos dinâmicos em tempo real
  const totalProdutos = produtos.length;
  const totalConferidos = produtos.filter(
    (p) => p.status === 'Conferido' || p.status === 'Alocado'
  ).length;
  const totalCriticas = produtos.filter((p) => p.status === 'Crítica').length;
  const totalPendentes = produtos.filter((p) => p.status === 'Recebido').length;

  const porcentagem = totalProdutos > 0 ? Math.round((totalConferidos / totalProdutos) * 100) : 0;
  const todosConferidos = totalProdutos > 0 && totalConferidos === totalProdutos && totalCriticas === 0;
  const possuiCritica = totalCriticas > 0;

  // Atualização local do produto conferido (sem recarregar toda a página)
  const handleAtualizarItemConferido = (atualizado: {
    id: string | number;
    status: RecebimentoProduto['status'];
    qtdConferida: number;
  }) => {
    setProdutos((prev) =>
      prev.map((item) =>
        String(item.id) === String(atualizado.id)
          ? {
              ...item,
              status: atualizado.status,
              qtd_conferida: atualizado.qtdConferida,
              data_conferencia: new Date().toISOString(),
            }
          : item
      )
    );
  };

  // Reabrir conferência de um item
  const handleReabrirItem = async (produtoId: string | number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setReabrindoId(produtoId);
      await recebimentoService.reabrirConferencia(produtoId);
      // Atualiza localmente sem recarregar tudo
      setProdutos((prev) =>
        prev.map((item) =>
          String(item.id) === String(produtoId)
            ? {
                ...item,
                status: 'Recebido',
                qtd_conferida: null,
                data_conferencia: null,
              }
            : item
        )
      );
    } catch (err) {
      console.error('Erro ao reabrir conferência:', err);
    } finally {
      setReabrindoId(null);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-24 md:pb-12 animate-in fade-in duration-200">
      {/* Top Bar with Back Button */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onVoltar}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Recebimento</span>
        </button>

        <button
          type="button"
          onClick={carregarProdutos}
          disabled={loading}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition min-h-[44px]"
          title="Recarregar produtos"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Header Card: Dados da Nota Fiscal e Progresso */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                Lista de Conferência Cega
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
              <FileText className="w-6 h-6 text-emerald-400" />
              <span>Nota Fiscal: {notaFiscalExibicao}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Selecione qualquer produto da lista para conferir ou visualizar detalhes.
            </p>
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

        {/* Métricas de Progresso da Nota (Conferência Cega - Sem Revelar Quantidade Fiscal) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Total de SKUs
            </span>
            <span className="text-lg font-black font-mono text-white">{totalProdutos}</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Pendentes
            </span>
            <span className="text-lg font-black font-mono text-amber-400">
              {totalPendentes}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Conferidos
            </span>
            <span className="text-lg font-black font-mono text-emerald-400">
              {totalConferidos} / {totalProdutos}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Situação da NF
            </span>
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
                ? `${totalCriticas} em crítica (Aberta)`
                : todosConferidos
                ? 'Conferida'
                : 'Aberta'}
            </span>
          </div>
        </div>

        {/* Barra de Progresso */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Progresso da Conferência</span>
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

      {/* Lista de Todos os Produtos da NF em Ordem Alfabética */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Produtos da Nota Fiscal ({produtosOrdenados.length}) — Ordem Alfabética
          </span>
          <span className="text-[11px] text-slate-500">
            Toque no card para ver detalhes ou clique em CONFERIR
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-3xl">
            <RefreshCw className="w-6 h-6 text-blue-400 animate-spin mx-auto mb-2" />
            <span className="text-xs text-slate-400">Carregando itens...</span>
          </div>
        ) : produtosOrdenados.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-3xl">
            <p className="text-xs text-slate-400">Nenhum produto cadastrado para esta nota fiscal.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {produtosOrdenados.map((p) => {
              const status = p.status || 'Recebido';
              const isConferido = status === 'Conferido' || status === 'Alocado';
              const isCritica = status === 'Crítica';
              const isPendente = status === 'Recebido';

              return (
                <div
                  key={p.id}
                  onClick={() => setProdutoEmDetalhes(p)}
                  className="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition cursor-pointer shadow-md"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    {/* Status Visual: Pendente | Conferido | Crítica (sem expor quantidade esperada) */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-lg flex items-center gap-1.5 ${
                          isCritica
                            ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                            : isConferido
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {isCritica ? (
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                        ) : isConferido ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Clock className="w-3 h-3 text-amber-400" />
                        )}
                        <span>
                          {isCritica ? 'Crítica' : isConferido ? 'Conferido' : 'Pendente'}
                        </span>
                      </span>

                      {p.endereco && (
                        <span className="text-[11px] text-sky-400 flex items-center gap-1 font-mono">
                          <MapPin className="w-3 h-3 text-sky-500" />
                          {p.endereco}
                        </span>
                      )}
                    </div>

                    {/* Nome do Produto */}
                    <h4 className="text-sm font-bold text-white leading-snug break-words group-hover:text-emerald-300 transition">
                      {p.produto}
                    </h4>

                    {/* Informações adicionais (SEM exibir quantidade esperada da NF) */}
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        Toque no card para Detalhes
                      </span>
                      {p.qtd_conferida !== null && p.qtd_conferida !== undefined && (
                        <>
                          <span className="text-slate-600">•</span>
                          <span className="text-[11px]">
                            Contagem física:{' '}
                            <strong
                              className={`font-mono font-bold ${
                                isCritica ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                            >
                              {p.qtd_conferida} un
                            </strong>
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Ações do Produto: CONFERIR e REABRIR (sem expor quantidade ao lado) */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                    {/* Botão CONFERIR: abre a tela de conferência para este produto */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setProdutoEmConferencia(p);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/25 transition min-h-[40px]"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>CONFERIR</span>
                    </button>

                    {/* Botão REABRIR: preservado para itens com Crítica ou Conferidos, sem quantidade da NF ao lado */}
                    {(isCritica || isConferido) && (
                      <button
                        type="button"
                        onClick={(e) => handleReabrirItem(p.id, e)}
                        disabled={reabrindoId === p.id}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition min-h-[40px]"
                        title="Reabrir conferência para recontagem"
                      >
                        <RotateCcw
                          className={`w-3.5 h-3.5 ${reabrindoId === p.id ? 'animate-spin' : ''}`}
                        />
                        <span>Reabrir</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Conferência de Produto Específico */}
      {produtoEmConferencia && (
        <ConferenciaProdutoModal
          produto={produtoEmConferencia}
          notaFiscal={notaFiscalExibicao}
          fornecedor={nomeFornecedor}
          onClose={() => setProdutoEmConferencia(null)}
          onConferenciaConcluida={(atualizado) => {
            handleAtualizarItemConferido(atualizado);
          }}
        />
      )}

      {/* Modal de Detalhes do Produto (com quantidade mascarada e botão MOSTRAR) */}
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
          onProdutoValidado={(prod) => {
            setProdutos((prev) =>
              prev.map((item) => (String(item.id) === String(prod.id) ? prod : item))
            );
          }}
        />
      )}
    </div>
  );
};
