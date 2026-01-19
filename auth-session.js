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
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';
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
        const usernameInput = document.getElementById('signup-username-modal');
        const emailInput = document.getElementById('signup-email-modal');
        const passwordInput = document.getElementById('signup-password-modal');
        if (usernameInput) usernameInput.value = '';
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';
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
    try {
        const token = localStorage.getItem('access_token');
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
            
            // Mettre à jour le pseudo dans la navbar - avec vérification
            const usernameNav = document.getElementById('usernameNav');
            if (usernameNav) {
                usernameNav.textContent = username;
            }
            
            // Mettre à jour le prénom sur mobile - avec vérification
            const usernameDisplayMobile = document.getElementById('usernameDisplayMobile');
            if (usernameDisplayMobile) {
                usernameDisplayMobile.style.setProperty('display', 'flex', 'important');
                const usernameMobileNav = document.getElementById('usernameMobileNav');
                if (usernameMobileNav) {
                    usernameMobileNav.textContent = username;
                }
            }
        } else {
            // Token invalide
            localStorage.removeItem('access_token');
            authNav.style.setProperty('display', 'flex', 'important');
            userNav.style.setProperty('display', 'none', 'important');
        }
    } catch (error) {
        console.error('Erreur lors de la vérification de session:', error);
        const authNav = document.getElementById('authNav');
        const userNav = document.getElementById('userNav');
        if (authNav) authNav.style.setProperty('display', 'flex', 'important');
        if (userNav) userNav.style.setProperty('display', 'none', 'important');
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
    const loginErrorElement = document.getElementById('login-error-modal');
    const loginSuccessElement = document.getElementById('login-success-modal');
    
    if (loginErrorElement) loginErrorElement.textContent = '';
    if (loginSuccessElement) loginSuccessElement.textContent = '';

    const emailInput = document.getElementById('login-email-modal');
    const passwordInput = document.getElementById('login-password-modal');
    
    if (!emailInput || !passwordInput) return;
    
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
            
            if (loginErrorElement) loginErrorElement.textContent = errorMsg;
            return;
        }

        // Stocker le token
        localStorage.setItem('access_token', data.session.access_token);
        
        if (loginSuccessElement) loginSuccessElement.textContent = 'Connexion réussie !';
        
        // Fermer la modal et mettre à jour l'affichage
        closeLoginModal();
        await checkUserSession();
    } catch (error) {
        if (loginErrorElement) loginErrorElement.textContent = 'Erreur serveur';
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

// Exécuter la vérification de session au chargement de la page
document.addEventListener('DOMContentLoaded', checkUserSession);
