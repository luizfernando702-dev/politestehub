import React, { useState, useEffect, useMemo } from 'react';
import {
  Printer,
  X,
  Package,
  FileText,
  Calendar,
  Layers,
  MapPin,
  Check,
  AlertTriangle,
  Copy,
  Download,
  QrCode,
  ShieldCheck,
  Hash,
  Info,
  ChevronLeft,
  ChevronRight,
  ListOrdered,
} from 'lucide-react';
import { Agendamento, RecebimentoProduto, RegistroEndereco } from '../../types';
import { DadosEtiquetaProdutoAgendamento } from '../../types/impressao';
import { zebraPrintService } from '../../services/zebraPrintService';
import { enderecosService } from '../../services/enderecosService';
import { isProdutoImportadoExcel } from '../../services/recebimentoService';

interface ConfiguracaoEtiquetaProdutoAgendamentoModalProps {
  produtos: RecebimentoProduto[];
  agendamento: Agendamento;
  onClose: () => void;
}

export const ConfiguracaoEtiquetaProdutoAgendamentoModal: React.FC<
  ConfiguracaoEtiquetaProdutoAgendamentoModalProps
> = ({ produtos, agendamento, onClose }) => {
  // Utiliza os produtos passados via props (já filtrados ou com fallback)
  const produtosElegiveis = useMemo(() => {
    if (!produtos || produtos.length === 0) return [];
    const filtrados = produtos.filter((p) => isProdutoImportadoExcel(p));
    // Se a lista passada já contém os produtos do agendamento, preserva-a
    return filtrados.length > 0 ? filtrados : produtos;
  }, [produtos]);

  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const [copias, setCopias] = useState(1);
  const [imprimindo, setImprimindo] = useState(false);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);
  const [erroMsg, setErroMsg] = useState<string | null>(null);
  const [zplCopiado, setZplCopiado] = useState(false);

  // Mapa de endereços customizados para produtos que ainda não possuem endereço
  const [enderecosCustom, setEnderecosCustom] = useState<Record<string, string>>({});
  const [enderecosDisponiveis, setEnderecosDisponiveis] = useState<RegistroEndereco[]>([]);
  const [qrCodesMap, setQrCodesMap] = useState<Record<string, string>>({});

  // NF do agendamento
  const nfAgendamento = useMemo(() => {
    return (agendamento.nota_fiscal || agendamento.notaFiscal || '').trim();
  }, [agendamento]);

  const dataRecebimento = useMemo(() => {
    return (
      agendamento.dataAgendada ||
      agendamento.data_prevista ||
      agendamento.data ||
      new Date().toISOString().slice(0, 10)
    );
  }, [agendamento]);

  // Carrega catálogo de endereços
  useEffect(() => {
    let montado = true;
    async function carregarEnderecos() {
      try {
        const lista = await enderecosService.listar({ status: 'ativos' });
        if (montado) setEnderecosDisponiveis(lista);
      } catch (err) {
        console.warn('Erro ao carregar endereços para seleção na etiqueta:', err);
      }
    }
    carregarEnderecos();
    return () => {
      montado = false;
    };
  }, []);

  // Gera os QR Codes para todos os produtos elegíveis
  useEffect(() => {
    let montado = true;
    async function gerarTodosQrCodes() {
      const mapa: Record<string, string> = {};
      for (const p of produtosElegiveis) {
        if (p.produto && !mapa[p.produto]) {
          const url = await zebraPrintService.gerarQrCodeDataUrl(p.produto.trim());
          mapa[p.produto] = url;
        }
      }
      if (montado) {
        setQrCodesMap(mapa);
      }
    }
    if (produtosElegiveis.length > 0) {
      gerarTodosQrCodes();
    }
    return () => {
      montado = false;
    };
  }, [produtosElegiveis]);

  // Lista consolidada de dados para todas as etiquetas
  const listaDadosEtiquetas: DadosEtiquetaProdutoAgendamento[] = useMemo(() => {
    return produtosElegiveis.map((p) => {
      const nfItem = (p.nota_fiscal || nfAgendamento).trim();
      const dataItem = p.data_recebimento || dataRecebimento;
      const endItem = (enderecosCustom[p.id] || p.endereco || '').trim();
      const numeral = zebraPrintService.comporNumeralIdentificador(
        dataItem,
        nfItem,
        p.quantidade
      );
      return {
        produto: p.produto.trim(),
        notaFiscal: nfItem,
        quantidade: Number(p.quantidade) || 0,
        endereco: endItem,
        data: dataItem,
        numeralIdentificador: numeral,
        qrCodeDataUrl: qrCodesMap[p.produto] || '',
        copias,
      };
    });
  }, [produtosElegiveis, nfAgendamento, dataRecebimento, enderecosCustom, qrCodesMap, copias]);

  // Produto selecionado no carrossel de pré-visualização
  const produtoAtual = produtosElegiveis[indiceAtivo] || produtosElegiveis[0];
  const dadosAtual = listaDadosEtiquetas[indiceAtivo] || listaDadosEtiquetas[0];

  // Gera ZPL do item ativo ou do lote
  const zplItemAtual = useMemo(() => {
    if (!dadosAtual) return '';
    return zebraPrintService.gerarZplProdutoAgendamento(dadosAtual);
  }, [dadosAtual]);

  const zplLoteCompleto = useMemo(() => {
    if (listaDadosEtiquetas.length === 0) return '';
    return listaDadosEtiquetas
      .map((item) => zebraPrintService.gerarZplProdutoAgendamento(item))
      .join('\n');
  }, [listaDadosEtiquetas]);

  // Validação do lote
  const validacao = useMemo(() => {
    const erros: string[] = [];
    if (produtosElegiveis.length === 0) {
      erros.push('Não há produtos importados via Excel elegíveis para impressão.');
      return { valido: false, erros };
    }

    listaDadosEtiquetas.forEach((item, idx) => {
      if (!item.produto) {
        erros.push(`Linha #${idx + 1}: Produto sem descrição.`);
      }
      if (!item.notaFiscal) {
        erros.push(`Linha #${idx + 1} (${item.produto}): NF não informada.`);
      }
      if (!item.quantidade || item.quantidade <= 0) {
        erros.push(`Linha #${idx + 1} (${item.produto}): Quantidade inválida.`);
      }
    });

    return {
      valido: erros.length === 0,
      erros,
    };
  }, [produtosElegiveis, listaDadosEtiquetas]);

  // Disparo centralizado de impressão de todas as etiquetas da nota de uma só vez
  const handleImprimirTodas = async () => {
    if (!validacao.valido) {
      setErroMsg(validacao.erros.join(' '));
      return;
    }

    try {
      setImprimindo(true);
      setErroMsg(null);
      setSucessoMsg(null);

      const res = await zebraPrintService.imprimirLoteProdutosAgendamento(listaDadosEtiquetas);

      if (res.sucesso) {
        setSucessoMsg(
          `Sucesso! Todas as ${listaDadosEtiquetas.length} etiqueta(s) da nota fiscal foram enviadas para impressão Zebra.`
        );
      } else {
        setErroMsg(res.mensagem || 'Falha ao processar a impressão em lote das etiquetas.');
      }
    } catch (err: any) {
      console.error('Erro na impressão de etiquetas da nota:', err);
      setErroMsg(err?.message || 'Erro inesperado na comunicação com o spooler de impressão.');
    } finally {
      setImprimindo(false);
    }
  };

  const handleCopiarZpl = async () => {
    const copiou = await zebraPrintService.copiarZpl(zplLoteCompleto);
    if (copiou) {
      setZplCopiado(true);
      setTimeout(() => setZplCopiado(false), 2500);
    }
  };

  const handleBaixarZpl = () => {
    const nfLimpa = nfAgendamento || 'lote';
    const nome = `etiquetas_nota_${nfLimpa}_${listaDadosEtiquetas.length}_itens.zpl`;
    zebraPrintService.baixarArquivoZpl(nome, zplLoteCompleto);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="etiqueta-produto-agendamento-title"
    >
      <div
        className="relative w-full max-w-4xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="etiqueta-produto-agendamento-title"
                  className="text-lg sm:text-xl font-black text-white tracking-tight"
                >
                  Etiquetas Zebra — Produtos da Nota Fiscal
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase">
                  Térmica 10cm × 5cm
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                  Lote Completo ({produtosElegiveis.length} {produtosElegiveis.length === 1 ? 'Linha' : 'Linhas'})
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Área Útil 8 × 5 cm (Direita para Esquerda) &bull; 2 cm Reservados para Logotipo Pré-Impresso (Lado Direito) &bull; NF{' '}
                <strong className="text-slate-200">{nfAgendamento || 'Não informada'}</strong>
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
          {/* Mensagens de Alerta e Feedback */}
          {erroMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <strong className="font-bold">Aviso de validação:</strong> {erroMsg}
              </div>
            </div>
          )}

          {sucessoMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3 text-emerald-300 text-xs animate-in fade-in">
              <Check className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <div>
                <strong className="font-bold">Pronto:</strong> {sucessoMsg}
              </div>
            </div>
          )}

          {/* BARRA DE NAVEGAÇÃO DE LINHAS DE PRODUTOS */}
          {produtosElegiveis.length > 1 && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-slate-300">
                  Visualizando Linha {indiceAtivo + 1} de {produtosElegiveis.length} da Nota:
                </span>
                <span className="text-xs text-blue-300 font-bold truncate max-w-[200px] sm:max-w-xs">
                  {produtoAtual?.produto}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={indiceAtivo === 0}
                  onClick={() => setIndiceAtivo((prev) => Math.max(0, prev - 1))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  title="Linha anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono text-slate-400 px-1">
                  {indiceAtivo + 1} / {produtosElegiveis.length}
                </span>
                <button
                  type="button"
                  disabled={indiceAtivo >= produtosElegiveis.length - 1}
                  onClick={() => setIndiceAtivo((prev) => Math.min(produtosElegiveis.length - 1, prev + 1))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  title="Próxima linha"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* GRID COM CONTROLES E PRÉ-VISUALIZAÇÃO */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* COLUNA ESQUERDA: LISTAGEM DE ITENS E ESPECIFICAÇÕES */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Todas as Linhas da Nota ({produtosElegiveis.length})</span>
                  <span className="text-[10px] text-blue-400 font-mono">1 Etiqueta / Linha</span>
                </h3>

                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {produtosElegiveis.map((p, idx) => {
                    const ativo = idx === indiceAtivo;
                    const end = enderecosCustom[p.id] || p.endereco || 'Aguardando Alocação';
                    return (
                      <div
                        key={p.id || idx}
                        onClick={() => setIndiceAtivo(idx)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between gap-2 ${
                          ativo
                            ? 'bg-blue-600/15 border-blue-500/40 text-white'
                            : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold truncate text-[11px]">{p.produto}</p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            <span>Qtd: <strong className="text-slate-200">{p.quantidade} un</strong></span>
                            <span>•</span>
                            <span className="truncate">End: <strong className="text-sky-300 font-mono">{end}</strong></span>
                          </div>
                        </div>
                        {ativo && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold shrink-0">
                            Pré-visualizando
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Endereço da linha selecionada caso precise ajustar */}
              {produtoAtual && (
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-400" />
                      <span>Endereço do Produto Selecionado:</span>
                    </span>
                    <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded">
                      Linha #{indiceAtivo + 1}
                    </span>
                  </div>

                  <div className="font-mono text-sm font-bold text-white">
                    {enderecosCustom[produtoAtual.id] || produtoAtual.endereco || (
                      <span className="text-amber-400 font-normal">Aguardando Alocação</span>
                    )}
                  </div>

                  {enderecosDisponiveis.length > 0 && (
                    <select
                      value={enderecosCustom[produtoAtual.id] || produtoAtual.endereco || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEnderecosCustom((prev) => ({
                          ...prev,
                          [produtoAtual.id]: val,
                        }));
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-hidden focus:border-blue-500"
                    >
                      <option value="">Alterar ou selecionar endereço para esta linha...</option>
                      {enderecosDisponiveis.map((end) => (
                        <option key={end.id} value={end.endereco}>
                          {end.endereco} {end.descricao ? `(${end.descricao})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Seletor de Cópias de cada etiqueta */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-bold text-slate-300">Cópias por Linha:</span>
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
                    onClick={() => setCopias((prev) => Math.min(10, prev + 1))}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm flex items-center justify-center transition"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* COLUNA DIREITA: PRÉ-VISUALIZAÇÃO WYSIWYG DA ETIQUETA */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Printer className="w-3.5 h-3.5 text-blue-400" />
                    <span>Pré-Visualização (Etiqueta Térmica 10 × 5 cm)</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Área Útil 8 × 5 cm (Direita para Esquerda)
                  </span>
                </div>

                {/* CONTAINER VISUAL DA ETIQUETA ADESIVA (SIMULAÇÃO TÉRMICA 10x5cm) */}
                <div className="bg-slate-950 p-4 rounded-3xl border border-slate-800 flex items-center justify-center shadow-inner">
                  <div className="relative w-full aspect-[2/1] bg-white rounded-lg shadow-2xl flex flex-row overflow-hidden select-none border border-slate-300 text-black font-sans">
                    {/* 1. ÁREA ÚTIL DE IMPRESSÃO (8cm x 5cm = 80%) COMEÇANDO DA DIREITA PARA A ESQUERDA */}
                    <div className="w-[80%] h-full p-2.5 sm:p-3 flex flex-col justify-between overflow-hidden text-right items-end">
                      {/* Topo: Produto, NF e QR Code (Quantidade não exibida em linha separada) */}
                      <div className="w-full flex flex-row justify-between items-start gap-2">
                        {/* Texto: Produto e NF */}
                        <div className="flex-1 flex flex-col gap-1 text-right min-w-0">
                          {/* PRODUTO (Mesmo tamanho de fonte da NF) */}
                          <div className="text-black font-black text-xs sm:text-sm uppercase tracking-tight leading-tight line-clamp-2 break-words">
                            {dadosAtual?.produto || 'PRODUTO NÃO IDENTIFICADO'}
                          </div>

                          {/* NOTA FISCAL (Mesmo tamanho de fonte do Produto) */}
                          <div className="text-black font-black text-xs sm:text-sm uppercase tracking-tight">
                            NF: {dadosAtual?.notaFiscal || nfAgendamento}
                          </div>
                        </div>

                        {/* QR Code (Contém SOMENTE o nome do produto) */}
                        <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 flex items-center justify-center p-0.5 bg-white border border-slate-200 rounded">
                          {dadosAtual?.qrCodeDataUrl ? (
                            <img
                              src={dadosAtual.qrCodeDataUrl}
                              alt="QR Code do Produto"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <QrCode className="w-8 h-8 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {/* Bloco Intermediário: CONFERIDO (Destaque visual secundário) */}
                      <div className="w-full text-right py-0.5">
                        <div className="text-black font-black text-xs sm:text-sm tracking-widest uppercase leading-none font-sans">
                          C O N F E R I D O
                        </div>
                      </div>

                      {/* Bloco Principal: ENDEREÇO (MAIOR DESTAQUE VISUAL DA ETIQUETA) */}
                      <div className="w-full text-right py-0.5">
                        <div className="text-black font-black text-xl sm:text-2xl md:text-3xl tracking-tight uppercase leading-none font-sans break-words line-clamp-1">
                          {dadosAtual?.endereco || 'SEM ENDEREÇO'}
                        </div>
                      </div>

                      {/* Bloco Inferior: NUMERAL IDENTIFICADOR (Codifica diamesnotafiscal000quantidadeproduto) */}
                      <div className="w-full border-t border-slate-900 pt-1 text-right font-mono text-[8px] sm:text-[9.5px] font-black text-black tracking-widest">
                        {dadosAtual?.numeralIdentificador}
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
                  Layout atualizado: quantidade codificada no numeral (<strong className="text-slate-200 font-mono text-[10px]">{dadosAtual?.numeralIdentificador}</strong>). Área útil de 8 × 5 cm e 2 cm reservados para logotipo pré-impresso à direita.
                </p>
              </div>

              {/* INTEGRAÇÃO TÉCNICA ZPL */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                  <span>Código ZPL II (Lote de {listaDadosEtiquetas.length} Etiquetas):</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleCopiarZpl}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-[10px] font-mono"
                      title="Copiar código ZPL de todas as etiquetas"
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
                      title="Baixar arquivo .zpl completo"
                    >
                      <Download className="w-3 h-3" />
                      <span>.ZPL Lote</span>
                    </button>
                  </div>
                </div>
                <pre className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-400 overflow-x-auto max-h-20 select-all leading-relaxed">
                  {zplItemAtual}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* RODAPÉ COM AÇÕES */}
        <div className="p-5 sm:p-6 border-t border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>
              Impressão em lote: <strong>{listaDadosEtiquetas.length} etiqueta(s)</strong> (uma para cada linha de produto importado da nota fiscal).
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition min-h-[44px]"
            >
              Fechar
            </button>

            <button
              type="button"
              disabled={imprimindo || !validacao.valido || listaDadosEtiquetas.length === 0}
              onClick={handleImprimirTodas}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>
                {imprimindo
                  ? 'Enviando Lote para Impressora...'
                  : `Imprimir Todas as Etiquetas (${listaDadosEtiquetas.length})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
