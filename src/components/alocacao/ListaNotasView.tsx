import React, { useState } from 'react';
import {
  ArrowLeft,
  FileText,
  Calendar,
  Layers,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Inbox,
  Filter,
  Building2,
  Search,
  RefreshCw,
  X,
} from 'lucide-react';
import { ResumoNotaAlocacao } from '../../types';

interface ListaNotasViewProps {
  notas: ResumoNotaAlocacao[];
  loading?: boolean;
  filtroDataInicial?: string;
  filtroNotaFiscalInicial?: string;
  onFiltrar: (filtros: { dataRecebimento?: string; notaFiscal?: string }) => void;
  onLimparFiltros: () => void;
  onSelecionarNota: (nota: ResumoNotaAlocacao) => void;
  onVoltar: () => void;
}

export const ListaNotasView: React.FC<ListaNotasViewProps> = ({
  notas,
  loading = false,
  filtroDataInicial = '',
  filtroNotaFiscalInicial = '',
  onFiltrar,
  onLimparFiltros,
  onSelecionarNota,
  onVoltar,
}) => {
  const [localData, setLocalData] = useState(filtroDataInicial);
  const [localNF, setLocalNF] = useState(filtroNotaFiscalInicial);

  const handleAplicarFiltros = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onFiltrar({
      dataRecebimento: localData || undefined,
      notaFiscal: localNF.trim() || undefined,
    });
  };

  const handleLimpar = () => {
    setLocalData('');
    setLocalNF('');
    onLimparFiltros();
  };

  const temFiltroAtivo = Boolean(localData || localNF.trim());

  const getStatusBadge = (status: ResumoNotaAlocacao['status_alocacao']) => {
    switch (status) {
      case 'Concluído':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            100% Alocado
          </span>
        );
      case 'Parcial':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            Parcialmente Alocado
          </span>
        );
      case 'Pendente':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            Pendente de Alocação
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-24 md:pb-12 animate-in fade-in duration-200">
      {/* Barra Superior com Botão Voltar */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onVoltar}
          className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition min-h-[44px] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Menu de Alocações</span>
        </button>

        <span className="text-sm font-mono font-bold bg-slate-900 border border-slate-800 text-slate-200 px-3 py-1.5 rounded-xl">
          {notas.length} nota(s) encontrada(s)
        </span>
      </div>

      {/* Cabeçalho da Tela: Notas para Alocar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
            Alocação de Mercadorias
          </span>
          <span className="text-xs text-slate-400">Produtos Conferidos no Recebimento</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
          Notas para alocar
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Selecione uma nota fiscal para conferir os itens recebidos e registrar o endereço de armazenagem no estoque.
        </p>
      </div>

      {/* Barra de Filtros Sob Demanda (Data e NF) */}
      <form
        onSubmit={handleAplicarFiltros}
        className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-blue-400" />
            <span>Filtros de Busca</span>
          </div>

          {temFiltroAtivo && (
            <button
              type="button"
              onClick={handleLimpar}
              className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 font-medium underline cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpar Filtros</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          {/* Data do Recebimento */}
          <div className="sm:col-span-5">
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Data de Recebimento
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                id="input-alocacao-filtro-data"
                value={localData}
                onChange={(e) => setLocalData(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-blue-500 transition min-h-[44px]"
              />
            </div>
          </div>

          {/* Nota Fiscal */}
          <div className="sm:col-span-4">
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Nota Fiscal
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                id="input-alocacao-filtro-nf"
                value={localNF}
                onChange={(e) => setLocalNF(e.target.value)}
                placeholder="Ex: 001.993.520"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition min-h-[44px]"
              />
            </div>
          </div>

          {/* Botão Filtrar */}
          <div className="sm:col-span-3">
            <button
              type="submit"
              id="btn-filtrar-notas-alocacao"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition active:scale-[0.99] min-h-[44px] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Search className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Consultando...' : 'Filtrar'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Listagem de Notas Fiscais */}
      {loading ? (
        <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-3xl space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-200">Consultando notas para alocação no Supabase...</p>
          <p className="text-xs text-slate-500">Filtrando produtos conferidos e aguardando endereçamento</p>
        </div>
      ) : notas.length === 0 ? (
        <div className="p-10 text-center bg-slate-900/50 border border-slate-800 rounded-3xl space-y-3">
          <Inbox className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-base font-bold text-white">Nenhuma nota fiscal encontrada com os critérios informados.</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {temFiltroAtivo
              ? 'Tente remover ou ajustar os filtros de data e nota fiscal para visualizar mais resultados.'
              : 'Não há notas com produtos conferidos pendentes de alocação no momento.'}
          </p>
          {temFiltroAtivo && (
            <button
              type="button"
              onClick={handleLimpar}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition min-h-[44px] cursor-pointer"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {notas.map((nota) => (
            <div
              key={nota.nota_fiscal}
              id={`card-nota-${nota.nota_fiscal.replace(/\D/g, '')}`}
              onClick={() => onSelecionarNota(nota)}
              className="cursor-pointer group bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-4 sm:p-5 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99] shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-h-[64px]"
            >
              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 group-hover:scale-105 transition">
                  <FileText className="w-6 h-6" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Nota Fiscal:
                    </span>
                    <span className="text-base font-black text-white font-mono group-hover:text-blue-400 transition">
                      {nota.nota_fiscal}
                    </span>
                  </div>

                  {/* Nome do Fornecedor */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium mb-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="text-slate-400">Fornecedor:</span>
                    <strong className="text-slate-100 truncate">
                      {nota.fornecedor || 'Fornecedor não informado'}
                    </strong>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      Recebida em: {nota.data_recebimento}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-slate-500" />
                      <strong className="text-slate-200">{nota.total_itens}</strong> itens ({nota.total_quantidade} un)
                    </span>
                  </div>
                </div>
              </div>

              {/* Status da Alocação & Ação */}
              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                <div>{getStatusBadge(nota.status_alocacao)}</div>

                <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 group-hover:text-white group-hover:bg-blue-600 transition shrink-0">
                  <span>Alocar NF</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
