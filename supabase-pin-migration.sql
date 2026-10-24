-- ==============================================================================
-- POLIHUB — MIGRAÇÃO SUPABASE: IDENTIFICAÇÃO OPERACIONAL POR PIN
-- ==============================================================================
-- Executar este script no SQL Editor do seu projeto Supabase.
-- 
-- 1. Cria a coluna 'pin' na tabela public.usuarios:
--    - Tipo TEXT para preservar zeros à esquerda (ex: '0123')
--    - Validação de exatamente 4 dígitos numéricos via CHECK constraint
-- 2. Assegura a coluna 'conferente_id' na tabela public.recebimentos_produtos
-- 3. Assegura a coluna 'repositor_id' na tabela public.recebimentos_produtos
-- 4. Cria índices de performance para consultas e auditoria
-- 5. Preserva dados existentes e não remove registros de conferências
-- ==============================================================================

-- 1. Adicionar coluna PIN na tabela public.usuarios caso não exista
ALTER TABLE public.usuarios 
    ADD COLUMN IF NOT EXISTS pin TEXT;

COMMENT ON COLUMN public.usuarios.pin IS 'PIN operacional de exatamente 4 dígitos numéricos para autorização rápida de conferência e alocação';

-- 2. Validar formato numérico de exatamente 4 dígitos (preserva zeros à esquerda e permite NULL no cadastro inicial)
ALTER TABLE public.usuarios
    DROP CONSTRAINT IF EXISTS usuarios_pin_4_digitos_check;

ALTER TABLE public.usuarios
    ADD CONSTRAINT usuarios_pin_4_digitos_check
    CHECK (pin IS NULL OR pin ~ '^[0-9]{4}$');

-- 3. Garantir coluna conferente_id na tabela recebimentos_produtos
ALTER TABLE public.recebimentos_produtos 
    ADD COLUMN IF NOT EXISTS conferente_id TEXT;

COMMENT ON COLUMN public.recebimentos_produtos.conferente_id IS 'ID do usuário identificado por PIN que realizou a conferência do item';

-- 4. Garantir coluna repositor_id na tabela recebimentos_produtos
ALTER TABLE public.recebimentos_produtos 
    ADD COLUMN IF NOT EXISTS repositor_id TEXT;

COMMENT ON COLUMN public.recebimentos_produtos.repositor_id IS 'ID do usuário identificado por PIN que realizou a alocação do produto';

-- 5. Criar índices para acelerar consultas, relatórios e junções
CREATE INDEX IF NOT EXISTS idx_usuarios_pin ON public.usuarios(pin);
CREATE INDEX IF NOT EXISTS idx_recebimentos_produtos_conferente ON public.recebimentos_produtos(conferente_id);
CREATE INDEX IF NOT EXISTS idx_recebimentos_produtos_repositor ON public.recebimentos_produtos(repositor_id);

-- 6. Garantir permissões de RLS para leitura e atualização do PIN pelo operador
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de usuarios para selecao operacional" ON public.usuarios;
CREATE POLICY "Permitir leitura de usuarios para selecao operacional" 
    ON public.usuarios 
    FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Permitir atualizacao de PIN pelos operadores" ON public.usuarios;
CREATE POLICY "Permitir atualizacao de PIN pelos operadores" 
    ON public.usuarios 
    FOR UPDATE 
    USING (true)
    WITH CHECK (true);
