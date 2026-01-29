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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError || !user) {
    return res.status(401).json({ error: 'User not found' });
  }

  try {
    const { data: acceptedLinks, error: acceptedError } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .order('updated_at', { ascending: false });

    if (acceptedError) {
      const message = acceptedError.message || '';
      if (message.includes('friend_requests') && message.includes('does not exist')) {
        return res.status(400).json({ error: 'Table friend_requests missing' });
      }
      console.error('Accepted friends error:', acceptedError);
      return res.status(500).json({ error: 'Failed to fetch friends' });
    }

    const { data: incoming, error: incomingError } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('status', 'pending')
      .eq('addressee_id', userId)
      .order('created_at', { ascending: false });

    if (incomingError) {
      console.error('Incoming requests error:', incomingError);
      return res.status(500).json({ error: 'Failed to fetch incoming requests' });
    }

    const { data: outgoing, error: outgoingError } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('status', 'pending')
      .eq('requester_id', userId)
      .order('created_at', { ascending: false });

    if (outgoingError) {
      console.error('Outgoing requests error:', outgoingError);
      return res.status(500).json({ error: 'Failed to fetch outgoing requests' });
    }

    const userIds = new Set();
    (acceptedLinks || []).forEach(link => {
      userIds.add(link.requester_id);
      userIds.add(link.addressee_id);
    });
    (incoming || []).forEach(link => userIds.add(link.requester_id));
    (outgoing || []).forEach(link => userIds.add(link.addressee_id));

    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (usersError) {
      console.error('Users fetch error:', usersError);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    const usersMap = new Map();
    (usersData?.users || []).forEach(account => {
      if (userIds.has(account.id)) {
        usersMap.set(account.id, {
          id: account.id,
          email: account.email,
          username: account.user_metadata?.username || account.email?.split('@')[0] || 'Membre'
        });
      }
    });

    const friends = (acceptedLinks || [])
      .map(link => {
        const friendId = link.requester_id === userId ? link.addressee_id : link.requester_id;
        return usersMap.get(friendId);
      })
      .filter(Boolean);

    const incomingRequests = (incoming || [])
      .map(link => ({
        id: link.id,
        from_user: usersMap.get(link.requester_id),
        created_at: link.created_at
      }))
      .filter(entry => entry.from_user);

    const outgoingRequests = (outgoing || [])
      .map(link => ({
        id: link.id,
        to_user: usersMap.get(link.addressee_id),
        created_at: link.created_at
      }))
      .filter(entry => entry.to_user);

    return res.status(200).json({
      success: true,
      friends,
      incoming: incomingRequests,
      outgoing: outgoingRequests
    });
  } catch (error) {
    console.error('Friends fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
