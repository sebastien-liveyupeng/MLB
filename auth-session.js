// Gestion de la session utilisateur - Réutilisable sur toutes les pages
// Version: 1.0 - Ready for production (2026-01-20)

// Charger les modals HTML une seule fois
async function loadAuthModals() {
    try {
        const response = await fetch('/modals.html');
        const html = await response.text();
        
        // Injecter le HTML et le CSS des modals dans la page
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        document.body.appendChild(tempDiv);
    } catch (error) {
        console.error('Erreur lors du chargement des modals:', error);
    }
}

// Appeler le chargement des modals au démarrage
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        await loadAuthModals();
        checkUserSession();
    });
} else {
    loadAuthModals().then(() => checkUserSession());
}

// Fonctions pour ouvrir/fermer les modals
function openLoginModal() {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.classList.add('show');
        // Effacer les champs
        const emailInput = document.getElementById('login-email-modal');
        const passwordInput = document.getElementById('login-password-modal');
        const errorElement = document.getElementById('login-error-modal');
        const successElement = document.getElementById('login-success-modal');
        
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';
        if (errorElement) errorElement.textContent = '';
        if (successElement) successElement.textContent = '';
    }
}

function closeLoginModal() {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.classList.remove('show');
    }
}

function openSignupModal() {
    const signupModal = document.getElementById('signupModal');
    if (signupModal) {
        signupModal.classList.add('show');
        // Effacer les champs
        const usernameInput = document.getElementById('signup-username-modal');
        const emailInput = document.getElementById('signup-email-modal');
        const passwordInput = document.getElementById('signup-password-modal');
        const errorElement = document.getElementById('signup-error-modal');
        const successElement = document.getElementById('signup-success-modal');
        
        if (usernameInput) usernameInput.value = '';
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';
        if (errorElement) errorElement.textContent = '';
        if (successElement) successElement.textContent = '';
    }
}

function closeSignupModal() {
    const signupModal = document.getElementById('signupModal');
    if (signupModal) {
        signupModal.classList.remove('show');
    }
}

// Gestion de la session utilisateur
function getStoredToken() {
    const localToken = localStorage.getItem('access_token');
    if (localToken) return localToken;

    const sessionToken = sessionStorage.getItem('access_token');
    if (sessionToken) return sessionToken;

    const match = document.cookie.match(/(?:^|; )access_token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

function setStoredToken(token) {
    if (!token) return;
    localStorage.setItem('access_token', token);
    sessionStorage.setItem('access_token', token);
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `access_token=${encodeURIComponent(token)}; Path=/; Max-Age=604800; SameSite=Lax${secure}`;
}

function clearStoredToken() {
    localStorage.removeItem('access_token');
    sessionStorage.removeItem('access_token');
    document.cookie = 'access_token=; Path=/; Max-Age=0';
}
async function checkUserSession() {
    try {
        const token = getStoredToken();
        const authNav = document.getElementById('authNav');
        const userNav = document.getElementById('userNav');

        // Vérification que les éléments de navigation existent
        if (!authNav || !userNav) {
            console.log('Éléments de navigation manquants');
            return;
        }

        if (!token) {
            // Pas de token - afficher boutons de connexion/inscription
            authNav.style.setProperty('display', 'flex', 'important');
            userNav.style.setProperty('display', 'none', 'important');
            return;
        }

        // Vérifier le token avec le serveur
        const response = await fetch('/api/auth/session', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            const username = data.user.username || data.user.email;

            // Afficher l'utilisateur connecté
            authNav.style.setProperty('display', 'none', 'important');
            userNav.style.setProperty('display', 'flex', 'important');
            
            // Mettre à jour le pseudo dans la navbar
            const usernameNav = document.getElementById('usernameNav');
            if (usernameNav) {
                usernameNav.textContent = username;
            }
            
            // Mettre à jour le pseudo sur mobile aussi
            const usernameMobileNav = document.getElementById('usernameMobileNav');
            if (usernameMobileNav) {
                usernameMobileNav.textContent = username;
            }
        } else {
            // Token invalide ou réponse non-ok - supprimer le token
            console.log('Session check failed, clearing token');
            clearStoredToken();
            authNav.style.setProperty('display', 'flex', 'important');
            userNav.style.setProperty('display', 'none', 'important');
        }
    } catch (error) {
        console.error('Erreur lors de la vérification de session:', error);
        const authNav = document.getElementById('authNav');
        const userNav = document.getElementById('userNav');
        if (authNav) {
            authNav.style.setProperty('display', 'flex', 'important');
        }
        if (userNav) {
            userNav.style.setProperty('display', 'none', 'important');
        }
    }
}

// Fonction de déconnexion
function handleLogout() {
    clearStoredToken();
    location.reload();
}

// Fonction pour basculer le menu utilisateur
function toggleUserMenu() {
    const userMenu = document.getElementById('userMenu');
    if (userMenu) {
        userMenu.classList.toggle('show');
    }
}

// Gestion du login
async function handleLoginModal(event) {
    event.preventDefault();
    const loginErrorElement = document.getElementById('login-error-modal');
    const loginSuccessElement = document.getElementById('login-success-modal');
    
    if (loginErrorElement) {
        loginErrorElement.textContent = '';
    }
    if (loginSuccessElement) {
        loginSuccessElement.textContent = '';
    }

    const emailInput = document.getElementById('login-email-modal');
    const passwordInput = document.getElementById('login-password-modal');
    
    if (!emailInput || !passwordInput) {
        return;
    }
    
    const email = emailInput.value;
    const password = passwordInput.value;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            let errorMsg = data.error || 'Erreur de connexion';
            
            // Personnaliser le message d'erreur
            if (errorMsg.includes('Invalid login credentials')) {
                errorMsg = 'Oops ! Veuillez créer votre compte d\'abord.';
            }
            
            if (loginErrorElement) {
                loginErrorElement.textContent = errorMsg;
            }
            return;
        }

        // Stocker le token
        if (data.session && data.session.access_token) {
            setStoredToken(data.session.access_token);
        }
        
        if (loginSuccessElement) {
            loginSuccessElement.textContent = 'Connexion réussie !';
        }
        
        // Fermer la modal et mettre à jour l'affichage
        closeLoginModal();
        await checkUserSession();
    } catch (error) {
        if (loginErrorElement) {
            loginErrorElement.textContent = 'Erreur serveur';
        }
        console.error('Login error:', error);
    }
}

// Gestion de l'inscription
async function handleSignupModal(event) {
    event.preventDefault();
    const signupErrorElement = document.getElementById('signup-error-modal');
    const signupSuccessElement = document.getElementById('signup-success-modal');
    
    if (signupErrorElement) signupErrorElement.textContent = '';
    if (signupSuccessElement) signupSuccessElement.textContent = '';

    const usernameInput = document.getElementById('signup-username-modal');
    const emailInput = document.getElementById('signup-email-modal');
    const passwordInput = document.getElementById('signup-password-modal');
    
    if (!usernameInput || !emailInput || !passwordInput) return;
    
    const username = usernameInput.value;
    const email = emailInput.value;
    const password = passwordInput.value;

    // Validation simple
    if (!username || username.length < 3) {
        if (signupErrorElement) signupErrorElement.textContent = 'Le nom d\'utilisateur doit avoir au moins 3 caractères';
        return;
    }

    if (!email || !email.includes('@')) {
        if (signupErrorElement) signupErrorElement.textContent = 'Veuillez entrer une adresse email valide';
        return;
    }

    if (!password || password.length < 6) {
        if (signupErrorElement) signupErrorElement.textContent = 'Le mot de passe doit avoir au moins 6 caractères';
        return;
    }

    try {
        const response = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            if (signupErrorElement) signupErrorElement.textContent = data.error || 'Erreur lors de l\'inscription';
            return;
        }

        if (signupSuccessElement) signupSuccessElement.textContent = 'Inscription réussie ! Vous pouvez maintenant vous connecter.';
        
        setTimeout(() => {
            closeSignupModal();
            openLoginModal();
        }, 2000);
    } catch (error) {
        if (signupErrorElement) signupErrorElement.textContent = 'Erreur serveur';
        console.error('Signup error:', error);
    }
}

// Fermer les modals en cliquant en dehors
document.addEventListener('click', function(event) {
    const loginModal = document.getElementById('loginModal');
    const signupModal = document.getElementById('signupModal');
    
    if (loginModal && event.target === loginModal) {
        closeLoginModal();
    }
    
    if (signupModal && event.target === signupModal) {
        closeSignupModal();
    }
});

// Gestion du profil utilisateur
const defaultAvatars = [
    '/assets/avatars/avatar-1.svg',
    '/assets/avatars/avatar-2.svg',
    '/assets/avatars/avatar-3.svg',
    '/assets/avatars/avatar-4.svg',
    '/assets/avatars/avatar-5.svg',
    '/assets/avatars/avatar-6.svg'
];

function setSelectedAvatar(url) {
    const hiddenInput = document.getElementById('profile-avatar-url');
    const preview = document.getElementById('profile-avatar-preview');
    if (hiddenInput) {
        hiddenInput.value = url || '';
    }
    if (preview) {
        preview.src = url || '';
        preview.style.display = url ? 'block' : 'none';
    }

    const picker = document.getElementById('avatarPicker');
    if (picker) {
        picker.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.avatar === url);
        });
    }
}

function buildAvatarPicker(selectedUrl) {
    const picker = document.getElementById('avatarPicker');
    if (!picker) return;

    picker.innerHTML = '';
    defaultAvatars.forEach(url => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.avatar = url;

        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Avatar';

        button.appendChild(img);
        button.addEventListener('click', () => {
            const customInput = document.getElementById('profile-avatar-custom');
            if (customInput) customInput.value = '';
            setSelectedAvatar(url);
        });

        picker.appendChild(button);
    });

    setSelectedAvatar(selectedUrl || defaultAvatars[0]);
}

function openProfileModal() {
    const profileModal = document.getElementById('profileModal');
    if (profileModal) {
        // Charger les données du profil actuel
        buildAvatarPicker();
        const customInput = document.getElementById('profile-avatar-custom');
        if (customInput && !customInput.dataset.bound) {
            customInput.addEventListener('input', () => {
                const value = customInput.value.trim();
                if (value) {
                    setSelectedAvatar(value);
                } else {
                    const current = document.getElementById('profile-avatar-url')?.value || defaultAvatars[0];
                    setSelectedAvatar(current);
                }
            });
            customInput.dataset.bound = 'true';
        }
        const fileInput = document.getElementById('profile-avatar-file');
        if (fileInput && !fileInput.dataset.bound) {
            fileInput.addEventListener('change', async () => {
                const file = fileInput.files && fileInput.files[0];
                if (!file) return;
                await uploadAvatarFile(file);
            });
            fileInput.dataset.bound = 'true';
        }
        loadProfileData();
        profileModal.classList.add('show');
    }
}

async function uploadAvatarFile(file) {
    const errorElement = document.getElementById('profile-error');
    const successElement = document.getElementById('profile-success');
    if (errorElement) errorElement.textContent = '';
    if (successElement) successElement.textContent = '';

    if (!file.type.startsWith('image/')) {
        if (errorElement) errorElement.textContent = 'Fichier non supporté.';
        return;
    }

    if (file.size > 2 * 1024 * 1024) {
        if (errorElement) errorElement.textContent = 'Image trop lourde (max 2MB).';
        return;
    }

    const token = getStoredToken();
    if (!token) {
        if (errorElement) errorElement.textContent = 'Vous n\'êtes pas connecté.';
        return;
    }

    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('File read error'));
        reader.readAsDataURL(file);
    });

    try {
        const response = await fetch('/api/users/avatar', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dataUrl,
                fileName: file.name
            })
        });

        const data = await response.json();
        if (!response.ok || !data.avatar_url) {
            if (errorElement) errorElement.textContent = data.error || 'Upload impossible.';
            return;
        }

        setSelectedAvatar(data.avatar_url);
        if (successElement) successElement.textContent = 'Photo chargée.';
    } catch (error) {
        if (errorElement) errorElement.textContent = 'Erreur lors de l\'upload.';
        console.error('Upload avatar error:', error);
    }
}

function closeProfileModal() {
    const profileModal = document.getElementById('profileModal');
    if (profileModal) {
        profileModal.classList.remove('show');
        // Effacer les messages d'erreur/succès
        const errorElement = document.getElementById('profile-error');
        const successElement = document.getElementById('profile-success');
        if (errorElement) errorElement.textContent = '';
        if (successElement) successElement.textContent = '';
    }
}

async function loadProfileData() {
    try {
        const token = getStoredToken();
        if (!token) return;

        const response = await fetch('/api/auth/profile', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            document.getElementById('profile-username').value = data.user.username || '';
            document.getElementById('profile-email').value = data.user.email || '';
            const bioField = document.getElementById('profile-bio');
            if (bioField) bioField.value = data.user.bio || '';

            const avatarUrl = data.user.avatar_url || '';
            buildAvatarPicker(avatarUrl);
            setSelectedAvatar(avatarUrl || defaultAvatars[0]);

            const publicLink = document.getElementById('profile-public-link');
            if (publicLink && data.user.id) {
                publicLink.href = `/profil?id=${encodeURIComponent(data.user.id)}`;
            }

            const copyBtn = document.getElementById('copyProfileLinkBtn');
            if (copyBtn && data.user.id) {
                copyBtn.onclick = async () => {
                    const url = `${location.origin}/profil?id=${encodeURIComponent(data.user.id)}`;
                    try {
                        await navigator.clipboard.writeText(url);
                        const successElement = document.getElementById('profile-success');
                        if (successElement) successElement.textContent = 'Lien copié dans le presse-papiers.';
                    } catch (err) {
                        const errorElement = document.getElementById('profile-error');
                        if (errorElement) errorElement.textContent = 'Impossible de copier le lien.';
                    }
                };
            }
            // Vider les champs de mot de passe
            document.getElementById('profile-current-password').value = '';
            document.getElementById('profile-new-password').value = '';
        }
    } catch (error) {
        console.error('Erreur lors du chargement du profil:', error);
    }
}

async function handleProfileUpdate(event) {
    event.preventDefault();
    
    const errorElement = document.getElementById('profile-error');
    const successElement = document.getElementById('profile-success');
    
    if (errorElement) errorElement.textContent = '';
    if (successElement) successElement.textContent = '';

    const username = document.getElementById('profile-username').value;
    const email = document.getElementById('profile-email').value;
    const bio = document.getElementById('profile-bio')?.value || '';
    const avatarHidden = document.getElementById('profile-avatar-url')?.value || '';
    const avatarCustom = document.getElementById('profile-avatar-custom')?.value || '';
    const avatar_url = avatarCustom || avatarHidden;
    const currentPassword = document.getElementById('profile-current-password').value;
    const newPassword = document.getElementById('profile-new-password').value;

    if (!username || username.length < 3) {
        if (errorElement) errorElement.textContent = 'Le nom d\'utilisateur doit avoir au moins 3 caractères';
        return;
    }

    if (!email || !email.includes('@')) {
        if (errorElement) errorElement.textContent = 'Veuillez entrer une adresse email valide';
        return;
    }

    // Si on veut changer le mot de passe, il faut l'ancien
    if (newPassword && !currentPassword) {
        if (errorElement) errorElement.textContent = 'Veuillez entrer votre mot de passe actuel pour le modifier';
        return;
    }

    if (newPassword && newPassword.length < 6) {
        if (errorElement) errorElement.textContent = 'Le nouveau mot de passe doit avoir au moins 6 caractères';
        return;
    }

    try {
        const token = getStoredToken();
        if (!token) {
            if (errorElement) errorElement.textContent = 'Vous n\'êtes pas connecté';
            return;
        }

        const response = await fetch('/api/auth/profile', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                username, 
                email,
                bio,
                avatar_url,
                currentPassword,
                newPassword
            })
        });

        const data = await response.json();

        if (!response.ok) {
            if (errorElement) errorElement.textContent = data.error || 'Erreur lors de la mise à jour';
            return;
        }

        if (successElement) successElement.textContent = 'Profil mis à jour avec succès!';
        
        // Mettre à jour le pseudo affiché dans la navbar
        const usernameNav = document.getElementById('usernameNav');
        if (usernameNav) {
            usernameNav.textContent = username;
        }
        
        const usernameMobileNav = document.getElementById('usernameMobileNav');
        if (usernameMobileNav) {
            usernameMobileNav.textContent = username;
        }

        // Fermer la modal après 1.5 secondes
        setTimeout(() => {
            closeProfileModal();
        }, 1500);
    } catch (error) {
        if (errorElement) errorElement.textContent = 'Erreur serveur';
        console.error('Profile update error:', error);
    }
}

// Fermer la modal de profil en cliquant en dehors
document.addEventListener('click', function(event) {
    const profileModal = document.getElementById('profileModal');
    if (profileModal && event.target === profileModal) {
        closeProfileModal();
    }
});

