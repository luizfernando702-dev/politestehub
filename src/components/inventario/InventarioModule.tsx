import React, { useState, useEffect, useRef } from 'react';
import {
  ClipboardList,
  MapPin,
  Play,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Plus,
  Minus,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  ShieldAlert,
  Loader2,
  PackageCheck,
  Search,
  ListChecks,
  Lock,
  Package,
  BarChart3,
  ChevronDown,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSessaoOperacional } from '../../context/SessaoOperacionalContext';
import { useUpdate } from '../../context/UpdateContext';
import { IdentificacaoOperacionalModal } from '../common/IdentificacaoOperacionalModal';
import { AdicionarProdutoInventarioModal } from './AdicionarProdutoInventarioModal';
import { ItemParaContagem, PreviaEnderecoContagem, RegistroEndereco, ResultadoComparacaoContagem } from '../../types';
import { inventarioService, EnderecoContagemInfo } from '../../services/inventarioService';
import { canUserAuditarContagens, isUserGestor, isUserAssistente } from '../../lib/permissions';
import { ListaContagens } from './ListaContagens';
import { RevisaoInventarioView } from './RevisaoInventarioView';
import { GraficosInventarioView } from './GraficosInventarioView';

type Stage =
  | 'inicial'
  | 'selecionar_endereco'
  | 'contagem'
  | 'resultado'
  | 'finalizacao'
  | 'revisao'
  | 'listar_contagens'
  | 'graficos';

interface InventarioModuleProps {
  onVoltarParaHome?: () => void;
}

export const InventarioModule: React.FC<InventarioModuleProps> = ({ onVoltarParaHome }) => {
  const { user } = useAuth();
  const { operador, limparSessaoOperacional } = useSessaoOperacional();
  const { marcarOperacaoAtiva } = useUpdate();
  const [isTrocandoOperador, setIsTrocandoOperador] = useState(false);

  // Ao sair do módulo (desmontagem do componente), limpa a sessão operacional
  const limparSessaoRef = useRef(limparSessaoOperacional);
  useEffect(() => {
    limparSessaoRef.current = limparSessaoOperacional;
  }, [limparSessaoOperacional]);

  useEffect(() => {
    return () => {
      limparSessaoRef.current();
    };
  }, []);

  // Etapa atual do fluxo
  const [stage, setStage] = useState<Stage>('inicial');

  // Protege a operação de contagem para nunca recarregar o PWA durante o inventário
  useEffect(() => {
    const isContagemAtiva = stage === 'contagem' || stage === 'resultado' || stage === 'finalizacao';
    marcarOperacaoAtiva(isContagemAtiva, 'inventario');
    return () => {
      marcarOperacaoAtiva(false, 'inventario');
    };
  }, [stage, marcarOperacaoAtiva]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [avisoAcessoRestrito, setAvisoAcessoRestrito] = useState<string | null>(null);
  const [solicitandoPinPara, setSolicitandoPinPara] = useState<'revisao' | null>(null);

  // Verificação de permissão para Auditoria de Contagens (Gestor e Assistente)
  const isGestor = isUserGestor(user);
  const isAssistente = isUserAssistente(user);
  const podeAuditarContagens = canUserAuditarContagens(user);

  const handleClicarIniciarContagem = () => {
    setAvisoAcessoRestrito(null);
    setContagemSelecionada('');
    setEnderecoSelecionado('');
    setPrevia(null);
    setBuscaEndereco('');
    setEnderecosComStatus([]);
    setErrorMessage(null);
    setStage('selecionar_endereco');
  };

  const handleClicarRevisao = () => {
    setAvisoAcessoRestrito(null);
    if (!operador || operador.modulo !== 'inventario') {
      setSolicitandoPinPara('revisao');
    } else {
      setStage('revisao');
    }
  };

  const handleClicarListarContagem = () => {
    if (!podeAuditarContagens) {
      setAvisoAcessoRestrito(
        'Acesso restrito: A funcionalidade de Listar contagem é exclusiva para usuários de nível Gestor ou Assistente.'
      );
      return;
    }
    setAvisoAcessoRestrito(null);
    setStage('listar_contagens');
  };

  const handleClicarGraficos = () => {
    setAvisoAcessoRestrito(null);
    setStage('graficos');
  };

  // Contagens e endereços disponíveis para a etapa de seleção
  const [contagensDisponiveis, setContagensDisponiveis] = useState<string[]>([]);
  const [contagemSelecionada, setContagemSelecionada] = useState<string>('');
  const [carregandoContagens, setCarregandoContagens] = useState<boolean>(false);
  const [carregandoEnderecos, setCarregandoEnderecos] = useState<boolean>(false);

  // Lista de endereços pendentes da contagem selecionada
  const [enderecosComStatus, setEnderecosComStatus] = useState<EnderecoContagemInfo[]>([]);
  const [enderecoSelecionado, setEnderecoSelecionado] = useState<string>('');
  const [buscaEndereco, setBuscaEndereco] = useState<string>('');
  const [previa, setPrevia] = useState<PreviaEnderecoContagem | null>(null);

  // Modal de adicionar produto ao inventário
  const [modalAdicionarProdutoOpen, setModalAdicionarProdutoOpen] = useState(false);

  // Fila de produtos do endereço para conferência às cegas
  const [filaProdutos, setFilaProdutos] = useState<ItemParaContagem[]>([]);
  const [indiceAtual, setIndiceAtual] = useState<number>(0);

  // Quantidade contada informada pelo operador no produto atual
  const [qtdContada, setQtdContada] = useState<number>(0);

  // Resultado da comparação interna (apenas o veredito, SEM exposição de valores numéricos de estoque)
  const [resultadoComparacao, setResultadoComparacao] = useState<ResultadoComparacaoContagem | null>(null);

  // Carregar lista de contagens disponíveis ao entrar no Passo 1 (nenhuma contagem pré-selecionada)
  useEffect(() => {
    if (stage === 'selecionar_endereco') {
      const carregarContagens = async () => {
        try {
          setCarregandoContagens(true);
          const lista = await inventarioService.listarContagensDisponiveis(user?.unidade_negocio);
          setContagensDisponiveis(lista);
        } catch (err) {
          console.error('Erro ao listar contagens disponíveis:', err);
        } finally {
          setCarregandoContagens(false);
        }
      };

      carregarContagens();
    }
  }, [stage, user?.unidade_negocio]);

  // Ao selecionar ou trocar de contagem: atualizar a lista de endereços pendentes e limpar pesquisa
  const handleMudarContagem = async (novaContagem: string) => {
    setContagemSelecionada(novaContagem);
    setBuscaEndereco(''); // Limpar pesquisa anterior conforme especificação
    setEnderecoSelecionado(''); // Limpar endereço selecionado anterior
    setPrevia(null);
    setErrorMessage(null);

    if (!novaContagem) {
      setEnderecosComStatus([]);
      return;
    }

    try {
      setCarregandoEnderecos(true);
      const lista = await inventarioService.listarEnderecosPendentesPorContagem(
        novaContagem,
        user?.unidade_negocio
      );
      setEnderecosComStatus(lista);
    } catch (err) {
      console.error('Erro ao carregar endereços pendentes da contagem:', err);
      setErrorMessage('Erro ao carregar os endereços pendentes desta contagem.');
    } finally {
      setCarregandoEnderecos(false);
    }
  };

  // Atualizar a prévia operacional quando o endereço selecionado mudar
  useEffect(() => {
    let isMounted = true;
    const fetchPrevia = async () => {
      if (!enderecoSelecionado || !contagemSelecionada) {
        setPrevia(null);
        return;
      }
      try {
        const data = await inventarioService.obterPreviaEndereco(
          enderecoSelecionado,
          user?.unidade_negocio,
          contagemSelecionada
        );
        if (isMounted) {
          setPrevia(data);
        }
      } catch (err) {
        console.error('Erro ao buscar prévia:', err);
      }
    };

    if (stage === 'selecionar_endereco' && enderecoSelecionado && contagemSelecionada) {
      fetchPrevia();
    }

    return () => {
      isMounted = false;
    };
  }, [enderecoSelecionado, contagemSelecionada, stage, user?.unidade_negocio]);

  // Iniciar o processo de contagem física para o endereço
  const handleIniciarContagemEndereco = async () => {
    if (!enderecoSelecionado || !contagemSelecionada) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const produtos = await inventarioService.carregarProdutosParaContagem(
        enderecoSelecionado,
        user?.unidade_negocio,
        contagemSelecionada
      );

      if (produtos.length === 0) {
        setErrorMessage(
          `Não há produtos pendentes de contagem para o endereço ${enderecoSelecionado} nesta contagem. Selecione outro endereço.`
        );
        setLoading(false);
        return;
      }

      setFilaProdutos(produtos);
      setIndiceAtual(0);
      setQtdContada(0);
      setResultadoComparacao(null);
      setStage('contagem');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar produtos do endereço.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // Recarregar os endereços pendentes da contagem selecionada
  const recarregarEnderecos = async () => {
    if (contagemSelecionada) {
      try {
        setCarregandoEnderecos(true);
        const lista = await inventarioService.listarEnderecosPendentesPorContagem(
          contagemSelecionada,
          user?.unidade_negocio
        );
        setEnderecosComStatus(lista);
      } catch (err) {
        console.error('Erro ao recarregar endereços:', err);
      } finally {
        setCarregandoEnderecos(false);
      }
    }
  };

  // Ajustar quantidade via botões touch + e -
  const handleIncrement = () => {
    setQtdContada((prev) => prev + 1);
  };

  const handleDecrement = () => {
    setQtdContada((prev) => Math.max(0, prev - 1));
  };

  // Submeter a quantidade contada para conferência interna às cegas
  const handleRegistrarContagem = async () => {
    const itemAtual = filaProdutos[indiceAtual];
    if (!itemAtual) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const resp = await inventarioService.compararContagem(itemAtual.id, qtdContada);

      if (!resp.success) {
        setErrorMessage(resp.error || 'Erro ao conferir contagem.');
        setLoading(false);
        return;
      }

      setResultadoComparacao(resp.resultado);
      setStage('resultado');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na verificação da contagem.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // Retornar para editar a quantidade contada
  const handleEditarContagem = () => {
    setStage('contagem');
  };

  // Confirmar e avançar para o próximo produto
  const handleConfirmarEAvancar = async () => {
    const itemAtual = filaProdutos[indiceAtual];
    if (!itemAtual) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const usuarioId = operador?.id || operador?.codigo || user?.id || user?.codigo || 'OP-SISTEMA';
      const saveResp = await inventarioService.gravarContagemDefinitiva({
        id: itemAtual.id,
        qtdContada,
        usuarioId,
      });

      if (!saveResp.success) {
        setErrorMessage(saveResp.error || 'Erro ao registrar contagem no banco.');
        setLoading(false);
        return;
      }

      // Avançar para próximo produto ou finalizar
      const proximoIndice = indiceAtual + 1;
      if (proximoIndice < filaProdutos.length) {
        setIndiceAtual(proximoIndice);
        setQtdContada(0);
        setResultadoComparacao(null);
        setStage('contagem');
      } else {
        setStage('finalizacao');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar contagem definitiva.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // Cancelar contagem com segurança
  const handleAbandonarSessao = () => {
    if (window.confirm('Deseja realmente sair da contagem deste endereço? Contagens não confirmadas serão descartadas.')) {
      setStage('inicial');
      setFilaProdutos([]);
      setIndiceAtual(0);
      setQtdContada(0);
      setResultadoComparacao(null);
    }
  };

  // Endereços da contagem selecionada ordenados em ordem alfabética crescente (A-Z) e filtrados por busca
  const enderecosFiltrados = enderecosComStatus
    .filter((e) => {
      if (!buscaEndereco.trim()) return true;
      const termo = buscaEndereco.toLowerCase().trim();
      return (
        e.endereco.toLowerCase().includes(termo) ||
        (e.descricao && e.descricao.toLowerCase().includes(termo))
      );
    })
    .sort((a, b) =>
      a.endereco.localeCompare(b.endereco, 'pt-BR', { numeric: true, sensitivity: 'base' })
    );

  const itemAtual = filaProdutos[indiceAtual];

  // Se o usuário solicitou troca de operador ou está entrando em bloco protegido por PIN
  if (isTrocandoOperador || solicitandoPinPara) {
    return (
      <IdentificacaoOperacionalModal
        modulo="inventario"
        onIdentificado={() => {
          setIsTrocandoOperador(false);
          if (solicitandoPinPara) {
            const dest = solicitandoPinPara;
            setSolicitandoPinPara(null);
            setStage(dest);
          }
        }}
        onVoltar={() => {
          setIsTrocandoOperador(false);
          setSolicitandoPinPara(null);
        }}
        onInicio={() => {
          setIsTrocandoOperador(false);
          setSolicitandoPinPara(null);
          if (onVoltarParaHome) onVoltarParaHome();
        }}
      />
    );
  }

  // Visualização de telas completas
  if (stage === 'revisao') {
    return <RevisaoInventarioView currentUser={user} onVoltar={() => setStage('inicial')} />;
  }

  if (stage === 'listar_contagens') {
    return <ListaContagens currentUser={user} onVoltar={() => setStage('inicial')} />;
  }

  if (stage === 'graficos') {
    return <GraficosInventarioView currentUser={user} onVoltar={() => setStage('inicial')} />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 md:pb-12 animate-in fade-in duration-200">
      {/* ------------------------------------------------------------- */}
      {/* TELA 1: PRINCIPAL — INVENTÁRIO (4 Blocos no Estilo de Alocação) */}
      {/* ------------------------------------------------------------- */}
      {stage === 'inicial' && (
        <div className="space-y-6">
          {/* Header do Módulo */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 flex items-center gap-1">
                  <ClipboardList className="w-3.5 h-3.5" />
                  Polifiltro Logística
                </span>
                <span className="text-xs text-slate-400">Conferência Física de Estoque</span>
              </div>
              {onVoltarParaHome && (
                <button
                  type="button"
                  id="btn-inventario-voltar-home"
                  onClick={onVoltarParaHome}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Início</span>
                </button>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Inventário
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
              Controle físico e auditoria de estoque com contagem cega, revisão de divergências e indicadores consolidados.
            </p>

            {/* Indicador de Operador */}
            <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
              {operador && operador.modulo === 'inventario' ? (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>
                    Operador Inventário: <strong className="text-white">{operador.nome}</strong> ({operador.codigo})
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsTrocandoOperador(true)}
                    className="ml-2 text-[11px] font-bold text-amber-400 hover:text-amber-300 hover:underline cursor-pointer"
                  >
                    (Trocar)
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <span>PIN operacional solicitado ao entrar em Revisão</span>
                </div>
              )}
              <span className="text-[11px] px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-300 font-mono">
                Nível: {user?.nivel}
              </span>
            </div>
          </div>

          {/* GRID COM OS 4 BLOCOS EM ORDEM (Requisito 3) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {/* Bloco 1: Iniciar contagem */}
            <button
              type="button"
              id="btn-bloco-iniciar-contagem"
              onClick={handleClicarIniciarContagem}
              className="flex flex-col justify-between p-6 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-900 transition-all text-left group min-h-[200px] shadow-xl hover:-translate-y-1 active:scale-[0.99] cursor-pointer"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4 group-hover:scale-105 transition">
                  <Play className="w-6 h-6 fill-current" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-white group-hover:text-blue-400 transition">
                  Iniciar contagem
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Conferência física de produtos por endereço com contagem às cegas no armazém.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400 mt-5 group-hover:translate-x-1 transition">
                <span>Realizar contagem</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </button>

            {/* Bloco 2: Revisão (Foco mobile) */}
            <button
              type="button"
              id="btn-bloco-revisao"
              onClick={handleClicarRevisao}
              className="flex flex-col justify-between p-6 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-900 transition-all text-left group min-h-[200px] shadow-xl hover:-translate-y-1 active:scale-[0.99] cursor-pointer"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-105 transition">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-white group-hover:text-amber-400 transition">
                  Revisão
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Segunda contagem física e histórico de endereços com interface focada em dispositivos móveis.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mt-5 group-hover:translate-x-1 transition">
                <span>Acessar revisão</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </button>

            {/* Bloco 3: Listar contagem (Foco PC) */}
            <button
              type="button"
              id="btn-bloco-listar-contagem"
              onClick={handleClicarListarContagem}
              className="flex flex-col justify-between p-6 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-900 transition-all text-left group min-h-[200px] shadow-xl hover:-translate-y-1 active:scale-[0.99] cursor-pointer"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-4 group-hover:scale-105 transition">
                  <ListChecks className="w-6 h-6" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-white group-hover:text-sky-400 transition">
                  Listar contagem
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Auditoria de divergências nas abas Falta, Sobressalentes e Corrigidas (foco PC).
                </p>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-sky-400 mt-5 group-hover:translate-x-1 transition">
                <span className="flex items-center gap-1.5">
                  <span>Auditar contagens</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
                {!podeAuditarContagens && (
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Gestor / Assistente
                  </span>
                )}
              </div>
            </button>

            {/* Bloco 4: Gráficos e Indicadores (Visível apenas em computadores: hidden lg:flex) */}
            <button
              type="button"
              id="btn-bloco-graficos-indicadores"
              onClick={handleClicarGraficos}
              className="hidden lg:flex flex-col justify-between p-6 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900 transition-all text-left group min-h-[200px] shadow-xl hover:-translate-y-1 active:scale-[0.99] cursor-pointer"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-105 transition">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-white group-hover:text-emerald-400 transition">
                  Gráficos e Indicadores
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Painel analítico com taxas de acuracidade, KPIs de estoque e status em tempo real.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 mt-5 group-hover:translate-x-1 transition">
                <span>Ver indicadores</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </button>
          </div>

          {/* Mensagem de Acesso Restrito (quando usuário sem perfil gestor clica) */}
          {avisoAcessoRestrito && (
            <div
              id="alerta-acesso-restrito"
              className="p-4 sm:p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-3 animate-in fade-in"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">Acesso Restrito ao Módulo Gestor</h4>
                  <p className="text-xs text-amber-200/90 leading-relaxed">
                    {avisoAcessoRestrito}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Perfil logado atualmente: <strong className="text-white">{user?.nivel || 'Operador'}</strong> ({user?.nome || 'Usuário'}).
                  </p>
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  id="btn-fechar-aviso-permissao"
                  onClick={() => setAvisoAcessoRestrito(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition cursor-pointer min-h-[38px]"
                >
                  Entendido
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TELA 2: SELEÇÃO DO ENDEREÇO & PRÉVIA                          */}
      {/* ------------------------------------------------------------- */}
      {stage === 'selecionar_endereco' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">Passo 1</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <MapPin className="w-6 h-6 text-sky-400" />
                <span>Selecionar Endereço</span>
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setStage('inicial')}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>

          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Grid Responsivo no Desktop: Lista de Endereços à esquerda, Prévia e Ações à direita */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Coluna da Esquerda (7 cols): Seleção de Contagem, Pesquisa e Lista de Endereços Pendentes */}
            <div className="lg:col-span-7 rounded-3xl bg-slate-900/90 border border-slate-800 p-5 shadow-xl space-y-4">
              {/* 1. Campo para selecionar a contagem disponível */}
              <div className="space-y-1.5 pb-2 border-b border-slate-800/80">
                <label
                  htmlFor="select-contagem-disponivel"
                  className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 text-sky-400" />
                    Selecionar Contagem
                  </span>
                  {contagensDisponiveis.length > 0 && (
                    <span className="text-[10px] font-normal text-slate-400 font-mono">
                      {contagensDisponiveis.length} {contagensDisponiveis.length === 1 ? 'disponível' : 'disponíveis'}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <select
                    id="select-contagem-disponivel"
                    value={contagemSelecionada}
                    onChange={(e) => handleMudarContagem(e.target.value)}
                    disabled={carregandoContagens}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl px-4 py-3 text-sm text-white font-medium focus:outline-hidden focus:border-sky-500 transition min-h-[46px] cursor-pointer disabled:opacity-50 appearance-none pr-10"
                  >
                    <option value="" disabled className="bg-slate-900 text-slate-400">
                      {carregandoContagens
                        ? 'Carregando contagens disponíveis...'
                        : contagensDisponiveis.length === 0
                        ? 'Nenhuma contagem encontrada'
                        : '-- Selecione uma contagem --'}
                    </option>
                    {contagensDisponiveis.map((c) => (
                      <option key={c} value={c} className="bg-slate-900 text-white">
                        {c}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    {carregandoContagens ? (
                      <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Caixa de pesquisa de endereço */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  id="input-busca-endereco"
                  value={buscaEndereco}
                  onChange={(e) => setBuscaEndereco(e.target.value)}
                  disabled={!contagemSelecionada || carregandoEnderecos}
                  placeholder={
                    !contagemSelecionada
                      ? 'Selecione uma contagem acima primeiro...'
                      : 'Pesquisar endereço por código ou rua...'
                  }
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500 transition min-h-[46px] disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* 3. Lista de endereços relacionados à contagem selecionada (Ordenação A-Z) */}
              <div className="space-y-2 max-h-80 lg:max-h-96 overflow-y-auto pr-1">
                {!contagemSelecionada ? (
                  <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-slate-800 text-slate-400 space-y-2">
                    <ClipboardList className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-sm font-semibold text-slate-300">
                      Nenhuma contagem selecionada
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Selecione uma contagem acima para carregar e visualizar os endereços com produtos pendentes de contagem.
                    </p>
                  </div>
                ) : carregandoEnderecos ? (
                  <div className="text-center py-12 text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
                    <span>Carregando endereços pendentes da contagem...</span>
                  </div>
                ) : enderecosComStatus.length === 0 ? (
                  <div className="text-center py-12 px-4 rounded-2xl border border-slate-800 bg-slate-950/40 text-slate-400 space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mx-auto" />
                    <p className="text-sm font-semibold text-slate-300">
                      Não há endereços pendentes nesta contagem
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Todos os endereços desta contagem foram concluídos ou não possuem produtos aguardando contagem.
                    </p>
                  </div>
                ) : enderecosFiltrados.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500">
                    Nenhum endereço encontrado para &ldquo;{buscaEndereco}&rdquo; nesta contagem.
                  </div>
                ) : (
                  enderecosFiltrados.map((item) => {
                    const isSelected = enderecoSelecionado === item.endereco;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        id={`btn-endereco-${item.endereco}`}
                        onClick={() => setEnderecoSelecionado(item.endereco)}
                        className={`w-full text-left p-3.5 rounded-2xl border transition flex items-center justify-between min-h-[52px] ${
                          isSelected
                            ? 'bg-sky-500/20 border-sky-500 text-white shadow-md'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-3 h-3 rounded-full shrink-0 ${
                              isSelected ? 'bg-sky-400' : 'bg-slate-700'
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-sm text-white truncate">
                                {item.endereco}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                                Pendente ({item.pendentes} {item.pendentes === 1 ? 'item' : 'itens'})
                              </span>
                            </div>
                            {item.descricao && (
                              <span className="text-[11px] text-slate-400 block truncate">
                                {item.descricao}
                              </span>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <CheckCircle2 className="w-5 h-5 text-sky-400 shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Coluna da Direita (5 cols): Painel de Ações & Prévia Operacional */}
            <div className="lg:col-span-5 space-y-4">
              {/* Prévia Operacional do Endereço */}
              <div
                id="previa-endereco"
                className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 shadow-xl text-slate-200 space-y-3.5"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                    Prévia Operacional
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Conferência Cega
                  </span>
                </div>

                {previa ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">
                          Endereço
                        </span>
                        <strong className="text-base font-mono font-black text-white truncate block">
                          {previa.endereco}
                        </strong>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">
                          Itens na Fila
                        </span>
                        <strong className="text-base font-mono font-black text-sky-300 block">
                          {previa.totalProdutos}
                        </strong>
                      </div>
                    </div>

                    {contagemSelecionada && (
                      <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                        <span>Contagem:</span>
                        <strong className="text-white font-medium truncate ml-2">
                          {contagemSelecionada}
                        </strong>
                      </div>
                    )}

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Ao iniciar, cada produto deste endereço será exibido individualmente para conferência física às cegas.
                    </p>
                  </div>
                ) : !contagemSelecionada ? (
                  <div className="text-center py-6 text-xs text-slate-500">
                    Selecione uma contagem acima para começar.
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-slate-500">
                    Selecione um endereço para visualizar a prévia operacional.
                  </div>
                )}

                {/* Botão para Adicionar Produto novo ao Endereço */}
                <button
                  type="button"
                  id="btn-adicionar-produto-selecao"
                  disabled={!enderecoSelecionado || !contagemSelecionada}
                  onClick={() => setModalAdicionarProdutoOpen(true)}
                  className="w-full py-3 px-4 rounded-2xl bg-slate-950 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 font-bold text-xs border border-emerald-500/30 hover:border-emerald-500/60 flex items-center justify-center gap-2 transition min-h-[46px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar Produto ao Endereço</span>
                </button>
              </div>

              {/* Botões de Navegação */}
              <div className="space-y-3">
                <button
                  type="button"
                  id="btn-iniciar-contagem-endereco"
                  onClick={handleIniciarContagemEndereco}
                  disabled={
                    loading ||
                    !contagemSelecionada ||
                    !enderecoSelecionado ||
                    (previa && previa.totalProdutos === 0)
                  }
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2 transition min-h-[52px] cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Carregando Fila...</span>
                    </>
                  ) : (
                    <>
                      <span>INICIAR CONTAGEM</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStage('inicial')}
                  className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white font-bold text-xs border border-slate-800 transition min-h-[46px]"
                >
                  Voltar ao Painel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TELA 3: CONTAGEM FÍSICA DO PRODUTO (BLIND COUNT)              */}
      {/* ------------------------------------------------------------- */}
      {stage === 'contagem' && itemAtual && (
        <div className="space-y-6">
          {/* Barra Superior com Endereço e Progresso */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/40">
                  {itemAtual.endereco}
                </span>
                <span className="text-xs text-slate-400">
                  Item {indiceAtual + 1} de {filaProdutos.length}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white mt-1">
                Conferência Física
              </h2>
            </div>

            <button
              type="button"
              onClick={handleAbandonarSessao}
              className="text-xs text-slate-400 hover:text-rose-400 py-1.5 px-3 rounded-xl border border-slate-800 hover:border-rose-500/40 transition"
              title="Cancelar contagem deste endereço"
            >
              Cancelar
            </button>
          </div>

          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Card do Produto Sendo Contado (SEM nenhuma quantidade esperada do sistema!) */}
          <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl space-y-6">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Produto
              </span>
              <h3 className="text-lg sm:text-xl font-black text-white leading-snug">
                {itemAtual.produto}
              </h3>
            </div>

            {/* Controle de Quantidade Contada com Teclado Numérico Android e Botões + / - */}
            <div className="space-y-3">
              <label htmlFor="input-qtd-contada" className="block text-xs font-bold text-slate-300 uppercase tracking-wider text-center">
                Quantidade Contada
              </label>

              <div className="flex items-center justify-center gap-3">
                {/* Botão Diminuir */}
                <button
                  type="button"
                  id="btn-decrementar-qtd"
                  onClick={handleDecrement}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 active:scale-95 text-white flex items-center justify-center transition border border-slate-700 shadow-md min-h-[56px] min-w-[56px] cursor-pointer"
                  aria-label="Diminuir quantidade"
                >
                  <Minus className="w-6 h-6 stroke-[3]" />
                </button>

                {/* Input Numérico com foco para teclado do Android */}
                <div className="w-36 sm:w-44">
                  <input
                    type="number"
                    id="input-qtd-contada"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min="0"
                    step="1"
                    value={qtdContada === 0 ? '' : qtdContada}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setQtdContada(isNaN(val) || val < 0 ? 0 : val);
                    }}
                    placeholder="0"
                    className="w-full text-center py-3 sm:py-4 px-2 bg-slate-950 border-2 border-sky-500/80 rounded-2xl text-3xl sm:text-4xl font-mono font-black text-white focus:outline-hidden focus:border-sky-400 shadow-inner min-h-[56px]"
                  />
                </div>

                {/* Botão Aumentar */}
                <button
                  type="button"
                  id="btn-incrementar-qtd"
                  onClick={handleIncrement}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 active:scale-95 text-white flex items-center justify-center transition border border-blue-400 shadow-lg shadow-blue-500/20 min-h-[56px] min-w-[56px] cursor-pointer"
                  aria-label="Aumentar quantidade"
                >
                  <Plus className="w-6 h-6 stroke-[3]" />
                </button>
              </div>

              <p className="text-[11px] text-slate-500 text-center">
                Toque no número para digitar diretamente pelo teclado numérico ou utilize os botões <strong>−</strong> e <strong>+</strong>.
              </p>
            </div>

            {/* Botão REGISTRAR */}
            <div className="pt-2">
              <button
                type="button"
                id="btn-registrar-contagem"
                onClick={handleRegistrarContagem}
                disabled={loading}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 active:scale-98 disabled:opacity-50 text-white font-black text-base shadow-xl flex items-center justify-center gap-2 transition min-h-[52px] cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Conferindo...</span>
                  </>
                ) : (
                  <span>REGISTRAR</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TELA 4: RESULTADO DA CONTAGEM (OS 3 CENÁRIOS)                 */}
      {/* ------------------------------------------------------------- */}
      {stage === 'resultado' && itemAtual && resultadoComparacao && (
        <div className="space-y-6">
          <div className="text-center pb-2 border-b border-slate-800">
            <span className="text-xs font-mono font-bold text-slate-400">
              {itemAtual.endereco} &bull; {itemAtual.produto}
            </span>
            <h2 className="text-xl font-bold text-white mt-1">
              Resultado da Conferência
            </h2>
          </div>

          {/* CENÁRIO 1: QUANTIDADE IGUAL (VERDE) */}
          {resultadoComparacao === 'IGUAL' && (
            <div className="rounded-3xl bg-emerald-500/10 border-2 border-emerald-500/50 p-6 sm:p-8 shadow-2xl text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg sm:text-xl font-black text-emerald-300">
                  Contagem conferida com sucesso.
                </h3>
                <p className="text-xs text-emerald-200/80">
                  O valor informado confere exatamente com o registro do sistema.
                </p>
              </div>

              {/* Botões do Cenário 1: VOLTAR e PROSSEGUIR */}
              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  id="btn-resultado-voltar"
                  onClick={handleEditarContagem}
                  className="w-full sm:w-1/2 py-3.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-sm border border-slate-700 transition min-h-[50px]"
                >
                  VOLTAR
                </button>

                <button
                  type="button"
                  id="btn-resultado-prosseguir"
                  onClick={handleConfirmarEAvancar}
                  disabled={loading}
                  className="w-full sm:w-1/2 py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition min-h-[50px] cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>PROSSEGUIR</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* CENÁRIO 2: QUANTIDADE MENOR (VERMELHO) */}
          {resultadoComparacao === 'MENOR' && (
            <div className="rounded-3xl bg-rose-500/10 border-2 border-rose-500/50 p-6 sm:p-8 shadow-2xl text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto shadow-lg">
                <AlertCircle className="w-9 h-9" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-black text-rose-300">
                  A quantidade contada é menor que a quantidade disponível no sistema.
                </h3>
                <p className="text-xs text-rose-200/80">
                  Você pode recontar fisicamente o produto ou confirmar a contagem divergente.
                </p>
              </div>

              {/* Botões do Cenário 2: EDITAR e PRÓXIMO */}
              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  id="btn-resultado-editar-menor"
                  onClick={handleEditarContagem}
                  className="w-full sm:w-1/2 py-3.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-sm border border-slate-700 transition min-h-[50px]"
                >
                  EDITAR
                </button>

                <button
                  type="button"
                  id="btn-resultado-proximo-menor"
                  onClick={handleConfirmarEAvancar}
                  disabled={loading}
                  className="w-full sm:w-1/2 py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-98 text-white font-black text-sm shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition min-h-[50px] cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>PRÓXIMO</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* CENÁRIO 3: QUANTIDADE MAIOR (LARANJA) */}
          {resultadoComparacao === 'MAIOR' && (
            <div className="rounded-3xl bg-amber-500/10 border-2 border-amber-500/50 p-6 sm:p-8 shadow-2xl text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-lg">
                <AlertTriangle className="w-9 h-9" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-black text-amber-300">
                  Quantidade contada é maior que a disponível.
                </h3>
                <p className="text-xs text-amber-200/80">
                  Você pode recontar fisicamente o produto ou confirmar a contagem divergente.
                </p>
              </div>

              {/* Botões do Cenário 3: EDITAR e PRÓXIMO */}
              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  id="btn-resultado-editar-maior"
                  onClick={handleEditarContagem}
                  className="w-full sm:w-1/2 py-3.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-sm border border-slate-700 transition min-h-[50px]"
                >
                  EDITAR
                </button>

                <button
                  type="button"
                  id="btn-resultado-proximo-maior"
                  onClick={handleConfirmarEAvancar}
                  disabled={loading}
                  className="w-full sm:w-1/2 py-3.5 px-4 rounded-2xl bg-amber-600 hover:bg-amber-500 active:scale-98 text-slate-950 font-black text-sm shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 transition min-h-[50px] cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>PRÓXIMO</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TELA 5: FINALIZAÇÃO DO ENDEREÇO                               */}
      {/* ------------------------------------------------------------- */}
      {stage === 'finalizacao' && (
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 shadow-2xl text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-blue-500/10 border-2 border-blue-500/40 text-blue-400 flex items-center justify-center mx-auto shadow-xl shadow-blue-500/10">
            <PackageCheck className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Contagem finalizada
            </h2>
            <div className="inline-block px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 font-mono text-sm font-bold text-sky-400">
              Endereço: {enderecoSelecionado}
            </div>
            <p className="text-sm font-semibold text-slate-300">
              Todos os produtos foram conferidos.
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Os registros de conferência física foram armazenados com o carimbo de data, hora e identificação do seu usuário.
            </p>
          </div>

          {/* Ação extra: Adicionar Produto ao Endereço mesmo após finalizar */}
          <div className="pt-2">
            <button
              type="button"
              id="btn-finalizacao-adicionar-produto"
              onClick={() => setModalAdicionarProdutoOpen(true)}
              className="w-full py-3.5 px-4 rounded-2xl bg-slate-950 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 font-bold text-xs border border-emerald-500/40 hover:border-emerald-500 flex items-center justify-center gap-2 transition min-h-[48px] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Outro Produto Encontrado neste Endereço</span>
            </button>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              id="btn-finalizacao-novo-endereco"
              onClick={() => {
                setStage('selecionar_endereco');
                setFilaProdutos([]);
                setIndiceAtual(0);
                setQtdContada(0);
                setResultadoComparacao(null);
                setEnderecoSelecionado('');
                setPrevia(null);
                recarregarEnderecos();
              }}
              className="w-full sm:w-1/2 py-4 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 active:scale-98 text-white font-black text-sm shadow-lg flex items-center justify-center gap-2 transition min-h-[52px] cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Contar Outro Endereço</span>
            </button>

            <button
              type="button"
              id="btn-finalizacao-voltar-inicio"
              onClick={() => {
                setStage('inicial');
                setFilaProdutos([]);
                setIndiceAtual(0);
                setQtdContada(0);
                setResultadoComparacao(null);
                setEnderecoSelecionado('');
                setPrevia(null);
              }}
              className="w-full sm:w-1/2 py-4 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 font-bold text-sm border border-slate-700 transition min-h-[52px] cursor-pointer"
            >
              Voltar ao Início
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TELA 6: LISTA DE CONTAGENS (PAINEL GESTOR)                    */}
      {/* ------------------------------------------------------------- */}
      {stage === 'listar_contagens' && (
        <ListaContagens
          currentUser={user}
          onVoltar={() => setStage('inicial')}
        />
      )}

      {/* Modal de Adicionar Produto ao Inventário com Validação de Duplicidade */}
      <AdicionarProdutoInventarioModal
        isOpen={modalAdicionarProdutoOpen}
        onClose={() => setModalAdicionarProdutoOpen(false)}
        endereco={enderecoSelecionado}
        contagem={contagemSelecionada || undefined}
        usuarioId={operador?.id || operador?.codigo || user?.id || user?.codigo || 'OP-SISTEMA'}
        onProdutoAdicionado={async (novoItem) => {
          // Atualiza a lista de endereços e o status de contagem
          await recarregarEnderecos();
          if (enderecoSelecionado && contagemSelecionada) {
            const novaPrevia = await inventarioService.obterPreviaEndereco(
              enderecoSelecionado,
              user?.unidade_negocio,
              contagemSelecionada
            );
            setPrevia(novaPrevia);
          }

          // Se estiver na tela de finalização, inclui na fila e retoma a contagem para o produto adicionado
          if (stage === 'finalizacao') {
            const novaFila = [...filaProdutos, novoItem];
            setFilaProdutos(novaFila);
            setIndiceAtual(novaFila.length - 1);
            setQtdContada(0);
            setResultadoComparacao(null);
            setStage('contagem');
          }
        }}
      />
    </div>
  );
};
