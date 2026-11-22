
/* Authentification serveur SMART SYST'M PILOT — Supabase */
(() => {
  'use strict';

  const screen = document.querySelector('#auth-screen');
  const supabaseClient = window.SSPSupabase?.client;

  let currentAccount = null;
  let idleTimer = null;
  const IDLE_LIMIT_MS = 15 * 60 * 1000;

  if (!screen || !supabaseClient) {
    console.error('[SSP] Écran ou client Supabase introuvable.');
    return;
  }

  function escapeText(value) {
    return typeof esc === 'function'
      ? esc(String(value ?? ''))
      : String(value ?? '').replace(/[&<>"']/g, char => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        }[char]));
  }

  function initials(name) {
    return String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0]?.toLocaleUpperCase('fr') || '')
      .join('') || '?';
  }

  function showMessage(message) {
    const target = screen.querySelector('.auth-message');
    if (target) target.textContent = message;
  }

  function brand() {
    return `<div class="auth-brand">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 512 512">
          <path d="M99 229 256 103l157 126M133 221v173c0 13 10 23 23 23h200c13 0 23-10 23-23V221"
            fill="none" stroke="currentColor" stroke-width="30"
            stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M237 181h56l-36 72h44L216 354l20-80h-39z"
            fill="#edf7aa"/>
        </svg>
      </span>
      <span><b>Smart syst’m Pilot</b><small>GESTION D’ENTREPRISE</small></span>
    </div>`;
  }

  function renderGate(message = '') {
    screen.hidden = false;
    screen.innerHTML = `
      <section class="auth-card" aria-labelledby="auth-title">
        ${brand()}
        <p class="eyebrow">ESPACE ENTREPRISE</p>
        <h1 id="auth-title">Connexion</h1>
        <p class="auth-intro">
          Connectez-vous à votre espace SMART SYST’M PILOT.
        </p>
        <form id="auth-login-form" class="auth-form">
          <label>Adresse e-mail
            <input name="email" type="email" required maxlength="254"
              autocomplete="username" placeholder="nom@exemple.fr">
          </label>
          <label>Mot de passe
            <span class="password-input-wrap">
              <input id="login-password" name="password" type="password"
                required maxlength="256" autocomplete="current-password">
              <button type="button" class="password-toggle"
                data-toggle-password="login-password"
                aria-label="Afficher le mot de passe"
                aria-pressed="false">Afficher</button>
            </span>
          </label>
          <p class="auth-message" role="alert">${escapeText(message)}</p>
          <button class="btn primary" type="submit">Se connecter</button>
        </form>
        <button type="button" class="auth-link"
          data-auth-action="forgot-password">Mot de passe oublié ?</button>
        <p class="auth-notice">
          Connexion sécurisée par Supabase.
        </p>
      </section>`;

    screen.querySelector('#auth-login-form')
      ?.addEventListener('submit', login);
  }

  async function login(event) {
    event.preventDefault();

    const values = Object.fromEntries(new FormData(event.currentTarget));
    const email = String(values.email || '').trim().toLowerCase();

    if (!email || !values.password) {
      showMessage('Renseignez votre adresse e-mail et votre mot de passe.');
      return;
    }

    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Connexion en cours…';

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password: values.password
      });

      if (error) throw error;
      await openApp(data.user);
    } catch (error) {
      console.error('[SSP] Échec de connexion :', error);
      renderGate('Connexion impossible. Vérifiez votre adresse e-mail et votre mot de passe.');
    }
  }

  async function openApp(user) {
    if (!user) {
      renderGate('Aucun utilisateur authentifié.');
      return;
    }

    const displayName =
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'Utilisateur';

    currentAccount = {
      id: user.id,
      email: user.email || '',
      username: user.email || '',
      displayName,
      role: 'admin',
      active: true,
      authProvider: 'supabase'
    };

    screen.hidden = true;

    document.querySelector('.app-shell').hidden = false;
    document.querySelector('.mobile-nav').hidden = false;

    updateProfile();
    scheduleIdleCheck();
    route(page || 'accueil');
  }

  function updateProfile() {
    if (!currentAccount) return;

    const badge = document.querySelector('.top-avatar');
    if (badge) {
      badge.textContent = initials(currentAccount.displayName);
      badge.title = 'Se déconnecter';
      badge.setAttribute('aria-label', 'Se déconnecter');
      badge.classList.add('auth-logout');
    }

    const profileName = document.querySelector('.profile b');
    const profileRole = document.querySelector('.profile small');
    const profileAvatar = document.querySelector('.profile-avatar');

    if (profileName) profileName.textContent = currentAccount.displayName;
    if (profileRole) profileRole.textContent = 'Responsable';
    if (profileAvatar) profileAvatar.textContent = initials(currentAccount.displayName);
  }

  async function logout(message = '') {
    clearTimeout(idleTimer);
    idleTimer = null;
    currentAccount = null;

    document.querySelector('.app-shell').hidden = true;
    document.querySelector('.mobile-nav').hidden = true;

    const { error } = await supabaseClient.auth.signOut();

    if (error) console.error('[SSP] Erreur de déconnexion :', error);

    renderGate(message || 'Vous êtes déconnecté.');
  }

  function scheduleIdleCheck() {
    clearTimeout(idleTimer);
    if (!currentAccount) return;

    idleTimer = setTimeout(
      () => logout('Votre session a expiré après 15 minutes.'),
      IDLE_LIMIT_MS
    );
  }

  function recordActivity() {
    if (currentAccount) scheduleIdleCheck();
  }

  function renderPasswordRecovery() {
    screen.innerHTML = `
      <section class="auth-card">
        ${brand()}
        <p class="eyebrow">RÉINITIALISATION</p>
        <h1>Mot de passe oublié ?</h1>
        <p class="auth-intro">
          Indiquez votre adresse e-mail pour recevoir un lien de réinitialisation.
        </p>
        <form id="auth-recovery-form" class="auth-form">
          <label>Adresse e-mail
            <input name="email" type="email" required autocomplete="email">
          </label>
          <p class="auth-message" role="alert"></p>
          <button class="btn primary" type="submit">Envoyer le lien</button>
        </form>
        <button type="button" class="auth-link"
          data-auth-action="back-to-login">Retour à la connexion</button>
      </section>`;

    screen.querySelector('#auth-recovery-form')
      ?.addEventListener('submit', async event => {
        event.preventDefault();
        const email = new FormData(event.currentTarget).get('email')
          ?.toString().trim().toLowerCase();

        const { error } = await supabaseClient.auth.resetPasswordForEmail(email);

        if (error) {
          showMessage('Impossible d’envoyer le lien. Vérifiez votre adresse.');
          return;
        }

        showMessage('Si cette adresse correspond à un compte, un e-mail de réinitialisation sera envoyé.');
      });
  }

  document.addEventListener('click', event => {
    const toggle = event.target.closest('[data-toggle-password]');

    if (toggle) {
      const input = document.getElementById(toggle.dataset.togglePassword);
      if (input) {
        const visible = input.type === 'password';
        input.type = visible ? 'text' : 'password';
        toggle.textContent = visible ? 'Masquer' : 'Afficher';
        toggle.setAttribute('aria-pressed', String(visible));
      }
      return;
    }

    const action = event.target.closest('[data-auth-action]');
    if (action?.dataset.authAction === 'forgot-password') {
      renderPasswordRecovery();
    }

    if (action?.dataset.authAction === 'back-to-login') {
      renderGate();
    }

    if (event.target.closest('.top-avatar') && currentAccount) {
      logout();
    }
  });

  for (const eventName of ['pointerdown', 'keydown', 'click', 'input', 'touchstart']) {
    document.addEventListener(eventName, recordActivity, { passive: true });
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' && currentAccount) {
      clearTimeout(idleTimer);
      currentAccount = null;
      document.querySelector('.app-shell').hidden = true;
      document.querySelector('.mobile-nav').hidden = true;
      renderGate();
    }
  });

  async function initialize() {
    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;

      if (data.session?.user) {
        await openApp(data.session.user);
      } else {
        renderGate();
      }
    } catch (error) {
      console.error('[SSP] Initialisation de la session impossible :', error);
      renderGate('Impossible de vérifier votre session. Rechargez la page.');
    }
  }

  window.SSPAuth = Object.freeze({
    getCurrentAccount: () => currentAccount,
    logout,
    updateProfile,
    accountSettingsMarkup: () => ''
  });

  initialize();
})();
