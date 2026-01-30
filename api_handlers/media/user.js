const url = require('url');
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

  const parsedUrl = url.parse(req.url, true);
  const { userId, username, limit } = parsedUrl.query || {};

  if (!userId && !username) {
    return res.status(400).json({ error: 'User ID or username required' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  let resolvedUserId = userId;

  if (!resolvedUserId && username) {
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (usersError) {
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    const normalized = String(username).toLowerCase();
    const match = (usersData?.users || []).find(entry => {
      const candidate = entry.user_metadata?.username || entry.email?.split('@')[0] || '';
      return candidate.toLowerCase() === normalized;
    });

    if (!match) {
      return res.status(404).json({ error: 'User not found' });
    }

    resolvedUserId = match.id;
  }

  const take = Math.min(parseInt(limit || '6', 10), 12);

  const { data: posts, error } = await supabase
    .from('media_posts')
    .select('*')
    .eq('user_id', resolvedUserId)
    .order('created_at', { ascending: false })
    .limit(take);

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch media' });
  }

  return res.status(200).json({
    success: true,
    posts: posts || []
  });
};
