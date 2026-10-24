import React, { useState } from 'react';
import {
  X,
  MapPin,
  Package,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  FileText,
  ArrowLeft,
  AlertOctagon,
  Check,
  RefreshCw,
  Copy,
} from 'lucide-react';
import { RecebimentoProduto } from '../../types';
import { alocacaoService } from '../../services/alocacaoService';
import { useAuth } from '../../context/AuthContext';
import { useSessaoOperacional } from '../../context/SessaoOperacionalContext';
import { isEnderecoSemLocacao, formatarEnderecoDisplay, validarEnderecoDestino } from '../../lib/enderecos';

interface DetalheProdutoModalProps {
  produto: RecebimentoProduto;
  onClose: () => void;
  onProdutoAtualizado: () => void;
}

export const DetalheProdutoModal: React.FC<DetalheProdutoModalProps> = ({
  produto,
  onClose,
  onProdutoAtualizado,
}) => {
  const { user } = useAuth();
  const { operador } = useSessaoOperacional();
  const [novoEndereco, setNovoEndereco] = useState('');
  const [telaConfirmacaoDivergente, setTelaConfirmacaoDivergente] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiadoCampo, setCopiadoCampo] = useState<string | null>(null);

  const copiarParaTransferencia = async (texto: string, campoId: string) => {
    if (!texto) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = texto;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiadoCampo(campoId);
      setTimeout(() => {
        setCopiadoCampo((curr) => (curr === campoId ? null : curr));
      }, 2500);
    } catch (err) {
      console.warn('Erro ao copiar texto:', err);
    }
  };

  const isOriginalSemLocacao = isEnderecoSemLocacao(produto.endereco);
  const enderecoOriginalDisplay = formatarEnderecoDisplay(produto.endereco);
  const enderecoOriginalLimpo = (produto.endereco || '').trim().toUpperCase();
  const novoEnderecoLimpo = novoEndereco.trim().toUpperCase();
  const isNovoSemLocacao = isEnderecoSemLocacao(novoEnderecoLimpo);

  const prefixoOriginal = isOriginalSemLocacao ? '' : enderecoOriginalLimpo.slice(0, 3);
  const prefixoDigitado = novoEnderecoLimpo.slice(0, 3);

  const temMinimo3 = novoEnderecoLimpo.length >= 3;
  // Se o original for Sem Locação (*S/L_GO), nunca pode ser "mesmo endereço" correspondente
  const isCorrespondente =
    !isOriginalSemLocacao &&
    !isNovoSemLocacao &&
    temMinimo3 &&
    prefixoOriginal.length >= 3 &&
    prefixoDigitado === prefixoOriginal;
  const isDiferente =
    temMinimo3 &&
    !isNovoSemLocacao &&
    (isOriginalSemLocacao || !prefixoOriginal || prefixoDigitado !== prefixoOriginal);

  // 1. Confirmação para mesmo endereço (Verde)
  const handleConfirmarMesmoEndereco = async () => {
    if (!temMinimo3 || !isCorrespondente || isNovoSemLocacao) return;
    try {
      setSaving(true);
      setError(null);
      const repositorId = operador?.id || user?.id || 'usr-default-01';
      const repositorNome = operador?.nome || user?.nome || 'Operador';

      await alocacaoService.confirmarAlocacaoMesmoEndereco({
        produtoId: produto.id,
        repositorId,
        repositorNome,
      });
      onProdutoAtualizado();
      onClose();
    } catch (err) {
      console.error('Erro ao confirmar alocação:', err);
      setError(err instanceof Error ? err.message : 'Erro ao confirmar alocação.');
    } finally {
      setSaving(false);
    }
  };

  // 2. Confirmação de alteração divergente (Vermelho)
  const handleConfirmarAlteracao = async () => {
    if (!temMinimo3 || isNovoSemLocacao) return;
    try {
      setSaving(true);
      setError(null);
      const repositorId = operador?.id || user?.id || 'usr-default-01';
      const repositorNome = operador?.nome || user?.nome || 'Operador';

      await alocacaoService.confirmarAlocacaoComAlteracaoEndereco({
        produtoId: produto.id,
        produto: produto.produto,
        enderecoOriginal: produto.endereco || '',
        novoEndereco: novoEndereco.trim(),
        repositorId,
        repositorNome,
        usuarioCodigo: operador?.codigo || user?.codigo || 'OP',
      });
      onProdutoAtualizado();
      onClose();
    } catch (err) {
      console.error('Erro ao confirmar alteração de endereço:', err);
      setError(err instanceof Error ? err.message : 'Erro ao confirmar alteração de endereço.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-lg rounded-3xl bg-slate-900 border shadow-2xl overflow-hidden flex flex-col transition-colors duration-300 ${
          telaConfirmacaoDivergente
            ? 'border-rose-600/70 shadow-rose-950/60'
            : 'border-slate-800'
        }`}
      >
        {/* ========================================================================= */}
        {/* TELA DE CONFIRMAÇÃO DE ALTERAÇÃO (PREDOMINANTEMENTE VERMELHA) */}
        {/* ========================================================================= */}
        {telaConfirmacaoDivergente ? (
          <div className="p-5 sm:p-6 space-y-5 bg-gradient-to-b from-rose-950/50 via-slate-900 to-slate-950">
            {/* Header com destaque vermelho */}
            <div className="flex items-center justify-between border-b border-rose-900/40 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertOctagon className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
                    Atenção • Divergência de Endereço
                  </span>
                  <h3 className="text-lg font-black text-white tracking-tight mt-0.5">
                    Confirmar Alteração de Endereço
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTelaConfirmacaoDivergente(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition min-h-[44px]"
                title="Voltar para detalhes"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Informações detalhadas da alteração */}
            <div className="bg-slate-950/70 border border-rose-900/40 rounded-2xl p-4 space-y-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Produto:
                </span>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <p className="text-sm sm:text-base font-bold text-white break-words flex-1">
                    {produto.produto}
                  </p>
                  <button
                    type="button"
                    onClick={() => copiarParaTransferencia(produto.produto, 'detalhe-produto')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition shrink-0 min-h-[36px] ${
                      copiadoCampo === 'detalhe-produto'
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200 hover:text-white'
                    }`}
                    title="Copiar produto"
                  >
                    {copiadoCampo === 'detalhe-produto' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Endereço original:
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono font-bold text-sm text-slate-200">
                      {enderecoOriginalDisplay}
                    </span>
                    {isOriginalSemLocacao && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Sem Locação
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-rose-950/40 rounded-xl p-3 border border-rose-500/30">
                  <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider block">
                    Novo endereço informado:
                  </span>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="font-mono font-black text-sm text-rose-200 block truncate">
                      {novoEndereco.trim()}
                    </span>
                    <button
                      type="button"
                      onClick={() => copiarParaTransferencia(novoEndereco.trim(), 'detalhe-endereco')}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-semibold transition shrink-0 min-h-[32px] ${
                        copiadoCampo === 'detalhe-endereco'
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-slate-900 hover:bg-slate-800 border-rose-500/40 text-rose-200 hover:text-white'
                      }`}
                      title="Copiar novo endereço"
                    >
                      {copiadoCampo === 'detalhe-endereco' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-rose-300" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* MENSAGEM REGULAMENTAR OBRIGATÓRIA */}
            <div className="bg-rose-950/80 border-2 border-rose-600/80 rounded-2xl p-4.5 sm:p-5 text-center shadow-lg shadow-rose-950/80">
              <p className="text-sm sm:text-base font-bold text-rose-100 leading-snug">
                &ldquo;Você está alterando o endereço de alocação do produto, certifique-se de mover os produtos antigos juntamente com os recebidos.&rdquo;
              </p>
            </div>

            {error && (
              <div className="bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs p-3 rounded-xl">
                {error}
              </div>
            )}

            {/* Botões de Ação na Tela Vermelha */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                id="btn-confirmar-alteracao-endereco"
                onClick={handleConfirmarAlteracao}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-black text-sm sm:text-base shadow-xl shadow-rose-950/80 transition active:scale-[0.98] min-h-[48px]"
              >
                {saving ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <AlertOctagon className="w-5 h-5" />
                )}
                <span>CONFIRMAR ALTERAÇÃO</span>
              </button>

              <button
                type="button"
                onClick={() => setTelaConfirmacaoDivergente(false)}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition min-h-[44px]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar e corrigir endereço</span>
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* TELA DETALHES DA ALOCAÇÃO */
          /* ========================================================================= */
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Detalhes da Alocação
                  </h3>
                  <p className="text-xs text-slate-400">NF {produto.nota_fiscal}</p>
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

            {/* Content */}
            <div className="p-5 space-y-4">
              {/* Nome do Produto */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Produto
                </span>
                <h4 className="text-sm sm:text-base font-bold text-white leading-snug">
                  {produto.produto}
                </h4>
                <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 font-mono">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    NF: <strong className="text-slate-200">{produto.nota_fiscal}</strong>
                  </span>
                  <span className="flex items-center gap-1.5 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    {produto.data_recebimento}
                  </span>
                  <span className="font-mono text-slate-400">
                    Qtd: <strong className="text-white">{produto.quantidade} un</strong>
                  </span>
                </div>
              </div>

              {/* BLOCO REQUISITADO: Endereço físico de armazém */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-sky-400" />
                  <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide uppercase">
                    Endereço físico de armazém
                  </h4>
                </div>

                {/* Endereço Original */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Endereço original
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono font-bold text-sm text-slate-200">
                        {enderecoOriginalDisplay}
                      </span>
                      {isOriginalSemLocacao && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Sem Locação
                        </span>
                      )}
                    </div>
                  </div>
                  {prefixoOriginal ? (
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 self-start sm:self-auto">
                      Prefixo: <strong>{prefixoOriginal}</strong>
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-amber-400/80 bg-amber-950/30 px-2 py-1 rounded border border-amber-800/40 self-start sm:self-auto">
                      Sem locação cadastrada
                    </span>
                  )}
                </div>

                {/* Campo Novo Endereço */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="input-novo-endereco"
                    className="text-xs font-bold text-slate-200 block"
                  >
                    Novo endereço
                  </label>
                  <input
                    id="input-novo-endereco"
                    type="text"
                    autoFocus
                    value={novoEndereco}
                    onChange={(e) => setNovoEndereco(e.target.value)}
                    placeholder="Digite o endereço físico onde está guardando..."
                    className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-3.5 py-3 text-sm text-white placeholder-slate-500 font-mono transition min-h-[46px]"
                  />

                  {/* Feedback de Validação dos 3 caracteres / *S/L_GO */}
                  <div className="pt-1">
                    {!temMinimo3 ? (
                      <p className="text-xs text-amber-400 flex items-center gap-1.5 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                        <span>Insira pelo menos 3 caracteres para validar o endereço.</span>
                      </p>
                    ) : isNovoSemLocacao ? (
                      <p className="text-xs text-rose-400 flex items-center gap-1.5 font-medium bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/30">
                        <AlertOctagon className="w-4 h-4 shrink-0 text-rose-400" />
                        <span>
                          Informe um endereço válido para realizar a alocação. O produto está atualmente como Sem Locação.
                        </span>
                      </p>
                    ) : isCorrespondente ? (
                      <p className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                        <span>
                          Endereço correspondente ao local original cadastrado ({prefixoDigitado}).
                        </span>
                      </p>
                    ) : isOriginalSemLocacao ? (
                      <p className="text-xs text-amber-300 flex items-center gap-1.5 font-medium bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                        <span>
                          Produto sem locação. O endereço {novoEndereco.trim()} será registrado e enviado para confirmação.
                        </span>
                      </p>
                    ) : (
                      <p className="text-xs text-rose-400 flex items-center gap-1.5 font-medium bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                        <AlertOctagon className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                        <span>
                          Prefixo divergente ({prefixoDigitado} ≠ {prefixoOriginal || 'Nenhum'}).
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-xl">
                  {error}
                </div>
              )}

              {/* AÇÕES CONDICIONAIS */}
              <div className="pt-2">
                {/* Enquanto tiver < 3 caracteres ou for Sem Locação: NÃO EXIBE O BOTÃO DE CONFIRMAÇÃO */}
                {!temMinimo3 || isNovoSemLocacao ? (
                  <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-center">
                    <span className="text-xs text-slate-500">
                      {isNovoSemLocacao
                        ? 'Informe um endereço físico válido para liberar a confirmação.'
                        : 'Aguardando inserção de no mínimo 3 caracteres do novo endereço...'}
                    </span>
                  </div>
                ) : isCorrespondente ? (
                  /* SE CORRESPONDENTE: BOTÃO VERDE "CONFIRMAR" */
                  <button
                    type="button"
                    id="btn-confirmar-mesmo-endereco"
                    onClick={handleConfirmarMesmoEndereco}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm sm:text-base shadow-xl shadow-emerald-950/60 transition active:scale-[0.98] min-h-[48px]"
                  >
                    {saving ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>CONFIRMAR</span>
                  </button>
                ) : (
                  /* SE DIFERENTE: BOTÃO VERMELHO "ALTERAR ENDEREÇO" */
                  <button
                    type="button"
                    id="btn-abrir-tela-alterar-endereco"
                    onClick={() => setTelaConfirmacaoDivergente(true)}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-sm sm:text-base shadow-xl shadow-rose-950/60 transition active:scale-[0.98] min-h-[48px]"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>ALTERAR ENDEREÇO</span>
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
