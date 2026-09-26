import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizeItLevel } from '../normalize/advisory-levels.js';

/**
 * Regression coverage for the 2026-09-26 IT (Italy Viaggiare Sicuri) regional-promotion
 * repair (isitsafetotravel.org-audit/2026-09-25/PARSER-REGIONAL-BRIEF.md). Six countries were
 * found promoted from a REGIONAL warning to a whole-country Level 4 ("do not travel"):
 * Armenia, Georgia, Moldova, Oman, Mozambique, Mauritania. Two more surfaced from the same
 * evidence sweep (Cameroon, Guinea) and one more (Iraq) as a side effect of the same fix.
 * Fixtures are VERBATIM excerpts from the live `/schede_paese/{ISO3}.json` dossiers
 * (`infoSicurezza.nodi['Indicazioni-generali'|'Aree-di-particolare-cautela'].contenuto`,
 * HTML-stripped) fetched 2026-09-26.
 */

describe('normalizeItLevel (IT/Viaggiare Sicuri) -- regional-promotion repair', () => {
  it('never guesses on an absent/stub dossier (rule 1: emit nothing, do not default to 1)', () => {
    assert.equal(normalizeItLevel('', ''), null);
    assert.equal(normalizeItLevel('corto', 'anche'), null);
  });

  it('Armenia: "a qualsiasi titolo" ban is scoped to the Azeri exclave and the border, not the whole country -> 2, not 4', () => {
    const general =
      "Nonostante gli sviluppi positivi dell'agosto 2025 e la firma degli Accordi di Washington, non si e' ancora giunti alla sottoscrizione di un Accordo di Pace tra Armenia e Azerbaigian, pertanto si continuano a sconsigliare i viaggi a qualsiasi titolo nei pressi dell'exclave azera di Nakhchivan e - in generale - lungo le frontiere con l'Azerbaigian. In particolare, si sconsigliano i viaggi nelle regioni di Syunik e Vayots Dzor e nelle parti sud ed est della Regione di Gegharkunik. Le principali città (Jerevan e Gyumri) sono contraddistinte da un indice di criminalità relativamente basso.";
    const area =
      "Nonostante gli sviluppi positivi dell'agosto 2025 con la firma delgli Accordi di Washington, non è ancora giunto alla sottoscrizione di un Accordo di Pace tra Armenia e Azerbigian, pertanto si continuano a sconsigliare i viaggi a qualsiasi titolo nei pressi dell'exclave azera di Nakhchivan e - in generale - lungo le frontiere con l'Azerbaigian.";
    assert.equal(normalizeItLevel(general, area), 2);
  });

  it('Georgia: "a qualsiasi titolo" ban is scoped to the Abkhazia/South Ossetia separatist regions -> 2, not 4', () => {
    const general =
      'La situazione politica nel Paese è, in generale, stabile: si raccomanda, tuttavia, di adottare le precauzioni normalmente richieste, quando si visita un Paese straniero, in particolare, evitare eventuali manifestazioni ed assembramenti, custodire con cura i propri effetti personali.';
    const area =
      'Non sembrano probabili, almeno nell’imminenza, scoppi di nuove ostilità con le regioni separatiste dell’Ossezia del Sud e dell’Abkhazia, verso le quali si continuano comunque a sconsigliare viaggi a qualsiasi titolo. Ai sensi della Legge georgiana sui "Territori Occupati" del 23 ottobre 2008, sono da considerare occupati i territori della Repubblica Autonoma di Abkhazia.';
    assert.equal(normalizeItLevel(general, area), 2);
  });

  it('Moldova: "non recarsi" targets the separatist Transnistria region only -> 2, not 4', () => {
    const general =
      "Si registrano talora furti, borseggi e altri episodi di micro-criminalità, soprattutto nella Capitale Chisinau. Potrebbero inoltre verificarsi manifestazioni, generalmente pacifiche, in collegamento con la guerra russo-ucraina e con il quadro di sicurezza nella regione separatista della Transnistria, in cui si raccomanda di non recarsi. E' opportuno attenersi alle precauzioni indicate nella Sezione Avvertenze.";
    const area =
      "Si raccomanda di non recarsi nella regione separatista della Transnistria: in caso di necessità, per l'Ambasciata si renderebbe assai complesso o materialmente impossibile soddisfare eventuali richieste di assistenza consolare.";
    assert.equal(normalizeItLevel(general, area), 2);
  });

  it('Oman: "non recarsi" targets the Yemen border strip only -> 2, not 4', () => {
    const general =
      "Il Paese e' politicamente stabile ed ha un tasso di criminalità basso; pochi i furti e quasi inesistenti le rapine. Si consiglia comunque di esercitare le normali regole di prudenza. Il permanere delle tensioni nel Golfo non consente, al momento, di escludere azioni ostili nell'area.";
    const area =
      "Alla luce degli ultimi eventi nella Regione, si raccomanda ai connazionali di non recarsi nella zona a ridosso del confine con lo Yemen, in particolare l'area dei valichi di frontiera. Tenuto conto delle possibilità di attività di pirateria nel Golfo di Aden, è sconsigliata la navigazione oltre le 12 miglia dalle coste omanite.";
    assert.equal(normalizeItLevel(general, area), 2);
  });

  it('Mozambique: "connazionali ivi presenti a qualsiasi titolo" scopes WHO the advice is for, not a travel ban -> 2 (from the Cabo Delgado avoidance verbs), not 4', () => {
    const general =
      'Il quadro di sicurezza nel Paese, perturbato negli ultimi mesi da disordini, si prevede resti volatile. Si raccomanda di adottare sempre norme di prudenza e di limitare gli spostamenti, specialmente nelle aree sub ed extra-urbane e nelle ore serali e notturne.';
    const area =
      'Tutta la Provincia di Cabo Delgado deve essere considerata ad alto rischio. Si raccomanda, quindi di evitare qualsiasi viaggio e permanenza nella Provincia di Cabo Delgado. Fa eccezione a questo sconsiglio generale, per il momento, solo il capoluogo Pemba. Di conseguenza, si suggerisce ai connazionali ivi presenti a qualsiasi titolo di adottare particolari cautele evitando assembramenti, manifestazioni e viaggi non essenziali fuori dal centro urbano.';
    assert.equal(normalizeItLevel(general, area), 2);
  });

  it('Guinea: "connazionali presenti a qualsiasi titolo" is not a ban (not 4), but "massima prudenza negli spostamenti" after the protest-violence paragraph is a real Level 2 caution (not 1)', () => {
    const general =
      'Il fenomeno della delinquenza comune ed organizzata è relativamente raro, tuttavia presente in tutta la Guinea. Con minore frequenza rispetto al passato, vengono talvolta indette manifestazioni nell’area della grande Conakry che possono sfociare in violenze urbane. Ai connazionali presenti a qualsiasi titolo nel Paese consigliamo la massima prudenza negli spostamenti, e costante monitoraggio dei mezzi informativi locali.';
    const area =
      'Si consiglia di evitare nella capitale le zone dei mercati, soprattutto in orari prossimi a quelli della chiusura. Sono stati segnalati episodi di banditismo, anche violenti, nelle zone di confine con la Guinea Bissau e il Senegal.';
    assert.equal(normalizeItLevel(general, area), 2);
  });

  it('Guinea (regression guard): the SAME dossier with "massima prudenza negli spostamenti" removed correctly falls all the way to 1 -- confirms hasMovementCaution, not some other pattern, is what promotes it to 2', () => {
    const general =
      'Il fenomeno della delinquenza comune ed organizzata è relativamente raro, tuttavia presente in tutta la Guinea. Con minore frequenza rispetto al passato, vengono talvolta indette manifestazioni nell’area della grande Conakry che possono sfociare in violenze urbane. Ai connazionali presenti a qualsiasi titolo nel Paese consigliamo di seguire gli sviluppi tramite i mezzi informativi locali.';
    const area =
      'Si consiglia di evitare nella capitale le zone dei mercati, soprattutto in orari prossimi a quelli della chiusura. Sono stati segnalati episodi di banditismo, anche violenti, nelle zone di confine con la Guinea Bissau e il Senegal.';
    assert.equal(normalizeItLevel(general, area), 1);
  });

  it('bare "massima prudenza"/"particolare attenzione" WITHOUT "spostamenti" is Farnesina\'s default petty-crime boilerplate, not a Level 2 signal (regression guard for the calibration set)', () => {
    // Denmark's real pickpocketing note, live 2026-09-26 -- verbatim except trimmed.
    const general =
      "Ai connazionali viene raccomandato di mantenere un atteggiamento ed un comportamento ispirati alla massima prudenza, soprattutto a Copenaghen, dove si sono recentemente verificati frequenti episodi di microcriminalità, in particolare borseggi ed aggressioni personali, ad opera di bande di giovani di minore età.";
    assert.equal(normalizeItLevel(general, ''), 1);
  });

  it('Mauritania: the level-4 ban in the Mali parenthetical aside is MALI\'s, not Mauritania\'s -> falls to 3 (from its own genuine "sconsigliati i viaggi nel deserto"), not 4', () => {
    const general =
      "Sono sconsigliate le zone di confine, in particolare ad est e a sud-est con il Mali, nonché la regione settentrionale tra Mauritania, Algeria e Sahara Occidentale. Sono sconsigliati i viaggi nel deserto, che non prevedano il ricorso ad Operatori di comprovata professionalità. Allo stato attuale, nella capitale Nouakchott si verificano raramente episodi di microcriminalità.";
    const area =
      "Dato il deterioramento della situazione di sicurezza nel vicino Mali, si sconsiglia vivamente di avvicinarsi alle frontiere con questo Paese. Eventuali trasferimenti via terra con il Mali (che resta, comunque, una destinazione sconsigliata a qualsiasi titolo) potrebbero avvenire solo attraverso il territorio senegalese.";
    assert.equal(normalizeItLevel(general, area), 3);
  });

  it('Cameroon: "a qualsiasi titolo" bans are scoped to the Far North and Adamaoua/East regions -> 2, not 4', () => {
    const general =
      'In tutto il Camerun, in particolare nelle città e nelle zone rurali, sussiste il rischio di scippi e rapine a mano armata. Evitare le zone isolate o meno sviluppate delle città.';
    const area =
      "Si sconsigliano quindi viaggi a qualsiasi titolo nell'intera ragione dell'Estremo Nord, nella provincia di Mayo Louti (Regione del Nord) e in tutte le aree di confine con la Nigeria e con il Ciad. Si raccomanda di evitare viaggi e spostamenti a qualsiasi titolo nella parte orientale del Camerun (Regioni Adamaoua e Est), situata al confine con la Repubblica Centrafricana.";
    assert.equal(normalizeItLevel(general, area), 2);
  });

  it('Iraq: "a qualsiasi titolo" targets the three Kurdistan Region provinces, not the whole country -> 3 (from the general section\'s own "sconsigliati i viaggi"), not 4', () => {
    const general =
      'Sono sconsigliati i viaggi nel Paese. Ai connazionali, che eventualmente si trovassero in Iraq e a coloro che intendessero effettuare viaggi, si consiglia massima cautela ed attenzione.';
    const area =
      "Regione Curda: si sconsigliano viaggi non necessari nel Kurdistan iracheno. Ai connazionali che, a qualsiasi titolo, dovessero decidere sotto la propria responsabilità di recarsi in una delle tre Province della Regione, si raccomanda di prendere contatto con il Consolato Generale d'Italia a Erbil.";
    assert.equal(normalizeItLevel(general, area), 3);
  });

  it('Afghanistan: genuine whole-country ban stays 4 ("viaggi a qualsiasi titolo in Afghanistan")', () => {
    const general =
      "Il 15 agosto 2021, i Talebani hanno ripreso il controllo dell'Afghanistan. Restano sconsigliati viaggi a qualsiasi titolo in Afghanistan. Sono, in particolare, sconsigliati i viaggi per turismo, sia autonomi, sia nell'ambito di tour organizzati.";
    const area =
      'I viaggi in Afghanistan sono sconsigliati a qualsiasi titolo. Sussiste il rischio di sequestri in tutto il territorio.';
    assert.equal(normalizeItLevel(general, area), 4);
  });

  it('Syria: genuine whole-country ban stays 4 ("viaggi a qualsiasi titolo nel Paese")', () => {
    const general =
      "Sono sconsigliati i viaggi a qualsiasi titolo nel Paese. Anche dopo il cambio di potere dell'8 dicembre 2024, la situazione di sicurezza rimane volatile. Il Governo centrale non ha assunto il pieno controllo sull'intero territorio nazionale.";
    const area =
      "In alcune porzioni di territorio, controllate da forze non governative, si sono verificati scontri gravi ma generalmente localizzati.";
    assert.equal(normalizeItLevel(general, area), 4);
  });

  it('Ukraine: genuine whole-country ban stays 4 ("tutti i viaggi verso l\'Ucraina, a qualsiasi titolo, sono assolutamente sconsigliati")', () => {
    const general =
      "In considerazione degli attuali attacchi nel Paese, diffusi su tutto il territorio nazionale, incluso nella capitale Kiev, tutti i viaggi verso l'Ucraina, a qualsiasi titolo, sono assolutamente sconsigliati. Ai connazionali ancora presenti nella capitale ucraina si raccomanda di esercitare massima cautela.";
    const area = "L'intero Paese è soggetto ad attacchi missilistici. Le aree interessate da attività cinetiche nel Sud e nell'Est del Paese sono soggette al fuoco costante dell'artiglieria.";
    assert.equal(normalizeItLevel(general, area), 4);
  });

  it('Somalia: genuine whole-country ban stays 4 ("sia i viaggi, sia la permanenza nel Paese, a qualsiasi titolo")', () => {
    const general =
      'Alla luce della persistente instabilità politica e della diffusa minaccia terroristica, si sconsigliano sia i viaggi, sia la permanenza nel Paese, a qualsiasi titolo. Le condizioni di sicurezza rimangono precarie.';
    const area =
      'Alcune zone della Somalia centro-meridionale rimangono sotto il controllo del Gruppo Al-Shabaab. In tali zone, il rischio resta massimo e se ne sconsiglia il transito e il soggiorno a qualsiasi titolo.';
    assert.equal(normalizeItLevel(general, area), 4);
  });

  it('Mali: genuine whole-country ban stays 4 ("viaggi, a qualsiasi titolo, verso il Mali")', () => {
    const general =
      'Si sconsigliano viaggi, a qualsiasi titolo, verso il Mali, Bamako inclusa. Il Mali è un Paese in guerra. Il principale rischio che corrono gli stranieri è di essere rapiti a scopo di estorsione da gruppi jihadisti.';
    const area =
      "Il Mali attraversa una delicata fase di conflitti interni. Si sconsigliano fortemente viaggi, a qualsiasi titolo, all'interno del Mali.";
    assert.equal(normalizeItLevel(general, area), 4);
  });

  it('Haiti: genuine whole-country ban stays 4 ("in qualunque zona del Paese")', () => {
    const general =
      "Si sconsigliano assolutamente viaggi ad Haiti, in qualunque zona del Paese. La situazione di sicurezza ad Haiti è tesa ed instabile, alla luce dell'incertezza politica e del clima di violenza imposto dalle gang.";
    const area =
      'Alcune zone della capitale presentano un indice di insicurezza particolarmente elevato e sono assolutamente da evitare se non per comprovati motivi di necessità.';
    assert.equal(normalizeItLevel(general, area), 4);
  });

  it('North Korea: genuine whole-country ban stays 4 ("preclusa la possibilita\' di recarsi nel Paese")', () => {
    const general =
      "I viaggi non essenziali in Corea del Nord sono sconsigliati. Ai cittadini italiani resta inoltre momentaneamente preclusa la possibilità di recarsi nel Paese. Si segnala che le Ambasciate europee a Pyongyang sono, al momento, chiuse.";
    const area =
      "I viaggi non essenziali in Corea del Nord sono sconsigliati. Ai cittadini italiani resta inoltre momentaneamente preclusa la possibilità di recarsi nel Paese.";
    assert.equal(normalizeItLevel(general, area), 4);
  });

  it('DR Congo: "in ragione della situazione" is "by reason of" (not a place) and must not block the genuine whole-country Level 3 -> 3, not 2', () => {
    const general =
      'In ragione della situazione di sicurezza, soggetta al rischio di repentino deterioramento, si invitano i connazionali a rimandare qualsiasi viaggio verso la Repubblica Democratica del Congo. A coloro già presenti nel Paese si raccomanda fortemente di valutare un rientro in Italia con i mezzi commerciali disponibili.';
    const area =
      'Conflitti a bassa intensità persistono in alcune regioni della RDC. Nel Nord e nel Sud Kivu la situazione é in costante deterioramento.';
    assert.equal(normalizeItLevel(general, area), 3);
  });

  it('Iran: "instabilita\' regionale" (the wider Middle East) is not a sub-national marker and must not block the genuine whole-country Level 3 -> 3, not 2', () => {
    const general =
      "Il precario quadro di sicurezza regionale non consente di escludere eventi ostili che interessino anche il territorio iraniano. Le differenze significative nelle normative, insieme all'instabilità regionale, portano a sconsigliare qualsiasi viaggio in Iran.";
    // Note: this "a qualsiasi titolo" ban is ALSO caught by the border-marker guard ("frontiere"),
    // same as Armenia/Oman above -- it never reaches the Level-4 check either way. What this
    // test asserts is narrower: the GENERAL section's "instabilità regionale" wording must not
    // itself suppress the (still-genuine, whole-country) Level 3 from "sconsigliare qualsiasi
    // viaggio in Iran".
    const area =
      'Premesso che i viaggi nel Paese, a qualsiasi titolo, rimangono sconsigliati, ai connazionali già presenti in Iran, si raccomanda di evitare le aree a ridosso delle frontiere con Iraq, Afghanistan e Pakistan.';
    assert.equal(normalizeItLevel(general, area), 3);
  });

  it('Lebanon: "tensioni regionali" (the wider Middle East) is not a sub-national marker and must not block the genuine whole-country Level 3 -> 3, not 2', () => {
    const general =
      'La situazione in Libano resta instabile e imprevedibile, anche in considerazione delle crescenti tensioni regionali; si invitano i connazionali a rinviare i viaggi nel Paese che non siano dettati da ragioni di necessità, di lavoro o di affari.';
    const area =
      'Beirut: è altamente sconsigliato recarsi nella periferia sud di Beirut. Zone di confine con la Siria: sono sconsigliati tutti i viaggi nelle zone di confine con la Siria.';
    assert.equal(normalizeItLevel(general, area), 3);
  });

  it('Japan (real calm sentence, part of the file\'s own 13-country calibration set): "Paese sicuro"/"normali precauzioni", no avoidance verb anywhere -> 1 via the fallback, confirming it is correct to KEEP that fallback rather than switch to an "affirmed calm only" rule', () => {
    // Verbatim, live 2026-09-26.
    const general =
      "Sebbene il Giappone sia ritenuto un Paese sicuro, è sempre opportuno usare le normali precauzioni, a salvaguardia della propria sicurezza. Nelle aree della vita notturna delle grandi città si registrano occasionalmente truffe e rapine a danno di turisti.";
    assert.equal(normalizeItLevel(general, ''), 1);
  });
});
