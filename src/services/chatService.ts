import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import {
  ChatConversa,
  ChatParticipante,
  ChatMensagem,
  ChatUsuarioContato,
  Usuario,
} from '../types';
import { usuariosService } from './usuariosService';

const LOCAL_KEY_CONVERSAS = 'polihub_chat_conversas';
const LOCAL_KEY_PARTICIPANTES = 'polihub_chat_participantes';
const LOCAL_KEY_MENSAGENS = 'polihub_chat_mensagens';

export const CHAT_PAGE_SIZE = 30;

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

// ---------------------------------------------------------------------------
// SAFE STORAGE HELPERS (Suporte a LocalStorage do Navegador com Memória Fallback)
// ---------------------------------------------------------------------------
const inMemoryStore: Record<string, string> = {};

function safeGetItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return inMemoryStore[key] || null;
  } catch {
    return inMemoryStore[key] || null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
    inMemoryStore[key] = value;
  } catch {
    inMemoryStore[key] = value;
  }
}

export function getLocalConversas(): ChatConversa[] {
  try {
    const raw = safeGetItem(LOCAL_KEY_CONVERSAS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalConversas(items: ChatConversa[]): void {
  try {
    safeSetItem(LOCAL_KEY_CONVERSAS, JSON.stringify(items));
  } catch {}
}

export function getLocalParticipantes(): ChatParticipante[] {
  try {
    const raw = safeGetItem(LOCAL_KEY_PARTICIPANTES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalParticipantes(items: ChatParticipante[]): void {
  try {
    safeSetItem(LOCAL_KEY_PARTICIPANTES, JSON.stringify(items));
  } catch {}
}

export function getLocalMensagens(): ChatMensagem[] {
  try {
    const raw = safeGetItem(LOCAL_KEY_MENSAGENS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalMensagens(items: ChatMensagem[]): void {
  try {
    safeSetItem(LOCAL_KEY_MENSAGENS, JSON.stringify(items));
  } catch {}
}

function notificarAtualizacaoChat(conversaId?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('polihub_chat_update', {
        detail: { conversaId },
      })
    );
  }
}

// ---------------------------------------------------------------------------
// CHAT SERVICE
// ---------------------------------------------------------------------------
export const chatService = {
  /**
   * Lista as conversas ativas do usuário conectado, ordenadas pela atividade mais recente.
   * Calcula mensagens não lidas individualmente via chat_participantes.ultima_leitura_em.
   */
  async listarConversasDoUsuario(usuarioId: string): Promise<ChatConversa[]> {
    if (!usuarioId) return [];
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Busca os IDs das conversas em que o usuário participa e não saiu
        const { data: participacoes, error: errPart } = await supabase
          .from('chat_participantes')
          .select('id, conversa_id, usuario_id, ultima_leitura_em, entrou_em, saiu_em, created_at')
          .eq('usuario_id', usuarioId)
          .is('saiu_em', null);

        if (!errPart && participacoes && participacoes.length > 0) {
          const conversaIds = participacoes.map((p) => p.conversa_id);
          const mapUltimaLeitura = new Map<string, string>();
          participacoes.forEach((p) => {
            mapUltimaLeitura.set(p.conversa_id, p.ultima_leitura_em || p.entrou_em || p.created_at);
          });

          // 2. Busca os dados dessas conversas
          const { data: conversasData, error: errConv } = await supabase
            .from('chat_conversas')
            .select('id, tipo, nome, criado_por, unidade_negocio_id, ativo, created_at, ultima_mensagem_em')
            .in('id', conversaIds)
            .eq('ativo', true)
            .order('ultima_mensagem_em', { ascending: false });

          if (!errConv && conversasData) {
            // 3. Busca participantes de todas essas conversas para resolver nomes/contatos
            const { data: todosParticipantes } = await supabase
              .from('chat_participantes')
              .select('id, conversa_id, usuario_id, ultima_leitura_em, entrou_em, saiu_em, created_at')
              .in('conversa_id', conversaIds)
              .is('saiu_em', null);

            // Carrega mapa de usuários cadastrados
            const usuariosCadastrados = await usuariosService.listarTodos();
            const usuariosMap = new Map<string, Usuario>();
            usuariosCadastrados.forEach((u) => usuariosMap.set(u.id, u));

            // 4. Busca a última mensagem de cada conversa e contagem de não lidas
            const conversasEnriquecidas = await Promise.all(
              conversasData.map(async (conv) => {
                const partsDestaConversa = (todosParticipantes || []).filter((p) => p.conversa_id === conv.id);
                const ultimaLeitura = mapUltimaLeitura.get(conv.id) || conv.created_at;

                // Última mensagem
                const { data: ultimasMsgs } = await supabase
                  .from('chat_mensagens')
                  .select('id, conversa_id, remetente_id, conteudo, created_at')
                  .eq('conversa_id', conv.id)
                  .order('created_at', { ascending: false })
                  .limit(1);

                const ultimaMsg = ultimasMsgs && ultimasMsgs.length > 0 ? ultimasMsgs[0] : null;

                // Contagem de não lidas: criadas após ultimaLeitura e enviadas por outros participantes
                const { data: msgsNaoLidas, count: naoLidasCount } = await supabase
                  .from('chat_mensagens')
                  .select('id, remetente_id', { count: 'exact' })
                  .eq('conversa_id', conv.id)
                  .gt('created_at', ultimaLeitura)
                  .neq('remetente_id', usuarioId);

                let outroUsuario: ChatConversa['outro_usuario'] = null;
                if (conv.tipo === 'individual') {
                  const outroPart = partsDestaConversa.find((p) => p.usuario_id !== usuarioId);
                  if (outroPart) {
                    const uObj = usuariosMap.get(outroPart.usuario_id);
                    if (uObj) {
                      outroUsuario = {
                        id: uObj.id,
                        nome: uObj.nome,
                        codigo: uObj.codigo,
                        departamento: uObj.departamento,
                        unidade_negocio: uObj.unidade_negocio,
                        foto: uObj.foto,
                        nivel: uObj.nivel,
                      };
                    }
                  }
                }

                // Identifica se alguma mensagem não lida foi enviada por gestor (Regra Item 4)
                let temNaoLidasGestor = false;
                const totalNaoLidas = naoLidasCount || (msgsNaoLidas ? msgsNaoLidas.length : 0);
                if (totalNaoLidas > 0) {
                  if (conv.tipo === 'individual' && outroUsuario) {
                    const niv = (outroUsuario.nivel || '').toLowerCase().trim();
                    temNaoLidasGestor = niv === 'gestor' || niv === 'administrador';
                  } else if (msgsNaoLidas && msgsNaoLidas.length > 0) {
                    temNaoLidasGestor = msgsNaoLidas.some((m) => {
                      const autor = usuariosMap.get(m.remetente_id);
                      const niv = (autor?.nivel || '').toLowerCase().trim();
                      return niv === 'gestor' || niv === 'administrador';
                    });
                  }
                }

                return {
                  ...conv,
                  ultima_mensagem: ultimaMsg ? ultimaMsg.conteudo : null,
                  nao_lidas: totalNaoLidas,
                  tem_nao_lidas_gestor: temNaoLidasGestor,
                  outro_usuario: outroUsuario,
                  participantes_count: partsDestaConversa.length,
                } as ChatConversa;
              })
            );

            return conversasEnriquecidas.sort(
              (a, b) => new Date(b.ultima_mensagem_em).getTime() - new Date(a.ultima_mensagem_em).getTime()
            );
          }
        }
      } catch (err) {
        console.warn('[ChatService] Fallback ao listar conversas via Supabase:', err);
      }
    }

    // Fallback local
    const conversasLocais = getLocalConversas();
    const partLocais = getLocalParticipantes();
    const msgsLocais = getLocalMensagens();
    const todosUsuarios = await usuariosService.listarTodos();
    const usuariosMap = new Map<string, Usuario>();
    todosUsuarios.forEach((u) => usuariosMap.set(u.id, u));

    const minhasPart = partLocais.filter((p) => p.usuario_id === usuarioId && !p.saiu_em);
    const minhasConvIds = new Set(minhasPart.map((p) => p.conversa_id));
    const mapLeitura = new Map<string, string>();
    minhasPart.forEach((p) => mapLeitura.set(p.conversa_id, p.ultima_leitura_em));

    const resultado: ChatConversa[] = [];
    for (const conv of conversasLocais) {
      if (!minhasConvIds.has(conv.id) || conv.ativo === false) continue;
      const ultimaLeitura = mapLeitura.get(conv.id) || conv.created_at;

      const msgsDesta = msgsLocais
        .filter((m) => m.conversa_id === conv.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const ultimaMsg = msgsDesta[0] ? msgsDesta[0].conteudo : null;
      const naoLidas = msgsDesta.filter(
        (m) =>
          m.remetente_id !== usuarioId &&
          new Date(m.created_at).getTime() > new Date(ultimaLeitura).getTime()
      ).length;

      const partsDesta = partLocais.filter((p) => p.conversa_id === conv.id && !p.saiu_em);

      let outroUsuario: ChatConversa['outro_usuario'] = null;
      if (conv.tipo === 'individual') {
        const outro = partsDesta.find((p) => p.usuario_id !== usuarioId);
        if (outro) {
          const u = usuariosMap.get(outro.usuario_id);
          if (u) {
            outroUsuario = {
              id: u.id,
              nome: u.nome,
              codigo: u.codigo,
              unidade_negocio: u.unidade_negocio,
              departamento: u.departamento,
              foto: u.foto,
              nivel: u.nivel,
            };
          }
        }
      }

      // Identifica se alguma mensagem não lida foi enviada por gestor (Regra Item 4)
      let temNaoLidasGestor = false;
      if (naoLidas > 0) {
        if (conv.tipo === 'individual' && outroUsuario) {
          const niv = (outroUsuario.nivel || '').toLowerCase().trim();
          temNaoLidasGestor = niv === 'gestor' || niv === 'administrador';
        } else {
          const msgsNaoLidas = msgsDesta.filter(
            (m) =>
              m.remetente_id !== usuarioId &&
              new Date(m.created_at).getTime() > new Date(ultimaLeitura).getTime()
          );
          temNaoLidasGestor = msgsNaoLidas.some((m) => {
            const autor = usuariosMap.get(m.remetente_id);
            const niv = (autor?.nivel || '').toLowerCase().trim();
            return niv === 'gestor' || niv === 'administrador';
          });
        }
      }

      resultado.push({
        ...conv,
        ultima_mensagem: ultimaMsg,
        nao_lidas: naoLidas,
        tem_nao_lidas_gestor: temNaoLidasGestor,
        outro_usuario: outroUsuario,
        participantes_count: partsDesta.length,
      });
    }

    return resultado.sort(
      (a, b) => new Date(b.ultima_mensagem_em).getTime() - new Date(a.ultima_mensagem_em).getTime()
    );
  },

  /**
   * Obtém a conversa individual existente entre dois usuários ou cria uma nova se ainda não existir.
   * Garante a regra: IMPEDIR conversas individuais duplicadas para o mesmo par de usuários.
   */
  async obterOuCriarConversaIndividual(
    usuarioAtualId: string,
    outroUsuarioId: string,
    unidadeNegocioId?: string | null
  ): Promise<ChatConversa> {
    if (!usuarioAtualId || !outroUsuarioId) {
      throw new Error('Par de usuários inválido para conversa.');
    }
    if (usuarioAtualId === outroUsuarioId) {
      throw new Error('Não é possível criar conversa individual consigo mesmo.');
    }

    const supabase = getSupabase();
    const agora = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Busca se já existe conversa individual com ambos os participantes
        const { data: participacoesAtual } = await supabase
          .from('chat_participantes')
          .select('conversa_id')
          .eq('usuario_id', usuarioAtualId);

        const convIdsAtual = (participacoesAtual || []).map((p) => p.conversa_id);

        if (convIdsAtual.length > 0) {
          const { data: conversasIndividuais } = await supabase
            .from('chat_conversas')
            .select('id, tipo, nome, criado_por, unidade_negocio_id, ativo, created_at, ultima_mensagem_em')
            .in('id', convIdsAtual)
            .eq('tipo', 'individual')
            .eq('ativo', true);

          if (conversasIndividuais && conversasIndividuais.length > 0) {
            const indIds = conversasIndividuais.map((c) => c.id);
            const { data: matchOutro } = await supabase
              .from('chat_participantes')
              .select('conversa_id')
              .in('conversa_id', indIds)
              .eq('usuario_id', outroUsuarioId)
              .limit(1);

            if (matchOutro && matchOutro.length > 0) {
              const existente = conversasIndividuais.find((c) => c.id === matchOutro[0].conversa_id);
              if (existente) {
                return existente as ChatConversa;
              }
            }
          }
        }

        // 2. Não existe conversa: cria registro consistente em chat_conversas
        const novaConversaId = generateUUID();
        const novaConversaPayload = {
          id: novaConversaId,
          tipo: 'individual' as const,
          nome: null,
          criado_por: usuarioAtualId,
          unidade_negocio_id: unidadeNegocioId || null,
          ativo: true,
          created_at: agora,
          ultima_mensagem_em: agora,
        };

        const { data: convCriada, error: errCriar } = await supabase
          .from('chat_conversas')
          .insert(novaConversaPayload)
          .select()
          .single();

        if (!errCriar && convCriada) {
          // Cria vínculos em chat_participantes
          const participantesPayload = [
            {
              id: generateUUID(),
              conversa_id: novaConversaId,
              usuario_id: usuarioAtualId,
              ultima_leitura_em: agora,
              entrou_em: agora,
              saiu_em: null,
              created_at: agora,
            },
            {
              id: generateUUID(),
              conversa_id: novaConversaId,
              usuario_id: outroUsuarioId,
              ultima_leitura_em: agora,
              entrou_em: agora,
              saiu_em: null,
              created_at: agora,
            },
          ];

          await supabase.from('chat_participantes').insert(participantesPayload);
          notificarAtualizacaoChat(novaConversaId);
          return convCriada as ChatConversa;
        }
      } catch (err) {
        console.warn('[ChatService] Fallback ao criar conversa individual via Supabase:', err);
      }
    }

    // Fallback local com garantia de não duplicação
    const conversas = getLocalConversas();
    const participantes = getLocalParticipantes();

    // Procura existente
    for (const conv of conversas) {
      if (conv.tipo === 'individual' && conv.ativo !== false) {
        const parts = participantes.filter((p) => p.conversa_id === conv.id);
        const temAtual = parts.some((p) => p.usuario_id === usuarioAtualId);
        const temOutro = parts.some((p) => p.usuario_id === outroUsuarioId);
        if (temAtual && temOutro) {
          return conv;
        }
      }
    }

    // Cria nova
    const novaId = generateUUID();
    const novaConv: ChatConversa = {
      id: novaId,
      tipo: 'individual',
      nome: null,
      criado_por: usuarioAtualId,
      unidade_negocio_id: unidadeNegocioId || null,
      ativo: true,
      created_at: agora,
      ultima_mensagem_em: agora,
    };
    conversas.unshift(novaConv);
    saveLocalConversas(conversas);

    participantes.push(
      {
        id: generateUUID(),
        conversa_id: novaId,
        usuario_id: usuarioAtualId,
        ultima_leitura_em: agora,
        entrou_em: agora,
        saiu_em: null,
        created_at: agora,
      },
      {
        id: generateUUID(),
        conversa_id: novaId,
        usuario_id: outroUsuarioId,
        ultima_leitura_em: agora,
        entrou_em: agora,
        saiu_em: null,
        created_at: agora,
      }
    );
    saveLocalParticipantes(participantes);
    notificarAtualizacaoChat(novaId);
    return novaConv;
  },

  /**
   * Cria um grupo de mensagens.
   * Regra Obrigatória da Seção 4: Somente usuários com nível gestor podem criar grupos.
   */
  async criarGrupo(
    criador: Usuario,
    nomeGrupo: string,
    participantesIds: string[],
    unidadeNegocioId?: string | null
  ): Promise<ChatConversa> {
    const nivelNorm = (criador.nivel || '').toLowerCase().trim();
    if (nivelNorm !== 'gestor' && nivelNorm !== 'administrador') {
      throw new Error('Apenas usuários com perfil "gestor" têm permissão para criar grupos.');
    }
    if (!nomeGrupo.trim()) {
      throw new Error('Por favor, informe um nome para o grupo.');
    }

    // Garante que o criador está na lista de participantes
    const idsFinais = Array.from(new Set([criador.id, ...participantesIds.filter(Boolean)]));
    if (idsFinais.length < 2) {
      throw new Error('Selecione ao menos um participante adicional para compor o grupo.');
    }

    const agora = new Date().toISOString();
    const novoGrupoId = generateUUID();
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        const payloadGrupo = {
          id: novoGrupoId,
          tipo: 'grupo' as const,
          nome: nomeGrupo.trim(),
          criado_por: criador.id,
          unidade_negocio_id: unidadeNegocioId || null,
          ativo: true,
          created_at: agora,
          ultima_mensagem_em: agora,
        };

        const { data: grupoCriado, error: errGrupo } = await supabase
          .from('chat_conversas')
          .insert(payloadGrupo)
          .select()
          .single();

        if (!errGrupo && grupoCriado) {
          const participantesPayload = idsFinais.map((uId) => ({
            id: generateUUID(),
            conversa_id: novoGrupoId,
            usuario_id: uId,
            ultima_leitura_em: agora,
            entrou_em: agora,
            saiu_em: null,
            created_at: agora,
          }));

          await supabase.from('chat_participantes').insert(participantesPayload);
          notificarAtualizacaoChat(novoGrupoId);
          return grupoCriado as ChatConversa;
        }
      } catch (err) {
        console.warn('[ChatService] Fallback ao criar grupo via Supabase:', err);
      }
    }

    // Fallback local
    const conversas = getLocalConversas();
    const participantes = getLocalParticipantes();

    const novoGrupo: ChatConversa = {
      id: novoGrupoId,
      tipo: 'grupo',
      nome: nomeGrupo.trim(),
      criado_por: criador.id,
      unidade_negocio_id: unidadeNegocioId || null,
      ativo: true,
      created_at: agora,
      ultima_mensagem_em: agora,
      participantes_count: idsFinais.length,
    };
    conversas.unshift(novoGrupo);
    saveLocalConversas(conversas);

    idsFinais.forEach((uId) => {
      participantes.push({
        id: generateUUID(),
        conversa_id: novoGrupoId,
        usuario_id: uId,
        ultima_leitura_em: agora,
        entrou_em: agora,
        saiu_em: null,
        created_at: agora,
      });
    });
    saveLocalParticipantes(participantes);
    notificarAtualizacaoChat(novoGrupoId);
    return novoGrupo;
  },

  /**
   * Carrega histórico com paginação eficiente de 30 mensagens.
   * Se informado cursor (antesDeTimestamp), busca as 30 anteriores àquele ponto (rolagem para cima).
   */
  async listarMensagens(
    conversaId: string,
    opcoes?: {
      limite?: number;
      antesDeTimestamp?: string;
    }
  ): Promise<{ mensagens: ChatMensagem[]; temMais: boolean }> {
    if (!conversaId) return { mensagens: [], temMais: false };
    const limite = opcoes?.limite || CHAT_PAGE_SIZE;
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('chat_mensagens')
          .select('id, conversa_id, remetente_id, conteudo, created_at')
          .eq('conversa_id', conversaId)
          .order('created_at', { ascending: false })
          .limit(limite + 1);

        if (opcoes?.antesDeTimestamp) {
          query = query.lt('created_at', opcoes.antesDeTimestamp);
        }

        const { data, error } = await query;
        if (!error && data) {
          const temMais = data.length > limite;
          const slice = temMais ? data.slice(0, limite) : data;

          // Resolve nomes de remetentes via cache leve
          const usuariosCadastrados = await usuariosService.listarTodos();
          const userMap = new Map<string, Usuario>();
          usuariosCadastrados.forEach((u) => userMap.set(u.id, u));

          const mensagensEnriquecidas: ChatMensagem[] = slice.map((m) => {
            const u = userMap.get(m.remetente_id);
            return {
              ...m,
              remetente_nome: u?.nome || 'Colaborador',
              remetente_codigo: u?.codigo || '',
            };
          });

          // Retorna em ordem cronológica (mais antigas no topo, mais recentes no fim)
          return {
            mensagens: mensagensEnriquecidas.reverse(),
            temMais,
          };
        }
      } catch (err) {
        console.warn('[ChatService] Fallback ao listar mensagens via Supabase:', err);
      }
    }

    // Fallback local
    const todas = getLocalMensagens().filter((m) => m.conversa_id === conversaId);
    let filtradas = todas;
    if (opcoes?.antesDeTimestamp) {
      const cursorTime = new Date(opcoes.antesDeTimestamp).getTime();
      filtradas = todas.filter((m) => new Date(m.created_at).getTime() < cursorTime);
    }
    filtradas.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const temMais = filtradas.length > limite;
    const slice = temMais ? filtradas.slice(0, limite) : filtradas;

    const todosUsuarios = await usuariosService.listarTodos();
    const userMap = new Map<string, Usuario>();
    todosUsuarios.forEach((u) => userMap.set(u.id, u));

    const mensagensEnriquecidas = slice.map((m) => {
      const u = userMap.get(m.remetente_id);
      return {
        ...m,
        remetente_nome: u?.nome || 'Colaborador',
        remetente_codigo: u?.codigo || '',
      };
    });

    return {
      mensagens: mensagensEnriquecidas.reverse(),
      temMais,
    };
  },

  /**
   * Envia mensagem de texto em uma conversa.
   * Atualiza chat_conversas.ultima_mensagem_em e a última leitura do remetente.
   */
  async enviarMensagem(
    conversaId: string,
    remetenteId: string,
    conteudo: string
  ): Promise<ChatMensagem> {
    const textoLimpo = conteudo.trim();
    if (!textoLimpo) {
      throw new Error('A mensagem não pode ser vazia.');
    }
    if (textoLimpo.length > 4000) {
      throw new Error('Mensagem muito longa. O limite é de 4.000 caracteres.');
    }

    const agora = new Date().toISOString();
    const msgId = generateUUID();
    const supabase = getSupabase();

    const payload: ChatMensagem = {
      id: msgId,
      conversa_id: conversaId,
      remetente_id: remetenteId,
      conteudo: textoLimpo,
      created_at: agora,
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('chat_mensagens')
          .insert(payload)
          .select('id, conversa_id, remetente_id, conteudo, created_at')
          .single();

        if (!error && data) {
          // Atualiza ultima_mensagem_em da conversa
          await supabase
            .from('chat_conversas')
            .update({ ultima_mensagem_em: agora })
            .eq('id', conversaId);

          // Atualiza ultima_leitura_em do remetente
          await supabase
            .from('chat_participantes')
            .update({ ultima_leitura_em: agora })
            .eq('conversa_id', conversaId)
            .eq('usuario_id', remetenteId);

          notificarAtualizacaoChat(conversaId);
          return data as ChatMensagem;
        }
      } catch (err) {
        console.warn('[ChatService] Fallback ao enviar mensagem via Supabase:', err);
      }
    }

    // Fallback local
    const mensagens = getLocalMensagens();
    mensagens.push(payload);
    saveLocalMensagens(mensagens);

    // Atualiza conversa
    const conversas = getLocalConversas();
    const idxConv = conversas.findIndex((c) => c.id === conversaId);
    if (idxConv >= 0) {
      conversas[idxConv].ultima_mensagem_em = agora;
      saveLocalConversas(conversas);
    }

    // Atualiza ultima leitura do remetente
    const participantes = getLocalParticipantes();
    const idxPart = participantes.findIndex((p) => p.conversa_id === conversaId && p.usuario_id === remetenteId);
    if (idxPart >= 0) {
      participantes[idxPart].ultima_leitura_em = agora;
      saveLocalParticipantes(participantes);
    }

    notificarAtualizacaoChat(conversaId);
    return payload;
  },

  /**
   * Atualiza chat_participantes.ultima_leitura_em para zerar o contador de não lidas ao abrir a conversa.
   */
  async marcarComoLida(conversaId: string, usuarioId: string): Promise<void> {
    if (!conversaId || !usuarioId) return;
    const agora = new Date().toISOString();
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('chat_participantes')
          .update({ ultima_leitura_em: agora })
          .eq('conversa_id', conversaId)
          .eq('usuario_id', usuarioId);
      } catch (err) {
        console.warn('[ChatService] Fallback ao marcar como lida via Supabase:', err);
      }
    }

    const participantes = getLocalParticipantes();
    const idx = participantes.findIndex((p) => p.conversa_id === conversaId && p.usuario_id === usuarioId);
    if (idx >= 0) {
      participantes[idx].ultima_leitura_em = agora;
      saveLocalParticipantes(participantes);
    }

    notificarAtualizacaoChat(conversaId);
  },

  /**
   * Obtém total de mensagens não lidas do usuário em todas as suas conversas ativas.
   */
  async obterTotalNaoLidas(usuarioId: string): Promise<number> {
    if (!usuarioId) return 0;
    const conversas = await this.listarConversasDoUsuario(usuarioId);
    return conversas.reduce((acc, c) => acc + (c.nao_lidas || 0), 0);
  },

  /**
   * Pesquisa e lista usuários ativos autorizados por Unidade de Negócio para iniciar nova conversa.
   * Não carrega todos os usuários desnecessariamente.
   */
  async pesquisarUsuariosPorUnidade(
    unidadeNome: string,
    filtroTexto = '',
    limite = 30
  ): Promise<ChatUsuarioContato[]> {
    const supabase = getSupabase();
    const termo = filtroTexto.trim().toLowerCase();
    const mapaAcessos = await usuariosService.obterMapaUltimosAcessos();

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('usuarios')
          .select('id, nome, codigo, unidade_negocio, departamento, funcao, nivel, foto, status')
          .order('nome', { ascending: true })
          .limit(limite);

        if (unidadeNome && unidadeNome !== 'todas') {
          query = query.ilike('unidade_negocio', `%${unidadeNome}%`);
        }

        const { data, error } = await query;
        if (!error && data) {
          const filtrados = (data as Usuario[])
            .filter((u) => {
              const status = (u.status || 'aprovado').toLowerCase();
              if (status === 'desativado' || status === 'inativo' || status === 'pendente') return false;
              if (!termo) return true;
              return (
                (u.nome || '').toLowerCase().includes(termo) ||
                (u.codigo || '').toLowerCase().includes(termo) ||
                (u.departamento || '').toLowerCase().includes(termo)
              );
            })
            .map((u) => ({
              id: u.id,
              nome: u.nome,
              codigo: u.codigo,
              unidade_negocio: u.unidade_negocio,
              departamento: u.departamento,
              funcao: u.funcao,
              nivel: u.nivel,
              foto: u.foto,
              status: u.status,
              ultimo_acesso: mapaAcessos[u.id] || null,
            }));

          return filtrados;
        }
      } catch (err) {
        console.warn('[ChatService] Fallback ao pesquisar usuarios por unidade via Supabase:', err);
      }
    }

    // Fallback local
    const todos = await usuariosService.listarTodos();
    return todos
      .filter((u) => {
        const status = (u.status || 'aprovado').toLowerCase();
        if (status === 'desativado' || status === 'inativo' || status === 'pendente') return false;
        if (unidadeNome && unidadeNome !== 'todas') {
          const matchUnidade = (u.unidade_negocio || '').toLowerCase().includes(unidadeNome.toLowerCase());
          if (!matchUnidade) return false;
        }
        if (!termo) return true;
        return (
          (u.nome || '').toLowerCase().includes(termo) ||
          (u.codigo || '').toLowerCase().includes(termo) ||
          (u.departamento || '').toLowerCase().includes(termo)
        );
      })
      .slice(0, limite)
      .map((u) => ({
        id: u.id,
        nome: u.nome,
        codigo: u.codigo,
        unidade_negocio: u.unidade_negocio,
        departamento: u.departamento,
        funcao: u.funcao,
        nivel: u.nivel,
        foto: u.foto,
        status: u.status,
        ultimo_acesso: mapaAcessos[u.id] || null,
      }));
  },

  /**
   * Assina atualizações Realtime para mensagens no Supabase.
   * Retorna callback de unsubscribe.
   */
  assinarRealtimeMensagens(onNovaMensagem: (msg: ChatMensagem) => void): () => void {
    const supabase = getSupabase();
    if (!isSupabaseConfigured || !supabase) {
      const handler = (e: Event) => {
        const custom = e as CustomEvent<{ conversaId?: string }>;
        if (custom.detail?.conversaId) {
          // Trigger local
        }
      };
      if (typeof window !== 'undefined') {
        window.addEventListener('polihub_chat_update', handler);
      }
      return () => {
        if (typeof window !== 'undefined') {
          window.removeEventListener('polihub_chat_update', handler);
        }
      };
    }

    try {
      const channel = supabase
        .channel('chat_mensagens_realtime')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_mensagens' },
          (payload) => {
            if (payload.new) {
              onNovaMensagem(payload.new as ChatMensagem);
              notificarAtualizacaoChat((payload.new as ChatMensagem).conversa_id);
            }
          }
        )
        .subscribe();

      const localHandler = () => {
        // evento local para quando inserções ocorrem no próprio client
      };
      if (typeof window !== 'undefined') {
        window.addEventListener('polihub_chat_update', localHandler);
      }

      return () => {
        try {
          supabase.removeChannel(channel);
        } catch {}
        if (typeof window !== 'undefined') {
          window.removeEventListener('polihub_chat_update', localHandler);
        }
      };
    } catch (err) {
      console.warn('[ChatService] Não foi possível assinar canal Realtime:', err);
      return () => {};
    }
  },
};
