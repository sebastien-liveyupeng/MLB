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
            setupNotifications(false);
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
            notificationsUserId = data.user.id || null;

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

            setupNotifications(true);
        } else {
            // Token invalide ou réponse non-ok - supprimer le token
            console.log('Session check failed, clearing token');
            clearStoredToken();
            authNav.style.setProperty('display', 'flex', 'important');
            userNav.style.setProperty('display', 'none', 'important');
            setupNotifications(false);
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
        setupNotifications(false);
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
function setSelectedAvatar(url) {
    const preview = document.getElementById('profile-avatar-preview');
    if (preview) {
        preview.src = url || '';
        preview.style.display = url ? 'block' : 'none';
    }
}

function setupLaneSelection(initialLanes = []) {
    const laneGrid = document.getElementById('laneGrid');
    if (!laneGrid) return;

    const options = Array.from(laneGrid.querySelectorAll('.lane-option'));
    options.forEach(option => {
        option.classList.toggle('selected', initialLanes.includes(option.dataset.lane));
        option.addEventListener('click', () => {
            const selected = options.filter(btn => btn.classList.contains('selected'));
            if (option.classList.contains('selected')) {
                option.classList.remove('selected');
                return;
            }
            if (selected.length >= 2) {
                const first = selected[0];
                first.classList.remove('selected');
            }
            option.classList.add('selected');
        });
    });
}

function getSelectedLanes() {
    const laneGrid = document.getElementById('laneGrid');
    if (!laneGrid) return null;
    return Array.from(laneGrid.querySelectorAll('.lane-option.selected'))
        .map(btn => btn.dataset.lane)
        .slice(0, 2);
}

function openProfileModal() {
    const profileModal = document.getElementById('profileModal');
    if (profileModal) {
        // Charger les données du profil actuel
        const customInput = document.getElementById('profile-avatar-custom');
        if (customInput && !customInput.dataset.bound) {
            customInput.addEventListener('input', () => {
                const value = customInput.value.trim();
                if (value) {
                    setSelectedAvatar(value);
                } else {
                    const current = document.getElementById('profile-avatar-preview')?.src || '';
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

    if (file.size > 100 * 1024 * 1024) {
        if (errorElement) errorElement.textContent = 'Image trop lourde (max 100MB).';
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
        const response = await fetch('/api/users?avatar=1', {
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
            setSelectedAvatar(avatarUrl);

            const lanes = Array.isArray(data.user.lanes) ? data.user.lanes : [];
            setupLaneSelection(lanes);

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
    const avatarCustom = document.getElementById('profile-avatar-custom')?.value || '';
    const avatar_url = avatarCustom || document.getElementById('profile-avatar-preview')?.src || '';
    const lanes = getSelectedLanes();
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

        const payload = {
            username,
            email,
            bio,
            avatar_url,
            currentPassword,
            newPassword
        };

        if (lanes) {
            payload.lanes = lanes;
        }

        const response = await fetch('/api/auth/profile', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
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

let notificationsPollingId = null;
let notificationsLoading = false;
let notificationsUserId = null;
let notificationsCache = [];

function setupNotifications(isLoggedIn) {
    ensureNotificationsUI();
    const navItem = document.getElementById('notificationsNavItem');
    if (navItem) {
        navItem.style.display = isLoggedIn ? 'flex' : 'none';
    }

    if (!isLoggedIn) {
        stopNotificationsPolling();
        notificationsCache = [];
        updateNotificationsCount(0);
        closeNotificationsSidebar();
        return;
    }

    if (!notificationsPollingId) {
        refreshNotifications();
        notificationsPollingId = setInterval(refreshNotifications, 30000);
    }
}

function stopNotificationsPolling() {
    if (notificationsPollingId) {
        clearInterval(notificationsPollingId);
        notificationsPollingId = null;
    }
}

function ensureNotificationsUI() {
    const navMenu = document.querySelector('.nav-menu');
    if (!navMenu) return;

    let navItem = document.getElementById('notificationsNavItem');
    if (!navItem) {
        navItem = document.createElement('li');
        navItem.className = 'nav-item';
        navItem.id = 'notificationsNavItem';

        const link = document.createElement('a');
        link.href = '#';
        link.id = 'notificationsNavLink';

        const label = document.createElement('span');
        label.className = 'notifications-label';
        label.textContent = 'Notifications';

        const count = document.createElement('span');
        count.className = 'notifications-count';
        count.id = 'notificationsCount';
        count.textContent = '0';
        count.style.display = 'none';

        link.appendChild(label);
        link.appendChild(count);
        navItem.appendChild(link);

        const chatLink = navMenu.querySelector('a[href*="chat"]');
        if (chatLink && chatLink.parentElement) {
            chatLink.parentElement.insertAdjacentElement('afterend', navItem);
        } else {
            navMenu.appendChild(navItem);
        }

        link.addEventListener('click', event => {
            event.preventDefault();
            openNotificationsSidebar();
        });
    }

    let overlay = document.getElementById('notificationsOverlay');
    let sidebar = document.getElementById('notificationsSidebar');
    if (!overlay || !sidebar) {
        overlay = document.createElement('div');
        overlay.id = 'notificationsOverlay';
        overlay.className = 'notifications-overlay';

        sidebar = document.createElement('aside');
        sidebar.id = 'notificationsSidebar';
        sidebar.className = 'notifications-sidebar';
        sidebar.innerHTML = `
            <div class="notifications-header">
                <h3>Notifications</h3>
                <button class="notifications-close" type="button" aria-label="Fermer">×</button>
            </div>
            <div class="notifications-body">
                <div class="notifications-section" id="notificationsRequestsSection">
                    <div class="notifications-section-title">Demandes d'amis</div>
                    <div class="notifications-list" id="notificationsRequests"></div>
                </div>
                <div class="notifications-section" id="notificationsLikesSection">
                    <div class="notifications-section-title">Likes</div>
                    <div class="notifications-list" id="notificationsLikes"></div>
                </div>
                <div class="notifications-section" id="notificationsCommentsSection">
                    <div class="notifications-section-title">Commentaires</div>
                    <div class="notifications-list" id="notificationsComments"></div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(sidebar);

        overlay.addEventListener('click', closeNotificationsSidebar);
        sidebar.querySelector('.notifications-close')?.addEventListener('click', closeNotificationsSidebar);
    }
}

function openNotificationsSidebar() {
    const overlay = document.getElementById('notificationsOverlay');
    const sidebar = document.getElementById('notificationsSidebar');
    if (overlay && sidebar) {
        overlay.classList.add('show');
        sidebar.classList.add('show');
        refreshNotifications();
    }
}

function closeNotificationsSidebar() {
    const overlay = document.getElementById('notificationsOverlay');
    const sidebar = document.getElementById('notificationsSidebar');
    if (overlay && sidebar) {
        overlay.classList.remove('show');
        sidebar.classList.remove('show');
    }
}

function updateNotificationsCount(total) {
    const countEl = document.getElementById('notificationsCount');
    const labelEl = document.querySelector('#notificationsNavLink .notifications-label');
    if (!countEl || !labelEl) return;

    if (total > 0) {
        countEl.style.display = 'inline-flex';
        countEl.textContent = String(total);
        countEl.classList.add('pulse');
        labelEl.textContent = 'Notifications';
    } else {
        countEl.style.display = 'none';
        countEl.textContent = '0';
        countEl.classList.remove('pulse');
        labelEl.textContent = 'Notifications';
    }
}

async function refreshNotifications() {
    if (notificationsLoading) return;
    const token = getStoredToken();
    if (!token) return;

    notificationsLoading = true;
    try {
        const response = await fetch('/api/notifications', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            notificationsLoading = false;
            return;
        }

        const data = await response.json();
        const items = data?.items || [];
        notificationsCache = items;
        const unread = items.filter(item => !isNotificationSeen(item.id));
        updateNotificationsCount(unread.length);
        renderNotifications(items);
    } catch (error) {
        console.error('Notifications error:', error);
    } finally {
        notificationsLoading = false;
    }
}

function renderNotifications(items) {
    const requestsEl = document.getElementById('notificationsRequests');
    const likesEl = document.getElementById('notificationsLikes');
    const commentsEl = document.getElementById('notificationsComments');

    if (!requestsEl || !likesEl || !commentsEl) return;

    const requests = items.filter(item => item.type === 'friend_request');
    const likes = items.filter(item => item.type === 'like');
    const comments = items.filter(item => item.type === 'comment');

    requestsEl.innerHTML = requests.length
        ? requests.map(renderRequestItem).join('')
        : '<div class="notifications-empty">Aucune demande.</div>';

    likesEl.innerHTML = likes.length
        ? likes.map(renderLikeItem).join('')
        : '<div class="notifications-empty">Aucun like.</div>';

    commentsEl.innerHTML = comments.length
        ? comments.map(renderCommentItem).join('')
        : '<div class="notifications-empty">Aucun commentaire.</div>';

    requestsEl.querySelectorAll('[data-request-id]').forEach(btn => {
        btn.addEventListener('click', async event => {
            event.stopPropagation();
            const action = event.currentTarget.dataset.action;
            const requestId = event.currentTarget.dataset.requestId;
            if (!action || !requestId) return;
            await respondToFriendRequest(requestId, action);
        });
    });

    document.querySelectorAll('.notification-item[data-type="like"], .notification-item[data-type="comment"]').forEach(itemEl => {
        itemEl.addEventListener('click', () => {
            const notifId = itemEl.dataset.notifId;
            const postId = itemEl.dataset.postId;
            if (notifId) markNotificationSeen(notifId);
            updateNotificationsCount(getUnreadCountFromCache());
            if (postId) {
                window.location.href = `/galerie?post=${encodeURIComponent(postId)}`;
            }
        });
    });
}

function renderRequestItem(item) {
    const name = item.from_user?.username || 'Membre';
    const seenClass = isNotificationSeen(item.id) ? ' seen' : '';
    return `
        <div class="notification-item${seenClass}" data-type="friend_request" data-notif-id="${item.id}">
            <div class="notification-text"><strong>${escapeHtml(name)}</strong> veut vous ajouter</div>
            <div class="notification-actions">
                <button class="notif-btn accept" data-action="accept" data-request-id="${item.request_id}">Accepter</button>
                <button class="notif-btn decline" data-action="decline" data-request-id="${item.request_id}">Refuser</button>
            </div>
        </div>
    `;
}

function renderLikeItem(item) {
    const name = item.from_user?.username || 'Membre';
    const date = formatNotificationDate(item.created_at);
    const seenClass = isNotificationSeen(item.id) ? ' seen' : '';
    return `
        <div class="notification-item clickable${seenClass}" data-type="like" data-notif-id="${item.id}" data-post-id="${item.post_id}">
            <div class="notification-text"><strong>${escapeHtml(name)}</strong> a liké votre média</div>
            <div class="notification-meta">${date}</div>
        </div>
    `;
}

function renderCommentItem(item) {
    const name = item.from_user?.username || 'Membre';
    const excerpt = item.content ? escapeHtml(item.content).slice(0, 120) : '';
    const date = formatNotificationDate(item.created_at);
    const seenClass = isNotificationSeen(item.id) ? ' seen' : '';
    return `
        <div class="notification-item clickable${seenClass}" data-type="comment" data-notif-id="${item.id}" data-post-id="${item.post_id}">
            <div class="notification-text"><strong>${escapeHtml(name)}</strong> a commenté : "${excerpt}"</div>
            <div class="notification-meta">${date}</div>
        </div>
    `;
}

async function respondToFriendRequest(requestId, decision) {
    const token = getStoredToken();
    if (!token) return;

    try {
        const response = await fetch('/api/friends', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'respond', request_id: requestId, decision })
        });
        if (response.ok) {
            markNotificationSeen(`fr_${requestId}`);
        }
        updateNotificationsCount(getUnreadCountFromCache());
        refreshNotifications();
    } catch (error) {
        console.error('Friend request respond error:', error);
    }
}

function getUnreadCountFromCache() {
    return (notificationsCache || []).filter(item => !isNotificationSeen(item.id)).length;
}

function getNotificationsStorageKey() {
    if (!notificationsUserId) return 'notifications_seen_guest';
    return `notifications_seen_${notificationsUserId}`;
}

function getSeenNotifications() {
    try {
        const raw = localStorage.getItem(getNotificationsStorageKey());
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function isNotificationSeen(id) {
    if (!id) return false;
    const seen = getSeenNotifications();
    return seen.includes(id);
}

function markNotificationSeen(id) {
    if (!id) return;
    const seen = getSeenNotifications();
    if (!seen.includes(id)) {
        seen.push(id);
        localStorage.setItem(getNotificationsStorageKey(), JSON.stringify(seen.slice(-500)));
    }
}

function formatNotificationDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value || '';
    return div.innerHTML;
}

