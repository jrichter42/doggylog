const sharedModes = [
  ['resting', 'Ruhend'],
  ['active', 'Aktivität'],
  ['panting', 'Hechelnd'],
  ['sleeping', 'Schlafend'],
];

const modes = {
  breath: sharedModes,
  pulse: sharedModes,
};

const state = {
  status: null,
  entries: [],
  dogs: [],
  measureType: 'breath',
  mode: 'resting',
  duration: 30,
  measuring: false,
  startedAt: 0,
  timer: null,
  finishTimer: null,
  taps: 0,
  result: null,
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
  accountLink: $('accountLink'),
  dogSelect: $('dogSelect'),
  modeButtons: $('modeButtons'),
  tapButton: $('tapButton'),
  tapButtonMain: $('tapButtonMain'),
  tapButtonSub: $('tapButtonSub'),
  newMeasurementButton: $('newMeasurementButton'),
  meterStatus: $('meterStatus'),
  meterCount: $('meterCount'),
  measurementResult: $('measurementResult'),
  measuredAtInput: $('measuredAtInput'),
  locationInput: $('locationInput'),
  contextInput: $('contextInput'),
  notesInput: $('notesInput'),
  entryForm: $('entryForm'),
  saveButton: $('saveButton'),
  saveState: $('saveState'),
  refreshButton: $('refreshButton'),
  entriesList: $('entriesList'),
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
  if (passkeysAvailable()) return;
  const reason = window.isSecureContext !== true
    ? 'Passkeys brauchen HTTPS oder localhost.'
    : 'Dieser Browser unterstützt Passkeys hier nicht.';
  throw new Error(`${reason} Öffne die Seite direkt in Safari, Chrome, Edge oder Firefox.`);
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
    if (csrf()) headers['X-CSRF-Token'] = csrf();
    init.body = JSON.stringify(options.body);
    init.method = options.method || 'POST';
  }

  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({ ok: false, error: 'Ungültige Serverantwort' }));
  if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
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
  if (decoded.user?.id) decoded.user = { ...decoded.user, id: base64UrlToBytes(decoded.user.id) };
  if (Array.isArray(decoded.allowCredentials)) {
    decoded.allowCredentials = decoded.allowCredentials.map((credential) => ({ ...credential, id: base64UrlToBytes(credential.id) }));
  }
  if (Array.isArray(decoded.excludeCredentials)) {
    decoded.excludeCredentials = decoded.excludeCredentials.map((credential) => ({ ...credential, id: base64UrlToBytes(credential.id) }));
  }
  return decoded;
}

function serializeCredential(credential) {
  const response = credential.response;
  const serialized = {
    id: credential.id,
    rawId: bytesToBase64Url(credential.rawId),
    type: credential.type,
    response: { clientDataJSON: bytesToBase64Url(response.clientDataJSON) },
  };
  if (response.authenticatorData) serialized.response.authenticatorData = bytesToBase64Url(response.authenticatorData);
  if (response.signature) serialized.response.signature = bytesToBase64Url(response.signature);
  if (response.userHandle) serialized.response.userHandle = bytesToBase64Url(response.userHandle);
  if (response.attestationObject) serialized.response.attestationObject = bytesToBase64Url(response.attestationObject);
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
  renderMeasurementControls();
  if (state.status.auth?.user) {
    await loadDogs();
    await loadEntries();
  }
}

function renderShell() {
  const user = state.status?.auth?.user;
  const params = new URLSearchParams(window.location.search);
  const setup = params.get('setup');

  els.connectionStatus.textContent = user ? user.display_name || user.username : 'Nicht eingeloggt';
  els.authScreen.hidden = Boolean(user);
  els.workspace.hidden = !user;
  els.accountLink.hidden = !user;
  els.loginButton.hidden = Boolean(user);
  els.logoutButton.hidden = !user;
  els.setupForm.hidden = !setup || Boolean(user);
  els.loginPanel.hidden = Boolean(setup) && !user;
  els.setupInput.value = setup || '';
  els.loginEmailForm.hidden = !state.status?.mail?.login_enabled;
  els.passkeyLoginButton.disabled = !passkeysAvailable();
  els.setupForm.querySelector('button[type="submit"]').disabled = !passkeysAvailable();

  if (state.status.auth?.bootstrap_pending && !setup && !user) {
    setMessage('Initiales Setup offen. Lies web/bootstrap_setup.txt auf Server.', false);
  } else if (!user && !passkeysAvailable()) {
    setMessage('Passkeys hier nicht verfügbar. Nutze HTTPS und normalen Browser, keinen In-App-Browser.', true);
  }
}

function renderMeasurementControls() {
  document.querySelectorAll('[data-measure-type]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.measureType === state.measureType);
  });

  els.modeButtons.innerHTML = modes[state.measureType].map(([value, label]) => (
    `<button type="button" data-mode="${value}" class="${value === state.mode ? 'is-active' : ''}">${label}</button>`
  )).join('');

  if (!modes[state.measureType].some(([value]) => value === state.mode)) {
    state.mode = modes[state.measureType][0][0];
    renderMeasurementControls();
    return;
  }

  els.modeButtons.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      state.mode = button.dataset.mode;
      resetMeasurement();
      renderMeasurementControls();
    });
  });

  document.querySelectorAll('[data-duration]').forEach((button) => {
    button.classList.toggle('is-active', Number(button.dataset.duration) === state.duration);
  });

  updateMeterView();
}

function resetMeasurement() {
  clearInterval(state.timer);
  clearTimeout(state.finishTimer);
  state.measuring = false;
  state.startedAt = 0;
  state.timer = null;
  state.finishTimer = null;
  state.taps = 0;
  state.result = null;
  els.tapButton.disabled = false;
  els.newMeasurementButton.hidden = true;
  els.saveButton.disabled = true;
  els.saveState.hidden = true;
}

function startMeasurement() {
  resetMeasurement();
  state.measuring = true;
  state.startedAt = Date.now();
  state.taps = 1;
  pulseFeedback();
  state.timer = setInterval(updateMeterView, 120);
  state.finishTimer = setTimeout(finishMeasurement, state.duration * 1000);
  updateMeterView();
}

function registerTap() {
  if (!state.measuring) {
    startMeasurement();
    return;
  }
  state.taps += 1;
  pulseFeedback();
  updateMeterView();
}

function finishMeasurement() {
  if (!state.measuring) return;
  clearInterval(state.timer);
  clearTimeout(state.finishTimer);
  state.measuring = false;
  state.timer = null;
  state.finishTimer = null;
  state.result = Math.round((state.taps / state.duration) * 60);
  els.measuredAtInput.value = new Date().toISOString();
  els.tapButton.disabled = true;
  els.newMeasurementButton.hidden = false;
  els.saveButton.disabled = false;
  updateMeterView();
}

function pulseFeedback() {
  els.tapButton.classList.remove('tap-hit');
  void els.tapButton.offsetWidth;
  els.tapButton.classList.add('tap-hit');
  if (navigator.vibrate) navigator.vibrate(18);
}

function updateMeterView() {
  const label = state.measureType === 'breath' ? 'Atemzug' : 'Pulsschlag';
  const unit = state.measureType === 'breath' ? 'Atemzüge/min' : 'Schläge/min';
  const elapsed = state.startedAt ? Math.min((Date.now() - state.startedAt) / 1000, state.duration) : 0;
  const remaining = Math.max(0, Math.ceil(state.duration - elapsed));
  const liveRate = state.measuring && elapsed > 0 ? Math.round((state.taps / elapsed) * 60) : null;

  els.meterStatus.textContent = state.measuring ? `${remaining}s verbleibend` : (state.result === null ? 'Bereit' : 'Fertig');
  els.meterCount.textContent = `${state.taps} ${state.taps === 1 ? 'Tap' : 'Taps'}`;
  els.tapButtonMain.textContent = state.measuring ? `${label} tippen` : (state.result === null ? 'Messung starten' : 'Messung beendet');
  els.tapButtonSub.textContent = state.measuring ? 'Tap registriert sofort' : (state.result === null ? 'Erster Tap startet Timer' : 'Ergebnis speichern oder neue Messung starten');
  els.measurementResult.value = state.result !== null ? `${state.result} ${unit}` : (liveRate !== null ? `${liveRate} live` : '-- / min');
}

async function loadEntries() {
  const result = await api('objects', { query: { type: 'vitals' } });
  state.entries = result.objects || [];
  renderEntries();
}

async function loadDogs() {
  const result = await api('objects', { query: { type: 'dogs' } });
  state.dogs = result.objects || [];
  if (state.dogs.length === 0) {
    const created = await api('object-create', {
      method: 'POST',
      body: { type: 'dogs', object: { name: 'Mein Hund' } },
    });
    state.dogs = [created.object];
  }
  renderDogSelect();
}

function renderDogSelect() {
  const selected = els.dogSelect.value || state.dogs[0]?._id || '';
  els.dogSelect.innerHTML = state.dogs.map((dog) => (
    `<option value="${escapeHtml(dog._id)}">${escapeHtml(dog.name || 'Mein Hund')}</option>`
  )).join('');
  if (state.dogs.some((dog) => dog._id === selected)) {
    els.dogSelect.value = selected;
  }
}

function renderEntries() {
  if (state.entries.length === 0) {
    els.entriesList.innerHTML = '<p class="muted">Noch keine Messungen.</p>';
    return;
  }

  els.entriesList.innerHTML = state.entries.map((entry) => {
    const type = entry.measurement_type || (entry.pulse_per_minute !== null && entry.pulse_per_minute !== undefined ? 'pulse' : 'breath');
    const rate = type === 'pulse' ? entry.pulse_per_minute : entry.breaths_per_minute;
    const label = type === 'pulse' ? 'Puls' : 'Atemfrequenz';
    const context = entry.context ? `<p class="muted">${escapeHtml(entry.context)}</p>` : '';
    const notes = entry.notes ? `<p class="muted">${escapeHtml(entry.notes)}</p>` : '';
    return `
      <article class="entry">
        <div class="entry-main">
          <div>
            <strong>${escapeHtml(entry.dog_name || 'Mein Hund')}</strong>
            <span class="muted">${formatDate(entry.measured_at || entry._created)}</span>
          </div>
          <div class="numbers">
            <span class="chip">${label} ${rate}</span>
            <span class="chip">${modeLabel(type, entry.mode)}</span>
            <span class="chip">${locationLabel(entry.location)}</span>
            <button class="delete-entry" type="button" data-delete-entry="${escapeHtml(entry._id)}" data-revision="${entry._revision}">Löschen</button>
          </div>
        </div>
        ${context}
        ${notes}
      </article>
    `;
  }).join('');

  els.entriesList.querySelectorAll('[data-delete-entry]').forEach((button) => {
    button.addEventListener('click', () => deleteEntry(button.dataset.deleteEntry, Number(button.dataset.revision)));
  });
}

async function saveEntry(event) {
  event.preventDefault();
  if (state.result === null) return;

  const dog = state.dogs.find((item) => item._id === els.dogSelect.value) || state.dogs[0];
  els.saveState.hidden = false;
  els.saveState.textContent = 'Speichere...';

  const object = {
    measured_at: els.measuredAtInput.value || new Date().toISOString(),
    dog_id: dog?._id || '',
    dog_name: dog?.name || 'Mein Hund',
    measurement_type: state.measureType,
    mode: state.mode,
    duration_seconds: state.duration,
    location: els.locationInput.value,
    context: els.contextInput.value,
    notes: els.notesInput.value,
  };

  if (state.measureType === 'pulse') object.pulse_per_minute = state.result;
  if (state.measureType === 'breath') object.breaths_per_minute = state.result;

  await api('object-create', { method: 'POST', body: { type: 'vitals', object } });
  els.saveState.textContent = 'Gespeichert.';
  els.contextInput.value = '';
  els.notesInput.value = '';
  resetMeasurement();
  updateMeterView();
  await loadEntries();
}

async function deleteEntry(id, revision) {
  if (!id || !revision) return;
  if (!window.confirm('Messung löschen?')) return;
  await api('object-delete', { method: 'POST', body: { type: 'vitals', id, base_revision: revision } });
  await loadEntries();
}

function formatDate(value) {
  if (!value) return 'Ohne Zeitpunkt';
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function modeLabel(type, value) {
  return Object.fromEntries(modes[type] || [])[value] || value || 'Ruhend';
}

function locationLabel(value) {
  return { home: 'Zuhause', school: 'Schule', away: 'Unterwegs' }[value] || value || 'Zuhause';
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
  els.loginEmailState.textContent = result.message || 'Wenn Adresse bekannt ist, wurde Link gesendet.';
});

document.querySelectorAll('[data-measure-type]').forEach((button) => {
  button.addEventListener('click', () => {
    state.measureType = button.dataset.measureType;
    state.mode = modes[state.measureType][0][0];
    resetMeasurement();
    renderMeasurementControls();
  });
});
document.querySelectorAll('[data-duration]').forEach((button) => {
  button.addEventListener('click', () => {
    state.duration = Number(button.dataset.duration);
    resetMeasurement();
    renderMeasurementControls();
  });
});
els.tapButton.addEventListener('click', registerTap);
els.newMeasurementButton.addEventListener('click', () => {
  resetMeasurement();
  updateMeterView();
});
els.entryForm.addEventListener('submit', (event) => saveEntry(event).catch((error) => {
  els.saveState.hidden = false;
  els.saveState.textContent = error.message;
}));
els.refreshButton.addEventListener('click', () => loadEntries().catch((error) => setMessage(error.message, true)));
renderMeasurementControls();

const params = new URLSearchParams(window.location.search);
const loginToken = params.get('login');
if (loginToken) {
  verifyEmailLogin(loginToken).catch((error) => setMessage(error.message, true));
} else {
  refresh().catch((error) => setMessage(error.message, true));
}
