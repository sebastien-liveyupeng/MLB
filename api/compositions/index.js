const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError || !user) {
    return res.status(401).json({ error: 'User not found' });
  }

  if (req.method === 'GET') {
    try {
      const { data: sharedLinks, error: sharedError } = await supabase
        .from('composition_members')
        .select('composition_id')
        .eq('member_id', userId);

      let sharedIds = [];
      if (sharedError) {
        const message = sharedError.message || '';
        if (message.includes('composition_members') && message.includes('does not exist')) {
          sharedIds = [];
        } else {
          console.error('Shared compositions error:', sharedError);
          return res.status(500).json({ error: 'Failed to fetch shared compositions' });
        }
      } else {
        sharedIds = (sharedLinks || []).map(item => item.composition_id);
      }
      const uniqueIds = Array.from(new Set(sharedIds));

      let query = supabase
        .from('compositions')
        .select('*')
        .order('created_at', { ascending: false });

      if (uniqueIds.length > 0) {
        query = query.or(`owner_id.eq.${userId},id.in.(${uniqueIds.join(',')})`);
      } else {
        query = query.eq('owner_id', userId);
      }

      const { data: compositions, error } = await query;

      if (error) {
        console.error('Database error:', error);
        return res.status(500).json({ error: 'Failed to fetch compositions' });
      }

      return res.status(200).json({
        success: true,
        compositions: compositions || []
      });
    } catch (error) {
      console.error('Compositions fetch error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {
          return res.status(400).json({ error: 'Invalid JSON' });
        }
      }

      const { name, heroes, shared_with } = body || {};

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
      }

      if (!Array.isArray(heroes)) {
        return res.status(400).json({ error: 'Heroes must be an array' });
      }

      const normalizedHeroes = heroes
        .filter(hero => hero && hero.name && hero.role)
        .map(hero => ({
          name: String(hero.name).trim(),
          role: String(hero.role).trim()
        }))
        .filter(hero => hero.name.length > 0 && hero.role.length > 0)
        .slice(0, 5);

      if (normalizedHeroes.length === 0) {
        return res.status(400).json({ error: 'At least one hero is required' });
      }

      const ownerUsername = user.user_metadata?.username || user.email?.split('@')[0] || 'Membre';

      const { data, error } = await supabase
        .from('compositions')
        .insert([
          {
            name: name.trim(),
            owner_id: userId,
            owner_username: ownerUsername,
            is_shared: Array.isArray(shared_with) && shared_with.length > 0,
            heroes: normalizedHeroes,
            created_at: new Date().toISOString()
          }
        ])
        .select();

      if (error) {
        console.error('Database insert error:', error);
        return res.status(500).json({ error: 'Failed to save composition' });
      }

      const composition = data[0];
      const membersToShare = Array.isArray(shared_with)
        ? shared_with
            .filter(memberId => typeof memberId === 'string' && memberId.trim())
            .map(memberId => memberId.trim())
        : [];

      if (membersToShare.length > 0) {
        const uniqueMembers = Array.from(new Set(membersToShare));
        const links = uniqueMembers.map(memberId => ({
          composition_id: composition.id,
          member_id: memberId
        }));

        const { error: linkError } = await supabase
          .from('composition_members')
          .insert(links);

        if (linkError) {
          console.error('Share insert error:', linkError);
          return res.status(500).json({ error: 'Failed to share composition' });
        }
      }

      return res.status(201).json({
        success: true,
        composition
      });
    } catch (error) {
      console.error('Compositions save error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
