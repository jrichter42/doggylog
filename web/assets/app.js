const sharedModes = [
  ['resting', 'Ruhend'],
  ['active', 'Aktiv'],
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
  duration: 15,
  view: window.location.hash === '#records' ? 'records' : 'measure',
  location: '',
  contextPresets: [],
  locationPresets: [],
  contextDeleteMode: false,
  contextDeleteCandidate: '',
  locationDeleteMode: false,
  locationDeleteCandidate: '',
  emailLoginOffered: false,
  measuring: false,
  startedAt: 0,
  timer: null,
  finishTimer: null,
  taps: 0,
  result: null,
  results: { breath: null, pulse: null },
  resultTaps: { breath: 0, pulse: 0 },
  resultDurations: { breath: null, pulse: null },
  editingEntryId: null,
  saveTimers: new Map(),
};

const $ = (id) => document.getElementById(id);

const els = {
  connectionStatus: $('connectionStatus'),
  topTabs: $('topTabs'),
  configNotice: $('configNotice'),
  loginButton: $('loginButton'),
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
  measurementView: $('measurementView'),
  recordsView: $('recordsView'),
  dogSelectLabel: $('dogSelectLabel'),
  dogSelect: $('dogSelect'),
  dogButtons: $('dogButtons'),
  dogNameDisplay: $('dogNameDisplay'),
  modeButtons: $('modeButtons'),
  meterStage: $('meterStage'),
  tapButton: $('tapButton'),
  tapButtonMain: $('tapButtonMain'),
  tapButtonSub: $('tapButtonSub'),
  newMeasurementButton: $('newMeasurementButton'),
  meterStatus: $('meterStatus'),
  meterCount: $('meterCount'),
  measurementResult: $('measurementResult'),
  measuredAtInput: $('measuredAtInput'),
  locationButtons: $('locationButtons'),
  addLocationButton: $('addLocationButton'),
  deleteLocationButton: $('deleteLocationButton'),
  contextInput: $('contextInput'),
  contextButtons: $('contextButtons'),
  addContextButton: $('addContextButton'),
  deleteContextButton: $('deleteContextButton'),
  notesInput: $('notesInput'),
  entryForm: $('entryForm'),
  saveButton: $('saveButton'),
  saveState: $('saveState'),
  refreshButton: $('refreshButton'),
  entriesList: $('entriesList'),
  viewTabs: document.querySelectorAll('[data-view-tab]'),
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
  state.emailLoginOffered = false;
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
  state.emailLoginOffered = false;
  await refresh();
}

async function verifyEmailLogin(token) {
  const result = await api('auth-email-login-verify', { method: 'POST', body: { token } });
  window.history.replaceState({}, document.title, window.location.pathname);
  state.status = { ...(state.status || {}), auth: { ...(state.status?.auth || {}), user: result.user, csrf: result.csrf } };
  state.emailLoginOffered = false;
  await refresh();
}

async function refresh() {
  state.status = await api('status');
  renderShell();
  renderMeasurementControls();
  if (state.status.auth?.user) {
    await loadDogs();
    await loadTaxonomy();
    renderMeasurementControls();
    await loadEntries();
    await loadTaxonomy();
    renderMeasurementControls();
    renderEntries();
    renderView();
  }
}

function renderShell() {
  const user = state.status?.auth?.user;
  const params = new URLSearchParams(window.location.search);
  const setup = params.get('setup');

  els.connectionStatus.textContent = user ? user.display_name || user.username : 'Nicht eingeloggt';
  els.connectionStatus.hidden = !user;
  els.topTabs.hidden = !user;
  if (els.configNotice) els.configNotice.hidden = !user;
  els.authScreen.hidden = Boolean(user);
  els.workspace.hidden = !user;
  els.accountLink.hidden = !user;
  els.loginButton.hidden = Boolean(user);
  els.setupForm.hidden = !setup || Boolean(user);
  els.loginPanel.hidden = Boolean(setup) && !user;
  els.setupInput.value = setup || '';
  const canUseEmailLogin = Boolean(state.status?.mail?.login_enabled);
  const shouldOfferEmailLogin = state.emailLoginOffered || !passkeysAvailable();
  els.loginEmailForm.hidden = !canUseEmailLogin || !shouldOfferEmailLogin || Boolean(user);
  els.passkeyLoginButton.disabled = !passkeysAvailable();
  els.setupForm.querySelector('button[type="submit"]').disabled = !passkeysAvailable();

  if (state.status.auth?.bootstrap_pending && !setup && !user) {
    setMessage('Initiales Setup offen. Lies web/bootstrap_setup.txt auf Server.', false);
  } else if (!user && !passkeysAvailable()) {
    state.emailLoginOffered = canUseEmailLogin;
    setMessage('Passkeys hier nicht verfügbar. Nutze HTTPS und normalen Browser, keinen In-App-Browser.', true);
    els.loginEmailForm.hidden = !canUseEmailLogin || Boolean(user);
  }

  renderView();
}

function offerEmailLogin(message) {
  if (!state.status?.mail?.login_enabled) {
    state.emailLoginOffered = false;
    renderShell();
    setMessage(message, true);
    return;
  }
  state.emailLoginOffered = true;
  renderShell();
  els.loginEmailState.hidden = true;
  els.loginEmailState.textContent = '';
  els.loginEmailInput.focus();
  setMessage(message, true);
}

function switchView(view, updateHash = true) {
  state.view = view === 'records' ? 'records' : 'measure';
  renderView();
  if (updateHash) {
    window.history.replaceState({}, document.title, state.view === 'records' ? '#records' : '#measure');
  }
}

function renderView() {
  const records = state.view === 'records';
  els.measurementView.hidden = records;
  els.recordsView.hidden = !records;
  els.viewTabs.forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.viewTab === state.view);
  });
}

function renderMeasurementControls() {
  document.querySelectorAll('[data-measure-type]').forEach((button) => {
    const type = button.dataset.measureType;
    const recorded = state.results[type] !== null;
    button.classList.toggle('is-active', type === state.measureType);
    button.classList.toggle('has-result', recorded);
    button.setAttribute('aria-pressed', String(type === state.measureType));
    button.dataset.recorded = recorded ? 'true' : 'false';
  });

  if (!modes[state.measureType].some(([value]) => value === state.mode)) {
    state.mode = modes[state.measureType][0][0];
  }

  els.modeButtons.innerHTML = modes[state.measureType].map(([value, label]) => (
    `<button type="button" data-mode="${value}" class="${value === state.mode ? 'is-active' : ''}">${label}</button>`
  )).join('');

  els.modeButtons.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      state.mode = button.dataset.mode;
      renderMeasurementControls();
    });
  });

  document.querySelectorAll('[data-duration]').forEach((button) => {
    button.classList.toggle('is-active', Number(button.dataset.duration) === state.duration);
  });
  renderLocationOptions();
  renderContextOptions();

  updateMeterView();
}

function renderContextOptions() {
  const options = state.contextPresets;
  const selected = selectedContexts();
  els.contextInput.value = selected.filter((context) => state.contextPresets.some((item) => item._id === context)).join(', ');
  els.contextButtons.innerHTML = options.map((context) => pillButton({
    value: context._id,
    label: context.name,
    active: selected.includes(context._id),
    deleteMode: state.contextDeleteMode,
    deleteCandidate: state.contextDeleteCandidate,
    attr: 'data-context',
  })).join('');
  els.contextButtons.querySelectorAll('[data-context]').forEach((button) => {
    button.addEventListener('click', () => handleContextClick(button.dataset.context).catch((error) => setMessage(error.message, true)));
  });
  els.deleteContextButton.classList.toggle('is-active', state.contextDeleteMode);
  els.deleteContextButton.textContent = state.contextDeleteMode ? 'OK' : '-';
}

function selectedContexts() {
  return els.contextInput.value
    .split(',')
    .map((context) => context.trim())
    .filter((context) => context !== '');
}

function setSelectedContexts(contexts) {
  els.contextInput.value = contexts.filter((context, index, list) => (
    context !== '' && list.indexOf(context) === index
  )).join(', ');
}

function renderLocationOptions() {
  if (!state.locationPresets.some((location) => location._id === state.location)) state.location = state.locationPresets[0]?._id || '';
  els.locationButtons.innerHTML = state.locationPresets.map((location) => pillButton({
    value: location._id,
    label: location.name,
    active: location._id === state.location,
    deleteMode: state.locationDeleteMode,
    deleteCandidate: state.locationDeleteCandidate,
    attr: 'data-location',
  })).join('');
  els.locationButtons.querySelectorAll('[data-location]').forEach((button) => {
    button.addEventListener('click', () => handleLocationClick(button.dataset.location).catch((error) => setMessage(error.message, true)));
  });
  els.deleteLocationButton.classList.toggle('is-active', state.locationDeleteMode);
  els.deleteLocationButton.textContent = state.locationDeleteMode ? 'OK' : '-';
}

function pillButton({ value, label, active, deleteMode, deleteCandidate, attr }) {
  const classes = ['pill-button'];
  if (active) classes.push('is-active');
  if (deleteMode) classes.push('is-delete-mode');
  if (deleteMode && deleteCandidate === value) classes.push('is-delete-candidate');
  return `<button type="button" class="${classes.join(' ')}" ${attr}="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
}

function resetMeasurement() {
  resetMeasurementRun();
  state.results = { breath: null, pulse: null };
  state.resultTaps = { breath: 0, pulse: 0 };
  state.resultDurations = { breath: null, pulse: null };
  state.result = null;
  state.taps = 0;
  els.measuredAtInput.value = '';
  els.saveButton.disabled = true;
}

function resetMeasurementRun() {
  clearInterval(state.timer);
  clearTimeout(state.finishTimer);
  state.measuring = false;
  state.startedAt = 0;
  state.timer = null;
  state.finishTimer = null;
  state.result = state.results[state.measureType];
  state.taps = state.result !== null ? state.resultTaps[state.measureType] : 0;
  const savedDuration = state.resultDurations[state.measureType];
  if (state.result !== null && savedDuration !== null) state.duration = savedDuration;
  els.tapButton.disabled = state.result !== null;
  els.newMeasurementButton.hidden = true;
  els.saveButton.disabled = !hasSavedMeasurement();
  els.saveState.hidden = true;
}

function syncMeasurementSelection() {
  if (state.measuring) return;
  state.result = state.results[state.measureType];
  state.taps = state.result !== null ? state.resultTaps[state.measureType] : state.taps;
  const savedDuration = state.resultDurations[state.measureType];
  if (state.result !== null && savedDuration !== null) state.duration = savedDuration;
  els.tapButton.disabled = state.result !== null;
  els.newMeasurementButton.hidden = state.result === null;
  els.saveButton.disabled = !hasSavedMeasurement();
}

function startMeasurement() {
  state.results[state.measureType] = null;
  state.resultTaps[state.measureType] = 0;
  state.resultDurations[state.measureType] = null;
  resetMeasurementRun();
  state.measuring = true;
  state.startedAt = Date.now();
  state.taps = 1;
  els.saveButton.disabled = true;
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
  state.results[state.measureType] = state.result;
  state.resultTaps[state.measureType] = state.taps;
  state.resultDurations[state.measureType] = state.duration;
  if (!els.measuredAtInput.value) els.measuredAtInput.value = new Date().toISOString();
  els.tapButton.disabled = true;
  els.newMeasurementButton.hidden = false;
  els.saveButton.disabled = false;
  renderMeasurementControls();
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
  const savedResult = state.results[state.measureType];
  if (!state.measuring) {
    state.result = savedResult;
    state.taps = savedResult !== null ? state.resultTaps[state.measureType] : state.taps;
  }
  const countLabel = state.measureType === 'breath'
    ? (state.taps === 1 ? 'Atemzug' : 'Atemzüge')
    : (state.taps === 1 ? 'Pulsschlag' : 'Pulsschläge');
  const unit = state.measureType === 'breath' ? 'Atemzüge/min' : 'Schläge/min';
  const elapsed = state.startedAt ? Math.min((Date.now() - state.startedAt) / 1000, state.duration) : 0;
  const remaining = Math.max(0, Math.ceil(state.duration - elapsed));
  const liveRate = state.measuring && elapsed > 0 ? Math.round((state.taps / elapsed) * 60) : null;

  els.meterStatus.textContent = state.measuring ? `${remaining} Sekunden` : (state.result === null ? 'Bereit' : 'Fertig');
  els.meterCount.textContent = `${state.taps} ${countLabel} gezählt`;
  els.tapButtonMain.textContent = state.measuring ? `${label} tippen` : (state.result === null ? 'Messung starten' : 'Messung beendet');
  els.tapButtonSub.textContent = state.measuring ? 'Tap registriert sofort' : (state.result === null ? 'Erster Tap startet Timer' : 'Ergebnis speichern oder neue Messung starten');
  els.measurementResult.value = state.result !== null ? `${state.result} ${unit}` : (liveRate !== null ? `Aktuell ${liveRate} ${unit}` : '-- / min');
}

function hasSavedMeasurement() {
  return state.results.breath !== null || state.results.pulse !== null;
}

function savedMeasurementType() {
  if (state.results.breath !== null && state.results.pulse !== null) return 'both';
  if (state.results.pulse !== null) return 'pulse';
  return 'breath';
}

function savedDuration() {
  return state.resultDurations.breath || state.resultDurations.pulse || state.duration;
}

function durationForEntry(entry, type) {
  const typed = type === 'pulse' ? entry.pulse_duration_seconds : entry.breath_duration_seconds;
  return Number(typed || entry.duration_seconds || 15);
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

async function loadTaxonomy() {
  const [locationsResult, contextsResult] = await Promise.all([
    api('objects', { query: { type: 'locations' } }),
    api('objects', { query: { type: 'contexts' } }),
  ]);
  state.locationPresets = locationsResult.objects || [];
  state.contextPresets = contextsResult.objects || [];
  if (state.locationPresets.length === 0) {
    const defaults = await Promise.all(['Zuhause', 'Schule', 'Unterwegs'].map((name) => (
      api('object-create', { method: 'POST', body: { type: 'locations', object: { name } } })
    )));
    state.locationPresets = defaults.map((result) => result.object);
  }
  if (!state.locationPresets.some((location) => location._id === state.location)) {
    state.location = state.locationPresets[0]?._id || '';
  }
  setSelectedContexts(selectedContexts().filter((id) => state.contextPresets.some((context) => context._id === id)));
}

function renderDogSelect() {
  const selected = els.dogSelect.value || state.dogs[0]?._id || '';
  const selectedDog = state.dogs.find((dog) => dog._id === selected) || state.dogs[0];
  const hasMultipleDogs = state.dogs.length > 1;
  const selectedId = selectedDog?._id || '';

  els.dogSelectLabel.hidden = !hasMultipleDogs;
  els.dogNameDisplay.hidden = hasMultipleDogs;
  els.dogNameDisplay.querySelector('strong').textContent = selectedDog?.name || 'Mein Hund';
  els.dogSelect.value = selectedId;

  els.dogButtons.innerHTML = state.dogs.map((dog) => (
    pillButton({
      value: dog._id,
      label: dog.name || 'Mein Hund',
      active: dog._id === selectedId,
      deleteMode: false,
      deleteCandidate: '',
      attr: 'data-dog',
    })
  )).join('');
  els.dogButtons.querySelectorAll('[data-dog]').forEach((button) => {
    button.addEventListener('click', () => {
      els.dogSelect.value = button.dataset.dog;
      renderDogSelect();
    });
  });
}

function renderEntries() {
  if (state.entries.length === 0) {
    els.entriesList.innerHTML = '<p class="muted">Noch keine Messungen.</p>';
    return;
  }

  els.entriesList.innerHTML = state.entries.map((entry) => {
    const type = entry.measurement_type || (entry.pulse_per_minute !== null && entry.pulse_per_minute !== undefined ? 'pulse' : 'breath');
    const context = contextSummary(entry);
    const notes = entry.notes || entry.comment ? `<p class="muted">${escapeHtml(entry.notes || entry.comment)}</p>` : '';
    const editing = state.editingEntryId === entry._id;
    return `
      <article class="entry ${editing ? 'is-editing' : ''}">
        <button class="entry-toggle" type="button" data-edit-entry="${escapeHtml(entry._id)}">
          <div>
            <strong>${escapeHtml(dogLabel(entry.dog_id))}</strong>
            <span class="muted">${formatDate(entry.measured_at || entry._created)}</span>
          </div>
          <div class="numbers">
            ${measurementChips(entry)}
            <span class="chip">${modeLabel(type, entry.mode)}</span>
            <span class="chip">${locationLabel(entry.location_id)}</span>
          </div>
        </button>
        ${context ? `<p class="muted">${escapeHtml(context)}</p>` : ''}
        ${notes}
        ${editing ? renderEntryEditor(entry, type) : ''}
      </article>
    `;
  }).join('');

  els.entriesList.querySelectorAll('[data-edit-entry]').forEach((button) => {
    button.addEventListener('click', () => toggleEntryEditor(button.dataset.editEntry));
  });
  els.entriesList.querySelectorAll('[data-delete-entry]').forEach((button) => {
    button.addEventListener('click', () => deleteEntry(button.dataset.deleteEntry, Number(button.dataset.revision)));
  });
  els.entriesList.querySelectorAll('[data-autosave-entry]').forEach((input) => {
    const eventName = input.tagName === 'TEXTAREA' || input.type === 'number' || input.type === 'datetime-local' ? 'input' : 'change';
    input.addEventListener(eventName, () => queueEntrySave(input.dataset.autosaveEntry));
  });
}

function measurementChips(entry) {
  const chips = [];
  if (entry.breaths_per_minute !== null && entry.breaths_per_minute !== undefined && entry.breaths_per_minute !== '') {
    chips.push(`<span class="chip">Atemfrequenz ${escapeHtml(entry.breaths_per_minute)}</span>`);
  }
  if (entry.pulse_per_minute !== null && entry.pulse_per_minute !== undefined && entry.pulse_per_minute !== '') {
    chips.push(`<span class="chip">Puls ${escapeHtml(entry.pulse_per_minute)}</span>`);
  }
  return chips.join('') || '<span class="chip">Messung</span>';
}

function renderEntryEditor(entry, type) {
  const dogOptions = state.dogs.map((dog) => (
    `<option value="${escapeHtml(dog._id)}" ${dog._id === entry.dog_id ? 'selected' : ''}>${escapeHtml(dog.name || 'Mein Hund')}</option>`
  )).join('');
  const modeOptions = sharedModes.map(([value, label]) => (
    `<option value="${value}" ${value === entry.mode ? 'selected' : ''}>${label}</option>`
  )).join('');
  const entryContexts = Array.isArray(entry.context_ids) ? entry.context_ids : [];
  const contextOptions = state.contextPresets.map((context) => (
    `<option value="${escapeHtml(context._id)}" ${entryContexts.includes(context._id) ? 'selected' : ''}>${escapeHtml(context.name)}</option>`
  )).join('');
  const breathDuration = durationForEntry(entry, 'breath');
  const pulseDuration = durationForEntry(entry, 'pulse');
  const locationOptions = state.locationPresets.map((location) => (
    `<option value="${escapeHtml(location._id)}" ${location._id === (entry.location_id || state.location) ? 'selected' : ''}>${escapeHtml(location.name)}</option>`
  )).join('');

  return `
    <div class="entry-editor" data-entry-editor="${escapeHtml(entry._id)}">
      <label>
        Zeitpunkt
        <input type="datetime-local" data-autosave-entry="${escapeHtml(entry._id)}" data-field="measured_at" value="${escapeHtml(dateTimeLocalValue(entry.measured_at || entry._created))}">
      </label>
      <label>
        Hund
        <select data-autosave-entry="${escapeHtml(entry._id)}" data-field="dog_id">${dogOptions}</select>
      </label>
      <label>
        Messart
        <select data-autosave-entry="${escapeHtml(entry._id)}" data-field="measurement_type">
          <option value="breath" ${type === 'breath' ? 'selected' : ''}>Atemfrequenz</option>
          <option value="pulse" ${type === 'pulse' ? 'selected' : ''}>Puls</option>
          <option value="both" ${type === 'both' ? 'selected' : ''}>Beides</option>
        </select>
      </label>
      <label>
        Atemfrequenz
        <input type="number" min="0" max="400" step="1" data-autosave-entry="${escapeHtml(entry._id)}" data-field="breaths_per_minute" value="${escapeHtml(entry.breaths_per_minute ?? '')}">
      </label>
      <label>
        Puls
        <input type="number" min="0" max="400" step="1" data-autosave-entry="${escapeHtml(entry._id)}" data-field="pulse_per_minute" value="${escapeHtml(entry.pulse_per_minute ?? '')}">
      </label>
      <label>
        Modus
        <select data-autosave-entry="${escapeHtml(entry._id)}" data-field="mode">${modeOptions}</select>
      </label>
      <label>
        Dauer Atemfrequenz
        <select data-autosave-entry="${escapeHtml(entry._id)}" data-field="breath_duration_seconds">
          <option value="15" ${breathDuration === 15 ? 'selected' : ''}>15 Sekunden</option>
          <option value="30" ${breathDuration === 30 ? 'selected' : ''}>30 Sekunden</option>
        </select>
      </label>
      <label>
        Dauer Puls
        <select data-autosave-entry="${escapeHtml(entry._id)}" data-field="pulse_duration_seconds">
          <option value="15" ${pulseDuration === 15 ? 'selected' : ''}>15 Sekunden</option>
          <option value="30" ${pulseDuration === 30 ? 'selected' : ''}>30 Sekunden</option>
        </select>
      </label>
      <label>
        Ort
        <select data-autosave-entry="${escapeHtml(entry._id)}" data-field="location_id">
          ${locationOptions}
        </select>
      </label>
      <label>
        Kontext
        <select data-autosave-entry="${escapeHtml(entry._id)}" data-field="context_ids" multiple>${contextOptions}</select>
      </label>
      <label class="entry-editor-wide">
        Notizen
        <textarea rows="3" data-autosave-entry="${escapeHtml(entry._id)}" data-field="notes">${escapeHtml(entry.notes || entry.comment || '')}</textarea>
      </label>
      <button class="delete-entry" type="button" data-delete-entry="${escapeHtml(entry._id)}" data-revision="${entry._revision}">Löschen</button>
    </div>
  `;
}

function toggleEntryEditor(id) {
  if (state.editingEntryId !== null) {
    clearTimeout(state.saveTimers.get(state.editingEntryId));
    saveEntryEdit(state.editingEntryId).catch((error) => setMessage(error.message, true));
  }
  state.editingEntryId = state.editingEntryId === id ? null : id;
  renderEntries();
}

function queueEntrySave(id) {
  clearTimeout(state.saveTimers.get(id));
  state.saveTimers.set(id, setTimeout(() => saveEntryEdit(id).catch((error) => setMessage(error.message, true)), 350));
}

async function saveEntryEdit(id) {
  const entry = state.entries.find((item) => item._id === id);
  const editor = els.entriesList.querySelector(`[data-entry-editor="${cssEscape(id)}"]`);
  if (!entry || !editor) return;

  const values = Object.fromEntries(Array.from(editor.querySelectorAll('[data-field]')).map((input) => [
    input.dataset.field,
    input.multiple ? Array.from(input.selectedOptions).map((option) => option.value) : input.value,
  ]));
  const dog = state.dogs.find((item) => item._id === values.dog_id);
  const measurementType = ['breath', 'pulse', 'both'].includes(values.measurement_type) ? values.measurement_type : 'breath';
  const object = {
    measured_at: values.measured_at,
    dog_id: values.dog_id || '',
    measurement_type: measurementType,
    mode: values.mode,
    duration_seconds: Number(values.breath_duration_seconds || values.pulse_duration_seconds || entry.duration_seconds || 15),
    breath_duration_seconds: measurementType === 'pulse' ? null : values.breath_duration_seconds,
    pulse_duration_seconds: measurementType === 'breath' ? null : values.pulse_duration_seconds,
    location_id: values.location_id,
    context_ids: values.context_ids,
    notes: values.notes,
    breaths_per_minute: measurementType === 'pulse' ? null : values.breaths_per_minute,
    pulse_per_minute: measurementType === 'breath' ? null : values.pulse_per_minute,
  };

  const result = await api('object-update', {
    method: 'POST',
    body: { type: 'vitals', id, base_revision: entry._revision, object },
  });
  state.entries = state.entries.map((item) => (item._id === id ? result.object : item));
  const deleteButton = editor.querySelector('[data-delete-entry]');
  if (deleteButton) deleteButton.dataset.revision = result.object._revision;
}

async function saveEntry(event) {
  event.preventDefault();
  if (!hasSavedMeasurement()) return;

  const dog = state.dogs.find((item) => item._id === els.dogSelect.value) || state.dogs[0];
  els.saveState.hidden = false;
  els.saveState.textContent = 'Speichere...';

  const object = {
    measured_at: els.measuredAtInput.value || new Date().toISOString(),
    dog_id: dog?._id || '',
    measurement_type: savedMeasurementType(),
    mode: state.mode,
    duration_seconds: savedDuration(),
    breath_duration_seconds: state.results.breath !== null ? state.resultDurations.breath : null,
    pulse_duration_seconds: state.results.pulse !== null ? state.resultDurations.pulse : null,
    location_id: state.location,
    context_ids: selectedContexts(),
    notes: els.notesInput.value,
    breaths_per_minute: state.results.breath,
    pulse_per_minute: state.results.pulse,
  };

  await api('object-create', { method: 'POST', body: { type: 'vitals', object } });
  els.saveState.textContent = 'Gespeichert.';
  els.notesInput.value = '';
  resetMeasurement();
  renderMeasurementControls();
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

function dateTimeLocalValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function modeLabel(type, value) {
  return Object.fromEntries(modes[type] || sharedModes)[value] || value || 'Ruhend';
}

function locationLabel(value) {
  return state.locationPresets.find((location) => location._id === value)?.name || 'Ort';
}

function dogLabel(value) {
  return state.dogs.find((dog) => dog._id === value)?.name || 'Mein Hund';
}

function contextSummary(entry) {
  const ids = Array.isArray(entry.context_ids) ? entry.context_ids : [];
  return ids.map((id) => state.contextPresets.find((context) => context._id === id)?.name || '').filter(Boolean).join(', ');
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

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(value);
  return String(value).replace(/["\\]/g, '\\$&');
}

els.passkeyLoginButton.addEventListener('click', () => passkeyLogin().catch((error) => {
  offerEmailLogin(error.message || 'Passkey fehlgeschlagen. Du kannst einen Login-Link anfordern.');
}));
els.setupForm.addEventListener('submit', (event) => passkeySetup(event).catch((error) => setMessage(error.message, true)));
els.loginButton.addEventListener('click', () => {
  els.authScreen.hidden = false;
});
els.viewTabs.forEach((tab) => {
  tab.addEventListener('click', () => switchView(tab.dataset.viewTab));
});
els.loginEmailForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.status?.mail?.login_enabled) return;
  els.loginEmailState.hidden = false;
  els.loginEmailState.textContent = 'Sende...';
  const submitButton = els.loginEmailForm.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  try {
    const result = await api('auth-email-login-request', { method: 'POST', body: { email: els.loginEmailInput.value } });
    els.loginEmailState.textContent = result.message || 'Wenn die Adresse bekannt ist, wurde ein Login-Link gesendet.';
  } catch (error) {
    els.loginEmailState.textContent = error.message || 'Anfrage nicht abgeschlossen. Bitte später erneut versuchen.';
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

document.querySelectorAll('[data-measure-type]').forEach((button) => {
  button.addEventListener('click', () => {
    state.measureType = button.dataset.measureType;
    syncMeasurementSelection();
    renderMeasurementControls();
  });
});
document.querySelectorAll('[data-duration]').forEach((button) => {
  button.addEventListener('click', () => {
    if (state.measuring || state.results[state.measureType] !== null) {
      renderMeasurementControls();
      return;
    }
    state.duration = Number(button.dataset.duration);
    renderMeasurementControls();
  });
});
els.addContextButton.addEventListener('click', () => addContext().catch((error) => setMessage(error.message, true)));
els.deleteContextButton.addEventListener('click', () => {
  state.contextDeleteMode = !state.contextDeleteMode;
  state.contextDeleteCandidate = '';
  renderContextOptions();
});
els.addLocationButton.addEventListener('click', () => addLocation().catch((error) => setMessage(error.message, true)));
els.deleteLocationButton.addEventListener('click', () => {
  state.locationDeleteMode = !state.locationDeleteMode;
  state.locationDeleteCandidate = '';
  renderLocationOptions();
});

async function addContext() {
  const value = window.prompt('Neuer Kontext');
  if (value === null) return;
  const name = value.trim();
  if (name === '') return;

  const result = await api('object-create', { method: 'POST', body: { type: 'contexts', object: { name } } });
  state.contextPresets = state.contextPresets.filter((item) => item._id !== result.object._id).concat(result.object);
  setSelectedContexts(selectedContexts().concat(result.object._id));
  renderContextOptions();
}

async function addLocation() {
  const value = window.prompt('Neuer Ort');
  if (value === null) return;
  const name = value.trim();
  if (name === '') return;

  const result = await api('object-create', { method: 'POST', body: { type: 'locations', object: { name } } });
  state.locationPresets = state.locationPresets.filter((item) => item._id !== result.object._id).concat(result.object);
  state.location = result.object._id;
  renderLocationOptions();
}

async function handleContextClick(context) {
  if (!state.contextDeleteMode) {
    const selected = selectedContexts();
    setSelectedContexts(selected.includes(context)
      ? selected.filter((item) => item !== context)
      : selected.concat(context));
    renderContextOptions();
    return;
  }
  if (state.contextDeleteCandidate !== context) {
    state.contextDeleteCandidate = context;
    renderContextOptions();
    return;
  }
  const item = state.contextPresets.find((preset) => preset._id === context);
  if (!item) return;
  await api('object-delete', { method: 'POST', body: { type: 'contexts', id: item._id, base_revision: item._revision } });
  state.contextPresets = state.contextPresets.filter((preset) => preset._id !== context);
  setSelectedContexts(selectedContexts().filter((item) => item !== context));
  state.contextDeleteCandidate = '';
  renderContextOptions();
}

async function handleLocationClick(location) {
  if (!state.locationDeleteMode) {
    state.location = location;
    renderLocationOptions();
    return;
  }
  if (state.locationPresets.length <= 1) return;
  if (state.locationDeleteCandidate !== location) {
    state.locationDeleteCandidate = location;
    renderLocationOptions();
    return;
  }
  const item = state.locationPresets.find((preset) => preset._id === location);
  if (!item) return;
  await api('object-delete', { method: 'POST', body: { type: 'locations', id: item._id, base_revision: item._revision } });
  state.locationPresets = state.locationPresets.filter((preset) => preset._id !== location);
  if (state.location === location) state.location = state.locationPresets[0]?._id || '';
  state.locationDeleteCandidate = '';
  renderLocationOptions();
}
els.tapButton.addEventListener('click', registerTap);
els.newMeasurementButton.addEventListener('click', () => {
  resetMeasurement();
  renderMeasurementControls();
});
els.entryForm.addEventListener('submit', (event) => saveEntry(event).catch((error) => {
  els.saveState.hidden = false;
  els.saveState.textContent = error.message;
}));
els.refreshButton.addEventListener('click', () => loadEntries().catch((error) => setMessage(error.message, true)));
renderMeasurementControls();
switchView(state.view, false);

const params = new URLSearchParams(window.location.search);
const loginToken = params.get('login');
if (loginToken) {
  verifyEmailLogin(loginToken).catch((error) => setMessage(error.message, true));
} else {
  refresh().catch((error) => setMessage(error.message, true));
}
