import React, { useState } from 'react';
import { X, Copy, Check, Terminal, Database, ShieldCheck } from 'lucide-react';

interface SqlScriptComprasModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SUPABASE_COMPRAS_SQL = `-- ==============================================================================
-- POLIHUB — SCRIPT SUPABASE: MÓDULO DE COMPRAS (SOLICITAÇÕES E APROVAÇÕES)
-- ==============================================================================
-- 1. Criação da Tabela public.compras
-- 2. Constraints de integridade (Quantidade 1 a 1000, Demanda, Urgência, Status)
-- 3. Chaves Estrangeiras para produtos e usuarios
-- 4. Índices para performance e filtros
-- 5. Row Level Security (RLS) com permissões para Comercial e Gestor
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA DE COMPRAS
CREATE TABLE IF NOT EXISTS public.compras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_insercao TIMESTAMPTZ NOT NULL DEFAULT now(),
    id_produto UUID NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
    quantidade INTEGER NOT NULL CHECK (quantidade >= 1 AND quantidade <= 1000),
    quantidade_aprovada INTEGER CHECK (quantidade_aprovada >= 1 AND quantidade_aprovada <= 1000),
    demanda TEXT NOT NULL CHECK (demanda IN ('Estoque', 'Sob Encomenda', 'Consumos')),
    urgencia TEXT NOT NULL CHECK (urgencia IN ('Média', 'Rápida', 'Urgente')),
    id_solicitante UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'Solicitado' CHECK (status IN ('Solicitado', 'Aprovado', 'Recusado', 'Comprado')),
    id_usuario_aprovacao UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    data_aprovacao TIMESTAMPTZ,
    motivo_recusa TEXT,
    id_usuario_compra UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    data_compra TIMESTAMPTZ,
    observacao TEXT,
    unidade_negocio TEXT NOT NULL DEFAULT 'Goiânia',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_compras_produto ON public.compras(id_produto);
CREATE INDEX IF NOT EXISTS idx_compras_solicitante ON public.compras(id_solicitante);
CREATE INDEX IF NOT EXISTS idx_compras_aprovador ON public.compras(id_usuario_aprovacao);
CREATE INDEX IF NOT EXISTS idx_compras_status ON public.compras(status);
CREATE INDEX IF NOT EXISTS idx_compras_urgencia ON public.compras(urgencia);
CREATE INDEX IF NOT EXISTS idx_compras_demanda ON public.compras(demanda);
CREATE INDEX IF NOT EXISTS idx_compras_unidade ON public.compras(unidade_negocio);
CREATE INDEX IF NOT EXISTS idx_compras_data_insercao ON public.compras(data_insercao DESC);

-- Índice composto para validação rápida de duplicidade
CREATE INDEX IF NOT EXISTS idx_compras_produto_status_ativo 
    ON public.compras(id_produto, status) 
    WHERE status IN ('Solicitado', 'Aprovado');

-- 3. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de compras para autenticados" ON public.compras;
CREATE POLICY "Permitir leitura de compras para autenticados"
    ON public.compras FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Permitir insercao de solicitacao de compra" ON public.compras;
CREATE POLICY "Permitir insercao de solicitacao de compra"
    ON public.compras FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualizacao de compras" ON public.compras;
CREATE POLICY "Permitir atualizacao de compras"
    ON public.compras FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir exclusao de compras" ON public.compras;
CREATE POLICY "Permitir exclusao de compras"
    ON public.compras FOR DELETE TO anon, authenticated USING (true);

-- ==============================================================================
-- 4. MIGRAÇÃO DE DADOS EXISTENTES (Caso a tabela compras já exista)
-- ==============================================================================
-- 1. Remove temporariamente a constraint de check antiga:
-- ALTER TABLE public.compras DROP CONSTRAINT IF EXISTS compras_demanda_check;
-- 2. Migra correspondências inequívocas de negócio:
-- UPDATE public.compras SET demanda = 'Sob Encomenda' WHERE demanda = 'Necessidade';
-- UPDATE public.compras SET demanda = 'Consumos' WHERE demanda = 'Compras';
-- 3. Adiciona a nova constraint validando apenas as novas categorias:
-- ALTER TABLE public.compras ADD CONSTRAINT compras_demanda_check 
--     CHECK (demanda IN ('Estoque', 'Sob Encomenda', 'Consumos'));
`;

export const SqlScriptComprasModal: React.FC<SqlScriptComprasModalProps> = ({ isOpen, onClose }) => {
  const [copiado, setCopiado] = useState(false);

  if (!isOpen) return null;

  const handleCopiar = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(SUPABASE_COMPRAS_SQL);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = SUPABASE_COMPRAS_SQL;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch (err) {
      console.warn('Erro ao copiar script:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6">
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Script SQL do Banco Supabase — Compras</h2>
              <p className="text-xs text-slate-400">
                Execute este script no <strong>SQL Editor</strong> do painel do Supabase para criar a tabela{' '}
                <code className="text-emerald-400 font-mono">public.compras</code>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>DDL Postgres / Supabase SQL</span>
            </div>
            <button
              type="button"
              onClick={handleCopiar}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
            >
              {copiado ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copiado com sucesso!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar SQL</span>
                </>
              )}
            </button>
          </div>

          <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto whitespace-pre leading-relaxed select-all">
            {SUPABASE_COMPRAS_SQL}
          </pre>
        </div>

        <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-900/60 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
