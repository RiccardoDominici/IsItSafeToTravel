/**
 * IATA city-code mapping for the most-trafficked travel destinations.
 *
 * Used by `TravelDealsWidget.astro` to pre-fill the destination field on
 * country detail pages. Returns `null` for any iso3 not in the map — the
 * widget then falls back to a free-text IATA input.
 *
 * Codes are IATA *city* codes (multi-airport metro areas) not airport codes:
 * e.g. NYC for New York (covers JFK/LGA/EWR), LON for London, TYO for Tokyo.
 */
import type { Lang } from '../i18n/ui';

const IATA_BY_ISO3: Record<string, string> = {
  // Europe
  ITA: 'ROM', FRA: 'PAR', ESP: 'MAD', GBR: 'LON', DEU: 'BER',
  NLD: 'AMS', BEL: 'BRU', CHE: 'ZRH', AUT: 'VIE', PRT: 'LIS',
  GRC: 'ATH', IRL: 'DUB', DNK: 'CPH', SWE: 'STO', NOR: 'OSL',
  FIN: 'HEL', CZE: 'PRG', POL: 'WAW', HUN: 'BUD', ROU: 'BUH',
  HRV: 'ZAG', ISL: 'REK',
  // Americas
  USA: 'NYC', CAN: 'YTO', MEX: 'MEX', BRA: 'SAO', ARG: 'BUE',
  CHL: 'SCL', COL: 'BOG', PER: 'LIM',
  // Asia / Middle East
  JPN: 'TYO', CHN: 'BJS', HKG: 'HKG', KOR: 'SEL', TWN: 'TPE',
  SGP: 'SIN', THA: 'BKK', VNM: 'SGN', MYS: 'KUL', IDN: 'JKT',
  PHL: 'MNL', IND: 'DEL', ARE: 'DXB', ISR: 'TLV', TUR: 'IST',
  // Oceania
  AUS: 'SYD', NZL: 'AKL',
  // Africa
  ZAF: 'JNB', EGY: 'CAI', MAR: 'CAS', KEN: 'NBO',
};

export function getMainCityIata(iso3: string): string | null {
  if (!iso3) return null;
  return IATA_BY_ISO3[iso3.toUpperCase()] ?? null;
}

/**
 * Localized city display name. Falls back to the English name when a locale
 * doesn't have a translation, and to `null` if the iso3 has no IATA mapping.
 *
 * Translations only cover the seven supported UI locales.
 */
const CITY_NAMES: Record<string, Partial<Record<Lang, string>> & { en: string }> = {
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
  NYC: { en: 'New York', it: 'New York', es: 'Nueva York', fr: 'New York', pt: 'Nova Iorque', zh: '纽约', de: 'New York' },
  YTO: { en: 'Toronto', it: 'Toronto', es: 'Toronto', fr: 'Toronto', pt: 'Toronto', zh: '多伦多', de: 'Toronto' },
  MEX: { en: 'Mexico City', it: 'Città del Messico', es: 'Ciudad de México', fr: 'Mexico', pt: 'Cidade do México', zh: '墨西哥城', de: 'Mexiko-Stadt' },
  SAO: { en: 'São Paulo', it: 'San Paolo', es: 'São Paulo', fr: 'São Paulo', pt: 'São Paulo', zh: '圣保罗', de: 'São Paulo' },
  BUE: { en: 'Buenos Aires', it: 'Buenos Aires', es: 'Buenos Aires', fr: 'Buenos Aires', pt: 'Buenos Aires', zh: '布宜诺斯艾利斯', de: 'Buenos Aires' },
  SCL: { en: 'Santiago', it: 'Santiago', es: 'Santiago', fr: 'Santiago', pt: 'Santiago', zh: '圣地亚哥', de: 'Santiago' },
  BOG: { en: 'Bogotá', it: 'Bogotá', es: 'Bogotá', fr: 'Bogota', pt: 'Bogotá', zh: '波哥大', de: 'Bogotá' },
  LIM: { en: 'Lima', it: 'Lima', es: 'Lima', fr: 'Lima', pt: 'Lima', zh: '利马', de: 'Lima' },
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
  SYD: { en: 'Sydney', it: 'Sydney', es: 'Sídney', fr: 'Sydney', pt: 'Sydney', zh: '悉尼', de: 'Sydney' },
  AKL: { en: 'Auckland', it: 'Auckland', es: 'Auckland', fr: 'Auckland', pt: 'Auckland', zh: '奥克兰', de: 'Auckland' },
  JNB: { en: 'Johannesburg', it: 'Johannesburg', es: 'Johannesburgo', fr: 'Johannesburg', pt: 'Joanesburgo', zh: '约翰内斯堡', de: 'Johannesburg' },
  CAI: { en: 'Cairo', it: 'Il Cairo', es: 'El Cairo', fr: 'Le Caire', pt: 'Cairo', zh: '开罗', de: 'Kairo' },
  CAS: { en: 'Casablanca', it: 'Casablanca', es: 'Casablanca', fr: 'Casablanca', pt: 'Casablanca', zh: '卡萨布兰卡', de: 'Casablanca' },
  NBO: { en: 'Nairobi', it: 'Nairobi', es: 'Nairobi', fr: 'Nairobi', pt: 'Nairóbi', zh: '内罗毕', de: 'Nairobi' },
};

export function getMainCityName(iso3: string, lang: Lang): string | null {
  const code = getMainCityIata(iso3);
  if (!code) return null;
  const entry = CITY_NAMES[code];
  if (!entry) return null;
  return entry[lang] ?? entry.en;
}
