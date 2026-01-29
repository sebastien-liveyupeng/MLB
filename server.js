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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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
    } else if (apiPath === 'compositions') {
      handleCompositions(req, res);
      return;
    } else if (apiPath === 'compositions/share') {
      handleShareComposition(req, res);
      return;
    } else if (apiPath === 'users') {
      handleUsers(req, res);
      return;
    }
  }

  // Rewrites
  const rewrites = {
    '/': '/index.html',
    '/tournois': '/tournois.html',
    '/contact': '/contact.html',
    '/equipe': '/equipe.html',
    '/compositions': '/compositions.html',
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
          // Use service role key to verify the token
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
          );

          const { data: { user }, error } = await supabase.auth.admin.getUserById(
            // Extract user ID from token JWT
            JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).sub
          );

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
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid token' }));
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
        
        // Extract user ID from token
        let userId;
        try {
          const decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
          userId = decodedToken.sub;
        } catch (e) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid token format' }));
          return;
        }

        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Get current user
        const { data: { user }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);

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

async function handleCompositions(req, res) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not authenticated' }));
    return;
  }

  const token = authHeader.substring(7);
  let userId;

  try {
    const decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    userId = decodedToken.sub;
  } catch (e) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid token format' }));
    return;
  }

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Supabase env variables missing' }));
      return;
    }

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'User not found' }));
      return;
    }

    if (req.method === 'GET') {
      const { data: sharedLinks, error: sharedError } = await supabase
        .from('composition_members')
        .select('composition_id')
        .eq('member_id', userId);

      let sharedIds = [];
      if (sharedError) {
        const message = sharedError.message || '';
        if (message.includes('composition_members') && message.includes('does not exist')) {
          sharedIds = [];
        } else {
          console.error('Shared compositions error:', sharedError);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to fetch shared compositions' }));
          return;
        }
      } else {
        sharedIds = (sharedLinks || []).map(item => item.composition_id);
      }
      const uniqueIds = Array.from(new Set(sharedIds));

      let query = supabase
        .from('compositions')
        .select('*')
        .order('created_at', { ascending: false });

      if (uniqueIds.length > 0) {
        query = query.or(`owner_id.eq.${userId},id.in.(${uniqueIds.join(',')})`);
      } else {
        query = query.eq('owner_id', userId);
      }

      const { data: compositions, error } = await query;

      if (error) {
        const message = error.message || '';
        if (message.includes('compositions') && message.includes('does not exist')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Table compositions missing' }));
          return;
        }
        console.error('Database error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to fetch compositions' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        compositions: compositions || []
      }));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const parsedBody = JSON.parse(body || '{}');
          const { name, heroes, shared_with } = parsedBody;

          if (!name || !name.trim()) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Name is required' }));
            return;
          }

          if (!Array.isArray(heroes)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Heroes must be an array' }));
            return;
          }

          const normalizedHeroes = heroes
            .filter(hero => hero && hero.name && hero.role)
            .map(hero => ({
              name: String(hero.name).trim(),
              role: String(hero.role).trim()
            }))
            .filter(hero => hero.name.length > 0 && hero.role.length > 0)
            .slice(0, 5);

          if (normalizedHeroes.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'At least one hero is required' }));
            return;
          }

          const ownerUsername = user.user_metadata?.username || user.email?.split('@')[0] || 'Membre';

          const { data, error } = await supabase
            .from('compositions')
            .insert([
              {
                name: name.trim(),
                owner_id: userId,
                owner_username: ownerUsername,
                is_shared: Array.isArray(shared_with) && shared_with.length > 0,
                heroes: normalizedHeroes,
                created_at: new Date().toISOString()
              }
            ])
            .select();

          if (error) {
            const message = error.message || '';
            if (message.includes('compositions') && message.includes('does not exist')) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Table compositions missing' }));
              return;
            }
            console.error('Database insert error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to save composition' }));
            return;
          }

          const composition = data[0];
          const membersToShare = Array.isArray(shared_with)
            ? shared_with
                .filter(memberId => typeof memberId === 'string' && memberId.trim())
                .map(memberId => memberId.trim())
            : [];

          if (membersToShare.length > 0) {
            const uniqueMembers = Array.from(new Set(membersToShare));
            const links = uniqueMembers.map(memberId => ({
              composition_id: composition.id,
              member_id: memberId
            }));

            const { error: linkError } = await supabase
              .from('composition_members')
              .insert(links);

            if (linkError) {
              const message = linkError.message || '';
              if (message.includes('composition_members') && message.includes('does not exist')) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Table composition_members missing' }));
                return;
              }
              console.error('Share insert error:', linkError);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Failed to share composition' }));
              return;
            }
          }

          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            composition
          }));
        } catch (error) {
          console.error('Compositions save error:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      });
      return;
    }

    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
  } catch (error) {
    console.error('Compositions handler error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

async function handleUsers(req, res) {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not authenticated' }));
    return;
  }

  const token = authHeader.substring(7);
  let userId;

  try {
    const decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    userId = decodedToken.sub;
  } catch (e) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid token format' }));
    return;
  }

  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'User not found' }));
      return;
    }

    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error) {
      console.error('Users fetch error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to fetch users' }));
      return;
    }

    const users = (data?.users || [])
      .filter(account => account.id !== userId)
      .map(account => ({
        id: account.id,
        email: account.email,
        username: account.user_metadata?.username || account.email?.split('@')[0] || 'Membre'
      }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, users }));
  } catch (error) {
    console.error('Users handler error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

async function handleShareComposition(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not authenticated' }));
    return;
  }

  const token = authHeader.substring(7);
  let userId;

  try {
    const decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    userId = decodedToken.sub;
  } catch (e) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid token format' }));
    return;
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Supabase env variables missing' }));
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const parsedBody = JSON.parse(body || '{}');
      const { composition_id, member_ids } = parsedBody;

      if (!composition_id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'composition_id is required' }));
        return;
      }

      if (!Array.isArray(member_ids) || member_ids.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'member_ids is required' }));
        return;
      }

      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data: composition, error: compositionError } = await supabase
        .from('compositions')
        .select('*')
        .eq('id', composition_id)
        .single();

      if (compositionError || !composition) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Composition not found' }));
        return;
      }

      if (composition.owner_id !== userId) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not allowed' }));
        return;
      }

      const uniqueMembers = Array.from(new Set(member_ids.filter(id => typeof id === 'string' && id.trim())));
      const links = uniqueMembers.map(memberId => ({
        composition_id,
        member_id: memberId
      }));

      const { error: linkError } = await supabase
        .from('composition_members')
        .insert(links);

      if (linkError) {
        const message = linkError.message || '';
        if (message.includes('composition_members') && message.includes('does not exist')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Table composition_members missing' }));
          return;
        }
        console.error('Share insert error:', linkError);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to share composition' }));
        return;
      }

      await supabase
        .from('compositions')
        .update({ is_shared: true })
        .eq('id', composition_id);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (error) {
      console.error('Share handler error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });
}

server.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📄 Static files served from: ${__dirname}`);
  console.log(`🔌 API routes available at /api/auth/*, /api/compositions, /api/compositions/share, /api/users\n`);
});
