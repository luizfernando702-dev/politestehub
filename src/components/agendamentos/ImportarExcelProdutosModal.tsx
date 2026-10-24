import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Layers,
  ChevronDown,
  ChevronUp,
  Database,
  FileCheck,
  RefreshCw,
  Download,
  Info,
  Sparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Agendamento, RecebimentoProduto } from '../../types';
import { normalizarNotaFiscal, recebimentoService } from '../../services/recebimentoService';
import { getLocalRecebimentosProdutos } from '../../services/mockStorage';
import {
  LinhaProdutoEntrada,
  ProdutoAgrupado,
  agruparProdutosExcel,
} from '../../utils/agrupamentoProdutos';

interface ImportarExcelProdutosModalProps {
  agendamento: Agendamento;
  onClose: () => void;
  onSuccess: (novosItens: RecebimentoProduto[]) => void;
}

export const ImportarExcelProdutosModal: React.FC<ImportarExcelProdutosModalProps> = ({
  agendamento,
  onClose,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [dragActive, setDragActive] = useState(false);
  const [arquivoNome, setArquivoNome] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroFatal, setErroFatal] = useState<string | null>(null);

  // Controle de agrupamento inteligente de produtos
  const [agruparSemelhantes, setAgruparSemelhantes] = useState(true);
  const [linhaExpandida, setLinhaExpandida] = useState<string | null>(null);

  // Linhas brutas lidas do Excel
  const [linhasBrutas, setLinhasBrutas] = useState<LinhaProdutoEntrada[]>([]);
  const [notaFiscalIdentificada, setNotaFiscalIdentificada] = useState<string | null>(null);
  const [origemNotaFiscal, setOrigemNotaFiscal] = useState<'arquivo' | 'agendamento'>('arquivo');
  const [produtosJaExistentes, setProdutosJaExistentes] = useState<number>(0);

  const agendamentoNf = agendamento.nota_fiscal || agendamento.notaFiscal || '';

  // Helper para identificar colunas flexíveis do Excel
  const localizarColuna = (headers: string[], regex: RegExp): string | null => {
    return headers.find((h) => regex.test(h)) || null;
  };

  // Cálculo memoizado de agrupamento inteligente
  const dadosAgrupamento = useMemo(() => {
    if (linhasBrutas.length === 0) {
      return {
        itensAgrupados: [],
        totalLinhasOriginais: 0,
        totalItensAgrupados: 0,
        qtdLinhasConsolidadas: 0,
      };
    }
    return agruparProdutosExcel(linhasBrutas);
  }, [linhasBrutas]);

  // Lista final a ser considerada (agrupada ou individual)
  const itensExibicao = useMemo(() => {
    if (agruparSemelhantes) {
      return dadosAgrupamento.itensAgrupados;
    }
    // Formata linhas brutas no formato compatível de exibição
    return linhasBrutas.map((l) => ({
      idTemp: `linha-${l.linha}`,
      produto: l.produto,
      quantidade: l.quantidade,
      endereco: l.endereco,
      nota_fiscal: l.nota_fiscal,
      valido: l.valido,
      erro: l.erro,
      linhasOriginais: [l.linha],
      detalhesLinhas: [
        {
          linha: l.linha,
          produtoOriginal: l.produto,
          quantidade: l.quantidade,
          endereco: l.endereco,
        },
      ],
      foiAgrupado: false,
      qtdLinhasAgrupadas: 1,
    }));
  }, [agruparSemelhantes, dadosAgrupamento.itensAgrupados, linhasBrutas]);

  const totalValidas = useMemo(() => {
    return itensExibicao.filter((i) => i.valido).length;
  }, [itensExibicao]);

  const totalInvalidas = useMemo(() => {
    return itensExibicao.filter((i) => !i.valido).length;
  }, [itensExibicao]);

  const processarArquivo = async (file: File) => {
    setErroFatal(null);
    setLinhasBrutas([]);
    setNotaFiscalIdentificada(null);
    setProcessando(true);
    setArquivoNome(file.name);
    setLinhaExpandida(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('A planilha está vazia ou corrompida.');
      }

      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, {
        defval: '',
        raw: false,
      });

      if (!rawRows || rawRows.length === 0) {
        throw new Error('Nenhuma linha de dados encontrada na primeira aba da planilha.');
      }

      // Identificar colunas pelos cabeçalhos
      const headers = Object.keys(rawRows[0] || {});

      // 1. Endereço: "Unidade de negócio > Endereço" ou "Localização padrão na Unidade de negócio" ou "Endereço"
      const colEndereco = localizarColuna(
        headers,
        /(unidade.*neg[oó]cio.*endere[cç]o)|(localiza[cç][aã]o.*padr[aã]o)|(endere[cç]o)|(localiza[cç][aã]o)|(posi[cç][aã]o)/i
      );

      // 2. Produto - Código ou Coluna Específica de Código
      const colCodigo = localizarColuna(
        headers,
        /(produto.*c[oó]digo)|(^c[oó]digo(\s*do\s*produto)?$)|(^c[oó]d\.?$)|(^ref(\.?|\b))/i
      );

      // 3. Produto - Descrição ou Nome
      const colDescricao = localizarColuna(
        headers,
        /(descri[cç][aã]o.*produto)|(nome.*produto)|(^descri[cç][aã]o$)|(^item$)|(^material$)/i
      );

      // 4. Coluna Geral de Produto (caso não tenha colunas separadas)
      const colProdutoGeral = localizarColuna(
        headers,
        /(^produto$)|(produto.*nome)|(item.*descri)/i
      );

      const colProdutoFinal = colCodigo || colDescricao || colProdutoGeral;

      // 5. Quantidade: "Item NF - Qtd.Fiscal", "Qtd.Fiscal", "Quantidade", "Qtd Compra", "Qtd Pedido"
      const colQtd = localizarColuna(
        headers,
        /(item.*nf.*qtd.*fiscal)|(qtd.*fiscal)|(quantidade.*fiscal)|(^quantidade$)|(^qtd$)|(qtd.*compra)|(qtd.*ped)|(quantidade.*pedido)/i
      );

      // 6. Nota Fiscal: "NF - Número", "Nota Fiscal", "NF", "Documento"
      const colNF = localizarColuna(
        headers,
        /(nf.*n[uú]mero)|(^nota.*fiscal$)|(^nf$)|(^n[uú]mero.*nf$)|(num.*nf)|(^documento$)/i
      );

      const errosColunas: string[] = [];
      if (!colProdutoFinal) errosColunas.push('"Produto / Código / Descrição"');
      if (!colQtd) errosColunas.push('"Quantidade / Qtd. Fiscal"');

      if (errosColunas.length > 0) {
        throw new Error(
          `Colunas obrigatórias não encontradas no arquivo: ${errosColunas.join(', ')}. Verifique o formato do relatório exportado.`
        );
      }

      const linhasProcessadas: LinhaProdutoEntrada[] = [];
      let nfDoArquivo: string | null = null;
      let nfDivergenteDetectada: string | null = null;

      rawRows.forEach((row, idx) => {
        const linhaNum = idx + 2; // Linha 1 é cabeçalho

        // Monta a descrição do produto (suporta código + descrição se separados)
        let rawProd = '';
        if (colCodigo && colDescricao && colCodigo !== colDescricao) {
          const cod = String(row[colCodigo] || '').trim();
          const desc = String(row[colDescricao] || '').trim();
          if (cod && desc) {
            rawProd = `${cod} - ${desc}`;
          } else {
            rawProd = cod || desc;
          }
        } else if (colProdutoFinal) {
          rawProd = String(row[colProdutoFinal] || '').trim();
        }

        const rawQtd = String(row[colQtd!] || '').trim().replace(',', '.');
        const rawNF = colNF ? String(row[colNF] || '').trim() : '';
        const rawEnd = colEndereco ? String(row[colEndereco] || '').trim() : '';

        // Ignora linhas totalmente vazias
        if (!rawProd && !rawQtd && !rawNF) return;

        let erro: string | undefined;

        // Validação da Nota Fiscal:
        // Se a planilha possui a coluna de NF, verifica consistência.
        // Se a planilha é um pedido de compra sem coluna de NF, vincula automaticamente à NF deste agendamento.
        if (rawNF) {
          if (!nfDoArquivo) {
            nfDoArquivo = rawNF;
          }
          const nfArquivoNorm = normalizarNotaFiscal(rawNF);
          const agendamentoNfNorm = normalizarNotaFiscal(agendamentoNf);

          if (agendamentoNfNorm && nfArquivoNorm !== agendamentoNfNorm) {
            nfDivergenteDetectada = rawNF;
            erro = `NF "${rawNF}" não corresponde à NF "${agendamentoNf}" deste agendamento.`;
          }
        }

        const qtdNum = Number(rawQtd);
        if (!erro && (!rawQtd || isNaN(qtdNum) || qtdNum <= 0)) {
          erro = `Quantidade fiscal inválida: "${rawQtd}".`;
        }

        if (!erro && !rawProd) {
          erro = 'Código/descrição do produto não informado.';
        }

        const valido = !erro;

        linhasProcessadas.push({
          linha: linhaNum,
          produto: rawProd || '(Vazio)',
          quantidade: isNaN(qtdNum) ? 0 : qtdNum,
          endereco: rawEnd || null,
          nota_fiscal: rawNF || agendamentoNf,
          valido,
          erro,
        });
      });

      if (nfDoArquivo) {
        setNotaFiscalIdentificada(nfDoArquivo);
        setOrigemNotaFiscal('arquivo');
      } else {
        setNotaFiscalIdentificada(agendamentoNf);
        setOrigemNotaFiscal('agendamento');
      }

      // REGRA CRÍTICA: Se a nota fiscal for expressamente diferente, NÃO IMPORTAR
      if (nfDivergenteDetectada) {
        throw new Error(
          `A nota fiscal indicada no arquivo (${nfDivergenteDetectada}) não corresponde à nota fiscal deste agendamento (${agendamentoNf}).`
        );
      }

      if (linhasProcessadas.length === 0) {
        throw new Error('Nenhuma linha de produto válida encontrada no arquivo.');
      }

      // Verifica se já existem produtos cadastrados para esta nota
      const produtosCadastrados = getLocalRecebimentosProdutos();
      const jaExistem = produtosCadastrados.filter(
        (p) =>
          normalizarNotaFiscal(p.nota_fiscal) === normalizarNotaFiscal(agendamentoNf) ||
          String(p.agendamento_id) === String(agendamento.id)
      ).length;
      setProdutosJaExistentes(jaExistem);

      setLinhasBrutas(linhasProcessadas);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar arquivo Excel.';
      setErroFatal(msg);
      setLinhasBrutas([]);
    } finally {
      setProcessando(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processarArquivo(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processarArquivo(e.target.files[0]);
    }
  };

  const handleConfirmarImportacao = async () => {
    const itensValidos = itensExibicao.filter((l) => l.valido);

    if (itensValidos.length === 0) {
      setErroFatal('Não há produtos válidos para importação.');
      return;
    }

    try {
      setSalvando(true);
      setErroFatal(null);

      const resultado = await recebimentoService.salvarImportacaoExcel({
        agendamentoId: agendamento.id,
        notaFiscal: agendamentoNf,
        dataRecebimento: agendamento.data_prevista || agendamento.data || new Date().toISOString().slice(0, 10),
        itens: itensValidos.map((i) => ({
          produto: i.produto,
          quantidade: i.quantidade,
          endereco: i.endereco,
          nota_fiscal: agendamentoNf,
        })),
      });

      onSuccess(resultado.itens);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar produtos da nota fiscal.';
      setErroFatal(msg);
    } finally {
      setSalvando(false);
    }
  };

  // Baixa modelo de exemplo com casos de pedidos de compra para testar agrupamento
  const handleBaixarModeloExemplo = () => {
    const dadosExemplo = [
      {
        'NF - Número': agendamentoNf,
        'Produto - Código': 'POLI-FILTRO-AR-450',
        'Item NF - Qtd.Fiscal': 20,
        'Unidade de negócio > Endereço': 'A-01-01',
      },
      {
        'NF - Número': agendamentoNf,
        'Produto - Código': 'POLI-FILTRO-AR-450',
        'Item NF - Qtd.Fiscal': 15,
        'Unidade de negócio > Endereço': 'A-01-01',
      },
      {
        'NF - Número': agendamentoNf,
        'Produto - Código': 'POLI-ELEMENTO-OLEO-90',
        'Item NF - Qtd.Fiscal': 35,
        'Unidade de negócio > Endereço': 'A-02-04',
      },
      {
        'NF - Número': agendamentoNf,
        'Produto - Código': 'W7MULTI34S',
        'Item NF - Qtd.Fiscal': 10,
        'Unidade de negócio > Endereço': 'A-02-01',
      },
      {
        'NF - Número': agendamentoNf,
        'Produto - Código': 'W7MULTI34D',
        'Item NF - Qtd.Fiscal': 8,
        'Unidade de negócio > Endereço': 'A-02-02',
      },
      {
        'NF - Número': agendamentoNf,
        'Produto - Código': 'POLI-VALVULA-PRESSAO-12',
        'Item NF - Qtd.Fiscal': 10,
        'Unidade de negócio > Endereço': 'B-01-02',
      },
      {
        'NF - Número': agendamentoNf,
        'Produto - Código': 'POLI-VALVULA-PRESSAO-12',
        'Item NF - Qtd.Fiscal': 5,
        'Unidade de negócio > Endereço': 'B-01-02',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(dadosExemplo);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
    XLSX.writeFile(wb, `modelo_importacao_NF_${agendamentoNf || 'exemplo'}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Importar Produtos pelo Excel
                </h3>
                <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Agrupamento por Descrição
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Agendamento para NF:{' '}
                <strong className="text-emerald-400 font-mono">{agendamentoNf}</strong> (
                {agendamento.fornecedor})
              </p>
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
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Alerta de Erro Fatal */}
          {erroFatal && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block">Falha na Validação do Arquivo:</span>
                <span>{erroFatal}</span>
              </div>
            </div>
          )}

          {/* Área de Upload (Drag and Drop + Botão) */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-3xl p-6 text-center transition ${
              dragActive
                ? 'border-emerald-400 bg-emerald-500/10'
                : 'border-slate-700 bg-slate-950/40 hover:border-slate-600'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileInput}
              className="hidden"
            />

            <UploadCloud className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <h4 className="text-sm sm:text-base font-bold text-white mb-1">
              Arraste sua planilha Excel aqui ou clique para selecionar
            </h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto mb-3 leading-relaxed">
              Suporta planilhas de pedidos de compra e notas fiscais com colunas de código, descrição, quantidade fiscal e endereço.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={processando || salvando}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition min-h-[44px]"
              >
                {processando ? 'Lendo arquivo...' : 'Selecionar Arquivo Excel (.xlsx)'}
              </button>

              <button
                type="button"
                onClick={handleBaixarModeloExemplo}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs border border-slate-700 transition flex items-center gap-1.5 min-h-[44px]"
                title="Baixar planilha modelo com exemplo de itens agrupados"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Modelo com Agrupamento</span>
              </button>
            </div>

            {arquivoNome && (
              <div className="mt-3 text-xs text-emerald-400 font-mono flex items-center justify-center gap-1.5">
                <FileCheck className="w-4 h-4" />
                <span>Arquivo selecionado: {arquivoNome}</span>
              </div>
            )}
          </div>

          {/* Controle do Agrupamento Inteligente (visível após carregar arquivo) */}
          {linhasBrutas.length > 0 && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <label className="text-xs sm:text-sm font-bold text-white flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agruparSemelhantes}
                        onChange={(e) => setAgruparSemelhantes(e.target.checked)}
                        className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Agrupar produtos com a mesma descrição do pedido</span>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        Ativo
                      </span>
                    </label>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Soma as quantidades de linhas com descrições idênticas no pedido de compra, consolidando no item único da NF. Não mistura produtos com códigos ou especificações distintas (ex: W7MULTI34S e W7MULTI34D permanecem separados).
                    </p>
                  </div>
                </div>

                {agruparSemelhantes && dadosAgrupamento.qtdLinhasConsolidadas > 0 && (
                  <div className="sm:text-right shrink-0 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-1.5">
                    <span className="text-[10px] uppercase font-bold text-blue-400 block">
                      Consolidação
                    </span>
                    <span className="text-xs font-mono font-bold text-white">
                      {dadosAgrupamento.qtdLinhasConsolidadas}{' '}
                      {dadosAgrupamento.qtdLinhasConsolidadas === 1 ? 'linha agrupada' : 'linhas agrupadas'}
                    </span>
                  </div>
                )}
              </div>

              {agruparSemelhantes && dadosAgrupamento.qtdLinhasConsolidadas > 0 && (
                <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs flex items-center gap-2">
                  <Info className="w-4 h-4 shrink-0 text-sky-400" />
                  <span>
                    <strong>{linhasBrutas.length} linhas</strong> do pedido foram agrupadas em{' '}
                    <strong>{dadosAgrupamento.itensAgrupados.length} itens únicos</strong> para a Nota Fiscal, com quantidades fiscais somadas.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Aviso de Registros Existentes */}
          {produtosJaExistentes > 0 && linhasBrutas.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <span className="font-bold block">Atenção para registros existentes:</span>
                <span>
                  Esta nota fiscal já possui <strong>{produtosJaExistentes} produto(s)</strong>{' '}
                  cadastrados no sistema. Os novos produtos importados serão adicionados ao
                  recebimento.
                </span>
              </div>
            </div>
          )}

          {/* Resumo Estatístico */}
          {linhasBrutas.length > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Linhas do Arquivo
                  </span>
                  <span className="text-base sm:text-lg font-black font-mono text-slate-200">
                    {linhasBrutas.length}
                  </span>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Itens na NF
                  </span>
                  <span className="text-base sm:text-lg font-black font-mono text-emerald-400">
                    {itensExibicao.length}
                  </span>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Agrupadas
                  </span>
                  <span className="text-base sm:text-lg font-black font-mono text-sky-400">
                    {agruparSemelhantes ? dadosAgrupamento.qtdLinhasConsolidadas : 0}
                  </span>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Inconsistências
                  </span>
                  <span
                    className={`text-base sm:text-lg font-black font-mono ${
                      totalInvalidas > 0 ? 'text-rose-400' : 'text-slate-400'
                    }`}
                  >
                    {totalInvalidas}
                  </span>
                </div>
              </div>

              {/* Tabela de Prévia dos Dados */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                <div className="p-2.5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-300">
                      Prévia dos Produtos a Importar ({itensExibicao.length} itens)
                    </span>
                    {agruparSemelhantes && (
                      <span className="text-[10px] text-blue-400 font-medium">
                        (Clique nos itens agrupados para ver as linhas somadas)
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Mostrando até 50 itens
                  </span>
                </div>

                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-900 text-slate-400 border-b border-slate-800 text-[10px] uppercase tracking-wider">
                      <tr>
                        <th className="p-2.5">Origem / Linha</th>
                        <th className="p-2.5">Produto (Descrição / Código)</th>
                        <th className="p-2.5 text-right">Qtd. Fiscal</th>
                        <th className="p-2.5">Endereço</th>
                        <th className="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {itensExibicao.slice(0, 50).map((item, idx) => {
                        const isExpanded = linhaExpandida === item.idTemp;
                        return (
                          <React.Fragment key={item.idTemp || idx}>
                            <tr
                              onClick={() => {
                                if (item.foiAgrupado) {
                                  setLinhaExpandida(isExpanded ? null : item.idTemp);
                                }
                              }}
                              className={`transition ${
                                item.foiAgrupado ? 'cursor-pointer hover:bg-slate-800/50' : 'hover:bg-slate-800/20'
                              } ${!item.valido ? 'bg-rose-500/5' : ''}`}
                            >
                              <td className="p-2.5 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                {item.foiAgrupado ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold">
                                    <Layers className="w-3 h-3" />
                                    <span>{item.qtdLinhasAgrupadas} linhas</span>
                                    {isExpanded ? (
                                      <ChevronUp className="w-3 h-3 ml-0.5" />
                                    ) : (
                                      <ChevronDown className="w-3 h-3 ml-0.5" />
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">
                                    Linha {item.linhasOriginais[0]}
                                  </span>
                                )}
                              </td>

                              <td className="p-2.5 text-slate-200 font-medium max-w-[240px]">
                                <div className="truncate text-xs" title={item.produto}>
                                  {item.produto}
                                </div>
                                {item.foiAgrupado && (
                                  <div className="text-[10px] text-blue-400/90 flex items-center gap-1 mt-0.5">
                                    <span>Linhas no Excel: {item.linhasOriginais.join(', ')}</span>
                                  </div>
                                )}
                              </td>

                              <td className="p-2.5 text-right font-mono font-bold text-white whitespace-nowrap">
                                <span className={item.foiAgrupado ? 'text-sky-300' : ''}>
                                  {item.quantidade} un
                                </span>
                              </td>

                              <td className="p-2.5 font-mono text-sky-400 text-[11px] whitespace-nowrap">
                                {item.endereco ? (
                                  <span className="bg-sky-950/70 border border-sky-800/50 px-1.5 py-0.5 rounded">
                                    {item.endereco}
                                  </span>
                                ) : (
                                  <span className="text-slate-600">—</span>
                                )}
                              </td>

                              <td className="p-2.5 text-center whitespace-nowrap">
                                {item.valido ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                    <CheckCircle2 className="w-3 h-3" /> Válido
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 text-[10px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded"
                                    title={item.erro}
                                  >
                                    <AlertTriangle className="w-3 h-3" /> {item.erro}
                                  </span>
                                )}
                              </td>
                            </tr>

                            {/* Detalhamento expandido das linhas originais agrupadas */}
                            {isExpanded && item.foiAgrupado && (
                              <tr className="bg-slate-900/90 border-b border-blue-500/20">
                                <td colSpan={5} className="p-3 pl-8">
                                  <div className="bg-slate-950/90 border border-blue-500/30 rounded-xl p-3 space-y-2 text-xs">
                                    <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1.5">
                                      <span className="font-bold text-blue-300 flex items-center gap-1">
                                        <Layers className="w-3.5 h-3.5" />
                                        Desdobramento das {item.qtdLinhasAgrupadas} linhas no pedido de compra:
                                      </span>
                                      <span className="font-mono text-emerald-400 font-bold">
                                        Total Somado: {item.quantidade} un
                                      </span>
                                    </div>
                                    <div className="space-y-1">
                                      {item.detalhesLinhas.map((detalhe, dIdx) => (
                                        <div
                                          key={dIdx}
                                          className="flex items-center justify-between text-[11px] font-mono py-1 px-2 rounded bg-slate-900/60"
                                        >
                                          <div className="flex items-center gap-2 text-slate-300">
                                            <span className="text-blue-400 font-bold">
                                              Linha {detalhe.linha}:
                                            </span>
                                            <span className="text-slate-200 font-sans truncate max-w-[280px]">
                                              {detalhe.produtoOriginal}
                                            </span>
                                            {detalhe.endereco && (
                                              <span className="text-sky-400 text-[10px]">
                                                [{detalhe.endereco}]
                                              </span>
                                            )}
                                          </div>
                                          <span className="text-white font-bold ml-3 shrink-0">
                                            + {detalhe.quantidade} un
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs transition min-h-[44px]"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirmarImportacao}
            disabled={totalValidas === 0 || salvando}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/25 transition flex items-center gap-2 min-h-[44px]"
          >
            {salvando ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Gravando no Sistema...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Confirmar Importação ({totalValidas} itens
                  {agruparSemelhantes && dadosAgrupamento.qtdLinhasConsolidadas > 0
                    ? ` • ${dadosAgrupamento.qtdLinhasConsolidadas} agrupadas`
                    : ''}
                  )
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

