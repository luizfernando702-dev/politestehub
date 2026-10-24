import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Package,
  MapPin,
  User,
  AlertCircle,
  Loader2,
  Search,
  CheckCircle2,
  Calendar,
  Clock,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { Demonstracao, Produto, RegistroEndereco, Usuario } from '../../types';
import { produtosService } from '../../services/produtosService';
import { enderecosService } from '../../services/enderecosService';
import { usuariosService } from '../../services/usuariosService';
import { demonstracoesService } from '../../services/demonstracoesService';
import { normalizarUnidadeNegocio } from '../../constants/unidades';

interface NovaDemonstracaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSalvo: (novaDemonstracao: Demonstracao) => void;
  unidadeNegocio: string;
  currentUser?: Usuario | null;
}

export const NovaDemonstracaoModal: React.FC<NovaDemonstracaoModalProps> = ({
  isOpen,
  onClose,
  onSalvo,
  unidadeNegocio,
  currentUser,
}) => {
  // Estados do Formulário
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [produtosSugeridos, setProdutosSugeridos] = useState<Produto[]>([]);
  const [buscandoProdutos, setBuscandoProdutos] = useState(false);

  const [endereco, setEndereco] = useState('');
  const [enderecosDisponiveis, setEnderecosDisponiveis] = useState<string[]>([]);

  // Colaborador: dropdown pesquisável
  const [colaboradorId, setColaboradorId] = useState('');
  const [buscaColaborador, setBuscaColaborador] = useState('');
  const [colaboradoresUnidade, setColaboradoresUnidade] = useState<Usuario[]>([]);

  const [observacao, setObservacao] = useState('');

  // Controle de Bloqueio em Aberto (Item 9)
  const [demonstracaoEmAberto, setDemonstracaoEmAberto] = useState<Demonstracao | null>(null);
  const [verificandoBloqueio, setVerificandoBloqueio] = useState(false);

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Carregar lista de colaboradores e endereços elegíveis
  useEffect(() => {
    if (!isOpen) return;

    const carregarAuxiliares = async () => {
      try {
        const targetUnit = normalizarUnidadeNegocio(unidadeNegocio);

        // 1. Carregar TODOS os colaboradores vinculados à unidade (REGRA OBRIGATÓRIA - Item 5)
        const todosUsuarios = await usuariosService.listarTodos();
        const elegiveis = todosUsuarios.filter((u) => {
          const uUnit = normalizarUnidadeNegocio(u.unidade_negocio);
          const isAtivo = u.status !== 'desativado'; // Apenas exclui desativados
          return uUnit === targetUnit && isAtivo;
        });
        setColaboradoresUnidade(elegiveis);

        // 2. Carregar endereços cadastrados
        const listaEnderecos = await enderecosService.listar({
          unidade_negocio: targetUnit,
          status: 'ativos',
        });
        const codigosEnderecos = listaEnderecos.map((e) => e.endereco);
        setEnderecosDisponiveis(codigosEnderecos);
      } catch (err) {
        console.warn('Erro ao carregar auxiliares de demonstração:', err);
      }
    };

    carregarAuxiliares();
  }, [isOpen, unidadeNegocio]);

  // Busca de produtos com debounce
  useEffect(() => {
    if (!isOpen) return;
    const termo = buscaProduto.trim();
    if (termo.length < 2) {
      setProdutosSugeridos([]);
      return;
    }

    const timer = setTimeout(async () => {
      setBuscandoProdutos(true);
      try {
        const res = await produtosService.list(termo);
        setProdutosSugeridos(res.slice(0, 10));
      } catch (e) {
        console.warn('Erro ao buscar produtos:', e);
      } finally {
        setBuscandoProdutos(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [buscaProduto, isOpen]);

  // Reset ao abrir
  useEffect(() => {
    if (isOpen) {
      setProdutoSelecionado(null);
      setBuscaProduto('');
      setEndereco('');
      setColaboradorId('');
      setBuscaColaborador('');
      setObservacao('');
      setDemonstracaoEmAberto(null);
      setErro(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Ao selecionar um produto da lista
  const handleSelecionarProduto = async (prod: Produto) => {
    setProdutoSelecionado(prod);
    setBuscaProduto(`${prod.produto} ${prod.codigo_barras ? `(${prod.codigo_barras})` : ''}`);
    setProdutosSugeridos([]);

    // Sugerir endereço do cadastro de produtos se existir
    if (prod.endereco && prod.endereco.trim()) {
      setEndereco(prod.endereco.trim());
    }

    // REGRA 9: Verificar se o produto já possui demonstração em aberto
    setVerificandoBloqueio(true);
    setDemonstracaoEmAberto(null);
    try {
      const demExistente = await demonstracoesService.verificarProdutoEmAberto(
        {
          produto_id: prod.id,
          codigo_produto: prod.codigo_barras || undefined,
          descricao_produto: prod.produto,
        },
        unidadeNegocio
      );
      if (demExistente) {
        setDemonstracaoEmAberto(demExistente);
      }
    } catch (err) {
      console.warn('Erro ao verificar produto em aberto:', err);
    } finally {
      setVerificandoBloqueio(false);
    }
  };

  const colaboradoresFiltrados = colaboradoresUnidade.filter((c) => {
    if (!buscaColaborador.trim()) return true;
    const q = buscaColaborador.toLowerCase();
    return (
      c.nome.toLowerCase().includes(q) ||
      (c.codigo && c.codigo.toLowerCase().includes(q)) ||
      (c.funcao && c.funcao.toLowerCase().includes(q))
    );
  });

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!produtoSelecionado && !buscaProduto.trim()) {
      setErro('Por favor, pesquise e selecione o produto.');
      return;
    }

    if (!endereco.trim()) {
      setErro('Por favor, informe ou selecione o endereço de retirada do produto.');
      return;
    }

    if (!colaboradorId) {
      setErro('Selecione o colaborador responsável pela retirada.');
      return;
    }

    // Se estiver bloqueado por demonstração em aberto
    if (demonstracaoEmAberto) {
      setErro('Este produto já está registrado em uma demonstração em aberto e não pode ser retirado novamente.');
      return;
    }

    setLoading(true);

    try {
      const descricaoFinal = produtoSelecionado ? produtoSelecionado.produto : buscaProduto.trim();
      const codigoFinal = produtoSelecionado?.codigo_barras || null;
      const produtoIdFinal = produtoSelecionado?.id || null;

      const nova = await demonstracoesService.criarDemonstracao(
        {
          unidade_negocio: normalizarUnidadeNegocio(unidadeNegocio),
          produto: descricaoFinal,
          produto_id: produtoIdFinal,
          codigo_produto: codigoFinal,
          endereco: endereco.trim(),
          colaborador: colaboradorId,
          observacao: observacao.trim() || null,
        },
        currentUser?.nivel
      );

      onSalvo(nova);
      onClose();
    } catch (err: any) {
      setErro(err.message || 'Erro ao registrar saída para demonstração.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/60">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                {unidadeNegocio}
              </span>
              <span className="text-xs text-slate-400">Fluxo Comercial</span>
            </div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-400" />
              <span>+ Nova Demonstração de Produto</span>
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
        <form onSubmit={handleSalvar} className="p-6 space-y-5">
          {erro && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="whitespace-pre-line leading-relaxed">
                <strong className="block font-bold mb-0.5">Atenção ao registrar demonstração:</strong>
                <span>{erro}</span>
              </div>
            </div>
          )}

          {/* ALERTA DE BLOQUEIO SE JÁ ESTIVER EM ABERTO (Item 9) */}
          {demonstracaoEmAberto && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-400">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <span className="text-sm">Este produto já está registrado em uma demonstração.</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Não é permitido registrar uma nova retirada para este produto enquanto a devolução anterior não for concluída.
              </p>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-amber-500/20 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block">Produto:</span>
                  <span className="font-bold text-white truncate block">{demonstracaoEmAberto.produto}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Colaborador Responsável:</span>
                  <span className="font-bold text-amber-300">{demonstracaoEmAberto.colaborador_nome || 'Colaborador'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Endereço de Origem:</span>
                  <span className="font-bold text-sky-400 font-mono">{demonstracaoEmAberto.endereco}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Data e Hora da Retirada:</span>
                  <span className="font-bold text-slate-200">
                    {new Date(demonstracaoEmAberto.data_coletada).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 1. SELEÇÃO DE PRODUTO */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-blue-400" />
                <span>Produto * (Pesquise por código, código de barras ou descrição)</span>
              </label>
              {verificandoBloqueio && (
                <span className="text-[10px] text-blue-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Verificando disponibilidade...
                </span>
              )}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={buscaProduto}
                onChange={(e) => {
                  setBuscaProduto(e.target.value);
                  if (produtoSelecionado) setProdutoSelecionado(null);
                  if (demonstracaoEmAberto) setDemonstracaoEmAberto(null);
                }}
                placeholder="Ex: 7891234560011 ou Filtro de Ar P-550..."
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:border-blue-500 min-h-[44px]"
              />
              {buscandoProdutos && (
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
              )}
            </div>

            {/* Dropdown de Sugestões de Produtos */}
            {produtosSugeridos.length > 0 && !produtoSelecionado && (
              <div className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl divide-y divide-slate-800">
                {produtosSugeridos.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleSelecionarProduto(prod)}
                    className="w-full p-3 text-left hover:bg-slate-800/80 transition flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">{prod.produto}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        {prod.codigo_barras && (
                          <span className="font-mono text-sky-400">EAN: {prod.codigo_barras}</span>
                        )}
                        {prod.fabricante && <span>&bull; {prod.fabricante}</span>}
                      </div>
                    </div>
                    {prod.endereco && (
                      <span className="font-mono text-[10px] text-slate-300 bg-slate-950 px-2 py-1 rounded border border-slate-800 shrink-0">
                        {prod.endereco}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Confirmação do Produto Selecionado */}
            {produtoSelecionado && (
              <div className="mt-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-white block">{produtoSelecionado.produto}</span>
                    <span className="text-[11px] text-slate-400">
                      Código/EAN: <strong className="text-sky-300 font-mono">{produtoSelecionado.codigo_barras || 'Não informado'}</strong>
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProdutoSelecionado(null);
                    setBuscaProduto('');
                    setDemonstracaoEmAberto(null);
                  }}
                  className="text-xs text-rose-400 hover:underline shrink-0"
                >
                  Trocar
                </button>
              </div>
            )}
          </div>

          {/* 2. ENDEREÇO & COLABORADOR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Endereço */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Endereço de Retirada *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  list="lista-enderecos-demonstracao"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Ex: R01-P03-N1"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:border-blue-500 min-h-[44px] font-mono"
                />
                <datalist id="lista-enderecos-demonstracao">
                  {enderecosDisponiveis.map((end, idx) => (
                    <option key={idx} value={end} />
                  ))}
                </datalist>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Local de onde o produto está sendo retirado.
              </span>
            </div>

            {/* Colaborador Responsável (Dropdown Pesquisável - Todos da Unidade) */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Colaborador Responsável * ({unidadeNegocio})
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <select
                  required
                  value={colaboradorId}
                  onChange={(e) => setColaboradorId(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-blue-500 min-h-[44px]"
                >
                  <option value="">Selecione o colaborador...</option>
                  {colaboradoresUnidade.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} {c.codigo ? `(${c.codigo})` : ''} - {c.funcao || 'Colaborador'}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Listando todos os colaboradores vinculados a {unidadeNegocio}.
              </span>
            </div>
          </div>

          {/* 3. OBSERVAÇÃO */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Observação (Opcional)
            </label>
            <textarea
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Demonstração agendada com o cliente Auto Peças Araguaia. Retirada às 14h."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* REGISTRO DE DATA AUTOMÁTICO */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>Data e Hora da Retirada:</span>
            </span>
            <span className="font-bold text-white font-mono">
              Registrada automaticamente no momento da confirmação
            </span>
          </div>

          {/* Footer Actions */}
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
              disabled={loading || !!demonstracaoEmAberto}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition disabled:opacity-50 min-h-[44px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Registrando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Confirmar Saída</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
