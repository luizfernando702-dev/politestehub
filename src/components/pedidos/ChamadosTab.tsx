import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LifeBuoy,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Package,
  Truck,
  FileText,
  User,
  Calendar,
  Eye,
  MapPin,
  PackageX,
  ShieldCheck,
  Building2,
  X,
} from 'lucide-react';
import {
  ChamadoLogistico,
  StatusChamado,
  TipoProblemaChamado,
  ItemProdutoChamado,
  TransportadoraChamado,
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { podeFinalizarChamado } from '../../utils/permissoes';
import { chamadosService } from '../../services/chamadosService';
import { NovoChamadoModal } from './NovoChamadoModal';
import { DetalhesChamadoModal } from './DetalhesChamadoModal';
import { FinalizarChamadoModal } from './FinalizarChamadoModal';

interface ChamadosTabProps {
  unidadeNegocio: string;
}

export const ChamadosTab: React.FC<ChamadosTabProps> = ({ unidadeNegocio }) => {
  const { user } = useAuth();
  const podeFinalizar = podeFinalizarChamado(user);

  const [chamados, setChamados] = useState<ChamadoLogistico[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusChamado | 'Todos'>('Todos');
  const [filtroTipo, setFiltroTipo] = useState<TipoProblemaChamado | 'Todos'>('Todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Modais
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [chamadoEmDetalhes, setChamadoEmDetalhes] = useState<ChamadoLogistico | null>(null);
  const [chamadoParaFinalizar, setChamadoParaFinalizar] = useState<ChamadoLogistico | null>(null);

  const carregarChamados = useCallback(async () => {
    try {
      setLoading(true);
      const data = await chamadosService.listarChamados({
        usuarioId: user?.id || null,
        usuarioNome: user?.nome || null,
        unidadeNegocio,
        status: filtroStatus,
        tipoProblema: filtroTipo,
        search: busca,
        dataInicio: dataInicio || undefined,
        dataFim: dataFim || undefined,
      });
      setChamados(data);
    } catch (err) {
      console.error('Erro ao carregar chamados:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.nome, unidadeNegocio, filtroStatus, filtroTipo, busca, dataInicio, dataFim]);

  useEffect(() => {
    carregarChamados();
  }, [carregarChamados]);

  // Contadores
  const metricas = useMemo(() => {
    const total = chamados.length;
    const abertos = chamados.filter((c) => c.status === 'Aberto').length;
    const concluidos = chamados.filter((c) => c.status === 'Concluído').length;
    const produtos = chamados.filter((c) => c.tipo_problema === 'Avaria' || c.tipo_problema === 'Produto errado').length;
    const transporte = chamados.filter((c) => c.tipo_problema === 'Atraso' || c.tipo_problema === 'Endereço errado').length;
    return { total, abertos, concluidos, produtos, transporte };
  }, [chamados]);

  const limparFiltros = () => {
    setBusca('');
    setFiltroStatus('Todos');
    setFiltroTipo('Todos');
    setDataInicio('');
    setDataFim('');
  };

  const temFiltroAtivo =
    busca ||
    filtroStatus !== 'Todos' ||
    filtroTipo !== 'Todos' ||
    dataInicio ||
    dataFim;

  const renderBadgeTipo = (tipo: TipoProblemaChamado) => {
    switch (tipo) {
      case 'Avaria':
        return (
          <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>Avaria</span>
          </span>
        );
      case 'Produto errado':
        return (
          <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
            <PackageX className="w-3 h-3 text-indigo-400" />
            <span>Produto Errado</span>
          </span>
        );
      case 'Atraso':
        return (
          <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-1">
            <Clock className="w-3 h-3 text-sky-400" />
            <span>Atraso Entrega</span>
          </span>
        );
      case 'Endereço errado':
        return (
          <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-emerald-400" />
            <span>Endereço Errado</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 pt-2 animate-in fade-in duration-200">
      {/* 1. TOPO DA ABA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 sm:p-5 rounded-3xl border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20 flex items-center gap-1.5">
              <LifeBuoy className="w-3.5 h-3.5" />
              <span>Ocorrências & Chamados</span>
            </span>
            <span className="text-[11px] text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700/60">
              Seus Chamados ({user?.nome || 'Usuário Atual'})
            </span>
            {podeFinalizar && (
              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Pode Finalizar (Gestor/Assistente)</span>
              </span>
            )}
          </div>
          <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
            Chamados Logísticos
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl">
            Abertura e acompanhamento de problemas com avarias, produtos divergentes, atrasos de transportadoras e inconsistências de endereço.
          </p>
        </div>

        {/* Botão de Abertura */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={carregarChamados}
            disabled={loading}
            className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            title="Recarregar chamados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-rose-400' : ''}`} />
          </button>

          <button
            type="button"
            id="btn-abrir-novo-chamado"
            onClick={() => setModalNovoAberto(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:from-rose-700 active:to-red-700 text-white font-bold text-xs shadow-lg shadow-rose-950/40 border border-rose-500/40 transition min-h-[44px] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Chamado</span>
          </button>
        </div>
      </div>

      {/* 2. CARDS DE MÉTRICAS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total de Chamados</span>
          <span className="text-2xl font-black font-mono text-white block">{metricas.total}</span>
          <span className="text-[10px] text-slate-500">abertos por você</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] uppercase font-bold text-amber-400 block flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Em Aberto
          </span>
          <span className="text-2xl font-black font-mono text-amber-300 block">{metricas.abertos}</span>
          <span className="text-[10px] text-slate-500">aguardando resolução</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] uppercase font-bold text-emerald-400 block">Concluídos</span>
          <span className="text-2xl font-black font-mono text-emerald-400 block">{metricas.concluidos}</span>
          <span className="text-[10px] text-slate-500">resolvidos com sucesso</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] uppercase font-bold text-indigo-400 block">Ocorrências de Produtos</span>
          <span className="text-2xl font-black font-mono text-indigo-300 block">{metricas.produtos}</span>
          <span className="text-[10px] text-slate-500">avarias e produtos errados</span>
        </div>
      </div>

      {/* 3. BARRA DE FILTROS */}
      <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Busca textual */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por cliente ou NF..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-rose-500 min-h-[40px]"
            />
          </div>

          {/* Filtro Status */}
          <div>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-xs focus:outline-none focus:border-rose-500 min-h-[40px]"
            >
              <option value="Todos">Status: Todos</option>
              <option value="Aberto">Aberto (Em análise)</option>
              <option value="Concluído">Concluído (Finalizado)</option>
            </select>
          </div>

          {/* Filtro Tipo de Problema */}
          <div>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-xs focus:outline-none focus:border-rose-500 min-h-[40px]"
            >
              <option value="Todos">Tipo: Todos</option>
              <option value="Avaria">Avaria</option>
              <option value="Produto errado">Produto errado</option>
              <option value="Atraso">Atraso na entrega</option>
              <option value="Endereço errado">Endereço incorreto</option>
            </select>
          </div>

          {/* Filtro Período Rápido */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-1/2 px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-[11px] focus:outline-none focus:border-rose-500 min-h-[40px]"
              title="Data inicial"
            />
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-1/2 px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-[11px] focus:outline-none focus:border-rose-500 min-h-[40px]"
              title="Data final"
            />
          </div>
        </div>

        {temFiltroAtivo && (
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-slate-400">
              Exibindo <strong>{chamados.length}</strong> chamados filtrados
            </span>
            <button
              type="button"
              onClick={limparFiltros}
              className="text-rose-400 hover:text-white font-bold flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpar filtros</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. LISTAGEM DE CHAMADOS */}
      {loading ? (
        <div className="p-12 text-center space-y-3 bg-slate-900/40 rounded-3xl border border-slate-800">
          <RefreshCw className="w-8 h-8 animate-spin text-rose-400 mx-auto" />
          <p className="text-xs text-slate-400">Carregando seus chamados...</p>
        </div>
      ) : chamados.length === 0 ? (
        <div className="p-12 text-center space-y-4 bg-slate-900/40 rounded-3xl border border-slate-800">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <LifeBuoy className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-bold text-white">Nenhum chamado localizado</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {temFiltroAtivo
                ? 'Nenhum chamado corresponde aos filtros selecionados. Tente alterar os termos da busca.'
                : 'Você ainda não registrou nenhum chamado de avaria, produto errado, atraso ou endereço. Clique no botão abaixo para abrir uma ocorrência.'}
            </p>
          </div>
          {!temFiltroAtivo && (
            <button
              type="button"
              onClick={() => setModalNovoAberto(true)}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Abrir Meu Primeiro Chamado</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {chamados.map((c) => {
            const isConcluido = c.status === 'Concluído';
            const isProblemaProduto = c.tipo_problema === 'Avaria' || c.tipo_problema === 'Produto errado';
            const itens = isProblemaProduto ? (c.produto_transportadora as ItemProdutoChamado[]) || [] : [];
            const transp = !isProblemaProduto ? (c.produto_transportadora as TransportadoraChamado) : null;

            const dataFormatada = new Date(c.data).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={c.id}
                onClick={() => setChamadoEmDetalhes(c)}
                className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-md select-none space-y-3 ${
                  isConcluido
                    ? 'bg-slate-900/60 border-slate-800 hover:border-emerald-500/50'
                    : 'bg-slate-900/90 border-slate-700/80 hover:border-rose-500/60 shadow-rose-950/20'
                }`}
              >
                {/* LINHA 1: Header do Card */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Status Badge */}
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                        isConcluido
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      {isConcluido ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Concluído</span>
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          <span>Aberto</span>
                        </>
                      )}
                    </span>

                    {/* Tipo de Ocorrência Badge */}
                    {renderBadgeTipo(c.tipo_problema)}
                  </div>

                  {/* Data de abertura */}
                  <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-blue-400" />
                    <span>{dataFormatada}</span>
                  </span>
                </div>

                {/* LINHA 2: Cliente e NF em destaque */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                      {c.cliente}
                    </h3>
                    <span className="text-xs text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                      <FileText className="w-3.5 h-3.5 text-blue-400" />
                      <span>Nota Fiscal: </span>
                      <strong className="text-white">{c.nota_fiscal}</strong>
                    </span>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setChamadoEmDetalhes(c);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver Detalhes</span>
                    </button>

                    {!isConcluido && podeFinalizar && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setChamadoParaFinalizar(c);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-900/30"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Finalizar</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* LINHA 3: Resumo dos Produtos ou Transportadora */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300">
                  {isProblemaProduto ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-bold uppercase tracking-wider flex items-center gap-1 text-indigo-400">
                          <Package className="w-3.5 h-3.5" />
                          <span>Produtos Vinculados ({itens.length})</span>
                        </span>
                        <span className="font-mono text-white">
                          Total: {itens.reduce((acc, i) => acc + (i.quantidade || 0), 0)} un
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {itens.slice(0, 3).map((item, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700/80 text-[11px] text-slate-200"
                          >
                            <span className="font-semibold truncate max-w-[200px]">{item.produto}</span>
                            <strong className="text-indigo-400 font-mono bg-indigo-500/10 px-1 rounded">
                              {item.quantidade} un
                            </strong>
                          </span>
                        ))}
                        {itens.length > 3 && (
                          <span className="text-[11px] text-slate-500 self-center font-bold">
                            +{itens.length - 3} outro(s)...
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs">
                      <Truck className="w-4 h-4 text-sky-400 shrink-0" />
                      <span className="text-slate-400">Transportadora:</span>
                      <strong className="text-white">
                        {transp?.transportadora || 'Transportadora não informada'}
                      </strong>
                    </div>
                  )}
                </div>

                {/* LINHA 4: Resolução (se concluído) */}
                {isConcluido && c.resolucao && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-200">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">
                      Resolução aplicada:
                    </span>
                    <p className="line-clamp-2 text-slate-200 text-[11px]">{c.resolucao}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL NOVO CHAMADO */}
      <NovoChamadoModal
        isOpen={modalNovoAberto}
        onClose={() => setModalNovoAberto(false)}
        unidadeNegocio={unidadeNegocio}
        currentUser={user}
        onChamadoCriado={carregarChamados}
      />

      {/* MODAL DETALHES DO CHAMADO */}
      <DetalhesChamadoModal
        isOpen={Boolean(chamadoEmDetalhes)}
        chamado={chamadoEmDetalhes}
        currentUser={user}
        podeFinalizar={podeFinalizar}
        onClose={() => setChamadoEmDetalhes(null)}
        onAbrirFinalizar={(c) => {
          setChamadoEmDetalhes(null);
          setChamadoParaFinalizar(c);
        }}
      />

      {/* MODAL FINALIZAR CHAMADO */}
      <FinalizarChamadoModal
        isOpen={Boolean(chamadoParaFinalizar)}
        chamado={chamadoParaFinalizar}
        currentUser={user}
        onClose={() => setChamadoParaFinalizar(null)}
        onConcluido={() => {
          carregarChamados();
          setChamadoParaFinalizar(null);
        }}
      />
    </div>
  );
};
