import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Check,
  FileText,
  Package,
  Layers,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Usuario } from '../../types';
import { inventarioService } from '../../services/inventarioService';
import { getActiveUserUnit } from '../../services/sessionHelper';

interface ImportarContagemModalProps {
  currentUser: Usuario | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface ItemPreviaImportacao {
  linha: number;
  produto: string;
  endereco: string;
  qtd_contada: number | null;
  qtd_disponivel: number;
  qtd_reservada: number;
  valido: boolean;
  erros: string[];
}

export const ImportarContagemModal: React.FC<ImportarContagemModalProps> = ({
  currentUser,
  onClose,
  onSuccess,
}) => {
  const [nomeContagem, setNomeContagem] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [itensPrevia, setItensPrevia] = useState<ItemPreviaImportacao[]>([]);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const unidadeAtual = currentUser?.unidade_negocio || getActiveUserUnit() || 'Goiânia';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArquivo(file);
    setErroGeral(null);
    setProcessando(true);
    setItensPrevia([]);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (rawRows.length < 2) {
        setErroGeral('A planilha está vazia ou contém apenas o cabeçalho.');
        setProcessando(false);
        return;
      }

      // Detectar cabeçalho
      const headers: string[] = (rawRows[0] || []).map((h: any) =>
        String(h || '').trim().toLowerCase()
      );

      const findColIdx = (keywords: string[]) =>
        headers.findIndex((h) => keywords.some((k) => h.includes(k)));

      const colProduto = findColIdx(['produto', 'prod', 'codigo', 'código', 'item', 'descri']);
      const colEndereco = findColIdx(['endereço', 'endereco', 'local', 'posicao', 'posição', 'rua']);
      const colContada = findColIdx(['contada', 'contado', 'fisica', 'física', 'qtd contada']);
      const colDisponivel = findColIdx(['disponivel', 'disponível', 'saldo', 'esperado', 'sistema']);
      const colReservada = findColIdx(['reservada', 'reservado', 'reserva']);

      if (colProduto === -1 || colEndereco === -1) {
        setErroGeral(
          'Colunas obrigatórias não encontradas. A planilha deve conter as colunas "Produto" e "Endereço".'
        );
        setProcessando(false);
        return;
      }

      const previa: ItemPreviaImportacao[] = [];
      const chavesVistas = new Set<string>();

      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.length === 0) continue;

        const produto = String(row[colProduto] ?? '').trim();
        const endereco = String(row[colEndereco] ?? '').trim().toUpperCase();

        if (!produto && !endereco) continue; // Linha vazia ignorada

        const erros: string[] = [];

        if (!produto) erros.push('Produto obrigatório.');
        if (!endereco) erros.push('Endereço obrigatório.');

        const rawContada = colContada !== -1 ? row[colContada] : null;
        let qtdContada: number | null = null;
        if (rawContada !== null && rawContada !== undefined && String(rawContada).trim() !== '') {
          const num = Number(rawContada);
          if (isNaN(num) || num < 0) erros.push('Qtd contada inválida.');
          else qtdContada = num;
        }

        const rawDisp = colDisponivel !== -1 ? row[colDisponivel] : 0;
        const qtdDisp = Number(rawDisp);
        if (isNaN(qtdDisp) || qtdDisp < 0) erros.push('Qtd disponível inválida.');

        const rawRes = colReservada !== -1 ? row[colReservada] : 0;
        const qtdRes = Number(rawRes);
        if (isNaN(qtdRes) || qtdRes < 0) erros.push('Qtd reservada inválida.');

        // Evitar duplicidade na mesma planilha (mesmo produto + endereço)
        const chaveDuplicidade = `${produto}|${endereco}`.toLowerCase();
        if (chavesVistas.has(chaveDuplicidade)) {
          erros.push('Registro duplicado nesta planilha.');
        } else {
          chavesVistas.add(chaveDuplicidade);
        }

        previa.push({
          linha: i + 1,
          produto,
          endereco,
          qtd_contada: qtdContada,
          qtd_disponivel: isNaN(qtdDisp) ? 0 : qtdDisp,
          qtd_reservada: isNaN(qtdRes) ? 0 : qtdRes,
          valido: erros.length === 0,
          erros,
        });
      }

      if (previa.length === 0) {
        setErroGeral('Nenhuma linha de dados válida encontrada para importação.');
      } else {
        setItensPrevia(previa);
      }
    } catch (err) {
      console.error('Erro ao ler planilha de inventário:', err);
      setErroGeral('Falha ao processar arquivo Excel. Verifique o formato do arquivo (.xlsx ou .xls).');
    } finally {
      setProcessando(false);
    }
  };

  const totalValidos = itensPrevia.filter((i) => i.valido).length;
  const totalErros = itensPrevia.filter((i) => !i.valido).length;

  const handleConfirmarImportacao = async () => {
    if (!nomeContagem.trim()) {
      setErroGeral('O campo "Nome da contagem" é obrigatório.');
      return;
    }

    if (totalValidos === 0) {
      setErroGeral('Não há registros válidos para importar.');
      return;
    }

    setSalvando(true);
    setErroGeral(null);

    try {
      const validos = itensPrevia.filter((i) => i.valido);
      const resultado = await inventarioService.importarContagemExcel({
        nomeContagem: nomeContagem.trim(),
        unidade: unidadeAtual,
        usuarioId: currentUser?.id || currentUser?.codigo || 'usr-importador',
        itens: validos.map((v) => ({
          produto: v.produto,
          endereco: v.endereco,
          qtd_contada: v.qtd_contada,
          qtd_disponivel: v.qtd_disponivel,
          qtd_reservada: v.qtd_reservada,
        })),
      });

      if (!resultado.success) {
        setErroGeral(resultado.error || 'Erro ao gravar registros no banco de dados.');
        return;
      }

      setSucesso(
        `Importação concluída com sucesso! ${validos.length} itens registrados com status "pendente" na contagem "${nomeContagem.trim()}".`
      );
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado na importação.';
      setErroGeral(msg);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl rounded-3xl bg-slate-900 border border-slate-800 p-6 text-slate-100 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Importar Contagem de Inventário</h3>
              <p className="text-xs text-slate-400">
                Planilha Excel (.xlsx, .xls) com validação e criação em lote (Status inicial: <strong className="text-amber-400">Pendente</strong>)
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

        {/* Mensagens de feedback */}
        {erroGeral && (
          <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{erroGeral}</span>
          </div>
        )}

        {sucesso && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 shrink-0">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{sucesso}</span>
          </div>
        )}

        {/* Formulário: Nome da contagem e Upload */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0">
          <div>
            <label className="text-xs font-bold text-slate-300 mb-1.5 block">
              Nome da Contagem <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              id="input-nome-contagem-importacao"
              value={nomeContagem}
              onChange={(e) => setNomeContagem(e.target.value)}
              placeholder="Ex: Contagem Geral Outubro 2026"
              className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Gravado na coluna <code className="text-sky-400">contagem</code> para rastreabilidade e romaneios.
            </span>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 mb-1.5 block">
              Unidade de Negócio
            </label>
            <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-slate-300 font-semibold flex items-center justify-between">
              <span>{unidadeAtual}</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Isolamento Ativo
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Os registros serão vinculados à unidade do usuário conectado.
            </span>
          </div>
        </div>

        {/* Área de Seleção de Arquivo */}
        <div className="shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls, .csv"
            className="hidden"
            id="input-arquivo-excel-contagem"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-blue-500/70 bg-slate-950/60 hover:bg-slate-950/90 rounded-2xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-105 transition">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white group-hover:text-blue-400 transition">
                {arquivo ? arquivo.name : 'Clique para selecionar a planilha Excel (.xlsx)'}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Colunas esperadas: <strong className="text-slate-300">Produto, Endereço, Quantidade contada, Disponível, Reservada</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Resumo e Prévia */}
        {processando ? (
          <div className="py-12 text-center text-slate-400 space-y-2 flex-1 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            <p className="text-xs">Validando linhas e estrutura da planilha...</p>
          </div>
        ) : itensPrevia.length > 0 ? (
          <div className="space-y-3 flex-1 flex flex-col min-h-0">
            {/* Resumo */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-slate-400">Total de Linhas: <strong className="text-white font-mono">{itensPrevia.length}</strong></span>
                <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {totalValidos} válidos
                </span>
                {totalErros > 0 && (
                  <span className="text-rose-400 flex items-center gap-1 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" /> {totalErros} com erro
                  </span>
                )}
              </div>
              <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                Itens serão importados como "pendente"
              </span>
            </div>

            {/* Tabela de prévia com scroll */}
            <div className="flex-1 overflow-y-auto border border-slate-800 rounded-2xl bg-slate-950/70">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Linha</th>
                    <th className="py-2 px-3">Produto</th>
                    <th className="py-2 px-3">Endereço</th>
                    <th className="py-2 px-3 text-right">Contada (Planilha)</th>
                    <th className="py-2 px-3 text-right">Disponível</th>
                    <th className="py-2 px-3 text-right">Reservada</th>
                    <th className="py-2 px-3 text-center">Status Validação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {itensPrevia.map((item, idx) => (
                    <tr
                      key={idx}
                      className={item.valido ? 'hover:bg-slate-900/50' : 'bg-rose-500/5 hover:bg-rose-500/10'}
                    >
                      <td className="py-2 px-3 font-mono text-slate-400">{item.linha}</td>
                      <td className="py-2 px-3 font-semibold text-white">{item.produto}</td>
                      <td className="py-2 px-3 font-mono text-sky-300">{item.endereco}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-300">
                        {item.qtd_contada !== null ? item.qtd_contada : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-300">{item.qtd_disponivel}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-400">{item.qtd_reservada}</td>
                      <td className="py-2 px-3 text-center">
                        {item.valido ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <Check className="w-3 h-3" /> Válido
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20"
                            title={item.erros.join(', ')}
                          >
                            <AlertCircle className="w-3 h-3" /> {item.erros[0]}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            id="btn-confirmar-importacao-excel"
            onClick={handleConfirmarImportacao}
            disabled={salvando || totalValidos === 0 || !nomeContagem.trim()}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-blue-600/30 cursor-pointer"
          >
            {salvando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Importando em lote...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Importar {totalValidos} Registros</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
