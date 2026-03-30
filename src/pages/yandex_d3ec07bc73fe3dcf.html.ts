import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  return new Response(
    `<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    </head>
    <body>Verification: d3ec07bc73fe3dcf</body>
</html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
};
