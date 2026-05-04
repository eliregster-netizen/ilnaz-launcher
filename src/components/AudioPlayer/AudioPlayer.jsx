import { useEffect, useRef } from 'react';
import { useMusic } from '../../context/MusicContext';

const DEFAULT_SERVER = 'https://ilnaz-launcher.onrender.com';

const getServerUrl = () => {
  try {
    const stored = localStorage.getItem('ilnaz-server-url');
    if (stored) return stored;
  } catch (e) {}
  return DEFAULT_SERVER;
};

const AudioPlayer = () => {
  const { currentTrack, isPlaying, volume, setCurrentTime, setDuration } = useMusic();
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentTrack) {
      audio.src = `${getServerUrl()}${currentTrack.path}`;
      audio.volume = volume;
      
      if (isPlaying) {
        audio.play().catch(console.error);
      }
    } else {
      audio.pause();
      audio.src = '';
    }
  }, [currentTrack?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (isPlaying) {
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => setCurrentTime(0);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoaded = () => setDuration(audio.duration);

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoaded);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoaded);
    };
  }, [setCurrentTime, setDuration]);

  return <audio ref={audioRef} />;
};

export default AudioPlayer;