import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const FAVORITES_KEY = 'ilnaz-music-favorites';

const getFavorites = () => {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || []; } 
  catch { return []; }
};

const saveFavorites = (favorites) => {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
};

const MusicContext = createContext(null);

// Аудио-менеджер вне React-дерева
let audioInstance = null;
const getAudio = () => {
  if (!audioInstance) {
    audioInstance = new Audio();
  }
  return audioInstance;
};

export const MusicProvider = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('ilnaz-music-volume');
    return saved ? parseFloat(saved) : 1;
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [favorites, setFavorites] = useState(getFavorites);

  // Сохраняем громкость
  useEffect(() => {
    localStorage.setItem('ilnaz-music-volume', volume.toString());
  }, [volume]);

  // Подписываемся на события аудио (один раз)
  useEffect(() => {
    const audio = getAudio();
    
    const handleEnded = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    
    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, []);

  // Смена трека
  useEffect(() => {
    const audio = getAudio();
    if (!currentTrack) {
      audio.pause();
      audio.src = '';
      return;
    }
    
    const serverUrl = (() => {
      try {
        const stored = localStorage.getItem('ilnaz-server-url');
        if (stored) return stored;
      } catch (e) {}
      return 'https://ilnaz-launcher.onrender.com';
    })();
    
    audio.src = `${serverUrl}${currentTrack.path}`;
    audio.volume = volume;
    audio.play().catch(() => {});
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(0);
    
    // Update play count
    fetch(`${serverUrl}/api/music/${currentTrack.id}/play`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('ilnaz-token')}` }
    }).catch(() => {});
  }, [currentTrack?.id]);

  // Play/Pause
  useEffect(() => {
    const audio = getAudio();
    if (!currentTrack) return;
    
    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Громкость
  useEffect(() => {
    const audio = getAudio();
    audio.volume = volume;
  }, [volume]);

  // Discord RPC
  useEffect(() => {
    if (currentTrack && isPlaying) {
      window.electron?.setMusicPresence?.({
        name: currentTrack.originalName,
        cover: currentTrack.cover ? `${getServerUrl()}${currentTrack.cover}` : null
      });
    } else if (!currentTrack) {
      window.electron?.setMusicPresence?.(null);
    }
  }, [currentTrack, isPlaying]);

  const playTrack = useCallback((track) => {
    setCurrentTrack(track);
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const seekTo = useCallback((time) => {
    const audio = getAudio();
    audio.currentTime = time;
  }, []);

  const setVolumeLevel = useCallback((level) => {
    setVolume(Math.max(0, Math.min(1, level)));
  }, []);

  const toggleFavorite = useCallback((trackId) => {
    setFavorites(prev => {
      const newFavs = prev.includes(trackId)
        ? prev.filter(id => id !== trackId)
        : [...prev, trackId];
      saveFavorites(newFavs);
      return newFavs;
    });
  }, []);

  const isFavorite = useCallback((trackId) => {
    return favorites.includes(trackId);
  }, [favorites]);

  const stop = useCallback(() => {
    const audio = getAudio();
    audio.pause();
    audio.currentTime = 0;
    setCurrentTrack(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  return (
    <MusicContext.Provider value={{
      currentTrack,
      isPlaying,
      volume,
      currentTime,
      duration,
      favorites,
      playTrack,
      togglePlay,
      seekTo,
      setVolumeLevel,
      toggleFavorite,
      isFavorite,
      stop,
    }}>
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) throw new Error('useMusic must be used within MusicProvider');
  return context;
};

export default MusicContext;