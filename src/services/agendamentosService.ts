import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { Agendamento, AgendamentoStatus, PaginatedResult } from '../types';
import { getLocalAgendamentos, saveLocalAgendamentos } from './mockStorage';
import { pushNotificationService } from './pushNotificationService';
import { getActiveUserUnit, itemMatchesUserUnit, getUnitEquivalents, getActiveUserProfile } from './sessionHelper';
import { UNIDADE_PADRAO_SISTEMA, normalizarUnidadeNegocio } from '../constants/unidades';

// Explicit field selection to avoid SELECT * as mandated by performance rules
const AGENDAMENTO_FIELDS = 'id, unidade_negocio, data, fornecedor, nota_fiscal, notas_adicionais, volumes, tipo_volumes, transportadora, status, data_prevista, horario, data_entrega, usuario_insercao, usuario_id, data_insercao, xml_nota, chave_nf';
const AGENDAMENTO_FIELDS_NO_XML = 'id, unidade_negocio, data, fornecedor, nota_fiscal, notas_adicionais, volumes, tipo_volumes, transportadora, status, data_prevista, horario, data_entrega, usuario_insercao, usuario_id, data_insercao, chave_nf';
const AGENDAMENTO_FIELDS_LEGACY = 'id, unidade_negocio, data, fornecedor, nota_fiscal, notas_adicionais, volumes, tipo_volumes, transportadora, status, data_prevista, data_entrega, usuario_insercao, usuario_id, data_insercao';
const AGENDAMENTO_FIELDS_FALLBACK = 'id, data, fornecedor, nota_fiscal, notas_adicionais, volumes, tipo_volumes, transportadora, status, data_prevista, horario, data_entrega, usuario_insercao, data_insercao';

export interface AgendamentoFilters {
  search?: string;
  status?: AgendamentoStatus | 'Todos' | AgendamentoStatus[];
  dataInicio?: string;
  dataFim?: string;
  unidade_negocio?: string;
}

/**
 * Helper para comparação alfanumérica/natural de números de Nota Fiscal (NF).
 * Garante ordenação correta mesmo com pontuação (ex: "004.892.110") ou números (ex: 2 vs 10).
 */
export function compareNotaFiscal(nfA?: string | null, nfB?: string | null): number {
  const a = (nfA || '').trim();
  const b = (nfB || '').trim();
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Helper para comparação alfabética de Fabricante / Fornecedor.
 */
export function compareFabricante(fabA?: string | null, fabB?: string | null): number {
  const a = (fabA || '').trim();
  const b = (fabB || '').trim();
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
}

/**
 * Ordenação mandatória da regra de negócio para o menu Agendamentos:
 * Abas 'Pendentes' e 'Recebidos':
 *   1ª ordenação: Data
 *     - Para Pendentes: data prevista mais próxima primeiro (ascendente: ex 10/09, 11/09, 12/09)
 *     - Para Recebidos: data de recebimento mais recente primeiro (descendente)
 *   2ª ordenação: Fabricante (Fornecedor) alfabético A-Z
 *   3ª ordenação: Número da NF (natural/ascendente: 1, 2, 10...)
 *
 * Hierarquia: Data > Fabricante > NF
 */
export function sortAgendamentosList(list: Agendamento[]): Agendamento[] {
  return [...list].sort((a, b) => {
    const isAPending = a.status === 'Pendente' || a.status === 'Em trânsito' || a.status === 'Confirmado';
    const isBPending = b.status === 'Pendente' || b.status === 'Em trânsito' || b.status === 'Confirmado';

    // 1. Pendentes primeiro (caso a lista seja mista)
    if (isAPending && !isBPending) return -1;
    if (!isAPending && isBPending) return 1;

    // ABA RECEBIDOS:
    // Hierarquia: Data (descendente) > Fabricante (A-Z) > NF (ascendente)
    if (a.status === 'Recebido' && b.status === 'Recebido') {
      // 1ª Ordenação: Data de recebimento/entrega mais recente primeiro
      const dateA = a.data_entrega || a.data_prevista || a.data || '';
      const dateB = b.data_entrega || b.data_prevista || b.data || '';
      const comp = dateB.localeCompare(dateA);
      if (comp !== 0) return comp;

      // 2ª Ordenação: Fabricante (Fornecedor)
      const fabComp = compareFabricante(a.fornecedor, b.fornecedor);
      if (fabComp !== 0) return fabComp;

      // 3ª Ordenação: Número da NF
      const nfComp = compareNotaFiscal(a.nota_fiscal, b.nota_fiscal);
      if (nfComp !== 0) return nfComp;

      // Desempate: horário agendado mais recente
      return (b.horario || '').localeCompare(a.horario || '');
    }

    // ABA PENDENTES (e demais status):
    // Hierarquia: Data prevista (ascendente) > Fabricante (A-Z) > NF (ascendente)
    // 1ª Ordenação: Data prevista mais próxima primeiro (ascendente)
    const dateA = a.data_prevista || a.data || '9999-12-31';
    const dateB = b.data_prevista || b.data || '9999-12-31';
    const dateComp = dateA.localeCompare(dateB);
    if (dateComp !== 0) return dateComp;

    // 2ª Ordenação: Fabricante (Fornecedor)
    const fabComp = compareFabricante(a.fornecedor, b.fornecedor);
    if (fabComp !== 0) return fabComp;

    // 3ª Ordenação: Número da NF
    const nfComp = compareNotaFiscal(a.nota_fiscal, b.nota_fiscal);
    if (nfComp !== 0) return nfComp;

    // Desempate: horário agendado mais próximo primeiro
    const timeA = a.horario || '99:99';
    const timeB = b.horario || '99:99';
    return timeA.localeCompare(timeB);
  });
}

// In-memory cache to prevent redundant fetches on simple tab switches
let cachedAgendamentos: { key: string; result: PaginatedResult<Agendamento>; timestamp: number } | null = null;
const CACHE_TTL_MS = 30000; // 30 seconds local cache

// Helper to generate RFC4122 v4 UUID compliant with PostgreSQL UUID columns
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

const XML_STORAGE_PREFIX = 'polihub_xml_nota_';

export function getXmlNotaLocal(agendamentoId: string): string | null {
  try {
    return localStorage.getItem(XML_STORAGE_PREFIX + agendamentoId);
  } catch {
    return null;
  }
}

export function saveXmlNotaLocal(agendamentoId: string, xmlString: string | null): void {
  try {
    if (xmlString) {
      localStorage.setItem(XML_STORAGE_PREFIX + agendamentoId, xmlString);
    } else {
      localStorage.removeItem(XML_STORAGE_PREFIX + agendamentoId);
    }
  } catch (err) {
    console.warn('Erro ao armazenar XML localmente:', err);
  }
}

export const agendamentosService = {
  /**
   * List agendamentos with direct server-side range pagination (50 records per page),
   * explicit column selection, and filters
   */
  async list(
    page = 1,
    pageSize = 50,
    filters: AgendamentoFilters = {},
    forceRefresh = false
  ): Promise<PaginatedResult<Agendamento>> {
    const activeUnit = filters.unidade_negocio || getActiveUserUnit();
    const cacheKey = JSON.stringify({ page, pageSize, filters, activeUnit });
    if (
      !forceRefresh &&
      cachedAgendamentos &&
      cachedAgendamentos.key === cacheKey &&
      Date.now() - cachedAgendamentos.timestamp < CACHE_TTL_MS
    ) {
      return cachedAgendamentos.result;
    }

    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        const from = Math.max(0, (page - 1) * pageSize);
        const to = from + pageSize - 1;

        const isRecebido =
          filters.status === 'Recebido' ||
          (Array.isArray(filters.status) &&
            filters.status.length === 1 &&
            filters.status[0] === 'Recebido');

        let query = supabase
          .from('agendamentos')
          .select(AGENDAMENTO_FIELDS, { count: 'exact' });

        // Filtro estrito por unidade de negócio do usuário
        if (activeUnit) {
          query = query.in('unidade_negocio', getUnitEquivalents(activeUnit));
        }

        if (filters.status && filters.status !== 'Todos') {
          if (Array.isArray(filters.status)) {
            query = query.in('status', filters.status);
          } else {
            query = query.eq('status', filters.status);
          }
        }

        if (filters.dataInicio) {
          query = query.gte('data_prevista', filters.dataInicio);
        }

        if (filters.dataFim) {
          query = query.lte('data_prevista', filters.dataFim);
        }

        if (filters.search && filters.search.trim()) {
          const term = filters.search.trim();
          query = query.or(`fornecedor.ilike.%${term}%,nota_fiscal.ilike.%${term}%,transportadora.ilike.%${term}%`);
        }

        // Ordenação direta no banco: Data > Fabricante > NF
        if (isRecebido) {
          query = query
            .order('data_prevista', { ascending: false })
            .order('fornecedor', { ascending: true })
            .order('nota_fiscal', { ascending: true });
        } else {
          query = query
            .order('data_prevista', { ascending: true })
            .order('fornecedor', { ascending: true })
            .order('nota_fiscal', { ascending: true });
        }

        // Paginação direta no Supabase via range()
        query = query.range(from, to);

        let { data, count, error } = await query;

        // Se coluna xml_nota, chave_nf, horario, unidade_negocio, usuario_id ou de relação não existir ainda no Supabase, fallback seguro
        if (error && (error.message.includes('xml_nota') || error.message.includes('chave_nf') || error.message.includes('unidade_negocio') || error.message.includes('horario') || error.message.includes('fornecedor_id') || error.message.includes('usuario_id') || error.code === '42703')) {
          let retryQuery = supabase
            .from('agendamentos')
            .select(AGENDAMENTO_FIELDS_FALLBACK, { count: 'exact' });

          if (filters.status && filters.status !== 'Todos') {
            if (Array.isArray(filters.status)) {
              retryQuery = retryQuery.in('status', filters.status);
            } else {
              retryQuery = retryQuery.eq('status', filters.status);
            }
          }
          if (filters.dataInicio) {
            retryQuery = retryQuery.gte('data_prevista', filters.dataInicio);
          }
          if (filters.dataFim) {
            retryQuery = retryQuery.lte('data_prevista', filters.dataFim);
          }
          if (filters.search && filters.search.trim()) {
            const term = filters.search.trim();
            retryQuery = retryQuery.or(`fornecedor.ilike.%${term}%,nota_fiscal.ilike.%${term}%,transportadora.ilike.%${term}%`);
          }

          if (isRecebido) {
            retryQuery = retryQuery
              .order('data_prevista', { ascending: false })
              .order('fornecedor', { ascending: true })
              .order('nota_fiscal', { ascending: true });
          } else {
            retryQuery = retryQuery
              .order('data_prevista', { ascending: true })
              .order('fornecedor', { ascending: true })
              .order('nota_fiscal', { ascending: true });
          }

          retryQuery = retryQuery.range(from, to);

          const retryRes = await retryQuery;
          data = retryRes.data as any;
          count = retryRes.count;
          error = retryRes.error;
        }

        if (error) {
          console.warn('Supabase query error, falling back to local dataset:', error.message);
          return this.listLocal(page, pageSize, filters);
        }

        // Sincroniza e enriquece com XML local se necessário
        const localAgendamentos = getLocalAgendamentos();
        const localXmlMap = new Map<string, string>();
        for (const a of localAgendamentos) {
          if (a.xml_nota) {
            localXmlMap.set(a.id, a.xml_nota);
          }
        }

        let rawItems = (data as Agendamento[]) || [];
        if (activeUnit) {
          rawItems = rawItems.filter((item) => itemMatchesUserUnit(item.unidade_negocio, activeUnit));
        }

        const items = rawItems.map((item) => ({
          ...item,
          xml_nota: item.xml_nota || localXmlMap.get(item.id) || getXmlNotaLocal(item.id) || null,
        }));

        // Refina ordenação em memória para garantir colação pt-BR / alfanumérica consistente
        const sortedData = sortAgendamentosList(items);
        const total = typeof count === 'number' ? count : sortedData.length;

        const result: PaginatedResult<Agendamento> = {
          data: sortedData,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
        };

        cachedAgendamentos = { key: cacheKey, result, timestamp: Date.now() };
        return result;
      } catch (err) {
        console.warn('Erro ao consultar Supabase:', err);
        return this.listLocal(page, pageSize, filters);
      }
    }

    return this.listLocal(page, pageSize, filters);
  },

  listLocal(page = 1, pageSize = 50, filters: AgendamentoFilters = {}): PaginatedResult<Agendamento> {
    const all = getLocalAgendamentos();
    const activeUnit = filters.unidade_negocio || getActiveUserUnit();

    let filtered = all.filter((item) => {
      if (activeUnit && !itemMatchesUserUnit(item.unidade_negocio, activeUnit)) {
        return false;
      }
      if (filters.status && filters.status !== 'Todos') {
        if (Array.isArray(filters.status)) {
          if (!filters.status.includes(item.status)) return false;
        } else if (item.status !== filters.status) {
          return false;
        }
      }
      if (filters.dataInicio && item.data_prevista < filters.dataInicio) {
        return false;
      }
      if (filters.dataFim && item.data_prevista > filters.dataFim) {
        return false;
      }
      if (filters.search && filters.search.trim()) {
        const term = filters.search.trim().toLowerCase();
        const matchesFornecedor = item.fornecedor.toLowerCase().includes(term);
        const matchesNF = item.nota_fiscal.toLowerCase().includes(term);
        const matchesTransp = item.transportadora.toLowerCase().includes(term);
        if (!matchesFornecedor && !matchesNF && !matchesTransp) {
          return false;
        }
      }
      return true;
    });

    // Ordenação mandatória: Pendentes primeiro, depois data mais próxima (ascendente: ex 10/09, 11/09, 12/09)
    filtered = sortAgendamentosList(filtered);

    const total = filtered.length;
    const from = (page - 1) * pageSize;
    const paginated = filtered.slice(from, from + pageSize);

    return {
      data: paginated,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  },

  /**
   * Get single agendamento by ID - fetching specific fields
   */
  async getById(id: string): Promise<Agendamento | null> {
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        let { data, error } = await supabase
          .from('agendamentos')
          .select(AGENDAMENTO_FIELDS)
          .eq('id', id)
          .maybeSingle();

        if (error && (error.message.includes('xml_nota') || error.message.includes('chave_nf') || error.code === '42703')) {
          const retry = await supabase
            .from('agendamentos')
            .select(AGENDAMENTO_FIELDS_FALLBACK)
            .eq('id', id)
            .maybeSingle();
          data = (retry.data as any);
          error = retry.error;
        }

        if (error) {
          console.warn('Erro ao buscar agendamento no Supabase:', error.message);
          return getLocalAgendamentos().find((a) => a.id === id) || null;
        }

        if (data) {
          const ag = data as Agendamento;
          if (!ag.xml_nota) {
            ag.xml_nota = getXmlNotaLocal(id);
            if (!ag.xml_nota) {
              const local = getLocalAgendamentos().find((a) => a.id === id);
              if (local?.xml_nota) {
                ag.xml_nota = local.xml_nota;
              }
            }
          }
          return ag;
        }
        return null;
      } catch {
        return getLocalAgendamentos().find((a) => a.id === id) || null;
      }
    }
    return getLocalAgendamentos().find((a) => a.id === id) || null;
  },

  /**
   * Create new agendamento
   */
  async create(newRecord: Omit<Agendamento, 'id'> & { id?: string }): Promise<Agendamento> {
    // Invalidate in-memory cache
    cachedAgendamentos = null;

    const activeProfile = getActiveUserProfile();
    if (!newRecord.usuario_id && activeProfile?.id) {
      newRecord.usuario_id = activeProfile.id;
    }
    if ((!newRecord.usuario_insercao || newRecord.usuario_insercao === 'OP-1042') && activeProfile?.nome) {
      newRecord.usuario_insercao = activeProfile.nome;
    }

    const idToUse = newRecord.id || generateUUID();
    const activeUnit = (newRecord as any).unidade_negocio || getActiveUserUnit() || UNIDADE_PADRAO_SISTEMA;
    const normalizedUnit = normalizarUnidadeNegocio(activeUnit);

    if (newRecord.xml_nota) {
      saveXmlNotaLocal(idToUse, newRecord.xml_nota);
    }

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { endereco_alocacao, ...dbPayload } = newRecord as any;
        // The table public.agendamentos has column "id" of type UUID NOT NULL without a default.
        // We explicitly inject the UUID and unidade_negocio here.
        dbPayload.id = idToUse;
        dbPayload.unidade_negocio = dbPayload.unidade_negocio || normalizedUnit;
        // Regra mandatória: todo novo agendamento deve ser criado automaticamente com status 'Pendente'
        dbPayload.status = 'Pendente';

        if (endereco_alocacao && (!dbPayload.notas_adicionais || !dbPayload.notas_adicionais.includes('[Endereço:'))) {
          dbPayload.notas_adicionais = dbPayload.notas_adicionais
            ? `${dbPayload.notas_adicionais} | [Endereço: ${endereco_alocacao}]`
            : `[Endereço: ${endereco_alocacao}]`;
        }

        let { data, error } = await supabase
          .from('agendamentos')
          .insert(dbPayload)
          .select(AGENDAMENTO_FIELDS)
          .maybeSingle();

        // If columns xml_nota / chave_nf / horario / fornecedor_id / transportadora_id / unidade_negocio / usuario_id don't exist yet on the Supabase table, retry without them
        if (error && (error.message.includes('xml_nota') || error.message.includes('chave_nf') || error.message.includes('unidade_negocio') || error.message.includes('horario') || error.message.includes('fornecedor_id') || error.message.includes('transportadora_id') || error.message.includes('usuario_id') || error.code === '42703')) {
          const { xml_nota, chave_nf, horario, fornecedor_id, transportadora_id, unidade_negocio, usuario_id, ...fallbackPayload } = dbPayload;
          const retryRes = await supabase
            .from('agendamentos')
            .insert(fallbackPayload)
            .select(AGENDAMENTO_FIELDS_FALLBACK)
            .maybeSingle();
          data = retryRes.data as any;
          error = retryRes.error;
        }

        if (!error && data) {
          const createdItem: Agendamento = {
            ...(data as Agendamento),
            unidade_negocio: (data as any).unidade_negocio || normalizedUnit,
            xml_nota: dbPayload.xml_nota || getXmlNotaLocal(idToUse) || null,
            endereco_alocacao: endereco_alocacao || null,
          };
          const current = getLocalAgendamentos();
          saveLocalAgendamentos([createdItem, ...current.filter((x) => x.id !== createdItem.id)]);
          return createdItem;
        }
        if (error) {
          console.warn('Erro no insert Supabase:', error.message);
          if (error.message.includes('row-level security') || error.message.includes('violates row-level security policy')) {
            throw new Error(`Permissão de gravação negada por política RLS na tabela public.agendamentos. Execute o script de permissões RLS no Supabase SQL Editor.`);
          }
          throw new Error(`Erro ao salvar agendamento no Supabase: ${error.message}`);
        }
      } catch (err) {
        console.warn('Erro ao inserir agendamento:', err);
        if (err instanceof Error && !err.message.includes('Failed to fetch')) {
          throw err;
        }
      }
    }

    // Local fallback
    const created: Agendamento = {
      ...newRecord,
      id: idToUse,
      unidade_negocio: (newRecord as any).unidade_negocio || normalizedUnit,
    };
    const current = getLocalAgendamentos();
    saveLocalAgendamentos([created, ...current]);
    return created;
  },

  /**
   * Update existing agendamento (sends only changed fields to optimize network payload)
   */
  async update(id: string, updates: Partial<Agendamento>): Promise<Agendamento> {
    cachedAgendamentos = null;

    if (updates.xml_nota !== undefined) {
      saveXmlNotaLocal(id, updates.xml_nota);
    }

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { endereco_alocacao, ...dbUpdates } = updates as any;
        if (endereco_alocacao && (!dbUpdates.notas_adicionais || !dbUpdates.notas_adicionais.includes('[Endereço:'))) {
          dbUpdates.notas_adicionais = dbUpdates.notas_adicionais
            ? `${dbUpdates.notas_adicionais} | [Endereço: ${endereco_alocacao}]`
            : `[Endereço: ${endereco_alocacao}]`;
        }

        let { data, error } = await supabase
          .from('agendamentos')
          .update(dbUpdates)
          .eq('id', id)
          .select(AGENDAMENTO_FIELDS)
          .maybeSingle();

        if (error && (error.message.includes('xml_nota') || error.message.includes('chave_nf') || error.message.includes('horario') || error.message.includes('fornecedor_id') || error.message.includes('transportadora_id') || error.code === '42703')) {
          const { xml_nota, chave_nf, horario, fornecedor_id, transportadora_id, ...fallbackUpdates } = dbUpdates;
          if (Object.keys(fallbackUpdates).length > 0) {
            const retryRes = await supabase
              .from('agendamentos')
              .update(fallbackUpdates)
              .eq('id', id)
              .select(AGENDAMENTO_FIELDS_NO_XML)
              .maybeSingle();
            data = retryRes.data as any;
            error = retryRes.error;
          } else {
            // Apenas xml_nota foi enviado e a coluna ainda não existe na tabela remota do Supabase.
            // O XML já está armazenado no cache seguro local. Buscamos o registro atual no Supabase para compor o resultado.
            const fetchRes = await supabase
              .from('agendamentos')
              .select(AGENDAMENTO_FIELDS_NO_XML)
              .eq('id', id)
              .maybeSingle();
            data = fetchRes.data as any;
            error = null;
          }
        }

        if (!error && data) {
          const updatedItem: Agendamento = {
            ...(data as Agendamento),
            xml_nota: updates.xml_nota !== undefined ? updates.xml_nota : (data as any).xml_nota || getXmlNotaLocal(id),
            endereco_alocacao: endereco_alocacao !== undefined ? endereco_alocacao : null,
          };
          const current = getLocalAgendamentos();
          saveLocalAgendamentos(current.map((x) => (x.id === updatedItem.id ? updatedItem : x)));
          return updatedItem;
        }

        if (error) {
          console.warn('Aviso no update Supabase, usando persistência local segura:', error.message);
          if (error.message.includes('row-level security') || error.message.includes('violates row-level security policy')) {
            throw new Error(`Permissão de edição negada por política RLS na tabela public.agendamentos. Execute o script de permissões RLS no Supabase SQL Editor.`);
          }
        }
      } catch (err) {
        console.warn('Erro ao atualizar agendamento no Supabase (aplicando fallback local):', err);
        if (err instanceof Error && err.message.includes('Permissão de edição negada')) {
          throw err;
        }
      }
    }

    // Local fallback
    const current = getLocalAgendamentos();
    const index = current.findIndex((a) => a.id === id);
    if (index === -1) {
      const fallbackItem: Agendamento = {
        id,
        data: new Date().toISOString().slice(0, 10),
        fornecedor: 'Fornecedor',
        nota_fiscal: '',
        volumes: 1,
        tipo_volumes: 'Volumes',
        transportadora: '',
        status: 'Pendente',
        data_prevista: new Date().toISOString().slice(0, 10),
        ...updates,
        xml_nota: updates.xml_nota !== undefined ? updates.xml_nota : getXmlNotaLocal(id),
      } as Agendamento;
      saveLocalAgendamentos([fallbackItem, ...current]);
      return fallbackItem;
    }
    const updated = {
      ...current[index],
      ...updates,
      xml_nota: updates.xml_nota !== undefined ? updates.xml_nota : current[index].xml_nota || getXmlNotaLocal(id),
    };
    current[index] = updated;
    saveLocalAgendamentos(current);
    return updated;
  },

  /**
   * Delete / remove agendamento (Gestor only)
   */
  async delete(id: string): Promise<void> {
    cachedAgendamentos = null;

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('agendamentos')
          .delete()
          .eq('id', id);

        if (error) {
          console.warn('Erro ao excluir agendamento no Supabase:', error.message);
          if (error.message.includes('row-level security') || error.message.includes('violates row-level security policy')) {
            throw new Error('Permissão negada por política RLS. Apenas usuários com nível "gestor" podem excluir agendamentos.');
          }
          throw new Error(`Erro ao excluir agendamento no Supabase: ${error.message}`);
        }
      } catch (err) {
        console.warn('Erro ao excluir agendamento:', err);
        if (err instanceof Error && !err.message.includes('Failed to fetch')) {
          throw err;
        }
      }
    }

    // Local fallback
    const current = getLocalAgendamentos();
    const filtered = current.filter((a) => a.id !== id);
    saveLocalAgendamentos(filtered);
  },

  /**
   * Update only status (quick 1-touch status update)
   */
  async updateStatus(id: string, newStatus: AgendamentoStatus): Promise<Agendamento> {
    const updates: Partial<Agendamento> = { status: newStatus };
    if (newStatus === 'Recebido') {
      updates.data_entrega = new Date().toISOString().slice(0, 10);
    }
    const updated = await this.update(id, updates);

    // Regra 6 e 7: Quando status mudar para 'Recebido', gera notificação Push geral
    if (newStatus === 'Recebido') {
      const nf = updated?.nota_fiscal || '';
      pushNotificationService.notificarNovaNfRecebida({
        notaFiscal: nf,
        fornecedor: updated?.fornecedor,
      });
    }

    return updated;
  },

  /**
   * Vincula ou atualiza o XML de uma nota fiscal de agendamento
   */
  async salvarXmlNota(id: string, xmlContent: string): Promise<Agendamento> {
    saveXmlNotaLocal(id, xmlContent);
    try {
      return await this.update(id, { xml_nota: xmlContent });
    } catch (err) {
      console.warn('Persistindo XML localmente após aviso do banco:', err);
      const current = getLocalAgendamentos();
      const existing = current.find((x) => x.id === id);
      if (existing) {
        existing.xml_nota = xmlContent;
        saveLocalAgendamentos(current);
        return existing;
      }
      return { id, xml_nota: xmlContent } as any;
    }
  },

  /**
   * Remove o XML atrelado ao agendamento
   */
  async removerXmlNota(id: string): Promise<Agendamento> {
    saveXmlNotaLocal(id, null);
    try {
      return await this.update(id, { xml_nota: null });
    } catch (err) {
      console.warn('Removendo XML localmente após aviso do banco:', err);
      const current = getLocalAgendamentos();
      const existing = current.find((x) => x.id === id);
      if (existing) {
        existing.xml_nota = null;
        saveLocalAgendamentos(current);
        return existing;
      }
      return { id, xml_nota: null } as any;
    }
  },

  /**
   * Count KPI metrics for Home dashboard with optimized lightweight query
   */
  async getMetrics(): Promise<{
    totalHoje: number;
    pendentesHoje: number;
    recebidosHoje: number;
    emTransito: number;
  }> {
    const hoje = new Date().toISOString().slice(0, 10);
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        // Fetch only status and data_prevista for today's items
        const { data, error } = await supabase
          .from('agendamentos')
          .select('status, data_prevista')
          .eq('data_prevista', hoje);

        if (!error && data) {
          const totalHoje = data.length;
          const pendentesHoje = data.filter((d) => d.status === 'Pendente').length;
          const recebidosHoje = data.filter((d) => d.status === 'Recebido').length;
          const emTransito = data.filter((d) => d.status === 'Em trânsito').length;
          return { totalHoje, pendentesHoje, recebidosHoje, emTransito };
        }
      } catch (err) {
        console.warn('Erro ao buscar metricas de agendamentos no Supabase:', err);
      }
    }

    // Local calculation
    const all = getLocalAgendamentos();
    const hojeAgendamentos = all.filter((a) => a.data_prevista === hoje);
    return {
      totalHoje: hojeAgendamentos.length,
      pendentesHoje: hojeAgendamentos.filter((a) => a.status === 'Pendente').length,
      recebidosHoje: hojeAgendamentos.filter((a) => a.status === 'Recebido').length,
      emTransito: all.filter((a) => a.status === 'Em trânsito').length,
    };
  },
};
