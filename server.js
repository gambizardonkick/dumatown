const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';
const CONFIG_FILE = 'admin-config.json';
const ADMIN_PASSWORD = 'DUMA*ADMIN*891728';

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
};

function getDefaultConfig() {
  const now = new Date();
  const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const defaultDates = {
    startDate: now.toISOString().split('T')[0],
    endDate: twoWeeksLater.toISOString().split('T')[0]
  };
  return {
    packdraw: {
      ...defaultDates,
      prizePool: 1000,
      prizes: [250, 125, 75, 50, 50, 50, 50, 50, 50, 50],
      cachedData: null,
      lastFetch: null
    },
    solpump: {
      ...defaultDates,
      prizePool: 500,
      wagerUnit: 'SOL',
      prizes: [100, 75, 50, 30, 25, 25, 25, 25, 25, 20],
      entries: []
    },
    stake: {
      ...defaultDates,
      prizePool: 500,
      wagerUnit: 'USD',
      prizes: [100, 75, 50, 30, 25, 25, 25, 25, 25, 20],
      entries: []
    }
  };
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      // Migrate old config format
      if (config.startDate && !config.packdraw) {
        const defaultConfig = getDefaultConfig();
        defaultConfig.packdraw = {
          startDate: config.startDate,
          endDate: config.endDate,
          prizePool: config.prizePool || 1000,
          prizes: config.prizes || [250, 125, 75, 50, 50, 50, 50, 50, 50, 50],
          cachedData: config.cachedData,
          lastFetch: config.lastFetch
        };
        return defaultConfig;
      }
      return config;
    }
  } catch (e) {
    console.error('Error loading config:', e);
  }
  return getDefaultConfig();
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function formatDateForAPI(dateStr) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}-${d.getDate()}-${d.getFullYear()}`;
}

async function fetchLeaderboardData(startDate) {
  const https = require('https');
  const formattedDate = formatDateForAPI(startDate);
  const apiUrl = `https://packdraw.com/api/v1/affiliates/leaderboard?after=${formattedDate}&apiKey=69d9aeca-ef24-4fba-b89a-8cc238bc39d3`;
  
  return new Promise((resolve, reject) => {
    https.get(apiUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Get config for all leaderboards (homepage)
  if (pathname === '/api/config' && req.method === 'GET') {
    const config = loadConfig();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      packdraw: {
        startDate: config.packdraw.startDate,
        endDate: config.packdraw.endDate,
        prizePool: config.packdraw.prizePool || 1000,
        prizes: config.packdraw.prizes,
        paused: config.packdraw.paused || false
      },
      solpump: {
        startDate: config.solpump.startDate,
        endDate: config.solpump.endDate,
        prizePool: config.solpump.prizePool || 500,
        wagerUnit: config.solpump.wagerUnit || 'SOL',
        prizes: config.solpump.prizes,
        entries: config.solpump.entries || [],
        paused: config.solpump.paused || false
      },
      stake: {
        startDate: config.stake.startDate,
        endDate: config.stake.endDate,
        prizePool: config.stake.prizePool || 500,
        wagerUnit: config.stake.wagerUnit || 'USD',
        prizes: config.stake.prizes,
        entries: config.stake.entries || [],
        paused: config.stake.paused || false
      }
    }));
    return;
  }

  // Admin auth
  if (pathname === '/api/admin-auth' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      if (body.password === ADMIN_PASSWORD) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid password' }));
      }
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid request' }));
    }
    return;
  }

  // Update config for specific leaderboard
  if (pathname === '/api/config' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      if (body.password !== ADMIN_PASSWORD) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
      
      const config = loadConfig();
      const lb = body.leaderboard || 'packdraw';
      
      if (!config[lb]) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid leaderboard' }));
        return;
      }
      
      if (body.startDate) config[lb].startDate = body.startDate;
      if (body.endDate) config[lb].endDate = body.endDate;
      if (body.prizePool !== undefined) config[lb].prizePool = Number(body.prizePool);
      if (body.wagerUnit) config[lb].wagerUnit = body.wagerUnit;
      if (body.prizes) config[lb].prizes = body.prizes.map(p => Number(p));
      if (body.paused !== undefined) config[lb].paused = body.paused;
      
      // Clear cache for packdraw if dates changed
      if (lb === 'packdraw' && body.startDate) {
        config[lb].cachedData = null;
        config[lb].lastFetch = null;
      }
      
      saveConfig(config);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, config: config[lb] }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid request' }));
    }
    return;
  }

  // Packdraw leaderboard (API-driven)
  if (pathname === '/api/leaderboard' && req.method === 'GET') {
    try {
      const config = loadConfig();
      const packdraw = config.packdraw;
      const now = new Date();
      const endDate = new Date(packdraw.endDate);
      
      if (now > endDate && packdraw.cachedData) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          data: packdraw.cachedData,
          startDate: packdraw.startDate,
          endDate: packdraw.endDate,
          prizePool: packdraw.prizePool || 1000,
          prizes: packdraw.prizes || [250, 125, 75, 50, 50, 50, 50, 50, 50, 50],
          frozen: true,
          paused: packdraw.paused || false
        }));
        return;
      }

      const data = await fetchLeaderboardData(packdraw.startDate);
      config.packdraw.cachedData = data;
      config.packdraw.lastFetch = new Date().toISOString();
      saveConfig(config);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        data: data,
        startDate: packdraw.startDate,
        endDate: packdraw.endDate,
        prizePool: packdraw.prizePool || 1000,
        prizes: packdraw.prizes || [250, 125, 75, 50, 50, 50, 50, 50, 50, 50],
        frozen: false,
        paused: packdraw.paused || false
      }));
    } catch (e) {
      console.error('Leaderboard fetch error:', e);
      const config = loadConfig();
      const packdraw = config.packdraw;
      if (packdraw.cachedData) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          data: packdraw.cachedData,
          startDate: packdraw.startDate,
          endDate: packdraw.endDate,
          prizePool: packdraw.prizePool || 1000,
          prizes: packdraw.prizes || [250, 125, 75, 50, 50, 50, 50, 50, 50, 50],
          frozen: false,
          paused: packdraw.paused || false,
          error: 'Using cached data'
        }));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to fetch leaderboard' }));
      }
    }
    return;
  }

  // Solpump leaderboard (manual entries)
  if (pathname === '/api/leaderboard/solpump' && req.method === 'GET') {
    const config = loadConfig();
    const solpump = config.solpump;
    const entries = solpump.entries || [];
    entries.sort((a, b) => b.wagerAmount - a.wagerAmount);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      entries: entries,
      startDate: solpump.startDate,
      endDate: solpump.endDate,
      prizePool: solpump.prizePool,
      wagerUnit: solpump.wagerUnit || 'SOL',
      prizes: solpump.prizes,
      paused: solpump.paused || false
    }));
    return;
  }

  // Stake leaderboard (manual entries)
  if (pathname === '/api/leaderboard/stake' && req.method === 'GET') {
    const config = loadConfig();
    const stake = config.stake;
    const entries = stake.entries || [];
    entries.sort((a, b) => b.wagerAmount - a.wagerAmount);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      entries: entries,
      startDate: stake.startDate,
      endDate: stake.endDate,
      prizePool: stake.prizePool,
      wagerUnit: stake.wagerUnit || 'USD',
      prizes: stake.prizes,
      paused: stake.paused || false
    }));
    return;
  }

  // Add/update entry for manual leaderboards
  if ((pathname === '/api/leaderboard/solpump/entry' || pathname === '/api/leaderboard/stake/entry') && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      if (body.password !== ADMIN_PASSWORD) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
      
      const lb = pathname.includes('solpump') ? 'solpump' : 'stake';
      const config = loadConfig();
      
      if (!config[lb].entries) config[lb].entries = [];
      
      const entry = {
        id: body.id || Date.now().toString(),
        username: body.username,
        wagerAmount: Number(body.wagerAmount)
      };
      
      // Update or add
      const existingIndex = config[lb].entries.findIndex(e => e.id === entry.id);
      if (existingIndex >= 0) {
        config[lb].entries[existingIndex] = entry;
      } else {
        config[lb].entries.push(entry);
      }
      
      saveConfig(config);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, entry }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid request' }));
    }
    return;
  }

  // Delete entry from manual leaderboards
  if ((pathname === '/api/leaderboard/solpump/entry' || pathname === '/api/leaderboard/stake/entry') && req.method === 'DELETE') {
    try {
      const body = await parseBody(req);
      if (body.password !== ADMIN_PASSWORD) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
      
      const lb = pathname.includes('solpump') ? 'solpump' : 'stake';
      const config = loadConfig();
      
      if (config[lb].entries) {
        config[lb].entries = config[lb].entries.filter(e => e.id !== body.id);
        saveConfig(config);
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid request' }));
    }
    return;
  }

  // Bulk save slots (replaces all entries)
  if ((pathname === '/api/leaderboard/solpump/slots' || pathname === '/api/leaderboard/stake/slots') && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      if (body.password !== ADMIN_PASSWORD) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
      
      const lb = pathname.includes('solpump') ? 'solpump' : 'stake';
      const config = loadConfig();
      
      // Replace all entries with the new slots (only non-empty ones)
      config[lb].entries = (body.entries || []).filter(e => e.username && e.wagerAmount > 0);
      
      saveConfig(config);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, count: config[lb].entries.length }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid request' }));
    }
    return;
  }

  // Serve static files
  let filePath = '.' + pathname;
  if (filePath === './') {
    filePath = './index.html';
  }

  if (filePath.endsWith('/')) {
    filePath += 'index.html';
  }

  const tryFile = (fPath) => {
    fs.stat(fPath, (err, stats) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404);
          res.end('File not found');
        } else {
          res.writeHead(500);
          res.end('Server error');
        }
        return;
      }

      if (stats.isDirectory()) {
        tryFile(path.join(fPath, 'index.html'));
        return;
      }

      const extname = path.extname(fPath).toLowerCase();
      const contentType = mimeTypes[extname] || 'application/octet-stream';

      fs.readFile(fPath, (error, content) => {
        if (error) {
          res.writeHead(500);
          res.end('Server error');
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content, 'utf-8');
        }
      });
    });
  };

  tryFile(filePath);
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
  const config = loadConfig();
  saveConfig(config);
});
