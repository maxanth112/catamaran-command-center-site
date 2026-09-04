const SYSTEM_LABELS = {
  battery: 'Battery bank',
  solar_charging: 'Solar & charging',
  sails_rig: 'Sails & rig',
  engines_drives: 'Engines & drives',
  generator: 'Generator',
  climate: 'A/C & climate',
  water: 'Watermaker',
  structure: 'Structure & hull',
  survey_docs: 'Survey & records',
  tax_title: 'Tax & title',
};

const STATUS_LABELS = {
  documented: 'Documented',
  survey: 'Survey finding',
  owner_reported: 'Owner reported',
  broker_confirmed: 'Broker confirmed',
  listing: 'Listing only',
  mixed: 'Mixed evidence',
  pending: 'Pending records',
  unknown: 'Unknown',
};

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

let enrichmentByBoat = new Map();
let boatsById = new Map();
let loaded = false;
let renderQueued = false;

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json();
}

async function loadEnrichment() {
  const index = await fetchJson('../data/index.json');
  if (!index.enrichment) return;
  const manifest = await fetchJson(`../${index.enrichment}`);
  const [shards, boatShards] = await Promise.all([
    Promise.all(manifest.shards.map((path) => fetchJson(`../${path}`))),
    Promise.all(index.boats.map((path) => fetchJson(`../${path}`))),
  ]);
  enrichmentByBoat = new Map(shards.flat().map((record) => [record.boat_id, record]));
  boatsById = new Map(boatShards.flat().map((boat) => [boat.id, boat]));
  loaded = true;
}

function statusBadge(status) {
  const label = STATUS_LABELS[status] || status || 'Unknown';
  return `<span class="system-evidence ${esc(status || 'unknown')}">${esc(label)}</span>`;
}

function systemCard(key, system) {
  if (!system) return '';
  return `<article class="decision-system-card ${esc(system.status || 'unknown')}">
    <div class="decision-system-head"><h3>${esc(SYSTEM_LABELS[key] || key)}</h3>${statusBadge(system.status)}</div>
    <p>${esc(system.summary)}</p>
  </article>`;
}

function coverageBar(record) {
  const value = Math.max(0, Math.min(100, Number(record.completeness) || 0));
  return `<div class="decision-completeness" aria-label="Decision data completeness ${value}%">
    <div><span>Decision-data completeness</span><strong>${value}%</strong></div>
    <b><i style="width:${value}%"></i></b>
  </div>`;
}

function boatDetailPanel(boatId) {
  const record = enrichmentByBoat.get(boatId);
  if (!record) return '';
  const cards = Object.entries(SYSTEM_LABELS)
    .map(([key]) => systemCard(key, record.systems?.[key]))
    .join('');
  const unknowns = (record.unknowns || []).map((item) => `<li>${esc(item)}</li>`).join('');
  return `<section class="decision-systems-panel" data-systems-enrichment="${esc(boatId)}">
    <div class="decision-panel-heading">
      <div><span class="eyebrow">Evidence-backed acquisition data</span><h2>Decision systems</h2><p>Capacity, age, condition and evidence are separated so a large headline spec cannot hide an old or weakly documented system.</p></div>
      ${coverageBar(record)}
    </div>
    <div class="decision-system-grid">${cards}</div>
    <div class="decision-unknowns"><strong>Still unresolved</strong><ul>${unknowns || '<li>No material unknowns recorded.</li>'}</ul></div>
  </section>`;
}

function metric(record, key) {
  const system = record.systems?.[key];
  return system?.summary || 'Unknown';
}

function boatLabel(id) {
  const boat = boatsById.get(id);
  if (!boat) return id;
  return `${boat.year ?? ''} ${boat.model} — ${boat.name}`.trim();
}

function coverageTable() {
  const rows = [...enrichmentByBoat.values()]
    .map((record) => ({ record, boat: boatsById.get(record.boat_id) }))
    .filter(({ boat }) => boat && boat.stage_bucket !== 'closed')
    .sort((a, b) => (b.boat.score - a.boat.score) || (b.record.completeness - a.record.completeness))
    .map(({ record, boat }) => `<tr>
      <td><a href="#boat/${encodeURIComponent(record.boat_id)}"><strong>${esc(boat.year)} ${esc(boat.model)}</strong><small>${esc(boat.name)}</small></a></td>
      <td><span class="coverage-pill ${record.completeness >= 90 ? 'high' : record.completeness >= 75 ? 'mid' : 'low'}">${record.completeness}%</span></td>
      <td title="${esc(metric(record, 'battery'))}">${esc(metric(record, 'battery'))}</td>
      <td title="${esc(metric(record, 'solar_charging'))}">${esc(metric(record, 'solar_charging'))}</td>
      <td title="${esc(metric(record, 'sails_rig'))}">${esc(metric(record, 'sails_rig'))}</td>
      <td title="${esc(metric(record, 'engines_drives'))}">${esc(metric(record, 'engines_drives'))}</td>
      <td>${(record.unknowns || []).length}</td>
    </tr>`).join('');
  return `<section class="decision-coverage-panel" data-systems-overview>
    <div class="decision-panel-heading compact">
      <div><span class="eyebrow">New structured layer</span><h2>Decision-data coverage</h2><p>Top active candidates sorted by acquisition priority. Hover cells for full details; open a boat for evidence status and unresolved items.</p></div>
    </div>
    <div class="decision-table-scroll"><table class="decision-coverage-table">
      <thead><tr><th>Boat</th><th>Coverage</th><th>Battery</th><th>Solar / charging</th><th>Sails / rig</th><th>Engines / drives</th><th>Unknowns</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </section>`;
}

function decorateBoatLinks() {
  document.querySelectorAll('a[href^="#boat/"]').forEach((link) => {
    if (link.dataset.systemsDecorated) return;
    const id = decodeURIComponent(link.getAttribute('href').slice(6));
    const record = enrichmentByBoat.get(id);
    if (!record) return;
    link.dataset.systemsDecorated = '1';
    link.dataset.systemsCoverage = record.completeness;
    link.title = `${link.title ? `${link.title} · ` : ''}Decision data ${record.completeness}% complete`;
  });
}

function render() {
  renderQueued = false;
  if (!loaded) return;
  decorateBoatLinks();
  const main = document.querySelector('#main-content');
  if (!main) return;
  const hash = location.hash.slice(1) || 'overview';
  if (hash.startsWith('boat/')) {
    const id = decodeURIComponent(hash.slice(5));
    document.querySelector('[data-systems-overview]')?.remove();
    if (!main.querySelector(`[data-systems-enrichment="${CSS.escape(id)}"]`)) {
      const html = boatDetailPanel(id);
      if (html) main.insertAdjacentHTML('beforeend', html);
    }
    return;
  }
  document.querySelectorAll('[data-systems-enrichment]').forEach((node) => node.remove());
  if (hash === 'overview' && !main.querySelector('[data-systems-overview]')) {
    main.insertAdjacentHTML('beforeend', coverageTable());
  } else if (hash !== 'overview') {
    main.querySelector('[data-systems-overview]')?.remove();
  }
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(render);
}

loadEnrichment().then(() => {
  queueRender();
  addEventListener('hashchange', queueRender);
  const target = document.querySelector('#app');
  if (target) new MutationObserver(queueRender).observe(target, { childList: true, subtree: true });
}).catch((error) => console.warn('Systems enrichment unavailable:', error));
