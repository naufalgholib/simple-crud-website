# Simple CRUD Benchmark

Aplikasi CRUD sederhana untuk pengujian performa menggunakan Apache JMeter.

## Stack

- Frontend: Vue 3, dibangun dengan Vite dan disajikan oleh Nginx
- Backend: Node.js 24 LTS + Fastify
- Database: MySQL 8.4 LTS (InnoDB)
- Orkestrasi: Docker Compose

## Menjalankan aplikasi

Persyaratan: Docker Engine dan Docker Compose plugin. Kredensial bawaan hanya ditujukan untuk lab/benchmark, bukan deployment publik.

```bash
docker compose up --build -d
```

Akses:

- Website: `http://localhost:8080`
- REST API langsung: `http://localhost:3000/api`
- Health check: `http://localhost:3000/api/health`
- MySQL: `localhost:3306`

Lihat status dan jalankan smoke test CRUD:

```bash
docker compose ps
./scripts/smoke-test.sh
```

Lihat log:

```bash
docker compose logs -f
```

Hentikan aplikasi tanpa menghapus data:

```bash
docker compose down
```

Hentikan dan reset seluruh data MySQL:

```bash
docker compose down -v
```

## Konfigurasi opsional

Salin `.env.example` menjadi `.env`, lalu ubah nilainya sesuai kebutuhan.

```bash
cp .env.example .env
docker compose up --build -d
```

Parameter yang berguna untuk eksperimen:

- Nama database ditetapkan sebagai `crud_db` agar skrip inisialisasi tetap deterministik.
- `WEB_CONCURRENCY=0`: otomatis membuat worker sesuai jumlah CPU yang terlihat di container; isi angka positif untuk mengunci jumlah worker.
- `DB_CONNECTION_LIMIT`: ukuran connection pool **per worker** backend.
- `LOG_LEVEL=warn`: menghindari request log per transaksi yang dapat mengganggu hasil benchmark.
- `MYSQL_MAX_CONNECTIONS`: batas koneksi MySQL
- `MYSQL_INNODB_BUFFER_POOL_SIZE`: ukuran InnoDB buffer pool
- `BACKEND_PORT`, `FRONTEND_PORT`, dan `MYSQL_PORT`: port host

Untuk eksperimen ilmiah, pertahankan seluruh parameter ini sama pada setiap skenario kecuali parameter yang memang menjadi variabel penelitian.

## REST API

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/health` | Health check backend dan database |
| GET | `/api/items?page=1&limit=20&search=` | Daftar item dengan pagination |
| GET | `/api/items/:id` | Mengambil satu item |
| POST | `/api/items` | Membuat item |
| PUT | `/api/items/:id` | Memperbarui item |
| DELETE | `/api/items/:id` | Menghapus item |

Contoh body POST/PUT:

```json
{
  "name": "SSD NVMe 1TB",
  "description": "Data pengujian",
  "price": 1200000,
  "quantity": 5
}
```

Contoh curl:

```bash
curl -X POST http://localhost:3000/api/items \
  -H 'Content-Type: application/json' \
  -d '{"name":"Item Test","description":"Benchmark","price":10000,"quantity":10}'
```

## Menjalankan Apache JMeter

File test plan tersedia di `benchmark/simple-crud.jmx`. Plan tersebut menjalankan alur berikut pada setiap iterasi:

1. Create item
2. Read item yang baru dibuat
3. Update item
4. List items
5. Delete item

Contoh mode CLI/non-GUI:

```bash
jmeter -n \
  -t benchmark/simple-crud.jmx \
  -Jhost=127.0.0.1 \
  -Jport=3000 \
  -Jthreads=50 \
  -Jrampup=10 \
  -Jduration=120 \
  -l benchmark/results.jtl \
  -e -o benchmark/report
```

Untuk benchmark backend murni, gunakan port `3000`. Untuk menyertakan Nginx pada jalur request, gunakan port `8080` karena Nginx meneruskan `/api/*` ke backend.

Jalankan JMeter dari mesin terpisah bila tujuan penelitian adalah mengukur kapasitas server. GUI JMeter sebaiknya hanya dipakai untuk menyusun atau memeriksa test plan, bukan menjalankan load test besar.

## Catatan benchmark

- Tunggu semua container berstatus sehat sebelum mulai.
- Lakukan warm-up sebelum pengukuran utama.
- Gunakan durasi, ramp-up, jumlah thread, dataset, dan urutan endpoint yang identik pada tiap skenario.
- Tentukan sejak awal apakah `WEB_CONCURRENCY` mengikuti jumlah vCPU (`0`) atau dikunci; jangan mencampur kedua metode dalam satu kelompok eksperimen.
- Jangan mengaktifkan log debug saat benchmark.
- Catat versi image dengan `docker compose images`.
- Untuk reproduktibilitas maksimal, pin image ke digest setelah environment final ditetapkan.
- Reset volume hanya ketika setiap skenario memang harus mulai dari database kosong.

## Struktur proyek

```text
.
├── backend/
├── benchmark/simple-crud.jmx
├── database/init.sql
├── frontend/
├── docker-compose.yml
└── README.md
```
