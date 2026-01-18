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
        // Essayer de récupérer les infos du profil TikTok
        const response = await fetch(
            `https://www.tiktok.com/api/user/detail/?uniqueId=${username}`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }
        );

        if (!response.ok) {
            return res.status(200).json({ 
                live: false,
                error: 'User not found'
            });
        }

        const data = await response.json();
        
        // Vérifier si le compte existe et si un live est en cours
        // Pour TikTok, on ne peut pas vraiment vérifier le live côté serveur sans auth
        // On retourne false par défaut
        const isLive = false;

        return res.status(200).json({ 
            live: isLive,
            username: username,
            exists: data?.userInfo?.user ? true : false
        });

    } catch (error) {
        console.error('Error:', error.message);
        return res.status(200).json({ 
            live: false
        });
    }
}
