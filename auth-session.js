// Gestion de la session utilisateur - Réutilisable sur toutes les pages

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
    document.addEventListener('DOMContentLoaded', loadAuthModals);
} else {
    loadAuthModals();
}

// Fonctions pour ouvrir/fermer les modals
function openLoginModal() {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.classList.add('show');
        // Effacer les champs
        document.getElementById('login-email-modal').value = '';
        document.getElementById('login-password-modal').value = '';
        document.getElementById('login-error-modal').textContent = '';
        document.getElementById('login-success-modal').textContent = '';
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
        document.getElementById('signup-username-modal').value = '';
        document.getElementById('signup-email-modal').value = '';
        document.getElementById('signup-password-modal').value = '';
        document.getElementById('signup-error-modal').textContent = '';
        document.getElementById('signup-success-modal').textContent = '';
    }
}

function closeSignupModal() {
    const signupModal = document.getElementById('signupModal');
    if (signupModal) {
        signupModal.classList.remove('show');
    }
}

// Gestion de la session utilisateur
async function checkUserSession() {
    const token = localStorage.getItem('access_token');
    const authNav = document.getElementById('authNav');
    const userNav = document.getElementById('userNav');
    const usernameDisplayMobile = document.getElementById('usernameDisplayMobile');

    if (!authNav || !userNav) {
        console.log('Éléments de navigation manquants');
        return;
    }

    if (!token) {
        // Pas de token - afficher boutons de connexion/inscription
        authNav.style.display = 'flex';
        userNav.style.display = 'none';
        if (usernameDisplayMobile) usernameDisplayMobile.style.display = 'none';
        return;
    }

    try {
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
            const username = data.user.user_metadata?.username || data.user.email;

            // Afficher l'utilisateur connecté
            authNav.style.display = 'none';
            userNav.style.display = 'flex';
            
            // Mettre à jour le prénom dans la navbar desktop
            const usernameDisplay = document.getElementById('usernamDisplay');
            if (usernameDisplay) {
                usernameDisplay.textContent = username;
            }

            // Mettre à jour le prénom sur mobile
            if (usernameDisplayMobile) {
                usernameDisplayMobile.style.display = 'flex';
                const usernameSpan = usernameDisplayMobile.querySelector('span');
                if (usernameSpan) usernameSpan.textContent = username;
            }

            // Mettre à jour le bouton profil mobile
            const usernameMobileNav = document.getElementById('usernameMobileNav');
            if (usernameMobileNav) usernameMobileNav.textContent = username;
        } else {
            // Token invalide
            localStorage.removeItem('access_token');
            authNav.style.display = 'flex';
            userNav.style.display = 'none';
            if (usernameDisplayMobile) usernameDisplayMobile.style.display = 'none';
        }
    } catch (error) {
        console.error('Erreur lors de la vérification de session:', error);
        authNav.style.display = 'flex';
        userNav.style.display = 'none';
    }
}

// Fonction de déconnexion
function handleLogout() {
    localStorage.removeItem('access_token');
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
    document.getElementById('login-error-modal').textContent = '';
    document.getElementById('login-success-modal').textContent = '';

    const email = document.getElementById('login-email-modal').value;
    const password = document.getElementById('login-password-modal').value;

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
            
            document.getElementById('login-error-modal').textContent = errorMsg;
            return;
        }

        // Stocker le token
        localStorage.setItem('access_token', data.session.access_token);
        
        document.getElementById('login-success-modal').textContent = 'Connexion réussie ! Redirection...';
        
        setTimeout(() => {
            closeLoginModal();
            location.reload();
        }, 1500);
    } catch (error) {
        document.getElementById('login-error-modal').textContent = 'Erreur serveur';
        console.error('Login error:', error);
    }
}

// Gestion de l'inscription
async function handleSignupModal(event) {
    event.preventDefault();
    document.getElementById('signup-error-modal').textContent = '';
    document.getElementById('signup-success-modal').textContent = '';

    const username = document.getElementById('signup-username-modal').value;
    const email = document.getElementById('signup-email-modal').value;
    const password = document.getElementById('signup-password-modal').value;

    // Validation simple
    if (!username || username.length < 3) {
        document.getElementById('signup-error-modal').textContent = 'Le nom d\'utilisateur doit avoir au moins 3 caractères';
        return;
    }

    if (!email || !email.includes('@')) {
        document.getElementById('signup-error-modal').textContent = 'Veuillez entrer une adresse email valide';
        return;
    }

    if (!password || password.length < 6) {
        document.getElementById('signup-error-modal').textContent = 'Le mot de passe doit avoir au moins 6 caractères';
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
            document.getElementById('signup-error-modal').textContent = data.error || 'Erreur lors de l\'inscription';
            return;
        }

        document.getElementById('signup-success-modal').textContent = 'Inscription réussie ! Vous pouvez maintenant vous connecter.';
        
        setTimeout(() => {
            closeSignupModal();
            openLoginModal();
        }, 2000);
    } catch (error) {
        document.getElementById('signup-error-modal').textContent = 'Erreur serveur';
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

// Fermer le menu en cliquant ailleurs
document.addEventListener('click', function(event) {
    const userMenu = document.getElementById('userMenu');
    const userProfileBtn = document.getElementById('userProfileBtn');
    
    if (userMenu && userProfileBtn) {
        if (!userMenu.contains(event.target) && !userProfileBtn.contains(event.target)) {
            userMenu.classList.remove('show');
        }
    }
});

// Exécuter la vérification de session au chargement de la page
document.addEventListener('DOMContentLoaded', checkUserSession);
