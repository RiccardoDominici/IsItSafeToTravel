import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
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

  it('Canada: "high security level in the whole territory" -> Level 1, and is NOT confused with the existing "high level" -> 3 keyword (that requires "high level" verbatim, e.g. "high level of crime"; "high SECURITY level" is a different phrase)', () => {
    const text =
      'There is a high security level in the whole territory of Canada. Crime in Canada is mostly concentrated in major cities. There are thefts, car break-ins and the like, but very rarely.';
    assert.equal(normalizeRsLevel(text), 1);
    // Sanity check on the collision this test guards against: the bare phrase DOES still trip
    // the existing Level-3 branch when it appears without "security" in between.
    assert.equal(normalizeRsLevel('There is a high level of petty crime in the tourist areas.'), 3);
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

  it('KNOWN GAP (not fixed by this repair, out of scope -- flagged for the parser\'s own agent): a single-WORD ALL-CAPS heading like the real "TRANSPORT —" does not bound the section, so that heading\'s own content bleeds into the result. Documented here, not silently masked, so a future fix can find it', () => {
    const body =
      'SECURITY SITUATION — There is a high security level in the whole territory of Canada.TRANSPORT — Penalties for non-compliance with traffic regulations are extremely strict.';
    const section = extractRsSecuritySection(body);
    assert.ok(section?.includes('Penalties for non-compliance'), 'documents the current (buggy) behavior, not the desired one');
  });
});
