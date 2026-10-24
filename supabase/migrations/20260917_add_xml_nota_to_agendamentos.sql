-- ==============================================================================
-- POLIFILTRO — SISTEMA DE GESTÃO LOGÍSTICA INTELIGENTE
-- MIGRATION: Adiciona a coluna xml_nota na tabela public.agendamentos
-- ==============================================================================

-- 1. ADICIONAR A COLUNA xml_nota NA TABELA agendamentos
-- O tipo TEXT suporta XMLs de notas fiscais com centenas de itens sem limitação de caracteres.
ALTER TABLE public.agendamentos 
    ADD COLUMN IF NOT EXISTS xml_nota TEXT NULL;

-- 2. ADICIONAR COMENTÁRIO DESCRITIVO NA COLUNA
COMMENT ON COLUMN public.agendamentos.xml_nota IS 'Conteúdo integral do arquivo XML da Nota Fiscal Eletrônica (NF-e/NFC-e) associado ao agendamento de carga.';

-- 3. (OPCIONAL/RECOMENDADO) GARANTIR TAMBÉM A COLUNA horario SE AINDA NÃO EXISTIR
ALTER TABLE public.agendamentos 
    ADD COLUMN IF NOT EXISTS horario TEXT NULL;

-- 4. RECARREGAR O CACHE DO ESQUEMA DO SUPABASE (POSTGREST)
NOTIFY pgrst, 'reload schema';
