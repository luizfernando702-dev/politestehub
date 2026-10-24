-- ==============================================================================
-- POLIHUB / POLIFILTRO — SCRIPT DE CORREÇÃO DEFINITIVA: TABELA public.usuarios
-- ==============================================================================
-- Este script corrige todos os erros frequentes ao alterar ou atualizar a tabela usuarios:
-- 1. Erro de RLS (Row Level Security): a política padrão 'auth.uid() = id' bloqueava
--    a aprovação, alteração de nível ou desativação de outros usuários por gestores.
-- 2. Erro de Check Constraint em 'nivel': agora aceita variações (Gestor, gestor, Operador, etc.).
-- 3. Erro de Check Constraint em 'status': adiciona a coluna se não existir e normaliza valores.
-- 4. Erro de Trigger do último gestor: protege o sistema sem travar alterações legítimas.
-- 5. Erro de id UUID: define DEFAULT gen_random_uuid() para permitir inserções diretas.
-- ==============================================================================

-- 1. Habilitar extensão de UUID (caso não esteja ativa)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Assegurar que a tabela existe com chave primária UUID e default
CREATE TABLE IF NOT EXISTS public.usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  codigo TEXT NOT NULL UNIQUE,
  foto TEXT,
  departamento TEXT DEFAULT 'Logística Operacional',
  funcao TEXT DEFAULT 'Operador Logístico',
  nivel TEXT DEFAULT 'Operador',
  status TEXT DEFAULT 'aprovado',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Adicionar coluna status e exigir_troca_senha caso a tabela já existisse sem elas
ALTER TABLE public.usuarios 
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aprovado';

ALTER TABLE public.usuarios 
    ADD COLUMN IF NOT EXISTS exigir_troca_senha BOOLEAN DEFAULT FALSE;

-- 4. Assegurar default automático para o campo id
ALTER TABLE public.usuarios 
    ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 5. Normalizar departamentos para os 3 oficiais (Logística, Comercial, Financeiro)
UPDATE public.usuarios
SET departamento = 'Logística'
WHERE departamento ILIKE '%Logística & Recebimento%'
   OR departamento ILIKE '%Expedição & Transporte%'
   OR departamento ILIKE '%Logística Operacional%'
   OR departamento ILIKE '%Recebimento & Expedição%'
   OR departamento ILIKE '%Gestão de Estoque%'
   OR departamento IS NULL
   OR departamento = '';

UPDATE public.usuarios
SET departamento = 'Comercial'
WHERE departamento ILIKE '%Comercial%' OR departamento ILIKE '%Venda%';

UPDATE public.usuarios
SET departamento = 'Financeiro'
WHERE departamento ILIKE '%Financ%';

-- 6. Normalizar registros de status e nível
UPDATE public.usuarios 
    SET status = LOWER(TRIM(status))
    WHERE status IS NOT NULL;

UPDATE public.usuarios 
    SET status = 'aprovado' 
    WHERE status IS NULL OR status = '' OR LOWER(status) NOT IN ('pendente', 'aprovado', 'desativado', 'ativo', 'inativo');

UPDATE public.usuarios 
    SET nivel = 'Gestor' 
    WHERE LOWER(TRIM(nivel)) IN ('gestor', 'administrador', 'gerente');

UPDATE public.usuarios 
    SET nivel = 'Assistente' 
    WHERE LOWER(TRIM(nivel)) IN ('assistente');

UPDATE public.usuarios 
    SET nivel = 'Operador' 
    WHERE LOWER(TRIM(nivel)) NOT IN ('gestor', 'assistente') OR nivel IS NULL OR nivel = '';

-- 7. Recriar Constraint de Status (insensível a maiúsculas/minúsculas)
ALTER TABLE public.usuarios 
    DROP CONSTRAINT IF EXISTS usuarios_status_check;

ALTER TABLE public.usuarios 
    ADD CONSTRAINT usuarios_status_check 
    CHECK (status IS NULL OR LOWER(status) IN ('pendente', 'aprovado', 'desativado', 'ativo', 'inativo'));

-- 8. Recriar Constraint de Nível (Operador, Assistente, Gestor)
ALTER TABLE public.usuarios 
    DROP CONSTRAINT IF EXISTS usuarios_nivel_check;

ALTER TABLE public.usuarios 
    ADD CONSTRAINT usuarios_nivel_check 
    CHECK (nivel IS NULL OR LOWER(TRIM(nivel)) IN ('operador', 'assistente', 'gestor', 'administrador'));

-- 9. Recriar Constraint de Departamento (Logística, Comercial, Financeiro)
ALTER TABLE public.usuarios 
    DROP CONSTRAINT IF EXISTS usuarios_departamento_check;

ALTER TABLE public.usuarios 
    ADD CONSTRAINT usuarios_departamento_check 
    CHECK (departamento IS NULL OR departamento IN ('Logística', 'Comercial', 'Financeiro'));

-- 8. CORREÇÃO CRÍTICA DE POLÍTICAS DE SEGURANÇA (RLS):
-- Remove a restrição 'auth.uid() = id' que impedia gestores de aprovar, editar ou desativar outros usuários
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de usuários autenticados" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir leitura de usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir leitura pública de usuarios" ON public.usuarios;
CREATE POLICY "Permitir leitura de usuarios" ON public.usuarios 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserção e atualização do próprio usuário" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir escrita de usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir atualização de usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir inserção de usuarios" ON public.usuarios;
CREATE POLICY "Permitir escrita de usuarios" ON public.usuarios 
    FOR ALL USING (true) WITH CHECK (true);

-- 9. TRIGGER DE SEGURANÇA: Não permitir desativar ou rebaixar o último gestor ativo
-- Feito de forma segura com COALESCE para não falhar em campos nulos
CREATE OR REPLACE FUNCTION public.check_last_active_gestor()
RETURNS TRIGGER AS $$
DECLARE
    active_gestores_count INT;
BEGIN
    -- Só valida se a linha original era de um gestor/administrador ativo
    IF (COALESCE(OLD.nivel, '') ILIKE 'gestor' OR COALESCE(OLD.nivel, '') ILIKE 'administrador') 
       AND (COALESCE(OLD.status, 'aprovado') IN ('aprovado', 'ativo')) THEN
       
       -- E a operação está tentando desativar ou retirar o perfil de gestor/administrador
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

-- 10. (Opcional) Caso queira permitir inserir usuários diretamente no Table Editor 
-- sem que eles precisem estar previamente cadastrados na tabela auth.users do Supabase:
-- ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_id_fkey;
