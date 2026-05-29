/**
 * Travelpayouts affiliate configuration.
 *
 * Marker (partner ID) from the Travelpayouts dashboard. Attribution is handled
 * entirely by the ?marker= query param on each affiliate link — links just need
 * to point to a Travelpayouts partner brand (aviasales, hotellook, kiwi, etc.)
 * with the marker attached. (No sitewide tracker script: the tp-em.com one was
 * removed because it injected an unwanted floating "cheap flights" promo banner.)
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
