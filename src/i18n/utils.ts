import { ui, defaultLang, type Lang, languages, routes } from './ui';

export function getLangFromUrl(url: URL): Lang {
  const [, lang] = url.pathname.split('/');
  if (lang && lang in languages) return lang as Lang;
  return defaultLang;
}

export function useTranslations(lang: Lang) {
  return function t(key: keyof (typeof ui)[typeof defaultLang]): string {
    return ui[lang][key] || ui[defaultLang][key];
  };
}

export function getRouteFromUrl(url: URL): string {
  const pathname = url.pathname;
  const parts = pathname.split('/').filter(Boolean);
  // Remove the language prefix
  if (parts[0] && parts[0] in languages) {
    parts.shift();
  }
  return '/' + parts.join('/');
}

/** Build the equivalent URL for a different locale */
export function getLocalizedPath(path: string, targetLang: Lang): string {
  const parts = path.split('/').filter(Boolean);
  const currentLang =
    parts[0] && parts[0] in languages
      ? (parts.shift()! as Lang)
      : defaultLang;

  // Translate known route segments
  const translatedParts = parts.map((part) => {
    const currentRoutes = routes[currentLang];
    const targetRoutes = routes[targetLang];
    for (const [key, value] of Object.entries(currentRoutes)) {
      if (value === part) {
        return targetRoutes[key as keyof typeof targetRoutes];
      }
    }
    return part;
  });

  return `/${targetLang}/${translatedParts.join('/')}`;
}

export function getAlternateLinks(
  currentPath: string,
): Array<{ lang: Lang; href: string }> {
  return (Object.keys(languages) as Lang[]).map((lang) => ({
    lang,
    href: getLocalizedPath(currentPath, lang),
  }));
}

export { type Lang, languages, defaultLang } from './ui';
