import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  User,
  MapPin,
  Package,
  Search,
  Upload,
  FileSpreadsheet,
  Check,
  X,
  Loader2,
  RotateCcw,
  History,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ItemListagemContagem, Usuario } from '../../types';
import { inventarioService } from '../../services/inventarioService';
import { getActiveUserUnit } from '../../services/sessionHelper';

interface RevisaoInventarioViewProps {
  currentUser: Usuario | null;
  onVoltar: () => void;
}

export const RevisaoInventarioView: React.FC<RevisaoInventarioViewProps> = ({
  currentUser,
  onVoltar,
}) => {
  const [itensRevisao, setItensRevisao] = useState<ItemListagemContagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [itemSelecionado, setItemSelecionado] = useState<ItemListagemContagem | null>(null);

  // Ações de Revisão
  const [modoAcao, setModoAcao] = useState<'nenhum' | 'confirmar_divergencia' | 'corrigir'>('nenhum');
  const [novaQuantidade, setNovaQuantidade] = useState<string>('');
  const [observacao, setObservacao] = useState<string>('');
  const [salvandoAcao, setSalvandoAcao] = useState(false);
  const [feedback, setFeedback] = useState<{ texto: string; erro?: boolean } | null>(null);

  // Modal de Importação de Histórico de Endereços
  const [modalImportarHistoricoOpen, setModalImportarHistoricoOpen] = useState(false);
  const [importandoHistorico, setImportandoHistorico] = useState(false);
  const [feedbackHistorico, setFeedbackHistorico] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const unidadeAtual = currentUser?.unidade_negocio || getActiveUserUnit() || 'Goiânia';

  const carregarItensRevisao = async () => {
    setLoading(true);
    try {
      const res = await inventarioService.listarContagens({
        status: 'revisar',
        page: 1,
        pageSize: 300,
        userRole: currentUser?.nivel || 'operador',
      });

      if (res.success && res.result?.data) {
        // Garantir que contenha apenas itens com status 'revisar'
        setItensRevisao(res.result.data.filter((i) => i.status === 'revisar'));
      }
    } catch (err) {
      console.error('Erro ao buscar itens de revisão:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarItensRevisao();
  }, [unidadeAtual]);

  const itensFiltrados = itensRevisao.filter((i) => {
    if (!busca.trim()) return true;
    const termo = busca.toLowerCase();
    return (
      i.produto.toLowerCase().includes(termo) ||
      i.endereco.toLowerCase().includes(termo) ||
      (i.contagem && i.contagem.toLowerCase().includes(termo))
    );
  });

  const handleAbrirItem = (item: ItemListagemContagem) => {
    setItemSelecionado(item);
    setModoAcao('nenhum');
    setNovaQuantidade(String(item.qtd_contada ?? item.qtd_disponivel));
    setObservacao('');
    setFeedback(null);
  };

  // 1. Confirmar Divergência
  const handleConfirmarDivergencia = async () => {
    if (!itemSelecionado) return;
    setSalvandoAcao(true);
    setFeedback(null);
    try {
      const res = await inventarioService.confirmarDivergenciaRevisao(
        itemSelecionado.id,
        currentUser?.id || currentUser?.codigo || 'usr-revisao',
        observacao.trim() || undefined
      );

      if (!res.success) {
        setFeedback({ texto: res.error || 'Erro ao confirmar divergência.', erro: true });
        return;
      }

      setFeedback({ texto: 'Divergência confirmada com sucesso! Status atualizado.' });
      setTimeout(() => {
        setItemSelecionado(null);
        setModoAcao('nenhum');
        carregarItensRevisao();
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro na confirmação.';
      setFeedback({ texto: msg, erro: true });
    } finally {
      setSalvandoAcao(false);
    }
  };

  // 2. Corrigir / Registrar 2ª contagem (status = 'revisada')
  const handleSalvarCorrecao = async () => {
    if (!itemSelecionado) return;
    const qtdNum = Number(novaQuantidade);
    if (isNaN(qtdNum) || qtdNum < 0) {
      setFeedback({ texto: 'Informe uma quantidade válida para a segunda contagem.', erro: true });
      return;
    }

    setSalvandoAcao(true);
    setFeedback(null);
    try {
      const res = await inventarioService.corrigirItemInventario(
        itemSelecionado.id,
        currentUser?.id || currentUser?.codigo || 'usr-revisao',
        qtdNum,
        observacao.trim() || undefined
      );

      if (!res.success) {
        setFeedback({ texto: res.error || 'Erro ao registrar segunda contagem.', erro: true });
        return;
      }

      setFeedback({
        texto: 'Segunda contagem gravada! Status atualizado para "revisada" preservando a 1ª contagem.',
      });
      setTimeout(() => {
        setItemSelecionado(null);
        setModoAcao('nenhum');
        carregarItensRevisao();
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao corrigir item.';
      setFeedback({ texto: msg, erro: true });
    } finally {
      setSalvandoAcao(false);
    }
  };

  // 3. Importar Histórico de Alterações de Endereço (XLSX / CSV)
  const handleUploadHistorico = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportandoHistorico(true);
    setFeedbackHistorico(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      if (rawRows.length < 2) {
        setFeedbackHistorico('Planilha vazia ou sem cabeçalho.');
        setImportandoHistorico(false);
        return;
      }

      const headers: string[] = (rawRows[0] || []).map((h: any) =>
        String(h || '').trim().toLowerCase()
      );

      const findIdx = (terms: string[]) =>
        headers.findIndex((h) => terms.some((t) => h.includes(t)));

      const colProduto = findIdx(['produto', 'prod', 'item', 'codigo']);
      const colAnt = findIdx(['anterior', 'antigo', 'origem', 'localização anterior', 'localizacao anterior']);
      const colNova = findIdx(['nova', 'novo', 'destino', 'localização nova', 'localizacao nova']);
      const colData = findIdx(['data', 'data de alteração', 'alteracao']);
      const colUser = findIdx(['usuario', 'usuário', 'responsavel']);
      const colUnid = findIdx(['unidade', 'filial']);

      if (colProduto === -1) {
        setFeedbackHistorico('Coluna "Produto" não encontrada.');
        setImportandoHistorico(false);
        return;
      }

      const registrosHistorico = [];
      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.length === 0) continue;

        const produto = String(row[colProduto] ?? '').trim();
        if (!produto) continue;

        registrosHistorico.push({
          produto,
          localizacao_anterior: colAnt !== -1 ? String(row[colAnt] ?? '').trim() : '—',
          localizacao_nova: colNova !== -1 ? String(row[colNova] ?? '').trim() : '—',
          data_alteracao: colData !== -1 && row[colData] ? String(row[colData]).trim() : new Date().toISOString(),
          usuario: colUser !== -1 && row[colUser] ? String(row[colUser]).trim() : currentUser?.nome || 'Sistema',
          unidade: colUnid !== -1 && row[colUnid] ? String(row[colUnid]).trim() : unidadeAtual,
        });
      }

      const res = await inventarioService.importarHistoricoAlteracoesEndereco(registrosHistorico);
      if (res.success) {
        setFeedbackHistorico(
          `Sucesso! ${registrosHistorico.length} alterações de endereço associadas ao histórico sem alterar endereços atuais.`
        );
        setTimeout(() => {
          setModalImportarHistoricoOpen(false);
          setFeedbackHistorico(null);
        }, 1800);
      } else {
        setFeedbackHistorico(res.error || 'Erro ao gravar histórico.');
      }
    } catch (err) {
      console.error('Erro ao ler planilha de histórico:', err);
      setFeedbackHistorico('Falha ao processar planilha.');
    } finally {
      setImportandoHistorico(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-24 md:pb-12 animate-in fade-in duration-200">
      {/* Top Header Mobile-First */}
      <div className="flex items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onVoltar}
            className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title="Voltar ao menu do inventário"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <h2 className="text-lg sm:text-xl font-black text-white">Revisão de Inventário</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                {itensRevisao.length} pendentes
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Foco mobile para segunda contagem de itens sinalizados para revisão pelo Gestor.
            </p>
          </div>
        </div>

        {/* Botão Importar Histórico de Endereços */}
        <button
          type="button"
          onClick={() => setModalImportarHistoricoOpen(true)}
          className="px-3.5 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-sky-300 border border-sky-500/20 flex items-center gap-1.5 transition cursor-pointer shrink-0"
        >
          <History className="w-4 h-4 text-sky-400" />
          <span className="hidden sm:inline">Importar Histórico</span>
          <span className="sm:hidden">Histórico</span>
        </button>
      </div>

      {/* Busca rápida */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por produto, endereço ou nome da contagem..."
          className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500 transition"
        />
      </div>

      {/* Lista de itens (Cards Mobile-First) */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 space-y-2">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-400" />
          <p className="text-xs">Buscando itens pendentes de revisão...</p>
        </div>
      ) : itensFiltrados.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-slate-900/60 border border-slate-800 space-y-2">
          <ShieldCheck className="w-12 h-12 mx-auto text-emerald-500/40" />
          <p className="text-sm font-bold text-white">Nenhum item em revisão</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {busca ? 'Nenhum resultado corresponde à busca.' : 'Não há contagens com status "revisar" no momento para sua unidade.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {itensFiltrados.map((item) => {
            const esperada = Number(item.qtd_disponivel) || 0;
            const contada = item.qtd_contada !== null ? Number(item.qtd_contada) : 0;
            const divergencia = contada - esperada;

            return (
              <div
                key={item.id}
                onClick={() => handleAbrirItem(item)}
                className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-900 transition-all text-left shadow-lg cursor-pointer group flex flex-col justify-between gap-3 active:scale-[0.99]"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-black text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20">
                      {item.endereco}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-md">
                      Status: Revisar
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition line-clamp-2">
                    {item.produto}
                  </h4>

                  {item.contagem && (
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                      Contagem: {item.contagem}
                    </span>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <div className="text-[11px] text-slate-400">
                      Esperada: <strong className="text-white font-mono">{esperada}</strong> | 1ª Contagem: <strong className="text-amber-300 font-mono">{contada}</strong>
                    </div>
                    <div className="text-[11px]">
                      Divergência: <strong className={`font-mono ${divergencia < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {divergencia > 0 ? `+${divergencia}` : divergencia} un
                      </strong>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DETALHE DO ITEM EM REVISÃO (Mobile-First) */}
      {itemSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-100 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Item em Revisão</h3>
                  <p className="text-xs text-amber-400 font-mono">Posição: {itemSelecionado.endereco}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setItemSelecionado(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Informações detalhadas do item */}
            <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500">Produto</span>
                <p className="text-sm font-bold text-white mt-0.5">{itemSelecionado.produto}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Conferente (1ª Contagem)</span>
                  <p className="text-xs font-semibold text-slate-300 mt-0.5">
                    {itemSelecionado.nome_usuario_contagem || itemSelecionado.usuario_id || 'Não informado'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Data da Contagem</span>
                  <p className="text-xs font-semibold text-slate-300 mt-0.5">
                    {itemSelecionado.data_contagem
                      ? new Date(itemSelecionado.data_contagem).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-center">
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Qtd Esperada</span>
                  <strong className="text-sm font-mono text-white">
                    {Number(itemSelecionado.qtd_disponivel) || 0}
                  </strong>
                </div>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">1ª Contagem</span>
                  <strong className="text-sm font-mono text-amber-300">
                    {itemSelecionado.qtd_contada !== null ? Number(itemSelecionado.qtd_contada) : 0}
                  </strong>
                </div>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Divergência</span>
                  {(() => {
                    const diff =
                      (itemSelecionado.qtd_contada !== null ? Number(itemSelecionado.qtd_contada) : 0) -
                      (Number(itemSelecionado.qtd_disponivel) || 0);
                    return (
                      <strong className={`text-sm font-mono ${diff < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {diff > 0 ? `+${diff}` : diff}
                      </strong>
                    );
                  })()}
                </div>
              </div>

              {itemSelecionado.observacao && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-amber-400">Observação do Gestor:</span>
                  <p className="text-xs text-amber-200 mt-0.5 italic">{itemSelecionado.observacao}</p>
                </div>
              )}
            </div>

            {/* Feedback de Ação */}
            {feedback && (
              <div
                className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
                  feedback.erro
                    ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                    : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                }`}
              >
                {feedback.erro ? (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                )}
                <span>{feedback.texto}</span>
              </div>
            )}

            {/* Área de Seleção de Ação */}
            {modoAcao === 'nenhum' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  id="btn-confirmar-divergencia-revisao"
                  onClick={() => setModoAcao('confirmar_divergencia')}
                  className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Confirmar Divergência</span>
                </button>

                <button
                  type="button"
                  id="btn-corrigir-revisao"
                  onClick={() => setModoAcao('corrigir')}
                  className="p-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Corrigir (2ª Contagem)</span>
                </button>
              </div>
            )}

            {/* Formulário: Confirmar Divergência */}
            {modoAcao === 'confirmar_divergencia' && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Confirmar divergência apurada
                </h4>
                <p className="text-[11px] text-slate-300">
                  Esta ação valida a divergência observada na 1ª contagem ({itemSelecionado.qtd_contada} un vs {itemSelecionado.qtd_disponivel} un esperada) e direciona o item para o fluxo de bloqueio/validação.
                </p>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Justificativa / Observação (Opcional)
                  </label>
                  <input
                    type="text"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="Ex: Divergência física conferida no endereço..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModoAcao('nenhum')}
                    disabled={salvandoAcao}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmarDivergencia}
                    disabled={salvandoAcao}
                    className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1"
                  >
                    {salvandoAcao ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Confirmar Definitivo</span>
                  </button>
                </div>
              </div>
            )}

            {/* Formulário: Corrigir / Registrar 2ª Contagem */}
            {modoAcao === 'corrigir' && (
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 space-y-3">
                <h4 className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4" />
                  Registrar 2ª Contagem Física (Status: Revisada)
                </h4>
                <p className="text-[11px] text-slate-300">
                  Informe a quantidade física recontada. Os dados da 1ª contagem ({itemSelecionado.qtd_contada} un) serão integralmente preservados no histórico.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Quantidade 2ª Contagem <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={novaQuantidade}
                      onChange={(e) => setNovaQuantidade(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Observação / Conferente
                    </label>
                    <input
                      type="text"
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                      placeholder="Ex: Recontado por colaborador..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModoAcao('nenhum')}
                    disabled={salvandoAcao}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleSalvarCorrecao}
                    disabled={salvandoAcao}
                    className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 shadow"
                  >
                    {salvandoAcao ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Salvar 2ª Contagem</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: IMPORTAR HISTÓRICO DE ALTERAÇÕES DE ENDEREÇO */}
      {modalImportarHistoricoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Importar Histórico de Endereços</h3>
                  <p className="text-[11px] text-slate-400">
                    Colunas: Produto, Localização Anterior, Localização Nova, Data de alteração, Usuário, Unidade
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalImportarHistoricoOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {feedbackHistorico && (
              <div className="p-3 rounded-2xl bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{feedbackHistorico}</span>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
              <p>
                Este recurso associa o histórico de alterações de endereços exportado do sistema externo para consulta de auditoria no modal do produto, sem alterar automaticamente as localizações físicas atuais.
              </p>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUploadHistorico}
              accept=".xlsx, .xls, .csv"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importandoHistorico}
              className="w-full py-4 px-4 rounded-2xl border-2 border-dashed border-slate-700 hover:border-sky-500/70 bg-slate-950/60 hover:bg-slate-950/90 text-center flex flex-col items-center justify-center gap-2 transition cursor-pointer"
            >
              <Upload className="w-6 h-6 text-sky-400" />
              <span className="text-xs font-bold text-white">
                {importandoHistorico ? 'Processando registros...' : 'Selecionar arquivo (.xlsx ou .csv)'}
              </span>
            </button>

            <div className="flex items-center justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setModalImportarHistoricoOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
