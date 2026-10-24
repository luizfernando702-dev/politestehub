import React, { useState, useEffect } from 'react';
import { X, Clock, User, CheckCircle2, Loader2, Play, SquareCheck, Sparkles } from 'lucide-react';
import { SeparacaoPedido, Usuario } from '../../types';
import { usuariosService } from '../../services/usuariosService';
import { pedidosService, calcularDiferencaMinutos, formatarMinutos } from '../../services/pedidosService';
import { normalizarUnidadeNegocio } from '../../constants/unidades';
import { useAuth } from '../../context/AuthContext';
import { podeGerenciarPedidos } from '../../lib/permissions';

interface EdicaoRapidaOperacionalModalProps {
  isOpen: boolean;
  onClose: () => void;
  pedido: SeparacaoPedido | null;
  onAtualizado: (pedidoAtualizado: SeparacaoPedido) => void;
  unidadeNegocio: string;
}

export const EdicaoRapidaOperacionalModal: React.FC<EdicaoRapidaOperacionalModalProps> = ({
  isOpen,
  onClose,
  pedido,
  onAtualizado,
  unidadeNegocio,
}) => {
  const { user } = useAuth();
  const podeGerenciar = podeGerenciarPedidos(user);

  const [separadorId, setSeparadorId] = useState<string>('');
  const [horaInicialSeparacao, setHoraInicialSeparacao] = useState('');
  const [horaFinalSeparacao, setHoraFinalSeparacao] = useState('');

  const [conferenteId, setConferenteId] = useState<string>('');
  const [horaInicialConferencia, setHoraInicialConferencia] = useState('');
  const [horaFinalConferencia, setHoraFinalConferencia] = useState('');

  const [colaboradores, setColaboradores] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const carregarColaboradores = async () => {
      try {
        const targetUnit = normalizarUnidadeNegocio(unidadeNegocio);
        const todos = await usuariosService.listarTodos();
        const filtrados = todos.filter((u) => {
          const uUnit = normalizarUnidadeNegocio(u.unidade_negocio);
          const isAtivo = u.status === 'ativo' || u.status === 'aprovado' || !u.status;
          return uUnit === targetUnit && isAtivo;
        });
        setColaboradores(filtrados);
      } catch (err) {
        console.warn('Erro ao carregar colaboradores:', err);
      }
    };

    carregarColaboradores();
  }, [isOpen, unidadeNegocio]);

  useEffect(() => {
    if (pedido) {
      setSeparadorId(pedido.separador_id || '');
      setHoraInicialSeparacao(pedido.hora_inicial_separacao || '');
      setHoraFinalSeparacao(pedido.hora_final_separacao || '');
      setConferenteId(pedido.conferente_id || '');
      setHoraInicialConferencia(pedido.hora_inicial_conferencia || '');
      setHoraFinalConferencia(pedido.hora_final_conferencia || '');
    }
    setErro(null);
  }, [pedido, isOpen]);

  if (!isOpen || !pedido) return null;

  const obterHoraAtual = () => {
    const agora = new Date();
    const h = String(agora.getHours()).padStart(2, '0');
    const m = String(agora.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  const tempoSep = calcularDiferencaMinutos(horaInicialSeparacao, horaFinalSeparacao);
  const tempoConf = calcularDiferencaMinutos(horaInicialConferencia, horaFinalConferencia);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!podeGerenciar) {
      setErro('Acesso restrito: Apenas usuários do Departamento de Logística têm permissão para apontar e atualizar dados operacionais.');
      return;
    }

    setLoading(true);
    setErro(null);

    try {
      const sepEscolhido = colaboradores.find((c) => c.id === separadorId);
      const confEscolhido = colaboradores.find((c) => c.id === conferenteId);

      const atualizado = await pedidosService.atualizarDadosOperacionais(pedido.id, {
        separador_id: separadorId || null,
        hora_inicial_separacao: horaInicialSeparacao || null,
        hora_final_separacao: horaFinalSeparacao || null,
        conferente_id: conferenteId || null,
        hora_inicial_conferencia: horaInicialConferencia || null,
        hora_final_conferencia: horaFinalConferencia || null,
      });

      if (sepEscolhido) atualizado.separador_nome = sepEscolhido.nome;
      if (confEscolhido) atualizado.conferente_nome = confEscolhido.nome;

      onAtualizado(atualizado);
      onClose();
    } catch (err: any) {
      setErro(err.message || 'Erro ao registrar dados operacionais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/70">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Apontamento Rápido
              </span>
              <span className="text-xs text-slate-400">Separar & Conferir</span>
            </div>
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              Pedido <span className="text-blue-400 font-mono">#{pedido.id_pedido}</span>
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

        {/* Resumo do Pedido */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800/80 text-xs flex items-center justify-between">
          <div>
            <span className="text-slate-400">Cliente: </span>
            <span className="font-bold text-white">{pedido.cliente}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-400">Qtd: </span>
            <span className="font-bold text-blue-400 font-mono">{pedido.quantidade_itens} itens</span>
          </div>
        </div>

        <form onSubmit={handleSalvar} className="p-6 space-y-5">
          {erro && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              {erro}
            </div>
          )}

          {/* 1. SEPARAÇÃO */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-sky-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                <Play className="w-3.5 h-3.5" />
                <span>1. Processo de Separação</span>
              </div>
              {tempoSep !== null && (
                <span className="text-[11px] font-bold text-sky-300 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                  Duração: {formatarMinutos(tempoSep)}
                </span>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Separador Responsável ({unidadeNegocio})
              </label>
              <select
                value={separadorId}
                onChange={(e) => setSeparadorId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-sky-500 min-h-[40px]"
              >
                <option value="">Selecione o Separador...</option>
                {colaboradores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} ({c.funcao || 'Operador'})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-400">Início Separação</label>
                  <button
                    type="button"
                    onClick={() => setHoraInicialSeparacao(obterHoraAtual())}
                    className="text-[10px] font-bold text-sky-400 hover:text-sky-300 hover:underline"
                  >
                    Agora
                  </button>
                </div>
                <input
                  type="time"
                  value={horaInicialSeparacao}
                  onChange={(e) => setHoraInicialSeparacao(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-sky-500 min-h-[40px]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-400">Fim Separação</label>
                  <button
                    type="button"
                    onClick={() => setHoraFinalSeparacao(obterHoraAtual())}
                    className="text-[10px] font-bold text-sky-400 hover:text-sky-300 hover:underline"
                  >
                    Agora
                  </button>
                </div>
                <input
                  type="time"
                  value={horaFinalSeparacao}
                  onChange={(e) => setHoraFinalSeparacao(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-sky-500 min-h-[40px]"
                />
              </div>
            </div>
          </div>

          {/* 2. CONFERÊNCIA */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-indigo-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
                <SquareCheck className="w-3.5 h-3.5" />
                <span>2. Processo de Conferência</span>
              </div>
              {tempoConf !== null && (
                <span className="text-[11px] font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  Duração: {formatarMinutos(tempoConf)}
                </span>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Conferente Responsável ({unidadeNegocio})
              </label>
              <select
                value={conferenteId}
                onChange={(e) => setConferenteId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-indigo-500 min-h-[40px]"
              >
                <option value="">Selecione o Conferente...</option>
                {colaboradores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} ({c.funcao || 'Conferente'})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-400">Início Conferência</label>
                  <button
                    type="button"
                    onClick={() => setHoraInicialConferencia(obterHoraAtual())}
                    className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 hover:underline"
                  >
                    Agora
                  </button>
                </div>
                <input
                  type="time"
                  value={horaInicialConferencia}
                  onChange={(e) => setHoraInicialConferencia(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500 min-h-[40px]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-400">Fim Conferência</label>
                  <button
                    type="button"
                    onClick={() => setHoraFinalConferencia(obterHoraAtual())}
                    className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 hover:underline"
                  >
                    Agora
                  </button>
                </div>
                <input
                  type="time"
                  value={horaFinalConferencia}
                  onChange={(e) => setHoraFinalConferencia(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500 min-h-[40px]"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition disabled:opacity-50 min-h-[44px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Atualizando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Salvar Apontamento</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
