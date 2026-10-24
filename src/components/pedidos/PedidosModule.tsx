import React, { useState } from 'react';
import {
  Truck,
  BarChart3,
  Building2,
  Database,
  ShieldCheck,
  Eye,
  Sparkles,
  Info,
  LifeBuoy,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { normalizarUnidadeNegocio } from '../../constants/unidades';
import { UNIDADE_PADRAO_SISTEMA } from '../../constants/unidades';
import { podeGerenciarPedidos } from '../../lib/permissions';
import { GraficosDadosTab } from './GraficosDadosTab';
import { DemonstracoesTab } from './DemonstracoesTab';
import { ChamadosTab } from './ChamadosTab';
import { ColetasModule } from '../coletas/ColetasModule';
import { SqlScriptPedidosModal } from './SqlScriptPedidosModal';

export type TabPedidos = 'coletas' | 'chamados' | 'demonstracoes' | 'graficos';

interface PedidosModuleProps {
  initialTab?: TabPedidos;
}

export const PedidosModule: React.FC<PedidosModuleProps> = ({ initialTab = 'coletas' }) => {
  const { user } = useAuth();
  const podeGerenciar = podeGerenciarPedidos(user);
  const [activeTab, setActiveTab] = useState<TabPedidos>(initialTab);
  const [sqlModalOpen, setSqlModalOpen] = useState(false);

  const unidadeNegocio = normalizarUnidadeNegocio(user?.unidade_negocio || UNIDADE_PADRAO_SISTEMA);

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* 1. MODULE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
              PoliHub Expedição & Produtividade
            </span>
            <span className="text-xs text-slate-300 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              <span>{unidadeNegocio}</span>
            </span>

            {/* Badge de Permissão */}
            {podeGerenciar ? (
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Gestão Logística Ativa</span>
              </span>
            ) : (
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                <span>Modo Consulta (Leitura)</span>
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Pedidos & Expedição
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Gestão operacional de coletas da expedição, chamados de ocorrência, demonstrações comerciais e indicadores analíticos de produtividade.
          </p>
        </div>


      </div>

      {/* Banner Informativo de Permissão em Modo Leitura */}
      {!podeGerenciar && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-200">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-amber-300 block">
              Acesso em Modo Consulta
            </span>
            <p className="text-slate-300 leading-relaxed">
              Todos os colaboradores podem visualizar, pesquisar e acompanhar as coletas, chamados e demonstrações. 
              As ações de cadastro, edição de dados operacionais e apontamentos são exclusivas para usuários autorizados da <strong>Logística</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Aviso exclusivo para Celulares e Tablets (Requisito 1: Menu Pedidos - Exibir somente na versão desktop/PC) */}
      <div className="lg:hidden p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
        <div>
          <strong className="block font-bold">Módulo exclusivo para Computador (Desktop/PC)</strong>
          <span>O módulo de Pedidos e Expedição é exibido somente na versão desktop/PC e oculto em celulares e tablets.</span>
        </div>
      </div>

      {/* 2. NAVIGATION TABS: 1. Coletas, 2. Chamados, 3. Demonstrações, 4. Gráficos e Dados */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-1 overflow-x-auto no-scrollbar">
        {/* ABA 1: COLETAS */}
        <button
          type="button"
          id="tab-pedidos-coletas"
          onClick={() => setActiveTab('coletas')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition whitespace-nowrap min-h-[44px] ${
            activeTab === 'coletas'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Coletas</span>
        </button>

        {/* ABA 2: CHAMADOS */}
        <button
          type="button"
          id="tab-pedidos-chamados"
          onClick={() => setActiveTab('chamados')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition whitespace-nowrap min-h-[44px] ${
            activeTab === 'chamados'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-900/40 font-bold'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <LifeBuoy className="w-4 h-4" />
          <span>Chamados</span>
        </button>

        {/* ABA 3: DEMONSTRAÇÕES */}
        <button
          type="button"
          id="tab-pedidos-demonstracoes"
          onClick={() => setActiveTab('demonstracoes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition whitespace-nowrap min-h-[44px] ${
            activeTab === 'demonstracoes'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-900/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Demonstrações</span>
        </button>

        {/* ABA 4: GRÁFICOS E DADOS */}
        <button
          type="button"
          id="tab-pedidos-graficos"
          onClick={() => setActiveTab('graficos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition whitespace-nowrap min-h-[44px] ${
            activeTab === 'graficos'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Gráficos e Dados</span>
        </button>
      </div>

      {/* 3. CONTEÚDO DA ABA ATIVA */}
      <div>
        {activeTab === 'coletas' && (
          <div className="pt-2">
            <ColetasModule />
          </div>
        )}

        {activeTab === 'chamados' && (
          <ChamadosTab unidadeNegocio={unidadeNegocio} />
        )}

        {activeTab === 'demonstracoes' && (
          <DemonstracoesTab unidadeNegocio={unidadeNegocio} />
        )}

        {activeTab === 'graficos' && (
          <GraficosDadosTab unidadeNegocio={unidadeNegocio} />
        )}
      </div>

      {/* Modal Script SQL Supabase */}
      <SqlScriptPedidosModal
        isOpen={sqlModalOpen}
        onClose={() => setSqlModalOpen(false)}
      />
    </div>
  );
};
