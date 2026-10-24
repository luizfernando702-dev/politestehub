import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { whatsappService } from '../../services/whatsappService';
import { WhatsAppBadgeStatus } from '../../types';

interface WhatsAppHeaderBadgeProps {
  onAbrirWhatsApp: () => void;
}

export const WhatsAppHeaderBadge: React.FC<WhatsAppHeaderBadgeProps> = ({ onAbrirWhatsApp }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<WhatsAppBadgeStatus>({
    habilitado: false,
    pendentes_count: 0,
    em_andamento_count: 0,
    cor: 'dark',
  });
  const [loading, setLoading] = useState(false);

  const carregarStatus = useCallback(async () => {
    if (!user) return;
    try {
      const res = await whatsappService.obterStatusBadge(user);
      setStatus(res);
    } catch (err) {
      console.warn('Erro ao carregar status da badge WhatsApp:', err);
    }
  }, [user]);

  useEffect(() => {
    carregarStatus();

    // Atualização em tempo real via evento de banco/serviço e polling leve a cada 20s
    const handleUpdate = () => carregarStatus();
    window.addEventListener('polihub_whatsapp_update', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    const interval = setInterval(carregarStatus, 20000);

    return () => {
      window.removeEventListener('polihub_whatsapp_update', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
      clearInterval(interval);
    };
  }, [carregarStatus]);

  // Se o usuário não for da Logística ou não estiver habilitado, oculta totalmente
  if (!status.habilitado) {
    return null;
  }

  // Estilização mandatória da Seção 6:
  // - Vermelha: existe pelo menos uma conversa aguardando atendimento (com contador)
  // - Laranja: usuário possui conversa em andamento e não há pendentes
  // - Escura: usuário habilitado mas sem conversas pendentes ou em andamento
  let containerClasses = '';
  let badgeColorClass = '';
  let dotClass = '';
  let labelText = 'WhatsApp';

  if (status.cor === 'red') {
    containerClasses =
      'bg-rose-500/15 border-rose-500/40 text-rose-300 hover:bg-rose-500/25 shadow-sm shadow-rose-950/40';
    badgeColorClass = 'bg-rose-600 text-white font-black';
    dotClass = 'bg-rose-500 animate-pulse';
    labelText = `${status.pendentes_count} ${
      status.pendentes_count === 1 ? 'pendente' : 'pendentes'
    }`;
  } else if (status.cor === 'orange') {
    containerClasses =
      'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25 shadow-sm shadow-amber-950/40';
    badgeColorClass = 'bg-amber-600 text-white font-black';
    dotClass = 'bg-amber-400';
    labelText = `${status.em_andamento_count} em curso`;
  } else {
    // Escura/desabilitada (sem conversas ativas no momento)
    containerClasses =
      'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700';
    badgeColorClass = 'bg-slate-800 text-slate-400';
    dotClass = 'bg-slate-600';
    labelText = 'Sem pendências';
  }

  return (
    <button
      type="button"
      id="btn-header-whatsapp-badge"
      onClick={onAbrirWhatsApp}
      title={`Atendimento WhatsApp: ${status.pendentes_count} aguardando, ${status.em_andamento_count} em andamento. Clique para abrir.`}
      className={`relative flex items-center gap-2 px-2.5 sm:px-3 h-11 min-h-[44px] rounded-xl border transition active:scale-95 cursor-pointer ${containerClasses}`}
    >
      {/* Ícone Oficial WhatsApp */}
      <div className="relative shrink-0 flex items-center justify-center">
        <svg
          className="w-4 h-4 fill-current"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>

        {/* Ponto indicador de estado */}
        <span
          className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${dotClass}`}
        />
      </div>

      {/* Rótulo de status e contador */}
      <div className="hidden xs:flex flex-col text-left leading-none">
        <span className="text-[10px] font-bold uppercase tracking-wider">
          WhatsApp
        </span>
        <span className="text-[11px] font-medium opacity-90 mt-0.5">
          {labelText}
        </span>
      </div>

      {/* Contador numérico de conversas pendentes */}
      {status.pendentes_count > 0 && (
        <span
          className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${badgeColorClass}`}
        >
          {status.pendentes_count > 99 ? '99+' : status.pendentes_count}
        </span>
      )}
    </button>
  );
};
