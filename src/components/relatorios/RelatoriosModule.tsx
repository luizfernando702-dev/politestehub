import React, { useState } from 'react';
import {
  FileSpreadsheet,
  ClipboardCheck,
  Package,
  MapPin,
  TrendingUp,
  ArrowRight,
  Layers,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Search,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isUserGestor } from '../../lib/permissions';
import { RELATORIOS_REGISTRY } from './relatoriosRegistry';
import { RelatorioRecebimentoProdutos } from './RelatorioRecebimentoProdutos';

export const RelatoriosModule: React.FC = () => {
  const { user } = useAuth();
  const isGestor = isUserGestor(user);

  // Relatório selecionado (inicia direto no primeiro relatório solicitado)
  const [relatorioAtivo, setRelatorioAtivo] = useState<string>('recebimentos_produtos');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');
  const [buscaCatalogo, setBuscaCatalogo] = useState<string>('');

  if (!isGestor) {
    return (
      <div className="py-16 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Acesso Restrito a Relatórios</h2>
        <p className="text-xs sm:text-sm text-slate-400">
          O menu de Relatórios é de visualização exclusiva para usuários com perfil <strong className="text-white">gestor</strong>.
          Seu perfil atual é <strong className="text-amber-400">{user?.nivel || 'Operador'}</strong>.
        </p>
      </div>
    );
  }

  const categorias = [
    { id: 'todos', label: 'Todos os Relatórios' },
    { id: 'Recebimento & Alocação', label: 'Recebimento & Alocação' },
    { id: 'Estoque & Inventário', label: 'Estoque & Inventário' },
    { id: 'Movimentações', label: 'Movimentações' },
  ];

  const relatoriosFiltrados = RELATORIOS_REGISTRY.filter((rel) => {
    if (filtroCategoria !== 'todos' && rel.categoria !== filtroCategoria) {
      return false;
    }
    if (buscaCatalogo.trim()) {
      const termo = buscaCatalogo.toLowerCase().trim();
      return (
        rel.titulo.toLowerCase().includes(termo) ||
        rel.descricao.toLowerCase().includes(termo) ||
        rel.tabelaOrigem.toLowerCase().includes(termo)
      );
    }
    return true;
  });

  const getIcone = (nome: string) => {
    switch (nome) {
      case 'ClipboardCheck':
        return <ClipboardCheck className="w-6 h-6" />;
      case 'Package':
        return <Package className="w-6 h-6" />;
      case 'MapPin':
        return <MapPin className="w-6 h-6" />;
      case 'TrendingUp':
        return <TrendingUp className="w-6 h-6" />;
      default:
        return <FileSpreadsheet className="w-6 h-6" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. CABEÇALHO DO MÓDULO */}
      <header className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950/40 border border-slate-800 p-5 sm:p-7 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                WMS Inteligente
              </span>
              <span className="text-xs font-bold text-slate-400">
                Módulo Modular de Exportação & Auditoria
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <FileSpreadsheet className="w-7 h-7 text-blue-400" />
              <span>Relatórios Gerenciais</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Emissão analítica de dados operacionais com exportação para Excel (.xlsx), CSV e visualização para impressão/PDF.
            </p>
          </div>

          {/* Seletor rápido de Visualização: Formulário Ativo vs Catálogo Completo */}
          <div className="flex items-center gap-2 self-start md:self-auto bg-slate-950/80 border border-slate-800 p-1.5 rounded-2xl">
            <button
              type="button"
              id="tab-funcao-recebimento"
              onClick={() => setRelatorioAtivo('recebimentos_produtos')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                relatorioAtivo === 'recebimentos_produtos'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Recebimento por NF</span>
            </button>

            <button
              type="button"
              id="tab-catalogo-relatorios"
              onClick={() => setRelatorioAtivo('catalogo')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                relatorioAtivo === 'catalogo'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Catálogo ({RELATORIOS_REGISTRY.length})</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. CONTEÚDO DINÂMICO CONFORME SELEÇÃO */}
      {relatorioAtivo === 'recebimentos_produtos' && (
        <RelatorioRecebimentoProdutos
          onVoltarCatalogo={() => setRelatorioAtivo('catalogo')}
        />
      )}

      {relatorioAtivo === 'catalogo' && (
        <div className="space-y-6">
          {/* Filtros e Busca no Catálogo */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
              {categorias.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFiltroCategoria(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    filtroCategoria === cat.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[200px] sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={buscaCatalogo}
                onChange={(e) => setBuscaCatalogo(e.target.value)}
                placeholder="Buscar relatório..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Grade de Relatórios */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {relatoriosFiltrados.map((rel) => {
              const isDisponivel = rel.disponivel;

              return (
                <div
                  key={rel.id}
                  className={`rounded-3xl border p-5 sm:p-6 transition-all duration-200 relative flex flex-col justify-between ${
                    isDisponivel
                      ? 'bg-slate-900/90 border-slate-800 hover:border-blue-500/50 shadow-lg'
                      : 'bg-slate-900/40 border-slate-800/60 opacity-80'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${
                          isDisponivel
                            ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                            : 'bg-slate-800/50 border-slate-700/50 text-slate-500'
                        }`}
                      >
                        {getIcone(rel.icone)}
                      </div>

                      <span
                        className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full border ${
                          isDisponivel
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400/80 border-amber-500/20'
                        }`}
                      >
                        {isDisponivel ? 'Disponível' : 'Próxima Função'}
                      </span>
                    </div>

                    <div className="mt-4">
                      <div className="text-[11px] font-bold text-blue-400 uppercase tracking-wider font-mono">
                        {rel.tabelaOrigem}
                      </div>
                      <h3 className="text-lg font-bold text-white mt-0.5">{rel.titulo}</h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-3 leading-relaxed">
                        {rel.descricao}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <div className="text-[11px] text-slate-500 font-medium">
                      {isDisponivel ? (
                        <span className="text-slate-400">
                          Requer: <strong className="text-white">{rel.camposObrigatorios.join(', ')}</strong>
                        </span>
                      ) : (
                        <span>Módulo preparado para expansão</span>
                      )}
                    </div>

                    {isDisponivel ? (
                      <button
                        type="button"
                        onClick={() => setRelatorioAtivo(rel.id)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-600/20"
                      >
                        <span>Abrir</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-slate-500 cursor-not-allowed">
                        Em breve
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Nota de Arquitetura Extensível */}
          <div className="p-4 rounded-2xl bg-blue-950/20 border border-blue-900/30 flex items-center gap-3 text-xs text-blue-300">
            <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              <strong>Arquitetura Extensível:</strong> O módulo foi projetado para registrar novas funções de relatórios simplesmente adicionando novas definições no registro central, sem risco de quebrar a primeira função implementada.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
