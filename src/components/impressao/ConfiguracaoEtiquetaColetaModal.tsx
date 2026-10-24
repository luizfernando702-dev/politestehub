import React, { useState, useMemo } from 'react';
import {
  Printer,
  X,
  MapPin,
  UserCheck,
  FileText,
  AlertTriangle,
  Copy,
  Check,
  Download,
  Info,
  Layers,
} from 'lucide-react';
import { ExpedicaoColeta } from '../../types';
import {
  DadosEtiquetaColeta,
  EnderecoAlternativoEtiqueta,
  OpcaoDestinoColeta,
} from '../../types/impressao';
import { zebraPrintService } from '../../services/zebraPrintService';

interface ConfiguracaoEtiquetaColetaModalProps {
  coleta: ExpedicaoColeta;
  onClose: () => void;
}

const ESTADOS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export const ConfiguracaoEtiquetaColetaModal: React.FC<ConfiguracaoEtiquetaColetaModalProps> = ({
  coleta,
  onClose,
}) => {
  // Estado da opção de destino
  const [opcaoDestino, setOpcaoDestino] = useState<OpcaoDestinoColeta>('cliente_retira');

  // Opção 1: Cliente Retira
  const [cidadeRetirada, setCidadeRetirada] = useState('GOIÂNIA');
  const [ufRetirada, setUfRetirada] = useState('GO');

  // Opção 2: Endereço Alternativo
  const [enderecoAlt, setEnderecoAlt] = useState<EnderecoAlternativoEtiqueta>({
    logradouro: '',
    complemento: '',
    setor: '',
    cidade: '',
    uf: 'GO',
    cep: '',
  });

  // Parâmetros de impressão
  const [copias, setCopias] = useState<number>(1);
  const [imprimindo, setImprimindo] = useState(false);
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);
  const [zplCopiado, setZplCopiado] = useState(false);

  // Número da coleta extraído diretamente do registro (somente leitura)
  const numeroColeta = (coleta.numero_coleta || '').trim();

  // Consolidação dos dados para a etiqueta
  const dadosEtiqueta: DadosEtiquetaColeta = useMemo(() => {
    return {
      numero_coleta: numeroColeta,
      numero_nota_fiscal: coleta.numero_nota_fiscal,
      cliente: coleta.cliente,
      transportadora: coleta.transportadora,
      opcao_destino: opcaoDestino,
      cidade_retirada: cidadeRetirada,
      uf_retirada: ufRetirada,
      endereco_alternativo: enderecoAlt,
      copias: Math.max(1, copias),
    };
  }, [coleta, numeroColeta, opcaoDestino, cidadeRetirada, ufRetirada, enderecoAlt, copias]);

  // Linhas formatadas para a pré-visualização em tempo real
  const { linha1, linha2, linhasExtras } = useMemo(() => {
    return zebraPrintService.formatarLinhasColeta(dadosEtiqueta);
  }, [dadosEtiqueta]);

  // ZPL gerado em tempo real
  const zplGerado = useMemo(() => {
    return zebraPrintService.gerarZplColeta(dadosEtiqueta);
  }, [dadosEtiqueta]);

  // Validação dos campos obrigatórios
  const validarCampos = (): boolean => {
    setErroValidacao(null);

    if (opcaoDestino === 'cliente_retira') {
      if (!cidadeRetirada.trim()) {
        setErroValidacao('Informe a Cidade para a opção "Cliente retira".');
        return false;
      }
      if (!ufRetirada.trim()) {
        setErroValidacao('Informe a UF para a opção "Cliente retira".');
        return false;
      }
    } else if (opcaoDestino === 'endereco_alternativo') {
      if (!enderecoAlt.logradouro.trim()) {
        setErroValidacao('Informe o Logradouro no endereço alternativo.');
        return false;
      }
      if (!enderecoAlt.cidade.trim()) {
        setErroValidacao('Informe a Cidade no endereço alternativo.');
        return false;
      }
      if (!enderecoAlt.uf.trim()) {
        setErroValidacao('Informe a UF no endereço alternativo.');
        return false;
      }
    }

    return true;
  };

  // Disparo da impressão térmica Zebra
  const handleImprimir = async () => {
    if (!validarCampos()) return;

    setImprimindo(true);
    setErroValidacao(null);
    setSucessoMsg(null);

    try {
      const res = await zebraPrintService.imprimirEtiqueta('coleta', dadosEtiqueta);
      if (res.sucesso) {
        setSucessoMsg(res.mensagem);
        setTimeout(() => setSucessoMsg(null), 4000);
      } else {
        setErroValidacao(res.mensagem);
      }
    } catch (err: any) {
      setErroValidacao(`Erro ao processar impressão: ${err?.message || 'Falha de comunicação'}`);
    } finally {
      setImprimindo(false);
    }
  };

  // Copiar código ZPL puro
  const handleCopiarZpl = async () => {
    const copiou = await zebraPrintService.copiarZpl(zplGerado);
    if (copiou) {
      setZplCopiado(true);
      setTimeout(() => setZplCopiado(false), 2500);
    }
  };

  // Baixar arquivo .zpl
  const handleBaixarZpl = () => {
    const nome = `etiqueta_coleta_${numeroColeta || coleta.numero_nota_fiscal || 'zebra'}.zpl`;
    zebraPrintService.baixarArquivoZpl(nome, zplGerado);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="etiqueta-modal-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* CABEÇALHO */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="etiqueta-modal-title" className="text-lg sm:text-xl font-black text-white tracking-tight">
                  Configuração de Etiqueta Zebra
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                  Térmica 10cm × 5cm
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Área Útil 8 × 5 cm (Direita para Esquerda) &bull; 2 cm Reservados para Logotipo Pré-Impresso (Lado Direito) &bull; NF{' '}
                <strong className="text-slate-200">{coleta.numero_nota_fiscal}</strong> &bull; {coleta.cliente}
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

        {/* CORPO MODAL (GRID: FORMULÁRIO + PRÉ-VISUALIZAÇÃO) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Mensagens de Feedback */}
          {erroValidacao && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <strong className="font-bold">Atenção na validação:</strong> {erroValidacao}
              </div>
            </div>
          )}

          {sucessoMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-300 text-xs animate-in fade-in">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{sucessoMsg}</span>
            </div>
          )}

          {!numeroColeta && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-300 text-xs">
              <Info className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <strong className="font-bold">Aviso:</strong> Esta coleta não possui o <em>Número da Coleta</em> preenchido no cadastro. Recomenda-se cadastrar o número da coleta no registro antes da impressão, se necessário.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* COLUNA ESQUERDA (FORMULÁRIO DE CONFIGURAÇÃO) */}
            <div className="lg:col-span-7 space-y-5">
              {/* 1. NÚMERO DA COLETA (1ª Linha Obrigatória / Readonly) */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    <span>1ª Linha da Etiqueta — Número da Coleta</span>
                  </label>
                  <span className="text-[10px] text-slate-400 uppercase font-bold bg-slate-800 px-2 py-0.5 rounded">
                    Fixo do Registro
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 font-mono text-sm font-bold text-white flex items-center justify-between">
                    <span>{numeroColeta ? `COLETA: ${numeroColeta}` : '(Sem número de coleta cadastrado)'}</span>
                    <span className="text-[11px] text-slate-400 font-normal italic">
                      Não editável aqui
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  O número da coleta é capturado automaticamente do registro selecionado e posicionado com destaque na primeira linha da etiqueta térmica.
                </p>
              </div>

              {/* 2. OPÇÕES DE DESTINO (2ª Linha) */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Opções de Destino (2ª Linha)
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Opção 1: Cliente Retira */}
                  <button
                    type="button"
                    onClick={() => {
                      setOpcaoDestino('cliente_retira');
                      setErroValidacao(null);
                    }}
                    className={`p-3 rounded-2xl text-left border transition flex flex-col justify-between min-h-[76px] ${
                      opcaoDestino === 'cliente_retira'
                        ? 'bg-blue-600/15 border-blue-500 text-white shadow-lg shadow-blue-500/10'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <UserCheck className={`w-4 h-4 ${opcaoDestino === 'cliente_retira' ? 'text-blue-400' : 'text-slate-400'}`} />
                      <span className={`w-2 h-2 rounded-full ${opcaoDestino === 'cliente_retira' ? 'bg-blue-400' : 'bg-transparent'}`} />
                    </div>
                    <div className="mt-2">
                      <div className="text-xs font-bold">1. Cliente Retira</div>
                      <div className="text-[10px] text-slate-400">Texto fixo + Cidade/UF</div>
                    </div>
                  </button>

                  {/* Opção 2: Endereço Alternativo */}
                  <button
                    type="button"
                    onClick={() => {
                      setOpcaoDestino('endereco_alternativo');
                      setErroValidacao(null);
                    }}
                    className={`p-3 rounded-2xl text-left border transition flex flex-col justify-between min-h-[76px] ${
                      opcaoDestino === 'endereco_alternativo'
                        ? 'bg-blue-600/15 border-blue-500 text-white shadow-lg shadow-blue-500/10'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <MapPin className={`w-4 h-4 ${opcaoDestino === 'endereco_alternativo' ? 'text-blue-400' : 'text-slate-400'}`} />
                      <span className={`w-2 h-2 rounded-full ${opcaoDestino === 'endereco_alternativo' ? 'bg-blue-400' : 'bg-transparent'}`} />
                    </div>
                    <div className="mt-2">
                      <div className="text-xs font-bold">2. Endereço Alternativo</div>
                      <div className="text-[10px] text-slate-400">Rua, Setor, Cidade, CEP</div>
                    </div>
                  </button>

                  {/* Opção 3: Sem Destino Alternativo */}
                  <button
                    type="button"
                    onClick={() => {
                      setOpcaoDestino('sem_destino');
                      setErroValidacao(null);
                    }}
                    className={`p-3 rounded-2xl text-left border transition flex flex-col justify-between min-h-[76px] ${
                      opcaoDestino === 'sem_destino'
                        ? 'bg-blue-600/15 border-blue-500 text-white shadow-lg shadow-blue-500/10'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <FileText className={`w-4 h-4 ${opcaoDestino === 'sem_destino' ? 'text-blue-400' : 'text-slate-400'}`} />
                      <span className={`w-2 h-2 rounded-full ${opcaoDestino === 'sem_destino' ? 'bg-blue-400' : 'bg-transparent'}`} />
                    </div>
                    <div className="mt-2">
                      <div className="text-xs font-bold">3. Sem Destino</div>
                      <div className="text-[10px] text-slate-400">Somente número da coleta</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* CAMPOS DINÂMICOS CONFORME A OPÇÃO SELECIONADA */}
              {opcaoDestino === 'cliente_retira' && (
                <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-3 animate-in fade-in duration-150">
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                    <span>Dados de Retirada pelo Cliente</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                        Cidade <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={cidadeRetirada}
                        onChange={(e) => setCidadeRetirada(e.target.value.toUpperCase())}
                        placeholder="Ex: GOIÂNIA"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs uppercase focus:outline-none focus:border-blue-500 transition"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                        UF (Estado) <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={ufRetirada}
                        onChange={(e) => setUfRetirada(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold uppercase focus:outline-none focus:border-blue-500 transition"
                      >
                        {ESTADOS_BRASIL.map((uf) => (
                          <option key={uf} value={uf}>
                            {uf}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    Formatação na 2ª linha: <strong className="text-slate-200">CLIENTE RETIRA — {cidadeRetirada || '...'} / {ufRetirada}</strong>
                  </div>
                </div>
              )}

              {opcaoDestino === 'endereco_alternativo' && (
                <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-3 animate-in fade-in duration-150">
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-400" />
                    <span>Dados do Endereço de Entrega Alternativo</span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                        Logradouro (Rua, Av, Quadra, Lote) <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={enderecoAlt.logradouro}
                        onChange={(e) =>
                          setEnderecoAlt((prev) => ({ ...prev, logradouro: e.target.value.toUpperCase() }))
                        }
                        placeholder="Ex: RUA 10, QUADRA 15 LOTE 02"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs uppercase focus:outline-none focus:border-blue-500 transition"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                          Complemento
                        </label>
                        <input
                          type="text"
                          value={enderecoAlt.complemento}
                          onChange={(e) =>
                            setEnderecoAlt((prev) => ({ ...prev, complemento: e.target.value.toUpperCase() }))
                          }
                          placeholder="Ex: APTO 101, BLOCO B"
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs uppercase focus:outline-none focus:border-blue-500 transition"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                          Setor / Bairro
                        </label>
                        <input
                          type="text"
                          value={enderecoAlt.setor}
                          onChange={(e) =>
                            setEnderecoAlt((prev) => ({ ...prev, setor: e.target.value.toUpperCase() }))
                          }
                          placeholder="Ex: SETOR BUENO"
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs uppercase focus:outline-none focus:border-blue-500 transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                          Cidade <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={enderecoAlt.cidade}
                          onChange={(e) =>
                            setEnderecoAlt((prev) => ({ ...prev, cidade: e.target.value.toUpperCase() }))
                          }
                          placeholder="Ex: GOIÂNIA"
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs uppercase focus:outline-none focus:border-blue-500 transition"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                          Estado (UF) <span className="text-rose-400">*</span>
                        </label>
                        <select
                          value={enderecoAlt.uf}
                          onChange={(e) =>
                            setEnderecoAlt((prev) => ({ ...prev, uf: e.target.value }))
                          }
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold uppercase focus:outline-none focus:border-blue-500 transition"
                        >
                          {ESTADOS_BRASIL.map((uf) => (
                            <option key={uf} value={uf}>
                              {uf}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                          CEP
                        </label>
                        <input
                          type="text"
                          value={enderecoAlt.cep}
                          onChange={(e) =>
                            setEnderecoAlt((prev) => ({ ...prev, cep: e.target.value }))
                          }
                          placeholder="74000-000"
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500 transition"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {opcaoDestino === 'sem_destino' && (
                <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-400 flex items-start gap-3 animate-in fade-in duration-150">
                  <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <p>
                    A etiqueta será impressa <strong>somente com o número da coleta</strong> na primeira linha, sem linha secundária em branco e sem textos fictícios.
                  </p>
                </div>
              )}

              {/* CÓPIAS DA ETIQUETA */}
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

            {/* COLUNA DIREITA (PRÉ-VISUALIZAÇÃO EM TEMPO REAL WYSIWYG) */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Printer className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Pré-Visualização (Etiqueta Térmica 10 × 5 cm)</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Área Útil 8 × 5 cm (Direita para Esquerda)
                  </span>
                </div>

                {/* CONTAINER DA ETIQUETA REAL (SIMULAÇÃO TÉRMICA 10x5cm) */}
                <div className="bg-slate-950 p-4 rounded-3xl border border-slate-800 flex items-center justify-center shadow-inner">
                  <div
                    className="relative w-full aspect-[2/1] bg-white rounded-lg shadow-2xl flex flex-row overflow-hidden select-none border border-slate-300"
                  >
                    {/* 1. ÁREA ÚTIL DE IMPRESSÃO (8cm x 5cm = 80%) COMEÇANDO DA DIREITA PARA A ESQUERDA */}
                    <div className="w-[80%] h-full p-3 sm:p-4 flex flex-col justify-between overflow-hidden text-right items-end">
                      {/* Linhas da Etiqueta (Alinhadas da direita para a esquerda) */}
                      <div className="flex-1 w-full flex flex-col justify-center space-y-2 text-right">
                        {/* Linha 1: Número da Coleta */}
                        <div className="text-black font-black text-base sm:text-lg md:text-xl tracking-tight uppercase leading-tight font-sans break-words text-right">
                          {linha1}
                        </div>

                        {/* Linha 2 (se houver) */}
                        {linha2 && (
                          <div
                            className={`text-black font-extrabold tracking-tight uppercase font-sans break-words text-right ${
                              opcaoDestino === 'cliente_retira'
                                ? 'text-sm sm:text-base leading-snug'
                                : 'text-xs sm:text-sm leading-snug'
                            }`}
                          >
                            {linha2}
                          </div>
                        )}

                        {/* Linhas Extras de Endereço */}
                        {linhasExtras && linhasExtras.length > 0 && (
                          <div className="space-y-1 w-full text-right">
                            {linhasExtras.map((extra, idx) => (
                              <div
                                key={idx}
                                className="text-black font-bold text-[11px] sm:text-xs tracking-tight uppercase font-sans break-words text-right"
                              >
                                {extra}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Rodapé Operacional sutil (Alinhado à direita) */}
                      <div className="w-full pt-2 mt-2 border-t-2 border-black flex items-center justify-end gap-3 text-[9px] sm:text-[10px] font-bold text-black uppercase font-mono tracking-wider text-right">
                        <span className="truncate max-w-[60%]">{coleta.cliente || 'POLIHUB'}</span>
                        <span>NF: {coleta.numero_nota_fiscal}</span>
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

              {/* PAINEL DE INTEGRAÇÃO TÉCNICA ZPL (Para Suporte e Impressoras Raw) */}
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

        {/* RODAPÉ COM AÇÕES */}
        <div className="p-5 sm:p-6 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 text-center sm:text-left">
            <span>Impressão compatível com Zebra ZD220, ZD230, GK420t e rede RAW.</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleImprimir}
              disabled={imprimindo}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/20 min-h-[42px]"
            >
              <Printer className="w-4 h-4" />
              <span>{imprimindo ? 'Enviando para Impressora...' : 'Imprimir Etiqueta'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
