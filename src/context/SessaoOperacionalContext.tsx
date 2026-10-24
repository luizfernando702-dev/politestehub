import React, { createContext, useContext, useState, useCallback } from 'react';
import { Usuario, UsuarioOperacionalSessao } from '../types';

interface SessaoOperacionalContextType {
  operador: UsuarioOperacionalSessao | null;
  identificarOperador: (usuario: Usuario, modulo: 'recebimento' | 'alocacao' | 'inventario') => void;
  limparSessaoOperacional: () => void;
  estaIdentificadoPara: (modulo: 'recebimento' | 'alocacao' | 'inventario') => boolean;
}

const SessaoOperacionalContext = createContext<SessaoOperacionalContextType | undefined>(undefined);

export const SessaoOperacionalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // O operador é mantido estritamente em memória durante a permanência no módulo
  // Não salva em sessionStorage para que a identificação seja solicitada a cada novo acesso
  const [operador, setOperador] = useState<UsuarioOperacionalSessao | null>(null);

  const identificarOperador = useCallback((usuario: Usuario, modulo: 'recebimento' | 'alocacao' | 'inventario') => {
    const novaSessao: UsuarioOperacionalSessao = {
      id: usuario.id,
      nome: usuario.nome,
      codigo: usuario.codigo,
      departamento: usuario.departamento,
      modulo,
      dataHoraValidacao: new Date().toISOString(),
    };
    setOperador(novaSessao);
  }, []);

  const limparSessaoOperacional = useCallback(() => {
    setOperador(null);
  }, []);

  const estaIdentificadoPara = useCallback((modulo: 'recebimento' | 'alocacao' | 'inventario'): boolean => {
    if (!operador) return false;
    return operador.modulo === modulo;
  }, [operador]);

  return (
    <SessaoOperacionalContext.Provider
      value={{
        operador,
        identificarOperador,
        limparSessaoOperacional,
        estaIdentificadoPara,
      }}
    >
      {children}
    </SessaoOperacionalContext.Provider>
  );
};

export const useSessaoOperacional = (): SessaoOperacionalContextType => {
  const ctx = useContext(SessaoOperacionalContext);
  if (!ctx) {
    throw new Error('useSessaoOperacional deve ser utilizado dentro de um SessaoOperacionalProvider');
  }
  return ctx;
};

