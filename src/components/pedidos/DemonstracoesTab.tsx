import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Search,
  Plus,
  RotateCcw,
  Download,
  CheckCircle2,
  Clock,
  MapPin,
  User,
  AlertCircle,
  FileText,
  Trash2,
  Edit2,
  Layers,
  ArrowUpDown,
  Filter,
  Package,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Demonstracao, StatusDemonstracaoDinamico } from '../../types';
import { demonstracoesService, calcularStatusDinamico } from '../../services/demonstracoesService';
import { useAuth } from '../../context/AuthContext';
import { NovaDemonstracaoModal } from './NovaDemonstracaoModal';
import { RegistrarDevolucaoModal } from './RegistrarDevolucaoModal';
import { EditarDemonstracaoModal } from './EditarDemonstracaoModal';

interface DemonstracoesTabProps {
  unidadeNegocio: string;
}

export const DemonstracoesTab: React.FC<DemonstracoesTabProps> = ({ unidadeNegocio }) => {
  const { user } = useAuth();
  const isGestor = user?.nivel?.toLowerCase() === 'gestor';
  const isAssistente = user?.nivel?.toLowerCase() === 'assistente';
  const podeAdicionarEditar = isGestor || isAssistente;
  const podeExcluir = isGestor;

  const [demonstracoes, setDemonstracoes] = useState<Demonstracao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'Todos' | 'Demonstração' | 'Devolvido'>('Todos');
  const [filtroColaborador, setFiltroColaborador] = useState<string>('todos');

  // Modais
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [modalDevolucaoAberto, setModalDevolucaoAberto] = useState(false);
  const [demonstracaoParaDevolucao, setDemonstracaoParaDevolucao] = useState<Demonstracao | null>(null);
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [demonstracaoParaEdicao, setDemonstracaoParaEdicao] = useState<Demonstracao | null>(null);

  // Alerta / Mensagem temporária de sucesso
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  // Carregar dados
  const carregarDados = async () => {
    setLoading(true);
    try {
      const lista = await demonstracoesService.listar({
        unidade_negocio: unidadeNegocio,
      });
      setDemonstracoes(lista);
    } catch (err) {
      console.warn('Erro ao carregar demonstrações:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [unidadeNegocio]);

  // Mensagem temporária de sucesso com auto-dismiss
  const dispararSucesso = (texto: string) => {
    setMensagemSucesso(texto);
    setTimeout(() => {
      setMensagemSucesso(null);
    }, 4500);
  };

  // Callback de nova demonstração
  const handleNovaDemonstracaoSalva = (nova: Demonstracao) => {
    dispararSucesso(`Saída para demonstração do produto "${nova.produto}" registrada com sucesso!`);
    carregarDados();
  };

  // Callback de devolução concluída
  const handleDevolucaoConcluida = (atualizada: Demonstracao) => {
    dispararSucesso(`Devolução do produto "${atualizada.produto}" registrada com sucesso!`);
    carregarDados();
  };

  // Callback de edição salva
  const handleEdicaoSalva = (atualizada: Demonstracao) => {
    dispararSucesso(`Registro de demonstração do produto "${atualizada.produto}" atualizado com sucesso!`);
    carregarDados();
  };

  // Abertura do modal de devolução
  const handleAbrirDevolucao = (item: Demonstracao) => {
    if (!podeAdicionarEditar) {
      alert('Acesso restrito: Apenas Gestor e Assistente podem registrar devoluções.');
      return;
    }
    if (item.data_devolvida) return;
    setDemonstracaoParaDevolucao(item);
    setModalDevolucaoAberto(true);
  };

  // Abertura do modal de edição
  const handleAbrirEdicao = (item: Demonstracao) => {
    if (!podeAdicionarEditar) {
      alert('Acesso restrito: Apenas Gestor e Assistente podem editar demonstrações.');
      return;
    }
    setDemonstracaoParaEdicao(item);
    setModalEdicaoAberto(true);
  };

  // Exclusão de registro (SOMENTE GESTOR)
  const handleExcluir = async (id: string, produto: string) => {
    if (!podeExcluir) {
      alert('Acesso negado: Somente usuários de nível Gestor podem excluir registros de demonstração.');
      return;
    }
    if (window.confirm(`Tem certeza que deseja excluir o registro de demonstração do produto "${produto}"?`)) {
      try {
        await demonstracoesService.excluir(id, user?.nivel);
        dispararSucesso('Registro de demonstração removido com sucesso.');
        carregarDados();
      } catch (err: any) {
        alert(err.message || 'Erro ao excluir demonstração.');
      }
    }
  };

  // Totalizadores dos Cards (baseados em data_devolvida)
  const metricas = useMemo(() => {
    const total = demonstracoes.length;
    const emAberto = demonstracoes.filter((d) => !d.data_devolvida).length;
    const devolvidos = demonstracoes.filter((d) => !!d.data_devolvida).length;
    return { total, emAberto, devolvidos };
  }, [demonstracoes]);

  // Lista única de colaboradores para filtro
  const colaboradoresDisponiveis = useMemo(() => {
    const map = new Map<string, string>();
    demonstracoes.forEach((d) => {
      if (d.colaborador && d.colaborador_nome) {
        map.set(d.colaborador, d.colaborador_nome);
      }
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  }, [demonstracoes]);

  // Filtragem e ordenação
  const demonstracoesFiltradas = useMemo(() => {
    return demonstracoes.filter((d) => {
      // Filtro status dinâmico
      if (filtroStatus === 'Demonstração' && d.data_devolvida) return false;
      if (filtroStatus === 'Devolvido' && !d.data_devolvida) return false;

      // Filtro colaborador
      if (filtroColaborador !== 'todos' && d.colaborador !== filtroColaborador) {
        return false;
      }

      // Busca textual
      if (busca.trim()) {
        const q = busca.trim().toLowerCase();
        const produtoOk = (d.produto || '').toLowerCase().includes(q);
        const codOk = (d.codigo_produto || '').toLowerCase().includes(q);
        const endOk = (d.endereco || '').toLowerCase().includes(q);
        const colabOk = (d.colaborador_nome || '').toLowerCase().includes(q);
        const obsOk = (d.observacao || '').toLowerCase().includes(q);
        return produtoOk || codOk || endOk || colabOk || obsOk;
      }

      return true;
    });
  }, [demonstracoes, filtroStatus, filtroColaborador, busca]);

  // Exportar para Excel (.xlsx)
  const handleExportarExcel = () => {
    if (demonstracoesFiltradas.length === 0) {
      alert('Não há dados filtrados para exportar.');
      return;
    }

    const dadosExportacao = demonstracoesFiltradas.map((d, index) => {
      const status = calcularStatusDinamico(d.data_devolvida);
      return {
        '#': index + 1,
        'Unidade de Negócio': d.unidade_negocio,
        'Produto': d.produto,
        'Código / EAN': d.codigo_produto || '-',
        'Endereço': d.endereco,
        'Colaborador': d.colaborador_nome || 'Não informado',
        'Data Retirada': d.data_coletada ? new Date(d.data_coletada).toLocaleString('pt-BR') : '-',
        'Data Devolução': d.data_devolvida ? new Date(d.data_devolvida).toLocaleString('pt-BR') : 'Em Aberto',
        'Status': status,
        'Observações': d.observacao || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dadosExportacao);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Demonstrações');

    // Auto-width das colunas
    worksheet['!cols'] = [
      { wch: 5 },
      { wch: 18 },
      { wch: 40 },
      { wch: 18 },
      { wch: 14 },
      { wch: 25 },
      { wch: 20 },
      { wch: 20 },
      { wch: 16 },
      { wch: 35 },
    ];

    const dataAtual = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `PoliHub_Demonstracoes_${unidadeNegocio}_${dataAtual}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* MENSAGEM DE SUCESSO TEMPORÁRIA */}
      {mensagemSucesso && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-lg animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{mensagemSucesso}</span>
          </div>
          <button
            type="button"
            onClick={() => setMensagemSucesso(null)}
            className="text-emerald-400 hover:text-white text-xs font-bold px-2 py-1 rounded-lg hover:bg-emerald-500/20 transition"
          >
            Fechar
          </button>
        </div>
      )}

      {/* 1. CARDS / TOTALIZADORES DO TOPO (Item 12 da especificação) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* CARD 1: TOTAL DE DEMONSTRAÇÕES */}
        <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total de Demonstrações
            </span>
            <div className="w-9 h-9 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {loading ? '-' : metricas.total}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Histórico completo da unidade</p>
        </div>

        {/* CARD 2: EM DEMONSTRAÇÃO (EM ABERTO) */}
        <div className="p-4 sm:p-5 rounded-3xl bg-amber-500/5 border border-amber-500/20 shadow-sm relative overflow-hidden group hover:border-amber-500/40 transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              Em Demonstração
            </span>
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-300 tracking-tight">
            {loading ? '-' : metricas.emAberto}
          </div>
          <p className="text-[11px] text-amber-400/70 mt-1">Produtos em aberto com clientes</p>
        </div>

        {/* CARD 3: DEVOLVIDOS */}
        <div className="p-4 sm:p-5 rounded-3xl bg-emerald-500/5 border border-emerald-500/20 shadow-sm relative overflow-hidden group hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              Devolvidos
            </span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-300 tracking-tight">
            {loading ? '-' : metricas.devolvidos}
          </div>
          <p className="text-[11px] text-emerald-400/70 mt-1">Demonstrações finalizadas</p>
        </div>
      </div>

      {/* 2. BARRA DE AÇÕES E FILTROS */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Busca textual */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por produto, código, endereço ou colaborador..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:border-blue-500 min-h-[44px]"
            />
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Botão + Nova Demonstração (Gestor e Assistente) */}
            {podeAdicionarEditar && (
              <button
                type="button"
                id="btn-nova-demonstracao"
                onClick={() => setModalNovoAberto(true)}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-900/30 transition min-h-[44px]"
              >
                <Plus className="w-4 h-4" />
                <span>+ Nova Demonstração</span>
              </button>
            )}

            {/* Exportar Excel */}
            <button
              type="button"
              onClick={handleExportarExcel}
              className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition min-h-[44px]"
              title="Exportar para Excel (.xlsx)"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Exportar</span>
            </button>

            {/* Recarregar */}
            <button
              type="button"
              onClick={carregarDados}
              className="w-11 h-11 rounded-2xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
              title="Atualizar dados"
            >
              <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Linha de Filtros Rápidos (Chips) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
          {/* Status Dinâmico */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              Status:
            </span>
            <button
              type="button"
              onClick={() => setFiltroStatus('Todos')}
              className={`px-3 py-1.5 rounded-xl font-bold transition min-h-[34px] ${
                filtroStatus === 'Todos'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Todos ({metricas.total})
            </button>

            <button
              type="button"
              onClick={() => setFiltroStatus('Demonstração')}
              className={`px-3 py-1.5 rounded-xl font-bold transition min-h-[34px] flex items-center gap-1.5 ${
                filtroStatus === 'Demonstração'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-950 text-amber-400/90 hover:text-amber-300 border border-amber-500/20'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Demonstração ({metricas.emAberto})
            </button>

            <button
              type="button"
              onClick={() => setFiltroStatus('Devolvido')}
              className={`px-3 py-1.5 rounded-xl font-bold transition min-h-[34px] flex items-center gap-1.5 ${
                filtroStatus === 'Devolvido'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-950 text-emerald-400/90 hover:text-emerald-300 border border-emerald-500/20'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Devolvidos ({metricas.devolvidos})
            </button>
          </div>

          {/* Filtro por Colaborador */}
          {colaboradoresDisponiveis.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Colaborador:</span>
              <select
                value={filtroColaborador}
                onChange={(e) => setFiltroColaborador(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-medium focus:outline-none focus:border-blue-500"
              >
                <option value="todos">Todos os colaboradores</option>
                {colaboradoresDisponiveis.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 3. LISTAGEM PRINCIPAL */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 bg-slate-900/50 border border-slate-800 rounded-3xl">
          <RotateCcw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
          <p className="text-xs font-semibold">Carregando registros de demonstrações...</p>
        </div>
      ) : demonstracoesFiltradas.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-3xl space-y-3">
          <Package className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">Nenhuma demonstração encontrada</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {busca || filtroStatus !== 'Todos' || filtroColaborador !== 'todos'
              ? 'Nenhum resultado corresponde aos filtros aplicados. Tente ajustar os termos de pesquisa.'
              : 'Nenhum produto foi retirado para demonstração comercial nesta unidade até o momento.'}
          </p>
          {!busca && filtroStatus === 'Todos' && (
            <button
              type="button"
              onClick={() => setModalNovoAberto(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Primeira Saída</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* TABELA DESKTOP */}
          <div className="hidden lg:block overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900 shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px] font-bold">
                <tr>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Produto & Código</th>
                  <th className="py-3.5 px-4">Endereço</th>
                  <th className="py-3.5 px-4">Colaborador</th>
                  <th className="py-3.5 px-4">Retirada</th>
                  <th className="py-3.5 px-4">Devolução</th>
                  <th className="py-3.5 px-4">Observação</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {demonstracoesFiltradas.map((dem) => {
                  const status = calcularStatusDinamico(dem.data_devolvida);
                  const isAberto = status === 'Demonstração';

                  return (
                    <tr
                      key={dem.id}
                      className={`hover:bg-slate-800/40 transition group ${
                        isAberto ? 'bg-amber-500/[0.02]' : ''
                      }`}
                    >
                      {/* Status Dinâmico */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isAberto ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Demonstração
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            Devolvido
                          </span>
                        )}
                      </td>

                      {/* Produto & Código */}
                      <td className="py-3.5 px-4 max-w-[280px]">
                        <div className="font-bold text-white text-xs truncate" title={dem.produto}>
                          {dem.produto}
                        </div>
                        {dem.codigo_produto && (
                          <div className="text-[11px] font-mono text-sky-400 mt-0.5">
                            EAN: {dem.codigo_produto}
                          </div>
                        )}
                      </td>

                      {/* Endereço */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-700 font-mono font-bold text-slate-200 text-[11px]">
                          <MapPin className="w-3 h-3 text-sky-400" />
                          {dem.endereco}
                        </span>
                      </td>

                      {/* Colaborador */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                            <User className="w-3 h-3" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-200">{dem.colaborador_nome}</div>
                            {dem.colaborador_codigo && (
                              <div className="text-[10px] text-slate-500 font-mono">{dem.colaborador_codigo}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Data Retirada */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-300 font-mono text-[11px]">
                        {new Date(dem.data_coletada).toLocaleDateString('pt-BR')}{' '}
                        <span className="text-slate-500 font-normal">
                          {new Date(dem.data_coletada).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>

                      {/* Data Devolução */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {dem.data_devolvida ? (
                          <span className="font-mono text-emerald-400 text-[11px]">
                            {new Date(dem.data_devolvida).toLocaleDateString('pt-BR')}{' '}
                            <span className="text-slate-500 font-normal">
                              {new Date(dem.data_devolvida).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </span>
                        ) : (
                          <span className="text-amber-400/80 italic text-[11px]">
                            Em demonstração...
                          </span>
                        )}
                      </td>

                      {/* Observação */}
                      <td className="py-3.5 px-4 max-w-[200px]">
                        {dem.observacao ? (
                          <span className="text-slate-400 text-[11px] truncate block" title={dem.observacao}>
                            {dem.observacao}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {podeAdicionarEditar && (
                            <button
                              type="button"
                              onClick={() => handleAbrirEdicao(dem)}
                              className="p-1.5 rounded-xl bg-slate-800 hover:bg-blue-600 hover:text-white text-blue-400 transition"
                              title="Editar registro de demonstração"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {isAberto ? (
                            podeAdicionarEditar ? (
                              <button
                                type="button"
                                onClick={() => handleAbrirDevolucao(dem)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-900/30 transition min-h-[36px]"
                                title="Registrar devolução do produto"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Registrar Devolução</span>
                              </button>
                            ) : null
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-950 text-slate-500 text-[11px] font-medium border border-slate-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500/70" />
                              Encerrado
                            </span>
                          )}

                          {podeExcluir && (
                            <button
                              type="button"
                              onClick={() => handleExcluir(dem.id, dem.produto)}
                              className="w-8 h-8 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-slate-800 flex items-center justify-center transition"
                              title="Excluir registro (exclusivo Gestor)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* CARDS MOBILE (Adaptação responsiva sem sobreposição - Item 2) */}
          <div className="lg:hidden space-y-3">
            {demonstracoesFiltradas.map((dem) => {
              const status = calcularStatusDinamico(dem.data_devolvida);
              const isAberto = status === 'Demonstração';

              return (
                <div
                  key={dem.id}
                  className={`p-4 rounded-3xl border transition shadow-sm space-y-3 ${
                    isAberto
                      ? 'bg-slate-900/90 border-amber-500/30'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  {/* Topo do Card Mobile */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {isAberto ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 mb-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          Demonstração
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 mb-1.5">
                          <CheckCircle2 className="w-3 h-3" />
                          Devolvido
                        </span>
                      )}
                      <h4 className="font-bold text-white text-xs sm:text-sm leading-snug">
                        {dem.produto}
                      </h4>
                      {dem.codigo_produto && (
                        <span className="text-[10px] font-mono text-sky-400 block mt-0.5">
                          EAN: {dem.codigo_produto}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleExcluir(dem.id, dem.produto)}
                      className="w-8 h-8 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-slate-800 flex items-center justify-center transition shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Informações de Endereço e Colaborador */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800/80">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">
                        Endereço
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-sky-400 text-xs mt-0.5">
                        <MapPin className="w-3 h-3 text-sky-400" />
                        {dem.endereco}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">
                        Responsável
                      </span>
                      <span className="font-semibold text-slate-200 text-xs truncate block mt-0.5">
                        {dem.colaborador_nome}
                      </span>
                    </div>
                  </div>

                  {/* Horários Retirada / Devolução */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800 font-mono">
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase font-bold">
                        Retirada
                      </span>
                      <span className="text-slate-300">
                        {new Date(dem.data_coletada).toLocaleDateString('pt-BR')}{' '}
                        {new Date(dem.data_coletada).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase font-bold">
                        Devolução
                      </span>
                      {dem.data_devolvida ? (
                        <span className="text-emerald-400">
                          {new Date(dem.data_devolvida).toLocaleDateString('pt-BR')}{' '}
                          {new Date(dem.data_devolvida).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      ) : (
                        <span className="text-amber-400/80 italic">Em aberto</span>
                      )}
                    </div>
                  </div>

                  {/* Observação */}
                  {dem.observacao && (
                    <div className="text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
                      <span className="font-semibold text-slate-300">Obs:</span> {dem.observacao}
                    </div>
                  )}

                  {/* Ações no Mobile */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                    {podeAdicionarEditar && (
                      <button
                        type="button"
                        onClick={() => handleAbrirEdicao(dem)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-blue-400 font-bold text-xs hover:bg-slate-700 transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                    )}

                    {isAberto && podeAdicionarEditar && (
                      <button
                        type="button"
                        onClick={() => handleAbrirDevolucao(dem)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Devolver</span>
                      </button>
                    )}

                    {podeExcluir && (
                      <button
                        type="button"
                        onClick={() => handleExcluir(dem.id, dem.produto)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                        title="Excluir registro (exclusivo Gestor)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* MODAL: + NOVA DEMONSTRAÇÃO */}
      <NovaDemonstracaoModal
        isOpen={modalNovoAberto}
        onClose={() => setModalNovoAberto(false)}
        onSalvo={handleNovaDemonstracaoSalva}
        unidadeNegocio={unidadeNegocio}
        currentUser={user}
      />

      {/* MODAL: REGISTRAR DEVOLUÇÃO */}
      <RegistrarDevolucaoModal
        isOpen={modalDevolucaoAberto}
        onClose={() => {
          setModalDevolucaoAberto(false);
          setDemonstracaoParaDevolucao(null);
        }}
        demonstracao={demonstracaoParaDevolucao}
        onDevolvido={handleDevolucaoConcluida}
        currentUser={user}
      />

      {/* MODAL: EDITAR DEMONSTRAÇÃO */}
      <EditarDemonstracaoModal
        isOpen={modalEdicaoAberto}
        onClose={() => {
          setModalEdicaoAberto(false);
          setDemonstracaoParaEdicao(null);
        }}
        demonstracao={demonstracaoParaEdicao}
        currentUser={user}
        onSalvo={handleEdicaoSalva}
      />
    </div>
  );
};
