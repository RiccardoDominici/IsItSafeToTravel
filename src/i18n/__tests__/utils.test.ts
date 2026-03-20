import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  getLangFromUrl,
  useTranslations,
  getLocalizedPath,
  getAlternateLinks,
  getRouteFromUrl,
} from '../utils.js';

// --- getLangFromUrl ---

describe('getLangFromUrl', () => {
  it('returns en for /en/ path', () => {
    const url = new URL('https://example.com/en/');
    assert.equal(getLangFromUrl(url), 'en');
  });

  it('returns it for /it/ path', () => {
    const url = new URL('https://example.com/it/');
    assert.equal(getLangFromUrl(url), 'it');
  });

  it('returns en for /en/about/ path', () => {
    const url = new URL('https://example.com/en/about/');
    assert.equal(getLangFromUrl(url), 'en');
  });

  it('returns it for /it/chi-siamo/ path', () => {
    const url = new URL('https://example.com/it/chi-siamo/');
    assert.equal(getLangFromUrl(url), 'it');
  });

  it('returns fr for /fr/ path', () => {
    const url = new URL('https://example.com/fr/something');
    assert.equal(getLangFromUrl(url), 'fr');
  });

  it('returns pt for /pt/ path', () => {
    const url = new URL('https://example.com/pt/something');
    assert.equal(getLangFromUrl(url), 'pt');
  });

  it('returns default en for unknown locale prefix', () => {
    const url = new URL('https://example.com/de/something');
    assert.equal(getLangFromUrl(url), 'en');
  });

  it('returns default en for root path', () => {
    const url = new URL('https://example.com/');
    assert.equal(getLangFromUrl(url), 'en');
  });
});

// --- useTranslations ---

describe('useTranslations', () => {
  it('returns English translation for en locale', () => {
    const t = useTranslations('en');
    assert.equal(t('site.title'), 'Is It Safe to Travel?');
  });

  it('returns Italian translation for it locale', () => {
    const t = useTranslations('it');
    assert.equal(t('site.title'), 'Si Puo Viaggiare in Sicurezza?');
  });

  it('returns locale-appropriate nav text for en', () => {
    const t = useTranslations('en');
    assert.equal(t('nav.home'), 'Home');
    assert.equal(t('nav.about'), 'About');
    assert.equal(t('nav.methodology'), 'Methodology');
  });

  it('returns locale-appropriate nav text for it', () => {
    const t = useTranslations('it');
    assert.equal(t('nav.home'), 'Home');
    assert.equal(t('nav.about'), 'Chi Siamo');
    assert.equal(t('nav.methodology'), 'Metodologia');
  });

  it('returns English hero text', () => {
    const t = useTranslations('en');
    assert.equal(t('hero.title'), 'Is your destination safe?');
  });

  it('returns Italian hero text', () => {
    const t = useTranslations('it');
    assert.equal(t('hero.title'), 'La tua destinazione e sicura?');
  });
});

// --- getLocalizedPath ---

describe('getLocalizedPath', () => {
  it('switches /en/ to /it/', () => {
    assert.equal(getLocalizedPath('/en/', 'it'), '/it/');
  });

  it('switches /it/ to /en/', () => {
    assert.equal(getLocalizedPath('/it/', 'en'), '/en/');
  });

  it('translates known route slug from en to it', () => {
    const result = getLocalizedPath('/en/about/', 'it');
    // Implementation strips trailing slash via .filter(Boolean)
    assert.equal(result, '/it/chi-siamo');
  });

  it('translates known route slug from it to en', () => {
    const result = getLocalizedPath('/it/chi-siamo/', 'en');
    assert.equal(result, '/en/about');
  });

  it('translates methodology slug from en to it', () => {
    const result = getLocalizedPath('/en/methodology/', 'it');
    assert.equal(result, '/it/metodologia');
  });

  it('translates country slug from en to it', () => {
    const result = getLocalizedPath('/en/country/', 'it');
    assert.equal(result, '/it/paese');
  });

  it('preserves unknown segments unchanged', () => {
    const result = getLocalizedPath('/en/unknown-page/', 'it');
    assert.equal(result, '/it/unknown-page');
  });
});

// --- getAlternateLinks ---

describe('getAlternateLinks', () => {
  it('returns links for all locales', () => {
    const links = getAlternateLinks('/en/');
    assert.equal(links.length, 5);

    const enLink = links.find((l) => l.lang === 'en');
    const itLink = links.find((l) => l.lang === 'it');
    const frLink = links.find((l) => l.lang === 'fr');
    const ptLink = links.find((l) => l.lang === 'pt');

    assert.ok(enLink, 'should have en link');
    assert.ok(itLink, 'should have it link');
    assert.ok(frLink, 'should have fr link');
    assert.ok(ptLink, 'should have pt link');
    assert.equal(enLink.href, '/en/');
    assert.equal(itLink.href, '/it/');
    assert.equal(frLink.href, '/fr/');
    assert.equal(ptLink.href, '/pt/');
  });

  it('translates route slugs in alternate links', () => {
    const links = getAlternateLinks('/en/about/');
    const itLink = links.find((l) => l.lang === 'it');
    assert.ok(itLink);
    assert.equal(itLink.href, '/it/chi-siamo');
  });
});

// --- getRouteFromUrl ---

describe('getRouteFromUrl', () => {
  it('strips language prefix from URL', () => {
    const url = new URL('https://example.com/en/about/');
    assert.equal(getRouteFromUrl(url), '/about');
  });

  it('strips it prefix from URL', () => {
    const url = new URL('https://example.com/it/chi-siamo/');
    assert.equal(getRouteFromUrl(url), '/chi-siamo');
  });

  it('returns / for root locale URL', () => {
    const url = new URL('https://example.com/en/');
    assert.equal(getRouteFromUrl(url), '/');
  });
});
