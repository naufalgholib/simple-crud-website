CREATE DATABASE IF NOT EXISTS crud_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE crud_db;

CREATE TABLE IF NOT EXISTS items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  quantity INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_items_created_at (created_at),
  INDEX idx_items_name (name)
) ENGINE=InnoDB;

INSERT INTO items (name, description, price, quantity) VALUES
  ('Keyboard Mechanical', 'Sample item untuk pengujian CRUD', 750000.00, 10),
  ('Mouse Wireless', 'Sample item untuk pengujian CRUD', 250000.00, 25),
  ('Monitor 24 Inch', 'Sample item untuk pengujian CRUD', 1900000.00, 7);
