import { en, id } from '../i18n/messages';
import { company, contact, services, partners } from '../data/company';

export type Locale = 'en' | 'id';
export const locales: Locale[] = ['en', 'id'];
export const globalDefaults = {
  company: { ...company, brandTop: 'PT TIGA PILAR', brandBottom: 'DEWATA', footerLocation: 'Bali, Indonesia' },
  contact: { ...contact, productUrl: '', instagram: '', facebook: '', linkedin: '', whatsapp: '' },
  visuals: { logo: '/brand/symbol.png', hero: '/images/bali-journey.webp', about: '/images/bali-connections.webp', productName: 'SIWRIDE', productRegion: 'BALI · INDONESIA' },
};
export const extraMessages = {
  en: { Blog: 'Blog', 'Artikel & Kabar': 'Articles & News', 'Cerita, informasi perjalanan, dan kabar terbaru dari PT Tiga Pilar Dewata.': 'Stories, travel insights, and the latest news from PT Tiga Pilar Dewata.', 'Baca artikel': 'Read article', 'Semua artikel': 'All articles', 'Cari artikel': 'Search articles', 'Semua kategori': 'All categories', 'Belum ada artikel.': 'No articles yet.', 'Artikel terkait': 'Related articles', 'Kembali ke blog': 'Back to blog', 'Terbaru dari kami': 'Latest from us', Sebelumnya: 'Previous', Berikutnya: 'Next', Cari: 'Search', 'Bagikan artikel': 'Share article', 'Pesan untuk Kami': 'Message us', 'Hubungi kami': 'Contact us', 'Kirim pertanyaan atau kebutuhan kerja sama. Tim kami akan membaca pesan Anda.': 'Send your question or partnership request. Our team will read your message.', Nama: 'Name', 'Nomor telepon': 'Phone number', Pesan: 'Message', 'Kirim pesan': 'Send message', 'Pesan berhasil dikirim. Terima kasih.': 'Message sent. Thank you.', 'Periksa isian formulir, lalu coba lagi.': 'Check the form fields and try again.' },
  id: { Blog: 'Blog', 'Artikel & Kabar': 'Artikel & Kabar', 'Cerita, informasi perjalanan, dan kabar terbaru dari PT Tiga Pilar Dewata.': 'Cerita, informasi perjalanan, dan kabar terbaru dari PT Tiga Pilar Dewata.', 'Baca artikel': 'Baca artikel', 'Semua artikel': 'Semua artikel', 'Cari artikel': 'Cari artikel', 'Semua kategori': 'Semua kategori', 'Belum ada artikel.': 'Belum ada artikel.', 'Artikel terkait': 'Artikel terkait', 'Kembali ke blog': 'Kembali ke blog', 'Terbaru dari kami': 'Terbaru dari kami', Sebelumnya: 'Sebelumnya', Berikutnya: 'Berikutnya', Cari: 'Cari', 'Bagikan artikel': 'Bagikan artikel', 'Pesan untuk Kami': 'Pesan untuk Kami', 'Hubungi kami': 'Hubungi kami', 'Kirim pertanyaan atau kebutuhan kerja sama. Tim kami akan membaca pesan Anda.': 'Kirim pertanyaan atau kebutuhan kerja sama. Tim kami akan membaca pesan Anda.', Nama: 'Nama', 'Nomor telepon': 'Nomor telepon', Pesan: 'Pesan', 'Kirim pesan': 'Kirim pesan', 'Pesan berhasil dikirim. Terima kasih.': 'Pesan berhasil dikirim. Terima kasih.', 'Periksa isian formulir, lalu coba lagi.': 'Periksa isian formulir, lalu coba lagi.' },
};
export function localeDefaults(locale: Locale) {
  const messages: Record<string, string> = { ...(locale === 'en' ? en : id), ...extraMessages[locale] };
  return {
    messages,
    services: services.map(item => ({ ...item, title: messages[item.title] || item.title, description: messages[item.description] || item.description })),
    partners: partners.map(item => ({ ...item, title: messages[item.title] || item.title, description: messages[item.description] || item.description })),
    steps: ['Perkenalkan usaha Anda', 'Diskusikan kebutuhan', 'Bahas rencana kerja sama'].map(title => messages[title] || title),
  };
}
export type GlobalContent = typeof globalDefaults;
export type LocalContent = ReturnType<typeof localeDefaults>;
export type SiteContent = GlobalContent & LocalContent;
