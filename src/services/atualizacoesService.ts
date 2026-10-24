import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { Atualizacao } from '../types';
import { UNIDADE_PADRAO_SISTEMA } from '../constants/unidades';

const LOCAL_STORAGE_KEY = 'polihub_atualizacoes';
const ATUALIZACAO_FIELDS = 'id, unidade_negocio, numero, modulo, tipo, titulo, descricao, registro_id, usuario_id, data_evento, created_at';

function getLocalAtualizacoes(): Atualizacao[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Erro ao ler atualizações locais:', err);
    return [];
  }
}

function saveLocalAtualizacoes(items: Atualizacao[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('Erro ao salvar atualizações locais:', err);
  }
}

export const atualizacoesService = {
  /**
   * Lista as atualizações operacionais recentes, filtrando por Unidade de Negócio
   */
  async listar(unidadeNegocio?: string, limit = 50): Promise<Atualizacao[]> {
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('atualizacoes')
          .select(ATUALIZACAO_FIELDS)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (unidadeNegocio) {
          query = query.eq('unidade_negocio', unidadeNegocio);
        }

        const { data, error } = await query;
        if (!error && data) {
          return data as Atualizacao[];
        }
      } catch (err) {
        console.warn('Erro ao carregar atualizações via Supabase:', err);
      }
    }

    // Fallback local
    const locais = getLocalAtualizacoes();
    return locais
      .filter((a) => !unidadeNegocio || !a.unidade_negocio || a.unidade_negocio === unidadeNegocio)
      .slice(0, limit);
  },

  /**
   * Registra um evento operacional isolado por Unidade de Negócio
   */
  async registrar(dados: {
    unidade_negocio?: string;
    modulo: string;
    tipo: string;
    titulo: string;
    descricao?: string | null;
    registro_id?: string | null;
    usuario_id?: string | null;
    data_evento?: string;
  }): Promise<Atualizacao | null> {
    const unidadeFinal = dados.unidade_negocio || UNIDADE_PADRAO_SISTEMA;
    const nowIso = new Date().toISOString();

    const novoItem: Atualizacao = {
      id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `act-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      unidade_negocio: unidadeFinal,
      numero: Date.now(),
      modulo: dados.modulo,
      tipo: dados.tipo,
      titulo: dados.titulo,
      descricao: dados.descricao || null,
      registro_id: dados.registro_id || null,
      usuario_id: dados.usuario_id || null,
      data_evento: dados.data_evento || nowIso,
      created_at: nowIso,
    };

    const supabase = getSupabase();
    let gravadoComSucesso = false;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('atualizacoes')
          .insert({
            unidade_negocio: novoItem.unidade_negocio,
            modulo: novoItem.modulo,
            tipo: novoItem.tipo,
            titulo: novoItem.titulo,
            descricao: novoItem.descricao,
            registro_id: novoItem.registro_id,
            usuario_id: novoItem.usuario_id,
            data_evento: novoItem.data_evento,
          })
          .select(ATUALIZACAO_FIELDS)
          .single();

        if (!error && data) {
          gravadoComSucesso = true;
          Object.assign(novoItem, data);
        }
      } catch (err) {
        console.warn('Erro ao registrar atualização no Supabase:', err);
      }
    }

    // Salva localmente como backup/cache
    const locais = getLocalAtualizacoes();
    locais.unshift(novoItem);
    if (locais.length > 200) locais.length = 200;
    saveLocalAtualizacoes(locais);

    // Dispara evento para atualização da interface em tempo real
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('polihub_atualizacoes_refresh', { detail: novoItem }));
    }

    return novoItem;
  },
};
