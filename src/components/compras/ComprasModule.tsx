import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShoppingCart,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Sparkles,
  Flame,
  CheckCheck,
  AlertCircle,
  User,
  ShieldCheck,
  Database,
  BarChart3,
  ListFilter,
  X,
  Package,
  Eye,
  ChevronDown,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Edit2,
} from 'lucide-react';
import {
  SolicitacaoCompra,
  FiltrosCompra,
  StatusCompra,
  UrgenciaCompra,
  DemandaCompra,
  Produto,
  Usuario,
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  isUserGestor,
  canUserCreateSolicitacaoCompra,
  canUserAprovarCompra,
  canUserMarcarComprado,
} from '../../lib/permissions';
import { comprasService } from '../../services/comprasService';
import { produtosService } from '../../services/produtosService';
import { usuariosService } from '../../services/usuariosService';
import { NovaSolicitacaoModal } from './NovaSolicitacaoModal';
import { DetalhesSolicitacaoModal } from './DetalhesSolicitacaoModal';
import { ModalAprovacaoGestor } from './ModalAprovacaoGestor';
import { ModalEditarSolicitacao } from './ModalEditarSolicitacao';
import { AbaGerirAprovados } from './AbaGerirAprovados';
import { AbaComprados } from './AbaComprados';
import { AbaGraficosCompras } from './AbaGraficosCompras';
import { SqlScriptComprasModal } from './SqlScriptComprasModal';

interface ComprasModuleProps {
  onVoltarParaHome?: () => void;
}

export type TabCompras = 'solicitacoes' | 'gerir_aprovados' | 'comprados' | 'graficos';

const ITENS_POR_PAGINA = 50;

export const ComprasModule: React.FC<ComprasModuleProps> = () => {
  const { user } = useAuth();
  const isGestor = isUserGestor(user);
  const podeCriar = canUserCreateSolicitacaoCompra(user);
  const podeAprovar = canUserAprovarCompra(user);

  // 1. Organização das abas na ordem estrita:
  // 1. Solicitações
  // 2. Gerir aprovados (somente Gestor)
  // 3. Comprados
  // 4. Gráficos e Indicadores
  const [tabAtiva, setTabAtiva] = useState<TabCompras>('solicitacoes');

  // Proteção contra acesso direto não autorizado
  useEffect(() => {
    if (!isGestor && tabAtiva === 'gerir_aprovados') {
      setTabAtiva('solicitacoes');
    }
  }, [isGestor, tabAtiva]);

  // Estado de Dados da Aba Solicitações
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoCompra[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Paginação no Supabase (50 por página)
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);

  // Listas auxiliares para os filtros
  const [produtosDisponiveis, setProdutosDisponiveis] = useState<Produto[]>([]);
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState<Usuario[]>([]);
  const [fabricantesDisponiveis, setFabricantesDisponiveis] = useState<string[]>([]);

  // Filtros aplicados na Aba Solicitações (status apenas Solicitado e Aprovado)
  const [filtroFabricante, setFiltroFabricante] = useState<string>('Todos');
  const [filtroProdutoId, setFiltroProdutoId] = useState<string>('Todos');
  const [filtroTermoBusca, setFiltroTermoBusca] = useState<string>('');
  const [filtroDataInicio, setFiltroDataInicio] = useState<string>('');
  const [filtroDataFim, setFiltroDataFim] = useState<string>('');
  const [filtroSolicitanteId, setFiltroSolicitanteId] = useState<string>('Todos');
  const [filtroStatus, setFiltroStatus] = useState<StatusCompra | 'Todos'>('Todos');
  const [filtroUrgencia, setFiltroUrgencia] = useState<UrgenciaCompra | 'Todos'>('Todos');
  const [filtroDemanda, setFiltroDemanda] = useState<DemandaCompra | 'Todos'>('Todos');
  const [filtroGestorId, setFiltroGestorId] = useState<string>('Todos');

  // Modais
  const [modalNovaAberta, setModalNovaAberta] = useState(false);
  const [solicitacaoParaDetalhes, setSolicitacaoParaDetalhes] = useState<SolicitacaoCompra | null>(null);
  const [solicitacaoParaAprovacao, setSolicitacaoParaAprovacao] = useState<SolicitacaoCompra | null>(null);
  const [solicitacaoParaEditar, setSolicitacaoParaEditar] = useState<SolicitacaoCompra | null>(null);
  const [modalSqlAberto, setModalSqlAberto] = useState(false);
  const [mostrarFiltrosAvancados, setMostrarFiltrosAvancados] = useState(false);

  // Contador de pendentes para badge
  const [contadorSolicitados, setContadorSolicitados] = useState<number>(0);

  const atualizarContadorSolicitados = useCallback(async () => {
    try {
      const total = await comprasService.obterTotalSolicitados(user?.unidade_negocio);
      setContadorSolicitados(total);
    } catch {
      // Silencioso em caso de erro transitório
    }
  }, [user?.unidade_negocio]);

  // Carregar dados auxiliares de produtos e usuários
  useEffect(() => {
    const carregarAuxiliares = async () => {
      try {
        const [prods, usrs] = await Promise.all([
          produtosService.listarTodos(),
          usuariosService.listarTodos(),
        ]);
        setProdutosDisponiveis(prods);
        setUsuariosDisponiveis(usrs);

        const fabs = Array.from(
          new Set(
            prods
              .map((p) => p.fabricante?.trim())
              .filter((f): f is string => Boolean(f && f.length > 0))
          )
        ).sort();
        setFabricantesDisponiveis(fabs);
      } catch (err) {
        console.warn('Erro ao carregar dados auxiliares de compras:', err);
      }
    };

    carregarAuxiliares();
    atualizarContadorSolicitados();
  }, [atualizarContadorSolicitados]);

  // Escutar eventos de atualização de badges do sistema
  useEffect(() => {
    const handleRefresh = () => {
      atualizarContadorSolicitados();
    };
    window.addEventListener('polihub_badges_refresh', handleRefresh);
    return () => {
      window.removeEventListener('polihub_badges_refresh', handleRefresh);
    };
  }, [atualizarContadorSolicitados]);

  // Carregar solicitações com paginação no Supabase (50 por página)
  const carregarSolicitacoes = useCallback(
    async (paginaAlvo = paginaAtual) => {
      if (tabAtiva !== 'solicitacoes') return;
      setCarregando(true);
      setErro(null);
      try {
        const filtros: FiltrosCompra = {
          unidade_negocio: user?.unidade_negocio,
          fabricante: filtroFabricante !== 'Todos' ? filtroFabricante : undefined,
          produtoId: filtroProdutoId !== 'Todos' ? filtroProdutoId : undefined,
          termoBusca: filtroTermoBusca.trim() || undefined,
          dataInicio: filtroDataInicio || undefined,
          dataFim: filtroDataFim || undefined,
          solicitanteId: filtroSolicitanteId !== 'Todos' ? filtroSolicitanteId : undefined,
          status: filtroStatus !== 'Todos' ? filtroStatus : undefined,
          urgencia: filtroUrgencia !== 'Todos' ? filtroUrgencia : undefined,
          demanda: filtroDemanda !== 'Todos' ? filtroDemanda : undefined,
          gestorAprovacaoId: filtroGestorId !== 'Todos' ? filtroGestorId : undefined,
        };

        const resultado = await comprasService.listarSolicitacoesPaginadas(
          filtros,
          paginaAlvo,
          ITENS_POR_PAGINA
        );

        setSolicitacoes(resultado.itens);
        setTotalRegistros(resultado.totalRegistros);
        setTotalPaginas(resultado.totalPaginas);
        setPaginaAtual(resultado.paginaAtual);
        atualizarContadorSolicitados();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao listar solicitações de compras.';
        setErro(msg);
      } finally {
        setCarregando(false);
      }
    },
    [
      tabAtiva,
      paginaAtual,
      user?.unidade_negocio,
      filtroFabricante,
      filtroProdutoId,
      filtroTermoBusca,
      filtroDataInicio,
      filtroDataFim,
      filtroSolicitanteId,
      filtroStatus,
      filtroUrgencia,
      filtroDemanda,
      filtroGestorId,
      atualizarContadorSolicitados,
    ]
  );

  // Ao alterar filtros ou busca, reiniciar paginação para a página 1
  useEffect(() => {
    setPaginaAtual(1);
  }, [
    filtroFabricante,
    filtroProdutoId,
    filtroTermoBusca,
    filtroDataInicio,
    filtroDataFim,
    filtroSolicitanteId,
    filtroStatus,
    filtroUrgencia,
    filtroDemanda,
    filtroGestorId,
  ]);

  // Carregar dados sempre que a página ou filtros mudarem (quando na aba Solicitações)
  useEffect(() => {
    if (tabAtiva === 'solicitacoes') {
      carregarSolicitacoes(paginaAtual);
    }
  }, [tabAtiva, paginaAtual, carregarSolicitacoes]);

  // Mudança de página
  const handleMudarPagina = (novaPagina: number) => {
    if (novaPagina < 1 || novaPagina > totalPaginas || carregando) return;
    setPaginaAtual(novaPagina);
  };

  const handleLimparFiltros = () => {
    setFiltroFabricante('Todos');
    setFiltroProdutoId('Todos');
    setFiltroTermoBusca('');
    setFiltroDataInicio('');
    setFiltroDataFim('');
    setFiltroSolicitanteId('Todos');
    setFiltroStatus('Todos');
    setFiltroUrgencia('Todos');
    setFiltroDemanda('Todos');
    setFiltroGestorId('Todos');
    setPaginaAtual(1);
  };

  // 2.3. Aprovação pelo Gestor: Abre o modal de aprovação sem alterar status silenciosamente
  const handleAbrirAprovacao = (s: SolicitacaoCompra, e: React.MouseEvent) => {
    e.stopPropagation();
    setSolicitacaoParaAprovacao(s);
  };

  // 3. Edição das próprias solicitações
  const handleAbrirEdicao = (s: SolicitacaoCompra, e: React.MouseEvent) => {
    e.stopPropagation();
    setSolicitacaoParaEditar(s);
  };

  const formatarDataHora = (dataStr?: string | null) => {
    if (!dataStr) return '-';
    try {
      const d = new Date(dataStr);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dataStr;
    }
  };

  // Abas disponíveis com regras de acesso
  const abasDisponiveis = useMemo(() => {
    const abas: Array<{ id: TabCompras; label: string; icon: React.FC<{ className?: string }>; badge?: number }> = [
      { id: 'solicitacoes', label: 'Solicitações', icon: ListFilter, badge: contadorSolicitados },
    ];

    if (isGestor) {
      abas.push({ id: 'gerir_aprovados', label: 'Gerir aprovados', icon: CheckCheck });
    }

    abas.push(
      { id: 'comprados', label: 'Comprados', icon: ShoppingBag },
      { id: 'graficos', label: 'Gráficos e Indicadores', icon: BarChart3 }
    );

    return abas;
  }, [isGestor, contadorSolicitados]);

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* 1. CABEÇALHO DO MÓDULO — Padrão visual refinado PoliHub */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Módulo de Compras
              </h1>
              {contadorSolicitados > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                  {contadorSolicitados} {contadorSolicitados === 1 ? 'pendente' : 'pendentes'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Central de aquisições: registro de necessidades, aprovação por gestores e rastreamento de compras.
            </p>
          </div>
        </div>

        {/* Ações do Topo */}
        <div className="flex items-center gap-2">
          {podeCriar && (
            <button
              type="button"
              id="btn-nova-solicitacao-compra"
              onClick={() => setModalNovaAberta(true)}
              className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Solicitação</span>
            </button>
          )}



          <button
            type="button"
            onClick={() => {
              if (tabAtiva === 'solicitacoes') {
                carregarSolicitacoes(paginaAtual);
              } else {
                atualizarContadorSolicitados();
              }
            }}
            disabled={carregando}
            className="p-2.5 rounded-2xl border border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white transition"
            title="Atualizar listagem"
          >
            <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. NAVEGAÇÃO DE ABAS — Ordem estrita: Solicitações, Gerir aprovados, Comprados, Gráficos e Indicadores */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          {abasDisponiveis.map((aba) => {
            const Icon = aba.icon;
            const ativa = tabAtiva === aba.id;
            return (
              <button
                key={aba.id}
                type="button"
                onClick={() => setTabAtiva(aba.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition ${
                  ativa
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{aba.label}</span>
                {typeof aba.badge === 'number' && aba.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      ativa ? 'bg-white/20 text-white' : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {aba.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Resumo Rápido visível na aba Solicitações */}
        {tabAtiva === 'solicitacoes' && (
          <div className="hidden md:flex items-center gap-3 text-xs text-slate-400 pr-2">
            <span>
              Total exibido: <strong className="text-white">{solicitacoes.length}</strong>
            </span>
            <span>&bull;</span>
            <span>
              Total geral: <strong className="text-white">{totalRegistros}</strong>
            </span>
          </div>
        )}
      </div>

      {/* 3. CONTEÚDO DAS ABAS */}
      {tabAtiva === 'graficos' ? (
        <AbaGraficosCompras />
      ) : tabAtiva === 'comprados' ? (
        <AbaComprados />
      ) : tabAtiva === 'gerir_aprovados' && isGestor ? (
        <AbaGerirAprovados />
      ) : (
        /* ABA 1: SOLICITAÇÕES */
        <div className="space-y-4">
          {/* BARRA DE FILTROS */}
          <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Campo de Busca Livre */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={filtroTermoBusca}
                  onChange={(e) => setFiltroTermoBusca(e.target.value)}
                  placeholder="Buscar por produto, solicitante, código ou observação..."
                  className="w-full pl-9 pr-4 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                {filtroTermoBusca && (
                  <button
                    type="button"
                    onClick={() => setFiltroTermoBusca('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filtro de Status na Aba Solicitações: apenas Solicitado e Aprovado */}
              <div className="flex items-center gap-1.5 text-xs">
                {(['Todos', 'Solicitado', 'Aprovado'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setFiltroStatus(st)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition text-xs ${
                      filtroStatus === st
                        ? st === 'Solicitado'
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : st === 'Aprovado'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-white text-slate-950'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {st === 'Todos' ? 'Todos (Pendentes & Aprovados)' : st}
                  </button>
                ))}
              </div>

              {/* Botão de Toggle Filtros Avançados */}
              <button
                type="button"
                onClick={() => setMostrarFiltrosAvancados(!mostrarFiltrosAvancados)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                  mostrarFiltrosAvancados ||
                  filtroFabricante !== 'Todos' ||
                  filtroUrgencia !== 'Todos' ||
                  filtroDemanda !== 'Todos' ||
                  filtroDataInicio ||
                  filtroDataFim
                    ? 'border-blue-500/40 text-blue-300 bg-blue-500/10'
                    : 'border-slate-800 text-slate-400 bg-slate-950 hover:text-white'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Mais Filtros</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    mostrarFiltrosAvancados ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>

            {/* Painel Expansível de Filtros Avançados */}
            {mostrarFiltrosAvancados && (
              <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {/* 1. Fabricante */}
                <div className="space-y-1">
                  <label className="text-slate-400 block font-medium">Fabricante:</label>
                  <select
                    value={filtroFabricante}
                    onChange={(e) => setFiltroFabricante(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="Todos">Todos os Fabricantes</option>
                    {fabricantesDisponiveis.map((fab) => (
                      <option key={fab} value={fab}>
                        {fab}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Urgência */}
                <div className="space-y-1">
                  <label className="text-slate-400 block font-medium">Nível de Urgência:</label>
                  <select
                    value={filtroUrgencia}
                    onChange={(e) => setFiltroUrgencia(e.target.value as UrgenciaCompra | 'Todos')}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="Todos">Todas as Urgências</option>
                    <option value="Média">Média</option>
                    <option value="Rápida">Rápida</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>

                {/* 3. Demanda */}
                <div className="space-y-1">
                  <label className="text-slate-400 block font-medium">Demanda / Motivo:</label>
                  <select
                    value={filtroDemanda}
                    onChange={(e) => setFiltroDemanda(e.target.value as DemandaCompra | 'Todos')}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="Todos">Todas as Demandas</option>
                    <option value="Estoque">Estoque (Reposição)</option>
                    <option value="Sob Encomenda">Sob Encomenda (Cliente)</option>
                    <option value="Consumos">Consumos (Uso Interno)</option>
                  </select>
                </div>

                {/* 4. Solicitante */}
                <div className="space-y-1">
                  <label className="text-slate-400 block font-medium">Usuário Solicitante:</label>
                  <select
                    value={filtroSolicitanteId}
                    onChange={(e) => setFiltroSolicitanteId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="Todos">Todos os Usuários</option>
                    {usuariosDisponiveis.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome} ({u.departamento})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5. Data Início */}
                <div className="space-y-1">
                  <label className="text-slate-400 block font-medium">Data De:</label>
                  <input
                    type="date"
                    value={filtroDataInicio}
                    onChange={(e) => setFiltroDataInicio(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* 6. Data Fim */}
                <div className="space-y-1">
                  <label className="text-slate-400 block font-medium">Data Até:</label>
                  <input
                    type="date"
                    value={filtroDataFim}
                    onChange={(e) => setFiltroDataFim(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* 7. Gestor Aprovador */}
                <div className="space-y-1">
                  <label className="text-slate-400 block font-medium">Gestor Aprovador:</label>
                  <select
                    value={filtroGestorId}
                    onChange={(e) => setFiltroGestorId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="Todos">Todos</option>
                    <option value="pendente">Aguardando Aprovação (Pendente)</option>
                    {usuariosDisponiveis
                      .filter((u) => isUserGestor(u))
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nome}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Botões de Ação dos Filtros */}
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => carregarSolicitacoes(1)}
                    className="flex-1 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition"
                  >
                    Filtrar
                  </button>
                  <button
                    type="button"
                    onClick={handleLimparFiltros}
                    className="px-3 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 text-xs transition"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* MENSAGEM DE ERRO */}
          {erro && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* LISTAGEM PAGINADA (50 POR PÁGINA) */}
          {carregando ? (
            <div className="p-12 text-center rounded-3xl bg-slate-900/60 border border-slate-800 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <span className="text-xs text-slate-400">Carregando solicitações de compras...</span>
            </div>
          ) : solicitacoes.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-500 mx-auto flex items-center justify-center">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">Nenhuma solicitação encontrada</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Não há solicitações com status Solicitado ou Aprovado para os critérios selecionados.
              </p>
              {podeCriar && (
                <button
                  type="button"
                  onClick={() => setModalNovaAberta(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Cadastrar Solicitação</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* TABELA DESKTOP */}
              <div className="hidden lg:block rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3.5 px-4">Data</th>
                        <th className="py-3.5 px-4">Produto</th>
                        <th className="py-3.5 px-4 text-center">Qtd</th>
                        <th className="py-3.5 px-4">Demanda</th>
                        <th className="py-3.5 px-4">Solicitante</th>
                        <th className="py-3.5 px-4 text-center">Urgência</th>
                        <th className="py-3.5 px-4 text-center">Status</th>
                        <th className="py-3.5 px-4">Gestor Aprovação</th>
                        <th className="py-3.5 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {solicitacoes.map((s) => {
                        const ehAutor = s.id_solicitante === user?.id;
                        const podeEditarEsta = ehAutor && s.status === 'Solicitado';

                        return (
                          <tr
                            key={s.id}
                            onClick={() => setSolicitacaoParaDetalhes(s)}
                            className="hover:bg-slate-800/40 cursor-pointer transition group"
                          >
                            {/* 1. Data */}
                            <td className="py-3.5 px-4 whitespace-nowrap text-slate-300 font-mono text-[11px]">
                              {formatarDataHora(s.data_insercao)}
                            </td>

                            {/* 2. Produto */}
                            <td className="py-3.5 px-4 max-w-xs">
                              <div className="font-bold text-white group-hover:text-emerald-400 transition truncate">
                                {s.produto_nome}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate">
                                {s.produto_fabricante || 'Fabricante não informado'}
                                {s.produto_codigo_barras ? ` • ${s.produto_codigo_barras}` : ''}
                              </div>
                            </td>

                            {/* 3. Quantidade */}
                            <td className="py-3.5 px-4 text-center">
                              <span className="font-mono font-black text-sm text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                                {s.quantidade_aprovada && s.quantidade_aprovada !== s.quantidade ? (
                                  <span title={`Original: ${s.quantidade}`}>
                                    {s.quantidade_aprovada}{' '}
                                    <span className="text-[10px] text-slate-400 line-through">({s.quantidade})</span>
                                  </span>
                                ) : (
                                  s.quantidade
                                )}
                              </span>
                            </td>

                            {/* 4. Demanda */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${
                                  s.demanda === 'Estoque'
                                    ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                                    : s.demanda === 'Sob Encomenda' || s.demanda === 'Necessidade'
                                    ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                    : 'bg-teal-500/15 text-teal-300 border-teal-500/30'
                                }`}
                              >
                                {s.demanda}
                              </span>
                            </td>

                            {/* 5. Solicitante — ÍCONE PADRÃO DE USUÁRIO (sem iniciais) */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center">
                                  <User className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <span className="font-semibold text-white block text-xs truncate max-w-[120px]">
                                    {s.solicitante_nome}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block truncate">
                                    {s.solicitante_departamento}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* 6. Indicador de Urgência */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              {s.urgencia === 'Urgente' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                                  <Flame className="w-3 h-3 text-rose-400" />
                                  <span>Urgente</span>
                                </span>
                              ) : s.urgencia === 'Rápida' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  <Sparkles className="w-3 h-3 text-amber-400" />
                                  <span>Rápida</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                                  <Clock className="w-3 h-3 text-slate-500" />
                                  <span>Média</span>
                                </span>
                              )}
                            </td>

                            {/* 7. Status */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              {s.status === 'Solicitado' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  <Clock className="w-3 h-3 text-amber-400" />
                                  <span>Solicitado</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                  <ShieldCheck className="w-3 h-3 text-blue-400" />
                                  <span>Aprovado</span>
                                </span>
                              )}
                            </td>

                            {/* 8. Gestor de Aprovação — Ícone padrão com nome */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {s.usuario_aprovacao_nome ? (
                                <div className="flex items-center gap-1.5 text-xs text-blue-300">
                                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                  <span className="font-medium truncate max-w-[120px]">
                                    {s.usuario_aprovacao_nome}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-amber-400/80 italic font-mono">
                                  Aguardando...
                                </span>
                              )}
                            </td>

                            {/* 9. Ações */}
                            <td
                              className="py-3.5 px-4 text-right whitespace-nowrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-end gap-1.5">
                                {/* 3. Edição das próprias solicitações */}
                                {podeEditarEsta && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleAbrirEdicao(s, e)}
                                    className="px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-[11px] transition flex items-center gap-1"
                                    title="Editar minha solicitação"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    <span>Editar</span>
                                  </button>
                                )}

                                {/* 2.3. Aprovar pelo Gestor (Abre Modal de Aprovação) */}
                                {podeAprovar && s.status === 'Solicitado' && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleAbrirAprovacao(s, e)}
                                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] transition shadow-sm flex items-center gap-1"
                                    title="Avaliar e aprovar solicitação"
                                  >
                                    <ShieldCheck className="w-3 h-3" />
                                    <span>Aprovar</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => setSolicitacaoParaDetalhes(s)}
                                  className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                  title="Ver detalhes"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CARDS RESPONSIVOS PARA MOBILE / TABLET */}
              <div className="lg:hidden space-y-3">
                {solicitacoes.map((s) => {
                  const ehAutor = s.id_solicitante === user?.id;
                  const podeEditarEsta = ehAutor && s.status === 'Solicitado';

                  return (
                    <div
                      key={s.id}
                      onClick={() => setSolicitacaoParaDetalhes(s)}
                      className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-md space-y-3 active:scale-[0.99] transition cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {formatarDataHora(s.data_insercao)} &bull; {s.demanda}
                          </span>
                          <h4 className="text-sm font-bold text-white mt-0.5">{s.produto_nome}</h4>
                          <span className="text-xs text-slate-400">
                            {s.produto_fabricante || 'Fabricante não informado'}
                          </span>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xl font-black text-emerald-400 font-mono block">
                            {s.quantidade_aprovada ?? s.quantidade}
                          </span>
                          <span className="text-[10px] text-slate-500 block">unidades</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
                        {/* Urgência */}
                        <div>
                          {s.urgencia === 'Urgente' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              <Flame className="w-3 h-3 text-rose-400" /> Urgente
                            </span>
                          ) : s.urgencia === 'Rápida' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              <Sparkles className="w-3 h-3 text-amber-400" /> Rápida
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                              <Clock className="w-3 h-3" /> Média
                            </span>
                          )}
                        </div>

                        {/* Status */}
                        <div>
                          {s.status === 'Solicitado' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              Solicitado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                              Aprovado
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Rodapé do Card Mobile com Solicitante */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px] truncate max-w-[170px]">
                          <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">
                            Por: <strong className="text-slate-300">{s.solicitante_nome}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {podeEditarEsta && (
                            <button
                              type="button"
                              onClick={(e) => handleAbrirEdicao(s, e)}
                              className="px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 font-bold text-[11px]"
                            >
                              Editar
                            </button>
                          )}

                          {podeAprovar && s.status === 'Solicitado' && (
                            <button
                              type="button"
                              onClick={(e) => handleAbrirAprovacao(s, e)}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-[11px]"
                            >
                              Aprovar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 2.1. PAGINAÇÃO EXECUTADA DIRETAMENTE NO SUPABASE (50 POR PÁGINA) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs">
                <div className="text-slate-400">
                  Mostrando{' '}
                  <strong className="text-white">
                    {totalRegistros === 0 ? 0 : (paginaAtual - 1) * ITENS_POR_PAGINA + 1}
                  </strong>{' '}
                  a{' '}
                  <strong className="text-white">
                    {Math.min(paginaAtual * ITENS_POR_PAGINA, totalRegistros)}
                  </strong>{' '}
                  de <strong className="text-white">{totalRegistros}</strong> solicitações
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleMudarPagina(paginaAtual - 1)}
                    disabled={paginaAtual <= 1 || carregando}
                    className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 font-semibold"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Anterior</span>
                  </button>

                  <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono font-bold">
                    Página {paginaAtual} de {Math.max(1, totalPaginas)}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleMudarPagina(paginaAtual + 1)}
                    disabled={paginaAtual >= totalPaginas || carregando}
                    className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 font-semibold"
                  >
                    <span>Próxima</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 4. MODAIS DO MÓDULO */}
      {modalNovaAberta && (
        <NovaSolicitacaoModal
          isOpen={modalNovaAberta}
          onClose={() => setModalNovaAberta(false)}
          onSucesso={() => {
            carregarSolicitacoes(1);
            atualizarContadorSolicitados();
          }}
        />
      )}

      {solicitacaoParaDetalhes && (
        <DetalhesSolicitacaoModal
          isOpen={Boolean(solicitacaoParaDetalhes)}
          solicitacao={solicitacaoParaDetalhes}
          onClose={() => setSolicitacaoParaDetalhes(null)}
          onAtualizado={() => {
            carregarSolicitacoes(paginaAtual);
            atualizarContadorSolicitados();
          }}
        />
      )}

      {solicitacaoParaAprovacao && (
        <ModalAprovacaoGestor
          isOpen={Boolean(solicitacaoParaAprovacao)}
          solicitacao={solicitacaoParaAprovacao}
          onClose={() => setSolicitacaoParaAprovacao(null)}
          onDecisaoConfirmada={() => {
            carregarSolicitacoes(paginaAtual);
            atualizarContadorSolicitados();
          }}
        />
      )}

      {solicitacaoParaEditar && (
        <ModalEditarSolicitacao
          isOpen={Boolean(solicitacaoParaEditar)}
          solicitacao={solicitacaoParaEditar}
          onClose={() => setSolicitacaoParaEditar(null)}
          onSalvo={() => {
            carregarSolicitacoes(paginaAtual);
            atualizarContadorSolicitados();
          }}
        />
      )}

      {modalSqlAberto && (
        <SqlScriptComprasModal
          isOpen={modalSqlAberto}
          onClose={() => setModalSqlAberto(false)}
        />
      )}
    </div>
  );
};
