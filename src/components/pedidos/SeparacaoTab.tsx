import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  FileSpreadsheet,
  Download,
  Filter,
  Clock,
  User,
  Package,
  Calendar,
  Truck,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Play,
  SquareCheck,
  ChevronRight,
  Boxes,
  RefreshCw,
  SlidersHorizontal,
  Lock,
} from 'lucide-react';
import { SeparacaoPedido, StatusSeparacaoOperacional, Usuario } from '../../types';
import { pedidosService, formatarMinutos } from '../../services/pedidosService';
import { usuariosService } from '../../services/usuariosService';
import { useAuth } from '../../context/AuthContext';
import { podeGerenciarPedidos } from '../../lib/permissions';
import { NovoPedidoModal } from './NovoPedidoModal';
import { EdicaoRapidaOperacionalModal } from './EdicaoRapidaOperacionalModal';
import { ImportarPedidosModal } from './ImportarPedidosModal';

interface SeparacaoTabProps {
  unidadeNegocio: string;
  onSelecionarPedidoParaProdutos: (pedido: SeparacaoPedido) => void;
  pedidoSelecionadoId?: string | null;
  podeGerenciar?: boolean;
}

export const SeparacaoTab: React.FC<SeparacaoTabProps> = ({
  unidadeNegocio,
  onSelecionarPedidoParaProdutos,
  pedidoSelecionadoId,
  podeGerenciar: podeGerenciarProp,
}) => {
  const { user } = useAuth();
  const podeGerenciar = podeGerenciarProp !== undefined ? podeGerenciarProp : podeGerenciarPedidos(user);

  const [pedidos, setPedidos] = useState<SeparacaoPedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('Todos');
  const [filtroColaborador, setFiltroColaborador] = useState<string>('Todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Modais
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [modalImportarAberto, setModalImportarAberto] = useState(false);
  const [modalOperacionalAberto, setModalOperacionalAberto] = useState(false);
  const [pedidoParaOperacional, setPedidoParaOperacional] = useState<SeparacaoPedido | null>(null);
  const [pedidoParaEditar, setPedidoParaEditar] = useState<SeparacaoPedido | null>(null);

  const [colaboradores, setColaboradores] = useState<Usuario[]>([]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [listaPedidos, todosUsuarios] = await Promise.all([
        pedidosService.listarPedidos({
          unidade_negocio: unidadeNegocio,
          search: busca,
          status: filtroStatus,
          dataInicio: dataInicio || undefined,
          dataFim: dataFim || undefined,
        }),
        usuariosService.listarTodos(),
      ]);

      setPedidos(listaPedidos);
      setColaboradores(todosUsuarios);
    } catch (err) {
      console.warn('Erro ao carregar pedidos de separação:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [unidadeNegocio, filtroStatus, dataInicio, dataFim]);

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    carregarDados();
  };

  const handleExcluir = async (pedido: SeparacaoPedido) => {
    if (
      !window.confirm(
        `Deseja realmente excluir o pedido "${pedido.id_pedido}" e todos os seus produtos associados?`
      )
    ) {
      return;
    }

    try {
      await pedidosService.excluirPedido(pedido.id);
      setPedidos((prev) => prev.filter((p) => p.id !== pedido.id));
    } catch (err: any) {
      alert(`Erro ao excluir pedido: ${err.message}`);
    }
  };

  const handleAbrirOperacional = (pedido: SeparacaoPedido) => {
    setPedidoParaOperacional(pedido);
    setModalOperacionalAberto(true);
  };

  const handleAbrirEditar = (pedido: SeparacaoPedido) => {
    setPedidoParaEditar(pedido);
    setModalNovoAberto(true);
  };

  // Filtragem local por colaborador
  const pedidosFiltrados = pedidos.filter((p) => {
    if (filtroColaborador === 'Todos') return true;
    return p.separador_id === filtroColaborador || p.conferente_id === filtroColaborador;
  });

  const getStatusBadge = (status?: StatusSeparacaoOperacional) => {
    switch (status) {
      case 'Concluído':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Concluído
          </span>
        );
      case 'Em Conferência':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <SquareCheck className="w-3 h-3" />
            Em Conferência
          </span>
        );
      case 'Separado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Separado
          </span>
        );
      case 'Em Separação':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Play className="w-3 h-3" />
            Em Separação
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            Pendente
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP TOOLBAR & CONTROLS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Search Bar */}
        <form onSubmit={handleBuscar} className="flex-1 max-w-lg relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar por pedido, cliente, controle, transportador..."
            className="w-full pl-10 pr-24 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-white placeholder-slate-400 text-xs font-semibold focus:outline-none focus:border-blue-500 transition min-h-[44px]"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
          >
            Buscar
          </button>
        </form>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => pedidosService.baixarModeloExcelPedidos()}
            title="Baixar planilha modelo de importação de pedidos"
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition shadow-sm min-h-[44px]"
          >
            <Download className="w-4 h-4 text-slate-400" />
            <span className="hidden sm:inline">Modelo Excel</span>
          </button>

          {podeGerenciar ? (
            <>
              <button
                type="button"
                onClick={() => setModalImportarAberto(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900 border border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-400 text-xs font-bold transition shadow-sm min-h-[44px]"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Importar Pedidos</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPedidoParaEditar(null);
                  setModalNovoAberto(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/30 min-h-[44px]"
              >
                <Plus className="w-4 h-4" />
                <span>+ Novo Pedido</span>
              </button>
            </>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Inclusão restrita à Logística</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. FILTERS ROW */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
            Status:
          </span>
          {['Todos', 'Pendente', 'Em Separação', 'Separado', 'Em Conferência', 'Concluído'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFiltroStatus(st)}
              className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap min-h-[32px] text-xs ${
                filtroStatus === st
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Date / Collaborator filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">Data:</span>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
            />
            <span className="text-slate-500">a</span>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
            />
          </div>

          <button
            type="button"
            onClick={carregarDados}
            title="Atualizar listagem"
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 3. LISTING TABLE (DESKTOP) & CARDS (MOBILE) */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-slate-900/40 rounded-3xl border border-slate-800">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-3" />
          <p className="text-sm font-semibold">Carregando pedidos de separação...</p>
        </div>
      ) : pedidosFiltrados.length === 0 ? (
        <div className="p-12 text-center text-slate-400 bg-slate-900/40 rounded-3xl border border-slate-800 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
            <Package className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-white">Nenhum pedido encontrado</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Não há registros de pedidos com os filtros atuais para a unidade {unidadeNegocio}. {podeGerenciar ? 'Cadastre um novo pedido ou importe via planilha Excel.' : 'Aguardando cadastro de novos pedidos pela equipe de Logística.'}
          </p>
          {podeGerenciar ? (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalNovoAberto(true)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition"
              >
                + Novo Pedido
              </button>
              <button
                type="button"
                onClick={() => setModalImportarAberto(true)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
              >
                Importar Excel
              </button>
            </div>
          ) : (
            <div className="pt-2 text-xs text-slate-500 flex items-center justify-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Inclusão e importação exclusivas para o Departamento de Logística.</span>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden xl:block overflow-hidden border border-slate-800/90 rounded-3xl bg-slate-900/70 shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/90 border-b border-slate-800 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3.5 px-4">Pedido / Data</th>
                    <th className="py-3.5 px-4">Cliente / Transporte</th>
                    <th className="py-3.5 px-3 text-center">Qtd. Itens</th>
                    <th className="py-3.5 px-4">Separação (Operação)</th>
                    <th className="py-3.5 px-4">Conferência (Operação)</th>
                    <th className="py-3.5 px-3 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Ações Operacionais</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {pedidosFiltrados.map((pedido) => {
                    const isSelected = pedido.id === pedidoSelecionadoId;
                    return (
                      <tr
                        key={pedido.id}
                        className={`hover:bg-slate-800/40 transition group ${
                          isSelected ? 'bg-blue-500/10 border-l-4 border-l-blue-500' : ''
                        }`}
                      >
                        {/* 1. Pedido / Data / Código */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-extrabold text-white text-sm text-blue-400">
                              {pedido.id_pedido}
                            </span>
                            {pedido.codigo_controle && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                {pedido.codigo_controle}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            <span>
                              {pedido.data
                                ? new Date(pedido.data + 'T12:00:00').toLocaleDateString('pt-BR')
                                : '-'}
                            </span>
                          </div>
                        </td>

                        {/* 2. Cliente / Transportador */}
                        <td className="py-3.5 px-4 align-top max-w-[220px]">
                          <div className="font-bold text-white truncate" title={pedido.cliente}>
                            {pedido.cliente}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1 truncate" title={pedido.transportador}>
                            <Truck className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="truncate">{pedido.transportador}</span>
                          </div>
                        </td>

                        {/* 3. Qtd. Itens */}
                        <td className="py-3.5 px-3 text-center align-top">
                          <span className="font-mono font-extrabold text-white text-sm bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 inline-block">
                            {pedido.quantidade_itens}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">itens</span>
                        </td>

                        {/* 4. Separação */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                            <User className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            <span className="truncate max-w-[130px]">
                              {pedido.separador_nome || (
                                <span className="text-slate-500 italic">Não atribuído</span>
                              )}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                            <span className="font-mono">
                              {pedido.hora_inicial_separacao || '--:--'} às{' '}
                              {pedido.hora_final_separacao || '--:--'}
                            </span>
                            {pedido.tempo_separacao_minutos !== null &&
                              pedido.tempo_separacao_minutos !== undefined && (
                                <span className="text-[10px] font-bold text-sky-300 bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20">
                                  {formatarMinutos(pedido.tempo_separacao_minutos)}
                                </span>
                              )}
                          </div>
                        </td>

                        {/* 5. Conferência */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                            <User className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span className="truncate max-w-[130px]">
                              {pedido.conferente_nome || (
                                <span className="text-slate-500 italic">Não atribuído</span>
                              )}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                            <span className="font-mono">
                              {pedido.hora_inicial_conferencia || '--:--'} às{' '}
                              {pedido.hora_final_conferencia || '--:--'}
                            </span>
                            {pedido.tempo_conferencia_minutos !== null &&
                              pedido.tempo_conferencia_minutos !== undefined && (
                                <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/10 px-1.5 py-0.2 rounded border border-indigo-500/20">
                                  {formatarMinutos(pedido.tempo_conferencia_minutos)}
                                </span>
                              )}
                          </div>
                        </td>

                        {/* 6. Status */}
                        <td className="py-3.5 px-3 text-center align-top">
                          {getStatusBadge(pedido.status_operacional)}
                        </td>

                        {/* 7. Ações Operacionais Rápidas */}
                        <td className="py-3.5 px-4 align-top text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Botão de Apontamento Rápido - Somente Logística */}
                            {podeGerenciar && (
                              <button
                                type="button"
                                onClick={() => handleAbrirOperacional(pedido)}
                                title="Preencher ou atualizar horários e responsáveis (Logística)"
                                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 text-[11px] font-bold border border-slate-700 transition flex items-center gap-1"
                              >
                                <Clock className="w-3.5 h-3.5" />
                                <span>Apontar</span>
                              </button>
                            )}

                            {/* Botão Ver Produtos do Pedido (Navega para Aba 2) - Todos podem acessar */}
                            <button
                              type="button"
                              onClick={() => onSelecionarPedidoParaProdutos(pedido)}
                              title="Ver produtos vinculados a este pedido na Aba Produtos"
                              className="px-2.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-[11px] font-bold border border-blue-500/30 transition flex items-center gap-1"
                            >
                              <Boxes className="w-3.5 h-3.5" />
                              <span>Produtos</span>
                            </button>

                            {/* Botões Editar / Excluir - Somente Logística */}
                            {podeGerenciar && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleAbrirEditar(pedido)}
                                  title="Editar pedido"
                                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleExcluir(pedido)}
                                  title="Excluir pedido"
                                  className="p-1.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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

          {/* Mobile / Tablet Cards View */}
          <div className="xl:hidden grid grid-cols-1 md:grid-cols-2 gap-4">
            {pedidosFiltrados.map((pedido) => (
              <div
                key={pedido.id}
                className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-lg relative overflow-hidden"
              >
                {/* Header do Card */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-blue-400 text-base">
                        {pedido.id_pedido}
                      </span>
                      {pedido.codigo_controle && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {pedido.codigo_controle}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {pedido.data
                        ? new Date(pedido.data + 'T12:00:00').toLocaleDateString('pt-BR')
                        : '-'}
                    </span>
                  </div>
                  <div>{getStatusBadge(pedido.status_operacional)}</div>
                </div>

                {/* Cliente e Qtd */}
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-white text-sm">{pedido.cliente}</div>
                  <div className="text-slate-400 flex items-center justify-between">
                    <span className="flex items-center gap-1 truncate">
                      <Truck className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">{pedido.transportador}</span>
                    </span>
                    <span className="font-mono font-bold text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-800 shrink-0">
                      {pedido.quantidade_itens} itens
                    </span>
                  </div>
                </div>

                {/* Operacional: Separação & Conferência */}
                <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-[11px]">
                  <div>
                    <span className="text-slate-500 font-bold block mb-0.5">Separação:</span>
                    <span className="font-semibold text-sky-400 truncate block">
                      {pedido.separador_nome || 'Pendente'}
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {pedido.hora_inicial_separacao || '--:--'} às {pedido.hora_final_separacao || '--:--'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block mb-0.5">Conferência:</span>
                    <span className="font-semibold text-indigo-400 truncate block">
                      {pedido.conferente_nome || 'Pendente'}
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {pedido.hora_inicial_conferencia || '--:--'} às {pedido.hora_final_conferencia || '--:--'}
                    </span>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  {podeGerenciar ? (
                    <button
                      type="button"
                      onClick={() => handleAbrirOperacional(pedido)}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold transition min-h-[40px]"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Apontar</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-slate-500" />
                      <span>Consulta</span>
                    </span>
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSelecionarPedidoParaProdutos(pedido)}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition min-h-[40px]"
                    >
                      <Boxes className="w-3.5 h-3.5" />
                      <span>Produtos</span>
                    </button>

                    {podeGerenciar && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAbrirEditar(pedido)}
                          className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 min-h-[40px] min-w-[40px] flex items-center justify-center"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExcluir(pedido)}
                          className="p-2 rounded-xl text-rose-400 hover:bg-rose-500/10 min-h-[40px] min-w-[40px] flex items-center justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modais */}
      {modalNovoAberto && (
        <NovoPedidoModal
          isOpen={modalNovoAberto}
          onClose={() => setModalNovoAberto(false)}
          onSalvo={(novoOuAtualizado) => {
            setPedidos((prev) => {
              const idx = prev.findIndex((p) => p.id === novoOuAtualizado.id);
              if (idx >= 0) {
                const copia = [...prev];
                copia[idx] = novoOuAtualizado;
                return copia;
              }
              return [novoOuAtualizado, ...prev];
            });
          }}
          pedidoParaEdicao={pedidoParaEditar}
          unidadeNegocio={unidadeNegocio}
        />
      )}

      {modalOperacionalAberto && (
        <EdicaoRapidaOperacionalModal
          isOpen={modalOperacionalAberto}
          onClose={() => setModalOperacionalAberto(false)}
          pedido={pedidoParaOperacional}
          onAtualizado={(atualizado) => {
            setPedidos((prev) =>
              prev.map((p) => (p.id === atualizado.id ? atualizado : p))
            );
          }}
          unidadeNegocio={unidadeNegocio}
        />
      )}

      {modalImportarAberto && (
        <ImportarPedidosModal
          isOpen={modalImportarAberto}
          onClose={() => setModalImportarAberto(false)}
          onImportado={(novos) => {
            setPedidos((prev) => [...novos, ...prev]);
          }}
          unidadeNegocio={unidadeNegocio}
        />
      )}
    </div>
  );
};
