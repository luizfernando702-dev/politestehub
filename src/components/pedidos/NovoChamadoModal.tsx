import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Search,
  AlertTriangle,
  PackageX,
  Clock,
  MapPin,
  Truck,
  Package,
  Loader2,
  CheckCircle2,
  ChevronDown,
  Building2,
  UserCheck,
} from 'lucide-react';
import {
  TipoProblemaChamado,
  ItemProdutoChamado,
  TransportadoraChamado,
  Produto,
  Transportadora,
  Usuario,
} from '../../types';
import { cadastrosService } from '../../services/cadastrosService';
import { produtosService } from '../../services/produtosService';
import { chamadosService } from '../../services/chamadosService';

interface NovoChamadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  unidadeNegocio: string;
  currentUser?: Usuario | null;
  onChamadoCriado: () => void;
}

const TIPOS_PROBLEMA: {
  tipo: TipoProblemaChamado;
  titulo: string;
  descricao: string;
  icone: any;
  corBorda: string;
  corTexto: string;
  corBg: string;
}[] = [
  {
    tipo: 'Avaria',
    titulo: 'Avaria',
    descricao: 'Produto danificado, quebrado ou amassado',
    icone: AlertTriangle,
    corBorda: 'border-amber-500/40 hover:border-amber-500',
    corTexto: 'text-amber-400',
    corBg: 'bg-amber-500/10',
  },
  {
    tipo: 'Produto errado',
    titulo: 'Produto errado',
    descricao: 'Item divergente do pedido ou trocado',
    icone: PackageX,
    corBorda: 'border-indigo-500/40 hover:border-indigo-500',
    corTexto: 'text-indigo-400',
    corBg: 'bg-indigo-500/10',
  },
  {
    tipo: 'Atraso',
    titulo: 'Atraso na entrega',
    descricao: 'Carga retida ou atraso de transportadora',
    icone: Clock,
    corBorda: 'border-sky-500/40 hover:border-sky-500',
    corTexto: 'text-sky-400',
    corBg: 'bg-sky-500/10',
  },
  {
    tipo: 'Endereço errado',
    titulo: 'Endereço incorreto',
    descricao: 'Erro de destino, CEP ou endereço não localizado',
    icone: MapPin,
    corBorda: 'border-emerald-500/40 hover:border-emerald-500',
    corTexto: 'text-emerald-400',
    corBg: 'bg-emerald-500/10',
  },
];

export const NovoChamadoModal: React.FC<NovoChamadoModalProps> = ({
  isOpen,
  onClose,
  unidadeNegocio,
  currentUser,
  onChamadoCriado,
}) => {
  const [cliente, setCliente] = useState('');
  const [notaFiscal, setNotaFiscal] = useState('');
  const [tipoProblema, setTipoProblema] = useState<TipoProblemaChamado>('Avaria');

  // Estados para problema com Transportadora
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([]);
  const [buscaTransportadora, setBuscaTransportadora] = useState('');
  const [transportadoraSelecionada, setTransportadoraSelecionada] = useState<Transportadora | null>(null);
  const [loadingTransportadoras, setLoadingTransportadoras] = useState(false);
  const [dropdownTransportadoraAberto, setDropdownTransportadoraAberto] = useState(false);

  // Estados para problema com Produtos
  const [produtosCadastrados, setProdutosCadastrados] = useState<Produto[]>([]);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [quantidadeProduto, setQuantidadeProduto] = useState<number>(1);
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  const [itensAdicionados, setItensAdicionados] = useState<ItemProdutoChamado[]>([]);

  // Estados gerais de submissão
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const isProblemaProduto = tipoProblema === 'Avaria' || tipoProblema === 'Produto errado';

  // Carrega transportadoras para o dropdown
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const carregar = async () => {
      try {
        setLoadingTransportadoras(true);
        const lista = await cadastrosService.listTransportadoras();
        if (isMounted) {
          setTransportadoras(lista.filter((t) => t.ativo !== false));
        }
      } catch (e) {
        console.warn('Erro ao carregar transportadoras no modal de chamado:', e);
      } finally {
        if (isMounted) setLoadingTransportadoras(false);
      }
    };
    carregar();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Carrega lista de produtos quando digitar na busca
  useEffect(() => {
    if (!isOpen || !isProblemaProduto) return;
    let isMounted = true;
    const buscar = async () => {
      try {
        setLoadingProdutos(true);
        const lista = await produtosService.list(buscaProduto);
        if (isMounted) {
          setProdutosCadastrados(lista.slice(0, 15)); // top 15 resultados
        }
      } catch (e) {
        console.warn('Erro ao buscar produtos:', e);
      } finally {
        if (isMounted) setLoadingProdutos(false);
      }
    };

    const timer = setTimeout(buscar, 250);
    return () => {
      clearTimeout(timer);
      isMounted = false;
    };
  }, [buscaProduto, isOpen, isProblemaProduto]);

  if (!isOpen) return null;

  const transportadorasFiltradas = transportadoras.filter((t) => {
    if (!buscaTransportadora.trim()) return true;
    const termo = buscaTransportadora.toLowerCase();
    return (
      (t.nome_fantasia || '').toLowerCase().includes(termo) ||
      (t.razao_social || '').toLowerCase().includes(termo)
    );
  });

  const handleAdicionarProduto = () => {
    if (!produtoSelecionado) {
      setErro('Selecione um produto da lista antes de adicionar.');
      return;
    }
    if (!quantidadeProduto || quantidadeProduto <= 0) {
      setErro('Informe uma quantidade válida maior que zero.');
      return;
    }

    setErro(null);

    // Se já estiver na lista, apenas incrementa a quantidade
    const existenteIndex = itensAdicionados.findIndex(
      (item) => item.produto.toLowerCase() === produtoSelecionado.produto.toLowerCase()
    );

    if (existenteIndex >= 0) {
      const novaLista = [...itensAdicionados];
      novaLista[existenteIndex].quantidade += quantidadeProduto;
      setItensAdicionados(novaLista);
    } else {
      setItensAdicionados([
        ...itensAdicionados,
        {
          produto_id: produtoSelecionado.id,
          produto: produtoSelecionado.produto,
          quantidade: quantidadeProduto,
          codigo: produtoSelecionado.fabricante || undefined,
          codigo_barras: produtoSelecionado.codigo_barras || undefined,
        },
      ]);
    }

    // Limpa seleção para o próximo
    setProdutoSelecionado(null);
    setBuscaProduto('');
    setQuantidadeProduto(1);
  };

  const handleRemoverItem = (index: number) => {
    setItensAdicionados((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAlterarQtdItem = (index: number, novaQtd: number) => {
    if (novaQtd <= 0) return;
    setItensAdicionados((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quantidade: novaQtd } : item))
    );
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!cliente.trim()) {
      setErro('O campo Cliente é obrigatório.');
      return;
    }
    if (!notaFiscal.trim()) {
      setErro('O campo Nota Fiscal é obrigatório.');
      return;
    }

    let produtoTransportadoraPayload: any;

    if (isProblemaProduto) {
      if (itensAdicionados.length === 0) {
        setErro('Adicione pelo menos um produto com sua quantidade à ocorrência.');
        return;
      }
      produtoTransportadoraPayload = itensAdicionados;
    } else {
      if (!transportadoraSelecionada) {
        setErro('Selecione uma transportadora para ocorrências de Atraso ou Endereço.');
        return;
      }
      const transpObj: TransportadoraChamado = {
        transportadora_id: transportadoraSelecionada.id,
        transportadora: transportadoraSelecionada.nome_fantasia || transportadoraSelecionada.razao_social,
      };
      produtoTransportadoraPayload = transpObj;
    }

    try {
      setSalvando(true);
      await chamadosService.abrirChamado({
        cliente: cliente.trim(),
        nota_fiscal: notaFiscal.trim(),
        tipo_problema: tipoProblema,
        produto_transportadora: produtoTransportadoraPayload,
        unidade_negocio: unidadeNegocio,
        usuario_abertura: currentUser?.nome || 'Operador PoliHub',
        usuario_abertura_id: currentUser?.id || null,
      });

      setSucesso(true);
      setTimeout(() => {
        onChamadoCriado();
        onClose();
      }, 1400);
    } catch (err: any) {
      console.error('Erro ao abrir chamado:', err);
      setErro(err.message || 'Erro ao registrar chamado. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={!salvando ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Plus className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                Novo Chamado Logístico
              </span>
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight mt-0.5 truncate">
                Abertura de Ocorrência
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition disabled:opacity-50 min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FEEDBACK SUCESSO */}
        {sucesso ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto animate-in zoom-in-95 duration-200">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-xl font-black text-white">Chamado Aberto com Sucesso!</h4>
            <p className="text-xs text-slate-300 max-w-sm mx-auto">
              A ocorrência foi registrada para a NF <strong>{notaFiscal}</strong> e está disponível na sua lista de acompanhamento.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSalvar} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* Metadados automáticos do usuário e unidade */}
            <div className="flex items-center justify-between text-xs bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 px-4 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-slate-400">
                <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>Aberto por:</span>
                <strong className="text-white">{currentUser?.nome || 'Você'}</strong>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Unidade:</span>
                <strong className="text-white">{unidadeNegocio}</strong>
              </div>
            </div>

            {/* SELEÇÃO DO TIPO DE PROBLEMA */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
                1. Tipo de Problema *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {TIPOS_PROBLEMA.map((tp) => {
                  const Icon = tp.icone;
                  const isSelected = tipoProblema === tp.tipo;
                  return (
                    <button
                      key={tp.tipo}
                      type="button"
                      onClick={() => {
                        setTipoProblema(tp.tipo);
                        setErro(null);
                      }}
                      className={`p-3 rounded-2xl border text-left transition flex flex-col gap-2 relative ${
                        isSelected
                          ? `${tp.corBg} border-2 ${tp.corTexto} shadow-md`
                          : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                            isSelected ? tp.corBg : 'bg-slate-800'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isSelected ? tp.corTexto : 'text-slate-400'}`} />
                        </div>
                        {isSelected && (
                          <span className={`w-2 h-2 rounded-full ${tp.corTexto} bg-current`} />
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-black block text-white leading-tight">
                          {tp.titulo}
                        </span>
                        <span className="text-[10px] text-slate-400 leading-snug line-clamp-2 mt-0.5">
                          {tp.descricao}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CAMPOS GERAIS: CLIENTE E NOTA FISCAL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
                  2. Cliente *
                </label>
                <input
                  type="text"
                  required
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="Nome do cliente ou destinatário"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 min-h-[44px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
                  3. Nota Fiscal (NF) *
                </label>
                <input
                  type="text"
                  required
                  value={notaFiscal}
                  onChange={(e) => setNotaFiscal(e.target.value)}
                  placeholder="Ex: 12345"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 font-mono min-h-[44px]"
                />
              </div>
            </div>

            {/* SEÇÃO DINÂMICA: PRODUTO(S) (Para Avaria ou Produto errado) */}
            {isProblemaProduto && (
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-indigo-400" />
                    <span>4. Produtos com Ocorrência *</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {itensAdicionados.length}{' '}
                    {itensAdicionados.length === 1 ? 'item adicionado' : 'itens adicionados'}
                  </span>
                </div>

                {/* Bloco de Adicionar Produto */}
                <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
                  <div className="space-y-1 relative">
                    <span className="text-[11px] text-slate-400 block font-medium">
                      Pesquisar produto no cadastro global (descrição, código ou leitor de barras):
                    </span>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={buscaProduto}
                        onChange={(e) => {
                          setBuscaProduto(e.target.value);
                          if (produtoSelecionado && e.target.value !== produtoSelecionado.produto) {
                            setProdutoSelecionado(null);
                          }
                        }}
                        placeholder="Digite para pesquisar produto..."
                        className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 min-h-[40px]"
                      />
                    </div>

                    {/* Lista dropdown de produtos sugeridos */}
                    {buscaProduto.trim().length > 1 && !produtoSelecionado && (
                      <div className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-1 space-y-1">
                        {loadingProdutos ? (
                          <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Buscando produtos...</span>
                          </div>
                        ) : produtosCadastrados.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-400">
                            Nenhum produto localizado no cadastro.
                          </div>
                        ) : (
                          produtosCadastrados.map((prod) => (
                            <button
                              key={prod.id}
                              type="button"
                              onClick={() => {
                                setProdutoSelecionado(prod);
                                setBuscaProduto(prod.produto);
                              }}
                              className="w-full text-left p-2.5 rounded-lg hover:bg-slate-800 text-xs transition flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <span className="font-bold text-white block truncate">{prod.produto}</span>
                                <span className="text-[10px] text-slate-400">
                                  {prod.fabricante ? `Cód: ${prod.fabricante} | ` : ''}
                                  {prod.codigo_barras ? `EAN: ${prod.codigo_barras}` : ''}
                                </span>
                              </div>
                              <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 shrink-0">
                                Selecionar
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Quantidade e Botão de Adicionar */}
                  <div className="flex items-center gap-3 pt-1">
                    <div className="w-32 space-y-1">
                      <span className="text-[11px] text-slate-400 block font-medium">Quantidade:</span>
                      <input
                        type="number"
                        min="1"
                        value={quantidadeProduto}
                        onChange={(e) => setQuantidadeProduto(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono font-bold text-center focus:outline-none focus:border-indigo-500 min-h-[40px]"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleAdicionarProduto}
                      disabled={!produtoSelecionado}
                      className="mt-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-900/40 transition flex items-center gap-1.5 min-h-[40px] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Adicionar Item</span>
                    </button>
                  </div>
                </div>

                {/* Lista de Produtos Já Adicionados */}
                {itensAdicionados.length > 0 ? (
                  <div className="space-y-2">
                    <span className="text-[11px] text-slate-400 font-bold block">
                      Itens vinculados a este chamado:
                    </span>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {itensAdicionados.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-white block truncate" title={item.produto}>
                              {item.produto}
                            </span>
                            {item.codigo && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                Cód: {item.codigo}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-slate-400 text-[11px]">Qtd:</span>
                            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-lg p-0.5">
                              <button
                                type="button"
                                onClick={() => handleAlterarQtdItem(index, item.quantidade - 1)}
                                className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:bg-slate-800 font-bold text-xs"
                              >
                                -
                              </button>
                              <span className="w-8 text-center font-mono font-bold text-white text-xs">
                                {item.quantidade}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAlterarQtdItem(index, item.quantidade + 1)}
                                className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:bg-slate-800 font-bold text-xs"
                              >
                                +
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoverItem(index)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                              title="Remover produto da lista"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-amber-400/90 italic bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl">
                    Nenhum produto adicionado ainda. Pesquise e adicione pelo menos um item acima.
                  </p>
                )}
              </div>
            )}

            {/* SEÇÃO DINÂMICA: TRANSPORTADORA (Para Atraso ou Endereço errado) */}
            {!isProblemaProduto && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-sky-400" />
                  <span>4. Transportadora Responsável *</span>
                </label>

                {/* Seletor com pesquisa de Transportadora */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={buscaTransportadora}
                      onChange={(e) => {
                        setBuscaTransportadora(e.target.value);
                        setDropdownTransportadoraAberto(true);
                      }}
                      onFocus={() => setDropdownTransportadoraAberto(true)}
                      placeholder="Pesquisar transportadora cadastrada..."
                      className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-sky-500 min-h-[44px]"
                    />
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  {dropdownTransportadoraAberto && (
                    <div className="max-h-48 overflow-y-auto rounded-xl bg-slate-950 border border-slate-700 shadow-2xl p-1 space-y-1 animate-in fade-in duration-150">
                      {loadingTransportadoras ? (
                        <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Carregando transportadoras...</span>
                        </div>
                      ) : transportadorasFiltradas.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400">
                          Nenhuma transportadora localizada com o termo &ldquo;{buscaTransportadora}&rdquo;.
                        </div>
                      ) : (
                        transportadorasFiltradas.map((t) => {
                          const isSel = transportadoraSelecionada?.id === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                setTransportadoraSelecionada(t);
                                setBuscaTransportadora(t.nome_fantasia || t.razao_social);
                                setDropdownTransportadoraAberto(false);
                                setErro(null);
                              }}
                              className={`w-full text-left p-2.5 rounded-lg text-xs transition flex items-center justify-between ${
                                isSel
                                  ? 'bg-sky-600 text-white font-bold'
                                  : 'hover:bg-slate-800 text-slate-200'
                              }`}
                            >
                              <div className="min-w-0">
                                <span className="block truncate font-bold">
                                  {t.nome_fantasia || t.razao_social}
                                </span>
                                {t.razao_social && t.razao_social !== t.nome_fantasia && (
                                  <span className="text-[10px] text-slate-400 block truncate">
                                    {t.razao_social}
                                  </span>
                                )}
                              </div>
                              {isSel && <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}

                  {transportadoraSelecionada && (
                    <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-between text-xs text-sky-200">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-sky-400 shrink-0" />
                        <div>
                          <span className="text-[10px] text-sky-400 uppercase font-bold block">
                            Transportadora Vinculada
                          </span>
                          <strong className="text-white">
                            {transportadoraSelecionada.nome_fantasia || transportadoraSelecionada.razao_social}
                          </strong>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setTransportadoraSelecionada(null);
                          setBuscaTransportadora('');
                        }}
                        className="text-xs text-sky-400 hover:text-white underline cursor-pointer"
                      >
                        Alterar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MENSAGEM DE ERRO */}
            {erro && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold block">Atenção:</span>
                  <span>{erro}</span>
                </div>
              </div>
            )}

            {/* FOOTER ACTIONS */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={salvando}
                className="px-4 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold text-xs transition min-h-[44px]"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={salvando}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-900/40 transition min-h-[44px] cursor-pointer disabled:opacity-50"
              >
                {salvando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Registrando chamado...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Abrir Chamado</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
