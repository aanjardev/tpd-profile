# PT Tiga Pilar Dewata

Company profile Astro SSR + TypeScript + CSS, dengan admin dan blog, terpisah dari Siwride. Gunakan Node.js 24.22+ dan npm.

Panduan admin, pembuatan akun, pengujian, backup, dan deployment CMS: [docs/ADMIN_BLOG.md](docs/ADMIN_BLOG.md). Rancangan modul dan data: [docs/RANCANGAN_ADMIN_BLOG.md](docs/RANCANGAN_ADMIN_BLOG.md).

## Menjalankan

```sh
npm install
npm run admin:create
npm run dev -- --background
npm run check
npm run build
npm start
```

Dev server: http://localhost:4321. Admin: `/admin/`; blog: `/blog/` dan `/id/blog/`. Buat akun dengan `npm run admin:create` (tanpa password bawaan). Mode background: `npm run dev -- --background`; kelola dengan `npm run astro -- dev status`, `dev logs`, dan `dev stop`. Build menghasilkan `dist/client/` serta `dist/server/`; jalankan server Node, jangan melayani root `dist/` langsung. URL dirancang untuk root domain. Data persisten berada di `CMS_DATA_DIR` (default `var/cms/`), di luar build.

## Halaman dan komponen

Enam halaman utama dalam dua bahasa, detail blog dinamis, 404, dan admin. Data awal di `src/data/company.ts` dan `src/i18n/messages.ts`; konten terbit dibaca dari SQLite melalui `src/cms/`. Komponen di `src/components/`, gaya publik di `src/styles/global.css`, dan gaya admin di `src/styles/admin.css`. Menu mendukung keyboard, Escape, navigasi aktif, serta penutupan saat fokus keluar.

## Multibahasa EN/ID

English adalah default. Bahasa mengikuti URL tanpa deteksi browser, cookie, atau penyimpanan preferensi.

| Halaman | EN | ID |
| --- | --- | --- |
| Beranda | `/` | `/id/` |
| Tentang | `/about/` | `/id/tentang/` |
| Siwride | `/siwride/` | `/id/siwride/` |
| Kemitraan | `/partnership/` | `/id/kemitraan/` |
| Kontak | `/contact/` | `/id/kontak/` |
| Blog | `/blog/` | `/id/blog/` |
| Artikel | `/blog/{slug}/` | `/id/blog/{slug}/` |

Pemetaan route dan helper locale ada di `src/i18n/index.ts`. Kamus awal di `src/i18n/messages.ts` menggunakan teks Indonesia sebagai key. Pengelola mengubah copy melalui admin; perubahan tersimpan di database. Saat menambah field melalui kode, siapkan data awal dan migrasi untuk database yang sudah ada pada kedua bahasa. Template halaman bersama ada di `src/templates/`; entry route hanya memilih locale. Gunakan `pathFor(page, locale)` untuk tautan internal dan teruskan locale ke komponen bersama.

Switcher `EN | ID` membuka halaman yang sama. Query dan hash dipertahankan dengan JavaScript; tanpa JavaScript tautan bahasa tetap bekerja dan menu mobile ditampilkan langsung. ID section sama untuk kedua bahasa.

URL lama `/tentang/`, `/kemitraan/`, `/kontak/` memakai HTTP 301 dari middleware ke versi Indonesia, mempertahankan query. 404 dirender di server sesuai bahasa URL, termasuk tanpa JavaScript. Detail blog memakai pasangan slug terjemahan yang sudah terbit; terjemahan yang belum terbit tidak menjadi tautan switcher.

Set environment variable `SITE_URL` ke origin domain produksi sebelum `npm run build` untuk canonical dan alternate URL absolut. Jika belum diatur, canonical tidak dikeluarkan dan alternate menggunakan path lokal. `noindex, nofollow` tetap dipertahankan. Tidak ada deployment atau perubahan indexing otomatis.

Desain mengikuti struktur Hoolix dari folder `template/` (codewithsadee/Hoolix), dengan palet putih, abu kebiruan, navy, dan aksen emas. Radius 2–4 px. Font Inter 400/500/600/700 dari `@fontsource/inter` dipaketkan lokal oleh Astro. Ikon Phosphor regular dari `@phosphor-icons/core` menjadi SVG inline melalui komponen `Icon`; tidak memakai React atau CDN. Lisensi aset disertakan di `public/licenses/`.

## Logo dan visual

`public/logo.jpeg` adalah sumber asli dan tidak diubah. `docs/assets/symbol-source.png` merupakan turunan transparan imagegen, bukan tracing vektor presisi. Simbol, PNG 16/32/48/180/192, dan ICO 16/32/48 tersedia di `public/brand/`. Regenerasi ukuran: `node scripts/prepare-icons.mjs`.

Visual hero/about dibuat dengan imagegen bertema perjalanan dan arsitektur Bali; bukan dokumentasi lokasi operasional, armada, atau properti PT. Sumber PNG di `docs/assets/generated/`, WebP 640/1200 px di `public/images/`. Visual Siwride merupakan ilustrasi konsep, bukan screenshot aplikasi. Tidak ada caption placeholder pada tampilan publik.

## Catatan internal sebelum publikasi

Website disiapkan untuk presentasi klien tanpa catatan draft atau placeholder di halaman. Status verifikasi sumber tetap berlaku: kontak/alamat berasal dari materi Siwride, kategori layanan dan bentuk kemitraan perlu ditinjau, kanal resmi produk/WhatsApp belum divalidasi. Tidak ada statistik, testimoni, legalitas, atau sejarah rekaan. Tema nilai usulan tidak ditampilkan.

`docs/COMPANY_PROFILE_KNOWLEDGE.md` tetap menjadi brief internal dan tidak masuk build. Domain/canonical dan gambar berbagi belum ditetapkan. `noindex, nofollow` dipertahankan sampai publikasi disetujui. Jangan menyimpan dokumen internal atau kredensial di `public/`.

## Verifikasi

Deployment CMS Snail 2 (Nginx port 6767, Node loopback port 46767), setup awal, domain HTTPS, deploy, rollback, dan backup dijelaskan di [docs/ADMIN_BLOG.md](docs/ADMIN_BLOG.md). [docs/DEPLOY_SNAIL2.md](docs/DEPLOY_SNAIL2.md) menyimpan catatan hosting statis sebelumnya. Migrasi server belum dijalankan otomatis.

Jalankan `npm run check`, `npm run build`, lalu `npm run test:cms`. `npm run test:i18n` menjalankan subset route/bahasa melalui HTTP. Tes CMS memakai database sementara terpisah dan memeriksa 12 route utama, aset, metadata, login, CSRF, origin, draft/preview/publikasi, riwayat konten, CRUD blog/kategori, terjemahan, redirect slug, pagination, media, password, dan persistensi setelah restart. `npm run test:browser` membutuhkan Chrome terpasang dan menambahkan pengujian interaksi serta lebar 360/768/1440.

Pemeriksaan browser sebelum publikasi: kedua bahasa pada lebar 360/768/1440, tidak ada overflow, switcher tetap di halaman yang sama, akses langsung/refresh, menu dengan keyboard dan Escape, serta navigasi tanpa JavaScript. Verifikasi status redirect dan 404 pada hosting tujuan. Screenshot dan laporan lokal berada di `output/qa/` (diabaikan Git).

## Pemisahan section dan interaksi

Hero memakai biru dingin berpola grid, konten profil putih, layanan navy bermotif diagonal, dan CTA biru muda dengan pembatas emas. Padding section 112 px desktop, 88 px tablet, dan 72 px ponsel. Hover tombol/nav/kartu mengubah warna permukaan penuh, menambah garis emas, bayangan, serta pergeseran kecil; focus-visible pada kontrol memakai efek setara. Preferensi reduced motion mematikan transisi. Hover diuji melalui computed style dan screenshot di `output/qa/`.
