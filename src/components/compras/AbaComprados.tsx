import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Search,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Package,
  User,
  Calendar,
  CheckCheck,
  Building2,
  Filter,
  Loader2,
  X,
  Clock,
  Sparkles,
  Flame,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SolicitacaoCompra, Produto, Usuario, FiltrosCompra, RespostaPaginadaCompras } from '../../types';
import { comprasService } from '../../services/comprasService';
import { produtosService } from '../../services/produtosService';
import { usuariosService } from '../../services/usuariosService';
import { useAuth } from '../../context/AuthContext';

export const AbaComprados: React.FC = () => {
  const { user } = useAuth();

  // Listas auxiliares de filtros
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [fabricantes, setFabricantes] = useState<string[]>([]);

  // Filtros selecionáveis pelo usuário
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [solicitanteId, setSolicitanteId] = useState('Todos');
  const [produtoId, setProdutoId] = useState('Todos');
  const [fabricante, setFabricante] = useState('Todos');
  const [termoBusca, setTermoBusca] = useState('');

  // Estado da Pesquisa Sob Demanda
  // Regra 7.1: Não carregar automaticamente os registros ao entrar na aba
  const [pesquisaExecutada, setPesquisaExecutada] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [erroFiltro, setErroFiltro] = useState<string | null>(null);

  // Paginação 50 registros por página
  const [dadosPaginados, setDadosPaginados] = useState<RespostaPaginadaCompras>({
    itens: [],
    totalRegistros: 0,
    paginaAtual: 1,
    totalPaginas: 1,
    limitePorPagina: 50,
  });

  // Filtros ativos congelados na última pesquisa executada
  const [filtrosAtivos, setFiltrosAtivos] = useState<FiltrosCompra | null>(null);

  useEffect(() => {
    const carregarAuxiliares = async () => {
      try {
        const [prods, usrs] = await Promise.all([
          produtosService.listarTodos(),
          usuariosService.listarTodos(),
        ]);
        setProdutos(prods);
        setUsuarios(usrs);

        const fabs = Array.from(
          new Set(
            prods
              .map((p) => p.fabricante?.trim())
              .filter((f): f is string => Boolean(f && f.length > 0))
          )
        ).sort();
        setFabricantes(fabs);
      } catch (e) {
        console.warn('Erro ao carregar dados de filtros em Comprados:', e);
      }
    };

    carregarAuxiliares();
  }, []);

  // Verifica se o usuário informou pelo menos 1 critério de filtro
  const possuiAoMenosUmFiltro = Boolean(
    dataInicio ||
    dataFim ||
    solicitanteId !== 'Todos' ||
    produtoId !== 'Todos' ||
    fabricante !== 'Todos' ||
    termoBusca.trim()
  );

  const executarPesquisa = async (paginaAlvo = 1) => {
    setErroFiltro(null);

    // Regra 7.2: O usuário deve selecionar pelo menos um filtro para prosseguir com a pesquisa
    if (!possuiAoMenosUmFiltro) {
      setErroFiltro('Selecione pelo menos um filtro para prosseguir com a pesquisa do histórico de compras.');
      return;
    }

    setCarregando(true);
    const filtros: FiltrosCompra = {
      unidade_negocio: user?.unidade_negocio,
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
      solicitanteId: solicitanteId !== 'Todos' ? solicitanteId : undefined,
      produtoId: produtoId !== 'Todos' ? produtoId : undefined,
      fabricante: fabricante !== 'Todos' ? fabricante : undefined,
      termoBusca: termoBusca.trim() || undefined,
    };

    try {
      const res = await comprasService.listarCompradosPaginados(filtros, paginaAlvo, 50);
      setDadosPaginados(res);
      setFiltrosAtivos(filtros);
      setPesquisaExecutada(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao consultar histórico de compras.';
      setErroFiltro(msg);
    } finally {
      setCarregando(false);
    }
  };

  const handleMudarPagina = (novaPagina: number) => {
    if (novaPagina < 1 || novaPagina > dadosPaginados.totalPaginas || carregando) return;
    executarPesquisa(novaPagina);
  };

  const handleLimparFiltros = () => {
    setDataInicio('');
    setDataFim('');
    setSolicitanteId('Todos');
    setProdutoId('Todos');
    setFabricante('Todos');
    setTermoBusca('');
    setErroFiltro(null);
  };

  // 7.4. EXPORTAR PLANILHA: exporta todos os registros correspondentes aos filtros ativos (não apenas 50)
  const handleExportarPlanilhaCompleta = async () => {
    if (!filtrosAtivos || exportando) return;

    setExportando(true);
    try {
      const todosRegistros = await comprasService.listarTodosCompradosParaExportacao(filtrosAtivos);

      const dadosExportacao = todosRegistros.map((item) => ({
        Produto: item.produto_nome || 'Produto',
        Fabricante: item.produto_fabricante || 'Fabricante não informado',
        Solicitante: item.solicitante_nome || 'Solicitante',
        'Quantidade Solicitada': item.quantidade,
        'Quantidade Comprada': item.quantidade_aprovada ?? item.quantidade,
        'Data da Solicitação': item.data_insercao
          ? new Date(item.data_insercao).toLocaleString('pt-BR')
          : '',
        'Data da Compra': item.data_compra
          ? new Date(item.data_compra).toLocaleString('pt-BR')
          : '',
        'Usuário Comprador': item.usuario_compra_nome || '',
        'Gestor Aprovador': item.usuario_aprovacao_nome || '',
        Demanda: item.demanda,
        Urgência: item.urgencia,
        Status: item.status,
        Observação: item.observacao || '',
      }));

      const worksheet = XLSX.utils.json_to_sheet(dadosExportacao);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Histórico de Compras');

      const dataHoje = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(
        workbook,
        `PoliHub_Historico_Compras_${user?.unidade_negocio || 'Goiânia'}_${dataHoje}.xlsx`
      );
    } catch (err) {
      console.warn('Erro ao exportar planilha completa de compras:', err);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 7.1. ÁREA DE FILTROS SOB DEMANDA */}
      <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Filtros de Pesquisa do Histórico</h3>
              <p className="text-xs text-slate-400">
                Selecione pelo menos um critério e clique no botão Pesquisar abaixo
              </p>
            </div>
          </div>

          {possuiAoMenosUmFiltro && (
            <button
              type="button"
              onClick={handleLimparFiltros}
              className="text-xs text-slate-400 hover:text-white underline font-semibold"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {erroFiltro && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-amber-200 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{erroFiltro}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* 1. Data Inicial */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold block">Data Solicitação (Inicial):</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* 2. Data Final */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold block">Data Solicitação (Final):</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* 3. Solicitante */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold block">Solicitante:</label>
            <select
              value={solicitanteId}
              onChange={(e) => setSolicitanteId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
            >
              <option value="Todos">Todos os solicitantes</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome} ({u.departamento})
                </option>
              ))}
            </select>
          </div>

          {/* 4. Fabricante */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold block">Fabricante:</label>
            <select
              value={fabricante}
              onChange={(e) => setFabricante(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
            >
              <option value="Todos">Todos os fabricantes</option>
              {fabricantes.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Produto */}
          <div className="space-y-1 sm:col-span-2">
            <label className="text-slate-400 font-semibold block">Produto Específico:</label>
            <select
              value={produtoId}
              onChange={(e) => setProdutoId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
            >
              <option value="Todos">Todos os produtos</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.produto} ({p.fabricante || 'Geral'})
                </option>
              ))}
            </select>
          </div>

          {/* 6. Busca Livre */}
          <div className="space-y-1 sm:col-span-2">
            <label className="text-slate-400 font-semibold block">Palavra-chave / Descrição:</label>
            <input
              type="text"
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              placeholder="Digite para buscar em observação, produto..."
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500 placeholder-slate-500"
            />
          </div>
        </div>

        {/* 7.2. BOTÃO PESQUISAR GRANDE E VISÍVEL */}
        <div className="pt-2">
          <button
            type="button"
            id="btn-pesquisar-comprados"
            onClick={() => executarPesquisa(1)}
            disabled={carregando}
            className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm tracking-wide transition flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {carregando ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Consultando histórico de compras no Supabase...</span>
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                <span>PESQUISAR NO HISTÓRICO DE COMPRAS</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 7.3. RESULTADO DA PESQUISA & TABELA COM PAGINAÇÃO */}
      {!pesquisaExecutada ? (
        <div className="p-12 text-center rounded-3xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-white">Nenhuma consulta realizada</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Por desempenho e segurança, os registros de compras concluídas são carregados sob demanda.
            Selecione seus filtros acima e clique em <strong>PESQUISAR</strong> para exibir os resultados.
          </p>
        </div>
      ) : dadosPaginados.itens.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-slate-900/60 border border-slate-800 space-y-2">
          <Package className="w-10 h-10 text-slate-600 mx-auto" />
          <h4 className="text-base font-bold text-white">Nenhum registro encontrado</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Não foram encontradas compras concluídas que correspondam aos filtros selecionados. Tente ajustar o período ou o solicitante.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Header dos Resultados com Botão Exportar Planilha */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2">
            <div className="text-xs text-slate-400">
              <span>
                Total encontrado: <strong className="text-white">{dadosPaginados.totalRegistros}</strong> compras
              </span>
              <span className="mx-2">&bull;</span>
              <span>Página {dadosPaginados.paginaAtual} de {dadosPaginados.totalPaginas}</span>
            </div>

            {/* 7.4. Botão Exportar Planilha */}
            <button
              type="button"
              onClick={handleExportarPlanilhaCompleta}
              disabled={exportando}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-blue-600/20 disabled:opacity-50"
            >
              {exportando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gerando Excel...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Exportar Planilha Completa ({dadosPaginados.totalRegistros})</span>
                </>
              )}
            </button>
          </div>

          {/* Tabela de Comprados */}
          <div className="rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Data Solicitação</th>
                    <th className="py-3.5 px-4">Produto</th>
                    <th className="py-3.5 px-4 text-center">Qtd. Solicitada</th>
                    <th className="py-3.5 px-4 text-center">Qtd. Comprada</th>
                    <th className="py-3.5 px-4 text-center">Demanda</th>
                    <th className="py-3.5 px-4">Solicitante</th>
                    <th className="py-3.5 px-4">Data Compra</th>
                    <th className="py-3.5 px-4">Comprador</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {dadosPaginados.itens.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                      {/* Data Solicitação */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-300 font-mono text-[11px]">
                        {item.data_insercao
                          ? new Date(item.data_insercao).toLocaleDateString('pt-BR')
                          : '-'}
                      </td>

                      {/* Produto */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-bold text-white truncate">{item.produto_nome}</div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {item.produto_fabricante || 'Fabricante não informado'}
                          {item.produto_codigo_barras ? ` • ${item.produto_codigo_barras}` : ''}
                        </div>
                      </td>

                      {/* Qtd Solicitada */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono text-xs text-slate-400">
                          {item.quantidade} un.
                        </span>
                      </td>

                      {/* Qtd Comprada */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono font-black text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                          {item.quantidade_aprovada ?? item.quantidade} un.
                        </span>
                      </td>

                      {/* Demanda */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${
                            item.demanda === 'Estoque'
                              ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                              : item.demanda === 'Sob Encomenda' || item.demanda === 'Necessidade'
                              ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                              : 'bg-teal-500/15 text-teal-300 border-teal-500/30'
                          }`}
                        >
                          {item.demanda}
                        </span>
                      </td>

                      {/* Solicitante com ícone padrão de usuário */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center">
                            <User className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="font-semibold text-white block text-xs truncate max-w-[120px]">
                              {item.solicitante_nome}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {item.solicitante_departamento}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Data Compra */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-emerald-300 font-mono text-[11px]">
                        {item.data_compra
                          ? new Date(item.data_compra).toLocaleDateString('pt-BR')
                          : '-'}
                      </td>

                      {/* Comprador com ícone padrão */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-slate-300">
                          <CheckCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate max-w-[120px]">
                            {item.usuario_compra_nome || 'Setor de Compras'}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          <CheckCheck className="w-3 h-3 text-emerald-400" />
                          <span>Comprado</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 7.3. Controles de Paginação (50 registros por página) */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-slate-800 bg-slate-950/60 text-xs">
              <div className="text-slate-400">
                Página <strong className="text-white">{dadosPaginados.paginaAtual}</strong> de{' '}
                <strong className="text-white">{dadosPaginados.totalPaginas}</strong> (
                {dadosPaginados.totalRegistros} compras registradas)
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleMudarPagina(dadosPaginados.paginaAtual - 1)}
                  disabled={dadosPaginados.paginaAtual <= 1 || carregando}
                  className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Anterior</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleMudarPagina(dadosPaginados.paginaAtual + 1)}
                  disabled={dadosPaginados.paginaAtual >= dadosPaginados.totalPaginas || carregando}
                  className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold"
                >
                  <span>Próxima</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
