import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  User,
  RefreshCw,
  Search,
  AlertCircle,
  HelpCircle,
  Check,
  Copy,
  Lock,
} from 'lucide-react';
import { AlteracaoEndereco, Usuario } from '../../types';
import { alocacaoService, compararAlteracoesPorStatus } from '../../services/alocacaoService';
import { usuariosService } from '../../services/usuariosService';
import { useAuth } from '../../context/AuthContext';
import { useSessaoOperacional } from '../../context/SessaoOperacionalContext';
import { podeConfirmarAlteracaoEndereco } from '../../utils/permissoes';

interface GerirAlteracoesViewProps {
  onVoltar: () => void;
}

export const GerirAlteracoesView: React.FC<GerirAlteracoesViewProps> = ({ onVoltar }) => {
  const { user } = useAuth();
  const { operador } = useSessaoOperacional();
  const [alteracoes, setAlteracoes] = useState<AlteracaoEndereco[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendente' | 'concluido'>('todos');
  const [busca, setBusca] = useState('');
  const [confirmandoItem, setConfirmandoItem] = useState<AlteracaoEndereco | null>(null);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiadoCampo, setCopiadoCampo] = useState<string | null>(null);

  // Carregar lista de usuários para resolver nomes amigáveis
  useEffect(() => {
    async function carregarUsuarios() {
      try {
        const lista = await usuariosService.listarTodos();
        setUsuarios(lista);
      } catch (err) {
        console.warn('Erro ao carregar usuários para resolução de nomes:', err);
      }
    }
    carregarUsuarios();
  }, []);

  const carregarAlteracoes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await alocacaoService.listarAlteracoesEndereco({
        status: statusFilter,
        busca: busca.trim() || undefined,
      });
      setAlteracoes([...data].sort(compararAlteracoesPorStatus));
    } catch (err) {
      console.error('Erro ao carregar alterações:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, busca]);

  useEffect(() => {
    carregarAlteracoes();
  }, [carregarAlteracoes]);

  useEffect(() => {
    const handleRefresh = () => {
      carregarAlteracoes();
    };
    window.addEventListener('polihub_alteracoes_refresh', handleRefresh);
    return () => window.removeEventListener('polihub_alteracoes_refresh', handleRefresh);
  }, [carregarAlteracoes]);

  // Função para copiar texto para a área de transferência com feedback
  const copiarParaTransferencia = async (texto: string, campoId: string) => {
    if (!texto) return;
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
      setCopiadoCampo(campoId);
      setTimeout(() => {
        setCopiadoCampo((curr) => (curr === campoId ? null : curr));
      }, 2500);
    } catch (err) {
      console.warn('Erro ao copiar para a área de transferência:', err);
    }
  };

  // Resolução amigável do solicitante (nunca exibir chave id ou UUID bruta)
  const resolverNomeSolicitante = (item: AlteracaoEndereco) => {
    // 1. Se foi o usuário atualmente logado
    if (user && (user.id === item.usuario_alteracao || user.codigo === item.usuario_alteracao)) {
      return { nome: user.nome, codigo: user.codigo };
    }

    // 2. Se encontrar na lista de usuários cadastrados
    const encontrado = usuarios.find(
      (u) =>
        u.id === item.usuario_alteracao ||
        u.codigo?.toUpperCase() === item.usuario_alteracao?.toUpperCase()
    );
    if (encontrado) {
      return { nome: encontrado.nome, codigo: encontrado.codigo };
    }

    // 3. Mapeamentos conhecidos de IDs padrão
    if (item.usuario_alteracao === 'OP-1042' || item.usuario_alteracao === 'usr-default-01') {
      return { nome: 'Luiz Fernando', codigo: 'OP-1042' };
    }
    if (item.usuario_alteracao === 'GS-2005' || item.usuario_alteracao === 'usr-default-02') {
      return { nome: 'Mariana Silva (Gestora)', codigo: 'GS-2005' };
    }

    // 4. Se o item já possuir um nome que não seja o próprio ID nem UUID
    if (
      item.usuario_nome &&
      item.usuario_nome !== item.usuario_alteracao &&
      !item.usuario_nome.startsWith('usr-') &&
      !item.usuario_nome.includes('-')
    ) {
      return { nome: item.usuario_nome, codigo: item.usuario_codigo };
    }

    // 5. Fallback amigável sem chave técnica bruta
    return {
      nome: 'Operador Responsável',
      codigo: item.usuario_codigo || (item.usuario_alteracao?.startsWith('OP-') ? item.usuario_alteracao : undefined),
    };
  };

  // Resolução amigável do usuário de confirmação no sistema
  const resolverNomeConfirmador = (item: AlteracaoEndereco) => {
    // 1. Se foi confirmado na sessão atual pelo usuário logado ou operador
    if (user && item.usuario_confirmacao === user.id) {
      return { nome: user.nome, codigo: user.codigo };
    }
    if (operador && item.usuario_confirmacao === operador.id) {
      return { nome: operador.nome, codigo: operador.codigo };
    }

    // 2. Se encontrar na lista de usuários cadastrados
    if (item.usuario_confirmacao) {
      const encontrado = usuarios.find(
        (u) =>
          u.id === item.usuario_confirmacao ||
          u.codigo?.toUpperCase() === item.usuario_confirmacao?.toUpperCase()
      );
      if (encontrado) {
        return { nome: encontrado.nome, codigo: encontrado.codigo };
      }
    }

    // 3. Mapeamentos conhecidos
    if (item.usuario_confirmacao === 'OP-1042' || item.usuario_confirmacao === 'usr-default-01') {
      return { nome: 'Luiz Fernando', codigo: 'OP-1042' };
    }
    if (item.usuario_confirmacao === 'GS-2005' || item.usuario_confirmacao === 'usr-default-02') {
      return { nome: 'Mariana Silva (Gestora)', codigo: 'GS-2005' };
    }

    // 4. Se o item já possuir um nome válido
    if (
      item.usuario_confirmacao_nome &&
      item.usuario_confirmacao_nome !== item.usuario_confirmacao &&
      !item.usuario_confirmacao_nome.startsWith('usr-')
    ) {
      return { nome: item.usuario_confirmacao_nome };
    }

    // 5. Fallback amigável
    return {
      nome: item.usuario_confirmacao_nome || 'Gestor / Assist. Logístico',
    };
  };

  // Resolver perfil completo do operador operacional se houver
  const operadorCompleto = operador
    ? usuarios.find((u) => u.id === operador.id || u.codigo === operador.codigo) || null
    : null;

  const podeConfirmar =
    podeConfirmarAlteracaoEndereco(user) ||
    podeConfirmarAlteracaoEndereco(operadorCompleto);

  // Ordenação do menu gerir alterações: pendentes primeiro, depois confirmados
  const alteracoesOrdenadas = React.useMemo(() => {
    return [...alteracoes].sort(compararAlteracoesPorStatus);
  }, [alteracoes]);

  const handleConfirmarNoSistema = async () => {
    if (!confirmandoItem) return;

    if (!podeConfirmar) {
      alert(
        'Acesso negado: Somente usuários com nível "gestor" ou função "Assistente Logístico" possuem permissão para confirmar a alteração no sistema.'
      );
      return;
    }

    try {
      setSaving(true);
      const confirmador = podeConfirmarAlteracaoEndereco(operadorCompleto)
        ? (operadorCompleto || user)
        : user;
      const alteracaoConfirmada = await alocacaoService.confirmarAlteracaoSistema(
        confirmandoItem.id,
        confirmador
      );

      const nomeConfirmador =
        confirmador?.nome ||
        (confirmador && 'funcao' in confirmador && confirmador.funcao) ||
        user?.nome ||
        'Gestor / Assistente Logístico';

      // Atualização imediata no estado local do componente para refletir Concluído na hora e reordenar
      setAlteracoes((prev) =>
        prev
          .map((a) =>
            String(a.id) === String(confirmandoItem.id)
              ? {
                  ...a,
                  ...alteracaoConfirmada,
                  alterado_sistema: true,
                  usuario_confirmacao: confirmador?.id || user?.id || null,
                  usuario_confirmacao_nome: nomeConfirmador,
                  data_confirmacao: new Date().toISOString(),
                }
              : a
          )
          .sort(compararAlteracoesPorStatus)
      );

      setToastMessage(`Alteração de ${confirmandoItem.produto} confirmada no sistema oficial!`);
      setTimeout(() => setToastMessage(null), 3500);

      setConfirmandoItem(null);
      await carregarAlteracoes();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao confirmar alteração.';
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const totalPendentes = alteracoes.filter((a) => !a.alterado_sistema).length;

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-24 md:pb-12">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl bg-emerald-600 text-white px-5 py-3 text-xs sm:text-sm font-semibold shadow-2xl border border-emerald-400/40 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Bar with Back Button */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onVoltar}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar a Alocar Produtos</span>
        </button>

        <button
          type="button"
          onClick={carregarAlteracoes}
          disabled={loading}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition min-h-[44px]"
          title="Recarregar alterações"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Header do Módulo: Gerir Alterações */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {podeConfirmar ? (
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Acesso Autorizado para Confirmação ({operadorCompleto?.funcao || user?.funcao || user?.nivel})</span>
                </span>
              ) : (
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Modo Visualização (Confirmação restrita a Gestor / Assistente Logístico)</span>
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Gerir Alterações de Endereço
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Confirme para o sistema da empresa quais alterações de estoque já foram devidamente processadas.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl px-4 py-2.5 text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Pendentes de Confirmação
              </span>
              <span className="text-xl font-black font-mono text-amber-400">
                {totalPendentes}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por produto ou endereço..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 min-h-[44px]"
          />
        </div>

        {/* Tabs de Status */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(['todos', 'pendente', 'concluido'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap min-h-[44px] ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                  : 'bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {st === 'todos' ? 'Todas' : st === 'pendente' ? 'Pendentes' : 'Concluídas'}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Alterações */}
      {loading ? (
        <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-3xl">
          <RefreshCw className="w-6 h-6 text-blue-400 animate-spin mx-auto mb-2" />
          <span className="text-xs text-slate-400">Carregando histórico de alterações...</span>
        </div>
      ) : alteracoes.length === 0 ? (
        <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-3xl space-y-2">
          <Clock className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-white">Nenhum registro de alteração de endereço encontrado.</p>
          <p className="text-xs text-slate-400">
            As alterações geradas pelos operadores no módulo Alocação serão listadas aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alteracoesOrdenadas.map((item) => {
            const isPendente = !item.alterado_sistema;
            const dataFormatada = new Date(item.data).toLocaleString('pt-BR');

            return (
              <div
                key={item.id}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-2.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status Badge */}
                    {isPendente ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        <Clock className="w-3.5 h-3.5" />
                        Pendente no Sistema Oficial
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Concluído no Sistema
                      </span>
                    )}

                    <span className="text-[11px] font-mono text-slate-400">{dataFormatada}</span>
                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${
                        item.tipo_alteracao === 'Recebimento NF'
                          ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                          : item.tipo_alteracao === 'Avulsa'
                          ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {item.tipo_alteracao}
                    </span>
                  </div>

                  {/* Nome do Produto */}
                  <div className="flex items-start gap-2">
                    <Package className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <h4 className="text-sm font-bold text-white break-words">{item.produto}</h4>
                  </div>

                  {/* Transição de Endereço */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-slate-400">Movimentação:</span>
                    <span className="font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-rose-300 line-through">
                      {item.endereco_antigo}
                    </span>
                    <span className="text-slate-500">➔</span>
                    <span className="font-mono font-bold px-2 py-0.5 rounded bg-sky-950/80 border border-sky-800/40 text-sky-300">
                      {item.endereco_novo}
                    </span>
                  </div>

                  {/* Usuário da alteração: exibe o nome amigável ao invés da chave ID */}
                  {(() => {
                    const solicitante = resolverNomeSolicitante(item);
                    return (
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          Solicitado por: <strong className="text-slate-200">{solicitante.nome}</strong>
                          {solicitante.codigo && <span className="text-slate-400 font-mono"> ({solicitante.codigo})</span>}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Botão de Ação para Gestor ou Assistente Logístico */}
                <div className="pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800 shrink-0">
                  {isPendente ? (
                    podeConfirmar ? (
                      <button
                        type="button"
                        id={`btn-confirmar-alt-${item.id}`}
                        onClick={() => setConfirmandoItem(item)}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition min-h-[44px]"
                      >
                        <Check className="w-4 h-4" />
                        <span>CONFIRMAR ALTERAÇÃO</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        id={`btn-confirmar-alt-${item.id}-disabled`}
                        disabled
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800/80 text-slate-500 border border-slate-700/50 text-xs font-semibold cursor-not-allowed min-h-[44px]"
                        title="Apenas usuários com nível 'gestor' ou função 'Assistente Logístico' podem confirmar alterações no sistema."
                      >
                        <Lock className="w-3.5 h-3.5 text-slate-500" />
                        <span>Confirmação Restrita (Gestor / Assist. Logístico)</span>
                      </button>
                    )
                  ) : (
                    <div className="flex flex-col items-start lg:items-end gap-1 px-2 py-1">
                      <div className="text-xs text-emerald-400 flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Confirmada no Sistema</span>
                      </div>
                      {(() => {
                        const confirmador = resolverNomeConfirmador(item);
                        return (
                          <div className="text-[11px] text-slate-300 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>
                              Confirmado por: <strong className="text-white font-semibold">{confirmador.nome}</strong>
                              {confirmador.codigo && (
                                <span className="text-slate-400 font-mono"> ({confirmador.codigo})</span>
                              )}
                            </span>
                          </div>
                        );
                      })()}
                      {item.data_confirmacao && (
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{new Date(item.data_confirmacao).toLocaleString('pt-BR')}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Confirmação da Alteração no Sistema Oficial */}
      {confirmandoItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Confirmar Alteração no Sistema
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Validação por Gestor ou Assistente Logístico
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
              {/* Produto com Botão de Copiar */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Produto
                </span>
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
                  <span className="text-white font-bold text-xs sm:text-sm break-words flex-1">
                    {confirmandoItem.produto}
                  </span>
                  <button
                    type="button"
                    id="btn-copiar-produto-sistema"
                    onClick={() => copiarParaTransferencia(confirmandoItem.produto, 'confirmar-produto')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition shrink-0 min-h-[38px] ${
                      copiadoCampo === 'confirmar-produto'
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200 hover:text-white'
                    }`}
                    title="Copiar produto"
                  >
                    {copiadoCampo === 'confirmar-produto' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Endereço com Botão de Copiar */}
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Endereço
                </span>
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
                  <div className="flex items-center gap-2 font-mono flex-1 min-w-0">
                    <span className="text-slate-400 line-through text-xs truncate">
                      {confirmandoItem.endereco_antigo}
                    </span>
                    <span className="text-slate-500 text-xs">➔</span>
                    <span className="text-sky-300 font-bold text-sm truncate">
                      {confirmandoItem.endereco_novo}
                    </span>
                  </div>
                  <button
                    type="button"
                    id="btn-copiar-endereco-sistema"
                    onClick={() => copiarParaTransferencia(confirmandoItem.endereco_novo, 'confirmar-endereco')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition shrink-0 min-h-[38px] ${
                      copiadoCampo === 'confirmar-endereco'
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200 hover:text-white'
                    }`}
                    title="Copiar novo endereço"
                  >
                    {copiadoCampo === 'confirmar-endereco' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Pergunta oficial exigida no requisito 22 */}
            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              Você confirma que esta alteração já foi realizada no sistema da empresa?
            </p>

            <div className="text-[11px] text-slate-500">
              * O Polifiltro registrará que o gestor confirmou a realização da alteração (<code className="text-sky-300">alterado_sistema = true</code>). Não altera estoques externos automaticamente.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmandoItem(null)}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition min-h-[44px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-modal-confirmar-sistema"
                onClick={handleConfirmarNoSistema}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition min-h-[44px]"
              >
                <Check className="w-4 h-4" />
                <span>{saving ? 'Confirmando...' : 'Sim, Confirmar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
