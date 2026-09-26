/**
 * Copy for the "government travel advisories" feature: the hub page (one row
 * per issuing government) and the ~25 per-issuer pages, all 7 locales.
 *
 * Why this lives here instead of ui.ts: ui.ts is a merge hot spot several
 * other workstreams are editing this same round (see VISIBILITY-BRIEF-COMMON.md)
 * — same rationale as about-copy.ts / country-faq-copy.ts, which are also
 * separate per-feature modules.
 *
 * `overrides` in the `issuer` block is the one deliberately hand-tuned part:
 * for the handful of (locale, issuer) pairs where the issuer's own official
 * language IS this locale (e.g. the Farnesina on the it/ page, the US State
 * Department on the en/ page, the Auswärtiges Amt on the de/ page), that
 * government's page gets a headline written for the exact query its own
 * citizens type. Every other issuer page in that locale falls back to
 * `genericTitle`, which is still fully correct, just not hyper-targeted —
 * per VISIBILITY-BRIEF-COMMON.md Task A.2. Only issuers verified to actually
 * publish enough data to earn a page (advisory-views.ts getEligibleIssuers,
 * >= 20 countries) are given an override — "pt" (Portugal), for example, has
 * zero coverage in the current snapshot and gets none.
 *
 * Every {token} is filled in by the page from real, build-time data (counts,
 * percentages, dates, the agency's own localized name from
 * `country.advisory.<code>` in ui.ts) — never a hardcoded number, per
 * CLAUDE.md's "Honesty is non-negotiable" rule.
 */
import type { Lang } from './ui';
import type { AdvisoryCode } from '../pipeline/scoring/engine';

export interface GovernmentAdvisoriesCopy {
  /** Contains one {link} token -> the methodology page. Shared by the hub and every issuer page. */
  methodologyNote: string;
  methodologyLinkText: string;
  /** Breadcrumb label for the hub page itself (also the parent crumb on every issuer page). */
  breadcrumbLabel: string;

  hub: {
    /** {count} = number of eligible issuers today. Used as both <title> and <h1>. */
    title: string;
    /** {count} = number of eligible issuers today. */
    description: string;
    intro1: string;
    /** Contains one {link} token -> the methodology page. */
    intro2: string;
    /**
     * {government} = localized issuing-country name, used as a label ("{government}: ...")
     * rather than a sentence subject on purpose -- several eligible issuers (us, nl) are
     * grammatically PLURAL countries in it/es/fr/pt/de ("die Vereinigten Staaten sind", not
     * "ist"; see src/i18n/country-grammar.ts's isGermanPlural docstring for the same bug
     * class this avoids), so the government name never sits where a conjugated verb would
     * need to agree with it, in any of the 7 locales.
     */
    mostRestrictive: string;
    leastRestrictive: string;
    insufficientRestrictivenessData: string;
    tableCaption: string;
    colGovernment: string;
    colAgency: string;
    colLevel4: string;
    colLevel3: string;
    colLevel2: string;
    colLevel1: string;
    colCoverage: string;
    colUpdated: string;
    colAction: string;
    /** Shown in the "latest update" column when an issuer's newest date can't be determined. */
    noDate: string;
    /** {count} = number of eligible issuers, {date} = snapshot date. */
    updatedDaily: string;
  };

  issuer: {
    /** {agency} = localized agency name. Used as both <title> and <h1> for every issuer NOT in `overrides`. */
    genericTitle: string;
    /** Hand-written per (locale, issuer) headline, used instead of genericTitle. Keys are only the issuers whose official language is this locale. */
    overrides: Partial<Record<AdvisoryCode, string>>;
    /** {agency}, {count} = countries this issuer covers. */
    description: string;
    /** {agency}. */
    intro: string;
    /** Index 0 = level 1 .. index 3 = level 4. */
    levelHeadings: [string, string, string, string];
    /** {agency}, {n} = the level (4-1) with no countries today. */
    emptyLevelNote: string;
    ownWordingLabel: string;
    officialPageLabel: string;
    /** {agency}. The Task A.2 honesty requirement: absence != "safe". */
    absenceNote: string;
    /** {agency}. */
    compareTitle: string;
    /** {pct} = agreement % with the peer median, one decimal. */
    compareMoreCautious: string;
    compareMoreLenient: string;
    compareInLine: string;
    compareInsufficientData: string;
    /**
     * 2026-09-26 hardening (VISIBILITY-BRIEF task 4a): shown INSTEAD of the
     * full listing when this issuer's current coverage falls below
     * advisory-views.ts's MIN_ISSUER_COVERAGE. The page itself still exists
     * (a URL Google indexed while the issuer was eligible must never 404)
     * but is marked noindex and left out of the sitemap -- see
     * IssuerAdvisoryPage.astro. {agency}.
     */
    insufficientDataTitle: string;
    /** {agency}. */
    insufficientDataBody: string;
  };
}

export const governmentAdvisoriesCopy: Record<Lang, GovernmentAdvisoriesCopy> = {
  en: {
    methodologyNote: 'Every level here is mapped onto the same 1–4 scale explained in our {link}.',
    methodologyLinkText: 'methodology',
    breadcrumbLabel: 'Government Travel Advisories',
    hub: {
      title: "{count} Governments' Travel Advisories, Compared Daily",
      description: 'See how {count} governments rate travel risk for the same destinations, on one shared 1–4 scale recomputed every day.',
      intro1: 'Governments issue travel advisories to warn their own citizens about risks abroad, from petty crime to armed conflict. Every advisory below has been mapped onto the same 1-to-4 scale used across this site, so lists that use very different wording — colours, phrases, numbered tiers — become directly comparable.',
      intro2: 'No two governments agree on every country. They draw on different embassy networks, domestic risk tolerance, diplomatic relationships and update schedules, so the same destination can be "normal precautions" for one government and "do not travel" for another. Neither reading is automatically right — see our {link} for how we combine all of them into a single safety score.',
      mostRestrictive: '{government}: the most cautious advisories today, relative to what other governments say about the same countries.',
      leastRestrictive: '{government}: the most lenient advisories, by that same comparison.',
      insufficientRestrictivenessData: "There isn't yet enough overlapping data to name a most- or least-cautious government.",
      tableCaption: 'Government Travel-Advisory Coverage, by Issuing Government',
      colGovernment: 'Government',
      colAgency: 'Issuing Agency',
      colLevel4: 'Level 4',
      colLevel3: 'Level 3',
      colLevel2: 'Level 2',
      colLevel1: 'Level 1',
      colCoverage: 'Countries Covered',
      colUpdated: 'Latest Update',
      colAction: 'View List',
      noDate: 'date not published',
      updatedDaily: 'Recomputed daily from {count} government sources — snapshot date {date}.',
    },
    issuer: {
      genericTitle: '{agency}: Travel Advisories by Country',
      overrides: {
        us: 'US Travel Advisory Level 4 List: Do Not Travel Countries',
        uk: 'FCDO Advise Against All Travel: The Full Country List',
        ca: "Canada Travel Advisory List: Every Country's Risk Level",
        au: "Smartraveller's Do Not Travel List, Country by Country",
        ie: "Ireland Travel Advice: Every Country's Risk Level",
        nz: 'SafeTravel NZ: Countries with a Do Not Travel Advisory',
        sg: 'Singapore MFA Travel Advisories, Country by Country',
        hk: 'Hong Kong Outbound Travel Alerts, Country by Country',
      },
      description: "{agency}'s current travel advisories for {count} countries, grouped by level (1–4) and compared with other governments. Updated daily.",
      intro: "Countries below are grouped by {agency}'s current advisory level, mapped onto our shared 1-to-4 scale. Where available, we also show {agency}'s own wording and a link to its official page — always check the source directly before you travel.",
      levelHeadings: [
        'Level 1 — Normal Precautions',
        'Level 2 — Increased Caution',
        'Level 3 — Reconsider Travel',
        'Level 4 — Do Not Travel',
      ],
      emptyLevelNote: '{agency} lists no countries at level {n} today.',
      ownWordingLabel: "{agency}'s own wording",
      officialPageLabel: 'Official page',
      absenceNote: '{agency} does not publish an advisory for every country. A country missing from the lists above simply has no published {agency} advisory — that is not the same as being declared safe.',
      compareTitle: 'How {agency} Compares',
      compareMoreCautious: 'Compared with other governments rating the same countries, {agency} tends to rate destinations more cautiously — its level matches the consensus among other governments {pct}% of the time.',
      compareMoreLenient: 'Compared with other governments rating the same countries, {agency} tends to rate destinations less cautiously — its level matches the consensus among other governments {pct}% of the time.',
      compareInLine: 'Compared with other governments rating the same countries, {agency} tracks closely with the consensus — its level matches other governments {pct}% of the time.',
      compareInsufficientData: "There isn't yet enough overlapping data to compare {agency} with other governments.",
      insufficientDataTitle: '{agency}: Not Enough Current Data',
      insufficientDataBody:
        "We don't have enough current travel-advisory data from {agency} to show a full breakdown today. This page will fill back in automatically once {agency} publishes more countries again — in the meantime, see how every other government rates the same destinations.",
    },
  },

  it: {
    methodologyNote: 'Ogni livello qui riportato è convertito sulla stessa scala 1–4 spiegata nella nostra {link}.',
    methodologyLinkText: 'metodologia',
    breadcrumbLabel: 'Avvisi di viaggio governativi',
    hub: {
      title: 'Avvisi di viaggio di {count} governi, a confronto',
      description: 'Confronta come {count} governi valutano il rischio di viaggio per le stesse destinazioni, su un\'unica scala 1–4 ricalcolata ogni giorno.',
      intro1: "I governi pubblicano avvisi di viaggio per avvertire i propri cittadini dei rischi all'estero, dalla piccola criminalità ai conflitti armati. Ogni avviso qui sotto è stato convertito sulla stessa scala da 1 a 4 usata in tutto il sito, così elenchi che usano formulazioni molto diverse — colori, frasi, livelli numerati — diventano direttamente confrontabili.",
      intro2: 'Nessun governo è d\'accordo su ogni singolo paese. Le reti diplomatiche, la propensione al rischio, i rapporti bilaterali e i tempi di aggiornamento differiscono, così la stessa destinazione può essere "normali precauzioni" per un governo e "non recarsi" per un altro. Nessuna delle due letture è automaticamente quella giusta: la nostra {link} spiega come le combiniamo in un unico punteggio di sicurezza.',
      mostRestrictive: '{government}: oggi gli avvisi più prudenti, rispetto a quanto dicono gli altri governi sugli stessi paesi.',
      leastRestrictive: '{government}: gli avvisi più permissivi, nello stesso confronto.',
      insufficientRestrictivenessData: 'Non ci sono ancora abbastanza dati sovrapponibili per indicare il governo più o meno prudente.',
      tableCaption: 'Copertura degli avvisi di viaggio, per governo emittente',
      colGovernment: 'Governo',
      colAgency: 'Ente emittente',
      colLevel4: 'Livello 4',
      colLevel3: 'Livello 3',
      colLevel2: 'Livello 2',
      colLevel1: 'Livello 1',
      colCoverage: 'Paesi coperti',
      colUpdated: 'Ultimo aggiornamento',
      colAction: 'Vedi elenco',
      noDate: 'data non pubblicata',
      updatedDaily: 'Ricalcolato ogni giorno da {count} fonti governative — istantanea del {date}.',
    },
    issuer: {
      genericTitle: '{agency}: avvisi di viaggio per paese',
      overrides: {
        it: 'Paesi sconsigliati dalla Farnesina: elenco aggiornato',
      },
      description: "Gli avvisi di viaggio attuali di {agency} per {count} paesi, raggruppati per livello (1–4) e confrontati con gli altri governi. Aggiornati ogni giorno.",
      intro: "I paesi qui sotto sono raggruppati per livello di avviso attuale di {agency}, convertito sulla nostra scala comune da 1 a 4. Dove disponibile, mostriamo anche la formulazione originale di {agency} e un link alla sua pagina ufficiale: verifica sempre la fonte diretta prima di partire.",
      levelHeadings: [
        'Livello 1 — Normali precauzioni',
        'Livello 2 — Maggiore prudenza',
        'Livello 3 — Da riconsiderare',
        'Livello 4 — Non recarsi',
      ],
      emptyLevelNote: '{agency} non classifica oggi nessun paese al livello {n}.',
      ownWordingLabel: 'Formulazione originale di {agency}',
      officialPageLabel: 'Pagina ufficiale',
      absenceNote: '{agency} non pubblica un avviso per ogni paese. Un paese assente dagli elenchi sopra significa solo che non esiste un avviso pubblicato da {agency} — non che sia stato dichiarato sicuro.',
      compareTitle: 'Come si colloca {agency}',
      compareMoreCautious: 'Rispetto agli altri governi che valutano gli stessi paesi, {agency} tende a essere più prudente: il suo livello coincide con il consenso degli altri governi nel {pct}% dei casi.',
      compareMoreLenient: 'Rispetto agli altri governi che valutano gli stessi paesi, {agency} tende a essere più permissivo: il suo livello coincide con il consenso degli altri governi nel {pct}% dei casi.',
      compareInLine: 'Rispetto agli altri governi che valutano gli stessi paesi, {agency} segue da vicino il consenso generale: il suo livello coincide con quello degli altri governi nel {pct}% dei casi.',
      compareInsufficientData: 'Non ci sono ancora abbastanza dati sovrapponibili per confrontare {agency} con gli altri governi.',
      insufficientDataTitle: '{agency}: dati non ancora sufficienti',
      insufficientDataBody:
        "Al momento non abbiamo abbastanza dati aggiornati da {agency} per mostrare un quadro completo. La pagina si ripopolerà automaticamente non appena {agency} pubblicherà di nuovo più paesi — nel frattempo puoi vedere come valutano le stesse destinazioni gli altri governi.",
    },
  },

  es: {
    methodologyNote: 'Cada nivel se traduce a la misma escala 1-4 que explicamos en nuestra {link}.',
    methodologyLinkText: 'metodología',
    breadcrumbLabel: 'Avisos de viaje gubernamentales',
    hub: {
      title: 'Avisos de viaje de {count} gobiernos, comparados',
      description: 'Compara cómo {count} gobiernos valoran el riesgo de viaje para los mismos destinos, en una única escala 1-4 recalculada a diario.',
      intro1: 'Los gobiernos publican avisos de viaje para advertir a sus ciudadanos de los riesgos en el extranjero, desde la delincuencia común hasta los conflictos armados. Cada aviso de abajo se ha traducido a la misma escala del 1 al 4 usada en todo el sitio, de modo que listas con redacciones muy distintas —colores, frases, niveles numerados— se vuelven directamente comparables.',
      intro2: 'Ningún gobierno coincide con los demás en todos los países. Cada uno se apoya en su propia red de embajadas, su tolerancia al riesgo, sus relaciones diplomáticas y su propio calendario de actualización, así que el mismo destino puede ser "precauciones normales" para un gobierno y "no viajar" para otro. Ninguna lectura es automáticamente la correcta: nuestra {link} explica cómo las combinamos en una sola puntuación de seguridad.',
      mostRestrictive: '{government}: los avisos más cautelosos de hoy, en comparación con lo que dicen otros gobiernos sobre los mismos países.',
      leastRestrictive: '{government}: los avisos más permisivos, en esa misma comparación.',
      insufficientRestrictivenessData: 'Todavía no hay suficientes datos comparables para señalar al gobierno más o menos cauteloso.',
      tableCaption: 'Cobertura de los avisos de viaje, por gobierno emisor',
      colGovernment: 'Gobierno',
      colAgency: 'Organismo emisor',
      colLevel4: 'Nivel 4',
      colLevel3: 'Nivel 3',
      colLevel2: 'Nivel 2',
      colLevel1: 'Nivel 1',
      colCoverage: 'Países cubiertos',
      colUpdated: 'Última actualización',
      colAction: 'Ver lista',
      noDate: 'fecha no publicada',
      updatedDaily: 'Recalculado a diario a partir de {count} fuentes gubernamentales — instantánea del {date}.',
    },
    issuer: {
      genericTitle: '{agency}: avisos de viaje por país',
      overrides: {
        es: 'Países desaconsejados por Exteriores: lista actualizada',
      },
      description: 'Los avisos de viaje actuales de {agency} para {count} países, agrupados por nivel (1-4) y comparados con otros gobiernos. Actualizados a diario.',
      intro: 'Los países de abajo están agrupados por el nivel de aviso actual de {agency}, traducido a nuestra escala común del 1 al 4. Cuando está disponible, también mostramos la redacción original de {agency} y un enlace a su página oficial: comprueba siempre la fuente directa antes de viajar.',
      levelHeadings: [
        'Nivel 1 — Precauciones normales',
        'Nivel 2 — Extremar precauciones',
        'Nivel 3 — Reconsiderar el viaje',
        'Nivel 4 — No viajar',
      ],
      emptyLevelNote: '{agency} no clasifica hoy ningún país en el nivel {n}.',
      ownWordingLabel: 'Redacción original de {agency}',
      officialPageLabel: 'Página oficial',
      absenceNote: '{agency} no publica un aviso para todos los países. Que un país no aparezca en las listas de arriba solo significa que {agency} no tiene un aviso publicado sobre él, no que lo haya declarado seguro.',
      compareTitle: 'Cómo se posiciona {agency}',
      compareMoreCautious: 'Frente a otros gobiernos que valoran los mismos países, {agency} tiende a ser más cauteloso: su nivel coincide con el consenso de los demás gobiernos el {pct}% de las veces.',
      compareMoreLenient: 'Frente a otros gobiernos que valoran los mismos países, {agency} tiende a ser más permisivo: su nivel coincide con el consenso de los demás gobiernos el {pct}% de las veces.',
      compareInLine: 'Frente a otros gobiernos que valoran los mismos países, {agency} se mantiene muy alineado con el consenso general: su nivel coincide con el de los demás gobiernos el {pct}% de las veces.',
      compareInsufficientData: 'Todavía no hay suficientes datos comparables para comparar a {agency} con otros gobiernos.',
      insufficientDataTitle: '{agency}: datos actuales insuficientes',
      insufficientDataBody:
        'Ahora mismo no tenemos suficientes datos actualizados de {agency} para mostrar un desglose completo. Esta página se completará automáticamente en cuanto {agency} publique de nuevo más países — mientras tanto, consulta cómo valoran los mismos destinos el resto de gobiernos.',
    },
  },

  fr: {
    methodologyNote: 'Chaque niveau est converti sur la même échelle 1-4, expliquée dans notre {link}.',
    methodologyLinkText: 'méthodologie',
    breadcrumbLabel: 'Conseils aux voyageurs',
    hub: {
      title: "Conseils aux voyageurs de {count} gouvernements, comparés",
      description: 'Comparez la façon dont {count} gouvernements évaluent le risque de voyage pour les mêmes destinations, sur une échelle commune de 1 à 4 recalculée chaque jour.',
      intro1: "Les gouvernements publient des conseils aux voyageurs pour avertir leurs citoyens des risques à l'étranger, de la petite délinquance aux conflits armés. Chaque avis ci-dessous a été converti sur la même échelle de 1 à 4 utilisée sur tout le site, afin que des listes formulées très différemment — couleurs, formules, niveaux numérotés — deviennent directement comparables.",
      intro2: "Aucun gouvernement ne s'accorde avec les autres sur tous les pays. Réseaux diplomatiques, tolérance au risque, relations bilatérales et calendriers de mise à jour diffèrent, si bien que la même destination peut être en « précautions normales » pour un gouvernement et « fortement déconseillée » pour un autre. Aucune des deux lectures n'est automatiquement la bonne — notre {link} explique comment nous les combinons en un seul score de sécurité.",
      mostRestrictive: "{government} : les avis les plus prudents aujourd'hui, par rapport à ce que disent les autres gouvernements sur les mêmes pays.",
      leastRestrictive: '{government} : les avis les plus indulgents, selon la même comparaison.',
      insufficientRestrictivenessData: "Les données comparables ne sont pas encore suffisantes pour désigner le gouvernement le plus ou le moins prudent.",
      tableCaption: 'Couverture des conseils aux voyageurs, par gouvernement émetteur',
      colGovernment: 'Gouvernement',
      colAgency: 'Organisme émetteur',
      colLevel4: 'Niveau 4',
      colLevel3: 'Niveau 3',
      colLevel2: 'Niveau 2',
      colLevel1: 'Niveau 1',
      colCoverage: 'Pays couverts',
      colUpdated: 'Dernière mise à jour',
      colAction: 'Voir la liste',
      noDate: 'date non publiée',
      updatedDaily: 'Recalculé chaque jour à partir de {count} sources gouvernementales — instantané du {date}.',
    },
    issuer: {
      genericTitle: '{agency} : avis de voyage par pays',
      overrides: {
        fr: 'Pays formellement déconseillés par la France : la liste',
        be: 'Belgique : pays à éviter selon les Affaires étrangères',
      },
      description: "Les conseils aux voyageurs actuels de {agency} pour {count} pays, regroupés par niveau (1-4) et comparés aux autres gouvernements. Mis à jour chaque jour.",
      intro: "Les pays ci-dessous sont regroupés par niveau d'avis actuel de {agency}, converti sur notre échelle commune de 1 à 4. Quand elle est disponible, nous affichons aussi la formulation originale de {agency} et un lien vers sa page officielle : vérifiez toujours la source directe avant de partir.",
      levelHeadings: [
        'Niveau 1 — Précautions normales',
        'Niveau 2 — Vigilance renforcée',
        'Niveau 3 — Voyage à reconsidérer',
        'Niveau 4 — Voyage déconseillé',
      ],
      emptyLevelNote: "{agency} ne classe aujourd'hui aucun pays au niveau {n}.",
      ownWordingLabel: 'Formulation originale de {agency}',
      officialPageLabel: 'Page officielle',
      absenceNote: "{agency} ne publie pas d'avis pour tous les pays. Un pays absent des listes ci-dessus signifie seulement qu'il n'existe aucun avis publié par {agency} — pas qu'il a été déclaré sûr.",
      compareTitle: 'Comment se positionne {agency}',
      compareMoreCautious: 'Comparé aux autres gouvernements évaluant les mêmes pays, {agency} tend à se montrer plus prudent : son niveau coïncide avec le consensus des autres gouvernements {pct} % du temps.',
      compareMoreLenient: 'Comparé aux autres gouvernements évaluant les mêmes pays, {agency} tend à se montrer plus indulgent : son niveau coïncide avec le consensus des autres gouvernements {pct} % du temps.',
      compareInLine: 'Comparé aux autres gouvernements évaluant les mêmes pays, {agency} suit de près le consensus général : son niveau coïncide avec celui des autres gouvernements {pct} % du temps.',
      compareInsufficientData: "Les données comparables ne sont pas encore suffisantes pour comparer {agency} aux autres gouvernements.",
      insufficientDataTitle: '{agency} : données actuelles insuffisantes',
      insufficientDataBody:
        "Nous ne disposons pas encore d'assez de données récentes de {agency} pour afficher un tableau complet aujourd'hui. Cette page se remplira automatiquement dès que {agency} publiera de nouveau davantage de pays — en attendant, découvrez comment les autres gouvernements évaluent les mêmes destinations.",
    },
  },

  pt: {
    methodologyNote: 'Cada nível é convertido para a mesma escala 1-4 explicada na nossa {link}.',
    methodologyLinkText: 'metodologia',
    breadcrumbLabel: 'Alertas de viagem governamentais',
    hub: {
      title: 'Alertas de viagem de {count} governos, comparados',
      description: 'Veja como {count} governos avaliam o risco de viagem para os mesmos destinos, numa única escala 1-4 recalculada todos os dias.',
      intro1: 'Os governos publicam alertas de viagem para avisar os próprios cidadãos sobre riscos no exterior, da pequena criminalidade aos conflitos armados. Cada alerta abaixo foi convertido para a mesma escala de 1 a 4 usada em todo o site, para que listas com redações muito diferentes — cores, frases, níveis numerados — fiquem diretamente comparáveis.',
      intro2: 'Nenhum governo concorda com os demais sobre todos os países. Redes diplomáticas, tolerância ao risco, relações bilaterais e calendários de atualização diferem, então o mesmo destino pode ser "precaução normal" para um governo e "não viajar" para outro. Nenhuma das duas leituras está automaticamente certa — veja nossa {link} para entender como as combinamos num único índice de segurança.',
      mostRestrictive: '{government}: os alertas mais cautelosos de hoje, em comparação com o que outros governos dizem sobre os mesmos países.',
      leastRestrictive: '{government}: os alertas mais permissivos, na mesma comparação.',
      insufficientRestrictivenessData: 'Ainda não há dados comparáveis suficientes para apontar o governo mais ou menos cauteloso.',
      tableCaption: 'Cobertura dos alertas de viagem, por governo emissor',
      colGovernment: 'Governo',
      colAgency: 'Órgão emissor',
      colLevel4: 'Nível 4',
      colLevel3: 'Nível 3',
      colLevel2: 'Nível 2',
      colLevel1: 'Nível 1',
      colCoverage: 'Países cobertos',
      colUpdated: 'Última atualização',
      colAction: 'Ver lista',
      noDate: 'data não publicada',
      updatedDaily: 'Recalculado todos os dias a partir de {count} fontes governamentais — instantâneo de {date}.',
    },
    issuer: {
      genericTitle: '{agency}: alertas de viagem por país',
      overrides: {},
      description: 'Os alertas de viagem atuais de {agency} para {count} países, agrupados por nível (1-4) e comparados com outros governos. Atualizados todos os dias.',
      intro: 'Os países abaixo estão agrupados pelo nível de alerta atual de {agency}, convertido para a nossa escala comum de 1 a 4. Quando disponível, também mostramos a redação original de {agency} e um link para a sua página oficial: confirme sempre a fonte direta antes de viajar.',
      levelHeadings: [
        'Nível 1 — Precaução normal',
        'Nível 2 — Cautela redobrada',
        'Nível 3 — Reconsiderar a viagem',
        'Nível 4 — Não viajar',
      ],
      emptyLevelNote: '{agency} não classifica hoje nenhum país no nível {n}.',
      ownWordingLabel: 'Redação original de {agency}',
      officialPageLabel: 'Página oficial',
      absenceNote: '{agency} não publica um alerta para todos os países. Um país ausente das listas acima significa apenas que não existe um alerta publicado por {agency} — não que tenha sido declarado seguro.',
      compareTitle: 'Como {agency} se posiciona',
      compareMoreCautious: 'Em comparação com outros governos que avaliam os mesmos países, {agency} tende a ser mais cauteloso: o seu nível coincide com o consenso dos demais governos em {pct}% dos casos.',
      compareMoreLenient: 'Em comparação com outros governos que avaliam os mesmos países, {agency} tende a ser mais permissivo: o seu nível coincide com o consenso dos demais governos em {pct}% dos casos.',
      compareInLine: 'Em comparação com outros governos que avaliam os mesmos países, {agency} acompanha de perto o consenso geral: o seu nível coincide com o dos demais governos em {pct}% dos casos.',
      compareInsufficientData: 'Ainda não há dados comparáveis suficientes para comparar {agency} com outros governos.',
      insufficientDataTitle: '{agency}: dados atuais insuficientes',
      insufficientDataBody:
        'Neste momento não temos dados atuais suficientes de {agency} para mostrar um panorama completo. Esta página será atualizada automaticamente assim que {agency} publicar novamente mais países — entretanto, veja como os outros governos avaliam os mesmos destinos.',
    },
  },

  zh: {
    methodologyNote: '本页所有等级均已换算为统一的 1-4 分级标准，详见我们的{link}。',
    methodologyLinkText: '方法论说明',
    breadcrumbLabel: '各国政府旅行警示',
    hub: {
      title: '{count} 国政府旅行警示对比',
      description: '对比 {count} 个政府对同一批目的地的旅行风险评估——从美国国务院到德国联邦外交部——统一换算为 1-4 级评分，每日更新。',
      intro1: '各国政府发布旅行警示，提醒本国公民境外可能面临的风险，从街头犯罪到武装冲突不一而足。下方每条警示都已换算为本站统一使用的 1 至 4 级评分体系，因此即便原始表述——颜色、措辞、编号层级——各不相同，也能够直接比较。',
      intro2: '没有两个政府会在所有国家的评估上完全一致。各国依赖的使馆网络、风险承受度、双边关系和更新节奏都不相同，因此同一个目的地，一国政府可能标注"正常防范"，另一国政府却标注"切勿前往"。这两种判断都不天然地更"正确"——请参阅我们的{link}，了解我们如何把它们综合成一个统一的安全评分。',
      mostRestrictive: '{government}：相较于其他政府对同一批国家的评估，目前发布的警示最为审慎。',
      leastRestrictive: '{government}：在同样的对比下，发布的警示最为宽松。',
      insufficientRestrictivenessData: '目前可比数据尚不充分，暂时无法判断哪个政府最审慎或最宽松。',
      tableCaption: '各发布政府的旅行警示覆盖情况',
      colGovernment: '政府',
      colAgency: '发布机构',
      colLevel4: '4 级',
      colLevel3: '3 级',
      colLevel2: '2 级',
      colLevel1: '1 级',
      colCoverage: '覆盖国家数',
      colUpdated: '最近更新',
      colAction: '查看清单',
      noDate: '未公布日期',
      updatedDaily: '每日基于 {count} 个政府数据源重新计算——数据快照日期为 {date}。',
    },
    issuer: {
      genericTitle: '{agency}旅行警示：各国风险等级一览',
      overrides: {
        tw: '台湾外交部旅游警示：各国安全等级一览',
        hk: '香港外游警示：各国旅游安全等级一览',
      },
      description: '{agency}目前对 {count} 个国家发布的旅行警示，按 1-4 级分组，并与其他政府的评估进行对比，每日更新。',
      intro: '下方国家按{agency}目前的警示等级分组，已换算为本站统一使用的 1 至 4 级评分体系。如有原始资料，我们还会附上{agency}的原文表述及其官方页面链接——出发前请您务必查阅官方原始来源。',
      levelHeadings: [
        '1 级 — 正常防范',
        '2 级 — 加强防范',
        '3 级 — 重新考虑是否出行',
        '4 级 — 切勿前往',
      ],
      emptyLevelNote: '{agency}目前没有国家被列为 {n} 级。',
      ownWordingLabel: '{agency}原文表述',
      officialPageLabel: '官方页面',
      absenceNote: '{agency}并非对每个国家都发布警示。上方清单中未出现的国家，只是表示{agency}尚未就该国发布警示——并不代表该国已被认定为安全。',
      compareTitle: '{agency}与其他政府的对比',
      compareMoreCautious: '在评估相同国家时，与其他政府相比，{agency}的评估往往更为审慎——其等级与其他政府的共识一致的比例为 {pct}%。',
      compareMoreLenient: '在评估相同国家时，与其他政府相比，{agency}的评估往往更为宽松——其等级与其他政府的共识一致的比例为 {pct}%。',
      compareInLine: '在评估相同国家时，{agency}的判断与整体共识高度接近——其等级与其他政府一致的比例为 {pct}%。',
      compareInsufficientData: '目前可比数据尚不充分，暂时无法将{agency}与其他政府进行对比。',
      insufficientDataTitle: '{agency}：当前数据不足',
      insufficientDataBody:
        '目前{agency}公布的旅行警示国家数量还不足以呈现完整列表。一旦{agency}再次发布更多国家的警示，本页会自动更新——与此同时，您可以查看其他政府如何评估相同的目的地。',
    },
  },

  de: {
    methodologyNote: 'Jede Stufe wird auf dieselbe 1-4-Skala übertragen, die wir in unserer {link} erklären.',
    methodologyLinkText: 'Methodik',
    breadcrumbLabel: 'Reisewarnungen der Regierungen',
    hub: {
      title: 'Reisewarnungen von {count} Regierungen im Vergleich',
      description: 'Vergleichen Sie, wie {count} Regierungen das Reiserisiko für dieselben Ziele einschätzen, auf einer gemeinsamen 1-4-Skala, täglich neu berechnet.',
      intro1: 'Regierungen veröffentlichen Reisewarnungen, um ihre eigenen Bürger vor Risiken im Ausland zu warnen, von Kleinkriminalität bis zu bewaffneten Konflikten. Jede Warnung unten wurde auf dieselbe 1-bis-4-Skala übertragen, die auf der gesamten Website verwendet wird — so werden Listen mit sehr unterschiedlicher Formulierung (Farben, Begriffe, nummerierte Stufen) direkt vergleichbar.',
      intro2: 'Keine zwei Regierungen stimmen bei jedem Land überein. Unterschiedliche Botschaftsnetze, Risikobereitschaft, diplomatische Beziehungen und Aktualisierungsrhythmen führen dazu, dass dasselbe Reiseziel für die eine Regierung "normale Vorsicht" bedeutet und für eine andere "nicht reisen". Keine der beiden Einschätzungen ist automatisch richtiger — unsere {link} erklärt, wie wir sie zu einem einzigen Sicherheits-Score zusammenführen.',
      mostRestrictive: '{government}: im Vergleich zu dem, was andere Regierungen zu denselben Ländern sagen, heute die vorsichtigsten Warnungen.',
      leastRestrictive: '{government}: im selben Vergleich tendenziell die nachsichtigsten Warnungen.',
      insufficientRestrictivenessData: 'Es liegen noch nicht genügend vergleichbare Daten vor, um die vorsichtigste oder nachsichtigste Regierung zu benennen.',
      tableCaption: 'Abdeckung der Reisewarnungen, nach herausgebender Regierung',
      colGovernment: 'Regierung',
      colAgency: 'Herausgebende Stelle',
      colLevel4: 'Stufe 4',
      colLevel3: 'Stufe 3',
      colLevel2: 'Stufe 2',
      colLevel1: 'Stufe 1',
      colCoverage: 'Erfasste Länder',
      colUpdated: 'Letzte Aktualisierung',
      colAction: 'Liste ansehen',
      noDate: 'Datum nicht veröffentlicht',
      updatedDaily: 'Täglich neu berechnet aus {count} Regierungsquellen — Datenstand {date}.',
    },
    issuer: {
      genericTitle: '{agency}: Reisewarnungen nach Ländern',
      overrides: {
        de: 'Reisewarnungen des Auswärtigen Amts: aktuelle Liste',
        at: 'BMEIA-Reisewarnungen Österreichs: die aktuelle Liste',
        ch: 'Reisehinweise des EDA: Länderliste der Schweiz',
      },
      description: '{agency} listet aktuell Reisewarnungen für {count} Länder, gruppiert nach Stufe (1-4) und verglichen mit anderen Regierungen. Täglich aktualisiert.',
      intro: '{agency} ordnet die Länder unten nach der aktuellen Warnstufe ein, übertragen auf unsere gemeinsame 1-bis-4-Skala. Wo verfügbar, zeigen wir zusätzlich den amtlichen Wortlaut im Original sowie einen Link zur offiziellen Seite — prüfen Sie vor der Reise stets die Quelle direkt.',
      levelHeadings: [
        'Stufe 1 — Normale Vorsicht',
        'Stufe 2 — Erhöhte Vorsicht',
        'Stufe 3 — Reise überdenken',
        'Stufe 4 — Nicht reisen',
      ],
      emptyLevelNote: '{agency} stuft heute kein Land in Stufe {n} ein.',
      ownWordingLabel: 'Originalwortlaut',
      officialPageLabel: 'Offizielle Seite',
      absenceNote: '{agency} veröffentlicht nicht für jedes Land eine Warnung. Fehlt ein Land in den Listen oben, bedeutet das lediglich, dass dafür keine Warnung vorliegt — nicht, dass das Land als sicher eingestuft wurde.',
      compareTitle: 'Wie {agency} im Vergleich abschneidet',
      compareMoreCautious: 'Im Vergleich zu anderen Regierungen, die dieselben Länder bewerten, schätzt {agency} tendenziell vorsichtiger ein — die Stufe stimmt in {pct}% der Fälle mit dem Konsens der anderen Regierungen überein.',
      compareMoreLenient: 'Im Vergleich zu anderen Regierungen, die dieselben Länder bewerten, schätzt {agency} tendenziell nachsichtiger ein — die Stufe stimmt in {pct}% der Fälle mit dem Konsens der anderen Regierungen überein.',
      compareInLine: 'Im Vergleich zu anderen Regierungen, die dieselben Länder bewerten, liegt {agency} nah am allgemeinen Konsens — die Stufe stimmt in {pct}% der Fälle mit der anderer Regierungen überein.',
      compareInsufficientData: 'Es liegen noch nicht genügend vergleichbare Daten vor, um {agency} mit anderen Regierungen zu vergleichen.',
      insufficientDataTitle: '{agency}: derzeit nicht genügend Daten',
      insufficientDataBody:
        'Aktuell liegen uns nicht genügend Reisewarnungen von {agency} vor, um eine vollständige Übersicht zu zeigen. Diese Seite füllt sich automatisch, sobald {agency} wieder mehr Länder veröffentlicht — in der Zwischenzeit sehen Sie hier, wie andere Regierungen dieselben Reiseziele einschätzen.',
    },
  },
};
