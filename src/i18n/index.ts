import { en, id } from './messages.ts';
import { getSiteContent } from '../cms/content';
export type Locale = 'en' | 'id';
export const routes = {
 home: { en: '/', id: '/id/' },
 about: { en: '/about/', id: '/id/tentang/' },
 siwride: { en: '/siwride/', id: '/id/siwride/' },
 partnership: { en: '/partnership/', id: '/id/kemitraan/' },
 contact: { en: '/contact/', id: '/id/kontak/' },
 blog: { en: '/blog/', id: '/id/blog/' },
} as const;
export type PageId = keyof typeof routes;
export const pageIds = Object.keys(routes) as PageId[];
export const pathFor = (page: PageId, locale: Locale) => routes[page][locale];
export function resolvePath(path: string) {
 const normalized = path === '/' ? '/' : path.replace(/\/$/, '') + '/';
 for (const page of pageIds) for (const locale of ['en', 'id'] as const) {
  if (routes[page][locale] === normalized) return { page, locale };
 }
 return undefined;
}
export const translate = (locale: Locale) => {
 const messages = getSiteContent(locale).messages;
 return (key: string): string => messages[key] ?? ({ en, id }[locale] as Record<string, string>)[key] ?? key;
};
export const navigationFor = (locale: Locale) => {
 const t = translate(locale);
 const labels = ['Beranda', 'Tentang Kami', 'Siwride', 'Kemitraan', 'Kontak', 'Blog'] as const;
 return pageIds.map((page, i) => ({ href: pathFor(page, locale), label: t(labels[i]) }));
};
