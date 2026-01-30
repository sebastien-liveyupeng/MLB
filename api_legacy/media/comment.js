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

  const { postId, content } = payload || {};
  if (!postId || !content || !content.trim()) {
    return res.status(400).json({ error: 'Post ID and content required' });
  }

  if (content.trim().length > 500) {
    return res.status(400).json({ error: 'Commentaire trop long (max 500 caractères).' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(auth.userId);
  if (userError || !user) {
    return res.status(401).json({ error: 'User not found' });
  }

  const { data: post, error: postError } = await supabase
    .from('media_posts')
    .select('id, comment_count')
    .eq('id', postId)
    .single();

  if (postError || !post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const username = user.user_metadata?.username || user.email.split('@')[0];

  const { data: insertedComment, error: insertError } = await supabase
    .from('media_comments')
    .insert([
      {
        post_id: postId,
        user_id: auth.userId,
        username,
        content: content.trim(),
        created_at: new Date().toISOString()
      }
    ])
    .select('*')
    .single();

  if (insertError) {
    return res.status(500).json({ error: 'Failed to add comment' });
  }

  const newCount = (post.comment_count || 0) + 1;
  await supabase
    .from('media_posts')
    .update({ comment_count: newCount })
    .eq('id', postId);

  return res.status(201).json({
    success: true,
    comment: insertedComment,
    comment_count: newCount
  });
};
