const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET - Récupérer le profil utilisateur
  if (req.method === 'GET') {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const token = authHeader.substring(7);
      
      // Extract user ID from token
      let userId;
      try {
        const decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        userId = decodedToken.sub;
      } catch (e) {
        return res.status(401).json({ error: 'Invalid token format' });
      }

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data: { user }, error } = await supabase.auth.admin.getUserById(userId);

      if (error || !user) {
        return res.status(401).json({ error: 'Session invalid' });
      }

      return res.status(200).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.user_metadata?.username || '',
          bio: user.user_metadata?.bio || '',
          avatar_url: user.user_metadata?.avatar_url || '',
          lanes: user.user_metadata?.lanes || [],
          updated_at: user.updated_at
        }
      });
    } catch (error) {
      console.error('Profile fetch error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // POST - Mettre à jour le profil utilisateur
  if (req.method === 'POST') {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const token = authHeader.substring(7);
      
      // Extract user ID from token
      let userId;
      try {
        const decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        userId = decodedToken.sub;
      } catch (e) {
        return res.status(401).json({ error: 'Invalid token format' });
      }
      
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {
          return res.status(400).json({ error: 'Invalid JSON in request body' });
        }
      }

      const { username, bio, avatar_url, email, newPassword, lanes } = body || {};

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data: { user }, error: getUserError } = await supabase.auth.admin.getUserById(userId);

      if (getUserError || !user) {
        return res.status(401).json({ error: 'Session invalid' });
      }

      // Préparer les métadonnées utilisateur
      const user_metadata = {
        username: username || user.user_metadata?.username,
        bio: typeof bio === 'string' ? bio : (user.user_metadata?.bio || ''),
        avatar_url: avatar_url || user.user_metadata?.avatar_url || '',
        lanes: Array.isArray(lanes) ? lanes.slice(0, 2) : (user.user_metadata?.lanes || [])
      };

      const updatePayload = {
        user_metadata
      };

      if (email && email !== user.email) {
        updatePayload.email = email;
      }

      if (newPassword) {
        updatePayload.password = newPassword;
      }

      // Mettre à jour l'utilisateur
      const { data, error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        updatePayload
      );

      if (updateError) {
        return res.status(400).json({ error: updateError.message });
      }

      return res.status(200).json({
        success: true,
        message: 'Profil mis à jour avec succès',
        user: {
          id: data.user.id,
          email: data.user.email,
          username: data.user.user_metadata?.username,
          bio: data.user.user_metadata?.bio,
          avatar_url: data.user.user_metadata?.avatar_url,
          updated_at: data.user.updated_at
        }
      });
    } catch (error) {
      console.error('Profile update error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
