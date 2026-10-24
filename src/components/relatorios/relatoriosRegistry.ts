import { RelatorioDisponivelInfo } from '../../types';

export const RELATORIOS_REGISTRY: RelatorioDisponivelInfo[] = [
  {
    id: 'recebimentos_produtos',
    titulo: 'Recebimento de Produtos por NF',
    descricao:
      'Relatório analítico da tabela recebimentos_produtos. Exibe produtos, quantidades, conferente responsável com data e hora de conferência, endereço oficial, repositor e data da reposição física.',
    tabelaOrigem: 'public.recebimentos_produtos',
    categoria: 'Recebimento & Alocação',
    icone: 'ClipboardCheck',
    disponivel: true,
    camposObrigatorios: ['Nota Fiscal'],
  },
  {
    id: 'inventario_divergencias',
    titulo: 'Auditoria de Inventário & Divergências',
    descricao:
      'Comparativo analítico entre contagem física cega e saldo do WMS, com divergências percentuais, status de correção e usuário auditor.',
    tabelaOrigem: 'public.tabela_inventario',
    categoria: 'Estoque & Inventário',
    icone: 'Package',
    disponivel: false,
    camposObrigatorios: ['Endereço ou Data de Contagem'],
  },
  {
    id: 'historico_enderecamento',
    titulo: 'Histórico de Alterações de Endereço',
    descricao:
      'Rastreabilidade completa de re-endereçamento e movimentações internas, com motivos, usuário de alteração e data de confirmação no sistema.',
    tabelaOrigem: 'public.alteracoes_endereco',
    categoria: 'Movimentações',
    icone: 'MapPin',
    disponivel: false,
    camposObrigatorios: ['Período de Consulta'],
  },
  {
    id: 'produtividade_operacional',
    titulo: 'Produtividade de Conferência & Alocação',
    descricao:
      'Consolidado de volumes e itens conferidos/alocados por operador em determinado turno ou período.',
    tabelaOrigem: 'public.recebimentos_produtos + usuarios',
    categoria: 'Produtividade',
    icone: 'TrendingUp',
    disponivel: false,
    camposObrigatorios: ['Data Inicial e Final'],
  },
];
