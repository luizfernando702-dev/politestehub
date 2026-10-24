import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Calendar,
  Package,
  Layers,
  Building2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  CheckCheck,
  Inbox,
  AlertCircle,
  Hash,
} from 'lucide-react';
import { ItemHistoricoRecebimento, RespostaHistoricoRecebimentos } from '../../types';
import { recebimentoService, normalizarStatusMercadoria } from '../../services/recebimentoService';
import { useAuth } from '../../context/AuthContext';

interface NFsRecebidasHistoricoViewProps {
  unidadeNegocio?: string;
  autoCarregar?: boolean;
}

export const NFsRecebidasHistoricoView: React.FC<NFsRecebidasHistoricoViewProps> = ({
  unidadeNegocio,
  autoCarregar = false,
}) => {
  const { user } = useAuth();
  const effectiveUnit = unidadeNegocio || user?.unidade_negocio || 'Goiânia';

  const [loading, setLoading] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(autoCarregar);
  const [dados, setDados] = useState<RespostaHistoricoRecebimentos>({
    itens: [],
    totalRegistros: 0,
    paginaAtual: 1,
    totalPaginas: 1,
    limitePorPagina: 100,
  });
  const [erro, setErro] = useState<string | null>(null);
  const [buscaTermo, setBuscaTermo] = useState('');

  const carregarPagina = useCallback(
    async (pagina: number) => {
      try {
        setLoading(true);
        setErro(null);

        const resposta = await recebimentoService.listarHistoricoRecebimentos({
          pagina,
          limite: 100,
          unidadeNegocio: effectiveUnit,
        });

        setDados(resposta);
        setDadosCarregados(true);
      } catch (err: any) {
        console.error('Erro ao consultar histórico de recebimentos:', err);
        setErro(err?.message || 'Falha ao consultar histórico de recebimentos.');
      } finally {
        setLoading(false);
      }
    },
    [effectiveUnit]
  );

  // Se autoCarregar foi sinalizado como true na montagem, dispara a primeira página
  useEffect(() => {
    if (autoCarregar && !dadosCarregados) {
      carregarPagina(1);
    }
  }, [autoCarregar, dadosCarregados, carregarPagina]);

  const handleProximaPagina = () => {
    if (dados.paginaAtual < dados.totalPaginas && !loading) {
      carregarPagina(dados.paginaAtual + 1);
    }
  };

  const handlePaginaAnterior = () => {
    if (dados.paginaAtual > 1 && !loading) {
      carregarPagina(dados.paginaAtual - 1);
    }
  };

  const formatarData = (dataStr: string): string => {
    if (!dataStr) return '-';
    try {
      const parteData = dataStr.slice(0, 10);
      const partes = parteData.split('-');
      if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
      }
      return dataStr;
    } catch {
      return dataStr;
    }
  };

  // Filtragem local rápida apenas sobre os 100 registros já carregados na página
  const itensExibidos = buscaTermo.trim()
    ? dados.itens.filter((item) => {
        const termo = buscaTermo.toLowerCase().trim();
        return (
          item.produto.toLowerCase().includes(termo) ||
          item.nota_fiscal.toLowerCase().includes(termo) ||
          item.fornecedor.toLowerCase().includes(termo)
        );
      })
    : dados.itens;

  const inicioRegistro = (dados.paginaAtual - 1) * dados.limitePorPagina + 1;
  const fimRegistro = Math.min(dados.paginaAtual * dados.limitePorPagina, dados.totalRegistros);

  return (
    <div className="space-y-4 animate-in fade-in duration-200" id="secao-historico-nfs-recebidas">
      {/* Cabeçalho da Aba */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-400 bg-sky-500/10 px-2.5 py-0.5 rounded-full border border-sky-500/20 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>Histórico de Recebimentos</span>
            </span>
            <span className="text-xs text-slate-400">
              Unidade: <strong className="text-slate-200">{effectiveUnit}</strong>
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>NFs Recebidas</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Consulta consolidada de mercadorias registradas no recebimento (Não conferidas, Conferidas e Alocadas).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {dadosCarregados ? (
            <button
              type="button"
              onClick={() => carregarPagina(dados.paginaAtual)}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition disabled:opacity-50 min-h-[40px] cursor-pointer"
              title="Recarregar página atual"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Carregando...' : 'Recarregar'}</span>
            </button>
          ) : (
            <button
              type="button"
              id="btn-header-carregar-dados"
              onClick={() => carregarPagina(1)}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-xs font-black text-white shadow-lg shadow-emerald-600/30 transition disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px] cursor-pointer"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Layers className="w-4 h-4" />
              )}
              <span>{loading ? 'Carregando dados...' : 'Carregar dados'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Estado Não Carregado (Antes do usuário clicar em Carregar dados) */}
      {!dadosCarregados && (
        <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl p-10 sm:p-12 text-center max-w-xl mx-auto my-8">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-white">Histórico Sob Demanda</h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
            Para garantir baixo consumo de recursos e alta performance, a consulta das notas recebidas é realizada sob demanda em lotes de 100 registros.
          </p>
          <button
            type="button"
            id="btn-carregar-dados-historico"
            onClick={() => carregarPagina(1)}
            disabled={loading}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-xl shadow-emerald-600/30 transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Layers className="w-4 h-4" />
            )}
            <span>{loading ? 'Carregando dados...' : 'Carregar dados'}</span>
          </button>
        </div>
      )}

      {/* Erro */}
      {erro && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <div className="flex-1">
            <p className="font-semibold">{erro}</p>
          </div>
          <button
            type="button"
            onClick={() => carregarPagina(dados.paginaAtual)}
            className="px-3 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-xs font-bold text-rose-200"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Conteúdo com Tabela e Paginação (Exibido após consulta realizada) */}
      {dadosCarregados && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-lg">
          {/* Barra de Ações / Filtro Rápido e Métricas */}
          <div className="p-4 sm:p-5 border-b border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/40">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={buscaTermo}
                onChange={(e) => setBuscaTermo(e.target.value)}
                placeholder="Filtrar por produto, NF ou fornecedor nesta página..."
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
              />
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400 w-full sm:w-auto justify-between sm:justify-end">
              <span>
                Total no banco: <strong className="text-white font-mono">{dados.totalRegistros}</strong> registros
              </span>
              {dados.totalRegistros > 0 && (
                <span className="hidden sm:inline text-slate-600">•</span>
              )}
              {dados.totalRegistros > 0 && (
                <span className="font-mono text-sky-400 font-semibold">
                  Exibindo {inicioRegistro}–{fimRegistro}
                </span>
              )}
            </div>
          </div>

          {/* Tabela de Produtos Recebidos */}
          <div className="overflow-x-auto min-h-[300px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-sky-400" />
                <p className="text-xs sm:text-sm font-semibold text-slate-300">
                  Carregando 100 registros da tabela de recebimentos...
                </p>
                <p className="text-[11px] text-slate-500">
                  Aplicando paginação e isolamento por unidade de negócio
                </p>
              </div>
            ) : itensExibidos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
                <Inbox className="w-10 h-10 text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-slate-300">
                  Nenhum registro encontrado
                </p>
                <p className="text-xs text-slate-500 max-w-sm text-center">
                  {buscaTermo
                    ? 'Nenhum registro corresponde ao filtro digitado nesta página.'
                    : `Não há produtos registrados no recebimento para a unidade ${effectiveUnit}.`}
                </p>
                <button
                  type="button"
                  id="btn-recarregar-historico-vazio"
                  onClick={() => carregarPagina(1)}
                  disabled={loading}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Carregar novamente</span>
                </button>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4 w-28">Data</th>
                    <th className="py-3.5 px-4">Produto</th>
                    <th className="py-3.5 px-4 w-36">Nota Fiscal</th>
                    <th className="py-3.5 px-4 w-28 text-right">Quantidade</th>
                    <th className="py-3.5 px-4">Fornecedor</th>
                    <th className="py-3.5 px-4 w-36 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {itensExibidos.map((item) => {
                    const statusNormalizado = normalizarStatusMercadoria(item);

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-800/30 transition-colors duration-150"
                      >
                        {/* 1. DATA */}
                        <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            <span>{formatarData(item.data_recebimento)}</span>
                          </div>
                        </td>

                        {/* 2. PRODUTO */}
                        <td className="py-3 px-4 text-white font-bold whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/20">
                              <Package className="w-3.5 h-3.5" />
                            </div>
                            <span className="tracking-wide">{item.produto}</span>
                          </div>
                        </td>

                        {/* 3. NOTA FISCAL */}
                        <td className="py-3 px-4 font-mono whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-semibold text-[11px]">
                            <FileText className="w-3 h-3 text-slate-500" />
                            <span>NF {item.nota_fiscal}</span>
                          </span>
                        </td>

                        {/* 4. QUANTIDADE */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-sky-400 whitespace-nowrap">
                          <span className="text-sm">{item.quantidade.toLocaleString('pt-BR')}</span>
                          <span className="text-[10px] text-slate-500 ml-1 font-normal">un</span>
                        </td>

                        {/* 5. FORNECEDOR */}
                        <td className="py-3 px-4 text-slate-300 max-w-[220px] truncate" title={item.fornecedor}>
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="truncate">{item.fornecedor || 'Não informado'}</span>
                          </div>
                        </td>

                        {/* 6. STATUS DA MERCADORIA (Identificação Clara: Não conferida | Conferida | Alocada) */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {statusNormalizado === 'Alocada' && (
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-950"
                              title="Mercadoria guardada e alocada fisicamente na posição de armazenagem"
                            >
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Alocada</span>
                            </span>
                          )}

                          {statusNormalizado === 'Conferida' && (
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase bg-blue-500/15 text-blue-300 border border-blue-500/30 shadow-sm shadow-blue-950"
                              title="Mercadoria conferida e validada na contagem física"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                              <span>Conferida</span>
                            </span>
                          )}

                          {statusNormalizado === 'Não conferida' && (
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm shadow-amber-950"
                              title="Mercadoria recebida mas ainda não conferida"
                            >
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              <span>Não conferida</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Navegação e Paginação no Banco (Anterior / Próximo) */}
          <div className="p-4 sm:p-5 border-t border-slate-800/80 bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400 text-center sm:text-left">
              <span>
                Página <strong className="text-white font-mono">{dados.paginaAtual}</strong> de{' '}
                <strong className="text-white font-mono">{dados.totalPaginas}</strong>
              </span>
              <span className="mx-2 text-slate-600 hidden sm:inline">•</span>
              <span className="text-[11px] text-slate-500 block sm:inline mt-0.5 sm:mt-0">
                100 itens por página carregados diretamente do banco de dados
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-historico-anterior"
                onClick={handlePaginaAnterior}
                disabled={dados.paginaAtual <= 1 || loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed min-h-[40px] cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>

              <button
                type="button"
                id="btn-historico-proximo"
                onClick={handleProximaPagina}
                disabled={dados.paginaAtual >= dados.totalPaginas || loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed min-h-[40px] cursor-pointer"
              >
                <span>Próximo</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rodapé Informativo */}
      <div className="text-center text-[11px] text-slate-500 py-2">
        <span>Visualização somente leitura para auditoria e histórico de recebimentos do PoliHub.</span>
      </div>
    </div>
  );
};
