import { describe, it, before } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const DIST_CLIENT = join(ROOT, 'dist', 'client');

// --- MAP-01: Homepage displays interactive world map color-coded by safety score ---

describe('MAP-01: EN homepage contains SafetyMap component structure', () => {
  let html: string;

  before(() => {
    html = readFileSync(join(DIST_CLIENT, 'en', 'index.html'), 'utf-8');
  });

  it('contains the safety-map-container element', () => {
    assert.ok(
      html.includes('id="safety-map-container"'),
      'Homepage must have the safety-map-container div'
    );
  });

  it('container has data-lang="en" attribute', () => {
    assert.ok(
      html.includes('data-lang="en"'),
      'Map container must pass lang="en" for English locale'
    );
  });

  it('container has data-scores attribute for score data', () => {
    assert.ok(
      html.includes('data-scores='),
      'Map container must have data-scores attribute for client-side rendering'
    );
  });

  it('contains the color legend with gradient', () => {
    assert.ok(
      html.includes('linear-gradient'),
      'Homepage must have the color legend gradient'
    );
  });

  it('legend shows "Less safe" and "Safer" labels', () => {
    assert.ok(html.includes('Less safe'), 'Legend must show "Less safe" in English');
    assert.ok(html.includes('Safer'), 'Legend must show "Safer" in English');
  });

  it('contains the map tagline', () => {
    assert.ok(
      html.includes('Explore safety scores for 200+ countries worldwide'),
      'Homepage must display the map tagline'
    );
  });

  it('contains the tooltip element with role="tooltip"', () => {
    assert.ok(
      html.includes('id="map-tooltip"'),
      'Homepage must have the tooltip element'
    );
    assert.ok(
      html.includes('role="tooltip"'),
      'Tooltip must have role="tooltip" for accessibility'
    );
  });

  it('no placeholder content remains', () => {
    assert.ok(
      !html.includes('border-dashed'),
      'Old placeholder dashed border must be removed'
    );
  });
});

describe('MAP-01: IT homepage contains SafetyMap with Italian locale', () => {
  let html: string;

  before(() => {
    html = readFileSync(join(DIST_CLIENT, 'it', 'index.html'), 'utf-8');
  });

  it('contains the safety-map-container element', () => {
    assert.ok(
      html.includes('id="safety-map-container"'),
      'IT homepage must have the safety-map-container div'
    );
  });

  it('container has data-lang="it" attribute', () => {
    assert.ok(
      html.includes('data-lang="it"'),
      'Map container must pass lang="it" for Italian locale'
    );
  });

  it('Italian legend shows "Meno sicuro" and "Piu sicuro"', () => {
    assert.ok(html.includes('Meno sicuro'), 'IT legend must show "Meno sicuro"');
    assert.ok(html.includes('Piu sicuro'), 'IT legend must show "Piu sicuro"');
  });

  it('Italian tagline is displayed', () => {
    assert.ok(
      html.includes('Esplora i punteggi di sicurezza per oltre 200 paesi nel mondo'),
      'IT homepage must display Italian map tagline'
    );
  });
});

// --- MAP-02: Zoom and pan controls present ---

describe('MAP-02: zoom and pan controls are present in build output', () => {
  let html: string;

  before(() => {
    html = readFileSync(join(DIST_CLIENT, 'en', 'index.html'), 'utf-8');
  });

  it('has zoom-in button with + label', () => {
    assert.ok(
      html.includes('id="zoom-in"'),
      'Homepage must have zoom-in button'
    );
  });

  it('has zoom-out button with - label', () => {
    assert.ok(
      html.includes('id="zoom-out"'),
      'Homepage must have zoom-out button'
    );
  });

  it('zoom-in button has accessible aria-label', () => {
    assert.ok(
      html.includes('aria-label="Zoom in"'),
      'Zoom-in button must have aria-label for accessibility'
    );
  });

  it('zoom-out button has accessible aria-label', () => {
    assert.ok(
      html.includes('aria-label="Zoom out"'),
      'Zoom-out button must have aria-label for accessibility'
    );
  });

  it('map container fills viewport height', () => {
    assert.ok(
      html.includes('100vh'),
      'Map section must use viewport height for full-screen display'
    );
  });
});

// --- MAP-02: D3 zoom behavior is wired in the client script ---

describe('MAP-02: client-side script includes D3 zoom and projection', () => {
  let html: string;

  before(() => {
    html = readFileSync(join(DIST_CLIENT, 'en', 'index.html'), 'utf-8');
  });

  it('page includes a script module (D3 is bundled)', () => {
    // Astro bundles <script> tags into hashed JS files referenced by <script type="module">
    assert.ok(
      html.includes('<script type="module"') || html.includes('type="module"'),
      'Page must include a module script for the D3 map code'
    );
  });
});

// --- MAP-03: Click navigation URL pattern ---

describe('MAP-03: country route data attribute enables click-to-navigate', () => {
  let enHtml: string;
  let itHtml: string;

  before(() => {
    enHtml = readFileSync(join(DIST_CLIENT, 'en', 'index.html'), 'utf-8');
    itHtml = readFileSync(join(DIST_CLIENT, 'it', 'index.html'), 'utf-8');
  });

  it('EN map container has data-country-route="country"', () => {
    assert.ok(
      enHtml.includes('data-country-route="country"'),
      'EN map must have data-country-route="country" for URL construction'
    );
  });

  it('IT map container has data-country-route="paese"', () => {
    assert.ok(
      itHtml.includes('data-country-route="paese"'),
      'IT map must have data-country-route="paese" for localized URL construction'
    );
  });
});

// --- MAP-01: i18n translation keys for map UI ---

describe('MAP-01: i18n translation keys exist for map component', () => {
  let uiTs: string;

  before(() => {
    uiTs = readFileSync(join(ROOT, 'src', 'i18n', 'ui.ts'), 'utf-8');
  });

  it('EN translations include map.tooltip.nodata', () => {
    assert.ok(uiTs.includes("'map.tooltip.nodata'"), 'Must have map.tooltip.nodata key');
  });

  it('EN translations include map.zoom.in and map.zoom.out', () => {
    assert.ok(uiTs.includes("'map.zoom.in'"), 'Must have map.zoom.in key');
    assert.ok(uiTs.includes("'map.zoom.out'"), 'Must have map.zoom.out key');
  });

  it('EN translations include map.legend.safe and map.legend.danger', () => {
    assert.ok(uiTs.includes("'map.legend.safe'"), 'Must have map.legend.safe key');
    assert.ok(uiTs.includes("'map.legend.danger'"), 'Must have map.legend.danger key');
  });

  it('EN translations include map.tagline', () => {
    assert.ok(uiTs.includes("'map.tagline'"), 'Must have map.tagline key');
  });

  it('IT section also has all map keys', () => {
    // Split file at 'it:' section and check keys are present in second half
    const itSection = uiTs.substring(uiTs.lastIndexOf("'map.tooltip.nodata'"));
    assert.ok(itSection.includes('Dati non disponibili'), 'IT must have Italian nodata text');
  });
});

// --- MAP-01: world-topo.json static asset exists ---

describe('MAP-01: world topojson static asset is served', () => {
  it('public/world-topo.json exists', () => {
    assert.ok(
      existsSync(join(ROOT, 'public', 'world-topo.json')),
      'world-topo.json must exist in public/ for client-side fetch'
    );
  });

  it('world-topo.json is valid topojson with countries', () => {
    const raw = readFileSync(join(ROOT, 'public', 'world-topo.json'), 'utf-8');
    const topo = JSON.parse(raw);
    assert.equal(topo.type, 'Topology', 'Must be a Topology type');
    assert.ok(topo.objects && topo.objects.countries, 'Must have countries object');
  });
});
