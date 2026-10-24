import React, { useState, useEffect } from 'react';
import { X, Truck, Building2, Hash, CheckCircle2, AlertCircle, Save } from 'lucide-react';
import { Veiculo } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { unidadesNegocioService } from '../../services/unidadesNegocioService';
import { normalizarUnidadeNegocio } from '../../constants/unidades';

interface VeiculoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dados: {
    id?: string;
    nome: string;
    marca: string;
    placa: string;
    unidade_negocio: string;
    unidade_negocio_id?: string | null;
    ativo: boolean;
  }) => Promise<void>;
  veiculoParaEditar?: Veiculo | null;
}

export const VeiculoModal: React.FC<VeiculoModalProps> = ({
  isOpen,
  onClose,
  onSave,
  veiculoParaEditar,
}) => {
  const { user } = useAuth();
  const isEditing = Boolean(veiculoParaEditar);

  const [nome, setNome] = useState('');
  const [marca, setMarca] = useState('');
  const [placa, setPlaca] = useState('');
  const [unidadeNegocio, setUnidadeNegocio] = useState('');
  const [unidadeNegocioId, setUnidadeNegocioId] = useState<string | null>(null);
  const [ativo, setAtivo] = useState(true);

  const [unidades, setUnidades] = useState<Array<{ id: string; nome: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      unidadesNegocioService
        .listar()
        .then((list) => {
          setUnidades(list);
        })
        .catch(() => {});

      if (veiculoParaEditar) {
        setNome(veiculoParaEditar.nome || '');
        setMarca(veiculoParaEditar.marca || '');
        setPlaca(veiculoParaEditar.placa || '');
        setUnidadeNegocio(veiculoParaEditar.unidade_negocio || user?.unidade_negocio || '');
        setUnidadeNegocioId(veiculoParaEditar.unidade_negocio_id || null);
        setAtivo(veiculoParaEditar.ativo !== false);
      } else {
        setNome('');
        setMarca('');
        setPlaca('');
        setUnidadeNegocio(user?.unidade_negocio || 'Goiânia-GO');
        setUnidadeNegocioId(null);
        setAtivo(true);
      }
      setError(null);
    }
  }, [isOpen, veiculoParaEditar, user?.unidade_negocio]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const nomeTrim = nome.trim();
    const marcaTrim = marca.trim();
    const placaTrim = placa.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');

    if (!nomeTrim) {
      setError('Por favor, informe o nome ou identificação do veículo (Ex: Fiorino 01).');
      return;
    }

    if (!marcaTrim) {
      setError('Por favor, informe a marca/fabricante do veículo (Ex: Fiat, Renault).');
      return;
    }

    if (!placaTrim) {
      setError('Por favor, informe a placa do veículo (Ex: BRA2E19).');
      return;
    }

    try {
      setSaving(true);
      const matchedUnit = unidades.find((u) => u.nome === unidadeNegocio);
      await onSave({
        id: veiculoParaEditar?.id,
        nome: nomeTrim,
        marca: marcaTrim,
        placa: placaTrim,
        unidade_negocio: normalizarUnidadeNegocio(unidadeNegocio),
        unidade_negocio_id: matchedUnit?.id || unidadeNegocioId,
        ativo,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar veículo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {isEditing ? 'Editar Veículo da Frota' : 'Cadastrar Novo Veículo'}
              </h2>
              <p className="text-xs text-slate-400">
                {isEditing
                  ? `Atualizando cadastro do veículo ${veiculoParaEditar?.nome}`
                  : 'Cadastre um veículo para controle de rotas, saídas e abastecimentos'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Nome / Identificação */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Nome / Identificação do Veículo <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Truck className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                required
                id="input-veiculo-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Fiorino 01, Strada Branca, Master 02"
                className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          {/* Marca e Placa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Marca / Fabricante <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                id="input-veiculo-marca"
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                placeholder="Ex: Fiat, Renault, VW"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Placa do Veículo <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  required
                  id="input-veiculo-placa"
                  value={placa}
                  maxLength={10}
                  onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                  placeholder="Ex: BRA2E19"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono uppercase text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>
          </div>

          {/* Unidade de Negócio */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Unidade de Negócio do Veículo <span className="text-rose-400">*</span></span>
              <span className="text-[11px] text-slate-500">Pertence a esta filial</span>
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <select
                id="select-veiculo-unidade"
                value={unidadeNegocio}
                onChange={(e) => setUnidadeNegocio(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition cursor-pointer"
              >
                {unidades.length > 0 ? (
                  unidades.map((u) => (
                    <option key={u.id} value={u.nome}>
                      {u.nome}
                    </option>
                  ))
                ) : (
                  <option value={unidadeNegocio || 'Goiânia-GO'}>
                    {unidadeNegocio || 'Goiânia-GO'}
                  </option>
                )}
              </select>
            </div>
          </div>

          {/* Status Ativo */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white">Veículo Ativo na Frota</div>
              <div className="text-[11px] text-slate-400">
                Veículos desativados não aparecem para novas saídas, mas mantêm todo o histórico preservado.
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-3">
              <input
                type="checkbox"
                id="toggle-veiculo-ativo"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              id="btn-save-veiculo"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 transition disabled:opacity-50"
            >
              {saving ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isEditing ? 'Salvar Alterações' : 'Cadastrar Veículo'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
