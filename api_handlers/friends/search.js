const { createClient } = require('@supabase/supabase-js');

function getUserIdFromRequest(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return decodedToken.sub;
  } catch (e) {
    res.status(401).json({ error: 'Invalid token format' });
    return null;
  }
}

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

  const userId = getUserIdFromRequest(req, res);
  if (!userId) return;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase env variables missing' });
  }

  const url = new URL(req.url, 'http://localhost');
  const query = (url.searchParams.get('q') || '').trim().toLowerCase();

  if (!query || query.length < 2) {
    return res.status(400).json({ error: 'Query too short' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError || !user) {
    return res.status(401).json({ error: 'User not found' });
  }

  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (usersError) {
    console.error('Users fetch error:', usersError);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }

  const candidates = (usersData?.users || [])
    .filter(account => account.id !== userId)
    .map(account => ({
      id: account.id,
      email: account.email,
      username: account.user_metadata?.username || account.email?.split('@')[0] || 'Membre'
    }))
    .filter(account =>
      account.email?.toLowerCase().includes(query)
      || account.username?.toLowerCase().includes(query)
    )
    .slice(0, 20);

  if (candidates.length === 0) {
    return res.status(200).json({ success: true, users: [] });
  }

  const ids = candidates.map(user => user.id);

  const { data: relationships, error: relError } = await supabase
    .from('friend_requests')
    .select('*')
    .or(
      `and(requester_id.eq.${userId},addressee_id.in.(${ids.join(',')})),and(requester_id.in.(${ids.join(',')}),addressee_id.eq.${userId})`
    );

  if (relError) {
    console.error('Relationship fetch error:', relError);
    return res.status(500).json({ error: 'Failed to fetch relationships' });
  }

  const statusByUser = new Map();
  (relationships || []).forEach(rel => {
    const otherId = rel.requester_id === userId ? rel.addressee_id : rel.requester_id;
    if (rel.status === 'accepted') {
      statusByUser.set(otherId, 'friends');
    } else if (rel.status === 'pending') {
      if (rel.requester_id === userId) {
        statusByUser.set(otherId, 'outgoing');
      } else {
        statusByUser.set(otherId, 'incoming');
      }
    } else {
      statusByUser.set(otherId, rel.status || 'none');
    }
  });

  const users = candidates.map(user => ({
    ...user,
    status: statusByUser.get(user.id) || 'none'
  }));

  return res.status(200).json({ success: true, users });
};
