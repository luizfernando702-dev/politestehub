import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  FileText,
  AlertCircle,
  Building2,
  Calendar,
  User,
  Layers,
  Loader2,
} from 'lucide-react';
import { ItemListagemContagem, Usuario } from '../../types';
import { inventarioService } from '../../services/inventarioService';
import { getActiveUserUnit } from '../../services/sessionHelper';

interface RomaneioContagemModalProps {
  currentUser: Usuario | null;
  contagemNome?: string;
  onClose: () => void;
}

export const RomaneioContagemModal: React.FC<RomaneioContagemModalProps> = ({
  currentUser,
  contagemNome,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [itens, setItens] = useState<ItemListagemContagem[]>([]);
  const [contagensDisponiveis, setContagensDisponiveis] = useState<string[]>([]);
  const [selectedContagem, setSelectedContagem] = useState<string>(contagemNome || '');
  const [erro, setErro] = useState<string | null>(null);

  const unidadeAtual = currentUser?.unidade_negocio || getActiveUserUnit() || 'Goiânia';
  const dataEmissaoFormatada = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Carregar contagens existentes e itens
  useEffect(() => {
    let isMounted = true;

    const carregarDados = async () => {
      setLoading(true);
      setErro(null);
      try {
        // Obter todas as contagens para listar no filtro
        const lista = await inventarioService.listarContagens({
          page: 1,
          pageSize: 500,
          userRole: 'gestor',
        });

        if (!isMounted) return;

        if (lista.success && lista.result?.data) {
          const todasContagens = Array.from(
            new Set(
              lista.result.data
                .map((d) => d.contagem)
                .filter((c): c is string => Boolean(c && c.trim() !== ''))
            )
          );
          setContagensDisponiveis(todasContagens);

          const alvoContagem = selectedContagem || todasContagens[0] || '';
          if (!selectedContagem && alvoContagem) {
            setSelectedContagem(alvoContagem);
          }

          // Filtrar somente itens com status 'contada' e divergência negativa (qtd_contada < qtd_disponivel)
          const filtrados = lista.result.data.filter((item) => {
            const mesmaContagem = !alvoContagem || item.contagem === alvoContagem;
            const statusContada = item.status === 'contada';
            const divergenciaNegativa =
              item.qtd_contada !== null &&
              item.qtd_contada !== undefined &&
              Number(item.qtd_contada) < Number(item.qtd_disponivel);

            return mesmaContagem && statusContada && divergenciaNegativa;
          });

          setItens(filtrados);
        }
      } catch (err) {
        console.error('Erro ao carregar itens para romaneio:', err);
        if (isMounted) setErro('Falha ao carregar itens para o romaneio.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    carregarDados();

    return () => {
      isMounted = false;
    };
  }, [selectedContagem, unidadeAtual]);

  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200">
      {/* Estilos específicos de impressão para A4 Retrato sem interface do app */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 10mm 15mm 10mm;
          }
          body * {
            visibility: hidden;
          }
          #area-impressao-romaneio,
          #area-impressao-romaneio * {
            visibility: visible;
          }
          #area-impressao-romaneio {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
          thead {
            display: table-header-group;
          }
          tr {
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-100 shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header da modal (oculto na impressão) */}
        <div className="no-print flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Gerar Romaneio de Contagem (A4)</h3>
              <p className="text-xs text-slate-400">
                Itens com divergência negativa e status <strong className="text-amber-400">contada</strong> para recontagem física em campo.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filtro de contagem e botão de impressão (ocultos na impressão) */}
        <div className="no-print my-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-300">Contagem:</label>
            <select
              value={selectedContagem}
              onChange={(e) => setSelectedContagem(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 focus:outline-hidden focus:border-amber-500"
            >
              <option value="">Todas as contagens</option>
              {contagensDisponiveis.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-400">
              ({itens.length} {itens.length === 1 ? 'item divergente' : 'itens divergentes'})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-imprimir-romaneio"
              onClick={handleImprimir}
              disabled={itens.length === 0 || loading}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-amber-600/30 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Romaneio (A4)</span>
            </button>
          </div>
        </div>

        {/* ÁREA DE PRÉVIA / IMPRESSÃO */}
        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-400" />
              <p className="text-xs">Localizando itens com divergência negativa...</p>
            </div>
          ) : erro ? (
            <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{erro}</span>
            </div>
          ) : itens.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <FileText className="w-12 h-12 mx-auto text-slate-600" />
              <p className="text-sm font-bold text-white">Nenhum item com divergência negativa</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Não foram encontrados itens com status "contada" e quantidade contada inferior à disponível para a contagem e unidade selecionadas.
              </p>
            </div>
          ) : (
            <div
              id="area-impressao-romaneio"
              className="bg-white text-slate-900 p-6 sm:p-8 rounded-2xl shadow-inner font-sans"
            >
              {/* CABEÇALHO DO ROMANEIO */}
              <div className="border-b-2 border-slate-900 pb-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-950">
                      ROMANEIO DE CONTAGEM
                    </h1>
                    <p className="text-xs font-bold text-slate-700 mt-0.5">
                      PoliHub &bull; Recontagem Física de Estoque (Divergências Negativas)
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-bold text-slate-900">
                      Unidade: <span className="font-mono">{unidadeAtual}</span>
                    </p>
                    <p className="text-slate-600 text-[11px]">
                      Emissão: {dataEmissaoFormatada}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-300 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Contagem</span>
                    <strong className="text-slate-900 font-mono text-[11px]">
                      {selectedContagem || 'Geral / Todas'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Responsável</span>
                    <strong className="text-slate-900 text-[11px]">
                      {currentUser?.nome || 'Gestor Logística'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Itens</span>
                    <strong className="text-slate-900 font-mono text-[11px]">{itens.length} posições</strong>
                  </div>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Colaborador / Conferente:
                    </span>
                    <span className="text-slate-400 italic text-[10px]">Assinatura / Nome</span>
                  </div>
                </div>
              </div>

              {/* TABELA DE RECONTAGEM */}
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-y-2 border-slate-900 bg-slate-100 text-[10px] uppercase font-black text-slate-800">
                    <th className="py-2 px-2 w-12 text-center">Item</th>
                    <th className="py-2 px-3">Produto (Código e Descrição)</th>
                    <th className="py-2 px-3 w-32 font-mono">Endereço</th>
                    <th className="py-2 px-3 w-40 text-center border-l-2 border-slate-900 bg-amber-50/60 font-black">
                      Nova Qtd Contada (Manual)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 text-xs">
                  {itens.map((it, idx) => (
                    <tr key={it.id} className="min-h-[38px]">
                      <td className="py-2.5 px-2 text-center font-mono text-slate-500 text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <strong className="text-slate-950 font-bold block">{it.produto}</strong>
                        {it.contagem && (
                          <span className="text-[10px] text-slate-500 block font-mono">
                            Ref: {it.contagem}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {it.endereco}
                      </td>
                      {/* Campo em branco econômico para anotação manual */}
                      <td className="py-2.5 px-3 border-l-2 border-slate-900 text-center bg-slate-50/30">
                        <div className="w-full h-8 border-b-2 border-dashed border-slate-400 mx-auto max-w-[120px]" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* RODAPÉ DO ROMANEIO */}
              <div className="mt-8 pt-4 border-t border-slate-400 text-[10px] text-slate-600 flex items-center justify-between">
                <span>PoliHub Inventário &bull; Documento Operacional de Conferência em Campo</span>
                <span>Página 1</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer da modal */}
        <div className="no-print pt-4 border-t border-slate-800 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
