import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import * as XLSX from 'xlsx';
import { parseGpiExcelAllYears } from '../fetchers/gpi.js';

/**
 * The frozen GPI-2023 workbook (xlsx fallback) carries one sheet per domain, each with
 * the same layout: a blank row, a row holding a single space (the row sheet_to_json
 * takes as its key row), then "Country | iso3c | year..." and one row per country.
 * The "Ongoing Conflict" sheet is the gpi_conflict domain.
 */
function buildGpiWorkbook(): Buffer {
  // null (not '') so the blank cells are truly empty, as in the real workbook: '' cells
  // would give sheet_to_json keys like "" instead of the __EMPTY names the parser reads.
  const blank = [null, null, null, null];
  const spacer = [null, null, null, ' '];
  const header = ['Country', 'iso3c', 2022, 2023];
  const sheet = (rows: unknown[][]) => XLSX.utils.aoa_to_sheet([blank, spacer, header, ...rows]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    sheet([
      ['Germany', 'DEU', 1.4, 1.5],
      ['Ecuador', 'ECU', 2.2, 2.3],
    ]),
    'Overall Scores',
  );
  XLSX.utils.book_append_sheet(
    workbook,
    sheet([
      ['Germany', 'DEU', 1.1, 1.2],
      ['Ecuador', 'ECU', 2.0, 2.1],
    ]),
    'Ongoing Conflict',
  );
  XLSX.utils.book_append_sheet(
    workbook,
    sheet([['Germany', 'DEU', 1.3, 1.4]]),
    'Militarisation',
  );
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('GPI xlsx fallback: gpi_conflict from the Ongoing Conflict sheet', () => {
  it('maps the Ongoing Conflict sheet to gpi_conflict for every year column', () => {
    const byYear = parseGpiExcelAllYears(buildGpiWorkbook());

    const deu2023 = byYear.get(2023)?.filter((i) => i.countryIso3 === 'DEU') ?? [];
    const values = Object.fromEntries(deu2023.map((i) => [i.indicatorName, i.value]));
    assert.deepEqual(values, {
      gpi_overall: 1.5,
      gpi_conflict: 1.2,
      gpi_militarisation: 1.4,
    });

    const conflict2022 = byYear.get(2022)?.find(
      (i) => i.indicatorName === 'gpi_conflict' && i.countryIso3 === 'ECU',
    );
    assert.equal(conflict2022?.value, 2.0);
    assert.equal(conflict2022?.year, 2022);
  });
});
