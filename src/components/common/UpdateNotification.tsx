import React from 'react';
import { RefreshCw, Sparkles, ArrowUpCircle } from 'lucide-react';
import { useUpdate } from '../../context/UpdateContext';

export const UpdateNotification: React.FC = () => {
  const { isUpdateAvailable, isUpdating, operacaoAtiva, aplicarAtualizacaoAgora, buildId } = useUpdate();

  // 1. Estado de aplicação da atualização em andamento
  if (isUpdating) {
    return (
      <aside
        aria-live="polite"
        className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900/95 border border-sky-500/50 text-sky-200 px-4 py-2.5 rounded-2xl shadow-2xl shadow-sky-950/60 backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300"
      >
        <RefreshCw className="w-4 h-4 animate-spin text-sky-400 shrink-0" />
        <div className="flex flex-col">
          <span className="text-xs font-bold text-white leading-tight">Atualizando o PoliHub...</span>
          <span className="text-[10px] text-slate-400">Aplicando novos recursos com segurança</span>
        </div>
      </aside>
    );
  }

  // 2. Atualização pronta aguardando término de operação ativa
  if (isUpdateAvailable && operacaoAtiva) {
    return (
      <aside
        aria-live="polite"
        className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md flex items-center justify-between gap-3 bg-slate-900/95 border border-amber-500/40 text-slate-100 px-4 py-2.5 rounded-2xl shadow-2xl shadow-black/80 backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-400">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-white truncate">Nova versão disponível</span>
            <span className="text-[10px] text-slate-400 truncate">
              Aguardando fim da operação para atualizar
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => aplicarAtualizacaoAgora()}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white text-xs font-bold shrink-0 shadow-md active:scale-95 transition min-h-[36px]"
          title="Clique para atualizar imediatamente"
        >
          <ArrowUpCircle className="w-3.5 h-3.5" />
          <span>Atualizar</span>
        </button>
      </aside>
    );
  }

  return null;
};
