const { createClient } = require('@supabase/supabase-js');

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const query = req.query || {};
  const profileMode = query.profile === '1' || query.profile === 'true' || query.id || query.username;
  const avatarMode = query.avatar === '1' || query.avatar === 'true';

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (req.method === 'GET' && profileMode) {
      const { id, username } = query;
      let user = null;

      if (id) {
        const { data: { user: found }, error } = await supabase.auth.admin.getUserById(id);
        if (error || !found) {
          return res.status(404).json({ error: 'User not found' });
        }
        user = found;
      } else {
        const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        if (error) {
          console.error('Users fetch error:', error);
          return res.status(500).json({ error: 'Failed to fetch users' });
        }
        const normalized = String(username).toLowerCase();
        user = (data?.users || []).find(entry => {
          const candidate = entry.user_metadata?.username || entry.email?.split('@')[0] || '';
          return candidate.toLowerCase() === normalized;
        });

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
      }

      return res.status(200).json({
        success: true,
        user: {
          id: user.id,
          username: user.user_metadata?.username || user.email?.split('@')[0] || 'Membre',
          bio: user.user_metadata?.bio || '',
          avatar_url: user.user_metadata?.avatar_url || ''
        }
      });
    }

    if (req.method === 'POST' && avatarMode) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const token = authHeader.substring(7);
      let userId;
      try {
        const decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        userId = decodedToken.sub;
      } catch (e) {
        return res.status(401).json({ error: 'Invalid token format' });
      }

      let body = req.body;
      if (!body || typeof body === 'string') {
        try {
          body = typeof body === 'string' ? JSON.parse(body) : await parseBody(req);
        } catch (error) {
          return res.status(400).json({ error: 'Invalid JSON in request body' });
        }
      }

      const { dataUrl, fileName } = body || {};
      if (!dataUrl) {
        return res.status(400).json({ error: 'Missing dataUrl' });
      }

      const matches = dataUrl.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({ error: 'Unsupported image format' });
      }

      const mimeType = matches[1].replace('image/jpg', 'image/jpeg');
      const base64Data = matches[3];
      const buffer = Buffer.from(base64Data, 'base64');

      if (buffer.length > 2 * 1024 * 1024) {
        return res.status(400).json({ error: 'Image too large (max 2MB).' });
      }

      const extension = mimeType.split('/')[1];
      const safeName = (fileName || 'avatar').replace(/[^a-z0-9-_\.]/gi, '_');
      const filePath = `avatars/${userId}/${Date.now()}_${safeName}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, buffer, {
          contentType: mimeType,
          upsert: true
        });

      if (uploadError) {
        console.error('Avatar upload error:', uploadError);
        return res.status(500).json({ error: 'Upload failed' });
      }

      const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(filePath);

      return res.status(200).json({
        success: true,
        avatar_url: publicUrl?.publicUrl || ''
      });
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const token = authHeader.substring(7);
    let userId;

    try {
      const decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      userId = decodedToken.sub;
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });

    if (error) {
      console.error('Users fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    const includeSelf = query.includeSelf === '1' || query.includeSelf === 'true';
    const users = (data?.users || [])
      .filter(account => includeSelf || account.id !== userId)
      .map(account => ({
        id: account.id,
        email: account.email,
        username: account.user_metadata?.username || account.email?.split('@')[0] || 'Membre',
        bio: account.user_metadata?.bio || '',
        avatar_url: account.user_metadata?.avatar_url || ''
      }));

    return res.status(200).json({ success: true, users });
  } catch (error) {
    console.error('Users handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
