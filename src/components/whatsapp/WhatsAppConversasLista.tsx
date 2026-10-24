import React, { useState } from 'react';
import {
  Search,
  X,
  Clock,
  Layers,
  Building2,
  User,
  Inbox,
  Filter,
} from 'lucide-react';
import { WhatsAppConversa, WhatsAppStatusConversa } from '../../types';
import { formatarTelefoneExibicao } from '../../services/whatsappService';

interface WhatsAppConversasListaProps {
  conversas: WhatsAppConversa[];
  conversaSelecionadaId: string | null;
  statusTab: 'aguardando' | 'em_andamento' | 'encerrado';
  onChangeStatusTab: (status: 'aguardando' | 'em_andamento' | 'encerrado') => void;
  onSelecionarConversa: (conversa: WhatsAppConversa) => void;
  termoBusca: string;
  onTermoBuscaChange: (termo: string) => void;
  contadores: {
    aguardando: number;
    em_andamento: number;
    encerrado: number;
  };
}

export const WhatsAppConversasLista: React.FC<WhatsAppConversasListaProps> = ({
  conversas,
  conversaSelecionadaId,
  statusTab,
  onChangeStatusTab,
  onSelecionarConversa,
  termoBusca,
  onTermoBuscaChange,
  contadores,
}) => {
  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
      {/* 1. Abas de Organização das Conversas (Seção 7) */}
      <div className="p-3 bg-slate-950/70 border-b border-slate-800">
        <div className="grid grid-cols-3 gap-1 bg-slate-900/90 p-1 rounded-2xl border border-slate-800/80">
          <button
            type="button"
            id="tab-conv-aguardando"
            onClick={() => onChangeStatusTab('aguardando')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition text-center min-h-[44px] cursor-pointer ${
              statusTab === 'aguardando'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-black shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <span className="text-[11px] font-bold">Aguardando</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full mt-0.5 ${
                contadores.aguardando > 0 ? 'bg-rose-600 text-white font-black' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {contadores.aguardando}
            </span>
          </button>

          <button
            type="button"
            id="tab-conv-em-andamento"
            onClick={() => onChangeStatusTab('em_andamento')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition text-center min-h-[44px] cursor-pointer ${
              statusTab === 'em_andamento'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-black shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <span className="text-[11px] font-bold">Em Curso</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full mt-0.5 ${
                contadores.em_andamento > 0 ? 'bg-emerald-600 text-white font-black' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {contadores.em_andamento}
            </span>
          </button>

          <button
            type="button"
            id="tab-conv-encerradas"
            onClick={() => onChangeStatusTab('encerrado')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition text-center min-h-[44px] cursor-pointer ${
              statusTab === 'encerrado'
                ? 'bg-slate-800 text-white font-black shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <span className="text-[11px] font-bold">Encerradas</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 mt-0.5">
              {contadores.encerrado}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Campo de Pesquisa */}
      <div className="p-3 border-b border-slate-800">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            id="input-pesquisa-conversas"
            value={termoBusca}
            onChange={(e) => onTermoBuscaChange(e.target.value)}
            placeholder="Buscar por contato, número ou fila..."
            className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 min-h-[40px]"
          />
          {termoBusca && (
            <button
              type="button"
              onClick={() => onTermoBuscaChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Lista de Conversas com Scroll */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1">
        {conversas.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Inbox className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs font-semibold text-slate-300">
              Nenhuma conversa nesta aba
            </p>
            <p className="text-[11px] text-slate-500 max-w-[200px] mx-auto">
              Quando clientes entrarem em contato pelo WhatsApp, as conversas serão direcionadas para cá.
            </p>
          </div>
        ) : (
          conversas.map((c) => {
            const isSelecionada = c.id === conversaSelecionadaId;
            const horaFormatada = new Date(c.ultima_mensagem_data).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={c.id}
                id={`card-conversa-${c.id}`}
                onClick={() => onSelecionarConversa(c)}
                className={`p-3 rounded-2xl transition cursor-pointer text-left border ${
                  isSelecionada
                    ? 'bg-blue-600/15 border-blue-500/50 shadow-md'
                    : 'bg-slate-950/40 hover:bg-slate-800/60 border-slate-800/60'
                }`}
              >
                {/* Linha 1: Nome do Contato e Horário */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        c.status === 'aguardando'
                          ? 'bg-rose-500 animate-pulse'
                          : c.status === 'em_andamento'
                          ? 'bg-emerald-400'
                          : 'bg-slate-600'
                      }`}
                    />
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                      {c.nome_remetente}
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                    {horaFormatada}
                  </span>
                </div>

                {/* Linha 2: Telefone formatado e Fila */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                  <span className="font-mono text-slate-400">
                    {formatarTelefoneExibicao(c.numero_remetente)}
                  </span>
                  <span className="font-semibold text-amber-300/90 text-[10px] bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                    {c.fila_nome}
                  </span>
                </div>

                {/* Linha 3: Snippet da Última Mensagem */}
                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed mb-2">
                  {c.ultima_mensagem_texto || 'Sem mensagens'}
                </p>

                {/* Linha 4: Responsável e Unidade */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-800/60">
                  <div className="flex items-center gap-1 truncate max-w-[150px]">
                    <User className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {c.usuario_atribuido_nome || 'Sem atendente'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 text-slate-400">
                    <Building2 className="w-3 h-3 text-blue-400" />
                    <span>{c.unidade_negocio}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
