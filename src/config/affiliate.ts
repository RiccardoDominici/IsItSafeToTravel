/**
 * Travelpayouts affiliate configuration.
 *
 * To activate the real affiliate link:
 * 1. Sign up at https://www.travelpayouts.com/
 * 2. Get your marker (partner ID) from the Travelpayouts dashboard
 * 3. Replace the TRAVELPAYOUTS_MARKER value below with your real marker (a 6-digit string)
 * 4. Optionally set TRAVELPAYOUTS_DEFAULT_TARGET to a specific landing page (e.g., a curated
 *    deals page) — the default points to the Travelpayouts white-label search.
 *
 * No other code changes needed — every consumer reads from this file.
 */

export const TRAVELPAYOUTS_MARKER = '526093';

/** Default landing page when no specific URL is provided. */
export const TRAVELPAYOUTS_DEFAULT_TARGET = 'https://search.travelpayouts.com/';

/**
 * Wrap any URL in a Travelpayouts affiliate redirect.
 * Pattern: https://tp.media/r?marker={MARKER}&u={ENCODED_URL}
 * (trs and p params are optional and only needed when running specific campaigns)
 */
export function buildAffiliateUrl(targetUrl: string = TRAVELPAYOUTS_DEFAULT_TARGET): string {
  const encoded = encodeURIComponent(targetUrl);
  return `https://tp.media/r?marker=${TRAVELPAYOUTS_MARKER}&u=${encoded}`;
}
