import {
  Agendamento,
  AlteracaoEndereco,
  EnderecoLogistico,
  Fornecedor,
  ItemInventario,
  Produto,
  RecebimentoProduto,
  RegistroEndereco,
  RegistroInventario,
  Tarefa,
  Transportadora,
  Usuario,
  ChamadoLogistico,
  Veiculo,
  SaidaVeiculo,
  AbastecimentoVeiculo,
  SaidaColeta,
  SolicitacaoCompra,
  DemandaCompra,
  WhatsAppCanal,
  WhatsAppContato,
  WhatsAppFila,
  WhatsAppMensagemAutomatica,
  WhatsAppUsuarioHabilitado,
  WhatsAppConversa,
  WhatsAppMensagem,
  WhatsAppHistoricoAcao,
} from '../types';

const INITIAL_USUARIOS: Usuario[] = [
  {
    id: 'usr-default-01',
    nome: 'Luiz Fernando',
    codigo: 'OP-1042',
    email: 'luizfernando702@gmail.com',
    unidade_negocio: 'Goiânia',
    foto: null,
    departamento: 'Logística',
    funcao: 'Operador Logístico',
    nivel: 'Operador',
    status: 'aprovado',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'usr-default-02',
    nome: 'Mariana Silva (Gestora)',
    codigo: 'GS-2005',
    email: 'mariana.silva@polifiltro.com.br',
    unidade_negocio: 'Goiânia',
    foto: null,
    departamento: 'Logística',
    funcao: 'Operador Logístico',
    nivel: 'Gestor',
    status: 'aprovado',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'usr-motorista-01',
    nome: 'Carlos Silveira',
    codigo: 'MOT-01',
    email: 'carlos.silveira@polifiltro.com.br',
    unidade_negocio: 'Goiânia',
    foto: null,
    departamento: 'Logística',
    funcao: 'Motorista',
    nivel: 'Operador',
    status: 'aprovado',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'usr-motorista-02',
    nome: 'Marcos Rocha',
    codigo: 'MOT-02',
    email: 'marcos.rocha@polifiltro.com.br',
    unidade_negocio: 'Belo Horizonte-MG',
    foto: null,
    departamento: 'Logística',
    funcao: 'Motorista',
    nivel: 'Operador',
    status: 'aprovado',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

// Dados reais sincronizados com o Supabase (sem registros fictícios)
const INITIAL_AGENDAMENTOS: Agendamento[] = [];

export const INITIAL_ENDERECOS: EnderecoLogistico[] = [
  {
    id: 'end-01',
    codigo: 'R01-C01-P01-N1',
    rua: 'Rua 01',
    corredor: 'Corredor 01',
    prateleira: 'Prateleira 01',
    coluna: 'Coluna 01',
    nivel: 'Nível 1 (Térreo)',
    posicao: 'Posição 01',
    status: 'Ocupado',
    tipo_armazenagem: 'Porta-Paletes',
    capacidade_kg: 1200,
    produto_alocado: 'Nescafé Tradicional 200g (SKU-8821)',
    dimensoes: '1.20m x 1.00m x 1.60m',
  },
  {
    id: 'end-02',
    codigo: 'R01-C01-P01-N2',
    rua: 'Rua 01',
    corredor: 'Corredor 01',
    prateleira: 'Prateleira 01',
    coluna: 'Coluna 01',
    nivel: 'Nível 2 (Intermediário)',
    posicao: 'Posição 02',
    status: 'Livre',
    tipo_armazenagem: 'Porta-Paletes',
    capacidade_kg: 1000,
    produto_alocado: null,
    dimensoes: '1.20m x 1.00m x 1.60m',
  },
  {
    id: 'end-03',
    codigo: 'R01-C02-P01-N1',
    rua: 'Rua 01',
    corredor: 'Corredor 02',
    prateleira: 'Prateleira 01',
    coluna: 'Coluna 01',
    nivel: 'Nível 1 (Térreo)',
    posicao: 'Posição 01',
    status: 'Ocupado',
    tipo_armazenagem: 'Porta-Paletes',
    capacidade_kg: 1200,
    produto_alocado: 'Sabão Líquido Omo 3L (SKU-4412)',
    dimensoes: '1.20m x 1.00m x 1.60m',
  },
  {
    id: 'end-04',
    codigo: 'R01-C02-P02-N1',
    rua: 'Rua 01',
    corredor: 'Corredor 02',
    prateleira: 'Prateleira 02',
    coluna: 'Coluna 02',
    nivel: 'Nível 1 (Térreo)',
    posicao: 'Posição 02',
    status: 'Reservado',
    tipo_armazenagem: 'Porta-Paletes',
    capacidade_kg: 1200,
    produto_alocado: 'Agendamento NF 004.892.110',
    dimensoes: '1.20m x 1.00m x 1.60m',
  },
  {
    id: 'end-05',
    codigo: 'R02-C01-P01-N1',
    rua: 'Rua 02',
    corredor: 'Corredor 01',
    prateleira: 'Prateleira 01',
    coluna: 'Coluna 01',
    nivel: 'Nível 1 (Térreo)',
    posicao: 'Posição 01',
    status: 'Livre',
    tipo_armazenagem: 'Porta-Paletes',
    capacidade_kg: 1500,
    produto_alocado: null,
    dimensoes: '1.20m x 1.00m x 1.80m',
  },
  {
    id: 'end-06',
    codigo: 'R02-C01-P02-N1',
    rua: 'Rua 02',
    corredor: 'Corredor 01',
    prateleira: 'Prateleira 02',
    coluna: 'Coluna 02',
    nivel: 'Nível 1 (Térreo)',
    posicao: 'Posição 02',
    status: 'Bloqueado',
    tipo_armazenagem: 'Porta-Paletes',
    capacidade_kg: 1500,
    produto_alocado: 'Em Manutenção Estrutural',
    dimensoes: '1.20m x 1.00m x 1.80m',
  },
  {
    id: 'end-07',
    codigo: 'R02-C02-P01-N1',
    rua: 'Rua 02',
    corredor: 'Corredor 02',
    prateleira: 'Prateleira 01',
    coluna: 'Coluna 01',
    nivel: 'Nível 1 (Térreo)',
    posicao: 'Posição 01',
    status: 'Ocupado',
    tipo_armazenagem: 'Blocado',
    capacidade_kg: 2500,
    produto_alocado: 'Cerveja Brahma Chopp Lata 350ml (SKU-1092)',
    dimensoes: '2.00m x 2.00m x 2.00m',
  },
  {
    id: 'end-08',
    codigo: 'R03-C01-P01-N1',
    rua: 'Rua 03',
    corredor: 'Corredor 01',
    prateleira: 'Gôndola Picking',
    coluna: 'Coluna 01',
    nivel: 'Nível 1',
    posicao: 'Gaveta A1',
    status: 'Livre',
    tipo_armazenagem: 'Picking Leve',
    capacidade_kg: 150,
    produto_alocado: null,
    dimensoes: '0.60m x 0.40m x 0.35m',
  }
];

export const INITIAL_INVENTARIO: ItemInventario[] = [
  {
    id: 'inv-01',
    sku: 'POLI-8821',
    descricao: 'Nescafé Tradicional Vidro 200g',
    categoria: 'Alimentos & Bebidas',
    quantidade: 340,
    unidade: 'CX',
    localizacao_id: 'end-01',
    endereco_codigo: 'R01-C01-P01-N1',
    estoque_minimo: 80,
    estoque_maximo: 500,
    status: 'Normal',
    ultima_movimentacao: 'Recebimento NF 004.892.110',
  },
  {
    id: 'inv-02',
    sku: 'POLI-4412',
    descricao: 'Sabão Líquido Omo Lavagem Perfeita 3L',
    categoria: 'Higiene & Limpeza',
    quantidade: 45,
    unidade: 'CX',
    localizacao_id: 'end-03',
    endereco_codigo: 'R01-C02-P01-N1',
    estoque_minimo: 60,
    estoque_maximo: 300,
    status: 'Crítico',
    ultima_movimentacao: 'Separação Expedição PED-3312',
  },
  {
    id: 'inv-03',
    sku: 'POLI-1092',
    descricao: 'Cerveja Brahma Chopp Lata 350ml (Pack 12)',
    categoria: 'Bebidas Alcoólicas',
    quantidade: 850,
    unidade: 'FD',
    localizacao_id: 'end-07',
    endereco_codigo: 'R02-C02-P01-N1',
    estoque_minimo: 200,
    estoque_maximo: 1000,
    status: 'Normal',
    ultima_movimentacao: 'Recebimento NF 008.219.445',
  },
  {
    id: 'inv-04',
    sku: 'POLI-7730',
    descricao: 'Biscoito Cream Cracker Fortaleza 400g',
    categoria: 'Alimentos Secos',
    quantidade: 120,
    unidade: 'CX',
    localizacao_id: 'end-05',
    endereco_codigo: 'R02-C01-P01-N1',
    estoque_minimo: 100,
    estoque_maximo: 400,
    status: 'Normal',
    ultima_movimentacao: 'Ajuste de Balanço Cíclico',
  },
  {
    id: 'inv-05',
    sku: 'POLI-9944',
    descricao: 'Caixa de Papelão Reforçada Padrão G',
    categoria: 'Insumos de Embalagem',
    quantidade: 1400,
    unidade: 'UN',
    localizacao_id: 'end-04',
    endereco_codigo: 'R01-C02-P02-N1',
    estoque_minimo: 300,
    estoque_maximo: 1500,
    status: 'Excesso',
    ultima_movimentacao: 'Recebimento NF 007.412.301',
  }
];

const STORAGE_KEYS = {
  USUARIOS: 'polihub_usuarios',
  AGENDAMENTOS: 'polihub_agendamentos',
  ENDERECOS: 'polihub_enderecos',
  INVENTARIO: 'polihub_inventario',
  TABELA_ENDERECOS: 'polihub_tabela_enderecos_v2',
  TABELA_INVENTARIO: 'polihub_tabela_inventario_v3',
  RECEBIMENTOS_PRODUTOS: 'polihub_recebimentos_produtos_v1',
  ALTERACOES_ENDERECO: 'polihub_alteracoes_endereco_v1',
  TRANSPORTADORAS: 'polihub_transportadoras_v1',
  FORNECEDORES: 'polihub_fornecedores_v1',
  PRODUTOS: 'polihub_cadastros_produtos_v1',
  TAREFAS: 'polihub_tarefas_v1',
  CHAMADOS: 'polihub_chamados_v1',
  VEICULOS: 'polihub_veiculos_v1',
  SAIDAS_VEICULOS: 'polihub_saidas_veiculos_v1',
  SAIDAS_COLETAS: 'polihub_saidas_coletas_v1',
  ABASTECIMENTOS: 'polihub_abastecimentos_veiculos_v1',
  COMPRAS: 'polihub_compras_v1',
  CURRENT_USER: 'polihub_current_user',
  WHATSAPP_CANAIS: 'polihub_whatsapp_canais_v1',
  WHATSAPP_CONTATOS: 'polihub_whatsapp_contatos_v1',
  WHATSAPP_FILAS: 'polihub_whatsapp_filas_v1',
  WHATSAPP_MENSAGENS_AUTO: 'polihub_whatsapp_mensagens_auto_v1',
  WHATSAPP_USUARIOS_HABILITADOS: 'polihub_whatsapp_usuarios_habilitados_v1',
  WHATSAPP_CONVERSAS: 'polihub_whatsapp_conversas_v1',
  WHATSAPP_MENSAGENS: 'polihub_whatsapp_mensagens_v1',
  WHATSAPP_HISTORICO: 'polihub_whatsapp_historico_v1',
};

export const INITIAL_VEICULOS: Veiculo[] = [
  {
    id: 'veic-01',
    nome: 'Fiorino 01',
    marca: 'Fiat',
    placa: 'PQZ-7821',
    unidade_negocio: 'Goiânia-GO',
    ativo: true,
    created_at: '2026-09-01T08:00:00.000Z',
    updated_at: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'veic-02',
    nome: 'Fiorino 02',
    marca: 'Fiat',
    placa: 'PRB-3310',
    unidade_negocio: 'Goiânia-GO',
    ativo: true,
    created_at: '2026-09-01T08:00:00.000Z',
    updated_at: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'veic-03',
    nome: 'Caminhão Baú 01',
    marca: 'Mercedes-Benz',
    placa: 'RCI-9A34',
    unidade_negocio: 'Goiânia-GO',
    ativo: true,
    created_at: '2026-09-05T08:00:00.000Z',
    updated_at: '2026-09-05T08:00:00.000Z',
  },
  {
    id: 'veic-04',
    nome: 'HR Hyundai 01',
    marca: 'Hyundai',
    placa: 'NGU-4412',
    unidade_negocio: 'Belo Horizonte-MG',
    ativo: true,
    created_at: '2026-09-10T08:00:00.000Z',
    updated_at: '2026-09-10T08:00:00.000Z',
  },
];

export const INITIAL_TRANSPORTADORAS: Transportadora[] = [
  {
    id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
    razao_social: 'J&T Express Logística do Brasil Ltda',
    nome_fantasia: 'J&T Express',
    ativo: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
    razao_social: 'Braspress Transportes Urgentes Ltda',
    nome_fantasia: 'Braspress',
    ativo: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'c82305a4-0a37-4d92-9657-617a7a13c903',
    razao_social: 'RTE Rodonaves Transportes e Encomendas Ltda',
    nome_fantasia: 'Rodonaves',
    ativo: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'e42562b7-88d4-42b8-9366-3d2b270a4c04',
    razao_social: 'Direct Express Logística Integrada S.A.',
    nome_fantasia: 'DirectLog',
    ativo: true,
    created_at: new Date().toISOString(),
  }
];

export const INITIAL_FORNECEDORES: Fornecedor[] = [
  {
    id: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
    razao_social: 'Polifiltro Indústria e Comércio de Filtros Ltda',
    nome_fantasia: 'Polifiltro Fábrica',
    ativo: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    razao_social: 'Nestlé Brasil Alimentos e Bebidas Ltda',
    nome_fantasia: 'Nestlé Brasil',
    ativo: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '6ba7b811-9dad-11d1-80b4-00c04fd430c9',
    razao_social: 'M. Dias Branco S.A. Indústria e Comércio de Alimentos',
    nome_fantasia: 'M. Dias Branco',
    ativo: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '6ba7b812-9dad-11d1-80b4-00c04fd430ca',
    razao_social: 'Ambev S.A. Distribuidora e Manufatura',
    nome_fantasia: 'Ambev',
    ativo: true,
    created_at: new Date().toISOString(),
  }
];

// Dados reais sincronizados com public.enderecos no Supabase (sem registros fictícios)
export const INITIAL_TABELA_ENDERECOS: RegistroEndereco[] = [];

export const INITIAL_TABELA_INVENTARIO: RegistroInventario[] = [
  // Endereço A-01-01
  {
    id: 'inv-101',
    unidade_negocio: 'Goiânia',
    contagem: 'Contagem Geral Outubro',
    produto: 'POLI-8821 - Nescafé Tradicional Vidro 200g',
    endereco: 'A-01-01',
    qtd_contada: 100, // Menor que 120 -> Divergência Falta (Vermelho)
    qtd_disponivel: 120,
    qtd_atual: 120,
    peso_total: 24.0,
    qtd_reservada: 0,
    usuario_id: 'OP-1042',
    data_atualizada: new Date(Date.now() - 3600000 * 5).toISOString(),
    data_contagem: new Date(Date.now() - 3600000 * 5).toISOString(),
    corrigido: false,
    usuario_correcao: null,
    data_correcao: null,
    status: 'contada',
  },
  {
    id: 'inv-102',
    unidade_negocio: 'Goiânia',
    contagem: 'Contagem Geral Outubro',
    produto: 'POLI-7730 - Biscoito Cream Cracker Fortaleza 400g',
    endereco: 'A-01-01',
    qtd_contada: 95, // Maior que 80 -> Divergência Sobressalente (Laranja)
    qtd_disponivel: 80,
    qtd_atual: 80,
    peso_total: 32.0,
    qtd_reservada: 0,
    usuario_id: 'OP-1042',
    data_atualizada: new Date(Date.now() - 3600000 * 4).toISOString(),
    data_contagem: new Date(Date.now() - 3600000 * 4).toISOString(),
    corrigido: false,
    usuario_correcao: null,
    data_correcao: null,
    status: 'contada',
  },
  {
    id: 'inv-103',
    unidade_negocio: 'Goiânia',
    contagem: 'Contagem Geral Outubro',
    produto: 'POLI-9944 - Caixa Papelão Reforçada Padrão G',
    endereco: 'A-01-01',
    qtd_contada: 250, // Igual -> Sem divergência (Verde)
    qtd_disponivel: 250,
    qtd_atual: 250,
    peso_total: 125.0,
    qtd_reservada: 0,
    usuario_id: 'OP-1042',
    data_atualizada: new Date(Date.now() - 3600000 * 3).toISOString(),
    data_contagem: new Date(Date.now() - 3600000 * 3).toISOString(),
    corrigido: false,
    usuario_correcao: null,
    data_correcao: null,
    status: 'contada',
  },
  // Endereço A-01-02
  {
    id: 'inv-104',
    unidade_negocio: 'Goiânia',
    contagem: 'Contagem Geral Outubro',
    produto: 'POLI-4412 - Sabão Líquido Omo Lavagem Perfeita 3L',
    endereco: 'A-01-02',
    qtd_contada: 40, // Menor que 45 -> Solicitada Revisão
    qtd_disponivel: 45,
    qtd_atual: 45,
    peso_total: 135.0,
    qtd_reservada: 5,
    usuario_id: 'OP-1042',
    data_atualizada: new Date(Date.now() - 3600000 * 8).toISOString(),
    data_contagem: new Date(Date.now() - 3600000 * 8).toISOString(),
    corrigido: false,
    usuario_correcao: 'GS-2005',
    data_correcao: null,
    status: 'revisar',
  },
  {
    id: 'inv-105',
    unidade_negocio: 'Goiânia',
    contagem: 'Contagem Geral Outubro',
    produto: 'POLI-3301 - Amaciante Concentrado Comfort 2L',
    endereco: 'A-01-02',
    qtd_contada: 60, // Igual -> Sem divergência
    qtd_disponivel: 60,
    qtd_atual: 60,
    peso_total: 120.0,
    qtd_reservada: 0,
    usuario_id: 'OP-1042',
    data_atualizada: new Date(Date.now() - 3600000 * 7).toISOString(),
    data_contagem: new Date(Date.now() - 3600000 * 7).toISOString(),
    corrigido: false,
    usuario_correcao: null,
    data_correcao: null,
    status: 'contada',
  },
  // Endereço B-01-01
  {
    id: 'inv-106',
    unidade_negocio: 'Goiânia',
    contagem: 'Contagem Geral Outubro',
    produto: 'POLI-1092 - Cerveja Brahma Chopp Lata 350ml (Pack 12)',
    endereco: 'B-01-01',
    qtd_contada: 500, // Igual -> Sem divergência
    qtd_disponivel: 500,
    qtd_atual: 500,
    peso_total: 2100.0,
    qtd_reservada: 50,
    usuario_id: 'OP-1042',
    data_atualizada: new Date(Date.now() - 3600000 * 12).toISOString(),
    data_contagem: new Date(Date.now() - 3600000 * 12).toISOString(),
    corrigido: false,
    usuario_correcao: null,
    data_correcao: null,
    status: 'contada',
  },
  {
    id: 'inv-107',
    unidade_negocio: 'Goiânia',
    contagem: 'Contagem Geral Outubro',
    produto: 'POLI-1093 - Guaraná Antarctica Lata 350ml (Pack 12)',
    endereco: 'B-01-01',
    qtd_contada: 340, // Maior que 320 -> Validada pelo Gestor
    qtd_disponivel: 320,
    qtd_atual: 320,
    peso_total: 1344.0,
    qtd_reservada: 20,
    usuario_id: 'OP-1042',
    data_atualizada: new Date(Date.now() - 3600000 * 10).toISOString(),
    data_contagem: new Date(Date.now() - 3600000 * 10).toISOString(),
    corrigido: true,
    usuario_correcao: 'GS-2005',
    data_correcao: new Date(Date.now() - 3600000 * 1).toISOString(),
    status: 'validada',
  },
  // Endereço B-02-01
  {
    id: 'inv-108',
    unidade_negocio: 'Goiânia',
    contagem: 'Contagem Geral Outubro',
    produto: 'POLI-5520 - Óleo de Soja Soya Pet 900ml',
    endereco: 'B-02-01',
    qtd_contada: 170, // Menor que 180 -> Divergência Falta
    qtd_disponivel: 180,
    qtd_atual: 180,
    peso_total: 162.0,
    qtd_reservada: 0,
    usuario_id: 'OP-1042',
    data_atualizada: new Date(Date.now() - 3600000 * 6).toISOString(),
    data_contagem: new Date(Date.now() - 3600000 * 6).toISOString(),
    corrigido: false,
    usuario_correcao: null,
    data_correcao: null,
    status: 'contada',
  },
  // Endereço C-01-01 (Sem contagem ainda - status pendente)
  {
    id: 'inv-109',
    unidade_negocio: 'Goiânia',
    contagem: 'Contagem Geral Outubro',
    produto: 'POLI-6611 - Arroz Tio João Tipo 1 Fardo 30kg',
    endereco: 'C-01-01',
    qtd_contada: null,
    qtd_disponivel: 95,
    qtd_atual: 95,
    peso_total: 2850.0,
    qtd_reservada: 10,
    usuario_id: null,
    data_atualizada: new Date().toISOString(),
    data_contagem: null,
    corrigido: false,
    usuario_correcao: null,
    data_correcao: null,
    status: 'pendente',
  },
  {
    id: 'inv-110',
    unidade_negocio: 'Goiânia',
    contagem: 'Contagem Geral Outubro',
    produto: 'POLI-6612 - Feijão Carioca Camil Fardo 30kg',
    endereco: 'C-01-01',
    qtd_contada: null,
    qtd_disponivel: 150,
    qtd_atual: 150,
    peso_total: 4500.0,
    qtd_reservada: 0,
    usuario_id: null,
    data_atualizada: new Date().toISOString(),
    data_contagem: null,
    corrigido: false,
    usuario_correcao: null,
    data_correcao: null,
    status: 'pendente',
  },
];

export function getLocalUsuarios(): Usuario[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USUARIOS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.USUARIOS, JSON.stringify(INITIAL_USUARIOS));
      return INITIAL_USUARIOS;
    }
    const parsed: Usuario[] = JSON.parse(raw);
    // Preserva compatibilidade: usuários já existentes sem status são considerados 'aprovado' e unidade padrão 'Goiânia'
    return parsed.map((u) => ({
      ...u,
      email: u.email || null,
      unidade_negocio: u.unidade_negocio || 'Goiânia',
      status: u.status || 'aprovado',
      exigir_troca_senha: Boolean(u.exigir_troca_senha),
    }));
  } catch {
    return INITIAL_USUARIOS;
  }
}

export function saveLocalUsuarios(users: Usuario[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.USUARIOS, JSON.stringify(users));
  } catch (e) {
    console.error('Erro ao salvar usuarios no storage:', e);
  }
}

export function getLocalAgendamentos(): Agendamento[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AGENDAMENTOS);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((a: Agendamento) => ({
      ...a,
      usuario_id: a.usuario_id || 'usr-default-01',
      usuario_insercao: a.usuario_insercao || 'Luiz Fernando',
    }));
  } catch {
    return [];
  }
}

export function saveLocalAgendamentos(agendamentos: Agendamento[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.AGENDAMENTOS, JSON.stringify(agendamentos));
  } catch (e) {
    console.error('Erro ao salvar agendamentos no storage:', e);
  }
}

export function getLocalEnderecos(): EnderecoLogistico[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ENDERECOS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.ENDERECOS, JSON.stringify(INITIAL_ENDERECOS));
      return INITIAL_ENDERECOS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_ENDERECOS;
  }
}

export function saveLocalEnderecos(enderecos: EnderecoLogistico[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.ENDERECOS, JSON.stringify(enderecos));
  } catch (e) {
    console.error('Erro ao salvar enderecos no storage:', e);
  }
}

export function getLocalInventario(): ItemInventario[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.INVENTARIO);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.INVENTARIO, JSON.stringify(INITIAL_INVENTARIO));
      return INITIAL_INVENTARIO;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_INVENTARIO;
  }
}

export function saveLocalInventario(itens: ItemInventario[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.INVENTARIO, JSON.stringify(itens));
  } catch (e) {
    console.error('Erro ao salvar inventario no storage:', e);
  }
}

// -------------------------------------------------------------
// Tabelas estritas do novo Módulo Inventário & Endereços
// -------------------------------------------------------------

export function getLocalTabelaEnderecos(): RegistroEndereco[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TABELA_ENDERECOS);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Purge any legacy fictitious mock addresses (A-01-01, B-01-01, etc.)
    const clean = parsed.filter((item: any) => {
      const end = item?.endereco || '';
      const desc = item?.descricao || '';
      return !(end === 'A-01-01' && desc.includes('Rua A / Módulo 01')) &&
             !(end === 'A-01-02' && desc.includes('Rua A / Módulo 01')) &&
             !(end === 'B-01-01' && desc.includes('Rua B / Módulo 01')) &&
             !(end === 'B-02-01' && desc.includes('Rua B / Módulo 02')) &&
             !(end === 'C-01-01' && desc.includes('Rua C / Módulo 01')) &&
             !(end === 'C-01-02' && desc.includes('Rua C / Módulo 01')) &&
             !(end === 'D-01-01' && desc.includes('Rua D / Módulo 01'));
    });
    if (clean.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEYS.TABELA_ENDERECOS, JSON.stringify(clean));
    }
    return clean;
  } catch {
    return [];
  }
}

export function saveLocalTabelaEnderecos(enderecos: RegistroEndereco[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.TABELA_ENDERECOS, JSON.stringify(enderecos));
  } catch (e) {
    console.error('Erro ao salvar tabela enderecos no storage:', e);
  }
}

export function getLocalTabelaInventario(): RegistroInventario[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TABELA_INVENTARIO);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.TABELA_INVENTARIO, JSON.stringify(INITIAL_TABELA_INVENTARIO));
      return INITIAL_TABELA_INVENTARIO;
    }
    const parsed: RegistroInventario[] = JSON.parse(raw);
    return parsed.map((item) => {
      let status = item.status;
      if (!status) {
        if (item.qtd_contada === null || item.qtd_contada === undefined) {
          status = 'pendente';
        } else if (item.corrigido) {
          status = 'validada';
        } else {
          status = 'contada';
        }
      }
      return {
        ...item,
        status,
        contagem: item.contagem || 'Contagem Geral Outubro',
        unidade_negocio: item.unidade_negocio || 'Goiânia',
      };
    });
  } catch {
    return INITIAL_TABELA_INVENTARIO;
  }
}

export function saveLocalTabelaInventario(registros: RegistroInventario[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.TABELA_INVENTARIO, JSON.stringify(registros));
  } catch (e) {
    console.error('Erro ao salvar tabela inventario no storage:', e);
  }
}

// -------------------------------------------------------------
// Módulo Alocação: public.recebimentos_produtos & public.alteracoes_endereco
// -------------------------------------------------------------

export const INITIAL_RECEBIMENTOS_PRODUTOS: RecebimentoProduto[] = [
  {
    id: 'rec-p1',
    agendamento_id: 'ag-1004',
    data_recebimento: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10),
    nota_fiscal: '001.993.520',
    produto: 'POLI-4001 - Farinha Especial Finíssima 1kg - Fardo c/ 10',
    endereco: 'A-01-01',
    quantidade: 120,
    saldo_final: 0,
    qtd_conferida: 120,
    conferente_id: 'usr-default-01',
    conferente_nome: 'Luiz Fernando',
    status: 'Alocado',
    data_conferencia: new Date(Date.now() - 86400000 * 2).toISOString(),
    repositor_id: 'usr-default-02',
    repositor_nome: 'Mariana Silva (Gestora)',
    data_alocacao: new Date(Date.now() - 86400000 * 2 + 7200000).toISOString(),
    importado_excel: true,
    origem: 'excel',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'rec-p2',
    agendamento_id: 'ag-1004',
    data_recebimento: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10),
    nota_fiscal: '001.993.520',
    produto: 'POLI-4002 - Biscoito Cream Cracker Tradicional 400g - Cx 24',
    endereco: 'A-02-01',
    quantidade: 80,
    saldo_final: 20,
    qtd_conferida: 80,
    conferente_id: 'usr-default-01',
    conferente_nome: 'Luiz Fernando',
    status: 'Conferido',
    data_conferencia: new Date(Date.now() - 86400000 * 2 + 3600000).toISOString(),
    repositor_id: null,
    repositor_nome: null,
    data_alocacao: null,
    importado_excel: true,
    origem: 'excel',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'rec-p3',
    agendamento_id: 'ag-1005',
    data_recebimento: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10),
    nota_fiscal: '007.412.301',
    produto: 'POLI-5001 - Caixas Papelão Ondulado Kraft 40x30x25 - Palete',
    endereco: null,
    quantidade: 15,
    saldo_final: 15,
    qtd_conferida: 15,
    conferente_id: 'usr-default-01',
    status: 'Conferido',
    data_conferencia: new Date(Date.now() - 86400000 * 3).toISOString(),
    importado_excel: false,
    origem: 'manual',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'rec-p4',
    agendamento_id: 'ag-1005',
    data_recebimento: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10),
    nota_fiscal: '007.412.301',
    produto: 'POLI-5002 - Filme Stretch Manual 500mm x 0,025mm Bobina',
    endereco: 'B-01-01',
    quantidade: 30,
    saldo_final: 0,
    qtd_conferida: 30,
    conferente_id: 'usr-default-02',
    status: 'Alocado',
    repositor_id: 'usr-default-01',
    data_alocacao: new Date(Date.now() - 86400000 * 3).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'rec-p5',
    agendamento_id: 'ag-1001',
    data_recebimento: new Date().toISOString().slice(0, 10),
    nota_fiscal: '000.854.120',
    produto: 'Filtro de Ar Primário Donaldson P181054',
    endereco: 'C-01-02',
    quantidade: 50,
    saldo_final: 50,
    qtd_conferida: 50,
    conferente_id: 'usr-default-01',
    status: 'Conferido',
    data_conferencia: new Date().toISOString(),
    importado_excel: false,
    origem: 'manual',
    fabricante: 'Donaldson do Brasil',
    created_at: new Date().toISOString(),
  },
  {
    id: 'rec-p6',
    agendamento_id: 'ag-1002',
    data_recebimento: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    nota_fiscal: '003.220.910',
    produto: 'Nescafé Tradicional Vidro 200g',
    endereco: 'R01-C01-P01-N1',
    quantidade: 100,
    saldo_final: 100,
    qtd_conferida: 100,
    conferente_id: 'usr-default-01',
    status: 'Conferido',
    data_conferencia: new Date(Date.now() - 86400000).toISOString(),
    importado_excel: false,
    origem: 'manual',
    fabricante: 'Nestlé Brasil',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'rec-p7',
    agendamento_id: 'ag-1003',
    data_recebimento: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    nota_fiscal: '003.220.910',
    produto: 'Sabão Líquido Omo Lavagem Perfeita 3L',
    endereco: 'R01-C02-P01-N1',
    quantidade: 45,
    saldo_final: 45,
    qtd_conferida: 45,
    conferente_id: 'usr-default-02',
    status: 'Conferido',
    data_conferencia: new Date(Date.now() - 86400000).toISOString(),
    importado_excel: false,
    origem: 'manual',
    fabricante: 'Unilever',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

export const INITIAL_ALTERACOES_ENDERECO: AlteracaoEndereco[] = [
  {
    id: 'alt-101',
    unidade_negocio: 'Goiânia',
    data: new Date(Date.now() - 3600000 * 5).toISOString(),
    produto: 'POLI-4001 - Farinha Especial Finíssima 1kg - Fardo c/ 10',
    endereco_antigo: 'A-01-01',
    endereco_novo: 'B-02-01',
    tipo_alteracao: 'Via nota de entrada',
    usuario_alteracao: 'usr-default-01',
    usuario_nome: 'Luiz Fernando',
    usuario_codigo: 'OP-1042',
    alterado_sistema: false,
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'alt-102',
    unidade_negocio: 'Goiânia',
    data: new Date(Date.now() - 86400000).toISOString(),
    produto: 'POLI-5002 - Filme Stretch Manual 500mm x 0,025mm Bobina',
    endereco_antigo: 'C-01-01',
    endereco_novo: 'B-01-01',
    tipo_alteracao: 'Via nota de entrada',
    usuario_alteracao: 'usr-default-02',
    usuario_nome: 'Mariana Silva (Gestora)',
    usuario_codigo: 'GS-2005',
    alterado_sistema: true,
    data_confirmacao: new Date(Date.now() - 43200000).toISOString(),
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'alt-103',
    unidade_negocio: 'Goiânia',
    data: new Date(Date.now() - 3600000 * 2).toISOString(),
    produto: 'Farinha Especial Finíssima 1kg - Fardo c/ 10',
    endereco_antigo: 'A-01-01',
    endereco_novo: 'B-02-01',
    tipo_alteracao: 'Avulsa',
    usuario_alteracao: 'usr-default-01',
    usuario_nome: 'Luiz Fernando',
    usuario_codigo: 'OP-1042',
    alterado_sistema: false,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
];

export function getLocalRecebimentosProdutos(): RecebimentoProduto[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECEBIMENTOS_PRODUTOS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.RECEBIMENTOS_PRODUTOS, JSON.stringify(INITIAL_RECEBIMENTOS_PRODUTOS));
      return INITIAL_RECEBIMENTOS_PRODUTOS;
    }
    const parsed: RecebimentoProduto[] = JSON.parse(raw);
    return parsed.map((item) => ({
      ...item,
      status: item.status || (item.saldo_final === 0 ? 'Alocado' : 'Conferido'),
    }));
  } catch {
    return INITIAL_RECEBIMENTOS_PRODUTOS;
  }
}

export function saveLocalRecebimentosProdutos(produtos: RecebimentoProduto[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.RECEBIMENTOS_PRODUTOS, JSON.stringify(produtos));
  } catch (e) {
    console.error('Erro ao salvar recebimentos_produtos no storage:', e);
  }
}

export function getLocalAlteracoesEndereco(): AlteracaoEndereco[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ALTERACOES_ENDERECO);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.ALTERACOES_ENDERECO, JSON.stringify(INITIAL_ALTERACOES_ENDERECO));
      return INITIAL_ALTERACOES_ENDERECO;
    }
    const parsed: AlteracaoEndereco[] = JSON.parse(raw);
    return parsed.map((item) => ({
      ...item,
      unidade_negocio: item.unidade_negocio && item.unidade_negocio.trim() ? item.unidade_negocio.trim() : 'Goiânia',
      data: item.data || item.created_at || new Date().toISOString(),
    }));
  } catch {
    return INITIAL_ALTERACOES_ENDERECO;
  }
}

export function saveLocalAlteracoesEndereco(alteracoes: AlteracaoEndereco[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.ALTERACOES_ENDERECO, JSON.stringify(alteracoes));
  } catch (e) {
    console.error('Erro ao salvar alteracoes_endereco no storage:', e);
  }
}

export function getLocalTransportadoras(): Transportadora[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSPORTADORAS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.TRANSPORTADORAS, JSON.stringify(INITIAL_TRANSPORTADORAS));
      return INITIAL_TRANSPORTADORAS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_TRANSPORTADORAS;
  }
}

export function saveLocalTransportadoras(transportadoras: Transportadora[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.TRANSPORTADORAS, JSON.stringify(transportadoras));
  } catch (e) {
    console.error('Erro ao salvar transportadoras no storage:', e);
  }
}

export function getLocalFornecedores(): Fornecedor[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FORNECEDORES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.FORNECEDORES, JSON.stringify(INITIAL_FORNECEDORES));
      return INITIAL_FORNECEDORES;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_FORNECEDORES;
  }
}

export function saveLocalFornecedores(fornecedores: Fornecedor[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.FORNECEDORES, JSON.stringify(fornecedores));
  } catch (e) {
    console.error('Erro ao salvar fornecedores no storage:', e);
  }
}

// -------------------------------------------------------------
// POLIHUB — MÓDULO CADASTROS: PRODUTOS
// Tabela Supabase: public.produtos
// -------------------------------------------------------------

export const INITIAL_PRODUTOS: Produto[] = [
  {
    id: 'f101-prod-8821',
    produto: 'Nescafé Tradicional Vidro 200g',
    fabricante: 'Nestlé Brasil',
    endereco: 'R01-C01-P01-N1',
    codigo_barras: '7891000100103',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'f102-prod-4412',
    produto: 'Sabão Líquido Omo Lavagem Perfeita 3L',
    fabricante: 'Unilever',
    endereco: 'R01-C02-P01-N1',
    codigo_barras: '7891038012345',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'f103-prod-4001',
    produto: 'Farinha Especial Finíssima 1kg - Fardo c/ 10',
    fabricante: 'M. Dias Branco',
    endereco: 'A-01-01',
    codigo_barras: '7896001234567',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'f104-prod-5002',
    produto: 'Filme Stretch Manual 500mm x 0,025mm Bobina',
    fabricante: 'Klabin Embalagens',
    endereco: 'B-01-01',
    codigo_barras: '7898009876543',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'f105-prod-1092',
    produto: 'Cerveja Brahma Chopp Lata 350ml (Pack 12)',
    fabricante: 'Ambev S.A.',
    endereco: 'R02-C02-P01-N1',
    codigo_barras: '7891991000824',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export function getLocalProdutos(): Produto[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUTOS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PRODUTOS, JSON.stringify(INITIAL_PRODUTOS));
      return INITIAL_PRODUTOS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_PRODUTOS;
  }
}

export function saveLocalProdutos(produtos: Produto[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.PRODUTOS, JSON.stringify(produtos));
  } catch (e) {
    console.error('Erro ao salvar produtos no storage:', e);
  }
}

// -------------------------------------------------------------
// POLIHUB — MÓDULO TAREFAS
// Tabela Supabase: public.tarefas
// -------------------------------------------------------------

const getIsoOffsetDays = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const INITIAL_TAREFAS: Tarefa[] = [
  {
    id: 'tar-001',
    nome: 'Conferência física de avarias no lote de Filtros Automotivos (NF 1042)',
    responsavel_id: 'usr-default-01', // Luiz Fernando (Operador)
    data_limite: getIsoOffsetDays(-1), // Ontem -> Prazo estourado
    data_conclusao: null,
    status: 'Pendente',
    ativo: true,
    usuario_insercao: 'Mariana Silva',
    data_insercao: new Date(Date.now() - 86400000 * 3).toISOString(),
    usuario_atualizacao: null,
    data_atualizacao: null,
  },
  {
    id: 'tar-002',
    nome: 'Auditoria de picking nas posições do Corredor 01 (R01-C01 a R01-C04)',
    responsavel_id: 'usr-default-01', // Luiz Fernando (Operador)
    data_limite: getIsoOffsetDays(0), // Hoje -> Finalizar hoje
    data_conclusao: null,
    status: 'Pendente',
    ativo: true,
    usuario_insercao: 'Mariana Silva',
    data_insercao: new Date(Date.now() - 86400000).toISOString(),
    usuario_atualizacao: null,
    data_atualizacao: null,
  },
  {
    id: 'tar-003',
    nome: 'Reorganização e etiquetagem dos paletes da Doca 02 para recebimento agendado',
    responsavel_id: 'usr-default-01', // Luiz Fernando (Operador)
    data_limite: getIsoOffsetDays(2), // Daqui a 2 dias -> Dentro do prazo
    data_conclusao: null,
    status: 'Pendente',
    ativo: true,
    usuario_insercao: 'Mariana Silva',
    data_insercao: new Date().toISOString(),
    usuario_atualizacao: null,
    data_atualizacao: null,
  },
  {
    id: 'tar-004',
    nome: 'Fechamento de inventário rotativo mensal do setor de embalagens',
    responsavel_id: 'usr-default-02', // Mariana Silva (Gestora)
    data_limite: getIsoOffsetDays(-2),
    data_conclusao: new Date(Date.now() - 86400000).toISOString(),
    status: 'Concluído',
    ativo: true,
    usuario_insercao: 'Mariana Silva',
    data_insercao: new Date(Date.now() - 86400000 * 4).toISOString(),
    usuario_atualizacao: 'Mariana Silva',
    data_atualizacao: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'tar-005',
    nome: 'Validação de relatório de divergências com o setor fiscal',
    responsavel_id: 'usr-default-02', // Mariana Silva (Gestora)
    data_limite: getIsoOffsetDays(3),
    data_conclusao: null,
    status: 'Pendente',
    ativo: true,
    usuario_insercao: 'Mariana Silva',
    data_insercao: new Date().toISOString(),
    usuario_atualizacao: null,
    data_atualizacao: null,
  },
];

export function getLocalTarefas(): Tarefa[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TAREFAS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.TAREFAS, JSON.stringify(INITIAL_TAREFAS));
      return INITIAL_TAREFAS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_TAREFAS;
  }
}

export function saveLocalTarefas(tarefas: Tarefa[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.TAREFAS, JSON.stringify(tarefas));
  } catch (e) {
    console.error('Erro ao salvar tarefas no storage:', e);
  }
}

let inMemoryChamados: ChamadoLogistico[] = [];

export function getLocalChamados(): ChamadoLogistico[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEYS.CHAMADOS);
      if (raw) {
        inMemoryChamados = JSON.parse(raw);
        return inMemoryChamados;
      }
    }
    return inMemoryChamados;
  } catch {
    return inMemoryChamados;
  }
}

export function saveLocalChamados(chamados: ChamadoLogistico[]) {
  inMemoryChamados = [...chamados];
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.CHAMADOS, JSON.stringify(chamados));
    }
  } catch (e) {
    console.error('Erro ao salvar chamados no storage:', e);
  }
}

export function getLocalVeiculos(): Veiculo[] {
  try {
    if (typeof localStorage === 'undefined') return INITIAL_VEICULOS;
    const raw = localStorage.getItem(STORAGE_KEYS.VEICULOS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.VEICULOS, JSON.stringify(INITIAL_VEICULOS));
      return INITIAL_VEICULOS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_VEICULOS;
  }
}

export function saveLocalVeiculos(veiculos: Veiculo[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.VEICULOS, JSON.stringify(veiculos));
    }
  } catch (e) {
    console.error('Erro ao salvar veículos no storage:', e);
  }
}

export function getLocalSaidasVeiculos(): SaidaVeiculo[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEYS.SAIDAS_VEICULOS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLocalSaidasVeiculos(saidas: SaidaVeiculo[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.SAIDAS_VEICULOS, JSON.stringify(saidas));
    }
  } catch (e) {
    console.error('Erro ao salvar saídas no storage:', e);
  }
}

export function getLocalAbastecimentos(): AbastecimentoVeiculo[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEYS.ABASTECIMENTOS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLocalAbastecimentos(abastecimentos: AbastecimentoVeiculo[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ABASTECIMENTOS, JSON.stringify(abastecimentos));
    }
  } catch (e) {
    console.error('Erro ao salvar abastecimentos no storage:', e);
  }
}

export function getLocalSaidasColetas(): SaidaColeta[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEYS.SAIDAS_COLETAS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLocalSaidasColetas(links: SaidaColeta[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.SAIDAS_COLETAS, JSON.stringify(links));
    }
  } catch (e) {
    console.error('Erro ao salvar vínculos de saídas e coletas:', e);
  }
}

// -------------------------------------------------------------
// POLIHUB — MÓDULO DE COMPRAS: public.compras
// -------------------------------------------------------------
export const INITIAL_COMPRAS: SolicitacaoCompra[] = [
  {
    id: 'comp-001',
    data_insercao: new Date(Date.now() - 3600000 * 5).toISOString(),
    id_produto: 'f101-prod-8821', // Nescafé Tradicional
    quantidade: 120,
    demanda: 'Estoque',
    urgencia: 'Urgente',
    id_solicitante: 'usr-default-01',
    status: 'Solicitado',
    observacao: 'Estoque de café no centro de distribuição zerando rápido esta semana.',
    unidade_negocio: 'Goiânia',
  },
  {
    id: 'comp-002',
    data_insercao: new Date(Date.now() - 3600000 * 24).toISOString(),
    id_produto: 'f102-prod-4412', // Sabão Líquido Omo 3L
    quantidade: 50,
    quantidade_aprovada: 50,
    demanda: 'Sob Encomenda',
    urgencia: 'Rápida',
    id_solicitante: 'usr-default-01',
    status: 'Aprovado',
    id_usuario_aprovacao: 'usr-default-02',
    data_aprovacao: new Date(Date.now() - 3600000 * 18).toISOString(),
    observacao: 'Pedido comercial de cliente aguardando faturamento.',
    unidade_negocio: 'Goiânia',
  },
  {
    id: 'comp-003',
    data_insercao: new Date(Date.now() - 3600000 * 48).toISOString(),
    id_produto: 'f104-prod-5002', // Filme Stretch Manual
    quantidade: 30,
    quantidade_aprovada: 30,
    demanda: 'Consumos',
    urgencia: 'Média',
    id_solicitante: 'usr-default-01',
    status: 'Comprado',
    id_usuario_aprovacao: 'usr-default-02',
    data_aprovacao: new Date(Date.now() - 3600000 * 40).toISOString(),
    id_usuario_compra: 'usr-default-02',
    data_compra: new Date(Date.now() - 3600000 * 12).toISOString(),
    observacao: 'Insumo de paletização para expedição regular.',
    unidade_negocio: 'Goiânia',
  },
  {
    id: 'comp-004',
    data_insercao: new Date(Date.now() - 3600000 * 72).toISOString(),
    id_produto: 'f103-prod-4001', // Farinha Especial Finíssima
    quantidade: 200,
    demanda: 'Estoque',
    urgencia: 'Rápida',
    id_solicitante: 'usr-default-01',
    status: 'Solicitado',
    observacao: 'Reposição preventiva de estoque sazonal.',
    unidade_negocio: 'Goiânia',
  },
];

export function getLocalCompras(): SolicitacaoCompra[] {
  try {
    if (typeof localStorage === 'undefined') return INITIAL_COMPRAS;
    const raw = localStorage.getItem(STORAGE_KEYS.COMPRAS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.COMPRAS, JSON.stringify(INITIAL_COMPRAS));
      return INITIAL_COMPRAS;
    }
    const parsed: SolicitacaoCompra[] = JSON.parse(raw);
    let alterou = false;
    const migrados = parsed.map((item) => {
      // Migração inequívoca de categorias legadas para os novos padrões
      if ((item.demanda as string) === 'Necessidade') {
        alterou = true;
        return { ...item, demanda: 'Sob Encomenda' as DemandaCompra };
      }
      if ((item.demanda as string) === 'Compras') {
        alterou = true;
        return { ...item, demanda: 'Consumos' as DemandaCompra };
      }
      return item;
    });
    if (alterou) {
      localStorage.setItem(STORAGE_KEYS.COMPRAS, JSON.stringify(migrados));
    }
    return migrados;
  } catch {
    return INITIAL_COMPRAS;
  }
}

export function saveLocalCompras(compras: SolicitacaoCompra[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.COMPRAS, JSON.stringify(compras));
    }
  } catch (e) {
    console.error('Erro ao salvar compras no storage:', e);
  }
}

// -------------------------------------------------------------
// POLIHUB — MÓDULO WHATSAPP BUSINESS INTELIGENTE
// -------------------------------------------------------------

export const INITIAL_WHATSAPP_FILAS: WhatsAppFila[] = [
  { id: 'fila-01', nome: 'Recebimento', descricao: 'Descarga, conferência de NFs e recebimento físico', departamento: 'Logística', ordem: 1, ativo: true },
  { id: 'fila-02', nome: 'Expedição', descricao: 'Separação, embalagem e expedição de pedidos', departamento: 'Logística', ordem: 2, ativo: true },
  { id: 'fila-03', nome: 'Agendamentos', descricao: 'Agendamento de entregas de fornecedores e transportadoras', departamento: 'Logística', ordem: 3, ativo: true },
  { id: 'fila-04', nome: 'Retira', descricao: 'Balcão de retirada de mercadorias no CD', departamento: 'Logística', ordem: 4, ativo: true },
  { id: 'fila-05', nome: 'Entregas Nosso Carro', descricao: 'Rastreamento e coordenação de frotas e motoristas próprios', departamento: 'Logística', ordem: 5, ativo: true },
  { id: 'fila-06', nome: 'Comercial', descricao: 'Suporte a pedidos, vendas e cotações', departamento: 'Comercial', ordem: 6, ativo: true },
  { id: 'fila-07', nome: 'Geral', descricao: 'Fila padrão para triagem de novos atendimentos', departamento: 'Logística', ordem: 7, ativo: true },
];

export const INITIAL_WHATSAPP_CANAIS: WhatsAppCanal[] = [
  {
    id: 'canal-gyn-01',
    nome: 'WhatsApp Logística Goiânia',
    numero_telefone: '+5562991234567',
    unidade_negocio: 'Goiânia',
    meta_phone_number_id: '109876543210987',
    meta_waba_id: '987654321098765',
    status_conexao: 'conectado',
    horario_inicio: '08:00',
    horario_fim: '18:00',
    dias_funcionamento: ['seg', 'ter', 'qua', 'qui', 'sex'],
    mensagem_fora_horario: 'Olá! No momento nossa equipe da unidade Goiânia está fora do horário de expediente (08h às 18h). Sua solicitação foi registrada e responderemos no início do próximo turno.',
    ativo: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'canal-mt-01',
    nome: 'WhatsApp Operação Mato Grosso',
    numero_telefone: '+5565998765432',
    unidade_negocio: 'Mato Grosso',
    meta_phone_number_id: '109876543210988',
    meta_waba_id: '987654321098766',
    status_conexao: 'conectado',
    horario_inicio: '08:00',
    horario_fim: '18:00',
    dias_funcionamento: ['seg', 'ter', 'qua', 'qui', 'sex'],
    mensagem_fora_horario: 'Olá! A equipe de Mato Grosso está fora do horário de atendimento. Deixe sua mensagem que retornaremos assim que possível.',
    ativo: true,
    created_at: new Date().toISOString(),
  },
];

export const INITIAL_WHATSAPP_CONTATOS: WhatsAppContato[] = [
  {
    id: 'ctt-01',
    telefone: '+5562988112233',
    nome: 'Carlos Transportes (Jadlog)',
    tipo_contato: 'cliente',
    departamento_relacionado: 'Logística',
    unidade_negocio: 'Goiânia',
    regra_atendimento: 'fila_especifica',
    ativo: true,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'ctt-02',
    telefone: '+5562999445566',
    nome: 'Mariana Silva (Gestora)',
    tipo_contato: 'gestor',
    departamento_relacionado: 'Logística',
    unidade_negocio: 'Goiânia',
    regra_atendimento: 'prioritario',
    mensagem_personalizada: 'Olá, Mariana! Reconhecemos seu acesso de Gestão Logística. Com qual colaborador ou fila você deseja falar?',
    ativo: true,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'ctt-03',
    telefone: '+5562981223344',
    nome: 'Marcos Fornecedor (Donaldson)',
    tipo_contato: 'fornecedor',
    departamento_relacionado: 'Logística',
    unidade_negocio: 'Goiânia',
    regra_atendimento: 'fila_especifica',
    ativo: true,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
];

export const INITIAL_WHATSAPP_MENSAGENS_AUTO: WhatsAppMensagemAutomatica[] = [
  {
    id: 'msg-auto-01',
    nome: 'Boas-vindas para Número Desconhecido',
    tipo_evento: 'boas_vindas',
    perfil_contato: 'desconhecido',
    texto: 'Olá! Seja bem-vindo à Polifiltro WMS / Dental Globo. Para direcionar seu atendimento com rapidez, escolha uma das opções abaixo digitando o número correspondente:',
    opcoes: [
      { id: 'op-1', label: 'Recebimento de Cargas', valor: '1', destino_fila: 'Recebimento' },
      { id: 'op-2', label: 'Expedição e Pedidos', valor: '2', destino_fila: 'Expedição' },
      { id: 'op-3', label: 'Agendamentos de NFs', valor: '3', destino_fila: 'Agendamentos' },
      { id: 'op-4', label: 'Balcão de Retirada', valor: '4', destino_fila: 'Retira' },
      { id: 'op-5', label: 'Entregas Nosso Carro (Frota)', valor: '5', destino_fila: 'Entregas Nosso Carro' },
      { id: 'op-6', label: 'Atendimento Comercial', valor: '6', destino_fila: 'Comercial' },
    ],
    mensagem_invalida: 'Opção inválida. Por favor, envie apenas o número de 1 a 6 de acordo com a opção desejada.',
    ordem: 1,
    ativo: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'msg-auto-02',
    nome: 'Boas-vindas para Gestor Identificado',
    tipo_evento: 'gestor_identificado',
    perfil_contato: 'gestor',
    texto: 'Olá, gestor(a)! Reconhecemos seu contato corporativo no PoliHub. Com quem você deseja falar no momento? Escolha uma fila ou colaborador autorizado:',
    opcoes: [
      { id: 'op-g1', label: 'Fila Recebimento', valor: '1', destino_fila: 'Recebimento' },
      { id: 'op-g2', label: 'Fila Expedição', valor: '2', destino_fila: 'Expedição' },
      { id: 'op-g3', label: 'Fila Agendamentos', valor: '3', destino_fila: 'Agendamentos' },
      { id: 'op-g4', label: 'Atendente Geral', valor: '4', destino_fila: 'Geral' },
    ],
    ordem: 2,
    ativo: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'msg-auto-03',
    nome: 'Mensagem Fora do Horário Comercial',
    tipo_evento: 'fora_horario',
    perfil_contato: 'todos',
    texto: 'Olá! No momento nossa equipe está fora do horário de atendimento operacional. Sua mensagem foi registrada com segurança e será respondida no próximo expediente.',
    ordem: 3,
    ativo: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'msg-auto-04',
    nome: 'Nenhum Colaborador Disponível',
    tipo_evento: 'sem_atendentes',
    perfil_contato: 'todos',
    texto: 'Recebemos sua mensagem. No momento, todos os nossos atendentes da fila estão ocupados. Sua conversa permanecerá prioritária na fila para atendimento.',
    ordem: 4,
    ativo: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'msg-auto-05',
    nome: 'Resposta Inválida Padrão',
    tipo_evento: 'resposta_invalida',
    perfil_contato: 'todos',
    texto: 'Desculpe, não compreendemos a sua resposta. Por favor, digite o número da opção desejada no menu.',
    ordem: 5,
    ativo: true,
    created_at: new Date().toISOString(),
  },
];

export const INITIAL_WHATSAPP_USUARIOS_HABILITADOS: WhatsAppUsuarioHabilitado[] = [
  {
    id: 'hab-01',
    usuario_id: 'usr-default-01', // Luiz Fernando
    usuario_nome: 'Luiz Fernando',
    usuario_codigo: 'OP-1042',
    usuario_departamento: 'Logística',
    usuario_nivel: 'Operador',
    habilitado: true,
    disponivel: true,
    filas_permitidas: ['Recebimento', 'Expedição', 'Retira', 'Geral'],
    pode_visualizar_grupos: true,
    pode_responder_grupos: false,
    is_gestor_whatsapp: false,
    unidade_negocio: 'Goiânia',
    created_at: new Date().toISOString(),
  },
  {
    id: 'hab-02',
    usuario_id: 'usr-default-02', // Mariana Silva (Gestora)
    usuario_nome: 'Mariana Silva (Gestora)',
    usuario_codigo: 'GS-2005',
    usuario_departamento: 'Logística',
    usuario_nivel: 'Gestor',
    habilitado: true,
    disponivel: true,
    filas_permitidas: ['Recebimento', 'Expedição', 'Agendamentos', 'Retira', 'Entregas Nosso Carro', 'Comercial', 'Geral'],
    pode_visualizar_grupos: true,
    pode_responder_grupos: true,
    is_gestor_whatsapp: true,
    unidade_negocio: 'Goiânia',
    created_at: new Date().toISOString(),
  },
];

export const INITIAL_WHATSAPP_CONVERSAS: WhatsAppConversa[] = [
  {
    id: 'conv-01',
    canal_id: 'canal-gyn-01',
    canal_nome: 'WhatsApp Logística Goiânia',
    contato_id: 'ctt-01',
    numero_remetente: '+5562988112233',
    nome_remetente: 'Carlos Transportes (Jadlog)',
    unidade_negocio: 'Goiânia',
    fila_nome: 'Recebimento',
    usuario_atribuido_id: 'usr-default-01',
    usuario_atribuido_nome: 'Luiz Fernando',
    status: 'aguardando', // Para acionar a badge VERMELHA de pendente
    tipo_conversa: 'individual',
    ultima_mensagem_texto: 'Boa tarde! O caminhão da carga de filtros chegou para a descarga. Vocês já liberam a doca?',
    ultima_mensagem_data: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    contato_tipo: 'cliente',
    nao_lidas: 1,
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'conv-02',
    canal_id: 'canal-gyn-01',
    canal_nome: 'WhatsApp Logística Goiânia',
    contato_id: 'ctt-03',
    numero_remetente: '+5562981223344',
    nome_remetente: 'Marcos Fornecedor (Donaldson)',
    unidade_negocio: 'Goiânia',
    fila_nome: 'Expedição',
    usuario_atribuido_id: 'usr-default-01',
    usuario_atribuido_nome: 'Luiz Fernando',
    status: 'em_andamento', // Atendimento em andamento
    tipo_conversa: 'individual',
    ultima_mensagem_texto: 'Perfeito, vou conferir o XML no sistema agora mesmo.',
    ultima_mensagem_data: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    data_inicio_atendimento: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
    contato_tipo: 'fornecedor',
    nao_lidas: 0,
    created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: 'conv-03',
    canal_id: 'canal-gyn-01',
    canal_nome: 'WhatsApp Logística Goiânia',
    numero_remetente: '+5562991114455',
    nome_remetente: 'Farmácia Santa Marta',
    unidade_negocio: 'Goiânia',
    fila_nome: 'Retira',
    usuario_atribuido_id: 'usr-default-01',
    usuario_atribuido_nome: 'Luiz Fernando',
    status: 'encerrado',
    tipo_conversa: 'individual',
    ultima_mensagem_texto: 'Pedido retirado no balcão com sucesso. Muito obrigado!',
    ultima_mensagem_data: new Date(Date.now() - 86400000).toISOString(),
    data_inicio_atendimento: new Date(Date.now() - 86400000 - 3600000).toISOString(),
    data_encerramento: new Date(Date.now() - 86400000).toISOString(),
    encerrado_por_usuario_id: 'usr-default-01',
    encerrado_por_nome: 'Luiz Fernando',
    contato_tipo: 'cliente',
    nao_lidas: 0,
    created_at: new Date(Date.now() - 86400000 - 7200000).toISOString(),
  },
];

export const INITIAL_WHATSAPP_MENSAGENS: WhatsAppMensagem[] = [
  // Mensagens da conversa 1 (Aguardando)
  {
    id: 'msg-101',
    conversa_id: 'conv-01',
    tipo_remetente: 'sistema',
    autor_nome: 'Atendimento automático',
    conteudo: 'Olá! Seja bem-vindo à Polifiltro WMS / Dental Globo. Seu atendimento foi direcionado para a fila de Recebimento.',
    status_envio: 'entregue',
    created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
  },
  {
    id: 'msg-102',
    conversa_id: 'conv-01',
    tipo_remetente: 'contato',
    autor_nome: 'Carlos Transportes (Jadlog)',
    conteudo: 'Boa tarde! O caminhão da carga de filtros chegou para a descarga. Vocês já liberam a doca?',
    status_envio: 'lido',
    created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },

  // Mensagens da conversa 2 (Em andamento)
  {
    id: 'msg-201',
    conversa_id: 'conv-02',
    tipo_remetente: 'contato',
    autor_nome: 'Marcos Fornecedor (Donaldson)',
    conteudo: 'Olá! Enviamos o lote de filtros automotivos NF 000.854.120 com 120 unidades. Poderiam confirmar a recepção?',
    status_envio: 'lido',
    created_at: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
  },
  {
    id: 'msg-202',
    conversa_id: 'conv-02',
    tipo_remetente: 'colaborador',
    usuario_id: 'usr-default-01',
    autor_nome: 'Luiz Fernando',
    conteudo: 'Boa tarde, Marcos! Aqui é o Luiz Fernando da Logística. Vou verificar essa informação para você.',
    status_envio: 'entregue',
    created_at: new Date(Date.now() - 1000 * 60 * 48).toISOString(),
  },
  {
    id: 'msg-203',
    conversa_id: 'conv-02',
    tipo_remetente: 'colaborador',
    usuario_id: 'usr-default-01',
    autor_nome: 'Luiz Fernando',
    conteudo: 'Perfeito, vou conferir o XML no sistema agora mesmo.',
    status_envio: 'entregue',
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
];

export const INITIAL_WHATSAPP_HISTORICO: WhatsAppHistoricoAcao[] = [
  {
    id: 'hist-01',
    conversa_id: 'conv-02',
    usuario_id: 'usr-default-01',
    usuario_nome: 'Luiz Fernando',
    tipo_acao: 'inicio_atendimento',
    detalhes: { fila: 'Expedição', status_anterior: 'aguardando' },
    created_at: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
  },
];

// Getters e Setters com persistência LocalStorage
export function getLocalWhatsAppCanais(): WhatsAppCanal[] {
  try {
    if (typeof localStorage === 'undefined') return INITIAL_WHATSAPP_CANAIS;
    const raw = localStorage.getItem(STORAGE_KEYS.WHATSAPP_CANAIS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.WHATSAPP_CANAIS, JSON.stringify(INITIAL_WHATSAPP_CANAIS));
      return INITIAL_WHATSAPP_CANAIS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_WHATSAPP_CANAIS;
  }
}

export function saveLocalWhatsAppCanais(canais: WhatsAppCanal[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.WHATSAPP_CANAIS, JSON.stringify(canais));
    }
  } catch (e) {
    console.error('Erro ao salvar canais de WhatsApp:', e);
  }
}

export function getLocalWhatsAppContatos(): WhatsAppContato[] {
  try {
    if (typeof localStorage === 'undefined') return INITIAL_WHATSAPP_CONTATOS;
    const raw = localStorage.getItem(STORAGE_KEYS.WHATSAPP_CONTATOS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.WHATSAPP_CONTATOS, JSON.stringify(INITIAL_WHATSAPP_CONTATOS));
      return INITIAL_WHATSAPP_CONTATOS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_WHATSAPP_CONTATOS;
  }
}

export function saveLocalWhatsAppContatos(contatos: WhatsAppContato[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.WHATSAPP_CONTATOS, JSON.stringify(contatos));
    }
  } catch (e) {
    console.error('Erro ao salvar contatos de WhatsApp:', e);
  }
}

export function getLocalWhatsAppFilas(): WhatsAppFila[] {
  try {
    if (typeof localStorage === 'undefined') return INITIAL_WHATSAPP_FILAS;
    const raw = localStorage.getItem(STORAGE_KEYS.WHATSAPP_FILAS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.WHATSAPP_FILAS, JSON.stringify(INITIAL_WHATSAPP_FILAS));
      return INITIAL_WHATSAPP_FILAS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_WHATSAPP_FILAS;
  }
}

export function saveLocalWhatsAppFilas(filas: WhatsAppFila[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.WHATSAPP_FILAS, JSON.stringify(filas));
    }
  } catch (e) {
    console.error('Erro ao salvar filas de WhatsApp:', e);
  }
}

export function getLocalWhatsAppMensagensAuto(): WhatsAppMensagemAutomatica[] {
  try {
    if (typeof localStorage === 'undefined') return INITIAL_WHATSAPP_MENSAGENS_AUTO;
    const raw = localStorage.getItem(STORAGE_KEYS.WHATSAPP_MENSAGENS_AUTO);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.WHATSAPP_MENSAGENS_AUTO, JSON.stringify(INITIAL_WHATSAPP_MENSAGENS_AUTO));
      return INITIAL_WHATSAPP_MENSAGENS_AUTO;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_WHATSAPP_MENSAGENS_AUTO;
  }
}

export function saveLocalWhatsAppMensagensAuto(msgs: WhatsAppMensagemAutomatica[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.WHATSAPP_MENSAGENS_AUTO, JSON.stringify(msgs));
    }
  } catch (e) {
    console.error('Erro ao salvar mensagens automáticas de WhatsApp:', e);
  }
}

export function getLocalWhatsAppUsuariosHabilitados(): WhatsAppUsuarioHabilitado[] {
  try {
    if (typeof localStorage === 'undefined') return INITIAL_WHATSAPP_USUARIOS_HABILITADOS;
    const raw = localStorage.getItem(STORAGE_KEYS.WHATSAPP_USUARIOS_HABILITADOS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.WHATSAPP_USUARIOS_HABILITADOS, JSON.stringify(INITIAL_WHATSAPP_USUARIOS_HABILITADOS));
      return INITIAL_WHATSAPP_USUARIOS_HABILITADOS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_WHATSAPP_USUARIOS_HABILITADOS;
  }
}

export function saveLocalWhatsAppUsuariosHabilitados(usuarios: WhatsAppUsuarioHabilitado[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.WHATSAPP_USUARIOS_HABILITADOS, JSON.stringify(usuarios));
    }
  } catch (e) {
    console.error('Erro ao salvar usuários habilitados de WhatsApp:', e);
  }
}

export function getLocalWhatsAppConversas(): WhatsAppConversa[] {
  try {
    if (typeof localStorage === 'undefined') return INITIAL_WHATSAPP_CONVERSAS;
    const raw = localStorage.getItem(STORAGE_KEYS.WHATSAPP_CONVERSAS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.WHATSAPP_CONVERSAS, JSON.stringify(INITIAL_WHATSAPP_CONVERSAS));
      return INITIAL_WHATSAPP_CONVERSAS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_WHATSAPP_CONVERSAS;
  }
}

export function saveLocalWhatsAppConversas(conversas: WhatsAppConversa[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.WHATSAPP_CONVERSAS, JSON.stringify(conversas));
    }
  } catch (e) {
    console.error('Erro ao salvar conversas de WhatsApp:', e);
  }
}

export function getLocalWhatsAppMensagens(): WhatsAppMensagem[] {
  try {
    if (typeof localStorage === 'undefined') return INITIAL_WHATSAPP_MENSAGENS;
    const raw = localStorage.getItem(STORAGE_KEYS.WHATSAPP_MENSAGENS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.WHATSAPP_MENSAGENS, JSON.stringify(INITIAL_WHATSAPP_MENSAGENS));
      return INITIAL_WHATSAPP_MENSAGENS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_WHATSAPP_MENSAGENS;
  }
}

export function saveLocalWhatsAppMensagens(mensagens: WhatsAppMensagem[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.WHATSAPP_MENSAGENS, JSON.stringify(mensagens));
    }
  } catch (e) {
    console.error('Erro ao salvar mensagens de WhatsApp:', e);
  }
}

export function getLocalWhatsAppHistorico(): WhatsAppHistoricoAcao[] {
  try {
    if (typeof localStorage === 'undefined') return INITIAL_WHATSAPP_HISTORICO;
    const raw = localStorage.getItem(STORAGE_KEYS.WHATSAPP_HISTORICO);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.WHATSAPP_HISTORICO, JSON.stringify(INITIAL_WHATSAPP_HISTORICO));
      return INITIAL_WHATSAPP_HISTORICO;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_WHATSAPP_HISTORICO;
  }
}

export function saveLocalWhatsAppHistorico(historico: WhatsAppHistoricoAcao[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.WHATSAPP_HISTORICO, JSON.stringify(historico));
    }
  } catch (e) {
    console.error('Erro ao salvar histórico de ações do WhatsApp:', e);
  }
}




