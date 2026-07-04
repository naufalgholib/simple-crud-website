# Simple CRUD Benchmark

Aplikasi CRUD sederhana berbasis Docker untuk pengujian performa menggunakan Apache JMeter. Repo ini berisi frontend minimal, REST API backend, database MySQL, script smoke test, script restore baseline, dan beberapa test plan JMeter untuk skenario write-heavy, read-heavy, dan mixed read/write workload.

## Kondisi repo saat ini

- Aplikasi dijalankan menggunakan Docker Compose dengan 3 service utama: `database`, `backend`, dan `frontend`.
- Database menggunakan MySQL 8.4 dan schema utama bernama `crud_db`.
- Tabel utama adalah `items` dengan kolom `id`, `name`, `description`, `price`, `quantity`, `created_at`, dan `updated_at`.
- Backend menyediakan REST API CRUD di path `/api/*`.
- Frontend Vue disajikan oleh Nginx pada port `8080` dan meneruskan request `/api/*` ke backend.
- File `database/baseline-250k.sql` menghasilkan baseline deterministik **250.000 row**.
- Script `scripts/restore-baseline-250k.sh` melakukan restore baseline 250k ke tabel `crud_db.items`.
- Test plan JMeter utama berada di folder `benchmark/`:
  - `create-write-heavy.jmx`
  - `read-only-random-id.jmx`
  - `mixed-read-write.jmx`

## Stack

- Frontend: Vue 3, Vite, dan Nginx
- Backend: Node.js 24 + Fastify + `mysql2`
- Database: MySQL 8.4 LTS / InnoDB
- Orkestrasi: Docker Compose
- Benchmark: Apache JMeter 5.6.x

## Struktur proyek

```text
.
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js
│       └── server.js
├── benchmark/
│   ├── create-write-heavy.jmx
│   ├── mixed-read-write.jmx
│   └── read-only-random-id.jmx
├── database/
│   ├── init.sql
│   └── baseline-250k.sql
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── src/
│       └── App.vue
├── scripts/
│   ├── smoke-test.sh
│   └── restore-baseline-250k.sh
├── .env.example
├── docker-compose.yml
└── README.md
```

## Menjalankan aplikasi

Persyaratan:

- Docker Engine
- Docker Compose plugin

Kredensial bawaan hanya ditujukan untuk lab/benchmark, bukan deployment publik.

```bash
docker compose up --build -d
```

Akses service:

| Service | URL / Port | Keterangan |
|---|---:|---|
| Frontend | `http://localhost:8080` | UI Vue melalui Nginx |
| Backend API | `http://localhost:3000/api` | REST API langsung ke Fastify |
| Health check | `http://localhost:3000/api/health` | Cek backend dan database |
| MySQL | `localhost:3306` | Port database dari host |

Cek status container:

```bash
docker compose ps
```

Jalankan smoke test CRUD:

```bash
./scripts/smoke-test.sh
```

Smoke test akan menunggu API sehat, membuat 1 item sementara, membaca item tersebut, update, lalu delete kembali.

Lihat log:

```bash
docker compose logs -f
```

Hentikan aplikasi tanpa menghapus data MySQL:

```bash
docker compose down
```

Hentikan aplikasi dan hapus volume database:

```bash
docker compose down -v
```

## Konfigurasi `.env`

Salin `.env.example` menjadi `.env` bila ingin mengubah parameter default.

```bash
cp .env.example .env
docker compose up --build -d
```

Parameter yang tersedia:

| Parameter | Default | Fungsi |
|---|---:|---|
| `MYSQL_USER` | `crud_user` | User database aplikasi |
| `MYSQL_PASSWORD` | `crud_password` | Password user database aplikasi |
| `MYSQL_ROOT_PASSWORD` | `root_password` | Password root MySQL |
| `MYSQL_PORT` | `3306` | Port MySQL pada host |
| `MYSQL_MAX_CONNECTIONS` | `200` | Batas koneksi MySQL |
| `MYSQL_INNODB_BUFFER_POOL_SIZE` | `256M` | Ukuran InnoDB buffer pool |
| `DB_CONNECTION_LIMIT` | `20` | Ukuran pool koneksi MySQL per worker backend |
| `WEB_CONCURRENCY` | `0` | `0` berarti otomatis mengikuti jumlah CPU yang terlihat oleh container; angka positif mengunci jumlah worker |
| `LOG_LEVEL` | `warn` | Level log Fastify |
| `BACKEND_PORT` | `3000` | Port backend pada host |
| `FRONTEND_PORT` | `8080` | Port frontend pada host |

Untuk eksperimen ilmiah, pertahankan semua parameter tetap sama pada setiap skenario, kecuali parameter yang memang menjadi variabel penelitian.

## Database dan baseline 250.000 row

Saat container database pertama kali dibuat, file `database/init.sql` akan membuat database `crud_db`, membuat tabel `items`, dan memasukkan 3 sample item awal.

Untuk skenario read-only dan mixed workload, gunakan baseline deterministik dari file:

```text
database/baseline-250k.sql
```

Karakteristik baseline:

- Total row: `250000`
- ID kontinu dari `1` sampai `250000`
- Isi data deterministik sehingga setiap VM mendapatkan dataset yang identik
- `description` dibuat berukuran tetap 256 karakter
- Timestamp dan nilai numerik dihasilkan secara deterministik
- Setelah import, `AUTO_INCREMENT` menjadi `250001`

> **Peringatan:** proses restore menjalankan `TRUNCATE TABLE items`, sehingga semua data existing pada tabel `crud_db.items` akan dihapus.

Restore baseline:

```bash
git pull --ff-only
docker compose up -d
sh scripts/restore-baseline-250k.sh
```

Restore baseline tanpa prompt konfirmasi, misalnya untuk automation eksperimen:

```bash
FORCE=1 sh scripts/restore-baseline-250k.sh
```

Import manual tanpa helper script:

```bash
docker compose exec -T database sh -ec \
  'mysql --protocol=socket -uroot -p"$MYSQL_ROOT_PASSWORD" crud_db' \
  < database/baseline-250k.sql
```

Verifikasi jumlah row:

```bash
docker compose exec -T database sh -ec \
  'mysql --protocol=socket -uroot -p"$MYSQL_ROOT_PASSWORD" -e \
  "SELECT COUNT(*) AS total, MIN(id) AS min_id, MAX(id) AS max_id FROM crud_db.items;"'
```

Hasil yang diharapkan:

```text
total   min_id   max_id
250000  1        250000
```

Cek nilai `AUTO_INCREMENT`:

```bash
docker compose exec -T database sh -ec \
  'mysql --protocol=socket -uroot -p"$MYSQL_ROOT_PASSWORD" -e \
  "SELECT AUTO_INCREMENT FROM information_schema.tables WHERE table_schema = '\''crud_db'\'' AND table_name = '\''items'\'';"'
```

Hasil yang diharapkan:

```text
AUTO_INCREMENT
250001
```

Untuk JMeter read-only dan mixed workload, gunakan range ID baseline tetap:

```text
GET /api/items/${__Random(1,250000)}
```

Jika mixed workload juga membuat data baru, data baru akan mulai dari ID `250001`. Untuk menjaga working set baca tetap identik pada seluruh pengulangan, range GET sebaiknya tetap `1–250000`.

## REST API

Base URL backend langsung:

```text
http://localhost:3000/api
```

Jika request melewati frontend/Nginx, gunakan:

```text
http://localhost:8080/api
```

Endpoint yang tersedia:

| Method | Endpoint | Fungsi |
|---|---|---|
| `GET` | `/api` | Informasi service dan daftar endpoint |
| `GET` | `/api/health` | Health check backend dan database |
| `GET` | `/api/items?page=1&limit=20&search=` | Daftar item dengan pagination dan pencarian |
| `GET` | `/api/items/:id` | Mengambil satu item berdasarkan ID |
| `POST` | `/api/items` | Membuat item baru |
| `PUT` | `/api/items/:id` | Memperbarui item berdasarkan ID |
| `DELETE` | `/api/items/:id` | Menghapus item berdasarkan ID |

Query parameter untuk `GET /api/items`:

| Parameter | Default | Batas | Keterangan |
|---|---:|---:|---|
| `page` | `1` | minimum `1` | Nomor halaman |
| `limit` | `20` | `1–100` | Jumlah data per halaman |
| `search` | kosong | max 150 karakter | Mencari pada `name` atau `description` |

Urutan default list adalah `id DESC`. Saat ini backend belum menyediakan parameter `sort` atau `order`.

Contoh body `POST` atau `PUT`:

```json
{
  "name": "SSD NVMe 1TB",
  "description": "Data pengujian",
  "price": 1200000,
  "quantity": 5
}
```

Contoh create item:

```bash
curl -X POST http://localhost:3000/api/items \
  -H 'Content-Type: application/json' \
  -d '{"name":"Item Test","description":"Benchmark","price":10000,"quantity":10}'
```

Contoh read item:

```bash
curl http://localhost:3000/api/items/1
```

Contoh list item:

```bash
curl 'http://localhost:3000/api/items?page=1&limit=20&search=Benchmark'
```

## Frontend

Frontend tersedia pada:

```text
http://localhost:8080
```

Fitur UI saat ini:

- Menampilkan daftar item dengan pagination
- Search berdasarkan nama atau deskripsi
- Tambah item
- Edit item
- Hapus item
- Menampilkan total record

Nginx pada container frontend meneruskan request `/api/*` ke service backend internal `backend:3000`.

## Backend worker dan koneksi database

Backend dijalankan melalui `backend/src/index.js` menggunakan Node.js cluster.

Perilaku `WEB_CONCURRENCY`:

- `WEB_CONCURRENCY=0`: jumlah worker otomatis mengikuti jumlah CPU yang terlihat oleh container.
- `WEB_CONCURRENCY=<angka positif>`: jumlah worker dikunci sesuai angka tersebut.

Setiap worker membuat connection pool sendiri ke MySQL. Karena itu total potensi koneksi backend kira-kira:

```text
jumlah_worker × DB_CONNECTION_LIMIT
```

Contoh:

```text
WEB_CONCURRENCY=4
DB_CONNECTION_LIMIT=20
Total potensi koneksi backend = 4 × 20 = 80 koneksi
```

Pastikan `MYSQL_MAX_CONNECTIONS` cukup besar untuk menampung total koneksi backend, koneksi admin, dan koneksi tambahan saat benchmark atau debugging.

## Menjalankan Apache JMeter

Test plan utama tersedia di folder `benchmark/`:

| Skenario | File test plan | Kondisi awal database |
|---|---|---|
| Write-heavy | `benchmark/create-write-heavy.jmx` | Database kosong |
| Read-heavy | `benchmark/read-only-random-id.jmx` | Restore baseline 250k |
| Mixed read/write | `benchmark/mixed-read-write.jmx` | Restore baseline 250k |

Contoh di bawah menggunakan lokasi plan `/root/jmeter-test/plans/`. Jika repo atau file `.jmx` berada di path lain, sesuaikan nilai `-t`.

Gunakan port sesuai jalur benchmark:

- Port `3000`: benchmark backend langsung.
- Port `8080`: benchmark melewati Nginx/frontend proxy untuk request `/api/*`.

Jalankan JMeter dari mesin terpisah bila tujuan penelitian adalah mengukur kapasitas server. GUI JMeter sebaiknya hanya digunakan untuk menyusun atau memeriksa test plan, bukan untuk menjalankan load test besar.

### Persiapan database kosong untuk write-heavy

Sebelum menjalankan write-heavy test, atau sebelum mengulang run ke-2, ke-3, dan seterusnya, pastikan tabel `items` kosong agar setiap run mulai dari kondisi yang sama.

```bash
docker compose exec -T database sh -ec \
  'mysql --protocol=socket -uroot -p"$MYSQL_ROOT_PASSWORD" \
  -e "TRUNCATE TABLE crud_db.items;"'
```

> Catatan: service Compose bernama `database`, sedangkan container name-nya `crud-database`.

### Write-heavy workload

Contoh menjalankan write-heavy test dengan 100 threads, ramp-up 60 detik, dan durasi total 600 detik:

```bash
jmeter -n \
  -t /root/jmeter-test/plans/create-write-heavy.jmx \
  -Jprotocol=http \
  -Jhost={IP} \
  -Jport=3000 \
  -Jthreads=100 \
  -Jrampup=60 \
  -Jduration=600 \
  -l /srv/jmeter-results/write-100threads/results.jtl \
  -j /srv/jmeter-results/write-100threads/jmeter.log
```

Membuat report HTML:

```bash
jmeter \
  -g /srv/jmeter-results/write-100threads/results.jtl \
  -o /var/www/jmeter-reports/write-100threads
```

### Read-heavy workload

Sebelum menjalankan read-heavy test, restore baseline 250k terlebih dahulu:

```bash
FORCE=1 sh scripts/restore-baseline-250k.sh
```

Contoh menjalankan read-heavy test dengan random ID dari baseline `1–250000`:

```bash
jmeter -n \
  -t /root/jmeter-test/plans/read-only-random-id.jmx \
  -Jprotocol=http \
  -Jhost={IP} \
  -Jport=3000 \
  -Jthreads=100 \
  -Jrampup=60 \
  -Jduration=600 \
  -Jmax_id=250000 \
  -l /srv/jmeter-results/read-100threads/results.jtl \
  -j /srv/jmeter-results/read-100threads/jmeter.log
```

Membuat report HTML:

```bash
jmeter \
  -g /srv/jmeter-results/read-100threads/results.jtl \
  -o /var/www/jmeter-reports/read-100threads
```

### Mixed read/write workload

Sebelum menjalankan mixed workload, restore baseline 250k terlebih dahulu:

```bash
FORCE=1 sh scripts/restore-baseline-250k.sh
```

Contoh menjalankan mixed read/write test dengan 100 threads, ramp-up 60 detik, durasi total 600 detik, baseline ID sampai 250000, dan read ratio 75%:

```bash
jmeter -n \
  -t /root/jmeter-test/plans/mixed-read-write.jmx \
  -Jprotocol=http \
  -Jhost={IP} \
  -Jport=3000 \
  -Jthreads=100 \
  -Jrampup=60 \
  -Jduration=600 \
  -Jmax_id=250000 \
  -Jread_percent=75 \
  -l /srv/jmeter-results/mixed-100threads/results.jtl \
  -j /srv/jmeter-results/mixed-100threads/jmeter.log
```

Membuat report HTML:

```bash
jmeter \
  -g /srv/jmeter-results/mixed-100threads/results.jtl \
  -o /var/www/jmeter-reports/mixed-100threads
```

## Catatan skenario benchmark

### Write-heavy

- Mulai dari database kosong.
- Fokus pada endpoint `POST /api/items`.
- Kosongkan tabel sebelum setiap pengulangan run agar hasil antar-run lebih sebanding.

### Read-heavy

- Restore baseline 250k terlebih dahulu.
- Gunakan random GET pada ID `1–250000`.
- Jangan melakukan write saat pengujian read-only.

### Mixed read/write

- Restore baseline 250k terlebih dahulu.
- Gunakan `-Jmax_id=250000` agar request read tetap mengambil data baseline.
- Atur rasio read menggunakan `-Jread_percent`. Contoh `-Jread_percent=75` berarti sekitar 75% read dan 25% write.
- Data hasil write akan memakai ID mulai `250001`, tetapi range read sebaiknya tetap `1–250000` agar working set baca stabil.

## Catatan benchmark umum

- Tunggu semua container berstatus sehat sebelum mulai.
- Lakukan warm-up sebelum pengukuran utama.
- Gunakan durasi, ramp-up, jumlah thread, dataset, dan urutan endpoint yang identik pada setiap skenario.
- Tentukan sejak awal apakah `WEB_CONCURRENCY` mengikuti jumlah vCPU (`0`) atau dikunci; jangan mencampur kedua metode dalam satu kelompok eksperimen.
- Jangan mengaktifkan log debug saat benchmark.
- Catat versi image dengan `docker compose images`.
- Untuk reproduktibilitas maksimal, pin image ke digest setelah environment final ditetapkan.
- Reset volume hanya ketika setiap skenario memang harus mulai dari database kosong.
- Pisahkan mesin JMeter dari mesin target bila ingin hasil kapasitas aplikasi lebih akurat.
