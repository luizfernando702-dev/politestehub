import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { UnidadeNegocio } from '../types';
import { UNIDADES_NEGOCIO_PADRAO } from '../constants/unidades';

const LOCAL_STORAGE_KEY = 'polihub_unidades_negocio';
const UNIDADES_FIELDS = 'id, nome, sigla, cidade, estado, ativo, created_at, updated_at';

// In-memory cache for fast local access
let unidadesCache: { data: UnidadeNegocio[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 20000;

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getLocalUnidades(): UnidadeNegocio[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      // Seed inicial a partir das constantes padrão
      const initial: UnidadeNegocio[] = [
        {
          id: '11111111-1111-4111-a111-111111111111',
          nome: 'Goiânia',
          sigla: 'GYN',
          cidade: 'Goiânia',
          estado: 'GO',
          ativo: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '22222222-2222-4222-a222-222222222222',
          nome: 'Mato Grosso',
          sigla: 'MT',
          cidade: 'Cuiabá',
          estado: 'MT',
          ativo: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Erro ao ler unidades do localStorage:', err);
    return [];
  }
}

function saveLocalUnidades(items: UnidadeNegocio[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    unidadesCache = { data: items, timestamp: Date.now() };
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('polihub_unidades_refresh', { detail: items }));
    }
  } catch (err) {
    console.warn('Erro ao salvar unidades no localStorage:', err);
  }
}

export const unidadesNegocioService = {
  /**
   * Lista todas as unidades cadastradas, com suporte a busca e cache
   */
  async listar(search = '', forceRefresh = false): Promise<UnidadeNegocio[]> {
    if (!forceRefresh && !search && unidadesCache && Date.now() - unidadesCache.timestamp < CACHE_TTL_MS) {
      return unidadesCache.data;
    }

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('unidades_negocio')
          .select(UNIDADES_FIELDS)
          .order('nome', { ascending: true });

        if (search.trim()) {
          const s = search.trim();
          query = query.or(`nome.ilike.%${s}%,sigla.ilike.%${s}%,cidade.ilike.%${s}%,estado.ilike.%${s}%`);
        }

        const { data, error } = await query;
        if (!error && data) {
          const typed = data as UnidadeNegocio[];
          if (!search) {
            unidadesCache = { data: typed, timestamp: Date.now() };
            // Atualiza também o cache local
            try {
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(typed));
            } catch {
              // ignore
            }
          }
          return typed;
        }
        if (error && error.code !== '42P01') {
          console.warn('Erro ao listar unidades_negocio no Supabase:', error.message);
        }
      } catch (err) {
        console.warn('Fallback para armazenamento local de unidades:', err);
      }
    }

    // Fallback local
    let list = getLocalUnidades();
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(
        (u) =>
          u.nome.toLowerCase().includes(s) ||
          (u.sigla && u.sigla.toLowerCase().includes(s)) ||
          (u.cidade && u.cidade.toLowerCase().includes(s)) ||
          (u.estado && u.estado.toLowerCase().includes(s))
      );
    }
    list.sort((a, b) => a.nome.localeCompare(b.nome));
    if (!search) {
      unidadesCache = { data: list, timestamp: Date.now() };
    }
    return list;
  },

  /**
   * Lista apenas as unidades ativas para uso em formulários e seletores
   */
  async listarAtivas(): Promise<UnidadeNegocio[]> {
    const todas = await this.listar();
    return todas.filter((u) => u.ativo !== false);
  },

  /**
   * Cria uma nova unidade de negócio com validação de unicidade
   */
  async criar(dados: {
    nome: string;
    sigla?: string | null;
    cidade?: string | null;
    estado?: string | null;
    ativo?: boolean;
  }): Promise<UnidadeNegocio> {
    const nomeLimpo = dados.nome.trim();
    if (!nomeLimpo) {
      throw new Error('O nome da unidade de negócio é obrigatório.');
    }

    // Validação de duplicidade
    const existentes = await this.listar('', true);
    const duplicado = existentes.find(
      (u) => u.nome.trim().toLowerCase() === nomeLimpo.toLowerCase()
    );
    if (duplicado) {
      throw new Error(`Já existe uma unidade com o nome "${nomeLimpo}".`);
    }

    const nova: UnidadeNegocio = {
      id: generateUUID(),
      nome: nomeLimpo,
      sigla: dados.sigla?.trim().toUpperCase() || null,
      cidade: dados.cidade?.trim() || null,
      estado: dados.estado?.trim().toUpperCase() || null,
      ativo: dados.ativo ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('unidades_negocio')
          .insert({
            id: nova.id,
            nome: nova.nome,
            sigla: nova.sigla,
            cidade: nova.cidade,
            estado: nova.estado,
            ativo: nova.ativo,
          })
          .select(UNIDADES_FIELDS)
          .single();

        if (!error && data) {
          unidadesCache = null;
          // Sincroniza local
          const locais = getLocalUnidades();
          saveLocalUnidades([data as UnidadeNegocio, ...locais]);
          return data as UnidadeNegocio;
        }

        if (error) {
          console.warn('Erro ao inserir unidade no Supabase:', error.message);
          if (error.code === '23505') {
            throw new Error(`A unidade "${nomeLimpo}" já está cadastrada no Supabase.`);
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('já está cadastrada')) {
          throw err;
        }
        console.warn('Gravando unidade apenas localmente devido a indisponibilidade remota.');
      }
    }

    // Salva localmente
    const locais = getLocalUnidades();
    locais.unshift(nova);
    saveLocalUnidades(locais);
    unidadesCache = null;
    return nova;
  },

  /**
   * Atualiza dados de uma unidade de negócio existente
   */
  async atualizar(
    id: string,
    dados: Partial<Omit<UnidadeNegocio, 'id' | 'created_at'>>
  ): Promise<UnidadeNegocio> {
    if (dados.nome !== undefined) {
      const nomeLimpo = dados.nome.trim();
      if (!nomeLimpo) {
        throw new Error('O nome da unidade não pode ficar vazio.');
      }
      // Verificar duplicidade de nome com outros registros
      const existentes = await this.listar('', true);
      const outro = existentes.find(
        (u) => u.id !== id && u.nome.trim().toLowerCase() === nomeLimpo.toLowerCase()
      );
      if (outro) {
        throw new Error(`Já existe outra unidade cadastrada com o nome "${nomeLimpo}".`);
      }
    }

    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (dados.nome !== undefined) payload.nome = dados.nome.trim();
    if (dados.sigla !== undefined) payload.sigla = dados.sigla ? dados.sigla.trim().toUpperCase() : null;
    if (dados.cidade !== undefined) payload.cidade = dados.cidade ? dados.cidade.trim() : null;
    if (dados.estado !== undefined) payload.estado = dados.estado ? dados.estado.trim().toUpperCase() : null;
    if (dados.ativo !== undefined) payload.ativo = Boolean(dados.ativo);

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('unidades_negocio')
          .update(payload)
          .eq('id', id)
          .select(UNIDADES_FIELDS)
          .single();

        if (!error && data) {
          unidadesCache = null;
          const locais = getLocalUnidades();
          const idx = locais.findIndex((u) => u.id === id);
          if (idx >= 0) {
            locais[idx] = data as UnidadeNegocio;
            saveLocalUnidades(locais);
          }
          return data as UnidadeNegocio;
        }
      } catch (err) {
        console.warn('Erro ao atualizar no Supabase, atualizando local:', err);
      }
    }

    // Local
    const locais = getLocalUnidades();
    const idx = locais.findIndex((u) => u.id === id);
    if (idx < 0) {
      throw new Error('Unidade de negócio não encontrada para atualização.');
    }
    const atualizado: UnidadeNegocio = {
      ...locais[idx],
      ...payload,
      id,
    };
    locais[idx] = atualizado;
    saveLocalUnidades(locais);
    unidadesCache = null;
    return atualizado;
  },

  /**
   * Alterna status ativo/inativo garantindo que ao menos uma unidade permaneça ativa
   */
  async alternarStatus(id: string, novoStatus: boolean): Promise<UnidadeNegocio> {
    if (!novoStatus) {
      const ativas = await this.listarAtivas();
      if (ativas.length <= 1 && ativas.some((u) => u.id === id)) {
        throw new Error('Não é permitido inativar todas as unidades. O sistema precisa de ao menos uma filial ativa.');
      }
    }
    return this.atualizar(id, { ativo: novoStatus });
  },

  /**
   * Exclui uma unidade de negócio (ou inativa caso já contenha referências)
   */
  async excluir(id: string, nome: string): Promise<void> {
    const ativas = await this.listarAtivas();
    if (ativas.length <= 1 && ativas.some((u) => u.id === id)) {
      throw new Error('Esta é a única unidade ativa no momento e não pode ser removida.');
    }

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('unidades_negocio')
          .delete()
          .eq('id', id);

        if (error) {
          // Se houver restrição de integridade referencial, inativar automaticamente
          if (error.code === '23503') {
            await this.atualizar(id, { ativo: false });
            throw new Error(
              `A unidade "${nome}" possui registros vinculados em cargas/colaboradores. Para manter o histórico íntegro, ela foi inativada automaticamente.`
            );
          }
          throw new Error(error.message);
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('foi inativada automaticamente')) {
          throw err;
        }
        console.warn('Erro ao deletar no Supabase:', err);
      }
    }

    // Exclusão local
    const locais = getLocalUnidades();
    const filtrado = locais.filter((u) => u.id !== id);
    saveLocalUnidades(filtrado);
    unidadesCache = null;
  },
};
