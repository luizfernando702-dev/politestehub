import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, Loader2, Info, ShieldAlert, Boxes } from 'lucide-react';
import * as XLSX from 'xlsx';
import { pedidosService } from '../../services/pedidosService';
import { ProdutoPedido, SeparacaoPedido } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { podeGerenciarPedidos } from '../../lib/permissions';

interface ImportarProdutosModalProps {
  isOpen: boolean;
  onClose: () => void;
  pedido: SeparacaoPedido | null;
  onImportado: (novosProdutos: ProdutoPedido[]) => void;
  pedidosDisponiveis?: SeparacaoPedido[];
}

export const ImportarProdutosModal: React.FC<ImportarProdutosModalProps> = ({
  isOpen,
  onClose,
  pedido,
  onImportado,
  pedidosDisponiveis = [],
}) => {
  const { user } = useAuth();
  const podeGerenciar = podeGerenciarPedidos(user);

  const [pedidoSelecionado, setPedidoSelecionado] = useState<SeparacaoPedido | null>(pedido);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [linhasLidas, setLinhasLidas] = useState<any[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [carregandoArquivo, setCarregandoArquivo] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<{ sucesso: number; erros: string[] } | null>(null);
  const [erroBloqueio, setErroBloqueio] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setPedidoSelecionado(pedido);
  }, [pedido]);

  if (!isOpen) return null;

  const handleArquivoSelecionado = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArquivo(file);
    setCarregandoArquivo(true);
    setErroBloqueio(null);
    setResultado(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!data || data.length === 0) {
          setErroBloqueio('A planilha está vazia ou em formato incompatível.');
          setLinhasLidas([]);
          setPreview([]);
        } else {
          setLinhasLidas(data);
          setPreview(data.slice(0, 5));
        }
      } catch (err: any) {
        setErroBloqueio(`Erro ao ler arquivo Excel: ${err.message}`);
      } finally {
        setCarregandoArquivo(false);
      }
    };

    reader.onerror = () => {
      setErroBloqueio('Falha na leitura do arquivo local.');
      setCarregandoArquivo(false);
    };

    reader.readAsBinaryString(file);
  };

  const handleConfirmarImportacao = async () => {
    if (!pedidoSelecionado) {
      setErroBloqueio(
        'BLOQUEIO DE IMPORTAÇÃO: Nenhum pedido foi selecionado. É obrigatório selecionar um pedido previamente cadastrado para importar os produtos.'
      );
      return;
    }

    if (!podeGerenciar) {
      setErroBloqueio(
        'Acesso restrito: Apenas usuários do Departamento de Logística têm permissão para importar produtos.'
      );
      return;
    }

    if (linhasLidas.length === 0) return;

    setProcessando(true);
    setErroBloqueio(null);

    try {
      const res = await pedidosService.importarProdutosDoPedidoEmLote(
        pedidoSelecionado.id,
        linhasLidas,
        pedidoSelecionado.id_pedido
      );

      setResultado({
        sucesso: res.sucesso,
        erros: res.erros,
      });

      if (res.sucesso > 0) {
        onImportado(res.produtosInseridos);
      }
    } catch (err: any) {
      // Bloqueio explícito com mensagem clara
      setErroBloqueio(err.message || 'Erro ao importar produtos para o pedido.');
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/60">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Itens do Pedido
              </span>
              {pedidoSelecionado && (
                <span className="text-xs text-blue-400 font-bold font-mono">
                  Pedido #{pedidoSelecionado.id_pedido}
                </span>
              )}
            </div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              <span>Importar Produtos via Excel</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Seletor de Pedido se nenhum estiver selecionado ou para conferência */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-blue-400" />
                <span>Pedido Vinculado (Obrigatório existir na Separação):</span>
              </label>
              {pedidoSelecionado && (
                <span className="text-[11px] text-emerald-400 font-semibold">
                  Pedido Verificado ✓
                </span>
              )}
            </div>

            {pedidoSelecionado ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-700/80 text-xs">
                <div>
                  <span className="font-extrabold text-blue-400 font-mono text-sm mr-2">
                    {pedidoSelecionado.id_pedido}
                  </span>
                  <span className="text-slate-300 font-bold">{pedidoSelecionado.cliente}</span>
                  <span className="text-slate-400 ml-2">({pedidoSelecionado.quantidade_itens} itens esperados)</span>
                </div>
              </div>
            ) : (
              <select
                value=""
                onChange={(e) => {
                  const achado = pedidosDisponiveis.find((p) => p.id === e.target.value);
                  if (achado) setPedidoSelecionado(achado);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-blue-500 min-h-[44px]"
              >
                <option value="">Selecione o pedido já cadastrado...</option>
                {pedidosDisponiveis.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id_pedido} — {p.cliente} ({p.quantidade_itens} itens)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Regra de Bloqueio Informativa */}
          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 space-y-2">
            <div className="flex items-center gap-2 font-bold text-white">
              <Info className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Regra de Vínculo com Pedido:</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Os produtos importados devem pertencer obrigatoriamente a um pedido existente. Se a planilha fizer referência a um pedido que não existe, a operação será bloqueada para preservar a integridade dos dados.
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={() =>
                  pedidosService.baixarModeloExcelProdutos(
                    pedidoSelecionado?.id_pedido || 'PED-10500'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white font-bold text-[11px] border border-blue-500/40 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Planilha Modelo de Produtos (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Alerta de Erro / Bloqueio */}
          {erroBloqueio && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-400">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <span>Importação Bloqueada:</span>
              </div>
              <p className="leading-relaxed">{erroBloqueio}</p>
            </div>
          )}

          {/* Resultado de Importação */}
          {resultado && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Produtos Importados com Sucesso!</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                <span className="text-slate-400 block text-[11px]">Itens Adicionados ao Pedido:</span>
                <span className="text-lg font-extrabold text-emerald-400 font-mono">{resultado.sucesso}</span>
              </div>
              {resultado.erros.length > 0 && (
                <div className="mt-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 max-h-32 overflow-y-auto">
                  <strong className="block mb-1">Avisos durante a importação:</strong>
                  {resultado.erros.map((e, idx) => (
                    <div key={idx}>• {e}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Upload Input Area */}
          {!resultado && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleArquivoSelecionado}
                className="hidden"
                id="excel-file-produtos"
              />

              <label
                htmlFor="excel-file-produtos"
                className={`border-2 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition ${
                  arquivo
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-slate-700/80 hover:border-emerald-500/50 bg-slate-950/40 hover:bg-slate-950/80'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                {arquivo ? (
                  <div>
                    <span className="text-xs font-bold text-white block">{arquivo.name}</span>
                    <span className="text-[11px] text-emerald-400 mt-1 block">
                      {linhasLidas.length} produto(s) identificado(s) &bull; Clique para trocar
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Clique para selecionar a planilha de produtos
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Formatos: .xlsx, .xls ou .csv (Colunas: codigo_barra, produto, locacao, quantidade, saldo)
                    </span>
                  </div>
                )}
              </label>
            </div>
          )}

          {/* Pré-visualização */}
          {preview.length > 0 && !resultado && (
            <div>
              <span className="text-xs font-bold text-slate-300 block mb-2">
                Pré-visualização dos itens ({preview.length} de {linhasLidas.length}):
              </span>
              <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950">
                <table className="w-full text-left text-[11px] text-slate-300">
                  <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-2.5">Cód. Barras</th>
                      <th className="p-2.5">Produto</th>
                      <th className="p-2.5">Locação</th>
                      <th className="p-2.5 text-right">Qtd</th>
                      <th className="p-2.5 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {preview.map((row, idx) => {
                      const cb = row.codigo_barra || row.codigo_barras || row.ean || '-';
                      const prod = row.produto || row.descricao || row.nome || '-';
                      const loc = row.locacao || row.endereco || '-';
                      const qtd = row.quantidade || row.qtd || 1;
                      const sld = row.saldo !== undefined ? row.saldo : qtd;
                      return (
                        <tr key={idx} className="hover:bg-slate-900/50">
                          <td className="p-2.5 font-mono text-slate-400">{String(cb)}</td>
                          <td className="p-2.5 font-bold text-white truncate max-w-[180px]">{String(prod)}</td>
                          <td className="p-2.5 font-mono text-sky-400">{String(loc)}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-white">{String(qtd)}</td>
                          <td className="p-2.5 text-right font-mono text-emerald-400">{String(sld)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/70">
          {resultado ? (
            <div className="flex justify-end w-full">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition min-h-[44px]"
              >
                Concluir e Ver Produtos
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-3 w-full">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition min-h-[44px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarImportacao}
                disabled={linhasLidas.length === 0 || processando || !pedidoSelecionado}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition disabled:opacity-50 min-h-[44px]"
              >
                {processando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Vinculando produtos...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Importar {linhasLidas.length > 0 ? `(${linhasLidas.length})` : ''}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
