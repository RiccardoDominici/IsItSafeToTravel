// Cloudflare Pages Middleware: redirect .pages.dev to canonical domain
// Prevents duplicate content indexing on the preview domain.

const CANONICAL_HOST = 'isitsafetotravel.org';

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);

  if (url.hostname.endsWith('.pages.dev')) {
    url.hostname = CANONICAL_HOST;
    url.protocol = 'https:';
    return new Response(null, {
      status: 301,
      headers: { Location: url.toString() },
    });
  }

  // Yandex Webmaster verification
  if (url.pathname === '/yandex_d3ec07bc73fe3dcf.html') {
    return new Response(
      `<html>\n    <head>\n        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">\n    </head>\n    <body>Verification: d3ec07bc73fe3dcf</body>\n</html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  return context.next();
};
