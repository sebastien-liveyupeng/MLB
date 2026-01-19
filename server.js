const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
require('dotenv').config({ path: '.env.local' });

const PORT = 3002;

// Simple in-memory session store (utilise une vraie DB en prod!)
const sessions = {};

function generateSessionId() {
  return require('crypto').randomBytes(32).toString('hex');
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API Routes
  if (pathname.startsWith('/api/')) {
    let apiPath = pathname.slice(5);
    if (apiPath === 'auth/signup') {
      handleSignup(req, res);
      return;
    } else if (apiPath === 'auth/login') {
      handleLogin(req, res);
      return;
    } else if (apiPath === 'auth/logout') {
      handleLogout(req, res);
      return;
    } else if (apiPath === 'auth/session') {
      handleSessionCheck(req, res);
      return;
    }
  }

  // Rewrites
  const rewrites = {
    '/': '/index.html',
    '/tournois': '/tournois.html',
    '/contact': '/contact.html',
    '/equipe': '/equipe.html',
    '/roster-europe': '/roster-europe.html',
    '/roster-feminin': '/roster-feminin.html',
    '/roster-masculin': '/roster-masculin.html',
    '/apropos': '/apropos.html',
    '/galerie': '/galerie.html',
    '/auth': '/auth.html'
  };

  if (rewrites[pathname]) {
    pathname = rewrites[pathname];
  }

  // Serve static files
  const filePath = path.join(__dirname, pathname);
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath);
    let contentType = 'text/html';
    if (ext === '.js') contentType = 'application/javascript';
    if (ext === '.css') contentType = 'text/css';
    if (ext === '.json') contentType = 'application/json';
    if (ext === '.avif') contentType = 'image/avif';
    if (ext === '.png') contentType = 'image/png';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

function getSessionIdFromCookie(req) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [name, value] = cookie.trim().split('=');
    acc[name] = value;
    return acc;
  }, {});
  return cookies.sessionId;
}

async function handleSignup(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const { email, password, username } = JSON.parse(body);

      if (!email || !password || !username) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Email, password, and username required' }));
        return;
      }

      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        user_metadata: { username },
        email_confirm: true
      });

      if (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Utilisateur créé avec succès',
        user: {
          id: data.user.id,
          email: data.user.email,
          username
        }
      }));
    } catch (error) {
      console.error('Signup error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });
}

async function handleLogin(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const { email, password } = JSON.parse(body);

      if (!email || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Email and password required' }));
        return;
      }

      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('Login error details:', error);
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }

      // Créer une session sécurisée
      const sessionId = generateSessionId();
      sessions[sessionId] = {
        user: {
          id: data.user.id,
          email: data.user.email,
          username: data.user.user_metadata?.username
        },
        createdAt: Date.now(),
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 jours
      };

      // Envoyer le sessionId dans un cookie HTTP-only
      res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Connexion réussie'
      }));
    } catch (error) {
      console.error('Login error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });
}

function handleLogout(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const sessionId = getSessionIdFromCookie(req);
  if (sessionId) {
    delete sessions[sessionId];
  }

  res.setHeader('Set-Cookie', 'sessionId=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: true,
    message: 'Déconnexion réussie'
  }));
}

function handleSessionCheck(req, res) {
  const sessionId = getSessionIdFromCookie(req);
  
  if (!sessionId || !sessions[sessionId]) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not authenticated' }));
    return;
  }

  const session = sessions[sessionId];
  
  // Vérifier l'expiration
  if (session.expiresAt < Date.now()) {
    delete sessions[sessionId];
    res.setHeader('Set-Cookie', 'sessionId=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Session expired' }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    authenticated: true,
    user: session.user
  }));
}

server.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📄 Static files served from: ${__dirname}`);
  console.log(`🔌 API routes available at /api/auth/*\n`);
});
