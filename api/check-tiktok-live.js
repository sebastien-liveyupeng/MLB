export default async function handler(req, res) {
    // Active CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { username } = req.query;

    if (!username) {
        return res.status(400).json({ error: 'Username required' });
    }

    try {
        // Appelle l'API TikTok via RapidAPI
        const url = `https://tiktok-api123.p.rapidapi.com/user/detail/${username}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'x-rapidapi-key': process.env.RAPIDAPI_KEY,
                'x-rapidapi-host': 'tiktok-api123.p.rapidapi.com'
            }
        });

        if (!response.ok) {
            console.error(`API error: ${response.status}`);
            return res.status(200).json({ 
                live: false, 
                error: 'Unable to fetch live status' 
            });
        }

        const data = await response.json();
        
        // Vérifier si l'utilisateur est en live
        // La plupart des APIs TikTok retournent un champ "is_live" ou on vérifie les stats de live
        const isLive = data?.user?.is_live === true || data?.is_live === true || false;

        return res.status(200).json({ 
            live: isLive,
            username: username
        });

    } catch (error) {
        console.error('Error checking TikTok live status:', error);
        return res.status(200).json({ 
            live: false, 
            error: error.message 
        });
    }
}
