const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET - Récupérer tous les messages
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

      // Verify user exists
      const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
      if (userError || !user) {
        return res.status(401).json({ error: 'User not found' });
      }

      // Fetch all messages ordered by creation time
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Database error:', error);
        return res.status(500).json({ error: 'Failed to fetch messages' });
      }

      return res.status(200).json({
        success: true,
        messages: messages || []
      });
    } catch (error) {
      console.error('Chat messages error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
