import React, { useState } from 'react';
import { X, Copy, Check, Database, Terminal, Shield, Key } from 'lucide-react';
import { isSupabaseConfigured } from '../../lib/supabase';

const SUPABASE_SCHEMA_SQL = `-- POLIFILTRO - SISTEMA DE GESTÃO LOGÍSTICA (Logística Inteligente)
-- Script de Criação das Tabelas e Políticas de Segurança (RLS)

-- 1. TABELA DE USUÁRIOS
CREATE TABLE IF NOT EXISTS public.usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  codigo TEXT NOT NULL UNIQUE,
  foto TEXT,
  departamento TEXT DEFAULT 'Logística Operacional',
  funcao TEXT DEFAULT 'Operador Logístico',
  nivel TEXT DEFAULT 'Operador' CHECK (nivel IS NULL OR LOWER(nivel) IN ('operador', 'conferente', 'supervisor', 'administrador', 'gestor')),
  status TEXT NOT NULL DEFAULT 'aprovado' CHECK (status IS NULL OR LOWER(status) IN ('pendente', 'aprovado', 'desativado', 'ativo', 'inativo')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar RLS em usuarios
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de usuários autenticados" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir leitura de usuarios" ON public.usuarios;
CREATE POLICY "Permitir leitura de usuarios"
  ON public.usuarios FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Permitir inserção e atualização do próprio usuário" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir escrita de usuarios" ON public.usuarios;
CREATE POLICY "Permitir escrita de usuarios"
  ON public.usuarios FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. TABELA DE AGENDAMENTOS
CREATE TABLE IF NOT EXISTS public.agendamentos (
  id TEXT PRIMARY KEY,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  fornecedor TEXT NOT NULL,
  nota_fiscal TEXT NOT NULL,
  notas_adicionais TEXT,
  volumes INTEGER NOT NULL DEFAULT 1,
  tipo_volumes TEXT NOT NULL DEFAULT 'Paletes',
  transportadora TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Confirmado', 'Em trânsito', 'Recebido', 'Cancelado')),
  data_prevista DATE NOT NULL,
  data_entrega DATE,
  usuario_insercao TEXT NOT NULL,
  data_insercao TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  endereco_alocacao TEXT
);

-- Migração para agendamentos existentes (opcional):
-- ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS endereco_alocacao TEXT;

-- Índices otimizados para agendamentos
CREATE INDEX IF NOT EXISTS idx_agendamentos_data_prevista ON public.agendamentos(data_prevista DESC);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON public.agendamentos(status);
CREATE INDEX IF NOT EXISTS idx_agendamentos_fornecedor ON public.agendamentos(fornecedor);
CREATE INDEX IF NOT EXISTS idx_agendamentos_nf ON public.agendamentos(nota_fiscal);

ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura de agendamentos para autenticados"
  ON public.agendamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir inserção de agendamentos para autenticados"
  ON public.agendamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir atualização de agendamentos para autenticados"
  ON public.agendamentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 3. TABELA DE ENDEREÇOS (Físicos do armazém)
CREATE TABLE IF NOT EXISTS public.enderecos (
  id BIGSERIAL PRIMARY KEY,
  endereco TEXT NOT NULL UNIQUE,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_enderecos_codigo ON public.enderecos(endereco);

ALTER TABLE public.enderecos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura de enderecos para autenticados"
  ON public.enderecos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir gerenciamento de enderecos para autenticados"
  ON public.enderecos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. TABELA DE INVENTÁRIO (Conferência Física às Cegas & Auditoria de Divergências)
CREATE TABLE IF NOT EXISTS public.inventario (
  id BIGSERIAL PRIMARY KEY,
  produto TEXT NOT NULL,
  endereco TEXT NOT NULL,
  qtd_contada NUMERIC,
  qtd_disponivel NUMERIC NOT NULL DEFAULT 0,
  qtd_atual NUMERIC NOT NULL DEFAULT 0,
  peso_total NUMERIC DEFAULT 0,
  qtd_reservada NUMERIC DEFAULT 0,
  usuario_id TEXT,
  data_atualizada TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
  data_contagem TIMESTAMPTZ,
  usuario_correcao UUID REFERENCES public.usuarios(id),
  corrigido BOOLEAN NOT NULL DEFAULT false,
  data_correcao TIMESTAMPTZ
);

-- Migração para tabelas existentes:
-- ALTER TABLE public.inventario
-- ADD COLUMN usuario_correcao uuid,
-- ADD COLUMN corrigido boolean NOT NULL DEFAULT false,
-- ADD COLUMN data_correcao timestamptz;
-- ALTER TABLE public.inventario
-- ADD CONSTRAINT inventario_usuario_correcao_fkey
-- FOREIGN KEY (usuario_correcao)
-- REFERENCES public.usuarios(id);

-- Índices otimizados para busca rápida por endereço, produto e divergências
CREATE INDEX IF NOT EXISTS idx_inventario_endereco ON public.inventario(endereco);
CREATE INDEX IF NOT EXISTS idx_inventario_produto ON public.inventario(produto);
CREATE INDEX IF NOT EXISTS idx_inventario_corrigido ON public.inventario(corrigido);
CREATE INDEX IF NOT EXISTS idx_inventario_data_contagem ON public.inventario(data_contagem DESC);

ALTER TABLE public.inventario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura de inventario para autenticados"
  ON public.inventario FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir atualização de contagem para autenticados"
  ON public.inventario FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir inserção de inventario para autenticados"
  ON public.inventario FOR INSERT TO authenticated WITH CHECK (true);

-- 5. TABELA DE TAREFAS (PoliHub — Gestão de Tarefas com RLS e Prazo Dinâmico)
CREATE TABLE IF NOT EXISTS public.tarefas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  responsavel_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  data_limite DATE NOT NULL,
  data_conclusao TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Concluído', 'Não concluído')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  usuario_insercao TEXT NOT NULL,
  data_insercao TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  usuario_atualizacao TEXT,
  data_atualizacao TIMESTAMPTZ
);

-- Índices de alta performance
CREATE INDEX IF NOT EXISTS idx_tarefas_responsavel ON public.tarefas(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_status ON public.tarefas(status);
CREATE INDEX IF NOT EXISTS idx_tarefas_data_limite ON public.tarefas(data_limite);
CREATE INDEX IF NOT EXISTS idx_tarefas_ativo ON public.tarefas(ativo);

-- Segurança e Row Level Security (RLS)
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

-- Usuários comuns visualizam apenas as tarefas atribuídas a si mesmos
-- Gestores podem visualizar todas as tarefas
CREATE POLICY "RLS: Leitura de tarefas por responsável ou gestor"
  ON public.tarefas FOR SELECT TO authenticated
  USING (
    responsavel_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE usuarios.id = auth.uid()
        AND LOWER(usuarios.nivel) = 'gestor'
    )
  );

-- Apenas Gestores podem inserir novas tarefas
CREATE POLICY "RLS: Inserção de tarefas por gestores"
  ON public.tarefas FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE usuarios.id = auth.uid()
        AND LOWER(usuarios.nivel) = 'gestor'
    )
  );

-- Apenas Gestores podem atualizar tarefas
CREATE POLICY "RLS: Atualização de tarefas por gestores"
  ON public.tarefas FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE usuarios.id = auth.uid()
        AND LOWER(usuarios.nivel) = 'gestor'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE usuarios.id = auth.uid()
        AND LOWER(usuarios.nivel) = 'gestor'
    )
  );

-- Apenas Gestores podem excluir tarefas
CREATE POLICY "RLS: Exclusão de tarefas por gestores"
  ON public.tarefas FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE usuarios.id = auth.uid()
        AND LOWER(usuarios.nivel) = 'gestor'
    )
  );
`;

export const SupabaseSetupGuideModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [copied, setCopied] = useState(false);

  const copySql = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-5 sm:p-7 text-slate-100 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Integração com Supabase</h3>
              <p className="text-xs text-slate-400">Conexão, Variáveis de Ambiente e Schema SQL</p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-guide"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status banner */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`w-3 h-3 rounded-full ${
                isSupabaseConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <div>
              <div className="text-sm font-semibold text-white">
                {isSupabaseConfigured
                  ? 'Supabase Conectado & Ativo'
                  : 'Modo Demonstração (Chaves Não Detectadas)'}
              </div>
              <p className="text-xs text-slate-400">
                {isSupabaseConfigured
                  ? 'As consultas estão sendo executadas diretamente no PostgreSQL do seu Supabase.'
                  : 'O aplicativo está funcionando com cache local reativo até que as chaves sejam adicionadas ao .env.'}
              </p>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="mt-5 space-y-4">
          <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider mb-2">
              <Key className="w-4 h-4" />
              <span>Configuração do Projeto (Pré-configurado por Padrão)</span>
            </div>
            <p className="text-xs text-slate-300 mb-2">
              O aplicativo já está configurado por padrão com o banco de dados oficial do PoliHub. Caso deseje apontar para um projeto Supabase personalizado (no Vercel ou local), defina em seu <code className="text-sky-300 font-mono">.env</code>:
            </p>
            <pre className="p-3 rounded-xl bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto border border-slate-800/80">
              VITE_SUPABASE_URL=https://rzsqllweuifaehpsphqq.supabase.co{'\n'}
              VITE_SUPABASE_ANON_KEY=sb_publishable_C1Rym8kvUUYcS92ad1dMQw_wQD-SUNz
            </pre>
            <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              Status: <strong>Ativo por padrão</strong> em todos os ambientes e deploys (Vercel, Cloud Run, Local).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider">
                <Terminal className="w-4 h-4" />
                <span>Passo 2: Executar Script SQL no Supabase</span>
              </div>
              <button
                type="button"
                id="btn-copy-supabase-sql"
                onClick={copySql}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-300 text-xs font-semibold transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado!' : 'Copiar SQL'}</span>
              </button>
            </div>
            <p className="text-xs text-slate-300 mb-2">
              Copie o script abaixo e execute na aba <strong>SQL Editor</strong> do painel do Supabase para criar as tabelas <code className="text-sky-300 font-mono">usuarios</code> e <code className="text-sky-300 font-mono">agendamentos</code>:
            </p>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-3">
              <pre className="text-[11px] font-mono text-slate-300 whitespace-pre">
                {SUPABASE_SCHEMA_SQL}
              </pre>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
              <Shield className="w-4 h-4" />
              <span>Passo 3: Desativar &quot;Confirm email&quot; (Evitar Rate Limit de E-mails)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-2">
              O Supabase no plano gratuito limita o envio de e-mails para cerca de 3 a 4 por hora. Para evitar o erro <code className="text-amber-300 font-mono text-[11px]">email rate limit exceeded</code> ao cadastrar novos operadores:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <li>No painel do Supabase, clique em <strong>Authentication</strong>.</li>
              <li>Acesse a aba <strong>Providers</strong> e clique em <strong>Email</strong>.</li>
              <li>Desmarque a caixa <strong>Confirm email</strong> (desativado).</li>
              <li>Clique no botão <strong>Save</strong>.</li>
            </ol>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            id="btn-guide-ok"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-sm text-white transition active:scale-95"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
