const Busboy = require('busboy');
const path = require('path');
const { randomUUID } = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 200 * 1024 * 1024;

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

function getExtensionFromMime(mimeType) {
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  if (mimeType === 'video/mp4') return '.mp4';
  if (mimeType === 'video/webm') return '.webm';
  if (mimeType === 'video/quicktime') return '.mov';
  return '';
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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(auth.userId);
  if (userError || !user) {
    return res.status(401).json({ error: 'User not found' });
  }

  let fileBufferParts = [];
  let fileMimeType = '';
  let fileName = '';
  let fileSize = 0;
  let caption = '';
  let parseError = null;

  const busboy = Busboy({ headers: req.headers });

  busboy.on('field', (name, value) => {
    if (name === 'caption') {
      caption = value || '';
    }
  });

  busboy.on('file', (fieldname, file, info) => {
    if (fieldname !== 'file') {
      file.resume();
      return;
    }

    fileName = info.filename || 'upload';
    fileMimeType = info.mimeType || '';

    const isImage = ALLOWED_IMAGE_TYPES.includes(fileMimeType);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(fileMimeType);

    if (!isImage && !isVideo) {
      parseError = { status: 400, message: 'Type de fichier non supporté.' };
      file.resume();
      return;
    }

    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

    file.on('data', (data) => {
      if (parseError) {
        return;
      }
      fileSize += data.length;
      if (fileSize > maxSize) {
        parseError = {
          status: 413,
          message: isVideo
            ? 'Vidéo trop lourde (max 200MB).'
            : 'Image trop lourde (max 10MB).'
        };
        file.resume();
        return;
      }
      fileBufferParts.push(data);
    });

    file.on('limit', () => {
      parseError = { status: 413, message: 'Fichier trop volumineux.' };
    });
  });

  busboy.on('finish', async () => {
    if (parseError) {
      return res.status(parseError.status).json({ error: parseError.message });
    }

    if (!fileBufferParts.length || !fileMimeType) {
      return res.status(400).json({ error: 'Aucun fichier reçu.' });
    }

    const mediaType = fileMimeType.startsWith('video/') ? 'video' : 'image';
    const extension = path.extname(fileName) || getExtensionFromMime(fileMimeType);
    const filePath = `${auth.userId}/${Date.now()}-${randomUUID()}${extension}`;

    const fileBuffer = Buffer.concat(fileBufferParts);

    const { error: uploadError } = await supabase
      .storage
      .from('media')
      .upload(filePath, fileBuffer, {
        contentType: fileMimeType,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      return res.status(500).json({ error: 'Upload échoué.' });
    }

    const { data: publicUrlData } = supabase
      .storage
      .from('media')
      .getPublicUrl(filePath);

    const mediaUrl = publicUrlData?.publicUrl;

    const username = user.user_metadata?.username || user.email.split('@')[0];
    const avatarUrl = user.user_metadata?.avatar_url || '';
    const payload = {
      user_id: auth.userId,
      username,
      email: user.email,
      avatar_url: avatarUrl || null,
      media_url: mediaUrl,
      media_type: mediaType,
      caption: caption ? caption.trim() : null,
      created_at: new Date().toISOString(),
      file_path: filePath,
      like_count: 0,
      comment_count: 0
    };

    const { data: postData, error: insertError } = await supabase
      .from('media_posts')
      .insert([payload])
      .select('*')
      .single();

    if (insertError) {
      return res.status(500).json({ error: 'Impossible de sauvegarder le post.' });
    }

    return res.status(201).json({ success: true, post: postData });
  });

  req.pipe(busboy);
};
