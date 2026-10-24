-- ==============================================================================
-- POLIHUB / POLIFILTRO — SCRIPT DE MIGRAÇÃO: MÓDULO WHATSAPP BUSINESS PLATFORM
-- ==============================================================================
-- Este script cria toda a estrutura de banco de dados para o módulo de atendimento
-- inteligente pelo WhatsApp, integrado à API oficial da Meta (WhatsApp Business Platform).
-- 
-- Tabelas criadas:
-- 1. whatsapp_canais: Números conectados e configurações da Meta por unidade
-- 2. whatsapp_contatos: Cadastro inteligente de contatos e regras de atendimento
-- 3. whatsapp_filas: Filas operacionais de triagem
-- 4. whatsapp_mensagens_automaticas: Respostas automáticas configuráveis no banco
-- 5. whatsapp_usuarios_habilitados: Habilitação de atendentes, filas e disponibilidade
-- 6. whatsapp_conversas: Caixa de entrada e estados de atendimento
-- 7. whatsapp_mensagens: Histórico de mensagens com autor identificado
-- 8. whatsapp_historico_acoes: Auditoria de transferências e encerramentos
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CANAIS E NÚMEROS DE WHATSAPP BUSINESS
CREATE TABLE IF NOT EXISTS public.whatsapp_canais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  numero_telefone TEXT NOT NULL,
  unidade_negocio TEXT NOT NULL,
  meta_phone_number_id TEXT,
  meta_waba_id TEXT,
  meta_access_token TEXT,
  meta_webhook_verify_token TEXT,
  meta_app_id TEXT,
  status_conexao TEXT DEFAULT 'conectado',
  horario_inicio TEXT DEFAULT '08:00',
  horario_fim TEXT DEFAULT '18:00',
  dias_funcionamento JSONB DEFAULT '["seg","ter","qua","qui","sex"]'::jsonb,
  mensagem_fora_horario TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CONTATOS INTELIGENTES
CREATE TABLE IF NOT EXISTS public.whatsapp_contatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone TEXT NOT NULL,
  nome TEXT NOT NULL,
  tipo_contato TEXT DEFAULT 'desconhecido', -- 'desconhecido', 'cliente', 'colaborador', 'gestor', 'fornecedor', 'outro'
  departamento_relacionado TEXT DEFAULT 'Logística',
  unidade_negocio TEXT,
  colaborador_vinculado_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  colaborador_vinculado_nome TEXT,
  regra_atendimento TEXT DEFAULT 'padrao', -- 'padrao', 'direto_colaborador', 'fila_especifica', 'prioritario'
  mensagem_personalizada TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contatos_tel ON public.whatsapp_contatos(telefone);

-- 3. FILAS DE ATENDIMENTO
CREATE TABLE IF NOT EXISTS public.whatsapp_filas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  unidade_negocio TEXT,
  departamento TEXT DEFAULT 'Logística',
  ordem INT DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MENSAGENS AUTOMÁTICAS CONFIGURÁVEIS NO BANCO
CREATE TABLE IF NOT EXISTS public.whatsapp_mensagens_automaticas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo_evento TEXT NOT NULL, -- 'boas_vindas', 'fora_horario', 'sem_atendentes', 'gestor_identificado', 'resposta_invalida', 'fallback'
  perfil_contato TEXT DEFAULT 'todos', -- 'todos', 'desconhecido', 'cliente', 'colaborador', 'gestor'
  fila_id UUID REFERENCES public.whatsapp_filas(id) ON DELETE SET NULL,
  unidade_negocio TEXT,
  texto TEXT NOT NULL,
  opcoes JSONB DEFAULT '[]'::jsonb,
  mensagem_invalida TEXT,
  ordem INT DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. USUÁRIOS HABILITADOS PARA ATENDIMENTO WHATSAPP
CREATE TABLE IF NOT EXISTS public.whatsapp_usuarios_habilitados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  usuario_nome TEXT,
  usuario_codigo TEXT,
  usuario_departamento TEXT DEFAULT 'Logística',
  usuario_nivel TEXT DEFAULT 'Operador',
  habilitado BOOLEAN DEFAULT true,
  disponivel BOOLEAN DEFAULT true,
  filas_permitidas JSONB DEFAULT '["Recebimento","Expedição","Geral"]'::jsonb,
  pode_visualizar_grupos BOOLEAN DEFAULT true,
  pode_responder_grupos BOOLEAN DEFAULT false,
  is_gestor_whatsapp BOOLEAN DEFAULT false,
  unidade_negocio TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_whatsapp_usuario UNIQUE (usuario_id)
);

-- 6. CONVERSAS (CAIXA DE ENTRADA)
CREATE TABLE IF NOT EXISTS public.whatsapp_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canal_id UUID REFERENCES public.whatsapp_canais(id) ON DELETE SET NULL,
  canal_nome TEXT,
  contato_id UUID REFERENCES public.whatsapp_contatos(id) ON DELETE SET NULL,
  numero_remetente TEXT NOT NULL,
  nome_remetente TEXT NOT NULL,
  unidade_negocio TEXT NOT NULL,
  fila_nome TEXT DEFAULT 'Geral',
  usuario_atribuido_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  usuario_atribuido_nome TEXT,
  status TEXT DEFAULT 'aguardando', -- 'aguardando', 'em_andamento', 'encerrado'
  tipo_conversa TEXT DEFAULT 'individual', -- 'individual', 'grupo'
  grupo_id_externo TEXT,
  grupo_titulo TEXT,
  ultima_mensagem_texto TEXT,
  ultima_mensagem_data TIMESTAMPTZ DEFAULT NOW(),
  data_inicio_atendimento TIMESTAMPTZ,
  data_encerramento TIMESTAMPTZ,
  encerrado_por_usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  encerrado_por_nome TEXT,
  contato_tipo TEXT DEFAULT 'desconhecido',
  nao_lidas INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversas_status ON public.whatsapp_conversas(status, unidade_negocio);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversas_remetente ON public.whatsapp_conversas(numero_remetente);

-- 7. HISTÓRICO DE MENSAGENS (COM IDENTIFICAÇÃO DO COLABORADOR EM NEGRITO)
CREATE TABLE IF NOT EXISTS public.whatsapp_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES public.whatsapp_conversas(id) ON DELETE CASCADE,
  tipo_remetente TEXT NOT NULL, -- 'contato', 'colaborador', 'sistema'
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  autor_nome TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  meta_message_id TEXT,
  status_envio TEXT DEFAULT 'enviado', -- 'pendente', 'enviado', 'entregue', 'lido', 'falha'
  erro_mensagem TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_conv ON public.whatsapp_mensagens(conversa_id, created_at);

-- 8. AUDITORIA E HISTÓRICO DE AÇÕES OPERACIONAIS/ADMINISTRATIVAS
CREATE TABLE IF NOT EXISTS public.whatsapp_historico_acoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID REFERENCES public.whatsapp_conversas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  usuario_nome TEXT,
  tipo_acao TEXT NOT NULL, -- 'inicio_atendimento', 'atribuicao', 'transferencia', 'encerramento', 'reabertura', 'alteracao_config'
  detalhes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- POLÍTICAS DE SEGURANÇA (ROW LEVEL SECURITY - RLS)
-- ==============================================================================

ALTER TABLE public.whatsapp_canais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_filas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_mensagens_automaticas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_usuarios_habilitados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_historico_acoes ENABLE ROW LEVEL SECURITY;

-- Permissões de Leitura e Escrita para Logística e Gestores
DROP POLICY IF EXISTS "whatsapp_canais_leitura" ON public.whatsapp_canais;
CREATE POLICY "whatsapp_canais_leitura" ON public.whatsapp_canais FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "whatsapp_contatos_all" ON public.whatsapp_contatos;
CREATE POLICY "whatsapp_contatos_all" ON public.whatsapp_contatos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "whatsapp_filas_all" ON public.whatsapp_filas;
CREATE POLICY "whatsapp_filas_all" ON public.whatsapp_filas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "whatsapp_msgs_auto_all" ON public.whatsapp_mensagens_automaticas;
CREATE POLICY "whatsapp_msgs_auto_all" ON public.whatsapp_mensagens_automaticas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "whatsapp_usuarios_hab_all" ON public.whatsapp_usuarios_habilitados;
CREATE POLICY "whatsapp_usuarios_hab_all" ON public.whatsapp_usuarios_habilitados FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "whatsapp_conversas_all" ON public.whatsapp_conversas;
CREATE POLICY "whatsapp_conversas_all" ON public.whatsapp_conversas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "whatsapp_mensagens_all" ON public.whatsapp_mensagens;
CREATE POLICY "whatsapp_mensagens_all" ON public.whatsapp_mensagens FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "whatsapp_historico_all" ON public.whatsapp_historico_acoes;
CREATE POLICY "whatsapp_historico_all" ON public.whatsapp_historico_acoes FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- CARGA INICIAL (SEED DATA): CANAIS, FILAS E MENSAGENS PADRÃO
-- ==============================================================================

INSERT INTO public.whatsapp_filas (nome, descricao, departamento, ordem, ativo)
VALUES
  ('Recebimento', 'Descarga, conferência de NFs e recebimento físico', 'Logística', 1, true),
  ('Expedição', 'Separação, embalagem e expedição de pedidos', 'Logística', 2, true),
  ('Agendamentos', 'Agendamento de entregas de fornecedores e transportadoras', 'Logística', 3, true),
  ('Retira', 'Balcão de retirada presencial de mercadorias no CD', 'Logística', 4, true),
  ('Entregas Nosso Carro', 'Rastreamento e coordenação de frotas e motoristas próprios', 'Logística', 5, true),
  ('Comercial', 'Suporte a pedidos, vendas e cotações', 'Comercial', 6, true),
  ('Geral', 'Fila padrão de triagem inicial', 'Logística', 7, true)
ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.whatsapp_mensagens_automaticas (nome, tipo_evento, perfil_contato, texto, opcoes, mensagem_invalida, ordem, ativo)
VALUES
  (
    'Boas-vindas para Número Desconhecido',
    'boas_vindas',
    'desconhecido',
    'Olá! Seja bem-vindo à Polifiltro WMS / Dental Globo. Para direcionar seu atendimento com rapidez, escolha uma das opções abaixo digitando o número correspondente:',
    '[{"id":"1","label":"Recebimento","valor":"1","destino_fila":"Recebimento"},{"id":"2","label":"Expedição","valor":"2","destino_fila":"Expedição"},{"id":"3","label":"Agendamentos","valor":"3","destino_fila":"Agendamentos"},{"id":"4","label":"Retira","valor":"4","destino_fila":"Retira"},{"id":"5","label":"Entregas Nosso Carro","valor":"5","destino_fila":"Entregas Nosso Carro"},{"id":"6","label":"Comercial","valor":"6","destino_fila":"Comercial"}]'::jsonb,
    'Opção inválida. Por favor, envie apenas o número de 1 a 6 de acordo com a opção desejada.',
    1,
    true
  ),
  (
    'Boas-vindas para Gestor Identificado',
    'gestor_identificado',
    'gestor',
    'Olá, gestor(a)! Reconhecemos seu contato corporativo no PoliHub. Com quem você deseja falar no momento? Escolha uma fila ou colaborador autorizado:',
    '[{"id":"1","label":"Fila Recebimento","valor":"1","destino_fila":"Recebimento"},{"id":"2","label":"Fila Expedição","valor":"2","destino_fila":"Expedição"},{"id":"3","label":"Fila Agendamentos","valor":"3","destino_fila":"Agendamentos"},{"id":"4","label":"Atendente Geral","valor":"4","destino_fila":"Geral"}]'::jsonb,
    'Opção inválida. Digite o número correspondente.',
    2,
    true
  ),
  (
    'Fora do Horário Comercial',
    'fora_horario',
    'todos',
    'Olá! No momento nossa equipe está fora do horário de atendimento. Sua mensagem foi registrada e será direcionada à equipe responsável no início do expediente.',
    '[]'::jsonb,
    NULL,
    3,
    true
  ),
  (
    'Nenhum Colaborador Disponível',
    'sem_atendentes',
    'todos',
    'Recebemos sua mensagem. No momento, todos os atendentes estão ocupados. Sua conversa permanecerá na fila para atendimento.',
    '[]'::jsonb,
    NULL,
    4,
    true
  )
ON CONFLICT DO NOTHING;
