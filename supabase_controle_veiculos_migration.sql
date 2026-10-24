-- ==============================================================================
-- POLIHUB — SCRIPT SQL DE BANCO DE DADOS SUPABASE
-- MÓDULO: CONTROLE DE VEÍCULOS (FROTA, SAÍDAS, COLETAS, ABASTECIMENTOS E RLS)
-- Data: Outubro de 2026
-- ==============================================================================

-- 1. HABILITAR EXTENSÃO DE UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. AJUSTE NA TABELA: expedicao_coletas (Novo campo 'valor' para valor da NF)
-- ==============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'expedicao_coletas'
    ) THEN
        ALTER TABLE public.expedicao_coletas 
            ADD COLUMN IF NOT EXISTS valor NUMERIC(12, 2) DEFAULT 0;
            
        CREATE INDEX IF NOT EXISTS idx_expedicao_coletas_valor 
            ON public.expedicao_coletas (valor);
    END IF;
END $$;

-- ==============================================================================
-- 3. TABELA: veiculos (Cadastro de Frota por Unidade de Negócio)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.veiculos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    marca TEXT NOT NULL,
    placa TEXT NOT NULL,
    unidade_negocio_id UUID REFERENCES public.unidades_negocio(id) ON DELETE SET NULL,
    unidade_negocio TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT veiculos_nome_not_empty CHECK (length(trim(nome)) > 0),
    CONSTRAINT veiculos_placa_not_empty CHECK (length(trim(placa)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_veiculos_unidade ON public.veiculos (unidade_negocio);
CREATE INDEX IF NOT EXISTS idx_veiculos_placa ON public.veiculos (placa);
CREATE INDEX IF NOT EXISTS idx_veiculos_ativo ON public.veiculos (ativo);

-- ==============================================================================
-- 4. TABELA: saidas_veiculos (Registro Operacional de Saídas)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.saidas_veiculos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    horario TIME NOT NULL DEFAULT CURRENT_TIME,
    periodo TEXT NOT NULL CHECK (periodo IN ('Manhã', 'Tarde')),
    veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE RESTRICT,
    motorista_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    motorista_nome TEXT,
    veiculo_nome TEXT,
    veiculo_marca TEXT,
    veiculo_placa TEXT,
    km_saida NUMERIC(10, 2) NOT NULL,
    km_rodado NUMERIC(10, 2), -- Null para a primeira saída do veículo
    quantidade_entregas INT NOT NULL DEFAULT 0,
    valor_total_notas NUMERIC(14, 2) NOT NULL DEFAULT 0,
    observacao TEXT,
    unidade_negocio_id UUID REFERENCES public.unidades_negocio(id) ON DELETE SET NULL,
    unidade_negocio TEXT NOT NULL,
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT saidas_km_positivo CHECK (km_saida >= 0)
);

CREATE INDEX IF NOT EXISTS idx_saidas_veiculo_data ON public.saidas_veiculos (veiculo_id, data DESC, horario DESC);
CREATE INDEX IF NOT EXISTS idx_saidas_unidade_data ON public.saidas_veiculos (unidade_negocio, data DESC);
CREATE INDEX IF NOT EXISTS idx_saidas_motorista ON public.saidas_veiculos (motorista_id);

-- ==============================================================================
-- 5. TABELA: saidas_coletas (Vínculo 1:N entre Saída e Coletas/Entregas)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.saidas_coletas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    saida_id UUID NOT NULL REFERENCES public.saidas_veiculos(id) ON DELETE CASCADE,
    coleta_id UUID NOT NULL REFERENCES public.expedicao_coletas(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT saidas_coletas_coleta_unique UNIQUE (coleta_id)
);

CREATE INDEX IF NOT EXISTS idx_saidas_coletas_saida ON public.saidas_coletas (saida_id);
CREATE INDEX IF NOT EXISTS idx_saidas_coletas_coleta ON public.saidas_coletas (coleta_id);

-- ==============================================================================
-- 6. TABELA: abastecimentos_veiculos (Registro de Abastecimentos)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.abastecimentos_veiculos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    horario TIME NOT NULL DEFAULT CURRENT_TIME,
    veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE RESTRICT,
    motorista_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    motorista_nome TEXT,
    veiculo_nome TEXT,
    veiculo_marca TEXT,
    veiculo_placa TEXT,
    km_abastecimento NUMERIC(10, 2) NOT NULL,
    quantidade_litros NUMERIC(10, 2) NOT NULL,
    valor_total NUMERIC(12, 2) NOT NULL,
    preco_litro NUMERIC(10, 2),
    observacao TEXT,
    unidade_negocio_id UUID REFERENCES public.unidades_negocio(id) ON DELETE SET NULL,
    unidade_negocio TEXT NOT NULL,
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT abast_km_positivo CHECK (km_abastecimento >= 0),
    CONSTRAINT abast_litros_positivo CHECK (quantidade_litros > 0),
    CONSTRAINT abast_valor_positivo CHECK (valor_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_abast_veiculo_data ON public.abastecimentos_veiculos (veiculo_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_abast_unidade_data ON public.abastecimentos_veiculos (unidade_negocio, data DESC);
CREATE INDEX IF NOT EXISTS idx_abast_motorista ON public.abastecimentos_veiculos (motorista_id);

-- ==============================================================================
-- 7. POLÍTICAS DE RLS (ROW LEVEL SECURITY)
-- ==============================================================================

-- Veículos
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de veiculos" ON public.veiculos;
CREATE POLICY "Permitir leitura de veiculos" ON public.veiculos
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escrita de veiculos" ON public.veiculos;
CREATE POLICY "Permitir escrita de veiculos" ON public.veiculos
    FOR ALL USING (true) WITH CHECK (true);

-- Saídas de Veículos
ALTER TABLE public.saidas_veiculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de saidas_veiculos" ON public.saidas_veiculos;
CREATE POLICY "Permitir leitura de saidas_veiculos" ON public.saidas_veiculos
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escrita de saidas_veiculos" ON public.saidas_veiculos;
CREATE POLICY "Permitir escrita de saidas_veiculos" ON public.saidas_veiculos
    FOR ALL USING (true) WITH CHECK (true);

-- Vínculos de Coletas
ALTER TABLE public.saidas_coletas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de saidas_coletas" ON public.saidas_coletas;
CREATE POLICY "Permitir leitura de saidas_coletas" ON public.saidas_coletas
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escrita de saidas_coletas" ON public.saidas_coletas;
CREATE POLICY "Permitir escrita de saidas_coletas" ON public.saidas_coletas
    FOR ALL USING (true) WITH CHECK (true);

-- Abastecimentos
ALTER TABLE public.abastecimentos_veiculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de abastecimentos_veiculos" ON public.abastecimentos_veiculos;
CREATE POLICY "Permitir leitura de abastecimentos_veiculos" ON public.abastecimentos_veiculos
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escrita de abastecimentos_veiculos" ON public.abastecimentos_veiculos;
CREATE POLICY "Permitir escrita de abastecimentos_veiculos" ON public.abastecimentos_veiculos
    FOR ALL USING (true) WITH CHECK (true);

-- FIM DO SCRIPT
