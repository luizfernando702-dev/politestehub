import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Truck,
  User,
  Calendar,
  Clock,
  Gauge,
  Layers,
  DollarSign,
  AlertCircle,
  Save,
  Plus,
  Trash2,
  FileText,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { Veiculo, Usuario, SaidaVeiculo, PeriodoSaida, ExpedicaoColeta } from '../../types';
import { veiculosService } from '../../services/veiculosService';
import { useAuth } from '../../context/AuthContext';
import { SelecionarEntregasModal } from './SelecionarEntregasModal';

interface SaidaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dados: {
    id?: string;
    data: string;
    horario: string;
    periodo: PeriodoSaida;
    veiculo_id: string;
    motorista_id: string;
    km_saida: number;
    observacao?: string | null;
    coletas_ids: string[];
    unidade_negocio?: string;
  }) => Promise<void>;
  saidaParaEditar?: SaidaVeiculo | null;
}

export const SaidaModal: React.FC<SaidaModalProps> = ({
  isOpen,
  onClose,
  onSave,
  saidaParaEditar,
}) => {
  const { user } = useAuth();
  const isEditing = Boolean(saidaParaEditar);

  const [data, setData] = useState('');
  const [horario, setHorario] = useState('');
  const [periodo, setPeriodo] = useState<PeriodoSaida>('Manhã');
  const [veiculoId, setVeiculoId] = useState('');
  const [motoristaId, setMotoristaId] = useState('');
  const [kmSaida, setKmSaida] = useState<string>('');
  const [observacao, setObservacao] = useState('');

  // Entregas selecionadas
  const [coletasSelecionadas, setColetasSelecionadas] = useState<ExpedicaoColeta[]>([]);
  const [modalEntregasOpen, setModalEntregasOpen] = useState(false);

  // Listas de apoio
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [motoristas, setMotoristas] = useState<Usuario[]>([]);
  const [loadingApoio, setLoadingApoio] = useState(false);

  // Informações de KM anterior para feedback em tempo real
  const [ultimoKmVeiculo, setUltimoKmVeiculo] = useState<number | null>(null);
  const [verificandoKm, setVerificandoKm] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Inicializa formulário e listas
  useEffect(() => {
    if (isOpen) {
      setLoadingApoio(true);
      setError(null);

      // Carregar veículos da unidade do usuário e motoristas
      veiculosService
        .listarVeiculos({ unidade_negocio: user?.unidade_negocio, apenasAtivos: true })
        .then(async (listaVeiculos) => {
          setVeiculos(listaVeiculos);

          const initialVeiculo = saidaParaEditar
            ? listaVeiculos.find((v) => v.id === saidaParaEditar.veiculo_id)
            : listaVeiculos[0];

          const targetUnit = initialVeiculo?.unidade_negocio || user?.unidade_negocio;
          const listaMotoristas = await veiculosService.obterMotoristas(targetUnit);
          setMotoristas(listaMotoristas);

          if (saidaParaEditar) {
            setData(saidaParaEditar.data);
            setHorario(saidaParaEditar.horario);
            setPeriodo(saidaParaEditar.periodo);
            setVeiculoId(saidaParaEditar.veiculo_id);
            setMotoristaId(saidaParaEditar.motorista_id);
            setKmSaida(String(saidaParaEditar.km_saida));
            setObservacao(saidaParaEditar.observacao || '');

            // Carregar entregas já associadas
            veiculosService.obterEntregasDaSaida(saidaParaEditar.id).then((coletas) => {
              setColetasSelecionadas(coletas);
            });
          } else {
            // Nova saída
            const hoje = new Date();
            const yyyy = hoje.getFullYear();
            const mm = String(hoje.getMonth() + 1).padStart(2, '0');
            const dd = String(hoje.getDate()).padStart(2, '0');
            setData(`${yyyy}-${mm}-${dd}`);

            const hh = String(hoje.getHours()).padStart(2, '0');
            const min = String(hoje.getMinutes()).padStart(2, '0');
            setHorario(`${hh}:${min}`);

            // Sugere período com base no horário atual
            const hourNum = hoje.getHours();
            setPeriodo(hourNum < 12 ? 'Manhã' : 'Tarde');

            if (listaVeiculos.length > 0) {
              setVeiculoId(listaVeiculos[0].id);
            }
            if (listaMotoristas.length > 0) {
              setMotoristaId(listaMotoristas[0].id);
            } else {
              setMotoristaId('');
            }
            setKmSaida('');
            setObservacao('');
            setColetasSelecionadas([]);
          }
        })
        .finally(() => {
          setLoadingApoio(false);
        });
    }
  }, [isOpen, saidaParaEditar, user?.unidade_negocio]);

  // Ao trocar o veículo, atualiza lista de motoristas conforme a unidade do veículo (Regra 15)
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

  // 2. Ao selecionar veículo, consulta a última saída dele para cálculo de KM e feedback
  useEffect(() => {
    if (veiculoId) {
      setVerificandoKm(true);
      veiculosService
        .obterUltimaSaidaDoVeiculo(veiculoId, undefined, undefined, saidaParaEditar?.id)
        .then((ultima) => {
          if (ultima) {
            setUltimoKmVeiculo(Number(ultima.km_saida));
          } else {
            setUltimoKmVeiculo(null);
          }
        })
        .finally(() => {
          setVerificandoKm(false);
        });
    } else {
      setUltimoKmVeiculo(null);
    }
  }, [veiculoId, saidaParaEditar?.id]);

  // 3. Totais automáticos calculados das entregas selecionadas (Regra 9)
  const quantidadeEntregas = coletasSelecionadas.length;
  const valorTotalNotas = useMemo(() => {
    return coletasSelecionadas.reduce((acc, c) => acc + (c.valor ? Number(c.valor) : 0), 0);
  }, [coletasSelecionadas]);

  // 4. KM Rodado estimado para preview
  const kmInformadoNum = parseFloat(kmSaida);
  const kmEstimado = useMemo(() => {
    if (isNaN(kmInformadoNum)) return null;
    if (ultimoKmVeiculo === null) return null; // Primeira saída
    const diff = kmInformadoNum - ultimoKmVeiculo;
    return diff >= 0 ? diff : null;
  }, [kmInformadoNum, ultimoKmVeiculo]);

  const kmInvalidoMenorQueAnterior =
    ultimoKmVeiculo !== null && !isNaN(kmInformadoNum) && kmInformadoNum < ultimoKmVeiculo;

  if (!isOpen) return null;

  const handleRemoverEntrega = (id: string) => {
    setColetasSelecionadas((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!data) {
      setError('Por favor, informe a data da saída.');
      return;
    }
    if (!horario) {
      setError('Por favor, informe o horário da saída.');
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
      setError('Por favor, selecione o motorista responsável.');
      return;
    }
    const motoristaSelecionado = motoristas.find((m) => m.id === motoristaId);
    if (!motoristaSelecionado) {
      setError('Por favor, selecione um motorista válido cadastrado no sistema.');
      return;
    }
    if (isNaN(kmInformadoNum) || kmInformadoNum < 0) {
      setError('Por favor, informe um KM de saída válido (somente números positivos).');
      return;
    }

    try {
      setSaving(true);
      await onSave({
        id: saidaParaEditar?.id,
        data,
        horario,
        periodo,
        veiculo_id: veiculoId,
        motorista_id: motoristaId,
        km_saida: kmInformadoNum,
        observacao: observacao.trim() || null,
        coletas_ids: coletasSelecionadas.map((c) => c.id),
        unidade_negocio: veiculoSelecionado.unidade_negocio || user?.unidade_negocio,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao registrar saída de veículo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
      >
        <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800 bg-slate-900/60 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {isEditing ? 'Editar Saída de Veículo' : 'Registrar Saída de Veículo'}
                </h2>
                <p className="text-xs text-slate-400">
                  {isEditing
                    ? 'Ajuste os dados da saída e entregas vinculadas'
                    : 'Informe apenas o KM de saída. O KM rodado e totais são calculados automaticamente.'}
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
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Grid: Data, Horário e Período */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Data <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="date"
                    required
                    id="input-saida-data"
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
                    id="input-saida-horario"
                    value={horario}
                    onChange={(e) => setHorario(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Período <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 p-1 bg-slate-950 border border-slate-700 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPeriodo('Manhã')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition ${
                      periodo === 'Manhã'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Manhã
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriodo('Tarde')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition ${
                      periodo === 'Tarde'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Tarde
                  </button>
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
                    id="select-saida-veiculo"
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
                    id="select-saida-motorista"
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
                    Para registrar saídas, atribua a função <strong>Motorista</strong> a um usuário no departamento <strong>Logística</strong> através do menu <em>Cadastros &gt; Usuários</em>.
                  </p>
                </div>
              </div>
            )}

            {/* Campo KM de Saída (Regra 3: O usuário informa SOMENTE o KM de saída) */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-white">
                  KM de Saída do Veículo <span className="text-rose-400">*</span>
                </label>
                <span className="text-[11px] text-slate-400">
                  {ultimoKmVeiculo !== null ? (
                    <span>
                      Último KM registrado:{' '}
                      <strong className="text-slate-200 font-mono">
                        {ultimoKmVeiculo.toLocaleString('pt-BR')} km
                      </strong>
                    </span>
                  ) : (
                    <span className="text-amber-400 font-semibold">Primeira saída deste veículo</span>
                  )}
                </span>
              </div>

              <div className="relative">
                <Gauge className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  required
                  id="input-saida-km"
                  value={kmSaida}
                  onChange={(e) => setKmSaida(e.target.value)}
                  placeholder={
                    ultimoKmVeiculo !== null
                      ? `Ex: ${ultimoKmVeiculo + 50}`
                      : 'Ex: 10000 (KM inicial no odômetro)'
                  }
                  className="w-full pl-10 pr-12 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                  km
                </span>
              </div>

              {/* Feedback dinâmico do KM rodado calculado */}
              <div className="pt-1">
                {ultimoKmVeiculo === null ? (
                  <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Primeira saída deste veículo. O KM informado servirá como base inicial para as próximas saídas. <strong>KM rodado: —</strong>
                    </span>
                  </div>
                ) : kmInvalidoMenorQueAnterior ? (
                  <div className="flex items-center gap-1.5 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                    <span>
                      Atenção: O KM informado ({kmInformadoNum.toLocaleString('pt-BR')} km) é menor que o último registrado ({ultimoKmVeiculo.toLocaleString('pt-BR')} km). Verifique o odômetro.
                    </span>
                  </div>
                ) : kmEstimado !== null ? (
                  <div className="flex items-center justify-between text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
                    <span>
                      KM da saída anterior: <strong className="font-mono">{ultimoKmVeiculo.toLocaleString('pt-BR')} km</strong>
                    </span>
                    <span className="font-bold">
                      KM rodado calculado: <strong className="font-mono text-sm">{kmEstimado.toLocaleString('pt-BR')} km</strong>
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Seção Entregas (Regras 8 e 9: Botão 'Selecionar entregas' + Totais automáticos) */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-400" />
                    <span>Entregas da Saída (Pedidos &gt; Coletas)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Selecione as coletas realizadas nesta viagem para vincular as notas fiscais
                  </p>
                </div>

                <button
                  type="button"
                  id="btn-abrir-selecao-entregas"
                  onClick={() => setModalEntregasOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-600/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Selecionar entregas</span>
                </button>
              </div>

              {/* Totais automáticos calculados (Não editáveis manualmente) */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800/80">
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Quantidade de entregas</span>
                  <div className="font-mono text-base font-bold text-white">
                    {quantidadeEntregas} {quantidadeEntregas === 1 ? 'entrega' : 'entregas'}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Valor total das notas</span>
                  <div className="font-mono text-base font-bold text-emerald-400">
                    {valorTotalNotas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>
              </div>

              {/* Lista visual das coletas vinculadas */}
              {coletasSelecionadas.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  Nenhuma entrega selecionada ainda. Clique em "Selecionar entregas" para buscar as coletas da unidade.
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                  {coletasSelecionadas.map((coleta) => (
                    <div
                      key={coleta.id}
                      className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="font-mono font-bold text-white">NF {coleta.numero_nota_fiscal}</span>
                        <span className="text-slate-400 truncate">· {coleta.cliente}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold text-emerald-400">
                          {coleta.valor
                            ? Number(coleta.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            : 'R$ 0,00'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoverEntrega(coleta.id)}
                          className="w-6 h-6 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition"
                          title="Remover entrega da saída"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Observação */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Observação da Saída</span>
                <span className="text-[11px] text-slate-500">Opcional</span>
              </label>
              <textarea
                id="input-saida-observacao"
                rows={2}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: Rota centro e setor sul, trânsito lento, entregas prioritárias..."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none"
              ></textarea>
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
                disabled={saving || veiculos.length === 0}
                id="btn-save-saida"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 transition disabled:opacity-50"
              >
                {saving ? (
                  <span>Gravando saída...</span>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{isEditing ? 'Salvar Alterações' : 'Lançar Saída'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal Selecionar Entregas */}
      <SelecionarEntregasModal
        isOpen={modalEntregasOpen}
        onClose={() => setModalEntregasOpen(false)}
        unidadeNegocio={user?.unidade_negocio}
        saidaAtualId={saidaParaEditar?.id}
        coletasSelecionadasIniciais={coletasSelecionadas}
        onConfirmar={(selecionadas) => {
          setColetasSelecionadas(selecionadas);
        }}
      />
    </>
  );
};
