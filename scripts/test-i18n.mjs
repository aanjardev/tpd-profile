import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { en, id } from '../src/i18n/messages.ts';
import { routes, resolvePath, pathFor } from '../src/i18n/index.ts';

assert.deepEqual(Object.keys(en).sort(), Object.keys(id).sort());
for (const messages of [en, id]) assert.ok(Object.values(messages).every(value => typeof value === 'string' && value.trim()));
let count = 0;
for (const [page, locales] of Object.entries(routes)) {
  for (const [locale, path] of Object.entries(locales)) {
    assert.deepEqual(resolvePath(path), { page, locale });
    assert.equal(pathFor(page, locale), path);
    const html = readFileSync(`dist${path}index.html`, 'utf8');
    assert.match(html, new RegExp(`<html lang="${locale}"`));
    assert.match(html, /name="robots" content="noindex, nofollow"/);
    for (const target of ['en', 'id']) {
      assert.ok(html.includes(`hreflang="${target}" href="${pathFor(page, target)}"`));
      assert.ok(html.includes(`href="${pathFor(page, target)}" hreflang="${target}" lang="${target}"`));
    }
    assert.ok(html.includes(`hreflang="x-default" href="${locales.en}"`));
    for (const match of html.matchAll(/(?:href|src)="(\/[^"#?]*)(?:[?#][^"]*)?"/g)) {
      const target = match[1];
      assert.ok(existsSync(`dist${target}${target.endsWith('/') ? 'index.html' : ''}`), `${path}: missing ${target}`);
    }
    const opposite = locale === 'en' ? 'id' : 'en';
    // All internal navigation/CTA links stay within the current locale, except the switcher and metadata.
    for (const match of html.matchAll(/<a\b([^>]+)>/g)) {
      if (match[1].includes('data-language-link')) continue;
      const href = match[1].match(/href="([^"#]+)"/)?.[1];
      if (href?.startsWith('/')) assert.notEqual(resolvePath(href)?.locale, opposite, `${path}: cross-language link ${href}`);
    }
    if (locale === 'en') {
      for (const phrase of ['Hubungi Kami', 'Tentang Kami', 'Beranda', 'Produk Perusahaan', 'Pemesanan Kendaraan']) {
        assert.ok(!html.includes(phrase), `${path}: untranslated ${phrase}`);
      }
    }
    count++;
  }
}
assert.equal(count, 10);
assert.equal(resolvePath('/missing/'), undefined);
for (const slug of ['tentang', 'kemitraan', 'kontak']) {
  assert.ok(readFileSync(`dist/${slug}/index.html`, 'utf8').includes(`/id/${slug}/`));
}
// Exercise the actual switcher script with browser URL state.
const switcher = readFileSync('src/components/LanguageSwitcher.astro', 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace('querySelectorAll<HTMLAnchorElement>', 'querySelectorAll');
const links = [{ href: 'https://example.com/siwride/' }, { href: 'https://example.com/id/siwride/' }];
const listeners = {};
const location = { search: '?campaign=bali', hash: '#layanan' };
runInNewContext(switcher, { URL, location, document: { querySelectorAll: () => links }, window: { addEventListener: (event, callback) => listeners[event] = callback } });
assert.equal(links[1].href, 'https://example.com/id/siwride/?campaign=bali#layanan');
location.hash = '#main-content';
listeners.hashchange();
assert.equal(links[0].href, 'https://example.com/siwride/?campaign=bali#main-content');
assert.ok(readFileSync('dist/404.html', 'utf8').includes('Page Not Found'));
// Exercise the shipped static 404 script for both locale paths.
const errorScript = readFileSync('dist/404.html', 'utf8').match(/<script>([\s\S]*?location\.pathname[\s\S]*?)<\/script>/)?.[1];
assert.ok(errorScript, 'Static 404 locale script must be present');
for (const path of ['/id/missing/', '/missing/', '/id', '/identity/']) {
  const chrome = ['en', 'id'].map(locale => ({ dataset: { errorChrome: locale }, hidden: locale === 'id' }));
  const text = ['title', 'message', 'back'].map(key => ({ dataset: { error: key }, textContent: '' }));
  const home = { href: '/' };
  const description = { content: '' };
  const skip = { textContent: 'Skip to content' };
  const document = {
    documentElement: { lang: 'en' }, title: '',
    querySelectorAll: selector => selector === '[data-error-chrome]' ? chrome : text,
    querySelector: selector => selector === '[data-error-home]' ? home : selector === '.skip-link' ? skip : description,
  };
  runInNewContext(errorScript, { document, location: { pathname: path } });
  const isIndonesian = path === '/id' || path.startsWith('/id/');
  assert.equal(document.documentElement.lang, isIndonesian ? 'id' : 'en');
  assert.equal(home.href, isIndonesian ? '/id/' : '/');
  assert.equal(chrome.find(item => !item.hidden).dataset.errorChrome, isIndonesian ? 'id' : 'en');
  if (isIndonesian) {
    assert.equal(text[0].textContent, 'Halaman Tidak Ditemukan');
    assert.ok(description.content.includes('Halaman yang Anda cari'));
  }
}
console.log('i18n checks passed: dictionaries, 10 routes, metadata, links/assets, redirects, query/hash preservation, and EN/ID static 404.');
