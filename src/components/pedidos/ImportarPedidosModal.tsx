import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, Loader2, Info } from 'lucide-react';
import * as XLSX from 'xlsx';
import { pedidosService } from '../../services/pedidosService';
import { SeparacaoPedido } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { podeGerenciarPedidos } from '../../lib/permissions';

interface ImportarPedidosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportado: (novosPedidos: SeparacaoPedido[]) => void;
  unidadeNegocio: string;
}

export const ImportarPedidosModal: React.FC<ImportarPedidosModalProps> = ({
  isOpen,
  onClose,
  onImportado,
  unidadeNegocio,
}) => {
  const { user } = useAuth();
  const podeGerenciar = podeGerenciarPedidos(user);

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [linhasLidas, setLinhasLidas] = useState<any[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [carregandoArquivo, setCarregandoArquivo] = useState(false);
  const [processandoImportacao, setProcessandoImportacao] = useState(false);
  const [resultado, setResultado] = useState<{ sucesso: number; duplicados: number; erros: string[] } | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleArquivoSelecionado = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArquivo(file);
    setCarregandoArquivo(true);
    setErroGeral(null);
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
          setErroGeral('A planilha selecionada está vazia ou em formato incompatível.');
          setLinhasLidas([]);
          setPreview([]);
        } else {
          setLinhasLidas(data);
          setPreview(data.slice(0, 5));
        }
      } catch (err: any) {
        setErroGeral(`Erro ao ler arquivo Excel: ${err.message}`);
      } finally {
        setCarregandoArquivo(false);
      }
    };

    reader.onerror = () => {
      setErroGeral('Falha na leitura do arquivo local.');
      setCarregandoArquivo(false);
    };

    reader.readAsBinaryString(file);
  };

  const handleConfirmarImportacao = async () => {
    if (linhasLidas.length === 0) return;

    if (!podeGerenciar) {
      setErroGeral('Acesso restrito: Apenas usuários do Departamento de Logística têm permissão para importar pedidos.');
      return;
    }

    setProcessandoImportacao(true);
    setErroGeral(null);

    try {
      const res = await pedidosService.importarPedidosEmLote(linhasLidas, unidadeNegocio);
      setResultado({
        sucesso: res.sucesso,
        duplicados: res.duplicados,
        erros: res.erros,
      });

      if (res.sucesso > 0) {
        onImportado(res.pedidosInseridos);
      }
    } catch (err: any) {
      setErroGeral(err.message || 'Erro durante a importação.');
    } finally {
      setProcessandoImportacao(false);
    }
  };

  const handleLimpar = () => {
    setArquivo(null);
    setLinhasLidas([]);
    setPreview([]);
    setResultado(null);
    setErroGeral(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/60">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                Lote Excel
              </span>
              <span className="text-xs text-slate-400">Unidade: {unidadeNegocio}</span>
            </div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              <span>Importar Pedidos via Excel</span>
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
          {/* Instruções operacionais */}
          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 space-y-2">
            <div className="flex items-center gap-2 font-bold text-white">
              <Info className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Regra de Importação em Lote:</span>
            </div>
            <p className="text-slate-300">
              A importação traz <strong>somente os dados do pedido</strong> (id_pedido, data, codigo_controle, cliente, transportador, quantidade_itens).
              Os horários operacionais e colaboradores podem vir em branco para preenchimento posterior na tela de separação.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => pedidosService.baixarModeloExcelPedidos()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white font-bold text-[11px] border border-blue-500/40 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Planilha Modelo (.xlsx)</span>
              </button>
            </div>
          </div>

          {erroGeral && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Falha no processamento:</strong>
                <span>{erroGeral}</span>
              </div>
            </div>
          )}

          {/* Resultado de importação concluída */}
          {resultado && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Importação Concluída com Sucesso!</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs pt-2">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Pedidos Criados:</span>
                  <span className="text-lg font-extrabold text-emerald-400 font-mono">{resultado.sucesso}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Duplicados Ignorados:</span>
                  <span className="text-lg font-extrabold text-amber-400 font-mono">{resultado.duplicados}</span>
                </div>
              </div>
              {resultado.erros.length > 0 && (
                <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 max-h-32 overflow-y-auto">
                  <strong className="block mb-1">Avisos na validação de linhas:</strong>
                  {resultado.erros.map((err, i) => (
                    <div key={i}>• {err}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Upload Drop Area */}
          {!resultado && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleArquivoSelecionado}
                className="hidden"
                id="excel-file-pedidos"
              />

              <label
                htmlFor="excel-file-pedidos"
                className={`border-2 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition ${
                  arquivo
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-slate-700/80 hover:border-blue-500/50 bg-slate-950/40 hover:bg-slate-950/80'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                {arquivo ? (
                  <div>
                    <span className="text-xs font-bold text-white block">{arquivo.name}</span>
                    <span className="text-[11px] text-emerald-400 mt-1 block">
                      {linhasLidas.length} linha(s) identificada(s) &bull; Clique para trocar
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Clique aqui para selecionar o arquivo Excel
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Formatos suportados: .xlsx, .xls ou .csv
                    </span>
                  </div>
                )}
              </label>
            </div>
          )}

          {/* Pré-visualização das 5 primeiras linhas */}
          {preview.length > 0 && !resultado && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-300">
                  Pré-visualização dos primeiros registros ({preview.length} de {linhasLidas.length}):
                </span>
                <span className="text-[11px] text-slate-300">Campos identificados</span>
              </div>
              <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950">
                <table className="w-full text-left text-[11px] text-slate-300">
                  <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-2.5">ID Pedido</th>
                      <th className="p-2.5">Data</th>
                      <th className="p-2.5">Controle</th>
                      <th className="p-2.5">Cliente</th>
                      <th className="p-2.5">Transportador</th>
                      <th className="p-2.5 text-right">Qtd</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {preview.map((row, idx) => {
                      const id = row.id_pedido || row.pedido || row['ID Pedido'] || row['id'];
                      const dt = row.data || row['Data'] || '-';
                      const ctr = row.codigo_controle || row.controle || row['Código Controle'] || '-';
                      const cli = row.cliente || row['Cliente'] || '-';
                      const tra = row.transportador || row.transportadora || row['Transportador'] || '-';
                      const qtd = row.quantidade_itens || row.quantidade || row['Quantidade'] || row.qtd || 0;
                      return (
                        <tr key={idx} className="hover:bg-slate-900/50">
                          <td className="p-2.5 font-bold text-blue-400 font-mono">{String(id)}</td>
                          <td className="p-2.5">{String(dt)}</td>
                          <td className="p-2.5 font-mono">{String(ctr)}</td>
                          <td className="p-2.5 truncate max-w-[120px]">{String(cli)}</td>
                          <td className="p-2.5 truncate max-w-[120px]">{String(tra)}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-white">{String(qtd)}</td>
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
                Concluir e Ver Pedidos
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleLimpar}
                disabled={!arquivo}
                className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-30 transition"
              >
                Limpar
              </button>
              <div className="flex items-center gap-3">
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
                  disabled={linhasLidas.length === 0 || processandoImportacao}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition disabled:opacity-50 min-h-[44px]"
                >
                  {processandoImportacao ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processando {linhasLidas.length} pedidos...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Importar {linhasLidas.length > 0 ? `(${linhasLidas.length})` : ''}</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
