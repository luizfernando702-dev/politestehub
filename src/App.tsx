/**
 * POLIFILTRO — SISTEMA DE GESTÃO LOGÍSTICA
 * Logística Inteligente — Mobile-First, PWA e Modular com Supabase
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SessaoOperacionalProvider } from './context/SessaoOperacionalContext';
import { ThemeProvider } from './context/ThemeContext';
import { UpdateProvider } from './context/UpdateContext';
import { AuthScreen } from './components/auth/AuthScreen';
import { BlockedUserScreen } from './components/auth/BlockedUserScreen';
import { AlterarSenhaObrigatoriaScreen } from './components/auth/AlterarSenhaObrigatoriaScreen';
import { Header } from './components/layout/Header';
import { Navigation } from './components/layout/Navigation';
import { HomeScreen } from './components/home/HomeScreen';
import { AgendamentosModule } from './components/agendamentos/AgendamentosModule';
import { TarefasModule } from './components/tarefas/TarefasModule';
import { EnderecamentoModule } from './components/enderecamento/EnderecamentoModule';
import { InventarioModule } from './components/inventario/InventarioModule';
import { AlocacaoModule } from './components/alocacao/AlocacaoModule';
import { RecebimentoModule } from './components/recebimento/RecebimentoModule';
import { ColetasModule } from './components/coletas/ColetasModule';
import { PedidosModule } from './components/pedidos/PedidosModule';
import { CadastrosModule } from './components/cadastros/CadastrosModule';
import { RelatoriosModule } from './components/relatorios/RelatoriosModule';
import { AuditoriaModule } from './components/auditoria/AuditoriaModule';
import { ControleVeiculosModule } from './components/veiculos/ControleVeiculosModule';
import { ComprasModule } from './components/compras/ComprasModule';
import { WhatsAppModule } from './components/whatsapp/WhatsAppModule';
import { FloatingChat } from './components/chat/FloatingChat';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { UpdateNotification } from './components/common/UpdateNotification';
import { ModuleType } from './types';
import { Loader2 } from 'lucide-react';
import {
  isUserGestor,
  canUserAccessRecebimento,
  canUserAccessAlocacao,
  canUserAccessInventario,
  canUserAccessCompras,
  canUserAccessWhatsApp,
} from './lib/permissions';

const MainAppLayout: React.FC = () => {
  const { user, loading, refreshProfile, logout } = useAuth();
  const [activeModule, setActiveModule] = useState<ModuleType>('home');
  const [openAgendamentoModalOnLoad, setOpenAgendamentoModalOnLoad] = useState(false);

  const isGestor = isUserGestor(user);
  const canAccessRecebimento = canUserAccessRecebimento(user);
  const canAccessAlocacao = canUserAccessAlocacao(user);
  const canAccessInventario = canUserAccessInventario(user);
  const canAccessCompras = canUserAccessCompras(user);
  const canAccessWhatsApp = canUserAccessWhatsApp(user);

  // Proteção de rotas:
  // - WhatsApp: Exclusivo para usuários da Logística
  // - Cadastros, Endereços e Relatórios: Exclusivo para usuários com nível Gestor
  // - Recebimento: Exclusivo para usuários da Logística (e Gestores)
  // - Alocação: Exclusivo para usuários da Logística (e Gestores)
  // - Inventário: Exclusivo para usuários da Logística (e Gestores)
  // - Compras: Exclusivo para Comercial e Gestores
  React.useEffect(() => {
    if (!loading && user) {
      if (!isGestor && (activeModule === 'cadastros' || activeModule === 'enderecamento' || activeModule === 'relatorios')) {
        setActiveModule('home');
      }
      if (!canAccessWhatsApp && activeModule === 'whatsapp') {
        setActiveModule('home');
      }
      if (!canAccessRecebimento && activeModule === 'recebimento') {
        setActiveModule('home');
      }
      if (!canAccessAlocacao && activeModule === 'alocacao') {
        setActiveModule('home');
      }
      if (!canAccessInventario && activeModule === 'inventario') {
        setActiveModule('home');
      }
      if (!canAccessCompras && activeModule === 'compras') {
        setActiveModule('home');
      }
    }
  }, [loading, user, isGestor, canAccessWhatsApp, canAccessRecebimento, canAccessAlocacao, canAccessInventario, canAccessCompras, activeModule]);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 p-0.5 shadow-xl shadow-blue-900/40 flex items-center justify-center mb-4 animate-bounce">
          <img src="/icon.svg" alt="Polifiltro" className="w-12 h-12 rounded-xl" />
        </div>
        <h2 className="text-xl font-black text-white tracking-tight">POLIFILTRO</h2>
        <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
          <span>Inicializando armazém e credenciais...</span>
        </p>
      </div>
    );
  }

  // Not logged in -> Show Login / Register / Recovery
  if (!user) {
    return (
      <>
        <UpdateNotification />
        <OfflineIndicator />
        <AuthScreen />
      </>
    );
  }

  // Usuário com status = 'pendente' ou 'desativado' -> Bloquear acesso e exibir mensagem informativa
  const userStatus = user.status || 'aprovado';
  if (userStatus === 'pendente' || userStatus === 'desativado') {
    return (
      <>
        <UpdateNotification />
        <OfflineIndicator />
        <BlockedUserScreen
          user={user}
          status={userStatus}
          onRefresh={refreshProfile}
          onLogout={logout}
        />
      </>
    );
  }

  // Usuário com solicitação de alteração de senha obrigatória pendente (definida por Gestor)
  if (user.exigir_troca_senha) {
    return (
      <>
        <UpdateNotification />
        <OfflineIndicator />
        <AlterarSenhaObrigatoriaScreen
          user={user}
          onLogout={logout}
          onSuccess={refreshProfile}
        />
      </>
    );
  }

  const handleOpenNewAgendamentoFromHome = () => {
    setActiveModule('agendamentos');
    setOpenAgendamentoModalOnLoad(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row antialiased selection:bg-blue-500 selection:text-white">
      <UpdateNotification />
      <OfflineIndicator />

      {/* Navigation: Desktop Sidebar & Mobile Bottom Bar */}
      <Navigation activeModule={activeModule} setActiveModule={setActiveModule} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header activeModule={activeModule} setActiveModule={setActiveModule} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeModule === 'home' && (
            <HomeScreen
              onNavigate={(mod) => setActiveModule(mod)}
              onOpenNewAgendamento={handleOpenNewAgendamentoFromHome}
            />
          )}

          {activeModule === 'agendamentos' && (
            <AgendamentosModule
              initialOpenModal={openAgendamentoModalOnLoad}
              onResetInitialOpenModal={() => setOpenAgendamentoModalOnLoad(false)}
            />
          )}

          {activeModule === 'recebimento' && canAccessRecebimento && (
            <RecebimentoModule
              onNavegarParaAlocacao={() => setActiveModule('alocacao')}
              onVoltarParaHome={() => setActiveModule('home')}
            />
          )}

          {activeModule === 'tarefas' && <TarefasModule />}

          {activeModule === 'cadastros' && isGestor && <CadastrosModule />}

          {activeModule === 'alocacao' && canAccessAlocacao && (
            <AlocacaoModule onVoltarParaHome={() => setActiveModule('home')} />
          )}

          {activeModule === 'pedidos' && <PedidosModule />}

          {activeModule === 'coletas' && <PedidosModule initialTab="coletas" />}

          {activeModule === 'enderecamento' && isGestor && <CadastrosModule initialTab="enderecos" />}

          {activeModule === 'inventario' && canAccessInventario && (
            <InventarioModule onVoltarParaHome={() => setActiveModule('home')} />
          )}

          {activeModule === 'auditoria' && <AuditoriaModule />}

          {activeModule === 'veiculos' && <ControleVeiculosModule />}

          {activeModule === 'compras' && canAccessCompras && (
            <ComprasModule onVoltarParaHome={() => setActiveModule('home')} />
          )}

          {activeModule === 'whatsapp' && canAccessWhatsApp && (
            <WhatsAppModule onVoltarParaHome={() => setActiveModule('home')} />
          )}

          {activeModule === 'relatorios' && isGestor && <RelatoriosModule />}
        </main>
      </div>

      {/* Chat Interno Flutuante — acessível em todos os menus sem redirecionar */}
      <FloatingChat />
    </div>
  );
};

export default function App() {
  return (
    <UpdateProvider>
      <AuthProvider>
        <ThemeProvider>
          <SessaoOperacionalProvider>
            <MainAppLayout />
          </SessaoOperacionalProvider>
        </ThemeProvider>
      </AuthProvider>
    </UpdateProvider>
  );
}
