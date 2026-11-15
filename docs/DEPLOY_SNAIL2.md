# Deploy Snail 2

> **Pembaruan 8 November 2026:** admin dan blog menggunakan Astro SSR + Node.js + SQLite. Panduan deploy yang berlaku untuk kode saat ini ada di [ADMIN_BLOG.md](ADMIN_BLOG.md#migrasi-snail-2-dari-statis-ke-cms). Dokumen di bawah merekam hosting statis sebelumnya. `npm run deploy:snail2` sekarang memilih alur CMS pada konfigurasi SSR; persiapan server CMS harus dilakukan lebih dahulu.

Website statis Astro dilayani oleh Nginx pada **HTTP port 6767**. Build dilakukan di Windows dengan Node.js 24 LTS dan npm; server tidak membutuhkan Node.js. Gunakan Windows OpenSSH (`ssh`, `scp`), `tar`, dan Windows PowerShell.

## Target dan handoff domain

- SSH: `ssh-snail-2` (konfigurasi lokal menggunakan Cloudflare Access).
- Origin pada server: `http://127.0.0.1:6767`.
- Origin melalui LAN: `http://192.168.1.34:6767`.
- Origin melalui Tailscale: `http://100.74.147.42:6767`.

Alamat ini ditemukan saat setup; periksa ulang jika jaringan berubah. Leader dapat mengarahkan reverse proxy atau Cloudflare Tunnel ke origin yang bisa dijangkau dari proxy tersebut, lalu mengatur domain dan HTTPS. Hostname SSH bukan endpoint HTTP publik. Tidak ada perubahan DNS, tunnel, atau firewall otomatis. Website mengasumsikan root domain, bukan subpath. Redirect Nginx memakai URL relatif agar tidak membocorkan port internal saat berada di belakang proxy HTTPS.

Setelah domain ditentukan, jalankan deploy dengan origin final:

```powershell
$env:SITE_URL = 'https://domain-final.example'
npm run deploy:snail2
Remove-Item Env:SITE_URL
```

Tanpa `SITE_URL`, canonical belum dikeluarkan. `noindex, nofollow` tetap aktif; persetujuan indexing merupakan pekerjaan terpisah.

## Setup awal / memperbarui konfigurasi deploy

Pastikan `ssh -o BatchMode=yes ssh-snail-2 true` berhasil. Public key komputer deploy harus terdaftar di `authorized_keys` user remote. Jangan memasukkan password atau private key ke repository. Alias ini menggunakan root; skrip setup membutuhkan hak root untuk Nginx.

Jalankan dari root project:

```powershell
npm ci
ssh ssh-snail-2 'mkdir -p /var/www/tigapilardewata/setup'
scp -O deploy/snail2/nginx.conf deploy/snail2/release.sh deploy/snail2/setup.sh ssh-snail-2:/var/www/tigapilardewata/setup/
ssh ssh-snail-2 'bash /var/www/tigapilardewata/setup/setup.sh'
npm run deploy:snail2
```

Periksa exit code setiap perintah sebelum melanjutkan. Setup memeriksa konflik port 6767 dan `nginx -t`, memasang konfigurasi terpisah, lalu reload Nginx. Jika validasi/reload gagal, konfigurasi sebelumnya dipulihkan. Jalankan setup lagi saat mengubah file di `deploy/snail2/`; deploy biasa hanya memperbarui konten website.

## Deploy dan rollback

```powershell
npm run deploy:snail2
npm run verify:snail2
npm run rollback:snail2
```

Deploy menjalankan build dan tes i18n terlebih dahulu. Hanya isi `dist/` dikemas dan diunggah, tanpa source internal atau kredensial. SCP menggunakan mode legacy `-O` untuk kompatibilitas server. Release diekstrak ke direktori baru, diperiksa, lalu symlink `current` diganti atomik. Pemeriksaan HTTP mencakup sepuluh route, bahasa EN/ID, aset, tiga redirect 301 beserta query, serta custom 404. Jika pemeriksaan gagal, symlink sebelumnya dipulihkan dan perintah berakhir dengan error. Gangguan upload tidak mengganti release aktif.

Lock server mencegah aktivasi bersamaan. Lima release sukses terakhir disimpan, termasuk release aktif dan target rollback. Rollback menukar release aktif dengan `previous` dan menjalankan pemeriksaan HTTP yang sama; tidak memerlukan build. Rollback tidak tersedia sebelum dua deploy sukses. Release gagal dan upload yang terputus dibiarkan untuk diagnosis, tidak ikut retensi release sukses.

## Lokasi dan pemeriksaan

- Konten: `/var/www/tigapilardewata/releases/<release-id>`.
- Symlink aktif / rollback: `/var/www/tigapilardewata/current`, `/var/www/tigapilardewata/previous`.
- Konfigurasi: `/etc/nginx/sites-available/tigapilardewata`, ditautkan dari `sites-enabled`.
- Log: `/var/log/nginx/tigapilardewata.access.log` dan `/var/log/nginx/tigapilardewata.error.log`.

```powershell
ssh ssh-snail-2 'readlink -f /var/www/tigapilardewata/current; nginx -t; systemctl is-active nginx'
ssh ssh-snail-2 'tail -n 50 /var/log/nginx/tigapilardewata.error.log'
ssh -N -o ExitOnForwardFailure=yes -L 16767:127.0.0.1:6767 ssh-snail-2
```

Dengan tunnel berjalan, buka `http://127.0.0.1:16767/` dan `/id/`. Tutup tunnel dengan Ctrl+C. Nginx berjalan sebagai service yang sudah enabled saat boot; dev server Astro tidak dipakai untuk hosting.

## Hasil verifikasi setup (6 November 2026)

Build dan tes i18n lulus dengan maupun tanpa `SITE_URL`. Dua deploy melalui perintah npm, rollback, pemeriksaan HTTP server, dan akses EN/ID lewat SSH tunnel berhasil. Uji release dengan locale rusak memulihkan release sebelumnya; lock menolak operasi bersamaan; enam release sukses menghasilkan retensi lima release dengan target rollback tetap tersedia. `nginx -t` lulus, service aktif dan enabled, listener terpasang pada `0.0.0.0:6767`.

Pada setup awal, akses langsung dari komputer setup melalui Tailscale mengalami timeout. Leader perlu memastikan konektivitas proxy ke origin; akses langsung lewat LAN belum diuji dari komputer ini. Koneksi lokal server dan SSH tunnel sudah terverifikasi saat setup awal.

Port kemudian dipindahkan ke **6767**. `nginx -t` dan seluruh pemeriksaan HTTP server lulus pada port baru; listener port lama sudah ditutup. Tidak diperlukan build ulang karena konten website tidak berubah.
