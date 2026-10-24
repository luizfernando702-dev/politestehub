import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Plus,
  FileSpreadsheet,
  Download,
  Barcode,
  Package,
  MapPin,
  Trash2,
  Edit2,
  AlertCircle,
  ArrowLeft,
  Search,
  CheckCircle2,
  RefreshCw,
  Info,
  Lock,
} from 'lucide-react';
import { ProdutoPedido, SeparacaoPedido } from '../../types';
import { pedidosService } from '../../services/pedidosService';
import { useAuth } from '../../context/AuthContext';
import { podeGerenciarPedidos } from '../../lib/permissions';
import { NovoProdutoPedidoModal } from './NovoProdutoPedidoModal';
import { ImportarProdutosModal } from './ImportarProdutosModal';

interface ProdutosPedidoTabProps {
  pedidoSelecionado: SeparacaoPedido | null;
  onVoltarParaSeparacao: () => void;
  pedidosDisponiveis: SeparacaoPedido[];
  onSelecionarPedido: (pedido: SeparacaoPedido) => void;
  podeGerenciar?: boolean;
}

export const ProdutosPedidoTab: React.FC<ProdutosPedidoTabProps> = ({
  pedidoSelecionado,
  onVoltarParaSeparacao,
  pedidosDisponiveis,
  onSelecionarPedido,
  podeGerenciar: podeGerenciarProp,
}) => {
  const { user } = useAuth();
  const podeGerenciar = podeGerenciarProp !== undefined ? podeGerenciarProp : podeGerenciarPedidos(user);

  const [produtos, setProdutos] = useState<ProdutoPedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [modalImportarAberto, setModalImportarAberto] = useState(false);
  const [produtoParaEditar, setProdutoParaEditar] = useState<ProdutoPedido | null>(null);

  const carregarProdutos = async () => {
    if (!pedidoSelecionado) {
      setProdutos([]);
      return;
    }
    setLoading(true);
    try {
      const lista = await pedidosService.listarProdutosDoPedido(pedidoSelecionado.id);
      setProdutos(lista);
    } catch (err) {
      console.warn('Erro ao carregar produtos do pedido:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarProdutos();
  }, [pedidoSelecionado]);

  const handleExcluir = async (produto: ProdutoPedido) => {
    if (!window.confirm(`Deseja remover o produto "${produto.produto}" deste pedido?`)) return;

    try {
      await pedidosService.excluirProdutoDoPedido(produto.id);
      setProdutos((prev) => prev.filter((p) => p.id !== produto.id));
    } catch (err: any) {
      alert(`Erro ao excluir produto: ${err.message}`);
    }
  };

  const produtosFiltrados = produtos.filter((p) => {
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return (
      (p.produto || '').toLowerCase().includes(q) ||
      (p.codigo_barra || '').toLowerCase().includes(q) ||
      (p.locacao || '').toLowerCase().includes(q)
    );
  });

  const totalQuantidade = produtos.reduce((sum, p) => sum + (p.quantidade || 0), 0);
  const totalSaldo = produtos.reduce((sum, p) => sum + (p.saldo || 0), 0);

  // REGRA 18: Se nenhum pedido estiver selecionado, orienta o usuário e disponibiliza seletor
  if (!pedidoSelecionado) {
    return (
      <div className="p-8 sm:p-12 text-center max-w-xl mx-auto bg-slate-900/60 border border-slate-800 rounded-3xl space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
          <Boxes className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-xl font-extrabold text-white">Nenhum Pedido Selecionado</h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
            Por regra operacional do PoliHub, a aba <strong className="text-white">Produtos</strong> não exibe uma lista geral com produtos misturados de vários pedidos.
            Ela carrega <strong>somente os produtos pertencentes ao pedido selecionado</strong>.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-2">
          <label className="text-xs font-bold text-slate-300 block">
            Selecione um pedido existente para visualizar ou cadastrar seus produtos:
          </label>
          <select
            value=""
            onChange={(e) => {
              const achado = pedidosDisponiveis.find((p) => p.id === e.target.value);
              if (achado) onSelecionarPedido(achado);
            }}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-blue-500 min-h-[44px]"
          >
            <option value="">Escolha um pedido da listagem...</option>
            {pedidosDisponiveis.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.id_pedido} &bull; {p.cliente} ({p.quantidade_itens} itens)
              </option>
            ))}
          </select>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={onVoltarParaSeparacao}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para a Aba Separação</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. BANNER DO PEDIDO SELECIONADO */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border border-blue-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
              Produtos do Pedido
            </span>
            <span className="text-xs text-slate-400">
              Data: {pedidoSelecionado.data || '-'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-white tracking-tight font-mono text-blue-400">
              #{pedidoSelecionado.id_pedido}
            </h2>
            <span className="text-slate-400 font-medium text-xs sm:text-sm">
              &bull; {pedidoSelecionado.cliente}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Transportadora: <strong className="text-slate-300">{pedidoSelecionado.transportador}</strong> &bull; Qtd. Pedido Informada: <strong className="text-white font-mono">{pedidoSelecionado.quantidade_itens} itens</strong>
          </p>
        </div>

        {/* Controles do Cabeçalho */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Seletor rápido para trocar de pedido */}
          <select
            value={pedidoSelecionado.id}
            onChange={(e) => {
              const achado = pedidosDisponiveis.find((p) => p.id === e.target.value);
              if (achado) onSelecionarPedido(achado);
            }}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold focus:outline-none focus:border-blue-500 min-h-[40px]"
          >
            {pedidosDisponiveis.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.id_pedido} - {p.cliente}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onVoltarParaSeparacao}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition min-h-[40px]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Separação</span>
          </button>
        </div>
      </div>

      {/* 2. ACTIONS & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por código de barras, produto ou locação..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-white placeholder-slate-400 text-xs font-semibold focus:outline-none focus:border-blue-500 min-h-[44px]"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => pedidosService.baixarModeloExcelProdutos(pedidoSelecionado.id_pedido)}
            title="Baixar planilha modelo de produtos para este pedido"
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition shadow-sm min-h-[44px]"
          >
            <Download className="w-4 h-4 text-slate-400" />
            <span className="hidden sm:inline">Modelo Excel</span>
          </button>

          {podeGerenciar ? (
            <>
              <button
                type="button"
                onClick={() => setModalImportarAberto(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900 border border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-400 text-xs font-bold transition shadow-sm min-h-[44px]"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Importar Produtos</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setProdutoParaEditar(null);
                  setModalNovoAberto(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/30 min-h-[44px]"
              >
                <Plus className="w-4 h-4" />
                <span>+ Adicionar Produto</span>
              </button>
            </>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Inclusão restrita à Logística</span>
            </span>
          )}
        </div>
      </div>

      {/* 3. PRODUTOS TABLE (EXCLUSIVA DO PEDIDO SELECIONADO) */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-slate-900/40 rounded-3xl border border-slate-800">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-3" />
          <p className="text-sm font-semibold">Carregando produtos do pedido #{pedidoSelecionado.id_pedido}...</p>
        </div>
      ) : produtosFiltrados.length === 0 ? (
        <div className="p-10 text-center text-slate-400 bg-slate-900/40 rounded-3xl border border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white">Nenhum produto cadastrado para este pedido</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {podeGerenciar
              ? 'Utilize o botão acima para adicionar produtos manualmente ou importe a relação completa via Excel.'
              : 'Aguardando inclusão de produtos pelo Departamento de Logística.'}
          </p>
          {podeGerenciar ? (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalNovoAberto(true)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition"
              >
                + Adicionar Produto
              </button>
              <button
                type="button"
                onClick={() => setModalImportarAberto(true)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
              >
                Importar Excel
              </button>
            </div>
          ) : (
            <div className="pt-2 text-xs text-slate-500 flex items-center justify-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Inclusão restrita ao Departamento de Logística.</span>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden border border-slate-800/90 rounded-3xl bg-slate-900/70 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/90 border-b border-slate-800 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3.5 px-4">Código de Barra</th>
                  <th className="py-3.5 px-4">Produto</th>
                  <th className="py-3.5 px-4">Locação</th>
                  <th className="py-3.5 px-4 text-right">Quantidade</th>
                  <th className="py-3.5 px-4 text-right">Saldo</th>
                  <th className="py-3.5 px-4 text-right">{podeGerenciar ? 'Ações' : 'Acesso'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {produtosFiltrados.map((prod) => (
                  <tr key={prod.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-300">
                      {prod.codigo_barra || '-'}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white">{prod.produto}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 font-mono text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                        <MapPin className="w-3 h-3" />
                        {prod.locacao || '-'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-extrabold text-white text-sm">
                      {prod.quantidade}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-extrabold text-emerald-400 text-sm">
                      {prod.saldo}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {podeGerenciar ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setProdutoParaEditar(prod);
                              setModalNovoAberto(true);
                            }}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcluir(prod)}
                            className="p-1.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">Leitura</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Footer Totalizadores */}
              <tfoot className="bg-slate-950/80 border-t border-slate-800 font-bold text-xs text-white">
                <tr>
                  <td colSpan={3} className="py-3 px-4 text-slate-400">
                    Total: {produtos.length} produtos cadastrados no pedido #{pedidoSelecionado.id_pedido}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-white text-sm">
                    {totalQuantidade}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-400 text-sm">
                    {totalSaldo}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Modais */}
      {modalNovoAberto && (
        <NovoProdutoPedidoModal
          isOpen={modalNovoAberto}
          onClose={() => setModalNovoAberto(false)}
          pedido={pedidoSelecionado}
          produtoParaEdicao={produtoParaEditar}
          onSalvo={(novoOuAtualizado) => {
            setProdutos((prev) => {
              const idx = prev.findIndex((p) => p.id === novoOuAtualizado.id);
              if (idx >= 0) {
                const copia = [...prev];
                copia[idx] = novoOuAtualizado;
                return copia;
              }
              return [...prev, novoOuAtualizado];
            });
          }}
        />
      )}

      {modalImportarAberto && (
        <ImportarProdutosModal
          isOpen={modalImportarAberto}
          onClose={() => setModalImportarAberto(false)}
          pedido={pedidoSelecionado}
          onImportado={(novos) => {
            setProdutos((prev) => [...prev, ...novos]);
          }}
          pedidosDisponiveis={pedidosDisponiveis}
        />
      )}
    </div>
  );
};
