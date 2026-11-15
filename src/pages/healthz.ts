import type { APIRoute } from 'astro';
import { database } from '../cms/database';
export const GET: APIRoute = () => {
  try { database().prepare('SELECT 1').get(); return Response.json({ status:'ok' }); }
  catch { return Response.json({ status:'unavailable' },{ status:503 }); }
};
