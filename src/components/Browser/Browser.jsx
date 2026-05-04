import { useState, useRef, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import './Browser.css';

const Browser = ({ isOpen, onClose }) => {
  const [url, setUrl] = useState('https://google.com');
  const [currentUrl, setCurrentUrl] = useState('https://google.com');
  const [isLoading, setIsLoading] = useState(false);
  const webviewRef = useRef(null);
  const { settings } = useSettings();
  const proxy = settings?.proxy || {};

  const navigate = () => {
    if (webviewRef.current) {
      webviewRef.current.src = currentUrl;
    }
  };

  const goBack = () => {
    if (webviewRef.current?.canGoBack()) {
      webviewRef.current.goBack();
    }
  };

  const goForward = () => {
    if (webviewRef.current?.canGoForward()) {
      webviewRef.current.goForward();
    }
  };

  const reload = () => {
    if (webviewRef.current) {
      webviewRef.current.reload();
    }
  };

  useEffect(() => {
    if (isOpen && webviewRef.current) {
      const handleNewWindow = (e) => {
        e.preventDefault();
        if (e.url) {
          window.open(e.url);
        }
      };

      const handleDidFailLoad = (e) => {
        console.error('[Browser] Failed to load:', e.errorDescription, e.validatedURL);
      };

      const applyProxy = async () => {
        if (proxy.enabled && proxy.host && proxy.port) {
          try {
            const proxyRules = `${proxy.host}:${proxy.port}`;
            await window.electron?.setProxy?.(proxyRules);
            console.log('[Browser] Proxy applied:', proxyRules);
          } catch (err) {
            console.error('[Browser] Failed to set proxy:', err);
          }
        } else {
          await window.electron?.setProxy?.('');
        }
      };

      webviewRef.current.addEventListener('new-window', handleNewWindow);
      webviewRef.current.addEventListener('did-start-loading', () => setIsLoading(true));
      webviewRef.current.addEventListener('did-stop-loading', () => setIsLoading(false));
      webviewRef.current.addEventListener('did-fail-load', handleDidFailLoad);
      webviewRef.current.addEventListener('did-attach', applyProxy);
      
      return () => {
        webviewRef.current?.removeEventListener('new-window', handleNewWindow);
        webviewRef.current?.removeEventListener('did-start-loading', () => setIsLoading(true));
        webviewRef.current?.removeEventListener('did-stop-loading', () => setIsLoading(false));
        webviewRef.current?.removeEventListener('did-fail-load', handleDidFailLoad);
        webviewRef.current?.removeEventListener('did-attach', applyProxy);
      };
    }
  }, [isOpen, proxy]);

  if (!isOpen) return null;

  return (
    <div className="browser-overlay">
      <div className="browser-container">
        <div className="browser-header">
          <div className="browser-controls">
            <button onClick={goBack} title="Назад">←</button>
            <button onClick={goForward} title="Вперед">→</button>
            <button onClick={reload} title="Обновить">↻</button>
          </div>
          <div className="browser-url-bar">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (setCurrentUrl(url), navigate())}
              placeholder="Введите URL..."
            />
            <button onClick={() => { setCurrentUrl(url); navigate(); }}>Перейти</button>
          </div>
          <button className="browser-close" onClick={onClose}>✕</button>
        </div>
        <webview
          ref={webviewRef}
          src={currentUrl}
          style={{ flex: 1, width: '100%' }}
          allowpopups="yes"
        />
        {isLoading && (
          <div className="browser-loading">
            <div className="loading-spinner" />
          </div>
        )}
      </div>
    </div>
  );
};

export default Browser;