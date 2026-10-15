import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import { normalizeRsLevel, extractRsSecuritySection } from '../normalize/advisory-levels.js';

/**
 * Regression coverage for the 2026-09-25 RS (Serbia MFA) repair, second pass
 * (SOURCE-REPAIR-BRIEF.md). The first pass that day (audit comment above
 * normalizeRsLevel) fixed the ESCALATED end — RS's real severe-case phrasing
 * ("advised to refrain from all travel to Israel") matched no old keyword —
 * but left the function with NO path to Level 1 at all: any calm country
 * fell through to the closing `return null`. A live production run measured
 * this at 97/183 countries (~53% of the source) before this fix; the
 * fixtures below (Switzerland, Canada, China, Japan) are the real excerpts
 * that exposed it, pulled from the live mfa.gov.rs pages on 2026-09-25.
 *
 * Also added: "advised not to travel" (Ukraine) as a Level-4 wording variant
 * of the already-handled "refrain from (all/any) travel" family.
 */

describe('normalizeRsLevel (RS/MFA "SECURITY SITUATION" section)', () => {
  it('never guesses on unmatched text (rule 1: emit nothing, do not default to 1 OR any other level)', () => {
    assert.equal(normalizeRsLevel(''), null);
    // USA: a real, specific concern (terrorism target awareness, drug-related crime near the
    // Mexican border) that nonetheless matches none of the 4/3/2/1 keyword families -- null is
    // the honest answer, not a guess either way.
    const usa =
      'Visitors should be aware that the United States could be a target of terrorist attacks. Crime is present in most cities, more specifically, in certain neighbourhoods which are considered less safe. A matter of particular concern is drug-related crime which prevails in the U.S. states bordering Mexico.';
    assert.equal(normalizeRsLevel(usa), null);
  });

  it('Ukraine: "advised not to travel to Ukraine due to the war situation" -> Level 4', () => {
    const text =
      'Citizens of the Republic of Serbia are advised not to travel to Ukraine due to the war situation in the country. The state of war has been extended until the end of August 2025, and a curfew is in effect from midnight to 5 a.m.';
    assert.equal(normalizeRsLevel(text), 4);
  });

  it('Germany: "increased level of security risk from terrorist attacks" -> Level 2 (unaffected by the repair, existing keyword)', () => {
    const text =
      'After the terrorist attacks in 2016 and 2017, Germany was placed among countries with increased level of security risk from terrorist attacks. Security measures are applied on daily basis and increased during large gatherings.';
    assert.equal(normalizeRsLevel(text), 2);
  });

  it('Switzerland: "the security situation ... is good. There is relatively little crime." -> Level 1, not null', () => {
    const text =
      'The security situation in Switzerland is good. There is relatively little crime. Contacts with the police are at the cantonal level.';
    assert.equal(normalizeRsLevel(text), 1);
  });

  it('Canada: "high security level in the whole territory" -> Level 1, and is NOT confused with "high level of <risk/crime>" (a caution, Level 2 since the 2026-10-15 repair -- it used to be a bare "high level" -> 3 keyword)', () => {
    const text =
      'There is a high security level in the whole territory of Canada. Crime in Canada is mostly concentrated in major cities. There are thefts, car break-ins and the like, but very rarely.';
    assert.equal(normalizeRsLevel(text), 1);
    // A high level of a RISK is a reason for caution, not a recommendation to avoid travel: Level 2.
    // (Until 2026-10-15 any "high level" read as Level 3; every live hit of that keyword was a calm or
    // non-advisory sentence -- see the outlier-audit tests below.)
    assert.equal(normalizeRsLevel('There is a high level of petty crime in the tourist areas.'), 2);
  });

  it('China: terse "High-level security." (hyphenated) -> Level 1', () => {
    assert.equal(normalizeRsLevel('High-level security.'), 1);
  });

  it('Japan: "high degree of public peace and order ... low crime rate" -> Level 1', () => {
    const text =
      'Japan is a country with a high degree of public peace and order, without a risk of armed conflict and with a low crime rate compared to other developed countries.';
    assert.equal(normalizeRsLevel(text), 1);
  });

  it('Greece: a calm "is good" clause AND a real caution clause in the same section -> Level 2 wins (checked before the Level-1 fallback, never downgraded by it)', () => {
    const text =
      'The overall security situation in Greece is good. Due to the austerity measures of the Government of Greece, protests are frequent in large cities. Serbian citizens are advised to exercise caution due to the potential risk of theft, particularly during tourist season.';
    assert.equal(normalizeRsLevel(text), 2);
  });

  // Repair 2026-09-26 (PARSER-REGIONAL-BRIEF spot check): a REGIONAL "refrain from travel"
  // sentence was wrongly promoting the whole country to Level 4 -- found on Panama.
  it('Panama: "refrain from traveling to the Caribbean province of Bocas del Toro" (a single province) is NOT a whole-country Level 4 -- falls through to the section\'s own Level 2 crime-caution text', () => {
    const text =
      "Citizens of the Republic of Serbia are advised to refrain from traveling to the Caribbean province of Bocas del Toro in the Republic of Panama until further notice. In recent times, this area has seen violent protests and road blockades. The crime rate in Panama is high, and travellers are advised to exercise a high degree of caution.";
    assert.equal(normalizeRsLevel(text), 2);
  });

  it('Panama-shaped regional warning with NO other section content at all -> capped at 2, never null and never the regional 4', () => {
    const text =
      'Citizens of the Republic of Serbia are advised to refrain from traveling to the border region of a neighbouring country until further notice.';
    assert.equal(normalizeRsLevel(text), 2);
  });

  it('Israel: "refrain from all travel to Israel" (the country itself, not a region) -> still Level 4, unaffected by the Panama fix', () => {
    const text =
      'Due to the deterioration of the security situation following the outbreak of hostilities, citizens of the Republic of Serbia are advised to refrain from all travel to Israel until further notice.';
    assert.equal(normalizeRsLevel(text), 4);
  });

  it('Jordan: "refrain from any type of travel to Jordan" -> still Level 4', () => {
    const text =
      'Due to the deterioration of the security situation and hostilities in the Middle East region, a warning and recommendation is given that citizens of the Republic of Serbia should refrain from any type of travel to Jordan until further notice.';
    assert.equal(normalizeRsLevel(text), 4);
  });

  it('Palestine: "refrain from traveling to this country" -- "State of Palestine" appears earlier in the SAME sentence, but the object right after "to" is the generic "this country", not "State" -> still Level 4 (guards against a naive sentence-wide regional-word scan)', () => {
    const text =
      'Due to the deteriorating security situation in the State of Palestine, caused by the ongoing war, citizens of the Republic of Serbia are advised to refrain from traveling to this country.';
    assert.equal(normalizeRsLevel(text), 4);
  });
});

describe('extractRsSecuritySection', () => {
  it('returns null when the page has no "SECURITY SITUATION" heading at all (different template)', () => {
    assert.equal(extractRsSecuritySection('Some unrelated visa and entry-requirement page text.'), null);
  });

  it('scopes to the section, excluding the next 2+-word ALL-CAPS heading (real Canada excerpt)', () => {
    const body =
      'VISA REGIME — Serbian citizens do not need a visa.SECURITY SITUATION — There is a high security level in the whole territory of Canada.VISA INFORMATION — More entry-requirement text.';
    const section = extractRsSecuritySection(body);
    assert.ok(section?.includes('high security level'));
    assert.ok(!section?.includes('entry-requirement'));
  });

  it('a single-WORD ALL-CAPS heading like the real "TRANSPORT —" bounds the section (was a documented KNOWN GAP until the 2026-10-15 repair: the heading\'s road/rail content bled into the security text)', () => {
    const body =
      'SECURITY SITUATION — There is a high security level in the whole territory of Canada.TRANSPORT — Penalties for non-compliance with traffic regulations are extremely strict.';
    const section = extractRsSecuritySection(body);
    assert.ok(section?.includes('high security level'));
    assert.ok(!section?.includes('Penalties for non-compliance'));
  });

  it('an EN dash heading ("TRANSPORT –", 37 live pages) bounds the section too (real Egypt excerpt)', () => {
    const body =
      'SECURITY SITUATION – The security situation is relatively stable. Particular attention is given to tourist destinations, having in mind that AR Egypt is one of the most visited countries in the world. TRANSPORT – The international airports are Cairo, Alexandria, Hurghada, Sharm El Sheikh, Aswan.Railway transport is well developed, but it is not recommended to be used for tourism.';
    const section = extractRsSecuritySection(body);
    assert.ok(section?.includes('relatively stable'));
    assert.ok(!section?.includes('Railway transport'));
    // The leaked railway tip used to make Egypt a whole-country Level 3; the real section carries no
    // level keyword at all, so the honest answer is null (never a guess).
    assert.equal(normalizeRsLevel(section ?? ''), null);
  });

  it('does not end the section at acronyms: glued hyphens ("COVID-19", "HIV-positive") and 3-letter ones ("USD -")', () => {
    const body =
      'SECURITY SITUATION — Citizens are advised to exercise caution. COVID-19 measures were lifted; HIV-positive travellers need no permit; prices in USD - and local currency apply. TRANSPORT — Buses run daily.';
    const section = extractRsSecuritySection(body);
    assert.ok(section?.includes('prices in USD'));
    assert.ok(!section?.includes('Buses run daily'));
  });
});

/**
 * 2026-10-15 advisory-outlier audit: RS reported Level 3 ("avoid non-essential travel") for Argentina,
 * Botswana, Marshall Islands, Namibia, Netherlands, Portugal and Sao Tome and Principe while 14-19 other
 * governments said Level 1. Three rules were wrong (see normalizeRsLevel's 2026-10-15 repair note):
 * the section ran on into the TRANSPORT heading, "not recommended" personal-safety tips read as a
 * whole-country travel verdict, and "high level" matched calm prose. Every excerpt below is verbatim
 * from the live English page (cross-checked against the Serbian original) on 2026-10-15; the two HTML
 * fixtures are trimmed copies of the real markup, parsed exactly like fetchRsAdvisories does.
 */
describe('normalizeRsLevel: 2026-10-15 outlier audit', () => {
  const FIXTURES_DIR = join(process.cwd(), 'src', 'pipeline', '__tests__', 'fixtures');
  const levelOfPage = (file: string) => {
    const $ = cheerio.load(readFileSync(join(FIXTURES_DIR, file), 'utf-8'));
    const section = extractRsSecuritySection($('body').text());
    return { section, level: section === null ? null : normalizeRsLevel(section) };
  };

  it('Portugal (real markup): "one of the safest countries in Europe" -> 1; the TRANSPORT section\'s "Alfa Pendular (high level of service ...)" is no longer part of the security text', () => {
    const { section, level } = levelOfPage('rs-portugal.html');
    assert.ok(section?.includes('one of the safest countries in Europe'));
    assert.ok(!section?.includes('high level of service'));
    assert.equal(level, 1);
  });

  it('Sao Tome and Principe (real markup): "Security ... is relatively good and the risk of incidents is generally low" -> 1; TRANSPORT\'s "Driving at night is not recommended" stays out', () => {
    const { section, level } = levelOfPage('rs-sao-tome-and-principe.html');
    assert.ok(!section?.includes('Driving at night'));
    assert.equal(level, 1);
  });

  it('Argentina: "not recommended" personal-safety tips are a caution (2), never a whole-country Level 3', () => {
    const text =
      'Serbian citizens travelling to or staying in Argentina are advised to move in groups, to avoid staying out late, not to carry valuables with them, and to carry copies of travel documents. In case of any problems, the police should be contacted at 911.The security situation in the city of Buenos Aires is not risky, but Serbian citizens are advised to adhere to the above security measures as a precaution.There are criminal groups involved in smuggling near the borders, primarily with Brazil and Paraguay.Crime in Buenos Aires and larger cities is at the level standard (expected) for large city centres. It is not recommended to wear valuable jewellery and watches. It is not recommended that minors and adolescents travel alone.';
    assert.equal(normalizeRsLevel(text), 2);
  });

  it('Botswana: "advised to exercise additional caution" + "Individual movement in unsafe zones is not recommended" -> 2', () => {
    const text =
      'When traveling to Botswana, citizens of the Republic of Serbia are advised to exercise additional caution, given the increase in petty crime, particularly in city cores. Individual movement in unsafe zones is not recommended, particularly during evening hours.';
    assert.equal(normalizeRsLevel(text), 2);
  });

  it('Namibia: "relatively safe country ... Walking at night is not recommended" -> 2 (the "caution should be exercised" sentence), not 3', () => {
    const text =
      'Namibia is a relatively safe country, considering that it is a popular tourist destination. During the stay, standard precautionary measures are recommended, with a warning regarding possible theft. In crowded areas (shopping malls, local markets, etc.), caution should be exercised due to pickpocketing and robbery. Walking at night is not recommended, as well as going to poor neighborhoods outside the city or resort. If you travel to Namibia through a travel agency, it is advisable to check the reliability of everyone involved in the service chain.';
    assert.equal(normalizeRsLevel(text), 2);
  });

  it('Marshall Islands: "relatively high level of safety ... generally safe for living and traveling" -> 1 (was 3 through the bare "high level" keyword)', () => {
    const text =
      'The Marshall Islands enjoy a relatively high level of safety. With low crime rates and a stable political environment, the country is generally safe for living and traveling. Nevertheless, personal safety and safeguarding valuables should be observed.';
    assert.equal(normalizeRsLevel(text), 1);
  });

  it('Netherlands: "generally a safe country" + the national terrorism threat level ("a high level of risk of terrorist attacks was declared at the state level") -> 2, like Germany\'s "increased level of security risk"', () => {
    const text =
      'The Netherlands is generally a safe country, where the biggest problem is petty crime and pickpocketing, especially in larger cities like Amsterdam. A high level of risk of terrorist attacks was declared at the state level, as a result of the presence of Dutch soldiers in Afghanistan and the country’s support to military intervention in Iraq.';
    assert.equal(normalizeRsLevel(text), 2);
  });

  it('Morocco: "security is at a high level" is a calm statement -> 1 (was 3)', () => {
    const text =
      'In Morocco, security is at a high level.There is a danger of pickpocketing and theft, especially in tourist places, and where a large number of people gather.Also, stopping on the roads, regardless of the time of day, outside populated areas, should be avoided, due to the danger of attack and robbery.';
    assert.equal(normalizeRsLevel(text), 1);
  });

  it('Gabon: "security is generally good, BUT the risk of robberies, armed attacks ... should not be ruled out" is not a calm statement (no level keyword at all -> null, never a guessed 1)', () => {
    const text =
      'In Libreville and other cities, security is generally good, but the risk of robberies, armed attacks, and harassment should not be ruled out. It is recommended to avoid the outskirts of the city, especially in the evening hours, and not to carry large amounts of cash or jewelry while moving around the city.';
    assert.equal(normalizeRsLevel(text), null);
  });

  it('REGIONAL "not recommended/not advised" travel is capped at 2 (Armenia, Ecuador, Uganda -- the doctrine the 2026-09-26 Panama fix applied to Level 4)', () => {
    assert.equal(
      normalizeRsLevel('Armenia is generally a safe country. The land border with Azerbaijan is closed, so as a precaution, travel to the border areas towards Azerbaijan is not advised.'),
      2,
    );
    assert.equal(
      normalizeRsLevel("Crime is widespread throughout Ecuador. Travel is not recommended to the cities of Huaquillas and Arenillas in El Oro province, the cities of Quevedo, Quinsaloma, and Pueblo Viejo in Los Rios province."),
      2,
    );
    assert.equal(
      normalizeRsLevel('In the capital city of Kampala, the security situation is stable and without major risks. There is a potential danger of theft, pickpocketing, fraud, and other minor crimes. Travel to the northern part of the country is not recommended because of the activities of rebel groups.'),
      2,
    );
  });

  it('genuine whole-country "travel to <country> is not recommended" stays Level 3 (CAR, Iraq, Oman, Chad, Somalia, Mali)', () => {
    const cases = [
      "Travelling to the Central African Republic is not recommended because of its continual unstable military and political situation, the activities of illegal armed groups which control most of the country's territory, as well as serious crime.",
      'Due to the deteriorated security situation, citizens of the Republic of Serbia are not recommended to travel in the coming period to Iraq.',
      'Due to the deterioration of the security situation in the region, travel to Oman is not recommended.',
      'Considering the deterioration of the current security situation in Chad, Serbian citizens are advised against traveling to this country. It is particularly necessary to avoid the Lake Chad region due to terrorism.',
      'The security situation has been unstable for decades, further deteriorating due to the continuous activities of the Al-Shabaab terrorist organisation. We do not advise citizens of the Republic of Serbia to travel to Somalia, unless in dire need.',
      'Owing to the currently unstable situation in the country, especially in terms of security, it is not recommended to travel or move around the territory of Mali until further notice.',
    ];
    for (const text of cases) assert.equal(normalizeRsLevel(text), 3, text);
  });

  it('country names that contain a sub-national noun are still whole-country destinations (United States, Marshall Islands, Ivory Coast, South Sudan)', () => {
    for (const country of ['the United States', 'the Marshall Islands', 'the Ivory Coast', 'South Sudan', 'Vatican City']) {
      assert.equal(normalizeRsLevel(`Travel to ${country} is not recommended until further notice.`), 3, country);
    }
  });

  it('Iran: "All those who are in Iran are recommended to leave the country as soon as possible" -> 4 (evacuation advice, like "leave immediately"); customs prose about "leaving the country" is not', () => {
    const text =
      'Due to the deteriorating security situation, citizens of the Republic of Serbia are not recommended to travel to Iran in the coming period. All those who are in Iran are recommended to leave the country as soon as possible.';
    assert.equal(normalizeRsLevel(text), 4);
    assert.equal(
      normalizeRsLevel('Foreigners residing in Iran for work must obtain an exit visa when leaving the country. The security situation in the country is good.'),
      1,
    );
  });

  it('Haiti: "The security situation is unfavourable. It is not recommended to move outside the areas intended for foreigners" -> 2: a movement restriction inside the country, not advice against travelling to it (RS states no travel recommendation for Haiti)', () => {
    const text =
      'The security situation is unfavourable. It is not recommended to move outside the areas intended for foreigners, considering the danger of theft, attack, even kidnapping.';
    assert.equal(normalizeRsLevel(text), 2);
  });
});
