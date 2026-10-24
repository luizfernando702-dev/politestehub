import React, { useState, useEffect } from 'react';
import { X, Building2, Truck, AlertCircle, Loader2 } from 'lucide-react';
import { Fornecedor, Transportadora } from '../../types';

interface CadastroModalProps {
  type: 'transportadora' | 'fornecedor';
  isOpen: boolean;
  itemToEdit?: Transportadora | Fornecedor | null;
  onClose: () => void;
  onSave: (data: { razao_social: string; nome_fantasia: string }) => Promise<void>;
}

export const CadastroModal: React.FC<CadastroModalProps> = ({
  type,
  isOpen,
  itemToEdit,
  onClose,
  onSave,
}) => {
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEditing = Boolean(itemToEdit);
  const titleText = type === 'transportadora' ? 'Transportadora' : 'Fornecedor / Fábrica';

  useEffect(() => {
    if (itemToEdit) {
      setRazaoSocial(itemToEdit.razao_social || '');
      setNomeFantasia(itemToEdit.nome_fantasia || '');
    } else {
      setRazaoSocial('');
      setNomeFantasia('');
    }
    setError(null);
  }, [itemToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanRazao = razaoSocial.trim();
    const cleanFantasia = nomeFantasia.trim();

    if (!cleanRazao) {
      setError('A Razão Social é obrigatória.');
      return;
    }
    if (!cleanFantasia) {
      setError('O Nome Fantasia é obrigatório.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        razao_social: cleanRazao,
        nome_fantasia: cleanFantasia,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar cadastro.';
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
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white ${
                type === 'transportadora'
                  ? 'bg-gradient-to-br from-blue-600 to-sky-500 shadow-blue-900/40'
                  : 'bg-gradient-to-br from-emerald-600 to-teal-500 shadow-emerald-900/40'
              } shadow-md`}
            >
              {type === 'transportadora' ? <Truck className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {isEditing ? `Editar ${titleText}` : `Nova ${titleText}`}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isEditing
                  ? 'Atualize as informações simplificadas da empresa'
                  : 'Preencha a Razão Social e o Nome Fantasia oficial'}
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-cadastro-modal"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error notice */}
        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 p-3.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Nome Fantasia */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Nome Fantasia <span className="text-rose-400">*</span>
              </label>
              <span className="text-[10px] text-blue-400 font-medium">Usado nas listas de Agendamento</span>
            </div>
            <input
              type="text"
              id="input-cad-nome-fantasia"
              value={nomeFantasia}
              onChange={(e) => setNomeFantasia(e.target.value)}
              placeholder={type === 'transportadora' ? 'Ex: Braspress, J&T Express, Rodonaves' : 'Ex: Nestlé Brasil, Ambev, M. Dias Branco'}
              required
              autoFocus
              className="w-full bg-slate-950/90 border border-slate-700/80 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition min-h-[46px]"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Nome pelo qual a empresa será identificada e selecionada no PoliHub.
            </p>
          </div>

          {/* Razão Social */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Razão Social <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              id="input-cad-razao-social"
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              placeholder={
                type === 'transportadora'
                  ? 'Ex: Braspress Transportes Urgentes Ltda'
                  : 'Ex: Nestlé Brasil Alimentos e Bebidas Ltda'
              }
              required
              className="w-full bg-slate-950/90 border border-slate-700/80 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition min-h-[46px]"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Nome oficial registrado da empresa.
            </p>
          </div>

          <div className="rounded-xl bg-slate-950/50 border border-slate-800/80 p-3 text-[11px] text-slate-400">
            <span className="text-slate-300 font-semibold">Estrutura Simplificada:</span> Campos fiscais como CNPJ, endereço e telefone foram desativados nesta etapa para máxima agilidade operacional.
          </div>

          {/* Buttons */}
          <div className="pt-4 border-t border-slate-800 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
            <button
              type="button"
              id="btn-cancel-cadastro"
              onClick={onClose}
              disabled={saving}
              className="w-full sm:w-auto px-5 py-2.5 rounded-2xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-sm font-semibold transition min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="btn-save-cadastro"
              disabled={saving}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl text-white text-sm font-bold shadow-lg transition min-h-[44px] ${
                type === 'transportadora'
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30'
              } disabled:opacity-50`}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <span>{isEditing ? 'Salvar Alterações' : 'Cadastrar'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
