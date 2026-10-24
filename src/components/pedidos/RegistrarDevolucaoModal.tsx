import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Package,
  User,
  MapPin,
  Calendar,
  Clock,
  Loader2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { Demonstracao, Usuario } from '../../types';
import { demonstracoesService } from '../../services/demonstracoesService';

interface RegistrarDevolucaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  demonstracao: Demonstracao | null;
  onDevolvido: (demonstracaoAtualizada: Demonstracao) => void;
  currentUser?: Usuario | null;
}

export const RegistrarDevolucaoModal: React.FC<RegistrarDevolucaoModalProps> = ({
  isOpen,
  onClose,
  demonstracao,
  onDevolvido,
  currentUser,
}) => {
  const [observacao, setObservacao] = useState(demonstracao?.observacao || '');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  React.useEffect(() => {
    if (demonstracao) {
      setObservacao(demonstracao.observacao || '');
      setErro(null);
    }
  }, [demonstracao, isOpen]);

  if (!isOpen || !demonstracao) return null;

  const handleConfirmarDevolucao = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro(null);

    try {
      const atualizada = await demonstracoesService.registrarDevolucao(
        demonstracao.id,
        {
          observacao: observacao.trim() || null,
        },
        currentUser?.nivel
      );

      onDevolvido(atualizada);
      onClose();
    } catch (err: any) {
      setErro(err.message || 'Erro ao registrar devolução do produto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/60">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                Encerramento de Saída
              </span>
              <span className="text-xs text-slate-400">PoliHub Demonstrações</span>
            </div>
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Registrar Devolução de Produto</span>
            </h2>
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
        <form onSubmit={handleConfirmarDevolucao} className="p-6 space-y-5">
          {erro && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Dados do Produto e Colaborador Responsável */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Produto em Demonstração
              </span>
              <div className="font-extrabold text-white text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-400 shrink-0" />
                <span>{demonstracao.produto}</span>
              </div>
              {demonstracao.codigo_produto && (
                <span className="text-[11px] text-sky-400 font-mono mt-0.5 block">
                  Código/EAN: {demonstracao.codigo_produto}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-850 text-xs">
              <div>
                <span className="text-slate-400 text-[11px] block">Colaborador Responsável:</span>
                <span className="font-bold text-slate-200 flex items-center gap-1.5 mt-0.5">
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  <span>{demonstracao.colaborador_nome || 'Colaborador'}</span>
                </span>
              </div>

              <div>
                <span className="text-slate-400 text-[11px] block">Endereço de Origem:</span>
                <span className="font-mono font-bold text-sky-400 flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-sky-400" />
                  <span>{demonstracao.endereco}</span>
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-850 text-xs flex items-center justify-between text-slate-400">
              <span>Retirado em:</span>
              <span className="font-bold text-white font-mono">
                {new Date(demonstracao.data_coletada).toLocaleString('pt-BR')}
              </span>
            </div>
          </div>

          {/* Observação / Estado do Produto */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>Observação sobre o Estado do Produto</span>
            </label>
            <textarea
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Produto devolvido em perfeito estado de conservação e embalagem lacrada..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Registro de Data de Devolução Automático */}
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Data e Hora da Devolução:</span>
            </div>
            <strong className="font-mono text-white">Agora (Automático)</strong>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition disabled:opacity-50 min-h-[44px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Confirmando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar Devolução</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
