import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Package,
  Layers,
  RefreshCw,
  Building2,
  PieChart,
  Calendar,
  ShieldCheck,
  Ban,
  Lock,
} from 'lucide-react';
import { Usuario } from '../../types';
import { inventarioService, MetricasGraficosInventario } from '../../services/inventarioService';
import { getActiveUserUnit } from '../../services/sessionHelper';

interface GraficosInventarioViewProps {
  currentUser: Usuario | null;
  onVoltar: () => void;
}

export const GraficosInventarioView: React.FC<GraficosInventarioViewProps> = ({
  currentUser,
  onVoltar,
}) => {
  const [loading, setLoading] = useState(true);
  const [metricas, setMetricas] = useState<MetricasGraficosInventario | null>(null);
  const [contagensList, setContagensList] = useState<string[]>([]);
  const [filtroContagem, setFiltroContagem] = useState<string>('');

  const unidadeAtual = currentUser?.unidade_negocio || getActiveUserUnit() || 'Goiânia';

  const carregarMetricas = async () => {
    setLoading(true);
    try {
      const data = await inventarioService.obterMetricasGraficosInventario(
        unidadeAtual,
        filtroContagem || undefined
      );
      setMetricas(data);
      if (data.contagensDisponiveis && contagensList.length === 0) {
        setContagensList(data.contagensDisponiveis);
      }
    } catch (err) {
      console.error('Erro ao carregar métricas de inventário:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Carrega dados SOMENTE quando o componente é montado (quando o usuário abre o bloco)
    carregarMetricas();
  }, [unidadeAtual, filtroContagem]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24 md:pb-12 animate-in fade-in duration-200">
      {/* Alerta para dispositivos móveis / tablets: Oculto no desktop */}
      <div className="lg:hidden p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
        <div>
          <strong className="block font-bold">Módulo otimizado para Computador</strong>
          <span>A visualização de Gráficos e Indicadores foi projetada com layout amplo para telas desktop/PC.</span>
        </div>
      </div>

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onVoltar}
            className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title="Voltar ao menu do inventário"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
              <h1 className="text-xl sm:text-2xl font-black text-white">
                Gráficos e Indicadores de Inventário
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Acuracidade, volume de divergências e evolução de contagens por status &bull; Unidade: <strong className="text-white font-mono">{unidadeAtual}</strong>
            </p>
          </div>
        </div>

        {/* Filtros e Recarregar */}
        <div className="flex items-center gap-2.5">
          <select
            value={filtroContagem}
            onChange={(e) => setFiltroContagem(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-blue-500"
          >
            <option value="">Todas as Contagens</option>
            {contagensList.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={carregarMetricas}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title="Atualizar métricas"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-24 text-center text-slate-400 space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-400" />
          <p className="text-sm font-semibold">Calculando acuracidade e indicadores consolidados...</p>
        </div>
      ) : !metricas || metricas.totalItens === 0 ? (
        <div className="p-16 text-center rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
          <BarChart3 className="w-12 h-12 mx-auto text-slate-600" />
          <h3 className="text-base font-bold text-white">Sem dados de inventário para exibir</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Não há registros de contagem gravados para a unidade {unidadeAtual}. Inicie uma contagem ou importe uma planilha para visualizar os indicadores.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI CARDS PRINCIPAIS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Acuracidade Geral */}
            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Acuracidade</span>
                <span className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-black text-white font-mono">
                  {metricas.acuracidade.toFixed(1)}%
                </span>
                <p className="text-[11px] text-slate-400 mt-1">
                  {metricas.itensSemDivergencia} de {metricas.itensContados} itens contados 100% exatos
                </p>
              </div>
            </div>

            {/* Card 2: Total Itens */}
            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total de Itens</span>
                <span className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Layers className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-black text-white font-mono">
                  {metricas.totalItens}
                </span>
                <p className="text-[11px] text-slate-400 mt-1">
                  {metricas.itensContados} contados &bull; {metricas.itensPendentes} pendentes
                </p>
              </div>
            </div>

            {/* Card 3: Divergências de Falta */}
            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Falta (Negativa)</span>
                <span className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <AlertTriangle className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-black text-rose-400 font-mono">
                  {metricas.totalFaltas}
                </span>
                <p className="text-[11px] text-slate-400 mt-1">
                  Itens contados abaixo do estoque disponível
                </p>
              </div>
            </div>

            {/* Card 4: Divergências Sobressalentes */}
            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sobressalente</span>
                <span className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Package className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-black text-purple-400 font-mono">
                  {metricas.totalSobressalentes}
                </span>
                <p className="text-[11px] text-slate-400 mt-1">
                  Itens contados acima do estoque disponível
                </p>
              </div>
            </div>
          </div>

          {/* DISTRIBUIÇÃO POR STATUS & PROGRESSO */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Box 1: Distribuição por Novo Status */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-sky-400" />
                  Distribuição por Status de Inventário
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  {metricas.totalItens} total
                </span>
              </div>

              <div className="space-y-2.5">
                {[
                  { label: 'Pendente (não contado)', count: metricas.statusCount.pendente, color: 'bg-slate-600', text: 'text-slate-300' },
                  { label: 'Contada (1ª contagem)', count: metricas.statusCount.contada, color: 'bg-blue-500', text: 'text-blue-300' },
                  { label: 'Em Revisão (solicitada pelo Gestor)', count: metricas.statusCount.revisar, color: 'bg-amber-500', text: 'text-amber-300' },
                  { label: 'Revisada (2ª contagem realizada)', count: metricas.statusCount.revisada, color: 'bg-indigo-500', text: 'text-indigo-300' },
                  { label: 'Validada (divergência confirmada)', count: metricas.statusCount.validada, color: 'bg-emerald-500', text: 'text-emerald-300' },
                  { label: 'Bloqueada (fluxo de bloqueio)', count: metricas.statusCount.bloqueada, color: 'bg-rose-500', text: 'text-rose-300' },
                  { label: 'Invalidada (com justificativa)', count: metricas.statusCount.invalidada, color: 'bg-zinc-500', text: 'text-zinc-300' },
                ].map((s) => {
                  const perc = metricas.totalItens > 0 ? (s.count / metricas.totalItens) * 100 : 0;
                  return (
                    <div key={s.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className={s.text}>{s.label}</span>
                        <span className="font-mono text-slate-300">
                          <strong>{s.count}</strong> ({perc.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${s.color} transition-all duration-500`}
                          style={{ width: `${perc}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Box 2: Top Posições com Maior Divergência Absoluta */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Top Posições com Maior Divergência Física
                </h3>
                <span className="text-xs text-slate-400">Até 5 posições críticas</span>
              </div>

              {metricas.topDivergencias.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Nenhuma divergência apurada até o momento.
                </div>
              ) : (
                <div className="space-y-3">
                  {metricas.topDivergencias.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                            {item.endereco}
                          </span>
                          <span className="text-white font-semibold line-clamp-1 max-w-xs">
                            {item.produto}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Disponível: {item.qtd_disponivel} &bull; Contada: {item.qtd_contada}
                        </span>
                      </div>

                      <div className="text-right">
                        <span
                          className={`font-mono font-bold text-sm ${
                            item.diferenca < 0 ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {item.diferenca > 0 ? `+${item.diferenca}` : item.diferenca} un
                        </span>
                        <span className="block text-[10px] uppercase font-bold text-slate-500">
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
