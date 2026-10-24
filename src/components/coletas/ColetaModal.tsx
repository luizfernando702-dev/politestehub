import React, { useState, useEffect } from 'react';
import { X, Truck, Calendar, FileText, Building, Hash, AlertCircle, Save, CheckCircle2, UserCheck, Users, Layers } from 'lucide-react';
import { ExpedicaoColeta, StatusColeta, Transportadora, Usuario } from '../../types';
import { cadastrosService } from '../../services/cadastrosService';
import { usuariosService } from '../../services/usuariosService';
import { useAuth } from '../../context/AuthContext';
import { parseMoeda, formatarValorInput, formatarMoeda } from '../../utils/moeda';

interface ColetaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dados: {
    chave_nf?: string | null;
    numero_nota_fiscal: string;
    cliente: string;
    transportadora: string;
    status: StatusColeta;
    data: string;
    numero_coleta?: string | null;
    valor?: number | null;
    separador_id?: string | null;
    conferente_id?: string | null;
    quantidade?: number | null;
  }) => Promise<void>;
  coletaParaEditar?: ExpedicaoColeta | null;
}

export const ColetaModal: React.FC<ColetaModalProps> = ({
  isOpen,
  onClose,
  onSave,
  coletaParaEditar,
}) => {
  const { user } = useAuth();
  const isEditing = Boolean(coletaParaEditar);

  const [numeroNotaFiscal, setNumeroNotaFiscal] = useState('');
  const [valor, setValor] = useState('');
  const [cliente, setCliente] = useState('');
  const [transportadora, setTransportadora] = useState('');
  const [status, setStatus] = useState<StatusColeta>('Agendada');
  const [data, setData] = useState('');
  const [numeroColeta, setNumeroColeta] = useState('');

  // Novos campos operacionais
  const [separadorId, setSeparadorId] = useState('');
  const [conferenteId, setConferenteId] = useState('');
  const [quantidade, setQuantidade] = useState('1');

  // Listas auxiliares
  const [operadoresLogistica, setOperadoresLogistica] = useState<Usuario[]>([]);
  const [transportadorasCadastradas, setTransportadorasCadastradas] = useState<Transportadora[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inicializa o formulário ao abrir ou alterar a coleta selecionada
  useEffect(() => {
    if (isOpen) {
      if (coletaParaEditar) {
        setNumeroNotaFiscal(coletaParaEditar.numero_nota_fiscal || '');
        setValor(coletaParaEditar.valor ? formatarValorInput(coletaParaEditar.valor) : '');
        setCliente(coletaParaEditar.cliente || '');
        setTransportadora(coletaParaEditar.transportadora || '');
        setStatus(coletaParaEditar.status);
        setNumeroColeta(coletaParaEditar.numero_coleta || '');
        setSeparadorId(coletaParaEditar.separador_id || '');
        setConferenteId(coletaParaEditar.conferente_id || '');
        setQuantidade(
          coletaParaEditar.quantidade !== undefined && coletaParaEditar.quantidade !== null
            ? String(coletaParaEditar.quantidade)
            : '1'
        );
        // Formata data ISO para YYYY-MM-DDTHH:mm para input datetime-local
        try {
          const d = new Date(coletaParaEditar.data);
          // Ajuste de fuso horário local
          const offset = d.getTimezoneOffset() * 60000;
          const localIso = new Date(d.getTime() - offset).toISOString().slice(0, 16);
          setData(localIso);
        } catch {
          setData(new Date().toISOString().slice(0, 16));
        }
      } else {
        // Novo registro
        setNumeroNotaFiscal('');
        setValor('');
        setCliente('');
        setTransportadora('');
        setStatus('Agendada');
        setNumeroColeta('');
        setSeparadorId('');
        setConferenteId('');
        setQuantidade('1');
        const d = new Date();
        const offset = d.getTimezoneOffset() * 60000;
        setData(new Date(d.getTime() - offset).toISOString().slice(0, 16));
      }
      setError(null);
    }
  }, [isOpen, coletaParaEditar]);

  // Carrega lista de transportadoras e operadores de Logística da mesma unidade do usuário
  useEffect(() => {
    if (isOpen) {
      cadastrosService
        .listTransportadoras()
        .then((list) => setTransportadorasCadastradas(list))
        .catch((err) => console.warn('Aviso ao carregar transportadoras:', err));

      usuariosService
        .listarOperadoresLogistica(user?.unidade_negocio)
        .then((list) => setOperadoresLogistica(list))
        .catch((err) => console.warn('Aviso ao carregar operadores da Logística:', err));
    }
  }, [isOpen, user?.unidade_negocio]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const nfTrim = numeroNotaFiscal.trim();
    const clienteTrim = cliente.trim();
    const transportadoraTrim = transportadora.trim();
    const numeroColetaTrim = numeroColeta.trim();

    if (!nfTrim) {
      setError('Por favor, informe o número da Nota Fiscal.');
      return;
    }

    if (!clienteTrim) {
      setError('Por favor, informe o nome do cliente.');
      return;
    }

    if (!transportadoraTrim) {
      setError('Por favor, informe a transportadora responsável.');
      return;
    }

    // Regra da Quantidade: deve ser inteiro válido maior ou igual a 1
    const qtdNum = parseInt(String(quantidade).trim(), 10);
    if (isNaN(qtdNum) || qtdNum < 1 || String(quantidade).includes('.') || String(quantidade).includes(',')) {
      setError('Por favor, informe uma quantidade inteira válida (número inteiro maior ou igual a 1).');
      return;
    }

    // Regra do Número da Coleta:
    // Se "Agendada", número da coleta é OBRIGATÓRIO!
    // Se "Coletada", número da coleta é OPCIONAL.
    if (status === 'Agendada' && !numeroColetaTrim) {
      setError('O campo "Número da coleta" é obrigatório quando o status for "Agendada".');
      return;
    }

    try {
      setSaving(true);
      await onSave({
        chave_nf: null, // Campo em desuso substituído
        numero_nota_fiscal: nfTrim,
        cliente: clienteTrim,
        transportadora: transportadoraTrim,
        status,
        data: data ? new Date(data).toISOString() : new Date().toISOString(),
        numero_coleta: numeroColetaTrim || null,
        valor: parseMoeda(valor),
        separador_id: separadorId || null,
        conferente_id: conferenteId || null,
        quantidade: qtdNum,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar coleta.');
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
      <div
        className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {isEditing ? 'Editar Coleta de Expedição' : 'Cadastrar Nova Coleta'}
              </h2>
              <p className="text-xs text-slate-400">
                {isEditing
                  ? `Atualizando registro da NF ${coletaParaEditar?.numero_nota_fiscal}`
                  : 'Preencha os dados da nota fiscal e programação da coleta'}
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

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Status Selection Buttons */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Status da Coleta <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <button
                type="button"
                id="btn-status-agendada"
                onClick={() => setStatus('Agendada')}
                className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl border text-xs sm:text-sm font-bold transition min-h-[46px] ${
                  status === 'Agendada'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/50'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Agendada</span>
              </button>

              <button
                type="button"
                id="btn-status-coletada"
                onClick={() => setStatus('Coletada')}
                className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl border text-xs sm:text-sm font-bold transition min-h-[46px] ${
                  status === 'Coletada'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/50'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Coletada</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              {status === 'Agendada'
                ? '⚠️ Status "Agendada" exige o preenchimento obrigatório do Número da Coleta.'
                : '✓ Status "Coletada" indica expedição concluída (Número da Coleta opcional).'}
            </p>
          </div>

          {/* Grid: NF, Valor e Data */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Número da Nota Fiscal <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  required
                  id="input-coleta-nf"
                  value={numeroNotaFiscal}
                  onChange={(e) => setNumeroNotaFiscal(e.target.value)}
                  placeholder="Ex: 000.123.456"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Valor da NF (R$)</span>
                {valor.trim() && parseMoeda(valor) > 0 && (
                  <span className="text-[11px] font-mono text-emerald-400 font-medium">
                    {formatarMoeda(parseMoeda(valor))}
                  </span>
                )}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  id="input-coleta-valor"
                  value={valor}
                  onChange={(e) => {
                    const limpo = e.target.value.replace(/[^0-9.,]/g, '');
                    setValor(limpo);
                  }}
                  onBlur={() => {
                    if (valor.trim()) {
                      const num = parseMoeda(valor);
                      if (num > 0) {
                        setValor(formatarValorInput(num));
                      }
                    }
                  }}
                  placeholder="0,00"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Data e Horário <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="datetime-local"
                  required
                  id="input-coleta-data"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>
          </div>

          {/* Novos campos: Separador, Conferente e Quantidade (Substituindo a antiga Chave da NF) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
            {/* Separador */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>Separador</span>
              </label>
              <div className="relative">
                <select
                  id="select-coleta-separador"
                  value={separadorId}
                  onChange={(e) => setSeparadorId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500 transition"
                >
                  <option value="">Selecione o separador...</option>
                  {operadoresLogistica.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.nome} {op.codigo ? `(${op.codigo})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Logística da filial</p>
            </div>

            {/* Conferente */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Conferente</span>
              </label>
              <div className="relative">
                <select
                  id="select-coleta-conferente"
                  value={conferenteId}
                  onChange={(e) => setConferenteId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="">Selecione o conferente...</option>
                  {operadoresLogistica.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.nome} {op.codigo ? `(${op.codigo})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Logística da filial</p>
            </div>

            {/* Quantidade */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-emerald-400" />
                <span>Quantidade <span className="text-rose-400">*</span></span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  id="input-coleta-quantidade"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  placeholder="Ex: 1"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Total de itens (inteiro)</p>
            </div>
          </div>

          {/* Cliente */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Cliente Destinatário <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Building className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                required
                id="input-coleta-cliente"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Ex: Supermercados Guanabara S/A"
                className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          {/* Transportadora */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Transportadora <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Truck className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                required
                list="transportadoras-list"
                id="input-coleta-transportadora"
                value={transportadora}
                onChange={(e) => setTransportadora(e.target.value)}
                placeholder="Ex: Braspress, Jadlog ou digitar nome..."
                className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
              <datalist id="transportadoras-list">
                {transportadorasCadastradas.map((t) => (
                  <option key={t.id} value={t.nome_fantasia}>
                    {t.razao_social}
                  </option>
                ))}
              </datalist>
            </div>
          </div>

          {/* Número da Coleta (Regra Dinâmica) */}
          <div
            className={`p-3.5 rounded-2xl border transition-all ${
              status === 'Agendada'
                ? 'bg-amber-500/5 border-amber-500/30'
                : 'bg-slate-950/60 border-slate-800'
            }`}
          >
            <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-blue-400" />
                Número da Coleta
                {status === 'Agendada' ? (
                  <span className="text-rose-400 font-bold">* (Obrigatório)</span>
                ) : (
                  <span className="text-slate-400 font-normal">(Opcional)</span>
                )}
              </span>
            </label>
            <input
              type="text"
              id="input-coleta-numero-coleta"
              required={status === 'Agendada'}
              value={numeroColeta}
              onChange={(e) => setNumeroColeta(e.target.value)}
              placeholder={status === 'Agendada' ? 'Ex: COL-98241 (Obrigatório)' : 'Ex: COL-98241 (Opcional)'}
              className={`w-full px-3.5 py-2.5 bg-slate-900 border rounded-xl text-sm font-mono text-white placeholder-slate-500 focus:outline-none transition ${
                status === 'Agendada' && !numeroColeta.trim()
                  ? 'border-amber-500/50 focus:border-amber-400'
                  : 'border-slate-700 focus:border-blue-500'
              }`}
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              {status === 'Agendada'
                ? 'Para coletas agendadas, o código ou número de protocolo da coleta é exigido.'
                : 'Para coletas já realizadas, você pode manter ou preencher o número caso disponível.'}
            </p>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              id="btn-salvar-coleta"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition active:scale-[0.98] min-h-[44px]"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Gravando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Coleta'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
