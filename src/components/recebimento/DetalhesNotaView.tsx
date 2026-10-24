import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  FileText,
  Calendar,
  Building2,
  Package,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Play,
  ArrowRight,
  Truck,
  MapPin,
  RefreshCw,
  Layers,
  ShieldCheck,
  MessageSquare,
  Check,
  AlertOctagon,
  ShieldAlert,
  X,
} from 'lucide-react';
import { ResumoNotaRecebimento, RecebimentoProduto } from '../../types';
import { recebimentoService } from '../../services/recebimentoService';
import { relatoriosService } from '../../services/relatoriosService';
import { useAuth } from '../../context/AuthContext';
import { isUserGestor } from '../../lib/permissions';
import { ConfirmacaoExcepcionalModal } from './ConfirmacaoExcepcionalModal';

interface DetalhesNotaViewProps {
  nota: ResumoNotaRecebimento;
  onVoltar: () => void;
  onIniciarConferencia: () => void;
  onIrParaAlocacao?: () => void;
  onNotaFinalizada?: () => void;
}

export const DetalhesNotaView: React.FC<DetalhesNotaViewProps> = ({
  nota,
  onVoltar,
  onIniciarConferencia,
  onIrParaAlocacao,
  onNotaFinalizada,
}) => {
  const { user } = useAuth();
  const isGestor = isUserGestor(user);

  const [produtos, setProdutos] = useState<RecebimentoProduto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dadosAgendamento, setDadosAgendamento] = useState<{
    agendamento_id: string;
    fornecedor: string;
    nota_fiscal: string;
    data: string;
    transportadora?: string;
  } | null>(null);
  const [copiadoWhatsApp, setCopiadoWhatsApp] = useState(false);

  // Estados para finalização excepcional (Gestor)
  const [modalFinalizarAberto, setModalFinalizarAberto] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [erroFinalizar, setErroFinalizar] = useState<string | null>(null);
  const [sucessoFinalizar, setSucessoFinalizar] = useState<string | null>(null);
  const [alertaMensagem, setAlertaMensagem] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function carregarDados() {
      try {
        setLoading(true);
        const [listaProdutos, agendamento] = await Promise.all([
          recebimentoService.listarProdutosDaNota(nota.nota_fiscal),
          recebimentoService.obterDadosAgendamentoPorId(nota.agendamento_id, nota.nota_fiscal),
        ]);

        if (isMounted) {
          setProdutos(listaProdutos);
          if (agendamento && agendamento.fornecedor) {
            setDadosAgendamento(agendamento);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar detalhes da nota fiscal:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    carregarDados();
    return () => {
      isMounted = false;
    };
  }, [nota.nota_fiscal, nota.agendamento_id]);

  const nomeFornecedor =
    dadosAgendamento?.fornecedor ||
    (nota.fornecedor &&
    !nota.fornecedor.toLowerCase().includes('fornecedor da nota') &&
    !nota.fornecedor.toLowerCase().includes('fornecedor da carga')
      ? nota.fornecedor
      : 'Fornecedor Cadastrado');

  const dataExibicao = dadosAgendamento?.data || nota.data_recebimento;
  const notaFiscalExibicao = dadosAgendamento?.nota_fiscal || nota.nota_fiscal;

  // Métricas calculadas em tempo real a partir dos produtos
  const totalProdutos = produtos.length || nota.total_itens;
  const totalConferidos = produtos.filter((p) => p.status === 'Conferido' || p.status === 'Alocado' || p.status === 'Validado').length;
  const totalCriticas = produtos.filter((p) => p.status === 'Crítica').length;
  const totalPendentes = produtos.filter((p) => p.status === 'Recebido').length;

  const porcentagem = totalProdutos > 0 ? Math.round((totalConferidos / totalProdutos) * 100) : 0;
  const todosConferidos = totalProdutos > 0 && totalConferidos === totalProdutos && totalCriticas === 0;
  const possuiCritica = totalCriticas > 0;
  const emAndamento = !todosConferidos && totalConferidos > 0;

  // Regra de prevenção: nota já totalmente validada ou alocada
  const isNotaJaFinalizada =
    produtos.length > 0 &&
    produtos.every((p) => p.status === 'Validado' || p.status === 'Alocado');

  const handleAbrirFinalizar = () => {
    setAlertaMensagem(null);
    setErroFinalizar(null);
    if (isNotaJaFinalizada) {
      setAlertaMensagem('Esta nota fiscal já foi finalizada. Não há itens pendentes para validação.');
      return;
    }
    setModalFinalizarAberto(true);
  };

  const handleConfirmarFinalizar = async () => {
    try {
      setFinalizando(true);
      setErroFinalizar(null);
      const res = await recebimentoService.finalizarNotaFiscalExcepcional({
        notaFiscal: nota.nota_fiscal,
        agendamentoId: nota.agendamento_id,
      });

      setSucessoFinalizar(res.message);
      setModalFinalizarAberto(false);

      // Recarrega produtos da nota localmente
      const atualizados = await recebimentoService.listarProdutosDaNota(nota.nota_fiscal);
      setProdutos(atualizados);

      if (onNotaFinalizada) {
        setTimeout(() => {
          onNotaFinalizada();
        }, 1800);
      }
    } catch (err: any) {
      console.error('Erro ao finalizar nota fiscal:', err);
      setErroFinalizar(err.message || 'Erro ao finalizar nota fiscal.');
    } finally {
      setFinalizando(false);
    }
  };

  const handleCopiarWhatsApp = async () => {
    const itens = produtos.map((p) => ({
      produto: p.produto,
      quantidade: p.quantidade,
    }));
    const texto = relatoriosService.gerarTextoWhatsApp({
      data_recebimento: dataExibicao,
      fornecedor: nomeFornecedor,
      nota_fiscal: notaFiscalExibicao,
      itens,
    });

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(texto);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = texto;
        textarea.style.position = 'fixed';
        textarea.style.left = '-999999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiadoWhatsApp(true);
      setTimeout(() => setCopiadoWhatsApp(false), 2500);
    } catch (e) {
      console.error('Erro ao copiar para WhatsApp:', e);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24 md:pb-12 animate-in fade-in duration-200">
      {/* Barra Superior de Navegação */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onVoltar}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Recebimento</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Botão Finalizar Excepcional (Apenas Gestor) */}
          {isGestor && (
            <button
              type="button"
              id="btn-finalizar-nf-top"
              onClick={handleAbrirFinalizar}
              disabled={finalizando || isNotaJaFinalizada}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:from-rose-700 active:to-red-700 text-white font-black text-xs shadow-lg shadow-rose-950/40 border border-rose-500/40 transition min-h-[44px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                isNotaJaFinalizada
                  ? 'Esta nota fiscal já foi finalizada. Não há itens pendentes para validação.'
                  : 'Finalizar nota fiscal e liberar todos os itens para alocação (Apenas Gestor)'
              }
            >
              <AlertOctagon className="w-4 h-4 text-white shrink-0" />
              <span>Finalizar</span>
            </button>
          )}

          <button
            type="button"
            id="btn-copiar-whatsapp-detalhes"
            onClick={handleCopiarWhatsApp}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition border min-h-[44px] ${
              copiadoWhatsApp
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800 hover:border-slate-700'
            }`}
            title="Copiar lista pronta para envio no WhatsApp"
          >
            {copiadoWhatsApp ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span>Copiar p/ WhatsApp</span>
              </>
            )}
          </button>

          <span className="text-xs font-bold text-slate-400 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-xl hidden sm:inline-block">
            Detalhes da Nota Fiscal
          </span>
        </div>
      </div>

      {/* Alerta de Sucesso na Finalização */}
      {sucessoFinalizar && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-start gap-3 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block">Finalização Concluída:</span>
            <span>{sucessoFinalizar}</span>
          </div>
        </div>
      )}

      {/* Alerta Informativo (ex: nota já finalizada) */}
      {alertaMensagem && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs sm:text-sm flex items-start gap-3 animate-in fade-in duration-200">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block">Aviso:</span>
            <span>{alertaMensagem}</span>
          </div>
          <button
            type="button"
            onClick={() => setAlertaMensagem(null)}
            className="text-amber-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Erro de finalização */}
      {erroFinalizar && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-3 animate-in fade-in duration-200">
          <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block">Erro na finalização:</span>
            <span>{erroFinalizar}</span>
          </div>
          <button
            type="button"
            onClick={() => setErroFinalizar(null)}
            className="text-rose-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Card Principal: Cabeçalho da Nota Fiscal */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                <span>Documento Fiscal</span>
              </span>

              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                  possuiCritica
                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    : todosConferidos
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : emAndamento
                    ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                }`}
              >
                {possuiCritica ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                ) : todosConferidos ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                )}
                <span>
                  {possuiCritica
                    ? 'Com Crítica / Divergência'
                    : todosConferidos
                    ? '100% Conferida'
                    : emAndamento
                    ? 'Em Conferência'
                    : 'Pendente de Conferência'}
                </span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              <span>NF: {notaFiscalExibicao}</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-400 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <strong className="text-slate-200">{nomeFornecedor}</strong>
            </p>
          </div>

          {/* Botão de Alocação Direta se 100% conferida */}
          {todosConferidos && onIrParaAlocacao && (
            <button
              type="button"
              onClick={onIrParaAlocacao}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/25 transition min-h-[44px]"
            >
              <span>Liberado para Alocação</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Grade de Metadados da Carga */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2">
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              Data de Recebimento
            </span>
            <span className="font-mono font-bold text-white text-sm block">
              {dataExibicao}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-amber-400" />
              Transportadora / Origem
            </span>
            <span className="font-semibold text-white text-sm block truncate">
              {dadosAgendamento?.transportadora || 'Entrega Própria / Terceirizada'}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Método de Validação
            </span>
            <span className="font-semibold text-emerald-400 text-sm block">
              Conferência Cega
            </span>
          </div>
        </div>

        {/* Resumo Numérico dos SKUs e Situação da Conferência */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total de SKUs</span>
            <span className="text-xl font-black font-mono text-white mt-0.5 block">{totalProdutos}</span>
            <span className="text-[10px] text-slate-500">produtos na NF</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Conferidos</span>
            <span className="text-xl font-black font-mono text-emerald-400 mt-0.5 block">
              {totalConferidos} / {totalProdutos}
            </span>
            <span className="text-[10px] text-slate-500">itens validados</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Pendentes</span>
            <span className="text-xl font-black font-mono text-amber-400 mt-0.5 block">
              {totalPendentes}
            </span>
            <span className="text-[10px] text-slate-500">aguardando bip</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Críticas</span>
            <span className={`text-xl font-black font-mono mt-0.5 block ${possuiCritica ? 'text-rose-400' : 'text-slate-400'}`}>
              {totalCriticas}
            </span>
            <span className="text-[10px] text-slate-500">com divergência</span>
          </div>
        </div>

        {/* Barra de Progresso da Conferência */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-semibold">Progresso Geral da Nota Fiscal</span>
            <span className="font-bold text-white font-mono">{porcentagem}%</span>
          </div>
          <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                possuiCritica
                  ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                  : todosConferidos
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : 'bg-gradient-to-r from-blue-500 to-sky-400'
              }`}
              style={{ width: `${porcentagem}%` }}
            />
          </div>
        </div>

        {/* Ação Primária em Destaque: INICIAR / CONTINUAR CONFERÊNCIA + FINALIZAR */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-400">
            {todosConferidos
              ? 'Todos os produtos desta nota fiscal já foram conferidos com sucesso.'
              : 'Clique no botão ao lado para abrir a listagem completa de produtos e iniciar a conferência cega.'}
          </p>

          <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap justify-end">
            {isGestor && !isNotaJaFinalizada && (
              <button
                type="button"
                id="btn-finalizar-nf-bottom"
                onClick={handleAbrirFinalizar}
                disabled={finalizando}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:from-rose-700 active:to-red-700 text-white font-black text-xs shadow-lg shadow-rose-950/40 border border-rose-500/50 transition cursor-pointer min-h-[50px] disabled:opacity-50"
                title="Finalizar nota fiscal e validar todos os itens (Apenas Gestor)"
              >
                <AlertOctagon className="w-4 h-4 text-white" />
                <span>Finalizar Nota</span>
              </button>
            )}

            <button
              type="button"
              onClick={onIniciarConferencia}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/25 transition cursor-pointer min-h-[50px]"
            >
              <Play className="w-5 h-5 fill-slate-950" />
              <span>{todosConferidos ? 'Revisar Conferência de Produtos' : 'Iniciar Conferência'}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Confirmação da Finalização Excepcional */}
      <ConfirmacaoExcepcionalModal
        isOpen={modalFinalizarAberto}
        tipo="finalizar"
        identificador={`NF: ${notaFiscalExibicao}`}
        fornecedorOuDetalhe={nomeFornecedor}
        loading={finalizando}
        erro={erroFinalizar}
        onConfirmar={handleConfirmarFinalizar}
        onCancelar={() => {
          setModalFinalizarAberto(false);
          setErroFinalizar(null);
        }}
      />
    </div>
  );
};
