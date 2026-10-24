/**
 * POLIHUB — SISTEMA CENTRALIZADO DE IMPRESSÃO DE ETIQUETAS ZEBRA
 * Tipos e interfaces padronizados para geração de etiquetas térmicas.
 */

export type TipoModeloEtiqueta =
  | 'coleta'
  | 'produto'
  | 'palete'
  | 'volume'
  | 'endereco'
  | 'critica_avaria'
  | 'produto_agendamento'
  | 'produto_avulso'
  | 'produto_avaria';

export type OpcaoDestinoColeta =
  | 'cliente_retira'
  | 'endereco_alternativo'
  | 'sem_destino';

export interface EnderecoAlternativoEtiqueta {
  logradouro: string;
  complemento?: string;
  setor?: string;
  cidade: string;
  uf: string;
  cep?: string;
}

export interface DadosEtiquetaColeta {
  numero_coleta: string;
  numero_nota_fiscal?: string;
  cliente?: string;
  transportadora?: string;
  opcao_destino: OpcaoDestinoColeta;
  // Opção 1: Cliente Retira
  cidade_retirada?: string;
  uf_retirada?: string;
  // Opção 2: Endereço Alternativo
  endereco_alternativo?: EnderecoAlternativoEtiqueta;
  // Parâmetros de impressão
  copias?: number;
  incluirCodigoBarras?: boolean;
}

export interface DadosEtiquetaCriticaAvaria {
  notaFiscal: string;
  produto: string;
  data: string; // Ex: DD/MM/YYYY
  fornecedor?: string;
  motivoCritica?: string;
  copias?: number;
}

export interface DadosEtiquetaProdutoAgendamento {
  produto: string;
  notaFiscal: string;
  quantidade: number;
  endereco: string;
  data: string; // Ex: DD/MM/YYYY ou YYYY-MM-DD
  numeralIdentificador: string;
  qrCodeDataUrl?: string; // Data URL em base64 com SVG/PNG do QR Code (contém SOMENTE o nome do produto)
  copias?: number;
}

export interface DadosEtiquetaProdutoAvulso {
  produto: string; // Descrição do produto
  endereco?: string; // Endereço / local de armazenagem
  copias?: number;
}

export interface DadosEtiquetaProdutoAvaria {
  produto: string; // Descrição do produto
  data?: string;   // Data da impressão (DD/MM/AAAA)
  bloqueado?: boolean; // Marcar como bloqueada
  copias?: number;
}

export interface ConfiguracaoEtiquetaZebra {
  larguraMm: number; // Ex: 100mm
  alturaMm: number;  // Ex: 50mm ou 30mm
  densidadeDpi: 203 | 300; // Padrão Zebra 203 DPI (8 dots/mm)
  orientacao?: 'portrait' | 'landscape';
}

export interface ResultadoImpressao {
  sucesso: boolean;
  mensagem: string;
  zplGerado?: string;
}

export interface ModeloEtiquetaDefinicao<T = any> {
  id: TipoModeloEtiqueta;
  nome: string;
  descricao: string;
  larguraPadraoMm: number;
  alturaPadraoMm: number;
  gerarLinhasTexto: (dados: T) => string[];
  gerarZpl: (dados: T, config?: ConfiguracaoEtiquetaZebra) => string;
  gerarHtml: (dados: T, config?: ConfiguracaoEtiquetaZebra) => string;
}
