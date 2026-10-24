import * as XLSX from 'xlsx';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import {
  ItemRelatorioRecebimentoProduto,
  RecebimentoProduto,
  ResumoRelatorioRecebimento,
  Usuario,
} from '../types';
import {
  getLocalRecebimentosProdutos,
  getLocalAgendamentos,
  getLocalFornecedores,
  getLocalUsuarios,
} from './mockStorage';
import { CAMPOS_RECEBIMENTO, normalizarNotaFiscal, recebimentoService } from './recebimentoService';
import { usuariosService } from './usuariosService';

/**
 * Formata timestamp ISO para padrão brasileiro legível "DD/MM/AAAA HH:mm:ss"
 */
export function formatarDataHora(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const data = new Date(isoString);
    if (isNaN(data.getTime())) return String(isoString);

    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    const hora = String(data.getHours()).padStart(2, '0');
    const min = String(data.getMinutes()).padStart(2, '0');
    const seg = String(data.getSeconds()).padStart(2, '0');

    return `${dia}/${mes}/${ano} ${hora}:${min}:${seg}`;
  } catch {
    return String(isoString);
  }
}

/**
 * Formata data simples YYYY-MM-DD para "DD/MM/AAAA"
 */
export function formatarDataSimples(dataStr?: string | null): string {
  if (!dataStr) return '—';
  try {
    const partes = dataStr.slice(0, 10).split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return dataStr;
  } catch {
    return dataStr;
  }
}

export interface NotaDisponivelRelatorio {
  nota_fiscal: string;
  data_recebimento: string;
  fornecedor: string;
  total_itens: number;
}

export const relatoriosService = {
  /**
   * 1. Lista as Notas Fiscais disponíveis na tabela recebimentos_produtos
   * Usado para alimentar chips de sugestão e atalhos rápidos de consulta.
   */
  async listarNotasDisponiveis(): Promise<NotaDisponivelRelatorio[]> {
    let produtos: RecebimentoProduto[] = [];
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('recebimentos_produtos')
          .select('nota_fiscal, data_recebimento, agendamento_id')
          .order('data_recebimento', { ascending: false });

        if (!error && data) {
          produtos = data as RecebimentoProduto[];
        }
      } catch (err) {
        console.warn('Erro ao consultar notas disponíveis no Supabase:', err);
      }
    }

    if (produtos.length === 0) {
      produtos = getLocalRecebimentosProdutos();
    }

    // Agrupa por Nota Fiscal única
    const mapaNfs = new Map<string, { data_recebimento: string; agendamento_id: string; total: number }>();
    for (const p of produtos) {
      const nf = (p.nota_fiscal || '').trim();
      if (!nf) continue;
      if (!mapaNfs.has(nf)) {
        mapaNfs.set(nf, {
          data_recebimento: p.data_recebimento || '',
          agendamento_id: p.agendamento_id || '',
          total: 0,
        });
      }
      mapaNfs.get(nf)!.total += 1;
    }

    // Mapeamento de fornecedor via agendamento local ou mock
    const agendamentos = getLocalAgendamentos();
    const fornecedores = getLocalFornecedores();

    const resultado: NotaDisponivelRelatorio[] = [];
    mapaNfs.forEach((info, nf) => {
      let fornecedorNome = 'Fornecedor não identificado';
      const ag = agendamentos.find((a) => String(a.id) === String(info.agendamento_id) || a.nota_fiscal === nf);
      if (ag) {
        if (ag.fornecedor_id) {
          const forn = fornecedores.find((f) => f.id === ag.fornecedor_id);
          if (forn) fornecedorNome = forn.nome_fantasia || forn.razao_social;
        }
        if (!fornecedorNome || fornecedorNome.includes('não identificado')) {
          fornecedorNome = ag.fornecedor || 'Fornecedor da Nota';
        }
      }

      resultado.push({
        nota_fiscal: nf,
        data_recebimento: info.data_recebimento,
        fornecedor: fornecedorNome,
        total_itens: info.total,
      });
    });

    return resultado;
  },

  /**
   * 2. Gera o Relatório de Recebimento de Produtos para uma Nota Fiscal informada.
   * Busca itens em public.recebimentos_produtos e enriquece com:
   * - Conferente (Nome e código a partir do conferente_id na tabela usuarios)
   * - Data e hora de conferência
   * - Endereço (novo_endereco || endereco)
   * - Repositor (Nome e código a partir do repositor_id na tabela usuarios)
   * - Data e hora da reposição (data_alocacao)
   */
  async gerarRelatorioRecebimentoPorNF(notaFiscal: string): Promise<ResumoRelatorioRecebimento> {
    const nfBuscada = (notaFiscal || '').trim();
    if (!nfBuscada) {
      throw new Error('É obrigatório informar o número da Nota Fiscal.');
    }

    const nfNormalizada = normalizarNotaFiscal(nfBuscada);
    let produtosEncontrados: RecebimentoProduto[] = [];
    const supabase = getSupabase();

    // 1. Consulta no Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        // Tenta buscar exata ou aproximada
        const { data, error } = await supabase
          .from('recebimentos_produtos')
          .select(CAMPOS_RECEBIMENTO)
          .ilike('nota_fiscal', `%${nfBuscada}%`)
          .order('id', { ascending: true });

        if (!error && data && data.length > 0) {
          produtosEncontrados = data as RecebimentoProduto[];
        }
      } catch (err) {
        console.warn('Erro ao consultar recebimentos_produtos para relatório no Supabase:', err);
      }
    }

    // 2. Fallback / Complemento com dados locais
    if (produtosEncontrados.length === 0) {
      const produtosLocais = getLocalRecebimentosProdutos();
      produtosEncontrados = produtosLocais.filter((p) => {
        const nfItem = p.nota_fiscal || '';
        return (
          nfItem.toLowerCase().includes(nfBuscada.toLowerCase()) ||
          normalizarNotaFiscal(nfItem) === nfNormalizada
        );
      });
    }

    if (produtosEncontrados.length === 0) {
      throw new Error(`Nenhum registro encontrado na tabela recebimentos_produtos para a Nota Fiscal "${nfBuscada}".`);
    }

    // 3. Carrega usuários para resolução de conferente_id e repositor_id
    let usuariosMap = new Map<string, Usuario>();
    try {
      const todosUsuarios = await usuariosService.listarTodos();
      todosUsuarios.forEach((u) => {
        usuariosMap.set(String(u.id), u);
        if (u.codigo) {
          usuariosMap.set(u.codigo, u);
        }
      });
    } catch {
      const locais = getLocalUsuarios();
      locais.forEach((u) => usuariosMap.set(String(u.id), u));
    }

    // 4. Resolve Fornecedor e Agendamento pela tabela recebimento / agendamentos
    const primeiro = produtosEncontrados[0];
    let nomeFornecedor = '';
    let dataRecebimento = primeiro.data_recebimento || '';

    try {
      const dadosAg = await recebimentoService.obterDadosAgendamentoPorId(
        primeiro.agendamento_id,
        primeiro.nota_fiscal
      );
      if (dadosAg?.fornecedor && !dadosAg.fornecedor.toLowerCase().includes('não informado')) {
        nomeFornecedor = dadosAg.fornecedor;
      }
      if (!dataRecebimento && dadosAg?.data) {
        dataRecebimento = dadosAg.data;
      }
    } catch (err) {
      console.warn('Erro ao obter dados do agendamento para o relatório:', err);
    }

    if (!nomeFornecedor || nomeFornecedor.includes('não identificado') || nomeFornecedor.toLowerCase().includes('não informado')) {
      const agendamentos = getLocalAgendamentos();
      const fornecedores = getLocalFornecedores();
      const ag = agendamentos.find(
        (a) =>
          String(a.id) === String(primeiro.agendamento_id) ||
          normalizarNotaFiscal(a.nota_fiscal) === normalizarNotaFiscal(primeiro.nota_fiscal)
      );
      if (ag) {
        if (ag.fornecedor_id) {
          const forn = fornecedores.find((f) => f.id === ag.fornecedor_id);
          if (forn) nomeFornecedor = forn.nome_fantasia || forn.razao_social;
        }
        if (!nomeFornecedor || nomeFornecedor.includes('não identificado')) {
          nomeFornecedor = ag.fornecedor || '';
        }
        if (!dataRecebimento && ag.data) {
          dataRecebimento = ag.data;
        }
      }
    }

    if (!nomeFornecedor) {
      nomeFornecedor = 'Fornecedor não informado';
    }

    // 5. Enriquecimento de cada item
    const itensRelatorio: ItemRelatorioRecebimentoProduto[] = produtosEncontrados.map((item) => {
      // Resolução do conferente
      let conferenteNome = item.conferente_nome || '';
      let conferenteCodigo = '';
      if (item.conferente_id) {
        const userObj = usuariosMap.get(String(item.conferente_id));
        if (userObj) {
          conferenteNome = userObj.nome;
          conferenteCodigo = userObj.codigo;
        } else if (!conferenteNome) {
          conferenteNome = `ID ${item.conferente_id.slice(0, 8)}`;
        }
      }
      if (!conferenteNome && !item.data_conferencia) {
        conferenteNome = 'Aguardando conferência';
      }

      // Resolução do repositor
      let repositorNome = item.repositor_nome || '';
      let repositorCodigo = '';
      if (item.repositor_id) {
        const userObj = usuariosMap.get(String(item.repositor_id));
        if (userObj) {
          repositorNome = userObj.nome;
          repositorCodigo = userObj.codigo;
        } else if (!repositorNome) {
          repositorNome = `ID ${item.repositor_id.slice(0, 8)}`;
        }
      }
      if (!repositorNome && !item.data_alocacao) {
        repositorNome = 'Aguardando alocação';
      }

      // Endereço (considera se foi alterado na alocação)
      const enderecoFinal = item.novo_endereco?.trim() || item.endereco?.trim() || 'Sem endereço';
      const enderecoAlterado = Boolean(
        item.novo_endereco &&
        item.endereco &&
        item.novo_endereco.trim() !== item.endereco.trim()
      );

      return {
        id: item.id,
        agendamento_id: item.agendamento_id,
        nota_fiscal: item.nota_fiscal,
        produto: item.produto,
        quantidade: Number(item.quantidade) || 0,
        qtd_conferida: item.qtd_conferida !== null && item.qtd_conferida !== undefined ? Number(item.qtd_conferida) : null,
        saldo_final: Number(item.saldo_final) || 0,
        status: item.status,

        // Conferência
        conferente_id: item.conferente_id,
        conferente_nome: conferenteNome,
        conferente_codigo: conferenteCodigo,
        data_hora_conferencia: item.data_conferencia || null,

        // Endereçamento e Reposição
        endereco: enderecoFinal,
        endereco_original: item.endereco,
        endereco_alterado: enderecoAlterado,
        repositor_id: item.repositor_id,
        repositor_nome: repositorNome,
        repositor_codigo: repositorCodigo,
        data_hora_reposicao: item.data_alocacao || null,
      };
    });

    // 6. Métricas do resumo
    const totalItens = itensRelatorio.length;
    const totalQuantidade = itensRelatorio.reduce((acc, curr) => acc + curr.quantidade, 0);
    const totalConferidos = itensRelatorio.filter((i) => Boolean(i.data_hora_conferencia)).length;
    const totalAlocados = itensRelatorio.filter((i) => Boolean(i.data_hora_reposicao)).length;

    return {
      nota_fiscal: primeiro.nota_fiscal,
      fornecedor: nomeFornecedor,
      data_recebimento: dataRecebimento,
      data_emissao_relatorio: new Date().toISOString(),
      total_itens: totalItens,
      total_quantidade: totalQuantidade,
      total_conferidos: totalConferidos,
      total_alocados: totalAlocados,
      itens: itensRelatorio,
    };
  },

  /**
   * 3. Exporta o relatório para arquivo Excel (.xlsx) com layout formatado.
   */
  exportarParaExcel(relatorio: ResumoRelatorioRecebimento): void {
    const wb = XLSX.utils.book_new();

    // Cabeçalhos institucionais e metadados
    const dadosPlanilha: any[][] = [
      ['POLIFILTRO LOGÍSTICA — RELATÓRIO DE RECEBIMENTO DE PRODUTOS'],
      ['Origem: Tabela public.recebimentos_produtos'],
      [],
      ['Nota Fiscal:', relatorio.nota_fiscal, '', 'Fornecedor:', relatorio.fornecedor],
      ['Data de Recebimento:', formatarDataSimples(relatorio.data_recebimento), '', 'Data de Emissão:', formatarDataHora(relatorio.data_emissao_relatorio)],
      ['Total de Itens:', relatorio.total_itens, '', 'Quantidade Total:', relatorio.total_quantidade],
      ['Itens Conferidos:', `${relatorio.total_conferidos} de ${relatorio.total_itens}`, '', 'Itens Alocados/Repostos:', `${relatorio.total_alocados} de ${relatorio.total_itens}`],
      [],
      [
        'Produto',
        'Quantidade',
        'Conferente',
        'Data e Hora de Conferência',
        'Endereço',
        'Repositor',
        'Data da Reposição',
      ],
    ];

    // Linhas dos itens
    for (const it of relatorio.itens) {
      const confDesc = it.conferente_codigo
        ? `${it.conferente_nome} (${it.conferente_codigo})`
        : it.conferente_nome;

      const repDesc = it.repositor_codigo
        ? `${it.repositor_nome} (${it.repositor_codigo})`
        : it.repositor_nome;

      dadosPlanilha.push([
        it.produto,
        it.quantidade,
        confDesc,
        it.data_hora_conferencia ? formatarDataHora(it.data_hora_conferencia) : 'Pendente',
        it.endereco_alterado ? `${it.endereco} (Reendereçado)` : it.endereco,
        repDesc,
        it.data_hora_reposicao ? formatarDataHora(it.data_hora_reposicao) : 'Pendente',
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(dadosPlanilha);

    // Largura das colunas para visualização ideal
    ws['!cols'] = [
      { wch: 45 }, // Produto
      { wch: 14 }, // Quantidade
      { wch: 28 }, // Conferente
      { wch: 24 }, // Data e Hora de Conferência
      { wch: 20 }, // Endereço
      { wch: 28 }, // Repositor
      { wch: 24 }, // Data da Reposição
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Recebimento NF');

    const cleanNf = relatorio.nota_fiscal.replace(/[^A-Za-z0-9]/g, '_');
    const filename = `relatorio_recebimento_NF_${cleanNf}.xlsx`;
    XLSX.writeFile(wb, filename);
  },

  /**
   * 4. Exporta para CSV com separador ';' e UTF-8 BOM para abrir direto no Excel PT-BR.
   */
  exportarParaCSV(relatorio: ResumoRelatorioRecebimento): void {
    const linhas: string[] = [];

    // Cabeçalho CSV
    linhas.push('Produto;Quantidade;Conferente;Data e Hora de Conferência;Endereço;Repositor;Data da Reposição');

    for (const it of relatorio.itens) {
      const confDesc = it.conferente_codigo
        ? `${it.conferente_nome} (${it.conferente_codigo})`
        : it.conferente_nome;

      const repDesc = it.repositor_codigo
        ? `${it.repositor_nome} (${it.repositor_codigo})`
        : it.repositor_nome;

      const prod = `"${(it.produto || '').replace(/"/g, '""')}"`;
      const qtd = it.quantidade;
      const conf = `"${confDesc.replace(/"/g, '""')}"`;
      const dataConf = `"${it.data_hora_conferencia ? formatarDataHora(it.data_hora_conferencia) : 'Pendente'}"`;
      const end = `"${it.endereco.replace(/"/g, '""')}"`;
      const rep = `"${repDesc.replace(/"/g, '""')}"`;
      const dataRep = `"${it.data_hora_reposicao ? formatarDataHora(it.data_hora_reposicao) : 'Pendente'}"`;

      linhas.push(`${prod};${qtd};${conf};${dataConf};${end};${rep};${dataRep}`);
    }

    const conteudo = '\uFEFF' + linhas.join('\r\n');
    const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const cleanNf = relatorio.nota_fiscal.replace(/[^A-Za-z0-9]/g, '_');
    link.href = url;
    link.setAttribute('download', `relatorio_recebimento_NF_${cleanNf}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * 5. Gera o texto formatado para copiar e colar / disparo no WhatsApp.
   * Formato solicitado:
   *
   * *CARGA RECEBIDA*
   *
   * *Data de recebimento:* 16/09/2026
   * *Fornecedor:* [Nome do Fornecedor]
   * *Nota fiscal:* 95099
   *
   * *Qtd - Produtos*
   *
   * • 9UN - TR341500PU
   * • 10UN - TR341500PU
   * • 10UN - TR500
   */
  gerarTextoWhatsApp(relatorio: {
    data_recebimento: string;
    fornecedor?: string;
    nota_fiscal: string;
    itens: Array<{ produto: string; quantidade: number | string }>;
  }): string {
    const dataFormatada = formatarDataSimples(relatorio.data_recebimento);
    const fornecedor = relatorio.fornecedor || 'Fornecedor não informado';
    const nf = relatorio.nota_fiscal;

    const linhasProdutos = relatorio.itens.map((item) => {
      const qtdNum = Number(item.quantidade);
      const qtdTexto = !isNaN(qtdNum)
        ? (Number.isInteger(qtdNum) ? String(qtdNum) : String(item.quantidade))
        : String(item.quantidade || 0);
      const prodNome = (item.produto || '').trim();
      return `• ${qtdTexto}UN - ${prodNome}`;
    });

    return (
      `*CARGA RECEBIDA*\n\n` +
      `*Data de recebimento:* ${dataFormatada}\n` +
      `*Fornecedor:* ${fornecedor}\n` +
      `*Nota fiscal:* ${nf}\n\n` +
      `*Qtd - Produtos*\n\n` +
      linhasProdutos.join('\n')
    );
  },
};
