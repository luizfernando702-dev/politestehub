import React, { useState, useEffect } from 'react';
import {
  X,
  ShoppingCart,
  AlertTriangle,
  Package,
  Sparkles,
  CheckCircle2,
  Check,
  AlertCircle,
  Clock,
  Flame,
  Search,
  Loader2,
} from 'lucide-react';
import { Produto, SolicitacaoCompra, DemandaCompra, UrgenciaCompra } from '../../types';
import { comprasService } from '../../services/comprasService';
import { produtosService } from '../../services/produtosService';
import { useAuth } from '../../context/AuthContext';

interface NovaSolicitacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSucesso: (nova: SolicitacaoCompra) => void;
}

export const NovaSolicitacaoModal: React.FC<NovaSolicitacaoModalProps> = ({
  isOpen,
  onClose,
  onSucesso,
}) => {
  const { user } = useAuth();

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregandoProdutos, setCarregandoProdutos] = useState(false);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [trocandoProduto, setTrocandoProduto] = useState(false);

  // Iniciar vazio, sem valor predefinido
  const [quantidade, setQuantidade] = useState<string>('');
  const [demanda, setDemanda] = useState<DemandaCompra | ''>('');
  const [urgencia, setUrgencia] = useState<UrgenciaCompra | ''>('');
  const [observacao, setObservacao] = useState('');
  const [tentouSalvar, setTentouSalvar] = useState(false);

  // Verificação de solicitação duplicada / existente
  const [verificandoDuplicidade, setVerificandoDuplicidade] = useState(false);
  const [solicitacaoExistente, setSolicitacaoExistente] = useState<SolicitacaoCompra | null>(null);
  const [confirmouDuplicidade, setConfirmouDuplicidade] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setProdutoSelecionado(null);
      setTrocandoProduto(false);
      setBuscaProduto('');
      setQuantidade(''); // Iniciar vazio conforme regra
      setDemanda(''); // Sem opção pré-selecionada
      setUrgencia(''); // Sem opção pré-selecionada
      setObservacao('');
      setTentouSalvar(false);
      setSolicitacaoExistente(null);
      setConfirmouDuplicidade(false);
      setErro(null);

      const carregar = async () => {
        setCarregandoProdutos(true);
        try {
          const prods = await produtosService.listarTodos();
          setProdutos(prods);
        } catch (err) {
          console.error('Erro ao listar produtos:', err);
        } finally {
          setCarregandoProdutos(false);
        }
      };

      carregar();
    }
  }, [isOpen]);

  // Ao selecionar um produto, executa a verificação automática de duplicidade em tempo real
  const handleSelecionarProduto = async (prod: Produto) => {
    setProdutoSelecionado(prod);
    setTrocandoProduto(false);
    setSolicitacaoExistente(null);
    setConfirmouDuplicidade(false);
    setErro(null);

    setVerificandoDuplicidade(true);
    try {
      const existente = await comprasService.verificarSolicitacaoExistente(
        prod.id,
        user?.unidade_negocio
      );
      if (existente) {
        setSolicitacaoExistente(existente);
      }
    } catch (err) {
      console.warn('Erro ao verificar duplicidade:', err);
    } finally {
      setVerificandoDuplicidade(false);
    }
  };

  // Busca remota complementar com debounce quando o usuário digita
  useEffect(() => {
    if (!buscaProduto.trim() || !isOpen) return;

    const timer = setTimeout(async () => {
      try {
        const remotos = await produtosService.listarTodos(buscaProduto.trim());
        if (remotos && remotos.length > 0) {
          setProdutos((prev) => {
            const mapa = new Map<string, Produto>();
            prev.forEach((p) => mapa.set(p.id, p));
            remotos.forEach((p) => mapa.set(p.id, p));
            return Array.from(mapa.values()).sort((a, b) =>
              a.produto.localeCompare(b.produto, 'pt-BR')
            );
          });
        }
      } catch (err) {
        console.warn('Erro na busca remota de produtos:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [buscaProduto, isOpen]);

  // Função auxiliar para normalizar texto removendo acentos e caracteres especiais
  const normalizarBusca = (s: string) =>
    (s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  // Filtragem flexível de A a Z: todas as palavras devem corresponder (produto, fabricante, código de barras ou endereço)
  const produtosFiltrados = React.useMemo(() => {
    if (!buscaProduto.trim()) {
      return produtos.slice(0, 100);
    }
    const termoNorm = normalizarBusca(buscaProduto);
    const palavras = termoNorm.split(/\s+/).filter(Boolean);

    return produtos
      .filter((p) => {
        const prodNorm = normalizarBusca(p.produto);
        const fabNorm = normalizarBusca(p.fabricante || '');
        const codNorm = normalizarBusca(p.codigo_barras || '');
        const endNorm = normalizarBusca(p.endereco || '');

        return palavras.every(
          (palavra) =>
            prodNorm.includes(palavra) ||
            fabNorm.includes(palavra) ||
            codNorm.includes(palavra) ||
            endNorm.includes(palavra)
        );
      })
      .slice(0, 150);
  }, [produtos, buscaProduto]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    setTentouSalvar(true);

    if (!produtoSelecionado) {
      setErro('Selecione um produto para continuar.');
      return;
    }

    if (!quantidade || quantidade.trim() === '') {
      setErro('A quantidade é obrigatória. Informe um valor numérico positivo.');
      return;
    }

    const qtdNum = parseInt(quantidade, 10);
    if (isNaN(qtdNum) || qtdNum <= 0 || !Number.isInteger(qtdNum)) {
      setErro('A quantidade informada deve ser um número inteiro positivo (maior que zero).');
      return;
    }

    if (qtdNum > 1000) {
      setErro('A quantidade máxima permitida por solicitação é de 1.000 unidades.');
      return;
    }

    if (!demanda) {
      setErro('O tipo de demanda é obrigatório. Selecione Estoque, Sob Encomenda ou Consumos.');
      return;
    }

    if (!urgencia) {
      setErro('O nível de urgência é obrigatório. Selecione Média, Rápida ou Urgente.');
      return;
    }

    if (!user?.id) {
      setErro('Usuário autenticado não identificado na sessão.');
      return;
    }

    // Se houver duplicidade e o usuário ainda não confirmou expressamente
    if (solicitacaoExistente && !confirmouDuplicidade) {
      setErro('Existe uma solicitação ativa para este produto. Marque a confirmação para prosseguir.');
      return;
    }

    setSalvando(true);
    try {
      const nova = await comprasService.criarSolicitacao({
        id_produto: produtoSelecionado.id,
        quantidade: qtdNum,
        demanda,
        urgencia,
        id_solicitante: user.id,
        observacao: observacao.trim() || null,
        unidade_negocio: user.unidade_negocio || 'Goiânia',
      });

      onSucesso(nova);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao registrar solicitação de compra.';
      setErro(msg);
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Nova Solicitação de Compra</h2>
              <p className="text-xs text-slate-400">
                Unidade: <strong className="text-slate-200">{user?.unidade_negocio || 'Goiânia'}</strong> &bull; Solicitante:{' '}
                <strong className="text-slate-200">{user?.nome}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {erro && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-300 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{erro}</span>
            </div>
          )}

          {/* 1. SELEÇÃO DE PRODUTO E QUANTIDADE NA MESMA LINHA */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
            {/* Produto Solicitado (Maior parte: 8 colunas) */}
            <div className="sm:col-span-8 space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Produto Solicitado <span className="text-rose-400">*</span>
              </label>

              {produtoSelecionado && !trocandoProduto ? (
                <div className="p-3 rounded-2xl bg-slate-800/80 border border-emerald-500/40 flex items-center justify-between gap-2 min-h-[46px]">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4" />
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-xs font-bold text-white truncate">{produtoSelecionado.produto}</div>
                      <div className="text-[11px] text-slate-400 truncate">
                        Fab: <strong className="text-slate-300">{produtoSelecionado.fabricante || 'Geral'}</strong>
                        {produtoSelecionado.codigo_barras ? ` • ${produtoSelecionado.codigo_barras}` : ''}
                      </div>
                    </div>
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
                      placeholder="Pesquise por nome, fabricante ou código de barras..."
                      className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-slate-800 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
                    <span>
                      {produtosFiltrados.length} produto(s) encontrado(s){produtos.length > 0 ? ` (catálogo: ${produtos.length})` : ''}
                    </span>
                    {carregandoProdutos && (
                      <span className="text-emerald-400 flex items-center gap-1 text-[10px]">
                        <Loader2 className="w-3 h-3 animate-spin" /> Atualizando...
                      </span>
                    )}
                  </div>

                  <div className="max-h-52 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/70 p-1 space-y-1">
                    {carregandoProdutos ? (
                      <div className="py-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                        <span>Carregando catálogo...</span>
                      </div>
                    ) : produtosFiltrados.length === 0 ? (
                      <div className="py-3 text-center text-xs text-slate-500">
                        Nenhum produto encontrado.
                      </div>
                    ) : (
                      produtosFiltrados.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelecionarProduto(p)}
                          className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs hover:bg-slate-800 transition flex items-center justify-between group"
                        >
                          <div className="truncate pr-2">
                            <span className="font-semibold text-slate-200 group-hover:text-white block truncate">
                              {p.produto}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {p.fabricante || 'Fabricante não informado'}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">
                            Selecionar
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quantidade (Menor largura: 4 colunas à direita, sem botões rápidos) */}
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
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-800 border border-slate-700 text-white font-mono text-sm font-bold text-center focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-400 block text-center">
                Valor positivo inteiro (1 a 1.000)
              </span>
            </div>
          </div>

          {/* VALIDAÇÃO AUTOMÁTICA DE DUPLICIDADE EM TEMPO REAL */}
          {verificandoDuplicidade && (
            <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              <span>Verificando solicitações ativas para este produto...</span>
            </div>
          )}

          {solicitacaoExistente && !verificandoDuplicidade && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200 leading-relaxed">
                  <strong className="text-amber-300 font-bold block mb-0.5">
                    Atenção: Já existe uma solicitação ativa para este produto!
                  </strong>
                  Consta uma solicitação com status{' '}
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 font-bold text-amber-300">
                    {solicitacaoExistente.status}
                  </span>{' '}
                  para <strong>{solicitacaoExistente.quantidade} unidades</strong>, registrada por{' '}
                  <strong>{solicitacaoExistente.solicitante_nome || 'outro usuário'}</strong> em{' '}
                  {new Date(solicitacaoExistente.data_insercao).toLocaleDateString('pt-BR')}.
                </div>
              </div>

              <label className="flex items-center gap-2.5 pt-2 border-t border-amber-500/20 text-xs text-amber-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmouDuplicidade}
                  onChange={(e) => setConfirmouDuplicidade(e.target.checked)}
                  className="rounded bg-slate-900 border-amber-400 text-amber-500 focus:ring-0 w-4 h-4"
                />
                <span className="font-semibold">
                  Estou ciente da solicitação já existente e confirmo o envio desta nova solicitação
                </span>
              </label>
            </div>
          )}

          {/* 2. DEMANDA (Motivo da solicitação) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Tipo de Demanda <span className="text-rose-400">*</span>
              </label>
              {!demanda && tentouSalvar && (
                <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1 animate-pulse">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  Selecione o tipo de demanda
                </span>
              )}
            </div>

            <div
              className={`grid grid-cols-1 sm:grid-cols-3 gap-2 p-1 rounded-2xl transition ${
                !demanda && tentouSalvar ? 'ring-2 ring-rose-500/80 bg-rose-950/20' : ''
              }`}
            >
              {(
                [
                  {
                    id: 'Estoque' as const,
                    label: 'Estoque',
                    desc: 'Reposição de estoque da empresa',
                  },
                  {
                    id: 'Sob Encomenda' as const,
                    label: 'Sob Encomenda',
                    desc: 'Compra específica para atender um cliente',
                  },
                  {
                    id: 'Consumos' as const,
                    label: 'Consumos',
                    desc: 'Materiais destinados ao uso interno da filial',
                  },
                ] as const
              ).map((dem) => (
                <button
                  key={dem.id}
                  type="button"
                  onClick={() => setDemanda(dem.id)}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                    demanda === dem.id
                      ? 'bg-blue-600/20 border-blue-500 text-white shadow-md shadow-blue-500/10 ring-1 ring-blue-500'
                      : !demanda && tentouSalvar
                      ? 'bg-slate-800/80 border-rose-500/50 text-slate-300 hover:bg-slate-800'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-xs">{dem.label}</span>
                    {demanda === dem.id && <Check className="w-3.5 h-3.5 text-blue-400" />}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1.5 leading-snug">
                    {dem.desc}
                  </span>
                </button>
              ))}
            </div>

            {!demanda && !tentouSalvar && (
              <p className="text-[11px] text-slate-400">
                Selecione uma das opções acima para identificar o destino desta aquisição.
              </p>
            )}
          </div>

          {/* 3. NÍVEL DE URGÊNCIA */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Nível de Urgência <span className="text-rose-400">*</span>
              </label>
              {!urgencia && tentouSalvar && (
                <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1 animate-pulse">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  Selecione o nível de urgência
                </span>
              )}
            </div>

            <div
              className={`grid grid-cols-3 gap-2 p-1 rounded-2xl transition ${
                !urgencia && tentouSalvar ? 'ring-2 ring-rose-500/80 bg-rose-950/20' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => setUrgencia('Média')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                  urgencia === 'Média'
                    ? 'bg-slate-700/60 border-slate-400 text-white ring-1 ring-slate-400 shadow-sm'
                    : !urgencia && tentouSalvar
                    ? 'bg-slate-800/80 border-rose-500/50 text-slate-300 hover:bg-slate-800'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Média</span>
                  </div>
                  {urgencia === 'Média' && <Check className="w-3.5 h-3.5 text-slate-300" />}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">Fluxo padrão</span>
              </button>

              <button
                type="button"
                onClick={() => setUrgencia('Rápida')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                  urgencia === 'Rápida'
                    ? 'bg-amber-500/20 border-amber-500 text-white shadow-md shadow-amber-500/10 ring-1 ring-amber-500'
                    : !urgencia && tentouSalvar
                    ? 'bg-slate-800/80 border-rose-500/50 text-slate-300 hover:bg-slate-800'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-300">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Rápida</span>
                  </div>
                  {urgencia === 'Rápida' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">Prioridade</span>
              </button>

              <button
                type="button"
                onClick={() => setUrgencia('Urgente')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                  urgencia === 'Urgente'
                    ? 'bg-rose-500/20 border-rose-500 text-white shadow-md shadow-rose-500/20 ring-1 ring-rose-500'
                    : !urgencia && tentouSalvar
                    ? 'bg-slate-800/80 border-rose-500/50 text-slate-300 hover:bg-slate-800'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-rose-300">
                    <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                    <span>Urgente</span>
                  </div>
                  {urgencia === 'Urgente' && <Check className="w-3.5 h-3.5 text-rose-400" />}
                </div>
                <span className="text-[10px] text-rose-300/80 mt-1 block">Risco de ruptura</span>
              </button>
            </div>

            {!urgencia && !tentouSalvar && (
              <p className="text-[11px] text-slate-400">
                Selecione o nível de urgência para definir o prazo de atendimento.
              </p>
            )}
          </div>

          {/* 4. OBSERVAÇÃO */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Observações (Opcional)
            </label>
            <textarea
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Informações adicionais para o gestor ou setor de compras..."
              className="w-full px-4 py-2.5 rounded-2xl bg-slate-800/80 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500"
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
              disabled={salvando || !produtoSelecionado || !quantidade || (Boolean(solicitacaoExistente) && !confirmouDuplicidade)}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-600/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Registrando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Registrar Solicitação</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
