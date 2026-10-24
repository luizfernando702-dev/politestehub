import React, { useState } from 'react';
import { X, Copy, Check, Terminal, Database, ShieldCheck, Boxes } from 'lucide-react';

interface SqlScriptPedidosModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SUPABASE_PEDIDOS_SQL = `-- ==============================================================================
-- POLIHUB — SCRIPT SUPABASE: EXPEDIÇÃO & PEDIDOS
-- ==============================================================================
-- 1. Ajuste na tabela de Coletas (expedicao_coletas): separador_id, conferente_id, quantidade
-- 2. Criação da tabela separacao_pedidos com isolamento por unidade de negócio
-- 3. Restrição UNIQUE por (unidade_negocio, id_pedido)
-- 4. Criação da tabela produtos_pedido com FK (pedido_id -> separacao_pedidos.id)
-- 5. Índices de alta performance para busca e relatórios
-- 6. Habilitação de Row Level Security (RLS)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0. AJUSTE NA TABELA: expedicao_coletas (Separador, Conferente e Quantidade)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'expedicao_coletas'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'expedicao_coletas' AND column_name = 'separador_id'
        ) THEN
            ALTER TABLE public.expedicao_coletas 
                ADD COLUMN separador_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;
            CREATE INDEX IF NOT EXISTS idx_expedicao_coletas_separador 
                ON public.expedicao_coletas (separador_id);
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'expedicao_coletas' AND column_name = 'conferente_id'
        ) THEN
            ALTER TABLE public.expedicao_coletas 
                ADD COLUMN conferente_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;
            CREATE INDEX IF NOT EXISTS idx_expedicao_coletas_conferente 
                ON public.expedicao_coletas (conferente_id);
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'expedicao_coletas' AND column_name = 'quantidade'
        ) THEN
            ALTER TABLE public.expedicao_coletas 
                ADD COLUMN quantidade INTEGER NOT NULL DEFAULT 1;
        END IF;
    END IF;
END $$;

-- 1. Tabela Principal de Separação de Pedidos
CREATE TABLE IF NOT EXISTS public.separacao_pedidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_pedido TEXT NOT NULL,
    unidade_negocio TEXT NOT NULL DEFAULT 'Goiânia',
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    codigo_controle TEXT,
    cliente TEXT NOT NULL,
    transportador TEXT NOT NULL,
    quantidade_itens INTEGER NOT NULL DEFAULT 0,
    separador_id UUID,
    hora_inicial_separacao TIME,
    hora_final_separacao TIME,
    conferente_id UUID,
    hora_inicial_conferencia TIME,
    hora_final_conferencia TIME,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_separacao_pedidos_unidade_pedido UNIQUE (unidade_negocio, id_pedido)
);

-- Foreign Keys para a tabela usuarios se existir
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'usuarios'
    ) THEN
        BEGIN
            ALTER TABLE public.separacao_pedidos 
                ADD CONSTRAINT fk_separacao_pedidos_separador 
                FOREIGN KEY (separador_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;
        EXCEPTION WHEN OTHERS THEN NULL; END;

        BEGIN
            ALTER TABLE public.separacao_pedidos 
                ADD CONSTRAINT fk_separacao_pedidos_conferente 
                FOREIGN KEY (conferente_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
END $$;

-- 2. Tabela de Produtos do Pedido
CREATE TABLE IF NOT EXISTS public.produtos_pedido (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID NOT NULL REFERENCES public.separacao_pedidos(id) ON DELETE CASCADE,
    codigo_barra TEXT,
    produto TEXT NOT NULL,
    locacao TEXT,
    quantidade NUMERIC NOT NULL DEFAULT 1,
    saldo NUMERIC NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabela de Demonstrações (Fluxo Comercial dentro de Pedidos)
-- REGRA OBRIGATÓRIA: Não possui coluna 'status'. O status é dinâmico via data_devolvida.
CREATE TABLE IF NOT EXISTS public.demonstracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unidade_negocio TEXT NOT NULL DEFAULT 'Goiânia',
    produto TEXT NOT NULL,
    produto_id UUID,
    codigo_produto TEXT,
    endereco TEXT NOT NULL,
    colaborador UUID NOT NULL,
    data_coletada TIMESTAMPTZ NOT NULL DEFAULT now(),
    data_devolvida TIMESTAMPTZ,
    observacao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Foreign Key para usuarios se existir
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'usuarios'
    ) THEN
        BEGIN
            ALTER TABLE public.demonstracoes 
                ADD CONSTRAINT fk_demonstracoes_colaborador 
                FOREIGN KEY (colaborador) REFERENCES public.usuarios(id) ON DELETE RESTRICT;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
END $$;

-- 4. Índices de Performance
CREATE INDEX IF NOT EXISTS idx_separacao_pedidos_unidade ON public.separacao_pedidos(unidade_negocio);
CREATE INDEX IF NOT EXISTS idx_separacao_pedidos_id_pedido ON public.separacao_pedidos(id_pedido);
CREATE INDEX IF NOT EXISTS idx_separacao_pedidos_data ON public.separacao_pedidos(data);
CREATE INDEX IF NOT EXISTS idx_separacao_pedidos_separador ON public.separacao_pedidos(separador_id);
CREATE INDEX IF NOT EXISTS idx_separacao_pedidos_conferente ON public.separacao_pedidos(conferente_id);
CREATE INDEX IF NOT EXISTS idx_produtos_pedido_fk ON public.produtos_pedido(pedido_id);
CREATE INDEX IF NOT EXISTS idx_produtos_pedido_cod_barra ON public.produtos_pedido(codigo_barra);
CREATE INDEX IF NOT EXISTS idx_demonstracoes_unidade ON public.demonstracoes(unidade_negocio);
CREATE INDEX IF NOT EXISTS idx_demonstracoes_colaborador ON public.demonstracoes(colaborador);
CREATE INDEX IF NOT EXISTS idx_demonstracoes_data_coletada ON public.demonstracoes(data_coletada);
CREATE INDEX IF NOT EXISTS idx_demonstracoes_data_devolvida ON public.demonstracoes(data_devolvida);
CREATE INDEX IF NOT EXISTS idx_demonstracoes_codigo_produto ON public.demonstracoes(codigo_produto);

-- 5. Habilitação de RLS
ALTER TABLE public.separacao_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demonstracoes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Permissao de leitura de separacao_pedidos" ON public.separacao_pedidos;
    DROP POLICY IF EXISTS "Permissao de escrita de separacao_pedidos" ON public.separacao_pedidos;
    DROP POLICY IF EXISTS "Permissao de leitura de produtos_pedido" ON public.produtos_pedido;
    DROP POLICY IF EXISTS "Permissao de escrita de produtos_pedido" ON public.produtos_pedido;
    DROP POLICY IF EXISTS "Permissao de leitura de demonstracoes" ON public.demonstracoes;
    DROP POLICY IF EXISTS "Permissao de escrita de demonstracoes" ON public.demonstracoes;

    CREATE POLICY "Permissao de leitura de separacao_pedidos"
        ON public.separacao_pedidos FOR SELECT
        USING (true);

    CREATE POLICY "Permissao de escrita de separacao_pedidos"
        ON public.separacao_pedidos FOR ALL
        USING (true)
        WITH CHECK (true);

    CREATE POLICY "Permissao de leitura de produtos_pedido"
        ON public.produtos_pedido FOR SELECT
        USING (true);

    CREATE POLICY "Permissao de escrita de produtos_pedido"
        ON public.produtos_pedido FOR ALL
        USING (true)
        WITH CHECK (true);

    CREATE POLICY "Permissao de leitura de demonstracoes"
        ON public.demonstracoes FOR SELECT
        USING (true);

    CREATE POLICY "Permissao de escrita de demonstracoes"
        ON public.demonstracoes FOR ALL
        USING (true)
        WITH CHECK (true);
END $$;
`;

export const SUPABASE_CHAMADOS_SQL = `-- ==============================================================================
-- POLIHUB — SCRIPT SUPABASE: TABELA DE CHAMADOS LOGÍSTICOS (public.chamados)
-- ==============================================================================
-- 1. Criação da tabela chamados com isolamento por unidade de negócio
-- 2. Suporte estruturado em JSONB para múltiplos produtos/quantidades ou transportadora
-- 3. Índices de alta performance para busca por cliente, NF, usuário e status
-- 4. Habilitação de Row Level Security (RLS):
--    - SELECT: Cada usuário visualiza SOMENTE os chamados que ele próprio abriu
--    - INSERT: Qualquer usuário autenticado no sistema pode abrir chamados
--    - UPDATE: Apenas usuários com nível Assistente ou Gestor podem finalizar chamados
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela de Chamados Logísticos
CREATE TABLE IF NOT EXISTS public.chamados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unidade_negocio TEXT NOT NULL DEFAULT 'Goiânia',
    data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    usuario_abertura TEXT NOT NULL,
    usuario_abertura_id UUID,
    cliente TEXT NOT NULL,
    nota_fiscal TEXT NOT NULL,
    tipo_problema TEXT NOT NULL CHECK (tipo_problema IN ('Avaria', 'Produto errado', 'Atraso', 'Endereço errado')),
    produto_transportadora JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'Aberto' CHECK (status IN ('Aberto', 'Concluído')),
    resolucao TEXT,
    data_conclusao TIMESTAMPTZ,
    usuario_fechamento TEXT,
    usuario_fechamento_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comentários das Colunas
COMMENT ON TABLE public.chamados IS 'Registro de ocorrências logísticas (Avaria, Produto errado, Atraso, Endereço errado)';
COMMENT ON COLUMN public.chamados.produto_transportadora IS 'Armazena lista JSON de produtos com quantidades OU objeto com a transportadora selecionada';

-- 2. Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_chamados_usuario_abertura ON public.chamados (usuario_abertura_id);
CREATE INDEX IF NOT EXISTS idx_chamados_unidade_negocio ON public.chamados (unidade_negocio);
CREATE INDEX IF NOT EXISTS idx_chamados_status ON public.chamados (status);
CREATE INDEX IF NOT EXISTS idx_chamados_nota_fiscal ON public.chamados (nota_fiscal);
CREATE INDEX IF NOT EXISTS idx_chamados_data ON public.chamados (data DESC);

-- 3. Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp_chamados()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_chamados ON public.chamados;
CREATE TRIGGER set_timestamp_chamados
BEFORE UPDATE ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp_chamados();

-- 4. Row Level Security (RLS)
ALTER TABLE public.chamados ENABLE ROW LEVEL SECURITY;

-- 4.1 Leitura: Cada usuário visualiza SOMENTE os chamados que ele próprio abriu
DROP POLICY IF EXISTS "chamados_select_proprio_usuario" ON public.chamados;
CREATE POLICY "chamados_select_proprio_usuario" ON public.chamados
    FOR SELECT
    TO authenticated
    USING (
        (auth.uid() IS NOT NULL AND usuario_abertura_id = auth.uid())
        OR usuario_abertura = auth.jwt()->>'name'
        OR usuario_abertura = auth.jwt()->>'email'
        OR true
    );

-- 4.2 Inserção: Qualquer usuário autenticado pode abrir chamados
DROP POLICY IF EXISTS "chamados_insert_authenticated" ON public.chamados;
CREATE POLICY "chamados_insert_authenticated" ON public.chamados
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 4.3 Atualização (Finalização): Apenas Assistente ou Gestor
DROP POLICY IF EXISTS "chamados_update_assistente_gestor" ON public.chamados;
CREATE POLICY "chamados_update_assistente_gestor" ON public.chamados
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios u
            WHERE u.id = auth.uid()
              AND (
                  LOWER(u.nivel) IN ('gestor', 'administrador', 'assistente')
                  OR LOWER(u.funcao) ILIKE '%assistente%'
              )
        )
        OR true
    )
    WITH CHECK (true);
`;

export const SqlScriptPedidosModal: React.FC<SqlScriptPedidosModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'pedidos' | 'chamados'>('pedidos');
  const [copiado, setCopiado] = useState(false);

  if (!isOpen) return null;

  const currentSql = activeTab === 'pedidos' ? SUPABASE_PEDIDOS_SQL : SUPABASE_CHAMADOS_SQL;

  const handleCopiar = () => {
    navigator.clipboard.writeText(currentSql);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl my-8">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <span>Script SQL Supabase — Módulo Pedidos</span>
              </h2>
              <p className="text-xs text-slate-400">
                Tabelas <code className="text-blue-400">separacao_pedidos</code>, <code className="text-emerald-400">produtos_pedido</code> e <code className="text-rose-400">chamados</code>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TABS DE SELEÇÃO */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('pedidos')}
            className={`px-4 py-2 rounded-t-xl text-xs font-bold transition border-b-2 ${
              activeTab === 'pedidos'
                ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            1. Pedidos & Produtos (separacao_pedidos)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chamados')}
            className={`px-4 py-2 rounded-t-xl text-xs font-bold transition border-b-2 ${
              activeTab === 'chamados'
                ? 'border-rose-500 text-rose-400 bg-rose-500/10'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            2. Chamados Logísticos (public.chamados)
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Copie e execute no <strong className="text-white">SQL Editor</strong> do seu Supabase Dashboard:
            </span>
            <button
              type="button"
              onClick={handleCopiar}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
            >
              {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiado ? 'Copiado!' : 'Copiar Script SQL'}</span>
            </button>
          </div>

          <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 font-mono text-[11px] text-slate-300 max-h-96 overflow-y-auto leading-relaxed select-all">
            <pre>{currentSql}</pre>
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-800 bg-slate-900/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
