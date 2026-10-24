import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-amber-500/95 text-slate-950 px-4 py-1.5 text-xs font-bold shadow-xl border border-amber-300 backdrop-blur-md animate-pulse">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Modo Offline — Dados locais em cache</span>
    </div>
  );
};
