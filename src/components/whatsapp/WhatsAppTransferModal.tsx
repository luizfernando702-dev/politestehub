import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, Users, Layers, AlertCircle, CheckCircle2 } from 'lucide-react';
import { WhatsAppConversa, WhatsAppFila, WhatsAppUsuarioHabilitado, Usuario } from '../../types';
import { whatsappService } from '../../services/whatsappService';

interface WhatsAppTransferModalProps {
  conversa: WhatsAppConversa;
  usuarioLogado: Usuario;
  onClose: () => void;
  onTransferido: () => void;
}

export const WhatsAppTransferModal: React.FC<WhatsAppTransferModalProps> = ({
  conversa,
  usuarioLogado,
  onClose,
  onTransferido,
}) => {
  const [filas, setFilas] = useState<WhatsAppFila[]>([]);
  const [usuarios, setUsuarios] = useState<WhatsAppUsuarioHabilitado[]>([]);
  const [tipoTransferencia, setTipoTransferencia] = useState<'fila' | 'usuario'>('fila');
  const [novaFila, setNovaFila] = useState(conversa.fila_nome || 'Recebimento');
  const [novoUsuarioId, setNovoUsuarioId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregarDados() {
      try {
        const [listaFilas, listaUsuarios] = await Promise.all([
          whatsappService.listarFilas(conversa.unidade_negocio),
          whatsappService.listarUsuariosHabilitados(conversa.unidade_negocio),
        ]);
        setFilas(listaFilas.filter((f) => f.ativo));
        // Apenas usuários habilitados e diferentes do atual
        setUsuarios(listaUsuarios.filter((u) => u.habilitado && u.usuario_id !== usuarioLogado.id));
      } catch (e) {
        console.error('Erro ao carregar dados de transferência:', e);
      }
    }
    carregarDados();
  }, [conversa.unidade_negocio, usuarioLogado.id]);

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (tipoTransferencia === 'usuario' && !novoUsuarioId) {
      setErro('Selecione o atendente de destino.');
      return;
    }

    try {
      setSalvando(true);
      const atendenteEscolhido = usuarios.find((u) => u.usuario_id === novoUsuarioId);

      await whatsappService.transferirConversa(conversa.id, usuarioLogado, {
        novaFila: tipoTransferencia === 'fila' ? novaFila : undefined,
        novoUsuarioId: tipoTransferencia === 'usuario' ? novoUsuarioId : undefined,
        novoUsuarioNome: atendenteEscolhido?.usuario_nome,
        motivo: motivo.trim() || undefined,
      });

      onTransferido();
      onClose();
    } catch (err: any) {
      setErro('Falha ao transferir conversa. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Transferir Atendimento</h3>
              <p className="text-xs text-slate-400">
                {conversa.nome_remetente} ({conversa.numero_remetente})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleConfirmar} className="p-5 space-y-4">
          {erro && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Seletor de Tipo */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Destino da Transferência
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipoTransferencia('fila')}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition min-h-[44px] cursor-pointer ${
                  tipoTransferencia === 'fila'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Transferir para Fila</span>
              </button>

              <button
                type="button"
                onClick={() => setTipoTransferencia('usuario')}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition min-h-[44px] cursor-pointer ${
                  tipoTransferencia === 'usuario'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Para Colaborador</span>
              </button>
            </div>
          </div>

          {/* Campo Fila */}
          {tipoTransferencia === 'fila' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Selecione a Fila de Destino
              </label>
              <select
                value={novaFila}
                onChange={(e) => setNovaFila(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:outline-hidden focus:border-blue-500 min-h-[44px]"
              >
                {filas.map((f) => (
                  <option key={f.id} value={f.nome}>
                    {f.nome} {f.descricao ? `— ${f.descricao}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                A conversa voltará ao status aguardando e ficará disponível aos atendentes autorizados desta fila.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Selecione o Colaborador
              </label>
              <select
                value={novoUsuarioId}
                onChange={(e) => setNovoUsuarioId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:outline-hidden focus:border-blue-500 min-h-[44px]"
              >
                <option value="">-- Selecione um atendente --</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.usuario_id}>
                    {u.usuario_nome} ({u.usuario_codigo || u.usuario_nivel}) — {u.disponivel ? 'Disponível' : 'Ocupado'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Motivo da Transferência */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Observação / Motivo (Opcional)
            </label>
            <textarea
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Cliente solicita confirmação de descarga na doca 2..."
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
            />
          </div>

          {/* Botões */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition min-h-[40px] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/30 disabled:opacity-50 min-h-[40px] cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{salvando ? 'Transferindo...' : 'Confirmar Transferência'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
