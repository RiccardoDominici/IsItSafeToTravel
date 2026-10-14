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
 *    count-based facts pick a singular/plural form from the raw count.
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
      gpi_overall: 'a climate of violence and insecurity',
      gpi_militarisation: 'militarisation',
      ucdp_conflict_deaths: 'armed conflict',
      inform_health_access: 'poor access to health care',
      inform_epidemic: 'the spread of epidemics',
      inform_governance: 'weak governance',
      vdem_rule_of_law: 'weak rule of law',
      vdem_corruption_control: 'corruption',
      vdem_gov_effectiveness: 'weak public administration',
      inform_natural: 'exposure to natural hazards',
      reliefweb_active_disasters: 'ongoing natural disasters',
      gdacs_disaster_alerts: 'ongoing natural disasters',
    },
    facts: {
      wb_homicide: '{v} homicides per 100,000 people (World Bank, {y})',
      gpi_safety_security: 'the Global Peace Index rates safety and security at {v} on a scale from 1 (safest) to 5 (GPI {y})',
      gpi_overall: 'the Global Peace Index scores the country {v} on a scale from 1 (most peaceful) to 5 (GPI {y})',
      gpi_militarisation: 'the Global Peace Index rates militarisation at {v} on a scale from 1 (lowest) to 5 (GPI {y})',
      ucdp_conflict_deaths: ['{v} person was killed in armed conflict in {y} (UCDP)', '{v} people were killed in armed conflict in {y} (UCDP)'],
      inform_health_access: 'INFORM rates the lack of access to health care at {v} out of 10, where 10 is the worst (INFORM Risk {y})',
      inform_epidemic: 'INFORM rates the risk of epidemics at {v} out of 10, where 10 is the highest (INFORM Risk {y})',
      inform_governance: 'INFORM rates governance weakness at {v} out of 10, where 10 is the weakest (INFORM Risk {y})',
      inform_natural: 'INFORM rates exposure to natural hazards at {v} out of 10, where 10 is the highest (INFORM Risk {y})',
      vdem_rule_of_law: 'V-Dem rates the rule of law at {v} on a scale from 0 to 1, where 1 is the strongest (V-Dem, {y} data)',
      vdem_corruption_control: 'V-Dem rates political corruption at {v} on a scale from 0 to 1, where 1 is the most corrupt (V-Dem, {y} data)',
      vdem_gov_effectiveness: 'V-Dem rates the impartiality of public administration at {v} on a scale of about −4 to +4, where higher is better (V-Dem, {y} data)',
      reliefweb_active_disasters: ['ReliefWeb lists {v} ongoing disaster ({y})', 'ReliefWeb lists {v} ongoing disasters ({y})'],
      gdacs_disaster_alerts: ['GDACS lists {v} orange or red disaster alert ({y})', 'GDACS lists {v} orange or red disaster alerts ({y})'],
    },
    sourceNames: { worldbank: 'World Bank', ucdp: 'UCDP', reliefweb: 'ReliefWeb', gdacs: 'GDACS', vdem: 'V-Dem v16' },
    worldBankLagNote: 'Latest published value: the World Bank publishes with a 1–2 year lag.',
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
      inform_epidemic: 'la diffusione di epidemie',
      inform_governance: 'la debolezza della governance',
      vdem_rule_of_law: 'la debolezza dello stato di diritto',
      vdem_corruption_control: 'la corruzione',
      vdem_gov_effectiveness: 'una pubblica amministrazione poco imparziale',
      inform_natural: "l'esposizione ai rischi naturali",
      reliefweb_active_disasters: "l'impatto dei disastri naturali in corso",
      gdacs_disaster_alerts: "l'impatto dei disastri naturali in corso",
    },
    facts: {
      wb_homicide: '{v} omicidi ogni 100.000 abitanti (Banca Mondiale, {y})',
      gpi_safety_security: 'il Global Peace Index valuta sicurezza e protezione {v} su una scala da 1 (massima sicurezza) a 5 (GPI {y})',
      gpi_overall: 'il Global Peace Index assegna al paese {v} su una scala da 1 (massima pace) a 5 (GPI {y})',
      gpi_militarisation: 'il Global Peace Index valuta la militarizzazione {v} su una scala da 1 (minima) a 5 (GPI {y})',
      ucdp_conflict_deaths: ['{v} persona uccisa in conflitti armati nel {y} (UCDP)', '{v} persone uccise in conflitti armati nel {y} (UCDP)'],
      inform_health_access: "INFORM valuta la carenza di accesso alle cure {v} su 10, dove 10 è il valore peggiore (INFORM Risk {y})",
      inform_epidemic: 'INFORM valuta il rischio di epidemie {v} su 10, dove 10 è il rischio più alto (INFORM Risk {y})',
      inform_governance: 'INFORM valuta la debolezza della governance {v} su 10, dove 10 è il valore peggiore (INFORM Risk {y})',
      inform_natural: "INFORM valuta l'esposizione ai rischi naturali {v} su 10, dove 10 è il valore più alto (INFORM Risk {y})",
      vdem_rule_of_law: 'V-Dem valuta lo stato di diritto {v} su una scala da 0 a 1, dove 1 è il valore migliore (V-Dem, dati {y})',
      vdem_corruption_control: 'V-Dem valuta la corruzione politica {v} su una scala da 0 a 1, dove 1 indica la corruzione più alta (V-Dem, dati {y})',
      vdem_gov_effectiveness: "V-Dem valuta l'imparzialità della pubblica amministrazione {v} su una scala da circa −4 a +4, dove più alto è meglio (V-Dem, dati {y})",
      reliefweb_active_disasters: ['ReliefWeb segnala {v} disastro in corso ({y})', 'ReliefWeb segnala {v} disastri in corso ({y})'],
      gdacs_disaster_alerts: ['GDACS segnala {v} allerta arancione o rossa ({y})', 'GDACS segnala {v} allerte arancioni o rosse ({y})'],
    },
    sourceNames: { worldbank: 'Banca Mondiale', ucdp: 'UCDP', reliefweb: 'ReliefWeb', gdacs: 'GDACS', vdem: 'V-Dem v16' },
    worldBankLagNote: 'Ultimo valore pubblicato: la Banca Mondiale pubblica i dati con 1–2 anni di ritardo.',
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
      inform_epidemic: 'la propagación de epidemias',
      inform_governance: 'la debilidad de la gobernanza',
      vdem_rule_of_law: 'la debilidad del Estado de derecho',
      vdem_corruption_control: 'la corrupción',
      vdem_gov_effectiveness: 'una administración pública poco imparcial',
      inform_natural: 'la exposición a peligros naturales',
      reliefweb_active_disasters: 'el impacto de desastres naturales en curso',
      gdacs_disaster_alerts: 'el impacto de desastres naturales en curso',
    },
    facts: {
      wb_homicide: '{v} homicidios por cada 100.000 habitantes (Banco Mundial, {y})',
      gpi_safety_security: 'el Global Peace Index puntúa la seguridad y protección con {v} en una escala de 1 (máxima seguridad) a 5 (GPI {y})',
      gpi_overall: 'el Global Peace Index da al país un {v} en una escala de 1 (máxima paz) a 5 (GPI {y})',
      gpi_militarisation: 'el Global Peace Index puntúa la militarización con {v} en una escala de 1 (mínima) a 5 (GPI {y})',
      ucdp_conflict_deaths: ['{v} persona murió en conflictos armados en {y} (UCDP)', '{v} personas murieron en conflictos armados en {y} (UCDP)'],
      inform_health_access: 'INFORM puntúa la falta de acceso a la atención sanitaria con {v} sobre 10, donde 10 es lo peor (INFORM Risk {y})',
      inform_epidemic: 'INFORM puntúa el riesgo de epidemias con {v} sobre 10, donde 10 es el máximo (INFORM Risk {y})',
      inform_governance: 'INFORM puntúa la debilidad de la gobernanza con {v} sobre 10, donde 10 es lo peor (INFORM Risk {y})',
      inform_natural: 'INFORM puntúa la exposición a peligros naturales con {v} sobre 10, donde 10 es el máximo (INFORM Risk {y})',
      vdem_rule_of_law: 'V-Dem puntúa el Estado de derecho con {v} en una escala de 0 a 1, donde 1 es lo mejor (V-Dem, datos de {y})',
      vdem_corruption_control: 'V-Dem puntúa la corrupción política con {v} en una escala de 0 a 1, donde 1 es la máxima corrupción (V-Dem, datos de {y})',
      vdem_gov_effectiveness: 'V-Dem puntúa la imparcialidad de la administración pública con {v} en una escala de −4 a +4 aprox., donde más alto es mejor (V-Dem, datos de {y})',
      reliefweb_active_disasters: ['ReliefWeb registra {v} desastre activo ({y})', 'ReliefWeb registra {v} desastres activos ({y})'],
      gdacs_disaster_alerts: ['GDACS registra {v} alerta naranja o roja ({y})', 'GDACS registra {v} alertas naranjas o rojas ({y})'],
    },
    sourceNames: { worldbank: 'Banco Mundial', ucdp: 'UCDP', reliefweb: 'ReliefWeb', gdacs: 'GDACS', vdem: 'V-Dem v16' },
    worldBankLagNote: 'Último valor publicado: el Banco Mundial publica los datos con 1 o 2 años de retraso.',
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
      inform_epidemic: 'la propagation d’épidémies',
      inform_governance: 'la faiblesse de la gouvernance',
      vdem_rule_of_law: 'la faiblesse de l’État de droit',
      vdem_corruption_control: 'la corruption',
      vdem_gov_effectiveness: 'une administration publique peu impartiale',
      inform_natural: 'l’exposition aux risques naturels',
      reliefweb_active_disasters: 'l’impact des catastrophes naturelles en cours',
      gdacs_disaster_alerts: 'l’impact des catastrophes naturelles en cours',
    },
    facts: {
      wb_homicide: '{v} homicides pour 100 000 habitants (Banque mondiale, {y})',
      gpi_safety_security: 'le Global Peace Index note la sûreté et la sécurité {v} sur une échelle de 1 (la plus sûre) à 5 (GPI {y})',
      gpi_overall: 'le Global Peace Index attribue au pays la note de {v} sur une échelle de 1 (le plus pacifique) à 5 (GPI {y})',
      gpi_militarisation: 'le Global Peace Index note la militarisation {v} sur une échelle de 1 (la plus faible) à 5 (GPI {y})',
      ucdp_conflict_deaths: ['{v} personne a été tuée dans des conflits armés en {y} (UCDP)', '{v} personnes ont été tuées dans des conflits armés en {y} (UCDP)'],
      inform_health_access: 'INFORM note le manque d’accès aux soins {v} sur 10, 10 étant le pire (INFORM Risk {y})',
      inform_epidemic: 'INFORM note le risque d’épidémie {v} sur 10, 10 étant le plus élevé (INFORM Risk {y})',
      inform_governance: 'INFORM note la faiblesse de la gouvernance {v} sur 10, 10 étant le pire (INFORM Risk {y})',
      inform_natural: 'INFORM note l’exposition aux risques naturels {v} sur 10, 10 étant la plus forte (INFORM Risk {y})',
      vdem_rule_of_law: 'V-Dem note l’État de droit {v} sur une échelle de 0 à 1, 1 étant le meilleur (V-Dem, données {y})',
      vdem_corruption_control: 'V-Dem note la corruption politique {v} sur une échelle de 0 à 1, 1 étant la plus forte (V-Dem, données {y})',
      vdem_gov_effectiveness: 'V-Dem note l’impartialité de l’administration publique {v} sur une échelle d’environ −4 à +4, plus haut étant mieux (V-Dem, données {y})',
      reliefweb_active_disasters: ['ReliefWeb recense {v} catastrophe en cours ({y})', 'ReliefWeb recense {v} catastrophes en cours ({y})'],
      gdacs_disaster_alerts: ['GDACS signale {v} alerte orange ou rouge ({y})', 'GDACS signale {v} alertes orange ou rouges ({y})'],
    },
    sourceNames: { worldbank: 'Banque mondiale', ucdp: 'UCDP', reliefweb: 'ReliefWeb', gdacs: 'GDACS', vdem: 'V-Dem v16' },
    worldBankLagNote: 'Dernière valeur publiée : la Banque mondiale publie ses données avec 1 à 2 ans de décalage.',
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
      inform_epidemic: 'a propagação de epidemias',
      inform_governance: 'a fragilidade da governança',
      vdem_rule_of_law: 'a fragilidade do Estado de direito',
      vdem_corruption_control: 'a corrupção',
      vdem_gov_effectiveness: 'uma administração pública pouco imparcial',
      inform_natural: 'a exposição a riscos naturais',
      reliefweb_active_disasters: 'o impacto de desastres naturais em andamento',
      gdacs_disaster_alerts: 'o impacto de desastres naturais em andamento',
    },
    facts: {
      wb_homicide: '{v} homicídios por 100 mil habitantes (Banco Mundial, {y})',
      gpi_safety_security: 'o Global Peace Index avalia a segurança e proteção em {v} em uma escala de 1 (mais seguro) a 5 (GPI {y})',
      gpi_overall: 'o Global Peace Index dá ao país {v} em uma escala de 1 (mais pacífico) a 5 (GPI {y})',
      gpi_militarisation: 'o Global Peace Index avalia a militarização em {v} em uma escala de 1 (menor) a 5 (GPI {y})',
      ucdp_conflict_deaths: ['{v} pessoa morreu em conflitos armados em {y} (UCDP)', '{v} pessoas morreram em conflitos armados em {y} (UCDP)'],
      inform_health_access: 'o INFORM avalia a falta de acesso a cuidados de saúde em {v} de 10, sendo 10 o pior (INFORM Risk {y})',
      inform_epidemic: 'o INFORM avalia o risco de epidemias em {v} de 10, sendo 10 o mais alto (INFORM Risk {y})',
      inform_governance: 'o INFORM avalia a fragilidade da governança em {v} de 10, sendo 10 o pior (INFORM Risk {y})',
      inform_natural: 'o INFORM avalia a exposição a riscos naturais em {v} de 10, sendo 10 a mais alta (INFORM Risk {y})',
      vdem_rule_of_law: 'o V-Dem avalia o Estado de direito em {v} em uma escala de 0 a 1, sendo 1 o melhor (V-Dem, dados de {y})',
      vdem_corruption_control: 'o V-Dem avalia a corrupção política em {v} em uma escala de 0 a 1, sendo 1 a mais alta (V-Dem, dados de {y})',
      vdem_gov_effectiveness: 'o V-Dem avalia a imparcialidade da administração pública em {v} em uma escala de cerca de −4 a +4, quanto maior, melhor (V-Dem, dados de {y})',
      reliefweb_active_disasters: ['o ReliefWeb registra {v} desastre em andamento ({y})', 'o ReliefWeb registra {v} desastres em andamento ({y})'],
      gdacs_disaster_alerts: ['o GDACS registra {v} alerta laranja ou vermelho ({y})', 'o GDACS registra {v} alertas laranja ou vermelhos ({y})'],
    },
    sourceNames: { worldbank: 'Banco Mundial', ucdp: 'UCDP', reliefweb: 'ReliefWeb', gdacs: 'GDACS', vdem: 'V-Dem v16' },
    worldBankLagNote: 'Último valor publicado: o Banco Mundial divulga os dados com 1 a 2 anos de atraso.',
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
      gpi_overall: '暴力与不安全',
      gpi_militarisation: '军事化',
      ucdp_conflict_deaths: '武装冲突',
      inform_health_access: '就医不便',
      inform_epidemic: '流行病传播',
      inform_governance: '治理薄弱',
      vdem_rule_of_law: '法治薄弱',
      vdem_corruption_control: '腐败',
      vdem_gov_effectiveness: '公共行政缺乏公正',
      inform_natural: '自然灾害风险',
      reliefweb_active_disasters: '正在发生的自然灾害',
      gdacs_disaster_alerts: '正在发生的自然灾害',
    },
    facts: {
      wb_homicide: '每10万人中有{v}起故意杀人案（世界银行，{y}年）',
      gpi_safety_security: '全球和平指数对其安全与治安的评分为{v}（1–5分，1分最安全；GPI {y}）',
      gpi_overall: '全球和平指数对该国的评分为{v}（1–5分，1分最和平；GPI {y}）',
      gpi_militarisation: '全球和平指数对其军事化程度的评分为{v}（1–5分，1分最低；GPI {y}）',
      ucdp_conflict_deaths: '{y}年有{v}人死于武装冲突（UCDP）',
      inform_health_access: 'INFORM对医疗服务可及性不足的评分为{v}/10，10分最差（INFORM Risk {y}）',
      inform_epidemic: 'INFORM对流行病风险的评分为{v}/10，10分最高（INFORM Risk {y}）',
      inform_governance: 'INFORM对治理薄弱程度的评分为{v}/10，10分最差（INFORM Risk {y}）',
      inform_natural: 'INFORM对自然灾害暴露程度的评分为{v}/10，10分最高（INFORM Risk {y}）',
      vdem_rule_of_law: 'V-Dem对法治的评分为{v}（0–1分，1分最好；V-Dem，{y}年数据）',
      vdem_corruption_control: 'V-Dem对政治腐败的评分为{v}（0–1分，1分最腐败；V-Dem，{y}年数据）',
      vdem_gov_effectiveness: 'V-Dem对公共行政公正性的评分为{v}（约−4至+4分，越高越好；V-Dem，{y}年数据）',
      reliefweb_active_disasters: 'ReliefWeb记录了{v}起正在发生的灾害（{y}年）',
      gdacs_disaster_alerts: 'GDACS发布了{v}条橙色或红色灾害警报（{y}年）',
    },
    sourceNames: { worldbank: '世界银行', ucdp: 'UCDP', reliefweb: 'ReliefWeb', gdacs: 'GDACS', vdem: 'V-Dem v16' },
    worldBankLagNote: '最新公布值：世界银行的数据发布通常滞后1–2年。',
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
      gpi_overall: 'ein Klima von Gewalt und Unsicherheit',
      gpi_militarisation: 'die Militarisierung',
      ucdp_conflict_deaths: 'der bewaffnete Konflikt',
      inform_health_access: 'der eingeschränkte Zugang zur Gesundheitsversorgung',
      inform_epidemic: 'die Ausbreitung von Epidemien',
      inform_governance: 'die schwache Regierungsführung',
      vdem_rule_of_law: 'die schwache Rechtsstaatlichkeit',
      vdem_corruption_control: 'die Korruption',
      vdem_gov_effectiveness: 'eine wenig unparteiische Verwaltung',
      inform_natural: 'die Gefährdung durch Naturgefahren',
      reliefweb_active_disasters: 'die Häufung laufender Naturkatastrophen',
      gdacs_disaster_alerts: 'die Häufung laufender Naturkatastrophen',
    },
    facts: {
      wb_homicide: '{v} Tötungsdelikte je 100.000 Einwohner (Weltbank, {y})',
      gpi_safety_security: 'Der Global Peace Index bewertet Sicherheit und Schutz mit {v} auf einer Skala von 1 (am sichersten) bis 5 (GPI {y})',
      gpi_overall: 'Der Global Peace Index bewertet das Land mit {v} auf einer Skala von 1 (am friedlichsten) bis 5 (GPI {y})',
      gpi_militarisation: 'Der Global Peace Index bewertet die Militarisierung mit {v} auf einer Skala von 1 (am geringsten) bis 5 (GPI {y})',
      ucdp_conflict_deaths: ['{y} wurde {v} Mensch in bewaffneten Konflikten getötet (UCDP)', '{y} wurden {v} Menschen in bewaffneten Konflikten getötet (UCDP)'],
      inform_health_access: 'INFORM bewertet den mangelnden Zugang zur Gesundheitsversorgung mit {v} von 10, wobei 10 am schlechtesten ist (INFORM Risk {y})',
      inform_epidemic: 'INFORM bewertet das Epidemierisiko mit {v} von 10, wobei 10 das höchste ist (INFORM Risk {y})',
      inform_governance: 'INFORM bewertet die Schwäche der Regierungsführung mit {v} von 10, wobei 10 am schlechtesten ist (INFORM Risk {y})',
      inform_natural: 'INFORM bewertet die Gefährdung durch Naturgefahren mit {v} von 10, wobei 10 die höchste ist (INFORM Risk {y})',
      vdem_rule_of_law: 'V-Dem bewertet die Rechtsstaatlichkeit mit {v} auf einer Skala von 0 bis 1, wobei 1 am besten ist (V-Dem, Daten von {y})',
      vdem_corruption_control: 'V-Dem bewertet die politische Korruption mit {v} auf einer Skala von 0 bis 1, wobei 1 die stärkste ist (V-Dem, Daten von {y})',
      vdem_gov_effectiveness: 'V-Dem bewertet die Unparteilichkeit der öffentlichen Verwaltung mit {v} auf einer Skala von etwa −4 bis +4, wobei höher besser ist (V-Dem, Daten von {y})',
      reliefweb_active_disasters: ['ReliefWeb verzeichnet {v} laufende Katastrophe ({y})', 'ReliefWeb verzeichnet {v} laufende Katastrophen ({y})'],
      gdacs_disaster_alerts: ['GDACS meldet {v} orangefarbene oder rote Warnung ({y})', 'GDACS meldet {v} orangefarbene oder rote Warnungen ({y})'],
    },
    sourceNames: { worldbank: 'Weltbank', ucdp: 'UCDP', reliefweb: 'ReliefWeb', gdacs: 'GDACS', vdem: 'V-Dem v16' },
    worldBankLagNote: 'Zuletzt veröffentlichter Wert: Die Weltbank veröffentlicht mit 1–2 Jahren Verzögerung.',
  },
};
