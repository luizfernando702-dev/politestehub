import React, { useState, useMemo, useEffect } from 'react';
import {
  Printer,
  X,
  Package,
  Calendar,
  AlertTriangle,
  Copy,
  Check,
  Download,
  Layers,
  ShieldAlert,
  Tag,
  Info,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { Produto, RegistroEndereco } from '../../types';
import {
  DadosEtiquetaProdutoAvulso,
  DadosEtiquetaProdutoAvaria,
} from '../../types/impressao';
import { zebraPrintService } from '../../services/zebraPrintService';
import { enderecosService } from '../../services/enderecosService';

interface ConfiguracaoEtiquetaProdutoCadastroModalProps {
  produto: Produto;
  initialMode?: 'avulsa' | 'avaria';
  onClose: () => void;
}

export const ConfiguracaoEtiquetaProdutoCadastroModal: React.FC<
  ConfiguracaoEtiquetaProdutoCadastroModalProps
> = ({ produto, initialMode = 'avulsa', onClose }) => {
  const [modo, setModo] = useState<'avulsa' | 'avaria'>(initialMode);
  const [bloqueado, setBloqueado] = useState(false);
  const [copias, setCopias] = useState(1);
  const [imprimindo, setImprimindo] = useState(false);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);
  const [erroMsg, setErroMsg] = useState<string | null>(null);
  const [zplCopiado, setZplCopiado] = useState(false);

  // Endereço / Local para Etiqueta Avulsa (inicializado com o endereço do produto, editável antes da impressão)
  const [endereco, setEndereco] = useState<string>(produto.endereco || '');
  const [enderecosDisponiveis, setEnderecosDisponiveis] = useState<RegistroEndereco[]>([]);
  const [carregandoEnderecos, setCarregandoEnderecos] = useState(false);

  // Sincroniza se o produto mudar
  useEffect(() => {
    setEndereco(produto.endereco || '');
  }, [produto.id, produto.endereco]);

  // Carrega catálogo de endereços ativos para auxiliar na seleção rápida
  useEffect(() => {
    let montado = true;
    async function carregarCatalogoEnderecos() {
      try {
        setCarregandoEnderecos(true);
        const lista = await enderecosService.listar({ status: 'ativos' });
        if (montado) {
          setEnderecosDisponiveis(lista);
        }
      } catch (err) {
        console.warn('[EtiquetaProduto] Aviso ao carregar catálogo de endereços:', err);
      } finally {
        if (montado) {
          setCarregandoEnderecos(false);
        }
      }
    }
    carregarCatalogoEnderecos();
    return () => {
      montado = false;
    };
  }, []);

  // Data atual gerada automaticamente no momento da impressão/abertura (DD/MM/AAAA)
  const dataHoje = useMemo(() => new Date().toLocaleDateString('pt-BR'), []);

  // Dados da Etiqueta Avulsa (descrição do produto + endereço/local customizado antes da impressão)
  const dadosAvulsa: DadosEtiquetaProdutoAvulso = useMemo(() => {
    return {
      produto: (produto.produto || '').trim(),
      endereco: endereco.trim() || undefined,
      copias: Math.max(1, copias),
    };
  }, [produto.produto, endereco, copias]);

  // Dados da Etiqueta de Avaria
  const dadosAvaria: DadosEtiquetaProdutoAvaria = useMemo(() => {
    return {
      produto: (produto.produto || '').trim(),
      data: dataHoje,
      bloqueado,
      copias: Math.max(1, copias),
    };
  }, [produto.produto, dataHoje, bloqueado, copias]);

  // ZPL gerado em tempo real
  const zplGerado = useMemo(() => {
    if (modo === 'avulsa') {
      return zebraPrintService.gerarZplProdutoAvulso(dadosAvulsa);
    }
    return zebraPrintService.gerarZplProdutoAvaria(dadosAvaria);
  }, [modo, dadosAvulsa, dadosAvaria]);

  // Disparo da impressão via serviço central Zebra
  const handleImprimir = async () => {
    setImprimindo(true);
    setErroMsg(null);
    setSucessoMsg(null);

    try {
      let res;
      if (modo === 'avulsa') {
        res = await zebraPrintService.imprimirEtiqueta('produto_avulso', dadosAvulsa);
      } else {
        res = await zebraPrintService.imprimirEtiqueta('produto_avaria', dadosAvaria);
      }

      if (res.sucesso) {
        setSucessoMsg(
          modo === 'avulsa'
            ? `Etiqueta Avulsa enviada para impressão Zebra com sucesso${endereco.trim() ? ` (Local: ${endereco.trim()})` : ''}.`
            : `Etiqueta de Avaria${bloqueado ? ' (Bloqueada)' : ''} enviada para impressão Zebra com sucesso.`
        );
        setTimeout(() => setSucessoMsg(null), 4000);
      } else {
        setErroMsg(res.mensagem || 'Falha ao processar envio para a impressora.');
      }
    } catch (err: any) {
      console.error('[EtiquetaProdutoCadastroModal] Erro ao imprimir:', err);
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
    const nomeLimpo = (produto.produto || 'produto')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 30);
    const tipoStr = modo === 'avulsa' ? 'avulsa' : bloqueado ? 'avaria_bloqueada' : 'avaria';
    const nomeArquivo = `etiqueta_${tipoStr}_${nomeLimpo}.zpl`;
    zebraPrintService.baixarArquivoZpl(nomeArquivo, zplGerado);
  };

  // Cálculo de tipografia dinâmica para visualização da Etiqueta Avulsa
  const lenNome = (produto.produto || '').trim().length;
  const temEndereco = Boolean(endereco.trim());
  const fontSizeAvulsa = temEndereco
    ? lenNome <= 30
      ? 'text-base sm:text-lg md:text-xl'
      : lenNome <= 65
      ? 'text-xs sm:text-sm md:text-base'
      : 'text-[11px] sm:text-xs'
    : lenNome <= 25
      ? 'text-xl sm:text-2xl md:text-3xl'
      : lenNome <= 55
      ? 'text-base sm:text-lg md:text-xl'
      : lenNome <= 110
      ? 'text-xs sm:text-sm md:text-base'
      : 'text-[11px] sm:text-xs';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="etiqueta-modal-title"
    >
      <div
        className="relative w-full max-w-4xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO */}
        <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                modo === 'avulsa'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="etiqueta-modal-title" className="text-base sm:text-lg font-black text-white tracking-tight">
                  Impressão de Etiqueta Zebra
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                    modo === 'avulsa'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {modo === 'avulsa' ? 'Etiqueta Avulsa (Verde)' : 'Etiqueta de Avaria (Vermelho)'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                  Térmica 10×5cm &bull; Área útil 8×5cm
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-md sm:max-w-xl">
                Produto: <strong className="text-slate-200 font-semibold">{produto.produto}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition shrink-0"
            title="Fechar janela"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CORPO MODAL (OPÇÕES + PRÉ-VISUALIZAÇÃO) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* SELEÇÃO DO MODELO DE ETIQUETA (TABS INDEPENDENTES: VERDE / VERMELHO) */}
          <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
            <button
              type="button"
              id="tab-etiqueta-avulsa"
              onClick={() => {
                setModo('avulsa');
                setErroMsg(null);
                setSucessoMsg(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                modo === 'avulsa'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Tag className="w-4 h-4" />
              <span>1. Etiqueta Avulsa (Verde)</span>
            </button>

            <button
              type="button"
              id="tab-etiqueta-avaria"
              onClick={() => {
                setModo('avaria');
                setErroMsg(null);
                setSucessoMsg(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                modo === 'avaria'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>2. Etiqueta de Avaria (Vermelho)</span>
            </button>
          </div>

          {/* Feedback de erro e sucesso */}
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* COLUNA ESQUERDA: PARÂMETROS E OPÇÕES DO MODELO */}
            <div className="lg:col-span-5 space-y-4">
              {/* Painel específico: Etiqueta Avulsa com Inserção e Alteração de Endereço */}
              {modo === 'avulsa' && (
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    <Tag className="w-4 h-4" />
                    <span>Etiqueta Avulsa — Identificação &bull; Local</span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-300">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                      Descrição do Produto
                    </span>
                    <p className="font-semibold text-white break-words">
                      {produto.produto}
                    </p>
                  </div>

                  {/* Campo de Inserção e Alteração do Endereço / Local antes da impressão */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="input-endereco-avulsa"
                        className="text-xs font-bold text-slate-200 flex items-center gap-1.5"
                      >
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Inserção / Alteração do Endereço:</span>
                      </label>
                      {endereco.trim() ? (
                        <button
                          type="button"
                          onClick={() => setEndereco('')}
                          className="text-[10px] text-slate-400 hover:text-rose-400 transition cursor-pointer"
                          title="Limpar endereço (imprimir apenas descrição)"
                        >
                          Limpar
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic">Opcional</span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {/* Campo de digitação livre de local / endereço */}
                      <input
                        id="input-endereco-avulsa"
                        type="text"
                        list="lista-enderecos-cadastrados"
                        value={endereco}
                        onChange={(e) => setEndereco(e.target.value.toUpperCase())}
                        placeholder="Ex: A-01-01, PALETE 04, GAVETA 2..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 font-mono"
                      />

                      <datalist id="lista-enderecos-cadastrados">
                        {enderecosDisponiveis.map((end) => (
                          <option key={end.id} value={end.endereco}>
                            {end.descricao ? `${end.endereco} - ${end.descricao}` : end.endereco}
                          </option>
                        ))}
                      </datalist>

                      {/* Seletor rápido de endereços cadastrados ativos */}
                      {enderecosDisponiveis.length > 0 && (
                        <select
                          value={enderecosDisponiveis.some((e) => e.endereco === endereco) ? endereco : ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              setEndereco(e.target.value);
                            }
                          }}
                          className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                        >
                          <option value="">Ou selecione um endereço cadastrado...</option>
                          {enderecosDisponiveis.map((end) => (
                            <option key={end.id} value={end.endereco}>
                              {end.endereco} {end.descricao ? `(${end.descricao})` : ''}
                            </option>
                          ))}
                        </select>
                      )}

                      <p className="text-[10px] text-slate-400 leading-snug">
                        Você pode digitar qualquer local ou selecionar da lista antes de imprimir. A alteração afeta <strong>apenas</strong> esta impressão (o cadastro do produto no banco não é alterado).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Painel específico: Etiqueta de Avaria */}
              {modo === 'avaria' && (
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-400 uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Etiqueta de Avaria</span>
                  </div>

                  <div className="text-xs text-slate-300 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Data de impressão:</span>
                      <strong className="text-white font-mono">{dataHoje}</strong>
                    </div>
                  </div>

                  {/* CHECKBOX: MARCAR COMO BLOQUEADA */}
                  <label
                    htmlFor="check-bloqueado"
                    className="flex items-start gap-3 p-3 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-rose-500/50 cursor-pointer transition select-none group"
                  >
                    <input
                      type="checkbox"
                      id="check-bloqueado"
                      checked={bloqueado}
                      onChange={(e) => setBloqueado(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-slate-700 text-rose-500 focus:ring-rose-500 focus:ring-offset-slate-900 bg-slate-950 cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-white group-hover:text-rose-300 transition">
                        Marcar como bloqueada
                      </span>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Exibe o destaque <strong>[ BLOQUEADO ]</strong> na etiqueta impressa. Altera <em>somente</em> o conteúdo visual da etiqueta, sem modificar o cadastro do produto no banco.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Seletor de Cópias */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-bold text-slate-300">Cópias da Etiqueta:</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCopias((prev) => Math.max(1, prev - 1))}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm flex items-center justify-center transition cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-mono font-bold text-sm text-white">
                    {copias}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCopias((prev) => Math.min(20, prev + 1))}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm flex items-center justify-center transition cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Informações Técnicas da Etiqueta Zebra */}
              <div className="p-3 rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-1.5 text-[11px] text-slate-400">
                <div className="flex items-center justify-between">
                  <span>Padrão Físico:</span>
                  <strong className="text-slate-200">10 × 5 cm (Paisagem)</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Área Útil de Impressão:</span>
                  <strong className="text-slate-200">8 × 5 cm (Direita para Esquerda)</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Logotipo Pré-Impresso:</span>
                  <strong className="text-slate-200">2 cm livres (Lado Direito)</strong>
                </div>
              </div>
            </div>

            {/* COLUNA DIREITA: PRÉ-VISUALIZAÇÃO WYSIWYG DA ETIQUETA */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Printer
                      className={`w-3.5 h-3.5 ${
                        modo === 'avulsa' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    />
                    <span>Pré-Visualização (Etiqueta Térmica 10 × 5 cm)</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Área Útil 8 × 5 cm
                  </span>
                </div>

                {/* CONTAINER DA ETIQUETA (SIMULAÇÃO TÉRMICA 10x5cm) */}
                <div className="bg-slate-950 p-4 rounded-3xl border border-slate-800 flex items-center justify-center shadow-inner">
                  <div className="relative w-full aspect-[2/1] bg-white rounded-lg shadow-2xl flex flex-row overflow-hidden select-none border border-slate-300 text-black font-sans">
                    {/* 1. ÁREA ÚTIL DE IMPRESSÃO (8cm x 5cm = 80%) COMEÇANDO DA DIREITA PARA A ESQUERDA */}
                    <div className="w-[80%] h-full p-3 sm:p-4 flex flex-col justify-between overflow-hidden text-right items-end">
                      {/* LAYOUT: ETIQUETA AVULSA (DESCRIÇÃO + ENDEREÇO SE HOUVER) */}
                      {modo === 'avulsa' && (
                        <div className="w-full h-full flex flex-col justify-between overflow-hidden text-right items-end">
                          {/* Descrição do Produto */}
                          <div
                            className={`w-full font-black text-black uppercase tracking-tight leading-tight break-words font-sans ${
                              temEndereco ? fontSizeAvulsa : 'my-auto ' + fontSizeAvulsa
                            }`}
                          >
                            {produto.produto || 'PRODUTO NÃO IDENTIFICADO'}
                          </div>

                          {/* Seção de Endereço (se informado) */}
                          {temEndereco && (
                            <div className="w-full text-right flex flex-col items-end justify-end mt-auto pt-1 border-t-2 border-black">
                              <span className="text-[7.5px] sm:text-[8.5px] font-bold text-slate-700 uppercase tracking-widest leading-none">
                                ENDEREÇO
                              </span>
                              <div
                                className={`font-sans font-black text-black uppercase tracking-tight leading-none break-words ${
                                  endereco.trim().length > 12
                                    ? 'text-base sm:text-lg md:text-xl'
                                    : 'text-lg sm:text-xl md:text-2xl'
                                }`}
                              >
                                {endereco.trim()}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* LAYOUT: ETIQUETA DE AVARIA */}
                      {modo === 'avaria' && (
                        <div className="w-full h-full flex flex-col justify-between overflow-hidden text-right items-end">
                          {/* Topo: Campo PRODUTO + Descrição + Data */}
                          <div className="w-full flex flex-col gap-0.5 text-right min-w-0">
                            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                              PRODUTO
                            </span>
                            <div className="text-black font-black text-xs sm:text-sm uppercase tracking-tight leading-tight break-words line-clamp-2">
                              {produto.produto}
                            </div>
                            <div className="text-[9px] font-bold text-slate-800 uppercase mt-0.5">
                              DATA: {dataHoje}
                            </div>
                          </div>

                          {/* Linha Divisória */}
                          <div className="w-full border-t border-black my-0.5"></div>

                          {/* Bloco Principal: AVARIA (Maior Destaque) e BLOQUEADO (se marcado) */}
                          <div className="w-full text-right flex flex-col items-end justify-center py-0.5">
                            <div
                              className={`text-black font-black tracking-widest uppercase leading-none font-sans ${
                                bloqueado
                                  ? 'text-xl sm:text-2xl md:text-3xl'
                                  : 'text-2xl sm:text-3xl md:text-4xl'
                              }`}
                            >
                              AVARIA
                            </div>

                            {bloqueado && (
                              <div className="mt-1 px-2.5 py-0.5 bg-black text-white font-black text-[10px] sm:text-xs tracking-wider uppercase rounded-xs">
                                BLOQUEADO
                              </div>
                            )}
                          </div>
                        </div>
                      )}
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

                <p className="text-[11px] text-slate-400 text-center mt-1.5">
                  O logotipo pré-impresso na bobina fica ao lado direito (2 cm). A impressão ocupa a área útil de 8 × 5 cm.
                </p>
              </div>

              {/* INTEGRAÇÃO TÉCNICA ZPL */}
              <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                  <span>Código ZPL II (Zebra Programming Language):</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleCopiarZpl}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-[10px] font-mono cursor-pointer"
                      title="Copiar código ZPL"
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
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-[10px] font-mono cursor-pointer"
                      title="Baixar arquivo .zpl"
                    >
                      <Download className="w-3 h-3" />
                      <span>.ZPL</span>
                    </button>
                  </div>
                </div>
                <pre className="p-2 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[9px] text-slate-400 overflow-x-auto max-h-16 select-all leading-relaxed">
                  {zplGerado}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* RODAPÉ COM AÇÕES */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                modo === 'avulsa' ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
            <span>
              Impressão: <strong>{copias} {copias === 1 ? 'etiqueta' : 'etiquetas'}</strong> do modelo{' '}
              <strong className="text-white">
                {modo === 'avulsa' ? 'Etiqueta Avulsa' : `Etiqueta de Avaria${bloqueado ? ' (Bloqueada)' : ''}`}
              </strong>
              {modo === 'avulsa' && endereco.trim() && (
                <span className="text-emerald-400 font-mono text-[11px] ml-1.5 font-bold">
                  [Local: {endereco.trim()}]
                </span>
              )}
              .
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition min-h-[44px] cursor-pointer"
            >
              Fechar
            </button>

            <button
              type="button"
              disabled={imprimindo}
              onClick={handleImprimir}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs text-white shadow-lg transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] cursor-pointer ${
                modo === 'avulsa'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                  : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>
                {imprimindo
                  ? 'Enviando para Impressora...'
                  : modo === 'avulsa'
                  ? `Imprimir Etiqueta Avulsa (${copias})`
                  : `Imprimir Etiqueta de Avaria (${copias})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
