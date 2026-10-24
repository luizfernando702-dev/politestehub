import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Package,
  MapPin,
  Calendar,
  User,
  ArrowLeft,
  RefreshCw,
  Clock,
  Layers,
  FileSpreadsheet,
  Printer,
  Check,
  RotateCcw,
  Ban,
  Lock,
} from 'lucide-react';
import { DetalheContagem, FiltrosListagemContagem, ItemListagemContagem, Usuario, InventarioStatus } from '../../types';
import { inventarioService } from '../../services/inventarioService';
import { usuariosService } from '../../services/usuariosService';
import { DetalhesContagemModal } from './DetalhesContagemModal';
import { ImportarContagemModal } from './ImportarContagemModal';
import { RomaneioContagemModal } from './RomaneioContagemModal';

interface ListaContagensProps {
  currentUser: Usuario | null;
  onVoltar: () => void;
}

type TabListagem = 'falta' | 'sobressalentes' | 'corrigidas';

export const ListaContagens: React.FC<ListaContagensProps> = ({
  currentUser,
  onVoltar,
}) => {
  // Aba ativa: Falta, Sobressalentes, Corrigidas
  const [abaAtiva, setAbaAtiva] = useState<TabListagem>('falta');

  // Filtros de pesquisa
  const [produto, setProduto] = useState('');
  const [endereco, setEndereco] = useState('');
  const [contagem, setContagem] = useState('');
  const [dataContagem, setDataContagem] = useState('');
  const [usuarioId, setUsuarioId] = useState('');
  const [ordenacao, setOrdenacao] = useState<'divergencia_prioritaria' | 'data_desc' | 'data_asc' | 'produto_asc'>('divergencia_prioritaria');

  // Paginação e dados
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [itens, setItens] = useState<ItemListagemContagem[]>([]);
  const [totalItens, setTotalItens] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lista de usuários para o dropdown
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  // Modais
  const [detalheSelecionado, setDetalheSelecionado] = useState<DetalheContagem | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [importarModalOpen, setImportarModalOpen] = useState(false);
  const [romaneioModalOpen, setRomaneioModalOpen] = useState(false);

  // Ação rápida de validação de sobressalente
  const [validandoId, setValidandoId] = useState<string | number | null>(null);

  const isGestor = currentUser?.nivel?.toLowerCase() === 'gestor';
  const isAssistenteOuGestor = isGestor || currentUser?.nivel?.toLowerCase() === 'assistente';

  // Carregar lista de usuários para o filtro
  useEffect(() => {
    let isMounted = true;
    const loadUsuarios = async () => {
      try {
        const list = await usuariosService.listarTodos();
        if (isMounted) setUsuarios(list);
      } catch (err) {
        console.error('Erro ao listar usuários para filtro:', err);
      }
    };
    loadUsuarios();
    return () => {
      isMounted = false;
    };
  }, []);

  // Buscar contagens de acordo com a aba e filtros
  const carregarContagens = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);

    const filtros: FiltrosListagemContagem = {
      produto: produto.trim() || undefined,
      endereco: endereco.trim() || undefined,
      contagem: contagem.trim() || undefined,
      dataContagem: dataContagem.trim() || undefined,
      usuarioId: usuarioId.trim() || undefined,
      aba: abaAtiva,
      ordenacao,
      page,
      pageSize,
      userRole: currentUser.nivel,
    };

    const resp = await inventarioService.listarContagens(filtros, currentUser.nivel);
    setLoading(false);

    if (!resp.success || !resp.result) {
      setError(resp.error || 'Erro ao carregar lista de contagens.');
      setItens([]);
      setTotalItens(0);
      setTotalPages(1);
      return;
    }

    setItens(resp.result.data);
    setTotalItens(resp.result.total);
    setTotalPages(resp.result.totalPages);
  }, [currentUser, abaAtiva, produto, endereco, contagem, dataContagem, usuarioId, ordenacao, page, pageSize]);

  useEffect(() => {
    carregarContagens();
  }, [carregarContagens]);

  const handleMudarAba = (novaAba: TabListagem) => {
    setAbaAtiva(novaAba);
    setPage(1);
  };

  const handleFilterChange = () => {
    setPage(1);
  };

  const handleLimparFiltros = () => {
    setProduto('');
    setEndereco('');
    setContagem('');
    setDataContagem('');
    setUsuarioId('');
    setOrdenacao('divergencia_prioritaria');
    setPage(1);
  };

  const handleAbrirDetalhes = async (itemId: string | number) => {
    if (!currentUser) return;
    setLoadingDetalhe(true);
    const resp = await inventarioService.obterDetalheContagem(itemId, currentUser.nivel);
    setLoadingDetalhe(false);

    if (!resp.success || !resp.data) {
      alert(resp.error || 'Erro ao carregar detalhes da contagem.');
      return;
    }

    setDetalheSelecionado(resp.data);
  };

  const handleItemAtualizadoNoModal = (updatedItem: DetalheContagem) => {
    setDetalheSelecionado(updatedItem);
    carregarContagens();
  };

  // Ação rápida: validar sobressalente direto na tabela
  const handleValidarRapido = async (e: React.MouseEvent, itemId: string | number) => {
    e.stopPropagation();
    if (!isAssistenteOuGestor || !currentUser) return;
    setValidandoId(itemId);
    try {
      await inventarioService.validarSobressalente(itemId, currentUser.id || currentUser.codigo || 'usr-gestor');
      carregarContagens();
    } catch (err) {
      console.error('Erro ao validar sobressalente:', err);
    } finally {
      setValidandoId(null);
    }
  };

  const formatarData = (dataStr?: string | null) => {
    if (!dataStr) return '—';
    try {
      const d = new Date(dataStr);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  const formatarStatus = (status: InventarioStatus, corrigido: boolean) => {
    const st = status || (corrigido ? 'validada' : 'pendente');
    switch (st) {
      case 'pendente':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">Pendente</span>;
      case 'contada':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">Contada</span>;
      case 'revisar':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">Revisar</span>;
      case 'revisada':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">Revisada</span>;
      case 'validada':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Validada</span>;
      case 'bloqueada':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">Bloqueada</span>;
      case 'invalidada':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-500/20 text-zinc-300 border border-zinc-500/40">Invalidada</span>;
      default:
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">Pendente</span>;
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-24 md:pb-12 animate-in fade-in duration-200">
      {/* Top Header com Ações no padrão PC */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="btn-voltar-da-listagem"
            onClick={onVoltar}
            className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title="Voltar ao início do inventário"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
              <h1 className="text-xl sm:text-2xl font-black text-white">
                Listar e Auditar Contagens
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Auditoria de divergências organizadas em três abas: Falta, Sobressalentes e Corrigidas.
            </p>
          </div>
        </div>

        {/* Botões de Ação no topo */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Botão: Importar Contagem (Excel) */}
          {isAssistenteOuGestor && (
            <button
              type="button"
              id="btn-abrir-importar-contagem-excel"
              onClick={() => setImportarModalOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-98 text-sky-300 border border-sky-500/30 text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-sky-400" />
              <span>Importar Contagem (Excel)</span>
            </button>
          )}

          {/* Botão: Gerar Romaneio de Contagem */}
          <button
            type="button"
            id="btn-abrir-gerar-romaneio-contagem"
            onClick={() => setRomaneioModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-500 active:scale-98 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-amber-600/25 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Gerar Romaneio (A4)</span>
          </button>

          <button
            type="button"
            id="btn-recarregar-contagens"
            onClick={carregarContagens}
            disabled={loading}
            className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title="Recarregar dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* AS TRÊS ABAS DO INVENTÁRIO (Requisito 6) */}
      <div className="flex border-b border-slate-800 bg-slate-900/60 rounded-2xl p-1.5 gap-2">
        {/* Aba 1: Falta */}
        <button
          type="button"
          id="tab-inventario-falta"
          onClick={() => handleMudarAba('falta')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
            abaAtiva === 'falta'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>Falta (Contada &lt; Disponível)</span>
          {abaAtiva === 'falta' && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
              {totalItens}
            </span>
          )}
        </button>

        {/* Aba 2: Sobressalentes */}
        <button
          type="button"
          id="tab-inventario-sobressalentes"
          onClick={() => handleMudarAba('sobressalentes')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
            abaAtiva === 'sobressalentes'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Package className="w-4 h-4 text-purple-400" />
          <span>Sobressalentes (Contada &gt; Disponível)</span>
          {abaAtiva === 'sobressalentes' && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {totalItens}
            </span>
          )}
        </button>

        {/* Aba 3: Corrigidas */}
        <button
          type="button"
          id="tab-inventario-corrigidas"
          onClick={() => handleMudarAba('corrigidas')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
            abaAtiva === 'corrigidas'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Corrigidas (Itens Resolvidos)</span>
          {abaAtiva === 'corrigidas' && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {totalItens}
            </span>
          )}
        </button>
      </div>

      {/* Painel de Filtros de Pesquisa */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-sky-400" />
            <span>Filtros da Listagem</span>
          </div>

          {(produto || endereco || contagem || dataContagem || usuarioId) && (
            <button
              type="button"
              onClick={handleLimparFiltros}
              className="text-xs text-sky-400 hover:text-sky-300 hover:underline font-semibold cursor-pointer"
            >
              Limpar filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Produto */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Produto</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                id="filtro-produto"
                value={produto}
                onChange={(e) => {
                  setProduto(e.target.value);
                  handleFilterChange();
                }}
                placeholder="Código ou descrição..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500 transition"
              />
            </div>
          </div>

          {/* Endereço */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Endereço</label>
            <div className="relative">
              <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                id="filtro-endereco"
                value={endereco}
                onChange={(e) => {
                  setEndereco(e.target.value);
                  handleFilterChange();
                }}
                placeholder="Ex: A-01-01..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500 transition font-mono uppercase"
              />
            </div>
          </div>

          {/* Nome da Contagem */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Contagem</label>
            <div className="relative">
              <Layers className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                id="filtro-contagem"
                value={contagem}
                onChange={(e) => {
                  setContagem(e.target.value);
                  handleFilterChange();
                }}
                placeholder="Ex: Contagem Geral..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500 transition font-mono"
              />
            </div>
          </div>

          {/* Usuário Contador */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Usuário</label>
            <select
              id="filtro-usuario"
              value={usuarioId}
              onChange={(e) => {
                setUsuarioId(e.target.value);
                handleFilterChange();
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden focus:border-sky-500 transition cursor-pointer"
            >
              <option value="">Todos os usuários</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.codigo || u.id}>
                  {u.nome} ({u.codigo})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* TABELA PRINCIPAL DE CONTAGENS (Foco PC/Desktop) */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-16 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-sky-400" />
            <p className="text-sm">Carregando contagens da aba "{abaAtiva}"...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-400 space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        ) : itens.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <Package className="w-12 h-12 mx-auto text-slate-600" />
            <p className="text-base font-bold text-white">Nenhum registro encontrado</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Nenhum item corresponde à aba selecionada ({abaAtiva}) e aos filtros aplicados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/70 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4 font-bold">Produto</th>
                  <th className="py-3 px-4 font-bold font-mono">Endereço</th>
                  <th className="py-3 px-4 font-bold text-right">Disponível</th>
                  <th className="py-3 px-4 font-bold text-right">Contada</th>
                  <th className="py-3 px-4 font-bold text-right">Diferença</th>
                  <th className="py-3 px-4 font-bold text-center">Status</th>
                  <th className="py-3 px-4 font-bold">Contagem</th>
                  <th className="py-3 px-4 font-bold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {itens.map((item) => {
                  const disp = Number(item.qtd_disponivel) || 0;
                  const cont = item.qtd_contada !== null && item.qtd_contada !== undefined ? Number(item.qtd_contada) : null;
                  const diff = cont !== null ? cont - disp : 0;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleAbrirDetalhes(item.id)}
                      className="hover:bg-slate-800/50 transition cursor-pointer group"
                    >
                      {/* Produto */}
                      <td className="py-3 px-4">
                        <strong className="text-white font-bold block text-sm group-hover:text-sky-400 transition">
                          {item.produto}
                        </strong>
                      </td>

                      {/* Endereço */}
                      <td className="py-3 px-4 font-mono font-bold text-sky-400">
                        {item.endereco}
                      </td>

                      {/* Quantidade Disponível */}
                      <td className="py-3 px-4 text-right font-mono text-slate-300 font-semibold">
                        {disp}
                      </td>

                      {/* Quantidade Contada */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        {cont !== null ? cont : <span className="text-slate-500">—</span>}
                      </td>

                      {/* Diferença */}
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        {cont !== null ? (
                          <span className={diff === 0 ? 'text-slate-400' : diff < 0 ? 'text-rose-400' : 'text-purple-400'}>
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {formatarStatus(item.status, item.corrigido)}
                      </td>

                      {/* Contagem */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                        {item.contagem || <span className="text-slate-600">—</span>}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Ação rápida de validação para Gestor / Assistente na aba Sobressalentes */}
                          {abaAtiva === 'sobressalentes' && isAssistenteOuGestor && item.status !== 'validada' && (
                            <button
                              type="button"
                              onClick={(e) => handleValidarRapido(e, item.id)}
                              disabled={validandoId === item.id}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition flex items-center gap-1 shadow cursor-pointer"
                              title="Validar divergência positiva sem ajuste"
                            >
                              <Check className="w-3 h-3" />
                              <span>Validar</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleAbrirDetalhes(item.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                            title="Ver detalhes completos do produto"
                          >
                            <Eye className="w-4 h-4 text-sky-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer com Paginação */}
        {totalItens > 0 && (
          <div className="p-4 bg-slate-950/80 border-t border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span>Total: <strong className="text-white font-mono">{totalItens}</strong> registros</span>
              <span className="text-slate-600">&bull;</span>
              <span>Página <strong className="text-white font-mono">{page}</strong> de <strong className="text-white font-mono">{totalPages}</strong></span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1 || loading}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 font-semibold text-xs min-h-[36px] cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>

              <span className="px-3 py-1.5 font-mono font-bold text-white bg-slate-900 rounded-xl border border-slate-800 text-xs min-h-[36px] flex items-center justify-center">
                {page} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages || loading}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 font-semibold text-xs min-h-[36px] cursor-pointer"
              >
                <span>Próxima</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Detalhes da Contagem */}
      {detalheSelecionado && (
        <DetalhesContagemModal
          item={detalheSelecionado}
          currentUser={currentUser}
          onClose={() => setDetalheSelecionado(null)}
          onItemUpdated={handleItemAtualizadoNoModal}
        />
      )}

      {/* Modal: Importar Contagem (Excel) */}
      {importarModalOpen && (
        <ImportarContagemModal
          currentUser={currentUser}
          onClose={() => setImportarModalOpen(false)}
          onSuccess={() => carregarContagens()}
        />
      )}

      {/* Modal: Gerar Romaneio de Contagem (A4) */}
      {romaneioModalOpen && (
        <RomaneioContagemModal
          currentUser={currentUser}
          contagemNome={contagem || undefined}
          onClose={() => setRomaneioModalOpen(false)}
        />
      )}
    </div>
  );
};
