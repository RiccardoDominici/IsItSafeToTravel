import type { ScoredCountry } from '../pipeline/types';

export type Region = 'europe' | 'asia' | 'africa' | 'americas' | 'oceania' | 'middle_east';

/**
 * Region mapping by ISO3 code.
 *
 * Source of truth: scores-extract.csv (Formula v9 SHIP-SPEC region source, quick-260706-x81),
 * which maps all 248 tracked countries/territories to a region. 7 near-zero-data territories
 * (ATA, ATF, BVT, CCK, CXR, SGS, UMI) carry region="other" in that CSV and are intentionally
 * OMITTED here — they fall through to the 'other' fallback in getRegion() below. Every other
 * iso3 in the 248-country list (including RUS -> europe) MUST appear below.
 */
export const regionMap: Record<string, string> = {
  // Europe (54)
  ALA: 'europe', ALB: 'europe', AND: 'europe', AUT: 'europe', BEL: 'europe',
  BGR: 'europe', BIH: 'europe', BLR: 'europe', CHE: 'europe', CYP: 'europe',
  CZE: 'europe', DEU: 'europe', DNK: 'europe', ESP: 'europe', EST: 'europe',
  FIN: 'europe', FRA: 'europe', FRO: 'europe', GBR: 'europe', GEO: 'europe',
  GGY: 'europe', GIB: 'europe', GRC: 'europe', HRV: 'europe', HUN: 'europe',
  IMN: 'europe', IRL: 'europe', ISL: 'europe', ITA: 'europe', JEY: 'europe',
  LIE: 'europe', LTU: 'europe', LUX: 'europe', LVA: 'europe', MCO: 'europe',
  MDA: 'europe', MKD: 'europe', MLT: 'europe', MNE: 'europe', NLD: 'europe',
  NOR: 'europe', POL: 'europe', PRT: 'europe', ROU: 'europe', RUS: 'europe',
  SJM: 'europe', SMR: 'europe', SRB: 'europe', SVK: 'europe', SVN: 'europe',
  SWE: 'europe', UKR: 'europe', VAT: 'europe', XKX: 'europe',
  // Asia (33)
  AFG: 'asia', BGD: 'asia', BRN: 'asia', BTN: 'asia', CHN: 'asia',
  HKG: 'asia', IDN: 'asia', IND: 'asia', IOT: 'asia', JPN: 'asia',
  KAZ: 'asia', KGZ: 'asia', KHM: 'asia', KOR: 'asia', LAO: 'asia',
  LKA: 'asia', MAC: 'asia', MDV: 'asia', MMR: 'asia', MNG: 'asia',
  MYS: 'asia', NPL: 'asia', PAK: 'asia', PHL: 'asia', PRK: 'asia',
  SGP: 'asia', THA: 'asia', TJK: 'asia', TKM: 'asia', TLS: 'asia',
  TWN: 'asia', UZB: 'asia', VNM: 'asia',
  // Middle East (17)
  ARE: 'middle_east', ARM: 'middle_east', AZE: 'middle_east',
  BHR: 'middle_east', IRN: 'middle_east', IRQ: 'middle_east',
  ISR: 'middle_east', JOR: 'middle_east', KWT: 'middle_east',
  LBN: 'middle_east', OMN: 'middle_east', PSE: 'middle_east',
  QAT: 'middle_east', SAU: 'middle_east', SYR: 'middle_east',
  TUR: 'middle_east', YEM: 'middle_east',
  // Africa (58)
  AGO: 'africa', BDI: 'africa', BEN: 'africa', BFA: 'africa', BWA: 'africa',
  CAF: 'africa', CIV: 'africa', CMR: 'africa', COD: 'africa', COG: 'africa',
  COM: 'africa', CPV: 'africa', DJI: 'africa', DZA: 'africa', EGY: 'africa',
  ERI: 'africa', ESH: 'africa', ETH: 'africa', GAB: 'africa', GHA: 'africa',
  GIN: 'africa', GMB: 'africa', GNB: 'africa', GNQ: 'africa', KEN: 'africa',
  LBR: 'africa', LBY: 'africa', LSO: 'africa', MAR: 'africa', MDG: 'africa',
  MLI: 'africa', MOZ: 'africa', MRT: 'africa', MUS: 'africa', MWI: 'africa',
  MYT: 'africa', NAM: 'africa', NER: 'africa', NGA: 'africa', REU: 'africa',
  RWA: 'africa', SDN: 'africa', SEN: 'africa', SHN: 'africa', SLE: 'africa',
  SOM: 'africa', SSD: 'africa', STP: 'africa', SWZ: 'africa', SYC: 'africa',
  TCD: 'africa', TGO: 'africa', TUN: 'africa', TZA: 'africa', UGA: 'africa',
  ZAF: 'africa', ZMB: 'africa', ZWE: 'africa',
  // Americas (54)
  ABW: 'americas', AIA: 'americas', ARG: 'americas', ATG: 'americas',
  BES: 'americas', BHS: 'americas', BLM: 'americas', BLZ: 'americas',
  BOL: 'americas', BRA: 'americas', BRB: 'americas', CAN: 'americas',
  CHL: 'americas', COL: 'americas', CRI: 'americas', CUB: 'americas',
  CUW: 'americas', CYM: 'americas', DMA: 'americas', DOM: 'americas',
  ECU: 'americas', FLK: 'americas', GLP: 'americas', GRD: 'americas',
  GRL: 'americas', GTM: 'americas', GUF: 'americas', GUY: 'americas',
  HND: 'americas', HTI: 'americas', JAM: 'americas', KNA: 'americas',
  LCA: 'americas', MAF: 'americas', MEX: 'americas', MSR: 'americas',
  MTQ: 'americas', NIC: 'americas', PAN: 'americas', PER: 'americas',
  PRI: 'americas', PRY: 'americas', SLV: 'americas', SPM: 'americas',
  SUR: 'americas', SXM: 'americas', TCA: 'americas', TTO: 'americas',
  URY: 'americas', USA: 'americas', VCT: 'americas', VEN: 'americas',
  VGB: 'americas', VIR: 'americas',
  // Oceania (25)
  ASM: 'oceania', AUS: 'oceania', COK: 'oceania', FJI: 'oceania',
  FSM: 'oceania', GUM: 'oceania', KIR: 'oceania', MHL: 'oceania',
  MNP: 'oceania', NCL: 'oceania', NFK: 'oceania', NIU: 'oceania',
  NRU: 'oceania', NZL: 'oceania', PCN: 'oceania', PLW: 'oceania',
  PNG: 'oceania', PYF: 'oceania', SLB: 'oceania', TKL: 'oceania',
  TON: 'oceania', TUV: 'oceania', VUT: 'oceania', WLF: 'oceania',
  WSM: 'oceania',
};

/** Get the region for a given ISO3 country code */
export function getRegion(iso3: string): Region | 'other' {
  return (regionMap[iso3] as Region) ?? 'other';
}

/** Get all countries in a specific region, sorted by score descending */
export function getCountriesByRegion(countries: ScoredCountry[], region: Region): ScoredCountry[] {
  return countries
    .filter(c => getRegion(c.iso3) === region)
    .sort((a, b) => b.score - a.score);
}
