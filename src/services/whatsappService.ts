import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import {
  WhatsAppCanal,
  WhatsAppContato,
  WhatsAppFila,
  WhatsAppMensagemAutomatica,
  WhatsAppUsuarioHabilitado,
  WhatsAppConversa,
  WhatsAppMensagem,
  WhatsAppHistoricoAcao,
  WhatsAppBadgeStatus,
  Usuario,
} from '../types';
import {
  getLocalWhatsAppCanais,
  saveLocalWhatsAppCanais,
  getLocalWhatsAppContatos,
  saveLocalWhatsAppContatos,
  getLocalWhatsAppFilas,
  saveLocalWhatsAppFilas,
  getLocalWhatsAppMensagensAuto,
  saveLocalWhatsAppMensagensAuto,
  getLocalWhatsAppUsuariosHabilitados,
  saveLocalWhatsAppUsuariosHabilitados,
  getLocalWhatsAppConversas,
  saveLocalWhatsAppConversas,
  getLocalWhatsAppMensagens,
  saveLocalWhatsAppMensagens,
  getLocalWhatsAppHistorico,
  saveLocalWhatsAppHistorico,
} from './mockStorage';
import { isUserGestor, isUserLogistica } from '../lib/permissions';

/**
 * Master Switch para ativação/desativação do Módulo WhatsApp Business.
 * Atualmente DESATIVADO conforme solicitação do usuário.
 * Preserva 100% da implementação para futura reativação.
 */
export const WHATSAPP_SERVICE_ENABLED = false;

/**
 * Dispara evento global de atualização em tempo real para sincronizar
 * badge no cabeçalho e listas de conversas sem polling agressivo.
 */
export function notificarAtualizacaoWhatsApp() {
  if (!WHATSAPP_SERVICE_ENABLED) return;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('polihub_whatsapp_update'));
  }
}

/**
 * Limpa e padroniza número de telefone para formato E.164.
 * Ex: "(62) 99123-4567" -> "+5562991234567"
 */
export function normalizarNumeroWhatsApp(tel: string): string {
  if (!tel) return '';
  const digits = tel.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    return `+${digits}`;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }
  if (digits.startsWith('0')) {
    return `+55${digits.slice(1)}`;
  }
  return `+${digits}`;
}

/**
 * Formata telefone para exibição legível no padrão brasileiro.
 */
export function formatarTelefoneExibicao(tel?: string | null): string {
  if (!tel) return '';
  const limpo = tel.replace(/\D/g, '');
  if (limpo.length === 13 && limpo.startsWith('55')) {
    // +55 (DD) 9XXXX-XXXX
    return `+55 (${limpo.slice(2, 4)}) ${limpo.slice(4, 9)}-${limpo.slice(9)}`;
  }
  if (limpo.length === 11) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
  }
  if (limpo.length === 10) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
  }
  return tel;
}

/**
 * Verifica se o momento atual está dentro do horário de atendimento configurado.
 */
export function isDentroDoHorario(
  horarioInicio = '08:00',
  horarioFim = '18:00',
  diasFuncionamento = ['seg', 'ter', 'qua', 'qui', 'sex']
): boolean {
  try {
    const agora = new Date();
    const diaSemanaMap = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    const diaAtual = diaSemanaMap[agora.getDay()];

    if (!diasFuncionamento.includes(diaAtual)) {
      return false;
    }

    const [horaIni, minIni] = horarioInicio.split(':').map(Number);
    const [horaFim, minFim] = horarioFim.split(':').map(Number);

    const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
    const minutosInicio = (horaIni || 8) * 60 + (minIni || 0);
    const minutosTermino = (horaFim || 18) * 60 + (minFim || 0);

    return minutosAgora >= minutosInicio && minutosAgora <= minutosTermino;
  } catch {
    return true;
  }
}

export const whatsappService = {
  // ---------------------------------------------------------------------------
  // 1. CANAIS E NÚMEROS DE ATENDIMENTO
  // ---------------------------------------------------------------------------
  async listarCanais(unidade?: string): Promise<WhatsAppCanal[]> {
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('whatsapp_canais')
          .select('id, nome, numero_telefone, unidade_negocio, meta_phone_number_id, meta_waba_id, status_conexao, horario_inicio, horario_fim, dias_funcionamento, mensagem_fora_horario, ativo, created_at, updated_at')
          .order('nome', { ascending: true });

        if (unidade) {
          query = query.eq('unidade_negocio', unidade);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data as WhatsAppCanal[];
        }
      } catch (e) {
        console.warn('[WhatsAppService] Fallback ao listar canais:', e);
      }
    }

    const local = getLocalWhatsAppCanais();
    if (unidade) {
      return local.filter((c) => c.unidade_negocio.toLowerCase() === unidade.toLowerCase());
    }
    return local;
  },

  async salvarCanal(canal: Partial<WhatsAppCanal>): Promise<WhatsAppCanal> {
    const supabase = getSupabase();
    const agora = new Date().toISOString();
    const id = canal.id || `canal-${Date.now()}`;
    const payload: WhatsAppCanal = {
      id,
      nome: canal.nome || 'Canal WhatsApp',
      numero_telefone: normalizarNumeroWhatsApp(canal.numero_telefone || ''),
      unidade_negocio: canal.unidade_negocio || 'Goiânia',
      meta_phone_number_id: canal.meta_phone_number_id || null,
      meta_waba_id: canal.meta_waba_id || null,
      meta_access_token: canal.meta_access_token || null,
      meta_webhook_verify_token: canal.meta_webhook_verify_token || null,
      meta_app_id: canal.meta_app_id || null,
      status_conexao: canal.status_conexao || 'pendente',
      horario_inicio: canal.horario_inicio || '08:00',
      horario_fim: canal.horario_fim || '18:00',
      dias_funcionamento: canal.dias_funcionamento || ['seg', 'ter', 'qua', 'qui', 'sex'],
      mensagem_fora_horario: canal.mensagem_fora_horario || null,
      ativo: canal.ativo !== undefined ? canal.ativo : true,
      created_at: canal.created_at || agora,
      updated_at: agora,
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('whatsapp_canais')
          .upsert(payload)
          .select('id, nome, numero_telefone, unidade_negocio, meta_phone_number_id, meta_waba_id, status_conexao, horario_inicio, horario_fim, dias_funcionamento, mensagem_fora_horario, ativo, created_at, updated_at')
          .single();

        if (!error && data) {
          notificarAtualizacaoWhatsApp();
          return data as WhatsAppCanal;
        }
      } catch (e) {
        console.warn('[WhatsAppService] Fallback ao salvar canal:', e);
      }
    }

    const local = getLocalWhatsAppCanais();
    const idx = local.findIndex((c) => c.id === payload.id);
    if (idx >= 0) {
      local[idx] = payload;
    } else {
      local.unshift(payload);
    }
    saveLocalWhatsAppCanais(local);
    notificarAtualizacaoWhatsApp();
    return payload;
  },

  async excluirCanal(id: string): Promise<boolean> {
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('whatsapp_canais').delete().eq('id', id);
        if (!error) {
          notificarAtualizacaoWhatsApp();
          return true;
        }
      } catch (e) {
        console.warn('[WhatsAppService] Fallback ao excluir canal:', e);
      }
    }

    const local = getLocalWhatsAppCanais().filter((c) => c.id !== id);
    saveLocalWhatsAppCanais(local);
    notificarAtualizacaoWhatsApp();
    return true;
  },

  // ---------------------------------------------------------------------------
  // 2. CONTATOS INTELIGENTES
  // ---------------------------------------------------------------------------
  async listarContatos(unidade?: string): Promise<WhatsAppContato[]> {
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('whatsapp_contatos')
          .select('id, telefone, nome, tipo_contato, departamento_relacionado, unidade_negocio, colaborador_vinculado_id, colaborador_vinculado_nome, regra_atendimento, mensagem_personalizada, ativo, created_at, updated_at')
          .order('nome', { ascending: true });

        if (unidade) {
          query = query.eq('unidade_negocio', unidade);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data as WhatsAppContato[];
        }
      } catch (e) {
        console.warn('[WhatsAppService] Fallback ao listar contatos:', e);
      }
    }

    const local = getLocalWhatsAppContatos();
    if (unidade) {
      return local.filter((c) => !c.unidade_negocio || c.unidade_negocio.toLowerCase() === unidade.toLowerCase());
    }
    return local;
  },

  async salvarContato(contato: Partial<WhatsAppContato>): Promise<WhatsAppContato> {
    const supabase = getSupabase();
    const agora = new Date().toISOString();
    const id = contato.id || `ctt-${Date.now()}`;
    const payload: WhatsAppContato = {
      id,
      telefone: normalizarNumeroWhatsApp(contato.telefone || ''),
      nome: contato.nome || 'Contato',
      tipo_contato: contato.tipo_contato || 'desconhecido',
      departamento_relacionado: contato.departamento_relacionado || 'Logística',
      unidade_negocio: contato.unidade_negocio || null,
      colaborador_vinculado_id: contato.colaborador_vinculado_id || null,
      colaborador_vinculado_nome: contato.colaborador_vinculado_nome || null,
      regra_atendimento: contato.regra_atendimento || 'padrao',
      mensagem_personalizada: contato.mensagem_personalizada || null,
      ativo: contato.ativo !== undefined ? contato.ativo : true,
      created_at: contato.created_at || agora,
      updated_at: agora,
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('whatsapp_contatos')
          .upsert(payload)
          .select('id, telefone, nome, tipo_contato, departamento_relacionado, unidade_negocio, colaborador_vinculado_id, colaborador_vinculado_nome, regra_atendimento, mensagem_personalizada, ativo, created_at, updated_at')
          .single();

        if (!error && data) {
          notificarAtualizacaoWhatsApp();
          return data as WhatsAppContato;
        }
      } catch (e) {
        console.warn('[WhatsAppService] Fallback ao salvar contato:', e);
      }
    }

    const local = getLocalWhatsAppContatos();
    const idx = local.findIndex((c) => c.id === payload.id);
    if (idx >= 0) {
      local[idx] = payload;
    } else {
      local.unshift(payload);
    }
    saveLocalWhatsAppContatos(local);
    notificarAtualizacaoWhatsApp();
    return payload;
  },

  async excluirContato(id: string): Promise<boolean> {
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('whatsapp_contatos').delete().eq('id', id);
        if (!error) {
          notificarAtualizacaoWhatsApp();
          return true;
        }
      } catch (e) {
        console.warn('[WhatsAppService] Fallback ao excluir contato:', e);
      }
    }

    const local = getLocalWhatsAppContatos().filter((c) => c.id !== id);
    saveLocalWhatsAppContatos(local);
    notificarAtualizacaoWhatsApp();
    return true;
  },

  async identificarContato(telefone: string, unidade?: string): Promise<WhatsAppContato | null> {
    const telNormalizado = normalizarNumeroWhatsApp(telefone);
    const contatos = await this.listarContatos(unidade);
    const encontrado = contatos.find((c) => normalizarNumeroWhatsApp(c.telefone) === telNormalizado);
    return encontrado || null;
  },

  // ---------------------------------------------------------------------------
  // 3. FILAS DE ATENDIMENTO
  // ---------------------------------------------------------------------------
  async listarFilas(unidade?: string): Promise<WhatsAppFila[]> {
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('whatsapp_filas')
          .select('id, nome, descricao, unidade_negocio, departamento, ordem, ativo, created_at')
          .order('ordem', { ascending: true });

        if (unidade) {
          query = query.or(`unidade_negocio.is.null,unidade_negocio.eq.${unidade}`);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data as WhatsAppFila[];
        }
      } catch (e) {
        console.warn('[WhatsAppService] Fallback ao listar filas:', e);
      }
    }

    const local = getLocalWhatsAppFilas();
    return local;
  },

  async salvarFila(fila: Partial<WhatsAppFila>): Promise<WhatsAppFila> {
    const agora = new Date().toISOString();
    const id = fila.id || `fila-${Date.now()}`;
    const payload: WhatsAppFila = {
      id,
      nome: fila.nome || 'Nova Fila',
      descricao: fila.descricao || null,
      unidade_negocio: fila.unidade_negocio || null,
      departamento: fila.departamento || 'Logística',
      ordem: fila.ordem !== undefined ? fila.ordem : 0,
      ativo: fila.ativo !== undefined ? fila.ativo : true,
      created_at: fila.created_at || agora,
    };

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('whatsapp_filas')
          .upsert(payload)
          .select('id, nome, descricao, unidade_negocio, departamento, ordem, ativo, created_at')
          .single();

        if (!error && data) {
          notificarAtualizacaoWhatsApp();
          return data as WhatsAppFila;
        }
      } catch (e) {
        console.warn('[WhatsAppService] Fallback ao salvar fila:', e);
      }
    }

    const local = getLocalWhatsAppFilas();
    const idx = local.findIndex((f) => f.id === payload.id);
    if (idx >= 0) {
      local[idx] = payload;
    } else {
      local.push(payload);
    }
    saveLocalWhatsAppFilas(local);
    notificarAtualizacaoWhatsApp();
    return payload;
  },

  async excluirFila(id: string): Promise<boolean> {
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('whatsapp_filas').delete().eq('id', id);
        if (!error) {
          notificarAtualizacaoWhatsApp();
          return true;
        }
      } catch (e) {
        console.warn('[WhatsAppService] Fallback ao excluir fila:', e);
      }
    }

    const local = getLocalWhatsAppFilas().filter((f) => f.id !== id);
    saveLocalWhatsAppFilas(local);
    notificarAtualizacaoWhatsApp();
    return true;
  },

  // ---------------------------------------------------------------------------
  // 4. MENSAGENS AUTOMÁTICAS CONFIGURÁVEIS NO BANCO
  // ---------------------------------------------------------------------------
  async listarMensagensAutomaticas(unidade?: string): Promise<WhatsAppMensagemAutomatica[]> {
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('whatsapp_mensagens_automaticas')
          .select('id, nome, tipo_evento, perfil_contato, fila_id, unidade_negocio, texto, opcoes, mensagem_invalida, ordem, ativo, created_at, updated_at')
          .order('ordem', { ascending: true });

        if (unidade) {
          query = query.or(`unidade_negocio.is.null,unidade_negocio.eq.${unidade}`);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data as WhatsAppMensagemAutomatica[];
        }
      } catch (e) {
        console.warn('[WhatsAppService] Fallback ao listar mensagens automáticas:', e);
      }
    }

    const local = getLocalWhatsAppMensagensAuto();
    return local;
  },

  async salvarMensagemAutomatica(msg: Partial<WhatsAppMensagemAutomatica>): Promise<WhatsAppMensagemAutomatica> {
    const agora = new Date().toISOString();
    const id = msg.id || `msg-auto-${Date.now()}`;
    const payload: WhatsAppMensagemAutomatica = {
      id,
      nome: msg.nome || 'Mensagem Automática',
      tipo_evento: msg.tipo_evento || 'boas_vindas',
      perfil_contato: msg.perfil_contato || 'todos',
      fila_id: msg.fila_id || null,
      unidade_negocio: msg.unidade_negocio || null,
      texto: msg.texto || '',
      opcoes: msg.opcoes || [],
      mensagem_invalida: msg.mensagem_invalida || null,
      ordem: msg.ordem !== undefined ? msg.ordem : 0,
      ativo: msg.ativo !== undefined ? msg.ativo : true,
      created_at: msg.created_at || agora,
      updated_at: agora,
    };

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('whatsapp_mensagens_automaticas')
          .upsert(payload)
          .select('id, nome, tipo_evento, perfil_contato, fila_id, unidade_negocio, texto, opcoes, mensagem_invalida, ordem, ativo, created_at, updated_at')
          .single();

        if (!error && data) {
          notificarAtualizacaoWhatsApp();
          return data as WhatsAppMensagemAutomatica;
        }
      } catch (e) {
        console.warn('[WhatsAppService] Fallback ao salvar mensagem automática:', e);
      }
    }

    const local = getLocalWhatsAppMensagensAuto();
    const idx = local.findIndex((m) => m.id === payload.id);
    if (idx >= 0) {
      local[idx] = payload;
    } else {
      local.push(payload);
    }
    saveLocalWhatsAppMensagensAuto(local);
    notificarAtualizacaoWhatsApp();
    return payload;
  },

  async excluirMensagemAutomatica(id: string): Promise<boolean> {
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('whatsapp_mensagens_automaticas').delete().eq('id', id);
        if (!error) {
          notificarAtualizacaoWhatsApp();
          return true;
        }
      } catch (e) {
        console.warn('[WhatsAppService] Fallback ao excluir mensagem automática:', e);
      }
    }

    const local = getLocalWhatsAppMensagensAuto().filter((m) => m.id !== id);
    saveLocalWhatsAppMensagensAuto(local);
    notificarAtualizacaoWhatsApp();
    return true;
  },

  // ---------------------------------------------------------------------------
  // 5. USUÁRIOS HABILITADOS E DISPONIBILIDADE
  // ---------------------------------------------------------------------------
  async listarUsuariosHabilitados(unidade?: string): Promise<WhatsAppUsuarioHabilitado[]> {
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('whatsapp_usuarios_habilitados')
          .select('id, usuario_id, usuario_nome, usuario_codigo, usuario_departamento, usuario_nivel, habilitado, disponivel, filas_permitidas, pode_visualizar_grupos, pode_responder_grupos, is_gestor_whatsapp, unidade_negocio, created_at, updated_at')
          .order('usuario_nome', { ascending: true });

        if (unidade) {
          query = query.eq('unidade_negocio', unidade);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data as WhatsAppUsuarioHabilitado[];
        }
      } catch (e) {
        console.warn('[WhatsAppService] Fallback ao listar usuários habilitados:', e);
      }
    }

    const local = getLocalWhatsAppUsuariosHabilitados();
    if (unidade) {
      return local.filter((u) => u.unidade_negocio.toLowerCase() === unidade.toLowerCase());
    }
    return local;
  },

  async obterHabilitacaoUsuario(usuarioId?: string | null): Promise<WhatsAppUsuarioHabilitado | null> {
    if (!usuarioId) return null;
    const lista = await this.listarUsuariosHabilitados();
    const encontrado = lista.find((u) => u.usuario_id === usuarioId);
    return encontrado || null;
  },

  async salvarHabilitacaoUsuario(hab: Partial<WhatsAppUsuarioHabilitado>): Promise<WhatsAppUsuarioHabilitado> {
    const agora = new Date().toISOString();
    const id = hab.id || `hab-${Date.now()}`;
    const payload: WhatsAppUsuarioHabilitado = {
      id,
      usuario_id: hab.usuario_id || '',
      usuario_nome: hab.usuario_nome || 'Colaborador',
      usuario_codigo: hab.usuario_codigo || '',
      usuario_departamento: hab.usuario_departamento || 'Logística',
      usuario_nivel: hab.usuario_nivel || 'Operador',
      habilitado: hab.habilitado !== undefined ? hab.habilitado : true,
      disponivel: hab.disponivel !== undefined ? hab.disponivel : true,
      filas_permitidas: hab.filas_permitidas || ['Recebimento', 'Geral'],
      pode_visualizar_grupos: Boolean(hab.pode_visualizar_grupos),
      pode_responder_grupos: Boolean(hab.pode_responder_grupos),
      is_gestor_whatsapp: Boolean(hab.is_gestor_whatsapp),
      unidade_negocio: hab.unidade_negocio || 'Goiânia',
      created_at: hab.created_at || agora,
      updated_at: agora,
    };

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('whatsapp_usuarios_habilitados')
          .upsert(payload)
          .select('id, usuario_id, usuario_nome, usuario_codigo, usuario_departamento, usuario_nivel, habilitado, disponivel, filas_permitidas, pode_visualizar_grupos, pode_responder_grupos, is_gestor_whatsapp, unidade_negocio, created_at, updated_at')
          .single();

        if (!error && data) {
          notificarAtualizacaoWhatsApp();
          return data as WhatsAppUsuarioHabilitado;
        }
      } catch (e) {
        console.warn('[WhatsAppService] Fallback ao salvar habilitação de usuário:', e);
      }
    }

    const local = getLocalWhatsAppUsuariosHabilitados();
    const idx = local.findIndex((u) => u.usuario_id === payload.usuario_id || u.id === payload.id);
    if (idx >= 0) {
      local[idx] = payload;
    } else {
      local.push(payload);
    }
    saveLocalWhatsAppUsuariosHabilitados(local);
    notificarAtualizacaoWhatsApp();
    return payload;
  },

  async alternarDisponibilidade(usuarioId: string): Promise<boolean> {
    const lista = await this.listarUsuariosHabilitados();
    const hab = lista.find((u) => u.usuario_id === usuarioId);
    if (!hab) return false;

    hab.disponivel = !hab.disponivel;
    await this.salvarHabilitacaoUsuario(hab);
    notificarAtualizacaoWhatsApp();
    return hab.disponivel;
  },

  // ---------------------------------------------------------------------------
  // 6. CAIXA DE ENTRADA E CONVERSAS
  // ---------------------------------------------------------------------------
  async listarConversas(params?: {
    status?: 'aguardando' | 'em_andamento' | 'encerrado' | 'todos';
    unidade?: string;
    usuarioId?: string;
    filtroTexto?: string;
  }): Promise<WhatsAppConversa[]> {
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('whatsapp_conversas')
          .select('id, canal_id, canal_nome, contato_id, numero_remetente, nome_remetente, unidade_negocio, fila_nome, usuario_atribuido_id, usuario_atribuido_nome, status, tipo_conversa, grupo_id_externo, grupo_titulo, ultima_mensagem_texto, ultima_mensagem_data, data_inicio_atendimento, data_encerramento, encerrado_por_usuario_id, encerrado_por_nome, contato_tipo, nao_lidas, created_at, updated_at')
          .order('ultima_mensagem_data', { ascending: false });

        if (params?.status && params.status !== 'todos') {
          query = query.eq('status', params.status);
        }
        if (params?.unidade) {
          query = query.eq('unidade_negocio', params.unidade);
        }

        const { data, error } = await query;
        if (!error && data) {
          let filtradas = data as WhatsAppConversa[];
          if (params?.filtroTexto?.trim()) {
            const term = params.filtroTexto.trim().toLowerCase();
            filtradas = filtradas.filter(
              (c) =>
                (c.nome_remetente || '').toLowerCase().includes(term) ||
                (c.numero_remetente || '').toLowerCase().includes(term) ||
                (c.fila_nome || '').toLowerCase().includes(term) ||
                (c.ultima_mensagem_texto || '').toLowerCase().includes(term)
            );
          }
          return filtradas;
        }
      } catch (e) {
        console.warn('[WhatsAppService] Fallback ao listar conversas:', e);
      }
    }

    let local = getLocalWhatsAppConversas();
    if (params?.status && params.status !== 'todos') {
      local = local.filter((c) => c.status === params.status);
    }
    if (params?.unidade) {
      local = local.filter((c) => c.unidade_negocio.toLowerCase() === params.unidade!.toLowerCase());
    }
    if (params?.filtroTexto?.trim()) {
      const term = params.filtroTexto.trim().toLowerCase();
      local = local.filter(
        (c) =>
          (c.nome_remetente || '').toLowerCase().includes(term) ||
          (c.numero_remetente || '').toLowerCase().includes(term) ||
          (c.fila_nome || '').toLowerCase().includes(term) ||
          (c.ultima_mensagem_texto || '').toLowerCase().includes(term)
      );
    }

    // Ordenação decrescente pela última mensagem
    return local.sort(
      (a, b) => new Date(b.ultima_mensagem_data).getTime() - new Date(a.ultima_mensagem_data).getTime()
    );
  },

  async obterConversaPorId(id: string): Promise<WhatsAppConversa | null> {
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('whatsapp_conversas')
          .select('id, canal_id, canal_nome, contato_id, numero_remetente, nome_remetente, unidade_negocio, fila_nome, usuario_atribuido_id, usuario_atribuido_nome, status, tipo_conversa, grupo_id_externo, grupo_titulo, ultima_mensagem_texto, ultima_mensagem_data, data_inicio_atendimento, data_encerramento, encerrado_por_usuario_id, encerrado_por_nome, contato_tipo, nao_lidas, created_at, updated_at')
          .eq('id', id)
          .single();

        if (!error && data) {
          return data as WhatsAppConversa;
        }
      } catch (e) {
        console.warn('[WhatsAppService] Fallback ao obter conversa:', e);
      }
    }

    const local = getLocalWhatsAppConversas();
    return local.find((c) => c.id === id) || null;
  },

  // ---------------------------------------------------------------------------
  // 7. INICIAR ATENDIMENTO (ASSUMIR CONVERSA)
  // ---------------------------------------------------------------------------
  async assumirConversa(conversaId: string, usuario: Usuario): Promise<WhatsAppConversa | null> {
    const agora = new Date().toISOString();
    const patch: Partial<WhatsAppConversa> = {
      status: 'em_andamento',
      usuario_atribuido_id: usuario.id,
      usuario_atribuido_nome: usuario.nome,
      data_inicio_atendimento: agora,
      updated_at: agora,
    };

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('whatsapp_conversas')
          .update(patch)
          .eq('id', conversaId)
          .select()
          .single();

        if (!error && data) {
          // Grava ação no histórico
          await this.registrarAcao(conversaId, usuario, 'inicio_atendimento', {
            responsavel: usuario.nome,
            codigo: usuario.codigo,
          });
          notificarAtualizacaoWhatsApp();
          return data as WhatsAppConversa;
        }
      } catch (e) {
        console.warn('[WhatsAppService] Fallback ao assumir conversa:', e);
      }
    }

    const local = getLocalWhatsAppConversas();
    const idx = local.findIndex((c) => c.id === conversaId);
    if (idx >= 0) {
      local[idx] = { ...local[idx], ...patch };
      saveLocalWhatsAppConversas(local);

      await this.registrarAcao(conversaId, usuario, 'inicio_atendimento', {
        responsavel: usuario.nome,
        codigo: usuario.codigo,
      });

      notificarAtualizacaoWhatsApp();
      return local[idx];
    }
    return null;
  },

  // ---------------------------------------------------------------------------
  // 8. TRANSFERIR CONVERSA
  // ---------------------------------------------------------------------------
  async transferirConversa(
    conversaId: string,
    usuarioOrigem: Usuario,
    dados: {
      novaFila?: string;
      novoUsuarioId?: string;
      novoUsuarioNome?: string;
      motivo?: string;
    }
  ): Promise<WhatsAppConversa | null> {
    const agora = new Date().toISOString();
    const patch: Partial<WhatsAppConversa> = {
      updated_at: agora,
    };
    if (dados.novaFila) patch.fila_nome = dados.novaFila;
    if (dados.novoUsuarioId) {
      patch.usuario_atribuido_id = dados.novoUsuarioId;
      patch.usuario_atribuido_nome = dados.novoUsuarioNome || null;
      patch.status = 'em_andamento';
    } else {
      // Transferido para fila sem atendente fixo
      patch.usuario_atribuido_id = null;
      patch.usuario_atribuido_nome = null;
      patch.status = 'aguardando';
    }

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('whatsapp_conversas')
          .update(patch)
          .eq('id', conversaId)
          .select()
          .single();

        if (!error && data) {
          await this.registrarAcao(conversaId, usuarioOrigem, 'transferencia', dados);
          notificarAtualizacaoWhatsApp();
          return data as WhatsAppConversa;
        }
      } catch (e) {
        console.warn('[WhatsAppService] Fallback ao transferir conversa:', e);
      }
    }

    const local = getLocalWhatsAppConversas();
    const idx = local.findIndex((c) => c.id === conversaId);
    if (idx >= 0) {
      local[idx] = { ...local[idx], ...patch };
      saveLocalWhatsAppConversas(local);
      await this.registrarAcao(conversaId, usuarioOrigem, 'transferencia', dados);
      notificarAtualizacaoWhatsApp();
      return local[idx];
    }
    return null;
  },

  // ---------------------------------------------------------------------------
  // 9. ENCERRAR CONVERSA
  // ---------------------------------------------------------------------------
  async encerrarConversa(conversaId: string, usuario: Usuario, motivo?: string): Promise<WhatsAppConversa | null> {
    const agora = new Date().toISOString();
    const patch: Partial<WhatsAppConversa> = {
      status: 'encerrado',
      data_encerramento: agora,
      encerrado_por_usuario_id: usuario.id,
      encerrado_por_nome: usuario.nome,
      updated_at: agora,
    };

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('whatsapp_conversas')
          .update(patch)
          .eq('id', conversaId)
          .select()
          .single();

        if (!error && data) {
          await this.registrarAcao(conversaId, usuario, 'encerramento', { motivo });
          notificarAtualizacaoWhatsApp();
          return data as WhatsAppConversa;
        }
      } catch (e) {
        console.warn('[WhatsAppService] Fallback ao encerrar conversa:', e);
      }
    }

    const local = getLocalWhatsAppConversas();
    const idx = local.findIndex((c) => c.id === conversaId);
    if (idx >= 0) {
      local[idx] = { ...local[idx], ...patch };
      saveLocalWhatsAppConversas(local);
      await this.registrarAcao(conversaId, usuario, 'encerramento', { motivo });
      notificarAtualizacaoWhatsApp();
      return local[idx];
    }
    return null;
  },

  // ---------------------------------------------------------------------------
  // 10. REABRIR CONVERSA
  // ---------------------------------------------------------------------------
  async reabrirConversa(conversaId: string, usuario: Usuario): Promise<WhatsAppConversa | null> {
    const agora = new Date().toISOString();
    const patch: Partial<WhatsAppConversa> = {
      status: 'aguardando',
      data_encerramento: null,
      encerrado_por_usuario_id: null,
      encerrado_por_nome: null,
      updated_at: agora,
    };

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('whatsapp_conversas')
          .update(patch)
          .eq('id', conversaId)
          .select()
          .single();

        if (!error && data) {
          await this.registrarAcao(conversaId, usuario, 'reabertura', { reaberto_por: usuario.nome });
          notificarAtualizacaoWhatsApp();
          return data as WhatsAppConversa;
        }
      } catch (e) {
        console.warn('[WhatsAppService] Fallback ao reabrir conversa:', e);
      }
    }

    const local = getLocalWhatsAppConversas();
    const idx = local.findIndex((c) => c.id === conversaId);
    if (idx >= 0) {
      local[idx] = { ...local[idx], ...patch };
      saveLocalWhatsAppConversas(local);
      await this.registrarAcao(conversaId, usuario, 'reabertura', { reaberto_por: usuario.nome });
      notificarAtualizacaoWhatsApp();
      return local[idx];
    }
    return null;
  },

  // ---------------------------------------------------------------------------
  // 11. HISTÓRICO DE MENSAGENS E ENVIO
  // ---------------------------------------------------------------------------
  async listarMensagens(conversaId: string): Promise<WhatsAppMensagem[]> {
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('whatsapp_mensagens')
          .select('id, conversa_id, tipo_remetente, usuario_id, autor_nome, conteudo, meta_message_id, status_envio, erro_mensagem, created_at')
          .eq('conversa_id', conversaId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          return data as WhatsAppMensagem[];
        }
      } catch (e) {
        console.warn('[WhatsAppService] Fallback ao listar mensagens:', e);
      }
    }

    const local = getLocalWhatsAppMensagens();
    return local
      .filter((m) => m.conversa_id === conversaId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  },

  /**
   * Envia uma mensagem no chat da conversa.
   * Regra Obrigatória da Seção 8:
   * Toda mensagem enviada por um colaborador identifica claramente quem está atendendo
   * com o nome do usuário autenticado em negrito no histórico visual e persistido no banco.
   */
  async enviarMensagemColaborador(
    conversaId: string,
    usuario: Usuario,
    conteudo: string
  ): Promise<WhatsAppMensagem> {
    if (!WHATSAPP_SERVICE_ENABLED) {
      throw new Error('Módulo WhatsApp Business está desativado no momento.');
    }
    const agora = new Date().toISOString();
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const autorNome = usuario.nome || 'Colaborador';

    const payload: WhatsAppMensagem = {
      id,
      conversa_id: conversaId,
      tipo_remetente: 'colaborador',
      usuario_id: usuario.id,
      autor_nome: autorNome,
      conteudo: conteudo.trim(),
      status_envio: 'enviado',
      created_at: agora,
    };

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('whatsapp_mensagens')
          .insert(payload)
          .select()
          .single();

        if (!error && data) {
          // Atualiza conversa com snippet da última mensagem
          await supabase
            .from('whatsapp_conversas')
            .update({
              ultima_mensagem_texto: payload.conteudo,
              ultima_mensagem_data: agora,
              status: 'em_andamento',
              usuario_atribuido_id: usuario.id,
              usuario_atribuido_nome: autorNome,
              updated_at: agora,
            })
            .eq('id', conversaId);

          notificarAtualizacaoWhatsApp();
          return data as WhatsAppMensagem;
        }
      } catch (e) {
        console.warn('[WhatsAppService] Fallback ao enviar mensagem:', e);
      }
    }

    const localMsgs = getLocalWhatsAppMensagens();
    localMsgs.push(payload);
    saveLocalWhatsAppMensagens(localMsgs);

    // Atualiza conversa local
    const localConvs = getLocalWhatsAppConversas();
    const idx = localConvs.findIndex((c) => c.id === conversaId);
    if (idx >= 0) {
      localConvs[idx].ultima_mensagem_texto = payload.conteudo;
      localConvs[idx].ultima_mensagem_data = agora;
      localConvs[idx].status = 'em_andamento';
      localConvs[idx].usuario_atribuido_id = usuario.id;
      localConvs[idx].usuario_atribuido_nome = autorNome;
      saveLocalWhatsAppConversas(localConvs);
    }

    notificarAtualizacaoWhatsApp();
    return payload;
  },

  /**
   * Recebe mensagem do contato (simulação ou webhook real).
   */
  async registrarMensagemInbound(
    canalId: string,
    numeroRemetente: string,
    nomeRemetente: string,
    conteudo: string,
    unidadeNegocio = 'Goiânia'
  ): Promise<{ conversa: WhatsAppConversa; mensagem: WhatsAppMensagem }> {
    if (!WHATSAPP_SERVICE_ENABLED) {
      console.warn('[WhatsAppService] Processamento inbound bloqueado: módulo WhatsApp Business desativado.');
      throw new Error('Módulo WhatsApp Business está desativado no momento.');
    }
    const agora = new Date().toISOString();
    const telNorm = normalizarNumeroWhatsApp(numeroRemetente);

    // 1. Identifica ou recupera o contato
    const contato = await this.identificarContato(telNorm, unidadeNegocio);

    // 2. Busca conversa ativa existente ou cria nova
    const conversas = await this.listarConversas({ unidade: unidadeNegocio });
    let conversa = conversas.find(
      (c) =>
        normalizarNumeroWhatsApp(c.numero_remetente) === telNorm &&
        c.status !== 'encerrado'
    );

    let filaInicial = 'Geral';
    if (contato?.regra_atendimento === 'fila_especifica' && contato.departamento_relacionado) {
      filaInicial = contato.departamento_relacionado;
    }

    if (!conversa) {
      conversa = {
        id: `conv-${Date.now()}`,
        canal_id: canalId,
        canal_nome: 'WhatsApp Atendimento',
        contato_id: contato?.id || null,
        numero_remetente: telNorm,
        nome_remetente: contato?.nome || nomeRemetente || 'Cliente WhatsApp',
        unidade_negocio: unidadeNegocio,
        fila_nome: filaInicial,
        usuario_atribuido_id: contato?.colaborador_vinculado_id || null,
        usuario_atribuido_nome: contato?.colaborador_vinculado_nome || null,
        status: 'aguardando',
        tipo_conversa: 'individual',
        ultima_mensagem_texto: conteudo,
        ultima_mensagem_data: agora,
        contato_tipo: contato?.tipo_contato || 'desconhecido',
        nao_lidas: 1,
        created_at: agora,
      };

      const localConvs = getLocalWhatsAppConversas();
      localConvs.unshift(conversa);
      saveLocalWhatsAppConversas(localConvs);
    } else {
      conversa.ultima_mensagem_texto = conteudo;
      conversa.ultima_mensagem_data = agora;
      conversa.nao_lidas = (conversa.nao_lidas || 0) + 1;
      // Se estava aguardando ou reaberto, mantém aguardando
      const localConvs = getLocalWhatsAppConversas();
      const idx = localConvs.findIndex((c) => c.id === conversa!.id);
      if (idx >= 0) {
        localConvs[idx] = conversa;
        saveLocalWhatsAppConversas(localConvs);
      }
    }

    // 3. Registra a mensagem recebida
    const mensagem: WhatsAppMensagem = {
      id: `msg-${Date.now()}`,
      conversa_id: conversa.id,
      tipo_remetente: 'contato',
      autor_nome: conversa.nome_remetente,
      conteudo: conteudo.trim(),
      status_envio: 'entregue',
      created_at: agora,
    };

    const localMsgs = getLocalWhatsAppMensagens();
    localMsgs.push(mensagem);
    saveLocalWhatsAppMensagens(localMsgs);

    // 4. Processamento automático de fluxo
    await this.processarRespostaAutomatica(conversa, contato, conteudo);

    notificarAtualizacaoWhatsApp();
    return { conversa, mensagem };
  },

  /**
   * Processa respostas automáticas e menus configurados no banco de dados.
   */
  async processarRespostaAutomatica(
    conversa: WhatsAppConversa,
    contato: WhatsAppContato | null,
    textoRecebido: string
  ): Promise<void> {
    const agora = new Date().toISOString();
    const canais = await this.listarCanais(conversa.unidade_negocio);
    const canal = canais.find((c) => c.id === conversa.canal_id) || canais[0];

    // Checa horário de funcionamento
    if (canal && !isDentroDoHorario(canal.horario_inicio, canal.horario_fim, canal.dias_funcionamento)) {
      const msgsFora = await this.listarMensagensAutomaticas(conversa.unidade_negocio);
      const msgForaHorario = msgsFora.find((m) => m.tipo_evento === 'fora_horario' && m.ativo);
      const texto =
        canal.mensagem_fora_horario ||
        msgForaHorario?.texto ||
        'Olá! Nossa equipe está fora do horário de atendimento. Retornaremos em breve.';

      const autoMsg: WhatsAppMensagem = {
        id: `auto-${Date.now()}`,
        conversa_id: conversa.id,
        tipo_remetente: 'sistema',
        autor_nome: 'Atendimento automático',
        conteudo: texto,
        status_envio: 'entregue',
        created_at: agora,
      };

      const localMsgs = getLocalWhatsAppMensagens();
      localMsgs.push(autoMsg);
      saveLocalWhatsAppMensagens(localMsgs);
      return;
    }

    // Checa se o usuário digitou uma opção numérica de menu
    const digito = textoRecebido.trim();
    const msgsAuto = await this.listarMensagensAutomaticas(conversa.unidade_negocio);
    const menuBoasVindas = msgsAuto.find((m) => m.tipo_evento === 'boas_vindas' && m.ativo);

    if (menuBoasVindas && menuBoasVindas.opcoes && menuBoasVindas.opcoes.length > 0) {
      const opcaoEscolhida = menuBoasVindas.opcoes.find((op) => op.valor === digito);
      if (opcaoEscolhida) {
        // Direciona para a fila escolhida!
        conversa.fila_nome = opcaoEscolhida.destino_fila;
        conversa.status = 'aguardando';

        const confirmacao: WhatsAppMensagem = {
          id: `auto-${Date.now()}`,
          conversa_id: conversa.id,
          tipo_remetente: 'sistema',
          autor_nome: 'Atendimento automático',
          conteudo: `Atendimento direcionado para a fila *${opcaoEscolhida.destino_fila}*. Um de nossos atendentes entrará em contato em instantes.`,
          status_envio: 'entregue',
          created_at: agora,
        };

        const localMsgs = getLocalWhatsAppMensagens();
        localMsgs.push(confirmacao);
        saveLocalWhatsAppMensagens(localMsgs);

        const localConvs = getLocalWhatsAppConversas();
        const idx = localConvs.findIndex((c) => c.id === conversa.id);
        if (idx >= 0) {
          localConvs[idx] = conversa;
          saveLocalWhatsAppConversas(localConvs);
        }
        return;
      }
    }
  },

  // ---------------------------------------------------------------------------
  // 12. CÁLCULO DE STATUS DA BADGE WHATSAPP NO CABEÇALHO GLOBAL (SEÇÃO 6)
  // ---------------------------------------------------------------------------
  /**
   * Calcula o estado real da badge do cabeçalho global:
   * - Vermelha: existe pelo menos uma conversa aguardando atendimento pelo usuário ou nas suas filas.
   * - Laranja: o usuário possui conversa em andamento e não há conversas pendentes.
   * - Escura/desabilitada: não existem conversas pendentes nem em andamento.
   * - Prioridade mandatória para Vermelha se houver pendente e em andamento.
   */
  async obterStatusBadge(user?: Usuario | null): Promise<WhatsAppBadgeStatus> {
    if (!WHATSAPP_SERVICE_ENABLED || !user || !isUserLogistica(user)) {
      return {
        habilitado: false,
        pendentes_count: 0,
        em_andamento_count: 0,
        cor: 'dark',
      };
    }

    const hab = await this.obterHabilitacaoUsuario(user.id);
    // Se não tiver registro explícito mas for gestor da logística, permite
    const isGestor = isUserGestor(user);
    const estaHabilitado = hab ? hab.habilitado : isGestor;

    if (!estaHabilitado) {
      return {
        habilitado: false,
        pendentes_count: 0,
        em_andamento_count: 0,
        cor: 'dark',
      };
    }

    const filasPermitidas = hab?.filas_permitidas || ['Recebimento', 'Expedição', 'Agendamentos', 'Retira', 'Entregas Nosso Carro', 'Comercial', 'Geral'];
    const conversas = await this.listarConversas({ unidade: user.unidade_negocio });

    // Conversas aguardando:
    // 1. Atribuídas diretamente ao usuário com status 'aguardando'
    // 2. OU conversas com status 'aguardando' sem atendente atribuído que estejam em uma das filas do usuário
    const pendentes = conversas.filter((c) => {
      if (c.status !== 'aguardando') return false;
      if (c.usuario_atribuido_id === user.id) return true;
      if (!c.usuario_atribuido_id && filasPermitidas.includes(c.fila_nome)) return true;
      if (isGestor) return true; // Gestor enxerga todas as pendências da sua unidade
      return false;
    });

    // Conversas em andamento pelo usuário:
    const emAndamento = conversas.filter((c) => {
      if (c.status !== 'em_andamento') return false;
      if (c.usuario_atribuido_id === user.id) return true;
      if (isGestor && !c.usuario_atribuido_id) return true;
      return false;
    });

    const pendentesCount = pendentes.length;
    const emAndamentoCount = emAndamento.length;

    let cor: 'red' | 'orange' | 'dark' = 'dark';
    if (pendentesCount > 0) {
      // Prioridade absoluta para Vermelha
      cor = 'red';
    } else if (emAndamentoCount > 0) {
      cor = 'orange';
    } else {
      cor = 'dark';
    }

    return {
      habilitado: true,
      pendentes_count: pendentesCount,
      em_andamento_count: emAndamentoCount,
      cor,
    };
  },

  // ---------------------------------------------------------------------------
  // 13. AUDITORIA E REGISTRO DE AÇÕES
  // ---------------------------------------------------------------------------
  async registrarAcao(
    conversaId: string,
    usuario: Usuario,
    tipoAcao: WhatsAppHistoricoAcao['tipo_acao'],
    detalhes?: Record<string, any>
  ): Promise<void> {
    const agora = new Date().toISOString();
    const payload: WhatsAppHistoricoAcao = {
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      conversa_id: conversaId,
      usuario_id: usuario.id,
      usuario_nome: usuario.nome,
      tipo_acao: tipoAcao,
      detalhes: detalhes || null,
      created_at: agora,
    };

    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('whatsapp_historico_acoes').insert(payload);
        return;
      } catch (e) {
        console.warn('[WhatsAppService] Fallback ao registrar ação:', e);
      }
    }

    const local = getLocalWhatsAppHistorico();
    local.unshift(payload);
    saveLocalWhatsAppHistorico(local);
  },

  async listarHistoricoAcoes(conversaId?: string): Promise<WhatsAppHistoricoAcao[]> {
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('whatsapp_historico_acoes')
          .select('id, conversa_id, usuario_id, usuario_nome, tipo_acao, detalhes, created_at')
          .order('created_at', { ascending: false })
          .limit(100);

        if (conversaId) {
          query = query.eq('conversa_id', conversaId);
        }

        const { data, error } = await query;
        if (!error && data) {
          return data as WhatsAppHistoricoAcao[];
        }
      } catch (e) {
        console.warn('[WhatsAppService] Fallback ao listar histórico:', e);
      }
    }

    const local = getLocalWhatsAppHistorico();
    if (conversaId) {
      return local.filter((h) => h.conversa_id === conversaId);
    }
    return local;
  },
};
