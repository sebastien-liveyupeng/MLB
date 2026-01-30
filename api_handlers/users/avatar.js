const { createClient } = require('@supabase/supabase-js');

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
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

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || Object.keys(body).length === 0) {
      body = await parseBody(req);
    }
  } catch (error) {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }

  const { dataUrl, fileName } = body || {};
  if (!dataUrl) {
    return res.status(400).json({ error: 'Missing dataUrl' });
  }

  const matches = dataUrl.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/);
  if (!matches) {
    return res.status(400).json({ error: 'Unsupported image format' });
  }

  const mimeType = matches[1].replace('image/jpg', 'image/jpeg');
  const base64Data = matches[3];
  const buffer = Buffer.from(base64Data, 'base64');

  if (buffer.length > 2 * 1024 * 1024) {
    return res.status(400).json({ error: 'Image too large (max 2MB).' });
  }

  const extension = mimeType.split('/')[1];
  const safeName = (fileName || 'avatar').replace(/[^a-z0-9-_\.]/gi, '_');
  const filePath = `avatars/${userId}/${Date.now()}_${safeName}.${extension}`;

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true
      });

    if (uploadError) {
      console.error('Avatar upload error:', uploadError);
      return res.status(500).json({ error: 'Upload failed' });
    }

    const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(filePath);

    return res.status(200).json({
      success: true,
      avatar_url: publicUrl?.publicUrl || ''
    });
  } catch (error) {
    console.error('Avatar handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
