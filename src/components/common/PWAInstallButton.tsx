import React, { useState } from 'react';
import { Download, Share2, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        type="button"
        id="btn-install-pwa"
        onClick={install}
        className={`flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 text-white font-medium shadow-md shadow-blue-900/30 active:scale-95 transition min-h-[44px] ${
          compact ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm'
        }`}
        title="Instalar aplicativo Polifiltro no seu dispositivo"
      >
        <Download className="w-4 h-4 shrink-0 animate-bounce" />
        <span className="whitespace-nowrap">Instalar Polifiltro</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          id="btn-install-ios"
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center justify-center gap-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 hover:bg-slate-700 active:scale-95 transition min-h-[44px] ${
            compact ? 'px-3 py-2 text-xs' : 'px-3.5 py-2 text-sm'
          }`}
        >
          <Smartphone className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="whitespace-nowrap">Instalar no iPhone</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white">Instalar no iOS (Safari)</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <ol className="space-y-3 text-sm text-slate-300">
                <li className="flex items-start gap-2.5">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs shrink-0 mt-0.5">1</span>
                  <span>No navegador Safari, toque no botão <strong>Compartilhar</strong> (ícone do quadrado com a seta para cima).</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs shrink-0 mt-0.5">2</span>
                  <span>Role o menu para baixo e selecione <strong>Adicionar à Tela de Início</strong>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs shrink-0 mt-0.5">3</span>
                  <span>Toque em <strong>Adicionar</strong> no canto superior direito para finalizar.</span>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full rounded-xl bg-blue-600 hover:bg-blue-500 py-3 text-sm font-semibold text-white transition active:scale-98"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
