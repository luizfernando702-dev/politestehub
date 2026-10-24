import React, { useState } from 'react';
import { Clock, UserX, RefreshCw, LogOut, ShieldAlert, CheckCircle2, User } from 'lucide-react';
import { Usuario } from '../../types';

interface BlockedUserScreenProps {
  user: Usuario;
  status: 'pendente' | 'desativado' | string;
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
}

export const BlockedUserScreen: React.FC<BlockedUserScreenProps> = ({
  user,
  status,
  onRefresh,
  onLogout,
}) => {
  const [checking, setChecking] = useState(false);
  const [justChecked, setJustChecked] = useState(false);

  const isPendente = status === 'pendente';
  const isDesativado = status === 'desativado';

  const handleRefresh = async () => {
    setChecking(true);
    setJustChecked(false);
    try {
      await onRefresh();
      setJustChecked(true);
      setTimeout(() => setJustChecked(false), 3000);
    } catch (e) {
      console.warn('Erro ao atualizar status:', e);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100 antialiased selection:bg-blue-500 selection:text-white">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Top Icon */}
        <div
          className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto shadow-xl ${
            isPendente
              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-amber-950/40'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-400 shadow-rose-950/40'
          }`}
        >
          {isPendente ? (
            <Clock className="w-10 h-10 animate-pulse" />
          ) : (
            <UserX className="w-10 h-10" />
          )}
        </div>

        {/* Title and Message */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-1 bg-slate-800 border border-slate-700 text-slate-300">
            {isPendente ? 'Aguardando Liberação' : 'Acesso Bloqueado'}
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {isPendente ? 'Cadastro Pendente de Aprovação' : 'Conta Desativada'}
          </h2>

          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            {isPendente ? (
              <>
                Olá, <strong className="text-white">{user.nome}</strong>. Seu cadastro foi recebido com sucesso,
                mas seu acesso ao sistema PoliHub está <span className="text-amber-300 font-semibold">pendente de aprovação por um gestor</span>.
              </>
            ) : (
              <>
                Olá, <strong className="text-white">{user.nome}</strong>. Sua conta no PoliHub está{' '}
                <span className="text-rose-300 font-semibold">desativada</span>. Entre em contato com a gestão
                de logística ou administração para reativação do seu acesso.
              </>
            )}
          </p>
        </div>

        {/* User Card */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-left space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span>Operador / Usuário:</span>
            <strong className="text-white font-medium">{user.nome}</strong>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Código de Acesso:</span>
            <strong className="text-sky-400 font-mono font-bold">{user.codigo}</strong>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Departamento:</span>
            <span className="text-slate-300">{user.departamento || 'Logística'}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Status no Sistema:</span>
            <span
              className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                isPendente
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}
            >
              {isPendente ? 'Pendente de Aprovação' : 'Desativado'}
            </span>
          </div>
        </div>

        {/* Verification notice if clicked */}
        {justChecked && (
          <div className="p-3 rounded-xl bg-slate-800/80 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-sky-400" />
            <span>Status verificado. Ainda aguardando liberação de um gestor.</span>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            id="btn-verificar-aprovacao"
            onClick={handleRefresh}
            disabled={checking}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-900/40 transition min-h-[44px]"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Verificando com o servidor...' : 'Verificar Aprovação Novamente'}</span>
          </button>

          <button
            type="button"
            id="btn-logout-blocked"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white text-xs sm:text-sm font-semibold transition min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair / Entrar com outra conta</span>
          </button>
        </div>
      </div>
    </div>
  );
};
