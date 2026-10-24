import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { obterInfoBuild, limparCachesAntigosPoliHub } from '../services/pwaCacheService';

interface UpdateContextType {
  buildId: string;
  buildTime: string;
  isUpdateAvailable: boolean;
  isUpdating: boolean;
  operacaoAtiva: boolean;
  nomeOperacaoAtiva: string | null;
  marcarOperacaoAtiva: (ativa: boolean, nome?: string) => void;
  aplicarAtualizacaoAgora: () => Promise<void>;
  verificarAtualizacaoManualmente: () => Promise<void>;
}

const UpdateContext = createContext<UpdateContextType | undefined>(undefined);

export const UpdateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { buildId, buildTime } = obterInfoBuild();
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Controle de operações críticas (Inventário, Conferência, Alocação, Formulários)
  const [operacoesAtivas, setOperacoesAtivas] = useState<Map<string, boolean>>(new Map());
  const [nomeOperacaoAtiva, setNomeOperacaoAtiva] = useState<string | null>(null);

  // Referência para o callback de recarregamento/ativação do Service Worker
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const ultimoCheckRef = useRef<number>(Date.now());

  // Calcula se há qualquer operação crítica ativa no momento
  const operacaoAtiva = operacoesAtivas.size > 0;

  const marcarOperacaoAtiva = useCallback((ativa: boolean, nome: string = 'operacao_geral') => {
    setOperacoesAtivas((prev) => {
      const proximo = new Map(prev);
      if (ativa) {
        proximo.set(nome, true);
        setNomeOperacaoAtiva(nome);
      } else {
        proximo.delete(nome);
        if (proximo.size === 0) {
          setNomeOperacaoAtiva(null);
        } else {
          // Pega o nome de alguma ainda ativa
          const [primeiro] = proximo.keys();
          setNomeOperacaoAtiva(primeiro);
        }
      }
      return proximo;
    });
  }, []);

  // Aplica a atualização imediatamente com feedback visual suave
  const aplicarAtualizacaoAgora = useCallback(async () => {
    if (isUpdating) return;
    setIsUpdating(true);

    try {
      // Limpa caches antigos de builds anteriores antes de recarregar
      await limparCachesAntigosPoliHub(buildId);

      // Pequena pausa para exibição da mensagem visual amigável ("Atualizando o PoliHub...")
      await new Promise((resolve) => setTimeout(resolve, 800));

      if (updateSWRef.current) {
        await updateSWRef.current(true);
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.warn('[PoliHub PWA] Erro ao aplicar atualização:', err);
      window.location.reload();
    }
  }, [buildId, isUpdating]);

  // Aplicação automática: quando há atualização pronta e nenhuma operação ativa
  useEffect(() => {
    if (isUpdateAvailable && !operacaoAtiva && !isUpdating) {
      // Aguarda 1 segundo de inatividade para garantir que o usuário não iniciou uma ação imediata
      const timer = setTimeout(() => {
        aplicarAtualizacaoAgora();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isUpdateAvailable, operacaoAtiva, isUpdating, aplicarAtualizacaoAgora]);

  // Função throttled para checagem nativa de nova versão do Service Worker
  const verificarAtualizacaoComThrottle = useCallback(async () => {
    const agora = Date.now();
    // Throttle de no mínimo 60 segundos entre verificações manuais/automáticas
    if (agora - ultimoCheckRef.current < 60_000) {
      return;
    }
    ultimoCheckRef.current = agora;

    if (registrationRef.current) {
      try {
        await registrationRef.current.update();
      } catch (err) {
        // Falhas normais de rede (ex: offline) são tratadas silenciosamente
      }
    }
  }, []);

  const verificarAtualizacaoManualmente = useCallback(async () => {
    ultimoCheckRef.current = 0; // Reseta throttle para forçar verificação intencional
    await verificarAtualizacaoComThrottle();
  }, [verificarAtualizacaoComThrottle]);

  // Inicialização do Service Worker com ciclo de vida controlado
  useEffect(() => {
    // Diagnóstico em ambiente de desenvolvimento
    if (import.meta.env.DEV) {
      console.log(`%c[PoliHub] Build: ${buildId}`, 'color: #38bdf8; font-weight: bold;');
    }

    // Limpa silenciosamente qualquer cache obsoleto de builds anteriores
    limparCachesAntigosPoliHub(buildId);

    // Registra o Service Worker pelo Vite Plugin PWA
    updateSWRef.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        if (import.meta.env.DEV) {
          console.log('[PoliHub PWA] Nova versão detectada e pronta para ativação.');
        }
        setIsUpdateAvailable(true);
      },
      onOfflineReady() {
        if (import.meta.env.DEV) {
          console.log('[PoliHub PWA] Aplicativo pronto para uso offline.');
        }
      },
      onRegisteredSW(_swUrl, registration) {
        if (registration) {
          registrationRef.current = registration;
          // Checagem inicial única ao abrir o PoliHub
          registration.update().catch(() => {});
        }
      },
      onRegisterError(error) {
        console.warn('[PoliHub PWA] Falha no registro do Service Worker:', error);
      },
    });

    // 1. Verificação ao voltar para primeiro plano (quando o usuário retoma o PWA no Android)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        verificarAtualizacaoComThrottle();
      }
    };

    // 2. Verificação ao focar na janela/aba
    const handleFocus = () => {
      verificarAtualizacaoComThrottle();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [buildId, verificarAtualizacaoComThrottle]);

  return (
    <UpdateContext.Provider
      value={{
        buildId,
        buildTime,
        isUpdateAvailable,
        isUpdating,
        operacaoAtiva,
        nomeOperacaoAtiva,
        marcarOperacaoAtiva,
        aplicarAtualizacaoAgora,
        verificarAtualizacaoManualmente,
      }}
    >
      {children}
    </UpdateContext.Provider>
  );
};

export const useUpdate = (): UpdateContextType => {
  const context = useContext(UpdateContext);
  if (!context) {
    throw new Error('useUpdate deve ser utilizado dentro de um UpdateProvider');
  }
  return context;
};
