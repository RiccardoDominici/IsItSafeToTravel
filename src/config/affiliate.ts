/**
 * Travelpayouts affiliate configuration.
 *
 * Marker (partner ID) from the Travelpayouts dashboard. The sitewide tp-em.com
 * tracker script in Base.astro handles attribution automatically — links just
 * need to point to a Travelpayouts partner brand (aviasales, hotellook, kiwi,
 * etc.) with the marker as a query param.
 */

export const TRAVELPAYOUTS_MARKER = '526093';

/** Default flight-search landing page (Aviasales is the main TP partner brand). */
export const TRAVELPAYOUTS_DEFAULT_TARGET = `https://www.aviasales.com/?marker=${TRAVELPAYOUTS_MARKER}`;

/**
 * Append the affiliate marker to a Travelpayouts partner URL.
 * If the URL already has a query string, append; otherwise add ?marker=.
 */
export function buildAffiliateUrl(targetUrl: string = TRAVELPAYOUTS_DEFAULT_TARGET): string {
  if (targetUrl.includes('marker=')) return targetUrl;
  const sep = targetUrl.includes('?') ? '&' : '?';
  return `${targetUrl}${sep}marker=${TRAVELPAYOUTS_MARKER}`;
}
