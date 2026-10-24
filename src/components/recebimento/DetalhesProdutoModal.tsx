import React, { useState } from 'react';
import {
  X,
  Package,
  Eye,
  EyeOff,
  MapPin,
  Building2,
  FileText,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Play,
  ShieldAlert,
  AlertOctagon,
  Printer,
} from 'lucide-react';
import { RecebimentoProduto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { isUserGestor } from '../../lib/permissions';
import { recebimentoService } from '../../services/recebimentoService';
import { ConfirmacaoExcepcionalModal } from './ConfirmacaoExcepcionalModal';
import { ConfiguracaoEtiquetaAvariaModal } from '../impressao/ConfiguracaoEtiquetaAvariaModal';

interface DetalhesProdutoModalProps {
  produto: RecebimentoProduto;
  notaFiscal: string;
  fornecedor: string;
  dataRecebimento?: string;
  onClose: () => void;
  onIniciarConferencia?: (produto: RecebimentoProduto) => void;
  onProdutoValidado?: (produtoAtualizado: RecebimentoProduto) => void;
}

export const DetalhesProdutoModal: React.FC<DetalhesProdutoModalProps> = ({
  produto,
  notaFiscal,
  fornecedor,
  dataRecebimento,
  onClose,
  onIniciarConferencia,
  onProdutoValidado,
}) => {
  const { user } = useAuth();
  const isGestor = isUserGestor(user);

  // A quantidade esperada da NF NUNCA aparece automaticamente
  const [mostrarQtdEsperada, setMostrarQtdEsperada] = useState(false);

  // Estados para validação excepcional (Gestor)
  const [modalValidarAberto, setModalValidarAberto] = useState(false);
  const [modalEtiquetaAvariaAberto, setModalEtiquetaAvariaAberto] = useState(false);
  const [validando, setValidando] = useState(false);
  const [erroValidar, setErroValidar] = useState<string | null>(null);
  const [sucessoValidar, setSucessoValidar] = useState<string | null>(null);
  const [alertaMensagem, setAlertaMensagem] = useState<string | null>(null);

  const status = produto.status || 'Recebido';
  const isValidado = status === 'Validado';
  const isConferido = status === 'Conferido' || status === 'Alocado' || isValidado;
  const isCritica = status === 'Crítica';
  const isPendente = status === 'Recebido';
  const isJaValidado = isValidado || status === 'Alocado';

  const handleAbrirValidar = () => {
    setAlertaMensagem(null);
    setErroValidar(null);
    if (isJaValidado) {
      setAlertaMensagem('Este produto já foi validado e está disponível para alocação.');
      return;
    }
    setModalValidarAberto(true);
  };

  const handleConfirmarValidar = async () => {
    try {
      setValidando(true);
      setErroValidar(null);
      const res = await recebimentoService.validarProdutoIndividualExcepcional(produto.id);

      setSucessoValidar(res.message);
      setModalValidarAberto(false);

      if (onProdutoValidado) {
        onProdutoValidado(res.produto);
      }

      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      console.error('Erro ao validar produto individual:', err);
      setErroValidar(err.message || 'Erro ao validar produto.');
    } finally {
      setValidando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Detalhes do Produto
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5">
                Informações da Carga
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão de Impressão de Etiqueta Zebra de Avaria (Exibido SOMENTE quando com status de Crítica) */}
            {isCritica && (
              <button
                type="button"
                onClick={() => setModalEtiquetaAvariaAberto(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold transition shadow-sm"
                title="Imprimir Etiqueta Zebra de Avaria (10x5 cm)"
              >
                <Printer className="w-4 h-4 text-rose-400" />
                <span className="hidden sm:inline">Etiqueta Avaria</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition min-h-[44px]"
              aria-label="Fechar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Identificação do Produto */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Descrição do Produto
            </span>
            <h4 className="text-base sm:text-lg font-bold text-white leading-snug break-words">
              {produto.produto}
            </h4>
          </div>

          {/* Grid de Metadados: NF, Fornecedor, Endereço */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3">
              <span className="text-[10px] text-slate-500 uppercase font-bold block flex items-center gap-1">
                <FileText className="w-3 h-3 text-emerald-400" />
                Nota Fiscal
              </span>
              <span className="font-mono font-bold text-emerald-400 text-sm mt-0.5 block">
                {notaFiscal}
              </span>
            </div>

            <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3">
              <span className="text-[10px] text-slate-500 uppercase font-bold block flex items-center gap-1">
                <Building2 className="w-3 h-3 text-sky-400" />
                Fornecedor
              </span>
              <span className="font-semibold text-slate-200 mt-0.5 block truncate">
                {fornecedor}
              </span>
            </div>

            <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3">
              <span className="text-[10px] text-slate-500 uppercase font-bold block flex items-center gap-1">
                <MapPin className="w-3 h-3 text-amber-400" />
                Endereço de Armazenagem
              </span>
              <span className="font-mono font-semibold text-slate-200 mt-0.5 block">
                {produto.endereco || 'A definir na alocação'}
              </span>
            </div>

            <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3">
              <span className="text-[10px] text-slate-500 uppercase font-bold block flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                Data de Recebimento
              </span>
              <span className="font-mono font-semibold text-slate-200 mt-0.5 block">
                {dataRecebimento || produto.data_recebimento || '—'}
              </span>
            </div>
          </div>

          {/* Status da Conferência e Quantidade Conferida */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Situação da Conferência
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-xl flex items-center gap-1.5 ${
                  isCritica
                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    : isValidado
                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/40'
                    : isConferido
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                }`}
              >
                {isCritica ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                ) : isValidado ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                ) : isConferido ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>
                  {isCritica ? 'Crítica' : isValidado ? 'Validado (Gestor)' : isConferido ? 'Conferido' : 'Pendente'}
                </span>
              </span>
            </div>

            <div className="text-xs text-slate-400 pt-1 flex items-center justify-between">
              <span>Quantidade física já conferida:</span>
              <strong className="font-mono text-white text-sm">
                {produto.qtd_conferida !== null && produto.qtd_conferida !== undefined
                  ? `${produto.qtd_conferida} un`
                  : 'Nenhuma contagem realizada'}
              </strong>
            </div>

            {/* Ação de Impressão de Etiqueta Zebra (Exibida SOMENTE quando status for 'Crítica') */}
            {isCritica && (
              <div className="pt-2.5 mt-1 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <span className="text-[11px] text-rose-300 font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  Identificação física de ocorrência
                </span>
                <button
                  type="button"
                  onClick={() => setModalEtiquetaAvariaAberto(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-200 border border-rose-500/30 text-xs font-bold transition shadow-sm"
                  title="Imprimir Etiqueta Térmica Zebra (10x5 cm)"
                >
                  <Printer className="w-3.5 h-3.5 text-rose-400" />
                  <span>Imprimir Etiqueta</span>
                </button>
              </div>
            )}
          </div>

          {/* Alertas de Operação Excepcional */}
          {sucessoValidar && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Sucesso:</span>
                <span>{sucessoValidar}</span>
              </div>
            </div>
          )}

          {alertaMensagem && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block">Aviso:</span>
                <span>{alertaMensagem}</span>
              </div>
              <button
                type="button"
                onClick={() => setAlertaMensagem(null)}
                className="text-amber-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {erroValidar && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block">Erro na validação:</span>
                <span>{erroValidar}</span>
              </div>
              <button
                type="button"
                onClick={() => setErroValidar(null)}
                className="text-rose-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* BLOCO DA QUANTIDADE ESPERADA (CONFERÊNCIA CEGA):
              A quantidade da nota fiscal deverá ser exibida SOMENTE nesta tela de detalhes.
              Porém, inicialmente ela DEVE permanecer protegida visualmente (ex: ••••••).
              Ao lado, adicionar o botão: MOSTRAR.
              Ao clicar em MOSTRAR: revelar a quantidade esperada da NF. */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-700/80 rounded-2xl p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Quantidade Esperada da NF
                </span>
                <span className="text-[11px] text-slate-500">
                  Protegido pela regra de conferência cega
                </span>
              </div>

              <button
                type="button"
                onClick={() => setMostrarQtdEsperada((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition min-h-[44px] ${
                  mostrarQtdEsperada
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
                }`}
              >
                {mostrarQtdEsperada ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>OCULTAR</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>MOSTRAR</span>
                  </>
                )}
              </button>
            </div>

            <div className="pt-2">
              {mostrarQtdEsperada ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between animate-in zoom-in-95 duration-150">
                  <span className="text-xs text-emerald-300 font-semibold">
                    Quantidade Registrada na Nota Fiscal:
                  </span>
                  <span className="text-xl font-black font-mono text-emerald-400">
                    {produto.quantidade} un
                  </span>
                </div>
              ) : (
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Valor Oculto:</span>
                  <span className="text-xl font-black font-mono tracking-widest text-slate-500 select-none">
                    ••••••
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition min-h-[44px]"
          >
            Fechar
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap justify-end">
            {/* Botão de Impressão de Etiqueta Zebra de Avaria (Exibido SOMENTE quando status for 'Crítica') */}
            {isCritica && (
              <button
                type="button"
                id="btn-imprimir-etiqueta-avaria"
                onClick={() => setModalEtiquetaAvariaAberto(true)}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs shadow-lg shadow-rose-950/40 border border-rose-500/40 transition min-h-[44px] cursor-pointer"
                title="Imprimir Etiqueta Zebra de Avaria (10x5 cm)"
              >
                <Printer className="w-3.5 h-3.5 text-white" />
                <span>ETIQUETA AVARIA</span>
              </button>
            )}

            {/* Botão Validar Excepcional (Apenas Gestor) — Imediatamente à esquerda do botão Conferir este produto */}
            {isGestor && (
              <button
                type="button"
                id="btn-validar-produto-excepcional"
                onClick={handleAbrirValidar}
                disabled={validando || isJaValidado}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:from-rose-700 active:to-red-700 text-white font-bold text-xs shadow-lg shadow-rose-950/40 border border-rose-500/40 transition min-h-[44px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  isJaValidado
                    ? 'Este produto já foi validado e está disponível para alocação.'
                    : 'Validar este produto e disponibilizar para alocação (Ação Excepcional — Gestor)'
                }
              >
                <ShieldAlert className="w-3.5 h-3.5 text-white" />
                <span>VALIDAR</span>
              </button>
            )}

            {onIniciarConferencia && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onIniciarConferencia(produto);
                }}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition min-h-[44px]"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>CONFERIR ESTE PRODUTO</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Confirmação da Validação Excepcional do Produto */}
      <ConfirmacaoExcepcionalModal
        isOpen={modalValidarAberto}
        tipo="validar"
        identificador={produto.produto}
        fornecedorOuDetalhe={`NF: ${notaFiscal}`}
        loading={validando}
        erro={erroValidar}
        onConfirmar={handleConfirmarValidar}
        onCancelar={() => {
          setModalValidarAberto(false);
          setErroValidar(null);
        }}
      />

      {/* Modal de Configuração e Impressão da Etiqueta Zebra de Avaria */}
      {modalEtiquetaAvariaAberto && (
        <ConfiguracaoEtiquetaAvariaModal
          notaFiscal={notaFiscal}
          produto={produto.produto}
          data={dataRecebimento || produto.data_recebimento || ''}
          fornecedor={fornecedor}
          onClose={() => setModalEtiquetaAvariaAberto(false)}
        />
      )}
    </div>
  );
};
