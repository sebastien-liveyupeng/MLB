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

  const { id, username } = req.query || {};
  if (!id && !username) {
    return res.status(400).json({ error: 'Missing id or username' });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

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
  } catch (error) {
    console.error('Public profile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
