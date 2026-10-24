import React, { useState, useEffect } from 'react';
import { KeyRound, Mail, User, ShieldCheck, ArrowRight, Loader2, AlertCircle, CheckCircle2, ChevronLeft, AlertTriangle, Building2, Camera } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { UNIDADES_NEGOCIO_PADRAO } from '../../constants/unidades';
import { unidadesNegocioService } from '../../services/unidadesNegocioService';
import { UnidadeNegocio } from '../../types';
import { AvatarPickerModal } from '../common/AvatarPickerModal';
import {
  formatarParteNome,
  juntarNomeESobrenome,
  validarTamanhoNomeSobrenome,
} from '../../utils/nomeSobrenome';

export const AuthScreen: React.FC = () => {
  const { login, signup, signupDirect, recoverPassword, isConfigured } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup' | 'recovery'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    nome: string;
    email: string;
    unidade_negocio: string;
  } | null>(null);

  // Dynamic unidades list from database table
  const [unidadesList, setUnidadesList] = useState<UnidadeNegocio[]>([]);
  const [loadingUnidades, setLoadingUnidades] = useState(false);

  // Login inputs
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup inputs - Padronização: Nome (máx. 12) e Sobrenome (máx. 12) em Title Case (Item 6)
  const [signupPrimeiroNome, setSignupPrimeiroNome] = useState('');
  const [signupSobrenome, setSignupSobrenome] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupUnidade, setSignupUnidade] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [signupFoto, setSignupFoto] = useState<string | null>(null);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  // Recovery input
  const [recoveryEmail, setRecoveryEmail] = useState('');

  // Carrega as unidades de negócio ativas diretamente da tabela unidades_negocio
  useEffect(() => {
    let isMounted = true;

    const carregarUnidades = async () => {
      try {
        setLoadingUnidades(true);
        const lista = await unidadesNegocioService.listarAtivas();
        if (isMounted) {
          if (lista && lista.length > 0) {
            setUnidadesList(lista);
          } else {
            // Fallback caso a tabela esteja vazia
            setUnidadesList(
              UNIDADES_NEGOCIO_PADRAO.map((u) => ({
                id: u.id,
                nome: u.nome,
                sigla: u.sigla,
                ativo: true,
              }))
            );
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar unidades de negócio no cadastro:', err);
      } finally {
        if (isMounted) setLoadingUnidades(false);
      }
    };

    carregarUnidades();

    const handleRefresh = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        const ativas = e.detail.filter((u: UnidadeNegocio) => u.ativo !== false);
        setUnidadesList(ativas);
      } else {
        carregarUnidades();
      }
    };

    window.addEventListener('polihub_unidades_refresh', handleRefresh);
    return () => {
      isMounted = false;
      window.removeEventListener('polihub_unidades_refresh', handleRefresh);
    };
  }, []);

  const clearMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!loginEmail.trim() || !loginPassword) {
      setError('Por favor, informe seu e-mail e senha.');
      return;
    }

    setLoading(true);
    const res = await login(loginEmail, loginPassword);
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Credenciais inválidas. Verifique seu e-mail e senha.');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setRateLimitInfo(null);

    const validacaoNome = validarTamanhoNomeSobrenome(signupPrimeiroNome, signupSobrenome);
    if (!validacaoNome.valido) {
      setError(validacaoNome.erro || 'Informe nome e sobrenome válidos (máximo 12 caracteres cada).');
      return;
    }

    const nomeFormatado = juntarNomeESobrenome(signupPrimeiroNome, signupSobrenome);

    if (!signupUnidade.trim()) {
      setError('Por favor, selecione sua unidade de negócio.');
      return;
    }
    if (!signupEmail.trim() || !signupEmail.includes('@')) {
      setError('Informe um e-mail válido.');
      return;
    }
    if (signupPassword.length < 6) {
      setError('A senha deve conter no mínimo 6 caracteres.');
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      setError('A confirmação de senha não confere.');
      return;
    }

    setLoading(true);
    const res = await signup({
      nome: nomeFormatado,
      email: signupEmail,
      senha: signupPassword,
      unidade_negocio: signupUnidade,
      foto: signupFoto || null,
    });
    setLoading(false);

    if (!res.success) {
      if (res.isRateLimit) {
        setRateLimitInfo({
          nome: nomeFormatado,
          email: signupEmail,
          unidade_negocio: signupUnidade,
        });
      } else {
        setError(res.error || 'Erro ao realizar cadastro.');
      }
    } else {
      setSuccessMessage('Cadastro realizado com sucesso! Seu acesso está pendente de aprovação por um gestor.');
    }
  };

  const handleContinueDirect = async () => {
    if (!rateLimitInfo) return;
    setLoading(true);
    await signupDirect({
      nome: rateLimitInfo.nome,
      email: rateLimitInfo.email,
      unidade_negocio: rateLimitInfo.unidade_negocio || signupUnidade,
      foto: signupFoto || null,
    });
    setLoading(false);
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!recoveryEmail.trim() || !recoveryEmail.includes('@')) {
      setError('Informe um e-mail válido para recuperação.');
      return;
    }

    setLoading(true);
    const res = await recoverPassword(recoveryEmail);
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Falha ao solicitar recuperação de senha.');
    } else {
      setSuccessMessage(res.message || 'Link de recuperação enviado com sucesso!');
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col justify-between p-4 sm:p-6 md:p-10 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar / Brand Header */}
      <header className="relative z-10 w-full max-w-md mx-auto flex items-center justify-between pt-2 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 p-0.5 shadow-lg shadow-blue-900/30 flex items-center justify-center">
            <img src="/icon.svg" alt="Polifiltro" className="w-8 h-8 rounded-lg" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
              POLIFILTRO
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                WMS
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">Logística Inteligente</p>
          </div>
        </div>

        <PWAInstallButton compact />
      </header>

      {/* Main Authentication Card */}
      <main className="relative z-10 w-full max-w-md mx-auto my-auto py-4">
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          {/* Header Title depending on mode */}
          <div className="mb-6">
            {mode === 'recovery' && (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  clearMessages();
                }}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-3 min-h-[36px] transition"
              >
                <ChevronLeft className="w-4 h-4" />
                Voltar para o login
              </button>
            )}

            <h2 className="text-2xl font-bold text-white tracking-tight">
              {mode === 'login' && 'Acessar o Polifiltro'}
              {mode === 'signup' && 'Criar Nova Conta'}
              {mode === 'recovery' && 'Recuperar Senha'}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {mode === 'login' && 'Entre com seu e-mail e senha de operador logístico.'}
              {mode === 'signup' && 'Cadastre seus dados para solicitação de acesso ao sistema.'}
              {mode === 'recovery' && 'Digite seu e-mail para receber as instruções de redefinição.'}
            </p>
          </div>

          {/* Feedback alerts */}
          {rateLimitInfo && (
            <div className="mb-5 rounded-3xl bg-amber-500/10 border border-amber-500/40 p-4 sm:p-5 text-xs text-amber-200 space-y-3.5 shadow-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-300 text-sm">Limite de E-mails do Supabase Atingido</h4>
                  <p className="mt-1 text-amber-200/90 leading-relaxed text-xs">
                    O Supabase limita o envio de e-mails em contas gratuitas a cerca de 3 a 4 por hora. Por padrão, ele tenta enviar um e-mail de confirmação a cada novo cadastro.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-950/80 border border-amber-500/20 p-3.5 text-[11px] space-y-2 text-slate-300">
                <div className="font-bold text-amber-300 flex items-center gap-1">
                  <span>Como desativar isso no Supabase para sempre:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-300">
                  <li>No painel do Supabase, clique em <strong>Authentication</strong>.</li>
                  <li>Acesse <strong>Providers</strong> e clique em <strong>Email</strong>.</li>
                  <li>Desmarque a opção <strong>Confirm email</strong> (desativar).</li>
                  <li>Clique em <strong>Save</strong>.</li>
                </ol>
                <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                  Ao desmarcar, os novos cadastros entram direto sem depender do envio de e-mail e sem esse erro.
                </p>
              </div>

              <button
                type="button"
                id="btn-bypass-rate-limit"
                onClick={handleContinueDirect}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:scale-98 text-slate-950 font-bold text-xs shadow-lg transition min-h-[46px] cursor-pointer"
              >
                <span>Concluir Cadastro no Sistema</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 p-3.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-3.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <div className="flex-1">{successMessage}</div>
            </div>
          )}

          {/* 1. LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  E-mail
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    id="input-login-email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="operador@polifiltro.com.br"
                    autoComplete="email"
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition min-h-[48px]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('recovery');
                      clearMessages();
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 min-h-[32px] flex items-center font-medium"
                  >
                    Esqueci a senha
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    id="input-login-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition min-h-[48px]"
                  />
                </div>
              </div>

              <button
                type="submit"
                id="btn-login-submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold py-3.5 px-5 shadow-lg shadow-blue-600/30 transition active:scale-98 disabled:opacity-50 min-h-[50px] mt-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Autenticando...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar no Sistema</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <div className="pt-4 border-t border-slate-800 text-center">
                <p className="text-xs text-slate-400">
                  Novo operador no galpão?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      clearMessages();
                      setSignupUnidade('');
                    }}
                    className="text-blue-400 hover:text-blue-300 font-semibold ml-1 underline underline-offset-4 min-h-[32px] inline-flex items-center"
                  >
                    Criar cadastro
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* 2. SIGNUP FORM */}
          {mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-3.5" noValidate>
              {/* Foto de Perfil ou Avatar */}
              <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="relative group">
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-blue-500/40 bg-slate-800 shrink-0 flex items-center justify-center">
                    {signupFoto ? (
                      <img
                        src={signupFoto}
                        alt="Foto de perfil"
                        className="w-full h-full object-cover object-center rounded-full"
                      />
                    ) : (
                      <div className="w-full h-full bg-blue-600/10 text-blue-400 flex items-center justify-center font-bold text-lg">
                        <Camera className="w-6 h-6 text-blue-400/80" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white">Foto ou Avatar</p>
                  <p className="text-[11px] text-slate-400">Opcional: personalize seu perfil</p>
                  <button
                    type="button"
                    onClick={() => setShowAvatarModal(true)}
                    className="mt-1 text-xs text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2 flex items-center gap-1"
                  >
                    <span>{signupFoto ? 'Trocar foto / avatar' : 'Escolher foto ou avatar'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Primeiro Nome <span className="text-rose-400">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {signupPrimeiroNome.length}/12
                    </span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <User className="w-4 h-4 text-blue-400" />
                    </div>
                    <input
                      type="text"
                      id="input-signup-primeiro-nome"
                      maxLength={12}
                      value={signupPrimeiroNome}
                      onChange={(e) => setSignupPrimeiroNome(formatarParteNome(e.target.value))}
                      onBlur={(e) => setSignupPrimeiroNome(formatarParteNome(e.target.value))}
                      placeholder="Ex: Carlos"
                      autoComplete="given-name"
                      className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl pl-10 pr-3 py-3 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition min-h-[46px]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Sobrenome <span className="text-rose-400">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {signupSobrenome.length}/12
                    </span>
                  </div>
                  <input
                    type="text"
                    id="input-signup-sobrenome"
                    maxLength={12}
                    value={signupSobrenome}
                    onChange={(e) => setSignupSobrenome(formatarParteNome(e.target.value))}
                    onBlur={(e) => setSignupSobrenome(formatarParteNome(e.target.value))}
                    placeholder="Ex: Eduardo"
                    autoComplete="family-name"
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition min-h-[46px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Unidade de Negócio <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Building2 className="w-5 h-5 text-blue-400" />
                  </div>
                  <select
                    id="select-signup-unidade"
                    required
                    value={signupUnidade}
                    onChange={(e) => setSignupUnidade(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl pl-11 pr-8 py-3 text-sm text-white focus:outline-hidden focus:border-blue-500 transition min-h-[46px] appearance-none cursor-pointer"
                  >
                    <option value="" disabled className="bg-slate-900 text-slate-400">
                      {loadingUnidades ? 'Carregando unidades...' : 'Selecione a unidade de negócio...'}
                    </option>
                    {unidadesList.map((u) => (
                      <option key={u.id} value={u.nome} className="bg-slate-900 text-white">
                        {u.nome} {u.sigla ? `(${u.sigla})` : ''} {u.estado ? `- ${u.estado}` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500 text-xs">
                    ▼
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Selecione a filial ou unidade operacional em que você atua.
                </p>
              </div>


              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  E-mail
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    id="input-signup-email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="carlos@empresa.com.br"
                    autoComplete="email"
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition min-h-[46px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Senha
                  </label>
                  <input
                    type="password"
                    id="input-signup-password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Mínimo 6 dígitos"
                    autoComplete="new-password"
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition min-h-[46px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Confirmar Senha
                  </label>
                  <input
                    type="password"
                    id="input-signup-confirm"
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    autoComplete="new-password"
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition min-h-[46px]"
                  />
                </div>
              </div>

              <button
                type="submit"
                id="btn-signup-submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold py-3.5 px-5 shadow-lg shadow-blue-600/30 transition active:scale-98 disabled:opacity-50 min-h-[50px] mt-3 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Cadastrando...</span>
                  </>
                ) : (
                  <>
                    <span>Concluir Cadastro & Entrar</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <div className="pt-3 border-t border-slate-800 text-center">
                <p className="text-xs text-slate-400">
                  Já possui conta?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      clearMessages();
                    }}
                    className="text-blue-400 hover:text-blue-300 font-semibold ml-1 underline underline-offset-4 min-h-[32px] inline-flex items-center"
                  >
                    Fazer Login
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* 3. PASSWORD RECOVERY FORM */}
          {mode === 'recovery' && (
            <form onSubmit={handleRecovery} className="space-y-4" noValidate>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  E-mail de Cadastro
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    id="input-recovery-email"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="seu.email@empresa.com.br"
                    autoComplete="email"
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition min-h-[48px]"
                  />
                </div>
              </div>

              <button
                type="submit"
                id="btn-recovery-submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 px-5 shadow-lg shadow-blue-600/30 transition active:scale-98 disabled:opacity-50 min-h-[50px] cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Enviando link...</span>
                  </>
                ) : (
                  <span>Enviar Instruções por E-mail</span>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Supabase connection status pill */}
        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-slate-400">
          <span
            className={`w-2 h-2 rounded-full ${
              isConfigured ? 'bg-emerald-400 ring-4 ring-emerald-500/20' : 'bg-amber-400 ring-4 ring-amber-500/20'
            }`}
          />
          <span>
            {isConfigured
              ? 'Conectado com Supabase Auth & PostgreSQL'
              : 'Modo Pré-visualização / Dados Locais Ativos'}
          </span>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-md mx-auto text-center py-2 text-xs text-slate-500">
        Polifiltro Logistics &copy; {new Date().getFullYear()} — Logística Inteligente
      </footer>

      {/* Modal de Escolha de Foto e Avatar no Cadastro */}
      <AvatarPickerModal
        isOpen={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        currentPhoto={signupFoto}
        userName={juntarNomeESobrenome(signupPrimeiroNome, signupSobrenome) || 'Operador'}
        userId={`temp-signup-${Date.now()}`}
        onSelectPhoto={(photoUrl) => {
          setSignupFoto(photoUrl);
        }}
      />
    </div>
  );
};
