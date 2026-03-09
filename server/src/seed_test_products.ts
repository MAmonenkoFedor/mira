import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { createPool } from "./db";

type ProductSeed = {
  name: string;
  price: number;
  oldPrice?: number | null;
  category: string;
  badge?: string | null;
  description: string;
  sku: string;
  compositionShort: string;
  shelfLife: string;
  country: string;
  compositionSet: string;
  storageTemperature: string;
  productFeatures: string;
  setWeight: string;
  packageDimensions: string;
  descriptionLong: string;
  popularity: number;
  active: boolean;
  packagingMode?: "none" | "standard" | "selectable";
  standardPackagingId?: string | null;
  sourceDir: string;
  imagesCount: number;
};

function safeSlug(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .slice(0, 40);
}

function listWebpFiles(dir: string) {
  const all = fs.readdirSync(dir, { withFileTypes: true });
  return all
    .filter(d => d.isFile() && d.name.toLowerCase().endsWith(".webp"))
    .map(d => path.join(dir, d.name))
    .sort((a, b) => a.localeCompare(b, "ru"));
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

async function insertProduct(pool: Pool, p: Omit<ProductSeed, "sourceDir" | "imagesCount"> & { image: string; images?: string[] }) {
  const { rows } = await pool.query(
    `insert into products(
      name,price,old_price,category,badge,description,
      sku,composition_short,shelf_life,country,composition_set,storage_temperature,product_features,set_weight,package_dimensions,description_long,
      image,images,popularity,active,packaging_mode,standard_packaging_id
    ) values(
      $1,$2,$3,$4,$5,$6,
      $7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
      $17,$18,$19,$20,$21,$22
    ) returning id`,
    [
      p.name,
      p.price,
      p.oldPrice ?? null,
      p.category,
      p.badge ?? null,
      p.description,
      p.sku,
      p.compositionShort,
      p.shelfLife,
      p.country,
      p.compositionSet,
      p.storageTemperature,
      p.productFeatures,
      p.setWeight,
      p.packageDimensions,
      p.descriptionLong,
      p.image,
      p.images ?? null,
      p.popularity,
      p.active,
      p.packagingMode && p.packagingMode !== "none" ? p.packagingMode : null,
      p.packagingMode === "standard" ? (p.standardPackagingId ?? null) : null,
    ]
  );
  return Number(rows[0]?.id);
}

async function main() {
  const srcRoot = "D:\\miravkus\\content-webp";
  const serverCwd = process.cwd();
  const uploadsDir = path.join(serverCwd, "uploads");
  const productsDir = path.join(uploadsDir, "products");
  ensureDir(productsDir);

  const seeds: ProductSeed[] = [
    {
      name: "Набор леденцов «Офисный заряд»",
      price: 1190,
      oldPrice: 1390,
      category: "gift/office/lollipops",
      badge: "new",
      description: "Набор леденцов и освежающих конфет для офиса — яркий микс на каждый день.",
      sku: "TEST-LOLLI-01",
      compositionShort: "Леденцы, карамель, фруктовые вкусы",
      shelfLife: "12 месяцев",
      country: "Корея",
      compositionSet: "Леденцы ассорти (фруктовые), карамельные конфеты, освежающие пастилки.",
      storageTemperature: "0…25°C, в сухом месте",
      productFeatures: "Яркие вкусы; удобные порции; подходит для подарка",
      setWeight: "≈ 850 г",
      packageDimensions: "24×18×8 см",
      descriptionLong:
        "Офисный набор леденцов — универсальный подарок коллегам и отличное дополнение к кофе-брейку. Внутри — ассорти вкусов и приятная текстура.",
      popularity: 8,
      active: true,
      packagingMode: "selectable",
      standardPackagingId: null,
      sourceDir: path.join(srcRoot, "Набор Леденцы"),
      imagesCount: 3,
    },
    {
      name: "Трюфельный набор «Классика»",
      price: 1490,
      oldPrice: null,
      category: "gift/truffle",
      badge: null,
      description: "Сливочный ганаш, какао и нежные трюфели — классическая подборка в подарочной коробке.",
      sku: "TEST-TRUF-01",
      compositionShort: "Шоколад, сливки, какао",
      shelfLife: "6 месяцев",
      country: "Россия",
      compositionSet: "Трюфели ассорти: классический, карамельный, ореховый, ванильный.",
      storageTemperature: "15…20°C",
      productFeatures: "Нежная текстура; насыщенный вкус; подарочная подача",
      setWeight: "≈ 420 г",
      packageDimensions: "18×18×6 см",
      descriptionLong:
        "Трюфельный набор для ценителей классики. Хорошо подходит в подарок и для дегустации нескольких вкусов.",
      popularity: 9,
      active: true,
      packagingMode: "standard",
      standardPackagingId: "standard",
      sourceDir: path.join(srcRoot, "Трюфель", "Трюфель_2"),
      imagesCount: 4,
    },
    {
      name: "Премиум набор «Тиффани»",
      price: 2590,
      oldPrice: 2990,
      category: "gift/premium",
      badge: "sale",
      description: "Премиум-набор сладостей в стильной коробке. Подходит для особого случая.",
      sku: "TEST-PREM-01",
      compositionShort: "Шоколад, конфеты, десерты ассорти",
      shelfLife: "9 месяцев",
      country: "Япония",
      compositionSet: "Шоколадные конфеты, мини-десерты, сладости ассорти (подборка).",
      storageTemperature: "0…25°C",
      productFeatures: "Премиальная подача; аккуратная сборка; универсальный подарок",
      setWeight: "≈ 1100 г",
      packageDimensions: "30×22×10 см",
      descriptionLong:
        "Премиум-набор с акцентом на упаковку и разнообразие вкусов. Хорош для подарков клиентам, партнёрам и близким.",
      popularity: 10,
      active: true,
      packagingMode: "standard",
      standardPackagingId: "standard",
      sourceDir: path.join(srcRoot, "Премиум", "Круг 24_1 тифани"),
      imagesCount: 4,
    },
    {
      name: "Стандартный набор «24/33»",
      price: 1790,
      oldPrice: null,
      category: "gift/asian",
      badge: "new",
      description: "Сбалансированный набор сладостей: чуть шоколада, чуть фруктового и немного хруста.",
      sku: "TEST-STD-2433",
      compositionShort: "Ассорти сладостей, шоколад, мармелад",
      shelfLife: "10 месяцев",
      country: "Китай",
      compositionSet: "Ассорти сладостей (шоколад, мармелад, печенье), подборка вкусов.",
      storageTemperature: "0…25°C",
      productFeatures: "Универсальный микс; яркая подборка; отличный первый набор",
      setWeight: "≈ 950 г",
      packageDimensions: "28×20×9 см",
      descriptionLong:
        "Стандартный набор с разнообразием — чтобы попробовать сразу несколько направлений и выбрать любимое.",
      popularity: 7,
      active: true,
      packagingMode: "selectable",
      standardPackagingId: null,
      sourceDir: path.join(srcRoot, "Стандарт", "Набор 24_33!"),
      imagesCount: 4,
    },
    {
      name: "Стандартный набор «14/24»",
      price: 1590,
      oldPrice: 1890,
      category: "gift/asian-mini",
      badge: null,
      description: "Мини-версия подарочного набора — компактно, красиво, вкусно.",
      sku: "TEST-STD-1424",
      compositionShort: "Мини-ассорти сладостей",
      shelfLife: "10 месяцев",
      country: "Китай",
      compositionSet: "Мини-набор сладостей ассорти (несколько позиций, подборка).",
      storageTemperature: "0…25°C",
      productFeatures: "Компактный формат; подходит для небольшого подарка",
      setWeight: "≈ 650 г",
      packageDimensions: "22×16×8 см",
      descriptionLong:
        "Мини-набор — для тех, кто хочет сделать приятный подарок без лишнего объёма. Хорошо подходит как дополнение к основному презенту.",
      popularity: 6,
      active: true,
      packagingMode: "standard",
      standardPackagingId: "standard",
      sourceDir: path.join(srcRoot, "Стандарт", "Набор 14_24!"),
      imagesCount: 4,
    },
  ];

  const pool = createPool();
  await pool.query(
    `select setval(
      pg_get_serial_sequence('products','id'),
      (select coalesce(max(id), 1) from products),
      (select count(*) > 0 from products)
    )`
  );

  const createdIds: number[] = [];
  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i];
    if (!fs.existsSync(seed.sourceDir)) {
      throw new Error(`missing_source_dir:${seed.sourceDir}`);
    }
    const files = listWebpFiles(seed.sourceDir);
    if (!files.length) {
      throw new Error(`no_images_in:${seed.sourceDir}`);
    }
    const take = Math.max(1, Math.min(seed.imagesCount, files.length));
    const selected = files.slice(0, take);

    const slug = safeSlug(seed.sku || seed.name || `product_${i + 1}`);
    const urls: string[] = [];
    for (let j = 0; j < selected.length; j++) {
      const src = selected[j];
      const dstName = `test_${slug}_${j + 1}.webp`;
      const dst = path.join(productsDir, dstName);
      fs.copyFileSync(src, dst);
      urls.push(`/uploads/products/${dstName}`);
    }

    const id = await insertProduct(pool, {
      name: seed.name,
      price: seed.price,
      oldPrice: seed.oldPrice ?? null,
      category: seed.category,
      badge: seed.badge ?? null,
      description: seed.description,
      sku: seed.sku,
      compositionShort: seed.compositionShort,
      shelfLife: seed.shelfLife,
      country: seed.country,
      compositionSet: seed.compositionSet,
      storageTemperature: seed.storageTemperature,
      productFeatures: seed.productFeatures,
      setWeight: seed.setWeight,
      packageDimensions: seed.packageDimensions,
      descriptionLong: seed.descriptionLong,
      image: urls[0],
      images: urls,
      popularity: seed.popularity,
      active: seed.active,
      packagingMode: seed.packagingMode,
      standardPackagingId: seed.standardPackagingId ?? null,
    });
    createdIds.push(id);
  }

  await pool.end();
  process.stdout.write(`ok:${createdIds.join(",")}\n`);
}

main().catch((e) => {
  process.stderr.write(String(e?.stack || e?.message || e) + "\n");
  process.exitCode = 1;
});
