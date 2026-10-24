import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Package,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Loader2,
  Calendar,
  Layers,
} from 'lucide-react';
import { SolicitacaoCompra } from '../../types';
import { comprasService } from '../../services/comprasService';
import { useAuth } from '../../context/AuthContext';

interface ModalAprovacaoGestorProps {
  solicitacao: SolicitacaoCompra | null;
  isOpen: boolean;
  onClose: () => void;
  onDecisaoConfirmada: () => void;
}

export const ModalAprovacaoGestor: React.FC<ModalAprovacaoGestorProps> = ({
  solicitacao,
  isOpen,
  onClose,
  onDecisaoConfirmada,
}) => {
  const { user } = useAuth();
  const [decisao, setDecisao] = useState<'Aprovado' | 'Recusado'>('Aprovado');
  const [quantidadeAprovada, setQuantidadeAprovada] = useState<string>('');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && solicitacao) {
      setDecisao('Aprovado');
      setQuantidadeAprovada(String(solicitacao.quantidade));
      setErro(null);
    }
  }, [isOpen, solicitacao]);

  if (!isOpen || !solicitacao) return null;

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!user?.id) {
      setErro('Gestor não identificado na sessão.');
      return;
    }

    let qtdFinal: number | undefined = undefined;
    if (decisao === 'Aprovado') {
      const q = parseInt(quantidadeAprovada, 10);
      if (isNaN(q) || q <= 0 || !Number.isInteger(q)) {
        setErro('Informe uma quantidade válida (número positivo inteiro maior que zero).');
        return;
      }
      qtdFinal = q;
    }

    setProcessando(true);
    try {
      await comprasService.aprovarOuRecusarSolicitacao({
        id: solicitacao.id,
        idGestor: user.id,
        decisao,
        quantidadeAprovada: qtdFinal,
      });

      onDecisaoConfirmada();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao registrar decisão da solicitação.';
      setErro(msg);
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Análise e Aprovação de Solicitação</h2>
              <p className="text-xs text-slate-400">
                Avaliação de suprimento &bull; Gestor: <strong className="text-slate-200">{user?.nome}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={processando}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConfirmar} className="p-5 sm:p-6 space-y-5">
          {erro && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{erro}</span>
            </div>
          )}

          {/* 1. Nome e Descrição do Produto Solicitado */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                <Package className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Produto Solicitado
                </span>
                <h3 className="text-sm font-bold text-white break-words">{solicitacao.produto_nome}</h3>
                <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                  <span>Fabricante: <strong className="text-slate-200">{solicitacao.produto_fabricante || 'Geral'}</strong></span>
                  {solicitacao.produto_codigo_barras && (
                    <span>EAN: <strong className="text-slate-300 font-mono">{solicitacao.produto_codigo_barras}</strong></span>
                  )}
                  {solicitacao.produto_endereco && (
                    <span>Local: <strong className="text-slate-300">{solicitacao.produto_endereco}</strong></span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Solicitante e Quantidade Solicitada Original */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Solicitante com ícone padrão de usuário */}
            <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/50 space-y-1">
              <span className="text-[11px] text-slate-400 block font-semibold">Solicitante</span>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-700/60 text-slate-300 flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <span className="text-xs font-bold text-white truncate block">{solicitacao.solicitante_nome}</span>
                  <span className="text-[10px] text-slate-400 block">{solicitacao.solicitante_departamento}</span>
                </div>
              </div>
            </div>

            {/* Quantidade Solicitada Original */}
            <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/50 space-y-1">
              <span className="text-[11px] text-slate-400 block font-semibold">Qtd. Solicitada Original</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white font-mono">{solicitacao.quantidade}</span>
                <span className="text-xs text-slate-400">unidades</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                    solicitacao.demanda === 'Estoque'
                      ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                      : solicitacao.demanda === 'Sob Encomenda' || solicitacao.demanda === 'Necessidade'
                      ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                      : 'bg-teal-500/15 text-teal-300 border-teal-500/30'
                  }`}
                >
                  Demanda: {solicitacao.demanda}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  &bull; Urgência: <strong className="text-slate-300">{solicitacao.urgencia}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* 3. Decisão do Gestor: Opção Aprovado ou Recusado */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Decisão do Gestor <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDecisao('Aprovado')}
                className={`p-3.5 rounded-2xl border text-left transition flex items-center gap-3 ${
                  decisao === 'Aprovado'
                    ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-600/10 ring-1 ring-blue-500'
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    decisao === 'Aprovado' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold block text-white">Aprovado</span>
                  <span className="text-[10px] text-slate-400">Libera para o setor de compras</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDecisao('Recusado')}
                className={`p-3.5 rounded-2xl border text-left transition flex items-center gap-3 ${
                  decisao === 'Recusado'
                    ? 'bg-rose-600/20 border-rose-500 text-white shadow-lg shadow-rose-600/10 ring-1 ring-rose-500'
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    decisao === 'Recusado' ? 'bg-rose-600 text-white' : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold block text-white">Recusado</span>
                  <span className="text-[10px] text-slate-400">Indefere a solicitação</span>
                </div>
              </button>
            </div>
          </div>

          {/* 4. Campo para Ajustar a Quantidade (Quando Aprovado) */}
          {decisao === 'Aprovado' && (
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-blue-200">
                  Quantidade Aprovada <span className="text-rose-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setQuantidadeAprovada(String(solicitacao.quantidade))}
                  className="text-[11px] text-blue-300 hover:text-white underline font-semibold"
                >
                  Manter quantidade original ({solicitacao.quantidade})
                </button>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  step="1"
                  required
                  value={quantidadeAprovada}
                  onChange={(e) => setQuantidadeAprovada(e.target.value)}
                  placeholder="Ex: 50"
                  className="w-36 px-4 py-2.5 rounded-xl bg-slate-900 border border-blue-500/40 text-white font-mono text-base font-bold text-center focus:outline-none focus:border-blue-400"
                />
                <span className="text-xs text-blue-200">
                  O Gestor pode aprovar a quantidade original ou ajustá-la. A quantidade original permanece salva para auditoria.
                </span>
              </div>
            </div>
          )}

          {/* 5. Campo Opcional de Observação (Apenas Visualização / Não Editável pelo Gestor) */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <FileText className="w-4 h-4 text-slate-400" />
              <span>Observação da Solicitação (Apenas Visualização)</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 italic min-h-[44px]">
              {solicitacao.observacao ? solicitacao.observacao : 'Nenhuma observação informada pelo solicitante.'}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={processando}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={processando}
              className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold transition flex items-center gap-2 shadow-lg ${
                decisao === 'Aprovado'
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
                  : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
              }`}
            >
              {processando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Registrando decisão...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar {decisao === 'Aprovado' ? 'Aprovação' : 'Recusa'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
