// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
if (existsSync('.env')) loadEnvFile('.env');
const publicOrigin = process.env.SITE_URL || process.env.CMS_ORIGIN;

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  site: process.env.SITE_URL || undefined,
  security: {
    allowedDomains: [
      { hostname: 'localhost' },
      { hostname: '127.0.0.1' },
      ...(publicOrigin ? [{ hostname: new URL(publicOrigin).hostname }] : []),
    ],
  },
  i18n: {
    locales: ['en', 'id'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false },
  },
  devToolbar: { enabled: false },
});
