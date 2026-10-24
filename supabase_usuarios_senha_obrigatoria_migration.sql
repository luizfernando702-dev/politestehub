-- ==============================================================================
-- POLIHUB — MIGRAÇÃO SUPABASE: ALTERAÇÃO OBRIGATÓRIA DE SENHA
-- ==============================================================================
-- Executar este comando no SQL Editor do seu projeto Supabase.
--
-- 1. Cria a coluna 'exigir_troca_senha' (BOOLEAN DEFAULT FALSE) em public.usuarios
-- 2. Atualiza registros com valor NULL para FALSE
-- 3. Cria índice para performance em consultas de autenticação
-- ==============================================================================

-- 1. Adicionar coluna booleana exigir_troca_senha na tabela public.usuarios
ALTER TABLE public.usuarios 
    ADD COLUMN IF NOT EXISTS exigir_troca_senha BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.usuarios.exigir_troca_senha IS 
    'Indica se o usuário deve obrigatoriamente cadastrar uma nova senha no próximo acesso ao PoliHUB';

-- 2. Garantir valor FALSE nos registros existentes
UPDATE public.usuarios 
    SET exigir_troca_senha = FALSE 
    WHERE exigir_troca_senha IS NULL;

-- 3. Criar índice de consulta rápida
CREATE INDEX IF NOT EXISTS idx_usuarios_exigir_troca_senha 
    ON public.usuarios(exigir_troca_senha);
