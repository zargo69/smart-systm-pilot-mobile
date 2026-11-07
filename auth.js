/* Verrouillage de démonstration sur cet appareil ; ne remplace pas une authentification serveur. */
(() => {
  const AUTH_KEY = 'ssp-local-accounts-v1';
  const SESSION_KEY = 'ssp-local-session-v1';
  const ITERATIONS = 210000;
  const IDLE_LIMIT_MS = 15 * 60 * 1000;
  const SESSION_SAVE_INTERVAL_MS = 30 * 1000;
  const screen = document.querySelector('#auth-screen');
  let accounts = readAccounts();
  let currentAccount = null;
  let lastActivity = 0;
  let lastSessionSave = 0;
  let idleTimer = 0;
  let failures = 0;
  let lockedUntil = 0;

  function readAccounts() {
    try {
      const value = JSON.parse(localStorage.getItem(AUTH_KEY) || '[]');
      return Array.isArray(value) ? value.filter(account => account && typeof account.username === 'string' && typeof account.hash === 'string').map(account => ({ ...account, email: String(account.email || '') })) : [];
    } catch { return []; }
  }

  function saveAccounts() {
    try {
      localStorage.setItem(AUTH_KEY, JSON.stringify(accounts));
      return true;
    } catch {
      showMessage('Impossible d’enregistrer le compte dans le stockage local. Libérez de l’espace puis réessayez.');
      return false;
    }
  }

  function recordAccountChange(action, account) {
    if (!account || typeof window.recordActivityAudit !== 'function' || typeof save !== 'function') return;
    const actor = currentAccount || account;
    window.recordActivityAudit('accounts', { id: account.id, name: `${account.displayName} (${account.username})` }, action, { actorId: actor.id || '', actorName: actor.displayName || 'Compte local', actorUsername: actor.username || '' });
    save();
  }

  function readSession() {
    try {
      const value = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
    } catch { return null; }
  }
  function clearSession() {
    clearTimeout(idleTimer);
    idleTimer = 0;
    lastActivity = 0;
    lastSessionSave = 0;
    try { localStorage.removeItem(SESSION_KEY); } catch { /* La déconnexion de cet onglet reste effective si le stockage est indisponible. */ }
  }
  function persistSession(now = Date.now()) {
    if (!currentAccount) return false;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ accountId: currentAccount.id, lastActivity: now }));
      lastSessionSave = now;
      return true;
    } catch { return false; }
  }
  function scheduleIdleCheck() {
    clearTimeout(idleTimer);
    if (!currentAccount) return;
    const remaining = Math.max(0, IDLE_LIMIT_MS - (Date.now() - lastActivity));
    idleTimer = setTimeout(checkIdleSession, remaining);
  }
  function checkIdleSession() {
    if (!currentAccount) return;
    const now = Date.now();
    const session = { accountId: currentAccount.id, lastActivity };
    if (!SSPDomain.isLocalSessionActive(session, currentAccount, now, IDLE_LIMIT_MS)) {
      logout('Votre session a expiré après 15 minutes d’inactivité. Reconnectez-vous.');
      return;
    }
    scheduleIdleCheck();
  }
  function recordActivity() {
    if (!currentAccount) return;
    const now = Date.now();
    if (lastActivity && now - lastActivity >= IDLE_LIMIT_MS) {
      logout('Votre session a expiré après 15 minutes d’inactivité. Reconnectez-vous.');
      return;
    }
    if (now - lastActivity < 1000) return;
    lastActivity = now;
    if (now - lastSessionSave >= SESSION_SAVE_INTERVAL_MS) persistSession(now);
    scheduleIdleCheck();
  }
  function logout(message = '') {
    clearSession();
    currentAccount = null;
    document.querySelector('.app-shell').hidden = true;
    document.querySelector('.mobile-nav').hidden = true;
    renderGate(message);
  }

  function bytesToHex(bytes) { return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join(''); }
  function randomHex(length = 16) { const bytes = crypto.getRandomValues(new Uint8Array(length)); return bytesToHex(bytes); }
  async function passwordHash(password, salt) {
    if (!crypto?.subtle) throw new Error('secure-context');
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    return bytesToHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: ITERATIONS, hash: 'SHA-256' }, key, 256));
  }
  function sameHash(left, right) {
    if (left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    return difference === 0;
  }
  function normalizeUsername(value) { return String(value || '').trim().toLocaleLowerCase('fr'); }
  function normalizeEmail(value) { return String(value || '').trim().toLocaleLowerCase('fr'); }
  function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value)); }
  function passwordRuleError(value) {
    if (!/[A-ZÀ-ÖØ-Þ]/.test(value)) return 'Ajoutez au moins une lettre majuscule.';
    if (!/[0-9]/.test(value)) return 'Ajoutez au moins un chiffre.';
    return '';
  }
  function initials(name) { return String(name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toLocaleUpperCase('fr') || '').join('') || '?'; }
  function escapeText(value) { return typeof esc === 'function' ? esc(value) : String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char])); }
  function showMessage(message) {
    const target = screen?.querySelector('.auth-message');
    if (target) target.textContent = message;
  }
  function accountNotice() {
    return '<p class="auth-notice"><b>Comptes locaux de démonstration.</b> Tous les comptes de ce navigateur partagent les mêmes données. Les adresses sont conservées sur cet appareil ; aucun e-mail n’est envoyé ni vérifié. Cette page ne remplace pas des comptes sécurisés sur un serveur. N’y stockez pas de données réelles ou sensibles.</p>';
  }
  function recoveryNoticeMarkup() {
    const recovery = window.SSPStorageRecovery || {};
    if (!recovery.notice) return '';
    return `<div class="auth-recovery" role="alert"><b>Attention : données locales illisibles</b><p>${escapeText(recovery.notice)}</p>${recovery.backupAvailable ? '<button type="button" class="btn secondary" data-auth-action="download-recovery">Télécharger la copie brute</button>' : ''}</div>`;
  }
  function downloadRecoveryCopy() {
    try {
      const raw = localStorage.getItem('ssp-corrupt-data-backup-v1');
      if (raw === null) return showMessage('Aucune copie brute n’est disponible.');
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'smart-systm-pilot-donnees-a-recuperer.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('Copie brute téléchargée. Elle peut être incomplète et ne se restaure pas automatiquement.');
    } catch { showMessage('Le téléchargement de la copie brute a échoué.'); }
  }
  function recoverySettingsMarkup() {
    if (!window.SSPStorageRecovery?.backupAvailable) return '';
    return `<section class="panel auth-account-panel"><div class="panel-head"><div><h2>Copie de secours de données illisibles</h2><p>Le fichier est conservé ici au cas où le stockage local aurait été endommagé.</p></div><button class="btn secondary" type="button" data-auth-action="download-recovery">Télécharger la copie brute</button></div><p class="form-hint">Cette copie peut être tronquée ou invalide ; elle n’est pas une sauvegarde restaurable automatiquement.</p></section>`;
  }
  function brand() {
    return `<div class="auth-brand"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 512 512"><path d="M99 229 256 103l157 126M133 221v173c0 13 10 23 23 23h200c13 0 23-10 23-23V221" fill="none" stroke="currentColor" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/><path d="M237 181h56l-36 72h44L216 354l20-80h-39z" fill="#edf7aa"/></svg></span><span><b>Smart syst’m Pilot</b><small>GESTION D’ENTREPRISE</small></span></div>`;
  }
  function passwordField(id, name, label, autocomplete, required = true, hint = '') {
    return `<label>${label}${hint ? `<small class="password-hint">${hint}</small>` : ''}<span class="password-input-wrap"><input id="${id}" name="${name}" type="password" ${required ? 'required' : ''} maxlength="256" autocomplete="${autocomplete}"><button type="button" class="password-toggle" data-toggle-password="${id}" aria-label="Afficher le mot de passe" aria-pressed="false">Afficher</button></span></label>`;
  }
  function renderGate(message = '') {
    const firstSetup = accounts.length === 0;
    screen.hidden = false;
    screen.innerHTML = `<section class="auth-card" aria-labelledby="auth-title">${brand()}<p class="eyebrow">${firstSetup ? 'PREMIÈRE UTILISATION' : 'ESPACE ENTREPRISE'}</p><h1 id="auth-title">${firstSetup ? 'Créer le compte responsable' : 'Connexion'}</h1><p class="auth-intro">${firstSetup ? 'Commencez par créer le compte qui pourra gérer les profils de cet appareil.' : 'Connectez-vous pour ouvrir Smart syst’m Pilot.'}</p>${recoveryNoticeMarkup()}<form id="auth-login-form" class="auth-form">${firstSetup ? '<label>Nom affiché<input name="displayName" required maxlength="80" autocomplete="name" placeholder="Ex. Mohamed"></label><label>Adresse e-mail<input name="email" type="email" required maxlength="254" autocomplete="email" placeholder="nom@exemple.fr"></label>' : ''}<label>${firstSetup ? 'Identifiant' : 'Identifiant ou adresse e-mail'}<input name="username" required maxlength="254" autocomplete="username" autocapitalize="none" placeholder="${firstSetup ? 'Ex. mohamed' : 'Identifiant ou nom@exemple.fr'}"></label>${firstSetup ? passwordField('setup-password', 'password', 'Mot de passe', 'new-password', true, 'Une majuscule et un chiffre obligatoires.') + passwordField('setup-password-confirm', 'passwordConfirm', 'Confirmer le mot de passe', 'new-password') : passwordField('login-password', 'password', 'Mot de passe', 'current-password')}<p class="auth-message" role="alert">${escapeText(message)}</p><button class="btn primary" type="submit">${firstSetup ? 'Créer le compte et continuer' : 'Se connecter'}</button></form>${firstSetup ? '' : '<button type="button" class="auth-link" data-auth-action="forgot-password">Mot de passe oublié ?</button>'}${accountNotice()}</section>`;
    screen.querySelector('#auth-login-form [name="username"]')?.focus();
    screen.querySelector('#auth-login-form')?.addEventListener('submit', firstSetup ? createFirstAdmin : login);
  }
  function renderEmailSetup(account, message = '') {
    screen.innerHTML = `<section class="auth-card" aria-labelledby="auth-title">${brand()}<p class="eyebrow">MISE À JOUR DU PROFIL</p><h1 id="auth-title">Ajouter une adresse e-mail</h1><p class="auth-intro">Associez une adresse à ${escapeText(account.displayName)}. Vous pourrez ensuite l’utiliser pour vous connecter ou réinitialiser le mot de passe sur cet appareil.</p><form id="auth-email-form" class="auth-form"><label>Adresse e-mail<input name="email" type="email" required maxlength="254" autocomplete="email" placeholder="nom@exemple.fr"></label><p class="auth-message" role="alert">${escapeText(message)}</p><button class="btn primary" type="submit">Enregistrer et continuer</button></form><p class="auth-notice">L’adresse ne sera pas vérifiée par e-mail dans cette version locale.</p>${accountNotice()}</section>`;
    screen.querySelector('[name="email"]')?.focus();
    screen.querySelector('#auth-email-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const email = normalizeEmail(new FormData(event.currentTarget).get('email'));
      if (!validEmail(email)) return showMessage('Saisissez une adresse e-mail valide.');
      if (accounts.some(item => item.id !== account.id && normalizeEmail(item.email) === email)) return showMessage('Cette adresse e-mail est déjà associée à un autre profil.');
      const previous = account.email;
      account.email = email;
      if (saveAccounts()) { recordAccountChange('Modifié', account); openApp(account); }
      else account.email = previous;
    });
  }
  function renderPasswordRecovery(message = '') {
    screen.hidden = false;
    screen.innerHTML = `<section class="auth-card" aria-labelledby="auth-title">${brand()}<p class="eyebrow">RÉINITIALISATION LOCALE</p><h1 id="auth-title">Mot de passe oublié ?</h1><p class="auth-intro">Indiquez l’adresse associée au compte, puis choisissez un nouveau mot de passe.</p><form id="auth-recovery-form" class="auth-form"><label>Adresse e-mail<input name="email" type="email" required maxlength="254" autocomplete="email"></label>${passwordField('recover-password', 'password', 'Nouveau mot de passe', 'new-password', true, 'Une majuscule et un chiffre obligatoires.') + passwordField('recover-password-confirm', 'passwordConfirm', 'Confirmer le mot de passe', 'new-password')}<p class="auth-message" role="alert">${escapeText(message)}</p><button class="btn primary" type="submit">Réinitialiser sur cet appareil</button></form><button type="button" class="auth-link" data-auth-action="back-to-login">Retour à la connexion</button><p class="auth-notice"><b>Aucun e-mail n’est envoyé ni vérifié.</b> La réinitialisation se fait uniquement sur cet appareil. Toute personne qui peut ouvrir l’application et connaît l’adresse enregistrée peut choisir un nouveau mot de passe. Ce mécanisme ne protège pas un compte de production.</p></section>`;
    screen.querySelector('[name="email"]')?.focus();
    screen.querySelector('#auth-recovery-form')?.addEventListener('submit', resetPasswordLocally);
  }
  async function resetPasswordLocally(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const email = normalizeEmail(values.email);
    const account = accounts.find(item => item.active !== false && normalizeEmail(item.email) === email);
    const policy = passwordRuleError(values.password);
    if (!validEmail(email)) return showMessage('Saisissez une adresse e-mail valide.');
    if (!account) return showMessage('Aucun compte actif ne correspond à cette adresse sur cet appareil.');
    if (policy) return showMessage(policy);
    if (values.password !== values.passwordConfirm) return showMessage('Les deux mots de passe ne correspondent pas.');
    const before = accounts.map(item => ({ ...item }));
    try {
      account.salt = randomHex();
      account.hash = await passwordHash(values.password, account.salt);
      if (!saveAccounts()) { accounts = before; return; }
      recordAccountChange('Mot de passe réinitialisé', account);
      renderGate('Mot de passe modifié sur cet appareil. Connectez-vous avec votre adresse e-mail.');
    } catch { accounts = before; showMessage('La réinitialisation locale a échoué. Réessayez sur une adresse sécurisée.'); }
  }
  function openApp(account) {
    const now = Date.now();
    currentAccount = account;
    lastActivity = now;
    if (!persistSession(now)) {
      currentAccount = null;
      clearSession();
      renderGate('La session ne peut pas être conservée sur cet appareil. Vérifiez le stockage du navigateur puis reconnectez-vous.');
      return;
    }
    screen.hidden = true;
    document.querySelector('.app-shell').hidden = false;
    document.querySelector('.mobile-nav').hidden = false;
    updateProfile();
    scheduleIdleCheck();
    route(page || 'accueil');
  }

  function resumeSession() {
    const saved = readSession();
    if (!saved) return false;
    const account = accounts.find(item => item.id === saved.accountId);
    if (!SSPDomain.isLocalSessionActive(saved, account, Date.now(), IDLE_LIMIT_MS)) {
      clearSession();
      return false;
    }
    openApp(account);
    return !!currentAccount;
  }
  function updateProfile() {
    if (!currentAccount) return;
    const badge = document.querySelector('.top-avatar');
    if (badge) { badge.textContent = initials(currentAccount.displayName); badge.title = 'Se déconnecter'; badge.setAttribute('aria-label', `Se déconnecter de ${currentAccount.displayName}`); badge.classList.add('auth-logout'); }
    const profileName = document.querySelector('.profile b');
    const profileRole = document.querySelector('.profile small');
    const profileAvatar = document.querySelector('.profile-avatar');
    if (profileName) profileName.textContent = currentAccount.displayName;
    if (profileRole) profileRole.textContent = currentAccount.role === 'admin' ? 'Responsable local' : 'Membre local';
    if (profileAvatar) profileAvatar.textContent = initials(currentAccount.displayName);
  }
  async function createFirstAdmin(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const username = normalizeUsername(values.username);
    const email = normalizeEmail(values.email);
    if (!username) return showMessage('Saisissez un identifiant.');
    if (!validEmail(email)) return showMessage('Saisissez une adresse e-mail valide.');
    const policy = passwordRuleError(values.password);
    if (policy) return showMessage(policy);
    if (values.password !== values.passwordConfirm) return showMessage('Les deux mots de passe ne correspondent pas.');
    try {
      const salt = randomHex();
      const account = { id: `account-${randomHex(16)}`, username, email, displayName: values.displayName.trim(), role: 'admin', active: true, salt, hash: await passwordHash(values.password, salt), createdAt: new Date().toISOString() };
      accounts = [account];
      if (!saveAccounts()) { accounts = []; return; }
      recordAccountChange('Ajouté', account);
      openApp(account);
    } catch {
      showMessage('La création locale des comptes nécessite un navigateur récent et une adresse sécurisée (HTTPS ou localhost).');
    }
  }
  async function login(event) {
    event.preventDefault();
    if (Date.now() < lockedUntil) return showMessage('Trop d’essais. Attendez quelques secondes avant de réessayer.');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const identity = normalizeUsername(values.username);
    const emailIdentity = normalizeEmail(values.username);
    const account = accounts.find(item => item.active !== false && (item.username === identity || (item.email && normalizeEmail(item.email) === emailIdentity)));
    try {
      const candidate = account ? await passwordHash(values.password, account.salt) : await passwordHash(values.password, accounts[0]?.salt || randomHex());
      if (!account || !sameHash(candidate, account.hash)) {
        failures++;
        if (failures >= 5) { lockedUntil = Date.now() + 30000; failures = 0; }
        return renderGate('Identifiant ou mot de passe incorrect.');
      }
      failures = 0;
      if (!validEmail(account.email)) return renderEmailSetup(account);
      openApp(account);
    } catch {
      showMessage('La vérification nécessite un navigateur récent et une adresse sécurisée (HTTPS ou localhost).');
    }
  }
  function accountSettingsMarkup() {
    if (!currentAccount || currentAccount.role !== 'admin') return '';
    const rows = accounts.map(account => `<div class="account-row ${account.active === false ? 'account-disabled' : ''}"><span><b>${escapeText(account.displayName)} · ${account.role === 'admin' ? 'Responsable' : 'Membre'}</b><small>${escapeText(account.username)} · ${escapeText(account.email || 'Adresse e-mail à ajouter')} · ${account.active === false ? 'Désactivé' : 'Actif'}</small></span><span class="account-actions"><button type="button" data-auth-action="edit" data-account-id="${escapeText(account.id)}">Modifier</button>${account.id !== currentAccount.id && account.role !== 'admin' ? `<button type="button" data-auth-action="toggle" data-account-id="${escapeText(account.id)}">${account.active === false ? 'Réactiver' : 'Désactiver'}</button>` : ''}</span></div>`).join('');
    return `<section class="panel auth-account-panel"><div class="panel-head"><div><h2>Comptes de cet appareil</h2><p>Créez des profils locaux, associez leur e-mail et modifiez leurs identifiants.</p></div><button class="btn secondary" type="button" data-auth-action="add">＋ Créer un compte</button></div><div class="account-list">${rows}</div><div id="account-form-shell" hidden><form class="account-form" data-auth-form><input type="hidden" name="id"><div class="form-row"><label>Nom affiché<input name="displayName" required maxlength="80"></label><label>Identifiant<input name="username" required maxlength="80" autocapitalize="none"></label></div><label>Adresse e-mail<input name="email" type="email" required maxlength="254" autocomplete="email"></label>${passwordField('account-password', 'password', 'Nouveau mot de passe', 'new-password', false, 'Une majuscule et un chiffre obligatoires ; vide pour le conserver.')}${passwordField('account-password-confirm', 'passwordConfirm', 'Confirmer le nouveau mot de passe', 'new-password', false)}<label class="account-active-label"><input name="active" type="checkbox" checked> Compte actif</label><p class="auth-message" role="alert"></p><div class="form-actions"><button type="button" class="btn secondary" data-auth-action="cancel">Annuler</button><button class="btn primary" type="submit">Enregistrer le compte</button></div></form></div>${accountNotice()}</section>`;
  }
  function refreshSettings() {
    if (page === 'parametres') route('parametres');
  }
  function beginAccountForm(account = null) {
    const shell = document.querySelector('#account-form-shell');
    const form = shell?.querySelector('form');
    if (!shell || !form) return;
    form.reset(); form.elements.id.value = account?.id || '';
    form.elements.displayName.value = account?.displayName || '';
    form.elements.username.value = account?.username || '';
    form.elements.email.value = account?.email || '';
    form.elements.active.checked = account ? account.active !== false : true;
    form.elements.password.value = '';
    form.elements.passwordConfirm.value = '';
    shell.hidden = false;
    form.elements.displayName.focus();
  }
  document.addEventListener('click', event => {
    if (event.target.closest('[data-auth-action="download-recovery"]')) { downloadRecoveryCopy(); return; }
    const passwordToggle = event.target.closest('[data-toggle-password]');
    if (passwordToggle) {
      const input = document.getElementById(passwordToggle.dataset.togglePassword);
      if (input) { const visible = input.type === 'password'; input.type = visible ? 'text' : 'password'; passwordToggle.textContent = visible ? 'Masquer' : 'Afficher'; passwordToggle.setAttribute('aria-pressed', String(visible)); passwordToggle.setAttribute('aria-label', `${visible ? 'Masquer' : 'Afficher'} le mot de passe`); input.focus(); }
      return;
    }
    if (event.target.closest('[data-auth-action="forgot-password"]')) { renderPasswordRecovery(); return; }
    if (event.target.closest('[data-auth-action="back-to-login"]')) { renderGate(); return; }
    if (event.target.closest('.top-avatar') && currentAccount) { logout('Vous êtes déconnecté.'); return; }
    const button = event.target.closest('[data-auth-action]');
    if (!button || !currentAccount || currentAccount.role !== 'admin') return;
    const account = accounts.find(item => item.id === button.dataset.accountId);
    if (button.dataset.authAction === 'add') beginAccountForm();
    if (button.dataset.authAction === 'edit' && account) beginAccountForm(account);
    if (button.dataset.authAction === 'cancel') { const shell = document.querySelector('#account-form-shell'); if (shell) shell.hidden = true; }
    if (button.dataset.authAction === 'toggle' && account && account.role !== 'admin' && account.id !== currentAccount.id) {
      account.active = account.active === false;
      if (saveAccounts()) { recordAccountChange(account.active ? 'Réactivé' : 'Désactivé', account); refreshSettings(); }
    }
  });
  for (const eventName of ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'click', 'input', 'change']) {
    document.addEventListener(eventName, recordActivity, { passive: true, capture: eventName === 'click' });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && currentAccount) persistSession(lastActivity);
    else if (document.visibilityState === 'visible') checkIdleSession();
  });
  window.addEventListener('pageshow', checkIdleSession);
  window.addEventListener('pagehide', () => { if (currentAccount) persistSession(lastActivity); });
  window.addEventListener('storage', event => {
    if (event.key !== SESSION_KEY || !currentAccount) return;
    if (!event.newValue) { logout('La session a été fermée dans un autre onglet.'); return; }
    try {
      const sharedSession = JSON.parse(event.newValue);
      if (!SSPDomain.isLocalSessionActive(sharedSession, currentAccount, Date.now(), IDLE_LIMIT_MS)) {
        logout('La session a changé dans un autre onglet. Reconnectez-vous.');
        return;
      }
      lastActivity = sharedSession.lastActivity;
      scheduleIdleCheck();
    } catch { logout('La session locale est invalide. Reconnectez-vous.'); }
  });
  document.addEventListener('submit', async event => {
    const form = event.target.closest('[data-auth-form]');
    if (!form) return;
    event.preventDefault();
    if (!currentAccount || currentAccount.role !== 'admin') return;
    const values = Object.fromEntries(new FormData(form));
    const username = normalizeUsername(values.username);
    const email = normalizeEmail(values.email);
    const duplicate = accounts.some(account => account.username === username && account.id !== values.id);
    const duplicateEmail = accounts.some(account => normalizeEmail(account.email) === email && account.id !== values.id);
    const current = accounts.find(account => account.id === values.id);
    const message = form.querySelector('.auth-message');
    if (!username || !values.displayName.trim()) { message.textContent = 'Saisissez un nom et un identifiant.'; return; }
    if (!validEmail(email)) { message.textContent = 'Saisissez une adresse e-mail valide.'; return; }
    if (duplicate) { message.textContent = 'Cet identifiant est déjà utilisé.'; return; }
    if (duplicateEmail) { message.textContent = 'Cette adresse e-mail est déjà utilisée par un autre compte.'; return; }
    if (!current && !values.password) { message.textContent = 'Choisissez un mot de passe.'; return; }
    if (values.password && passwordRuleError(values.password)) { message.textContent = passwordRuleError(values.password); return; }
    if (values.password && values.password !== values.passwordConfirm) { message.textContent = 'Les deux mots de passe ne correspondent pas.'; return; }
    const before = accounts.map(account => ({ ...account }));
    let changedAccount = current;
    try {
      if (current) {
        current.username = username;
        current.email = email;
        current.displayName = values.displayName.trim();
        if (current.id !== currentAccount.id) current.active = form.elements.active.checked;
        if (values.password) { current.salt = randomHex(); current.hash = await passwordHash(values.password, current.salt); }
      } else {
        const salt = randomHex();
        changedAccount = { id: `account-${randomHex(16)}`, username, email, displayName: values.displayName.trim(), role: 'member', active: form.elements.active.checked, salt, hash: await passwordHash(values.password, salt), createdAt: new Date().toISOString() };
        accounts.push(changedAccount);
      }
      if (!saveAccounts()) { accounts = before; return; }
      recordAccountChange(current ? 'Modifié' : 'Ajouté', changedAccount);
      currentAccount = accounts.find(account => account.id === currentAccount.id);
      updateProfile(); refreshSettings();
    } catch {
      accounts = before;
      message.textContent = 'La mise à jour du compte a échoué. Réessayez sur une adresse sécurisée.';
    }
  });
  const originalSettingsPage = window.settingsPage;
  if (typeof originalSettingsPage === 'function') window.settingsPage = function () { return originalSettingsPage() + accountSettingsMarkup() + recoverySettingsMarkup(); };
  if (!resumeSession()) renderGate();
  window.SSPAuth = { accountSettingsMarkup, getCurrentAccount: () => currentAccount };
})();
