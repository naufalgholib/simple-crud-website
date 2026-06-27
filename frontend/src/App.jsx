import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function App() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ id: null, name: '', description: '', price: '' });
  const [loading, setLoading] = useState(false);

  const loadItems = async () => {
    setLoading(true);
    const res = await fetch(`${API_URL}/api/items`);
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      description: form.description,
      price: form.price,
    };

    const res = form.id
      ? await fetch(`${API_URL}/api/items/${form.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch(`${API_URL}/api/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

    if (res.ok) {
      setForm({ id: null, name: '', description: '', price: '' });
      loadItems();
    }
  };

  const handleEdit = (item) => {
    setForm({ id: item.id, name: item.name, description: item.description, price: item.price });
  };

  const handleDelete = async (id) => {
    const res = await fetch(`${API_URL}/api/items/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadItems();
    }
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: 1000, margin: '40px auto', padding: 20 }}>
      <h1>Simple CRUD App</h1>
      <p>Lightweight CRUD app for JMeter benchmarking.</p>

      <form onSubmit={handleSubmit} style={{ background: '#f5f7fb', padding: 16, borderRadius: 8, marginBottom: 20 }}>
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          style={{ display: 'block', width: '100%', marginBottom: 10, padding: 8 }}
        />
        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          style={{ display: 'block', width: '100%', marginBottom: 10, padding: 8 }}
        />
        <input
          placeholder="Price"
          type="number"
          step="0.01"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          required
          style={{ display: 'block', width: '100%', marginBottom: 10, padding: 8 }}
        />
        <button type="submit" style={{ padding: '8px 12px', cursor: 'pointer' }}>{form.id ? 'Update' : 'Create'}</button>
      </form>

      {loading ? <p>Loading...</p> : null}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#e9eef7' }}>
            <th style={{ padding: 8, textAlign: 'left' }}>Name</th>
            <th style={{ padding: 8, textAlign: 'left' }}>Description</th>
            <th style={{ padding: 8, textAlign: 'left' }}>Price</th>
            <th style={{ padding: 8, textAlign: 'left' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td style={{ padding: 8, borderBottom: '1px solid #ddd' }}>{item.name}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #ddd' }}>{item.description}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #ddd' }}>{item.price}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #ddd' }}>
                <button onClick={() => handleEdit(item)} style={{ marginRight: 8 }}>Edit</button>
                <button onClick={() => handleDelete(item.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
