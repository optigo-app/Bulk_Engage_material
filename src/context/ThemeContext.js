import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

const THEMES = {
  theme1: {
    id: 'theme1',
    name: 'Dark Mode',
    description: 'Classic dark blue theme',
    preview: {
      bg: '#0f1724',
      sidebar: '#121d2f',
      accent: '#1565c0',
      header: 'linear-gradient(135deg, #0d1b2a, #1b2838)',
    },
  },
  theme2: {
    id: 'theme2',
    name: 'Light Mode',
    description: 'Clean bright professional theme',
    preview: {
      bg: '#f0f4f8',
      sidebar: '#ffffff',
      accent: '#6366f1',
      header: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
    },
  },
};

const getSystemTheme = () =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'theme1' : 'theme2';

const applyTheme = (themeId) => {
  document.documentElement.setAttribute('data-theme', themeId);
};

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('em-theme') || null;
  });

  const [showSelector, setShowSelector] = useState(false);

  // Apply theme on mount and whenever currentTheme changes
  useEffect(() => {
    if (!currentTheme) return;

    if (currentTheme === 'system') {
      applyTheme(getSystemTheme());
    } else {
      applyTheme(currentTheme);
    }

    localStorage.setItem('em-theme', currentTheme);
  }, [currentTheme]);

  // Listen for OS-level theme changes when 'system' is selected
  useEffect(() => {
    if (currentTheme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemChange = (e) => {
      applyTheme(e.matches ? 'theme1' : 'theme2');
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [currentTheme]);

  const switchTheme = useCallback((themeId) => {
    setCurrentTheme(themeId);
    setShowSelector(false);
  }, []);

  const toggleSelector = useCallback(() => {
    setShowSelector((prev) => !prev);
  }, []);

  // Resolve the visual theme (what's actually applied to the DOM)
  const resolvedTheme = currentTheme === 'system' ? getSystemTheme() : currentTheme || 'theme1';

  return (
    <ThemeContext.Provider
      value={{
        currentTheme: currentTheme || 'theme1',   // stored preference ('system' | 'theme1' | 'theme2')
        resolvedTheme,                             // actual applied theme ('theme1' | 'theme2')
        themes: THEMES,
        switchTheme,
        showSelector,
        setShowSelector,
        toggleSelector,
        isSystemTheme: currentTheme === 'system',
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

export default ThemeContext;