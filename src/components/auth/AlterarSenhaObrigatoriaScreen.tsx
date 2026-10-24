import React, { useState } from 'react';
import { KeyRound, ShieldAlert, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, LogOut, Lock } from 'lucide-react';
import { Usuario } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface AlterarSenhaObrigatoriaScreenProps {
  user: Usuario;
  onLogout: () => Promise<void>;
  onSuccess?: () => void;
}

export const AlterarSenhaObrigatoriaScreen: React.FC<AlterarSenhaObrigatoriaScreenProps> = ({
  user,
  onLogout,
  onSuccess,
}) => {
  const { alterarSenhaObrigatoria } = useAuth();
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Validações
  const temTamanhoMinimo = novaSenha.length >= 6;
  const senhasCoincidem = Boolean(novaSenha && novaSenha === confirmarSenha);
  const isFormValido = temTamanhoMinimo && senhasCoincidem;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!novaSenha.trim()) {
      setError('Por favor, informe a nova senha.');
      return;
    }

    if (!temTamanhoMinimo) {
      setError('A nova senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (!senhasCoincidem) {
      setError('A confirmação da senha não coincide com a nova senha digitada.');
      return;
    }

    setLoading(true);
    try {
      const res = await alterarSenhaObrigatoria(novaSenha.trim());
      if (!res.success) {
        setError(res.error || 'Erro ao atualizar senha. Tente novamente.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha inesperada ao cadastrar nova senha.';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100 antialiased selection:bg-amber-500 selection:text-slate-950">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabeçalho com Ícone de Chave e Alerta */}
        <div className="text-center space-y-3">
          <div className="relative inline-block mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-xl shadow-amber-950/40">
              <KeyRound className="w-10 h-10 animate-pulse" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-slate-900 border-2 border-amber-500 flex items-center justify-center text-amber-400">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/15 border border-amber-500/30 text-amber-300">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Alteração Obrigatória de Senha</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Cadastrar Nova Senha
          </h2>

          {/* Mensagem oficial exigida pelo sistema */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-left">
            <p className="text-xs sm:text-sm text-amber-200 font-semibold leading-relaxed flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Por segurança, seu gestor solicitou a alteração da sua senha. Cadastre uma nova senha para continuar.</span>
            </p>
          </div>

          {/* Dados do Usuário */}
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
            <span className="font-semibold text-white truncate">{user.nome}</span>
            <span className="font-mono text-slate-400 shrink-0">
              {user.codigo ? `[${user.codigo}]` : user.email || ''}
            </span>
          </div>
        </div>

        {/* Mensagem de Erro Geral */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Mensagem de Sucesso */}
        {success ? (
          <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-center space-y-2 animate-in fade-in">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h4 className="text-sm font-bold text-white">Senha alterada com sucesso!</h4>
            <p className="text-xs text-emerald-300">Liberando acesso ao PoliHUB...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo 1: Nova Senha */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-slate-300 block">
                Nova Senha <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showNovaSenha ? 'text' : 'password'}
                  id="input-nova-senha-obrigatoria"
                  value={novaSenha}
                  onChange={(e) => {
                    setNovaSenha(e.target.value);
                    setError(null);
                  }}
                  disabled={loading}
                  placeholder="Digite sua nova senha"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-hidden focus:border-amber-500 transition placeholder:text-slate-600"
                  autoComplete="new-password"
                  autoFocus
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowNovaSenha(!showNovaSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition cursor-pointer"
                  title={showNovaSenha ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showNovaSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Campo 2: Confirmar Nova Senha */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-slate-300 block">
                Confirmar Nova Senha <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmarSenha ? 'text' : 'password'}
                  id="input-confirmar-senha-obrigatoria"
                  value={confirmarSenha}
                  onChange={(e) => {
                    setConfirmarSenha(e.target.value);
                    setError(null);
                  }}
                  disabled={loading}
                  placeholder="Repita a nova senha exatamente igual"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-hidden focus:border-amber-500 transition placeholder:text-slate-600"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition cursor-pointer"
                  title={showConfirmarSenha ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showConfirmarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Requisitos de Segurança */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-left space-y-1.5 text-xs">
              <span className="font-semibold text-slate-400 block text-[11px] uppercase tracking-wider">
                Critérios de Segurança:
              </span>
              <div className="flex items-center gap-2">
                <div
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${
                    temTamanhoMinimo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-600'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <span className={temTamanhoMinimo ? 'text-slate-200 font-medium' : 'text-slate-500'}>
                  Mínimo de 6 caracteres
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${
                    senhasCoincidem ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-600'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <span className={senhasCoincidem ? 'text-slate-200 font-medium' : 'text-slate-500'}>
                  As duas senhas coincidem exatamente
                </span>
              </div>
            </div>

            {/* Botão de Envio */}
            <button
              type="submit"
              id="btn-confirmar-nova-senha-obrigatoria"
              disabled={loading || !isFormValido}
              className={`w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition shadow-lg cursor-pointer ${
                isFormValido && !loading
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-950/50 hover:shadow-amber-500/20 active:scale-[0.99]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Cadastrando nova senha...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Salvar Nova Senha e Continuar</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Botão de Logout Secundário */}
        <div className="pt-2 border-t border-slate-800/80">
          <button
            type="button"
            id="btn-logout-senha-obrigatoria"
            onClick={onLogout}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
            title="Sair do sistema e trocar a senha em outro momento"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair da conta</span>
          </button>
        </div>
      </div>
    </div>
  );
};
