import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Package,
  MapPin,
  RefreshCw,
  Search,
  X,
  Clock,
  ChevronRight,
  Inbox,
  Filter,
  Layers,
  Calendar,
  FileText,
  Building2,
} from 'lucide-react';
import { RecebimentoProduto } from '../../types';
import { alocacaoService, extrairPrimeiroNomeFabricante } from '../../services/alocacaoService';
import { isEnderecoSemLocacao, formatarEnderecoDisplay } from '../../lib/enderecos';

interface ProdutosPendentesAlocacaoViewProps {
  onSelecionarProduto: (produto: RecebimentoProduto) => void;
  onAlternarModoVisualizacao?: () => void;
  onVoltar: () => void;
}

/**
 * Formata a data de recebimento para o formato amigável DD/MM/AAAA.
 */
function formatarDataRecebimento(dataStr?: string | null): string {
  if (!dataStr) return '--/--/----';
  const clean = dataStr.trim().slice(0, 10);
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dataStr;
}

export const ProdutosPendentesAlocacaoView: React.FC<ProdutosPendentesAlocacaoViewProps> = ({
  onSelecionarProduto,
  onAlternarModoVisualizacao,
  onVoltar,
}) => {
  const [produtos, setProdutos] = useState<RecebimentoProduto[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [filtroData, setFiltroData] = useState('');
  const [filtroNF, setFiltroNF] = useState('');
  const [mostrarFiltrosAvancados, setMostrarFiltrosAvancados] = useState(false);

  const carregarProdutos = useCallback(async () => {
    try {
      setLoading(true);
      const data = await alocacaoService.listarProdutosPendentesAlocacao({
        dataRecebimento: filtroData || undefined,
        notaFiscal: filtroNF || undefined,
      });
      setProdutos(data);
    } catch (err) {
      console.error('Erro ao carregar produtos pendentes de alocação:', err);
    } finally {
      setLoading(false);
    }
  }, [filtroData, filtroNF]);

  useEffect(() => {
    carregarProdutos();
  }, [carregarProdutos]);

  // Filtro de busca textual em memória (já ordenado pela regra tripla na origem)
  const produtosFiltrados = useMemo(() => {
    if (!termoPesquisa.trim()) return produtos;
    const term = termoPesquisa.trim().toLowerCase();
    return produtos.filter((p) => {
      const prod = (p.produto || '').toLowerCase();
      const nf = (p.nota_fiscal || '').toLowerCase();
      const end = (p.endereco || '').toLowerCase();
      const nEnd = (p.novo_endereco || '').toLowerCase();
      const fab = (p.fabricante || '').toLowerCase();
      const forn = (p.fornecedor || '').toLowerCase();
      return (
        prod.includes(term) ||
        nf.includes(term) ||
        end.includes(term) ||
        nEnd.includes(term) ||
        fab.includes(term) ||
        forn.includes(term)
      );
    });
  }, [produtos, termoPesquisa]);

  const totalQuantidade = useMemo(
    () => produtosFiltrados.reduce((acc, p) => acc + (Number(p.quantidade) || 0), 0),
    [produtosFiltrados]
  );

  const temFiltroAtivo = Boolean(filtroData || filtroNF || termoPesquisa);

  const handleLimparFiltros = () => {
    setTermoPesquisa('');
    setFiltroData('');
    setFiltroNF('');
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-24 md:pb-12 animate-in fade-in duration-200">
      {/* Top Bar with Back and Actions */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          id="btn-voltar-menu-alocacao"
          onClick={onVoltar}
          className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition min-h-[44px] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Menu</span>
        </button>

        <div className="flex items-center gap-2">
          {onAlternarModoVisualizacao && (
            <button
              type="button"
              id="btn-alternar-modo-notas"
              onClick={onAlternarModoVisualizacao}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-blue-500/40 text-slate-300 hover:text-blue-300 text-xs font-semibold transition min-h-[44px] cursor-pointer"
              title="Visualizar agrupado por Notas Fiscais"
            >
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Ver por Notas</span>
            </button>
          )}

          <button
            type="button"
            id="btn-recarregar-produtos-pendentes"
            onClick={carregarProdutos}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition min-h-[44px] cursor-pointer disabled:opacity-50"
            title="Recarregar produtos pendentes"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Header da Tela: Produtos Pendentes de Alocação */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                Alocação Física
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Produtos Conferidos
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Package className="w-6 h-6 text-blue-400" />
              <span>Produtos para Alocação</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
              Lista inicial de produtos aguardando alocação física no estoque, exibindo dados de recebimento, nota fiscal e fabricante.
            </p>
          </div>

          {/* Mini resumo de pendências */}
          <div className="flex items-center gap-3 bg-slate-950/70 border border-slate-800/90 rounded-2xl p-3 shrink-0">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Itens Pendentes
              </span>
              <span className="text-lg font-black font-mono text-amber-400">
                {produtosFiltrados.length}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Qtd Total
              </span>
              <span className="text-lg font-black font-mono text-slate-200">
                {totalQuantidade} un
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Pesquisa e Filtros */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3 shadow-lg space-y-3">
        <div className="flex items-center gap-2">
          {/* Campo de Busca Rápida */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              id="input-pesquisa-produtos-pendentes"
              value={termoPesquisa}
              onChange={(e) => setTermoPesquisa(e.target.value)}
              placeholder="Pesquisar por produto, NF, fabricante ou endereço..."
              className="w-full pl-10 pr-10 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition min-h-[44px]"
            />
            {termoPesquisa && (
              <button
                type="button"
                id="btn-limpar-pesquisa-pendentes"
                onClick={() => setTermoPesquisa('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title="Limpar pesquisa"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Botão de Toggle Filtros Avançados */}
          <button
            type="button"
            id="btn-toggle-filtros-avancados"
            onClick={() => setMostrarFiltrosAvancados((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-bold transition min-h-[44px] shrink-0 cursor-pointer ${
              mostrarFiltrosAvancados || filtroData || filtroNF
                ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filtros</span>
          </button>
        </div>

        {/* Linha retrátil de filtros por Data e Nota Fiscal */}
        {mostrarFiltrosAvancados && (
          <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-150">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Data de Recebimento
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={filtroData}
                  onChange={(e) => setFiltroData(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950/90 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Filtrar por Nota Fiscal
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={filtroNF}
                  onChange={(e) => setFiltroNF(e.target.value)}
                  placeholder="Ex: 007.412.301"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950/90 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Linha de Status / Indicador de Ordenação e Limpeza */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-400">
          <div className="flex flex-wrap items-center gap-1.5">
            <span>
              Mostrando <strong className="text-white font-mono">{produtosFiltrados.length}</strong> de{' '}
              <strong className="text-white font-mono">{produtos.length}</strong> {produtos.length === 1 ? 'produto' : 'produtos'}
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-blue-400 font-medium">
              Ordenação: Data mais recente → NF → Produto A-Z
            </span>
          </div>

          {temFiltroAtivo && (
            <button
              type="button"
              id="btn-limpar-todos-filtros"
              onClick={handleLimparFiltros}
              className="text-amber-400 hover:text-amber-300 transition text-[11px] underline underline-offset-2 cursor-pointer font-semibold"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Lista de Produtos Pendentes (Layout Mobile e Desktop Otimizado) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Produtos Aguardando Alocação ({produtosFiltrados.length})
          </span>
          <span className="text-[11px] text-slate-500">Toque no card para registrar endereço</span>
        </div>

        {loading ? (
          <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-3xl">
            <RefreshCw className="w-7 h-7 text-blue-400 animate-spin mx-auto mb-3" />
            <span className="text-xs sm:text-sm text-slate-400 font-medium">
              Carregando produtos pendentes de alocação...
            </span>
          </div>
        ) : produtos.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-3xl space-y-3">
            <Inbox className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-white">
              Nenhum produto pendente de alocação no momento.
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Todos os produtos conferidos no recebimento já foram devidamente alocados com endereço no estoque.
            </p>
          </div>
        ) : produtosFiltrados.length === 0 ? (
          <div className="p-10 text-center bg-slate-900/50 border border-slate-800 rounded-3xl space-y-3">
            <Search className="w-9 h-9 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-white">
              Nenhum produto encontrado com os filtros atuais.
            </p>
            <p className="text-xs text-slate-400">
              Tente buscar por outro termo, limpar a pesquisa ou redefinir a data/NF.
            </p>
            <button
              type="button"
              onClick={handleLimparFiltros}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition min-h-[40px] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpar filtros</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {produtosFiltrados.map((p) => {
              const qtd = Number(p.quantidade) || 0;
              const fabricanteCompleto = p.fabricante || p.fornecedor || 'Fabricante não informado';
              const primeiroNomeFab = extrairPrimeiroNomeFabricante(fabricanteCompleto);
              const enderecoAtual = p.novo_endereco || p.endereco;
              const semLocacao = isEnderecoSemLocacao(enderecoAtual);
              const enderecoFormatado = formatarEnderecoDisplay(enderecoAtual);

              return (
                <div
                  key={p.id}
                  id={`card-produto-pendente-${p.id}`}
                  onClick={() => onSelecionarProduto(p)}
                  className="cursor-pointer group bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99] shadow-lg flex flex-col gap-3"
                >
                  {/* Bloco Superior: Lado Esquerdo vs Lado Direito */}
                  <div className="flex items-start justify-between gap-3">
                    {/* Lado Esquerdo: Nome do Produto grande - Data recebimento menor / Abaixo: Status */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2">
                        <h4 className="text-base sm:text-lg font-black text-white group-hover:text-blue-400 transition leading-snug">
                          {p.produto}
                        </h4>
                        <span className="text-xs text-slate-400 font-mono font-medium whitespace-nowrap">
                          - {formatarDataRecebimento(p.data_recebimento)}
                        </span>
                      </div>

                      {/* Abaixo o status aguardando alocação */}
                      <div className="mt-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          <Clock className="w-3 h-3 text-amber-400" />
                          Aguardando Alocação
                        </span>
                      </div>
                    </div>

                    {/* Lado Direito: Primeiro nome do fabricante acima / Número da nota abaixo */}
                    <div className="text-right shrink-0">
                      <div
                        className="text-xs sm:text-sm font-black text-slate-200 uppercase tracking-wide truncate max-w-[150px] sm:max-w-[200px]"
                        title={fabricanteCompleto}
                      >
                        {primeiroNomeFab}
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5 font-semibold">
                        NF {p.nota_fiscal}
                      </div>
                    </div>
                  </div>

                  {/* Linha que corta o bloco */}
                  <div className="flex items-center justify-between gap-4 pt-3 border-t border-slate-800/80">
                    {/* Manter quantidade grande e visivel e remover saldo final */}
                    <div className="text-left">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block leading-tight">
                        Quantidade
                      </span>
                      <span className="text-base sm:text-lg font-black font-mono text-white">
                        {qtd} <span className="text-xs text-slate-400 font-normal">un</span>
                      </span>
                    </div>

                    {/* No local do saldo final colocar o endereço e manter o botão de proximo */}
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block leading-tight">
                          Endereço
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-xs sm:text-sm font-bold font-mono px-2 py-0.5 rounded-lg border ${
                            semLocacao
                              ? 'bg-amber-950/70 border-amber-800/60 text-amber-300'
                              : 'bg-slate-950/70 border-slate-800 text-blue-400'
                          }`}
                        >
                          <MapPin
                            className={`w-3.5 h-3.5 ${
                              semLocacao ? 'text-amber-400' : 'text-blue-400'
                            }`}
                          />
                          <span>{enderecoFormatado}</span>
                        </span>
                      </div>

                      {/* Botão de próximo mantido */}
                      <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:bg-blue-600 transition shrink-0">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
