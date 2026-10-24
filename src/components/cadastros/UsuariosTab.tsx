import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  User,
  Shield,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Edit2,
  Clock,
  UserCheck,
  UserX,
  X,
  Building,
  Briefcase,
  Database,
  Building2,
  Check,
  Lock,
  Eye,
  Mail,
  Copy,
  Calendar,
  Hash,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import { Usuario, UsuarioStatus, UnidadeNegocio } from '../../types';
import { usuariosService } from '../../services/usuariosService';
import { unidadesNegocioService } from '../../services/unidadesNegocioService';
import { SqlScriptModal } from './SqlScriptModal';
import { UNIDADES_NEGOCIO_PADRAO, UNIDADE_PADRAO_SISTEMA } from '../../constants/unidades';
import {
  DEPARTAMENTOS,
  FUNCOES_POR_DEPARTAMENTO,
  NIVEIS_USUARIO,
  Departamento,
  NivelUsuario,
  isCombinacaoValida,
  normalizarDepartamento,
  normalizarNivelUsuario,
} from '../../constants/departamentos';
import {
  formatarParteNome,
  dividirNomeESobrenome,
  juntarNomeESobrenome,
  validarTamanhoNomeSobrenome,
} from '../../utils/nomeSobrenome';

interface UsuariosTabProps {
  currentUser: Usuario | null;
  isGestor: boolean;
}

export const UsuariosTab: React.FC<UsuariosTabProps> = ({ currentUser, isGestor }) => {
  const [users, setUsers] = useState<Usuario[]>([]);
  const [unidadesList, setUnidadesList] = useState<UnidadeNegocio[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendente' | 'aprovado' | 'desativado'>('todos');
  const [deptFilter, setDeptFilter] = useState<'todos' | Departamento>('todos');
  const [unidadeFilter, setUnidadeFilter] = useState<string>(
    currentUser?.unidade_negocio || 'Goiânia'
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sqlModalOpen, setSqlModalOpen] = useState(false);

  // Details Modal State
  const [selectedUserForDetails, setSelectedUserForDetails] = useState<Usuario | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedCodigo, setCopiedCodigo] = useState(false);

  // Approval Modal State (Item 6 - Nome e Sobrenome máx. 12 carac.)
  const [approvingUser, setApprovingUser] = useState<Usuario | null>(null);
  const [approvalPrimeiroNome, setApprovalPrimeiroNome] = useState('');
  const [approvalSobrenome, setApprovalSobrenome] = useState('');
  const [approvalDept, setApprovalDept] = useState<Departamento>('Logística');
  const [approvalFuncao, setApprovalFuncao] = useState<string>('Operador Logístico');
  const [approvalNivel, setApprovalNivel] = useState<NivelUsuario>('Operador');
  const [savingApproval, setSavingApproval] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // Edit Modal State (Item 6 - Nome e Sobrenome máx. 12 carac.)
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [editPrimeiroNome, setEditPrimeiroNome] = useState('');
  const [editSobrenome, setEditSobrenome] = useState('');
  const [editForm, setEditForm] = useState<{
    codigo: string;
    email: string;
    unidade_negocio: string;
    departamento: Departamento;
    funcao: string;
    nivel: NivelUsuario;
  }>({
    codigo: '',
    email: '',
    unidade_negocio: UNIDADE_PADRAO_SISTEMA,
    departamento: 'Logística',
    funcao: 'Operador Logístico',
    nivel: 'Operador',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Confirmation Modal for Deactivate
  const [deactivatingUser, setDeactivatingUser] = useState<Usuario | null>(null);
  const [processingStatus, setProcessingStatus] = useState(false);

  // Solicitação de Alteração Obrigatória de Senha
  const [confirmingTrocaSenhaUser, setConfirmingTrocaSenhaUser] = useState<{
    user: Usuario;
    exigir: boolean;
  } | null>(null);
  const [togglingTrocaSenha, setTogglingTrocaSenha] = useState(false);

  const handleToggleExigirTrocaSenha = async (targetUser: Usuario, exigir: boolean) => {
    setTogglingTrocaSenha(true);
    try {
      await usuariosService.solicitarTrocaSenha(targetUser.id, exigir);
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, exigir_troca_senha: exigir } : u))
      );
      if (selectedUserForDetails?.id === targetUser.id) {
        setSelectedUserForDetails((prev) => (prev ? { ...prev, exigir_troca_senha: exigir } : null));
      }
      setConfirmingTrocaSenhaUser(null);
      setFeedback({
        message: exigir
          ? `Alteração de senha solicitada para "${targetUser.nome}". O cadastro de nova senha será obrigatório no próximo acesso.`
          : `Solicitação de alteração de senha cancelada para "${targetUser.nome}".`,
        isError: false,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao atualizar solicitação de alteração de senha.';
      setFeedback({ message: msg, isError: true });
    } finally {
      setTogglingTrocaSenha(false);
    }
  };

  // Feedback Toast
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null);

  const handleCopyEmail = async (emailToCopy: string) => {
    if (!emailToCopy) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(emailToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = emailToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    } catch (err) {
      console.error('Falha ao copiar e-mail:', err);
    }
  };

  const handleCopyCodigo = async (codigoToCopy: string) => {
    if (!codigoToCopy) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(codigoToCopy);
      }
      setCopiedCodigo(true);
      setTimeout(() => setCopiedCodigo(false), 2500);
    } catch (err) {
      console.error('Falha ao copiar código:', err);
    }
  };

  const loadData = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await usuariosService.listarTodos();
      setUsers(data);
    } catch (err) {
      console.warn('Erro ao listar usuários:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false);

    const carregarUnidades = async () => {
      try {
        const lista = await unidadesNegocioService.listarAtivas();
        if (lista && lista.length > 0) {
          setUnidadesList(lista);
        } else {
          setUnidadesList(
            UNIDADES_NEGOCIO_PADRAO.map((u) => ({
              id: u.id,
              nome: u.nome,
              sigla: u.sigla,
              ativo: true,
            }))
          );
        }
      } catch (err) {
        console.warn('Erro ao carregar unidades em Usuários:', err);
      }
    };

    carregarUnidades();

    const handleRefresh = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setUnidadesList(e.detail.filter((u: UnidadeNegocio) => u.ativo !== false));
      } else {
        carregarUnidades();
      }
    };

    window.addEventListener('polihub_unidades_refresh', handleRefresh);
    return () => {
      window.removeEventListener('polihub_unidades_refresh', handleRefresh);
    };
  }, []);

  // -------------------------------------------------------------
  // APROVAÇÃO DE USUÁRIO (Gestor seleciona Depto, Função e Nível)
  // -------------------------------------------------------------
  const handleOpenAprovar = (u: Usuario) => {
    setApprovingUser(u);
    const { nome, sobrenome } = dividirNomeESobrenome(u.nome);
    setApprovalPrimeiroNome(nome);
    setApprovalSobrenome(sobrenome);
    const dept = normalizarDepartamento(u.departamento);
    setApprovalDept(dept);
    const funcoes = FUNCOES_POR_DEPARTAMENTO[dept] || [];
    setApprovalFuncao(funcoes.includes(u.funcao) ? u.funcao : funcoes[0] || 'Operador Logístico');
    setApprovalNivel('Operador');
    setApprovalError(null);
  };

  const handleApprovalDeptChange = (newDept: Departamento) => {
    setApprovalDept(newDept);
    const funcoes = FUNCOES_POR_DEPARTAMENTO[newDept] || [];
    setApprovalFuncao(funcoes[0] || '');
  };

  const isApprovalValid = useMemo(() => {
    return isCombinacaoValida(approvalDept, approvalFuncao, approvalNivel);
  }, [approvalDept, approvalFuncao, approvalNivel]);

  const handleConfirmarAprovacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingUser) return;

    const validacaoNome = validarTamanhoNomeSobrenome(approvalPrimeiroNome, approvalSobrenome);
    if (!validacaoNome.valido) {
      setApprovalError(validacaoNome.erro || 'Nome ou sobrenome inválido.');
      return;
    }

    if (!isApprovalValid) {
      setApprovalError('Selecione uma combinação estritamente válida de Departamento, Função e Nível.');
      return;
    }

    const nomePadronizado = juntarNomeESobrenome(approvalPrimeiroNome, approvalSobrenome);

    setSavingApproval(true);
    setApprovalError(null);
    try {
      const atualizado = await usuariosService.atualizarUsuario(approvingUser.id, {
        nome: nomePadronizado,
        departamento: approvalDept,
        funcao: approvalFuncao,
        nivel: approvalNivel,
        status: 'aprovado',
      });

      setUsers((prev) => prev.map((u) => (u.id === atualizado.id ? atualizado : u)));
      setFeedback({
        message: `Usuário "${atualizado.nome}" APROVADO com sucesso no departamento ${approvalDept} (${approvalFuncao} • ${approvalNivel})!`,
        isError: false,
      });
      setApprovingUser(null);
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao aprovar usuário.';
      setApprovalError(msg);
    } finally {
      setSavingApproval(false);
    }
  };

  // -------------------------------------------------------------
  // REATIVAÇÃO DE USUÁRIO DESATIVADO (Preserva dados históricos)
  // -------------------------------------------------------------
  const handleReativar = async (user: Usuario) => {
    try {
      const atualizado = await usuariosService.atualizarStatus(user.id, 'aprovado');
      setUsers((prev) => prev.map((u) => (u.id === atualizado.id ? atualizado : u)));
      setFeedback({
        message: `Usuário "${user.nome}" reativado com sucesso!`,
        isError: false,
      });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao reativar usuário.';
      setFeedback({ message: msg, isError: true });
    }
  };

  // -------------------------------------------------------------
  // DESATIVAÇÃO DE USUÁRIO (Sem excluir dados)
  // -------------------------------------------------------------
  const handleConfirmarDesativacao = async () => {
    if (!deactivatingUser) return;
    setProcessingStatus(true);
    try {
      const atualizado = await usuariosService.atualizarStatus(deactivatingUser.id, 'desativado');
      setUsers((prev) => prev.map((u) => (u.id === atualizado.id ? atualizado : u)));
      setFeedback({
        message: `Usuário "${deactivatingUser.nome}" foi desativado. Seu histórico foi preservado.`,
        isError: false,
      });
      setDeactivatingUser(null);
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao desativar usuário.';
      setFeedback({ message: msg, isError: true });
      setDeactivatingUser(null);
    } finally {
      setProcessingStatus(false);
    }
  };

  // -------------------------------------------------------------
  // EDIÇÃO DE USUÁRIO
  // -------------------------------------------------------------
  const handleOpenEdit = (u: Usuario) => {
    setEditingUser(u);
    const { nome, sobrenome } = dividirNomeESobrenome(u.nome);
    setEditPrimeiroNome(nome);
    setEditSobrenome(sobrenome);
    const dept = normalizarDepartamento(u.departamento);
    const funcoes = FUNCOES_POR_DEPARTAMENTO[dept] || [];
    const funcao = funcoes.includes(u.funcao) ? u.funcao : funcoes[0] || 'Operador Logístico';
    const nivel = normalizarNivelUsuario(u.nivel);

    const fallbackEmail = u.email || usuariosService.getEmailCache(u.id) || (u.id === currentUser?.id ? currentUser?.email : '') || '';

    setEditForm({
      codigo: u.codigo || '',
      email: fallbackEmail,
      unidade_negocio: u.unidade_negocio || UNIDADE_PADRAO_SISTEMA,
      departamento: dept,
      funcao: funcao,
      nivel: nivel,
    });
    setEditError(null);
  };

  const handleEditDeptChange = (newDept: Departamento) => {
    const funcoes = FUNCOES_POR_DEPARTAMENTO[newDept] || [];
    setEditForm((prev) => ({
      ...prev,
      departamento: newDept,
      funcao: funcoes[0] || '',
    }));
  };

  const isEditingSelf = Boolean(editingUser && currentUser && editingUser.id === currentUser.id);

  const isEditValid = useMemo(() => {
    return isCombinacaoValida(editForm.departamento, editForm.funcao, editForm.nivel);
  }, [editForm.departamento, editForm.funcao, editForm.nivel]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const validacaoNome = validarTamanhoNomeSobrenome(editPrimeiroNome, editSobrenome);
    if (!validacaoNome.valido) {
      setEditError(validacaoNome.erro || 'Nome ou sobrenome inválido (máximo 12 caracteres cada).');
      return;
    }

    const nomePadronizado = juntarNomeESobrenome(editPrimeiroNome, editSobrenome);

    if (!isEditValid) {
      setEditError('A combinação selecionada de Departamento, Função e Nível não é permitida.');
      return;
    }

    // Regra: o usuário não pode alterar o próprio nível
    if (isEditingSelf && editForm.nivel !== normalizarNivelUsuario(editingUser.nivel)) {
      setEditError('Regra de segurança: o usuário não pode alterar o próprio nível de permissão.');
      return;
    }

    setSavingEdit(true);
    setEditError(null);
    try {
      const atualizado = await usuariosService.atualizarUsuario(editingUser.id, {
        nome: nomePadronizado,
        codigo: editForm.codigo ? editForm.codigo.trim().toUpperCase() : undefined,
        email: editForm.email ? editForm.email.trim().toLowerCase() : undefined,
        unidade_negocio: editForm.unidade_negocio,
        departamento: editForm.departamento,
        funcao: editForm.funcao,
        nivel: editForm.nivel,
      });

      setUsers((prev) => prev.map((u) => (u.id === atualizado.id ? atualizado : u)));
      setFeedback({
        message: `Dados do usuário "${atualizado.nome}" atualizados com sucesso!`,
        isError: false,
      });
      setEditingUser(null);
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar alterações do usuário.';
      setEditError(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  // -------------------------------------------------------------
  // FILTRAGEM
  // -------------------------------------------------------------
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Filtro de texto (Nome, Código ou E-mail)
      if (search.trim()) {
        const s = search.trim().toLowerCase();
        const bateNome = u.nome.toLowerCase().includes(s);
        const bateCodigo = u.codigo?.toLowerCase().includes(s);
        const bateEmail = u.email?.toLowerCase().includes(s);
        if (!bateNome && !bateCodigo && !bateEmail) return false;
      }

      // Filtro de departamento
      if (deptFilter !== 'todos') {
        const deptNorm = normalizarDepartamento(u.departamento);
        if (deptNorm !== deptFilter) return false;
      }

      // Filtro de status
      const statusUser = u.status || 'aprovado';
      if (statusFilter === 'pendente') {
        return statusUser === 'pendente';
      }
      if (statusFilter === 'aprovado') {
        return statusUser === 'aprovado' || statusUser === 'ativo';
      }
      if (statusFilter === 'desativado') {
        return statusUser === 'desativado';
      }

      // Filtro de Unidade de Negócio
      if (unidadeFilter !== 'todas') {
        const uNorm = (u.unidade_negocio || '').trim().toLowerCase();
        const fNorm = unidadeFilter.trim().toLowerCase();
        if (uNorm !== fNorm && !uNorm.includes(fNorm) && !fNorm.includes(uNorm)) {
          return false;
        }
      }

      return true;
    });
  }, [users, search, statusFilter, deptFilter, unidadeFilter]);

  const totalPendentes = users.filter((u) => u.status === 'pendente').length;

  return (
    <div className="space-y-4">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl text-xs sm:text-sm font-semibold shadow-lg transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${
            feedback.isError
              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
              : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.isError ? (
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            ) : (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            )}
            <span>{feedback.message}</span>
          </div>
        </div>
      )}

      {/* Control Bar: Search + Dept Filter + Status Filter + Actions */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            id="input-busca-usuarios"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por Nome ou Código (ex: OP-1042)..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition min-h-[44px]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 0. Filtro de Unidade de Negócio */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-xl text-xs">
            <Building2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
              Unidade:
            </span>
            <select
              id="select-filtro-unidade-usuarios"
              value={unidadeFilter}
              onChange={(e) => setUnidadeFilter(e.target.value)}
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer max-w-[150px] truncate text-xs"
              title="Filtrar por Unidade de Negócio"
            >
              <option value="todas" className="bg-slate-900 text-white">
                Todas ({unidadesList.length})
              </option>
              {unidadesList.map((u) => (
                <option key={u.id || u.nome} value={u.nome} className="bg-slate-900 text-white truncate">
                  {u.nome} {u.sigla ? `(${u.sigla})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 1. Filtro de Departamento (3 departamentos oficiais) */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl">
            <span className="text-[11px] font-bold text-slate-400 px-2 uppercase tracking-wider hidden sm:inline">
              Depto:
            </span>
            {(['todos', 'Logística', 'Comercial', 'Financeiro'] as const).map((d) => (
              <button
                key={d}
                type="button"
                id={`filter-dept-${d}`}
                onClick={() => setDeptFilter(d)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  deptFilter === d
                    ? 'bg-blue-600 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                {d === 'todos' ? 'Todos' : d}
              </button>
            ))}
          </div>

          {/* 2. Filtro de Status */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl">
            {(['todos', 'pendente', 'aprovado', 'desativado'] as const).map((st) => (
              <button
                key={st}
                type="button"
                id={`filter-usr-${st}`}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  statusFilter === st
                    ? 'bg-purple-600 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <span>{st === 'todos' ? 'Status: Todos' : st === 'pendente' ? 'Pendentes' : st === 'aprovado' ? 'Aprovados' : 'Desativados'}</span>
                {st === 'pendente' && totalPendentes > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                    {totalPendentes}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Action Buttons */}

          <button
            type="button"
            id="btn-refresh-usuarios"
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition min-h-[40px] shrink-0"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Table: Nome, Código, Unidade, Departamento, Função, Nível, Status, Ações */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Usuário</th>
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Unidade</th>
                <th className="py-3 px-4">Departamento</th>
                <th className="py-3 px-4">Função</th>
                <th className="py-3 px-4">Nível</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-400 mb-2" />
                    <span>Carregando usuários cadastrados...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <User className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="font-semibold text-white">Nenhum usuário encontrado</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {search ? 'Tente ajustar os termos da pesquisa.' : 'Nenhum usuário cadastrado neste filtro.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((item) => {
                  const statusUser = item.status || 'aprovado';
                  const isPendente = statusUser === 'pendente';
                  const isDesativado = statusUser === 'desativado';
                  const isAprovado = statusUser === 'aprovado' || statusUser === 'ativo';

                  const deptOficial = normalizarDepartamento(item.departamento);
                  const nivelOficial = normalizarNivelUsuario(item.nivel);

                  const isItemGestor = nivelOficial === 'Gestor';
                  const isItemAssistente = nivelOficial === 'Assistente';

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isPendente ? 'bg-amber-500/5' : isDesativado ? 'opacity-60 bg-slate-950/40' : ''
                      }`}
                    >
                      {/* 1. Nome do Usuário e E-mail */}
                      <td className="py-3 px-4 font-semibold text-white">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                              isItemGestor
                                ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                                : isItemAssistente
                                ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                                : 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                            }`}
                          >
                            {isItemGestor ? (
                              <ShieldCheck className="w-4 h-4" />
                            ) : isItemAssistente ? (
                              <Briefcase className="w-4 h-4" />
                            ) : (
                              <User className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="break-words">{item.nome}</span>
                              {item.id === currentUser?.id && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                  Você
                                </span>
                              )}
                            </div>
                            {item.email ? (
                              <div className="text-[11px] font-mono text-slate-400 mt-0.5 break-all flex items-center gap-1">
                                <Mail className="w-3 h-3 text-sky-400 shrink-0" />
                                <span>{item.email}</span>
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-500 italic mt-0.5">
                                E-mail não informado
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Código */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-300">
                        {item.codigo || '-'}
                      </td>

                      {/* 3. Unidade de Negócio */}
                      <td className="py-3 px-4 text-slate-300">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium">
                          <Building2 className="w-3 h-3 text-blue-400" />
                          {item.unidade_negocio || 'Goiânia'}
                        </span>
                      </td>

                      {/* 4. Departamento (Somente 3 departamentos) */}
                      <td className="py-3 px-4 text-slate-300">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                            deptOficial === 'Logística'
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                              : deptOficial === 'Comercial'
                              ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                              : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          }`}
                        >
                          {deptOficial}
                        </span>
                      </td>

                      {/* 5. Função */}
                      <td className="py-3 px-4 text-slate-300 font-medium">
                        {item.funcao || 'Operador Logístico'}
                      </td>

                      {/* 6. Nível (Operador, Assistente, Gestor) */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            isItemGestor
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                              : isItemAssistente
                              ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {isItemGestor ? (
                            <ShieldCheck className="w-3 h-3" />
                          ) : isItemAssistente ? (
                            <Shield className="w-3 h-3 text-sky-400" />
                          ) : (
                            <User className="w-3 h-3 text-slate-400" />
                          )}
                          {nivelOficial}
                        </span>
                      </td>

                      {/* 7. Status */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          {isPendente && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/40 animate-pulse">
                              <Clock className="w-3.5 h-3.5" />
                              Pendente de aprovação
                            </span>
                          )}
                          {isAprovado && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Aprovado
                            </span>
                          )}
                          {isDesativado && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                              <XCircle className="w-3.5 h-3.5" />
                              Desativado
                            </span>
                          )}

                          {item.exigir_troca_senha && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs"
                              title="Alteração obrigatória de senha solicitada pelo gestor. O usuário deverá cadastrar uma nova senha no próximo acesso."
                            >
                              <KeyRound className="w-3 h-3 text-amber-400 shrink-0" />
                              <span>Troca de Senha Pendente</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 8. Ações */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Ação para Pendente: Abrir Modal de Aprovação para selecionar Depto, Função e Nível */}
                          {isPendente && (
                            <button
                              type="button"
                              id={`btn-aprovar-${item.id}`}
                              onClick={() => handleOpenAprovar(item)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-900/30 transition min-h-[36px]"
                              title="Aprovar e Definir Departamento/Função/Nível"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Aprovar</span>
                            </button>
                          )}

                          {/* Reativar se desativado */}
                          {isDesativado && (
                            <button
                              type="button"
                              id={`btn-reativar-${item.id}`}
                              onClick={() => handleReativar(item)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-bold transition min-h-[36px]"
                              title="Reativar Acesso do Usuário"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Reativar</span>
                            </button>
                          )}

                          {/* Desativar se aprovado (mantém dados no banco) */}
                          {isAprovado && (
                            <button
                              type="button"
                              id={`btn-desativar-${item.id}`}
                              onClick={() => setDeactivatingUser(item)}
                              className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-amber-400 hover:border-amber-500/40 transition min-h-[36px]"
                              title="Desativar Acesso do Usuário"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Solicitar Alteração de Senha (somente para Gestores) */}
                          {isGestor && (
                            <button
                              type="button"
                              id={`btn-solicitar-senha-${item.id}`}
                              onClick={() =>
                                setConfirmingTrocaSenhaUser({
                                  user: item,
                                  exigir: !item.exigir_troca_senha,
                                })
                              }
                              className={`p-2 rounded-lg border transition min-h-[36px] cursor-pointer ${
                                item.exigir_troca_senha
                                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30 shadow-xs shadow-amber-500/10'
                                  : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-amber-400 hover:border-amber-500/40'
                              }`}
                              title={
                                item.exigir_troca_senha
                                  ? 'Cancelar solicitação de alteração de senha'
                                  : 'Solicitar alteração obrigatória de senha no próximo acesso'
                              }
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Ver Detalhes do Usuário (e-mail com opção de cópia e cola, permissões e cadastro) */}
                          <button
                            type="button"
                            id={`btn-detalhes-usr-${item.id}`}
                            onClick={() => {
                              setSelectedUserForDetails(item);
                              setCopiedEmail(false);
                              setCopiedCodigo(false);
                            }}
                            className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-sky-400 hover:border-sky-500/40 transition min-h-[36px] cursor-pointer"
                            title="Exibir detalhes do usuário (e-mail, dados e permissões)"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Editar dados (somente Gestor) */}
                          <button
                            type="button"
                            id={`btn-edit-usr-${item.id}`}
                            onClick={() => handleOpenEdit(item)}
                            className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-purple-400 hover:border-purple-500/40 transition min-h-[36px]"
                            title="Editar Perfil do Usuário"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-950/60 border-t border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
          <span>
            Total de usuários: <strong className="text-white">{filteredUsers.length}</strong>
          </span>
          <div className="flex items-center gap-4 text-slate-500">
            <span>Departamentos unificados: <strong className="text-slate-300">Logística, Comercial, Financeiro</strong></span>
            <span>Tabela Supabase: <code className="font-mono text-sky-300">public.usuarios</code></span>
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/* MODAL 1: APROVAÇÃO DE USUÁRIO PENDENTE (Gestor define Dpto/Função/Nível) */}
      {/* ============================================================= */}
      {approvingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Aprovar Cadastro de Usuário</h3>
                  <p className="text-xs text-slate-400">
                    Defina o departamento, função e nível para liberar o acesso.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApprovingUser(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Resumo do Usuário */}
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Colaborador:</span>
                <strong className="text-white">{approvingUser.nome}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Código Gerado:</span>
                <span className="text-sky-400 font-mono font-bold">{approvingUser.codigo || '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Unidade de Negócio:</span>
                <span className="text-slate-300 font-medium">{approvingUser.unidade_negocio || 'Goiânia'}</span>
              </div>
            </div>

            {approvalError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{approvalError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmarAprovacao} className="space-y-4 text-left">
              {/* Padronização de Nome e Sobrenome (Item 6) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-300">
                      Primeiro Nome <span className="text-rose-400">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {approvalPrimeiroNome.length}/12
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={12}
                    value={approvalPrimeiroNome}
                    onChange={(e) => setApprovalPrimeiroNome(formatarParteNome(e.target.value))}
                    onBlur={(e) => setApprovalPrimeiroNome(formatarParteNome(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500 transition min-h-[40px]"
                    placeholder="Ex: Carlos"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-300">
                      Sobrenome <span className="text-rose-400">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {approvalSobrenome.length}/12
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={12}
                    value={approvalSobrenome}
                    onChange={(e) => setApprovalSobrenome(formatarParteNome(e.target.value))}
                    onBlur={(e) => setApprovalSobrenome(formatarParteNome(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500 transition min-h-[40px]"
                    placeholder="Ex: Eduardo"
                  />
                </div>
              </div>

              {/* 1. Departamento */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  1. Departamento <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {DEPARTAMENTOS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handleApprovalDeptChange(d)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 ${
                        approvalDept === d
                          ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Building className="w-4 h-4" />
                      <span>{d}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Função (Filtrada pelo Departamento) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  2. Função Permitida <span className="text-rose-400">*</span>
                </label>
                <select
                  value={approvalFuncao}
                  onChange={(e) => setApprovalFuncao(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 transition min-h-[44px]"
                >
                  {(FUNCOES_POR_DEPARTAMENTO[approvalDept] || []).map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Funções disponíveis para o departamento <strong>{approvalDept}</strong>.
                </p>
              </div>

              {/* 3. Nível (Operador, Assistente, Gestor) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  3. Nível de Permissão <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {NIVEIS_USUARIO.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setApprovalNivel(n)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 ${
                        approvalNivel === n
                          ? n === 'Gestor'
                            ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-900/30'
                            : n === 'Assistente'
                            ? 'bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-900/30'
                            : 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-900/30'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {n === 'Gestor' ? (
                        <ShieldCheck className="w-4 h-4" />
                      ) : n === 'Assistente' ? (
                        <Shield className="w-4 h-4" />
                      ) : (
                        <User className="w-4 h-4" />
                      )}
                      <span>{n}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Validação de combinação */}
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  isApprovalValid
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}
              >
                {isApprovalValid ? (
                  <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                )}
                <span>
                  {isApprovalValid
                    ? `Combinação válida: ${approvalDept} • ${approvalFuncao} • Nível ${approvalNivel}`
                    : 'Combinação inválida. Selecione uma função e nível correspondentes.'}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setApprovingUser(null)}
                  disabled={savingApproval}
                  className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!isApprovalValid || savingApproval}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white shadow-lg shadow-emerald-900/40 transition min-h-[44px] cursor-pointer"
                >
                  {savingApproval && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Aprovar e Ativar Usuário</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 2: EDITAR USUÁRIO (Somente Gestor) */}
      {/* ============================================================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Editar Usuário</h3>
                  <p className="text-xs text-slate-400">Atualização cadastral e permissões</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-300">
                      Primeiro Nome <span className="text-rose-400">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {editPrimeiroNome.length}/12
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={12}
                    value={editPrimeiroNome}
                    onChange={(e) => setEditPrimeiroNome(formatarParteNome(e.target.value))}
                    onBlur={(e) => setEditPrimeiroNome(formatarParteNome(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-purple-500 transition min-h-[44px]"
                    placeholder="Ex: Carlos"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-300">
                      Sobrenome <span className="text-rose-400">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {editSobrenome.length}/12
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={12}
                    value={editSobrenome}
                    onChange={(e) => setEditSobrenome(formatarParteNome(e.target.value))}
                    onBlur={(e) => setEditSobrenome(formatarParteNome(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-purple-500 transition min-h-[44px]"
                    placeholder="Ex: Eduardo"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Código do Operador / Gestor
                </label>
                <input
                  type="text"
                  value={editForm.codigo}
                  onChange={(e) => setEditForm({ ...editForm, codigo: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white font-mono uppercase focus:outline-none focus:border-purple-500 transition min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Endereço de E-mail / Login
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="exemplo@polifiltro.com.br"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-purple-500 transition min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Unidade de Negócio <span className="text-rose-400">*</span>
                </label>
                <select
                  value={editForm.unidade_negocio}
                  onChange={(e) => setEditForm({ ...editForm, unidade_negocio: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-purple-500 transition min-h-[44px]"
                >
                  {unidadesList.map((u) => (
                    <option key={u.id} value={u.nome}>
                      {u.nome} {u.sigla ? `(${u.sigla})` : ''} {u.estado ? `- ${u.estado}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Departamento (3 opções oficiais) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Departamento <span className="text-rose-400">*</span>
                </label>
                <select
                  value={editForm.departamento}
                  onChange={(e) => handleEditDeptChange(e.target.value as Departamento)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-purple-500 transition min-h-[44px]"
                >
                  {DEPARTAMENTOS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Função (Filtrada pelo Departamento) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Função / Cargo <span className="text-rose-400">*</span>
                </label>
                <select
                  value={editForm.funcao}
                  onChange={(e) => setEditForm({ ...editForm, funcao: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-purple-500 transition min-h-[44px]"
                >
                  {(FUNCOES_POR_DEPARTAMENTO[editForm.departamento] || []).map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nível (Operador, Assistente, Gestor) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-300">
                    Nível de Permissão <span className="text-rose-400">*</span>
                  </label>
                  {isEditingSelf && (
                    <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Próprio nível bloqueado
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {NIVEIS_USUARIO.map((n) => {
                    const isSelected = editForm.nivel === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        disabled={isEditingSelf}
                        onClick={() => setEditForm({ ...editForm, nivel: n })}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 ${
                          isEditingSelf
                            ? isSelected
                              ? 'bg-slate-800 border-purple-500/60 text-purple-300 opacity-90 cursor-not-allowed'
                              : 'bg-slate-950 border-slate-800 text-slate-600 opacity-40 cursor-not-allowed'
                            : isSelected
                            ? n === 'Gestor'
                              ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-900/30'
                              : n === 'Assistente'
                              ? 'bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-900/30'
                              : 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {n === 'Gestor' ? (
                          <ShieldCheck className="w-4 h-4" />
                        ) : n === 'Assistente' ? (
                          <Shield className="w-4 h-4" />
                        ) : (
                          <User className="w-4 h-4" />
                        )}
                        <span>{n}</span>
                      </button>
                    );
                  })}
                </div>
                {isEditingSelf && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Regra: o usuário não pode alterar o próprio nível. Somente outro gestor pode alterá-lo.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  disabled={savingEdit}
                  className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!isEditValid || savingEdit}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white shadow-lg shadow-purple-900/40 transition min-h-[44px] cursor-pointer"
                >
                  {savingEdit && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 3: CONFIRMAÇÃO DE DESATIVAÇÃO (Sem excluir registros) */}
      {/* ============================================================= */}
      {deactivatingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <UserX className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">Desativar Acesso?</h3>
              <p className="text-xs text-slate-400">
                O usuário <strong className="text-white">{deactivatingUser.nome}</strong> ({deactivatingUser.codigo || 'sem código'}) perderá o acesso ao sistema PoliHub.
              </p>
              <p className="text-[11px] text-slate-500 mt-2">
                O histórico de alterações e cadastros realizados por ele será mantido intacto. Você poderá reativá-lo a qualquer momento.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeactivatingUser(null)}
                disabled={processingStatus}
                className="flex-1 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition min-h-[44px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarDesativacao}
                disabled={processingStatus}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white shadow-lg shadow-amber-900/30 transition min-h-[44px]"
              >
                {processingStatus ? 'Desativando...' : 'Sim, Desativar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 4: DETALHES COMPLETOS DO USUÁRIO (E-MAIL COM CÓPIA)     */}
      {/* ============================================================= */}
      {selectedUserForDetails && (() => {
        const u = selectedUserForDetails;
        const statusUser = u.status || 'aprovado';
        const isPendente = statusUser === 'pendente';
        const isDesativado = statusUser === 'desativado';
        const isAprovado = statusUser === 'aprovado' || statusUser === 'ativo';

        const deptOficial = normalizarDepartamento(u.departamento);
        const nivelOficial = normalizarNivelUsuario(u.nivel);
        const isItemGestor = nivelOficial === 'Gestor';
        const isItemAssistente = nivelOficial === 'Assistente';

        const emailExibicao =
          u.email ||
          usuariosService.getEmailCache(u.id) ||
          (u.id === currentUser?.id ? currentUser?.email : null) ||
          'Não informado no Supabase Auth';

        const temEmailReal = Boolean(emailExibicao && emailExibicao.includes('@'));

        const formatarDataHora = (dataStr?: string | null) => {
          if (!dataStr) return 'Não registrada';
          try {
            const d = new Date(dataStr);
            if (isNaN(d.getTime())) return dataStr;
            return d.toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
          } catch {
            return dataStr;
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-5 sm:p-6 space-y-5 text-left max-h-[90vh] overflow-y-auto">
              {/* Cabeçalho do Modal */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border shadow-lg ${
                      isItemGestor
                        ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-purple-900/20'
                        : isItemAssistente
                        ? 'bg-sky-500/20 border-sky-500/40 text-sky-300 shadow-sky-900/20'
                        : 'bg-blue-500/20 border-blue-500/40 text-blue-300 shadow-blue-900/20'
                    }`}
                  >
                    {isItemGestor ? (
                      <ShieldCheck className="w-5 h-5" />
                    ) : isItemAssistente ? (
                      <Briefcase className="w-5 h-5" />
                    ) : (
                      <User className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-black text-white">{u.nome}</h3>
                      {u.id === currentUser?.id && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          Você
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-slate-400">{u.funcao || 'Operador Logístico'}</span>
                      <span className="text-slate-600 font-bold">·</span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.2 rounded-full border ${
                          isPendente
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                            : isDesativado
                            ? 'bg-slate-800 text-slate-400 border-slate-700'
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        }`}
                      >
                        {isPendente ? 'Pendente' : isDesativado ? 'Desativado' : 'Aprovado'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  id="btn-fechar-detalhes-usuario"
                  onClick={() => setSelectedUserForDetails(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                  title="Fechar detalhes"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* BLOCO PRINCIPAL: ENDEREÇO DE E-MAIL COM OPÇÃO DE COPIA E COLA */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-950/50 via-slate-950 to-slate-900 border border-sky-500/30 shadow-md">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400 uppercase tracking-wider">
                    <Mail className="w-4 h-4 text-sky-400" />
                    <span>Endereço de E-mail / Login</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {temEmailReal && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-400" />
                        Supabase Auth
                      </span>
                    )}
                    {copiedEmail ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-lg border border-emerald-500/40 animate-in fade-in">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Copiado!
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-sm sm:text-base font-bold text-white break-all select-all">
                      {emailExibicao}
                    </span>
                  </div>

                  <button
                    type="button"
                    id="btn-copiar-email-usuario"
                    onClick={() => handleCopyEmail(emailExibicao)}
                    className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 shadow-md cursor-pointer ${
                      copiedEmail
                        ? 'bg-emerald-600 text-white border border-emerald-500'
                        : 'bg-sky-600 hover:bg-sky-500 active:scale-95 text-white shadow-sky-900/30'
                    }`}
                    title="Copiar endereço de e-mail para a área de transferência"
                  >
                    {copiedEmail ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>E-mail Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copiar e-mail</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Utilize o botão acima para copiar o e-mail e colar diretamente em mensagens, formulários ou comunicações.
                </p>
              </div>

              {/* Alerta de Troca de Senha Obrigatória Pendente */}
              {u.exigir_troca_senha && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-amber-300 block">Alteração Obrigatória de Senha Pendente</span>
                      <span className="text-[11px] text-amber-400/80">O usuário deverá cadastrar uma nova senha no próximo acesso ao PoliHUB.</span>
                    </div>
                  </div>

                  {isGestor && (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingTrocaSenhaUser({ user: u, exigir: false });
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 text-xs font-bold transition whitespace-nowrap cursor-pointer shrink-0"
                      title="Cancelar a solicitação de troca de senha"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              )}

              {/* GRID COM DETALHES COMPLEMENTARES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Código */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="font-semibold uppercase text-[10px] tracking-wider">Código de Acesso</span>
                    {u.codigo && (
                      <button
                        type="button"
                        onClick={() => handleCopyCodigo(u.codigo!)}
                        className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                        title="Copiar código"
                      >
                        {copiedCodigo ? (
                          <span className="text-[10px] text-emerald-400 font-bold">Copiado</span>
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                  <span className="font-mono font-bold text-white text-sm">
                    {u.codigo || 'Não informado'}
                  </span>
                </div>

                {/* Unidade de Negócio */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="block text-slate-400 font-semibold uppercase text-[10px] tracking-wider mb-1">
                    Unidade de Negócio
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 font-medium">
                    <Building2 className="w-3 h-3 text-blue-400" />
                    {u.unidade_negocio || 'Goiânia'}
                  </span>
                </div>

                {/* Departamento */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="block text-slate-400 font-semibold uppercase text-[10px] tracking-wider mb-1">
                    Departamento
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold ${
                      deptOficial === 'Logística'
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        : deptOficial === 'Comercial'
                        ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                        : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                    }`}
                  >
                    {deptOficial}
                  </span>
                </div>

                {/* Nível de Permissão */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="block text-slate-400 font-semibold uppercase text-[10px] tracking-wider mb-1">
                    Nível Hierárquico
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold border ${
                      isItemGestor
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        : isItemAssistente
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {isItemGestor ? (
                      <ShieldCheck className="w-3 h-3" />
                    ) : isItemAssistente ? (
                      <Briefcase className="w-3 h-3" />
                    ) : (
                      <User className="w-3 h-3" />
                    )}
                    {nivelOficial}
                  </span>
                </div>

                {/* PIN Operacional */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="block text-slate-400 font-semibold uppercase text-[10px] tracking-wider mb-1">
                    PIN Operacional
                  </span>
                  <span className="text-slate-300 font-medium">
                    {u.pin ? '•••• (PIN 4 dígitos ativo)' : 'Não cadastrado'}
                  </span>
                </div>

                {/* Data de Cadastro */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="block text-slate-400 font-semibold uppercase text-[10px] tracking-wider mb-1">
                    Data de Cadastro
                  </span>
                  <span className="text-slate-300 font-medium">
                    {formatarDataHora(u.created_at)}
                  </span>
                </div>
              </div>

              {/* Sumário de Permissões Baseadas no Nível */}
              <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800/80 text-xs">
                <span className="font-bold text-slate-300 block mb-1">
                  Permissões do Perfil ({nivelOficial}):
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {isItemGestor ? (
                    'Acesso administrativo total: aprovação e edição de usuários, relatórios, cadastros mestres, cancelamentos e gestão integral.'
                  ) : isItemAssistente ? (
                    'Acesso operacional avançado: subida de XML de Notas Fiscais em Agendamentos, confirmação de alterações de alocação, gerenciamento de Pedidos, controle de Veículos e Auditoria de Contagens de Inventário.'
                  ) : (
                    'Acesso operacional padrão: recebimento físico de mercadorias, conferência de produtos, apontamento de contagens e movimentações de estoque.'
                  )}
                </p>
              </div>

              {/* Rodapé com botões de ação */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedUserForDetails(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition min-h-[42px] cursor-pointer"
                >
                  Fechar
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyEmail(emailExibicao)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-md shadow-sky-900/30 min-h-[42px] cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar E-mail</span>
                  </button>

                  {isGestor && !u.exigir_troca_senha && (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingTrocaSenhaUser({ user: u, exigir: true });
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold transition min-h-[42px] cursor-pointer"
                      title="Exigir cadastro de nova senha no próximo login do usuário"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                      <span>Solicitar Senha</span>
                    </button>
                  )}

                  {isGestor && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedUserForDetails;
                        setSelectedUserForDetails(null);
                        handleOpenEdit(target);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-md shadow-purple-900/30 min-h-[42px] cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Editar Perfil</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================= */}
      {/* MODAL 5: CONFIRMAÇÃO DE SOLICITAÇÃO/CANCELAMENTO DE SENHA     */}
      {/* ============================================================= */}
      {confirmingTrocaSenhaUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-5 text-left">
            <div className="flex items-start gap-3.5">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                  confirmingTrocaSenhaUser.exigir
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                    : 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                }`}
              >
                <KeyRound className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-black text-white">
                  {confirmingTrocaSenhaUser.exigir
                    ? 'Solicitar Alteração de Senha'
                    : 'Cancelar Solicitação de Senha'}
                </h3>
                <p className="text-xs text-slate-400">
                  {confirmingTrocaSenhaUser.exigir
                    ? `Deseja exigir que o usuário "${confirmingTrocaSenhaUser.user.nome}" cadastre uma nova senha no próximo acesso?`
                    : `Deseja cancelar a exigência de troca de senha para "${confirmingTrocaSenhaUser.user.nome}"?`}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 space-y-1.5">
              {confirmingTrocaSenhaUser.exigir ? (
                <>
                  <p className="text-amber-300 font-medium">
                    Ao confirmar, no próximo login do usuário, o sistema abrirá automaticamente a tela bloqueante exigindo a nova senha e sua confirmação.
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    Mensagem que será exibida para o operador: <em>“Por segurança, seu gestor solicitou a alteração da sua senha. Cadastre uma nova senha para continuar.”</em>
                  </p>
                </>
              ) : (
                <p className="text-slate-300">
                  O usuário poderá continuar acessando o sistema normalmente utilizando a senha atual cadastrada.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={togglingTrocaSenha}
                onClick={() => setConfirmingTrocaSenhaUser(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-400 hover:text-white transition min-h-[42px] cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                id="btn-confirmar-acao-troca-senha"
                disabled={togglingTrocaSenha}
                onClick={() =>
                  handleToggleExigirTrocaSenha(
                    confirmingTrocaSenhaUser.user,
                    confirmingTrocaSenhaUser.exigir
                  )
                }
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-lg min-h-[42px] cursor-pointer ${
                  confirmingTrocaSenhaUser.exigir
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-950/40'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40'
                }`}
              >
                {togglingTrocaSenha ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {confirmingTrocaSenhaUser.exigir
                        ? 'Confirmar Solicitação'
                        : 'Confirmar Cancelamento'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SQL Script Modal */}
      <SqlScriptModal
        isOpen={sqlModalOpen}
        onClose={() => setSqlModalOpen(false)}
        defaultTab="usuarios"
      />
    </div>
  );
};
