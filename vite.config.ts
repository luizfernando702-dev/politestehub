import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'child_process';

/**
 * POLIFILTRO — IDENTIFICAÇÃO AUTOMÁTICA DO BUILD
 * Gera identificador único sem exigir alteração manual de versão.
 * Prioridade:
 * 1. VERCEL_GIT_COMMIT_SHA (Vercel Git Deployments)
 * 2. VERCEL_DEPLOYMENT_ID (Vercel Deployments)
 * 3. BUILD_ID (Variável de ambiente de CI)
 * 4. Git commit local (se repositório git disponível)
 * 5. Timestamp único base36 (gerado a cada build)
 */
function getBuildId(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  }
  if (process.env.VERCEL_DEPLOYMENT_ID) {
    return process.env.VERCEL_DEPLOYMENT_ID.replace(/^dpl_/, '').slice(0, 8);
  }
  if (process.env.BUILD_ID) {
    return process.env.BUILD_ID.slice(0, 8);
  }
  try {
    const gitHash = execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    if (gitHash) return gitHash;
  } catch {
    // Sem repositório git disponível
  }
  return Date.now().toString(36);
}

const buildId = getBuildId();
const buildTime = new Date().toISOString();

function buildMetadataPlugin(id: string, time: string): Plugin {
  return {
    name: 'polihub-build-metadata',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'build-id.json',
        source: JSON.stringify({ buildId: id, buildTime: time }, null, 2),
      });
    },
  };
}

function suppressViteHmrPlugin(): Plugin {
  const scriptContent = `
    (function() {
      if (typeof window === 'undefined') return;
      var NativeWebSocket = window.WebSocket;
      if (NativeWebSocket) {
        function MockWebSocket(url, protocols) {
          var urlStr = String(url || '');
          var isViteHmr = urlStr.includes('vite-hmr') ||
                          urlStr.includes('token=') ||
                          urlStr.includes(':3000') ||
                          protocols === 'vite-hmr' ||
                          (Array.isArray(protocols) && protocols.includes('vite-hmr'));
          if (isViteHmr) {
            var target = new EventTarget();
            var dummy = {
              CONNECTING: 0,
              OPEN: 1,
              CLOSING: 2,
              CLOSED: 3,
              readyState: 1,
              url: urlStr,
              protocol: 'vite-hmr',
              extensions: '',
              bufferedAmount: 0,
              binaryType: 'blob',
              send: function() {},
              close: function() {
                dummy.readyState = 3;
                target.dispatchEvent(new Event('close'));
                if (dummy.onclose) dummy.onclose(new Event('close'));
              },
              addEventListener: target.addEventListener.bind(target),
              removeEventListener: target.removeEventListener.bind(target),
              dispatchEvent: target.dispatchEvent.bind(target),
              onopen: null,
              onclose: null,
              onerror: null,
              onmessage: null
            };
            return dummy;
          }
          return new NativeWebSocket(url, protocols);
        }
        MockWebSocket.CONNECTING = 0;
        MockWebSocket.OPEN = 1;
        MockWebSocket.CLOSING = 2;
        MockWebSocket.CLOSED = 3;
        MockWebSocket.prototype = NativeWebSocket.prototype;
        window.WebSocket = MockWebSocket;
      }
      var isViteLog = function() {
        for (var i = 0; i < arguments.length; i++) {
          var arg = arguments[i];
          if (!arg) continue;
          var str = typeof arg === 'string' ? arg : (arg.message || arg.stack || String(arg));
          if (
            str.includes('[vite]') ||
            str.includes('[hmr]') ||
            str.includes('failed to connect to websocket') ||
            str.includes('WebSocket') ||
            str.includes('websocket') ||
            str.includes('vite-plugin-pwa:dev-ready') ||
            str.includes('ERR_CONNECTION_REFUSED')
          ) {
            return true;
          }
        }
        return false;
      };
      ['log', 'warn', 'error', 'debug', 'info'].forEach(function(method) {
        if (console && console[method]) {
          var orig = console[method];
          console[method] = function() {
            if (isViteLog.apply(null, arguments)) return;
            orig.apply(console, arguments);
          };
        }
      });
      window.addEventListener('error', function(event) {
        if (event && (isViteLog(event.message) || isViteLog(event.error) || isViteLog(event.filename))) {
          event.stopImmediatePropagation();
          event.preventDefault();
          return false;
        }
      }, true);
      window.addEventListener('unhandledrejection', function(event) {
        if (event && isViteLog(event.reason)) {
          event.stopImmediatePropagation();
          event.preventDefault();
          return false;
        }
      }, true);
    })();
  `;

  return {
    name: 'suppress-vite-hmr-client',
    enforce: 'pre',
    transformIndexHtml: {
      order: 'pre',
      handler() {
        return [
          {
            tag: 'script',
            attrs: { type: 'text/javascript' },
            children: scriptContent,
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  };
}

export default defineConfig(() => {
  return {
    define: {
      __APP_BUILD_ID__: JSON.stringify(buildId),
      __APP_BUILD_TIME__: JSON.stringify(buildTime),
    },
    plugins: [
      suppressViteHmrPlugin(),
      react(),
      tailwindcss(),
      buildMetadataPlugin(buildId, buildTime),
      VitePWA({
        registerType: 'prompt', // Permite controle seguro de ativação pelo UpdateContext
        includeAssets: ['favicon-32x32.png', 'apple-touch-icon.png', 'icon.svg', 'sw-push.js'],
        manifest: {
          id: '/',
          name: 'PoliHub — Gestão Logística',
          short_name: 'PoliHub',
          description: 'Sistema mobile-first de gestão e operação de processos logísticos',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          cacheId: `polihub-${buildId}`,
          cleanupOutdatedCaches: true,
          importScripts: ['sw-push.js'],
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          navigateFallback: 'index.html',
          // NUNCA intercepta ou cacheia requisições do Supabase ou APIs como arquivos estáticos
          navigateFallbackDenylist: [
            /^\/api/,
            /^https:\/\/.*\.supabase\.co/,
          ],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: `polihub-fonts-${buildId}`,
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: `polihub-font-files-${buildId}`,
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            supabase: ['@supabase/supabase-js'],
            ui: ['lucide-react', 'motion'],
            excel: ['xlsx'],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: false,
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
