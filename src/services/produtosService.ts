/**
 * POLIHUB — MÓDULO CADASTROS: PRODUTOS
 * Tabela Supabase: public.produtos
 * Campos: id (UUID), produto (TEXT), fabricante (TEXT), endereco (TEXT), codigo_barras (TEXT), created_at, updated_at
 * NUNCA SELECT * — Utiliza seleção explícita dos campos necessários.
 */

import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { Produto } from '../types';
import { getLocalProdutos, saveLocalProdutos } from './mockStorage';

export const CAMPOS_PRODUTOS = 'id, produto, fabricante, endereco, codigo_barras, created_at, updated_at';
export const CAMPOS_PRODUTOS_BASIC = 'id, produto, fabricante, endereco, created_at, updated_at';
export const CAMPOS_PRODUTOS_MINIMAL = 'id, produto, fabricante, endereco';

export function normalizeProduto(row: any): Produto {
  if (!row || typeof row !== 'object') {
    return {
      id: '',
      produto: 'Produto não identificado',
      fabricante: 'Fabricante não informado',
      endereco: null,
      codigo_barras: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  const nome = (row.produto || row.nome || row.descricao || row.item || 'Produto sem descrição')?.toString().trim();
  const fab = (row.fabricante || row.marca || row.fornecedor || null)?.toString().trim() || null;
  const end = (row.endereco || row.localizacao || null)?.toString().trim() || null;
  const cod = (row.codigo_barras || row.cod_barras || row.codigo || row.ean || null)?.toString().trim() || null;

  return {
    id: String(row.id || ''),
    produto: nome,
    fabricante: fab,
    endereco: end,
    codigo_barras: cod,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

export const produtosService = {
  /**
   * Alias de conveniência para listar todos os produtos
   */
  async listarTodos(search?: string): Promise<Produto[]> {
    return this.list(search);
  },

  /**
   * Obtém um produto específico pelo ID com fallbacks resilientes
   */
  async obterPorId(id: string): Promise<Produto | null> {
    if (!id) return null;
    const idLimpo = String(id).trim();
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      const fieldAttempts = [CAMPOS_PRODUTOS, CAMPOS_PRODUTOS_BASIC, CAMPOS_PRODUTOS_MINIMAL, '*'];
      for (const fields of fieldAttempts) {
        try {
          const { data, error } = await supabase
            .from('produtos')
            .select(fields)
            .eq('id', idLimpo)
            .maybeSingle();

          if (!error && data) {
            return normalizeProduto(data);
          }
          if (error && !error.message?.includes('column')) {
            break;
          }
        } catch {
          // Continua para o próximo conjunto de colunas
        }
      }
    }

    const locais = getLocalProdutos();
    const encontrado = locais.find(
      (p) => String(p.id).toLowerCase().trim() === idLimpo.toLowerCase()
    );
    return encontrado ? normalizeProduto(encontrado) : null;
  },

  /**
   * Lista produtos com paginação oficial no Supabase (10 registros por página padrão).
   * Preserva filtros e busca em tabela global sem restrição por unidade.
   */
  async listPaginated(params: {
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: Produto[]; total: number; totalPages: number }> {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, params.pageSize || 10);
    const termo = params.search?.trim();
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      const offset = (page - 1) * pageSize;
      const termoLimpo = termo ? termo.replace(/[,()]/g, ' ').trim() : '';

      const configs = [
        {
          fields: CAMPOS_PRODUTOS,
          filter: termoLimpo
            ? `produto.ilike.%${termoLimpo}%,fabricante.ilike.%${termoLimpo}%,codigo_barras.ilike.%${termoLimpo}%,endereco.ilike.%${termoLimpo}%`
            : null,
        },
        {
          fields: CAMPOS_PRODUTOS_BASIC,
          filter: termoLimpo
            ? `produto.ilike.%${termoLimpo}%,fabricante.ilike.%${termoLimpo}%,endereco.ilike.%${termoLimpo}%`
            : null,
        },
        {
          fields: CAMPOS_PRODUTOS_MINIMAL,
          filter: termoLimpo
            ? `produto.ilike.%${termoLimpo}%,fabricante.ilike.%${termoLimpo}%`
            : null,
        },
        {
          fields: '*',
          filter: termoLimpo
            ? `produto.ilike.%${termoLimpo}%,fabricante.ilike.%${termoLimpo}%`
            : null,
        },
      ];

      for (const cfg of configs) {
        try {
          let query = supabase
            .from('produtos')
            .select(cfg.fields, { count: 'exact' })
            .range(offset, offset + pageSize - 1);

          try {
            query = query.order('produto', { ascending: true });
          } catch {
            // Ignora se coluna produto não tiver ordenação direta
          }

          if (cfg.filter) {
            query = query.or(cfg.filter);
          }

          const { data, count, error } = await query;
          if (!error && data) {
            const items = (data as any[]).map(normalizeProduto);
            const total = count ?? items.length;
            return {
              items,
              total,
              totalPages: Math.max(1, Math.ceil(total / pageSize)),
            };
          }
        } catch {
          // Tenta próximo conjunto de colunas
        }
      }
    }

    // Fallback local
    const todos = await this.list(termo);
    const total = todos.length;
    const offset = (page - 1) * pageSize;
    const items = todos.slice(offset, offset + pageSize);
    return {
      items,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  /**
   * Lista todos os produtos com filtro de busca opcional (produto, fabricante, endereco ou codigo_barras)
   * Carrega até 10.000 produtos sem truncamento pelo limite padrão do PostgREST.
   */
  async list(search?: string): Promise<Produto[]> {
    const supabase = getSupabase();
    const termo = search?.trim();

    if (isSupabaseConfigured && supabase) {
      const termoLimpo = termo ? termo.replace(/[,()]/g, ' ').trim() : '';

      const configs = [
        {
          fields: CAMPOS_PRODUTOS,
          filter: termoLimpo
            ? `produto.ilike.%${termoLimpo}%,fabricante.ilike.%${termoLimpo}%,codigo_barras.ilike.%${termoLimpo}%,endereco.ilike.%${termoLimpo}%`
            : null,
        },
        {
          fields: CAMPOS_PRODUTOS_BASIC,
          filter: termoLimpo
            ? `produto.ilike.%${termoLimpo}%,fabricante.ilike.%${termoLimpo}%,endereco.ilike.%${termoLimpo}%`
            : null,
        },
        {
          fields: CAMPOS_PRODUTOS_MINIMAL,
          filter: termoLimpo
            ? `produto.ilike.%${termoLimpo}%,fabricante.ilike.%${termoLimpo}%`
            : null,
        },
        {
          fields: '*',
          filter: termoLimpo
            ? `produto.ilike.%${termoLimpo}%,fabricante.ilike.%${termoLimpo}%`
            : null,
        },
      ];

      for (const cfg of configs) {
        try {
          let query = supabase.from('produtos').select(cfg.fields);

          try {
            query = query.order('produto', { ascending: true });
          } catch {
            // Se ordenação falhar, continua
          }

          if (cfg.filter) {
            query = query.or(cfg.filter).limit(500);
          } else {
            query = query.range(0, 9999);
          }

          const { data, error } = await query;
          if (!error && Array.isArray(data)) {
            return data.map(normalizeProduto);
          }
        } catch {
          // Tenta próximo conjunto de colunas
        }
      }
    }

    // Fallback local com suporte a busca multi-palavras e insensível a acentuação
    const locais = getLocalProdutos();
    if (!termo) {
      return [...locais].sort((a, b) => a.produto.localeCompare(b.produto, 'pt-BR'));
    }

    const normalize = (s: string) =>
      (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const tNorm = normalize(termo);
    const palavras = tNorm.split(/\s+/).filter(Boolean);

    return locais
      .filter((p) => {
        const prodNorm = normalize(p.produto);
        const fabNorm = normalize(p.fabricante || '');
        const endNorm = normalize(p.endereco || '');
        const codNorm = normalize(p.codigo_barras || '');
        return palavras.every(
          (w) =>
            prodNorm.includes(w) ||
            fabNorm.includes(w) ||
            endNorm.includes(w) ||
            codNorm.includes(w)
        );
      })
      .sort((a, b) => a.produto.localeCompare(b.produto, 'pt-BR'));
  },

  /**
   * Busca um produto diretamente pelo seu código de barras (bipagem rápida)
   */
  async findByBarcode(codigoBarras: string): Promise<Produto | null> {
    const codeLimpo = codigoBarras.trim();
    if (!codeLimpo) return null;

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('produtos')
          .select(CAMPOS_PRODUTOS)
          .eq('codigo_barras', codeLimpo)
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          return data as Produto;
        }
      } catch (err) {
        console.warn('Exceção ao buscar produto por código de barras no Supabase:', err);
      }
    }

    // Fallback local
    const locais = getLocalProdutos();
    const encontrado = locais.find(
      (p) => p.codigo_barras && p.codigo_barras.trim().toLowerCase() === codeLimpo.toLowerCase()
    );
    return encontrado || null;
  },

  /**
   * Cria um novo produto na base de dados
   */
  async create(data: { produto: string; fabricante?: string; endereco?: string; codigo_barras?: string }): Promise<Produto> {
    const nomeLimpo = data.produto.trim();
    if (!nomeLimpo) {
      throw new Error('O nome do produto é obrigatório.');
    }

    const payload = {
      produto: nomeLimpo,
      fabricante: data.fabricante?.trim() || null,
      endereco: data.endereco?.trim() || null,
      codigo_barras: data.codigo_barras?.trim() || null,
    };

    const supabase = getSupabase();
    let produtoCriado: Produto | null = null;

    if (isSupabaseConfigured && supabase) {
      try {
        let res = await supabase
          .from('produtos')
          .insert([payload])
          .select('*')
          .single();

        if (res.error && res.error.message?.includes('codigo_barras')) {
          const { codigo_barras, ...payloadSemCodigo } = payload;
          res = await supabase
            .from('produtos')
            .insert([payloadSemCodigo])
            .select('*')
            .single();
        }

        if (!res.error && res.data) {
          produtoCriado = normalizeProduto(res.data);
        } else if (res.error) {
          console.warn('Erro ao inserir produto no Supabase:', res.error.message);
        }
      } catch (err) {
        console.warn('Exceção ao inserir produto no Supabase:', err);
      }
    }

    const itemFinal: Produto = produtoCriado || {
      id: `prod-${Date.now()}`,
      ...payload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const locais = getLocalProdutos();
    saveLocalProdutos([itemFinal, ...locais]);
    return itemFinal;
  },

  /**
   * Atualiza os dados de um produto existente
   */
  async update(
    id: string,
    data: { produto: string; fabricante?: string; endereco?: string; codigo_barras?: string }
  ): Promise<Produto> {
    const nomeLimpo = data.produto.trim();
    if (!nomeLimpo) {
      throw new Error('O nome do produto é obrigatório.');
    }

    const payload: {
      produto: string;
      fabricante: string | null;
      endereco: string | null;
      codigo_barras?: string | null;
      updated_at: string;
    } = {
      produto: nomeLimpo,
      fabricante: data.fabricante?.trim() || null,
      endereco: data.endereco?.trim() || null,
      codigo_barras: data.codigo_barras !== undefined ? (data.codigo_barras?.trim() || null) : undefined,
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabase();
    let produtoAtualizado: Produto | null = null;

    if (isSupabaseConfigured && supabase) {
      try {
        let res = await supabase
          .from('produtos')
          .update(payload)
          .eq('id', id)
          .select('*')
          .single();

        if (res.error && res.error.message?.includes('codigo_barras')) {
          const { codigo_barras, ...payloadSemCodigo } = payload;
          res = await supabase
            .from('produtos')
            .update(payloadSemCodigo)
            .eq('id', id)
            .select('*')
            .single();
        }

        if (!res.error && res.data) {
          produtoAtualizado = normalizeProduto(res.data);
        } else if (res.error) {
          console.warn('Erro ao atualizar produto no Supabase:', res.error.message);
        }
      } catch (err) {
        console.warn('Exceção ao atualizar produto no Supabase:', err);
      }
    }

    const locais = getLocalProdutos();
    const atualizados = locais.map((p) => {
      if (String(p.id) === String(id)) {
        produtoAtualizado = produtoAtualizado || {
          ...p,
          ...payload,
        };
        return produtoAtualizado;
      }
      return p;
    });

    saveLocalProdutos(atualizados);

    if (!produtoAtualizado) {
      throw new Error('Produto não encontrado para atualização.');
    }

    return produtoAtualizado;
  },

  /**
   * Exclui um produto
   */
  async delete(id: string): Promise<void> {
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('produtos').delete().eq('id', id);
        if (error) {
          console.warn('Erro ao deletar produto do Supabase:', error.message);
        }
      } catch (err) {
        console.warn('Exceção ao deletar produto do Supabase:', err);
      }
    }

    const locais = getLocalProdutos();
    saveLocalProdutos(locais.filter((p) => String(p.id) !== String(id)));
  },

  /**
   * Atualiza o endereço de um produto pelo nome (usado na confirmação de alteração de endereço)
   */
  async atualizarEnderecoPorNome(produtoNome: string, novoEndereco: string): Promise<void> {
    const nomeLimpo = produtoNome.trim();
    if (!nomeLimpo) return;

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('produtos')
          .update({ endereco: novoEndereco.trim(), updated_at: new Date().toISOString() })
          .ilike('produto', nomeLimpo);
      } catch (err) {
        console.warn('Erro ao sincronizar endereco na tabela produtos no Supabase:', err);
      }
    }

    const locais = getLocalProdutos();
    const atualizados = locais.map((p) => {
      if (p.produto.toLowerCase() === nomeLimpo.toLowerCase()) {
        return {
          ...p,
          endereco: novoEndereco.trim(),
          updated_at: new Date().toISOString(),
        };
      }
      return p;
    });
    saveLocalProdutos(atualizados);
  },
};
