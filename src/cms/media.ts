import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import sharp, { type OutputInfo } from 'sharp';
import { database, dataDirectory, audit, transaction } from './database';
export type MediaRow = { id: string; filename: string; original_name: string; width: number; height: number; bytes: number; created_at: string };
export async function uploadMedia(file: File, userId: string) {
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('Ukuran gambar maksimal 5 MB.');
  const bytes = Buffer.from(await file.arrayBuffer());
  let output: { data: Buffer; info: OutputInfo };
  try {
    const image = sharp(bytes, { limitInputPixels:40_000_000, animated:false });
    const metadata = await image.metadata();
    if (!['jpeg','png','webp','avif'].includes(metadata.format || '')) throw new Error();
    output = await image.rotate().resize({ width:2000, height:2000, fit:'inside', withoutEnlargement:true }).webp({ quality:85 }).toBuffer({ resolveWithObject:true });
  } catch { throw new Error('Gambar harus berupa JPEG, PNG, WebP, atau AVIF yang valid, maksimal 40 megapiksel.'); }
  database();
  const id = randomUUID(), filename = `${id}.webp`, path = join(dataDirectory(),'uploads',filename);
  await writeFile(path,output.data,{ flag:'wx' });
  try {
    transaction(() => {
      database().prepare('INSERT INTO media(id,filename,original_name,width,height,bytes,created_at) VALUES(?,?,?,?,?,?,?)').run(id,filename,file.name.slice(0,200),output.info.width,output.info.height,output.data.length,new Date().toISOString());
      audit(userId,'media.upload',id);
    });
  } catch (error) { await unlink(path); throw error; }
  return { id, url: `/media/${filename}` };
}
export function deleteMedia(id: string, userId: string) {
  return transaction(() => {
  const row = database().prepare('SELECT * FROM media WHERE id=?').get(id) as MediaRow | undefined;
  if (!row) throw new Error('Gambar tidak ditemukan.');
  const url = `/media/${row.filename}`;
  const rows = [
    ...database().prepare('SELECT draft,published FROM content').all(),
    ...database().prepare('SELECT draft,published FROM posts').all(),
    ...database().prepare('SELECT payload AS draft FROM content_history').all(),
  ];
  if (rows.some(record => Object.values(record).some(value => typeof value === 'string' && value.includes(url)))) throw new Error('Gambar masih digunakan oleh konten, artikel, atau riwayat publikasi.');
  unlinkSync(join(dataDirectory(),'uploads',row.filename));
  database().prepare('DELETE FROM media WHERE id=?').run(id); audit(userId,'media.delete',id);
  });
}
