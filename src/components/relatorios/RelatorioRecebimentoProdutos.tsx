import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Download,
  Printer,
  Calendar,
  Building2,
  CheckCircle2,
  Clock,
  PackageCheck,
  ClipboardCheck,
  AlertCircle,
  Loader2,
  ArrowRight,
  RotateCcw,
  Sparkles,
  MapPin,
  UserCheck,
  X,
  Copy,
  Check,
  Share2,
  MessageSquare,
} from 'lucide-react';
import { ResumoRelatorioRecebimento } from '../../types';
import {
  relatoriosService,
  formatarDataHora,
  formatarDataSimples,
  NotaDisponivelRelatorio,
} from '../../services/relatoriosService';

interface RelatorioRecebimentoProdutosProps {
  onVoltarCatalogo?: () => void;
}

export const RelatorioRecebimentoProdutos: React.FC<RelatorioRecebimentoProdutosProps> = ({
  onVoltarCatalogo,
}) => {
  // Parâmetros de Entrada
  const [notaFiscal, setNotaFiscal] = useState('');
  const [notasDisponiveis, setNotasDisponiveis] = useState<NotaDisponivelRelatorio[]>([]);
  const [loadingNotas, setLoadingNotas] = useState(false);

  // Estados de Execução
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [relatorio, setRelatorio] = useState<ResumoRelatorioRecebimento | null>(null);

  // Filtro de busca interna na listagem já gerada
  const [termoBusca, setTermoBusca] = useState('');

  // Estado para feedback de cópia do texto para WhatsApp
  const [copiadoWhatsApp, setCopiadoWhatsApp] = useState(false);

  // Carrega notas fiscais disponíveis para sugestões rápidas
  useEffect(() => {
    let ativo = true;
    async function carregarNfs() {
      setLoadingNotas(true);
      try {
        const nfs = await relatoriosService.listarNotasDisponiveis();
        if (ativo) {
          setNotasDisponiveis(nfs);
        }
      } catch (e) {
        console.warn('Erro ao listar notas para sugestão:', e);
      } finally {
        if (ativo) setLoadingNotas(false);
      }
    }
    carregarNfs();
    return () => {
      ativo = false;
    };
  }, []);

  const handleGerarRelatorio = async (nfParaConsultar?: string) => {
    const nfAlvo = (nfParaConsultar !== undefined ? nfParaConsultar : notaFiscal).trim();

    // VALIDAÇÃO ESTRITA: ANTES DE GERAR, É NECESSÁRIO INFORMAR A NOTA FISCAL
    if (!nfAlvo) {
      setErro('Por favor, informe o número da Nota Fiscal para gerar o relatório.');
      return;
    }

    setErro(null);
    setGerando(true);

    try {
      const resultado = await relatoriosService.gerarRelatorioRecebimentoPorNF(nfAlvo);
      setRelatorio(resultado);
      setTermoBusca('');
    } catch (err: any) {
      setErro(err.message || 'Erro ao gerar o relatório. Verifique a Nota Fiscal informada.');
      setRelatorio(null);
    } finally {
      setGerando(false);
    }
  };

  const handleSelecionarNotaChip = (nf: string) => {
    setNotaFiscal(nf);
    setErro(null);
    handleGerarRelatorio(nf);
  };

  const handleExportarExcel = () => {
    if (!relatorio) return;
    relatoriosService.exportarParaExcel(relatorio);
  };

  const handleExportarCSV = () => {
    if (!relatorio) return;
    relatoriosService.exportarParaCSV(relatorio);
  };

  const handleImprimir = () => {
    window.print();
  };

  const textoFormatadoWhatsApp = relatorio ? relatoriosService.gerarTextoWhatsApp(relatorio) : '';

  const handleCopiarTextoWhatsApp = async () => {
    if (!relatorio || !textoFormatadoWhatsApp) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textoFormatadoWhatsApp);
      } else {
        // Fallback para ambientes restritos de clipboard
        const textarea = document.createElement('textarea');
        textarea.value = textoFormatadoWhatsApp;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiadoWhatsApp(true);
      setTimeout(() => setCopiadoWhatsApp(false), 2800);
    } catch (err) {
      console.error('Falha ao copiar texto:', err);
    }
  };

  const handleAbrirWhatsAppWeb = () => {
    if (!textoFormatadoWhatsApp) return;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(textoFormatadoWhatsApp)}`;
    window.open(url, '_blank');
  };

  // Itens filtrados pela busca interna
  const itensFiltrados = (relatorio?.itens || []).filter((item) => {
    if (!termoBusca.trim()) return true;
    const termo = termoBusca.toLowerCase().trim();
    return (
      item.produto.toLowerCase().includes(termo) ||
      item.conferente_nome.toLowerCase().includes(termo) ||
      (item.conferente_codigo && item.conferente_codigo.toLowerCase().includes(termo)) ||
      item.repositor_nome.toLowerCase().includes(termo) ||
      (item.repositor_codigo && item.repositor_codigo.toLowerCase().includes(termo)) ||
      item.endereco.toLowerCase().includes(termo)
    );
  });

  return (
    <div className="space-y-6">
      {/* 1. SEÇÃO DE PARÂMETROS DE CONSULTA (OBRIGATÓRIO INFORMAR A NF ANTES DE GERAR) */}
      <section
        id="section-parametros-relatorio"
        className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 sm:p-6 shadow-xl relative overflow-hidden print:hidden"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
              <ClipboardCheck className="w-4 h-4" />
              <span>Conferência & Recebimento</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight mt-1">
              Relatório de Recebimento de Produtos
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Informe a Nota Fiscal obrigatória para obter os produtos, quantidades, conferente com data/hora e repositor com endereço.
            </p>
          </div>

          {onVoltarCatalogo && (
            <button
              type="button"
              id="btn-voltar-catalogo-topo"
              onClick={onVoltarCatalogo}
              className="self-start md:self-auto flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition"
            >
              <span>← Outros Relatórios</span>
            </button>
          )}
        </div>

        {/* Formulário de Nota Fiscal */}
        <div className="mt-5 space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleGerarRelatorio();
            }}
            className="flex flex-col sm:flex-row items-stretch gap-3"
          >
            <div className="relative flex-1">
              <label htmlFor="input-relatorio-nf" className="sr-only">
                Número da Nota Fiscal
              </label>
              <FileText className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="input-relatorio-nf"
                type="text"
                value={notaFiscal}
                onChange={(e) => {
                  setNotaFiscal(e.target.value);
                  if (erro) setErro(null);
                }}
                placeholder="Informe o número da Nota Fiscal (Ex: 001.993.520)..."
                className="w-full pl-11 pr-10 py-3.5 bg-slate-950 border border-slate-700/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-2xl text-sm text-white placeholder-slate-500 transition font-medium"
              />
              {notaFiscal && (
                <button
                  type="button"
                  id="btn-limpar-input-nf"
                  onClick={() => setNotaFiscal('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white rounded-lg"
                  title="Limpar campo"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              id="btn-gerar-relatorio-nf"
              disabled={gerando}
              className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition min-h-[48px] shrink-0"
            >
              {gerando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gerando Relatório...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>Gerar Relatório</span>
                </>
              )}
            </button>
          </form>

          {/* Mensagem de Erro / Validação */}
          {erro && (
            <div
              id="alerta-erro-relatorio"
              className="flex items-start gap-3 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-medium animate-in fade-in duration-200"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold text-rose-300 block mb-0.5">Validação Necessária:</span>
                <span>{erro}</span>
              </div>
            </div>
          )}

          {/* Chips de Sugestão de NFs disponíveis no sistema */}
          {notasDisponiveis.length > 0 && (
            <div className="pt-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Notas Fiscais identificadas no sistema (clique para carregar):</span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {notasDisponiveis.slice(0, 6).map((item) => (
                  <button
                    key={item.nota_fiscal}
                    type="button"
                    onClick={() => handleSelecionarNotaChip(item.nota_fiscal)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap transition ${
                      notaFiscal.trim() === item.nota_fiscal
                        ? 'bg-blue-600/30 border-blue-500 text-blue-200'
                        : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    <FileText className="w-3 h-3 text-blue-400" />
                    <span>NF {item.nota_fiscal}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 font-mono">
                      {item.total_itens} {item.total_itens === 1 ? 'item' : 'itens'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 2. RESULTADO DO RELATÓRIO GERADO */}
      {relatorio && (
        <section
          id="section-resultado-relatorio"
          className="space-y-5 animate-in fade-in duration-300"
        >
          {/* Cabeçalho do Relatório com Metadados e Indicadores */}
          <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 sm:p-6 shadow-xl relative print:border-none print:shadow-none print:p-0">
            {/* Topo institucional para Impressão */}
            <div className="hidden print:block mb-4 pb-4 border-b border-slate-300">
              <h1 className="text-xl font-black text-black">POLIFILTRO LOGÍSTICA — WMS</h1>
              <h2 className="text-sm font-bold text-slate-700">Relatório de Recebimento de Produtos por Nota Fiscal</h2>
              <p className="text-xs text-slate-500">Módulo de Recebimento & Armazenagem</p>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800/80 print:border-slate-300">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 print:border-black print:text-black">
                    Nota Fiscal
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight font-mono print:text-black">
                    {relatorio.nota_fiscal}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 print:text-slate-700 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Fornecedor:</span>
                    <strong className="text-slate-200 print:text-black font-semibold">
                      {relatorio.fornecedor}
                    </strong>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Data Recebimento:</span>
                    <strong className="text-slate-200 print:text-black font-mono">
                      {formatarDataSimples(relatorio.data_recebimento)}
                    </strong>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Emissão:</span>
                    <strong className="text-slate-200 print:text-black font-mono">
                      {formatarDataHora(relatorio.data_emissao_relatorio)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Botões de Ação de Exportação (Ocultos na impressão) */}
              <div className="flex flex-wrap items-center gap-2 print:hidden">
                <button
                  type="button"
                  id="btn-copiar-whatsapp-topo"
                  onClick={handleCopiarTextoWhatsApp}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-md transition min-h-[40px] ${
                    copiadoWhatsApp
                      ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                      : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-emerald-600/20'
                  }`}
                  title="Copiar mensagem pronta para envio no WhatsApp"
                >
                  {copiadoWhatsApp ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar p/ WhatsApp</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  id="btn-exportar-excel"
                  onClick={handleExportarExcel}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold border border-slate-700 transition min-h-[40px]"
                  title="Exportar planilha formatada em formato Excel (.xlsx)"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  id="btn-exportar-csv"
                  onClick={handleExportarCSV}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold border border-slate-700 transition min-h-[40px]"
                  title="Exportar dados em formato CSV para integração"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>CSV</span>
                </button>

                <button
                  type="button"
                  id="btn-imprimir-relatorio"
                  onClick={handleImprimir}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold border border-slate-700 transition min-h-[40px]"
                  title="Imprimir visualização formatada ou salvar como PDF"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-400" />
                  <span>Imprimir / PDF</span>
                </button>
              </div>
            </div>

            {/* Grid com 4 Indicadores Rápidos */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5 print:grid-cols-4">
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 print:border-slate-300">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Total de Itens
                </div>
                <div className="text-2xl font-black text-white font-mono print:text-black">
                  {relatorio.total_itens}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">produtos distintos</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 print:border-slate-300">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Quantidade Total
                </div>
                <div className="text-2xl font-black text-blue-400 font-mono print:text-black">
                  {relatorio.total_quantidade}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">peças / unidades na NF</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 print:border-slate-300">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Conferência</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-400 font-mono print:text-black">
                  {relatorio.total_conferidos}
                  <span className="text-xs font-normal text-slate-400 ml-1">/ {relatorio.total_itens}</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {relatorio.total_itens > 0
                    ? `${Math.round((relatorio.total_conferidos / relatorio.total_itens) * 100)}% conferido`
                    : '0%'}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 print:border-slate-300">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Reposição / Alocação</span>
                  <PackageCheck className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div className="text-2xl font-black text-sky-400 font-mono print:text-black">
                  {relatorio.total_alocados}
                  <span className="text-xs font-normal text-slate-400 ml-1">/ {relatorio.total_itens}</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {relatorio.total_itens > 0
                    ? `${Math.round((relatorio.total_alocados / relatorio.total_itens) * 100)}% alocado`
                    : '0%'}
                </div>
              </div>
            </div>
          </div>

          {/* 3. CAMPO DE TEXTO COPIA E COLA PARA DISPARO NO WHATSAPP */}
          <div
            id="secao-copia-cola-whatsapp"
            className="rounded-3xl bg-slate-900/90 border border-emerald-500/30 p-5 sm:p-6 shadow-xl relative overflow-hidden print:hidden"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <MessageSquare className="w-4 h-4" />
                  </span>
                  <h4 className="text-base font-bold text-white tracking-tight">
                    Texto para Disparo no WhatsApp (Carga Recebida)
                  </h4>
                </div>
                <p className="text-xs text-slate-400">
                  Campo de texto pronto para copiar e colar diretamente no grupo ou contato do WhatsApp com as informações da NF.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  id="btn-copiar-texto-whatsapp-box"
                  onClick={handleCopiarTextoWhatsApp}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-lg ${
                    copiadoWhatsApp
                      ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                      : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-emerald-600/20'
                  }`}
                >
                  {copiadoWhatsApp ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Texto Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar Texto</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  id="btn-abrir-whatsapp-web"
                  onClick={handleAbrirWhatsAppWeb}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold border border-slate-700 transition"
                  title="Abrir no WhatsApp Web / App com a mensagem preenchida"
                >
                  <Share2 className="w-4 h-4 text-emerald-400" />
                  <span>Enviar no WhatsApp</span>
                </button>
              </div>
            </div>

            {/* Campo de texto / Textarea com visualização e edição instantânea */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                <span>Formato WhatsApp (Data, Fornecedor, NF e Qtd - Produtos):</span>
                <span className="font-mono text-emerald-400">{relatorio.itens.length} {relatorio.itens.length === 1 ? 'item' : 'itens'}</span>
              </div>

              <div className="relative">
                <textarea
                  id="textarea-whatsapp-recebimento"
                  readOnly
                  rows={Math.min(10, Math.max(5, relatorio.itens.length + 5))}
                  value={textoFormatadoWhatsApp}
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs sm:text-sm leading-relaxed focus:border-emerald-500 focus:outline-none selection:bg-emerald-500/30 resize-y shadow-inner transition"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Dica: Clique dentro do campo para selecionar todo o texto ou use o botão <strong>Copiar Texto</strong>.</span>
                </div>
                {copiadoWhatsApp && (
                  <span className="text-emerald-400 font-medium animate-in fade-in">
                    Pronto para colar (Ctrl+V) no WhatsApp!
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Barra de Filtro de Busca Interna (para NFs com muitas linhas) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-3 rounded-2xl print:hidden">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                id="input-filtro-itens-relatorio"
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                placeholder="Filtrar por produto, conferente, repositor ou endereço..."
                className="w-full pl-9 pr-9 py-2 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl text-xs text-white placeholder-slate-500 transition"
              />
              {termoBusca && (
                <button
                  type="button"
                  onClick={() => setTermoBusca('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
              <span>Exibindo:</span>
              <strong className="text-white font-mono">{itensFiltrados.length}</strong>
              <span>de {relatorio.itens.length} itens</span>
            </div>
          </div>

          {/* TABELA OFICIAL DO RELATÓRIO (DESKTOP / TABLET) */}
          <div className="hidden md:block rounded-3xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl print:border print:border-slate-300 print:bg-white print:rounded-none">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold text-slate-300 uppercase tracking-wider print:bg-slate-100 print:text-black print:border-slate-300">
                    <th className="py-3.5 px-4">Produto</th>
                    <th className="py-3.5 px-3 text-right">Quantidade</th>
                    <th className="py-3.5 px-4">Conferente</th>
                    <th className="py-3.5 px-4">Data e Hora de Conferência</th>
                    <th className="py-3.5 px-4">Endereço</th>
                    <th className="py-3.5 px-4">Repositor</th>
                    <th className="py-3.5 px-4">Data da Reposição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 print:divide-slate-200">
                  {itensFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Nenhum item corresponde ao termo filtrado.
                      </td>
                    </tr>
                  ) : (
                    itensFiltrados.map((item, idx) => {
                      const isConferido = Boolean(item.data_hora_conferencia);
                      const isAlocado = Boolean(item.data_hora_reposicao);

                      return (
                        <tr
                          key={item.id || idx}
                          className="hover:bg-slate-800/40 transition print:hover:bg-white print:text-black"
                        >
                          {/* 1. PRODUTO */}
                          <td className="py-3 px-4 font-medium text-white print:text-black max-w-[280px]">
                            <div className="truncate font-semibold">{item.produto}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                  item.status === 'Alocado'
                                    ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                                    : item.status === 'Conferido'
                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                    : item.status === 'Crítica'
                                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                }`}
                              >
                                {item.status}
                              </span>
                              {item.qtd_conferida !== null &&
                                item.qtd_conferida !== undefined &&
                                item.qtd_conferida !== item.quantidade && (
                                  <span className="text-[10px] text-rose-400 font-mono">
                                    (Conf: {item.qtd_conferida})
                                  </span>
                                )}
                            </div>
                          </td>

                          {/* 2. QUANTIDADE */}
                          <td className="py-3 px-3 text-right font-mono font-bold text-sm text-blue-400 print:text-black">
                            {item.quantidade}
                          </td>

                          {/* 3. CONFERENTE */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <UserCheck
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  isConferido ? 'text-emerald-400' : 'text-slate-600'
                                }`}
                              />
                              <div>
                                <div className="font-semibold text-slate-200 print:text-black">
                                  {item.conferente_nome}
                                </div>
                                {item.conferente_codigo && (
                                  <div className="text-[10px] text-blue-400 font-mono">
                                    {item.conferente_codigo}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 4. DATA E HORA DE CONFERÊNCIA */}
                          <td className="py-3 px-4">
                            {isConferido ? (
                              <div className="font-mono text-emerald-300 print:text-black flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-emerald-400/80 shrink-0" />
                                <span>{formatarDataHora(item.data_hora_conferencia)}</span>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">
                                Aguardando conferência
                              </span>
                            )}
                          </td>

                          {/* 5. ENDEREÇO */}
                          <td className="py-3 px-4 font-mono font-bold">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span className="text-amber-200 print:text-black">{item.endereco}</span>
                              {item.endereco_alterado && (
                                <span
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase font-sans font-bold"
                                  title={`Endereço alterado do original: ${item.endereco_original || 'nenhum'}`}
                                >
                                  Alterado
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 6. REPOSITOR */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <PackageCheck
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  isAlocado ? 'text-sky-400' : 'text-slate-600'
                                }`}
                              />
                              <div>
                                <div className="font-semibold text-slate-200 print:text-black">
                                  {item.repositor_nome}
                                </div>
                                {item.repositor_codigo && (
                                  <div className="text-[10px] text-sky-400 font-mono">
                                    {item.repositor_codigo}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 7. DATA DA REPOSIÇÃO */}
                          <td className="py-3 px-4">
                            {isAlocado ? (
                              <div className="font-mono text-sky-300 print:text-black flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-sky-400/80 shrink-0" />
                                <span>{formatarDataHora(item.data_hora_reposicao)}</span>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">
                                Aguardando reposição
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* VISUALIZAÇÃO EM CARDS (MOBILE < MD) */}
          <div className="md:hidden space-y-3 print:hidden">
            {itensFiltrados.length === 0 ? (
              <div className="p-6 text-center text-slate-400 rounded-2xl bg-slate-900 border border-slate-800 text-xs">
                Nenhum item corresponde ao filtro.
              </div>
            ) : (
              itensFiltrados.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="rounded-2xl bg-slate-900/95 border border-slate-800 p-4 space-y-3 shadow-md"
                >
                  {/* Produto & Quantidade */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-bold text-white text-sm">{item.produto}</div>
                      <span
                        className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          item.status === 'Alocado'
                            ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                            : item.status === 'Conferido'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs text-slate-400 uppercase font-bold">Qtd</div>
                      <div className="text-lg font-black text-blue-400 font-mono">
                        {item.quantidade}
                      </div>
                    </div>
                  </div>

                  {/* Detalhes: Conferência */}
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1 text-xs">
                    <div className="text-[10px] font-bold text-emerald-400 uppercase flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Conferência</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Conferente:</span>
                      <span className="font-semibold text-white">
                        {item.conferente_nome} {item.conferente_codigo ? `(${item.conferente_codigo})` : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Data/Hora:</span>
                      <span className="font-mono text-emerald-300">
                        {formatarDataHora(item.data_hora_conferencia)}
                      </span>
                    </div>
                  </div>

                  {/* Detalhes: Reposição & Endereço */}
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1 text-xs">
                    <div className="text-[10px] font-bold text-sky-400 uppercase flex items-center gap-1">
                      <PackageCheck className="w-3 h-3" />
                      <span>Alocação & Endereço</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Endereço:</span>
                      <span className="font-mono font-bold text-amber-300">
                        {item.endereco} {item.endereco_alterado ? '(Alterado)' : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Repositor:</span>
                      <span className="font-semibold text-white">
                        {item.repositor_nome} {item.repositor_codigo ? `(${item.repositor_codigo})` : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Data Reposição:</span>
                      <span className="font-mono text-sky-300">
                        {formatarDataHora(item.data_hora_reposicao)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
};
