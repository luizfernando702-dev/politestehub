import React, { useState, useEffect } from 'react';
import { X, Truck, User, Calendar, Clock, Gauge, Layers, DollarSign, FileText, Hash, CheckCircle2 } from 'lucide-react';
import { SaidaVeiculo, ExpedicaoColeta } from '../../types';
import { veiculosService } from '../../services/veiculosService';

interface DetalhesSaidaModalProps {
  isOpen: boolean;
  onClose: () => void;
  saida: SaidaVeiculo | null;
}

export const DetalhesSaidaModal: React.FC<DetalhesSaidaModalProps> = ({ isOpen, onClose, saida }) => {
  const [entregas, setEntregas] = useState<ExpedicaoColeta[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && saida) {
      if (saida.entregas && saida.entregas.length > 0) {
        setEntregas(saida.entregas);
      } else {
        setLoading(true);
        veiculosService
          .obterEntregasDaSaida(saida.id)
          .then((list) => setEntregas(list))
          .catch((err) => console.warn('Erro ao obter entregas da saída:', err))
          .finally(() => setLoading(false));
      }
    }
  }, [isOpen, saida]);

  if (!isOpen || !saida) return null;

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
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {saida.veiculo_nome}
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700/80">
                  {saida.veiculo_placa}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {saida.periodo}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Saída registrada em {new Date(saida.data + 'T00:00:00').toLocaleDateString('pt-BR')} às {saida.horario}
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
                <Gauge className="w-3.5 h-3.5 text-blue-400" />
                <span>KM de Saída</span>
              </div>
              <div className="font-mono text-lg font-bold text-white">
                {saida.km_saida.toLocaleString('pt-BR')} km
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
                <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                <span>KM Rodado</span>
              </div>
              <div className="font-mono text-lg font-bold text-emerald-400">
                {saida.km_rodado !== null ? `${saida.km_rodado.toLocaleString('pt-BR')} km` : '—'}
              </div>
              {saida.km_rodado === null && (
                <div className="text-[10px] text-slate-500">Base inicial</div>
              )}
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>Entregas</span>
              </div>
              <div className="font-mono text-lg font-bold text-white">
                {saida.quantidade_entregas}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>Valor Total</span>
              </div>
              <div className="font-mono text-base sm:text-lg font-bold text-emerald-400 truncate">
                {saida.valor_total_notas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>
          </div>

          {/* Details Row: Motorista e Unidade */}
          <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                <User className="w-4 h-4" />
              </div>
              <div>
                <span className="text-slate-500 block">Motorista:</span>
                <strong className="text-white text-sm">{saida.motorista_nome}</strong>
              </div>
            </div>

            <div className="text-slate-400">
              <span className="text-slate-500">Unidade: </span>
              <strong className="text-slate-200">{saida.unidade_negocio}</strong>
            </div>
          </div>

          {saida.observacao && (
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs">
              <span className="text-slate-400 font-semibold block mb-1">Observações:</span>
              <p className="text-slate-200 whitespace-pre-wrap">{saida.observacao}</p>
            </div>
          )}

          {/* Entregas Vinculadas */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>Entregas Vinculadas a esta Saída ({entregas.length})</span>
              </h3>
            </div>

            {loading ? (
              <div className="py-6 text-center text-xs text-slate-400">Carregando entregas...</div>
            ) : entregas.length === 0 ? (
              <div className="py-6 px-4 text-center rounded-2xl bg-slate-950/50 border border-slate-800 text-xs text-slate-500">
                Nenhuma coleta/entrega vinculada a esta saída.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/50">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Nota Fiscal</th>
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3">Transportadora</th>
                      <th className="py-2.5 px-3">Nº Coleta</th>
                      <th className="py-2.5 px-3 text-right">Valor da NF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                    {entregas.map((ent) => (
                      <tr key={ent.id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 font-mono font-bold text-white flex items-center gap-1.5">
                          <FileText className="w-3 h-3 text-blue-400 shrink-0" />
                          <span>{ent.numero_nota_fiscal}</span>
                        </td>
                        <td className="py-2.5 px-3 truncate max-w-[200px]" title={ent.cliente}>
                          {ent.cliente}
                        </td>
                        <td className="py-2.5 px-3 truncate max-w-[160px]" title={ent.transportadora}>
                          {ent.transportadora}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">
                          {ent.numero_coleta || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                          {ent.valor
                            ? Number(ent.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            : 'R$ 0,00'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-800 bg-slate-900/60 shrink-0 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
