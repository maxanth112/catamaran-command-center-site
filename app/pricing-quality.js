(() => {
  const upstream = window.fetch.bind(window);
  const rates = window.CATAMARAN_FX?.rates || { USD: 1, EUR: 1.16, GBP: 1.35 };
  const boatsById = new Map();

  const currency = (text = '', fallback = 'USD') => text.includes('€') || /\bEUR\b/i.test(text) ? 'EUR' : text.includes('£') || /\bGBP\b/i.test(text) ? 'GBP' : text.includes('$') || /\bUSD\b/i.test(text) ? 'USD' : fallback;
  function token(value = '', suffix = '') {
    const number = Number(String(value).replace(/,/g, ''));
    if (!Number.isFinite(number)) return null;
    return /m/i.test(suffix) ? number * 1_000_000 : /k/i.test(suffix) ? number * 1_000 : number;
  }
  function range(text = '') {
    if (!text || text === '—') return null;
    const clean = String(text).replace(/[–—]/g, '-');
    const match = clean.match(/(?:[$€£]\s*)?(\d[\d,.]*(?:\.\d+)?)\s*([km])?\s*-\s*(?:[$€£]\s*)?(\d[\d,.]*(?:\.\d+)?)\s*([km])?/i);
    if (match) {
      const suffix = match[4] || match[2] || '';
      const low = token(match[1], match[2] || suffix);
      const high = token(match[3], suffix);
      if (Number.isFinite(low) && Number.isFinite(high)) return { low: Math.min(low, high), high: Math.max(low, high) };
    }
    const mid = clean.match(/\bmid-?[$€£]?(\d{3})s\b/i);
    if (mid) return { low: Number(mid[1]) * 1_000 + 35_000, high: Number(mid[1]) * 1_000 + 65_000 };
    const single = clean.match(/[$€£]?\s*(\d[\d,.]*(?:\.\d+)?)\s*([km])\b/i) || clean.match(/[$€£]?\s*(\d{5,7})/i);
    if (!single) return null;
    const amount = token(single[1], single[2] || '');
    return Number.isFinite(amount) ? { low: amount, high: amount } : null;
  }
  function usdRange(text, fallbackCurrency) {
    const parsed = range(text);
    if (!parsed) return null;
    const rate = rates[currency(text, fallbackCurrency)] || 1;
    return { low: Math.round(parsed.low * rate), high: Math.round(parsed.high * rate) };
  }

  const rules = {
    Solar: [/\bno (?:meaningful )?solar\b|\bwithout solar\b/i, /\bsolar\b.*(?:unknown|unclear|weak|only|verify|wattage|capacity)/i, /\bsolar\b/i],
    Lithium: [/\b(?:lead[- ]acid|acid batteries|AGM)\b|\bno lithium\b/i, /\b(?:lithium|lifepo4|battery bank)\b.*(?:unknown|unclear|health|age|owner-built|contradict|test)/i, /\b(?:lithium|lifepo4|relion|epoch|dragonfly)\b/i],
    Inverter: [/\bno inverter\b/i, /\binverter\b.*(?:unknown|unclear|verify|undersized)/i, /\b(?:inverter|multiplus|quattro)\b/i],
    Generator: [/\bno (?:built-in |installed |permanent )?(?:generator|genset)\b|\bgenerator-free\b|\bonly (?:a )?portable (?:generator|honda)\b/i, /\b(?:generator|genset|onan|fischer panda|northern lights|mase|kohler)\b.*(?:hours|unknown|reserve|service|high|contingency)/i, /\b(?:generator|genset|onan|fischer panda|northern lights|mase|kohler)\b/i],
    'A/C': [/\bno (?:permanent )?(?:a\/?c|air conditioning)\b/i, /\b(?:a\/?c|air conditioning)\b.*(?:unknown|unclear|inoperative|only|portable|battery|reserve)/i, /\b(?:a\/?c|air conditioning|cruisair|frigomar|dometic)\b/i],
    Watermaker: [/\bno watermaker\b/i, /\bwatermaker\b.*(?:unknown|unclear|verify|service|capacity)/i, /\b(?:watermaker|rainman|cruisero|schenker|spectra)\b/i],
    Rig: [null, /\b(?:standing rig(?:ging)?|rigging|rig|shrouds?|forestay)\b.*(?:original|unknown|unclear|inspect|age|due|verify|replacement date)/i, /\b(?:standing rig(?:ging)?|rigging|shrouds?|forestay)\b.*(?:replaced|renewed|new|202[0-6])|\b(?:new|replacement|carbon)\s+(?:mast|rig)\b/i],
    Sails: [null, /\b(?:sails?|mainsail|main|genoa|jib)\b.*(?:original|unknown|unclear|age|due|verify)/i, /\b(?:sails?|mainsail|main|genoa|jib)\b.*(?:new|replaced|202[0-6])/i],
    Propulsion: [null, /\b(?:engine|engines|saildrive|saildrives)\b.*(?:hours|original|unknown|history|diaphragm|high|reserve)/i, /\b(?:engine|engines|saildrive|saildrives|repower)\b.*(?:replaced|rebuilt|serviced|new|202[0-6])|\b(?:yanmar|volvo penta)\b/i],
    Connectivity: [/\bno (?:starlink|satellite|iridium)\b/i, /\b(?:starlink|iridium|inreach|satellite)\b.*(?:unknown|unclear|not included)/i, /\b(?:starlink|iridium|inreach|satellite|pepwave)\b/i],
  };

  function systemEvidence(boat) {
    const fragments = [boat.why, boat.risks, boat.notes].filter(Boolean).flatMap((text) => String(text).split(/(?<=[.!?;])\s+|;\s+/)).map((text) => text.trim()).filter(Boolean);
    const evaluate = ([missing, watch, ready]) => {
      const hit = (regex) => regex ? fragments.find((fragment) => regex.test(fragment)) : null;
      const absent = hit(missing); if (absent) return { status: 'missing', label: 'Confirmed absent', evidence: absent };
      const verify = hit(watch); if (verify) return { status: 'watch', label: 'Verify', evidence: verify };
      const documented = hit(ready); if (documented) return { status: 'ready', label: 'Documented', evidence: documented };
      return { status: 'unknown', label: 'Not disclosed', evidence: 'No supporting statement in the saved listing/email evidence yet.' };
    };
    return Object.fromEntries(Object.entries(rules).map(([name, rule]) => [name, evaluate(rule)]));
  }

  function enrich(boat) {
    const native = boat.native_pricing || {};
    const askDisplay = native.ask_display || boat.ask_display || '';
    const refitDisplay = native.refit_display || boat.refit_display || '';
    const allInDisplay = native.all_in_display || boat.all_in_display || '';
    const askCurrency = native.ask_currency || currency(askDisplay, 'USD');
    const ask = usdRange(askDisplay, askCurrency);
    const refit = usdRange(refitDisplay, askCurrency);
    const allIn = usdRange(allInDisplay, askCurrency);
    if (ask && (!Number.isFinite(boat.ask_value) || (boat.ask_value < 10_000 && ask.high >= 10_000))) boat.ask_value = ask.high;
    if (refit && refit.low >= 1_000) { boat.refit_low = refit.low; boat.refit_high = refit.high; }
    if (allIn && allIn.low >= 10_000) { boat.all_in_low = allIn.low; boat.all_in_high = allIn.high; }
    if (!Number.isFinite(boat.all_in_high) && Number.isFinite(boat.ask_value) && (Number.isFinite(boat.refit_low) || Number.isFinite(boat.refit_high))) {
      const low = Number.isFinite(boat.refit_low) ? boat.refit_low : boat.refit_high;
      const high = Number.isFinite(boat.refit_high) ? boat.refit_high : low;
      boat.all_in_low = Math.round(boat.ask_value + low);
      boat.all_in_high = Math.round(boat.ask_value + high);
      boat.all_in_display = `${allInDisplay && allInDisplay !== '—' ? `${allInDisplay} · ` : ''}fallback = purchase + stated refit; tax/closing/reserve not included`;
      boat.all_in_derived = true;
    }
    boat.system_evidence = systemEvidence(boat);
    boatsById.set(boat.id, boat);
    return boat;
  }

  window.CATAMARAN_DATA_QUALITY = { boatsById, range };
  window.fetch = async (...args) => {
    const response = await upstream(...args);
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    if (!response.ok || !/\/data\/boats\/boats-\d+\.json$/.test(new URL(url, location.href).pathname)) return response;
    const boats = await response.clone().json();
    const headers = new Headers(response.headers); headers.delete('content-length'); headers.set('content-type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify(boats.map(enrich)), { status: response.status, statusText: response.statusText, headers });
  };
})();