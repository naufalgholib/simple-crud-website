<script setup>
import { computed, onMounted, reactive, ref } from 'vue';

const items = ref([]);
const loading = ref(false);
const saving = ref(false);
const message = ref('');
const error = ref('');
const search = ref('');
const page = ref(1);
const limit = 10;
const total = ref(0);
const totalPages = ref(1);
const editingId = ref(null);

const form = reactive({
  name: '',
  description: '',
  price: 0,
  quantity: 0
});

const isEditing = computed(() => editingId.value !== null);

function resetForm() {
  editingId.value = null;
  form.name = '';
  form.description = '';
  form.price = 0;
  form.quantity = 0;
}

function notify(text) {
  message.value = text;
  error.value = '';
  window.setTimeout(() => {
    if (message.value === text) message.value = '';
  }, 2500);
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

async function loadItems() {
  loading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      limit: String(limit),
      search: search.value.trim()
    });
    const payload = await request(`/api/items?${params}`);
    items.value = payload.data;
    total.value = payload.pagination.total;
    totalPages.value = payload.pagination.totalPages;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function submitForm() {
  saving.value = true;
  error.value = '';
  try {
    const body = JSON.stringify({
      name: form.name,
      description: form.description || null,
      price: Number(form.price),
      quantity: Number(form.quantity)
    });

    if (isEditing.value) {
      await request(`/api/items/${editingId.value}`, { method: 'PUT', body });
      notify('Item berhasil diperbarui.');
    } else {
      await request('/api/items', { method: 'POST', body });
      notify('Item berhasil ditambahkan.');
    }

    resetForm();
    page.value = 1;
    await loadItems();
  } catch (err) {
    error.value = err.message;
  } finally {
    saving.value = false;
  }
}

function editItem(item) {
  editingId.value = item.id;
  form.name = item.name;
  form.description = item.description || '';
  form.price = item.price;
  form.quantity = item.quantity;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteItem(item) {
  if (!window.confirm(`Hapus item "${item.name}"?`)) return;
  error.value = '';
  try {
    await request(`/api/items/${item.id}`, { method: 'DELETE' });
    notify('Item berhasil dihapus.');
    if (items.value.length === 1 && page.value > 1) page.value -= 1;
    await loadItems();
  } catch (err) {
    error.value = err.message;
  }
}

async function doSearch() {
  page.value = 1;
  await loadItems();
}

async function changePage(nextPage) {
  if (nextPage < 1 || nextPage > totalPages.value) return;
  page.value = nextPage;
  await loadItems();
}

onMounted(loadItems);
</script>

<template>
  <main class="container">
    <header class="page-header">
      <div>
        <p class="eyebrow">Dockerized benchmark application</p>
        <h1>Simple CRUD Items</h1>
        <p class="subtitle">Vue, Fastify REST API, dan MySQL.</p>
      </div>
      <span class="badge">{{ total }} records</span>
    </header>

    <section class="card form-card">
      <h2>{{ isEditing ? 'Edit item' : 'Tambah item' }}</h2>
      <form class="form-grid" @submit.prevent="submitForm">
        <label>
          Nama
          <input v-model="form.name" required maxlength="150" placeholder="Nama item" />
        </label>
        <label>
          Harga
          <input v-model.number="form.price" required type="number" min="0" step="0.01" />
        </label>
        <label>
          Jumlah
          <input v-model.number="form.quantity" required type="number" min="0" step="1" />
        </label>
        <label class="full-width">
          Deskripsi
          <textarea v-model="form.description" rows="3" maxlength="5000" placeholder="Deskripsi opsional"></textarea>
        </label>
        <div class="actions full-width">
          <button class="primary" :disabled="saving">
            {{ saving ? 'Menyimpan...' : (isEditing ? 'Simpan perubahan' : 'Tambah item') }}
          </button>
          <button v-if="isEditing" type="button" class="secondary" @click="resetForm">Batal</button>
        </div>
      </form>
    </section>

    <p v-if="message" class="alert success">{{ message }}</p>
    <p v-if="error" class="alert error">{{ error }}</p>

    <section class="card">
      <div class="toolbar">
        <h2>Daftar item</h2>
        <form class="search-form" @submit.prevent="doSearch">
          <input v-model="search" placeholder="Cari nama atau deskripsi" />
          <button class="secondary">Cari</button>
        </form>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nama</th>
              <th>Deskripsi</th>
              <th>Harga</th>
              <th>Jumlah</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="6" class="empty">Memuat data...</td></tr>
            <tr v-else-if="items.length === 0"><td colspan="6" class="empty">Data tidak ditemukan.</td></tr>
            <tr v-for="item in items" :key="item.id">
              <td>{{ item.id }}</td>
              <td><strong>{{ item.name }}</strong></td>
              <td class="description">{{ item.description || '-' }}</td>
              <td>Rp {{ Number(item.price).toLocaleString('id-ID') }}</td>
              <td>{{ item.quantity }}</td>
              <td>
                <div class="row-actions">
                  <button class="small secondary" @click="editItem(item)">Edit</button>
                  <button class="small danger" @click="deleteItem(item)">Hapus</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer class="pagination">
        <button class="secondary" :disabled="page <= 1" @click="changePage(page - 1)">Sebelumnya</button>
        <span>Halaman {{ page }} / {{ totalPages }}</span>
        <button class="secondary" :disabled="page >= totalPages" @click="changePage(page + 1)">Berikutnya</button>
      </footer>
    </section>
  </main>
</template>
