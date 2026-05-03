import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const SETTINGS_KEY = 'ilnaz-settings';

const DEFAULTS = {
  general: {
    launchAtStartup: false,
    minimizeToTray: false,
    alwaysOnTop: false,
    autoUpdates: true,
    updateChannel: 'stable',
  },
  appearance: {
    uiScale: '100',
    compactMode: false,
    animations: true,
    blurEffect: true,
  },
  launch: {
    autoJava: true,
    autoOptifine: true,
    verifyFiles: false,
    autoRam: true,
    maxRam: '4096',
    launchSound: true,
  },
  notifications: {
    enabled: true,
    sound: true,
    friendsOnline: true,
    updates: true,
  },
  language: {
    lang: 'ru',
    timezone: 'auto',
  },
  server: {
    url: '',
  },
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const merged = {};
      for (const group of Object.keys(DEFAULTS)) {
        merged[group] = { ...DEFAULTS[group], ...(parsed[group] || {}) };
      }
      return merged;
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULTS));
}

function saveSettings(s) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch (e) {}
}

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateGroup = useCallback((group, values) => {
    setSettings(prev => ({
      ...prev,
      [group]: { ...prev[group], ...values },
    }));
  }, []);

  const value = {
    settings,
    updateGroup,
    resetAll: () => setSettings(JSON.parse(JSON.stringify(DEFAULTS))),
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

export function getSettings() {
  return loadSettings();
}
