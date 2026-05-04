import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { getServerUrl } from '../config';

const FAVORITES_KEY = 'ilnaz-music-favorites';

const getFavorites = () => {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || []; } 
  catch { return []; }
};

const saveFavorites = (favorites) => {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
};

const MusicContext = createContext(null);

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
  const audioRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('ilnaz-music-volume', volume.toString());
  }, [volume]);

  useEffect(() => {
    if (currentTrack && isPlaying) {
      window.electron?.setMusicPresence?.({
        name: currentTrack.originalName,
        author: currentTrack.author
      });
    } else if (!currentTrack) {
      window.electron?.setMusicPresence?.(null);
    }
  }, [currentTrack, isPlaying]);

  const playTrack = useCallback((track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
  }, []);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const seekTo = useCallback((time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const setVolumeLevel = useCallback((level) => {
    const newVolume = Math.max(0, Math.min(1, level));
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  }, []);

  const toggleFavorite = useCallback((trackId) => {
    const newFavs = favorites.includes(trackId)
      ? favorites.filter(id => id !== trackId)
      : [...favorites, trackId];
    setFavorites(newFavs);
    saveFavorites(newFavs);
  }, [favorites]);

  const isFavorite = useCallback((trackId) => {
    return favorites.includes(trackId);
  }, [favorites]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  return (
    <MusicContext.Provider value={{
      currentTrack,
      isPlaying,
      volume,
      currentTime,
      duration,
      favorites,
      audioRef,
      playTrack,
      togglePlay,
      seekTo,
      setVolumeLevel,
      toggleFavorite,
      isFavorite,
      stop,
      setCurrentTrack,
      setIsPlaying,
      setCurrentTime,
      setDuration,
    }}>
      {children}
      {currentTrack && (
        <audio
          ref={audioRef}
          src={`${getServerUrl()}${currentTrack.path}`}
          onEnded={() => setIsPlaying(false)}
          onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
          onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
          autoPlay
        />
      )}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) throw new Error('useMusic must be used within MusicProvider');
  return context;
};

export default MusicContext;