import { randomUUID } from 'node:crypto';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { database, transaction, audit } from './database';
import type { Locale } from './defaults';

export type PostData = { title: string; slug: string; excerpt: string; body: string; cover: string; coverAlt: string; categoryId: string; author: string; seoTitle: string; seoDescription: string };
export type PostRow = { id: string; locale: Locale; translation_group: string; draft: string; published: string | null; version: number; first_published_at: string | null; updated_at: string; deleted_at: string | null };
export type PublicPost = PostRow & { content: PostData };
export type Category = { id: string; name_id: string; name_en: string };
export const emptyPost = (): PostData => ({ title: '', slug: '', excerpt: '', body: '', cover: '', coverAlt: '', categoryId: '', author: 'Tim PT Tiga Pilar Dewata', seoTitle: '', seoDescription: '' });
export const slugify = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 150);
export const categories = () => database().prepare('SELECT * FROM categories ORDER BY name_id').all() as Category[];
export const postById = (id: string) => database().prepare('SELECT * FROM posts WHERE id=?').get(id) as PostRow | undefined;
export const postPath = (post: { locale: Locale; content: PostData }) => `${post.locale === 'id' ? '/id' : ''}/blog/${post.content.slug}/`;
export function renderMarkdown(body: string) {
  return sanitizeHtml(marked.parse(body, { async: false }) as string, {
    allowedTags: ['p','br','h2','h3','h4','strong','em','s','blockquote','ul','ol','li','a','img','pre','code','hr','table','thead','tbody','tr','th','td'],
    allowedAttributes: { a: ['href','title'], img: ['src','alt','title','loading'], code: ['class'] },
    allowedSchemes: ['https', 'http', 'mailto', 'tel'], allowProtocolRelative: false,
    transformTags: { img: sanitizeHtml.simpleTransform('img', { loading: 'lazy' }) },
  });
}
export function validatePost(data: PostData, publish: boolean) {
  if (!data.title.trim() || data.title.length > 200) throw new Error('Judul wajib diisi, maksimal 200 karakter.');
  if (!data.slug || data.slug !== slugify(data.slug) || ['feed','index','category','page'].includes(data.slug)) throw new Error('Slug harus berupa huruf kecil, angka, dan tanda hubung.');
  if (data.body.length > 150_000 || data.excerpt.length > 500 || data.author.length > 120 || data.cover.length > 2000 || data.coverAlt.length > 500 || data.seoTitle.length > 200 || data.seoDescription.length > 500) throw new Error('Isi artikel atau metadata terlalu panjang.');
  if (data.cover && !isImageUrl(data.cover)) throw new Error('Alamat gambar tidak valid.');
  if (publish && (!data.body.trim() || !data.excerpt.trim() || !data.author.trim())) throw new Error('Isi artikel, ringkasan, dan penulis wajib diisi sebelum terbit.');
  if (data.cover && !data.coverAlt.trim()) throw new Error('Teks alternatif gambar wajib diisi.');
  if (data.categoryId && !categories().some(c => c.id === data.categoryId)) throw new Error('Kategori tidak ditemukan.');
}
export function isImageUrl(value: string) { return /^\/(?!\/)[^\s\\]*$/.test(value) || /^https:\/\/[^\s]+$/.test(value); }
export function savePost(input: { id: string; locale: Locale; group: string; data: PostData; version: number; publish: boolean; userId: string }) {
  const { id, locale, data, version, publish, userId } = input;
  if (![id,input.group].every(value => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value))) throw new Error('Identitas artikel tidak valid. Buka kembali editor.');
  validatePost(data, publish);
  transaction(() => {
    const existing = postById(id);
    if ((existing && existing.version !== version) || (!existing && version !== 0)) throw new Error('Artikel sudah berubah. Muat ulang sebelum menyimpan.');
    if (existing && (existing.locale !== locale || existing.translation_group !== input.group || existing.deleted_at)) throw new Error('Artikel tidak dapat diperbarui.');
    const now = new Date().toISOString();
    if (publish) {
      const route = database().prepare('SELECT post_id FROM post_routes WHERE locale=? AND slug=?').get(locale, data.slug) as { post_id: string } | undefined;
      if (route && route.post_id !== id) throw new Error('Slug sudah dipakai artikel lain, termasuk URL lama.');
    }
    const json = JSON.stringify(data);
    database().prepare('INSERT INTO posts(id,locale,translation_group,draft,published,version,first_published_at,updated_at) VALUES(?,?,?,?,?,1,?,?) ON CONFLICT(id) DO UPDATE SET draft=excluded.draft,published=excluded.published,version=posts.version+1,first_published_at=excluded.first_published_at,updated_at=excluded.updated_at').run(id, locale, input.group || randomUUID(), json, publish ? json : existing?.published || null, existing?.first_published_at || (publish ? now : null), now);
    if (publish) database().prepare('INSERT OR IGNORE INTO post_routes(locale,slug,post_id) VALUES(?,?,?)').run(locale, data.slug, id);
    audit(userId, publish ? 'post.publish' : 'post.draft', id);
  });
  return id;
}
export function listPublished(locale: Locale): PublicPost[] {
  return (database().prepare('SELECT * FROM posts WHERE locale=? AND published IS NOT NULL AND deleted_at IS NULL ORDER BY first_published_at DESC,id').all(locale) as PostRow[]).map(row => ({ ...row, content: JSON.parse(row.published!) }));
}
export function resolvePost(locale: Locale, slug: string): PublicPost | undefined {
  const row = database().prepare('SELECT p.* FROM posts p JOIN post_routes r ON r.post_id=p.id WHERE r.locale=? AND r.slug=? AND p.published IS NOT NULL AND p.deleted_at IS NULL').get(locale, slug) as PostRow | undefined;
  return row ? { ...row, content: JSON.parse(row.published!) } : undefined;
}
export function postAction(id: string, action: string, version: number, userId: string) {
  transaction(() => {
    const row = postById(id);
    if (!row || row.version !== version) throw new Error('Artikel sudah berubah atau tidak ditemukan.');
    const now = new Date().toISOString();
    if (action === 'unpublish') database().prepare('UPDATE posts SET published=NULL,version=version+1,updated_at=? WHERE id=?').run(now, id);
    else if (action === 'delete') database().prepare('UPDATE posts SET published=NULL,deleted_at=?,version=version+1,updated_at=? WHERE id=?').run(now, now, id);
    else if (action === 'restore') database().prepare('UPDATE posts SET deleted_at=NULL,version=version+1,updated_at=? WHERE id=?').run(now, id);
    else throw new Error('Tindakan tidak valid.');
    audit(userId, `post.${action}`, id);
  });
}
