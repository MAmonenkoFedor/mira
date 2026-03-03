import { Pool } from "pg";

export function createPool() {
  const url = process.env.DATABASE_URL;
  const pool =
    url
      ? new Pool({ connectionString: url })
      : new Pool({
          host: process.env.PGHOST || "localhost",
          port: Number(process.env.PGPORT || 5432),
          user: process.env.PGUSER || "postgres",
          password: process.env.PGPASSWORD || "postgres",
          database: process.env.PGDATABASE || "miravkus",
        });
  return pool;
}

export async function migrate(pool: Pool) {
  await pool.query(`
    create table if not exists categories(
      id text primary key,
      name text not null,
      emoji text,
      color text
    );
  `);
  await pool.query(`
    create table if not exists products(
      id serial primary key,
      name text not null,
      price integer not null,
      old_price integer,
      category text references categories(id) on delete set null,
      badge text,
      description text,
      image text,
      popularity integer default 0,
      images text[]
    );
  `);
  await pool.query(`alter table products add column if not exists active boolean not null default true`);
  await pool.query(`alter table products add column if not exists images text[]`);
  await pool.query(`
    create table if not exists promocodes(
      id serial primary key,
      code text unique not null,
      percent integer not null check (percent > 0 and percent <= 90),
      scope text not null check (scope in ('all','category','product')),
      categories text[],
      products integer[],
      active boolean not null default true
    );
  `);
  await pool.query(`
    create table if not exists articles(
      id serial primary key,
      slug text unique not null,
      title text not null,
      excerpt text not null,
      content text,
      tag text,
      read_time text,
      image text
    );
  `);
  await pool.query(`alter table articles add column if not exists product_id integer`);
  await pool.query(`
    create table if not exists admins(
      id serial primary key,
      email text unique not null,
      password_hash text not null,
      created_at timestamptz not null default now()
    );
  `);
  await pool.query(`alter table admins add column if not exists reset_token text`);
  await pool.query(`alter table admins add column if not exists reset_expires timestamptz`);
  await pool.query(`
    create table if not exists orders(
      id serial primary key,
      total integer not null,
      discount integer not null default 0,
      promo text,
      contact_name text not null,
      contact_phone text not null,
      delivery_address text not null,
      delivery_method text not null,
      payment_method text not null,
      created_at timestamptz not null default now()
    );
  `);
  await pool.query(`alter table orders add column if not exists status text not null default 'processing'`);
  await pool.query(`alter table orders add column if not exists delivery_status text`);
  await pool.query(`alter table orders add column if not exists delivery_provider text`);
  await pool.query(`alter table orders add column if not exists tracking_number text`);
  await pool.query(`
    create table if not exists order_items(
      id serial primary key,
      order_id integer references orders(id) on delete cascade,
      product_id integer,
      name text,
      quantity integer not null,
      price integer not null
    );
  `);
  await pool.query(`
    create table if not exists hero_images(
      id serial primary key,
      url text not null,
      position integer not null default 0,
      active boolean not null default true
    );
  `);
  await pool.query(`
    create table if not exists footer_settings(
      id integer primary key default 1,
      data jsonb not null
    );
  `);
}
