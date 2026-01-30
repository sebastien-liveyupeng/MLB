const url = require('url');
const { createClient } = require('@supabase/supabase-js');

function getUserIdFromAuthHeader(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return decodedToken.sub;
  } catch (e) {
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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const parsedUrl = url.parse(req.url, true);
  const limit = Math.min(parseInt(parsedUrl.query.limit || '10', 10), 50);
  const offset = Math.max(parseInt(parsedUrl.query.offset || '0', 10), 0);

  const { data: posts, error, count } = await supabase
    .from('media_posts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch feed' });
  }

  const userId = getUserIdFromAuthHeader(req);
  let likedPostIds = new Set();

  if (userId && posts && posts.length) {
    const postIds = posts.map(post => post.id);
    const { data: likes } = await supabase
      .from('media_likes')
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', postIds);

    likedPostIds = new Set((likes || []).map(like => like.post_id));
  }

  const enrichedPosts = (posts || []).map(post => ({
    ...post,
    liked_by_me: likedPostIds.has(post.id)
  }));

  return res.status(200).json({
    success: true,
    posts: enrichedPosts,
    hasMore: typeof count === 'number' ? offset + limit < count : (posts || []).length === limit
  });
};
