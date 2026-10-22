// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL || undefined,
  i18n: {
    locales: ['en', 'id'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false },
  },
  redirects: {
    '/tentang/': '/id/tentang/',
    '/kemitraan/': '/id/kemitraan/',
    '/kontak/': '/id/kontak/',
  },
  devToolbar: { enabled: false },
});
