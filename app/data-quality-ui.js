(() => {
  const key = 'catamaran-design-profile';
  const profiles = ['High-performance bluewater', 'Performance cruiser', 'Balanced performance cruiser', 'Balanced bluewater cruiser', 'Cruising all-rounder', 'Comfort-first cruiser'];
  let selected = sessionStorage.getItem(key) || 'all';
  let queued = false;

  function boatId() {
    const match = location.hash.match(/^#boat\/(.+)$/);
    if (!match) return null;
    try { return decodeURIComponent(match[1]); } catch { return match[1]; }
  }

  function readiness() {
    const boat = window.CATAMARAN_DATA_QUALITY?.boatsById?.get(boatId());
    if (!boat?.system_evidence) return;
    document.querySelectorAll('.coverage-row').forEach((row) => {
      const name = row.querySelector('strong')?.textContent?.trim();
      const fact = boat.system_evidence[name];
      if (!fact) return;
      const state = row.querySelector('.readiness-status');
      const evidence = row.querySelector('p');
      if (state) {
        state.className = `readiness-status ${fact.status}`;
        if (state.textContent !== fact.label) state.textContent = fact.label;
      }
      if (evidence && evidence.textContent !== fact.evidence) evidence.textContent = fact.evidence;
    });
    const note = document.querySelector('.capability-surface .method-note');
    if (note && /Unknown system status/i.test(note.textContent)) note.textContent = note.textContent.replace(/Unknown system status means the current evidence is incomplete, not that the system is absent\.?/i, '“Not disclosed” means the repository currently has no supporting listing/email statement for that system; it does not mean the equipment is absent.');
  }

  function profileControl() {
    const grid = document.querySelector('.advanced-grid');
    if (!grid || document.getElementById('designProfile')) return;
    const label = document.createElement('label');
    label.innerHTML = `<span>Design profile</span><select id="designProfile" aria-label="Filter by design profile"><option value="all">All design profiles</option>${profiles.map((profile) => `<option value="${profile}">${profile}</option>`).join('')}</select>`;
    (document.getElementById('region')?.closest('label') || grid.lastElementChild)?.after(label);
    if (!label.isConnected) grid.append(label);
    const select = label.querySelector('select');
    select.value = profiles.includes(selected) ? selected : 'all';
    select.addEventListener('change', () => {
      selected = select.value;
      selected === 'all' ? sessionStorage.removeItem(key) : sessionStorage.setItem(key, selected);
      applyProfile();
    });
  }

  function applyProfile() {
    const rows = [...document.querySelectorAll('.boat-table tbody .boat-row')];
    if (!rows.length) return;
    let visible = 0;
    for (const row of rows) {
      const profile = row.querySelector('[data-label="Design profile"] .profile-label')?.textContent?.trim() || '';
      const show = selected === 'all' || profile === selected;
      if (row.hidden === show) row.hidden = !show;
      if (show) visible += 1;
    }
    const count = document.querySelector('.inventory-surface .result-count');
    const countLabel = `${visible} result${visible === 1 ? '' : 's'}${selected === 'all' ? '' : ` · ${selected}`}`;
    if (count && count.textContent !== countLabel) count.textContent = countLabel;
    const details = document.querySelector('.inventory-controls details');
    if (details && selected !== 'all' && !details.open) details.open = true;
  }

  function chart() {
    const surface = [...document.querySelectorAll('.surface')].find((node) => /Age, size.*total cost/i.test(node.querySelector('h2')?.textContent || ''));
    if (!surface) return;
    const body = surface.querySelector('.panel-heading > div');
    if (body && !body.querySelector('[data-chart-encoding]')) {
      const p = document.createElement('p');
      p.dataset.chartEncoding = 'true';
      p.textContent = 'X = estimated all-in cost · Y = model year · bubble size = boat length (LOA) · color = priority score';
      body.append(p);
    }
    const legend = surface.querySelector('.chart-legend');
    if (!legend || legend.dataset.encodingEnhanced) return;
    legend.dataset.encodingEnhanced = 'true';
    const label = document.createElement('span'); label.innerHTML = '<strong>Color = priority:</strong>'; legend.prepend(label);
    const bubble = legend.querySelector('.bubble-key')?.closest('span');
    if (bubble) bubble.innerHTML = '<i class="bubble-key"></i><strong>Bubble size = LOA</strong> (longer boat = larger circle)';
  }

  function all() { profileControl(); applyProfile(); chart(); readiness(); }
  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; all(); });
  }
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-reset-filters], [data-preset]')) { selected = 'all'; sessionStorage.removeItem(key); }
  }, true);
  window.addEventListener('hashchange', queue);
  const appRoot = document.getElementById('app');
  if (appRoot) new MutationObserver(queue).observe(appRoot, { childList: true, subtree: true });
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', queue, { once: true }) : queue();
})();