import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { Fornecedor, Transportadora } from '../types';
import {
  getLocalFornecedores,
  getLocalTransportadoras,
  saveLocalFornecedores,
  saveLocalTransportadoras,
} from './mockStorage';

// Explicit field lists to strictly avoid SELECT *
const DROPDOWN_FIELDS = 'id, nome_fantasia, ativo';
const FULL_FIELDS = 'id, razao_social, nome_fantasia, ativo, created_at';

// In-memory caching for minimal Supabase egress
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
let transportadorasCache: CacheEntry<Transportadora[]> | null = null;
let fornecedoresCache: CacheEntry<Fornecedor[]> | null = null;
const CACHE_TTL_MS = 20000; // 20s cache

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

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

export const cadastrosService = {
  // --------------------------------------------------------------------------
  // TRANSPORTADORAS
  // --------------------------------------------------------------------------

  /**
   * Fast list for dropdowns (only id and nome_fantasia)
   */
  async listDropdownTransportadoras(forceRefresh = false): Promise<Array<Pick<Transportadora, 'id' | 'nome_fantasia'>>> {
    const all = await this.listTransportadoras('', forceRefresh);
    return all
      .filter((t) => t.ativo !== false)
      .map((t) => ({ id: t.id, nome_fantasia: t.nome_fantasia }));
  },

  /**
   * List all transportadoras with optional search filter
   */
  async listTransportadoras(search = '', forceRefresh = false): Promise<Transportadora[]> {
    if (!forceRefresh && !search && transportadorasCache && Date.now() - transportadorasCache.timestamp < CACHE_TTL_MS) {
      return transportadorasCache.data;
    }

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('transportadoras')
          .select(FULL_FIELDS)
          .order('nome_fantasia', { ascending: true });

        if (search.trim()) {
          const s = search.trim();
          query = query.or(`nome_fantasia.ilike.%${s}%,razao_social.ilike.%${s}%`);
        }

        const { data, error } = await query;
        if (!error && data) {
          const typed = data as Transportadora[];
          if (!search) {
            transportadorasCache = { data: typed, timestamp: Date.now() };
          }
          return typed;
        }
        if (error && error.code !== '42P01') {
          console.warn('Erro ao buscar transportadoras no Supabase:', error.message);
        }
      } catch (err) {
        console.warn('Fallback para armazenamento local de transportadoras:', err);
      }
    }

    // Local fallback
    let list = getLocalTransportadoras();
    if (search.trim()) {
      const s = normalize(search);
      list = list.filter(
        (t) => normalize(t.nome_fantasia).includes(s) || normalize(t.razao_social).includes(s)
      );
    }
    list.sort((a, b) => a.nome_fantasia.localeCompare(b.nome_fantasia));
    if (!search) {
      transportadorasCache = { data: list, timestamp: Date.now() };
    }
    return list;
  },

  /**
   * Check for duplicate razao_social or nome_fantasia
   */
  async checkDuplicateTransportadora(razao_social: string, nome_fantasia: string, excludeId?: string): Promise<boolean> {
    const normRazao = normalize(razao_social);
    const normFantasia = normalize(nome_fantasia);

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('transportadoras')
          .select('id, razao_social, nome_fantasia')
          .or(`razao_social.ilike.${razao_social.trim()},nome_fantasia.ilike.${nome_fantasia.trim()}`);

        if (excludeId) {
          query = query.neq('id', excludeId);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return true;
        }
      } catch {
        // Continue to local check
      }
    }

    const localList = getLocalTransportadoras();
    return localList.some((t) => {
      if (excludeId && t.id === excludeId) return false;
      return normalize(t.razao_social) === normRazao || normalize(t.nome_fantasia) === normFantasia;
    });
  },

  /**
   * Create new transportadora
   */
  async createTransportadora(data: { razao_social: string; nome_fantasia: string }): Promise<Transportadora> {
    transportadorasCache = null;
    const razao_social = data.razao_social.trim();
    const nome_fantasia = data.nome_fantasia.trim();

    if (!razao_social || !nome_fantasia) {
      throw new Error('Razão Social e Nome Fantasia são obrigatórios.');
    }

    const isDuplicate = await this.checkDuplicateTransportadora(razao_social, nome_fantasia);
    if (isDuplicate) {
      throw new Error('Este cadastro já existe.');
    }

    const id = generateUUID();
    const newRecord: Transportadora = {
      id,
      razao_social,
      nome_fantasia,
      ativo: true,
      created_at: new Date().toISOString(),
    };

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: inserted, error } = await supabase
          .from('transportadoras')
          .insert({
            id,
            razao_social,
            nome_fantasia,
            ativo: true,
          })
          .select(FULL_FIELDS)
          .single();

        if (!error && inserted) {
          // Keep local mirror updated
          const current = getLocalTransportadoras();
          saveLocalTransportadoras([inserted as Transportadora, ...current.filter((c) => c.id !== id)]);
          return inserted as Transportadora;
        }
        if (error && error.code !== '42P01') {
          throw new Error(`Erro ao salvar no Supabase: ${error.message}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Este cadastro já existe')) throw err;
        console.warn('Falha na inserção no Supabase, salvando localmente:', err);
      }
    }

    // Local save
    const current = getLocalTransportadoras();
    saveLocalTransportadoras([newRecord, ...current]);
    return newRecord;
  },

  /**
   * Update transportadora
   */
  async updateTransportadora(id: string, data: { razao_social: string; nome_fantasia: string; ativo?: boolean }): Promise<Transportadora> {
    transportadorasCache = null;
    const razao_social = data.razao_social.trim();
    const nome_fantasia = data.nome_fantasia.trim();

    if (!razao_social || !nome_fantasia) {
      throw new Error('Razão Social e Nome Fantasia são obrigatórios.');
    }

    const isDuplicate = await this.checkDuplicateTransportadora(razao_social, nome_fantasia, id);
    if (isDuplicate) {
      throw new Error('Este cadastro já existe.');
    }

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const payload: Partial<Transportadora> = {
          razao_social,
          nome_fantasia,
        };
        if (data.ativo !== undefined) payload.ativo = data.ativo;

        const { data: updated, error } = await supabase
          .from('transportadoras')
          .update(payload)
          .eq('id', id)
          .select(FULL_FIELDS)
          .single();

        if (!error && updated) {
          const current = getLocalTransportadoras();
          saveLocalTransportadoras(current.map((t) => (t.id === id ? (updated as Transportadora) : t)));
          return updated as Transportadora;
        }
      } catch (err) {
        console.warn('Erro ao atualizar no Supabase, atualizando local:', err);
      }
    }

    const current = getLocalTransportadoras();
    const existing = current.find((t) => t.id === id);
    if (!existing) throw new Error('Transportadora não encontrada.');

    const updated: Transportadora = {
      ...existing,
      razao_social,
      nome_fantasia,
      ativo: data.ativo !== undefined ? data.ativo : existing.ativo,
    };
    saveLocalTransportadoras(current.map((t) => (t.id === id ? updated : t)));
    return updated;
  },

  /**
   * Delete transportadora with historical check
   */
  async deleteTransportadora(id: string, nome_fantasia: string): Promise<{ success: boolean; inactivated?: boolean }> {
    transportadorasCache = null;
    const isUsed = await this.isTransportadoraInUse(id, nome_fantasia);

    if (isUsed) {
      // Inactivate logically to preserve history
      await this.updateTransportadora(id, { razao_social: nome_fantasia, nome_fantasia, ativo: false });
      throw new Error('Este cadastro está vinculado a registros existentes e não pode ser excluído. O registro foi inativado para preservar o histórico.');
    }

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('transportadoras').delete().eq('id', id);
        if (error && error.code !== '42P01') {
          throw new Error(`Erro ao excluir: ${error.message}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('vinculado')) throw err;
        console.warn('Erro ao excluir do Supabase:', err);
      }
    }

    const current = getLocalTransportadoras();
    saveLocalTransportadoras(current.filter((t) => t.id !== id));
    return { success: true };
  },

  /**
   * Inactivate transportadora explicitly
   */
  async inactivateTransportadora(id: string): Promise<void> {
    transportadorasCache = null;
    const all = getLocalTransportadoras();
    const target = all.find((t) => t.id === id);
    if (!target) return;
    await this.updateTransportadora(id, {
      razao_social: target.razao_social,
      nome_fantasia: target.nome_fantasia,
      ativo: false,
    });
  },

  /**
   * Check if transportadora is in use in agendamentos
   */
  async isTransportadoraInUse(id: string, nome_fantasia: string): Promise<boolean> {
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        // Check both ID and historical text column
        const { data, error } = await supabase
          .from('agendamentos')
          .select('id')
          .or(`transportadora_id.eq.${id},transportadora.ilike.${nome_fantasia.trim()}`)
          .limit(1);

        if (!error && data && data.length > 0) {
          return true;
        }
      } catch {
        // Proceed to local check
      }
    }

    // Check local storage agendamentos
    try {
      const raw = localStorage.getItem('polihub_agendamentos');
      if (raw) {
        const agendamentos = JSON.parse(raw);
        const norm = normalize(nome_fantasia);
        return agendamentos.some(
          (a: any) =>
            a.transportadora_id === id ||
            (a.transportadora && normalize(a.transportadora) === norm)
        );
      }
    } catch {
      // Ignored
    }
    return false;
  },

  // --------------------------------------------------------------------------
  // FORNECEDORES / FÁBRICAS
  // --------------------------------------------------------------------------

  /**
   * Fast list for dropdowns (only id and nome_fantasia)
   */
  async listDropdownFornecedores(forceRefresh = false): Promise<Array<Pick<Fornecedor, 'id' | 'nome_fantasia'>>> {
    const all = await this.listFornecedores('', forceRefresh);
    return all
      .filter((f) => f.ativo !== false)
      .map((f) => ({ id: f.id, nome_fantasia: f.nome_fantasia }));
  },

  /**
   * List all fornecedores with optional search filter
   */
  async listFornecedores(search = '', forceRefresh = false): Promise<Fornecedor[]> {
    if (!forceRefresh && !search && fornecedoresCache && Date.now() - fornecedoresCache.timestamp < CACHE_TTL_MS) {
      return fornecedoresCache.data;
    }

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('fornecedores')
          .select(FULL_FIELDS)
          .order('nome_fantasia', { ascending: true });

        if (search.trim()) {
          const s = search.trim();
          query = query.or(`nome_fantasia.ilike.%${s}%,razao_social.ilike.%${s}%`);
        }

        const { data, error } = await query;
        if (!error && data) {
          const typed = data as Fornecedor[];
          if (!search) {
            fornecedoresCache = { data: typed, timestamp: Date.now() };
          }
          return typed;
        }
        if (error && error.code !== '42P01') {
          console.warn('Erro ao buscar fornecedores no Supabase:', error.message);
        }
      } catch (err) {
        console.warn('Fallback para armazenamento local de fornecedores:', err);
      }
    }

    // Local fallback
    let list = getLocalFornecedores();
    if (search.trim()) {
      const s = normalize(search);
      list = list.filter(
        (f) => normalize(f.nome_fantasia).includes(s) || normalize(f.razao_social).includes(s)
      );
    }
    list.sort((a, b) => a.nome_fantasia.localeCompare(b.nome_fantasia));
    if (!search) {
      fornecedoresCache = { data: list, timestamp: Date.now() };
    }
    return list;
  },

  /**
   * Check for duplicate razao_social or nome_fantasia
   */
  async checkDuplicateFornecedor(razao_social: string, nome_fantasia: string, excludeId?: string): Promise<boolean> {
    const normRazao = normalize(razao_social);
    const normFantasia = normalize(nome_fantasia);

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('fornecedores')
          .select('id, razao_social, nome_fantasia')
          .or(`razao_social.ilike.${razao_social.trim()},nome_fantasia.ilike.${nome_fantasia.trim()}`);

        if (excludeId) {
          query = query.neq('id', excludeId);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return true;
        }
      } catch {
        // Continue to local check
      }
    }

    const localList = getLocalFornecedores();
    return localList.some((f) => {
      if (excludeId && f.id === excludeId) return false;
      return normalize(f.razao_social) === normRazao || normalize(f.nome_fantasia) === normFantasia;
    });
  },

  /**
   * Create new fornecedor
   */
  async createFornecedor(data: { razao_social: string; nome_fantasia: string }): Promise<Fornecedor> {
    fornecedoresCache = null;
    const razao_social = data.razao_social.trim();
    const nome_fantasia = data.nome_fantasia.trim();

    if (!razao_social || !nome_fantasia) {
      throw new Error('Razão Social e Nome Fantasia são obrigatórios.');
    }

    const isDuplicate = await this.checkDuplicateFornecedor(razao_social, nome_fantasia);
    if (isDuplicate) {
      throw new Error('Este cadastro já existe.');
    }

    const id = generateUUID();
    const newRecord: Fornecedor = {
      id,
      razao_social,
      nome_fantasia,
      ativo: true,
      created_at: new Date().toISOString(),
    };

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: inserted, error } = await supabase
          .from('fornecedores')
          .insert({
            id,
            razao_social,
            nome_fantasia,
            ativo: true,
          })
          .select(FULL_FIELDS)
          .single();

        if (!error && inserted) {
          const current = getLocalFornecedores();
          saveLocalFornecedores([inserted as Fornecedor, ...current.filter((c) => c.id !== id)]);
          return inserted as Fornecedor;
        }
        if (error && error.code !== '42P01') {
          throw new Error(`Erro ao salvar no Supabase: ${error.message}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Este cadastro já existe')) throw err;
        console.warn('Falha na inserção no Supabase, salvando localmente:', err);
      }
    }

    // Local save
    const current = getLocalFornecedores();
    saveLocalFornecedores([newRecord, ...current]);
    return newRecord;
  },

  /**
   * Update fornecedor
   */
  async updateFornecedor(id: string, data: { razao_social: string; nome_fantasia: string; ativo?: boolean }): Promise<Fornecedor> {
    fornecedoresCache = null;
    const razao_social = data.razao_social.trim();
    const nome_fantasia = data.nome_fantasia.trim();

    if (!razao_social || !nome_fantasia) {
      throw new Error('Razão Social e Nome Fantasia são obrigatórios.');
    }

    const isDuplicate = await this.checkDuplicateFornecedor(razao_social, nome_fantasia, id);
    if (isDuplicate) {
      throw new Error('Este cadastro já existe.');
    }

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const payload: Partial<Fornecedor> = {
          razao_social,
          nome_fantasia,
        };
        if (data.ativo !== undefined) payload.ativo = data.ativo;

        const { data: updated, error } = await supabase
          .from('fornecedores')
          .update(payload)
          .eq('id', id)
          .select(FULL_FIELDS)
          .single();

        if (!error && updated) {
          const current = getLocalFornecedores();
          saveLocalFornecedores(current.map((f) => (f.id === id ? (updated as Fornecedor) : f)));
          return updated as Fornecedor;
        }
      } catch (err) {
        console.warn('Erro ao atualizar no Supabase, atualizando local:', err);
      }
    }

    const current = getLocalFornecedores();
    const existing = current.find((f) => f.id === id);
    if (!existing) throw new Error('Fornecedor não encontrado.');

    const updated: Fornecedor = {
      ...existing,
      razao_social,
      nome_fantasia,
      ativo: data.ativo !== undefined ? data.ativo : existing.ativo,
    };
    saveLocalFornecedores(current.map((f) => (f.id === id ? updated : f)));
    return updated;
  },

  /**
   * Delete fornecedor with historical check
   */
  async deleteFornecedor(id: string, nome_fantasia: string): Promise<{ success: boolean; inactivated?: boolean }> {
    fornecedoresCache = null;
    const isUsed = await this.isFornecedorInUse(id, nome_fantasia);

    if (isUsed) {
      await this.updateFornecedor(id, { razao_social: nome_fantasia, nome_fantasia, ativo: false });
      throw new Error('Este cadastro está vinculado a registros existentes e não pode ser excluído. O registro foi inativado para preservar o histórico.');
    }

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('fornecedores').delete().eq('id', id);
        if (error && error.code !== '42P01') {
          throw new Error(`Erro ao excluir: ${error.message}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('vinculado')) throw err;
        console.warn('Erro ao excluir do Supabase:', err);
      }
    }

    const current = getLocalFornecedores();
    saveLocalFornecedores(current.filter((f) => f.id !== id));
    return { success: true };
  },

  /**
   * Inactivate fornecedor explicitly
   */
  async inactivateFornecedor(id: string): Promise<void> {
    fornecedoresCache = null;
    const all = getLocalFornecedores();
    const target = all.find((f) => f.id === id);
    if (!target) return;
    await this.updateFornecedor(id, {
      razao_social: target.razao_social,
      nome_fantasia: target.nome_fantasia,
      ativo: false,
    });
  },

  /**
   * Check if fornecedor is in use in agendamentos
   */
  async isFornecedorInUse(id: string, nome_fantasia: string): Promise<boolean> {
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('agendamentos')
          .select('id')
          .or(`fornecedor_id.eq.${id},fornecedor.ilike.${nome_fantasia.trim()}`)
          .limit(1);

        if (!error && data && data.length > 0) {
          return true;
        }
      } catch {
        // Proceed to local check
      }
    }

    try {
      const raw = localStorage.getItem('polihub_agendamentos');
      if (raw) {
        const agendamentos = JSON.parse(raw);
        const norm = normalize(nome_fantasia);
        return agendamentos.some(
          (a: any) =>
            a.fornecedor_id === id ||
            (a.fornecedor && normalize(a.fornecedor) === norm)
        );
      }
    } catch {
      // Ignored
    }
    return false;
  },
};
