// Cloudflare Pages Function: language-based redirect for root URL
// Reads Accept-Language header to serve the correct language version.
// Googlebot gets /en/ (no Accept-Language match) which aligns with x-default hreflang.

const SUPPORTED_LANGS = ['it', 'es', 'fr', 'pt', 'en'] as const;
const DEFAULT_LANG = 'en';

function getPreferredLang(acceptLanguage: string | null): string {
  if (!acceptLanguage) return DEFAULT_LANG;

  // Parse Accept-Language: "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
  const langs = acceptLanguage
    .split(',')
    .map((part) => {
      const [lang, qPart] = part.trim().split(';');
      const q = qPart ? parseFloat(qPart.split('=')[1]) : 1.0;
      return { lang: lang.toLowerCase().split('-')[0], q };
    })
    .sort((a, b) => b.q - a.q);

  for (const { lang } of langs) {
    if ((SUPPORTED_LANGS as readonly string[]).includes(lang)) {
      return lang;
    }
  }

  return DEFAULT_LANG;
}

export const onRequest: PagesFunction = async (context) => {
  const acceptLanguage = context.request.headers.get('Accept-Language');
  const lang = getPreferredLang(acceptLanguage);

  return new Response(null, {
    status: 302,
    headers: {
      Location: `/${lang}/`,
      'Cache-Control': 'no-cache',
      Vary: 'Accept-Language',
    },
  });
};
