import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  PackageCheck,
  Calendar,
  FileText,
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Inbox,
  Layers,
  BarChart3,
} from 'lucide-react';
import { ResumoNotaRecebimento } from '../../types';
import { recebimentoService } from '../../services/recebimentoService';
import { DetalhesNotaView } from './DetalhesNotaView';
import { ListaProdutosConferenciaView } from './ListaProdutosConferenciaView';
import { IdentificacaoOperacionalModal } from '../common/IdentificacaoOperacionalModal';
import { useSessaoOperacional } from '../../context/SessaoOperacionalContext';
import { useUpdate } from '../../context/UpdateContext';
import { useAuth } from '../../context/AuthContext';
import { canUserOperarRecebimento, canUserAccessGraficosRecebimento } from '../../lib/permissions';
import { NFsRecebidasHistoricoView } from './NFsRecebidasHistoricoView';
import { AbaGraficosRecebimento } from './AbaGraficosRecebimento';

type AbaRecebimento = 'Abertas' | 'Conferidas' | 'NFs Recebidas' | 'Gráficos';

interface RecebimentoModuleProps {
  onNavegarParaAlocacao?: () => void;
  onVoltarParaHome?: () => void;
}

export const RecebimentoModule: React.FC<RecebimentoModuleProps> = ({
  onNavegarParaAlocacao,
  onVoltarParaHome,
}) => {
  const { user } = useAuth();
  const podeOperar = canUserOperarRecebimento(user);
  const podeAcessarGraficos = canUserAccessGraficosRecebimento(user);

  const { operador, limparSessaoOperacional } = useSessaoOperacional();
  const { marcarOperacaoAtiva } = useUpdate();
  const [isTrocandoOperador, setIsTrocandoOperador] = useState(false);
  const [solicitandoPin, setSolicitandoPin] = useState(false);

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

  const [notas, setNotas] = useState<ResumoNotaRecebimento[]>([]);
  const [loading, setLoading] = useState(true);

  // Obtém a data de hoje no fuso horário local da aplicação (formato YYYY-MM-DD para o banco)
  const getHojeLocalFormatado = (): string => {
    const d = new Date();
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  };

  // Filtro de status da lista principal:
  // - 'Abertas' e 'Conferidas' acessíveis SOMENTE para usuários do departamento Logística (e Gestores).
  // - Usuários Comercial e Financeiro iniciam e permanecem em 'NFs Recebidas' ou 'Gráficos' (Comercial/Logística).
  const [filtroAba, setFiltroAba] = useState<AbaRecebimento>(() => {
    return podeOperar ? 'Abertas' : 'NFs Recebidas';
  });

  // Flag para carregar os dados de "NFs Recebidas" sob demanda (botão verde)
  const [historicoCarregado, setHistoricoCarregado] = useState(false);

  // Sincroniza restrição de abas
  useEffect(() => {
    if (!podeOperar && filtroAba !== 'NFs Recebidas' && filtroAba !== 'Gráficos') {
      setFiltroAba('NFs Recebidas');
    }
    if (filtroAba === 'Gráficos' && !podeAcessarGraficos) {
      setFiltroAba('NFs Recebidas');
    }

    const verificarDispositivo = () => {
      if (typeof window !== 'undefined' && window.innerWidth < 1024 && filtroAba === 'Gráficos') {
        setFiltroAba(podeOperar ? 'Abertas' : 'NFs Recebidas');
      }
    };
    verificarDispositivo();
    window.addEventListener('resize', verificarDispositivo);
    return () => window.removeEventListener('resize', verificarDispositivo);
  }, [podeOperar, podeAcessarGraficos, filtroAba]);

  // Filtros adicionais - se abrir inicialmente em 'Conferidas', define a data de hoje
  const [filtroData, setFiltroData] = useState<string>(() => {
    return filtroAba === 'Conferidas' ? getHojeLocalFormatado() : '';
  });
  const [filtroNotaFiscal, setFiltroNotaFiscal] = useState<string>('');

  // Nota selecionada para visualização detalhada / conferência
  const [notaSelecionada, setNotaSelecionada] = useState<ResumoNotaRecebimento | null>(null);
  // Etapa do fluxo: 'detalhes' da nota ou 'produtos' (lista de conferência de produtos)
  const [etapaConferencia, setEtapaConferencia] = useState<'detalhes' | 'produtos'>('detalhes');

  // Protege a conferência de recebimento contra recarregamento inesperado
  useEffect(() => {
    const isAtivo = Boolean(notaSelecionada);
    marcarOperacaoAtiva(isAtivo, 'recebimento');
    return () => {
      marcarOperacaoAtiva(false, 'recebimento');
    };
  }, [notaSelecionada, marcarOperacaoAtiva]);

  const carregarNotas = useCallback(async () => {
    try {
      setLoading(true);
      const data = await recebimentoService.listarNotasParaRecebimento({
        dataRecebimento: filtroData || undefined,
        notaFiscal: filtroNotaFiscal || undefined,
      });
      setNotas(data);
    } catch (err) {
      console.error('Erro ao listar notas para recebimento:', err);
    } finally {
      setLoading(false);
    }
  }, [filtroData, filtroNotaFiscal]);

  useEffect(() => {
    if (podeOperar) {
      carregarNotas();
    } else {
      setLoading(false);
    }
  }, [podeOperar, carregarNotas]);

  const handleTrocarAba = (novaAba: AbaRecebimento) => {
    if (novaAba === 'NFs Recebidas') {
      setFiltroAba('NFs Recebidas');
      setHistoricoCarregado(false); // Sob demanda: mostra botão "Carregar dados"
    } else if (novaAba === 'Gráficos' && podeAcessarGraficos) {
      setFiltroAba('Gráficos');
    } else if (podeOperar) {
      if (novaAba === 'Conferidas') {
        // Ao abrir a aba Conferidas, definir automaticamente a data de recebimento inicial como a data de hoje
        setFiltroData(getHojeLocalFormatado());
      }
      setFiltroAba(novaAba);
    }
  };

  // Regra: Uma NF só é "Conferida" se TODOS os produtos estiverem conferidos corretamente, sem nenhuma pendência nem crítica
  const isNotaTotalmenteConferida = useCallback((n: ResumoNotaRecebimento): boolean => {
    return (
      n.status_geral === '100% Conferido' &&
      n.total_itens > 0 &&
      n.total_criticas === 0 &&
      n.total_conferidos === n.total_itens
    );
  }, []);

  // Ordenação da lista de notas fiscais:
  // 1. Notas abertas primeiro.
  // 2. Notas totalmente conferidas por último.
  // 3. Dentro de cada grupo, ordenação pela data de recebimento da mais recente para a mais antiga.
  const notasOrdenadas = useMemo(() => {
    return [...notas].sort((a, b) => {
      const aConferida = isNotaTotalmenteConferida(a);
      const bConferida = isNotaTotalmenteConferida(b);

      if (!aConferida && bConferida) return -1;
      if (aConferida && !bConferida) return 1;

      // Dentro de cada grupo, data mais recente primeiro
      return (b.data_recebimento || '').localeCompare(a.data_recebimento || '');
    });
  }, [notas, isNotaTotalmenteConferida]);

  // Filtragem pela aba ativa: Abertas vs Conferidas
  const notasExibidas = useMemo(() => {
    return notasOrdenadas.filter((nota) => {
      const conferida = isNotaTotalmenteConferida(nota);
      if (filtroAba === 'Abertas') {
        return !conferida;
      }
      return conferida;
    });
  }, [notasOrdenadas, filtroAba, isNotaTotalmenteConferida]);

  // Fluxo solicitado:
  // 1. Usuário acessa o menu Recebimentos (sem PIN).
  // 2. Usuário seleciona uma Nota Fiscal (sem PIN).
  // 3. Usuário entra na tela de detalhes/revisão da NF (sem PIN).
  // 4. Usuário clica no botão "Iniciar Conferência".
  // 5. SOMENTE NESTE MOMENTO solicitar o PIN.
  // 6. Após validar o PIN, iniciar a conferência.
  if (notaSelecionada) {
    if (etapaConferencia === 'detalhes') {
      return (
        <>
          {solicitandoPin && (
            <IdentificacaoOperacionalModal
              modulo="recebimento"
              onIdentificado={() => {
                setSolicitandoPin(false);
                setEtapaConferencia('produtos');
              }}
              onVoltar={() => setSolicitandoPin(false)}
              onInicio={() => setSolicitandoPin(false)}
            />
          )}
          <DetalhesNotaView
            nota={notaSelecionada}
            onVoltar={() => {
              setNotaSelecionada(null);
              carregarNotas();
            }}
            onIniciarConferencia={() => {
              // SOMENTE NESTE MOMENTO solicitar o PIN
              setSolicitandoPin(true);
            }}
            onIrParaAlocacao={onNavegarParaAlocacao}
            onNotaFinalizada={() => {
              setNotaSelecionada(null);
              setEtapaConferencia('detalhes');
              carregarNotas();
            }}
          />
        </>
      );
    }

    return (
      <>
        {isTrocandoOperador && (
          <IdentificacaoOperacionalModal
            modulo="recebimento"
            onIdentificado={() => setIsTrocandoOperador(false)}
            onVoltar={() => setIsTrocandoOperador(false)}
            onInicio={() => {
              setIsTrocandoOperador(false);
              if (onVoltarParaHome) onVoltarParaHome();
            }}
          />
        )}
        <ListaProdutosConferenciaView
          nota={notaSelecionada}
          onVoltar={() => setEtapaConferencia('detalhes')}
          onIrParaAlocacao={onNavegarParaAlocacao}
          onTrocarOperador={() => setIsTrocandoOperador(true)}
          onConcluir={() => {
            setEtapaConferencia('detalhes');
            carregarNotas();
          }}
          onNotaFinalizada={() => {
            setNotaSelecionada(null);
            setEtapaConferencia('detalhes');
            carregarNotas();
          }}
        />
      </>
    );
  }

  // Contagens
  const totalNotas = notas.length;
  const totalAbertas = notas.filter((n) => !isNotaTotalmenteConferida(n)).length;
  const totalConferidas = notas.filter((n) => isNotaTotalmenteConferida(n)).length;
  const totalCriticas = notas.filter((n) => n.total_criticas > 0).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24 md:pb-12 animate-in fade-in duration-200">
      {isTrocandoOperador && (
        <IdentificacaoOperacionalModal
          modulo="recebimento"
          onIdentificado={() => setIsTrocandoOperador(false)}
          onVoltar={() => setIsTrocandoOperador(false)}
          onInicio={() => {
            setIsTrocandoOperador(false);
            if (onVoltarParaHome) onVoltarParaHome();
          }}
        />
      )}

      {/* Header Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
              <PackageCheck className="w-3.5 h-3.5" />
              <span>Logística de Entrada</span>
            </span>
            <span className="text-xs text-slate-400">PoliHub Recebimento</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
            <span>Recebimento & Conferência</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Conferência cega das notas fiscais recebidas, validação de divergências e liberação para alocação.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {operador && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                Operador: <strong className="text-white">{operador.nome}</strong>
              </span>
              <button
                type="button"
                onClick={() => setIsTrocandoOperador(true)}
                className="ml-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 hover:underline"
              >
                (Trocar)
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={carregarNotas}
            disabled={loading}
            className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition min-h-[44px]"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* SELETOR DE ABAS DO MÓDULO RECEBIMENTOS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-lg">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Abas Operacionais: Abertas e Conferidas (Acessíveis SOMENTE para Logística) */}
          {podeOperar && (
            <>
              <button
                type="button"
                id="tab-recebimento-abertas"
                onClick={() => handleTrocarAba('Abertas')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs sm:text-sm font-black transition min-h-[48px] cursor-pointer ${
                  filtroAba === 'Abertas'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Abertas</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                    filtroAba === 'Abertas'
                      ? 'bg-blue-700/90 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {totalAbertas}
                </span>
              </button>

              <button
                type="button"
                id="tab-recebimento-conferidas"
                onClick={() => handleTrocarAba('Conferidas')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs sm:text-sm font-black transition min-h-[48px] cursor-pointer ${
                  filtroAba === 'Conferidas'
                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Conferidas</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                    filtroAba === 'Conferidas'
                      ? 'bg-emerald-600 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {totalConferidas}
                </span>
              </button>
            </>
          )}

          {/* NOVA ABA: "NFs Recebidas" — Visível e acessível para TODOS os usuários (incluindo Comercial e Financeiro) */}
          <button
            type="button"
            id="tab-recebimento-nfs-recebidas"
            onClick={() => handleTrocarAba('NFs Recebidas')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs sm:text-sm font-black transition min-h-[48px] cursor-pointer ${
              filtroAba === 'NFs Recebidas'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>NFs Recebidas</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                filtroAba === 'NFs Recebidas'
                  ? 'bg-sky-700/90 text-white'
                  : 'bg-slate-800 text-sky-400'
              }`}
            >
              Histórico
            </span>
          </button>

          {/* NOVA ABA: "Gráficos" — Visível SOMENTE na versão para computador para Comercial e Logística */}
          {podeAcessarGraficos && (
            <button
              type="button"
              id="tab-recebimento-graficos"
              onClick={() => handleTrocarAba('Gráficos')}
              className={`hidden lg:flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs sm:text-sm font-black transition min-h-[48px] cursor-pointer ${
                filtroAba === 'Gráficos'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Gráficos</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  filtroAba === 'Gráficos'
                    ? 'bg-emerald-700/90 text-white'
                    : 'bg-slate-800 text-emerald-400'
                }`}
              >
                Analítico
              </span>
            </button>
          )}
        </div>

        {filtroAba === 'Gráficos' ? (
          <div className="hidden lg:flex px-3 py-1 text-xs text-slate-400 items-center gap-2">
            <span className="text-[11px] bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-xl text-emerald-300 font-semibold">
              Painel Analítico Comercial & Logística
            </span>
          </div>
        ) : podeOperar && filtroAba !== 'NFs Recebidas' ? (
          <div className="flex items-center gap-3 px-3 py-1 text-xs text-slate-400">
            <span>
              Total geral: <strong className="text-white font-mono">{totalNotas} NFs</strong>
            </span>
            {totalCriticas > 0 && (
              <span className="text-rose-400 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {totalCriticas} com crítica
              </span>
            )}
          </div>
        ) : (
          <div className="px-3 py-1 text-xs text-slate-400 flex items-center gap-2">
            <span className="text-[11px] bg-slate-800 px-2.5 py-1 rounded-xl text-slate-300">
              {podeOperar ? 'Histórico Geral de Recebimentos' : 'Consulta Comercial/Financeiro'}
            </span>
          </div>
        )}
      </div>

      {/* Renderização Condicional: Gráficos (somente computador) vs Histórico de NFs Recebidas vs Abas Operacionais */}
      {filtroAba === 'Gráficos' ? (
        <div className="hidden lg:block">
          <AbaGraficosRecebimento />
        </div>
      ) : filtroAba === 'NFs Recebidas' ? (
        <NFsRecebidasHistoricoView autoCarregar={historicoCarregado} />
      ) : (
        <>
          {/* Barra de Filtros (Data do Recebimento e Busca por Nota Fiscal) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
          <Filter className="w-4 h-4 text-emerald-400" />
          <span>Filtros de Busca</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Data do Recebimento */}
          <div className="sm:col-span-4">
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Data do Recebimento
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={filtroData}
                onChange={(e) => setFiltroData(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-emerald-500 transition min-h-[44px]"
              />
            </div>
          </div>

          {/* Busca por Nota Fiscal */}
          <div className="sm:col-span-6">
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Nota Fiscal (Número ou Trecho)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Ex: 001.993.520 ou 1042..."
                value={filtroNotaFiscal}
                onChange={(e) => setFiltroNotaFiscal(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 transition min-h-[44px]"
              />
            </div>
          </div>

          {/* Botão Limpar */}
          <div className="sm:col-span-2 flex items-end">
            <button
              type="button"
              onClick={() => {
                setFiltroData('');
                setFiltroNotaFiscal('');
              }}
              className="w-full px-3 py-2.5 rounded-2xl border border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition min-h-[44px]"
            >
              Limpar
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Notas Fiscais para Conferência */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Notas Fiscais {filtroAba === 'Abertas' ? 'Abertas' : 'Conferidas'} ({notasExibidas.length})
          </span>
          <span className="text-[11px] text-slate-500">
            Toque na nota para abrir a lista de produtos da conferência cega
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-3xl space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Buscando notas fiscais recebidas...</p>
          </div>
        ) : notasExibidas.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-3xl space-y-3">
            <Inbox className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-300">
              Nenhuma nota fiscal {filtroAba === 'Abertas' ? 'aberta' : 'totalmente conferida'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {filtroAba === 'Abertas'
                ? 'Todas as notas recebidas já foram conferidas com sucesso.'
                : 'Ainda não há notas totalmente conferidas sem pendências ou críticas.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {notasExibidas.map((nota) => {
              const status = nota.status_geral;
              const is100 = isNotaTotalmenteConferida(nota);
              const isCritica = nota.total_criticas > 0;
              const isEmAndamento = !is100 && nota.total_conferidos > 0;

              return (
                <div
                  key={nota.nota_fiscal}
                  onClick={() => {
                    setNotaSelecionada(nota);
                    setEtapaConferencia('detalhes');
                  }}
                  className="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    {/* Linha Superior: NF e Status Geral */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-slate-800 group-hover:bg-emerald-500/20 text-slate-400 group-hover:text-emerald-400 flex items-center justify-center transition shrink-0">
                          <FileText className="w-4 h-4" />
                        </span>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Nota Fiscal
                          </span>
                          <span className="text-base font-black font-mono text-white">
                            {nota.nota_fiscal}
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-xl flex items-center gap-1.5 ${
                          isCritica
                            ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                            : is100
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : isEmAndamento
                            ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {isCritica ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        ) : is100 ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-blue-400" />
                        )}
                        <span>{is100 ? '100% Conferida' : status}</span>
                      </span>
                    </div>

                    {/* Dados do Fornecedor e Data */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/80">
                        <span className="text-[10px] text-slate-500 block uppercase font-bold">
                          Fornecedor
                        </span>
                        <span className="font-semibold text-slate-200 truncate block mt-0.5">
                          {nota.fornecedor}
                        </span>
                      </div>

                      <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/80">
                        <span className="text-[10px] text-slate-500 block uppercase font-bold">
                          Data de Recebimento
                        </span>
                        <span className="font-mono font-semibold text-slate-200 block mt-0.5">
                          {nota.data_recebimento}
                        </span>
                      </div>
                    </div>

                    {/* Resumo de SKUs e Quantidades */}
                    <div className="flex items-center justify-between text-xs text-slate-400 px-1 pt-1">
                      <span>
                        Produtos: <strong className="text-white font-mono">{nota.total_itens} SKUs</strong>
                      </span>
                      <span>
                        Conferidos:{' '}
                        <strong className="text-emerald-400 font-mono">
                          {nota.total_conferidos} / {nota.total_itens}
                        </strong>
                      </span>
                    </div>

                    {/* Barra de Progresso */}
                    <div className="space-y-1">
                      <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isCritica
                              ? 'bg-rose-500'
                              : is100
                              ? 'bg-emerald-500'
                              : 'bg-blue-500'
                          }`}
                          style={{ width: `${nota.porcentagem_conferencia}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Ação Inferior */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400 group-hover:text-slate-300 transition">
                      Ver detalhes da nota fiscal
                    </span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition">
                      <span>Ver Detalhes</span>
                      <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  )}
</div>
);
};
