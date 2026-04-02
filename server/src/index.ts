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
  return new SignJWT({ sub: String(adminId), email, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(jwtSecret);
}

async function signCustomerToken(customerId: number, phone: string | null, email: string | null) {
  return new SignJWT({ sub: String(customerId), phone: phone ?? undefined, email: email ?? undefined, role: "customer" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
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

type IntegrationConfig = {
  smtp: {
    host?: string;
    port?: string;
    user?: string;
    pass?: string;
    from?: string;
  };
  ozon: {
    apiKey?: string;
    clientId?: string;
  };
  cdek: {
    clientId?: string;
    clientSecret?: string;
    fromPostalCode?: string;
  };
  russianPost: {
    apiKey?: string;
    login?: string;
    password?: string;
    fromPostalCode?: string;
  };
};

const IntegrationStoredSchema = z.object({
  smtp: z.object({
    host: z.string().optional(),
    port: z.string().optional(),
    user: z.string().optional(),
    pass: z.string().optional(),
    from: z.string().optional(),
  }).optional(),
  ozon: z.object({
    apiKey: z.string().optional(),
    clientId: z.string().optional(),
  }).optional(),
  cdek: z.object({
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    fromPostalCode: z.string().optional(),
  }).optional(),
  russianPost: z.object({
    apiKey: z.string().optional(),
    login: z.string().optional(),
    password: z.string().optional(),
    fromPostalCode: z.string().optional(),
  }).optional(),
});

const IntegrationPatchSchema = z.object({
  smtp: z.object({
    host: z.union([z.string(), z.number()]).optional().nullable(),
    port: z.union([z.string(), z.number()]).optional().nullable(),
    user: z.union([z.string(), z.number()]).optional().nullable(),
    pass: z.union([z.string(), z.number()]).optional().nullable(),
    from: z.union([z.string(), z.number()]).optional().nullable(),
  }).partial().optional(),
  ozon: z.object({
    apiKey: z.union([z.string(), z.number()]).optional().nullable(),
    clientId: z.union([z.string(), z.number()]).optional().nullable(),
  }).partial().optional(),
  cdek: z.object({
    clientId: z.union([z.string(), z.number()]).optional().nullable(),
    clientSecret: z.union([z.string(), z.number()]).optional().nullable(),
    fromPostalCode: z.union([z.string(), z.number()]).optional().nullable(),
  }).partial().optional(),
  russianPost: z.object({
    apiKey: z.union([z.string(), z.number()]).optional().nullable(),
    login: z.union([z.string(), z.number()]).optional().nullable(),
    password: z.union([z.string(), z.number()]).optional().nullable(),
    fromPostalCode: z.union([z.string(), z.number()]).optional().nullable(),
  }).partial().optional(),
});

const emptyIntegrationConfig: IntegrationConfig = {
  smtp: {},
  ozon: {},
  cdek: {},
  russianPost: {},
};

let integrationConfigCache: IntegrationConfig | null = null;

function cleanOptionalString(value: unknown) {
  if (value === null || value === undefined) return undefined;
  const normalized = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
  const trimmed = normalized.trim();
  return trimmed || undefined;
}

function normalizeIntegrationConfig(input: unknown): IntegrationConfig {
  const parsed = IntegrationStoredSchema.safeParse(input);
  const src = parsed.success ? parsed.data : {};
  return {
    smtp: {
      host: cleanOptionalString(src.smtp?.host),
      port: cleanOptionalString(src.smtp?.port),
      user: cleanOptionalString(src.smtp?.user),
      pass: cleanOptionalString(src.smtp?.pass),
      from: cleanOptionalString(src.smtp?.from),
    },
    ozon: {
      apiKey: cleanOptionalString(src.ozon?.apiKey),
      clientId: cleanOptionalString(src.ozon?.clientId),
    },
    cdek: {
      clientId: cleanOptionalString(src.cdek?.clientId),
      clientSecret: cleanOptionalString(src.cdek?.clientSecret),
      fromPostalCode: cleanOptionalString(src.cdek?.fromPostalCode),
    },
    russianPost: {
      apiKey: cleanOptionalString(src.russianPost?.apiKey),
      login: cleanOptionalString(src.russianPost?.login),
      password: cleanOptionalString(src.russianPost?.password),
      fromPostalCode: cleanOptionalString(src.russianPost?.fromPostalCode),
    },
  };
}

function mergeIntegrationConfig(base: IntegrationConfig, patch: IntegrationConfig): IntegrationConfig {
  return {
    smtp: { ...base.smtp, ...patch.smtp },
    ozon: { ...base.ozon, ...patch.ozon },
    cdek: { ...base.cdek, ...patch.cdek },
    russianPost: { ...base.russianPost, ...patch.russianPost },
  };
}

function firstNonEmpty(...values: Array<string | undefined>) {
  for (const value of values) {
    const next = cleanOptionalString(value);
    if (next) return next;
  }
  return undefined;
}

async function loadIntegrationConfig() {
  const { rows } = await pool.query("select data from integration_settings where id=1");
  if (!rows[0]?.data) return emptyIntegrationConfig;
  return normalizeIntegrationConfig(rows[0].data);
}

async function getIntegrationConfig() {
  if (integrationConfigCache) return integrationConfigCache;
  integrationConfigCache = await loadIntegrationConfig();
  return integrationConfigCache;
}

async function saveIntegrationConfig(patch: IntegrationConfig) {
  const current = await getIntegrationConfig();
  const next = mergeIntegrationConfig(current, patch);
  await pool.query(
    "insert into integration_settings(id,data) values(1,$1) on conflict (id) do update set data=excluded.data",
    [next]
  );
  integrationConfigCache = next;
  return next;
}

async function getResolvedIntegrationConfig() {
  const stored = await getIntegrationConfig();
  return {
    smtp: {
      host: firstNonEmpty(stored.smtp.host, process.env.SMTP_HOST, process.env.MAIL_SMTP_HOST),
      port: firstNonEmpty(stored.smtp.port, process.env.SMTP_PORT, process.env.MAIL_SMTP_PORT, "587"),
      user: firstNonEmpty(stored.smtp.user, process.env.SMTP_USER, process.env.MAIL_LOGIN),
      pass: firstNonEmpty(stored.smtp.pass, process.env.SMTP_PASS, process.env.MAIL_PASSWORD),
      from: firstNonEmpty(stored.smtp.from, process.env.SMTP_FROM, process.env.MAIL_FROM),
    },
    ozon: {
      apiKey: firstNonEmpty(stored.ozon.apiKey, process.env.OZON_LOGISTICS_API_KEY),
      clientId: firstNonEmpty(stored.ozon.clientId, process.env.OZON_LOGISTICS_CLIENT_ID),
    },
    cdek: {
      clientId: firstNonEmpty(stored.cdek.clientId, process.env.CDEK_CLIENT_ID),
      clientSecret: firstNonEmpty(stored.cdek.clientSecret, process.env.CDEK_CLIENT_SECRET),
      fromPostalCode: firstNonEmpty(stored.cdek.fromPostalCode, process.env.CDEK_FROM_POSTAL_CODE),
    },
    russianPost: {
      apiKey: firstNonEmpty(stored.russianPost.apiKey, process.env.RUSPOST_API_KEY),
      login: firstNonEmpty(stored.russianPost.login, process.env.RUSPOST_LOGIN),
      password: firstNonEmpty(stored.russianPost.password, process.env.RUSPOST_PASSWORD),
      fromPostalCode: firstNonEmpty(stored.russianPost.fromPostalCode, process.env.RUSPOST_FROM_POSTAL_CODE),
    },
  };
}

async function sendMail(to: string, subject: string, text: string, html?: string) {
  const config = await getResolvedIntegrationConfig();
  const host = config.smtp.host;
  const port = Number(config.smtp.port || 587);
  const user = config.smtp.user;
  const pass = config.smtp.pass;
  const from = config.smtp.from || user || "no-reply@example.com";
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

async function ensureTestCustomerExists() {
  const rawPhone = process.env.TEST_CUSTOMER_PHONE || "+79000000000";
  const rawEmail = process.env.TEST_CUSTOMER_EMAIL || "test@miravkus.local";
  const password = process.env.TEST_CUSTOMER_PASSWORD || "test1234";
  const phone = rawPhone ? rawPhone.replace(/[^\d+]/g, "") : null;
  const email = rawEmail ? rawEmail.trim().toLowerCase() : null;
  if (!phone && !email) return;
  const { rows } = await pool.query(
    "select id from customers where ($1::text is not null and phone=$1) or ($2::text is not null and email=$2) limit 1",
    [phone, email]
  );
  const hash = await bcrypt.hash(password, 10);
  if (rows[0]) {
    await pool.query(
      "update customers set password_hash=$2, phone=coalesce($3,phone), email=coalesce($4,email) where id=$1",
      [rows[0].id, hash, phone, email]
    );
    console.log(`test customer updated: ${phone ?? "no-phone"} / ${email ?? "no-email"}`);
    return;
  }
  await pool.query("insert into customers(phone,email,password_hash) values($1,$2,$3)", [phone, email, hash]);
  console.log(`test customer created: ${phone ?? "no-phone"} / ${email ?? "no-email"}`);
}

const AuthSchema = z.object({ email: z.string().email(), password: z.string().min(6) });
const CustomerRequestSchema = z.object({
  phone: z.string().optional(),
  email: z.string().email().optional(),
}).refine(v => Boolean(v.phone || v.email), { message: "phone_or_email_required" });
const CustomerLoginSchema = z.object({ login: z.string().min(3), password: z.string().min(6) });
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
const HeroTextSchema = z.object({
  title: z.string().min(1),
  accent: z.string().min(1),
  subtitle: z.string().min(1),
  floatingCandiesEnabled: z.boolean().optional().default(true),
  floatingCandies: z.array(z.string().min(1)).optional().default(["🍭", "🍬", "🧁", "🍩", "🍪"]),
});
const FeatureBlockSchema = z.object({
  id: z.string().min(1),
  icon: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  link: z.string().optional().nullable(),
  bgColor: z.string().min(1),
});
const FeatureBlocksSchema = z.array(FeatureBlockSchema).min(1);
const AboutSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
  content: z.string().min(1),
  images: z.array(z.string().min(1)).optional(),
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
const defaultHeroText = {
  title: "Сладкое счастье",
  accent: "для детей",
  subtitle: "Натуральные конфеты, шоколад и подарочные наборы — с любовью для самых маленьких сладкоежек",
  floatingCandiesEnabled: true,
  floatingCandies: ["🍭", "🍬", "🧁", "🍩", "🍪"],
};
const defaultFeatureBlocks = [
  {
    id: "delivery",
    icon: "Truck",
    title: "Быстрая доставка",
    description: "От 1 дня по Москве",
    link: "/articles/dostavka",
    bgColor: "bg-candy-pink",
  },
  {
    id: "natural",
    icon: "ShieldCheck",
    title: "Натуральный состав",
    description: "Без вредных добавок",
    link: "/articles/naturalnyy-sostav",
    bgColor: "bg-candy-mint",
  },
  {
    id: "gift",
    icon: "Gift",
    title: "Подарочная упаковка",
    description: "Бесплатно к каждому набору",
    link: "/articles/podarochnaya-upakovka",
    bgColor: "bg-candy-lavender",
  },
  {
    id: "love",
    icon: "Heart",
    title: "Сделано с любовью",
    description: "Ручная работа кондитеров",
    link: "/articles/sdelano-s-lyubovyu",
    bgColor: "bg-candy-banana",
  },
];
const defaultAbout = {
  title: "О нас",
  subtitle: "Сладости, которые дарят радость и заботу",
  content: "МираВкус — это команда, которая превращает сладости в маленькие праздники. Мы выбираем ингредиенты с вниманием к составу и вкусу, чтобы наборы радовали детей и взрослых.\n\nКаждый подарок мы собираем вручную: подбираем гармоничные сочетания, проверяем свежесть и аккуратно упаковываем, чтобы впечатление было идеальным.\n\nНам важно, чтобы сладости были не только красивыми, но и честными по составу. Поэтому мы сотрудничаем с проверенными поставщиками и следим за качеством каждой партии.",
  images: ["/images/hero-sweets.jpg", "/images/gift-box.jpg", "/images/cookies.jpg"],
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

app.post("/api/customer/request-password", rateLimitMiddleware(5, 15 * 60 * 1000), async (req, res) => {
  try {
    const data = CustomerRequestSchema.parse(req.body);
    const phone = data.phone ? data.phone.replace(/[^\d+]/g, "") : null;
    const email = data.email ? data.email.trim().toLowerCase() : null;
    const code = String((crypto.getRandomValues(new Uint32Array(1))[0] % 900000) + 100000);
    const hash = await bcrypt.hash(code, 10);
    const { rows } = await pool.query(
      "select id,phone,email from customers where (phone=$1 and $1 is not null) or (email=$2 and $2 is not null) limit 1",
      [phone, email]
    );
    const existing = rows[0];
    if (existing) {
      await pool.query(
        "update customers set password_hash=$2, phone=coalesce($3,phone), email=coalesce($4,email) where id=$1",
        [existing.id, hash, phone, email]
      );
    } else {
      await pool.query(
        "insert into customers(phone,email,password_hash) values($1,$2,$3)",
        [phone, email, hash]
      );
    }
    if (phone) {
      await sendSms(phone, `Пароль для входа: ${code}`);
    }
    if (email) {
      await sendMail(email, "Пароль для входа", `Ваш пароль: ${code}`, `<p>Ваш пароль: <strong>${code}</strong></p>`);
    }
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "bad_request" });
  }
});

app.post("/api/customer/login", rateLimitMiddleware(10, 15 * 60 * 1000), async (req, res) => {
  try {
    const { login, password } = CustomerLoginSchema.parse(req.body);
    const trimmed = login.trim();
    const email = trimmed.includes("@") ? trimmed.toLowerCase() : null;
    const phone = !email ? trimmed.replace(/[^\d+]/g, "") : null;
    const { rows } = await pool.query(
      "select id,phone,email,password_hash from customers where (phone=$1 and $1 is not null) or (email=$2 and $2 is not null) limit 1",
      [phone, email]
    );
    const customer = rows[0];
    if (!customer || !customer.password_hash) return res.status(401).json({ error: "invalid_credentials" });
    const ok = await bcrypt.compare(password, customer.password_hash);
    if (!ok) return res.status(401).json({ error: "invalid_credentials" });
    const token = await signCustomerToken(customer.id, customer.phone ?? null, customer.email ?? null);
    res.json({ token, customer: { phone: customer.phone ?? null, email: customer.email ?? null } });
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

function requireCustomerAuth(handler: express.RequestHandler): express.RequestHandler {
  return async (req, res, next) => {
    try {
      const hdr = req.headers.authorization;
      const token = hdr?.startsWith("Bearer ") ? hdr.slice(7) : null;
      if (!token) return res.status(401).json({ error: "unauthorized" });
      const payload = await verifyToken(token);
      if (payload.role !== "customer") return res.status(401).json({ error: "unauthorized" });
      return handler(req, res, next);
    } catch {
      return res.status(401).json({ error: "unauthorized" });
    }
  };
}

function maskSecret(value: string | undefined) {
  if (!value) return null;
  if (value.length <= 8) return "***";
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

function providerStatus(required: Record<string, string | undefined>, optional?: Record<string, string | undefined>) {
  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  return {
    ready: missing.length === 0,
    missing,
    required: Object.fromEntries(Object.entries(required).map(([k, v]) => [k, Boolean(v)])),
    optional: Object.fromEntries(Object.entries(optional || {}).map(([k, v]) => [k, Boolean(v)])),
  };
}

const TestMailSchema = z.object({
  to: z.string().email().optional(),
  subject: z.string().min(1).max(200).optional(),
  text: z.string().min(1).max(5000).optional(),
});

const IntegrationTestSchema = z.object({
  provider: z.enum(["smtp", "ozon", "cdek", "russianPost", "pickup"]),
  mode: z.enum(["fake", "real"]).optional(),
  to: z.string().email().optional(),
  city: z.string().min(2).max(120).optional(),
});

const PickupPointsQuerySchema = z.object({
  provider: z.enum(["ozon", "cdek", "russianPost"]).optional(),
  mode: z.enum(["fake", "real"]).optional(),
  city: z.string().min(2).max(120).optional(),
});

function toIntegrationPatch(input: z.infer<typeof IntegrationPatchSchema>): IntegrationConfig {
  return {
    smtp: {
      host: cleanOptionalString(input.smtp?.host),
      port: cleanOptionalString(input.smtp?.port),
      user: cleanOptionalString(input.smtp?.user),
      pass: cleanOptionalString(input.smtp?.pass),
      from: cleanOptionalString(input.smtp?.from),
    },
    ozon: {
      apiKey: cleanOptionalString(input.ozon?.apiKey),
      clientId: cleanOptionalString(input.ozon?.clientId),
    },
    cdek: {
      clientId: cleanOptionalString(input.cdek?.clientId),
      clientSecret: cleanOptionalString(input.cdek?.clientSecret),
      fromPostalCode: cleanOptionalString(input.cdek?.fromPostalCode),
    },
    russianPost: {
      apiKey: cleanOptionalString(input.russianPost?.apiKey),
      login: cleanOptionalString(input.russianPost?.login),
      password: cleanOptionalString(input.russianPost?.password),
      fromPostalCode: cleanOptionalString(input.russianPost?.fromPostalCode),
    },
  };
}

function buildIntegrationStatus(config: Awaited<ReturnType<typeof getResolvedIntegrationConfig>>) {
  return {
    ozon: providerStatus(
      {
        OZON_LOGISTICS_API_KEY: config.ozon.apiKey,
      },
      {
        OZON_LOGISTICS_CLIENT_ID: config.ozon.clientId,
      }
    ),
    cdek: providerStatus({
      CDEK_CLIENT_ID: config.cdek.clientId,
      CDEK_CLIENT_SECRET: config.cdek.clientSecret,
      CDEK_FROM_POSTAL_CODE: config.cdek.fromPostalCode,
    }),
    russianPost: providerStatus({
      RUSPOST_API_KEY: config.russianPost.apiKey,
      RUSPOST_LOGIN: config.russianPost.login,
      RUSPOST_PASSWORD: config.russianPost.password,
      RUSPOST_FROM_POSTAL_CODE: config.russianPost.fromPostalCode,
    }),
    smtp: providerStatus(
      {
        SMTP_HOST_OR_MAIL_SMTP_HOST: config.smtp.host,
        SMTP_USER_OR_MAIL_LOGIN: config.smtp.user,
        SMTP_PASS_OR_MAIL_PASSWORD: config.smtp.pass,
      },
      {
        SMTP_FROM_OR_MAIL_FROM: config.smtp.from,
        SMTP_PORT_OR_MAIL_SMTP_PORT: config.smtp.port,
      }
    ),
  };
}

function buildFakePickupPoints(provider: "ozon" | "cdek" | "russianPost", city: string) {
  const providerLabelMap = {
    ozon: "Ozon",
    cdek: "CDEK",
    russianPost: "Почта России",
  } as const;
  const providerLabel = providerLabelMap[provider];
  const cleanCity = city.trim();
  return [
    {
      id: `${provider}-pvz-1`,
      provider,
      name: `${providerLabel} ПВЗ Центр`,
      address: `${cleanCity}, ул. Центральная, 10`,
      workHours: "10:00–21:00",
      lat: 55.7558,
      lon: 37.6176,
    },
    {
      id: `${provider}-pvz-2`,
      provider,
      name: `${providerLabel} ПВЗ Север`,
      address: `${cleanCity}, пр-т Мира, 25`,
      workHours: "09:00–20:00",
      lat: 55.7902,
      lon: 37.6354,
    },
    {
      id: `${provider}-pvz-3`,
      provider,
      name: `${providerLabel} ПВЗ Юг`,
      address: `${cleanCity}, ул. Южная, 7`,
      workHours: "10:00–20:00",
      lat: 55.6945,
      lon: 37.6202,
    },
  ];
}

let cdekTokenCache: { token: string; expiresAt: number } | null = null;

function asString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function cdekBaseUrl() {
  return (process.env.CDEK_API_BASE || "https://api.cdek.ru/v2").replace(/\/+$/, "");
}

async function cdekAccessToken(clientId: string, clientSecret: string) {
  const now = Date.now();
  if (cdekTokenCache && now < cdekTokenCache.expiresAt) return cdekTokenCache.token;
  const params = new URLSearchParams();
  params.set("grant_type", "client_credentials");
  params.set("client_id", clientId);
  params.set("client_secret", clientSecret);
  const authUrl = `${cdekBaseUrl()}/oauth/token`;
  const response = await fetch(authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`cdek_oauth_failed:${response.status}:${text.slice(0, 300)}`);
  }
  const data = await response.json() as { access_token?: string; expires_in?: number };
  const token = asString(data.access_token);
  if (!token) throw new Error("cdek_oauth_token_missing");
  const expiresIn = asNumber(data.expires_in) || 1800;
  cdekTokenCache = { token, expiresAt: now + Math.max(30, expiresIn - 30) * 1000 };
  return token;
}

function normalizeCdekPickupPoints(items: any[]) {
  const result: Array<{ id: string; provider: "cdek"; name: string; address: string; workHours?: string; lat?: number; lon?: number }> = [];
  const seen = new Set<string>();
  for (const item of items) {
    const id = asString(item?.code || item?.uuid || item?.id);
    if (!id || seen.has(id)) continue;
    const name = asString(item?.name || item?.location?.address_full || item?.location?.address || item?.address);
    const address = asString(item?.location?.address_full || item?.location?.address || item?.address || item?.name);
    if (!address) continue;
    const workHours = asString(item?.work_time || item?.workTime || item?.worktime || item?.schedule);
    const lat = asNumber(item?.location?.latitude || item?.latitude || item?.coordX);
    const lon = asNumber(item?.location?.longitude || item?.longitude || item?.coordY);
    result.push({
      id,
      provider: "cdek",
      name: name || "CDEK ПВЗ",
      address,
      workHours: workHours || undefined,
      lat,
      lon,
    });
    seen.add(id);
  }
  return result;
}

async function fetchCdekPickupPoints(city: string, clientId: string, clientSecret: string) {
  const token = await cdekAccessToken(clientId, clientSecret);
  const endpoint = `${cdekBaseUrl()}/deliverypoints`;
  const attempts = [
    new URLSearchParams({ city, type: "PVZ" }),
    new URLSearchParams({ city_name: city, type: "PVZ" }),
    new URLSearchParams({ city }),
  ];
  for (const query of attempts) {
    const url = `${endpoint}?${query.toString()}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) continue;
    const data = await response.json();
    if (!Array.isArray(data)) continue;
    const normalized = normalizeCdekPickupPoints(data);
    if (normalized.length) return normalized;
  }
  return [];
}

app.get("/api/logistics/status", requireAuth(async (_req, res) => {
  const resolved = await getResolvedIntegrationConfig();
  const stored = await getIntegrationConfig();
  const status = buildIntegrationStatus(resolved);

  res.json({
    ok: true,
    status,
    settings: stored,
    secretsPreview: {
      ozonApiKey: maskSecret(resolved.ozon.apiKey),
      cdekClientId: maskSecret(resolved.cdek.clientId),
      cdekClientSecret: maskSecret(resolved.cdek.clientSecret),
      russianPostApiKey: maskSecret(resolved.russianPost.apiKey),
      russianPostLogin: resolved.russianPost.login || null,
      russianPostPassword: maskSecret(resolved.russianPost.password),
      smtpHost: resolved.smtp.host || null,
      smtpPort: resolved.smtp.port || null,
      smtpUser: resolved.smtp.user || null,
      smtpPass: maskSecret(resolved.smtp.pass),
      smtpFrom: resolved.smtp.from || null,
    },
  });
}));

app.get("/api/integrations/settings", requireAuth(async (_req, res) => {
  const settings = await getIntegrationConfig();
  const resolved = await getResolvedIntegrationConfig();
  res.json({
    ok: true,
    settings,
    resolved,
  });
}));

app.put("/api/integrations/settings", requireAuth(async (req, res) => {
  try {
    const data = IntegrationPatchSchema.parse(req.body || {});
    const next = await saveIntegrationConfig(toIntegrationPatch(data));
    const resolved = await getResolvedIntegrationConfig();
    res.json({ ok: true, settings: next, resolved });
  } catch {
    res.status(400).json({ error: "bad_request" });
  }
}));

app.post("/api/system/test-email", rateLimitMiddleware(10, 15 * 60 * 1000), requireAuth(async (req, res) => {
  try {
    const data = TestMailSchema.parse(req.body || {});
    const resolved = await getResolvedIntegrationConfig();
    const fallbackTo = resolved.smtp.user || resolved.smtp.from;
    const to = data.to || fallbackTo;
    if (!to) return res.status(400).json({ error: "email_required" });
    const subject = data.subject || "Тест письма МираВкус";
    const text = data.text || "SMTP настроен корректно.";
    await sendMail(to, subject, text);
    res.json({ ok: true, to });
  } catch {
    res.status(400).json({ error: "bad_request" });
  }
}));

app.post("/api/integrations/test", rateLimitMiddleware(20, 15 * 60 * 1000), requireAuth(async (req, res) => {
  try {
    const data = IntegrationTestSchema.parse(req.body || {});
    const mode = data.mode || "fake";
    const resolved = await getResolvedIntegrationConfig();
    const status = buildIntegrationStatus(resolved);
    if (data.provider === "smtp") {
      if (mode === "fake") {
        return res.json({ ok: true, provider: "smtp", mode, ready: status.smtp.ready, missing: status.smtp.missing });
      }
      const to = data.to || resolved.smtp.user || resolved.smtp.from;
      if (!to) return res.status(400).json({ error: "email_required" });
      await sendMail(to, "Тест SMTP из админки", "SMTP готов к отправке писем.");
      return res.json({ ok: true, provider: "smtp", mode, to });
    }
    if (data.provider === "pickup") {
      const city = data.city || "Москва";
      const provider: "ozon" | "cdek" | "russianPost" = "ozon";
      return res.json({
        ok: true,
        provider: "pickup",
        mode,
        points: buildFakePickupPoints(provider, city),
        source: mode === "real" ? "stub" : "fake",
      });
    }
    const providerKey = data.provider === "russianPost" ? "russianPost" : data.provider;
    const providerStatusValue = status[providerKey];
    const ready = providerStatusValue.ready;
    if (mode === "real" && !ready) {
      return res.status(400).json({ error: "missing_credentials", missing: providerStatusValue.missing, provider: data.provider });
    }
    if (data.provider === "cdek" && mode === "real") {
      try {
        const points = await fetchCdekPickupPoints(data.city || "Москва", resolved.cdek.clientId!, resolved.cdek.clientSecret!);
        return res.json({
          ok: true,
          provider: data.provider,
          mode,
          ready,
          missing: providerStatusValue.missing,
          pointsCount: points.length,
          source: "real",
        });
      } catch (err) {
        return res.status(502).json({
          error: "cdek_api_failed",
          provider: data.provider,
          detail: err instanceof Error ? err.message : "unknown_error",
        });
      }
    }
    return res.json({
      ok: true,
      provider: data.provider,
      mode,
      ready,
      missing: providerStatusValue.missing,
      source: mode === "real" ? "stub" : "fake",
    });
  } catch {
    res.status(400).json({ error: "bad_request" });
  }
}));

app.get("/api/logistics/pickup-points", async (req, res) => {
  try {
    const query = PickupPointsQuerySchema.parse(req.query || {});
    const provider = query.provider || "ozon";
    const mode = query.mode || "fake";
    const city = query.city || "Москва";
    const resolved = await getResolvedIntegrationConfig();
    const status = buildIntegrationStatus(resolved);
    const providerStatusValue = provider === "russianPost" ? status.russianPost : provider === "cdek" ? status.cdek : status.ozon;
    if (mode === "real" && !providerStatusValue.ready) {
      return res.status(400).json({ error: "missing_credentials", missing: providerStatusValue.missing, provider });
    }
    if (mode === "real" && provider === "cdek") {
      try {
        const points = await fetchCdekPickupPoints(city, resolved.cdek.clientId!, resolved.cdek.clientSecret!);
        return res.json({
          ok: true,
          provider,
          mode,
          source: "real",
          points,
        });
      } catch (err) {
        return res.status(502).json({
          error: "cdek_api_failed",
          provider,
          detail: err instanceof Error ? err.message : "unknown_error",
        });
      }
    }
    return res.json({
      ok: true,
      provider,
      mode,
      source: mode === "real" ? "stub" : "fake",
      points: buildFakePickupPoints(provider, city),
    });
  } catch {
    res.status(400).json({ error: "bad_request" });
  }
});

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
    "update products set name=coalesce($2,name), price=coalesce($3,price), old_price=$4, category=coalesce($5,category), categories=case when $26 then $27::text[] when $5 is not null then array[$5] else categories end, badge=$6, description=coalesce($7,description), sku=coalesce($8,sku), composition_short=coalesce($9,composition_short), shelf_life=coalesce($10,shelf_life), country=coalesce($11,country), composition_set=coalesce($12,composition_set), storage_temperature=coalesce($13,storage_temperature), product_features=coalesce($14,product_features), set_weight=coalesce($15,set_weight), package_dimensions=coalesce($16,package_dimensions), description_long=coalesce($17,description_long), image=coalesce($18,image), images=$19, video_url=coalesce($28,video_url), popularity=coalesce($20,popularity), active=coalesce($21,active), packaging_mode=case when $22 then $23 when $24 and $25::text is null and packaging_mode='standard' then null else packaging_mode end, standard_packaging_id=case when $24 then $25::text else standard_packaging_id end where id=$1",
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

const ReviewCreateSchema = z.object({
  authorName: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1),
  image: z.string().optional(),
});
const ReviewAdminSchema = z.object({
  productId: z.number().int(),
  authorName: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1),
  image: z.string().optional(),
  approved: z.boolean().optional(),
  createdAt: z.string().optional(),
});
const ReviewUpdateSchema = z.object({
  productId: z.number().int().optional(),
  authorName: z.string().min(1).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  text: z.string().min(1).optional(),
  image: z.string().optional().nullable(),
  approved: z.boolean().optional(),
  createdAt: z.string().optional(),
});
const toDate = (value?: string) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

app.get("/api/products/:id/reviews", async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isFinite(productId)) return res.json([]);
  const { rows } = await pool.query(
    "select id,product_id,author_name,rating,text,image,created_at from reviews where product_id=$1 and approved=true order by created_at desc, id desc",
    [productId]
  );
  res.json(rows.map((r: any) => ({
    id: r.id,
    productId: r.product_id,
    authorName: r.author_name,
    rating: r.rating,
    text: r.text,
    image: r.image ?? undefined,
    createdAt: r.created_at,
    approved: true,
  })));
});

app.post("/api/products/:id/reviews", requireCustomerAuth(async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isFinite(productId)) return res.status(400).json({ error: "bad_product" });
  const hdr = req.headers.authorization!;
  const token = hdr.slice(7);
  const payload = await verifyToken(token);
  const phone = payload.phone ? String(payload.phone) : null;
  const email = payload.email ? String(payload.email) : null;
  if (!phone && !email) return res.status(403).json({ error: "not_purchased" });
  const { rows: hasPurchase } = await pool.query(
    `select 1
     from orders o
     join order_items oi on oi.order_id = o.id
     where oi.product_id=$1
       and (( $2::text is not null and o.contact_phone=$2) or ($3::text is not null and o.contact_email=$3))
     limit 1`,
    [productId, phone, email]
  );
  if (!hasPurchase[0]) return res.status(403).json({ error: "not_purchased" });
  const data = ReviewCreateSchema.parse(req.body);
  await pool.query(
    "insert into reviews(product_id,author_name,rating,text,image,approved) values($1,$2,$3,$4,$5,false)",
    [productId, data.authorName, data.rating, data.text, data.image ?? null]
  );
  res.status(201).json({ ok: true });
}));

app.get("/api/reviews", requireAuth(async (_req, res) => {
  const { rows } = await pool.query(
    "select r.id,r.product_id,p.name as product_name,r.author_name,r.rating,r.text,r.image,r.approved,r.created_at from reviews r left join products p on p.id=r.product_id order by r.created_at desc, r.id desc"
  );
  res.json(rows.map((r: any) => ({
    id: r.id,
    productId: r.product_id,
    productName: r.product_name ?? undefined,
    authorName: r.author_name,
    rating: r.rating,
    text: r.text,
    image: r.image ?? undefined,
    approved: r.approved,
    createdAt: r.created_at,
  })));
}));

app.post("/api/reviews", requireAuth(async (req, res) => {
  const data = ReviewAdminSchema.parse(req.body);
  const createdAt = toDate(data.createdAt);
  const approved = data.approved ?? true;
  const { rows } = await pool.query(
    "insert into reviews(product_id,author_name,rating,text,image,approved,created_at) values($1,$2,$3,$4,$5,$6,coalesce($7,now())) returning id",
    [data.productId, data.authorName, data.rating, data.text, data.image ?? null, approved, createdAt]
  );
  res.status(201).json({ id: rows[0].id });
}));

app.put("/api/reviews/:id", requireAuth(async (req, res) => {
  const id = Number(req.params.id);
  const data = ReviewUpdateSchema.parse(req.body);
  const hasCreatedAt = Object.prototype.hasOwnProperty.call(data, "createdAt");
  const hasImage = Object.prototype.hasOwnProperty.call(data, "image");
  const createdAt = hasCreatedAt ? toDate(data.createdAt) : null;
  await pool.query(
    "update reviews set product_id=coalesce($2,product_id), author_name=coalesce($3,author_name), rating=coalesce($4,rating), text=coalesce($5,text), image=case when $6 then $7 else image end, approved=coalesce($8,approved), created_at=case when $9 then $10 else created_at end where id=$1",
    [id, data.productId ?? null, data.authorName ?? null, data.rating ?? null, data.text ?? null, hasImage, data.image ?? null, data.approved ?? null, hasCreatedAt, createdAt]
  );
  res.json({ ok: true });
}));

app.delete("/api/reviews/:id", requireAuth(async (req, res) => {
  await pool.query("delete from reviews where id=$1", [Number(req.params.id)]);
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
const reviewsDir = path.join(uploadsDir, "reviews");
fs.mkdirSync(reviewsDir, { recursive: true });
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

const UploadReviewSchema = z.object({ dataUrl: z.string().min(1) });
app.post("/api/reviews/upload", requireAuth(async (req, res) => {
  try {
    const { dataUrl } = UploadReviewSchema.parse(req.body);
    const m = /^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/.exec(dataUrl);
    if (!m) return res.status(400).json({ error: "bad_image" });
    const mime = m[1];
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    const buf = Buffer.from(m[3], "base64");
    if (buf.length > 5 * 1024 * 1024) return res.status(400).json({ error: "too_large" });
    const name = `review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = path.join(reviewsDir, name);
    fs.writeFileSync(filePath, buf);
    const url = `/uploads/reviews/${name}`;
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

app.get("/api/hero-text", async (_req, res) => {
  const { rows } = await pool.query("select data from hero_text_settings where id=1");
  if (!rows[0]) return res.json(defaultHeroText);
  const data = rows[0].data || defaultHeroText;
  res.json({ ...defaultHeroText, ...data });
});

app.put("/api/hero-text", requireAuth(async (req, res) => {
  const data = HeroTextSchema.parse(req.body);
  await pool.query(
    "insert into hero_text_settings(id,data) values(1,$1) on conflict (id) do update set data=excluded.data",
    [data]
  );
  res.json({ ok: true });
}));

app.get("/api/feature-blocks", async (_req, res) => {
  const { rows } = await pool.query("select data from feature_blocks_settings where id=1");
  if (!rows[0]) return res.json(defaultFeatureBlocks);
  const data = rows[0].data;
  if (!Array.isArray(data)) return res.json(defaultFeatureBlocks);
  res.json(data);
});

app.put("/api/feature-blocks", requireAuth(async (req, res) => {
  const data = FeatureBlocksSchema.parse(req.body);
  await pool.query(
    "insert into feature_blocks_settings(id,data) values(1,$1) on conflict (id) do update set data=excluded.data",
    [data]
  );
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

app.get("/api/about", async (_req, res) => {
  const { rows } = await pool.query("select data from about_settings where id=1");
  if (!rows[0]) return res.json(defaultAbout);
  const data = rows[0].data || defaultAbout;
  res.json({ ...defaultAbout, ...data });
});

app.put("/api/about", requireAuth(async (req, res) => {
  const data = AboutSchema.parse(req.body);
  await pool.query(
    "insert into about_settings(id,data) values(1,$1) on conflict (id) do update set data=excluded.data",
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
  contact: z.object({ name: z.string(), phone: z.string(), email: z.string().email().optional() }),
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
      "insert into orders(total,discount,promo,contact_name,contact_phone,contact_email,delivery_address,delivery_method,payment_method,status) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id",
      [
        o.total,
        o.discount,
        o.promo ?? null,
        o.contact.name,
        o.contact.phone,
        o.contact.email ?? null,
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
      o.contact_email,
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
    contact: { name: r.contact_name, phone: r.contact_phone, email: r.contact_email ?? undefined },
    delivery: { address: r.delivery_address, method: r.delivery_method, payment: r.payment_method },
    createdAt: r.created_at,
    status: r.status,
    deliveryStatus: r.delivery_status ?? undefined,
    deliveryProvider: r.delivery_provider ?? undefined,
    trackingNumber: r.tracking_number ?? undefined,
    items: r.items ?? [],
  })));
}));

app.get("/api/customer/orders", requireCustomerAuth(async (req, res) => {
  const hdr = req.headers.authorization!;
  const token = hdr.slice(7);
  const payload = await verifyToken(token);
  const phone = payload.phone ? String(payload.phone) : null;
  const email = payload.email ? String(payload.email) : null;
  if (!phone && !email) return res.json([]);
  const { rows } = await pool.query(
    `select
      o.id,
      o.total,
      o.discount,
      o.promo,
      o.contact_name,
      o.contact_phone,
      o.contact_email,
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
    where ($1::text is not null and o.contact_phone = $1) or ($2::text is not null and o.contact_email = $2)
    group by o.id
    order by o.id desc`,
    [phone, email]
  );
  res.json(rows.map((r: any) => ({
    id: r.id,
    total: r.total,
    discount: r.discount,
    promo: r.promo ?? undefined,
    contact: { name: r.contact_name, phone: r.contact_phone, email: r.contact_email ?? undefined },
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

app.post("/api/customer/change-password", rateLimitMiddleware(10, 15 * 60 * 1000), requireCustomerAuth(async (req, res) => {
  try {
    const data = ChangePasswordSchema.parse(req.body);
    const hdr = req.headers.authorization!;
    const token = hdr.slice(7);
    const payload = await verifyToken(token);
    const id = Number(payload.sub);
    const { rows } = await pool.query(`select id,password_hash from customers where id=$1`, [id]);
    const customer = rows[0];
    if (!customer || !customer.password_hash) return res.status(401).json({ error: "unauthorized" });
    const ok = await bcrypt.compare(data.currentPassword, customer.password_hash);
    if (!ok) return res.status(400).json({ error: "invalid_password" });
    const hash = await bcrypt.hash(data.newPassword, 10);
    await pool.query(`update customers set password_hash=$2 where id=$1`, [customer.id, hash]);
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
  await ensureTestCustomerExists();
  const port = Number(process.env.PORT || 3001);
  app.listen(port, "0.0.0.0", () => {
    console.log(`server on ${port}`);
  });
}

start();
