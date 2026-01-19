const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('Raw req.body:', req.body, 'Type:', typeof req.body);

  // Parse body si c'est une string
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      console.error('JSON parse error:', e);
      return res.status(400).json({ error: 'Invalid JSON in request body' });
    }
  }

  console.log('Parsed body:', body);

  const { email, password } = body || {};

  console.log('Email:', email, 'Password:', password ? '***' : 'undefined');

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    console.log('Creating Supabase client...');
    console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET');
    console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    console.log('Attempting login with email:', email);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      console.error('Supabase auth error:', error);
      return res.status(401).json({ error: error.message });
    }

    console.log('Login successful for:', email);
    console.log('User metadata:', data.user.user_metadata);
    console.log('Username:', data.user.user_metadata?.username);

    let username = data.user.user_metadata?.username;
    
    // If no username in metadata, try to fetch from user_profiles table
    if (!username) {
      console.log('No username in metadata, checking user_profiles table...');
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('username')
          .eq('id', data.user.id)
          .single();
        
        if (!profileError && profileData) {
          username = profileData.username;
          console.log('Found username in user_profiles:', username);
        }
      } catch (e) {
        console.log('Could not check user_profiles table:', e.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Connexion réussie',
      user: {
        id: data.user.id,
        email: data.user.email,
        username: username
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      }
    });
  } catch (error) {
    console.error('Login error:', error.message, error.stack);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
};
