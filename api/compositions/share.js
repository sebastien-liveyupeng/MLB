const { createClient } = require('@supabase/supabase-js');

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

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const token = authHeader.substring(7);
  let userId;

  try {
    const decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    userId = decodedToken.sub;
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token format' });
  }

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

  const { composition_id, member_ids } = body || {};

  if (!composition_id) {
    return res.status(400).json({ error: 'composition_id is required' });
  }

  if (!Array.isArray(member_ids) || member_ids.length === 0) {
    return res.status(400).json({ error: 'member_ids is required' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { data: composition, error: compositionError } = await supabase
      .from('compositions')
      .select('*')
      .eq('id', composition_id)
      .single();

    if (compositionError || !composition) {
      return res.status(404).json({ error: 'Composition not found' });
    }

    if (composition.owner_id !== userId) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    const uniqueMembers = Array.from(new Set(member_ids.filter(id => typeof id === 'string' && id.trim())));

    const links = uniqueMembers.map(memberId => ({
      composition_id,
      member_id: memberId
    }));

    const { error: linkError } = await supabase
      .from('composition_members')
      .insert(links);

    if (linkError) {
      const message = linkError.message || '';
      if (message.includes('composition_members') && message.includes('does not exist')) {
        return res.status(400).json({ error: 'Table composition_members missing' });
      }
      console.error('Share insert error:', linkError);
      return res.status(500).json({ error: 'Failed to share composition' });
    }

    await supabase
      .from('compositions')
      .update({ is_shared: true })
      .eq('id', composition_id);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Share handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
