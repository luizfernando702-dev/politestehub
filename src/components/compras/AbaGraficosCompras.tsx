import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Package,
  Layers,
  Flame,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  RefreshCw,
  Loader2,
  ShoppingBag,
  ShieldCheck,
  Percent,
} from 'lucide-react';
import { MetricasCompras } from '../../types';
import { comprasService } from '../../services/comprasService';
import { useAuth } from '../../context/AuthContext';

export const AbaGraficosCompras: React.FC = () => {
  const { user } = useAuth();
  const [diasPeriodo, setDiasPeriodo] = useState<number>(30);
  const [carregando, setCarregando] = useState(false);
  const [metricas, setMetricas] = useState<MetricasCompras>({
    total: 0,
    solicitados: 0,
    aprovados: 0,
    comprados: 0,
    urgentes: 0,
    rapidas: 0,
    medias: 0,
    porDemanda: {
      necessidade: 0,
      estoque: 0,
      compras: 0,
    },
    totalItensQuantidade: 0,
    topFabricantes: [],
    topProdutos: [],
  });

  const carregarMetricas = async () => {
    setCarregando(true);
    try {
      const dados = await comprasService.obterMetricas(user?.unidade_negocio, diasPeriodo);
      setMetricas(dados);
    } catch (err) {
      console.warn('Erro ao carregar indicadores de compras:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarMetricas();
  }, [diasPeriodo, user?.unidade_negocio]);

  const taxaAprovacao =
    metricas.total > 0
      ? Math.round(((metricas.aprovados + metricas.comprados) / metricas.total) * 100)
      : 0;

  const taxaConclusao =
    metricas.total > 0 ? Math.round((metricas.comprados / metricas.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Barra de Filtro de Período e Atualizar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl bg-slate-900/90 border border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span>Painel de Estatísticas e Indicadores de Compras</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Métricas analíticas consolidadas para a unidade{' '}
            <strong className="text-slate-200">{user?.unidade_negocio || 'Goiânia'}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs">
            {[
              { rotulo: '7 dias', valor: 7 },
              { rotulo: '30 dias', valor: 30 },
              { rotulo: '90 dias', valor: 90 },
              { rotulo: 'Tudo', valor: 0 },
            ].map((p) => (
              <button
                key={p.valor}
                type="button"
                onClick={() => setDiasPeriodo(p.valor)}
                className={`px-3 py-1.5 rounded-xl font-bold transition ${
                  diasPeriodo === p.valor
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {p.rotulo}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={carregarMetricas}
            disabled={carregando}
            className="p-2.5 rounded-2xl border border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white transition"
            title="Atualizar estatísticas"
          >
            <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Solicitações */}
        <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Solicitações</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono">{metricas.total}</span>
            <span className="text-[11px] text-slate-400 block mt-1">
              {metricas.totalItensQuantidade} itens solicitados
            </span>
          </div>
        </div>

        {/* Aguardando Aprovação */}
        <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-300">Aguardando Gestor</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-amber-300 font-mono">
              {metricas.solicitados}
            </span>
            <span className="text-[11px] text-amber-400/80 block mt-1">
              Status "Solicitado"
            </span>
          </div>
        </div>

        {/* Aprovadas & Compradas */}
        <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-300">Concluídas / Compradas</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-emerald-300 font-mono">
              {metricas.comprados}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1">
              +{metricas.aprovados} aprovadas em cotação
            </span>
          </div>
        </div>

        {/* Urgentes no Momento */}
        <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-300">Urgentes / Críticas</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <Flame className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-rose-400 font-mono">
              {metricas.urgentes}
            </span>
            <span className="text-[11px] text-rose-400/80 block mt-1">
              Prioridade máxima imediata
            </span>
          </div>
        </div>
      </div>

      {/* Grid de Gráficos e Distribuições */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. DISTRIBUIÇÃO POR STATUS */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <span>Distribuição por Status</span>
          </h4>

          <div className="space-y-3">
            {/* Solicitado */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-amber-300 font-semibold">Solicitado</span>
                <span className="font-mono text-slate-300">
                  {metricas.solicitados}{' '}
                  <span className="text-slate-500">
                    ({metricas.total > 0 ? Math.round((metricas.solicitados / metricas.total) * 100) : 0}%)
                  </span>
                </span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-500"
                  style={{
                    width: `${metricas.total > 0 ? (metricas.solicitados / metricas.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Aprovado */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-blue-300 font-semibold">Aprovado</span>
                <span className="font-mono text-slate-300">
                  {metricas.aprovados}{' '}
                  <span className="text-slate-500">
                    ({metricas.total > 0 ? Math.round((metricas.aprovados / metricas.total) * 100) : 0}%)
                  </span>
                </span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${metricas.total > 0 ? (metricas.aprovados / metricas.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Comprado */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-emerald-300 font-semibold">Comprado</span>
                <span className="font-mono text-slate-300">
                  {metricas.comprados}{' '}
                  <span className="text-slate-500">
                    ({metricas.total > 0 ? Math.round((metricas.comprados / metricas.total) * 100) : 0}%)
                  </span>
                </span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${metricas.total > 0 ? (metricas.comprados / metricas.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Taxa de Aprovação:</span>
            <span className="font-mono font-bold text-white">{taxaAprovacao}%</span>
          </div>
        </div>

        {/* 2. DISTRIBUIÇÃO POR URGÊNCIA */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <span>Nível de Urgência</span>
          </h4>

          <div className="space-y-3">
            {/* Urgente */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-rose-400 font-semibold flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5" /> Urgente
                </span>
                <span className="font-mono text-slate-300">
                  {metricas.urgentes}{' '}
                  <span className="text-slate-500">
                    ({metricas.total > 0 ? Math.round((metricas.urgentes / metricas.total) * 100) : 0}%)
                  </span>
                </span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${metricas.total > 0 ? (metricas.urgentes / metricas.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Rápida */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-amber-300 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Rápida
                </span>
                <span className="font-mono text-slate-300">
                  {metricas.rapidas}{' '}
                  <span className="text-slate-500">
                    ({metricas.total > 0 ? Math.round((metricas.rapidas / metricas.total) * 100) : 0}%)
                  </span>
                </span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-500"
                  style={{
                    width: `${metricas.total > 0 ? (metricas.rapidas / metricas.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Média */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300 font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Média
                </span>
                <span className="font-mono text-slate-300">
                  {metricas.medias}{' '}
                  <span className="text-slate-500">
                    ({metricas.total > 0 ? Math.round((metricas.medias / metricas.total) * 100) : 0}%)
                  </span>
                </span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${metricas.total > 0 ? (metricas.medias / metricas.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Criticidade Alta (Urgente):</span>
            <span className="font-mono font-bold text-rose-400">
              {metricas.total > 0 ? Math.round((metricas.urgentes / metricas.total) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* 3. DISTRIBUIÇÃO POR DEMANDA */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <span>Motivo da Demanda</span>
          </h4>

          <div className="space-y-3">
            {/* Estoque */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-sky-300 font-semibold">Estoque (Reposição)</span>
                <span className="font-mono text-slate-300">{metricas.porDemanda.estoque}</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${metricas.total > 0 ? (metricas.porDemanda.estoque / metricas.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Sob Encomenda */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-purple-300 font-semibold">Sob Encomenda (Cliente)</span>
                <span className="font-mono text-slate-300">{metricas.porDemanda.sobEncomenda}</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${metricas.total > 0 ? (metricas.porDemanda.sobEncomenda / metricas.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Consumos */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-teal-300 font-semibold">Consumos (Uso Interno)</span>
                <span className="font-mono text-slate-300">{metricas.porDemanda.consumos}</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${metricas.total > 0 ? (metricas.porDemanda.consumos / metricas.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Maior Demanda:</span>
            <span className="font-bold text-white">
              {metricas.porDemanda.estoque >= metricas.porDemanda.sobEncomenda &&
              metricas.porDemanda.estoque >= metricas.porDemanda.consumos
                ? 'Estoque'
                : metricas.porDemanda.sobEncomenda >= metricas.porDemanda.consumos
                ? 'Sob Encomenda'
                : 'Consumos'}
            </span>
          </div>
        </div>
      </div>

      {/* Rankings: Top Fabricantes e Top Produtos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ranking de Fabricantes */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span>Top Fabricantes Mais Solicitados</span>
            </h4>
            <span className="text-[11px] text-slate-400">Por volume</span>
          </div>

          {metricas.topFabricantes.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Sem dados suficientes no período.
            </div>
          ) : (
            <div className="space-y-2.5">
              {metricas.topFabricantes.map((fab, idx) => (
                <div
                  key={fab.fabricante}
                  className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800/80 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5 truncate pr-2">
                    <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-bold shrink-0">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-white truncate">{fab.fabricante}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                      {fab.quantidade} un.
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {fab.totalSolicitacoes} {fab.totalSolicitacoes === 1 ? 'pedido' : 'pedidos'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ranking de Produtos */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-400" />
              <span>Top Produtos Mais Demandados</span>
            </h4>
            <span className="text-[11px] text-slate-400">Por unidades</span>
          </div>

          {metricas.topProdutos.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Sem dados suficientes no período.
            </div>
          ) : (
            <div className="space-y-2.5">
              {metricas.topProdutos.map((prod, idx) => (
                <div
                  key={prod.produto + idx}
                  className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800/80 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5 truncate pr-2">
                    <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-bold shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="truncate">
                      <span className="text-xs font-semibold text-white truncate block">
                        {prod.produto}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate block">
                        {prod.fabricante}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-blue-400 font-mono">
                      {prod.quantidadeTotal} un.
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {prod.totalSolicitacoes} {prod.totalSolicitacoes === 1 ? 'solicitação' : 'solicitações'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
