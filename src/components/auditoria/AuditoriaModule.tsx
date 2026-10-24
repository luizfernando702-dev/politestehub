import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Calendar,
  Filter,
  Download,
  ArrowUpDown,
  RotateCcw,
  CheckCircle2,
  Clock,
  MapPin,
  User,
  AlertCircle,
  Package,
  Layers,
  Sparkles,
  Inbox,
  CheckSquare,
  PackageCheck,
  ArrowRightLeft,
  AlertTriangle,
  FileSpreadsheet,
  X,
  Building2,
  Barcode,
  SearchCode,
  CalendarDays,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  EventoAuditoria,
  PeriodoFiltro,
  PeriodoOpcao,
  Produto,
  ResumoAuditoriaProduto,
  TipoEventoAuditoria,
} from '../../types';
import { auditoriaService, criarPeriodoPadrao } from '../../services/auditoriaService';
import { useAuth } from '../../context/AuthContext';
import { SqlScriptAuditoriaModal } from './SqlScriptAuditoriaModal';

export const AuditoriaModule: React.FC = () => {
  const { user } = useAuth();
  const unidadeNegocio = user?.unidade_negocio || 'Goiânia';

  // Estados de busca de produto
  const [termoBusca, setTermoBusca] = useState('');
  const [produtosSugeridos, setProdutosSugeridos] = useState<Produto[]>([]);
  const [buscandoProdutos, setBuscandoProdutos] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [dropdownAberto, setDropdownAberto] = useState(false);

  // Estados de período
  const [periodoFiltro, setPeriodoFiltro] = useState<PeriodoFiltro>(criarPeriodoPadrao('30d'));
  const [modalPeriodoPersonalizado, setModalPeriodoPersonalizado] = useState(false);
  const [customInicio, setCustomInicio] = useState('');
  const [customFim, setCustomFim] = useState('');

  // Estados de consulta de auditoria
  const [resumoAuditoria, setResumoAuditoria] = useState<ResumoAuditoriaProduto | null>(null);
  const [carregandoAuditoria, setCarregandoAuditoria] = useState(false);

  // Filtros locais refinados (Sem requisições adicionais)
  const [filtroTipo, setFiltroTipo] = useState<string>('TODOS');
  const [filtroColaborador, setFiltroColaborador] = useState<string>('TODOS');
  const [ordemDesc, setOrdemDesc] = useState<boolean>(true); // true = Mais recente primeiro

  // Modal SQL
  const [modalSqlAberto, setModalSqlAberto] = useState(false);

  // 1. Efeito de busca de produtos (mínimo 3 caracteres com debounce)
  useEffect(() => {
    const q = termoBusca.trim();
    if (q.length < 3) {
      setProdutosSugeridos([]);
      setDropdownAberto(false);
      return;
    }

    setBuscandoProdutos(true);
    const handler = setTimeout(async () => {
      try {
        const resultados = await auditoriaService.pesquisarProdutos(q);
        setProdutosSugeridos(resultados);
        setDropdownAberto(true);
      } catch (err) {
        console.warn('Erro ao pesquisar produtos:', err);
      } finally {
        setBuscandoProdutos(false);
      }
    }, 280);

    return () => clearTimeout(handler);
  }, [termoBusca]);

  // 2. Consulta automática de movimentações quando o produto ou período é alterado
  const carregarHistorico = async (prod: Produto, per: PeriodoFiltro) => {
    setCarregandoAuditoria(true);
    try {
      const dados = await auditoriaService.consultarMovimentacoesProduto({
        produto: prod,
        periodo: per,
        unidadeNegocio,
      });
      setResumoAuditoria(dados);
      // Reset de filtros secundários
      setFiltroTipo('TODOS');
      setFiltroColaborador('TODOS');
    } catch (err) {
      console.warn('Erro ao consultar histórico de auditoria:', err);
    } finally {
      setCarregandoAuditoria(false);
    }
  };

  const handleSelecionarProduto = (prod: Produto) => {
    setProdutoSelecionado(prod);
    setTermoBusca(prod.produto);
    setDropdownAberto(false);
    carregarHistorico(prod, periodoFiltro);
  };

  const handleLimparSelecao = () => {
    setProdutoSelecionado(null);
    setResumoAuditoria(null);
    setTermoBusca('');
    setProdutosSugeridos([]);
    setDropdownAberto(false);
  };

  const handleTrocarPeriodo = (tipo: PeriodoOpcao) => {
    if (tipo === 'personalizado') {
      const hoje = new Date().toISOString().slice(0, 10);
      setCustomInicio(periodoFiltro.dataInicio || hoje);
      setCustomFim(periodoFiltro.dataFim || hoje);
      setModalPeriodoPersonalizado(true);
      return;
    }

    const novoPer = criarPeriodoPadrao(tipo);
    setPeriodoFiltro(novoPer);
    if (produtoSelecionado) {
      carregarHistorico(produtoSelecionado, novoPer);
    }
  };

  const handleConfirmarPeriodoPersonalizado = () => {
    if (!customInicio || !customFim) {
      alert('Informe a data inicial e a data final.');
      return;
    }
    if (customInicio > customFim) {
      alert('A data inicial não pode ser superior à data final.');
      return;
    }

    const novoPer = criarPeriodoPadrao('personalizado', customInicio, customFim);
    setPeriodoFiltro(novoPer);
    setModalPeriodoPersonalizado(false);

    if (produtoSelecionado) {
      carregarHistorico(produtoSelecionado, novoPer);
    }
  };

  // Lista única de colaboradores presentes nos eventos consultados
  const colaboradoresDisponiveis = useMemo(() => {
    if (!resumoAuditoria?.eventos) return [];
    const map = new Map<string, string>();
    resumoAuditoria.eventos.forEach((e) => {
      if (e.responsavelNome && e.responsavelNome !== 'Não informado') {
        const chave = e.responsavelId || e.responsavelNome;
        map.set(chave, e.responsavelNome);
      }
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  }, [resumoAuditoria]);

  // Eventos filtrados e ordenados
  const eventosFiltrados = useMemo(() => {
    if (!resumoAuditoria?.eventos) return [];

    let lista = resumoAuditoria.eventos.filter((ev) => {
      // Filtro de Tipo de Movimentação (com suporte a filtros especializados de pendentes e avulsas)
      if (filtroTipo === 'ALTERACAO_PENDENTE') {
        if (ev.tipo !== 'ALTERACAO_ENDERECO' || !ev.isPendente) return false;
      } else if (filtroTipo === 'ALTERACAO_AVULSA') {
        if (ev.tipo !== 'ALTERACAO_ENDERECO' || !ev.isAvulsa) return false;
      } else if (filtroTipo !== 'TODOS' && ev.tipo !== filtroTipo) {
        return false;
      }
      // Filtro de Colaborador
      if (filtroColaborador !== 'TODOS') {
        const chaveEv = ev.responsavelId || ev.responsavelNome;
        if (chaveEv !== filtroColaborador) {
          return false;
        }
      }
      return true;
    });

    // Ordenação Cronológica
    lista.sort((a, b) => {
      const tA = new Date(a.dataHora).getTime();
      const tB = new Date(b.dataHora).getTime();
      return ordemDesc ? tB - tA : tA - tB;
    });

    return lista;
  }, [resumoAuditoria, filtroTipo, filtroColaborador, ordemDesc]);

  // Exportar histórico para Excel (.xlsx)
  const handleExportarExcel = () => {
    if (!produtoSelecionado || !resumoAuditoria || eventosFiltrados.length === 0) {
      alert('Não há eventos de movimentação para exportar.');
      return;
    }

    const dados = eventosFiltrados.map((ev, index) => ({
      '#': index + 1,
      'Data e Hora': new Date(ev.dataHora).toLocaleString('pt-BR'),
      'Tipo de Movimentação': ev.tipoLabel,
      'Produto': ev.produto,
      'Código de Barras': ev.codigoProduto || '-',
      'Quantidade': ev.quantidade !== null && ev.quantidade !== undefined ? ev.quantidade : '-',
      'Endereço': ev.endereco || '-',
      'Endereço Anterior': ev.enderecoAnterior || '-',
      'Novo Endereço': ev.novoEndereco || '-',
      'Nota Fiscal': ev.notaFiscal || '-',
      'Responsável': ev.responsavelNome || 'Não informado',
      'Código Responsável': ev.responsavelCodigo || '-',
      'Status': ev.status || '-',
      'Observações / Detalhes': ev.observacao || '-',
      'Unidade de Negócio': ev.unidadeNegocio || unidadeNegocio,
    }));

    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Auditoria_Produto');

    ws['!cols'] = [
      { wch: 5 },
      { wch: 20 },
      { wch: 26 },
      { wch: 35 },
      { wch: 18 },
      { wch: 12 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 24 },
      { wch: 16 },
      { wch: 20 },
      { wch: 35 },
      { wch: 16 },
    ];

    const dataHoje = new Date().toISOString().slice(0, 10);
    const nomeLimpo = produtoSelecionado.produto.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 25);
    XLSX.writeFile(wb, `PoliHub_Auditoria_${nomeLimpo}_${dataHoje}.xlsx`);
  };

  // Helper visual para ícones e cores de cada evento
  const renderVisualTipoEvento = (tipo: TipoEventoAuditoria) => {
    switch (tipo) {
      case 'RECEBIMENTO':
        return {
          icon: Inbox,
          corTexto: 'text-blue-400',
          corBg: 'bg-blue-500/10',
          corBorda: 'border-blue-500/30',
          labelBadge: 'Recebimento',
        };
      case 'CONFERENCIA_RECEBIMENTO':
        return {
          icon: CheckSquare,
          corTexto: 'text-purple-400',
          corBg: 'bg-purple-500/10',
          corBorda: 'border-purple-500/30',
          labelBadge: 'Conferência de Recebimento',
        };
      case 'ALOCACAO':
        return {
          icon: PackageCheck,
          corTexto: 'text-emerald-400',
          corBg: 'bg-emerald-500/10',
          corBorda: 'border-emerald-500/30',
          labelBadge: 'Alocação',
        };
      case 'ALTERACAO_ENDERECO':
        return {
          icon: ArrowRightLeft,
          corTexto: 'text-amber-400',
          corBg: 'bg-amber-500/10',
          corBorda: 'border-amber-500/30',
          labelBadge: 'Alteração de Endereço',
        };
      case 'CONTAGEM_INVENTARIO':
        return {
          icon: Layers,
          corTexto: 'text-sky-400',
          corBg: 'bg-sky-500/10',
          corBorda: 'border-sky-500/30',
          labelBadge: 'Contagem de Inventário',
        };
      case 'CORRECAO_CONTAGEM':
        return {
          icon: AlertTriangle,
          corTexto: 'text-rose-400',
          corBg: 'bg-rose-500/10',
          corBorda: 'border-rose-500/30',
          labelBadge: 'Correção de Contagem',
        };
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. CABEÇALHO DO MÓDULO AUDITORIA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 p-0.5 shadow-lg shadow-blue-900/40 flex items-center justify-center shrink-0">
            <SearchCode className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black text-white tracking-tight">
                Auditoria de Estoque
              </h1>
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {unidadeNegocio}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Rastreamento cronológico de movimentações, alocações e contagens em tabelas reais
            </p>
          </div>
        </div>


      </div>

      {/* 2. CAMPO DE PESQUISA DE PRODUTO (Item 3 da especificação) */}
      <div className="relative z-30">
        <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-sm space-y-2">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
            Pesquisar Produto para Auditoria
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="input-pesquisa-produto-auditoria"
              value={termoBusca}
              onChange={(e) => {
                setTermoBusca(e.target.value);
                if (produtoSelecionado && e.target.value !== produtoSelecionado.produto) {
                  setProdutoSelecionado(null);
                  setResumoAuditoria(null);
                }
              }}
              onFocus={() => {
                if (produtosSugeridos.length > 0) setDropdownAberto(true);
              }}
              placeholder="Digite ao menos 3 caracteres (nome do produto, código de barras ou fabricante)..."
              className="w-full pl-10 pr-10 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs sm:text-sm font-semibold focus:outline-none focus:border-blue-500 transition min-h-[48px]"
            />
            {termoBusca && (
              <button
                type="button"
                onClick={handleLimparSelecao}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-white absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center transition"
                title="Limpar pesquisa"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <span>
              {buscandoProdutos ? (
                <span className="text-blue-400 flex items-center gap-1.5 font-medium">
                  <RotateCcw className="w-3 h-3 animate-spin" /> Buscando catálogo no banco...
                </span>
              ) : termoBusca.length > 0 && termoBusca.length < 3 ? (
                <span className="text-amber-400 font-medium">
                  Digite mais {3 - termoBusca.length} caractere(s) para iniciar a pesquisa.
                </span>
              ) : produtoSelecionado ? (
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Produto selecionado para consulta
                </span>
              ) : (
                'Consultas de movimentação são disparadas somente após selecionar um produto.'
              )}
            </span>
          </div>

          {/* DROPDOWN DE RESULTADOS LIMITADOS (Mínimo 3 caracteres, limit 10) */}
          {dropdownAberto && produtosSugeridos.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-40 max-h-80 overflow-y-auto divide-y divide-slate-800/80">
              <div className="px-4 py-2 bg-slate-900 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Resultados encontrados ({produtosSugeridos.length})</span>
                <span>Selecione para auditar</span>
              </div>
              {produtosSugeridos.map((prod) => (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => handleSelecionarProduto(prod)}
                  className="w-full text-left p-3.5 hover:bg-slate-900 transition flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs sm:text-sm font-bold text-white group-hover:text-blue-400 transition truncate">
                      {prod.produto}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                      {prod.fabricante && <span>Fabr: {prod.fabricante}</span>}
                      {prod.codigo_barras && (
                        <span className="font-mono text-sky-400 flex items-center gap-1">
                          <Barcode className="w-3 h-3" /> {prod.codigo_barras}
                        </span>
                      )}
                      {prod.endereco && (
                        <span className="font-mono text-emerald-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {prod.endereco}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-xl bg-blue-600/10 text-blue-400 group-hover:bg-blue-600 group-hover:text-white border border-blue-500/30 text-xs font-bold transition shrink-0">
                    Selecionar
                  </span>
                </button>
              ))}
            </div>
          )}

          {dropdownAberto && termoBusca.length >= 3 && produtosSugeridos.length === 0 && !buscandoProdutos && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-slate-950 border border-slate-800 rounded-3xl p-4 text-center text-xs text-slate-400 z-40 shadow-xl">
              Nenhum produto cadastrado corresponde ao termo digitado.
            </div>
          )}
        </div>
      </div>

      {/* 3. RESUMO DO PRODUTO SELECIONADO & INDICADORES (Item 7 da especificação) */}
      {produtoSelecionado && (
        <div className="space-y-4 animate-fade-in">
          {/* Card Resumo do Produto */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Auditoria de Produto
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    Unidade: <strong className="text-slate-200">{unidadeNegocio}</strong>
                  </span>
                  <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5 text-blue-400" />
                    Período: <strong className="text-blue-300">{periodoFiltro.rotulo}</strong>
                  </span>
                </div>

                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  {produtoSelecionado.produto}
                </h2>

                <div className="flex items-center gap-4 text-xs text-slate-400 mt-2 flex-wrap">
                  {produtoSelecionado.fabricante && (
                    <span>
                      Fabricante: <strong className="text-slate-200">{produtoSelecionado.fabricante}</strong>
                    </span>
                  )}
                  {produtoSelecionado.codigo_barras && (
                    <span className="flex items-center gap-1 font-mono text-sky-400">
                      <Barcode className="w-3.5 h-3.5" />
                      EAN: {produtoSelecionado.codigo_barras}
                    </span>
                  )}
                  <span className="flex items-center gap-1 font-mono text-emerald-400">
                    <MapPin className="w-3.5 h-3.5" />
                    Endereço Atual:{' '}
                    <strong>{produtoSelecionado.endereco || 'Sem endereço cadastrado'}</strong>
                  </span>
                </div>
              </div>

              {/* Botão de Trocar Produto */}
              <div className="flex items-center gap-2 self-start lg:self-center">
                <button
                  type="button"
                  onClick={handleLimparSelecao}
                  className="px-3.5 py-2 rounded-2xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition"
                >
                  Trocar Produto
                </button>
              </div>
            </div>
          </div>

          {/* INDICADORES CALCULADOS (Sem consultas adicionais - Item 7) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {/* Total Geral */}
            <div className="p-3.5 rounded-2xl bg-blue-600/10 border border-blue-500/20 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider block">
                Total Geral
              </span>
              <div className="text-2xl font-black text-white mt-1">
                {carregandoAuditoria ? '-' : resumoAuditoria?.totalGeral ?? 0}
              </div>
              <span className="text-[10px] text-blue-400/80">Movimentações</span>
            </div>

            {/* Recebimentos */}
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Recebimentos
              </span>
              <div className="text-xl font-black text-white mt-1">
                {carregandoAuditoria ? '-' : resumoAuditoria?.totalRecebimentos ?? 0}
              </div>
              <span className="text-[10px] text-slate-500">Notas de entrada</span>
            </div>

            {/* Conferências */}
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                Conferências
              </span>
              <div className="text-xl font-black text-purple-300 mt-1">
                {carregandoAuditoria ? '-' : resumoAuditoria?.totalConferencias ?? 0}
              </div>
              <span className="text-[10px] text-purple-400/70">Conferências cegas</span>
            </div>

            {/* Alocações */}
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                Alocações
              </span>
              <div className="text-xl font-black text-emerald-300 mt-1">
                {carregandoAuditoria ? '-' : resumoAuditoria?.totalAlocacoes ?? 0}
              </div>
              <span className="text-[10px] text-emerald-400/70">Armazenagens</span>
            </div>

            {/* Alterações de Endereço */}
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                Alt. Endereço
              </span>
              <div className="text-xl font-black text-amber-300 mt-1 flex items-baseline gap-1.5 flex-wrap">
                <span>{carregandoAuditoria ? '-' : resumoAuditoria?.totalAlteracoesEndereco ?? 0}</span>
                {Boolean(resumoAuditoria?.totalAlteracoesPendentes) && (
                  <span className="text-[10px] font-bold text-rose-300 bg-rose-500/20 px-1.5 py-0.5 rounded-full border border-rose-500/30 animate-pulse">
                    {resumoAuditoria?.totalAlteracoesPendentes} pendente{resumoAuditoria?.totalAlteracoesPendentes === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-amber-400/70">
                {resumoAuditoria?.totalAlteracoesAvulsas ? `${resumoAuditoria.totalAlteracoesAvulsas} avulsa(s)` : 'Trocas de local'}
              </span>
            </div>

            {/* Contagens */}
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block">
                Contagens
              </span>
              <div className="text-xl font-black text-sky-300 mt-1">
                {carregandoAuditoria ? '-' : resumoAuditoria?.totalContagens ?? 0}
              </div>
              <span className="text-[10px] text-sky-400/70">Inventário físico</span>
            </div>

            {/* Correções */}
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">
                Correções
              </span>
              <div className="text-xl font-black text-rose-300 mt-1">
                {carregandoAuditoria ? '-' : resumoAuditoria?.totalCorrecoes ?? 0}
              </div>
              <span className="text-[10px] text-rose-400/70">Ajustes homologados</span>
            </div>
          </div>

          {/* 4. BARRA DE FILTROS DA AUDITORIA (Item 8 da especificação) */}
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 flex-wrap">
              {/* Filtro de Período (Chips) */}
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <span className="text-slate-400 font-bold mr-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Período:
                </span>
                {(['7d', '15d', '30d'] as PeriodoOpcao[]).map((p) => {
                  const rotulos = { '7d': '7 Dias', '15d': '15 Dias', '30d': '30 Dias (Padrão)' };
                  const ativo = periodoFiltro.tipo === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleTrocarPeriodo(p)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition min-h-[34px] ${
                        ativo
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                          : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {rotulos[p]}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handleTrocarPeriodo('personalizado')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition min-h-[34px] ${
                    periodoFiltro.tipo === 'personalizado'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Personalizado...
                </button>
              </div>

              {/* Botões de Ação Secundária: Ordenação & Exportação */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Alternador de Ordenação */}
                <button
                  type="button"
                  onClick={() => setOrdemDesc(!ordemDesc)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition min-h-[38px]"
                  title="Inverter ordenação cronológica"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-blue-400" />
                  <span>{ordemDesc ? 'Mais recente primeiro' : 'Mais antigo primeiro'}</span>
                </button>

                {/* Exportar Excel */}
                <button
                  type="button"
                  onClick={handleExportarExcel}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 text-xs font-bold transition min-h-[38px]"
                  title="Exportar dados da auditoria para planilha"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar Excel</span>
                </button>

                {/* Recarregar */}
                <button
                  type="button"
                  onClick={() => carregarHistorico(produtoSelecionado, periodoFiltro)}
                  className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
                  title="Recarregar movimentações"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${carregandoAuditoria ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Linha 2 de Filtros: Tipo de Movimentação & Colaborador */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
              {/* Filtro por Tipo de Movimentação */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  Tipo de Evento:
                </span>
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:outline-none focus:border-blue-500 min-h-[34px]"
                >
                  <option value="TODOS">Todas as movimentações ({resumoAuditoria?.totalGeral ?? 0})</option>
                  <option value="RECEBIMENTO">Recebimento ({resumoAuditoria?.totalRecebimentos ?? 0})</option>
                  <option value="CONFERENCIA_RECEBIMENTO">Conferência de Recebimento ({resumoAuditoria?.totalConferencias ?? 0})</option>
                  <option value="ALOCACAO">Alocação ({resumoAuditoria?.totalAlocacoes ?? 0})</option>
                  <option value="ALTERACAO_ENDERECO">Alteração de Endereço — Todas ({resumoAuditoria?.totalAlteracoesEndereco ?? 0})</option>
                  {Boolean(resumoAuditoria?.totalAlteracoesPendentes) && (
                    <option value="ALTERACAO_PENDENTE">
                      ⚠️ Apenas Alterações Pendentes ({resumoAuditoria?.totalAlteracoesPendentes})
                    </option>
                  )}
                  {Boolean(resumoAuditoria?.totalAlteracoesAvulsas) && (
                    <option value="ALTERACAO_AVULSA">
                      🔄 Apenas Alterações Avulsas ({resumoAuditoria?.totalAlteracoesAvulsas})
                    </option>
                  )}
                  <option value="CONTAGEM_INVENTARIO">Contagem de Inventário ({resumoAuditoria?.totalContagens ?? 0})</option>
                  <option value="CORRECAO_CONTAGEM">Correção de Contagem ({resumoAuditoria?.totalCorrecoes ?? 0})</option>
                </select>
              </div>

              {/* Filtro por Colaborador Responsável */}
              {colaboradoresDisponiveis.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium">Colaborador:</span>
                  <select
                    value={filtroColaborador}
                    onChange={(e) => setFiltroColaborador(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:outline-none focus:border-blue-500 min-h-[34px]"
                  >
                    <option value="TODOS">Todos os colaboradores</option>
                    {colaboradoresDisponiveis.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* 5. LINHA DO TEMPO CRONOLÓGICA (Itens 6, 12, 13, 14 da especificação) */}
          {carregandoAuditoria ? (
            <div className="p-12 text-center text-slate-500 bg-slate-900/50 border border-slate-800 rounded-3xl space-y-2">
              <RotateCcw className="w-6 h-6 animate-spin mx-auto text-blue-400" />
              <p className="text-xs font-semibold text-slate-300">
                Consultando tabelas operacionais no Supabase ({periodoFiltro.rotulo})...
              </p>
            </div>
          ) : eventosFiltrados.length === 0 ? (
            // PRODUTO SEM MOVIMENTAÇÕES NO PERÍODO (Item 13 da especificação)
            <div className="p-10 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-4">
              <div className="w-14 h-14 rounded-3xl bg-slate-800/80 flex items-center justify-center mx-auto text-slate-400">
                <Clock className="w-7 h-7" />
              </div>
              <div className="space-y-1.5 max-w-lg mx-auto">
                <h3 className="text-base font-bold text-white">
                  Nenhuma movimentação encontrada no período selecionado.
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  O produto foi localizado, mas não foram encontrados registros de movimentação para as datas consultadas ({periodoFiltro.rotulo}).
                </p>
              </div>

              {/* Ações para trocar período */}
              <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
                {periodoFiltro.tipo !== '30d' && (
                  <button
                    type="button"
                    onClick={() => handleTrocarPeriodo('30d')}
                    className="px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md"
                  >
                    Consultar Últimos 30 dias
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleTrocarPeriodo('personalizado')}
                  className="px-4 py-2 rounded-2xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition"
                >
                  Definir Período Personalizado
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 px-2">
                <span>
                  Exibindo <strong>{eventosFiltrados.length}</strong> movimentação(ões) cronológica(s)
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {ordemDesc ? 'Ordem: Mais recente primeiro' : 'Ordem: Mais antigo primeiro'}
                </span>
              </div>

              {/* LISTA DE CARDS DA LINHA DO TEMPO */}
              <div className="space-y-3">
                {eventosFiltrados.map((ev) => {
                  const visual = renderVisualTipoEvento(ev.tipo);
                  const Icon = visual.icon;
                  const dataFormatada = new Date(ev.dataHora).toLocaleDateString('pt-BR');
                  const horaFormatada = new Date(ev.dataHora).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={ev.id}
                      className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition shadow-sm space-y-3 relative overflow-hidden group"
                    >
                      {/* Topo do Evento */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-800/80">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Badge do Tipo de Evento */}
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${visual.corBg} ${visual.corTexto} ${visual.corBorda}`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {visual.labelBadge}
                          </span>

                          {/* Tag Avulsa */}
                          {ev.isAvulsa && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              Avulsa
                            </span>
                          )}

                          {/* Tag Pendente */}
                          {ev.isPendente ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                              Pendente
                            </span>
                          ) : ev.tipo === 'ALTERACAO_ENDERECO' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Confirmado
                            </span>
                          ) : null}

                          {/* Data e Hora */}
                          <span className="font-mono text-xs font-semibold text-slate-300 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            {dataFormatada} às {horaFormatada}
                          </span>
                        </div>

                        {/* Origem da Tabela / Referência */}
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                          {ev.notaFiscal && ev.notaFiscal !== 'Não informada' && (
                            <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-bold">
                              NF: {ev.notaFiscal}
                            </span>
                          )}
                          <span className="hidden sm:inline text-slate-600">
                            tabela: {ev.tabelaOrigem}
                          </span>
                        </div>
                      </div>

                      {/* Corpo do Evento com Dados Específicos */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        {/* 1. Produto e Quantidade */}
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-bold block">
                            Produto & Quantidade
                          </span>
                          <div className="font-semibold text-white mt-0.5 line-clamp-1" title={ev.produto}>
                            {ev.produto}
                          </div>
                          <div className="mt-1 flex items-center gap-2 font-mono">
                            {ev.quantidade !== null && ev.quantidade !== undefined ? (
                              <span className="font-black text-sky-300 text-sm">
                                {ev.quantidade} unid.
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[11px]">Qtd não informada</span>
                            )}
                            {ev.quantidadeAnterior !== null && ev.quantidadeAnterior !== undefined && (
                              <span className="text-[11px] text-slate-500">
                                (Anterior: {ev.quantidadeAnterior})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 2. Endereço / Deslocamento */}
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-bold block">
                            Endereço
                          </span>
                          {ev.tipo === 'ALTERACAO_ENDERECO' ? (
                            <div className="mt-0.5 text-xs font-mono space-y-0.5">
                              <div className="text-slate-400">
                                De:{' '}
                                <span className="font-bold text-amber-400">
                                  {ev.enderecoAnterior || 'Sem endereço'}
                                </span>
                              </div>
                              <div className="text-slate-200">
                                Para:{' '}
                                <span className="font-bold text-emerald-400">
                                  {ev.novoEndereco || 'Sem endereço'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-0.5 inline-flex items-center gap-1 font-mono font-bold text-slate-200 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
                              <MapPin className="w-3 h-3 text-sky-400" />
                              {ev.endereco || 'Endereço não informado'}
                            </div>
                          )}
                        </div>

                        {/* 3. Colaborador Responsável */}
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-bold block">
                            Colaborador Responsável
                          </span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
                              <User className="w-3 h-3" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-200 block truncate">
                                {ev.responsavelNome || 'Não informado'}
                              </span>
                              {ev.responsavelCodigo && (
                                <span className="text-[10px] font-mono text-slate-500 block">
                                  {ev.responsavelCodigo}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 4. Status / Observação */}
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-bold block">
                            Status & Ocorrências
                          </span>
                          <div className="mt-1">
                            {ev.status && (
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${
                                  ev.isPendente
                                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                                    : ev.tipo === 'ALTERACAO_ENDERECO'
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                    : 'bg-slate-950 border-slate-800 text-slate-300'
                                }`}
                              >
                                {ev.status}
                              </span>
                            )}
                            {ev.observacao && (
                              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2" title={ev.observacao}>
                                {ev.observacao}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. ESTADO INICIAL (Sem produto selecionado) */}
      {!produtoSelecionado && (
        <div className="p-8 sm:p-12 text-center bg-slate-900/50 border border-slate-800 rounded-3xl space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400">
            <Package className="w-8 h-8" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base sm:text-lg font-bold text-white">
              Selecione um Produto para Iniciar a Auditoria
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Digite ao menos 3 caracteres no campo de pesquisa acima. O PoliHub consolidará recebimentos, conferências, alocações, alterações de endereço e contagens dos últimos 30 dias.
            </p>
          </div>

          {/* Dica Operacional */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950 border border-slate-800 text-slate-400 text-xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Pesquise por nome, código interno ou bipe o código de barras</span>
          </div>
        </div>
      )}

      {/* MODAL: PERÍODO PERSONALIZADO */}
      {modalPeriodoPersonalizado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Período Personalizado</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalPeriodoPersonalizado(false)}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Data Inicial</label>
                <input
                  type="date"
                  value={customInicio}
                  onChange={(e) => setCustomInicio(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Data Final</label>
                <input
                  type="date"
                  value={customFim}
                  onChange={(e) => setCustomFim(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setModalPeriodoPersonalizado(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarPeriodoPersonalizado}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-900/30"
              >
                Aplicar Período
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SCRIPT SQL DE ÍNDICES */}
      <SqlScriptAuditoriaModal
        isOpen={modalSqlAberto}
        onClose={() => setModalSqlAberto(false)}
      />
    </div>
  );
};
