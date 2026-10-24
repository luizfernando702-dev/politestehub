import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { SeparacaoPedido, ProdutoPedido, Usuario, StatusSeparacaoOperacional } from '../types';
import { getActiveUserUnit, itemMatchesUserUnit, getUnitEquivalents } from './sessionHelper';
import { UNIDADE_PADRAO_SISTEMA, normalizarUnidadeNegocio } from '../constants/unidades';
import { usuariosService } from './usuariosService';
import { podeGerenciarPedidos } from '../utils/permissoes';
import * as XLSX from 'xlsx';

export const SEPARACAO_FIELDS = 'id, id_pedido, unidade_negocio, data, codigo_controle, cliente, transportador, quantidade_itens, separador_id, hora_inicial_separacao, hora_final_separacao, conferente_id, hora_inicial_conferencia, hora_final_conferencia, created_at, updated_at';
export const PRODUTO_PEDIDO_FIELDS = 'id, pedido_id, codigo_barra, produto, locacao, quantidade, saldo, created_at';

const LOCAL_STORAGE_PEDIDOS = 'polihub_separacao_pedidos';
const LOCAL_STORAGE_PRODUTOS = 'polihub_produtos_pedido';

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

/**
 * Calcula a diferença em minutos entre dois horários no formato HH:mm.
 * Suporta transição de meia-noite se aplicável.
 */
export function calcularDiferencaMinutos(horaInicio?: string | null, horaFim?: string | null): number | null {
  if (!horaInicio || !horaFim) return null;
  const regex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
  if (!regex.test(horaInicio.trim()) || !regex.test(horaFim.trim())) return null;

  const [hI, mI] = horaInicio.trim().split(':').map(Number);
  const [hF, mF] = horaFim.trim().split(':').map(Number);

  let minInicio = hI * 60 + mI;
  let minFim = hF * 60 + mF;

  if (minFim < minInicio) {
    // Virada de dia
    minFim += 24 * 60;
  }

  return minFim - minInicio;
}

/**
 * Formata minutos em texto amigável (ex: "45m" ou "1h 15m")
 */
export function formatarMinutos(minutos?: number | null): string {
  if (minutos === null || minutos === undefined || isNaN(minutos)) return '-';
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Determina o status operacional do processo de separação/conferência
 */
export function determinarStatusOperacional(p: Partial<SeparacaoPedido>): StatusSeparacaoOperacional {
  if (p.hora_final_conferencia && p.hora_final_conferencia.trim()) {
    return 'Concluído';
  }
  if (p.hora_inicial_conferencia && p.hora_inicial_conferencia.trim()) {
    return 'Em Conferência';
  }
  if (p.hora_final_separacao && p.hora_final_separacao.trim()) {
    return 'Separado';
  }
  if (p.hora_inicial_separacao && p.hora_inicial_separacao.trim()) {
    return 'Em Separação';
  }
  return 'Pendente';
}

// Pedidos padrão incluindo os pedidos operacionais 67192, 67165 e 67184
const PEDIDOS_PADRAO_INICIAIS: SeparacaoPedido[] = [
  {
    id: 'ped-67192-ref',
    id_pedido: '67192',
    unidade_negocio: 'Goiânia',
    data: new Date().toISOString().split('T')[0],
    codigo_controle: 'CTR-67192',
    cliente: 'Auto Peças Araguaia Ltda',
    transportador: 'Braspress Transportes',
    quantidade_itens: 48,
    separador_id: null,
    separador_nome: 'Marcos Silva',
    hora_inicial_separacao: '08:15',
    hora_final_separacao: '09:05',
    conferente_id: null,
    conferente_nome: 'Carlos Eduardo',
    hora_inicial_conferencia: '09:15',
    hora_final_conferencia: '09:40',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'ped-67165-ref',
    id_pedido: '67165',
    unidade_negocio: 'Goiânia',
    data: new Date().toISOString().split('T')[0],
    codigo_controle: 'CTR-67165',
    cliente: 'Filtros Centro-Oeste Distribuidora',
    transportador: 'Jadlog Logística',
    quantidade_itens: 120,
    separador_id: null,
    separador_nome: 'Marcos Silva',
    hora_inicial_separacao: '09:30',
    hora_final_separacao: '10:45',
    conferente_id: null,
    conferente_nome: 'Carlos Eduardo',
    hora_inicial_conferencia: '10:55',
    hora_final_conferencia: null,
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'ped-67184-ref',
    id_pedido: '67184',
    unidade_negocio: 'Goiânia',
    data: new Date().toISOString().split('T')[0],
    codigo_controle: 'CTR-67184',
    cliente: 'Lubrificantes & Filtros Brasil',
    transportador: 'TNT Mercúrio',
    quantidade_itens: 35,
    separador_id: null,
    separador_nome: null,
    hora_inicial_separacao: null,
    hora_final_separacao: null,
    conferente_id: null,
    conferente_nome: null,
    hora_inicial_conferencia: null,
    hora_final_conferencia: null,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'ped-10491-ref',
    id_pedido: 'PED-10491',
    unidade_negocio: 'Goiânia',
    data: new Date().toISOString().split('T')[0],
    codigo_controle: 'CTR-8812',
    cliente: 'Auto Peças Araguaia Ltda',
    transportador: 'Braspress Transportes',
    quantidade_itens: 48,
    separador_id: null,
    separador_nome: 'Marcos Silva',
    hora_inicial_separacao: '08:15',
    hora_final_separacao: '09:05',
    conferente_id: null,
    conferente_nome: 'Carlos Eduardo',
    hora_inicial_conferencia: '09:15',
    hora_final_conferencia: '09:40',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    updated_at: new Date().toISOString(),
  }
];

/**
 * Carrega a lista de pedidos do localStorage com dados iniciais se vazio
 * e garante a presença dos pedidos 67192, 67165 e 67184
 */
function getLocalPedidos(): SeparacaoPedido[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PEDIDOS);
    if (raw) {
      const lista: SeparacaoPedido[] = JSON.parse(raw);
      // Garantir que 67192, 67165 e 67184 estejam presentes mesmo se o cache local for antigo
      const idsExistentes = new Set(lista.map((p) => String(p.id_pedido).trim().toLowerCase()));
      let modificou = false;

      for (const ref of PEDIDOS_PADRAO_INICIAIS) {
        if (!idsExistentes.has(ref.id_pedido.toLowerCase())) {
          lista.unshift(ref);
          idsExistentes.add(ref.id_pedido.toLowerCase());
          modificou = true;
        }
      }

      if (modificou) {
        saveLocalPedidos(lista);
      }
      return lista;
    }
  } catch (err) {
    console.warn('Erro ao ler pedidos do localStorage:', err);
  }

  saveLocalPedidos(PEDIDOS_PADRAO_INICIAIS);
  return PEDIDOS_PADRAO_INICIAIS;
}

function saveLocalPedidos(pedidos: SeparacaoPedido[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_PEDIDOS, JSON.stringify(pedidos));
  } catch (err) {
    console.warn('Erro ao salvar pedidos no localStorage:', err);
  }
}

function getLocalProdutos(): ProdutoPedido[] {
  // Produtos padrão associados aos pedidos 67192, 67165 e 67184
  const produtosPadrao: ProdutoPedido[] = [
    // Produtos do Pedido 67192
    {
      id: 'prod-67192-1',
      pedido_id: 'ped-67192-ref',
      codigo_barra: '7891234560011',
      produto: 'Elemento Filtrante Ar Primário P-550',
      locacao: 'R01-P03-N1',
      quantidade: 24,
      saldo: 24,
      created_at: new Date().toISOString(),
    },
    {
      id: 'prod-67192-2',
      pedido_id: 'ped-67192-ref',
      codigo_barra: '7891234560028',
      produto: 'Filtro Óleo Lubrificante Linha Pesada L-820',
      locacao: 'R02-P01-N2',
      quantidade: 24,
      saldo: 24,
      created_at: new Date().toISOString(),
    },
    // Produtos do Pedido 67165
    {
      id: 'prod-67165-1',
      pedido_id: 'ped-67165-ref',
      codigo_barra: '7891234560035',
      produto: 'Filtro Combustível Separador Água FS-197',
      locacao: 'R03-P04-N1',
      quantidade: 60,
      saldo: 60,
      created_at: new Date().toISOString(),
    },
    {
      id: 'prod-67165-2',
      pedido_id: 'ped-67165-ref',
      codigo_barra: '7891234560042',
      produto: 'Filtro Hidráulico de Sucção HF-350',
      locacao: 'R03-P05-N2',
      quantidade: 60,
      saldo: 60,
      created_at: new Date().toISOString(),
    },
    // Produtos do Pedido 67184
    {
      id: 'prod-67184-1',
      pedido_id: 'ped-67184-ref',
      codigo_barra: '7896001234567',
      produto: 'Farinha Especial Finíssima 1kg - Fardo c/ 10',
      locacao: 'A-01-01',
      quantidade: 20,
      saldo: 20,
      created_at: new Date().toISOString(),
    },
    {
      id: 'prod-67184-2',
      pedido_id: 'ped-67184-ref',
      codigo_barra: '7898009876543',
      produto: 'Filme Stretch Manual 500mm x 0,025mm Bobina',
      locacao: 'B-01-01',
      quantidade: 15,
      saldo: 15,
      created_at: new Date().toISOString(),
    },
    // Legado PED-10491
    {
      id: 'prod-10491-1',
      pedido_id: 'ped-10491-ref',
      codigo_barra: '7891234560011',
      produto: 'Elemento Filtrante Ar Primário P-550',
      locacao: 'R01-P03-N1',
      quantidade: 24,
      saldo: 24,
      created_at: new Date().toISOString(),
    },
    {
      id: 'prod-10491-2',
      pedido_id: 'ped-10491-ref',
      codigo_barra: '7891234560028',
      produto: 'Filtro Óleo Lubrificante Linha Pesada L-820',
      locacao: 'R02-P01-N2',
      quantidade: 24,
      saldo: 24,
      created_at: new Date().toISOString(),
    }
  ];

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PRODUTOS);
    if (raw) {
      const lista: ProdutoPedido[] = JSON.parse(raw);
      // Garantir que os produtos dos pedidos 67192, 67165 e 67184 existam
      const idsExistentes = new Set(lista.map((p) => p.id));
      let alterou = false;
      for (const prodRef of produtosPadrao) {
        if (!idsExistentes.has(prodRef.id)) {
          lista.push(prodRef);
          idsExistentes.add(prodRef.id);
          alterou = true;
        }
      }
      if (alterou) {
        saveLocalProdutos(lista);
      }
      return lista;
    }
  } catch (err) {
    console.warn('Erro ao ler produtos do localStorage:', err);
  }

  saveLocalProdutos(produtosPadrao);
  return produtosPadrao;
}

function saveLocalProdutos(produtos: ProdutoPedido[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_PRODUTOS, JSON.stringify(produtos));
  } catch (err) {
    console.warn('Erro ao salvar produtos no localStorage:', err);
  }
}

export interface FiltrosPedidos {
  search?: string;
  status?: string;
  dataInicio?: string;
  dataFim?: string;
  separadorId?: string;
  conferenteId?: string;
  unidade_negocio?: string;
}

export const pedidosService = {
  /**
   * Lista todos os pedidos de separação respeitando isolamento por unidade de negócio
   */
  async listarPedidos(filtros?: FiltrosPedidos): Promise<SeparacaoPedido[]> {
    const targetUnit = normalizarUnidadeNegocio(filtros?.unidade_negocio || getActiveUserUnit() || UNIDADE_PADRAO_SISTEMA);
    const unitEquivalents = getUnitEquivalents(targetUnit);

    let pedidos: SeparacaoPedido[] = [];
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('separacao_pedidos')
          .select(SEPARACAO_FIELDS)
          .order('data', { ascending: false })
          .order('created_at', { ascending: false });

        if (unitEquivalents.length === 1) {
          query = query.or(`unidade_negocio.eq.${unitEquivalents[0]},unidade_negocio.is.null`);
        } else {
          query = query.or(`unidade_negocio.in.(${unitEquivalents.join(',')}),unidade_negocio.is.null`);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          pedidos = data as SeparacaoPedido[];
        }
      } catch (err) {
        console.warn('Erro ao consultar separacao_pedidos no Supabase, usando cache local:', err);
      }
    }

    if (pedidos.length === 0) {
      const allLocal = getLocalPedidos();
      pedidos = allLocal.filter((p) => itemMatchesUserUnit(p.unidade_negocio, targetUnit));
    } else {
      // Mesclar pedidos padrão locais (como 67192, 67165 e 67184) caso ainda não estejam gravados no Supabase
      const allLocal = getLocalPedidos();
      const idsExistentes = new Set(pedidos.map((p) => p.id_pedido.toLowerCase()));
      for (const loc of allLocal) {
        if (!idsExistentes.has(loc.id_pedido.toLowerCase()) && itemMatchesUserUnit(loc.unidade_negocio, targetUnit)) {
          pedidos.push(loc);
          idsExistentes.add(loc.id_pedido.toLowerCase());
        }
      }
    }

    // Carregar usuários para enriquecer separador_nome e conferente_nome
    let usuariosMap = new Map<string, string>();
    try {
      const usuarios = await usuariosService.listarTodos();
      usuarios.forEach((u) => {
        usuariosMap.set(u.id, u.nome);
      });
    } catch (e) {
      console.warn('Erro ao obter nomes de usuários para pedidos:', e);
    }

    // Carregar contagem de produtos vinculados
    const produtos = getLocalProdutos();
    const contagemProdutosPorPedido = new Map<string, number>();
    produtos.forEach((prod) => {
      const current = contagemProdutosPorPedido.get(prod.pedido_id) || 0;
      contagemProdutosPorPedido.set(prod.pedido_id, current + 1);
    });

    // Enriquecer campos calculados
    pedidos = pedidos.map((p) => {
      const sepNome = p.separador_id ? usuariosMap.get(p.separador_id) || p.separador_nome : p.separador_nome;
      const confNome = p.conferente_id ? usuariosMap.get(p.conferente_id) || p.conferente_nome : p.conferente_nome;
      const tSep = calcularDiferencaMinutos(p.hora_inicial_separacao, p.hora_final_separacao);
      const tConf = calcularDiferencaMinutos(p.hora_inicial_conferencia, p.hora_final_conferencia);
      const statusOp = determinarStatusOperacional(p);
      const totalProds = contagemProdutosPorPedido.get(p.id) || 0;

      return {
        ...p,
        separador_nome: sepNome || null,
        conferente_nome: confNome || null,
        tempo_separacao_minutos: tSep,
        tempo_conferencia_minutos: tConf,
        status_operacional: statusOp,
        total_produtos_vinculados: totalProds,
      };
    });

    // Filtros adicionais em memória
    if (filtros?.search && filtros.search.trim()) {
      const q = filtros.search.trim().toLowerCase();
      pedidos = pedidos.filter((p) =>
        (p.id_pedido || '').toLowerCase().includes(q) ||
        (p.cliente || '').toLowerCase().includes(q) ||
        (p.codigo_controle || '').toLowerCase().includes(q) ||
        (p.transportador || '').toLowerCase().includes(q) ||
        (p.separador_nome || '').toLowerCase().includes(q) ||
        (p.conferente_nome || '').toLowerCase().includes(q)
      );
    }

    if (filtros?.status && filtros.status !== 'Todos') {
      pedidos = pedidos.filter((p) => p.status_operacional === filtros.status);
    }

    if (filtros?.dataInicio) {
      pedidos = pedidos.filter((p) => p.data >= filtros.dataInicio!);
    }

    if (filtros?.dataFim) {
      pedidos = pedidos.filter((p) => p.data <= filtros.dataFim!);
    }

    if (filtros?.separadorId) {
      pedidos = pedidos.filter((p) => p.separador_id === filtros.separadorId);
    }

    if (filtros?.conferenteId) {
      pedidos = pedidos.filter((p) => p.conferente_id === filtros.conferenteId);
    }

    return pedidos;
  },

  /**
   * Obtém um pedido por seu ID interno
   */
  async obterPedidoPorId(id: string): Promise<SeparacaoPedido | null> {
    const pedidos = await this.listarPedidos();
    return pedidos.find((p) => p.id === id) || null;
  },

  /**
   * Cadastra manualmente um novo pedido.
   * Valida obrigatoriedade de id_pedido e unicidade dentro da mesma unidade_negocio.
   */
  async criarPedido(dados: Omit<SeparacaoPedido, 'id' | 'created_at' | 'updated_at'>): Promise<SeparacaoPedido> {
    const unidade = normalizarUnidadeNegocio(dados.unidade_negocio || getActiveUserUnit() || UNIDADE_PADRAO_SISTEMA);
    const idPedidoLimpo = (dados.id_pedido || '').trim();

    if (!idPedidoLimpo) {
      throw new Error('A identificação do pedido (id_pedido) é obrigatória.');
    }

    // Verificar unicidade dentro da unidade de negócio
    const pedidosExistentes = await this.listarPedidos({ unidade_negocio: unidade });
    const jaExiste = pedidosExistentes.some(
      (p) => p.id_pedido.toLowerCase() === idPedidoLimpo.toLowerCase()
    );

    if (jaExiste) {
      throw new Error(`Já existe um pedido cadastrado com o número "${idPedidoLimpo}" na unidade ${unidade}.`);
    }

    const agora = new Date().toISOString();
    const novoPedido: SeparacaoPedido = {
      id: generateUUID(),
      id_pedido: idPedidoLimpo,
      unidade_negocio: unidade,
      data: dados.data || agora.split('T')[0],
      codigo_controle: (dados.codigo_controle || '').trim(),
      cliente: (dados.cliente || '').trim(),
      transportador: (dados.transportador || '').trim(),
      quantidade_itens: Number(dados.quantidade_itens) || 0,
      separador_id: dados.separador_id || null,
      separador_nome: dados.separador_nome || null,
      hora_inicial_separacao: dados.hora_inicial_separacao || null,
      hora_final_separacao: dados.hora_final_separacao || null,
      conferente_id: dados.conferente_id || null,
      conferente_nome: dados.conferente_nome || null,
      hora_inicial_conferencia: dados.hora_inicial_conferencia || null,
      hora_final_conferencia: dados.hora_final_conferencia || null,
      created_at: agora,
      updated_at: agora,
    };

    // Tentar persistir no Supabase se disponível
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const payload = {
          id: novoPedido.id,
          id_pedido: novoPedido.id_pedido,
          unidade_negocio: novoPedido.unidade_negocio,
          data: novoPedido.data,
          codigo_controle: novoPedido.codigo_controle,
          cliente: novoPedido.cliente,
          transportador: novoPedido.transportador,
          quantidade_itens: novoPedido.quantidade_itens,
          separador_id: novoPedido.separador_id,
          hora_inicial_separacao: novoPedido.hora_inicial_separacao,
          hora_final_separacao: novoPedido.hora_final_separacao,
          conferente_id: novoPedido.conferente_id,
          hora_inicial_conferencia: novoPedido.hora_inicial_conferencia,
          hora_final_conferencia: novoPedido.hora_final_conferencia,
        };

        const { data, error } = await supabase
          .from('separacao_pedidos')
          .insert(payload)
          .select(SEPARACAO_FIELDS)
          .single();

        if (!error && data) {
          novoPedido.id = data.id;
        }
      } catch (err) {
        console.warn('Erro ao salvar no Supabase (separacao_pedidos), mantendo cópia local:', err);
      }
    }

    // Salvar localmente
    const all = getLocalPedidos();
    all.unshift(novoPedido);
    saveLocalPedidos(all);

    return novoPedido;
  },

  /**
   * Atualiza os dados de um pedido existente
   */
  async atualizarPedido(id: string, dados: Partial<SeparacaoPedido>): Promise<SeparacaoPedido> {
    const all = getLocalPedidos();
    const index = all.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error('Pedido não encontrado para atualização.');
    }

    const atual = all[index];
    const unidade = normalizarUnidadeNegocio(dados.unidade_negocio || atual.unidade_negocio || getActiveUserUnit() || UNIDADE_PADRAO_SISTEMA);

    // Se o id_pedido estiver sendo alterado, validar unicidade
    if (dados.id_pedido && dados.id_pedido.trim().toLowerCase() !== atual.id_pedido.toLowerCase()) {
      const jaExiste = all.some(
        (p) => p.id !== id &&
               p.id_pedido.toLowerCase() === dados.id_pedido!.trim().toLowerCase() &&
               itemMatchesUserUnit(p.unidade_negocio, unidade)
      );
      if (jaExiste) {
        throw new Error(`O número de pedido "${dados.id_pedido}" já está sendo utilizado por outro pedido nesta unidade.`);
      }
    }

    const agora = new Date().toISOString();
    const atualizado: SeparacaoPedido = {
      ...atual,
      ...dados,
      id,
      unidade_negocio: unidade,
      quantidade_itens: dados.quantidade_itens !== undefined ? Number(dados.quantidade_itens) : atual.quantidade_itens,
      updated_at: agora,
    };

    // Atualizar no Supabase
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const payload = {
          id_pedido: atualizado.id_pedido,
          unidade_negocio: atualizado.unidade_negocio,
          data: atualizado.data,
          codigo_controle: atualizado.codigo_controle,
          cliente: atualizado.cliente,
          transportador: atualizado.transportador,
          quantidade_itens: atualizado.quantidade_itens,
          separador_id: atualizado.separador_id,
          hora_inicial_separacao: atualizado.hora_inicial_separacao,
          hora_final_separacao: atualizado.hora_final_separacao,
          conferente_id: atualizado.conferente_id,
          hora_inicial_conferencia: atualizado.hora_inicial_conferencia,
          hora_final_conferencia: atualizado.hora_final_conferencia,
          updated_at: agora,
        };

        await supabase
          .from('separacao_pedidos')
          .update(payload)
          .eq('id', id);
      } catch (err) {
        console.warn('Erro ao atualizar separacao_pedidos no Supabase:', err);
      }
    }

    all[index] = atualizado;
    saveLocalPedidos(all);

    return atualizado;
  },

  /**
   * Preenchimento operacional rápido (Separador, Conferente e Horários) diretamente na listagem
   */
  async atualizarDadosOperacionais(
    id: string,
    dadosOperacionais: {
      separador_id?: string | null;
      hora_inicial_separacao?: string | null;
      hora_final_separacao?: string | null;
      conferente_id?: string | null;
      hora_inicial_conferencia?: string | null;
      hora_final_conferencia?: string | null;
    }
  ): Promise<SeparacaoPedido> {
    return this.atualizarPedido(id, dadosOperacionais);
  },

  /**
   * Remove um pedido e todos os seus produtos vinculados
   */
  async excluirPedido(id: string): Promise<void> {
    // 1. Excluir produtos do pedido
    const prods = getLocalProdutos().filter((p) => p.pedido_id !== id);
    saveLocalProdutos(prods);

    // 2. Excluir pedido
    const all = getLocalPedidos().filter((p) => p.id !== id);
    saveLocalPedidos(all);

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('produtos_pedido').delete().eq('pedido_id', id);
        await supabase.from('separacao_pedidos').delete().eq('id', id);
      } catch (err) {
        console.warn('Erro ao excluir no Supabase:', err);
      }
    }
  },

  /**
   * Importação de pedidos em lote via Excel.
   * Traz SOMENTE os dados do pedido. Os dados operacionais ficam em branco para preenchimento posterior.
   * Não duplica pedidos com mesmo id_pedido dentro da mesma unidade de negócio.
   */
  async importarPedidosEmLote(
    linhas: Array<Record<string, any>>,
    unidadeNegocio?: string
  ): Promise<{
    sucesso: number;
    duplicados: number;
    erros: string[];
    pedidosInseridos: SeparacaoPedido[];
  }> {
    const unidade = normalizarUnidadeNegocio(unidadeNegocio || getActiveUserUnit() || UNIDADE_PADRAO_SISTEMA);
    const pedidosExistentes = await this.listarPedidos({ unidade_negocio: unidade });
    const idsExistentes = new Set(pedidosExistentes.map((p) => p.id_pedido.toLowerCase().trim()));

    const erros: string[] = [];
    const paraInserir: SeparacaoPedido[] = [];
    let duplicados = 0;
    const agora = new Date().toISOString();

    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i];
      const linhaNumero = i + 2; // +2 por causa do cabeçalho da planilha

      // Normalizar chaves para busca flexível
      const getVal = (...chaves: string[]) => {
        for (const k of chaves) {
          for (const key in linha) {
            if (key.toLowerCase().trim() === k.toLowerCase().trim()) {
              return linha[key];
            }
          }
        }
        return undefined;
      };

      const id_pedido = String(getVal('id_pedido', 'id pedido', 'pedido', 'numero_pedido', 'numero pedido', 'ped') || '').trim();
      if (!id_pedido) {
        erros.push(`Linha ${linhaNumero}: O campo "id_pedido" está em branco.`);
        continue;
      }

      if (idsExistentes.has(id_pedido.toLowerCase())) {
        duplicados++;
        continue;
      }

      // Evita duplicatas dentro do próprio arquivo Excel
      idsExistentes.add(id_pedido.toLowerCase());

      const dataVal = getVal('data', 'data_pedido', 'data pedido', 'dt');
      let dataFinal = agora.split('T')[0];
      if (dataVal) {
        if (typeof dataVal === 'number') {
          // Serial date de Excel
          const dateObj = new Date(Math.round((dataVal - 25569) * 86400 * 1000));
          if (!isNaN(dateObj.getTime())) {
            dataFinal = dateObj.toISOString().split('T')[0];
          }
        } else {
          const str = String(dataVal).trim();
          if (str.includes('/')) {
            const parts = str.split('/');
            if (parts.length === 3) {
              dataFinal = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          } else if (str.length >= 10) {
            dataFinal = str.slice(0, 10);
          }
        }
      }

      const codigo_controle = String(getVal('codigo_controle', 'codigo controle', 'controle', 'cod_controle') || '').trim();
      const cliente = String(getVal('cliente', 'nome_cliente', 'nome cliente', 'destinatario') || 'Cliente Não Informado').trim();
      const transportador = String(getVal('transportador', 'transportadora', 'transporte', 'transp') || 'Transportador Não Informado').trim();
      const quantidade_itens = Number(getVal('quantidade_itens', 'quantidade itens', 'quantidade', 'qtd', 'itens') || 0);

      const novo: SeparacaoPedido = {
        id: generateUUID(),
        id_pedido,
        unidade_negocio: unidade,
        data: dataFinal,
        codigo_controle,
        cliente,
        transportador,
        quantidade_itens: isNaN(quantidade_itens) ? 0 : quantidade_itens,
        separador_id: null,
        separador_nome: null,
        hora_inicial_separacao: null,
        hora_final_separacao: null,
        conferente_id: null,
        conferente_nome: null,
        hora_inicial_conferencia: null,
        hora_final_conferencia: null,
        created_at: agora,
        updated_at: agora,
      };

      paraInserir.push(novo);
    }

    if (paraInserir.length > 0) {
      // Salvar no Supabase
      const supabase = getSupabase();
      if (isSupabaseConfigured && supabase) {
        try {
          const payloads = paraInserir.map((p) => ({
            id: p.id,
            id_pedido: p.id_pedido,
            unidade_negocio: p.unidade_negocio,
            data: p.data,
            codigo_controle: p.codigo_controle,
            cliente: p.cliente,
            transportador: p.transportador,
            quantidade_itens: p.quantidade_itens,
          }));

          await supabase.from('separacao_pedidos').insert(payloads);
        } catch (err) {
          console.warn('Erro ao inserir pedidos em lote no Supabase:', err);
        }
      }

      // Salvar localmente
      const all = getLocalPedidos();
      saveLocalPedidos([...paraInserir, ...all]);
    }

    return {
      sucesso: paraInserir.length,
      duplicados,
      erros,
      pedidosInseridos: paraInserir,
    };
  },

  // -------------------------------------------------------------
  // ABA 2 — PRODUTOS DO PEDIDO
  // -------------------------------------------------------------

  /**
   * Lista os produtos vinculados estritamente ao pedido selecionado
   */
  async listarProdutosDoPedido(pedido_id: string): Promise<ProdutoPedido[]> {
    if (!pedido_id) return [];

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('produtos_pedido')
          .select(PRODUTO_PEDIDO_FIELDS)
          .eq('pedido_id', pedido_id)
          .order('produto', { ascending: true });

        if (!error && data && data.length > 0) {
          return data as ProdutoPedido[];
        }
      } catch (err) {
        console.warn('Erro ao consultar produtos_pedido no Supabase:', err);
      }
    }

    const all = getLocalProdutos();
    return all.filter((p) => p.pedido_id === pedido_id);
  },

  /**
   * Adiciona um produto manual a um pedido
   */
  async adicionarProdutoAoPedido(dados: Omit<ProdutoPedido, 'id' | 'created_at'>): Promise<ProdutoPedido> {
    if (!dados.pedido_id) {
      throw new Error('O ID do pedido é obrigatório para cadastrar um produto.');
    }

    const agora = new Date().toISOString();
    const novoProduto: ProdutoPedido = {
      id: generateUUID(),
      pedido_id: dados.pedido_id,
      codigo_barra: (dados.codigo_barra || '').trim(),
      produto: (dados.produto || '').trim(),
      locacao: (dados.locacao || '').trim(),
      quantidade: Number(dados.quantidade) || 0,
      saldo: Number(dados.saldo ?? dados.quantidade) || 0,
      created_at: agora,
    };

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('produtos_pedido').insert({
          id: novoProduto.id,
          pedido_id: novoProduto.pedido_id,
          codigo_barra: novoProduto.codigo_barra,
          produto: novoProduto.produto,
          locacao: novoProduto.locacao,
          quantidade: novoProduto.quantidade,
          saldo: novoProduto.saldo,
        });
      } catch (err) {
        console.warn('Erro ao inserir produto no Supabase:', err);
      }
    }

    const all = getLocalProdutos();
    all.push(novoProduto);
    saveLocalProdutos(all);

    return novoProduto;
  },

  /**
   * Atualiza um produto do pedido
   */
  async atualizarProdutoDoPedido(id: string, dados: Partial<ProdutoPedido>): Promise<ProdutoPedido> {
    const all = getLocalProdutos();
    const index = all.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error('Produto não encontrado para atualização.');
    }

    const atual = all[index];
    const atualizado: ProdutoPedido = {
      ...atual,
      ...dados,
      id,
      quantidade: dados.quantidade !== undefined ? Number(dados.quantidade) : atual.quantidade,
      saldo: dados.saldo !== undefined ? Number(dados.saldo) : atual.saldo,
    };

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('produtos_pedido')
          .update({
            codigo_barra: atualizado.codigo_barra,
            produto: atualizado.produto,
            locacao: atualizado.locacao,
            quantidade: atualizado.quantidade,
            saldo: atualizado.saldo,
          })
          .eq('id', id);
      } catch (err) {
        console.warn('Erro ao atualizar produto no Supabase:', err);
      }
    }

    all[index] = atualizado;
    saveLocalProdutos(all);

    return atualizado;
  },

  /**
   * Remove um produto do pedido
   */
  async excluirProdutoDoPedido(id: string): Promise<void> {
    const all = getLocalProdutos().filter((p) => p.id !== id);
    saveLocalProdutos(all);

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('produtos_pedido').delete().eq('id', id);
      } catch (err) {
        console.warn('Erro ao excluir produto no Supabase:', err);
      }
    }
  },

  /**
   * Importação de produtos do pedido via Excel.
   * REGRA OBRIGATÓRIA:
   * Se o usuário tentar importar produtos para um pedido que não existe na tabela de separação:
   * → BLOQUEAR a importação e informar claramente que o pedido precisa ser cadastrado/importado primeiro.
   */
  async importarProdutosDoPedidoEmLote(
    pedidoIdAlvo: string,
    linhas: Array<Record<string, any>>,
    idPedidoVisualEsperado?: string
  ): Promise<{
    sucesso: number;
    erros: string[];
    produtosInseridos: ProdutoPedido[];
  }> {
    // 1. Validar que o pedido existe
    const pedidos = await this.listarPedidos();
    let pedidoAlvo = pedidos.find((p) => p.id === pedidoIdAlvo);

    // Se o pedido não foi localizado pelo ID interno, tentar pelo id_pedido visual
    if (!pedidoAlvo && idPedidoVisualEsperado) {
      pedidoAlvo = pedidos.find(
        (p) => p.id_pedido.toLowerCase().trim() === idPedidoVisualEsperado.toLowerCase().trim()
      );
    }

    if (!pedidoAlvo) {
      throw new Error(
        'BLOQUEIO DE IMPORTAÇÃO: O pedido correspondente não foi encontrado na tabela de separação. O pedido precisa ser cadastrado ou importado antes de importar seus produtos.'
      );
    }

    const erros: string[] = [];
    const paraInserir: ProdutoPedido[] = [];
    const agora = new Date().toISOString();

    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i];
      const linhaNumero = i + 2;

      const getVal = (...chaves: string[]) => {
        for (const k of chaves) {
          for (const key in linha) {
            if (key.toLowerCase().trim() === k.toLowerCase().trim()) {
              return linha[key];
            }
          }
        }
        return undefined;
      };

      // Se a planilha possuir coluna de pedido, checar se bate com o pedido selecionado
      const pedPlanilha = getVal('pedido', 'id_pedido', 'id pedido');
      if (pedPlanilha && String(pedPlanilha).trim().toLowerCase() !== pedidoAlvo.id_pedido.toLowerCase()) {
        erros.push(
          `Linha ${linhaNumero}: O produto pertence ao pedido "${pedPlanilha}", divergente do pedido selecionado "${pedidoAlvo.id_pedido}".`
        );
        continue;
      }

      const produtoNome = String(getVal('produto', 'descricao', 'nome_produto', 'desc') || '').trim();
      if (!produtoNome) {
        erros.push(`Linha ${linhaNumero}: A descrição do produto está em branco.`);
        continue;
      }

      const codigo_barra = String(getVal('codigo_barra', 'codigo_barras', 'codigo barras', 'ean', 'gtin', 'cod_barra') || '').trim();
      const locacao = String(getVal('locacao', 'endereco', 'posicao', 'localizacao') || 'G-01').trim();
      const quantidade = Number(getVal('quantidade', 'qtd', 'quantidade_itens', 'itens') || 1);
      const saldoVal = getVal('saldo', 'saldo_restante');
      const saldo = saldoVal !== undefined ? Number(saldoVal) : quantidade;

      const prod: ProdutoPedido = {
        id: generateUUID(),
        pedido_id: pedidoAlvo.id,
        codigo_barra,
        produto: produtoNome,
        locacao,
        quantidade: isNaN(quantidade) ? 1 : quantidade,
        saldo: isNaN(saldo) ? (isNaN(quantidade) ? 1 : quantidade) : saldo,
        created_at: agora,
      };

      paraInserir.push(prod);
    }

    if (paraInserir.length > 0) {
      const supabase = getSupabase();
      if (isSupabaseConfigured && supabase) {
        try {
          const payloads = paraInserir.map((p) => ({
            id: p.id,
            pedido_id: p.pedido_id,
            codigo_barra: p.codigo_barra,
            produto: p.produto,
            locacao: p.locacao,
            quantidade: p.quantidade,
            saldo: p.saldo,
          }));

          await supabase.from('produtos_pedido').insert(payloads);
        } catch (err) {
          console.warn('Erro ao inserir produtos no Supabase:', err);
        }
      }

      const all = getLocalProdutos();
      saveLocalProdutos([...all, ...paraInserir]);
    }

    return {
      sucesso: paraInserir.length,
      erros,
      produtosInseridos: paraInserir,
    };
  },

  // -------------------------------------------------------------
  // ABA 4 — KPIS E INDICADORES DE PRODUTIVIDADE
  // -------------------------------------------------------------

  /**
   * Calcula os indicadores de produtividade e KPIs do processo de separação e conferência
   */
  async calcularIndicadores(filtros?: {
    unidade_negocio?: string;
    dataInicio?: string;
    dataFim?: string;
  }) {
    const pedidos = await this.listarPedidos(filtros);

    const totalPedidos = pedidos.length;
    let totalItens = 0;
    let concluidos = 0;
    let emConferencia = 0;
    let separados = 0;
    let emSeparacao = 0;
    let pendentes = 0;

    let somaMinutosSeparacao = 0;
    let contagemSeparacoesComTempo = 0;

    let somaMinutosConferencia = 0;
    let contagemConferenciasComTempo = 0;

    // Produtividade por Separador
    const separadoresMap = new Map<string, {
      nome: string;
      pedidos: number;
      itens: number;
      minutosTotais: number;
      temposRegistrados: number;
    }>();

    // Produtividade por Conferente
    const conferentesMap = new Map<string, {
      nome: string;
      pedidos: number;
      itens: number;
      minutosTotais: number;
      temposRegistrados: number;
    }>();

    // Distribuição por Transportador
    const transportadoresMap = new Map<string, { transportador: string; pedidos: number; itens: number }>();

    pedidos.forEach((p) => {
      totalItens += p.quantidade_itens || 0;

      // Status
      switch (p.status_operacional) {
        case 'Concluído':
          concluidos++;
          break;
        case 'Em Conferência':
          emConferencia++;
          break;
        case 'Separado':
          separados++;
          break;
        case 'Em Separação':
          emSeparacao++;
          break;
        default:
          pendentes++;
          break;
      }

      // Tempos gerais
      if (p.tempo_separacao_minutos !== null && p.tempo_separacao_minutos !== undefined && p.tempo_separacao_minutos >= 0) {
        somaMinutosSeparacao += p.tempo_separacao_minutos;
        contagemSeparacoesComTempo++;
      }

      if (p.tempo_conferencia_minutos !== null && p.tempo_conferencia_minutos !== undefined && p.tempo_conferencia_minutos >= 0) {
        somaMinutosConferencia += p.tempo_conferencia_minutos;
        contagemConferenciasComTempo++;
      }

      // Agrupamento por Separador
      if (p.separador_nome) {
        const key = p.separador_id || p.separador_nome;
        const cur = separadoresMap.get(key) || {
          nome: p.separador_nome,
          pedidos: 0,
          itens: 0,
          minutosTotais: 0,
          temposRegistrados: 0,
        };
        cur.pedidos++;
        cur.itens += p.quantidade_itens || 0;
        if (p.tempo_separacao_minutos !== null && p.tempo_separacao_minutos !== undefined && p.tempo_separacao_minutos >= 0) {
          cur.minutosTotais += p.tempo_separacao_minutos;
          cur.temposRegistrados++;
        }
        separadoresMap.set(key, cur);
      }

      // Agrupamento por Conferente
      if (p.conferente_nome) {
        const key = p.conferente_id || p.conferente_nome;
        const cur = conferentesMap.get(key) || {
          nome: p.conferente_nome,
          pedidos: 0,
          itens: 0,
          minutosTotais: 0,
          temposRegistrados: 0,
        };
        cur.pedidos++;
        cur.itens += p.quantidade_itens || 0;
        if (p.tempo_conferencia_minutos !== null && p.tempo_conferencia_minutos !== undefined && p.tempo_conferencia_minutos >= 0) {
          cur.minutosTotais += p.tempo_conferencia_minutos;
          cur.temposRegistrados++;
        }
        conferentesMap.set(key, cur);
      }

      // Agrupamento por Transportador
      if (p.transportador) {
        const t = transportadoresMap.get(p.transportador) || { transportador: p.transportador, pedidos: 0, itens: 0 };
        t.pedidos++;
        t.itens += p.quantidade_itens || 0;
        transportadoresMap.set(p.transportador, t);
      }
    });

    const totalHorasSeparacao = somaMinutosSeparacao > 0 ? somaMinutosSeparacao / 60 : 0;
    const totalHorasConferencia = somaMinutosConferencia > 0 ? somaMinutosConferencia / 60 : 0;

    const tempoMedioSeparacao = contagemSeparacoesComTempo > 0
      ? Math.round(somaMinutosSeparacao / contagemSeparacoesComTempo)
      : null;

    const tempoMedioConferencia = contagemConferenciasComTempo > 0
      ? Math.round(somaMinutosConferencia / contagemConferenciasComTempo)
      : null;

    const produtividadeSeparadores = Array.from(separadoresMap.values()).map((s) => {
      const horas = s.minutosTotais > 0 ? s.minutosTotais / 60 : 0;
      const qtdPorHoraFloat = horas > 0 ? Number((s.itens / horas).toFixed(2)) : (s.minutosTotais === 0 && s.itens > 0 ? s.itens : 0);
      return {
        ...s,
        tempoMedioMinutos: s.temposRegistrados > 0 ? Math.round(s.minutosTotais / s.temposRegistrados) : 0,
        itensPorHora: Math.round(qtdPorHoraFloat),
        qtdPorHoraFloat,
      };
    }).sort((a, b) => b.itens - a.itens);

    const produtividadeConferentes = Array.from(conferentesMap.values()).map((c) => {
      const horas = c.minutosTotais > 0 ? c.minutosTotais / 60 : 0;
      const qtdPorHoraFloat = horas > 0 ? Number((c.itens / horas).toFixed(2)) : (c.minutosTotais === 0 && c.itens > 0 ? c.itens : 0);
      return {
        ...c,
        tempoMedioMinutos: c.temposRegistrados > 0 ? Math.round(c.minutosTotais / c.temposRegistrados) : 0,
        itensPorHora: Math.round(qtdPorHoraFloat),
        qtdPorHoraFloat,
      };
    }).sort((a, b) => b.itens - a.itens);

    const itensSeparadosComTempo = Array.from(separadoresMap.values())
      .filter((s) => s.minutosTotais > 0)
      .reduce((sum, s) => sum + s.itens, 0);

    const itensConferidosComTempo = Array.from(conferentesMap.values())
      .filter((c) => c.minutosTotais > 0)
      .reduce((sum, c) => sum + c.itens, 0);

    const produtividadeMediaSeparacaoQtdHora = totalHorasSeparacao > 0
      ? Number((itensSeparadosComTempo / totalHorasSeparacao).toFixed(2))
      : (produtividadeSeparadores.length > 0
          ? Number((produtividadeSeparadores.reduce((acc, cur) => acc + cur.qtdPorHoraFloat, 0) / produtividadeSeparadores.length).toFixed(2))
          : 0);

    const produtividadeMediaConferenciaQtdHora = totalHorasConferencia > 0
      ? Number((itensConferidosComTempo / totalHorasConferencia).toFixed(2))
      : (produtividadeConferentes.length > 0
          ? Number((produtividadeConferentes.reduce((acc, cur) => acc + cur.qtdPorHoraFloat, 0) / produtividadeConferentes.length).toFixed(2))
          : 0);

    const rankingTransportadores = Array.from(transportadoresMap.values())
      .sort((a, b) => b.pedidos - a.pedidos);

    return {
      totalPedidos,
      totalItens,
      concluidos,
      emConferencia,
      separados,
      emSeparacao,
      pendentes,
      taxaConclusao: totalPedidos > 0 ? Math.round((concluidos / totalPedidos) * 100) : 0,
      tempoMedioSeparacao,
      tempoMedioConferencia,
      totalHorasSeparacao,
      totalHorasConferencia,
      produtividadeMediaSeparacaoQtdHora,
      produtividadeMediaConferenciaQtdHora,
      produtividadeSeparadores,
      produtividadeConferentes,
      rankingTransportadores,
    };
  },

  // -------------------------------------------------------------
  // UTILITÁRIOS EXCEL: MODELOS DE PLANILHA PARA DOWNLOAD
  // -------------------------------------------------------------

  /**
   * Gera e dispara download da planilha modelo para Importação de Pedidos
   */
  baixarModeloExcelPedidos(): void {
    const dadosModelo = [
      {
        id_pedido: 'PED-10500',
        data: new Date().toISOString().split('T')[0],
        codigo_controle: 'CTR-9010',
        cliente: 'Comercial de Filtros Goiânia',
        transportador: 'Braspress Transportes',
        quantidade_itens: 45,
      },
      {
        id_pedido: 'PED-10501',
        data: new Date().toISOString().split('T')[0],
        codigo_controle: 'CTR-9011',
        cliente: 'Mato Grosso Peças e Serviços',
        transportador: 'Jadlog Logística',
        quantidade_itens: 82,
      },
      {
        id_pedido: 'PED-10502',
        data: new Date().toISOString().split('T')[0],
        codigo_controle: 'CTR-9012',
        cliente: 'Distribuidora São Paulo S/A',
        transportador: 'TNT Mercúrio',
        quantidade_itens: 15,
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(dadosModelo);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pedidos');

    // Auto-width colunas
    worksheet['!cols'] = [
      { wch: 16 }, // id_pedido
      { wch: 14 }, // data
      { wch: 18 }, // codigo_controle
      { wch: 32 }, // cliente
      { wch: 26 }, // transportador
      { wch: 18 }, // quantidade_itens
    ];

    XLSX.writeFile(workbook, 'modelo_importacao_pedidos_polihub.xlsx');
  },

  /**
   * Gera e dispara download da planilha modelo para Importação de Produtos do Pedido
   */
  baixarModeloExcelProdutos(idPedidoExemplo: string = 'PED-10500'): void {
    const dadosModelo = [
      {
        pedido: idPedidoExemplo,
        codigo_barra: '7891234560011',
        produto: 'Elemento Filtrante Ar Primário P-550',
        locacao: 'R01-P03-N1',
        quantidade: 15,
        saldo: 15,
      },
      {
        pedido: idPedidoExemplo,
        codigo_barra: '7891234560028',
        produto: 'Filtro Óleo Lubrificante Linha Pesada L-820',
        locacao: 'R02-P01-N2',
        quantidade: 20,
        saldo: 20,
      },
      {
        pedido: idPedidoExemplo,
        codigo_barra: '7891234560035',
        produto: 'Filtro Combustível Separador Água FS-197',
        locacao: 'R03-P04-N1',
        quantidade: 10,
        saldo: 10,
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(dadosModelo);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Produtos');

    worksheet['!cols'] = [
      { wch: 16 }, // pedido
      { wch: 20 }, // codigo_barra
      { wch: 42 }, // produto
      { wch: 16 }, // locacao
      { wch: 14 }, // quantidade
      { wch: 12 }, // saldo
    ];

    XLSX.writeFile(workbook, `modelo_produtos_${idPedidoExemplo.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
  }
};
