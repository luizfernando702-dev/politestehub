import React, { useState, useMemo } from 'react';
import {
  Printer,
  X,
  FileText,
  Package,
  Calendar,
  AlertTriangle,
  Copy,
  Check,
  Download,
  Layers,
  ShieldAlert,
} from 'lucide-react';
import { DadosEtiquetaCriticaAvaria } from '../../types/impressao';
import { zebraPrintService } from '../../services/zebraPrintService';

interface ConfiguracaoEtiquetaAvariaModalProps {
  notaFiscal: string;
  produto: string;
  data: string;
  fornecedor?: string;
  onClose: () => void;
}

/**
 * Normaliza e formata a data para padrão DD/MM/AAAA
 */
function formatarDataParaExibicao(dataOriginal?: string | null): string {
  if (!dataOriginal) {
    return new Date().toLocaleDateString('pt-BR');
  }
  const limpa = String(dataOriginal).trim();
  if (limpa.includes('/')) {
    return limpa.split(' ')[0];
  }
  try {
    const d = new Date(limpa);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('pt-BR');
    }
  } catch {
    // fallback
  }
  return limpa;
}

export const ConfiguracaoEtiquetaAvariaModal: React.FC<ConfiguracaoEtiquetaAvariaModalProps> = ({
  notaFiscal,
  produto,
  data,
  fornecedor,
  onClose,
}) => {
  const [copias, setCopias] = useState<number>(1);
  const [imprimindo, setImprimindo] = useState(false);
  const [erroMsg, setErroMsg] = useState<string | null>(null);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);
  const [zplCopiado, setZplCopiado] = useState(false);

  const dataFormatada = useMemo(() => formatarDataParaExibicao(data), [data]);

  const dadosEtiqueta: DadosEtiquetaCriticaAvaria = useMemo(() => {
    return {
      notaFiscal: (notaFiscal || '').trim(),
      produto: (produto || '').trim(),
      data: dataFormatada,
      fornecedor: fornecedor ? fornecedor.trim() : undefined,
      copias: Math.max(1, copias),
    };
  }, [notaFiscal, produto, dataFormatada, fornecedor, copias]);

  const zplGerado = useMemo(() => {
    return zebraPrintService.gerarZplCriticaAvaria(dadosEtiqueta);
  }, [dadosEtiqueta]);

  const handleImprimir = async () => {
    setImprimindo(true);
    setErroMsg(null);
    setSucessoMsg(null);

    try {
      const res = await zebraPrintService.imprimirEtiqueta('critica_avaria', dadosEtiqueta);
      if (res.sucesso) {
        setSucessoMsg('Etiqueta de Avaria enviada para impressão Zebra com sucesso.');
        setTimeout(() => setSucessoMsg(null), 4000);
      } else {
        setErroMsg(res.mensagem);
      }
    } catch (err: any) {
      setErroMsg(`Erro ao processar impressão: ${err?.message || 'Falha de comunicação'}`);
    } finally {
      setImprimindo(false);
    }
  };

  const handleCopiarZpl = async () => {
    const copiou = await zebraPrintService.copiarZpl(zplGerado);
    if (copiou) {
      setZplCopiado(true);
      setTimeout(() => setZplCopiado(false), 2500);
    }
  };

  const handleBaixarZpl = () => {
    const nome = `etiqueta_avaria_NF${dadosEtiqueta.notaFiscal}_${dadosEtiqueta.produto}.zpl`;
    zebraPrintService.baixarArquivoZpl(nome, zplGerado);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="etiqueta-avaria-title"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="etiqueta-avaria-title" className="text-lg sm:text-xl font-black text-white tracking-tight">
                  Etiqueta Zebra — Produto com Crítica / Avaria
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                  Térmica 10cm × 5cm
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Área Útil 8 × 5 cm (Direita para Esquerda) &bull; 2 cm Reservados para Logotipo Pré-Impresso (Lado Direito) &bull; NF{' '}
                <strong className="text-slate-200">{dadosEtiqueta.notaFiscal}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
            title="Fechar janela"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CORPO DO MODAL */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Alertas */}
          {erroMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <strong className="font-bold">Aviso:</strong> {erroMsg}
              </div>
            </div>
          )}

          {sucessoMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-300 text-xs animate-in fade-in">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{sucessoMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* COLUNA ESQUERDA: PARÂMETROS E DADOS DA ETIQUETA */}
            <div className="lg:col-span-5 space-y-4">
              {/* Card de Informações da Carga */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Dados do Produto na Ocorrência
                </span>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                      Nota Fiscal:
                    </span>
                    <strong className="font-mono text-white text-sm">
                      {dadosEtiqueta.notaFiscal || '—'}
                    </strong>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-blue-400" />
                      Produto:
                    </span>
                    <strong className="font-mono text-white text-xs block break-words">
                      {dadosEtiqueta.produto || '—'}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      Data da Ocorrência:
                    </span>
                    <strong className="font-mono text-white text-xs">
                      {dadosEtiqueta.data}
                    </strong>
                  </div>

                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between">
                    <span className="text-rose-300 font-bold flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                      Identificador Físico:
                    </span>
                    <span className="font-black text-rose-400 tracking-wider">
                      AVARIA
                    </span>
                  </div>
                </div>
              </div>

              {/* Parâmetros Físicos da Etiqueta */}
              <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-2 text-xs text-slate-400">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Especificações Técnicas Zebra
                </span>
                <ul className="space-y-1.5 text-[11px] leading-relaxed list-disc list-inside text-slate-400">
                  <li>
                    Dimensão total da etiqueta: <strong className="text-slate-200">10 cm × 5 cm</strong>
                  </li>
                  <li>
                    Área útil de impressão: <strong className="text-slate-200">8 cm × 5 cm</strong> (começa da direita para a esquerda)
                  </li>
                  <li>
                    Faixa reservada ao logotipo: <strong className="text-slate-200">2 cm</strong> (lado direito, 100% livre)
                  </li>
                  <li>
                    Destaque visual: <strong className="text-rose-300">AVARIA em fonte grande</strong>
                  </li>
                </ul>
              </div>

              {/* Seletor de Cópias */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-bold text-slate-300">Quantidade de Cópias:</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCopias((prev) => Math.max(1, prev - 1))}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm flex items-center justify-center transition"
                  >
                    -
                  </button>
                  <span className="w-10 text-center font-mono font-bold text-sm text-white">
                    {copias}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCopias((prev) => Math.min(20, prev + 1))}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm flex items-center justify-center transition"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* COLUNA DIREITA: PRÉ-VISUALIZAÇÃO EM TEMPO REAL WYSIWYG */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Printer className="w-3.5 h-3.5 text-rose-400" />
                    <span>Pré-Visualização (Etiqueta Térmica 10 × 5 cm)</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Área Útil 8 × 5 cm (Direita para Esquerda)
                  </span>
                </div>

                {/* CONTAINER VISUAL DA ETIQUETA ADESIVA */}
                <div className="bg-slate-950 p-4 rounded-3xl border border-slate-800 flex items-center justify-center shadow-inner">
                  <div
                    className="relative w-full aspect-[2/1] bg-white rounded-lg shadow-2xl flex flex-row overflow-hidden select-none border border-slate-300"
                  >
                    {/* 1. ÁREA ÚTIL DE IMPRESSÃO (8cm x 5cm = 80%) COMEÇANDO DA DIREITA PARA A ESQUERDA */}
                    <div className="w-[80%] h-full p-3 sm:p-4 flex flex-col justify-between overflow-hidden text-right items-end">
                      {/* Metadados: NF, Produto, Data (alinhados à direita junto ao logotipo) */}
                      <div className="space-y-1 w-full text-right">
                        <div className="text-black font-black text-xs sm:text-sm md:text-base uppercase tracking-tight font-sans text-right">
                          NF: {dadosEtiqueta.notaFiscal || '174619'}
                        </div>
                        <div className="text-black font-extrabold text-[11px] sm:text-xs md:text-sm uppercase tracking-tight font-sans break-words line-clamp-2 text-right">
                          PRODUTO: {dadosEtiqueta.produto || 'W94010'}
                        </div>
                        <div className="text-black font-bold text-[10px] sm:text-xs uppercase tracking-tight font-sans text-right">
                          DATA: {dadosEtiqueta.data}
                        </div>
                      </div>

                      {/* Texto AVARIA em tamanho grande e com bastante destaque */}
                      <div className="w-full text-right py-1">
                        <div className="text-black font-black text-2xl sm:text-3xl md:text-4xl tracking-widest uppercase font-sans leading-none text-right">
                          AVARIA
                        </div>
                      </div>
                    </div>

                    {/* 2. ÁREA DE 2CM RESERVADA PARA O LOGOTIPO PRÉ-IMPRESSO AO LADO DIREITO */}
                    <div
                      className="w-[20%] h-full bg-slate-100/90 border-l-2 border-dashed border-slate-300 flex flex-col items-center justify-center p-2 text-center"
                      title="Área de 2cm reservada na bobina para o logotipo pré-impresso da empresa. Nada é impresso aqui."
                    >
                      <div className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-tight leading-tight">
                        Área Reservada
                      </div>
                      <div className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-tight mt-1">
                        Logotipo (2 cm)
                      </div>
                      <div className="text-[7px] text-slate-400 italic mt-1 leading-tight">
                        Livre de impressão
                      </div>
                    </div>

                    {/* Indicador sutil de simulação térmica */}
                    <div className="absolute top-1 left-2 text-[7px] font-mono text-slate-300 font-bold uppercase pointer-events-none">
                      ZEBRA 80×50mm ÚTIL
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 text-center mt-2">
                  O logotipo pré-impresso na bobina térmica fica ao lado direito (2 cm). A área útil de impressão (8 × 5 cm) começa da direita para a esquerda, garantindo legibilidade perfeita e sem sobreposição.
                </p>
              </div>

              {/* INTEGRAÇÃO TÉCNICA ZPL */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                  <span>Código ZPL II (Zebra Programming Language):</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleCopiarZpl}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-[10px] font-mono"
                      title="Copiar código ZPL para a área de transferência"
                    >
                      {zplCopiado ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copiar ZPL</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleBaixarZpl}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-[10px] font-mono"
                      title="Baixar arquivo .zpl"
                    >
                      <Download className="w-3 h-3" />
                      <span>.zpl</span>
                    </button>
                  </div>
                </div>
                <div className="font-mono text-[9px] text-slate-500 bg-slate-900 p-2 rounded-xl overflow-x-auto max-h-16 border border-slate-800/80">
                  {zplGerado.slice(0, 160)}...
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RODAPÉ DO MODAL */}
        <div className="p-5 sm:p-6 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 text-center sm:text-left">
            <span>Compatível com impressoras térmicas Zebra ZD220, ZD230, GK420t e rede RAW.</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition min-h-[42px]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleImprimir}
              disabled={imprimindo}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-lg shadow-rose-600/25 min-h-[42px]"
            >
              <Printer className="w-4 h-4" />
              <span>{imprimindo ? 'Enviando para Impressora...' : 'Imprimir Etiqueta de Avaria'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
