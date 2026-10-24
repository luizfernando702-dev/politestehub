import React, { useState, useEffect } from 'react';
import {
  X,
  Package,
  Minus,
  Plus,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Building2,
  MapPin,
  ArrowRight,
  RefreshCw,
  Edit3,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { ItemConferenciaCega, RecebimentoProduto, ResultadoConferencia } from '../../types';
import { recebimentoService } from '../../services/recebimentoService';
import { useAuth } from '../../context/AuthContext';

interface ConferenciaCegaModalProps {
  notaFiscal: string;
  fornecedor: string;
  dataRecebimento: string;
  onClose: () => void;
  onConcluido: () => void;
  onIrParaAlocacao?: () => void;
}

type EtapaConferencia = 'CONTAGEM' | 'FEEDBACK_SUCESSO' | 'FEEDBACK_DIVERGENCIA' | 'FINALIZADO';

export const ConferenciaCegaModal: React.FC<ConferenciaCegaModalProps> = ({
  notaFiscal,
  fornecedor,
  dataRecebimento,
  onClose,
  onConcluido,
  onIrParaAlocacao,
}) => {
  const { user } = useAuth();

  const [itens, setItens] = useState<ItemConferenciaCega[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Valor da contagem cega
  const [qtdConferida, setQtdConferida] = useState<number>(0);
  const [registrando, setRegistrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Controle de estado e feedback
  const [etapa, setEtapa] = useState<EtapaConferencia>('CONTAGEM');
  const [ultimoResultado, setUltimoResultado] = useState<ResultadoConferencia | null>(null);
  const [resumoFinal, setResumoFinal] = useState<{
    totalItens: number;
    conferidos: number;
    criticas: number;
  }>({ totalItens: 0, conferidos: 0, criticas: 0 });

  // Carregar lista de itens da nota fiscal para conferência
  useEffect(() => {
    async function carregarFila() {
      try {
        setLoading(true);
        const lista = await recebimentoService.listarItensParaConferenciaCega(notaFiscal);
        setItens(lista);

        // Encontrar primeiro produto pendente de conferência (status 'Recebido')
        const primeiroPendente = lista.findIndex((i) => i.status === 'Recebido');
        if (primeiroPendente !== -1) {
          setCurrentIndex(primeiroPendente);
        } else {
          setCurrentIndex(0);
        }
      } catch (err) {
        console.error('Erro ao carregar fila de conferência:', err);
        setErro('Falha ao carregar itens da nota fiscal.');
      } finally {
        setLoading(false);
      }
    }
    carregarFila();
  }, [notaFiscal]);

  const itemAtual = itens[currentIndex];

  const handleIncrement = () => {
    setQtdConferida((prev) => prev + 1);
  };

  const handleDecrement = () => {
    setQtdConferida((prev) => Math.max(0, prev - 1));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setQtdConferida(isNaN(val) || val < 0 ? 0 : val);
  };

  // 1. Ao clicar em Registrar: valida no backend/service sem expor a quantidade esperada antes
  const handleRegistrar = async () => {
    if (!itemAtual) return;
    if (qtdConferida < 0) {
      setErro('Informe uma quantidade válida.');
      return;
    }

    try {
      setRegistrando(true);
      setErro(null);

      const res = await recebimentoService.registrarConferenciaItem({
        produtoId: itemAtual.id,
        qtdConferida,
        usuarioId: user?.id || 'usr-default-01',
        usuarioNome: user?.nome,
      });

      if (!res.success) {
        setErro(res.error || 'Erro ao registrar conferência do item.');
        return;
      }

      setUltimoResultado(res.resultado);

      // Atualiza o status do item na lista local
      setItens((prev) =>
        prev.map((it, idx) => (idx === currentIndex ? { ...it, status: res.status } : it))
      );

      // Navega para a tela de feedback conforme regra
      if (res.resultado === 'IGUAL') {
        // TELA VERDE
        setEtapa('FEEDBACK_SUCESSO');
      } else {
        // TELA VERMELHA (MENOR ou MAIOR)
        setEtapa('FEEDBACK_DIVERGENCIA');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar conferência.';
      setErro(msg);
    } finally {
      setRegistrando(false);
    }
  };

  // 2. Avançar para o próximo produto pendente
  const handleAvancarProximo = () => {
    // Procura o próximo produto pendente a partir do índice atual
    const proximoPendente = itens.findIndex((it, idx) => idx > currentIndex && it.status === 'Recebido');

    if (proximoPendente !== -1) {
      setCurrentIndex(proximoPendente);
      setQtdConferida(0);
      setEtapa('CONTAGEM');
    } else {
      // Verifica se restou algum pendente anterior
      const outroPendente = itens.findIndex((it) => it.status === 'Recebido');
      if (outroPendente !== -1) {
        setCurrentIndex(outroPendente);
        setQtdConferida(0);
        setEtapa('CONTAGEM');
      } else {
        // Todos os itens foram finalizados!
        finalizarConferencia();
      }
    }
  };

  // 3. Usuário clica em 'Editar' na tela de feedback (verde ou vermelha)
  const handleEditar = () => {
    setEtapa('CONTAGEM');
  };

  // 4. Usuário confirma a 'Crítica' na tela vermelha
  const handleConfirmarCritica = () => {
    // Já foi salvo como 'Crítica' no banco durante o registrar, então avança
    handleAvancarProximo();
  };

  // 5. Finalizar conferência de todos os itens
  const finalizarConferencia = async () => {
    const produtosAtualizados = await recebimentoService.listarProdutosDaNota(notaFiscal);
    const conferidos = produtosAtualizados.filter((p) => p.status === 'Conferido').length;
    const criticas = produtosAtualizados.filter((p) => p.status === 'Crítica').length;

    setResumoFinal({
      totalItens: produtosAtualizados.length,
      conferidos,
      criticas,
    });
    setEtapa('FINALIZADO');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                  Conferência Cega
                </span>
                <span className="text-xs text-slate-400 font-mono">NF {notaFiscal}</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5">
                {etapa === 'FINALIZADO'
                  ? 'Conferência da Nota Concluída'
                  : `Item ${currentIndex + 1} de ${itens.length}`}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onConcluido();
              onClose();
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition min-h-[44px]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {loading ? (
            <div className="p-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Carregando itens da conferência cega...</p>
            </div>
          ) : etapa === 'FINALIZADO' ? (
            /* TELA FINAL DE CONCLUSÃO */
            <div className="text-center py-4 space-y-5">
              {resumoFinal.criticas === 0 ? (
                <div className="space-y-3">
                  <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/10">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  <h4 className="text-lg sm:text-xl font-black text-white">
                    Todos os itens foram conferidos.
                  </h4>
                  <p className="text-xs sm:text-sm text-emerald-300/90 max-w-sm mx-auto leading-relaxed bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl">
                    Os produtos já estão liberados com status <strong>Conferido</strong> e podem ser
                    alocados nos seus respectivos endereços.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-16 h-16 rounded-3xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-xl shadow-rose-500/10">
                    <AlertTriangle className="w-9 h-9" />
                  </div>
                  <h4 className="text-lg sm:text-xl font-black text-white">
                    A conferência possui itens em crítica.
                  </h4>
                  <p className="text-xs sm:text-sm text-rose-300/90 max-w-sm mx-auto leading-relaxed bg-rose-500/10 border border-rose-500/20 p-3 rounded-2xl">
                    Verifique as divergências antes da alocação. Os itens com crítica não são
                    exibidos para alocação até sua regularização.
                  </p>
                </div>
              )}

              {/* Estatísticas Finais */}
              <div className="grid grid-cols-3 gap-2 text-center pt-2">
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Itens</span>
                  <span className="text-lg font-black font-mono text-white">{resumoFinal.totalItens}</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Conferidos</span>
                  <span className="text-lg font-black font-mono text-emerald-400">{resumoFinal.conferidos}</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Em Crítica</span>
                  <span className={`text-lg font-black font-mono ${resumoFinal.criticas > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                    {resumoFinal.criticas}
                  </span>
                </div>
              </div>

              {/* Botões de Ação na Finalização */}
              <div className="pt-3 space-y-2">
                {resumoFinal.criticas === 0 && onIrParaAlocacao && (
                  <button
                    type="button"
                    onClick={() => {
                      onConcluido();
                      onClose();
                      onIrParaAlocacao();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition min-h-[48px]"
                  >
                    <span>Ir para Módulo Alocação</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onConcluido();
                    onClose();
                  }}
                  className="w-full px-5 py-2.5 rounded-2xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-semibold text-xs transition min-h-[44px]"
                >
                  Fechar Conferência
                </button>
              </div>
            </div>
          ) : etapa === 'FEEDBACK_SUCESSO' ? (
            /* TELA VERDE — CONFERÊNCIA COM SUCESSO (IGUAL À NOTA FISCAL) */
            <div className="text-center py-6 space-y-5 animate-in zoom-in-95 duration-200">
              <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/25">
                <CheckCircle2 className="w-11 h-11 animate-in bounce-in" />
              </div>

              <div className="space-y-1">
                <h4 className="text-xl font-black text-white">
                  Conferência do produto realizada com sucesso.
                </h4>
                <p className="text-xs text-emerald-400 font-medium">
                  A quantidade física bate perfeitamente com o fiscal.
                </p>
              </div>

              <div className="bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-4 text-left space-y-2">
                <div className="text-xs text-slate-400">
                  Produto: <strong className="text-white">{itemAtual?.produto}</strong>
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  Quantidade Confirmada: <strong className="text-emerald-400 font-bold">{qtdConferida} un</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3">
                <button
                  type="button"
                  onClick={handleEditar}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700 min-h-[48px]"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Editar Contagem</span>
                </button>

                <button
                  type="button"
                  onClick={handleAvancarProximo}
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/30 transition min-h-[48px]"
                >
                  <span>Próximo Produto</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : etapa === 'FEEDBACK_DIVERGENCIA' ? (
            /* TELA VERMELHA — QUANTIDADE MENOR OU MAIOR */
            <div className="text-center py-6 space-y-5 animate-in zoom-in-95 duration-200">
              <div className="w-20 h-20 rounded-3xl bg-rose-500/20 border-2 border-rose-500 text-rose-400 flex items-center justify-center mx-auto shadow-2xl shadow-rose-500/25">
                <AlertTriangle className="w-11 h-11" />
              </div>

              <div className="space-y-1">
                <h4 className="text-xl font-black text-white">
                  {ultimoResultado === 'MENOR'
                    ? 'Quantidade menor que a nota fiscal.'
                    : 'Quantidade maior que a nota fiscal.'}
                </h4>
                <p className="text-xs text-rose-300 font-medium">
                  Foi identificada divergência física em relação aos registros fiscais.
                </p>
              </div>

              <div className="bg-slate-950/80 border border-rose-500/30 rounded-2xl p-4 text-left space-y-2">
                <div className="text-xs text-slate-400">
                  Produto: <strong className="text-white">{itemAtual?.produto}</strong>
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  Quantidade Contada: <strong className="text-rose-400 font-bold">{qtdConferida} un</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3">
                <button
                  type="button"
                  onClick={handleEditar}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700 min-h-[48px]"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Editar / Recontar</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmarCritica}
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-600/30 transition min-h-[48px]"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Confirmar Crítica</span>
                </button>
              </div>
            </div>
          ) : (
            /* TELA PADRÃO DE CONTAGEM CEGA (NUNCA EXIBE A QUANTIDADE ESPERADA DA NOTA) */
            <div className="space-y-5">
              {erro && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{erro}</span>
                </div>
              )}

              {/* Informações Visuais do Produto (Sem Quantidade da NF) */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Produto em Conferência
                  </span>
                  <h4 className="text-base sm:text-lg font-bold text-white leading-snug break-words">
                    {itemAtual?.produto || '—'}
                  </h4>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-slate-800/80 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Fornecedor</span>
                    <span className="font-semibold text-slate-300 truncate block">
                      {fornecedor || itemAtual?.fornecedor || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Nota Fiscal</span>
                    <span className="font-mono font-bold text-emerald-400 block">
                      {notaFiscal}
                    </span>
                  </div>

                  {itemAtual?.endereco_original && (
                    <div className="col-span-2 pt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span>Endereço de Referência: <strong className="text-sky-300 font-mono">{itemAtual.endereco_original}</strong></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Entrada da Quantidade Conferida (Contador com - / + e Teclado Numérico) */}
              <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-5 text-center space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Quantidade Conferida (Contagem Física)
                </span>

                <div className="flex items-center justify-center gap-3 max-w-xs mx-auto">
                  <button
                    type="button"
                    onClick={handleDecrement}
                    className="w-14 h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white flex items-center justify-center border border-slate-700 transition select-none min-h-[48px]"
                    aria-label="Diminuir quantidade"
                  >
                    <Minus className="w-6 h-6" />
                  </button>

                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={qtdConferida}
                    onChange={handleInputChange}
                    className="w-28 h-14 bg-slate-900 border-2 border-slate-700 focus:border-blue-500 text-center text-2xl sm:text-3xl font-black font-mono text-white rounded-2xl focus:outline-hidden transition"
                  />

                  <button
                    type="button"
                    onClick={handleIncrement}
                    className="w-14 h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white flex items-center justify-center border border-slate-700 transition select-none min-h-[48px]"
                    aria-label="Aumentar quantidade"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>

                <p className="text-[11px] text-slate-500">
                  Insira a quantidade física real verificada nos volumes/paletes.
                </p>
              </div>

              {/* Botão Registrar */}
              <button
                type="button"
                onClick={handleRegistrar}
                disabled={registrando}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm shadow-xl shadow-blue-600/30 transition active:scale-[0.98] min-h-[50px] cursor-pointer"
              >
                {registrando ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Validando conferência...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Registrar Contagem</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
