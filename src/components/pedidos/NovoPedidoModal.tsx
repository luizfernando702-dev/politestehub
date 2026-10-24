import React, { useState, useEffect } from 'react';
import { X, Save, Clock, User, Calendar, FileText, Building2, Truck, Hash, AlertCircle, Loader2 } from 'lucide-react';
import { SeparacaoPedido, Usuario } from '../../types';
import { usuariosService } from '../../services/usuariosService';
import { cadastrosService } from '../../services/cadastrosService';
import { pedidosService } from '../../services/pedidosService';
import { normalizarUnidadeNegocio } from '../../constants/unidades';
import { useAuth } from '../../context/AuthContext';
import { podeGerenciarPedidos } from '../../lib/permissions';

interface NovoPedidoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSalvo: (pedido: SeparacaoPedido) => void;
  pedidoParaEdicao?: SeparacaoPedido | null;
  unidadeNegocio: string;
}

export const NovoPedidoModal: React.FC<NovoPedidoModalProps> = ({
  isOpen,
  onClose,
  onSalvo,
  pedidoParaEdicao,
  unidadeNegocio,
}) => {
  const { user } = useAuth();
  const podeGerenciar = podeGerenciarPedidos(user);

  const [idPedido, setIdPedido] = useState('');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [codigoControle, setCodigoControle] = useState('');
  const [cliente, setCliente] = useState('');
  const [transportador, setTransportador] = useState('');
  const [quantidadeItens, setQuantidadeItens] = useState<number | ''>(1);

  // Operacional (Opcionais no momento do cadastro)
  const [separadorId, setSeparadorId] = useState<string>('');
  const [horaInicialSeparacao, setHoraInicialSeparacao] = useState('');
  const [horaFinalSeparacao, setHoraFinalSeparacao] = useState('');
  const [conferenteId, setConferenteId] = useState<string>('');
  const [horaInicialConferencia, setHoraInicialConferencia] = useState('');
  const [horaFinalConferencia, setHoraFinalConferencia] = useState('');

  const [colaboradores, setColaboradores] = useState<Usuario[]>([]);
  const [transportadorasSugeridas, setTransportadorasSugeridas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Carregar colaboradores pertencentes estritamente à unidade de negócio do pedido
  useEffect(() => {
    if (!isOpen) return;

    const carregarAuxiliares = async () => {
      try {
        const targetUnit = normalizarUnidadeNegocio(unidadeNegocio);
        const [todosUsuarios, listaTransp] = await Promise.all([
          usuariosService.listarTodos(),
          cadastrosService.listTransportadoras(),
        ]);

        // Filtrar colaboradores pertencentes à mesma unidade de negócio selecionada
        const filtrados = todosUsuarios.filter((u) => {
          const uUnit = normalizarUnidadeNegocio(u.unidade_negocio);
          const isAtivo = u.status === 'ativo' || u.status === 'aprovado' || !u.status;
          return uUnit === targetUnit && isAtivo;
        });

        setColaboradores(filtrados);
        setTransportadorasSugeridas(listaTransp.map((t) => t.nome_fantasia || t.razao_social));
      } catch (err) {
        console.warn('Erro ao carregar dados auxiliares para modal de pedido:', err);
      }
    };

    carregarAuxiliares();
  }, [isOpen, unidadeNegocio]);

  // Preencher dados ao editar
  useEffect(() => {
    if (pedidoParaEdicao) {
      setIdPedido(pedidoParaEdicao.id_pedido || '');
      setData(pedidoParaEdicao.data || new Date().toISOString().split('T')[0]);
      setCodigoControle(pedidoParaEdicao.codigo_controle || '');
      setCliente(pedidoParaEdicao.cliente || '');
      setTransportador(pedidoParaEdicao.transportador || '');
      setQuantidadeItens(pedidoParaEdicao.quantidade_itens || 0);
      setSeparadorId(pedidoParaEdicao.separador_id || '');
      setHoraInicialSeparacao(pedidoParaEdicao.hora_inicial_separacao || '');
      setHoraFinalSeparacao(pedidoParaEdicao.hora_final_separacao || '');
      setConferenteId(pedidoParaEdicao.conferente_id || '');
      setHoraInicialConferencia(pedidoParaEdicao.hora_inicial_conferencia || '');
      setHoraFinalConferencia(pedidoParaEdicao.hora_final_conferencia || '');
    } else {
      setIdPedido('');
      setData(new Date().toISOString().split('T')[0]);
      setCodigoControle('');
      setCliente('');
      setTransportador('');
      setQuantidadeItens(1);
      setSeparadorId('');
      setHoraInicialSeparacao('');
      setHoraFinalSeparacao('');
      setConferenteId('');
      setHoraInicialConferencia('');
      setHoraFinalConferencia('');
    }
    setErro(null);
  }, [pedidoParaEdicao, isOpen]);

  if (!isOpen) return null;

  const obterHoraAtualFormatada = () => {
    const agora = new Date();
    const h = String(agora.getHours()).padStart(2, '0');
    const m = String(agora.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!podeGerenciar) {
      setErro('Acesso restrito: Apenas usuários do Departamento de Logística têm permissão para cadastrar ou editar pedidos.');
      return;
    }

    const idLimpo = idPedido.trim();
    if (!idLimpo) {
      setErro('A identificação do pedido (ID Pedido) é obrigatória.');
      return;
    }

    if (!cliente.trim()) {
      setErro('O nome do cliente é obrigatório.');
      return;
    }

    if (!transportador.trim()) {
      setErro('A transportadora é obrigatória.');
      return;
    }

    setLoading(true);

    try {
      const sepEscolhido = colaboradores.find((c) => c.id === separadorId);
      const confEscolhido = colaboradores.find((c) => c.id === conferenteId);

      const payload = {
        id_pedido: idLimpo,
        unidade_negocio: normalizarUnidadeNegocio(unidadeNegocio),
        data: data || new Date().toISOString().split('T')[0],
        codigo_controle: codigoControle.trim(),
        cliente: cliente.trim(),
        transportador: transportador.trim(),
        quantidade_itens: typeof quantidadeItens === 'number' ? quantidadeItens : 0,
        separador_id: separadorId ? separadorId : null,
        separador_nome: sepEscolhido ? sepEscolhido.nome : null,
        hora_inicial_separacao: horaInicialSeparacao || null,
        hora_final_separacao: horaFinalSeparacao || null,
        conferente_id: conferenteId ? conferenteId : null,
        conferente_nome: confEscolhido ? confEscolhido.nome : null,
        hora_inicial_conferencia: horaInicialConferencia || null,
        hora_final_conferencia: horaFinalConferencia || null,
      };

      let salvo: SeparacaoPedido;
      if (pedidoParaEdicao) {
        salvo = await pedidosService.atualizarPedido(pedidoParaEdicao.id, payload);
      } else {
        salvo = await pedidosService.criarPedido(payload);
      }

      onSalvo(salvo);
      onClose();
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar pedido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/60">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                {unidadeNegocio}
              </span>
              <span className="text-xs text-slate-400">Separação de Pedidos</span>
            </div>
            <h2 className="text-xl font-extrabold text-white">
              {pedidoParaEdicao ? `Editar Pedido #${pedidoParaEdicao.id_pedido}` : '+ Novo Pedido para Separação'}
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

        {/* Form Body */}
        <form onSubmit={handleSalvar} className="p-6 space-y-6">
          {erro && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <strong className="block font-bold">Atenção ao cadastrar:</strong>
                <span>{erro}</span>
              </div>
            </div>
          )}

          {/* DADOS PRINCIPAIS DO PEDIDO */}
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>Dados do Pedido (Obrigatórios)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  ID do Pedido *
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={idPedido}
                    onChange={(e) => setIdPedido(e.target.value)}
                    placeholder="Ex: PED-10520 ou 10520"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:border-blue-500 min-h-[44px]"
                  />
                </div>
                <span className="text-[10px] text-slate-300 mt-1 block">
                  Identificador único nesta unidade.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Data do Pedido *
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    required
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-xs font-semibold focus:outline-none focus:border-blue-500 min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Código de Controle Operacional
                </label>
                <input
                  type="text"
                  value={codigoControle}
                  onChange={(e) => setCodigoControle(e.target.value)}
                  placeholder="Ex: CTR-9402 ou Lote A"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:border-blue-500 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Quantidade de Itens do Pedido *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={quantidadeItens}
                  onChange={(e) => setQuantidadeItens(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Ex: 48"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:border-blue-500 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Nome do Cliente *
                </label>
                <input
                  type="text"
                  required
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="Ex: Auto Peças Central Goiânia"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:border-blue-500 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Transportador Responsável *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    list="lista-transportadoras-pedidos"
                    value={transportador}
                    onChange={(e) => setTransportador(e.target.value)}
                    placeholder="Ex: Braspress, Jadlog..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:border-blue-500 min-h-[44px]"
                  />
                  <datalist id="lista-transportadoras-pedidos">
                    {transportadorasSugeridas.map((t, idx) => (
                      <option key={idx} value={t} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>
          </div>

          {/* DADOS OPERACIONAIS DE SEPARAÇÃO E CONFERÊNCIA */}
          <div className="pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Horários & Colaboradores (Opcionais no Cadastro)</span>
              </h3>
              <span className="text-[11px] text-slate-300">
                Pode ser preenchido posteriormente
              </span>
            </div>

            {/* SEÇÃO SEPARADOR */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3 mb-4">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                <User className="w-4 h-4" />
                <span>1. Processo de Separação</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Separador ({unidadeNegocio})
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

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-400">Hora Inicial</label>
                    <button
                      type="button"
                      onClick={() => setHoraInicialSeparacao(obterHoraAtualFormatada())}
                      className="text-[10px] text-sky-400 hover:underline"
                    >
                      Agora
                    </button>
                  </div>
                  <input
                    type="time"
                    value={horaInicialSeparacao}
                    onChange={(e) => setHoraInicialSeparacao(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-sky-500 min-h-[40px]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-400">Hora Final</label>
                    <button
                      type="button"
                      onClick={() => setHoraFinalSeparacao(obterHoraAtualFormatada())}
                      className="text-[10px] text-sky-400 hover:underline"
                    >
                      Agora
                    </button>
                  </div>
                  <input
                    type="time"
                    value={horaFinalSeparacao}
                    onChange={(e) => setHoraFinalSeparacao(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-sky-500 min-h-[40px]"
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO CONFERENTE */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
                <User className="w-4 h-4" />
                <span>2. Processo de Conferência</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Conferente ({unidadeNegocio})
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

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-400">Hora Inicial</label>
                    <button
                      type="button"
                      onClick={() => setHoraInicialConferencia(obterHoraAtualFormatada())}
                      className="text-[10px] text-indigo-400 hover:underline"
                    >
                      Agora
                    </button>
                  </div>
                  <input
                    type="time"
                    value={horaInicialConferencia}
                    onChange={(e) => setHoraInicialConferencia(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-indigo-500 min-h-[40px]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-400">Hora Final</label>
                    <button
                      type="button"
                      onClick={() => setHoraFinalConferencia(obterHoraAtualFormatada())}
                      className="text-[10px] text-indigo-400 hover:underline"
                    >
                      Agora
                    </button>
                  </div>
                  <input
                    type="time"
                    value={horaFinalConferencia}
                    onChange={(e) => setHoraFinalConferencia(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-indigo-500 min-h-[40px]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
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
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition disabled:opacity-50 min-h-[44px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{pedidoParaEdicao ? 'Salvar Alterações' : 'Cadastrar Pedido'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
