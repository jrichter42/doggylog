const state = {
  status: null,
  entries: [],
  breath: { count: 0, startedAt: 0, window: 30 },
  pulse: { count: 0, startedAt: 0, window: 30 },
};

const $ = (id) => document.getElementById(id);

const els = {
  connectionStatus: $('connectionStatus'),
  loginButton: $('loginButton'),
  logoutButton: $('logoutButton'),
  authScreen: $('authScreen'),
  setupForm: $('setupForm'),
  setupInput: $('setupInput'),
  loginPanel: $('loginPanel'),
  passkeyLoginButton: $('passkeyLoginButton'),
  loginEmailForm: $('loginEmailForm'),
  loginEmailInput: $('loginEmailInput'),
  loginEmailState: $('loginEmailState'),
  authMessage: $('authMessage'),
  workspace: $('workspace'),
  breathRate: $('breathRate'),
  pulseRate: $('pulseRate'),
  breathTapButton: $('breathTapButton'),
  pulseTapButton: $('pulseTapButton'),
  breathInput: $('breathInput'),
  pulseInput: $('pulseInput'),
  measuredAtInput: $('measuredAtInput'),
  stateInput: $('stateInput'),
  notesInput: $('notesInput'),
  entryForm: $('entryForm'),
  saveState: $('saveState'),
  refreshButton: $('refreshButton'),
  entriesList: $('entriesList'),
  adminPanel: $('adminPanel'),
  createUserForm: $('createUserForm'),
  setupResult: $('setupResult'),
  userList: $('userList'),
};

function setMessage(text, isError = false) {
  els.authMessage.hidden = !text;
  els.authMessage.textContent = text || '';
  els.authMessage.style.borderColor = isError ? '#f04438' : '';
}

function csrf() {
  return state.status?.auth?.csrf || '';
}

function passkeysAvailable() {
  return window.isSecureContext === true
    && window.PublicKeyCredential !== undefined
    && navigator.credentials !== undefined
    && typeof navigator.credentials.create === 'function'
    && typeof navigator.credentials.get === 'function';
}

function requirePasskeys() {
  if (passkeysAvailable()) {
    return;
  }

  const reason = window.isSecureContext !== true
    ? 'Passkeys brauchen HTTPS oder localhost.'
    : 'Dieser Browser unterstuetzt Passkeys hier nicht.';
  throw new Error(`${reason} Oeffne die Seite direkt in Safari, Chrome, Edge oder Firefox.`);
}

async function api(action, options = {}) {
  const url = new URL('api.php', window.location.href);
  url.searchParams.set('action', action);
  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => url.searchParams.set(key, value));
  }

  const headers = { Accept: 'application/json' };
  const init = { method: options.method || 'GET', headers };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    if (csrf()) {
      headers['X-CSRF-Token'] = csrf();
    }
    init.body = JSON.stringify(options.body);
    init.method = options.method || 'POST';
  }

  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({ ok: false, error: 'Ungueltige Serverantwort' }));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

function bytesToBase64Url(bytes) {
  const binary = Array.from(new Uint8Array(bytes), (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodePublicKeyOptions(publicKey) {
  const decoded = { ...publicKey, challenge: base64UrlToBytes(publicKey.challenge) };
  if (decoded.user?.id) {
    decoded.user = { ...decoded.user, id: base64UrlToBytes(decoded.user.id) };
  }
  if (Array.isArray(decoded.allowCredentials)) {
    decoded.allowCredentials = decoded.allowCredentials.map((credential) => ({
      ...credential,
      id: base64UrlToBytes(credential.id),
    }));
  }
  if (Array.isArray(decoded.excludeCredentials)) {
    decoded.excludeCredentials = decoded.excludeCredentials.map((credential) => ({
      ...credential,
      id: base64UrlToBytes(credential.id),
    }));
  }
  return decoded;
}

function serializeCredential(credential) {
  const response = credential.response;
  const serialized = {
    id: credential.id,
    rawId: bytesToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bytesToBase64Url(response.clientDataJSON),
    },
  };

  if (response.authenticatorData) {
    serialized.response.authenticatorData = bytesToBase64Url(response.authenticatorData);
  }
  if (response.signature) {
    serialized.response.signature = bytesToBase64Url(response.signature);
  }
  if (response.userHandle) {
    serialized.response.userHandle = bytesToBase64Url(response.userHandle);
  }
  if (response.attestationObject) {
    serialized.response.attestationObject = bytesToBase64Url(response.attestationObject);
  }

  return serialized;
}

async function passkeyLogin() {
  setMessage('');
  requirePasskeys();
  const options = await api('auth-login-options', { method: 'POST', body: {} });
  const credential = await navigator.credentials.get({ publicKey: decodePublicKeyOptions(options.publicKey) });
  const result = await api('auth-login-verify', {
    method: 'POST',
    body: { challenge_id: options.challenge_id, credential: serializeCredential(credential) },
  });
  state.status = { ...(state.status || {}), auth: { ...(state.status?.auth || {}), user: result.user, csrf: result.csrf } };
  await refresh();
}

async function passkeySetup(event) {
  event.preventDefault();
  setMessage('');
  requirePasskeys();
  const setup = els.setupInput.value;
  const options = await api('auth-register-options', { method: 'POST', body: { setup } });
  const credential = await navigator.credentials.create({ publicKey: decodePublicKeyOptions(options.publicKey) });
  const result = await api('auth-register-verify', {
    method: 'POST',
    body: { setup, challenge_id: options.challenge_id, credential: serializeCredential(credential) },
  });
  window.history.replaceState({}, document.title, window.location.pathname);
  state.status = { ...(state.status || {}), auth: { ...(state.status?.auth || {}), user: result.user, csrf: result.csrf } };
  await refresh();
}

async function verifyEmailLogin(token) {
  const result = await api('auth-email-login-verify', { method: 'POST', body: { token } });
  window.history.replaceState({}, document.title, window.location.pathname);
  state.status = { ...(state.status || {}), auth: { ...(state.status?.auth || {}), user: result.user, csrf: result.csrf } };
  await refresh();
}

async function refresh() {
  state.status = await api('status');
  renderShell();
  if (state.status.auth?.user) {
    await loadEntries();
    if (state.status.auth.user.permissions.includes('manage_users')) {
      await loadUsers();
    }
  }
}

function renderShell() {
  const user = state.status?.auth?.user;
  const params = new URLSearchParams(window.location.search);
  const setup = params.get('setup');

  els.connectionStatus.textContent = user ? user.display_name || user.username : 'Nicht eingeloggt';
  els.authScreen.hidden = Boolean(user);
  els.workspace.hidden = !user;
  els.loginButton.hidden = Boolean(user);
  els.logoutButton.hidden = !user;
  els.setupForm.hidden = !setup || Boolean(user);
  els.loginPanel.hidden = Boolean(setup) && !user;
  els.setupInput.value = setup || '';
  els.loginEmailForm.hidden = !state.status?.mail?.login_enabled;
  els.adminPanel.hidden = !user?.permissions?.includes('manage_users');
  els.passkeyLoginButton.disabled = !passkeysAvailable();
  els.setupForm.querySelector('button[type="submit"]').disabled = !passkeysAvailable();

  if (state.status.auth?.bootstrap_pending && !setup && !user) {
    setMessage('Initiales Setup ist offen. Lies web/bootstrap_setup.txt auf dem Server.', false);
  } else if (!user && !passkeysAvailable()) {
    setMessage('Passkeys sind hier nicht verfuegbar. Nutze HTTPS und einen normalen Browser, keinen In-App-Browser.', true);
  }
}

async function loadEntries() {
  const result = await api('objects', { query: { type: 'vitals' } });
  state.entries = result.objects || [];
  renderEntries();
}

function renderEntries() {
  if (state.entries.length === 0) {
    els.entriesList.innerHTML = '<p class="muted">Noch keine Eintraege.</p>';
    return;
  }

  els.entriesList.innerHTML = state.entries.map((entry) => {
    const date = formatDate(entry.measured_at || entry._created);
    const notes = entry.notes ? `<p class="muted">${escapeHtml(entry.notes)}</p>` : '';
    return `
      <article class="entry">
        <div class="entry-main">
          <strong>${date}</strong>
          <div class="numbers">
            ${entry.breaths_per_minute !== null ? `<span class="chip">AF ${entry.breaths_per_minute}</span>` : ''}
            ${entry.pulse_per_minute !== null ? `<span class="chip">Puls ${entry.pulse_per_minute}</span>` : ''}
            <span class="chip">${stateLabel(entry.state)}</span>
          </div>
        </div>
        ${notes}
      </article>
    `;
  }).join('');
}

async function loadUsers() {
  const result = await api('admin-users');
  els.userList.innerHTML = (result.users || []).map((user) => `
    <div class="user-row">
      <strong>${escapeHtml(user.display_name || user.username)}</strong>
      <span class="muted">${escapeHtml(user.username)} · ${user.permissions.join(', ')}</span>
    </div>
  `).join('');
}

function tap(kind) {
  const meter = state[kind];
  const now = Date.now();
  if (!meter.startedAt || now - meter.startedAt > meter.window * 1000) {
    meter.startedAt = now;
    meter.count = 0;
  }
  meter.count += 1;
  const elapsed = Math.max((now - meter.startedAt) / 1000, 1);
  const rate = Math.round((meter.count / Math.min(elapsed, meter.window)) * 60);
  const target = kind === 'breath' ? els.breathRate : els.pulseRate;
  const input = kind === 'breath' ? els.breathInput : els.pulseInput;
  target.value = String(rate);
  input.value = String(rate);
}

async function saveEntry(event) {
  event.preventDefault();
  els.saveState.hidden = false;
  els.saveState.textContent = 'Speichere...';
  const body = {
    type: 'vitals',
    object: {
      measured_at: els.measuredAtInput.value ? new Date(els.measuredAtInput.value).toISOString() : '',
      breaths_per_minute: els.breathInput.value,
      pulse_per_minute: els.pulseInput.value,
      state: els.stateInput.value,
      notes: els.notesInput.value,
    },
  };
  await api('object-create', { method: 'POST', body });
  els.saveState.textContent = 'Gespeichert.';
  els.notesInput.value = '';
  state.breath = { ...state.breath, count: 0, startedAt: 0 };
  state.pulse = { ...state.pulse, count: 0, startedAt: 0 };
  await loadEntries();
}

function setWindow(kind, value) {
  state[kind].window = Number(value);
  state[kind].count = 0;
  state[kind].startedAt = 0;
  document.querySelectorAll(`[data-${kind}-window]`).forEach((button) => {
    button.classList.toggle('is-active', button.dataset[`${kind}Window`] === value);
  });
}

function setDefaultTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  els.measuredAtInput.value = now.toISOString().slice(0, 16);
}

function formatDate(value) {
  if (!value) return 'Ohne Zeitpunkt';
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function stateLabel(value) {
  return {
    resting: 'Ruhe',
    sleeping: 'Schlaf',
    after_walk: 'Nach Spaziergang',
    excited: 'Aufgeregt',
    other: 'Sonstiges',
  }[value] || value || 'Ruhe';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}

els.passkeyLoginButton.addEventListener('click', () => passkeyLogin().catch((error) => setMessage(error.message, true)));
els.setupForm.addEventListener('submit', (event) => passkeySetup(event).catch((error) => setMessage(error.message, true)));
els.logoutButton.addEventListener('click', async () => {
  await api('auth-logout', { method: 'POST', body: {} });
  await refresh();
});
els.loginButton.addEventListener('click', () => {
  els.authScreen.hidden = false;
});
els.loginEmailForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  els.loginEmailState.hidden = false;
  els.loginEmailState.textContent = 'Sende...';
  const result = await api('auth-email-login-request', { method: 'POST', body: { email: els.loginEmailInput.value } });
  els.loginEmailState.textContent = result.message || 'Wenn die Adresse bekannt ist, wurde ein Link gesendet.';
});
els.breathTapButton.addEventListener('click', () => tap('breath'));
els.pulseTapButton.addEventListener('click', () => tap('pulse'));
document.querySelectorAll('[data-breath-window]').forEach((button) => button.addEventListener('click', () => setWindow('breath', button.dataset.breathWindow)));
document.querySelectorAll('[data-pulse-window]').forEach((button) => button.addEventListener('click', () => setWindow('pulse', button.dataset.pulseWindow)));
els.entryForm.addEventListener('submit', (event) => saveEntry(event).catch((error) => {
  els.saveState.hidden = false;
  els.saveState.textContent = error.message;
}));
els.refreshButton.addEventListener('click', () => loadEntries().catch((error) => setMessage(error.message, true)));
els.createUserForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const result = await api('admin-create-user', {
    method: 'POST',
    body: {
      username: form.get('username'),
      display_name: form.get('display_name'),
      permissions: ['read', 'write'],
    },
  });
  els.setupResult.hidden = false;
  els.setupResult.textContent = result.setup?.setup_url || 'Setup-Link erstellt.';
  event.currentTarget.reset();
  await loadUsers();
});

setDefaultTime();

const params = new URLSearchParams(window.location.search);
const loginToken = params.get('login');
if (loginToken) {
  verifyEmailLogin(loginToken).catch((error) => setMessage(error.message, true));
} else {
  refresh().catch((error) => setMessage(error.message, true));
}
