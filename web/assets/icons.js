(() => {
const iconPaths = {
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>',
  'arrow-left': '<path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path>',
  check: '<path d="m20 6-11 11-5-5"></path>',
  clock: '<circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>',
  'help-circle': '<circle cx="12" cy="12" r="10"></circle><path d="M9.1 9a3 3 0 1 1 5.8 1c-.5 1-1.7 1.5-2.4 2.2-.4.4-.5.8-.5 1.3"></path><path d="M12 17h.01"></path>',
  'heart-pulse': '<path d="M19 14c1.5-1.4 3-3.2 3-5.4A5.4 5.4 0 0 0 12 5a5.4 5.4 0 0 0-10 3.6c0 5.5 10 11.4 10 11.4s2.1-1.2 4.3-3"></path><path d="M3.2 13h3.1l2-3 3.8 7 2-4h6.7"></path>',
  history: '<path d="M3 3v6h6"></path><path d="M3.1 13a9 9 0 1 0 2.5-7.4L3 9"></path><path d="M12 7v5l3 2"></path>',
  key: '<circle cx="7.5" cy="14.5" r="3.5"></circle><path d="M10 12 21 1"></path><path d="m15 6 3 3"></path><path d="m17 4 3 3"></path>',
  logOut: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="m16 17 5-5-5-5"></path><path d="M21 12H9"></path>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-10 6L2 7"></path>',
  'map-pin': '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle>',
  paw: '<circle cx="11" cy="14" r="4"></circle><circle cx="6" cy="9" r="2"></circle><circle cx="10" cy="6" r="2"></circle><circle cx="14" cy="6" r="2"></circle><circle cx="18" cy="9" r="2"></circle>',
  plus: '<path d="M12 5v14"></path><path d="M5 12h14"></path>',
  'rotate-ccw': '<path d="M3 2v6h6"></path><path d="M3 13a9 9 0 1 0 3-6.7L3 8"></path>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"></path><path d="M17 21v-8H7v8"></path><path d="M7 3v5h8"></path>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"></path><path d="M7.5 7.5h.01"></path>',
  trash: '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v5"></path><path d="M14 11v5"></path>',
  user: '<circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path>',
  wind: '<path d="M3 8h12a3 3 0 1 0-3-3"></path><path d="M3 12h16"></path><path d="M3 16h12a3 3 0 1 1-3 3"></path>',
  x: '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
  zzz: '<path d="M4 6h6l-6 8h6"></path><path d="M14 4h5l-5 6h5"></path><path d="M13 15h4l-4 5h4"></path>',
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}

function icon(name) {
  const paths = iconPaths[name];
  if (!paths) return '';
  return `<svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24">${paths}</svg>`;
}

function labelWithIcon(name, label) {
  return `${icon(name)}<span>${escapeHtml(label)}</span>`;
}

function setLabelWithIcon(element, name, label) {
  element.classList.add('has-ui-icon');
  element.innerHTML = labelWithIcon(name, label);
}

function setIconOnlyButton(element, name, label) {
  element.classList.add('has-ui-icon');
  element.innerHTML = icon(name);
  element.setAttribute('aria-label', label);
  element.title = label;
}

function hydrateStaticIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((element) => {
    if (element.querySelector('.ui-icon')) return;
    element.classList.add('has-ui-icon');
    element.innerHTML = labelWithIcon(element.dataset.icon, element.textContent.trim());
  });
  root.querySelectorAll('[data-icon-only]').forEach((element) => {
    if (element.querySelector('.ui-icon')) return;
    const label = element.getAttribute('aria-label') || element.title || '';
    setIconOnlyButton(element, element.dataset.iconOnly, label);
  });
}

window.DoggyLogIcons = {
  hydrateStaticIcons,
  icon,
  labelWithIcon,
  setIconOnlyButton,
  setLabelWithIcon,
};
})();
