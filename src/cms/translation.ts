import { decodeHTML } from 'entities';
import type { LocalContent } from './defaults';
import { editorPage, type EditorPageId } from './editor';

const endpoint = 'https://translation.googleapis.com/language/translate/v2';
export const translationConfigured = () => !!process.env.GOOGLE_TRANSLATE_API_KEY?.trim();

// Only editable prose is sent to Google. Keys, icons, numbering and fixed UI labels stay local.
export async function translatePage(source: LocalContent, pageId: EditorPageId): Promise<LocalContent> {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY?.trim();
  if (!key) throw new Error('Terjemahan otomatis belum diaktifkan. Hubungi pengelola teknis.');
  const translated = structuredClone(source), page = editorPage(pageId);
  const fields: { text: string; limit: number; set: (text: string) => void }[] = [];
  for (const field of page.fields) fields.push({ text: source.messages[field.key], limit: field.short ? 300 : 5000, set: text => { translated.messages[field.key] = text; } });
  if (page.section === 'services' || page.section === 'partners') {
    const section = page.section;
    source[section].forEach((item, index) => {
      fields.push({ text: item.title, limit: 160, set: text => { translated[section][index].title = text; } });
      fields.push({ text: item.description, limit: 1200, set: text => { translated[section][index].description = text; } });
    });
    if (section === 'partners') source.steps.forEach((text, index) => fields.push({ text, limit: 300, set: text => { translated.steps[index] = text; } }));
  }
  const batches: typeof fields[] = [];
  let batch: typeof fields = [], size = 0;
  for (const field of fields) {
    if (typeof field.text !== 'string' || !field.text.trim() || field.text.length > field.limit) throw new Error('Isi Indonesia tidak valid. Periksa isian sebelum menerjemahkan.');
    // Basic v2 accepts at most 128 strings. Keep requests near Google's recommended 5,000 characters.
    if (batch.length && (batch.length >= 128 || size + field.text.length > 5000)) { batches.push(batch); batch = []; size = 0; }
    batch.push(field); size += field.text.length;
  }
  if (batch.length) batches.push(batch);
  const signal = AbortSignal.timeout(20_000);
  for (const entries of batches) {
    let response: Response;
    let payload: { data?: { translations?: { translatedText?: unknown }[] } };
    try {
      response = await fetch(endpoint, {
        method: 'POST', redirect: 'error', signal,
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
        body: JSON.stringify({ q: entries.map(field => field.text), source: 'id', target: 'en', format: 'text' }),
      });
      // Never forward Google's response body: it can contain credential/project details.
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 400 || response.status === 401 || response.status === 403) throw new Error('translation:credentials');
        if (response.status === 429) throw new Error('translation:quota');
        throw new Error('translation:provider');
      }
      payload = await response.json();
    } catch (cause) {
      if (signal.aborted) throw new Error('Penerjemahan terlalu lama. Coba lagi. Draft tersimpan belum berubah.');
      const code = (cause as Error).message;
      if (code === 'translation:credentials') throw new Error('Layanan penerjemah belum dapat diakses. Minta pengelola teknis memeriksa API key, aktivasi API, dan billing.');
      if (code === 'translation:quota') throw new Error('Batas layanan penerjemah tercapai. Coba lagi nanti atau minta pengelola teknis memeriksa kuota.');
      throw new Error('Layanan penerjemah sedang tidak tersedia. Coba lagi. Draft tersimpan belum berubah.');
    }
    const results = payload?.data?.translations;
    if (!Array.isArray(results) || results.length !== entries.length) throw new Error('Hasil terjemahan tidak lengkap. Coba lagi. Draft tersimpan belum berubah.');
    entries.forEach((field, index) => {
      const raw = results[index]?.translatedText;
      if (typeof raw !== 'string') throw new Error('Hasil terjemahan tidak valid. Draft tersimpan belum berubah.');
      const text = decodeHTML(raw).trim();
      if (!text || text.length > field.limit) throw new Error('Hasil terjemahan kosong atau terlalu panjang. Ringkas isi Indonesia lalu coba lagi. Draft tersimpan belum berubah.');
      field.set(text);
    });
  }
  return translated;
}
