import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  FileText,
  Truck,
  Layers,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  Edit2,
  MapPin,
  Package,
  Mail,
  Copy,
  Check,
  Trash2,
  FileCode2,
  Eye,
  Upload,
  Lock,
  CalendarClock,
  Activity,
  AlertCircle,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { Agendamento, AgendamentoStatus, RecebimentoProduto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { isUserLogistica, isUserGestor, canUserUploadXmlAgendamento } from '../../lib/permissions';
import { VisualizarXmlNotaModal } from './VisualizarXmlNotaModal';
import { ProdutosRecebidosModal } from './ProdutosRecebidosModal';
import { agendamentosService } from '../../services/agendamentosService';
import { alocacaoService } from '../../services/alocacaoService';

interface AgendamentoDetailsModalProps {
  agendamento: Agendamento;
  onClose: () => void;
  onEdit: (ag: Agendamento) => void;
  onDelete?: (ag: Agendamento) => void;
  onStatusChange: (id: string, status: AgendamentoStatus) => Promise<void>;
}

type TabType = 'nota_fiscal' | 'status' | 'email';

function isDeliveryToday(dataPrevista?: string): boolean {
  if (!dataPrevista) return false;
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  return dataPrevista.trim() === todayStr;
}

export function getSaudacaoBrasilia(): string {
  try {
    const horaStr = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      hour12: false,
    }).format(new Date());
    const hora = parseInt(horaStr, 10);
    return hora < 12 ? 'Bom dia,' : 'Boa tarde,';
  } catch {
    const hora = new Date().getHours();
    return hora < 12 ? 'Bom dia,' : 'Boa tarde,';
  }
}

export function formatarDataDDMMAAAA(dataPrevista?: string | null): string {
  if (!dataPrevista || !dataPrevista.trim()) return 'DD/MM/AAAA';
  const clean = dataPrevista.trim().split('T')[0];
  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length >= 3) {
      const ano = parts[0].padStart(4, '2000');
      const mes = parts[1].padStart(2, '0');
      const dia = parts[2].padStart(2, '0');
      return `${dia}/${mes}/${ano}`;
    }
  } else if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length >= 3) {
      const dia = parts[0].padStart(2, '0');
      const mes = parts[1].padStart(2, '0');
      const ano = parts[2].padStart(4, '2000');
      return `${dia}/${mes}/${ano}`;
    }
  }
  return clean;
}

export function formatarHoraHHmm(horario?: string | null): string {
  if (!horario || !horario.trim()) return 'HH:mm';
  const clean = horario.trim();
  if (clean.includes(':')) {
    const [h, m] = clean.split(':');
    return `${h.trim().padStart(2, '0')}:${(m?.trim() || '00').padStart(2, '0').slice(0, 2)}`;
  } else if (clean.toLowerCase().includes('h')) {
    const [h, m] = clean.toLowerCase().split('h');
    return `${h.trim().padStart(2, '0')}:${(m?.trim() || '00').padStart(2, '0').slice(0, 2)}`;
  }
  return clean;
}

export function formatCopyEmailText(dataPrevista?: string | null, horario?: string | null): string {
  const saudacao = getSaudacaoBrasilia();
  const data = formatarDataDDMMAAAA(dataPrevista);
  const hora = formatarHoraHHmm(horario);

  return `${saudacao}

Segue o horário e a data agendados para recebimento:

Data: ${data}
Hora: ${hora}

Atenção: Orientar o motorista a não realizar a descarga do material antes do horário agendado e sem a autorização da equipe de Logística.

Para garantir a organização do nosso fluxo de recebimento, solicitamos que a entrega seja realizada dentro do horário previamente agendado. Entregas fora do horário combinado poderão não ser recebidas imediatamente, devido à programação de outros agendamentos.

Importante: caso ocorra algum imprevisto que impeça o cumprimento da data agendada, será necessário solicitar um novo agendamento previamente.

Agradecemos a compreensão e a colaboração.`;
}

export function formatCopyEmailHtml(dataPrevista?: string | null, horario?: string | null): string {
  const saudacao = getSaudacaoBrasilia();
  const data = formatarDataDDMMAAAA(dataPrevista);
  const hora = formatarHoraHHmm(horario);

  return `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; font-size: 14px; color: #1e293b; line-height: 1.5;">
  <p style="margin: 0 0 16px 0;">${saudacao}</p>
  <p style="margin: 0 0 16px 0;">Segue o horário e a data agendados para recebimento:</p>
  <p style="margin: 0 0 16px 0;">
    <strong>Data:</strong> ${data}<br>
    <strong>Hora:</strong> ${hora}
  </p>
  <p style="margin: 0 0 16px 0;">
    <strong>Atenção:</strong> Orientar o motorista a não realizar a descarga do material antes do horário agendado e sem a autorização da equipe de Logística.
  </p>
  <div style="font-size: 11px; color: #555555; line-height: 1.4;">
    <p style="margin: 0 0 12px 0;">Para garantir a organização do nosso fluxo de recebimento, solicitamos que a entrega seja realizada dentro do horário previamente agendado. Entregas fora do horário combinado poderão não ser recebidas imediatamente, devido à programação de outros agendamentos.</p>
    <p style="margin: 0 0 12px 0;">Importante: caso ocorra algum imprevisto que impeça o cumprimento da data agendada, será necessário solicitar um novo agendamento previamente.</p>
    <p style="margin: 0;">Agradecemos a compreensão e a colaboração.</p>
  </div>
</body>
</html>`;
}

export async function copiarEmailAgendamento(dataPrevista?: string | null, horario?: string | null): Promise<boolean> {
  const plainText = formatCopyEmailText(dataPrevista, horario);
  const htmlText = formatCopyEmailHtml(dataPrevista, horario);

  try {
    if (typeof ClipboardItem !== 'undefined' && navigator?.clipboard?.write) {
      const textBlob = new Blob([plainText], { type: 'text/plain' });
      const htmlBlob = new Blob([htmlText], { type: 'text/html' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': textBlob,
          'text/html': htmlBlob,
        }),
      ]);
      return true;
    }
  } catch (err) {
    console.warn('ClipboardItem rich copy falhou, tentando fallback writeText:', err);
  }

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(plainText);
      return true;
    }
  } catch (err) {
    console.warn('writeText falhou, usando textarea fallback:', err);
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = plainText;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  } catch (err) {
    console.error('Falha ao copiar:', err);
    return false;
  }
}

export const AgendamentoDetailsModal: React.FC<AgendamentoDetailsModalProps> = ({
  agendamento,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
}) => {
  const { user } = useAuth();
  const isGestor = isUserGestor(user);
  const isLogistica = isUserLogistica(user);
  const podeSubirXml = canUserUploadXmlAgendamento(user);
  const podeVerDetalhesECopiarEmail = isLogistica || isGestor || podeSubirXml;

  if (!podeVerDetalhesECopiarEmail) {
    return null;
  }

  // Abas do Modal: NOTA FISCAL, STATUS, EMAIL
  const [activeTab, setActiveTab] = useState<TabType>('nota_fiscal');

  // Estados locais
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [copied, setCopied] = useState(false);
  const [xmlState, setXmlState] = useState<string | null>(agendamento.xml_nota || null);
  const [isXmlModalOpen, setIsXmlModalOpen] = useState(false);
  const [xmlUploading, setXmlUploading] = useState(false);
  const [isProdutosGerenciarModalOpen, setIsProdutosGerenciarModalOpen] = useState(false);

  // Estado da Chave da NF para inserção e edição
  const [chaveNfInput, setChaveNfInput] = useState<string>(agendamento.chave_nf || '');
  const [salvandoChave, setSalvandoChave] = useState(false);
  const [chaveSalvaFeedback, setChaveSalvaFeedback] = useState(false);

  useEffect(() => {
    setChaveNfInput(agendamento.chave_nf || '');
  }, [agendamento.id, agendamento.chave_nf]);

  const handleSalvarChaveNf = async () => {
    setSalvandoChave(true);
    try {
      const valorLimpo = chaveNfInput.trim() || null;
      await agendamentosService.update(agendamento.id, { chave_nf: valorLimpo });
      agendamento.chave_nf = valorLimpo;
      setChaveSalvaFeedback(true);
      setTimeout(() => setChaveSalvaFeedback(false), 3000);
      if (onStatusChange) {
        await onStatusChange(agendamento.id, agendamento.status);
      }
    } catch (err) {
      console.error('Erro ao salvar chave da NF:', err);
    } finally {
      setSalvandoChave(false);
    }
  };

  // Lazy loading dos produtos recebidos da NF na aba STATUS
  const [produtosRecebidos, setProdutosRecebidos] = useState<RecebimentoProduto[] | null>(null);
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  const [produtosCarregados, setProdutosCarregados] = useState(false);

  // Carregar produtos sob demanda apenas quando a aba STATUS for aberta pela primeira vez
  const carregarProdutos = useCallback(async () => {
    if (produtosCarregados || loadingProdutos) return;
    try {
      setLoadingProdutos(true);
      const nfAtual = agendamento.nota_fiscal || '';
      const lista = await alocacaoService.listarProdutosRecebidosPorAgendamento(agendamento.id, nfAtual);
      setProdutosRecebidos(lista);
      setProdutosCarregados(true);
    } catch (err) {
      console.warn('Erro ao carregar produtos do agendamento:', err);
      setProdutosRecebidos([]);
      setProdutosCarregados(true);
    } finally {
      setLoadingProdutos(false);
    }
  }, [agendamento.id, agendamento.nota_fiscal, produtosCarregados, loadingProdutos]);

  useEffect(() => {
    if (activeTab === 'status' && !produtosCarregados) {
      carregarProdutos();
    }
  }, [activeTab, produtosCarregados, carregarProdutos]);

  const handleUploadXmlDireto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setXmlUploading(true);
    try {
      const text = await file.text();
      await agendamentosService.salvarXmlNota(agendamento.id, text);
      setXmlState(text);
      agendamento.xml_nota = text;
      if (onStatusChange) {
        onStatusChange(agendamento.id, agendamento.status);
      }
    } catch (err) {
      console.error('Erro ao salvar XML:', err);
    } finally {
      setXmlUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoverXmlDireto = async () => {
    if (!confirm('Deseja realmente remover o arquivo XML desta nota?')) return;
    try {
      await agendamentosService.removerXmlNota(agendamento.id);
      setXmlState(null);
      agendamento.xml_nota = null;
      if (onStatusChange) {
        onStatusChange(agendamento.id, agendamento.status);
      }
    } catch (err) {
      console.error('Erro ao remover XML:', err);
    }
  };

  const emailCopyText = formatCopyEmailText(agendamento.data_prevista, agendamento.horario);

  const handleCopy = async () => {
    try {
      const ok = await copiarEmailAgendamento(agendamento.data_prevista, agendamento.horario);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (err) {
      console.warn('Erro ao copiar texto:', err);
    }
  };

  const getStatusColor = (st: AgendamentoStatus) => {
    switch (st) {
      case 'Recebido':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'Confirmado':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'Em trânsito':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      case 'Pendente':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'Cancelado':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  const handleQuickStatus = async (newStatus: AgendamentoStatus) => {
    setUpdatingStatus(true);
    try {
      await onStatusChange(agendamento.id, newStatus);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Status permitidos na alteração rápida existente
  const STATUS_OPCOES: AgendamentoStatus[] = ['Pendente', 'Recebido', 'Cancelado'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col max-h-[92vh] text-slate-100 my-auto overflow-hidden animate-in fade-in duration-200">
        
        {/* Header fixo */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-800 shrink-0 bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getStatusColor(agendamento.status)}`}>
                  {agendamento.status}
                </span>
                <span className="text-xs text-slate-400 font-mono">ID: #{agendamento.id.slice(0, 8)}</span>
                {isDeliveryToday(agendamento.data_prevista) && (
                  <span className="bg-amber-400 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-full shadow-xs">
                    Hoje
                  </span>
                )}
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-snug truncate">
                {agendamento.fornecedor}
              </h3>
            </div>
            <button
              type="button"
              id="btn-close-details"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition min-h-[40px] min-w-[40px] flex items-center justify-center shrink-0 cursor-pointer"
              title="Fechar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Abas [ NOTA FISCAL ] [ STATUS ] [ EMAIL ] */}
          <div className="flex items-center gap-1.5 mt-4 pt-1 border-t border-slate-800/80 overflow-x-auto no-scrollbar">
            <button
              type="button"
              id="tab-btn-nota-fiscal"
              onClick={() => setActiveTab('nota_fiscal')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap min-h-[38px] cursor-pointer ${
                activeTab === 'nota_fiscal'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400/40'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>NOTA FISCAL</span>
            </button>

            <button
              type="button"
              id="tab-btn-status"
              onClick={() => setActiveTab('status')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap min-h-[38px] cursor-pointer ${
                activeTab === 'status'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400/40'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Activity className="w-4 h-4 shrink-0" />
              <span>STATUS</span>
            </button>

            <button
              type="button"
              id="tab-btn-email"
              onClick={() => setActiveTab('email')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap min-h-[38px] cursor-pointer ${
                activeTab === 'email'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400/40'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Mail className="w-4 h-4 shrink-0" />
              <span>EMAIL</span>
            </button>
          </div>
        </div>

        {/* Conteúdo com rolagem interna */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">

          {/* ============================================================ */}
          {/* ABA 1 — NOTA FISCAL                                          */}
          {/* ============================================================ */}
          {activeTab === 'nota_fiscal' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              
              {/* NF e Volumes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Nota Fiscal (NF)
                  </span>
                  <div className="font-mono font-bold text-base sm:text-lg text-sky-400 flex items-center gap-2">
                    <FileText className="w-4 h-4 shrink-0 text-sky-500" />
                    <span>{agendamento.nota_fiscal}</span>
                  </div>
                  {agendamento.notas_adicionais && (
                    <div className="text-xs text-slate-400 mt-1.5 font-mono bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Notas Adicionais:</span>
                      {agendamento.notas_adicionais}
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Volumes & Embalagem
                  </span>
                  <div className="font-bold text-base sm:text-lg text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 shrink-0 text-blue-400" />
                    <span>
                      {agendamento.volumes} {agendamento.tipo_volumes}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1.5">
                    Fornecedor: <strong className="text-slate-200">{agendamento.fornecedor}</strong>
                  </div>
                </div>
              </div>

              {/* Transportadora e Doca/Endereço */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Transportadora
                    </span>
                    <span className="text-sm font-semibold text-white truncate block">{agendamento.transportadora}</span>
                  </div>
                </div>

                <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Endereço / Doca
                    </span>
                    {agendamento.endereco_alocacao ? (
                      <span className="text-sm font-mono font-bold text-sky-300 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/40 inline-block">
                        {agendamento.endereco_alocacao}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 italic">Não vinculado</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Datas e Horários */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {/* Data Prevista */}
                <div
                  className={`border rounded-2xl p-3.5 transition ${
                    isDeliveryToday(agendamento.data_prevista)
                      ? 'bg-amber-500/15 border-amber-500/50 shadow-md shadow-amber-500/10 ring-1 ring-amber-500/30'
                      : 'bg-slate-950/40 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
                      {isDeliveryToday(agendamento.data_prevista) ? (
                        <CalendarClock className="w-4 h-4 text-amber-400 animate-pulse" />
                      ) : (
                        <Calendar className="w-4 h-4 text-sky-400" />
                      )}
                      <span className={isDeliveryToday(agendamento.data_prevista) ? 'text-amber-300 font-bold' : ''}>
                        Data Prevista
                      </span>
                    </div>
                  </div>
                  <div
                    className={`font-mono font-bold text-sm ${
                      isDeliveryToday(agendamento.data_prevista) ? 'text-amber-300' : 'text-white'
                    }`}
                  >
                    {agendamento.data_prevista
                      ? new Date(agendamento.data_prevista + 'T00:00:00').toLocaleDateString('pt-BR')
                      : 'A definir'}
                  </div>
                </div>

                {/* Horário Agendado */}
                <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-3.5">
                  <div className="flex items-center gap-1.5 text-slate-400 font-semibold mb-1">
                    <Clock className="w-4 h-4 text-sky-400" />
                    <span>Horário Agendado</span>
                  </div>
                  <div className="font-mono font-bold text-sm text-white">
                    {agendamento.horario ? (
                      <span className="text-sky-300 font-bold">{agendamento.horario}</span>
                    ) : (
                      <span className="text-slate-500 font-normal italic">Não informado</span>
                    )}
                  </div>
                </div>

                {/* Data de Entrega */}
                <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-3.5">
                  <div className="flex items-center gap-1.5 text-slate-400 font-semibold mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Data de Entrega</span>
                  </div>
                  <div className="font-mono font-bold text-sm text-white">
                    {agendamento.data_entrega
                      ? new Date(agendamento.data_entrega + 'T00:00:00').toLocaleDateString('pt-BR')
                      : '—'}
                  </div>
                </div>
              </div>

              {/* Data & Usuário de Inserção (Auditoria) */}
              <div className="bg-slate-950/40 rounded-2xl p-3.5 border border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>
                    Usuário de inserção:{' '}
                    <strong className="text-slate-200 font-mono">{agendamento.usuario_insercao}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>
                    Data de inserção:{' '}
                    <strong className="text-slate-300 font-mono">
                      {new Date(agendamento.data_insercao).toLocaleString('pt-BR')}
                    </strong>
                  </span>
                </div>
              </div>

              {/* ÁREA DO XML DA NOTA FISCAL (Visualmente separada dos demais dados) */}
              <div className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/20 border border-emerald-900/40 p-4 sm:p-5 space-y-3.5 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <FileCode2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>Espelho da NF (XML)</span>
                        {xmlState ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold">
                            XML Anexado
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                            Disponível para inserção
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-400">
                        Insira ou anexe o arquivo XML para conferência de produtos e faturamento
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 w-fit">
                    <Lock className="w-3 h-3 text-amber-400" />
                    Preços e valores sob sigilo
                  </span>
                </div>

                {/* Bloco de Ações do XML */}
                {xmlState ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/90 border border-emerald-500/30">
                    <div className="text-xs text-slate-300">
                      <p className="font-semibold text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Arquivo XML pronto para conferência
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Tamanho aproximado: {(xmlState.length / 1024).toFixed(1)} KB
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        id="btn-ver-xml-detalhes"
                        onClick={() => setIsXmlModalOpen(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition min-h-[38px] cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Visualizar XML</span>
                      </button>

                      {podeSubirXml && (
                        <>
                          <label
                            htmlFor="input-trocar-xml-detalhes"
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition min-h-[38px]"
                            title="Substituir arquivo XML existente"
                          >
                            <Upload className="w-3.5 h-3.5 text-sky-400" />
                            <span>Substituir</span>
                            <input
                              id="input-trocar-xml-detalhes"
                              type="file"
                              accept=".xml,text/xml,application/xml"
                              onChange={handleUploadXmlDireto}
                              disabled={xmlUploading}
                              className="hidden"
                            />
                          </label>
                          <button
                            type="button"
                            id="btn-remover-xml-detalhes"
                            onClick={handleRemoverXmlDireto}
                            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                            title="Remover arquivo XML"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div className="text-xs text-slate-400">
                      <p className="font-semibold text-slate-300">Nenhum arquivo XML anexado a esta nota.</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {podeSubirXml
                          ? 'O XML da NF pode ser inserido agora para habilitar conferência.'
                          : 'Apenas usuários com perfil Gestor ou Assistente podem anexar o arquivo XML.'}
                      </p>
                    </div>

                    {podeSubirXml && (
                      <label
                        htmlFor="input-upload-xml-detalhes"
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer transition shadow-sm min-h-[38px] shrink-0"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{xmlUploading ? 'Carregando...' : 'Selecionar / Enviar XML'}</span>
                        <input
                          id="input-upload-xml-detalhes"
                          type="file"
                          accept=".xml,text/xml,application/xml"
                          onChange={handleUploadXmlDireto}
                          disabled={xmlUploading}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ============================================================ */}
          {/* ABA 2 — STATUS                                               */}
          {/* ============================================================ */}
          {activeTab === 'status' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              
              {/* Seção 1: Alteração Rápida de Status */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-400" />
                      <span>Alteração Rápida de Status</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isGestor
                        ? 'Selecione o novo status para atualizar o andamento do agendamento'
                        : 'Disponível exclusivamente para usuários com nível Gestor'}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getStatusColor(agendamento.status)}`}>
                    Status Atual: {agendamento.status}
                  </span>
                </div>

                {isGestor ? (
                  <div className="grid grid-cols-3 gap-2.5 pt-1">
                    {STATUS_OPCOES.map((st) => {
                      const isCurrent = agendamento.status === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          id={`btn-quick-status-${st.toLowerCase()}`}
                          disabled={updatingStatus || isCurrent}
                          onClick={() => handleQuickStatus(st)}
                          className={`px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition active:scale-95 min-h-[44px] cursor-pointer disabled:cursor-not-allowed ${
                            isCurrent
                              ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/30 ring-2 ring-blue-400/40'
                              : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          {updatingStatus && !isCurrent ? (
                            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                          ) : (
                            st
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Seu perfil de acesso não possui permissão para alterar o status deste agendamento.</span>
                  </div>
                )}
              </div>

              {/* Seção: Chave da NF (imediatamente abaixo do bloco Alteração do status) */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>Chave da NF</span>
                        {agendamento.chave_nf && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold">
                            Chave Registrada
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-400">
                        Insira ou edite a chave de acesso da nota fiscal (44 dígitos numéricos)
                      </p>
                    </div>
                  </div>

                  {chaveSalvaFeedback && (
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/30 animate-in fade-in">
                      <Check className="w-3.5 h-3.5" />
                      Chave salva com sucesso!
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      id="input-chave-nf-detalhes"
                      value={chaveNfInput}
                      onChange={(e) => setChaveNfInput(e.target.value)}
                      placeholder="Ex: 52240100000000000000550010000000001000000000"
                      maxLength={60}
                      disabled={salvandoChave}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 font-mono focus:outline-hidden focus:border-sky-500 transition min-h-[42px]"
                    />
                    {chaveNfInput.trim() && (
                      <span className="absolute right-3 top-2.5 text-[11px] font-mono text-slate-400 select-none">
                        {chaveNfInput.replace(/\D/g, '').length} dígitos
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    id="btn-salvar-chave-nf"
                    onClick={handleSalvarChaveNf}
                    disabled={salvandoChave || chaveNfInput.trim() === (agendamento.chave_nf || '').trim()}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold transition min-h-[42px] shrink-0 cursor-pointer shadow-sm"
                  >
                    {salvandoChave ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Salvar chave</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Seção 2: Produtos recebidos da NF */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>Produtos recebidos da NF</span>
                        {produtosRecebidos && produtosRecebidos.length > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 font-semibold">
                            {produtosRecebidos.length} {produtosRecebidos.length === 1 ? 'item' : 'itens'}
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-400">
                        Itens físicos vinculados à Nota Fiscal #{agendamento.nota_fiscal}
                      </p>
                    </div>
                  </div>

                  {/* Ação para abrir modal completo de gerenciamento se o usuário desejar cadastrar/editar */}
                  {isGestor && (
                    <button
                      type="button"
                      id="btn-abrir-gerenciamento-produtos"
                      onClick={() => setIsProdutosGerenciarModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 border border-slate-700 text-xs font-semibold transition min-h-[36px] cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Gerenciar Itens Físicos</span>
                    </button>
                  )}
                </div>

                {/* Listagem dos Produtos Recebidos */}
                {loadingProdutos ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                    <span className="text-xs">Carregando produtos da nota fiscal...</span>
                  </div>
                ) : produtosRecebidos && produtosRecebidos.length > 0 ? (
                  <div className="rounded-xl border border-slate-800 overflow-hidden">
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/80 bg-slate-900/60">
                      {produtosRecebidos.map((prod) => (
                        <div
                          key={prod.id}
                          className="p-3 flex items-center justify-between gap-3 hover:bg-slate-800/40 transition text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-white block truncate">{prod.produto}</span>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                              <span>Status: <strong className="text-slate-300">{prod.status}</strong></span>
                              {prod.endereco && (
                                <span className="font-mono text-sky-400 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/40">
                                  {prod.endereco}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono font-bold text-white block text-sm">
                              {prod.quantidade} un
                            </span>
                            {prod.saldo_final !== undefined && prod.saldo_final !== prod.quantidade && (
                              <span className="text-[10px] text-slate-400 block">
                                Saldo: {prod.saldo_final} un
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
                    <p className="text-xs text-slate-400">
                      Nenhum produto cadastrado para esta Nota Fiscal até o momento.
                    </p>
                    {isGestor && (
                      <button
                        type="button"
                        onClick={() => setIsProdutosGerenciarModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer"
                      >
                        <Package className="w-3.5 h-3.5" />
                        <span>Cadastrar Produtos Recebidos</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ============================================================ */}
          {/* ABA 3 — EMAIL                                                */}
          {/* ============================================================ */}
          {activeTab === 'email' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950/30 border border-sky-800/40 rounded-2xl p-4 sm:p-5 space-y-4 shadow-md">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-sky-300">
                        Copiar e-mail
                      </h4>
                      <p className="text-xs text-slate-400">
                        Texto de comunicação com data e horário agendados
                      </p>
                    </div>
                  </div>

                  {/* Botão Copiar e-mail com feedback visual */}
                  <button
                    type="button"
                    id="btn-copy-email-confirmation"
                    onClick={handleCopy}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-bold transition shadow-md shadow-sky-950/40 active:scale-95 min-h-[40px] cursor-pointer"
                    title="Copiar e-mail para a área de transferência"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-300" />
                        <span className="text-emerald-200">E-mail Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-white" />
                        <span>Copiar e-mail</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Conteúdo formatado com negrito e parágrafos finais em fonte menor */}
                <div
                  id="box-email-copy-text"
                  className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 font-sans text-xs sm:text-sm text-slate-200 leading-relaxed shadow-inner space-y-3"
                >
                  <p>{getSaudacaoBrasilia()}</p>
                  <p>Segue o horário e a data agendados para recebimento:</p>
                  <div className="space-y-0.5">
                    <p><strong>Data:</strong> {formatarDataDDMMAAAA(agendamento.data_prevista)}</p>
                    <p><strong>Hora:</strong> {formatarHoraHHmm(agendamento.horario)}</p>
                  </div>
                  <p>
                    <strong>Atenção:</strong> Orientar o motorista a não realizar a descarga do material antes do horário agendado e sem a autorização da equipe de Logística.
                  </p>
                  <div className="text-[11px] text-slate-400 space-y-2 pt-2 border-t border-slate-800/60 leading-normal">
                    <p>
                      Para garantir a organização do nosso fluxo de recebimento, solicitamos que a entrega seja realizada dentro do horário previamente agendado. Entregas fora do horário combinado poderão não ser recebidas imediatamente, devido à programação de outros agendamentos.
                    </p>
                    <p>
                      Importante: caso ocorra algum imprevisto que impeça o cumprimento da data agendada, será necessário solicitar um novo agendamento previamente.
                    </p>
                    <p>
                      Agradecemos a compreensão e a colaboração.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <AlertCircle className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>
                    Os campos de Data e Horário foram preenchidos automaticamente com base no agendamento selecionado.
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer fixo */}
        <div className="p-4 sm:p-5 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-slate-900">
          {isGestor ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-edit-agendamento-from-details"
                onClick={() => {
                  onClose();
                  onEdit(agendamento);
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold transition min-h-[42px] cursor-pointer"
              >
                <Edit2 className="w-4 h-4" />
                <span>Editar Agendamento</span>
              </button>

              {onDelete && (
                <button
                  type="button"
                  id="btn-delete-agendamento-from-details"
                  onClick={() => {
                    onClose();
                    onDelete(agendamento);
                  }}
                  className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs sm:text-sm font-semibold transition min-h-[42px] cursor-pointer"
                  title="Excluir agendamento"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span className="hidden sm:inline">Excluir</span>
                </button>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400">
              Modo visualização de detalhes
            </div>
          )}

          <button
            type="button"
            id="btn-close-details-bottom"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold transition min-h-[42px] cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Modal de Gerenciamento de Produtos Recebidos (se acionado pelo Gestor) */}
      {isProdutosGerenciarModalOpen && (
        <ProdutosRecebidosModal
          agendamento={agendamento}
          onClose={() => setIsProdutosGerenciarModalOpen(false)}
          onSuccess={() => {
            setIsProdutosGerenciarModalOpen(false);
            // Recarrega lista local de produtos
            setProdutosCarregados(false);
            carregarProdutos();
          }}
        />
      )}

      {/* Modal de Visualização Formatada do XML da Nota */}
      {isXmlModalOpen && xmlState && (
        <VisualizarXmlNotaModal
          xml={xmlState}
          agendamento={agendamento}
          onClose={() => setIsXmlModalOpen(false)}
          onSubstituirXml={
            podeSubirXml
              ? async (novoXml: string) => {
                  await agendamentosService.salvarXmlNota(agendamento.id, novoXml);
                  setXmlState(novoXml);
                  agendamento.xml_nota = novoXml;
                }
              : undefined
          }
          onRemoverXml={
            podeSubirXml
              ? async () => {
                  await handleRemoverXmlDireto();
                  setIsXmlModalOpen(false);
                }
              : undefined
          }
        />
      )}
    </div>
  );
};
