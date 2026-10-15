/**
 * Methodology copy for formula v10 (SPEC §7 "Methodology ×7"), all 7 locales, rendered by
 * src/components/pages/MethodologyV10.astro on every methodology page:
 *  - the indicator table (pillar, indicator, source with edition, licence),
 *  - the rules that decide what counts (latest edition only, 5-year maximum age, per-pillar
 *    scale continuity, the grey "partial data" rule with its danger guard, the community rule,
 *    the honest update cadence),
 *  - the dated changelog entry for v10 (2026-10-15).
 *
 * WHY a module instead of ui.ts keys: the rules are lists of (title, text) pairs and the changelog
 * a list of items; ui.ts holds flat strings only and is a merge hot spot. Same precedent as
 * about-copy.ts and community-copy.ts.
 *
 * Numbers: the four-source floor is spelled out in words ("four", "quattro"...): validate-seo
 * reads "<number> sources" as a site-wide source-count claim. Sentence case in it/es/fr/pt/de,
 * German nouns capitalised, French non-breaking space before : ; ? !.
 */
import type { Lang } from './ui';

/** Release date of formula v10 (changelog). */
export const FORMULA_V10_RELEASE_DATE = '2026-10-15';

export interface MethodologyRule {
  /** Anchor id ("grey-rule" is linked from the grey hero of every partial-data page). */
  id: string;
  title: string;
  text: string;
}

export interface MethodologyV10Copy {
  indicatorsTitle: string;
  indicatorsIntro: string;
  table: { pillar: string; indicator: string; source: string; licence: string };
  rulesTitle: string;
  rules: MethodologyRule[];
  changelogTitle: string;
  /** {date} = the localized release date. */
  changelogEntryTitle: string;
  changelogItems: string[];
  /** Source cells of the indicator table. {edition} is filled from the data where known. */
  sources: {
    gpi: string;
    advisories: string;
    ucdp: string;
    worldbank: string;
    inform: string;
    vdem: string;
    reliefweb: string;
    gdacs: string;
  };
  licences: {
    iep: string;
    government: string;
    ccBy: string;
    ccBySa: string;
    reliefweb: string;
    gdacs: string;
  };
}

const NBSP = ' ';

export const methodologyV10Copy: Record<Lang, MethodologyV10Copy> = {
  en: {
    indicatorsTitle: 'Formula v10: indicators, sources and editions',
    indicatorsIntro:
      'Each pillar combines the indicators below. We always use the latest edition of each source, and every country page shows each indicator with its own value, unit and data year.',
    table: { pillar: 'Pillar', indicator: 'Indicator', source: 'Source and edition', licence: 'Licence' },
    rulesTitle: 'Rules that decide what counts',
    rules: [
      { id: 'latest-edition', title: 'Latest edition only', text: 'When a source publishes a new edition, the previous one weighs zero: editions are never blended, and old values are never faded in.' },
      { id: 'max-age', title: 'Five-year maximum age', text: 'An indicator whose data year is more than five years before the current year counts as missing, so it can neither raise nor lower a score. Government advisories are current by definition; population figures, used only to judge how reliable a homicide rate is, are exempt.' },
      { id: 'scale-continuity', title: 'Scale continuity', text: "Changing the indicators inside a pillar changes the spread of its values, and with it the pillar's real weight. The health, governance and natural-hazards pillars are therefore mapped back onto their previous scale with a fixed linear map, computed once on 14 October 2026 and never refitted." },
      { id: 'grey-rule', title: 'Partial data: no score below four sources', text: 'A place covered by fewer than four independent sources gets no official score. Its page says “Partial data”, lists the sources we do have and asks travellers who have been there how safe they felt. Danger always overrides this: a place is scored when at least three governments advise against all travel, when do-not-travel advisories dominate, or when the Uppsala Conflict Data Program recorded conflict deaths there in the latest year.' },
      { id: 'community-rule', title: 'Community votes', text: "Travellers' votes count once a country has at least 30 votes from at least three countries of origin in the last 180 days, and no single country of origin may carry more than half of the weight. The adjustment is the gap between the community rating and the data score, scaled down when there are few effective votes, and capped at ±1.0 points." },
      { id: 'update-cadence', title: 'How often things change', text: 'The score is recalculated every day. Government advisories and disaster alerts change daily; the international indices (Global Peace Index, INFORM, V-Dem, World Bank, UCDP) are published once or twice a year, so most pillar values stay the same between two editions.' },
    ],
    changelogTitle: 'Changelog',
    changelogEntryTitle: '{date}: formula v10',
    changelogItems: [
      'Removed indicators a traveller cannot act on: child mortality, PM2.5 air pollution, and a flood-risk column that was labelled as climate risk. The health pillar now reads INFORM’s access to health care instead of a column that actually measured conflict hazard.',
      'INFORM is read from its newest edition (INFORM Risk 2026) with exact column names; the governance indicator now reads INFORM’s Governance column instead of the Institutional one.',
      'Latest edition only and a five-year maximum age: stale values, such as homicide rates from before 2021, now count as missing instead of being shown as current.',
      'Places with fewer than four independent sources no longer get a score built from regional estimates: they are shown as partial data.',
      'Community votes can move a score by up to one point, under the rules above.',
      'Pillar weights and the conflict and crime pillars are unchanged; the environment pillar is now called natural hazards. Scores published before this date used formula v9.1, and trend charts mark the switch.',
    ],
    sources: {
      gpi: 'Global Peace Index {edition} (Institute for Economics & Peace)',
      advisories: 'Government travel advisories (checked daily)',
      ucdp: 'UCDP Georeferenced Event Dataset via Our World in Data (latest year: {edition})',
      worldbank: 'World Bank, World Development Indicators (latest published year varies by country)',
      inform: '{edition}, European Commission JRC',
      vdem: 'V-Dem Country-Year Dataset v16 (data year {edition})',
      reliefweb: 'ReliefWeb (UN OCHA), live',
      gdacs: 'GDACS (UN and European Commission), live',
    },
    licences: {
      iep: 'IEP non-commercial licence',
      government: 'Public government information',
      ccBy: 'CC BY 4.0',
      ccBySa: 'CC BY-SA 4.0',
      reliefweb: 'ReliefWeb terms of use',
      gdacs: 'GDACS terms of use',
    },
  },
  it: {
    indicatorsTitle: 'Formula v10: indicatori, fonti ed edizioni',
    indicatorsIntro:
      'Ogni pilastro combina gli indicatori qui sotto. Usiamo sempre l’edizione più recente di ogni fonte, e ogni pagina paese mostra ciascun indicatore con il suo valore, la sua unità e il suo anno di riferimento.',
    table: { pillar: 'Pilastro', indicator: 'Indicatore', source: 'Fonte ed edizione', licence: 'Licenza' },
    rulesTitle: 'Le regole che decidono cosa conta',
    rules: [
      { id: 'latest-edition', title: 'Solo l’edizione più recente', text: 'Quando una fonte pubblica una nuova edizione, quella precedente pesa zero: le edizioni non vengono mai mescolate e i valori vecchi non vengono sfumati nel tempo.' },
      { id: 'max-age', title: 'Età massima di cinque anni', text: 'Un indicatore il cui anno di riferimento è di oltre cinque anni prima dell’anno in corso conta come dato mancante: non può né alzare né abbassare un punteggio. Gli avvisi governativi sono attuali per definizione; i dati sulla popolazione, usati solo per stimare quanto sia affidabile un tasso di omicidi, sono esclusi dalla regola.' },
      { id: 'scale-continuity', title: 'Continuità di scala', text: 'Cambiare gli indicatori di un pilastro cambia la dispersione dei suoi valori, e con essa il peso reale del pilastro. Per questo i pilastri salute, governance e rischi naturali vengono riportati sulla scala precedente con una trasformazione lineare fissa, calcolata una sola volta il 14 ottobre 2026 e mai più ricalibrata.' },
      { id: 'grey-rule', title: 'Dati parziali: niente punteggio sotto le quattro fonti', text: 'Una destinazione coperta da meno di quattro fonti indipendenti non riceve un punteggio ufficiale. La sua pagina indica «Dati parziali», elenca le fonti disponibili e chiede a chi ci è stato quanto si sentiva al sicuro. Il pericolo prevale sempre: la destinazione riceve comunque un punteggio se almeno tre governi sconsigliano qualsiasi viaggio, se prevalgono gli avvisi di non partire o se l’Uppsala Conflict Data Program ha registrato morti in conflitti armati nell’ultimo anno.' },
      { id: 'community-rule', title: 'Voti della community', text: 'I voti dei viaggiatori contano quando un paese raccoglie almeno 30 voti da almeno tre paesi di provenienza negli ultimi 180 giorni, e nessun paese di provenienza può pesare più della metà. La correzione è la differenza tra la valutazione della community e il punteggio dai dati, ridotta quando i voti effettivi sono pochi, con un limite di ±1,0 punti.' },
      { id: 'update-cadence', title: 'Ogni quanto cambiano i dati', text: 'Il punteggio viene ricalcolato ogni giorno. Gli avvisi governativi e le allerte per disastri cambiano ogni giorno; gli indici internazionali (Global Peace Index, INFORM, V-Dem, Banca Mondiale, UCDP) escono una o due volte l’anno, quindi la maggior parte dei valori dei pilastri resta uguale tra un’edizione e l’altra.' },
    ],
    changelogTitle: 'Registro delle modifiche',
    changelogEntryTitle: '{date}: formula v10',
    changelogItems: [
      'Eliminati gli indicatori su cui chi viaggia non può agire: mortalità infantile, inquinamento da PM2.5 e una colonna sul rischio di alluvioni etichettata come rischio climatico. Il pilastro salute ora usa l’accesso alle cure di INFORM al posto di una colonna che in realtà misurava il rischio di conflitto.',
      'INFORM viene letto dall’edizione più recente (INFORM Risk 2026) con i nomi esatti delle colonne; l’indicatore di governance ora legge la colonna Governance di INFORM invece di quella Institutional.',
      'Solo l’edizione più recente ed età massima di cinque anni: i valori datati, come i tassi di omicidi anteriori al 2021, ora contano come mancanti invece di essere presentati come attuali.',
      'Le destinazioni con meno di quattro fonti indipendenti non ricevono più un punteggio costruito su stime regionali: vengono mostrate come dati parziali.',
      'I voti della community possono spostare un punteggio fino a un punto, secondo le regole qui sopra.',
      'I pesi dei pilastri e i pilastri conflitto e criminalità non cambiano; il pilastro ambiente ora si chiama rischi naturali. I punteggi pubblicati prima di questa data usavano la formula v9.1, e i grafici di tendenza segnano il passaggio.',
    ],
    sources: {
      gpi: 'Global Peace Index {edition} (Institute for Economics & Peace)',
      advisories: 'Avvisi di viaggio governativi (verificati ogni giorno)',
      ucdp: 'UCDP Georeferenced Event Dataset tramite Our World in Data (ultimo anno: {edition})',
      worldbank: 'Banca Mondiale, World Development Indicators (l’ultimo anno pubblicato varia da paese a paese)',
      inform: '{edition}, Commissione europea (JRC)',
      vdem: 'V-Dem Country-Year Dataset v16 (dati {edition})',
      reliefweb: 'ReliefWeb (OCHA, Nazioni Unite), in tempo reale',
      gdacs: 'GDACS (Nazioni Unite e Commissione europea), in tempo reale',
    },
    licences: {
      iep: 'Licenza non commerciale IEP',
      government: 'Informazioni pubbliche dei governi',
      ccBy: 'CC BY 4.0',
      ccBySa: 'CC BY-SA 4.0',
      reliefweb: 'Condizioni d’uso di ReliefWeb',
      gdacs: 'Condizioni d’uso di GDACS',
    },
  },
  es: {
    indicatorsTitle: 'Fórmula v10: indicadores, fuentes y ediciones',
    indicatorsIntro:
      'Cada pilar combina los indicadores de abajo. Usamos siempre la edición más reciente de cada fuente, y cada página de país muestra cada indicador con su propio valor, su unidad y su año de referencia.',
    table: { pillar: 'Pilar', indicator: 'Indicador', source: 'Fuente y edición', licence: 'Licencia' },
    rulesTitle: 'Las reglas que deciden qué cuenta',
    rules: [
      { id: 'latest-edition', title: 'Solo la edición más reciente', text: 'Cuando una fuente publica una edición nueva, la anterior pesa cero: nunca mezclamos ediciones ni difuminamos valores antiguos con el tiempo.' },
      { id: 'max-age', title: 'Antigüedad máxima de cinco años', text: 'Un indicador cuyo año de referencia es más de cinco años anterior al año en curso cuenta como dato ausente: no puede ni subir ni bajar una puntuación. Los avisos gubernamentales están al día por definición; las cifras de población, que solo sirven para valorar la fiabilidad de una tasa de homicidios, quedan exentas.' },
      { id: 'scale-continuity', title: 'Continuidad de escala', text: 'Cambiar los indicadores de un pilar cambia la dispersión de sus valores y, con ella, el peso real del pilar. Por eso los pilares de salud, gobernanza y riesgos naturales se devuelven a su escala anterior con una transformación lineal fija, calculada una sola vez el 14 de octubre de 2026 y nunca reajustada.' },
      { id: 'grey-rule', title: 'Datos parciales: sin puntuación por debajo de cuatro fuentes', text: 'Un destino cubierto por menos de cuatro fuentes independientes no recibe puntuación oficial. Su página indica «Datos parciales», enumera las fuentes de las que sí disponemos y pregunta a quienes han estado allí hasta qué punto se sintieron seguros. El peligro siempre prevalece: el destino recibe puntuación si al menos tres gobiernos desaconsejan todo viaje, si predominan los avisos de no viajar o si el Uppsala Conflict Data Program registró muertes por conflicto armado en el último año.' },
      { id: 'community-rule', title: 'Votos de la comunidad', text: 'Los votos de los viajeros cuentan cuando un país reúne al menos 30 votos de al menos tres países de origen en los últimos 180 días, y ningún país de origen puede pesar más de la mitad. El ajuste es la diferencia entre la valoración de la comunidad y la puntuación según los datos, reducida cuando hay pocos votos efectivos, con un límite de ±1,0 punto.' },
      { id: 'update-cadence', title: 'Con qué frecuencia cambian los datos', text: 'La puntuación se recalcula cada día. Los avisos gubernamentales y las alertas de desastres cambian a diario; los índices internacionales (Global Peace Index, INFORM, V-Dem, Banco Mundial, UCDP) se publican una o dos veces al año, así que la mayoría de los valores de los pilares no cambia entre dos ediciones.' },
    ],
    changelogTitle: 'Registro de cambios',
    changelogEntryTitle: '{date}: fórmula v10',
    changelogItems: [
      'Eliminados los indicadores sobre los que un viajero no puede actuar: mortalidad infantil, contaminación por PM2.5 y una columna de riesgo de inundación etiquetada como riesgo climático. El pilar de salud usa ahora el acceso a la atención sanitaria de INFORM en lugar de una columna que en realidad medía el riesgo de conflicto.',
      'INFORM se lee de su edición más reciente (INFORM Risk 2026) con los nombres exactos de las columnas; el indicador de gobernanza lee ahora la columna Governance de INFORM en lugar de la Institutional.',
      'Solo la edición más reciente y una antigüedad máxima de cinco años: los valores desfasados, como las tasas de homicidios anteriores a 2021, cuentan ahora como ausentes en lugar de mostrarse como actuales.',
      'Los destinos con menos de cuatro fuentes independientes ya no reciben una puntuación construida con estimaciones regionales: se muestran como datos parciales.',
      'Los votos de la comunidad pueden mover una puntuación hasta un punto, según las reglas anteriores.',
      'Los pesos de los pilares y los pilares de conflicto y criminalidad no cambian; el pilar de medio ambiente pasa a llamarse riesgos naturales. Las puntuaciones publicadas antes de esta fecha usaban la fórmula v9.1, y los gráficos de tendencia marcan el cambio.',
    ],
    sources: {
      gpi: 'Global Peace Index {edition} (Institute for Economics & Peace)',
      advisories: 'Avisos de viaje gubernamentales (revisados a diario)',
      ucdp: 'UCDP Georeferenced Event Dataset a través de Our World in Data (último año: {edition})',
      worldbank: 'Banco Mundial, World Development Indicators (el último año publicado varía según el país)',
      inform: '{edition}, Comisión Europea (JRC)',
      vdem: 'V-Dem Country-Year Dataset v16 (datos de {edition})',
      reliefweb: 'ReliefWeb (OCHA, Naciones Unidas), en tiempo real',
      gdacs: 'GDACS (Naciones Unidas y Comisión Europea), en tiempo real',
    },
    licences: {
      iep: 'Licencia no comercial del IEP',
      government: 'Información pública de los gobiernos',
      ccBy: 'CC BY 4.0',
      ccBySa: 'CC BY-SA 4.0',
      reliefweb: 'Condiciones de uso de ReliefWeb',
      gdacs: 'Condiciones de uso de GDACS',
    },
  },
  fr: {
    indicatorsTitle: 'Formule v10${NBSP}: indicateurs, sources et éditions'.replace('${NBSP}', NBSP),
    indicatorsIntro:
      'Chaque pilier combine les indicateurs ci-dessous. Nous utilisons toujours l’édition la plus récente de chaque source, et chaque page pays affiche chaque indicateur avec sa propre valeur, son unité et son année de référence.',
    table: { pillar: 'Pilier', indicator: 'Indicateur', source: 'Source et édition', licence: 'Licence' },
    rulesTitle: 'Les règles qui décident de ce qui compte',
    rules: [
      { id: 'latest-edition', title: 'Seulement l’édition la plus récente', text: `Quand une source publie une nouvelle édition, la précédente pèse zéro${NBSP}: les éditions ne sont jamais mélangées et les anciennes valeurs ne sont jamais estompées progressivement.` },
      { id: 'max-age', title: 'Ancienneté maximale de cinq ans', text: `Un indicateur dont l’année de référence remonte à plus de cinq ans avant l’année en cours compte comme manquant${NBSP}: il ne peut ni relever ni abaisser un score. Les avis gouvernementaux sont à jour par définition${NBSP}; les chiffres de population, qui servent seulement à juger la fiabilité d’un taux d’homicides, sont exemptés.` },
      { id: 'scale-continuity', title: 'Continuité d’échelle', text: 'Changer les indicateurs d’un pilier change la dispersion de ses valeurs, et donc le poids réel du pilier. Les piliers santé, gouvernance et risques naturels sont donc ramenés à leur échelle précédente par une transformation linéaire fixe, calculée une seule fois le 14 octobre 2026 et jamais recalibrée.' },
      { id: 'grey-rule', title: 'Données partielles${NBSP}: pas de score sous quatre sources'.replace('${NBSP}', NBSP), text: `Une destination couverte par moins de quatre sources indépendantes ne reçoit pas de score officiel. Sa page indique «${NBSP}Données partielles${NBSP}», énumère les sources dont nous disposons et demande à ceux qui y sont allés à quel point ils s’y sont sentis en sécurité. Le danger l’emporte toujours${NBSP}: la destination reçoit un score si au moins trois gouvernements déconseillent formellement tout voyage, si les avis de ne pas voyager dominent ou si l’Uppsala Conflict Data Program y a recensé des morts liées aux conflits armés lors de la dernière année.` },
      { id: 'community-rule', title: 'Votes de la communauté', text: `Les votes des voyageurs comptent dès qu’un pays réunit au moins 30 votes venant d’au moins trois pays d’origine sur les 180 derniers jours, et aucun pays d’origine ne peut peser plus de la moitié. L’ajustement correspond à l’écart entre la note de la communauté et le score issu des données, réduit lorsque les votes effectifs sont peu nombreux, et plafonné à ±1,0${NBSP}point.` },
      { id: 'update-cadence', title: 'À quel rythme les données changent', text: `Le score est recalculé chaque jour. Les avis gouvernementaux et les alertes aux catastrophes changent chaque jour${NBSP}; les indices internationaux (Global Peace Index, INFORM, V-Dem, Banque mondiale, UCDP) paraissent une ou deux fois par an, si bien que la plupart des valeurs des piliers restent identiques d’une édition à l’autre.` },
    ],
    changelogTitle: 'Historique des modifications',
    changelogEntryTitle: `{date}${NBSP}: formule v10`,
    changelogItems: [
      'Suppression des indicateurs sur lesquels un voyageur ne peut pas agir : mortalité infantile, pollution aux PM2.5 et une colonne de risque d’inondation présentée comme risque climatique. Le pilier santé utilise désormais l’accès aux soins d’INFORM au lieu d’une colonne qui mesurait en réalité le risque de conflit.'.replace(' :', `${NBSP}:`),
      'INFORM est lu dans son édition la plus récente (INFORM Risk 2026) avec les noms exacts des colonnes ; l’indicateur de gouvernance lit désormais la colonne Governance d’INFORM au lieu de la colonne Institutional.'.replace(' ;', `${NBSP};`),
      'Seulement l’édition la plus récente et une ancienneté maximale de cinq ans : les valeurs périmées, comme les taux d’homicides antérieurs à 2021, comptent désormais comme manquantes au lieu d’être présentées comme actuelles.'.replace(' :', `${NBSP}:`),
      'Les destinations couvertes par moins de quatre sources indépendantes ne reçoivent plus de score construit à partir d’estimations régionales : elles sont présentées comme des données partielles.'.replace(' :', `${NBSP}:`),
      'Les votes de la communauté peuvent faire varier un score d’un point au maximum, selon les règles ci-dessus.',
      'Les poids des piliers et les piliers conflit et criminalité ne changent pas ; le pilier environnement s’appelle désormais risques naturels. Les scores publiés avant cette date utilisaient la formule v9.1, et les graphiques de tendance signalent le changement.'.replace(' ;', `${NBSP};`),
    ],
    sources: {
      gpi: 'Global Peace Index {edition} (Institute for Economics & Peace)',
      advisories: 'Avis gouvernementaux aux voyageurs (vérifiés chaque jour)',
      ucdp: 'UCDP Georeferenced Event Dataset via Our World in Data (dernière année${NBSP}: {edition})'.replace('${NBSP}', NBSP),
      worldbank: 'Banque mondiale, World Development Indicators (la dernière année publiée varie selon le pays)',
      inform: '{edition}, Commission européenne (JRC)',
      vdem: 'V-Dem Country-Year Dataset v16 (données {edition})',
      reliefweb: 'ReliefWeb (OCHA, Nations unies), en temps réel',
      gdacs: 'GDACS (Nations unies et Commission européenne), en temps réel',
    },
    licences: {
      iep: 'Licence non commerciale de l’IEP',
      government: 'Informations publiques des gouvernements',
      ccBy: 'CC BY 4.0',
      ccBySa: 'CC BY-SA 4.0',
      reliefweb: 'Conditions d’utilisation de ReliefWeb',
      gdacs: 'Conditions d’utilisation de GDACS',
    },
  },
  pt: {
    indicatorsTitle: 'Fórmula v10: indicadores, fontes e edições',
    indicatorsIntro:
      'Cada pilar combina os indicadores abaixo. Usamos sempre a edição mais recente de cada fonte, e cada página de país mostra cada indicador com o próprio valor, a unidade e o ano de referência.',
    table: { pillar: 'Pilar', indicator: 'Indicador', source: 'Fonte e edição', licence: 'Licença' },
    rulesTitle: 'As regras que decidem o que conta',
    rules: [
      { id: 'latest-edition', title: 'Só a edição mais recente', text: 'Quando uma fonte publica uma nova edição, a anterior passa a pesar zero: as edições nunca são misturadas e os valores antigos nunca são diluídos ao longo do tempo.' },
      { id: 'max-age', title: 'Idade máxima de cinco anos', text: 'Um indicador cujo ano de referência é mais de cinco anos anterior ao ano corrente conta como dado ausente: não pode subir nem baixar uma pontuação. Os alertas governamentais são atuais por definição; os dados de população, usados apenas para avaliar a confiabilidade de uma taxa de homicídios, ficam de fora da regra.' },
      { id: 'scale-continuity', title: 'Continuidade de escala', text: 'Trocar os indicadores de um pilar muda a dispersão dos seus valores e, com ela, o peso real do pilar. Por isso os pilares de saúde, governança e riscos naturais são trazidos de volta à escala anterior com uma transformação linear fixa, calculada uma única vez em 14 de outubro de 2026 e nunca reajustada.' },
      { id: 'grey-rule', title: 'Dados parciais: sem pontuação abaixo de quatro fontes', text: 'Um destino coberto por menos de quatro fontes independentes não recebe pontuação oficial. A página dele indica “Dados parciais”, lista as fontes que temos e pergunta a quem já esteve lá o quanto se sentiu em segurança. O perigo sempre prevalece: o destino recebe pontuação se pelo menos três governos desaconselham qualquer viagem, se predominam os alertas para não viajar ou se o Uppsala Conflict Data Program registrou mortes em conflitos armados no último ano.' },
      { id: 'community-rule', title: 'Votos da comunidade', text: 'Os votos dos viajantes passam a contar quando um país reúne pelo menos 30 votos de pelo menos três países de origem nos últimos 180 dias, e nenhum país de origem pode pesar mais da metade. O ajuste é a diferença entre a avaliação da comunidade e a pontuação dos dados, reduzida quando há poucos votos efetivos, com limite de ±1,0 ponto.' },
      { id: 'update-cadence', title: 'Com que frequência os dados mudam', text: 'A pontuação é recalculada todos os dias. Os alertas governamentais e os alertas de desastres mudam diariamente; os índices internacionais (Global Peace Index, INFORM, V-Dem, Banco Mundial, UCDP) são publicados uma ou duas vezes por ano, então a maioria dos valores dos pilares fica igual entre uma edição e outra.' },
    ],
    changelogTitle: 'Histórico de alterações',
    changelogEntryTitle: '{date}: fórmula v10',
    changelogItems: [
      'Removidos os indicadores sobre os quais o viajante não pode agir: mortalidade infantil, poluição por PM2.5 e uma coluna de risco de inundação rotulada como risco climático. O pilar de saúde agora usa o acesso a cuidados de saúde do INFORM no lugar de uma coluna que na verdade media o risco de conflito.',
      'O INFORM é lido da edição mais recente (INFORM Risk 2026) com os nomes exatos das colunas; o indicador de governança agora lê a coluna Governance do INFORM em vez da Institutional.',
      'Só a edição mais recente e idade máxima de cinco anos: valores defasados, como taxas de homicídio anteriores a 2021, agora contam como ausentes em vez de aparecerem como atuais.',
      'Destinos com menos de quatro fontes independentes não recebem mais uma pontuação construída com estimativas regionais: aparecem como dados parciais.',
      'Os votos da comunidade podem mudar uma pontuação em até um ponto, segundo as regras acima.',
      'Os pesos dos pilares e os pilares de conflito e criminalidade não mudam; o pilar meio ambiente agora se chama riscos naturais. As pontuações publicadas antes desta data usavam a fórmula v9.1, e os gráficos de tendência marcam a mudança.',
    ],
    sources: {
      gpi: 'Global Peace Index {edition} (Institute for Economics & Peace)',
      advisories: 'Alertas de viagem governamentais (verificados diariamente)',
      ucdp: 'UCDP Georeferenced Event Dataset via Our World in Data (último ano: {edition})',
      worldbank: 'Banco Mundial, World Development Indicators (o último ano publicado varia de país para país)',
      inform: '{edition}, Comissão Europeia (JRC)',
      vdem: 'V-Dem Country-Year Dataset v16 (dados de {edition})',
      reliefweb: 'ReliefWeb (OCHA, Nações Unidas), em tempo real',
      gdacs: 'GDACS (Nações Unidas e Comissão Europeia), em tempo real',
    },
    licences: {
      iep: 'Licença não comercial do IEP',
      government: 'Informação pública dos governos',
      ccBy: 'CC BY 4.0',
      ccBySa: 'CC BY-SA 4.0',
      reliefweb: 'Termos de uso do ReliefWeb',
      gdacs: 'Termos de uso do GDACS',
    },
  },
  zh: {
    indicatorsTitle: '公式 v10：指标、来源与版本',
    indicatorsIntro: '每个支柱由下表中的指标组成。我们始终使用每个来源的最新版本；在各国家页面上，每个指标都会显示其原始数值、单位和数据年份。',
    table: { pillar: '支柱', indicator: '指标', source: '来源与版本', licence: '许可' },
    rulesTitle: '决定数据是否计入的规则',
    rules: [
      { id: 'latest-edition', title: '只用最新版本', text: '某一来源发布新版本后，旧版本的权重即为零：我们从不混合不同版本，也不会让旧数值随时间逐步淡出。' },
      { id: 'max-age', title: '数据年龄上限为五年', text: '数据年份早于当年五年以上的指标视为缺失，既不会抬高也不会拉低评分。政府旅行警告本身即为最新信息；人口数据仅用于判断凶杀率的可靠程度，不受此规则限制。' },
      { id: 'scale-continuity', title: '量表连续性', text: '更换支柱内部的指标会改变其数值的离散程度，从而改变该支柱的实际权重。因此，健康、治理和自然灾害三个支柱会通过固定的线性映射还原到原有量表上；该映射于2026年10月14日一次性计算得出，此后不再重新拟合。' },
      { id: 'grey-rule', title: '数据不完整：来源不足四个则不评分', text: '覆盖某地的独立来源不足四个时，我们不发布官方评分。该地页面会标注“数据不完整”，列出现有来源，并请去过当地的旅行者分享他们的安全感受。但危险信号始终优先：只要至少三个国家政府建议避免一切旅行、“切勿前往”类警告占主导，或乌普萨拉冲突数据项目（UCDP）在最近一年记录到当地有冲突死亡，该地仍会获得评分。' },
      { id: 'community-rule', title: '社区投票', text: '一个国家在过去180天内获得来自至少三个来源国家或地区的至少30票后，旅行者的投票才会计入评分，且任何单一来源国家或地区的权重都不超过一半。调整幅度为社区评分与数据评分之差，有效票数较少时会相应缩小，上限为±1.0分。' },
      { id: 'update-cadence', title: '数据多久变化一次', text: '评分每天重新计算。政府旅行警告和灾害警报每天都可能变化；国际指数（全球和平指数、INFORM、V-Dem、世界银行、UCDP）每年发布一到两次，因此大多数支柱数值在两个版本之间保持不变。' },
    ],
    changelogTitle: '更新记录',
    changelogEntryTitle: '{date}：公式 v10',
    changelogItems: [
      '删除了旅行者无法据以行动的指标：儿童死亡率、PM2.5空气污染，以及一个被标注为气候风险、实为洪水风险的数据列。健康支柱现在使用INFORM的“医疗服务可及性”，取代了一个实际衡量冲突风险的数据列。',
      'INFORM改为读取最新版本（INFORM Risk 2026），并按精确列名取数；治理指标现在读取INFORM的Governance列，而非Institutional列。',
      '只用最新版本，且数据年龄上限为五年：过时的数值（例如2021年以前的凶杀率）现在视为缺失，不再作为最新数据展示。',
      '独立来源不足四个的地方不再获得基于地区估计的评分，而是显示为数据不完整。',
      '按照上述规则，社区投票最多可使评分变动一分。',
      '支柱权重以及冲突、犯罪两个支柱保持不变；“环境”支柱更名为“自然灾害”。此日期之前发布的评分采用公式 v9.1，趋势图中标出了切换日期。',
    ],
    sources: {
      gpi: '全球和平指数 {edition}（经济与和平研究所）',
      advisories: '各国政府旅行警告（每日检查）',
      ucdp: 'UCDP地理编码事件数据集，经Our World in Data发布（最新年份：{edition}）',
      worldbank: '世界银行《世界发展指标》（各国最新发布年份不同）',
      inform: '{edition}，欧盟委员会联合研究中心',
      vdem: 'V-Dem国家年度数据集 v16（{edition}年数据）',
      reliefweb: 'ReliefWeb（联合国人道主义事务协调厅），实时',
      gdacs: 'GDACS（联合国与欧盟委员会），实时',
    },
    licences: {
      iep: 'IEP非商业许可',
      government: '政府公开信息',
      ccBy: 'CC BY 4.0',
      ccBySa: 'CC BY-SA 4.0',
      reliefweb: 'ReliefWeb使用条款',
      gdacs: 'GDACS使用条款',
    },
  },
  de: {
    indicatorsTitle: 'Formel v10: Indikatoren, Quellen und Ausgaben',
    indicatorsIntro:
      'Jede Säule fasst die Indikatoren unten zusammen. Wir verwenden immer die neueste Ausgabe jeder Quelle, und jede Länderseite zeigt jeden Indikator mit seinem eigenen Wert, seiner Einheit und seinem Datenjahr.',
    table: { pillar: 'Säule', indicator: 'Indikator', source: 'Quelle und Ausgabe', licence: 'Lizenz' },
    rulesTitle: 'Die Regeln, die entscheiden, was zählt',
    rules: [
      { id: 'latest-edition', title: 'Nur die neueste Ausgabe', text: 'Sobald eine Quelle eine neue Ausgabe veröffentlicht, zählt die vorherige mit null: Ausgaben werden nie vermischt, alte Werte nie schrittweise ausgeblendet.' },
      { id: 'max-age', title: 'Höchstalter von fünf Jahren', text: 'Ein Indikator, dessen Datenjahr mehr als fünf Jahre vor dem laufenden Jahr liegt, gilt als fehlend und kann eine Bewertung weder heben noch senken. Staatliche Reisehinweise sind per Definition aktuell; Bevölkerungszahlen, die nur zur Einschätzung dienen, wie verlässlich eine Mordrate ist, sind ausgenommen.' },
      { id: 'scale-continuity', title: 'Skalenkontinuität', text: 'Wer die Indikatoren einer Säule austauscht, verändert die Streuung ihrer Werte und damit ihr tatsächliches Gewicht. Die Säulen Gesundheit, Regierungsführung und Naturgefahren werden deshalb mit einer festen linearen Abbildung auf ihre bisherige Skala zurückgeführt, die einmalig am 14. Oktober 2026 berechnet und nie neu angepasst wurde.' },
      { id: 'grey-rule', title: 'Unvollständige Datenlage: keine Bewertung unter vier Quellen', text: 'Ein Reiseziel, das weniger als vier unabhängige Quellen abdecken, erhält keine offizielle Bewertung. Seine Seite zeigt „Unvollständige Datenlage“, nennt die vorhandenen Quellen und fragt Reisende, die dort waren, wie sicher sie sich gefühlt haben. Gefahr hat immer Vorrang: Das Reiseziel wird bewertet, wenn mindestens drei Regierungen von allen Reisen abraten, wenn Reisewarnungen überwiegen oder wenn das Uppsala Conflict Data Program dort im letzten Jahr Tote in bewaffneten Konflikten verzeichnet hat.' },
      { id: 'community-rule', title: 'Stimmen der Community', text: 'Die Stimmen der Reisenden zählen, sobald für ein Land in den letzten 180 Tagen mindestens 30 Stimmen aus mindestens drei Herkunftsländern vorliegen, und kein einzelnes Herkunftsland darf mehr als die Hälfte des Gewichts tragen. Die Anpassung ist der Abstand zwischen Community-Bewertung und datenbasiertem Wert, verkleinert bei wenigen effektiven Stimmen und auf ±1,0 Punkte begrenzt.' },
      { id: 'update-cadence', title: 'Wie oft sich etwas ändert', text: 'Die Bewertung wird täglich neu berechnet. Staatliche Reisehinweise und Katastrophenwarnungen ändern sich täglich; die internationalen Indizes (Global Peace Index, INFORM, V-Dem, Weltbank, UCDP) erscheinen ein- bis zweimal im Jahr, daher bleiben die meisten Säulenwerte zwischen zwei Ausgaben gleich.' },
    ],
    changelogTitle: 'Änderungsprotokoll',
    changelogEntryTitle: '{date}: Formel v10',
    changelogItems: [
      'Indikatoren entfernt, nach denen Reisende nicht handeln können: Kindersterblichkeit, Feinstaub (PM2.5) und eine Spalte zum Hochwasserrisiko, die als Klimarisiko beschriftet war. Die Säule Gesundheit nutzt jetzt den INFORM-Indikator Zugang zur Gesundheitsversorgung statt einer Spalte, die tatsächlich das Konfliktrisiko maß.',
      'INFORM wird aus der neuesten Ausgabe (INFORM Risk 2026) mit exakten Spaltennamen gelesen; der Governance-Indikator liest jetzt die INFORM-Spalte Governance statt Institutional.',
      'Nur die neueste Ausgabe und ein Höchstalter von fünf Jahren: Veraltete Werte, etwa Mordraten von vor 2021, gelten jetzt als fehlend, statt als aktuell zu erscheinen.',
      'Reiseziele mit weniger als vier unabhängigen Quellen erhalten keine aus regionalen Schätzungen gebaute Bewertung mehr, sondern werden als unvollständige Datenlage gezeigt.',
      'Community-Stimmen können eine Bewertung nach den Regeln oben um höchstens einen Punkt verschieben.',
      'Säulengewichte sowie die Säulen Konflikt und Kriminalität bleiben unverändert; die Säule Umwelt heißt jetzt Naturgefahren. Vor diesem Datum veröffentlichte Bewertungen nutzten Formel v9.1, die Verlaufsdiagramme markieren den Wechsel.',
    ],
    sources: {
      gpi: 'Global Peace Index {edition} (Institute for Economics & Peace)',
      advisories: 'Staatliche Reisehinweise (täglich abgerufen)',
      ucdp: 'UCDP Georeferenced Event Dataset über Our World in Data (neuestes Jahr: {edition})',
      worldbank: 'Weltbank, World Development Indicators (neuestes veröffentlichtes Jahr je nach Land unterschiedlich)',
      inform: '{edition}, Europäische Kommission (JRC)',
      vdem: 'V-Dem Country-Year Dataset v16 (Daten von {edition})',
      reliefweb: 'ReliefWeb (UN-OCHA), laufend',
      gdacs: 'GDACS (Vereinte Nationen und Europäische Kommission), laufend',
    },
    licences: {
      iep: 'Nicht-kommerzielle Lizenz des IEP',
      government: 'Öffentliche Regierungsinformationen',
      ccBy: 'CC BY 4.0',
      ccBySa: 'CC BY-SA 4.0',
      reliefweb: 'Nutzungsbedingungen von ReliefWeb',
      gdacs: 'Nutzungsbedingungen von GDACS',
    },
  },
};
