import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MessageSquare,
  ShieldAlert,
  Sliders,
  Inbox,
  RefreshCw,
  Building2,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  canUserAccessWhatsApp,
  canUserAdminWhatsApp,
  isUserGestor,
} from '../../lib/permissions';
import { WhatsAppConversa } from '../../types';
import { whatsappService } from '../../services/whatsappService';
import { WhatsAppConversasLista } from './WhatsAppConversasLista';
import { WhatsAppChatView } from './WhatsAppChatView';
import { WhatsAppAdminPanel } from './WhatsAppAdminPanel';

interface WhatsAppModuleProps {
  onVoltarParaHome?: () => void;
}

export const WhatsAppModule: React.FC<WhatsAppModuleProps> = ({ onVoltarParaHome }) => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'atendimento' | 'admin'>('atendimento');

  // Conversas e estado de seleção
  const [conversas, setConversas] = useState<WhatsAppConversa[]>([]);
  const [conversaSelecionada, setConversaSelecionada] = useState<WhatsAppConversa | null>(null);
  const [statusTab, setStatusTab] = useState<'aguardando' | 'em_andamento' | 'encerrado'>('aguardando');
  const [termoBusca, setTermoBusca] = useState('');
  const [loading, setLoading] = useState(true);

  // Validação de acesso ao departamento de Logística (Seção 1)
  const isLogistica = canUserAccessWhatsApp(user);
  const isGestor = canUserAdminWhatsApp(user);

  const carregarConversas = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await whatsappService.listarConversas({
        unidade: user.unidade_negocio,
      });
      setConversas(data);

      // Mantém a conversa ativa selecionada atualizada
      if (conversaSelecionada) {
        const atual = data.find((c) => c.id === conversaSelecionada.id);
        if (atual) setConversaSelecionada(atual);
      }
    } catch (err) {
      console.error('Erro ao listar conversas do WhatsApp:', err);
    } finally {
      setLoading(false);
    }
  }, [user, conversaSelecionada?.id]);

  useEffect(() => {
    if (isLogistica) {
      carregarConversas();
    }
    const handleUpdate = () => {
      carregarConversas();
    };
    window.addEventListener('polihub_whatsapp_update', handleUpdate);
    return () => window.removeEventListener('polihub_whatsapp_update', handleUpdate);
  }, [isLogistica, carregarConversas]);

  // Se o usuário não for do departamento Logística, bloqueia o acesso
  if (!isLogistica) {
    return (
      <div className="max-w-xl mx-auto mt-12 p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-white">Acesso Restrito ao Departamento</h2>
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
          O módulo de Atendimento WhatsApp Business Inteligente é restrito exclusivamente aos colaboradores do departamento <strong>Logística</strong>.
        </p>
        {onVoltarParaHome && (
          <button
            type="button"
            onClick={onVoltarParaHome}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition min-h-[44px] cursor-pointer"
          >
            Voltar ao Início
          </button>
        )}
      </div>
    );
  }

  // Contadores por status
  const contadores = useMemo(() => {
    return {
      aguardando: conversas.filter((c) => c.status === 'aguardando').length,
      em_andamento: conversas.filter((c) => c.status === 'em_andamento').length,
      encerrado: conversas.filter((c) => c.status === 'encerrado').length,
    };
  }, [conversas]);

  // Filtragem da lista exibida
  const conversasFiltradas = useMemo(() => {
    let filtradas = conversas.filter((c) => c.status === statusTab);
    if (termoBusca.trim()) {
      const term = termoBusca.trim().toLowerCase();
      filtradas = filtradas.filter(
        (c) =>
          c.nome_remetente.toLowerCase().includes(term) ||
          c.numero_remetente.toLowerCase().includes(term) ||
          c.fila_nome.toLowerCase().includes(term) ||
          (c.ultima_mensagem_texto || '').toLowerCase().includes(term)
      );
    }
    return filtradas;
  }, [conversas, statusTab, termoBusca]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-20 md:pb-8 animate-in fade-in duration-200">
      {/* Header do Módulo */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              Meta WhatsApp Business Platform
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              {user?.unidade_negocio || 'Goiânia'}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <span>Atendimento WhatsApp</span>
            <span className="text-xs font-mono font-bold text-slate-400 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
              {conversas.length} {conversas.length === 1 ? 'conversa' : 'conversas'}
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
            Identificação inteligente de contatos, respostas automáticas configuráveis e direcionamento por fila na Logística.
          </p>
        </div>

        {/* Toggle para Painel do Gestor (Se for Gestor da Logística) */}
        <div className="flex items-center gap-2">
          {isGestor && (
            <button
              type="button"
              id="btn-toggle-admin-whatsapp"
              onClick={() => setViewMode((prev) => (prev === 'admin' ? 'atendimento' : 'admin'))}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition shadow-md min-h-[44px] cursor-pointer ${
                viewMode === 'admin'
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                  : 'bg-slate-900 border border-slate-800 text-amber-400 hover:bg-slate-850 hover:border-amber-500/40'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>{viewMode === 'admin' ? 'Voltar ao Atendimento' : 'Painel do Gestor'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={carregarConversas}
            disabled={loading}
            title="Recarregar conversas"
            className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Renderização Condicional: Painel do Gestor ou Caixa de Entrada */}
      {viewMode === 'admin' && isGestor ? (
        <WhatsAppAdminPanel
          usuarioLogado={user!}
          onVoltarParaAtendimento={() => setViewMode('atendimento')}
        />
      ) : (
        /* Caixa de Entrada em 2 Colunas (Responsiva) */
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-[calc(100vh-230px)] min-h-[580px]">
          {/* Coluna 1: Lista de Conversas (Esquerda) */}
          <div
            className={`md:col-span-5 lg:col-span-4 h-full ${
              conversaSelecionada ? 'hidden md:block' : 'block'
            }`}
          >
            <WhatsAppConversasLista
              conversas={conversasFiltradas}
              conversaSelecionadaId={conversaSelecionada?.id || null}
              statusTab={statusTab}
              onChangeStatusTab={(st) => {
                setStatusTab(st);
                // Se a conversa atual não for da nova aba, desmarca
                if (conversaSelecionada && conversaSelecionada.status !== st) {
                  setConversaSelecionada(null);
                }
              }}
              onSelecionarConversa={(c) => setConversaSelecionada(c)}
              termoBusca={termoBusca}
              onTermoBuscaChange={setTermoBusca}
              contadores={contadores}
            />
          </div>

          {/* Coluna 2: Chat da Conversa Ativa (Direita) */}
          <div
            className={`md:col-span-7 lg:col-span-8 h-full ${
              conversaSelecionada ? 'block' : 'hidden md:block'
            }`}
          >
            {conversaSelecionada ? (
              <WhatsAppChatView
                conversa={conversaSelecionada}
                usuarioLogado={user!}
                onAtualizarConversa={carregarConversas}
                onVoltarMobile={() => setConversaSelecionada(null)}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-900/60 border border-slate-800 rounded-3xl text-center space-y-3">
                <div className="w-16 h-16 rounded-3xl bg-slate-800/80 border border-slate-700/60 text-slate-500 flex items-center justify-center">
                  <Inbox className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-white">Nenhum Atendimento Selecionado</h3>
                <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                  Selecione uma conversa na lista ao lado para visualizar o histórico de mensagens, assumir o atendimento ou responder.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
