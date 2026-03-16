import express from "express";
import cors from "cors";
import { z } from "zod";
import { createPool, migrate } from "./db";
import { seedIfEmpty } from "./seed";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json({ limit: "30mb" }));
const allowedOrigins = (process.env.CORS_ORIGIN?.split(",").map(s => s.trim()).filter(Boolean)) || [
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:8082",
  "http://localhost:5173",
];
app.use(
  cors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: false,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

const pool = createPool();
const jwtSecret = new TextEncoder().encode(process.env.JWT_SECRET || "dev_secret");

const uploadsDir = path.join(process.cwd(), "uploads");
const heroDir = path.join(uploadsDir, "hero");
const promoDir = path.join(uploadsDir, "promos");
fs.mkdirSync(heroDir, { recursive: true });
fs.mkdirSync(promoDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

app.get("/health", async (_req, res) => {
  res.json({ ok: true });
});

async function signToken(adminId: number, email: string) {
  return new SignJWT({ sub: String(adminId), email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(jwtSecret);
}

async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, jwtSecret);
  return payload;
}

function getClientIp(req: express.Request) {
  const hdr = req.headers["x-forwarded-for"];
  if (typeof hdr === "string" && hdr.length) return hdr.split(",")[0].trim();
  if (Array.isArray(hdr) && hdr[0]) return String(hdr[0]);
  return req.socket.remoteAddress || "unknown";
}

const rateLimits = new Map<string, { count: number; reset: number }>();
function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const entry = rateLimits.get(key);
  if (!entry || now > entry.reset) {
    rateLimits.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
}

function rateLimitMiddleware(max: number, windowMs: number): express.RequestHandler {
  return (req, res, next) => {
    const key = `${req.path}:${getClientIp(req)}`;
    if (!rateLimit(key, max, windowMs)) return res.status(429).json({ error: "rate_limited" });
    return next();
  };
}

async function sendMail(to: string, subject: string, text: string, html?: string) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user || "no-reply@example.com";
  if (host && user && pass) {
    const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    await transporter.sendMail({ from, to, subject, text, html });
  } else {
    console.log(`password reset link for ${to}: ${text}`);
  }
}

async function sendSms(to: string, text: string) {
  const url = process.env.SMS_URL;
  const token = process.env.SMS_TOKEN;
  if (url && token) {
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to, text }),
      });
    } catch {}
  } else {
    console.log(`sms to ${to}: ${text}`);
  }
}

async function ensureAdminExists() {
  const { rows } = await pool.query(`select count(*)::int as c from admins`);
  if (rows[0]?.c === 0) {
    const email = process.env.ADMIN_EMAIL || "admin@example.com";
    const password = process.env.ADMIN_PASSWORD || "changeme";
    const hash = await bcrypt.hash(password, 10);
    await pool.query(`insert into admins(email,password_hash) values($1,$2)`, [email, hash]);
    console.log(`admin initialized: ${email}`);
  }
  const extraEmail = process.env.CREATE_ADMIN_EMAIL;
  const extraPassword = process.env.CREATE_ADMIN_PASSWORD;
  if (extraEmail && extraPassword) {
    const exists = await pool.query(`select 1 from admins where email=$1`, [extraEmail]);
    if (!exists.rows[0]) {
      const hash = await bcrypt.hash(extraPassword, 10);
      await pool.query(`insert into admins(email,password_hash) values($1,$2)`, [extraEmail, hash]);
      console.log(`admin ensured: ${extraEmail}`);
    }
  }
}

const AuthSchema = z.object({ email: z.string().email(), password: z.string().min(6) });
const FooterSchema = z.object({
  brandEmoji: z.string().min(1),
  brandName: z.string().min(1),
  description: z.string().min(1),
  deliveryTitle: z.string().min(1),
  deliveryItems: z.array(z.string().min(1)).min(1),
  contactsTitle: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().min(1),
  address: z.string().min(1),
  socialItems: z.array(z.string().min(1)),
  copyright: z.string().min(1),
});
const defaultFooter = {
  brandEmoji: "🍬",
  brandName: "МираВкус",
  description: "Интернет-магазин натуральных сладостей для детей. Только качественные ингредиенты и ручная работа.",
  deliveryTitle: "Доставка и оплата",
  deliveryItems: [
    "Курьер по Москве — от 299 ₽",
    "ПВЗ по России — от 199 ₽",
    "Бесплатно от 3000 ₽",
    "Оплата картой или при получении",
  ],
  contactsTitle: "Контакты",
  phone: "📞 +7 (495) 123-45-67",
  email: "✉️ hello@candyland.ru",
  address: "📍 Москва, ул. Сладкая, 15",
  socialItems: ["📱 Telegram", "📷 Instagram", "💬 VK"],
  copyright: "© 2026 МираВкус. Все права защищены.",
};

app.post("/api/auth/login", rateLimitMiddleware(10, 15 * 60 * 1000), async (req, res) => {
  try {
    const { email, password } = AuthSchema.parse(req.body);
    const { rows } = await pool.query(`select id,email,password_hash from admins where email=$1`, [email]);
    const admin = rows[0];
    if (!admin) return res.status(401).json({ error: "invalid_credentials" });
    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) return res.status(401).json({ error: "invalid_credentials" });
    const token = await signToken(admin.id, admin.email);
    res.json({ token });
  } catch {
    res.status(400).json({ error: "bad_request" });
  }
});

function requireAuth(handler: express.RequestHandler): express.RequestHandler {
  return async (req, res, next) => {
    try {
      const hdr = req.headers.authorization;
      const token = hdr?.startsWith("Bearer ") ? hdr.slice(7) : null;
      if (!token) return res.status(401).json({ error: "unauthorized" });
      await verifyToken(token);
      return handler(req, res, next);
    } catch {
      return res.status(401).json({ error: "unauthorized" });
    }
  };
}

app.get("/api/categories", async (_req, res) => {
  const { rows } = await pool.query("select id,name,emoji,color,show_on_home,home_order from categories order by name");
  res.json(
    rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      emoji: r.emoji ?? undefined,
      color: r.color ?? undefined,
      showOnHome: r.show_on_home ?? null,
      homeOrder: r.home_order ?? null,
    }))
  );
});

const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  showOnHome: z.boolean().optional().nullable(),
  homeOrder: z.number().int().optional().nullable(),
});

app.post("/api/categories", requireAuth(async (req, res) => {
  const data = CategorySchema.parse(req.body);
  await pool.query(
    "insert into categories(id,name,emoji,color,show_on_home,home_order) values($1,$2,$3,$4,$5,$6) on conflict (id) do update set name=excluded.name,emoji=excluded.emoji,color=excluded.color,show_on_home=coalesce(excluded.show_on_home,categories.show_on_home),home_order=coalesce(excluded.home_order,categories.home_order)",
    [data.id, data.name, data.emoji ?? null, data.color ?? null, data.showOnHome ?? null, data.homeOrder ?? null]
  );
  res.status(201).json({ ok: true });
}));

app.put("/api/categories/:id", requireAuth(async (req, res) => {
  const data = CategorySchema.partial({ id: true }).parse(req.body);
  const id = req.params.id;
  await pool.query(
    "update categories set name=coalesce($2,name), emoji=$3, color=$4, show_on_home=coalesce($5,show_on_home), home_order=coalesce($6,home_order) where id=$1",
    [id, data.name ?? null, data.emoji ?? null, data.color ?? null, data.showOnHome ?? null, data.homeOrder ?? null]
  );
  res.json({ ok: true });
}));

app.delete("/api/categories/:id", requireAuth(async (req, res) => {
  await pool.query("delete from categories where id=$1", [req.params.id]);
  res.json({ ok: true });
}));

app.get("/api/products", async (_req, res) => {
  const { rows } = await pool.query(
    "select id,name,price,old_price,category,categories,badge,description,sku,composition_short,shelf_life,country,composition_set,storage_temperature,product_features,set_weight,package_dimensions,description_long,image,images,video_url,popularity,active,packaging_mode,standard_packaging_id from products order by id"
  );
  res.json(
    rows.map((r: any) => {
      const categories = Array.isArray(r.categories) ? r.categories.filter(Boolean) : [];
      const primary = r.category ?? categories[0] ?? "";
      return {
        id: r.id,
        name: r.name,
        price: r.price,
        oldPrice: r.old_price ?? undefined,
        category: primary,
        categories: categories.length ? categories : (primary ? [primary] : []),
        badge: r.badge ?? undefined,
        description: r.description,
        sku: r.sku ?? undefined,
        compositionShort: r.composition_short ?? undefined,
        shelfLife: r.shelf_life ?? undefined,
        country: r.country ?? undefined,
        compositionSet: r.composition_set ?? undefined,
        storageTemperature: r.storage_temperature ?? undefined,
        productFeatures: r.product_features ?? undefined,
        setWeight: r.set_weight ?? undefined,
        packageDimensions: r.package_dimensions ?? undefined,
        descriptionLong: r.description_long ?? undefined,
        image: r.image,
        images: r.images ?? undefined,
        videoUrl: r.video_url ?? undefined,
        popularity: r.popularity ?? 0,
        active: r.active,
        packagingMode: r.packaging_mode ?? undefined,
        standardPackagingId: r.standard_packaging_id ?? null,
      };
    })
  );
});

const ProductSchema = z.object({
  name: z.string(),
  price: z.number().int(),
  oldPrice: z.number().int().optional(),
  category: z.string().optional(),
  categories: z.array(z.string()).optional(),
  badge: z.string().optional(),
  description: z.string(),
  sku: z.string().optional(),
  compositionShort: z.string().optional(),
  shelfLife: z.string().optional(),
  country: z.string().optional(),
  compositionSet: z.string().optional(),
  storageTemperature: z.string().optional(),
  productFeatures: z.string().optional(),
  setWeight: z.string().optional(),
  packageDimensions: z.string().optional(),
  descriptionLong: z.string().optional(),
  image: z.string(),
  images: z.array(z.string()).optional(),
  videoUrl: z.string().optional().nullable(),
  popularity: z.number().int().optional(),
  active: z.boolean().optional(),
  packagingMode: z.enum(["none", "standard", "selectable"]).optional(),
  standardPackagingId: z.string().nullable().optional(),
});

app.post("/api/products", requireAuth(async (req, res) => {
  const p = ProductSchema.parse(req.body);
  const categories = (p.categories && p.categories.length ? p.categories : (p.category ? [p.category] : [])).filter(Boolean);
  if (!categories.length) return res.status(400).json({ error: "missing_category" });
  const primaryCategory = categories[0] ?? null;
  let packagingMode = p.packagingMode && p.packagingMode !== "none" ? p.packagingMode : null;
  let standardPackagingId = p.packagingMode === "standard" ? (p.standardPackagingId ?? null) : null;
  if (packagingMode === "standard" && !standardPackagingId) {
    const { rows: has } = await pool.query("select 1 from packaging_options where id=$1", ["standard"]);
    standardPackagingId = has.length ? "standard" : null;
    if (!standardPackagingId) packagingMode = null;
  }
  const { rows } = await pool.query(
    "insert into products(name,price,old_price,category,categories,badge,description,sku,composition_short,shelf_life,country,composition_set,storage_temperature,product_features,set_weight,package_dimensions,description_long,image,images,video_url,popularity,active,packaging_mode,standard_packaging_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) returning id",
    [
      p.name,
      p.price,
      p.oldPrice ?? null,
      primaryCategory,
      categories,
      p.badge ?? null,
      p.description,
      p.sku ?? null,
      p.compositionShort ?? null,
      p.shelfLife ?? null,
      p.country ?? null,
      p.compositionSet ?? null,
      p.storageTemperature ?? null,
      p.productFeatures ?? null,
      p.setWeight ?? null,
      p.packageDimensions ?? null,
      p.descriptionLong ?? null,
      p.image,
      p.images ?? null,
      p.videoUrl ?? null,
      p.popularity ?? 0,
      p.active ?? true,
      packagingMode,
      standardPackagingId,
    ]
  );
  res.status(201).json({ id: rows[0].id });
}));

app.put("/api/products/:id", requireAuth(async (req, res) => {
  const id = Number(req.params.id);
  const p = ProductSchema.partial().parse(req.body);
  const hasCategories = Object.prototype.hasOwnProperty.call(p, "categories");
  if (hasCategories && (!Array.isArray(p.categories) || p.categories.filter(Boolean).length === 0)) {
    return res.status(400).json({ error: "missing_category" });
  }
  const nextCategories = hasCategories ? (p.categories ?? []).filter(Boolean) : null;
  const nextPrimaryCategory = hasCategories ? (nextCategories![0] ?? null) : (p.category ?? null);
  const hasPackagingMode = Object.prototype.hasOwnProperty.call(p, "packagingMode");
  const hasStandardPackagingId = Object.prototype.hasOwnProperty.call(p, "standardPackagingId");
  let nextPackagingMode = hasPackagingMode ? (p.packagingMode === "none" ? null : (p.packagingMode ?? null)) : null;
  let nextStandardPackagingId =
    hasPackagingMode
      ? (p.packagingMode === "standard" ? (p.standardPackagingId ?? null) : null)
      : (hasStandardPackagingId ? (p.standardPackagingId ?? null) : null);
  if ((hasPackagingMode || hasStandardPackagingId) && nextPackagingMode === "standard" && !nextStandardPackagingId) {
    const { rows: has } = await pool.query("select 1 from packaging_options where id=$1", ["standard"]);
    nextStandardPackagingId = has.length ? "standard" : null;
    if (!nextStandardPackagingId) nextPackagingMode = null;
  }
  await pool.query(
    "update products set name=coalesce($2,name), price=coalesce($3,price), old_price=$4, category=coalesce($5,category), categories=case when $26 then $27 when $5 is not null then array[$5] else categories end, badge=$6, description=coalesce($7,description), sku=coalesce($8,sku), composition_short=coalesce($9,composition_short), shelf_life=coalesce($10,shelf_life), country=coalesce($11,country), composition_set=coalesce($12,composition_set), storage_temperature=coalesce($13,storage_temperature), product_features=coalesce($14,product_features), set_weight=coalesce($15,set_weight), package_dimensions=coalesce($16,package_dimensions), description_long=coalesce($17,description_long), image=coalesce($18,image), images=$19, video_url=coalesce($28,video_url), popularity=coalesce($20,popularity), active=coalesce($21,active), packaging_mode=case when $22 then $23 when $24 and $25 is null and packaging_mode='standard' then null else packaging_mode end, standard_packaging_id=case when $24 then $25 else standard_packaging_id end where id=$1",
    [
      id,
      p.name ?? null,
      p.price ?? null,
      p.oldPrice ?? null,
      nextPrimaryCategory,
      p.badge ?? null,
      p.description ?? null,
      p.sku ?? null,
      p.compositionShort ?? null,
      p.shelfLife ?? null,
      p.country ?? null,
      p.compositionSet ?? null,
      p.storageTemperature ?? null,
      p.productFeatures ?? null,
      p.setWeight ?? null,
      p.packageDimensions ?? null,
      p.descriptionLong ?? null,
      p.image ?? null,
      p.images ?? null,
      p.popularity ?? null,
      p.active ?? null,
      hasPackagingMode,
      nextPackagingMode,
      hasPackagingMode || hasStandardPackagingId,
      nextStandardPackagingId,
      hasCategories,
      nextCategories,
      p.videoUrl ?? null,
    ]
  );
  res.json({ ok: true });
}));

app.delete("/api/products/:id", requireAuth(async (req, res) => {
  await pool.query("delete from products where id=$1", [Number(req.params.id)]);
  res.json({ ok: true });
}));

/* ─── Packaging ─── */
const PackagingSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  price: z.number().int().min(0),
  active: z.boolean().optional(),
  image: z.string().optional().nullable(),
  images: z.array(z.string()).optional(),
});

app.get("/api/packaging", async (_req, res) => {
  const { rows } = await pool.query("select id,name,price,active,image,images from packaging_options order by name");
  res.json(rows.map((r: any) => ({ id: r.id, name: r.name, price: r.price, active: r.active, image: r.image ?? undefined, images: r.images ?? undefined })));
});

app.post("/api/packaging", requireAuth(async (req, res) => {
  const p = PackagingSchema.parse(req.body);
  await pool.query(
    "insert into packaging_options(id,name,price,active,image,images) values($1,$2,$3,$4,$5,$6) on conflict (id) do update set name=excluded.name,price=excluded.price,active=excluded.active,image=excluded.image,images=excluded.images",
    [p.id, p.name, p.price, p.active ?? true, p.image ?? null, p.images ?? null]
  );
  res.status(201).json({ ok: true });
}));

app.put("/api/packaging/:id", requireAuth(async (req, res) => {
  const id = req.params.id;
  const p = PackagingSchema.partial().parse(req.body);
  const hasImage = Object.prototype.hasOwnProperty.call(p, "image");
  const hasImages = Object.prototype.hasOwnProperty.call(p, "images");
  const nextImage = hasImage ? (p.image ?? null) : null;
  const nextImages = hasImages ? (p.images ?? null) : null;
  await pool.query(
    "update packaging_options set name=coalesce($2,name), price=coalesce($3,price), active=coalesce($4,active), image=case when $5 then $6 else image end, images=case when $7 then $8 else images end where id=$1",
    [id, p.name ?? null, p.price ?? null, p.active ?? null, hasImage, nextImage, hasImages, nextImages]
  );
  res.json({ ok: true });
}));

app.delete("/api/packaging/:id", requireAuth(async (req, res) => {
  const id = req.params.id;
  await pool.query("update products set standard_packaging_id=null where standard_packaging_id=$1", [id]);
  await pool.query("delete from packaging_options where id=$1", [id]);
  res.json({ ok: true });
}));

const productsDir = path.join(uploadsDir, "products");
fs.mkdirSync(productsDir, { recursive: true });
const productVideosDir = path.join(productsDir, "videos");
fs.mkdirSync(productVideosDir, { recursive: true });
const articlesDir = path.join(uploadsDir, "articles");
fs.mkdirSync(articlesDir, { recursive: true });
const articleVideosDir = path.join(articlesDir, "videos");
fs.mkdirSync(articleVideosDir, { recursive: true });
const UploadProductSchema = z.object({ dataUrl: z.string().min(1) });
app.post("/api/products/upload", requireAuth(async (req, res) => {
  try {
    const { dataUrl } = UploadProductSchema.parse(req.body);
    const m = /^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/.exec(dataUrl);
    if (!m) return res.status(400).json({ error: "bad_image" });
    const mime = m[1];
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    const buf = Buffer.from(m[3], "base64");
    if (buf.length > 5 * 1024 * 1024) return res.status(400).json({ error: "too_large" });
    const name = `product_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = path.join(productsDir, name);
    fs.writeFileSync(filePath, buf);
    const url = `/uploads/products/${name}`;
    res.status(201).json({ url });
  } catch {
    res.status(400).json({ error: "bad_request" });
  }
}));

const UploadProductVideoSchema = z.object({ dataUrl: z.string().min(1) });
app.post("/api/products/upload-video", requireAuth(async (req, res) => {
  try {
    const { dataUrl } = UploadProductVideoSchema.parse(req.body);
    const m = /^data:(video\/(mp4|webm|ogg));base64,(.+)$/.exec(dataUrl);
    if (!m) return res.status(400).json({ error: "bad_video" });
    const mime = m[1];
    const ext = mime.includes("webm") ? "webm" : mime.includes("ogg") ? "ogg" : "mp4";
    const buf = Buffer.from(m[3], "base64");
    if (buf.length > 20 * 1024 * 1024) return res.status(400).json({ error: "too_large" });
    const name = `product_video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = path.join(productVideosDir, name);
    fs.writeFileSync(filePath, buf);
    const url = `/uploads/products/videos/${name}`;
    res.status(201).json({ url });
  } catch {
    res.status(400).json({ error: "bad_request" });
  }
}));

const UploadArticleSchema = z.object({ dataUrl: z.string().min(1) });
app.post("/api/articles/upload", requireAuth(async (req, res) => {
  try {
    const { dataUrl } = UploadArticleSchema.parse(req.body);
    const m = /^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/.exec(dataUrl);
    if (!m) return res.status(400).json({ error: "bad_image" });
    const mime = m[1];
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    const buf = Buffer.from(m[3], "base64");
    if (buf.length > 5 * 1024 * 1024) return res.status(400).json({ error: "too_large" });
    const name = `article_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = path.join(articlesDir, name);
    fs.writeFileSync(filePath, buf);
    const url = `/uploads/articles/${name}`;
    res.status(201).json({ url });
  } catch {
    res.status(400).json({ error: "bad_request" });
  }
}));

const UploadArticleVideoSchema = z.object({ dataUrl: z.string().min(1) });
app.post("/api/articles/upload-video", requireAuth(async (req, res) => {
  try {
    const { dataUrl } = UploadArticleVideoSchema.parse(req.body);
    const m = /^data:(video\/(mp4|webm|ogg));base64,(.+)$/.exec(dataUrl);
    if (!m) return res.status(400).json({ error: "bad_video" });
    const mime = m[1];
    const ext = mime.includes("webm") ? "webm" : mime.includes("ogg") ? "ogg" : "mp4";
    const buf = Buffer.from(m[3], "base64");
    if (buf.length > 20 * 1024 * 1024) return res.status(400).json({ error: "too_large" });
    const name = `article_video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = path.join(articleVideosDir, name);
    fs.writeFileSync(filePath, buf);
    const url = `/uploads/articles/videos/${name}`;
    res.status(201).json({ url });
  } catch {
    res.status(400).json({ error: "bad_request" });
  }
}));

/* ─── Hero images ─── */
const HeroImageSchema = z.object({
  url: z.string(),
  link: z.string().optional().nullable(),
  position: z.number().int().optional(),
  active: z.boolean().optional(),
});

app.get("/api/hero-images", async (_req, res) => {
  const { rows } = await pool.query("select id,url,link,position,active from hero_images order by position asc, id asc");
  res.json(rows);
});

const UploadSchema = z.object({ dataUrl: z.string().min(1) });
app.post("/api/hero-images/upload", requireAuth(async (req, res) => {
  try {
    const { dataUrl } = UploadSchema.parse(req.body);
    const m = /^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/.exec(dataUrl);
    if (!m) return res.status(400).json({ error: "bad_image" });
    const mime = m[1];
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    const buf = Buffer.from(m[3], "base64");
    if (buf.length > 5 * 1024 * 1024) return res.status(400).json({ error: "too_large" });
    const name = `hero_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = path.join(heroDir, name);
    fs.writeFileSync(filePath, buf);
    const url = `/uploads/hero/${name}`;
    res.status(201).json({ url });
  } catch {
    res.status(400).json({ error: "bad_request" });
  }
}));

app.post("/api/hero-images", requireAuth(async (req, res) => {
  const p = HeroImageSchema.parse(req.body);
  const pos = p.position ?? 0;
  const { rows } = await pool.query(
    "insert into hero_images(url,link,position,active) values($1,$2,$3,$4) returning id",
    [p.url, p.link ?? null, pos, p.active ?? true]
  );
  res.status(201).json({ id: rows[0].id });
}));

app.put("/api/hero-images/:id", requireAuth(async (req, res) => {
  const id = Number(req.params.id);
  const p = HeroImageSchema.partial().parse(req.body);
  await pool.query(
    "update hero_images set url=coalesce($2,url), link=coalesce($3,link), position=coalesce($4,position), active=coalesce($5,active) where id=$1",
    [id, p.url ?? null, p.link ?? null, p.position ?? null, p.active ?? null]
  );
  res.json({ ok: true });
}));

app.delete("/api/hero-images/:id", requireAuth(async (req, res) => {
  await pool.query("delete from hero_images where id=$1", [Number(req.params.id)]);
  res.json({ ok: true });
}));

/* ─── Promo banners ─── */
const PromoBannerSchema = z.object({
  url: z.string(),
  link: z.string().optional().nullable(),
  position: z.number().int().optional(),
  active: z.boolean().optional(),
});

app.get("/api/promo-banners", async (_req, res) => {
  const { rows } = await pool.query("select id,url,link,position,active from promo_banners order by position asc, id asc");
  res.json(rows);
});

app.post("/api/promo-banners/upload", requireAuth(async (req, res) => {
  try {
    const { dataUrl } = UploadSchema.parse(req.body);
    const m = /^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/.exec(dataUrl);
    if (!m) return res.status(400).json({ error: "bad_image" });
    const mime = m[1];
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    const buf = Buffer.from(m[3], "base64");
    if (buf.length > 5 * 1024 * 1024) return res.status(400).json({ error: "too_large" });
    const name = `promo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = path.join(promoDir, name);
    fs.writeFileSync(filePath, buf);
    const url = `/uploads/promos/${name}`;
    res.status(201).json({ url });
  } catch {
    res.status(400).json({ error: "bad_request" });
  }
}));

app.post("/api/promo-banners", requireAuth(async (req, res) => {
  const p = PromoBannerSchema.parse(req.body);
  const pos = p.position ?? 0;
  const { rows } = await pool.query(
    "insert into promo_banners(url,link,position,active) values($1,$2,$3,$4) returning id",
    [p.url, p.link ?? null, pos, p.active ?? true]
  );
  res.status(201).json({ id: rows[0].id });
}));

app.put("/api/promo-banners/:id", requireAuth(async (req, res) => {
  const id = Number(req.params.id);
  const p = PromoBannerSchema.partial().parse(req.body);
  await pool.query(
    "update promo_banners set url=coalesce($2,url), link=coalesce($3,link), position=coalesce($4,position), active=coalesce($5,active) where id=$1",
    [id, p.url ?? null, p.link ?? null, p.position ?? null, p.active ?? null]
  );
  res.json({ ok: true });
}));

app.delete("/api/promo-banners/:id", requireAuth(async (req, res) => {
  await pool.query("delete from promo_banners where id=$1", [Number(req.params.id)]);
  res.json({ ok: true });
}));

app.get("/api/footer", async (_req, res) => {
  const { rows } = await pool.query("select data from footer_settings where id=1");
  if (!rows[0]) return res.json(defaultFooter);
  const data = rows[0].data || defaultFooter;
  res.json(data);
});

app.put("/api/footer", requireAuth(async (req, res) => {
  const data = FooterSchema.parse(req.body);
  await pool.query(
    "insert into footer_settings(id,data) values(1,$1) on conflict (id) do update set data=excluded.data",
    [data]
  );
  res.json({ ok: true });
}));

/* ─── Promocodes ─── */
const PromoSchema = z.object({
  code: z.string().min(1),
  percent: z.number().int().positive().max(90),
  scope: z.enum(["all", "category", "product"]),
  categories: z.array(z.string()).optional(),
  products: z.array(z.number().int()).optional(),
  active: z.boolean().optional(),
});

app.get("/api/promos", async (_req, res) => {
  const { rows } = await pool.query("select id,code,percent,scope,categories,products,active from promocodes order by id");
  res.json(rows.map((r: any) => ({
    id: r.id,
    code: r.code,
    percent: r.percent,
    scope: r.scope,
    categories: r.categories ?? undefined,
    products: r.products ?? undefined,
    active: r.active,
  })));
});

app.post("/api/promos", requireAuth(async (req, res) => {
  const p = PromoSchema.parse(req.body);
  const { rows } = await pool.query(
    "insert into promocodes(code,percent,scope,categories,products,active) values($1,$2,$3,$4,$5,$6) returning id",
    [p.code.toUpperCase(), p.percent, p.scope, p.categories ?? null, p.products ?? null, p.active ?? true]
  );
  res.status(201).json({ id: rows[0].id });
}));

app.put("/api/promos/:id", requireAuth(async (req, res) => {
  const id = Number(req.params.id);
  const p = PromoSchema.partial().parse(req.body);
  await pool.query(
    "update promocodes set code=coalesce($2,code), percent=coalesce($3,percent), scope=coalesce($4,scope), categories=$5, products=$6, active=coalesce($7,active) where id=$1",
    [id, p.code ? p.code.toUpperCase() : null, p.percent ?? null, p.scope ?? null, p.categories ?? null, p.products ?? null, p.active ?? null]
  );
  res.json({ ok: true });
}));

app.delete("/api/promos/:id", requireAuth(async (req, res) => {
  await pool.query("delete from promocodes where id=$1", [Number(req.params.id)]);
  res.json({ ok: true });
}));

app.get("/api/articles", async (_req, res) => {
  const { rows } = await pool.query(
    "select id,slug,title,excerpt,content,tag,read_time,image,images,video_url,product_id,category_id from articles order by id"
  );
  res.json(
    rows.map((r: any) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      excerpt: r.excerpt,
      content: r.content ?? undefined,
      tag: r.tag ?? "",
      readTime: r.read_time ?? "",
      image: r.image ?? undefined,
      images: r.images ?? undefined,
      videoUrl: r.video_url ?? undefined,
      productId: r.product_id ?? undefined,
      categoryId: r.category_id ?? undefined,
    }))
  );
});

app.get("/api/articles/:slug", async (req, res) => {
  const { rows } = await pool.query(
    "select id,slug,title,excerpt,content,tag,read_time,image,images,video_url,product_id,category_id from articles where slug=$1 limit 1",
    [req.params.slug]
  );
  if (!rows[0]) return res.status(404).json({ error: "not_found" });
  const r = rows[0];
  res.json({
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    content: r.content ?? undefined,
    tag: r.tag ?? "",
    readTime: r.read_time ?? "",
    image: r.image ?? undefined,
    images: r.images ?? undefined,
    videoUrl: r.video_url ?? undefined,
    productId: r.product_id ?? undefined,
    categoryId: r.category_id ?? undefined,
  });
});

const ArticleSchema = z.object({
  slug: z.string(),
  title: z.string(),
  excerpt: z.string(),
  content: z.string().optional(),
  tag: z.string().optional(),
  readTime: z.string().optional(),
  image: z.string().optional(),
  images: z.array(z.string()).optional(),
  videoUrl: z.string().optional().nullable(),
  productId: z.number().int().optional(),
  categoryId: z.string().optional().nullable(),
});

app.post("/api/articles", requireAuth(async (req, res) => {
  const a = ArticleSchema.parse(req.body);
  await pool.query(
    "insert into articles(slug,title,excerpt,content,tag,read_time,image,images,video_url,product_id,category_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
    [a.slug, a.title, a.excerpt, a.content ?? null, a.tag ?? null, a.readTime ?? null, a.image ?? null, a.images ?? null, a.videoUrl ?? null, a.productId ?? null, a.categoryId ?? null]
  );
  res.status(201).json({ ok: true });
}));

app.put("/api/articles/:id", requireAuth(async (req, res) => {
  const id = Number(req.params.id);
  const a = ArticleSchema.partial({ slug: true }).parse(req.body);
  await pool.query(
    "update articles set title=coalesce($2,title), excerpt=coalesce($3,excerpt), content=$4, tag=$5, read_time=$6, image=$7, images=$8, video_url=$9, product_id=$10, category_id=$11 where id=$1",
    [id, a.title ?? null, a.excerpt ?? null, a.content ?? null, a.tag ?? null, a.readTime ?? null, a.image ?? null, a.images ?? null, a.videoUrl ?? null, a.productId ?? null, a.categoryId ?? null]
  );
  res.json({ ok: true });
}));

app.delete("/api/articles/:id", requireAuth(async (req, res) => {
  await pool.query("delete from articles where id=$1", [Number(req.params.id)]);
  res.json({ ok: true });
}));

const OrderSchema = z.object({
  items: z.array(
    z.object({
      product: z.object({
        id: z.number(),
        name: z.string(),
        price: z.number(),
      }),
      quantity: z.number().int().positive(),
      packagingId: z.string().nullable().optional(),
      packagingName: z.string().nullable().optional(),
      packagingPrice: z.number().int().nullable().optional(),
    })
  ),
  total: z.number().int(),
  discount: z.number().int(),
  promo: z.string().nullable().optional(),
  contact: z.object({ name: z.string(), phone: z.string() }),
  delivery: z.object({ address: z.string(), method: z.string(), payment: z.string() }),
});

const OrderStatusSchema = z.enum(["processing", "handed", "delivered", "cancelled"]);
const OrderUpdateSchema = z.object({
  status: OrderStatusSchema.optional(),
  deliveryStatus: z.string().optional(),
  deliveryProvider: z.string().optional(),
  trackingNumber: z.string().optional(),
});

app.post("/api/orders", async (req, res) => {
  const o = OrderSchema.parse(req.body);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query(
      "insert into orders(total,discount,promo,contact_name,contact_phone,delivery_address,delivery_method,payment_method,status) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id",
      [
        o.total,
        o.discount,
        o.promo ?? null,
        o.contact.name,
        o.contact.phone,
        o.delivery.address,
        o.delivery.method,
        o.delivery.payment,
        "processing",
      ]
    );
    const orderId = rows[0].id as number;
    for (const item of o.items) {
      await client.query(
        "insert into order_items(order_id,product_id,name,quantity,price,packaging_id,packaging_name,packaging_price) values($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          orderId,
          item.product.id,
          item.product.name,
          item.quantity,
          item.product.price,
          item.packagingId ?? null,
          item.packagingName ?? null,
          item.packagingPrice ?? 0,
        ]
      );
    }
    await client.query("commit");
    res.status(201).json({ id: orderId });
  } catch (e) {
    await client.query("rollback");
    res.status(500).json({ error: "failed" });
  } finally {
    client.release();
  }
});

app.get("/api/orders", requireAuth(async (_req, res) => {
  const { rows } = await pool.query(
    `select
      o.id,
      o.total,
      o.discount,
      o.promo,
      o.contact_name,
      o.contact_phone,
      o.delivery_address,
      o.delivery_method,
      o.payment_method,
      o.created_at,
      o.status,
      o.delivery_status,
      o.delivery_provider,
      o.tracking_number,
      coalesce(
        json_agg(
          json_build_object(
            'id', oi.id,
            'productId', oi.product_id,
            'name', oi.name,
            'quantity', oi.quantity,
            'price', oi.price,
            'packagingId', oi.packaging_id,
            'packagingName', oi.packaging_name,
            'packagingPrice', oi.packaging_price
          )
        ) filter (where oi.id is not null),
        '[]'
      ) as items
    from orders o
    left join order_items oi on oi.order_id = o.id
    group by o.id
    order by o.id desc`
  );
  res.json(rows.map((r: any) => ({
    id: r.id,
    total: r.total,
    discount: r.discount,
    promo: r.promo ?? undefined,
    contact: { name: r.contact_name, phone: r.contact_phone },
    delivery: { address: r.delivery_address, method: r.delivery_method, payment: r.payment_method },
    createdAt: r.created_at,
    status: r.status,
    deliveryStatus: r.delivery_status ?? undefined,
    deliveryProvider: r.delivery_provider ?? undefined,
    trackingNumber: r.tracking_number ?? undefined,
    items: r.items ?? [],
  })));
}));

app.put("/api/orders/:id", requireAuth(async (req, res) => {
  const id = Number(req.params.id);
  const data = OrderUpdateSchema.parse(req.body);
  const { rows } = await pool.query("select status, contact_phone from orders where id=$1", [id]);
  const current = rows[0];
  if (!current) return res.status(404).json({ error: "not_found" });
  await pool.query(
    "update orders set status=coalesce($2,status), delivery_status=coalesce($3,delivery_status), delivery_provider=coalesce($4,delivery_provider), tracking_number=coalesce($5,tracking_number) where id=$1",
    [
      id,
      data.status ?? null,
      data.deliveryStatus ?? null,
      data.deliveryProvider ?? null,
      data.trackingNumber ?? null,
    ]
  );
  if (data.status && current.status !== data.status && current.contact_phone) {
    const map: Record<string, string> = {
      processing: "в обработке",
      handed: "передан в доставку",
      delivered: "доставлен",
      cancelled: "отменён",
    };
    await sendSms(String(current.contact_phone), `Заказ №${id}: ${map[data.status] || data.status}.`);
  }
  res.json({ ok: true });
}));

const ChangePasswordSchema = z.object({ currentPassword: z.string().min(6), newPassword: z.string().min(6) });
app.post("/api/auth/change-password", rateLimitMiddleware(10, 15 * 60 * 1000), requireAuth(async (req, res) => {
  try {
    const data = ChangePasswordSchema.parse(req.body);
    const hdr = req.headers.authorization!;
    const token = hdr.slice(7);
    const payload = await verifyToken(token);
    const email = String(payload.email);
    const { rows } = await pool.query(`select id,password_hash from admins where email=$1`, [email]);
    const admin = rows[0];
    if (!admin) return res.status(401).json({ error: "unauthorized" });
    const ok = await bcrypt.compare(data.currentPassword, admin.password_hash);
    if (!ok) return res.status(400).json({ error: "invalid_password" });
    const hash = await bcrypt.hash(data.newPassword, 10);
    await pool.query(`update admins set password_hash=$2 where id=$1`, [admin.id, hash]);
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "bad_request" });
  }
}));

const RequestResetSchema = z.object({ email: z.string().email() });
app.post("/api/auth/request-reset", rateLimitMiddleware(5, 15 * 60 * 1000), async (req, res) => {
  try {
    const { email } = RequestResetSchema.parse(req.body);
    const { rows } = await pool.query(`select id from admins where email=$1`, [email]);
    const admin = rows[0];
    if (admin) {
      const token = cryptoRandom();
      const expires = new Date(Date.now() + 1000 * 60 * 15);
      await pool.query(`update admins set reset_token=$2, reset_expires=$3 where id=$1`, [admin.id, token, expires]);
      const urlBase = process.env.PUBLIC_URL || "http://localhost:8081";
      const link = `${urlBase}/reset?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
      await sendMail(email, "Сброс пароля", `Ссылка для сброса: ${link}`, `<p>Ссылка для сброса: <a href="${link}">${link}</a></p>`);
    }
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "bad_request" });
  }
});

const ResetSchema = z.object({ email: z.string().email(), token: z.string(), password: z.string().min(6) });
app.post("/api/auth/reset-password", rateLimitMiddleware(5, 15 * 60 * 1000), async (req, res) => {
  try {
    const { email, token, password } = ResetSchema.parse(req.body);
    const now = new Date();
    const { rows } = await pool.query(
      `select id from admins where email=$1 and reset_token=$2 and reset_expires > $3`,
      [email, token, now]
    );
    const admin = rows[0];
    if (!admin) return res.status(400).json({ error: "invalid_token" });
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `update admins set password_hash=$2, reset_token=null, reset_expires=null where id=$1`,
      [admin.id, hash]
    );
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "bad_request" });
  }
});

function cryptoRandom() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(bytes).toString("base64url");
}

const CreateAdminSchema = z.object({ email: z.string().email(), password: z.string().min(6) });
app.post("/api/auth/admins", rateLimitMiddleware(10, 15 * 60 * 1000), requireAuth(async (req, res) => {
  try {
    const { email, password } = CreateAdminSchema.parse(req.body);
    const { rows } = await pool.query(`select id from admins where email=$1`, [email]);
    if (rows[0]) return res.status(409).json({ error: "exists" });
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query(`insert into admins(email,password_hash) values($1,$2) returning id`, [email, hash]);
    res.status(201).json({ id: r.rows[0].id });
  } catch {
    res.status(400).json({ error: "bad_request" });
  }
}));

async function start() {
  await migrate(pool);
  await seedIfEmpty(pool);
  await ensureAdminExists();
  const port = Number(process.env.PORT || 3001);
  app.listen(port, "0.0.0.0", () => {
    console.log(`server on ${port}`);
  });
}

start();
