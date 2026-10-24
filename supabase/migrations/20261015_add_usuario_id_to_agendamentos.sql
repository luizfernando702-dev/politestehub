-- ==============================================================================
-- POLIHUB — MÓDULO AGENDAMENTOS
-- MIGRATION: Adiciona a coluna usuario_id na tabela public.agendamentos
-- ==============================================================================

-- 1. ADICIONAR A COLUNA usuario_id NA TABELA agendamentos
-- Permite vincular automaticamente o ID do usuário autenticado no lançamento
ALTER TABLE public.agendamentos 
    ADD COLUMN IF NOT EXISTS usuario_id UUID NULL;

-- 2. CRIAR FOREIGN KEY CONDICIONAL COM A TABELA public.usuarios
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'usuarios'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'agendamentos_usuario_id_fkey'
        ) THEN
            ALTER TABLE public.agendamentos
                ADD CONSTRAINT agendamentos_usuario_id_fkey 
                FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;
        END IF;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Aviso ao adicionar constraint FK agendamentos_usuario_id_fkey: %', SQLERRM;
END $$;

-- 3. ÍNDICE DE PERFORMANCE PARA CONSULTAS E FILTROS POR USUÁRIO
CREATE INDEX IF NOT EXISTS idx_agendamentos_usuario_id ON public.agendamentos(usuario_id);

-- 4. COMENTÁRIO DESCRITIVO NA COLUNA
COMMENT ON COLUMN public.agendamentos.usuario_id IS 'UUID do usuário que realizou o lançamento do agendamento (vinculado automaticamente no cadastro).';

-- 5. RECARREGAR O CACHE DO ESQUEMA DO POSTGREST/SUPABASE
NOTIFY pgrst, 'reload schema';
