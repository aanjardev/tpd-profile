import { editorPage, editorSection, type EditorPageId } from './editor';

export const globalImageFields = [
  ['logo','Gambar logo'], ['hero','Gambar hero beranda'], ['about','Gambar tentang perusahaan'],
] as const;
export const globalFields = [
  ['company.name','Nama perusahaan'], ['company.brandTop','Nama pada logo — baris pertama'], ['company.brandBottom','Nama pada logo — baris kedua'], ['company.footerLocation','Lokasi pada footer'],
  ['contact.email','Email'], ['contact.phone','Nomor telepon & WhatsApp (+62…)'], ['contact.address','Alamat korespondensi'],
  ['contact.productUrl','Website resmi Siwride'], ['contact.instagram','Instagram'], ['contact.facebook','Facebook'], ['contact.linkedin','LinkedIn'],
  ['visuals.productName','Nama pada ilustrasi produk'], ['visuals.productRegion','Wilayah pada ilustrasi produk'],
] as const;
export function readPath(object: Record<string, any>, path: string) { const [group, key] = path.split('.'); return object[group][key]; }
export function applyContentForm(value: Record<string, any>, form: FormData, scope: string, section: string, pageId: EditorPageId = 'home', sectionId?: string) {
  if (scope === 'global') {
    for (const [path] of globalFields) {
      const [group, key] = path.split('.'); const text = String(form.get(path) || '').trim();
      if (text.length > 1200) throw new Error('Salah satu isian terlalu panjang.');
      value[group][key] = text;
    }
    if (!value.company.name || !value.company.brandTop || !value.company.brandBottom) throw new Error('Nama perusahaan dan kedua baris logo wajib diisi.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.contact.email)) throw new Error('Format email tidak valid.');
    if (!/^[0-9+ ().-]+$/.test(value.contact.phone)) throw new Error('Nomor telepon tidak valid.');
    const phoneDigits = value.contact.phone.replace(/[^0-9]/g, '');
    if (phoneDigits.length < 8 || phoneDigits.length > 16) throw new Error('Nomor telepon tidak valid.');
    value.contact.phoneHref = `+${phoneDigits}`;
    value.contact.whatsapp = phoneDigits;
    for (const key of ['productUrl','instagram','facebook','linkedin']) if (value.contact[key] && !/^https:\/\/[^\s]+$/.test(value.contact[key])) throw new Error('Tautan kanal resmi harus menggunakan https://.');
  } else {
    const selected = sectionId ? editorSection(pageId, sectionId) : undefined;
    const fields = selected?.fields || editorPage(pageId).fields;
    for (const { key, label, short } of fields) {
      const input = form.get(`message:${key}`);
      if (input === null) continue;
      const text = String(input).trim();
      if (!text || text.length > (short ? 300 : 5000)) throw new Error(`${label} wajib diisi, maksimal ${short ? '300' : '5.000'} karakter.`);
      value.messages[key] = text;
    }
    const collection = selected?.collection || (section === 'services' || section === 'partners' ? section : undefined);
    if (collection === 'services' || collection === 'partners') {
    const titles = form.getAll('item.title').map(String), descriptions = form.getAll('item.description').map(String), icons = form.getAll('item.icon').map(String);
    if (titles.length > 20 || titles.length !== descriptions.length) throw new Error('Daftar maksimal 20 item.');
    value[section] = titles.map((title, i) => {
      if (!title.trim() || title.length > 160 || !descriptions[i]?.trim() || descriptions[i].length > 1200) throw new Error('Judul dan deskripsi setiap item wajib diisi.');
      const icon = icons[i] || 'users';
      if (!['plane','compass','users','clock','mail','phone','pin'].includes(icon)) throw new Error('Ikon tidak valid.');
      return { number: String(i+1).padStart(2,'0'), title: title.trim(), description: descriptions[i].trim(), ...(collection === 'services' ? { icon } : {}) };
    });
    if (collection === 'partners') {
      const steps = form.getAll('step').map(item => String(item).trim());
      if (steps.length > 12 || steps.some(item => !item || item.length > 300)) throw new Error('Langkah kemitraan maksimal 12 item, masing-masing 300 karakter.');
      value.steps = steps;
    }
    } else if (section !== 'pages') throw new Error('Bagian konten tidak valid.');
  }
  return value;
}
