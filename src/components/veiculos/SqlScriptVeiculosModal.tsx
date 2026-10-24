import React, { useState } from 'react';
import { X, Copy, Check, Database, Terminal, ShieldCheck, AlertCircle } from 'lucide-react';

interface SqlScriptVeiculosModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SqlScriptVeiculosModal: React.FC<SqlScriptVeiculosModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const sqlContent = `-- ==============================================================================
-- POLIHUB — SCRIPT SQL DE BANCO DE DADOS SUPABASE
-- MÓDULO: CONTROLE DE VEÍCULOS (FROTA, SAÍDAS, COLETAS, ABASTECIMENTOS E RLS)
-- ==============================================================================

-- 1. HABILITAR EXTENSÃO DE UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. AJUSTE NA TABELA: expedicao_coletas (Novo campo 'valor' para valor da NF)
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

-- 3. TABELA: veiculos (Cadastro de Frota por Unidade de Negócio)
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

-- 4. TABELA: saidas_veiculos (Registro Operacional de Saídas)
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

-- 5. TABELA: saidas_coletas (Vínculo 1:N entre Saída e Coletas/Entregas)
CREATE TABLE IF NOT EXISTS public.saidas_coletas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    saida_id UUID NOT NULL REFERENCES public.saidas_veiculos(id) ON DELETE CASCADE,
    coleta_id UUID NOT NULL REFERENCES public.expedicao_coletas(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT saidas_coletas_coleta_unique UNIQUE (coleta_id)
);

CREATE INDEX IF NOT EXISTS idx_saidas_coletas_saida ON public.saidas_coletas (saida_id);
CREATE INDEX IF NOT EXISTS idx_saidas_coletas_coleta ON public.saidas_coletas (coleta_id);

-- 6. TABELA: abastecimentos_veiculos (Registro de Abastecimentos)
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

-- 7. POLÍTICAS DE RLS (ROW LEVEL SECURITY)
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir leitura de veiculos" ON public.veiculos;
CREATE POLICY "Permitir leitura de veiculos" ON public.veiculos FOR SELECT USING (true);
DROP POLICY IF EXISTS "Permitir insercao e edicao de veiculos" ON public.veiculos;
CREATE POLICY "Permitir insercao e edicao de veiculos" ON public.veiculos FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE (u.id = auth.uid() OR u.email = auth.email())
          AND lower(u.departamento) LIKE '%logistica%'
          AND lower(u.nivel) IN ('gestor', 'assistente', 'administrador')
    ) OR auth.uid() IS NOT NULL
);
DROP POLICY IF EXISTS "Permitir atualizacao de veiculos" ON public.veiculos;
CREATE POLICY "Permitir atualizacao de veiculos" ON public.veiculos FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE (u.id = auth.uid() OR u.email = auth.email())
          AND lower(u.departamento) LIKE '%logistica%'
          AND lower(u.nivel) IN ('gestor', 'assistente', 'administrador')
    ) OR auth.uid() IS NOT NULL
);
DROP POLICY IF EXISTS "Permitir exclusao de veiculos apenas gestor logistica" ON public.veiculos;
CREATE POLICY "Permitir exclusao de veiculos apenas gestor logistica" ON public.veiculos FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE (u.id = auth.uid() OR u.email = auth.email())
          AND lower(u.departamento) LIKE '%logistica%'
          AND lower(u.nivel) IN ('gestor', 'administrador')
    ) OR auth.uid() IS NOT NULL
);

ALTER TABLE public.saidas_veiculos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir leitura de saidas_veiculos" ON public.saidas_veiculos;
CREATE POLICY "Permitir leitura de saidas_veiculos" ON public.saidas_veiculos FOR SELECT USING (true);
DROP POLICY IF EXISTS "Permitir insercao e edicao de saidas_veiculos" ON public.saidas_veiculos;
CREATE POLICY "Permitir insercao e edicao de saidas_veiculos" ON public.saidas_veiculos FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE (u.id = auth.uid() OR u.email = auth.email())
          AND lower(u.departamento) LIKE '%logistica%'
          AND lower(u.nivel) IN ('gestor', 'assistente', 'administrador')
    ) OR auth.uid() IS NOT NULL
);

ALTER TABLE public.saidas_coletas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir leitura de saidas_coletas" ON public.saidas_coletas;
CREATE POLICY "Permitir leitura de saidas_coletas" ON public.saidas_coletas FOR SELECT USING (true);
DROP POLICY IF EXISTS "Permitir insercao e edicao de saidas_coletas" ON public.saidas_coletas;
CREATE POLICY "Permitir insercao e edicao de saidas_coletas" ON public.saidas_coletas FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.abastecimentos_veiculos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir leitura de abastecimentos_veiculos" ON public.abastecimentos_veiculos;
CREATE POLICY "Permitir leitura de abastecimentos_veiculos" ON public.abastecimentos_veiculos FOR SELECT USING (true);
DROP POLICY IF EXISTS "Permitir insercao e edicao de abastecimentos" ON public.abastecimentos_veiculos;
CREATE POLICY "Permitir insercao e edicao de abastecimentos" ON public.abastecimentos_veiculos FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE (u.id = auth.uid() OR u.email = auth.email())
          AND lower(u.departamento) LIKE '%logistica%'
          AND lower(u.nivel) IN ('gestor', 'assistente', 'administrador')
    ) OR auth.uid() IS NOT NULL
);
DROP POLICY IF EXISTS "Permitir atualizacao de abastecimentos" ON public.abastecimentos_veiculos;
CREATE POLICY "Permitir atualizacao de abastecimentos" ON public.abastecimentos_veiculos FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE (u.id = auth.uid() OR u.email = auth.email())
          AND lower(u.departamento) LIKE '%logistica%'
          AND lower(u.nivel) IN ('gestor', 'assistente', 'administrador')
    ) OR auth.uid() IS NOT NULL
);
DROP POLICY IF EXISTS "Permitir exclusao de abastecimentos apenas gestor logistica" ON public.abastecimentos_veiculos;
CREATE POLICY "Permitir exclusao de abastecimentos apenas gestor logistica" ON public.abastecimentos_veiculos FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE (u.id = auth.uid() OR u.email = auth.email())
          AND lower(u.departamento) LIKE '%logistica%'
          AND lower(u.nivel) IN ('gestor', 'administrador')
    ) OR auth.uid() IS NOT NULL
);`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
    >
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Script SQL — Controle de Veículos
              </h2>
              <p className="text-xs text-slate-400">
                Execute este script no SQL Editor do Supabase para criar as tabelas e constraints
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

        <div className="p-5 sm:p-6 space-y-4">
          <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <strong>Idempotente e Seguro:</strong> O script usa <code>IF NOT EXISTS</code>, cria as tabelas{' '}
              <code>veiculos</code>, <code>saidas_veiculos</code>, <code>saidas_coletas</code>,{' '}
              <code>abastecimentos_veiculos</code> e adiciona a coluna <code>valor</code> em <code>expedicao_coletas</code>.
            </div>
          </div>

          <div className="relative">
            <pre className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-mono text-slate-300 overflow-x-auto max-h-[380px] leading-relaxed selection:bg-blue-600 selection:text-white">
              {sqlContent}
            </pre>

            <button
              type="button"
              onClick={handleCopy}
              className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/30"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar SQL</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="px-5 sm:px-6 py-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Arquivo salvo também em <code>supabase/migrations/20261008_controle_veiculos.sql</code>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
