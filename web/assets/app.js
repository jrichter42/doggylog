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

const initialHash = window.location.hash.slice(1);
const initialHashParams = new URLSearchParams(initialHash);
const initialSetupToken = initialHashParams.get('setup') || '';
const initialLoginToken = initialHashParams.get('login') || '';
const hashView = ['records', 'account'].includes(initialHash) ? initialHash : 'measure';

if (initialSetupToken || initialLoginToken) {
  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
}

const state = {
  status: null,
  accessControlAttempted: false,
  accessControlFailed: false,
  setupToken: initialSetupToken,
  account: null,
  entries: [],
  dogs: [],
  measureType: 'breath',
  mode: 'resting',
  duration: 15,
  view: ['records', 'account'].includes(hashView) ? hashView : 'measure',
  location: '',
  contextPresets: [],
  locationPresets: [],
  emailLoginOffered: false,
  measuring: false,
  startedAt: 0,
  timer: null,
  finishTimer: null,
  taps: 0,
  result: null,
  results: { breath: null, pulse: null },
  resultTaps: { breath: 0, pulse: 0 },
  recordDogFilter: '',
  recordTypeFilter: '',
  recordSortColumn: 'time',
  recordSortDirection: 'desc',
  editingEntryId: null,
  saveTimers: new Map(),
  accountProfileSaveTimer: null,
  dogSaveTimers: new Map(),
  taxonomySaveTimers: new Map(),
  userSaveTimers: new Map(),
  userSetupLinks: new Map(),
  userSetupTokens: [],
  showHiddenDogs: false,
  showHiddenLocations: false,
  showHiddenContexts: false,
  showDisabledUsers: false,
  accountListOrder: {
    dogs: [],
    locations: [],
    contexts: [],
  },
  messageTimer: null,
  measurementSaveFeedbackTimer: null,
};

const $ = (id) => document.getElementById(id);
const { hydrateStaticIcons, icon, labelWithIcon, setIconOnlyButton, setLabelWithIcon } = window.DoggyLogIcons;

const els = {
  connectionStatus: $('connectionStatus'),
  topTabs: $('topTabs'),
  configNotice: $('configNotice'),
  accessControlWarning: $('accessControlWarning'),
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
  page: document.querySelector('main'),
  measurementView: $('measurementView'),
  accountView: $('accountView'),
  measurementProgress: $('measurementProgress'),
  measurementProgressFill: $('measurementProgressFill'),
  recordsView: $('recordsView'),
  dogSelectLabel: $('dogSelectLabel'),
  dogSelect: $('dogSelect'),
  dogButtons: $('dogButtons'),
  dogNameDisplay: $('dogNameDisplay'),
  modeButtons: $('modeButtons'),
  meterStage: $('meterStage'),
  tapButton: $('tapButton'),
  tapButtonIcon: $('tapButtonIcon'),
  tapButtonMain: $('tapButtonMain'),
  tapButtonSub: $('tapButtonSub'),
  newMeasurementButton: $('newMeasurementButton'),
  meterStatus: $('meterStatus'),
  meterCount: $('meterCount'),
  measurementResult: $('measurementResult'),
  measuredAtInput: $('measuredAtInput'),
  locationButtons: $('locationButtons'),
  addLocationButton: $('addLocationButton'),
  contextInput: $('contextInput'),
  contextButtons: $('contextButtons'),
  addContextButton: $('addContextButton'),
  notesInput: $('notesInput'),
  entryForm: $('entryForm'),
  saveButton: $('saveButton'),
  saveState: $('saveState'),
  measurementSavedFeedback: $('measurementSavedFeedback'),
  recordDogFilter: $('recordDogFilter'),
  recordSingleDogName: $('recordSingleDogName'),
  recordTypeFilter: $('recordTypeFilter'),
  recordExportButton: $('recordExportButton'),
  entriesList: $('entriesList'),
  recordEditorPage: $('recordEditorPage'),
  selfSetupButton: $('selfSetupButton'),
  accountPasskeys: $('accountPasskeys'),
  selfSetupResult: $('selfSetupResult'),
  logoutButton: $('logoutButton'),
  accountProfileForm: $('accountProfileForm'),
  dogSectionTitle: $('dogSectionTitle'),
  dogCreateButton: $('dogCreateButton'),
  showHiddenDogs: $('showHiddenDogs'),
  defaultDogSummary: $('defaultDogSummary'),
  hiddenDogCount: $('hiddenDogCount'),
  dogList: $('dogList'),
  locationCreateButton: $('locationCreateButton'),
  locationSectionTitle: $('locationSectionTitle'),
  showHiddenLocations: $('showHiddenLocations'),
  hiddenLocationCount: $('hiddenLocationCount'),
  locationList: $('locationList'),
  contextCreateButton: $('contextCreateButton'),
  contextSectionTitle: $('contextSectionTitle'),
  showHiddenContexts: $('showHiddenContexts'),
  hiddenContextCount: $('hiddenContextCount'),
  contextList: $('contextList'),
  userAdminPanel: $('userAdminPanel'),
  userSectionTitle: $('userSectionTitle'),
  userCreateButton: $('userCreateButton'),
  showDisabledUsers: $('showDisabledUsers'),
  disabledUserCount: $('disabledUserCount'),
  userList: $('userList'),
  viewTabs: document.querySelectorAll('[data-view-tab]'),
};

function setMessage(text, isError = false) {
  clearTimeout(state.messageTimer);
  els.authMessage.hidden = !text;
  els.authMessage.textContent = text || '';
  els.authMessage.style.borderColor = isError ? '#f04438' : '';
  els.authMessage.classList.toggle('is-error', isError);
  if (text) {
    state.messageTimer = setTimeout(() => {
      els.authMessage.hidden = true;
      els.authMessage.textContent = '';
    }, isError ? 5200 : 1600);
  }
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
  state.setupToken = '';
  window.history.replaceState({}, document.title, window.location.pathname);
  state.status = { ...(state.status || {}), auth: { ...(state.status?.auth || {}), user: result.user, csrf: result.csrf } };
  state.emailLoginOffered = false;
  await refresh();
}

async function addAccountPasskey() {
  setMessage('');
  requirePasskeys();
  els.selfSetupButton.disabled = true;
  els.selfSetupResult.hidden = false;
  els.selfSetupResult.textContent = 'Passkey wird erstellt...';
  try {
    const options = await api('account-passkey-options', { method: 'POST', body: {} });
    const credential = await navigator.credentials.create({ publicKey: decodePublicKeyOptions(options.publicKey) });
    const result = await api('account-passkey-verify', {
      method: 'POST',
      body: { challenge_id: options.challenge_id, credential: serializeCredential(credential) },
    });
    state.account = result.account || state.account;
    els.selfSetupResult.textContent = 'Passkey hinzugefügt.';
    renderAccountView();
  } finally {
    els.selfSetupButton.disabled = false;
  }
}

async function verifyEmailLogin(token) {
  const result = await api('auth-email-login-verify', { method: 'POST', body: { token } });
  window.history.replaceState({}, document.title, window.location.pathname);
  state.status = { ...(state.status || {}), auth: { ...(state.status?.auth || {}), user: result.user, csrf: result.csrf } };
  state.emailLoginOffered = false;
  await refresh();
}

async function handleAuthFragment() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const setupToken = params.get('setup') || '';
  const loginToken = params.get('login') || '';
  if (!setupToken && !loginToken) return;

  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
  if (setupToken) {
    state.setupToken = setupToken;
    if (state.status === null) {
      await refresh();
    } else {
      renderShell();
    }
    return;
  }

  state.setupToken = '';
  await verifyEmailLogin(loginToken);
}

async function refresh() {
  state.status = await api('status');
  renderShell();
  await verifyAccessControls();
  renderMeasurementControls();
  if (state.status.auth?.user) {
    await loadDogs();
    await loadTaxonomy();
    renderMeasurementControls();
    await loadEntries();
    await loadTaxonomy();
    renderMeasurementControls();
    renderEntries();
    await loadAccountView();
    renderView();
  }
}

async function verifyAccessControls() {
  const check = state.status?.auth?.access_control_check;
  state.accessControlFailed = check?.passed === false;
  renderSecurityWarnings();
  if (!state.status?.auth?.user || check?.due !== true || state.accessControlAttempted) return;
  state.accessControlAttempted = true;

  let passed = false;
  try {
    const response = await fetch('config/app.json', {
      method: 'HEAD',
      cache: 'no-store',
      credentials: 'same-origin',
    });
    passed = response.status === 403 || response.status === 404;
  } catch {}

  state.accessControlFailed = !passed;
  renderSecurityWarnings();
  const result = await api('access-control-check', {
    method: 'POST',
    body: { passed },
  });
  state.status.auth.access_control_check = result.access_control_check;
  state.accessControlFailed = result.access_control_check?.passed === false;
  renderSecurityWarnings();
}

function renderSecurityWarnings() {
  if (!els.configNotice || !els.accessControlWarning) return;
  const user = state.status?.auth?.user;
  els.accessControlWarning.hidden = !state.accessControlFailed;
  els.configNotice.classList.toggle('is-critical', state.accessControlFailed);
  els.configNotice.hidden = !user || (!state.accessControlFailed && els.configNotice.children.length === 1);
}

function renderShell() {
  const user = state.status?.auth?.user;
  const setup = state.setupToken;

  els.connectionStatus.textContent = user ? user.display_name || user.username : 'Nicht eingeloggt';
  els.connectionStatus.hidden = !user;
  els.topTabs.hidden = !user || Boolean(setup);
  renderSecurityWarnings();
  els.authScreen.hidden = Boolean(user) && !setup;
  els.workspace.hidden = !user || Boolean(setup);
  els.loginButton.hidden = Boolean(user);
  els.setupForm.hidden = !setup;
  els.loginPanel.hidden = Boolean(setup);
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
  state.view = ['records', 'account'].includes(view) ? view : 'measure';
  renderView();
  if (updateHash) {
    window.history.replaceState({}, document.title, `#${state.view}`);
  }
}

function renderView() {
  const records = state.view === 'records';
  const account = state.view === 'account';
  els.measurementView.hidden = records || account;
  els.recordsView.hidden = !records;
  els.accountView.hidden = !account;
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
    button.disabled = state.measuring;
  });
  if (!modes[state.measureType].some(([value]) => value === state.mode)) {
    state.mode = modes[state.measureType][0][0];
  }

  els.modeButtons.innerHTML = modes[state.measureType].map(([value, label]) => (
    `<button type="button" data-mode="${value}" class="has-ui-icon ${value === state.mode ? 'is-active' : ''}">${labelWithIcon(modeIcon(value), label)}</button>`
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
  const selected = selectedContexts();
  const options = sortedVisibleContexts();
  els.contextInput.value = selected.filter((context) => options.some((item) => item._id === context)).join(', ');
  els.contextButtons.innerHTML = options.map((context) => pillButton({
    value: context._id,
    label: context.name,
    active: selected.includes(context._id),
    deleteMode: false,
    deleteCandidate: '',
    attr: 'data-context',
  })).join('') + '<button class="icon-button compact" id="addContextButton" type="button" aria-label="Kontext hinzufuegen" title="Kontext hinzufuegen" data-icon-only="plus"></button>';
  els.contextButtons.querySelectorAll('[data-context]').forEach((button) => {
    button.addEventListener('click', () => handleContextClick(button.dataset.context).catch((error) => setMessage(error.message, true)));
  });
  const addContextButton = els.contextButtons.querySelector('#addContextButton');
  if (addContextButton) {
    setIconOnlyButton(addContextButton, 'plus');
    addContextButton.addEventListener('click', () => addContextFromPrompt().catch((error) => setMessage(error.message, true)));
  }
}

function showMeasurementSavedFeedback() {
  clearTimeout(state.measurementSaveFeedbackTimer);
  els.measurementSavedFeedback.hidden = false;
  els.measurementSavedFeedback.classList.remove('is-visible');
  void els.measurementSavedFeedback.offsetWidth;
  els.measurementSavedFeedback.classList.add('is-visible');
  state.measurementSaveFeedbackTimer = setTimeout(() => {
    els.measurementSavedFeedback.classList.remove('is-visible');
    els.measurementSavedFeedback.hidden = true;
  }, 1800);
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
  const options = sortedVisibleLocations();
  if (!options.some((location) => location._id === state.location)) state.location = options[0]?._id || '';
  els.locationButtons.innerHTML = options.map((location) => optionButton({
    value: location._id,
    label: location.name,
    active: location._id === state.location,
    attr: 'data-location',
  })).join('') + '<button class="icon-button compact" id="addLocationButton" type="button" aria-label="Ort hinzufuegen" title="Ort hinzufuegen" data-icon-only="plus"></button>';
  els.locationButtons.querySelectorAll('[data-location]').forEach((button) => {
    button.addEventListener('click', () => handleLocationClick(button.dataset.location).catch((error) => setMessage(error.message, true)));
  });
  const addLocationButton = els.locationButtons.querySelector('#addLocationButton');
  if (addLocationButton) {
    setIconOnlyButton(addLocationButton, 'plus');
    addLocationButton.addEventListener('click', () => addLocationFromPrompt().catch((error) => setMessage(error.message, true)));
  }
}

function pillButton({ value, label, active, deleteMode, deleteCandidate, attr }) {
  const classes = ['pill-button'];
  const iconName = pillIcon(attr);
  if (iconName) classes.push('has-ui-icon');
  if (active) classes.push('is-active');
  if (deleteMode) classes.push('is-delete-mode');
  if (deleteMode && deleteCandidate === value) classes.push('is-delete-candidate');
  return `<button type="button" class="${classes.join(' ')}" ${attr}="${escapeHtml(value)}">${iconName ? labelWithIcon(iconName, label) : escapeHtml(label)}</button>`;
}

function optionButton({ value, label, active, attr }) {
  const classes = ['choice-button'];
  const iconName = pillIcon(attr);
  if (iconName) classes.push('has-ui-icon');
  if (active) classes.push('is-active');
  const content = iconName ? labelWithIcon(iconName, label) : escapeHtml(label);
  return `<button type="button" class="${classes.join(' ')}" ${attr}="${escapeHtml(value)}">${content}</button>`;
}

function isTaxonomyVisible(item) {
  return item.visible !== false;
}

function visibleDogs() {
  return state.dogs.filter(isTaxonomyVisible);
}

function sortedVisibleDogs() {
  const defaultDogId = accountDefaultDogId();
  return sortByDefaultThenName(visibleDogs(), (dog) => dog._id === defaultDogId);
}

function visibleLocations() {
  return state.locationPresets.filter(isTaxonomyVisible);
}

function visibleContexts() {
  return state.contextPresets.filter(isTaxonomyVisible);
}

function sortedVisibleLocations() {
  const defaultLocationId = accountDefaultLocationId();
  return sortByDefaultThenName(visibleLocations(), (location) => location._id === defaultLocationId);
}

function sortedVisibleContexts() {
  const defaultIds = accountDefaultContextIds();
  return sortByDefaultThenName(visibleContexts(), (context) => defaultIds.includes(context._id));
}

function sortedLocationOptions(selected) {
  return sortByDefaultThenName(
    state.locationPresets.filter((item) => isTaxonomyVisible(item) || item._id === selected),
    (item) => item._id === accountDefaultLocationId(),
  );
}

function sortedContextOptions(selected) {
  const selectedValues = Array.isArray(selected) ? selected : [selected];
  const defaultIds = accountDefaultContextIds();
  return sortByDefaultThenName(
    state.contextPresets.filter((item) => isTaxonomyVisible(item) || selectedValues.includes(item._id)),
    (item) => defaultIds.includes(item._id),
  );
}

function sortByDefaultThenName(items, isDefault) {
  return items.slice().sort((left, right) => {
    const defaultDiff = Number(isDefault(right)) - Number(isDefault(left));
    if (defaultDiff !== 0) return defaultDiff;
    const byName = String(left.name || '').localeCompare(String(right.name || ''), 'de', { sensitivity: 'base' });
    return byName || String(left._id || '').localeCompare(String(right._id || ''));
  });
}

function accountListItems(type, includeHidden) {
  if (type === 'dogs') return includeHidden ? state.dogs : visibleDogs();
  if (type === 'locations') return includeHidden ? state.locationPresets : visibleLocations();
  return includeHidden ? state.contextPresets : visibleContexts();
}

function defaultMatcher(type) {
  if (type === 'dogs') {
    const defaultId = accountDefaultDogId();
    return (item) => item._id === defaultId;
  }
  if (type === 'locations') {
    const defaultId = accountDefaultLocationId();
    return (item) => item._id === defaultId;
  }
  const defaultIds = accountDefaultContextIds();
  return (item) => defaultIds.includes(item._id);
}

function resetAccountListOrder(type) {
  const includeHidden = type === 'dogs'
    ? state.showHiddenDogs
    : (type === 'locations' ? state.showHiddenLocations : state.showHiddenContexts);
  state.accountListOrder[type] = sortByDefaultThenName(accountListItems(type, includeHidden), defaultMatcher(type)).map((item) => item._id);
}

function resetAccountListOrders() {
  resetAccountListOrder('dogs');
  resetAccountListOrder('locations');
  resetAccountListOrder('contexts');
}

function orderedAccountList(type, includeHidden) {
  const items = accountListItems(type, includeHidden);
  const byId = new Map(items.map((item) => [item._id, item]));
  const order = state.accountListOrder[type].filter((id) => byId.has(id));
  const known = new Set(order);
  const appended = items.filter((item) => !known.has(item._id)).map((item) => item._id);
  state.accountListOrder[type] = order.concat(appended);
  return state.accountListOrder[type].map((id) => byId.get(id)).filter(Boolean);
}

function resetMeasurement() {
  setResetConfirmation(false);
  state.results[state.measureType] = null;
  state.resultTaps[state.measureType] = 0;
  state.result = null;
  state.taps = 0;
  state.measuring = false;
  state.startedAt = 0;
  clearInterval(state.timer);
  clearTimeout(state.finishTimer);
  state.timer = null;
  state.finishTimer = null;
  if (!hasSavedMeasurement()) els.measuredAtInput.value = '';
  els.tapButton.disabled = false;
  els.newMeasurementButton.hidden = true;
  els.saveButton.disabled = !hasSavedMeasurement();
  els.saveState.hidden = true;
}

function setResetConfirmation() {
  const label = state.measuring ? cancelMeasurementLabel() : discardMeasurementLabel();
  const iconName = state.measuring ? 'x' : 'rotate-ccw';
  setLabelWithIcon(els.newMeasurementButton, iconName, label);
}

function discardMeasurementLabel() {
  return state.measureType === 'breath' ? 'Atemzüge verwerfen' : 'Pulsschläge verwerfen';
}

function cancelMeasurementLabel() {
  return state.measureType === 'breath' ? 'Atemmessung abbrechen' : 'Pulsmessung abbrechen';
}

function resetMeasurementRun() {
  setResetConfirmation(false);
  clearInterval(state.timer);
  clearTimeout(state.finishTimer);
  state.measuring = false;
  state.startedAt = 0;
  state.timer = null;
  state.finishTimer = null;
  state.result = state.results[state.measureType];
  state.taps = state.result !== null ? state.resultTaps[state.measureType] : 0;
  els.tapButton.disabled = state.result !== null;
  els.newMeasurementButton.hidden = true;
  els.saveButton.disabled = !hasSavedMeasurement();
  els.saveState.hidden = true;
}

function syncMeasurementSelection() {
  setResetConfirmation(false);
  if (state.measuring) return;
  state.result = state.results[state.measureType];
  state.taps = state.result !== null ? state.resultTaps[state.measureType] : 0;
  els.tapButton.disabled = state.result !== null;
  els.newMeasurementButton.hidden = state.result === null;
  els.saveButton.disabled = !hasSavedMeasurement();
}

function startMeasurement() {
  setResetConfirmation(false);
  state.results[state.measureType] = null;
  state.resultTaps[state.measureType] = 0;
  resetMeasurementRun();
  state.measuring = true;
  state.startedAt = Date.now();
  state.taps = 1;
  els.saveButton.disabled = true;
  els.newMeasurementButton.hidden = false;
  setResetConfirmation(false);
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

function stopMeasurement() {
  if (!state.measuring) return;
  const elapsed = (Date.now() - state.startedAt) / 1000;
  finishMeasurement(Math.min(state.duration, Math.max(1, elapsed)));
}

function finishMeasurement(measuredDuration = state.duration) {
  if (!state.measuring) return;
  const effectiveDuration = Math.max(1, Math.round(measuredDuration));
  clearInterval(state.timer);
  clearTimeout(state.finishTimer);
  state.measuring = false;
  state.timer = null;
  state.finishTimer = null;
  state.result = Math.round((state.taps / effectiveDuration) * 60);
  state.results[state.measureType] = state.result;
  state.resultTaps[state.measureType] = state.taps;
  if (!els.measuredAtInput.value) els.measuredAtInput.value = new Date().toISOString();
  els.tapButton.disabled = true;
  els.newMeasurementButton.hidden = false;
  setResetConfirmation(false);
  els.saveButton.disabled = false;
  renderMeasurementControls();
  updateMeterView();
}

function pulseFeedback() {
  els.tapButton.classList.remove('tap-hit');
  void els.tapButton.offsetWidth;
  els.tapButton.classList.add('tap-hit');
}

function updateMeterView() {
  const label = state.measureType === 'breath' ? 'Atemzug' : 'Pulsschlag';
  const iconName = state.measureType === 'breath' ? 'wind' : 'heart-pulse';
  const savedResult = state.results[state.measureType];
  if (!state.measuring) {
    state.result = savedResult;
    state.taps = savedResult !== null ? state.resultTaps[state.measureType] : 0;
  }
  const countLabel = state.measureType === 'breath'
    ? (state.taps === 1 ? 'Atemzug' : 'Atemzüge')
    : (state.taps === 1 ? 'Pulsschlag' : 'Pulsschläge');
  const unit = state.measureType === 'breath' ? 'Atemzüge/min' : 'Pulsschläge/min';
  const elapsed = state.startedAt ? Math.min((Date.now() - state.startedAt) / 1000, state.duration) : 0;
  const progress = state.duration > 0 ? Math.min(100, Math.max(0, (elapsed / state.duration) * 100)) : 0;
  const remaining = Math.max(0, Math.ceil(state.duration - elapsed));
  const liveRate = state.measuring && elapsed > 0 ? Math.round((state.taps / elapsed) * 60) : null;

  els.measurementProgressFill.style.width = `${state.measuring ? progress : (state.result === null ? 0 : 100)}%`;
  els.meterStatus.textContent = state.measuring ? `${remaining} Sekunden` : (state.result === null ? `${state.duration} Sekunden` : 'Fertig');
  els.meterCount.textContent = `${state.taps} ${countLabel} gezählt`;
  els.tapButtonIcon.innerHTML = icon(iconName);
  els.tapButtonMain.textContent = state.measuring ? `${label} tippen` : (state.result === null ? 'Messung starten' : 'Messung beendet');
  els.tapButtonSub.textContent = state.measuring ? 'Tap registriert sofort' : (state.result === null ? 'Erster Tap startet Timer' : 'Ergebnis speichern oder neue Messung starten');
  els.measurementResult.value = state.result !== null ? `${state.result} ${unit}` : (liveRate !== null ? `${liveRate} ${unit}` : unit);
}

function hasSavedMeasurement() {
  return state.results.breath !== null || state.results.pulse !== null;
}

function savedMeasurementType() {
  if (state.results.breath !== null && state.results.pulse !== null) return 'both';
  if (state.results.pulse !== null) return 'pulse';
  return 'breath';
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
  await ensureDefaultDogSaved();
  renderDogSelect();
  renderAccountDogs();
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
  const accountUser = currentAccountUser();
  const defaultLocationId = accountUser.default_location_id || '';
  const defaultContextIds = Array.isArray(accountUser.default_context_ids) ? accountUser.default_context_ids : [];
  const locationOptions = visibleLocations();
  const contextOptions = visibleContexts();
  if (!locationOptions.some((location) => location._id === state.location)) {
    state.location = locationOptions.some((location) => location._id === defaultLocationId)
      ? defaultLocationId
      : locationOptions[0]?._id || '';
  }
  const validDefaultContexts = sortContextIds(defaultContextIds.filter((id) => contextOptions.some((context) => context._id === id)));
  if (selectedContexts().length === 0 && validDefaultContexts.length > 0) {
    setSelectedContexts(validDefaultContexts);
  }
  setSelectedContexts(sortContextIds(selectedContexts().filter((id) => contextOptions.some((context) => context._id === id))));
}

async function loadAccountView() {
  const result = await api('account');
  state.account = result.account || null;
  await ensureDefaultDogSaved();
  await ensureDefaultLocationSaved();
  state.showHiddenDogs = false;
  state.showHiddenLocations = false;
  state.showHiddenContexts = false;
  state.showDisabledUsers = false;
  resetAccountListOrders();
  renderAccountView();
  if (!els.userAdminPanel.hidden) await loadUsers();
}

function renderAccountView() {
  const user = state.account?.user || state.status?.auth?.user;
  const canManageUsers = user?.permissions?.includes('manage_users');
  els.userAdminPanel.hidden = !canManageUsers;
  renderAccountProfile();
  renderAccountDogs();
  renderAccountTaxonomy();
}

function currentAccountUser() {
  return state.account?.user || state.status?.auth?.user || {};
}

function renderAccountProfile() {
  const user = currentAccountUser();
  if (!els.accountProfileForm) return;
  els.accountProfileForm.elements.username.value = user.username || '';
  els.accountProfileForm.elements.display_name.value = user.display_name || '';
  els.accountProfileForm.elements.email.value = user.email || '';
  renderAccountPasskeys();
}

function renderAccountPasskeys() {
  if (!els.accountPasskeys) return;
  const passkeys = Array.isArray(state.account?.passkeys) ? state.account.passkeys : [];
  if (passkeys.length === 0) {
    els.accountPasskeys.innerHTML = '<p class="muted">Noch kein Passkey.</p>';
    return;
  }

  els.accountPasskeys.innerHTML = passkeys.map((passkey, index) => `
    <article class="entry account-subitem">
      <div class="account-subitem-main">
        <strong>Passkey ${index + 1}</strong>
        <span class="muted">Erstellt: ${escapeHtml(formatDate(passkey.created_at))}</span>
        <span class="muted">Zuletzt genutzt: ${escapeHtml(formatDate(passkey.last_used_at))}</span>
      </div>
      <button class="delete-entry has-ui-icon" type="button" data-delete-passkey="${escapeHtml(passkey.id)}">
        ${labelWithIcon('trash-2', 'Löschen')}
      </button>
    </article>
  `).join('');
  els.accountPasskeys.querySelectorAll('[data-delete-passkey]').forEach((button) => {
    button.addEventListener('click', () => deleteAccountPasskey(button.dataset.deletePasskey).catch((error) => setMessage(error.message, true)));
  });
}

function renderAccountDogs() {
  if (!els.dogList) return;
  const defaultId = accountDefaultDogId();
  const dogs = orderedAccountList('dogs', state.showHiddenDogs);
  els.showHiddenDogs.checked = state.showHiddenDogs;
  renderDefaultDogSummary();
  renderAccountObjectCounts();
  if (dogs.length === 0) {
    els.dogList.innerHTML = '<p class="muted">Noch kein Hund.</p>';
    return;
  }

  const visibleDogCount = visibleDogs().length;
  els.dogList.innerHTML = dogs.map((dog) => {
    const visible = isTaxonomyVisible(dog);
    const visibleLocked = visible && visibleDogCount <= 1;
    return `
      <form class="entry dog-edit" data-dog-id="${escapeHtml(dog._id)}" data-revision="${dog._revision}">
        <strong class="dog-edit-title">${escapeHtml(dog.name || 'Mein Hund')}</strong>
        <label>
          <span class="control-title">Name</span>
          <input name="name" value="${escapeHtml(dog.name || 'Mein Hund')}" data-dog-name-input="${escapeHtml(dog._id)}" required>
        </label>
        <label>
          <span class="control-title">Notizen</span>
          <textarea name="notes" rows="2">${escapeHtml(dog.notes || '')}</textarea>
        </label>
        <div class="entry-actions">
          <label class="checkbox-line user-permission-line${dog._id === defaultId ? ' is-disabled' : ' is-editable'}">
            <input class="${dog._id === defaultId ? 'is-checked' : ''}" type="checkbox" data-default-dog="${escapeHtml(dog._id)}" ${dog._id === defaultId ? 'checked disabled' : ''}>
            Standard
          </label>
          <label class="checkbox-line user-permission-line${visibleLocked ? ' is-disabled' : ' is-editable'}">
            <input class="${visible ? 'is-checked' : ''} ${visibleLocked ? 'is-locked' : ''}" type="checkbox" data-toggle-dog-visible="${escapeHtml(dog._id)}" data-revision="${dog._revision}" ${visible ? 'checked' : ''} ${visibleLocked ? 'disabled' : ''}>
            Sichtbar
          </label>
        </div>
      </form>
    `;
  }).join('');

  els.dogList.querySelectorAll('.dog-edit').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      saveAccountDogForm(form).catch((error) => setMessage(error.message, true));
    });
    form.querySelectorAll('input[name="name"], textarea[name="notes"]').forEach((input) => {
      input.addEventListener('input', () => queueAccountDogSave(form));
      input.addEventListener('change', () => queueAccountDogSave(form));
    });
  });
  els.dogList.querySelectorAll('[data-default-dog]').forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.checked) {
        input.checked = true;
        return;
      }
      setDefaultDog(input.dataset.defaultDog).catch((error) => setMessage(error.message, true));
    });
  });
  els.dogList.querySelectorAll('[data-toggle-dog-visible]').forEach((input) => {
    input.addEventListener('change', () => {
      toggleDogVisible(input.dataset.toggleDogVisible, Number(input.dataset.revision), input.checked).catch((error) => {
        input.checked = !input.checked;
        setMessage(error.message, true);
      });
    });
  });
}

function queueAccountDogSave(form) {
  const id = form.dataset.dogId;
  clearTimeout(state.dogSaveTimers.get(id));
  state.dogSaveTimers.set(id, setTimeout(() => saveAccountDogForm(form).catch((error) => setMessage(error.message, true)), 500));
}

async function saveAccountDogForm(form) {
  const data = new FormData(form);
  const name = String(data.get('name') || '').trim();
  if (name === '') return;
  const result = await api('object-update', {
    method: 'POST',
    body: {
      type: 'dogs',
      id: form.dataset.dogId,
      base_revision: Number(form.dataset.revision),
      object: {
        name,
        notes: data.get('notes'),
      },
    },
  });
  form.dataset.revision = result.object?._revision || form.dataset.revision;
  const title = form.querySelector('.dog-edit-title');
  if (title) title.textContent = result.object?.name || 'Mein Hund';
  const visibleInput = form.querySelector('[data-toggle-dog-visible]');
  if (visibleInput) visibleInput.dataset.revision = form.dataset.revision;
  state.dogs = state.dogs.map((dog) => (dog._id === form.dataset.dogId ? result.object : dog));
  setMessage('Hund gespeichert.');
  renderMeasurementControls();
  renderEntries();
}

function renderAccountTaxonomy() {
  renderAccountLocationSettings();
  renderAccountContextSettings();
}

function accountDefaultDogId() {
  const user = currentAccountUser();
  const value = user.default_dog_id || '';
  const options = visibleDogs();
  return options.some((dog) => dog._id === value)
    ? value
    : options[0]?._id || '';
}

async function ensureDefaultDogSaved() {
  const user = currentAccountUser();
  const options = visibleDogs();
  if (options.length === 0) return;
  if (options.some((dog) => dog._id === (user.default_dog_id || ''))) return;
  await saveAccountDefaults({ default_dog_id: options[0]._id });
}

function renderDefaultDogSummary() {
  const defaultId = accountDefaultDogId();
  const defaultDog = state.dogs.find((dog) => dog._id === defaultId);
  els.defaultDogSummary.innerHTML = `<strong>${escapeHtml(defaultDog?.name || 'Kein Hund')}</strong>`;
}

function renderAccountObjectCounts() {
  if (els.dogSectionTitle) els.dogSectionTitle.textContent = `Hunde (${visibleDogs().length})`;
  if (els.hiddenDogCount) els.hiddenDogCount.textContent = `(${state.dogs.length - visibleDogs().length})`;
  if (els.locationSectionTitle) els.locationSectionTitle.textContent = `Orte (${visibleLocations().length})`;
  if (els.hiddenLocationCount) els.hiddenLocationCount.textContent = `(${state.locationPresets.length - visibleLocations().length})`;
  if (els.contextSectionTitle) els.contextSectionTitle.textContent = `Kontexte (${visibleContexts().length})`;
  if (els.hiddenContextCount) els.hiddenContextCount.textContent = `(${state.contextPresets.length - visibleContexts().length})`;
}

function accountDefaultLocationId() {
  const user = currentAccountUser();
  const value = user.default_location_id || '';
  const options = visibleLocations();
  return options.some((location) => location._id === value)
    ? value
    : options[0]?._id || '';
}

function accountDefaultContextIds() {
  const user = currentAccountUser();
  const values = Array.isArray(user.default_context_ids) ? user.default_context_ids : [];
  return sortContextIds(values.filter((id) => visibleContexts().some((context) => context._id === id)));
}

function sortContextIds(ids) {
  return ids.slice().sort((left, right) => {
    const leftContext = state.contextPresets.find((context) => context._id === left);
    const rightContext = state.contextPresets.find((context) => context._id === right);
    const byName = String(leftContext?.name || '').localeCompare(String(rightContext?.name || ''), 'de', { sensitivity: 'base' });
    return byName || String(left).localeCompare(String(right));
  });
}

async function ensureDefaultLocationSaved() {
  const user = currentAccountUser();
  const options = visibleLocations();
  if (options.length === 0) return;
  if (options.some((location) => location._id === (user.default_location_id || ''))) return;
  await saveAccountDefaults({ default_location_id: options[0]._id });
}

function renderAccountLocationSettings() {
  if (!els.locationList) return;
  const defaultId = accountDefaultLocationId();
  const locations = orderedAccountList('locations', state.showHiddenLocations);
  els.showHiddenLocations.checked = state.showHiddenLocations;
  renderAccountObjectCounts();
  if (locations.length === 0) {
    els.locationList.innerHTML = '<p class="muted">Noch kein Ort.</p>';
    return;
  }

  els.locationList.innerHTML = locations.map((location) => `
    <form class="entry taxonomy-edit" data-taxonomy-type="locations" data-taxonomy-id="${escapeHtml(location._id)}" data-revision="${location._revision}">
      <label>
        <input name="name" value="${escapeHtml(location.name || '')}" required>
      </label>
      <div class="entry-actions">
        <label class="checkbox-line user-permission-line${location._id === defaultId ? ' is-disabled' : ' is-editable'}">
          <input type="checkbox" data-default-location="${escapeHtml(location._id)}" ${location._id === defaultId ? 'checked disabled' : ''}>
          Standard
        </label>
        <label class="checkbox-line user-permission-line is-editable">
          <input type="checkbox" data-toggle-taxonomy-visible="locations" data-taxonomy-id="${escapeHtml(location._id)}" data-revision="${location._revision}" ${isTaxonomyVisible(location) ? 'checked' : ''}>
          Sichtbar
        </label>
      </div>
    </form>
  `).join('');
  wireAccountTaxonomyList(els.locationList);
  els.locationList.querySelectorAll('[data-default-location]').forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.checked) {
        input.checked = true;
        return;
      }
      setDefaultLocation(input.dataset.defaultLocation).catch((error) => setMessage(error.message, true));
    });
  });
}

function renderAccountContextSettings() {
  if (!els.contextList) return;
  const defaultIds = accountDefaultContextIds();
  const contexts = orderedAccountList('contexts', state.showHiddenContexts);
  els.showHiddenContexts.checked = state.showHiddenContexts;
  renderAccountObjectCounts();
  if (contexts.length === 0) {
    els.contextList.innerHTML = '<p class="muted">Noch kein Kontext.</p>';
    return;
  }

  els.contextList.innerHTML = contexts.map((context) => {
    const isDefault = defaultIds.includes(context._id);
    return `
      <form class="entry taxonomy-edit" data-taxonomy-type="contexts" data-taxonomy-id="${escapeHtml(context._id)}" data-revision="${context._revision}">
        <label>
          <input name="name" value="${escapeHtml(context.name || '')}" required>
        </label>
        <div class="entry-actions">
          <label class="checkbox-line user-permission-line is-editable">
            <input type="checkbox" data-default-context="${escapeHtml(context._id)}" ${isDefault ? 'checked' : ''}>
            Standard
          </label>
          <label class="checkbox-line user-permission-line is-editable">
            <input type="checkbox" data-toggle-taxonomy-visible="contexts" data-taxonomy-id="${escapeHtml(context._id)}" data-revision="${context._revision}" ${isTaxonomyVisible(context) ? 'checked' : ''}>
            Sichtbar
          </label>
        </div>
      </form>
    `;
  }).join('');
  wireAccountTaxonomyList(els.contextList);
  els.contextList.querySelectorAll('[data-default-context]').forEach((input) => {
    input.addEventListener('change', () => toggleDefaultContext(input.dataset.defaultContext, input.checked).catch((error) => setMessage(error.message, true)));
  });
}

function wireAccountTaxonomyList(list) {
  list.querySelectorAll('.taxonomy-edit').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      saveAccountTaxonomyForm(form).catch((error) => setMessage(error.message, true));
    });
    form.querySelectorAll('input[name="name"]').forEach((input) => {
      input.addEventListener('input', () => queueAccountTaxonomySave(form));
      input.addEventListener('change', () => queueAccountTaxonomySave(form));
    });
  });
  list.querySelectorAll('[data-toggle-taxonomy-visible]').forEach((input) => {
    input.addEventListener('change', () => toggleTaxonomyVisible(input.dataset.toggleTaxonomyVisible, input.dataset.taxonomyId, Number(input.dataset.revision), input.checked).catch((error) => setMessage(error.message, true)));
  });
}

function queueAccountTaxonomySave(form) {
  const key = `${form.dataset.taxonomyType}:${form.dataset.taxonomyId}`;
  clearTimeout(state.taxonomySaveTimers.get(key));
  state.taxonomySaveTimers.set(key, setTimeout(() => saveAccountTaxonomyForm(form).catch((error) => setMessage(error.message, true)), 500));
}

async function saveAccountTaxonomyForm(form) {
  const type = form.dataset.taxonomyType;
  const id = form.dataset.taxonomyId;
  const data = new FormData(form);
  const name = String(data.get('name') || '').trim();
  if (!type || !id || name === '') return;
  const result = await api('object-update', {
    method: 'POST',
    body: {
      type,
      id,
      base_revision: Number(form.dataset.revision),
      object: { name },
    },
  });
  form.dataset.revision = result.object?._revision || form.dataset.revision;
  const listName = type === 'locations' ? 'locationPresets' : 'contextPresets';
  state[listName] = state[listName].map((item) => (item._id === id ? result.object : item));
  if (type === 'locations' || type === 'contexts') renderAccountObjectCounts();
  renderMeasurementControls();
  renderEntries();
  setMessage(type === 'locations' ? 'Ort gespeichert.' : 'Kontext gespeichert.');
}

async function setDefaultLocation(id) {
  if (!id) return;
  await ensureTaxonomyVisible('locations', id);
  await saveAccountDefaults({ default_location_id: id });
  state.location = id;
  renderAccountTaxonomy();
  renderLocationOptions();
  setMessage('Standardort gespeichert.');
}

async function setDefaultDog(id) {
  if (!id) return;
  await ensureDogVisible(id);
  await saveAccountDefaults({ default_dog_id: id });
  els.dogSelect.value = id;
  renderAccountDogs();
  renderDogSelect();
  renderEntries();
  setMessage('Standardhund gespeichert.');
}

async function ensureDogVisible(id) {
  const dog = state.dogs.find((candidate) => candidate._id === id);
  if (!dog || isTaxonomyVisible(dog)) return;
  const result = await api('object-update', {
    method: 'POST',
    body: { type: 'dogs', id, base_revision: Number(dog._revision), object: { visible: true } },
  });
  state.dogs = state.dogs.map((candidate) => (candidate._id === id ? result.object : candidate));
}

async function toggleDogVisible(id, revision, visible) {
  if (!id || !revision) return;
  if (!visible && isTaxonomyVisible(state.dogs.find((dog) => dog._id === id) || {}) && visibleDogs().length <= 1) {
    throw new Error('Mindestens ein Hund muss sichtbar bleiben.');
  }
  const wasDefault = accountDefaultDogId() === id;
  const result = await api('object-update', {
    method: 'POST',
    body: { type: 'dogs', id, base_revision: revision, object: { visible } },
  });
  state.dogs = state.dogs.map((dog) => (dog._id === id ? result.object : dog));
  if (!visible && wasDefault) {
    await saveAccountDefaults({ default_dog_id: visibleDogs()[0]?._id || '' });
  }
  if (!visible && els.dogSelect.value === id) {
    els.dogSelect.value = accountDefaultDogId();
  }
  renderAccountDogs();
  renderDogSelect();
  renderEntries();
  setMessage('Hund gespeichert.');
}

async function toggleDefaultContext(id, enabled) {
  if (!id) return;
  if (enabled) await ensureTaxonomyVisible('contexts', id);
  const current = accountDefaultContextIds();
  const next = enabled
    ? sortContextIds(current.concat(id).filter((value, index, list) => list.indexOf(value) === index))
    : sortContextIds(current.filter((value) => value !== id));
  await saveAccountDefaults({ default_context_ids: next });
  if (enabled) setSelectedContexts(selectedContexts().concat(id));
  renderAccountTaxonomy();
  renderContextOptions();
  setMessage('Standardkontexte gespeichert.');
}

async function ensureTaxonomyVisible(type, id) {
  const listName = type === 'locations' ? 'locationPresets' : 'contextPresets';
  const item = state[listName].find((candidate) => candidate._id === id);
  if (!item || isTaxonomyVisible(item)) return;
  const result = await api('object-update', {
    method: 'POST',
    body: { type, id, base_revision: Number(item._revision), object: { visible: true } },
  });
  state[listName] = state[listName].map((candidate) => (candidate._id === id ? result.object : candidate));
}

async function saveAccountDefaults(patch) {
  const result = await api('account-update', { method: 'POST', body: patch });
  state.account = result.account || null;
  if (state.status?.auth) state.status.auth.user = result.user || state.account?.user || state.status.auth.user;
}

async function toggleTaxonomyVisible(type, id, revision, visible) {
  if (!type || !id || !revision) return;
  const user = currentAccountUser();
  const wasDefaultLocation = (user.default_location_id || '') === id;
  const wasDefaultContext = Array.isArray(user.default_context_ids) && user.default_context_ids.includes(id);
  const result = await api('object-update', {
    method: 'POST',
    body: { type, id, base_revision: revision, object: { visible } },
  });
  const listName = type === 'locations' ? 'locationPresets' : 'contextPresets';
  state[listName] = state[listName].map((item) => (item._id === id ? result.object : item));
  if (!visible && type === 'locations' && wasDefaultLocation) {
    const nextLocation = visibleLocations().find((location) => location._id !== id)?._id || '';
    await saveAccountDefaults({ default_location_id: nextLocation });
    if (state.location === id) state.location = accountDefaultLocationId();
  }
  if (!visible && type === 'contexts' && wasDefaultContext) {
    const nextDefaults = sortContextIds((Array.isArray(user.default_context_ids) ? user.default_context_ids : []).filter((contextId) => contextId !== id));
    await saveAccountDefaults({ default_context_ids: nextDefaults });
    setSelectedContexts(selectedContexts().filter((contextId) => contextId !== id));
  }
  await loadTaxonomy();
  await ensureDefaultLocationSaved();
  renderAccountTaxonomy();
  renderMeasurementControls();
  renderEntries();
  setMessage(type === 'locations' ? 'Ort gespeichert.' : 'Kontext gespeichert.');
}

function queueAccountProfileSave() {
  clearTimeout(state.accountProfileSaveTimer);
  state.accountProfileSaveTimer = setTimeout(() => saveAccountProfileForm().catch((error) => setMessage(error.message, true)), 500);
}

async function saveAccountProfileForm() {
  const formElement = els.accountProfileForm;
  const form = new FormData(formElement);
  if (String(form.get('username') || '').trim() === '') return;
  const result = await api('account-update', {
    method: 'POST',
    body: {
      username: form.get('username'),
      display_name: form.get('display_name'),
      email: form.get('email'),
    },
  });
  state.account = result.account || null;
  if (state.status?.auth) state.status.auth.user = result.user || state.account?.user || state.status.auth.user;
  renderShell();
  renderDogSelect();
  renderEntries();
  setMessage('Benutzerkonto gespeichert.');
}

async function loadUsers() {
  const result = await api('admin-users');
  const currentUserId = state.status?.auth?.user?.id || '';
  const users = result.users || [];
  state.userSetupTokens = Array.isArray(result.setup_tokens) ? result.setup_tokens : [];
  const visibleUsers = state.showDisabledUsers ? users : users.filter((user) => user.enabled);
  const disabledCount = users.filter((user) => !user.enabled).length;
  if (els.userSectionTitle) els.userSectionTitle.textContent = `Alle Benutzer (${visibleUsers.length})`;
  if (els.disabledUserCount) els.disabledUserCount.textContent = `(${disabledCount})`;
  if (els.showDisabledUsers) els.showDisabledUsers.checked = state.showDisabledUsers;
  els.userList.innerHTML = visibleUsers.map((user) => {
    const canManageUsers = user.permissions.includes('manage_users');
    const permissionLocked = user.protected_admin && canManageUsers;
    const setupUrl = state.userSetupLinks.get(user.id) || '';
    return `
      <form class="user-row user-edit" data-user-id="${escapeHtml(user.id)}">
        <strong class="user-edit-title">${escapeHtml(user.username || 'Benutzer')}</strong>
        <span class="muted">${escapeHtml(String(user.credential_count || 0))} Passkeys</span>
        <div class="user-edit-fields">
          <label>
            <span class="control-title">Benutzername</span>
            <input name="username" value="${escapeHtml(user.username || '')}" data-user-name-input="${escapeHtml(user.id)}" autocomplete="off" required>
          </label>
          <label>
            <span class="control-title">Anzeigename</span>
            <input name="display_name" value="${escapeHtml(user.display_name || '')}" autocomplete="name">
          </label>
          <label>
            <span class="control-title">E-Mail-Adresse</span>
            <input name="email" type="email" value="${escapeHtml(user.email || '')}" autocomplete="email">
          </label>
        </div>
        <div class="user-row-actions">
          <label class="checkbox-line user-permission-line${permissionLocked ? ' is-disabled' : ' is-editable'}">
            ${permissionLocked ? '<input name="manage_users" type="hidden" value="1">' : ''}
            <input name="manage_users" type="checkbox" value="1" ${canManageUsers ? 'checked' : ''} ${permissionLocked ? 'disabled' : ''}>
            Kann Benutzer verwalten
          </label>
          <button class="secondary-action has-ui-icon" type="button" data-user-create-setup="${escapeHtml(user.id)}" ${user.enabled ? '' : 'disabled'}>
            ${labelWithIcon('link', 'Setup-Link erstellen')}
          </button>
          <button class="${user.enabled ? 'delete-entry' : 'primary'} has-ui-icon user-status-button" type="button" data-user-enabled="${escapeHtml(user.id)}" data-enabled="${user.enabled ? 'true' : 'false'}" ${user.enabled && user.id === currentUserId ? 'disabled' : ''}>
            ${labelWithIcon(user.enabled ? 'user-x' : 'user-check', user.enabled ? 'Deaktivieren' : 'Aktivieren')}
          </button>
        </div>
        <div class="user-setup-links" data-user-setup-links="${escapeHtml(user.id)}"></div>
        <p class="setup-link" data-user-setup-link="${escapeHtml(user.id)}" ${setupUrl ? '' : 'hidden'}></p>
      </form>
    `;
  }).join('');
  els.userList.querySelectorAll('[data-user-setup-links]').forEach((element) => {
    renderUserSetupTokens(element, element.dataset.userSetupLinks);
  });
  els.userList.querySelectorAll('[data-user-setup-link]').forEach((element) => {
    const url = state.userSetupLinks.get(element.dataset.userSetupLink) || '';
    if (url) renderSetupLink(element, url);
  });
  els.userList.querySelectorAll('.user-edit').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      saveUserForm(form).catch((error) => setMessage(error.message, true));
    });
    form.querySelectorAll('input[name="username"], input[name="display_name"], input[name="email"], input[name="manage_users"]').forEach((input) => {
      const eventName = input.type === 'checkbox' ? 'change' : 'input';
      input.addEventListener(eventName, () => queueUserSave(form));
      if (input.type !== 'checkbox') input.addEventListener('change', () => queueUserSave(form));
    });
  });
  els.userList.querySelectorAll('[data-user-enabled]').forEach((input) => {
    input.addEventListener('click', () => updateUserEnabled(input).catch((error) => setMessage(error.message, true)));
  });
  els.userList.querySelectorAll('[data-user-create-setup]').forEach((button) => {
    button.addEventListener('click', () => createUserSetupLink(button).catch((error) => setMessage(error.message, true)));
  });
  els.userList.querySelectorAll('[data-delete-setup-token]').forEach((button) => {
    button.addEventListener('click', () => deleteSetupToken(button.dataset.deleteSetupToken).catch((error) => setMessage(error.message, true)));
  });
}

function renderUserSetupTokens(element, userId) {
  const tokens = state.userSetupTokens.filter((token) => token.user_id === userId);
  if (tokens.length === 0) {
    element.innerHTML = '';
    return;
  }
  element.innerHTML = tokens.map((token) => `
    <article class="entry account-subitem">
      <div class="account-subitem-main">
        <strong>Setup-Link</strong>
        <span class="muted">Erstellt: ${escapeHtml(formatDate(token.created_at))}</span>
        <span class="muted">Läuft ab: ${escapeHtml(formatDate(token.expires_at))}</span>
      </div>
      <button class="delete-entry has-ui-icon" type="button" data-delete-setup-token="${escapeHtml(token.id)}">
        ${labelWithIcon('trash-2', 'Löschen')}
      </button>
    </article>
  `).join('');
}

function queueUserSave(form) {
  const id = form.dataset.userId;
  clearTimeout(state.userSaveTimers.get(id));
  state.userSaveTimers.set(id, setTimeout(() => saveUserForm(form).catch((error) => setMessage(error.message, true)), 500));
}

async function saveUserForm(form) {
  const data = new FormData(form);
  const username = String(data.get('username') || '').trim();
  if (username === '') return;
  const result = await api('admin-update-user', {
    method: 'POST',
    body: {
      id: form.dataset.userId,
      username,
      display_name: data.get('display_name'),
      email: data.get('email'),
      permissions: data.get('manage_users') === '1' ? ['manage_users'] : [],
    },
  });
  form.querySelector('.user-edit-title').textContent = result.user?.username || username;
  if (form.dataset.userId === state.status?.auth?.user?.id) await refresh();
  setMessage('Benutzer gespeichert.');
}

async function updateUserEnabled(input) {
  input.disabled = true;
  try {
    const enabled = input.dataset.enabled !== 'true';
    await api('admin-update-user', {
      method: 'POST',
      body: {
        id: input.dataset.userEnabled,
        enabled,
      },
    });
    await loadUsers();
    if (input.dataset.userEnabled === state.status?.auth?.user?.id) await refresh();
    setMessage('Benutzerstatus gespeichert.');
  } finally {
    input.disabled = false;
  }
}

async function createUserSetupLink(button) {
  const userId = button.dataset.userCreateSetup;
  if (!userId) return;
  button.disabled = true;
  try {
    const result = await api('admin-create-setup-token', {
      method: 'POST',
      body: { id: userId },
    });
    const url = result.setup?.setup_url || '';
    if (url) state.userSetupLinks.set(userId, url);
    if (result.setup?.id) {
      state.userSetupTokens = state.userSetupTokens
        .filter((token) => token.id !== result.setup.id)
        .concat(result.setup);
    }
    const target = els.userList.querySelector(`[data-user-setup-link="${cssEscape(userId)}"]`);
    if (target) renderSetupLink(target, url);
    const list = els.userList.querySelector(`[data-user-setup-links="${cssEscape(userId)}"]`);
    if (list) renderUserSetupTokens(list, userId);
    setMessage('Setup-Link erstellt.');
  } finally {
    button.disabled = false;
  }
}

async function deleteAccountPasskey(credentialId) {
  if (!credentialId) return;
  if (!window.confirm('Passkey löschen?')) return;
  const result = await api('account-delete-passkey', {
    method: 'POST',
    body: { credential_id: credentialId },
  });
  state.account = result.account || state.account;
  renderAccountView();
  setMessage('Passkey gelöscht.');
}

async function deleteSetupToken(tokenId) {
  if (!tokenId) return;
  if (!window.confirm('Setup-Link löschen?')) return;
  const result = await api('admin-delete-setup-token', {
    method: 'POST',
    body: { token_id: tokenId },
  });
  state.userSetupTokens = Array.isArray(result.setup_tokens) ? result.setup_tokens : [];
  await loadUsers();
  setMessage('Setup-Link gelöscht.');
}

function renderDogSelect() {
  const options = sortedVisibleDogs();
  const selected = els.dogSelect.value || accountDefaultDogId();
  const selectedDog = options.find((dog) => dog._id === selected) || options[0];
  const hasMultipleDogs = options.length > 1;
  const selectedId = selectedDog?._id || '';

  els.dogSelectLabel.hidden = !hasMultipleDogs;
  els.dogNameDisplay.hidden = hasMultipleDogs;
  els.dogNameDisplay.querySelector('strong').innerHTML = `${icon('paw')}<span>${escapeHtml(selectedDog?.name || 'Mein Hund')}</span>`;
  els.dogSelect.value = selectedId;

  els.dogButtons.innerHTML = options.map((dog) => (
    optionButton({
      value: dog._id,
      label: dog.name || 'Mein Hund',
      active: dog._id === selectedId,
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

function renderRecordFilters() {
  const dogs = sortedVisibleDogs();
  const hasMultipleDogs = dogs.length > 1;
  const selectedDog = state.recordDogFilter;
  els.recordDogFilter.hidden = !hasMultipleDogs;
  els.recordSingleDogName.hidden = hasMultipleDogs;
  els.recordSingleDogName.textContent = dogs[0]?.name || 'Mein Hund';
  els.recordDogFilter.innerHTML = '<option value="">Alle Hunde</option>' + dogs.map((dog) => (
    `<option value="${escapeHtml(dog._id)}" ${dog._id === selectedDog ? 'selected' : ''}>${escapeHtml(dog.name || 'Mein Hund')}</option>`
  )).join('');
  if (!hasMultipleDogs || (selectedDog && !dogs.some((dog) => dog._id === selectedDog))) {
    state.recordDogFilter = '';
    els.recordDogFilter.value = '';
  }
  els.recordTypeFilter.value = state.recordTypeFilter;
}

function entryType(entry) {
  return entry.measurement_type || (entry.pulse_per_minute !== null && entry.pulse_per_minute !== undefined ? 'pulse' : 'breath');
}

function entryTime(entry) {
  const date = new Date(entry.measured_at || entry._created || 0);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function visibleEntries() {
  const visibleDogIds = new Set(visibleDogs().map((dog) => dog._id));
  const hasMultipleDogs = visibleDogIds.size > 1;
  const entries = state.entries.filter((entry) => {
    const type = entryType(entry);
    return visibleDogIds.has(entry.dog_id)
      && (!hasMultipleDogs || !state.recordDogFilter || entry.dog_id === state.recordDogFilter)
      && (!state.recordTypeFilter || type === state.recordTypeFilter);
  });
  entries.sort((a, b) => {
    const direction = state.recordSortDirection === 'asc' ? 1 : -1;
    return compareRecordValues(sortValue(a, state.recordSortColumn), sortValue(b, state.recordSortColumn)) * direction;
  });
  return entries;
}

function sortValue(entry, column) {
  if (column === 'dog') return dogLabel(entry.dog_id);
  if (column === 'time') return entryTime(entry);
  if (column === 'breath') return numberSortValue(entry.breaths_per_minute);
  if (column === 'pulse') return numberSortValue(entry.pulse_per_minute);
  if (column === 'mode') return modeLabel(entryType(entry), entry.mode);
  if (column === 'location') return locationLabel(entry.location_id);
  if (column === 'context') return contextSummary(entry);
  if (column === 'notes') return entry.notes || entry.comment || '';
  return '';
}

function numberSortValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : -1;
}

function compareRecordValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'de', { numeric: true, sensitivity: 'base' });
}

function sortHeader(column, label, iconName) {
  const active = state.recordSortColumn === column;
  const marker = active ? (state.recordSortDirection === 'asc' ? '↑' : '↓') : '';
  return `<button class="record-sort-button ${active ? 'is-active-sort' : ''}" type="button" data-record-sort="${column}">${labelWithIcon(iconName, label)}${marker ? `<span class="sort-arrow" aria-hidden="true">${marker}</span>` : ''}</button>`;
}

function sortRecords(column) {
  if (state.recordSortColumn === column) {
    state.recordSortDirection = state.recordSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    state.recordSortColumn = column;
    state.recordSortDirection = column === 'time' ? 'desc' : 'asc';
  }
  renderEntries();
}

function measurementTypeLabel(value) {
  return {
    breath: 'Atmung',
    pulse: 'Puls',
    both: 'Atmung + Puls',
  }[value] || value || 'Atmung';
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function joinCsvList(values) {
  return values.filter((value) => value !== null && value !== undefined && value !== '').join('; ');
}

function filenamePart(value) {
  const cleaned = String(value || '').trim().replace(/[^A-Za-z0-9_.@-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'user';
}

function timestampForFilename(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + '_' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('-');
}

async function exportEntriesCsv() {
  const [account, dogsResult, locationsResult, contextsResult, entriesResult] = await Promise.all([
    api('account').catch(() => ({ account: { user: state.status?.auth?.user || {} } })),
    api('objects', { query: { type: 'dogs' } }),
    api('objects', { query: { type: 'locations' } }),
    api('objects', { query: { type: 'contexts' } }),
    api('objects', { query: { type: 'vitals' } }),
  ]);
  state.dogs = dogsResult.objects || [];
  state.locationPresets = locationsResult.objects || [];
  state.contextPresets = contextsResult.objects || [];
  state.entries = entriesResult.objects || [];
  const user = account.account?.user || state.status?.auth?.user || {};
  const currentUserId = String(user.id || '');
  const currentUsername = String(user.username || '');
  const currentDisplayName = String(user.display_name || '');
  const modifiedByMeta = (value) => {
    const id = String(value || '');
    const matchesCurrentUser = id !== '' && (
      id === currentUserId
      || id === currentUsername
    );
    return {
      'geändert_von_id': id,
      'geändert_von_benutzername': matchesCurrentUser ? currentUsername : '',
    };
  };
  const headerKeys = [
    'datentyp',
    'id',
    'revision',
    'erstellt',
    'geändert',
    'geändert_von_id',
    'geändert_von_benutzername',
    'name',
    'anzeigename',
    'hund_notizen',
    'messung_hund_id',
    'messung_hund_name',
    'messung_ort_id',
    'messung_ort_name',
    'messung_kontext_ids',
    'messung_kontext_namen',
    'zeitpunkt',
    'zeitpunkt_anzeige',
    'messart',
    'messart_anzeige',
    'modus',
    'modus_anzeige',
    'atemfrequenz_pro_minute',
    'puls_pro_minute',
    'notizen',
  ];
  const headers = headerKeys.map((header) => header.charAt(0).toUpperCase() + header.slice(1));
  const row = (values) => headerKeys.map((header) => values[header] ?? '');
  const meta = (object) => ({
    id: object._id || '',
    revision: object._revision ?? '',
    erstellt: object._created || '',
    'geändert': object._modified || '',
    ...modifiedByMeta(object._modifiedBy),
  });
  const vitalsRows = state.entries.map((entry) => {
    const type = entryType(entry);
    const measuredAt = entry.measured_at || entry._created || '';
    const contextIds = Array.isArray(entry.context_ids) ? entry.context_ids : [];
    return row({
      datentyp: 'messung',
      ...meta(entry),
      messung_hund_id: entry.dog_id || '',
      messung_hund_name: dogLabel(entry.dog_id),
      messung_ort_id: entry.location_id || '',
      messung_ort_name: locationLabel(entry.location_id),
      messung_kontext_ids: joinCsvList(contextIds),
      messung_kontext_namen: contextSummary(entry),
      zeitpunkt: measuredAt,
      zeitpunkt_anzeige: measuredAt ? formatDate(measuredAt) : '',
      messart: type,
      messart_anzeige: measurementTypeLabel(type),
      modus: entry.mode || '',
      modus_anzeige: modeLabel(type, entry.mode),
      atemfrequenz_pro_minute: entry.breaths_per_minute ?? '',
      puls_pro_minute: entry.pulse_per_minute ?? '',
      notizen: entry.notes || entry.comment || '',
    });
  });
  const rows = [
    row({
      datentyp: 'benutzer',
      id: currentUserId,
      name: currentUsername,
      anzeigename: currentDisplayName,
    }),
    ...state.dogs.map((dog) => row({
      datentyp: 'hund',
      ...meta(dog),
      name: dog.name || '',
      hund_notizen: dog.notes || '',
    })),
    ...state.locationPresets.map((location) => row({
      datentyp: 'ort',
      ...meta(location),
      name: location.name || '',
    })),
    ...state.contextPresets.map((context) => row({
      datentyp: 'kontext',
      ...meta(context),
      name: context.name || '',
    })),
    ...vitalsRows,
  ];
  const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `doggylog-verlauf-${filenamePart(user.username)}-${timestampForFilename()}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function renderEntries() {
  renderRecordFilters();
  renderRecordEditor();
  els.entriesList.hidden = false;
  const entries = visibleEntries();
  els.recordExportButton.disabled = state.dogs.length === 0 && state.entries.length === 0;
  if (state.entries.length === 0) {
    els.entriesList.innerHTML = '<p class="muted">Noch keine Messungen.</p>';
    return;
  }
  if (entries.length === 0) {
    els.entriesList.innerHTML = '<p class="muted">Keine Messungen für diesen Filter.</p>';
    return;
  }

  const hasDogColumn = visibleDogs().length > 1;
  const rows = entries.map((entry) => {
    const type = entryType(entry);
    const context = contextSummary(entry);
    const notes = entry.notes || entry.comment || '';
    return `
      <tr class="record-row" data-edit-entry="${escapeHtml(entry._id)}" role="button" tabindex="0">
        ${hasDogColumn ? `<td class="record-dog"><strong>${escapeHtml(dogLabel(entry.dog_id))}</strong></td>` : ''}
        <td class="record-time">${formatDateWithRelative(entry.measured_at || entry._created)}</td>
        <td class="record-value">${formatRecordValue(entry.breaths_per_minute)}</td>
        <td class="record-value">${formatRecordValue(entry.pulse_per_minute)}</td>
        <td>${escapeHtml(modeLabel(type, entry.mode))}</td>
        <td>${escapeHtml(locationLabel(entry.location_id))}</td>
        <td class="record-context">${escapeHtml(context || '')}</td>
        <td class="record-notes">${escapeHtml(notes || '')}</td>
      </tr>
    `;
  }).join('');

  els.entriesList.innerHTML = `
    <div class="records-table-wrap">
      <table class="records-table ${hasDogColumn ? 'has-dog-column' : ''}">
        <thead>
          <tr class="record-head">
            ${hasDogColumn ? `<th scope="col">${sortHeader('dog', 'Hund', 'paw')}</th>` : ''}
            <th class="record-time-head" scope="col">${sortHeader('time', 'Zeit', 'clock')}</th>
            <th scope="col">${sortHeader('breath', 'Atmung', 'wind')}</th>
            <th scope="col">${sortHeader('pulse', 'Puls', 'heart-pulse')}</th>
            <th scope="col">${sortHeader('mode', 'Modus', 'activity')}</th>
            <th scope="col">${sortHeader('location', 'Ort', 'map-pin')}</th>
            <th scope="col">${sortHeader('context', 'Kontext', 'tag')}</th>
            <th scope="col">${sortHeader('notes', 'Notizen', 'file-text')}</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;

  els.entriesList.querySelectorAll('[data-edit-entry]').forEach((row) => {
    row.addEventListener('click', () => openEntryEditor(row.dataset.editEntry));
    row.addEventListener('keydown', (event) => {
      if (!['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      openEntryEditor(row.dataset.editEntry);
    });
  });
  els.entriesList.querySelectorAll('[data-record-sort]').forEach((button) => {
    button.addEventListener('click', () => sortRecords(button.dataset.recordSort));
  });
}

function formatRecordValue(value) {
  if (value === null || value === undefined || value === '') return '<span class="muted">-</span>';
  return `<strong>${escapeHtml(value)}</strong> <span class="muted">bpm</span>`;
}

function renderEntryHiddenField(field, value) {
  return `<input type="hidden" data-field="${field}" value="${escapeHtml(value ?? '')}">`;
}

function renderEntryChoices(options, selected, attr, field, multi = false) {
  const selectedValues = Array.isArray(selected) ? selected : [selected];
  const renderOption = multi ? pillButton : optionButton;
  return `
    ${renderEntryHiddenField(field, multi ? selectedValues.join(', ') : selectedValues[0])}
    <div class="${multi ? 'pill-grid' : 'choice-grid'}" role="group">
      ${options.map((option) => renderOption({
        value: option.value,
        label: option.label,
        active: selectedValues.includes(option.value),
        deleteMode: false,
        deleteCandidate: '',
        attr,
      }).replace('<button ', `<button data-edit-pill="${field}" data-edit-multi="${multi ? 'true' : 'false'}" `)).join('')}
    </div>
  `;
}

function entryDogOptions() {
  return sortedVisibleDogs().map((dog) => ({ value: dog._id, label: dog.name || 'Mein Hund' }));
}

function entryLocationOptions(selected) {
  return sortedLocationOptions(selected).map((item) => ({ value: item._id, label: item.name }));
}

function entryContextOptions(selected) {
  return sortedContextOptions(selected).map((item) => ({ value: item._id, label: item.name }));
}

function renderEntryEditor(entry) {
  const entryContexts = Array.isArray(entry.context_ids) ? entry.context_ids : [];
  const dogs = visibleDogs();
  const showDog = dogs.length > 1;
  const dogValue = entry.dog_id || dogs[0]?._id || '';
  const locationValue = entry.location_id || state.location || visibleLocations()[0]?._id || '';

  return `
    <div class="record-edit-form" data-entry-editor="${escapeHtml(entry._id)}">
      <button class="secondary-action record-back-button has-ui-icon" type="button" data-record-back>${labelWithIcon('arrow-left', 'Zurück')}</button>
      ${showDog ? `
        <div class="choice-block">
          <span class="control-title">Hund</span>
          ${renderEntryChoices(
            entryDogOptions(),
            dogValue,
            'data-dog',
            'dog_id',
          )}
        </div>
      ` : `
        ${renderEntryHiddenField('dog_id', dogValue)}
        <div class="dog-name">
          <span class="control-title">Hund</span>
          <strong class="has-ui-icon">${icon('paw')}<span>${escapeHtml(dogLabel(dogValue))}</span></strong>
        </div>
      `}
      <div class="choice-block">
        <span class="control-title">Zeit</span>
        <div class="record-input-row record-input-row--compact">
          ${icon('clock')}
          <input type="datetime-local" data-autosave-entry="${escapeHtml(entry._id)}" data-field="measured_at" value="${escapeHtml(dateTimeLocalValue(entry.measured_at || entry._created))}">
        </div>
      </div>
      <div class="choice-block">
        <span class="control-title">Atmung</span>
        <label class="record-value-field">
          ${icon('wind')}
          <input type="number" min="0" max="400" step="1" inputmode="numeric" data-autosave-entry="${escapeHtml(entry._id)}" data-field="breaths_per_minute" value="${escapeHtml(entry.breaths_per_minute ?? '')}">
          <span class="muted">Atemzüge/min</span>
        </label>
      </div>
      <div class="choice-block">
        <span class="control-title">Puls</span>
        <label class="record-value-field">
          ${icon('heart-pulse')}
          <input type="number" min="0" max="400" step="1" inputmode="numeric" data-autosave-entry="${escapeHtml(entry._id)}" data-field="pulse_per_minute" value="${escapeHtml(entry.pulse_per_minute ?? '')}">
          <span class="muted">Pulsschläge/min</span>
        </label>
      </div>
      <div class="choice-block">
        <span class="control-title">Modus</span>
        ${renderEntryHiddenField('mode', entry.mode || 'resting')}
        <div class="mode-grid" role="group" aria-label="Messmodus">
          ${sharedModes.map(([value, label]) => (
            `<button type="button" data-edit-set="mode" data-value="${value}" class="has-ui-icon ${value === (entry.mode || 'resting') ? 'is-active' : ''}">${labelWithIcon(modeIcon(value), label)}</button>`
          )).join('')}
        </div>
      </div>
      <div class="choice-block">
        <span class="control-title">Ort</span>
        ${renderEntryChoices(
          entryLocationOptions(locationValue),
          locationValue,
          'data-location',
          'location_id',
        )}
      </div>
      <div class="choice-block">
        <span class="control-title">Kontext</span>
        ${renderEntryChoices(
          entryContextOptions(entryContexts),
          entryContexts,
          'data-context',
          'context_ids',
          true,
        )}
      </div>
      <div class="choice-block">
        <span class="control-title">Notizen</span>
        <textarea rows="3" data-autosave-entry="${escapeHtml(entry._id)}" data-field="notes">${escapeHtml(entry.notes || entry.comment || '')}</textarea>
      </div>
      <div class="record-editor-actions">
        <button class="secondary-action record-back-button has-ui-icon" type="button" data-record-back>${labelWithIcon('arrow-left', 'Zurück')}</button>
        <button class="delete-entry has-ui-icon" type="button" data-delete-entry="${escapeHtml(entry._id)}" data-revision="${entry._revision}">${labelWithIcon('trash', 'Löschen')}</button>
      </div>
    </div>
  `;
}

function entryEditorField(editor, field) {
  return editor.querySelector(`[data-field="${field}"]`);
}

function queueEntryEditorSave(editor) {
  queueEntrySave(editor.dataset.entryEditor);
}

function handleRecordEditorBackdrop(event) {
  if (event.target !== els.recordEditorPage) return;
  closeEntryEditor().catch((error) => setMessage(error.message, true));
}

function renderRecordEditor() {
  const entry = state.entries.find((item) => item._id === state.editingEntryId);
  els.recordEditorPage.hidden = !entry;
  if (!entry) {
    state.editingEntryId = null;
    els.recordEditorPage.innerHTML = '';
    els.recordEditorPage.onclick = null;
    return;
  }
  els.recordEditorPage.innerHTML = renderEntryEditor(entry);
  els.recordEditorPage.onclick = handleRecordEditorBackdrop;
  els.recordEditorPage.querySelectorAll('[data-record-back]').forEach((button) => {
    button.addEventListener('click', () => closeEntryEditor().catch((error) => setMessage(error.message, true)));
  });
  els.recordEditorPage.querySelectorAll('[data-delete-entry]').forEach((button) => {
    button.addEventListener('click', () => deleteEntry(button.dataset.deleteEntry, Number(button.dataset.revision)));
  });
  els.recordEditorPage.querySelectorAll('[data-autosave-entry]').forEach((input) => {
    const eventName = input.tagName === 'TEXTAREA' || input.type === 'number' || input.type === 'datetime-local' ? 'input' : 'change';
    input.addEventListener(eventName, () => queueEntrySave(input.dataset.autosaveEntry));
  });
  els.recordEditorPage.querySelectorAll('[data-edit-set]').forEach((button) => {
    button.addEventListener('click', () => {
      const editor = button.closest('[data-entry-editor]');
      entryEditorField(editor, button.dataset.editSet).value = button.dataset.value;
      editor.querySelectorAll(`[data-edit-set="${button.dataset.editSet}"]`).forEach((item) => item.classList.toggle('is-active', item === button));
      queueEntryEditorSave(editor);
    });
  });
  els.recordEditorPage.querySelectorAll('[data-edit-pill]').forEach((button) => {
    button.addEventListener('click', () => {
      const editor = button.closest('[data-entry-editor]');
      const field = button.dataset.editPill;
      const input = entryEditorField(editor, field);
      if (button.dataset.editMulti === 'true') {
        const values = input.value.split(',').map((value) => value.trim()).filter(Boolean);
        const next = values.includes(button.dataset.context)
          ? values.filter((value) => value !== button.dataset.context)
          : [...values, button.dataset.context];
        input.value = next.join(', ');
        button.classList.toggle('is-active', next.includes(button.dataset.context));
      } else {
        const value = button.dataset.dog || button.dataset.location || '';
        input.value = value;
        editor.querySelectorAll(`[data-edit-pill="${field}"]`).forEach((item) => item.classList.toggle('is-active', item === button));
      }
      queueEntryEditorSave(editor);
    });
  });
}

function openEntryEditor(id) {
  state.editingEntryId = id;
  renderRecordEditor();
}

async function closeEntryEditor() {
  const id = state.editingEntryId;
  const scrollTop = pageScrollTop();
  if (id !== null) {
    clearTimeout(state.saveTimers.get(id));
    await saveEntryEdit(id);
  }
  state.editingEntryId = null;
  await loadEntries();
  renderRecordEditor();
  scrollPageTo(scrollTop);
}

function queueEntrySave(id) {
  clearTimeout(state.saveTimers.get(id));
  state.saveTimers.set(id, setTimeout(() => saveEntryEdit(id).catch((error) => setMessage(error.message, true)), 350));
}

async function saveEntryEdit(id) {
  const entry = state.entries.find((item) => item._id === id);
  const editor = document.querySelector(`[data-entry-editor="${cssEscape(id)}"]`);
  if (!entry || !editor) return;

  const values = Object.fromEntries(Array.from(editor.querySelectorAll('[data-field]')).map((input) => {
    const value = input.dataset.field === 'context_ids'
      ? input.value.split(',').map((item) => item.trim()).filter(Boolean)
      : (input.multiple ? Array.from(input.selectedOptions).map((option) => option.value) : input.value);
    return [input.dataset.field, value];
  }));
  const object = {
    measured_at: values.measured_at,
    dog_id: values.dog_id || '',
    mode: values.mode,
    location_id: values.location_id,
    context_ids: values.context_ids,
    notes: values.notes,
    breaths_per_minute: values.breaths_per_minute,
    pulse_per_minute: values.pulse_per_minute,
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
    mode: state.mode,
    location_id: state.location,
    context_ids: selectedContexts(),
    notes: els.notesInput.value,
    breaths_per_minute: state.results.breath,
    pulse_per_minute: state.results.pulse,
  };

  await api('object-create', { method: 'POST', body: { type: 'vitals', object } });
  els.saveState.textContent = 'Gespeichert.';
  showMeasurementSavedFeedback();
  els.notesInput.value = '';
  resetMeasurement();
  renderMeasurementControls();
  await loadEntries();
}

async function deleteEntry(id, revision) {
  if (!id || !revision) return;
  if (!window.confirm('Messung löschen?')) return;
  await api('object-delete', { method: 'POST', body: { type: 'vitals', id, base_revision: revision } });
  if (state.editingEntryId === id) state.editingEntryId = null;
  await loadEntries();
}

function formatDate(value) {
  if (!value) return 'Ohne Zeitpunkt';
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
    .format(new Date(value))
    .replace(', ', ' ');
}

function formatDateWithRelative(value) {
  const relative = relativeTime(value);
  return `${escapeHtml(formatDate(value))}${relative ? ` <span class="date-separator">·</span> <span class="muted">${escapeHtml(relative)}</span>` : ''}`;
}

function relativeTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (Number.isNaN(diff)) return '';
  const abs = Math.abs(diff);
  if (abs < 60 * 1000) return 'now';
  if (abs < 60 * 60 * 1000) return `${Math.round(abs / 60000)}m`;
  if (abs < 24 * 60 * 60 * 1000) return `${Math.round(abs / 3600000)}h`;
  if (abs < 7 * 24 * 60 * 60 * 1000) return `${Math.round(abs / 86400000)}d`;
  return `${Math.round(abs / 604800000)}w`;
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

function modeIcon(value) {
  return {
    active: 'activity',
    panting: 'wind',
    resting: 'clock',
    sleeping: 'zzz',
  }[value] || 'activity';
}

function pillIcon(attr) {
  return {
    'data-context': 'tag',
    'data-dog': 'paw',
    'data-location': 'map-pin',
  }[attr] || '';
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

function pageScrollTop() {
  return els.page ? els.page.scrollTop : window.scrollY;
}

function scrollPageTo(top) {
  if (els.page) {
    els.page.scrollTo({ top });
    return;
  }
  window.scrollTo({ top });
}

function renderSetupLink(element, url) {
  element.hidden = false;
  if (!url) {
    element.textContent = 'Setup-Link erstellt.';
    return;
  }
  element.innerHTML = `
    <span>${escapeHtml(url)}</span>
    <button class="icon-button setup-copy-button" type="button" title="Setup-Link kopieren" aria-label="Setup-Link kopieren"></button>
  `;
  const button = element.querySelector('button');
  setIconOnlyButton(button, 'copy', 'Setup-Link kopieren');
  button.addEventListener('click', () => copySetupLink(url, element));
}

async function copySetupLink(url, element) {
  try {
    await navigator.clipboard.writeText(url);
    const button = element.querySelector('button');
    if (button) {
      setIconOnlyButton(button, 'check', 'Kopiert');
      window.setTimeout(() => {
        if (!button.isConnected) return;
        setIconOnlyButton(button, 'copy', 'Setup-Link kopieren');
      }, 900);
    }
    setMessage('Setup-Link kopiert.');
  } catch (error) {
    setMessage('Kopieren nicht möglich.', true);
  }
}

els.passkeyLoginButton.addEventListener('click', () => passkeyLogin().catch((error) => {
  offerEmailLogin(error.message || 'Passkey fehlgeschlagen. Du kannst einen Login-Link anfordern.');
}));
els.setupForm.addEventListener('submit', (event) => passkeySetup(event).catch((error) => setMessage(error.message, true)));
els.loginButton.addEventListener('click', () => {
  els.authScreen.hidden = false;
});
els.viewTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    switchView(tab.dataset.viewTab);
    if (tab.dataset.viewTab === 'records') loadEntries().catch((error) => setMessage(error.message, true));
    if (tab.dataset.viewTab === 'account') loadAccountView().catch((error) => setMessage(error.message, true));
  });
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
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || els.recordEditorPage.hidden) return;
  closeEntryEditor().catch((error) => setMessage(error.message, true));
});

document.querySelectorAll('[data-measure-type]').forEach((button) => {
  button.addEventListener('click', () => {
    if (state.measuring) return;
    state.measureType = button.dataset.measureType;
    syncMeasurementSelection();
    renderMeasurementControls();
  });
});
document.querySelectorAll('[data-duration]').forEach((button) => {
  button.addEventListener('click', () => {
    setResetConfirmation(false);
    if (state.measuring || state.results[state.measureType] !== null) {
      renderMeasurementControls();
      return;
    }
    state.duration = Number(button.dataset.duration);
    renderMeasurementControls();
  });
});
els.addContextButton.addEventListener('click', () => addContextFromPrompt().catch((error) => setMessage(error.message, true)));
els.addLocationButton.addEventListener('click', () => addLocationFromPrompt().catch((error) => setMessage(error.message, true)));
els.showHiddenDogs.addEventListener('change', () => {
  state.showHiddenDogs = els.showHiddenDogs.checked;
  resetAccountListOrder('dogs');
  renderAccountDogs();
});
els.showHiddenContexts.addEventListener('change', () => {
  state.showHiddenContexts = els.showHiddenContexts.checked;
  resetAccountListOrder('contexts');
  renderAccountContextSettings();
});
els.showHiddenLocations.addEventListener('change', () => {
  state.showHiddenLocations = els.showHiddenLocations.checked;
  resetAccountListOrder('locations');
  renderAccountLocationSettings();
});
els.contextCreateButton.addEventListener('click', () => addContext(true).catch((error) => setMessage(error.message, true)));
els.locationCreateButton.addEventListener('click', () => addLocation(true).catch((error) => setMessage(error.message, true)));

async function addContextFromPrompt() {
  const value = window.prompt('Neuer Kontext');
  if (value === null) return;
  const name = value.trim();
  if (name === '') return;
  await addContext(false, name);
}

async function addLocationFromPrompt() {
  const value = window.prompt('Neuer Ort');
  if (value === null) return;
  const name = value.trim();
  if (name === '') return;
  await addLocation(false, name);
}

async function addContext(focusName = false, name = 'Neuer Kontext') {
  const result = await api('object-create', { method: 'POST', body: { type: 'contexts', object: { name } } });
  state.contextPresets = state.contextPresets.filter((item) => item._id !== result.object._id).concat(result.object);
  setSelectedContexts(selectedContexts().concat(result.object._id));
  renderContextOptions();
  renderAccountTaxonomy();
  if (focusName) focusTaxonomyName('contexts', result.object._id);
}

async function addLocation(focusName = false, name = 'Neuer Ort') {
  const result = await api('object-create', { method: 'POST', body: { type: 'locations', object: { name } } });
  state.locationPresets = state.locationPresets.filter((item) => item._id !== result.object._id).concat(result.object);
  state.location = result.object._id;
  renderLocationOptions();
  renderAccountTaxonomy();
  if (focusName) focusTaxonomyName('locations', result.object._id);
}

function focusTaxonomyName(type, id) {
  const input = document.querySelector(`[data-taxonomy-type="${type}"][data-taxonomy-id="${cssEscape(id)}"] input[name="name"]`);
  input?.focus();
  input?.select();
}

async function handleContextClick(context) {
  const selected = selectedContexts();
  setSelectedContexts(selected.includes(context)
    ? selected.filter((item) => item !== context)
    : selected.concat(context));
  renderContextOptions();
}

async function handleLocationClick(location) {
  state.location = location;
  renderLocationOptions();
}
els.tapButton.addEventListener('click', registerTap);
els.newMeasurementButton.addEventListener('click', () => {
  if (state.measuring) {
    resetMeasurementRun();
    renderMeasurementControls();
    return;
  }
  if (!window.confirm(`${discardMeasurementLabel()}?`)) return;
  resetMeasurement();
  renderMeasurementControls();
});
els.entryForm.addEventListener('submit', (event) => saveEntry(event).catch((error) => {
  els.saveState.hidden = false;
  els.saveState.textContent = error.message;
}));
els.recordDogFilter.addEventListener('change', () => {
  state.recordDogFilter = els.recordDogFilter.value;
  state.editingEntryId = null;
  renderEntries();
});
els.recordTypeFilter.addEventListener('change', () => {
  state.recordTypeFilter = els.recordTypeFilter.value;
  state.editingEntryId = null;
  renderEntries();
});
els.recordExportButton.addEventListener('click', () => {
  els.recordExportButton.disabled = true;
  exportEntriesCsv()
    .catch((error) => setMessage(error.message, true))
    .finally(() => {
      els.recordExportButton.disabled = state.dogs.length === 0 && state.entries.length === 0;
    });
});
els.selfSetupButton.addEventListener('click', () => addAccountPasskey().catch((error) => {
  els.selfSetupResult.hidden = false;
  els.selfSetupResult.textContent = error.message;
  setMessage(error.message, true);
}));
els.logoutButton.addEventListener('click', async () => {
  await api('auth-logout', { method: 'POST', body: {} });
  window.location.href = './';
});
els.accountProfileForm.addEventListener('submit', (event) => {
  event.preventDefault();
  saveAccountProfileForm().catch((error) => setMessage(error.message, true));
});
els.accountProfileForm.querySelectorAll('input').forEach((input) => {
  input.addEventListener('input', queueAccountProfileSave);
  input.addEventListener('change', queueAccountProfileSave);
});
els.dogCreateButton.addEventListener('click', async () => {
  const result = await api('object-create', { method: 'POST', body: { type: 'dogs', object: {} } });
  await loadDogs();
  renderAccountDogs();
  const input = els.dogList.querySelector(`[data-dog-name-input="${cssEscape(result.object?._id || '')}"]`);
  input?.focus();
  input?.select();
  renderMeasurementControls();
  renderEntries();
});
els.userCreateButton.addEventListener('click', async () => {
  const username = `neuer-benutzer-${Date.now().toString(36)}`;
  const result = await api('admin-create-user', {
    method: 'POST',
    body: {
      username,
      display_name: '',
      email: '',
      permissions: [],
    },
  });
  if (result.user?.id && result.setup?.setup_url) state.userSetupLinks.set(result.user.id, result.setup.setup_url);
  await loadUsers();
  const input = els.userList.querySelector(`[data-user-name-input="${cssEscape(result.user?.id || '')}"]`);
  input?.focus();
  input?.select();
});
els.showDisabledUsers.addEventListener('change', () => {
  state.showDisabledUsers = els.showDisabledUsers.checked;
  loadUsers().catch((error) => setMessage(error.message, true));
});
hydrateStaticIcons();
renderMeasurementControls();
switchView(state.view, false);
window.addEventListener('hashchange', () => {
  handleAuthFragment().catch((error) => setMessage(error.message, true));
});

if (initialLoginToken) {
  verifyEmailLogin(initialLoginToken).catch((error) => setMessage(error.message, true));
} else {
  refresh().catch((error) => setMessage(error.message, true));
}
