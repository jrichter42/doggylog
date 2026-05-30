const $ = (id) => document.getElementById(id);

const state = {
  status: null,
  dogs: [],
};

const els = {
  page: $('accountPage'),
  message: $('accountMessage'),
  selfSetupButton: $('selfSetupButton'),
  selfSetupResult: $('selfSetupResult'),
  dogCreateForm: $('dogCreateForm'),
  dogList: $('dogList'),
};

function setMessage(text, isError = false) {
  els.message.hidden = !text;
  els.message.textContent = text || '';
  els.message.style.borderColor = isError ? '#f04438' : '';
}

function csrf() {
  return state.status?.auth?.csrf || '';
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
  const data = await response.json().catch(() => ({ ok: false, error: 'Ungueltige Serverantwort' }));
  if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

async function refresh() {
  state.status = await api('status');
  if (!state.status.auth?.user) {
    window.location.href = './';
    return;
  }
  els.page.hidden = false;
  await loadDogs();
}

async function loadDogs() {
  const result = await api('objects', { query: { type: 'dogs' } });
  state.dogs = result.objects || [];
  renderDogs();
}

function renderDogs() {
  if (state.dogs.length === 0) {
    els.dogList.innerHTML = '<p class="muted">Noch kein Hund.</p>';
    return;
  }

  els.dogList.innerHTML = state.dogs.map((dog) => `
    <form class="entry dog-edit" data-dog-id="${escapeHtml(dog._id)}" data-revision="${dog._revision}">
      <label>
        Name
        <input name="name" value="${escapeHtml(dog.name || 'Mein Hund')}" required>
      </label>
      <label>
        Notizen
        <textarea name="notes" rows="2">${escapeHtml(dog.notes || '')}</textarea>
      </label>
      <div class="entry-actions">
        <button class="primary" type="submit">Speichern</button>
        <button class="delete-entry" type="button" data-delete-dog="${escapeHtml(dog._id)}" data-revision="${dog._revision}">Loeschen</button>
      </div>
    </form>
  `).join('');

  els.dogList.querySelectorAll('.dog-edit').forEach((form) => {
    form.addEventListener('submit', (event) => saveDog(event).catch((error) => setMessage(error.message, true)));
  });
  els.dogList.querySelectorAll('[data-delete-dog]').forEach((button) => {
    button.addEventListener('click', () => deleteDog(button.dataset.deleteDog, Number(button.dataset.revision)).catch((error) => setMessage(error.message, true)));
  });
}

async function saveDog(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  await api('object-update', {
    method: 'POST',
    body: {
      type: 'dogs',
      id: form.dataset.dogId,
      base_revision: Number(form.dataset.revision),
      object: {
        name: data.get('name'),
        notes: data.get('notes'),
      },
    },
  });
  setMessage('Hund gespeichert.');
  await loadDogs();
}

async function deleteDog(id, revision) {
  if (!id || !revision) return;
  if (!window.confirm('Hund loeschen? Bestehende Messungen bleiben im Verlauf mit gespeichertem Namen.')) return;
  await api('object-delete', { method: 'POST', body: { type: 'dogs', id, base_revision: revision } });
  setMessage('Hund geloescht.');
  await loadDogs();
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

els.selfSetupButton.addEventListener('click', async () => {
  els.selfSetupResult.hidden = false;
  els.selfSetupResult.textContent = 'Erstelle Link...';
  try {
    const result = await api('account-create-setup-token', { method: 'POST', body: {} });
    els.selfSetupResult.textContent = result.setup?.setup_url || 'Setup-Link erstellt.';
  } catch (error) {
    els.selfSetupResult.textContent = error.message;
  }
});

els.dogCreateForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await api('object-create', { method: 'POST', body: { type: 'dogs', object: { name: form.get('name') } } });
  event.currentTarget.reset();
  await loadDogs();
});

refresh().catch((error) => setMessage(error.message, true));
