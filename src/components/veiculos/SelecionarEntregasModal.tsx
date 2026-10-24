import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, CheckSquare, Square, Truck, FileText, Hash, CheckCircle2, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { ExpedicaoColeta } from '../../types';
import { veiculosService } from '../../services/veiculosService';

interface SelecionarEntregasModalProps {
  isOpen: boolean;
  onClose: () => void;
  unidadeNegocio?: string;
  saidaAtualId?: string;
  coletasSelecionadasIniciais: ExpedicaoColeta[];
  onConfirmar: (coletasSelecionadas: ExpedicaoColeta[]) => void;
}

export const SelecionarEntregasModal: React.FC<SelecionarEntregasModalProps> = ({
  isOpen,
  onClose,
  unidadeNegocio,
  saidaAtualId,
  coletasSelecionadasIniciais,
  onConfirmar,
}) => {
  const [coletas, setColetas] = useState<ExpedicaoColeta[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // Carrega coletas somente quando o modal é aberto (Regra de Performance 16)
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      const initialSet = new Set(coletasSelecionadasIniciais.map((c) => c.id));
      setSelectedIds(initialSet);

      veiculosService
        .listarColetasDisponiveisParaSaida({
          unidade_negocio: unidadeNegocio,
          saidaAtualId,
        })
        .then((lista) => {
          // Assegura que coletas previamente selecionadas estejam na lista mesmo que o filtro exclua
          const mapa = new Map<string, ExpedicaoColeta>();
          lista.forEach((c) => mapa.set(c.id, c));
          coletasSelecionadasIniciais.forEach((c) => mapa.set(c.id, c));
          setColetas(Array.from(mapa.values()));
        })
        .catch((err) => {
          console.warn('Erro ao carregar coletas disponíveis:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, unidadeNegocio, saidaAtualId]);

  // Filtro de busca local rápido
  const coletasFiltradas = useMemo(() => {
    if (!searchTerm.trim()) return coletas;
    const term = searchTerm.toLowerCase().trim();
    return coletas.filter(
      (c) =>
        c.numero_nota_fiscal?.toLowerCase().includes(term) ||
        c.cliente?.toLowerCase().includes(term) ||
        c.transportadora?.toLowerCase().includes(term) ||
        c.numero_coleta?.toLowerCase().includes(term) ||
        c.chave_nf?.toLowerCase().includes(term)
    );
  }, [coletas, searchTerm]);

  // Cálculo automático do total de entregas e valor total das selecionadas
  const { totalEntregas, valorTotalNotas } = useMemo(() => {
    let count = 0;
    let soma = 0;
    coletas.forEach((c) => {
      if (selectedIds.has(c.id)) {
        count += 1;
        soma += c.valor ? Number(c.valor) : 0;
      }
    });
    return { totalEntregas: count, valorTotalNotas: soma };
  }, [coletas, selectedIds]);

  if (!isOpen) return null;

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = coletasFiltradas.every((c) => next.has(c.id));
      if (allSelected) {
        coletasFiltradas.forEach((c) => next.delete(c.id));
      } else {
        coletasFiltradas.forEach((c) => next.add(c.id));
      }
      return next;
    });
  };

  const handleConfirmar = () => {
    const selecionadas = coletas.filter((c) => selectedIds.has(c.id));
    onConfirmar(selecionadas);
    onClose();
  };

  const allVisibleSelected =
    coletasFiltradas.length > 0 && coletasFiltradas.every((c) => selectedIds.has(c.id));

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
    >
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Selecionar Entregas da Rota
              </h2>
              <p className="text-xs text-slate-400">
                Selecione as notas fiscais (Pedidos &gt; Coletas) transportadas nesta saída
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Search and Select All */}
        <div className="p-4 sm:px-6 border-b border-slate-800/80 bg-slate-950/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              id="input-busca-entregas"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por NF, cliente, transportadora, coleta..."
              className="w-full pl-10 pr-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <button
            type="button"
            onClick={handleSelectAllVisible}
            disabled={coletasFiltradas.length === 0}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition disabled:opacity-40"
          >
            {allVisibleSelected ? (
              <>
                <CheckSquare className="w-4 h-4 text-blue-400" />
                <span>Desmarcar Visíveis</span>
              </>
            ) : (
              <>
                <Square className="w-4 h-4 text-slate-400" />
                <span>Marcar Todas Visíveis</span>
              </>
            )}
          </button>
        </div>

        {/* List of Coletas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5">
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-blue-400" />
              <p className="text-sm font-semibold text-white">Carregando coletas disponíveis...</p>
              <p className="text-xs text-slate-500">Filtrando por unidade de negócio</p>
            </div>
          ) : coletasFiltradas.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-500 mx-auto mb-2.5">
                <Truck className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">Nenhuma coleta disponível localizada</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                {searchTerm
                  ? 'Nenhum registro corresponde ao termo de busca.'
                  : 'Todas as coletas cadastradas já estão vinculadas a saídas ou não há coletas na unidade.'}
              </p>
            </div>
          ) : (
            coletasFiltradas.map((coleta) => {
              const isSelected = selectedIds.has(coleta.id);
              return (
                <div
                  key={coleta.id}
                  onClick={() => handleToggleSelect(coleta.id)}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                    isSelected
                      ? 'bg-blue-600/10 border-blue-500/50 shadow-md shadow-blue-500/5'
                      : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 hover:bg-slate-950/80'
                  }`}
                >
                  <div className="pt-0.5 shrink-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer accent-blue-600"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-black text-white flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-blue-400" />
                          NF: {coleta.numero_nota_fiscal}
                        </span>
                        {coleta.numero_coleta && (
                          <span className="text-[11px] font-mono font-bold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                            Col: {coleta.numero_coleta}
                          </span>
                        )}
                      </div>

                      {/* Valor da Nota */}
                      <div className="font-mono text-sm font-extrabold text-emerald-400">
                        {coleta.valor
                          ? Number(coleta.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                          : 'R$ 0,00'}
                      </div>
                    </div>

                    <div className="mt-1.5 text-xs text-slate-300 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <div className="truncate">
                        <span className="text-slate-500 font-medium">Cliente: </span>
                        <strong className="text-slate-200">{coleta.cliente}</strong>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400 truncate">
                        <Truck className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{coleta.transportadora}</span>
                      </div>
                    </div>

                    {coleta.chave_nf && (
                      <div className="mt-1 font-mono text-[10px] text-slate-500 truncate" title={coleta.chave_nf}>
                        Chave: {coleta.chave_nf}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer: Live Totals and Action */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-800 bg-slate-900/90 shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5">
          <div className="flex items-center gap-4 text-xs sm:text-sm">
            <div>
              <span className="text-slate-400">Entregas selecionadas: </span>
              <strong className="text-white font-mono text-base">{totalEntregas}</strong>
            </div>
            <div className="h-4 w-px bg-slate-800"></div>
            <div>
              <span className="text-slate-400">Valor Total das Notas: </span>
              <strong className="text-emerald-400 font-mono text-base font-bold">
                {valorTotalNotas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </strong>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmar}
              id="btn-confirmar-entregas"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmar Seleção ({totalEntregas})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
