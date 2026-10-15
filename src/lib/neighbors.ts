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
