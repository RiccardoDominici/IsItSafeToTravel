/**
 * Copy for the 2026-09-26 visibility-pages round of hub enrichment (SXO-02,
 * SXO-03, SXO-07): region-group intros for countries-to-avoid, an honest
 * solo-female-travel guidance section for safest-for-solo-travelers, and a
 * data-grounded explainer for safest-for-families. Kept out of ui.ts (a merge
 * hot spot several parallel workstreams are editing this round) — same
 * reasoning as hub-blurbs.ts / hub-faq.ts.
 *
 * Every {token} is replaced by the caller (HubPageLayout.astro) with a value
 * computed from the actual build-time data — nothing here names a specific
 * country or invents a claim the dataset doesn't support.
 */
import type { Lang } from './ui';
import type { PillarName } from '../pipeline/types';
import type { Region } from '../lib/regions';

/** Bare, natural region names for the countries-to-avoid sub-headings (H2s). */
export const regionHeadings: Record<Region, Record<Lang, string>> = {
  europe: { en: 'Europe', it: 'Europa', es: 'Europa', fr: 'Europe', pt: 'Europa', zh: '欧洲', de: 'Europa' },
  asia: { en: 'Asia', it: 'Asia', es: 'Asia', fr: 'Asie', pt: 'Ásia', zh: '亚洲', de: 'Asien' },
  africa: { en: 'Africa', it: 'Africa', es: 'África', fr: 'Afrique', pt: 'África', zh: '非洲', de: 'Afrika' },
  americas: { en: 'The Americas', it: 'Americhe', es: 'América', fr: 'Amériques', pt: 'Américas', zh: '美洲', de: 'Amerika' },
  oceania: { en: 'Oceania', it: 'Oceania', es: 'Oceanía', fr: 'Océanie', pt: 'Oceania', zh: '大洋洲', de: 'Ozeanien' },
  middle_east: { en: 'The Middle East', it: 'Medio Oriente', es: 'Oriente Medio', fr: 'Moyen-Orient', pt: 'Oriente Médio', zh: '中东', de: 'Naher Osten' },
};

/**
 * Bare, label-style collocation per pillar (no article, no case inflection) --
 * used as the value half of "most common risk factor: ___" in
 * regionListSentenceTemplate below. Not a general-purpose pillar label (use
 * faqPillarLabels / country-faq-copy.ts for that).
 */
const regionDriverPhrase: Record<Lang, Record<PillarName, string>> = {
  en: { conflict: 'armed conflict', crime: 'high crime', health: 'weak healthcare', governance: 'weak governance', environment: 'environmental risk' },
  it: { conflict: 'conflitti armati', crime: 'criminalità elevata', health: 'sanità debole', governance: 'governance debole', environment: 'rischi ambientali' },
  es: { conflict: 'conflictos armados', crime: 'criminalidad elevada', health: 'sanidad débil', governance: 'gobernanza débil', environment: 'riesgos ambientales' },
  fr: { conflict: 'conflits armés', crime: 'criminalité élevée', health: 'système de santé fragile', governance: 'gouvernance fragile', environment: 'risques environnementaux' },
  pt: { conflict: 'conflitos armados', crime: 'criminalidade elevada', health: 'saúde frágil', governance: 'governança frágil', environment: 'riscos ambientais' },
  zh: { conflict: '武装冲突', crime: '较高的犯罪率', health: '薄弱的医疗体系', governance: '薄弱的治理', environment: '环境风险' },
  de: { conflict: 'bewaffnete Konflikte', crime: 'hohe Kriminalität', health: 'schwaches Gesundheitssystem', governance: 'schwache Regierungsführung', environment: 'Umweltrisiken' },
};

/**
 * Region + language -> singular/plural noun phrase ("European country" /
 * "European countries"). A region can legitimately have exactly 1 member
 * (e.g. Haiti is the only Americas country on countries-to-avoid today), so
 * this can't be a single fixed string per language -- English "1 countries"
 * is wrong, and so is the Romance-language equivalent (singular article/
 * adjective agreement). French "pays" is invariant, so its two forms are
 * identical on purpose, not a copy-paste artifact.
 */
interface RegionNoun { singular: string; plural: string; }
const regionNouns: Record<Region, Record<Lang, RegionNoun>> = {
  europe: {
    en: { singular: 'European country', plural: 'European countries' },
    it: { singular: 'paese europeo', plural: 'paesi europei' },
    es: { singular: 'país europeo', plural: 'países europeos' },
    fr: { singular: 'pays européen', plural: 'pays européens' },
    pt: { singular: 'país europeu', plural: 'países europeus' },
    zh: { singular: '欧洲国家', plural: '欧洲国家' },
    de: { singular: 'europäisches Land', plural: 'europäische Länder' },
  },
  asia: {
    en: { singular: 'Asian country', plural: 'Asian countries' },
    it: { singular: 'paese asiatico', plural: 'paesi asiatici' },
    es: { singular: 'país asiático', plural: 'países asiáticos' },
    fr: { singular: 'pays asiatique', plural: 'pays asiatiques' },
    pt: { singular: 'país asiático', plural: 'países asiáticos' },
    zh: { singular: '亚洲国家', plural: '亚洲国家' },
    de: { singular: 'asiatisches Land', plural: 'asiatische Länder' },
  },
  africa: {
    en: { singular: 'African country', plural: 'African countries' },
    it: { singular: 'paese africano', plural: 'paesi africani' },
    es: { singular: 'país africano', plural: 'países africanos' },
    fr: { singular: 'pays africain', plural: 'pays africains' },
    pt: { singular: 'país africano', plural: 'países africanos' },
    zh: { singular: '非洲国家', plural: '非洲国家' },
    de: { singular: 'afrikanisches Land', plural: 'afrikanische Länder' },
  },
  americas: {
    en: { singular: 'country in the Americas', plural: 'countries in the Americas' },
    it: { singular: 'paese delle Americhe', plural: 'paesi delle Americhe' },
    es: { singular: 'país de América', plural: 'países de América' },
    fr: { singular: "pays d'Amérique", plural: "pays d'Amérique" },
    pt: { singular: 'país das Américas', plural: 'países das Américas' },
    zh: { singular: '美洲国家', plural: '美洲国家' },
    de: { singular: 'Land auf dem amerikanischen Kontinent', plural: 'Länder auf dem amerikanischen Kontinent' },
  },
  oceania: {
    en: { singular: 'Oceania country', plural: 'Oceania countries' },
    it: { singular: "paese dell'Oceania", plural: "paesi dell'Oceania" },
    es: { singular: 'país de Oceanía', plural: 'países de Oceanía' },
    fr: { singular: "pays d'Océanie", plural: "pays d'Océanie" },
    pt: { singular: 'país da Oceania', plural: 'países da Oceania' },
    zh: { singular: '大洋洲国家', plural: '大洋洲国家' },
    de: { singular: 'ozeanisches Land', plural: 'ozeanische Länder' },
  },
  middle_east: {
    en: { singular: 'Middle Eastern country', plural: 'Middle Eastern countries' },
    it: { singular: 'paese del Medio Oriente', plural: 'paesi del Medio Oriente' },
    es: { singular: 'país de Oriente Medio', plural: 'países de Oriente Medio' },
    fr: { singular: 'pays du Moyen-Orient', plural: 'pays du Moyen-Orient' },
    pt: { singular: 'país do Oriente Médio', plural: 'países do Oriente Médio' },
    zh: { singular: '中东国家', plural: '中东国家' },
    de: { singular: 'Land im Nahen Osten', plural: 'Länder im Nahen Osten' },
  },
};

/**
 * One template per language (not per region): the subject is always the
 * fixed, singular "this list", so the verb never has to agree with {n} --
 * only {noun} carries singular/plural agreement (regionNouns above), which
 * sidesteps every article/adjective-agreement pitfall the previous
 * per-region, English-only-tested templates had (they read "1 countries").
 * Tokens: {n}, {noun}, {driver}.
 */
const regionListSentenceTemplate: Record<Lang, string> = {
  en: 'This list includes {n} {noun}. Most common risk factor: {driver}.',
  it: 'Questa lista include {n} {noun}. Fattore di rischio più comune: {driver}.',
  es: 'Esta lista incluye {n} {noun}. Factor de riesgo más común: {driver}.',
  fr: 'Cette liste comprend {n} {noun}. Facteur de risque le plus fréquent : {driver}.',
  pt: 'Esta lista inclui {n} {noun}. Fator de risco mais comum: {driver}.',
  zh: '本列表包含 {n} 个{noun}。最常见的风险因素：{driver}。',
  de: 'Diese Liste umfasst {n} {noun}. Häufigster Risikofaktor: {driver}.',
};

/** Compute the region-group intro sentence from real per-country pillar data. */
export function buildRegionIntro(lang: Lang, region: Region, count: number, dominantPillar: PillarName): string {
  const nounForms = regionNouns[region][lang];
  const noun = count === 1 ? nounForms.singular : nounForms.plural;
  return regionListSentenceTemplate[lang]
    .replace('{n}', String(count))
    .replace('{noun}', noun)
    .replace('{driver}', regionDriverPhrase[lang][dominantPillar]);
}

/** Small secondary link near the hub H1, pointing at /cite-this-data/ (SXO-07). */
export const citeThisRanking: Record<Lang, string> = {
  en: 'Cite this ranking',
  it: 'Cita questa classifica',
  es: 'Cita esta clasificación',
  fr: 'Citer ce classement',
  pt: 'Citar este ranking',
  zh: '引用此排名',
  de: 'Diese Rangliste zitieren',
};

/** Risk-driver chip shown on every ranking-hub row. Tokens: {pillar}, {score}. */
export const riskDriverBadge: Record<Lang, string> = {
  en: 'Weakest: {pillar} {score}/10',
  it: 'Punto debole: {pillar} {score}/10',
  es: 'Punto débil: {pillar} {score}/10',
  fr: 'Point faible : {pillar} {score}/10',
  pt: 'Ponto fraco: {pillar} {score}/10',
  zh: '薄弱环节：{pillar} {score}/10',
  de: 'Schwachstelle: {pillar} {score}/10',
};

export interface SoloFemaleGuidanceCopy {
  title: string;
  /** Each paragraph may contain one {methodology_link} token (split + linked by the caller). */
  paragraphs: string[];
}

// SXO-02: solo-female intent is the dominant SERP pattern for this query and
// the ranking has no dedicated dataset for it -- honesty over a cosmetic
// rename. Names the pillars that actually feed getSafestForSoloTravelers
// (hub-data.ts: crime 40% + governance 40% + overall 20%) and says plainly
// what is NOT measured, rather than implying gender-specific coverage.
export const soloFemaleGuidance: Record<Lang, SoloFemaleGuidanceCopy> = {
  en: {
    title: "What this ranking can — and can't — tell a woman travelling alone",
    paragraphs: [
      'This list ranks countries by overall safety, weighted toward crime (40%) and governance (40%) plus a smaller share of the overall score (20%). Low crime and stable, trustworthy institutions are relevant to any solo traveller: governance quality is a reasonable proxy for how well local police and courts are likely to respond if something goes wrong.',
      "What it can't tell you: none of our public sources break out harassment rates or other risks by gender, so this ranking doesn't measure them separately. Health-system access matters too if you need care while travelling alone — it's shown on every country page even though this ranking doesn't weight it directly. Treat a high rank here as a reasonable starting point, not a guarantee, and weigh it alongside first-hand accounts from other women. Full weighting on the {methodology_link}.",
    ],
  },
  it: {
    title: 'Cosa può dire questa classifica a una donna che viaggia da sola — e cosa non può dire',
    paragraphs: [
      'Questa lista classifica i paesi in base alla sicurezza complessiva, ponderata verso criminalità (40%) e governance (40%), più una quota minore del punteggio complessivo (20%). Bassa criminalità e istituzioni stabili e affidabili sono rilevanti per chiunque viaggi da solo: la qualità della governance è un indicatore ragionevole di quanto bene polizia e tribunali locali risponderebbero se qualcosa andasse storto.',
      "Cosa non può dire: nessuna delle nostre fonti pubbliche distingue i tassi di molestie o altri rischi per genere, quindi questa classifica non li misura separatamente. Anche l'accesso al sistema sanitario conta se hai bisogno di cure viaggiando da sola — è mostrato in ogni pagina paese anche se questa classifica non lo pesa direttamente. Considera una posizione alta qui come un punto di partenza ragionevole, non una garanzia, e valutala insieme alle testimonianze dirette di altre donne. La ponderazione completa è nella {methodology_link}.",
    ],
  },
  es: {
    title: 'Qué puede decirte esta clasificación a una mujer que viaja sola — y qué no',
    paragraphs: [
      'Esta lista clasifica los países por seguridad general, ponderada hacia la criminalidad (40%) y la gobernanza (40%), más una parte menor de la puntuación general (20%). La baja criminalidad y unas instituciones estables y fiables son relevantes para cualquier viajera en solitario: la calidad de la gobernanza es un indicador razonable de qué tan bien responderían la policía y los tribunales locales si algo saliera mal.',
      'Lo que no puede decirte: ninguna de nuestras fuentes públicas desglosa las tasas de acoso u otros riesgos por género, así que esta clasificación no los mide por separado. El acceso al sistema de salud también importa si necesitas atención médica viajando sola — se muestra en cada página de país, aunque esta clasificación no lo pondera directamente. Trata una posición alta aquí como un punto de partida razonable, no una garantía, y sopésala junto con testimonios directos de otras mujeres. Consulta la ponderación completa en la {methodology_link}.',
    ],
  },
  fr: {
    title: 'Ce que ce classement peut — et ne peut pas — dire à une femme qui voyage seule',
    paragraphs: [
      "Cette liste classe les pays selon leur sécurité globale, pondérée vers la criminalité (40 %) et la gouvernance (40 %), plus une part plus faible du score global (20 %). Une faible criminalité et des institutions stables et fiables comptent pour toute personne voyageant seule : la qualité de la gouvernance est un indicateur raisonnable de la réactivité probable de la police et de la justice locales en cas de problème.",
      "Ce qu'il ne peut pas vous dire : aucune de nos sources publiques ne ventile les taux de harcèlement ou d'autres risques par genre, ce classement ne les mesure donc pas séparément. L'accès au système de santé compte aussi si vous avez besoin de soins en voyageant seule — il est indiqué sur chaque page pays, même si ce classement ne le pondère pas directement. Considérez un bon classement ici comme un point de départ raisonnable, pas une garantie, et mettez-le en balance avec des témoignages directs d'autres femmes. Pondération complète sur la {methodology_link}.",
    ],
  },
  pt: {
    title: 'O que este ranking pode — e não pode — dizer a uma mulher que viaja sozinha',
    paragraphs: [
      'Esta lista classifica os países pela segurança geral, ponderada para criminalidade (40%) e governança (40%), mais uma parcela menor da pontuação geral (20%). Baixa criminalidade e instituições estáveis e confiáveis importam para qualquer pessoa que viaje sozinha: a qualidade da governança é um indicador razoável de quão bem a polícia e a justiça locais tendem a responder se algo der errado.',
      'O que ele não pode dizer: nenhuma das nossas fontes públicas separa taxas de assédio ou outros riscos por gênero, então este ranking não os mede separadamente. O acesso ao sistema de saúde também importa se você precisar de atendimento viajando sozinha — ele aparece em cada página de país, mesmo que este ranking não o pondere diretamente. Trate uma posição alta aqui como um ponto de partida razoável, não uma garantia, e avalie-a junto com relatos diretos de outras mulheres. Ponderação completa na {methodology_link}.',
    ],
  },
  zh: {
    title: '这份排名能——以及不能——告诉独自旅行的女性什么',
    paragraphs: [
      '本榜单按总体安全评分排序，权重偏向犯罪（40%）和治理（40%），另有一小部分来自总体评分（20%）。低犯罪率以及稳定、可信赖的制度对任何独自旅行者都很重要：治理质量可以合理反映当地警方和司法系统在出事时的应对能力。',
      '它无法告诉你的是：我们使用的公开数据源都没有按性别拆分骚扰发生率或其他风险，因此本榜单不会单独衡量这些因素。独自旅行时如果需要就医，医疗资源的可及性同样重要——每个国家页面都会显示这项数据，尽管本榜单并未直接将其纳入权重。请把这里的高排名视为一个合理的起点，而非保证，并结合其他女性的亲身经历一并判断。完整权重详见{methodology_link}。',
    ],
  },
  de: {
    title: 'Was dieses Ranking einer Frau, die allein reist, sagen kann — und was nicht',
    paragraphs: [
      'Diese Liste ordnet Länder nach der Gesamtsicherheit, gewichtet nach Kriminalität (40 %) und Regierungsführung (40 %) plus einem kleineren Anteil des Gesamtwerts (20 %). Niedrige Kriminalität und stabile, vertrauenswürdige Institutionen sind für jede Alleinreisende relevant: Die Qualität der Regierungsführung ist ein vernünftiger Anhaltspunkt dafür, wie gut Polizei und Gerichte vor Ort reagieren dürften, wenn etwas schiefgeht.',
      'Was es Ihnen nicht sagen kann: Keine unserer öffentlichen Quellen schlüsselt Belästigungsraten oder andere Risiken nach Geschlecht auf, daher misst dieses Ranking sie nicht gesondert. Der Zugang zum Gesundheitssystem spielt ebenfalls eine Rolle, wenn Sie allein reisend medizinische Hilfe brauchen — er wird auf jeder Länderseite angezeigt, auch wenn dieses Ranking ihn nicht direkt gewichtet. Betrachten Sie einen guten Platz hier als vernünftigen Ausgangspunkt, nicht als Garantie, und wägen Sie ihn zusammen mit Erfahrungsberichten anderer Frauen ab. Vollständige Gewichtung auf der {methodology_link}.',
    ],
  },
};

/**
 * SXO-03 (2-3 sentences on what drives the family ranking, grounded in
 * getSafestForFamilies's actual weights: health 35% + governance 35% +
 * crime 20% + overall 10%, hub-data.ts). Contains one {methodology_link} token.
 */
export const familyRankingExplainer: Record<Lang, string> = {
  en: "This ranking weights health and governance most heavily — 35% each — followed by crime (20%) and the country's overall safety score (10%). Reliable pediatric and emergency care, plus stable, trustworthy institutions, are what matter most when travelling with children. It reflects the underlying safety pillars only, not tourist infrastructure like childcare, theme parks or family resorts — see the full weighting on the {methodology_link}.",
  it: "Questa classifica pesa soprattutto sanità e governance — 35% ciascuna — seguite da criminalità (20%) e punteggio complessivo del paese (10%). Cure pediatriche e di emergenza affidabili, insieme a istituzioni stabili e degne di fiducia, sono ciò che conta di più quando si viaggia con bambini. Riflette solo i pilastri di sicurezza sottostanti, non le infrastrutture turistiche come servizi per l'infanzia, parchi a tema o resort per famiglie — la ponderazione completa è nella {methodology_link}.",
  es: 'Esta clasificación pondera sobre todo salud y gobernanza — 35% cada una — seguidas de criminalidad (20%) y la puntuación general del país (10%). Una atención pediátrica y de urgencias fiable, junto con instituciones estables y dignas de confianza, es lo que más importa al viajar con niños. Refleja solo los pilares de seguridad subyacentes, no la infraestructura turística como guarderías, parques temáticos o resorts familiares — consulta la ponderación completa en la {methodology_link}.',
  fr: "Ce classement pondère surtout la santé et la gouvernance (35 % chacune), suivies de la criminalité (20 %) et du score global du pays (10 %). Des soins pédiatriques et d'urgence fiables, ainsi que des institutions stables et dignes de confiance, comptent le plus lorsqu'on voyage avec des enfants. Il ne reflète que les piliers de sécurité sous-jacents, pas les infrastructures touristiques comme la garde d'enfants, les parcs à thème ou les hôtels familiaux : retrouvez la pondération complète sur la {methodology_link}.",
  pt: 'Esta classificação pondera principalmente saúde e governança — 35% cada — seguidas por criminalidade (20%) e a pontuação geral do país (10%). Atendimento pediátrico e de emergência confiável, somado a instituições estáveis e dignas de confiança, é o que mais importa ao viajar com crianças. Ela reflete apenas os pilares de segurança subjacentes, não a infraestrutura turística como creches, parques temáticos ou resorts para famílias — veja a ponderação completa na {methodology_link}.',
  zh: '该榜单主要以医疗（35%）和治理（35%）为权重，其次是犯罪（20%）和国家总体评分（10%）。带孩子出行时，最重要的是可靠的儿科与急诊医疗，以及稳定、值得信赖的制度。该榜单只反映底层的安全支柱，不涉及托儿服务、主题乐园或家庭度假村等旅游设施——完整权重详见{methodology_link}。',
  de: 'Dieses Ranking gewichtet vor allem Gesundheit und Regierungsführung (je 35 %), gefolgt von Kriminalität (20 %) und dem Gesamt-Sicherheitswert des Landes (10 %). Zuverlässige Kinder- und Notfallversorgung sowie stabile, vertrauenswürdige Institutionen zählen am meisten, wenn Sie mit Kindern reisen. Es spiegelt nur die zugrunde liegenden Sicherheitssäulen wider, nicht touristische Infrastruktur wie Kinderbetreuung, Freizeitparks oder Familienresorts — die vollständige Gewichtung finden Sie auf der {methodology_link}.',
};
