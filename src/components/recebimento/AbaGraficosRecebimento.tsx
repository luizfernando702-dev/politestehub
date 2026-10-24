import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Package,
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  RefreshCw,
  Loader2,
  Boxes,
  FileText,
  Filter,
  ArrowUpRight,
  ShieldAlert,
  Percent,
} from 'lucide-react';
import { MetricasRecebimento } from '../../types';
import { recebimentoService } from '../../services/recebimentoService';
import { useAuth } from '../../context/AuthContext';
import { canUserAccessGraficosRecebimento } from '../../lib/permissions';

export const AbaGraficosRecebimento: React.FC = () => {
  const { user } = useAuth();
  const podeAcessar = canUserAccessGraficosRecebimento(user);

  // Filtros de período e fornecedor
  const [diasPeriodo, setDiasPeriodo] = useState<number>(30);
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [isPeriodoCustomizado, setIsPeriodoCustomizado] = useState(false);
  const [filtroFornecedor, setFiltroFornecedor] = useState<string>('Todos');

  const [carregando, setCarregando] = useState(false);
  const [metricas, setMetricas] = useState<MetricasRecebimento | null>(null);

  const carregarMetricas = async () => {
    if (!podeAcessar) return;
    setCarregando(true);
    try {
      const dados = await recebimentoService.obterMetricasRecebimento({
        unidadeNegocio: user?.unidade_negocio,
        dias: isPeriodoCustomizado ? undefined : diasPeriodo,
        dataInicio: isPeriodoCustomizado && dataInicio ? dataInicio : undefined,
        dataFim: isPeriodoCustomizado && dataFim ? dataFim : undefined,
        fornecedor: filtroFornecedor !== 'Todos' ? filtroFornecedor : undefined,
      });
      setMetricas(dados);
    } catch (err) {
      console.warn('Erro ao carregar indicadores de recebimento:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (podeAcessar) {
      carregarMetricas();
    }
  }, [podeAcessar, diasPeriodo, isPeriodoCustomizado, dataInicio, dataFim, filtroFornecedor, user?.unidade_negocio]);

  if (!podeAcessar) {
    return (
      <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-amber-400 mx-auto" />
        <h3 className="text-base font-bold text-white">Acesso Restrito ao Painel Analítico</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          A visualização de gráficos e indicadores de recebimento é permitida apenas para usuários dos departamentos <strong>Comercial</strong> e <strong>Logística</strong>.
        </p>
      </div>
    );
  }

  const handleTrocarPeriodoPredefinido = (dias: number) => {
    setIsPeriodoCustomizado(false);
    setDiasPeriodo(dias);
    setDataInicio('');
    setDataFim('');
  };

  const totais = metricas?.totais;
  const semDados = !totais || (totais.totalNotas === 0 && totais.totalLinhasProdutos === 0);

  // Máximo para escala do gráfico diário
  const maxUnidadesDia = Math.max(
    1,
    ...(metricas?.volumePorDia.map((d) => d.totalUnidades) || [1])
  );
  const maxNotasDia = Math.max(
    1,
    ...(metricas?.volumePorDia.map((d) => d.totalNotas) || [1])
  );

  // Máximo para escala de fornecedores
  const maxUnidadesFornecedor = Math.max(
    1,
    ...(metricas?.recebimentosPorFornecedor.map((f) => f.totalUnidades) || [1])
  );

  // Máximo para escala de tempo de lead time
  const maxLeadTimeDias = Math.max(
    1,
    ...(metricas?.tempoRecebimentoPorFornecedor.map((t) => t.tempoMedioDias) || [1])
  );

  return (
    <div className="space-y-6">
      {/* 1. BARRA DE FILTROS SUPERIOR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <span>Painel Analítico de Recebimento & Cargas</span>
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Unidade:{' '}
            <strong className="text-slate-200">
              {user?.unidade_negocio || 'Goiânia'}
            </strong>{' '}
            &bull; Relacionamentos consolidados entre{' '}
            <code className="text-[11px] text-sky-400 font-mono">agendamentos</code> e{' '}
            <code className="text-[11px] text-emerald-400 font-mono">recebimentos_produtos</code>
          </p>
        </div>

        {/* Controles de Filtros */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor de Fornecedor */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-2xl border border-slate-800 text-xs">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-400 font-semibold whitespace-nowrap">Fornecedor:</span>
            <select
              value={filtroFornecedor}
              onChange={(e) => setFiltroFornecedor(e.target.value)}
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer max-w-[160px] truncate"
            >
              <option value="Todos" className="bg-slate-900 text-white">
                Todos ({metricas?.fornecedoresDisponiveis.length || 0})
              </option>
              {metricas?.fornecedoresDisponiveis.map((f) => (
                <option key={f} value={f} className="bg-slate-900 text-white truncate">
                  {f}
                </option>
              ))}
            </select>
          </div>

          {/* Botões Rápidos de Período */}
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
                onClick={() => handleTrocarPeriodoPredefinido(p.valor)}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                  !isPeriodoCustomizado && diasPeriodo === p.valor
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {p.rotulo}
              </button>
            ))}
          </div>

          {/* Intervalo Customizado */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-2xl border border-slate-800 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => {
                setDataInicio(e.target.value);
                setIsPeriodoCustomizado(true);
              }}
              className="bg-transparent text-white text-[11px] focus:outline-none cursor-pointer"
              title="Data inicial"
            />
            <span className="text-slate-600 font-bold">&rarr;</span>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => {
                setDataFim(e.target.value);
                setIsPeriodoCustomizado(true);
              }}
              className="bg-transparent text-white text-[11px] focus:outline-none cursor-pointer"
              title="Data final"
            />
          </div>

          {/* Botão Atualizar */}
          <button
            type="button"
            onClick={carregarMetricas}
            disabled={carregando}
            className="p-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
            title="Atualizar indicadores"
          >
            <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {carregando ? (
        <div className="p-16 text-center rounded-3xl bg-slate-900/60 border border-slate-800 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          <span className="text-xs font-semibold text-slate-300">
            Processando cruzamento analítico de agendamentos e recebimentos...
          </span>
          <span className="text-[11px] text-slate-500">
            Calculando médias diárias de SKUs, divergências e tempos médios de chegada.
          </span>
        </div>
      ) : semDados ? (
        <div className="p-16 text-center rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="w-14 h-14 rounded-3xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center mx-auto text-slate-500">
            <Package className="w-7 h-7" />
          </div>
          <h4 className="text-base font-bold text-white">Nenhum recebimento encontrado no período</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Não foram localizados produtos recebidos com os filtros aplicados na filial{' '}
            <strong className="text-slate-200">{user?.unidade_negocio || 'Goiânia'}</strong>.
            Tente selecionar um período mais abrangente (ex.: 90 dias ou Tudo) ou outro fornecedor.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => handleTrocarPeriodoPredefinido(90)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-600/30"
            >
              Expandir para últimos 90 dias
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 2. CARDS DE INDICADORES PRINCIPAIS (KPIs) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Tempo Médio Agendamento até Chegada */}
            <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-md space-y-2 hover:border-slate-700 transition">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold uppercase tracking-wider text-[11px]">Tempo Médio Chegada</span>
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white font-mono">
                  {totais.tempoMedioAgendamentoChegadaDias !== null
                    ? `${totais.tempoMedioAgendamentoChegadaDias}`
                    : '—'}
                </span>
                <span className="text-xs font-bold text-sky-400">
                  {totais.tempoMedioAgendamentoChegadaDias !== null ? 'dias' : 'Sem datas válidas'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                {totais.totalAgendamentosValidosTempo > 0
                  ? `Baseado em ${totais.totalAgendamentosValidosTempo} agendamento(s) com datas válidas.`
                  : 'Nenhum agendamento com data de inserção e entrega válidas.'}
              </p>
            </div>

            {/* KPI 2: Média de SKUs por Dia */}
            <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-md space-y-2 hover:border-slate-700 transition">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold uppercase tracking-wider text-[11px]">Média SKUs / Dia</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Boxes className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white font-mono">
                  {totais.mediaSkusPorDia}
                </span>
                <span className="text-xs font-bold text-emerald-400">produtos / dia</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                {totais.totalSkusDistintos} SKU(s) distintos em {totais.totalDiasComRecebimento} dia(s) com carga.
              </p>
            </div>

            {/* KPI 3: Volume Total Recebido */}
            <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-md space-y-2 hover:border-slate-700 transition">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold uppercase tracking-wider text-[11px]">Volume Total Físico</span>
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white font-mono">
                  {totais.totalUnidadesRecebidas.toLocaleString('pt-BR')}
                </span>
                <span className="text-xs font-bold text-purple-400">unidades</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                {totais.totalNotas} NF(s) &bull; {totais.totalLinhasProdutos} linha(s) de produtos.
              </p>
            </div>

            {/* KPI 4: Acurácia & Divergências */}
            <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-md space-y-2 hover:border-slate-700 transition">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold uppercase tracking-wider text-[11px]">Acurácia de Conferência</span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white font-mono">
                  {totais.taxaAcuraciaConferencia}%
                </span>
                <span className="text-xs font-bold text-amber-400">conforme</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                {totais.totalNotasComDivergencia > 0 ? (
                  <span className="text-rose-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    {totais.totalNotasComDivergencia} NF(s) com produto em crítica
                  </span>
                ) : (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    100% das notas sem divergência física
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* 3. GRÁFICO 1: EVOLUÇÃO DIÁRIA DE RECEBIMENTOS (NOTAS & UNIDADES) */}
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Volume de Recebimentos por Dia</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Evolução diária comparativa da quantidade de Notas Fiscais e unidades recebidas
                </p>
              </div>

              {/* Legenda */}
              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-3 h-3 rounded-md bg-emerald-500" />
                  <span>Unidades Físicas</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-3 h-3 rounded-md bg-sky-500" />
                  <span>Notas Fiscais</span>
                </div>
              </div>
            </div>

            {metricas.volumePorDia.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Sem movimentações diárias para exibir no período selecionado.
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {/* Visualizador de Barras Horizontais / Linhas Diárias */}
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {metricas.volumePorDia.map((dia) => {
                    const pctUnidades = Math.round((dia.totalUnidades / maxUnidadesDia) * 100);
                    const pctNotas = Math.round((dia.totalNotas / maxNotasDia) * 100);

                    return (
                      <div
                        key={dia.data}
                        className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-xs">
                              {dia.dataLabel}
                            </span>
                            <span className="text-slate-400 text-[11px]">
                              {dia.totalSkus} SKU(s) distintos &bull; {dia.totalItensLinhas} linhas
                            </span>
                          </div>

                          <div className="flex items-center gap-3 font-mono text-xs">
                            <span className="text-sky-300 font-bold">
                              {dia.totalNotas} {dia.totalNotas === 1 ? 'NF' : 'NFs'}
                            </span>
                            <span className="text-emerald-300 font-black">
                              {dia.totalUnidades.toLocaleString('pt-BR')} un.
                            </span>
                          </div>
                        </div>

                        {/* Barra Dupla Visual */}
                        <div className="space-y-1">
                          <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(4, pctUnidades)}%` }}
                              title={`${dia.totalUnidades} unidades recebidas`}
                            />
                          </div>
                          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden flex">
                            <div
                              className="h-full bg-sky-500 rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(4, pctNotas)}%` }}
                              title={`${dia.totalNotas} notas fiscais`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 4. DUAS COLUNAS: RANKINGS (FORNECEDORES & PRODUTOS) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* RANKING 1: Top 5 Fornecedores com Maior Volume */}
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    <span>Ranking de Fornecedores</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Até 5 fornecedores com maior volume de recebimentos
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                  Top 5
                </span>
              </div>

              {metricas.rankingFornecedores.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  Sem dados de fornecedores no período.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {metricas.rankingFornecedores.map((forn, idx) => (
                    <div
                      key={forn.fornecedor}
                      className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-3 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-xl flex items-center justify-center font-mono font-black text-xs shrink-0 ${
                            idx === 0
                              ? 'bg-amber-500 text-slate-950 shadow-sm'
                              : idx === 1
                              ? 'bg-slate-300 text-slate-950'
                              : idx === 2
                              ? 'bg-amber-700 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-white text-xs block truncate">
                            {forn.fornecedor}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {forn.totalNotas} {forn.totalNotas === 1 ? 'nota fiscal' : 'notas fiscais'} &bull;{' '}
                            {forn.totalUnidades.toLocaleString('pt-BR')} produtos recebidos
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-black text-emerald-400 text-sm block">
                          {forn.totalUnidades.toLocaleString('pt-BR')} un.
                        </span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                          Volume Total
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RANKING 2: Top 5 Produtos com Maior Quantidade Recebida */}
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Package className="w-4 h-4 text-purple-400" />
                    <span>Ranking de Produtos</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Até 5 produtos com maior quantidade física recebida
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/20">
                  Top 5
                </span>
              </div>

              {metricas.rankingProdutos.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  Sem dados de produtos no período.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {metricas.rankingProdutos.map((prod, idx) => (
                    <div
                      key={`${prod.codigo}-${idx}`}
                      className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-3 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-xl flex items-center justify-center font-mono font-black text-xs shrink-0 ${
                            idx === 0
                              ? 'bg-purple-500 text-white shadow-sm'
                              : idx === 1
                              ? 'bg-slate-300 text-slate-950'
                              : idx === 2
                              ? 'bg-purple-800 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-white text-xs block truncate" title={prod.descricao}>
                            {prod.descricao}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            Cód: <strong className="text-slate-300">{prod.codigo}</strong> &bull; {prod.totalNotas} NFs
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-black text-purple-300 text-sm block">
                          {prod.quantidadeTotal.toLocaleString('pt-BR')} un.
                        </span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                          Total Recebido
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 5. DUAS COLUNAS: COMPARAÇÃO POR FORNECEDOR E TEMPO DE RECEBIMENTO */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GRÁFICO 3: Recebimentos por Fornecedor (Comparativo de Unidades) */}
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-sky-400" />
                    <span>Recebimentos por Fornecedor</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Comparação da quantidade de unidades recebidas por fornecedor
                  </p>
                </div>
              </div>

              {metricas.recebimentosPorFornecedor.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  Sem dados de fornecedores no período.
                </div>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {metricas.recebimentosPorFornecedor.map((f) => {
                    const pctBarra = Math.round((f.totalUnidades / maxUnidadesFornecedor) * 100);

                    return (
                      <div key={f.fornecedor} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-200 truncate pr-2" title={f.fornecedor}>
                            {f.fornecedor}
                          </span>
                          <span className="font-mono text-slate-400 text-xs shrink-0">
                            <strong className="text-white">{f.totalUnidades.toLocaleString('pt-BR')} un.</strong>{' '}
                            <span className="text-sky-400">({f.percentualVolume}%)</span>
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-sky-600 to-sky-400 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(4, pctBarra)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* GRÁFICO 4: Tempo de Recebimento por Fornecedor (Lead Time Médio) */}
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>Tempo de Recebimento por Fornecedor</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Média de dias entre lançamento do agendamento e entrega física
                  </p>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  data_insercao &rarr; data_entrega
                </span>
              </div>

              {metricas.tempoRecebimentoPorFornecedor.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  Não há agendamentos com ambas as datas válidas no período para comparar tempo de fornecedores.
                </div>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {metricas.tempoRecebimentoPorFornecedor.map((t) => {
                    const pctTempo = Math.round((t.tempoMedioDias / maxLeadTimeDias) * 100);

                    return (
                      <div key={t.fornecedor} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-200 truncate pr-2" title={t.fornecedor}>
                            {t.fornecedor}
                          </span>
                          <span className="font-mono text-xs shrink-0 text-amber-300 font-bold">
                            {t.tempoMedioDias} {t.tempoMedioDias === 1 ? 'dia' : 'dias'}{' '}
                            <span className="text-slate-500 font-normal">
                              ({t.totalAgendamentosAvaliados} avaliações)
                            </span>
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(4, pctTempo)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 6. ANÁLISE QUALITATIVA: FORNECEDORES COM DIVERGÊNCIAS (CRÍTICA) */}
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Fornecedores com Divergências Apuradas</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Quantidade de notas fiscais com produtos registrados em situação de crítica na conferência cega
                </p>
              </div>

              {metricas.fornecedoresComDivergencias.length > 0 && (
                <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-3 py-1 rounded-xl border border-rose-500/30 self-start sm:self-auto">
                  {metricas.fornecedoresComDivergencias.length} fornecedor(es) com divergência
                </span>
              )}
            </div>

            {metricas.fornecedoresComDivergencias.length === 0 ? (
              <div className="p-8 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                <h5 className="text-xs font-bold text-emerald-300">
                  Nenhuma divergência registrada no período
                </h5>
                <p className="text-[11px] text-slate-400">
                  Todas as notas conferidas estão 100% conformes ou não há produtos registrados com status "Crítica".
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                      <th className="py-2.5 px-3">Fornecedor</th>
                      <th className="py-2.5 px-3 text-center">NFs com Crítica</th>
                      <th className="py-2.5 px-3 text-center">Itens Divergentes</th>
                      <th className="py-2.5 px-3 text-center">Total NFs</th>
                      <th className="py-2.5 px-3 text-right">Taxa de Crítica</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {metricas.fornecedoresComDivergencias.map((f) => (
                      <tr key={f.fornecedor} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-3 font-sans font-bold text-white">
                          {f.fornecedor}
                        </td>
                        <td className="py-3 px-3 text-center text-rose-400 font-bold">
                          {f.totalNotasComCritica}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-300">
                          {f.totalItensCriticos}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-400">
                          {f.totalNotasFornecedor}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                            {f.percentualCritica}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
