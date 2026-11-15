import type { LocalContent } from './defaults';

export type ContentField = { key: string; label: string; short?: boolean };
export type EditorCollection = 'services' | 'partners';
export type EditorSection = { id: string; label: string; description: string; fields: ContentField[]; collection?: EditorCollection; image?: 'logo' | 'hero' | 'about' };
export type EditorPageId = 'home' | 'about' | 'siwride' | 'services' | 'partnership' | 'contact';
type EditorPage = { id: EditorPageId; label: string; section: 'pages' | EditorCollection; publicPage: 'home' | 'about' | 'siwride' | 'partnership' | 'contact'; fields: ContentField[]; sections: EditorSection[] };

const field = (key: string, label: string, short = false): ContentField => ({ key, label, ...(short ? { short: true } : {}) });
const section = (id: string, label: string, description: string, fields: ContentField[], options: Partial<Pick<EditorSection, 'collection' | 'image'>> = {}): EditorSection => ({ id, label, description, fields, ...options });

const homeHero = [field('Transportasi dan perjalanan di Bali', 'Judul utama', true), field('PT Tiga Pilar Dewata menghadirkan Siwride, platform pemesanan kendaraan dan pengelolaan transportasi.', 'Ringkasan pembuka')];
const homeAbout = [
  field('Perusahaan yang berfokus pada transportasi dan perjalanan di Bali melalui produk Siwride.', 'Ringkasan tentang perusahaan'),
  field('Fokus transportasi dan perjalanan', 'Poin unggulan 1', true),
  field('Siwride sebagai produk perusahaan', 'Poin unggulan 2', true),
  field('Kerja sama travel dan transportasi', 'Poin unggulan 3', true),
];
const homeServices = [field('Transfer bandara, paket wisata, perjalanan bersama, dan sewa kendaraan dengan pengemudi.', 'Ringkasan layanan')];
const aboutProfile = [
  field('Perusahaan di bidang transportasi dan perjalanan melalui Siwride.', 'Ringkasan halaman'),
  field('PT Tiga Pilar Dewata menghadirkan Siwride sebagai satu-satunya produk perusahaan, dengan fokus transportasi dan perjalanan di Bali.', 'Profil perusahaan'),
  field('Platform pemesanan kendaraan', 'Poin unggulan 1', true),
  field('Pengelolaan layanan bersama tim dan mitra', 'Poin unggulan 2', true),
  field('Fokus perjalanan di Bali', 'Poin unggulan 3', true),
];
const siwrideIntro = [field('Platform manajemen transportasi dan pemesanan kendaraan.', 'Ringkasan produk'), field('Pemesanan Kendaraan di Bali', 'Judul pengenalan produk', true), field('Produk PT Tiga Pilar Dewata untuk kebutuhan transportasi dan perjalanan di Bali.', 'Deskripsi produk'), field('Hubungi kami untuk informasi perjalanan dan pemesanan Siwride.', 'Informasi pemesanan')];
const contactIntro = [field('Informasi perusahaan, Siwride, dan peluang kerja sama.', 'Ringkasan halaman'), field('Hubungi kami melalui email atau telepon untuk informasi Siwride dan kerja sama.', 'Petunjuk menghubungi perusahaan')];

// Only editorial content belongs in CMS. Each section maps directly to one public block.
export const editorPages: EditorPage[] = [
  { id: 'home', label: 'Beranda', section: 'pages', publicPage: 'home', fields: [...homeHero, ...homeAbout, ...homeServices], sections: [
    section('hero', 'Hero beranda', 'Judul dan ringkasan pembuka beranda.', homeHero, { image: 'hero' }),
    section('about', 'Tentang perusahaan', 'Ringkasan blok tentang perusahaan.', homeAbout, { image: 'about' }),
    section('services', 'Layanan Siwride', 'Ringkasan blok layanan. Daftar layanan dikelola di tab Daftar layanan.', homeServices),
  ] },
  { id: 'about', label: 'Tentang perusahaan', section: 'pages', publicPage: 'about', fields: aboutProfile, sections: [
    section('profile', 'Profil perusahaan', 'Ringkasan dan profil perusahaan.', aboutProfile, { image: 'about' }),
  ] },
  { id: 'siwride', label: 'Produk Siwride', section: 'pages', publicPage: 'siwride', fields: siwrideIntro, sections: [
    section('intro', 'Pengenalan produk', 'Judul, deskripsi, dan informasi pemesanan produk.', siwrideIntro, { image: 'logo' }),
  ] },
  { id: 'services', label: 'Daftar layanan', section: 'services', publicPage: 'siwride', fields: [], sections: [
    section('services', 'Daftar layanan', 'Layanan yang tampil di beranda dan halaman Siwride.', [], { collection: 'services' }),
  ] },
  { id: 'partnership', label: 'Kemitraan', section: 'partners', publicPage: 'partnership', fields: [field('Untuk pelaku travel, pemandu wisata, dan mitra transportasi.', 'Ringkasan kemitraan')], sections: [
    section('partnership', 'Kemitraan', 'Ringkasan, jenis mitra, dan langkah pengajuan kerja sama.', [field('Untuk pelaku travel, pemandu wisata, dan mitra transportasi.', 'Ringkasan kemitraan')], { collection: 'partners' }),
  ] },
  { id: 'contact', label: 'Kontak', section: 'pages', publicPage: 'contact', fields: contactIntro, sections: [
    section('contact', 'Kontak', 'Ringkasan dan petunjuk menghubungi perusahaan.', contactIntro),
  ] },
];

export function editorPage(id: string) {
  const page = editorPages.find(page => page.id === id);
  if (!page) throw new Error('Halaman konten tidak valid.');
  return page;
}

export function editorSection(pageId: EditorPageId, sectionId?: string) {
  const page = editorPage(pageId);
  const selected = sectionId ? page.sections.find(section => section.id === sectionId) : page.sections[0];
  if (!selected) throw new Error('Bagian konten tidak valid.');
  return selected;
}

export function pageContent(value: LocalContent, pageId: EditorPageId, sectionId?: string) {
  const page = editorPage(pageId);
  const sections = sectionId ? [editorSection(pageId, sectionId)] : page.sections;
  const fields = sections.flatMap(section => section.fields);
  const collection = sections.find(section => section.collection)?.collection;
  return {
    messages: Object.fromEntries(fields.map(field => [field.key, value.messages[field.key]])),
    ...(collection === 'services' ? { services: value.services } : {}),
    ...(collection === 'partners' ? { partners: value.partners, steps: value.steps } : {}),
  };
}

export function mergePageContent(target: LocalContent, source: LocalContent, pageId: EditorPageId, sectionId?: string): LocalContent {
  const changes = pageContent(source, pageId, sectionId);
  return { ...target, ...changes, messages: { ...target.messages, ...changes.messages } };
}
