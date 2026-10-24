/**
 * POLIHUB — SERVIÇO DE CONTROLE DE VEÍCULOS
 * Módulo: Controle de Veículos (Frota, Saídas, Entregas/Coletas, Abastecimentos e Indicadores)
 * Performance: Seleção estrita de colunas (sem SELECT *), paginação, isolamento por unidade de negócio
 */

import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import {
  Veiculo,
  SaidaVeiculo,
  AbastecimentoVeiculo,
  IndicadoresVeiculos,
  ExpedicaoColeta,
  Usuario,
  PeriodoSaida,
} from '../types';
import { getActiveUserProfile, getActiveUserUnit, itemMatchesUserUnit, getUnitEquivalents } from './sessionHelper';
import { canUserAdicionarEditarVeiculos, canUserExcluirVeiculosEAbastecimentos } from '../lib/permissions';
import { UNIDADE_PADRAO_SISTEMA, normalizarUnidadeNegocio } from '../constants/unidades';

// Colunas explícitas para consultas - Regra de Performance estrita (Anti-SELECT *)
export const VEICULO_FIELDS = 'id, nome, marca, placa, unidade_negocio_id, unidade_negocio, ativo, created_at, updated_at';
export const SAIDA_FIELDS = 'id, data, horario, periodo, veiculo_id, veiculo_nome, veiculo_marca, veiculo_placa, motorista_id, motorista_nome, km_saida, km_rodado, quantidade_entregas, valor_total_notas, observacao, unidade_negocio_id, unidade_negocio, usuario_id, created_at, updated_at';
export const ABASTECIMENTO_FIELDS = 'id, data, horario, veiculo_id, veiculo_nome, veiculo_marca, veiculo_placa, motorista_id, motorista_nome, km_abastecimento, quantidade_litros, valor_total, preco_litro, observacao, unidade_negocio_id, unidade_negocio, usuario_id, created_at, updated_at';
export const SAIDA_COLETA_FIELDS = 'id, saida_id, coleta_id, created_at';
export const COLETA_MINIMAL_FIELDS = 'id, numero_nota_fiscal, cliente, transportadora, numero_coleta, chave_nf, data, status, valor, unidade_negocio';

const LOCAL_STORAGE_VEICULOS = 'polihub_veiculos';
const LOCAL_STORAGE_SAIDAS = 'polihub_saidas_veiculos';
const LOCAL_STORAGE_SAIDAS_COLETAS = 'polihub_saidas_coletas';
const LOCAL_STORAGE_ABASTECIMENTOS = 'polihub_abastecimentos_veiculos';

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

export function isValidUuid(id: any): boolean {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim());
}

export function sanitizeUuid(id: any): string | null {
  if (isValidUuid(id)) return (id as string).trim();
  return null;
}

// -------------------------------------------------------------
// LOCAL STORAGE HELPERS & SEED
// -------------------------------------------------------------

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function getLocalVeiculos(): Veiculo[] {
  try {
    if (!hasLocalStorage()) return [];
    const raw = localStorage.getItem(LOCAL_STORAGE_VEICULOS);
    if (!raw) return [];
    const items: Veiculo[] = JSON.parse(raw);
    return Array.isArray(items) ? items.filter((v) => isValidUuid(v.id)) : [];
  } catch {
    return [];
  }
}

function saveLocalVeiculos(items: Veiculo[]) {
  try {
    if (!hasLocalStorage()) return;
    const validItems = items.filter((v) => isValidUuid(v.id));
    localStorage.setItem(LOCAL_STORAGE_VEICULOS, JSON.stringify(validItems));
  } catch (err) {
    console.warn('Erro ao salvar veículos no localStorage:', err);
  }
}

function getLocalSaidas(): SaidaVeiculo[] {
  try {
    if (!hasLocalStorage()) return [];
    const raw = localStorage.getItem(LOCAL_STORAGE_SAIDAS);
    if (!raw) return [];
    const items: SaidaVeiculo[] = JSON.parse(raw);
    return Array.isArray(items)
      ? items.filter((s) => isValidUuid(s.id) && isValidUuid(s.veiculo_id) && isValidUuid(s.motorista_id))
      : [];
  } catch {
    return [];
  }
}

function saveLocalSaidas(items: SaidaVeiculo[]) {
  try {
    if (!hasLocalStorage()) return;
    const validItems = items.filter((s) => isValidUuid(s.id) && isValidUuid(s.veiculo_id) && isValidUuid(s.motorista_id));
    localStorage.setItem(LOCAL_STORAGE_SAIDAS, JSON.stringify(validItems));
  } catch (err) {
    console.warn('Erro ao salvar saídas no localStorage:', err);
  }
}

interface LocalSaidaColetaVinculo {
  id: string;
  saida_id: string;
  coleta_id: string;
  created_at: string;
}

function getLocalSaidasColetas(): LocalSaidaColetaVinculo[] {
  try {
    if (!hasLocalStorage()) return [];
    const raw = localStorage.getItem(LOCAL_STORAGE_SAIDAS_COLETAS);
    if (!raw) return [];
    const items: LocalSaidaColetaVinculo[] = JSON.parse(raw);
    return Array.isArray(items) ? items.filter((v) => isValidUuid(v.saida_id) && isValidUuid(v.coleta_id)) : [];
  } catch {
    return [];
  }
}

function saveLocalSaidasColetas(items: LocalSaidaColetaVinculo[]) {
  try {
    if (!hasLocalStorage()) return;
    const validItems = items.filter((v) => isValidUuid(v.saida_id) && isValidUuid(v.coleta_id));
    localStorage.setItem(LOCAL_STORAGE_SAIDAS_COLETAS, JSON.stringify(validItems));
  } catch (err) {
    console.warn('Erro ao salvar vinculos de coletas no localStorage:', err);
  }
}

const LOCAL_STORAGE_ABASTECIMENTO_STORAGE = LOCAL_STORAGE_ABASTECIMENTOS;

function getLocalAbastecimentos(): AbastecimentoVeiculo[] {
  try {
    if (!hasLocalStorage()) return [];
    const raw = localStorage.getItem(LOCAL_STORAGE_ABASTECIMENTO_STORAGE);
    if (!raw) return [];
    const items: AbastecimentoVeiculo[] = JSON.parse(raw);
    return Array.isArray(items)
      ? items.filter((a) => isValidUuid(a.id) && isValidUuid(a.veiculo_id) && isValidUuid(a.motorista_id))
      : [];
  } catch {
    return [];
  }
}

function saveLocalAbastecimentos(items: AbastecimentoVeiculo[]) {
  try {
    if (!hasLocalStorage()) return;
    const validItems = items.filter((a) => isValidUuid(a.id) && isValidUuid(a.veiculo_id) && isValidUuid(a.motorista_id));
    localStorage.setItem(LOCAL_STORAGE_ABASTECIMENTO_STORAGE, JSON.stringify(validItems));
  } catch (err) {
    console.warn('Erro ao salvar abastecimentos no localStorage:', err);
  }
}

// -------------------------------------------------------------
// CLASSE PRINCIPAL VEICULOS SERVICE
// -------------------------------------------------------------

class VeiculosService {
  // ===========================================================
  // 1. VEÍCULOS (Cadastro, Edição, Ativação / Desativação)
  // ===========================================================

  async listarVeiculos(params: { unidade_negocio?: string; apenasAtivos?: boolean } = {}): Promise<Veiculo[]> {
    const activeUnit = params.unidade_negocio || getActiveUserUnit();
    const apenasAtivos = params.apenasAtivos !== undefined ? params.apenasAtivos : false;

    if (isSupabaseConfigured) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          let query = supabase.from('veiculos').select(VEICULO_FIELDS).order('nome', { ascending: true });

          if (activeUnit) {
            query = query.in('unidade_negocio', getUnitEquivalents(activeUnit));
          }
          if (apenasAtivos) {
            query = query.eq('ativo', true);
          }

          const { data, error } = await query;
          if (!error && Array.isArray(data)) {
            const items: Veiculo[] = data.map((row: any) => ({
              id: row.id,
              nome: row.nome,
              marca: row.marca,
              placa: row.placa,
              unidade_negocio_id: row.unidade_negocio_id || null,
              unidade_negocio: row.unidade_negocio || activeUnit,
              ativo: row.ativo !== false,
              created_at: row.created_at,
              updated_at: row.updated_at,
            }));
            saveLocalVeiculos(items);
            return items;
          }
        }
      } catch (err) {
        console.warn('[VeiculosService] Falha ao consultar veiculos no Supabase, usando local:', err);
      }
    }

    // Fallback local
    let local = getLocalVeiculos();
    if (activeUnit) {
      local = local.filter((v) => itemMatchesUserUnit(v.unidade_negocio, activeUnit));
    }
    if (apenasAtivos) {
      local = local.filter((v) => v.ativo !== false);
    }
    return local.sort((a, b) => a.nome.localeCompare(b.nome));
  }

  async salvarVeiculo(dados: {
    id?: string;
    nome: string;
    marca: string;
    placa: string;
    unidade_negocio?: string;
    unidade_negocio_id?: string | null;
    ativo?: boolean;
  }): Promise<Veiculo> {
    const currentUser = getActiveUserProfile();
    if (currentUser && !canUserAdicionarEditarVeiculos(currentUser)) {
      throw new Error('Acesso negado: Somente usuários de nível Gestor ou Assistente do departamento Logística podem adicionar ou editar veículos.');
    }

    const now = new Date().toISOString();
    const isEdit = Boolean(dados.id);
    const unit = normalizarUnidadeNegocio(dados.unidade_negocio || getActiveUserUnit() || UNIDADE_PADRAO_SISTEMA);
    const unitIdSanitized = sanitizeUuid(dados.unidade_negocio_id);

    const veiculoObj: Veiculo = {
      id: dados.id && isValidUuid(dados.id) ? dados.id : generateUUID(),
      nome: dados.nome.trim(),
      marca: dados.marca.trim(),
      placa: dados.placa.trim().toUpperCase(),
      unidade_negocio: unit,
      unidade_negocio_id: unitIdSanitized,
      ativo: dados.ativo !== undefined ? dados.ativo : true,
      created_at: isEdit ? undefined : now,
      updated_at: now,
    };

    if (isSupabaseConfigured) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          const payload: Record<string, any> = {
            id: veiculoObj.id,
            nome: veiculoObj.nome,
            marca: veiculoObj.marca,
            placa: veiculoObj.placa,
            unidade_negocio: veiculoObj.unidade_negocio,
            unidade_negocio_id: veiculoObj.unidade_negocio_id,
            ativo: veiculoObj.ativo,
            updated_at: now,
          };
          if (!isEdit) payload.created_at = now;

          const query = isEdit
            ? supabase.from('veiculos').update(payload).eq('id', veiculoObj.id).select(VEICULO_FIELDS).single()
            : supabase.from('veiculos').insert(payload).select(VEICULO_FIELDS).single();

          const { data, error } = await query;
          if (error) {
            console.error('[VeiculosService] Erro ao gravar veículo no Supabase:', error);
            throw new Error(`Erro ao gravar veículo no Supabase: ${error.message || error.details}`);
          }

          if (data) {
            const saved: Veiculo = {
              id: data.id,
              nome: data.nome,
              marca: data.marca,
              placa: data.placa,
              unidade_negocio_id: data.unidade_negocio_id || null,
              unidade_negocio: data.unidade_negocio || unit,
              ativo: data.ativo !== false,
              created_at: data.created_at,
              updated_at: data.updated_at,
            };
            this.atualizarCacheVeiculoLocal(saved);
            return saved;
          }
        }
      } catch (err: any) {
        console.error('[VeiculosService] Erro ao gravar veículo no Supabase:', err);
        throw err;
      }
    }

    // Salvar local
    this.atualizarCacheVeiculoLocal(veiculoObj);
    return veiculoObj;
  }

  private atualizarCacheVeiculoLocal(v: Veiculo) {
    const list = getLocalVeiculos();
    const idx = list.findIndex((item) => item.id === v.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...v };
    } else {
      list.push(v);
    }
    saveLocalVeiculos(list);
  }

  async alternarStatusVeiculo(id: string, ativo: boolean): Promise<boolean> {
    const currentUser = getActiveUserProfile();
    if (currentUser && !canUserAdicionarEditarVeiculos(currentUser)) {
      throw new Error('Acesso negado: Somente usuários de nível Gestor ou Assistente do departamento Logística podem alterar o status de veículos.');
    }

    const now = new Date().toISOString();
    if (isSupabaseConfigured) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          const { error } = await supabase.from('veiculos').update({ ativo, updated_at: now }).eq('id', id);
          if (error) {
            console.error('[VeiculosService] Erro ao alternar status do veículo no Supabase:', error);
            throw new Error(`Erro ao alterar status no Supabase: ${error.message}`);
          }
          const list = getLocalVeiculos();
          const item = list.find((v) => v.id === id);
          if (item) {
            item.ativo = ativo;
            item.updated_at = now;
            saveLocalVeiculos(list);
          }
          return true;
        }
      } catch (err: any) {
        console.error('[VeiculosService] Falha ao alternar status do veículo:', err);
        throw err;
      }
    }

    const list = getLocalVeiculos();
    const item = list.find((v) => v.id === id);
    if (item) {
      item.ativo = ativo;
      item.updated_at = now;
      saveLocalVeiculos(list);
      return true;
    }
    return false;
  }

  async excluirVeiculo(id: string): Promise<boolean> {
    const currentUser = getActiveUserProfile();
    if (currentUser && !canUserExcluirVeiculosEAbastecimentos(currentUser)) {
      throw new Error('Acesso negado: A exclusão de registros da tabela de veículos é exclusiva do Gestor do departamento Logística.');
    }
    if (isSupabaseConfigured) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          const { error } = await supabase.from('veiculos').delete().eq('id', id);
          if (error) {
            console.error('[VeiculosService] Erro ao excluir veículo no Supabase:', error);
            throw new Error(`Erro ao excluir veículo no Supabase: ${error.message}`);
          }
          const list = getLocalVeiculos().filter((v) => v.id !== id);
          saveLocalVeiculos(list);
          return true;
        }
      } catch (err: any) {
        console.error('[VeiculosService] Falha ao excluir veículo:', err);
        throw err;
      }
    }

    const list = getLocalVeiculos().filter((v) => v.id !== id);
    saveLocalVeiculos(list);
    return true;
  }

  // ===========================================================
  // 2. MOTORISTAS (Usuários cadastrados com função 'Motorista')
  // ===========================================================

  async obterMotoristas(unidade_negocio?: string): Promise<Usuario[]> {
    const activeUnit = unidade_negocio || getActiveUserUnit();

    if (isSupabaseConfigured) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          // 1. Busca motoristas cadastrados com a função Motorista na unidade correspondente
          // Nota de performance: seleciona apenas campos existentes na tabela 'usuarios'
          let query = supabase
            .from('usuarios')
            .select('id, nome, codigo, departamento, funcao, nivel, unidade_negocio, status')
            .ilike('funcao', '%Motorista%')
            .order('nome', { ascending: true });

          if (activeUnit) {
            query = query.in('unidade_negocio', getUnitEquivalents(activeUnit));
          }

          const { data, error } = await query;
          if (!error && Array.isArray(data) && data.length > 0) {
            const ativos = data.filter((u) => u.status !== 'desativado' && u.status !== 'inativo');
            if (ativos.length > 0) {
              return ativos;
            }
          }

          // 2. Se nenhum motorista na unidade específica, busca usuários com função Motorista em todo o sistema
          const { data: allDrivers, error: errAll } = await supabase
            .from('usuarios')
            .select('id, nome, codigo, departamento, funcao, nivel, unidade_negocio, status')
            .ilike('funcao', '%Motorista%')
            .order('nome', { ascending: true });

          if (!errAll && Array.isArray(allDrivers) && allDrivers.length > 0) {
            const ativosAll = allDrivers.filter((u) => u.status !== 'desativado' && u.status !== 'inativo');
            if (ativosAll.length > 0) {
              return ativosAll;
            }
          }

          // 3. Fallback: se nenhum usuário foi cadastrado ainda como Motorista, busca usuários da Logística
          // da mesma unidade para permitir que o usuário opere sem bloquear
          let fallbackQuery = supabase
            .from('usuarios')
            .select('id, nome, codigo, departamento, funcao, nivel, unidade_negocio, status')
            .eq('departamento', 'Logística')
            .order('nome', { ascending: true });

          if (activeUnit) {
            fallbackQuery = fallbackQuery.in('unidade_negocio', getUnitEquivalents(activeUnit));
          }

          const fallbackRes = await fallbackQuery;
          if (!fallbackRes.error && Array.isArray(fallbackRes.data) && fallbackRes.data.length > 0) {
            const ativosFallback = fallbackRes.data.filter((u) => u.status !== 'desativado' && u.status !== 'inativo');
            if (ativosFallback.length > 0) {
              return ativosFallback;
            }
          }
        }
      } catch (err) {
        console.warn('[VeiculosService] Falha ao consultar motoristas no Supabase:', err);
      }
    }

    // Fallback local via cache apenas se offline e apenas usuários reais (NUNCA dados fictícios)
    try {
      const rawUsers = localStorage.getItem('polihub_usuarios');
      if (rawUsers) {
        const list: Usuario[] = JSON.parse(rawUsers);
        const filtered = list.filter(
          (u) =>
            u.status !== 'desativado' &&
            (u.funcao?.toLowerCase().includes('motorista') || u.departamento === 'Logística') &&
            (!activeUnit || itemMatchesUserUnit(u.unidade_negocio, activeUnit)) &&
            isValidUuid(u.id)
        );
        if (filtered.length > 0) return filtered;
      }
    } catch {
      // ignore
    }

    return [];
  }

  // ===========================================================
  // 3. SAÍDAS DE VEÍCULOS & CÁLCULO DE KM RODADO
  // ===========================================================

  /**
   * Obtém a saída imediatamente anterior do MESMO VEÍCULO
   * Não limita por período. Considera a data e horário anterior mais recente.
   */
  async obterUltimaSaidaDoVeiculo(
    veiculo_id: string,
    dataReferencia?: string,
    horarioReferencia?: string,
    excluirSaidaId?: string
  ): Promise<SaidaVeiculo | null> {
    if (!veiculo_id) return null;

    if (isSupabaseConfigured) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          let query = supabase
            .from('saidas_veiculos')
            .select(SAIDA_FIELDS)
            .eq('veiculo_id', veiculo_id)
            .order('data', { ascending: false })
            .order('horario', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(10);

          if (excluirSaidaId) {
            query = query.neq('id', excluirSaidaId);
          }

          const { data, error } = await query;
          if (!error && Array.isArray(data) && data.length > 0) {
            // Se informada data/horário de referência, encontrar a saída anterior a ela
            if (dataReferencia) {
              const refTime = new Date(`${dataReferencia}T${horarioReferencia || '23:59'}:00`).getTime();
              const anterior = data.find((row) => {
                const rowTime = new Date(`${row.data}T${row.horario || '00:00'}:00`).getTime();
                return rowTime <= refTime;
              });
              if (anterior) return anterior as SaidaVeiculo;
            }
            return data[0] as SaidaVeiculo;
          }
        }
      } catch (err) {
        console.warn('[VeiculosService] Falha ao consultar última saída no Supabase:', err);
      }
    }

    // Fallback local
    const local = getLocalSaidas().filter((s) => s.veiculo_id === veiculo_id && s.id !== excluirSaidaId);
    if (local.length === 0) return null;

    // Ordenar decrescente por data/hora
    local.sort((a, b) => {
      const timeA = new Date(`${a.data}T${a.horario || '00:00'}:00`).getTime();
      const timeB = new Date(`${b.data}T${b.horario || '00:00'}:00`).getTime();
      return timeB - timeA;
    });

    if (dataReferencia) {
      const refTime = new Date(`${dataReferencia}T${horarioReferencia || '23:59'}:00`).getTime();
      const anterior = local.find((s) => {
        const sTime = new Date(`${s.data}T${s.horario || '00:00'}:00`).getTime();
        return sTime <= refTime;
      });
      return anterior || null;
    }

    return local[0] || null;
  }

  /**
   * Calcula o KM rodado para uma nova saída ou saída em edição.
   * Regra 4: KM rodado = KM saída atual - KM da saída imediatamente anterior do mesmo veículo.
   * Regra 5: Primeira saída do veículo -> KM rodado = null (exibir "—").
   */
  async calcularKmRodado(
    veiculo_id: string,
    kmSaidaAtual: number,
    dataReferencia?: string,
    horarioReferencia?: string,
    excluirSaidaId?: string
  ): Promise<{ kmRodado: number | null; kmAnterior: number | null; ehPrimeiraSaida: boolean }> {
    const ultima = await this.obterUltimaSaidaDoVeiculo(veiculo_id, dataReferencia, horarioReferencia, excluirSaidaId);
    if (!ultima) {
      return { kmRodado: null, kmAnterior: null, ehPrimeiraSaida: true };
    }

    const kmAnterior = Number(ultima.km_saida);
    const diferenca = Number(kmSaidaAtual) - kmAnterior;
    return {
      kmRodado: diferenca >= 0 ? diferenca : 0,
      kmAnterior,
      ehPrimeiraSaida: false,
    };
  }

  async listarSaidas(filtros: {
    unidade_negocio?: string;
    dataInicio?: string;
    dataFim?: string;
    veiculo_id?: string;
    motorista_id?: string;
    periodo?: PeriodoSaida | 'Todos';
  } = {}): Promise<SaidaVeiculo[]> {
    const activeUnit = filtros.unidade_negocio || getActiveUserUnit();

    if (isSupabaseConfigured) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          let query = supabase
            .from('saidas_veiculos')
            .select(SAIDA_FIELDS)
            .order('data', { ascending: false })
            .order('horario', { ascending: false })
            .order('created_at', { ascending: false });

          if (activeUnit) {
            query = query.in('unidade_negocio', getUnitEquivalents(activeUnit));
          }
          if (filtros.dataInicio) {
            query = query.gte('data', filtros.dataInicio);
          }
          if (filtros.dataFim) {
            query = query.lte('data', filtros.dataFim);
          }
          if (filtros.veiculo_id && filtros.veiculo_id !== 'Todos') {
            query = query.eq('veiculo_id', filtros.veiculo_id);
          }
          if (filtros.motorista_id && filtros.motorista_id !== 'Todos') {
            query = query.eq('motorista_id', filtros.motorista_id);
          }
          if (filtros.periodo && filtros.periodo !== 'Todos') {
            query = query.eq('periodo', filtros.periodo);
          }

          const { data, error } = await query;
          if (!error && Array.isArray(data)) {
            const items: SaidaVeiculo[] = data.map((row: any) => ({
              id: row.id,
              data: row.data,
              horario: row.horario ? row.horario.slice(0, 5) : '00:00',
              periodo: row.periodo,
              veiculo_id: row.veiculo_id,
              veiculo_nome: row.veiculo_nome,
              veiculo_marca: row.veiculo_marca,
              veiculo_placa: row.veiculo_placa,
              motorista_id: row.motorista_id,
              motorista_nome: row.motorista_nome,
              km_saida: Number(row.km_saida),
              km_rodado: row.km_rodado !== null && row.km_rodado !== undefined ? Number(row.km_rodado) : null,
              quantidade_entregas: Number(row.quantidade_entregas || 0),
              valor_total_notas: Number(row.valor_total_notas || 0),
              observacao: row.observacao || null,
              unidade_negocio_id: row.unidade_negocio_id || null,
              unidade_negocio: row.unidade_negocio,
              usuario_id: row.usuario_id || null,
              created_at: row.created_at,
              updated_at: row.updated_at,
            }));
            saveLocalSaidas(items);
            return items;
          }
        }
      } catch (err) {
        console.warn('[VeiculosService] Falha ao consultar saídas no Supabase:', err);
      }
    }

    // Fallback local
    let local = getLocalSaidas();
    if (activeUnit) {
      local = local.filter((s) => itemMatchesUserUnit(s.unidade_negocio, activeUnit));
    }
    if (filtros.dataInicio) {
      local = local.filter((s) => s.data >= filtros.dataInicio!);
    }
    if (filtros.dataFim) {
      local = local.filter((s) => s.data <= filtros.dataFim!);
    }
    if (filtros.veiculo_id && filtros.veiculo_id !== 'Todos') {
      local = local.filter((s) => s.veiculo_id === filtros.veiculo_id);
    }
    if (filtros.motorista_id && filtros.motorista_id !== 'Todos') {
      local = local.filter((s) => s.motorista_id === filtros.motorista_id);
    }
    if (filtros.periodo && filtros.periodo !== 'Todos') {
      local = local.filter((s) => s.periodo === filtros.periodo);
    }

    return local.sort((a, b) => {
      const timeA = new Date(`${a.data}T${a.horario}:00`).getTime();
      const timeB = new Date(`${b.data}T${b.horario}:00`).getTime();
      return timeB - timeA;
    });
  }

  /**
   * Salva uma saída de veículo.
   * - Calcula automaticamente o KM rodado com base na saída imediatamente anterior do mesmo veículo
   * - Calcula quantidade de entregas e valor total das notas com base nas coletas selecionadas
   * - Vincula as coletas à saída na tabela associativa saidas_coletas
   */
  async salvarSaida(dados: {
    id?: string;
    data: string;
    horario: string;
    periodo: PeriodoSaida;
    veiculo_id: string;
    motorista_id: string;
    km_saida: number;
    observacao?: string | null;
    coletas_ids: string[];
    unidade_negocio?: string;
    usuario_id?: string | null;
  }): Promise<SaidaVeiculo> {
    const currentUser = getActiveUserProfile();
    if (currentUser && !canUserAdicionarEditarVeiculos(currentUser)) {
      throw new Error('Acesso negado: Somente usuários de nível Gestor ou Assistente do departamento Logística podem adicionar ou editar registros de saídas.');
    }

    const isEdit = Boolean(dados.id);
    const saidaId = dados.id && isValidUuid(dados.id) ? dados.id : generateUUID();
    const now = new Date().toISOString();

    if (!isValidUuid(dados.veiculo_id)) {
      throw new Error('Veículo inválido. Selecione um veículo cadastrado na frota.');
    }
    if (!isValidUuid(dados.motorista_id)) {
      throw new Error('Motorista inválido. Selecione um usuário cadastrado com a função Motorista.');
    }

    // 1. Obter dados do veículo e motorista para desnormalização
    const veiculos = await this.listarVeiculos({ apenasAtivos: false });
    const veiculo = veiculos.find((v) => v.id === dados.veiculo_id);
    const motoristas = await this.obterMotoristas(veiculo?.unidade_negocio || dados.unidade_negocio);
    const motorista = motoristas.find((m) => m.id === dados.motorista_id);

    const unit = normalizarUnidadeNegocio(
      veiculo?.unidade_negocio || dados.unidade_negocio || getActiveUserUnit() || UNIDADE_PADRAO_SISTEMA
    );

    const unitIdSanitized = sanitizeUuid(veiculo?.unidade_negocio_id);
    const usuarioIdSanitized = sanitizeUuid(dados.usuario_id);

    let formattedHorario = dados.horario ? dados.horario.trim() : '00:00:00';
    if (formattedHorario.length === 5) {
      formattedHorario = `${formattedHorario}:00`;
    }

    // 2. Calcular KM rodado automaticamente
    const { kmRodado } = await this.calcularKmRodado(
      dados.veiculo_id,
      Number(dados.km_saida),
      dados.data,
      dados.horario,
      isEdit ? saidaId : undefined
    );

    // 3. Buscar detalhes das coletas selecionadas para somar valor e quantidade
    const validColetaIds = Array.isArray(dados.coletas_ids)
      ? dados.coletas_ids.filter((cid) => isValidUuid(cid))
      : [];
    const coletasSelecionadas = await this.obterColetasPorIds(validColetaIds);
    const quantidadeEntregas = validColetaIds.length;
    const valorTotalNotas = coletasSelecionadas.reduce((acc, c) => acc + (c.valor ? Number(c.valor) : 0), 0);

    const saidaObj: SaidaVeiculo = {
      id: saidaId,
      data: dados.data,
      horario: dados.horario.slice(0, 5),
      periodo: dados.periodo,
      veiculo_id: dados.veiculo_id,
      veiculo_nome: veiculo?.nome || 'Veículo',
      veiculo_marca: veiculo?.marca || '',
      veiculo_placa: veiculo?.placa || '',
      motorista_id: dados.motorista_id,
      motorista_nome: motorista?.nome || 'Motorista',
      km_saida: Number(dados.km_saida),
      km_rodado: kmRodado,
      quantidade_entregas: quantidadeEntregas,
      valor_total_notas: Number(valorTotalNotas.toFixed(2)),
      observacao: dados.observacao ? dados.observacao.trim() : null,
      unidade_negocio: unit,
      unidade_negocio_id: unitIdSanitized,
      usuario_id: usuarioIdSanitized,
      created_at: isEdit ? undefined : now,
      updated_at: now,
      entregas: coletasSelecionadas,
    };

    // 4. Gravar no Supabase
    if (isSupabaseConfigured) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          const payload: Record<string, any> = {
            id: saidaObj.id,
            data: saidaObj.data,
            horario: formattedHorario,
            periodo: saidaObj.periodo,
            veiculo_id: saidaObj.veiculo_id,
            veiculo_nome: saidaObj.veiculo_nome,
            veiculo_marca: saidaObj.veiculo_marca,
            veiculo_placa: saidaObj.veiculo_placa,
            motorista_id: saidaObj.motorista_id,
            motorista_nome: saidaObj.motorista_nome,
            km_saida: saidaObj.km_saida,
            km_rodado: saidaObj.km_rodado,
            quantidade_entregas: saidaObj.quantidade_entregas,
            valor_total_notas: saidaObj.valor_total_notas,
            observacao: saidaObj.observacao,
            unidade_negocio: saidaObj.unidade_negocio,
            unidade_negocio_id: saidaObj.unidade_negocio_id,
            usuario_id: saidaObj.usuario_id,
            updated_at: now,
          };
          if (!isEdit) payload.created_at = now;

          const query = isEdit
            ? supabase.from('saidas_veiculos').update(payload).eq('id', saidaId)
            : supabase.from('saidas_veiculos').insert(payload);

          const { error: errSaida } = await query;
          if (errSaida) {
            console.error('[VeiculosService] Erro ao salvar saída no Supabase:', errSaida);
            throw new Error(`Erro ao salvar no banco Supabase: ${errSaida.message || errSaida.details}`);
          }

          // Atualizar vínculos de coletas (saidas_coletas)
          if (isEdit) {
            await supabase.from('saidas_coletas').delete().eq('saida_id', saidaId);
          }
          if (validColetaIds.length > 0) {
            const vinculos = validColetaIds.map((cid) => ({
              id: generateUUID(),
              saida_id: saidaId,
              coleta_id: cid,
              created_at: now,
            }));
            const { error: errVinculos } = await supabase.from('saidas_coletas').insert(vinculos);
            if (errVinculos) {
              console.warn('[VeiculosService] Aviso ao vincular coletas no Supabase:', errVinculos);
            }
          }
        }
      } catch (err: any) {
        console.error('[VeiculosService] Falha ao persistir saída no Supabase:', err);
        throw err;
      }
    }

    // 5. Atualizar LocalStorage
    const localSaidas = getLocalSaidas();
    const idx = localSaidas.findIndex((s) => s.id === saidaId);
    if (idx >= 0) {
      localSaidas[idx] = { ...localSaidas[idx], ...saidaObj };
    } else {
      localSaidas.unshift(saidaObj);
    }
    saveLocalSaidas(localSaidas);

    // Atualizar vínculos locais de coletas
    let localVinculos = getLocalSaidasColetas().filter((v) => v.saida_id !== saidaId);
    validColetaIds.forEach((cid) => {
      localVinculos.push({
        id: generateUUID(),
        saida_id: saidaId,
        coleta_id: cid,
        created_at: now,
      });
    });
    saveLocalSaidasColetas(localVinculos);

    return saidaObj;
  }

  async excluirSaida(id: string): Promise<boolean> {
    const currentUser = getActiveUserProfile();
    if (currentUser && !canUserExcluirVeiculosEAbastecimentos(currentUser)) {
      throw new Error('Acesso negado: A exclusão de saídas de veículos é exclusiva do Gestor do departamento Logística.');
    }
    if (isSupabaseConfigured) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          // Remover vinculos
          await supabase.from('saidas_coletas').delete().eq('saida_id', id);
          const { error } = await supabase.from('saidas_veiculos').delete().eq('id', id);
          if (error) {
            console.error('[VeiculosService] Erro ao excluir saída no Supabase:', error);
            throw new Error(`Erro ao excluir saída no Supabase: ${error.message}`);
          }
          this.removerSaidaLocal(id);
          return true;
        }
      } catch (err: any) {
        console.error('[VeiculosService] Erro ao excluir saída no Supabase:', err);
        throw err;
      }
    }

    this.removerSaidaLocal(id);
    return true;
  }

  private removerSaidaLocal(id: string) {
    const saidas = getLocalSaidas().filter((s) => s.id !== id);
    saveLocalSaidas(saidas);
    const vinculos = getLocalSaidasColetas().filter((v) => v.saida_id !== id);
    saveLocalSaidasColetas(vinculos);
  }

  // ===========================================================
  // 4. ENTREGAS / COLETAS VINCULADAS & SELEÇÃO
  // ===========================================================

  /**
   * Lista coletas disponíveis da unidade para vincular a uma nova saída
   * Exclui coletas que já estejam vinculadas a OUTRA saída.
   * Se saidaAtualId for passada, inclui as coletas vinculadas a ela.
   * Performance: Carregado apenas sob demanda quando abre o modal.
   */
  async listarColetasDisponiveisParaSaida(params: {
    unidade_negocio?: string;
    saidaAtualId?: string;
    search?: string;
  }): Promise<ExpedicaoColeta[]> {
    const activeUnit = params.unidade_negocio || getActiveUserUnit();
    const search = params.search?.trim().toLowerCase();

    // 1. Obter IDs de coletas já vinculadas a saídas
    const idsVinculados = await this.obterIdsColetasJaVinculadas(params.saidaAtualId);

    // 2. Buscar coletas da unidade
    let coletas: ExpedicaoColeta[] = [];

    if (isSupabaseConfigured) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          let query = supabase
            .from('expedicao_coletas')
            .select(COLETA_MINIMAL_FIELDS)
            .order('data', { ascending: false })
            .limit(300);

          if (activeUnit) {
            query = query.in('unidade_negocio', getUnitEquivalents(activeUnit));
          }

          const { data, error } = await query;
          if (!error && Array.isArray(data)) {
            coletas = data.map((row: any) => ({
              id: row.id,
              numero_nota_fiscal: row.numero_nota_fiscal,
              cliente: row.cliente,
              transportadora: row.transportadora,
              numero_coleta: row.numero_coleta || null,
              chave_nf: row.chave_nf || null,
              data: row.data,
              status: row.status,
              valor: row.valor !== undefined && row.valor !== null ? Number(row.valor) : 0,
              unidade_negocio: row.unidade_negocio,
            }));
          }
        }
      } catch (err) {
        console.warn('[VeiculosService] Falha ao consultar coletas no Supabase:', err);
      }
    }

    if (coletas.length === 0) {
      // Fallback para cache local de coletas
      try {
        const raw = localStorage.getItem('polihub_expedicao_coletas');
        if (raw) {
          coletas = JSON.parse(raw);
          if (activeUnit) {
            coletas = coletas.filter((c) => itemMatchesUserUnit(c.unidade_negocio, activeUnit));
          }
        }
      } catch {
        // ignore
      }
    }

    // 3. Filtrar: remover coletas que já estão em outra saída
    let disponiveis = coletas.filter((c) => !idsVinculados.has(c.id));

    // 4. Aplicar busca por texto se digitada
    if (search) {
      disponiveis = disponiveis.filter(
        (c) =>
          c.numero_nota_fiscal?.toLowerCase().includes(search) ||
          c.cliente?.toLowerCase().includes(search) ||
          c.transportadora?.toLowerCase().includes(search) ||
          c.numero_coleta?.toLowerCase().includes(search) ||
          c.chave_nf?.toLowerCase().includes(search)
      );
    }

    return disponiveis;
  }

  private async obterIdsColetasJaVinculadas(ignorarSaidaId?: string): Promise<Set<string>> {
    const ids = new Set<string>();

    if (isSupabaseConfigured) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          let query = supabase.from('saidas_coletas').select('coleta_id, saida_id');
          if (ignorarSaidaId) {
            query = query.neq('saida_id', ignorarSaidaId);
          }
          const { data, error } = await query;
          if (!error && Array.isArray(data)) {
            data.forEach((row) => {
              if (row.coleta_id) ids.add(row.coleta_id);
            });
            return ids;
          }
        }
      } catch {
        // ignore
      }
    }

    // Fallback local
    const vinculosLocais = getLocalSaidasColetas();
    vinculosLocais.forEach((v) => {
      if (!ignorarSaidaId || v.saida_id !== ignorarSaidaId) {
        ids.add(v.coleta_id);
      }
    });

    return ids;
  }

  async obterColetasPorIds(ids: string[]): Promise<ExpedicaoColeta[]> {
    if (!ids || ids.length === 0) return [];

    if (isSupabaseConfigured) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          const { data, error } = await supabase
            .from('expedicao_coletas')
            .select(COLETA_MINIMAL_FIELDS)
            .in('id', ids);

          if (!error && Array.isArray(data)) {
            return data.map((row: any) => ({
              id: row.id,
              numero_nota_fiscal: row.numero_nota_fiscal,
              cliente: row.cliente,
              transportadora: row.transportadora,
              numero_coleta: row.numero_coleta || null,
              chave_nf: row.chave_nf || null,
              data: row.data,
              status: row.status,
              valor: row.valor !== undefined && row.valor !== null ? Number(row.valor) : 0,
              unidade_negocio: row.unidade_negocio,
            }));
          }
        }
      } catch {
        // ignore
      }
    }

    // Fallback local
    try {
      const raw = localStorage.getItem('polihub_expedicao_coletas');
      if (raw) {
        const all: ExpedicaoColeta[] = JSON.parse(raw);
        return all.filter((c) => ids.includes(c.id));
      }
    } catch {
      // ignore
    }

    return [];
  }

  async obterEntregasDaSaida(saida_id: string): Promise<ExpedicaoColeta[]> {
    if (!saida_id) return [];

    let coletaIds: string[] = [];

    if (isSupabaseConfigured) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          const { data, error } = await supabase
            .from('saidas_coletas')
            .select('coleta_id')
            .eq('saida_id', saida_id);

          if (!error && Array.isArray(data)) {
            coletaIds = data.map((r) => r.coleta_id).filter(Boolean);
          }
        }
      } catch {
        // ignore
      }
    }

    if (coletaIds.length === 0) {
      const vinculosLocais = getLocalSaidasColetas().filter((v) => v.saida_id === saida_id);
      coletaIds = vinculosLocais.map((v) => v.coleta_id);
    }

    return this.obterColetasPorIds(coletaIds);
  }

  // ===========================================================
  // 5. ABASTECIMENTOS
  // ===========================================================

  async listarAbastecimentos(filtros: {
    unidade_negocio?: string;
    dataInicio?: string;
    dataFim?: string;
    veiculo_id?: string;
    motorista_id?: string;
  } = {}): Promise<AbastecimentoVeiculo[]> {
    const activeUnit = filtros.unidade_negocio || getActiveUserUnit();

    if (isSupabaseConfigured) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          let query = supabase
            .from('abastecimentos_veiculos')
            .select(ABASTECIMENTO_FIELDS)
            .order('data', { ascending: false })
            .order('horario', { ascending: false })
            .order('created_at', { ascending: false });

          if (activeUnit) {
            query = query.in('unidade_negocio', getUnitEquivalents(activeUnit));
          }
          if (filtros.dataInicio) query = query.gte('data', filtros.dataInicio);
          if (filtros.dataFim) query = query.lte('data', filtros.dataFim);
          if (filtros.veiculo_id && filtros.veiculo_id !== 'Todos') query = query.eq('veiculo_id', filtros.veiculo_id);
          if (filtros.motorista_id && filtros.motorista_id !== 'Todos') query = query.eq('motorista_id', filtros.motorista_id);

          const { data, error } = await query;
          if (!error && Array.isArray(data)) {
            const items: AbastecimentoVeiculo[] = data.map((row: any) => ({
              id: row.id,
              data: row.data,
              horario: row.horario ? row.horario.slice(0, 5) : '00:00',
              veiculo_id: row.veiculo_id,
              veiculo_nome: row.veiculo_nome,
              veiculo_marca: row.veiculo_marca,
              veiculo_placa: row.veiculo_placa,
              motorista_id: row.motorista_id,
              motorista_nome: row.motorista_nome,
              km_abastecimento: Number(row.km_abastecimento),
              quantidade_litros: Number(row.quantidade_litros),
              valor_total: Number(row.valor_total),
              preco_litro: row.preco_litro !== null && row.preco_litro !== undefined ? Number(row.preco_litro) : null,
              observacao: row.observacao || null,
              unidade_negocio_id: row.unidade_negocio_id || null,
              unidade_negocio: row.unidade_negocio,
              usuario_id: row.usuario_id || null,
              created_at: row.created_at,
              updated_at: row.updated_at,
            }));
            saveLocalAbastecimentos(items);
            return items;
          }
        }
      } catch (err) {
        console.warn('[VeiculosService] Falha ao consultar abastecimentos no Supabase:', err);
      }
    }

    // Fallback local
    let local = getLocalAbastecimentos();
    if (activeUnit) {
      local = local.filter((a) => itemMatchesUserUnit(a.unidade_negocio, activeUnit));
    }
    if (filtros.dataInicio) local = local.filter((a) => a.data >= filtros.dataInicio!);
    if (filtros.dataFim) local = local.filter((a) => a.data <= filtros.dataFim!);
    if (filtros.veiculo_id && filtros.veiculo_id !== 'Todos') local = local.filter((a) => a.veiculo_id === filtros.veiculo_id);
    if (filtros.motorista_id && filtros.motorista_id !== 'Todos') local = local.filter((a) => a.motorista_id === filtros.motorista_id);

    return local.sort((a, b) => {
      const timeA = new Date(`${a.data}T${a.horario}:00`).getTime();
      const timeB = new Date(`${b.data}T${b.horario}:00`).getTime();
      return timeB - timeA;
    });
  }

  async salvarAbastecimento(dados: {
    id?: string;
    data: string;
    horario: string;
    veiculo_id: string;
    motorista_id: string;
    km_abastecimento: number;
    quantidade_litros: number;
    valor_total: number;
    observacao?: string | null;
    unidade_negocio?: string;
    usuario_id?: string | null;
  }): Promise<AbastecimentoVeiculo> {
    const currentUser = getActiveUserProfile();
    if (currentUser && !canUserAdicionarEditarVeiculos(currentUser)) {
      throw new Error('Acesso negado: Somente usuários de nível Gestor ou Assistente do departamento Logística podem adicionar ou editar abastecimentos.');
    }

    const isEdit = Boolean(dados.id);
    const abastecimentoId = dados.id && isValidUuid(dados.id) ? dados.id : generateUUID();
    const now = new Date().toISOString();

    if (!isValidUuid(dados.veiculo_id)) {
      throw new Error('Veículo inválido. Selecione um veículo cadastrado na frota.');
    }
    if (!isValidUuid(dados.motorista_id)) {
      throw new Error('Motorista inválido. Selecione um usuário cadastrado com a função Motorista.');
    }

    const veiculos = await this.listarVeiculos({ apenasAtivos: false });
    const veiculo = veiculos.find((v) => v.id === dados.veiculo_id);
    const motoristas = await this.obterMotoristas(veiculo?.unidade_negocio || dados.unidade_negocio);
    const motorista = motoristas.find((m) => m.id === dados.motorista_id);

    const unit = normalizarUnidadeNegocio(
      veiculo?.unidade_negocio || dados.unidade_negocio || getActiveUserUnit() || UNIDADE_PADRAO_SISTEMA
    );

    const unitIdSanitized = sanitizeUuid(veiculo?.unidade_negocio_id);
    const usuarioIdSanitized = sanitizeUuid(dados.usuario_id);

    let formattedHorario = dados.horario ? dados.horario.trim() : '00:00:00';
    if (formattedHorario.length === 5) {
      formattedHorario = `${formattedHorario}:00`;
    }

    const litros = Number(dados.quantidade_litros);
    const valorTotal = Number(dados.valor_total);
    const precoLitro = litros > 0 ? Number((valorTotal / litros).toFixed(2)) : null;

    const abastObj: AbastecimentoVeiculo = {
      id: abastecimentoId,
      data: dados.data,
      horario: dados.horario.slice(0, 5),
      veiculo_id: dados.veiculo_id,
      veiculo_nome: veiculo?.nome || 'Veículo',
      veiculo_marca: veiculo?.marca || '',
      veiculo_placa: veiculo?.placa || '',
      motorista_id: dados.motorista_id,
      motorista_nome: motorista?.nome || 'Motorista',
      km_abastecimento: Number(dados.km_abastecimento),
      quantidade_litros: litros,
      valor_total: valorTotal,
      preco_litro: precoLitro,
      observacao: dados.observacao ? dados.observacao.trim() : null,
      unidade_negocio: unit,
      unidade_negocio_id: unitIdSanitized,
      usuario_id: usuarioIdSanitized,
      created_at: isEdit ? undefined : now,
      updated_at: now,
    };

    if (isSupabaseConfigured) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          const payload: Record<string, any> = {
            id: abastObj.id,
            data: abastObj.data,
            horario: formattedHorario,
            veiculo_id: abastObj.veiculo_id,
            veiculo_nome: abastObj.veiculo_nome,
            veiculo_marca: abastObj.veiculo_marca,
            veiculo_placa: abastObj.veiculo_placa,
            motorista_id: abastObj.motorista_id,
            motorista_nome: abastObj.motorista_nome,
            km_abastecimento: abastObj.km_abastecimento,
            quantidade_litros: abastObj.quantidade_litros,
            valor_total: abastObj.valor_total,
            preco_litro: abastObj.preco_litro,
            observacao: abastObj.observacao,
            unidade_negocio: abastObj.unidade_negocio,
            unidade_negocio_id: abastObj.unidade_negocio_id,
            usuario_id: abastObj.usuario_id,
            updated_at: now,
          };
          if (!isEdit) payload.created_at = now;

          const query = isEdit
            ? supabase.from('abastecimentos_veiculos').update(payload).eq('id', abastecimentoId)
            : supabase.from('abastecimentos_veiculos').insert(payload);

          const { error: errAbast } = await query;
          if (errAbast) {
            console.error('[VeiculosService] Erro ao gravar abastecimento no Supabase:', errAbast);
            throw new Error(`Erro ao salvar abastecimento no banco Supabase: ${errAbast.message || errAbast.details}`);
          }
        }
      } catch (err: any) {
        console.error('[VeiculosService] Falha ao persistir abastecimento no Supabase:', err);
        throw err;
      }
    }

    const local = getLocalAbastecimentos();
    const idx = local.findIndex((a) => a.id === abastecimentoId);
    if (idx >= 0) {
      local[idx] = { ...local[idx], ...abastObj };
    } else {
      local.unshift(abastObj);
    }
    saveLocalAbastecimentos(local);

    return abastObj;
  }

  async excluirAbastecimento(id: string): Promise<boolean> {
    const currentUser = getActiveUserProfile();
    if (currentUser && !canUserExcluirVeiculosEAbastecimentos(currentUser)) {
      throw new Error('Acesso negado: A exclusão de abastecimentos é exclusiva do Gestor do departamento Logística.');
    }
    if (isSupabaseConfigured) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          const { error } = await supabase.from('abastecimentos_veiculos').delete().eq('id', id);
          if (error) {
            console.error('[VeiculosService] Erro ao excluir abastecimento no Supabase:', error);
            throw new Error(`Erro ao excluir abastecimento no Supabase: ${error.message}`);
          }
          const list = getLocalAbastecimentos().filter((a) => a.id !== id);
          saveLocalAbastecimentos(list);
          return true;
        }
      } catch (err: any) {
        console.error('[VeiculosService] Erro ao excluir abastecimento no Supabase:', err);
        throw err;
      }
    }

    const list = getLocalAbastecimentos().filter((a) => a.id !== id);
    saveLocalAbastecimentos(list);
    return true;
  }

  // ===========================================================
  // 6. INDICADORES & ANALYTICS
  // ===========================================================

  async obterIndicadores(filtros: {
    unidade_negocio?: string;
    dataInicio?: string;
    dataFim?: string;
    veiculo_id?: string;
    motorista_id?: string;
  } = {}): Promise<IndicadoresVeiculos> {
    const [saidas, abastecimentos, veiculos] = await Promise.all([
      this.listarSaidas(filtros),
      this.listarAbastecimentos(filtros),
      this.listarVeiculos({ unidade_negocio: filtros.unidade_negocio }),
    ]);

    // Métricas de Saídas
    let kmTotalRodado = 0;
    let quantidadeEntregas = 0;
    let valorTotalNotas = 0;

    saidas.forEach((s) => {
      if (s.km_rodado !== null && s.km_rodado > 0) {
        kmTotalRodado += s.km_rodado;
      }
      quantidadeEntregas += s.quantidade_entregas || 0;
      valorTotalNotas += s.valor_total_notas || 0;
    });

    // Métricas de Abastecimentos
    let totalAbastecido = 0;
    let quantidadeAbastecida = 0;

    abastecimentos.forEach((a) => {
      totalAbastecido += a.valor_total || 0;
      quantidadeAbastecida += a.quantidade_litros || 0;
    });

    const quantidadeSaidas = saidas.length;
    const custoPorKm = kmTotalRodado > 0 ? Number((totalAbastecido / kmTotalRodado).toFixed(2)) : 0;
    const consumoMedioKmPorLitro = quantidadeAbastecida > 0 ? Number((kmTotalRodado / quantidadeAbastecida).toFixed(2)) : 0;
    const mediaEntregasPorSaida = quantidadeSaidas > 0 ? Number((quantidadeEntregas / quantidadeSaidas).toFixed(1)) : 0;
    const ticketMedioPorEntrega = quantidadeEntregas > 0 ? Number((valorTotalNotas / quantidadeEntregas).toFixed(2)) : 0;

    // Resumo por Veículo
    const mapaVeiculos = new Map<
      string,
      {
        veiculoId: string;
        veiculoNome: string;
        veiculoPlaca: string;
        saidas: number;
        kmRodado: number;
        entregas: number;
        valorNotas: number;
        abastecidoLitros: number;
        abastecidoValor: number;
      }
    >();

    veiculos.forEach((v) => {
      mapaVeiculos.set(v.id, {
        veiculoId: v.id,
        veiculoNome: v.nome,
        veiculoPlaca: v.placa,
        saidas: 0,
        kmRodado: 0,
        entregas: 0,
        valorNotas: 0,
        abastecidoLitros: 0,
        abastecidoValor: 0,
      });
    });

    saidas.forEach((s) => {
      const cur = mapaVeiculos.get(s.veiculo_id) || {
        veiculoId: s.veiculo_id,
        veiculoNome: s.veiculo_nome || 'Veículo',
        veiculoPlaca: s.veiculo_placa || '',
        saidas: 0,
        kmRodado: 0,
        entregas: 0,
        valorNotas: 0,
        abastecidoLitros: 0,
        abastecidoValor: 0,
      };
      cur.saidas += 1;
      if (s.km_rodado) cur.kmRodado += s.km_rodado;
      cur.entregas += s.quantidade_entregas || 0;
      cur.valorNotas += s.valor_total_notas || 0;
      mapaVeiculos.set(s.veiculo_id, cur);
    });

    abastecimentos.forEach((a) => {
      const cur = mapaVeiculos.get(a.veiculo_id);
      if (cur) {
        cur.abastecidoLitros += a.quantidade_litros || 0;
        cur.abastecidoValor += a.valor_total || 0;
      }
    });

    const resumoPorVeiculo = Array.from(mapaVeiculos.values()).map((v) => ({
      ...v,
      custoPorKm: v.kmRodado > 0 ? Number((v.abastecidoValor / v.kmRodado).toFixed(2)) : 0,
    }));

    // Resumo por Motorista
    const mapaMotoristas = new Map<
      string,
      {
        motoristaId: string;
        motoristaNome: string;
        saidas: number;
        kmRodado: number;
        entregas: number;
        valorNotas: number;
        abastecidoValor: number;
      }
    >();

    saidas.forEach((s) => {
      const cur = mapaMotoristas.get(s.motorista_id) || {
        motoristaId: s.motorista_id,
        motoristaNome: s.motorista_nome || 'Motorista',
        saidas: 0,
        kmRodado: 0,
        entregas: 0,
        valorNotas: 0,
        abastecidoValor: 0,
      };
      cur.saidas += 1;
      if (s.km_rodado) cur.kmRodado += s.km_rodado;
      cur.entregas += s.quantidade_entregas || 0;
      cur.valorNotas += s.valor_total_notas || 0;
      mapaMotoristas.set(s.motorista_id, cur);
    });

    abastecimentos.forEach((a) => {
      const cur = mapaMotoristas.get(a.motorista_id);
      if (cur) {
        cur.abastecidoValor += a.valor_total || 0;
      }
    });

    const resumoPorMotorista = Array.from(mapaMotoristas.values());

    return {
      kmTotalRodado,
      quantidadeSaidas,
      quantidadeEntregas,
      valorTotalNotas: Number(valorTotalNotas.toFixed(2)),
      totalAbastecido: Number(totalAbastecido.toFixed(2)),
      quantidadeAbastecida: Number(quantidadeAbastecida.toFixed(2)),
      custoPorKm,
      consumoMedioKmPorLitro,
      mediaEntregasPorSaida,
      ticketMedioPorEntrega,
      resumoPorVeiculo,
      resumoPorMotorista,
    };
  }
}

export const veiculosService = new VeiculosService();
