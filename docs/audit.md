# Audit dan arahan mockup

## Hasil

- Mockup beranda: [mockup/index.html](./mockup/index.html)
- Dokumen audit dan arahan kerja: `docs/audit.md`

Mockup dipisah per halaman dan memakai stylesheet serta JavaScript bersama di `docs/mockup/assets/`.

Halaman yang tersedia:

- Beranda: `docs/mockup/index.html`
- Perusahaan: `docs/mockup/about.html`
- Siwride: `docs/mockup/siwride.html`
- Kemitraan: `docs/mockup/partnership.html`
- Kontak: `docs/mockup/contact.html`
- Blog: `docs/mockup/blog/index.html`
- Contoh artikel: `docs/mockup/blog/menyiapkan-perjalanan.html` dan `docs/mockup/blog/memilih-layanan.html`

Setiap halaman punya alamat HTML tersendiri dan navigasi saling terhubung. Mockup belum menggantikan halaman Astro atau mengubah alur produksi.

## Ringkasan audit

### Yang sudah kuat

- Situs dibangun dengan Astro sebagai situs statis. Tidak ada kebutuhan backend atau database untuk company profile.
- Lima halaman memiliki template bersama dan tersedia dalam bahasa Inggris serta Indonesia.
- Data perusahaan, rute, dan kamus terpusat di `src/data/company.ts` dan `src/i18n/`.
- Font dan ikon dibundel lokal, gambar tersedia dalam format WebP, dan komponen visual dapat digunakan ulang.
- Implementasi sudah menyediakan skip link, state fokus keyboard, menu ponsel, dan dukungan reduced motion.
- `noindex, nofollow` masih aktif, sesuai status situs yang belum disetujui untuk publikasi.

### Perubahan yang disarankan

1. **Jelaskan hubungan perusahaan dan produk sejak bagian pertama.** Beranda sekarang memakai narasi umum tentang transportasi dan perjalanan. Mockup menyebut Siwride secara langsung sebagai produk PT Tiga Pilar Dewata.
2. **Pisahkan jalur calon pengguna dan calon mitra.** Navigasi memberi halaman khusus untuk Siwride dan kemitraan supaya pengunjung dapat memilih informasi yang sesuai.
3. **Tampilkan layanan sebagai kategori, bukan janji ketersediaan.** Empat kategori pada mockup berasal dari data proyek. Tim perlu memastikan layanan tersebut masih aktif sebelum menulis detail atau memasang tautan pemesanan.
4. **Pakai visual yang membangun kepercayaan.** Gambar Bali yang tersedia adalah ilustrasi konseptual. Ganti dengan foto produk, kegiatan, atau tim yang benar dan telah mendapat izin, bila ada.
5. **Buat CTA menyebut tindakan yang jelas.** Kurangi pengulangan tombol umum seperti “Hubungi Kami”. Gunakan label yang menyebut tujuan, misalnya pertanyaan tentang Siwride atau diskusi kemitraan.
6. **Rapikan CSS sebelum pengerjaan lanjutan.** `src/styles/global.css` memiliki beberapa aturan dan breakpoint yang ditambahkan berulang. Saat implementasi, satukan aturan per komponen agar perubahan berikutnya lebih mudah dipelihara.

## Arahan visual dan interaksi

- Arah desain: jurnal editorial perjalanan dengan warna navy, hijau redup, putih hangat, dan aksen pasir yang mengambil warna logo.
- Pakai komposisi asimetris, judul serif yang tegas, label kecil, garis tipis, dan motif tiga pilar. Hindari susunan kartu seragam, ornamen generik, gradasi, dan slogan yang tidak memberi informasi.
- Utamakan kalimat langsung yang menjelaskan perusahaan dan produk. Pakai kata-kata puitis hanya jika memang sesuai dengan suara merek yang disetujui.
- Mockup memakai gambar lokal `public/images/bali-journey.webp` dan `public/images/bali-connections.webp`. Teks alternatif menandai keduanya sebagai ilustrasi.
- Simbol tiga pilar di header merupakan motif CSS untuk mockup. Gunakan aset logo resmi pada implementasi final bila ukuran dan versinya sesuai.
- Animasi terdiri dari kemunculan hero, reveal saat bagian halaman masuk viewport, dan transisi ringan. Semua animasi berhenti saat `prefers-reduced-motion` aktif.
- Pastikan versi implementasi tetap nyaman di layar ponsel, keyboard, dan tanpa JavaScript. Reveal tidak menyembunyikan konten jika JavaScript atau `IntersectionObserver` tidak tersedia.

Artikel blog adalah contoh draf editorial. Tinjau isi, gaya bahasa, dan kecocokan informasinya sebelum dipublikasikan.

## Konten yang perlu dikonfirmasi

- Deskripsi final PT dan cara resmi menjelaskan hubungannya dengan Siwride.
- Daftar layanan Siwride yang masih tersedia, nama layanan, serta wilayah dan batas ketersediaannya.
- Tautan resmi Siwride untuk melihat produk atau memulai pemesanan.
- Email dan nomor telepon yang masih aktif. Mockup memakai `info@siwride.com` dan `+62 811-3810-5600` dari data proyek, tetapi keduanya belum diuji langsung.
- Apakah alamat perlu ditampilkan. Alamat di data proyek berstatus alamat kontak awal, bukan konfirmasi domisili legal perusahaan.
- Foto produk, tim, atau kegiatan yang dapat dipakai dan memiliki izin penggunaan.
- Ejaan nama legal, domain, metadata, dan keputusan indexing sebelum publikasi.

Jangan menambahkan tahun berdiri, nama pendiri, legalitas, angka pengguna/armada, testimoni, atau klaim layanan tanpa sumber yang disetujui.

## Catatan repository

Saat audit dilakukan, `Containerfile` di root proyek tampil sebagai file yang belum dilacak Git. Putuskan apakah file tersebut bagian dari repository agar proses build container tersedia bagi anggota tim.

## Batas audit

Audit ini membaca source code, konfigurasi, dan brief internal secara statis. Saya tidak memverifikasi kanal kontak, operasional Siwride, maupun ketersediaan layanan secara langsung. Mockup adalah arah visual dan konten untuk ditinjau, bukan persetujuan final. Tidak ada file aplikasi Astro yang diubah dalam pekerjaan ini.
