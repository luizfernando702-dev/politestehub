import React, { useState, useEffect } from 'react';
import { Plus, Search, AlertCircle, CheckCircle2, X, Package, Loader2 } from 'lucide-react';
import { Produto, ItemParaContagem } from '../../types';
import { produtosService } from '../../services/produtosService';
import { inventarioService } from '../../services/inventarioService';

interface AdicionarProdutoInventarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  endereco: string;
  usuarioId: string;
  contagem?: string;
  onProdutoAdicionado: (novoItem: ItemParaContagem) => void;
}

export const AdicionarProdutoInventarioModal: React.FC<AdicionarProdutoInventarioModalProps> = ({
  isOpen,
  onClose,
  endereco,
  usuarioId,
  contagem,
  onProdutoAdicionado,
}) => {
  const [busca, setBusca] = useState('');
  const [sugestoes, setSugestoes] = useState<Produto[]>([]);
  const [carregandoSugestoes, setCarregandoSugestoes] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<string>('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setBusca('');
      setProdutoSelecionado('');
      setErro(null);
      setSucesso(null);
      setSugestoes([]);
      return;
    }

    let isMounted = true;
    const buscarProdutos = async () => {
      try {
        setCarregandoSugestoes(true);
        const lista = await produtosService.list(busca);
        if (isMounted) {
          setSugestoes(lista.slice(0, 10));
        }
      } catch (err) {
        console.warn('Erro ao listar produtos:', err);
      } finally {
        if (isMounted) {
          setCarregandoSugestoes(false);
        }
      }
    };

    const timer = setTimeout(buscarProdutos, 250);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [busca, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeProduto = (produtoSelecionado || busca).trim();

    if (!nomeProduto) {
      setErro('Selecione ou informe a descrição do produto.');
      return;
    }

    try {
      setSalvando(true);
      setErro(null);
      const novo = await inventarioService.adicionarProdutoAoInventario({
        endereco,
        produto: nomeProduto,
        usuarioId,
        contagem,
      });

      setSucesso(`Produto "${novo.produto}" adicionado com sucesso ao endereço ${endereco}!`);
      setTimeout(() => {
        onProdutoAdicionado(novo);
        onClose();
      }, 1000);
    } catch (err: any) {
      setErro(err.message || 'Erro ao adicionar produto.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">Adicionar Produto ao Endereço</h3>
              <p className="text-xs text-slate-400">
                Endereço: <span className="text-blue-400 font-mono font-bold">{endereco}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {erro && (
            <div className="p-3.5 rounded-2xl bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1 font-medium">{erro}</div>
            </div>
          )}

          {sucesso && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-800/80 text-emerald-300 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <div className="flex-1 font-medium">{sucesso}</div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Buscar Produto no Catálogo ou Digitar Novo
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setProdutoSelecionado('');
                  setErro(null);
                }}
                placeholder="Ex: Nescafé, Filtro, Refil..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
              />
            </div>
          </div>

          {/* Sugestões de produtos */}
          {sugestoes.length > 0 && !produtoSelecionado && (
            <div className="border border-slate-800 rounded-2xl bg-slate-950/60 p-2 space-y-1 max-h-48 overflow-y-auto">
              <div className="text-[11px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
                Sugestões Encontradas ({sugestoes.length})
              </div>
              {sugestoes.map((prod) => (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => {
                    setProdutoSelecionado(prod.produto);
                    setBusca(prod.produto);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-200 hover:bg-slate-800/80 hover:text-white flex items-center justify-between transition"
                >
                  <span className="font-semibold">{prod.produto}</span>
                  {prod.fabricante && (
                    <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md">
                      {prod.fabricante}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {produtoSelecionado && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-400" />
                <span>
                  Selecionado: <strong>{produtoSelecionado}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setProdutoSelecionado('')}
                className="text-[11px] text-slate-400 hover:text-white underline"
              >
                Limpar
              </button>
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="px-4 py-2.5 rounded-2xl border border-slate-800 text-slate-400 hover:text-white text-xs font-bold transition min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || (!produtoSelecionado && !busca.trim())}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition disabled:opacity-50 min-h-[44px]"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validando e Salvando...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Adicionar ao Endereço</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
