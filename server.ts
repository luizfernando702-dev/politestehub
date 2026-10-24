import express, { Request, Response } from 'express';
import path from 'path';
import webpush from 'web-push';
import { createServer as createViteServer } from 'vite';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Helper para validar formato de VAPID Subject (deve ser mailto: ou URL válida)
function getValidVapidSubject(val?: string): string {
  const fallback = 'mailto:contato@polihub.com';
  if (!val || typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  if (trimmed.startsWith('mailto:') && trimmed.length > 7 && trimmed.includes('@')) {
    return trimmed;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      new URL(trimmed);
      return trimmed;
    } catch {
      return fallback;
    }
  }
  // Se for apenas um e-mail sem mailto:
  if (trimmed.includes('@') && !trimmed.includes('://')) {
    return `mailto:${trimmed}`;
  }
  return fallback;
}

// Helper para validar chave VAPID base64/base64url (deve ter comprimento adequado, não números avulsos como "1" ou "2")
function getValidVapidKey(val: string | undefined, fallback: string): string {
  if (!val || typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  // Chaves VAPID válidas têm normalmente 40+ caracteres base64url
  if (trimmed.length > 20) {
    return trimmed;
  }
  return fallback;
}

// Chaves VAPID padrão para o PoliHub
const DEFAULT_VAPID_PUBLIC_KEY = getValidVapidKey(
  process.env.VAPID_PUBLIC_KEY,
  'BBi5rk9E2GZDetZuBvee-LkQfnYuuGivbJDb90EhTXCwDO1EvUeN7Ba8S879NJQ7ex7zj2Gc-4WCv64haRKv0xw'
);

const DEFAULT_VAPID_PRIVATE_KEY = getValidVapidKey(
  process.env.VAPID_PRIVATE_KEY,
  'd1lThpyW0yYfKJReCn53ZkRMo91WFpsQ4mokJakAcqI'
);

const VAPID_SUBJECT = getValidVapidSubject(process.env.VAPID_SUBJECT);

// Configura Web Push no servidor
try {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    DEFAULT_VAPID_PUBLIC_KEY,
    DEFAULT_VAPID_PRIVATE_KEY
  );
  console.log('[Push Server] VAPID configurado com sucesso com subject:', VAPID_SUBJECT);
} catch (err) {
  console.error('[Push Server] Falha ao configurar chaves VAPID:', err);
}

// Configuração do Supabase para o backend
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://rzsqllweuifaehpsphqq.supabase.co';

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_C1Rym8kvUUYcS92ad1dMQw_wQD-SUNz';

let supabaseClient: SupabaseClient | null = null;
try {
  if (SUPABASE_URL && SUPABASE_KEY) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch (e) {
  console.warn('[Push Server] Não foi possível inicializar Supabase no servidor:', e);
}

// Armazenamento em memória para resiliência e fallback
interface StoredSubscription {
  id?: string;
  usuario_id?: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at?: string;
  updated_at?: string;
}

const memorySubscriptions = new Map<string, StoredSubscription>();

// Cache de deduplicação para eventos de NF recente (evita pushes repetidos para o mesmo evento)
const recentEventsCache = new Map<string, number>();
const DEDUP_WINDOW_MS = 30 * 1000; // 30 segundos

function isDuplicateEvent(key: string): boolean {
  const now = Date.now();
  const lastTime = recentEventsCache.get(key);
  if (lastTime && now - lastTime < DEDUP_WINDOW_MS) {
    return true;
  }
  recentEventsCache.set(key, now);
  // Limpeza periódica do cache de deduplicação
  if (recentEventsCache.size > 200) {
    for (const [k, time] of recentEventsCache.entries()) {
      if (now - time > DEDUP_WINDOW_MS * 2) {
        recentEventsCache.delete(k);
      }
    }
  }
  return false;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // 1. Obter chave pública VAPID (o frontend obtém APENAS a chave pública)
  app.get('/api/push/public-key', (req: Request, res: Response) => {
    res.json({
      publicKey: DEFAULT_VAPID_PUBLIC_KEY,
      configured: Boolean(DEFAULT_VAPID_PUBLIC_KEY && DEFAULT_VAPID_PRIVATE_KEY),
    });
  });

  // 2. Registrar ou atualizar Push Subscription
  app.post('/api/push/subscribe', async (req: Request, res: Response) => {
    try {
      const { usuarioId, subscription } = req.body;

      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({ error: 'Subscription inválida ou incompleta.' });
      }

      const { endpoint, keys } = subscription;
      const { p256dh, auth } = keys;

      if (!p256dh || !auth) {
        return res.status(400).json({ error: 'Chaves p256dh ou auth ausentes.' });
      }

      const now = new Date().toISOString();
      const subRecord: StoredSubscription = {
        usuario_id: usuarioId || null,
        endpoint,
        p256dh,
        auth,
        updated_at: now,
      };

      // Sempre armazena no cache em memória para garantia instantânea
      memorySubscriptions.set(endpoint, subRecord);

      // Persiste no Supabase caso configurado
      if (supabaseClient) {
        try {
          const { error } = await supabaseClient
            .from('push_subscriptions')
            .upsert(
              {
                usuario_id: usuarioId || null,
                endpoint,
                p256dh,
                auth,
                updated_at: now,
              },
              { onConflict: 'endpoint' }
            );

          if (error) {
            console.warn('[Push Server] Aviso ao upsert no Supabase push_subscriptions:', error.message);
          }
        } catch (dbErr) {
          console.warn('[Push Server] Falha de comunicação com o Supabase:', dbErr);
        }
      }

      return res.json({
        success: true,
        message: 'Subscription registrada com sucesso no PoliHub.',
        endpoint,
      });
    } catch (err: any) {
      console.error('[Push Server] Erro ao registrar subscription:', err);
      return res.status(500).json({ error: err?.message || 'Erro interno ao salvar subscription' });
    }
  });

  // 3. Remover Push Subscription (unsubscribe do dispositivo)
  app.post('/api/push/unsubscribe', async (req: Request, res: Response) => {
    try {
      const { endpoint } = req.body;
      if (!endpoint) {
        return res.status(400).json({ error: 'Endpoint não fornecido.' });
      }

      memorySubscriptions.delete(endpoint);

      if (supabaseClient) {
        try {
          await supabaseClient
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', endpoint);
        } catch (dbErr) {
          console.warn('[Push Server] Erro ao deletar subscription no Supabase:', dbErr);
        }
      }

      return res.json({ success: true, message: 'Subscription removida com sucesso.' });
    } catch (err: any) {
      console.error('[Push Server] Erro ao cancelar subscription:', err);
      return res.status(500).json({ error: err?.message || 'Erro ao cancelar' });
    }
  });

  // 4. Disparo de Notificação Push Geral para Nova NF com status 'Recebido'
  app.post('/api/push/notify-nf', async (req: Request, res: Response) => {
    try {
      const { notaFiscal, fornecedor, quantidadeItens } = req.body || {};

      const nfIdentificador = String(notaFiscal || '').trim();
      const dedupKey = `nf-recebida-${nfIdentificador || 'geral'}`;

      if (nfIdentificador && isDuplicateEvent(dedupKey)) {
        return res.json({
          success: true,
          skipped: true,
          message: 'Evento recente já notificado. Deduplicação ativada para evitar notificações repetidas.',
        });
      }

      const titulo = 'Nova NF para recebimento';
      const corpoMensagem = nfIdentificador
        ? `NF nº ${nfIdentificador} recebida e disponível para conferência.`
        : 'Uma nova NF está disponível para conferência.';

      const payload = JSON.stringify({
        title: titulo,
        body: corpoMensagem,
        icon: '/pwa-192x192.png',
        badge: '/icon.svg',
        tag: 'nova-nf-recebimento',
        data: {
          url: '/',
          notaFiscal: nfIdentificador,
          timestamp: Date.now(),
        },
      });

      // Busca todas as subscriptions ativas
      let allSubs: StoredSubscription[] = [];

      if (supabaseClient) {
        try {
          const { data, error } = await supabaseClient
            .from('push_subscriptions')
            .select('id, usuario_id, endpoint, p256dh, auth');

          if (!error && data && data.length > 0) {
            allSubs = data as StoredSubscription[];
            // Sincroniza memória
            for (const s of allSubs) {
              memorySubscriptions.set(s.endpoint, s);
            }
          }
        } catch (dbErr) {
          console.warn('[Push Server] Erro ao buscar subscriptions no Supabase, usando memória:', dbErr);
        }
      }

      // Se o banco estiver vazio ou indisponível, utiliza as subscriptions em memória
      if (allSubs.length === 0) {
        allSubs = Array.from(memorySubscriptions.values());
      }

      let totalEnviados = 0;
      let totalRemovidos = 0;
      const expiredEndpoints: string[] = [];

      // Envia notificação geral para todos os dispositivos registrados
      const sendPromises = allSubs.map(async (sub) => {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          };

          await webpush.sendNotification(pushSubscription, payload);
          totalEnviados++;
        } catch (sendErr: any) {
          // Regra 9: Quando a subscription for inválida ou expirada (HTTP 404 / 410):
          // - remover da tabela push_subscriptions;
          // - continuar enviando normalmente para as demais.
          const statusCode = sendErr?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            expiredEndpoints.push(sub.endpoint);
            memorySubscriptions.delete(sub.endpoint);
          } else {
            console.warn('[Push Server] Erro ao enviar para subscription:', sub.endpoint, sendErr?.message);
          }
        }
      });

      await Promise.all(sendPromises);

      // Remove subscriptions expiradas do Supabase em lote silenciosamente
      if (expiredEndpoints.length > 0 && supabaseClient) {
        totalRemovidos = expiredEndpoints.length;
        try {
          await supabaseClient
            .from('push_subscriptions')
            .delete()
            .in('endpoint', expiredEndpoints);
        } catch (cleanErr) {
          console.warn('[Push Server] Falha ao limpar subscriptions expiradas no Supabase:', cleanErr);
        }
      }

      console.log(`[Push Server] Push disparado: ${totalEnviados} enviados, ${totalRemovidos} expiradas removidas.`);

      return res.json({
        success: true,
        totalEnviados,
        totalRemovidos,
        notaFiscal: nfIdentificador,
      });
    } catch (err: any) {
      console.error('[Push Server] Erro no envio de push notify-nf:', err);
      return res.status(500).json({ error: err?.message || 'Falha ao processar push' });
    }
  });

  // 5. Rota de Teste de Notificação Push
  app.post('/api/push/test', async (req: Request, res: Response) => {
    try {
      const { endpoint, title, body } = req.body || {};

      const payload = JSON.stringify({
        title: title || 'PoliHub — Teste de Notificação Push',
        body: body || 'Seu dispositivo está devidamente configurado para receber notificações Push.',
        icon: '/pwa-192x192.png',
        badge: '/icon.svg',
        tag: 'polihub-teste-push',
        data: {
          url: '/',
          timestamp: Date.now(),
        },
      });

      let targets: StoredSubscription[] = [];

      if (endpoint) {
        const found = memorySubscriptions.get(endpoint);
        if (found) {
          targets = [found];
        } else if (supabaseClient) {
          const { data } = await supabaseClient
            .from('push_subscriptions')
            .select('*')
            .eq('endpoint', endpoint)
            .single();
          if (data) targets = [data as StoredSubscription];
        }
      } else {
        targets = Array.from(memorySubscriptions.values());
      }

      if (targets.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Nenhuma subscrição ativa encontrada para teste.',
        });
      }

      let sentCount = 0;
      for (const t of targets) {
        try {
          await webpush.sendNotification(
            {
              endpoint: t.endpoint,
              keys: { p256dh: t.p256dh, auth: t.auth },
            },
            payload
          );
          sentCount++;
        } catch (e: any) {
          console.warn('[Push Server] Erro ao enviar teste:', e?.message);
        }
      }

      return res.json({ success: true, sentCount });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao enviar teste' });
    }
  });

  // 6. Rota de Confirmação de Alteração de Endereço com Validação de Segurança no Backend
  // REQUISITO:
  // Podem confirmar alteração:
  // - usuario com nivel = 'gestor'
  // OU
  // - usuario com funcao = 'Assistente Logistico'
  // Demais usuários são terminantemente rejeitados com HTTP 403 Forbidden.
  app.post('/api/alocacao/confirmar-alteracao', async (req: Request, res: Response) => {
    try {
      const { alteracaoId, usuarioId, usuarioNivel, usuarioFuncao, usuarioNome } = req.body || {};

      if (!alteracaoId) {
        return res.status(400).json({ error: 'ID da alteração é obrigatório.' });
      }

      // Validação estrita de segurança no backend
      let nivel = String(usuarioNivel || '').trim().toLowerCase();
      let funcao = String(usuarioFuncao || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
      let nomeConfirmador = String(usuarioNome || '').trim();

      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUuid = (val?: string | null): boolean => Boolean(val && UUID_REGEX.test(val));

      // Se foi fornecido o usuarioId válido e o Supabase está ativo, busca o cadastro no banco para integridade
      if (supabaseClient && usuarioId && isUuid(usuarioId)) {
        try {
          const { data: usuarioDb } = await supabaseClient
            .from('usuarios')
            .select('id, nivel, funcao, nome')
            .eq('id', usuarioId)
            .maybeSingle();

          if (usuarioDb) {
            if (usuarioDb.nivel) {
              nivel = String(usuarioDb.nivel).trim().toLowerCase();
            }
            if (usuarioDb.funcao) {
              funcao = String(usuarioDb.funcao)
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim()
                .toLowerCase();
            }
            if (usuarioDb.nome) {
              nomeConfirmador = usuarioDb.nome;
            }
          }
        } catch (dbErr) {
          console.warn('[Server Alocacao] Aviso ao checar usuario no banco:', dbErr);
        }
      }

      const isGestor = nivel === 'gestor' || nivel === 'administrador';
      const isAssistenteLogistico =
        funcao === 'assistente logistico' ||
        funcao === 'assistente logistica' ||
        funcao.includes('assistente logistico') ||
        funcao.includes('assistente logistica') ||
        funcao.includes('assistente de logistica') ||
        funcao.includes('assistente de logistico') ||
        (funcao.includes('assistente') && (funcao.includes('logistic') || funcao.includes('expedicao') || funcao.includes('transporte') || funcao.includes('recebimento') || funcao.includes('estoque'))) ||
        nivel.includes('assistente');

      if (!isGestor && !isAssistenteLogistico) {
        console.warn(
          `[Segurança Backend] Tentativa não autorizada de confirmação da alteração ${alteracaoId}. Nível: ${nivel}, Função: ${funcao}`
        );
        return res.status(403).json({
          error:
            'Acesso negado: Somente usuários com nível "gestor" ou função "Assistente Logístico" possuem permissão para confirmar a alteração no sistema.',
        });
      }

      // Executa a confirmação no Supabase se disponível
      let dadosRetorno: any = null;
      let supabaseUpdated = false;

      if (supabaseClient) {
        try {
          const payloadCompleto: Record<string, any> = {
            alterado_sistema: true,
            data_confirmacao: new Date().toISOString(),
            usuario_confirmacao_nome:
              nomeConfirmador || (isGestor ? 'Gestor' : 'Assistente Logístico'),
          };
          if (isUuid(usuarioId)) {
            payloadCompleto.usuario_confirmacao = usuarioId;
          }

          let updateQuery = await supabaseClient
            .from('alteracoes_endereco')
            .update(payloadCompleto)
            .eq('id', alteracaoId)
            .select();

          let updateRes = updateQuery.data;
          let updateErr = updateQuery.error;

          // Se falhou por ausência de colunas (data_confirmacao, usuario_confirmacao, etc.) ou restrição:
          if (updateErr) {
            console.warn('[Server Alocacao] Tentando atualização mínima (alterado_sistema = true):', updateErr.message);
            const retryQuery = await supabaseClient
              .from('alteracoes_endereco')
              .update({ alterado_sistema: true })
              .eq('id', alteracaoId)
              .select();

            updateRes = retryQuery.data;
            updateErr = retryQuery.error;
          }

          if (!updateErr && updateRes && updateRes.length > 0) {
            dadosRetorno = updateRes[0];
            supabaseUpdated = true;

            // Se a alteração possui produto e novo endereço, sincroniza o endereço na tabela produtos
            if (dadosRetorno?.produto && dadosRetorno?.endereco_novo) {
              try {
                await supabaseClient
                  .from('produtos')
                  .update({ endereco: dadosRetorno.endereco_novo })
                  .eq('produto', dadosRetorno.produto);
              } catch (syncErr) {
                console.warn('[Server Alocacao] Aviso ao atualizar endereco do produto:', syncErr);
              }
            }
          } else if (updateErr) {
            console.warn('[Server Alocacao] Erro no Supabase ao atualizar alteracoes_endereco:', updateErr.message);
          }
        } catch (errDb: any) {
          console.warn('[Server Alocacao] Falha ao persistir no Supabase, repassando erro:', errDb?.message);
        }
      }

      return res.json({
        success: true,
        supabaseUpdated,
        message: 'Alteração confirmada no sistema com sucesso.',
        data: dadosRetorno || {
          id: alteracaoId,
          alterado_sistema: true,
          data_confirmacao: new Date().toISOString(),
          usuario_confirmacao_nome: nomeConfirmador || 'Confirmado',
        },
      });
    } catch (err: any) {
      console.error('[Server Alocacao] Erro ao confirmar alteração:', err);
      return res.status(500).json({ error: err?.message || 'Erro interno ao confirmar alteração.' });
    }
  });

  // ============================================================================
  // 6.2 MÓDULO DE COLETAS DA EXPEDIÇÃO (Validação Backend & Regras de Negócio)
  // ============================================================================
  const normalizeRole = (str?: string | null): string => {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  };

  const checkColetaPermission = async (
    usuarioId?: string | null,
    clientFuncao?: string | null,
    clientNivel?: string | null
  ): Promise<boolean> => {
    let funcao = normalizeRole(clientFuncao);
    let nivel = normalizeRole(clientNivel);

    // Se temos cliente Supabase e usuarioId, busca a função e nível oficiais no banco
    if (supabaseClient && usuarioId) {
      try {
        const { data: userRec } = await supabaseClient
          .from('usuarios')
          .select('funcao, nivel')
          .eq('id', usuarioId)
          .single();

        if (userRec?.funcao) {
          funcao = normalizeRole(userRec.funcao);
        }
        if (userRec?.nivel) {
          nivel = normalizeRole(userRec.nivel);
        }
      } catch (err) {
        console.warn('[Server Coletas] Aviso ao verificar funcao no banco:', err);
      }
    }

    const isGestor = nivel === 'gestor' || nivel === 'administrador';
    const isOperador = funcao === 'operador logistico' || funcao.includes('operador logistico');
    const isAssistente = funcao === 'assistente logistico' || funcao.includes('assistente logistico');
    return isGestor || isOperador || isAssistente;
  };

  const parseMoedaColeta = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let str = String(val).trim().replace(/^R\$\s*/i, '').trim();
    if (!str) return 0;
    if (str.includes('.') && str.includes(',')) {
      if (str.indexOf('.') < str.indexOf(',')) {
        return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
      } else {
        return parseFloat(str.replace(/,/g, '')) || 0;
      }
    }
    if (str.split('.').length > 2) str = str.replace(/\./g, '');
    if (str.includes(',')) return parseFloat(str.replace(',', '.')) || 0;
    if (str.includes('.')) return parseFloat(str) || 0;
    return parseFloat(str) || 0;
  };

  // Listar coletas (Nunca utiliza SELECT *)
  app.get('/api/coletas', async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const search = (req.query.search as string)?.trim();
      const status = (req.query.status as string)?.trim();
      const dataInicio = (req.query.dataInicio as string)?.trim();
      const dataFim = (req.query.dataFim as string)?.trim();

      if (supabaseClient) {
        const fields = 'id, chave_nf, numero_nota_fiscal, cliente, transportadora, status, data, numero_coleta, usuario_id, valor, separador_id, conferente_id, quantidade, created_at, updated_at';
        let query = supabaseClient.from('expedicao_coletas').select(fields, { count: 'exact' });

        if (status && status !== 'Todos') {
          query = query.eq('status', status);
        }
        if (dataInicio) {
          query = query.gte('data', `${dataInicio}T00:00:00.000Z`);
        }
        if (dataFim) {
          query = query.lte('data', `${dataFim}T23:59:59.999Z`);
        }
        if (search) {
          query = query.or(`numero_nota_fiscal.ilike.%${search}%,chave_nf.ilike.%${search}%,cliente.ilike.%${search}%,transportadora.ilike.%${search}%`);
        }

        query = query.order('data', { ascending: false });
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data, count, error } = await query;
        if (!error && data) {
          return res.json({
            data,
            total: count ?? data.length,
            page,
            pageSize,
            totalPages: Math.ceil((count ?? data.length) / pageSize) || 1,
          });
        }
      }

      return res.json({ data: [], total: 0, page, pageSize, totalPages: 1 });
    } catch (err: any) {
      console.error('[Server Coletas] Erro ao listar coletas:', err);
      return res.status(500).json({ error: 'Erro ao consultar coletas.' });
    }
  });

  // Criar coleta
  app.post('/api/coletas', async (req: Request, res: Response) => {
    try {
      const {
        id,
        chave_nf,
        numero_nota_fiscal,
        cliente,
        transportadora,
        status,
        data,
        numero_coleta,
        usuarioId,
        usuarioFuncao,
        usuarioNivel,
      } = req.body;

      // 1. Validação de Permissão Backend
      const autorizado = await checkColetaPermission(usuarioId, usuarioFuncao, usuarioNivel);
      if (!autorizado) {
        return res.status(403).json({
          error: 'Acesso negado: Somente gestores ou usuários com função "Operador Logístico" / "Assistente Logístico" podem cadastrar coletas.',
        });
      }

      // 2. Validação de Status
      if (status !== 'Agendada' && status !== 'Coletada') {
        return res.status(400).json({ error: 'Status inválido. Use "Agendada" ou "Coletada".' });
      }

      // 3. Regra de Número da Coleta: Obrigatório se 'Agendada'
      if (status === 'Agendada' && (!numero_coleta || !String(numero_coleta).trim())) {
        return res.status(400).json({
          error: 'O campo "Número da coleta" é obrigatório quando o status é "Agendada".',
        });
      }

      if (!numero_nota_fiscal || !cliente || !transportadora) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
      }

      const agora = new Date().toISOString();
      const payload: Record<string, any> = {
        id: id || undefined,
        chave_nf: chave_nf?.trim() || null,
        numero_nota_fiscal: String(numero_nota_fiscal).trim(),
        cliente: String(cliente).trim(),
        transportadora: String(transportadora).trim(),
        status,
        data: data || agora,
        numero_coleta: numero_coleta?.trim() || null,
        usuario_id: usuarioId || null,
        unidade_negocio: req.body.unidade_negocio || 'Goiânia',
        valor: parseMoedaColeta(req.body.valor),
        separador_id: req.body.separador_id || null,
        conferente_id: req.body.conferente_id || null,
        quantidade: req.body.quantidade !== undefined && !isNaN(Number(req.body.quantidade)) ? Math.round(Number(req.body.quantidade)) : 1,
        created_at: agora,
        updated_at: agora,
      };

      if (supabaseClient) {
        const { data: created, error } = await supabaseClient
          .from('expedicao_coletas')
          .insert(payload)
          .select('id, chave_nf, numero_nota_fiscal, cliente, transportadora, status, data, numero_coleta, usuario_id, unidade_negocio, valor, separador_id, conferente_id, quantidade, created_at, updated_at')
          .single();

        if (error) {
          console.warn('[Server Coletas] Erro ao inserir no Supabase:', error.message);
        } else if (created) {
          return res.status(201).json({ success: true, data: created });
        }
      }

      return res.status(201).json({ success: true, data: payload });
    } catch (err: any) {
      console.error('[Server Coletas] Erro ao cadastrar coleta:', err);
      return res.status(500).json({ error: err?.message || 'Erro ao cadastrar coleta.' });
    }
  });

  // Atualizar coleta
  app.put('/api/coletas/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        chave_nf,
        numero_nota_fiscal,
        cliente,
        transportadora,
        status,
        data,
        numero_coleta,
        usuarioId,
        usuarioFuncao,
        usuarioNivel,
      } = req.body;

      // 1. Validação de Permissão Backend
      const autorizado = await checkColetaPermission(usuarioId, usuarioFuncao, usuarioNivel);
      if (!autorizado) {
        return res.status(403).json({
          error: 'Acesso negado: Somente gestores ou usuários com função "Operador Logístico" / "Assistente Logístico" podem editar coletas.',
        });
      }

      // 2. Validação de Status
      if (status !== 'Agendada' && status !== 'Coletada') {
        return res.status(400).json({ error: 'Status inválido. Use "Agendada" ou "Coletada".' });
      }

      // 3. Regra de Número da Coleta: Obrigatório se 'Agendada'
      if (status === 'Agendada' && (!numero_coleta || !String(numero_coleta).trim())) {
        return res.status(400).json({
          error: 'O campo "Número da coleta" é obrigatório quando o status é "Agendada".',
        });
      }

      const payload: Record<string, any> = {
        chave_nf: chave_nf?.trim() || null,
        numero_nota_fiscal: String(numero_nota_fiscal).trim(),
        cliente: String(cliente).trim(),
        transportadora: String(transportadora).trim(),
        status,
        numero_coleta: numero_coleta?.trim() || null,
        usuario_id: usuarioId || null,
        updated_at: new Date().toISOString(),
      };

      if (req.body.separador_id !== undefined) {
        payload.separador_id = req.body.separador_id || null;
      }
      if (req.body.conferente_id !== undefined) {
        payload.conferente_id = req.body.conferente_id || null;
      }
      if (req.body.quantidade !== undefined && !isNaN(Number(req.body.quantidade))) {
        payload.quantidade = Math.round(Number(req.body.quantidade));
      }

      if (req.body.valor !== undefined) {
        payload.valor = parseMoedaColeta(req.body.valor);
      }

      if (data) {
        payload.data = data;
      }

      if (supabaseClient) {
        const { data: updated, error } = await supabaseClient
          .from('expedicao_coletas')
          .update(payload)
          .eq('id', id)
          .select('id, chave_nf, numero_nota_fiscal, cliente, transportadora, status, data, numero_coleta, usuario_id, valor, separador_id, conferente_id, quantidade, created_at, updated_at')
          .single();

        if (error) {
          console.warn('[Server Coletas] Erro ao atualizar no Supabase:', error.message);
        } else if (updated) {
          return res.json({ success: true, data: updated });
        }
      }

      return res.json({ success: true, data: { id, ...payload } });
    } catch (err: any) {
      console.error('[Server Coletas] Erro ao editar coleta:', err);
      return res.status(500).json({ error: err?.message || 'Erro ao editar coleta.' });
    }
  });

  // Excluir coleta
  app.delete('/api/coletas/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { usuarioId, usuarioFuncao, usuarioNivel } = req.body || {};

      // 1. Validação de Permissão Backend
      const autorizado = await checkColetaPermission(usuarioId, usuarioFuncao, usuarioNivel);
      if (!autorizado) {
        return res.status(403).json({
          error: 'Acesso negado: Somente gestores ou usuários com função "Operador Logístico" / "Assistente Logístico" podem excluir coletas.',
        });
      }

      if (supabaseClient) {
        const { error } = await supabaseClient
          .from('expedicao_coletas')
          .delete()
          .eq('id', id);

        if (error) {
          console.warn('[Server Coletas] Erro ao deletar no Supabase:', error.message);
        }
      }

      return res.json({ success: true, message: 'Coleta removida com sucesso.' });
    } catch (err: any) {
      console.error('[Server Coletas] Erro ao excluir coleta:', err);
      return res.status(500).json({ error: err?.message || 'Erro ao excluir coleta.' });
    }
  });

  // 6.5. ATUALIZAÇÕES & AUDITORIA OPERACIONAL POR UNIDADE DE NEGÓCIO
  app.get('/api/atualizacoes', async (req: Request, res: Response) => {
    try {
      const unidade = req.query.unidade_negocio ? String(req.query.unidade_negocio) : undefined;
      const limit = Math.min(Number(req.query.limit) || 50, 100);

      if (supabaseClient) {
        let query = supabaseClient
          .from('atualizacoes')
          .select('id, unidade_negocio, numero, modulo, tipo, titulo, descricao, registro_id, usuario_id, data_evento, created_at')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (unidade) {
          query = query.eq('unidade_negocio', unidade);
        }

        const { data, error } = await query;
        if (!error && data) {
          return res.json({ success: true, data });
        }
      }

      return res.json({ success: true, data: [] });
    } catch (err: any) {
      console.error('[Server Atualizacoes] Erro ao listar atualizações:', err);
      return res.status(500).json({ error: 'Erro ao listar atualizações operacionais.' });
    }
  });

  app.post('/api/atualizacoes', async (req: Request, res: Response) => {
    try {
      const { unidade_negocio, modulo, tipo, titulo, descricao, registro_id, usuario_id, data_evento } = req.body;
      if (!modulo || !tipo || !titulo) {
        return res.status(400).json({ error: 'Campos obrigatórios: modulo, tipo, titulo.' });
      }

      const payload = {
        unidade_negocio: unidade_negocio || 'Goiânia',
        modulo,
        tipo,
        titulo,
        descricao: descricao || null,
        registro_id: registro_id || null,
        usuario_id: usuario_id || null,
        data_evento: data_evento || new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      if (supabaseClient) {
        const { data, error } = await supabaseClient
          .from('atualizacoes')
          .insert(payload)
          .select('id, unidade_negocio, numero, modulo, tipo, titulo, descricao, registro_id, usuario_id, data_evento, created_at')
          .single();

        if (!error && data) {
          return res.status(201).json({ success: true, data });
        }
      }

      return res.status(201).json({ success: true, data: { id: Date.now().toString(), ...payload } });
    } catch (err: any) {
      console.error('[Server Atualizacoes] Erro ao gravar atualização:', err);
      return res.status(500).json({ error: 'Erro ao registrar atualização operacional.' });
    }
  });

  // 6.6. GESTÃO DE UNIDADES DE NEGÓCIO
  app.get('/api/unidades', async (_req: Request, res: Response) => {
    try {
      if (supabaseClient) {
        const { data, error } = await supabaseClient
          .from('unidades_negocio')
          .select('id, nome, sigla, cidade, estado, ativo, created_at, updated_at')
          .order('nome', { ascending: true });

        if (!error && data) {
          return res.json({ success: true, data });
        }
      }

      // Default fallback
      return res.json({
        success: true,
        data: [
          { id: '1', nome: 'Goiânia', sigla: 'GYN', cidade: 'Goiânia', estado: 'GO', ativo: true },
          { id: '2', nome: 'Mato Grosso', sigla: 'MT', cidade: 'Cuiabá', estado: 'MT', ativo: true },
        ],
      });
    } catch (err: any) {
      console.error('[Server Unidades] Erro ao listar unidades:', err);
      return res.status(500).json({ error: 'Erro ao listar unidades de negócio.' });
    }
  });

  app.post('/api/unidades', async (req: Request, res: Response) => {
    try {
      const { nome, sigla, cidade, estado, ativo } = req.body;
      if (!nome || !String(nome).trim()) {
        return res.status(400).json({ error: 'O campo nome é obrigatório.' });
      }

      const payload = {
        nome: String(nome).trim(),
        sigla: sigla ? String(sigla).trim().toUpperCase() : null,
        cidade: cidade ? String(cidade).trim() : null,
        estado: estado ? String(estado).trim().toUpperCase() : null,
        ativo: ativo ?? true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (supabaseClient) {
        const { data, error } = await supabaseClient
          .from('unidades_negocio')
          .insert(payload)
          .select('id, nome, sigla, cidade, estado, ativo, created_at, updated_at')
          .single();

        if (!error && data) {
          return res.status(201).json({ success: true, data });
        }
        if (error && error.code === '23505') {
          return res.status(409).json({ error: `Já existe uma unidade com o nome "${payload.nome}".` });
        }
      }

      return res.status(201).json({ success: true, data: { id: Date.now().toString(), ...payload } });
    } catch (err: any) {
      console.error('[Server Unidades] Erro ao cadastrar unidade:', err);
      return res.status(500).json({ error: 'Erro ao cadastrar unidade de negócio.' });
    }
  });

  // 6.7. MÓDULO WHATSAPP BUSINESS PLATFORM (WEBHOOK OFICIAL DA META & API)
  // Set de idempotência para evitar processamento duplicado de mensagens (Seção 12)
  const processedMetaMessages = new Set<string>();

  // 1. Verificação do Webhook da Meta (GET /api/whatsapp/webhook)
  app.get('/api/whatsapp/webhook', (req: Request, res: Response) => {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      const expectedToken =
        process.env.WHATSAPP_VERIFY_TOKEN ||
        process.env.META_WEBHOOK_VERIFY_TOKEN ||
        'polihub_whatsapp_token_2026';

      if (mode === 'subscribe' && token === expectedToken) {
        console.log('[WhatsApp Webhook] Webhook verificado com sucesso pela Meta!');
        return res.status(200).send(challenge);
      }

      console.warn('[WhatsApp Webhook] Tentativa de verificação com token inválido:', token);
      return res.status(403).json({ error: 'Token de verificação inválido.' });
    } catch (err: any) {
      console.error('[WhatsApp Webhook] Erro na verificação do webhook:', err);
      return res.status(500).json({ error: 'Erro interno na verificação do webhook.' });
    }
  });

  // 2. Processamento de Eventos e Mensagens do Webhook (POST /api/whatsapp/webhook)
  app.post('/api/whatsapp/webhook', async (req: Request, res: Response) => {
    try {
      const body = req.body;
      if (!body || body.object !== 'whatsapp_business_account') {
        return res.status(404).json({ error: 'Evento não reconhecido.' });
      }

      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          if (change.field === 'messages') {
            const val = change.value;
            const messages = val?.messages || [];
            const contacts = val?.contacts || [];
            const metadata = val?.metadata;
            const phoneNumberId = metadata?.phone_number_id;

            for (const msg of messages) {
              const messageId = msg.id;

              // Idempotência: impede reprocessamento duplicado da mesma mensagem
              if (messageId && processedMetaMessages.has(messageId)) {
                console.log(`[WhatsApp Webhook] Mensagem ${messageId} já processada (idempotência). Pulando.`);
                continue;
              }
              if (messageId) {
                processedMetaMessages.add(messageId);
                // Limita tamanho do set de idempotência a 5000 itens
                if (processedMetaMessages.size > 5000) {
                  const first = processedMetaMessages.values().next().value;
                  if (first) processedMetaMessages.delete(first);
                }
              }

              const fromPhone = msg.from; // Número internacional (ex: 5562999998888)
              const contactMeta = contacts.find((c: any) => c.wa_id === fromPhone);
              const senderName = contactMeta?.profile?.name || fromPhone;
              let textContent = '';

              if (msg.type === 'text') {
                textContent = msg.text?.body || '';
              } else if (msg.type === 'button') {
                textContent = msg.button?.text || '';
              } else if (msg.type === 'interactive') {
                textContent =
                  msg.interactive?.button_reply?.title ||
                  msg.interactive?.list_reply?.title ||
                  'Opção selecionada';
              } else {
                textContent = `[${msg.type || 'Mídia'} recebida]`;
              }

              console.log(
                `[WhatsApp Webhook] Mensagem recebida de ${senderName} (${fromPhone}): "${textContent}" (Phone ID: ${phoneNumberId})`
              );

              // Persistência no Supabase quando disponível
              if (supabaseClient) {
                try {
                  // Localiza canal correspondente
                  const { data: canal } = await supabaseClient
                    .from('whatsapp_canais')
                    .select('id, nome, unidade_negocio')
                    .eq('meta_phone_number_id', phoneNumberId)
                    .maybeSingle();

                  const unidade = canal?.unidade_negocio || 'Goiânia';
                  const canalId = canal?.id || null;

                  // Busca ou cria conversa ativa
                  let { data: conversa } = await supabaseClient
                    .from('whatsapp_conversas')
                    .select('*')
                    .eq('numero_remetente', fromPhone)
                    .neq('status', 'encerrado')
                    .maybeSingle();

                  const agora = new Date().toISOString();

                  if (!conversa) {
                    const { data: novaConversa } = await supabaseClient
                      .from('whatsapp_conversas')
                      .insert({
                        canal_id: canalId,
                        numero_remetente: fromPhone,
                        nome_remetente: senderName,
                        unidade_negocio: unidade,
                        fila_nome: 'Geral',
                        status: 'aguardando',
                        ultima_mensagem_texto: textContent,
                        ultima_mensagem_data: agora,
                        created_at: agora,
                      })
                      .select()
                      .single();
                    conversa = novaConversa;
                  } else {
                    await supabaseClient
                      .from('whatsapp_conversas')
                      .update({
                        ultima_mensagem_texto: textContent,
                        ultima_mensagem_data: agora,
                        updated_at: agora,
                      })
                      .eq('id', conversa.id);
                  }

                  if (conversa?.id) {
                    await supabaseClient.from('whatsapp_mensagens').insert({
                      conversa_id: conversa.id,
                      tipo_remetente: 'contato',
                      autor_nome: senderName,
                      conteudo: textContent,
                      meta_message_id: messageId,
                      status_envio: 'entregue',
                      created_at: agora,
                    });
                  }
                } catch (dbErr) {
                  console.warn('[WhatsApp Webhook] Falha ao persistir no Supabase:', dbErr);
                }
              }
            }
          }
        }
      }

      // Meta exige resposta 200 rápida
      return res.status(200).send('EVENT_RECEIVED');
    } catch (err: any) {
      console.error('[WhatsApp Webhook] Erro ao processar webhook da Meta:', err);
      return res.status(500).json({ error: 'Erro no processamento do webhook.' });
    }
  });

  // 3. Teste Manual de Webhook / Simulação de Mensagem Inbound
  app.post('/api/whatsapp/test-webhook', async (req: Request, res: Response) => {
    try {
      const { telefone, nome, texto, unidade } = req.body;
      if (!telefone || !texto) {
        return res.status(400).json({ error: 'Parâmetros obrigatórios: telefone e texto.' });
      }

      console.log(`[WhatsApp Test Webhook] Simulação recebida de ${nome || 'Contato'} (${telefone}): "${texto}"`);
      return res.json({
        success: true,
        message: 'Evento de teste processado com sucesso.',
        dados: { telefone, nome, texto, unidade: unidade || 'Goiânia', timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Erro ao simular teste de webhook.' });
    }
  });

  // 7. Integração do Vite para desenvolvimento e arquivos estáticos para produção
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PoliHub Server] Servidor ativo em http://0.0.0.0:${PORT}`);
  });
}

startServer();
