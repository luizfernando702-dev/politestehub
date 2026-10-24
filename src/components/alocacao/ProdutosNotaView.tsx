import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Package,
  MapPin,
  RefreshCw,
  AlertTriangle,
  Layers,
  FileText,
  Calendar,
  ChevronRight,
  Inbox,
  Sparkles,
  Building2,
  Search,
  X,
  Clock,
  ArrowDownAZ,
  ArrowUpZA,
} from 'lucide-react';
import { RecebimentoProduto, ResumoNotaAlocacao } from '../../types';
import { alocacaoService, extrairPrimeiroNomeFabricante } from '../../services/alocacaoService';
import { DetalheProdutoModal } from './DetalheProdutoModal';
import { isEnderecoSemLocacao, formatarEnderecoDisplay } from '../../lib/enderecos';

interface ProdutosNotaViewProps {
  nota: ResumoNotaAlocacao;
  onVoltar: () => void;
}

export const ProdutosNotaView: React.FC<ProdutosNotaViewProps> = ({
  nota,
  onVoltar,
}) => {
  const [produtos, setProdutos] = useState<RecebimentoProduto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduto, setSelectedProduto] = useState<RecebimentoProduto | null>(null);

  // Estados de pesquisa e ordenação alfabética
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [ordemAlfabetica, setOrdemAlfabetica] = useState<'asc' | 'desc'>('asc');

  const carregarProdutos = useCallback(async () => {
    try {
      setLoading(true);
      const data = await alocacaoService.listarProdutosDaNota(nota.nota_fiscal);
      setProdutos(data);
    } catch (err) {
      console.error('Erro ao carregar produtos da nota:', err);
    } finally {
      setLoading(false);
    }
  }, [nota.nota_fiscal]);

  useEffect(() => {
    carregarProdutos();
  }, [carregarProdutos]);

  // Filtro de pesquisa e ordenação alfabética por nome do produto
  const produtosProcessados = useMemo(() => {
    let lista = [...produtos];

    if (termoPesquisa.trim()) {
      const term = termoPesquisa.trim().toLowerCase();
      lista = lista.filter((p) => {
        const nome = (p.produto || '').toLowerCase();
        const endereco = (p.endereco || '').toLowerCase();
        const novoEndereco = (p.novo_endereco || '').toLowerCase();
        const idStr = String(p.id || '');
        return (
          nome.includes(term) ||
          endereco.includes(term) ||
          novoEndereco.includes(term) ||
          idStr.includes(term)
        );
      });
    }

    lista.sort((a, b) => {
      const cmp = (a.produto || '').localeCompare(b.produto || '', 'pt-BR', {
        sensitivity: 'base',
        numeric: true,
      });
      return ordemAlfabetica === 'asc' ? cmp : -cmp;
    });

    return lista;
  }, [produtos, termoPesquisa, ordemAlfabetica]);

  const totalQuantidade = produtos.reduce((acc, p) => acc + (Number(p.quantidade) || 0), 0);
  const totalSaldoPendente = produtos.reduce((acc, p) => acc + (Number(p.saldo_final) || 0), 0);

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-24 md:pb-12">
      {/* Top Bar with Back Button */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          id="btn-voltar-notas-alocacao"
          onClick={onVoltar}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition min-h-[44px] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar às Notas</span>
        </button>

        <button
          type="button"
          id="btn-recarregar-produtos-alocacao"
          onClick={carregarProdutos}
          disabled={loading}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition min-h-[44px] cursor-pointer disabled:opacity-50"
          title="Recarregar produtos"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Header da Tela: Produtos para Alocação */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                Alocação Física
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                {nota.data_recebimento}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-400" />
              <span>Produtos para Alocação</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
              <span>
                Nota Fiscal: <strong className="text-white font-mono">{nota.nota_fiscal}</strong>
              </span>
              {nota.fornecedor && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-slate-300">
                    <Building2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Fornecedor:</span>
                    <strong className="text-white">{nota.fornecedor}</strong>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Mini resumo do saldo da nota */}
          <div className="flex items-center gap-2 bg-slate-950/70 border border-slate-800/90 rounded-2xl p-3">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Saldo a Alocar
              </span>
              <span
                className={`text-lg font-black font-mono ${
                  totalSaldoPendente === 0 ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {totalSaldoPendente} un
              </span>
            </div>
            <div className="h-8 w-px bg-slate-800 mx-1" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Total Recebido
              </span>
              <span className="text-lg font-black text-slate-200 font-mono">
                {totalQuantidade} un
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Pesquisa e Ordenação Alfabética dos Produtos */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3 shadow-lg space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Campo de Busca */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              id="input-pesquisa-produtos-alocacao"
              value={termoPesquisa}
              onChange={(e) => setTermoPesquisa(e.target.value)}
              placeholder="Pesquisar produto por nome, código ou endereço..."
              className="w-full pl-10 pr-10 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition min-h-[44px]"
            />
            {termoPesquisa && (
              <button
                type="button"
                id="btn-limpar-pesquisa-produtos-alocacao"
                onClick={() => setTermoPesquisa('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                title="Limpar pesquisa"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Botão de Alternância de Ordem Alfabética (A-Z / Z-A) */}
          <button
            type="button"
            id="btn-ordenar-alfabetica-produtos-alocacao"
            onClick={() => setOrdemAlfabetica((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition min-h-[44px] shrink-0 cursor-pointer ${
              ordemAlfabetica === 'asc'
                ? 'bg-blue-600/15 border-blue-500/40 text-blue-300 hover:bg-blue-600/25'
                : 'bg-indigo-600/15 border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/25'
            }`}
            title={`Ordenar em ordem ${ordemAlfabetica === 'asc' ? 'Z-A' : 'A-Z'}`}
          >
            {ordemAlfabetica === 'asc' ? (
              <>
                <ArrowDownAZ className="w-4 h-4 text-blue-400" />
                <span>Ordem: A → Z</span>
              </>
            ) : (
              <>
                <ArrowUpZA className="w-4 h-4 text-indigo-400" />
                <span>Ordem: Z → A</span>
              </>
            )}
          </button>
        </div>

        {/* Linha de Status / Contador de Produtos */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <span>
              Mostrando <strong className="text-white font-mono">{produtosProcessados.length}</strong> de{' '}
              <strong className="text-white font-mono">{produtos.length}</strong> {produtos.length === 1 ? 'produto' : 'produtos'}
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-blue-400 font-medium">Ordem alfabética ativa</span>
          </div>

          {termoPesquisa && (
            <button
              type="button"
              id="btn-limpar-filtro-tag"
              onClick={() => setTermoPesquisa('')}
              className="text-slate-400 hover:text-amber-300 transition text-[11px] underline underline-offset-2 cursor-pointer"
            >
              Limpar filtro de busca
            </button>
          )}
        </div>
      </div>

      {/* Lista de Produtos (Otimizada para Celular / Toque) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Produtos da Carga ({produtosProcessados.length})
          </span>
          <span className="text-[11px] text-slate-500">Toque no produto para alocar endereço</span>
        </div>

        {loading ? (
          <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-3xl">
            <RefreshCw className="w-6 h-6 text-blue-400 animate-spin mx-auto mb-2" />
            <span className="text-xs text-slate-400">Carregando produtos recebidos...</span>
          </div>
        ) : produtos.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-3xl space-y-2">
            <Inbox className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-white">Nenhum produto registrado nesta nota fiscal.</p>
            <p className="text-xs text-slate-400">
              Verifique no módulo de Agendamentos a confirmação dos produtos recebidos.
            </p>
          </div>
        ) : produtosProcessados.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-3xl space-y-3">
            <Search className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-white">
              Nenhum produto encontrado para &quot;{termoPesquisa}&quot;.
            </p>
            <p className="text-xs text-slate-400">
              Tente buscar por outras palavras, código ou endereço.
            </p>
            <button
              type="button"
              id="btn-limpar-pesquisa-vazio"
              onClick={() => setTermoPesquisa('')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition min-h-[40px] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpar pesquisa</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {produtosProcessados.map((p) => {
              const qtd = Number(p.quantidade) || 0;
              const fabricanteCompleto = p.fabricante || nota.fornecedor || 'Fabricante não informado';
              const primeiroNomeFab = extrairPrimeiroNomeFabricante(fabricanteCompleto);
              const dataRecebimentoFormatada = (p.data_recebimento || nota.data_recebimento || '')
                .slice(0, 10)
                .split('-')
                .reverse()
                .join('/');
              const enderecoAtual = p.novo_endereco || p.endereco;
              const semLocacao = isEnderecoSemLocacao(enderecoAtual);
              const enderecoFormatado = formatarEnderecoDisplay(enderecoAtual);

              return (
                <div
                  key={p.id}
                  id={`card-produto-${p.id}`}
                  onClick={() => setSelectedProduto(p)}
                  className="cursor-pointer group bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99] shadow-lg flex flex-col gap-3"
                >
                  {/* Bloco Superior: Lado Esquerdo vs Lado Direito */}
                  <div className="flex items-start justify-between gap-3">
                    {/* Lado Esquerdo: Nome do Produto bem grande - Data recebimento menor / Abaixo: Status */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2">
                        <h4 className="text-base sm:text-lg font-black text-white group-hover:text-blue-400 transition leading-snug">
                          {p.produto}
                        </h4>
                        <span className="text-xs text-slate-400 font-mono font-medium whitespace-nowrap">
                          - {dataRecebimentoFormatada || '--/--/----'}
                        </span>
                      </div>

                      {/* Abaixo o status */}
                      <div className="mt-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            p.status === 'Alocado'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          {p.status === 'Alocado' ? 'Alocado' : 'Aguardando Alocação'}
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
                        NF {p.nota_fiscal || nota.nota_fiscal}
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

      {/* Modal de Detalhes do Produto & Alteração */}
      {selectedProduto && (
        <DetalheProdutoModal
          produto={selectedProduto}
          onClose={() => setSelectedProduto(null)}
          onProdutoAtualizado={() => {
            carregarProdutos();
          }}
        />
      )}
    </div>
  );
};
