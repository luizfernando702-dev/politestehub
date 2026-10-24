import React, { useState } from 'react';
import {
  X,
  Package,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Sparkles,
  ShoppingBag,
  Building2,
  MapPin,
  Barcode,
  Layers,
  CheckCheck,
  FileText,
  Trash2,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { SolicitacaoCompra } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { isUserGestor, canUserMarcarComprado } from '../../lib/permissions';
import { comprasService } from '../../services/comprasService';
import { ModalAprovacaoGestor } from './ModalAprovacaoGestor';

interface DetalhesSolicitacaoModalProps {
  solicitacao: SolicitacaoCompra | null;
  isOpen: boolean;
  onClose: () => void;
  onAtualizado: () => void;
}

export const DetalhesSolicitacaoModal: React.FC<DetalhesSolicitacaoModalProps> = ({
  solicitacao,
  isOpen,
  onClose,
  onAtualizado,
}) => {
  const { user } = useAuth();
  const isGestor = isUserGestor(user);
  const podeComprar = canUserMarcarComprado(user);

  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modalAprovacaoAberto, setModalAprovacaoAberto] = useState(false);

  if (!isOpen || !solicitacao) return null;

  const handleAbrirAprovacao = () => {
    setModalAprovacaoAberto(true);
  };

  const handleMarcarComprado = async () => {
    if (!user?.id) return;
    setProcessando(true);
    setErro(null);
    try {
      await comprasService.marcarComoComprado(solicitacao.id, user.id);
      onAtualizado();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar para comprado.';
      setErro(msg);
    } finally {
      setProcessando(false);
    }
  };

  const handleExcluir = async () => {
    if (!confirm('Deseja realmente cancelar e excluir esta solicitação de compra?')) return;
    setProcessando(true);
    setErro(null);
    try {
      await comprasService.excluirSolicitacao(solicitacao.id);
      onAtualizado();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir solicitação.';
      setErro(msg);
    } finally {
      setProcessando(false);
    }
  };

  const formatarData = (d?: string | null) => {
    if (!d) return '-';
    try {
      const date = new Date(d);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return d;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Detalhes da Solicitação</h2>
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    solicitacao.status === 'Solicitado'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : solicitacao.status === 'Aprovado'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {solicitacao.status}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Código: <span className="font-mono text-slate-300">{solicitacao.id.slice(0, 8)}</span> &bull; Unidade:{' '}
                <span className="text-slate-300">{solicitacao.unidade_negocio || 'Goiânia'}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {erro && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {erro}
            </div>
          )}

          {/* Stepper / Timeline do Ciclo de Compra */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              Fluxo da Solicitação
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {/* Etapa 1: Solicitado */}
              <div className="flex flex-col items-center text-center p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold mb-1">
                  1
                </div>
                <span className="text-xs font-bold text-white">Solicitado</span>
                <span className="text-[10px] text-slate-400 mt-0.5">{formatarData(solicitacao.data_insercao)}</span>
              </div>

              {/* Etapa 2: Aprovado */}
              <div
                className={`flex flex-col items-center text-center p-2 rounded-xl border ${
                  solicitacao.status === 'Aprovado' || solicitacao.status === 'Comprado'
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-200'
                    : 'bg-slate-900/40 border-slate-800/50 text-slate-500'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${
                    solicitacao.status === 'Aprovado' || solicitacao.status === 'Comprado'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-slate-800 text-slate-600'
                  }`}
                >
                  2
                </div>
                <span className="text-xs font-bold">Aprovado</span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  {solicitacao.data_aprovacao ? formatarData(solicitacao.data_aprovacao) : 'Aguardando Gestor'}
                </span>
              </div>

              {/* Etapa 3: Comprado */}
              <div
                className={`flex flex-col items-center text-center p-2 rounded-xl border ${
                  solicitacao.status === 'Comprado'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                    : 'bg-slate-900/40 border-slate-800/50 text-slate-500'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${
                    solicitacao.status === 'Comprado'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-800 text-slate-600'
                  }`}
                >
                  3
                </div>
                <span className="text-xs font-bold">Comprado</span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  {solicitacao.data_compra ? formatarData(solicitacao.data_compra) : 'Pendente de Aquisição'}
                </span>
              </div>
            </div>
          </div>

          {/* Dados do Produto */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Produto</h4>
            <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white">{solicitacao.produto_nome}</h3>
                <div className="text-xs text-slate-300 mt-1 flex flex-wrap gap-y-1 gap-x-4">
                  <span>
                    Fabricante: <strong className="text-white">{solicitacao.produto_fabricante || 'Geral'}</strong>
                  </span>
                  {solicitacao.produto_codigo_barras && (
                    <span className="flex items-center gap-1 font-mono text-slate-400">
                      <Barcode className="w-3.5 h-3.5" />
                      {solicitacao.produto_codigo_barras}
                    </span>
                  )}
                  {solicitacao.produto_endereco && (
                    <span className="flex items-center gap-1 text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-blue-400" />
                      Local atual: {solicitacao.produto_endereco}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[11px] text-slate-400 block">Quantidade</span>
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  {solicitacao.quantidade}
                </span>
                <span className="text-[11px] text-slate-400 block">unidades</span>
              </div>
            </div>
          </div>

          {/* Informações da Demanda e Urgência */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/50">
              <span className="text-[11px] text-slate-400 block font-semibold">Tipo de Demanda</span>
              <span className="text-sm font-bold text-white mt-0.5 block">{solicitacao.demanda}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {solicitacao.demanda === 'Estoque'
                  ? 'Reposição de estoque da empresa'
                  : solicitacao.demanda === 'Sob Encomenda' || solicitacao.demanda === 'Necessidade'
                  ? 'Compra específica para atender cliente'
                  : 'Materiais destinados ao uso interno'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/50">
              <span className="text-[11px] text-slate-400 block font-semibold">Urgência</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {solicitacao.urgencia === 'Urgente' ? (
                  <>
                    <Flame className="w-4 h-4 text-rose-400 animate-pulse" />
                    <span className="text-sm font-bold text-rose-300">Urgente</span>
                  </>
                ) : solicitacao.urgencia === 'Rápida' ? (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-bold text-amber-300">Rápida</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-bold text-slate-300">Média</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Solicitante e Aprovador */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/50 space-y-1">
              <span className="text-[11px] text-slate-400 block font-semibold">Solicitante</span>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">{solicitacao.solicitante_nome}</span>
                  <span className="text-[10px] text-slate-400">{solicitacao.solicitante_departamento}</span>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/50 space-y-1">
              <span className="text-[11px] text-slate-400 block font-semibold">Gestor de Aprovação</span>
              {solicitacao.usuario_aprovacao_nome ? (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-slate-800 text-blue-400 flex items-center justify-center">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">{solicitacao.usuario_aprovacao_nome}</span>
                    <span className="text-[10px] text-blue-300">Aprovado</span>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-amber-400 italic">Aguardando aprovação de um Gestor</span>
              )}
            </div>
          </div>

          {/* Observação */}
          {solicitacao.observacao && (
            <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-700/40 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Observação da Solicitação</span>
              </div>
              <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                {solicitacao.observacao}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
          <div>
            {(isGestor || solicitacao.id_solicitante === user?.id) && solicitacao.status !== 'Comprado' && (
              <button
                type="button"
                onClick={handleExcluir}
                disabled={processando}
                className="px-3 py-2 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir / Cancelar</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition"
            >
              Fechar
            </button>

            {/* Ação 1: Aprovar (apenas Gestor quando Solicitado) */}
            {isGestor && solicitacao.status === 'Solicitado' && (
              <button
                type="button"
                onClick={handleAbrirAprovacao}
                disabled={processando}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-blue-600/30"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Aprovar Solicitação</span>
              </button>
            )}

          </div>
        </div>
      </div>

      {modalAprovacaoAberto && (
        <ModalAprovacaoGestor
          solicitacao={solicitacao}
          isOpen={modalAprovacaoAberto}
          onClose={() => setModalAprovacaoAberto(false)}
          onDecisaoConfirmada={() => {
            setModalAprovacaoAberto(false);
            onAtualizado();
            onClose();
          }}
        />
      )}
    </div>
  );
};
