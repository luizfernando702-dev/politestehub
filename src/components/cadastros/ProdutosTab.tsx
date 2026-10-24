import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  Package,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  MapPin,
  Building2,
  X,
  Barcode,
  Printer,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Produto, Usuario } from '../../types';
import { produtosService } from '../../services/produtosService';
import { ConfiguracaoEtiquetaProdutoCadastroModal } from '../impressao/ConfiguracaoEtiquetaProdutoCadastroModal';

interface ProdutosTabProps {
  currentUser: Usuario | null;
  isGestor: boolean;
}

export const ProdutosTab: React.FC<ProdutosTabProps> = ({ currentUser, isGestor }) => {
  const [items, setItems] = useState<Produto[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Paginação Supabase: 10 registros por página
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modal State (Create / Edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<Produto | null>(null);
  const [formData, setFormData] = useState({
    produto: '',
    codigo_barras: '',
    fabricante: '',
    endereco: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Deletion confirmation state
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<Produto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null);

  // Estados para Impressão de Etiquetas Zebra
  const [printProduto, setPrintProduto] = useState<Produto | null>(null);
  const [printModo, setPrintModo] = useState<'avulsa' | 'avaria'>('avulsa');

  const loadData = async (force = false, pageToLoad = page) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const resp = await produtosService.listPaginated({
        search: search.trim() || undefined,
        page: pageToLoad,
        pageSize,
      });
      setItems(resp.items);
      setTotalItems(resp.total);
      setTotalPages(resp.totalPages);
    } catch (err) {
      console.warn('Erro ao carregar produtos:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Reiniciar na primeira página ao alterar filtros de busca
  useEffect(() => {
    setPage(1);
    loadData(false, 1);
  }, [search]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    loadData(false, newPage);
  };

  const handleOpenCreate = () => {
    setItemToEdit(null);
    setFormData({ produto: '', codigo_barras: '', fabricante: '', endereco: '' });
    setFormError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: Produto) => {
    setItemToEdit(item);
    setFormData({
      produto: item.produto,
      codigo_barras: item.codigo_barras || '',
      fabricante: item.fabricante || '',
      endereco: item.endereco || '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeLimpo = formData.produto.trim();
    if (!nomeLimpo) {
      setFormError('O nome do produto é obrigatório.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      if (itemToEdit) {
        const updated = await produtosService.update(itemToEdit.id, {
          produto: nomeLimpo,
          codigo_barras: formData.codigo_barras.trim() || undefined,
          fabricante: formData.fabricante.trim() || undefined,
          endereco: formData.endereco.trim() || undefined,
        });
        setItems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        setFeedback({ message: `Produto "${updated.produto}" atualizado com sucesso!`, isError: false });
      } else {
        const created = await produtosService.create({
          produto: nomeLimpo,
          codigo_barras: formData.codigo_barras.trim() || undefined,
          fabricante: formData.fabricante.trim() || undefined,
          endereco: formData.endereco.trim() || undefined,
        });
        setItems((prev) => [created, ...prev]);
        setFeedback({ message: `Produto "${created.produto}" cadastrado com sucesso!`, isError: false });
      }
      setModalOpen(false);
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar produto.';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmItem) return;
    setIsDeleting(true);
    try {
      await produtosService.delete(deleteConfirmItem.id);
      setItems((prev) => prev.filter((p) => p.id !== deleteConfirmItem.id));
      setFeedback({ message: `Produto "${deleteConfirmItem.produto}" removido com sucesso.`, isError: false });
      setDeleteConfirmItem(null);
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir produto.';
      setFeedback({ message: msg, isError: true });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const s = search.trim().toLowerCase();
    return items.filter(
      (p) =>
        p.produto.toLowerCase().includes(s) ||
        (p.codigo_barras && p.codigo_barras.toLowerCase().includes(s)) ||
        (p.fabricante && p.fabricante.toLowerCase().includes(s)) ||
        (p.endereco && p.endereco.toLowerCase().includes(s))
    );
  }, [items, search]);

  return (
    <div className="space-y-4">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`flex items-center gap-2 p-3.5 rounded-2xl text-xs sm:text-sm font-semibold shadow-lg transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${
            feedback.isError
              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
              : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
          }`}
        >
          {feedback.isError ? (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          ) : (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Control Bar: Search + Add Product */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            id="input-busca-produtos"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por produto, código de barras, fabricante ou endereço..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition min-h-[44px]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            id="btn-refresh-produtos"
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition min-h-[44px]"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          {isGestor && (
            <button
              type="button"
              id="btn-novo-produto"
              onClick={handleOpenCreate}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-900/40 transition min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>+ Novo Produto</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Table: Produto | Cód. Barras | Fabricante | Endereço | Ações */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Produto</th>
                <th className="py-3 px-4">Cód. Barras</th>
                <th className="py-3 px-4">Fabricante</th>
                <th className="py-3 px-4">Endereço</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-400 mb-2" />
                    <span>Carregando catálogo de produtos...</span>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <Package className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="font-semibold text-white">Nenhum produto encontrado</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {search ? 'Tente ajustar os termos da pesquisa.' : 'Clique em "+ Novo Produto" para cadastrar.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    {/* Coluna 1: Produto */}
                    <td className="py-3 px-4 font-semibold text-white">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4" />
                        </div>
                        <span className="break-words">{item.produto}</span>
                      </div>
                    </td>

                    {/* Coluna 2: Código de Barras */}
                    <td className="py-3 px-4">
                      {item.codigo_barras ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700/80 text-emerald-400 font-mono text-xs font-semibold">
                          <Barcode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{item.codigo_barras}</span>
                        </span>
                      ) : (
                        <span className="text-slate-600 italic">Sem código</span>
                      )}
                    </td>

                    {/* Coluna 3: Fabricante */}
                    <td className="py-3 px-4 text-slate-300">
                      {item.fabricante ? (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{item.fabricante}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600 italic">Não informado</span>
                      )}
                    </td>

                    {/* Coluna 4: Endereço */}
                    <td className="py-3 px-4">
                      {item.endereco ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-950/80 border border-sky-800/50 text-sky-300 font-mono text-xs font-bold">
                          <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          {item.endereco}
                        </span>
                      ) : (
                        <span className="text-slate-600 italic">Sem endereço</span>
                      )}
                    </td>

                    {/* Coluna 5: Ações */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* 1. Botão Verde: Etiqueta Avulsa (Identificação / Local) */}
                        <button
                          type="button"
                          id={`btn-print-avulsa-${item.id}`}
                          onClick={() => {
                            setPrintProduto(item);
                            setPrintModo('avulsa');
                          }}
                          className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-700/60 text-emerald-400 hover:text-emerald-200 hover:bg-emerald-900/70 hover:border-emerald-500 transition min-h-[36px] flex items-center justify-center shadow-xs group/btn-avulsa"
                          title="Imprimir Etiqueta Avulsa (Identificação / Local)"
                        >
                          <Printer className="w-3.5 h-3.5 group-hover/btn-avulsa:scale-110 transition-transform" />
                        </button>

                        {/* 2. Botão Vermelho: Etiqueta de Avaria */}
                        <button
                          type="button"
                          id={`btn-print-avaria-${item.id}`}
                          onClick={() => {
                            setPrintProduto(item);
                            setPrintModo('avaria');
                          }}
                          className="p-2 rounded-lg bg-rose-950/60 border border-rose-700/60 text-rose-400 hover:text-rose-200 hover:bg-rose-900/70 hover:border-rose-500 transition min-h-[36px] flex items-center justify-center shadow-xs group/btn-avaria"
                          title="Imprimir Etiqueta de Avaria"
                        >
                          <Printer className="w-3.5 h-3.5 group-hover/btn-avaria:scale-110 transition-transform" />
                        </button>

                        <button
                          type="button"
                          id={`btn-edit-prod-${item.id}`}
                          onClick={() => handleOpenEdit(item)}
                          className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-blue-400 hover:border-blue-500/40 transition min-h-[36px]"
                          title="Editar Produto"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          id={`btn-delete-prod-${item.id}`}
                          onClick={() => setDeleteConfirmItem(item)}
                          className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition min-h-[36px]"
                          title="Excluir Produto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info & Controles de Paginação Supabase (10/pág) */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>Total: <strong className="text-white font-mono">{totalItems}</strong> produtos</span>
            <span className="text-slate-600">&bull;</span>
            <span className="text-slate-400">Página <strong className="text-white font-mono">{page}</strong> de <strong className="text-white font-mono">{totalPages}</strong> (10 por pág.)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-produtos-pagina-anterior"
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
              id="btn-produtos-proxima-pagina"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages || loading}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 font-semibold text-xs min-h-[36px]"
            >
              <span>Próxima</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Adicionar / Editar Produto */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">
                  {itemToEdit ? 'Editar Produto' : 'Cadastrar Novo Produto'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5 text-left">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Produto <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  id="modal-input-produto"
                  required
                  value={formData.produto}
                  onChange={(e) => setFormData({ ...formData, produto: e.target.value })}
                  placeholder="Ex: Nescafé Tradicional Vidro 200g"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition min-h-[44px]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-300">
                    Código de Barras (EAN / GTIN / Leitor)
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">Opcional</span>
                </div>
                <div className="relative">
                  <Barcode className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    id="modal-input-codigo-barras"
                    value={formData.codigo_barras}
                    onChange={(e) => setFormData({ ...formData, codigo_barras: e.target.value })}
                    placeholder="Ex: 7891000100103 (ou bipe com leitor)"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition font-mono min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Fabricante
                </label>
                <input
                  type="text"
                  id="modal-input-fabricante"
                  value={formData.fabricante}
                  onChange={(e) => setFormData({ ...formData, fabricante: e.target.value })}
                  placeholder="Ex: Nestlé Brasil"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Endereço
                </label>
                <input
                  type="text"
                  id="modal-input-endereco"
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value.toUpperCase() })}
                  placeholder="Ex: R01-C01-P01-N1"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition font-mono uppercase min-h-[44px]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  id="btn-cancelar-produto"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  id="btn-salvar-produto"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-lg shadow-blue-900/40 transition min-h-[44px]"
                >
                  {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{itemToEdit ? 'Salvar Alterações' : 'Salvar Produto'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmação de Exclusão */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">Excluir Produto?</h3>
              <p className="text-xs text-slate-400">
                Tem certeza que deseja remover o produto <strong className="text-white">{deleteConfirmItem.produto}</strong>?
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                id="btn-cancelar-delete"
                onClick={() => setDeleteConfirmItem(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition min-h-[44px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirmar-delete"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg shadow-rose-900/30 transition min-h-[44px]"
              >
                {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Impressão de Etiquetas Zebra (Etiqueta Avulsa / Etiqueta de Avaria) */}
      {printProduto && (
        <ConfiguracaoEtiquetaProdutoCadastroModal
          produto={printProduto}
          initialMode={printModo}
          onClose={() => setPrintProduto(null)}
        />
      )}
    </div>
  );
};

