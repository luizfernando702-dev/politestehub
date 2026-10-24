import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { ExpedicaoColeta, StatusColeta, PaginatedResult, Usuario } from '../types';
import { podeGerenciarColetas } from '../utils/permissoes';
import { getActiveUserUnit, itemMatchesUserUnit, getUnitEquivalents } from './sessionHelper';
import { UNIDADE_PADRAO_SISTEMA, normalizarUnidadeNegocio } from '../constants/unidades';
import { parseMoeda } from '../utils/moeda';

import { usuariosService } from './usuariosService';

// Explicit field selection to avoid SELECT * as strictly mandated by performance rules
export const COLETA_FIELDS = 'id, unidade_negocio, chave_nf, numero_nota_fiscal, cliente, transportadora, status, data, numero_coleta, usuario_id, valor, separador_id, conferente_id, quantidade, created_at, updated_at';
const COLETA_FIELDS_WITHOUT_OPERADORES = 'id, unidade_negocio, chave_nf, numero_nota_fiscal, cliente, transportadora, status, data, numero_coleta, usuario_id, valor, created_at, updated_at';
const COLETA_FIELDS_FALLBACK = 'id, chave_nf, numero_nota_fiscal, cliente, transportadora, status, data, numero_coleta, usuario_id, valor, created_at, updated_at';
const COLETA_FIELDS_LEGACY = 'id, chave_nf, numero_nota_fiscal, cliente, transportadora, status, data, numero_coleta, usuario_id, created_at, updated_at';

export interface ColetasFilters {
  search?: string;
  status?: StatusColeta | 'Todos';
  dataInicio?: string;
  dataFim?: string;
  page?: number;
  pageSize?: number;
  unidade_negocio?: string;
}

export interface SalvarColetaDTO {
  chave_nf?: string | null;
  numero_nota_fiscal: string;
  cliente: string;
  transportadora: string;
  status: StatusColeta;
  data?: string;
  numero_coleta?: string | null;
  valor?: number | string | null;
  separador_id?: string | null;
  conferente_id?: string | null;
  quantidade?: number | string | null;
}

export interface IndicadoresColetasResultado {
  totalColetas: number;
  totalItens: number;
  totalAgendadas: number;
  totalColetadas: number;
  taxaConclusao: number;
  produtividadeSeparadores: {
    id: string;
    nome: string;
    coletas: number;
    itens: number;
    porcentagemItens: number;
  }[];
  produtividadeConferentes: {
    id: string;
    nome: string;
    coletas: number;
    itens: number;
    porcentagemItens: number;
  }[];
  statusDistribuicao: {
    agendadas: number;
    coletadas: number;
  };
  rankingTransportadoras: {
    transportadora: string;
    coletas: number;
    itens: number;
  }[];
}

const LOCAL_STORAGE_KEY = 'polihub_expedicao_coletas';

/**
 * Prioridade de status para ordenação do módulo de coletas:
 * 0 = 'Pendente' / 'Agendada' (primeiro)
 * 1 = 'Coletada' (último)
 */
export const getColetaStatusPriority = (status?: string | null): number => {
  const s = (status || '').toLowerCase().trim();
  if (s === 'coletada' || s === 'concluido' || s === 'concluida') return 1;
  return 0; // 'pendente', 'agendada' ou outros vêm primeiro
};

export const compararColetasPorStatus = (a: ExpedicaoColeta, b: ExpedicaoColeta): number => {
  const pA = getColetaStatusPriority(a.status);
  const pB = getColetaStatusPriority(b.status);
  if (pA !== pB) return pA - pB;
  return new Date(b.data).getTime() - new Date(a.data).getTime();
};

// Helper to generate RFC4122 v4 UUID
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

function getLocalColetas(): ExpedicaoColeta[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Erro ao ler coletas do localStorage:', err);
    return [];
  }
}

function saveLocalColetas(items: ExpedicaoColeta[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('Erro ao salvar coletas no localStorage:', err);
  }
}

class ColetasService {
  /**
   * Lista coletas com filtros, paginação e ordenação pelas mais recentes.
   * Não utiliza SELECT *.
   */
  async listar(filters: ColetasFilters = {}): Promise<PaginatedResult<ExpedicaoColeta>> {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 20;
    const search = filters.search?.trim().toLowerCase();
    const status = filters.status && filters.status !== 'Todos' ? filters.status : undefined;
    const dataInicio = filters.dataInicio?.trim();
    const dataFim = filters.dataFim?.trim();
    const activeUnit = filters.unidade_negocio || getActiveUserUnit();

    if (isSupabaseConfigured) {
      try {
        const supabase = getSupabase();
        if (!supabase) throw new Error('Supabase client não inicializado');
        let query = supabase
          .from('expedicao_coletas')
          .select(COLETA_FIELDS, { count: 'exact' });

        // Filtro estrito por unidade de negócio
        if (activeUnit) {
          query = query.in('unidade_negocio', getUnitEquivalents(activeUnit));
        }

        if (status) {
          if (status === 'Pendente' || status === 'Agendada') {
            query = query.in('status', ['Agendada', 'Pendente']);
          } else {
            query = query.eq('status', status);
          }
        }

        if (dataInicio) {
          query = query.gte('data', `${dataInicio}T00:00:00.000Z`);
        }

        if (dataFim) {
          query = query.lte('data', `${dataFim}T23:59:59.999Z`);
        }

        if (search) {
          // Busca em numero_nota_fiscal, chave_nf, cliente ou transportadora
          query = query.or(
            `numero_nota_fiscal.ilike.%${search}%,chave_nf.ilike.%${search}%,cliente.ilike.%${search}%,transportadora.ilike.%${search}%`
          );
        }

        // Ordenação inicial por data
        query = query.order('data', { ascending: false }).limit(500);

        let { data, count, error }: { data: any; count: any; error: any } = await query;

        // Se coluna unidade_negocio ou valor ou operadores não existir na tabela no Supabase, fallback seguro
        if (error && (error.message.includes('unidade_negocio') || error.message.includes('valor') || error.message.includes('separador_id') || error.message.includes('quantidade') || error.code === '42703')) {
          let retryFields = error.message.includes('separador_id') || error.message.includes('quantidade')
            ? COLETA_FIELDS_WITHOUT_OPERADORES
            : error.message.includes('valor')
            ? COLETA_FIELDS_LEGACY
            : COLETA_FIELDS_FALLBACK;
          let retryQuery = supabase
            .from('expedicao_coletas')
            .select(retryFields, { count: 'exact' });

          if (status) {
            if (status === 'Pendente' || status === 'Agendada') {
              retryQuery = retryQuery.in('status', ['Agendada', 'Pendente']);
            } else {
              retryQuery = retryQuery.eq('status', status);
            }
          }
          if (dataInicio) retryQuery = retryQuery.gte('data', `${dataInicio}T00:00:00.000Z`);
          if (dataFim) retryQuery = retryQuery.lte('data', `${dataFim}T23:59:59.999Z`);
          if (search) {
            retryQuery = retryQuery.or(
              `numero_nota_fiscal.ilike.%${search}%,chave_nf.ilike.%${search}%,cliente.ilike.%${search}%,transportadora.ilike.%${search}%`
            );
          }
          retryQuery = retryQuery.order('data', { ascending: false }).limit(500);
          const retryRes = await retryQuery;
          data = retryRes.data;
          count = retryRes.count;
          error = retryRes.error;
        }

        if (error) {
          console.warn('[ColetasService] Tabela expedicao_coletas não encontrada ou erro no Supabase. Utilizando fallback local:', error.message);
          throw error;
        }

        let items: ExpedicaoColeta[] = (data || []).map((row: any) => ({
          id: row.id,
          unidade_negocio: row.unidade_negocio || null,
          chave_nf: row.chave_nf || null,
          numero_nota_fiscal: row.numero_nota_fiscal,
          cliente: row.cliente,
          transportadora: row.transportadora,
          status: row.status as StatusColeta,
          data: row.data,
          numero_coleta: row.numero_coleta || null,
          usuario_id: row.usuario_id || null,
          valor: row.valor !== undefined && row.valor !== null ? Number(row.valor) : 0,
          separador_id: row.separador_id || null,
          conferente_id: row.conferente_id || null,
          quantidade: row.quantidade !== undefined && row.quantidade !== null && !isNaN(Number(row.quantidade)) ? Number(row.quantidade) : 1,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }));

        if (activeUnit) {
          items = items.filter((item) => itemMatchesUserUnit(item.unidade_negocio, activeUnit));
        }

        // Tentar resolver nomes de separador e conferente
        try {
          const usuarios = await usuariosService.listarTodos();
          const userMap = new Map(usuarios.map((u) => [u.id, u.nome]));
          items.forEach((item) => {
            if (item.separador_id) item.separador_nome = userMap.get(item.separador_id) || null;
            if (item.conferente_id) item.conferente_nome = userMap.get(item.conferente_id) || null;
          });
        } catch {}

        // Ordenação estrita por status: 'Pendente' > 'Coletada', e por data mais recente
        items.sort(compararColetasPorStatus);

        const total = count && count > items.length ? count : items.length;
        const from = (page - 1) * pageSize;
        const paginatedItems = items.slice(from, from + pageSize);

        // Atualiza cache local para resiliência offline
        saveLocalColetas(items);

        return {
          data: paginatedItems,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
        };
      } catch (err: any) {
        console.warn('[ColetasService] Fallback para armazenamento local:', err?.message);
      }
    }

    // Fallback Local
    let local = getLocalColetas();

    if (activeUnit) {
      local = local.filter((item) => itemMatchesUserUnit(item.unidade_negocio, activeUnit));
    }

    if (status) {
      if (status === 'Pendente' || status === 'Agendada') {
        local = local.filter((item) => item.status === 'Agendada' || item.status === 'Pendente');
      } else {
        local = local.filter((item) => item.status === status);
      }
    }

    if (dataInicio) {
      local = local.filter((item) => item.data.slice(0, 10) >= dataInicio);
    }

    if (dataFim) {
      local = local.filter((item) => item.data.slice(0, 10) <= dataFim);
    }

    if (search) {
      local = local.filter((item) => {
        const nf = item.numero_nota_fiscal?.toLowerCase() || '';
        const chave = item.chave_nf?.toLowerCase() || '';
        const cli = item.cliente?.toLowerCase() || '';
        const transp = item.transportadora?.toLowerCase() || '';
        const numColeta = item.numero_coleta?.toLowerCase() || '';
        return (
          nf.includes(search) ||
          chave.includes(search) ||
          cli.includes(search) ||
          transp.includes(search) ||
          numColeta.includes(search)
        );
      });
    }

    // Ordenação estrita: Pendente / Agendada primeiro > Coletada por último
    local.sort(compararColetasPorStatus);

    const total = local.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedItems = local.slice(startIndex, startIndex + pageSize);

    return {
      data: paginatedItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  /**
   * Cadastra nova coleta.
   * Valida permissão (Operador Logístico ou Assistente Logístico) e regra de número da coleta.
   */
  async criar(dto: SalvarColetaDTO, usuario: Usuario): Promise<ExpedicaoColeta> {
    if (!podeGerenciarColetas(usuario)) {
      throw new Error(
        'Acesso negado: Somente gestores ou usuários com função "Operador Logístico" / "Assistente Logístico" podem cadastrar coletas.'
      );
    }

    if (dto.status === 'Agendada' && (!dto.numero_coleta || !dto.numero_coleta.trim())) {
      throw new Error('O campo "Número da coleta" é obrigatório quando o status é "Agendada".');
    }

    const agora = new Date().toISOString();
    const userUnit = usuario.unidade_negocio || getActiveUserUnit() || UNIDADE_PADRAO_SISTEMA;
    const normalizedUnit = normalizarUnidadeNegocio(userUnit);

    const quant = dto.quantidade !== undefined && dto.quantidade !== null && !isNaN(Number(dto.quantidade))
      ? Math.max(1, Math.round(Number(dto.quantidade)))
      : 1;

    const novaColeta: ExpedicaoColeta = {
      id: generateUUID(),
      unidade_negocio: normalizedUnit,
      chave_nf: dto.chave_nf?.trim() || null,
      numero_nota_fiscal: dto.numero_nota_fiscal.trim(),
      cliente: dto.cliente.trim(),
      transportadora: dto.transportadora.trim(),
      status: dto.status,
      data: dto.data ? new Date(dto.data).toISOString() : agora,
      numero_coleta: dto.numero_coleta?.trim() || null,
      usuario_id: usuario.id || null,
      usuario_nome: usuario.nome || null,
      valor: parseMoeda(dto.valor),
      separador_id: dto.separador_id?.trim() || null,
      conferente_id: dto.conferente_id?.trim() || null,
      quantidade: quant,
      created_at: agora,
      updated_at: agora,
    };

    // 1. Tenta salvar no Supabase diretamente
    if (isSupabaseConfigured) {
      try {
        const supabase = getSupabase();
        if (!supabase) throw new Error('Supabase client não inicializado');
        const payload: Record<string, any> = {
          id: novaColeta.id,
          unidade_negocio: novaColeta.unidade_negocio,
          chave_nf: novaColeta.chave_nf,
          numero_nota_fiscal: novaColeta.numero_nota_fiscal,
          cliente: novaColeta.cliente,
          transportadora: novaColeta.transportadora,
          status: novaColeta.status,
          data: novaColeta.data,
          numero_coleta: novaColeta.numero_coleta,
          usuario_id: novaColeta.usuario_id,
          valor: novaColeta.valor,
          separador_id: novaColeta.separador_id,
          conferente_id: novaColeta.conferente_id,
          quantidade: novaColeta.quantidade,
          created_at: novaColeta.created_at,
          updated_at: novaColeta.updated_at,
        };

        let { data, error }: { data: any; error: any } = await supabase
          .from('expedicao_coletas')
          .insert(payload)
          .select(COLETA_FIELDS)
          .single();

        if (error && (error.message.includes('separador_id') || error.message.includes('quantidade') || error.message.includes('unidade_negocio') || error.message.includes('valor') || error.code === '42703')) {
          const { separador_id, conferente_id, quantidade, ...fallbackPayload } = payload;
          const retryRes = await supabase
            .from('expedicao_coletas')
            .insert(fallbackPayload)
            .select(COLETA_FIELDS_LEGACY)
            .single();
          data = retryRes.data;
          error = retryRes.error;
        }

        if (!error && data) {
          const itemCriado: ExpedicaoColeta = {
            id: data.id,
            unidade_negocio: data.unidade_negocio || normalizedUnit,
            chave_nf: data.chave_nf,
            numero_nota_fiscal: data.numero_nota_fiscal,
            cliente: data.cliente,
            transportadora: data.transportadora,
            status: data.status,
            data: data.data,
            numero_coleta: data.numero_coleta,
            usuario_id: data.usuario_id,
            valor: data.valor !== undefined && data.valor !== null ? Number(data.valor) : (novaColeta.valor || 0),
            separador_id: data.separador_id !== undefined ? data.separador_id : novaColeta.separador_id,
            conferente_id: data.conferente_id !== undefined ? data.conferente_id : novaColeta.conferente_id,
            quantidade: data.quantidade !== undefined && data.quantidade !== null ? Number(data.quantidade) : novaColeta.quantidade,
            created_at: data.created_at,
            updated_at: data.updated_at,
          };

          // Atualiza cache local
          const local = getLocalColetas();
          local.unshift(itemCriado);
          local.sort(compararColetasPorStatus);
          saveLocalColetas(local);
          return itemCriado;
        }
      } catch (err: any) {
        console.warn('[ColetasService] Falha ao persistir no Supabase, tentando backend API:', err?.message);
      }
    }

    // 2. Tenta salvar via Backend API
    try {
      const resp = await fetch('/api/coletas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...novaColeta,
          usuarioId: usuario.id,
          usuarioFuncao: usuario.funcao,
          usuarioNivel: usuario.nivel,
        }),
      });

      if (resp.ok) {
        const resData = await resp.json();
        if (resData.data) {
          const local = getLocalColetas();
          local.unshift(resData.data);
          saveLocalColetas(local);
          return resData.data;
        }
      } else if (resp.status === 403) {
        const errJson = await resp.json().catch(() => null);
        throw new Error(errJson?.error || 'Acesso negado no backend.');
      }
    } catch (apiErr: any) {
      if (apiErr.message.includes('Acesso negado')) {
        throw apiErr;
      }
      console.warn('[ColetasService] Backend API indisponível, salvando localmente:', apiErr);
    }

    // 3. Fallback Local
    const local = getLocalColetas();
    local.unshift(novaColeta);
    saveLocalColetas(local);
    return novaColeta;
  }

  /**
   * Atualiza uma coleta existente.
   * Valida permissão e regra do número da coleta.
   */
  async atualizar(id: string, dto: SalvarColetaDTO, usuario: Usuario): Promise<ExpedicaoColeta> {
    if (!podeGerenciarColetas(usuario)) {
      throw new Error(
        'Acesso negado: Somente gestores ou usuários com função "Operador Logístico" / "Assistente Logístico" podem editar coletas.'
      );
    }

    if (dto.status === 'Agendada' && (!dto.numero_coleta || !dto.numero_coleta.trim())) {
      throw new Error('O campo "Número da coleta" é obrigatório quando o status é "Agendada".');
    }

    const agora = new Date().toISOString();
    const dadosAtualizados: Partial<ExpedicaoColeta> = {
      chave_nf: dto.chave_nf?.trim() || null,
      numero_nota_fiscal: dto.numero_nota_fiscal.trim(),
      cliente: dto.cliente.trim(),
      transportadora: dto.transportadora.trim(),
      status: dto.status,
      data: dto.data ? new Date(dto.data).toISOString() : undefined,
      numero_coleta: dto.numero_coleta?.trim() || null,
      usuario_id: usuario.id || null,
      valor: parseMoeda(dto.valor),
      separador_id: dto.separador_id !== undefined ? (dto.separador_id?.trim() || null) : undefined,
      conferente_id: dto.conferente_id !== undefined ? (dto.conferente_id?.trim() || null) : undefined,
      quantidade: dto.quantidade !== undefined && dto.quantidade !== null && !isNaN(Number(dto.quantidade))
        ? Math.max(1, Math.round(Number(dto.quantidade)))
        : undefined,
      updated_at: agora,
    };

    // 1. Tenta atualizar no Supabase
    if (isSupabaseConfigured) {
      try {
        const supabase = getSupabase();
        if (!supabase) throw new Error('Supabase client não inicializado');
        const payload: Record<string, any> = {
          chave_nf: dadosAtualizados.chave_nf,
          numero_nota_fiscal: dadosAtualizados.numero_nota_fiscal,
          cliente: dadosAtualizados.cliente,
          transportadora: dadosAtualizados.transportadora,
          status: dadosAtualizados.status,
          numero_coleta: dadosAtualizados.numero_coleta,
          usuario_id: dadosAtualizados.usuario_id,
          valor: dadosAtualizados.valor,
          updated_at: dadosAtualizados.updated_at,
        };

        if (dadosAtualizados.data) {
          payload.data = dadosAtualizados.data;
        }
        if (dadosAtualizados.separador_id !== undefined) {
          payload.separador_id = dadosAtualizados.separador_id;
        }
        if (dadosAtualizados.conferente_id !== undefined) {
          payload.conferente_id = dadosAtualizados.conferente_id;
        }
        if (dadosAtualizados.quantidade !== undefined) {
          payload.quantidade = dadosAtualizados.quantidade;
        }

        let { data, error }: { data: any; error: any } = await supabase
          .from('expedicao_coletas')
          .update(payload)
          .eq('id', id)
          .select(COLETA_FIELDS)
          .single();

        if (error && (error.message.includes('separador_id') || error.message.includes('quantidade') || error.message.includes('valor') || error.code === '42703')) {
          const { separador_id, conferente_id, quantidade, valor, ...fallbackPayload } = payload;
          const retryRes = await supabase
            .from('expedicao_coletas')
            .update(fallbackPayload)
            .eq('id', id)
            .select(COLETA_FIELDS_LEGACY)
            .single();
          data = retryRes.data;
          error = retryRes.error;
        }

        if (!error && data) {
          const itemAtualizado: ExpedicaoColeta = {
            id: data.id,
            unidade_negocio: data.unidade_negocio || null,
            chave_nf: data.chave_nf,
            numero_nota_fiscal: data.numero_nota_fiscal,
            cliente: data.cliente,
            transportadora: data.transportadora,
            status: data.status,
            data: data.data,
            numero_coleta: data.numero_coleta,
            usuario_id: data.usuario_id,
            valor: data.valor !== undefined && data.valor !== null ? Number(data.valor) : (dto.valor ? Number(dto.valor) : 0),
            separador_id: data.separador_id !== undefined ? data.separador_id : (dadosAtualizados.separador_id || null),
            conferente_id: data.conferente_id !== undefined ? data.conferente_id : (dadosAtualizados.conferente_id || null),
            quantidade: data.quantidade !== undefined && data.quantidade !== null ? Number(data.quantidade) : (dadosAtualizados.quantidade || 1),
            created_at: data.created_at,
            updated_at: data.updated_at,
          };

          const local = getLocalColetas();
          const idx = local.findIndex((c) => c.id === id);
          if (idx >= 0) {
            local[idx] = itemAtualizado;
            local.sort(compararColetasPorStatus);
            saveLocalColetas(local);
          }
          return itemAtualizado;
        }
      } catch (err: any) {
        console.warn('[ColetasService] Falha ao atualizar no Supabase, tentando backend API:', err?.message);
      }
    }

    // 2. Tenta via Backend API
    try {
      const resp = await fetch(`/api/coletas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...dadosAtualizados,
          usuarioId: usuario.id,
          usuarioFuncao: usuario.funcao,
          usuarioNivel: usuario.nivel,
        }),
      });

      if (resp.ok) {
        const resData = await resp.json();
        if (resData.data) {
          const local = getLocalColetas();
          const idx = local.findIndex((c) => c.id === id);
          if (idx >= 0) {
            local[idx] = resData.data;
            local.sort(compararColetasPorStatus);
            saveLocalColetas(local);
          }
          return resData.data;
        }
      } else if (resp.status === 403) {
        const errJson = await resp.json().catch(() => null);
        throw new Error(errJson?.error || 'Acesso negado no backend.');
      }
    } catch (apiErr: any) {
      if (apiErr.message.includes('Acesso negado')) {
        throw apiErr;
      }
      console.warn('[ColetasService] Backend API indisponível, atualizando localmente:', apiErr);
    }

    // 3. Fallback Local
    const local = getLocalColetas();
    const idx = local.findIndex((c) => c.id === id);
    if (idx >= 0) {
      local[idx] = {
        ...local[idx],
        ...dadosAtualizados,
      };
      local.sort(compararColetasPorStatus);
      saveLocalColetas(local);
      return local[idx];
    }

    throw new Error('Registro de coleta não encontrado para atualização.');
  }

  /**
   * Exclui uma coleta.
   * Valida permissão.
   */
  async excluir(id: string, usuario: Usuario): Promise<void> {
    if (!podeGerenciarColetas(usuario)) {
      throw new Error(
        'Acesso negado: Somente gestores ou usuários com função "Operador Logístico" / "Assistente Logístico" podem excluir coletas.'
      );
    }

    if (isSupabaseConfigured) {
      try {
        const supabase = getSupabase();
        if (!supabase) throw new Error('Supabase client não inicializado');
        const { error } = await supabase
          .from('expedicao_coletas')
          .delete()
          .eq('id', id);

        if (!error) {
          const local = getLocalColetas().filter((c) => c.id !== id);
          saveLocalColetas(local);
          return;
        }
      } catch (err: any) {
        console.warn('[ColetasService] Erro ao deletar no Supabase, tentando backend API:', err?.message);
      }
    }

    // Backend API
    try {
      const resp = await fetch(`/api/coletas/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId: usuario.id,
          usuarioFuncao: usuario.funcao,
          usuarioNivel: usuario.nivel,
        }),
      });

      if (!resp.ok && resp.status === 403) {
        const errJson = await resp.json().catch(() => null);
        throw new Error(errJson?.error || 'Acesso negado no backend.');
      }
    } catch (apiErr: any) {
      if (apiErr.message.includes('Acesso negado')) {
        throw apiErr;
      }
      console.warn('[ColetasService] Falha ao comunicar exclusão com backend:', apiErr);
    }

    // Fallback local
    const local = getLocalColetas().filter((c) => c.id !== id);
    saveLocalColetas(local);
  }

  /**
   * POLIHUB — Reestruturação da aba Gráficos e Dados
   * Utiliza como fonte principal os registros da tabela expedicao_coletas.
   * Não utiliza SELECT *.
   * Não calcula tempo ou duração.
   */
  async calcularIndicadoresColetas(filtros: {
    unidade_negocio?: string;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<IndicadoresColetasResultado> {
    const activeUnit = filtros.unidade_negocio
      ? normalizarUnidadeNegocio(filtros.unidade_negocio)
      : getActiveUserUnit() || UNIDADE_PADRAO_SISTEMA;
    const dataInicio = filtros.dataInicio?.trim();
    const dataFim = filtros.dataFim?.trim();

    let coletas: ExpedicaoColeta[] = [];

    if (isSupabaseConfigured) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          let query = supabase
            .from('expedicao_coletas')
            .select(COLETA_FIELDS);

          if (activeUnit) {
            query = query.in('unidade_negocio', getUnitEquivalents(activeUnit));
          }
          if (dataInicio) {
            query = query.gte('data', `${dataInicio}T00:00:00.000Z`);
          }
          if (dataFim) {
            query = query.lte('data', `${dataFim}T23:59:59.999Z`);
          }

          let { data, error }: { data: any; error: any } = await query;
          if (error && (error.message.includes('separador_id') || error.message.includes('quantidade') || error.message.includes('valor') || error.code === '42703')) {
            const retryRes = await supabase
              .from('expedicao_coletas')
              .select(COLETA_FIELDS_LEGACY);
            data = retryRes.data;
            error = retryRes.error;
          }

          if (!error && data) {
            coletas = data.map((row: any) => ({
              id: row.id,
              unidade_negocio: row.unidade_negocio || null,
              chave_nf: row.chave_nf || null,
              numero_nota_fiscal: row.numero_nota_fiscal,
              cliente: row.cliente,
              transportadora: row.transportadora,
              status: row.status as StatusColeta,
              data: row.data,
              numero_coleta: row.numero_coleta || null,
              usuario_id: row.usuario_id || null,
              valor: row.valor !== undefined && row.valor !== null ? Number(row.valor) : 0,
              separador_id: row.separador_id || null,
              conferente_id: row.conferente_id || null,
              quantidade: row.quantidade !== undefined && row.quantidade !== null && !isNaN(Number(row.quantidade)) ? Number(row.quantidade) : 1,
              created_at: row.created_at,
              updated_at: row.updated_at,
            }));
          }
        }
      } catch (err) {
        console.warn('[ColetasService] Erro ao carregar coletas para indicadores no Supabase:', err);
      }
    }

    if (coletas.length === 0) {
      coletas = getLocalColetas();
    }

    if (activeUnit) {
      coletas = coletas.filter((c) => itemMatchesUserUnit(c.unidade_negocio, activeUnit));
    }
    if (dataInicio) {
      coletas = coletas.filter((c) => c.data.slice(0, 10) >= dataInicio);
    }
    if (dataFim) {
      coletas = coletas.filter((c) => c.data.slice(0, 10) <= dataFim);
    }

    // Carregar mapa de usuários para nomes reais
    const usuariosMap = new Map<string, string>();
    try {
      const usuarios = await usuariosService.listarTodos();
      usuarios.forEach((u) => usuariosMap.set(u.id, u.nome));
    } catch {}

    const totalColetas = coletas.length;
    let totalItens = 0;
    let totalAgendadas = 0;
    let totalColetadas = 0;

    const separadoresMap = new Map<string, { id: string; nome: string; coletas: number; itens: number }>();
    const conferentesMap = new Map<string, { id: string; nome: string; coletas: number; itens: number }>();
    const transportadorasMap = new Map<string, { coletas: number; itens: number }>();

    for (const c of coletas) {
      const qtd = c.quantidade !== undefined && c.quantidade !== null && !isNaN(Number(c.quantidade))
        ? Math.max(1, Number(c.quantidade))
        : 1;
      totalItens += qtd;

      const st = (c.status || '').toLowerCase().trim();
      if (st === 'coletada' || st === 'concluido' || st === 'concluida') {
        totalColetadas++;
      } else {
        totalAgendadas++;
      }

      // Separação
      if (c.separador_id) {
        const sepId = c.separador_id;
        const nome = usuariosMap.get(sepId) || c.separador_nome || `Separador (${sepId.slice(0, 6)})`;
        const atual = separadoresMap.get(sepId) || { id: sepId, nome, coletas: 0, itens: 0 };
        atual.coletas++;
        atual.itens += qtd;
        separadoresMap.set(sepId, atual);
      }

      // Conferência
      if (c.conferente_id) {
        const confId = c.conferente_id;
        const nome = usuariosMap.get(confId) || c.conferente_nome || `Conferente (${confId.slice(0, 6)})`;
        const atual = conferentesMap.get(confId) || { id: confId, nome, coletas: 0, itens: 0 };
        atual.coletas++;
        atual.itens += qtd;
        conferentesMap.set(confId, atual);
      }

      // Transportadora
      const transp = (c.transportadora || 'Não informada').trim();
      const tAtual = transportadorasMap.get(transp) || { coletas: 0, itens: 0 };
      tAtual.coletas++;
      tAtual.itens += qtd;
      transportadorasMap.set(transp, tAtual);
    }

    const totalItensSeparadores = Array.from(separadoresMap.values()).reduce((sum, s) => sum + s.itens, 0) || totalItens;
    const produtividadeSeparadores = Array.from(separadoresMap.values())
      .map((s) => ({
        ...s,
        porcentagemItens: totalItensSeparadores > 0 ? (s.itens / totalItensSeparadores) * 100 : 0,
      }))
      .sort((a, b) => b.itens - a.itens || b.coletas - a.coletas);

    const totalItensConferentes = Array.from(conferentesMap.values()).reduce((sum, c) => sum + c.itens, 0) || totalItens;
    const produtividadeConferentes = Array.from(conferentesMap.values())
      .map((c) => ({
        ...c,
        porcentagemItens: totalItensConferentes > 0 ? (c.itens / totalItensConferentes) * 100 : 0,
      }))
      .sort((a, b) => b.itens - a.itens || b.coletas - a.coletas);

    const rankingTransportadoras = Array.from(transportadorasMap.entries())
      .map(([transportadora, val]) => ({
        transportadora,
        coletas: val.coletas,
        itens: val.itens,
      }))
      .sort((a, b) => b.coletas - a.coletas);

    const taxaConclusao = totalColetas > 0 ? Math.round((totalColetadas / totalColetas) * 100) : 0;

    return {
      totalColetas,
      totalItens,
      totalAgendadas,
      totalColetadas,
      taxaConclusao,
      produtividadeSeparadores,
      produtividadeConferentes,
      statusDistribuicao: {
        agendadas: totalAgendadas,
        coletadas: totalColetadas,
      },
      rankingTransportadoras,
    };
  }
}

export const coletasService = new ColetasService();
