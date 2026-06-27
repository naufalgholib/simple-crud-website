const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "rootpass",
  database: process.env.DB_NAME || "cruddb",
  waitForConnections: true,
  connectionLimit: 10,
};

const pool = mysql.createPool(dbConfig);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function initDatabase() {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const connection = await pool.getConnection();
      await connection.query(`
        CREATE TABLE IF NOT EXISTS items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          price DECIMAL(10,2) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;
      `);
      connection.release();
      return;
    } catch (error) {
      if (attempt === 30) {
        console.error("Database connection failed.", error);
        process.exit(1);
      }
      console.log(`Waiting for MySQL... attempt ${attempt}/30`);
      await sleep(2000);
    }
  }
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/items", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM items ORDER BY id DESC");
    res.json({ items: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/items", async (req, res) => {
  const { name, description, price } = req.body;
  if (!name || !price) {
    return res.status(400).json({ error: "name and price are required" });
  }

  try {
    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice)) {
      return res.status(400).json({ error: "price must be a valid number" });
    }

    const [result] = await pool.query(
      "INSERT INTO items (name, description, price) VALUES (?, ?, ?)",
      [name, description || "", numericPrice]
    );
    const [rows] = await pool.query("SELECT * FROM items WHERE id = ?", [result.insertId]);
    res.status(201).json({ item: rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/items/:id", async (req, res) => {
  const { id } = req.params;
  const { name, description, price } = req.body;

  if (!name || !price) {
    return res.status(400).json({ error: "name and price are required" });
  }

  try {
    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice)) {
      return res.status(400).json({ error: "price must be a valid number" });
    }

    await pool.query("UPDATE items SET name = ?, description = ?, price = ? WHERE id = ?", [
      name,
      description || "",
      numericPrice,
      id,
    ]);
    const [rows] = await pool.query("SELECT * FROM items WHERE id = ?", [id]);
    res.json({ item: rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/items/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM items WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

initDatabase().then(() => {
  app.listen(port, "0.0.0.0", () => {
    console.log(`Backend running on port ${port}`);
  });
});
