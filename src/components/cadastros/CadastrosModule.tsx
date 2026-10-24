import React, { useState } from 'react';
import { Truck, Building2, Database, Shield, ShieldCheck, UserCheck, Package, Users, MapPin } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { TransportadorasTab } from './TransportadorasTab';
import { FornecedoresTab } from './FornecedoresTab';
import { ProdutosTab } from './ProdutosTab';
import { UsuariosTab } from './UsuariosTab';
import { UnidadesNegocioTab } from './UnidadesNegocioTab';
import { EnderecamentoModule } from '../enderecamento/EnderecamentoModule';
import { VeiculosTab } from './VeiculosTab';
import { SqlScriptModal } from './SqlScriptModal';

interface CadastrosModuleProps {
  initialTab?: 'produtos' | 'usuarios' | 'unidades' | 'transportadoras' | 'fornecedores' | 'enderecos' | 'veiculos';
}

export const CadastrosModule: React.FC<CadastrosModuleProps> = ({ initialTab = 'produtos' }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'transportadoras' | 'fornecedores' | 'produtos' | 'usuarios' | 'unidades' | 'enderecos' | 'veiculos'>(initialTab);
  const [sqlModalOpen, setSqlModalOpen] = useState(false);

  // Strict gestor check: O nível 'gestor' possui acesso administrativo. Os demais níveis são considerados usuários comuns.
  const userNivel = user?.nivel?.toLowerCase() || 'operador';
  const isGestor = userNivel === 'gestor' || userNivel === 'administrador';

  if (!isGestor) {
    return (
      <div className="py-16 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Acesso Restrito ao Módulo Cadastros</h2>
        <p className="text-xs sm:text-sm text-slate-400">
          O módulo Cadastros é exclusivo para usuários com perfil <strong className="text-white">gestor</strong>.
          Seu nível atual é <strong className="text-amber-400">{user?.nivel || 'Comum'}</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* 1. MODULE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
              PoliHub Base de Dados
            </span>
            <span className="text-xs text-slate-300">
              Estrutura Integrada
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Cadastros
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Gestão simplificada de catálogo de produtos, usuários e permissões do sistema, transportadoras e fornecedores/fábricas.
          </p>
        </div>


      </div>

      {/* 2. ACCESS LEVEL STATUS BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-xl flex items-center justify-center ${
              isGestor
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            }`}
          >
            {isGestor ? <ShieldCheck className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
          </div>
          <div>
            <span className="font-bold text-white">
              Nível de Acesso: {user?.nivel || 'Operador'}
            </span>
            <span className="text-slate-400 ml-2 hidden sm:inline">
              {isGestor
                ? 'Permissão de Gestor: adicionar, editar e inativar produtos, usuários e cadastros gerais.'
                : 'Modo consulta ativo.'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-300">
          <UserCheck className="w-3.5 h-3.5 text-slate-300" />
          <span>Usuário: <strong className="text-slate-300">{user?.nome || 'Operador'}</strong> ({user?.codigo || 'OP'})</span>
        </div>
      </div>

      {/* 3. NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-1 overflow-x-auto">
        <button
          type="button"
          id="tab-produtos"
          onClick={() => setActiveTab('produtos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition whitespace-nowrap min-h-[44px] ${
            activeTab === 'produtos'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Produtos</span>
        </button>

        <button
          type="button"
          id="tab-usuarios"
          onClick={() => setActiveTab('usuarios')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition whitespace-nowrap min-h-[44px] ${
            activeTab === 'usuarios'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Usuários</span>
        </button>

        <button
          type="button"
          id="tab-unidades"
          onClick={() => setActiveTab('unidades')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition whitespace-nowrap min-h-[44px] ${
            activeTab === 'unidades'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Unidades de Negócio</span>
        </button>

        <button
          type="button"
          id="tab-transportadoras"
          onClick={() => setActiveTab('transportadoras')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition whitespace-nowrap min-h-[44px] ${
            activeTab === 'transportadoras'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-900/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Transportadoras</span>
        </button>

        <button
          type="button"
          id="tab-fornecedores"
          onClick={() => setActiveTab('fornecedores')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition whitespace-nowrap min-h-[44px] ${
            activeTab === 'fornecedores'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Fornecedores / Fábricas</span>
        </button>

        <button
          type="button"
          id="tab-enderecos"
          onClick={() => setActiveTab('enderecos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition whitespace-nowrap min-h-[44px] ${
            activeTab === 'enderecos'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-900/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Endereços</span>
        </button>

        <button
          type="button"
          id="tab-veiculos"
          onClick={() => setActiveTab('veiculos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition whitespace-nowrap min-h-[44px] ${
            activeTab === 'veiculos'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Veículos</span>
        </button>
      </div>

      {/* 4. TAB CONTENTS */}
      {activeTab === 'produtos' && (
        <ProdutosTab currentUser={user} isGestor={isGestor} />
      )}

      {activeTab === 'usuarios' && (
        <UsuariosTab currentUser={user} isGestor={isGestor} />
      )}

      {activeTab === 'unidades' && (
        <UnidadesNegocioTab currentUser={user} isGestor={isGestor} />
      )}

      {activeTab === 'transportadoras' && (
        <TransportadorasTab currentUser={user} isGestor={isGestor} />
      )}

      {activeTab === 'fornecedores' && (
        <FornecedoresTab currentUser={user} isGestor={isGestor} />
      )}

      {activeTab === 'enderecos' && (
        <EnderecamentoModule embedded={true} />
      )}

      {activeTab === 'veiculos' && (
        <VeiculosTab currentUser={user} isGestor={isGestor} />
      )}

      {/* 5. SQL SCRIPT MODAL */}
      <SqlScriptModal isOpen={sqlModalOpen} onClose={() => setSqlModalOpen(false)} />
    </div>
  );
};

