import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare,
  Minus,
  X,
  Send,
  Plus,
  Users,
  User,
  ArrowLeft,
  Search,
  Building2,
  Circle,
  Loader2,
  AlertCircle,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isUserGestor } from '../../lib/permissions';
import { chatService, CHAT_PAGE_SIZE } from '../../services/chatService';
import { unidadesNegocioService } from '../../services/unidadesNegocioService';
import {
  ChatConversa,
  ChatMensagem,
  ChatUsuarioContato,
  UnidadeNegocio,
} from '../../types';
import { formatarNomeSobrenomeExibicao } from '../../utils/nomeSobrenome';

type ChatView = 'lista' | 'conversa' | 'nova_conversa' | 'novo_grupo';

/**
 * Componente para exibição da foto real do usuário cadastrado com fallback para iniciais.
 */
const UserAvatar: React.FC<{ foto?: string | null; nome: string; size?: string }> = ({
  foto,
  nome,
  size = 'w-9 h-9',
}) => {
  const [imgError, setImgError] = useState(false);
  const iniciais = useMemo(() => {
    const parts = (nome || '').trim().split(/\s+/);
    if (!parts[0]) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [nome]);

  if (foto && !imgError) {
    return (
      <img
        src={foto}
        alt={nome}
        onError={() => setImgError(true)}
        className={`${size} rounded-xl object-cover shrink-0 border border-slate-700/60 shadow-xs`}
      />
    );
  }

  return (
    <div
      className={`${size} rounded-xl bg-slate-800 text-slate-200 border border-slate-700/60 flex items-center justify-center font-bold text-xs shrink-0 select-none shadow-xs`}
    >
      {iniciais}
    </div>
  );
};

/**
 * Formatação da data e hora do último acesso no padrão brasileiro (DD/MM/AAAA HH:mm).
 */
const formatarUltimoAcesso = (iso?: string | null) => {
  if (!iso) return 'Nunca acessou';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Nunca acessou';
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Nunca acessou';
  }
};

export const FloatingChat: React.FC = () => {
  const { user } = useAuth();
  const isGestor = isUserGestor(user);

  // Estados de visibilidade e visualização
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentView, setCurrentView] = useState<ChatView>('lista');

  // Conversas e mensagens
  const [conversas, setConversas] = useState<ChatConversa[]>([]);
  const [activeConversa, setActiveConversa] = useState<ChatConversa | null>(null);
  const [mensagens, setMensagens] = useState<ChatMensagem[]>([]);
  const [totalNaoLidas, setTotalNaoLidas] = useState(0);

  // Paginação de mensagens
  const [temMaisMensagens, setTemMaisMensagens] = useState(false);
  const [carregandoAnteriores, setCarregandoAnteriores] = useState(false);

  // Rascunhos de mensagens preservados ao navegar ou minimizar
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({});
  const [mensagemInput, setMensagemInput] = useState('');

  // Busca na lista de conversas
  const [filtroConversas, setFiltroConversas] = useState('');

  // Seleção de contatos para Nova Conversa
  const [unidades, setUnidades] = useState<UnidadeNegocio[]>([]);
  const [unidadeSelecionada, setUnidadeSelecionada] = useState<string>('');
  const [buscaUsuario, setBuscaUsuario] = useState('');
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState<ChatUsuarioContato[]>([]);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(false);

  // Criação de Novo Grupo (Gestor)
  const [nomeNovoGrupo, setNomeNovoGrupo] = useState('');
  const [participantesGrupo, setParticipantesGrupo] = useState<ChatUsuarioContato[]>([]);

  // Estados de carregamento e erro
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [carregandoMensagens, setCarregandoMensagens] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Referência para rolagem suave das mensagens
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  // ---------------------------------------------------------------------------
  // 1. CARREGAMENTO INICIAL E SINCRONIZAÇÃO EM TEMPO REAL
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!user?.id) return;

    // Define unidade padrão para o seletor de contatos
    setUnidadeSelecionada(user.unidade_negocio || 'Goiânia-GO');

    // Carrega unidades para o seletor
    unidadesNegocioService.listar().then((list) => {
      setUnidades(list);
    });

    // Carrega lista de conversas e total não lidas
    carregarConversas();

    // Assina canal Realtime do Supabase para novas mensagens
    const unsubscribe = chatService.assinarRealtimeMensagens((novaMsg) => {
      // Se a conversa aberta recebeu mensagem
      if (activeConversa && activeConversa.id === novaMsg.conversa_id) {
        setMensagens((prev) => {
          if (prev.some((m) => m.id === novaMsg.id)) return prev;
          return [...prev, novaMsg];
        });
        // Marca como lida se o painel estiver expandido
        if (isExpanded) {
          chatService.marcarComoLida(novaMsg.conversa_id, user.id);
        }
      }

      // Atualiza lista de conversas e contadores
      carregarConversas(false);
    });

    // Escuta evento customizado de atualização local
    const handleChatUpdate = () => {
      carregarConversas(false);
    };
    window.addEventListener('polihub_chat_update', handleChatUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener('polihub_chat_update', handleChatUpdate);
    };
  }, [user?.id, activeConversa?.id, isExpanded]);

  // Carrega lista de conversas
  const carregarConversas = async (mostrarSpinner = true) => {
    if (!user?.id) return;
    if (mostrarSpinner) setCarregandoLista(true);
    try {
      const lista = await chatService.listarConversasDoUsuario(user.id);
      setConversas(lista);
      const naoLidas = lista.reduce((acc, c) => acc + (c.nao_lidas || 0), 0);
      setTotalNaoLidas(naoLidas);

      // Atualiza activeConversa se ela ainda estiver aberta
      if (activeConversa) {
        const atualizada = lista.find((c) => c.id === activeConversa.id);
        if (atualizada) {
          setActiveConversa(atualizada);
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar conversas do usuário:', err);
    } finally {
      if (mostrarSpinner) setCarregandoLista(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 2. ABERTURA DE CONVERSA E PAGINAÇÃO (30 MENSAGENS)
  // ---------------------------------------------------------------------------
  const handleAbrirConversa = async (conversa: ChatConversa) => {
    if (!user?.id) return;
    setActiveConversa(conversa);
    setCurrentView('conversa');
    setErro(null);

    // Recupera rascunho anterior desta conversa, se houver
    setMensagemInput(rascunhos[conversa.id] || '');

    setCarregandoMensagens(true);
    try {
      const { mensagens: msgs, temMais } = await chatService.listarMensagens(conversa.id, {
        limite: CHAT_PAGE_SIZE,
      });
      setMensagens(msgs);
      setTemMaisMensagens(temMais);

      // Marca mensagens como lidas
      await chatService.marcarComoLida(conversa.id, user.id);
      carregarConversas(false);
    } catch (err) {
      console.warn('Erro ao carregar mensagens da conversa:', err);
      setErro('Não foi possível carregar o histórico de mensagens.');
    } finally {
      setCarregandoMensagens(false);
      scrollToBottom();
    }
  };

  // Rolar para mensagens anteriores (30 por bloco)
  const handleCarregarMensagensAnteriores = async () => {
    if (!activeConversa || mensagens.length === 0 || carregandoAnteriores) return;
    const primeiraMsg = mensagens[0];
    setCarregandoAnteriores(true);
    try {
      const { mensagens: anteriores, temMais } = await chatService.listarMensagens(activeConversa.id, {
        limite: CHAT_PAGE_SIZE,
        antesDeTimestamp: primeiraMsg.created_at,
      });
      setMensagens((prev) => [...anteriores, ...prev]);
      setTemMaisMensagens(temMais);
    } catch (err) {
      console.warn('Erro ao paginar mensagens anteriores:', err);
    } finally {
      setCarregandoAnteriores(false);
    }
  };

  // Scroll automático para o final da lista de mensagens
  const scrollToBottom = (smooth = false) => {
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
      }
    }, 50);
  };

  useEffect(() => {
    if (currentView === 'conversa' && mensagens.length > 0) {
      scrollToBottom();
    }
  }, [mensagens.length, currentView]);

  // Salva rascunho em memória enquanto o usuário digita
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setMensagemInput(text);
    if (activeConversa) {
      setRascunhos((prev) => ({
        ...prev,
        [activeConversa.id]: text,
      }));
    }
  };

  // ---------------------------------------------------------------------------
  // 3. ENVIO DE MENSAGENS (TEXTO EXCLUSIVAMENTE)
  // ---------------------------------------------------------------------------
  const handleEnviarMensagem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user?.id || !activeConversa) return;
    const conteudo = mensagemInput.trim();
    if (!conteudo || enviando) return;

    setEnviando(true);
    setErro(null);

    // Otimista: limpa input e rascunho
    setMensagemInput('');
    setRascunhos((prev) => {
      const copia = { ...prev };
      delete copia[activeConversa.id];
      return copia;
    });

    try {
      const msgEnviada = await chatService.enviarMensagem(activeConversa.id, user.id, conteudo);
      setMensagens((prev) => [...prev, msgEnviada]);
      scrollToBottom(true);
      carregarConversas(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao enviar mensagem.';
      setErro(msg);
      // Restaura o texto no input em caso de erro
      setMensagemInput(conteudo);
    } finally {
      setEnviando(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEnviarMensagem();
    }
  };

  // ---------------------------------------------------------------------------
  // 4. PESQUISA DE USUÁRIOS POR UNIDADE (NOVA CONVERSA)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (currentView === 'nova_conversa' || currentView === 'novo_grupo') {
      buscarUsuarios();
    }
  }, [currentView, unidadeSelecionada, buscaUsuario]);

  const buscarUsuarios = async () => {
    setCarregandoUsuarios(true);
    try {
      const lista = await chatService.pesquisarUsuariosPorUnidade(
        unidadeSelecionada || 'todas',
        buscaUsuario,
        30
      );
      // Remove o próprio usuário da lista
      const outros = lista.filter((u) => u.id !== user?.id);
      setUsuariosDisponiveis(outros);
    } catch (err) {
      console.warn('Erro ao pesquisar usuários por unidade:', err);
    } finally {
      setCarregandoUsuarios(false);
    }
  };

  // Iniciar ou abrir conversa individual com o contato selecionado
  const handleSelecionarContato = async (contato: ChatUsuarioContato) => {
    if (!user?.id) return;
    setErro(null);
    try {
      const conversa = await chatService.obterOuCriarConversaIndividual(
        user.id,
        contato.id,
        contato.unidade_negocio
      );
      handleAbrirConversa(conversa);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível iniciar conversa com este usuário.';
      setErro(msg);
    }
  };

  // ---------------------------------------------------------------------------
  // 5. CRIAÇÃO DE GRUPO (GESTOR EXCLUSIVO)
  // ---------------------------------------------------------------------------
  const handleToggleParticipanteGrupo = (contato: ChatUsuarioContato) => {
    setParticipantesGrupo((prev) => {
      const jaExiste = prev.some((p) => p.id === contato.id);
      if (jaExiste) {
        return prev.filter((p) => p.id !== contato.id);
      }
      return [...prev, contato];
    });
  };

  const handleCriarGrupo = async () => {
    if (!user) return;
    if (!nomeNovoGrupo.trim()) {
      setErro('Informe um nome para o grupo.');
      return;
    }
    if (participantesGrupo.length === 0) {
      setErro('Selecione pelo menos um participante para o grupo.');
      return;
    }

    setErro(null);
    try {
      const ids = participantesGrupo.map((p) => p.id);
      const grupoCriado = await chatService.criarGrupo(user, nomeNovoGrupo.trim(), ids);
      setNomeNovoGrupo('');
      setParticipantesGrupo([]);
      handleAbrirConversa(grupoCriado);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao criar grupo.';
      setErro(msg);
    }
  };

  // ---------------------------------------------------------------------------
  // FILTRAGEM DA LISTA DE CONVERSAS
  // ---------------------------------------------------------------------------
  const conversasFiltradas = useMemo(() => {
    if (!filtroConversas.trim()) return conversas;
    const termo = filtroConversas.toLowerCase();
    return conversas.filter((c) => {
      const nomeConv = c.tipo === 'grupo' ? c.nome : c.outro_usuario?.nome;
      return (nomeConv || '').toLowerCase().includes(termo);
    });
  }, [conversas, filtroConversas]);

  // Formatação amigável de horário
  const formatarHorario = (iso: string) => {
    try {
      const data = new Date(iso);
      const hoje = new Date();
      const mesmoDia =
        data.getDate() === hoje.getDate() &&
        data.getMonth() === hoje.getMonth() &&
        data.getFullYear() === hoje.getFullYear();

      if (mesmoDia) {
        return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }
      return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    } catch {
      return '';
    }
  };

  // Destaque do balão flutuante de mensagens (Regra Item 4)
  const temNaoLidaGestor = useMemo(() => {
    return conversas.some((c) => (c.nao_lidas || 0) > 0 && c.tem_nao_lidas_gestor);
  }, [conversas]);

  const prioridadeCor = useMemo<'vermelho' | 'laranja' | 'padrao'>(() => {
    if (totalNaoLidas === 0) return 'padrao';
    if (temNaoLidaGestor) return 'vermelho';
    return 'laranja';
  }, [totalNaoLidas, temNaoLidaGestor]);

  // Se o usuário não estiver logado, não renderiza o chat flutuante
  if (!user) return null;

  return (
    <>
      {/* =====================================================================
          ESTADO RECOLHIDO: BARRA COMPACTA FIXA NO CANTO INFERIOR DIREITO
          Inspirada nos mensageiros de PC, com destaque visual por prioridade (Item 4)
          ===================================================================== */}
      {!isExpanded && (
        <aside
          role="region"
          aria-label="Hub Messenger"
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 select-none"
        >
          <button
            type="button"
            id="btn-abrir-mensagens-flutuante"
            onClick={() => setIsExpanded(true)}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full border shadow-2xl transition-all duration-200 cursor-pointer active:scale-95 ${
              prioridadeCor === 'vermelho'
                ? 'bg-rose-600 hover:bg-rose-500 border-rose-400 text-white ring-4 ring-rose-500/30 shadow-rose-600/50 animate-pulse'
                : prioridadeCor === 'laranja'
                ? 'bg-amber-600 hover:bg-amber-500 border-amber-400 text-white ring-4 ring-amber-500/30 shadow-amber-600/50 animate-pulse'
                : 'bg-slate-900/95 hover:bg-slate-800/95 border-slate-700/80 hover:border-slate-600 text-slate-100 hover:text-white backdrop-blur-md'
            }`}
            title="Abrir Hub Messenger"
          >
            {/* Ícone com indicador de presença verde */}
            <div className="relative flex items-center justify-center">
              <MessageSquare className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
            </div>

            <span className="text-xs sm:text-sm font-bold tracking-tight">Hub Messenger</span>

            {/* Contador de mensagens não lidas */}
            {totalNaoLidas > 0 && (
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full font-extrabold text-[11px] shadow-sm ${
                  prioridadeCor === 'vermelho'
                    ? 'bg-white text-rose-700'
                    : prioridadeCor === 'laranja'
                    ? 'bg-white text-amber-700'
                    : 'bg-rose-500 text-white'
                }`}
              >
                {totalNaoLidas > 99 ? '99+' : totalNaoLidas}
              </span>
            )}
          </button>
        </aside>
      )}

      {/* =====================================================================
          ESTADO EXPANDIDO: PAINEL FLUTUANTE SOBREPOSTO
          Adaptado para desktop e celular, sem interromper nem recarregar o menu
          ===================================================================== */}
      {isExpanded && (
        <div
          role="dialog"
          aria-label="Hub Messenger"
          className="fixed inset-x-2 bottom-2 top-14 sm:inset-auto sm:right-6 sm:bottom-6 sm:w-[410px] sm:h-[590px] sm:max-h-[85vh] z-50 flex flex-col rounded-3xl bg-slate-950/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* -----------------------------------------------------------------
              BARRA DE TÍTULO ESTILO MENSAGEIRO DE PC (Item 1, 4 e 5)
              ----------------------------------------------------------------- */}
          <div
            className={`flex items-center justify-between px-4 py-3 shrink-0 select-none transition-colors duration-200 ${
              prioridadeCor === 'vermelho'
                ? 'bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950 border-b border-rose-800/80'
                : prioridadeCor === 'laranja'
                ? 'bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border-b border-amber-800/80'
                : 'bg-slate-900 border-b border-slate-800'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {currentView !== 'lista' && (
                <button
                  type="button"
                  onClick={() => {
                    setCurrentView('lista');
                    setErro(null);
                  }}
                  className="p-1 -ml-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                  title="Voltar à lista"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}

              {/* Ícone ou Foto do Cabeçalho */}
              {currentView === 'conversa' && activeConversa ? (
                activeConversa.tipo === 'grupo' ? (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-sky-600 flex items-center justify-center shrink-0 shadow-sm text-white">
                    <Users className="w-4 h-4" />
                  </div>
                ) : (
                  <UserAvatar
                    foto={activeConversa.outro_usuario?.foto}
                    nome={activeConversa.outro_usuario?.nome || 'Contato'}
                    size="w-8 h-8"
                  />
                )
              ) : (
                <div
                  className={`relative w-8 h-8 rounded-xl flex items-center justify-center shadow-md shrink-0 ${
                    prioridadeCor === 'vermelho'
                      ? 'bg-rose-600 shadow-rose-900/40 text-white'
                      : prioridadeCor === 'laranja'
                      ? 'bg-amber-600 shadow-amber-900/40 text-white'
                      : 'bg-gradient-to-br from-blue-600 to-sky-500 shadow-blue-900/40 text-white'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 text-white" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
                </div>
              )}

              {/* Título e Subtítulo em Exatamente 2 Linhas */}
              <div className="min-w-0 flex-1">
                {currentView === 'conversa' && activeConversa ? (
                  activeConversa.tipo === 'grupo' ? (
                    <>
                      {/* Item 5: Linha 1: Ícone do grupo | Nome do grupo */}
                      <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="truncate">{activeConversa.nome}</span>
                      </h3>
                      {/* Item 5: Linha 2: Ícone de grupo | Quantidade de membros */}
                      <p className="text-[10px] text-sky-400 truncate flex items-center gap-1 leading-tight mt-0.5">
                        <Users className="w-3 h-3 shrink-0" />
                        <span>{activeConversa.participantes_count || 2} membros ativos</span>
                      </p>
                    </>
                  ) : (
                    <>
                      {/* Linha 1: Nome e sobrenome */}
                      <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
                        {formatarNomeSobrenomeExibicao(activeConversa.outro_usuario?.nome || 'Contato')}
                      </h3>
                      {/* Linha 2: Departamento · Unidade */}
                      <p className="text-[10px] text-slate-400 truncate flex items-center gap-1 leading-tight mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                        <span>
                          {activeConversa.outro_usuario?.departamento
                            ? `${activeConversa.outro_usuario.departamento} · ${activeConversa.outro_usuario.unidade_negocio}`
                            : activeConversa.outro_usuario?.unidade_negocio || 'PoliHub'}
                        </span>
                      </p>
                    </>
                  )
                ) : currentView === 'nova_conversa' ? (
                  <>
                    <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
                      Nova Conversa
                    </h3>
                    <p className="text-[10px] text-slate-400 truncate leading-tight">
                      Selecione a unidade e o colaborador
                    </p>
                  </>
                ) : currentView === 'novo_grupo' ? (
                  <>
                    <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
                      Novo Grupo
                    </h3>
                    <p className="text-[10px] text-slate-400 truncate leading-tight">
                      Criação de grupo interno
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
                      Hub Messenger
                    </h3>
                    <p className="text-[10px] text-slate-400 truncate flex items-center gap-1 leading-tight">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span>{formatarNomeSobrenomeExibicao(user.nome)} ({user.unidade_negocio || 'PoliHub'})</span>
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Controles da janela: Minimizar e Fechar */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                id="btn-minimizar-chat"
                onClick={() => setIsExpanded(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                title="Minimizar janela"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                type="button"
                id="btn-fechar-chat"
                onClick={() => setIsExpanded(false)}
                className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mensagem de Erro Geral */}
          {erro && (
            <div className="mx-3 mt-2 flex items-start gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs shrink-0">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">{erro}</div>
              <button
                type="button"
                onClick={() => setErro(null)}
                className="text-rose-400 hover:text-white text-xs"
              >
                ×
              </button>
            </div>
          )}

          {/* -----------------------------------------------------------------
              CORPO DO PAINEL: TROCA DE TELAS
              ----------------------------------------------------------------- */}
          <div className="flex-1 flex flex-col min-h-0 bg-slate-950/80">
            {/* ===============================================================
                TELA 1: LISTA DE CONVERSAS
                =============================================================== */}
            {currentView === 'lista' && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Ações de Topo: Nova Conversa e Novo Grupo */}
                <div className="p-3 border-b border-slate-800/80 bg-slate-900/40 space-y-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id="btn-chat-nova-conversa"
                      onClick={() => {
                        setCurrentView('nova_conversa');
                        setBuscaUsuario('');
                        setErro(null);
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-600/20 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nova Conversa</span>
                    </button>

                    {/* Botão Novo Grupo exclusivo para Gestores */}
                    {isGestor && (
                      <button
                        type="button"
                        id="btn-chat-novo-grupo"
                        onClick={() => {
                          setCurrentView('novo_grupo');
                          setNomeNovoGrupo('');
                          setParticipantesGrupo([]);
                          setErro(null);
                        }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border border-slate-700 transition cursor-pointer"
                        title="Criar grupo com participantes autorizados"
                      >
                        <Users className="w-3.5 h-3.5 text-sky-400" />
                        <span>Novo Grupo</span>
                      </button>
                    )}
                  </div>

                  {/* Campo de Busca Rápida nas Conversas */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Pesquisar conversas..."
                      value={filtroConversas}
                      onChange={(e) => setFiltroConversas(e.target.value)}
                      className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                {/* Lista de Conversas com Rolagem */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-1">
                  {carregandoLista ? (
                    <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                      <span>Carregando conversas...</span>
                    </div>
                  ) : conversasFiltradas.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                      <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <p className="font-semibold text-slate-300">Nenhuma conversa encontrada</p>
                      <p className="text-[11px] text-slate-500 max-w-[240px]">
                        Inicie uma conversa direta com colaboradores da sua ou de outras unidades.
                      </p>
                      <button
                        type="button"
                        onClick={() => setCurrentView('nova_conversa')}
                        className="mt-2 text-blue-400 hover:text-blue-300 font-semibold text-xs flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Iniciar primeira conversa</span>
                      </button>
                    </div>
                  ) : (
                    conversasFiltradas.map((conv) => {
                      const isGrupo = conv.tipo === 'grupo';
                      const temNaoLidas = (conv.nao_lidas || 0) > 0;
                      const temNaoLidaGestorItem = temNaoLidas && conv.tem_nao_lidas_gestor;

                      if (isGrupo) {
                        return (
                          <button
                            key={conv.id}
                            type="button"
                            onClick={() => handleAbrirConversa(conv)}
                            className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition cursor-pointer overflow-hidden ${
                              temNaoLidas
                                ? temNaoLidaGestorItem
                                  ? 'bg-rose-950/20 hover:bg-rose-900/30 border border-rose-500/30'
                                  : 'bg-amber-950/20 hover:bg-amber-900/30 border border-amber-500/30'
                                : 'hover:bg-slate-900/70 border border-transparent'
                            }`}
                          >
                            {/* Ícone do grupo */}
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                              <Users className="w-4.5 h-4.5" />
                            </div>

                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                              {/* Linha 1: Ícone ou foto do grupo | Nome do grupo | Horário da última mensagem */}
                              <div className="flex items-center justify-between gap-2 w-full leading-tight">
                                <span
                                  className={`text-xs truncate ${
                                    temNaoLidas ? 'font-bold text-white' : 'font-semibold text-slate-200'
                                  }`}
                                >
                                  {conv.nome}
                                </span>
                                <span className="text-[10px] text-slate-400 shrink-0 font-mono ml-1">
                                  {formatarHorario(conv.ultima_mensagem_em)}
                                </span>
                              </div>

                              {/* Linha 2: Ícone de grupo | Quantidade de membros | Prévia da última mensagem */}
                              <div className="flex items-center justify-between gap-1.5 w-full leading-tight mt-0.5 text-[11px]">
                                <span className="text-slate-400 truncate flex items-center gap-1 min-w-0">
                                  <span className="text-sky-400 font-medium shrink-0">
                                    {conv.participantes_count || 2} membros ·
                                  </span>
                                  <span className={`truncate ${temNaoLidas ? 'font-medium text-slate-200' : 'text-slate-400'}`}>
                                    {conv.ultima_mensagem || 'Conversa criada'}
                                  </span>
                                </span>
                                {temNaoLidas && (
                                  <span
                                    className={`px-1.5 py-0.2 rounded-full font-bold text-[10px] shrink-0 ml-1 ${
                                      temNaoLidaGestorItem
                                        ? 'bg-rose-500 text-white'
                                        : 'bg-amber-500 text-white'
                                    }`}
                                  >
                                    {conv.nao_lidas}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      }

                      // Conversa Individual (Item 2)
                      return (
                        <button
                          key={conv.id}
                          type="button"
                          onClick={() => handleAbrirConversa(conv)}
                          className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition cursor-pointer overflow-hidden ${
                            temNaoLidas
                              ? temNaoLidaGestorItem
                                ? 'bg-rose-950/20 hover:bg-rose-900/30 border border-rose-500/30'
                                : 'bg-amber-950/20 hover:bg-amber-900/30 border border-amber-500/30'
                              : 'hover:bg-slate-900/70 border border-transparent'
                          }`}
                        >
                          {/* Foto real do usuário cadastrado */}
                          <div className="relative shrink-0">
                            <UserAvatar
                              foto={conv.outro_usuario?.foto}
                              nome={conv.outro_usuario?.nome || 'Contato'}
                              size="w-9 h-9"
                            />
                            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
                          </div>

                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            {/* Linha 1: Foto do usuário | Nome e sobrenome | Horário da última mensagem */}
                            <div className="flex items-center justify-between gap-2 w-full leading-tight">
                              <span
                                className={`text-xs truncate ${
                                  temNaoLidas ? 'font-bold text-white' : 'font-semibold text-slate-200'
                                }`}
                              >
                                {formatarNomeSobrenomeExibicao(conv.outro_usuario?.nome || 'Contato')}
                              </span>
                              <span className="text-[10px] text-slate-400 shrink-0 font-mono ml-1">
                                {formatarHorario(conv.ultima_mensagem_em)}
                              </span>
                            </div>

                            {/* Linha 2: Foto do usuário | Departamento | Unidade de negócio */}
                            <div className="flex items-center justify-between gap-1 w-full leading-tight mt-0.5">
                              <span className="text-[11px] text-slate-400 truncate">
                                {conv.outro_usuario?.departamento
                                  ? `${conv.outro_usuario.departamento} · ${conv.outro_usuario.unidade_negocio}`
                                  : conv.outro_usuario?.unidade_negocio || 'PoliHub'}
                              </span>
                              {temNaoLidas && (
                                <span
                                  className={`px-1.5 py-0.2 rounded-full font-bold text-[10px] shrink-0 ml-1 ${
                                    temNaoLidaGestorItem
                                      ? 'bg-rose-500 text-white'
                                      : 'bg-amber-500 text-white'
                                  }`}
                                >
                                  {conv.nao_lidas}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* ===============================================================
                TELA 2: CONVERSA ATIVA
                =============================================================== */}
            {currentView === 'conversa' && activeConversa && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Histórico de Mensagens com Rolagem e Paginação */}
                <div
                  ref={messagesContainerRef}
                  className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-950/60"
                >
                  {/* Botão de carregar mensagens anteriores */}
                  {temMaisMensagens && (
                    <div className="text-center py-1">
                      <button
                        type="button"
                        onClick={handleCarregarMensagensAnteriores}
                        disabled={carregandoAnteriores}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-400 hover:text-white transition disabled:opacity-50"
                      >
                        {carregandoAnteriores ? (
                          <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                        ) : (
                          <ChevronUp className="w-3 h-3 text-slate-400" />
                        )}
                        <span>Carregar mensagens anteriores</span>
                      </button>
                    </div>
                  )}

                  {carregandoMensagens ? (
                    <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                      <span>Carregando histórico...</span>
                    </div>
                  ) : mensagens.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-1">
                      <MessageSquare className="w-5 h-5 text-slate-600 mb-1" />
                      <p className="font-semibold text-slate-400">Nenhuma mensagem ainda</p>
                      <p className="text-[11px]">Envie uma mensagem para iniciar o diálogo.</p>
                    </div>
                  ) : (
                    mensagens.map((msg) => {
                      const isMe = msg.remetente_id === user.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          {/* Nome do remetente em grupos */}
                          {!isMe && activeConversa.tipo === 'grupo' && (
                            <span className="text-[10px] font-bold text-sky-400 mb-0.5 ml-2">
                              {msg.remetente_nome || 'Colaborador'}
                            </span>
                          )}

                          {/* Bolha da mensagem */}
                          <div
                            className={`max-w-[82%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${
                              isMe
                                ? 'bg-blue-600 text-white rounded-tr-xs'
                                : 'bg-slate-800 text-slate-100 border border-slate-700/60 rounded-tl-xs'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.conteudo}</p>
                            <div
                              className={`text-[9px] mt-1 text-right font-mono ${
                                isMe ? 'text-blue-200' : 'text-slate-400'
                              }`}
                            >
                              {formatarHorario(msg.created_at)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Campo de Entrada de Mensagem (Texto estrito) */}
                <form
                  onSubmit={handleEnviarMensagem}
                  className="p-2.5 border-t border-slate-800 bg-slate-900/90 shrink-0"
                >
                  <div className="flex items-end gap-2">
                    <textarea
                      rows={1}
                      id="input-chat-mensagem"
                      value={mensagemInput}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder="Digite uma mensagem..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition resize-none max-h-24 min-h-[38px]"
                    />
                    <button
                      type="submit"
                      id="btn-enviar-mensagem"
                      disabled={!mensagemInput.trim() || enviando}
                      className="p-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 transition active:scale-95 shadow-md shadow-blue-600/30 flex items-center justify-center shrink-0 min-h-[38px] min-w-[38px] cursor-pointer"
                      title="Enviar mensagem (Enter)"
                    >
                      {enviando ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-1 px-1 text-[10px] text-slate-500">
                    <span>Pressione Enter para enviar, Shift+Enter para nova linha</span>
                    <span>{mensagemInput.length}/4000</span>
                  </div>
                </form>
              </div>
            )}

            {/* ===============================================================
                TELA 3: NOVA CONVERSA (SELEÇÃO DE UNIDADE E USUÁRIOS)
                =============================================================== */}
            {currentView === 'nova_conversa' && (
              <div className="flex-1 flex flex-col min-h-0 p-3 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Unidade de Negócio</span>
                  </label>
                  <select
                    value={unidadeSelecionada}
                    onChange={(e) => setUnidadeSelecionada(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-blue-500 transition"
                  >
                    <option value="todas">Todas as Unidades</option>
                    {unidades.map((u) => (
                      <option key={u.id} value={u.nome}>
                        {u.nome} {u.cidade ? `— ${u.cidade}/${u.estado || ''}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    A troca de unidade serve apenas para localizar colaboradores para mensagens.
                  </p>
                </div>

                {/* Campo de Pesquisa de Usuário */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Pesquisar por nome ou código..."
                    value={buscaUsuario}
                    onChange={(e) => setBuscaUsuario(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition"
                  />
                </div>

                {/* Lista de Contatos Disponíveis */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 border border-slate-800/80 rounded-2xl bg-slate-900/40 p-1">
                  {carregandoUsuarios ? (
                    <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                      <span>Buscando colaboradores...</span>
                    </div>
                  ) : usuariosDisponiveis.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      Nenhum colaborador ativo encontrado nesta unidade com esse filtro.
                    </div>
                  ) : (
                    usuariosDisponiveis.map((contato) => (
                      <button
                        key={contato.id}
                        type="button"
                        onClick={() => handleSelecionarContato(contato)}
                        className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-800/80 text-left transition cursor-pointer overflow-hidden"
                      >
                        {/* Foto real com fallback */}
                        <UserAvatar foto={contato.foto} nome={contato.nome} size="w-9 h-9" />

                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          {/* Linha 1: Foto do usuário | Nome e sobrenome | Data do último login */}
                          <div className="flex items-center justify-between gap-2 w-full leading-tight">
                            <span className="text-xs font-semibold text-white truncate">
                              {formatarNomeSobrenomeExibicao(contato.nome)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-1">
                              {formatarUltimoAcesso(contato.ultimo_acesso)}
                            </span>
                          </div>

                          {/* Linha 2: Foto do usuário | Departamento */}
                          <div className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
                            {contato.departamento || 'Logística'}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ===============================================================
                TELA 4: NOVO GRUPO (GESTORES EXCLUSIVO)
                =============================================================== */}
            {currentView === 'novo_grupo' && isGestor && (
              <div className="flex-1 flex flex-col min-h-0 p-3 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Nome do Grupo <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={nomeNovoGrupo}
                    onChange={(e) => setNomeNovoGrupo(e.target.value)}
                    placeholder="Ex: Recebimento Goiânia, Operações..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition"
                  />
                </div>

                {/* Participantes Selecionados */}
                {participantesGrupo.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-bold text-sky-400 uppercase tracking-wider mb-1">
                      Participantes Selecionados ({participantesGrupo.length})
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-1.5 rounded-xl bg-slate-900 border border-slate-800">
                      {participantesGrupo.map((p) => (
                        <span
                          key={p.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px]"
                        >
                          <span>{p.nome.split(' ')[0]}</span>
                          <button
                            type="button"
                            onClick={() => handleToggleParticipanteGrupo(p)}
                            className="hover:text-white"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Filtro por Unidade e Busca para seleção de membros */}
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={unidadeSelecionada}
                    onChange={(e) => setUnidadeSelecionada(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[11px] text-white focus:outline-hidden focus:border-blue-500 transition"
                  >
                    <option value="todas">Todas Unidades</option>
                    {unidades.map((u) => (
                      <option key={u.id} value={u.nome}>
                        {u.nome}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    placeholder="Filtrar colaboradores..."
                    value={buscaUsuario}
                    onChange={(e) => setBuscaUsuario(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[11px] text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition"
                  />
                </div>

                {/* Lista de Usuários para Seleção */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 border border-slate-800/80 rounded-2xl bg-slate-900/40 p-1">
                  {usuariosDisponiveis.map((contato) => {
                    const isSelected = participantesGrupo.some((p) => p.id === contato.id);
                    return (
                      <button
                        key={contato.id}
                        type="button"
                        onClick={() => handleToggleParticipanteGrupo(contato)}
                        className={`w-full flex items-center justify-between gap-2.5 p-2 rounded-xl text-left transition cursor-pointer ${
                          isSelected ? 'bg-blue-600/20 border border-blue-500/30' : 'hover:bg-slate-800/60'
                        }`}
                      >
                        <UserAvatar foto={contato.foto} nome={contato.nome} size="w-8 h-8" />
                        <div className="flex-1 min-w-0 pr-1">
                          <h5 className="text-xs font-semibold text-white truncate">
                            {formatarNomeSobrenomeExibicao(contato.nome)}
                          </h5>
                          <p className="text-[10px] text-slate-400 truncate">
                            {contato.unidade_negocio} · {contato.departamento || 'Logística'}
                          </p>
                        </div>
                        <span
                          className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-blue-600 border-blue-500 text-white'
                              : 'border-slate-700 bg-slate-900'
                          }`}
                        >
                          {isSelected && '✓'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Botão de Criação do Grupo */}
                <button
                  type="button"
                  id="btn-confirmar-criar-grupo"
                  onClick={handleCriarGrupo}
                  disabled={!nomeNovoGrupo.trim() || participantesGrupo.length === 0}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition disabled:opacity-40 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Criar Grupo ({participantesGrupo.length + 1} membros)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
