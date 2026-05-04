// Utility to fetch and test free proxies from GitHub
const https = require('https');
const http = require('http');

const PROXY_LIST_URL = 'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/all/socks5.txt';

function fetchProxyList() {
  return new Promise((resolve, reject) => {
    https.get(PROXY_LIST_URL, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const proxies = data.split('\n').filter(line => line.trim()).map(line => {
          // Parse protocol://host:port
          const match = line.match(/^(socks5|socks4|http|https):\/\/([^:]+):(\d+)$/);
          if (match) {
            return { protocol: match[1], host: match[2], port: parseInt(match[3], 10) };
          }
          return null;
        }).filter(Boolean);
        resolve(proxies);
      });
    }).on('error', reject);
  });
}

function testProxy(proxy) {
  return new Promise((resolve) => {
    const timeout = 5000; // 5 second timeout
    const url = 'http://www.google.com';
    
    const req = http.get({
      host: proxy.host,
      port: proxy.port,
      path: url,
      timeout: timeout,
      agent: false,
    }, (res) => {
      resolve(true);
    });
    
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function findWorkingProxy() {
  try {
    const proxies = await fetchProxyList();
    // Shuffle and take first 10 for testing
    const shuffled = proxies.sort(() => Math.random() - 0.5).slice(0, 10);
    
    for (const proxy of shuffled) {
      const works = await testProxy(proxy);
      if (works) {
        return proxy;
      }
    }
    return null;
  } catch (err) {
    console.error('[ProxyFinder] Error:', err);
    return null;
  }
}

module.exports = { fetchProxyList, testProxy, findWorkingProxy };
