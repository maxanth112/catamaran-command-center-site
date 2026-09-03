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
  nautitech46: 'https://sailmagazine.com/boats/boat-review-bavaria-nautitech-46-fly/',
  knysna480: 'https://www.cruisingworld.com/sailboats/knysna-480-new-cat-set-prowl/',
  privilege495: 'https://www.mediaship.it/sea-trials/privilege-495',
  voyage480: 'https://www.katamarans.com/voyage-480/',
  salina48: 'https://sailingmagazine.net/article-permalink-322.html',
};

const PROFILES = [
  [/nautitech\s*46/i, 8.5, '7–9 kn', 'Performance-leaning cruiser', SOURCES.nautitech46, 'Responsive for the comfort class; reported peaks are much higher than prudent passage averages.'],
  [/voyage\s*480/i, 8.4, '7–9 kn', 'Upper-middle performance', SOURCES.voyage480, 'Generous sail plan and relatively light profile for a cruising cat.'],
  [/privilege\s*495/i, 8.2, '7–9 kn', 'Seakindly fast cruiser', SOURCES.privilege495, 'Strong light-air efficiency reported; load and sea state still dominate passage pace.'],
  [/leopard\s*46/i, 8.1, '7–9 kn', 'Fast bluewater cruiser', SOURCES.leopard46, 'Fine hulls and a powerful rig give this older design unusually good light-air pace.'],
  [/orana\s*44/i, 8.0, '7–8.5 kn', 'Efficient cruiser', SOURCES.orana44, 'Tested around 7–7.5 knots in 10–12 knots of breeze.'],
  [/helia\s*44/i, 7.9, '6.5–8.5 kn', 'Balanced cruiser', SOURCES.helia44, 'Comfort-forward but credible; tests reached the high sixes upwind in 12 knots.'],
  [/knysna\s*480/i, 7.8, '6.5–8.5 kn', 'Balanced bluewater cruiser', SOURCES.knysna480, 'About 5 knots close-hauled in just over 8 knots of test wind.'],
  [/salina\s*48/i, 7.8, '6.5–8.5 kn', 'Balanced cruiser', SOURCES.salina48, 'A generous sail plan supports respectable passage pace; verify against the specific loaded displacement.'],
  [/lagoon\s*42/i, 7.7, '6.5–8.5 kn', 'Modern comfort cruiser', SOURCES.lagoon42, 'Often 5–7 knots in gentle breeze and 8–9 in moderate reaching conditions with the right sails.'],
  [/leopard\s*44/i, 7.7, '6.5–8.5 kn', 'Balanced bluewater cruiser', SOURCES.leopard44, 'Easy short-handed platform; actual pace depends heavily on loading and headsail inventory.'],
  [/lipari\s*41/i, 7.6, '6–8 kn', 'Efficient compact cruiser', SOURCES.lipari41, 'A test recorded 8.2 knots at 60° in 16 knots apparent wind.'],
  [/lagoon\s*500/i, 7.6, '7–9 kn', 'Large passage cruiser', SOURCES.lagoon500, 'Length helps passage pace; load and high ownership burden temper the advantage.'],
  [/lagoon\s*40\b/i, 7.4, '6–8 kn', 'Modern comfort cruiser', SOURCES.lagoon40, 'Can reach quickly with a Code 0; light-air pace suffers without reaching sails.'],
  [/lagoon\s*400/i, 7.3, '6–8 kn', 'Comfort cruiser', SOURCES.lagoon400, 'Competent in a breeze; expect light-air pace to depend heavily on reaching sails and cruising load.'],
  [/lagoon\s*440/i, 7.2, '6–8 kn', 'Comfort-first cruiser', SOURCES.lagoon440, 'Capable passage boat, but flybridge windage and cruising load limit light-air pace.'],
  [/lagoon\s*450/i, 7.1, '6–8 kn', 'Comfort-first cruiser', SOURCES.lagoon450, 'Expect roughly 6 knots close-hauled in 12 knots and stronger reaching pace; loading matters.'],
];

export function sailingProfile(model = '') {
  const match = PROFILES.find(([pattern]) => pattern.test(model));
  if (!match) {
    return {
      score: 7,
      passageSpeed: '6–8 kn',
      label: 'Cruising estimate',
      source: null,
      note: 'Generic planning range; validate with a model-specific sea trial and owner logs.',
      confidence: 'low',
    };
  }
  const [, score, passageSpeed, label, source, note] = match;
  return { score, passageSpeed, label, source, note, confidence: 'model-level' };
}

export const sailingMethodology = 'Planning estimates combine published model tests and design-family evidence. They are not boat-specific predictions: loading, sea state, sail inventory, bottom condition and seamanship can move real passage averages materially.';
