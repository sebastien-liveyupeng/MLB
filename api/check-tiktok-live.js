export default async function handler(req, res) {
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
        // Méthode 1: Essayer avec TikAPI.io
        const tikApiKey = process.env.TIKAPI_KEY;
        if (tikApiKey) {
            try {
                const tikApiResponse = await fetch(
                    `https://api.tiktok.com/v1/user/@${username}/info`,
                    {
                        headers: {
                            'Authorization': `Bearer ${tikApiKey}`,
                            'User-Agent': 'Mozilla/5.0'
                        }
                    }
                );

                if (tikApiResponse.ok) {
                    const tikData = await tikApiResponse.json();
                    return res.status(200).json({
                        live: tikData?.live_status === 'live' || false,
                        username: username,
                        exists: true,
                        source: 'tiktok_api'
                    });
                }
            } catch (e) {
                console.error('TikAPI error:', e.message);
            }
        }

        // Méthode 2: Vérifier avec User-Agent et headers personnalisés
        const response = await fetch(
            `https://www.tiktok.com/api/user/detail/?uniqueId=${username}`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Referer': 'https://www.tiktok.com/',
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            }
        );

        if (response.ok) {
            try {
                const data = await response.json();
                const userInfo = data?.userInfo?.user;
                
                // Vérifier si le profil existe
                if (userInfo) {
                    return res.status(200).json({
                        live: false, // TikTok bloque la détection de live sans auth
                        username: username,
                        exists: true,
                        source: 'direct_api'
                    });
                }
            } catch (e) {
                console.error('JSON parse error:', e.message);
            }
        }

        // Si on arrive ici, l'utilisateur n'existe probablement pas
        return res.status(200).json({
            live: false,
            error: 'User not found or API error',
            username: username,
            exists: false
        });

    } catch (error) {
        console.error('Error:', error.message);
        return res.status(200).json({
            live: false,
            error: 'Unable to check live status',
            username: username
        });
    }
}
