import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  GPI_JSON_DOMAIN_FIELDS,
  deserializeGpiByYear,
  gpiEntriesToIndicators,
  selectGpiIndicatorsForYear,
  serializeGpiByYear,
  type GpiJsonEntry,
} from '../fetchers/gpi.js';
import type { RawIndicator } from '../types.js';

/** A real-shaped GPI JSON row (values from the 2026 manifest file), including the ind.* block. */
const DEU_ROW = {
  iso3: 'DEU',
  name: 'Germany',
  rank: 9,
  overall: 1.4,
  militarisation: 1.9,
  safety: 1.2,
  conflict: 1.101,
  ind: { poli: 1.0, rela: 1.0, icon: 1.0, econ: 1.5, homi: 1.2 },
} as unknown as GpiJsonEntry;

function valuesFor(indicators: RawIndicator[], iso3: string): Record<string, number> {
  return Object.fromEntries(
    indicators.filter((i) => i.countryIso3 === iso3).map((i) => [i.indicatorName, i.value]),
  );
}

describe('GPI per-year JSON: domain fields', () => {
  it('lists exactly the four domain fields the engine reads', () => {
    assert.deepEqual(
      GPI_JSON_DOMAIN_FIELDS.map((d) => d.indicator),
      ['gpi_overall', 'gpi_safety_security', 'gpi_militarisation', 'gpi_conflict'],
    );
    assert.deepEqual(
      GPI_JSON_DOMAIN_FIELDS.map((d) => d.field),
      ['overall', 'safety', 'militarisation', 'conflict'],
    );
  });

  it('maps each domain field to its indicator with the year and source attached', () => {
    const indicators = gpiEntriesToIndicators([DEU_ROW], 2026);
    assert.deepEqual(valuesFor(indicators, 'DEU'), {
      gpi_overall: 1.4,
      gpi_safety_security: 1.2,
      gpi_militarisation: 1.9,
      gpi_conflict: 1.101,
    });
    for (const ind of indicators) {
      assert.equal(ind.year, 2026);
      assert.equal(ind.source, 'gpi');
    }
  });
});

describe('GPI per-year JSON: gpi_conflict', () => {
  it('takes gpi_conflict from the conflict field, never from an ind.* sub-indicator', () => {
    const indicators = gpiEntriesToIndicators([DEU_ROW], 2026);
    const conflict = indicators.find((i) => i.indicatorName === 'gpi_conflict');
    assert.equal(conflict?.value, 1.101, 'value is the conflict domain, not ind.poli (1.0) or ind.icon (1.0)');

    const names = new Set(indicators.map((i) => i.indicatorName));
    for (const subIndicator of ['poli', 'rela', 'icon', 'econ', 'homi', 'gpi_poli', 'gpi_icon', 'gpi_homi']) {
      assert.equal(names.has(subIndicator), false, `ind.${subIndicator} is never emitted`);
    }
    assert.equal(
      [...names].every((n) => n.startsWith('gpi_') && !n.startsWith('gpi_ind')),
      true,
      'only the four domain indicators are produced',
    );
  });

  it('omits gpi_conflict when the field is missing or not a number, instead of writing 0', () => {
    const missing = { iso3: 'ECU', overall: 2.2, safety: 2.5, militarisation: 2.0 } as unknown as GpiJsonEntry;
    const stringy = { iso3: 'ISR', overall: 2.7, safety: 2.9, militarisation: 2.1, conflict: '3.2' } as unknown as GpiJsonEntry;

    const indicators = gpiEntriesToIndicators([missing, stringy], 2025);

    assert.equal(indicators.some((i) => i.countryIso3 === 'ECU' && i.indicatorName === 'gpi_conflict'), false);
    assert.equal(indicators.some((i) => i.countryIso3 === 'ISR' && i.indicatorName === 'gpi_conflict'), false);
    assert.equal(valuesFor(indicators, 'ECU').gpi_overall, 2.2, 'the other domains still load');
    assert.equal(valuesFor(indicators, 'ISR').gpi_safety_security, 2.9);
  });

  it('skips rows whose iso3 is unknown to the project', () => {
    const indicators = gpiEntriesToIndicators(
      [{ iso3: 'XXX', overall: 1, safety: 1, militarisation: 1, conflict: 1 } as GpiJsonEntry, { overall: 1 } as GpiJsonEntry],
      2026,
    );
    assert.equal(indicators.length, 0);
  });

  it('survives the per-year persistence roundtrip used by backfill', () => {
    const byYear = new Map<number, RawIndicator[]>([
      [2025, gpiEntriesToIndicators([DEU_ROW], 2025)],
      [2026, gpiEntriesToIndicators([DEU_ROW], 2026)],
    ]);
    const restored = deserializeGpiByYear(serializeGpiByYear(byYear));

    const selected = selectGpiIndicatorsForYear(restored, 2026);
    assert.equal(
      selected.find((i) => i.indicatorName === 'gpi_conflict' && i.countryIso3 === 'DEU')?.value,
      1.101,
    );
    const historical = selectGpiIndicatorsForYear(restored, 2025);
    assert.equal(historical[0].year, 2025);
  });
});
