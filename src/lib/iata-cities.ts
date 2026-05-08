/**
 * IATA city-code mapping for travel destination prefill.
 *
 * Used by `TravelDealsWidget.astro` to pre-fill the destination field on
 * country detail pages. Returns `null` for any iso3 not in the map — a
 * handful of uninhabited / no-airport places (Antarctica, Bouvet Island,
 * Pitcairn, Tokelau, US minor outlying, etc.) intentionally have no entry.
 *
 * Codes are IATA *city* codes when available (multi-airport metro areas:
 * NYC, LON, TYO, MOW, ROM) and *airport* codes otherwise (single-airport
 * countries: ALG, KBL, FNJ). Aviasales accepts both interchangeably in
 * the `destination_iata` URL param.
 *
 * For micronations without their own civil airport (Andorra, Liechtenstein,
 * Monaco, San Marino, Vatican) we use the nearest commercial hub.
 */
import type { Lang } from '../i18n/ui';

const IATA_BY_ISO3: Record<string, string> = {
  // ─── Europe ────────────────────────────────────────────────────────────
  ALA: 'MHQ', // Åland — Mariehamn
  ALB: 'TIA', // Albania — Tirana
  AND: 'BCN', // Andorra — Barcelona (no airport in Andorra)
  AUT: 'VIE', BEL: 'BRU', BGR: 'SOF', BIH: 'SJJ',
  BLR: 'MSQ', CHE: 'ZRH', CYP: 'LCA', CZE: 'PRG',
  DEU: 'BER', DNK: 'CPH', ESP: 'MAD', EST: 'TLL',
  FIN: 'HEL', FRA: 'PAR', FRO: 'FAE', GBR: 'LON',
  GGY: 'GCI', GIB: 'GIB', GRC: 'ATH', HRV: 'ZAG',
  HUN: 'BUD', IMN: 'IOM', IRL: 'DUB', ISL: 'REK',
  ITA: 'ROM', JEY: 'JER', LIE: 'ZRH', // Liechtenstein → Zurich
  LTU: 'VNO', LUX: 'LUX', LVA: 'RIX',
  MCO: 'NCE', // Monaco → Nice
  MDA: 'KIV', MKD: 'SKP', MLT: 'MLA', MNE: 'TGD',
  NLD: 'AMS', NOR: 'OSL', POL: 'WAW', PRT: 'LIS',
  ROU: 'BUH', RUS: 'MOW',
  SJM: 'LYR', // Svalbard — Longyearbyen
  SMR: 'RMI', // San Marino → Rimini
  SRB: 'BEG', SVK: 'BTS', SVN: 'LJU', SWE: 'STO',
  UKR: 'IEV',
  VAT: 'ROM', // Vatican → Rome
  XKX: 'PRN', // Kosovo — Pristina

  // ─── Americas ──────────────────────────────────────────────────────────
  ABW: 'AUA', AIA: 'AXA', ARG: 'BUE', ATG: 'ANU',
  BES: 'BON', BHS: 'NAS',
  BLM: 'SBH', // St Barthélemy
  BLZ: 'BZE', BOL: 'LPB', BRA: 'SAO', BRB: 'BGI',
  CAN: 'YTO', CHL: 'SCL', COL: 'BOG', CRI: 'SJO',
  CUB: 'HAV', CUW: 'CUR', CYM: 'GCM', DMA: 'DOM',
  DOM: 'SDQ', ECU: 'UIO', FLK: 'PSY', GLP: 'PTP',
  GRD: 'GND', GRL: 'GOH', GTM: 'GUA', GUF: 'CAY',
  GUY: 'GEO', HND: 'TGU', HTI: 'PAP', JAM: 'KIN',
  KNA: 'SKB', LCA: 'UVF',
  MAF: 'SFG', // St Martin (French side)
  MEX: 'MEX', MSR: 'MNI', MTQ: 'FDF', NIC: 'MGA',
  PAN: 'PTY', PER: 'LIM', PRI: 'SJU', PRY: 'ASU',
  SLV: 'SAL', SPM: 'FSP', SUR: 'PBM', SXM: 'SXM',
  TCA: 'PLS', TTO: 'POS', URY: 'MVD', USA: 'NYC',
  VCT: 'SVD', VEN: 'CCS', VGB: 'EIS', VIR: 'STT',

  // ─── Asia / Middle East ────────────────────────────────────────────────
  AFG: 'KBL', ARE: 'DXB', ARM: 'EVN', AZE: 'BAK',
  BGD: 'DAC', BHR: 'BAH', BRN: 'BWN', BTN: 'PBH',
  CHN: 'BJS', GEO: 'TBS', HKG: 'HKG', IDN: 'JKT',
  IND: 'DEL', IRN: 'THR', IRQ: 'BGW', ISR: 'TLV',
  JOR: 'AMM', JPN: 'TYO', KAZ: 'ALA', KGZ: 'FRU',
  KHM: 'PNH', KOR: 'SEL', KWT: 'KWI', LAO: 'VTE',
  LBN: 'BEY', LKA: 'CMB', MAC: 'MFM', MDV: 'MLE',
  MMR: 'RGN', MNG: 'ULN', MYS: 'KUL', NPL: 'KTM',
  OMN: 'MCT', PAK: 'KHI',
  // PSE (Palestine) — no own civil airport, omit
  PHL: 'MNL', PRK: 'FNJ', QAT: 'DOH', SAU: 'RUH',
  SGP: 'SIN', SYR: 'DAM', THA: 'BKK', TJK: 'DYU',
  TKM: 'ASB', TLS: 'DIL', TUR: 'IST', TWN: 'TPE',
  UZB: 'TAS', VNM: 'SGN', YEM: 'SAH',

  // ─── Africa ────────────────────────────────────────────────────────────
  AGO: 'LAD', BDI: 'BJM', BEN: 'COO', BFA: 'OUA',
  BWA: 'GBE', CAF: 'BGF', CIV: 'ABJ', CMR: 'DLA',
  COD: 'FIH', COG: 'BZV', COM: 'HAH', CPV: 'RAI',
  DJI: 'JIB', DZA: 'ALG', EGY: 'CAI', ERI: 'ASM',
  ESH: 'EUN', // Western Sahara — El Aaiún
  ETH: 'ADD', GAB: 'LBV', GHA: 'ACC', GIN: 'CKY',
  GMB: 'BJL', GNB: 'OXB', GNQ: 'SSG', KEN: 'NBO',
  LBR: 'ROB', LBY: 'TIP', LSO: 'MSU', MAR: 'CAS',
  MDG: 'TNR', MLI: 'BKO', MOZ: 'MPM', MRT: 'NKC',
  MUS: 'MRU', MWI: 'LLW',
  MYT: 'DZA', // Mayotte — Dzaoudzi
  NAM: 'WDH', NER: 'NIM', NGA: 'LOS', REU: 'RUN',
  RWA: 'KGL', SDN: 'KRT', SEN: 'DKR',
  SHN: 'HLE', // St Helena
  SLE: 'FNA', SOM: 'MGQ', SSD: 'JUB', STP: 'TMS',
  SWZ: 'MTS', // Eswatini — Manzini
  SYC: 'SEZ', TCD: 'NDJ', TGO: 'LFW', TUN: 'TUN',
  TZA: 'DAR', UGA: 'EBB', ZAF: 'JNB', ZMB: 'LUN',
  ZWE: 'HRE',

  // ─── Oceania ───────────────────────────────────────────────────────────
  ASM: 'PPG', AUS: 'SYD',
  CCK: 'CCK', // Cocos (Keeling) Islands
  COK: 'RAR', // Cook Islands — Rarotonga
  CXR: 'XCH', // Christmas Island
  FJI: 'NAN', FSM: 'PNI',
  GUM: 'GUM',
  KIR: 'TRW', MHL: 'MAJ', MNP: 'SPN', NCL: 'NOU',
  NFK: 'NLK', NIU: 'IUE', NRU: 'INU', NZL: 'AKL',
  PLW: 'ROR', PNG: 'POM', PYF: 'PPT', SLB: 'HIR',
  TON: 'TBU', TUV: 'FUN', VUT: 'VLI', WLF: 'WLS',
  WSM: 'APW',

  // ─── No-airport / uninhabited (intentionally omitted) ──────────────────
  // ATA Antarctica, ATF French Southern Territories, BVT Bouvet,
  // IOT British Indian Ocean (Diego Garcia, military only),
  // PCN Pitcairn, SGS South Georgia, TKL Tokelau, UMI US Minor Outlying
};

export function getMainCityIata(iso3: string): string | null {
  if (!iso3) return null;
  return IATA_BY_ISO3[iso3.toUpperCase()] ?? null;
}

/**
 * Localized city display name. Falls back to the English name when a locale
 * doesn't have a translation, and to `null` if the iso3 has no IATA mapping.
 *
 * Translations only cover the seven supported UI locales. For the long tail
 * of small destinations the English name is used everywhere — translating
 * Bujumbura / Funafuti / Pohnpei into seven languages is more noise than
 * value (the IATA code in parentheses next to the name is what users key on).
 */
const CITY_NAMES: Record<string, Partial<Record<Lang, string>> & { en: string }> = {
  // Europe
  ROM: { en: 'Rome', it: 'Roma', es: 'Roma', fr: 'Rome', pt: 'Roma', zh: '罗马', de: 'Rom' },
  PAR: { en: 'Paris', it: 'Parigi', es: 'París', fr: 'Paris', pt: 'Paris', zh: '巴黎', de: 'Paris' },
  MAD: { en: 'Madrid', it: 'Madrid', es: 'Madrid', fr: 'Madrid', pt: 'Madrid', zh: '马德里', de: 'Madrid' },
  LON: { en: 'London', it: 'Londra', es: 'Londres', fr: 'Londres', pt: 'Londres', zh: '伦敦', de: 'London' },
  BER: { en: 'Berlin', it: 'Berlino', es: 'Berlín', fr: 'Berlin', pt: 'Berlim', zh: '柏林', de: 'Berlin' },
  AMS: { en: 'Amsterdam', it: 'Amsterdam', es: 'Ámsterdam', fr: 'Amsterdam', pt: 'Amesterdão', zh: '阿姆斯特丹', de: 'Amsterdam' },
  BRU: { en: 'Brussels', it: 'Bruxelles', es: 'Bruselas', fr: 'Bruxelles', pt: 'Bruxelas', zh: '布鲁塞尔', de: 'Brüssel' },
  ZRH: { en: 'Zurich', it: 'Zurigo', es: 'Zúrich', fr: 'Zurich', pt: 'Zurique', zh: '苏黎世', de: 'Zürich' },
  VIE: { en: 'Vienna', it: 'Vienna', es: 'Viena', fr: 'Vienne', pt: 'Viena', zh: '维也纳', de: 'Wien' },
  LIS: { en: 'Lisbon', it: 'Lisbona', es: 'Lisboa', fr: 'Lisbonne', pt: 'Lisboa', zh: '里斯本', de: 'Lissabon' },
  ATH: { en: 'Athens', it: 'Atene', es: 'Atenas', fr: 'Athènes', pt: 'Atenas', zh: '雅典', de: 'Athen' },
  DUB: { en: 'Dublin', it: 'Dublino', es: 'Dublín', fr: 'Dublin', pt: 'Dublin', zh: '都柏林', de: 'Dublin' },
  CPH: { en: 'Copenhagen', it: 'Copenaghen', es: 'Copenhague', fr: 'Copenhague', pt: 'Copenhaga', zh: '哥本哈根', de: 'Kopenhagen' },
  STO: { en: 'Stockholm', it: 'Stoccolma', es: 'Estocolmo', fr: 'Stockholm', pt: 'Estocolmo', zh: '斯德哥尔摩', de: 'Stockholm' },
  OSL: { en: 'Oslo', it: 'Oslo', es: 'Oslo', fr: 'Oslo', pt: 'Oslo', zh: '奥斯陆', de: 'Oslo' },
  HEL: { en: 'Helsinki', it: 'Helsinki', es: 'Helsinki', fr: 'Helsinki', pt: 'Helsínquia', zh: '赫尔辛基', de: 'Helsinki' },
  PRG: { en: 'Prague', it: 'Praga', es: 'Praga', fr: 'Prague', pt: 'Praga', zh: '布拉格', de: 'Prag' },
  WAW: { en: 'Warsaw', it: 'Varsavia', es: 'Varsovia', fr: 'Varsovie', pt: 'Varsóvia', zh: '华沙', de: 'Warschau' },
  BUD: { en: 'Budapest', it: 'Budapest', es: 'Budapest', fr: 'Budapest', pt: 'Budapeste', zh: '布达佩斯', de: 'Budapest' },
  BUH: { en: 'Bucharest', it: 'Bucarest', es: 'Bucarest', fr: 'Bucarest', pt: 'Bucareste', zh: '布加勒斯特', de: 'Bukarest' },
  ZAG: { en: 'Zagreb', it: 'Zagabria', es: 'Zagreb', fr: 'Zagreb', pt: 'Zagreb', zh: '萨格勒布', de: 'Zagreb' },
  REK: { en: 'Reykjavik', it: 'Reykjavik', es: 'Reikiavik', fr: 'Reykjavik', pt: 'Reiquiavique', zh: '雷克雅未克', de: 'Reykjavík' },
  MHQ: { en: 'Mariehamn' },
  TIA: { en: 'Tirana' },
  BCN: { en: 'Barcelona', it: 'Barcellona', es: 'Barcelona', fr: 'Barcelone', pt: 'Barcelona', zh: '巴塞罗那', de: 'Barcelona' },
  SOF: { en: 'Sofia', it: 'Sofia', es: 'Sofía', fr: 'Sofia', pt: 'Sófia', zh: '索菲亚', de: 'Sofia' },
  SJJ: { en: 'Sarajevo' },
  MSQ: { en: 'Minsk' },
  LCA: { en: 'Larnaca' },
  TLL: { en: 'Tallinn' },
  FAE: { en: 'Vágar' },
  GCI: { en: 'Guernsey' },
  GIB: { en: 'Gibraltar', it: 'Gibilterra', es: 'Gibraltar', fr: 'Gibraltar', pt: 'Gibraltar', zh: '直布罗陀', de: 'Gibraltar' },
  IOM: { en: 'Isle of Man' },
  JER: { en: 'Jersey' },
  VNO: { en: 'Vilnius' },
  LUX: { en: 'Luxembourg', it: 'Lussemburgo', es: 'Luxemburgo', fr: 'Luxembourg', pt: 'Luxemburgo', zh: '卢森堡', de: 'Luxemburg' },
  RIX: { en: 'Riga' },
  NCE: { en: 'Nice', it: 'Nizza', es: 'Niza', fr: 'Nice', pt: 'Nice', zh: '尼斯', de: 'Nizza' },
  KIV: { en: 'Chișinău' },
  SKP: { en: 'Skopje' },
  MLA: { en: 'Malta', it: 'Malta', es: 'Malta', fr: 'Malte', pt: 'Malta', zh: '马耳他', de: 'Malta' },
  TGD: { en: 'Podgorica' },
  MOW: { en: 'Moscow', it: 'Mosca', es: 'Moscú', fr: 'Moscou', pt: 'Moscovo', zh: '莫斯科', de: 'Moskau' },
  LYR: { en: 'Longyearbyen' },
  RMI: { en: 'Rimini' },
  BEG: { en: 'Belgrade', it: 'Belgrado', es: 'Belgrado', fr: 'Belgrade', pt: 'Belgrado', zh: '贝尔格莱德', de: 'Belgrad' },
  BTS: { en: 'Bratislava' },
  LJU: { en: 'Ljubljana', it: 'Lubiana', es: 'Liubliana', fr: 'Ljubljana', pt: 'Liubliana', zh: '卢布尔雅那', de: 'Ljubljana' },
  IEV: { en: 'Kyiv', it: 'Kiev', es: 'Kiev', fr: 'Kiev', pt: 'Kiev', zh: '基辅', de: 'Kiew' },
  PRN: { en: 'Pristina' },

  // Americas
  NYC: { en: 'New York', it: 'New York', es: 'Nueva York', fr: 'New York', pt: 'Nova Iorque', zh: '纽约', de: 'New York' },
  YTO: { en: 'Toronto', it: 'Toronto', es: 'Toronto', fr: 'Toronto', pt: 'Toronto', zh: '多伦多', de: 'Toronto' },
  MEX: { en: 'Mexico City', it: 'Città del Messico', es: 'Ciudad de México', fr: 'Mexico', pt: 'Cidade do México', zh: '墨西哥城', de: 'Mexiko-Stadt' },
  SAO: { en: 'São Paulo', it: 'San Paolo', es: 'São Paulo', fr: 'São Paulo', pt: 'São Paulo', zh: '圣保罗', de: 'São Paulo' },
  BUE: { en: 'Buenos Aires', it: 'Buenos Aires', es: 'Buenos Aires', fr: 'Buenos Aires', pt: 'Buenos Aires', zh: '布宜诺斯艾利斯', de: 'Buenos Aires' },
  SCL: { en: 'Santiago', it: 'Santiago', es: 'Santiago', fr: 'Santiago', pt: 'Santiago', zh: '圣地亚哥', de: 'Santiago' },
  BOG: { en: 'Bogotá', it: 'Bogotá', es: 'Bogotá', fr: 'Bogota', pt: 'Bogotá', zh: '波哥大', de: 'Bogotá' },
  LIM: { en: 'Lima', it: 'Lima', es: 'Lima', fr: 'Lima', pt: 'Lima', zh: '利马', de: 'Lima' },
  AUA: { en: 'Aruba' },
  AXA: { en: 'Anguilla' },
  ANU: { en: 'Antigua' },
  BON: { en: 'Bonaire' },
  NAS: { en: 'Nassau' },
  SBH: { en: 'St Barthélemy' },
  BZE: { en: 'Belize City' },
  LPB: { en: 'La Paz' },
  BGI: { en: 'Bridgetown' },
  SJO: { en: 'San José' },
  HAV: { en: 'Havana', it: "L'Avana", es: 'La Habana', fr: 'La Havane', pt: 'Havana', zh: '哈瓦那', de: 'Havanna' },
  CUR: { en: 'Curaçao' },
  GCM: { en: 'Grand Cayman' },
  DOM: { en: 'Dominica' },
  SDQ: { en: 'Santo Domingo' },
  UIO: { en: 'Quito' },
  PSY: { en: 'Stanley' },
  PTP: { en: 'Pointe-à-Pitre' },
  GND: { en: 'Grenada' },
  GOH: { en: 'Nuuk' },
  GUA: { en: 'Guatemala City', it: 'Città del Guatemala', es: 'Ciudad de Guatemala', fr: 'Guatemala', pt: 'Cidade da Guatemala', zh: '危地马拉城', de: 'Guatemala-Stadt' },
  CAY: { en: 'Cayenne' },
  GEO: { en: 'Georgetown' },
  TGU: { en: 'Tegucigalpa' },
  PAP: { en: 'Port-au-Prince' },
  KIN: { en: 'Kingston' },
  SKB: { en: 'Basseterre' },
  UVF: { en: 'St Lucia' },
  SFG: { en: 'St Martin' },
  MNI: { en: 'Montserrat' },
  FDF: { en: 'Fort-de-France' },
  MGA: { en: 'Managua' },
  PTY: { en: 'Panama City', it: 'Città di Panama', es: 'Ciudad de Panamá', fr: 'Panama', pt: 'Cidade do Panamá', zh: '巴拿马城', de: 'Panama-Stadt' },
  SJU: { en: 'San Juan' },
  ASU: { en: 'Asunción' },
  SAL: { en: 'San Salvador' },
  FSP: { en: 'Saint-Pierre' },
  PBM: { en: 'Paramaribo' },
  SXM: { en: 'Sint Maarten' },
  PLS: { en: 'Providenciales' },
  POS: { en: 'Port of Spain' },
  MVD: { en: 'Montevideo' },
  SVD: { en: 'St Vincent' },
  CCS: { en: 'Caracas' },
  EIS: { en: 'Tortola' },
  STT: { en: 'St Thomas' },

  // Asia
  TYO: { en: 'Tokyo', it: 'Tokyo', es: 'Tokio', fr: 'Tokyo', pt: 'Tóquio', zh: '东京', de: 'Tokio' },
  BJS: { en: 'Beijing', it: 'Pechino', es: 'Pekín', fr: 'Pékin', pt: 'Pequim', zh: '北京', de: 'Peking' },
  HKG: { en: 'Hong Kong', it: 'Hong Kong', es: 'Hong Kong', fr: 'Hong Kong', pt: 'Hong Kong', zh: '香港', de: 'Hongkong' },
  SEL: { en: 'Seoul', it: 'Seul', es: 'Seúl', fr: 'Séoul', pt: 'Seul', zh: '首尔', de: 'Seoul' },
  TPE: { en: 'Taipei', it: 'Taipei', es: 'Taipéi', fr: 'Taipei', pt: 'Taipé', zh: '台北', de: 'Taipeh' },
  SIN: { en: 'Singapore', it: 'Singapore', es: 'Singapur', fr: 'Singapour', pt: 'Singapura', zh: '新加坡', de: 'Singapur' },
  BKK: { en: 'Bangkok', it: 'Bangkok', es: 'Bangkok', fr: 'Bangkok', pt: 'Banguecoque', zh: '曼谷', de: 'Bangkok' },
  SGN: { en: 'Ho Chi Minh City', it: 'Ho Chi Minh', es: 'Ciudad Ho Chi Minh', fr: 'Hô Chi Minh-Ville', pt: 'Ho Chi Minh', zh: '胡志明市', de: 'Ho-Chi-Minh-Stadt' },
  KUL: { en: 'Kuala Lumpur', it: 'Kuala Lumpur', es: 'Kuala Lumpur', fr: 'Kuala Lumpur', pt: 'Kuala Lumpur', zh: '吉隆坡', de: 'Kuala Lumpur' },
  JKT: { en: 'Jakarta', it: 'Giacarta', es: 'Yakarta', fr: 'Jakarta', pt: 'Jacarta', zh: '雅加达', de: 'Jakarta' },
  MNL: { en: 'Manila', it: 'Manila', es: 'Manila', fr: 'Manille', pt: 'Manila', zh: '马尼拉', de: 'Manila' },
  DEL: { en: 'Delhi', it: 'Delhi', es: 'Delhi', fr: 'Delhi', pt: 'Deli', zh: '德里', de: 'Delhi' },
  DXB: { en: 'Dubai', it: 'Dubai', es: 'Dubái', fr: 'Dubaï', pt: 'Dubai', zh: '迪拜', de: 'Dubai' },
  TLV: { en: 'Tel Aviv', it: 'Tel Aviv', es: 'Tel Aviv', fr: 'Tel Aviv', pt: 'Telavive', zh: '特拉维夫', de: 'Tel Aviv' },
  IST: { en: 'Istanbul', it: 'Istanbul', es: 'Estambul', fr: 'Istanbul', pt: 'Istambul', zh: '伊斯坦布尔', de: 'Istanbul' },
  KBL: { en: 'Kabul' },
  EVN: { en: 'Yerevan' },
  BAK: { en: 'Baku' },
  DAC: { en: 'Dhaka' },
  BAH: { en: 'Bahrain' },
  BWN: { en: 'Bandar Seri Begawan' },
  PBH: { en: 'Paro' },
  TBS: { en: 'Tbilisi' },
  THR: { en: 'Tehran', it: 'Teheran', es: 'Teherán', fr: 'Téhéran', pt: 'Teerão', zh: '德黑兰', de: 'Teheran' },
  BGW: { en: 'Baghdad', it: 'Baghdad', es: 'Bagdad', fr: 'Bagdad', pt: 'Bagdá', zh: '巴格达', de: 'Bagdad' },
  AMM: { en: 'Amman' },
  ALA: { en: 'Almaty' },
  FRU: { en: 'Bishkek' },
  PNH: { en: 'Phnom Penh' },
  KWI: { en: 'Kuwait City' },
  VTE: { en: 'Vientiane' },
  BEY: { en: 'Beirut' },
  CMB: { en: 'Colombo' },
  MFM: { en: 'Macau' },
  MLE: { en: 'Malé' },
  RGN: { en: 'Yangon' },
  ULN: { en: 'Ulaanbaatar' },
  KTM: { en: 'Kathmandu' },
  MCT: { en: 'Muscat' },
  KHI: { en: 'Karachi' },
  FNJ: { en: 'Pyongyang' },
  DOH: { en: 'Doha' },
  RUH: { en: 'Riyadh' },
  DAM: { en: 'Damascus', it: 'Damasco', es: 'Damasco', fr: 'Damas', pt: 'Damasco', zh: '大马士革', de: 'Damaskus' },
  DYU: { en: 'Dushanbe' },
  ASB: { en: 'Ashgabat' },
  DIL: { en: 'Dili' },
  TAS: { en: 'Tashkent' },
  SAH: { en: "Sana'a" },

  // Africa
  JNB: { en: 'Johannesburg', it: 'Johannesburg', es: 'Johannesburgo', fr: 'Johannesburg', pt: 'Joanesburgo', zh: '约翰内斯堡', de: 'Johannesburg' },
  CAI: { en: 'Cairo', it: 'Il Cairo', es: 'El Cairo', fr: 'Le Caire', pt: 'Cairo', zh: '开罗', de: 'Kairo' },
  CAS: { en: 'Casablanca', it: 'Casablanca', es: 'Casablanca', fr: 'Casablanca', pt: 'Casablanca', zh: '卡萨布兰卡', de: 'Casablanca' },
  NBO: { en: 'Nairobi', it: 'Nairobi', es: 'Nairobi', fr: 'Nairobi', pt: 'Nairóbi', zh: '内罗毕', de: 'Nairobi' },
  LAD: { en: 'Luanda' },
  BJM: { en: 'Bujumbura' },
  COO: { en: 'Cotonou' },
  OUA: { en: 'Ouagadougou' },
  GBE: { en: 'Gaborone' },
  BGF: { en: 'Bangui' },
  ABJ: { en: 'Abidjan' },
  DLA: { en: 'Douala' },
  FIH: { en: 'Kinshasa' },
  BZV: { en: 'Brazzaville' },
  HAH: { en: 'Moroni' },
  RAI: { en: 'Praia' },
  JIB: { en: 'Djibouti' },
  ALG: { en: 'Algiers', it: 'Algeri', es: 'Argel', fr: 'Alger', pt: 'Argel', zh: '阿尔及尔', de: 'Algier' },
  ASM: { en: 'Asmara' },
  EUN: { en: 'El Aaiún' },
  ADD: { en: 'Addis Ababa', it: 'Addis Abeba', es: 'Adís Abeba', fr: 'Addis-Abeba', pt: 'Adis Abeba', zh: '亚的斯亚贝巴', de: 'Addis Abeba' },
  LBV: { en: 'Libreville' },
  ACC: { en: 'Accra' },
  CKY: { en: 'Conakry' },
  BJL: { en: 'Banjul' },
  OXB: { en: 'Bissau' },
  SSG: { en: 'Malabo' },
  ROB: { en: 'Monrovia' },
  TIP: { en: 'Tripoli', it: 'Tripoli', es: 'Trípoli', fr: 'Tripoli', pt: 'Trípoli', zh: '的黎波里', de: 'Tripolis' },
  MSU: { en: 'Maseru' },
  TNR: { en: 'Antananarivo' },
  BKO: { en: 'Bamako' },
  MPM: { en: 'Maputo' },
  NKC: { en: 'Nouakchott' },
  MRU: { en: 'Mauritius' },
  LLW: { en: 'Lilongwe' },
  DZA: { en: 'Mayotte' },
  WDH: { en: 'Windhoek' },
  NIM: { en: 'Niamey' },
  LOS: { en: 'Lagos' },
  RUN: { en: 'Saint-Denis' },
  KGL: { en: 'Kigali' },
  KRT: { en: 'Khartoum' },
  DKR: { en: 'Dakar' },
  HLE: { en: 'St Helena' },
  FNA: { en: 'Freetown' },
  MGQ: { en: 'Mogadishu' },
  JUB: { en: 'Juba' },
  TMS: { en: 'São Tomé' },
  MTS: { en: 'Manzini' },
  SEZ: { en: 'Mahé' },
  NDJ: { en: "N'Djamena" },
  LFW: { en: 'Lomé' },
  TUN: { en: 'Tunis', it: 'Tunisi', es: 'Túnez', fr: 'Tunis', pt: 'Tunes', zh: '突尼斯', de: 'Tunis' },
  DAR: { en: 'Dar es Salaam' },
  EBB: { en: 'Entebbe' },
  LUN: { en: 'Lusaka' },
  HRE: { en: 'Harare' },

  // Oceania
  SYD: { en: 'Sydney', it: 'Sydney', es: 'Sídney', fr: 'Sydney', pt: 'Sydney', zh: '悉尼', de: 'Sydney' },
  AKL: { en: 'Auckland', it: 'Auckland', es: 'Auckland', fr: 'Auckland', pt: 'Auckland', zh: '奥克兰', de: 'Auckland' },
  PPG: { en: 'Pago Pago' },
  CCK: { en: 'Cocos Islands' },
  RAR: { en: 'Rarotonga' },
  XCH: { en: 'Christmas Island' },
  NAN: { en: 'Nadi' },
  PNI: { en: 'Pohnpei' },
  GUM: { en: 'Guam' },
  TRW: { en: 'Tarawa' },
  MAJ: { en: 'Majuro' },
  SPN: { en: 'Saipan' },
  NOU: { en: 'Nouméa' },
  NLK: { en: 'Norfolk Island' },
  IUE: { en: 'Niue' },
  INU: { en: 'Nauru' },
  ROR: { en: 'Koror' },
  POM: { en: 'Port Moresby' },
  PPT: { en: 'Papeete' },
  HIR: { en: 'Honiara' },
  TBU: { en: "Nuku'alofa" },
  FUN: { en: 'Funafuti' },
  VLI: { en: 'Port Vila' },
  WLS: { en: 'Wallis' },
  APW: { en: 'Apia' },
};

export function getMainCityName(iso3: string, lang: Lang): string | null {
  const code = getMainCityIata(iso3);
  if (!code) return null;
  const entry = CITY_NAMES[code];
  if (!entry) return null;
  return entry[lang] ?? entry.en;
}
