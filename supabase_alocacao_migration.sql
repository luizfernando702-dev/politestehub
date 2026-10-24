-- ==============================================================================
-- POLIFILTRO — SISTEMA DE GESTÃO LOGÍSTICA INTELIGENTE
-- MÓDULO ALOCAÇÃO: public.recebimentos_produtos & public.alteracoes_endereco
-- ==============================================================================

-- 1. TABELA: public.recebimentos_produtos
-- Armazena os produtos que chegaram na nota fiscal do agendamento
CREATE TABLE IF NOT EXISTS public.recebimentos_produtos (
  id BIGSERIAL NOT NULL,
  agendamento_id TEXT NULL,
  data_recebimento DATE NOT NULL DEFAULT CURRENT_DATE,
  nota_fiscal TEXT NOT NULL,
  produto TEXT NOT NULL,
  endereco TEXT NULL,
  quantidade NUMERIC(12,2) NOT NULL DEFAULT 0,
  saldo_final NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT recebimentos_produtos_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- Índices de alta performance para baixo consumo e consultas rápidas
CREATE INDEX IF NOT EXISTS idx_recebimentos_produtos_nf 
  ON public.recebimentos_produtos USING btree (nota_fiscal) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_recebimentos_produtos_data 
  ON public.recebimentos_produtos USING btree (data_recebimento) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_recebimentos_produtos_agendamento 
  ON public.recebimentos_produtos USING btree (agendamento_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_recebimentos_produtos_endereco 
  ON public.recebimentos_produtos USING btree (endereco) TABLESPACE pg_default;


-- 2. TABELA: public.alteracoes_endereco
-- Rastreabilidade rigorosa: histórico imutável de alterações e validações de endereço
CREATE TABLE IF NOT EXISTS public.alteracoes_endereco (
  id BIGSERIAL NOT NULL,
  data TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  produto TEXT NOT NULL,
  endereco_antigo TEXT NOT NULL,
  endereco_novo TEXT NOT NULL,
  tipo_alteracao TEXT NOT NULL DEFAULT 'Via nota de entrada',
  usuario_alteracao TEXT NOT NULL,
  alterado_sistema BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT alteracoes_endereco_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- Índices de consulta para a tela "Gerir Alterações"
CREATE INDEX IF NOT EXISTS idx_alteracoes_endereco_pendentes 
  ON public.alteracoes_endereco USING btree (alterado_sistema) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_alteracoes_endereco_data 
  ON public.alteracoes_endereco USING btree (data DESC) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_alteracoes_endereco_produto 
  ON public.alteracoes_endereco USING btree (produto) TABLESPACE pg_default;


-- 3. COMENTÁRIOS EXPLICATIVOS
COMMENT ON TABLE public.recebimentos_produtos IS 'Produtos recebidos por agendamento/nota fiscal para alocação no armazém Polifiltro';
COMMENT ON COLUMN public.recebimentos_produtos.endereco IS 'Endereço físico de armazenagem vinculado à tabela public.enderecos';
COMMENT ON COLUMN public.recebimentos_produtos.saldo_final IS 'Saldo pendente de armazenagem física';

COMMENT ON TABLE public.alteracoes_endereco IS 'Histórico imutável de solicitações e confirmações de troca de endereço físico';
COMMENT ON COLUMN public.alteracoes_endereco.alterado_sistema IS 'Indica se o gestor já confirmou a efetivação no sistema corporativo (true = concluído, false = pendente)';
