import React from 'react';
import {
  X,
  AlertOctagon,
  AlertTriangle,
  Loader2,
  FileText,
  Package,
  ShieldAlert,
} from 'lucide-react';

interface ConfirmacaoExcepcionalModalProps {
  isOpen: boolean;
  tipo: 'finalizar' | 'validar';
  identificador: string; // Ex: NF: 12345 ou Nome do Produto
  fornecedorOuDetalhe?: string;
  loading: boolean;
  erro?: string | null;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export const ConfirmacaoExcepcionalModal: React.FC<ConfirmacaoExcepcionalModalProps> = ({
  isOpen,
  tipo,
  identificador,
  fornecedorOuDetalhe,
  loading,
  erro,
  onConfirmar,
  onCancelar,
}) => {
  if (!isOpen) return null;

  const isFinalizar = tipo === 'finalizar';

  const textoPrincipal = isFinalizar
    ? 'Finalizar irá marcar todos os itens desta nota fiscal como validados, incluindo os itens com críticas. Após a confirmação, a nota será removida de Recebimentos e disponibilizada em Alocação. Deseja continuar?'
    : 'Esta ação irá validar o produto selecionado e disponibilizá-lo para alocação, mesmo que ainda não tenha sido conferido ou apresente críticas. Deseja continuar?';

  const tituloModal = isFinalizar
    ? 'Finalização Excepcional de Nota Fiscal'
    : 'Validação Excepcional de Produto';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={!loading ? onCancelar : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-lg rounded-3xl bg-slate-900 border-2 border-rose-500/40 shadow-2xl shadow-rose-950/50 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Faixa Superior de Destaque Vermelho / Atenção */}
        <div className="bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 px-5 py-3 text-white flex items-center justify-between text-xs font-bold uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 animate-pulse shrink-0" />
            <span>Operação Excepcional — Apenas Gestor</span>
          </div>
          <button
            type="button"
            onClick={onCancelar}
            disabled={loading}
            className="text-white/80 hover:text-white transition disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Header do Modal */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-950/60 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 mt-0.5">
            {isFinalizar ? (
              <FileText className="w-6 h-6 text-rose-400" />
            ) : (
              <Package className="w-6 h-6 text-rose-400" />
            )}
          </div>
          <div className="space-y-1 min-w-0">
            <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
              {tituloModal}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-rose-300 text-xs bg-rose-500/10 px-2.5 py-0.5 rounded-lg border border-rose-500/20 truncate max-w-full">
                {identificador}
              </span>
              {fornecedorOuDetalhe && (
                <span className="text-xs text-slate-400 truncate">
                  ({fornecedorOuDetalhe})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Corpo do Modal */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Mensagem Principal Conforme Especificação */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-medium">
              &ldquo;{textoPrincipal}&rdquo;
            </p>
          </div>

          {/* Banner de Atenção Institucional */}
          <div className="bg-rose-500/10 border border-rose-500/25 rounded-2xl p-3.5 flex items-start gap-3 text-xs text-rose-200">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-rose-300 block">
                Ação excepcional de último caso:
              </span>
              <p className="text-[11px] text-rose-200/90 leading-relaxed">
                Esta ação valida o item e libera para alocação física no estoque.
                O histórico de conferência, quem conferiu e divergências originais
                serão integralmente preservados para auditoria.
              </p>
            </div>
          </div>

          {/* Exibição de Erro em caso de falha */}
          {erro && (
            <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-500/40 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Não foi possível concluir:</span>
                <span>{erro}</span>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com Botões de Ação */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onCancelar}
            disabled={loading}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs transition min-h-[44px] cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirmar}
            disabled={loading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:from-rose-700 active:to-red-700 text-white font-black text-xs shadow-lg shadow-rose-900/40 transition min-h-[44px] cursor-pointer border border-rose-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processando...</span>
              </>
            ) : (
              <>
                <AlertOctagon className="w-4 h-4" />
                <span>Continuar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
