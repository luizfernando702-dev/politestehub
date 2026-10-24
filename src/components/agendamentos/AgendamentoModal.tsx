import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Save,
  AlertCircle,
  Calendar,
  Truck,
  FileText,
  Layers,
  Hash,
  Building2,
  Clock,
  FileSpreadsheet,
  Package,
} from 'lucide-react';
import { Agendamento, Fornecedor, Transportadora } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { isUserGestor } from '../../lib/permissions';
import { cadastrosService } from '../../services/cadastrosService';
import { SearchableSelect } from '../common/SearchableSelect';
import { CadastroModal } from '../cadastros/CadastroModal';
import { ImportarExcelProdutosModal } from './ImportarExcelProdutosModal';
import { ProdutosRecebidosModal } from './ProdutosRecebidosModal';

interface AgendamentoModalProps {
  agendamento?: Agendamento | null;
  onClose: () => void;
  onSave: (
    data: Omit<Agendamento, 'id'> | Partial<Agendamento>,
    registrosAdicionais?: Omit<Agendamento, 'id'>[]
  ) => Promise<void>;
}

export const AgendamentoModal: React.FC<AgendamentoModalProps> = ({
  agendamento,
  onClose,
  onSave,
}) => {
  const { user } = useAuth();
  const isGestor = isUserGestor(user);
  const isEditing = Boolean(agendamento);

  const [data] = useState(agendamento?.data || new Date().toISOString().slice(0, 10));
  // Inicia vazio para novo agendamento, conforme solicitado pelo usuário
  const [dataPrevista, setDataPrevista] = useState(agendamento?.data_prevista || '');
  const [horario, setHorario] = useState(agendamento?.horario || '');
  const [fornecedor, setFornecedor] = useState(agendamento?.fornecedor || '');
  const [fornecedorId, setFornecedorId] = useState<string | null>(agendamento?.fornecedor_id || null);
  const [notaFiscal, setNotaFiscal] = useState(agendamento?.nota_fiscal || '');
  const [notasAdicionais, setNotasAdicionais] = useState(agendamento?.notas_adicionais || '');
  const [volumes, setVolumes] = useState(agendamento?.volumes ? String(agendamento.volumes) : '');
  const [tipoVolumes, setTipoVolumes] = useState<Agendamento['tipo_volumes'] | ''>(
    agendamento?.tipo_volumes || ''
  );
  const [transportadora, setTransportadora] = useState(agendamento?.transportadora || '');
  const [transportadoraId, setTransportadoraId] = useState<string | null>(agendamento?.transportadora_id || null);

  // Cadastros lists
  const [fornecedoresList, setFornecedoresList] = useState<Fornecedor[]>([]);
  const [transportadorasList, setTransportadorasList] = useState<Transportadora[]>([]);

  // Quick add modals
  const [quickFornecedorOpen, setQuickFornecedorOpen] = useState(false);
  const [quickTransportadoraOpen, setQuickTransportadoraOpen] = useState(false);
  const [importarExcelOpen, setImportarExcelOpen] = useState(false);
  const [produtosRecebidosOpen, setProdutosRecebidosOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Identifica NFs adicionais a partir das vírgulas no campo notasAdicionais
  const nfsAdicionaisIdentificadas = useMemo(() => {
    if (!notasAdicionais.trim()) return [];
    return notasAdicionais
      .split(',')
      .map((nf) => nf.trim())
      .filter((nf) => nf.length > 0 && nf.toLowerCase() !== notaFiscal.trim().toLowerCase());
  }, [notasAdicionais, notaFiscal]);

  useEffect(() => {
    // Carrega fornecedores cadastrados
    cadastrosService.listFornecedores().then((list) => {
      setFornecedoresList(list);
      if (agendamento?.fornecedor && !agendamento.fornecedor_id) {
        const match = list.find(
          (f) =>
            f.nome_fantasia.toLowerCase() === agendamento.fornecedor.toLowerCase() ||
            f.razao_social.toLowerCase() === agendamento.fornecedor.toLowerCase()
        );
        if (match) setFornecedorId(match.id);
      }
    });

    // Carrega transportadoras cadastradas
    cadastrosService.listTransportadoras().then((list) => {
      setTransportadorasList(list);
      if (agendamento?.transportadora && !agendamento.transportadora_id) {
        const match = list.find(
          (t) =>
            t.nome_fantasia.toLowerCase() === agendamento.transportadora.toLowerCase() ||
            t.razao_social.toLowerCase() === agendamento.transportadora.toLowerCase()
        );
        if (match) setTransportadoraId(match.id);
      }
    });
  }, [agendamento]);

  const handleQuickCreateFornecedor = async (data: { razao_social: string; nome_fantasia: string }) => {
    const created = await cadastrosService.createFornecedor(data);
    setFornecedoresList((prev) => [created, ...prev.filter((f) => f.id !== created.id)]);
    setFornecedor(created.nome_fantasia);
    setFornecedorId(created.id);
  };

  const handleQuickCreateTransportadora = async (data: { razao_social: string; nome_fantasia: string }) => {
    const created = await cadastrosService.createTransportadora(data);
    setTransportadorasList((prev) => [created, ...prev.filter((t) => t.id !== created.id)]);
    setTransportadora(created.nome_fantasia);
    setTransportadoraId(created.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isGestor) {
      setError('Apenas usuários com perfil "gestor" têm permissão para cadastrar ou modificar agendamentos.');
      return;
    }

    if (!fornecedor.trim()) {
      setError('Por favor, selecione ou informe o fornecedor.');
      return;
    }
    if (!notaFiscal.trim()) {
      setError('Informe o número da Nota Fiscal Principal (NF).');
      return;
    }
    if (!transportadora.trim()) {
      setError('Por favor, selecione ou informe a transportadora responsável.');
      return;
    }
    if (!volumes.trim()) {
      setError('Por favor, informe a quantidade de volumes.');
      return;
    }
    const volNum = parseInt(volumes, 10);
    if (isNaN(volNum) || volNum <= 0) {
      setError('A quantidade de volumes deve ser um número maior que zero.');
      return;
    }
    if (!tipoVolumes) {
      setError('Por favor, selecione o tipo de embalagem / volume.');
      return;
    }
    if (!dataPrevista) {
      setError('Informe a data prevista para entrega/recebimento.');
      return;
    }
    if (!horario.trim()) {
      setError('Por favor, informe o horário agendado.');
      return;
    }

    setSaving(true);
    try {
      if (isEditing && agendamento) {
        await onSave({
          data,
          data_prevista: dataPrevista,
          horario: horario.trim(),
          data_entrega: agendamento.data_entrega || null,
          fornecedor: fornecedor.trim(),
          fornecedor_id: fornecedorId || null,
          nota_fiscal: notaFiscal.trim(),
          notas_adicionais: notasAdicionais.trim() || null,
          volumes: volNum,
          tipo_volumes: tipoVolumes as Agendamento['tipo_volumes'],
          transportadora: transportadora.trim(),
          transportadora_id: transportadoraId || null,
          status: agendamento.status || 'Pendente',
          usuario_id: agendamento.usuario_id || user?.id || null,
          usuario_insercao: agendamento.usuario_insercao || user?.nome || user?.codigo || 'OP-1042',
          endereco_alocacao: agendamento.endereco_alocacao || null,
          xml_nota: agendamento.xml_nota || null,
          chave_nf: agendamento.chave_nf || null,
        });
      } else {
        // Todo novo agendamento deve ser criado automaticamente com status 'Pendente'
        // 1. Registro da NF principal
        const dadosPrincipal: Omit<Agendamento, 'id'> = {
          data,
          data_prevista: dataPrevista,
          horario: horario.trim(),
          data_entrega: null,
          fornecedor: fornecedor.trim(),
          fornecedor_id: fornecedorId || null,
          nota_fiscal: notaFiscal.trim(),
          notas_adicionais: nfsAdicionaisIdentificadas.length > 0 ? nfsAdicionaisIdentificadas.join(', ') : null,
          volumes: volNum,
          tipo_volumes: tipoVolumes as Agendamento['tipo_volumes'],
          transportadora: transportadora.trim(),
          transportadora_id: transportadoraId || null,
          status: 'Pendente',
          usuario_id: user?.id || null,
          usuario_insercao: user?.nome || user?.codigo || 'OP-1042',
          data_insercao: new Date().toISOString(),
          endereco_alocacao: null,
          xml_nota: null,
          chave_nf: null,
        };

        // 2. Registros adicionais para cada NF adicional identificada
        const novosRegistrosAdicionais: Omit<Agendamento, 'id'>[] = nfsAdicionaisIdentificadas.map((nfAdicional) => ({
          data,
          data_prevista: dataPrevista,
          horario: horario.trim(),
          data_entrega: null,
          fornecedor: fornecedor.trim(),
          fornecedor_id: fornecedorId || null,
          nota_fiscal: nfAdicional,
          notas_adicionais: null,
          volumes: volNum,
          tipo_volumes: tipoVolumes as Agendamento['tipo_volumes'],
          transportadora: transportadora.trim(),
          transportadora_id: transportadoraId || null,
          status: 'Pendente',
          usuario_id: user?.id || null,
          usuario_insercao: user?.nome || user?.codigo || 'OP-1042',
          data_insercao: new Date().toISOString(),
          endereco_alocacao: null,
          xml_nota: null,
          chave_nf: null,
        }));

        await onSave(dadosPrincipal, novosRegistrosAdicionais);
      }
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao salvar agendamento.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-5 sm:p-7 text-slate-100 my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              {isEditing ? 'Editar Agendamento' : 'Novo Agendamento de Carga'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isEditing
                ? 'Atualize as informações do agendamento de carga'
                : 'Preencha os dados da carga prevista para o recebimento'}
            </p>
          </div>
          <button
            type="button"
            id="btn-close-agendamento-modal"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 p-3.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* Form Body - Organizado em 5 linhas na ordem especificada */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* 1. Fornecedor */}
          <div>
            <SearchableSelect
              id="select-ag-fornecedor"
              label="Fornecedor / Fábrica"
              value={fornecedor}
              selectedId={fornecedorId}
              placeholder="-- Selecionar Fornecedor Cadastrado --"
              searchPlaceholder="Filtrar fornecedor por nome..."
              quickAddLabel={isGestor ? "+ Cadastrar novo fornecedor" : undefined}
              required
              icon={<Building2 className="w-4 h-4 text-emerald-400" />}
              options={fornecedoresList
                .filter((f) => f.ativo !== false)
                .map((f) => ({
                  id: f.id,
                  label: f.nome_fantasia,
                  subLabel: f.razao_social,
                }))}
              onSelect={(opt) => {
                setFornecedor(opt.label);
                setFornecedorId(opt.id);
              }}
              onQuickAdd={isGestor ? () => setQuickFornecedorOpen(true) : undefined}
            />
          </div>

          {/* 2. Nota principal — Notas adicionais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Nota Principal (NF) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <FileText className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  id="input-ag-nf"
                  value={notaFiscal}
                  onChange={(e) => setNotaFiscal(e.target.value)}
                  placeholder="Ex: 004.892.110"
                  required
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition min-h-[46px]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Notas Adicionais
                </label>
                {!isEditing && nfsAdicionaisIdentificadas.length > 0 && (
                  <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md">
                    +{nfsAdicionaisIdentificadas.length} {nfsAdicionaisIdentificadas.length === 1 ? 'registro novo' : 'registros novos'}
                  </span>
                )}
              </div>
              <input
                type="text"
                id="input-ag-notas-adicionais"
                value={notasAdicionais}
                onChange={(e) => setNotasAdicionais(e.target.value)}
                placeholder="Ex: 192.622, 193.698, 197.986"
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl px-4 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition min-h-[46px]"
              />
              {!isEditing && nfsAdicionaisIdentificadas.length > 0 && (
                <div className="mt-2 p-2.5 rounded-xl bg-sky-950/40 border border-sky-500/30 text-xs text-slate-300 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-sky-300 text-[11px]">
                    <FileText className="w-3.5 h-3.5 text-sky-400" />
                    <span>{nfsAdicionaisIdentificadas.length} {nfsAdicionaisIdentificadas.length === 1 ? 'NF adicional identificada' : 'NFs adicionais identificadas'}:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {nfsAdicionaisIdentificadas.map((nf, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-500/40 text-sky-200 font-mono text-[11px]"
                      >
                        {nf}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Ao salvar, será criado 1 novo agendamento individual para cada NF adicional com os mesmos dados de fornecedor, transportadora, datas e horários.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 3. Transportadora */}
          <div>
            <SearchableSelect
              id="select-ag-transportadora"
              label="Transportadora"
              value={transportadora}
              selectedId={transportadoraId}
              placeholder="-- Selecionar Transportadora Cadastrada --"
              searchPlaceholder="Filtrar transportadora por nome..."
              quickAddLabel={isGestor ? "+ Cadastrar nova transportadora" : undefined}
              required
              icon={<Truck className="w-4 h-4 text-blue-400" />}
              options={transportadorasList
                .filter((t) => t.ativo !== false)
                .map((t) => ({
                  id: t.id,
                  label: t.nome_fantasia,
                  subLabel: t.razao_social,
                }))}
              onSelect={(opt) => {
                setTransportadora(opt.label);
                setTransportadoraId(opt.id);
              }}
              onQuickAdd={isGestor ? () => setQuickTransportadoraOpen(true) : undefined}
            />
          </div>

          {/* 4. Volumes — Tipo de embalagem */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Volumes <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Hash className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  min="1"
                  id="input-ag-volumes"
                  value={volumes}
                  onChange={(e) => setVolumes(e.target.value)}
                  placeholder="Ex: 24"
                  required
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition min-h-[46px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Tipo de Embalagem <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Layers className="w-4 h-4" />
                </div>
                <select
                  id="select-ag-tipo-volume"
                  value={tipoVolumes}
                  onChange={(e) => setTipoVolumes(e.target.value as Agendamento['tipo_volumes'])}
                  required
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-hidden focus:border-blue-500 transition min-h-[46px]"
                >
                  <option value="" disabled>
                    -- Selecione o Tipo de Embalagem --
                  </option>
                  <option value="Paletes">Paletes (PBR / Padrão)</option>
                  <option value="Caixas">Caixas</option>
                  <option value="Fardos">Fardos</option>
                  <option value="Tambores">Tambores / Bombonas</option>
                  <option value="Sacarias">Sacarias</option>
                  <option value="Containers">Containers</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
            </div>
          </div>

          {/* 5. Data prevista — Horário */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>Data Prevista <span className="text-rose-400">*</span></span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  id="input-ag-data-prevista"
                  value={dataPrevista}
                  onChange={(e) => setDataPrevista(e.target.value)}
                  required
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-blue-500 transition min-h-[46px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  <span>Horário Agendado <span className="text-rose-400">*</span></span>
                </span>
                <span className="text-[10px] text-sky-400 font-mono">hh:mm</span>
              </label>
              <div className="relative">
                <input
                  type="time"
                  id="input-ag-horario"
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  placeholder="09:00"
                  required
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-hidden focus:border-blue-500 transition min-h-[46px]"
                />
              </div>
            </div>
          </div>

          {/* Seção: Produtos recebidos da nota (Apenas na edição) */}
          {isEditing && agendamento && (
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-400" />
                    <span>Produtos recebidos da nota</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Importe os itens da NF via planilha Excel ou gerencie os produtos recebidos manualmente.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setImportarExcelOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition min-h-[40px]"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Importar produtos pelo Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProdutosRecebidosOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs border border-slate-700 transition min-h-[40px]"
                  >
                    <Package className="w-4 h-4 text-slate-400" />
                    <span>Gerenciar Produtos</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-800 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
            <button
              type="button"
              id="btn-cancel-agendamento"
              onClick={onClose}
              disabled={saving}
              className="w-full sm:w-auto px-5 py-2.5 rounded-2xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 font-semibold text-sm transition min-h-[46px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="btn-save-agendamento"
              disabled={saving}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 transition active:scale-95 disabled:opacity-50 min-h-[46px] cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>
                {saving
                  ? 'Salvando...'
                  : isEditing
                  ? 'Atualizar Agendamento'
                  : nfsAdicionaisIdentificadas.length > 0
                  ? `Salvar (${1 + nfsAdicionaisIdentificadas.length} Agendamentos)`
                  : 'Salvar Agendamento'}
              </span>
            </button>
          </div>
        </form>

        {/* Quick Add Modals */}
        <CadastroModal
          type="fornecedor"
          isOpen={quickFornecedorOpen}
          onClose={() => setQuickFornecedorOpen(false)}
          onSave={handleQuickCreateFornecedor}
        />

        <CadastroModal
          type="transportadora"
          isOpen={quickTransportadoraOpen}
          onClose={() => setQuickTransportadoraOpen(false)}
          onSave={handleQuickCreateTransportadora}
        />

        {importarExcelOpen && agendamento && (
          <ImportarExcelProdutosModal
            agendamento={agendamento}
            onClose={() => setImportarExcelOpen(false)}
            onSuccess={() => {
              setImportarExcelOpen(false);
            }}
          />
        )}

        {produtosRecebidosOpen && agendamento && (
          <ProdutosRecebidosModal
            agendamento={agendamento}
            onClose={() => setProdutosRecebidosOpen(false)}
            onSuccess={() => {
              setProdutosRecebidosOpen(false);
            }}
          />
        )}
      </div>
    </div>
  );
};
