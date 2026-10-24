import React, { useState, useEffect, useMemo } from 'react';
import { X, Fuel, Truck, User, Calendar, Clock, Gauge, DollarSign, AlertCircle, Save } from 'lucide-react';
import { Veiculo, Usuario, AbastecimentoVeiculo } from '../../types';
import { veiculosService } from '../../services/veiculosService';
import { useAuth } from '../../context/AuthContext';
import { parseMoeda, parseNumeroDecimal, formatarValorInput, formatarMoeda } from '../../utils/moeda';

interface AbastecimentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dados: {
    id?: string;
    data: string;
    horario: string;
    veiculo_id: string;
    motorista_id: string;
    km_abastecimento: number;
    quantidade_litros: number;
    valor_total: number;
    observacao?: string | null;
    unidade_negocio?: string;
  }) => Promise<void>;
  abastecimentoParaEditar?: AbastecimentoVeiculo | null;
}

export const AbastecimentoModal: React.FC<AbastecimentoModalProps> = ({
  isOpen,
  onClose,
  onSave,
  abastecimentoParaEditar,
}) => {
  const { user } = useAuth();
  const isEditing = Boolean(abastecimentoParaEditar);

  const [data, setData] = useState('');
  const [horario, setHorario] = useState('');
  const [veiculoId, setVeiculoId] = useState('');
  const [motoristaId, setMotoristaId] = useState('');
  const [kmAbastecimento, setKmAbastecimento] = useState('');
  const [quantidadeLitros, setQuantidadeLitros] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [observacao, setObservacao] = useState('');

  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [motoristas, setMotoristas] = useState<Usuario[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);

      veiculosService
        .listarVeiculos({ unidade_negocio: user?.unidade_negocio, apenasAtivos: true })
        .then(async (listaVeiculos) => {
          setVeiculos(listaVeiculos);

          const initialVeiculo = abastecimentoParaEditar
            ? listaVeiculos.find((v) => v.id === abastecimentoParaEditar.veiculo_id)
            : listaVeiculos[0];

          const targetUnit = initialVeiculo?.unidade_negocio || user?.unidade_negocio;
          const listaMotoristas = await veiculosService.obterMotoristas(targetUnit);
          setMotoristas(listaMotoristas);

          if (abastecimentoParaEditar) {
            setData(abastecimentoParaEditar.data);
            setHorario(abastecimentoParaEditar.horario);
            setVeiculoId(abastecimentoParaEditar.veiculo_id);
            setMotoristaId(abastecimentoParaEditar.motorista_id);
            setKmAbastecimento(String(abastecimentoParaEditar.km_abastecimento));
            setQuantidadeLitros(String(abastecimentoParaEditar.quantidade_litros));
            setValorTotal(abastecimentoParaEditar.valor_total ? formatarValorInput(abastecimentoParaEditar.valor_total) : '');
            setObservacao(abastecimentoParaEditar.observacao || '');
          } else {
            const hoje = new Date();
            const yyyy = hoje.getFullYear();
            const mm = String(hoje.getMonth() + 1).padStart(2, '0');
            const dd = String(hoje.getDate()).padStart(2, '0');
            setData(`${yyyy}-${mm}-${dd}`);

            const hh = String(hoje.getHours()).padStart(2, '0');
            const min = String(hoje.getMinutes()).padStart(2, '0');
            setHorario(`${hh}:${min}`);

            if (listaVeiculos.length > 0) setVeiculoId(listaVeiculos[0].id);
            if (listaMotoristas.length > 0) setMotoristaId(listaMotoristas[0].id);
            else setMotoristaId('');
            setKmAbastecimento('');
            setQuantidadeLitros('');
            setValorTotal('');
            setObservacao('');
          }
        });
    }
  }, [isOpen, abastecimentoParaEditar, user?.unidade_negocio]);

  // Ao trocar o veículo, atualiza motoristas correspondentes à unidade do veículo
  const handleVeiculoChange = async (novoVeiculoId: string) => {
    setVeiculoId(novoVeiculoId);
    const v = veiculos.find((item) => item.id === novoVeiculoId);
    if (v) {
      const novosMotoristas = await veiculosService.obterMotoristas(v.unidade_negocio);
      setMotoristas(novosMotoristas);
      if (!novosMotoristas.some((m) => m.id === motoristaId)) {
        setMotoristaId(novosMotoristas[0]?.id || '');
      }
    }
  };

  // Cálculo de Preço por Litro
  const precoLitroEstimado = useMemo(() => {
    const l = parseNumeroDecimal(quantidadeLitros);
    const v = parseMoeda(valorTotal);
    if (!isNaN(l) && !isNaN(v) && l > 0 && v >= 0) {
      return v / l;
    }
    return null;
  }, [quantidadeLitros, valorTotal]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const kmNum = parseFloat(kmAbastecimento);
    const litrosNum = parseNumeroDecimal(quantidadeLitros);
    const valorNum = parseMoeda(valorTotal);

    if (!data || !horario) {
      setError('Por favor, informe a data e horário do abastecimento.');
      return;
    }
    if (!veiculoId) {
      setError('Por favor, selecione o veículo.');
      return;
    }
    const veiculoSelecionado = veiculos.find((v) => v.id === veiculoId);
    if (!veiculoSelecionado) {
      setError('Por favor, selecione um veículo válido cadastrado na frota.');
      return;
    }
    if (!motoristaId) {
      setError('Por favor, selecione o motorista responsável pelo abastecimento.');
      return;
    }
    const motoristaSelecionado = motoristas.find((m) => m.id === motoristaId);
    if (!motoristaSelecionado) {
      setError('Por favor, selecione um motorista válido cadastrado no sistema.');
      return;
    }
    if (isNaN(kmNum) || kmNum < 0) {
      setError('Por favor, informe o KM do hodômetro no momento do abastecimento.');
      return;
    }
    if (isNaN(litrosNum) || litrosNum <= 0) {
      setError('Por favor, informe a quantidade de litros abastecida (maior que zero).');
      return;
    }
    if (isNaN(valorNum) || valorNum < 0) {
      setError('Por favor, informe o valor total abastecido em R$.');
      return;
    }

    try {
      setSaving(true);
      await onSave({
        id: abastecimentoParaEditar?.id,
        data,
        horario,
        veiculo_id: veiculoId,
        motorista_id: motoristaId,
        km_abastecimento: kmNum,
        quantidade_litros: litrosNum,
        valor_total: valorNum,
        observacao: observacao.trim() || null,
        unidade_negocio: veiculoSelecionado.unidade_negocio || user?.unidade_negocio,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar abastecimento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Fuel className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {isEditing ? 'Editar Abastecimento' : 'Registrar Abastecimento'}
              </h2>
              <p className="text-xs text-slate-400">
                Controle de combustível vinculado ao veículo e motorista
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

          {/* Data e Horário */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Data <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="date"
                  required
                  id="input-abast-data"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Horário <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="time"
                  required
                  id="input-abast-horario"
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>
          </div>

          {/* Veículo e Motorista */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Veículo <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Truck className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <select
                  id="select-abast-veiculo"
                  required
                  value={veiculoId}
                  onChange={(e) => handleVeiculoChange(e.target.value)}
                  className="w-full pl-10 pr-8 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition cursor-pointer"
                >
                  {veiculos.length === 0 ? (
                    <option value="">Nenhum veículo ativo na unidade</option>
                  ) : (
                    veiculos.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nome} ({v.placa})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Motorista <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <select
                  id="select-abast-motorista"
                  required
                  value={motoristaId}
                  onChange={(e) => setMotoristaId(e.target.value)}
                  className="w-full pl-10 pr-8 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition cursor-pointer"
                >
                  {motoristas.length === 0 ? (
                    <option value="">Nenhum motorista cadastrado</option>
                  ) : (
                    <>
                      <option value="">Selecione o motorista...</option>
                      {motoristas.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nome} ({m.funcao || 'Motorista'})
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>
            </div>
          </div>

          {motoristas.length === 0 && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Nenhum usuário com função "Motorista" encontrado.</p>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Para registrar abastecimentos, defina a função <strong>Motorista</strong> para um usuário no departamento <strong>Logística</strong> através do menu <em>Cadastros &gt; Usuários</em>.
                </p>
              </div>
            </div>
          )}

          {/* KM do Abastecimento */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              KM do Odômetro no Abastecimento <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Gauge className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="number"
                step="0.1"
                min="0"
                required
                id="input-abast-km"
                value={kmAbastecimento}
                onChange={(e) => setKmAbastecimento(e.target.value)}
                placeholder="Ex: 10450"
                className="w-full pl-10 pr-12 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                km
              </span>
            </div>
          </div>

          {/* Litros e Valor R$ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Quantidade Abastecida (Litros) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Fuel className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  required
                  id="input-abast-litros"
                  value={quantidadeLitros}
                  onChange={(e) => setQuantidadeLitros(e.target.value)}
                  placeholder="Ex: 45.50"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                  L
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Valor Total (R$) <span className="text-rose-400">*</span></span>
                {valorTotal.trim() && parseMoeda(valorTotal) > 0 && (
                  <span className="text-[11px] font-mono text-emerald-400 font-medium">
                    {formatarMoeda(parseMoeda(valorTotal))}
                  </span>
                )}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  id="input-abast-valor"
                  value={valorTotal}
                  onChange={(e) => {
                    const limpo = e.target.value.replace(/[^0-9.,]/g, '');
                    setValorTotal(limpo);
                  }}
                  onBlur={() => {
                    if (valorTotal.trim()) {
                      const num = parseMoeda(valorTotal);
                      if (num > 0) {
                        setValorTotal(formatarValorInput(num));
                      }
                    }
                  }}
                  placeholder="Ex: 275,00"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>
          </div>

          {/* Preço por Litro calculado */}
          {precoLitroEstimado !== null && (
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 font-sans">Preço médio por litro:</span>
              <strong className="text-amber-400 font-bold">
                {precoLitroEstimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / L
              </strong>
            </div>
          )}

          {/* Observação */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Observação</span>
              <span className="text-[11px] text-slate-500">Opcional</span>
            </label>
            <input
              type="text"
              id="input-abast-observacao"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Posto Ipiranga Rota BR-153, diesel S-10, nota fiscal 89412"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* Actions */}
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
              id="btn-save-abastecimento"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 transition disabled:opacity-50"
            >
              {saving ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isEditing ? 'Salvar Alterações' : 'Registrar Abastecimento'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
