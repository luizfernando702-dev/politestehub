import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { Usuario } from '../types';
import { getLocalUsuarios, saveLocalUsuarios } from '../services/mockStorage';
import { usuariosService } from '../services/usuariosService';
import { UNIDADE_PADRAO_SISTEMA } from '../constants/unidades';
import { setActiveUserProfile } from '../services/sessionHelper';

interface AuthContextType {
  user: Usuario | null;
  email: string | null;
  loading: boolean;
  isConfigured: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signup: (data: {
    nome: string;
    codigo?: string;
    email: string;
    senha: string;
    unidade_negocio: string;
    departamento?: string;
    funcao?: string;
    foto?: string | null;
    tema_escuro?: boolean | null;
  }) => Promise<{ success: boolean; error?: string; isRateLimit?: boolean }>;
  signupDirect: (data: {
    nome: string;
    codigo?: string;
    email: string;
    unidade_negocio: string;
    departamento?: string;
    funcao?: string;
    foto?: string | null;
    tema_escuro?: boolean | null;
  }) => Promise<{ success: boolean }>;
  recoverPassword: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  switchUser: (userId: string) => void;
  updateUserPhoto: (fotoUrl: string | null) => Promise<void>;
  alterarSenhaObrigatoria: (novaSenha: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_SESSION_KEY = 'polihub_active_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Usuario | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Mantém os dados da sessão sincronizados para chamadas síncronas de filtros
  useEffect(() => {
    setActiveUserProfile(user);
  }, [user]);

  // Initialize session
  useEffect(() => {
    let mounted = true;
    const supabase = getSupabase();

    async function initAuth() {
      setLoading(true);

      if (isSupabaseConfigured && supabase) {
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) {
            console.warn('Erro ao obter sessão Supabase:', error);
          }

          if (session?.user && mounted) {
            const authEmail = session.user.email?.toLowerCase().trim() || null;
            setEmail(authEmail);
            if (authEmail) {
              usuariosService.salvarEmailCache(session.user.id, authEmail);
            }
            const profile = await usuariosService.getById(session.user.id);
            if (profile && mounted) {
              const statusNorm = (profile.status || 'aprovado').toLowerCase().trim();
              if (statusNorm === 'desativado' || statusNorm === 'inativo' || statusNorm === 'pendente') {
                await supabase.auth.signOut();
                setUser(null);
                setEmail(null);
              } else {
                if (authEmail && (!profile.email || profile.email !== authEmail)) {
                  profile.email = authEmail;
                  usuariosService.atualizarEmail(session.user.id, authEmail).catch((err) => {
                    console.warn('Aviso ao sincronizar email com Supabase:', err);
                  });
                }
                setUser(profile);
              }
            } else if (mounted) {
              // Fallback default profile if not yet inserted in table
              const fallback = {
                id: session.user.id,
                nome: (session.user.user_metadata?.nome as string) || authEmail?.split('@')[0] || 'Operador Logístico',
                codigo: (session.user.user_metadata?.codigo as string) || 'OP-1001',
                email: authEmail,
                unidade_negocio: (session.user.user_metadata?.unidade_negocio as string) || UNIDADE_PADRAO_SISTEMA,
                departamento: 'Logística',
                funcao: 'Operador Logístico',
                nivel: 'Operador' as const,
                status: 'aprovado' as const,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              setUser(fallback as Usuario);
              usuariosService.createOrUpdate(fallback).catch(console.warn);
            }
          } else {
            setUser(null);
            setEmail(null);
          }
        } catch (err) {
          console.warn('Falha na inicialização do auth:', err);
          setUser(null);
          setEmail(null);
        }
      } else {
        // Local persistent session
        try {
          const savedSession = localStorage.getItem(LOCAL_SESSION_KEY);
          if (savedSession) {
            const parsed = JSON.parse(savedSession);
            const localUsers = getLocalUsuarios();
            const found = localUsers.find((u) => u.id === parsed.id);
            if (found) {
              const statusNorm = (found.status || 'aprovado').toLowerCase().trim();
              if (statusNorm === 'desativado' || statusNorm === 'inativo' || statusNorm === 'pendente') {
                localStorage.removeItem(LOCAL_SESSION_KEY);
                setUser(null);
                setEmail(null);
              } else {
                const userEmail = parsed.email || found.email || usuariosService.getEmailCache(found.id) || null;
                setEmail(userEmail);
                setUser({ ...found, email: userEmail });
              }
            } else {
              localStorage.removeItem(LOCAL_SESSION_KEY);
              setUser(null);
              setEmail(null);
            }
          } else {
            // Sem sessão prévia: não logar usuário fictício automaticamente
            setUser(null);
            setEmail(null);
          }
        } catch (e) {
          console.error(e);
          setUser(null);
          setEmail(null);
        }
      }

      if (mounted) {
        setLoading(false);
      }
    }

    initAuth();

    // Listen to Supabase auth state changes if configured
    let authListener: { unsubscribe: () => void } | null = null;
    if (isSupabaseConfigured && supabase) {
      const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return;
        if (session?.user) {
          const authEmail = session.user.email?.toLowerCase().trim() || null;
          setEmail(authEmail);
          if (authEmail) {
            usuariosService.salvarEmailCache(session.user.id, authEmail);
          }
          const profile = await usuariosService.getById(session.user.id);
          if (profile && mounted) {
            const statusNorm = (profile.status || 'aprovado').toLowerCase().trim();
            if (statusNorm === 'desativado' || statusNorm === 'inativo' || statusNorm === 'pendente') {
              await supabase.auth.signOut();
              setUser(null);
              setEmail(null);
              return;
            }
            if (authEmail && (!profile.email || profile.email !== authEmail)) {
              profile.email = authEmail;
              usuariosService.atualizarEmail(session.user.id, authEmail).catch((err) => {
                console.warn('Aviso ao sincronizar email com Supabase:', err);
              });
            }
            setUser(profile);
          }
        } else {
          setUser(null);
          setEmail(null);
        }
      });
      authListener = listener.subscription;
    }

    return () => {
      mounted = false;
      if (authListener) {
        authListener.unsubscribe();
      }
    };
  }, []);

  const login = async (userEmail: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const cleanInput = userEmail.trim();

    // 1. Validação de status prévia no perfil de usuário (para qualquer departamento)
    try {
      const preCheck = await usuariosService.getByEmailOrCodigo(cleanInput);
      if (preCheck) {
        const preStatus = (preCheck.status || 'aprovado').toLowerCase().trim();
        if (preStatus === 'desativado' || preStatus === 'inativo') {
          return {
            success: false,
            error: `Acesso negado: o usuário "${preCheck.nome}" está com status DESATIVADO na tabela de usuários para o departamento "${preCheck.departamento}". Entre em contato com a administração.`,
          };
        }
        if (preStatus === 'pendente') {
          return {
            success: false,
            error: `Acesso bloqueado: o cadastro de "${preCheck.nome}" para o departamento "${preCheck.departamento}" está com status PENDENTE de aprovação por um gestor.`,
          };
        }
        if (preStatus !== 'aprovado' && preStatus !== 'ativo') {
          return {
            success: false,
            error: `Acesso não autorizado: o status "${preCheck.status}" na tabela de usuários não permite login no sistema.`,
          };
        }
      }
    } catch (checkErr) {
      console.warn('Aviso na verificação prévia de status do usuário:', checkErr);
    }

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanInput,
          password: pass,
        });

        if (error) {
          return { success: false, error: error.message };
        }

        if (data.user) {
          const profile = await usuariosService.getById(data.user.id);
          if (profile) {
            const statusNorm = (profile.status || 'aprovado').toLowerCase().trim();
            if (statusNorm === 'desativado' || statusNorm === 'inativo') {
              await supabase.auth.signOut();
              setUser(null);
              setEmail(null);
              return {
                success: false,
                error: `Acesso negado: o usuário "${profile.nome}" está com status DESATIVADO/INATIVO na tabela de usuários para o departamento "${profile.departamento}". Entre em contato com a administração.`,
              };
            }
            if (statusNorm === 'pendente') {
              await supabase.auth.signOut();
              setUser(null);
              setEmail(null);
              return {
                success: false,
                error: `Acesso bloqueado: o cadastro de "${profile.nome}" para o departamento "${profile.departamento}" está com status PENDENTE de aprovação por um gestor.`,
              };
            }
            if (statusNorm !== 'aprovado' && statusNorm !== 'ativo') {
              await supabase.auth.signOut();
              setUser(null);
              setEmail(null);
              return {
                success: false,
                error: `Acesso não autorizado: status "${profile.status}" na tabela de usuários não permite login no sistema.`,
              };
            }
            const authEmail = data.user.email?.toLowerCase().trim() || cleanInput.toLowerCase();
            if (authEmail) {
              usuariosService.salvarEmailCache(data.user.id, authEmail);
            }
            if (authEmail && (!profile.email || profile.email !== authEmail)) {
              profile.email = authEmail;
              usuariosService.atualizarEmail(data.user.id, authEmail).catch((err) => {
                console.warn('Aviso ao sincronizar email no login:', err);
              });
            }
            setEmail(authEmail);
            setUser(profile);
            return { success: true };
          } else {
            const authEmail = data.user.email?.toLowerCase().trim() || cleanInput.toLowerCase();
            if (authEmail) {
              usuariosService.salvarEmailCache(data.user.id, authEmail);
            }
            const newProfile = await usuariosService.createOrUpdate({
              id: data.user.id,
              nome: (data.user.user_metadata?.nome as string) || authEmail.split('@')[0],
              codigo: (data.user.user_metadata?.codigo as string) || 'OP-1000',
              email: authEmail,
              unidade_negocio: (data.user.user_metadata?.unidade_negocio as string) || 'Goiânia',
              nivel: 'Operador',
              status: 'aprovado',
            });
            setUser(newProfile);
            setEmail(authEmail);
            return { success: true };
          }
        }
        return { success: false, error: 'Usuário não retornado pelo provedor de autenticação.' };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro ao processar login.';
        return { success: false, error: message };
      }
    }

    // Local authentication
    const users = getLocalUsuarios();
    const cleanLower = cleanInput.toLowerCase();
    const matched = users.find(
      (u) =>
        u.codigo.toLowerCase() === cleanLower ||
        (u as any).email?.toLowerCase() === cleanLower
    );

    if (!matched) {
      return { success: false, error: 'Usuário não encontrado. Verifique seu código de acesso ou e-mail.' };
    }

    const statusNorm = (matched.status || 'aprovado').toLowerCase().trim();
    if (statusNorm === 'desativado' || statusNorm === 'inativo') {
      return {
        success: false,
        error: `Acesso negado: o usuário "${matched.nome}" está com status DESATIVADO/INATIVO na tabela de usuários para o departamento "${matched.departamento}". Entre em contato com a administração.`,
      };
    }
    if (statusNorm === 'pendente') {
      return {
        success: false,
        error: `Acesso bloqueado: o cadastro de "${matched.nome}" para o departamento "${matched.departamento}" está PENDENTE de aprovação por um gestor.`,
      };
    }
    if (statusNorm !== 'aprovado' && statusNorm !== 'ativo') {
      return {
        success: false,
        error: `Acesso não autorizado: status "${matched.status}" na tabela de usuários não permite login no sistema.`,
      };
    }

    const resolvedEmail = matched.email || cleanInput.toLowerCase();
    usuariosService.salvarEmailCache(matched.id, resolvedEmail);
    setUser({ ...matched, email: resolvedEmail });
    setEmail(resolvedEmail);
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ id: matched.id, email: resolvedEmail }));
    return { success: true };
  };

  const signup = async (data: {
    nome: string;
    codigo: string;
    email: string;
    senha: string;
    unidade_negocio: string;
    departamento?: string;
    funcao?: string;
    foto?: string | null;
    tema_escuro?: boolean | null;
  }): Promise<{ success: boolean; error?: string; isRateLimit?: boolean }> => {
    const supabase = getSupabase();
    const cleanCodigo = (data.codigo && data.codigo.trim())
      ? data.codigo.trim().toUpperCase()
      : `OP-${Math.floor(1000 + Math.random() * 9000)}`;
    const cleanUnidade = data.unidade_negocio.trim() || UNIDADE_PADRAO_SISTEMA;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: data.email.trim(),
          password: data.senha,
          options: {
            data: {
              nome: data.nome.trim(),
              codigo: cleanCodigo,
              unidade_negocio: cleanUnidade,
            },
          },
        });

        if (authError) {
          const lowerMsg = authError.message.toLowerCase();
          const isRateLimit =
            lowerMsg.includes('rate limit') ||
            lowerMsg.includes('over_email_send_rate_limit') ||
            authError.status === 429;

          if (isRateLimit) {
            return {
              success: false,
              isRateLimit: true,
              error: 'Limite de envio de e-mails do Supabase excedido (email rate limit exceeded). O plano gratuito do Supabase limita o envio de e-mails de confirmação a cerca de 3 a 4 envios por hora.',
            };
          }

          if (lowerMsg.includes('user already registered') || lowerMsg.includes('already registered')) {
            return { success: false, error: 'Este endereço de e-mail já está cadastrado no sistema.' };
          }

          return { success: false, error: authError.message };
        }

        if (authData.user) {
          const authEmail = authData.user.email?.toLowerCase().trim() || data.email.trim().toLowerCase();
          usuariosService.salvarEmailCache(authData.user.id, authEmail);

          const profile = await usuariosService.createOrUpdate({
            id: authData.user.id,
            nome: data.nome.trim(),
            codigo: cleanCodigo,
            email: authEmail,
            unidade_negocio: cleanUnidade,
            departamento: data.departamento || 'Logística',
            funcao: data.funcao || 'Operador Logístico',
            nivel: 'Operador',
            status: 'pendente',
            foto: data.foto || null,
            tema_escuro: data.tema_escuro !== undefined ? data.tema_escuro : true,
          });

          setUser(profile);
          setEmail(authEmail);
          return { success: true };
        }
        return { success: false, error: 'Falha ao criar credenciais.' };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro ao cadastrar usuário.';
        const lower = message.toLowerCase();
        const isRateLimit = lower.includes('rate limit') || lower.includes('over_email_send_rate_limit');
        return { success: false, error: message, isRateLimit };
      }
    }

    // Local registration
    return signupDirect({ ...data, codigo: cleanCodigo });
  };

  const signupDirect = async (data: {
    nome: string;
    codigo?: string;
    email: string;
    unidade_negocio: string;
    departamento?: string;
    funcao?: string;
    foto?: string | null;
    tema_escuro?: boolean | null;
  }): Promise<{ success: boolean }> => {
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanCodigo = (data.codigo && data.codigo.trim())
      ? data.codigo.trim().toUpperCase()
      : `OP-${Math.floor(1000 + Math.random() * 9000)}`;
    const cleanUnidade = data.unidade_negocio.trim() || UNIDADE_PADRAO_SISTEMA;
    const all = getLocalUsuarios();
    const newUserId = `usr-${Date.now().toString(36)}`;
    const newRecord: Usuario = {
      id: newUserId,
      nome: data.nome.trim(),
      codigo: cleanCodigo,
      email: cleanEmail,
      unidade_negocio: cleanUnidade,
      departamento: data.departamento || 'Logística',
      funcao: data.funcao || 'Operador Logístico',
      nivel: 'Operador',
      status: 'pendente',
      foto: data.foto || null,
      tema_escuro: data.tema_escuro !== undefined ? data.tema_escuro : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    usuariosService.salvarEmailCache(newUserId, cleanEmail);
    const updated = [newRecord, ...all];
    saveLocalUsuarios(updated);
    setUser(newRecord);
    setEmail(cleanEmail);
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ id: newUserId, email: cleanEmail }));
    return { success: true };
  };

  const recoverPassword = async (userEmail: string): Promise<{ success: boolean; error?: string; message?: string }> => {
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(userEmail.trim(), {
          redirectTo: window.location.origin,
        });
        if (error) {
          return { success: false, error: error.message };
        }
        return {
          success: true,
          message: `E-mail de recuperação de senha enviado com sucesso para ${userEmail}. Verifique sua caixa de entrada.`,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro ao solicitar recuperação.';
        return { success: false, error: message };
      }
    }

    return {
      success: true,
      message: `Instruções de redefinição de senha foram simuladas para ${userEmail}. No modo Supabase ativo, o e-mail real será disparado.`,
    };
  };

  const logout = async (): Promise<void> => {
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Erro ao deslogar do Supabase:', err);
      }
    }
    localStorage.removeItem(LOCAL_SESSION_KEY);
    setUser(null);
    setEmail(null);
  };

  const refreshProfile = async () => {
    if (user?.id) {
      const refreshed = await usuariosService.getById(user.id);
      if (refreshed) setUser(refreshed);
    }
  };

  const switchUser = (userId: string) => {
    const list = getLocalUsuarios();
    const found = list.find((u) => u.id === userId || u.codigo === userId);
    if (found) {
      const userEmail = found.email || usuariosService.getEmailCache(found.id) || null;
      setUser({ ...found, email: userEmail });
      setEmail(userEmail);
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({
        id: found.id,
        email: userEmail
      }));
    }
  };

  const updateUserPhoto = async (fotoUrl: string | null) => {
    if (!user?.id) return;
    try {
      const atualizado = await usuariosService.atualizarUsuario(user.id, { foto: fotoUrl });
      setUser(atualizado);
    } catch {
      // Fallback local caso haja falha
      setUser((prev) => (prev ? { ...prev, foto: fotoUrl } : null));
    }
  };

  const alterarSenhaObrigatoria = async (novaSenha: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Nenhum usuário logado no momento.' };
    }
    const cleanSenha = novaSenha.trim();
    if (cleanSenha.length < 6) {
      return { success: false, error: 'A nova senha deve conter no mínimo 6 caracteres.' };
    }

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.auth.updateUser({
          password: cleanSenha,
        });
        if (error) {
          return { success: false, error: error.message };
        }
      } catch (err: unknown) {
        console.warn('Erro ao atualizar senha no Supabase:', err);
      }
    }

    try {
      await usuariosService.atualizarUsuario(user.id, { exigir_troca_senha: false });
    } catch (err) {
      console.warn('Aviso ao atualizar flag exigir_troca_senha:', err);
    }

    setUser((prev) => (prev ? { ...prev, exigir_troca_senha: false } : null));

    // Atualiza a sessão persistente local
    try {
      const savedSession = localStorage.getItem(LOCAL_SESSION_KEY);
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ ...parsed, exigir_troca_senha: false }));
      }
    } catch {
      // ignore
    }

    return { success: true };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        email,
        loading,
        isConfigured: isSupabaseConfigured,
        login,
        signup,
        signupDirect,
        recoverPassword,
        logout,
        refreshProfile,
        switchUser,
        updateUserPhoto,
        alterarSenhaObrigatoria,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
}
