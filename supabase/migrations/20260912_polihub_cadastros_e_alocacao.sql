-- ==============================================================================
-- POLIHUB — SCRIPT SQL DE BANCO DE DADOS SUPABASE
-- ATUALIZAÇÃO INTEGRADA: ALOCAÇÃO, PRODUTOS, USUÁRIOS E CADASTROS GERAIS
-- ==============================================================================

-- 1. HABILITAR EXTENSÃO DE UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. TABELA: produtos (Módulo Cadastros -> Produtos)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.produtos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto TEXT NOT NULL,
    fabricante TEXT,
    endereco TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT produtos_nome_not_empty CHECK (length(trim(produto)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_produtos_produto ON public.produtos (produto);
CREATE INDEX IF NOT EXISTS idx_produtos_fabricante ON public.produtos (fabricante);
CREATE INDEX IF NOT EXISTS idx_produtos_endereco ON public.produtos (endereco);

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de produtos" ON public.produtos;
CREATE POLICY "Permitir leitura de produtos" ON public.produtos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escrita de produtos" ON public.produtos;
CREATE POLICY "Permitir escrita de produtos" ON public.produtos FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 3. TABELA: usuarios (Status de Aprovação, Controle de Acesso, RLS e Proteção de Gestor)
-- ==============================================================================
ALTER TABLE public.usuarios 
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'aprovado';

-- Assegurar default automático para id se não houver
ALTER TABLE public.usuarios 
    ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Normalizar status existentes antes de criar constraints para evitar erros de validação
UPDATE public.usuarios 
    SET status = LOWER(TRIM(status))
    WHERE status IS NOT NULL;

UPDATE public.usuarios 
    SET status = 'aprovado' 
    WHERE status IS NULL OR status = '' OR LOWER(status) NOT IN ('pendente', 'aprovado', 'desativado', 'ativo', 'inativo');

UPDATE public.usuarios 
    SET nivel = 'Operador' 
    WHERE nivel IS NULL OR nivel = '';

-- Constraint de status insensível a maiúsculas/minúsculas
ALTER TABLE public.usuarios 
    DROP CONSTRAINT IF EXISTS usuarios_status_check;

ALTER TABLE public.usuarios 
    ADD CONSTRAINT usuarios_status_check 
    CHECK (status IS NULL OR LOWER(status) IN ('pendente', 'aprovado', 'desativado', 'ativo', 'inativo'));

-- Constraint de nível insensível a maiúsculas/minúsculas (aceita 'gestor', 'Gestor', 'Operador', etc.)
ALTER TABLE public.usuarios 
    DROP CONSTRAINT IF EXISTS usuarios_nivel_check;

ALTER TABLE public.usuarios 
    ADD CONSTRAINT usuarios_nivel_check 
    CHECK (nivel IS NULL OR LOWER(nivel) IN ('operador', 'conferente', 'supervisor', 'administrador', 'gestor'));

-- RLS: Garantir que gestores e usuários autenticados consigam ler e gravar na tabela usuarios
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de usuários autenticados" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir leitura de usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir leitura pública de usuarios" ON public.usuarios;
CREATE POLICY "Permitir leitura de usuarios" ON public.usuarios 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserção e atualização do próprio usuário" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir escrita de usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir atualização de usuarios" ON public.usuarios;
CREATE POLICY "Permitir escrita de usuarios" ON public.usuarios 
    FOR ALL USING (true) WITH CHECK (true);

-- TRIGGER DE SEGURANÇA NO BANCO: Não permitir desativar ou rebaixar o último gestor ativo
CREATE OR REPLACE FUNCTION public.check_last_active_gestor()
RETURNS TRIGGER AS $$
DECLARE
    active_gestores_count INT;
BEGIN
    IF (COALESCE(OLD.nivel, '') ILIKE 'gestor' OR COALESCE(OLD.nivel, '') ILIKE 'administrador') 
       AND (COALESCE(OLD.status, 'aprovado') IN ('aprovado', 'ativo')) THEN
       
       IF (COALESCE(NEW.status, '') = 'desativado') 
          OR (COALESCE(NEW.nivel, '') NOT ILIKE 'gestor' AND COALESCE(NEW.nivel, '') NOT ILIKE 'administrador') THEN
           
           SELECT COUNT(*) INTO active_gestores_count
           FROM public.usuarios
           WHERE id <> OLD.id 
             AND (nivel ILIKE 'gestor' OR nivel ILIKE 'administrador')
             AND (status IN ('aprovado', 'ativo') OR status IS NULL);

           IF active_gestores_count < 1 THEN
               RAISE EXCEPTION 'Operação bloqueada: o sistema não pode ficar sem nenhum gestor ativo. Nomeie e aprove outro gestor antes de desativar ou rebaixar este perfil.';
           END IF;
       END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_last_active_gestor ON public.usuarios;
CREATE TRIGGER trg_check_last_active_gestor
    BEFORE UPDATE ON public.usuarios
    FOR EACH ROW
    EXECUTE FUNCTION public.check_last_active_gestor();

-- ==============================================================================
-- 4. TABELA: alteracoes_endereco (Módulo Alocação - Auditoria de Confirmação)
-- ==============================================================================
ALTER TABLE public.alteracoes_endereco 
    ADD COLUMN IF NOT EXISTS usuario_confirmacao UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS usuario_confirmacao_nome TEXT;

CREATE INDEX IF NOT EXISTS idx_alteracoes_endereco_status_ordem 
    ON public.alteracoes_endereco (alterado_sistema, data_alteracao DESC);

-- ==============================================================================
-- 5. TABELA: transportadoras
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.transportadoras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT transportadoras_razao_social_not_empty CHECK (length(trim(razao_social)) > 0),
    CONSTRAINT transportadoras_nome_fantasia_not_empty CHECK (length(trim(nome_fantasia)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transportadoras_razao_social_lower 
    ON public.transportadoras (LOWER(TRIM(razao_social)));

CREATE UNIQUE INDEX IF NOT EXISTS idx_transportadoras_nome_fantasia_lower 
    ON public.transportadoras (LOWER(TRIM(nome_fantasia)));

ALTER TABLE public.transportadoras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de transportadoras" ON public.transportadoras;
CREATE POLICY "Permitir leitura de transportadoras" ON public.transportadoras FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escrita de transportadoras" ON public.transportadoras;
CREATE POLICY "Permitir escrita de transportadoras" ON public.transportadoras FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 6. TABELA: fornecedores (Fábricas / Fornecedores)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.fornecedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fornecedores_razao_social_not_empty CHECK (length(trim(razao_social)) > 0),
    CONSTRAINT fornecedores_nome_fantasia_not_empty CHECK (length(trim(nome_fantasia)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fornecedores_razao_social_lower 
    ON public.fornecedores (LOWER(TRIM(razao_social)));

CREATE UNIQUE INDEX IF NOT EXISTS idx_fornecedores_nome_fantasia_lower 
    ON public.fornecedores (LOWER(TRIM(nome_fantasia)));

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de fornecedores" ON public.fornecedores;
CREATE POLICY "Permitir leitura de fornecedores" ON public.fornecedores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escrita de fornecedores" ON public.fornecedores;
CREATE POLICY "Permitir escrita de fornecedores" ON public.fornecedores FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 7. RELACIONAMENTO NA TABELA agendamentos
-- ==============================================================================
ALTER TABLE public.agendamentos 
    ADD COLUMN IF NOT EXISTS fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS transportadora_id UUID REFERENCES public.transportadoras(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_agendamentos_fornecedor_id 
    ON public.agendamentos (fornecedor_id);

CREATE INDEX IF NOT EXISTS idx_agendamentos_transportadora_id 
    ON public.agendamentos (transportadora_id);
