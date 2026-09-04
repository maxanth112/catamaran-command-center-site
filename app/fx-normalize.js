(() => {
  const nativeFetch = window.fetch.bind(window);
  const FX = Object.freeze({ USD: 1, EUR: 1.16, GBP: 1.35 });
  const AS_OF = '2026-09-03';

  function detectCurrency(display = '', fallback = 'USD') {
    if (display.includes('€') || /\bEUR\b/i.test(display)) return 'EUR';
    if (display.includes('£') || /\bGBP\b/i.test(display)) return 'GBP';
    if (display.includes('$') || /\bUSD\b/i.test(display)) return 'USD';
    return fallback || 'USD';
  }

  function toUsd(value, currency) {
    return Number.isFinite(value) ? Math.round(value * (FX[currency] || 1)) : value;
  }

  function normalizeBoat(boat) {
    const nativeAskCurrency = boat.ask_currency || detectCurrency(boat.ask_display, 'USD');
    const nativeAllInCurrency = detectCurrency(boat.all_in_display, nativeAskCurrency);
    const nativeRefitCurrency = detectCurrency(boat.refit_display, nativeAskCurrency);
    const original = {
      ask_currency: nativeAskCurrency,
      ask_display: boat.ask_display,
      all_in_display: boat.all_in_display,
      refit_display: boat.refit_display,
    };

    const normalized = {
      ...boat,
      native_pricing: original,
      ask_currency: 'USD',
      ask_value: toUsd(boat.ask_value, nativeAskCurrency),
      all_in_low: toUsd(boat.all_in_low, nativeAllInCurrency),
      all_in_high: toUsd(boat.all_in_high, nativeAllInCurrency),
      refit_low: toUsd(boat.refit_low, nativeRefitCurrency),
      refit_high: toUsd(boat.refit_high, nativeRefitCurrency),
      fx_normalized: nativeAskCurrency !== 'USD' || nativeAllInCurrency !== 'USD' || nativeRefitCurrency !== 'USD',
      fx_as_of: AS_OF,
    };

    // The app infers refit currency from this display field. Rewrite only non-USD
    // refit labels so converted numeric values are never rendered with a € or £ sign.
    if (nativeRefitCurrency !== 'USD' && boat.refit_display) {
      normalized.refit_display = `USD equivalent at ${nativeRefitCurrency}/USD ${FX[nativeRefitCurrency].toFixed(2)} · native ${nativeRefitCurrency} estimate retained in source data`;
    }
    return normalized;
  }

  window.CATAMARAN_FX = { base: 'USD', rates: FX, asOf: AS_OF };
  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    const requestUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    const pathname = new URL(requestUrl, location.href).pathname;
    if (!response.ok || !/\/data\/boats\/boats-\d+\.json$/.test(pathname)) return response;

    const boats = await response.clone().json();
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('content-type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify(boats.map(normalizeBoat)), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
})();