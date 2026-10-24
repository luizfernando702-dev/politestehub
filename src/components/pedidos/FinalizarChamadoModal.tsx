import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileCheck,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { ChamadoLogistico, Usuario } from '../../types';
import { chamadosService } from '../../services/chamadosService';

interface FinalizarChamadoModalProps {
  isOpen: boolean;
  chamado: ChamadoLogistico | null;
  currentUser?: Usuario | null;
  onClose: () => void;
  onConcluido: () => void;
}

export const FinalizarChamadoModal: React.FC<FinalizarChamadoModalProps> = ({
  isOpen,
  chamado,
  currentUser,
  onClose,
  onConcluido,
}) => {
  const [resolucao, setResolucao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!isOpen || !chamado) return null;

  const handleFinalizar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    const textoLimpo = resolucao.trim();
    if (!textoLimpo) {
      setErro('A descrição da resolução é obrigatória para encerrar o chamado.');
      return;
    }

    try {
      setSalvando(true);
      await chamadosService.finalizarChamado({
        id: chamado.id,
        resolucao: textoLimpo,
        usuario_fechamento: currentUser?.nome || 'Assistente / Gestor',
        usuario_fechamento_id: currentUser?.id || null,
        userNivel: currentUser?.nivel,
        userFuncao: currentUser?.funcao,
      });

      onConcluido();
      onClose();
    } catch (err: any) {
      console.error('Erro ao finalizar chamado:', err);
      setErro(err.message || 'Erro ao finalizar chamado. Verifique suas permissões.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={!salvando ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Ação de Assistente / Gestor
              </span>
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight mt-0.5">
                Finalizar Chamado Logístico
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition disabled:opacity-50 min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CORPO */}
        <form onSubmit={handleFinalizar} className="p-4 sm:p-6 space-y-4">
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Nota Fiscal:</span>
              <strong className="text-white font-mono">{chamado.nota_fiscal}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Cliente:</span>
              <strong className="text-white truncate max-w-[200px]">{chamado.cliente}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Ocorrência:</span>
              <span className="font-bold text-amber-400">{chamado.tipo_problema}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
              Descrição da Resolução *
            </label>
            <textarea
              required
              rows={4}
              value={resolucao}
              onChange={(e) => setResolucao(e.target.value)}
              placeholder="Descreva a solução adotada para este chamado (ex: produto reenviado, transportadora acionada, indenização acordada, reenvio com nova rota, etc.)..."
              className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 leading-relaxed resize-none"
            />
            <span className="text-[11px] text-slate-400 block">
              O preenchimento da resolução é obrigatório para registrar o histórico do chamado.
            </span>
          </div>

          {/* Identificação do Usuário de Fechamento */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
            <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Responsável pelo encerramento:{' '}
              <strong className="text-white font-bold">{currentUser?.nome || 'Você'}</strong> (
              {currentUser?.nivel || currentUser?.funcao || 'Gestão'})
            </span>
          </div>

          {/* Erro */}
          {erro && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block">Atenção:</span>
                <span>{erro}</span>
              </div>
            </div>
          )}

          {/* FOOTER ACTIONS */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="px-4 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold text-xs transition min-h-[44px]"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={salvando}
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-900/40 transition min-h-[44px] cursor-pointer disabled:opacity-50"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Finalizando chamado...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Concluir e Finalizar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
