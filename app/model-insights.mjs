const SOURCES = {
  lagoon42: 'https://www.katamarans.com/lagoon-42/',
  lagoon450: 'https://sailmagazine.com/boats/boat-review-lagoon-450s/',
  lagoon440: 'https://www.sailingmagazine.net/article-552-lagoon-440.html',
  lagoon500: 'https://sailingmagazine.net/article-479-lagoon-500.html',
  lagoon40: 'https://sailmagazine.com/boats/boat-review-lagoon-40/',
  lagoon400: 'https://www.tradeaboat.com.au/news-reviews/7699-lagoon-400-s2-yacht-review',
  helia44: 'https://www.cruisingworld.com/sailboats/helia-44-races/',
  orana44: 'https://sailmagazine.com/boats/boat-review-orana-44/',
  lipari41: 'https://blog.ultra-sailing.hr/en/lipari-41-test/',
  leopard46: 'https://www.cruisingworld.com/sailboats/leopard-46-leap-leisure/',
  leopard44: 'https://www.cruisingworld.com/sailboats/leopard-44-new-cat-set-prowl/',
  nautitech46: 'https://www.nautitechcatamarans.com/sites/default/files/media/files/NAUTITECH_46_open_EN.pdf',
  knysna480: 'https://www.cruisingworld.com/sailboats/knysna-480-new-cat-set-prowl/',
  privilege495: 'https://www.mediaship.it/sea-trials/privilege-495',
  voyage480: 'https://www.katamarans.com/voyage-480/',
  salina48: 'https://sailingmagazine.net/article-permalink-322.html',
  catana42: 'https://www.catana.com/wp-content/uploads/2018/12/8P-Catana-42-Brochure.pdf',
  catana: 'https://www.catana.com/en/',
  outremer45: 'https://catamaran-outremer.com/en/catamarans/outremer-45/',
  seawind1260: 'https://www.seawindcats.com/wp-content/uploads/dlm_uploads/2019/12/SW1260-Owners-Manual.pdf',
  seawind1160: 'https://www.seawindcats.com/wp-content/uploads/2025/03/1160-XL-Specifications.pdf',
  balance442: 'https://balancecatamarans.com/wp-content/uploads/2024/07/B442-Online-Brochure.pdf',
  hh44: 'https://www.hhcatamarans.com/hh44',
  nautitech44: 'https://www.nautitechcatamarans.com/en/catamarans/44-open.html',
};

// These profiles describe design families, never the condition of an individual
// listing. Scores intentionally use the full 0–10 range to make the core
// performance / offshore / comfort tradeoff legible.
const PROFILES = [
  { pattern: /outremer\s*45/i, performance: 9.5, offshore: 9.5, comfort: 6.9, passageSpeed: '7.5–10 kn', source: SOURCES.outremer45, note: 'Narrow hulls, low displacement and daggerboards favor speed and pointing; payload discipline preserves that advantage.' },
  { pattern: /hh\s*44/i, performance: 9.2, offshore: 9.2, comfort: 8.3, passageSpeed: '7.5–10 kn', source: SOURCES.hh44, note: 'Carbon-intensive structure, efficient boards and a powerful sail plan combine performance with unusually complete cruising systems.' },
  { pattern: /balance\s*442/i, performance: 9.0, offshore: 9.0, comfort: 8.4, passageSpeed: '7–9.5 kn', source: SOURCES.balance442, note: 'Daggerboards, moderate displacement and a strong sail-area-to-weight ratio target the performance-luxury middle.' },
  { pattern: /catana\s*42/i, performance: 9.0, offshore: 9.0, comfort: 7.7, passageSpeed: '7–9.5 kn', source: SOURCES.catana42, note: 'Daggerboards, fine hulls and low displacement materially improve light-air pace and upwind ability while retaining cruising payload.' },
  { pattern: /catana\s*47(?:1)?/i, performance: 9.0, offshore: 9.1, comfort: 8.0, passageSpeed: '7.5–10 kn', source: SOURCES.catana, note: 'The Catana design family emphasizes fine hulls, carbon reinforcement and daggerboard efficiency for fast ocean cruising.' },
  { pattern: /nautitech\s*44/i, performance: 8.5, offshore: 8.6, comfort: 8.4, passageSpeed: '7–9 kn', source: SOURCES.nautitech44, note: 'Narrow waterlines, restrained windage and twin aft helms create a strong balance of sailing feel, passagemaking and liveaboard space.' },
  { pattern: /nautitech\s*46/i, performance: 8.5, offshore: 8.6, comfort: 8.2, passageSpeed: '7–9 kn', source: SOURCES.nautitech46, note: 'Relatively light displacement, efficient hulls and a low boom make this a performance-leaning liveaboard compromise.' },
  { pattern: /seawind\s*1260/i, performance: 8.5, offshore: 9.0, comfort: 7.8, passageSpeed: '7–9 kn', source: SOURCES.seawind1260, note: 'Light displacement, high bridgedeck clearance and a proven short-handed layout favor passagemaking over apartment-like volume.' },
  { pattern: /seawind\s*1160/i, performance: 8.2, offshore: 8.8, comfort: 7.4, passageSpeed: '6.5–8.5 kn', source: SOURCES.seawind1160, note: 'A light, robust cruiser with good clearance and simple handling; compact dimensions limit interior volume.' },
  { pattern: /voyage\s*480/i, performance: 8.0, offshore: 8.5, comfort: 8.2, passageSpeed: '7–9 kn', source: SOURCES.voyage480, note: 'A generous sail plan and relatively light profile provide useful pace without giving up full-time cruising volume.' },
  { pattern: /leopard\s*46/i, performance: 7.5, offshore: 8.6, comfort: 8.5, passageSpeed: '7–9 kn', source: SOURCES.leopard46, note: 'Fine hulls and a capable rig support good passage pace, while robust systems and volume suit long-range living.' },
  { pattern: /knysna\s*480/i, performance: 7.4, offshore: 8.7, comfort: 8.8, passageSpeed: '6.5–8.5 kn', source: SOURCES.knysna480, note: 'A robust, voluminous bluewater platform with respectable sailing efficiency rather than performance-cat acceleration.' },
  { pattern: /orana\s*44/i, performance: 7.3, offshore: 8.2, comfort: 8.4, passageSpeed: '6.5–8.5 kn', source: SOURCES.orana44, note: 'Moderate displacement and useful sail area make this an efficient conventional-keel cruiser with practical liveaboard volume.' },
  { pattern: /salina\s*48/i, performance: 7.3, offshore: 8.4, comfort: 8.9, passageSpeed: '6.5–8.5 kn', source: SOURCES.salina48, note: 'Length and sail area provide respectable passage pace; generous cruising volume and payload remain the stronger side of the tradeoff.' },
  { pattern: /privilege\s*495|privilège\s*495/i, performance: 7.2, offshore: 8.9, comfort: 9.1, passageSpeed: '7–9 kn', source: SOURCES.privilege495, note: 'Substantial build, protected living space and seakindly behavior prioritize offshore confidence and comfort over light-air acceleration.' },
  { pattern: /helia\s*44/i, performance: 7.1, offshore: 8.3, comfort: 8.9, passageSpeed: '6.5–8.5 kn', source: SOURCES.helia44, note: 'Comfort-forward volume and payload are paired with credible reaching pace, but light-air and upwind efficiency trail leaner designs.' },
  { pattern: /leopard\s*44/i, performance: 7.2, offshore: 8.4, comfort: 8.4, passageSpeed: '6.5–8.5 kn', source: SOURCES.leopard44, note: 'A practical short-handed bluewater platform with balanced systems and volume; fixed keels and cruising load cap pure performance.' },
  { pattern: /lipari\s*41/i, performance: 6.8, offshore: 7.9, comfort: 8.2, passageSpeed: '6–8 kn', source: SOURCES.lipari41, note: 'Compact dimensions and moderate sail power deliver competent cruising pace with useful interior volume for the length.' },
  { pattern: /lagoon\s*500/i, performance: 6.4, offshore: 8.5, comfort: 9.6, passageSpeed: '7–9 kn', source: SOURCES.lagoon500, note: 'Waterline length supports passage averages, while high displacement and windage make space and payload the dominant advantages.' },
  { pattern: /lagoon\s*42/i, performance: 6.3, offshore: 8.1, comfort: 9.0, passageSpeed: '6.5–8.5 kn', source: SOURCES.lagoon42, note: 'A high-volume modern cruiser with easy handling and good reaching pace; light-air and pointing performance are secondary priorities.' },
  { pattern: /lagoon\s*400/i, performance: 6.2, offshore: 8.0, comfort: 8.6, passageSpeed: '6–8 kn', source: SOURCES.lagoon400, note: 'A capable fixed-keel cruiser whose living space and payload tolerance outweigh modest light-air efficiency.' },
  { pattern: /lagoon\s*40\b/i, performance: 6.0, offshore: 7.8, comfort: 8.5, passageSpeed: '6–8 kn', source: SOURCES.lagoon40, note: 'Easy handling and modern volume suit liveaboard use; reaching sails matter materially when the breeze is light.' },
  { pattern: /lagoon\s*440/i, performance: 5.8, offshore: 8.1, comfort: 9.0, passageSpeed: '6–8 kn', source: SOURCES.lagoon440, note: 'Flybridge windage and loaded displacement trade sailing response for protected social space, payload and proven cruising utility.' },
  { pattern: /lagoon\s*450/i, performance: 5.7, offshore: 8.2, comfort: 9.3, passageSpeed: '6–8 kn', source: SOURCES.lagoon450, note: 'High volume, payload and easy sail handling make a strong liveaboard; flybridge windage and displacement limit light-air and upwind pace.' },
];

function profileLabel({ performance, offshore, comfort }) {
  if (performance >= 9.2 && offshore >= 9) return 'High-performance bluewater';
  if (performance >= 8.3 && comfort >= 8) return 'Balanced performance cruiser';
  if (performance >= 8.5) return 'Performance cruiser';
  if (performance >= 7 && offshore >= 8.3) return 'Balanced bluewater cruiser';
  if (comfort >= 8.8 && performance < 6.8) return 'Comfort-first cruiser';
  return 'Cruising all-rounder';
}

export function sailingProfile(model = '') {
  const match = PROFILES.find(({ pattern }) => pattern.test(model));
  if (!match) {
    const fallback = {
      performance: 6.5,
      offshore: 7,
      comfort: 7,
      passageSpeed: '6–8 kn',
      source: null,
      note: 'Generic design-family placeholder; validate against model-specific specifications, sea trials and owner passage logs.',
      confidence: 'low',
    };
    return { ...fallback, label: profileLabel(fallback) };
  }
  return { ...match, label: profileLabel(match), confidence: 'model-level' };
}

export const sailingMethodology = 'Model-level sailing profiles synthesize published sea trials, design characteristics and documented cruising behavior. They describe the design family, not the condition or performance of a particular vessel. Real passage performance varies materially with payload, sail inventory, bottom condition, sea state and seamanship.';
