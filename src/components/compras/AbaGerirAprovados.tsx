import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCheck,
  FileSpreadsheet,
  Package,
  User,
  ShieldCheck,
  RefreshCw,
  Search,
  CheckSquare,
  Square,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Filter,
  Sparkles,
  Flame,
  Clock,
  Copy,
  Check,
  Mail,
  Layers,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SolicitacaoCompra, DemandaCompra } from '../../types';
import { comprasService } from '../../services/comprasService';
import { useAuth } from '../../context/AuthContext';
import { isUserGestor } from '../../lib/permissions';

export const AbaGerirAprovados: React.FC = () => {
  const { user } = useAuth();
  const isGestor = isUserGestor(user);

  const [aprovados, setAprovados] = useState<SolicitacaoCompra[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroFabricante, setFiltroFabricante] = useState<string>('Todos');
  const [filtroDemanda, setFiltroDemanda] = useState<DemandaCompra | 'Todos'>('Todos');
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  // Confirmação de marcação em lote
  const [modalConfirmarAberto, setModalConfirmarAberto] = useState(false);
  const [processandoLote, setProcessandoLote] = useState(false);
  const [feedbackLote, setFeedbackLote] = useState<string | null>(null);

  // Estado para feedback de cópia de nome do produto para o clipboard
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  // Estados para o bloco de copia e cola de e-mail no modal de confirmação
  const [copiadoEmail, setCopiadoEmail] = useState(false);
  const [textoEmailEditavel, setTextoEmailEditavel] = useState('');

  const handleCopiarNome = async (id: string, nome?: string | null) => {
    if (!nome) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(nome);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = nome;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiadoId(id);
      setTimeout(() => {
        setCopiadoId((current) => (current === id ? null : current));
      }, 2000);
    } catch (err) {
      console.warn('Erro ao copiar para o clipboard:', err);
    }
  };

  const carregarAprovados = async () => {
    setCarregando(true);
    setFeedbackLote(null);
    try {
      const dados = await comprasService.listarAprovados(user?.unidade_negocio);
      setAprovados(dados);
      // Limpa seleções de itens que não existem mais
      setSelecionados(new Set());
    } catch (err) {
      console.warn('Erro ao carregar aprovados:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarAprovados();
  }, [user?.unidade_negocio]);

  // Lista de Fabricantes únicos para o filtro na mesma linha
  const fabricantesDisponiveis = useMemo(() => {
    const setFabs = new Set<string>();
    aprovados.forEach((a) => {
      const fab = a.produto_fabricante?.trim();
      if (fab) {
        setFabs.add(fab);
      }
    });
    return Array.from(setFabs).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [aprovados]);

  // Filtragem local e ORDENAÇÃO DE A A Z POR NOME DO PRODUTO
  const filtrados = useMemo(() => {
    let itens = [...aprovados];

    // Filtro por Fabricante
    if (filtroFabricante !== 'Todos') {
      itens = itens.filter(
        (a) => a.produto_fabricante?.trim().toLowerCase() === filtroFabricante.trim().toLowerCase()
      );
    }

    // Filtro por Demanda (Estoque, Sob Encomenda, Consumos)
    if (filtroDemanda !== 'Todos') {
      itens = itens.filter((a) => {
        if (filtroDemanda === 'Sob Encomenda') {
          return a.demanda === 'Sob Encomenda' || a.demanda === 'Necessidade';
        }
        if (filtroDemanda === 'Consumos') {
          return a.demanda === 'Consumos' || a.demanda === 'Compras';
        }
        return a.demanda === filtroDemanda;
      });
    }

    // Filtro por termo de busca
    if (busca.trim()) {
      const t = busca.toLowerCase().trim();
      itens = itens.filter(
        (a) =>
          a.produto_nome?.toLowerCase().includes(t) ||
          a.produto_fabricante?.toLowerCase().includes(t) ||
          a.solicitante_nome?.toLowerCase().includes(t) ||
          a.observacao?.toLowerCase().includes(t) ||
          a.produto_codigo_barras?.toLowerCase().includes(t)
      );
    }

    // REGRA: Ordenar a lista por nome do produto de A a Z
    itens.sort((a, b) => {
      const nomeA = a.produto_nome?.trim() || '';
      const nomeB = b.produto_nome?.trim() || '';
      const comp = nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base' });
      if (comp !== 0) return comp;
      // Critério de desempate por data mais recente
      return new Date(b.data_insercao).getTime() - new Date(a.data_insercao).getTime();
    });

    return itens;
  }, [aprovados, busca, filtroFabricante, filtroDemanda]);

  // Helper para identificar o produto (agrupamento de duplicados)
  const getProdutoKey = (item: SolicitacaoCompra) => {
    if (item.id_produto) return item.id_produto;
    return (item.produto_nome || '').trim().toLowerCase();
  };

  // Contagem de solicitações com o mesmo produto para destaque da linha vermelha
  const contagemPorProduto = useMemo(() => {
    const contagem = new Map<string, number>();
    filtrados.forEach((item) => {
      const key = getProdutoKey(item);
      contagem.set(key, (contagem.get(key) || 0) + 1);
    });
    return contagem;
  }, [filtrados]);

  // Quantidade de produtos que possuem repetições
  const totalProdutosComRepeticao = useMemo(() => {
    let total = 0;
    contagemPorProduto.forEach((qtd) => {
      if (qtd > 1) total++;
    });
    return total;
  }, [contagemPorProduto]);

  // Toggle selecionar individual
  const toggleSelecionar = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle selecionar todos os itens exibidos
  const toggleSelecionarTodos = () => {
    if (selecionados.size === filtrados.length && filtrados.length > 0) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(filtrados.map((item) => item.id)));
    }
  };

  const totalSelecionados = selecionados.size;
  const todosSelecionados = filtrados.length > 0 && selecionados.size === filtrados.length;

  // Monta o texto formatado para envio por e-mail no formato solicitado pelo gestor:
  // Solicitação de compra:
  //
  // Fabricante: *Fabricante*
  //
  // Produtos:
  //
  // *Qtd* -  *Produtos*
  const textoParaEmail = useMemo(() => {
    const itens = aprovados.filter((a) => selecionados.has(a.id));
    if (itens.length === 0) return '';

    // Agrupa itens por Fabricante
    const porFabricante = new Map<string, { produto: string; qtd: number }[]>();

    itens.forEach((item) => {
      const fab = (item.produto_fabricante || item.produto?.fabricante || 'Fabricante não informado').trim();
      const nomeProd = (item.produto_nome || item.produto?.produto || 'Produto sem identificação').trim();
      const qtd = Number(item.quantidade_aprovada ?? item.quantidade) || 1;

      if (!porFabricante.has(fab)) {
        porFabricante.set(fab, []);
      }
      const lista = porFabricante.get(fab)!;
      const existente = lista.find((p) => p.produto.toLowerCase() === nomeProd.toLowerCase());
      if (existente) {
        existente.qtd += qtd;
      } else {
        lista.push({ produto: nomeProd, qtd });
      }
    });

    const blocos: string[] = [];

    porFabricante.forEach((produtos, fabricante) => {
      let bloco = `Solicitação de compra:\n\nFabricante: ${fabricante}\n\nProdutos:\n\n`;
      const linhasProdutos = produtos.map((p) => `${p.qtd} -  ${p.produto}`).join('\n');
      bloco += linhasProdutos;
      blocos.push(bloco);
    });

    return blocos.join('\n\n\n');
  }, [aprovados, selecionados]);

  // Sincroniza o texto editável sempre que o modal de confirmação for aberto
  useEffect(() => {
    if (modalConfirmarAberto) {
      setTextoEmailEditavel(textoParaEmail);
      setCopiadoEmail(false);
    }
  }, [modalConfirmarAberto, textoParaEmail]);

  const handleCopiarTextoEmail = async () => {
    const texto = textoEmailEditavel || textoParaEmail;
    if (!texto) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(texto);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = texto;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiadoEmail(true);
      setTimeout(() => {
        setCopiadoEmail(false);
      }, 2500);
    } catch (err) {
      console.warn('Erro ao copiar texto do e-mail:', err);
    }
  };

  // AÇÃO 1: MARCAR COMPRADOS EM LOTE
  const handleConfirmarMarcarComprados = async () => {
    if (!user?.id || totalSelecionados === 0) return;

    setProcessandoLote(true);
    setFeedbackLote(null);

    try {
      const idsArray = Array.from(selecionados) as string[];
      const resultado = await comprasService.marcarCompradosEmLote(idsArray, user.id);

      if (resultado.falhas.length > 0) {
        setFeedbackLote(
          `${resultado.processados.length} item(ns) marcado(s) como comprado(s). ${resultado.falhas.length} item(ns) já haviam sido alterados e não foram modificados.`
        );
      } else {
        setFeedbackLote(`${resultado.processados.length} item(ns) marcado(s) com sucesso como comprado(s)!`);
      }

      setModalConfirmarAberto(false);
      await carregarAprovados();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar lote.';
      setFeedbackLote(`Erro: ${msg}`);
    } finally {
      setProcessandoLote(false);
    }
  };

  // AÇÃO 2: EXPORTAR PLANILHA (Excel - XLSX)
  const handleExportarPlanilha = () => {
    if (totalSelecionados === 0) return;

    const itensParaExportar = aprovados.filter((item) => selecionados.has(item.id));

    const dadosExportacao = itensParaExportar.map((item) => ({
      Produto: item.produto_nome || 'Produto',
      Fabricante: item.produto_fabricante || 'Fabricante não informado',
      Solicitante: item.solicitante_nome || 'Solicitante',
      'Quantidade Solicitada': item.quantidade,
      'Quantidade Aprovada': item.quantidade_aprovada ?? item.quantidade,
      'Data da Solicitação': item.data_insercao
        ? new Date(item.data_insercao).toLocaleString('pt-BR')
        : '',
      'Data da Aprovação': item.data_aprovacao
        ? new Date(item.data_aprovacao).toLocaleString('pt-BR')
        : '',
      'Gestor Aprovador': item.usuario_aprovacao_nome || '',
      Demanda: item.demanda,
      Urgência: item.urgencia,
      Status: item.status,
      Observação: item.observacao || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dadosExportacao);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Compras Aprovadas');

    const dataAtual = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(
      workbook,
      `PoliHub_Compras_Aprovados_${user?.unidade_negocio || 'Goiânia'}_${dataAtual}.xlsx`
    );
  };

  if (!isGestor) {
    return (
      <div className="p-8 text-center rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
        <h3 className="text-base font-bold text-white">Acesso Exclusivo para Gestores</h3>
        <p className="text-xs text-slate-400">
          A aba "Gerir aprovados" é restrita a usuários com nível de acesso Gestor.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra Superior: Seleção, Filtro de Fabricante e Botões na mesma linha */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-lg">
        {/* Lado Esquerdo: Selecionar Todos e Contador */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleSelecionarTodos}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-slate-800 bg-slate-950 text-slate-300 hover:text-white transition"
          >
            {todosSelecionados ? (
              <CheckSquare className="w-4 h-4 text-emerald-400" />
            ) : (
              <Square className="w-4 h-4 text-slate-500" />
            )}
            <span>{todosSelecionados ? 'Desmarcar Todos' : 'Selecionar Todos'}</span>
          </button>

          <span className="text-xs text-slate-400">
            {totalSelecionados > 0 ? (
              <strong className="text-emerald-400 font-bold">
                {totalSelecionados} {totalSelecionados === 1 ? 'item selecionado' : 'itens selecionados'}
              </strong>
            ) : (
              <span>Nenhum item selecionado</span>
            )}
          </span>

          {totalProdutosComRepeticao > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/30 text-xs font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{totalProdutosComRepeticao} produto(s) com pedidos repetidos</span>
            </span>
          )}
        </div>

        {/* Lado Direito: Filtro de Fabricante + Marcar Comprados + Exportar na Mesma Linha */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Filtro de Fabricante na mesma linha dos botões */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">Fabricante:</span>
            <select
              value={filtroFabricante}
              onChange={(e) => setFiltroFabricante(e.target.value)}
              className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer pr-1"
            >
              <option value="Todos" className="bg-slate-900 text-white">
                Todos {fabricantesDisponiveis.length > 0 ? `(${fabricantesDisponiveis.length})` : ''}
              </option>
              {fabricantesDisponiveis.map((fab) => (
                <option key={fab} value={fab} className="bg-slate-900 text-white">
                  {fab}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro de Demanda na mesma linha dos botões */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <Layers className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">Demanda:</span>
            <select
              value={filtroDemanda}
              onChange={(e) => setFiltroDemanda(e.target.value as DemandaCompra | 'Todos')}
              className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer pr-1"
            >
              <option value="Todos" className="bg-slate-900 text-white">
                Todas as Demandas
              </option>
              <option value="Estoque" className="bg-slate-900 text-white">
                Estoque
              </option>
              <option value="Sob Encomenda" className="bg-slate-900 text-white">
                Sob Encomenda
              </option>
              <option value="Consumos" className="bg-slate-900 text-white">
                Consumos
              </option>
            </select>
          </div>

          {/* Botão Marcar Comprados */}
          <button
            type="button"
            disabled={totalSelecionados === 0}
            onClick={() => setModalConfirmarAberto(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Marcar Comprados ({totalSelecionados})</span>
          </button>

          {/* Botão Exportar Planilha */}
          <button
            type="button"
            disabled={totalSelecionados === 0}
            onClick={handleExportarPlanilha}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar Planilha ({totalSelecionados})</span>
          </button>

          <button
            type="button"
            onClick={carregarAprovados}
            disabled={carregando}
            className="p-2 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white transition"
            title="Atualizar lista de aprovados"
          >
            <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {feedbackLote && (
        <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-blue-400 shrink-0" />
          <span>{feedbackLote}</span>
        </div>
      )}

      {/* Busca Rápida Local */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar produtos aprovados de A a Z por nome, solicitante ou código..."
          className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* LISTAGEM DOS PRODUTOS APROVADOS (ORDENADA POR NOME DE A A Z COM LINHA VERMELHA PARA DUPLICADOS) */}
      {carregando ? (
        <div className="p-12 text-center rounded-3xl bg-slate-900/60 border border-slate-800 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
          <span className="text-xs text-slate-400">Carregando produtos aprovados...</span>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-slate-900/60 border border-slate-800 space-y-2">
          <Package className="w-8 h-8 text-slate-600 mx-auto" />
          <h4 className="text-sm font-bold text-white">Nenhum produto aprovado encontrado</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {busca || filtroFabricante !== 'Todos'
              ? 'Nenhum resultado corresponde aos filtros aplicados.'
              : 'Todas as solicitações aprovadas já foram compradas ou não há aprovações recentes na unidade.'}
          </p>
        </div>
      ) : (
        <>
          {/* TABELA DESKTOP */}
          <div className="hidden lg:block rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4 w-10 text-center">
                      <span className="sr-only">Seleção</span>
                    </th>
                    <th className="py-3.5 px-4">Produto (A-Z)</th>
                    <th className="py-3.5 px-4 text-center">Copiar Nome</th>
                    <th className="py-3.5 px-4 text-center">Qtd. Aprovada</th>
                    <th className="py-3.5 px-4 text-center">Demanda</th>
                    <th className="py-3.5 px-4">Solicitante</th>
                    <th className="py-3.5 px-4">Data Aprovação</th>
                    <th className="py-3.5 px-4">Gestor Decisor</th>
                    <th className="py-3.5 px-4 text-center">Urgência</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filtrados.map((item, index) => {
                    const isChecked = selecionados.has(item.id);

                    // Identificação do produto e regras de borda vermelha ao redor do bloco
                    const key = getProdutoKey(item);
                    const totalMesmoProduto = contagemPorProduto.get(key) || 1;
                    const temDuplicidade = totalMesmoProduto > 1;

                    const prevKey = index > 0 ? getProdutoKey(filtrados[index - 1]) : null;
                    const nextKey =
                      index < filtrados.length - 1 ? getProdutoKey(filtrados[index + 1]) : null;

                    const ehPrimeiroDoBloco = temDuplicidade && prevKey !== key;
                    const ehUltimoDoBloco = temDuplicidade && nextKey !== key;

                    // Classes da linha vermelha ao redor do bloco
                    const bordaTopo = ehPrimeiroDoBloco ? 'border-t-2 border-t-rose-500' : '';
                    const bordaBase = ehUltimoDoBloco ? 'border-b-2 border-b-rose-500' : '';

                    return (
                      <tr
                        key={item.id}
                        onClick={() => toggleSelecionar(item.id)}
                        className={`cursor-pointer transition ${
                          isChecked
                            ? 'bg-blue-600/20 hover:bg-blue-600/25'
                            : temDuplicidade
                            ? 'bg-rose-950/30 hover:bg-rose-950/45'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        {/* 1. Checkbox — Borda esquerda vermelha se tiver duplicidade */}
                        <td
                          className={`py-3.5 px-4 text-center ${bordaTopo} ${bordaBase} ${
                            temDuplicidade ? 'border-l-2 border-l-rose-500' : ''
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSelecionar(item.id)}
                            className="p-1 rounded text-slate-400 hover:text-white"
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600" />
                            )}
                          </button>
                        </td>

                        {/* 2. Produto (Ordenado A-Z) */}
                        <td className={`py-3.5 px-4 max-w-xs ${bordaTopo} ${bordaBase}`}>
                          <div className="font-bold text-white truncate text-xs">{item.produto_nome}</div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {item.produto_fabricante || 'Fabricante não informado'}
                            {item.produto_codigo_barras ? ` • ${item.produto_codigo_barras}` : ''}
                          </div>

                          {/* Tag indicativa se tiver mais de uma solicitação do mesmo produto */}
                          {temDuplicidade && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                                Mesmo produto ({totalMesmoProduto} solicitações)
                              </span>
                            </div>
                          )}
                        </td>

                        {/* 3. Copiar Nome do Produto (substitui Qtd Solicitada) */}
                        <td
                          className={`py-3.5 px-4 text-center ${bordaTopo} ${bordaBase}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopiarNome(item.id, item.produto_nome);
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
                              copiadoId === item.id
                                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:text-white'
                            }`}
                            title="Copiar nome do produto para a área de transferência"
                          >
                            {copiadoId === item.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>Copiar nome</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* 4. Qtd Aprovada */}
                        <td className={`py-3.5 px-4 text-center ${bordaTopo} ${bordaBase}`}>
                          <span className="font-mono font-black text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                            {item.quantidade_aprovada ?? item.quantidade} un.
                          </span>
                        </td>

                        {/* 4.1. Demanda (Destino da Compra) */}
                        <td className={`py-3.5 px-4 text-center whitespace-nowrap ${bordaTopo} ${bordaBase}`}>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${
                              item.demanda === 'Estoque'
                                ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                                : item.demanda === 'Sob Encomenda' || item.demanda === 'Necessidade'
                                ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                : 'bg-teal-500/15 text-teal-300 border-teal-500/30'
                            }`}
                            title={`Destino da compra: ${item.demanda}`}
                          >
                            {item.demanda}
                          </span>
                        </td>

                        {/* 5. Solicitante */}
                        <td className={`py-3.5 px-4 whitespace-nowrap ${bordaTopo} ${bordaBase}`}>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center">
                              <User className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="font-semibold text-white block text-xs truncate max-w-[120px]">
                                {item.solicitante_nome}
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate">
                                {item.solicitante_departamento}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 6. Data Aprovação */}
                        <td
                          className={`py-3.5 px-4 whitespace-nowrap text-slate-300 font-mono text-[11px] ${bordaTopo} ${bordaBase}`}
                        >
                          {item.data_aprovacao
                            ? new Date(item.data_aprovacao).toLocaleDateString('pt-BR')
                            : '-'}
                        </td>

                        {/* 7. Gestor Decisor */}
                        <td className={`py-3.5 px-4 whitespace-nowrap ${bordaTopo} ${bordaBase}`}>
                          <div className="flex items-center gap-1.5 text-xs text-blue-300">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="font-medium truncate max-w-[120px]">
                              {item.usuario_aprovacao_nome || 'Gestor'}
                            </span>
                          </div>
                        </td>

                        {/* 8. Urgência */}
                        <td className={`py-3.5 px-4 text-center whitespace-nowrap ${bordaTopo} ${bordaBase}`}>
                          {item.urgencia === 'Urgente' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              <Flame className="w-3 h-3 text-rose-400 animate-pulse" /> Urgente
                            </span>
                          ) : item.urgencia === 'Rápida' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              <Sparkles className="w-3 h-3 text-amber-400" /> Rápida
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                              <Clock className="w-3 h-3 text-slate-500" /> Média
                            </span>
                          )}
                        </td>

                        {/* 9. Status — Borda direita vermelha se tiver duplicidade */}
                        <td
                          className={`py-3.5 px-4 text-center whitespace-nowrap ${bordaTopo} ${bordaBase} ${
                            temDuplicidade ? 'border-r-2 border-r-rose-500' : ''
                          }`}
                        >
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                            Aprovado
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* CARDS RESPONSIVOS PARA MOBILE / TABLET */}
          <div className="lg:hidden space-y-3">
            {filtrados.map((item) => {
              const isChecked = selecionados.has(item.id);
              const key = getProdutoKey(item);
              const totalMesmoProduto = contagemPorProduto.get(key) || 1;
              const temDuplicidade = totalMesmoProduto > 1;

              return (
                <div
                  key={item.id}
                  onClick={() => toggleSelecionar(item.id)}
                  className={`p-4 rounded-3xl border transition cursor-pointer space-y-3 ${
                    isChecked
                      ? 'bg-blue-600/20 border-blue-500 shadow-md'
                      : temDuplicidade
                      ? 'bg-rose-950/25 border-2 border-rose-500 shadow-lg shadow-rose-950/40'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelecionar(item.id);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-white mt-0.5"
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-white truncate">{item.produto_nome}</h4>
                        <span className="text-xs text-slate-400 block truncate">
                          {item.produto_fabricante || 'Fabricante não informado'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <span className="text-base font-black text-emerald-400 font-mono block">
                        {item.quantidade_aprovada ?? item.quantidade} un.
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopiarNome(item.id, item.produto_nome);
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold transition shadow-sm ${
                          copiadoId === item.id
                            ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                        }`}
                        title="Copiar nome do produto"
                      >
                        {copiadoId === item.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>Copiar nome</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {temDuplicidade && (
                    <div className="px-2.5 py-1 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>Mesmo produto: {totalMesmoProduto} solicitações pendentes de compra</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px] truncate">
                      <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">Por: <strong className="text-slate-300">{item.solicitante_nome}</strong></span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                          item.demanda === 'Estoque'
                            ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                            : item.demanda === 'Sob Encomenda' || item.demanda === 'Necessidade'
                            ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                            : 'bg-teal-500/15 text-teal-300 border-teal-500/30'
                        }`}
                        title={`Destino da compra: ${item.demanda}`}
                      >
                        {item.demanda}
                      </span>

                      {item.urgencia === 'Urgente' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          <Flame className="w-3 h-3 text-rose-400" /> Urgente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                          Aprovado
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal de Confirmação: Marcar Comprados em Lote com Bloco de Copia e Cola */}
      {modalConfirmarAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <CheckCheck className="w-5 h-5" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Marcar Itens como Comprados</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Você está prestes a atualizar o status de{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{totalSelecionados} item(ns)</strong> selecionado(s) para{' '}
                  <strong className="text-slate-900 dark:text-white font-bold">Comprado</strong>.
                </p>
              </div>
            </div>

            {/* Bloco de Copia e Cola para Enviar os Produtos por E-mail */}
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col flex-1 min-h-0">
              <div className="p-3 bg-slate-100/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Solicitação de compra para e-mail</span>
                </div>
                <button
                  type="button"
                  id="btn-copiar-email-topo"
                  onClick={handleCopiarTextoEmail}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    copiadoEmail
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                      : 'bg-white hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-xs'
                  }`}
                  title="Copiar texto formatado"
                >
                  {copiadoEmail ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-3 space-y-1.5">
                <textarea
                  id="textarea-copia-email"
                  value={textoEmailEditavel}
                  onChange={(e) => setTextoEmailEditavel(e.target.value)}
                  rows={8}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800/80 rounded-xl p-3 font-mono text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-blue-500/60 leading-relaxed resize-y select-all"
                  placeholder="Nenhum item selecionado..."
                />
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Lista formatada com Fabricante, Quantidade e Produtos para envio rápido.</span>
                  <span className="text-slate-400 dark:text-slate-500 font-mono text-[10px] shrink-0 ml-2">
                    {totalSelecionados} produto(s)
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/60 text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
              Ao confirmar a aquisição, os itens sairão da lista de pendentes e passarão para o histórico de{' '}
              <strong className="text-slate-800 dark:text-slate-200">Comprados</strong> com registro de auditoria.
            </div>

            {/* Rodapé com botão Cancelar e ao lado de Confirmar Aquisição o Botão de Copia e Cola */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => setModalConfirmarAberto(false)}
                disabled={processandoLote}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>

              <div className="flex items-center gap-2">
                {/* Botão de Copia e Cola ao lado do botão Confirmar Aquisição */}
                <button
                  type="button"
                  id="btn-copiar-email-rodape"
                  onClick={handleCopiarTextoEmail}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer ${
                    copiadoEmail
                      ? 'bg-blue-600 text-white shadow-blue-600/30 ring-2 ring-blue-400/40'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700 border'
                  }`}
                  title="Copiar lista formatada para a área de transferência para envio por e-mail"
                >
                  {copiadoEmail ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                      <span>Copia e Cola</span>
                    </>
                  )}
                </button>

                {/* Botão Confirmar Aquisição */}
                <button
                  type="button"
                  id="btn-confirmar-aquisicao"
                  onClick={handleConfirmarMarcarComprados}
                  disabled={processandoLote}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 disabled:opacity-50 cursor-pointer"
                >
                  {processandoLote ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCheck className="w-4 h-4" />
                      <span>Confirmar Aquisição</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
