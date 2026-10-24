import React, { useState, useEffect } from 'react';
import { Home, CalendarClock, Package, LogOut, PackageCheck, Building2, CheckSquare, ClipboardCheck, FileSpreadsheet, Truck, Boxes, SearchCode, ShoppingCart, MessageSquare } from 'lucide-react';
import { ModuleType } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useUpdate } from '../../context/UpdateContext';
import {
  isUserGestor,
  canUserAccessRecebimento,
  canUserAccessAlocacao,
  canUserAccessInventario,
  canUserAccessCompras,
  canUserAccessWhatsApp,
} from '../../lib/permissions';
import { badgesService, ModuleBadges } from '../../services/badgesService';

interface NavigationProps {
  activeModule: ModuleType;
  setActiveModule: (module: ModuleType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeModule, setActiveModule }) => {
  const { user, logout } = useAuth();
  const { buildId } = useUpdate();
  const isGestor = isUserGestor(user);
  const [badges, setBadges] = useState<ModuleBadges>({
    agendamentos: 0,
    recebimento: 0,
    alocacao: 0,
    cadastros: 0,
    inventario: 0,
    compras: 0,
  });

  useEffect(() => {
    let isMounted = true;
    const carregarBadges = async () => {
      try {
        const dados = await badgesService.obterBadges(user?.unidade_negocio);
        if (isMounted) {
          setBadges(dados);
        }
      } catch (err) {
        console.warn('Erro ao carregar badges:', err);
      }
    };

    carregarBadges();
    const interval = setInterval(carregarBadges, 30000);
    window.addEventListener('polihub_badges_refresh', carregarBadges);
    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('polihub_badges_refresh', carregarBadges);
    };
  }, [activeModule, user?.unidade_negocio]);

  const allNavItems: { id: ModuleType; label: string; icon: React.FC<{ className?: string }>; emoji: string }[] = [
    { id: 'home', label: 'Início', icon: Home, emoji: '🏠' },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, emoji: '💬' },
    { id: 'compras', label: 'Compras', icon: ShoppingCart, emoji: '🛒' },
    { id: 'agendamentos', label: 'Agendamentos', icon: CalendarClock, emoji: '🗓️' },
    { id: 'recebimento', label: 'Recebimento', icon: ClipboardCheck, emoji: '📥' },
    { id: 'alocacao', label: 'Alocação', icon: PackageCheck, emoji: '📦' },
    { id: 'pedidos', label: 'Pedidos', icon: Boxes, emoji: '📦' },
    { id: 'veiculos', label: 'Controle de Veículos', icon: Truck, emoji: '🚚' },
    { id: 'tarefas', label: 'Tarefas', icon: CheckSquare, emoji: '✅' },
    { id: 'inventario', label: 'Inventário', icon: Package, emoji: '📋' },
    { id: 'auditoria', label: 'Auditoria', icon: SearchCode, emoji: '🔍' },
    { id: 'cadastros', label: 'Cadastros', icon: Building2, emoji: '🏢' },
    { id: 'relatorios', label: 'Relatórios', icon: FileSpreadsheet, emoji: '📊' },
  ];

  // Controle de Acesso aos Módulos:
  // - WhatsApp: Exclusivo para usuários do departamento Logística
  // - Cadastros e Relatórios: Exclusivo para usuários com nível Gestor
  // - Recebimento: Exclusivo para usuários da Logística (e Gestores)
  // - Alocação: Exclusivo para usuários da Logística (e Gestores)
  // - Inventário: Exclusivo para usuários da Logística (e Gestores)
  // - Compras: Visível para Comercial e Gestores
  const navItems = allNavItems.filter((item) => {
    if (item.id === 'whatsapp') {
      return canUserAccessWhatsApp(user);
    }
    if (item.id === 'cadastros' || item.id === 'relatorios') {
      return isGestor;
    }
    if (item.id === 'recebimento') {
      return canUserAccessRecebimento(user);
    }
    if (item.id === 'alocacao') {
      return canUserAccessAlocacao(user);
    }
    if (item.id === 'inventario') {
      return canUserAccessInventario(user);
    }
    if (item.id === 'compras') {
      return canUserAccessCompras(user);
    }
    return true;
  });

  const mobileNavItems = navItems.filter((item) => item.id !== 'pedidos' && item.id !== 'veiculos');

  const getBadgeCount = (id: ModuleType): number => {
    switch (id) {
      case 'whatsapp':
        return badges.whatsapp || 0;
      case 'agendamentos':
        return badges.agendamentos || 0;
      case 'recebimento':
        return badges.recebimento || 0;
      case 'alocacao':
        return badges.alocacao || 0;
      case 'cadastros':
        return badges.cadastros || 0;
      case 'inventario':
        return badges.inventario || 0;
      case 'compras':
        return badges.compras || 0;
      default:
        return 0;
    }
  };

  return (
    <>
      {/* 1. DESKTOP SIDEBAR (Visible on md and larger; Pedidos & Veículos visible strictly on lg/desktop) */}
      <aside className="hidden md:flex flex-col justify-between w-64 bg-slate-950 border-r border-slate-800/80 p-5 shrink-0 h-screen sticky top-0">
        <div>
          {/* Polifiltro Logo */}
          <div className="flex items-center gap-3 pb-6 border-b border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 p-0.5 shadow-lg shadow-blue-900/30 flex items-center justify-center">
              <img src="/icon.svg" alt="Polifiltro Logo" className="w-8 h-8 rounded-lg" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                POLIFILTRO
                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  WMS
                </span>
              </h2>
              <p className="text-xs text-slate-400">Logística Inteligente</p>
            </div>
          </div>

          {/* Module Nav Links */}
          <div className="mt-6">
            <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider px-3 mb-2">
              Módulos Principais
            </div>
            <nav className="space-y-1.5" aria-label="Menu Principal">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeModule === item.id;
                const isDesktopOnly = item.id === 'pedidos' || item.id === 'veiculos';
                return (
                  <button
                    key={item.id}
                    type="button"
                    id={`desktop-nav-${item.id}`}
                    onClick={() => setActiveModule(item.id)}
                    className={`w-full ${
                      isDesktopOnly ? 'hidden lg:flex' : 'flex'
                    } items-center justify-between px-3.5 py-3 rounded-2xl font-semibold text-sm transition min-h-[48px] text-left ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getBadgeCount(item.id) > 0 && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-black tracking-tight ${
                            isActive
                              ? 'bg-white/25 text-white'
                              : item.id === 'compras'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {getBadgeCount(item.id) > 99 ? '99+' : getBadgeCount(item.id)}
                        </span>
                      )}
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      )}
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* User Card & Logout at Bottom of Sidebar */}
        <div className="pt-4 border-t border-slate-800">
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800/80 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs">
                {user?.codigo ? user.codigo.slice(0, 2) : 'OP'}
              </div>
              <div className="overflow-hidden flex-1">
                <div className="text-xs font-bold text-white truncate">{user?.nome}</div>
                <div className="text-[11px] text-blue-400 font-mono">{user?.codigo}</div>
                <div className="text-[10px] text-slate-300 truncate">{user?.departamento}</div>
              </div>
            </div>
          </div>

          <button
            type="button"
            id="btn-sidebar-logout"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 text-xs font-semibold transition min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            <span>Encerrar Sessão</span>
          </button>
        </div>
      </aside>

      {/* 2. MOBILE BOTTOM NAVIGATION BAR (Visible on mobile screens < md - Pedidos e Veículos ocultos em celulares e tablets) */}
      <nav
        aria-label="Navegação Móvel"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/90 px-1 py-1 pb-safe shadow-2xl"
      >
        <div className="flex items-center justify-between gap-0.5 max-w-lg mx-auto overflow-x-auto no-scrollbar">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                id={`mobile-nav-${item.id}`}
                onClick={() => setActiveModule(item.id)}
                className={`flex-1 min-w-[50px] flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition min-h-[54px] active:scale-95 ${
                  isActive
                    ? 'text-blue-400 bg-blue-500/10 font-bold'
                    : 'text-slate-400 hover:text-slate-200 font-medium'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-blue-400 scale-110' : 'text-slate-400'}`} />
                  {getBadgeCount(item.id) > 0 ? (
                    <span
                      className={`absolute -top-1.5 -right-2 px-1 min-w-[15px] h-3.5 rounded-full ${
                        item.id === 'compras'
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : 'bg-blue-600 text-white'
                      } text-[9px] font-black leading-none flex items-center justify-center border border-slate-950 shadow-sm`}
                    >
                      {getBadgeCount(item.id) > 99 ? '99+' : getBadgeCount(item.id)}
                    </span>
                  ) : (
                    isActive && (
                      <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-blue-400 ring-2 ring-slate-950" />
                    )
                  )}
                </div>
                <span className="text-[11px] leading-tight tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
