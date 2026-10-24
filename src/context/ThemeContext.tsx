import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { usuariosService } from '../services/usuariosService';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'polihub_theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>(() => {
    // 1. Tenta carregar do localStorage
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    // Padrão do sistema é Dark
    return 'dark';
  });

  // Aplica classe no HTML imediatamente
  const applyThemeToDom = (t: Theme) => {
    const root = document.documentElement;
    if (t === 'light') {
      root.classList.add('theme-light');
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    } else {
      root.classList.remove('theme-light');
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    }
  };

  // Sincroniza com as preferências do usuário logado
  useEffect(() => {
    if (user && user.tema_escuro !== undefined && user.tema_escuro !== null) {
      const userTheme: Theme = user.tema_escuro === false ? 'light' : 'dark';
      if (userTheme !== theme) {
        setThemeState(userTheme);
        localStorage.setItem(THEME_STORAGE_KEY, userTheme);
        applyThemeToDom(userTheme);
      }
    }
  }, [user?.id, user?.tema_escuro]);

  // Efeito ao inicializar ou mudar o estado do tema
  useEffect(() => {
    applyThemeToDom(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    applyThemeToDom(newTheme);

    // Se houver usuário logado, salva na base de dados
    if (user?.id) {
      const isDark = newTheme === 'dark';
      usuariosService.atualizarTema(user.id, isDark).catch((err) => {
        console.warn('Erro ao persistir preferência de tema do usuário:', err);
      });
    }
  };

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
