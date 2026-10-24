import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { RegistroEndereco } from '../types';
import { getLocalTabelaEnderecos, saveLocalTabelaEnderecos } from './mockStorage';
import { getActiveUserUnit, itemMatchesUserUnit, getUnitEquivalents } from './sessionHelper';
import { UNIDADE_PADRAO_SISTEMA } from '../constants/unidades';

// Campos da tabela real public.enderecos do Supabase
const CAMPOS_ENDERECOS = 'id, unidade_negocio, endereco, descricao, ativo, created_at';
const CAMPOS_ENDERECOS_FALLBACK = 'id, endereco, descricao, ativo, created_at';

export interface FiltrosEnderecos {
  busca?: string;
  status?: 'todos' | 'ativos' | 'inativos';
  unidade_negocio?: string;
}

export interface FiltrosEnderecosPaginado extends FiltrosEnderecos {
  page?: number;
  pageSize?: number;
  ordenacao?: 'endereco_asc' | 'endereco_desc' | 'data_desc';
}

export interface ResultadoEnderecosPaginado {
  items: RegistroEndereco[];
  total: number;
  totalPages: number;
}

export interface MetricasEnderecos {
  total: number;
  ativos: number;
  inativos: number;
}

export const enderecosService = {
  /**
   * Lista endereços com paginação oficial no Supabase (40 registros por página padrão)
   * Preserva filtros, busca e ordenação.
   */
  async listarPaginado(filtros: FiltrosEnderecosPaginado = {}): Promise<ResultadoEnderecosPaginado> {
    const page = Math.max(1, filtros.page || 1);
    const pageSize = Math.max(1, filtros.pageSize || 40);
    const offset = (page - 1) * pageSize;
    const activeUnit = filtros.unidade_negocio || getActiveUserUnit();
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('enderecos')
          .select(CAMPOS_ENDERECOS, { count: 'exact' });

        if (filtros.ordenacao === 'endereco_desc') {
          query = query.order('endereco', { ascending: false });
        } else if (filtros.ordenacao === 'data_desc') {
          query = query.order('created_at', { ascending: false });
        } else {
          query = query.order('endereco', { ascending: true });
        }

        if (activeUnit) {
          query = query.in('unidade_negocio', getUnitEquivalents(activeUnit));
        }

        if (filtros.status === 'ativos') {
          query = query.eq('ativo', true);
        } else if (filtros.status === 'inativos') {
          query = query.eq('ativo', false);
        }

        if (filtros.busca && filtros.busca.trim()) {
          const termo = filtros.busca.trim();
          query = query.or(`endereco.ilike.%${termo}%,descricao.ilike.%${termo}%`);
        }

        query = query.range(offset, offset + pageSize - 1);

        let { data, count, error } = await query;

        // Fallback se coluna unidade_negocio nao existir
        if (error && (error.message.includes('unidade_negocio') || error.code === '42703')) {
          let retry = supabase
            .from('enderecos')
            .select(CAMPOS_ENDERECOS_FALLBACK, { count: 'exact' })
            .order('endereco', { ascending: filtros.ordenacao !== 'endereco_desc' })
            .range(offset, offset + pageSize - 1);

          if (filtros.status === 'ativos') retry = retry.eq('ativo', true);
          else if (filtros.status === 'inativos') retry = retry.eq('ativo', false);
          if (filtros.busca && filtros.busca.trim()) {
            retry = retry.or(`endereco.ilike.%${filtros.busca.trim()}%,descricao.ilike.%${filtros.busca.trim()}%`);
          }
          const retryRes = await retry;
          data = retryRes.data ? (retryRes.data as any[]).map((d) => ({ ...d, unidade_negocio: activeUnit })) : null;
          count = retryRes.count;
          error = retryRes.error;
        }

        if (!error && data) {
          const total = count ?? data.length;
          return {
            items: data as RegistroEndereco[],
            total,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
          };
        }
      } catch (err) {
        console.warn('Exceção ao listar endereços paginados no Supabase:', err);
      }
    }

    // Fallback local
    const todos = await this.listar(filtros);
    const total = todos.length;
    const items = todos.slice(offset, offset + pageSize);
    return {
      items,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  /**
   * Lista todos os endereços da tabela real public.enderecos com filtros e fallback
   */
  async listar(filtros: FiltrosEnderecos = {}): Promise<RegistroEndereco[]> {
    const activeUnit = filtros.unidade_negocio || getActiveUserUnit();
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('enderecos')
          .select(CAMPOS_ENDERECOS)
          .order('endereco', { ascending: true });

        if (activeUnit) {
          query = query.in('unidade_negocio', getUnitEquivalents(activeUnit));
        }

        if (filtros.status === 'ativos') {
          query = query.eq('ativo', true);
        } else if (filtros.status === 'inativos') {
          query = query.eq('ativo', false);
        }

        if (filtros.busca && filtros.busca.trim()) {
          const termo = filtros.busca.trim();
          query = query.or(`endereco.ilike.%${termo}%,descricao.ilike.%${termo}%`);
        }

        let { data, error }: { data: any; error: any } = await query;

        // Se a coluna unidade_negocio ainda não existir na tabela, faz fallback seguro
        if (error && (error.message.includes('unidade_negocio') || error.code === '42703')) {
          let retryQuery = supabase
            .from('enderecos')
            .select(CAMPOS_ENDERECOS_FALLBACK)
            .order('endereco', { ascending: true });

          if (filtros.status === 'ativos') {
            retryQuery = retryQuery.eq('ativo', true);
          } else if (filtros.status === 'inativos') {
            retryQuery = retryQuery.eq('ativo', false);
          }

          if (filtros.busca && filtros.busca.trim()) {
            const termo = filtros.busca.trim();
            retryQuery = retryQuery.or(`endereco.ilike.%${termo}%,descricao.ilike.%${termo}%`);
          }

          const retryRes = await retryQuery;
          data = retryRes.data;
          error = retryRes.error;
        }

        if (!error && data) {
          let items = data as RegistroEndereco[];
          if (activeUnit) {
            items = items.filter((item) => itemMatchesUserUnit(item.unidade_negocio, activeUnit));
          }
          return items;
        }

        if (error) {
          console.error('Erro ao consultar public.enderecos no Supabase:', error.message);
          throw new Error(`Erro ao consultar tabela public.enderecos: ${error.message}`);
        }
      } catch (err) {
        console.error('Falha na requisição de endereços no Supabase:', err);
        if (err instanceof Error && !err.message.includes('Failed to fetch')) {
          throw err;
        }
      }
    }

    return this.listarLocal(filtros);
  },

  /**
   * Lista endereços armazenados localmente (modo offline / preview)
   */
  listarLocal(filtros: FiltrosEnderecos = {}): RegistroEndereco[] {
    const todos = getLocalTabelaEnderecos();
    const activeUnit = filtros.unidade_negocio || getActiveUserUnit();

    return todos.filter((item) => {
      if (activeUnit && !itemMatchesUserUnit(item.unidade_negocio, activeUnit)) {
        return false;
      }
      if (filtros.status === 'ativos' && !item.ativo) {
        return false;
      }
      if (filtros.status === 'inativos' && item.ativo) {
        return false;
      }
      if (filtros.busca && filtros.busca.trim()) {
        const termo = filtros.busca.trim().toLowerCase();
        const bateEndereco = item.endereco.toLowerCase().includes(termo);
        const bateDescricao = item.descricao ? item.descricao.toLowerCase().includes(termo) : false;
        if (!bateEndereco && !bateDescricao) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => a.endereco.localeCompare(b.endereco));
  },

  /**
   * Obtém um endereço por ID
   */
  async obterPorId(id: number | string): Promise<RegistroEndereco | null> {
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('enderecos')
          .select(CAMPOS_ENDERECOS)
          .eq('id', id)
          .maybeSingle();

        if (!error && data) {
          return data as RegistroEndereco;
        }
      } catch (err) {
        console.warn('Erro ao buscar endereço por ID no Supabase:', err);
      }
    }

    const local = getLocalTabelaEnderecos().find((e) => String(e.id) === String(id));
    return local || null;
  },

  /**
   * Cria um novo endereço na tabela public.enderecos
   */
  async criar(dados: {
    endereco: string;
    descricao?: string | null;
    ativo?: boolean;
    unidade_negocio?: string;
  }): Promise<RegistroEndereco> {
    const limpoEndereco = dados.endereco.trim().toUpperCase();
    if (!limpoEndereco) {
      throw new Error('O código do endereço é obrigatório.');
    }

    const targetUnidade = dados.unidade_negocio || getActiveUserUnit() || UNIDADE_PADRAO_SISTEMA;
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        let insertPayload: any = {
          endereco: limpoEndereco,
          descricao: dados.descricao?.trim() || null,
          ativo: dados.ativo !== undefined ? dados.ativo : true,
          unidade_negocio: targetUnidade,
        };

        let { data, error } = await supabase
          .from('enderecos')
          .insert(insertPayload)
          .select(CAMPOS_ENDERECOS)
          .single();

        if (error && (error.message.includes('unidade_negocio') || error.code === '42703')) {
          delete insertPayload.unidade_negocio;
          const retryRes = await supabase
            .from('enderecos')
            .insert(insertPayload)
            .select(CAMPOS_ENDERECOS_FALLBACK)
            .single();
          data = retryRes.data ? { ...retryRes.data, unidade_negocio: targetUnidade } : null;
          error = retryRes.error;
        }

        if (error) {
          if (error.code === '23505') {
            throw new Error(`O endereço "${limpoEndereco}" já está cadastrado.`);
          }
          if (error.message?.includes('violates row-level security policy') || error.message?.includes('row-level security')) {
            throw new Error(`Permissão de gravação negada por política RLS na tabela public.enderecos. Execute o script de permissões RLS no Supabase SQL Editor.`);
          }
          throw new Error(`Erro ao salvar no banco: ${error.message}`);
        }

        if (data) {
          return data as RegistroEndereco;
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          throw err;
        }
        throw new Error('Falha ao cadastrar endereço no Supabase.');
      }
    }

    // Fallback local
    const locais = getLocalTabelaEnderecos();
    const jaExiste = locais.some((e) => e.endereco.toUpperCase() === limpoEndereco);
    if (jaExiste) {
      throw new Error(`O endereço "${limpoEndereco}" já está cadastrado.`);
    }

    const novoRegistro: RegistroEndereco = {
      id: Date.now(),
      unidade_negocio: targetUnidade,
      endereco: limpoEndereco,
      descricao: dados.descricao?.trim() || null,
      ativo: dados.ativo !== undefined ? dados.ativo : true,
      created_at: new Date().toISOString(),
    };

    saveLocalTabelaEnderecos([...locais, novoRegistro]);
    return novoRegistro;
  },

  /**
   * Atualiza endereço existente
   */
  async atualizar(
    id: number | string,
    dados: {
      endereco?: string;
      descricao?: string | null;
      ativo?: boolean;
      unidade_negocio?: string;
    }
  ): Promise<RegistroEndereco> {
    const supabase = getSupabase();

    const updates: Partial<RegistroEndereco> = {};
    if (dados.endereco !== undefined) {
      updates.endereco = dados.endereco.trim().toUpperCase();
    }
    if (dados.descricao !== undefined) {
      updates.descricao = dados.descricao?.trim() || null;
    }
    if (dados.ativo !== undefined) {
      updates.ativo = dados.ativo;
    }
    if (dados.unidade_negocio !== undefined) {
      updates.unidade_negocio = dados.unidade_negocio;
    }

    if (isSupabaseConfigured && supabase) {
      try {
        let { data, error } = await supabase
          .from('enderecos')
          .update(updates)
          .eq('id', id)
          .select(CAMPOS_ENDERECOS)
          .single();

        if (error && (error.message.includes('unidade_negocio') || error.code === '42703')) {
          const fallbackUpdates = { ...updates };
          delete fallbackUpdates.unidade_negocio;
          const retryRes = await supabase
            .from('enderecos')
            .update(fallbackUpdates)
            .eq('id', id)
            .select(CAMPOS_ENDERECOS_FALLBACK)
            .single();
          data = retryRes.data ? { ...retryRes.data, unidade_negocio: updates.unidade_negocio || getActiveUserUnit() || UNIDADE_PADRAO_SISTEMA } : null;
          error = retryRes.error;
        }

        if (error) {
          if (error.code === '23505') {
            throw new Error(`O endereço "${updates.endereco}" já está em uso por outro registro.`);
          }
          throw new Error(`Erro ao atualizar no banco: ${error.message}`);
        }

        if (data) {
          return data as RegistroEndereco;
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          throw err;
        }
        throw new Error('Falha ao atualizar endereço no Supabase.');
      }
    }

    // Fallback local
    const locais = getLocalTabelaEnderecos();
    const index = locais.findIndex((e) => String(e.id) === String(id));
    if (index === -1) {
      throw new Error('Endereço não encontrado.');
    }

    if (updates.endereco) {
      const duplicado = locais.some(
        (e) => String(e.id) !== String(id) && e.endereco.toUpperCase() === updates.endereco?.toUpperCase()
      );
      if (duplicado) {
        throw new Error(`O endereço "${updates.endereco}" já está em uso.`);
      }
    }

    const atualizado: RegistroEndereco = {
      ...locais[index],
      ...updates,
    };
    locais[index] = atualizado;
    saveLocalTabelaEnderecos(locais);
    return atualizado;
  },

  /**
   * Alterna rapidamente o status ativo/inativo
   */
  async alternarStatus(id: number | string, ativoAtual: boolean): Promise<RegistroEndereco> {
    return this.atualizar(id, { ativo: !ativoAtual });
  },

  /**
   * Exclui um endereço
   */
  async excluir(id: number | string): Promise<boolean> {
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('enderecos')
          .delete()
          .eq('id', id);

        if (error) {
          throw new Error(`Erro ao excluir no banco: ${error.message}`);
        }
        return true;
      } catch (err: unknown) {
        if (err instanceof Error) {
          throw err;
        }
        throw new Error('Falha ao excluir endereço no Supabase.');
      }
    }

    const locais = getLocalTabelaEnderecos();
    const filtrados = locais.filter((e) => String(e.id) !== String(id));
    saveLocalTabelaEnderecos(filtrados);
    return true;
  },

  /**
   * Métricas rápidas de endereços cadastrados filtradas pela unidade ativa
   */
  async obterMetricas(unidade?: string): Promise<MetricasEnderecos> {
    const activeUnit = unidade || getActiveUserUnit();
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('enderecos')
          .select('ativo, unidade_negocio');

        if (activeUnit) {
          query = query.in('unidade_negocio', getUnitEquivalents(activeUnit));
        }

        let { data, error }: { data: any; error: any } = await query;

        if (error && (error.message.includes('unidade_negocio') || error.code === '42703')) {
          const fallbackRes = await supabase.from('enderecos').select('ativo');
          data = fallbackRes.data;
          error = fallbackRes.error;
        }

        if (!error && data) {
          let rows = data as { ativo: boolean; unidade_negocio?: string }[];
          if (activeUnit) {
            rows = rows.filter((r) => itemMatchesUserUnit(r.unidade_negocio, activeUnit));
          }
          const total = rows.length;
          const ativos = rows.filter((d) => d.ativo).length;
          const inativos = total - ativos;
          return { total, ativos, inativos };
        }
      } catch (err) {
        console.warn('Erro ao obter métricas de endereços:', err);
      }
    }

    const locais = getLocalTabelaEnderecos().filter((item) => {
      if (activeUnit) {
        return itemMatchesUserUnit(item.unidade_negocio, activeUnit);
      }
      return true;
    });
    const total = locais.length;
    const ativos = locais.filter((e) => e.ativo).length;
    return { total, ativos, inativos: total - ativos };
  },
};
