import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizeEsLevel } from '../normalize/advisory-levels.js';

/**
 * Regression coverage for the 2026-09-25 ES (Spain Exteriores) repair
 * (SOURCE-REPAIR-BRIEF.md, second pass). The first production run of the
 * original ES repair (commit 83a6475e) found Central African Republic --
 * an active "leave the country" evacuation order -- reporting Level 1 live.
 *
 * Root cause was NOT the zero-width space the page's "Notas importantes"
 * banner happens to start with (normalizeAdvisoryText already stripped
 * that); it was a text-extraction artifact shared with Italy's parser:
 * `$('body').text().replace(/\s+/g, ' ')` concatenates sibling DOM block
 * elements with no separator, so "...LO ANTES POSIBLE.Se sugiere..." glues
 * two sentences into one. splitIntoSentences() then read the WHOLE glued
 * blob as a single "sentence", and an unrelated nighttime-curfew "de noche"
 * aside three sentences further into that merged blob tripped
 * ES_ZONE_MARKERS, zone-scoping (and so suppressing) the real, unscoped
 * evacuation banner earlier in the same string. Fixed in
 * normalizeAdvisoryText() by inserting a space between a >=4-letter word,
 * a sentence-ending punctuation mark, and an immediately-following capital
 * letter -- see that function's own comment for why the CAF banner (in ALL
 * CAPS) needed a >=4-letter gate rather than a "preceded by lowercase" one.
 *
 * The same production run's `check-advisory-quality.ts` monitor also flagged
 * six Gulf/Middle-East states (Arabia Saudí, Bahréin, Catar, Jordania, Omán,
 * plus EAU/Kuwait found during the same sweep) stuck on Level 1 despite a
 * real, live "SE ACONSEJA APLAZAR SU VIAJE A <país>" (postpone your trip)
 * banner -- a wording gap, not a text-extraction one: LEVEL3_PATTERNS never
 * had an entry for it. Fixtures below are VERBATIM excerpts (the "Notas
 * importantes" banner text, tag-free -- this is what fetchEsAdvisories
 * actually hands to normalizeEsLevel) pulled from the live exteriores.gob.es
 * per-country detail pages on 2026-09-25.
 */

describe('normalizeEsLevel (ES/Exteriores "Notas importantes" banner)', () => {
  it('never guesses on an absent/too-short notice (rule 1: emit nothing, do not default to 1)', () => {
    assert.equal(normalizeEsLevel(''), null);
    assert.equal(normalizeEsLevel('   '), null);
    assert.equal(normalizeEsLevel('corto'), null);
  });

  it('Central African Republic: whole-country evacuation banner glued (no space) to the next paragraph -> Level 4, not 1', () => {
    // Verbatim: the ZWSP right after the heading, the ALL-CAPS banner, and the "POSIBLE.Se
    // sugiere" / "viaje.Información" glue points are all exactly as fetched, 2026-09-25.
    const notas =
      ' ​SE DESACONSEJA EL VIAJE BAJO CUALQUIER CIRCUNSTANCIA Y SE RECOMIENDA A LOS ESPAÑOLES QUE SE ENCUENTREN EN EL PAIS QUE LO ABANDONEN LO ANTES POSIBLE.Se sugiere leer con atención el resto de las recomendaciones de viaje.Información sobre la situación de seguridadAunque se ha retirado el toque de queda oficial, se recomienda encarecidamente no estar en la calle desde que se hace de noche, limitar los desplazamientos en Bangui a los estrictamente esenciales y se desaconseja viajar fuera de la capital. Continúan produciéndose episodios violentos contra la población civil.';
    assert.equal(normalizeEsLevel(notas), 4);
  });

  it('Saudi Arabia: "SE ACONSEJA APLAZAR SU VIAJE A ARABIA SAUDÍ, SALVO QUE SEA NECESARIO" -> Level 3, not 1', () => {
    const notas =
      ' El espacio aéreo de Arabia Saudí se encuentra abierto.Se aconseja aplazar viaje hasta nuevo aviso.LA REGIÓN DE ORIENTE PRÓXIMO SE ENCUENTRA AFECTADA POR UN CONFLICTO DE ALCANCE REGIONAL. SE ACONSEJA APLAZAR SU VIAJE A ARABIA SAUDÍ, SALVO QUE SEA NECESARIO.Para los ciudadanos españoles que se encuentren en Arabia Saudí que deseen abandonar el país, existen opciones de vuelos comerciales activos.';
    assert.equal(normalizeEsLevel(notas), 3);
  });

  it('Jordan: same banner without the "salvo que sea necesario" exception clause -> still Level 3 (the LEVEL3_PATTERNS match is whole-notice, not gated on ES_EXCEPTION_MARKER)', () => {
    const notas =
      ' Espacio aéreo abierto.Se aconseja aplazar viaje hasta nuevo aviso.LA REGIÓN DE ORIENTE PRÓXIMO SE ENCUENTRA EN LA ACTUALIDAD AFECTADA POR UN CONFLICTO DE ALCANCE REGIONAL. SE ACONSEJA APLAZAR SU VIAJE A JORDANIA HASTA NUEVO AVISO.Para los ciudadanos españoles que se encuentren en Jordania en estos momentos se recomienda, a los que así lo deseen, abandonar el país por los medios disponibles.';
    assert.equal(normalizeEsLevel(notas), 3);
  });

  it('Cuba: a substantive notice (energy crisis, shuttered hotels, daily protests) using none of Spain\'s fixed severity verbs -> null, not a guessed 1', () => {
    // Real excerpt, 2026-09-25 -- proof that "nothing matched" is not the same as "no warning"
    // for this source (see the calibration note above normalizeEsLevel).
    const notas =
      ' En estos momentos Cuba padece una grave crisis energética que provoca recurrentemente y por todo el país prolongados cortes de luz y de agua, en ocasiones de más de 24 horas, así como una casi total carencia de diésel y gasolina. La mayoría de los hoteles, en especial fuera de La Habana, han sido temporalmente cerrados. En algunos barrios de La Habana y varias localidades del país se están registrando diariamente protestas ciudadanas por la situación.';
    assert.equal(normalizeEsLevel(notas), null);
  });

  it('Germany: "NO HAY RESTRICCIONES ESPECÍFICAS" -> Level 1 (the one explicit all-clear, unaffected by the repair)', () => {
    const notas =
      ' NO HAY RESTRICCIONES ESPECÍFICAS RELATIVAS A VIAJES A ESTE PAÍS. Se sugiere leer con atención el resto de estas recomendaciones de viaje.';
    assert.equal(normalizeEsLevel(notas), 1);
  });

  it('Morocco: "SE RECOMIENDA VIAJAR CON PRECAUCIÓN" -> Level 2, and does not false-positive on the new "aplazar" pattern (it is absent from this page)', () => {
    const notas =
      ' SE RECOMIENDA VIAJAR CON PRECAUCIÓN. Lea con atención el resto de estas recomendaciones de viaje. España dispone de Consulados Generales en Casablanca, Agadir, Nador, Larache, Rabat, Tánger y Tetuán.';
    assert.equal(normalizeEsLevel(notas), 2);
  });

  it('Ethiopia: "SE RECOMIENDA VIAJAR CON MUCHA PRECAUCIÓN" -> Level 3 (unaffected by the repair, existing pattern)', () => {
    const notas =
      ' SE RECOMIENDA VIAJAR CON MUCHA PRECAUCIÓN Y ABSTENERSE DE HACERLO POR DETERMINADAS ZONAS. ÚLTIMA HORA: Se ha producido un grave deterioro de la situación de seguridad en la región de Tigray.';
    assert.equal(normalizeEsLevel(notas), 3);
  });

  it('Iran: "SE DESACONSEJA COMPLETAMENTE VIAJAR A IRÁN" -> Level 4 (unaffected by the repair, existing pattern)', () => {
    const notas =
      ' ANTE EL CONTEXTO DE CONFLICTO REGIONAL, SE DESACONSEJA COMPLETAMENTE VIAJAR A IRÁN.Si se encuentra usted en Irán, debe permanecer en su domicilio tratando de reducir al máximo sus desplazamientos.';
    assert.equal(normalizeEsLevel(notas), 4);
  });

  /**
   * Regression coverage for the 2026-09-26 regional-promotion repair
   * (isitsafetotravel.org-audit/2026-09-25/PARSER-REGIONAL-BRIEF.md). Five countries were found
   * promoted to a whole-country Level 4 by wording ES_ZONE_MARKERS' fixed phrase list didn't
   * recognize as zone-scoped, plus one unrelated double-negation bug the fix exposed. Fixtures
   * are VERBATIM excerpts from the live "Notas importantes" banner, fetched 2026-09-26.
   */

  it('Azerbaijan: the heading "ZONAS A LAS QUE SE RECOMIENDA NO VIAJAR" (introducing a list of named districts) has no separating period before the next paragraph -> 2, not 4', () => {
    const notas =
      ' SE RECOMIENDA VIAJAR CON PRECAUCIÓN Y ABSTENERSE DE HACERLO POR DETERMINADAS ZONAS. ZONAS A LAS QUE SE RECOMIENDA NO VIAJAR Desde la Declaración de paz de Washington del 8 de agosto de 2025, Azerbaiyán y Armenia continúan avanzando en el proceso de normalización de sus relaciones. Por este motivo, se recomienda evitar los desplazamientos a las áreas próximas a la frontera. ZONAS A LAS QUE SE RECOMIENDA NO VIAJAR EXCEPTO NECESIDADEsta recomendación se aplica a las regiones o “rayons” de Kelbajar, Loachin, Qubadli, Zengilan, Jabrayil, Fuzuli, Khojavand, Shusha, Khojali, Khankendi, Aghdam y Tartar. EL RESTO DE LAS ZONAS DE AZERBAIYÁN SON CONSIDERADAS SEGURAS PARA VIAJAR.';
    assert.equal(normalizeEsLevel(notas), 2);
  });

  it('Azerbaijan: "SI BIEN NO SE DESACONSEJA TOTALMENTE su uso por pasajeros" (Caspian Sea ferries) is a NEGATED "desaconseja", not a ban -> does not by itself produce Level 4', () => {
    const notas =
      ' SE RECOMIENDA VIAJAR CON PRECAUCIÓN Y ABSTENERSE DE HACERLO POR DETERMINADAS ZONAS. Los barcos que operan están pensados, fundamentalmente, para el tráfico de mercancías por lo que - si bien no se desaconseja totalmente su uso por pasajeros - hay que tener presente que los viajes no son predecibles en cuanto a duración ni frecuencia.';
    assert.equal(normalizeEsLevel(notas), 2);
  });

  it('Cameroon: "se desaconseja viajar a la PENÍNSULA de Bakassi" names a specific peninsula, not the whole country -> 3 (from the "extrema precaución" banner), not 4', () => {
    const notas =
      ' SE RECOMIENDA VIAJAR CON EXTREMA PRECAUCIÓN Y ABSTENERSE DE HACERLO EN LAS REGIONES NOROESTE, SUDOESTE Y EXTREMO NORTE, ASÍ COMO EN LAS ZONAS FRONTERIZAS. El Golfo de Guinea recibe gran atención por el problema existente con la piratería. Se desaconseja viajar a la península de Bakassi, así como tomar el ferry de Tiko o Limbe hacia Nigeria por el importante riesgo de ataques de piratería.';
    assert.equal(normalizeEsLevel(notas), 3);
  });

  it('Algeria: "se recomienda NO viajar a LA ZONA" (the Tindouf Sahrawi refugee camps, named earlier in the same sentence) is anaphoric zone-scoping, not a whole-country ban -> 2, not 4', () => {
    const notas =
      ' SE RECOMIENDA VIAJAR CON PRECAUCIÓN Y ABSTENERSE DE HACERLO POR DETERMINADAS ZONAS. Ante la posibilidad de secuestros y atentados contra españoles en los campamentos saharauis de Tinduf, se recomienda NO viajar a la zona y que todos los viajeros españoles cuya presencia no sea imprescindible la abandonen en cuanto sea posible.';
    assert.equal(normalizeEsLevel(notas), 2);
  });

  it('Nepal: "se desaconseja viajar a LA ZONA del siniestro" (named flood-affected districts) is anaphoric zone-scoping, not a whole-country ban -> 2 (from the plain caution banner), not 4', () => {
    const notas =
      ' SE RECOMIENDA VIAJAR CON PRECAUCIÓN Y ABSTENERSE DE HACERLO POR DETERMINADAS ZONAS. Como consecuencia de las inundaciones ocurridas en el país se desaconseja viajar a la zona del siniestro (Rasuwa, Gorkha, Nuwakot y Dhading así como zonas situadas a lo largo de los ríos Bhota Koshi y Trishuli). La situación está en constante evolución.';
    assert.equal(normalizeEsLevel(notas), 2);
  });

  it('Togo: "(se recomienda no viajar)" is a parenthetical inside a sentence already scoped to "zonas de riesgo" / the Triple-Border area -> 2 (from the plain caution banner), not 4', () => {
    const notas =
      ' SE RECOMIENDA VIAJAR CON PRECAUCIÓN Y ABSTENERSE DE HACERLO POR DETERMINADAS ZONAS. Son zonas de riesgo muy alto (se recomienda no viajar) las zonas de las Triples Fronteras (Burkina/Togo/Benín y Burkina/Togo/Ghana), así como el paso fronterizo en Cinkassé y en Mandouri. Es zona de riesgo alto (se recomienda no viajar salvo razón imperiosa) la región de Savanes, donde el gobierno togolés ha declarado estado de urgencia desde 2022.';
    assert.equal(normalizeEsLevel(notas), 2);
  });

  it('Togo: "se recomienda EXTREMAR LA PRECAUCIÓN y adoptar medidas de HIGIENE" (a Sanidad/hygiene tip) must not count as the security "extrema precaución" whole-country intensifier -> 2, not 3', () => {
    const notas =
      ' SE RECOMIENDA VIAJAR CON PRECAUCIÓN Y ABSTENERSE DE HACERLO POR DETERMINADAS ZONAS. Para viajar a Togo es obligatorio contar con la pauta de la fiebre amarilla. Se recomienda extremar la precaución y adoptar medidas de higiene, lavarse frecuentemente las manos y vigilar el consumo de alimentos frescos.';
    assert.equal(normalizeEsLevel(notas), 2);
  });

  it('Ethiopia (regression guard): "mucha precaución... por determinadas zonas" is STILL the whole-country Level 3 banner even though it mentions "zonas" -- the intensity check is deliberately not zone-gated', () => {
    const notas =
      ' SE RECOMIENDA VIAJAR CON MUCHA PRECAUCIÓN Y ABSTENERSE DE HACERLO POR DETERMINADAS ZONAS. ÚLTIMA HORA: Se ha producido un grave deterioro de la situación de seguridad en la región de Tigray.';
    assert.equal(normalizeEsLevel(notas), 3);
  });
});
