import { describe, it, before } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const DIST_CLIENT = join(ROOT, 'dist', 'client');

// --- Build output exists ---

describe('Phase 1: build produces EN and IT pages', () => {
  it('dist/client/en/index.html exists', () => {
    assert.ok(existsSync(join(DIST_CLIENT, 'en', 'index.html')), 'EN page missing from build output');
  });

  it('dist/client/it/index.html exists', () => {
    assert.ok(existsSync(join(DIST_CLIENT, 'it', 'index.html')), 'IT page missing from build output');
  });

  it('dist/client/index.html exists (root redirect)', () => {
    assert.ok(existsSync(join(DIST_CLIENT, 'index.html')), 'Root redirect page missing');
  });
});

// --- EN page content ---

describe('Phase 1: EN page renders locale-appropriate content', () => {
  let html: string;

  before(() => {
    html = readFileSync(join(DIST_CLIENT, 'en', 'index.html'), 'utf-8');
  });

  it('has html lang="en" attribute', () => {
    assert.match(html, /lang="en"/, 'EN page must have lang="en"');
  });

  it('contains English title', () => {
    assert.ok(html.includes('Is It Safe to Travel?'), 'EN page must contain English site title');
  });

  it('contains English hero heading', () => {
    assert.ok(html.includes('Is your destination safe?'), 'EN page must contain English hero text');
  });

  it('contains English meta description', () => {
    assert.ok(
      html.includes('Check safety scores for 200+ travel destinations'),
      'EN page must contain English meta description'
    );
  });

  it('contains English footer disclaimer', () => {
    assert.ok(
      html.includes('informational purposes only'),
      'EN page must contain English disclaimer'
    );
  });
});

// --- IT page content ---

describe('Phase 1: IT page renders locale-appropriate content', () => {
  let html: string;

  before(() => {
    html = readFileSync(join(DIST_CLIENT, 'it', 'index.html'), 'utf-8');
  });

  it('has html lang="it" attribute', () => {
    assert.match(html, /lang="it"/, 'IT page must have lang="it"');
  });

  it('contains Italian title', () => {
    assert.ok(html.includes('Si Puo Viaggiare in Sicurezza?'), 'IT page must contain Italian site title');
  });

  it('contains Italian hero heading', () => {
    assert.ok(html.includes('La tua destinazione e sicura?'), 'IT page must contain Italian hero text');
  });

  it('contains Italian meta description', () => {
    assert.ok(
      html.includes('punteggi di sicurezza per oltre 200 destinazioni'),
      'IT page must contain Italian meta description'
    );
  });

  it('contains Italian footer disclaimer', () => {
    assert.ok(
      html.includes('solo scopo informativo'),
      'IT page must contain Italian disclaimer'
    );
  });
});

// --- hreflang tags ---

describe('Phase 1: hreflang tags link EN and IT correctly', () => {
  let enHtml: string;
  let itHtml: string;

  before(() => {
    enHtml = readFileSync(join(DIST_CLIENT, 'en', 'index.html'), 'utf-8');
    itHtml = readFileSync(join(DIST_CLIENT, 'it', 'index.html'), 'utf-8');
  });

  it('EN page has hreflang="en" alternate link', () => {
    assert.ok(
      enHtml.includes('hreflang="en"'),
      'EN page must have hreflang="en" tag'
    );
  });

  it('EN page has hreflang="it" alternate link', () => {
    assert.ok(
      enHtml.includes('hreflang="it"'),
      'EN page must have hreflang="it" tag'
    );
  });

  it('EN page has hreflang="x-default" alternate link', () => {
    assert.ok(
      enHtml.includes('hreflang="x-default"'),
      'EN page must have hreflang="x-default" tag'
    );
  });

  it('IT page has hreflang="en" alternate link', () => {
    assert.ok(
      itHtml.includes('hreflang="en"'),
      'IT page must have hreflang="en" tag'
    );
  });

  it('IT page has hreflang="it" alternate link', () => {
    assert.ok(
      itHtml.includes('hreflang="it"'),
      'IT page must have hreflang="it" tag'
    );
  });

  it('IT page has hreflang="x-default" alternate link', () => {
    assert.ok(
      itHtml.includes('hreflang="x-default"'),
      'IT page must have hreflang="x-default" tag'
    );
  });

  it('EN page hreflang links point to correct URLs', () => {
    assert.ok(
      enHtml.includes('href="https://isitsafetotravel.com/en/"'),
      'EN hreflang must point to /en/'
    );
    assert.ok(
      enHtml.includes('href="https://isitsafetotravel.com/it/"'),
      'EN hreflang must point to /it/'
    );
  });

  it('IT page hreflang links point to correct URLs', () => {
    assert.ok(
      itHtml.includes('href="https://isitsafetotravel.com/en/"'),
      'IT hreflang must point to /en/'
    );
    assert.ok(
      itHtml.includes('href="https://isitsafetotravel.com/it/"'),
      'IT hreflang must point to /it/'
    );
  });
});

// --- Root redirect ---

describe('Phase 1: root page detects language and redirects', () => {
  let html: string;

  before(() => {
    html = readFileSync(join(DIST_CLIENT, 'index.html'), 'utf-8');
  });

  it('contains meta refresh fallback to /en/', () => {
    assert.ok(
      html.includes('url=/en/'),
      'Root page must have meta refresh fallback to /en/'
    );
  });

  it('contains JavaScript language detection script', () => {
    assert.ok(
      html.includes('navigator.language'),
      'Root page must use navigator.language for detection'
    );
  });

  it('redirects Italian browsers to /it/', () => {
    assert.ok(
      html.includes("'/it/'") || html.includes('"/it/"'),
      'Root page must redirect Italian browsers to /it/'
    );
  });

  it('redirects non-Italian browsers to /en/', () => {
    assert.ok(
      html.includes("'/en/'") || html.includes('"/en/"'),
      'Root page must redirect non-Italian browsers to /en/'
    );
  });
});

// --- Language switcher in header ---

describe('Phase 1: language switcher links between EN and IT', () => {
  let enHtml: string;
  let itHtml: string;

  before(() => {
    enHtml = readFileSync(join(DIST_CLIENT, 'en', 'index.html'), 'utf-8');
    itHtml = readFileSync(join(DIST_CLIENT, 'it', 'index.html'), 'utf-8');
  });

  it('EN page has link to /it/ for language switching', () => {
    assert.ok(
      enHtml.includes('href="/it/"'),
      'EN page must have link to Italian version'
    );
  });

  it('IT page has link to /en/ for language switching', () => {
    assert.ok(
      itHtml.includes('href="/en/"'),
      'IT page must have link to English version'
    );
  });

  it('EN page marks EN as current language', () => {
    assert.ok(
      enHtml.includes('aria-current="page"'),
      'EN page must mark current language with aria-current'
    );
  });
});

// --- CI/CD pipeline ---

describe('Phase 1: CI/CD pipeline configured for Cloudflare deployment', () => {
  let yml: string;

  before(() => {
    yml = readFileSync(join(ROOT, '.github', 'workflows', 'deploy.yml'), 'utf-8');
  });

  it('deploy.yml exists', () => {
    assert.ok(existsSync(join(ROOT, '.github', 'workflows', 'deploy.yml')));
  });

  it('triggers on push to main', () => {
    assert.ok(yml.includes('push:'), 'Must trigger on push');
    assert.ok(yml.includes('main'), 'Must target main branch');
  });

  it('uses cloudflare/wrangler-action', () => {
    assert.ok(yml.includes('cloudflare/wrangler-action'), 'Must use wrangler-action');
  });

  it('deploys to Cloudflare Pages', () => {
    assert.ok(yml.includes('pages deploy'), 'Must run pages deploy command');
  });

  it('references required Cloudflare secrets', () => {
    assert.ok(yml.includes('CLOUDFLARE_API_TOKEN'), 'Must reference API token secret');
    assert.ok(yml.includes('CLOUDFLARE_ACCOUNT_ID'), 'Must reference account ID secret');
  });

  it('builds before deploying', () => {
    const buildIdx = yml.indexOf('npm run build');
    const deployIdx = yml.indexOf('pages deploy');
    assert.ok(buildIdx > 0, 'Must include npm run build step');
    assert.ok(buildIdx < deployIdx, 'Build must come before deploy');
  });
});

// --- Cloudflare adapter ---

describe('Phase 1: Cloudflare adapter configured in Astro', () => {
  let config: string;

  before(() => {
    config = readFileSync(join(ROOT, 'astro.config.mjs'), 'utf-8');
  });

  it('imports cloudflare adapter', () => {
    assert.ok(config.includes('@astrojs/cloudflare'), 'Must import cloudflare adapter');
  });

  it('sets adapter to cloudflare', () => {
    assert.ok(config.includes('adapter:'), 'Must set adapter configuration');
    assert.ok(config.includes('cloudflare'), 'Adapter must be cloudflare');
  });

  it('wrangler.toml exists with project config', () => {
    const toml = readFileSync(join(ROOT, 'wrangler.toml'), 'utf-8');
    assert.ok(toml.includes('isitsafetotravel'), 'Must set project name');
    assert.ok(toml.includes('compatibility_date'), 'Must set compatibility date');
  });
});

// --- Design tokens ---

describe('Phase 1: design tokens defined for warm travel-magazine feel', () => {
  let css: string;

  before(() => {
    css = readFileSync(join(ROOT, 'src', 'styles', 'global.css'), 'utf-8');
  });

  it('defines sand palette tokens', () => {
    assert.ok(css.includes('--color-sand-50'), 'Must define sand-50');
    assert.ok(css.includes('--color-sand-900'), 'Must define sand-900');
  });

  it('defines sage palette tokens', () => {
    assert.ok(css.includes('--color-sage-'), 'Must define sage palette');
  });

  it('defines colorblind-safe map gradient tokens', () => {
    assert.ok(css.includes('--color-safe'), 'Must define safe color');
    assert.ok(css.includes('--color-moderate'), 'Must define moderate color');
    assert.ok(css.includes('--color-danger'), 'Must define danger color');
  });

  it('defines terracotta accent tokens', () => {
    assert.ok(css.includes('--color-terracotta-'), 'Must define terracotta palette');
  });

  it('uses OKLCH color space', () => {
    assert.ok(css.includes('oklch('), 'Must use OKLCH color format');
  });

  it('defines typography tokens with DM Sans and Inter', () => {
    assert.ok(css.includes('DM Sans'), 'Must define DM Sans as heading font');
    assert.ok(css.includes('Inter'), 'Must define Inter as sans font');
  });

  it('includes dark mode support', () => {
    assert.ok(css.includes('prefers-color-scheme: dark'), 'Must include dark mode media query');
  });
});
