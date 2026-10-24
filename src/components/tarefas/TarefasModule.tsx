import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  User as UserIcon,
  AlertCircle,
  ClockAlert,
  Clock,
  CheckCircle2,
  Trash2,
  Edit,
  Eye,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Check,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Tarefa, TarefaStatus, PrazoCalculado, Usuario } from '../../types';
import {
  tarefasService,
  calcularPrazoTarefa,
  sortTarefasList,
} from '../../services/tarefasService';
import { usuariosService } from '../../services/usuariosService';
import { TarefaModal } from './TarefaModal';
import { TarefaDetailsModal } from './TarefaDetailsModal';

export const TarefasModule: React.FC = () => {
  const { user } = useAuth();
  const isGestor = user?.nivel?.toLowerCase() === 'gestor';

  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResponsavel, setSelectedResponsavel] = useState<string>('Todos');
  const [selectedStatus, setSelectedStatus] = useState<TarefaStatus | 'Todos'>('Todos');
  const [selectedPrazo, setSelectedPrazo] = useState<PrazoCalculado | 'Todos'>('Todos');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTarefa, setEditingTarefa] = useState<Tarefa | null>(null);
  const [viewingTarefa, setViewingTarefa] = useState<Tarefa | null>(null);
  const [deletingTarefa, setDeletingTarefa] = useState<Tarefa | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Feedback banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  // Load initial data
  const loadData = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Parallel fetch users (for filter names) and tasks
      const [allUsers, taskList] = await Promise.all([
        usuariosService.listarTodos(),
        tarefasService.listarTarefas(user, {
          search: searchTerm,
          responsavelId: selectedResponsavel,
          status: selectedStatus,
          prazo: selectedPrazo,
        }),
      ]);

      setUsuarios(allUsers);
      setTarefas(taskList);
    } catch (err) {
      console.warn('Erro ao carregar dados de tarefas:', err);
      showFeedback('error', 'Falha ao sincronizar tarefas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, searchTerm, selectedResponsavel, selectedStatus, selectedPrazo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Metrics summary
  const metrics = useMemo(() => {
    let prazoEstourado = 0;
    let finalizarHoje = 0;
    let dentroDoPrazo = 0;
    let concluidas = 0;

    for (const t of tarefas) {
      const p = t.prazo || calcularPrazoTarefa(t.status, t.data_limite);
      if (p === 'Prazo estourado') prazoEstourado++;
      else if (p === 'Finalizar hoje') finalizarHoje++;
      else if (p === 'Dentro do prazo') dentroDoPrazo++;
      else if (p === 'Concluída') concluidas++;
    }

    return {
      total: tarefas.length,
      prazoEstourado,
      finalizarHoje,
      dentroDoPrazo,
      concluidas,
    };
  }, [tarefas]);

  // Handlers
  const handleSaveTarefa = async (dados: {
    nome: string;
    responsavel_id: string;
    data_limite: string;
    status: TarefaStatus;
  }) => {
    if (!user || !isGestor) return;

    if (editingTarefa) {
      await tarefasService.atualizarTarefa(user, editingTarefa.id, dados);
      showFeedback('success', 'Tarefa atualizada com sucesso!');
    } else {
      await tarefasService.criarTarefa(user, dados);
      showFeedback('success', 'Nova tarefa atribuída com sucesso!');
    }

    await loadData(true);
  };

  const handleStatusChange = async (id: string, newStatus: TarefaStatus) => {
    if (!user || !isGestor) return;

    try {
      const updated = await tarefasService.alterarStatus(user, id, newStatus);
      setTarefas((prev) =>
        sortTarefasList(prev.map((t) => (t.id === id ? { ...t, ...updated } : t)))
      );
      if (viewingTarefa && viewingTarefa.id === id) {
        setViewingTarefa((prev) => (prev ? { ...prev, ...updated } : null));
      }
      showFeedback('success', `Status atualizado para "${newStatus}".`);
    } catch (err) {
      showFeedback('error', 'Falha ao atualizar status.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!user || !isGestor || !deletingTarefa) return;

    setActionLoading(true);
    try {
      await tarefasService.excluirTarefa(user, deletingTarefa.id);
      setTarefas((prev) => prev.filter((t) => t.id !== deletingTarefa.id));
      if (viewingTarefa?.id === deletingTarefa.id) {
        setViewingTarefa(null);
      }
      setDeletingTarefa(null);
      showFeedback('success', 'Tarefa excluída com sucesso.');
    } catch (err) {
      showFeedback('error', 'Erro ao excluir tarefa.');
    } finally {
      setActionLoading(false);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedResponsavel('Todos');
    setSelectedStatus('Todos');
    setSelectedPrazo('Todos');
  };

  const getPrazoBadgeUI = (p: PrazoCalculado) => {
    switch (p) {
      case 'Prazo estourado':
        return {
          bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
          icon: AlertCircle,
          label: 'Prazo estourado',
        };
      case 'Finalizar hoje':
        return {
          bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          icon: ClockAlert,
          label: 'Finalizar hoje',
        };
      case 'Dentro do prazo':
        return {
          bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          icon: Clock,
          label: 'Dentro do prazo',
        };
      case 'Concluída':
        return {
          bg: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
          icon: CheckCircle2,
          label: 'Concluída',
        };
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              PoliHub WMS
            </span>
            <span
              className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${
                isGestor
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {isGestor ? 'Visão Gestor (Todas as Tarefas)' : 'Minhas Tarefas Atribuídas'}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1.5 flex items-center gap-2.5">
            <CheckSquare className="w-7 h-7 text-blue-400" />
            <span>Gestão de Tarefas</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {isGestor
              ? 'Acompanhe prazos dinâmicos, atribua responsabilidades e audite conclusões da equipe.'
              : 'Visualize seus compromissos operacionais, acompanhe prazos de entrega e pendências.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            id="btn-refresh-tarefas"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition min-h-[44px]"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>

          {isGestor && (
            <button
              type="button"
              id="btn-nova-tarefa"
              onClick={() => {
                setEditingTarefa(null);
                setIsCreateModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/30 active:scale-95 min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nova Tarefa</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs font-semibold animate-in fade-in slide-in-from-top-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Metrics Summary Cards (Interactive filters) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total */}
        <div
          onClick={() => setSelectedPrazo('Todos')}
          className={`cursor-pointer rounded-2xl p-4 border transition ${
            selectedPrazo === 'Todos'
              ? 'bg-blue-950/40 border-blue-500/50 shadow-md shadow-blue-900/20'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Total</span>
            <CheckSquare className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-2">
            {metrics.total}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {isGestor ? 'No armazém' : 'Atribuídas a você'}
          </div>
        </div>

        {/* Prazo Estourado */}
        <div
          onClick={() => setSelectedPrazo(selectedPrazo === 'Prazo estourado' ? 'Todos' : 'Prazo estourado')}
          className={`cursor-pointer rounded-2xl p-4 border transition ${
            selectedPrazo === 'Prazo estourado'
              ? 'bg-rose-950/40 border-rose-500/60 shadow-md shadow-rose-900/20'
              : 'bg-slate-900/80 border-slate-800 hover:border-rose-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-400">Prazo estourado</span>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-300 font-mono mt-2">
            {metrics.prazoEstourado}
          </div>
          <div className="text-[11px] text-rose-400/80 mt-1">Atrasadas</div>
        </div>

        {/* Finalizar Hoje */}
        <div
          onClick={() => setSelectedPrazo(selectedPrazo === 'Finalizar hoje' ? 'Todos' : 'Finalizar hoje')}
          className={`cursor-pointer rounded-2xl p-4 border transition ${
            selectedPrazo === 'Finalizar hoje'
              ? 'bg-amber-950/40 border-amber-500/60 shadow-md shadow-amber-900/20'
              : 'bg-slate-900/80 border-slate-800 hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400">Finalizar hoje</span>
            <ClockAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300 font-mono mt-2">
            {metrics.finalizarHoje}
          </div>
          <div className="text-[11px] text-amber-400/80 mt-1">Vencimento hoje</div>
        </div>

        {/* Concluídas */}
        <div
          onClick={() => setSelectedPrazo(selectedPrazo === 'Concluída' ? 'Todos' : 'Concluída')}
          className={`cursor-pointer rounded-2xl p-4 border transition ${
            selectedPrazo === 'Concluída'
              ? 'bg-sky-950/40 border-sky-500/60 shadow-md shadow-sky-900/20'
              : 'bg-slate-900/80 border-slate-800 hover:border-sky-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-400">Concluídas</span>
            <CheckCircle2 className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-sky-300 font-mono mt-2">
            {metrics.concluidas}
          </div>
          <div className="text-[11px] text-sky-400/80 mt-1">Finalizadas</div>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              id="filter-search-tarefa"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome da tarefa..."
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition min-h-[44px]"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Filter: Responsável (Visible for Gestor) */}
          {isGestor ? (
            <div className="relative">
              <select
                id="filter-responsavel-tarefa"
                value={selectedResponsavel}
                onChange={(e) => setSelectedResponsavel(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-blue-500 transition appearance-none min-h-[44px]"
              >
                <option value="Todos" className="bg-slate-900 text-white">
                  Responsável: Todos
                </option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                    {u.nome} ({u.codigo})
                  </option>
                ))}
              </select>
              <UserIcon className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : (
            <div className="bg-slate-950/40 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-slate-400 flex items-center gap-2 min-h-[44px]">
              <UserIcon className="w-4 h-4 text-blue-400" />
              <span className="truncate">Responsável: {user?.nome}</span>
            </div>
          )}

          {/* Filter: Status */}
          <div className="relative">
            <select
              id="filter-status-tarefa"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-blue-500 transition appearance-none min-h-[44px]"
            >
              <option value="Todos" className="bg-slate-900 text-white">Status: Todos</option>
              <option value="Pendente" className="bg-slate-900 text-white">Pendente</option>
              <option value="Concluído" className="bg-slate-900 text-white">Concluído</option>
              <option value="Não concluído" className="bg-slate-900 text-white">Não concluído</option>
            </select>
            <Filter className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Filter: Prazo Virtual */}
          <div className="relative">
            <select
              id="filter-prazo-tarefa"
              value={selectedPrazo}
              onChange={(e) => setSelectedPrazo(e.target.value as any)}
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-blue-500 transition appearance-none min-h-[44px]"
            >
              <option value="Todos" className="bg-slate-900 text-white">Prazo: Todos</option>
              <option value="Prazo estourado" className="bg-slate-900 text-rose-300">Prazo estourado</option>
              <option value="Finalizar hoje" className="bg-slate-900 text-amber-300">Finalizar hoje</option>
              <option value="Dentro do prazo" className="bg-slate-900 text-emerald-300">Dentro do prazo</option>
              <option value="Concluída" className="bg-slate-900 text-sky-300">Concluída</option>
            </select>
            <Clock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Active filters bar and reset */}
        {(searchTerm || selectedResponsavel !== 'Todos' || selectedStatus !== 'Todos' || selectedPrazo !== 'Todos') && (
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Filtros ativos aplicados. Exibindo <strong className="text-white">{tarefas.length}</strong> tarefas.
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="text-blue-400 hover:text-blue-300 font-semibold hover:underline"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      {/* 4. Content List: Mobile Cards vs Desktop Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-slate-900/50 border border-slate-800 rounded-3xl">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-white">Carregando tarefas do sistema...</p>
          <p className="text-xs text-slate-500 mt-1">Calculando prazos dinâmicos e permissões.</p>
        </div>
      ) : tarefas.length === 0 ? (
        <div className="p-12 text-center text-slate-400 bg-slate-900/40 border border-slate-800 rounded-3xl space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
            <CheckSquare className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">Nenhuma tarefa encontrada</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {isGestor
              ? 'Não há tarefas cadastradas com os filtros selecionados. Clique em "+ Nova Tarefa" para criar uma.'
              : 'Você não possui tarefas pendentes atribuídas no momento.'}
          </p>
          {isGestor && (
            <button
              type="button"
              onClick={() => {
                setEditingTarefa(null);
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition min-h-[40px] mt-2"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Primeira Tarefa</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* MOBILE CARDS VIEW (Visible on screens < md) */}
          <div className="md:hidden space-y-3">
            {tarefas.map((tarefa) => {
              const prazo = tarefa.prazo || calcularPrazoTarefa(tarefa.status, tarefa.data_limite);
              const prazoUI = getPrazoBadgeUI(prazo);
              const PrazoIcon = prazoUI.icon;

              return (
                <div
                  key={tarefa.id}
                  className="rounded-3xl bg-slate-900/90 border border-slate-800 p-4 space-y-3 shadow-lg"
                >
                  {/* Top row: Status and Prazo Badges */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 ${prazoUI.bg}`}
                    >
                      <PrazoIcon className="w-3.5 h-3.5" />
                      <span>{prazoUI.label}</span>
                    </span>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        tarefa.status === 'Concluído'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : tarefa.status === 'Pendente'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {tarefa.status}
                    </span>
                  </div>

                  {/* Task title */}
                  <h4 className="text-sm font-bold text-white leading-snug">
                    {tarefa.nome}
                  </h4>

                  {/* Info details */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800/80">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Responsável</span>
                      <span className="font-semibold text-slate-200 truncate block">
                        {tarefa.responsavel_nome}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Data Limite</span>
                      <span className="font-mono text-slate-200 block">
                        {tarefa.data_limite
                          ? new Date(tarefa.data_limite + 'T00:00:00').toLocaleDateString('pt-BR')
                          : 'A definir'}
                      </span>
                    </div>
                  </div>

                  {tarefa.data_conclusao && (
                    <div className="text-[11px] text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-2.5 py-1 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Concluído em: {new Date(tarefa.data_conclusao).toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}

                  {/* Mobile Actions */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setViewingTarefa(tarefa)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition min-h-[44px]"
                    >
                      <Eye className="w-4 h-4 text-blue-400" />
                      <span>Detalhes</span>
                    </button>

                    {isGestor && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingTarefa(tarefa)}
                          className="flex items-center justify-center p-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 transition min-h-[44px] min-w-[44px]"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingTarefa(tarefa)}
                          className="flex items-center justify-center p-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition min-h-[44px] min-w-[44px]"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* DESKTOP TABLE VIEW (Visible on screens >= md) */}
          <div className="hidden md:block rounded-3xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Tarefa</th>
                    <th className="py-3.5 px-4">Responsável</th>
                    <th className="py-3.5 px-4">Data Limite</th>
                    <th className="py-3.5 px-4">Data Conclusão</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Prazo (Dinâmico)</th>
                    <th className="py-3.5 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {tarefas.map((tarefa) => {
                    const prazo = tarefa.prazo || calcularPrazoTarefa(tarefa.status, tarefa.data_limite);
                    const prazoUI = getPrazoBadgeUI(prazo);
                    const PrazoIcon = prazoUI.icon;

                    return (
                      <tr
                        key={tarefa.id}
                        className="hover:bg-slate-800/40 transition group"
                      >
                        {/* Tarefa */}
                        <td className="py-3.5 px-4 max-w-xs">
                          <span className="font-bold text-white group-hover:text-blue-400 transition block truncate">
                            {tarefa.nome}
                          </span>
                        </td>

                        {/* Responsável */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-[10px]">
                              {tarefa.responsavel_codigo ? tarefa.responsavel_codigo.slice(0, 2) : 'US'}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-200 block">
                                {tarefa.responsavel_nome}
                              </span>
                              {tarefa.responsavel_codigo && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {tarefa.responsavel_codigo}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Data Limite */}
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-300">
                          {tarefa.data_limite
                            ? new Date(tarefa.data_limite + 'T00:00:00').toLocaleDateString('pt-BR')
                            : '—'}
                        </td>

                        {/* Data Conclusão */}
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-300">
                          {tarefa.data_conclusao ? (
                            <span className="text-emerald-400">
                              {new Date(tarefa.data_conclusao).toLocaleDateString('pt-BR')}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">Pendente</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isGestor ? (
                            <select
                              value={tarefa.status}
                              onChange={(e) => handleStatusChange(tarefa.id, e.target.value as TarefaStatus)}
                              className={`text-xs font-bold px-2.5 py-1 rounded-xl border appearance-none focus:outline-hidden transition cursor-pointer ${
                                tarefa.status === 'Concluído'
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : tarefa.status === 'Pendente'
                                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                  : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              <option value="Pendente" className="bg-slate-900 text-white">Pendente</option>
                              <option value="Concluído" className="bg-slate-900 text-white">Concluído</option>
                              <option value="Não concluído" className="bg-slate-900 text-white">Não concluído</option>
                            </select>
                          ) : (
                            <span
                              className={`inline-block text-xs font-bold px-2.5 py-1 rounded-xl border ${
                                tarefa.status === 'Concluído'
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : tarefa.status === 'Pendente'
                                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                  : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              {tarefa.status}
                            </span>
                          )}
                        </td>

                        {/* Prazo Dinâmico */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border font-bold text-xs ${prazoUI.bg}`}
                          >
                            <PrazoIcon className="w-3.5 h-3.5" />
                            <span>{prazoUI.label}</span>
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingTarefa(tarefa)}
                              className="p-2 rounded-xl text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition"
                              title="Visualizar detalhes"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {isGestor && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setEditingTarefa(tarefa)}
                                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                  title="Editar tarefa"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingTarefa(tarefa)}
                                  className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                                  title="Excluir tarefa"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 5. Create Modal (Gestor only) */}
      {isCreateModalOpen && (
        <TarefaModal
          onClose={() => setIsCreateModalOpen(false)}
          onSave={handleSaveTarefa}
        />
      )}

      {/* 6. Edit Modal (Gestor only) */}
      {editingTarefa && (
        <TarefaModal
          tarefa={editingTarefa}
          onClose={() => setEditingTarefa(null)}
          onSave={handleSaveTarefa}
        />
      )}

      {/* 7. Details Modal (Common User and Gestor) */}
      {viewingTarefa && (
        <TarefaDetailsModal
          tarefa={viewingTarefa}
          isGestor={isGestor}
          onClose={() => setViewingTarefa(null)}
          onEdit={(t) => {
            setViewingTarefa(null);
            setEditingTarefa(t);
          }}
          onDelete={(t) => {
            setDeletingTarefa(t);
          }}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* 8. Delete Confirmation Modal */}
      {deletingTarefa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h4 className="text-base font-bold text-white">
                Deseja realmente excluir esta tarefa?
              </h4>
              <p className="text-xs text-slate-400">
                A tarefa &ldquo;<strong className="text-slate-200">{deletingTarefa.nome}</strong>&rdquo; será desativada do sistema.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                id="btn-cancelar-exclusao-tarefa"
                disabled={actionLoading}
                onClick={() => setDeletingTarefa(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition min-h-[44px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirmar-exclusao-tarefa"
                disabled={actionLoading}
                onClick={handleDeleteConfirm}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/30 active:scale-95 disabled:opacity-50 min-h-[44px]"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Confirmar Exclusão</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
