import React from 'react';
import {
  X,
  FileText,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Package,
  Truck,
  Building2,
  FileCheck,
  ShieldAlert,
  MapPin,
  PackageX,
  Layers,
} from 'lucide-react';
import {
  ChamadoLogistico,
  ItemProdutoChamado,
  TransportadoraChamado,
  Usuario,
} from '../../types';

interface DetalhesChamadoModalProps {
  isOpen: boolean;
  chamado: ChamadoLogistico | null;
  currentUser?: Usuario | null;
  podeFinalizar: boolean;
  onClose: () => void;
  onAbrirFinalizar: (chamado: ChamadoLogistico) => void;
}

export const DetalhesChamadoModal: React.FC<DetalhesChamadoModalProps> = ({
  isOpen,
  chamado,
  currentUser,
  podeFinalizar,
  onClose,
  onAbrirFinalizar,
}) => {
  if (!isOpen || !chamado) return null;

  const isConcluido = chamado.status === 'Concluído';
  const isProblemaProduto =
    chamado.tipo_problema === 'Avaria' || chamado.tipo_problema === 'Produto errado';

  const dataAberturaFormatada = new Date(chamado.data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const dataConclusaoFormatada = chamado.data_conclusao
    ? new Date(chamado.data_conclusao).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const produtos = isProblemaProduto
    ? (chamado.produto_transportadora as ItemProdutoChamado[]) || []
    : [];

  const transportadora = !isProblemaProduto
    ? (chamado.produto_transportadora as TransportadoraChamado) || null
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                isConcluido
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-blue-500/15 border-blue-500/30 text-blue-400'
              }`}
            >
              {isConcluido ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    isConcluido
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                  }`}
                >
                  {chamado.status}
                </span>
                <span className="text-xs font-mono text-slate-400 font-bold">
                  NF {chamado.nota_fiscal}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight mt-0.5 truncate">
                Detalhes do Chamado Logístico
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CORPO */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* GRADE DE METADADOS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-400" />
                Cliente / Destinatário
              </span>
              <strong className="text-white text-sm block truncate">{chamado.cliente}</strong>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                Nota Fiscal
              </span>
              <strong className="text-white font-mono text-sm block">{chamado.nota_fiscal}</strong>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Tipo de Ocorrência
              </span>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="font-black text-amber-300 text-xs px-2.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  {chamado.tipo_problema}
                </span>
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                Abertura
              </span>
              <span className="font-semibold text-white block">{dataAberturaFormatada}</span>
              <span className="text-[10px] text-slate-400 block">
                Por: <strong className="text-slate-300">{chamado.usuario_abertura}</strong>
              </span>
            </div>
          </div>

          {/* ITENS / PRODUTOS OU TRANSPORTADORA */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            {isProblemaProduto ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Produtos com Ocorrência ({produtos.length})</span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Total:{' '}
                    <strong className="text-white font-mono">
                      {produtos.reduce((acc, p) => acc + (p.quantidade || 0), 0)} un
                    </strong>
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 overflow-hidden divide-y divide-slate-800/80">
                  {produtos.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      Nenhum detalhe de produto registrado.
                    </div>
                  ) : (
                    produtos.map((item, idx) => (
                      <div key={idx} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-white block truncate">{item.produto}</span>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                            {item.codigo && <span>Cód: {item.codigo}</span>}
                            {item.codigo_barras && <span>EAN: {item.codigo_barras}</span>}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="text-[10px] text-slate-400 block">Quantidade:</span>
                          <span className="font-mono font-bold text-white text-sm bg-slate-900 border border-slate-700/80 px-2 py-0.5 rounded-lg inline-block">
                            {item.quantidade} un
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <span className="font-bold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-sky-400" />
                  <span>Transportadora Relacionada</span>
                </span>
                <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-between text-xs text-sky-200">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-sky-400 uppercase font-bold block">
                        Transportadora do Frete
                      </span>
                      <strong className="text-white text-sm">
                        {transportadora?.transportadora || 'Transportadora não informada'}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SEÇÃO DE CONCLUSÃO (SE CONCLUÍDO) */}
          {isConcluido && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="font-bold text-xs text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Encerramento do Chamado</span>
              </span>

              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3 text-xs">
                <div className="flex items-center justify-between text-emerald-200 flex-wrap gap-2 pb-2 border-b border-emerald-500/20">
                  <div>
                    <span className="text-[10px] text-emerald-400 block font-bold uppercase">
                      Finalizado em:
                    </span>
                    <strong className="text-white">{dataConclusaoFormatada}</strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-emerald-400 block font-bold uppercase">
                      Encerrado por:
                    </span>
                    <strong className="text-white">
                      {chamado.usuario_fechamento || 'Assistente / Gestor'}
                    </strong>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-emerald-400 block">
                    Resolução Adotada:
                  </span>
                  <p className="text-slate-200 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-emerald-500/20 whitespace-pre-wrap">
                    {chamado.resolucao || 'Nenhuma descrição de resolução registrada.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* AVISO DE CHAMADO EM ABERTO QUANDO O USUÁRIO NÃO FOR ASSISTENTE/GESTOR */}
          {!isConcluido && !podeFinalizar && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-300 block">Chamado em Aberto:</span>
                <span className="text-slate-300 text-[11px]">
                  A ocorrência está sob análise. A finalização e inserção da resolução são
                  atribuídas aos usuários de nível <strong>Assistente</strong> ou <strong>Gestor</strong>.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition min-h-[44px]"
          >
            Fechar
          </button>

          {!isConcluido && podeFinalizar && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onAbrirFinalizar(chamado);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:from-emerald-700 active:to-teal-700 text-white font-bold text-xs shadow-lg shadow-emerald-900/40 transition min-h-[44px] cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Finalizar Chamado</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
