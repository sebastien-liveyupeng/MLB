const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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
    const decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    userId = decodedToken.sub;
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token format' });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });

    if (error) {
      console.error('Users fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    const users = (data?.users || []).map(account => ({
      id: account.id,
      email: account.email,
      username: account.user_metadata?.username || account.email?.split('@')[0] || 'Membre'
    }));

    return res.status(200).json({ success: true, users });
  } catch (error) {
    console.error('Users handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
