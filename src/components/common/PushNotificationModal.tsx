import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Send,
  Loader2,
  X,
  ShieldCheck,
} from 'lucide-react';
import { pushNotificationService, PushStatus } from '../../services/pushNotificationService';
import { useAuth } from '../../context/AuthContext';

interface PushNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PushNotificationModal: React.FC<PushNotificationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<PushStatus>({
    supported: true,
    permission: 'default',
    isSubscribed: false,
  });
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      carregarStatus();
      setActionMessage(null);
    }
  }, [isOpen]);

  async function carregarStatus() {
    const s = await pushNotificationService.getStatus();
    setStatus(s);
  }

  async function handleAtivarNotificacoes() {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await pushNotificationService.requestPermissionAndSubscribe(user?.id);
      if (res.success) {
        setActionMessage({
          type: 'success',
          text: 'Notificações Push ativadas com sucesso neste dispositivo!',
        });
      } else {
        setActionMessage({
          type: 'error',
          text: res.error || 'Não foi possível ativar as notificações.',
        });
      }
      await carregarStatus();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err?.message || 'Erro inesperado ao solicitar autorização.',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDesativar() {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await pushNotificationService.unsubscribe();
      if (res.success) {
        setActionMessage({
          type: 'info',
          text: 'Notificações desativadas para este dispositivo.',
        });
      }
      await carregarStatus();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err?.message || 'Erro ao desativar notificações.',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleEnviarTeste() {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await pushNotificationService.sendTestNotification();
      if (res.success) {
        setActionMessage({
          type: 'success',
          text: 'Notificação de teste enviada! Verifique a barra de notificações do seu sistema/Android.',
        });
      } else {
        setActionMessage({
          type: 'error',
          text: res.error || 'Falha ao enviar notificação de teste.',
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err?.message || 'Erro ao disparar teste.',
      });
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      id="modal-push-notifications"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 text-slate-100">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Notificações Push Gerais</h2>
              <p className="text-xs text-slate-400">PoliHub Web & PWA Android</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="mt-5 space-y-4">
          {/* Status Atual */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Status neste dispositivo:</span>
              {status.permission === 'granted' && status.isSubscribed ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Ativo e Autorizado
                </span>
              ) : status.permission === 'denied' ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Bloqueado no Navegador
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Bell className="w-3.5 h-3.5" />
                  Não ativado
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {status.permission === 'granted' && status.isSubscribed
                ? 'Este dispositivo receberá notificações push automáticas sempre que uma nova Nota Fiscal for recebida no PoliHub.'
                : status.permission === 'denied'
                ? 'As notificações estão bloqueadas nas preferências do site no seu navegador. Para autorizar, clique no ícone de cadeado/configurações da barra de endereços e habilite notificações.'
                : 'Autorize as notificações para ser avisado nativamente quando uma nova NF entrar no fluxo de Recebimento com status "Recebido".'}
            </p>
          </div>

          {/* Feedback temporário */}
          {actionMessage && (
            <div
              className={`p-3 rounded-2xl text-xs flex items-start gap-2.5 border ${
                actionMessage.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                  : actionMessage.type === 'error'
                  ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                  : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
              }`}
            >
              {actionMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span className="leading-snug">{actionMessage.text}</span>
            </div>
          )}

          {/* Regras e Transparência */}
          <div className="p-3 rounded-2xl bg-blue-950/20 border border-blue-900/30 text-[11px] text-blue-300/90 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-blue-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              Regras do PoliHub Push:
            </div>
            <ul className="list-disc pl-4 space-y-0.5 text-slate-300">
              <li>A notificação é <strong>geral</strong> (todos os usuários que autorizarem recebem).</li>
              <li>O Push <strong>não concede permissões</strong> aos módulos restritos.</li>
              <li>O clique apenas abre ou foca o PoliHub sem redirecionamento forçado.</li>
              <li>Múltiplos dispositivos (PC e celular) podem ser vinculados à sua conta.</li>
            </ul>
          </div>
        </div>

        {/* Rodapé / Ações */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col gap-2.5">
          {(!status.isSubscribed || status.permission !== 'granted') && status.permission !== 'denied' && (
            <button
              type="button"
              id="btn-ativar-push"
              disabled={loading || !status.supported}
              onClick={handleAtivarNotificacoes}
              className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 font-semibold text-sm text-white transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Solicitando autorização...</span>
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  <span>Ativar Notificações Push</span>
                </>
              )}
            </button>
          )}

          {status.isSubscribed && status.permission === 'granted' && (
            <div className="flex items-center gap-2 w-full">
              <button
                type="button"
                id="btn-testar-push"
                disabled={loading}
                onClick={handleEnviarTeste}
                className="flex-1 py-2.5 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 border border-slate-700"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5 text-blue-400" />
                )}
                <span>Testar Notificação</span>
              </button>

              <button
                type="button"
                id="btn-desativar-push"
                disabled={loading}
                onClick={handleDesativar}
                className="py-2.5 px-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 text-xs font-semibold transition flex items-center justify-center gap-1.5 border border-rose-500/20"
              >
                <BellOff className="w-3.5 h-3.5" />
                <span>Desativar</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 text-xs text-slate-400 hover:text-white transition font-medium"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
