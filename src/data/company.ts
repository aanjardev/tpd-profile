// Draft dari dokumen knowledge; tinjau sebelum publikasi.
export const company = {
  name: 'PT Tiga Pilar Dewata',
  tagline: 'Bersama Membangun Kualitas, Menghadirkan Nilai, Menciptakan Masa Depan.',
  description: 'PT Tiga Pilar Dewata menghadirkan Siwride, platform pemesanan kendaraan dan pengelolaan transportasi dengan fokus perjalanan di Bali.',
} as const;

export const navigation = [
  { href: '/', label: 'Beranda' },
  { href: '/tentang/', label: 'Tentang Kami' },
  { href: '/siwride/', label: 'Siwride' },
  { href: '/kemitraan/', label: 'Kemitraan' },
  { href: '/kontak/', label: 'Kontak' },
] as const;

export const contact = {
  email: 'info@siwride.com', phone: '+62 811-3810-5600', phoneHref: '+6281138105600',
  address: 'Jl. Mahendradatta Selatan, Gg. Robby William No. 99, Denpasar Barat, Bali',
};

export const services = [
  { number: '01', icon: 'plane', title: 'Airport Transfer', description: 'Antar-jemput bandara dan perjalanan langsung antarlokasi.' },
  { number: '02', icon: 'compass', title: 'Tour Package', description: 'Paket wisata ke beberapa destinasi di Bali.' },
  { number: '03', icon: 'users', title: 'Sharing Ride', description: 'Perjalanan bersama penumpang lain pada rute terjadwal.' },
  { number: '04', icon: 'clock', title: 'Hourly Service', description: 'Sewa kendaraan dengan pengemudi berdasarkan durasi perjalanan.' },
] as const;

export const values = [
  { number: '01', title: 'Membangun kualitas', description: 'Menempatkan mutu layanan dan perhatian pada kebutuhan pelanggan sebagai arah kerja.' },
  { number: '02', title: 'Menghadirkan nilai', description: 'Mengupayakan manfaat yang relevan bagi pelanggan, mitra, dan setiap perjalanan.' },
  { number: '03', title: 'Menciptakan masa depan', description: 'Membuka ruang untuk pembelajaran, kolaborasi, dan perbaikan yang berkelanjutan.' },
] as const;

export const partners = [
  { number: '01', title: 'Pelaku travel', description: 'Kerja sama untuk kebutuhan transportasi pelanggan travel.' },
  { number: '02', title: 'Pemandu wisata', description: 'Koordinasi transportasi untuk perjalanan wisata.' },
  { number: '03', title: 'Mitra transportasi', description: 'Kerja sama penyediaan layanan perjalanan melalui Siwride.' },
] as const;

export const steps = [
  { number: '01', title: 'Mulai percakapan', description: 'Perkenalkan usaha Anda dan sampaikan gambaran peluang kerja sama.' },
  { number: '02', title: 'Diskusikan kebutuhan', description: 'Bahas tujuan, lingkup, dan kesesuaian kebutuhan dengan tim kami.' },
  { number: '03', title: 'Tentukan langkah bersama', description: 'Tindak lanjuti hasil diskusi dan susun kesepakatan bila terdapat kecocokan.' },
] as const;
