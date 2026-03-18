-- migrations/0001_initial.sql
CREATE TABLE IF NOT EXISTS items (
  id         TEXT    PRIMARY KEY,
  name       TEXT    NOT NULL,
  link       TEXT,
  image_url  TEXT,
  price_min  REAL,
  price_max  REAL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS claims (
  item_id            TEXT    PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  telegram_user_id   INTEGER NOT NULL,
  telegram_username  TEXT,
  claimed_at         INTEGER NOT NULL
);
