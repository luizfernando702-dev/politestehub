import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Truck,
  Plus,
  Search,
  Calendar,
  Filter,
  RefreshCw,
  Fuel,
  Gauge,
  Layers,
  DollarSign,
  TrendingUp,
  Building2,
  User,
  Clock,
  Eye,
  Edit2,
  Trash2,
  Power,
  PowerOff,
  CheckCircle2,
  AlertCircle,
  Database,
  BarChart3,
  XCircle,
  ChevronRight,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import {
  Veiculo,
  SaidaVeiculo,
  AbastecimentoVeiculo,
  IndicadoresVeiculos,
  PeriodoSaida,
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  isUserGestor,
  canUserAdicionarEditarVeiculos,
  canUserExcluirVeiculosEAbastecimentos,
} from '../../lib/permissions';
import { veiculosService } from '../../services/veiculosService';
import { SaidaModal } from './SaidaModal';
import { DetalhesSaidaModal } from './DetalhesSaidaModal';
import { AbastecimentoModal } from './AbastecimentoModal';
import { VeiculoModal } from './VeiculoModal';
import { SqlScriptVeiculosModal } from './SqlScriptVeiculosModal';

type TabVeiculos = 'saidas' | 'abastecimentos' | 'veiculos' | 'indicadores';

export const ControleVeiculosModule: React.FC = () => {
  const { user } = useAuth();
  const isGestor = isUserGestor(user);
  const podeAdicionarEditar = canUserAdicionarEditarVeiculos(user);
  const podeExcluir = canUserExcluirVeiculosEAbastecimentos(user);

  // Aba ativa
  const [activeTab, setActiveTab] = useState<TabVeiculos>('saidas');

  // Modais
  const [modalSaidaOpen, setModalSaidaOpen] = useState(false);
  const [saidaEmEdicao, setSaidaEmEdicao] = useState<SaidaVeiculo | null>(null);
  const [saidaParaDetalhes, setSaidaParaDetalhes] = useState<SaidaVeiculo | null>(null);

  const [modalAbastecimentoOpen, setModalAbastecimentoOpen] = useState(false);
  const [abastecimentoEmEdicao, setAbastecimentoEmEdicao] = useState<AbastecimentoVeiculo | null>(null);

  const [modalVeiculoOpen, setModalVeiculoOpen] = useState(false);
  const [veiculoEmEdicao, setVeiculoEmEdicao] = useState<Veiculo | null>(null);

  const [modalSqlOpen, setModalSqlOpen] = useState(false);

  // Estados de dados
  const [saidas, setSaidas] = useState<SaidaVeiculo[]>([]);
  const [abastecimentos, setAbastecimentos] = useState<AbastecimentoVeiculo[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [motoristas, setMotoristas] = useState<Array<{ id: string; nome: string }>>([]);
  const [indicadores, setIndicadores] = useState<IndicadoresVeiculos | null>(null);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; isError?: boolean } | null>(null);

  // Filtros de Saídas e Abastecimentos
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroVeiculoId, setFiltroVeiculoId] = useState('Todos');
  const [filtroMotoristaId, setFiltroMotoristaId] = useState('Todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState<PeriodoSaida | 'Todos'>('Todos');

  const showFeedback = (message: string, isError = false) => {
    setFeedback({ message, isError });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Carregamento de veículos e motoristas para filtros
  const carregarApoio = useCallback(async () => {
    try {
      const [listaVeiculos, listaMotoristas] = await Promise.all([
        veiculosService.listarVeiculos({ unidade_negocio: user?.unidade_negocio }),
        veiculosService.obterMotoristas(user?.unidade_negocio),
      ]);
      setVeiculos(listaVeiculos);
      setMotoristas(listaMotoristas);
    } catch (err) {
      console.warn('Erro ao carregar dados de apoio:', err);
    }
  }, [user?.unidade_negocio]);

  // Carregamento da aba Saídas
  const carregarSaidas = useCallback(async () => {
    try {
      setLoading(true);
      const dados = await veiculosService.listarSaidas({
        unidade_negocio: user?.unidade_negocio,
        dataInicio: filtroDataInicio || undefined,
        dataFim: filtroDataFim || undefined,
        veiculo_id: filtroVeiculoId !== 'Todos' ? filtroVeiculoId : undefined,
        motorista_id: filtroMotoristaId !== 'Todos' ? filtroMotoristaId : undefined,
        periodo: filtroPeriodo !== 'Todos' ? filtroPeriodo : undefined,
      });
      setSaidas(dados);
    } catch (err) {
      console.warn('Erro ao carregar saídas:', err);
      showFeedback('Não foi possível carregar as saídas de veículos.', true);
    } finally {
      setLoading(false);
    }
  }, [user?.unidade_negocio, filtroDataInicio, filtroDataFim, filtroVeiculoId, filtroMotoristaId, filtroPeriodo]);

  // Carregamento da aba Abastecimentos
  const carregarAbastecimentos = useCallback(async () => {
    try {
      setLoading(true);
      const dados = await veiculosService.listarAbastecimentos({
        unidade_negocio: user?.unidade_negocio,
        dataInicio: filtroDataInicio || undefined,
        dataFim: filtroDataFim || undefined,
        veiculo_id: filtroVeiculoId !== 'Todos' ? filtroVeiculoId : undefined,
        motorista_id: filtroMotoristaId !== 'Todos' ? filtroMotoristaId : undefined,
      });
      setAbastecimentos(dados);
    } catch (err) {
      console.warn('Erro ao carregar abastecimentos:', err);
      showFeedback('Não foi possível carregar os abastecimentos.', true);
    } finally {
      setLoading(false);
    }
  }, [user?.unidade_negocio, filtroDataInicio, filtroDataFim, filtroVeiculoId, filtroMotoristaId]);

  // Carregamento da aba Indicadores
  const carregarIndicadores = useCallback(async () => {
    try {
      setLoading(true);
      const dados = await veiculosService.obterIndicadores({
        unidade_negocio: user?.unidade_negocio,
        dataInicio: filtroDataInicio || undefined,
        dataFim: filtroDataFim || undefined,
        veiculo_id: filtroVeiculoId !== 'Todos' ? filtroVeiculoId : undefined,
        motorista_id: filtroMotoristaId !== 'Todos' ? filtroMotoristaId : undefined,
      });
      setIndicadores(dados);
    } catch (err) {
      console.warn('Erro ao carregar indicadores:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.unidade_negocio, filtroDataInicio, filtroDataFim, filtroVeiculoId, filtroMotoristaId]);

  // Efeito inicial e recarregamento com base na aba ativa
  useEffect(() => {
    carregarApoio();
  }, [carregarApoio]);

  useEffect(() => {
    if (activeTab === 'saidas') {
      carregarSaidas();
    } else if (activeTab === 'abastecimentos') {
      carregarAbastecimentos();
    } else if (activeTab === 'veiculos') {
      carregarApoio();
    } else if (activeTab === 'indicadores') {
      carregarIndicadores();
    }
  }, [activeTab, carregarSaidas, carregarAbastecimentos, carregarApoio, carregarIndicadores]);

  // Handlers para Saídas
  const handleSaveSaida = async (dados: any) => {
    if (!podeAdicionarEditar) {
      showFeedback('Acesso negado: Adição e edição são exclusivas do Gestor ou Assistente do departamento Logística.', true);
      return;
    }
    try {
      await veiculosService.salvarSaida(dados);
      showFeedback(dados.id ? 'Saída de veículo atualizada com sucesso no banco de dados!' : 'Saída registrada com sucesso no banco de dados!');
      await carregarSaidas();
    } catch (err: any) {
      showFeedback(err?.message || 'Erro ao salvar saída no banco de dados.', true);
      throw err;
    }
  };

  const handleExcluirSaida = async (id: string) => {
    if (!podeExcluir) {
      showFeedback('Acesso negado: A exclusão é exclusiva do Gestor do departamento Logística.', true);
      return;
    }
    if (window.confirm('Tem certeza que deseja excluir esta saída? O registro será removido do banco de dados.')) {
      try {
        await veiculosService.excluirSaida(id);
        showFeedback('Saída excluída com sucesso do banco de dados.');
        await carregarSaidas();
      } catch (err: any) {
        showFeedback(err?.message || 'Erro ao excluir saída.', true);
      }
    }
  };

  // Handlers para Abastecimentos
  const handleSaveAbastecimento = async (dados: any) => {
    if (!podeAdicionarEditar) {
      showFeedback('Acesso negado: Adição e edição são exclusivas do Gestor ou Assistente do departamento Logística.', true);
      return;
    }
    try {
      await veiculosService.salvarAbastecimento(dados);
      showFeedback(dados.id ? 'Abastecimento atualizado com sucesso no banco de dados!' : 'Abastecimento registrado com sucesso no banco de dados!');
      await carregarAbastecimentos();
    } catch (err: any) {
      showFeedback(err?.message || 'Erro ao salvar abastecimento no banco de dados.', true);
      throw err;
    }
  };

  const handleExcluirAbastecimento = async (id: string) => {
    if (!podeExcluir) {
      showFeedback('Acesso negado: A exclusão de abastecimentos é exclusiva do Gestor do departamento Logística.', true);
      return;
    }
    if (window.confirm('Tem certeza que deseja excluir este abastecimento? O registro será removido do banco de dados.')) {
      try {
        await veiculosService.excluirAbastecimento(id);
        showFeedback('Abastecimento excluído do banco de dados.');
        await carregarAbastecimentos();
      } catch (err: any) {
        showFeedback(err?.message || 'Erro ao excluir abastecimento.', true);
      }
    }
  };

  // Handlers para Veículos
  const handleSaveVeiculo = async (dados: any) => {
    if (!podeAdicionarEditar) {
      showFeedback('Acesso negado: Adição e edição de veículos são exclusivas do Gestor ou Assistente do departamento Logística.', true);
      return;
    }
    try {
      await veiculosService.salvarVeiculo(dados);
      showFeedback(dados.id ? 'Veículo atualizado no banco de dados!' : 'Veículo cadastrado na frota com sucesso no banco de dados!');
      await carregarApoio();
    } catch (err: any) {
      showFeedback(err?.message || 'Erro ao salvar veículo.', true);
      throw err;
    }
  };

  const handleAlternarStatusVeiculo = async (v: Veiculo) => {
    if (!podeAdicionarEditar) {
      showFeedback('Acesso negado: Alteração de status exclusiva do Gestor ou Assistente do departamento Logística.', true);
      return;
    }
    const novoStatus = !v.ativo;
    const msg = novoStatus
      ? `Reativar o veículo ${v.nome}?`
      : `Desativar o veículo ${v.nome}? O histórico de saídas e abastecimentos será mantido.`;

    if (window.confirm(msg)) {
      await veiculosService.alternarStatusVeiculo(v.id, novoStatus);
      showFeedback(`Veículo ${v.nome} ${novoStatus ? 'ativado' : 'desativado'}.`);
      carregarApoio();
    }
  };

  const handleExcluirVeiculo = async (id: string, nome: string) => {
    if (!podeExcluir) {
      showFeedback('Acesso negado: A exclusão de veículos é exclusiva do Gestor do departamento Logística.', true);
      return;
    }
    if (window.confirm(`Tem certeza que deseja excluir o veículo "${nome}"? O registro será removido do banco de dados.`)) {
      try {
        await veiculosService.excluirVeiculo(id);
        showFeedback('Veículo excluído com sucesso do banco de dados.');
        await carregarApoio();
      } catch (err: any) {
        showFeedback(err?.message || 'Erro ao excluir veículo.', true);
      }
    }
  };

  const limparFiltros = () => {
    setFiltroDataInicio('');
    setFiltroDataFim('');
    setFiltroVeiculoId('Todos');
    setFiltroMotoristaId('Todos');
    setFiltroPeriodo('Todos');
  };

  const activeFiltersCount =
    (filtroDataInicio ? 1 : 0) +
    (filtroDataFim ? 1 : 0) +
    (filtroVeiculoId !== 'Todos' ? 1 : 0) +
    (filtroMotoristaId !== 'Todos' ? 1 : 0) +
    (filtroPeriodo !== 'Todos' ? 1 : 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* 1. Header do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Controle de Veículos
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {user?.unidade_negocio || 'Goiânia-GO'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Gestão de rotas, saídas, quilometragem, motoristas, coletas vinculadas e abastecimentos
          </p>
        </div>

        {/* Ações Globais */}
        <div className="flex items-center gap-2.5 flex-wrap">


          {activeTab === 'saidas' && podeAdicionarEditar && (
            <button
              type="button"
              id="btn-nova-saida"
              onClick={() => {
                setSaidaEmEdicao(null);
                setModalSaidaOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/25 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Lançar Saída</span>
            </button>
          )}

          {activeTab === 'abastecimentos' && podeAdicionarEditar && (
            <button
              type="button"
              id="btn-novo-abastecimento"
              onClick={() => {
                setAbastecimentoEmEdicao(null);
                setModalAbastecimentoOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-amber-600/25 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Abastecimento</span>
            </button>
          )}

          {activeTab === 'veiculos' && podeAdicionarEditar && (
            <button
              type="button"
              id="btn-novo-veiculo"
              onClick={() => {
                setVeiculoEmEdicao(null);
                setModalVeiculoOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/25 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Veículo</span>
            </button>
          )}
        </div>
      </div>

      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl border text-xs sm:text-sm flex items-center justify-between transition animate-in fade-in ${
            feedback.isError
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.isError ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* 2. Navegação em Abas (Regra 13: Saídas, Abastecimentos, Veículos, Indicadores) */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('saidas')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap ${
            activeTab === 'saidas'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Saídas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('abastecimentos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap ${
            activeTab === 'abastecimentos'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Fuel className="w-4 h-4" />
          <span>Abastecimentos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('veiculos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap ${
            activeTab === 'veiculos'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Gauge className="w-4 h-4" />
          <span>Veículos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('indicadores')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap ${
            activeTab === 'indicadores'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Indicadores</span>
        </button>
      </div>

      {/* 3. Barra de Filtros (aplicável às abas Saídas, Abastecimentos e Indicadores) */}
      {activeTab !== 'veiculos' && (
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Filter className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="text-xs font-semibold text-slate-300">Filtros:</span>
          </div>

          {/* Data Início */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>De:</span>
            <input
              type="date"
              value={filtroDataInicio}
              onChange={(e) => setFiltroDataInicio(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Data Fim */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Até:</span>
            <input
              type="date"
              value={filtroDataFim}
              onChange={(e) => setFiltroDataFim(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Veículo */}
          <select
            value={filtroVeiculoId}
            onChange={(e) => setFiltroVeiculoId(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="Todos">Todos os Veículos</option>
            {veiculos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome} ({v.placa})
              </option>
            ))}
          </select>

          {/* Motorista */}
          <select
            value={filtroMotoristaId}
            onChange={(e) => setFiltroMotoristaId(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="Todos">Todos os Motoristas</option>
            {motoristas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>

          {/* Período (Apenas na aba Saídas) */}
          {activeTab === 'saidas' && (
            <select
              value={filtroPeriodo}
              onChange={(e) => setFiltroPeriodo(e.target.value as any)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="Todos">Todos os Períodos</option>
              <option value="Manhã">Manhã</option>
              <option value="Tarde">Tarde</option>
            </select>
          )}

          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={limparFiltros}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Limpar ({activeFiltersCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (activeTab === 'saidas') carregarSaidas();
              else if (activeTab === 'abastecimentos') carregarAbastecimentos();
              else if (activeTab === 'indicadores') carregarIndicadores();
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Atualizar listagem"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. CONTEÚDO DA ABA: SAÍDAS                               */}
      {/* ======================================================== */}
      {activeTab === 'saidas' && (
        <div className="space-y-4">
          {loading && saidas.length === 0 ? (
            <div className="py-16 text-center text-slate-400 bg-slate-900/60 rounded-3xl border border-slate-800">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-blue-400" />
              <p className="text-sm font-semibold text-white">Carregando saídas de veículos...</p>
            </div>
          ) : saidas.length === 0 ? (
            <div className="py-16 px-6 text-center bg-slate-900/60 rounded-3xl border border-slate-800">
              <div className="w-14 h-14 rounded-3xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-500 mx-auto mb-3">
                <Truck className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white">Nenhuma saída registrada</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                {activeFiltersCount > 0
                  ? 'Nenhuma saída corresponde aos filtros selecionados. Tente ajustar os parâmetros.'
                  : 'Lance a primeira saída de veículo para iniciar o cálculo de KM rodado e controle das coletas.'}
              </p>
              {podeAdicionarEditar && activeFiltersCount === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSaidaEmEdicao(null);
                    setModalSaidaOpen(true);
                  }}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/25"
                >
                  <Plus className="w-4 h-4" />
                  <span>Lançar Primeira Saída</span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
              {/* Tabela Desktop */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3.5 px-4">Data / Hora</th>
                      <th className="py-3.5 px-4">Período</th>
                      <th className="py-3.5 px-4">Veículo</th>
                      <th className="py-3.5 px-4">Motorista</th>
                      <th className="py-3.5 px-4">KM Saída</th>
                      <th className="py-3.5 px-4">KM Rodado</th>
                      <th className="py-3.5 px-4">Entregas</th>
                      <th className="py-3.5 px-4">Valor Total</th>
                      <th className="py-3.5 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {saidas.map((saida) => (
                      <tr key={saida.id} className="hover:bg-slate-800/30 transition-colors group">
                        {/* Data / Hora */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-mono text-white font-bold">
                            {new Date(saida.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>{saida.horario}</span>
                          </div>
                        </td>

                        {/* Período */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${
                              saida.periodo === 'Manhã'
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                            }`}
                          >
                            {saida.periodo}
                          </span>
                        </td>

                        {/* Veículo */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span>{saida.veiculo_nome}</span>
                          </div>
                          <div className="font-mono text-[11px] text-slate-400">
                            {saida.veiculo_placa}
                          </div>
                        </td>

                        {/* Motorista */}
                        <td className="py-3.5 px-4 text-slate-200">
                          <div className="flex items-center gap-1.5 font-medium">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{saida.motorista_nome}</span>
                          </div>
                        </td>

                        {/* KM Saída */}
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-200">
                          <strong className="text-white text-sm">
                            {saida.km_saida.toLocaleString('pt-BR')}
                          </strong>{' '}
                          km
                        </td>

                        {/* KM Rodado (Regra 4 e 5: Base anterior, ou — se primeira saída) */}
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono">
                          {saida.km_rodado !== null ? (
                            <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 text-xs">
                              {saida.km_rodado.toLocaleString('pt-BR')} km
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs italic" title="Primeira saída deste veículo">
                              —
                            </span>
                          )}
                        </td>

                        {/* Entregas vinculadas */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSaidaParaDetalhes(saida)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/80 text-xs font-semibold transition"
                          >
                            <Layers className="w-3.5 h-3.5 text-blue-400" />
                            <span>{saida.quantidade_entregas} {saida.quantidade_entregas === 1 ? 'entrega' : 'entregas'}</span>
                          </button>
                        </td>

                        {/* Valor Total das Notas */}
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono font-bold text-emerald-400 text-xs sm:text-sm">
                          {saida.valor_total_notas.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>

                        {/* Ações */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSaidaParaDetalhes(saida)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                              title="Visualizar detalhes e entregas"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {podeAdicionarEditar && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSaidaEmEdicao(saida);
                                  setModalSaidaOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 hover:text-white text-blue-400 transition"
                                title="Editar saída"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {podeExcluir && (
                              <button
                                type="button"
                                onClick={() => handleExcluirSaida(saida.id)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 hover:text-white text-rose-400 transition"
                                title="Excluir saída"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards Mobile (< lg) */}
              <div className="lg:hidden divide-y divide-slate-800 p-3 space-y-3">
                {saidas.map((saida) => (
                  <div
                    key={saida.id}
                    className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-sm">{saida.veiculo_nome}</h3>
                          <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                            {saida.veiculo_placa}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>
                            {new Date(saida.data + 'T00:00:00').toLocaleDateString('pt-BR')} às {saida.horario}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                          saida.periodo === 'Manhã'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                        }`}
                      >
                        {saida.periodo}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div>
                        <span className="text-[11px] text-slate-500 block">Motorista</span>
                        <strong className="text-slate-200">{saida.motorista_nome}</strong>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block">KM de Saída</span>
                        <strong className="font-mono text-white">
                          {saida.km_saida.toLocaleString('pt-BR')} km
                        </strong>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block">KM Rodado</span>
                        {saida.km_rodado !== null ? (
                          <strong className="font-mono text-emerald-400 font-bold">
                            {saida.km_rodado.toLocaleString('pt-BR')} km
                          </strong>
                        ) : (
                          <span className="text-slate-500 text-xs italic">—</span>
                        )}
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block">Valor Total Notas</span>
                        <strong className="font-mono text-emerald-400 font-bold">
                          {saida.valor_total_notas.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </strong>
                      </div>
                    </div>

                    {/* Footer Mobile Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => setSaidaParaDetalhes(saida)}
                        className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Ver {saida.quantidade_entregas} entregas</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        {podeAdicionarEditar && (
                          <button
                            type="button"
                            onClick={() => {
                              setSaidaEmEdicao(saida);
                              setModalSaidaOpen(true);
                            }}
                            className="p-2 rounded-xl bg-slate-800 text-blue-400 hover:text-white"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {podeExcluir && (
                          <button
                            type="button"
                            onClick={() => handleExcluirSaida(saida.id)}
                            className="p-2 rounded-xl bg-slate-800 text-rose-400 hover:text-white"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. CONTEÚDO DA ABA: ABASTECIMENTOS                       */}
      {/* ======================================================== */}
      {activeTab === 'abastecimentos' && (
        <div className="space-y-4">
          {loading && abastecimentos.length === 0 ? (
            <div className="py-16 text-center text-slate-400 bg-slate-900/60 rounded-3xl border border-slate-800">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-amber-400" />
              <p className="text-sm font-semibold text-white">Carregando abastecimentos...</p>
            </div>
          ) : abastecimentos.length === 0 ? (
            <div className="py-16 px-6 text-center bg-slate-900/60 rounded-3xl border border-slate-800">
              <div className="w-14 h-14 rounded-3xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-500 mx-auto mb-3">
                <Fuel className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white">Nenhum abastecimento registrado</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Cadastre os abastecimentos de combustível para acompanhar o custo por quilômetro e consumo da frota.
              </p>
              {podeAdicionarEditar && (
                <button
                  type="button"
                  onClick={() => {
                    setAbastecimentoEmEdicao(null);
                    setModalAbastecimentoOpen(true);
                  }}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition shadow-lg shadow-amber-600/25"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Abastecimento</span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3.5 px-4">Data / Hora</th>
                      <th className="py-3.5 px-4">Veículo</th>
                      <th className="py-3.5 px-4">Motorista</th>
                      <th className="py-3.5 px-4">KM Abastecimento</th>
                      <th className="py-3.5 px-4">Litros</th>
                      <th className="py-3.5 px-4">Valor Total</th>
                      <th className="py-3.5 px-4">Preço / Litro</th>
                      <th className="py-3.5 px-4">Observação</th>
                      <th className="py-3.5 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {abastecimentos.map((ab) => (
                      <tr key={ab.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-white font-bold">
                          {new Date(ab.data + 'T00:00:00').toLocaleDateString('pt-BR')}{' '}
                          <span className="text-[11px] text-slate-400 font-normal">às {ab.horario}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span>{ab.veiculo_nome}</span>
                          </div>
                          <div className="font-mono text-[11px] text-slate-400">{ab.veiculo_placa}</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-200">{ab.motorista_nome}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-white whitespace-nowrap">
                          {ab.km_abastecimento.toLocaleString('pt-BR')} km
                        </td>
                        <td className="py-3.5 px-4 font-mono text-amber-300 font-bold whitespace-nowrap">
                          {ab.quantidade_litros.toLocaleString('pt-BR')} L
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 text-sm whitespace-nowrap">
                          {ab.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                          {ab.preco_litro
                            ? ab.preco_litro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 truncate max-w-[180px]">
                          {ab.observacao || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {podeAdicionarEditar && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAbastecimentoEmEdicao(ab);
                                  setModalAbastecimentoOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-600 hover:text-white text-amber-400 transition"
                                title="Editar abastecimento"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {podeExcluir && (
                              <button
                                type="button"
                                onClick={() => handleExcluirAbastecimento(ab.id)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 hover:text-white text-rose-400 transition"
                                title="Excluir abastecimento"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards Mobile Abastecimento */}
              <div className="lg:hidden divide-y divide-slate-800 p-3 space-y-3">
                {abastecimentos.map((ab) => (
                  <div
                    key={ab.id}
                    className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-sm">{ab.veiculo_nome}</h3>
                          <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                            {ab.veiculo_placa}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {new Date(ab.data + 'T00:00:00').toLocaleDateString('pt-BR')} às {ab.horario}
                        </div>
                      </div>

                      <div className="font-mono font-bold text-emerald-400 text-sm">
                        {ab.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[11px] text-slate-500 block">Motorista</span>
                        <strong className="text-slate-200">{ab.motorista_nome}</strong>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block">KM Abastecido</span>
                        <strong className="font-mono text-white">
                          {ab.km_abastecimento.toLocaleString('pt-BR')} km
                        </strong>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block">Litros</span>
                        <strong className="font-mono text-amber-300">
                          {ab.quantidade_litros.toLocaleString('pt-BR')} L
                        </strong>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block">Preço / Litro</span>
                        <span className="font-mono text-slate-300">
                          {ab.preco_litro
                            ? ab.preco_litro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            : '—'}
                        </span>
                      </div>
                    </div>

                    {ab.observacao && (
                      <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded-xl">
                        {ab.observacao}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-800">
                      {podeAdicionarEditar && (
                        <button
                          type="button"
                          onClick={() => {
                            setAbastecimentoEmEdicao(ab);
                            setModalAbastecimentoOpen(true);
                          }}
                          className="p-2 rounded-xl bg-slate-800 text-amber-400 hover:text-white"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {podeExcluir && (
                        <button
                          type="button"
                          onClick={() => handleExcluirAbastecimento(ab.id)}
                          className="p-2 rounded-xl bg-slate-800 text-rose-400 hover:text-white"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. CONTEÚDO DA ABA: VEÍCULOS (Cadastro e Gestão de Frota) */}
      {/* ======================================================== */}
      {activeTab === 'veiculos' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {veiculos.map((veiculo) => (
              <div
                key={veiculo.id}
                className={`p-5 rounded-3xl border transition-all ${
                  veiculo.ativo !== false
                    ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700 shadow-lg'
                    : 'bg-slate-950/60 border-slate-800/60 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">{veiculo.nome}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400 font-medium">{veiculo.marca}</span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700/80 font-bold">
                          {veiculo.placa}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                      veiculo.ativo !== false
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {veiculo.ativo !== false ? 'Ativo' : 'Desativado'}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>{veiculo.unidade_negocio}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {podeAdicionarEditar && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setVeiculoEmEdicao(veiculo);
                            setModalVeiculoOpen(true);
                          }}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-blue-600 hover:text-white text-blue-400 transition"
                          title="Editar cadastro do veículo"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAlternarStatusVeiculo(veiculo)}
                          className={`p-2 rounded-xl transition ${
                            veiculo.ativo !== false
                              ? 'bg-slate-800 hover:bg-amber-600 hover:text-white text-amber-400'
                              : 'bg-slate-800 hover:bg-emerald-600 hover:text-white text-emerald-400'
                          }`}
                          title={veiculo.ativo !== false ? 'Desativar veículo' : 'Reativar veículo'}
                        >
                          {veiculo.ativo !== false ? (
                            <PowerOff className="w-3.5 h-3.5" />
                          ) : (
                            <Power className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </>
                    )}

                    {podeExcluir && (
                      <button
                        type="button"
                        onClick={() => handleExcluirVeiculo(veiculo.id, veiculo.nome)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 hover:text-white text-rose-400 transition"
                        title="Excluir veículo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. CONTEÚDO DA ABA: INDICADORES (KPIs, Custo KM, Entregas)*/}
      {/* ======================================================== */}
      {activeTab === 'indicadores' && (
        <div className="space-y-6">
          {indicadores && (
            <>
              {/* KPI Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* KM Total Rodado */}
                <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-md">
                  <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mb-2">
                    <Gauge className="w-4 h-4 text-blue-400" />
                    <span>KM Total Rodado</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-white font-mono">
                    {indicadores.kmTotalRodado.toLocaleString('pt-BR')} km
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {indicadores.quantidadeSaidas} saídas registradas
                  </div>
                </div>

                {/* Total de Entregas */}
                <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-md">
                  <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mb-2">
                    <Layers className="w-4 h-4 text-sky-400" />
                    <span>Entregas Realizadas</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-white font-mono">
                    {indicadores.quantidadeEntregas}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Média {indicadores.mediaEntregasPorSaida} entregas / saída
                  </div>
                </div>

                {/* Valor Total das Notas */}
                <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-md">
                  <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mb-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <span>Valor Total das NFs</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono truncate">
                    {indicadores.valorTotalNotas.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Ticket médio:{' '}
                    {indicadores.ticketMedioPorEntrega.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </div>
                </div>

                {/* Custo por KM */}
                <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-md">
                  <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mb-2">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    <span>Custo por KM</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
                    {indicadores.custoPorKm.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}{' '}
                    <span className="text-xs text-slate-400 font-normal">/ km</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Total abastecido:{' '}
                    {indicadores.totalAbastecido.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </div>
                </div>
              </div>

              {/* Tabela de Desempenho por Veículo */}
              <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-400" />
                    <span>Desempenho por Veículo</span>
                  </h3>
                  <span className="text-xs text-slate-400">
                    {indicadores.resumoPorVeiculo.length} veículos analisados
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Veículo</th>
                        <th className="py-2.5 px-3">Placa</th>
                        <th className="py-2.5 px-3">Saídas</th>
                        <th className="py-2.5 px-3">KM Rodado</th>
                        <th className="py-2.5 px-3">Entregas</th>
                        <th className="py-2.5 px-3">Valor NFs</th>
                        <th className="py-2.5 px-3">Combustível</th>
                        <th className="py-2.5 px-3 text-right">Custo / KM</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {indicadores.resumoPorVeiculo.map((v) => (
                        <tr key={v.veiculoId} className="hover:bg-slate-800/30">
                          <td className="py-3 px-3 font-bold text-white">{v.veiculoNome}</td>
                          <td className="py-3 px-3 font-mono text-slate-400">{v.veiculoPlaca}</td>
                          <td className="py-3 px-3 font-mono text-slate-200">{v.saidas}</td>
                          <td className="py-3 px-3 font-mono text-emerald-400 font-bold">
                            {v.kmRodado.toLocaleString('pt-BR')} km
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-200">{v.entregas}</td>
                          <td className="py-3 px-3 font-mono text-emerald-400">
                            {v.valorNotas.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </td>
                          <td className="py-3 px-3 font-mono text-amber-300">
                            {v.abastecidoValor.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-amber-400">
                            {v.custoPorKm > 0
                              ? `${v.custoPorKm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/km`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tabela de Desempenho por Motorista */}
              <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-400" />
                    <span>Desempenho por Motorista</span>
                  </h3>
                  <span className="text-xs text-slate-400">
                    {indicadores.resumoPorMotorista.length} motoristas
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Motorista</th>
                        <th className="py-2.5 px-3">Saídas</th>
                        <th className="py-2.5 px-3">KM Rodado</th>
                        <th className="py-2.5 px-3">Entregas</th>
                        <th className="py-2.5 px-3">Valor Total NFs</th>
                        <th className="py-2.5 px-3 text-right">Abastecido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {indicadores.resumoPorMotorista.map((m) => (
                        <tr key={m.motoristaId} className="hover:bg-slate-800/30">
                          <td className="py-3 px-3 font-bold text-white">{m.motoristaNome}</td>
                          <td className="py-3 px-3 font-mono text-slate-200">{m.saidas}</td>
                          <td className="py-3 px-3 font-mono text-emerald-400 font-bold">
                            {m.kmRodado.toLocaleString('pt-BR')} km
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-200">{m.entregas}</td>
                          <td className="py-3 px-3 font-mono text-emerald-400">
                            {m.valorNotas.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-amber-300">
                            {m.abastecidoValor.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modais Operacionais */}
      <SaidaModal
        isOpen={modalSaidaOpen}
        onClose={() => {
          setModalSaidaOpen(false);
          setSaidaEmEdicao(null);
        }}
        onSave={handleSaveSaida}
        saidaParaEditar={saidaEmEdicao}
      />

      <DetalhesSaidaModal
        isOpen={Boolean(saidaParaDetalhes)}
        onClose={() => setSaidaParaDetalhes(null)}
        saida={saidaParaDetalhes}
      />

      <AbastecimentoModal
        isOpen={modalAbastecimentoOpen}
        onClose={() => {
          setModalAbastecimentoOpen(false);
          setAbastecimentoEmEdicao(null);
        }}
        onSave={handleSaveAbastecimento}
        abastecimentoParaEditar={abastecimentoEmEdicao}
      />

      <VeiculoModal
        isOpen={modalVeiculoOpen}
        onClose={() => {
          setModalVeiculoOpen(false);
          setVeiculoEmEdicao(null);
        }}
        onSave={handleSaveVeiculo}
        veiculoParaEditar={veiculoEmEdicao}
      />

      <SqlScriptVeiculosModal
        isOpen={modalSqlOpen}
        onClose={() => setModalSqlOpen(false)}
      />
    </div>
  );
};
