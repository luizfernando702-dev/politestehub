import React, { useState } from 'react';
import { X, Copy, Check, Terminal, Database, ShieldCheck, SearchCode, Sparkles } from 'lucide-react';

interface SqlScriptAuditoriaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SUPABASE_AUDITORIA_SQL = `-- ==============================================================================
-- POLIHUB — SCRIPT SUPABASE: ÍNDICES DE ALTA PERFORMANCE PARA O MÓDULO AUDITORIA
-- ==============================================================================
-- O módulo Auditoria consulta diretamente as tabelas operacionais existentes:
-- 1. public.recebimentos_produtos
-- 2. public.alteracoes_endereco
-- 3. public.inventario
--
-- O script abaixo cria índices compostos específicos para otimizar as consultas por
-- produto, unidade de negócio e data sem duplicar dados nem criar tabelas adicionais.
-- ==============================================================================

-- 1. Otimização em recebimentos_produtos
CREATE INDEX IF NOT EXISTS idx_recebimentos_produtos_auditoria
    ON public.recebimentos_produtos (unidade_negocio, produto);

CREATE INDEX IF NOT EXISTS idx_recebimentos_produtos_datas_auditoria
    ON public.recebimentos_produtos (data_recebimento, data_conferencia, data_alocacao);

-- 2. Otimização em alteracoes_endereco
ALTER TABLE public.alteracoes_endereco 
    ADD COLUMN IF NOT EXISTS unidade_negocio VARCHAR(100) DEFAULT 'Goiânia',
    ADD COLUMN IF NOT EXISTS alterado_sistema BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS data TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_alteracoes_endereco_auditoria
    ON public.alteracoes_endereco (unidade_negocio, produto, data DESC);

CREATE INDEX IF NOT EXISTS idx_alteracoes_endereco_pendentes
    ON public.alteracoes_endereco (alterado_sistema, produto);

-- 3. Otimização em inventario
CREATE INDEX IF NOT EXISTS idx_inventario_auditoria
    ON public.inventario (unidade_negocio, produto);

CREATE INDEX IF NOT EXISTS idx_inventario_datas_auditoria
    ON public.inventario (data_contagem, data_correcao);

-- 4. Otimização na tabela de produtos para autocomplete instantâneo
CREATE INDEX IF NOT EXISTS idx_produtos_busca_auditoria
    ON public.produtos (produto, codigo_barras);
`;

export const SqlScriptAuditoriaModal: React.FC<SqlScriptAuditoriaModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copiado, setCopiado] = useState(false);

  if (!isOpen) return null;

  const handleCopiar = () => {
    navigator.clipboard.writeText(SUPABASE_AUDITORIA_SQL);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <SearchCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Script SQL de Otimização — Auditoria
              </h3>
              <p className="text-xs text-slate-400">
                Índices recomendados para máxima velocidade de consulta no Supabase
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-center gap-3">
          <Sparkles className="w-4 h-4 shrink-0 text-blue-400" />
          <span>
            O módulo <strong>Auditoria</strong> não requer novas tabelas. Ele reutiliza 100% dos dados já gravados em Recebimento, Alocação, Alterações e Inventário.
          </span>
        </div>

        <div className="relative">
          <pre className="bg-slate-950 p-4 rounded-2xl text-xs font-mono text-slate-300 overflow-x-auto max-h-72 border border-slate-800">
            {SUPABASE_AUDITORIA_SQL}
          </pre>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-[11px] text-slate-500 font-mono">
            Copie e execute no Editor SQL do seu projeto Supabase.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handleCopiar}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-900/30"
            >
              {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiado ? 'Copiado!' : 'Copiar Script SQL'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
