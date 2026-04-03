import type { ScoredCountry } from '../pipeline/types';

export type Region = 'europe' | 'asia' | 'africa' | 'americas' | 'oceania' | 'middle_east';

/** Region mapping by ISO3 code */
export const regionMap: Record<string, string> = {
  // Europe
  ALB: 'europe', AND: 'europe', AUT: 'europe', BEL: 'europe', BGR: 'europe',
  BIH: 'europe', BLR: 'europe', CHE: 'europe', CYP: 'europe', CZE: 'europe',
  DEU: 'europe', DNK: 'europe', ESP: 'europe', EST: 'europe', FIN: 'europe',
  FRA: 'europe', GBR: 'europe', GEO: 'europe', GRC: 'europe', HRV: 'europe',
  HUN: 'europe', IRL: 'europe', ISL: 'europe', ITA: 'europe', KOS: 'europe',
  LIE: 'europe', LTU: 'europe', LUX: 'europe', LVA: 'europe', MCO: 'europe',
  MDA: 'europe', MKD: 'europe', MLT: 'europe', MNE: 'europe', NLD: 'europe',
  NOR: 'europe', POL: 'europe', PRT: 'europe', ROU: 'europe', SRB: 'europe',
  SVK: 'europe', SVN: 'europe', SWE: 'europe', UKR: 'europe', XKX: 'europe',
  SMR: 'europe', VAT: 'europe',
  // Asia
  AFG: 'asia', BGD: 'asia', BTN: 'asia', BRN: 'asia', KHM: 'asia',
  CHN: 'asia', IND: 'asia', IDN: 'asia', JPN: 'asia', KAZ: 'asia',
  KGZ: 'asia', LAO: 'asia', MYS: 'asia', MDV: 'asia', MNG: 'asia',
  MMR: 'asia', NPL: 'asia', PRK: 'asia', KOR: 'asia', PAK: 'asia',
  PHL: 'asia', SGP: 'asia', LKA: 'asia', TWN: 'asia', TJK: 'asia',
  THA: 'asia', TLS: 'asia', TKM: 'asia', UZB: 'asia', VNM: 'asia',
  HKG: 'asia', MAC: 'asia',
  // Middle East
  ARE: 'middle_east', BHR: 'middle_east', IRN: 'middle_east', IRQ: 'middle_east',
  ISR: 'middle_east', JOR: 'middle_east', KWT: 'middle_east', LBN: 'middle_east',
  OMN: 'middle_east', PSE: 'middle_east', QAT: 'middle_east', SAU: 'middle_east',
  SYR: 'middle_east', TUR: 'middle_east', YEM: 'middle_east', AZE: 'middle_east',
  ARM: 'middle_east',
  // Africa
  DZA: 'africa', AGO: 'africa', BEN: 'africa', BWA: 'africa', BFA: 'africa',
  BDI: 'africa', CPV: 'africa', CMR: 'africa', CAF: 'africa', TCD: 'africa',
  COM: 'africa', COG: 'africa', COD: 'africa', CIV: 'africa', DJI: 'africa',
  EGY: 'africa', GNQ: 'africa', ERI: 'africa', SWZ: 'africa', ETH: 'africa',
  GAB: 'africa', GMB: 'africa', GHA: 'africa', GIN: 'africa', GNB: 'africa',
  KEN: 'africa', LSO: 'africa', LBR: 'africa', LBY: 'africa', MDG: 'africa',
  MWI: 'africa', MLI: 'africa', MRT: 'africa', MUS: 'africa', MAR: 'africa',
  MOZ: 'africa', NAM: 'africa', NER: 'africa', NGA: 'africa', RWA: 'africa',
  STP: 'africa', SEN: 'africa', SYC: 'africa', SLE: 'africa', SOM: 'africa',
  ZAF: 'africa', SSD: 'africa', SDN: 'africa', TZA: 'africa', TGO: 'africa',
  TUN: 'africa', UGA: 'africa', ZMB: 'africa', ZWE: 'africa',
  // Americas
  ARG: 'americas', ATG: 'americas', BHS: 'americas', BRB: 'americas', BLZ: 'americas',
  BOL: 'americas', BRA: 'americas', CAN: 'americas', CHL: 'americas', COL: 'americas',
  CRI: 'americas', CUB: 'americas', DMA: 'americas', DOM: 'americas', ECU: 'americas',
  SLV: 'americas', GRD: 'americas', GTM: 'americas', GUY: 'americas', HTI: 'americas',
  HND: 'americas', JAM: 'americas', MEX: 'americas', NIC: 'americas', PAN: 'americas',
  PRY: 'americas', PER: 'americas', KNA: 'americas', LCA: 'americas', VCT: 'americas',
  SUR: 'americas', TTO: 'americas', USA: 'americas', URY: 'americas', VEN: 'americas',
  // Oceania
  AUS: 'oceania', FJI: 'oceania', KIR: 'oceania', MHL: 'oceania', FSM: 'oceania',
  NRU: 'oceania', NZL: 'oceania', PLW: 'oceania', PNG: 'oceania', WSM: 'oceania',
  SLB: 'oceania', TON: 'oceania', TUV: 'oceania', VUT: 'oceania',
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
