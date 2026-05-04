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

// Audio instance stored outside React tree
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

  useEffect(() => {
    localStorage.setItem('ilnaz-music-volume', volume.toString());
  }, [volume]);

  // Audio effect - separate effect that doesn't use refs
  useEffect(() => {
    const audio = getAudio();
    
    const onEnded = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    
    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, []);

  // Track change effect
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
    if (isPlaying) {
      audio.play().catch(() => {});
    }
  }, [currentTrack?.id]);

  // Play/pause effect
  useEffect(() => {
    const audio = getAudio();
    if (!currentTrack) return;
    
    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Volume effect
  useEffect(() => {
    const audio = getAudio();
    audio.volume = volume;
  }, [volume]);

  const playTrack = useCallback((track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(0);
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