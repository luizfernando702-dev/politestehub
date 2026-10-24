import React, { useState } from 'react';
import {
  X,
  Package,
  Minus,
  Plus,
  CheckCircle2,
  AlertTriangle,
  FileText,
  MapPin,
  RefreshCw,
  Edit3,
  ShieldAlert,
  ArrowLeft,
} from 'lucide-react';
import { RecebimentoProduto, RecebimentoStatus, ResultadoConferencia } from '../../types';
import { recebimentoService } from '../../services/recebimentoService';
import { useAuth } from '../../context/AuthContext';
import { useSessaoOperacional } from '../../context/SessaoOperacionalContext';

interface ConferenciaProdutoModalProps {
  produto: RecebimentoProduto;
  notaFiscal: string;
  fornecedor: string;
  onClose: () => void;
  onConferenciaConcluida: (atualizado: {
    id: string | number;
    status: RecebimentoStatus;
    qtdConferida: number;
    resultado: ResultadoConferencia;
    conferenteId?: string;
    conferenteNome?: string;
  }) => void;
}

type Etapa = 'CONTAGEM' | 'RESULTADO';

export const ConferenciaProdutoModal: React.FC<ConferenciaProdutoModalProps> = ({
  produto,
  notaFiscal,
  fornecedor,
  onClose,
  onConferenciaConcluida,
}) => {
  const { user } = useAuth();
  const { operador } = useSessaoOperacional();

  const [qtdInformada, setQtdInformada] = useState<number>(
    produto.qtd_conferida !== null && produto.qtd_conferida !== undefined
      ? produto.qtd_conferida
      : 0
  );
  const [validando, setValidando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Etapas: entrada da contagem ou tela de resultado
  const [etapa, setEtapa] = useState<Etapa>('CONTAGEM');
  const [resultado, setResultado] = useState<ResultadoConferencia | null>(null);
  const [novoStatus, setNovoStatus] = useState<RecebimentoStatus | null>(null);

  const handleIncrement = () => {
    setQtdInformada((prev) => prev + 1);
  };

  const handleDecrement = () => {
    setQtdInformada((prev) => Math.max(0, prev - 1));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setQtdInformada(isNaN(val) || val < 0 ? 0 : val);
  };

  // Clique no botão VALIDAR:
  // Somente depois da validação o sistema compara internamente a quantidade informada
  // com a quantidade da tabela recebimentos_produtos.
  const handleValidar = async () => {
    if (qtdInformada < 0) {
      setErro('Informe uma quantidade válida maior ou igual a zero.');
      return;
    }

    try {
      setValidando(true);
      setErro(null);

      const usuarioIdOperacional = operador?.id || user?.id || 'usr-default-01';
      const usuarioNomeOperacional = operador?.nome || user?.nome || 'Operador';

      const res = await recebimentoService.registrarConferenciaItem({
        produtoId: produto.id,
        qtdConferida: qtdInformada,
        usuarioId: usuarioIdOperacional,
        usuarioNome: usuarioNomeOperacional,
      });

      if (!res.success) {
        setErro(res.error || 'Erro ao registrar conferência.');
        return;
      }

      setResultado(res.resultado);
      setNovoStatus(res.status);
      setEtapa('RESULTADO');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar conferência.';
      setErro(msg);
    } finally {
      setValidando(false);
    }
  };

  // Retorna para a lista de produtos comunicando a atualização do item
  const handleVoltarParaLista = () => {
    if (resultado && novoStatus) {
      onConferenciaConcluida({
        id: produto.id,
        status: novoStatus,
        qtdConferida: qtdInformada,
        resultado,
        conferenteId: operador?.id || user?.id,
        conferenteNome: operador?.nome || user?.nome,
      });
    }
    onClose();
  };

  // Permite ao usuário editar/recontar a quantidade caso deseje
  const handleRecontar = () => {
    setEtapa('CONTAGEM');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
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
                {etapa === 'RESULTADO' ? 'Resultado da Conferência' : 'Conferir Produto'}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={etapa === 'RESULTADO' ? handleVoltarParaLista : onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition min-h-[44px]"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          {etapa === 'RESULTADO' ? (
            /* ========================================================
               TELA DE RESULTADO DA CONFERÊNCIA
               ======================================================== */
            resultado === 'IGUAL' ? (
              /* QUANDO A QUANTIDADE ESTIVER CORRETA (SUCESSO) */
              <div className="text-center py-4 space-y-5 animate-in zoom-in-95 duration-200">
                <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/25">
                  <CheckCircle2 className="w-11 h-11" />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 inline-block">
                    Conferido com Sucesso
                  </span>
                  <h4 className="text-xl font-black text-white">
                    CONFERÊNCIA REALIZADA COM SUCESSO
                  </h4>
                  <p className="text-xs sm:text-sm text-emerald-300 font-medium max-w-sm mx-auto">
                    A quantidade informada corresponde perfeitamente à quantidade esperada da nota fiscal.
                  </p>
                </div>

                <div className="bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-4 text-left space-y-2">
                  <div className="text-xs text-slate-400">
                    Produto: <strong className="text-white block sm:inline mt-0.5 sm:mt-0">{produto.produto}</strong>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    Quantidade Registrada: <strong className="text-emerald-400 font-bold text-sm">{qtdInformada} un</strong>
                  </div>
                </div>

                {/* Botão de retorno para a lista de produtos (não pula automaticamente para outro produto) */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleVoltarParaLista}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-emerald-500/25 transition min-h-[48px]"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Voltar para a Lista de Produtos</span>
                  </button>
                </div>
              </div>
            ) : resultado === 'MENOR' ? (
              /* QUANDO A QUANTIDADE FOR MENOR (CRÍTICA) */
              <div className="text-center py-4 space-y-5 animate-in zoom-in-95 duration-200">
                <div className="w-20 h-20 rounded-3xl bg-rose-500/20 border-2 border-rose-500 text-rose-400 flex items-center justify-center mx-auto shadow-2xl shadow-rose-500/25">
                  <AlertTriangle className="w-11 h-11" />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20 inline-block">
                    Divergência / Crítica
                  </span>
                  <h4 className="text-xl font-black text-white">
                    Quantidade menor que a nota fiscal.
                  </h4>
                  <p className="text-xs sm:text-sm text-rose-300 font-medium max-w-sm mx-auto">
                    Foi identificada divergência física (quantidade inferior à nota fiscal). O item foi classificado como <strong>Crítica</strong>.
                  </p>
                </div>

                <div className="bg-slate-950/80 border border-rose-500/30 rounded-2xl p-4 text-left space-y-2">
                  <div className="text-xs text-slate-400">
                    Produto: <strong className="text-white block sm:inline mt-0.5 sm:mt-0">{produto.produto}</strong>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    Quantidade Física Informada: <strong className="text-rose-400 font-bold text-sm">{qtdInformada} un</strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleRecontar}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700 min-h-[48px]"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Recontar / Corrigir</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleVoltarParaLista}
                    className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-600/30 transition min-h-[48px]"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Confirmar e Voltar</span>
                  </button>
                </div>
              </div>
            ) : (
              /* QUANDO A QUANTIDADE FOR MAIOR (CRÍTICA) */
              <div className="text-center py-4 space-y-5 animate-in zoom-in-95 duration-200">
                <div className="w-20 h-20 rounded-3xl bg-rose-500/20 border-2 border-rose-500 text-rose-400 flex items-center justify-center mx-auto shadow-2xl shadow-rose-500/25">
                  <AlertTriangle className="w-11 h-11" />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20 inline-block">
                    Divergência / Crítica
                  </span>
                  <h4 className="text-xl font-black text-white">
                    Quantidade maior que a nota fiscal.
                  </h4>
                  <p className="text-xs sm:text-sm text-rose-300 font-medium max-w-sm mx-auto">
                    Foi identificada divergência física (quantidade superior à nota fiscal). O item foi classificado como <strong>Crítica</strong>.
                  </p>
                </div>

                <div className="bg-slate-950/80 border border-rose-500/30 rounded-2xl p-4 text-left space-y-2">
                  <div className="text-xs text-slate-400">
                    Produto: <strong className="text-white block sm:inline mt-0.5 sm:mt-0">{produto.produto}</strong>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    Quantidade Física Informada: <strong className="text-rose-400 font-bold text-sm">{qtdInformada} un</strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleRecontar}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700 min-h-[48px]"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Recontar / Corrigir</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleVoltarParaLista}
                    className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-600/30 transition min-h-[48px]"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Confirmar e Voltar</span>
                  </button>
                </div>
              </div>
            )
          ) : (
            /* ========================================================
               TELA DE ENTRADA DA CONTAGEM CEGA
               Regra: A quantidade esperada da NF NÃO deve aparecer.
               ======================================================== */
            <div className="space-y-5">
              {erro && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{erro}</span>
                </div>
              )}

              {/* Informações Claras do Produto (Sem Quantidade Esperada) */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Produto em Conferência
                  </span>
                  <h4 className="text-base sm:text-lg font-bold text-white leading-snug break-words">
                    {produto.produto}
                  </h4>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-slate-800/80 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Fornecedor</span>
                    <span className="font-semibold text-slate-300 truncate block">
                      {fornecedor || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Nota Fiscal</span>
                    <span className="font-mono font-bold text-emerald-400 block">
                      {notaFiscal}
                    </span>
                  </div>

                  {produto.endereco && (
                    <div className="col-span-2 pt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span>
                        Endereço de Referência: <strong className="text-sky-300 font-mono">{produto.endereco}</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Campo Numérico para Informar Quantidade Física (Teclado Numérico Celular) */}
              <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-5 text-center space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Informe a Quantidade Física Encontrada
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
                    value={qtdInformada}
                    onChange={handleInputChange}
                    className="w-28 h-14 bg-slate-900 border-2 border-slate-700 focus:border-blue-500 text-center text-2xl sm:text-3xl font-black font-mono text-white rounded-2xl focus:outline-hidden transition"
                    aria-label="Quantidade física"
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
                  Insira a contagem física cega. O sistema validará internamente com o fiscal.
                </p>
              </div>

              {/* Botão VALIDAR */}
              <button
                type="button"
                onClick={handleValidar}
                disabled={validando}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm shadow-xl shadow-blue-600/30 transition active:scale-[0.98] min-h-[50px] cursor-pointer"
              >
                {validando ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Validando conferência...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>VALIDAR</span>
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
