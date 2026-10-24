-- ==============================================================================
-- POLIHUB — MIGRATION: AJUSTE NA TABELA EXPEDICAO_COLETAS
-- Adiciona separador_id, conferente_id e quantidade
-- ==============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'expedicao_coletas'
    ) THEN
        -- 1. Coluna separador_id (UUID -> public.usuarios.id)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'expedicao_coletas' AND column_name = 'separador_id'
        ) THEN
            ALTER TABLE public.expedicao_coletas 
                ADD COLUMN separador_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;
            CREATE INDEX IF NOT EXISTS idx_expedicao_coletas_separador 
                ON public.expedicao_coletas (separador_id);
        END IF;

        -- 2. Coluna conferente_id (UUID -> public.usuarios.id)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'expedicao_coletas' AND column_name = 'conferente_id'
        ) THEN
            ALTER TABLE public.expedicao_coletas 
                ADD COLUMN conferente_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;
            CREATE INDEX IF NOT EXISTS idx_expedicao_coletas_conferente 
                ON public.expedicao_coletas (conferente_id);
        END IF;

        -- 3. Coluna quantidade (inteiro, padrão 1)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'expedicao_coletas' AND column_name = 'quantidade'
        ) THEN
            ALTER TABLE public.expedicao_coletas 
                ADD COLUMN quantidade INTEGER NOT NULL DEFAULT 1;
        END IF;
    END IF;
END $$;
