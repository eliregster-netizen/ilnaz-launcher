import { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useParams } from 'react-router-dom';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import Sidebar from './components/Sidebar/Sidebar';
import Auth from './components/Auth/Auth';
import Home from './pages/Home';
import Library from './pages/Library';
import Profile from './pages/Profile';
import Friends from './pages/Friends';
import Chat from './pages/Chat';
import UserProfile from './pages/UserProfile';
import Admin from './pages/Admin';
import SettingsPage from './pages/SettingsPage/SettingsPage';
import ThemeManager from './pages/ThemeManager';
import Music from './pages/Music/Music';
import { SettingsProvider } from './context/SettingsContext';
import { MusicProvider } from './context/MusicContext';
import GlobalPlayer from './components/GlobalPlayer/GlobalPlayer';
import Browser from './components/Browser/Browser';
import {
  getActiveUser,
  getUserById,
  isAdmin,
  setStatus,
  logout,
} from './utils/auth';
import './styles/global.css';

const UserProfileRoute = () => {
  const { userId } = useParams();
  return <UserProfile key={userId} />;
};

const AppContent = () => {
  const [profile, setProfile] = useState(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const location = useLocation();
  const isChatPage = location.pathname.startsWith('/chat');
  const isLibraryPage = location.pathname.startsWith('/library');
  const isSettingsPage = location.pathname.startsWith('/settings');
  const isThemesPage = location.pathname.startsWith('/themes');
  const { activeTheme } = useTheme();

  const title = activeTheme?.launcherTitle || 'ILNAZ GAMING LAUNCHER';
  const bg = activeTheme?.background;
  const isBgImage = bg?.type === 'image' && bg?.value;

  useEffect(() => {
    loadSession();
    return () => {
      if (profile) {
        setStatus('offline').catch(() => {});
      }
    };
  }, []);

  const loadSession = async () => {
    const user = getActiveUser();
    if (user) {
      const fresh = await getUserById(user.id);
      if (fresh) {
        setProfile(fresh);
      } else {
        setProfile(null);
      }
    }
  };

  const handleLogin = (user) => {
    setProfile(user);
  };

  const handleLogout = () => {
    logout();
    setProfile(null);
  };

  const handleProfileUpdate = async (data) => {
    setProfile(prev => ({ ...prev, ...data }));
    const fresh = await getUserById(data.id || profile.id);
    if (fresh) setProfile(fresh);
  };

  if (!profile) {
    return (
      <div className="app-container">
        <Auth onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className={`app-bg-layer ${isBgImage ? 'active-bg' : ''}`} style={isBgImage ? {} : {}}>
        {isBgImage && <img src={bg.value} alt="" className="bg-image" />}
      </div>
      <div className="titlebar">
        <div className="titlebar-drag">
          <span className="titlebar-text">{title}</span>
        </div>
        <div className="titlebar-controls">
          <button className="titlebar-btn" onClick={() => window.electron?.minimizeApp?.()}>
            <svg viewBox="0 0 12 12"><rect x="2" y="5" width="8" height="1" /></svg>
          </button>
          <button className="titlebar-btn" onClick={() => window.electron?.maximizeApp?.()}>
            <svg viewBox="0 0 12 12"><rect x="2" y="2" width="8" height="8" fill="none" /></svg>
          </button>
          <button className="titlebar-btn titlebar-close" onClick={() => window.electron?.closeApp?.()}>
            <svg viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" /></svg>
          </button>
        </div>
      </div>
      <div className="app-body">
        <Sidebar profile={profile} onBrowserOpen={() => setBrowserOpen(true)} />
        <main className={`main-content ${(isChatPage || isLibraryPage || isSettingsPage || isThemesPage) ? 'no-padding' : ''}`}>
          <Routes>
            <Route path="/" element={<Home profile={profile} />} />
            <Route path="/library" element={<Library profile={profile} />} />
            <Route path="/profile" element={<Profile profile={profile} onUpdate={handleProfileUpdate} onLogout={handleLogout} />} />
            <Route path="/profile/:userId" element={<UserProfileRoute />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/themes" element={<ThemeManager />} />
            <Route path="/music" element={<Music />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
      <Browser isOpen={browserOpen} onClose={() => setBrowserOpen(false)} />
    </div>
  );
};

const App = () => (
  <SettingsProvider>
    <ThemeProvider>
      <MusicProvider>
        <AppContent />
        <GlobalPlayer />
      </MusicProvider>
    </ThemeProvider>
  </SettingsProvider>
);

export default App;
