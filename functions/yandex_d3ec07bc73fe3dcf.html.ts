export const onRequest: PagesFunction = async () => {
  const html = `<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    </head>
    <body>Verification: d3ec07bc73fe3dcf</body>
</html>`;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
};
