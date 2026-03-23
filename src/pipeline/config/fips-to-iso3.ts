/**
 * Static FIPS 10-4 to ISO 3166-1 alpha-3 country code mapping.
 * Used by the GDELT fetcher (Phase 24) which returns FIPS country codes.
 *
 * Source: CIA World Factbook FIPS 10-4 code list cross-referenced with ISO 3166.
 * Includes historical/legacy codes still emitted by GDELT.
 */
export const FIPS_TO_ISO3: Record<string, string> = {
  // A
  'AA': 'ABW', // Aruba
  'AC': 'ATG', // Antigua and Barbuda
  'AE': 'ARE', // United Arab Emirates
  'AF': 'AFG', // Afghanistan
  'AG': 'DZA', // Algeria
  'AJ': 'AZE', // Azerbaijan
  'AL': 'ALB', // Albania
  'AM': 'ARM', // Armenia
  'AN': 'AND', // Andorra
  'AO': 'AGO', // Angola
  'AQ': 'ASM', // American Samoa
  'AR': 'ARG', // Argentina
  'AS': 'AUS', // Australia
  'AT': 'ASH', // Ashmore and Cartier Islands
  'AU': 'AUT', // Austria
  'AV': 'AIA', // Anguilla
  'AX': 'ALA', // Akrotiri (Sovereign Base Area)
  'AY': 'ATA', // Antarctica

  // B
  'BA': 'BHR', // Bahrain
  'BB': 'BRB', // Barbados
  'BC': 'BWA', // Botswana
  'BD': 'BMU', // Bermuda
  'BE': 'BEL', // Belgium
  'BF': 'BHS', // Bahamas
  'BG': 'BGD', // Bangladesh
  'BH': 'BLZ', // Belize
  'BK': 'BIH', // Bosnia and Herzegovina
  'BL': 'BOL', // Bolivia
  'BM': 'MMR', // Myanmar (Burma)
  'BN': 'BEN', // Benin
  'BO': 'BLR', // Belarus
  'BP': 'SLB', // Solomon Islands
  'BQ': 'NAV', // Navassa Island
  'BR': 'BRA', // Brazil
  'BT': 'BTN', // Bhutan
  'BU': 'BGR', // Bulgaria
  'BV': 'BVT', // Bouvet Island
  'BX': 'BRN', // Brunei
  'BY': 'BDI', // Burundi

  // C
  'CA': 'CAN', // Canada
  'CB': 'KHM', // Cambodia
  'CD': 'TCD', // Chad
  'CE': 'LKA', // Sri Lanka
  'CF': 'COG', // Republic of the Congo
  'CG': 'COD', // Democratic Republic of the Congo
  'CH': 'CHN', // China
  'CI': 'CHL', // Chile
  'CJ': 'CYM', // Cayman Islands
  'CK': 'CCK', // Cocos (Keeling) Islands
  'CM': 'CMR', // Cameroon
  'CN': 'COM', // Comoros
  'CO': 'COL', // Colombia
  'CQ': 'MNP', // Northern Mariana Islands
  'CR': 'CRI', // Costa Rica (also CS)
  'CS': 'CRI', // Costa Rica
  'CT': 'CAF', // Central African Republic
  'CU': 'CUB', // Cuba
  'CV': 'CPV', // Cabo Verde
  'CW': 'COK', // Cook Islands
  'CY': 'CYP', // Cyprus

  // D
  'DA': 'DNK', // Denmark
  'DJ': 'DJI', // Djibouti
  'DO': 'DMA', // Dominica
  'DQ': 'JAR', // Jarvis Island
  'DR': 'DOM', // Dominican Republic
  'DX': 'DHK', // Dhekelia (Sovereign Base Area)

  // E
  'EC': 'ECU', // Ecuador
  'EG': 'EGY', // Egypt
  'EI': 'IRL', // Ireland
  'EK': 'GNQ', // Equatorial Guinea
  'EN': 'EST', // Estonia
  'ER': 'ERI', // Eritrea
  'ES': 'SLV', // El Salvador
  'ET': 'ETH', // Ethiopia
  'EU': 'EUR', // Europa Island (mapped to generic)
  'EZ': 'CZE', // Czech Republic (Czechia)

  // F
  'FG': 'GUF', // French Guiana
  'FI': 'FIN', // Finland
  'FJ': 'FJI', // Fiji
  'FK': 'FLK', // Falkland Islands
  'FM': 'FSM', // Micronesia
  'FO': 'FRO', // Faroe Islands
  'FP': 'PYF', // French Polynesia
  'FQ': 'ATF', // Baker Island (French Southern Territories)
  'FR': 'FRA', // France
  'FS': 'ATF', // French Southern and Antarctic Lands

  // G
  'GA': 'GMB', // Gambia
  'GB': 'GAB', // Gabon
  'GG': 'GEO', // Georgia
  'GH': 'GHA', // Ghana
  'GI': 'GIB', // Gibraltar
  'GJ': 'GRD', // Grenada
  'GK': 'GGY', // Guernsey
  'GL': 'GRL', // Greenland
  'GM': 'DEU', // Germany
  'GO': 'GLP', // Glorioso Islands
  'GP': 'GLP', // Guadeloupe
  'GQ': 'GUM', // Guam
  'GR': 'GRC', // Greece
  'GT': 'GTM', // Guatemala
  'GV': 'GIN', // Guinea
  'GY': 'GUY', // Guyana
  'GZ': 'PSE', // Gaza Strip -> Palestine

  // H
  'HA': 'HTI', // Haiti
  'HK': 'HKG', // Hong Kong
  'HM': 'HMD', // Heard Island and McDonald Islands
  'HO': 'HND', // Honduras
  'HQ': 'HMD', // Howland Island
  'HR': 'HRV', // Croatia
  'HU': 'HUN', // Hungary

  // I
  'IC': 'ISL', // Iceland
  'ID': 'IDN', // Indonesia
  'IM': 'IMN', // Isle of Man
  'IN': 'IND', // India
  'IO': 'IOT', // British Indian Ocean Territory
  'IP': 'CLP', // Clipperton Island
  'IR': 'IRN', // Iran
  'IS': 'ISR', // Israel
  'IT': 'ITA', // Italy
  'IV': 'CIV', // Cote d'Ivoire
  'IZ': 'IRQ', // Iraq

  // J
  'JA': 'JPN', // Japan
  'JE': 'JEY', // Jersey
  'JM': 'JAM', // Jamaica
  'JN': 'JAN', // Jan Mayen
  'JO': 'JOR', // Jordan
  'JQ': 'JOH', // Johnston Atoll
  'JU': 'JEY', // Juan de Nova Island

  // K
  'KE': 'KEN', // Kenya
  'KG': 'KGZ', // Kyrgyzstan
  'KN': 'PRK', // North Korea
  'KQ': 'KIR', // Kingman Reef
  'KR': 'KIR', // Kiribati
  'KS': 'KOR', // South Korea
  'KT': 'CXR', // Christmas Island
  'KU': 'KWT', // Kuwait
  'KV': 'XKX', // Kosovo
  'KZ': 'KAZ', // Kazakhstan

  // L
  'LA': 'LAO', // Laos
  'LE': 'LBN', // Lebanon
  'LG': 'LVA', // Latvia
  'LH': 'LTU', // Lithuania
  'LI': 'LBR', // Liberia
  'LO': 'SVK', // Slovakia
  'LQ': 'PAL', // Palmyra Atoll
  'LS': 'LIE', // Liechtenstein
  'LT': 'LSO', // Lesotho
  'LU': 'LUX', // Luxembourg
  'LY': 'LBY', // Libya

  // M
  'MA': 'MDG', // Madagascar
  'MB': 'MTQ', // Martinique
  'MC': 'MAC', // Macau
  'MD': 'MDA', // Moldova
  'MF': 'MYT', // Mayotte
  'MG': 'MNG', // Mongolia
  'MH': 'MSR', // Montserrat
  'MI': 'MWI', // Malawi
  'MJ': 'MNE', // Montenegro
  'MK': 'MKD', // North Macedonia
  'ML': 'MLI', // Mali
  'MN': 'MCO', // Monaco
  'MO': 'MAR', // Morocco
  'MP': 'MUS', // Mauritius
  'MQ': 'MID', // Midway Islands
  'MR': 'MRT', // Mauritania
  'MT': 'MLT', // Malta
  'MU': 'OMN', // Oman
  'MV': 'MDV', // Maldives
  'MX': 'MEX', // Mexico
  'MY': 'MYS', // Malaysia
  'MZ': 'MOZ', // Mozambique

  // N
  'NC': 'NCL', // New Caledonia
  'NE': 'NIU', // Niue
  'NF': 'NFK', // Norfolk Island
  'NG': 'NER', // Niger
  'NH': 'VUT', // Vanuatu
  'NI': 'NGA', // Nigeria
  'NL': 'NLD', // Netherlands
  'NO': 'NOR', // Norway
  'NP': 'NPL', // Nepal
  'NR': 'NRU', // Nauru
  'NS': 'SUR', // Suriname
  'NT': 'ANT', // Netherlands Antilles (legacy)
  'NU': 'NIC', // Nicaragua
  'NZ': 'NZL', // New Zealand

  // O
  'OD': 'SSD', // South Sudan

  // P
  'PA': 'PRY', // Paraguay
  'PC': 'PCN', // Pitcairn Islands
  'PE': 'PER', // Peru
  'PF': 'PSE', // Paracel Islands -> mapped to generic
  'PK': 'PAK', // Pakistan
  'PL': 'POL', // Poland
  'PM': 'PAN', // Panama
  'PO': 'PRT', // Portugal
  'PP': 'PNG', // Papua New Guinea
  'PS': 'PLW', // Palau
  'PU': 'GNB', // Guinea-Bissau

  // Q
  'QA': 'QAT', // Qatar

  // R
  'RE': 'REU', // Reunion
  'RI': 'SRB', // Serbia
  'RM': 'MHL', // Marshall Islands
  'RN': 'SMR', // San Marino (also SM)
  'RO': 'ROU', // Romania
  'RP': 'PHL', // Philippines
  'RQ': 'PRI', // Puerto Rico
  'RS': 'RUS', // Russia
  'RW': 'RWA', // Rwanda

  // S
  'SA': 'SAU', // Saudi Arabia
  'SB': 'SPM', // Saint Pierre and Miquelon
  'SC': 'KNA', // Saint Kitts and Nevis
  'SE': 'SYC', // Seychelles
  'SF': 'ZAF', // South Africa
  'SG': 'SEN', // Senegal
  'SH': 'SHN', // Saint Helena
  'SI': 'SVN', // Slovenia
  'SL': 'SLE', // Sierra Leone
  'SM': 'SMR', // San Marino
  'SN': 'SGP', // Singapore
  'SO': 'SOM', // Somalia
  'SP': 'ESP', // Spain
  'ST': 'LCA', // Saint Lucia
  'SU': 'SDN', // Sudan
  'SV': 'SJM', // Svalbard
  'SW': 'SWE', // Sweden
  'SX': 'SGS', // South Georgia and the South Sandwich Islands
  'SY': 'SYR', // Syria
  'SZ': 'CHE', // Switzerland

  // T
  'TD': 'TTO', // Trinidad and Tobago
  'TE': 'TRO', // Tromelin Island
  'TH': 'THA', // Thailand
  'TI': 'TJK', // Tajikistan
  'TK': 'TCA', // Turks and Caicos Islands
  'TL': 'TKL', // Tokelau
  'TN': 'TON', // Tonga
  'TO': 'TGO', // Togo
  'TP': 'STP', // Sao Tome and Principe
  'TS': 'TUN', // Tunisia
  'TT': 'TLS', // Timor-Leste (East Timor)
  'TU': 'TUR', // Turkey
  'TV': 'TUV', // Tuvalu
  'TW': 'TWN', // Taiwan
  'TX': 'TKM', // Turkmenistan
  'TZ': 'TZA', // Tanzania

  // U
  'UC': 'CUW', // Curacao
  'UG': 'UGA', // Uganda
  'UK': 'GBR', // United Kingdom
  'UP': 'UKR', // Ukraine
  'US': 'USA', // United States
  'UV': 'BFA', // Burkina Faso
  'UY': 'URY', // Uruguay
  'UZ': 'UZB', // Uzbekistan

  // V
  'VC': 'VCT', // Saint Vincent and the Grenadines
  'VE': 'VEN', // Venezuela
  'VI': 'VGB', // British Virgin Islands
  'VM': 'VNM', // Vietnam
  'VQ': 'VIR', // US Virgin Islands
  'VT': 'VAT', // Vatican City (Holy See)

  // W
  'WA': 'NAM', // Namibia
  'WE': 'PSE', // West Bank -> Palestine
  'WF': 'WLF', // Wallis and Futuna
  'WI': 'ESH', // Western Sahara
  'WQ': 'WAK', // Wake Island
  'WS': 'WSM', // Samoa
  'WZ': 'SWZ', // Eswatini (Swaziland)

  // Y
  'YM': 'YEM', // Yemen

  // Z
  'ZA': 'ZMB', // Zambia
  'ZI': 'ZWE', // Zimbabwe
};

/**
 * Convert a FIPS 10-4 country code to ISO 3166-1 alpha-3.
 * Returns undefined for unknown codes.
 */
export function fipsToIso3(fips: string): string | undefined {
  return FIPS_TO_ISO3[fips.toUpperCase()];
}
