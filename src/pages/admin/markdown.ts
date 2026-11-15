import type { APIRoute } from 'astro';
import { renderMarkdown } from '../../cms/blog';
export const POST: APIRoute = ({ locals }) => {
  const body = String(locals.form?.get('body') || '');
  if (body.length > 150000) return new Response('Isi terlalu panjang.', { status:413 });
  return Response.json({ html:renderMarkdown(body) });
};
