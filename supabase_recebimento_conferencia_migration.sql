-- ==============================================================================
-- POLIFILTRO / POLIHUB — MÓDULO RECEBIMENTO & CONFERÊNCIA CEGA & ALOCAÇÃO
-- Adição de colunas na tabela public.recebimentos_produtos
-- ==============================================================================

-- 1. ADIÇÃO DAS NOVAS COLUNAS
ALTER TABLE public.recebimentos_produtos
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Recebido',
  ADD COLUMN IF NOT EXISTS qtd_conferida NUMERIC(12,2) NULL,
  ADD COLUMN IF NOT EXISTS conferente_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS data_conferencia TIMESTAMP WITH TIME ZONE NULL,
  ADD COLUMN IF NOT EXISTS novo_endereco TEXT NULL,
  ADD COLUMN IF NOT EXISTS repositor_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS data_alocacao TIMESTAMP WITH TIME ZONE NULL;

-- 2. CONSTRAINT DE INTEGRIDADE PARA OS STATUS DO FLUXO
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_recebimentos_produtos_status'
  ) THEN
    ALTER TABLE public.recebimentos_produtos
      ADD CONSTRAINT chk_recebimentos_produtos_status
      CHECK (status IN ('Recebido', 'Conferido', 'Crítica', 'Alocado'));
  END IF;
END $$;

-- 3. ÍNDICES DE ALTA PERFORMANCE
-- Otimiza consultas filtradas pelo status do fluxo ('Conferido', 'Recebido', etc.)
CREATE INDEX IF NOT EXISTS idx_recebimentos_produtos_status 
  ON public.recebimentos_produtos USING btree (status);

-- Otimiza busca composta por nota_fiscal e status
CREATE INDEX IF NOT EXISTS idx_recebimentos_produtos_nf_status 
  ON public.recebimentos_produtos USING btree (nota_fiscal, status);

-- 4. COMENTÁRIOS EXPLICATIVOS DAS COLUNAS
COMMENT ON COLUMN public.recebimentos_produtos.status IS 'Status da carga no fluxo: Recebido (pendente de conferência), Conferido (aprovado na contagem cega), Crítica (divergência física vs fiscal), Alocado (guardado no endereço)';
COMMENT ON COLUMN public.recebimentos_produtos.qtd_conferida IS 'Quantidade física real apurada na conferência cega pelo operador';
COMMENT ON COLUMN public.recebimentos_produtos.conferente_id IS 'Identificador do operador/usuário responsável pela conferência cega';
COMMENT ON COLUMN public.recebimentos_produtos.data_conferencia IS 'Data e hora da realização da conferência cega';
COMMENT ON COLUMN public.recebimentos_produtos.novo_endereco IS 'Novo endereço físico de armazenagem definido na alocação (preserva o endereco original para rastreabilidade)';
COMMENT ON COLUMN public.recebimentos_produtos.repositor_id IS 'Identificador do operador responsável pela alocação física na posição';
COMMENT ON COLUMN public.recebimentos_produtos.data_alocacao IS 'Data e hora em que a alocação foi finalizada';
