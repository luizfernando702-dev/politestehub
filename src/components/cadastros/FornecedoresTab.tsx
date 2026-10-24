import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Building2, Edit2, Trash2, ShieldAlert, AlertCircle, RefreshCw, Lock } from 'lucide-react';
import { Fornecedor, Usuario } from '../../types';
import { cadastrosService } from '../../services/cadastrosService';
import { CadastroModal } from './CadastroModal';

interface FornecedoresTabProps {
  currentUser: Usuario | null;
  isGestor: boolean;
}

export const FornecedoresTab: React.FC<FornecedoresTabProps> = ({ currentUser, isGestor }) => {
  const [items, setItems] = useState<Fornecedor[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<Fornecedor | null>(null);

  // Deletion confirmation state
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<Fornecedor | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<{ message: string; isError: boolean } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await cadastrosService.listFornecedores(search, force);
      setItems(data);
    } catch (err) {
      console.warn('Erro ao carregar fornecedores:', err);
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
    setModalOpen(true);
  };

  const handleOpenEdit = (item: Fornecedor) => {
    setItemToEdit(item);
    setModalOpen(true);
  };

  const handleSave = async (data: { razao_social: string; nome_fantasia: string }) => {
    if (itemToEdit) {
      const updated = await cadastrosService.updateFornecedor(itemToEdit.id, data);
      setItems((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    } else {
      const created = await cadastrosService.createFornecedor(data);
      setItems((prev) => [created, ...prev]);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmItem) return;
    setIsDeleting(true);
    setDeleteFeedback(null);
    try {
      await cadastrosService.deleteFornecedor(deleteConfirmItem.id, deleteConfirmItem.nome_fantasia);
      setItems((prev) => prev.filter((f) => f.id !== deleteConfirmItem.id));
      setDeleteConfirmItem(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar exclusão.';
      setDeleteFeedback({ message: msg, isError: true });
      await loadData(true);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStatus = async (item: Fornecedor) => {
    if (!isGestor) return;
    try {
      const newStatus = item.ativo === false ? true : false;
      const updated = await cadastrosService.updateFornecedor(item.id, {
        razao_social: item.razao_social,
        nome_fantasia: item.nome_fantasia,
        ativo: newStatus,
      });
      setItems((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    } catch (err) {
      console.warn('Erro ao alterar status:', err);
    }
  };

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const s = search.trim().toLowerCase();
    return items.filter(
      (f) =>
        f.nome_fantasia.toLowerCase().includes(s) ||
        f.razao_social.toLowerCase().includes(s)
    );
  }, [items, search]);

  return (
    <div className="space-y-4">
      {/* Top action bar & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3.5 sm:p-4 shadow-sm">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            id="input-search-fornecedores"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por Fornecedor, Fábrica ou Razão Social..."
            className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 transition min-h-[44px]"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id="btn-refresh-fornecedores"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          {isGestor ? (
            <button
              type="button"
              id="btn-novo-fornecedor"
              onClick={handleOpenCreate}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-900/30 transition min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Fornecedor</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-400">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Apenas Gestores podem cadastrar</span>
            </div>
          )}
        </div>
      </div>

      {/* List content */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
          <p className="text-xs">Carregando fornecedores cadastrados...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white">Nenhum fornecedor encontrado</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {search ? 'Nenhum resultado corresponde aos termos da pesquisa.' : 'Nenhum fornecedor cadastrado no momento.'}
          </p>
          {isGestor && !search && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Primeiro Fornecedor</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl border ${
                item.ativo === false
                  ? 'border-slate-800 bg-slate-900/40 opacity-70'
                  : 'border-slate-800/90 bg-slate-900/80 hover:border-slate-700'
              } p-4 transition-all shadow-sm flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white truncate" title={item.nome_fantasia}>
                          {item.nome_fantasia}
                        </h4>
                        {item.ativo === false ? (
                          <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded">
                            Inativo
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                            Ativo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5" title={item.razao_social}>
                        {item.razao_social}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action row */}
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-300 font-mono">
                  ID: {item.id.slice(0, 8)}...
                </span>

                <div className="flex items-center gap-1.5">
                  {isGestor && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-medium transition ${
                          item.ativo === false
                            ? 'text-emerald-400 hover:bg-emerald-500/10'
                            : 'text-slate-400 hover:bg-slate-800'
                        }`}
                        title={item.ativo === false ? 'Reativar fornecedor' : 'Inativar fornecedor'}
                      >
                        {item.ativo === false ? 'Reativar' : 'Inativar'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition min-h-[36px] min-w-[36px] flex items-center justify-center"
                        title="Editar fornecedor"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDeleteFeedback(null);
                          setDeleteConfirmItem(item);
                        }}
                        className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition min-h-[36px] min-w-[36px] flex items-center justify-center"
                        title="Excluir fornecedor"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Add / Edit */}
      <CadastroModal
        type="fornecedor"
        isOpen={modalOpen}
        itemToEdit={itemToEdit}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />

      {/* Delete confirmation modal */}
      {deleteConfirmItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
        >
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-5 sm:p-6 text-slate-100 my-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3.5">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-white tracking-tight">
              Confirmar Exclusão
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              Deseja realmente excluir este cadastro?
            </p>

            <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-xs font-bold text-white">{deleteConfirmItem.nome_fantasia}</div>
              <div className="text-[11px] text-slate-400">{deleteConfirmItem.razao_social}</div>
            </div>

            {deleteFeedback && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-300">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{deleteFeedback.message}</div>
              </div>
            )}

            <div className="mt-5 pt-3 border-t border-slate-800 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmItem(null);
                  setDeleteFeedback(null);
                }}
                disabled={isDeleting}
                className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition min-h-[40px]"
              >
                {deleteFeedback ? 'Fechar' : 'Cancelar'}
              </button>
              {!deleteFeedback && (
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition min-h-[40px] disabled:opacity-50"
                >
                  {isDeleting ? 'Verificando...' : 'Excluir Cadastro'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
