import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

const defaultLogoSrc = null;

export const ThemeProvider = ({ children }) => {
  const [activeTheme, setActiveThemeState] = useState(null);
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarLogoSrc, setSidebarLogoSrc] = useState(defaultLogoSrc);

  const loadThemes = useCallback(async () => {
    try {
      const allThemes = await window.electron.getThemes();
      const active = await window.electron.getActiveTheme();
      setThemes(allThemes);
      setActiveThemeState(active);
      if (active?.icon) {
        setSidebarLogoSrc(active.icon);
      } else {
        setSidebarLogoSrc(defaultLogoSrc);
      }
    } catch (e) {
      console.error('Failed to load themes:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThemes();
  }, [loadThemes]);

  useEffect(() => {
    if (!activeTheme) return;
    applyThemeToDOM(activeTheme);
  }, [activeTheme]);

  const applyThemeToDOM = (theme) => {
    const root = document.documentElement;
    const c = theme.colors;
    if (!c) return;

    root.style.setProperty('--bg-primary', c.bgPrimary);
    root.style.setProperty('--bg-secondary', c.bgSecondary);
    root.style.setProperty('--bg-tertiary', c.bgTertiary);
    root.style.setProperty('--accent-primary', c.accentPrimary);
    root.style.setProperty('--accent-secondary', c.accentSecondary);
    root.style.setProperty('--text-primary', c.textPrimary);
    root.style.setProperty('--text-secondary', c.textSecondary);
    root.style.setProperty('--text-muted', c.textMuted);
    root.style.setProperty('--glass-bg', c.glassBg);
    root.style.setProperty('--glass-bg-hover', c.glassBgHover);
    root.style.setProperty('--glass-border', c.glassBorder);
    root.style.setProperty('--glass-border-hover', c.glassBorderHover);
    root.style.setProperty('--success', c.success);
    root.style.setProperty('--warning', c.warning);
    root.style.setProperty('--danger', c.danger);

    // Accent gradient
    const gradient = `linear-gradient(135deg, ${c.accentPrimary} 0%, ${c.accentSecondary} 100%)`;
    root.style.setProperty('--accent-gradient', gradient);

    // Background - for CSS vars (solid/gradient)
    const bg = theme.background;
    if (bg && bg.value && bg.type !== 'image') {
      root.style.setProperty('--theme-bg-value', bg.value);
    } else {
      root.style.setProperty('--theme-bg-value', '');
    }

    // Title
    if (theme.launcherTitle) {
      document.title = theme.launcherTitle;
    }

    // Icon
    if (theme.icon) {
      setSidebarLogoSrc(theme.icon);
      let link = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = theme.icon;
    } else {
      setSidebarLogoSrc(defaultLogoSrc);
    }
  };

  const selectTheme = async (themeId) => {
    const result = await window.electron.setActiveTheme(themeId);
    if (result.success) {
      setActiveThemeState(result.theme);
      await loadThemes();
    }
    return result;
  };

  const createTheme = async (themeData) => {
    const result = await window.electron.createTheme(themeData);
    if (result.success) {
      await loadThemes();
    }
    return result;
  };

  const updateTheme = async (themeId, updates) => {
    const result = await window.electron.updateTheme(themeId, updates);
    if (result.success) {
      await loadThemes();
      if (activeTheme && activeTheme.id === themeId) {
        setActiveThemeState(result.theme);
      }
    }
    return result;
  };

  const deleteThemeFn = async (themeId) => {
    const result = await window.electron.deleteTheme(themeId);
    if (result.success) {
      await loadThemes();
    }
    return result;
  };

  const exportTheme = async (themeId) => {
    return window.electron.exportTheme(themeId);
  };

  const importTheme = async (filePath) => {
    const result = await window.electron.importThemeFile(filePath);
    if (result.success) {
      await loadThemes();
    }
    return result;
  };

  const playLaunchSound = () => {
    return new Promise((resolve) => {
      if (activeTheme?.soundPath) {
        const audio = new Audio(activeTheme.soundPath);
        audio.onended = () => resolve();
        audio.onerror = () => resolve(); // If sound fails, still resolve
        audio.play().catch(() => resolve());
      } else {
        resolve(); // No sound, resolve immediately
      }
    });
  };

  const value = {
    themes,
    activeTheme,
    loading,
    sidebarLogoSrc,
    selectTheme,
    createTheme,
    updateTheme,
    deleteTheme: deleteThemeFn,
    exportTheme,
    importTheme,
    refreshThemes: loadThemes,
    playLaunchSound,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
