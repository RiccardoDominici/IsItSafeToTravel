/**
 * Copy for the /about/ page, all 7 locales.
 *
 * WHY this lives here instead of ui.ts's `about.*` keys: those keys repeatedly
 * call the project "open-source" / "código aberto" / "quelloffen" (title
 * description, project intro, author bio, and a whole "Open Source" section
 * inviting readers to view/contribute on GitHub). Historically the linked
 * repository had no LICENSE file — a public repo without one is legally
 * all-rights-reserved, not open-source, regardless of what the site claims
 * (2026-09-25 audit, findings/inconsistencies.md I7). As of 2026-09-26 (owner
 * decision) the repository ships an MIT LICENSE at the root, so the *code*
 * genuinely is open source now, while the *dataset* remains separately
 * licensed CC BY-NC 4.0 (correctly stated elsewhere) — two different licenses
 * for two different things, and this file is careful to state both correctly.
 * ui.ts is a merge hot spot other workstreams are editing this same round, so
 * this is a fresh module rather than an in-place ui.ts edit.
 *
 * Also adds the "How this site works", "Corrections" and "Who runs it"
 * sections the audit's content/EEAT review asked for (C8/C10 in the prior
 * 2026-08-25 audit): what's automated vs. reviewed, how to report an error,
 * and who is accountable for the page you're reading — with no invented
 * credentials. The Contact section additionally shows the owner's email
 * address, small and discreet, at the owner's explicit request (2026-09-26
 * decision) — on this page only, alongside GitHub Issues and the feedback
 * form, not promoted as the primary contact channel.
 *
 * Paragraphs that embed exactly one link use a single `{link}` token the page
 * splits on — same convention on every field, so every about/index.astro is
 * a thin, identical template over this data.
 */
import type { Lang } from './ui';
import { SOURCE_COUNT_DISPLAY, ADVISORY_GOV_COUNT_DISPLAY } from '../lib/site-stats';

export interface AboutCopy {
  title: string;
  description: string;
  heading: string;

  projectTitle: string;
  projectText: string;

  missionTitle: string;
  missionText: string;

  howItWorksTitle: string;
  howItWorksText: string;

  sourcesTitle: string;
  /** Contains one {link} token -> the methodology page. */
  sourcesText: string;
  methodologyLinkText: string;

  dataCodeTitle: string;
  /** Contains one {link} token -> the GitHub repository. */
  dataCodeText: string;

  correctionsTitle: string;
  correctionsText: string;

  whoRunsItTitle: string;
  /** Contains one {link} token -> the author's GitHub profile. */
  whoRunsItText: string;
  authorName: string;

  contactTitle: string;
  /** Contains one {link} token -> GitHub Issues. */
  contactText: string;
  githubIssuesText: string;
  /** Contains one {link} token -> the feedback page. */
  contactFeedback: string;
  feedbackLinkText: string;
  /** Label preceding the owner's contact email, shown small/discreet at the end of the Contact section. */
  contactEmailLabel: string;
}

export const aboutCopy: Record<Lang, AboutCopy> = {
  en: {
    title: 'About IsItSafeToTravel',
    description: 'Who builds IsItSafeToTravel and why: free, independently run and transparent travel safety data covering 248 countries. No paywall, updated every day.',
    heading: 'About IsItSafeToTravel',
    projectTitle: 'About the Project',
    projectText: `IsItSafeToTravel is a free, independently run travel safety platform that provides composite safety scores for 248 countries worldwide. Scores are recomputed every day from ${SOURCE_COUNT_DISPLAY} public sources: travel advisories from ${ADVISORY_GOV_COUNT_DISPLAY} governments plus the World Bank, V-Dem Institute, INFORM Risk Index, Global Peace Index, UCDP, ReliefWeb and GDACS.`,
    missionTitle: 'Mission',
    missionText: 'Our mission is to make travel safety information transparent, accessible, and data-driven. Every score is backed by publicly verifiable sources, and our methodology is fully documented.',
    howItWorksTitle: 'How This Site Works',
    howItWorksText: "Every score comes from an automated pipeline that runs once a day: it fetches government travel advisories and public risk indices, recomputes each country's score, and publishes the result — no manual editing of individual scores. What's automated: data collection, normalization and the scoring formula itself. What's reviewed by hand: the scoring methodology, which changes rarely and only after testing — every change is dated and explained in the changelog on our methodology page.",
    sourcesTitle: 'Data Sources',
    sourcesText: `We aggregate data from ${SOURCE_COUNT_DISPLAY} public sources updated daily — travel advisories from ${ADVISORY_GOV_COUNT_DISPLAY} governments plus global indices. See our {link} for full details on how scores are calculated.`,
    methodologyLinkText: 'methodology page',
    dataCodeTitle: 'Data & Code',
    dataCodeText: "The underlying dataset is open data, licensed CC BY-NC 4.0 — free to reuse for non-commercial purposes, with attribution. The source code of the website and the data pipeline is open source under the MIT license on {link}: you can read it, reuse it, and propose changes.",
    correctionsTitle: 'Corrections',
    correctionsText: 'Spotted a wrong number, a stale advisory, or a bug? Report it through the feedback form or as a GitHub issue. Data corrections land with the next daily update; anything that needs a code or methodology fix is scheduled and noted in the changelog once it ships.',
    whoRunsItTitle: 'Who Runs This Site',
    whoRunsItText: 'IsItSafeToTravel is an independent project built and maintained by {link}, a developer and data analyst. There is no company or editorial team behind it — one person is responsible for the pipeline, the scoring methodology and this website.',
    authorName: 'Riccardo Dominici',
    contactTitle: 'Contact',
    contactText: 'For questions, feedback, or data inquiries, reach out via {link}.',
    githubIssuesText: 'GitHub Issues',
    contactFeedback: 'You can also send us your thoughts directly through our {link}.',
    feedbackLinkText: 'feedback form',
    contactEmailLabel: 'Email',
  },
  it: {
    title: 'Chi siamo - IsItSafeToTravel',
    description: "Chi c'è dietro il progetto e la sua missione: dati di sicurezza di viaggio gratuiti, indipendenti e trasparenti per 248 paesi. Nessun paywall, aggiornati ogni giorno.",
    heading: 'Chi siamo',
    projectTitle: 'Il progetto',
    projectText: `IsItSafeToTravel è una piattaforma gratuita e gestita in modo indipendente per la sicurezza dei viaggi, che fornisce punteggi di sicurezza compositi per 248 paesi nel mondo. I punteggi vengono ricalcolati ogni giorno da ${SOURCE_COUNT_DISPLAY} fonti pubbliche: gli avvisi di viaggio di ${ADVISORY_GOV_COUNT_DISPLAY} governi, più Banca Mondiale, V-Dem Institute, INFORM, Global Peace Index, UCDP, ReliefWeb e GDACS.`,
    missionTitle: 'Missione',
    missionText: 'La nostra missione è rendere le informazioni sulla sicurezza dei viaggi trasparenti, accessibili e basate sui dati. Ogni punteggio è supportato da fonti pubblicamente verificabili e la nostra metodologia è completamente documentata.',
    howItWorksTitle: 'Come funziona questo sito',
    howItWorksText: "Ogni punteggio proviene da una pipeline automatizzata che gira una volta al giorno: raccoglie gli avvisi di viaggio governativi e gli indici di rischio pubblici, ricalcola il punteggio di ogni paese e pubblica il risultato, senza modifiche manuali ai singoli punteggi. Cosa è automatizzato: la raccolta dei dati, la normalizzazione e la formula di calcolo. Cosa viene rivisto manualmente: la metodologia di scoring, che cambia raramente e solo dopo test — ogni modifica è datata e spiegata nel changelog della nostra pagina di metodologia.",
    sourcesTitle: 'Fonti dei dati',
    sourcesText: `Aggreghiamo dati da ${SOURCE_COUNT_DISPLAY} fonti pubbliche aggiornate quotidianamente — avvisi di viaggio di ${ADVISORY_GOV_COUNT_DISPLAY} governi più indici globali. Consulta la nostra {link} per tutti i dettagli su come vengono calcolati i punteggi.`,
    methodologyLinkText: 'pagina Metodologia',
    dataCodeTitle: 'Dati e codice',
    dataCodeText: "Il dataset alla base del sito è open data, con licenza CC BY-NC 4.0: puoi riutilizzarlo liberamente per scopi non commerciali, citando la fonte. Il codice sorgente del sito e della pipeline di dati è open source con licenza MIT su {link}: puoi leggerlo, riutilizzarlo e proporre modifiche.",
    correctionsTitle: 'Correzioni',
    correctionsText: "Hai notato un numero sbagliato, un avviso non aggiornato o un bug? Segnalalo tramite il modulo di feedback o come issue su GitHub. Le correzioni ai dati arrivano con il successivo aggiornamento giornaliero; ciò che richiede una modifica al codice o alla metodologia viene pianificato e annotato nel changelog una volta rilasciato.",
    whoRunsItTitle: 'Chi gestisce questo sito',
    whoRunsItText: "IsItSafeToTravel è un progetto indipendente creato e mantenuto da {link}, sviluppatore e analista di dati. Non c'è alcuna azienda o redazione dietro il progetto: una sola persona è responsabile della pipeline, della metodologia di scoring e di questo sito.",
    authorName: 'Riccardo Dominici',
    contactTitle: 'Contatti',
    contactText: 'Per domande, feedback o richieste sui dati, contattaci tramite {link}.',
    githubIssuesText: 'GitHub Issues',
    contactFeedback: 'Puoi anche inviarci i tuoi pensieri direttamente tramite il nostro {link}.',
    feedbackLinkText: 'modulo feedback',
    contactEmailLabel: 'Email',
  },
  es: {
    title: 'Acerca de IsItSafeToTravel',
    description: 'Quién hace IsItSafeToTravel y por qué: datos de seguridad de viaje libres, transparentes y de gestión independiente para 248 países. Sin muros de pago, actualizados cada día.',
    heading: 'Acerca de IsItSafeToTravel',
    projectTitle: 'Sobre el proyecto',
    projectText: `IsItSafeToTravel es una plataforma de seguridad en viajes gratuita y de gestión independiente que proporciona puntuaciones de seguridad compuestas para 248 países en todo el mundo. Las puntuaciones se recalculan cada día a partir de ${SOURCE_COUNT_DISPLAY} fuentes públicas: avisos de viaje de ${ADVISORY_GOV_COUNT_DISPLAY} gobiernos, más Banco Mundial, V-Dem Institute, INFORM, Global Peace Index, UCDP, ReliefWeb y GDACS.`,
    missionTitle: 'Misión',
    missionText: 'Nuestra misión es hacer que la información sobre seguridad en viajes sea transparente, accesible y basada en datos. Cada puntuación está respaldada por fuentes públicamente verificables, y nuestra metodología está completamente documentada.',
    howItWorksTitle: 'Cómo funciona este sitio',
    howItWorksText: 'Cada puntuación procede de un proceso automatizado que se ejecuta una vez al día: recopila los avisos de viaje gubernamentales y los índices de riesgo públicos, recalcula la puntuación de cada país y publica el resultado, sin ediciones manuales de puntuaciones individuales. Qué está automatizado: la recopilación de datos, la normalización y la propia fórmula de puntuación. Qué se revisa manualmente: la metodología de puntuación, que cambia rara vez y solo tras pruebas — cada cambio queda fechado y explicado en el registro de cambios de nuestra página de metodología.',
    sourcesTitle: 'Fuentes de datos',
    sourcesText: `Agregamos datos de ${SOURCE_COUNT_DISPLAY} fuentes públicas actualizadas diariamente — avisos de viaje de ${ADVISORY_GOV_COUNT_DISPLAY} gobiernos más índices globales. Consulta nuestra {link} para todos los detalles sobre cómo se calculan las puntuaciones.`,
    methodologyLinkText: 'página de Metodología',
    dataCodeTitle: 'Datos y código',
    dataCodeText: 'El conjunto de datos que sustenta el sitio es de datos abiertos, con licencia CC BY-NC 4.0: puedes reutilizarlo libremente con fines no comerciales, citando la fuente. El código fuente del sitio y del pipeline de datos es de código abierto bajo licencia MIT en {link}: puedes leerlo, reutilizarlo y proponer cambios.',
    correctionsTitle: 'Correcciones',
    correctionsText: '¿Has detectado un número incorrecto, un aviso desactualizado o un error? Repórtalo a través del formulario de comentarios o como issue en GitHub. Las correcciones de datos se aplican en la siguiente actualización diaria; lo que requiere un cambio de código o de metodología se planifica y se anota en el registro de cambios una vez publicado.',
    whoRunsItTitle: 'Quién gestiona este sitio',
    whoRunsItText: 'IsItSafeToTravel es un proyecto independiente creado y mantenido por {link}, desarrollador y analista de datos. No hay ninguna empresa ni equipo editorial detrás: una sola persona es responsable del proceso de datos, de la metodología de puntuación y de este sitio.',
    authorName: 'Riccardo Dominici',
    contactTitle: 'Contacto',
    contactText: 'Para preguntas, comentarios o consultas sobre datos, contáctanos a través de {link}.',
    githubIssuesText: 'GitHub Issues',
    contactFeedback: 'También puedes enviarnos tus opiniones directamente a través de nuestro {link}.',
    feedbackLinkText: 'formulario de comentarios',
    contactEmailLabel: 'Correo',
  },
  fr: {
    title: 'À propos de IsItSafeToTravel',
    description: 'Qui est derrière IsItSafeToTravel : données de sécurité de voyage gratuites, transparentes et gérées de façon indépendante pour 248 pays. Sans paywall, mises à jour chaque jour.',
    heading: 'À propos de IsItSafeToTravel',
    projectTitle: 'Le projet',
    projectText: `IsItSafeToTravel est une plateforme de sécurité des voyages gratuite et gérée de façon indépendante, qui fournit des scores de sécurité composites pour 248 pays dans le monde. Les scores sont recalculés chaque jour à partir de ${SOURCE_COUNT_DISPLAY} sources publiques : les avis de voyage de ${ADVISORY_GOV_COUNT_DISPLAY} gouvernements, plus la Banque Mondiale, le V-Dem Institute, INFORM, le Global Peace Index, UCDP, ReliefWeb et GDACS.`,
    missionTitle: 'Mission',
    missionText: 'Notre mission est de rendre les informations sur la sécurité des voyages transparentes, accessibles et basées sur les données. Chaque score est soutenu par des sources publiquement vérifiables, et notre méthodologie est entièrement documentée.',
    howItWorksTitle: 'Comment fonctionne ce site',
    howItWorksText: "Chaque score provient d'un pipeline automatisé qui s'exécute une fois par jour : il récupère les avis de voyage gouvernementaux et les indices de risque publics, recalcule le score de chaque pays et publie le résultat, sans modification manuelle des scores individuels. Ce qui est automatisé : la collecte des données, leur normalisation et la formule de calcul elle-même. Ce qui est révisé manuellement : la méthodologie de calcul, qui change rarement et seulement après des tests — chaque changement est daté et expliqué dans le journal des modifications de notre page méthodologie.",
    sourcesTitle: 'Sources de données',
    sourcesText: `Nous agrégeons des données de ${SOURCE_COUNT_DISPLAY} sources publiques mises à jour quotidiennement — avis de voyage de ${ADVISORY_GOV_COUNT_DISPLAY} gouvernements plus des indices mondiaux. Consultez notre {link} pour tous les détails sur le calcul des scores.`,
    methodologyLinkText: 'page Méthodologie',
    dataCodeTitle: 'Données et code',
    dataCodeText: "Le jeu de données qui alimente le site est une donnée ouverte, sous licence CC BY-NC 4.0 : vous pouvez la réutiliser librement à des fins non commerciales, en citant la source. Le code source du site et du pipeline de données est open source sous licence MIT sur {link} : vous pouvez le consulter, le réutiliser et proposer des modifications.",
    correctionsTitle: 'Corrections',
    correctionsText: "Vous avez repéré un chiffre erroné, un avis obsolète ou un bug ? Signalez-le via le formulaire de commentaires ou en ouvrant une issue sur GitHub. Les corrections de données sont intégrées à la mise à jour quotidienne suivante ; ce qui nécessite une modification du code ou de la méthodologie est planifié et noté dans le journal des modifications une fois publié.",
    whoRunsItTitle: 'Qui gère ce site',
    whoRunsItText: "IsItSafeToTravel est un projet indépendant créé et maintenu par {link}, développeur et analyste de données. Il n'y a ni entreprise ni équipe éditoriale derrière ce projet : une seule personne est responsable du pipeline, de la méthodologie de calcul et de ce site.",
    authorName: 'Riccardo Dominici',
    contactTitle: 'Contact',
    contactText: 'Pour toute question, commentaire ou demande de données, contactez-nous via {link}.',
    githubIssuesText: 'GitHub Issues',
    contactFeedback: 'Vous pouvez également nous envoyer vos commentaires directement via notre {link}.',
    feedbackLinkText: 'formulaire de commentaires',
    contactEmailLabel: 'E-mail',
  },
  pt: {
    title: 'Sobre o IsItSafeToTravel',
    description: 'Quem está por trás do projeto e sua missão: dados de segurança de viagem gratuitos, transparentes e de gestão independente para 248 países. Sem paywall, atualizados diariamente.',
    heading: 'Sobre o IsItSafeToTravel',
    projectTitle: 'O projeto',
    projectText: `IsItSafeToTravel é uma plataforma gratuita e de gestão independente para segurança em viagens, que fornece pontuações de segurança compostas para 248 países no mundo. As pontuações são recalculadas todos os dias a partir de ${SOURCE_COUNT_DISPLAY} fontes públicas: avisos de viagem de ${ADVISORY_GOV_COUNT_DISPLAY} governos, mais Banco Mundial, V-Dem Institute, INFORM, Global Peace Index, UCDP, ReliefWeb e GDACS.`,
    missionTitle: 'Missão',
    missionText: 'Nossa missão é tornar as informações sobre segurança em viagens transparentes, acessíveis e baseadas em dados. Cada pontuação é respaldada por fontes publicamente verificáveis, e nossa metodologia é totalmente documentada.',
    howItWorksTitle: 'Como este site funciona',
    howItWorksText: 'Cada pontuação vem de um pipeline automatizado que roda uma vez por dia: ele coleta os avisos de viagem governamentais e os índices de risco públicos, recalcula a pontuação de cada país e publica o resultado, sem edição manual de pontuações individuais. O que é automatizado: a coleta de dados, a normalização e a própria fórmula de cálculo. O que é revisado manualmente: a metodologia de pontuação, que muda raramente e somente após testes — cada mudança é datada e explicada no changelog da nossa página de metodologia.',
    sourcesTitle: 'Fontes de dados',
    sourcesText: `Agregamos dados de ${SOURCE_COUNT_DISPLAY} fontes públicas atualizadas diariamente — avisos de viagem de ${ADVISORY_GOV_COUNT_DISPLAY} governos mais índices globais. Consulte nossa {link} para todos os detalhes sobre como as pontuações são calculadas.`,
    methodologyLinkText: 'página de Metodologia',
    dataCodeTitle: 'Dados e código',
    dataCodeText: 'O conjunto de dados que sustenta o site é um dado aberto, licenciado sob CC BY-NC 4.0: você pode reutilizá-lo livremente para fins não comerciais, citando a fonte. O código-fonte do site e do pipeline de dados é open source sob licença MIT no {link}: você pode lê-lo, reutilizá-lo e propor mudanças.',
    correctionsTitle: 'Correções',
    correctionsText: 'Encontrou um número errado, um aviso desatualizado ou um bug? Reporte pelo formulário de feedback ou como uma issue no GitHub. Correções de dados entram na próxima atualização diária; o que exige uma mudança de código ou de metodologia é planejado e registrado no changelog assim que é publicado.',
    whoRunsItTitle: 'Quem mantém este site',
    whoRunsItText: 'IsItSafeToTravel é um projeto independente criado e mantido por {link}, desenvolvedor e analista de dados. Não há empresa nem equipe editorial por trás do projeto: uma única pessoa é responsável pelo pipeline, pela metodologia de pontuação e por este site.',
    authorName: 'Riccardo Dominici',
    contactTitle: 'Contato',
    contactText: 'Para perguntas, feedback ou consultas sobre dados, entre em contato através de {link}.',
    githubIssuesText: 'GitHub Issues',
    contactFeedback: 'Você também pode nos enviar seus comentários diretamente através do nosso {link}.',
    feedbackLinkText: 'formulário de feedback',
    contactEmailLabel: 'E-mail',
  },
  zh: {
    title: '关于 IsItSafeToTravel',
    description: '认识 IsItSafeToTravel 背后的团队与使命：这是一个免费、独立运营、透明的旅行安全数据项目，为全球 248 个国家和地区提供每日更新的安全评分，无付费墙，所有方法与数据来源公开可查。',
    heading: '关于 IsItSafeToTravel',
    projectTitle: '关于本项目',
    projectText: `IsItSafeToTravel 是一个免费、独立运营的旅行安全平台，为全球 248 个国家提供综合安全评分。评分每日基于 ${SOURCE_COUNT_DISPLAY} 个公开来源重新计算：来自 ${ADVISORY_GOV_COUNT_DISPLAY} 个政府的旅行建议，以及世界银行、V-Dem Institute、INFORM 风险指数、全球和平指数、UCDP、ReliefWeb 和 GDACS。`,
    missionTitle: '使命',
    missionText: '我们的使命是让旅行安全信息透明、可获取且数据驱动。每个评分都有公开可验证的来源支持，方法论完整记录。',
    howItWorksTitle: '本网站的运作方式',
    howItWorksText: '每个评分都来自一个每天运行一次的自动化流程：它抓取各国政府的旅行警告和公开的风险指数，重新计算每个国家的评分并发布结果，不对单个评分进行人工编辑。自动化的部分：数据采集、标准化处理以及评分公式本身。人工审核的部分：评分方法论——它很少改动，且只有在经过测试后才会调整；每一次改动都会在我们方法论页面的更新日志中注明日期并说明原因。',
    sourcesTitle: '数据来源',
    sourcesText: `我们聚合每日更新的 ${SOURCE_COUNT_DISPLAY} 个公开来源数据——来自 ${ADVISORY_GOV_COUNT_DISPLAY} 个政府的旅行建议及多项全球指数。详见 {link}，了解评分的完整计算方式。`,
    methodologyLinkText: '方法论页面',
    dataCodeTitle: '数据与代码',
    dataCodeText: '支撑本网站的数据集为开放数据，采用 CC BY-NC 4.0 许可：用于非商业目的时，注明来源即可自由复用。网站与数据管道的源代码采用 MIT 许可，在 {link} 上开源：您可以阅读、复用并提出修改建议。',
    correctionsTitle: '更正',
    correctionsText: '发现了错误的数字、过时的警告或程序漏洞？请通过反馈表单或在 GitHub 上提交 issue 告知我们。数据类更正会随下一次每日更新生效；需要修改代码或方法论的问题会被排期处理，并在发布后记录在更新日志中。',
    whoRunsItTitle: '本网站由谁运营',
    whoRunsItText: 'IsItSafeToTravel 是一个独立项目，由{link}——一名开发者兼数据分析师——创建并维护。项目背后没有公司或编辑团队：数据流程、评分方法论和本网站均由一个人负责。',
    authorName: 'Riccardo Dominici',
    contactTitle: '联系',
    contactText: '如有问题、反馈或数据咨询，请通过 {link} 联系。',
    githubIssuesText: 'GitHub Issues',
    contactFeedback: '您也可以通过我们的 {link} 直接发送您的想法。',
    feedbackLinkText: '反馈表单',
    contactEmailLabel: '邮箱',
  },
  de: {
    title: 'Über IsItSafeToTravel',
    description: 'Über das Projekt: wer hinter IsItSafeToTravel steht und warum — kostenlose, unabhängig betriebene, transparente Sicherheitsdaten für 248 Länder. Ohne Paywall, täglich aktualisiert.',
    heading: 'Über IsItSafeToTravel',
    projectTitle: 'Über das Projekt',
    projectText: `IsItSafeToTravel ist eine kostenlose, unabhängig betriebene Plattform für Reisesicherheit, die zusammengesetzte Sicherheitsbewertungen für 248 Länder weltweit bereitstellt. Die Bewertungen werden täglich aus ${SOURCE_COUNT_DISPLAY} öffentlichen Quellen neu berechnet: Reisehinweise von ${ADVISORY_GOV_COUNT_DISPLAY} Regierungen sowie Weltbank, V-Dem Institute, INFORM-Risikoindex, Globaler Friedensindex, UCDP, ReliefWeb und GDACS.`,
    missionTitle: 'Mission',
    missionText: 'Unsere Mission ist es, Informationen zur Reisesicherheit transparent, zugänglich und datenbasiert zu machen. Jede Bewertung wird durch öffentlich überprüfbare Quellen gestützt und unsere Methodik ist vollständig dokumentiert.',
    howItWorksTitle: 'So Funktioniert Diese Website',
    howItWorksText: 'Jede Bewertung stammt aus einer automatisierten Pipeline, die einmal täglich läuft: Sie ruft staatliche Reisehinweise und öffentliche Risikoindizes ab, berechnet die Bewertung jedes Landes neu und veröffentlicht das Ergebnis — ohne manuelle Eingriffe an einzelnen Bewertungen. Automatisiert sind: die Datenerfassung, die Normalisierung und die Bewertungsformel selbst. Manuell geprüft wird: die Bewertungsmethodik, die sich nur selten und erst nach Tests ändert — jede Änderung ist datiert und im Änderungsprotokoll auf unserer Methodik-Seite erklärt.',
    sourcesTitle: 'Datenquellen',
    sourcesText: `Wir aggregieren Daten aus ${SOURCE_COUNT_DISPLAY} täglich aktualisierten öffentlichen Quellen — Reisehinweise von ${ADVISORY_GOV_COUNT_DISPLAY} Regierungen sowie globale Indizes. Vollständige Details zur Berechnung der Bewertungen finden Sie auf unserer {link}.`,
    methodologyLinkText: 'Methodik-Seite',
    dataCodeTitle: 'Daten & Code',
    dataCodeText: 'Der zugrunde liegende Datensatz ist offen zugänglich und unter CC BY-NC 4.0 lizenziert — für nicht-kommerzielle Zwecke frei nutzbar unter Namensnennung. Der Quellcode der Website und der Datenpipeline ist unter der MIT-Lizenz auf {link} quelloffen: Sie können ihn lesen, wiederverwenden und Änderungen vorschlagen.',
    correctionsTitle: 'Korrekturen',
    correctionsText: 'Einen falschen Wert, einen veralteten Hinweis oder einen Fehler entdeckt? Melden Sie ihn über das Feedback-Formular oder als GitHub-Issue. Datenkorrekturen fließen in die nächste tägliche Aktualisierung ein; Änderungen am Code oder an der Methodik werden eingeplant und nach der Veröffentlichung im Änderungsprotokoll vermerkt.',
    whoRunsItTitle: 'Wer Diese Website Betreibt',
    whoRunsItText: 'IsItSafeToTravel ist ein unabhängiges Projekt, erstellt und gepflegt von {link}, einem Entwickler und Datenanalysten. Es steht kein Unternehmen und keine Redaktion dahinter — eine einzelne Person ist für die Pipeline, die Bewertungsmethodik und diese Website verantwortlich.',
    authorName: 'Riccardo Dominici',
    contactTitle: 'Kontakt',
    contactText: 'Bei Fragen, Feedback oder Datenanfragen wenden Sie sich über {link} an uns.',
    githubIssuesText: 'GitHub Issues',
    contactFeedback: 'Sie können uns Ihre Gedanken auch direkt über unser {link} senden.',
    feedbackLinkText: 'Feedback-Formular',
    contactEmailLabel: 'E-Mail',
  },
};
