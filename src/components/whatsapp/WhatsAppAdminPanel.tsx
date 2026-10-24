import React, { useState, useEffect, useCallback } from 'react';
import {
  PhoneCall,
  Users,
  MessageSquare,
  Layers,
  UserCheck,
  History,
  Sparkles,
  Plus,
  Save,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building2,
  Filter,
  Check,
  X,
  Play,
  RotateCw,
  ShieldCheck,
  ShieldAlert,
  Sliders,
} from 'lucide-react';
import {
  WhatsAppCanal,
  WhatsAppContato,
  WhatsAppFila,
  WhatsAppMensagemAutomatica,
  WhatsAppUsuarioHabilitado,
  WhatsAppConversa,
  WhatsAppHistoricoAcao,
  Usuario,
} from '../../types';
import { whatsappService, formatarTelefoneExibicao, normalizarNumeroWhatsApp } from '../../services/whatsappService';

interface WhatsAppAdminPanelProps {
  usuarioLogado: Usuario;
  onVoltarParaAtendimento: () => void;
}

type AdminSubTab =
  | 'monitor'
  | 'canais'
  | 'contatos'
  | 'mensagens_auto'
  | 'filas'
  | 'usuarios'
  | 'auditoria'
  | 'simulador';

export const WhatsAppAdminPanel: React.FC<WhatsAppAdminPanelProps> = ({
  usuarioLogado,
  onVoltarParaAtendimento,
}) => {
  const [activeTab, setActiveTab] = useState<AdminSubTab>('monitor');
  const [toast, setToast] = useState<string | null>(null);

  // Dados carregados
  const [canais, setCanais] = useState<WhatsAppCanal[]>([]);
  const [contatos, setContatos] = useState<WhatsAppContato[]>([]);
  const [filas, setFilas] = useState<WhatsAppFila[]>([]);
  const [mensagensAuto, setMensagensAuto] = useState<WhatsAppMensagemAutomatica[]>([]);
  const [usuariosHab, setUsuariosHab] = useState<WhatsAppUsuarioHabilitado[]>([]);
  const [conversas, setConversas] = useState<WhatsAppConversa[]>([]);
  const [historico, setHistorico] = useState<WhatsAppHistoricoAcao[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros do monitor
  const [filtroUnidade, setFiltroUnidade] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroFila, setFiltroFila] = useState<string>('todas');

  // Estados de formulário modal/inserção
  const [canalEditando, setCanalEditando] = useState<Partial<WhatsAppCanal> | null>(null);
  const [contatoEditando, setContatoEditando] = useState<Partial<WhatsAppContato> | null>(null);
  const [filaEditando, setFilaEditando] = useState<Partial<WhatsAppFila> | null>(null);
  const [msgAutoEditando, setMsgAutoEditando] = useState<Partial<WhatsAppMensagemAutomatica> | null>(null);

  // Estados do Simulador
  const [simTelefone, setSimTelefone] = useState('+5562988112233');
  const [simNome, setSimNome] = useState('Carlos Transportes (Jadlog)');
  const [simTexto, setSimTexto] = useState('1');
  const [simUnidade, setSimUnidade] = useState(usuarioLogado.unidade_negocio || 'Goiânia');
  const [simuladoSucesso, setSimuladoSucesso] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const carregarTudo = useCallback(async () => {
    try {
      setLoading(true);
      const [
        canaisData,
        contatosData,
        filasData,
        msgsData,
        usersData,
        convsData,
        histData,
      ] = await Promise.all([
        whatsappService.listarCanais(),
        whatsappService.listarContatos(),
        whatsappService.listarFilas(),
        whatsappService.listarMensagensAutomaticas(),
        whatsappService.listarUsuariosHabilitados(),
        whatsappService.listarConversas(),
        whatsappService.listarHistoricoAcoes(),
      ]);

      setCanais(canaisData);
      setContatos(contatosData);
      setFilas(filasData);
      setMensagensAuto(msgsData);
      setUsuariosHab(usersData);
      setConversas(convsData);
      setHistorico(histData);
    } catch (e) {
      console.error('Erro ao carregar dados do painel admin:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarTudo();
    const handleUpdate = () => carregarTudo();
    window.addEventListener('polihub_whatsapp_update', handleUpdate);
    return () => window.removeEventListener('polihub_whatsapp_update', handleUpdate);
  }, [carregarTudo]);

  // Handlers Canais
  const handleSalvarCanal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canalEditando) return;
    try {
      await whatsappService.salvarCanal(canalEditando);
      setCanalEditando(null);
      showToast('Canal WhatsApp salvo com sucesso!');
      carregarTudo();
    } catch {
      alert('Erro ao salvar canal.');
    }
  };

  const handleExcluirCanal = async (id: string) => {
    if (!window.confirm('Deseja excluir este canal?')) return;
    await whatsappService.excluirCanal(id);
    showToast('Canal excluído com sucesso.');
    carregarTudo();
  };

  // Handlers Contatos
  const handleSalvarContato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contatoEditando) return;
    try {
      await whatsappService.salvarContato(contatoEditando);
      setContatoEditando(null);
      showToast('Contato salvo com sucesso!');
      carregarTudo();
    } catch {
      alert('Erro ao salvar contato.');
    }
  };

  const handleExcluirContato = async (id: string) => {
    if (!window.confirm('Deseja excluir este contato?')) return;
    await whatsappService.excluirContato(id);
    showToast('Contato excluído.');
    carregarTudo();
  };

  // Handlers Filas
  const handleSalvarFila = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filaEditando) return;
    try {
      await whatsappService.salvarFila(filaEditando);
      setFilaEditando(null);
      showToast('Fila de atendimento salva!');
      carregarTudo();
    } catch {
      alert('Erro ao salvar fila.');
    }
  };

  const handleExcluirFila = async (id: string) => {
    if (!window.confirm('Deseja excluir esta fila?')) return;
    await whatsappService.excluirFila(id);
    showToast('Fila excluída.');
    carregarTudo();
  };

  // Handlers Mensagens Automáticas
  const handleSalvarMsgAuto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgAutoEditando) return;
    try {
      await whatsappService.salvarMensagemAutomatica(msgAutoEditando);
      setMsgAutoEditando(null);
      showToast('Mensagem automática atualizada no banco de dados!');
      carregarTudo();
    } catch {
      alert('Erro ao salvar mensagem automática.');
    }
  };

  const handleExcluirMsgAuto = async (id: string) => {
    if (!window.confirm('Deseja excluir esta regra automática?')) return;
    await whatsappService.excluirMensagemAutomatica(id);
    showToast('Mensagem excluída.');
    carregarTudo();
  };

  // Handlers Usuários Habilitados
  const handleToggleHabilitado = async (u: WhatsAppUsuarioHabilitado) => {
    await whatsappService.salvarHabilitacaoUsuario({
      ...u,
      habilitado: !u.habilitado,
    });
    showToast(`Usuário ${u.usuario_nome} ${!u.habilitado ? 'habilitado' : 'desabilitado'}!`);
    carregarTudo();
  };

  const handleToggleDisponibilidade = async (u: WhatsAppUsuarioHabilitado) => {
    await whatsappService.salvarHabilitacaoUsuario({
      ...u,
      disponivel: !u.disponivel,
    });
    showToast(`Disponibilidade de ${u.usuario_nome} alterada!`);
    carregarTudo();
  };

  const handleTogglePermissaoGrupos = async (u: WhatsAppUsuarioHabilitado, tipo: 'ver' | 'responder') => {
    if (tipo === 'responder' && u.usuario_nivel !== 'Gestor') {
      alert('A permissão de envio de mensagens em grupos é exclusiva para o perfil Gestor (Seção 10).');
      return;
    }
    await whatsappService.salvarHabilitacaoUsuario({
      ...u,
      pode_visualizar_grupos: tipo === 'ver' ? !u.pode_visualizar_grupos : u.pode_visualizar_grupos,
      pode_responder_grupos: tipo === 'responder' ? !u.pode_responder_grupos : u.pode_responder_grupos,
    });
    showToast('Permissão de grupos atualizada!');
    carregarTudo();
  };

  // Handler Simulador de Mensagem Inbound
  const handleExecutarSimulador = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const canal = canais.find((c) => c.unidade_negocio === simUnidade) || canais[0];
      await whatsappService.registrarMensagemInbound(
        canal?.id || 'canal-default',
        simTelefone,
        simNome,
        simTexto,
        simUnidade
      );
      setSimuladoSucesso(true);
      showToast('Mensagem simulada com sucesso! Verifique o fluxo e o monitor.');
      setTimeout(() => setSimuladoSucesso(false), 3000);
      carregarTudo();
    } catch {
      alert('Erro ao executar simulador.');
    }
  };

  // Filtro de conversas no monitor
  const conversasFiltradas = conversas.filter((c) => {
    if (filtroUnidade && c.unidade_negocio !== filtroUnidade) return false;
    if (filtroStatus !== 'todos' && c.status !== filtroStatus) return false;
    if (filtroFila !== 'todas' && c.fila_nome !== filtroFila) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl bg-blue-600 text-white px-5 py-3 text-xs sm:text-sm font-semibold shadow-2xl border border-blue-400/40 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header do Painel Administrativo */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Gestão Logística Exclusiva
            </span>
            <span className="text-xs text-slate-400">PoliHub WhatsApp Business</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Painel Administrativo do Gestor
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Configure números de atendimento, regras inteligentes de contatos, mensagens automáticas no banco e habilitação de atendentes por fila.
          </p>
        </div>

        <button
          type="button"
          onClick={onVoltarParaAtendimento}
          className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/30 min-h-[44px] cursor-pointer"
        >
          Voltar à Caixa de Atendimento
        </button>
      </div>

      {/* Sub-Navegação do Painel do Gestor */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'monitor', label: 'Monitor de Atendimentos', icon: Sliders },
          { id: 'canais', label: 'Canais & Números', icon: PhoneCall },
          { id: 'contatos', label: 'Contatos Inteligentes', icon: Users },
          { id: 'mensagens_auto', label: 'Mensagens Automáticas', icon: MessageSquare },
          { id: 'filas', label: 'Filas de Atendimento', icon: Layers },
          { id: 'usuarios', label: 'Usuários Habilitados', icon: UserCheck },
          { id: 'auditoria', label: 'Auditoria de Ações', icon: History },
          { id: 'simulador', label: 'Simulador de Mensagens', icon: Play },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as AdminSubTab)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition min-h-[44px] cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. MONITOR GERAL DE ATENDIMENTOS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'monitor' && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-300">Filtros:</span>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
              >
                <option value="todos">Todos os Status</option>
                <option value="aguardando">Aguardando Atendimento</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="encerrado">Encerrados</option>
              </select>

              <select
                value={filtroFila}
                onChange={(e) => setFiltroFila(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
              >
                <option value="todas">Todas as Filas</option>
                {filas.map((f) => (
                  <option key={f.id} value={f.nome}>
                    {f.nome}
                  </option>
                ))}
              </select>

              <select
                value={filtroUnidade}
                onChange={(e) => setFiltroUnidade(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
              >
                <option value="">Todas as Unidades</option>
                <option value="Goiânia">Goiânia</option>
                <option value="Mato Grosso">Mato Grosso</option>
              </select>
            </div>

            <button
              type="button"
              onClick={carregarTudo}
              className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-semibold"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Atualizar</span>
            </button>
          </div>

          {/* Tabela de Monitoramento */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Contato / Remetente</th>
                    <th className="px-4 py-3">Unidade</th>
                    <th className="px-4 py-3">Fila</th>
                    <th className="px-4 py-3">Atendente Atual</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Última Mensagem</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {conversasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        Nenhum atendimento encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    conversasFiltradas.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-800/40 transition">
                        <td className="px-4 py-3">
                          <div className="font-bold text-white">{c.nome_remetente}</div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {formatarTelefoneExibicao(c.numero_remetente)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{c.unidade_negocio}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded font-semibold text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            {c.fila_nome}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-blue-400">
                          {c.usuario_atribuido_nome || 'Sem atendente'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              c.status === 'aguardando'
                                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                : c.status === 'em_andamento'
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {c.status === 'aguardando'
                              ? 'Aguardando'
                              : c.status === 'em_andamento'
                              ? 'Em Andamento'
                              : 'Encerrado'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 max-w-xs truncate">
                          {c.ultima_mensagem_texto || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {c.status !== 'encerrado' ? (
                            <button
                              type="button"
                              onClick={async () => {
                                await whatsappService.encerrarConversa(
                                  c.id,
                                  usuarioLogado,
                                  'Encerrado administrativamente pelo Gestor'
                                );
                                showToast('Conversa encerrada.');
                                carregarTudo();
                              }}
                              className="text-[11px] font-bold text-rose-400 hover:text-rose-300 hover:underline"
                            >
                              Encerrar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={async () => {
                                await whatsappService.reabrirConversa(c.id, usuarioLogado);
                                showToast('Conversa reaberta.');
                                carregarTudo();
                              }}
                              className="text-[11px] font-bold text-blue-400 hover:text-blue-300 hover:underline"
                            >
                              Reabrir
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. CANAIS & NÚMEROS META WHATSAPP */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'canais' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Números WhatsApp Conectados</h3>
              <p className="text-xs text-slate-400">
                Gerencie os números da API oficial da Meta por unidade de negócio.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setCanalEditando({
                  nome: '',
                  numero_telefone: '',
                  unidade_negocio: 'Goiânia',
                  horario_inicio: '08:00',
                  horario_fim: '18:00',
                  dias_funcionamento: ['seg', 'ter', 'qua', 'qui', 'sex'],
                  status_conexao: 'conectado',
                  ativo: true,
                })
              }
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition min-h-[40px] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Conectar Novo Número</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {canais.map((c) => (
              <div
                key={c.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-bold text-white">{c.nome}</h4>
                    <span className="text-sm font-mono text-emerald-400 font-bold block mt-0.5">
                      {formatarTelefoneExibicao(c.numero_telefone)}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      c.status_conexao === 'conectado'
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {c.status_conexao === 'conectado' ? 'Conexão Ativa' : 'Pendente'}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-400 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span>Unidade de Negócio:</span>
                    <strong className="text-white">{c.unidade_negocio}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Meta Phone Number ID:</span>
                    <span className="font-mono text-slate-300">{c.meta_phone_number_id || 'Não informado'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Horário de Atendimento:</span>
                    <span className="text-slate-300">
                      {c.horario_inicio || '08:00'} às {c.horario_fim || '18:00'} (
                      {c.dias_funcionamento?.join(', ') || 'seg-sex'})
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCanalEditando(c)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition cursor-pointer"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExcluirCanal(c.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Modal Edição Canal */}
          {canalEditando && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-white">
                    {canalEditando.id ? 'Editar Canal' : 'Conectar Novo Número'}
                  </h3>
                  <button onClick={() => setCanalEditando(null)}>
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <form onSubmit={handleSalvarCanal} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Nome do Canal</label>
                    <input
                      type="text"
                      required
                      value={canalEditando.nome || ''}
                      onChange={(e) => setCanalEditando({ ...canalEditando, nome: e.target.value })}
                      placeholder="Ex: WhatsApp Logística Goiânia"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Número WhatsApp (E.164)</label>
                      <input
                        type="text"
                        required
                        value={canalEditando.numero_telefone || ''}
                        onChange={(e) =>
                          setCanalEditando({ ...canalEditando, numero_telefone: e.target.value })
                        }
                        placeholder="+5562991234567"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Unidade de Negócio</label>
                      <select
                        value={canalEditando.unidade_negocio || 'Goiânia'}
                        onChange={(e) =>
                          setCanalEditando({ ...canalEditando, unidade_negocio: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      >
                        <option value="Goiânia">Goiânia</option>
                        <option value="Mato Grosso">Mato Grosso</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Meta Phone Number ID</label>
                      <input
                        type="text"
                        value={canalEditando.meta_phone_number_id || ''}
                        onChange={(e) =>
                          setCanalEditando({
                            ...canalEditando,
                            meta_phone_number_id: e.target.value,
                          })
                        }
                        placeholder="Ex: 109876543210987"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Meta WABA ID</label>
                      <input
                        type="text"
                        value={canalEditando.meta_waba_id || ''}
                        onChange={(e) =>
                          setCanalEditando({ ...canalEditando, meta_waba_id: e.target.value })
                        }
                        placeholder="Ex: 987654321098765"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Horário Início</label>
                      <input
                        type="time"
                        value={canalEditando.horario_inicio || '08:00'}
                        onChange={(e) =>
                          setCanalEditando({ ...canalEditando, horario_inicio: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Horário Fim</label>
                      <input
                        type="time"
                        value={canalEditando.horario_fim || '18:00'}
                        onChange={(e) =>
                          setCanalEditando({ ...canalEditando, horario_fim: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Mensagem Fora do Horário</label>
                    <textarea
                      rows={2}
                      value={canalEditando.mensagem_fora_horario || ''}
                      onChange={(e) =>
                        setCanalEditando({
                          ...canalEditando,
                          mensagem_fora_horario: e.target.value,
                        })
                      }
                      placeholder="Mensagem enviada quando um cliente enviar mensagem fora do expediente..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setCanalEditando(null)}
                      className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                    >
                      Salvar Canal
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. CONTATOS INTELIGENTES */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'contatos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Cadastro Inteligente de Contatos</h3>
              <p className="text-xs text-slate-400">
                Reconheça o cliente, gestor ou colaborador pelo número e aplique regras de atendimento.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setContatoEditando({
                  nome: '',
                  telefone: '',
                  tipo_contato: 'cliente',
                  departamento_relacionado: 'Logística',
                  unidade_negocio: 'Goiânia',
                  regra_atendimento: 'padrao',
                  ativo: true,
                })
              }
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition min-h-[40px] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Contato</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {contatos.map((ct) => (
              <div
                key={ct.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-white">{ct.nome}</h4>
                    <span className="text-xs font-mono text-emerald-400 font-semibold block mt-0.5">
                      {formatarTelefoneExibicao(ct.telefone)}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {ct.tipo_contato}
                  </span>
                </div>

                <div className="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-800">
                  <div>Regra: <strong className="text-slate-200">{ct.regra_atendimento}</strong></div>
                  <div>Unidade: <strong className="text-slate-200">{ct.unidade_negocio || 'Todas'}</strong></div>
                  {ct.mensagem_personalizada && (
                    <p className="text-[11px] text-slate-500 italic mt-1 line-clamp-2">
                      &quot;{ct.mensagem_personalizada}&quot;
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setContatoEditando(ct)}
                    className="px-3 py-1 rounded-xl bg-slate-800 text-xs text-slate-300 hover:text-white"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExcluirContato(ct.id)}
                    className="p-1 text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Modal Edição Contato */}
          {contatoEditando && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-white">
                    {contatoEditando.id ? 'Editar Contato' : 'Novo Contato'}
                  </h3>
                  <button onClick={() => setContatoEditando(null)}>
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <form onSubmit={handleSalvarContato} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Nome do Contato</label>
                    <input
                      type="text"
                      required
                      value={contatoEditando.nome || ''}
                      onChange={(e) => setContatoEditando({ ...contatoEditando, nome: e.target.value })}
                      placeholder="Ex: Carlos Jadlog"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Telefone Internacional (E.164)</label>
                    <input
                      type="text"
                      required
                      value={contatoEditando.telefone || ''}
                      onChange={(e) => setContatoEditando({ ...contatoEditando, telefone: e.target.value })}
                      placeholder="+5562988112233"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Tipo de Perfil</label>
                      <select
                        value={contatoEditando.tipo_contato || 'cliente'}
                        onChange={(e) =>
                          setContatoEditando({ ...contatoEditando, tipo_contato: e.target.value as any })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      >
                        <option value="cliente">Cliente</option>
                        <option value="fornecedor">Fornecedor</option>
                        <option value="colaborador">Colaborador</option>
                        <option value="gestor">Gestor</option>
                        <option value="desconhecido">Desconhecido</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Regra de Atendimento</label>
                      <select
                        value={contatoEditando.regra_atendimento || 'padrao'}
                        onChange={(e) =>
                          setContatoEditando({ ...contatoEditando, regra_atendimento: e.target.value as any })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      >
                        <option value="padrao">Padrão</option>
                        <option value="prioritario">Prioritário</option>
                        <option value="fila_especifica">Fila Específica</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Mensagem de Boas-vindas Personalizada</label>
                    <textarea
                      rows={2}
                      value={contatoEditando.mensagem_personalizada || ''}
                      onChange={(e) =>
                        setContatoEditando({
                          ...contatoEditando,
                          mensagem_personalizada: e.target.value,
                        })
                      }
                      placeholder="Ex: Olá Carlos! Com qual setor da logística deseja falar?"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setContatoEditando(null)}
                      className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                    >
                      Salvar Contato
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. MENSAGENS AUTOMÁTICAS CONFIGURÁVEIS NO BANCO */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'mensagens_auto' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Mensagens e Respostas Automáticas</h3>
              <p className="text-xs text-slate-400">
                Configure mensagens no banco de dados sem alterar o código do sistema.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setMsgAutoEditando({
                  nome: '',
                  tipo_evento: 'boas_vindas',
                  perfil_contato: 'todos',
                  texto: '',
                  opcoes: [],
                  ativo: true,
                })
              }
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition min-h-[40px] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Mensagem</span>
            </button>
          </div>

          <div className="space-y-3">
            {mensagensAuto.map((m) => (
              <div
                key={m.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <span>{m.nome}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {m.tipo_evento}
                      </span>
                    </h4>
                    <span className="text-xs text-slate-400">
                      Disparo para perfil: <strong>{m.perfil_contato}</strong>
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      m.ativo ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {m.ativo ? 'Ativa' : 'Inativa'}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-850 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                  {m.texto}
                </div>

                {m.opcoes && m.opcoes.length > 0 && (
                  <div className="pt-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      Opções do Menu:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {m.opcoes.map((op) => (
                        <div
                          key={op.id}
                          className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center justify-between"
                        >
                          <span className="font-bold text-amber-400 font-mono">[{op.valor}]</span>
                          <span className="text-white font-medium truncate ml-1.5">{op.label}</span>
                          <span className="text-[10px] text-slate-500 font-mono ml-auto">
                            → {op.destino_fila}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setMsgAutoEditando(m)}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-semibold"
                  >
                    Editar Regra
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExcluirMsgAuto(m.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Modal Edição Mensagem Automática */}
          {msgAutoEditando && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-white">
                    {msgAutoEditando.id ? 'Editar Mensagem Automática' : 'Nova Mensagem Automática'}
                  </h3>
                  <button onClick={() => setMsgAutoEditando(null)}>
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <form onSubmit={handleSalvarMsgAuto} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Título / Nome da Regra</label>
                    <input
                      type="text"
                      required
                      value={msgAutoEditando.nome || ''}
                      onChange={(e) => setMsgAutoEditando({ ...msgAutoEditando, nome: e.target.value })}
                      placeholder="Ex: Boas-vindas Desconhecido"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Tipo de Evento</label>
                      <select
                        value={msgAutoEditando.tipo_evento || 'boas_vindas'}
                        onChange={(e) =>
                          setMsgAutoEditando({ ...msgAutoEditando, tipo_evento: e.target.value as any })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      >
                        <option value="boas_vindas">Boas-vindas</option>
                        <option value="fora_horario">Fora do Horário</option>
                        <option value="sem_atendentes">Nenhum Atendente</option>
                        <option value="gestor_identificado">Gestor Identificado</option>
                        <option value="resposta_invalida">Resposta Inválida</option>
                        <option value="fallback">Fallback Geral</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Perfil do Contato</label>
                      <select
                        value={msgAutoEditando.perfil_contato || 'todos'}
                        onChange={(e) =>
                          setMsgAutoEditando({ ...msgAutoEditando, perfil_contato: e.target.value as any })
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      >
                        <option value="todos">Todos os Perfis</option>
                        <option value="desconhecido">Apenas Desconhecidos</option>
                        <option value="cliente">Clientes</option>
                        <option value="gestor">Gestores</option>
                        <option value="colaborador">Colaboradores</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Conteúdo da Mensagem</label>
                    <textarea
                      rows={4}
                      required
                      value={msgAutoEditando.texto || ''}
                      onChange={(e) => setMsgAutoEditando({ ...msgAutoEditando, texto: e.target.value })}
                      placeholder="Texto que o cliente ou gestor receberá..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Mensagem para Resposta Inválida</label>
                    <input
                      type="text"
                      value={msgAutoEditando.mensagem_invalida || ''}
                      onChange={(e) =>
                        setMsgAutoEditando({ ...msgAutoEditando, mensagem_invalida: e.target.value })
                      }
                      placeholder="Ex: Opção inválida. Digite de 1 a 6."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="check-ativo-msg"
                      checked={msgAutoEditando.ativo !== false}
                      onChange={(e) => setMsgAutoEditando({ ...msgAutoEditando, ativo: e.target.checked })}
                      className="rounded bg-slate-950 border-slate-800 text-blue-600"
                    />
                    <label htmlFor="check-ativo-msg" className="text-slate-300">
                      Regra ativa para atendimento
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setMsgAutoEditando(null)}
                      className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                    >
                      Salvar Regra
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. FILAS DE ATENDIMENTO */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'filas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Filas de Atendimento Operacional</h3>
              <p className="text-xs text-slate-400">
                Configure setores da Logística para triagem e distribuição automática de conversas.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setFilaEditando({
                  nome: '',
                  descricao: '',
                  departamento: 'Logística',
                  ordem: filas.length + 1,
                  ativo: true,
                })
              }
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition min-h-[40px] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Fila</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filas.map((f) => (
              <div
                key={f.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold text-white">{f.nome}</h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
                    Ordem {f.ordem || 0}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{f.descricao || 'Sem descrição'}</p>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-500">
                  <span>{f.departamento || 'Logística'}</span>
                  <button
                    type="button"
                    onClick={() => handleExcluirFila(f.id)}
                    className="text-slate-500 hover:text-rose-400"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Modal Edição Fila */}
          {filaEditando && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-white">Nova Fila de Atendimento</h3>
                  <button onClick={() => setFilaEditando(null)}>
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <form onSubmit={handleSalvarFila} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Nome da Fila</label>
                    <input
                      type="text"
                      required
                      value={filaEditando.nome || ''}
                      onChange={(e) => setFilaEditando({ ...filaEditando, nome: e.target.value })}
                      placeholder="Ex: Balcão Retira"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Descrição</label>
                    <input
                      type="text"
                      value={filaEditando.descricao || ''}
                      onChange={(e) => setFilaEditando({ ...filaEditando, descricao: e.target.value })}
                      placeholder="Ex: Atendimento de retirada presencial de mercadorias"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setFilaEditando(null)}
                      className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                    >
                      Salvar Fila
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. USUÁRIOS HABILITADOS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'usuarios' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-white">Habilitação de Atendentes WhatsApp</h3>
            <p className="text-xs text-slate-400">
              Controle quais colaboradores da Logística podem atender conversas, suas filas e permissões em grupos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {usuariosHab.map((u) => (
              <div
                key={u.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <span>{u.usuario_nome}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {u.usuario_codigo || u.usuario_nivel}
                      </span>
                    </h4>
                    <span className="text-xs text-slate-400">
                      {u.usuario_departamento} • {u.unidade_negocio}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleDisponibilidade(u)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                        u.disponivel
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-500 border border-slate-700'
                      }`}
                    >
                      {u.disponivel ? 'Disponível' : 'Ocupado'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleHabilitado(u)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                        u.habilitado
                          ? 'bg-blue-600 text-white'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {u.habilitado ? 'Habilitado' : 'Desabilitado'}
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-1">Filas Autorizadas:</span>
                    <div className="flex flex-wrap gap-1">
                      {u.filas_permitidas.map((fila) => (
                        <span
                          key={fila}
                          className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[10px] font-semibold text-slate-300"
                        >
                          {fila}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Permissões em Grupos (Seção 10) */}
                  <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={u.pode_visualizar_grupos}
                          onChange={() => handleTogglePermissaoGrupos(u, 'ver')}
                          className="rounded bg-slate-950 border-slate-800 text-blue-600"
                        />
                        <span>Ver Grupos</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={u.pode_responder_grupos}
                          onChange={() => handleTogglePermissaoGrupos(u, 'responder')}
                          className="rounded bg-slate-950 border-slate-800 text-blue-600"
                        />
                        <span>Responder Grupos (Gestores)</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. AUDITORIA DE AÇÕES */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'auditoria' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
          <h3 className="text-base font-bold text-white">Registro de Auditoria e Ações</h3>
          <p className="text-xs text-slate-400">
            Histórico completo de transferências, atribuições e encerramentos executados no módulo.
          </p>

          <div className="space-y-2 pt-2">
            {historico.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">Nenhum evento registrado ainda.</p>
            ) : (
              historico.map((h) => (
                <div
                  key={h.id}
                  className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-white">{h.usuario_nome || 'Sistema'}:</span>{' '}
                      <span className="text-slate-300 uppercase font-mono text-[11px]">[{h.tipo_acao}]</span>
                      {h.detalhes && (
                        <span className="text-slate-400 ml-2">
                          {JSON.stringify(h.detalhes)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(h.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 8. SIMULADOR DE MENSAGENS INBOUND */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'simulador' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 max-w-xl">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Play className="w-5 h-5 text-emerald-400" />
              <span>Simulador de Mensagens WhatsApp</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Simule a chegada de mensagens externas para testar menus numéricos, respostas automáticas, filas e a atualização da badge no cabeçalho.
            </p>
          </div>

          <form onSubmit={handleExecutarSimulador} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Remetente (Telefone E.164)
              </label>
              <input
                type="text"
                required
                value={simTelefone}
                onChange={(e) => setSimTelefone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Nome do Remetente
              </label>
              <input
                type="text"
                required
                value={simNome}
                onChange={(e) => setSimNome(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Mensagem do Cliente (ou dígito do menu: 1, 2, 3...)
              </label>
              <textarea
                rows={2}
                required
                value={simTexto}
                onChange={(e) => setSimTexto(e.target.value)}
                placeholder="Ex: 1 para Recebimento, 2 para Expedição..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Unidade de Destino
              </label>
              <select
                value={simUnidade}
                onChange={(e) => setSimUnidade(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
              >
                <option value="Goiânia">Goiânia</option>
                <option value="Mato Grosso">Mato Grosso</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-600/30 cursor-pointer min-h-[44px]"
            >
              <SendIcon className="w-4 h-4" />
              <span>Simular Envio de Mensagem</span>
            </button>
          </form>

          {simuladoSucesso && (
            <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Mensagem enviada com sucesso! Acesse a aba <strong>Caixa de Atendimento</strong> ou confira a badge no cabeçalho.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}
