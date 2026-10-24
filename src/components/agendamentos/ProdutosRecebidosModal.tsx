import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Package,
  Plus,
  Trash2,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Lock,
  Calendar,
  FileText,
  Truck,
  Layers,
  Save,
  UserCheck,
  FileSpreadsheet,
  Printer,
} from 'lucide-react';
import { Agendamento, RecebimentoProduto, RegistroEndereco } from '../../types';
import { alocacaoService } from '../../services/alocacaoService';
import { enderecosService } from '../../services/enderecosService';
import { useAuth } from '../../context/AuthContext';
import { isUserGestor } from '../../lib/permissions';
import { ImportarExcelProdutosModal } from './ImportarExcelProdutosModal';
import { saoProdutosSemelhantes } from '../../utils/agrupamentoProdutos';
import { isProdutoImportadoExcel } from '../../services/recebimentoService';
import { ConfiguracaoEtiquetaProdutoAgendamentoModal } from '../impressao/ConfiguracaoEtiquetaProdutoAgendamentoModal';

interface ProdutosRecebidosModalProps {
  agendamento: Agendamento;
  onClose: () => void;
  onSuccess: () => void;
}

export const ProdutosRecebidosModal: React.FC<ProdutosRecebidosModalProps> = ({
  agendamento,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const isGestor = isUserGestor(user);

  const [enderecos, setEnderecos] = useState<RegistroEndereco[]>([]);
  const [produtosCadastrados, setProdutosCadastrados] = useState<RecebimentoProduto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importarExcelOpen, setImportarExcelOpen] = useState(false);
  const [isModalEtiquetasOpen, setIsModalEtiquetasOpen] = useState(false);

  // Produtos importados via Excel elegíveis para impressão de etiqueta
  const produtosExcel = useMemo(() => {
    return produtosCadastrados.filter((p) => isProdutoImportadoExcel(p));
  }, [produtosCadastrados]);

  // Form para novo produto recebido
  const [novoNomeProduto, setNovoNomeProduto] = useState('');
  const [novaQuantidade, setNovaQuantidade] = useState('');
  const [novoEndereco, setNovoEndereco] = useState('');

  // Itens em elaboração
  const [itensPendentes, setItensPendentes] = useState<
    Array<{
      produto: string;
      quantidade: number;
      endereco: string | null;
    }>
  >([]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const nfAtual = agendamento.nota_fiscal || agendamento.notaFiscal || '';
      const [listaEnd, prodsExistentes] = await Promise.all([
        enderecosService.listar({ status: 'ativos' }),
        alocacaoService.listarProdutosRecebidosPorAgendamento(agendamento.id, nfAtual),
      ]);
      setEnderecos(listaEnd);
      setProdutosCadastrados(prodsExistentes);
    } catch (err) {
      console.error('Erro ao carregar dados do recebimento:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [agendamento.id]);

  const handleAdicionarItemPendente = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGestor) {
      setError('Apenas usuários com perfil "gestor" podem cadastrar produtos recebidos.');
      return;
    }

    if (!novoNomeProduto.trim()) {
      setError('Informe a descrição ou código do produto.');
      return;
    }

    const qtd = Number(novaQuantidade);
    if (!qtd || qtd <= 0) {
      setError('Informe uma quantidade válida superior a zero.');
      return;
    }

    const nomeLimpo = novoNomeProduto.trim();
    const indexExistente = itensPendentes.findIndex((item) =>
      saoProdutosSemelhantes(item.produto, nomeLimpo)
    );

    if (indexExistente >= 0) {
      setItensPendentes((prev) => {
        const copia = [...prev];
        const atual = copia[indexExistente];
        copia[indexExistente] = {
          ...atual,
          quantidade: Number((atual.quantidade + qtd).toFixed(2)),
          endereco: atual.endereco || (novoEndereco.trim() || null),
        };
        return copia;
      });
    } else {
      setItensPendentes((prev) => [
        ...prev,
        {
          produto: nomeLimpo,
          quantidade: qtd,
          endereco: novoEndereco.trim() || null,
        },
      ]);
    }

    setNovoNomeProduto('');
    setNovaQuantidade('');
    setNovoEndereco('');
    setError(null);
  };

  const handleRemoverPendente = (index: number) => {
    setItensPendentes((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSalvarTodos = async () => {
    if (!isGestor) {
      setError('Permissão negada: Somente gestores podem salvar produtos recebidos.');
      return;
    }

    if (itensPendentes.length === 0) {
      setError('Adicione ao menos um produto antes de salvar.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await alocacaoService.cadastrarProdutosRecebimento({
        agendamento_id: agendamento.id,
        nota_fiscal: agendamento.notaFiscal || `NF-${agendamento.numero}`,
        data_recebimento: agendamento.dataAgendada || new Date().toISOString().slice(0, 10),
        produtos: itensPendentes,
        usuario_nivel: user?.nivel,
      });

      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar produtos recebidos.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Produtos Recebidos da Nota
              </h3>
              <p className="text-xs text-slate-400">
                Agendamento #{agendamento.numero} • {agendamento.fornecedor}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition min-h-[44px]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Dados do Agendamento */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nota Fiscal</span>
              <span className="font-mono font-bold text-white block mt-0.5 truncate">
                {agendamento.nota_fiscal || (agendamento as any).notaFiscal || 'Não informada'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Data</span>
              <span className="font-mono font-bold text-slate-300 block mt-0.5">
                {agendamento.data_prevista || agendamento.data || (agendamento as any).dataAgendada || '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Volumes</span>
              <span className="font-mono font-bold text-slate-300 block mt-0.5">
                {agendamento.volumes ?? (agendamento as any).quantidadeVolumes ?? 0} {agendamento.tipo_volumes || 'un'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Status Carga</span>
              <span className="font-bold text-emerald-400 block mt-0.5">
                {agendamento.status}
              </span>
            </div>
          </div>

          {/* Aviso de Permissão para Usuário Não Gestor */}
          {!isGestor && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <Lock className="w-4 h-4" />
                <span>Visualização Somente Leitura</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Somente usuários com nível de acesso <strong>gestor</strong> podem cadastrar e vincular produtos recebidos para disponibilização no módulo <strong>Alocação</strong>.
              </p>
            </div>
          )}

          {/* Formulário de Cadastro (Apenas Gestor) */}
          {isGestor && (
            <div className="space-y-3">
              {/* Barra de Ação Rápida — Excel */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Importação em Massa via Planilha</span>
                  </span>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Carregue a planilha Excel oficial da empresa para importar todos os produtos recebidos de uma vez.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setImportarExcelOpen(true)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition min-h-[40px] shrink-0"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Importar produtos pelo Excel</span>
                </button>
              </div>

              <form onSubmit={handleAdicionarItemPendente} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Adicionar Produto Recebido Manualmente
                </span>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-6">
                  <input
                    type="text"
                    value={novoNomeProduto}
                    onChange={(e) => setNovoNomeProduto(e.target.value)}
                    placeholder="Código e descrição do produto..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 min-h-[44px]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <input
                    type="number"
                    min="1"
                    value={novaQuantidade}
                    onChange={(e) => setNovaQuantidade(e.target.value)}
                    placeholder="Qtd un"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 min-h-[44px]"
                  />
                </div>

                <div className="sm:col-span-4">
                  <select
                    value={novoEndereco}
                    onChange={(e) => setNovoEndereco(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-blue-500 min-h-[44px]"
                  >
                    <option value="">Sem endereço (Alocar depois)</option>
                    {enderecos.map((end) => (
                      <option key={end.id} value={end.endereco}>
                        {end.endereco} {end.descricao ? `(${end.descricao})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400">
                  * O endereço pode ser definido posteriormente no módulo <strong>Alocação</strong>.
                </span>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition min-h-[40px]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Produto</span>
                </button>
              </div>
            </form>
          </div>
        )}

          {/* Produtos em Elaboração (Ainda não salvos) */}
          {itensPendentes.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                Itens a Confirmar ({itensPendentes.length})
              </span>
              <div className="space-y-1.5">
                {itensPendentes.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white truncate">{item.produto}</p>
                      <div className="flex items-center gap-2 text-slate-400 text-[11px] mt-0.5">
                        <span>Quantidade: <strong className="text-slate-200">{item.quantidade} un</strong></span>
                        <span>•</span>
                        <span>
                          Endereço: {item.endereco ? <strong className="text-sky-300 font-mono">{item.endereco}</strong> : 'Aguardando Alocação'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoverPendente(idx)}
                      className="p-2 text-slate-400 hover:text-rose-400 transition"
                      title="Remover item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Produtos Já Registrados no Banco */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Produtos Registrados no Sistema ({produtosCadastrados.length})
            </span>

            {loading ? (
              <div className="p-4 text-center text-xs text-slate-400">Carregando produtos...</div>
            ) : produtosCadastrados.length === 0 ? (
              <div className="p-4 text-center rounded-2xl bg-slate-950 border border-slate-800/80 text-xs text-slate-500">
                Nenhum produto cadastrado para este agendamento até o momento.
              </div>
            ) : (
              <div className="space-y-2">
                {produtosCadastrados.map((p) => {
                  const importadoExcel = isProdutoImportadoExcel(p);

                  return (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white truncate">{p.produto}</p>
                          {importadoExcel && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20 shrink-0">
                              Importado Excel
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 text-[11px] mt-0.5">
                          <span>Qtd: <strong className="text-slate-200">{p.quantidade} un</strong></span>
                          <span>•</span>
                          <span>
                            Endereço: {p.endereco ? <strong className="text-sky-300 font-mono">{p.endereco}</strong> : <span className="text-amber-400">Aguardando Alocação</span>}
                          </span>
                          <span>•</span>
                          <span>Saldo: <strong className="text-amber-400 font-mono">{p.saldo_final} un</strong></span>
                        </div>
                      </div>

                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono shrink-0">
                        Gravado
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Informação sobre produtos elegíveis para impressão */}
            {produtosExcel.length > 0 ? (
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                <strong className="text-emerald-400 font-semibold">{produtosExcel.length}</strong> {produtosExcel.length === 1 ? 'linha de produto importada' : 'linhas de produtos importadas'} via Excel.
              </span>
            ) : (
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                Nenhuma lista de produtos importada via Excel para este agendamento.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Botão de Impressão de Etiquetas Zebra:
                Sempre visível ao lado do botão Fechar, independente do status do agendamento ou do status do produto no recebimento.
                Única restrição: Quando não houver lista importada via Excel, permanece visível porém desabilitado (não clicável).
            */}
            <button
              type="button"
              disabled={produtosExcel.length === 0}
              onClick={() => {
                if (produtosExcel.length > 0) {
                  setIsModalEtiquetasOpen(true);
                }
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm min-h-[44px] ${
                produtosExcel.length > 0
                  ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/40 cursor-pointer active:scale-95'
                  : 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed opacity-60'
              }`}
              title={
                produtosExcel.length > 0
                  ? 'Imprimir todas as etiquetas dos produtos recebidos da nota de uma só vez'
                  : 'Nenhum produto importado via Excel disponível para impressão de etiqueta'
              }
            >
              <Printer className={`w-4 h-4 ${produtosExcel.length > 0 ? 'text-blue-400' : 'text-slate-500'}`} />
              <span>
                {produtosExcel.length > 0
                  ? `Imprimir Etiquetas da Nota (${produtosExcel.length})`
                  : 'Imprimir Etiquetas da Nota'}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition min-h-[44px]"
            >
              Fechar
            </button>

            {isGestor && itensPendentes.length > 0 && (
              <button
                type="button"
                disabled={saving}
                onClick={handleSalvarTodos}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition min-h-[44px]"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Gravando...' : `Salvar Produtos (${itensPendentes.length})`}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {importarExcelOpen && (
        <ImportarExcelProdutosModal
          agendamento={agendamento}
          onClose={() => setImportarExcelOpen(false)}
          onSuccess={(novosItens) => {
            setImportarExcelOpen(false);
            carregarDados();
            onSuccess();
          }}
        />
      )}

      {/* Modal de Impressão de Todas as Etiquetas Zebra dos Produtos da Nota Fiscal */}
      {isModalEtiquetasOpen && produtosExcel.length > 0 && (
        <ConfiguracaoEtiquetaProdutoAgendamentoModal
          produtos={produtosExcel}
          agendamento={agendamento}
          onClose={() => setIsModalEtiquetasOpen(false)}
        />
      )}
    </div>
  );
};
