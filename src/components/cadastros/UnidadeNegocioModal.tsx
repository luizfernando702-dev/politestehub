import React, { useState, useEffect } from 'react';
import { X, Building2, MapPin, Tag, Check, AlertCircle, Loader2 } from 'lucide-react';
import { UnidadeNegocio } from '../../types';

interface UnidadeNegocioModalProps {
  isOpen: boolean;
  itemToEdit?: UnidadeNegocio | null;
  onClose: () => void;
  onSave: (dados: {
    nome: string;
    sigla?: string | null;
    cidade?: string | null;
    estado?: string | null;
    ativo?: boolean;
  }) => Promise<void>;
}

export const UnidadeNegocioModal: React.FC<UnidadeNegocioModalProps> = ({
  isOpen,
  itemToEdit,
  onClose,
  onSave,
}) => {
  const [nome, setNome] = useState('');
  const [sigla, setSigla] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEditing = Boolean(itemToEdit);

  useEffect(() => {
    if (itemToEdit) {
      setNome(itemToEdit.nome || '');
      setSigla(itemToEdit.sigla || '');
      setCidade(itemToEdit.cidade || '');
      setEstado(itemToEdit.estado || '');
      setAtivo(itemToEdit.ativo !== false);
    } else {
      setNome('');
      setSigla('');
      setCidade('');
      setEstado('');
      setAtivo(true);
    }
    setError(null);
  }, [itemToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanNome = nome.trim();
    if (!cleanNome) {
      setError('O nome da unidade de negócio é obrigatório.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        nome: cleanNome,
        sigla: sigla.trim().toUpperCase() || null,
        cidade: cidade.trim() || null,
        estado: estado.trim().toUpperCase() || null,
        ativo,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar a unidade de negócio.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
    >
      <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-5 sm:p-7 text-slate-100 my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white bg-gradient-to-br from-blue-600 to-indigo-600 shadow-blue-900/40 shadow-md">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {isEditing ? 'Editar Unidade de Negócio' : 'Nova Unidade de Negócio'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isEditing
                  ? 'Atualize o nome, sigla e localização da filial'
                  : 'Cadastre uma nova filial para segregação de estoque e cargas'}
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

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs sm:text-sm text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Nome da Unidade / Filial <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Building2 className="w-4 h-4" />
              </div>
              <input
                type="text"
                id="input-unidade-nome"
                required
                autoFocus
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Goiânia, Mato Grosso, Anápolis..."
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition min-h-[44px]"
              />
            </div>
            <p className="text-[11px] text-slate-300 mt-1">
              Nome oficial que aparecerá nos filtros, crachás e relatórios operacionais.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Sigla
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Tag className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  id="input-unidade-sigla"
                  maxLength={5}
                  value={sigla}
                  onChange={(e) => setSigla(e.target.value.toUpperCase())}
                  placeholder="Ex: GYN"
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition uppercase font-mono min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Cidade
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <MapPin className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  id="input-unidade-cidade"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="Ex: Goiânia"
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Estado (UF)
              </label>
              <input
                type="text"
                id="input-unidade-estado"
                maxLength={2}
                value={estado}
                onChange={(e) => setEstado(e.target.value.toUpperCase())}
                placeholder="Ex: GO"
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition uppercase font-mono min-h-[44px]"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2.5 cursor-pointer select-none bg-slate-950/40 border border-slate-800 p-3 rounded-xl hover:border-slate-700 transition">
              <input
                type="checkbox"
                id="checkbox-unidade-ativo"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0 cursor-pointer"
              />
              <div>
                <span className="text-xs font-semibold text-white">Unidade Ativa</span>
                <p className="text-[11px] text-slate-400">
                  Unidades ativas ficam visíveis para seleção em novos agendamentos e cadastro de colaboradores.
                </p>
              </div>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-slate-700/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="btn-salvar-unidade"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-blue-900/30 disabled:opacity-50 min-h-[44px]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{isEditing ? 'Salvar Alterações' : 'Cadastrar Unidade'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
