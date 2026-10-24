import React, { useState } from 'react';
import {
  LogOut,
  User as UserIcon,
  ChevronDown,
  Bell,
  Building2,
  ShieldCheck,
  Shield,
  Camera,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ModuleType } from '../../types';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { PushNotificationModal } from '../common/PushNotificationModal';
import { AvatarPickerModal } from '../common/AvatarPickerModal';
import { WhatsAppHeaderBadge } from '../whatsapp/WhatsAppHeaderBadge';
import { WHATSAPP_MODULE_ENABLED } from '../../lib/permissions';

interface HeaderProps {
  activeModule: ModuleType;
  setActiveModule: (module: ModuleType) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeModule, setActiveModule }) => {
  const { user, logout, updateUserPhoto } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const getModuleTitle = () => {
    switch (activeModule) {
      case 'home':
        return 'Painel Principal';
      case 'agendamentos':
        return 'Agendamentos';
      case 'recebimento':
        return 'Recebimento & Conferência';
      case 'tarefas':
        return 'Tarefas';
      case 'cadastros':
        return 'Cadastros';
      case 'pedidos':
        return 'Pedidos & Expedição';
      case 'coletas':
        return 'Coletas & Expedição';
      case 'alocacao':
        return 'Alocação de Cargas';
      case 'enderecamento':
        return 'Endereçamento';
      case 'inventario':
        return 'Inventário';
      case 'auditoria':
        return 'Auditoria de Estoque';
      case 'relatorios':
        return 'Relatórios Gerenciais';
      case 'veiculos':
        return 'Controle de Veículos';
      case 'compras':
        return 'Compras';
      case 'whatsapp':
        return 'Atendimento WhatsApp';
      case 'configuracoes':
        return 'Configurações';
      default:
        return 'PoliHub';
    }
  };

  // Helper para exibir somente Nome e Sobrenome na exibição compacta
  const getNomeSobrenome = (nomeCompleto?: string | null): string => {
    if (!nomeCompleto || !nomeCompleto.trim()) return 'Operador';
    const partes = nomeCompleto.trim().split(/\s+/);
    if (partes.length === 1) return partes[0];
    return `${partes[0]} ${partes[partes.length - 1]}`;
  };

  const nivelLower = (user?.nivel || '').toLowerCase();
  const isGestor = nivelLower === 'gestor' || nivelLower === 'administrador';
  const isAssistente = nivelLower === 'assistente';

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3 transition">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Brand and Active Module Title */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="btn-header-logo-home"
              onClick={() => setActiveModule('home')}
              className="flex items-center gap-2.5 text-left active:scale-95 transition"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 p-0.5 shadow-md shadow-blue-900/40 flex items-center justify-center shrink-0">
                <img src="/icon.svg" alt="PoliHub" className="w-8 h-8 rounded-lg" />
              </div>
              <div className="hidden xs:block">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-extrabold text-base tracking-tight text-white">POLIHUB</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    Log
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">{getModuleTitle()}</span>
              </div>
            </button>

            {/* Mobile Module Pill */}
            <div className="xs:hidden pl-2 border-l border-slate-800">
              <span className="text-sm font-bold text-slate-100">{getModuleTitle()}</span>
            </div>
          </div>

          {/* Right Action Area */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Push Notifications Trigger */}
            <button
              type="button"
              id="btn-header-push-notifications"
              onClick={() => setShowPushModal(true)}
              title="Notificações Push"
              className="flex items-center justify-center w-10 h-11 rounded-xl bg-slate-900 border border-slate-800 hover:border-blue-500/40 hover:bg-blue-500/10 text-slate-300 hover:text-blue-400 active:scale-95 transition"
            >
              <Bell className="w-4 h-4" />
            </button>

            {/* In-app PWA install trigger */}
            <PWAInstallButton compact />

            {/* Bloco Unidade de Negócio: Altura coincidente com o bloco de usuário (h-11) */}
            {user?.unidade_negocio && (
              <div className="hidden md:flex flex-col justify-center px-3 py-1.5 h-11 min-h-[44px] rounded-xl bg-slate-900 border border-slate-800 text-left">
                <div className="text-xs font-bold text-white flex items-center gap-1 leading-tight">
                  <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>{user.unidade_negocio}</span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1 leading-none mt-1">
                  {isGestor ? (
                    <ShieldCheck className="w-3 h-3 text-amber-400 shrink-0" />
                  ) : isAssistente ? (
                    <Shield className="w-3 h-3 text-sky-400 shrink-0" />
                  ) : (
                    <UserIcon className="w-3 h-3 text-slate-400 shrink-0" />
                  )}
                  <span
                    className={
                      isGestor
                        ? 'text-amber-400 font-semibold'
                        : isAssistente
                        ? 'text-sky-400 font-semibold'
                        : 'text-slate-300'
                    }
                  >
                    {user?.nivel || 'Operador'}
                  </span>
                </div>
              </div>
            )}

            {/* Badge WhatsApp: posicionada imediatamente à esquerda do bloco de departamento / usuário */}
            {WHATSAPP_MODULE_ENABLED && (
              <WhatsAppHeaderBadge onAbrirWhatsApp={() => setActiveModule('whatsapp')} />
            )}

            {/* Bloco do Usuário: Altura coincidente (h-11) com foto/avatar circular e departamento */}
            <div className="relative">
              <button
                type="button"
                id="btn-header-user-menu"
                onClick={() => setShowProfileMenu((prev) => !prev)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 h-11 min-h-[44px] rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-95 transition"
              >
                {/* Foto / Avatar Circular com recorte centralizado object-fit: cover */}
                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-slate-700 bg-slate-800 flex items-center justify-center">
                  {user?.foto ? (
                    <img
                      src={user.foto}
                      alt={user.nome || 'Avatar'}
                      className="w-full h-full object-cover object-center rounded-full"
                    />
                  ) : (
                    <div className="w-full h-full bg-blue-600/20 text-blue-400 font-bold text-xs flex items-center justify-center">
                      {user?.nome ? user.nome.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
                    </div>
                  )}
                </div>

                {/* Exibição compacta: Linha superior = Nome e Sobrenome, Linha inferior = Departamento */}
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-semibold text-white leading-tight">
                    {getNomeSobrenome(user?.nome)}
                  </div>
                  <div className="text-[10px] text-slate-400 leading-none mt-1">
                    {user?.departamento || 'Logística'}
                  </div>
                </div>

                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {/* Profile Dropdown Menu */}
              {showProfileMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowProfileMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-3 z-50 text-slate-200 animate-in fade-in zoom-in-95 duration-150">
                    {/* Header do Card de Perfil */}
                    <div className="px-3 py-3 border-b border-slate-800 mb-2">
                      <div className="flex items-center gap-3">
                        <div className="relative group">
                          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-blue-500/40 bg-slate-800 shrink-0">
                            {user?.foto ? (
                              <img
                                src={user.foto}
                                alt={user.nome || 'Avatar'}
                                className="w-full h-full object-cover object-center rounded-full"
                              />
                            ) : (
                              <div className="w-full h-full bg-blue-600/20 text-blue-400 font-bold text-base flex items-center justify-center">
                                {user?.nome ? user.nome.charAt(0).toUpperCase() : <UserIcon className="w-5 h-5" />}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            title="Trocar Foto de Perfil ou Avatar"
                            onClick={() => {
                              setShowProfileMenu(false);
                              setShowAvatarModal(true);
                            }}
                            className="absolute -bottom-1 -right-1 p-1 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-md transition"
                          >
                            <Camera className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate">{user?.nome}</p>
                          <p className="text-[11px] text-blue-400 font-mono font-semibold">
                            Código: {user?.codigo || '---'}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            {user?.funcao || 'Operador'}
                          </p>
                        </div>
                      </div>

                      {/* Badges de Nível e Unidade de Negócio */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                            isGestor
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : isAssistente
                              ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                              : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          }`}
                        >
                          {isGestor ? (
                            <ShieldCheck className="w-3 h-3 text-amber-400" />
                          ) : isAssistente ? (
                            <Shield className="w-3 h-3 text-sky-400" />
                          ) : (
                            <UserIcon className="w-3 h-3 text-slate-400" />
                          )}
                          <span>Nível: {user?.nivel || 'Operador'}</span>
                        </span>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-blue-400" />
                          <span>{user?.unidade_negocio || 'Goiânia'}</span>
                        </span>
                      </div>
                    </div>

                    {/* Botão de Troca de Foto e Avatar */}
                    <button
                      type="button"
                      id="btn-header-change-photo"
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowAvatarModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition min-h-[38px]"
                    >
                      <Camera className="w-4 h-4 text-sky-400" />
                      <span>Alterar Foto ou Avatar</span>
                    </button>

                    {/* Controle de Alternância de Tema Claro / Escuro */}
                    <div className="px-3 py-2 my-1 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                        {isDark ? (
                          <Moon className="w-4 h-4 text-sky-400" />
                        ) : (
                          <Sun className="w-4 h-4 text-amber-400" />
                        )}
                        <span>{isDark ? 'Tema Escuro' : 'Tema Claro'}</span>
                      </div>
                      <button
                        type="button"
                        id="btn-header-theme-toggle"
                        onClick={toggleTheme}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                          isDark ? 'bg-blue-600' : 'bg-slate-700'
                        }`}
                        title="Alternar entre tema claro e escuro"
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            isDark ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Notificações Push */}
                    <button
                      type="button"
                      id="btn-menu-push-notifications"
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowPushModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition min-h-[38px] mt-0.5"
                    >
                      <Bell className="w-4 h-4 text-blue-400" />
                      <span>Notificações Push</span>
                    </button>

                    {/* Sair da Conta */}
                    <button
                      type="button"
                      id="btn-header-logout"
                      onClick={() => {
                        setShowProfileMenu(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-xl hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 transition min-h-[38px] mt-1"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sair da Conta</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Modal de Escolha de Avatar e Upload de Foto */}
      <AvatarPickerModal
        isOpen={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        currentPhoto={user?.foto}
        userName={user?.nome}
        userId={user?.id}
        onSelectPhoto={async (url) => {
          await updateUserPhoto(url);
        }}
      />

      {/* Push Notification Settings Modal */}
      <PushNotificationModal
        isOpen={showPushModal}
        onClose={() => setShowPushModal(false)}
      />
    </>
  );
};
