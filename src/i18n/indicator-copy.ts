/**
 * How each scored indicator is described to a reader, in all 7 locales (formula v10, SPEC §7):
 *  - `units`: the unit or source scale printed under a raw value in the pillar tables
 *    ("per 100,000 people", "GPI scale 1–5, lower is better", "INFORM risk, higher is worse"),
 *  - `topics` + `facts`: the plain-words driver used by the top summary
 *    ("The main risk is violent crime: 45.7 homicides per 100,000 people (World Bank, 2023)"),
 *  - `sourceNames` / `worldBankLagNote`: source labels and the World Bank publication-lag note.
 *
 * WHY: v9.1 pages printed every indicator as a normalised "x.x/10" next to a raw key, and the
 * summary said "the biggest concern is governance (3.9/10)" — numbers a reader cannot check
 * against anything. Every value here is the source's own number on the source's own scale, with
 * its real data year, so it can be looked up at the source.
 *
 * Labels (the indicator names themselves) stay in ui.ts `methodology.indicator.*`, shared with the
 * methodology table (src/i18n/indicator-labels.ts).
 *
 * Grammar notes:
 *  - `topics` are singular noun phrases with their article where the language needs one, so the
 *    summary frames ("Il rischio principale è {topic}", "Das größte Risiko ist {topic}") never
 *    need number agreement.
 *  - `facts` take {v} (the value, already formatted for the locale) and {y} (the data year);
 *    count-based facts pick a singular/plural form from the raw count. A fact always follows its
 *    topic ("{topic}: {fact}"), so it never repeats the topic: the INFORM facts lead with the value
 *    ("exposure to natural hazards: 6.5 out of 10 on the INFORM risk scale, …") instead of
 *    "INFORM rates exposure to natural hazards at 6.5 …".
 *  - Every scale names BOTH ends and the source edition sits in the subject ("the 2026 Global
 *    Peace Index rates … from 1 (safest) to 5 (least safe)"): "… to 5 (GPI 2026)" read as if the
 *    top of the scale were labelled "GPI 2026" (2026-10-15 audit, I17). INFORM values say "risk
 *    scale" so a reader never takes 8.1 as a good mark on the page's 10-is-safest pillar scale (I07).
 *  - Topics are negative ("poor public safety"): the summary and the FAQ quote a fact only when its
 *    value is in the bad half of its scale (selectBadDriver in src/lib/indicator-display.ts, I04).
 *  - en follows US spelling, like the rest of the en site (militarization, organized, travelers).
 *  - zh never puts a space between Chinese words and a country name; numbers follow the existing
 *    zh copy (no space needed around them).
 */
import type { Lang } from './ui';

/** Display scale of a raw indicator value. */
export type IndicatorScale =
  | 'per100k' // rate per 100,000 people
  | 'deaths' // count of conflict deaths in the data year
  | 'gpi' // Global Peace Index score, 1-5, lower is better
  | 'inform' // INFORM risk score, 0-10, higher is worse
  | 'vdemUp' // V-Dem index 0-1, higher is better
  | 'vdemDown' // V-Dem index 0-1, lower is better
  | 'vdemLatent' // V-Dem measurement-model score, about -4..+4, higher is better
  | 'disasters' // count of ongoing disasters
  | 'alerts'; // count of orange/red alerts

/** Scored indicators that have a plain-words description (weights.json minus the synthetic "A"). */
export type DescribedIndicator =
  | 'wb_homicide'
  | 'gpi_safety_security'
  | 'gpi_overall'
  | 'gpi_militarisation'
  | 'ucdp_conflict_deaths'
  | 'inform_health_access'
  | 'inform_epidemic'
  | 'inform_governance'
  | 'inform_natural'
  | 'vdem_rule_of_law'
  | 'vdem_corruption_control'
  | 'vdem_gov_effectiveness'
  | 'reliefweb_active_disasters'
  | 'gdacs_disaster_alerts';

/** A fact template: a string with {v}/{y}, or [singular, plural] picked by the raw count. */
export type FactTemplate = string | readonly [string, string];

export interface IndicatorCopy {
  /** Unit or scale under the value; [singular, plural] where the count decides. */
  units: Record<IndicatorScale, string | readonly [string, string]>;
  topics: Record<DescribedIndicator, string>;
  facts: Record<DescribedIndicator, FactTemplate>;
  /** Display name of each source, as shown in the pillar tables. */
  sourceNames: { worldbank: string; ucdp: string; reliefweb: string; gdacs: string; vdem: string };
  worldBankLagNote: string;
}

export const indicatorCopy: Record<Lang, IndicatorCopy> = {
  en: {
    units: {
      per100k: 'per 100,000 people',
      deaths: ['conflict death', 'conflict deaths'],
      gpi: 'GPI scale 1–5, lower is better',
      inform: 'INFORM risk, higher is worse',
      vdemUp: 'scale 0–1, higher is better',
      vdemDown: 'scale 0–1, lower is better',
      vdemLatent: 'scale about −4 to +4, higher is better',
      disasters: ['ongoing disaster', 'ongoing disasters'],
      alerts: ['orange or red alert', 'orange or red alerts'],
    },
    topics: {
      wb_homicide: 'violent crime',
      gpi_safety_security: 'poor public safety',
      gpi_overall: 'violence and insecurity',
      gpi_militarisation: 'militarization',
      ucdp_conflict_deaths: 'armed conflict',
      inform_health_access: 'poor access to health care',
      inform_epidemic: 'epidemic risk',
      inform_governance: 'weak institutions',
      vdem_rule_of_law: 'weak rule of law',
      vdem_corruption_control: 'corruption',
      vdem_gov_effectiveness: 'weak public administration',
      inform_natural: 'exposure to earthquakes, floods and storms',
      reliefweb_active_disasters: 'ongoing natural disasters',
      gdacs_disaster_alerts: 'recent natural disasters',
    },
    facts: {
      wb_homicide: '{v} homicides per 100,000 people (World Bank, {y})',
      gpi_safety_security: 'the {y} Global Peace Index rates safety and security at {v} on a scale from 1 (safest) to 5 (least safe)',
      gpi_overall: 'the {y} Global Peace Index scores the country {v} on a scale from 1 (most peaceful) to 5 (least peaceful)',
      gpi_militarisation: 'the {y} Global Peace Index rates militarization at {v} on a scale from 1 (lowest) to 5 (highest)',
      ucdp_conflict_deaths: ['{v} conflict death in {y} (UCDP)', '{v} conflict deaths in {y} (UCDP)'],
      inform_health_access: '{v} out of 10 on the INFORM risk scale, where 10 is the worst access (INFORM Risk {y})',
      inform_epidemic: '{v} out of 10 on the INFORM risk scale, where 10 is the highest risk (INFORM Risk {y})',
      inform_governance: '{v} out of 10 on the INFORM risk scale, where 10 is the worst (INFORM Risk {y})',
      inform_natural: '{v} out of 10 on the INFORM risk scale, where 10 is the highest exposure (INFORM Risk {y})',
      vdem_rule_of_law: 'V-Dem rates the rule of law at {v} on a scale from 0 to 1, where 1 is the strongest (V-Dem, {y} data)',
      vdem_corruption_control: 'V-Dem rates political corruption at {v} on a scale from 0 to 1, where 1 is the most corrupt (V-Dem, {y} data)',
      vdem_gov_effectiveness: 'V-Dem rates the impartiality of public administration at {v} on a scale of about −4 to +4, where higher is better (V-Dem, {y} data)',
      reliefweb_active_disasters: ['ReliefWeb lists {v} ongoing disaster ({y})', 'ReliefWeb lists {v} ongoing disasters ({y})'],
      gdacs_disaster_alerts: ['GDACS issued {v} orange or red disaster alert in {y}', 'GDACS issued {v} orange or red disaster alerts in {y}'],
    },
    sourceNames: { worldbank: 'World Bank', ucdp: 'UCDP', reliefweb: 'ReliefWeb', gdacs: 'GDACS', vdem: 'V-Dem v16' },
    worldBankLagNote: 'Latest value the World Bank has published. Its figures arrive late and can be several years old: check the year.',
  },
  it: {
    units: {
      per100k: 'ogni 100.000 abitanti',
      deaths: ['vittima di conflitti armati', 'vittime di conflitti armati'],
      gpi: 'scala GPI da 1 a 5, più basso è meglio',
      inform: 'rischio INFORM, più alto è peggio',
      vdemUp: 'scala da 0 a 1, più alto è meglio',
      vdemDown: 'scala da 0 a 1, più basso è meglio',
      vdemLatent: 'scala da circa −4 a +4, più alto è meglio',
      disasters: ['disastro in corso', 'disastri in corso'],
      alerts: ['allerta arancione o rossa', 'allerte arancioni o rosse'],
    },
    topics: {
      wb_homicide: 'la criminalità violenta',
      gpi_safety_security: 'la scarsa sicurezza pubblica',
      gpi_overall: 'un clima di violenza e insicurezza',
      gpi_militarisation: 'la militarizzazione',
      ucdp_conflict_deaths: 'il conflitto armato',
      inform_health_access: 'lo scarso accesso alle cure mediche',
      inform_epidemic: 'il rischio di epidemie',
      inform_governance: 'la debolezza delle istituzioni',
      vdem_rule_of_law: 'la debolezza dello stato di diritto',
      vdem_corruption_control: 'la corruzione',
      vdem_gov_effectiveness: 'una pubblica amministrazione poco imparziale',
      inform_natural: "l'esposizione a terremoti, alluvioni e tempeste",
      reliefweb_active_disasters: "l'impatto dei disastri naturali in corso",
      gdacs_disaster_alerts: 'i disastri naturali recenti',
    },
    facts: {
      wb_homicide: '{v} omicidi ogni 100.000 abitanti (Banca Mondiale, {y})',
      gpi_safety_security: 'il Global Peace Index {y} assegna a sicurezza e protezione un punteggio di {v} su una scala da 1 (massima sicurezza) a 5 (minima sicurezza)',
      gpi_overall: 'il Global Peace Index {y} assegna al paese un punteggio di {v} su una scala da 1 (paese più pacifico) a 5 (paese meno pacifico)',
      gpi_militarisation: 'il Global Peace Index {y} assegna alla militarizzazione un punteggio di {v} su una scala da 1 (minima) a 5 (massima)',
      ucdp_conflict_deaths: ['{v} morto nel {y} (UCDP)', '{v} morti nel {y} (UCDP)'],
      inform_health_access: '{v} su 10 nella scala di rischio INFORM, dove 10 indica l\'accesso peggiore (INFORM Risk {y})',
      inform_epidemic: '{v} su 10 nella scala di rischio INFORM, dove 10 indica il rischio più alto (INFORM Risk {y})',
      inform_governance: '{v} su 10 nella scala di rischio INFORM, dove 10 è il valore peggiore (INFORM Risk {y})',
      inform_natural: "{v} su 10 nella scala di rischio INFORM, dove 10 indica l'esposizione più alta (INFORM Risk {y})",
      vdem_rule_of_law: 'V-Dem valuta lo stato di diritto {v} su una scala da 0 a 1, dove 1 è il valore migliore (V-Dem, dati {y})',
      vdem_corruption_control: 'V-Dem valuta la corruzione politica {v} su una scala da 0 a 1, dove 1 indica la corruzione più alta (V-Dem, dati {y})',
      vdem_gov_effectiveness: "V-Dem valuta l'imparzialità della pubblica amministrazione {v} su una scala da circa −4 a +4, dove più alto è meglio (V-Dem, dati {y})",
      reliefweb_active_disasters: ['ReliefWeb segnala {v} disastro in corso ({y})', 'ReliefWeb segnala {v} disastri in corso ({y})'],
      gdacs_disaster_alerts: ['GDACS ha emesso {v} allerta arancione o rossa nel {y}', 'GDACS ha emesso {v} allerte arancioni o rosse nel {y}'],
    },
    sourceNames: { worldbank: 'Banca Mondiale', ucdp: 'UCDP', reliefweb: 'ReliefWeb', gdacs: 'GDACS', vdem: 'V-Dem v16' },
    worldBankLagNote: 'Ultimo valore pubblicato dalla Banca Mondiale. I suoi dati escono in ritardo e possono risalire a diversi anni fa: controlla l\'anno.',
  },
  es: {
    units: {
      per100k: 'por cada 100.000 habitantes',
      deaths: ['muerte en conflictos armados', 'muertes en conflictos armados'],
      gpi: 'escala GPI de 1 a 5, cuanto más bajo, mejor',
      inform: 'riesgo INFORM, cuanto más alto, peor',
      vdemUp: 'escala de 0 a 1, cuanto más alto, mejor',
      vdemDown: 'escala de 0 a 1, cuanto más bajo, mejor',
      vdemLatent: 'escala de −4 a +4 aprox., cuanto más alto, mejor',
      disasters: ['desastre activo', 'desastres activos'],
      alerts: ['alerta naranja o roja', 'alertas naranjas o rojas'],
    },
    topics: {
      wb_homicide: 'la delincuencia violenta',
      gpi_safety_security: 'la inseguridad ciudadana',
      gpi_overall: 'un clima de violencia e inseguridad',
      gpi_militarisation: 'la militarización',
      ucdp_conflict_deaths: 'el conflicto armado',
      inform_health_access: 'el acceso limitado a la atención sanitaria',
      inform_epidemic: 'el riesgo de epidemias',
      inform_governance: 'la debilidad institucional',
      vdem_rule_of_law: 'la debilidad del Estado de derecho',
      vdem_corruption_control: 'la corrupción',
      vdem_gov_effectiveness: 'una administración pública poco imparcial',
      inform_natural: 'la exposición a terremotos, inundaciones y tormentas',
      reliefweb_active_disasters: 'el impacto de desastres naturales en curso',
      gdacs_disaster_alerts: 'los desastres naturales recientes',
    },
    facts: {
      wb_homicide: '{v} homicidios por cada 100.000 habitantes (Banco Mundial, {y})',
      gpi_safety_security: 'el Global Peace Index {y} puntúa la seguridad y protección con {v} en una escala de 1 (máxima seguridad) a 5 (mínima seguridad)',
      gpi_overall: 'el Global Peace Index {y} da al país un {v} en una escala de 1 (el más pacífico) a 5 (el menos pacífico)',
      gpi_militarisation: 'el Global Peace Index {y} puntúa la militarización con {v} en una escala de 1 (mínima) a 5 (máxima)',
      ucdp_conflict_deaths: ['{v} muerte en {y} (UCDP)', '{v} muertes en {y} (UCDP)'],
      inform_health_access: '{v} sobre 10 en la escala de riesgo de INFORM, donde 10 es el peor acceso (INFORM Risk {y})',
      inform_epidemic: '{v} sobre 10 en la escala de riesgo de INFORM, donde 10 es el riesgo máximo (INFORM Risk {y})',
      inform_governance: '{v} sobre 10 en la escala de riesgo de INFORM, donde 10 es lo peor (INFORM Risk {y})',
      inform_natural: '{v} sobre 10 en la escala de riesgo de INFORM, donde 10 es la exposición máxima (INFORM Risk {y})',
      vdem_rule_of_law: 'V-Dem puntúa el Estado de derecho con {v} en una escala de 0 a 1, donde 1 es lo mejor (V-Dem, datos de {y})',
      vdem_corruption_control: 'V-Dem puntúa la corrupción política con {v} en una escala de 0 a 1, donde 1 es la máxima corrupción (V-Dem, datos de {y})',
      vdem_gov_effectiveness: 'V-Dem puntúa la imparcialidad de la administración pública con {v} en una escala de −4 a +4 aprox., donde más alto es mejor (V-Dem, datos de {y})',
      reliefweb_active_disasters: ['ReliefWeb registra {v} desastre activo ({y})', 'ReliefWeb registra {v} desastres activos ({y})'],
      gdacs_disaster_alerts: ['GDACS emitió {v} alerta naranja o roja en {y}', 'GDACS emitió {v} alertas naranjas o rojas en {y}'],
    },
    sourceNames: { worldbank: 'Banco Mundial', ucdp: 'UCDP', reliefweb: 'ReliefWeb', gdacs: 'GDACS', vdem: 'V-Dem v16' },
    worldBankLagNote: 'Último valor publicado por el Banco Mundial. Sus datos llegan con retraso y pueden tener varios años: fíjate en el año.',
  },
  fr: {
    units: {
      per100k: 'pour 100 000 habitants',
      deaths: ['mort liée aux conflits armés', 'morts liées aux conflits armés'],
      gpi: 'échelle GPI de 1 à 5, plus bas = mieux',
      inform: 'risque INFORM, plus haut = pire',
      vdemUp: 'échelle de 0 à 1, plus haut = mieux',
      vdemDown: 'échelle de 0 à 1, plus bas = mieux',
      vdemLatent: 'échelle d’environ −4 à +4, plus haut = mieux',
      disasters: ['catastrophe en cours', 'catastrophes en cours'],
      alerts: ['alerte orange ou rouge', 'alertes orange ou rouges'],
    },
    topics: {
      wb_homicide: 'la criminalité violente',
      gpi_safety_security: 'l’insécurité',
      gpi_overall: 'un climat de violence et d’insécurité',
      gpi_militarisation: 'la militarisation',
      ucdp_conflict_deaths: 'le conflit armé',
      inform_health_access: 'l’accès limité aux soins',
      inform_epidemic: 'le risque d’épidémie',
      inform_governance: 'la faiblesse des institutions',
      vdem_rule_of_law: 'la faiblesse de l’État de droit',
      vdem_corruption_control: 'la corruption',
      vdem_gov_effectiveness: 'une administration publique peu impartiale',
      inform_natural: 'l’exposition aux séismes, inondations et tempêtes',
      reliefweb_active_disasters: 'l’impact des catastrophes naturelles en cours',
      gdacs_disaster_alerts: 'les catastrophes naturelles récentes',
    },
    facts: {
      wb_homicide: '{v} homicides pour 100 000 habitants (Banque mondiale, {y})',
      gpi_safety_security: 'le Global Peace Index {y} attribue à la sûreté et à la sécurité la note de {v} sur une échelle allant de 1 (sécurité maximale) à 5 (sécurité minimale)',
      gpi_overall: 'le Global Peace Index {y} attribue au pays la note de {v} sur une échelle allant de 1 (le plus pacifique) à 5 (le moins pacifique)',
      gpi_militarisation: 'le Global Peace Index {y} attribue à la militarisation la note de {v} sur une échelle allant de 1 (la plus faible) à 5 (la plus forte)',
      ucdp_conflict_deaths: ['{v} mort en {y} (UCDP)', '{v} morts en {y} (UCDP)'],
      inform_health_access: '{v} sur 10 sur l’échelle de risque d’INFORM, 10 correspondant au plus mauvais accès (INFORM Risk {y})',
      inform_epidemic: '{v} sur 10 sur l’échelle de risque d’INFORM, 10 correspondant au risque le plus élevé (INFORM Risk {y})',
      inform_governance: '{v} sur 10 sur l’échelle de risque d’INFORM, 10 étant le pire (INFORM Risk {y})',
      inform_natural: '{v} sur 10 sur l’échelle de risque d’INFORM, 10 correspondant à l’exposition la plus forte (INFORM Risk {y})',
      vdem_rule_of_law: 'V-Dem note l’État de droit {v} sur une échelle de 0 à 1, 1 étant le meilleur (V-Dem, données {y})',
      vdem_corruption_control: 'V-Dem note la corruption politique {v} sur une échelle de 0 à 1, 1 étant la plus forte (V-Dem, données {y})',
      vdem_gov_effectiveness: 'V-Dem note l’impartialité de l’administration publique {v} sur une échelle d’environ −4 à +4, plus haut étant mieux (V-Dem, données {y})',
      reliefweb_active_disasters: ['ReliefWeb recense {v} catastrophe en cours ({y})', 'ReliefWeb recense {v} catastrophes en cours ({y})'],
      gdacs_disaster_alerts: ['le GDACS a émis {v} alerte orange ou rouge en {y}', 'le GDACS a émis {v} alertes orange ou rouges en {y}'],
    },
    sourceNames: { worldbank: 'Banque mondiale', ucdp: 'UCDP', reliefweb: 'ReliefWeb', gdacs: 'GDACS', vdem: 'V-Dem v16' },
    worldBankLagNote: 'Dernière valeur publiée par la Banque mondiale. Ses données paraissent avec retard et peuvent dater de plusieurs années : vérifiez l’année.',
  },
  pt: {
    units: {
      per100k: 'por 100 mil habitantes',
      deaths: ['morte em conflitos armados', 'mortes em conflitos armados'],
      gpi: 'escala GPI de 1 a 5, quanto menor, melhor',
      inform: 'risco INFORM, quanto maior, pior',
      vdemUp: 'escala de 0 a 1, quanto maior, melhor',
      vdemDown: 'escala de 0 a 1, quanto menor, melhor',
      vdemLatent: 'escala de cerca de −4 a +4, quanto maior, melhor',
      disasters: ['desastre em andamento', 'desastres em andamento'],
      alerts: ['alerta laranja ou vermelho', 'alertas laranja ou vermelhos'],
    },
    topics: {
      wb_homicide: 'a criminalidade violenta',
      gpi_safety_security: 'a insegurança pública',
      gpi_overall: 'um clima de violência e insegurança',
      gpi_militarisation: 'a militarização',
      ucdp_conflict_deaths: 'o conflito armado',
      inform_health_access: 'o acesso limitado a cuidados de saúde',
      inform_epidemic: 'o risco de epidemias',
      inform_governance: 'a fragilidade das instituições',
      vdem_rule_of_law: 'a fragilidade do Estado de direito',
      vdem_corruption_control: 'a corrupção',
      vdem_gov_effectiveness: 'uma administração pública pouco imparcial',
      inform_natural: 'a exposição a terremotos, enchentes e tempestades',
      reliefweb_active_disasters: 'o impacto de desastres naturais em andamento',
      gdacs_disaster_alerts: 'os desastres naturais recentes',
    },
    facts: {
      wb_homicide: '{v} homicídios por 100 mil habitantes (Banco Mundial, {y})',
      gpi_safety_security: 'o Global Peace Index {y} dá nota {v} à segurança e proteção, em uma escala de 1 (mais seguro) a 5 (menos seguro)',
      gpi_overall: 'o Global Peace Index {y} dá ao país nota {v}, em uma escala de 1 (mais pacífico) a 5 (menos pacífico)',
      gpi_militarisation: 'o Global Peace Index {y} dá nota {v} à militarização, em uma escala de 1 (menor) a 5 (maior)',
      ucdp_conflict_deaths: ['{v} morte em {y} (UCDP)', '{v} mortes em {y} (UCDP)'],
      inform_health_access: '{v} de 10 na escala de risco do INFORM, sendo 10 o pior acesso (INFORM Risk {y})',
      inform_epidemic: '{v} de 10 na escala de risco do INFORM, sendo 10 o risco mais alto (INFORM Risk {y})',
      inform_governance: '{v} de 10 na escala de risco do INFORM, sendo 10 o pior (INFORM Risk {y})',
      inform_natural: '{v} de 10 na escala de risco do INFORM, sendo 10 a exposição mais alta (INFORM Risk {y})',
      vdem_rule_of_law: 'o V-Dem avalia o Estado de direito em {v} em uma escala de 0 a 1, sendo 1 o melhor (V-Dem, dados de {y})',
      vdem_corruption_control: 'o V-Dem avalia a corrupção política em {v} em uma escala de 0 a 1, sendo 1 a mais alta (V-Dem, dados de {y})',
      vdem_gov_effectiveness: 'o V-Dem avalia a imparcialidade da administração pública em {v} em uma escala de cerca de −4 a +4, quanto maior, melhor (V-Dem, dados de {y})',
      reliefweb_active_disasters: ['o ReliefWeb registra {v} desastre em andamento ({y})', 'o ReliefWeb registra {v} desastres em andamento ({y})'],
      gdacs_disaster_alerts: ['o GDACS emitiu {v} alerta laranja ou vermelho em {y}', 'o GDACS emitiu {v} alertas laranja ou vermelhos em {y}'],
    },
    sourceNames: { worldbank: 'Banco Mundial', ucdp: 'UCDP', reliefweb: 'ReliefWeb', gdacs: 'GDACS', vdem: 'V-Dem v16' },
    worldBankLagNote: 'Último valor divulgado pelo Banco Mundial. Os dados saem com atraso e podem ter vários anos: confira o ano.',
  },
  zh: {
    units: {
      per100k: '每10万人',
      deaths: '冲突死亡人数',
      gpi: 'GPI 1–5分制，越低越好',
      inform: 'INFORM 风险，越高越差',
      vdemUp: '0–1分制，越高越好',
      vdemDown: '0–1分制，越低越好',
      vdemLatent: '约−4至+4分，越高越好',
      disasters: '进行中的灾害数',
      alerts: '橙色或红色警报数',
    },
    topics: {
      wb_homicide: '暴力犯罪',
      gpi_safety_security: '社会治安欠佳',
      gpi_overall: '暴力与动荡局势',
      gpi_militarisation: '军事化',
      ucdp_conflict_deaths: '武装冲突',
      inform_health_access: '就医不便',
      inform_epidemic: '流行病',
      inform_governance: '制度薄弱',
      vdem_rule_of_law: '法治薄弱',
      vdem_corruption_control: '腐败',
      vdem_gov_effectiveness: '公共行政缺乏公正',
      inform_natural: '地震、洪水和风暴等灾害',
      reliefweb_active_disasters: '正在发生的自然灾害',
      gdacs_disaster_alerts: '近期自然灾害',
    },
    facts: {
      wb_homicide: '每10万人中有{v}起故意杀人案（世界银行，{y}年）',
      gpi_safety_security: '{y}年全球和平指数对其安全与治安的评分为{v}（1–5分，1分最安全，5分最不安全）',
      gpi_overall: '{y}年全球和平指数对该国的评分为{v}（1–5分，1分最和平，5分最不和平）',
      gpi_militarisation: '{y}年全球和平指数对其军事化程度的评分为{v}（1–5分，1分最低，5分最高）',
      ucdp_conflict_deaths: '{y}年造成{v}人死亡（UCDP）',
      inform_health_access: 'INFORM风险评分为{v}/10，10分表示就医条件最差（INFORM Risk {y}）',
      inform_epidemic: 'INFORM风险评分为{v}/10，10分表示风险最高（INFORM Risk {y}）',
      inform_governance: 'INFORM风险评分为{v}/10，10分最差（INFORM Risk {y}）',
      inform_natural: 'INFORM风险评分为{v}/10，10分表示暴露程度最高（INFORM Risk {y}）',
      vdem_rule_of_law: 'V-Dem对法治的评分为{v}（0–1分，1分最好；V-Dem，{y}年数据）',
      vdem_corruption_control: 'V-Dem对政治腐败的评分为{v}（0–1分，1分最腐败；V-Dem，{y}年数据）',
      vdem_gov_effectiveness: 'V-Dem对公共行政公正性的评分为{v}（约−4至+4分，越高越好；V-Dem，{y}年数据）',
      reliefweb_active_disasters: 'ReliefWeb记录了{v}起正在发生的灾害（{y}年）',
      gdacs_disaster_alerts: 'GDACS在{y}年发布了{v}次橙色或红色灾害警报',
    },
    sourceNames: { worldbank: '世界银行', ucdp: 'UCDP', reliefweb: 'ReliefWeb', gdacs: 'GDACS', vdem: 'V-Dem v16' },
    worldBankLagNote: '世界银行最新公布的数值。其数据发布滞后，可能已是数年前的数据，请留意年份。',
  },
  de: {
    units: {
      per100k: 'je 100.000 Einwohner',
      deaths: ['Konflikttoter', 'Konflikttote'],
      gpi: 'GPI-Skala 1–5, niedriger ist besser',
      inform: 'INFORM-Risiko, höher ist schlechter',
      vdemUp: 'Skala 0–1, höher ist besser',
      vdemDown: 'Skala 0–1, niedriger ist besser',
      vdemLatent: 'Skala etwa −4 bis +4, höher ist besser',
      disasters: ['laufende Katastrophe', 'laufende Katastrophen'],
      alerts: ['orangefarbene oder rote Warnung', 'orangefarbene oder rote Warnungen'],
    },
    topics: {
      wb_homicide: 'die Gewaltkriminalität',
      gpi_safety_security: 'die mangelnde öffentliche Sicherheit',
      gpi_overall: 'die allgemein schlechte Sicherheitslage',
      gpi_militarisation: 'die Militarisierung',
      ucdp_conflict_deaths: 'der bewaffnete Konflikt',
      inform_health_access: 'der eingeschränkte Zugang zur Gesundheitsversorgung',
      inform_epidemic: 'das Epidemierisiko',
      inform_governance: 'die Schwäche der Institutionen',
      vdem_rule_of_law: 'die schwache Rechtsstaatlichkeit',
      vdem_corruption_control: 'die Korruption',
      vdem_gov_effectiveness: 'eine wenig unparteiische Verwaltung',
      inform_natural: 'die Gefährdung durch Erdbeben, Überschwemmungen und Stürme',
      reliefweb_active_disasters: 'die Häufung laufender Naturkatastrophen',
      gdacs_disaster_alerts: 'die Häufung schwerer Naturereignisse',
    },
    facts: {
      wb_homicide: '{v} Tötungsdelikte je 100.000 Einwohner (Weltbank, {y})',
      gpi_safety_security: 'Der Global Peace Index {y} bewertet Sicherheit und Schutz mit {v} auf einer Skala von 1 (am sichersten) bis 5 (am unsichersten)',
      gpi_overall: 'Der Global Peace Index {y} bewertet das Land mit {v} auf einer Skala von 1 (am friedlichsten) bis 5 (am wenigsten friedlich)',
      gpi_militarisation: 'Der Global Peace Index {y} bewertet die Militarisierung mit {v} auf einer Skala von 1 (am geringsten) bis 5 (am stärksten)',
      ucdp_conflict_deaths: ['{v} Todesopfer im Jahr {y} (UCDP)', '{v} Todesopfer im Jahr {y} (UCDP)'],
      inform_health_access: '{v} von 10 auf der INFORM-Risikoskala, wobei 10 den schlechtesten Zugang bedeutet (INFORM Risk {y})',
      inform_epidemic: '{v} von 10 auf der INFORM-Risikoskala, wobei 10 das höchste Risiko bedeutet (INFORM Risk {y})',
      inform_governance: '{v} von 10 auf der INFORM-Risikoskala, wobei 10 am schlechtesten ist (INFORM Risk {y})',
      inform_natural: '{v} von 10 auf der INFORM-Risikoskala, wobei 10 die höchste Gefährdung bedeutet (INFORM Risk {y})',
      vdem_rule_of_law: 'V-Dem bewertet die Rechtsstaatlichkeit mit {v} auf einer Skala von 0 bis 1, wobei 1 am besten ist (V-Dem, Daten von {y})',
      vdem_corruption_control: 'V-Dem bewertet die politische Korruption mit {v} auf einer Skala von 0 bis 1, wobei 1 die stärkste ist (V-Dem, Daten von {y})',
      vdem_gov_effectiveness: 'V-Dem bewertet die Unparteilichkeit der öffentlichen Verwaltung mit {v} auf einer Skala von etwa −4 bis +4, wobei höher besser ist (V-Dem, Daten von {y})',
      reliefweb_active_disasters: ['ReliefWeb verzeichnet {v} laufende Katastrophe ({y})', 'ReliefWeb verzeichnet {v} laufende Katastrophen ({y})'],
      gdacs_disaster_alerts: ['GDACS hat {y} {v} orangefarbene oder rote Warnung ausgegeben', 'GDACS hat {y} {v} orangefarbene oder rote Warnungen ausgegeben'],
    },
    sourceNames: { worldbank: 'Weltbank', ucdp: 'UCDP', reliefweb: 'ReliefWeb', gdacs: 'GDACS', vdem: 'V-Dem v16' },
    worldBankLagNote: 'Zuletzt von der Weltbank veröffentlichter Wert. Ihre Daten erscheinen verzögert und können mehrere Jahre alt sein: Achten Sie auf das Jahr.',
  },
};
