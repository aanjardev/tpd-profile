# PT Tiga Pilar Dewata

Company profile statis Astro + TypeScript + CSS, terpisah dari Siwride. Gunakan Node.js 24 LTS dan npm.

## Menjalankan

```sh
npm install
npm run dev
npm run build
npm run preview
```

Dev server: http://localhost:4321. Mode background: `npm run dev -- --background`. Hasil publikasi ada di `dist/`; hosting mengarahkan error ke `404.html`. URL dirancang untuk root domain.

## Halaman dan komponen

Lima halaman dalam dua bahasa, serta 404. Data bersama di `src/data/company.ts`, komponen di `src/components/`, gaya di `src/styles/global.css`. Menu mendukung keyboard, Escape, navigasi aktif, serta penutupan saat fokus keluar.

## Multibahasa EN/ID

English adalah default. Bahasa mengikuti URL tanpa deteksi browser, cookie, atau penyimpanan preferensi.

| Halaman | EN | ID |
| --- | --- | --- |
| Beranda | `/` | `/id/` |
| Tentang | `/about/` | `/id/tentang/` |
| Siwride | `/siwride/` | `/id/siwride/` |
| Kemitraan | `/partnership/` | `/id/kemitraan/` |
| Kontak | `/contact/` | `/id/kontak/` |

Pemetaan route dan helper locale ada di `src/i18n/index.ts`. Kamus bertipe di `src/i18n/messages.ts` menggunakan teks Indonesia sebagai key; tambahkan entri pada kedua bahasa saat mengubah copy. Template halaman bersama ada di `src/templates/`; entry route hanya memilih locale. Gunakan `pathFor(page, locale)` untuk tautan internal dan teruskan locale ke komponen bersama.

Switcher `EN | ID` membuka halaman yang sama. Query dan hash dipertahankan dengan JavaScript; tanpa JavaScript tautan bahasa tetap bekerja dan menu mobile ditampilkan langsung. ID section sama untuk kedua bahasa.

URL lama `/tentang/`, `/kemitraan/`, `/kontak/` memakai redirect statis Astro ke versi Indonesia. Hosting harus melayani hasil `dist/` dan menggunakan `404.html` untuk path tidak ditemukan. Tanpa adapter, redirect berupa halaman HTML; HTTP 301 memerlukan konfigurasi hosting. 404 default English, lalu konten, metadata, navigasi, dan footer berubah ke Indonesia untuk path `/id/` melalui JavaScript.

Set environment variable `SITE_URL` ke origin domain produksi sebelum `npm run build` untuk canonical dan alternate URL absolut. Jika belum diatur, canonical tidak dikeluarkan dan alternate menggunakan path lokal. `noindex, nofollow` tetap dipertahankan. Tidak ada deployment atau perubahan indexing otomatis.

Desain mengikuti struktur Hoolix dari folder `template/` (codewithsadee/Hoolix), dengan palet putih, abu kebiruan, navy, dan aksen emas. Radius 2–4 px. Font Inter 400/500/600/700 dari `@fontsource/inter` dipaketkan lokal oleh Astro. Ikon Phosphor regular dari `@phosphor-icons/core` menjadi SVG inline melalui komponen `Icon`; tidak memakai React atau CDN. Lisensi aset disertakan di `public/licenses/`.

## Logo dan visual

`public/logo.jpeg` adalah sumber asli dan tidak diubah. `docs/assets/symbol-source.png` merupakan turunan transparan imagegen, bukan tracing vektor presisi. Simbol, PNG 16/32/48/180/192, dan ICO 16/32/48 tersedia di `public/brand/`. Regenerasi ukuran: `node scripts/prepare-icons.mjs`.

Visual hero/about dibuat dengan imagegen bertema perjalanan dan arsitektur Bali; bukan dokumentasi lokasi operasional, armada, atau properti PT. Sumber PNG di `docs/assets/generated/`, WebP 640/1200 px di `public/images/`. Visual Siwride merupakan ilustrasi konsep, bukan screenshot aplikasi. Tidak ada caption placeholder pada tampilan publik.

## Catatan internal sebelum publikasi

Website disiapkan untuk presentasi klien tanpa catatan draft atau placeholder di halaman. Status verifikasi sumber tetap berlaku: kontak/alamat berasal dari materi Siwride, kategori layanan dan bentuk kemitraan perlu ditinjau, kanal resmi produk/WhatsApp belum divalidasi. Tidak ada statistik, testimoni, legalitas, atau sejarah rekaan. Tema nilai usulan tidak ditampilkan.

`docs/COMPANY_PROFILE_KNOWLEDGE.md` tetap menjadi brief internal dan tidak masuk build. Domain/canonical dan gambar berbagi belum ditetapkan. `noindex, nofollow` dipertahankan sampai publikasi disetujui. Jangan menyimpan dokumen internal atau kredensial di `public/`.

## Verifikasi

Jalankan `npm run build` lalu `npm run test:i18n` (Node.js 24). Build menghasilkan sepuluh halaman utama, satu 404, dan tiga halaman redirect. Tes memeriksa kesamaan key kamus, route dua arah, metadata, tautan/aset, navigasi sesuai locale, redirect, query/hash switcher, serta pemilihan bahasa 404.

Pemeriksaan browser sebelum publikasi: kedua bahasa pada lebar 360/768/1440, tidak ada overflow, switcher tetap di halaman yang sama, akses langsung/refresh, menu dengan keyboard dan Escape, serta navigasi tanpa JavaScript. Verifikasi status redirect dan 404 pada hosting tujuan. Screenshot dan laporan lokal berada di `output/qa/` (diabaikan Git).

## Pemisahan section dan interaksi

Hero memakai biru dingin berpola grid, konten profil putih, layanan navy bermotif diagonal, dan CTA biru muda dengan pembatas emas. Padding section 112 px desktop, 88 px tablet, dan 72 px ponsel. Hover tombol/nav/kartu mengubah warna permukaan penuh, menambah garis emas, bayangan, serta pergeseran kecil; focus-visible pada kontrol memakai efek setara. Preferensi reduced motion mematikan transisi. Hover diuji melalui computed style dan screenshot di `output/qa/`.
