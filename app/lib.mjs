const BRAND_RULES = [
  ['Fountaine Pajot', /fountaine\s+pajot/i],
  ['Lagoon', /lagoon/i],
  ['Leopard', /leopard/i],
  ['Nautitech', /nautitech/i],
  ['Privilège', /privilege|privilège/i],
  ['Knysna', /knysna/i],
  ['Voyage', /voyage/i],
  ['Catana', /catana/i],
  ['Outremer', /outremer/i],
  ['Seawind', /seawind/i],
  ['Balance', /balance/i],
  ['HH', /\bhh\s*\d/i],
];

const LENGTH_RULES = [
  [50, /(?:lagoon\s*500|privilege\s*495|privilège\s*495)/i],
  [48, /(?:480|salina\s*48)/i],
  [47, /catana\s*471?/i],
  [46, /(?:leopard\s*46|nautitech\s*46)/i],
  [45, /(?:450f?|450\b|outremer\s*45)/i],
  [44, /(?:orana\s*44|helia\s*44|leopard\s*44|lagoon\s*440|nautitech\s*44|balance\s*442|\bhh\s*44)/i],
  [42, /(?:lagoon\s*42|catana\s*42)/i],
  [41, /(?:lipari\s*41|seawind\s*1260)/i],
  [40, /(?:lagoon\s*400|lagoon\s*40\b)/i],
  [38, /seawind\s*1160/i],
];

// Presentation-only map coordinates. These deliberately stay outside the
// canonical boat schema: they locate the named marina/area conservatively and
// should not be read as the vessel's exact position.
const LOCATION_RULES = [
  [/lorain|cleveland|ohio/i, [41.48, -81.70]],
  [/barrington|rhode island/i, [41.74, -71.31]],
  [/kemah|texas|\btx\b/i, [29.54, -95.02]],
  [/charleston|south carolina|\bsc\b/i, [32.78, -79.93]],
  [/st\.? augustine/i, [29.90, -81.31]],
  [/daytona/i, [29.21, -81.02]],
  [/riviera beach/i, [26.78, -80.06]],
  [/vero beach/i, [27.64, -80.40]],
  [/^panama\b/i, [9.00, -79.52]],
  [/fort lauderdale|dania beach/i, [26.12, -80.14]],
  [/marsh harbour|abaco|bahama/i, [26.54, -77.06]],
  [/luper[oó]n/i, [19.90, -70.96]],
  [/la romana/i, [18.43, -68.97]],
  [/fajardo|puerto rico/i, [18.33, -65.65]],
  [/st\.? thomas/i, [18.34, -64.93]],
  [/cruz bay|st\.? john|usvi/i, [18.33, -64.79]],
  [/hodge creek/i, [18.43, -64.57]],
  [/road town|tortola|virgin gorda|\bbvi\b/i, [18.43, -64.62]],
  [/simpson bay|sint maarten/i, [18.04, -63.09]],
  [/saint lucia|st\.? lucia/i, [13.91, -60.98]],
  [/pointe.?.pitre|guadeloupe/i, [16.24, -61.53]],
  [/le marin|martinique/i, [14.47, -60.87]],
  [/saint david|st\.? george|grenada|port louis/i, [12.05, -61.75]],
  [/chaguaramas|trinidad/i, [10.68, -61.64]],
  [/willemstad|cura[cç]ao/i, [12.11, -68.93]],
  [/aruba/i, [12.52, -70.04]],
  [/placencia|belize/i, [16.52, -88.37]],
  [/rio dulce|guatemala/i, [15.66, -88.99]],
  [/nargan[aá]|san blas/i, [9.45, -78.58]],
  [/panama/i, [9.00, -79.52]],
  [/palma|baleares/i, [39.57, 2.65]],
  [/barcelona/i, [41.39, 2.17]],
  [/le lavandou/i, [43.14, 6.37]],
  [/marseille/i, [43.30, 5.37]],
  [/palermo|sicily/i, [38.12, 13.36]],
  [/seget|croatia/i, [43.52, 16.23]],
  [/tivat|montenegro/i, [42.43, 18.70]],
  [/lefkada|greece/i, [38.83, 20.71]],
  [/larnaca|cyprus/i, [34.90, 33.62]],
];

export const STAGE_LABELS = {
  diligence: 'Broker replied — needs review',
  waiting: 'Waiting on broker',
  max_decision: 'Waiting on Max',
  watch: 'Watch only',
  closed: 'Archived comp',
  other: 'Other',
};

export function activeBoats(boats) {
  return boats.filter((boat) => boat.stage_bucket !== 'closed' && !/sold|withdrawn|under contract|under offer/i.test(boat.stage || ''));
}

export function isSeriousCandidate(boat) {
  return activeBoats([boat]).length === 1 && boat.tier === 'A' && boat.score >= 9.5;
}

export function priorityBoats(boats, n = 8) {
  return activeBoats(boats).slice().sort((a, b) => b.score - a.score).slice(0, n);
}

export function deriveBrand(model = '') {
  return BRAND_RULES.find(([, pattern]) => pattern.test(model))?.[0] ?? model.split(/\s+/)[0] ?? 'Unknown';
}

export function deriveLength(model = '') {
  return LENGTH_RULES.find(([, pattern]) => pattern.test(model))?.[0] ?? null;
}

export function boatIdentity(boat) {
  const length = deriveLength(boat.model);
  return `${boat.year ?? 'Year unknown'} ${boat.model}${length ? ` · ${length} ft` : ''}`;
}

export function inferCurrency(boat) {
  if (boat.ask_currency) return boat.ask_currency;
  const display = `${boat.ask_display ?? ''} ${boat.all_in_display ?? ''}`;
  if (display.includes('€')) return 'EUR';
  if (display.includes('£')) return 'GBP';
  if (display.includes('$') || Number.isFinite(boat.all_in_high)) return 'USD';
  return null;
}

export function inferRefitCurrency(boat) {
  const display = boat.refit_display ?? '';
  if (display.includes('€')) return 'EUR';
  if (display.includes('£')) return 'GBP';
  if (display.includes('$')) return 'USD';
  return inferCurrency(boat);
}

export function money(value, currency = 'USD') {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function compactMoney(value, currency = 'USD') {
  if (!Number.isFinite(value)) return '—';
  const symbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  if (Math.abs(value) >= 1000) {
    const amount = Math.round((value / 1000) * 10) / 10;
    return `${symbol}${Number.isInteger(amount) ? amount : amount.toFixed(1)}k`;
  }
  return `${symbol}${Math.round(value)}`;
}

export function midpoint(low, high) {
  if (Number.isFinite(low) && Number.isFinite(high)) return (low + high) / 2;
  return Number.isFinite(high) ? high : Number.isFinite(low) ? low : null;
}

export function economics(boat) {
  const currency = inferCurrency(boat);
  const refitCurrency = inferRefitCurrency(boat);
  const ask = Number.isFinite(boat.ask_value) ? boat.ask_value : null;
  const refit = midpoint(boat.refit_low, boat.refit_high);
  const allIn = midpoint(boat.all_in_low, boat.all_in_high);
  const length = deriveLength(boat.model);
  return {
    currency,
    refitCurrency,
    ask,
    refit,
    allIn,
    length,
    askPerFoot: ask && length ? ask / length : null,
    allInPerFoot: allIn && length ? allIn / length : null,
    refitBurden: ask && refit && currency === refitCurrency ? refit / ask : null,
  };
}

export function median(values) {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function daysSince(date, now = '2026-09-03') {
  if (!date) return null;
  const value = new Date(`${date}T12:00:00Z`);
  const reference = new Date(`${now}T12:00:00Z`);
  if (Number.isNaN(value.valueOf()) || Number.isNaN(reference.valueOf())) return null;
  return Math.max(0, Math.round((reference - value) / 86400000));
}

export function relativeDate(date, now = '2026-09-03') {
  if (!date || date === '—') return 'No reply';
  const days = daysSince(date, now);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return Number.isFinite(days) ? `${days}d ago` : date;
}

export function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const value = typeof key === 'function' ? key(item) : item[key] || 'Unknown';
    (groups[value] ??= []).push(item);
    return groups;
  }, {});
}

export function regionFor(boat) {
  const value = (boat.location || '').toLowerCase();
  if (/bvi|tortola|virgin|grenada|guadeloupe|pointe.?.pitre|martinique|le marin|bahama|abaco|panama|san blas|cura[cç]ao|aruba|st\. john|saint lucia|sint maarten|puerto rico|dominican|belize|guatemala|trinidad/.test(value)) return 'Caribbean';
  if (/spain|france|italy|cyprus|croatia|greece|barcelona|palermo|marseille|montenegro/.test(value)) return 'Mediterranean';
  if (/florida|texas|ohio|cleveland|lorain|rhode island|barrington|maryland|annapolis|charleston|daytona|riviera beach|st\. augustine|fort lauderdale|vero beach/.test(value)) return 'Continental US';
  return 'Other';
}

export function locationCoordinates(location = '') {
  const match = LOCATION_RULES.find(([pattern]) => pattern.test(location));
  return match ? { lat: match[1][0], lon: match[1][1] } : null;
}

export function latestConversation(boatId, conversations) {
  return conversations
    .filter((event) => event.boat_id === boatId)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))[0] ?? null;
}

export function conversationImpact(event) {
  const value = `${event?.triage ?? ''} ${event?.facts ?? ''}`.toLowerCase();
  if (/strengthen|improv|positive|upgrade|compelling/.test(value)) return 'positive';
  if (/downgrad|weaker|worse|overwhelm|archive|sold|under contract/.test(value)) return 'negative';
  return 'neutral';
}

export function actionOwner(boat) {
  const next = (boat.next_step || '').toLowerCase();
  if (boat.stage_bucket === 'closed') return 'No action';
  if (boat.stage_bucket === 'waiting') return 'Broker / seller';
  if (boat.stage_bucket === 'max_decision' || /your decision|max decides|max decision/.test(next)) return 'Max';
  if (boat.stage_bucket === 'diligence') return /request|get |obtain|review|inspect|digest/.test(next) ? 'Document review' : 'Diligence';
  if (/not contacted|contact through|find an alternate/.test(`${boat.stage} ${next}`.toLowerCase())) return 'Sourcing / Max';
  return 'Research';
}

export function preciseStatus(boat) {
  const stage = (boat.stage || '').toLowerCase();
  if (boat.stage_bucket === 'closed') {
    if (/under contract/.test(stage)) return 'Under contract';
    if (/under offer/.test(stage)) return 'Under offer';
    if (/sold|withdrawn/.test(stage)) return 'Sold / withdrawn';
    return 'Archived comp';
  }
  if (boat.stage_bucket === 'max_decision') return 'Waiting on Max';
  if (boat.stage_bucket === 'waiting') return /acknowledged|reply pending/.test(stage) ? 'Broker replied — more due' : 'Waiting on broker';
  if (boat.stage_bucket === 'diligence') return /reply|received/.test(stage) ? 'Broker replied — needs review' : 'Diligence active';
  if (boat.stage_bucket === 'watch' && /not contacted|new lead/.test(stage)) return 'Not contacted';
  return STAGE_LABELS[boat.stage_bucket] ?? boat.stage;
}

export function needsAttention(boat) {
  return ['max_decision', 'diligence', 'waiting'].includes(boat.stage_bucket);
}

export function needsOutreach(boat) {
  const state = `${boat.stage ?? ''} ${boat.last_reached_out ?? ''}`.toLowerCase();
  return boat.stage_bucket === 'watch'
    && /not contacted|no public email|new lead/.test(state)
    && !/intentionally not contacted/.test(state);
}

export function biggestRisk(boat, maxLength = 150) {
  const first = (boat.risks || 'No material risk logged.').split(/;|\.\s+/)[0].trim();
  return first.length > maxLength ? `${first.slice(0, maxLength - 1).trim()}…` : first;
}

export function classifyRisk(text = '') {
  const value = text.toLowerCase();
  if (/bulkhead|\bstructural\b|delamin|\bcore\b|crossbeam|compression.post|grounding|\bcrack|moisture|blister/.test(value)) return { kind: 'structural', label: 'Structural / hull', severity: 'high' };
  if (/engine|saildrive|generator|genset|turbo|injector/.test(value)) return { kind: 'mechanical', label: 'Mechanical', severity: 'high' };
  if (/rig|sail|chainplate/.test(value)) return { kind: 'capex', label: 'Known capex', severity: 'medium' };
  if (/vat|tax|duty|title|import|citizen|resident/.test(value)) return { kind: 'transaction', label: 'Transaction', severity: 'medium' };
  if (/unclear|unknown|verify|need|disclosed|documentation|records/.test(value)) return { kind: 'unknown', label: 'Diligence unknown', severity: 'medium' };
  return { kind: 'operational', label: 'Operating / comfort', severity: 'low' };
}

export function riskItems(boat) {
  const parts = (boat.risks || '')
    .split(/;|\.\s+(?=[A-Z~0-9])/)
    .map((text) => text.trim().replace(/\.$/, ''))
    .filter(Boolean);
  return parts.slice(0, 7).map((text) => ({ text, ...classifyRisk(text) }));
}

export function dealBreakerRisk(boat) {
  const materialIssue = /(?:crossbeam|bulkhead).*(?:repair|work|replacement|reinforcement|cause)|(?:repair|replacement|reinforcement).*(?:crossbeam|bulkhead)|port.hull core|delaminat|rudder recore|blistering|(?:grounding|collision|structural) damage/i;
  const reassuring = /no (?:known|reported|disclosed|significant).*(?:structural|grounding|collision|casualty|damage)/i;
  return riskItems(boat).find((risk) => materialIssue.test(risk.text) && !reassuring.test(risk.text)) ?? null;
}

function equipmentStatus(positiveText, riskText, positive, warning, missing) {
  if (missing.test(riskText)) return 'missing';
  if (warning.test(riskText)) return 'watch';
  if (positive.test(positiveText)) return 'ready';
  return 'unknown';
}

export function readinessMatrix(boat) {
  const positive = `${boat.why ?? ''} ${boat.notes ?? ''}`.toLowerCase();
  const risks = (boat.risks || '').toLowerCase();
  const items = [
    ['Solar', /solar/, /solar.{0,35}(?:unclear|small|only|weak)|only.{0,20}solar/, /no solar|without solar/],
    ['Lithium', /lithium|lifepo4|dragonfly|epoch/, /lithium.{0,50}(?:unknown|unclear|age|insurance|wiring|health)|battery.{0,35}(?:unknown|unclear|old)/, /no lithium|acid batter|agm/],
    ['Inverter', /inverter|multiplus|quattro|victron/, /inverter.{0,35}(?:small|unknown|unclear)/, /no inverter/],
    ['Generator', /generator|genset|onan|fischer panda/, /generator.{0,45}(?:hours|unknown|unclear|original)|genset.{0,45}(?:hours|unknown|unclear|original)|(?:8,|10,|11,|15,)\d{3}h/, /no generator|without generator/],
    ['A/C', /a\/c|air.condition|frigomar/, /a\/c.{0,35}(?:unknown|estimate|test)|air.condition.{0,35}(?:unknown|estimate|test)/, /no a\/c|without a\/c|no air.condition/],
    ['Watermaker', /watermaker|rainman/, /watermaker.{0,35}(?:unknown|unclear|service)/, /no watermaker/],
    ['Rig', /new.{0,25}(?:standing )?rig|rig.{0,25}20(?:2[2-9]|3\d)|shrouds.{0,20}20(?:2[2-9]|3\d)/, /rig.{0,45}(?:original|age|unknown|unclear|due|replace|report)|(?:original|aged).{0,25}(?:standing )?rig|standing rigging.{0,45}(?:original|age|unknown|unclear)/, /no rig/],
    ['Sails', /new.{0,20}(?:main|genoa|sails)|(?:main|genoa|sails).{0,25}20(?:2[2-9]|3\d)/, /sail.{0,40}(?:original|age|unknown|unclear|due|replace)|genoa.{0,30}(?:original|age|due)/, /no sails/],
    ['Propulsion', /new.{0,25}(?:engine|saildrive)|repower|replacement engine/, /engine.{0,45}(?:hours|unknown|unclear|original)|saildrive.{0,40}(?:unknown|unclear|service|original)/, /no engine/],
    ['Connectivity', /starlink|iridium|networking/, /starlink.{0,25}(?:unknown|unclear)/, /no starlink/],
  ];
  return items.map(([label, yes, warn, no]) => ({ label, status: equipmentStatus(positive, risks, yes, warn, no) }));
}

export function relativeValueRank(boat, boats) {
  const target = economics(boat);
  if (!target.allInPerFoot || !target.currency) return null;
  const cohort = activeBoats(boats)
    .filter((candidate) => inferCurrency(candidate) === target.currency)
    .map((candidate) => ({ id: candidate.id, value: economics(candidate).allInPerFoot }))
    .filter((candidate) => Number.isFinite(candidate.value))
    .sort((a, b) => a.value - b.value);
  const index = cohort.findIndex((candidate) => candidate.id === boat.id);
  return index < 0 ? null : { rank: index + 1, total: cohort.length, currency: target.currency };
}

export function filterBoats(boats, filters = {}) {
  const {
    q = '', stage = 'all', tier = 'all', currency = 'all', brand = 'all',
    region = 'all', lengthMin = null, lengthMax = null, yearMin = null,
    yearMax = null, allInMax = null, scoreMin = null, activeOnly = false,
  } = filters;
  const needle = String(q).trim().toLowerCase();
  const hasNumber = (value) => value !== null && value !== '' && Number.isFinite(Number(value));
  return boats.filter((boat) => {
    const details = [boat.name, boat.model, boat.location, boat.contact, boat.why, boat.risks, boat.stage, boat.next_step].join(' ').toLowerCase();
    const length = deriveLength(boat.model);
    const allIn = economics(boat).allIn;
    return (!needle || details.includes(needle))
      && (stage === 'all' || boat.stage_bucket === stage)
      && (tier === 'all' || boat.tier === tier)
      && (currency === 'all' || inferCurrency(boat) === currency)
      && (brand === 'all' || deriveBrand(boat.model) === brand)
      && (region === 'all' || regionFor(boat) === region)
      && (!activeOnly || boat.stage_bucket !== 'closed')
      && (!hasNumber(lengthMin) || length >= Number(lengthMin))
      && (!hasNumber(lengthMax) || length <= Number(lengthMax))
      && (!hasNumber(yearMin) || boat.year >= Number(yearMin))
      && (!hasNumber(yearMax) || boat.year <= Number(yearMax))
      && (!hasNumber(allInMax) || allIn <= Number(allInMax))
      && (!hasNumber(scoreMin) || boat.score >= Number(scoreMin));
  });
}

export function sortBoats(boats, key = 'score', direction = 'desc') {
  const value = (boat) => {
    const econ = economics(boat);
    if (key === 'boat') return `${boat.model} ${boat.year ?? 0}`.toLowerCase();
    if (key === 'length') return econ.length ?? -Infinity;
    if (key === 'year') return boat.year ?? -Infinity;
    if (key === 'ask') return econ.ask ?? -Infinity;
    if (key === 'refit') return econ.refit ?? -Infinity;
    if (key === 'allIn') return econ.allIn ?? -Infinity;
    if (key === 'allInPerFoot') return econ.allInPerFoot ?? -Infinity;
    if (key === 'location') return (boat.location || '').toLowerCase();
    if (key === 'status') return preciseStatus(boat).toLowerCase();
    if (key === 'lastReply') return boat.last_heard_from && boat.last_heard_from !== '—' ? boat.last_heard_from : '';
    return boat.score ?? -Infinity;
  };
  const multiplier = direction === 'asc' ? 1 : -1;
  return boats.slice().sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    const aMissing = av === -Infinity || av === '';
    const bMissing = bv === -Infinity || bv === '';
    if (aMissing !== bMissing) return aMissing ? 1 : -1;
    if (typeof av === 'string') return av.localeCompare(bv) * multiplier;
    return (av - bv) * multiplier;
  });
}
