import React, { useEffect, useState } from 'react';
import {
  CalendarClock,
  MapPin,
  Package,
  PlusCircle,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  Sparkles,
  ShieldCheck,
  Building2,
  RefreshCw,
  PackageCheck,
  CheckSquare,
  ClipboardCheck,
  FileSpreadsheet,
  Truck,
  Boxes,
  SearchCode,
  ShoppingCart,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ModuleType } from '../../types';
import {
  isUserGestor,
  canUserAccessRecebimento,
  canUserAccessAlocacao,
  canUserAccessInventario,
  canUserAccessCompras,
} from '../../lib/permissions';
import { agendamentosService } from '../../services/agendamentosService';
import { enderecosService } from '../../services/enderecosService';
import { tarefasService } from '../../services/tarefasService';
import { comprasService } from '../../services/comprasService';
import { getLocalEnderecos, getLocalInventario } from '../../services/mockStorage';

interface HomeScreenProps {
  onNavigate: (module: ModuleType) => void;
  onOpenNewAgendamento: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate, onOpenNewAgendamento }) => {
  const { user, isConfigured } = useAuth();
  const isGestor = isUserGestor(user);
  const canAccessRecebimento = canUserAccessRecebimento(user);
  const canAccessAlocacao = canUserAccessAlocacao(user);
  const canAccessInventario = canUserAccessInventario(user);
  const canAccessCompras = canUserAccessCompras(user);

  const [metrics, setMetrics] = useState({
    totalHoje: 0,
    pendentesHoje: 0,
    recebidosHoje: 0,
    emTransito: 0,
  });
  const [comprasCount, setComprasCount] = useState(0);
  const [warehouseMetrics, setWarehouseMetrics] = useState({
    totalEnderecos: 0,
    ocupados: 0,
    taxaOcupacao: 0,
  });
  const [inventoryMetrics, setInventoryMetrics] = useState({
    totalItens: 0,
    criticos: 0,
  });
  const [tarefasMetrics, setTarefasMetrics] = useState({
    total: 0,
    prazoEstourado: 0,
    finalizarHoje: 0,
    concluidas: 0,
  });
  const [loading, setLoading] = useState(true);

  // Dynamic greeting based on current local hour
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Lightweight metric query for Agendamentos
      const agMetrics = await agendamentosService.getMetrics();
      setMetrics(agMetrics);

      // 2. Endereçamento summary sincronizado com public.enderecos no Supabase
      const endMetricas = await enderecosService.obterMetricas();
      const taxa = endMetricas.total > 0 ? Math.round((endMetricas.ativos / endMetricas.total) * 100) : 0;
      setWarehouseMetrics({
        totalEnderecos: endMetricas.total,
        ocupados: endMetricas.ativos,
        taxaOcupacao: taxa,
      });

      // 3. Inventário summary
      const inv = getLocalInventario();
      const criticos = inv.filter((i) => i.status === 'Crítico').length;
      setInventoryMetrics({
        totalItens: inv.length,
        criticos,
      });

      // 4. Tarefas summary
      if (user) {
        const tMetricas = await tarefasService.obterMetricas(user);
        setTarefasMetrics(tMetricas);
      }

      // 5. Compras summary
      if (canAccessCompras) {
        const cTotal = await comprasService.obterTotalSolicitados(user?.unidade_negocio);
        setComprasCount(cTotal);
      }
    } catch (e) {
      console.warn('Erro ao carregar métricas:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 md:pb-8">
      {/* 1. HERO USER GREETING & OPERATIONAL IDENTITY */}
      <section
        id="section-home-greeting"
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-blue-950/40 border border-slate-800/80 p-5 sm:p-7 shadow-xl"
      >
        <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20 flex items-center gap-1.5">
                <Building2 className="w-3 h-3 text-blue-400" />
                <span>Polifiltro &bull; {user?.unidade_negocio || 'Goiânia'}</span>
              </span>
              <span className="text-xs text-slate-300 font-medium">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-sky-300">{user?.nome?.split(' ')[0] || 'Operador'}</span>!
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Pronto para as movimentações de hoje. Acompanhe os agendamentos de recebimento, posições de estoque e fluxo do armazém.
            </p>
          </div>

          {/* User badge card */}
          <div className="flex items-center gap-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shrink-0 shadow-inner">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 flex items-center justify-center text-white font-extrabold text-base shadow-md shadow-blue-900/40">
              {user?.codigo ? user.codigo.slice(0, 2) : 'OP'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white">{user?.nome}</span>
                <span className="text-xs font-mono font-bold text-sky-400 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/40">
                  {user?.codigo || 'OP-1042'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span>{user?.departamento || 'Logística Operacional'}</span>
                <span className="text-sky-400 font-medium">&bull; {user?.unidade_negocio || 'Goiânia'}</span>
              </div>
              <div className="text-[11px] text-blue-400 font-medium">
                {user?.funcao || 'Operador Especialista'} &bull; {user?.nivel || 'Operador'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. QUICK ACTION TRIGGER */}
      <section className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            {isGestor ? <PlusCircle className="w-5 h-5" /> : <CalendarClock className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              {isGestor ? 'Novo Recebimento / Carga' : 'Agendamentos de Recebimento'}
            </h3>
            <p className="text-xs text-slate-400">
              {isGestor
                ? 'Registre uma nova entrada de mercadoria no armazém'
                : 'Consulte os agendamentos, cargas em trânsito e previsões'}
            </p>
          </div>
        </div>

        {isGestor ? (
          <button
            type="button"
            id="btn-home-quick-agendamento"
            onClick={onOpenNewAgendamento}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 shadow-md shadow-blue-600/30 transition active:scale-95 min-h-[44px]"
          >
            <span>Cadastrar Agendamento</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            id="btn-home-view-agendamentos"
            onClick={() => onNavigate('agendamentos')}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-800 text-slate-200 font-semibold text-xs sm:text-sm px-4 py-2.5 border border-slate-700 transition active:scale-95 min-h-[44px]"
          >
            <span>Ver Agendamentos</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </section>

      {/* 3. OS 3 MÓDULOS PRINCIPAIS — CARDS DE ACESSO RÁPIDO */}
      <section id="section-home-modules">
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Módulos do Sistema</h2>
            <p className="text-xs text-slate-400">Acesso direto às operações do Polifiltro</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card: COMPRAS (Visível para Comercial e Gestor) */}
          {canAccessCompras && (
            <div
              id="card-module-compras"
              onClick={() => onNavigate('compras')}
              className="group cursor-pointer rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 p-5 shadow-lg transition-all duration-200 hover:-translate-y-1 relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
                  Suprimentos
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
                </span>
              </div>

              <div className="mt-4">
                <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition">
                  Compras
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  Solicitações de compra, validação de duplicidade, aprovação por gestores e acompanhamento.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">Pendentes de Aprovação:</span>
                <span className="font-bold text-emerald-300 font-mono bg-slate-800 px-2 py-0.5 rounded">
                  {comprasCount} {comprasCount === 1 ? 'solicitação' : 'solicitações'}
                </span>
              </div>
            </div>
          )}

          {/* Card 1: AGENDAMENTOS */}
          <div
            id="card-module-agendamentos"
            onClick={() => onNavigate('agendamentos')}
            className="group cursor-pointer rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 p-5 shadow-lg transition-all duration-200 hover:-translate-y-1 relative overflow-hidden"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-110 transition">
                <CalendarClock className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20 flex items-center gap-1">
                Entrada
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
              </span>
            </div>

            <div className="mt-4">
              <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition">
                Agendamentos
              </h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                Gestão de recebimentos, notas fiscais, conferência de volumes e status de entrega.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">Hoje:</span>
              <span className="font-bold text-white font-mono bg-slate-800 px-2 py-0.5 rounded">
                {metrics.totalHoje} registros
              </span>
            </div>
          </div>

          {/* Card: TAREFAS */}
          <div
            id="card-module-tarefas"
            onClick={() => onNavigate('tarefas')}
            className="group cursor-pointer rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 p-5 shadow-lg transition-all duration-200 hover:-translate-y-1 relative overflow-hidden"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-110 transition">
                <CheckSquare className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20 flex items-center gap-1">
                {tarefasMetrics.prazoEstourado > 0 ? (
                  <span className="text-rose-400 font-bold">{tarefasMetrics.prazoEstourado} atrasada(s)</span>
                ) : (
                  'Atribuições'
                )}
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
              </span>
            </div>

            <div className="mt-4">
              <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition">
                Tarefas
              </h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                Acompanhamento com prazos dinâmicos, atribuição de equipe e controle de pendências.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">Prazos:</span>
              <span className="font-bold text-blue-300 font-mono bg-slate-800 px-2 py-0.5 rounded">
                {tarefasMetrics.total} ativas
              </span>
            </div>
          </div>

          {/* Card: RECEBIMENTO & CONFERÊNCIA CEGA (Visível para Logística e Gestor) */}
          {canAccessRecebimento && (
            <div
              id="card-module-recebimento"
              onClick={() => onNavigate('recebimento')}
              className="group cursor-pointer rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 p-5 shadow-lg transition-all duration-200 hover:-translate-y-1 relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition">
                  <ClipboardCheck className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
                  Conferência
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
                </span>
              </div>

              <div className="mt-4">
                <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition">
                  Recebimento
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  Conferência cega das NFs recebidas, validação de divergências e liberação para alocação.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">Contagem:</span>
                <span className="font-bold text-emerald-300 font-mono bg-slate-800 px-2 py-0.5 rounded">
                  Cega sem Qtd
                </span>
              </div>
            </div>
          )}

          {/* Card 2: ALOCAÇÃO (Visível para Logística & Recebimento, Expedição & Transporte e Gestor) */}
          {canAccessAlocacao && (
            <div
              id="card-module-alocacao"
              onClick={() => onNavigate('alocacao')}
              className="group cursor-pointer rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 p-5 shadow-lg transition-all duration-200 hover:-translate-y-1 relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition">
                  <PackageCheck className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
                  Novo
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
                </span>
              </div>

              <div className="mt-4">
                <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition">
                  Alocação
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  Armazenagem física de produtos recebidos por nota fiscal em suas posições oficiais.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">Operação:</span>
                <span className="font-bold text-emerald-300 font-mono bg-slate-800 px-2 py-0.5 rounded">
                  Alocar Produtos
                </span>
              </div>
            </div>
          )}

          {/* Card: PEDIDOS (Expedição - Exclusivo para Desktop/PC: hidden lg:block) */}
          <div
            id="card-module-pedidos"
            onClick={() => onNavigate('pedidos')}
            className="hidden lg:block group cursor-pointer rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 p-5 shadow-lg transition-all duration-200 hover:-translate-y-1 relative overflow-hidden"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-110 transition">
                <Boxes className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20 flex items-center gap-1">
                Expedição & WMS
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
              </span>
            </div>

            <div className="mt-4">
              <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition">
                Pedidos
              </h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                Separação, conferência cega/assistida, produtos por pedido, coletas e indicadores de produtividade.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">Fluxo Operacional:</span>
              <span className="font-bold text-blue-300 font-mono bg-slate-800 px-2 py-0.5 rounded">
                Separação &bull; Coletas
              </span>
            </div>
          </div>

          {/* Card: CONTROLE DE VEÍCULOS (Exclusivo para Desktop/PC: hidden lg:block) */}
          <div
            id="card-module-veiculos"
            onClick={() => onNavigate('veiculos')}
            className="hidden lg:block group cursor-pointer rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 p-5 shadow-lg transition-all duration-200 hover:-translate-y-1 relative overflow-hidden"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-110 transition">
                <Truck className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20 flex items-center gap-1">
                Rotas & Frota
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
              </span>
            </div>

            <div className="mt-4">
              <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition">
                Controle de Veículos
              </h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                Saídas, cálculo automático de KM rodado, motoristas, coletas vinculadas e abastecimentos.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">Frota:</span>
              <span className="font-bold text-blue-300 font-mono bg-slate-800 px-2 py-0.5 rounded">
                Saídas &bull; Abastecimentos
              </span>
            </div>
          </div>

          {/* Card 3: ENDEREÇAMENTO (Visível apenas para Gestor) */}
          {isGestor && (
            <div
              id="card-module-enderecamento"
              onClick={() => onNavigate('enderecamento')}
              className="group cursor-pointer rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-sky-500/50 p-5 shadow-lg transition-all duration-200 hover:-translate-y-1 relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 group-hover:scale-110 transition">
                  <MapPin className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-full border border-sky-500/20 flex items-center gap-1">
                  Estruturado
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
                </span>
              </div>

              <div className="mt-4">
                <h3 className="text-lg font-bold text-white group-hover:text-sky-400 transition">
                  Endereçamento
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  Posições físicas, ruas, níveis e validação com tabela pública de endereços.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">Ocupação:</span>
                <span className="font-bold text-sky-300 font-mono bg-slate-800 px-2 py-0.5 rounded">
                  {warehouseMetrics.taxaOcupacao}% ocupado
                </span>
              </div>
            </div>
          )}

          {/* Card 4: INVENTÁRIO (Visível para Logística e Gestor) */}
          {canAccessInventario && (
            <div
              id="card-module-inventario"
              onClick={() => onNavigate('inventario')}
              className="group cursor-pointer rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 p-5 shadow-lg transition-all duration-200 hover:-translate-y-1 relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition">
                  <Package className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 flex items-center gap-1">
                  Auditoria
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
                </span>
              </div>

              <div className="mt-4">
                <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition">
                  Inventário
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  Contagem física de produtos por endereço com auditoria às cegas e validação imediata.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">Operação:</span>
                <span className="font-bold text-amber-300 font-mono bg-slate-800 px-2 py-0.5 rounded">
                  Às Cegas
                </span>
              </div>
            </div>
          )}

          {/* Card: AUDITORIA (Histórico de Movimentações nos Últimos 30 Dias) */}
          <div
            id="card-module-auditoria"
            onClick={() => onNavigate('auditoria')}
            className="group cursor-pointer rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 p-5 shadow-lg transition-all duration-200 hover:-translate-y-1 relative overflow-hidden"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-110 transition">
                <SearchCode className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20 flex items-center gap-1">
                Rastreabilidade
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
              </span>
            </div>

            <div className="mt-4">
              <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition">
                Auditoria
              </h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                Histórico cronológico de recebimentos, alocações, trocas de endereço e contagens por produto.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">Período:</span>
              <span className="font-bold text-blue-300 font-mono bg-slate-800 px-2 py-0.5 rounded">
                Últimos 30 dias
              </span>
            </div>
          </div>

          {/* Card 5: CADASTROS (Visível apenas para Gestor) */}
          {isGestor && (
            <div
              id="card-module-cadastros"
              onClick={() => onNavigate('cadastros')}
              className="group cursor-pointer rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 p-5 shadow-lg transition-all duration-200 hover:-translate-y-1 relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-110 transition">
                  <Building2 className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20 flex items-center gap-1">
                  Base
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
                </span>
              </div>

              <div className="mt-4">
                <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition">
                  Cadastros
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  Transportadoras e fornecedores/fábricas para alimentação automática dos agendamentos.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">Gestão:</span>
                <span className="font-bold text-blue-300 font-mono bg-slate-800 px-2 py-0.5 rounded">
                  Simplificada
                </span>
              </div>
            </div>
          )}

          {/* Card: RELATÓRIOS GERENCIAIS (Visível apenas para Gestor) */}
          {isGestor && (
            <div
              id="card-module-relatorios"
              onClick={() => onNavigate('relatorios')}
              className="group cursor-pointer rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 p-5 shadow-lg transition-all duration-200 hover:-translate-y-1 relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-110 transition">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20 flex items-center gap-1">
                  Auditoria
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
                </span>
              </div>

              <div className="mt-4">
                <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition">
                  Relatórios
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  Consulta por Nota Fiscal com conferente, repositor, endereçamento e exportação Excel.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">Função 1:</span>
                <span className="font-bold text-emerald-300 font-mono bg-slate-800 px-2 py-0.5 rounded">
                  recebimentos_produtos
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4. ÁREA PREPARADA PARA INDICADORES OPERACIONAIS */}
      <section id="section-home-indicators">
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Indicadores Operacionais</h2>
            <p className="text-xs text-slate-400">Visão consolidada do fluxo do galpão</p>
          </div>
          <button
            type="button"
            id="btn-refresh-home"
            onClick={loadData}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-900 transition min-h-[36px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Indicator 1 */}
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Pendentes Hoje</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">{metrics.pendentesHoje}</div>
            <p className="text-[11px] text-slate-400 mt-1">Aguardando doca de descarga</p>
          </div>

          {/* Indicator 2 */}
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Recebidos Hoje</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">{metrics.recebidosHoje}</div>
            <p className="text-[11px] text-slate-400 mt-1">Conferidos e estocados</p>
          </div>

          {/* Indicator 3 */}
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Em Trânsito</span>
              <TrendingUp className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">{metrics.emTransito}</div>
            <p className="text-[11px] text-slate-400 mt-1">Cargas a caminho</p>
          </div>

          {/* Indicator 4 */}
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Posições no Armazém</span>
              <Layers className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">{warehouseMetrics.totalEnderecos}</div>
            <p className="text-[11px] text-slate-400 mt-1">{warehouseMetrics.ocupados} ocupadas / reservadas</p>
          </div>
        </div>
      </section>

      {/* 5. NOTICE ON ARCHITECTURAL EXPANSION */}
      <section className="rounded-2xl bg-slate-900/40 border border-slate-800/80 p-4 flex items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
          <span>
            Arquitetura modular preparada para receber novos submódulos, regras de conferência cega e integrações sem reconstruir o sistema.
          </span>
        </div>
        <div className="hidden sm:block font-mono text-[10px] text-slate-300">
          v1.0.0-PROD
        </div>
      </section>
    </div>
  );
};
