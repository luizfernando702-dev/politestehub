import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { Usuario, UsuarioStatus } from '../types';
import { getLocalUsuarios, saveLocalUsuarios } from './mockStorage';
import { UNIDADE_PADRAO_SISTEMA, unidadesIguais, normalizarUnidadeNegocio } from '../constants/unidades';
import { getActiveUserUnit } from './sessionHelper';

const USUARIO_FIELDS_WITH_PIN = 'id, nome, codigo, unidade_negocio, foto, departamento, funcao, nivel, status, pin, exigir_troca_senha, created_at, updated_at';
const USUARIO_FIELDS = 'id, nome, codigo, unidade_negocio, foto, departamento, funcao, nivel, status, pin, exigir_troca_senha, created_at, updated_at';
const USUARIO_FIELDS_FALLBACK = 'id, nome, codigo, unidade_negocio, foto, departamento, funcao, nivel, status, pin, created_at, updated_at';

function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function formatSupabaseUserError(error: { message?: string; code?: string; details?: string; hint?: string } | null | undefined): string {
  if (!error) return 'Erro desconhecido na comunicação com o banco de dados.';

  const msg = (error.message || '').toLowerCase();
  const code = error.code || '';

  if (msg.includes('row-level security') || msg.includes('violates row-level security') || code === '42501') {
    return 'Erro de Permissão: As permissões de acesso do sistema impediram a alteração deste registro. Verifique com um gestor responsável.';
  }

  if (code === 'PGRST116') {
    return 'Nenhum registro foi modificado. Verifique se seu perfil possui autorização para alterar este usuário.';
  }

  if (msg.includes('column "status"') || (msg.includes('status') && msg.includes('does not exist'))) {
    return 'O sistema precisa de atualização de colunas no cadastro de usuários.';
  }

  if (msg.includes('usuarios_nivel_check')) {
    return 'Nível de usuário não permitido para esta operação.';
  }

  if (msg.includes('usuarios_status_check')) {
    return 'Status de usuário inválido para esta operação.';
  }

  if (msg.includes('check_last_active_gestor') || msg.includes('bloqueada: o sistema não pode ficar sem nenhum gestor')) {
    return 'Operação bloqueada: o sistema não pode ficar sem nenhum gestor ativo. Nomeie e aprove outro gestor antes de desativar ou rebaixar este perfil.';
  }

  if (msg.includes('usuarios_id_fkey') || (msg.includes('foreign key') && msg.includes('users'))) {
    return 'O usuário deve ser cadastrado através do fluxo de criação de conta.';
  }

  if (msg.includes('tarefas_responsavel_id_fkey')) {
    return 'Não é possível remover ou alterar este usuário pois ele possui tarefas associadas em public.tarefas. Utilize a opção "Desativar" para manter o histórico integro.';
  }

  return error.message || 'Erro ao processar alteração na tabela usuarios.';
}

const EMAIL_CACHE_KEY = 'polihub_user_emails_map';

function getLocalEmailCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(EMAIL_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalEmailCache(cache: Record<string, string>) {
  try {
    localStorage.setItem(EMAIL_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

export const usuariosService = {
  /**
   * Salva o e-mail real do Supabase Auth no cache local persistente
   */
  salvarEmailCache(userId: string, email: string) {
    if (!userId || !email) return;
    const cleanEmail = email.trim().toLowerCase();
    const cache = getLocalEmailCache();
    cache[userId] = cleanEmail;
    saveLocalEmailCache(cache);
  },

  /**
   * Obtém o e-mail real armazenado no cache local para um usuário
   */
  getEmailCache(userId: string): string | null {
    if (!userId) return null;
    const cache = getLocalEmailCache();
    return cache[userId] || null;
  },

  /**
   * Obtém todo o mapa de e-mails em cache
   */
  getEmailCacheMap(): Record<string, string> {
    return getLocalEmailCache();
  },

  /**
   * Atualiza e sincroniza o e-mail do usuário no banco e no cache local
   */
  async atualizarEmail(userId: string, email: string): Promise<void> {
    if (!userId || !email) return;
    const cleanEmail = email.trim().toLowerCase();
    this.salvarEmailCache(userId, cleanEmail);

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase && isValidUuid(userId)) {
      try {
        await supabase
          .from('usuarios')
          .update({ email: cleanEmail, updated_at: new Date().toISOString() })
          .eq('id', userId);
      } catch (err) {
        console.warn('Não foi possível persistir email na tabela usuarios:', err);
      }
    }

    // Atualiza localmente
    const all = getLocalUsuarios();
    const idx = all.findIndex((u) => u.id === userId);
    if (idx >= 0) {
      all[idx] = { ...all[idx], email: cleanEmail };
      saveLocalUsuarios(all);
    }
  },

  /**
   * Get user profile by Auth user ID
   */
  async getById(id: string): Promise<Usuario | null> {
    const supabase = getSupabase();
    const cachedEmail = this.getEmailCache(id);

    if (isSupabaseConfigured && supabase && isValidUuid(id)) {
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select(USUARIO_FIELDS)
          .eq('id', id)
          .maybeSingle();

        if (!error && data) {
          const user = data as Usuario;
          const finalEmail = user.email || cachedEmail || null;
          if (finalEmail && !cachedEmail) {
            this.salvarEmailCache(id, finalEmail);
          }
          return {
            ...user,
            email: finalEmail,
            unidade_negocio: user.unidade_negocio || UNIDADE_PADRAO_SISTEMA,
            status: user.status || 'aprovado',
          };
        }

        // Se falhou porque a coluna status ou unidade_negocio não existe no banco antigo do Supabase
        if (error && (error.message.includes('status') || error.message.includes('column') || error.message.includes('unidade_negocio') || error.message.includes('email'))) {
          const { data: fallbackData, error: fbError } = await supabase
            .from('usuarios')
            .select(USUARIO_FIELDS_FALLBACK)
            .eq('id', id)
            .maybeSingle();

          if (!fbError && fallbackData) {
            const finalEmail = cachedEmail || null;
            return {
              ...(fallbackData as Usuario),
              email: finalEmail,
              unidade_negocio: UNIDADE_PADRAO_SISTEMA,
              status: 'aprovado',
            };
          }
        }
      } catch (err) {
        console.warn('Erro ao buscar usuario no Supabase:', err);
      }
    }

    // Local fallback
    const all = getLocalUsuarios();
    const found = all.find((u) => u.id === id);
    if (found) {
      const finalEmail = found.email || cachedEmail || null;
      return {
        ...found,
        email: finalEmail,
        unidade_negocio: found.unidade_negocio || UNIDADE_PADRAO_SISTEMA,
        status: found.status || 'aprovado',
      };
    }
    return null;
  },

  /**
   * Get user profile by codigo or email
   */
  async getByEmailOrCodigo(input: string): Promise<Usuario | null> {
    const clean = input.trim().toLowerCase();
    const cleanUpper = input.trim().toUpperCase();
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select(USUARIO_FIELDS)
          .or(`codigo.ilike.${clean},codigo.ilike.${cleanUpper},email.ilike.${clean}`)
          .maybeSingle();

        if (!error && data) {
          const user = data as Usuario;
          return {
            ...user,
            unidade_negocio: user.unidade_negocio || UNIDADE_PADRAO_SISTEMA,
            status: user.status || 'aprovado',
          };
        }
      } catch (err) {
        console.warn('Erro ao buscar usuario por codigo/email no Supabase:', err);
      }
    }

    const all = getLocalUsuarios();
    const found = all.find(
      (u) =>
        u.codigo.toLowerCase() === clean ||
        u.id.toLowerCase() === clean ||
        (u as any).email?.toLowerCase() === clean
    );
    return found
      ? {
          ...found,
          unidade_negocio: found.unidade_negocio || UNIDADE_PADRAO_SISTEMA,
          status: found.status || 'aprovado',
        }
      : null;
  },

  /**
   * Upsert or create user in the 'usuarios' table
   */
  async createOrUpdate(user: Partial<Usuario> & { id: string; nome: string; codigo: string }): Promise<Usuario> {
    const supabase = getSupabase();
    const now = new Date().toISOString();

    const existingEmail = user.email ? user.email.trim().toLowerCase() : (this.getEmailCache(user.id) || null);
    if (existingEmail) {
      this.salvarEmailCache(user.id, existingEmail);
    }

    const record: Usuario = {
      id: user.id,
      nome: user.nome.trim(),
      codigo: user.codigo.trim().toUpperCase(),
      email: existingEmail,
      unidade_negocio: user.unidade_negocio || UNIDADE_PADRAO_SISTEMA,
      foto: user.foto || null,
      departamento: user.departamento || 'Logística',
      funcao: user.funcao || 'Operador Logístico',
      nivel: user.nivel || 'Operador',
      status: user.status || 'pendente',
      created_at: user.created_at || now,
      updated_at: now,
    };

    if (isSupabaseConfigured && supabase && isValidUuid(user.id)) {
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .upsert(record)
          .select(USUARIO_FIELDS)
          .maybeSingle();

        if (!error && data) {
          const res = data as Usuario;
          // Sincroniza cópia local
          this._syncLocal(res);
          return res;
        }

        // Caso a coluna status ou email ainda não exista no Supabase
        if (error && (error.message.includes('status') || error.message.includes('column') || error.message.includes('email'))) {
          const fallbackRecord = {
            id: record.id,
            nome: record.nome,
            codigo: record.codigo,
            foto: record.foto,
            departamento: record.departamento,
            funcao: record.funcao,
            nivel: record.nivel,
            created_at: record.created_at,
            updated_at: record.updated_at,
          };

          const { data: fbData, error: fbError } = await supabase
            .from('usuarios')
            .upsert(fallbackRecord)
            .select(USUARIO_FIELDS_FALLBACK)
            .maybeSingle();

          if (!fbError && fbData) {
            const res: Usuario = { ...(fbData as Usuario), status: record.status || 'aprovado', email: existingEmail };
            this._syncLocal(res);
            return res;
          }
        }

        if (error) {
          console.warn('Erro no upsert de usuario Supabase:', formatSupabaseUserError(error));
        }
      } catch (err) {
        console.warn('Falha no upsert de usuario:', err);
      }
    }

    // Local store
    this._syncLocal(record);
    return record;
  },

  /**
   * Helper para manter armazenamento local sincronizado
   */
  _syncLocal(user: Usuario) {
    const all = getLocalUsuarios();
    const index = all.findIndex((u) => u.id === user.id);
    if (index >= 0) {
      all[index] = { ...all[index], ...user };
    } else {
      all.push(user);
    }
    saveLocalUsuarios(all);
  },

  /**
   * List all users for filter selectors and auditors
   */
  async listarTodos(): Promise<Usuario[]> {
    const supabase = getSupabase();
    const emailCache = this.getEmailCacheMap();

    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Tenta listar via RPC com e-mail integrado de auth.users (retorna dados atualizados do Supabase Auth)
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('listar_usuarios_com_email');
          if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
            return (rpcData as Usuario[]).map((u) => {
              const finalEmail = (u.email && u.email.trim()) ? u.email.trim().toLowerCase() : (emailCache[u.id] || null);
              if (finalEmail) {
                this.salvarEmailCache(u.id, finalEmail);
              }
              return {
                ...u,
                unidade_negocio: u.unidade_negocio || UNIDADE_PADRAO_SISTEMA,
                status: u.status || 'aprovado',
                email: finalEmail,
              };
            });
          }
        } catch {
          // RPC ainda não instalada no Supabase, prossegue para consulta direta na tabela
        }

        // 2. Consulta direta na tabela public.usuarios com USUARIO_FIELDS (incluindo email)
        const { data, error } = await supabase
          .from('usuarios')
          .select(USUARIO_FIELDS)
          .order('nome', { ascending: true });

        if (!error && data) {
          return (data as Usuario[]).map((u) => {
            const finalEmail = (u.email && u.email.trim()) ? u.email.trim().toLowerCase() : (emailCache[u.id] || null);
            if (finalEmail) {
              this.salvarEmailCache(u.id, finalEmail);
            }
            return {
              ...u,
              unidade_negocio: u.unidade_negocio || UNIDADE_PADRAO_SISTEMA,
              status: u.status || 'aprovado',
              email: finalEmail,
            };
          });
        }

        // Se a consulta falhar porque a coluna email, status ou unidade_negocio ainda não existe
        if (error && (error.message.includes('status') || error.message.includes('column') || error.message.includes('unidade_negocio') || error.message.includes('email'))) {
          const { data: fallbackData, error: fbError } = await supabase
            .from('usuarios')
            .select(USUARIO_FIELDS_FALLBACK)
            .order('nome', { ascending: true });

          if (!fbError && fallbackData) {
            return (fallbackData as Usuario[]).map((u) => {
              const finalEmail = (u as any).email || emailCache[u.id] || null;
              return {
                ...u,
                unidade_negocio: UNIDADE_PADRAO_SISTEMA,
                status: 'aprovado',
                email: finalEmail,
              };
            });
          }
        }

        if (error) {
          console.warn('Erro ao listar usuarios no Supabase:', formatSupabaseUserError(error));
        }
      } catch (err) {
        console.warn('Erro ao listar usuarios no Supabase:', err);
      }
    }

    const all = getLocalUsuarios();
    return all.map((u) => ({
      ...u,
      status: u.status || 'aprovado',
      email: u.email || emailCache[u.id] || null,
    }));
  },

  /**
   * Atualiza o status do usuário (pendente, aprovado, desativado)
   * REGRA DE SEGURANÇA (Item 21): Não permitir desativar o último gestor ativo do sistema.
   */
  async atualizarStatus(id: string, novoStatus: UsuarioStatus): Promise<Usuario> {
    const todos = await this.listarTodos();
    const usuarioAlvo = todos.find((u) => u.id === id);

    if (!usuarioAlvo) {
      throw new Error('Usuário não encontrado.');
    }

    // Proteção: não desativar o último gestor ativo
    if (novoStatus === 'desativado') {
      const isGestorAlvo =
        usuarioAlvo.nivel?.toLowerCase() === 'gestor' ||
        usuarioAlvo.nivel?.toLowerCase() === 'administrador';

      if (isGestorAlvo) {
        const outrosGestoresAtivos = todos.filter(
          (u) =>
            u.id !== id &&
            (u.nivel?.toLowerCase() === 'gestor' || u.nivel?.toLowerCase() === 'administrador') &&
            (u.status === 'aprovado' || u.status === 'ativo' || !u.status)
        );

        if (outrosGestoresAtivos.length === 0) {
          throw new Error(
            'Operação bloqueada: o sistema não pode ficar sem nenhum gestor ativo. Nomeie e aprove outro gestor antes de desativar este perfil.'
          );
        }
      }
    }

    const now = new Date().toISOString();
    const supabase = getSupabase();
    let atualizado: Usuario | null = null;

    if (isSupabaseConfigured && supabase && isValidUuid(id)) {
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .update({
            status: novoStatus,
            updated_at: now,
          })
          .eq('id', id)
          .select(USUARIO_FIELDS)
          .maybeSingle();

        if (error) {
          // Se a coluna status não existe no Supabase
          if (error.message.includes('status') || error.message.includes('column')) {
            throw new Error(
              'A coluna "status" não existe na tabela usuarios do seu Supabase. Execute o script de correção SQL em Cadastros > Script SQL para atualizar o banco.'
            );
          }
          throw new Error(formatSupabaseUserError(error));
        }

        if (data) {
          atualizado = data as Usuario;
        } else {
          // Se data é nulo e não houve erro formal, RLS bloqueou a alteração de linha
          throw new Error(
            'Nenhum registro foi alterado no banco de dados. As políticas RLS do Supabase podem estar bloqueando a alteração por outro usuário. Execute o script de correção SQL da tabela usuarios.'
          );
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          throw err;
        }
        throw new Error('Falha inesperada ao atualizar status no banco de dados.');
      }
    }

    // Atualiza armazenamento local / fallback
    const locais = getLocalUsuarios();
    const novosLocais = locais.map((u) => {
      if (u.id === id) {
        atualizado = {
          ...u,
          status: novoStatus,
          updated_at: now,
        };
        return atualizado;
      }
      return u;
    });

    saveLocalUsuarios(novosLocais);

    if (!atualizado) {
      if (!isValidUuid(id)) {
        throw new Error('Usuário local não pôde ser atualizado.');
      }
      throw new Error('Falha ao atualizar o status do usuário.');
    }

    return atualizado;
  },

  /**
   * Atualiza os dados cadastrais do usuário (nome, codigo, departamento, funcao, nivel)
   * REGRA DE SEGURANÇA (Item 21): Não permitir rebaixar o nível do último gestor ativo.
   */
  async atualizarUsuario(id: string, dados: Partial<Usuario>): Promise<Usuario> {
    const todos = await this.listarTodos();
    const usuarioAlvo = todos.find((u) => u.id === id);

    if (!usuarioAlvo) {
      throw new Error('Usuário não encontrado.');
    }

    // Proteção: não rebaixar o nível do último gestor ativo
    if (dados.nivel && dados.nivel.toLowerCase() !== 'gestor' && dados.nivel.toLowerCase() !== 'administrador') {
      const eraGestor =
        usuarioAlvo.nivel?.toLowerCase() === 'gestor' ||
        usuarioAlvo.nivel?.toLowerCase() === 'administrador';
      const estavaAtivo =
        usuarioAlvo.status === 'aprovado' || usuarioAlvo.status === 'ativo' || !usuarioAlvo.status;

      if (eraGestor && estavaAtivo) {
        const outrosGestoresAtivos = todos.filter(
          (u) =>
            u.id !== id &&
            (u.nivel?.toLowerCase() === 'gestor' || u.nivel?.toLowerCase() === 'administrador') &&
            (u.status === 'aprovado' || u.status === 'ativo' || !u.status)
        );

        if (outrosGestoresAtivos.length === 0) {
          throw new Error(
            'Operação bloqueada: o sistema não pode ficar sem nenhum gestor ativo. Nomeie e aprove outro gestor antes de rebaixar este perfil para operador.'
          );
        }
      }
    }

    const now = new Date().toISOString();
    const payload: Partial<Usuario> = {
      ...dados,
      updated_at: now,
    };
    if (dados.codigo) {
      payload.codigo = dados.codigo.trim().toUpperCase();
    }
    if (dados.nome) {
      payload.nome = dados.nome.trim();
    }

    const supabase = getSupabase();
    let atualizado: Usuario | null = null;

    if (isSupabaseConfigured && supabase && isValidUuid(id)) {
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .update(payload)
          .eq('id', id)
          .select(USUARIO_FIELDS)
          .maybeSingle();

        if (error) {
          // Se a coluna status, tema_escuro ou exigir_troca_senha não existe e foi informada
          if (error.message.includes('status') || error.message.includes('tema_escuro') || error.message.includes('exigir_troca_senha') || error.message.includes('column')) {
            const fallbackPayload = { ...payload };
            delete (fallbackPayload as Record<string, unknown>).status;
            delete (fallbackPayload as Record<string, unknown>).tema_escuro;
            delete (fallbackPayload as Record<string, unknown>).exigir_troca_senha;

            const { data: fbData, error: fbError } = await supabase
              .from('usuarios')
              .update(fallbackPayload)
              .eq('id', id)
              .select(USUARIO_FIELDS_FALLBACK)
              .maybeSingle();

            if (!fbError && fbData) {
              atualizado = {
                ...(fbData as Usuario),
                status: usuarioAlvo.status || 'aprovado',
                tema_escuro: payload.tema_escuro !== undefined ? payload.tema_escuro : usuarioAlvo.tema_escuro,
                exigir_troca_senha: payload.exigir_troca_senha !== undefined ? payload.exigir_troca_senha : usuarioAlvo.exigir_troca_senha,
              };
            } else if (fbError) {
              throw new Error(formatSupabaseUserError(fbError));
            }
          } else {
            throw new Error(formatSupabaseUserError(error));
          }
        } else if (data) {
          atualizado = data as Usuario;
        } else {
          throw new Error(
            'Nenhum registro foi alterado no Supabase. Verifique se as políticas de segurança RLS permitem alteração por gestores. Execute o script de correção em Cadastros > Script SQL.'
          );
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          throw err;
        }
        throw new Error('Falha inesperada ao atualizar usuário no banco de dados.');
      }
    }

    // Sincroniza localmente
    const locais = getLocalUsuarios();
    const novosLocais = locais.map((u) => {
      if (u.id === id) {
        atualizado = {
          ...u,
          ...payload,
        } as Usuario;
        return atualizado;
      }
      return u;
    });

    saveLocalUsuarios(novosLocais);

    if (!atualizado) {
      if (!isValidUuid(id)) {
        throw new Error('Usuário local não pôde ser atualizado.');
      }
      throw new Error('Falha ao atualizar dados do usuário.');
    }

    return atualizado;
  },

  /**
   * Atualiza a preferência de tema do usuário (true = escuro, false = claro).
   * Atualiza imediatamente no Supabase e no mockStorage local.
   */
  async atualizarTema(id: string, temaEscuro: boolean): Promise<void> {
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase && isValidUuid(id)) {
      try {
        const { error } = await supabase
          .from('usuarios')
          .update({ tema_escuro: temaEscuro, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) {
          console.warn('Possível ausência da coluna tema_escuro no Supabase:', error.message);
        }
      } catch (err) {
        console.warn('Erro ao atualizar tema no Supabase:', err);
      }
    }

    const locais = getLocalUsuarios();
    const novosLocais = locais.map((u) => {
      if (u.id === id) {
        return { ...u, tema_escuro: temaEscuro };
      }
      return u;
    });
    saveLocalUsuarios(novosLocais);
  },

  /**
   * Solicita ou cancela a exigência de alteração obrigatória de senha no próximo acesso.
   * Disponível para Gestores.
   */
  async solicitarTrocaSenha(id: string, exigir: boolean): Promise<Usuario> {
    return this.atualizarUsuario(id, { exigir_troca_senha: exigir });
  },

  /**
   * POLIHUB — Identificação Operacional por PIN
   * Lista somente usuários que atendem estritamente aos critérios:
   * - unidade_negocio: corresponde à unidade logada (ex: 'Goiânia-GO')
   * - departamento: departamento de Logística (ex: 'Logística & Recebimento', 'Logística Operacional', etc.)
   * - status = 'aprovado' ou 'ativo'
   * - usuário não está desativado (ativo !== false e status !== 'desativado')
   * Não lista: pendentes, desativados, outras unidades ou outros departamentos.
   */
  async listarOperadoresLogistica(unidadeNegocio?: string): Promise<Usuario[]> {
    const supabase = getSupabase();
    let usuarios: Usuario[] = [];

    const isDeptoLogistica = (dept?: string | null): boolean => {
      if (!dept) return false;
      const d = dept
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return d.includes('logistica');
    };

    const unidadeAlvo = (unidadeNegocio && unidadeNegocio.trim()) || getActiveUserUnit() || '';
    const isMesmaUnidade = (uUnidade?: string | null): boolean => {
      if (!unidadeAlvo) return true;
      return unidadesIguais(uUnidade, unidadeAlvo);
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select(USUARIO_FIELDS_WITH_PIN)
          .order('nome', { ascending: true });

        if (!error && data) {
          usuarios = data as Usuario[];
        } else if (error) {
          console.warn('Erro ao listar operadores de logistica no Supabase:', error.message);
          const { data: fbData } = await supabase
            .from('usuarios')
            .select(USUARIO_FIELDS_FALLBACK)
            .order('nome', { ascending: true });
          if (fbData) {
            usuarios = fbData as Usuario[];
          }
        }
      } catch (err) {
        console.warn('Erro ao listar operadores de logistica no Supabase:', err);
      }
    }

    if (usuarios.length === 0) {
      usuarios = getLocalUsuarios();
    }

    // Vincula email do cache local se necessário
    usuarios = usuarios.map((u) => ({
      ...u,
      email: u.email || this.getEmailCache(u.id) || null,
    }));

    // Filtragem rigorosa conforme requisito:
    // 1. Departamento de Logística (todas as variações de 'Logística')
    // 2. Unidade de negócio correspondente à do usuário logado
    // 3. Status 'aprovado' ou 'ativo' (ou padrão do sistema)
    // 4. Usuário não desativado
    const filtrados = usuarios.filter((u) => {
      const statusLower = (u.status || 'aprovado').toLowerCase();
      const isAprovado = statusLower === 'aprovado' || statusLower === 'ativo';
      const isNaoDesativado = statusLower !== 'desativado' && statusLower !== 'pendente' && u.ativo !== false;
      const isDeptoCorreto = isDeptoLogistica(u.departamento);
      const isUnidadeCorreta = isMesmaUnidade(u.unidade_negocio);
      return isAprovado && isNaoDesativado && isDeptoCorreto && isUnidadeCorreta;
    });

    // Se no mock ainda houver 'usr-default-01' e a unidade coincidir, inclui se a lista estiver vazia
    if (filtrados.length === 0) {
      const local = getLocalUsuarios();
      const defaultUser = local.find(
        (u) =>
          u.id === 'usr-default-01' &&
          isDeptoLogistica(u.departamento) &&
          isMesmaUnidade(u.unidade_negocio)
      );
      if (defaultUser) {
        filtrados.push({
          ...defaultUser,
          email: defaultUser.email || this.getEmailCache(defaultUser.id) || null,
        });
      }
    }

    return filtrados.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
  },

  /**
   * Obtém os dados do operador com PIN para validação
   */
  async obterPorIdComPin(id: string): Promise<Usuario | null> {
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase && isValidUuid(id)) {
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select(USUARIO_FIELDS_WITH_PIN)
          .eq('id', id)
          .maybeSingle();

        if (!error && data) {
          const user = data as Usuario;
          return {
            ...user,
            email: user.email || this.getEmailCache(id) || null,
          };
        }

        // Fallback se não tem coluna pin no banco
        if (error && (error.message.includes('pin') || error.message.includes('column'))) {
          const { data: fbData } = await supabase
            .from('usuarios')
            .select(USUARIO_FIELDS_FALLBACK)
            .eq('id', id)
            .maybeSingle();
          if (fbData) {
            const user = fbData as Usuario;
            return {
              ...user,
              email: user.email || this.getEmailCache(id) || null,
            };
          }
        }
      } catch (err) {
        console.warn('Erro ao buscar usuario com pin no Supabase:', err);
      }
    }

    const all = getLocalUsuarios();
    const found = all.find((u) => u.id === id);
    if (found) {
      return {
        ...found,
        email: found.email || this.getEmailCache(id) || null,
      };
    }
    return null;
  },

  /**
   * Salva o PIN de 4 dígitos para o usuário.
   * Regras:
   * - Aceitar somente números;
   * - Exigir exatamente 4 dígitos;
   * - Preservar zeros à esquerda (tipo TEXT);
   * - Salva no Supabase e no mock local.
   */
  async definirPin(usuarioId: string, pin: string): Promise<{ success: boolean; error?: string }> {
    const limpo = pin.trim();
    if (!/^\d{4}$/.test(limpo)) {
      return {
        success: false,
        error: 'O PIN deve conter exatamente 4 dígitos numéricos (ex: 0123).',
      };
    }

    const now = new Date().toISOString();
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase && isValidUuid(usuarioId)) {
      try {
        const { error } = await supabase
          .from('usuarios')
          .update({
            pin: limpo,
            updated_at: now,
          })
          .eq('id', usuarioId);

        if (error) {
          console.warn('Erro ao salvar PIN no Supabase (pode faltar a coluna pin):', error.message);
        }
      } catch (err) {
        console.warn('Falha na comunicação ao salvar PIN no Supabase:', err);
      }
    }

    // Salva sempre no armazenamento local para resiliência e persistência
    const locais = getLocalUsuarios();
    const idx = locais.findIndex((u) => u.id === usuarioId);
    if (idx >= 0) {
      locais[idx] = {
        ...locais[idx],
        pin: limpo,
        updated_at: now,
      };
      saveLocalUsuarios(locais);
    } else {
      // Se não estava no mock, tenta buscar do Supabase e salvar local
      const usuario = await this.getById(usuarioId);
      if (usuario) {
        locais.push({ ...usuario, pin: limpo, updated_at: now });
        saveLocalUsuarios(locais);
      }
    }

    return { success: true };
  },

  /**
   * Valida o PIN informado contra o PIN salvo do usuário.
   * Se inválido, não revela o PIN correto.
   */
  async validarPin(usuarioId: string, pinInformado: string): Promise<{ valid: boolean; usuario?: Usuario; message?: string }> {
    const limpo = pinInformado.trim();
    if (!/^\d{4}$/.test(limpo)) {
      return {
        valid: false,
        message: 'PIN inválido. Confira os dados e tente novamente.',
      };
    }

    const usuario = await this.obterPorIdComPin(usuarioId);
    if (!usuario) {
      return {
        valid: false,
        message: 'Usuário não encontrado no sistema.',
      };
    }

    // Se o usuário não tem PIN cadastrado
    if (!usuario.pin || !usuario.pin.trim()) {
      return {
        valid: false,
        message: 'Usuário ainda não possui PIN cadastrado.',
      };
    }

    // Compara exatamente os 4 dígitos preservando formato texto
    if (String(usuario.pin).trim() === limpo) {
      return {
        valid: true,
        usuario,
      };
    }

    return {
      valid: false,
      message: 'PIN inválido. Confira os dados e tente novamente.',
    };
  },

  /**
   * Obtém mapa com a data do último login dos usuários (last_sign_in_at do Supabase Auth).
   * Consulta por meio de RPC segura 'obter_ultimos_acessos_usuarios', com fallback para cache/sessão.
   */
  async obterMapaUltimosAcessos(): Promise<Record<string, string | null>> {
    const mapa: Record<string, string | null> = {};
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.rpc('obter_ultimos_acessos_usuarios');
        if (!error && Array.isArray(data)) {
          data.forEach((item: { usuario_id?: string; id?: string; last_sign_in_at?: string | null }) => {
            const uid = item.usuario_id || item.id;
            if (uid) {
              mapa[uid] = item.last_sign_in_at || null;
            }
          });
          return mapa;
        }
      } catch (err) {
        // RPC não criada ainda no Supabase
      }
    }

    // Fallback: recupera último acesso da sessão ativa para o usuário atual
    try {
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id && session.user.last_sign_in_at) {
          mapa[session.user.id] = session.user.last_sign_in_at;
        }
      }
    } catch {}

    // Fallback de cache local persistente para outros usuários
    try {
      const raw = localStorage.getItem('polihub_usuarios_ultimo_login');
      if (raw) {
        const parsed = JSON.parse(raw);
        Object.assign(mapa, parsed);
      }
    } catch {}

    return mapa;
  },

  /**
   * Registra no cache local o login recente de um usuário
   */
  registrarUltimoLogin(usuarioId: string, timestamp = new Date().toISOString()): void {
    if (!usuarioId) return;
    try {
      const raw = localStorage.getItem('polihub_usuarios_ultimo_login');
      const cache: Record<string, string> = raw ? JSON.parse(raw) : {};
      cache[usuarioId] = timestamp;
      localStorage.setItem('polihub_usuarios_ultimo_login', JSON.stringify(cache));
    } catch {}
  },
};
