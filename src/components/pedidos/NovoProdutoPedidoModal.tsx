import React, { useState, useEffect } from 'react';
import { X, Save, Barcode, Package, MapPin, Hash, AlertCircle, Loader2 } from 'lucide-react';
import { ProdutoPedido, SeparacaoPedido } from '../../types';
import { pedidosService } from '../../services/pedidosService';
import { useAuth } from '../../context/AuthContext';
import { podeGerenciarPedidos } from '../../lib/permissions';

interface NovoProdutoPedidoModalProps {
  isOpen: boolean;
  onClose: () => void;
  pedido: SeparacaoPedido;
  produtoParaEdicao?: ProdutoPedido | null;
  onSalvo: (produto: ProdutoPedido) => void;
}

export const NovoProdutoPedidoModal: React.FC<NovoProdutoPedidoModalProps> = ({
  isOpen,
  onClose,
  pedido,
  produtoParaEdicao,
  onSalvo,
}) => {
  const { user } = useAuth();
  const podeGerenciar = podeGerenciarPedidos(user);

  const [codigoBarra, setCodigoBarra] = useState('');
  const [produto, setProduto] = useState('');
  const [locacao, setLocacao] = useState('');
  const [quantidade, setQuantidade] = useState<number | ''>(1);
  const [saldo, setSaldo] = useState<number | ''>(1);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (produtoParaEdicao) {
      setCodigoBarra(produtoParaEdicao.codigo_barra || '');
      setProduto(produtoParaEdicao.produto || '');
      setLocacao(produtoParaEdicao.locacao || '');
      setQuantidade(produtoParaEdicao.quantidade || 0);
      setSaldo(produtoParaEdicao.saldo !== undefined ? produtoParaEdicao.saldo : 0);
    } else {
      setCodigoBarra('');
      setProduto('');
      setLocacao('R01-P01-N1');
      setQuantidade(1);
      setSaldo(1);
    }
    setErro(null);
  }, [produtoParaEdicao, isOpen]);

  if (!isOpen) return null;

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!podeGerenciar) {
      setErro('Acesso restrito: Apenas usuários do Departamento de Logística têm permissão para cadastrar ou editar produtos do pedido.');
      return;
    }

    if (!produto.trim()) {
      setErro('A descrição do produto é obrigatória.');
      return;
    }

    setLoading(true);
    try {
      const qtdNum = typeof quantidade === 'number' ? quantidade : 0;
      const sldNum = typeof saldo === 'number' ? saldo : qtdNum;

      let salvo: ProdutoPedido;
      if (produtoParaEdicao) {
        salvo = await pedidosService.atualizarProdutoDoPedido(produtoParaEdicao.id, {
          codigo_barra: codigoBarra.trim(),
          produto: produto.trim(),
          locacao: locacao.trim(),
          quantidade: qtdNum,
          saldo: sldNum,
        });
      } else {
        salvo = await pedidosService.adicionarProdutoAoPedido({
          pedido_id: pedido.id,
          codigo_barra: codigoBarra.trim(),
          produto: produto.trim(),
          locacao: locacao.trim(),
          quantidade: qtdNum,
          saldo: sldNum,
        });
      }

      onSalvo(salvo);
      onClose();
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar produto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                Pedido #{pedido.id_pedido}
              </span>
              <span className="text-xs text-slate-400">Item do Pedido</span>
            </div>
            <h2 className="text-lg font-extrabold text-white">
              {produtoParaEdicao ? 'Editar Produto do Pedido' : '+ Adicionar Produto ao Pedido'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSalvar} className="p-6 space-y-4">
          {erro && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{erro}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Descrição do Produto *
            </label>
            <div className="relative">
              <Package className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={produto}
                onChange={(e) => setProduto(e.target.value)}
                placeholder="Ex: Filtro de Óleo Lubrificante P-550"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:border-blue-500 min-h-[44px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Código de Barras / EAN
            </label>
            <div className="relative">
              <Barcode className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={codigoBarra}
                onChange={(e) => setCodigoBarra(e.target.value)}
                placeholder="Ex: 7891234567890"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono min-h-[44px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Locação / Endereço
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={locacao}
                  onChange={(e) => setLocacao(e.target.value)}
                  placeholder="Ex: R01-P03-N1"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Quantidade *
              </label>
              <input
                type="number"
                min="0"
                required
                value={quantidade}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Number(e.target.value);
                  setQuantidade(val);
                  if (!produtoParaEdicao) {
                    setSaldo(val);
                  }
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-xs font-semibold focus:outline-none focus:border-blue-500 min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Saldo *
              </label>
              <input
                type="number"
                min="0"
                required
                value={saldo}
                onChange={(e) => setSaldo(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-xs font-semibold focus:outline-none focus:border-blue-500 min-h-[44px]"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition disabled:opacity-50 min-h-[44px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar Produto</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
