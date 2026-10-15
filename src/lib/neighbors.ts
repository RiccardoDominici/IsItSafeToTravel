/**
 * Land borders and sovereign states of the 248 places, for the country-page
 * comparison table (src/lib/comparisons.ts).
 *
 * Two relations, kept apart on purpose:
 *
 *  - landBorders: real LAND borders only, symmetric (A lists B exactly when B lists
 *    A), one entry for every place (an empty list for islands). Sea crossings
 *    (Channel, Øresund, Gulf, Korea Strait) are NOT here: across-sea places are
 *    picked by measured distance instead (src/data/country-proximity.json), and
 *    the table labels them with that distance. Mixing a few hand-picked sea links
 *    into this map is what left it one-sided before (Japan listed China, Korea did
 *    not; Fiji omitted New Zealand).
 *  - sovereignState: territory -> the state it belongs to, or that is responsible
 *    for its defence and foreign affairs (crown dependencies, free association).
 *    One-directional: Réunion shows France, France does not show its overseas
 *    territories. Left out where sovereignty is disputed (Western Sahara,
 *    Palestine, Kosovo, Taiwan) or absent (Antarctica).
 *
 * Land borders are checked against Natural Earth geometry by
 * scripts/generate-country-proximity.ts (every pair listed here must touch, every
 * touching pair must be listed) and locked by src/lib/__tests__/neighbors.test.ts.
 * Conventions where the facts need one:
 *  - Places the site treats separately keep their own borders: French Guiana (not
 *    France) borders Brazil and Suriname; Gibraltar (not the UK) borders Spain;
 *    Hong Kong and Macao border China; Saint-Martin and Sint Maarten share an island.
 *  - Spain-Morocco (Ceuta, Melilla) and UK-Ireland (Northern Ireland) count.
 *  - Canada-Greenland counts: the 2022 Hans Island agreement created a land border.
 *  - Leased or sovereign base areas do not create borders (Guantánamo: no USA-Cuba;
 *    Akrotiri and Dhekelia: no UK-Cyprus).
 *  - Western Sahara is its own place, so Morocco does not border Mauritania.
 *
 * Pure module: no I/O.
 */
import type { ScoredCountry } from '../pipeline/types';
import { officialScore } from './score-status';

export const landBorders: Readonly<Record<string, readonly string[]>> = {
  // --- Europe ---
  ALA: [],
  ALB: ['MNE', 'XKX', 'MKD', 'GRC'],
  AND: ['FRA', 'ESP'],
  AUT: ['DEU', 'CZE', 'SVK', 'HUN', 'SVN', 'ITA', 'CHE', 'LIE'],
  BEL: ['FRA', 'LUX', 'DEU', 'NLD'],
  BGR: ['ROU', 'SRB', 'MKD', 'GRC', 'TUR'],
  BIH: ['HRV', 'SRB', 'MNE'],
  BLR: ['POL', 'LTU', 'LVA', 'RUS', 'UKR'],
  CHE: ['DEU', 'FRA', 'ITA', 'AUT', 'LIE'],
  CYP: [],
  CZE: ['DEU', 'POL', 'SVK', 'AUT'],
  DEU: ['DNK', 'POL', 'CZE', 'AUT', 'CHE', 'FRA', 'LUX', 'BEL', 'NLD'],
  DNK: ['DEU'],
  ESP: ['FRA', 'PRT', 'AND', 'GIB', 'MAR'],
  EST: ['LVA', 'RUS'],
  FIN: ['SWE', 'NOR', 'RUS'],
  FRA: ['BEL', 'LUX', 'DEU', 'CHE', 'ITA', 'ESP', 'AND', 'MCO'],
  FRO: [],
  GBR: ['IRL'],
  GGY: [],
  GIB: ['ESP'],
  GRC: ['ALB', 'MKD', 'BGR', 'TUR'],
  HRV: ['SVN', 'HUN', 'SRB', 'BIH', 'MNE'],
  HUN: ['AUT', 'SVK', 'UKR', 'ROU', 'SRB', 'HRV', 'SVN'],
  IMN: [],
  IRL: ['GBR'],
  ISL: [],
  ITA: ['FRA', 'CHE', 'AUT', 'SVN', 'SMR', 'VAT'],
  JEY: [],
  LIE: ['CHE', 'AUT'],
  LTU: ['LVA', 'BLR', 'POL', 'RUS'],
  LUX: ['BEL', 'FRA', 'DEU'],
  LVA: ['EST', 'LTU', 'BLR', 'RUS'],
  MCO: ['FRA'],
  MDA: ['ROU', 'UKR'],
  MKD: ['ALB', 'GRC', 'BGR', 'SRB', 'XKX'],
  MLT: [],
  MNE: ['HRV', 'BIH', 'SRB', 'XKX', 'ALB'],
  NLD: ['BEL', 'DEU'],
  NOR: ['SWE', 'FIN', 'RUS'],
  POL: ['DEU', 'CZE', 'SVK', 'UKR', 'BLR', 'LTU', 'RUS'],
  PRT: ['ESP'],
  ROU: ['HUN', 'SRB', 'BGR', 'MDA', 'UKR'],
  RUS: ['NOR', 'FIN', 'EST', 'LVA', 'LTU', 'POL', 'BLR', 'UKR', 'GEO', 'AZE', 'KAZ', 'CHN', 'MNG', 'PRK'],
  SJM: [],
  SMR: ['ITA'],
  SRB: ['HUN', 'ROU', 'BGR', 'MKD', 'XKX', 'MNE', 'BIH', 'HRV'],
  SVK: ['CZE', 'POL', 'UKR', 'HUN', 'AUT'],
  SVN: ['ITA', 'AUT', 'HUN', 'HRV'],
  SWE: ['NOR', 'FIN'],
  UKR: ['POL', 'SVK', 'HUN', 'ROU', 'MDA', 'BLR', 'RUS'],
  VAT: ['ITA'],
  XKX: ['SRB', 'MNE', 'ALB', 'MKD'],

  // --- Western Asia ---
  ARE: ['OMN', 'SAU'],
  ARM: ['GEO', 'AZE', 'TUR', 'IRN'],
  AZE: ['GEO', 'ARM', 'TUR', 'IRN', 'RUS'],
  BHR: [],
  GEO: ['RUS', 'TUR', 'ARM', 'AZE'],
  IRQ: ['TUR', 'IRN', 'KWT', 'SAU', 'JOR', 'SYR'],
  ISR: ['LBN', 'SYR', 'JOR', 'EGY', 'PSE'],
  JOR: ['SYR', 'IRQ', 'SAU', 'ISR', 'PSE'],
  KWT: ['IRQ', 'SAU'],
  LBN: ['SYR', 'ISR'],
  OMN: ['ARE', 'SAU', 'YEM'],
  PSE: ['ISR', 'EGY', 'JOR'],
  QAT: ['SAU'],
  SAU: ['JOR', 'IRQ', 'KWT', 'QAT', 'ARE', 'OMN', 'YEM'],
  SYR: ['TUR', 'IRQ', 'JOR', 'ISR', 'LBN'],
  TUR: ['GRC', 'BGR', 'GEO', 'ARM', 'AZE', 'IRN', 'IRQ', 'SYR'],
  YEM: ['SAU', 'OMN'],

  // --- Southern, Central, Eastern and South-eastern Asia ---
  AFG: ['PAK', 'IRN', 'TKM', 'UZB', 'TJK', 'CHN'],
  BGD: ['IND', 'MMR'],
  BRN: ['MYS'],
  BTN: ['IND', 'CHN'],
  CHN: ['RUS', 'MNG', 'PRK', 'VNM', 'LAO', 'MMR', 'IND', 'BTN', 'NPL', 'PAK', 'AFG', 'TJK', 'KGZ', 'KAZ', 'HKG', 'MAC'],
  HKG: ['CHN'],
  IDN: ['MYS', 'PNG', 'TLS'],
  IND: ['PAK', 'CHN', 'NPL', 'BTN', 'BGD', 'MMR'],
  IRN: ['IRQ', 'TUR', 'ARM', 'AZE', 'TKM', 'AFG', 'PAK'],
  JPN: [],
  KAZ: ['RUS', 'CHN', 'KGZ', 'UZB', 'TKM'],
  KGZ: ['KAZ', 'CHN', 'TJK', 'UZB'],
  KHM: ['THA', 'LAO', 'VNM'],
  KOR: ['PRK'],
  LAO: ['CHN', 'VNM', 'KHM', 'THA', 'MMR'],
  LKA: [],
  MAC: ['CHN'],
  MDV: [],
  MMR: ['CHN', 'IND', 'BGD', 'LAO', 'THA'],
  MNG: ['RUS', 'CHN'],
  MYS: ['THA', 'IDN', 'BRN'],
  NPL: ['IND', 'CHN'],
  PAK: ['IND', 'CHN', 'AFG', 'IRN'],
  PHL: [],
  PRK: ['CHN', 'KOR', 'RUS'],
  SGP: [],
  THA: ['MMR', 'LAO', 'KHM', 'MYS'],
  TJK: ['KGZ', 'CHN', 'AFG', 'UZB'],
  TKM: ['KAZ', 'UZB', 'AFG', 'IRN'],
  TLS: ['IDN'],
  TWN: [],
  UZB: ['KAZ', 'KGZ', 'TJK', 'AFG', 'TKM'],
  VNM: ['CHN', 'LAO', 'KHM'],

  // --- Africa ---
  AGO: ['COD', 'COG', 'ZMB', 'NAM'],
  ATF: [],
  BDI: ['COD', 'RWA', 'TZA'],
  BEN: ['TGO', 'BFA', 'NER', 'NGA'],
  BFA: ['MLI', 'NER', 'BEN', 'TGO', 'GHA', 'CIV'],
  BWA: ['ZAF', 'NAM', 'ZMB', 'ZWE'],
  CAF: ['TCD', 'SDN', 'SSD', 'COD', 'COG', 'CMR'],
  CIV: ['LBR', 'GIN', 'MLI', 'BFA', 'GHA'],
  CMR: ['NGA', 'TCD', 'CAF', 'COG', 'GAB', 'GNQ'],
  COD: ['COG', 'CAF', 'SSD', 'UGA', 'RWA', 'BDI', 'TZA', 'ZMB', 'AGO'],
  COG: ['GAB', 'CMR', 'CAF', 'COD', 'AGO'],
  COM: [],
  CPV: [],
  DJI: ['ERI', 'ETH', 'SOM'],
  DZA: ['MAR', 'TUN', 'LBY', 'NER', 'MLI', 'MRT', 'ESH'],
  EGY: ['LBY', 'SDN', 'ISR', 'PSE'],
  ERI: ['SDN', 'ETH', 'DJI'],
  ESH: ['MAR', 'DZA', 'MRT'],
  ETH: ['ERI', 'DJI', 'SOM', 'KEN', 'SSD', 'SDN'],
  GAB: ['CMR', 'GNQ', 'COG'],
  GHA: ['CIV', 'BFA', 'TGO'],
  GIN: ['GNB', 'SEN', 'MLI', 'CIV', 'LBR', 'SLE'],
  GMB: ['SEN'],
  GNB: ['SEN', 'GIN'],
  GNQ: ['CMR', 'GAB'],
  IOT: [],
  KEN: ['ETH', 'SOM', 'TZA', 'UGA', 'SSD'],
  LBR: ['GIN', 'CIV', 'SLE'],
  LBY: ['TUN', 'DZA', 'NER', 'TCD', 'SDN', 'EGY'],
  LSO: ['ZAF'],
  MAR: ['DZA', 'ESP', 'ESH'],
  MDG: [],
  MLI: ['DZA', 'NER', 'BFA', 'CIV', 'GIN', 'SEN', 'MRT'],
  MOZ: ['ZAF', 'SWZ', 'ZWE', 'ZMB', 'MWI', 'TZA'],
  MRT: ['DZA', 'MLI', 'SEN', 'ESH'],
  MUS: [],
  MWI: ['MOZ', 'TZA', 'ZMB'],
  MYT: [],
  NAM: ['AGO', 'ZMB', 'BWA', 'ZAF'],
  NER: ['DZA', 'LBY', 'TCD', 'NGA', 'BEN', 'BFA', 'MLI'],
  NGA: ['BEN', 'NER', 'TCD', 'CMR'],
  REU: [],
  RWA: ['UGA', 'TZA', 'BDI', 'COD'],
  SDN: ['EGY', 'LBY', 'TCD', 'CAF', 'SSD', 'ETH', 'ERI'],
  SEN: ['MRT', 'MLI', 'GIN', 'GNB', 'GMB'],
  SHN: [],
  SLE: ['GIN', 'LBR'],
  SOM: ['ETH', 'DJI', 'KEN'],
  SSD: ['SDN', 'ETH', 'KEN', 'UGA', 'COD', 'CAF'],
  STP: [],
  SWZ: ['ZAF', 'MOZ'],
  SYC: [],
  TCD: ['LBY', 'SDN', 'CAF', 'CMR', 'NGA', 'NER'],
  TGO: ['GHA', 'BFA', 'BEN'],
  TUN: ['DZA', 'LBY'],
  TZA: ['KEN', 'UGA', 'RWA', 'BDI', 'COD', 'ZMB', 'MWI', 'MOZ'],
  UGA: ['KEN', 'TZA', 'RWA', 'COD', 'SSD'],
  ZAF: ['NAM', 'BWA', 'ZWE', 'MOZ', 'SWZ', 'LSO'],
  ZMB: ['COD', 'TZA', 'MWI', 'MOZ', 'ZWE', 'BWA', 'NAM', 'AGO'],
  ZWE: ['ZAF', 'BWA', 'ZMB', 'MOZ'],

  // --- Americas ---
  ABW: [],
  AIA: [],
  ARG: ['CHL', 'BOL', 'PRY', 'BRA', 'URY'],
  ATG: [],
  BES: [],
  BHS: [],
  BLM: [],
  BLZ: ['MEX', 'GTM'],
  BOL: ['BRA', 'PRY', 'ARG', 'CHL', 'PER'],
  BRA: ['GUY', 'SUR', 'GUF', 'VEN', 'COL', 'PER', 'BOL', 'PRY', 'ARG', 'URY'],
  BRB: [],
  BVT: [],
  CAN: ['USA', 'GRL'],
  CHL: ['PER', 'BOL', 'ARG'],
  COL: ['VEN', 'BRA', 'PER', 'ECU', 'PAN'],
  CRI: ['NIC', 'PAN'],
  CUB: [],
  CUW: [],
  CYM: [],
  DMA: [],
  DOM: ['HTI'],
  ECU: ['COL', 'PER'],
  FLK: [],
  GLP: [],
  GRD: [],
  GRL: ['CAN'],
  GTM: ['MEX', 'BLZ', 'SLV', 'HND'],
  GUF: ['BRA', 'SUR'],
  GUY: ['VEN', 'BRA', 'SUR'],
  HND: ['GTM', 'SLV', 'NIC'],
  HTI: ['DOM'],
  JAM: [],
  KNA: [],
  LCA: [],
  MAF: ['SXM'],
  MEX: ['USA', 'GTM', 'BLZ'],
  MSR: [],
  MTQ: [],
  NIC: ['HND', 'CRI'],
  PAN: ['CRI', 'COL'],
  PER: ['ECU', 'COL', 'BRA', 'BOL', 'CHL'],
  PRI: [],
  PRY: ['BOL', 'BRA', 'ARG'],
  SGS: [],
  SLV: ['GTM', 'HND'],
  SPM: [],
  SUR: ['GUY', 'BRA', 'GUF'],
  SXM: ['MAF'],
  TCA: [],
  TTO: [],
  URY: ['BRA', 'ARG'],
  USA: ['CAN', 'MEX'],
  VCT: [],
  VEN: ['COL', 'BRA', 'GUY'],
  VGB: [],
  VIR: [],

  // --- Oceania and Antarctica ---
  ASM: [],
  ATA: [],
  AUS: [],
  CCK: [],
  COK: [],
  CXR: [],
  FJI: [],
  FSM: [],
  GUM: [],
  KIR: [],
  MHL: [],
  MNP: [],
  NCL: [],
  NFK: [],
  NIU: [],
  NRU: [],
  NZL: [],
  PCN: [],
  PLW: [],
  PNG: ['IDN'],
  PYF: [],
  SLB: [],
  TKL: [],
  TON: [],
  TUV: [],
  UMI: [],
  VUT: [],
  WLF: [],
  WSM: [],
};

/** Territory -> its sovereign state (or the state responsible for it). One-directional. */
export const sovereignState: Readonly<Record<string, string>> = {
  // Denmark, Finland, Norway
  FRO: 'DNK', GRL: 'DNK', ALA: 'FIN', SJM: 'NOR', BVT: 'NOR',
  // United Kingdom: crown dependencies and overseas territories
  GGY: 'GBR', JEY: 'GBR', IMN: 'GBR', GIB: 'GBR', AIA: 'GBR', VGB: 'GBR', CYM: 'GBR',
  MSR: 'GBR', TCA: 'GBR', FLK: 'GBR', SGS: 'GBR', SHN: 'GBR', PCN: 'GBR', IOT: 'GBR',
  // France
  GUF: 'FRA', GLP: 'FRA', MTQ: 'FRA', REU: 'FRA', MYT: 'FRA', SPM: 'FRA', BLM: 'FRA',
  MAF: 'FRA', PYF: 'FRA', NCL: 'FRA', WLF: 'FRA', ATF: 'FRA',
  // Kingdom of the Netherlands
  ABW: 'NLD', CUW: 'NLD', SXM: 'NLD', BES: 'NLD',
  // United States
  PRI: 'USA', VIR: 'USA', GUM: 'USA', MNP: 'USA', ASM: 'USA', UMI: 'USA',
  // New Zealand (Cook Islands and Niue: free association)
  COK: 'NZL', NIU: 'NZL', TKL: 'NZL',
  // Australia
  NFK: 'AUS', CCK: 'AUS', CXR: 'AUS',
  // China (special administrative regions)
  HKG: 'CHN', MAC: 'CHN',
};

/** Real land neighbours of a place (empty for islands and unknown codes). */
export function getLandNeighbours(iso3: string): readonly string[] {
  return Object.prototype.hasOwnProperty.call(landBorders, iso3) ? landBorders[iso3] : [];
}

/** The sovereign state of a territory, or null for a sovereign state or a disputed place. */
export function getSovereignState(iso3: string): string | null {
  return Object.prototype.hasOwnProperty.call(sovereignState, iso3) ? sovereignState[iso3] : null;
}

// --- Previous API, used by src/lib/comparisons.ts until it switches to the maps above. ---

/**
 * Static border map: ISO3 -> array of bordering ISO3 codes.
 * Covers all countries with land borders. Island nations include
 * closest maritime neighbors for relevance.
 */
export const borderMap: Record<string, string[]> = {
  // Europe
  // Åland belongs to Finland and lies across the Sea of Åland from Sweden. Its
  // centroid-based distance to Finland is larger than to Estonia and Norway, so
  // without these entries the nearby list would name Norway instead of Finland.
  ALA: ['FIN', 'SWE'],
  ALB: ['MNE', 'XKX', 'MKD', 'GRC'],
  AND: ['FRA', 'ESP'],
  AUT: ['DEU', 'CZE', 'SVK', 'HUN', 'SVN', 'ITA', 'CHE', 'LIE'],
  BEL: ['FRA', 'LUX', 'DEU', 'NLD'],
  BGR: ['ROU', 'SRB', 'MKD', 'GRC', 'TUR'],
  BIH: ['HRV', 'SRB', 'MNE'],
  BLR: ['POL', 'LTU', 'LVA', 'RUS', 'UKR'],
  CHE: ['DEU', 'FRA', 'ITA', 'AUT', 'LIE'],
  CYP: ['TUR', 'GRC'],
  CZE: ['DEU', 'POL', 'SVK', 'AUT'],
  DEU: ['DNK', 'POL', 'CZE', 'AUT', 'CHE', 'FRA', 'LUX', 'BEL', 'NLD'],
  DNK: ['DEU'],
  ESP: ['FRA', 'PRT', 'AND', 'MAR'],
  EST: ['LVA', 'RUS', 'FIN'],
  FIN: ['SWE', 'NOR', 'RUS', 'EST'],
  FRA: ['BEL', 'LUX', 'DEU', 'CHE', 'ITA', 'ESP', 'AND', 'MCO'],
  GBR: ['IRL', 'FRA'],
  GEO: ['RUS', 'TUR', 'ARM', 'AZE'],
  GRC: ['ALB', 'MKD', 'BGR', 'TUR', 'CYP'],
  HRV: ['SVN', 'HUN', 'SRB', 'BIH', 'MNE'],
  HUN: ['AUT', 'SVK', 'UKR', 'ROU', 'SRB', 'HRV', 'SVN'],
  IRL: ['GBR'],
  ISL: ['GBR', 'NOR'],
  ITA: ['FRA', 'CHE', 'AUT', 'SVN', 'SMR', 'VAT'],
  LIE: ['CHE', 'AUT'],
  LTU: ['LVA', 'BLR', 'POL', 'RUS'],
  LUX: ['BEL', 'FRA', 'DEU'],
  LVA: ['EST', 'LTU', 'BLR', 'RUS'],
  MCO: ['FRA'],
  MDA: ['ROU', 'UKR'],
  MKD: ['ALB', 'GRC', 'BGR', 'SRB', 'XKX'],
  MLT: ['ITA'],
  MNE: ['HRV', 'BIH', 'SRB', 'XKX', 'ALB'],
  NLD: ['BEL', 'DEU'],
  NOR: ['SWE', 'FIN', 'RUS'],
  POL: ['DEU', 'CZE', 'SVK', 'UKR', 'BLR', 'LTU', 'RUS'],
  PRT: ['ESP'],
  ROU: ['HUN', 'SRB', 'BGR', 'MDA', 'UKR'],
  SMR: ['ITA'],
  SRB: ['HUN', 'ROU', 'BGR', 'MKD', 'XKX', 'MNE', 'BIH', 'HRV'],
  SVK: ['CZE', 'POL', 'UKR', 'HUN', 'AUT'],
  SVN: ['ITA', 'AUT', 'HUN', 'HRV'],
  SWE: ['NOR', 'FIN'],
  UKR: ['POL', 'SVK', 'HUN', 'ROU', 'MDA', 'BLR', 'RUS'],
  XKX: ['SRB', 'MNE', 'ALB', 'MKD'],
  VAT: ['ITA'],

  // Middle East
  ARE: ['OMN', 'SAU'],
  ARM: ['GEO', 'AZE', 'TUR', 'IRN'],
  AZE: ['GEO', 'ARM', 'TUR', 'IRN', 'RUS'],
  BHR: ['SAU', 'QAT'],
  IRN: ['IRQ', 'TUR', 'ARM', 'AZE', 'TKM', 'AFG', 'PAK'],
  IRQ: ['TUR', 'IRN', 'KWT', 'SAU', 'JOR', 'SYR'],
  ISR: ['LBN', 'SYR', 'JOR', 'EGY', 'PSE'],
  JOR: ['SYR', 'IRQ', 'SAU', 'ISR', 'PSE'],
  KWT: ['IRQ', 'SAU'],
  LBN: ['SYR', 'ISR'],
  OMN: ['ARE', 'SAU', 'YEM'],
  PSE: ['ISR', 'EGY', 'JOR'],
  QAT: ['SAU', 'BHR'],
  SAU: ['JOR', 'IRQ', 'KWT', 'BHR', 'QAT', 'ARE', 'OMN', 'YEM'],
  SYR: ['TUR', 'IRQ', 'JOR', 'ISR', 'LBN'],
  TUR: ['GRC', 'BGR', 'GEO', 'ARM', 'AZE', 'IRN', 'IRQ', 'SYR'],
  YEM: ['SAU', 'OMN'],

  // Asia
  AFG: ['PAK', 'IRN', 'TKM', 'UZB', 'TJK', 'CHN'],
  BGD: ['IND', 'MMR'],
  BTN: ['IND', 'CHN'],
  BRN: ['MYS'],
  KHM: ['THA', 'LAO', 'VNM'],
  CHN: ['RUS', 'MNG', 'PRK', 'VNM', 'LAO', 'MMR', 'IND', 'BTN', 'NPL', 'PAK', 'AFG', 'TJK', 'KGZ', 'KAZ'],
  IND: ['PAK', 'CHN', 'NPL', 'BTN', 'BGD', 'MMR', 'LKA'],
  IDN: ['MYS', 'PNG', 'TLS'],
  JPN: ['KOR', 'PRK', 'CHN', 'TWN', 'RUS', 'PHL'],
  KAZ: ['RUS', 'CHN', 'KGZ', 'UZB', 'TKM'],
  KGZ: ['KAZ', 'CHN', 'TJK', 'UZB'],
  LAO: ['CHN', 'VNM', 'KHM', 'THA', 'MMR'],
  MYS: ['THA', 'IDN', 'BRN', 'SGP'],
  MDV: ['IND', 'LKA'],
  MNG: ['RUS', 'CHN'],
  MMR: ['CHN', 'IND', 'BGD', 'LAO', 'THA'],
  NPL: ['IND', 'CHN'],
  PRK: ['CHN', 'KOR', 'RUS'],
  KOR: ['PRK', 'JPN'],
  PAK: ['IND', 'CHN', 'AFG', 'IRN'],
  PHL: ['TWN', 'IDN', 'MYS'],
  SGP: ['MYS', 'IDN'],
  LKA: ['IND', 'MDV'],
  TWN: ['CHN', 'JPN', 'PHL'],
  TJK: ['KGZ', 'CHN', 'AFG', 'UZB'],
  THA: ['MMR', 'LAO', 'KHM', 'MYS'],
  TLS: ['IDN'],
  TKM: ['KAZ', 'UZB', 'AFG', 'IRN'],
  UZB: ['KAZ', 'KGZ', 'TJK', 'AFG', 'TKM'],
  VNM: ['CHN', 'LAO', 'KHM'],
  HKG: ['CHN'],
  MAC: ['CHN'],

  // Africa
  DZA: ['MAR', 'TUN', 'LBY', 'NER', 'MLI', 'MRT'],
  AGO: ['COD', 'COG', 'ZMB', 'NAM'],
  BEN: ['TGO', 'BFA', 'NER', 'NGA'],
  BWA: ['ZAF', 'NAM', 'ZMB', 'ZWE'],
  BFA: ['MLI', 'NER', 'BEN', 'TGO', 'GHA', 'CIV'],
  BDI: ['COD', 'RWA', 'TZA'],
  CPV: ['SEN', 'GMB'],
  CMR: ['NGA', 'TCD', 'CAF', 'COG', 'GAB', 'GNQ'],
  CAF: ['TCD', 'SDN', 'SSD', 'COD', 'COG', 'CMR'],
  TCD: ['LBY', 'SDN', 'CAF', 'CMR', 'NGA', 'NER'],
  COM: ['MDG', 'MOZ'],
  COG: ['GAB', 'CMR', 'CAF', 'COD', 'AGO'],
  COD: ['COG', 'CAF', 'SSD', 'UGA', 'RWA', 'BDI', 'TZA', 'ZMB', 'AGO'],
  CIV: ['LBR', 'GIN', 'MLI', 'BFA', 'GHA'],
  DJI: ['ERI', 'ETH', 'SOM'],
  EGY: ['LBY', 'SDN', 'ISR', 'PSE'],
  GNQ: ['CMR', 'GAB'],
  ERI: ['SDN', 'ETH', 'DJI'],
  SWZ: ['ZAF', 'MOZ'],
  ETH: ['ERI', 'DJI', 'SOM', 'KEN', 'SSD', 'SDN'],
  GAB: ['CMR', 'GNQ', 'COG'],
  GMB: ['SEN'],
  GHA: ['CIV', 'BFA', 'TGO'],
  GIN: ['GNB', 'SEN', 'MLI', 'CIV', 'LBR', 'SLE'],
  GNB: ['SEN', 'GIN'],
  KEN: ['ETH', 'SOM', 'TZA', 'UGA', 'SSD'],
  LSO: ['ZAF'],
  LBR: ['GIN', 'CIV', 'SLE'],
  LBY: ['TUN', 'DZA', 'NER', 'TCD', 'SDN', 'EGY'],
  MDG: ['MOZ', 'COM'],
  MWI: ['MOZ', 'TZA', 'ZMB'],
  MLI: ['DZA', 'NER', 'BFA', 'CIV', 'GIN', 'SEN', 'MRT'],
  MRT: ['DZA', 'MLI', 'SEN'],
  MUS: ['MDG'],
  MAR: ['DZA', 'ESP', 'MRT'],
  MOZ: ['ZAF', 'SWZ', 'ZWE', 'ZMB', 'MWI', 'TZA'],
  NAM: ['AGO', 'ZMB', 'BWA', 'ZAF'],
  NER: ['DZA', 'LBY', 'TCD', 'NGA', 'BEN', 'BFA', 'MLI'],
  NGA: ['BEN', 'NER', 'TCD', 'CMR'],
  RWA: ['UGA', 'TZA', 'BDI', 'COD'],
  STP: ['GAB', 'GNQ'],
  SEN: ['MRT', 'MLI', 'GIN', 'GNB', 'GMB'],
  SYC: ['MDG', 'MUS'],
  SLE: ['GIN', 'LBR'],
  SOM: ['ETH', 'DJI', 'KEN'],
  ZAF: ['NAM', 'BWA', 'ZWE', 'MOZ', 'SWZ', 'LSO'],
  SSD: ['SDN', 'ETH', 'KEN', 'UGA', 'COD', 'CAF'],
  SDN: ['EGY', 'LBY', 'TCD', 'CAF', 'SSD', 'ETH', 'ERI'],
  TZA: ['KEN', 'UGA', 'RWA', 'BDI', 'COD', 'ZMB', 'MWI', 'MOZ'],
  TGO: ['GHA', 'BFA', 'BEN'],
  TUN: ['DZA', 'LBY'],
  UGA: ['KEN', 'TZA', 'RWA', 'COD', 'SSD'],
  ZMB: ['COD', 'TZA', 'MWI', 'MOZ', 'ZWE', 'BWA', 'NAM', 'AGO'],
  ZWE: ['ZAF', 'BWA', 'ZMB', 'MOZ'],

  // Americas
  ARG: ['CHL', 'BOL', 'PRY', 'BRA', 'URY'],
  BLZ: ['MEX', 'GTM'],
  BOL: ['BRA', 'PRY', 'ARG', 'CHL', 'PER'],
  BRA: ['GUY', 'SUR', 'VEN', 'COL', 'PER', 'BOL', 'PRY', 'ARG', 'URY'],
  CAN: ['USA'],
  CHL: ['PER', 'BOL', 'ARG'],
  COL: ['VEN', 'BRA', 'PER', 'ECU', 'PAN'],
  CRI: ['NIC', 'PAN'],
  CUB: ['USA', 'MEX', 'JAM'],
  DOM: ['HTI'],
  ECU: ['COL', 'PER'],
  SLV: ['GTM', 'HND'],
  GTM: ['MEX', 'BLZ', 'SLV', 'HND'],
  GUY: ['VEN', 'BRA', 'SUR'],
  HTI: ['DOM'],
  HND: ['GTM', 'SLV', 'NIC'],
  JAM: ['CUB', 'HTI'],
  MEX: ['USA', 'GTM', 'BLZ'],
  NIC: ['HND', 'CRI'],
  PAN: ['CRI', 'COL'],
  PRY: ['BOL', 'BRA', 'ARG'],
  PER: ['ECU', 'COL', 'BRA', 'BOL', 'CHL'],
  SUR: ['GUY', 'BRA'],
  TTO: ['VEN'],
  USA: ['CAN', 'MEX'],
  URY: ['BRA', 'ARG'],
  VEN: ['COL', 'BRA', 'GUY', 'TTO'],

  // Caribbean islands (maritime neighbors)
  ATG: ['KNA', 'DMA'],
  BHS: ['USA', 'CUB'],
  BRB: ['VCT', 'LCA', 'TTO'],
  DMA: ['ATG', 'LCA'],
  GRD: ['VCT', 'TTO'],
  KNA: ['ATG'],
  LCA: ['DMA', 'VCT', 'BRB'],
  VCT: ['LCA', 'GRD', 'BRB'],

  // Oceania
  AUS: ['NZL', 'IDN', 'PNG'],
  FJI: ['TON', 'VUT', 'WSM'],
  KIR: ['MHL', 'NRU'],
  MHL: ['KIR', 'FSM'],
  FSM: ['MHL', 'PLW'],
  NRU: ['KIR'],
  NZL: ['AUS', 'FJI'],
  PLW: ['FSM', 'PHL'],
  PNG: ['IDN', 'AUS', 'SLB'],
  WSM: ['FJI', 'TON'],
  SLB: ['PNG', 'VUT'],
  TON: ['FJI', 'WSM'],
  TUV: ['FJI', 'KIR'],
  VUT: ['FJI', 'SLB'],

  // Russia (special case - borders many)
  RUS: ['NOR', 'FIN', 'EST', 'LVA', 'LTU', 'POL', 'BLR', 'UKR', 'GEO', 'AZE', 'KAZ', 'CHN', 'MNG', 'PRK'],
};

/**
 * Get neighboring countries with their full scored data.
 * Returns ScoredCountry objects sorted by score descending, max 6.
 *
 * `include` is applied BEFORE the top-6 cap: a neighbour the caller rejects
 * (e.g. failing hasSufficientData) must not push an acceptable one out of the
 * list. France has 8 borders, two of them 3-source micro-states; capping first
 * would silently drop a comparable neighbour.
 */
export function getNeighbors<T extends ScoredCountry = ScoredCountry>(
  iso3: string,
  allCountries: ScoredCountry[],
  include: ((c: ScoredCountry) => c is T) | ((c: ScoredCountry) => boolean) = () => true,
): T[] {
  const borders = borderMap[iso3];
  if (!borders || borders.length === 0) return [];

  const countryMap = new Map(allCountries.map(c => [c.iso3, c]));

  // Official score descending; a grey neighbour (formula v10, no score) sorts last, so it can
  // only fill a slot no scored neighbour wants (callers that need scores filter it out first).
  return borders
    .filter(b => countryMap.has(b))
    .map(b => countryMap.get(b)!)
    .filter((c): c is T => include(c))
    .sort((a, b) => (officialScore(b) ?? -1) - (officialScore(a) ?? -1))
    .slice(0, 6);
}
