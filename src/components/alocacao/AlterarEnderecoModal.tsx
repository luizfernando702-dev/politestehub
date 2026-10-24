import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Package,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { RecebimentoProduto, RegistroEndereco } from '../../types';
import { enderecosService } from '../../services/enderecosService';
import { alocacaoService } from '../../services/alocacaoService';
import { useAuth } from '../../context/AuthContext';
import { useSessaoOperacional } from '../../context/SessaoOperacionalContext';
import { isEnderecoSemLocacao, formatarEnderecoDisplay, validarEnderecoDestino } from '../../lib/enderecos';

interface AlterarEnderecoModalProps {
  produto: RecebimentoProduto | { produto: string; endereco: string | null; id?: string | number; saldo_final?: number };
  onClose: () => void;
  onSuccess: (novoEndereco: string) => void;
  tipoAlteracao?: string;
}

export const AlterarEnderecoModal: React.FC<AlterarEnderecoModalProps> = ({
  produto,
  onClose,
  onSuccess,
  tipoAlteracao = 'Avulsa',
}) => {
  const { user } = useAuth();
  const { operador } = useSessaoOperacional();
  const [enderecos, setEnderecos] = useState<RegistroEndereco[]>([]);
  const [loadingEnderecos, setLoadingEnderecos] = useState(true);
  const [novoEndereco, setNovoEndereco] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtroEndereco, setFiltroEndereco] = useState('');

  const isOriginalSemLocacao = isEnderecoSemLocacao(produto.endereco);
  const enderecoAtualDisplay = formatarEnderecoDisplay(produto.endereco);

  useEffect(() => {
    async function carregarEnderecos() {
      try {
        setLoadingEnderecos(true);
        const lista = await enderecosService.listar({ status: 'ativos' });
        // Exclui qualquer registro fictício de Sem Locação da lista de destinos oficiais
        setEnderecos(lista.filter((item) => !isEnderecoSemLocacao(item.endereco)));
      } catch (err) {
        console.error('Erro ao carregar endereços oficiais:', err);
      } finally {
        setLoadingEnderecos(false);
      }
    }
    carregarEnderecos();
  }, []);

  const enderecosFiltrados = enderecos.filter((e) => {
    if (isEnderecoSemLocacao(e.endereco)) return false;
    if (!filtroEndereco.trim()) return true;
    const t = filtroEndereco.toLowerCase();
    return e.endereco.toLowerCase().includes(t) || (e.descricao && e.descricao.toLowerCase().includes(t));
  });

  const handleSalvar = async () => {
    if (!novoEndereco) {
      setError('Selecione um novo endereço oficial da lista.');
      return;
    }

    const validacao = validarEnderecoDestino(novoEndereco, 'avulsa');
    if (!validacao.valido) {
      setError(validacao.erro || 'Informe um endereço válido para realizar a alteração.');
      return;
    }

    if (!isOriginalSemLocacao && novoEndereco.trim().toUpperCase() === (produto.endereco || '').trim().toUpperCase()) {
      setError('O novo endereço deve ser diferente do endereço atual.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const usuarioId = operador?.id || user?.id || 'usr-default-01';
      const usuarioNome = operador?.nome || user?.nome || 'Operador';
      const usuarioCodigo = operador?.codigo || user?.codigo || 'OP';

      await alocacaoService.registrarAlteracaoEndereco({
        produtoId: produto.id,
        produto: produto.produto,
        enderecoAntigo: produto.endereco || 'Sem endereço',
        enderecoNovo: novoEndereco,
        usuarioId,
        usuarioNome,
        usuarioCodigo,
        tipoAlteracao: tipoAlteracao || 'Avulsa',
      });

      onSuccess(novoEndereco);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao registrar alteração de endereço.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Alterar Endereço
              </h3>
              <p className="text-xs text-slate-400">Solicitação de Alocação no Estoque</p>
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

          {/* Dados do Produto (Preenchidos automaticamente) */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Produto (Preenchido Automaticamente)
              </span>
              <div className="flex items-start gap-2 text-white font-medium text-sm">
                <Package className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span className="break-words">{produto.produto}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Endereço Atual
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono font-bold text-slate-300 truncate">
                    {enderecoAtualDisplay}
                  </span>
                  {isOriginalSemLocacao && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Sem Locação
                    </span>
                  )}
                </div>
              </div>
              {produto.saldo_final !== undefined && (
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Saldo a Alocar
                  </span>
                  <span className="font-bold text-amber-400 font-mono block mt-0.5">
                    {produto.saldo_final} un
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Seleção do Novo Endereço Oficial */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Novo Endereço Oficial <span className="text-rose-400">*</span>
            </label>
            <p className="text-[11px] text-slate-400">
              Selecione uma posição de armazenagem cadastrada no sistema.
            </p>

            <input
              type="text"
              value={filtroEndereco}
              onChange={(e) => setFiltroEndereco(e.target.value)}
              placeholder="Filtrar posições (ex: A-01, B-02...)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 min-h-[44px]"
            />

            {loadingEnderecos ? (
              <div className="p-4 text-center text-xs text-slate-400">Carregando endereços oficiais...</div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-2xl">
                {enderecosFiltrados.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">Nenhum endereço ativo encontrado.</div>
                ) : (
                  enderecosFiltrados.map((item) => {
                    const isSelected = novoEndereco === item.endereco;
                    const isCurrent = produto.endereco === item.endereco;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={isCurrent}
                        onClick={() => setNovoEndereco(item.endereco)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition min-h-[44px] ${
                          isCurrent
                            ? 'opacity-40 cursor-not-allowed bg-slate-900/50 text-slate-500'
                            : isSelected
                            ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                            : 'hover:bg-slate-800/80 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-sky-400'}`} />
                          <span className="font-mono font-bold">{item.endereco}</span>
                          {item.descricao && (
                            <span className={`text-[11px] truncate ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                              — {item.descricao}
                            </span>
                          )}
                        </div>
                        {isCurrent ? (
                          <span className="text-[10px] text-slate-500 uppercase font-semibold">Atual</span>
                        ) : isSelected ? (
                          <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Rastreabilidade e Regra de Validação */}
          <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-1.5">
            <div className="flex items-center gap-2 text-blue-300 font-bold">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>Rastreabilidade & Validação</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              O Polifiltro não altera automaticamente o sistema externo da empresa. Esta operação registrará uma solicitação na tabela <code className="text-sky-300 font-mono">alteracoes_endereco</code> com status <strong>Pendente</strong> (<code className="text-sky-300 font-mono">alterado_sistema = false</code>) para confirmação posterior do gestor.
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>Operador logado: <strong>{user?.nome}</strong> ({user?.codigo})</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition min-h-[44px]"
          >
            Cancelar
          </button>
          <button
            type="button"
            id="btn-confirmar-alterar-endereco"
            disabled={saving || !novoEndereco}
            onClick={handleSalvar}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            <span>{saving ? 'Registrando...' : 'REGISTRAR ALTERAÇÃO'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
