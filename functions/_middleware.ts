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

  return context.next();
};
