import React, { useState, useEffect } from 'react';
import {
  X,
  Edit2,
  Package,
  User,
  MapPin,
  Calendar,
  Clock,
  Loader2,
  AlertCircle,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { Demonstracao, Usuario } from '../../types';
import { demonstracoesService } from '../../services/demonstracoesService';
import { usuariosService } from '../../services/usuariosService';

interface EditarDemonstracaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  demonstracao: Demonstracao | null;
  currentUser: Usuario | null;
  onSalvo: (atualizada: Demonstracao) => void;
}

export const EditarDemonstracaoModal: React.FC<EditarDemonstracaoModalProps> = ({
  isOpen,
  onClose,
  demonstracao,
  currentUser,
  onSalvo,
}) => {
  const [colaborador, setColaborador] = useState('');
  const [endereco, setEndereco] = useState('');
  const [observacao, setObservacao] = useState('');
  const [dataDevolvida, setDataDevolvida] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [colaboradores, setColaboradores] = useState<Usuario[]>([]);

  useEffect(() => {
    if (demonstracao) {
      setColaborador(demonstracao.colaborador || '');
      setEndereco(demonstracao.endereco || '');
      setObservacao(demonstracao.observacao || '');
      setDataDevolvida(
        demonstracao.data_devolvida
          ? new Date(demonstracao.data_devolvida).toISOString().slice(0, 16)
          : ''
      );
      setErro(null);
    }
  }, [demonstracao, isOpen]);

  useEffect(() => {
    async function carregarColaboradores() {
      try {
        const list = await usuariosService.listarTodos();
        setColaboradores(list);
      } catch (err) {
        console.warn('Erro ao carregar colaboradores:', err);
      }
    }
    carregarColaboradores();
  }, []);

  if (!isOpen || !demonstracao) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!endereco.trim()) {
      setErro('O endereço é obrigatório.');
      return;
    }
    if (!colaborador.trim()) {
      setErro('O colaborador é obrigatório.');
      return;
    }

    setLoading(true);
    setErro(null);

    try {
      const atualizada = await demonstracoesService.atualizarDemonstracao(
        demonstracao.id,
        {
          endereco: endereco.trim(),
          colaborador: colaborador.trim(),
          observacao: observacao.trim() || null,
          data_devolvida: dataDevolvida ? new Date(dataDevolvida).toISOString() : null,
        },
        currentUser?.nivel
      );

      onSalvo(atualizada);
      onClose();
    } catch (err: any) {
      setErro(err?.message || 'Erro ao salvar alterações da demonstração.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Edit2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Editar Registro de Demonstração
              </h2>
              <p className="text-xs text-slate-400">
                Permissão exclusiva de Gestor e Assistente
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {erro && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{erro}</span>
            </div>
          )}

          {/* Produto (read-only) */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Produto
            </label>
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="truncate">{demonstracao.produto}</span>
              {demonstracao.codigo_produto && (
                <span className="ml-auto text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                  {demonstracao.codigo_produto}
                </span>
              )}
            </div>
          </div>

          {/* Colaborador */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Colaborador Responsável *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <select
                value={colaborador}
                onChange={(e) => setColaborador(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:outline-none focus:border-blue-500 min-h-[44px]"
              >
                <option value="">Selecione o colaborador...</option>
                {colaboradores.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome} ({u.codigo || u.funcao || u.departamento})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Endereço */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Endereço Físico *
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value.toUpperCase())}
                placeholder="Ex: A-01-02"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:outline-none focus:border-blue-500 min-h-[44px]"
              />
            </div>
          </div>

          {/* Data Devolução */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Data de Devolução (Deixar em branco se ainda em aberto)
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="datetime-local"
                value={dataDevolvida}
                onChange={(e) => setDataDevolvida(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:outline-none focus:border-blue-500 min-h-[44px]"
              />
            </div>
          </div>

          {/* Observação */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Observações
            </label>
            <textarea
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Descreva detalhes do cliente, motivo ou condições..."
              className="w-full p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/30 disabled:opacity-50 min-h-[44px]"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Salvar Alterações</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
