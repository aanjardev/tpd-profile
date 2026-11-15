import type { APIRoute } from 'astro';
import { database } from '../../cms/database';
import { sessionCookie } from '../../cms/auth';
export const POST: APIRoute = ({ locals, cookies, redirect }) => {
  database().prepare('DELETE FROM sessions WHERE token_hash=?').run(locals.admin!.token_hash);
  cookies.delete(sessionCookie, { path: '/' });
  return redirect('/admin/login/', 303);
};
