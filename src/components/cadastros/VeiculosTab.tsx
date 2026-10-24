import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Plus,
  Search,
  Building2,
  Edit2,
  Trash2,
  Power,
  PowerOff,
  RefreshCw,
  Shield,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { Veiculo, Usuario, UnidadeNegocio } from '../../types';
import { veiculosService } from '../../services/veiculosService';
import { unidadesNegocioService } from '../../services/unidadesNegocioService';
import { UNIDADES_NEGOCIO_PADRAO } from '../../constants/unidades';
import { VeiculoModal } from '../veiculos/VeiculoModal';

interface VeiculosTabProps {
  currentUser: Usuario | null;
  isGestor: boolean;
}

export const VeiculosTab: React.FC<VeiculosTabProps> = ({ currentUser, isGestor }) => {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [unidadesList, setUnidadesList] = useState<UnidadeNegocio[]>([]);
  const [search, setSearch] = useState('');
  const [unidadeFiltro, setUnidadeFiltro] = useState<string>('todas');
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'ativos' | 'inativos'>('todos');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal de cadastro/edição
  const [modalOpen, setModalOpen] = useState(false);
  const [veiculoParaEditar, setVeiculoParaEditar] = useState<Veiculo | null>(null);

  // Feedback
  const [feedback, setFeedback] = useState<{ message: string; isError?: boolean } | null>(null);

  const showFeedback = (message: string, isError = false) => {
    setFeedback({ message, isError });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Carrega as unidades de negócio da tabela Supabase "unidades_negocio"
  const carregarUnidades = async () => {
    try {
      const lista = await unidadesNegocioService.listarAtivas();
      if (lista && lista.length > 0) {
        setUnidadesList(lista);
      } else {
        setUnidadesList(
          UNIDADES_NEGOCIO_PADRAO.map((u) => ({
            id: u.id,
            nome: u.nome,
            sigla: u.sigla,
            ativo: true,
          }))
        );
      }
    } catch (err) {
      console.warn('Erro ao carregar unidades em VeiculosTab:', err);
      setUnidadesList(
        UNIDADES_NEGOCIO_PADRAO.map((u) => ({
          id: u.id,
          nome: u.nome,
          sigla: u.sigla,
          ativo: true,
        }))
      );
    }
  };

  // Carrega lista de veículos
  const carregarVeiculos = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);

    try {
      const dados = await veiculosService.listarVeiculos({
        unidade_negocio: unidadeFiltro !== 'todas' ? unidadeFiltro : undefined,
        apenasAtivos: false,
      });
      setVeiculos(dados);
    } catch (err) {
      console.warn('Erro ao carregar veículos:', err);
      showFeedback('Não foi possível carregar os veículos.', true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    carregarUnidades();
  }, []);

  useEffect(() => {
    carregarVeiculos(false);
  }, [unidadeFiltro]);

  // Filtragem local
  const veiculosFiltrados = useMemo(() => {
    let result = veiculos;

    if (unidadeFiltro !== 'todas') {
      result = result.filter(
        (v) => v.unidade_negocio?.toLowerCase() === unidadeFiltro.toLowerCase()
      );
    }

    if (statusFiltro === 'ativos') {
      result = result.filter((v) => v.ativo !== false);
    } else if (statusFiltro === 'inativos') {
      result = result.filter((v) => v.ativo === false);
    }

    if (search.trim()) {
      const termo = search.toLowerCase().trim();
      result = result.filter(
        (v) =>
          v.nome.toLowerCase().includes(termo) ||
          v.placa.toLowerCase().includes(termo) ||
          v.marca.toLowerCase().includes(termo)
      );
    }

    return result;
  }, [veiculos, unidadeFiltro, statusFiltro, search]);

  const handleOpenCreate = () => {
    setVeiculoParaEditar(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (v: Veiculo) => {
    setVeiculoParaEditar(v);
    setModalOpen(true);
  };

  const handleSaveVeiculo = async (dados: any) => {
    await veiculosService.salvarVeiculo(dados);
    showFeedback(dados.id ? 'Veículo atualizado com sucesso!' : 'Veículo cadastrado com sucesso!');
    carregarVeiculos(true);
  };

  const handleToggleStatus = async (v: Veiculo) => {
    const novoStatus = !v.ativo;
    const confirmMsg = novoStatus
      ? `Reativar o veículo ${v.nome} (${v.placa})?`
      : `Desativar o veículo ${v.nome} (${v.placa})? O histórico de saídas e abastecimentos será mantido no sistema.`;

    if (window.confirm(confirmMsg)) {
      try {
        await veiculosService.alternarStatusVeiculo(v.id, novoStatus);
        showFeedback(`Veículo ${v.nome} ${novoStatus ? 'ativado' : 'desativado'}.`);
        carregarVeiculos(true);
      } catch (err: any) {
        showFeedback(err?.message || 'Falha ao alterar status do veículo.', true);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback Toast */}
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

      {/* Top Controls: Search, Filters and New Vehicle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              id="input-busca-veiculos"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por veículo, placa ou marca..."
              className="w-full pl-10 pr-3 py-2.5 bg-slate-900 border border-slate-700/80 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* Filtro por Unidade de Negócio do Supabase */}
          <div className="relative min-w-[160px]">
            <select
              id="select-filtro-unidade-veiculo"
              value={unidadeFiltro}
              onChange={(e) => setUnidadeFiltro(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700/80 rounded-2xl text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="todas">Todas as Unidades</option>
              {unidadesList.map((u) => (
                <option key={u.id} value={u.nome}>
                  {u.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Status */}
          <select
            id="select-filtro-status-veiculo"
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value as any)}
            className="px-3 py-2.5 bg-slate-900 border border-slate-700/80 rounded-2xl text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="todos">Todos os Status</option>
            <option value="ativos">Apenas Ativos</option>
            <option value="inativos">Apenas Desativados</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => carregarVeiculos(true)}
            disabled={refreshing || loading}
            className="p-2.5 rounded-2xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 hover:text-white transition"
            title="Recarregar veículos"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          {isGestor && (
            <button
              type="button"
              id="btn-cadastrar-veiculo-tab"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/25 transition active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Veículo</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid de Veículos */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 bg-slate-900/60 rounded-3xl border border-slate-800">
          <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-blue-400" />
          <p className="text-sm font-semibold text-white">Carregando frota de veículos...</p>
        </div>
      ) : veiculosFiltrados.length === 0 ? (
        <div className="py-16 px-6 text-center bg-slate-900/60 rounded-3xl border border-slate-800">
          <div className="w-14 h-14 rounded-3xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-500 mx-auto mb-3">
            <Truck className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-white">Nenhum veículo encontrado</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            {search || unidadeFiltro !== 'todas' || statusFiltro !== 'todos'
              ? 'Nenhum veículo corresponde aos filtros selecionados. Tente ajustar os parâmetros.'
              : 'Cadastre os veículos da frota para controlar saídas, entregas e abastecimentos por unidade.'}
          </p>
          {isGestor && !search && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/25"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Primeiro Veículo</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {veiculosFiltrados.map((veiculo) => (
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

                {isGestor && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(veiculo)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-blue-600 hover:text-white text-blue-400 transition"
                      title="Editar cadastro do veículo"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleStatus(veiculo)}
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
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Veículo */}
      <VeiculoModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setVeiculoParaEditar(null);
        }}
        onSave={handleSaveVeiculo}
        veiculoParaEditar={veiculoParaEditar}
      />
    </div>
  );
};
