import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  CalendarClock,
  Calendar,
  Search,
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  Edit2,
  CheckCircle2,
  Clock,
  Truck,
  FileText,
  Layers,
  RefreshCw,
  X,
  AlertCircle,
  Inbox,
  MapPin,
  Database,
  Trash2,
  FileCode2,
  Mail,
  XCircle,
  Upload,
  Copy,
  Check,
} from 'lucide-react';
import { Agendamento, AgendamentoStatus, Usuario } from '../../types';
import { agendamentosService, AgendamentoFilters, sortAgendamentosList } from '../../services/agendamentosService';
import { usuariosService } from '../../services/usuariosService';
import { badgesService } from '../../services/badgesService';
import { useAuth } from '../../context/AuthContext';
import { isUserGestor, isUserLogistica, isUserAssistente, canUserUploadXmlAgendamento } from '../../lib/permissions';
import { AgendamentoModal } from './AgendamentoModal';
import { AgendamentoDetailsModal, formatCopyEmailText, copiarEmailAgendamento, getSaudacaoBrasilia } from './AgendamentoDetailsModal';
import { VisualizarXmlNotaModal } from './VisualizarXmlNotaModal';

export type TabAgendamento = 'Pendentes' | 'Recebidos' | 'Cancelados';

interface AgendamentosModuleProps {
  initialOpenModal?: boolean;
  onResetInitialOpenModal?: () => void;
}

function parseLocalDate(dateStr?: string | null): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return {
      year: parseInt(match[1], 10),
      month: parseInt(match[2], 10),
      day: parseInt(match[3], 10),
    };
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  };
}

function formatarDataAgendada(dateStr?: string | null): string {
  const parsed = parseLocalDate(dateStr);
  if (!parsed) return '-';
  const dia = String(parsed.day).padStart(2, '0');
  const mes = String(parsed.month).padStart(2, '0');
  return `${dia}/${mes}/${parsed.year}`;
}

/**
 * Calcula a diferença em dias entre a data alvo e o dia atual considerando o calendário local:
 * > 0: data futura (dentro do prazo)
 * 0: hoje
 * < 0: atrasado (-1 significa que ultrapassou pelo menos um dia)
 */
function getDiasDiferencaHoje(dateStr?: string | null): number | null {
  const parsed = parseLocalDate(dateStr);
  if (!parsed) return null;
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetMidnight = new Date(parsed.year, parsed.month - 1, parsed.day).getTime();
  return Math.round((targetMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
}

function getDataAgendadaBadgeConfig(ag: Agendamento) {
  const diffPrevista = getDiasDiferencaHoje(ag.data_prevista);
  const diffEntrega = ag.data_entrega ? getDiasDiferencaHoje(ag.data_entrega) : null;

  // 1. Recebimento previsto para hoje (prioridade máxima, independente do status)
  const isHoje = diffPrevista === 0 || (ag.status === 'Recebido' && diffEntrega === 0);
  if (isHoje) {
    return {
      classes: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs shadow-emerald-500/10',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
      tag: (
        <span className="bg-emerald-400 text-slate-950 text-[10px] font-black uppercase px-1.5 py-0.5 rounded leading-none ml-1">
          Hoje
        </span>
      ),
      tooltip: 'Recebimento previsto para hoje',
    };
  }

  // 2 e 3: Agendamentos com status 'Pendente'
  if (ag.status === 'Pendente') {
    // 3. Atrasado há mais de um dia (data prevista ultrapassou pelo menos um dia: diffPrevista <= -1)
    if (diffPrevista !== null && diffPrevista <= -1) {
      const diasAtraso = Math.abs(diffPrevista);
      return {
        classes: 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-xs shadow-rose-500/10',
        icon: <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
        tag: (
          <span className="bg-rose-500/30 text-rose-200 border border-rose-500/40 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded leading-none ml-1">
            {diasAtraso === 1 ? 'Atrasado (1 dia)' : `Atrasado (${diasAtraso}d)`}
          </span>
        ),
        tooltip: `Agendamento pendente atrasado há ${diasAtraso} dia(s)`,
      };
    }

    // 2. Agendamento dentro do prazo, com status Pendente: badge laranja (diffPrevista > 0)
    return {
      classes: 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs shadow-amber-500/10',
      icon: <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
      tag: null,
      tooltip: 'Agendamento pendente dentro do prazo',
    };
  }

  // 4. Demais situações: manter apresentação visual coerente com o tema atual
  switch (ag.status) {
    case 'Recebido':
      return {
        classes: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
        tag: null,
        tooltip: 'Recebimento concluído',
      };
    case 'Confirmado':
      return {
        classes: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
        icon: <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />,
        tag: null,
        tooltip: 'Agendamento confirmado',
      };
    case 'Em trânsito':
      return {
        classes: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
        icon: <Truck className="w-3.5 h-3.5 text-sky-400 shrink-0" />,
        tag: null,
        tooltip: 'Carga em trânsito',
      };
    case 'Cancelado':
      return {
        classes: 'bg-rose-500/15 text-rose-300/80 border-rose-500/30 opacity-75',
        icon: <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
        tag: null,
        tooltip: 'Agendamento cancelado',
      };
    default:
      return {
        classes: 'bg-slate-800 text-slate-300 border-slate-700',
        icon: <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />,
        tag: null,
        tooltip: 'Data agendada',
      };
  }
}

function isToday(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  return dateStr.trim().slice(0, 10) === todayStr;
}

function isDeliveryToday(dataPrevista?: string): boolean {
  return isToday(dataPrevista);
}

function isReceivedToday(ag: Agendamento): boolean {
  if (ag.status !== 'Recebido') return false;
  return isToday(ag.data_entrega) || (!ag.data_entrega && isToday(ag.data_prevista));
}

function formatarDataInsercao(dataStr?: string | null): string {
  if (!dataStr) return '-';
  try {
    const d = new Date(dataStr);
    if (isNaN(d.getTime())) return '-';
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    return `${dia}/${mes}/${ano}`;
  } catch {
    return '-';
  }
}

/**
 * Formata o subtítulo da coluna Fornecedor conforme especificação:
 * DD/MM POR USUARIO NOME + SOBRENOME
 * Exemplo: 23/09 POR LUIZ FERNANDO
 */
function formatarSubtituloLancamento(
  ag: Agendamento,
  usuariosMap: Record<string, Usuario>,
  currentUser?: Usuario | null
): string {
  // 1. Data e Mês (DD/MM) do lançamento
  let diaMes = '01/01';
  const dataRef = ag.data_insercao || ag.data || ag.data_prevista || new Date().toISOString();
  try {
    const match = dataRef.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      diaMes = `${match[3]}/${match[2]}`;
    } else {
      const d = new Date(dataRef);
      if (!isNaN(d.getTime())) {
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        diaMes = `${dia}/${mes}`;
      }
    }
  } catch {
    diaMes = '01/01';
  }

  // 2. Resolver o usuário responsável pelo lançamento (nome + sobrenome)
  let nomeBruto = '';
  if (ag.usuario_id && usuariosMap[ag.usuario_id]?.nome) {
    nomeBruto = usuariosMap[ag.usuario_id].nome;
  } else if (ag.usuario_insercao) {
    const raw = ag.usuario_insercao.trim();
    if (usuariosMap[raw]?.nome) {
      nomeBruto = usuariosMap[raw].nome;
    } else if (usuariosMap[raw.toUpperCase()]?.nome) {
      nomeBruto = usuariosMap[raw.toUpperCase()].nome;
    } else {
      const byCode = Object.values(usuariosMap).find(
        (u) => u.codigo?.toUpperCase() === raw.toUpperCase() || u.id === raw
      );
      if (byCode?.nome) {
        nomeBruto = byCode.nome;
      } else if (raw.toUpperCase().startsWith('OP-') || raw.toUpperCase().startsWith('USR-')) {
        nomeBruto = currentUser?.nome || 'Luiz Fernando';
      } else {
        nomeBruto = raw;
      }
    }
  }

  if (!nomeBruto) {
    nomeBruto = currentUser?.nome || 'Luiz Fernando';
  }

  // Limpa eventuais sufixos de parênteses como "(Gestora)"
  const nomeLimpo = nomeBruto.replace(/\s*\([^)]*\)/g, '').trim();
  const partes = nomeLimpo.split(/\s+/).filter(Boolean);
  let nomeSobrenome = nomeLimpo;
  if (partes.length >= 2) {
    nomeSobrenome = `${partes[0]} ${partes[partes.length - 1]}`;
  }

  return `${diaMes} POR ${nomeSobrenome.toUpperCase()}`;
}

export interface CargaAgrupada {
  id: string;
  dataRef: string;
  fornecedor: string;
  transportadora: string;
  horario?: string | null;
  statusGeral: AgendamentoStatus;
  totalVolumes: number;
  tipoVolumes: string;
  itens: Agendamento[];
  primeiroItem: Agendamento;
}

export interface GrupoDataAgendamento {
  dataRef: string;
  diaSemana: string;
  dataFormatada: string;
  isHoje: boolean;
  totalNfs: number;
  cargas: CargaAgrupada[];
}

function getDiaSemanaEData(dateStr?: string | null): {
  diaSemana: string;
  dataFormatada: string;
  isHoje: boolean;
} {
  if (!dateStr || dateStr === 'Sem data') {
    return { diaSemana: 'Data não informada', dataFormatada: '-', isHoje: false };
  }
  const parsed = parseLocalDate(dateStr);
  if (!parsed) {
    return { diaSemana: 'Data inválida', dataFormatada: dateStr, isHoje: false };
  }

  const d = new Date(parsed.year, parsed.month - 1, parsed.day);
  const dias = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];
  const diaSemana = dias[d.getDay()] || 'Data';

  const dia = String(parsed.day).padStart(2, '0');
  const mes = String(parsed.month).padStart(2, '0');
  const dataFormatada = `${dia}/${mes}/${parsed.year}`;

  const diff = getDiasDiferencaHoje(dateStr);
  const isHoje = diff === 0;

  return { diaSemana, dataFormatada, isHoje };
}

function calcularStatusGeralCarga(itens: Agendamento[]): AgendamentoStatus {
  if (itens.length === 0) return 'Pendente';
  const statuses = itens.map((i) => i.status);
  if (statuses.every((s) => s === statuses[0])) return statuses[0];
  if (statuses.includes('Pendente')) return 'Pendente';
  if (statuses.includes('Em trânsito')) return 'Em trânsito';
  if (statuses.includes('Confirmado')) return 'Confirmado';
  if (statuses.includes('Recebido')) return 'Recebido';
  return 'Cancelado';
}

function agruparAgendamentosPorDataECarga(
  lista: Agendamento[],
  aba: TabAgendamento
): GrupoDataAgendamento[] {
  const gruposMap = new Map<string, Map<string, Agendamento[]>>();

  for (const ag of lista) {
    const dataRef =
      aba === 'Recebidos'
        ? (ag.data_entrega || ag.data_prevista || ag.data || 'Sem data')
        : (ag.data_prevista || ag.data || 'Sem data');

    if (!gruposMap.has(dataRef)) {
      gruposMap.set(dataRef, new Map<string, Agendamento[]>());
    }

    const cargasMap = gruposMap.get(dataRef)!;

    // Chave única da carga dentro da data: Fornecedor + Transportadora + Horário
    const fornKey = (ag.fornecedor || 'FORNECEDOR').trim().toUpperCase();
    const transpKey = (ag.transportadora || 'TRANSPORTADORA').trim().toUpperCase();
    const horaKey = (ag.horario || '').trim();
    const cargaKey = `${fornKey}__${transpKey}__${horaKey}`;

    if (!cargasMap.has(cargaKey)) {
      cargasMap.set(cargaKey, []);
    }
    cargasMap.get(cargaKey)!.push(ag);
  }

  const resultado: GrupoDataAgendamento[] = [];

  for (const [dataRef, cargasMap] of gruposMap.entries()) {
    const { diaSemana, dataFormatada, isHoje } = getDiaSemanaEData(dataRef);
    let totalNfsData = 0;
    const cargas: CargaAgrupada[] = [];

    for (const [cargaKey, itens] of cargasMap.entries()) {
      totalNfsData += itens.length;
      const primeiro = itens[0];
      const totalVolumes = itens.reduce((sum, item) => sum + (Number(item.volumes) || 0), 0);
      const tipoVolumes = primeiro.tipo_volumes || 'Paletes';
      const statusGeral = calcularStatusGeralCarga(itens);

      cargas.push({
        id: `${dataRef}__${cargaKey}`,
        dataRef,
        fornecedor: primeiro.fornecedor,
        transportadora: primeiro.transportadora,
        horario: primeiro.horario,
        statusGeral,
        totalVolumes,
        tipoVolumes,
        itens,
        primeiroItem: primeiro,
      });
    }

    resultado.push({
      dataRef,
      diaSemana,
      dataFormatada,
      isHoje,
      totalNfs: totalNfsData,
      cargas,
    });
  }

  return resultado;
}

export function isDataHojeBrasilia(dataStr?: string | null): boolean {
  if (!dataStr) return false;
  try {
    const hojeBrasilia = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const raw = dataStr.trim().split('T')[0];
    if (raw.includes('-')) {
      const parts = raw.split('-');
      if (parts.length >= 3) {
        const y = parts[0].padStart(4, '2000');
        const m = parts[1].padStart(2, '0');
        const d = parts[2].padStart(2, '0');
        return `${y}-${m}-${d}` === hojeBrasilia;
      }
    } else if (raw.includes('/')) {
      const parts = raw.split('/');
      if (parts.length >= 3) {
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        const y = parts[2].padStart(4, '2000');
        return `${y}-${m}-${d}` === hojeBrasilia;
      }
    }
    return raw === hojeBrasilia;
  } catch {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return (dataStr || '').startsWith(`${y}-${m}-${d}`);
  }
}

export interface ItemNfCarga {
  nota: string;
  chave?: string | null;
}

export function extrairEOrdenarNfsCarga(carga: CargaAgrupada): ItemNfCarga[] {
  const nfsMap = new Map<string, string | null>();

  for (const item of carga.itens) {
    if (item.nota_fiscal && item.nota_fiscal.trim()) {
      const nfTrim = item.nota_fiscal.trim();
      const existingChave = nfsMap.get(nfTrim);
      const chaveTrim = item.chave_nf?.trim() || null;
      if (!existingChave && chaveTrim) {
        nfsMap.set(nfTrim, chaveTrim);
      } else if (!nfsMap.has(nfTrim)) {
        nfsMap.set(nfTrim, chaveTrim);
      }
    }
    if (item.notas_adicionais && item.notas_adicionais.trim()) {
      const extras = item.notas_adicionais
        .split(/[\n,;/]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const extra of extras) {
        if (!nfsMap.has(extra)) {
          nfsMap.set(extra, null);
        }
      }
    }
  }

  const items: ItemNfCarga[] = Array.from(nfsMap.entries()).map(([nota, chave]) => ({
    nota,
    chave,
  }));

  const getNumericVal = (nf: string): number => {
    const digits = nf.replace(/\D/g, '');
    return digits ? parseInt(digits, 10) : 0;
  };

  items.sort((a, b) => {
    const numA = getNumericVal(a.nota);
    const numB = getNumericVal(b.nota);
    if (numA !== numB) {
      return numA - numB;
    }
    return a.nota.localeCompare(b.nota, 'pt-BR');
  });

  return items;
}

export function formatarTextoRevisaoNfs(carga: CargaAgrupada): string {
  const saudacao = getSaudacaoBrasilia();
  const fabricante = carga.fornecedor || carga.primeiroItem.fornecedor || 'Fabricante';
  const nfs = extrairEOrdenarNfsCarga(carga);

  let nfsTexto = '';
  if (nfs.length > 0) {
    nfsTexto = nfs
      .map((item) => (item.chave ? `${item.nota} - ${item.chave}` : item.nota))
      .join('\n');
  } else {
    const prim = carga.primeiroItem;
    nfsTexto = prim.chave_nf ? `${prim.nota_fiscal} - ${prim.chave_nf.trim()}` : (prim.nota_fiscal || '-');
  }

  return `${saudacao}

Solicito revisão das NFs:

${fabricante}

NF:

${nfsTexto}`;
}

export const AgendamentosModule: React.FC<AgendamentosModuleProps> = ({
  initialOpenModal,
  onResetInitialOpenModal,
}) => {
  const { user } = useAuth();
  const isGestor = isUserGestor(user);
  const isLogistica = isUserLogistica(user);
  const isAssistente = isUserAssistente(user);
  const podeSubirXml = canUserUploadXmlAgendamento(user);
  const podeVerDetalhesECopiarEmail = isLogistica || isGestor || podeSubirXml;

  const [usuariosMap, setUsuariosMap] = useState<Record<string, Usuario>>({});

  useEffect(() => {
    let isMounted = true;
    usuariosService
      .listarTodos()
      .then((users) => {
        if (!isMounted) return;
        const map: Record<string, Usuario> = {};
        for (const u of users) {
          if (u.id) map[u.id] = u;
          if (u.codigo) map[u.codigo.toUpperCase()] = u;
        }
        setUsuariosMap(map);
      })
      .catch((err) => {
        console.warn('Erro ao carregar mapa de usuários para agendamentos:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Abas de visualização do módulo Agendamentos: Pendentes, Recebidos, Cancelados
  const [abaAtiva, setAbaAtiva] = useState<TabAgendamento>('Pendentes');
  const [contadoresAbas, setContadoresAbas] = useState<{ pendentes: number; recebidosHoje: number }>({
    pendentes: 0,
    recebidosHoje: 0,
  });

  // Delete modal state
  const [deleteConfirmAgendamento, setDeleteConfirmAgendamento] = useState<Agendamento | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination state: 50 registros por página conforme solicitado
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filter state
  const [search, setSearch] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingAgendamento, setEditingAgendamento] = useState<Agendamento | null>(null);
  const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null);
  const [viewingXmlAgendamento, setViewingXmlAgendamento] = useState<Agendamento | null>(null);

  // Estado de cargas expandidas/recolhidas (padrão: recolhido ao iniciar)
  const [expandedCargas, setExpandedCargas] = useState<Record<string, boolean>>({});

  const toggleCarga = (cargaId: string) => {
    setExpandedCargas((prev) => ({
      ...prev,
      [cargaId]: !prev[cargaId],
    }));
  };

  const isCargaExpanded = (cargaId: string) => {
    return Boolean(expandedCargas[cargaId]);
  };

  // Agrupamento automático por Data e por Carga
  const gruposDataECarga = useMemo(() => {
    return agruparAgendamentosPorDataECarga(agendamentos, abaAtiva);
  }, [agendamentos, abaAtiva]);

  const showNotification = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const carregarContadores = useCallback(async () => {
    try {
      const dados = await badgesService.obterBadgesAgendamento(user?.unidade_negocio);
      setContadoresAbas(dados);
    } catch (err) {
      console.warn('Erro ao carregar contadores das abas de agendamentos:', err);
    }
  }, [user?.unidade_negocio]);

  useEffect(() => {
    carregarContadores();
    window.addEventListener('polihub_badges_refresh', carregarContadores);
    const interval = setInterval(carregarContadores, 30000);
    return () => {
      window.removeEventListener('polihub_badges_refresh', carregarContadores);
      clearInterval(interval);
    };
  }, [carregarContadores]);

  // Estado para feedback visual temporário de cópia de NFs por carga
  const [copiandoNfsCargaId, setCopiandoNfsCargaId] = useState<string | null>(null);

  // Copiar NFs para revisão formatado conforme especificação do modelo
  const handleCopiarNfsRevisao = async (carga: CargaAgrupada) => {
    const texto = formatarTextoRevisaoNfs(carga);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = texto;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiandoNfsCargaId(carga.id);
      showNotification('NFs para revisão copiadas para a área de transferência!');
      setTimeout(() => setCopiandoNfsCargaId(null), 2500);
    } catch (err) {
      console.warn('Erro ao copiar NFs para revisão:', err);
    }
  };

  const handleCopyEmail = async (ag: Agendamento) => {
    try {
      const ok = await copiarEmailAgendamento(ag.data_prevista, ag.horario);
      if (ok) {
        showNotification('Texto do e-mail copiado para a área de transferência!');
      }
    } catch (err) {
      console.warn('Erro ao copiar e-mail:', err);
    }
  };

  const loadAgendamentos = useCallback(
    async (targetPage = 1, forceRefresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const statusToFilter: AgendamentoStatus[] =
          abaAtiva === 'Pendentes'
            ? ['Pendente', 'Confirmado', 'Em trânsito']
            : abaAtiva === 'Recebidos'
            ? ['Recebido']
            : ['Cancelado'];

        const filters: AgendamentoFilters = {
          search: search.trim() || undefined,
          status: statusToFilter,
          dataInicio: dataInicio || undefined,
          dataFim: dataFim || undefined,
          unidade_negocio: user?.unidade_negocio,
        };

        const result = await agendamentosService.list(targetPage, pageSize, filters, forceRefresh);
        setAgendamentos(result.data);
        setTotal(result.total);
        setTotalPages(result.totalPages);
        setPage(result.page);
        carregarContadores();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Falha ao carregar agendamentos.';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [pageSize, search, abaAtiva, dataInicio, dataFim, user?.unidade_negocio, carregarContadores]
  );

  useEffect(() => {
    loadAgendamentos(1);
  }, [loadAgendamentos]);

  useEffect(() => {
    if (initialOpenModal) {
      setEditingAgendamento(null);
      setIsFormModalOpen(true);
      onResetInitialOpenModal?.();
    }
  }, [initialOpenModal, onResetInitialOpenModal]);

  const handleSave = async (
    data: Omit<Agendamento, 'id'> | Partial<Agendamento>,
    registrosAdicionais?: Omit<Agendamento, 'id'>[]
  ) => {
    if (!isGestor) {
      throw new Error('Apenas usuários com perfil "gestor" têm permissão para criar ou editar agendamentos.');
    }

    const payloadPrincipal = { ...data };
    if (!payloadPrincipal.usuario_id && user?.id) {
      payloadPrincipal.usuario_id = user.id;
    }
    if (!payloadPrincipal.usuario_insercao && (user?.nome || user?.codigo)) {
      payloadPrincipal.usuario_insercao = user.nome || user.codigo;
    }

    if (editingAgendamento) {
      const updated = await agendamentosService.update(editingAgendamento.id, payloadPrincipal);
      showNotification(`Agendamento de ${updated.fornecedor} atualizado com sucesso!`);
      await loadAgendamentos(page, true);
    } else {
      const created = await agendamentosService.create(payloadPrincipal as Omit<Agendamento, 'id'>);
      let criadosTotal = 1;
      const nfsCriadas = [created.nota_fiscal];

      // Cria um novo agendamento individual para cada NF adicional identificada
      if (registrosAdicionais && registrosAdicionais.length > 0) {
        for (const regAdicional of registrosAdicionais) {
          try {
            const regPayload = { ...regAdicional };
            if (!regPayload.usuario_id && user?.id) {
              regPayload.usuario_id = user.id;
            }
            if (!regPayload.usuario_insercao && (user?.nome || user?.codigo)) {
              regPayload.usuario_insercao = user.nome || user.codigo;
            }
            const adic = await agendamentosService.create(regPayload);
            criadosTotal++;
            nfsCriadas.push(adic.nota_fiscal);
          } catch (err) {
            console.error('Erro ao cadastrar agendamento para NF adicional:', regAdicional.nota_fiscal, err);
          }
        }
      }

      if (criadosTotal > 1) {
        showNotification(
          `${criadosTotal} agendamentos cadastrados com sucesso! (NFs: ${nfsCriadas.join(', ')})`
        );
      } else {
        showNotification(`Agendamento cadastrado com sucesso! NF: ${created.nota_fiscal}`);
      }

      setPage(1);
      carregarContadores();
      window.dispatchEvent(new Event('polihub_badges_refresh'));
      await loadAgendamentos(1, true);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmAgendamento) return;
    if (!isGestor) {
      setError('Apenas usuários com perfil "gestor" têm permissão para excluir agendamentos.');
      setDeleteConfirmAgendamento(null);
      return;
    }

    setIsDeleting(true);
    try {
      await agendamentosService.delete(deleteConfirmAgendamento.id);
      showNotification(`Agendamento NF ${deleteConfirmAgendamento.nota_fiscal} excluído com sucesso.`);
      setDeleteConfirmAgendamento(null);
      if (selectedAgendamento?.id === deleteConfirmAgendamento.id) {
        setSelectedAgendamento(null);
      }
      carregarContadores();
      window.dispatchEvent(new Event('polihub_badges_refresh'));
      await loadAgendamentos(page, true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao excluir agendamento.';
      setError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleQuickUploadXml = async (ag: Agendamento, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await agendamentosService.salvarXmlNota(ag.id, text);
      showNotification(`XML anexado com sucesso para a NF #${ag.nota_fiscal}!`);
      await loadAgendamentos(page, true);
    } catch (err: unknown) {
      console.error('Erro ao enviar XML:', err);
      const msg = err instanceof Error ? err.message : 'Falha ao processar e salvar o arquivo XML.';
      setError(msg);
    } finally {
      e.target.value = '';
    }
  };

  const handleQuickStatusChange = async (id: string, newStatus: AgendamentoStatus) => {
    try {
      const updated = await agendamentosService.updateStatus(id, newStatus);
      showNotification(`Status alterado para "${newStatus}" com sucesso!`);
      // Update locally immediately with sort rules
      setAgendamentos((prev) =>
        sortAgendamentosList(
          prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
        )
      );
      if (selectedAgendamento && selectedAgendamento.id === id) {
        setSelectedAgendamento(updated);
      }
      carregarContadores();
      window.dispatchEvent(new Event('polihub_badges_refresh'));
      await loadAgendamentos(page, true);
    } catch (e) {
      console.error(e);
      showNotification('Erro ao atualizar status.');
    }
  };

  const handleTrocarAba = (novaAba: TabAgendamento) => {
    setAbaAtiva(novaAba);
    setPage(1);
  };

  const getStatusBadge = (st: AgendamentoStatus) => {
    switch (st) {
      case 'Recebido':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'Confirmado':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'Em trânsito':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
      case 'Pendente':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'Cancelado':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  const clearFilters = () => {
    setSearch('');
    setDataInicio('');
    setDataFim('');
    setPage(1);
  };

  const activeFiltersCount =
    (dataInicio ? 1 : 0) +
    (dataFim ? 1 : 0) +
    (search ? 1 : 0);

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-24 md:pb-12">
      {/* Toast feedback */}
      {successToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl bg-emerald-600 text-white px-5 py-3 text-sm font-semibold shadow-2xl border border-emerald-400/40 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header bar of Agendamentos module */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
              {total} agendamento(s)
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-blue-500" />
            <span>Gestão de Agendamentos</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Controle de recebimentos, notas fiscais e acompanhamento de cargas
          </p>
        </div>

        {/* Action Button: Cadastrar Agendamento (Apenas Gestor) */}
        {isGestor && (
          <button
            type="button"
            id="btn-new-agendamento"
            onClick={() => {
              setEditingAgendamento(null);
              setIsFormModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm px-5 py-3 shadow-lg shadow-blue-600/30 transition active:scale-95 min-h-[48px] shrink-0 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>Novo Agendamento</span>
          </button>
        )}
      </div>

      {/* 2. Abas do Módulo Agendamentos: Pendentes, Recebidos, Cancelados */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 sm:p-2 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-lg">
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
          {/* Aba Pendentes (espelha a badge de quantidade do menu lateral) */}
          <button
            type="button"
            id="tab-agendamentos-pendentes"
            onClick={() => handleTrocarAba('Pendentes')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition min-h-[46px] cursor-pointer ${
              abaAtiva === 'Pendentes'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Pendentes</span>
            {contadoresAbas.pendentes > 0 && (
              <span
                id="badge-agendamentos-pendentes"
                className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                  abaAtiva === 'Pendentes'
                    ? 'bg-white/25 text-white'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
                title="Agendamentos pendentes (espelhado do menu lateral)"
              >
                {contadoresAbas.pendentes > 99 ? '99+' : contadoresAbas.pendentes}
              </span>
            )}
          </button>

          {/* Aba Recebidos (badge apenas das notas recebidas com data de hoje) */}
          <button
            type="button"
            id="tab-agendamentos-recebidos"
            onClick={() => handleTrocarAba('Recebidos')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition min-h-[46px] cursor-pointer ${
              abaAtiva === 'Recebidos'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Recebidos</span>
            {contadoresAbas.recebidosHoje > 0 && (
              <span
                id="badge-agendamentos-recebidos-hoje"
                className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                  abaAtiva === 'Recebidos'
                    ? 'bg-white/25 text-white'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
                title="Notas recebidas com a data de hoje"
              >
                {contadoresAbas.recebidosHoje > 99 ? '99+' : contadoresAbas.recebidosHoje}
              </span>
            )}
          </button>

          {/* Aba Cancelados (sem badge) */}
          <button
            type="button"
            id="tab-agendamentos-cancelados"
            onClick={() => handleTrocarAba('Cancelados')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition min-h-[46px] cursor-pointer ${
              abaAtiva === 'Cancelados'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <XCircle className="w-4 h-4" />
            <span>Cancelados</span>
          </button>
        </div>

        {/* Resumo da aba ativa */}
        <div className="hidden sm:flex items-center gap-2 pr-3 text-xs text-slate-400">
          <span>Aba: <strong className="text-white font-semibold">{abaAtiva}</strong></span>
          <span className="text-slate-600">•</span>
          <span>{total} registro(s)</span>
          {(abaAtiva === 'Pendentes' || abaAtiva === 'Recebidos') && (
            <>
              <span className="text-slate-600">•</span>
              <span
                id="badge-ordem-agendamentos"
                className="inline-flex items-center gap-1 text-[11px] font-mono text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded-lg border border-sky-800/40"
                title="Critério de ordenação automática ativo: 1º Data, 2º Fabricante, 3º Número da NF"
              >
                Ordem: <span className="font-semibold text-sky-300">Data &gt; Fabricante &gt; NF</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              id="input-search-agendamentos"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Pesquisar por fornecedor, NF ou transportadora..."
              className="w-full bg-slate-950/90 border border-slate-700/80 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition min-h-[44px]"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick status pills for mobile & desktop */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {/* Atalho Recebidos Hoje (Apenas na aba Recebidos) */}
            {abaAtiva === 'Recebidos' && (
              <button
                type="button"
                id="btn-filter-recebidos-hoje"
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  setPage(1);
                  if (dataInicio === today && dataFim === today) {
                    setDataInicio('');
                    setDataFim('');
                  } else {
                    setDataInicio(today);
                    setDataFim(today);
                  }
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border text-xs font-semibold transition min-h-[44px] whitespace-nowrap cursor-pointer ${
                  dataInicio === new Date().toISOString().slice(0, 10) && dataFim === new Date().toISOString().slice(0, 10)
                    ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300 ring-1 ring-emerald-500/30'
                    : 'bg-slate-950/90 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                }`}
                title="Filtrar notas recebidas hoje"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Hoje</span>
                {contadoresAbas.recebidosHoje > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold">
                    {contadoresAbas.recebidosHoje}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              id="btn-toggle-date-filters"
              onClick={() => setShowFilters((p) => !p)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border text-xs font-semibold transition min-h-[44px] whitespace-nowrap ${
                showFilters || dataInicio || dataFim
                  ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                  : 'bg-slate-950/90 border-slate-700/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Datas</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {gruposDataECarga.length > 0 && (
              <button
                type="button"
                id="btn-toggle-expand-all"
                onClick={() => {
                  const allCargaIds: string[] = [];
                  for (const g of gruposDataECarga) {
                    for (const c of g.cargas) {
                      allCargaIds.push(c.id);
                    }
                  }
                  const allExpanded = allCargaIds.every((id) => isCargaExpanded(id));
                  const next: Record<string, boolean> = {};
                  for (const id of allCargaIds) {
                    next[id] = !allExpanded;
                  }
                  setExpandedCargas(next);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border text-xs font-semibold transition min-h-[44px] whitespace-nowrap bg-slate-950/90 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
                title="Expandir ou recolher todas as cargas"
              >
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">
                  {gruposDataECarga.flatMap((g) => g.cargas).every((c) => isCargaExpanded(c.id))
                    ? 'Recolher cargas'
                    : 'Expandir cargas'}
                </span>
              </button>
            )}

            <button
              type="button"
              id="btn-refresh-agendamentos"
              onClick={() => loadAgendamentos(page, true)}
              className="p-2.5 rounded-2xl bg-slate-950/90 border border-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-800 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Date Filter Drawer */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">De:</span>
              <input
                type="date"
                id="input-filter-data-inicio"
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Até:</span>
              <input
                type="date"
                id="input-filter-data-fim"
                value={dataFim}
                onChange={(e) => {
                  setDataFim(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              />
            </div>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-rose-400 hover:text-rose-300 font-medium underline underline-offset-2 ml-auto"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Loading state skeleton */}
      {loading && agendamentos.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-28 rounded-3xl bg-slate-900/60 border border-slate-800/60 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-3xl bg-rose-500/10 border border-rose-500/30 p-5 text-center text-rose-300">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
          <h4 className="text-sm font-bold">Erro ao carregar dados</h4>
          <p className="text-xs mt-1 text-rose-300/80">{error}</p>
          <button
            type="button"
            onClick={() => loadAgendamentos(page, true)}
            className="mt-3 px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && agendamentos.length === 0 && (
        <div className="rounded-3xl bg-slate-900/40 border border-slate-800 p-8 sm:p-12 text-center text-slate-400">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center mx-auto mb-3 text-slate-500">
            <Inbox className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-white">
            {activeFiltersCount > 0
              ? 'Nenhum agendamento localizado'
              : abaAtiva === 'Pendentes'
              ? 'Nenhum agendamento pendente'
              : abaAtiva === 'Recebidos'
              ? 'Nenhum agendamento recebido'
              : 'Nenhum agendamento cancelado'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-sm mx-auto">
            {activeFiltersCount > 0
              ? 'Nenhum registro corresponde aos filtros selecionados. Tente ajustar os parâmetros de busca.'
              : abaAtiva === 'Pendentes'
              ? 'Não há agendamentos pendentes no momento. Inicie registrando um novo agendamento.'
              : abaAtiva === 'Recebidos'
              ? 'Nenhuma nota fiscal recebida localizada nesta unidade.'
              : 'Nenhum agendamento cancelado nesta unidade.'}
          </p>

          <div className="mt-5 flex justify-center gap-3">
            {activeFiltersCount > 0 ? (
              <button
                type="button"
                onClick={clearFilters}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
              >
                Limpar Filtros
              </button>
            ) : isGestor ? (
              <button
                type="button"
                id="btn-empty-new-agendamento"
                onClick={() => {
                  setEditingAgendamento(null);
                  setIsFormModalOpen(true);
                }}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition"
              >
                Cadastrar Primeiro Agendamento
              </button>
            ) : (
              <p className="text-xs text-slate-500">
                Aguardando novos agendamentos registrados pela gestão.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 3. LISTAGEM DE CARGAS E AGENDAMENTOS (DESKTOP E MOBILE) */}
      {!loading && !error && agendamentos.length > 0 && (
        <div className="space-y-3">
          {gruposDataECarga
            .flatMap((grupo) => grupo.cargas)
            .map((carga) => {
              const isExpanded = isCargaExpanded(carga.id);
              const badgeConfig = getDataAgendadaBadgeConfig(carga.primeiroItem);
              const dataExibicao =
                carga.primeiroItem.status === 'Recebido'
                  ? (carga.primeiroItem.data_entrega || carga.primeiroItem.data_prevista)
                  : carga.primeiroItem.data_prevista;
              const isPendente =
                carga.statusGeral.toLowerCase() === 'pendente' ||
                carga.primeiroItem.status.toLowerCase() === 'pendente';
              const isHojeBrasilia = isDataHojeBrasilia(carga.primeiroItem.data_prevista);
              const podeCopiarNfsRevisao = isGestor && isPendente && isHojeBrasilia;

                  return (
                    <div
                      key={carga.id}
                      id={`card-carga-${carga.id}`}
                      className="rounded-2xl bg-slate-900/90 border border-slate-800/90 hover:border-slate-700/80 shadow-lg overflow-hidden transition-all duration-200"
                    >
                      {/* Cabeçalho da Carga: 2 linhas, compacto */}
                      <div
                        onClick={() => toggleCarga(carga.id)}
                        className="p-3 sm:px-4 sm:py-3 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-800/40 transition group"
                      >
                        {/* Lado esquerdo: Ícone de caminhão em bloco azul + Fornecedor/Status e Transportadora/NFs/Volumes */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-xs shadow-blue-500/10">
                            <Truck className="w-5 h-5 text-blue-400" />
                          </div>

                          <div className="min-w-0 flex-1">
                            {/* Linha superior: nome do fornecedor e badge do status geral */}
                            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                              <h3
                                className="text-sm sm:text-base font-black text-white tracking-tight truncate uppercase"
                                title={carga.fornecedor}
                              >
                                {carga.fornecedor}
                              </h3>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold border ${getStatusBadge(
                                  carga.statusGeral
                                )}`}
                              >
                                {carga.statusGeral}
                              </span>
                            </div>

                            {/* Linha inferior: transportadora, quantidade de notas fiscais e quantidade total de paletes ou caixas */}
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5 truncate">
                              <span
                                className="text-slate-300 font-medium truncate max-w-[180px] sm:max-w-[280px]"
                                title={carga.transportadora}
                              >
                                {carga.transportadora || 'Transportadora não informada'}
                              </span>
                              <span className="text-slate-600 font-bold">·</span>
                              <span className="font-semibold text-slate-300 whitespace-nowrap">
                                {carga.itens.length}{' '}
                                {carga.itens.length === 1 ? 'Nota fiscal' : 'Notas fiscais'}
                              </span>
                              <span className="text-slate-600 font-bold">·</span>
                              <span className="text-slate-300 whitespace-nowrap">
                                {carga.totalVolumes} {carga.tipoVolumes.toLowerCase()}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Lado direito: Botão de ação (apenas ícone cópia de NFs para revisão) + Badge com data/hora + Botão Listar NFs */}
                        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                          {podeCopiarNfsRevisao && (
                            <button
                              type="button"
                              id={`btn-copiar-revisao-nfs-${carga.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopiarNfsRevisao(carga);
                              }}
                              className="p-1.5 sm:p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-sky-400 hover:text-sky-300 border border-slate-700/80 hover:border-sky-500/50 transition shadow-xs cursor-pointer group"
                              title="Copiar NFs para revisão"
                              aria-label="Copiar NFs para revisão"
                            >
                              {copiandoNfsCargaId === carga.id ? (
                                <Check className="w-4 h-4 text-emerald-400 animate-in zoom-in" />
                              ) : (
                                <Copy className="w-4 h-4 group-hover:scale-110 transition-transform" />
                              )}
                            </button>
                          )}

                          <div
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-medium whitespace-nowrap ${badgeConfig.classes}`}
                            title={badgeConfig.tooltip}
                          >
                            {badgeConfig.icon}
                            <span className="font-mono font-semibold">
                              {formatarDataAgendada(dataExibicao)}
                              {carga.horario ? ` • ${carga.horario}` : ''}
                            </span>
                            {badgeConfig.tag}
                          </div>

                          <button
                            type="button"
                            id={`btn-listar-nfs-${carga.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCarga(carga.id);
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer shrink-0 shadow-xs ${
                              isExpanded
                                ? 'bg-blue-600/20 text-blue-300 border-blue-500/50 hover:bg-blue-600/30'
                                : 'bg-slate-800/90 text-slate-200 border-slate-700/80 hover:bg-slate-700 hover:text-white hover:border-slate-600'
                            }`}
                            title={isExpanded ? 'Recolher lista de Notas Fiscais' : 'Listar Notas Fiscais desta carga'}
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-400" />
                            <span>Listar NFs</span>
                            <ChevronDown
                              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                isExpanded ? 'rotate-180 text-blue-400' : 'text-slate-400'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Listagem compacta das NFs ao expandir */}
                      {isExpanded && (
                        <div className="border-t border-slate-800/80 bg-slate-950/70 divide-y divide-slate-800/50">
                          {carga.itens.map((ag) => {
                            const isMatchSearch =
                              Boolean(search.trim()) &&
                              ag.nota_fiscal.toLowerCase().includes(search.trim().toLowerCase());

                            return (
                              <div
                                key={ag.id}
                                id={`row-agendamento-nf-${ag.id}`}
                                className={`px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-3 text-xs transition ${
                                  isMatchSearch
                                    ? 'bg-blue-600/15 border-l-2 border-l-blue-400'
                                    : 'hover:bg-slate-800/30'
                                }`}
                              >
                                {/* Esquerda: ícone de documento e número da NF */}
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                                  <span className="font-mono font-bold text-white text-xs sm:text-sm tracking-wide">
                                    NF {ag.nota_fiscal}
                                  </span>
                                </div>

                                {/* Centro: botão Ver XML e badge do status individual */}
                                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                  {ag.xml_nota ? (
                                    <button
                                      type="button"
                                      id={`btn-xml-${ag.id}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setViewingXmlAgendamento(ag);
                                      }}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition shadow-xs cursor-pointer group"
                                      title="Visualizar XML da NF-e"
                                    >
                                      <FileCode2 className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition" />
                                      <span>Ver XML</span>
                                    </button>
                                  ) : podeSubirXml ? (
                                    <label
                                      htmlFor={`input-quick-xml-${ag.id}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 border border-slate-700 hover:border-sky-500/40 text-xs font-semibold transition cursor-pointer"
                                      title="Subir XML da Nota Fiscal"
                                    >
                                      <Upload className="w-3.5 h-3.5 text-sky-400" />
                                      <span>Subir XML</span>
                                      <input
                                        id={`input-quick-xml-${ag.id}`}
                                        type="file"
                                        accept=".xml,text/xml,application/xml"
                                        onChange={(e) => handleQuickUploadXml(ag, e)}
                                        className="hidden"
                                      />
                                    </label>
                                  ) : (
                                    <span className="text-slate-600 text-xs italic px-2">Sem XML</span>
                                  )}

                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold border ${getStatusBadge(
                                      ag.status
                                    )}`}
                                  >
                                    {ag.status}
                                  </span>
                                </div>

                                {/* Direita: ícones de visualizar, editar e excluir (e copiar e-mail) */}
                                <div className="flex items-center justify-end gap-1 shrink-0">
                                  {podeVerDetalhesECopiarEmail && (
                                    <>
                                      <button
                                        type="button"
                                        id={`btn-copy-email-${ag.id}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopyEmail(ag);
                                        }}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-sky-950/60 border border-transparent hover:border-sky-800/40 transition cursor-pointer"
                                        title="Copiar e-mail de agendamento"
                                      >
                                        <Mail className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        id={`btn-view-${ag.id}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedAgendamento(ag);
                                        }}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                                        title="Ver detalhes"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}

                                  {isGestor && (
                                    <>
                                      <button
                                        type="button"
                                        id={`btn-edit-${ag.id}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingAgendamento(ag);
                                          setIsFormModalOpen(true);
                                        }}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                                        title="Editar agendamento"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        id={`btn-delete-${ag.id}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteConfirmAgendamento(ag);
                                        }}
                                        className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/30 transition cursor-pointer"
                                        title="Excluir agendamento"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
        </div>
      )}

      {/* Pagination Footer */}
      {total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 px-1 border-t border-slate-800/60">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>
              Exibindo <strong className="text-white">{agendamentos.length}</strong> de <strong className="text-white">{total}</strong> agendamentos
            </span>
            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium text-[11px]">
              50 por página
            </span>
            {totalPages > 1 && (
              <span className="text-slate-500 text-[11px]">
                (Página {page} de {totalPages})
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              id="btn-pagination-prev"
              disabled={page <= 1 || loading}
              onClick={() => loadAgendamentos(page - 1)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition min-h-[40px] cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
              if (totalPages > 7 && Math.abs(p - page) > 2 && p !== 1 && p !== totalPages) {
                if (p === 2 || p === totalPages - 1) {
                  return <span key={p} className="text-slate-600 px-1 font-bold">...</span>;
                }
                return null;
              }
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => loadAgendamentos(p)}
                  disabled={loading}
                  className={`min-w-[36px] h-[36px] flex items-center justify-center rounded-xl text-xs font-bold transition cursor-pointer ${
                    p === page
                      ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              );
            })}

            <button
              type="button"
              id="btn-pagination-next"
              disabled={page >= totalPages || loading}
              onClick={() => loadAgendamentos(page + 1)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition min-h-[40px] cursor-pointer disabled:cursor-not-allowed"
            >
              <span>Próxima</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Form Modal (Create / Edit) */}
      {isFormModalOpen && (
        <AgendamentoModal
          agendamento={editingAgendamento}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingAgendamento(null);
          }}
          onSave={handleSave}
        />
      )}

      {/* Details Modal (Exclusivo para Logística ou Gestor) */}
      {selectedAgendamento && podeVerDetalhesECopiarEmail && (
        <AgendamentoDetailsModal
          agendamento={selectedAgendamento}
          onClose={() => setSelectedAgendamento(null)}
          onEdit={(ag) => {
            setSelectedAgendamento(null);
            setEditingAgendamento(ag);
            setIsFormModalOpen(true);
          }}
          onDelete={(ag) => {
            setDeleteConfirmAgendamento(ag);
          }}
          onStatusChange={handleQuickStatusChange}
        />
      )}

      {/* Delete Confirmation Modal (Apenas Gestor) */}
      {deleteConfirmAgendamento && (
        <div
          id="modal-delete-agendamento-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div
            id="modal-delete-agendamento-content"
            className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Excluir Agendamento</h3>
                <p className="text-xs text-slate-400">Esta ação não poderá ser desfeita</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Fornecedor:</span>
                <span className="font-bold text-white text-right">{deleteConfirmAgendamento.fornecedor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Nota Fiscal:</span>
                <span className="font-mono font-bold text-sky-400">{deleteConfirmAgendamento.nota_fiscal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Previsão:</span>
                <span className="text-slate-200">
                  {new Date(deleteConfirmAgendamento.data_prevista + 'T00:00:00').toLocaleDateString('pt-BR')}
                  {deleteConfirmAgendamento.horario ? ` às ${deleteConfirmAgendamento.horario}` : ''}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Você confirma a remoção definitiva deste registro de agendamento de carga?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                id="btn-cancel-delete-agendamento"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmAgendamento(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirm-delete-agendamento"
                disabled={isDeleting}
                onClick={handleDelete}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition shadow-lg shadow-rose-600/30 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmar Exclusão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Espelho Formatado do XML da Nota */}
      {viewingXmlAgendamento && viewingXmlAgendamento.xml_nota && (
        <VisualizarXmlNotaModal
          xml={viewingXmlAgendamento.xml_nota}
          agendamento={viewingXmlAgendamento}
          onClose={() => setViewingXmlAgendamento(null)}
          onSubstituirXml={
            podeSubirXml
              ? async (novoXml: string) => {
                  await agendamentosService.salvarXmlNota(viewingXmlAgendamento.id, novoXml);
                  loadAgendamentos(page);
                  setViewingXmlAgendamento((prev) => (prev ? { ...prev, xml_nota: novoXml } : null));
                  showNotification('XML da nota atualizado com sucesso.');
                }
              : undefined
          }
          onRemoverXml={
            podeSubirXml
              ? async () => {
                  await agendamentosService.removerXmlNota(viewingXmlAgendamento.id);
                  loadAgendamentos(page);
                  setViewingXmlAgendamento(null);
                  showNotification('XML da nota removido com sucesso.');
                }
              : undefined
          }
        />
      )}
    </div>
  );
};
