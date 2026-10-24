/**
 * POLIFILTRO — SERVIÇO DE GERENCIAMENTO DE CACHE PWA E BUILD
 * 
 * Responsável por:
 * 1. Obter informações automáticas do build em execução.
 * 2. Limpar com segurança caches antigos do PoliHub (prefixo "polihub-") sem afetar outros apps.
 * 3. Preservar rigorosamente dados do usuário, localStorage e sessões Supabase.
 */

export interface BuildInfo {
  buildId: string;
  buildTime: string;
}

/**
 * Retorna o identificador único do build injetado automaticamente pelo Vite no momento do build/deploy.
 */
export function obterInfoBuild(): BuildInfo {
  const buildId = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev-local';
  const buildTime = typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : new Date().toISOString();
  return { buildId, buildTime };
}

/**
 * Remove com segurança os caches estáticos de versões anteriores do PoliHub.
 * - NUNCA toca em localStorage ou IndexedDB (mantendo intacta a autenticação do Supabase).
 * - NUNCA apaga caches de outros sites/aplicativos.
 * - Deleta apenas caches iniciados com "polihub" que não correspondam ao buildId atual.
 */
export async function limparCachesAntigosPoliHub(currentBuildId: string): Promise<string[]> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return [];
  }

  try {
    const cacheKeys = await caches.keys();
    const removedCaches: string[] = [];
    const prefixoPoliHub = 'polihub';

    for (const key of cacheKeys) {
      // Verifica se o cache pertence ao PoliHub e se não pertence à versão/build ativa
      if (key.toLowerCase().startsWith(prefixoPoliHub) && !key.includes(currentBuildId)) {
        await caches.delete(key);
        removedCaches.push(key);
      }
    }

    if (removedCaches.length > 0 && import.meta.env.DEV) {
      console.log('[PoliHub PWA] Caches antigos removidos com sucesso:', removedCaches);
    }

    return removedCaches;
  } catch (error) {
    console.warn('[PoliHub PWA] Aviso ao limpar caches antigos:', error);
    return [];
  }
}
