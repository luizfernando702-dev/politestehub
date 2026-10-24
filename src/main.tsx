// Polyfill/Intercept WebSocket e logs de reconexão do Vite em iframe/container onde HMR é desativado
if (typeof window !== 'undefined') {
  const isViteLog = (...args: any[]) =>
    args.some((arg) => {
      if (!arg) return false;
      const str = typeof arg === 'string' ? arg : arg.message || arg.stack || String(arg);
      return (
        str.includes('[vite]') ||
        str.includes('[hmr]') ||
        str.includes('failed to connect to websocket') ||
        str.includes('WebSocket') ||
        str.includes('websocket') ||
        str.includes('vite-plugin-pwa:dev-ready') ||
        str.includes('ERR_CONNECTION_REFUSED')
      );
    });

  const methods: (keyof Console)[] = ['log', 'warn', 'error', 'debug', 'info'];
  methods.forEach((method) => {
    const orig = (console as any)[method];
    if (typeof orig === 'function') {
      (console as any)[method] = (...args: any[]) => {
        if (isViteLog(...args)) return;
        orig.apply(console, args);
      };
    }
  });
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
