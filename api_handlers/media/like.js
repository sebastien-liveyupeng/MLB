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
    .select('id, like_count')
    .eq('id', postId)
    .single();

  if (postError || !post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const { data: existingLike } = await supabase
    .from('media_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', auth.userId)
    .maybeSingle();

  let liked = false;
  let likeCount = post.like_count || 0;

  if (existingLike) {
    await supabase
      .from('media_likes')
      .delete()
      .eq('id', existingLike.id);
    likeCount = Math.max(0, likeCount - 1);
  } else {
    await supabase
      .from('media_likes')
      .insert([{ post_id: postId, user_id: auth.userId, created_at: new Date().toISOString() }]);
    likeCount += 1;
    liked = true;
  }

  const { data: updatedPost, error: updateError } = await supabase
    .from('media_posts')
    .update({ like_count: likeCount })
    .eq('id', postId)
    .select('like_count')
    .single();

  if (updateError) {
    return res.status(500).json({ error: 'Failed to update like' });
  }

  return res.status(200).json({
    success: true,
    liked,
    like_count: updatedPost.like_count
  });
};
