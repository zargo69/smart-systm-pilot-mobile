
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
      const message = /invalid login credentials/i.test(error?.message || '')
        ? 'Adresse e-mail ou mot de passe incorrect.'
        : /email not confirmed/i.test(error?.message || '')
          ? 'Votre adresse e-mail doit être confirmée avant la connexion.'
          : 'Connexion impossible pour le moment. Réessayez dans quelques instants.';
      renderGate(message);
    }
  }

  
async function loadOrCreateCompany(user) {
  const cacheKey = 'ssp-company-session-v1:' + user.id;
  let membership;
  try {
    const result = await supabaseClient
      .from('ssp_company_members')
      .select('company_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    if (result.error) throw result.error;
    membership = result.data;
  } catch (error) {
    // Uniquement un repli hors ligne, lié à l'identifiant du compte authentifié.
    if (navigator.onLine) throw error;
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(cacheKey) || 'null'); } catch {}
    if (!cached?.companyId || !cached?.role) throw new Error('Aucun espace entreprise déjà vérifié pour ce compte hors ligne.');
    return { companyId: cached.companyId, role: cached.role };
  }

  // Si aucune entreprise n'existe, créer SMART SYST'M
  if (!membership) {
    const { data: companyId, error: createError } =
      await supabaseClient.rpc('ssp_create_company', {
        p_name: 'SMART SYST’M'
      });

    if (createError) throw createError;
    if (!companyId) throw new Error('Création de l’entreprise impossible.');

    const resolved = { companyId, role: 'admin' };
    localStorage.setItem(cacheKey, JSON.stringify(resolved));
    return resolved;
  }

  const resolved = { companyId: membership.company_id, role: membership.role };
  localStorage.setItem(cacheKey, JSON.stringify(resolved));
  return resolved;
}

  
async function openApp(user) {
  if (!user) {
    renderGate('Aucun utilisateur authentifié.');
    return;
  }

  try {
    const company = await loadOrCreateCompany(user);
    window.SSPCompanyStorage?.activate(company.companyId);
    if (window.SSP_SUPABASE_CONFIG?.syncEnabled === true && navigator.onLine) {
      await window.SSPSync.initialize(company.companyId);
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
      role: company.role,
      companyId: company.companyId,
      active: true,
      authProvider: 'supabase'
    };

    screen.hidden = true;
    document.querySelector('.app-shell').hidden = false;
    document.querySelector('.mobile-nav').hidden = false;

    updateProfile();
    scheduleIdleCheck();
    route(page || 'accueil');

  } catch (error) {
    console.error('[SSP] Erreur de rattachement entreprise :', error);
    currentAccount = null;

    document.querySelector('.app-shell').hidden = true;
    document.querySelector('.mobile-nav').hidden = true;

    renderGate(
      'Impossible de récupérer votre entreprise. Vérifiez la connexion et réessayez.'
    );
  }
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
        <p class="auth-intro">Indiquez l’adresse e-mail de votre compte. Un lien sécurisé vous permettra de choisir un nouveau mot de passe.</p>
        <form id="auth-recovery-form" class="auth-form">
          <label>Adresse e-mail
            <input name="email" type="email" required maxlength="254" autocomplete="email">
          </label>
          <p class="auth-message" role="alert"></p>
          <button class="btn primary" type="submit">Envoyer le lien</button>
        </form>
        <button type="button" class="auth-link" data-auth-action="back-to-login">Retour à la connexion</button>
      </section>`;

    screen.querySelector('#auth-recovery-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const email = new FormData(form).get('email')?.toString().trim().toLowerCase();
      const button = form.querySelector('button[type="submit"]');
      if (!email) return showMessage('Renseignez une adresse e-mail valide.');
      button.disabled = true;
      button.textContent = 'Envoi en cours…';
      try {
        const redirectTo = window.location.origin + window.location.pathname;
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;
        showMessage('Si cette adresse correspond à un compte, un e-mail de réinitialisation sera envoyé.');
        button.textContent = 'Lien demandé';
      } catch (error) {
        console.error('[SSP] Échec de récupération du mot de passe :', error);
        const message = /rate limit/i.test(error?.message || '')
          ? 'Limite temporaire d’envoi atteinte. N’essayez plus de renvoyer de lien pour le moment.'
          : 'Impossible d’envoyer le lien. Vérifiez la configuration e-mail Supabase.';
        showMessage(message);
        button.disabled = false;
        button.textContent = 'Réessayer';
      }
    });
  }

  function renderNewPassword() {
    screen.hidden = false;
    document.querySelector('.app-shell').hidden = true;
    document.querySelector('.mobile-nav').hidden = true;
    screen.innerHTML = `
      <section class="auth-card">
        ${brand()}
        <p class="eyebrow">SÉCURITÉ DU COMPTE</p>
        <h1>Nouveau mot de passe</h1>
        <p class="auth-intro">Choisissez un mot de passe d’au moins 10 caractères.</p>
        <form id="auth-new-password-form" class="auth-form">
          <label>Nouveau mot de passe
            <input name="password" type="password" required minlength="10" maxlength="256" autocomplete="new-password">
          </label>
          <label>Confirmer le mot de passe
            <input name="confirmPassword" type="password" required minlength="10" maxlength="256" autocomplete="new-password">
          </label>
          <p class="auth-message" role="alert"></p>
          <button class="btn primary" type="submit">Enregistrer le mot de passe</button>
        </form>
      </section>`;

    screen.querySelector('#auth-new-password-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = Object.fromEntries(new FormData(form));
      if (values.password !== values.confirmPassword) return showMessage('Les deux mots de passe ne correspondent pas.');
      if (String(values.password).length < 10) return showMessage('Choisissez au moins 10 caractères.');
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = 'Enregistrement…';
      const { data, error } = await supabaseClient.auth.updateUser({ password: values.password });
      if (error) {
        console.error('[SSP] Échec du changement de mot de passe :', error);
        showMessage('Le lien est invalide ou expiré. Demandez un nouveau lien de récupération.');
        button.disabled = false;
        button.textContent = 'Réessayer';
        return;
      }
      await openApp(data.user);
      notify('Votre mot de passe a été mis à jour.');
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

  window.addEventListener('online', () => {
    if (currentAccount && window.SSP_SUPABASE_CONFIG?.syncEnabled === true && !window.SSPSync?.isReady()) {
      window.SSPSync?.initialize(currentAccount.companyId)
        .catch(error => console.error('[SSP] Reprise de synchronisation impossible :', error));
    } else if (currentAccount && window.SSPSync?.isReady()) {
      window.SSPSync.flush().catch(() => {});
    }
  });

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      renderNewPassword();
      return;
    }
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
