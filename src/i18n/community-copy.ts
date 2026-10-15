/**
 * Copy for the community block and vote widget on every country page (formula v10, SPEC §5/§7),
 * all 7 locales: SentimentPillar.astro (the block) and SentimentVote.astro (the widget).
 *
 * WHY a module instead of ui.ts: ui.ts is a merge hot spot (the v10 engine/site work edits keys a
 * few lines away, e.g. country.pillar.environment), and this copy needs per-locale grammar
 * functions next to the strings, which ui.ts cannot hold. Same precedent as about-copy.ts and
 * community-vs-data-copy.ts. The older ui.ts `sentiment.*` keys are no longer read by these two
 * components (only `country.pillar.sentiment`, the block heading, still is).
 *
 * Grammar (country names inside sentences): every {place} is resolved per locale through
 * country-grammar.ts, never by pasting the bare name, so articles/prepositions agree:
 *   en "for the United States", it "per un viaggio negli Stati Uniti", fr "au Japon",
 *   pt "para os Estados Unidos" / "aos Estados Unidos", de "für die Türkei" / "in die Türkei".
 * es and zh take the bare name (country-grammar.ts documents why that is correct there); zh never
 * puts a space between the country name and the Chinese text around it.
 * Gender: answers avoid adjectives that would have to agree with the voter where the language
 * offers an equally natural invariable form (it "al sicuro", fr/pt "en/em sécurité/segurança",
 * de predicate "sicher"); es keeps the standard generic masculine ("seguro").
 *
 * Tokens are filled by fillCommunityTemplate. Scores shown in the block use the page's own number
 * format (toFixed(1), as ScoreHero does); the cap inside running prose uses the locale's decimal
 * separator (formatProseDecimal), as the methodology prose does.
 */
import type { Lang } from './ui';
import {
  getEnglishCountryPhrase,
  getFrenchPreposition,
  getGermanDirectional,
  getGermanFuerPhrase,
  getItalianLocative,
  getPortuguesePhrase,
} from './country-grammar';

/** Five answers, in the order they are shown and posted. */
export type FiveLevels = readonly [string, string, string, string, string];

export interface CommunityCopy {
  // ---- vote widget, scored country: relative vote, delta -2..+2 ----
  /** {place} = the country phrase from placeFor(lang, 'relative', ...). */
  relativeQuestion: string;
  /** Labels for delta -2, -1, 0, +1, +2 ("way too high" .. "way too low"). */
  relativeLevels: FiveLevels;

  // ---- vote widget, grey country (no official score): absolute vote, rating 1..5 ----
  partialDataTitle: string;
  partialDataBody: string;
  /** {place} = the country phrase from placeFor(lang, 'absolute', ...). */
  absoluteQuestion: string;
  /** Labels for rating 1..5 ("very unsafe" .. "very safe"). */
  absoluteLevels: FiveLevels;

  submit: string;
  thanksTitle: string;
  thanksBody: string;
  error: string;

  // ---- community block ----
  /** Label of the community rating P (never presented as the official score). */
  ratingLabel: string;
  /** {votes} {origins} — only shown once active, so both are always plural (>= 30, >= 3). */
  votesFromOrigins: string;
  /** Grey country with an active community: P is shown on its own, labelled as such. */
  notOfficialNote: string;
  dataScoreLabel: string;
  adjustmentLabel: string;
  finalScoreLabel: string;
  /** Shown under the breakdown only when the rounded figures do not add up (6.7 + 0.5 shown as 7.1). */
  roundingNote: string;
  /** {votes} {minVotes} {origins} {minOrigins} */
  insufficient: string;
  /**
   * Same progress line when there are votes but none from a known country of origin (the voter's
   * connection carried no country code), [one vote, several votes]. Without it the line read
   * "1/30 votes, 0/3 countries of origin", a vote from no country (audit I20). Same tokens.
   */
  insufficientUnknownOrigin: readonly [string, string];
  /** How votes count, scored country. {minVotes} {minOrigins} {cap} */
  rulesScored: string;
  /** How votes count, grey country (no official score to move). */
  rulesGrey: string;
}

const NBSP = ' '; // French: no line break before ? ! :

export const communityCopy: Record<Lang, CommunityCopy> = {
  en: {
    relativeQuestion: 'Does this safety score feel right for {place}?',
    relativeLevels: ['Way too high', 'Too high', 'About right', 'Too low', 'Way too low'],
    partialDataTitle: 'Partial data',
    partialDataBody: "We don't have enough independent data for a reliable score.",
    absoluteQuestion: 'Have you been to {place}? How safe did you feel?',
    absoluteLevels: ['Very unsafe', 'Unsafe', 'Neither safe nor unsafe', 'Safe', 'Very safe'],
    submit: 'Submit vote',
    thanksTitle: 'Thanks for your input!',
    thanksBody: 'Your vote has been recorded. Community figures update once a day.',
    error: "Couldn't record your vote right now. Please try again later.",
    ratingLabel: 'Community rating',
    votesFromOrigins: 'Based on {votes} votes from {origins} countries of origin',
    notOfficialNote: "This is travelers' own rating, shown separately: it is not an official safety score.",
    dataScoreLabel: 'Data score',
    adjustmentLabel: 'Community adjustment',
    finalScoreLabel: 'Safety score',
    roundingNote: 'Figures are rounded to one decimal, so they may not add up exactly.',
    insufficient:
      'Not enough votes yet ({votes}/{minVotes} votes, {origins}/{minOrigins} countries of origin) — vote to make the community count.',
    insufficientUnknownOrigin: [
      'Not enough votes yet ({votes}/{minVotes} votes, {origins}/{minOrigins} countries of origin, as the country of origin of this vote is unknown) — vote to make the community count.',
      'Not enough votes yet ({votes}/{minVotes} votes, {origins}/{minOrigins} countries of origin, as the country of origin of these votes is unknown) — vote to make the community count.',
    ],
    rulesScored:
      "Once a country has {minVotes} votes from at least {minOrigins} countries of origin, travelers' votes can move its safety score by up to ±{cap} points. No single country of origin can carry more than half of the weight.",
    rulesGrey:
      'There is no official safety score here yet, so the community rating is shown on its own and never stands in for one.',
  },
  it: {
    relativeQuestion: 'Questo punteggio di sicurezza ti sembra giusto per un viaggio {place}?',
    relativeLevels: [
      'Decisamente troppo alto',
      "Un po' troppo alto",
      'Più o meno giusto',
      "Un po' troppo basso",
      'Decisamente troppo basso',
    ],
    partialDataTitle: 'Dati parziali',
    partialDataBody: 'Non abbiamo abbastanza dati indipendenti per un punteggio affidabile.',
    absoluteQuestion: 'Hai viaggiato {place}? Quanto ti sentivi al sicuro?',
    absoluteLevels: ['Per niente al sicuro', 'Poco al sicuro', 'Così così', 'Abbastanza al sicuro', 'Del tutto al sicuro'],
    submit: 'Invia voto',
    thanksTitle: 'Grazie per il tuo contributo!',
    thanksBody: 'Il tuo voto è stato registrato. I dati della community si aggiornano una volta al giorno.',
    error: 'Non è stato possibile registrare il tuo voto. Riprova più tardi.',
    ratingLabel: 'Valutazione della community',
    votesFromOrigins: 'Basata su {votes} voti da {origins} paesi di provenienza',
    notOfficialNote: 'È la valutazione dei viaggiatori, mostrata a parte: non è un punteggio di sicurezza ufficiale.',
    dataScoreLabel: 'Punteggio dai dati',
    adjustmentLabel: 'Correzione della community',
    finalScoreLabel: 'Punteggio di sicurezza',
    roundingNote: 'I valori sono arrotondati a un decimale, quindi la somma può non tornare esattamente.',
    insufficient:
      'Non ci sono ancora abbastanza voti ({votes}/{minVotes} voti, {origins}/{minOrigins} paesi di provenienza): vota anche tu per far contare la community.',
    insufficientUnknownOrigin: [
      'Non ci sono ancora abbastanza voti ({votes}/{minVotes} voti, {origins}/{minOrigins} paesi di provenienza, perché il paese di provenienza di questo voto non è noto): vota anche tu per far contare la community.',
      'Non ci sono ancora abbastanza voti ({votes}/{minVotes} voti, {origins}/{minOrigins} paesi di provenienza, perché il paese di provenienza di questi voti non è noto): vota anche tu per far contare la community.',
    ],
    rulesScored:
      'Quando un paese raccoglie {minVotes} voti da almeno {minOrigins} paesi di provenienza, i voti dei viaggiatori possono spostarne il punteggio di sicurezza fino a ±{cap} punti. Nessun singolo paese di provenienza può pesare più della metà.',
    rulesGrey:
      "Qui non c'è ancora un punteggio di sicurezza ufficiale: la valutazione della community è mostrata a parte e non ne prende mai il posto.",
  },
  es: {
    relativeQuestion: '¿Te parece acertada esta puntuación de seguridad para {place}?',
    relativeLevels: ['Demasiado alta', 'Un poco alta', 'Acertada', 'Un poco baja', 'Demasiado baja'],
    partialDataTitle: 'Datos parciales',
    partialDataBody: 'No tenemos suficientes datos independientes para dar una puntuación fiable.',
    absoluteQuestion: '¿Has estado en {place}? ¿Hasta qué punto te sentiste seguro allí?',
    absoluteLevels: ['Muy inseguro', 'Poco seguro', 'Ni seguro ni inseguro', 'Bastante seguro', 'Muy seguro'],
    submit: 'Enviar voto',
    thanksTitle: '¡Gracias por tu aportación!',
    thanksBody: 'Tu voto ha quedado registrado. Los datos de la comunidad se actualizan una vez al día.',
    error: 'No hemos podido registrar tu voto. Inténtalo de nuevo más tarde.',
    ratingLabel: 'Valoración de la comunidad',
    votesFromOrigins: 'Basada en {votes} votos de {origins} países de origen',
    notOfficialNote: 'Es la valoración de los viajeros, que se muestra aparte: no es una puntuación de seguridad oficial.',
    dataScoreLabel: 'Puntuación según los datos',
    adjustmentLabel: 'Ajuste de la comunidad',
    finalScoreLabel: 'Puntuación de seguridad',
    roundingNote: 'Las cifras están redondeadas a un decimal, así que la suma puede no cuadrar exactamente.',
    insufficient:
      'Aún no hay suficientes votos ({votes}/{minVotes} votos, {origins}/{minOrigins} países de origen): vota para que la comunidad cuente.',
    insufficientUnknownOrigin: [
      'Aún no hay suficientes votos ({votes}/{minVotes} votos, {origins}/{minOrigins} países de origen, porque no se conoce el país de origen de este voto): vota para que la comunidad cuente.',
      'Aún no hay suficientes votos ({votes}/{minVotes} votos, {origins}/{minOrigins} países de origen, porque no se conoce el país de origen de estos votos): vota para que la comunidad cuente.',
    ],
    rulesScored:
      'Cuando un país reúne {minVotes} votos de al menos {minOrigins} países de origen, los votos de los viajeros pueden mover su puntuación de seguridad hasta ±{cap} puntos. Ningún país de origen puede pesar más de la mitad.',
    rulesGrey:
      'Aquí todavía no hay una puntuación de seguridad oficial: la valoración de la comunidad se muestra aparte y nunca ocupa su lugar.',
  },
  fr: {
    relativeQuestion: `Ce score de sécurité vous semble-t-il juste pour un voyage {place}${NBSP}?`,
    relativeLevels: ['Beaucoup trop élevé', 'Un peu trop élevé', 'À peu près juste', 'Un peu trop bas', 'Beaucoup trop bas'],
    partialDataTitle: 'Données partielles',
    partialDataBody: "Nous ne disposons pas d'assez de données indépendantes pour établir un score fiable.",
    absoluteQuestion: `Avez-vous déjà voyagé {place}${NBSP}? Vous y sentiez-vous en sécurité${NBSP}?`,
    absoluteLevels: [
      'Pas du tout en sécurité',
      'Peu en sécurité',
      'Moyennement en sécurité',
      'Plutôt en sécurité',
      'Tout à fait en sécurité',
    ],
    submit: 'Envoyer le vote',
    thanksTitle: `Merci pour votre contribution${NBSP}!`,
    thanksBody: 'Votre vote a bien été enregistré. Les données de la communauté sont mises à jour une fois par jour.',
    error: "Impossible d'enregistrer votre vote pour le moment. Veuillez réessayer plus tard.",
    ratingLabel: 'Note de la communauté',
    votesFromOrigins: 'Sur la base de {votes} votes issus de {origins} pays',
    notOfficialNote: `C'est la note des voyageurs, affichée à part${NBSP}: ce n'est pas un score de sécurité officiel.`,
    dataScoreLabel: 'Score issu des données',
    adjustmentLabel: 'Ajustement communautaire',
    finalScoreLabel: 'Score de sécurité',
    roundingNote: 'Les valeurs sont arrondies à une décimale : leur somme peut différer légèrement.',
    insufficient: `Pas encore assez de votes ({votes}/{minVotes} votes, {origins}/{minOrigins} pays d'origine)${NBSP}: votez pour que la communauté compte.`,
    insufficientUnknownOrigin: [
      `Pas encore assez de votes ({votes}/{minVotes} votes, {origins}/{minOrigins} pays d'origine, car le pays d'origine de ce vote est inconnu)${NBSP}: votez pour que la communauté compte.`,
      `Pas encore assez de votes ({votes}/{minVotes} votes, {origins}/{minOrigins} pays d'origine, car le pays d'origine de ces votes est inconnu)${NBSP}: votez pour que la communauté compte.`,
    ],
    rulesScored:
      "Dès qu'un pays réunit {minVotes} votes venant d'au moins {minOrigins} pays d'origine, les votes des voyageurs peuvent faire varier son score de sécurité de ±{cap} point au maximum. Aucun pays d'origine ne peut peser plus de la moitié.",
    rulesGrey: `Il n'existe pas encore de score de sécurité officiel ici${NBSP}: la note de la communauté est affichée à part et n'en tient jamais lieu.`,
  },
  pt: {
    relativeQuestion: 'Esta pontuação de segurança parece correta {place}?',
    relativeLevels: ['Alta demais', 'Um pouco alta', 'Mais ou menos correta', 'Um pouco baixa', 'Baixa demais'],
    partialDataTitle: 'Dados parciais',
    partialDataBody: 'Não temos dados independentes suficientes para uma pontuação confiável.',
    absoluteQuestion: 'Já foi {place}? Até que ponto se sentiu em segurança?',
    absoluteLevels: ['Nada em segurança', 'Pouco em segurança', 'Mais ou menos', 'Bastante em segurança', 'Totalmente em segurança'],
    submit: 'Enviar voto',
    thanksTitle: 'Obrigado pela sua contribuição!',
    thanksBody: 'Seu voto foi registrado. Os dados da comunidade são atualizados uma vez por dia.',
    error: 'Não foi possível registrar seu voto agora. Tente novamente mais tarde.',
    ratingLabel: 'Avaliação da comunidade',
    votesFromOrigins: 'Com base em {votes} votos de {origins} países de origem',
    notOfficialNote: 'É a avaliação dos viajantes, mostrada à parte: não é uma pontuação de segurança oficial.',
    dataScoreLabel: 'Pontuação dos dados',
    adjustmentLabel: 'Ajuste da comunidade',
    finalScoreLabel: 'Pontuação de segurança',
    roundingNote: 'Os valores são arredondados para uma casa decimal, por isso a soma pode não bater exatamente.',
    insufficient:
      'Ainda não há votos suficientes ({votes}/{minVotes} votos, {origins}/{minOrigins} países de origem): vote para que a comunidade conte.',
    insufficientUnknownOrigin: [
      'Ainda não há votos suficientes ({votes}/{minVotes} votos, {origins}/{minOrigins} países de origem, porque o país de origem deste voto é desconhecido): vote para que a comunidade conte.',
      'Ainda não há votos suficientes ({votes}/{minVotes} votos, {origins}/{minOrigins} países de origem, porque o país de origem destes votos é desconhecido): vote para que a comunidade conte.',
    ],
    rulesScored:
      'Quando um país reúne {minVotes} votos de pelo menos {minOrigins} países de origem, os votos dos viajantes podem mudar a pontuação de segurança desse país em até ±{cap} ponto. Nenhum país de origem pode pesar mais da metade.',
    rulesGrey:
      'Ainda não há uma pontuação de segurança oficial aqui: a avaliação da comunidade aparece à parte e nunca a substitui.',
  },
  zh: {
    relativeQuestion: '您觉得{place}的这个安全评分准确吗？',
    relativeLevels: ['明显偏高', '有点偏高', '基本准确', '有点偏低', '明显偏低'],
    partialDataTitle: '数据不完整',
    partialDataBody: '我们目前没有足够的独立数据，无法给出可靠的评分。',
    absoluteQuestion: '您去过{place}吗？您在那里感觉有多安全？',
    absoluteLevels: ['非常不安全', '不太安全', '一般', '比较安全', '非常安全'],
    submit: '提交投票',
    thanksTitle: '感谢您的反馈！',
    thanksBody: '您的投票已记录。社区数据每天更新一次。',
    error: '暂时无法记录您的投票，请稍后再试。',
    ratingLabel: '社区评分',
    votesFromOrigins: '基于来自 {origins} 个国家或地区的 {votes} 票',
    notOfficialNote: '这是旅行者给出的评分，单独显示，并非官方安全评分。',
    dataScoreLabel: '数据评分',
    adjustmentLabel: '社区调整',
    finalScoreLabel: '安全评分',
    roundingNote: '数值已四舍五入到一位小数，相加结果可能略有出入。',
    insufficient:
      // Never "N 个来源" here: scripts/validate-seo.ts reads "<number> 个来源" as a data-source count.
      '投票还不够（{votes}/{minVotes} 票，来自 {origins}/{minOrigins} 个国家或地区）——投出您的一票，让社区的声音被计入。',
    insufficientUnknownOrigin: [
      '投票还不够（{votes}/{minVotes} 票，来自 {origins}/{minOrigins} 个国家或地区，因为这一票的来源国家或地区未知）——投出您的一票，让社区的声音被计入。',
      '投票还不够（{votes}/{minVotes} 票，来自 {origins}/{minOrigins} 个国家或地区，因为这些投票的来源国家或地区未知）——投出您的一票，让社区的声音被计入。',
    ],
    rulesScored:
      '当一个国家获得来自至少 {minOrigins} 个国家或地区的 {minVotes} 票后，旅行者的投票最多可使其安全评分上下浮动 {cap} 分；任何单一来源国家或地区的权重都不超过一半。',
    rulesGrey: '这里还没有官方安全评分，因此社区评分单独显示，绝不会取而代之。',
  },
  de: {
    relativeQuestion: 'Ist diese Sicherheitsbewertung {place} aus Ihrer Sicht angemessen?',
    relativeLevels: ['Viel zu hoch', 'Etwas zu hoch', 'Angemessen', 'Etwas zu niedrig', 'Viel zu niedrig'],
    partialDataTitle: 'Unvollständige Datenlage',
    partialDataBody: 'Für eine verlässliche Bewertung liegen uns nicht genügend unabhängige Daten vor.',
    absoluteQuestion: 'Sind Sie schon einmal {place} gereist? Wie sicher haben Sie sich dort gefühlt?',
    absoluteLevels: ['Sehr unsicher', 'Eher unsicher', 'Teils, teils', 'Eher sicher', 'Sehr sicher'],
    submit: 'Stimme abgeben',
    thanksTitle: 'Danke für Ihre Rückmeldung!',
    thanksBody: 'Ihre Stimme wurde gespeichert. Die Community-Werte werden einmal täglich aktualisiert.',
    error: 'Ihre Stimme konnte gerade nicht gespeichert werden. Bitte versuchen Sie es später erneut.',
    ratingLabel: 'Community-Bewertung',
    votesFromOrigins: 'Basierend auf {votes} Stimmen aus {origins} Herkunftsländern',
    notOfficialNote:
      'Das ist die Einschätzung der Reisenden. Sie wird getrennt angezeigt und ist keine offizielle Sicherheitsbewertung.',
    dataScoreLabel: 'Datenbasierter Wert',
    adjustmentLabel: 'Community-Anpassung',
    finalScoreLabel: 'Sicherheitsbewertung',
    roundingNote: 'Die Werte sind auf eine Nachkommastelle gerundet, die Summe kann daher leicht abweichen.',
    insufficient:
      'Noch nicht genügend Stimmen ({votes}/{minVotes} Stimmen, {origins}/{minOrigins} Herkunftsländer): Stimmen Sie ab, damit die Community zählt.',
    insufficientUnknownOrigin: [
      'Noch nicht genügend Stimmen ({votes}/{minVotes} Stimmen, {origins}/{minOrigins} Herkunftsländer, da das Herkunftsland dieser Stimme unbekannt ist): Stimmen Sie ab, damit die Community zählt.',
      'Noch nicht genügend Stimmen ({votes}/{minVotes} Stimmen, {origins}/{minOrigins} Herkunftsländer, da das Herkunftsland dieser Stimmen unbekannt ist): Stimmen Sie ab, damit die Community zählt.',
    ],
    rulesScored:
      'Sobald für ein Land {minVotes} Stimmen aus mindestens {minOrigins} Herkunftsländern vorliegen, können die Stimmen der Reisenden seine Sicherheitsbewertung um bis zu ±{cap} Punkte verschieben. Kein einzelnes Herkunftsland zählt mehr als die Hälfte.',
    rulesGrey:
      'Hier gibt es noch keine offizielle Sicherheitsbewertung. Die Community-Bewertung wird deshalb getrennt angezeigt und ersetzt sie nie.',
  },
};

/** Which question the country phrase goes into: relative (scored) or absolute (grey). */
export type QuestionKind = 'relative' | 'absolute';

type PlacePhrase = (iso3: string, bareName: string) => string;
const bare: PlacePhrase = (_iso3, bareName) => bareName;

/**
 * Country phrase per locale and question. The preposition belongs to the phrase wherever the
 * article contracts with it (it "negli", fr "aux", pt "aos", de "in die"), so the templates above
 * carry only the words around it.
 */
const PLACE: Record<Lang, Record<QuestionKind, PlacePhrase>> = {
  en: { relative: getEnglishCountryPhrase, absolute: getEnglishCountryPhrase },
  it: { relative: getItalianLocative, absolute: getItalianLocative },
  es: { relative: bare, absolute: bare },
  fr: { relative: getFrenchPreposition, absolute: getFrenchPreposition },
  pt: {
    relative: (iso3, name) => getPortuguesePhrase(iso3, name, 'para'),
    absolute: (iso3, name) => getPortuguesePhrase(iso3, name, 'a'),
  },
  zh: { relative: bare, absolute: bare },
  de: { relative: getGermanFuerPhrase, absolute: getGermanDirectional },
};

/** The grammatical country phrase that fills {place} in the given question. */
export function placeFor(lang: Lang, kind: QuestionKind, iso3: string, bareName: string): string {
  return PLACE[lang][kind](iso3, bareName);
}

/** Replace every {token} with its value. Unknown tokens are left visible on purpose (tests catch them). */
export function fillCommunityTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** The vote question for a country, with its grammatical country phrase. */
export function voteQuestion(lang: Lang, kind: QuestionKind, iso3: string, bareName: string): string {
  const copy = communityCopy[lang];
  const template = kind === 'relative' ? copy.relativeQuestion : copy.absoluteQuestion;
  return fillCommunityTemplate(template, { place: placeFor(lang, kind, iso3, bareName) });
}

/**
 * The grey progress line of a community that is not active yet. Each count is clamped at its
 * floor: it is a progress meter, and "9/3 countries of origin" (a floor already met while the
 * other is not) reads as an error; "3/3" says "done" plainly. Votes with no known country of
 * origin count toward the votes but not the origins, so votes without a single known origin get
 * the variant that says why the origins are still at zero.
 */
export function insufficientProgressText(
  lang: Lang,
  votes: number,
  origins: number,
  minVotes: number,
  minOrigins: number,
): string {
  const copy = communityCopy[lang];
  const template =
    votes > 0 && origins === 0 ? copy.insufficientUnknownOrigin[votes === 1 ? 0 : 1] : copy.insufficient;
  return fillCommunityTemplate(template, {
    votes: Math.min(votes, minVotes),
    minVotes,
    origins: Math.min(origins, minOrigins),
    minOrigins,
  });
}

/** A decimal inside running prose, with the locale's separator ("1.0" en/zh, "1,0" elsewhere). */
export function formatProseDecimal(lang: Lang, value: number, digits = 1): string {
  const locale = lang === 'zh' ? 'zh-CN' : lang;
  return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

/**
 * Signed score points for the block, in the page's number format (toFixed(1), like ScoreHero):
 * "+0.3", "−0.4" with U+2212 (never a bare hyphen, as on /community-vs-data/), "0.0" when it
 * rounds to zero (a signed zero reads as a rendering bug).
 */
export function formatSignedPoints(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return '0.0';
  return `${rounded < 0 ? '−' : '+'}${Math.abs(rounded).toFixed(1)}`;
}
