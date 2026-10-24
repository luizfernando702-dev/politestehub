import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  Search,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Database,
  Tag,
  FileText,
  Calendar,
  Layers,
  Power,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { RegistroEndereco } from '../../types';
import { enderecosService, MetricasEnderecos } from '../../services/enderecosService';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface EnderecamentoModuleProps {
  embedded?: boolean;
}

export const EnderecamentoModule: React.FC<EnderecamentoModuleProps> = ({ embedded = false }) => {
  const { user } = useAuth();
  const activeUserUnit = user?.unidade_negocio;
  const [enderecos, setEnderecos] = useState<RegistroEndereco[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Paginação Supabase: 40 registros por página
  const [page, setPage] = useState(1);
  const pageSize = 40;
  const [totalEnderecos, setTotalEnderecos] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filtros e Ordenação
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativos' | 'inativos'>('todos');
  const [ordenacao, setOrdenacao] = useState<'endereco_asc' | 'endereco_desc' | 'data_desc'>('endereco_asc');

  // Métricas
  const [metricas, setMetricas] = useState<MetricasEnderecos>({ total: 0, ativos: 0, inativos: 0 });

  // Modais de Criação e Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEndereco, setEditingEndereco] = useState<RegistroEndereco | null>(null);
  const [formEndereco, setFormEndereco] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formAtivo, setFormAtivo] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal de Exclusão
  const [deletingEndereco, setDeletingEndereco] = useState<RegistroEndereco | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showNotification = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const carregarDados = useCallback(async (isSilent = false, pageToLoad = page) => {
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const [resPaginado, kpis] = await Promise.all([
        enderecosService.listarPaginado({
          busca: search.trim() || undefined,
          status: statusFilter,
          unidade_negocio: activeUserUnit,
          page: pageToLoad,
          pageSize,
          ordenacao,
        }),
        enderecosService.obterMetricas(activeUserUnit),
      ]);
      setEnderecos(resPaginado.items);
      setTotalEnderecos(resPaginado.total);
      setTotalPages(resPaginado.totalPages);
      setMetricas(kpis);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar endereços do Supabase.';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, statusFilter, activeUserUnit, ordenacao]);

  // Reiniciar na primeira página ao alterar filtros ou busca
  useEffect(() => {
    setPage(1);
    carregarDados(false, 1);
  }, [search, statusFilter, ordenacao]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    carregarDados(false, newPage);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    carregarDados(true);
  };

  const handleOpenCreateModal = () => {
    setEditingEndereco(null);
    setFormEndereco('');
    setFormDescricao('');
    setFormAtivo(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: RegistroEndereco) => {
    setEditingEndereco(item);
    setFormEndereco(item.endereco);
    setFormDescricao(item.descricao || '');
    setFormAtivo(item.ativo);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveEndereco = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const limpo = formEndereco.trim();
    if (!limpo) {
      setFormError('Informe o código do endereço (ex: A-01-01, DOCA-01).');
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingEndereco) {
        await enderecosService.atualizar(editingEndereco.id, {
          endereco: limpo,
          descricao: formDescricao.trim() || null,
          ativo: formAtivo,
        });
        showNotification(`Endereço ${limpo} atualizado com sucesso no Supabase.`);
      } else {
        await enderecosService.criar({
          endereco: limpo,
          descricao: formDescricao.trim() || null,
          ativo: formAtivo,
          unidade_negocio: activeUserUnit,
        });
        showNotification(`Novo endereço ${limpo} cadastrado com sucesso no Supabase.`);
      }
      setIsModalOpen(false);
      carregarDados(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar endereço.';
      setFormError(msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleAtivo = async (item: RegistroEndereco) => {
    try {
      await enderecosService.alternarStatus(item.id, item.ativo);
      showNotification(`Endereço ${item.endereco} ${!item.ativo ? 'ativado' : 'desativado'} com sucesso.`);
      carregarDados(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao alterar status.';
      setError(msg);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingEndereco) return;
    setIsDeleting(true);
    try {
      await enderecosService.excluir(deletingEndereco.id);
      showNotification(`Endereço ${deletingEndereco.endereco} excluído com sucesso.`);
      setDeletingEndereco(null);
      carregarDados(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir endereço.';
      setError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-24 md:pb-12">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 rounded-2xl bg-emerald-950 border border-emerald-500/50 px-4 py-3 text-emerald-200 text-xs shadow-2xl animate-fade-in backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold">{successToast}</span>
        </div>
      )}

      {/* Header */}
      {!embedded ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <MapPin className="w-6 h-6 text-sky-400" />
              <span>Endereçamento Físico do Armazém</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Controle e gerenciamento das posições físicas de armazenagem
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition min-h-[44px]"
              title="Sincronizar dados com o Supabase"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden xs:inline">Sincronizar</span>
            </button>

            <button
              type="button"
              id="btn-novo-endereco"
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition min-h-[44px] active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Endereço</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-sky-400" />
              <span>Posições e Endereços Físicos</span>
            </h2>
            <p className="text-xs text-slate-400">
              Cadastro e gerenciamento de posições de armazenagem no galpão
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition min-h-[44px]"
              title="Sincronizar dados com o Supabase"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden xs:inline">Sincronizar</span>
            </button>

            <button
              type="button"
              id="btn-novo-endereco"
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs font-bold shadow-lg shadow-sky-600/30 transition min-h-[44px] active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Endereço</span>
            </button>
          </div>
        </div>
      )}

      {/* KPI Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-4 text-center sm:text-left">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total de Posições</span>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1 font-mono">{metricas.total}</div>
          <span className="text-[10px] text-slate-500">Cadastradas no banco</span>
        </div>
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-4 text-center sm:text-left">
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">Endereços Ativos</span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-300 mt-1 font-mono">{metricas.ativos}</div>
          <span className="text-[10px] text-slate-500">Disponíveis para uso</span>
        </div>
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-4 text-center sm:text-left">
          <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block">Inativos / Bloqueados</span>
          <div className="text-2xl sm:text-3xl font-black text-rose-300 mt-1 font-mono">{metricas.inativos}</div>
          <span className="text-[10px] text-slate-500">Fora de operação</span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-xs text-rose-300">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              id="input-search-enderecos"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código (ex: A-01-01) ou descrição..."
              className="w-full bg-slate-950/90 border border-slate-700/80 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500 transition min-h-[44px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              id="select-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'todos' | 'ativos' | 'inativos')}
              className="bg-slate-950/90 border border-slate-700/80 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-white focus:outline-hidden focus:border-sky-500 transition min-h-[44px]"
            >
              <option value="todos">Status: Todos</option>
              <option value="ativos">Apenas Ativos</option>
              <option value="inativos">Apenas Inativos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table / Grid of Endereços */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold text-white">Posições Físicas Cadastradas</h3>
            <span className="text-xs text-slate-400 font-mono">({enderecos.length} encontrados)</span>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-sky-400" />
            <p className="text-sm">Consultando posições de armazenagem no sistema...</p>
          </div>
        ) : enderecos.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <MapPin className="w-12 h-12 mx-auto text-slate-600" />
            <p className="text-base font-bold text-white">Nenhum endereço encontrado</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {search ? 'Nenhum resultado corresponde à busca.' : 'A tabela de endereços está vazia. Clique em "Novo Endereço" para cadastrar.'}
            </p>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Cadastrar Primeiro Endereço</span>
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/70 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4 font-bold">ID</th>
                  <th className="py-3 px-4 font-bold">Endereço (Código)</th>
                  <th className="py-3 px-4 font-bold">Descrição / Detalhes</th>
                  <th className="py-3 px-4 font-bold text-center">Status</th>
                  <th className="py-3 px-4 font-bold hidden md:table-cell">Criado em</th>
                  <th className="py-3 px-4 font-bold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {enderecos.map((item) => (
                  <tr
                    key={item.id}
                    id={`row-endereco-${item.id}`}
                    className="hover:bg-slate-800/40 transition group"
                  >
                    {/* ID */}
                    <td className="py-3.5 px-4 font-mono text-slate-400 font-semibold">
                      #{item.id}
                    </td>

                    {/* Endereço */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-white bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-700/80 shadow-inner group-hover:border-sky-500/50 transition">
                          {item.endereco}
                        </span>
                      </div>
                    </td>

                    {/* Descrição */}
                    <td className="py-3.5 px-4 text-slate-300">
                      {item.descricao ? (
                        <span>{item.descricao}</span>
                      ) : (
                        <span className="text-slate-500 italic">Sem descrição</span>
                      )}
                    </td>

                    {/* Status Ativo */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleAtivo(item)}
                        title={item.ativo ? 'Clique para desativar' : 'Clique para ativar'}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer active:scale-95 ${
                          item.ativo
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25'
                        }`}
                      >
                        {item.ativo ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Ativo</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                            <span>Inativo</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Data de Criação */}
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px] hidden md:table-cell">
                      {item.created_at ? (
                        new Date(item.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          id={`btn-editar-endereco-${item.id}`}
                          onClick={() => handleOpenEditModal(item)}
                          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          title="Editar endereço"
                        >
                          <Edit2 className="w-4 h-4 text-sky-400" />
                        </button>
                        <button
                          type="button"
                          id={`btn-excluir-endereco-${item.id}`}
                          onClick={() => setDeletingEndereco(item)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition"
                          title="Excluir endereço"
                        >
                          <Trash2 className="w-4 h-4 text-rose-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer info & Controles de Paginação Supabase (40/pág) */}
          <div className="p-4 bg-slate-950/80 border-t border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span>Total: <strong className="text-white font-mono">{totalEnderecos}</strong> endereços</span>
              <span className="text-slate-600">&bull;</span>
              <span className="text-slate-400">Página <strong className="text-white font-mono">{page}</strong> de <strong className="text-white font-mono">{totalPages}</strong> (40 por pág.)</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-enderecos-pagina-anterior"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1 || loading}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 font-semibold text-xs min-h-[36px]"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>

              <span className="px-3 py-1.5 font-mono font-bold text-white bg-slate-900 rounded-xl border border-slate-800 text-xs min-h-[36px] flex items-center justify-center">
                {page} / {totalPages}
              </span>

              <button
                type="button"
                id="btn-enderecos-proxima-pagina"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages || loading}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 font-semibold text-xs min-h-[36px]"
              >
                <span>Próxima</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
      </div>

      {/* MODAL: CRIAR OU EDITAR ENDEREÇO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 text-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingEndereco ? 'Editar Endereço' : 'Novo Endereço Físico'}
                  </h3>
                  <span className="text-[11px] text-slate-400">Posição física de armazenagem</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                &times;
              </button>
            </div>

            {formError && (
              <div className="flex items-start gap-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div className="flex-1">{formError}</div>
              </div>
            )}

            <form onSubmit={handleSaveEndereco} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Código do Endereço *
                </label>
                <input
                  type="text"
                  id="modal-input-endereco"
                  value={formEndereco}
                  onChange={(e) => setFormEndereco(e.target.value.toUpperCase())}
                  placeholder="Ex: A-01-01, DOCA-01, B-03-02"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-hidden focus:border-sky-500 transition min-h-[44px]"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Identificador exclusivo da posição no armazém.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Descrição / Localização
                </label>
                <textarea
                  id="modal-input-descricao"
                  value={formDescricao}
                  onChange={(e) => setFormDescricao(e.target.value)}
                  placeholder="Ex: Rua A, Prateleira 01, Nível Superior / Doca Norte de Recebimento"
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500 transition resize-none"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-xs font-bold text-white block">Status do Endereço</span>
                  <span className="text-[11px] text-slate-400">
                    {formAtivo ? 'Habilitado para recebimento e conferência' : 'Desabilitado temporariamente'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormAtivo(!formAtivo)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    formAtivo ? 'bg-blue-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200 ease-in-out ${
                      formAtivo ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={formSubmitting}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  id="btn-salvar-endereco"
                  disabled={formSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs transition shadow-md shadow-blue-600/30"
                >
                  {formSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>{editingEndereco ? 'Salvar Alterações' : 'Cadastrar Endereço'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR EXCLUSÃO */}
      {deletingEndereco && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 text-slate-100 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-white">Excluir Endereço?</h3>
            <p className="text-xs text-slate-400">
              Você tem certeza de que deseja remover permanentemente o endereço{' '}
              <strong className="text-white font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                {deletingEndereco.endereco}
              </strong>{' '}
              do sistema de armazenagem?
            </p>

            <div className="flex items-center justify-center gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingEndereco(null)}
                disabled={isDeleting}
                className="w-1/2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirmar-exclusao"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg transition"
              >
                {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
