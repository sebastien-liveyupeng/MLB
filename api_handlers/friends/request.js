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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = getUserIdFromRequest(req, res);
  if (!userId) return;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase env variables missing' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }

  const { user_id: targetUserId } = body || {};

  if (!targetUserId) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  if (targetUserId === userId) {
    return res.status(400).json({ error: 'Cannot add yourself' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError || !user) {
    return res.status(401).json({ error: 'User not found' });
  }

  const { data: { user: targetUser }, error: targetError } = await supabase.auth.admin.getUserById(targetUserId);
  if (targetError || !targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { data: existing, error: existingError } = await supabase
    .from('friend_requests')
    .select('*')
    .or(`and(requester_id.eq.${userId},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${userId})`)
    .limit(1);

  if (existingError) {
    const message = existingError.message || '';
    if (message.includes('friend_requests') && message.includes('does not exist')) {
      return res.status(400).json({ error: 'Table friend_requests missing' });
    }
    console.error('Friend request check error:', existingError);
    return res.status(500).json({ error: 'Failed to check existing requests' });
  }

  if (existing && existing.length > 0) {
    const status = existing[0].status;
    if (status === 'accepted') {
      return res.status(400).json({ error: 'Already friends' });
    }
    if (status === 'pending') {
      return res.status(400).json({ error: 'Request already pending' });
    }
  }

  const { error: insertError } = await supabase
    .from('friend_requests')
    .insert([
      {
        requester_id: userId,
        addressee_id: targetUserId,
        status: 'pending',
        created_at: new Date().toISOString()
      }
    ]);

  if (insertError) {
    console.error('Friend request insert error:', insertError);
    return res.status(500).json({ error: 'Failed to send friend request' });
  }

  return res.status(201).json({ success: true });
};
