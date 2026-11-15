# Admin dan blog: penggunaan, pengujian, dan hosting

Admin berada di `/admin/`. Blog publik berada di `/blog/` dan `/id/blog/`. Arsitektur, modul, dan alur data dijelaskan di [RANCANGAN_ADMIN_BLOG.md](RANCANGAN_ADMIN_BLOG.md).

## Mulai di lokal

Gunakan **Node.js 24.22 atau lebih baru**, npm, dan project ini sebagai working directory.

```powershell
npm install
Copy-Item .env.example .env
npm run admin:create
npm run dev -- --background
```

Lewati penyalinan `.env` jika sudah memilikinya. Perintah `admin:create` menanyakan email, nama, dan password minimal 12 karakter. Input password terminal disembunyikan. Tidak ada akun atau password default. Untuk mengganti password akun yang terlupa, jalankan perintah yang sama dengan email akun tersebut; seluruh sesinya akan dicabut.

- Website: <http://localhost:4321/>
- Admin: <http://localhost:4321/admin/>
- Blog Indonesia: <http://localhost:4321/id/blog/>
- Status/log/stop: `npm run astro -- dev status`, `npm run astro -- dev logs`, `npm run astro -- dev stop`.

`var/cms/content.sqlite` dan `var/cms/uploads/` dibuat otomatis. Keduanya diabaikan Git dan tidak masuk `dist/`. Menghapus direktori ini menghapus akun, konten, dan media lokal; jangan menggunakannya untuk mereset tampilan.

Untuk otomasi akun, CLI mendukung `ADMIN_EMAIL`, `ADMIN_NAME`, dan `ADMIN_PASSWORD` melalui environment. Hapus environment password setelah digunakan; jangan menuliskannya di source, command history, atau file publik.

## Mengelola company profile

1. Masuk ke admin dan buka **Identitas & Kontak** untuk informasi bersama serta logo.
2. Buka **Konten Website**, pilih halaman, lalu gulir section-sectionnya. Pilih tab **Indonesia** atau **English** pada editor yang sama.
3. Pilih **Simpan draft**. Website publik masih menggunakan versi terbit sebelumnya.
4. Buka **Pratinjau draft tersimpan**. Jika ada perubahan belum disimpan, simpan terlebih dahulu.
5. Pilih **Terbitkan halaman** saat semua section halaman siap. Isi halaman aktif diterbitkan bersama; **Terbitkan identitas & kontak** tetap menerapkan informasi dan gambar bersama untuk kedua bahasa.
6. Riwayat di bawah editor memulihkan isi halaman aktif ke draft. Terbitkan lagi untuk menerapkannya ke publik.

Editor menampilkan satu halaman dengan section-section berurutan: hero beranda, tentang perusahaan, layanan Siwride, profil, produk, kemitraan, dan kontak. Setiap section hanya memuat isian yang dipakai bagian publik tersebut. Section yang memiliki gambar menampilkan preview dan kontrol unggah di sisi kanan. Daftar layanan hanya dikelola pada tab Daftar layanan. Nama menu, label tombol, teks sistem, serta struktur/metadata template tidak menjadi isian admin. Data lama tetap dipertahankan tanpa migrasi.

Layanan dan jenis mitra dapat ditambah, dihapus, dan diurutkan. Klik nama item untuk membuka isian. Daftarnya dipakai bersama oleh beranda dan halaman terkait pada bahasa yang sama. Perubahan struktur layout atau penambahan jenis halaman tetap merupakan perubahan kode.

Indonesia menjadi sumber penulisan. Setelah mengisi halaman, klik **Terjemahkan ke English** untuk menyimpan isian saat ini sebagai draft Indonesia sekaligus membuat draft English halaman yang sama. Editor berpindah ke English agar hasilnya dapat diperiksa dan diperbaiki. Jika halaman itu sudah punya draft English yang belum terbit, akan muncul peringatan dan konfirmasi sebelum menggantinya. Draft halaman lain dan label tetap dipertahankan.

Terjemahan tidak menerbitkan salah satu bahasa. Gunakan **Terbitkan halaman** pada tiap bahasa saat siap. Menyimpan draft Indonesia saja juga tidak mengubah English; jalankan tombol terjemahan lagi setelah revisi jika diperlukan. Jika layanan gagal atau versi Indonesia/English berubah di tab lain selama proses, kedua draft tersimpan tetap utuh. Isian Indonesia yang dikirim tetap ditampilkan agar bisa dicoba lagi, kecuali ada versi Indonesia yang lebih baru.

Selama proses, indikator penerjemahan ditampilkan dan isian dikunci sementara. Jika gagal, isian dapat diedit lagi. Konflik perubahan menyediakan tautan untuk memuat versi terbaru. Jika koneksi browser terputus, periksa draft tersimpan terlebih dahulu karena server mungkin sudah menyelesaikan penyimpanan.

### Mengaktifkan terjemahan otomatis

Integrasi menggunakan [Google Cloud Translation Basic v2](https://docs.cloud.google.com/translate/docs/reference/rest/v2/translate). Siapkan proyek Google Cloud dengan billing, aktifkan Cloud Translation API, lalu buat API key yang dibatasi untuk API tersebut. Atur kuota dan pemantauan biaya sesuai kebutuhan. Terjemahan dikenai ketentuan/harga Google dan hanya dipanggil setelah admin menekan tombol; tidak ada permintaan penerjemahan saat pengunjung membuka website.

Tambahkan `GOOGLE_TRANSLATE_API_KEY` pada `.env` lokal atau EnvironmentFile systemd produksi (`/etc/tigapilardewata-cms.env`), lalu restart aplikasi. API key hanya dibaca server; jangan gunakan prefix `PUBLIC_`, memasukkannya ke source, atau mengirimkannya lewat chat. Tidak perlu rebuild untuk mengganti key pada runtime produksi. Tanpa key, editor dan konten English lama tetap berfungsi; tombol terjemahan dinonaktifkan dengan keterangan konfigurasi belum aktif.

Hanya teks editorial halaman/bagian aktif yang dikirim ke Google, dengan bahasa sumber `id`, tujuan `en`, dan format teks biasa. Gambar, data akun, konfigurasi, label navigasi, ikon, dan nomor urutan tidak diterjemahkan. Permintaan dibagi menjadi batch maksimal 128 teks dan sekitar 5.000 karakter; seluruh proses memiliki batas waktu 20 detik. Hasil diperiksa terhadap batas panjang editor, kemudian dua draft disimpan dalam satu transaksi. Cakupan tombol ini adalah **Konten Website**; artikel blog tetap memakai editor versi bahasa tersendiri.

### Mengganti gambar perusahaan

Pada **Identitas & Kontak**, bagian **Gambar perusahaan** menampilkan preview logo dari draft tersimpan. Gambar hero dan gambar tentang perusahaan diubah langsung pada section masing-masing di **Konten Website**. Klik **Pilih gambar pengganti** pada gambar yang ingin diubah. Preview langsung menampilkan pilihan baru dengan keterangan **Belum disimpan**. **Batalkan penggantian** mengembalikan gambar tersimpan.

File baru diunggah saat **Simpan draft** atau **Terbitkan** ditekan. Tanpa file pengganti, gambar sebelumnya tetap digunakan. Draft belum mengganti gambar publik; **Terbitkan identitas & kontak** menerapkannya bersama untuk EN dan ID. Unggahan juga tersedia di Pustaka Media, sedangkan gambar lama tetap tersedia untuk riwayat.

Format yang didukung: JPEG, PNG, WebP, dan AVIF, maksimal **5 MB per gambar**. Ketiga gambar dapat diganti sekaligus; batas seluruh formulir adalah **16 MiB**. Gambar dioptimalkan menjadi WebP. Jika upload atau penyimpanan gagal, konten tersimpan tetap utuh dan unggahan baru dari permintaan gagal dibersihkan. Pilih ulang file sebelum mencoba menyimpan lagi.

## Mengelola blog

Daftar artikel berfokus pada tabel. Pencarian judul, filter bahasa/status, tombol **Terapkan**, dan **Tulis artikel** berada pada satu baris. Pada layar sempit, baris kontrol dan tabel dapat digeser horizontal di dalam panel. Tampilan kosong tetap berada di dalam tabel.

1. Tambahkan kategori ID/EN bila diperlukan.
2. Pilih **Tulis artikel**, isi judul, slug, ringkasan, penulis, dan isi.
3. Unggah sampul ke **Pustaka Media**, lalu pilih pada editor. Isi deskripsi alt jika menggunakan sampul.
4. Gunakan tombol format dan **Pratinjau isi** untuk memeriksa artikel. **Pratinjau draft tersimpan** menampilkan layout publik menggunakan draft yang terakhir disimpan.
5. **Terbitkan artikel** membuat artikel tersedia bagi pengunjung. Mengedit lalu menyimpan draft tidak mengubah versi yang sedang tayang.
6. Gunakan **Buat versi EN/ID** untuk menambahkan terjemahan. Isinya perlu ditulis dan diterbitkan tersendiri.
7. **Tarik dari publik** mengembalikan artikel menjadi draft. **Hapus** memindahkannya ke sampah dan menariknya dari publik. **Pulihkan** mengembalikannya sebagai draft.

Slug unik per bahasa. Mengubah slug artikel terbit membuat redirect 301 dari alamat lama. Riwayat slug tetap dimiliki artikel itu; mengganti artikel dengan artikel baru tidak mengambil alih URL lama. Terjemahan yang belum terbit tidak menjadi tautan switcher.

Artikel pertama tidak dibuat otomatis. Blog menampilkan keadaan kosong sampai pengelola menerbitkan artikel. Section artikel terbaru di beranda tetap tampil dengan keadaan kosong sampai ada artikel terbit pada bahasa tersebut.

## Konfigurasi

| Environment | Keterangan |
| --- | --- |
| `CMS_DATA_DIR` | Lokasi persisten SQLite dan unggahan; gunakan path absolut di server |
| `CMS_ORIGIN` | Origin HTTPS publik yang persis, tanpa trailing slash; pemeriksaan form dan cookie |
| `SITE_URL` | Origin saat build untuk canonical/alternate dan allowlist host; harus cocok dengan `CMS_ORIGIN` produksi |
| `HOST`, `PORT` | Listener aplikasi Node; produksi dibatasi ke loopback |
| `GOOGLE_TRANSLATE_API_KEY` | Opsional; API key server Google Cloud Translation Basic untuk tombol draft Indonesia → English |

`.env` digunakan CLI akun dan dev server. Untuk produksi, gunakan EnvironmentFile systemd; `npm start` biasa membaca environment proses, bukan otomatis memuat `.env`. Jika mencoba build lokal dengan `.env`, gunakan `node --env-file=.env dist/server/entry.mjs`.

Cookie Secure membutuhkan HTTPS. Nginx dan reverse proxy/tunnel harus mempertahankan Host domain publik. Domain publik masuk allowlist Astro saat build; jika domain berubah, lakukan build dan deploy ulang. Skrip CMS memeriksa kesesuaian origin build dan runtime sebelum aktivasi.

Indexing publik masih `noindex, nofollow` sesuai proyek awal. Pengaturan admin dan preview selalu non-indexable. Tanggal pada tampilan admin dan artikel mengikuti Asia/Jakarta.

## Verifikasi

```powershell
npm run check
npm run build
npm run test:cms
npm run test:i18n
npm run test:browser
```

`test:cms` menggunakan build standalone, direktori sementara, akun acak, dan database terpisah dari data lokal. Tes mencakup route EN/ID, metadata, aset, redirect/query, 404, login, sesi, CSRF, origin, publikasi, pemulihan konten, versi tab lama, CRUD blog, sanitasi XSS, terjemahan, slug/redirect, pagination, kategori, upload, referensi media, password, serta persistensi setelah restart.

Pengujian gambar perusahaan mencakup upload satu dan tiga gambar (masing-masing 5 MiB), draft/publik EN/ID, preview tersimpan, perlindungan gambar lama di riwayat, batas permintaan, serta pembersihan file dan metadata saat file berikutnya tidak valid, penyimpanan database gagal, atau versi berubah selama upload.

Pengujian terjemahan menggunakan respons Google yang disimulasikan dalam proses tes, tanpa memanggil layanan asli atau memakai API key lokal. Tes mencakup draft ID/EN, isian saat ini, layanan/kemitraan/langkah, batch, hasil tidak valid, kegagalan layanan, konflik versi sebelum/selama penerjemahan, dan rollback transaksi. Koneksi ke Google sebenarnya perlu diverifikasi di lingkungan yang sudah memiliki key aktif.

`test:i18n` menjalankan subset HTTP untuk mode SSR. `test:browser` menjalankan tes integrasi dan pemeriksaan browser memakai Chrome yang terpasang (`channel: chrome`). Jika Chrome belum terpasang, pasang Chrome atau sesuaikan channel pengujian. Tes browser memeriksa login, tambah/urut/simpan layanan, preview, editor artikel, kesalahan JavaScript, dan overflow 360/768/1440 px. Screenshot disimpan di `output/qa/`, diabaikan Git.

Tes browser juga memeriksa preview logo perusahaan, pembatalan, validasi ukuran, upload yang baru terjadi saat penyimpanan, simpan draft, publikasi, dan tampilan mobile pada Identitas & Kontak.

Untuk terjemahan, tes browser memeriksa konfirmasi penggantian draft English, pembatalan yang mempertahankan peringatan perubahan belum disimpan, indikator proses, tinjauan/perbaikan English, publikasi terpisah, kegagalan layanan, konflik tab lain, dan tampilan mobile.

Hasil verifikasi lokal 8 November 2026: pemeriksaan tipe lulus tanpa error/peringatan, build standalone lulus, tes integrasi serta browser lulus. Build juga diuji memakai origin HTTPS contoh melalui header reverse proxy: login diterima untuk origin yang benar, cookie Secure terpasang, dan origin lain ditolak. Sintaks Bash dan PowerShell deploy lulus. Nginx, systemd, instalasi dependensi Linux, dan aktivasi release belum diuji di Snail 2.

## Migrasi Snail 2 dari statis ke CMS

Konfigurasi statis lama dalam [DEPLOY_SNAIL2.md](DEPLOY_SNAIL2.md) merupakan catatan versi sebelumnya. Build baru mempunyai `dist/client/` dan `dist/server/`; **jangan menjadikan `dist/` root Nginx**. File server bukan aset publik.

Persiapan ini belum menjalankan perubahan pada server. Dibutuhkan Node.js 24.22+ dan npm pada server, `/usr/bin/node`, systemd, Nginx, serta origin HTTPS final. Siwride tidak dibutuhkan. SQLite lokal sudah disediakan oleh Node, tanpa server database tambahan.

Upload konfigurasi dari Windows:

```powershell
ssh ssh-snail-2 'mkdir -p /var/www/tigapilardewata/setup-cms'
scp -O deploy/snail2/cms/setup.sh deploy/snail2/cms/release.sh deploy/snail2/cms/nginx.conf deploy/snail2/cms/tigapilardewata-cms.service ssh-snail-2:/var/www/tigapilardewata/setup-cms/
ssh ssh-snail-2 'bash /var/www/tigapilardewata/setup-cms/setup.sh'
```

Setup menyiapkan user service `tpd-cms`, direktori persisten, unit systemd, dan release helper. Nginx tetap memakai konfigurasi sebelumnya sampai deployment CMS berhasil.

Di server, buat `/etc/tigapilardewata-cms.env` dengan editor dan isi berikut, menggunakan domain sesungguhnya:

```dotenv
CMS_ORIGIN=https://domain-final.example
```

Batasi izin file tersebut ke root (`chmod 600`). `CMS_ORIGIN` wajib HTTPS tanpa trailing slash. Port 46767 harus kosong untuk service CMS. Nginx tetap di port 6767; konfigurasi CMS menganggap HTTPS diterminasi oleh proxy/tunnel di depannya. Akses admin melalui domain HTTPS tersebut, bukan origin HTTP LAN. Health check lokal tetap tersedia.

Deploy dari Windows setelah persiapan dan domain tersedia:

```powershell
$env:SITE_URL = 'https://domain-final.example'
npm run deploy:snail2
Remove-Item Env:SITE_URL
```

Perintah npm yang sudah ada memilih skrip CMS ketika `output: 'server'`. Skrip memeriksa tipe, build, dan tes integrasi; kemudian mengunggah build, package manifest/lock, dan CLI akun. Dependensi Linux dipasang melalui `npm ci --omit=dev` pada release baru. Dependensi Windows dan data lokal tidak diunggah.

Aktivasi memakai symlink, restart systemd, health check, kemudian validasi/reload Nginx. Jika aktivasi gagal, aplikasi dan konfigurasi Nginx sebelumnya dipulihkan. Restart menyebabkan jeda singkat; mekanisme ini belum merupakan rolling deployment tanpa downtime. Lima release CMS sukses terakhir dipertahankan, termasuk target rollback.

Buat akun pertama pada server dengan user service dan lokasi data yang sama:

```bash
cd /var/www/tigapilardewata/cms/current
sudo -u tpd-cms env CMS_DATA_DIR=/var/www/tigapilardewata/cms/shared /usr/bin/node scripts/admin.mjs
```

CLI ini menanyakan kredensial secara interaktif. Akun lokal tidak otomatis disalin ke produksi.

Pemeriksaan dan rollback:

```powershell
npm run verify:snail2
npm run rollback:snail2
ssh ssh-snail-2 'systemctl status tigapilardewata-cms --no-pager'
ssh ssh-snail-2 'journalctl -u tigapilardewata-cms -n 50 --no-pager'
```

Rollback CMS menukar release kode dan memulai ulang proses; database/unggahan tetap menggunakan `shared/`. Rollback tidak membatalkan perubahan konten atau migrasi data. Versi saat ini memakai skema awal; perubahan skema berikutnya perlu migrasi yang kompatibel dengan release sebelumnya dan backup tersendiri.

Konfigurasi Nginx sebelum migrasi disimpan sebagai `/var/www/tigapilardewata/cms/nginx.pre-cms`. Jika perlu kembali sepenuhnya ke versi statis, salin konfigurasi tersebut ke site Nginx, jalankan `nginx -t`, reload, lalu hentikan service CMS. Release statis di direktori lama tidak dihapus oleh deployment CMS.

## Backup dan pemulihan data

Backup meliputi **seluruh `shared/`**, khususnya database dan `uploads/`. Menyalin `content.sqlite` saja saat aplikasi aktif tidak cukup karena mode WAL. Untuk backup konsisten sederhana, hentikan sementara service saat menyalin data, lalu nyalakan kembali:

```bash
sudo bash -eu <<'BACKUP'
base=/var/www/tigapilardewata/cms
mkdir -p "$base/backups"
chmod 700 "$base/backups"
systemctl stop tigapilardewata-cms
trap 'systemctl start tigapilardewata-cms' EXIT
tar --exclude=shared/npm-cache -czf "$base/backups/data-$(date -u +%Y%m%d%H%M%S).tar.gz" -C "$base" shared
chmod 600 "$base"/backups/data-*.tar.gz
BACKUP
```

Simpan salinan backup di lokasi di luar server sesuai kebijakan operasional. Untuk pemulihan, hentikan service, pindahkan `shared/` lama ke lokasi arsip yang sudah diverifikasi, ekstrak backup ke base CMS, perbaiki kepemilikan ke `tpd-cms:tpd-cms`, lalu mulai service dan periksa health serta login. Pulihkan database dan unggahan dari snapshot yang sama.

## Batas versi ini

Semua pengelola memiliki akses penuh; belum ada approval bertingkat, role editor, autosave, jadwal terbit, pemulihan password lewat email, maupun revision history artikel. Company profile memiliki riwayat sebelum publikasi. Media adalah aset publik. CMS dirancang untuk satu instance Node dengan SQLite pada disk lokal. Konfigurasi Linux disiapkan di repository; validasi Nginx/systemd dan migrasi aktual harus dilakukan pada Snail 2 saat deployment.
