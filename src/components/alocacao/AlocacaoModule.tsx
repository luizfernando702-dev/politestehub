import React, { useState, useEffect, useCallback } from 'react';
import {
  PackageCheck,
  MapPin,
  ShieldCheck,
  ArrowRight,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { RecebimentoProduto, ResumoNotaAlocacao } from '../../types';
import { alocacaoService } from '../../services/alocacaoService';
import { useAuth } from '../../context/AuthContext';
import { isUserGestor } from '../../lib/permissions';
import { ListaNotasView } from './ListaNotasView';
import { ProdutosNotaView } from './ProdutosNotaView';
import { ProdutosPendentesAlocacaoView } from './ProdutosPendentesAlocacaoView';
import { GerirAlteracoesView } from './GerirAlteracoesView';
import { AlterarLocalDiretoModal } from './AlterarLocalDiretoModal';
import { DetalheProdutoModal } from './DetalheProdutoModal';
import { IdentificacaoOperacionalModal } from '../common/IdentificacaoOperacionalModal';
import { useSessaoOperacional } from '../../context/SessaoOperacionalContext';
import { useUpdate } from '../../context/UpdateContext';

type AlocacaoViewMode =
  | 'menu_principal'
  | 'produtos_pendentes'
  | 'notas_para_alocar'
  | 'produtos_nota'
  | 'gerir_alteracoes';

interface AlocacaoModuleProps {
  onVoltarParaHome?: () => void;
}

export const AlocacaoModule: React.FC<AlocacaoModuleProps> = ({ onVoltarParaHome }) => {
  const { user } = useAuth();
  const { operador, limparSessaoOperacional } = useSessaoOperacional();
  const { marcarOperacaoAtiva } = useUpdate();
  const [isTrocandoOperador, setIsTrocandoOperador] = useState(false);

  // Ao sair do módulo (desmontagem do componente), limpa a sessão operacional
  const limparSessaoRef = React.useRef(limparSessaoOperacional);
  useEffect(() => {
    limparSessaoRef.current = limparSessaoOperacional;
  }, [limparSessaoOperacional]);

  useEffect(() => {
    return () => {
      limparSessaoRef.current();
    };
  }, []);

  const [viewMode, setViewMode] = useState<AlocacaoViewMode>('menu_principal');

  // Filtros sob demanda da tela Notas para alocar
  const [filtroData, setFiltroData] = useState<string>('');
  const [filtroNotaFiscal, setFiltroNotaFiscal] = useState<string>('');
  const [buscando, setBuscando] = useState(false);
  const [notasEncontradas, setNotasEncontradas] = useState<ResumoNotaAlocacao[]>([]);
  const [notasCarregadas, setNotasCarregadas] = useState(false);
  const [notaSelecionada, setNotaSelecionada] = useState<ResumoNotaAlocacao | null>(null);
  const [notaParaAlocacao, setNotaParaAlocacao] = useState<ResumoNotaAlocacao | null>(null);
  const [solicitandoPin, setSolicitandoPin] = useState(false);

  // Modais e estados de alocação de produtos
  const [produtoSelecionadoParaAlocar, setProdutoSelecionadoParaAlocar] = useState<RecebimentoProduto | null>(null);
  const [produtoParaPin, setProdutoParaPin] = useState<RecebimentoProduto | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Modais
  const [isAlterarLocalOpen, setIsAlterarLocalOpen] = useState(false);
  const [toastFeedback, setToastFeedback] = useState<string | null>(null);

  // Protege a operação de alocação de estoque contra recarregamento inesperado
  useEffect(() => {
    const isAtivo =
      viewMode === 'produtos_nota' ||
      viewMode === 'produtos_pendentes' ||
      isAlterarLocalOpen ||
      Boolean(notaSelecionada) ||
      Boolean(produtoSelecionadoParaAlocar);
    marcarOperacaoAtiva(isAtivo, 'alocacao');
    return () => {
      marcarOperacaoAtiva(false, 'alocacao');
    };
  }, [viewMode, isAlterarLocalOpen, notaSelecionada, produtoSelecionadoParaAlocar, marcarOperacaoAtiva]);

  const isGestor = isUserGestor(user);

  const showToast = (msg: string) => {
    setToastFeedback(msg);
    setTimeout(() => setToastFeedback(null), 3500);
  };

  // Busca de notas no Supabase (executada somente ao entrar em Notas para alocar ou ao clicar em Filtrar)
  const carregarNotas = useCallback(
    async (criterios?: { dataRecebimento?: string; notaFiscal?: string }) => {
      try {
        setBuscando(true);
        const dataFiltro = criterios !== undefined ? criterios.dataRecebimento : filtroData;
        const nfFiltro = criterios !== undefined ? criterios.notaFiscal : filtroNotaFiscal;

        const resultado = await alocacaoService.listarNotasParaAlocacao({
          dataRecebimento: dataFiltro || undefined,
          notaFiscal: nfFiltro?.trim() || undefined,
        });

        setNotasEncontradas(resultado);
        setNotasCarregadas(true);
      } catch (err) {
        console.error('Erro ao buscar notas para alocação:', err);
        showToast('Erro ao consultar notas de recebimento.');
      } finally {
        setBuscando(false);
      }
    },
    [filtroData, filtroNotaFiscal]
  );

  const handleAbrirNotasParaAlocar = () => {
    // Redireciona diretamente para a tela inicial de produtos pendentes de alocação
    setViewMode('produtos_pendentes');
  };

  const handleFiltrarNotas = (criterios: { dataRecebimento?: string; notaFiscal?: string }) => {
    setFiltroData(criterios.dataRecebimento || '');
    setFiltroNotaFiscal(criterios.notaFiscal || '');
    carregarNotas(criterios);
  };

  const handleLimparFiltros = () => {
    setFiltroData('');
    setFiltroNotaFiscal('');
    carregarNotas({ dataRecebimento: '', notaFiscal: '' });
  };

  const handleAbrirGerirAlteracoes = () => {
    setViewMode('gerir_alteracoes');
  };

  // Visualização de sub-telas
  if (viewMode === 'gerir_alteracoes') {
    return <GerirAlteracoesView onVoltar={() => setViewMode('menu_principal')} />;
  }

  if (viewMode === 'produtos_nota' && notaSelecionada) {
    return (
      <ProdutosNotaView
        nota={notaSelecionada}
        onVoltar={() => setViewMode('produtos_pendentes')}
      />
    );
  }

  // TELA INICIAL DO MENU "NOTA PARA ALOCAÇÃO": Listar todos os produtos pendentes de alocação
  if (viewMode === 'produtos_pendentes') {
    return (
      <>
        {solicitandoPin && (
          <IdentificacaoOperacionalModal
            modulo="alocacao"
            onIdentificado={() => {
              setSolicitandoPin(false);
              if (produtoParaPin) {
                setProdutoSelecionadoParaAlocar(produtoParaPin);
                setProdutoParaPin(null);
              }
            }}
            onVoltar={() => {
              setSolicitandoPin(false);
              setProdutoParaPin(null);
            }}
            onInicio={() => {
              setSolicitandoPin(false);
              setProdutoParaPin(null);
            }}
          />
        )}
        <ProdutosPendentesAlocacaoView
          key={reloadKey}
          onSelecionarProduto={(p) => {
            if (!operador || operador.modulo !== 'alocacao') {
              setProdutoParaPin(p);
              setSolicitandoPin(true);
            } else {
              setProdutoSelecionadoParaAlocar(p);
            }
          }}
          onAlternarModoVisualizacao={() => {
            setViewMode('notas_para_alocar');
            if (!notasCarregadas) {
              carregarNotas();
            }
          }}
          onVoltar={() => setViewMode('menu_principal')}
        />
        {produtoSelecionadoParaAlocar && (
          <DetalheProdutoModal
            produto={produtoSelecionadoParaAlocar}
            onClose={() => setProdutoSelecionadoParaAlocar(null)}
            onProdutoAtualizado={() => {
              setProdutoSelecionadoParaAlocar(null);
              showToast('Alocação de estoque realizada com sucesso!');
              setReloadKey((k) => k + 1);
            }}
          />
        )}
      </>
    );
  }

  if (viewMode === 'notas_para_alocar') {
    return (
      <>
        {solicitandoPin && (
          <IdentificacaoOperacionalModal
            modulo="alocacao"
            onIdentificado={() => {
              setSolicitandoPin(false);
              if (notaParaAlocacao) {
                setNotaSelecionada(notaParaAlocacao);
                setViewMode('produtos_nota');
                setNotaParaAlocacao(null);
              }
            }}
            onVoltar={() => {
              setSolicitandoPin(false);
              setNotaParaAlocacao(null);
            }}
            onInicio={() => {
              setSolicitandoPin(false);
              setNotaParaAlocacao(null);
            }}
          />
        )}
        <ListaNotasView
          notas={notasEncontradas}
          loading={buscando}
          filtroDataInicial={filtroData}
          filtroNotaFiscalInicial={filtroNotaFiscal}
          onFiltrar={handleFiltrarNotas}
          onLimparFiltros={handleLimparFiltros}
          onSelecionarNota={(nota) => {
            // Solicita o PIN operacional após selecionar a NF para alocar
            setNotaParaAlocacao(nota);
            setSolicitandoPin(true);
          }}
          onVoltar={() => setViewMode('produtos_pendentes')}
        />
      </>
    );
  }

  // -------------------------------------------------------------
  // ENTRADA DO MENU: ALOCAR PRODUTOS (Visual Limpo e Organizado)
  // Exibe exclusivamente as três opções:
  // 1. Notas para alocar
  // 2. Alterar local
  // 3. Gerir alterações
  // -------------------------------------------------------------
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 md:pb-12 animate-in fade-in duration-200">
      {/* Modal para Trocar Operador */}
      {isTrocandoOperador && (
        <IdentificacaoOperacionalModal
          modulo="alocacao"
          onIdentificado={() => setIsTrocandoOperador(false)}
          onVoltar={() => setIsTrocandoOperador(false)}
          onInicio={() => {
            setIsTrocandoOperador(false);
            if (onVoltarParaHome) onVoltarParaHome();
          }}
        />
      )}

      {/* Toast Feedback */}
      {toastFeedback && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl bg-blue-600 text-white px-5 py-3 text-xs sm:text-sm font-semibold shadow-2xl border border-blue-400/40 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{toastFeedback}</span>
        </div>
      )}

      {/* Header do Módulo */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl relative overflow-hidden">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 flex items-center gap-1">
            <PackageCheck className="w-3.5 h-3.5" />
            Polifiltro Logística
          </span>
          <span className="text-xs text-slate-400">Fluxo de Armazenagem</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Alocar Produtos
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
          Controle produtos recebidos por notas fiscais e registre o endereço exato de armazenagem no estoque.
        </p>

        {/* Indicador de Operador */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          {operador && operador.modulo === 'alocacao' ? (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                Operador Alocação: <strong className="text-white">{operador.nome}</strong> ({operador.codigo})
              </span>
              <button
                type="button"
                onClick={() => setIsTrocandoOperador(true)}
                className="ml-2 text-[11px] font-bold text-amber-400 hover:text-amber-300 hover:underline cursor-pointer"
              >
                (Trocar)
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span>PIN operacional solicitado ao selecionar a NF para alocação</span>
            </div>
          )}
          <span className="text-[11px] px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-300 font-mono">
            Nível: {user?.nivel}
          </span>
        </div>
      </div>

      {/* Grid com Exclusivamente as 3 Opções Principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {/* Opção 1: Nota para alocação */}
        <button
          type="button"
          id="btn-opcao-notas-para-alocar"
          onClick={handleAbrirNotasParaAlocar}
          className="flex flex-col justify-between p-6 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-900 transition-all text-left group min-h-[190px] shadow-xl hover:-translate-y-1 active:scale-[0.99] cursor-pointer"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4 group-hover:scale-105 transition">
              <PackageCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-white group-hover:text-blue-400 transition">
              Nota para alocação
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Listagem de produtos pendentes de alocação por data, nota fiscal e registro de endereços físicos.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400 mt-5 group-hover:translate-x-1 transition">
            <span>Acessar produtos</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>

        {/* Opção 2: Alterar local */}
        <button
          type="button"
          id="btn-opcao-alterar-local"
          onClick={() => setIsAlterarLocalOpen(true)}
          className="flex flex-col justify-between p-6 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-900 transition-all text-left group min-h-[190px] shadow-xl hover:-translate-y-1 active:scale-[0.99] cursor-pointer"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-4 group-hover:scale-105 transition">
              <MapPin className="w-6 h-6" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-white group-hover:text-sky-400 transition">
              Alterar local
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Localizar produto direto no estoque e solicitar troca de endereço físico.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400 mt-5 group-hover:translate-x-1 transition">
            <span>Alterar endereço</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>

        {/* Opção 3: Gerir alterações */}
        <button
          type="button"
          id="btn-opcao-gerir-alteracoes"
          onClick={handleAbrirGerirAlteracoes}
          className="flex flex-col justify-between p-6 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-purple-500/50 hover:bg-slate-900 transition-all text-left group min-h-[190px] shadow-xl hover:-translate-y-1 active:scale-[0.99] cursor-pointer"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-105 transition">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-white group-hover:text-purple-400 transition">
              Gerir alterações
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Visualizar e gerir histórico de solicitações de alteração de endereço de estoque.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-purple-400 mt-5 group-hover:translate-x-1 transition">
            <span>Gerir solicitações</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>
      </div>

      {/* Cartão Informativo de Rastreabilidade */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 text-xs text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400 shrink-0" />
          <span>
            Fluxo ativo: <strong>Agendamentos → Recebimento → Produtos Recebidos → Alocação → Endereço</strong>
          </span>
        </div>
      </div>

      {/* Modal de "Alterar Local Diretamente" */}
      {isAlterarLocalOpen && (
        <AlterarLocalDiretoModal
          onClose={() => setIsAlterarLocalOpen(false)}
          onSuccess={() => {
            setIsAlterarLocalOpen(false);
            showToast('Solicitação de alteração de endereço registrada com sucesso!');
          }}
        />
      )}
    </div>
  );
};
