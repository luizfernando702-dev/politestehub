import React, { useState, useEffect } from 'react';
import {
  X,
  Edit2,
  Package,
  AlertCircle,
  Clock,
  Sparkles,
  Flame,
  CheckCircle2,
  Check,
  Loader2,
  Search,
} from 'lucide-react';
import { SolicitacaoCompra, Produto, DemandaCompra, UrgenciaCompra } from '../../types';
import { comprasService } from '../../services/comprasService';
import { produtosService } from '../../services/produtosService';
import { useAuth } from '../../context/AuthContext';

interface ModalEditarSolicitacaoProps {
  solicitacao: SolicitacaoCompra | null;
  isOpen: boolean;
  onClose: () => void;
  onSalvo: () => void;
}

export const ModalEditarSolicitacao: React.FC<ModalEditarSolicitacaoProps> = ({
  solicitacao,
  isOpen,
  onClose,
  onSalvo,
}) => {
  const { user } = useAuth();

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregandoProdutos, setCarregandoProdutos] = useState(false);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [trocandoProduto, setTrocandoProduto] = useState(false);

  const [quantidade, setQuantidade] = useState<string>('');
  const [demanda, setDemanda] = useState<DemandaCompra>('Necessidade');
  const [urgencia, setUrgencia] = useState<UrgenciaCompra>('Média');
  const [observacao, setObservacao] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && solicitacao) {
      setQuantidade(String(solicitacao.quantidade));
      setDemanda(solicitacao.demanda);
      setUrgencia(solicitacao.urgencia);
      setObservacao(solicitacao.observacao || '');
      setTrocandoProduto(false);
      setBuscaProduto('');
      setErro(null);

      // Carregar produtos
      const carregar = async () => {
        setCarregandoProdutos(true);
        try {
          const prods = await produtosService.listarTodos();
          setProdutos(prods);
          const atual = prods.find((p) => p.id === solicitacao.id_produto);
          if (atual) {
            setProdutoSelecionado(atual);
          } else if (solicitacao.produto) {
            setProdutoSelecionado(solicitacao.produto);
          }
        } catch (err) {
          console.warn('Erro ao carregar produtos:', err);
        } finally {
          setCarregandoProdutos(false);
        }
      };

      carregar();
    }
  }, [isOpen, solicitacao]);

  if (!isOpen || !solicitacao) return null;

  // Validação estrita de regra de negócio: Somente o próprio solicitante pode editar sua solicitação pendente
  const podeEditar = solicitacao.id_solicitante === user?.id && solicitacao.status === 'Solicitado';

  const produtosFiltrados = produtos.filter((p) => {
    if (!buscaProduto.trim()) return true;
    const termo = buscaProduto.toLowerCase().trim();
    return (
      p.produto.toLowerCase().includes(termo) ||
      (p.fabricante && p.fabricante.toLowerCase().includes(termo)) ||
      (p.codigo_barras && p.codigo_barras.toLowerCase().includes(termo))
    );
  }).slice(0, 15);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!podeEditar) {
      setErro('Você não tem permissão para editar esta solicitação.');
      return;
    }

    if (!user?.id) {
      setErro('Usuário não identificado.');
      return;
    }

    if (!produtoSelecionado) {
      setErro('Selecione um produto.');
      return;
    }

    const qtdNum = parseInt(quantidade, 10);
    if (!quantidade || isNaN(qtdNum) || qtdNum <= 0 || !Number.isInteger(qtdNum)) {
      setErro('A quantidade é obrigatória e deve ser um número inteiro positivo.');
      return;
    }

    setSalvando(true);
    try {
      await comprasService.editarSolicitacao(solicitacao.id, user.id, {
        id_produto: produtoSelecionado.id,
        quantidade: qtdNum,
        demanda,
        urgencia,
        observacao: observacao.trim() || null,
      });

      onSalvo();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar edição da solicitação.';
      setErro(msg);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Edit2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Editar Solicitação de Compra</h2>
              <p className="text-xs text-slate-400">
                Apenas solicitações com status <strong className="text-amber-300">Solicitado</strong> de sua autoria podem ser alteradas.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {erro && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-rose-300 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{erro}</span>
            </div>
          )}

          {!podeEditar ? (
            <div className="p-6 text-center rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <h3 className="text-sm font-bold text-white">Edição não permitida</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Você pode editar somente as solicitações criadas por você e que ainda estejam no status "Solicitado".
              </p>
            </div>
          ) : (
            <>
              {/* 1. MESMA LINHA: PRODUTO (MAIOR PARTE) E QUANTIDADE (MENOR, À DIREITA) */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                {/* Produto Solicitado (8 colunas) */}
                <div className="sm:col-span-8 space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Produto Solicitado <span className="text-rose-400">*</span>
                  </label>

                  {produtoSelecionado && !trocandoProduto ? (
                    <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-between gap-2 min-h-[46px]">
                      <div className="truncate pr-2">
                        <span className="text-xs font-bold text-white block truncate">
                          {produtoSelecionado.produto}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate block">
                          Fab: {produtoSelecionado.fabricante || 'Geral'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTrocandoProduto(true)}
                        className="px-2.5 py-1 rounded-xl text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-700/60 hover:bg-slate-700 shrink-0 transition"
                      >
                        Trocar
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={buscaProduto}
                          onChange={(e) => setBuscaProduto(e.target.value)}
                          placeholder="Buscar produto por nome..."
                          className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-slate-800 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="max-h-36 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/70 p-1 space-y-1">
                        {produtosFiltrados.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setProdutoSelecionado(p);
                              setTrocandoProduto(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs hover:bg-slate-800 transition flex items-center justify-between"
                          >
                            <span className="truncate text-slate-200 font-medium">{p.produto}</span>
                            <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0">
                              Selecionar
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Quantidade (4 colunas à direita) */}
                <div className="sm:col-span-4 space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Quantidade <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    step="1"
                    required
                    value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value)}
                    placeholder="Ex: 10"
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-800 border border-slate-700 text-white font-mono text-sm font-bold text-center focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-slate-400 block text-center">De 1 a 1.000 un.</span>
                </div>
              </div>

              {/* 2. DEMANDA */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Tipo de Demanda <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'Estoque' as const, label: 'Estoque', desc: 'Reposição de estoque' },
                      { id: 'Sob Encomenda' as const, label: 'Sob Encomenda', desc: 'Atender cliente' },
                      { id: 'Consumos' as const, label: 'Consumos', desc: 'Uso interno da filial' },
                    ] as const
                  ).map((dem) => (
                    <button
                      key={dem.id}
                      type="button"
                      onClick={() => setDemanda(dem.id)}
                      className={`p-2.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        demanda === dem.id
                          ? 'bg-amber-500/20 border-amber-500 text-white shadow-sm ring-1 ring-amber-500'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-xs">{dem.label}</span>
                        {demanda === dem.id && <Check className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1">{dem.desc}</span>
                    </button>
                  ))}
                </div>
                {/* Se a solicitação original possuía categoria legada, exibir indicação */}
                {demanda !== 'Estoque' && demanda !== 'Sob Encomenda' && demanda !== 'Consumos' && (
                  <p className="text-[11px] text-amber-400/90 font-medium mt-1">
                    Categoria atual no registro: <strong>{demanda}</strong> (Selecione uma das novas opções acima para atualizar).
                  </p>
                )}
              </div>

              {/* 3. URGÊNCIA */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Nível de Urgência <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setUrgencia('Média')}
                    className={`p-2.5 rounded-2xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      urgencia === 'Média'
                        ? 'bg-slate-700/60 border-slate-400 text-white'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Média</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUrgencia('Rápida')}
                    className={`p-2.5 rounded-2xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      urgencia === 'Rápida'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Rápida</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUrgencia('Urgente')}
                    className={`p-2.5 rounded-2xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      urgencia === 'Urgente'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                    <span>Urgente</span>
                  </button>
                </div>
              </div>

              {/* 4. OBSERVAÇÃO */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Observação
                </label>
                <textarea
                  rows={3}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Informações adicionais para o gestor..."
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-800 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Footer Actions */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={salvando}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando || !quantidade}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-amber-600/30 disabled:opacity-50"
                >
                  {salvando ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando alterações...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Salvar Edição</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
