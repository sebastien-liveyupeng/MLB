const url = require('url');
const { createClient } = require('@supabase/supabase-js');

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

  const parsedUrl = url.parse(req.url, true);
  const postId = parsedUrl.query.postId;

  if (!postId) {
    return res.status(400).json({ error: 'Post ID required' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: comments, error } = await supabase
    .from('media_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch comments' });
  }

  return res.status(200).json({
    success: true,
    comments: comments || []
  });
};
