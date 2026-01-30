const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST - Envoyer un nouveau message
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

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Get user info
      const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
      if (userError || !user) {
        return res.status(401).json({ error: 'User not found' });
      }

      // Parse message from request body
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {
          return res.status(400).json({ error: 'Invalid JSON' });
        }
      }

      const { message } = body || {};

      if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message cannot be empty' });
      }

      if (message.length > 500) {
        return res.status(400).json({ error: 'Message too long (max 500 characters)' });
      }

      // Insert message into database
      const { data, error } = await supabase
        .from('messages')
        .insert([
          {
            user_id: userId,
            email: user.email,
            username: user.user_metadata?.username || user.email.split('@')[0],
            message: message.trim(),
            created_at: new Date().toISOString()
          }
        ])
        .select();

      if (error) {
        console.error('Database insert error:', error);
        return res.status(500).json({ error: 'Failed to save message' });
      }

      return res.status(201).json({
        success: true,
        message: data[0]
      });
    } catch (error) {
      console.error('Send message error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
