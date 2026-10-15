/**
 * UN M49 geographic sub-regions, for the "In the same region" list on country pages
 * (selectRelated in src/lib/comparisons.ts).
 *
 * WHY a second region map: regions.ts has six continent-scale buckets (europe, asia,
 * africa, americas, oceania, middle_east). They drive the region hubs and the scoring
 * prior, and they are too coarse to say "same region" to a reader: Afghanistan was
 * matched with North Korea, Laos with Turkmenistan, Algeria with Zambia. M49
 * sub-regions are a published standard and at the scale a traveller means.
 *
 * Source: UN Statistics Division, "Standard country or area codes for statistical use
 * (M49)", https://unstats.un.org/unsd/methodology/m49/ . Where M49 splits a region into
 * intermediate regions (Sub-Saharan Africa, Latin America and the Caribbean), the
 * intermediate region is used (Eastern Africa, Caribbean, South America, ...).
 * Two places M49 does not list on their own follow common practice: Kosovo (XKX) in
 * Southern Europe, Taiwan (TWN) in Eastern Asia. Antarctica (ATA) has no sub-region.
 *
 * Pure module: no I/O. Regions.ts is deliberately left untouched (the scoring engine
 * reads it).
 */

export type Subregion =
  | 'northern_africa'
  | 'eastern_africa'
  | 'middle_africa'
  | 'southern_africa'
  | 'western_africa'
  | 'caribbean'
  | 'central_america'
  | 'south_america'
  | 'northern_america'
  | 'central_asia'
  | 'eastern_asia'
  | 'south_eastern_asia'
  | 'southern_asia'
  | 'western_asia'
  | 'eastern_europe'
  | 'northern_europe'
  | 'southern_europe'
  | 'western_europe'
  | 'australia_new_zealand'
  | 'melanesia'
  | 'micronesia'
  | 'polynesia';

/** Members of each sub-region (ISO3), as listed by M49. */
const MEMBERS: Record<Subregion, readonly string[]> = {
  northern_africa: ['DZA', 'EGY', 'ESH', 'LBY', 'MAR', 'SDN', 'TUN'],
  eastern_africa: [
    'ATF', 'BDI', 'COM', 'DJI', 'ERI', 'ETH', 'IOT', 'KEN', 'MDG', 'MOZ', 'MUS',
    'MWI', 'MYT', 'REU', 'RWA', 'SOM', 'SSD', 'SYC', 'TZA', 'UGA', 'ZMB', 'ZWE',
  ],
  middle_africa: ['AGO', 'CAF', 'CMR', 'COD', 'COG', 'GAB', 'GNQ', 'STP', 'TCD'],
  southern_africa: ['BWA', 'LSO', 'NAM', 'SWZ', 'ZAF'],
  western_africa: [
    'BEN', 'BFA', 'CIV', 'CPV', 'GHA', 'GIN', 'GMB', 'GNB', 'LBR', 'MLI', 'MRT',
    'NER', 'NGA', 'SEN', 'SHN', 'SLE', 'TGO',
  ],
  caribbean: [
    'ABW', 'AIA', 'ATG', 'BES', 'BHS', 'BLM', 'BRB', 'CUB', 'CUW', 'CYM', 'DMA',
    'DOM', 'GLP', 'GRD', 'HTI', 'JAM', 'KNA', 'LCA', 'MAF', 'MSR', 'MTQ', 'PRI',
    'SXM', 'TCA', 'TTO', 'VCT', 'VGB', 'VIR',
  ],
  central_america: ['BLZ', 'CRI', 'GTM', 'HND', 'MEX', 'NIC', 'PAN', 'SLV'],
  south_america: [
    'ARG', 'BOL', 'BRA', 'BVT', 'CHL', 'COL', 'ECU', 'FLK', 'GUF', 'GUY', 'PER',
    'PRY', 'SGS', 'SUR', 'URY', 'VEN',
  ],
  northern_america: ['CAN', 'GRL', 'SPM', 'USA'],
  central_asia: ['KAZ', 'KGZ', 'TJK', 'TKM', 'UZB'],
  eastern_asia: ['CHN', 'HKG', 'JPN', 'KOR', 'MAC', 'MNG', 'PRK', 'TWN'],
  south_eastern_asia: ['BRN', 'IDN', 'KHM', 'LAO', 'MMR', 'MYS', 'PHL', 'SGP', 'THA', 'TLS', 'VNM'],
  southern_asia: ['AFG', 'BGD', 'BTN', 'IND', 'IRN', 'LKA', 'MDV', 'NPL', 'PAK'],
  western_asia: [
    'ARE', 'ARM', 'AZE', 'BHR', 'CYP', 'GEO', 'IRQ', 'ISR', 'JOR', 'KWT', 'LBN',
    'OMN', 'PSE', 'QAT', 'SAU', 'SYR', 'TUR', 'YEM',
  ],
  eastern_europe: ['BGR', 'BLR', 'CZE', 'HUN', 'MDA', 'POL', 'ROU', 'RUS', 'SVK', 'UKR'],
  northern_europe: [
    'ALA', 'DNK', 'EST', 'FIN', 'FRO', 'GBR', 'GGY', 'IMN', 'IRL', 'ISL', 'JEY',
    'LTU', 'LVA', 'NOR', 'SJM', 'SWE',
  ],
  southern_europe: [
    'ALB', 'AND', 'BIH', 'ESP', 'GIB', 'GRC', 'HRV', 'ITA', 'MKD', 'MLT', 'MNE',
    'PRT', 'SMR', 'SRB', 'SVN', 'VAT', 'XKX',
  ],
  western_europe: ['AUT', 'BEL', 'CHE', 'DEU', 'FRA', 'LIE', 'LUX', 'MCO', 'NLD'],
  australia_new_zealand: ['AUS', 'CCK', 'CXR', 'NFK', 'NZL'],
  melanesia: ['FJI', 'NCL', 'PNG', 'SLB', 'VUT'],
  micronesia: ['FSM', 'GUM', 'KIR', 'MHL', 'MNP', 'NRU', 'PLW', 'UMI'],
  polynesia: ['ASM', 'COK', 'NIU', 'PCN', 'PYF', 'TKL', 'TON', 'TUV', 'WLF', 'WSM'],
};

/** ISO3 -> M49 sub-region, built once from MEMBERS. */
export const subregionMap: Readonly<Record<string, Subregion>> = Object.freeze(
  Object.fromEntries(
    (Object.entries(MEMBERS) as Array<[Subregion, readonly string[]]>).flatMap(([region, codes]) =>
      codes.map((iso3) => [iso3, region] as const),
    ),
  ),
);

/** The M49 sub-region of a place, or null when it has none (Antarctica, unknown codes). */
export function getSubregion(iso3: string): Subregion | null {
  return Object.prototype.hasOwnProperty.call(subregionMap, iso3) ? subregionMap[iso3] : null;
}
