import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Package,
  MapPin,
  Calendar,
  User,
  ShieldCheck,
  Scale,
  Layers,
  ArrowRight,
  Loader2,
  Check,
  History,
  RotateCcw,
  Ban,
  Lock,
  Upload,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DetalheContagem, Usuario, HistoricoAlteracaoEndereco, InventarioStatus } from '../../types';
import { inventarioService, AuditoriaProdutoInventario } from '../../services/inventarioService';
import { usuariosService } from '../../services/usuariosService';

interface DetalhesContagemModalProps {
  item: DetalheContagem;
  currentUser: Usuario | null;
  onClose: () => void;
  onItemUpdated: (updatedItem: DetalheContagem) => void;
}

export const DetalhesContagemModal: React.FC<DetalhesContagemModalProps> = ({
  item,
  currentUser,
  onClose,
  onItemUpdated,
}) => {
  const [salvando, setSalvando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Modal para Invalidação com justificativa obrigatória
  const [modalInvalidarOpen, setModalInvalidarOpen] = useState(false);
  const [motivoInvalidacao, setMotivoInvalidacao] = useState('');

  // Auditoria do Produto
  const [auditoria, setAuditoria] = useState<AuditoriaProdutoInventario | null>(null);
  const [loadingAuditoria, setLoadingAuditoria] = useState(true);
  const [uploadingHistorico, setUploadingHistorico] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isGestor = currentUser?.nivel?.toLowerCase() === 'gestor';
  const isAssistente = currentUser?.nivel?.toLowerCase() === 'assistente';
  const podeAuditarContagens = isGestor || isAssistente;
  const currentStatus: InventarioStatus =
    (item.status as InventarioStatus) ||
    (item.corrigido
      ? 'validada'
      : item.qtd_contada !== null && item.qtd_contada !== undefined
      ? 'contada'
      : 'pendente');

  const qtdContada = item.qtd_contada !== null && item.qtd_contada !== undefined ? Number(item.qtd_contada) : null;
  const qtdDisponivel = Number(item.qtd_disponivel) || 0;
  const qtdAtual = item.qtd_atual !== null && item.qtd_atual !== undefined ? Number(item.qtd_atual) : null;
  const pesoTotal = item.peso_total !== null && item.peso_total !== undefined ? Number(item.peso_total) : null;
  const qtdReservada = item.qtd_reservada !== null && item.qtd_reservada !== undefined ? Number(item.qtd_reservada) : 0;

  const temContagem = qtdContada !== null;
  const temDivergencia = temContagem && qtdContada !== qtdDisponivel;
  const diferenca = temContagem ? qtdContada - qtdDisponivel : 0;

  // Carregar auditoria do produto
  useEffect(() => {
    let isMounted = true;
    const carregar = async () => {
      setLoadingAuditoria(true);
      try {
        const dados = await inventarioService.obterAuditoriaProduto(
          item.produto,
          item.unidade_negocio
        );
        if (isMounted) setAuditoria(dados);
      } catch (err) {
        console.warn('Erro ao carregar auditoria do produto:', err);
      } finally {
        if (isMounted) setLoadingAuditoria(false);
      }
    };
    carregar();
    return () => {
      isMounted = false;
    };
  }, [item.produto, item.unidade_negocio]);

  // Resolução amigável do nome do usuário da contagem
  const [nomeUsuarioContagem, setNomeUsuarioContagem] = useState<string>(() => {
    if (
      item.nome_usuario_contagem &&
      item.nome_usuario_contagem !== item.usuario_id &&
      !item.nome_usuario_contagem.startsWith('usr-')
    ) {
      return item.nome_usuario_contagem;
    }
    if (item.usuario_id === 'OP-1042' || item.usuario_id === 'usr-default-01') return 'Luiz Fernando';
    if (item.usuario_id === 'GS-2005' || item.usuario_id === 'usr-default-02') return 'Mariana Silva (Gestora)';
    return '';
  });

  const [codigoUsuarioContagem, setCodigoUsuarioContagem] = useState<string | undefined>(
    item.codigo_usuario_contagem || (item.usuario_id?.startsWith('OP-') || item.usuario_id?.startsWith('GS-') ? item.usuario_id : undefined)
  );

  useEffect(() => {
    let isMounted = true;
    const resolverNomeUsuario = async () => {
      if (item.nome_usuario_contagem && item.nome_usuario_contagem !== item.usuario_id && !item.nome_usuario_contagem.startsWith('usr-')) {
        if (isMounted) setNomeUsuarioContagem(item.nome_usuario_contagem);
        return;
      }
      if (currentUser && (currentUser.id === item.usuario_id || currentUser.codigo === item.usuario_id)) {
        if (isMounted) {
          setNomeUsuarioContagem(currentUser.nome);
          setCodigoUsuarioContagem(currentUser.codigo);
        }
        return;
      }
      if (item.usuario_id) {
        try {
          const todos = await usuariosService.listarTodos();
          const found = todos.find(
            (u) => u.id === item.usuario_id || u.codigo?.toUpperCase() === item.usuario_id?.toUpperCase()
          );
          if (found && isMounted) {
            setNomeUsuarioContagem(found.nome);
            setCodigoUsuarioContagem(found.codigo);
          }
        } catch {
          // fallback
        }
      }
    };
    resolverNomeUsuario();
    return () => {
      isMounted = false;
    };
  }, [item.usuario_id, item.nome_usuario_contagem, currentUser]);

  const formatarData = (dataStr?: string | null) => {
    if (!dataStr) return 'Sem registro disponível';
    try {
      const d = new Date(dataStr);
      if (isNaN(d.getTime())) return 'Sem registro disponível';
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Sem registro disponível';
    }
  };

  // Cores de status
  let statusBadgeClasses = 'bg-slate-800 text-slate-300 border-slate-700';
  let statusTexto = 'Pendente';
  if (currentStatus === 'contada') {
    statusBadgeClasses = 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    statusTexto = 'Contada (1ª vez)';
  } else if (currentStatus === 'revisar') {
    statusBadgeClasses = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    statusTexto = 'Em Revisão';
  } else if (currentStatus === 'revisada') {
    statusBadgeClasses = 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
    statusTexto = 'Revisada (2ª vez)';
  } else if (currentStatus === 'validada') {
    statusBadgeClasses = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    statusTexto = 'Validada';
  } else if (currentStatus === 'bloqueada') {
    statusBadgeClasses = 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    statusTexto = 'Bloqueada';
  } else if (currentStatus === 'invalidada') {
    statusBadgeClasses = 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40';
    statusTexto = 'Invalidada';
  }

  // 1. Ação: Solicitar Revisão
  const handleSolicitarRevisao = async () => {
    if (!podeAuditarContagens) return;
    setSalvando(true);
    setErro(null);
    try {
      const res = await inventarioService.solicitarRevisao(
        item.id,
        currentUser?.id || currentUser?.codigo || 'usr-gestor'
      );
      if (!res.success) {
        setErro(res.error || 'Erro ao solicitar revisão.');
        return;
      }
      setMensagemSucesso('Revisão solicitada com sucesso! Status alterado para "revisar".');
      const updated: DetalheContagem = { ...item, status: 'revisar' };
      onItemUpdated(updated);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Falha ao solicitar revisão.');
    } finally {
      setSalvando(false);
    }
  };

  // 2. Ação: Validar Divergência (sem ajuste necessário)
  const handleValidarDivergencia = async () => {
    if (!podeAuditarContagens) return;
    setSalvando(true);
    setErro(null);
    try {
      const res = await inventarioService.validarSobressalente(
        item.id,
        currentUser?.id || currentUser?.codigo || 'usr-gestor'
      );
      if (!res.success) {
        setErro(res.error || 'Erro ao validar divergência.');
        return;
      }
      setMensagemSucesso('Divergência validada com sucesso! Status alterado para "validada".');
      const updated: DetalheContagem = { ...item, status: 'validada', corrigido: true };
      onItemUpdated(updated);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Falha na validação.');
    } finally {
      setSalvando(false);
    }
  };

  // 3. Ação: Bloquear Estoque
  const handleBloquearEstoque = async () => {
    if (!podeAuditarContagens) return;
    setSalvando(true);
    setErro(null);
    try {
      const res = await inventarioService.confirmarDivergenciaRevisao(
        item.id,
        currentUser?.id || currentUser?.codigo || 'usr-gestor',
        'Bloqueio de estoque por divergência física apurada'
      );
      if (!res.success) {
        setErro(res.error || 'Erro ao bloquear item.');
        return;
      }
      setMensagemSucesso('Item bloqueado no estoque conforme fluxo operacional.');
      const updated: DetalheContagem = { ...item, status: 'bloqueada' };
      onItemUpdated(updated);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Falha ao bloquear.');
    } finally {
      setSalvando(false);
    }
  };

  // 4. Ação: Invalidar Contagem (com justificativa obrigatória)
  const handleConfirmarInvalidacao = async () => {
    if (!motivoInvalidacao.trim()) {
      setErro('Informe obrigatoriamente a justificativa para invalidação.');
      return;
    }
    if (!podeAuditarContagens) return;
    setSalvando(true);
    setErro(null);
    try {
      const res = await inventarioService.invalidarContagem(
        item.id,
        currentUser?.id || currentUser?.codigo || 'usr-gestor',
        motivoInvalidacao.trim()
      );
      if (!res.success) {
        setErro(res.error || 'Erro ao invalidar contagem.');
        return;
      }
      setMensagemSucesso('Contagem invalidada com justificativa gravada.');
      setModalInvalidarOpen(false);
      const updated: DetalheContagem = {
        ...item,
        status: 'invalidada',
        observacao: motivoInvalidacao.trim(),
      };
      onItemUpdated(updated);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Falha ao invalidar.');
    } finally {
      setSalvando(false);
    }
  };

  // 5. Upload de tabela de alteração de endereço externa (XML / XLSX / CSV)
  const handleUploadTabelaExterna = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingHistorico(true);
    setErro(null);

    try {
      let novasAlteracoes: HistoricoAlteracaoEndereco[] = [];

      if (file.name.endsWith('.xml')) {
        const text = await file.text();
        // Parse simplificado compatível com XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        const rows = xmlDoc.getElementsByTagName('registro');
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const prod = r.getElementsByTagName('produto')[0]?.textContent || item.produto;
          const ant = r.getElementsByTagName('localizacao_anterior')[0]?.textContent || '—';
          const nova = r.getElementsByTagName('localizacao_nova')[0]?.textContent || '—';
          const dt = r.getElementsByTagName('data')[0]?.textContent || new Date().toISOString();
          const usr = r.getElementsByTagName('usuario')[0]?.textContent || currentUser?.nome || 'Sistema';

          novasAlteracoes.push({
            produto: prod,
            localizacao_anterior: ant,
            localizacao_nova: nova,
            data_alteracao: dt,
            usuario: usr,
            unidade: item.unidade_negocio || 'Goiânia',
            contagem: item.contagem || undefined,
          });
        }
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length === 0) continue;
          novasAlteracoes.push({
            produto: item.produto,
            localizacao_anterior: String(row[1] || row[0] || '—').trim(),
            localizacao_nova: String(row[2] || row[1] || '—').trim(),
            data_alteracao: row[3] ? String(row[3]).trim() : new Date().toISOString(),
            usuario: row[4] ? String(row[4]).trim() : currentUser?.nome || 'Sistema',
            unidade: item.unidade_negocio || 'Goiânia',
            contagem: item.contagem || undefined,
          });
        }
      }

      if (novasAlteracoes.length > 0) {
        await inventarioService.importarHistoricoAlteracoesEndereco(novasAlteracoes);
        setMensagemSucesso(`${novasAlteracoes.length} registros de localização vinculados ao produto com sucesso!`);
        // Recarregar auditoria
        const dados = await inventarioService.obterAuditoriaProduto(item.produto, item.unidade_negocio);
        setAuditoria(dados);
      }
    } catch (err) {
      console.error('Erro ao ler tabela externa:', err);
      setErro('Falha ao processar tabela externa (XML/Excel).');
    } finally {
      setUploadingHistorico(false);
    }
  };

  return (
    <div
      id="modal-detalhes-contagem-overlay"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div
        id="modal-detalhes-contagem-container"
        className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                Auditoria & Gestão
              </span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusBadgeClasses}`}>
                Status: {statusTexto}
              </span>
              {item.contagem && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                  {item.contagem}
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Detalhes da Contagem
            </h2>
          </div>

          <button
            type="button"
            id="btn-fechar-detalhes-contagem"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {mensagemSucesso && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{mensagemSucesso}</span>
            </div>
          )}

          {erro && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* 1. Informações do Produto e Endereço */}
          <div className="rounded-2xl bg-slate-950/60 border border-slate-800 p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-4 h-4 text-sky-400" />
              <span>Informações do Produto</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <span className="text-[11px] text-slate-400 block font-medium">Produto / Descrição</span>
                <p className="text-sm font-bold text-white leading-snug mt-0.5">{item.produto}</p>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Endereço (Posição)</span>
                <p className="text-base font-black font-mono text-sky-400 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>{item.endereco}</span>
                </p>
              </div>
            </div>
          </div>

          {/* 2. AUDITORIA DO PRODUTO (Requisito 8) */}
          <div className="rounded-2xl bg-slate-950/60 border border-slate-800 p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Auditoria do Produto</span>
            </h3>

            {loadingAuditoria ? (
              <div className="py-4 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                <span>Consultando datas de auditoria...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Data do Último Recebimento
                  </span>
                  <p className="text-xs font-semibold text-white mt-1">
                    {formatarData(auditoria?.dataUltimoRecebimento)}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Data da Última Alteração de Endereço
                  </span>
                  <p className="text-xs font-semibold text-white mt-1">
                    {formatarData(auditoria?.dataUltimaAlteracaoEndereco)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 3. ALTERAÇÃO DE LOCALIZAÇÃO (Requisito 8: Produto, endereço anterior e novo, data, usuário, unidade e contagem) */}
          <div className="rounded-2xl bg-slate-950/60 border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-4 h-4 text-purple-400" />
                <span>Alteração de Localização (Histórico)</span>
              </h3>

              {podeAuditarContagens && (
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleUploadTabelaExterna}
                    accept=".xml, .xlsx, .csv"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingHistorico}
                    className="px-3 py-1 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingHistorico ? 'Processando...' : 'Subir Tabela Externa (XML)'}</span>
                  </button>
                </div>
              )}
            </div>

            {auditoria?.historicoAlteracoes && auditoria.historicoAlteracoes.length > 0 ? (
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="bg-slate-900 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                    <tr>
                      <th className="py-2 px-3">Endereço Anterior</th>
                      <th className="py-2 px-3">Endereço Novo</th>
                      <th className="py-2 px-3">Data Alteração</th>
                      <th className="py-2 px-3">Usuário</th>
                      <th className="py-2 px-3">Unidade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {auditoria.historicoAlteracoes.map((h, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="py-2 px-3 text-slate-400">{h.localizacao_anterior}</td>
                        <td className="py-2 px-3 font-bold text-sky-300">{h.localizacao_nova}</td>
                        <td className="py-2 px-3 text-slate-300 font-sans">{formatarData(h.data_alteracao)}</td>
                        <td className="py-2 px-3 text-slate-300 font-sans">{h.usuario}</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">{h.unidade || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic py-2">
                Sem registro disponível de alteração de endereço para este produto.
              </p>
            )}
          </div>

          {/* 4. Quadro Comparativo de Quantidades */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-sky-400" />
              <span>Conferência de Quantidades</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-medium">Qtd Disponível</span>
                <strong className="text-base sm:text-lg font-black font-mono text-white mt-1 block">
                  {qtdDisponivel}
                </strong>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-medium">Qtd Contada</span>
                <strong className="text-base sm:text-lg font-black font-mono text-white mt-1 block">
                  {temContagem ? qtdContada : '—'}
                </strong>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-medium">Divergência</span>
                <strong
                  className={`text-base sm:text-lg font-black font-mono mt-1 block ${
                    !temContagem
                      ? 'text-slate-500'
                      : diferenca === 0
                      ? 'text-emerald-400'
                      : diferenca < 0
                      ? 'text-rose-400'
                      : 'text-purple-400'
                  }`}
                >
                  {temContagem ? (diferenca > 0 ? `+${diferenca}` : `${diferenca}`) : '—'}
                </strong>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-medium">Qtd Reservada</span>
                <strong className="text-base sm:text-lg font-black font-mono text-slate-400 mt-1 block">
                  {qtdReservada}
                </strong>
              </div>
            </div>
          </div>

          {/* Observação / Motivo de Invalidação */}
          {item.observacao && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
              <span className="font-bold uppercase tracking-wider block text-[10px]">
                Observação / Justificativa Gravada:
              </span>
              <p className="text-xs text-amber-200 italic">{item.observacao}</p>
            </div>
          )}
        </div>

        {/* Footer com Ações de Transição de Status (Gestor) */}
        <div className="p-5 sm:p-6 border-t border-slate-800 bg-slate-950/50 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition cursor-pointer"
          >
            Fechar
          </button>

          {podeAuditarContagens && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Solicitar Revisão */}
              {currentStatus !== 'revisar' && currentStatus !== 'invalidada' && (
                <button
                  type="button"
                  id="btn-gestor-solicitar-revisao"
                  onClick={handleSolicitarRevisao}
                  disabled={salvando}
                  className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Solicitar Revisão</span>
                </button>
              )}

              {/* Validar Divergência (se sobra ou conferida) */}
              {currentStatus !== 'validada' && currentStatus !== 'invalidada' && (
                <button
                  type="button"
                  id="btn-gestor-validar"
                  onClick={handleValidarDivergencia}
                  disabled={salvando}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-emerald-600/20"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Validar</span>
                </button>
              )}

              {/* Bloquear Estoque (se falta) */}
              {diferenca < 0 && currentStatus !== 'bloqueada' && currentStatus !== 'invalidada' && (
                <button
                  type="button"
                  id="btn-gestor-bloquear"
                  onClick={handleBloquearEstoque}
                  disabled={salvando}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-rose-600/20"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Bloquear Estoque</span>
                </button>
              )}

              {/* Invalidar Contagem (com motivo obrigatório) */}
              {currentStatus !== 'invalidada' && (
                <button
                  type="button"
                  id="btn-gestor-invalidar"
                  onClick={() => {
                    setMotivoInvalidacao('');
                    setModalInvalidarOpen(true);
                  }}
                  disabled={salvando}
                  className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Invalidar</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL PARA JUSTIFICATIVA DE INVALIDAÇÃO */}
      {modalInvalidarOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-400">
              <Ban className="w-5 h-5" />
              <h3 className="text-base font-black text-white">Invalidar Contagem</h3>
            </div>
            <p className="text-xs text-slate-300">
              Informe a justificativa formal para invalidar esta contagem. O histórico e o usuário serão preservados na auditoria.
            </p>
            <div>
              <label className="text-xs font-bold text-slate-300 mb-1.5 block">
                Motivo da Invalidação <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={3}
                value={motivoInvalidacao}
                onChange={(e) => setMotivoInvalidacao(e.target.value)}
                placeholder="Ex: Posição física inacessível durante a conferência, necessário recontagem com escada..."
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-rose-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setModalInvalidarOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirmar-invalidacao-definitiva"
                onClick={handleConfirmarInvalidacao}
                disabled={!motivoInvalidacao.trim() || salvando}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5"
              >
                {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                <span>Confirmar Invalidação</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
