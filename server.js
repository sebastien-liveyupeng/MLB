const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
require('dotenv').config({ path: '.env.local' });

const PORT = 3002;

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
    } else if (apiPath === 'auth/profile') {
      handleProfile(req, res);
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

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Connexion réussie',
        user: {
          id: data.user.id,
          email: data.user.email,
          username: data.user.user_metadata?.username
        },
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        }
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

  // Le logout côté client se fait en supprimant le token du localStorage
  // Cette route ne fait que confirmer
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: true,
    message: 'Déconnexion réussie'
  }));
}

function handleSessionCheck(req, res) {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    // Pour le frontend, on stocke la session côté client avec le token
    // Cette route vérifie juste que l'utilisateur existe via le token Bearer
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not authenticated' }));
      return;
    }

    const token = authHeader.substring(7);
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Vérifier le token avec Supabase
    // getUser utilise le token JWT pour vérifier l'authentification
    (async () => {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session invalid' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.user_metadata?.username
        }
      }));
    })();
  } catch (error) {
    console.error('Session error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

function handleProfile(req, res) {
  if (req.method === 'GET') {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
      }

      const token = authHeader.substring(7);
      const { createClient } = require('@supabase/supabase-js');
      
      (async () => {
        try {
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          );

          const { data: { user }, error } = await supabase.auth.getUser(token);

          if (error || !user) {
            console.error('Auth error:', error);
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Session invalid' }));
            return;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            user: {
              id: user.id,
              email: user.email,
              username: user.user_metadata?.username || ''
            }
          }));
        } catch (err) {
          console.error('Profile error:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      })();
    } catch (error) {
      console.error('Profile fetch error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  } else if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not authenticated' }));
          return;
        }

        const token = authHeader.substring(7);
        let body_data;
        try {
          body_data = JSON.parse(body);
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
          return;
        }

        const { username, email, currentPassword, newPassword } = body_data;

        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );

        const { data: { user }, error: getUserError } = await supabase.auth.getUser(token);

        if (getUserError || !user) {
          console.error('User fetch error:', getUserError);
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Session invalid' }));
          return;
        }

        // Si on change le mot de passe, d'abord vérifier le mot de passe actuel
        if (newPassword && newPassword.trim()) {
          const supabaseSignIn = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          );

          const { error: signInError } = await supabaseSignIn.auth.signInWithPassword({
            email: user.email,
            password: currentPassword || ''
          });

          if (signInError) {
            console.error('SignIn error:', signInError);
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Mot de passe actuel incorrect' }));
            return;
          }
        }

        // Préparer les updates
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const updatePayload = {
          user_metadata: {
            username: username || user.user_metadata?.username
          }
        };

        // Si un nouveau mot de passe
        if (newPassword && newPassword.trim()) {
          updatePayload.password = newPassword;
        }

        // Si un nouvel email
        if (email && email !== user.email) {
          updatePayload.email = email;
        }

        const { data, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          user.id,
          updatePayload
        );

        if (updateError) {
          console.error('Update error:', updateError);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: updateError.message || 'Erreur lors de la mise à jour' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'Profil mis à jour avec succès',
          user: {
            id: data.user.id,
            email: data.user.email,
            username: data.user.user_metadata?.username
          }
        }));
      } catch (error) {
        console.error('Profile update error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error: ' + error.message }));
      }
    });
  } else {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
}

server.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📄 Static files served from: ${__dirname}`);
  console.log(`🔌 API routes available at /api/auth/*\n`);
});
