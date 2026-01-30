const url = require('url');
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

function buildUsersMap(usersData, targetIds) {
  const usersMap = new Map();
  (usersData?.users || []).forEach(account => {
    if (targetIds.has(account.id)) {
      usersMap.set(account.id, {
        id: account.id,
        email: account.email,
        username: account.user_metadata?.username || account.email?.split('@')[0] || 'Membre'
      });
    }
  });
  return usersMap;
}

function getUsername(usersMap, userId, fallback) {
  if (fallback) return fallback;
  return usersMap.get(userId)?.username || 'Membre';
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

  const parsedUrl = url.parse(req.url, true);
  const limit = Math.min(Math.max(parseInt(parsedUrl.query.limit || '40', 10), 5), 100);

  try {
    const { data: posts, error: postsError } = await supabase
      .from('media_posts')
      .select('id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (postsError) {
      console.error('Media posts error:', postsError);
      return res.status(500).json({ error: 'Failed to fetch media posts' });
    }

    const postIds = (posts || []).map(post => post.id);

    let likes = [];
    let comments = [];

    if (postIds.length > 0) {
      const { data: likesData, error: likesError } = await supabase
        .from('media_likes')
        .select('post_id, user_id, created_at')
        .in('post_id', postIds)
        .order('created_at', { ascending: false })
        .limit(50);

      if (likesError) {
        console.error('Likes fetch error:', likesError);
        return res.status(500).json({ error: 'Failed to fetch likes' });
      }

      const { data: commentsData, error: commentsError } = await supabase
        .from('media_comments')
        .select('post_id, user_id, username, content, created_at')
        .in('post_id', postIds)
        .order('created_at', { ascending: false })
        .limit(50);

      if (commentsError) {
        console.error('Comments fetch error:', commentsError);
        return res.status(500).json({ error: 'Failed to fetch comments' });
      }

      likes = likesData || [];
      comments = commentsData || [];
    }

    const { data: incoming, error: incomingError } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('status', 'pending')
      .eq('addressee_id', userId)
      .order('created_at', { ascending: false });

    if (incomingError) {
      console.error('Incoming requests error:', incomingError);
      return res.status(500).json({ error: 'Failed to fetch friend requests' });
    }

    const actorIds = new Set();
    (incoming || []).forEach(reqItem => actorIds.add(reqItem.requester_id));
    likes.forEach(like => actorIds.add(like.user_id));
    comments.forEach(comment => actorIds.add(comment.user_id));

    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (usersError) {
      console.error('Users fetch error:', usersError);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    const usersMap = buildUsersMap(usersData, actorIds);

    const items = [];

    (incoming || []).forEach(request => {
      items.push({
        type: 'friend_request',
        created_at: request.created_at,
        request_id: request.id,
        from_user: {
          id: request.requester_id,
          username: getUsername(usersMap, request.requester_id)
        }
      });
    });

    likes
      .filter(like => like.user_id !== userId)
      .forEach(like => {
        items.push({
          type: 'like',
          created_at: like.created_at,
          post_id: like.post_id,
          from_user: {
            id: like.user_id,
            username: getUsername(usersMap, like.user_id)
          }
        });
      });

    comments
      .filter(comment => comment.user_id !== userId)
      .forEach(comment => {
        items.push({
          type: 'comment',
          created_at: comment.created_at,
          post_id: comment.post_id,
          content: comment.content,
          from_user: {
            id: comment.user_id,
            username: getUsername(usersMap, comment.user_id, comment.username)
          }
        });
      });

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const limitedItems = items.slice(0, limit);

    const counts = {
      total: limitedItems.length,
      friend_requests: limitedItems.filter(item => item.type === 'friend_request').length,
      likes: limitedItems.filter(item => item.type === 'like').length,
      comments: limitedItems.filter(item => item.type === 'comment').length
    };

    return res.status(200).json({
      success: true,
      counts,
      items: limitedItems
    });
  } catch (error) {
    console.error('Notifications error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
