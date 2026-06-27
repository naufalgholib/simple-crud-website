import Fastify from 'fastify';
import mysql from 'mysql2/promise';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'warn'
  },
  requestTimeout: 30_000,
  bodyLimit: 1_048_576
});

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'database',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'crud_user',
  password: process.env.DB_PASSWORD || 'crud_password',
  database: process.env.DB_NAME || 'crud_db',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 20),
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  decimalNumbers: true
});

const itemBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'price', 'quantity'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 150 },
    description: { anyOf: [{ type: 'string', maxLength: 5000 }, { type: 'null' }] },
    price: { type: 'number', minimum: 0, maximum: 9999999999.99 },
    quantity: { type: 'integer', minimum: 0, maximum: 4294967295 }
  }
};

const idParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'integer', minimum: 1 }
  }
};

function normalizeBody(body) {
  return {
    name: body.name.trim(),
    description: body.description?.trim() || null,
    price: Number(body.price),
    quantity: Number(body.quantity)
  };
}

app.get('/api/health', async () => {
  await pool.query('SELECT 1');
  return { status: 'ok', service: 'crud-backend' };
});

app.get('/api/items', {
  schema: {
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        page: { type: 'integer', minimum: 1, default: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        search: { type: 'string', maxLength: 150, default: '' }
      }
    }
  }
}, async (request) => {
  const page = Number(request.query.page || 1);
  const limit = Number(request.query.limit || 20);
  const search = String(request.query.search || '').trim();
  const offset = (page - 1) * limit;

  let rows;
  let countRows;

  if (search) {
    const pattern = `%${search}%`;
    [rows] = await pool.execute(
      `SELECT id, name, description, price, quantity, created_at, updated_at
       FROM items
       WHERE name LIKE ? OR description LIKE ?
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [pattern, pattern, limit, offset]
    );
    [countRows] = await pool.execute(
      'SELECT COUNT(*) AS total FROM items WHERE name LIKE ? OR description LIKE ?',
      [pattern, pattern]
    );
  } else {
    [rows] = await pool.execute(
      `SELECT id, name, description, price, quantity, created_at, updated_at
       FROM items
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    [countRows] = await pool.query('SELECT COUNT(*) AS total FROM items');
  }

  const total = Number(countRows[0].total);
  return {
    data: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
});

app.get('/api/items/:id', {
  schema: { params: idParamsSchema }
}, async (request, reply) => {
  const [rows] = await pool.execute(
    `SELECT id, name, description, price, quantity, created_at, updated_at
     FROM items WHERE id = ?`,
    [request.params.id]
  );

  if (rows.length === 0) {
    return reply.code(404).send({ error: 'Item not found' });
  }

  return { data: rows[0] };
});

app.post('/api/items', {
  schema: { body: itemBodySchema }
}, async (request, reply) => {
  const item = normalizeBody(request.body);

  if (!item.name) {
    return reply.code(400).send({ error: 'Name must not be blank' });
  }

  const [result] = await pool.execute(
    'INSERT INTO items (name, description, price, quantity) VALUES (?, ?, ?, ?)',
    [item.name, item.description, item.price, item.quantity]
  );

  const [rows] = await pool.execute(
    `SELECT id, name, description, price, quantity, created_at, updated_at
     FROM items WHERE id = ?`,
    [result.insertId]
  );

  return reply.code(201).send({ data: rows[0] });
});

app.put('/api/items/:id', {
  schema: {
    params: idParamsSchema,
    body: itemBodySchema
  }
}, async (request, reply) => {
  const item = normalizeBody(request.body);

  if (!item.name) {
    return reply.code(400).send({ error: 'Name must not be blank' });
  }

  const [result] = await pool.execute(
    `UPDATE items
     SET name = ?, description = ?, price = ?, quantity = ?
     WHERE id = ?`,
    [item.name, item.description, item.price, item.quantity, request.params.id]
  );

  if (result.affectedRows === 0) {
    return reply.code(404).send({ error: 'Item not found' });
  }

  const [rows] = await pool.execute(
    `SELECT id, name, description, price, quantity, created_at, updated_at
     FROM items WHERE id = ?`,
    [request.params.id]
  );

  return { data: rows[0] };
});

app.delete('/api/items/:id', {
  schema: { params: idParamsSchema }
}, async (request, reply) => {
  const [result] = await pool.execute('DELETE FROM items WHERE id = ?', [request.params.id]);

  if (result.affectedRows === 0) {
    return reply.code(404).send({ error: 'Item not found' });
  }

  return reply.code(204).send();
});

app.setNotFoundHandler((request, reply) => {
  reply.code(404).send({ error: 'Route not found' });
});

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);

  if (error.validation) {
    return reply.code(400).send({
      error: 'Validation error',
      details: error.validation
    });
  }

  return reply.code(500).send({ error: 'Internal server error' });
});

async function shutdown(signal) {
  app.log.info({ signal }, 'Shutting down');
  await app.close();
  await pool.end();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 3000);

try {
  await pool.query('SELECT 1');
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  await pool.end();
  process.exit(1);
}
