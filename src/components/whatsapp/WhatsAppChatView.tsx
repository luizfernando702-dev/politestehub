import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Phone,
  UserCheck,
  ArrowRightLeft,
  CheckCircle,
  Clock,
  RotateCcw,
  Building2,
  Layers,
  ShieldAlert,
  Sparkles,
  Check,
  CheckCheck,
  AlertCircle,
} from 'lucide-react';
import { WhatsAppConversa, WhatsAppMensagem, Usuario } from '../../types';
import { whatsappService, formatarTelefoneExibicao } from '../../services/whatsappService';
import { canUserSendGroupWhatsApp, isUserGestor } from '../../lib/permissions';
import { WhatsAppTransferModal } from './WhatsAppTransferModal';

interface WhatsAppChatViewProps {
  conversa: WhatsAppConversa;
  usuarioLogado: Usuario;
  onAtualizarConversa: () => void;
  onVoltarMobile?: () => void;
}

export const WhatsAppChatView: React.FC<WhatsAppChatViewProps> = ({
  conversa,
  usuarioLogado,
  onAtualizarConversa,
  onVoltarMobile,
}) => {
  const [mensagens, setMensagens] = useState<WhatsAppMensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [textoMensagem, setTextoMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const carregarMensagens = useCallback(async () => {
    try {
      const data = await whatsappService.listarMensagens(conversa.id);
      setMensagens(data);
    } catch (e) {
      console.error('Erro ao listar mensagens:', e);
    } finally {
      setLoading(false);
    }
  }, [conversa.id]);

  useEffect(() => {
    carregarMensagens();
    const handleUpdate = () => carregarMensagens();
    window.addEventListener('polihub_whatsapp_update', handleUpdate);
    return () => window.removeEventListener('polihub_whatsapp_update', handleUpdate);
  }, [carregarMensagens]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textoMensagem.trim() || enviando) return;

    // Validação de grupo: apenas gestores autorizados podem enviar
    if (conversa.tipo_conversa === 'grupo' && !canUserSendGroupWhatsApp(usuarioLogado, true)) {
      alert('Apenas gestores autorizados podem responder e enviar mensagens em grupos.');
      return;
    }

    try {
      setEnviando(true);
      const texto = textoMensagem;
      setTextoMensagem('');
      await whatsappService.enviarMensagemColaborador(conversa.id, usuarioLogado, texto);
      await carregarMensagens();
      onAtualizarConversa();
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    } finally {
      setEnviando(false);
    }
  };

  const handleAssumir = async () => {
    try {
      await whatsappService.assumirConversa(conversa.id, usuarioLogado);
      await carregarMensagens();
      onAtualizarConversa();
    } catch (err) {
      console.error('Erro ao assumir atendimento:', err);
    }
  };

  const handleEncerrar = async () => {
    if (!window.confirm('Deseja realmente encerrar este atendimento?')) return;
    try {
      await whatsappService.encerrarConversa(conversa.id, usuarioLogado, 'Finalizado pelo atendente');
      await carregarMensagens();
      onAtualizarConversa();
    } catch (err) {
      console.error('Erro ao encerrar atendimento:', err);
    }
  };

  const handleReabrir = async () => {
    try {
      await whatsappService.reabrirConversa(conversa.id, usuarioLogado);
      await carregarMensagens();
      onAtualizarConversa();
    } catch (err) {
      console.error('Erro ao reabrir atendimento:', err);
    }
  };

  const isEncerrado = conversa.status === 'encerrado';
  const isAguardando = conversa.status === 'aguardando';
  const isResponsavel = conversa.usuario_atribuido_id === usuarioLogado.id;
  const isGestor = isUserGestor(usuarioLogado);
  const podeInteragir = !isEncerrado && (isResponsavel || isGestor || isAguardando);

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl">
      {/* 1. Header do Chat */}
      <div className="bg-slate-900 border-b border-slate-800 p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {onVoltarMobile && (
            <button
              type="button"
              onClick={onVoltarMobile}
              className="md:hidden p-2 -ml-1 text-slate-400 hover:text-white"
            >
              ← Voltar
            </button>
          )}

          {/* Avatar / Inicial */}
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-md">
            {conversa.nome_remetente.charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white truncate">
                {conversa.nome_remetente}
              </h3>
              {conversa.contato_tipo && conversa.contato_tipo !== 'desconhecido' && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                  {conversa.contato_tipo}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span className="font-mono text-slate-300">
                {formatarTelefoneExibicao(conversa.numero_remetente)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-slate-400">
                <Building2 className="w-3 h-3 text-blue-400" />
                {conversa.unidade_negocio}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-amber-300 font-medium">
                <Layers className="w-3 h-3 text-amber-400" />
                {conversa.fila_nome}
              </span>
            </div>
          </div>
        </div>

        {/* Status Badge & Ações de Fluxo */}
        <div className="flex items-center gap-2 shrink-0">
          {isAguardando ? (
            <button
              type="button"
              onClick={handleAssumir}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/30 cursor-pointer min-h-[40px]"
            >
              <UserCheck className="w-4 h-4" />
              <span>Iniciar Atendimento</span>
            </button>
          ) : !isEncerrado ? (
            <>
              <button
                type="button"
                onClick={() => setShowTransferModal(true)}
                title="Transferir conversa para outra fila ou colaborador"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition min-h-[40px] cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Transferir</span>
              </button>

              <button
                type="button"
                onClick={handleEncerrar}
                title="Encerrar este atendimento"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 text-rose-300 hover:text-white text-xs font-bold transition min-h-[40px] cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Encerrar</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleReabrir}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600 border border-blue-500/40 text-blue-300 hover:text-white text-xs font-bold transition min-h-[40px] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reabrir Atendimento</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Barra Informativa de Responsável / Status */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-4 py-2 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              conversa.status === 'aguardando'
                ? 'bg-rose-500 animate-pulse'
                : conversa.status === 'em_andamento'
                ? 'bg-emerald-400'
                : 'bg-slate-600'
            }`}
          />
          <span>
            Status:{' '}
            <strong className="text-white">
              {conversa.status === 'aguardando'
                ? 'Aguardando Atendimento'
                : conversa.status === 'em_andamento'
                ? 'Em Andamento'
                : 'Encerrado'}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span>Atendente Responsável:</span>
          <strong className="text-blue-400">
            {conversa.usuario_atribuido_nome || 'Nenhum (Fila Geral)'}
          </strong>
        </div>
      </div>

      {/* 3. Área de Mensagens (Histórico Oficial) */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900/40">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Carregando histórico...</div>
        ) : mensagens.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Nenhuma mensagem registrada nesta conversa.
          </div>
        ) : (
          mensagens.map((msg) => {
            const isColaborador = msg.tipo_remetente === 'colaborador';
            const isSistema = msg.tipo_remetente === 'sistema';
            const isContato = msg.tipo_remetente === 'contato';

            // Formatação de data/hora
            const dataHora = new Date(msg.created_at).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            });

            if (isSistema) {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <div className="max-w-md p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center text-xs text-slate-300 shadow-sm">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1 flex items-center justify-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>{msg.autor_nome}</span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.conteudo}</p>
                    <span className="text-[10px] text-slate-500 block mt-1">{dataHora}</span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex ${isColaborador ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-3.5 shadow-md text-xs sm:text-sm leading-relaxed ${
                    isColaborador
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                  }`}
                >
                  {/* SEÇÃO 8: Identificação do Colaborador em Negrito antes do Conteúdo */}
                  <div className="mb-1 text-xs">
                    {isColaborador ? (
                      <span className="font-black text-blue-100 tracking-wide">
                        {msg.autor_nome}:
                      </span>
                    ) : (
                      <span className="font-bold text-emerald-400">{msg.autor_nome}:</span>
                    )}
                  </div>

                  <p className="whitespace-pre-wrap break-words">{msg.conteudo}</p>

                  <div
                    className={`flex items-center justify-end gap-1.5 mt-1.5 text-[10px] ${
                      isColaborador ? 'text-blue-200' : 'text-slate-500'
                    }`}
                  >
                    <span>{dataHora}</span>
                    {isColaborador && (
                      <span>
                        {msg.status_envio === 'lido' ? (
                          <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />
                        ) : msg.status_envio === 'entregue' ? (
                          <CheckCheck className="w-3.5 h-3.5 text-blue-200" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-blue-200" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 4. Campo de Envio de Mensagem */}
      <div className="p-3.5 bg-slate-900 border-t border-slate-800 shrink-0">
        {isEncerrado ? (
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
            Este atendimento foi encerrado. Clique no botão superior <strong>Reabrir Atendimento</strong> para continuar o diálogo.
          </div>
        ) : conversa.tipo_conversa === 'grupo' && !canUserSendGroupWhatsApp(usuarioLogado, true) ? (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>
              Apenas gestores autorizados possuem permissão de envio em grupos (Seção 10).
            </span>
          </div>
        ) : (
          <form onSubmit={handleEnviar} className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                id="input-mensagem-whatsapp"
                value={textoMensagem}
                onChange={(e) => setTextoMensagem(e.target.value)}
                placeholder={`Mensagem como ${usuarioLogado.nome}...`}
                disabled={enviando}
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[46px]"
              />
            </div>
            <button
              type="submit"
              id="btn-enviar-mensagem-whatsapp"
              disabled={enviando || !textoMensagem.trim()}
              className="p-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition disabled:opacity-50 cursor-pointer min-h-[46px] min-w-[46px] flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>

      {/* Modal de Transferência */}
      {showTransferModal && (
        <WhatsAppTransferModal
          conversa={conversa}
          usuarioLogado={usuarioLogado}
          onClose={() => setShowTransferModal(false)}
          onTransferido={() => {
            onAtualizarConversa();
            carregarMensagens();
          }}
        />
      )}
    </div>
  );
};
