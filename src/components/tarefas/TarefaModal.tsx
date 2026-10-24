import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, User as UserIcon, Calendar, AlertCircle, Loader2 } from 'lucide-react';
import { Tarefa, TarefaStatus, Usuario } from '../../types';
import { usuariosService } from '../../services/usuariosService';

interface TarefaModalProps {
  tarefa?: Tarefa | null;
  onClose: () => void;
  onSave: (dados: {
    nome: string;
    responsavel_id: string;
    data_limite: string;
    status: TarefaStatus;
  }) => Promise<void>;
}

export const TarefaModal: React.FC<TarefaModalProps> = ({
  tarefa,
  onClose,
  onSave,
}) => {
  const isEditing = Boolean(tarefa);

  const [nome, setNome] = useState(tarefa?.nome || '');
  const [responsavelId, setResponsavelId] = useState(tarefa?.responsavel_id || '');
  const [dataLimite, setDataLimite] = useState(tarefa?.data_limite || '');
  const [status, setStatus] = useState<TarefaStatus>(tarefa?.status || 'Pendente');

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadUsuarios() {
      try {
        setLoadingUsers(true);
        const list = await usuariosService.listarTodos();
        setUsuarios(list);
        if (!responsavelId && list.length > 0 && !tarefa) {
          setResponsavelId(list[0].id);
        }
      } catch (err) {
        console.warn('Erro ao carregar lista de usuários:', err);
      } finally {
        setLoadingUsers(false);
      }
    }
    loadUsuarios();
  }, [tarefa]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!nome.trim()) {
      setErrorMsg('Informe o nome/descrição da tarefa.');
      return;
    }

    if (!responsavelId) {
      setErrorMsg('Selecione o usuário responsável pela tarefa.');
      return;
    }

    if (!dataLimite) {
      setErrorMsg('Selecione a data limite para a tarefa.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        nome: nome.trim(),
        responsavel_id: responsavelId,
        data_limite: dataLimite,
        status,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao salvar tarefa.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-6 my-8 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
              {isEditing ? 'Gestão de Tarefas' : 'Nova Atribuição'}
            </span>
            <h3 className="text-lg font-black text-white mt-1">
              {isEditing ? 'Editar Tarefa' : 'Criar Nova Tarefa'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Nome da Tarefa */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Nome da Tarefa <span className="text-rose-400">*</span>
            </label>
            <textarea
              id="input-tarefa-nome"
              rows={3}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Auditoria de conferência de caixas no Corredor 02..."
              className="w-full bg-slate-950/90 border border-slate-700/80 rounded-2xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition resize-none"
              required
            />
          </div>

          {/* Responsável */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Responsável <span className="text-rose-400">*</span></span>
              <span className="text-[10px] text-slate-400 font-normal">Usuários do sistema</span>
            </label>
            <div className="relative">
              <select
                id="select-tarefa-responsavel"
                value={responsavelId}
                onChange={(e) => setResponsavelId(e.target.value)}
                disabled={loadingUsers}
                className="w-full bg-slate-950/90 border border-slate-700/80 rounded-2xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-blue-500 transition appearance-none min-h-[46px]"
                required
              >
                {loadingUsers ? (
                  <option value="">Carregando usuários...</option>
                ) : (
                  usuarios.map((u) => (
                    <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                      {u.nome} ({u.codigo}) — {u.departamento || u.nivel}
                    </option>
                  ))
                )}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                <UserIcon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              O responsável receberá a tarefa em sua listagem individual.
            </p>
          </div>

          {/* Grid: Data Limite e Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Data Limite <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  id="input-tarefa-data-limite"
                  value={dataLimite}
                  onChange={(e) => setDataLimite(e.target.value)}
                  className="w-full bg-slate-950/90 border border-slate-700/80 rounded-2xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-hidden focus:border-blue-500 transition min-h-[46px]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Status Inicial
              </label>
              <select
                id="select-tarefa-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TarefaStatus)}
                className="w-full bg-slate-950/90 border border-slate-700/80 rounded-2xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-blue-500 transition min-h-[46px]"
              >
                <option value="Pendente" className="bg-slate-900 text-white">Pendente</option>
                <option value="Concluído" className="bg-slate-900 text-white">Concluído</option>
                <option value="Não concluído" className="bg-slate-900 text-white">Não concluído</option>
              </select>
            </div>
          </div>

          {/* Info note */}
          <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 leading-relaxed">
            <p className="font-semibold text-blue-200 mb-0.5">Prazo Dinâmico Automático:</p>
            O status do prazo (Dentro do prazo, Finalizar hoje, Prazo estourado) é calculado em tempo real com base no calendário do sistema.
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              id="btn-cancelar-tarefa"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-2xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="btn-salvar-tarefa"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/30 active:scale-95 disabled:opacity-50 min-h-[44px]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isEditing ? 'Salvar Alterações' : 'Salvar Tarefa'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
