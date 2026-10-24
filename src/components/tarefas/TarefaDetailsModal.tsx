import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  ClockAlert,
  Edit,
  Trash2,
  ShieldCheck,
  Check,
  History,
} from 'lucide-react';
import { Tarefa, TarefaStatus, PrazoCalculado } from '../../types';
import { calcularPrazoTarefa } from '../../services/tarefasService';

interface TarefaDetailsModalProps {
  tarefa: Tarefa;
  isGestor: boolean;
  onClose: () => void;
  onEdit?: (tarefa: Tarefa) => void;
  onDelete?: (tarefa: Tarefa) => void;
  onStatusChange?: (id: string, newStatus: TarefaStatus) => Promise<void>;
}

export const TarefaDetailsModal: React.FC<TarefaDetailsModalProps> = ({
  tarefa,
  isGestor,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
}) => {
  const [updating, setUpdating] = useState(false);

  const prazo: PrazoCalculado = tarefa.prazo || calcularPrazoTarefa(tarefa.status, tarefa.data_limite);

  const getPrazoBadge = (p: PrazoCalculado) => {
    switch (p) {
      case 'Prazo estourado':
        return {
          bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
          icon: AlertCircle,
          label: 'Prazo estourado',
          desc: 'A data limite definida já foi ultrapassada.',
        };
      case 'Finalizar hoje':
        return {
          bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          icon: ClockAlert,
          label: 'Finalizar hoje',
          desc: 'A data limite para conclusão é hoje.',
        };
      case 'Dentro do prazo':
        return {
          bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          icon: Clock,
          label: 'Dentro do prazo',
          desc: 'Tarefa dentro da janela prevista de entrega.',
        };
      case 'Concluída':
        return {
          bg: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
          icon: CheckCircle2,
          label: 'Concluída',
          desc: 'Tarefa finalizada com sucesso.',
        };
    }
  };

  const prazoInfo = getPrazoBadge(prazo);
  const PrazoIcon = prazoInfo.icon;

  const handleToggleStatus = async (newStatus: TarefaStatus) => {
    if (!onStatusChange || updating) return;
    setUpdating(true);
    try {
      await onStatusChange(tarefa.id, newStatus);
    } catch (err) {
      console.warn('Erro ao atualizar status:', err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-6 my-8 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
                Detalhes da Tarefa
              </span>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${prazoInfo.bg}`}
              >
                <PrazoIcon className="w-3 h-3" />
                <span>{prazoInfo.label}</span>
              </span>
            </div>
            <h3 className="text-lg font-black text-white mt-2 leading-snug">
              {tarefa.nome}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body content */}
        <div className="mt-5 space-y-4 text-xs">
          {/* Status & Responsável Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Responsável */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 text-slate-400 font-semibold mb-1">
                <UserIcon className="w-3.5 h-3.5 text-blue-400" />
                <span>Responsável Atribuído</span>
              </div>
              <div className="text-sm font-bold text-white">
                {tarefa.responsavel_nome || 'Usuário do Sistema'}
              </div>
              {tarefa.responsavel_codigo && (
                <div className="text-[11px] font-mono font-semibold text-blue-400 mt-0.5">
                  Cód: {tarefa.responsavel_codigo}
                </div>
              )}
            </div>

            {/* Status */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 text-slate-400 font-semibold mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Status da Tarefa</span>
              </div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    tarefa.status === 'Concluído'
                      ? 'bg-emerald-400'
                      : tarefa.status === 'Pendente'
                      ? 'bg-amber-400'
                      : 'bg-slate-400'
                  }`}
                />
                <span>{tarefa.status}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {tarefa.status === 'Concluído'
                  ? 'Finalizada pelo responsável'
                  : 'Aguardando finalização'}
              </div>
            </div>
          </div>

          {/* Cronologia: Data Limite & Data Conclusão */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 text-slate-400 font-semibold mb-1">
                <Calendar className="w-3.5 h-3.5 text-sky-400" />
                <span>Data Limite</span>
              </div>
              <div className="text-sm font-mono font-bold text-white">
                {tarefa.data_limite
                  ? new Date(tarefa.data_limite + 'T00:00:00').toLocaleDateString('pt-BR')
                  : 'Não definida'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {prazoInfo.desc}
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 text-slate-400 font-semibold mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Data Conclusão</span>
              </div>
              <div className="text-sm font-mono font-bold text-white">
                {tarefa.data_conclusao ? (
                  <span className="text-emerald-300">
                    {new Date(tarefa.data_conclusao).toLocaleDateString('pt-BR')} às{' '}
                    {new Date(tarefa.data_conclusao).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                ) : (
                  <span className="text-slate-500 font-normal italic">Pendente</span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {tarefa.data_conclusao ? 'Preenchido automaticamente' : 'Aguardando conclusão'}
              </div>
            </div>
          </div>

          {/* Quick status change for Gestor */}
          {isGestor && onStatusChange && (
            <div className="bg-slate-950/40 border border-slate-800/90 rounded-2xl p-3.5">
              <div className="text-xs font-bold text-slate-300 mb-2 flex items-center justify-between">
                <span>Alterar Status Rápido (Gestor):</span>
                {updating && <span className="text-[11px] text-blue-400">Atualizando...</span>}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={updating || tarefa.status === 'Pendente'}
                  onClick={() => handleToggleStatus('Pendente')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition min-h-[38px] ${
                    tarefa.status === 'Pendente'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Pendente
                </button>
                <button
                  type="button"
                  disabled={updating || tarefa.status === 'Concluído'}
                  onClick={() => handleToggleStatus('Concluído')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition min-h-[38px] flex items-center gap-1.5 ${
                    tarefa.status === 'Concluído'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Concluído</span>
                </button>
                <button
                  type="button"
                  disabled={updating || tarefa.status === 'Não concluído'}
                  onClick={() => handleToggleStatus('Não concluído')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition min-h-[38px] ${
                    tarefa.status === 'Não concluído'
                      ? 'bg-slate-700 text-slate-300 border border-slate-600'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Não concluído
                </button>
              </div>
            </div>
          )}

          {/* Audit trail */}
          <div className="bg-slate-950/30 rounded-2xl p-3 border border-slate-800/60 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold mb-1">
              <History className="w-3.5 h-3.5 text-slate-400" />
              <span>Rastreabilidade & Auditoria</span>
            </div>
            <div className="flex justify-between">
              <span>Criado por:</span>
              <span className="font-semibold text-slate-200">
                {tarefa.usuario_insercao || 'Sistema'}
              </span>
            </div>
            {tarefa.data_insercao && (
              <div className="flex justify-between">
                <span>Data de criação:</span>
                <span className="font-mono text-slate-300">
                  {new Date(tarefa.data_insercao).toLocaleString('pt-BR')}
                </span>
              </div>
            )}
            {tarefa.usuario_atualizacao && (
              <div className="flex justify-between">
                <span>Última atualização:</span>
                <span className="font-semibold text-slate-200">
                  {tarefa.usuario_atualizacao}
                </span>
              </div>
            )}
            {tarefa.data_atualizacao && (
              <div className="flex justify-between">
                <span>Data de atualização:</span>
                <span className="font-mono text-slate-300">
                  {new Date(tarefa.data_atualizacao).toLocaleString('pt-BR')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between gap-2">
          {isGestor && onDelete ? (
            <button
              type="button"
              id="btn-excluir-tarefa-modal"
              onClick={() => onDelete(tarefa)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition border border-rose-500/20 min-h-[40px]"
            >
              <Trash2 className="w-4 h-4" />
              <span>Excluir</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {isGestor && onEdit && (
              <button
                type="button"
                id="btn-editar-tarefa-modal"
                onClick={() => {
                  onClose();
                  onEdit(tarefa);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition shadow-xs min-h-[40px]"
              >
                <Edit className="w-4 h-4" />
                <span>Editar</span>
              </button>
            )}

            <button
              type="button"
              id="btn-fechar-tarefa-detalhes"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition min-h-[40px]"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
