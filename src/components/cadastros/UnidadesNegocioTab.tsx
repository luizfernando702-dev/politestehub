import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  Building2,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  MapPin,
  Tag,
  Shield,
  Layers,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { UnidadeNegocio, Usuario } from '../../types';
import { unidadesNegocioService } from '../../services/unidadesNegocioService';
import { UnidadeNegocioModal } from './UnidadeNegocioModal';
import { UNIDADE_PADRAO_SISTEMA } from '../../constants/unidades';

interface UnidadesNegocioTabProps {
  currentUser: Usuario | null;
  isGestor: boolean;
}

export const UnidadesNegocioTab: React.FC<UnidadesNegocioTabProps> = ({ isGestor }) => {
  const [items, setItems] = useState<UnidadeNegocio[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<UnidadeNegocio | null>(null);

  // Deletion state
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<UnidadeNegocio | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<{ message: string; isError: boolean } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await unidadesNegocioService.listar(search, force);
      setItems(data);
    } catch (err) {
      console.warn('Erro ao carregar unidades de negócio:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, [search]);

  const handleOpenCreate = () => {
    setItemToEdit(null);
    setDeleteFeedback(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: UnidadeNegocio) => {
    setItemToEdit(item);
    setDeleteFeedback(null);
    setModalOpen(true);
  };

  const handleSave = async (dados: {
    nome: string;
    sigla?: string | null;
    cidade?: string | null;
    estado?: string | null;
    ativo?: boolean;
  }) => {
    if (itemToEdit) {
      const updated = await unidadesNegocioService.atualizar(itemToEdit.id, dados);
      setItems((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } else {
      const created = await unidadesNegocioService.criar(dados);
      setItems((prev) => [created, ...prev]);
    }
  };

  const handleToggleStatus = async (item: UnidadeNegocio) => {
    if (!isGestor) return;
    setDeleteFeedback(null);
    try {
      const novoStatus = item.ativo === false ? true : false;
      const updated = await unidadesNegocioService.alternarStatus(item.id, novoStatus);
      setItems((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao alterar o status da unidade.';
      setDeleteFeedback({ message: msg, isError: true });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmItem) return;
    setIsDeleting(true);
    setDeleteFeedback(null);
    try {
      await unidadesNegocioService.excluir(deleteConfirmItem.id, deleteConfirmItem.nome);
      setItems((prev) => prev.filter((u) => u.id !== deleteConfirmItem.id));
      setDeleteConfirmItem(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao excluir a unidade.';
      setDeleteFeedback({ message: msg, isError: true });
      await loadData(true);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const s = search.trim().toLowerCase();
    return items.filter(
      (u) =>
        u.nome.toLowerCase().includes(s) ||
        (u.sigla && u.sigla.toLowerCase().includes(s)) ||
        (u.cidade && u.cidade.toLowerCase().includes(s)) ||
        (u.estado && u.estado.toLowerCase().includes(s))
    );
  }, [items, search]);

  const ativasCount = useMemo(() => items.filter((u) => u.ativo !== false).length, [items]);

  return (
    <div className="space-y-5">
      {/* 1. TOP CARDS SUMMARY */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
              Total de Unidades
            </div>
            <div className="text-xl font-bold text-white tracking-tight">
              {items.length}
            </div>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
              Unidades Ativas
            </div>
            <div className="text-xl font-bold text-emerald-400 tracking-tight">
              {ativasCount}
            </div>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
              Unidade Padrão
            </div>
            <div className="text-sm font-bold text-purple-300 tracking-tight truncate max-w-[140px]">
              {UNIDADE_PADRAO_SISTEMA}
            </div>
          </div>
        </div>
      </div>

      {/* 2. TOP ACTION BAR & SEARCH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3.5 sm:p-4 shadow-sm">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            id="input-search-unidades"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, sigla, cidade ou estado..."
            className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition min-h-[44px]"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id="btn-refresh-unidades"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          {isGestor ? (
            <button
              type="button"
              id="btn-nova-unidade"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-blue-900/30 whitespace-nowrap min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Unidade</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-400 text-xs">
              <Shield className="w-3.5 h-3.5 text-slate-300" />
              <span>Somente Gestores</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. FEEDBACK BANNER (ERROS / AVISOS) */}
      {deleteFeedback && (
        <div
          className={`p-4 rounded-2xl flex items-start gap-3 text-xs sm:text-sm animate-in fade-in duration-150 ${
            deleteFeedback.isError
              ? 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
              : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
          }`}
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
          <div className="flex-1">
            <span className="font-semibold">{deleteFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeleteFeedback(null)}
            className="text-slate-400 hover:text-white text-xs underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* 4. TABLE / LIST */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            <span>Carregando unidades de negócio...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-slate-400 px-4">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-600 opacity-60" />
            <p className="text-base font-bold text-slate-300">Nenhuma unidade de negócio encontrada</p>
            <p className="text-xs text-slate-300 mt-1 max-w-md mx-auto">
              {search
                ? `Nenhum resultado corresponde à busca "${search}".`
                : 'Cadastre a primeira filial para segregar os agendamentos e estoques.'}
            </p>
            {isGestor && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition min-h-[40px]"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar Unidade Agora</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Unidade / Filial</th>
                  <th className="py-3.5 px-4">Sigla</th>
                  <th className="py-3.5 px-4">Localização (Cidade/UF)</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredItems.map((item) => {
                  const isAtivo = item.ativo !== false;
                  const isPadrao = item.nome.trim().toLowerCase() === UNIDADE_PADRAO_SISTEMA.toLowerCase();

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* Nome */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isAtivo
                                ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                                : 'bg-slate-800 border border-slate-700 text-slate-500'
                            }`}
                          >
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">
                                {item.nome}
                              </span>
                              {isPadrao && (
                                <span className="text-[10px] uppercase tracking-wider font-bold bg-purple-500/10 border border-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
                                  Padrão
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-300 font-mono">
                              ID: {item.id.substring(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Sigla */}
                      <td className="py-3.5 px-4">
                        {item.sigla ? (
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-sky-300 bg-sky-950/60 border border-sky-800/40 px-2 py-0.5 rounded-lg text-xs">
                            <Tag className="w-3 h-3 text-sky-400" />
                            <span>{item.sigla}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300 italic">-</span>
                        )}
                      </td>

                      {/* Localização */}
                      <td className="py-3.5 px-4 text-slate-300">
                        {item.cidade || item.estado ? (
                          <div className="flex items-center gap-1.5 text-xs text-slate-300">
                            <MapPin className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                            <span>
                              {item.cidade || 'Cidade não informada'}
                              {item.estado ? ` - ${item.estado}` : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 italic">Não informada</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          disabled={!isGestor}
                          onClick={() => handleToggleStatus(item)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition ${
                            isAtivo
                              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700/50'
                          } ${!isGestor ? 'cursor-default' : 'cursor-pointer'}`}
                          title={isGestor ? (isAtivo ? 'Clique para inativar' : 'Clique para ativar') : undefined}
                        >
                          {isAtivo ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Ativa</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" />
                              <span>Inativa</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isGestor ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(item)}
                                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition min-h-[36px] min-w-[36px] flex items-center justify-center"
                                title="Editar unidade"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteConfirmItem(item);
                                  setDeleteFeedback(null);
                                }}
                                className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition min-h-[36px] min-w-[36px] flex items-center justify-center"
                                title="Excluir unidade"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="text-slate-600 text-xs italic">Consulta</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. MODAL DE CADASTRO / EDIÇÃO */}
      <UnidadeNegocioModal
        isOpen={modalOpen}
        itemToEdit={itemToEdit}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />

      {/* 6. MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {deleteConfirmItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 text-slate-100 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-white text-center">
              Excluir Unidade de Negócio?
            </h3>
            <p className="text-xs text-slate-400 text-center mt-2 leading-relaxed">
              Você tem certeza que deseja remover a filial{' '}
              <strong className="text-white">&ldquo;{deleteConfirmItem.nome}&rdquo;</strong>?
            </p>
            <div className="mt-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400">
              <span className="font-semibold text-amber-400">Atenção:</span> Caso existam agendamentos, tarefas ou usuários vinculados a esta unidade, ela será inativada para manter a integridade dos dados históricos.
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition min-h-[44px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirmar-exclusao-unidade"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-900/30 disabled:opacity-50 min-h-[44px]"
              >
                {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
