/**
 * POLIHUB — SERVIÇO DE NOTIFICAÇÕES PUSH
 * Gerencia permissões, subscriptions no navegador/PWA e integração com o backend
 */

export interface PushStatus {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
  endpoint?: string | null;
}

/**
 * Converte chave pública VAPID base64url para Uint8Array exigido pelo PushManager
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const pushNotificationService = {
  /**
   * Verifica se o navegador atual / PWA possui suporte a Service Worker e Push API
   */
  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  },

  /**
   * Obtém a registration do Service Worker de forma segura com timeout para evitar travamentos
   */
  async getServiceWorkerRegistration(timeoutMs: number = 2500): Promise<ServiceWorkerRegistration | null> {
    if (!this.isSupported()) return null;

    try {
      // 1. Tenta obter registration existente imediatamente
      const existing = await navigator.serviceWorker.getRegistration();
      if (existing) return existing;

      // 2. Aguarda com timeout de segurança
      const readyPromise = navigator.serviceWorker.ready;
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
      const res = await Promise.race([readyPromise, timeoutPromise]);
      if (res) return res;

      // 3. Fallback: Se não encontrou, tenta registrar sw-push.js diretamente
      try {
        return await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
      } catch {
        return null;
      }
    } catch (err) {
      console.warn('[Push Service] Não foi possível obter Service Worker registration:', err);
      return null;
    }
  },

  /**
   * Retorna o status atual de suporte e permissão do dispositivo
   */
  async getStatus(): Promise<PushStatus> {
    if (!this.isSupported()) {
      return {
        supported: false,
        permission: 'unsupported',
        isSubscribed: false,
      };
    }

    const permission = Notification.permission;
    let isSubscribed = false;
    let endpoint: string | null = null;

    try {
      const registration = await this.getServiceWorkerRegistration(1500);
      if (registration) {
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
          isSubscribed = true;
          endpoint = sub.endpoint;
        }
      }
    } catch (err) {
      console.warn('[Push Service] Não foi possível verificar subscription:', err);
    }

    return {
      supported: true,
      permission,
      isSubscribed,
      endpoint,
    };
  },

  /**
   * Obtém a chave pública VAPID do backend seguro
   */
  async getVapidPublicKey(): Promise<string> {
    const res = await fetch('/api/push/public-key');
    if (!res.ok) {
      throw new Error('Falha ao obter chave pública VAPID do servidor');
    }
    const data = await res.json();
    if (!data.publicKey) {
      throw new Error('Chave pública VAPID não configurada no servidor');
    }
    return data.publicKey;
  },

  /**
   * Solicita permissão ao usuário e cria/atualiza a Push Subscription
   * Associa ao usuarioId autenticado sem filtros de nível ou departamento
   */
  async requestPermissionAndSubscribe(
    usuarioId?: string | null
  ): Promise<{ success: boolean; error?: string; permission: NotificationPermission | 'unsupported' }> {
    if (!this.isSupported()) {
      return {
        success: false,
        error: 'Notificações Push não são suportadas neste navegador ou dispositivo.',
        permission: 'unsupported',
      };
    }

    // Se o usuário já bloqueou anteriormente, não faz chamadas repetidas
    if (Notification.permission === 'denied') {
      return {
        success: false,
        error:
          'A permissão de notificações está bloqueada nas configurações do seu navegador. Para ativar, altere as permissões do site.',
        permission: 'denied',
      };
    }

    try {
      // Solicita permissão nativa ao usuário
      const permissionResult = await Notification.requestPermission();
      if (permissionResult !== 'granted') {
        return {
          success: false,
          error: 'A permissão de notificações não foi concedida.',
          permission: permissionResult,
        };
      }

      // Obtém chave pública VAPID
      const publicKey = await this.getVapidPublicKey();
      const applicationServerKey = urlBase64ToUint8Array(publicKey);

      // Garante o Service Worker existente registrado pelo PoliHub
      let registration = await this.getServiceWorkerRegistration(3000);
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
      }
      if (!registration) {
        throw new Error('Não foi possível obter o registro do Service Worker.');
      }

      // Obtém subscription existente ou cria uma nova
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      // Envia a subscrição para o backend seguro salvar na tabela push_subscriptions
      const subJson = subscription.toJSON();
      const saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId: usuarioId || null,
          subscription: subJson,
        }),
      });

      if (!saveRes.ok) {
        const errorData = await saveRes.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao salvar a subscrição no servidor');
      }

      return {
        success: true,
        permission: 'granted',
      };
    } catch (err: any) {
      console.error('[Push Service] Erro ao autorizar notificações:', err);
      return {
        success: false,
        error: err?.message || 'Erro ao registrar notificações Push.',
        permission: Notification.permission,
      };
    }
  },

  /**
   * Cancela a subscrição no dispositivo e informa o backend
   */
  async unsubscribe(): Promise<{ success: boolean; error?: string }> {
    if (!this.isSupported()) {
      return { success: false, error: 'Não suportado' };
    }

    try {
      const registration = await this.getServiceWorkerRegistration(2000);
      const subscription = registration ? await registration.pushManager.getSubscription() : null;

      if (subscription) {
        const endpoint = subscription.endpoint;
        // Notifica o backend para desativar a subscription
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {});

        await subscription.unsubscribe();
      }

      return { success: true };
    } catch (err: any) {
      console.error('[Push Service] Erro ao cancelar subscription:', err);
      return { success: false, error: err?.message || 'Falha ao cancelar' };
    }
  },

  /**
   * Envia uma notificação de teste para validar o dispositivo
   */
  async sendTestNotification(): Promise<{ success: boolean; error?: string }> {
    try {
      const registration = await this.getServiceWorkerRegistration(2000);
      const sub = registration ? await registration.pushManager.getSubscription() : null;

      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub?.endpoint,
          title: 'PoliHub — Teste de Notificação',
          body: 'Notificações Push configuradas e funcionando com sucesso!',
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Falha ao disparar teste');
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erro ao enviar teste' };
    }
  },

  /**
   * Dispara o evento de Nova NF recebida para o backend seguro gerar os Pushes
   * Regra 6 e 7:
   * Disparo no momento do evento; sem polling; sem setInterval; sem duplicidades.
   */
  async notificarNovaNfRecebida(params: {
    notaFiscal: string;
    fornecedor?: string;
    quantidadeItens?: number;
  }): Promise<void> {
    try {
      // 1. Dispara Push geral via backend seguro
      fetch('/api/push/notify-nf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      }).catch((err) => {
        console.warn('[Push Service] Não foi possível enviar notificação push ao servidor:', err);
      });

      // 2. Dispara evento interno do PoliHub para sincronização de tela e badges
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('polihub_nova_nf_recebida', {
            detail: params,
          })
        );
        window.dispatchEvent(new CustomEvent('polihub_badges_refresh'));
      }
    } catch (e) {
      console.warn('[Push Service] Erro ao notificar nova NF:', e);
    }
  },
};
