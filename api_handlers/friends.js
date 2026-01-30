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

function getSupabaseOrFail(res) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: 'Supabase env variables missing' });
    return null;
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function ensureUser(supabase, userId, res) {
  const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError || !user) {
    res.status(401).json({ error: 'User not found' });
    return null;
  }
  return user;
}

async function handleList(req, res, supabase, userId) {
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
}

async function handleSearch(req, res, supabase, userId, query) {
  if (!query || query.length < 2) {
    return res.status(400).json({ error: 'Query too short' });
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
}

async function handleRequest(req, res, supabase, userId, targetUserId) {
  if (!targetUserId) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  if (targetUserId === userId) {
    return res.status(400).json({ error: 'Cannot add yourself' });
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
}

async function handleRespond(req, res, supabase, userId, requestId, decision) {
  if (!requestId || !decision) {
    return res.status(400).json({ error: 'request_id and decision are required' });
  }

  if (!['accept', 'decline'].includes(decision)) {
    return res.status(400).json({ error: 'Invalid decision' });
  }

  const { data: request, error: requestError } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (requestError || !request) {
    return res.status(404).json({ error: 'Request not found' });
  }

  if (request.addressee_id !== userId) {
    return res.status(403).json({ error: 'Not allowed' });
  }

  if (request.status !== 'pending') {
    return res.status(400).json({ error: 'Request already handled' });
  }

  const newStatus = decision === 'accept' ? 'accepted' : 'declined';

  const { error: updateError } = await supabase
    .from('friend_requests')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', requestId);

  if (updateError) {
    console.error('Friend request update error:', updateError);
    return res.status(500).json({ error: 'Failed to update request' });
  }

  return res.status(200).json({ success: true, status: newStatus });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const userId = getUserIdFromRequest(req, res);
  if (!userId) return;

  const supabase = getSupabaseOrFail(res);
  if (!supabase) return;

  const user = await ensureUser(supabase, userId, res);
  if (!user) return;

  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    const query = (url.searchParams.get('q') || '').trim().toLowerCase();
    const mode = (url.searchParams.get('mode') || '').toLowerCase();

    if (mode === 'search' || query) {
      return handleSearch(req, res, supabase, userId, query);
    }

    return handleList(req, res, supabase, userId);
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON' });
      }
    }

    const { action, user_id, request_id, decision } = body || {};

    if (action === 'request') {
      return handleRequest(req, res, supabase, userId, user_id);
    }

    if (action === 'respond') {
      return handleRespond(req, res, supabase, userId, request_id, decision);
    }

    return res.status(400).json({ error: 'Invalid action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
