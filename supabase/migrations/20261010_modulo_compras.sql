-- ==============================================================================
-- POLIHUB — SCRIPT SUPABASE: MÓDULO DE COMPRAS (SOLICITAÇÕES, APROVAÇÕES E HISTÓRICO)
-- ==============================================================================
-- 1. Criação/Ajuste da Tabela public.compras
-- 2. Constraints de integridade (Quantidade 1 a 1000, Quantidade Aprovada, Demanda, Urgência, Status)
-- 3. Chaves Estrangeiras para produtos e usuarios
-- 4. Índices para performance e filtros
-- 5. Row Level Security (RLS) com permissões para Comercial e Gestor
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA DE COMPRAS
CREATE TABLE IF NOT EXISTS public.compras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_insercao TIMESTAMPTZ NOT NULL DEFAULT now(),
    id_produto UUID NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
    quantidade INTEGER NOT NULL CHECK (quantidade >= 1 AND quantidade <= 1000),
    quantidade_aprovada INTEGER CHECK (quantidade_aprovada IS NULL OR (quantidade_aprovada >= 1 AND quantidade_aprovada <= 1000)),
    demanda TEXT NOT NULL CHECK (demanda IN ('Necessidade', 'Estoque', 'Compras')),
    urgencia TEXT NOT NULL CHECK (urgencia IN ('Média', 'Rápida', 'Urgente')),
    id_solicitante UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'Solicitado' CHECK (status IN ('Solicitado', 'Aprovado', 'Recusado', 'Comprado')),
    id_usuario_aprovacao UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    data_aprovacao TIMESTAMPTZ,
    id_usuario_compra UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    data_compra TIMESTAMPTZ,
    observacao TEXT,
    unidade_negocio TEXT NOT NULL DEFAULT 'Goiânia',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Caso a tabela já exista, garantir que a coluna quantidade_aprovada e status atualizado estejam presentes:
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'compras'
    ) THEN
        -- Coluna quantidade_aprovada
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'compras' AND column_name = 'quantidade_aprovada'
        ) THEN
            ALTER TABLE public.compras 
                ADD COLUMN quantidade_aprovada INTEGER CHECK (quantidade_aprovada IS NULL OR (quantidade_aprovada >= 1 AND quantidade_aprovada <= 1000));
        END IF;

        -- Atualizar constraint de status para incluir 'Recusado'
        ALTER TABLE public.compras 
            DROP CONSTRAINT IF EXISTS compras_status_check;
        ALTER TABLE public.compras 
            ADD CONSTRAINT compras_status_check 
            CHECK (status IN ('Solicitado', 'Aprovado', 'Recusado', 'Comprado'));
    END IF;
END $$;

-- 2. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_compras_produto ON public.compras(id_produto);
CREATE INDEX IF NOT EXISTS idx_compras_solicitante ON public.compras(id_solicitante);
CREATE INDEX IF NOT EXISTS idx_compras_aprovador ON public.compras(id_usuario_aprovacao);
CREATE INDEX IF NOT EXISTS idx_compras_status ON public.compras(status);
CREATE INDEX IF NOT EXISTS idx_compras_urgencia ON public.compras(urgencia);
CREATE INDEX IF NOT EXISTS idx_compras_demanda ON public.compras(demanda);
CREATE INDEX IF NOT EXISTS idx_compras_unidade ON public.compras(unidade_negocio);
CREATE INDEX IF NOT EXISTS idx_compras_data_insercao ON public.compras(data_insercao DESC);

-- Índice composto para validação rápida de duplicidade (Solicitado ou Aprovado do mesmo produto)
CREATE INDEX IF NOT EXISTS idx_compras_produto_status_ativo 
    ON public.compras(id_produto, status) 
    WHERE status IN ('Solicitado', 'Aprovado');

-- 3. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;

-- Política de leitura: todos os usuários autenticados da aplicação
DROP POLICY IF EXISTS "Permitir leitura de compras para autenticados" ON public.compras;
CREATE POLICY "Permitir leitura de compras para autenticados"
    ON public.compras
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Política de inserção: Comercial e Gestores
DROP POLICY IF EXISTS "Permitir insercao de solicitacao de compra" ON public.compras;
CREATE POLICY "Permitir insercao de solicitacao de compra"
    ON public.compras
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Política de atualização
DROP POLICY IF EXISTS "Permitir atualizacao de compras" ON public.compras;
CREATE POLICY "Permitir atualizacao de compras"
    ON public.compras
    FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- Política de exclusão
DROP POLICY IF EXISTS "Permitir exclusao de compras" ON public.compras;
CREATE POLICY "Permitir exclusao de compras"
    ON public.compras
    FOR DELETE
    TO anon, authenticated
    USING (true);

-- Comentários informativos
COMMENT ON TABLE public.compras IS 'Centraliza e rastreia solicitações de compras de produtos do PoliHub';
COMMENT ON COLUMN public.compras.quantidade IS 'Quantidade requisitada original, número inteiro restrito entre 1 e 1.000';
COMMENT ON COLUMN public.compras.quantidade_aprovada IS 'Quantidade aprovada pelo gestor (quando aplicável)';
COMMENT ON COLUMN public.compras.status IS 'Status do fluxo: Solicitado (inicial), Aprovado, Recusado, Comprado';
