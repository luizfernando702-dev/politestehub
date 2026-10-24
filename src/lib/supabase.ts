import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Configuração padrão do Supabase para o PoliHub Logística
// Mantém o aplicativo conectado por padrão em deploys (como Vercel)
export const DEFAULT_SUPABASE_URL = 'https://rzsqllweuifaehpsphqq.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_C1Rym8kvUUYcS92ad1dMQw_wQD-SUNz';

// Environment variables com fallback automático para o projeto padrão
const rawEnvUrl = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : undefined;
const rawEnvKey = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined;

export const supabaseUrl =
  typeof rawEnvUrl === 'string' && rawEnvUrl.trim() !== '' && !rawEnvUrl.includes('seu-projeto')
    ? rawEnvUrl.trim()
    : DEFAULT_SUPABASE_URL;

export const supabaseAnonKey =
  typeof rawEnvKey === 'string' && rawEnvKey.trim() !== '' && !rawEnvKey.includes('sua-chave')
    ? rawEnvKey.trim()
    : DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http') &&
  supabaseAnonKey.length > 20
);

let clientInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) {
    return null;
  }

  if (!clientInstance) {
    try {
      clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    } catch (err) {
      console.warn('Erro ao inicializar Supabase client:', err);
      return null;
    }
  }

  return clientInstance;
}

export const supabase = getSupabase();

