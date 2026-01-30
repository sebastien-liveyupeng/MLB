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

  const { request_id, action } = body || {};

  if (!request_id || !action) {
    return res.status(400).json({ error: 'request_id and action are required' });
  }

  if (!['accept', 'decline'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError || !user) {
    return res.status(401).json({ error: 'User not found' });
  }

  const { data: request, error: requestError } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('id', request_id)
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

  const newStatus = action === 'accept' ? 'accepted' : 'declined';

  const { error: updateError } = await supabase
    .from('friend_requests')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', request_id);

  if (updateError) {
    console.error('Friend request update error:', updateError);
    return res.status(500).json({ error: 'Failed to update request' });
  }

  return res.status(200).json({ success: true, status: newStatus });
};
