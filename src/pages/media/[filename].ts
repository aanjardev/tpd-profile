import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { database, dataDirectory } from '../../cms/database';
export const GET: APIRoute = async ({ params }) => {
  const row = database().prepare('SELECT filename FROM media WHERE filename=?').get(params.filename || '') as { filename: string } | undefined;
  if (!row) return new Response('Not found',{ status:404 });
  try { return new Response(await readFile(join(dataDirectory(),'uploads',row.filename)),{ headers:{ 'Content-Type':'image/webp', 'Cache-Control':'public,max-age=86400', 'X-Content-Type-Options':'nosniff' } }); }
  catch { return new Response('Not found',{ status:404 }); }
};
