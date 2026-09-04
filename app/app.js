import {
  STAGE_LABELS,
  activeBoats,
  actionOwner,
  biggestRisk,
  boatIdentity,
  compactMoney,
  conversationImpact,
  costComposition,
  dealBreakerRisk,
  deriveBrand,
  deriveLength,
  economics,
  filterBoats,
  groupBy,
  inferCurrency,
  isSeriousCandidate,
  latestConversation,
  locationCoordinates,
  median,
  money,
  needsOutreach,
  preciseStatus,
  priorityBoats,
  readinessMatrix,
  regionFor,
  relativeDate,
  relativeValueRank,
  riskItems,
  sortBoats,
} from './lib.mjs?v=20260903.10';
import { sailingMethodology, sailingProfile } from './model-insights.mjs?v=20260903.10';

const ROUTES = [
  ['overview', 'Overview'],
  ['pipeline', 'Pipeline'],
  ['conversations', 'Correspondence'],
  ['compare', 'Compare'],
];

const STATUS_TONE = {
  diligence: 'positive',
  waiting: 'waiting',
  max_decision: 'decision',
  outreach: 'neutral',
  watch: 'neutral',
  closed: 'muted',
  other: 'neutral',
};

const PIPELINE_LABELS = {
  max_decision: 'Waiting on Max',
  diligence: 'Needs review',
  waiting: 'Waiting on broker',
  outreach: 'Needs outreach',
  watch: 'Watch for trigger',
};

const DEFAULT_FILTERS = {
  q: '', stage: 'all', tier: 'all', currency: 'all', brand: 'all', region: 'all',
  lengthMin: '', lengthMax: '', yearMin: '', yearMax: '', allInMax: '', scoreMin: '', activeOnly: false,
};

const state = {
  route: 'overview', boatId: null, ...DEFAULT_FILTERS,
  sortKey: 'score', sortDir: 'desc', preset: 'all', mapBoatIds: null, mapRegion: 'all', mapLabel: '',
  selected: new Set(), notice: '',
};

const app = document.querySelector('#app');
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const attr = esc;
const truncate = (value, length = 118) => {
  const text = String(value ?? '').trim();
  return text.length > length ? `${text.slice(0, length - 1).trim()}…` : text;
};

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
  return response.json();
}

async function loadCanonicalData() {
  const index = await fetchJson('../data/index.json');
  const [boatShards, conversationShards, manifestData] = await Promise.all([
    Promise.all(index.boats.map((path) => fetchJson(`../${path}`))),
    Promise.all(index.conversations.map((path) => fetchJson(`../${path}`))),
    fetchJson(`../${index.manifest}`),
  ]);
  return { boats: boatShards.flat(), conversations: conversationShards.flat(), manifest: manifestData };
}

let boats = [];
let conversations = [];
let manifest = null;

try {
  ({ boats, conversations, manifest } = await loadCanonicalData());
} catch (error) {
  app.innerHTML = `<main class="load-state error-state"><div class="load-mark">!</div><h1>Dashboard data did not load</h1><p>${esc(error.message)}</p><p>Serve the repository over HTTP with <code>npm run serve</code>, then reload this page.</p><button class="button primary" data-reload>Reload</button></main>`;
  document.querySelector('[data-reload]')?.addEventListener('click', () => location.reload());
  throw error;
}

const liveBoats = activeBoats(boats);
const liveBoatIds = new Set(liveBoats.map((boat) => boat.id));
const visibleConversations = conversations.filter((event) => {
  if (event.boat_id) return liveBoatIds.has(event.boat_id);
  const text = `${event.subject ?? ''} ${event.facts ?? ''} ${event.triage ?? ''} ${event.availability ?? ''}`;
  return !/sold|withdrawn|under contract|under offer/i.test(text);
});
const boatsById = new Map(boats.map((boat) => [boat.id, boat]));
const conversationsByBoat = groupBy(visibleConversations.filter((event) => event.boat_id), 'boat_id');
const generatedDate = manifest.generated_at?.slice(0, 10) || '2026-09-03';

function parseRoute() {
  const hash = location.hash.slice(1);
  if (hash.startsWith('boat/')) {
    state.route = 'boat';
    state.boatId = decodeURIComponent(hash.slice(5));
    return;
  }
  state.route = ROUTES.some(([route]) => route === hash) ? hash : 'overview';
  state.boatId = null;
}

function pageTitle() {
  if (state.route === 'boat') {
    const boat = boatsById.get(state.boatId);
    return boat && liveBoatIds.has(boat.id) ? `${boatIdentity(boat)} — Command Center` : 'Boat not active';
  }
  const label = ROUTES.find(([route]) => route === state.route)?.[1] || 'Overview';
  return `${label} — Catamaran Command Center`;
}

function nav() {
  return `<nav class="primary-nav" aria-label="Dashboard views">
    ${ROUTES.map(([route, label]) => `<a href="#${route}" class="nav-link ${state.route === route ? 'active' : ''}" ${state.route === route ? 'aria-current="page"' : ''}>${label}${route === 'compare' && state.selected.size ? `<span class="nav-count">${state.selected.size}</span>` : ''}</a>`).join('')}
  </nav>`;
}

function shell(content) {
  const updated = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(manifest.generated_at));
  return `<div class="app-shell">
    <a class="skip-link" href="#main-content">Skip to content</a>
    <header class="app-header">
      <a class="brand-lockup" href="#overview" aria-label="Catamaran Command Center overview">
        <span class="brand-mark" aria-hidden="true">CC</span>
        <span><strong>Catamaran Command Center</strong></span>
      </a>
      <div class="data-freshness" title="Canonical data is loaded directly from version-controlled JSON">
        <span class="freshness-dot" aria-hidden="true"></span>
        <span>${liveBoats.length} active boats · ${visibleConversations.length} interactions · updated ${updated}</span>
      </div>
    </header>
    ${nav()}
    <main id="main-content" tabindex="-1">${content}</main>
    ${compareTray()}
    <div class="sr-only" aria-live="polite" id="live-region">${esc(state.notice)}</div>
  </div>`;
}

function sectionHeading(title, description, action = '') {
  return `<div class="section-heading"><h1>${esc(title)}</h1>${description ? `<p>${esc(description)}</p>` : ''}${action}</div>`;
}

function statusBadge(boat, includeOwner = false) {
  const outreach = needsOutreach(boat);
  const status = outreach ? 'Needs outreach' : preciseStatus(boat);
  const tone = STATUS_TONE[outreach ? 'outreach' : boat.stage_bucket] || 'neutral';
  const owner = actionOwner(boat);
  const ownerAlreadyVisible = status.toLowerCase().includes(owner.split(' / ')[0].toLowerCase());
  return `<span class="status-badge ${tone}"><span aria-hidden="true"></span>${esc(status)}</span>${includeOwner && !ownerAlreadyVisible ? `<small class="action-owner">Next: ${esc(owner)}</small>` : ''}`;
}

function identity(boat, options = {}) {
  const length = deriveLength(boat.model);
  const year = boat.year ?? 'Year unknown';
  return `<div class="boat-identity ${options.compact ? 'compact' : ''}"><strong>${year} ${esc(boat.model)}${length ? ` <span>· ${length} ft</span>` : ''}</strong><small>${esc(boat.name)}${options.location ? ` · ${esc(boat.location)}` : ''}</small></div>`;
}

function planningMoney(value, currency, sourceDisplay = '') {
  if (!Number.isFinite(value)) return '<span class="data-missing" title="No normalized numeric value in canonical data">—</span>';
  return `<span class="money" title="${attr(sourceDisplay || money(value, currency))}">${compactMoney(value, currency)}</span>`;
}

function scoreChip(score, label = '') {
  const tone = score >= 9 ? 'excellent' : score >= 8 ? 'strong' : score >= 7 ? 'fair' : 'weak';
  return `<span class="score-chip ${tone}" title="Working priority score${label ? ` — ${attr(label)}` : ''}"><strong>${Number(score).toFixed(1)}</strong><small>/10</small></span>`;
}

function profileMini(profile) {
  const factors = [['P', 'Performance', profile.performance], ['O', 'Offshore', profile.offshore], ['C', 'Comfort', profile.comfort]];
  const aria = factors.map(([, label, value]) => `${label} ${value.toFixed(1)} out of 10`).join(', ');
  return `<span class="profile-mini" aria-label="${attr(`${profile.label}. ${aria}`)}" title="${attr(aria)}"><span class="profile-label">${esc(profile.label)}</span>${factors.map(([short, label, value]) => `<span class="profile-factor"><i title="${label}">${short}</i><b><em style="width:${value * 10}%"></em></b><strong>${value.toFixed(1)}</strong></span>`).join('')}</span>`;
}

function profileBars(profile) {
  const factors = [['Sailing performance', profile.performance], ['Offshore capability', profile.offshore], ['Liveaboard comfort', profile.comfort]];
  return `<div class="profile-detail"><div class="profile-detail-summary"><span>${esc(profile.label)}</span><strong>${esc(profile.passageSpeed)}</strong><small>Typical loaded passage planning range</small></div><div class="profile-bars">${factors.map(([label, value]) => `<div><span>${label}</span><b><i style="width:${value * 10}%"></i></b><strong>${value.toFixed(1)}</strong></div>`).join('')}</div><p>${esc(profile.note)}</p>${profile.source ? `<a href="${attr(profile.source)}" target="_blank" rel="noreferrer">Model evidence <span aria-hidden="true">↗</span></a>` : ''}</div>`;
}

function kpiStrip() {
  const active = liveBoats;
  const usd = active.filter((boat) => inferCurrency(boat) === 'USD');
  const serious = active.filter(isSeriousCandidate);
  const medianAsk = median(usd.map((boat) => economics(boat).ask));
  const medianAllIn = median(usd.map((boat) => economics(boat).allIn));
  const under350 = usd.filter((boat) => economics(boat).allIn <= 350000).length;
  const waiting = active.filter((boat) => boat.stage_bucket === 'waiting').length;
  const max = active.filter((boat) => boat.stage_bucket === 'max_decision').length;
  const todayReplies = visibleConversations.filter((event) => event.date === generatedDate).length;
  const metrics = [
    ['Serious candidates', serious.length, 'Tier A · score 9.5+'],
    ['Median USD ask', compactMoney(medianAsk), `${usd.filter((boat) => Number.isFinite(economics(boat).ask)).length} priced boats`],
    ['Median USD all-in', compactMoney(medianAllIn), 'Planning estimate'],
    ['Below $350k all-in', under350, 'USD · active'],
    ['Waiting on broker', waiting, 'External dependency'],
    ['Waiting on Max', max, 'Decision required'],
    ['Replies today', todayReplies, `As of ${generatedDate}`],
  ];
  return `<section class="kpi-strip" aria-label="Acquisition summary">${metrics.map(([label, value, note], index) => `<div class="kpi ${index === 5 && Number(value) ? 'decision-kpi' : ''}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></div>`).join('')}</section>`;
}

function marketScatter() {
  const candidates = liveBoats.filter((boat) => Number.isFinite(boat.year) && Number.isFinite(economics(boat).allIn));
  const width = 760;
  const height = 282;
  const inset = { left: 46, right: 19, top: 17, bottom: 38 };
  const costs = candidates.map((boat) => economics(boat).allIn);
  const years = candidates.map((boat) => boat.year);
  const xMin = Math.floor(Math.min(...costs) / 50000) * 50000;
  const xMax = Math.ceil(Math.max(...costs) / 50000) * 50000;
  const yMin = Math.floor(Math.min(...years) / 5) * 5;
  const yMax = Math.ceil(Math.max(...years) / 5) * 5;
  const x = (value) => inset.left + ((value - xMin) / (xMax - xMin || 1)) * (width - inset.left - inset.right);
  const y = (value) => height - inset.bottom - ((value - yMin) / (yMax - yMin || 1)) * (height - inset.top - inset.bottom);
  const xTicks = Array.from({ length: 5 }, (_, index) => xMin + ((xMax - xMin) * index) / 4);
  const yTicks = Array.from({ length: 5 }, (_, index) => Math.round(yMin + ((yMax - yMin) * index) / 4));
  const plots = candidates.map((boat) => {
    const econ = economics(boat);
    const px = x(econ.allIn);
    const py = y(boat.year);
    const radius = 5.5 + Math.max(0, (econ.length || 40) - 40) * .42;
    const tone = boat.score >= 9 ? 'top' : boat.score >= 8 ? 'strong' : 'base';
    const horizontal = px > width - 250 ? 'align-left' : 'align-right';
    const vertical = py < 126 ? 'below' : 'above';
    const label = `${boatIdentity(boat)}. Ask ${compactMoney(econ.ask)}. Refit ${compactMoney(econ.refit)}. Estimated all-in ${compactMoney(econ.allIn)}. Working score ${boat.score.toFixed(1)}.`;
    return {
      point: `<g class="scatter-point ${tone}" transform="translate(${px.toFixed(1)} ${py.toFixed(1)})" data-boat="${boat.id}" data-viz-key="${boat.id}" tabindex="0" role="button" aria-label="${attr(label)}"><circle r="${radius}"></circle></g>`,
      tooltip: `<div class="viz-float ${horizontal} ${vertical}" data-viz-tip="${boat.id}" style="--viz-x:${((px / width) * 100).toFixed(2)}%;--viz-y:${((py / height) * 100).toFixed(2)}%"><div class="viz-card"><strong>${boat.year} ${esc(boat.model)}</strong><span>${econ.length ? `${econ.length} ft` : 'Length unknown'} · priority ${boat.score.toFixed(1)}</span><div><small>Ask<b>${compactMoney(econ.ask)}</b></small><small>Refit<b>${compactMoney(econ.refit)}</b></small><small>All-in<b>${compactMoney(econ.allIn)}</b></small></div></div></div>`,
    };
  });
  return `<div class="chart-wrap"><div class="scatter-stage"><svg class="scatter" viewBox="0 0 ${width} ${height}" role="group" aria-label="Age, size and total cost" aria-describedby="scatter-desc">
    <desc id="scatter-desc">Boats farther left cost less, boats higher up are newer, larger circles represent longer boats, and darker circles have higher working scores. Focus a circle for boat details.</desc>
    ${yTicks.map((tick) => `<g><line class="grid-line" x1="${inset.left}" x2="${width - inset.right}" y1="${y(tick)}" y2="${y(tick)}"/><text class="axis-label" x="${inset.left - 9}" y="${y(tick) + 4}" text-anchor="end">${tick}</text></g>`).join('')}
    ${xTicks.map((tick) => `<g><line class="grid-line vertical" x1="${x(tick)}" x2="${x(tick)}" y1="${inset.top}" y2="${height - inset.bottom}"/><text class="axis-label" x="${x(tick)}" y="${height - 18}" text-anchor="middle">${compactMoney(tick)}</text></g>`).join('')}
    <text class="axis-title" x="${width / 2}" y="${height - 2}" text-anchor="middle">Estimated all-in cost</text>
    ${plots.map(({ point }) => point).join('')}
  </svg><div class="viz-layer">${plots.map(({ tooltip }) => tooltip).join('')}</div></div><div class="chart-legend"><span><i class="dot top"></i>9+ score</span><span><i class="dot strong"></i>8–8.9</span><span><i class="dot"></i>Below 8</span><span><i class="bubble-key"></i>Size = length</span></div></div>`;
}

function cleanNextStep(value = '') {
  return String(value)
    .replace(/^(?:your decision|max decides?|decision|next action|no action)(?:\s*:)?\s*/i, '')
    .replace(/\b(?:your decision|max decides?|next action|no action)\s*:\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function attentionQueue() {
  const all = liveBoats.filter((boat) => boat.stage_bucket === 'max_decision').sort((a, b) => b.score - a.score);
  const list = all.slice(0, 5);
  return `<section class="surface attention-panel"><div class="panel-heading"><div><h2>Waiting on Max <span class="panel-count">${all.length}</span></h2></div><a href="#pipeline">See all</a></div><div class="attention-list">${list.map((boat) => {
    const latest = latestConversation(boat.id, visibleConversations);
    return `<button class="attention-row" data-boat="${boat.id}"><span class="attention-main">${identity(boat, { compact: true })}</span><span class="attention-copy"><strong>${esc(truncate(cleanNextStep(boat.next_step), 105))}</strong>${latest ? `<small>Reply ${relativeDate(latest.date, generatedDate)} · ${esc(truncate(latest.facts, 78))}</small>` : ''}</span><span class="arrow" aria-hidden="true">→</span></button>`;
  }).join('')}</div></section>`;
}

function presetButtons() {
  const presets = [
    ['all', 'All active'], ['top', 'Top candidates'], ['under350', 'Under $350k all-in'], ['under400', 'Under $400k all-in'], ['44plus', '44 ft+'], ['new2018', '2018+'], ['waiting', 'Waiting on broker'], ['max', 'Waiting on Max'], ['outreach', 'Needs outreach'],
  ];
  return `<div class="preset-row" aria-label="Quick filters">${presets.map(([value, label]) => `<button data-preset="${value}" class="filter-chip ${state.preset === value ? 'active' : ''}" aria-pressed="${state.preset === value}">${label}</button>`).join('')}</div>`;
}

function hasAdvancedFilters() {
  return ['brand', 'region', 'lengthMin', 'lengthMax', 'yearMin', 'yearMax', 'allInMax', 'scoreMin'].some((key) => state[key] && state[key] !== 'all');
}

function inventoryCandidates() {
  let candidates = liveBoats;
  if (state.mapBoatIds?.length) {
    const ids = new Set(state.mapBoatIds);
    candidates = candidates.filter((boat) => ids.has(boat.id));
  } else if (state.mapRegion !== 'all') {
    candidates = candidates.filter((boat) => regionFor(boat) === state.mapRegion);
  }
  if (state.preset === 'outreach') candidates = candidates.filter(needsOutreach);
  return candidates;
}

function inventoryControls(baseBoats) {
  const brands = [...new Set(liveBoats.map((boat) => deriveBrand(boat.model)))].sort();
  const resultCount = filterBoats(baseBoats, state).length;
  return `<div class="inventory-controls">${presetButtons()}<div class="filter-bar">
    <label class="search-field"><span class="sr-only">Search boats</span><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m14.5 14.5 3 3m-1.4-8a6.6 6.6 0 1 1-13.2 0 6.6 6.6 0 0 1 13.2 0Z"/></svg><input id="q" type="search" value="${attr(state.q)}" placeholder="Search model, location, broker, risk…"></label>
    <label><span class="sr-only">Conversation state</span><select id="stage"><option value="all">All states</option>${Object.entries(STAGE_LABELS).filter(([value]) => !['other', 'closed'].includes(value)).map(([value, label]) => `<option value="${value}" ${state.stage === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
    <label><span class="sr-only">Priority tier</span><select id="tier"><option value="all">All tiers</option>${['A', 'B', 'C', 'D'].map((tier) => `<option value="${tier}" ${state.tier === tier ? 'selected' : ''}>Tier ${tier}</option>`).join('')}</select></label>
    <details class="advanced-filter" ${hasAdvancedFilters() ? 'open' : ''}><summary>More filters${hasAdvancedFilters() ? '<i></i>' : ''}</summary><div class="advanced-grid">
      <label>Brand<select id="brand"><option value="all">All brands</option>${brands.map((brand) => `<option value="${attr(brand)}" ${state.brand === brand ? 'selected' : ''}>${esc(brand)}</option>`).join('')}</select></label>
      <label>Region<select id="region"><option value="all">All regions</option>${['Caribbean', 'Continental US', 'Mediterranean', 'Other'].map((region) => `<option value="${region}" ${state.region === region ? 'selected' : ''}>${region}</option>`).join('')}</select></label>
      <label>Min length<input id="lengthMin" inputmode="numeric" type="number" min="35" max="60" value="${attr(state.lengthMin)}" placeholder="ft"></label><label>Max length<input id="lengthMax" inputmode="numeric" type="number" min="35" max="60" value="${attr(state.lengthMax)}" placeholder="ft"></label>
      <label>Earliest year<input id="yearMin" inputmode="numeric" type="number" min="1990" max="2030" value="${attr(state.yearMin)}" placeholder="2015"></label><label>Max all-in<input id="allInMax" inputmode="numeric" type="number" min="0" step="10000" value="${attr(state.allInMax)}" placeholder="400000"></label>
      <label>Min score<input id="scoreMin" inputmode="decimal" type="number" min="0" max="10" step=".1" value="${attr(state.scoreMin)}" placeholder="8.5"></label><button class="text-button" data-reset-filters>Reset filters</button>
    </div></details><span class="result-count">${resultCount} result${resultCount === 1 ? '' : 's'}</span>
  </div></div>`;
}

function sortHeader(key, label, align = '') {
  const active = state.sortKey === key;
  const ariaSort = active ? (state.sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
  return `<th class="${align}" aria-sort="${ariaSort}"><button data-sort="${key}">${label}<span aria-hidden="true">${active ? (state.sortDir === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>`;
}

function tableCostBar(boat) {
  const econ = economics(boat);
  const parts = costComposition(boat);
  if (!parts) return '<span class="data-missing">Estimate incomplete</span>';
  const purchaseWidth = (parts.purchase / parts.allIn) * 100;
  const refitWidth = (parts.refit / parts.allIn) * 100;
  const otherWidth = (parts.other / parts.allIn) * 100;
  const purchaseLabel = `${compactMoney(parts.purchase, econ.currency)} ${parts.assumedDiscount > 1000 ? 'buy basis' : 'purchase'}`;
  const labels = [purchaseLabel, `${compactMoney(parts.refit, econ.refitCurrency)} refit`];
  if (parts.other > 1000) labels.push(`${compactMoney(parts.other, econ.currency)} tax / closing / reserve`);
  const discount = parts.assumedDiscount > 1000 ? ` Current ask is ${compactMoney(parts.ask, econ.currency)}; the all-in estimate assumes about ${compactMoney(parts.assumedDiscount, econ.currency)} of negotiation.` : '';
  const explanation = `Estimated all-in composition: ${labels.join(', ')}.${discount} Source estimate: ${boat.all_in_display}`;
  return `<span class="table-cost" title="${attr(explanation)}"><span class="table-cost-track" aria-label="${attr(explanation)}"><i class="ask" style="width:${purchaseWidth}%"></i><i class="refit" style="width:${refitWidth}%"></i><i class="other" style="width:${otherWidth}%"></i></span><small><span>${compactMoney(parts.purchase, econ.currency)}${parts.assumedDiscount > 1000 ? ' basis' : ''}</span><span>+ ${compactMoney(parts.refit, econ.refitCurrency)}</span>${parts.other > 1000 ? `<span>+ ${compactMoney(parts.other, econ.currency)}</span>` : ''}</small></span>`;
}

function boatTable(list) {
  const sorted = sortBoats(list, state.sortKey, state.sortDir);
  if (!sorted.length) return '<div class="empty-state"><strong>No boats match these filters</strong><p>Clear a preset or widen the numeric range.</p><button class="button" data-reset-filters>Reset filters</button></div>';
  return `<div class="table-scroll"><table class="boat-table"><colgroup><col class="col-select"><col class="col-boat"><col class="col-cost"><col class="col-all-in"><col class="col-per-foot"><col class="col-priority"><col class="col-profile"><col class="col-location"><col class="col-diligence"><col class="col-risk"><col class="col-reply"></colgroup><thead><tr><th class="select-column"><span class="sr-only">Select</span></th>${sortHeader('boat', 'Boat')}${sortHeader('ask', 'All-in composition')}${sortHeader('allIn', 'Est. all-in', 'number')}${sortHeader('allInPerFoot', 'All-in / ft', 'number')}${sortHeader('score', 'Priority', 'number')}<th>Design profile</th>${sortHeader('location', 'Location')}${sortHeader('status', 'Diligence') }<th>Major risk</th>${sortHeader('lastReply', 'Last reply')}</tr></thead><tbody>${sorted.map((boat) => {
    const econ = economics(boat);
    const sailing = sailingProfile(boat.model);
    const latest = latestConversation(boat.id, visibleConversations);
    const structural = dealBreakerRisk(boat);
    const selected = state.selected.has(boat.id);
    return `<tr class="boat-row ${selected ? 'selected' : ''}" data-boat="${boat.id}" tabindex="0">
      <td class="select-column" data-label="Select"><label class="check-control" title="Add to comparison"><input type="checkbox" data-select="${boat.id}" ${selected ? 'checked' : ''} aria-label="Compare ${attr(boatIdentity(boat))}"><span></span></label></td><td data-label="Boat">${identity(boat)}</td>
      <td data-label="All-in composition">${tableCostBar(boat)}</td><td class="number all-in-cell" data-label="Est. all-in">${planningMoney(econ.allIn, econ.currency, boat.all_in_display)}</td><td class="number" data-label="All-in / ft"><span class="per-foot">${Number.isFinite(econ.allInPerFoot) ? `${money(Math.round(econ.allInPerFoot), econ.currency)}<small>/ft</small>` : '—'}</span></td>
      <td class="number" data-label="Priority">${scoreChip(boat.score)}</td><td data-label="Design profile">${profileMini(sailing)}</td>
      <td data-label="Location"><span class="location-cell">${esc(boat.location)}</span><small class="cell-note">${regionFor(boat)}</small></td><td data-label="Diligence">${statusBadge(boat, true)}</td><td data-label="Major risk">${structural ? `<span class="critical-risk" title="${attr(structural.text)}"><i aria-hidden="true"></i>${esc(truncate(structural.text, 74))}</span>` : '<span class="data-missing">—</span>'}</td>
      <td data-label="Last reply"><span class="reply-date">${relativeDate(boat.last_heard_from, generatedDate)}</span>${latest ? `<small class="reply-preview" title="${attr(latest.facts)}">${esc(truncate(latest.facts, 68))}</small>` : '<small class="cell-note">No linked reply</small>'}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function inventorySection() {
  const candidates = inventoryCandidates();
  const filtered = filterBoats(candidates, state);
  return `<section class="surface inventory-surface"><div class="panel-heading inventory-heading"><div><h2>Fleet <span class="panel-count">${filtered.length}</span></h2></div></div>${inventoryControls(candidates)}${boatTable(filtered)}</section>`;
}

function overview() {
  return `${kpiStrip()}<div class="overview-grid"><section class="surface chart-surface"><div class="panel-heading"><div><h2>Age, size & total cost</h2></div></div>${marketScatter()}</section>${attentionQueue()}</div>${geographyMap(liveBoats)}${inventorySection()}`;
}

function pipeline() {
  const order = ['max_decision', 'diligence', 'waiting', 'outreach', 'watch'];
  const grouped = groupBy(liveBoats, (boat) => needsOutreach(boat) ? 'outreach' : boat.stage_bucket);
  return `${sectionHeading('Pipeline', `${liveBoats.length} active boats · organized by what happens next`)}<div class="pipeline-board">${order.map((bucket) => {
    const list = (grouped[bucket] || []).slice().sort((a, b) => b.score - a.score);
    return `<section class="pipeline-column"><header><span class="status-badge ${STATUS_TONE[bucket] || 'neutral'}"><span></span>${esc(PIPELINE_LABELS[bucket])}</span><strong>${list.length}</strong></header><div class="pipeline-cards">${list.map((boat) => {
      const latest = latestConversation(boat.id, visibleConversations);
      const econ = economics(boat);
      return `<button class="pipeline-card" data-boat="${boat.id}">${identity(boat, { compact: true })}<div class="pipeline-econ"><strong>${planningMoney(econ.ask, econ.currency, boat.ask_display)}</strong>${scoreChip(boat.score)}</div><p class="pipeline-next">${esc(truncate(cleanNextStep(boat.next_step), 112))}</p>${latest ? `<p class="mini-reply">Reply ${relativeDate(latest.date, generatedDate)} · ${esc(truncate(latest.facts, 82))}</p>` : ''}</button>`;
    }).join('')}</div></section>`;
  }).join('')}</div>`;
}

function directionFor(event) {
  return /max|anthony|me\b/i.test(event.sender || '') ? { label: 'Sent', tone: 'outbound' } : { label: 'Received', tone: 'inbound' };
}

function mailIcon(tone) {
  if (tone === 'outbound') return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m3 9 14-6-5 14-2.5-5L5 10l5-2.5"/></svg>';
  return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4.5h12v11H4zM4 11h3l1.5 2h3l1.5-2h3"/></svg>';
}

function correspondenceCard(event) {
  const boat = event.boat_id ? boatsById.get(event.boat_id) : null;
  const direction = directionFor(event);
  const impact = conversationImpact(event);
  const impactLabel = impact === 'positive' ? 'Improved' : impact === 'negative' ? 'Hurt' : 'Neutral';
  const boatLabel = boat ? `${boat.year ?? ''} ${boat.model}`.trim() : event.thread_label;
  return `<article class="mail-row ${direction.tone}"><div class="mail-kind">${mailIcon(direction.tone)}<span><strong>${direction.label}</strong><time datetime="${event.date}">${relativeDate(event.date, generatedDate)}</time></span></div><div class="mail-content"><header>${boat ? `<button class="mail-boat" data-boat="${boat.id}">${esc(boatLabel)}</button>` : `<strong class="mail-boat">${esc(boatLabel)}</strong>`}<span class="priority ${event.priority?.toLowerCase()}">${esc(event.priority)}</span></header><p title="${attr(event.facts)}">${esc(truncate(event.facts, 190))}</p><small>${esc(event.sender)} · ${esc(event.subject)}</small></div><div class="mail-decision"><div><span class="impact ${impact}">${impactLabel}</span><strong>${boat ? esc(actionOwner(boat)) : 'Research'}</strong></div><p title="${attr(`${event.triage} ${event.next_action}`)}">${esc(truncate(cleanNextStep(event.next_action), 135))}</p></div>${event.gmail_url ? `<a class="mail-open" target="_blank" rel="noreferrer" href="${attr(event.gmail_url)}" aria-label="Open ${attr(boatLabel)} email in Gmail">Open <span aria-hidden="true">↗</span></a>` : '<span class="mail-open disabled">No link</span>'}</article>`;
}

function conversationsView() {
  const dated = visibleConversations.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const contacted = new Set(liveBoats.filter((boat) => boat.last_reached_out && boat.last_reached_out !== '—').map((boat) => boat.id)).size;
  const responded = new Set(visibleConversations.filter((event) => event.boat_id && directionFor(event).tone === 'inbound').map((event) => event.boat_id)).size;
  const needingReview = liveBoats.filter((boat) => boat.stage_bucket === 'diligence').length;
  return `${sectionHeading('Correspondence', '')}<section class="conversation-stats"><div><span>Contacted</span><strong>${contacted}</strong></div><div><span>Replied</span><strong>${responded}</strong></div><div><span>Needs review</span><strong>${needingReview}</strong></div></section><section class="surface correspondence-surface"><div class="mail-list">${dated.map(correspondenceCard).join('')}</div></section>`;
}

function geographyMap(list) {
  const width = 1120;
  const height = 300;
  const bounds = { west: -105, east: 38, north: 55, south: 5 };
  const project = ({ lat, lon }) => ({
    x: ((lon - bounds.west) / (bounds.east - bounds.west)) * width,
    y: ((bounds.north - lat) / (bounds.north - bounds.south)) * height,
  });
  const landMasses = [
    [[-105, 55], [-56, 55], [-58, 51], [-64, 47], [-69, 44], [-73, 41], [-76, 36], [-80, 30], [-80, 25], [-82, 24], [-84, 29], [-91, 29], [-97, 26], [-105, 29]],
    [[-105, 27], [-97, 25], [-92, 20], [-87, 16], [-83, 9], [-77, 8], [-80, 13], [-85, 17], [-91, 19], [-99, 23]],
    [[-82, 12], [-75, 11], [-69, 12], [-61, 10], [-52, 5], [-82, 5]],
    [[-12, 55], [38, 55], [38, 35], [33, 35], [26, 38], [19, 40], [15, 43], [9, 44], [3, 43], [-1, 45], [-8, 44], [-10, 50]],
    [[-17, 36], [-5, 35], [10, 37], [28, 33], [38, 31], [38, 5], [-17, 5], [-16, 17], [-17, 27]],
  ];
  const pathFor = (points) => `${points.map(([lon, lat], index) => { const point = project({ lat, lon }); return `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`; }).join('')}Z`;
  const shortPlace = (locations) => {
    const value = [...locations].join(' ').toLowerCase();
    if (/grenada|saint george|st\. george|port louis|saint david/.test(value) && /trinidad|chaguaramas/.test(value)) return 'Southern Caribbean';
    if (/bvi|tortola|virgin gorda|road town|hodge creek/.test(value) && /usvi|st\.? thomas|st\.? john|cruz bay/.test(value)) return 'Virgin Islands';
    if (/fort lauderdale|dania beach|riviera beach|daytona|st\.? augustine/.test(value) && [...locations].length > 1) return 'Florida';
    if (/bvi|tortola|virgin gorda|road town|hodge creek/.test(value)) return 'BVI';
    if (/grenada|saint george|st\. george|port louis|saint david/.test(value)) return 'Grenada';
    if (/fort lauderdale|dania beach/.test(value)) return 'Fort Lauderdale';
    if (/st\.? augustine/.test(value)) return 'St. Augustine';
    if (/martinique|le marin/.test(value)) return 'Martinique';
    if (/puerto rico|fajardo/.test(value)) return 'Puerto Rico';
    if (/cura[cç]ao|willemstad/.test(value)) return 'Curaçao';
    return [...locations][0].replace(/,.*$/, '');
  };
  const markerGroups = new Map();
  for (const boat of list) {
    const coordinates = locationCoordinates(boat.location);
    if (!coordinates) continue;
    const key = `${coordinates.lat.toFixed(1)},${coordinates.lon.toFixed(1)}`;
    if (!markerGroups.has(key)) markerGroups.set(key, { coordinates, boats: [], locations: new Set() });
    const group = markerGroups.get(key);
    group.boats.push(boat);
    group.locations.add(boat.location);
  }
  const markers = [];
  for (const group of markerGroups.values()) {
    const point = project(group.coordinates);
    const nearby = markers.find((candidate) => {
      const candidatePoint = project(candidate.coordinates);
      return regionFor(candidate.boats[0]) === regionFor(group.boats[0])
        && Math.hypot(candidatePoint.x - point.x, candidatePoint.y - point.y) < 18;
    });
    if (nearby) {
      const existingCount = nearby.boats.length;
      const addedCount = group.boats.length;
      nearby.coordinates = {
        lat: ((nearby.coordinates.lat * existingCount) + (group.coordinates.lat * addedCount)) / (existingCount + addedCount),
        lon: ((nearby.coordinates.lon * existingCount) + (group.coordinates.lon * addedCount)) / (existingCount + addedCount),
      };
      nearby.boats.push(...group.boats);
      group.locations.forEach((location) => nearby.locations.add(location));
    } else {
      markers.push({ ...group, boats: [...group.boats], locations: new Set(group.locations) });
    }
  }
  markers.forEach((group) => group.boats.sort((a, b) => b.score - a.score));
  const regions = Object.entries(groupBy(list, regionFor)).sort((a, b) => b[1].length - a[1].length);
  return `<section class="surface geo-map-surface"><div class="panel-heading"><div><h2>Locations</h2></div><div class="map-region-summary">${regions.map(([region, boatsInRegion]) => `<button data-map-region="${attr(region)}" class="${state.mapRegion === region ? 'active' : ''}" aria-pressed="${state.mapRegion === region}"><strong>${boatsInRegion.length}</strong> ${esc(region)}</button>`).join('')}${state.mapLabel ? `<button class="map-clear" data-clear-map>${esc(state.mapLabel)} <span aria-hidden="true">×</span></button>` : ''}</div></div><div class="geo-map-wrap"><svg class="geo-map" viewBox="0 0 ${width} ${height}" role="group" aria-label="Active catamaran locations across the Atlantic, Caribbean and Mediterranean" aria-describedby="geo-map-desc"><desc id="geo-map-desc">Approximate location markers sized by the number of active tracked boats. Select a marker or region to filter the fleet table.</desc>
    ${[-90, -60, -30, 0, 30].map((lon) => { const point = project({ lat: bounds.south, lon }); return `<line class="map-grid" x1="${point.x}" x2="${point.x}" y1="0" y2="${height}"/>`; }).join('')}
    ${[10, 20, 30, 40, 50].map((lat) => { const point = project({ lat, lon: bounds.west }); return `<line class="map-grid" x1="0" x2="${width}" y1="${point.y}" y2="${point.y}"/>`; }).join('')}
    ${landMasses.map((points) => `<path class="map-land" d="${pathFor(points)}"/>`).join('')}
    ${markers.map((group) => {
      const point = project(group.coordinates);
      const count = group.boats.length;
      const radius = Math.min(15, 5.5 + Math.sqrt(count) * 2.2);
      const place = shortPlace(group.locations);
      const top = group.boats[0];
      const econ = economics(top);
      const tooltipX = point.x > width - 252 ? -246 : radius + 8;
      const tooltipY = point.y < 124 ? 8 : -118;
      const label = `${place}: ${count} active boat${count === 1 ? '' : 's'}. Filter the fleet to this location.`;
      const selected = state.mapBoatIds?.some((id) => group.boats.some((boat) => boat.id === id));
      return `<g class="map-marker ${selected ? 'selected' : ''}" transform="translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})" data-map-boats="${group.boats.map((boat) => boat.id).join(',')}" data-map-label="${attr(place)}" tabindex="0" role="button" aria-label="${attr(label)}"><circle r="${radius}"></circle>${count > 1 ? `<text class="map-marker-count" text-anchor="middle" y="3">${count}</text>` : ''}<foreignObject class="viz-tooltip" x="${tooltipX}" y="${tooltipY}" width="238" height="111"><div xmlns="http://www.w3.org/1999/xhtml" class="viz-card map-viz-card"><strong>${esc(place)}</strong><span>${count} active boat${count === 1 ? '' : 's'} · top candidate</span><div><small>${top.year} ${esc(top.model)}<b>${econ.length ? `${econ.length} ft` : '—'}</b></small><small>All-in<b>${compactMoney(econ.allIn)}</b></small><small>Priority<b>${top.score.toFixed(1)}</b></small></div></div></foreignObject></g>`;
    }).join('')}
  </svg></div><p class="map-note">Select a marker or region to filter the fleet · approximate marina areas, not live vessel positions.</p></section>`;
}

function layoutSummary(boat) {
  const text = `${boat.why} ${boat.risks} ${boat.notes}`;
  const owner = text.match(/(?:true |dedicated )?owner.?s? (?:version|layout|suite)/i);
  const cabins = text.match(/([3-6])[- ]cabin/i);
  return owner ? 'Owner layout noted' : cabins ? `${cabins[1]}-cabin noted` : 'Not normalized';
}

function extractSystemFact(boat, expression) {
  const text = `${boat.why}. ${boat.risks}. ${boat.notes}`;
  const fragments = text.split(/[.;]|,\s+/).map((item) => item.trim()).filter(Boolean);
  return truncate(fragments.find((fragment) => expression.test(fragment)) || 'Not documented', 116);
}

function comparisonBoats() {
  if (state.selected.size) return [...state.selected].map((id) => boatsById.get(id)).filter((boat) => boat && liveBoatIds.has(boat.id)).slice(0, 4);
  return priorityBoats(liveBoats, 3);
}

function compareValueCell(value, row, values, index, comparable = true) {
  let className = '';
  if (row.numeric && comparable) {
    const numericValues = values.filter(Number.isFinite);
    const target = row.direction === 'low' ? Math.min(...numericValues) : Math.max(...numericValues);
    if (Number.isFinite(value) && value === target && numericValues.some((item) => item !== target)) className = 'best-value';
  } else if (new Set(values.map(String)).size > 1) className = 'varied-value';
  return `<td class="${className}">${row.render ? row.render(value, index) : esc(value ?? '—')}</td>`;
}

function compareMatrix(list) {
  const rows = [
    { label: 'Model year', get: (boat) => boat.year, numeric: true, direction: 'high' },
    { label: 'Length', get: (boat) => deriveLength(boat.model), numeric: true, direction: 'high', render: (value) => value ? `${value} ft` : '—' },
    { label: 'Asking price', get: (boat) => economics(boat).ask, numeric: true, direction: 'low', currencyAware: true, render: (value, index) => planningMoney(value, economics(list[index]).currency, list[index].ask_display) },
    { label: 'Immediate refit', get: (boat) => economics(boat).refit, numeric: true, direction: 'low', currencyAware: 'refit', render: (value, index) => `<span title="${attr(list[index].refit_display)}">${planningMoney(value, economics(list[index]).refitCurrency)}</span>` },
    { label: 'Estimated all-in', get: (boat) => economics(boat).allIn, numeric: true, direction: 'low', currencyAware: true, render: (value, index) => `<strong>${planningMoney(value, economics(list[index]).currency, list[index].all_in_display)}</strong>` },
    { label: 'All-in / foot', get: (boat) => economics(boat).allInPerFoot, numeric: true, direction: 'low', currencyAware: true, render: (value, index) => Number.isFinite(value) ? `${money(Math.round(value), economics(list[index]).currency)}/ft` : '—' },
    { label: 'Working score', get: (boat) => boat.score, numeric: true, direction: 'high', render: (value) => scoreChip(value) },
    { label: 'Sailing performance', get: (boat) => sailingProfile(boat.model).performance, numeric: true, direction: 'high', render: (value) => `<span class="compare-profile-score"><i style="width:${value * 10}%"></i><strong>${value.toFixed(1)}</strong></span>` },
    { label: 'Offshore capability', get: (boat) => sailingProfile(boat.model).offshore, numeric: true, direction: 'high', render: (value) => `<span class="compare-profile-score"><i style="width:${value * 10}%"></i><strong>${value.toFixed(1)}</strong></span>` },
    { label: 'Liveaboard comfort', get: (boat) => sailingProfile(boat.model).comfort, numeric: true, direction: 'high', render: (value) => `<span class="compare-profile-score"><i style="width:${value * 10}%"></i><strong>${value.toFixed(1)}</strong></span>` },
    { label: 'Modeled passage range', get: (boat) => sailingProfile(boat.model).passageSpeed, render: (value, index) => `<strong>${esc(value)}</strong><small class="matrix-note">${esc(sailingProfile(list[index].model).label)}</small>` },
    { label: 'Location', get: (boat) => boat.location }, { label: 'Layout', get: layoutSummary },
    { label: 'Engines / drives', get: (boat) => extractSystemFact(boat, /engine|saildrive|repower/i) }, { label: 'Rig / sails', get: (boat) => extractSystemFact(boat, /rig|shroud|forestay|sail|genoa|main/i) },
    { label: 'Lithium / solar', get: (boat) => extractSystemFact(boat, /lithium|lifepo4|battery|solar/i) }, { label: 'Generator / A/C', get: (boat) => extractSystemFact(boat, /generator|genset|a\/c|air.condition/i) },
    { label: 'Watermaker', get: (boat) => readinessMatrix(boat).find((item) => item.label === 'Watermaker')?.status || 'unknown', render: (value) => `<span class="readiness-status ${value}">${value}</span>` },
    { label: 'Biggest risk', get: (boat) => biggestRisk(boat, 160) }, { label: 'Diligence state', get: preciseStatus, render: (_, index) => statusBadge(list[index], true) },
    { label: 'Last meaningful reply', get: (boat) => latestConversation(boat.id, visibleConversations)?.facts || 'No linked reply', render: (value, index) => `<span>${esc(truncate(value, 150))}</span><small class="matrix-note">${relativeDate(list[index].last_heard_from, generatedDate)}</small>` }, { label: 'Next action', get: (boat) => cleanNextStep(boat.next_step) },
  ];
  return `<div class="compare-scroll"><table class="compare-table"><thead><tr><th>Decision factor</th>${list.map((boat) => `<th><button class="plain-link" data-boat="${boat.id}">${identity(boat, { compact: true })}</button><span class="compare-header-meta">${statusBadge(boat)}</span>${state.selected.has(boat.id) ? `<button class="remove-compare" data-select="${boat.id}" aria-label="Remove ${attr(boatIdentity(boat))} from comparison">×</button>` : ''}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => { const values = list.map(row.get); const currencies = row.currencyAware ? new Set(list.map((boat) => row.currencyAware === 'refit' ? economics(boat).refitCurrency : inferCurrency(boat)).filter(Boolean)) : new Set(); const comparable = !row.currencyAware || currencies.size <= 1; return `<tr><th>${row.label}${row.currencyAware && !comparable ? '<small class="matrix-note">FX not normalized</small>' : ''}</th>${values.map((value, index) => compareValueCell(value, row, values, index, comparable)).join('')}</tr>`; }).join('')}</tbody></table></div>`;
}

function compareView() {
  const list = comparisonBoats();
  const candidatePicker = priorityBoats(liveBoats, 14);
  return `${sectionHeading('Compare', state.selected.size ? `${state.selected.size} boats selected · best comparable values are highlighted` : 'Suggested top three · select up to four boats to replace them')}<section class="surface compare-picker"><div class="panel-heading"><div><h2>Shortlist</h2></div>${state.selected.size ? '<button class="text-button" data-clear-selection>Clear selection</button>' : ''}</div><div class="picker-row">${candidatePicker.map((boat) => `<label class="picker-chip ${state.selected.has(boat.id) ? 'selected' : ''}"><input type="checkbox" data-select="${boat.id}" ${state.selected.has(boat.id) ? 'checked' : ''}><span>${boat.year} ${esc(boat.model)}<small>${boat.score.toFixed(1)} priority · ${compactMoney(economics(boat).allIn)} all-in</small></span></label>`).join('')}</div></section><section class="surface compare-matrix-surface">${compareMatrix(list)}<p class="method-note">${esc(sailingMethodology)}</p></section>`;
}

function readinessPanel(boat) {
  const items = readinessMatrix(boat);
  const labels = { ready: 'Documented', watch: 'Verify', missing: 'Missing', unknown: 'Unknown' };
  const patterns = {
    Solar: /solar/i, Lithium: /lithium|lifepo4|dragonfly|epoch|battery/i, Inverter: /inverter|multiplus|quattro|victron/i,
    Generator: /generator|genset|onan|fischer panda/i, 'A/C': /a\/c|air.condition|frigomar/i, Watermaker: /watermaker|rainman/i,
    Rig: /rig|shroud|forestay|chainplate/i, Sails: /sail|genoa|mainsail|main\b/i, Propulsion: /engine|saildrive|repower/i, Connectivity: /starlink|iridium|network/i,
  };
  return `<div class="coverage-table" role="table" aria-label="Off-grid and offshore systems"><div class="coverage-head" role="row"><span role="columnheader">System</span><span role="columnheader">State</span><span role="columnheader">Evidence</span></div>${items.map((item) => `<div class="coverage-row" role="row"><strong role="cell">${item.label}</strong><span role="cell"><i class="readiness-status ${item.status}">${labels[item.status]}</i></span><p role="cell">${esc(extractSystemFact(boat, patterns[item.label]))}</p></div>`).join('')}</div>`;
}

function riskPanel(boat) {
  const items = riskItems(boat);
  if (!items.length) return '<div class="empty-state compact"><strong>No structured risks found</strong><p>Review the canonical notes before treating that as a clean bill of health.</p></div>';
  return `<div class="risk-detail-list">${items.map((risk) => `<div><span class="risk-kind ${risk.kind}">${risk.label}</span><p>${esc(risk.text)}</p><small class="risk-severity ${risk.severity}">${risk.severity}</small></div>`).join('')}</div>`;
}

function detailMetricStrip(boat) {
  const econ = economics(boat);
  const valueRank = relativeValueRank(boat, boats);
  const mixedCurrencies = econ.currency && econ.refitCurrency && econ.currency !== econ.refitCurrency;
  const sailing = sailingProfile(boat.model);
  const allInNotes = [
    econ.allInPerFoot ? `${money(Math.round(econ.allInPerFoot), econ.currency)}/ft` : '',
    valueRank ? `value #${valueRank.rank}/${valueRank.total}` : '',
  ].filter(Boolean).join(' · ');
  const metrics = [
    ['Asking', planningMoney(econ.ask, econ.currency, boat.ask_display), boat.ask_display],
    ['Refit', planningMoney(econ.refit, econ.refitCurrency, boat.refit_display), econ.refitBurden ? `~${Math.round(econ.refitBurden * 100)}% of ask` : boat.refit_display],
    ['Est. all-in', planningMoney(econ.allIn, econ.currency, boat.all_in_display), allInNotes || boat.all_in_display, 'primary'],
    ['Priority', `<strong class="metric-score">${boat.score.toFixed(1)}</strong><span class="metric-denominator">/10</span>`, `Tier ${boat.tier}`],
    ['Passage range', `<strong class="metric-range">${esc(sailing.passageSpeed)}</strong>`, `${sailing.label} · performance ${sailing.performance.toFixed(1)}`],
  ];
  return `<section class="detail-metrics" aria-label="Boat economics and scores">${metrics.map(([label, value, note, className = '']) => `<div class="detail-metric ${className}"><span>${label}</span><div>${value}</div><small>${esc(note || '')}</small></div>`).join('')}${mixedCurrencies ? `<p class="detail-metrics-note">Refit is recorded in ${econ.refitCurrency}; ask and all-in are ${econ.currency}. No FX conversion is implied.</p>` : ''}</section>`;
}

function resourcePanel(events, sailing) {
  const threadKeys = new Set();
  const linked = events.filter((event) => {
    if (!event.gmail_url) return false;
    const key = String(event.subject || event.gmail_url).replace(/^(?:\s*(?:re|fw|fwd)\s*:\s*)+/i, '').trim().toLowerCase();
    if (threadKeys.has(key)) return false;
    threadKeys.add(key);
    return true;
  }).slice(0, 6);
  const resources = [
    ...linked.map((event) => ({ label: /survey|maintenance|report|certificate|document/i.test(`${event.subject} ${event.facts}`) ? 'Document thread' : 'Email', title: event.subject, meta: event.date, href: event.gmail_url })),
    ...(sailing.source ? [{ label: 'Model evidence', title: 'Design and passage source', meta: sailing.label, href: sailing.source }] : []),
  ];
  if (!resources.length) return '<div class="empty-state compact"><strong>No linked records</strong><p>Only the current listing is available above.</p></div>';
  return `<div class="resource-list">${resources.map((resource) => `<a href="${attr(resource.href)}" target="_blank" rel="noreferrer"><span class="resource-type">${esc(resource.label)}</span><span><strong>${esc(resource.title)}</strong><small>${esc(resource.meta)}</small></span><b aria-hidden="true">↗</b></a>`).join('')}</div>`;
}

function boatDetail() {
  const boat = boatsById.get(state.boatId);
  if (!boat || !liveBoatIds.has(boat.id)) return '<div class="empty-state page-empty"><strong>This deal is not active</strong><p>Closed, sold and under-contract records are intentionally excluded from the acquisition interface.</p><a class="button" href="#overview">Return to overview</a></div>';
  const econ = economics(boat);
  const events = (conversationsByBoat[boat.id] || []).slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const selected = state.selected.has(boat.id);
  const sailing = sailingProfile(boat.model);
  const bucket = needsOutreach(boat) ? 'outreach' : boat.stage_bucket;
  const actionLabel = PIPELINE_LABELS[bucket] || preciseStatus(boat);
  return `<div class="detail-page"><div class="detail-toolbar"><a href="#overview" class="back-link"><span aria-hidden="true">←</span> Overview</a><div class="detail-actions">${boat.listing_url ? `<a class="button primary listing-action" href="${attr(boat.listing_url)}" target="_blank" rel="noreferrer">View current listing <span aria-hidden="true">↗</span></a>` : '<span class="listing-missing">No listing link</span>'}<label class="compare-toggle"><input type="checkbox" data-select="${boat.id}" ${selected ? 'checked' : ''}><span>${selected ? 'Added to compare' : 'Add to compare'}</span></label></div></div><header class="detail-header"><div><h1>${boat.year ?? 'Year unknown'} ${esc(boat.model)}${econ.length ? ` <span>· ${econ.length} ft</span>` : ''}</h1><div class="detail-subline"><span>${esc(boat.name)}</span><span>${esc(boat.location)}</span>${statusBadge(boat)}</div></div></header>${detailMetricStrip(boat)}<section class="decision-strip"><strong>${esc(actionLabel)}</strong><span>${esc(cleanNextStep(boat.next_step))}</span></section><div class="detail-grid">
    <section class="surface"><div class="panel-heading"><div><h2>Why it matters</h2></div></div><div class="prose-panel"><p>${esc(boat.why)}</p>${boat.notes ? `<div class="analyst-note"><span>Working note</span><p>${esc(boat.notes)}</p></div>` : ''}</div></section>
    <section class="surface"><div class="panel-heading"><div><h2>Linked records</h2></div></div>${resourcePanel(events, sailing)}</section>
    <section class="surface wide capability-surface"><div class="panel-heading"><div><h2>Design, readiness & risk</h2></div></div>${profileBars(sailing)}<div class="evidence-grid"><div><h3>Off-grid systems</h3>${readinessPanel(boat)}</div><div><h3>Vessel-specific risks</h3>${riskPanel(boat)}</div></div><p class="method-note">${esc(sailingMethodology)} Unknown system status means the current evidence is incomplete, not that the system is absent.</p></section>
    <section class="surface correspondence-detail wide"><div class="panel-heading"><div><h2>Correspondence</h2><p>${events.length} interaction${events.length === 1 ? '' : 's'} · newest first</p></div></div>${events.length ? `<div class="mail-list">${events.map(correspondenceCard).join('')}</div>` : '<div class="empty-state compact"><strong>No linked correspondence yet</strong><p>The vessel may be uncontacted or correspondence may only exist in a multi-boat thread.</p></div>'}</section>
  </div></div>`;
}

function compareTray() {
  if (!state.selected.size || state.route === 'compare') return '';
  const selected = [...state.selected].map((id) => boatsById.get(id)).filter((boat) => boat && liveBoatIds.has(boat.id));
  return `<aside class="compare-tray" aria-label="Comparison selection"><div><strong>${selected.length} of 4 selected</strong><span>${selected.map((boat) => `${boat.year} ${boat.model}`).join(' · ')}</span></div><div><button class="text-button light" data-clear-selection>Clear</button><a class="button primary" href="#compare">Compare now <span aria-hidden="true">→</span></a></div></aside>`;
}

function render(options = {}) {
  const active = document.activeElement;
  const focusId = options.preserveFocus && active?.id;
  const selectionStart = focusId && 'selectionStart' in active ? active.selectionStart : null;
  const scrollY = window.scrollY;
  let content;
  if (state.route === 'pipeline') content = pipeline();
  else if (state.route === 'conversations') content = conversationsView();
  else if (state.route === 'compare') content = compareView();
  else if (state.route === 'boat') content = boatDetail();
  else content = overview();
  app.innerHTML = shell(content);
  document.title = pageTitle();
  bindEvents();
  if (focusId) {
    const replacement = document.getElementById(focusId);
    replacement?.focus({ preventScroll: true });
    if (selectionStart !== null && replacement?.setSelectionRange) replacement.setSelectionRange(selectionStart, selectionStart);
    window.scrollTo(0, scrollY);
  }
}

function resetFilters() {
  Object.assign(state, DEFAULT_FILTERS, { preset: 'all' });
  state.mapBoatIds = null;
  state.mapRegion = 'all';
  state.mapLabel = '';
}

function applyPreset(preset) {
  resetFilters();
  state.preset = preset;
  if (preset === 'top') Object.assign(state, { scoreMin: '9', activeOnly: true });
  if (preset === 'under350') Object.assign(state, { allInMax: '350000', currency: 'USD', activeOnly: true });
  if (preset === 'under400') Object.assign(state, { allInMax: '400000', currency: 'USD', activeOnly: true });
  if (preset === '44plus') Object.assign(state, { lengthMin: '44', activeOnly: true });
  if (preset === 'new2018') Object.assign(state, { yearMin: '2018', activeOnly: true });
  if (preset === 'waiting') Object.assign(state, { stage: 'waiting', activeOnly: true });
  if (preset === 'max') Object.assign(state, { stage: 'max_decision', activeOnly: true });
}

function toggleSelection(id, checked) {
  if (checked && !state.selected.has(id) && state.selected.size >= 4) {
    state.notice = 'Comparison is limited to four boats. Remove one before adding another.';
    render();
    return;
  }
  checked ? state.selected.add(id) : state.selected.delete(id);
  state.notice = checked ? 'Boat added to comparison.' : 'Boat removed from comparison.';
  render();
}

function openBoat(id) {
  if (liveBoatIds.has(id)) location.hash = `boat/${encodeURIComponent(id)}`;
}

function bindEvents() {
  const vizTips = new Map([...app.querySelectorAll('[data-viz-tip]')].map((tip) => [tip.dataset.vizTip, tip]));
  app.querySelectorAll('[data-viz-key]').forEach((point) => {
    const tip = vizTips.get(point.dataset.vizKey);
    const show = () => tip?.classList.add('active');
    const hide = () => tip?.classList.remove('active');
    point.addEventListener('pointerenter', show);
    point.addEventListener('pointerleave', hide);
    point.addEventListener('focus', show);
    point.addEventListener('blur', hide);
  });
  app.querySelectorAll('[data-preset]').forEach((button) => button.addEventListener('click', () => { applyPreset(button.dataset.preset); render(); }));
  app.querySelectorAll('[data-sort]').forEach((button) => button.addEventListener('click', () => {
    const key = button.dataset.sort;
    if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    else { state.sortKey = key; state.sortDir = ['boat', 'location', 'status'].includes(key) ? 'asc' : 'desc'; }
    render();
  }));
  app.querySelectorAll('[data-boat]').forEach((element) => {
    element.addEventListener('click', (event) => { if (!event.target.closest('a, input, label, [data-select]')) openBoat(element.dataset.boat); });
    element.addEventListener('keydown', (event) => { if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('input, a')) { event.preventDefault(); openBoat(element.dataset.boat); } });
  });
  app.querySelectorAll('[data-select]').forEach((control) => control.addEventListener('click', (event) => event.stopPropagation()));
  app.querySelectorAll('input[data-select]').forEach((control) => control.addEventListener('change', () => toggleSelection(control.dataset.select, control.checked)));
  app.querySelectorAll('button[data-select]').forEach((control) => control.addEventListener('click', () => toggleSelection(control.dataset.select, false)));
  app.querySelectorAll('[data-clear-selection]').forEach((button) => button.addEventListener('click', () => { state.selected.clear(); state.notice = 'Comparison cleared.'; render(); }));
  app.querySelectorAll('[data-reset-filters]').forEach((button) => button.addEventListener('click', () => { resetFilters(); render(); }));
  app.querySelectorAll('[data-map-region]').forEach((button) => button.addEventListener('click', () => {
    state.mapBoatIds = null;
    state.mapRegion = button.dataset.mapRegion;
    state.mapLabel = button.dataset.mapRegion;
    state.region = 'all';
    state.preset = 'custom';
    render();
  }));
  app.querySelectorAll('[data-map-boats]').forEach((marker) => {
    const selectMarker = () => {
      state.mapBoatIds = marker.dataset.mapBoats.split(',').filter(Boolean);
      state.mapRegion = 'all';
      state.mapLabel = marker.dataset.mapLabel;
      state.region = 'all';
      state.preset = 'custom';
      render();
    };
    marker.addEventListener('click', selectMarker);
    marker.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectMarker(); } });
  });
  app.querySelectorAll('[data-clear-map]').forEach((button) => button.addEventListener('click', () => {
    state.mapBoatIds = null;
    state.mapRegion = 'all';
    state.mapLabel = '';
    state.preset = 'custom';
    render();
  }));
  for (const key of ['q', 'stage', 'tier', 'brand', 'region', 'lengthMin', 'lengthMax', 'yearMin', 'yearMax', 'allInMax', 'scoreMin']) {
    const control = document.getElementById(key);
    if (!control) continue;
    control.addEventListener(key === 'q' ? 'input' : 'change', () => { state[key] = control.value; state.preset = 'custom'; render({ preserveFocus: key === 'q' }); });
  }
}

window.addEventListener('hashchange', () => {
  parseRoute(); render(); window.scrollTo({ top: 0, behavior: 'instant' });
  requestAnimationFrame(() => document.getElementById('main-content')?.focus({ preventScroll: true }));
});

parseRoute();
render();
