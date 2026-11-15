import { defineMiddleware } from 'astro:middleware';
import { getSession, sessionCookie } from './cms/auth';
import { contentContext } from './cms/content';
import { randomUUID } from 'node:crypto';
import { recordVisit } from './cms/analytics';

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url, cookies, locals } = context;
  let pathname: string;
  try { pathname = decodeURIComponent(url.pathname); } catch { return new Response('URL tidak valid.',{ status:400 }); }
  const legacy: Record<string,string> = { '/tentang/':'/id/tentang/', '/kemitraan/':'/id/kemitraan/', '/kontak/':'/id/kontak/' };
  const legacyPath = url.pathname.replace(/\/$/,'') + '/';
  if (legacy[legacyPath]) return context.redirect(legacy[legacyPath] + url.search,301);
  locals.admin = getSession(cookies.get(sessionCookie)?.value);
  locals.preview = !!locals.admin && url.searchParams.get('preview') === '1';
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  const isLogin = pathname.replace(/\/$/, '') === '/admin/login';
  if (isAdmin && !isLogin && !locals.admin) return context.redirect('/admin/login/', 303);
  if (isAdmin && !['GET', 'HEAD'].includes(request.method)) {
    const expectedOrigin = process.env.CMS_ORIGIN || url.origin;
    if (request.headers.get('origin') !== expectedOrigin) return new Response('Asal permintaan tidak valid.', { status: 403 });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const isCompanyUpload = pathname.replace(/\/$/, '') === '/admin/content' && url.searchParams.get('scope') === 'global';
    const bodyLimit = (isCompanyUpload ? 16 : 6) * 1024 * 1024;
    try {
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = []; let size = 0;
      if (reader) while (true) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.byteLength;
        if (size > bodyLimit) { await reader.cancel(); return new Response(isCompanyUpload ? 'Total formulir maksimal 16 MB; setiap gambar maksimal 5 MB.' : 'Unggahan maksimal 5 MB.', { status: 413 }); }
        chunks.push(part.value);
      }
      locals.form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData();
    } catch { return new Response('Formulir tidak valid.', { status: 400 }); }
    if (!isLogin && locals.form.get('csrf') !== locals.admin?.csrf) return new Response('Sesi formulir tidak valid. Muat ulang halaman.', { status: 403 });
  }
  return contentContext.run({ preview: locals.preview, cache: new Map() }, async () => {
    const response = await next();
    const trackable = request.method === 'GET' && response.status >= 200 && response.status < 400 && response.headers.get('content-type')?.startsWith('text/html') && !isAdmin && !locals.preview && !pathname.startsWith('/api/') && !pathname.startsWith('/healthz') && !pathname.startsWith('/media/') && !pathname.startsWith('/_astro/') && !pathname.startsWith('/images/') && !pathname.startsWith('/brand/') && pathname !== '/favicon.ico';
    if (trackable) {
      const existing = cookies.get('tpd_visitor')?.value;
      const visitorId = existing && /^[a-f0-9-]{36}$/i.test(existing) ? existing : randomUUID();
      recordVisit(visitorId);
      if (!existing) cookies.set('tpd_visitor', visitorId, { httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', path: '/', maxAge: 60 * 60 * 24 * 365 });
    }
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-Frame-Options', 'DENY');
    // Content changes and unpublishing must be visible immediately, including behind a proxy.
    if (!url.pathname.startsWith('/_astro/')) response.headers.set('Cache-Control', 'no-store');
    if (isAdmin || locals.preview) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  });
});
