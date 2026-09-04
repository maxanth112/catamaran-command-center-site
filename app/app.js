import {
  STAGE_LABELS,
  activeBoats,
  actionOwner,
  biggestRisk,
  boatIdentity,
  compactMoney,
  conversationImpact,
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
  preciseStatus,
  priorityBoats,
  readinessMatrix,
  regionFor,
  relativeDate,
  relativeValueRank,
  riskItems,
  sortBoats,
} from './lib.mjs?v=20260903.6';
import { sailingMethodology, sailingProfile } from './model-insights.mjs?v=20260903.6';

const ROUTES = [
  ['overview', 'Overview'],
  ['pricing', 'Market & cost'],
  ['pipeline', 'Pipeline'],
  ['conversations', 'Correspondence'],
  ['geography', 'Geography'],
  ['risks', 'Risk & readiness'],
  ['compare', 'Compare'],
];

const STATUS_TONE = {
  diligence: 'positive',
  waiting: 'waiting',
  max_decision: 'decision',
  watch: 'neutral',
  closed: 'muted',
  other: 'neutral',
};

const DEFAULT_FILTERS = {
  q: '', stage: 'all', tier: 'all', currency: 'all', brand: 'all', region: 'all',
  lengthMin: '', lengthMax: '', yearMin: '', yearMax: '', allInMax: '', scoreMin: '', activeOnly: false,
};

const state = {
  route: 'overview', boatId: null, ...DEFAULT_FILTERS,
  sortKey: 'score', sortDir: 'desc', preset: 'all', chartCurrency: 'USD', costSort: 'allIn',
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

const boatsById = new Map(boats.map((boat) => [boat.id, boat]));
const conversationsByBoat = groupBy(conversations.filter((event) => event.boat_id), 'boat_id');
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
    return boat ? `${boatIdentity(boat)} — Command Center` : 'Boat not found';
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
        <span>${manifest.boats} boats · ${manifest.conversation_events} events · updated ${updated}</span>
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
  const status = preciseStatus(boat);
  const tone = STATUS_TONE[boat.stage_bucket] || 'neutral';
  return `<span class="status-badge ${tone}"><span aria-hidden="true"></span>${esc(status)}</span>${includeOwner ? `<small class="action-owner">Next: ${esc(actionOwner(boat))}</small>` : ''}`;
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

function kpiStrip() {
  const active = activeBoats(boats);
  const usd = active.filter((boat) => inferCurrency(boat) === 'USD');
  const serious = active.filter(isSeriousCandidate);
  const medianAsk = median(usd.map((boat) => economics(boat).ask));
  const medianAllIn = median(usd.map((boat) => economics(boat).allIn));
  const under350 = usd.filter((boat) => economics(boat).allIn <= 350000).length;
  const waiting = active.filter((boat) => boat.stage_bucket === 'waiting').length;
  const max = active.filter((boat) => boat.stage_bucket === 'max_decision').length;
  const todayReplies = conversations.filter((event) => event.date === generatedDate).length;
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
  const width = 820;
  const height = 330;
  const inset = { top: 24, right: 34, bottom: 48, left: 54 };
  const candidates = activeBoats(boats).filter((boat) => inferCurrency(boat) === state.chartCurrency && Number.isFinite(economics(boat).allIn) && Number.isFinite(boat.year));
  if (!candidates.length) return '<div class="empty-state compact"><strong>No comparable priced boats</strong><p>Try the other currency cohort.</p></div>';
  const costs = candidates.map((boat) => economics(boat).allIn);
  const years = candidates.map((boat) => boat.year);
  const xMin = Math.floor(Math.min(...costs) / 50000) * 50000;
  const xMax = Math.ceil(Math.max(...costs) / 50000) * 50000 || xMin + 50000;
  const yMin = Math.floor((Math.min(...years) - 1) / 2) * 2;
  const yMax = Math.ceil((Math.max(...years) + 1) / 2) * 2;
  const x = (value) => inset.left + ((value - xMin) / (xMax - xMin || 1)) * (width - inset.left - inset.right);
  const y = (value) => height - inset.bottom - ((value - yMin) / (yMax - yMin || 1)) * (height - inset.top - inset.bottom);
  const xTicks = Array.from({ length: 5 }, (_, index) => xMin + ((xMax - xMin) * index) / 4);
  const yTicks = Array.from({ length: 5 }, (_, index) => Math.round(yMin + ((yMax - yMin) * index) / 4));
  const labelIds = new Set(candidates.slice().sort((a, b) => b.score - a.score).slice(0, 7).map((boat) => boat.id));
  return `<div class="chart-wrap"><div class="chart-controls segmented" aria-label="Chart currency">${['USD', 'EUR'].map((currency) => `<button data-chart-currency="${currency}" class="${state.chartCurrency === currency ? 'active' : ''}" aria-pressed="${state.chartCurrency === currency}">${currency}</button>`).join('')}</div>
    <svg class="scatter" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="scatter-title scatter-desc">
      <title id="scatter-title">All-in cost compared with model year</title><desc id="scatter-desc">Boats farther left cost less. Boats higher up are newer. Larger bubbles are longer and darker bubbles have higher working scores.</desc><text class="zone-label" x="${inset.left + 8}" y="${inset.top + 8}">NEWER + LOWER COST</text>
      ${yTicks.map((tick) => `<g><line class="grid-line" x1="${inset.left}" x2="${width - inset.right}" y1="${y(tick)}" y2="${y(tick)}"/><text class="axis-label" x="${inset.left - 10}" y="${y(tick) + 4}" text-anchor="end">${tick}</text></g>`).join('')}
      ${xTicks.map((tick) => `<g><line class="grid-line vertical" x1="${x(tick)}" x2="${x(tick)}" y1="${inset.top}" y2="${height - inset.bottom}"/><text class="axis-label" x="${x(tick)}" y="${height - 20}" text-anchor="middle">${compactMoney(tick, state.chartCurrency)}</text></g>`).join('')}
      <text class="axis-title" x="${width / 2}" y="${height - 3}" text-anchor="middle">Estimated all-in acquisition</text>
      ${candidates.map((boat) => {
        const econ = economics(boat);
        const radius = 6 + Math.max(0, (econ.length || 40) - 40) * .45;
        const tone = boat.score >= 9 ? 'top' : boat.score >= 8 ? 'strong' : 'base';
        const label = `${boatIdentity(boat)}. ${compactMoney(econ.allIn, econ.currency)} estimated all-in. Working score ${boat.score}.`;
        return `<g class="scatter-point ${tone}" data-boat="${boat.id}" tabindex="0" role="button" aria-label="${attr(label)}"><circle cx="${x(econ.allIn)}" cy="${y(boat.year)}" r="${radius}"><title>${esc(label)}</title></circle>${labelIds.has(boat.id) ? `<text x="${x(econ.allIn) + radius + 4}" y="${y(boat.year) + 4}">${esc(boat.model.replace('Fountaine Pajot ', 'FP '))}</text>` : ''}</g>`;
      }).join('')}
    </svg><div class="chart-legend"><span><i class="dot top"></i>9+ score</span><span><i class="dot strong"></i>8–8.9</span><span><i class="bubble-key"></i>Bubble size = length</span></div></div>`;
}

function attentionQueue() {
  const stageWeight = { max_decision: 4, diligence: 3, waiting: 2, watch: 1 };
  const list = activeBoats(boats).filter((boat) => ['max_decision', 'diligence', 'waiting'].includes(boat.stage_bucket)).sort((a, b) => (stageWeight[b.stage_bucket] - stageWeight[a.stage_bucket]) || b.score - a.score).slice(0, 5);
  return `<section class="surface attention-panel"><div class="panel-heading"><div><h2>Next actions</h2></div><a href="#pipeline">See pipeline</a></div><div class="attention-list">${list.map((boat) => {
    const latest = latestConversation(boat.id, conversations);
    return `<button class="attention-row" data-boat="${boat.id}"><span class="attention-main">${identity(boat, { compact: true })}${statusBadge(boat)}</span><span class="attention-copy"><strong>${esc(actionOwner(boat))} owes next action</strong><small>${esc(truncate(latest?.facts || boat.next_step, 105))}</small></span><span class="arrow" aria-hidden="true">→</span></button>`;
  }).join('')}</div></section>`;
}

function presetButtons() {
  const presets = [
    ['all', 'All boats'], ['top', 'Top candidates'], ['under350', 'Under $350k all-in'], ['under400', 'Under $400k all-in'], ['44plus', '44 ft+'], ['new2018', '2018+'], ['caribbean', 'Caribbean'], ['waiting', 'Waiting on broker'], ['max', 'Needs my decision'], ['archived', 'Archived comps'],
  ];
  return `<div class="preset-row" aria-label="Quick filters">${presets.map(([value, label]) => `<button data-preset="${value}" class="filter-chip ${state.preset === value ? 'active' : ''}" aria-pressed="${state.preset === value}">${label}</button>`).join('')}</div>`;
}

function hasAdvancedFilters() {
  return ['brand', 'region', 'lengthMin', 'lengthMax', 'yearMin', 'yearMax', 'allInMax', 'scoreMin'].some((key) => state[key] && state[key] !== 'all');
}

function inventoryControls() {
  const brands = [...new Set(boats.map((boat) => deriveBrand(boat.model)))].sort();
  const resultCount = filterBoats(boats, state).length;
  return `<div class="inventory-controls">${presetButtons()}<div class="filter-bar">
    <label class="search-field"><span class="sr-only">Search boats</span><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m14.5 14.5 3 3m-1.4-8a6.6 6.6 0 1 1-13.2 0 6.6 6.6 0 0 1 13.2 0Z"/></svg><input id="q" type="search" value="${attr(state.q)}" placeholder="Search model, location, broker, risk…"></label>
    <label><span class="sr-only">Conversation state</span><select id="stage"><option value="all">All states</option>${Object.entries(STAGE_LABELS).filter(([value]) => value !== 'other').map(([value, label]) => `<option value="${value}" ${state.stage === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
    <label><span class="sr-only">Priority tier</span><select id="tier"><option value="all">All tiers</option>${['A', 'B', 'C', 'D'].map((tier) => `<option value="${tier}" ${state.tier === tier ? 'selected' : ''}>Tier ${tier}</option>`).join('')}</select></label>
    <label><span class="sr-only">Currency</span><select id="currency"><option value="all">All currencies</option>${['USD', 'EUR', 'GBP'].map((currency) => `<option value="${currency}" ${state.currency === currency ? 'selected' : ''}>${currency}</option>`).join('')}</select></label>
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

function boatTable(list) {
  const sorted = sortBoats(list, state.sortKey, state.sortDir);
  if (!sorted.length) return '<div class="empty-state"><strong>No boats match these filters</strong><p>Clear a preset or widen the numeric range.</p><button class="button" data-reset-filters>Reset filters</button></div>';
  return `<div class="table-scroll"><table class="boat-table"><thead><tr><th class="select-column"><span class="sr-only">Select</span></th>${sortHeader('boat', 'Boat')}${sortHeader('length', 'Length', 'number')}${sortHeader('ask', 'Ask', 'number')}${sortHeader('refit', 'Refit', 'number')}${sortHeader('allIn', 'Est. all-in', 'number')}${sortHeader('score', 'Priority', 'number')}<th class="number">Sailing</th>${sortHeader('location', 'Location')}${sortHeader('status', 'Diligence state')}${sortHeader('lastReply', 'Last reply')}</tr></thead><tbody>${sorted.map((boat) => {
    const econ = economics(boat);
    const sailing = sailingProfile(boat.model);
    const latest = latestConversation(boat.id, conversations);
    const selected = state.selected.has(boat.id);
    return `<tr class="boat-row ${selected ? 'selected' : ''}" data-boat="${boat.id}" tabindex="0">
      <td class="select-column" data-label="Select"><label class="check-control" title="Add to comparison"><input type="checkbox" data-select="${boat.id}" ${selected ? 'checked' : ''} aria-label="Compare ${attr(boatIdentity(boat))}"><span></span></label></td><td data-label="Boat">${identity(boat)}</td><td class="number" data-label="Length"><strong>${econ.length ? `${econ.length} ft` : '—'}</strong></td>
      <td class="number" data-label="Ask">${planningMoney(econ.ask, econ.currency, boat.ask_display)}</td><td class="number" data-label="Refit">${planningMoney(econ.refit, econ.refitCurrency, boat.refit_display)}<small class="cell-note">estimate</small></td><td class="number all-in-cell" data-label="Est. all-in">${planningMoney(econ.allIn, econ.currency, boat.all_in_display)}<small class="cell-note">planning</small></td>
      <td class="number" data-label="Priority">${scoreChip(boat.score)}</td><td class="number" data-label="Sailing"><span class="sail-cell" title="${attr(`${sailing.label}; model-level passage estimate ${sailing.passageSpeed}`)}"><strong>${sailing.score.toFixed(1)}</strong><small>${sailing.passageSpeed}</small></span></td>
      <td data-label="Location"><span class="location-cell">${esc(boat.location)}</span><small class="cell-note">${regionFor(boat)}</small></td><td data-label="Diligence state">${statusBadge(boat, true)}<small class="risk-preview" title="${attr(boat.risks)}">Risk: ${esc(biggestRisk(boat, 74))}</small></td>
      <td data-label="Last reply"><span class="reply-date">${relativeDate(boat.last_heard_from, generatedDate)}</span>${latest ? `<small class="reply-preview" title="${attr(latest.facts)}">${esc(truncate(latest.facts, 76))}</small>` : '<small class="cell-note">No linked reply</small>'}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function inventorySection() {
  const filtered = filterBoats(boats, state);
  return `<section class="surface inventory-surface"><div class="panel-heading inventory-heading"><div><h2>Fleet</h2><p>Economics, readiness and diligence in one scan · select up to four boats</p></div></div>${inventoryControls()}${boatTable(filtered)}</section>`;
}

function overview() {
  return `${sectionHeading('Overview', '')}${kpiStrip()}<div class="overview-grid"><section class="surface chart-surface"><div class="panel-heading"><div><h2>Age, size & total cost</h2><p>Lower cost ← · newer ↑ · larger bubble = longer boat</p></div><a href="#pricing">Cost detail</a></div>${marketScatter()}</section>${attentionQueue()}</div>${inventorySection()}`;
}

function validCostRows(currency) {
  return activeBoats(boats).filter((boat) => {
    const econ = economics(boat);
    return econ.currency === currency && Number.isFinite(econ.ask) && Number.isFinite(econ.allIn) && econ.allIn >= econ.ask;
  });
}

function costStack() {
  const rows = validCostRows(state.chartCurrency).sort((a, b) => {
    const aEcon = economics(a);
    const bEcon = economics(b);
    if (state.costSort === 'ask') return aEcon.ask - bEcon.ask;
    if (state.costSort === 'length') return (bEcon.length || 0) - (aEcon.length || 0);
    if (state.costSort === 'year') return (b.year || 0) - (a.year || 0);
    if (state.costSort === 'score') return b.score - a.score;
    return aEcon.allIn - bEcon.allIn;
  });
  const max = Math.max(...rows.map((boat) => economics(boat).allIn), 1);
  return `<section class="surface cost-stack-surface"><div class="panel-heading"><div><h2>Purchase + refit</h2><p>Full bar = estimated all-in cost</p></div><div class="inline-controls"><div class="segmented">${['USD', 'EUR'].map((currency) => `<button data-chart-currency="${currency}" class="${state.chartCurrency === currency ? 'active' : ''}" aria-pressed="${state.chartCurrency === currency}">${currency}</button>`).join('')}</div><label><span class="sr-only">Sort cost chart</span><select id="costSort"><option value="allIn" ${state.costSort === 'allIn' ? 'selected' : ''}>Sort: total cost</option><option value="ask" ${state.costSort === 'ask' ? 'selected' : ''}>Sort: purchase price</option><option value="length" ${state.costSort === 'length' ? 'selected' : ''}>Sort: length</option><option value="year" ${state.costSort === 'year' ? 'selected' : ''}>Sort: year</option><option value="score" ${state.costSort === 'score' ? 'selected' : ''}>Sort: score</option></select></label></div></div>
    <div class="cost-legend"><span><i class="ask"></i>Purchase</span><span><i class="uplift"></i>All-in uplift</span></div><div class="cost-stack">${rows.map((boat) => {
      const econ = economics(boat);
      const askWidth = (econ.ask / max) * 100;
      const upliftWidth = ((econ.allIn - econ.ask) / max) * 100;
      return `<button class="cost-row" data-boat="${boat.id}" title="${attr(`${boatIdentity(boat)}. Ask ${boat.ask_display}. All-in ${boat.all_in_display}.`)}"><span class="cost-label">${identity(boat, { compact: true })}</span><span class="stack-track"><i class="ask" style="width:${askWidth}%"></i><i class="uplift" style="width:${upliftWidth}%"></i></span><span class="cost-total"><strong>${compactMoney(econ.allIn, econ.currency)}</strong><small>+${compactMoney(econ.allIn - econ.ask, econ.currency)}</small></span></button>`;
    }).join('')}</div><p class="method-note">Planning figures are canonical acquisition estimates, not quotes. Closing, delivery, tax and currency effects are not normalized in the current schema.</p></section>`;
}

function valueTable() {
  const cohort = activeBoats(boats).filter((boat) => inferCurrency(boat) === state.chartCurrency && Number.isFinite(economics(boat).allInPerFoot)).sort((a, b) => economics(a).allInPerFoot - economics(b).allInPerFoot).slice(0, 14);
  return `<section class="surface value-surface"><div class="panel-heading"><div><h2>All-in cost per foot</h2><p>Screening signal—not a quality conclusion</p></div></div><div class="compact-list">${cohort.map((boat, index) => {
    const econ = economics(boat);
    return `<button data-boat="${boat.id}" class="rank-row"><span class="rank">${index + 1}</span>${identity(boat, { compact: true })}<span class="rank-value">${money(Math.round(econ.allInPerFoot), econ.currency)}<small>/ft</small></span></button>`;
  }).join('')}</div></section>`;
}

function pricing() {
  return `${sectionHeading('Market & cost', '')}<div class="pricing-grid">${costStack()}${valueTable()}</div><section class="insight-callout"><strong>Low all-in cost per foot can reveal value—but only after structural, mechanical and documentation risk survive diligence.</strong></section>`;
}

function pipeline() {
  const active = activeBoats(boats);
  const order = ['max_decision', 'diligence', 'waiting', 'watch', 'closed'];
  const grouped = groupBy(boats, 'stage_bucket');
  return `${sectionHeading('Pipeline', `${active.length} active boats · organized by who owes the next move`)}<div class="pipeline-board">${order.map((bucket) => {
    const list = (grouped[bucket] || []).slice().sort((a, b) => b.score - a.score);
    return `<section class="pipeline-column"><header><span class="status-badge ${STATUS_TONE[bucket]}"><span></span>${esc(STAGE_LABELS[bucket] || bucket)}</span><strong>${list.length}</strong></header><div class="pipeline-cards">${list.map((boat) => {
      const latest = latestConversation(boat.id, conversations);
      return `<button class="pipeline-card" data-boat="${boat.id}">${identity(boat, { compact: true })}<div class="pipeline-econ"><strong>${boat.ask_display ? esc(truncate(boat.ask_display, 28)) : 'Ask unknown'}</strong>${scoreChip(boat.score)}</div><p class="pipeline-next"><strong>${esc(actionOwner(boat))}:</strong> ${esc(truncate(boat.next_step, 112))}</p>${latest ? `<p class="mini-reply">Reply ${relativeDate(latest.date, generatedDate)} · ${esc(truncate(latest.facts, 82))}</p>` : ''}</button>`;
    }).join('')}</div></section>`;
  }).join('')}</div>`;
}

function directionFor(event) {
  return /max|anthony|me\b/i.test(event.sender || '') ? { label: 'Me → Broker', tone: 'outbound' } : { label: 'Broker → Me', tone: 'inbound' };
}

function correspondenceCard(event) {
  const boat = event.boat_id ? boatsById.get(event.boat_id) : null;
  const direction = directionFor(event);
  const impact = conversationImpact(event);
  return `<article class="correspondence-card ${direction.tone}"><div class="timeline-rail"><span></span></div><div class="correspondence-body"><header><div>${boat ? `<button class="plain-link" data-boat="${boat.id}">${identity(boat, { compact: true })}</button>` : `<div class="boat-identity compact"><strong>${esc(event.thread_label)}</strong><small>Multi-boat / sourcing thread</small></div>`}<div class="message-meta"><span class="direction ${direction.tone}">${direction.label}</span><span>${esc(event.sender)}</span><time datetime="${event.date}">${relativeDate(event.date, generatedDate)} · ${event.date}</time></div></div><span class="priority ${event.priority?.toLowerCase()}">${esc(event.priority)}</span></header><h3>${esc(event.subject)}</h3><p class="facts">${esc(event.facts)}</p><div class="triage-grid"><div><span class="mini-label">Decision impact</span><strong class="impact ${impact}">${impact === 'positive' ? 'Improved' : impact === 'negative' ? 'Hurt' : 'No ranking change'}</strong><p>${esc(event.triage)}</p></div><div><span class="mini-label">Next action</span><strong>${boat ? esc(actionOwner(boat)) : 'Research'} owns it</strong><p>${esc(event.next_action)}</p></div></div><footer>${event.availability ? `<span>Availability: ${esc(event.availability)}</span>` : '<span></span>'}${event.gmail_url ? `<a class="button small" target="_blank" rel="noreferrer" href="${attr(event.gmail_url)}">Open exact Gmail message <span aria-hidden="true">↗</span></a>` : '<span class="data-missing">No Gmail link recorded</span>'}</footer></div></article>`;
}

function conversationsView() {
  const dated = conversations.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const contacted = new Set(boats.filter((boat) => boat.last_reached_out && boat.last_reached_out !== '—').map((boat) => boat.id)).size;
  const responded = new Set(conversations.filter((event) => event.boat_id).map((event) => event.boat_id)).size;
  const needingReview = activeBoats(boats).filter((boat) => boat.stage_bucket === 'diligence').length;
  return `${sectionHeading('Correspondence', '')}<section class="conversation-stats"><div><span>Boats contacted</span><strong>${contacted}</strong></div><div><span>Boats with replies</span><strong>${responded}</strong></div><div><span>Needs review</span><strong>${needingReview}</strong></div><div><span>Logged events</span><strong>${conversations.length}</strong></div></section><section class="surface correspondence-surface"><div class="panel-heading"><div><h2>Latest interactions</h2><p>Newest first · Gmail remains the source of truth</p></div></div><div class="correspondence-timeline">${dated.map(correspondenceCard).join('')}</div></section>`;
}

function geographyMap(list) {
  const width = 1120;
  const height = 390;
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
  return `<section class="surface geo-map-surface"><div class="panel-heading"><div><h2>Fleet locations</h2><p>Approximate marina areas · select a marker to open its highest-priority boat</p></div><div class="map-region-summary">${regions.map(([region, boatsInRegion]) => `<span><strong>${boatsInRegion.length}</strong> ${esc(region)}</span>`).join('')}</div></div><div class="geo-map-wrap"><svg class="geo-map" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="geo-map-title geo-map-desc"><title id="geo-map-title">Active catamaran locations across the Atlantic, Caribbean and Mediterranean</title><desc id="geo-map-desc">Approximate location markers sized by the number of active tracked boats. Select a marker to open the highest-priority boat at that location.</desc>
    ${[-90, -60, -30, 0, 30].map((lon) => { const point = project({ lat: bounds.south, lon }); return `<line class="map-grid" x1="${point.x}" x2="${point.x}" y1="0" y2="${height}"/>`; }).join('')}
    ${[10, 20, 30, 40, 50].map((lat) => { const point = project({ lat, lon: bounds.west }); return `<line class="map-grid" x1="0" x2="${width}" y1="${point.y}" y2="${point.y}"/>`; }).join('')}
    ${landMasses.map((points) => `<path class="map-land" d="${pathFor(points)}"/>`).join('')}
    ${markers.map((group) => {
      const point = project(group.coordinates);
      const count = group.boats.length;
      const radius = Math.min(15, 5.5 + Math.sqrt(count) * 2.2);
      const top = group.boats[0];
      const place = shortPlace(group.locations);
      const label = `${place}: ${count} active boat${count === 1 ? '' : 's'}. Highest priority ${boatIdentity(top)}, score ${top.score.toFixed(1)}.`;
      return `<g class="map-marker" transform="translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})" data-boat="${top.id}" tabindex="0" role="button" aria-label="${attr(label)}"><circle r="${radius}"><title>${esc(label)}</title></circle>${count > 1 ? `<text class="map-marker-count" text-anchor="middle" y="3">${count}</text>` : ''}${count >= 3 ? `<text class="map-place-label" x="${radius + 5}" y="4">${esc(place)}</text>` : ''}</g>`;
    }).join('')}
  </svg></div><p class="map-note">Positions are conservative frontend estimates from the recorded location names, not live vessel coordinates.</p></section>`;
}

function geography() {
  const active = activeBoats(boats);
  const grouped = groupBy(active, regionFor);
  const regions = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length);
  return `${sectionHeading('Geography', '')}${geographyMap(active)}<div class="region-grid">${regions.map(([region, list]) => {
    const medianScore = median(list.map((boat) => boat.score));
    const top = list.slice().sort((a, b) => b.score - a.score).slice(0, 5);
    return `<section class="surface region-card"><header><h2>${esc(region)} <span>${list.length}</span></h2><span class="region-score">Median priority <strong>${medianScore?.toFixed(1) || '—'}</strong></span></header><div class="compact-list">${top.map((boat) => `<button data-boat="${boat.id}" class="rank-row">${identity(boat, { compact: true })}<span class="rank-value">${esc(boat.ask_display || 'Ask unknown')}</span></button>`).join('')}</div></section>`;
  }).join('')}</div>`;
}

function riskAndReadiness() {
  const active = activeBoats(boats);
  const risks = active.flatMap((boat) => riskItems(boat).map((risk) => ({ ...risk, boat })));
  const categories = ['structural', 'mechanical', 'capex', 'transaction', 'unknown', 'operational'];
  const labels = { structural: 'Structural / hull', mechanical: 'Mechanical', capex: 'Known capex', transaction: 'Transaction', unknown: 'Diligence unknown', operational: 'Operating / comfort' };
  const systems = readinessMatrix(active[0]).map(({ label }) => ({ label, ready: active.filter((boat) => readinessMatrix(boat).find((item) => item.label === label)?.status === 'ready').length, watch: active.filter((boat) => readinessMatrix(boat).find((item) => item.label === label)?.status === 'watch').length, missing: active.filter((boat) => readinessMatrix(boat).find((item) => item.label === label)?.status === 'missing').length }));
  const highRisk = active.slice().sort((a, b) => {
    const severity = (boat) => riskItems(boat).reduce((sum, risk) => sum + (risk.severity === 'high' ? 3 : risk.severity === 'medium' ? 2 : 1), 0);
    return severity(b) - severity(a) || b.score - a.score;
  }).slice(0, 12);
  return `${sectionHeading('Risk & readiness', '')}<div class="risk-overview"><section class="surface"><div class="panel-heading"><div><h2>What can break the thesis</h2></div></div><div class="risk-category-grid">${categories.map((kind) => `<div class="risk-category ${kind}"><span>${labels[kind]}</span><strong>${risks.filter((risk) => risk.kind === kind).length}</strong><small>logged mentions</small></div>`).join('')}</div></section><section class="surface"><div class="panel-heading"><div><h2>Off-grid system coverage</h2><p>Unknown means the evidence is incomplete—not that a system is absent</p></div></div><div class="readiness-bars">${systems.map((system) => `<div class="readiness-bar"><span>${system.label}</span><div><i class="ready" style="width:${system.ready / active.length * 100}%" title="${system.ready} documented ready"></i><i class="watch" style="width:${system.watch / active.length * 100}%" title="${system.watch} need verification"></i><i class="missing" style="width:${system.missing / active.length * 100}%" title="${system.missing} documented missing"></i></div><small>${system.ready} ready · ${system.watch + system.missing} issue</small></div>`).join('')}</div></section></div><section class="surface risk-table-surface"><div class="panel-heading"><div><h2>Biggest unresolved risks</h2></div></div><div class="risk-list">${highRisk.map((boat) => { const risk = riskItems(boat)[0] || { text: 'No risk logged', kind: 'unknown', label: 'Unknown' }; return `<button data-boat="${boat.id}" class="risk-row">${identity(boat, { compact: true })}<span class="risk-kind ${risk.kind}">${risk.label}</span><span class="risk-copy">${esc(risk.text)}</span><span class="arrow">→</span></button>`; }).join('')}</div></section>`;
}

function layoutSummary(boat) {
  const text = `${boat.why} ${boat.risks} ${boat.notes}`;
  const owner = text.match(/(?:true |dedicated )?owner.?s? (?:version|layout|suite)/i);
  const cabins = text.match(/([3-6])[- ]cabin/i);
  return owner ? 'Owner layout noted' : cabins ? `${cabins[1]}-cabin noted` : 'Not normalized';
}

function extractSystemFact(boat, expression) {
  const text = `${boat.why}. ${boat.risks}. ${boat.notes}`;
  const sentences = text.split(/(?<=\.)\s+/);
  return truncate(sentences.find((sentence) => expression.test(sentence)) || 'Not normalized in current data', 116);
}

function comparisonBoats() {
  if (state.selected.size) return [...state.selected].map((id) => boatsById.get(id)).filter(Boolean).slice(0, 4);
  return priorityBoats(boats, 3);
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
    { label: 'Sailability', get: (boat) => sailingProfile(boat.model).score, numeric: true, direction: 'high', render: (value, index) => { const profile = sailingProfile(list[index].model); return `<strong>${value.toFixed(1)}/10</strong><small class="matrix-note">${profile.passageSpeed} modeled passage pace</small>`; } },
    { label: 'Location', get: (boat) => boat.location }, { label: 'Layout', get: layoutSummary },
    { label: 'Engines / drives', get: (boat) => extractSystemFact(boat, /engine|saildrive|repower/i) }, { label: 'Rig / sails', get: (boat) => extractSystemFact(boat, /rig|shroud|forestay|sail|genoa|main/i) },
    { label: 'Lithium / solar', get: (boat) => extractSystemFact(boat, /lithium|lifepo4|battery|solar/i) }, { label: 'Generator / A/C', get: (boat) => extractSystemFact(boat, /generator|genset|a\/c|air.condition/i) },
    { label: 'Watermaker', get: (boat) => readinessMatrix(boat).find((item) => item.label === 'Watermaker')?.status || 'unknown', render: (value) => `<span class="readiness-status ${value}">${value}</span>` },
    { label: 'Biggest risk', get: (boat) => biggestRisk(boat, 160) }, { label: 'Diligence state', get: preciseStatus, render: (_, index) => statusBadge(list[index], true) },
    { label: 'Last meaningful reply', get: (boat) => latestConversation(boat.id, conversations)?.facts || 'No linked reply', render: (value, index) => `<span>${esc(truncate(value, 150))}</span><small class="matrix-note">${relativeDate(list[index].last_heard_from, generatedDate)}</small>` }, { label: 'Next action', get: (boat) => boat.next_step },
  ];
  return `<div class="compare-scroll"><table class="compare-table"><thead><tr><th>Decision factor</th>${list.map((boat) => `<th><button class="plain-link" data-boat="${boat.id}">${identity(boat, { compact: true })}</button><span class="compare-header-meta">${statusBadge(boat)}</span>${state.selected.has(boat.id) ? `<button class="remove-compare" data-select="${boat.id}" aria-label="Remove ${attr(boatIdentity(boat))} from comparison">×</button>` : ''}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => { const values = list.map(row.get); const currencies = row.currencyAware ? new Set(list.map((boat) => row.currencyAware === 'refit' ? economics(boat).refitCurrency : inferCurrency(boat)).filter(Boolean)) : new Set(); const comparable = !row.currencyAware || currencies.size <= 1; return `<tr><th>${row.label}${row.currencyAware && !comparable ? '<small class="matrix-note">FX not normalized</small>' : ''}</th>${values.map((value, index) => compareValueCell(value, row, values, index, comparable)).join('')}</tr>`; }).join('')}</tbody></table></div>`;
}

function compareView() {
  const list = comparisonBoats();
  const candidatePicker = priorityBoats(boats, 14);
  return `${sectionHeading('Compare', state.selected.size ? `${state.selected.size} boats selected · best comparable values are highlighted` : 'Suggested top three · select up to four boats to replace them')}<section class="surface compare-picker"><div class="panel-heading"><div><h2>Shortlist</h2></div>${state.selected.size ? '<button class="text-button" data-clear-selection>Clear selection</button>' : ''}</div><div class="picker-row">${candidatePicker.map((boat) => `<label class="picker-chip ${state.selected.has(boat.id) ? 'selected' : ''}"><input type="checkbox" data-select="${boat.id}" ${state.selected.has(boat.id) ? 'checked' : ''}><span>${boat.year} ${esc(boat.model)}<small>${boat.score.toFixed(1)} · ${esc(boat.ask_display)}</small></span></label>`).join('')}</div></section><section class="surface compare-matrix-surface">${compareMatrix(list)}<p class="method-note">Sailability is a model-level planning signal, not a prediction for a specific boat. ${esc(sailingMethodology)}</p></section>`;
}

function recommendationFor(boat) {
  if (boat.stage_bucket === 'closed') return 'Use as a market comp; no active acquisition action.';
  if (boat.stage_bucket === 'max_decision') return 'Decision ready: choose whether to advance the current next step.';
  if (boat.stage_bucket === 'diligence') return 'Review the new evidence, then resolve the highest-severity unknown.';
  if (boat.stage_bucket === 'waiting') return 'Hold position until the broker or seller delivers the requested evidence.';
  if (boat.score >= 9) return 'High-potential lead: open a verified contact path and begin diligence.';
  return 'Keep on the watch list until price, evidence or fit improves.';
}

function readinessPanel(boat) {
  const items = readinessMatrix(boat);
  const labels = { ready: 'Documented', watch: 'Verify', missing: 'Missing', unknown: 'Unknown' };
  return `<div class="readiness-matrix">${items.map((item) => `<div><span class="readiness-dot ${item.status}" aria-hidden="true"></span><strong>${item.label}</strong><small>${labels[item.status]}</small></div>`).join('')}</div>`;
}

function riskPanel(boat) {
  const items = riskItems(boat);
  if (!items.length) return '<div class="empty-state compact"><strong>No structured risks found</strong><p>Review the canonical notes before treating that as a clean bill of health.</p></div>';
  return `<div class="risk-detail-list">${items.map((risk) => `<div><span class="risk-kind ${risk.kind}">${risk.label}</span><p>${esc(risk.text)}</p></div>`).join('')}</div>`;
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
    ['Sailability', `<strong class="metric-score">${sailing.score.toFixed(1)}</strong><span class="metric-denominator">/10</span>`, sailing.passageSpeed],
  ];
  return `<section class="detail-metrics" aria-label="Boat economics and scores">${metrics.map(([label, value, note, className = '']) => `<div class="detail-metric ${className}"><span>${label}</span><div>${value}</div><small>${esc(note || '')}</small></div>`).join('')}${mixedCurrencies ? `<p class="detail-metrics-note">Refit is recorded in ${econ.refitCurrency}; ask and all-in are ${econ.currency}. No FX conversion is implied.</p>` : ''}</section>`;
}

function sailingPanel(boat) {
  const profile = sailingProfile(boat.model);
  return `<div class="sailing-panel"><div class="sail-score"><strong>${profile.score.toFixed(1)}</strong><span>/10</span></div><div><h3>${esc(profile.label)}</h3><p><strong>${profile.passageSpeed}</strong> planning passage range. ${esc(profile.note)}</p>${profile.source ? `<a href="${attr(profile.source)}" target="_blank" rel="noreferrer">Source review <span aria-hidden="true">↗</span></a>` : ''}</div></div><p class="method-note">${esc(sailingMethodology)}</p>`;
}

function boatDetail() {
  const boat = boatsById.get(state.boatId);
  if (!boat) return '<div class="empty-state page-empty"><strong>Boat not found</strong><p>The stable ID in this link is not present in the current canonical dataset.</p><a class="button" href="#overview">Return to overview</a></div>';
  const econ = economics(boat);
  const events = (conversationsByBoat[boat.id] || []).slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const selected = state.selected.has(boat.id);
  return `<div class="detail-page"><div class="detail-toolbar"><a href="#overview" class="back-link"><span aria-hidden="true">←</span> Overview</a><label class="compare-toggle"><input type="checkbox" data-select="${boat.id}" ${selected ? 'checked' : ''}><span>${selected ? 'Added to compare' : 'Add to compare'}</span></label></div><header class="detail-header"><div><h1>${boat.year ?? 'Year unknown'} ${esc(boat.model)}${econ.length ? ` <span>· ${econ.length} ft</span>` : ''}</h1><div class="detail-subline"><span>${esc(boat.name)}</span><span>${esc(boat.location)}</span>${statusBadge(boat, true)}</div></div></header>${detailMetricStrip(boat)}<section class="decision-strip"><strong>${esc(recommendationFor(boat))}</strong><span><b>${esc(actionOwner(boat))}</b> next · ${esc(boat.next_step)}</span></section><div class="detail-grid">
    <section class="surface"><div class="panel-heading"><div><h2>Why it matters</h2></div></div><div class="prose-panel"><p>${esc(boat.why)}</p>${boat.notes ? `<div class="analyst-note"><span>Working note</span><p>${esc(boat.notes)}</p></div>` : ''}</div></section>
    <section class="surface"><div class="panel-heading"><div><h2>Biggest risks</h2></div></div>${riskPanel(boat)}</section>
    <section class="surface wide"><div class="panel-heading"><div><h2>Off-grid readiness</h2><p>Evidence extracted from current notes · unknown is not absent</p></div></div>${readinessPanel(boat)}</section>
    <section class="surface wide"><div class="panel-heading"><div><h2>Passage performance</h2></div></div>${sailingPanel(boat)}</section>
    <section class="surface correspondence-detail wide"><div class="panel-heading"><div><h2>Correspondence</h2><p>${events.length} interaction${events.length === 1 ? '' : 's'} · newest first</p></div></div>${events.length ? `<div class="correspondence-timeline">${events.map(correspondenceCard).join('')}</div>` : '<div class="empty-state compact"><strong>No linked correspondence yet</strong><p>The vessel may be uncontacted or correspondence may only exist in a multi-boat thread.</p></div>'}</section>
    <section class="surface wide"><div class="panel-heading"><div><h2>Documents & links</h2></div></div><div class="resource-list">${boat.listing_url ? `<a href="${attr(boat.listing_url)}" target="_blank" rel="noreferrer"><span><strong>Current listing</strong><small>${esc(boat.listing_url)}</small></span><b aria-hidden="true">↗</b></a>` : ''}${events.filter((event) => event.gmail_url).map((event) => `<a href="${attr(event.gmail_url)}" target="_blank" rel="noreferrer"><span><strong>${esc(event.subject)}</strong><small>Gmail · ${event.date}</small></span><b aria-hidden="true">↗</b></a>`).join('')}${!boat.listing_url && !events.some((event) => event.gmail_url) ? '<div class="empty-state compact">No source links recorded.</div>' : ''}</div></section>
  </div></div>`;
}

function compareTray() {
  if (!state.selected.size || state.route === 'compare') return '';
  const selected = [...state.selected].map((id) => boatsById.get(id)).filter(Boolean);
  return `<aside class="compare-tray" aria-label="Comparison selection"><div><strong>${selected.length} of 4 selected</strong><span>${selected.map((boat) => `${boat.year} ${boat.model}`).join(' · ')}</span></div><div><button class="text-button light" data-clear-selection>Clear</button><a class="button primary" href="#compare">Compare now <span aria-hidden="true">→</span></a></div></aside>`;
}

function render(options = {}) {
  const active = document.activeElement;
  const focusId = options.preserveFocus && active?.id;
  const selectionStart = focusId && 'selectionStart' in active ? active.selectionStart : null;
  const scrollY = window.scrollY;
  let content;
  if (state.route === 'pricing') content = pricing();
  else if (state.route === 'pipeline') content = pipeline();
  else if (state.route === 'conversations') content = conversationsView();
  else if (state.route === 'geography') content = geography();
  else if (state.route === 'risks') content = riskAndReadiness();
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
}

function applyPreset(preset) {
  resetFilters();
  state.preset = preset;
  if (preset === 'top') Object.assign(state, { scoreMin: '9', activeOnly: true });
  if (preset === 'under350') Object.assign(state, { allInMax: '350000', currency: 'USD', activeOnly: true });
  if (preset === 'under400') Object.assign(state, { allInMax: '400000', currency: 'USD', activeOnly: true });
  if (preset === '44plus') Object.assign(state, { lengthMin: '44', activeOnly: true });
  if (preset === 'new2018') Object.assign(state, { yearMin: '2018', activeOnly: true });
  if (preset === 'caribbean') Object.assign(state, { region: 'Caribbean', activeOnly: true });
  if (preset === 'waiting') Object.assign(state, { stage: 'waiting', activeOnly: true });
  if (preset === 'max') Object.assign(state, { stage: 'max_decision', activeOnly: true });
  if (preset === 'archived') Object.assign(state, { stage: 'closed' });
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
  if (boatsById.has(id)) location.hash = `boat/${encodeURIComponent(id)}`;
}

function bindEvents() {
  app.querySelectorAll('[data-chart-currency]').forEach((button) => button.addEventListener('click', () => { state.chartCurrency = button.dataset.chartCurrency; render(); }));
  app.querySelectorAll('[data-preset]').forEach((button) => button.addEventListener('click', () => { applyPreset(button.dataset.preset); render(); }));
  app.querySelectorAll('[data-sort]').forEach((button) => button.addEventListener('click', () => {
    const key = button.dataset.sort;
    if (['ask', 'allIn'].includes(key) && state.currency === 'all') {
      state.currency = state.chartCurrency;
      state.preset = 'custom';
      state.notice = `Filtered to ${state.chartCurrency} so monetary sorting remains comparable.`;
    }
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
  for (const key of ['q', 'stage', 'tier', 'currency', 'brand', 'region', 'lengthMin', 'lengthMax', 'yearMin', 'yearMax', 'allInMax', 'scoreMin']) {
    const control = document.getElementById(key);
    if (!control) continue;
    control.addEventListener(key === 'q' ? 'input' : 'change', () => { state[key] = control.value; state.preset = 'custom'; render({ preserveFocus: key === 'q' }); });
  }
  document.getElementById('costSort')?.addEventListener('change', (event) => { state.costSort = event.target.value; render(); });
}

window.addEventListener('hashchange', () => {
  parseRoute(); render(); window.scrollTo({ top: 0, behavior: 'instant' });
  requestAnimationFrame(() => document.getElementById('main-content')?.focus({ preventScroll: true }));
});

parseRoute();
render();
