import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Truck,
  Plus,
  Search,
  Calendar,
  Filter,
  RefreshCw,
  FileText,
  Building,
  Hash,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ShieldCheck,
  X,
  XCircle,
  Printer,
} from 'lucide-react';
import { ExpedicaoColeta, StatusColeta } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { isUserGestor } from '../../lib/permissions';
import { coletasService, ColetasFilters, SalvarColetaDTO, compararColetasPorStatus } from '../../services/coletasService';
import { podeGerenciarColetas } from '../../utils/permissoes';
import { ColetaModal } from './ColetaModal';
import { ConfiguracaoEtiquetaColetaModal } from '../impressao/ConfiguracaoEtiquetaColetaModal';

export const ColetasModule: React.FC = () => {
  const { user } = useAuth();
  const podeGerenciar = podeGerenciarColetas(user);

  // Estados de listagem e paginação
  const [coletas, setColetas] = useState<ExpedicaoColeta[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusColeta | 'Todos'>('Todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Modais
  const [modalOpen, setModalOpen] = useState(false);
  const [coletaEmEdicao, setColetaEmEdicao] = useState<ExpedicaoColeta | null>(null);
  const [coletaParaExcluir, setColetaParaExcluir] = useState<ExpedicaoColeta | null>(null);
  const [coletaParaImprimir, setColetaParaImprimir] = useState<ExpedicaoColeta | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // Feedback toast / banner
  const [feedback, setFeedback] = useState<{ message: string; isError?: boolean } | null>(null);

  const showFeedback = (message: string, isError = false) => {
    setFeedback({ message, isError });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  // Carregamento de coletas com filtros
  const carregarColetas = useCallback(
    async (currentPage = page) => {
      try {
        setLoading(true);
        const filters: ColetasFilters = {
          search: searchTerm,
          status: statusFilter,
          dataInicio: dataInicio || undefined,
          dataFim: dataFim || undefined,
          page: currentPage,
          pageSize,
          unidade_negocio: user?.unidade_negocio,
        };

        const result = await coletasService.listar(filters);
        setColetas(result.data);
        setTotal(result.total);
        setPage(result.page);
        setTotalPages(result.totalPages);
      } catch (err: any) {
        console.error('Erro ao carregar coletas:', err);
        showFeedback('Não foi possível carregar os registros de coletas.', true);
      } finally {
        setLoading(false);
      }
    },
    [searchTerm, statusFilter, dataInicio, dataFim, page, pageSize, user?.unidade_negocio]
  );

  useEffect(() => {
    carregarColetas(1);
  }, [searchTerm, statusFilter, dataInicio, dataFim]);

  // Contagens rápidas por status na página/lista atual
  const contadores = useMemo(() => {
    const pendentes = coletas.filter((c) => c.status === 'Agendada' || c.status === 'Pendente').length;
    const coletadas = coletas.filter((c) => c.status === 'Coletada').length;
    return { pendentes, agendadas: pendentes, coletadas };
  }, [coletas]);

  // Lista de coletas com ordenação estrita por status: Pendente / Agendada primeiro > Coletada por último
  const coletasOrdenadas = useMemo(() => {
    return [...coletas].sort(compararColetasPorStatus);
  }, [coletas]);

  // Salvar (Criar ou Atualizar)
  const handleSaveColeta = async (dados: SalvarColetaDTO) => {
    if (!user) return;
    try {
      if (coletaEmEdicao) {
        const atualizada = await coletasService.atualizar(coletaEmEdicao.id, dados, user);
        setColetas((prev) =>
          prev.map((c) => (c.id === atualizada.id ? atualizada : c)).sort(compararColetasPorStatus)
        );
        showFeedback(`Coleta da NF ${atualizada.numero_nota_fiscal} atualizada com sucesso.`);
      } else {
        const criada = await coletasService.criar(dados, user);
        setColetas((prev) => [criada, ...prev].sort(compararColetasPorStatus));
        setTotal((prev) => prev + 1);
        showFeedback(`Nova coleta da NF ${criada.numero_nota_fiscal} cadastrada com sucesso.`);
      }
      setColetaEmEdicao(null);
    } catch (err: any) {
      showFeedback(err?.message || 'Falha ao salvar coleta.', true);
      throw err;
    }
  };

  // Excluir Coleta (Com confirmação visual customizada)
  const handleConfirmarExclusao = async () => {
    if (!coletaParaExcluir || !user) return;
    try {
      setExcluindo(true);
      await coletasService.excluir(coletaParaExcluir.id, user);
      setColetas((prev) => prev.filter((c) => c.id !== coletaParaExcluir.id));
      setTotal((prev) => Math.max(0, prev - 1));
      showFeedback(`Coleta da NF ${coletaParaExcluir.numero_nota_fiscal} excluída com sucesso.`);
      setColetaParaExcluir(null);
    } catch (err: any) {
      showFeedback(err?.message || 'Falha ao excluir coleta.', true);
    } finally {
      setExcluindo(false);
    }
  };

  // Formatação de data/hora
  const formatarData = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  // Badge de Status com diferenciação visual nítida
  const renderStatusBadge = (status: StatusColeta) => {
    if (status === 'Coletada') {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm"
          title="Coleta realizada com sucesso"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          Coletada
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm"
        title="Coleta pendente / agendada na expedição"
      >
        <Clock className="w-3.5 h-3.5 text-amber-400" />
        {status === 'Agendada' ? 'Pendente' : status}
      </span>
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* 1. Header do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 p-0.5 shadow-lg shadow-blue-900/40 flex items-center justify-center">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Coletas da Expedição
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Expedição
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Controle de NFs agendadas e efetivamente coletadas pelas transportadoras
              </p>
            </div>
          </div>
        </div>

        {/* Permissão & Ação de Cadastro */}
        <div className="flex flex-wrap items-center gap-3 relative z-10">
          {/* Badge informativo de permissão */}
          {podeGerenciar ? (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium"
              title="Seu perfil/função permite adicionar, editar e excluir registros"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>
                {isUserGestor(user)
                  ? 'Gestor'
                  : user?.funcao || 'Operador / Assistente Logístico'}
              </span>
            </div>
          ) : (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 text-xs"
              title="Apenas gestores ou usuários com função Operador Logístico ou Assistente Logístico podem alterar registros"
            >
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Modo Consulta (Somente Leitura)</span>
            </div>
          )}

          {/* Botão Nova Coleta (Exibido apenas para autorizados) */}
          {podeGerenciar && (
            <button
              type="button"
              id="btn-nova-coleta"
              onClick={() => {
                setColetaEmEdicao(null);
                setModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition active:scale-[0.98] min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Coleta</span>
            </button>
          )}
        </div>
      </div>

      {/* Banner de Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm flex items-center justify-between shadow-lg transition-all animate-in fade-in duration-200 ${
            feedback.isError
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.isError ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Barra de Filtros e Pesquisa */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Campo de Pesquisa Geral */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              id="input-pesquisar-coletas"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por NF, Chave, Cliente ou Transportadora..."
              className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition min-h-[44px]"
            />
          </div>

          {/* Filtro de Status */}
          <div className="md:col-span-3 flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-2xl p-1">
            <button
              type="button"
              onClick={() => setStatusFilter('Todos')}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition text-center min-h-[36px] flex items-center justify-center ${
                statusFilter === 'Todos'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              id="filter-status-pendente"
              onClick={() => setStatusFilter('Pendente')}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition text-center min-h-[36px] flex items-center justify-center gap-1 ${
                statusFilter === 'Pendente' || statusFilter === 'Agendada'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-amber-300'
              }`}
            >
              <span>Pendente</span>
              {contadores.pendentes > 0 && (
                <span className="text-[10px] px-1 rounded-full bg-amber-500/30">
                  {contadores.pendentes}
                </span>
              )}
            </button>
            <button
              type="button"
              id="filter-status-coletada"
              onClick={() => setStatusFilter('Coletada')}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition text-center min-h-[36px] flex items-center justify-center gap-1 ${
                statusFilter === 'Coletada'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-emerald-300'
              }`}
            >
              <span>Coletada</span>
              {contadores.coletadas > 0 && (
                <span className="text-[10px] px-1 rounded-full bg-emerald-500/30">
                  {contadores.coletadas}
                </span>
              )}
            </button>
          </div>

          {/* Filtro por Período / Datas */}
          <div className="md:col-span-4 flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type="date"
                id="input-filtro-data-inicio"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:border-blue-500 transition min-h-[44px]"
                title="Data Início"
              />
            </div>
            <span className="text-slate-600 text-xs">até</span>
            <div className="flex-1 relative">
              <input
                type="date"
                id="input-filtro-data-fim"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:border-blue-500 transition min-h-[44px]"
                title="Data Fim"
              />
            </div>

            {(dataInicio || dataFim || searchTerm || statusFilter !== 'Todos') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('Todos');
                  setDataInicio('');
                  setDataFim('');
                }}
                className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Limpar todos os filtros"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => carregarColetas(page)}
              disabled={loading}
              className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Recarregar coletas"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Tabela Desktop / Cards Mobile */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
        {loading && coletas.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-400" />
            <p className="text-sm font-semibold text-white">Carregando coletas da expedição...</p>
            <p className="text-xs text-slate-500 mt-1">Consultando banco de dados</p>
          </div>
        ) : coletas.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <div className="w-14 h-14 rounded-3xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-500 mx-auto mb-3">
              <Truck className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white">Nenhuma coleta encontrada</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              {searchTerm || statusFilter !== 'Todos' || dataInicio || dataFim
                ? 'Nenhum registro corresponde aos filtros selecionados. Tente limpar os filtros.'
                : 'Não há registros de coletas cadastrados no momento.'}
            </p>
            {podeGerenciar && !searchTerm && statusFilter === 'Todos' && (
              <button
                type="button"
                onClick={() => {
                  setColetaEmEdicao(null);
                  setModalOpen(true);
                }}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar Primeira Coleta</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* 3.1 VISUALIZAÇÃO DESKTOP / TABLET (Tabela) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4 sm:px-6">Data</th>
                    <th className="py-3.5 px-4">Nota Fiscal / Chave</th>
                    <th className="py-3.5 px-4">Valor NF</th>
                    <th className="py-3.5 px-4">Cliente</th>
                    <th className="py-3.5 px-4">Transportadora</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Nº Coleta</th>
                    <th className="py-3.5 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {coletasOrdenadas.map((coleta) => (
                    <tr
                      key={coleta.id}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* Data */}
                      <td className="py-3.5 px-4 sm:px-6 text-slate-300 whitespace-nowrap">
                        <div className="font-mono text-xs">{formatarData(coleta.data)}</div>
                      </td>

                      {/* NF / Chave */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span>{coleta.numero_nota_fiscal}</span>
                        </div>
                        {coleta.chave_nf && (
                          <div
                            className="font-mono text-[10px] text-slate-400 truncate max-w-[200px]"
                            title={coleta.chave_nf}
                          >
                            Chave: {coleta.chave_nf}
                          </div>
                        )}
                      </td>

                      {/* Valor NF */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-200 font-mono">
                        {coleta.valor ? (
                          <span className="font-semibold text-emerald-400">
                            {coleta.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs italic">-</span>
                        )}
                      </td>

                      {/* Cliente */}
                      <td className="py-3.5 px-4 text-slate-200">
                        <div className="font-medium truncate max-w-[200px]" title={coleta.cliente}>
                          {coleta.cliente}
                        </div>
                      </td>

                      {/* Transportadora */}
                      <td className="py-3.5 px-4 text-slate-200">
                        <div className="flex items-center gap-1.5 font-medium truncate max-w-[180px]">
                          <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span title={coleta.transportadora}>{coleta.transportadora}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderStatusBadge(coleta.status)}
                      </td>

                      {/* Número da Coleta */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {coleta.numero_coleta ? (
                          <span className="font-mono font-bold text-slate-200 px-2 py-0.5 rounded bg-slate-800 border border-slate-700/80 text-xs">
                            {coleta.numero_coleta}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs italic">-</span>
                        )}
                      </td>

                      {/* Ações (Imprimir / Editar / Excluir) */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setColetaParaImprimir(coleta)}
                            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-emerald-600 hover:text-white text-emerald-400 flex items-center justify-center transition shadow-sm"
                            title="Imprimir Etiqueta Zebra"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {podeGerenciar && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setColetaEmEdicao(coleta);
                                  setModalOpen(true);
                                }}
                                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-400 flex items-center justify-center transition"
                                title="Editar coleta"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setColetaParaExcluir(coleta)}
                                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-400 flex items-center justify-center transition"
                                title="Excluir coleta"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 3.2 VISUALIZAÇÃO MOBILE (Cards Touch-Friendly) */}
            <div className="md:hidden divide-y divide-slate-800 p-3 space-y-3">
              {coletasOrdenadas.map((coleta) => (
                <div
                  key={coleta.id}
                  className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 text-sm font-black text-white">
                        <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                        <span>NF {coleta.numero_nota_fiscal}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {formatarData(coleta.data)}
                      </div>
                    </div>
                    <div>{renderStatusBadge(coleta.status)}</div>
                  </div>

                  <div className="space-y-1 text-xs text-slate-300">
                    <div>
                      <span className="text-slate-500 font-semibold">Cliente: </span>
                      <strong className="text-slate-100">{coleta.cliente}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-1.5">
                      <div>
                        <span className="text-slate-500 font-semibold">Transportadora: </span>
                        <strong className="text-slate-100">{coleta.transportadora}</strong>
                      </div>
                      {coleta.valor ? (
                        <div className="font-mono text-xs font-bold text-emerald-400">
                          {coleta.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                      ) : null}
                    </div>
                    {coleta.numero_coleta && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <span className="text-slate-500 font-semibold">Nº Coleta: </span>
                        <span className="font-mono font-bold text-blue-300 bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                          {coleta.numero_coleta}
                        </span>
                      </div>
                    )}
                    {coleta.chave_nf && (
                      <div className="text-[10px] text-slate-400 font-mono truncate pt-1">
                        Chave: {coleta.chave_nf}
                      </div>
                    )}
                  </div>

                  {/* Ações Mobile */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/70">
                    <button
                      type="button"
                      onClick={() => setColetaParaImprimir(coleta)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-emerald-600 text-xs font-semibold text-slate-200 hover:text-white transition min-h-[44px]"
                      title="Imprimir Etiqueta Zebra"
                    >
                      <Printer className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Etiqueta</span>
                    </button>
                    {podeGerenciar && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setColetaEmEdicao(coleta);
                            setModalOpen(true);
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition min-h-[44px]"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setColetaParaExcluir(coleta)}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-semibold transition min-h-[44px]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Excluir</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 4. Paginação */}
            <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
              <div>
                Mostrando <strong className="text-white">{coletas.length}</strong> de{' '}
                <strong className="text-white">{total}</strong> registros de coletas
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => carregarColetas(page - 1)}
                    disabled={page <= 1 || loading}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition min-h-[38px] min-w-[38px] flex items-center justify-center"
                    title="Página Anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 rounded-xl bg-slate-800 text-slate-200 font-mono">
                    Página {page} de {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => carregarColetas(page + 1)}
                    disabled={page >= totalPages || loading}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition min-h-[38px] min-w-[38px] flex items-center justify-center"
                    title="Próxima Página"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 5. Modal de Cadastro/Edição */}
      <ColetaModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setColetaEmEdicao(null);
        }}
        onSave={handleSaveColeta}
        coletaParaEditar={coletaEmEdicao}
      />

      {/* 6. Modal de Confirmação de Exclusão (Padrão visual PoliHub) */}
      {coletaParaExcluir && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-white">Confirmar Exclusão de Coleta</h3>
              <p className="text-xs text-slate-400 mt-1">
                Tem certeza de que deseja excluir a coleta da NF{' '}
                <strong className="text-white font-mono">{coletaParaExcluir.numero_nota_fiscal}</strong>?
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1 text-slate-300">
              <div>
                <span className="text-slate-500 font-semibold">Cliente: </span>
                <span className="text-white">{coletaParaExcluir.cliente}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">Transportadora: </span>
                <span className="text-white">{coletaParaExcluir.transportadora}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">Status: </span>
                <span className="text-white">{coletaParaExcluir.status}</span>
              </div>
              {coletaParaExcluir.numero_coleta && (
                <div>
                  <span className="text-slate-500 font-semibold">Nº Coleta: </span>
                  <span className="text-blue-300 font-mono font-bold">
                    {coletaParaExcluir.numero_coleta}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setColetaParaExcluir(null)}
                disabled={excluindo}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition min-h-[44px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarExclusao}
                disabled={excluindo}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition active:scale-[0.98] min-h-[44px]"
              >
                {excluindo ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Impressão Centralizado de Etiquetas Zebra */}
      {coletaParaImprimir && (
        <ConfiguracaoEtiquetaColetaModal
          coleta={coletaParaImprimir}
          onClose={() => setColetaParaImprimir(null)}
        />
      )}
    </div>
  );
};
