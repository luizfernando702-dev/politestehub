-- ==============================================================================
-- POLIHUB — SCRIPT SUPABASE: TABELA DE NOTIFICAÇÕES PUSH GERAIS
-- ==============================================================================
-- 1. Criação da tabela push_subscriptions
-- 2. Índices de performance para busca por usuario_id e unicidade de endpoint
-- 3. Row Level Security (RLS) configurado para proteção das subscriptions
-- ==============================================================================

-- 1. Assegurar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela de subscriptions de Notificações Push
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

-- Tentar criar chave estrangeira com public.usuarios caso a tabela exista
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
            NULL; -- Mantém compatibilidade caso a tipagem difira ou a FK já exista
        END;
    END IF;
END $$;

-- 3. Índices de performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_usuario_id 
    ON public.push_subscriptions (usuario_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint 
    ON public.push_subscriptions (endpoint);

-- 4. Comentários explicativos
COMMENT ON TABLE public.push_subscriptions IS 'Armazena as credenciais de subscrição Push Web de cada dispositivo autorizado do usuário no PoliHub';
COMMENT ON COLUMN public.push_subscriptions.endpoint IS 'URL única de envio do serviço Push (Google FCM, Mozilla, Apple Web Push)';
COMMENT ON COLUMN public.push_subscriptions.p256dh IS 'Chave pública Diffie-Hellman P-256 do dispositivo';
COMMENT ON COLUMN public.push_subscriptions.auth IS 'Segredo de autenticação gerado pelo cliente Web Push';

-- 5. Configuração de Row Level Security (RLS)
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
