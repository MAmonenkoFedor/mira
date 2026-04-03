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
  await pool.query(`alter table categories add column if not exists show_on_home boolean`);
  await pool.query(`alter table categories add column if not exists home_order integer`);
  try {
    await pool.query(`alter table categories add column if not exists category_order integer`);
    await pool.query(`
      update categories as c
      set category_order = src.rn
      from (
        select id, row_number() over (order by name, id) as rn
        from categories
      ) as src
      where c.id = src.id and c.category_order is null
    `);
  } catch (err) {
    console.warn("category_order migration skipped", err instanceof Error ? err.message : "unknown_error");
  }
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
  await pool.query(`
    create table if not exists reviews(
      id serial primary key,
      product_id integer references products(id) on delete cascade,
      author_name text not null,
      rating integer not null check (rating >= 1 and rating <= 5),
      text text not null,
      image text,
      approved boolean not null default false,
      created_at timestamptz not null default now()
    );
  `);
  await pool.query(`alter table reviews add column if not exists image text`);
  await pool.query(`alter table products add column if not exists active boolean not null default true`);
  await pool.query(`alter table products add column if not exists images text[]`);
  await pool.query(`alter table products add column if not exists video_url text`);
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
  await pool.query(`alter table articles add column if not exists category_id text`);
  await pool.query(`alter table articles add column if not exists images text[]`);
  await pool.query(`alter table articles add column if not exists video_url text`);
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
  await pool.query(`alter table admins add column if not exists force_logout_after timestamptz`);
  await pool.query(`
    create table if not exists admin_login_events(
      id serial primary key,
      admin_id integer references admins(id) on delete set null,
      email text not null,
      ip text,
      user_agent text,
      success boolean not null default false,
      created_at timestamptz not null default now()
    );
  `);
  await pool.query(`
    create table if not exists orders(
      id serial primary key,
      total integer not null,
      discount integer not null default 0,
      promo text,
      contact_name text not null,
      contact_phone text not null,
      contact_email text,
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
  await pool.query(`alter table orders add column if not exists contact_email text`);
  await pool.query(`
    create table if not exists customers(
      id serial primary key,
      phone text unique,
      email text unique,
      password_hash text,
      created_at timestamptz not null default now()
    );
  `);
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
  await pool.query(`alter table order_items add column if not exists packaging_id text`);
  await pool.query(`alter table order_items add column if not exists packaging_name text`);
  await pool.query(`alter table order_items add column if not exists packaging_price integer not null default 0`);

  await pool.query(`
    create table if not exists packaging_options(
      id text primary key,
      name text not null,
      price integer not null default 0,
      active boolean not null default true
    );
  `);
  await pool.query(`alter table packaging_options add column if not exists image text`);
  await pool.query(`alter table packaging_options add column if not exists images text[]`);
  await pool.query(`
    create table if not exists hero_images(
      id serial primary key,
      url text not null,
      position integer not null default 0,
      active boolean not null default true
    );
  `);
  await pool.query(`alter table hero_images add column if not exists link text`);
  await pool.query(`
    create table if not exists promo_banners(
      id serial primary key,
      url text not null,
      link text,
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
  await pool.query(`
    create table if not exists header_settings(
      id integer primary key default 1,
      data jsonb not null
    );
  `);
  await pool.query(`
    create table if not exists hero_text_settings(
      id integer primary key default 1,
      data jsonb not null
    );
  `);
  await pool.query(`
    create table if not exists feature_blocks_settings(
      id integer primary key default 1,
      data jsonb not null
    );
  `);
  await pool.query(`
    create table if not exists about_settings(
      id integer primary key default 1,
      data jsonb not null
    );
  `);
  await pool.query(`
    create table if not exists integration_settings(
      id integer primary key default 1,
      data jsonb not null
    );
  `);

  await pool.query(`alter table products add column if not exists packaging_mode text`);
  await pool.query(`alter table products add column if not exists standard_packaging_id text references packaging_options(id)`);
  await pool.query(`alter table products add column if not exists sku text`);
  await pool.query(`alter table products add column if not exists composition_short text`);
  await pool.query(`alter table products add column if not exists shelf_life text`);
  await pool.query(`alter table products add column if not exists country text`);
  await pool.query(`alter table products add column if not exists composition_set text`);
  await pool.query(`alter table products add column if not exists storage_temperature text`);
  await pool.query(`alter table products add column if not exists product_features text`);
  await pool.query(`alter table products add column if not exists set_weight text`);
  await pool.query(`alter table products add column if not exists package_dimensions text`);
  await pool.query(`alter table products add column if not exists description_long text`);
  await pool.query(`alter table products add column if not exists categories text[]`);
  await pool.query(`update products set categories=array[category] where categories is null and category is not null`);
  await pool.query(`
    update products
    set standard_packaging_id='standard'
    where packaging_mode='standard'
      and standard_packaging_id is null
      and exists (select 1 from packaging_options where id='standard')
  `);
  await pool.query(`
    update products
    set packaging_mode=null
    where packaging_mode='standard'
      and standard_packaging_id is null
  `);

  await pool.query(`select setval(pg_get_serial_sequence('products','id'), (select coalesce(max(id),1) from products), (select count(*)>0 from products))`);
  await pool.query(`select setval(pg_get_serial_sequence('articles','id'), (select coalesce(max(id),1) from articles), (select count(*)>0 from articles))`);
  await pool.query(`select setval(pg_get_serial_sequence('orders','id'), (select coalesce(max(id),1) from orders), (select count(*)>0 from orders))`);
  await pool.query(`select setval(pg_get_serial_sequence('order_items','id'), (select coalesce(max(id),1) from order_items), (select count(*)>0 from order_items))`);
  await pool.query(`select setval(pg_get_serial_sequence('admins','id'), (select coalesce(max(id),1) from admins), (select count(*)>0 from admins))`);
  await pool.query(`select setval(pg_get_serial_sequence('promocodes','id'), (select coalesce(max(id),1) from promocodes), (select count(*)>0 from promocodes))`);
  await pool.query(`select setval(pg_get_serial_sequence('hero_images','id'), (select coalesce(max(id),1) from hero_images), (select count(*)>0 from hero_images))`);
  await pool.query(`select setval(pg_get_serial_sequence('reviews','id'), (select coalesce(max(id),1) from reviews), (select count(*)>0 from reviews))`);
}
