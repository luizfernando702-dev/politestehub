import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  KeyRound,
  AlertTriangle,
  Lock,
  UserCheck,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Usuario } from '../../types';
import { usuariosService } from '../../services/usuariosService';
import { useAuth } from '../../context/AuthContext';
import { useSessaoOperacional } from '../../context/SessaoOperacionalContext';
import { getActiveUserUnit } from '../../services/sessionHelper';

interface IdentificacaoOperacionalModalProps {
  modulo: 'recebimento' | 'alocacao' | 'inventario';
  onIdentificado: (usuario: Usuario) => void;
  onVoltar: () => void;
  onInicio?: () => void;
}

export const IdentificacaoOperacionalModal: React.FC<IdentificacaoOperacionalModalProps> = ({
  modulo,
  onIdentificado,
  onVoltar,
  onInicio,
}) => {
  const { user: authUser } = useAuth();
  const { identificarOperador } = useSessaoOperacional();

  const unidadeLogada = authUser?.unidade_negocio || getActiveUserUnit() || '';

  const [operadores, setOperadores] = useState<Usuario[]>([]);
  const [carregandoOperadores, setCarregandoOperadores] = useState(true);
  const [usuarioSelecionadoId, setUsuarioSelecionadoId] = useState<string>('');
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<Usuario | null>(null);

  // Estados do PIN
  const [pin, setPin] = useState('');
  const [novoPin, setNovoPin] = useState('');
  const [confirmarNovoPin, setConfirmarNovoPin] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  // Carrega operadores elegíveis do departamento de Logística pertencentes à unidade logada
  useEffect(() => {
    let montado = true;

    async function carregar() {
      try {
        setCarregandoOperadores(true);
        setErro(null);
        const unidadeAtual = authUser?.unidade_negocio || getActiveUserUnit() || '';
        const lista = await usuariosService.listarOperadoresLogistica(unidadeAtual);

        if (!montado) return;
        setOperadores(lista);
        // O campo deve iniciar COMPLETAMENTE VAZIO, sem nenhum usuário pré-selecionado
        setUsuarioSelecionadoId('');
        setUsuarioSelecionado(null);
      } catch (err) {
        console.error('Erro ao carregar operadores:', err);
        if (montado) {
          setErro('Não foi possível carregar a lista de operadores. Tente novamente.');
        }
      } finally {
        if (montado) {
          setCarregandoOperadores(false);
        }
      }
    }

    carregar();

    return () => {
      montado = false;
    };
  }, [authUser?.unidade_negocio]);

  // Ao trocar a seleção de operador
  const handleSelecionarUsuario = async (id: string) => {
    setUsuarioSelecionadoId(id);
    setPin('');
    setNovoPin('');
    setConfirmarNovoPin('');
    setErro(null);

    if (!id) {
      setUsuarioSelecionado(null);
      return;
    }

    try {
      setProcessando(true);
      const completo = await usuariosService.obterPorIdComPin(id);
      setUsuarioSelecionado(completo);
    } catch (err) {
      console.error('Erro ao carregar operador:', err);
      setErro('Erro ao carregar os dados do operador. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  };

  const temPinCadastrado = Boolean(usuarioSelecionado?.pin && usuarioSelecionado.pin.trim().length === 4);

  // Validação ao submeter PIN existente
  const handleValidarPin = async (e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e?.preventDefault) {
      e.preventDefault();
    }
    if (!usuarioSelecionado) {
      setErro('Selecione um usuário para continuar.');
      return;
    }

    const limpo = pin.trim();
    if (!/^\d{4}$/.test(limpo)) {
      setErro('O PIN deve possuir exatamente 4 dígitos numéricos.');
      return;
    }

    try {
      setProcessando(true);
      setErro(null);

      const res = await usuariosService.validarPin(usuarioSelecionado.id, limpo);

      if (!res.valid || !res.usuario) {
        setErro(res.message || 'PIN inválido. Confira os dados e tente novamente.');
        setPin('');
        return;
      }

      // Sucesso
      identificarOperador(res.usuario, modulo);
      onIdentificado(res.usuario);
    } catch (err) {
      console.error('Erro ao validar PIN:', err);
      setErro('Erro na validação do PIN. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  };

  // Criação do PIN no primeiro acesso
  const handleCriarPin = async (e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e?.preventDefault) {
      e.preventDefault();
    }
    if (!usuarioSelecionado) {
      setErro('Selecione um usuário para cadastrar o PIN.');
      return;
    }

    const p1 = novoPin.trim();
    const p2 = confirmarNovoPin.trim();

    if (!/^\d{4}$/.test(p1)) {
      setErro('O novo PIN deve possuir exatamente 4 dígitos numéricos.');
      return;
    }

    if (p1 !== p2) {
      setErro('Os dois campos de PIN devem ser exatamente iguais.');
      return;
    }

    try {
      setProcessando(true);
      setErro(null);

      const defRes = await usuariosService.definirPin(usuarioSelecionado.id, p1);
      if (!defRes.success) {
        setErro(defRes.error || 'Falha ao salvar o novo PIN.');
        return;
      }

      // Recarrega usuário atualizado
      const atualizado = await usuariosService.obterPorIdComPin(usuarioSelecionado.id);
      if (!atualizado) {
        setErro('Erro ao carregar dados do usuário atualizado.');
        return;
      }

      identificarOperador(atualizado, modulo);
      onIdentificado(atualizado);
    } catch (err) {
      console.error('Erro ao criar PIN:', err);
      setErro('Erro ao registrar o PIN. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  };

  const moduloTitulo =
    modulo === 'recebimento'
      ? 'Recebimento & Conferência'
      : modulo === 'alocacao'
      ? 'Alocação de Estoque'
      : 'Inventário & Contagem';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Identificação Operacional
            </span>
            <button
              id="btn-modal-pin-inicio"
              onClick={onInicio || onVoltar}
              type="button"
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors p-1 cursor-pointer"
              title="Voltar para a página inicial"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Início</span>
            </button>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {moduloTitulo}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Selecione o conferente/repositor responsável pelas operações neste módulo.
          </p>
        </div>

        {/* Conteúdo */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {erro && (
            <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{erro}</div>
            </div>
          )}

          {/* Seleção do Usuário - Inicia obrigatoriamente vazio */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Usuário:</span>
              <span className="text-[11px] text-slate-400 font-normal">
                Logística &bull; {unidadeLogada || 'Unidade Atual'}
              </span>
            </label>

            {carregandoOperadores ? (
              <div className="flex items-center justify-center py-4 bg-slate-950/50 rounded-2xl border border-slate-800 text-xs text-slate-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                <span>Carregando usuários da Logística ({unidadeLogada || 'sua unidade'})...</span>
              </div>
            ) : operadores.length === 0 ? (
              <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/50 text-amber-300 text-xs">
                Nenhum usuário do departamento <strong>Logística</strong> na unidade{' '}
                <strong>{unidadeLogada || 'atual'}</strong> foi localizado.
              </div>
            ) : (
              <select
                id="select-operador-responsavel"
                value={usuarioSelecionadoId}
                onChange={(e) => handleSelecionarUsuario(e.target.value)}
                disabled={processando}
                className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 text-sm text-white font-medium focus:outline-none focus:border-amber-500 transition-colors cursor-pointer"
              >
                <option value="">Selecione o usuário</option>
                {operadores.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.nome} {op.codigo ? `(${op.codigo})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Estado inicial: Nenhum usuário selecionado */}
          {!usuarioSelecionadoId && !carregandoOperadores && operadores.length > 0 && (
            <div className="p-5 rounded-2xl bg-slate-950/50 border border-slate-800/80 text-slate-400 text-xs text-center flex flex-col items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-400">
                <UserCheck className="w-5 h-5" />
              </div>
              <p className="font-semibold text-slate-300 text-sm">Nenhum usuário selecionado</p>
              <p className="text-slate-500 max-w-xs leading-relaxed">
                Por favor, selecione seu nome na lista acima para prosseguir com a conferência ou alocação.
              </p>
            </div>
          )}

          {/* Se o usuário selecionado NÃO tem PIN: Criação de PIN (SEM form nativo para evitar diálogo de salvar senha do browser) */}
          {usuarioSelecionado && !temPinCadastrado && !carregandoOperadores && (
            <div className="space-y-4 pt-1 animate-in fade-in" role="group" aria-label="Criar PIN operacional">
              {/* Aviso destacado exigido no requisito */}
              <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-3 shadow-lg">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-300 text-sm">Criar PIN</p>
                  <p className="leading-relaxed">
                    <strong>Atenção: não esqueça seu PIN.</strong> Ele será utilizado para identificar você nas operações de Recebimento, Conferência e Alocação.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="input_novo_pin_code" className="text-xs font-semibold text-slate-300">Novo PIN</label>
                  <input
                    type="password"
                    id="input_novo_pin_code"
                    name="polihub_novo_pin_code"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-form-type="other"
                    aria-autocomplete="none"
                    placeholder="••••"
                    value={novoPin}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setNovoPin(v);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && novoPin.length === 4 && confirmarNovoPin.length === 4) {
                        handleCriarPin();
                      }
                    }}
                    className="w-full tracking-widest text-center font-mono text-xl py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="input_confirmar_pin_code" className="text-xs font-semibold text-slate-300">Confirmar PIN</label>
                  <input
                    type="password"
                    id="input_confirmar_pin_code"
                    name="polihub_confirmar_pin_code"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-form-type="other"
                    aria-autocomplete="none"
                    placeholder="••••"
                    value={confirmarNovoPin}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setConfirmarNovoPin(v);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && novoPin.length === 4 && confirmarNovoPin.length === 4) {
                        handleCriarPin();
                      }
                    }}
                    className="w-full tracking-widest text-center font-mono text-xl py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="button"
                id="btn-confirmar-criar-pin"
                onClick={() => handleCriarPin()}
                disabled={processando || novoPin.length !== 4 || confirmarNovoPin.length !== 4}
                className="w-full py-3.5 px-4 rounded-2xl font-black text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-950/50 flex items-center justify-center gap-2 transition-all mt-2 cursor-pointer"
              >
                {processando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Cadastrando PIN...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>CRIAR PIN E INICIAR OPERAÇÃO</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Se o usuário selecionado JÁ tem PIN: Validação do PIN (SEM form nativo para evitar diálogo de salvar senha do browser) */}
          {usuarioSelecionado && temPinCadastrado && !carregandoOperadores && (
            <div className="space-y-4 pt-1 animate-in fade-in" role="group" aria-label="Validar PIN operacional">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="input_operador_pin_code" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Digite seu PIN de 4 dígitos:</span>
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">4 dígitos numéricos</span>
                </div>

                <input
                  type="password"
                  id="input_operador_pin_code"
                  name="polihub_operador_pin_code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  aria-autocomplete="none"
                  autoFocus
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setPin(v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && pin.length === 4) {
                      handleValidarPin();
                    }
                  }}
                  className="w-full tracking-[0.5em] text-center font-mono text-2xl py-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-700 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <button
                type="button"
                id="btn-confirmar-validar-pin"
                onClick={() => handleValidarPin()}
                disabled={processando || pin.length !== 4}
                className="w-full py-3.5 px-4 rounded-2xl font-black text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-950/50 flex items-center justify-center gap-2 transition-all mt-2 cursor-pointer"
              >
                {processando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Validando PIN...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>CONFIRMAR PIN</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-xs text-slate-500">
          <span>PoliHub Logística</span>
          <button
            type="button"
            id="btn-modal-pin-cancelar"
            onClick={onVoltar || onInicio}
            className="hover:text-slate-300 transition-colors cursor-pointer"
          >
            Cancelar e voltar
          </button>
        </div>
      </div>
    </div>
  );
};
