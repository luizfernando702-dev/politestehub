import React, { useState, useEffect } from 'react';
import {
  Boxes,
  SquareCheck,
  Truck,
  Users,
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  Clock,
  Building2,
  Package,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { coletasService, IndicadoresColetasResultado } from '../../services/coletasService';

interface GraficosDadosTabProps {
  unidadeNegocio: string;
}

// Paleta de cores para os gráficos de colaboradores
const PALETA_CORES = [
  { fill: '#2563eb', stroke: '#1d4ed8', bg: 'bg-[#2563eb]', text: 'text-[#2563eb]' }, // Azul Royal
  { fill: '#f97316', stroke: '#ea580c', bg: 'bg-[#f97316]', text: 'text-[#f97316]' }, // Laranja Vibrante
  { fill: '#10b981', stroke: '#059669', bg: 'bg-[#10b981]', text: 'text-[#10b981]' }, // Verde Esmeralda
  { fill: '#8b5cf6', stroke: '#7c3aed', bg: 'bg-[#8b5cf6]', text: 'text-[#8b5cf6]' }, // Roxo
  { fill: '#06b6d4', stroke: '#0891b2', bg: 'bg-[#06b6d4]', text: 'text-[#06b6d4]' }, // Ciano
  { fill: '#ec4899', stroke: '#db2777', bg: 'bg-[#ec4899]', text: 'text-[#ec4899]' }, // Rosa
  { fill: '#eab308', stroke: '#ca8a04', bg: 'bg-[#eab308]', text: 'text-[#eab308]' }, // Âmbar
];

export const GraficosDadosTab: React.FC<GraficosDadosTabProps> = ({ unidadeNegocio }) => {
  const [periodo, setPeriodo] = useState<'hoje' | '7dias' | '30dias' | 'todos'>('todos');
  const [processo, setProcesso] = useState<'separacao' | 'conferencia' | 'status'>('separacao');
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState<IndicadoresColetasResultado | null>(null);

  const carregarKpis = async () => {
    setLoading(true);
    try {
      let dataInicio: string | undefined;
      const agora = new Date();

      if (periodo === 'hoje') {
        dataInicio = agora.toISOString().split('T')[0];
      } else if (periodo === '7dias') {
        const d = new Date(agora.getTime() - 7 * 86400 * 1000);
        dataInicio = d.toISOString().split('T')[0];
      } else if (periodo === '30dias') {
        const d = new Date(agora.getTime() - 30 * 86400 * 1000);
        dataInicio = d.toISOString().split('T')[0];
      }

      const resultado = await coletasService.calcularIndicadoresColetas({
        unidade_negocio: unidadeNegocio,
        dataInicio,
      });

      setDados(resultado);
    } catch (err) {
      console.warn('Erro ao calcular KPIs de coletas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarKpis();
  }, [unidadeNegocio, periodo]);

  if (loading || !dados) {
    return (
      <div className="p-16 text-center text-slate-400 bg-slate-900/40 rounded-3xl border border-slate-800">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-3" />
        <p className="text-sm font-semibold">Carregando métricas e gráficos das coletas...</p>
      </div>
    );
  }

  // Lista de colaboradores do processo ativo (Separação ou Conferência)
  const isSeparacao = processo === 'separacao';
  const isConferencia = processo === 'conferencia';
  const listaColaboradores = isSeparacao
    ? dados.produtividadeSeparadores
    : isConferencia
    ? dados.produtividadeConferentes
    : [];

  const totalColetas = dados.totalColetas || 0;
  const totalItens = dados.totalItens || 0;
  const totalColetadas = dados.totalColetadas || 0;
  const taxaConclusao = dados.taxaConclusao || 0;

  // Texto dos colaboradores ativos
  const nomesColaboradores = listaColaboradores.map((c) => c.nome);
  let textoColaboradores = '';
  if (nomesColaboradores.length === 1) {
    textoColaboradores = `(${nomesColaboradores[0]})`;
  } else if (nomesColaboradores.length === 2) {
    textoColaboradores = `(${nomesColaboradores[0]} e ${nomesColaboradores[1]})`;
  } else if (nomesColaboradores.length > 2) {
    const ult = nomesColaboradores[nomesColaboradores.length - 1];
    const anteriores = nomesColaboradores.slice(0, nomesColaboradores.length - 1).join(', ');
    textoColaboradores = `(${anteriores} e ${ult})`;
  } else {
    textoColaboradores = '(Nenhum no período)';
  }

  // Preparação de dados para Gráfico de Colunas SVG (Volume de itens e coletas por colaborador)
  const maxItensColaborador = Math.max(
    ...listaColaboradores.map((c) => Number(c.itens) || 0),
    10
  );
  const tetoEixoY = Math.max(Math.ceil((maxItensColaborador * 1.2) / 10) * 10, 20);
  const marcasEixoY = [
    tetoEixoY,
    Math.round(tetoEixoY * 0.75),
    Math.round(tetoEixoY * 0.5),
    Math.round(tetoEixoY * 0.25),
    0,
  ];

  // Preparação dos dados para o Gráfico de Pizza SVG (Participação percentual de itens)
  const totalItensColaboradores = listaColaboradores.reduce(
    (sum, c) => sum + (Number(c.itens) || 0),
    0
  );
  const totalBasePizza = totalItensColaboradores > 0 ? totalItensColaboradores : totalItens;

  let acumuladorGraus = 0;
  const fatiasPizza = listaColaboradores.map((colab, idx) => {
    const qtd = Number(colab.itens) || 0;
    const porcentagem = totalBasePizza > 0 ? (qtd / totalBasePizza) * 100 : 0;
    const angulo = totalBasePizza > 0 ? (qtd / totalBasePizza) * 360 : 0;

    const startAngle = acumuladorGraus;
    const endAngle = acumuladorGraus + angulo;
    acumuladorGraus = endAngle;

    const cx = 100;
    const cy = 100;
    const r = 85;

    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((endAngle - 90) * Math.PI) / 180;

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);

    const largeArcFlag = angulo > 180 ? 1 : 0;

    const midAngle = startAngle + angulo / 2;
    const midRad = ((midAngle - 90) * Math.PI) / 180;
    const tx = cx + (r * 0.62) * Math.cos(midRad);
    const ty = cy + (r * 0.62) * Math.sin(midRad);

    const pathData =
      angulo >= 359.99
        ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
        : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

    const cor = PALETA_CORES[idx % PALETA_CORES.length];

    return {
      ...colab,
      pathData,
      porcentagem,
      tx,
      ty,
      cor,
      idx,
    };
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* 1. BARRA SUPERIOR: CONTROLES DE PROCESSO E PERÍODO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg">
        {/* Alternância de Áreas de Análise */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
            Área de Análise:
          </span>
          <div className="inline-flex p-1 rounded-2xl bg-slate-950 border border-slate-800 flex-wrap gap-1">
            <button
              type="button"
              id="btn-processo-separacao"
              onClick={() => setProcesso('separacao')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition min-h-[38px] ${
                processo === 'separacao'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Separação</span>
            </button>

            <button
              type="button"
              id="btn-processo-conferencia"
              onClick={() => setProcesso('conferencia')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition min-h-[38px] ${
                processo === 'conferencia'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <SquareCheck className="w-3.5 h-3.5" />
              <span>Conferência</span>
            </button>

            <button
              type="button"
              id="btn-processo-status"
              onClick={() => setProcesso('status')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition min-h-[38px] ${
                processo === 'status'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Status das Coletas</span>
            </button>
          </div>
        </div>

        {/* Filtros de Período */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs self-start md:self-auto">
          {[
            { id: 'hoje', label: 'Hoje' },
            { id: '7dias', label: 'Últimos 7 dias' },
            { id: '30dias', label: 'Últimos 30 dias' },
            { id: 'todos', label: 'Todo o Período' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPeriodo(item.id as any)}
              className={`px-3 py-1.5 rounded-xl font-bold transition text-[11px] ${
                periodo === item.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={carregarKpis}
            title="Atualizar dados"
            className="p-1.5 rounded-xl text-slate-400 hover:text-white transition ml-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. OS 4 CARDS OPERACIONAIS DE ALTO IMPACTO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: Total de Coletas */}
        <div className="rounded-2xl border border-blue-400/40 bg-gradient-to-br from-blue-50/90 to-white dark:from-slate-900 dark:to-slate-950 dark:border-blue-500/40 p-5 shadow-sm flex items-start gap-4">
          <div className="w-13 h-13 rounded-2xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 p-2.5">
            <Truck className="w-8 h-8" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-blue-900 dark:text-blue-300 tracking-tight">
              Total de Coletas
            </h3>
            <div className="text-3xl sm:text-4xl font-black text-blue-950 dark:text-white tracking-tight font-mono mt-1">
              {totalColetas}
            </div>
            <p className="text-[11px] text-blue-800/80 dark:text-blue-400/90 font-medium mt-0.5">
              Expedição {unidadeNegocio}
            </p>
          </div>
        </div>

        {/* CARD 2: Total de Itens (Quantidade) */}
        <div className="rounded-2xl border border-emerald-400/40 bg-gradient-to-br from-emerald-50/90 to-white dark:from-slate-900 dark:to-slate-950 dark:border-emerald-500/40 p-5 shadow-sm flex items-start gap-4">
          <div className="w-13 h-13 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 p-2.5">
            <Package className="w-8 h-8" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-300 tracking-tight leading-snug">
              Total de Itens
              <span className="block text-xs font-semibold text-emerald-800/80 dark:text-emerald-400/90">
                (Quantidade)
              </span>
            </h3>
            <div className="text-3xl sm:text-4xl font-black text-emerald-950 dark:text-white tracking-tight font-mono mt-1">
              {totalItens}
            </div>
          </div>
        </div>

        {/* CARD 3: Coletas Concluídas (Taxa de Conclusão) */}
        <div className="rounded-2xl border border-sky-400/40 bg-gradient-to-br from-sky-50/90 to-white dark:from-slate-900 dark:to-slate-950 dark:border-sky-500/40 p-5 shadow-sm flex items-start gap-4">
          <div className="w-13 h-13 rounded-2xl bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 p-2.5">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-sky-900 dark:text-sky-300 tracking-tight leading-snug">
              Coletas Concluídas
              <span className="block text-xs font-semibold text-sky-800/80 dark:text-sky-400/90">
                (Taxa de Sucesso)
              </span>
            </h3>
            <div className="text-3xl sm:text-4xl font-black text-sky-950 dark:text-white tracking-tight font-mono mt-1">
              {taxaConclusao}%
            </div>
            <p className="text-[11px] text-sky-800/80 dark:text-sky-300 font-medium mt-0.5">
              {totalColetadas} de {totalColetas} coletadas
            </p>
          </div>
        </div>

        {/* CARD 4: Colaboradores Ativos */}
        <div className="rounded-2xl border border-purple-400/40 bg-gradient-to-br from-purple-50/90 to-white dark:from-slate-900 dark:to-slate-950 dark:border-purple-500/40 p-5 shadow-sm flex items-start gap-4">
          <div className="w-13 h-13 rounded-2xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 p-2.5">
            <Users className="w-8 h-8" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-purple-900 dark:text-purple-300 tracking-tight">
              {isSeparacao ? 'Separadores Ativos' : isConferencia ? 'Conferentes Ativos' : 'Equipe da Expedição'}
            </h3>
            <div className="text-3xl sm:text-4xl font-black text-purple-950 dark:text-white tracking-tight font-mono mt-0.5">
              {listaColaboradores.length}
            </div>
            <p className="text-[11px] font-medium text-purple-800/80 dark:text-purple-300/80 truncate mt-0.5" title={textoColaboradores}>
              {textoColaboradores}
            </p>
          </div>
        </div>
      </div>

      {/* 3. CONTEÚDO ESPECÍFICO CONFORME ÁREA SELECIONADA */}

      {/* A & B. GRÁFICOS DE SEPARAÇÃO OU CONFERÊNCIA */}
      {(isSeparacao || isConferencia) && (
        <div className="space-y-6">
          {listaColaboradores.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white/50 dark:bg-slate-900/60 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
              <Users className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-base font-bold text-slate-800 dark:text-white">
                Nenhum apontamento de {isSeparacao ? 'separador' : 'conferente'} encontrado
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Para visualizar a produtividade, selecione o {isSeparacao ? 'Separador' : 'Conferente'} no formulário de cadastro ou edição de coletas.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                {/* GRÁFICO ESQUERDA: Produtividade por Colaborador (Quantidade Total de Itens e Coletas) */}
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-blue-950 dark:text-white tracking-tight">
                      Volume por {isSeparacao ? 'Separador' : 'Conferente'}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                      Quantidade total de itens movimentados por colaborador
                    </p>
                  </div>

                  {/* Gráfico de Barras Verticais */}
                  <div className="my-4">
                    <svg
                      viewBox="0 0 500 240"
                      className="w-full h-56 sm:h-64 overflow-visible"
                    >
                      {/* Linhas de Grade e Eixo Y */}
                      {marcasEixoY.map((valorMarca, idx) => {
                        const y = 30 + (idx / (marcasEixoY.length - 1)) * 160;
                        return (
                          <g key={idx}>
                            <text
                              x="32"
                              y={y + 4}
                              textAnchor="end"
                              className="text-[11px] font-bold fill-slate-500 dark:fill-slate-400 font-mono"
                            >
                              {valorMarca}
                            </text>
                            <line
                              x1="45"
                              y1={y}
                              x2="480"
                              y2={y}
                              stroke="currentColor"
                              className="text-slate-200 dark:text-slate-800"
                              strokeWidth="1"
                              strokeDasharray={idx === marcasEixoY.length - 1 ? 'none' : '2,2'}
                            />
                          </g>
                        );
                      })}

                      {/* Eixo Y Linha Vertical */}
                      <line
                        x1="45"
                        y1="25"
                        x2="45"
                        y2="190"
                        stroke="currentColor"
                        className="text-slate-300 dark:text-slate-700"
                        strokeWidth="1.5"
                      />

                      {/* Barras Verticais dos Colaboradores */}
                      {listaColaboradores.map((colab, idx) => {
                        const itens = Number(colab.itens) || 0;
                        const alturaMaxGrafico = 160;
                        const alturaBarra = tetoEixoY > 0 ? (itens / tetoEixoY) * alturaMaxGrafico : 0;
                        const yBase = 190;
                        const yTopo = yBase - alturaBarra;

                        const totalColabs = listaColaboradores.length;
                        const espacoDisponivel = 430;
                        const larguraBarra = Math.min(espacoDisponivel / (totalColabs * 1.8), 75);
                        const passo = espacoDisponivel / totalColabs;
                        const xCentro = 45 + passo * (idx + 0.5);
                        const xBarra = xCentro - larguraBarra / 2;

                        const corBarra = PALETA_CORES[idx % PALETA_CORES.length].fill;

                        return (
                          <g key={idx} className="group cursor-pointer">
                            {/* Valor de itens em cima da barra */}
                            <text
                              x={xCentro}
                              y={Math.max(yTopo - 8, 20)}
                              textAnchor="middle"
                              className="text-[12px] font-black fill-blue-950 dark:fill-white font-mono"
                            >
                              {itens}
                            </text>

                            {/* Coluna / Barra Retangular */}
                            <rect
                              x={xBarra}
                              y={yTopo}
                              width={larguraBarra}
                              height={Math.max(alturaBarra, 4)}
                              fill={corBarra}
                              rx="3"
                              className="transition-all duration-300 hover:brightness-110"
                            />

                            {/* Nome do Colaborador no Eixo X */}
                            <text
                              x={xCentro}
                              y="212"
                              textAnchor="middle"
                              className="text-[12px] font-black fill-slate-800 dark:fill-slate-200"
                            >
                              {colab.nome.split(' ')[0]}
                            </text>

                            {/* Tooltip nativo */}
                            <title>{`${colab.nome}: ${colab.itens} itens em ${colab.coletas} coletas`}</title>
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Métrica: Soma do campo quantidade das coletas</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {listaColaboradores.length} colaborador(es) no ranking
                    </span>
                  </div>
                </div>

                {/* GRÁFICO DIREITA: Participação Percentual por Colaborador */}
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-blue-950 dark:text-white tracking-tight">
                      Participação de Quantidade por {isSeparacao ? 'Separador' : 'Conferente'}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                      Distribuição percentual e total de itens movimentados
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center my-auto py-2">
                    {/* Lado Esquerdo: Gráfico de Pizza (Pie Chart) */}
                    <div className="sm:col-span-7 flex justify-center">
                      <svg
                        viewBox="0 0 200 200"
                        className="w-48 h-48 sm:w-56 sm:h-56 drop-shadow-sm overflow-visible"
                      >
                        {fatiasPizza.map((fatia, i) => (
                          <g key={i} className="transition-transform duration-200 hover:scale-[1.03] origin-center cursor-pointer">
                            <path
                              d={fatia.pathData}
                              fill={fatia.cor.fill}
                              stroke="#ffffff"
                              strokeWidth="2.5"
                              className="transition-opacity duration-200 hover:opacity-90"
                            />
                            {/* Percentual estampado na fatia se >= 5% */}
                            {fatia.porcentagem >= 5 && (
                              <text
                                x={fatia.tx}
                                y={fatia.ty + 4}
                                textAnchor="middle"
                                className="text-[11px] font-black fill-white font-mono pointer-events-none drop-shadow-sm"
                              >
                                {fatia.porcentagem.toLocaleString('pt-BR', {
                                  minimumFractionDigits: 1,
                                  maximumFractionDigits: 1,
                                })}%
                              </text>
                            )}
                            <title>{`${fatia.nome}: ${fatia.itens} itens (${fatia.porcentagem.toFixed(1)}%)`}</title>
                          </g>
                        ))}
                      </svg>
                    </div>

                    {/* Lado Direito: Legenda e Tabela com Totais */}
                    <div className="sm:col-span-5 flex flex-col justify-center space-y-3">
                      <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                        {fatiasPizza.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs sm:text-sm font-semibold"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <span
                                className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                                style={{ backgroundColor: item.cor.fill }}
                              />
                              <span className="text-slate-800 dark:text-slate-200 font-bold truncate">
                                {item.nome}
                              </span>
                            </div>
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-sm shrink-0">
                              {item.itens}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Linha Divisória */}
                      <div className="border-t border-slate-300 dark:border-slate-700 pt-2.5 flex items-center justify-between">
                        <span className="text-sm font-extrabold text-blue-950 dark:text-white">
                          Total de Itens
                        </span>
                        <span className="text-base font-black text-blue-950 dark:text-white font-mono">
                          {totalBasePizza}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Unidade Operacional: {unidadeNegocio}</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      100% dos dados apurados
                    </span>
                  </div>
                </div>
              </div>

              {/* TABELA COMPARATIVA DE PRODUTIVIDADE */}
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Ranking de Produtividade dos {isSeparacao ? 'Separadores' : 'Conferentes'}</span>
                  </h3>
                  <span className="text-xs text-slate-500">
                    Ordenado por volume total de itens
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
                        <th className="py-2.5 px-3"># Posição</th>
                        <th className="py-2.5 px-3">Colaborador</th>
                        <th className="py-2.5 px-3 text-center">Coletas Atribuídas</th>
                        <th className="py-2.5 px-3 text-right">Total de Itens</th>
                        <th className="py-2.5 px-3 text-right">Participação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {listaColaboradores.map((colab, idx) => (
                        <tr key={colab.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3 px-3 font-mono font-bold text-slate-400">
                            #{idx + 1}
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: PALETA_CORES[idx % PALETA_CORES.length].fill }}
                            />
                            <span>{colab.nome}</span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-slate-700 dark:text-slate-300">
                            {colab.coletas}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                            {colab.itens}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                            {colab.porcentagemItens.toFixed(1)}%
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

      {/* C. GRÁFICO E DISTRIBUIÇÃO DE STATUS DAS COLETAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        {/* Status das Coletas */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Status Operacional das Coletas</span>
            </h3>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              Taxa de Conclusão: {dados.taxaConclusao}%
            </span>
          </div>

          {/* Barra de Progresso Bicolor */}
          <div className="h-3.5 rounded-full bg-slate-100 dark:bg-slate-950 overflow-hidden flex border border-slate-200 dark:border-slate-800">
            <div
              title={`Coletadas: ${dados.totalColetadas}`}
              style={{
                width: `${totalColetas > 0 ? (dados.totalColetadas / totalColetas) * 100 : 0}%`,
              }}
              className="bg-emerald-500 transition-all duration-500"
            />
            <div
              title={`Pendentes/Agendadas: ${dados.totalAgendadas}`}
              style={{
                width: `${totalColetas > 0 ? (dados.totalAgendadas / totalColetas) * 100 : 0}%`,
              }}
              className="bg-amber-500 transition-all duration-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center">
              <span className="text-amber-300 text-[11px] font-bold block flex items-center justify-center gap-1 mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Agendadas / Pendentes
              </span>
              <strong className="text-amber-400 font-mono text-xl sm:text-2xl font-black">
                {dados.totalAgendadas}
              </strong>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {totalColetas > 0 ? ((dados.totalAgendadas / totalColetas) * 100).toFixed(1) : 0}% do total
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center">
              <span className="text-emerald-300 text-[11px] font-bold block flex items-center justify-center gap-1 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Coletadas (Concluídas)
              </span>
              <strong className="text-emerald-400 font-mono text-xl sm:text-2xl font-black">
                {dados.totalColetadas}
              </strong>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {totalColetas > 0 ? ((dados.totalColetadas / totalColetas) * 100).toFixed(1) : 0}% do total
              </span>
            </div>
          </div>
        </div>

        {/* Volume por Transportadora */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Volume por Transportadora</span>
            </h3>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {dados.rankingTransportadoras?.length || 0} parceiros
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
            {dados.rankingTransportadoras && dados.rankingTransportadoras.length > 0 ? (
              dados.rankingTransportadoras.slice(0, 8).map((t, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <span className="font-bold text-slate-900 dark:text-white text-xs block truncate" title={t.transportadora}>
                      {t.transportadora}
                    </span>
                    <span className="text-[10px] text-slate-500">{t.coletas} coletas</span>
                  </div>
                  <div className="text-right font-mono shrink-0">
                    <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                      {t.itens}
                    </span>
                    <span className="text-[9px] text-slate-400 block">itens</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-500 col-span-2">
                Nenhum dado de transportadora registrado no período.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
