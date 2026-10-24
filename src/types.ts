export type ModuleType = 'home' | 'agendamentos' | 'coletas' | 'pedidos' | 'recebimento' | 'tarefas' | 'alocacao' | 'enderecamento' | 'inventario' | 'auditoria' | 'cadastros' | 'relatorios' | 'veiculos' | 'compras' | 'whatsapp' | 'configuracoes';

export type TarefaStatus = 'Pendente' | 'Concluído' | 'Não concluído';

export type PrazoCalculado = 'Prazo estourado' | 'Finalizar hoje' | 'Dentro do prazo' | 'Concluída';

export interface Tarefa {
  id: string; // UUID
  nome: string; // Nome/descrição da tarefa
  unidade_negocio?: string; // Isolamento por Unidade de Negócio
  responsavel_id: string; // Relacionamento com usuarios.id
  responsavel_nome?: string; // Nome do responsável populado via join ou lookup
  responsavel_codigo?: string; // Código operacional do responsável
  data_limite: string; // Data limite YYYY-MM-DD
  data_conclusao?: string | null; // Data/hora da conclusão quando Concluído
  status: TarefaStatus;
  ativo: boolean; // Suporte a exclusão lógica
  usuario_insercao?: string | null;
  data_insercao?: string | null;
  usuario_atualizacao?: string | null;
  data_atualizacao?: string | null;
  prazo?: PrazoCalculado; // Coluna virtual calculada dinamicamente
}

export type AgendamentoStatus = 'Pendente' | 'Confirmado' | 'Em trânsito' | 'Recebido' | 'Cancelado';

// -------------------------------------------------------------
// POLIHUB — CADASTROS DE TRANSPORTADORAS E FORNECEDORES
// -------------------------------------------------------------
export interface Transportadora {
  id: string; // UUID
  unidade_negocio?: string; // Isolamento por Unidade de Negócio
  razao_social: string;
  nome_fantasia: string;
  ativo?: boolean;
  created_at?: string;
}

export interface Fornecedor {
  id: string; // UUID
  unidade_negocio?: string; // Isolamento por Unidade de Negócio
  razao_social: string;
  nome_fantasia: string;
  ativo?: boolean;
  created_at?: string;
}

export interface UnidadeNegocio {
  id: string; // UUID
  nome: string; // Nome da filial / unidade (ex: 'Goiânia', 'Mato Grosso')
  sigla?: string | null; // Sigla da unidade (ex: 'GYN', 'MT')
  cidade?: string | null;
  estado?: string | null; // UF
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export type UsuarioStatus = 'pendente' | 'aprovado' | 'ativo' | 'desativado';
export type Departamento = 'Logística' | 'Comercial' | 'Financeiro';
export type NivelUsuario = 'Operador' | 'Assistente' | 'Gestor';

export interface Usuario {
  id: string;
  nome: string;
  codigo?: string;
  email?: string | null; // Endereço de e-mail corporativo / login
  unidade_negocio: string; // Unidade de Negócio obrigatória (ex: 'Goiânia', 'Mato Grosso')
  foto?: string | null;
  departamento: string;
  funcao: string;
  nivel: NivelUsuario | string;
  status?: UsuarioStatus;
  ativo?: boolean;
  pin?: string | null; // PIN de 4 dígitos para identificação operacional (Recebimento / Alocação)
  tema_escuro?: boolean | null; // Preferência de tema do usuário (true = escuro, false = claro)
  exigir_troca_senha?: boolean | null; // Flag para forçar o cadastro de nova senha no próximo acesso
  created_at?: string;
  updated_at?: string;
}

export interface UsuarioOperacionalSessao {
  id: string;
  nome: string;
  codigo: string;
  departamento: string;
  modulo: 'recebimento' | 'alocacao' | 'inventario';
  dataHoraValidacao: string;
}

// -------------------------------------------------------------
// POLIHUB — CADASTRO CENTRAL DE PRODUTOS
// Tabela: public.produtos
// -------------------------------------------------------------
export interface Produto {
  id: string; // UUID
  produto: string;
  fabricante?: string | null;
  endereco?: string | null;
  codigo_barras?: string | null; // Código de barras (EAN-13, GTIN, Code128, etc.)
  created_at?: string;
  updated_at?: string;
}

export interface Agendamento {
  id: string;
  unidade_negocio?: string; // Isolamento por Unidade de Negócio
  data: string; // YYYY-MM-DD
  fornecedor: string; // nome_fantasia (mantido para compatibilidade e histórico)
  fornecedor_id?: string | null; // UUID de vínculo com a tabela public.fornecedores
  nota_fiscal: string;
  notas_adicionais?: string | null;
  volumes: number;
  tipo_volumes: 'Paletes' | 'Caixas' | 'Fardos' | 'Tambores' | 'Sacarias' | 'Containers' | 'Outros';
  transportadora: string; // nome_fantasia (mantido para compatibilidade e histórico)
  transportadora_id?: string | null; // UUID de vínculo com a tabela public.transportadoras
  status: AgendamentoStatus;
  data_prevista: string; // YYYY-MM-DD
  horario?: string | null; // HH:mm (Ex: "09:00", "14:30")
  data_entrega?: string | null;
  usuario_insercao: string;
  usuario_id?: string | null; // UUID do usuário que realizou o lançamento (public.usuarios.id)
  data_insercao: string;
  endereco_alocacao?: string | null; // Vínculo com a tabela public.enderecos
  xml_nota?: string | null; // Conteúdo XML da Nota Fiscal (NF-e) anexada
  chave_nf?: string | null; // Chave de acesso de 44 dígitos da NF-e
}

export interface EnderecoLogistico {
  id: string;
  codigo: string; // Ex: R01-C03-P02-N1
  rua: string; // Ex: Rua 01
  corredor: string; // Ex: Corredor 03
  prateleira: string; // Ex: Prateleira 02
  coluna: string; // Ex: Coluna 02
  nivel: string; // Ex: Nível 1
  posicao: string; // Ex: Posição A
  status: 'Livre' | 'Ocupado' | 'Reservado' | 'Bloqueado';
  tipo_armazenagem: 'Porta-Paletes' | 'Blocado' | 'Gôndola' | 'Picking Leve';
  capacidade_kg: number;
  produto_alocado?: string | null;
  dimensoes?: string;
}

export interface ItemInventario {
  id: string;
  sku: string;
  descricao: string;
  categoria: string;
  quantidade: number;
  unidade: 'UN' | 'CX' | 'KG' | 'PAL' | 'FD';
  localizacao_id: string;
  endereco_codigo: string;
  estoque_minimo: number;
  estoque_maximo: number;
  status: 'Normal' | 'Crítico' | 'Excesso';
  ultima_movimentacao: string;
}

// -------------------------------------------------------------
// POLIFILTRO — TABELA REAL SUPABASE: public.enderecos
// create table public.enderecos (
//   id bigserial not null,
//   endereco text not null unique,
//   descricao text null,
//   ativo boolean not null default true,
//   created_at timestamptz not null default timezone ('utc'::text, now())
// );
// -------------------------------------------------------------

export interface RegistroEndereco {
  id: number | string;
  unidade_negocio?: string; // Isolamento por Unidade de Negócio
  endereco: string; // Ex: 'A-01-01'
  descricao?: string | null;
  ativo: boolean;
  created_at?: string;
}

export type InventarioStatus =
  | 'pendente'
  | 'contada'
  | 'revisar'
  | 'revisada'
  | 'validada'
  | 'bloqueada'
  | 'invalidada';

export interface HistoricoAlteracaoEndereco {
  id?: string;
  produto: string;
  localizacao_anterior: string;
  localizacao_nova: string;
  data_alteracao: string;
  usuario: string;
  unidade?: string;
  contagem?: string;
}

export interface RegistroInventario {
  id: string | number;
  unidade_negocio?: string; // Isolamento por Unidade de Negócio
  produto: string;
  endereco: string;
  qtd_contada?: number | null;
  qtd_disponivel: number;
  qtd_atual?: number | null;
  peso_total?: number | null;
  qtd_reservada?: number | null;
  usuario_id?: string | null;
  data_atualizada?: string | null;
  data_contagem?: string | null;
  usuario_correcao?: string | null;
  corrigido: boolean; // Mantido fisicamente para retrocompatibilidade
  data_correcao?: string | null;
  // NOVOS CAMPOS — POLIHUB REFORMULAÇÃO
  status?: InventarioStatus;
  contagem?: string | null;
  usuario_revisao_id?: string | null;
  data_revisao?: string | null;
  quantidade_revisao?: number | null;
  observacao?: string | null;
  alteracoes_endereco?: string | null;
}

// Dados transferidos para a tela de contagem (NUNCA expõe qtd_disponivel, saldo ou expectativa)
export interface ItemParaContagem {
  id: string | number;
  produto: string;
  endereco: string;
  peso_total?: number | null;
}

export type ResultadoComparacaoContagem = 'IGUAL' | 'MENOR' | 'MAIOR';

export interface PreviaEnderecoContagem {
  endereco: string;
  totalProdutos: number;
  totalItens: number;
}

// Listagem do Gestor (apenas as colunas permitidas no front-end para visualização inicial)
export interface ItemListagemContagem {
  id: string | number;
  unidade_negocio?: string;
  produto: string;
  endereco: string;
  qtd_contada: number | null;
  qtd_disponivel: number;
  qtd_atual: number | null;
  peso_total: number | null;
  qtd_reservada: number | null;
  corrigido: boolean;
  data_contagem: string | null;
  status: InventarioStatus;
  contagem?: string | null;
  usuario_id?: string | null;
  usuario_revisao_id?: string | null;
  nome_usuario_contagem?: string;
  nome_usuario_revisao?: string;
  data_revisao?: string | null;
  quantidade_revisao?: number | null;
  observacao?: string | null;
  alteracoes_endereco?: string | null;
}

export interface FiltrosListagemContagem {
  produto?: string;
  endereco?: string;
  contagem?: string;
  dataContagem?: string;
  usuarioId?: string;
  aba?: 'falta' | 'sobressalentes' | 'corrigidas' | 'todas';
  statusCorrecao?: 'Todos' | 'Corrigido' | 'Pendente';
  status?: InventarioStatus | 'todos';
  ordenacao?: 'divergencia_prioritaria' | 'data_desc' | 'data_asc' | 'produto_asc';
  page: number;
  pageSize: number;
  unidadeNegocio?: string;
  userRole?: string;
}

export interface DetalheContagem extends RegistroInventario {
  nome_usuario_contagem?: string;
  codigo_usuario_contagem?: string;
  nome_usuario_correcao?: string;
  codigo_usuario_correcao?: string;
  nome_usuario_revisao?: string;
  codigo_usuario_revisao?: string;
}

export interface ItemImportacaoContagem {
  produto: string;
  endereco: string;
  qtd_contada?: number | null;
  qtd_disponivel: number;
  qtd_reservada?: number | null;
}

export interface ResultadoImportacaoContagem {
  sucesso: boolean;
  totalProcessados: number;
  totalInseridos: number;
  erros: { linha: number; erro: string; item?: any }[];
  nomeContagem: string;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// -------------------------------------------------------------
// POLIFILTRO — MÓDULOS RECEBIMENTO & ALOCAÇÃO DE PRODUTOS
// Tabelas: public.recebimentos_produtos e public.alteracoes_endereco
// -------------------------------------------------------------

export type RecebimentoStatus = 'Recebido' | 'Conferido' | 'Crítica' | 'Validado' | 'Alocado';

export interface RecebimentoProduto {
  id: string | number;
  agendamento_id: string;
  unidade_negocio?: string; // Isolamento por Unidade de Negócio (deve ser idêntica ao agendamento)
  data_recebimento: string; // Data ou timestamptz (YYYY-MM-DD ou ISO)
  nota_fiscal: string;
  produto: string;
  endereco?: string | null; // Endereço original informado no recebimento
  quantidade: number;
  saldo_final: number; // Saldo que ainda precisa ser alocado/guardado
  qtd_conferida?: number | null; // Quantidade encontrada na conferência cega
  conferente_id?: string | null; // ID do usuário que conferiu (usuarios.id)
  conferente_nome?: string | null;
  status: RecebimentoStatus;
  data_conferencia?: string | null; // ISO timestamp
  repositor_id?: string | null; // ID do usuário que alocou (usuarios.id)
  repositor_nome?: string | null;
  data_alocacao?: string | null; // ISO timestamp
  novo_endereco?: string | null; // Novo endereço quando alterado na alocação
  importado_excel?: boolean | null; // Identifica se o produto foi inserido/importado via planilha Excel
  origem?: string; // 'excel' | 'manual'
  created_at?: string;
  fabricante?: string | null;
  fornecedor?: string | null;
}

export interface ResumoNotaRecebimento {
  nota_fiscal: string;
  agendamento_id: string;
  data_recebimento: string;
  fornecedor?: string;
  total_itens: number; // quantidade de produtos distintos na NF
  total_quantidade: number; // soma das quantidades de itens
  total_conferidos: number; // quantidade de itens já conferidos
  total_criticas: number; // quantidade de itens com status Crítica
  porcentagem_conferencia: number; // 0 a 100%
  status_geral: 'Pendente' | 'Em Conferência' | '100% Conferido' | 'Com Crítica';
}

export interface ItemConferenciaCega {
  id: string | number;
  agendamento_id: string;
  nota_fiscal: string;
  fornecedor?: string;
  produto: string;
  endereco_original?: string | null;
  status: RecebimentoStatus;
  data_recebimento: string;
  // IMPORTANTE: A quantidade esperada da NF é mantida oculta na interface de conferência cega
}

export type ResultadoConferencia = 'IGUAL' | 'MENOR' | 'MAIOR';

export interface ItemHistoricoRecebimento {
  id: string | number;
  data_recebimento: string;
  produto: string;
  nota_fiscal: string;
  quantidade: number;
  fornecedor: string;
  status: RecebimentoStatus | string;
  unidade_negocio?: string;
  data_conferencia?: string | null;
  data_alocacao?: string | null;
  saldo_final?: number;
}

export interface RespostaHistoricoRecebimentos {
  itens: ItemHistoricoRecebimento[];
  totalRegistros: number;
  paginaAtual: number;
  totalPaginas: number;
  limitePorPagina: number;
}

export type TipoAlteracaoEndereco = 
  | 'Recebimento NF'
  | 'Avulsa'
  | 'Via nota de entrada'
  | 'Movimentação interna'
  | 'Correção de endereço'
  | 'Inventário'
  | 'Outros';

export interface AlteracaoEndereco {
  id: string;
  unidade_negocio?: string; // Isolamento por Unidade de Negócio
  data: string; // timestamptz ISO
  produto: string;
  endereco_antigo: string;
  endereco_novo: string;
  tipo_alteracao: TipoAlteracaoEndereco | string;
  usuario_alteracao: string; // ID do usuário autenticado (usuarios.id)
  usuario_nome?: string;
  usuario_codigo?: string;
  alterado_sistema: boolean; // false = Pendente, true = Concluído
  created_at?: string;
  usuario_confirmacao?: string | null;
  usuario_confirmacao_nome?: string | null;
  data_confirmacao?: string | null;
}

export interface ResumoNotaAlocacao {
  nota_fiscal: string;
  agendamento_id: string;
  data_recebimento: string;
  fornecedor?: string;
  total_itens: number; // quantidade de produtos distintos
  total_quantidade: number; // soma das quantidades recebidas
  total_saldo_pendente: number; // soma dos saldos finais a alocar
  status_alocacao: 'Pendente' | 'Parcial' | 'Concluído';
}

// -------------------------------------------------------------
// POLIFILTRO — MÓDULO DE RELATÓRIOS
// Extensível para múltiplas funções e exportação
// -------------------------------------------------------------

export interface ItemRelatorioRecebimentoProduto {
  id: string | number;
  agendamento_id: string;
  nota_fiscal: string;
  produto: string;
  quantidade: number;
  qtd_conferida?: number | null;
  saldo_final: number;
  status: RecebimentoStatus;
  
  // Conferência
  conferente_id?: string | null;
  conferente_nome: string;
  conferente_codigo?: string;
  data_hora_conferencia: string | null; // ISO ou DD/MM/AAAA HH:mm
  
  // Endereçamento e Reposição
  endereco: string;
  endereco_original?: string | null;
  endereco_alterado: boolean;
  repositor_id?: string | null;
  repositor_nome: string;
  repositor_codigo?: string;
  data_hora_reposicao: string | null; // ISO ou DD/MM/AAAA HH:mm
}

export interface ResumoRelatorioRecebimento {
  nota_fiscal: string;
  fornecedor: string;
  data_recebimento: string;
  data_emissao_relatorio: string;
  total_itens: number;
  total_quantidade: number;
  total_conferidos: number;
  total_alocados: number;
  itens: ItemRelatorioRecebimentoProduto[];
}

export interface RelatorioDisponivelInfo {
  id: string;
  titulo: string;
  descricao: string;
  tabelaOrigem: string;
  categoria: 'Recebimento & Alocação' | 'Estoque & Inventário' | 'Movimentações' | 'Produtividade';
  icone: string;
  disponivel: boolean;
  camposObrigatorios: string[];
}

// -------------------------------------------------------------
// POLIHUB — MÓDULO DE COLETAS DA EXPEDIÇÃO
// Tabela: public.expedicao_coletas
// -------------------------------------------------------------
export type StatusColeta = 'Agendada' | 'Pendente' | 'Coletada';

export interface ExpedicaoColeta {
  id: string; // UUID primary key
  unidade_negocio?: string; // Isolamento por Unidade de Negócio
  chave_nf?: string | null;
  numero_nota_fiscal: string;
  cliente: string;
  transportadora: string;
  status: StatusColeta;
  data: string; // ISO timestamptz
  numero_coleta?: string | null;
  usuario_id?: string | null;
  usuario_nome?: string | null; // Resolved/joined via usuarios table
  valor?: number | null; // Valor total da nota fiscal (numérico/monetário)
  separador_id?: string | null; // FK usuarios.id (responsável pela separação)
  separador_nome?: string | null; // Nome do separador populado via usuarios
  conferente_id?: string | null; // FK usuarios.id (responsável pela conferência)
  conferente_nome?: string | null; // Nome do conferente populado via usuarios
  quantidade?: number | null; // Quantidade de itens da coleta (inteiro)
  created_at?: string;
  updated_at?: string;
}

// -------------------------------------------------------------
// POLIHUB — TABELA DE ATUALIZAÇÕES OPERACIONAIS (Feed & Badges)
// Tabela: public.atualizacoes
// -------------------------------------------------------------
export interface Atualizacao {
  id: string;
  unidade_negocio: string; // Isolamento obrigatório por Unidade de Negócio
  numero: number;
  modulo: string;
  tipo: string;
  titulo: string;
  descricao?: string | null;
  registro_id?: string | null;
  usuario_id?: string | null;
  data_evento?: string;
  created_at?: string;
}

// -------------------------------------------------------------
// POLIHUB — MÓDULO DE PEDIDOS (SEPARAÇÃO, PRODUTOS, COLETAS, KPIS)
// Tabelas: public.separacao_pedidos e public.produtos_pedido
// -------------------------------------------------------------

export type StatusSeparacaoOperacional = 'Pendente' | 'Em Separação' | 'Separado' | 'Em Conferência' | 'Concluído';

export interface SeparacaoPedido {
  id: string; // UUID primary key
  id_pedido: string; // Identificação do pedido (obrigatório, único por unidade_negocio)
  unidade_negocio?: string; // Isolamento por Unidade de Negócio
  data: string; // Data YYYY-MM-DD
  codigo_controle: string; // Código de controle operacional
  cliente: string; // Nome do cliente
  transportador: string; // Nome da transportadora
  quantidade_itens: number; // Quantidade de itens do pedido
  separador_id?: string | null; // UUID -> usuarios.id
  separador_nome?: string | null; // Resolved via usuarios
  hora_inicial_separacao?: string | null; // HH:mm
  hora_final_separacao?: string | null; // HH:mm
  conferente_id?: string | null; // UUID -> usuarios.id
  conferente_nome?: string | null; // Resolved via usuarios
  hora_inicial_conferencia?: string | null; // HH:mm
  hora_final_conferencia?: string | null; // HH:mm
  created_at?: string;
  updated_at?: string;
  // Campos calculados / auxiliares
  tempo_separacao_minutos?: number | null;
  tempo_conferencia_minutos?: number | null;
  status_operacional?: StatusSeparacaoOperacional;
  total_produtos_vinculados?: number;
}

export interface ProdutoPedido {
  id: string; // UUID
  pedido_id: string; // FK -> separacao_pedidos.id
  codigo_barra: string;
  produto: string;
  locacao: string;
  quantidade: number;
  saldo: number;
  created_at?: string;
}

// -------------------------------------------------------------
// POLIHUB — MÓDULO DEMONSTRAÇÕES (PEDIDOS -> DEMONSTRAÇÕES)
// Tabela: public.demonstracoes
// REGRA: NÃO POSSUI COLUNA STATUS NO BANCO DE DADOS.
// Status é calculado dinamicamente: data_devolvida IS NULL ? 'Demonstração' : 'Devolvido'
// -------------------------------------------------------------

export type StatusDemonstracaoDinamico = 'Demonstração' | 'Devolvido';

export interface Demonstracao {
  id: string; // UUID primary key
  unidade_negocio: string; // Isolamento por unidade de negócio
  produto: string; // Descrição ou código/descrição do produto
  produto_id?: string | null; // UUID -> produtos.id (opcional para integridade)
  codigo_produto?: string | null; // Código interno ou código de barras
  endereco: string; // Local/endereço do produto
  colaborador: string; // UUID -> usuarios.id
  colaborador_nome?: string | null; // Nome resolvido do colaborador
  colaborador_codigo?: string | null; // Código do colaborador
  data_coletada: string; // Timestamp de retirada (ISO)
  data_devolvida?: string | null; // Timestamp de devolução (ISO) ou null
  observacao?: string | null; // Observações da saída ou devolução
  created_at?: string;
  updated_at?: string;

  // Campo calculado em tempo de execução
  status_dinamico?: StatusDemonstracaoDinamico;
}

// -------------------------------------------------------------
// POLIHUB — MÓDULO AUDITORIA DE PRODUTOS
// Consulta unificada de movimentações nos últimos 30 dias (ou período)
// a partir das tabelas existentes: recebimentos_produtos, alteracoes_endereco e inventario.
// -------------------------------------------------------------

export type TipoEventoAuditoria =
  | 'RECEBIMENTO'
  | 'CONFERENCIA_RECEBIMENTO'
  | 'ALOCACAO'
  | 'ALTERACAO_ENDERECO'
  | 'CONTAGEM_INVENTARIO'
  | 'CORRECAO_CONTAGEM';

export interface EventoAuditoria {
  id: string;
  tipo: TipoEventoAuditoria;
  tipoLabel: string; // Ex: 'Recebimento', 'Conferência de Recebimento', 'Alocação', 'Alteração de Endereço', 'Contagem de Inventário', 'Correção de Contagem'
  dataHora: string; // ISO timestamptz
  produto: string;
  codigoProduto?: string;
  quantidade?: number | null;
  quantidadeAnterior?: number | null;
  endereco?: string | null;
  enderecoAnterior?: string | null;
  novoEndereco?: string | null;
  notaFiscal?: string | null;
  responsavelId?: string | null;
  responsavelNome?: string | null;
  responsavelCodigo?: string | null;
  status?: string | null;
  observacao?: string | null;
  unidadeNegocio?: string | null;
  tabelaOrigem: 'recebimentos_produtos' | 'alteracoes_endereco' | 'inventario';
  isPendente?: boolean;
  isAvulsa?: boolean;
}

export type PeriodoOpcao = '7d' | '15d' | '30d' | 'personalizado';

export interface PeriodoFiltro {
  tipo: PeriodoOpcao;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
  rotulo: string;
}

export interface ResumoAuditoriaProduto {
  produto: Produto;
  periodo: PeriodoFiltro;
  unidadeNegocio: string;
  totalRecebimentos: number;
  totalConferencias: number;
  totalAlocacoes: number;
  totalAlteracoesEndereco: number;
  totalAlteracoesPendentes?: number;
  totalAlteracoesAvulsas?: number;
  totalContagens: number;
  totalCorrecoes: number;
  totalGeral: number;
  eventos: EventoAuditoria[];
}

// -------------------------------------------------------------
// POLIHUB — MÓDULO PEDIDOS: CHAMADOS LOGÍSTICOS
// Tabela Supabase: public.chamados
// -------------------------------------------------------------

export type TipoProblemaChamado = 'Avaria' | 'Produto errado' | 'Atraso' | 'Endereço errado';

export type StatusChamado = 'Aberto' | 'Concluído';

export interface ItemProdutoChamado {
  produto_id?: string;
  codigo?: string;
  produto: string;
  quantidade: number;
  codigo_barras?: string;
}

export interface TransportadoraChamado {
  transportadora_id?: string;
  transportadora: string;
}

export type ProdutoTransportadoraChamado = ItemProdutoChamado[] | TransportadoraChamado;

export interface ChamadoLogistico {
  id: string;
  unidade_negocio: string;
  data: string; // Data e hora de abertura (ISO timestamptz)
  usuario_abertura: string; // Nome ou identificação do usuário que abriu
  usuario_abertura_id?: string | null; // ID do usuário que abriu
  cliente: string;
  nota_fiscal: string;
  tipo_problema: TipoProblemaChamado;
  produto_transportadora: ProdutoTransportadoraChamado;
  status: StatusChamado; // 'Aberto' | 'Concluído'
  resolucao?: string | null;
  data_conclusao?: string | null;
  usuario_fechamento?: string | null;
  usuario_fechamento_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

// -------------------------------------------------------------
// POLIHUB — MÓDULO CONTROLE DE VEÍCULOS
// Tabelas: public.veiculos, public.saidas_veiculos, public.saidas_coletas, public.abastecimentos_veiculos
// -------------------------------------------------------------

export interface Veiculo {
  id: string; // UUID
  nome: string; // Identificação (ex: "Fiorino 01")
  marca: string; // Ex: "Fiat"
  placa: string; // Ex: "BRA2E19"
  unidade_negocio_id?: string | null; // UUID da unidade
  unidade_negocio: string; // Nome normalizado da unidade (ex: "Goiânia-GO")
  ativo: boolean; // Suporte a desativação sem exclusão de histórico
  created_at?: string;
  updated_at?: string;
}

export type PeriodoSaida = 'Manhã' | 'Tarde';
export type PeriodoSaidaVeiculo = PeriodoSaida;

export interface SaidaVeiculo {
  id: string; // UUID
  data: string; // YYYY-MM-DD
  horario: string; // HH:mm
  periodo: PeriodoSaida;
  veiculo_id: string; // FK veiculos.id
  veiculo_nome?: string;
  veiculo_marca?: string;
  veiculo_placa?: string;
  motorista_id: string; // FK usuarios.id
  motorista_nome: string;
  km_saida: number; // Informado pelo usuário
  km_rodado: number | null; // Calculado automaticamente com base na saída imediatamente anterior do mesmo veículo (null se 1ª saída)
  quantidade_entregas: number; // Quantidade de coletas vinculadas
  valor_total_notas: number; // Soma dos valores das notas das coletas selecionadas
  observacao?: string | null;
  unidade_negocio_id?: string | null;
  unidade_negocio: string;
  usuario_id?: string | null;
  created_at?: string;
  updated_at?: string;
  // Entregas/coletas associadas
  entregas?: ExpedicaoColeta[];
}

export interface SaidaColetaVinculo {
  id: string; // UUID
  saida_id: string; // FK saidas_veiculos.id
  coleta_id: string; // FK expedicao_coletas.id
  created_at?: string;
}
export type SaidaColeta = SaidaColetaVinculo;

export interface AbastecimentoVeiculo {
  id: string; // UUID
  data: string; // YYYY-MM-DD
  horario: string; // HH:mm
  veiculo_id: string; // FK veiculos.id
  veiculo_nome?: string;
  veiculo_marca?: string;
  veiculo_placa?: string;
  motorista_id: string; // FK usuarios.id
  motorista_nome: string;
  km_abastecimento: number;
  quantidade_litros: number; // Litros abastecidos
  valor_total: number; // Valor em R$
  preco_litro?: number | null; // Calculado (valor_total / quantidade_litros)
  observacao?: string | null;
  unidade_negocio_id?: string | null;
  unidade_negocio: string;
  usuario_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface IndicadoresVeiculos {
  kmTotalRodado: number;
  quantidadeSaidas: number;
  quantidadeEntregas: number;
  valorTotalNotas: number;
  totalAbastecido: number; // R$
  quantidadeAbastecida: number; // Litros
  custoPorKm: number; // R$/km
  consumoMedioKmPorLitro: number; // km/L
  mediaEntregasPorSaida: number;
  ticketMedioPorEntrega: number;
  resumoPorVeiculo: Array<{
    veiculoId: string;
    veiculoNome: string;
    veiculoPlaca: string;
    saidas: number;
    kmRodado: number;
    entregas: number;
    valorNotas: number;
    abastecidoLitros: number;
    abastecidoValor: number;
    custoPorKm: number;
  }>;
  resumoPorMotorista: Array<{
    motoristaId: string;
    motoristaNome: string;
    saidas: number;
    kmRodado: number;
    entregas: number;
    valorNotas: number;
    abastecidoValor: number;
  }>;
}

// -------------------------------------------------------------
// POLIHUB — MÓDULO DE COMPRAS (SOLICITAÇÕES E APROVAÇÕES)
// Tabela: public.compras
// -------------------------------------------------------------
export type DemandaCompra = 'Estoque' | 'Sob Encomenda' | 'Consumos';
export type DemandaCompraHistorico = DemandaCompra | 'Necessidade' | 'Compras';
export type UrgenciaCompra = 'Média' | 'Rápida' | 'Urgente';
export type StatusCompra = 'Solicitado' | 'Aprovado' | 'Recusado' | 'Comprado';

export interface SolicitacaoCompra {
  id: string; // UUID chave primária
  data_insercao: string; // Data e hora de criação (ISO string)
  id_produto: string; // Relacionado a public.produtos.id
  quantidade: number; // Inteiro de 1 a 1.000 (quantidade solicitada original)
  quantidade_aprovada?: number | null; // Quantidade aprovada pelo gestor (quando aplicável)
  demanda: DemandaCompra | 'Necessidade' | 'Compras'; // Estoque | Sob Encomenda | Consumos (com suporte a histórico)
  urgencia: UrgenciaCompra; // Média | Rápida | Urgente
  id_solicitante: string; // UUID do usuário solicitante
  status: StatusCompra; // Solicitado | Aprovado | Recusado | Comprado
  id_usuario_aprovacao?: string | null; // UUID do gestor responsável
  data_aprovacao?: string | null; // Data e hora da decisão
  motivo_recusa?: string | null; // Motivo quando recusado
  id_usuario_compra?: string | null; // UUID do usuário que realizou a compra
  data_compra?: string | null; // Data e hora da compra concluída
  observacao?: string | null; // Informações adicionais
  unidade_negocio?: string; // Isolamento por unidade de negócio

  // Relacionamentos populados/resolvidos
  produto?: Produto | null;
  produto_nome?: string;
  produto_fabricante?: string;
  produto_codigo_barras?: string | null;
  produto_endereco?: string | null;
  solicitante?: Usuario | null;
  solicitante_nome?: string;
  solicitante_departamento?: string;
  solicitante_foto?: string | null;
  usuario_aprovacao?: Usuario | null;
  usuario_aprovacao_nome?: string;
  usuario_compra?: Usuario | null;
  usuario_compra_nome?: string;
}

export interface FiltrosCompra {
  fabricante?: string;
  produtoId?: string;
  termoBusca?: string;
  dataInicio?: string;
  dataFim?: string;
  solicitanteId?: string;
  status?: StatusCompra | 'Todos' | StatusCompra[];
  urgencia?: UrgenciaCompra | 'Todos';
  demanda?: DemandaCompra | 'Necessidade' | 'Compras' | 'Todos';
  gestorAprovacaoId?: string;
  unidade_negocio?: string;
  pagina?: number;
  limite?: number;
}

export interface RespostaPaginadaCompras {
  itens: SolicitacaoCompra[];
  totalRegistros: number;
  paginaAtual: number;
  totalPaginas: number;
  limitePorPagina: number;
}

export interface MetricasCompras {
  total: number;
  solicitados: number;
  aprovados: number;
  comprados: number;
  urgentes: number;
  rapidas: number;
  medias: number;
  porDemanda: {
    estoque: number;
    sobEncomenda: number;
    consumos: number;
    necessidade?: number;
    compras?: number;
  };
  totalItensQuantidade: number;
  topFabricantes: Array<{ fabricante: string; quantidade: number; totalSolicitacoes: number }>;
  topProdutos: Array<{ produto: string; fabricante: string; totalSolicitacoes: number; quantidadeTotal: number }>;
}

export interface FiltrosMetricasRecebimento {
  unidadeNegocio?: string;
  dias?: number;
  dataInicio?: string;
  dataFim?: string;
  fornecedor?: string;
}

export interface MetricasRecebimento {
  periodo: {
    dataInicio: string;
    dataFim: string;
    diasFiltro: number;
    fornecedorFiltro?: string;
  };
  totais: {
    totalNotas: number; // Quantidade de notas fiscais distintas
    totalLinhasProdutos: number; // Quantidade de linhas de produtos recebidos
    totalUnidadesRecebidas: number; // Soma das quantidades de unidades físicas
    totalSkusDistintos: number; // Quantidade total de SKUs distintos no período
    totalDiasComRecebimento: number; // Quantidade de dias distintos com recebimento
    mediaSkusPorDia: number; // Média de SKUs distintos recebidos por dia
    tempoMedioAgendamentoChegadaDias: number | null; // Tempo médio em dias entre data_insercao e data_entrega
    totalAgendamentosValidosTempo: number; // Quantidade de agendamentos com ambas as datas válidas
    totalNotasComDivergencia: number; // Quantidade de notas com produtos em status 'Crítica'
    taxaAcuraciaConferencia: number; // % de notas sem divergência
  };
  rankingFornecedores: Array<{
    fornecedor: string;
    totalNotas: number;
    totalLinhas: number;
    totalUnidades: number;
  }>;
  rankingProdutos: Array<{
    descricao: string;
    codigo: string;
    quantidadeTotal: number;
    totalNotas: number;
  }>;
  volumePorDia: Array<{
    data: string; // YYYY-MM-DD
    dataLabel: string; // DD/MM
    totalNotas: number;
    totalItensLinhas: number;
    totalUnidades: number;
    totalSkus: number;
  }>;
  recebimentosPorFornecedor: Array<{
    fornecedor: string;
    totalUnidades: number;
    totalNotas: number;
    percentualVolume: number;
  }>;
  fornecedoresComDivergencias: Array<{
    fornecedor: string;
    totalNotasComCritica: number;
    totalItensCriticos: number;
    totalNotasFornecedor: number;
    percentualCritica: number;
  }>;
  tempoRecebimentoPorFornecedor: Array<{
    fornecedor: string;
    tempoMedioDias: number;
    totalAgendamentosAvaliados: number;
  }>;
  fornecedoresDisponiveis: string[];
}

// -------------------------------------------------------------
// POLIHUB — MÓDULO DE ATENDIMENTO WHATSAPP BUSINESS INTELIGENTE
// -------------------------------------------------------------

export type WhatsAppStatusConexao = 'conectado' | 'pendente' | 'desconectado' | 'erro';
export type WhatsAppTipoContato = 'desconhecido' | 'cliente' | 'colaborador' | 'gestor' | 'fornecedor' | 'outro';
export type WhatsAppStatusConversa = 'aguardando' | 'em_andamento' | 'encerrado';
export type WhatsAppTipoMensagem = 'contato' | 'colaborador' | 'sistema';
export type WhatsAppStatusEnvio = 'pendente' | 'enviado' | 'entregue' | 'lido' | 'falha';
export type WhatsAppBadgeColor = 'red' | 'orange' | 'dark';

export interface WhatsAppCanal {
  id: string; // UUID
  nome: string; // Ex: 'WhatsApp Atendimento Goiânia'
  numero_telefone: string; // Formato E.164, ex: '+5562999998888'
  unidade_negocio: string; // Filial vinculada
  meta_phone_number_id?: string | null;
  meta_waba_id?: string | null;
  meta_access_token?: string | null; // Protegido no backend
  meta_webhook_verify_token?: string | null;
  meta_app_id?: string | null;
  status_conexao: WhatsAppStatusConexao;
  horario_inicio?: string; // HH:mm ex: '08:00'
  horario_fim?: string; // HH:mm ex: '18:00'
  dias_funcionamento?: string[]; // ['seg','ter','qua','qui','sex']
  mensagem_fora_horario?: string | null;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface WhatsAppContato {
  id: string; // UUID
  telefone: string; // Formato internacional limpo (+5562...)
  nome: string;
  tipo_contato: WhatsAppTipoContato;
  departamento_relacionado?: string | null; // 'Logística' | 'Comercial' | 'Financeiro'
  unidade_negocio?: string | null;
  colaborador_vinculado_id?: string | null; // Vinculação a colaborador específico
  colaborador_vinculado_nome?: string | null;
  regra_atendimento: 'padrao' | 'direto_colaborador' | 'fila_especifica' | 'prioritario';
  mensagem_personalizada?: string | null;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface WhatsAppFila {
  id: string; // UUID
  nome: string; // 'Recebimento' | 'Expedição' | 'Agendamentos' | 'Retira' | 'Entregas Nosso Carro' | 'Comercial' | 'Geral'
  descricao?: string | null;
  unidade_negocio?: string | null;
  departamento?: string; // Padrão: 'Logística'
  ordem?: number;
  ativo: boolean;
  created_at?: string;
}

export interface WhatsAppOpcaoMenu {
  id: string;
  label: string;
  valor: string; // '1', '2', etc.
  destino_fila: string; // Fila para onde direciona
}

export interface WhatsAppMensagemAutomatica {
  id: string; // UUID
  nome: string;
  tipo_evento: 'boas_vindas' | 'fora_horario' | 'sem_atendentes' | 'gestor_identificado' | 'resposta_invalida' | 'fallback';
  perfil_contato: 'todos' | 'desconhecido' | 'cliente' | 'colaborador' | 'gestor';
  fila_id?: string | null;
  unidade_negocio?: string | null;
  texto: string;
  opcoes?: WhatsAppOpcaoMenu[];
  mensagem_invalida?: string | null;
  ordem?: number;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface WhatsAppUsuarioHabilitado {
  id: string; // UUID
  usuario_id: string; // Relacionamento com usuarios.id
  usuario_nome?: string;
  usuario_codigo?: string;
  usuario_departamento?: string;
  usuario_nivel?: string;
  habilitado: boolean;
  disponivel: boolean; // Se está online para receber atendimentos
  filas_permitidas: string[]; // Lista de nomes de filas
  pode_visualizar_grupos: boolean;
  pode_responder_grupos: boolean; // Restrito a gestores autorizados
  is_gestor_whatsapp: boolean; // Permissão administrativa do módulo
  unidade_negocio: string;
  created_at?: string;
  updated_at?: string;
}

export interface WhatsAppConversa {
  id: string; // UUID
  canal_id: string;
  canal_nome?: string;
  contato_id?: string | null;
  numero_remetente: string;
  nome_remetente: string;
  unidade_negocio: string;
  fila_nome: string;
  usuario_atribuido_id?: string | null;
  usuario_atribuido_nome?: string | null;
  status: WhatsAppStatusConversa;
  tipo_conversa: 'individual' | 'grupo';
  grupo_id_externo?: string | null;
  grupo_titulo?: string | null;
  ultima_mensagem_texto?: string | null;
  ultima_mensagem_data: string;
  data_inicio_atendimento?: string | null;
  data_encerramento?: string | null;
  encerrado_por_usuario_id?: string | null;
  encerrado_por_nome?: string | null;
  contato_tipo?: WhatsAppTipoContato;
  nao_lidas?: number;
  created_at: string;
  updated_at?: string;
}

export interface WhatsAppMensagem {
  id: string; // UUID
  conversa_id: string;
  tipo_remetente: WhatsAppTipoMensagem;
  usuario_id?: string | null;
  autor_nome: string; // Nome oficial (Ex: "Maria Rosa", "João Silva", ou "Atendimento automático")
  conteudo: string;
  meta_message_id?: string | null;
  status_envio: WhatsAppStatusEnvio;
  erro_mensagem?: string | null;
  created_at: string;
}

export interface WhatsAppHistoricoAcao {
  id: string; // UUID
  conversa_id: string;
  usuario_id?: string | null;
  usuario_nome?: string | null;
  tipo_acao: 'inicio_atendimento' | 'atribuicao' | 'transferencia' | 'encerramento' | 'reabertura' | 'alteracao_config';
  detalhes?: Record<string, any> | null;
  created_at: string;
}

export interface WhatsAppBadgeStatus {
  habilitado: boolean;
  pendentes_count: number;
  em_andamento_count: number;
  cor: WhatsAppBadgeColor; // 'red' | 'orange' | 'dark'
}

// -------------------------------------------------------------
// POLIHUB — MÓDULO MENSAGENS INTERNAS (CHAT FLUTUANTE)
// Tabelas: public.chat_conversas, chat_participantes, chat_mensagens
// -------------------------------------------------------------
export type ChatTipoConversa = 'individual' | 'grupo';

export interface ChatConversa {
  id: string; // UUID
  tipo: ChatTipoConversa;
  nome?: string | null; // Nome do grupo (opcional para individual)
  criado_por?: string | null; // FK usuarios.id
  unidade_negocio_id?: string | null; // FK unidades_negocio.id
  ativo: boolean;
  created_at: string;
  ultima_mensagem_em: string;
  // Campos calculados para exibição na UI
  ultima_mensagem?: string | null;
  nao_lidas?: number;
  tem_nao_lidas_gestor?: boolean;
  outro_usuario?: {
    id: string;
    nome: string;
    codigo?: string;
    departamento?: string;
    unidade_negocio?: string;
    foto?: string | null;
    nivel?: string;
  } | null;
  participantes?: ChatParticipante[];
  participantes_count?: number;
}

export interface ChatParticipante {
  id: string; // UUID
  conversa_id: string; // FK chat_conversas.id
  usuario_id: string; // FK usuarios.id
  ultima_leitura_em: string;
  entrou_em: string;
  saiu_em?: string | null;
  created_at: string;
  usuario?: Usuario | null;
}

export interface ChatMensagem {
  id: string; // UUID
  conversa_id: string; // FK chat_conversas.id
  remetente_id: string; // FK usuarios.id
  conteudo: string;
  created_at: string;
  // Detalhes do autor (computados sem duplicar na mensagem)
  remetente_nome?: string;
  remetente_codigo?: string;
}

export interface ChatUsuarioContato {
  id: string;
  nome: string;
  codigo?: string;
  unidade_negocio: string;
  departamento?: string;
  funcao?: string;
  nivel?: string;
  foto?: string | null;
  status?: string;
  ultimo_acesso?: string | null;
}
