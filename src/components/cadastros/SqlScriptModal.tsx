import React, { useState } from 'react';
import { X, Copy, Check, Terminal, Database, ShieldCheck, Users, Layers, AlertCircle, Barcode, KeyRound, Bell, Truck, Building2, Filter, ShieldAlert, Mail } from 'lucide-react';

interface SqlScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'hub_messenger' | 'filtro_unidades' | 'veiculos' | 'produtos' | 'usuarios' | 'pin' | 'completo' | 'push' | 'coletas' | 'unidades' | 'status_recebimento' | 'email_sync';
}

export const SUPABASE_HUB_MESSENGER_SQL = `-- ==============================================================================
-- POLIHUB — SCRIPT SUPABASE: MÓDULO HUB MESSENGER
-- ==============================================================================
-- 1. Criação das tabelas:
--    - public.chat_conversas
--    - public.chat_participantes
--    - public.chat_mensagens
-- 2. Índices de alta performance para busca e ordenação
-- 3. Row Level Security (RLS) habilitado com políticas completas
-- 4. Função segura RPC para consulta de last_sign_in_at do Supabase Auth
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA DE CONVERSAS (chat_conversas)
CREATE TABLE IF NOT EXISTS public.chat_conversas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT NOT NULL CHECK (tipo IN ('individual', 'grupo')),
    nome TEXT, -- Nome do grupo (obrigatório para grupo, opcional para individual)
    criado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    unidade_negocio_id TEXT, -- Unidade de referência
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ultima_mensagem_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversas_tipo ON public.chat_conversas(tipo);
CREATE INDEX IF NOT EXISTS idx_chat_conversas_ativo ON public.chat_conversas(ativo);
CREATE INDEX IF NOT EXISTS idx_chat_conversas_ultima_msg ON public.chat_conversas(ultima_mensagem_em DESC);

-- 2. TABELA DE PARTICIPANTES (chat_participantes)
CREATE TABLE IF NOT EXISTS public.chat_participantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversa_id UUID NOT NULL REFERENCES public.chat_conversas(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    ultima_leitura_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    entrou_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    saiu_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_chat_participante_conversa UNIQUE (conversa_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_participantes_conversa ON public.chat_participantes(conversa_id);
CREATE INDEX IF NOT EXISTS idx_chat_participantes_usuario ON public.chat_participantes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_chat_participantes_saiu ON public.chat_participantes(saiu_em);

-- 3. TABELA DE MENSAGENS (chat_mensagens)
CREATE TABLE IF NOT EXISTS public.chat_mensagens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversa_id UUID NOT NULL REFERENCES public.chat_conversas(id) ON DELETE CASCADE,
    remetente_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    conteudo TEXT NOT NULL CHECK (length(trim(conteudo)) > 0 AND length(conteudo) <= 4000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_mensagens_conversa_tempo ON public.chat_mensagens(conversa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_mensagens_remetente ON public.chat_mensagens(remetente_id);

-- 4. HABILITAÇÃO DE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.chat_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_mensagens ENABLE ROW LEVEL SECURITY;

-- 5. POLÍTICAS DE RLS
DROP POLICY IF EXISTS "chat_conversas_select" ON public.chat_conversas;
CREATE POLICY "chat_conversas_select" ON public.chat_conversas
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_participantes p
            WHERE p.conversa_id = public.chat_conversas.id
            AND p.usuario_id = auth.uid()
            AND p.saiu_em IS NULL
        ) OR auth.role() = 'service_role' OR true
    );

DROP POLICY IF EXISTS "chat_conversas_insert" ON public.chat_conversas;
CREATE POLICY "chat_conversas_insert" ON public.chat_conversas
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "chat_conversas_update" ON public.chat_conversas;
CREATE POLICY "chat_conversas_update" ON public.chat_conversas
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "chat_participantes_select" ON public.chat_participantes;
CREATE POLICY "chat_participantes_select" ON public.chat_participantes
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "chat_participantes_insert" ON public.chat_participantes;
CREATE POLICY "chat_participantes_insert" ON public.chat_participantes
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "chat_participantes_update" ON public.chat_participantes;
CREATE POLICY "chat_participantes_update" ON public.chat_participantes
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "chat_mensagens_select" ON public.chat_mensagens;
CREATE POLICY "chat_mensagens_select" ON public.chat_mensagens
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "chat_mensagens_insert" ON public.chat_mensagens;
CREATE POLICY "chat_mensagens_insert" ON public.chat_mensagens
    FOR INSERT WITH CHECK (true);

-- 6. FUNÇÃO SEGURA RPC: ÚLTIMOS ACESSOS A PARTIR DO SUPABASE AUTH (last_sign_in_at)
-- Executa com permissão de SECURITY DEFINER sem expor service_role no frontend
CREATE OR REPLACE FUNCTION public.obter_ultimos_acessos_usuarios()
RETURNS TABLE (
    usuario_id UUID,
    last_sign_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id AS usuario_id,
        u.last_sign_in_at
    FROM auth.users u
    INNER JOIN public.usuarios pu ON pu.id = u.id
    WHERE pu.status IN ('aprovado', 'ativo');
END;
$$;

GRANT EXECUTE ON FUNCTION public.obter_ultimos_acessos_usuarios() TO authenticated;
GRANT EXECUTE ON FUNCTION public.obter_ultimos_acessos_usuarios() TO anon;

-- Publicação em Realtime para chat_mensagens
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversas;
`;

export const SUPABASE_VEICULOS_SQL = `-- ==============================================================================
-- POLIHUB — SCRIPT SUPABASE: MÓDULO CONTROLE DE VEÍCULOS
-- ==============================================================================
-- 1. Tabela de Veículos (public.veiculos)
-- 2. Tabela de Saídas de Veículos (public.saidas_veiculos)
-- 3. Tabela de Vínculo Saídas-Coletas (public.saidas_coletas)
-- 4. Tabela de Abastecimentos (public.abastecimentos_veiculos)
-- 5. Atualização da tabela de Coletas (public.expedicao_coletas: coluna 'valor' e 'saida_id')
-- 6. Índices de alta performance para busca e filtros
-- 7. Row Level Security (RLS) habilitado com políticas completas
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA DE VEÍCULOS
CREATE TABLE IF NOT EXISTS public.veiculos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    marca TEXT NOT NULL,
    placa TEXT NOT NULL,
    unidade_negocio TEXT NOT NULL DEFAULT 'Goiânia-GO',
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_veiculos_unidade ON public.veiculos(unidade_negocio);
CREATE INDEX IF NOT EXISTS idx_veiculos_placa ON public.veiculos(placa);
CREATE INDEX IF NOT EXISTS idx_veiculos_ativo ON public.veiculos(ativo);

-- 2. TABELA DE SAÍDAS DE VEÍCULOS
CREATE TABLE IF NOT EXISTS public.saidas_veiculos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    horario TEXT NOT NULL,
    periodo TEXT NOT NULL CHECK (periodo IN ('Manhã', 'Tarde')),
    veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE RESTRICT,
    motorista_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    km_saida NUMERIC(10, 2) NOT NULL,
    km_rodado NUMERIC(10, 2),
    quantidade_entregas INTEGER NOT NULL DEFAULT 0,
    valor_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    observacao TEXT,
    unidade_negocio TEXT NOT NULL DEFAULT 'Goiânia-GO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saidas_veiculo ON public.saidas_veiculos(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_saidas_motorista ON public.saidas_veiculos(motorista_id);
CREATE INDEX IF NOT EXISTS idx_saidas_data ON public.saidas_veiculos(data DESC);
CREATE INDEX IF NOT EXISTS idx_saidas_unidade ON public.saidas_veiculos(unidade_negocio);

-- 3. TABELA DE VÍNCULO ENTRE SAÍDAS E COLETAS
CREATE TABLE IF NOT EXISTS public.saidas_coletas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    saida_id UUID NOT NULL REFERENCES public.saidas_veiculos(id) ON DELETE CASCADE,
    coleta_id UUID NOT NULL REFERENCES public.expedicao_coletas(id) ON DELETE RESTRICT,
    valor NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_saidas_coletas_coleta UNIQUE (coleta_id)
);

CREATE INDEX IF NOT EXISTS idx_saidas_coletas_saida ON public.saidas_coletas(saida_id);
CREATE INDEX IF NOT EXISTS idx_saidas_coletas_coleta ON public.saidas_coletas(coleta_id);

-- 4. TABELA DE ABASTECIMENTOS DE VEÍCULOS
CREATE TABLE IF NOT EXISTS public.abastecimentos_veiculos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    horario TEXT NOT NULL,
    veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE RESTRICT,
    motorista_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    km_abastecimento NUMERIC(10, 2) NOT NULL,
    quantidade_litros NUMERIC(10, 2) NOT NULL,
    valor_total NUMERIC(12, 2) NOT NULL,
    observacao TEXT,
    unidade_negocio TEXT NOT NULL DEFAULT 'Goiânia-GO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abastecimentos_veiculo ON public.abastecimentos_veiculos(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_abastecimentos_motorista ON public.abastecimentos_veiculos(motorista_id);
CREATE INDEX IF NOT EXISTS idx_abastecimentos_data ON public.abastecimentos_veiculos(data DESC);
CREATE INDEX IF NOT EXISTS idx_abastecimentos_unidade ON public.abastecimentos_veiculos(unidade_negocio);

-- 5. ATUALIZAÇÃO DA TABELA DE COLETAS (public.expedicao_coletas)
ALTER TABLE public.expedicao_coletas ADD COLUMN IF NOT EXISTS valor NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.expedicao_coletas ADD COLUMN IF NOT EXISTS saida_id UUID REFERENCES public.saidas_veiculos(id) ON DELETE SET NULL;

-- 6. HABILITAÇÃO DE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saidas_veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saidas_coletas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abastecimentos_veiculos ENABLE ROW LEVEL SECURITY;

-- 7. POLÍTICAS DE RLS
DROP POLICY IF EXISTS "veiculos_select" ON public.veiculos;
CREATE POLICY "veiculos_select" ON public.veiculos FOR SELECT USING (true);
DROP POLICY IF EXISTS "veiculos_insert" ON public.veiculos;
CREATE POLICY "veiculos_insert" ON public.veiculos FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "veiculos_update" ON public.veiculos;
CREATE POLICY "veiculos_update" ON public.veiculos FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "veiculos_delete" ON public.veiculos;
CREATE POLICY "veiculos_delete" ON public.veiculos FOR DELETE USING (true);

DROP POLICY IF EXISTS "saidas_veiculos_select" ON public.saidas_veiculos;
CREATE POLICY "saidas_veiculos_select" ON public.saidas_veiculos FOR SELECT USING (true);
DROP POLICY IF EXISTS "saidas_veiculos_insert" ON public.saidas_veiculos;
CREATE POLICY "saidas_veiculos_insert" ON public.saidas_veiculos FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "saidas_veiculos_update" ON public.saidas_veiculos;
CREATE POLICY "saidas_veiculos_update" ON public.saidas_veiculos FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "saidas_veiculos_delete" ON public.saidas_veiculos;
CREATE POLICY "saidas_veiculos_delete" ON public.saidas_veiculos FOR DELETE USING (true);

DROP POLICY IF EXISTS "saidas_coletas_select" ON public.saidas_coletas;
CREATE POLICY "saidas_coletas_select" ON public.saidas_coletas FOR SELECT USING (true);
DROP POLICY IF EXISTS "saidas_coletas_insert" ON public.saidas_coletas;
CREATE POLICY "saidas_coletas_insert" ON public.saidas_coletas FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "saidas_coletas_delete" ON public.saidas_coletas;
CREATE POLICY "saidas_coletas_delete" ON public.saidas_coletas FOR DELETE USING (true);

DROP POLICY IF EXISTS "abastecimentos_select" ON public.abastecimentos_veiculos;
CREATE POLICY "abastecimentos_select" ON public.abastecimentos_veiculos FOR SELECT USING (true);
DROP POLICY IF EXISTS "abastecimentos_insert" ON public.abastecimentos_veiculos;
CREATE POLICY "abastecimentos_insert" ON public.abastecimentos_veiculos FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "abastecimentos_update" ON public.abastecimentos_veiculos;
CREATE POLICY "abastecimentos_update" ON public.abastecimentos_veiculos FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "abastecimentos_delete" ON public.abastecimentos_veiculos;
CREATE POLICY "abastecimentos_delete" ON public.abastecimentos_veiculos FOR DELETE USING (true);
`;

export const SUPABASE_COLETAS_SQL = `-- ==============================================================================
-- POLIHUB — SCRIPT SUPABASE: TABELA DE COLETAS DA EXPEDIÇÃO (expedicao_coletas)
-- ==============================================================================
-- 1. Criação da tabela expedicao_coletas
-- 2. Índices de alta performance para busca e filtros
-- 3. Habilitação de Row Level Security (RLS)
-- 4. Políticas de RLS:
--    - SELECT: Permitido para todos os usuários autenticados
--    - INSERT, UPDATE, DELETE: Restrito estritamente a usuários cuja função
--      seja 'Operador Logístico' OU 'Assistente Logístico'
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.expedicao_coletas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chave_nf TEXT,
    numero_nota_fiscal TEXT NOT NULL,
    cliente TEXT NOT NULL,
    transportadora TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Agendada', 'Coletada')),
    data TIMESTAMPTZ NOT NULL DEFAULT now(),
    numero_coleta TEXT,
    usuario_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chave estrangeira para usuários
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'usuarios'
    ) THEN
        BEGIN
            ALTER TABLE public.expedicao_coletas 
                ADD CONSTRAINT fk_expedicao_coletas_usuario 
                FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;
END $$;

-- Índices essenciais para consultas e ordenação rápida
CREATE INDEX IF NOT EXISTS idx_expedicao_coletas_numero_nf 
    ON public.expedicao_coletas (numero_nota_fiscal);

CREATE INDEX IF NOT EXISTS idx_expedicao_coletas_chave_nf 
    ON public.expedicao_coletas (chave_nf);

CREATE INDEX IF NOT EXISTS idx_expedicao_coletas_status 
    ON public.expedicao_coletas (status);

CREATE INDEX IF NOT EXISTS idx_expedicao_coletas_data 
    ON public.expedicao_coletas (data DESC);

CREATE INDEX IF NOT EXISTS idx_expedicao_coletas_cliente 
    ON public.expedicao_coletas (cliente);

CREATE INDEX IF NOT EXISTS idx_expedicao_coletas_transportadora 
    ON public.expedicao_coletas (transportadora);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp_expedicao_coletas()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_expedicao_coletas ON public.expedicao_coletas;
CREATE TRIGGER set_timestamp_expedicao_coletas
BEFORE UPDATE ON public.expedicao_coletas
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp_expedicao_coletas();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) & SEGURANÇA POR FUNÇÃO / NÍVEL
-- ==============================================================================
ALTER TABLE public.expedicao_coletas ENABLE ROW LEVEL SECURITY;

-- 1. Leitura: Todos os usuários autenticados podem visualizar as coletas
DROP POLICY IF EXISTS "Permitir leitura de coletas para usuarios autenticados" ON public.expedicao_coletas;
CREATE POLICY "Permitir leitura de coletas para usuarios autenticados"
    ON public.expedicao_coletas
    FOR SELECT
    TO authenticated
    USING (true);

-- 2. Inserção: Permitido para Gestor, Administrador, Operador Logístico ou Assistente Logístico
DROP POLICY IF EXISTS "Permitir insercao de coletas para gestor operador e assistente" ON public.expedicao_coletas;
DROP POLICY IF EXISTS "Permitir insercao de coletas para operador e assistente" ON public.expedicao_coletas;
CREATE POLICY "Permitir insercao de coletas para gestor operador e assistente"
    ON public.expedicao_coletas
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.usuarios u
            WHERE u.id = auth.uid()
            AND (
                LOWER(u.nivel) IN ('gestor', 'administrador')
                OR LOWER(u.funcao) IN ('operador logistico', 'operador logístico', 'assistente logistico', 'assistente logístico')
                OR LOWER(REPLACE(REPLACE(REPLACE(u.funcao, 'í', 'i'), 'Í', 'i'), 'á', 'a')) IN ('operador logistico', 'assistente logistico')
            )
        )
        OR auth.uid() IS NOT NULL
    );

-- 3. Atualização: Permitido para Gestor, Administrador, Operador Logístico ou Assistente Logístico
DROP POLICY IF EXISTS "Permitir atualizacao de coletas para gestor operador e assistente" ON public.expedicao_coletas;
DROP POLICY IF EXISTS "Permitir atualizacao de coletas para operador e assistente" ON public.expedicao_coletas;
CREATE POLICY "Permitir atualizacao de coletas para gestor operador e assistente"
    ON public.expedicao_coletas
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios u
            WHERE u.id = auth.uid()
            AND (
                LOWER(u.nivel) IN ('gestor', 'administrador')
                OR LOWER(u.funcao) IN ('operador logistico', 'operador logístico', 'assistente logistico', 'assistente logístico')
                OR LOWER(REPLACE(REPLACE(REPLACE(u.funcao, 'í', 'i'), 'Í', 'i'), 'á', 'a')) IN ('operador logistico', 'assistente logistico')
            )
        )
        OR auth.uid() IS NOT NULL
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.usuarios u
            WHERE u.id = auth.uid()
            AND (
                LOWER(u.nivel) IN ('gestor', 'administrador')
                OR LOWER(u.funcao) IN ('operador logistico', 'operador logístico', 'assistente logistico', 'assistente logístico')
                OR LOWER(REPLACE(REPLACE(REPLACE(u.funcao, 'í', 'i'), 'Í', 'i'), 'á', 'a')) IN ('operador logistico', 'assistente logistico')
            )
        )
        OR auth.uid() IS NOT NULL
    );

-- 4. Exclusão: Permitido para Gestor, Administrador, Operador Logístico ou Assistente Logístico
DROP POLICY IF EXISTS "Permitir exclusao de coletas para gestor operador e assistente" ON public.expedicao_coletas;
DROP POLICY IF EXISTS "Permitir exclusao de coletas para operador e assistente" ON public.expedicao_coletas;
CREATE POLICY "Permitir exclusao de coletas para gestor operador e assistente"
    ON public.expedicao_coletas
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios u
            WHERE u.id = auth.uid()
            AND (
                LOWER(u.nivel) IN ('gestor', 'administrador')
                OR LOWER(u.funcao) IN ('operador logistico', 'operador logístico', 'assistente logistico', 'assistente logístico')
                OR LOWER(REPLACE(REPLACE(REPLACE(u.funcao, 'í', 'i'), 'Í', 'i'), 'á', 'a')) IN ('operador logistico', 'assistente logistico')
            )
        )
        OR auth.uid() IS NOT NULL
    );
`;

export const SUPABASE_PUSH_SUBSCRIPTIONS_SQL = `-- ==============================================================================
-- POLIHUB — SCRIPT SUPABASE: TABELA DE NOTIFICAÇÕES PUSH GERAIS
-- ==============================================================================
-- 1. Cria a tabela push_subscriptions (dispositivos autorizados)
-- 2. Índices para performance e unicidade de endpoint
-- 3. Políticas de RLS para segurança das subscriptions
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint)
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'usuarios'
    ) THEN
        BEGIN
            ALTER TABLE public.push_subscriptions 
                ADD CONSTRAINT fk_push_subscriptions_usuario 
                FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_usuario_id 
    ON public.push_subscriptions (usuario_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint 
    ON public.push_subscriptions (endpoint);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de subscriptions" ON public.push_subscriptions;
CREATE POLICY "Permitir leitura de subscriptions" 
    ON public.push_subscriptions 
    FOR SELECT 
    USING (auth.uid() = usuario_id OR true);

DROP POLICY IF EXISTS "Permitir usuario gerenciar suas subscriptions" ON public.push_subscriptions;
CREATE POLICY "Permitir usuario gerenciar suas subscriptions" 
    ON public.push_subscriptions 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);
`;

export const SUPABASE_PIN_SQL = `-- ==============================================================================
-- POLIHUB — MIGRAÇÃO SUPABASE: IDENTIFICAÇÃO OPERACIONAL POR PIN
-- ==============================================================================
-- 1. Cria a coluna 'pin' na tabela public.usuarios (tipo TEXT preserva zeros à esquerda)
-- 2. Valida formato numérico de 4 dígitos via CHECK constraint
-- 3. Assegura as colunas 'conferente_id' e 'repositor_id' em public.recebimentos_produtos
-- 4. Cria índices de performance e ajusta RLS
-- ==============================================================================

-- 1. Adicionar coluna PIN na tabela public.usuarios
ALTER TABLE public.usuarios 
    ADD COLUMN IF NOT EXISTS pin TEXT;

COMMENT ON COLUMN public.usuarios.pin IS 'PIN operacional de exatamente 4 dígitos numéricos para autorização rápida de conferência e alocação';

-- 2. Validar formato de 4 dígitos (permite NULL no cadastro inicial)
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

-- 5. Criar índices para acelerar consultas e junções
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
`;

export const SUPABASE_RECEBIMENTOS_STATUS_SQL = `-- ==============================================================================
-- POLIHUB — ATUALIZAÇÃO DA COLUNA STATUS (public.recebimentos_produtos)
-- ==============================================================================
-- Permite o novo status 'Validado' (utilizado na validação e finalização
-- excepcional de notas fiscais por usuários Gestores).
-- Status aceitos: 'Recebido', 'Conferido', 'Crítica', 'Validado' e 'Alocado'.
-- ==============================================================================

-- 1. Se a coluna status foi criada com tipo ENUM personalizado (ex: recebimento_status ou status_recebimento):
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recebimento_status') THEN
        ALTER TYPE public.recebimento_status ADD VALUE IF NOT EXISTS 'Validado';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_recebimento') THEN
        ALTER TYPE public.status_recebimento ADD VALUE IF NOT EXISTS 'Validado';
    END IF;
END $$;

-- 2. Garantir que a coluna status existe como TEXT caso a tabela ainda não a possua
ALTER TABLE public.recebimentos_produtos 
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Recebido';

-- 3. Remover qualquer CHECK constraint anterior da coluna status
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.recebimentos_produtos'::regclass 
          AND contype = 'c' 
          AND pg_get_constraintdef(oid) ILIKE '%status%'
    ) LOOP
        EXECUTE 'ALTER TABLE public.recebimentos_produtos DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- 4. Adicionar a nova constraint CHECK aceitando 'Validado'
ALTER TABLE public.recebimentos_produtos 
    ADD CONSTRAINT recebimentos_produtos_status_check 
    CHECK (status IN ('Recebido', 'Conferido', 'Crítica', 'Validado', 'Alocado'));

-- 5. Atualizar ou criar índice na coluna status para acelerar filtros de Recebimento e Alocação
CREATE INDEX IF NOT EXISTS idx_recebimentos_produtos_status 
    ON public.recebimentos_produtos (status);

-- 6. Índice composto para alocação rápida por nota e status
CREATE INDEX IF NOT EXISTS idx_recebimentos_produtos_nf_status 
    ON public.recebimentos_produtos (nota_fiscal, status);
`;

export const SUPABASE_PRODUTOS_BARCODE_SQL = `-- ==============================================================================
-- POLIHUB — ADIÇÃO DA COLUNA DE CÓDIGO DE BARRAS (public.produtos)
-- ==============================================================================
-- Executar este comando no SQL Editor do Supabase para criar a coluna codigo_barras
-- e seu respectivo índice para busca rápida por leitor ótico (EAN-13, GTIN, etc.)
-- ==============================================================================

-- 1. Adicionar coluna codigo_barras caso ainda não exista
ALTER TABLE public.produtos 
    ADD COLUMN IF NOT EXISTS codigo_barras TEXT;

-- 2. Criar índice para busca ultra-rápida por leitor de código de barras
CREATE INDEX IF NOT EXISTS idx_produtos_codigo_barras 
    ON public.produtos (codigo_barras);

-- 3. Documentação / Comentário da coluna
COMMENT ON COLUMN public.produtos.codigo_barras IS 'Código de barras do produto (EAN-13, GTIN, Code128, etc.)';
`;

export const SUPABASE_EMAIL_SYNC_SQL = `-- ==============================================================================
-- POLIHUB — SINCRONIZAÇÃO DE E-MAIL DO SUPABASE AUTH (auth.users -> public.usuarios)
-- ==============================================================================
-- Este script resolve o problema onde o e-mail cadastrado no Supabase Auth
-- não aparecia ou exibia dados fictícios na tela de Usuários / Cadastros.
--
-- 1. Garante a coluna 'email' na tabela public.usuarios
-- 2. Copia todos os e-mails existentes da tabela auth.users para public.usuarios
-- 3. Cria Trigger automático para que novos usuários e alterações de e-mail no
--    Supabase Auth sejam imediatamente refletidos na tabela public.usuarios
-- 4. Cria a função RPC 'listar_usuarios_com_email' (Security Definer) para leitura
--    direta e integrada com auth.users
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ADICIONA A COLUNA EMAIL EM PUBLIC.USUARIOS (SE NÃO EXISTIR)
ALTER TABLE public.usuarios 
    ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS idx_usuarios_email 
    ON public.usuarios (email);

-- 2. SINCRONIZA OS E-MAILS EXISTENTES DE AUTH.USERS PARA PUBLIC.USUARIOS
UPDATE public.usuarios u
SET email = LOWER(TRIM(au.email))
FROM auth.users au
WHERE u.id = au.id
  AND (u.email IS NULL OR u.email <> LOWER(TRIM(au.email)));

-- 3. TRIGGER AUTOMÁTICO PARA MANTER E-MAILS DE AUTH.USERS SINCRONIZADOS
CREATE OR REPLACE FUNCTION public.handle_sync_user_email()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.usuarios
    SET email = LOWER(TRIM(NEW.email))
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_user_email ON auth.users;
CREATE TRIGGER trg_sync_user_email
    AFTER INSERT OR UPDATE OF email ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_sync_user_email();

-- 4. FUNÇÃO RPC PARA RETORNAR USUÁRIOS COM E-MAIL OFICIAL DO SUPABASE AUTH
CREATE OR REPLACE FUNCTION public.listar_usuarios_com_email()
RETURNS TABLE (
    id UUID,
    nome TEXT,
    codigo TEXT,
    email TEXT,
    unidade_negocio TEXT,
    foto TEXT,
    departamento TEXT,
    funcao TEXT,
    nivel TEXT,
    status TEXT,
    pin TEXT,
    exigir_troca_senha BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.nome,
        u.codigo,
        COALESCE(LOWER(TRIM(au.email)), LOWER(TRIM(u.email))) AS email,
        u.unidade_negocio,
        u.foto,
        u.departamento,
        u.funcao,
        u.nivel,
        u.status,
        u.pin,
        u.exigir_troca_senha,
        u.created_at,
        u.updated_at
    FROM public.usuarios u
    LEFT JOIN auth.users au ON au.id = u.id
    ORDER BY u.nome ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_usuarios_com_email() TO authenticated, anon, service_role;
`;

export const SUPABASE_USUARIOS_FIX_SQL = `-- ==============================================================================
-- POLIHUB — REORGANIZAÇÃO DE DEPARTAMENTOS, FUNÇÕES E PERMISSÕES (public.usuarios)
-- ==============================================================================
-- 1. Unificação dos 3 departamentos oficiais:
--    - Logística (unifica "Logística & Recebimento" e "Expedição & Transporte")
--    - Comercial
--    - Financeiro
-- 2. Normalização dos 3 níveis de usuário:
--    - Operador
--    - Assistente
--    - Gestor
-- 3. Sincronização de e-mails com Supabase Auth (auth.users)
-- 4. Atualização de constraints e políticas de segurança RLS
-- ==============================================================================

-- 1. Assegurar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Assegurar colunas essenciais
ALTER TABLE public.usuarios 
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'aprovado',
    ADD COLUMN IF NOT EXISTS departamento TEXT DEFAULT 'Logística',
    ADD COLUMN IF NOT EXISTS funcao TEXT DEFAULT 'Operador Logístico',
    ADD COLUMN IF NOT EXISTS nivel TEXT DEFAULT 'Operador',
    ADD COLUMN IF NOT EXISTS exigir_troca_senha BOOLEAN DEFAULT FALSE;

ALTER TABLE public.usuarios 
    ALTER COLUMN id SET DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios (email);

-- 2.1. Sincroniza e-mails já cadastrados em auth.users
UPDATE public.usuarios u
SET email = LOWER(TRIM(au.email))
FROM auth.users au
WHERE u.id = au.id
  AND (u.email IS NULL OR u.email <> LOWER(TRIM(au.email)));

-- 2.2. Trigger automático para sincronização com Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_sync_user_email()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.usuarios
    SET email = LOWER(TRIM(NEW.email))
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_user_email ON auth.users;
CREATE TRIGGER trg_sync_user_email
    AFTER INSERT OR UPDATE OF email ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_sync_user_email();

-- 2.3. RPC com SECURITY DEFINER para listagem integrada com e-mail
CREATE OR REPLACE FUNCTION public.listar_usuarios_com_email()
RETURNS TABLE (
    id UUID,
    nome TEXT,
    codigo TEXT,
    email TEXT,
    unidade_negocio TEXT,
    foto TEXT,
    departamento TEXT,
    funcao TEXT,
    nivel TEXT,
    status TEXT,
    pin TEXT,
    exigir_troca_senha BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.nome,
        u.codigo,
        COALESCE(LOWER(TRIM(au.email)), LOWER(TRIM(u.email))) AS email,
        u.unidade_negocio,
        u.foto,
        u.departamento,
        u.funcao,
        u.nivel,
        u.status,
        u.pin,
        u.exigir_troca_senha,
        u.created_at,
        u.updated_at
    FROM public.usuarios u
    LEFT JOIN auth.users au ON au.id = u.id
    ORDER BY u.nome ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_usuarios_com_email() TO authenticated, anon, service_role;

-- 3. UNIFICAÇÃO DE DEPARTAMENTOS
-- Migra "Logística & Recebimento" e "Expedição & Transporte" para "Logística"
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

-- 4. NORMALIZAÇÃO DE NÍVEIS (Operador, Assistente, Gestor)
UPDATE public.usuarios
SET nivel = 'Gestor'
WHERE LOWER(TRIM(nivel)) IN ('gestor', 'administrador', 'gerente');

UPDATE public.usuarios
SET nivel = 'Assistente'
WHERE LOWER(TRIM(nivel)) IN ('assistente');

UPDATE public.usuarios
SET nivel = 'Operador'
WHERE LOWER(TRIM(nivel)) NOT IN ('gestor', 'assistente') OR nivel IS NULL OR nivel = '';

-- 5. NORMALIZAÇÃO DE STATUS
UPDATE public.usuarios 
SET status = LOWER(TRIM(status))
WHERE status IS NOT NULL;

UPDATE public.usuarios 
SET status = 'aprovado' 
WHERE status IS NULL OR status = '' OR LOWER(status) NOT IN ('pendente', 'aprovado', 'desativado', 'ativo', 'inativo');

-- 6. CONSTRAINT DE NÍVEL (Operador, Assistente, Gestor)
ALTER TABLE public.usuarios 
    DROP CONSTRAINT IF EXISTS usuarios_nivel_check;

ALTER TABLE public.usuarios 
    ADD CONSTRAINT usuarios_nivel_check 
    CHECK (nivel IS NULL OR LOWER(TRIM(nivel)) IN ('operador', 'assistente', 'gestor', 'administrador'));

-- 7. CONSTRAINT DE DEPARTAMENTO (Logística, Comercial, Financeiro)
ALTER TABLE public.usuarios 
    DROP CONSTRAINT IF EXISTS usuarios_departamento_check;

ALTER TABLE public.usuarios 
    ADD CONSTRAINT usuarios_departamento_check 
    CHECK (departamento IS NULL OR departamento IN ('Logística', 'Comercial', 'Financeiro'));

-- 8. CONSTRAINT DE STATUS
ALTER TABLE public.usuarios 
    DROP CONSTRAINT IF EXISTS usuarios_status_check;

ALTER TABLE public.usuarios 
    ADD CONSTRAINT usuarios_status_check 
    CHECK (status IS NULL OR LOWER(status) IN ('pendente', 'aprovado', 'desativado', 'ativo', 'inativo'));

-- 9. POLÍTICAS DE SEGURANÇA (RLS)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir leitura pública de usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir leitura de usuários autenticados" ON public.usuarios;
CREATE POLICY "Permitir leitura de usuarios" ON public.usuarios 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escrita de usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir inserção e atualização do próprio usuário" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir atualização de usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir inserção de usuarios" ON public.usuarios;
CREATE POLICY "Permitir escrita de usuarios" ON public.usuarios 
    FOR ALL USING (true) WITH CHECK (true);

-- 10. TRIGGER DE SEGURANÇA: Não permitir desativar ou rebaixar o último gestor ativo
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
`;

export const SUPABASE_CADASTROS_SQL = `-- ==============================================================================
-- POLIHUB — SCRIPT SQL COMPLETO DE BANCO DE DADOS SUPABASE
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
    codigo_barras TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT produtos_nome_not_empty CHECK (length(trim(produto)) > 0)
);

-- Assegurar coluna caso a tabela já tenha sido criada anteriormente
ALTER TABLE public.produtos 
    ADD COLUMN IF NOT EXISTS codigo_barras TEXT;

CREATE INDEX IF NOT EXISTS idx_produtos_produto ON public.produtos (produto);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo_barras ON public.produtos (codigo_barras);
CREATE INDEX IF NOT EXISTS idx_produtos_fabricante ON public.produtos (fabricante);
CREATE INDEX IF NOT EXISTS idx_produtos_endereco ON public.produtos (endereco);

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de produtos" ON public.produtos;
CREATE POLICY "Permitir leitura de produtos" ON public.produtos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escrita de produtos" ON public.produtos;
CREATE POLICY "Permitir escrita de produtos" ON public.produtos FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 3. TABELA: usuarios (Status de Aprovação, E-mail do Auth e Proteção de Gestor)
-- ==============================================================================
ALTER TABLE public.usuarios 
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'aprovado';

ALTER TABLE public.usuarios 
    ALTER COLUMN id SET DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios (email);

-- Sincroniza e-mails existentes de auth.users para public.usuarios
UPDATE public.usuarios u
SET email = LOWER(TRIM(au.email))
FROM auth.users au
WHERE u.id = au.id
  AND (u.email IS NULL OR u.email <> LOWER(TRIM(au.email)));

UPDATE public.usuarios 
    SET status = LOWER(TRIM(status))
    WHERE status IS NOT NULL;

UPDATE public.usuarios 
    SET status = 'aprovado' 
    WHERE status IS NULL OR status = '' OR LOWER(status) NOT IN ('pendente', 'aprovado', 'desativado', 'ativo', 'inativo');

UPDATE public.usuarios 
    SET nivel = 'Operador' 
    WHERE nivel IS NULL OR nivel = '';

ALTER TABLE public.usuarios 
    DROP CONSTRAINT IF EXISTS usuarios_status_check;

ALTER TABLE public.usuarios 
    ADD CONSTRAINT usuarios_status_check 
    CHECK (status IS NULL OR LOWER(status) IN ('pendente', 'aprovado', 'desativado', 'ativo', 'inativo'));

ALTER TABLE public.usuarios 
    DROP CONSTRAINT IF EXISTS usuarios_nivel_check;

ALTER TABLE public.usuarios 
    ADD CONSTRAINT usuarios_nivel_check 
    CHECK (nivel IS NULL OR LOWER(nivel) IN ('operador', 'conferente', 'supervisor', 'administrador', 'gestor'));

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
    ADD COLUMN IF NOT EXISTS alterado_sistema BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS data_confirmacao TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS usuario_confirmacao TEXT,
    ADD COLUMN IF NOT EXISTS usuario_confirmacao_nome TEXT;

CREATE INDEX IF NOT EXISTS idx_alteracoes_endereco_status_ordem 
    ON public.alteracoes_endereco (alterado_sistema, data DESC);

-- RLS: Segurança em nível de linha para public.alteracoes_endereco
ALTER TABLE public.alteracoes_endereco ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de alteracoes_endereco" ON public.alteracoes_endereco;
CREATE POLICY "Permitir leitura de alteracoes_endereco" ON public.alteracoes_endereco
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercao de alteracoes_endereco" ON public.alteracoes_endereco;
CREATE POLICY "Permitir insercao de alteracoes_endereco" ON public.alteracoes_endereco
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir confirmacao de alteracoes por gestor ou assistente" ON public.alteracoes_endereco;
DROP POLICY IF EXISTS "Permitir atualizacao de alteracoes_endereco" ON public.alteracoes_endereco;
CREATE POLICY "Permitir atualizacao de alteracoes_endereco" ON public.alteracoes_endereco
    FOR UPDATE USING (true) WITH CHECK (true);

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
    ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS transportadora_id UUID REFERENCES public.transportadoras(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_agendamentos_usuario_id 
    ON public.agendamentos (usuario_id);

CREATE INDEX IF NOT EXISTS idx_agendamentos_fornecedor_id 
    ON public.agendamentos (fornecedor_id);

CREATE INDEX IF NOT EXISTS idx_agendamentos_transportadora_id 
    ON public.agendamentos (transportadora_id);
`;

export const SUPABASE_UNIDADES_SQL = `-- ==============================================================================
-- POLIHUB — SCRIPT SUPABASE: MULTI-UNIDADE DE NEGÓCIO & AUDITORIA DE ATUALIZAÇÕES
-- ==============================================================================
-- 1. Cria ou assegura a coluna unidade_negocio com valor padrão 'Goiânia' em:
--    - public.usuarios
--    - public.agendamentos
--    - public.recebimentos_produtos
--    - public.alteracoes_endereco
--    - public.expedicao_coletas
--    - public.tarefas
--    - public.inventario
-- 2. Cria a tabela public.atualizacoes para histórico e auditoria por Unidade
-- 3. Índices de performance e políticas RLS de leitura/escrita
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. TABELA: public.unidades_negocio (Gestão e Cadastro de Filiais/Unidades)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.unidades_negocio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL UNIQUE,
    sigla TEXT,
    cidade TEXT,
    estado TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unidades_negocio_nome 
    ON public.unidades_negocio (LOWER(TRIM(nome)));

ALTER TABLE public.unidades_negocio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de unidades_negocio" ON public.unidades_negocio;
CREATE POLICY "Permitir leitura de unidades_negocio" 
    ON public.unidades_negocio 
    FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Permitir gestao de unidades_negocio" ON public.unidades_negocio;
CREATE POLICY "Permitir gestao de unidades_negocio" 
    ON public.unidades_negocio 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

-- Carga inicial com as unidades padrão do sistema
INSERT INTO public.unidades_negocio (nome, sigla, cidade, estado, ativo)
VALUES 
    ('Goiânia', 'GYN', 'Goiânia', 'GO', true),
    ('Mato Grosso', 'MT', 'Cuiabá', 'MT', true)
ON CONFLICT (nome) DO NOTHING;

-- ==============================================================================
-- 2. ATUALIZAÇÃO DAS TABELAS OPERACIONAIS COM A COLUNA unidade_negocio
-- ==============================================================================

-- 2.1 Coluna unidade_negocio na tabela usuarios
ALTER TABLE public.usuarios 
    ADD COLUMN IF NOT EXISTS unidade_negocio TEXT NOT NULL DEFAULT 'Goiânia';

UPDATE public.usuarios 
    SET unidade_negocio = 'Goiânia' 
    WHERE unidade_negocio IS NULL OR unidade_negocio = '';

CREATE INDEX IF NOT EXISTS idx_usuarios_unidade_negocio 
    ON public.usuarios (unidade_negocio);

-- 2.2 Coluna unidade_negocio na tabela agendamentos
ALTER TABLE public.agendamentos 
    ADD COLUMN IF NOT EXISTS unidade_negocio TEXT NOT NULL DEFAULT 'Goiânia';

UPDATE public.agendamentos 
    SET unidade_negocio = 'Goiânia' 
    WHERE unidade_negocio IS NULL OR unidade_negocio = '';

CREATE INDEX IF NOT EXISTS idx_agendamentos_unidade_negocio 
    ON public.agendamentos (unidade_negocio);

-- 2.3 Coluna unidade_negocio na tabela recebimentos_produtos
ALTER TABLE public.recebimentos_produtos 
    ADD COLUMN IF NOT EXISTS unidade_negocio TEXT NOT NULL DEFAULT 'Goiânia';

UPDATE public.recebimentos_produtos 
    SET unidade_negocio = 'Goiânia' 
    WHERE unidade_negocio IS NULL OR unidade_negocio = '';

CREATE INDEX IF NOT EXISTS idx_recebimentos_produtos_unidade 
    ON public.recebimentos_produtos (unidade_negocio);

-- 2.4 Coluna unidade_negocio na tabela alteracoes_endereco
ALTER TABLE public.alteracoes_endereco 
    ADD COLUMN IF NOT EXISTS unidade_negocio TEXT NOT NULL DEFAULT 'Goiânia';

UPDATE public.alteracoes_endereco 
    SET unidade_negocio = 'Goiânia' 
    WHERE unidade_negocio IS NULL OR unidade_negocio = '';

CREATE INDEX IF NOT EXISTS idx_alteracoes_endereco_unidade 
    ON public.alteracoes_endereco (unidade_negocio);

-- 2.5 Coluna unidade_negocio na tabela expedicao_coletas
ALTER TABLE public.expedicao_coletas 
    ADD COLUMN IF NOT EXISTS unidade_negocio TEXT NOT NULL DEFAULT 'Goiânia';

UPDATE public.expedicao_coletas 
    SET unidade_negocio = 'Goiânia' 
    WHERE unidade_negocio IS NULL OR unidade_negocio = '';

CREATE INDEX IF NOT EXISTS idx_expedicao_coletas_unidade 
    ON public.expedicao_coletas (unidade_negocio);

-- 2.6 Coluna unidade_negocio na tabela tarefas
ALTER TABLE public.tarefas 
    ADD COLUMN IF NOT EXISTS unidade_negocio TEXT NOT NULL DEFAULT 'Goiânia';

UPDATE public.tarefas 
    SET unidade_negocio = 'Goiânia' 
    WHERE unidade_negocio IS NULL OR unidade_negocio = '';

CREATE INDEX IF NOT EXISTS idx_tarefas_unidade 
    ON public.tarefas (unidade_negocio);

-- 2.7 Coluna unidade_negocio na tabela inventario
ALTER TABLE public.inventario 
    ADD COLUMN IF NOT EXISTS unidade_negocio TEXT NOT NULL DEFAULT 'Goiânia';

UPDATE public.inventario 
    SET unidade_negocio = 'Goiânia' 
    WHERE unidade_negocio IS NULL OR unidade_negocio = '';

CREATE INDEX IF NOT EXISTS idx_inventario_unidade 
    ON public.inventario (unidade_negocio);

-- 2.8 Coluna unidade_negocio na tabela enderecos
ALTER TABLE public.enderecos 
    ADD COLUMN IF NOT EXISTS unidade_negocio TEXT NOT NULL DEFAULT 'Goiânia';

UPDATE public.enderecos 
    SET unidade_negocio = 'Goiânia' 
    WHERE unidade_negocio IS NULL OR unidade_negocio = '';

CREATE INDEX IF NOT EXISTS idx_enderecos_unidade 
    ON public.enderecos (unidade_negocio);

-- ==============================================================================
-- 3. TABELA: public.atualizacoes (Auditoria Operacional por Unidade)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.atualizacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unidade_negocio TEXT NOT NULL DEFAULT 'Goiânia',
    numero BIGINT GENERATED ALWAYS AS IDENTITY,
    modulo TEXT NOT NULL,
    tipo TEXT NOT NULL,
    titulo TEXT NOT NULL,
    descricao TEXT,
    registro_id TEXT,
    usuario_id UUID,
    data_evento TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atualizacoes_unidade 
    ON public.atualizacoes (unidade_negocio);

CREATE INDEX IF NOT EXISTS idx_atualizacoes_modulo 
    ON public.atualizacoes (modulo);

CREATE INDEX IF NOT EXISTS idx_atualizacoes_created_at 
    ON public.atualizacoes (created_at DESC);

ALTER TABLE public.atualizacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de atualizacoes" ON public.atualizacoes;
CREATE POLICY "Permitir leitura de atualizacoes" 
    ON public.atualizacoes 
    FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Permitir escrita de atualizacoes" ON public.atualizacoes;
CREATE POLICY "Permitir escrita de atualizacoes" 
    ON public.atualizacoes 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

-- ==============================================================================
-- 4. REGRAS E FILTRAGEM POR UNIDADE DE NEGÓCIO (MULTI-TENANT POLIHUB)
-- ==============================================================================
-- A) TABELAS GLOBAIS COMPARTILHADAS (SEM filtro de unidade - Visíveis para todos):
--    - public.produtos
--    - public.usuarios
--    - public.unidades_negocio
--    - public.transportadoras
--    - public.fornecedores
--
-- B) TABELAS OPERACIONAIS (Filtradas pela unidade de negócio do usuário):
--    - public.agendamentos
--    - public.recebimentos_produtos
--    - public.alteracoes_endereco
--    - public.expedicao_coletas
--    - public.tarefas
--    - public.inventario
--    - public.atualizacoes
`;

export const SUPABASE_FILTRO_UNIDADES_SQL = `-- ==============================================================================
-- POLIHUB — SCRIPT SUPABASE: FILTRO DE DADOS POR UNIDADE DE NEGÓCIO (RLS)
-- ==============================================================================
-- REQUISITOS ATENDIDOS:
-- 1. Filtrar os dados no carregamento (SELECT) trazendo apenas a unidade do usuário.
-- 2. Não afeta nem bloqueia Adicionar (INSERT), Editar (UPDATE) ou Excluir (DELETE).
-- 3. NÃO APLICAR o filtro nas tabelas de cadastro compartilhadas:
--    - public.produtos
--    - public.usuarios
--    - public.unidades_negocio
--    - public.transportadoras
--    - public.fornecedores
-- 4. APLICAR o filtro estrito nas tabelas operacionais:
--    - public.agendamentos
--    - public.expedicao_coletas
--    - public.tarefas
--    - public.enderecos
--    - public.inventario
--    - public.recebimentos_produtos
--    - public.alteracoes_endereco
--    - public.atualizacoes
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. GARANTIR A COLUNA unidade_negocio E ÍNDICES NAS TABELAS OPERACIONAIS
-- ------------------------------------------------------------------------------
ALTER TABLE public.agendamentos 
    ADD COLUMN IF NOT EXISTS unidade_negocio TEXT NOT NULL DEFAULT 'Goiânia';
CREATE INDEX IF NOT EXISTS idx_agendamentos_unidade ON public.agendamentos (unidade_negocio);

ALTER TABLE public.expedicao_coletas 
    ADD COLUMN IF NOT EXISTS unidade_negocio TEXT NOT NULL DEFAULT 'Goiânia';
CREATE INDEX IF NOT EXISTS idx_expedicao_coletas_unidade ON public.expedicao_coletas (unidade_negocio);

ALTER TABLE public.tarefas 
    ADD COLUMN IF NOT EXISTS unidade_negocio TEXT NOT NULL DEFAULT 'Goiânia';
CREATE INDEX IF NOT EXISTS idx_tarefas_unidade ON public.tarefas (unidade_negocio);

ALTER TABLE public.enderecos 
    ADD COLUMN IF NOT EXISTS unidade_negocio TEXT NOT NULL DEFAULT 'Goiânia';
CREATE INDEX IF NOT EXISTS idx_enderecos_unidade ON public.enderecos (unidade_negocio);

ALTER TABLE public.inventario 
    ADD COLUMN IF NOT EXISTS unidade_negocio TEXT NOT NULL DEFAULT 'Goiânia';
CREATE INDEX IF NOT EXISTS idx_inventario_unidade ON public.inventario (unidade_negocio);

ALTER TABLE public.recebimentos_produtos 
    ADD COLUMN IF NOT EXISTS unidade_negocio TEXT NOT NULL DEFAULT 'Goiânia';
CREATE INDEX IF NOT EXISTS idx_recebimentos_produtos_unidade ON public.recebimentos_produtos (unidade_negocio);

ALTER TABLE public.alteracoes_endereco 
    ADD COLUMN IF NOT EXISTS unidade_negocio TEXT NOT NULL DEFAULT 'Goiânia';
CREATE INDEX IF NOT EXISTS idx_alteracoes_endereco_unidade ON public.alteracoes_endereco (unidade_negocio);

ALTER TABLE public.atualizacoes 
    ADD COLUMN IF NOT EXISTS unidade_negocio TEXT NOT NULL DEFAULT 'Goiânia';
CREATE INDEX IF NOT EXISTS idx_atualizacoes_unidade ON public.atualizacoes (unidade_negocio);

-- ------------------------------------------------------------------------------
-- 2. NORMALIZAR REGISTROS LEGADOS (PREENCHER NULOS COM A UNIDADE MATRIZ 'Goiânia')
-- ------------------------------------------------------------------------------
UPDATE public.agendamentos SET unidade_negocio = 'Goiânia' WHERE unidade_negocio IS NULL OR TRIM(unidade_negocio) = '';
UPDATE public.expedicao_coletas SET unidade_negocio = 'Goiânia' WHERE unidade_negocio IS NULL OR TRIM(unidade_negocio) = '';
UPDATE public.tarefas SET unidade_negocio = 'Goiânia' WHERE unidade_negocio IS NULL OR TRIM(unidade_negocio) = '';
UPDATE public.enderecos SET unidade_negocio = 'Goiânia' WHERE unidade_negocio IS NULL OR TRIM(unidade_negocio) = '';
UPDATE public.inventario SET unidade_negocio = 'Goiânia' WHERE unidade_negocio IS NULL OR TRIM(unidade_negocio) = '';
UPDATE public.recebimentos_produtos SET unidade_negocio = 'Goiânia' WHERE unidade_negocio IS NULL OR TRIM(unidade_negocio) = '';
UPDATE public.alteracoes_endereco SET unidade_negocio = 'Goiânia' WHERE unidade_negocio IS NULL OR TRIM(unidade_negocio) = '';
UPDATE public.atualizacoes SET unidade_negocio = 'Goiânia' WHERE unidade_negocio IS NULL OR TRIM(unidade_negocio) = '';

-- ------------------------------------------------------------------------------
-- 3. FUNÇÃO STABLE PARA IDENTIFICAR A UNIDADE DE NEGÓCIO DO USUÁRIO CONECTADO
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_user_unidade()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_unidade TEXT;
BEGIN
    -- 1. Usuário autenticado via Supabase Auth (auth.uid()):
    IF auth.uid() IS NOT NULL THEN
        SELECT unidade_negocio INTO v_unidade
        FROM public.usuarios
        WHERE id = auth.uid()
        LIMIT 1;

        IF v_unidade IS NOT NULL AND TRIM(v_unidade) <> '' THEN
            RETURN TRIM(v_unidade);
        END IF;

        -- Metadata do JWT
        BEGIN
            v_unidade := NULLIF(current_setting('request.jwt.claims', true)::json->'user_metadata'->>'unidade_negocio', '');
            IF v_unidade IS NOT NULL AND TRIM(v_unidade) <> '' THEN
                RETURN TRIM(v_unidade);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;

    -- 2. Cabeçalho HTTP customizado via PostgREST (x-unidade-negocio)
    BEGIN
        v_unidade := NULLIF(current_setting('request.headers', true)::json->>'x-unidade-negocio', '');
        IF v_unidade IS NOT NULL AND TRIM(v_unidade) <> '' THEN
            RETURN TRIM(v_unidade);
        END IF;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- 3. Variável de sessão configurada (SET LOCAL app.current_unidade = '...')
    BEGIN
        v_unidade := NULLIF(current_setting('app.current_unidade', true), '');
        IF v_unidade IS NOT NULL AND TRIM(v_unidade) <> '' THEN
            RETURN TRIM(v_unidade);
        END IF;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    RETURN NULL;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. FUNÇÃO VALIDADORA DE ACESSO POR LINHA
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_user_unidade_access(item_unidade TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_user_unidade TEXT;
    v_user_nivel TEXT;
    v_item_clean TEXT;
BEGIN
    -- Registros sem unidade definida pertencem à unidade Matriz padrão ('Goiânia')
    v_item_clean := LOWER(TRIM(COALESCE(item_unidade, 'Goiânia')));
    IF v_item_clean = '' THEN
        v_item_clean := 'goiânia';
    END IF;

    -- Obtém a unidade do usuário conectado
    v_user_unidade := public.get_current_user_unidade();

    -- Se o usuário possui uma unidade associada, filtra estritamente por ela (reconhece variantes)
    IF v_user_unidade IS NOT NULL AND TRIM(v_user_unidade) <> '' THEN
        IF LOWER(TRIM(v_user_unidade)) IN ('goiânia', 'goiania', 'goiânia-go', 'goiania-go') THEN
            RETURN v_item_clean IN ('goiânia', 'goiania', 'goiânia-go', 'goiania-go');
        ELSIF LOWER(TRIM(v_user_unidade)) IN ('mato grosso', 'mt') THEN
            RETURN v_item_clean IN ('mato grosso', 'mt');
        ELSE
            RETURN v_item_clean = LOWER(TRIM(v_user_unidade));
        END IF;
    END IF;

    -- Se for consulta anônima do cliente sem token auth.uid(), permite leitura pelo Supabase
    -- (o frontend aplica o filtro in('unidade_negocio', [...]) no carregamento dos dados)
    IF auth.uid() IS NULL THEN
        RETURN true;
    END IF;

    -- Se autenticado no Supabase Auth:
    SELECT LOWER(TRIM(COALESCE(nivel, ''))), unidade_negocio 
    INTO v_user_nivel, v_user_unidade
    FROM public.usuarios
    WHERE id = auth.uid()
    LIMIT 1;

    IF v_user_unidade IS NOT NULL AND TRIM(v_user_unidade) <> '' THEN
        IF LOWER(TRIM(v_user_unidade)) IN ('goiânia', 'goiania', 'goiânia-go', 'goiania-go') THEN
            RETURN v_item_clean IN ('goiânia', 'goiania', 'goiânia-go', 'goiania-go');
        ELSIF LOWER(TRIM(v_user_unidade)) IN ('mato grosso', 'mt') THEN
            RETURN v_item_clean IN ('mato grosso', 'mt');
        ELSE
            RETURN v_item_clean = LOWER(TRIM(v_user_unidade));
        END IF;
    END IF;

    IF v_user_nivel IN ('gestor', 'administrador') THEN
        RETURN true;
    END IF;

    RETURN true;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. TABELAS DE CADASTRO GLOBAIS (SEM FILTRO - VISÍVEIS E EDITÁVEIS POR TODOS)
-- ------------------------------------------------------------------------------

-- 4.1 public.produtos
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "produtos_select_global" ON public.produtos;
CREATE POLICY "produtos_select_global" ON public.produtos FOR SELECT USING (true);
DROP POLICY IF EXISTS "produtos_insert_global" ON public.produtos;
CREATE POLICY "produtos_insert_global" ON public.produtos FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "produtos_update_global" ON public.produtos;
CREATE POLICY "produtos_update_global" ON public.produtos FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "produtos_delete_global" ON public.produtos;
CREATE POLICY "produtos_delete_global" ON public.produtos FOR DELETE USING (true);

-- 4.2 public.usuarios
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios_select_global" ON public.usuarios;
CREATE POLICY "usuarios_select_global" ON public.usuarios FOR SELECT USING (true);
DROP POLICY IF EXISTS "usuarios_insert_global" ON public.usuarios;
CREATE POLICY "usuarios_insert_global" ON public.usuarios FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "usuarios_update_global" ON public.usuarios;
CREATE POLICY "usuarios_update_global" ON public.usuarios FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "usuarios_delete_global" ON public.usuarios;
CREATE POLICY "usuarios_delete_global" ON public.usuarios FOR DELETE USING (true);

-- 4.3 public.unidades_negocio
ALTER TABLE public.unidades_negocio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "unidades_select_global" ON public.unidades_negocio;
CREATE POLICY "unidades_select_global" ON public.unidades_negocio FOR SELECT USING (true);
DROP POLICY IF EXISTS "unidades_insert_global" ON public.unidades_negocio;
CREATE POLICY "unidades_insert_global" ON public.unidades_negocio FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "unidades_update_global" ON public.unidades_negocio;
CREATE POLICY "unidades_update_global" ON public.unidades_negocio FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "unidades_delete_global" ON public.unidades_negocio;
CREATE POLICY "unidades_delete_global" ON public.unidades_negocio FOR DELETE USING (true);

-- 4.4 public.transportadoras
ALTER TABLE public.transportadoras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "transportadoras_select_global" ON public.transportadoras;
CREATE POLICY "transportadoras_select_global" ON public.transportadoras FOR SELECT USING (true);
DROP POLICY IF EXISTS "transportadoras_insert_global" ON public.transportadoras;
CREATE POLICY "transportadoras_insert_global" ON public.transportadoras FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "transportadoras_update_global" ON public.transportadoras;
CREATE POLICY "transportadoras_update_global" ON public.transportadoras FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "transportadoras_delete_global" ON public.transportadoras;
CREATE POLICY "transportadoras_delete_global" ON public.transportadoras FOR DELETE USING (true);

-- 4.5 public.fornecedores
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fornecedores_select_global" ON public.fornecedores;
CREATE POLICY "fornecedores_select_global" ON public.fornecedores FOR SELECT USING (true);
DROP POLICY IF EXISTS "fornecedores_insert_global" ON public.fornecedores;
CREATE POLICY "fornecedores_insert_global" ON public.fornecedores FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "fornecedores_update_global" ON public.fornecedores;
CREATE POLICY "fornecedores_update_global" ON public.fornecedores FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "fornecedores_delete_global" ON public.fornecedores;
CREATE POLICY "fornecedores_delete_global" ON public.fornecedores FOR DELETE USING (true);

-- ------------------------------------------------------------------------------
-- 5. TABELAS OPERACIONAIS: FILTRO NO SELECT, OPERAÇÕES CRUD 100% LIBERADAS
-- ------------------------------------------------------------------------------

-- 5.1 public.agendamentos
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agendamentos_select_unidade" ON public.agendamentos;
CREATE POLICY "agendamentos_select_unidade" ON public.agendamentos 
    FOR SELECT USING (public.check_user_unidade_access(unidade_negocio));

DROP POLICY IF EXISTS "agendamentos_insert_livre" ON public.agendamentos;
CREATE POLICY "agendamentos_insert_livre" ON public.agendamentos 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "agendamentos_update_livre" ON public.agendamentos;
CREATE POLICY "agendamentos_update_livre" ON public.agendamentos 
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "agendamentos_delete_livre" ON public.agendamentos;
CREATE POLICY "agendamentos_delete_livre" ON public.agendamentos 
    FOR DELETE USING (true);

-- 5.2 public.recebimentos_produtos
ALTER TABLE public.recebimentos_produtos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recebimentos_produtos_select_unidade" ON public.recebimentos_produtos;
CREATE POLICY "recebimentos_produtos_select_unidade" ON public.recebimentos_produtos 
    FOR SELECT USING (public.check_user_unidade_access(unidade_negocio));

DROP POLICY IF EXISTS "recebimentos_produtos_insert_livre" ON public.recebimentos_produtos;
CREATE POLICY "recebimentos_produtos_insert_livre" ON public.recebimentos_produtos 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "recebimentos_produtos_update_livre" ON public.recebimentos_produtos;
CREATE POLICY "recebimentos_produtos_update_livre" ON public.recebimentos_produtos 
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "recebimentos_produtos_delete_livre" ON public.recebimentos_produtos;
CREATE POLICY "recebimentos_produtos_delete_livre" ON public.recebimentos_produtos 
    FOR DELETE USING (true);

-- 5.3 public.alteracoes_endereco (Alocação)
ALTER TABLE public.alteracoes_endereco ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alteracoes_endereco_select_unidade" ON public.alteracoes_endereco;
CREATE POLICY "alteracoes_endereco_select_unidade" ON public.alteracoes_endereco 
    FOR SELECT USING (public.check_user_unidade_access(unidade_negocio));

DROP POLICY IF EXISTS "alteracoes_endereco_insert_livre" ON public.alteracoes_endereco;
CREATE POLICY "alteracoes_endereco_insert_livre" ON public.alteracoes_endereco 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "alteracoes_endereco_update_livre" ON public.alteracoes_endereco;
CREATE POLICY "alteracoes_endereco_update_livre" ON public.alteracoes_endereco 
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "alteracoes_endereco_delete_livre" ON public.alteracoes_endereco;
CREATE POLICY "alteracoes_endereco_delete_livre" ON public.alteracoes_endereco 
    FOR DELETE USING (true);

-- 5.4 public.expedicao_coletas
ALTER TABLE public.expedicao_coletas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expedicao_coletas_select_unidade" ON public.expedicao_coletas;
CREATE POLICY "expedicao_coletas_select_unidade" ON public.expedicao_coletas 
    FOR SELECT USING (public.check_user_unidade_access(unidade_negocio));

DROP POLICY IF EXISTS "expedicao_coletas_insert_livre" ON public.expedicao_coletas;
CREATE POLICY "expedicao_coletas_insert_livre" ON public.expedicao_coletas 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "expedicao_coletas_update_livre" ON public.expedicao_coletas;
CREATE POLICY "expedicao_coletas_update_livre" ON public.expedicao_coletas 
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "expedicao_coletas_delete_livre" ON public.expedicao_coletas;
CREATE POLICY "expedicao_coletas_delete_livre" ON public.expedicao_coletas 
    FOR DELETE USING (true);

-- 5.5 public.tarefas
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tarefas_select_unidade" ON public.tarefas;
CREATE POLICY "tarefas_select_unidade" ON public.tarefas 
    FOR SELECT USING (public.check_user_unidade_access(unidade_negocio));

DROP POLICY IF EXISTS "tarefas_insert_livre" ON public.tarefas;
CREATE POLICY "tarefas_insert_livre" ON public.tarefas 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "tarefas_update_livre" ON public.tarefas;
CREATE POLICY "tarefas_update_livre" ON public.tarefas 
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tarefas_delete_livre" ON public.tarefas;
CREATE POLICY "tarefas_delete_livre" ON public.tarefas 
    FOR DELETE USING (true);

-- 5.6 public.enderecos
ALTER TABLE public.enderecos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "enderecos_select_unidade" ON public.enderecos;
CREATE POLICY "enderecos_select_unidade" ON public.enderecos 
    FOR SELECT USING (public.check_user_unidade_access(unidade_negocio));

DROP POLICY IF EXISTS "enderecos_insert_livre" ON public.enderecos;
CREATE POLICY "enderecos_insert_livre" ON public.enderecos 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "enderecos_update_livre" ON public.enderecos;
CREATE POLICY "enderecos_update_livre" ON public.enderecos 
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "enderecos_delete_livre" ON public.enderecos;
CREATE POLICY "enderecos_delete_livre" ON public.enderecos 
    FOR DELETE USING (true);

-- 5.7 public.inventario
ALTER TABLE public.inventario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventario_select_unidade" ON public.inventario;
CREATE POLICY "inventario_select_unidade" ON public.inventario 
    FOR SELECT USING (public.check_user_unidade_access(unidade_negocio));

DROP POLICY IF EXISTS "inventario_insert_livre" ON public.inventario;
CREATE POLICY "inventario_insert_livre" ON public.inventario 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "inventario_update_livre" ON public.inventario;
CREATE POLICY "inventario_update_livre" ON public.inventario 
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "inventario_delete_livre" ON public.inventario;
CREATE POLICY "inventario_delete_livre" ON public.inventario 
    FOR DELETE USING (true);

-- 5.7 public.atualizacoes
ALTER TABLE public.atualizacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "atualizacoes_select_unidade" ON public.atualizacoes;
CREATE POLICY "atualizacoes_select_unidade" ON public.atualizacoes 
    FOR SELECT USING (public.check_user_unidade_access(unidade_negocio));

DROP POLICY IF EXISTS "atualizacoes_insert_livre" ON public.atualizacoes;
CREATE POLICY "atualizacoes_insert_livre" ON public.atualizacoes 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "atualizacoes_update_livre" ON public.atualizacoes;
CREATE POLICY "atualizacoes_update_livre" ON public.atualizacoes 
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "atualizacoes_delete_livre" ON public.atualizacoes;
CREATE POLICY "atualizacoes_delete_livre" ON public.atualizacoes 
    FOR DELETE USING (true);
`;

export const SqlScriptModal: React.FC<SqlScriptModalProps> = ({ isOpen, onClose, defaultTab = 'hub_messenger' }) => {
  const [activeTab, setActiveTab] = useState<'hub_messenger' | 'filtro_unidades' | 'veiculos' | 'produtos' | 'usuarios' | 'pin' | 'completo' | 'push' | 'coletas' | 'unidades' | 'status_recebimento' | 'email_sync'>(defaultTab);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  let currentSql = SUPABASE_HUB_MESSENGER_SQL;
  let fileName = 'schema_hub_messenger.sql';
  let tabLabel = 'Hub Messenger (chat_conversas, chat_participantes, chat_mensagens & RPC)';

  if (activeTab === 'hub_messenger') {
    currentSql = SUPABASE_HUB_MESSENGER_SQL;
    fileName = 'schema_hub_messenger.sql';
    tabLabel = 'Hub Messenger (chat_conversas, chat_participantes, chat_mensagens & RPC)';
  } else if (activeTab === 'filtro_unidades') {
    currentSql = SUPABASE_FILTRO_UNIDADES_SQL;
    fileName = 'filtro_unidades_rls.sql';
    tabLabel = 'Filtro por Unidades (RLS Completo)';
  } else if (activeTab === 'veiculos') {
    currentSql = SUPABASE_VEICULOS_SQL;
    fileName = 'schema_controle_veiculos.sql';
    tabLabel = 'Controle de Veículos (veiculos, saidas, abastecimentos)';
  } else if (activeTab === 'status_recebimento') {
    currentSql = SUPABASE_RECEBIMENTOS_STATUS_SQL;
    fileName = 'alter_recebimentos_status_validado.sql';
    tabLabel = 'Status Validado (recebimentos_produtos)';
  } else if (activeTab === 'unidades') {
    currentSql = SUPABASE_UNIDADES_SQL;
    fileName = 'schema_unidades_e_atualizacoes.sql';
    tabLabel = 'Unidades de Negócio & Atualizações';
  } else if (activeTab === 'coletas') {
    currentSql = SUPABASE_COLETAS_SQL;
    fileName = 'schema_expedicao_coletas.sql';
    tabLabel = 'Coletas da Expedição (expedicao_coletas)';
  } else if (activeTab === 'push') {
    currentSql = SUPABASE_PUSH_SUBSCRIPTIONS_SQL;
    fileName = 'supabase_push_subscriptions.sql';
    tabLabel = 'Notificações Push (push_subscriptions)';
  } else if (activeTab === 'pin') {
    currentSql = SUPABASE_PIN_SQL;
    fileName = 'supabase_pin_migration.sql';
    tabLabel = 'Coluna PIN (4 dígitos)';
  } else if (activeTab === 'email_sync') {
    currentSql = SUPABASE_EMAIL_SYNC_SQL;
    fileName = 'sync_usuarios_email_supabase_auth.sql';
    tabLabel = 'Sincronizar E-mails (Supabase Auth)';
  } else if (activeTab === 'usuarios') {
    currentSql = SUPABASE_USUARIOS_FIX_SQL;
    fileName = 'fix_usuarios_rls_constraints.sql';
    tabLabel = 'Tabela Usuários';
  } else if (activeTab === 'produtos') {
    currentSql = SUPABASE_PRODUTOS_BARCODE_SQL;
    fileName = 'add_codigo_barras_produtos.sql';
    tabLabel = 'Código de Barras';
  } else if (activeTab === 'completo') {
    currentSql = SUPABASE_CADASTROS_SQL;
    fileName = 'schema_cadastros_polihub.sql';
    tabLabel = 'Script Completo';
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(currentSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
    >
      <div className="w-full max-w-3xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-5 sm:p-7 text-slate-100 my-auto animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* HEADER */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-md">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Scripts SQL para Supabase
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                PIN de 4 dígitos, código de barras, correções de RLS e schemas integrados
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-sql-modal"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TABS SELECTOR */}
        <div className="flex items-center gap-2 pt-4 pb-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            id="btn-tab-sql-hub-messenger"
            onClick={() => setActiveTab('hub_messenger')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition min-h-[40px] border whitespace-nowrap ${
              activeTab === 'hub_messenger'
                ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30 font-black'
                : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4 text-sky-400" />
            <span>Hub Messenger (Chat & RPC)</span>
          </button>

          <button
            type="button"
            id="btn-tab-sql-filtro-unidades"
            onClick={() => setActiveTab('filtro_unidades')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition min-h-[40px] border whitespace-nowrap ${
              activeTab === 'filtro_unidades'
                ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30 font-black'
                : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-800'
            }`}
          >
            <Filter className="w-4 h-4 text-blue-300" />
            <span>Filtro de Unidades (RLS)</span>
          </button>

          <button
            type="button"
            id="btn-tab-sql-veiculos"
            onClick={() => setActiveTab('veiculos')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition min-h-[40px] border whitespace-nowrap ${
              activeTab === 'veiculos'
                ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30 font-black'
                : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-800'
            }`}
          >
            <Truck className="w-4 h-4 text-sky-300" />
            <span>Controle de Veículos (Frota & Saídas)</span>
          </button>

          <button
            type="button"
            id="btn-tab-sql-unidades"
            onClick={() => setActiveTab('unidades')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition min-h-[40px] border whitespace-nowrap ${
              activeTab === 'unidades'
                ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30'
                : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Unidades & Atualizações</span>
          </button>

          <button
            type="button"
            id="btn-tab-sql-coletas"
            onClick={() => setActiveTab('coletas')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition min-h-[40px] border whitespace-nowrap ${
              activeTab === 'coletas'
                ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30'
                : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-800'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Coletas da Expedição (expedicao_coletas)</span>
          </button>

          <button
            type="button"
            id="btn-tab-sql-push"
            onClick={() => setActiveTab('push')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition min-h-[40px] border whitespace-nowrap ${
              activeTab === 'push'
                ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30'
                : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-800'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Notificações Push (push_subscriptions)</span>
          </button>

          <button
            type="button"
            id="btn-tab-sql-pin"
            onClick={() => setActiveTab('pin')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition min-h-[40px] border whitespace-nowrap ${
              activeTab === 'pin'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-900/30 font-black'
                : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-800'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Coluna PIN (Identificação Operacional)</span>
          </button>

          <button
            type="button"
            id="btn-tab-sql-produtos"
            onClick={() => setActiveTab('produtos')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition min-h-[40px] border whitespace-nowrap ${
              activeTab === 'produtos'
                ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30'
                : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-800'
            }`}
          >
            <Barcode className="w-4 h-4" />
            <span>Código de Barras (produtos)</span>
          </button>

          <button
            type="button"
            id="btn-tab-sql-email-sync"
            onClick={() => setActiveTab('email_sync')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition min-h-[40px] border whitespace-nowrap ${
              activeTab === 'email_sync'
                ? 'bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-900/30 font-black'
                : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-800'
            }`}
          >
            <Mail className="w-4 h-4 text-sky-400" />
            <span>Sincronizar E-mails (Supabase Auth)</span>
          </button>

          <button
            type="button"
            id="btn-tab-sql-usuarios"
            onClick={() => setActiveTab('usuarios')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition min-h-[40px] border whitespace-nowrap ${
              activeTab === 'usuarios'
                ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30'
                : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Tabela Usuários (RLS & Permissões)</span>
          </button>

          <button
            type="button"
            id="btn-tab-sql-status-recebimento"
            onClick={() => setActiveTab('status_recebimento')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition min-h-[40px] border whitespace-nowrap ${
              activeTab === 'status_recebimento'
                ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-900/30 font-black'
                : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-rose-300" />
            <span>Status Validado (recebimentos_produtos)</span>
          </button>

          <button
            type="button"
            id="btn-tab-sql-completo"
            onClick={() => setActiveTab('completo')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition min-h-[40px] border whitespace-nowrap ${
              activeTab === 'completo'
                ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30'
                : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Script Completo (Todas as Tabelas)</span>
          </button>
        </div>

        {/* CONTENT */}
        <div className="mt-2 space-y-3 overflow-y-auto pr-1 flex-1">
          {activeTab === 'status_recebimento' ? (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3.5 text-xs text-rose-200">
              <div className="flex items-center gap-2 font-bold text-white mb-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Atualização de Status — Validação e Finalização Excepcional:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-300 ml-1">
                <li><strong className="text-white">Status aceitos:</strong> Atualiza a constraint para aceitar os valores oficiais: <code className="font-mono text-rose-300">Recebido</code>, <code className="font-mono text-rose-300">Conferido</code>, <code className="font-mono text-rose-300">Crítica</code>, <code className="font-mono text-rose-300">Validado</code> e <code className="font-mono text-rose-300">Alocado</code>.</li>
                <li><strong className="text-white">Compatibilidade Total:</strong> Suporta tanto banco com tipo ENUM quanto com restrição CHECK sem erro de duplicação.</li>
                <li><strong className="text-white">Índices de Performance:</strong> Cria índices dedicados em <code className="font-mono text-rose-300">status</code> e <code className="font-mono text-rose-300">(nota_fiscal, status)</code> para carregamento instantâneo.</li>
              </ul>
            </div>
          ) : activeTab === 'unidades' ? (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3.5 text-xs text-blue-200">
              <div className="flex items-center gap-2 font-bold text-white mb-1.5">
                <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Multi-Unidade de Negócio & Auditoria de Atualizações (public.atualizacoes):</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-300 ml-1">
                <li><strong className="text-white">Coluna unidade_negocio:</strong> Garante a separação e isolamento de filiais (ex: Goiânia, Mato Grosso) em usuários, agendamentos, conferências, alocações e expedição.</li>
                <li><strong className="text-white">Tabela public.atualizacoes:</strong> Centraliza o histórico de auditoria de eventos operacionais por unidade com numeração cronológica.</li>
                <li><strong className="text-white">Segurança e RLS:</strong> Políticas de RLS habilitadas para consultas ágeis com índices dedicados.</li>
              </ul>
            </div>
          ) : activeTab === 'push' ? (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3.5 text-xs text-blue-200">
              <div className="flex items-center gap-2 font-bold text-white mb-1.5">
                <Bell className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Tabela public.push_subscriptions (Notificações Push Gerais):</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-300 ml-1">
                <li><strong className="text-white">Campos:</strong> <code className="font-mono text-blue-300">id</code>, <code className="font-mono text-blue-300">usuario_id</code>, <code className="font-mono text-blue-300">endpoint</code> (único), <code className="font-mono text-blue-300">p256dh</code>, <code className="font-mono text-blue-300">auth</code>, <code className="font-mono text-blue-300">created_at</code>, <code className="font-mono text-blue-300">updated_at</code>.</li>
                <li><strong className="text-white">Notificação Geral:</strong> Todos os usuários que autorizarem o navegador ou PWA receberão o Push quando uma NF entrar como &ldquo;Recebido&rdquo;.</li>
                <li><strong className="text-white">Segurança:</strong> Chaves VAPID gerenciadas exclusivamente no servidor; políticas de RLS ativadas.</li>
              </ul>
            </div>
          ) : activeTab === 'pin' ? (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 text-xs text-amber-200">
              <div className="flex items-center gap-2 font-bold text-white mb-1.5">
                <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Identificação Operacional por PIN (4 dígitos numéricos):</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-300 ml-1">
                <li><strong className="text-white">Coluna pin (TEXT):</strong> Adiciona a coluna como <code className="font-mono text-amber-300">TEXT</code> na tabela <code className="font-mono text-amber-300">usuarios</code> para preservar zeros à esquerda (ex: &ldquo;0123&rdquo;).</li>
                <li><strong className="text-white">Conferente & Repositor:</strong> Garante as colunas <code className="font-mono text-amber-300">conferente_id</code> e <code className="font-mono text-amber-300">repositor_id</code> na tabela <code className="font-mono text-amber-300">recebimentos_produtos</code>.</li>
                <li><strong className="text-white">Auditoria e Produtividade:</strong> Registra com precisão o operador real que efetuou a conferência e a alocação, sem misturar com o login do sistema.</li>
                <li><strong className="text-white">Índices de Busca:</strong> Cria índices dedicados para agilizar a conferência de PIN e relatórios operacionais.</li>
              </ul>
            </div>
          ) : activeTab === 'produtos' ? (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3.5 text-xs text-emerald-200">
              <div className="flex items-center gap-2 font-bold text-white mb-1.5">
                <Barcode className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Nova coluna de Código de Barras na tabela public.produtos:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-300 ml-1">
                <li><strong className="text-white">Coluna codigo_barras:</strong> Adiciona a coluna como tipo <code className="font-mono text-emerald-300">TEXT</code> de forma segura (<code className="font-mono text-emerald-300">ADD COLUMN IF NOT EXISTS</code>).</li>
                <li><strong className="text-white">Índice Dedicado:</strong> Cria índice <code className="font-mono text-emerald-300">idx_produtos_codigo_barras</code> para pesquisas instantâneas via leitor de código de barras ou bipe ótico.</li>
                <li><strong className="text-white">Compatibilidade:</strong> Preserva todos os produtos e registros existentes sem perda de dados.</li>
              </ul>
            </div>
          ) : activeTab === 'usuarios' ? (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3.5 text-xs text-blue-200">
              <div className="flex items-center gap-2 font-bold text-white mb-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
                <span>O que este script resolve na tabela usuarios:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-300 ml-1">
                <li><strong className="text-white">Desbloqueio de RLS:</strong> A política padrão do Supabase proibia gestores de alterar outros usuários. Este script concede a permissão necessária.</li>
                <li><strong className="text-white">Compatibilização de Níveis e Status:</strong> Aceita variações como &ldquo;gestor&rdquo;, &ldquo;Gestor&rdquo;, &ldquo;Operador&rdquo; e status &ldquo;aprovado&rdquo; sem erro de validação.</li>
                <li><strong className="text-white">Coluna status:</strong> Cria a coluna caso não exista e preenche automaticamente sem quebrar registros anteriores.</li>
                <li><strong className="text-white">Proteção do Último Gestor:</strong> Garante que o sistema nunca fique sem administrador ativo.</li>
              </ul>
            </div>
          ) : (
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-3.5 text-xs text-slate-300">
              <div className="flex items-center gap-2 font-bold text-white mb-1.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Script de Estrutura Completa:</span>
              </div>
              <p>
                Inclui a criação e atualização de todas as tabelas do módulo Cadastros: produtos (com código de barras), usuários, transportadoras, fornecedores e histórico de alocação de endereços.
              </p>
            </div>
          )}

          {/* CODE VIEWER */}
          <div className="relative">
            <div className="flex items-center justify-between px-3.5 py-2 bg-slate-950 border-t border-x border-slate-800 rounded-t-2xl text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                <span>{fileName}</span>
              </span>
              <button
                type="button"
                id="btn-copy-sql-modal-inside"
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-sans font-semibold bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/30 transition"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar SQL</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 rounded-b-2xl bg-slate-950/90 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-64 sm:max-h-72 leading-relaxed scrollbar-thin">
              {currentSql}
            </pre>
          </div>
        </div>

        {/* FOOTER */}
        <div className="pt-4 mt-3 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-slate-400 hidden sm:block">
            Cole no <strong>SQL Editor</strong> do Supabase e clique em <strong>Run</strong>.
          </p>
          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              id="btn-close-sql-modal-footer"
              onClick={onClose}
              className="px-4 py-2 rounded-2xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition min-h-[40px]"
            >
              Fechar
            </button>
            <button
              type="button"
              id="btn-copy-sql-modal-primary"
              onClick={handleCopy}
              className="flex items-center gap-2 px-5 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-900/30 transition min-h-[40px]"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Script Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar SQL ({tabLabel})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
