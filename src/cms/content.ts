import { AsyncLocalStorage } from 'node:async_hooks';
import { database, transaction, audit } from './database';
import { globalDefaults, localeDefaults, type Locale, type SiteContent, type LocalContent } from './defaults';
import { mergePageContent, type EditorPageId } from './editor';

export const contentContext = new AsyncLocalStorage<{ preview: boolean; cache: Map<string, unknown> }>();
export type ContentRow = { scope: string; draft: string; published: string; version: number; updated_at: string };
export type SharedContentInput = { value: unknown; version: number; publish: boolean };
export function contentRow(scope: string) {
  return database().prepare('SELECT * FROM content WHERE scope=?').get(scope) as ContentRow;
}
export function getSiteContent(locale: Locale): SiteContent {
  const context = contentContext.getStore();
  if (context?.cache.has(locale)) return context.cache.get(locale) as SiteContent;
  const column = context?.preview ? 'draft' : 'published';
  const value = { ...JSON.parse(contentRow('global')[column]), ...JSON.parse(contentRow(locale)[column]) } as SiteContent;
  context?.cache.set(locale, value);
  return value;
}
export function saveContent(scope: string, value: unknown, version: number, userId: string, publish: boolean, pageId?: EditorPageId, sectionId?: string, shared?: SharedContentInput) {
  if (!['global', 'en', 'id'].includes(scope)) throw new Error('Pilihan bahasa tidak valid.');
  const json = JSON.stringify(value);
  transaction(() => {
    const row = contentRow(scope);
    if (row.version !== version) throw new Error('Konten sudah diubah di tab lain. Muat ulang sebelum menyimpan.');
    const published = publish ? pageId && scope !== 'global' ? JSON.stringify(mergePageContent(JSON.parse(row.published), value as LocalContent, pageId, sectionId)) : json : row.published;
    database().prepare('UPDATE content SET draft=?, published=?, version=version+1, updated_at=? WHERE scope=?').run(json, published, new Date().toISOString(), scope);
    if (publish) database().prepare('INSERT INTO content_history(scope,payload,created_at,user_id) VALUES(?,?,?,?)').run(scope, row.published, new Date().toISOString(), userId);
    audit(userId, publish ? 'content.publish' : 'content.draft', scope);
    if (shared) {
      const sharedRow = contentRow('global');
      if (sharedRow.version !== shared.version) throw new Error('Identitas & gambar sudah berubah. Muat ulang sebelum menyimpan.');
      const sharedJson = JSON.stringify(shared.value);
      const sharedPublished = shared.publish ? sharedJson : sharedRow.published;
      database().prepare('UPDATE content SET draft=?, published=?, version=version+1, updated_at=? WHERE scope=?').run(sharedJson, sharedPublished, new Date().toISOString(), 'global');
      if (shared.publish) database().prepare('INSERT INTO content_history(scope,payload,created_at,user_id) VALUES(?,?,?,?)').run('global', sharedRow.published, new Date().toISOString(), userId);
      audit(userId, shared.publish ? 'content.publish' : 'content.draft', 'global');
    }
  });
}
export function restoreContent(scope: string, historyId: number, version: number, userId: string, pageId?: EditorPageId, sectionId?: string) {
  const history = database().prepare('SELECT payload FROM content_history WHERE id=? AND scope=?').get(historyId, scope) as { payload: string } | undefined;
  if (!history) throw new Error('Versi konten tidak ditemukan.');
  const restored = pageId && scope !== 'global' ? mergePageContent(JSON.parse(contentRow(scope).draft), JSON.parse(history.payload), pageId, sectionId) : JSON.parse(history.payload);
  saveContent(scope, restored, version, userId, false, pageId, sectionId);
}
export function checkTranslationVersions(sourceVersion: number, targetVersion: number) {
  if (contentRow('id').version !== sourceVersion) throw new Error('Konten Indonesia sudah diubah di tab lain. Muat ulang sebelum menerjemahkan.');
  if (contentRow('en').version !== targetVersion) throw new Error('Draft English sudah diubah di tab lain. Tinjau perubahan terbaru lalu coba terjemahkan lagi.');
}
export function saveTranslatedPage(source: LocalContent, translated: LocalContent, pageId: EditorPageId, sourceVersion: number, targetVersion: number, userId: string, sectionId?: string) {
  // The network request has already completed; don't hold a SQLite lock while waiting for Google.
  transaction(() => {
    checkTranslationVersions(sourceVersion, targetVersion);
    const update = database().prepare('UPDATE content SET draft=?, version=version+1, updated_at=? WHERE scope=?');
    const now = new Date().toISOString();
    for (const [scope, value] of [['id', source], ['en', translated]] as const) {
      const draft = mergePageContent(JSON.parse(contentRow(scope).draft), value, pageId, sectionId);
      update.run(JSON.stringify(draft), now, scope);
    }
    audit(userId, 'content.translate', `${pageId}:id/en`);
  });
}
export const defaultContent = (scope: string) => scope === 'global' ? globalDefaults : localeDefaults(scope as Locale);
