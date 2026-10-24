import { Usuario } from '../types';
import { UNIDADE_PADRAO_SISTEMA, normalizarUnidadeNegocio } from '../constants/unidades';

const LOCAL_SESSION_KEY = 'polihub_active_session';
const CURRENT_USER_DATA_KEY = 'polihub_current_user_profile';

/**
 * Retorna os termos equivalentes de uma unidade de negócio para garantir
 * que variações como 'Goiânia' e 'Goiânia-GO' correspondam tanto no SQL quanto em memória.
 */
export function getUnitEquivalents(unit?: string | null): string[] {
  if (!unit || typeof unit !== 'string' || !unit.trim()) {
    return ['Goiânia', 'Goiânia-GO', 'Goiania'];
  }
  const limpo = unit.trim();
  const lower = limpo.toLowerCase();

  if (lower.includes('goi') || lower.includes('gyn')) {
    return ['Goiânia', 'Goiânia-GO', 'Goiania'];
  }

  if (lower.includes('mato') || lower === 'mt') {
    return ['Mato Grosso', 'MT'];
  }

  if (lower.includes('belo') || lower.includes('bh')) {
    return ['Belo Horizonte', 'Belo Horizonte-MG', 'BH'];
  }

  if (lower.includes('sao') || lower.includes('são') || lower === 'sp') {
    return ['São Paulo', 'São Paulo-SP', 'SP'];
  }

  return [limpo];
}

/**
 * Retorna a unidade de negócio do usuário atualmente conectado.
 * Obtém diretamente do cache de sessão do navegador (localStorage).
 * Se não houver unidade ou usuário autenticado, retorna null ou fallback opcional.
 */
export function getActiveUserUnit(): string | null {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return null;
    }
    // 1. Tenta carregar do perfil completo em cache
    const profileRaw = localStorage.getItem(CURRENT_USER_DATA_KEY);
    if (profileRaw) {
      const parsed: Usuario = JSON.parse(profileRaw);
      if (parsed?.unidade_negocio && parsed.unidade_negocio.trim()) {
        return normalizarUnidadeNegocio(parsed.unidade_negocio.trim());
      }
    }

    // 2. Tenta obter pelo usuário da sessão ativa local
    const sessionRaw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw);
      if (session?.unidade_negocio && session.unidade_negocio.trim()) {
        return normalizarUnidadeNegocio(session.unidade_negocio.trim());
      }

      // Se tiver ID, procura na lista local de usuários
      if (session?.id) {
        const usersRaw = localStorage.getItem('polihub_usuarios');
        if (usersRaw) {
          const users: Usuario[] = JSON.parse(usersRaw);
          const found = users.find((u) => u.id === session.id);
          if (found?.unidade_negocio && found.unidade_negocio.trim()) {
            return normalizarUnidadeNegocio(found.unidade_negocio.trim());
          }
        }
      }
    }

    // 3. Tenta obter a partir do token de sessão do Supabase no localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const val = localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          const metaUnit = parsed?.user?.user_metadata?.unidade_negocio;
          if (metaUnit && typeof metaUnit === 'string' && metaUnit.trim()) {
            return normalizarUnidadeNegocio(metaUnit.trim());
          }
        }
      }
    }
  } catch (err) {
    console.warn('Erro ao obter unidade de negócio da sessão:', err);
  }

  return null;
}

/**
 * Obtém o perfil completo do usuário da sessão atual.
 */
export function getActiveUserProfile(): Usuario | null {
  try {
    const profileRaw = localStorage.getItem(CURRENT_USER_DATA_KEY);
    if (profileRaw) {
      return JSON.parse(profileRaw);
    }
    const sessionRaw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw);
      if (session?.id) {
        const usersRaw = localStorage.getItem('polihub_usuarios');
        if (usersRaw) {
          const users: Usuario[] = JSON.parse(usersRaw);
          const found = users.find((u) => u.id === session.id);
          if (found) return found;
        }
      }
      return session;
    }
  } catch (err) {
    console.warn('Erro ao obter perfil do usuário da sessão:', err);
  }
  return null;
}

/**
 * Salva o perfil do usuário atual no storage para acesso síncrono rápido pelos services
 */
export function setActiveUserProfile(user: Usuario | null) {
  try {
    if (user) {
      localStorage.setItem(CURRENT_USER_DATA_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CURRENT_USER_DATA_KEY);
    }
  } catch (err) {
    console.warn('Erro ao sincronizar perfil do usuário na sessão:', err);
  }
}

/**
 * Verifica se um registro pertence à unidade de negócio do usuário.
 * Aplica equivalências ('Goiânia' == 'Goiânia-GO') e atribui registros sem unidade
 * à unidade padrão inicial ('Goiânia').
 */
export function itemMatchesUserUnit(itemUnidade?: string | null, targetUnit?: string | null): boolean {
  const activeUnit = targetUnit || getActiveUserUnit();
  if (!activeUnit) return true; // Se o próprio usuário não possui restrição de unidade, exibe

  // Registros que não possuem unidade atribuída pertencem à unidade Matriz inicial ('Goiânia')
  const effectiveItemUnit = itemUnidade && itemUnidade.trim() ? itemUnidade.trim() : 'Goiânia';

  const userVariants = getUnitEquivalents(activeUnit).map((v) => v.toLowerCase());
  const itemVariants = getUnitEquivalents(effectiveItemUnit).map((v) => v.toLowerCase());

  return userVariants.some((v) => itemVariants.includes(v));
}
