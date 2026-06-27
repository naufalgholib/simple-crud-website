# Simple CRUD Website for JMeter Benchmarking

Project ini menyediakan aplikasi CRUD sederhana dengan:
- Frontend React + Vite
- Backend Express + MySQL
- Docker Compose untuk menjalankan semua layanan sekaligus

## Jalankan dengan satu perintah

Di folder project:

```bash
docker compose up --build
```

Setelah selesai:
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000
- MySQL: localhost:3306

## Endpoint API

- GET /health
- GET /api/items
- POST /api/items
- PUT /api/items/:id
- DELETE /api/items/:id

## Stop aplikasi

```bash
docker compose down -v
```

## JMeter

File skenario JMeter tersedia di folder jmeter.

Langkah cepat:
1. Buka Apache JMeter
2. Import file jmeter/simple-crud-test.jmx
3. Jalankan test
4. Lihat hasil di Summary Report / View Results Tree
