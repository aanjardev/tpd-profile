import type { APIRoute } from 'astro';
import { database } from '../../cms/database';

const maxBody = 64 * 1024;
const allowedReturns = new Set(['/contact/', '/id/kontak/']);
function redirect(path: string, status: 'success' | 'error') {
  return new Response(null, { status: 303, headers: { Location: `${path}${path.includes('?') ? '&' : '?'}contact=${status}` } });
}

export const POST: APIRoute = async ({ request, url }) => {
  const expectedOrigin = process.env.CMS_ORIGIN || url.origin;
  const origin = request.headers.get('origin');
  if (origin && origin !== expectedOrigin) return new Response('Asal permintaan tidak valid.', { status: 403 });
  if (Number(request.headers.get('content-length') || 0) > maxBody) return new Response('Formulir terlalu besar.', { status: 413 });
  let form: FormData;
  try {
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    if (reader) while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBody) { await reader.cancel(); return new Response('Formulir terlalu besar.', { status: 413 }); }
      chunks.push(part.value);
    }
    form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData();
  } catch { return new Response('Formulir tidak valid.', { status: 400 }); }
  const returnTo = String(form.get('return_to') || '');
  if (!allowedReturns.has(returnTo)) return new Response('Tujuan formulir tidak valid.', { status: 400 });
  if (String(form.get('website') || '').trim()) return redirect(returnTo, 'success');
  const name = String(form.get('name') || '').trim();
  const email = String(form.get('email') || '').trim().toLowerCase();
  const phone = String(form.get('phone') || '').trim();
  const message = String(form.get('message') || '').trim();
  const locale = form.get('locale') === 'en' ? 'en' : 'id';
  if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || phone.length > 40 || message.length < 10 || message.length > 5000) return redirect(returnTo, 'error');
  database().prepare('INSERT INTO contact_messages(name,email,phone,message,locale,created_at) VALUES(?,?,?,?,?,?)').run(name, email, phone, message, locale, new Date().toISOString());
  return redirect(returnTo, 'success');
};
