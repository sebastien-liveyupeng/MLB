const { createClient } = require('@supabase/supabase-js');

function getUserIdFromAuthHeader(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Not authenticated' };
  }

  const token = authHeader.substring(7);
  try {
    const decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return { userId: decodedToken.sub };
  } catch (e) {
    return { error: 'Invalid token format' };
  }
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolve(parsed);
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
  });
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

  const auth = getUserIdFromAuthHeader(req);
  if (auth.error) {
    return res.status(401).json({ error: auth.error });
  }

  let payload;
  try {
    payload = await parseJsonBody(req);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { postId } = payload || {};
  if (!postId) {
    return res.status(400).json({ error: 'Post ID required' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: post, error: postError } = await supabase
    .from('media_posts')
    .select('*')
    .eq('id', postId)
    .single();

  if (postError || !post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  if (post.user_id !== auth.userId) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  if (post.file_path) {
    await supabase.storage.from('media').remove([post.file_path]);
  }

  await supabase.from('media_likes').delete().eq('post_id', postId);
  await supabase.from('media_comments').delete().eq('post_id', postId);
  await supabase.from('media_posts').delete().eq('id', postId);

  return res.status(200).json({ success: true });
};
