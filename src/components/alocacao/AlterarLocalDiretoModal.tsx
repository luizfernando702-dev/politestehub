import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  MapPin,
  Package,
  ArrowRight,
  RefreshCw,
  Inbox,
  Building2,
  Barcode,
} from 'lucide-react';
import { produtosService } from '../../services/produtosService';
import { Produto } from '../../types';
import { AlterarEnderecoModal } from './AlterarEnderecoModal';
import { isEnderecoSemLocacao, formatarEnderecoDisplay } from '../../lib/enderecos';

interface AlterarLocalDiretoModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AlterarLocalDiretoModal: React.FC<AlterarLocalDiretoModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState<{
    produto: string;
    endereco: string | null;
    id?: string | number;
  } | null>(null);

  useEffect(() => {
    async function carregar() {
      try {
        setLoading(true);
        const data = await produtosService.list(busca);
        setProdutos(data);
      } catch (err) {
        console.error('Erro ao buscar produtos cadastrados para alteração direta:', err);
      } finally {
        setLoading(false);
      }
    }
    const timer = setTimeout(carregar, 200);
    return () => clearTimeout(timer);
  }, [busca]);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
        <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20">
                    Catálogo de Produtos
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Alterar Local Diretamente
                </h3>
                <p className="text-xs text-slate-400">
                  Produtos cadastrados no catálogo oficial
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition min-h-[44px]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-4 border-b border-slate-800 bg-slate-950/40">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por produto, código de barras, fabricante ou endereço..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 min-h-[44px]"
              />
            </div>
          </div>

          {/* Results */}
          <div className="p-4 overflow-y-auto flex-1 space-y-2">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 text-sky-400 animate-spin mx-auto mb-2" />
                <span>Consultando tabela de produtos...</span>
              </div>
            ) : produtos.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Inbox className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs font-semibold text-white">Nenhum produto localizado no catálogo.</p>
                <p className="text-[11px] text-slate-400">
                  {busca
                    ? 'Tente buscar com outro termo ou código.'
                    : 'Cadastre produtos na aba Cadastros > Produtos para alimentá-los aqui.'}
                </p>
              </div>
            ) : (
              produtos.map((item) => (
                <div
                  key={item.id}
                  onClick={() =>
                    setProdutoSelecionado({
                      produto: item.produto,
                      endereco: item.endereco || null,
                      id: item.id,
                    })
                  }
                  className="cursor-pointer group bg-slate-950/70 border border-slate-800 hover:border-sky-500/50 rounded-2xl p-3.5 transition flex items-center justify-between gap-3 min-h-[48px]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Package className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-sky-300 transition truncate">
                        {item.produto}
                      </h4>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">Endereço atual:</span>
                        {isEnderecoSemLocacao(item.endereco) ? (
                          <span className="font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/50 text-[10px]">
                            Sem Locação
                          </span>
                        ) : item.endereco ? (
                          <span className="font-mono font-bold text-sky-300 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800/50">
                            {item.endereco}
                          </span>
                        ) : (
                          <span className="text-amber-400/80 italic text-[10px]">
                            Sem endereço cadastrado
                          </span>
                        )}
                      </div>

                      {item.codigo_barras && (
                        <>
                          <span className="text-slate-600 hidden sm:inline">•</span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700/80 text-emerald-400 font-mono text-[10px]">
                            <Barcode className="w-3 h-3 text-emerald-400 shrink-0" />
                            {item.codigo_barras}
                          </span>
                        </>
                      )}

                      {item.fabricante && (
                        <>
                          <span className="text-slate-600 hidden sm:inline">•</span>
                          <span className="flex items-center gap-1 text-slate-400 text-[10px]">
                            <Building2 className="w-3 h-3 text-slate-500" />
                            {item.fabricante}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:bg-sky-600 transition shrink-0">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Sub-modal Alterar Endereço */}
      {produtoSelecionado && (
        <AlterarEnderecoModal
          produto={produtoSelecionado}
          tipoAlteracao="Avulsa"
          onClose={() => setProdutoSelecionado(null)}
          onSuccess={() => {
            setProdutoSelecionado(null);
            onSuccess();
          }}
        />
      )}
    </>
  );
};
