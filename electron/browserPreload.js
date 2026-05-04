const { contextBridge, session } = require('electron');

// This preload script runs inside webview
// We can access session and set proxy

contextBridge.exposeInMainWorld('browserAPI', {
  setProxy: (proxyConfig) => {
    if (session && session.defaultSession) {
      session.defaultSession.setProxy(proxyConfig);
    }
  }
});
