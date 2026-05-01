import { useState, useEffect, useRef, useCallback } from 'react';

const SettingsModal = ({ onClose }) => {
  const [audioDevices, setAudioDevices] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);
  const [speakerDevices, setSpeakerDevices] = useState([]);
  const [selectedAudio, setSelectedAudio] = useState('');
  const [selectedVideo, setSelectedVideo] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const [micVolume, setMicVolume] = useState(0);
  const [isMicActive, setIsMicActive] = useState(false);
  const [cameraPreview, setCameraPreview] = useState(null);
  const videoPreviewRef = useRef(null);
  const micStreamRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    loadDevices();
    loadSavedSettings();
  }, []);

  useEffect(() => {
    return () => {
      stopMicTest();
      stopCameraPreview();
    };
  }, []);

  const loadDevices = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audio = devices.filter(d => d.kind === 'audioinput');
      const video = devices.filter(d => d.kind === 'videoinput');
      const speaker = devices.filter(d => d.kind === 'audiooutput');
      setAudioDevices(audio);
      setVideoDevices(video);
      setSpeakerDevices(speaker);

      if (audio.length > 0) setSelectedAudio(audio[0].deviceId);
      if (video.length > 0) setSelectedVideo(video[0].deviceId);
      if (speaker.length > 0) setSelectedSpeaker(speaker[0].deviceId);
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
    }
  };

  const loadSavedSettings = () => {
    try {
      const saved = localStorage.getItem('client-settings');
      if (saved) {
        const s = JSON.parse(saved);
        if (s.audio) setSelectedAudio(s.audio);
        if (s.video) setSelectedVideo(s.video);
        if (s.speaker) setSelectedSpeaker(s.speaker);
      }
    } catch (e) {}
  };

  const saveSettings = () => {
    localStorage.setItem('client-settings', JSON.stringify({
      audio: selectedAudio,
      video: selectedVideo,
      speaker: selectedSpeaker,
    }));
  };

  const startMicTest = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedAudio ? { deviceId: { exact: selectedAudio } } : true,
      });
      micStreamRef.current = stream;

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const checkLevel = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setMicVolume(Math.min(100, Math.round((avg / 255) * 100 * 2)));
        animFrameRef.current = requestAnimationFrame(checkLevel);
      };
      checkLevel();
      setIsMicActive(true);
    } catch (err) {
      console.error('Mic test error:', err);
    }
  }, [selectedAudio]);

  const stopMicTest = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setMicVolume(0);
    setIsMicActive(false);
  }, []);

  const startCameraPreview = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedVideo ? { deviceId: { exact: selectedVideo } } : true,
      });
      cameraStreamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }
      setCameraPreview(true);
    } catch (err) {
      console.error('Camera preview error:', err);
    }
  }, [selectedVideo]);

  const stopCameraPreview = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    setCameraPreview(false);
  }, []);

  const handleSave = () => {
    saveSettings();
    onClose();
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h3>Настройки клиента</h3>
          <button className="settings-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="settings-body">
          <div className="settings-section">
            <h4>Микрофон</h4>
            <select value={selectedAudio} onChange={e => setSelectedAudio(e.target.value)}>
              <option value="">Выберите микрофон...</option>
              {audioDevices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Микрофон ${audioDevices.indexOf(d) + 1}`}
                </option>
              ))}
            </select>
            <div className="settings-test-area">
              <button className="settings-test-btn" onClick={isMicActive ? stopMicTest : startMicTest}>
                {isMicActive ? 'Остановить тест' : 'Тестировать микрофон'}
              </button>
              {isMicActive && (
                <div className="mic-level-container">
                  <div className="mic-level-bar">
                    <div className="mic-level-fill" style={{ width: `${micVolume}%`, background: micVolume > 80 ? '#ff4466' : micVolume > 40 ? '#ffaa33' : '#44cc66' }} />
                  </div>
                  <span className="mic-level-value">{micVolume}%</span>
                </div>
              )}
            </div>
          </div>

          <div className="settings-section">
            <h4>Камера</h4>
            <select value={selectedVideo} onChange={e => setSelectedVideo(e.target.value)}>
              <option value="">Выберите камеру...</option>
              {videoDevices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Камера ${videoDevices.indexOf(d) + 1}`}
                </option>
              ))}
            </select>
            <div className="settings-camera-preview">
              <video ref={videoPreviewRef} autoPlay playsInline muted className="camera-preview-video" />
              <div className="camera-preview-actions">
                <button className="settings-test-btn" onClick={cameraPreview ? stopCameraPreview : startCameraPreview}>
                  {cameraPreview ? 'Скрыть превью' : 'Показать превью'}
                </button>
              </div>
            </div>
          </div>

          {speakerDevices.length > 0 && (
            <div className="settings-section">
              <h4>Динамики</h4>
              <select value={selectedSpeaker} onChange={e => setSelectedSpeaker(e.target.value)}>
                <option value="">Выберите динамики...</option>
                {speakerDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Динамики ${speakerDevices.indexOf(d) + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="settings-section">
            <h4>Интерфейс</h4>
            <div className="settings-checkbox-row">
              <label>
                <input type="checkbox" defaultChecked={localStorage.getItem('settings-compact') !== 'false'} onChange={e => localStorage.setItem('settings-compact', e.target.checked)} />
                Компактный режим сообщений
              </label>
            </div>
            <div className="settings-checkbox-row">
              <label>
                <input type="checkbox" defaultChecked={localStorage.getItem('settings-notifications') !== 'false'} onChange={e => localStorage.setItem('settings-notifications', e.target.checked)} />
                Уведомления о сообщениях
              </label>
            </div>
            <div className="settings-checkbox-row">
              <label>
                <input type="checkbox" defaultChecked={localStorage.getItem('settings-sounds') !== 'false'} onChange={e => localStorage.setItem('settings-sounds', e.target.checked)} />
                Звуки уведомлений
              </label>
            </div>
          </div>
        </div>
        <div className="settings-footer">
          <button className="settings-save-btn" onClick={handleSave}>Сохранить</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
