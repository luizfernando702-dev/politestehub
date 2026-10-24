import React, { useMemo, useState } from 'react';
import {
  X,
  FileText,
  FileCode2,
  Lock,
  Building2,
  Truck,
  Layers,
  Calendar,
  Search,
  Copy,
  Check,
  Download,
  AlertTriangle,
  Upload,
  Trash2,
  ShieldCheck,
  Eye,
  Info,
} from 'lucide-react';
import { parseXmlNotaFiscal, DadosNotaXml } from '../../utils/xmlNotaParser';
import { Agendamento } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { isUserGestor, canUserUploadXmlAgendamento } from '../../lib/permissions';

interface VisualizarXmlNotaModalProps {
  xml: string;
  agendamento?: Agendamento | null;
  onClose: () => void;
  onSubstituirXml?: (novoXml: string) => Promise<void>;
  onRemoverXml?: () => Promise<void>;
}

export const VisualizarXmlNotaModal: React.FC<VisualizarXmlNotaModalProps> = ({
  xml,
  agendamento,
  onClose,
  onSubstituirXml,
  onRemoverXml,
}) => {
  const { user } = useAuth();
  const isGestor = isUserGestor(user);
  const podeSubirXml = canUserUploadXmlAgendamento(user);

  const [busca, setBusca] = useState('');
  const [copiadoChave, setCopiadoChave] = useState(false);
  const [copiadoLista, setCopiadoLista] = useState(false);
  const [removendo, setRemovendo] = useState(false);

  // Parse do XML
  const dados: DadosNotaXml = useMemo(() => {
    return parseXmlNotaFiscal(xml);
  }, [xml]);

  // Filtro de itens
  const itensFiltrados = useMemo(() => {
    if (!dados.itens) return [];
    if (!busca.trim()) return dados.itens;
    const t = busca.toLowerCase().trim();
    return dados.itens.filter(
      (item) =>
        item.descricao.toLowerCase().includes(t) ||
        item.codigo.toLowerCase().includes(t) ||
        (item.ean && item.ean.includes(t)) ||
        (item.ncm && item.ncm.includes(t))
    );
  }, [dados.itens, busca]);

  const handleCopiarChave = async () => {
    if (!isGestor || !dados.chaveAcesso) return;
    try {
      await navigator.clipboard.writeText(dados.chaveAcesso);
      setCopiadoChave(true);
      setTimeout(() => setCopiadoChave(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopiarLista = async () => {
    if (!dados.itens || dados.itens.length === 0) return;
    const texto = dados.itens
      .map((item) => `• ${item.quantidade}${item.unidade} - ${item.codigo} ${item.descricao}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(texto);
      setCopiadoLista(true);
      setTimeout(() => setCopiadoLista(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleDownloadXml = () => {
    try {
      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const nomeArquivo = `NF-${dados.numeroNota || agendamento?.nota_fiscal || 'eletronica'}.xml`;
      link.setAttribute('href', url);
      link.setAttribute('download', nomeArquivo);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Erro ao baixar XML:', e);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onSubstituirXml) return;
    try {
      const text = await file.text();
      await onSubstituirXml(text);
    } catch (err) {
      console.error('Erro ao substituir XML:', err);
    }
  };

  const handleRemover = async () => {
    if (!onRemoverXml) return;
    const confirm = window.confirm('Deseja realmente remover o XML anexado a esta nota fiscal?');
    if (!confirm) return;
    setRemovendo(true);
    try {
      await onRemoverXml();
      onClose();
    } catch (err) {
      console.error('Erro ao remover XML:', err);
    } finally {
      setRemovendo(false);
    }
  };

  const formatarChave = (chave?: string) => {
    if (!chave) return 'Não informada';
    return chave.replace(/(\d{4})/g, '$1 ').trim();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-5 sm:p-7 text-slate-100 my-auto max-h-[92vh] flex flex-col">
        {/* Cabeçalho do Modal */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800 gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                <FileCode2 className="w-3.5 h-3.5 text-emerald-400" />
                XML da Nota Fiscal (NF-e)
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                <Lock className="w-3 h-3 text-amber-400" />
                Custos e Chave Protegidos
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Espelho da Nota Fiscal {dados.numeroNota ? `Nº ${dados.numeroNota}` : agendamento?.nota_fiscal ? `Nº ${agendamento.nota_fiscal}` : ''}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Visualização estruturada do XML com produtos e quantidades originais.
            </p>
          </div>

          <button
            type="button"
            id="btn-close-xml-modal"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition min-h-[40px] min-w-[40px] flex items-center justify-center"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Banner de Proteção de Custos e Chave Fiscal */}
        <div className="mt-3 p-3 rounded-2xl bg-amber-950/40 border border-amber-600/30 flex items-center gap-3 shrink-0 text-xs text-amber-200">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div className="leading-snug">
            <span className="font-bold block text-amber-300">
              Valores Financeiros e Chave Fiscal Protegidos
            </span>
            <span>
              Para segurança e conformidade operacional, os custos de aquisição e a chave de acesso da NF-e são visualizados exclusivamente por usuários com perfil de Gestor.
            </span>
          </div>
        </div>

        {/* Área Rolável do Documento */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* Alerta de erro de parsing */}
          {!dados.valido && (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-600/30 text-rose-200 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-rose-300">
                <AlertTriangle className="w-4 h-4" />
                <span>Arquivo XML com formato atípico ou não reconhecido</span>
              </div>
              <p>{dados.erro || 'Não foi possível extrair a totalidade das tags padrão da NF-e.'}</p>
            </div>
          )}

          {/* Dados Gerais da NF-e */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Bloco 1: Identificação */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Identificação da NF-e
              </span>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Número da NF:</span>
                  <span className="font-mono font-bold text-white">{dados.numeroNota || agendamento?.nota_fiscal || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Série:</span>
                  <span className="font-mono text-slate-200">{dados.serie || '1'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Operação:</span>
                  <span className="font-semibold text-sky-400">{dados.tipoOperacao || 'Entrada'}</span>
                </div>
                {dados.dataEmissao && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Emissão:</span>
                    <span className="font-mono text-slate-300">{dados.dataEmissao.slice(0, 10)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bloco 2: Emitente / Fornecedor */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                Emitente / Fornecedor
              </span>
              <div className="space-y-1 text-xs">
                <div className="font-bold text-white truncate" title={dados.emitente?.razaoSocial}>
                  {dados.emitente?.razaoSocial || agendamento?.fornecedor || 'Não identificado'}
                </div>
                {dados.emitente?.cnpjCpf && (
                  <div className="text-[11px] text-slate-400 font-mono">
                    CNPJ: {dados.emitente.cnpjCpf}
                  </div>
                )}
                {dados.emitente?.municipio && (
                  <div className="text-[11px] text-slate-400">
                    {dados.emitente.municipio} - {dados.emitente.uf}
                  </div>
                )}
              </div>
            </div>

            {/* Bloco 3: Destinatário & Transporte */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-sky-400" />
                Transporte & Destino
              </span>
              <div className="space-y-1 text-xs">
                <div className="font-semibold text-slate-200 truncate" title={dados.transporte?.nome}>
                  Transp: {dados.transporte?.nome || agendamento?.transportadora || 'Não informada'}
                </div>
                <div className="text-slate-400 flex justify-between">
                  <span>Volumes declarados:</span>
                  <span className="font-bold text-white">
                    {dados.transporte?.volumes ?? agendamento?.volumes ?? '—'}
                  </span>
                </div>
                {dados.destinatario?.razaoSocial && (
                  <div className="text-[11px] text-slate-400 truncate" title={dados.destinatario.razaoSocial}>
                    Dest: {dados.destinatario.razaoSocial}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chave de Acesso - Exclusivo para Gestores */}
          {dados.chaveAcesso && (
            isGestor ? (
              <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Chave de Acesso (44 dígitos)
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30">
                      <ShieldCheck className="w-2.5 h-2.5 text-purple-400" />
                      Acesso Gestor
                    </span>
                  </div>
                  <span className="font-mono text-xs sm:text-[13px] text-sky-300 font-semibold tracking-wider break-all">
                    {formatarChave(dados.chaveAcesso)}
                  </span>
                </div>
                <button
                  type="button"
                  id="btn-copiar-chave-xml"
                  onClick={handleCopiarChave}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 self-start sm:self-center shrink-0 min-h-[36px]"
                >
                  {copiadoChave ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copiada!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Chave</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="bg-slate-950/50 border border-slate-800/70 rounded-2xl p-3 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                      Chave de Acesso (44 dígitos)
                    </span>
                    <span className="text-slate-400 font-mono tracking-wider select-none text-xs">
                      •••• •••• •••• •••• •••• •••• •••• •••• •••• •••• ••••
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-800 shrink-0">
                  Visível apenas para Gestores
                </span>
              </div>
            )
          )}

          {/* Seção de Produtos */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Itens e Produtos da Nota</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                    {dados.totalItens} {dados.totalItens === 1 ? 'item' : 'itens'}
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Somatória física: <strong>{dados.totalQuantidade.toLocaleString('pt-BR')}</strong> unidades/volumes
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    id="input-busca-produtos-xml"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por descrição ou código..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500 min-h-[36px]"
                  />
                </div>

                <button
                  type="button"
                  id="btn-copiar-lista-produtos-xml"
                  onClick={handleCopiarLista}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 shrink-0 min-h-[36px]"
                  title="Copiar lista de produtos com quantidades"
                >
                  {copiadoLista ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copiada!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Copiar Lista</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Tabela de Produtos */}
            <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950/80 shadow-inner">
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-bold sticky top-0 border-b border-slate-800 z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3 w-32">Código / SKU</th>
                      <th className="py-2.5 px-3">Descrição do Produto</th>
                      <th className="py-2.5 px-3 w-20 text-center">UN</th>
                      <th className="py-2.5 px-3 w-28 text-right">Quantidade</th>
                      <th className="py-2.5 px-3 w-32 text-center">Preço Unit.</th>
                      <th className="py-2.5 px-3 w-32 text-center">Total Item</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {itensFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          {busca
                            ? 'Nenhum item encontrado para o termo pesquisado.'
                            : 'Nenhum item de produto extraído deste XML.'}
                        </td>
                      </tr>
                    ) : (
                      itensFiltrados.map((item) => (
                        <tr key={item.numeroItem} className="hover:bg-slate-900/50 transition">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {item.numeroItem}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-sky-400">
                            {item.codigo}
                            {item.ncm && (
                              <span className="block text-[10px] text-slate-500 font-normal">
                                NCM: {item.ncm}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-white block">{item.descricao}</span>
                            {item.ean && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                EAN/GTIN: {item.ean}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-300 font-mono">
                            {item.unidade}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400 text-sm">
                            {item.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                          </td>
                          {/* Preço Unitário Mascarado */}
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-500 select-none"
                              title="Preço confidencial mascarado"
                            >
                              <Lock className="w-2.5 h-2.5 text-amber-500/70" />
                              ••••••
                            </span>
                          </td>
                          {/* Valor Total Mascarado */}
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-500 select-none"
                              title="Valor confidencial mascarado"
                            >
                              <Lock className="w-2.5 h-2.5 text-amber-500/70" />
                              ••••••
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Rodapé da Nota Fiscal (Totais Físicos e Financeiros Mascarados) */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Total de Itens</span>
                <span className="font-bold text-white text-base">{dados.totalItens} produtos</span>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Soma das Quantidades</span>
                <span className="font-bold text-emerald-400 text-base">
                  {dados.totalQuantidade.toLocaleString('pt-BR')} unidades
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                Valor Total da NF-e
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400 bg-amber-950/50 px-3 py-1 rounded-xl border border-amber-800/40">
                <Lock className="w-3 h-3 text-amber-400" />
                <span>R$ •••••• (Confidencial)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Barra de Ações Inferior */}
        <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            {podeSubirXml && (
              <button
                type="button"
                id="btn-baixar-xml-original"
                onClick={handleDownloadXml}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition min-h-[40px]"
                title="Baixar arquivo XML original"
              >
                <Download className="w-4 h-4" />
                <span>Baixar XML</span>
              </button>
            )}

            {podeSubirXml && onSubstituirXml && (
              <label
                htmlFor="input-substituir-xml-modal"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition min-h-[40px]"
                title="Substituir por outro arquivo XML"
              >
                <Upload className="w-4 h-4 text-sky-400" />
                <span>Substituir XML</span>
                <input
                  id="input-substituir-xml-modal"
                  type="file"
                  accept=".xml,text/xml,application/xml"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}

            {podeSubirXml && onRemoverXml && (
              <button
                type="button"
                id="btn-remover-xml-modal"
                disabled={removendo}
                onClick={handleRemover}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition min-h-[40px]"
                title="Remover anexo do XML"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Remover</span>
              </button>
            )}
          </div>

          <button
            type="button"
            id="btn-fechar-xml-modal"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold transition min-h-[40px]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
