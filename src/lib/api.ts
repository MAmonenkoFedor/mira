import { getCustomerToken, getToken } from "./auth";

function resolveBase(): string {
  const envBase = (import.meta as any).env?.VITE_API_URL || "";
  if (typeof window !== "undefined") {
    const { hostname, port } = window.location;
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
    const isDevPort = ["8080", "8081", "8082", "5173"].includes(port);
    if (envBase) return envBase;
    // В дев-окружении ходим напрямую на бекенд (3001), чтобы обойти сбои прокси
    if (isLocalHost && isDevPort) return "http://localhost:3001";
    if (!envBase) return "";
  }
  return envBase;
}
const base = resolveBase();

function buildLocalPickupPoints(provider: "ozon" | "cdek" | "russianPost", city?: string) {
  const providerLabelMap = {
    ozon: "Ozon",
    cdek: "CDEK",
    russianPost: "Почта России",
  } as const;
  const providerLabel = providerLabelMap[provider];
  const cleanCity = (city || "Москва").trim() || "Москва";
  return [
    { id: `${provider}-pvz-1`, provider, name: `${providerLabel} ПВЗ Центр`, address: `${cleanCity}, ул. Центральная, 10`, workHours: "10:00–21:00" },
    { id: `${provider}-pvz-2`, provider, name: `${providerLabel} ПВЗ Север`, address: `${cleanCity}, пр-т Мира, 25`, workHours: "09:00–20:00" },
    { id: `${provider}-pvz-3`, provider, name: `${providerLabel} ПВЗ Юг`, address: `${cleanCity}, ул. Южная, 7`, workHours: "10:00–20:00" },
  ];
}

export function resolveMediaUrl(url?: string | null) {
  if (!url) return "";
  const normalized = String(url).trim().replace(/\\/g, "/");
  if (!normalized) return "";
  if (normalized.startsWith("http://") || normalized.startsWith("https://") || normalized.startsWith("data:")) return normalized;
  const withLeadingSlash = normalized.startsWith("/") ? normalized : `/${normalized}`;
  if (withLeadingSlash.startsWith("/uploads/")) return base ? `${base}${withLeadingSlash}` : withLeadingSlash;
  if (withLeadingSlash.startsWith("/images/")) return withLeadingSlash;
  return withLeadingSlash;
}

async function j<T>(res: Response | Promise<Response>): Promise<T> {
  const r = await res;
  if (!r.ok) {
    let detail = "";
    try {
      const contentType = r.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await r.clone().json() as Record<string, unknown>;
        const rawDetail = data.message || data.error || data.detail;
        if (typeof rawDetail === "string") detail = rawDetail.trim();
      } else {
        const text = (await r.clone().text()).trim();
        if (text && text.length <= 300) detail = text;
      }
    } catch {
      detail = "";
    }
    throw new Error(detail ? `${r.status}|${detail}` : String(r.status));
  }
  return r.json();
}

function withAuth(init?: RequestInit): RequestInit {
  const t = getToken();
  const headers = new Headers(init?.headers || {});
  if (t) headers.set("Authorization", `Bearer ${t}`);
  return { ...init, headers };
}

function withCustomerAuth(init?: RequestInit): RequestInit {
  const t = getCustomerToken();
  const headers = new Headers(init?.headers || {});
  if (t) headers.set("Authorization", `Bearer ${t}`);
  return { ...init, headers };
}

export const api = {
  async getProducts() {
    return j(fetch(`${base}/api/products`));
  },
  async getPackagingOptions() {
    return j(fetch(`${base}/api/packaging`));
  },
  async addPackagingOption(p: any) {
    return j(fetch(`${base}/api/packaging`, withAuth({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })));
  },
  async updatePackagingOption(id: string, p: any) {
    return j(fetch(`${base}/api/packaging/${id}`, withAuth({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })));
  },
  async deletePackagingOption(id: string) {
    return j(fetch(`${base}/api/packaging/${id}`, withAuth({ method: "DELETE" })));
  },
  async getHeroImages() {
    return j(fetch(`${base}/api/hero-images`));
  },
  async addHeroImage(p: any) {
    return j(fetch(`${base}/api/hero-images`, withAuth({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })));
  },
  async updateHeroImage(id: number, p: any) {
    return j(fetch(`${base}/api/hero-images/${id}`, withAuth({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })));
  },
  async deleteHeroImage(id: number) {
    return j(fetch(`${base}/api/hero-images/${id}`, withAuth({ method: "DELETE" })));
  },
  async uploadHeroImage(dataUrl: string) {
    return j(fetch(`${base}/api/hero-images/upload`, withAuth({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }) })));
  },
  async getHeroText() {
    return j(fetch(`${base}/api/hero-text`));
  },
  async updateHeroText(p: any) {
    return j(fetch(`${base}/api/hero-text`, withAuth({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })));
  },
  async getFeatureBlocks() {
    return j(fetch(`${base}/api/feature-blocks`));
  },
  async updateFeatureBlocks(p: any) {
    return j(fetch(`${base}/api/feature-blocks`, withAuth({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })));
  },
  async getPromoBanners() {
    return j(fetch(`${base}/api/promo-banners`));
  },
  async addPromoBanner(p: any) {
    return j(fetch(`${base}/api/promo-banners`, withAuth({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })));
  },
  async updatePromoBanner(id: number, p: any) {
    return j(fetch(`${base}/api/promo-banners/${id}`, withAuth({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })));
  },
  async deletePromoBanner(id: number) {
    return j(fetch(`${base}/api/promo-banners/${id}`, withAuth({ method: "DELETE" })));
  },
  async uploadPromoBanner(dataUrl: string) {
    return j(fetch(`${base}/api/promo-banners/upload`, withAuth({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }) })));
  },
  async getPromos() {
    return j(fetch(`${base}/api/promos`));
  },
  async getLogisticsStatus() {
    return j(fetch(`${base}/api/logistics/status`, withAuth()));
  },
  async getIntegrationSettings() {
    return j(fetch(`${base}/api/integrations/settings`, withAuth()));
  },
  async updateIntegrationSettings(p: any) {
    return j(fetch(`${base}/api/integrations/settings`, withAuth({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })));
  },
  async testIntegration(p: any) {
    return j(fetch(`${base}/api/integrations/test`, withAuth({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })));
  },
  async testEmail(p: any) {
    return j(fetch(`${base}/api/system/test-email`, withAuth({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })));
  },
  async getPickupPoints(params: { provider?: "ozon" | "cdek" | "russianPost"; city?: string; mode?: "fake" | "real" }) {
    const search = new URLSearchParams();
    if (params.provider) search.set("provider", params.provider);
    if (params.city) search.set("city", params.city);
    if (params.mode) search.set("mode", params.mode);
    const query = search.toString();
    const provider = params.provider || "ozon";
    const city = params.city || "Москва";
    const mode = params.mode || "fake";
    if (mode === "fake") {
      return {
        ok: true,
        provider,
        mode: "fake",
        source: "frontend_fallback",
        points: buildLocalPickupPoints(provider, city),
      };
    }
    const path = `/api/logistics/pickup-points${query ? `?${query}` : ""}`;
    const primaryUrl = `${base}${path}`;
    try {
      return await j(fetch(path));
    } catch {
      return await j(fetch(primaryUrl));
    }
  },
  async getOrders() {
    return j(fetch(`${base}/api/orders`, withAuth()));
  },
  async getFooter() {
    return j(fetch(`${base}/api/footer`));
  },
  async updateFooter(p: any) {
    return j(fetch(`${base}/api/footer`, withAuth({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })));
  },
  async getHeader() {
    return j(fetch(`${base}/api/header`));
  },
  async updateHeader(p: any) {
    return j(fetch(`${base}/api/header`, withAuth({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })));
  },
  async getAbout() {
    return j(fetch(`${base}/api/about`));
  },
  async updateAbout(p: any) {
    return j(fetch(`${base}/api/about`, withAuth({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })));
  },
  async updateOrder(id: number, p: any) {
    return j(fetch(`${base}/api/orders/${id}`, withAuth({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })));
  },
  async addPromo(p: any) {
    return j(fetch(`${base}/api/promos`, withAuth({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })));
  },
  async updatePromo(id: number, p: any) {
    return j(fetch(`${base}/api/promos/${id}`, withAuth({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })));
  },
  async deletePromo(id: number) {
    return j(fetch(`${base}/api/promos/${id}`, withAuth({ method: "DELETE" })));
  },
  async addProduct(p: any) {
    return j(fetch(`${base}/api/products`, withAuth({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })));
  },
  async updateProduct(id: number, p: any) {
    return j(fetch(`${base}/api/products/${id}`, withAuth({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })));
  },
  async uploadProductImage(dataUrl: string) {
    return j(fetch(`${base}/api/products/upload`, withAuth({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }) })));
  },
  async uploadProductVideo(dataUrl: string) {
    return j(fetch(`${base}/api/products/upload-video`, withAuth({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }) })));
  },
  async uploadArticleImage(dataUrl: string) {
    return j(fetch(`${base}/api/articles/upload`, withAuth({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }) })));
  },
  async uploadArticleVideo(dataUrl: string) {
    return j(fetch(`${base}/api/articles/upload-video`, withAuth({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }) })));
  },
  async uploadReviewImage(dataUrl: string) {
    return j(fetch(`${base}/api/reviews/upload`, withAuth({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }) })));
  },
  async deleteProduct(id: number) {
    return j(fetch(`${base}/api/products/${id}`, withAuth({ method: "DELETE" })));
  },
  async getProductReviews(productId: number) {
    return j(fetch(`${base}/api/products/${productId}/reviews`));
  },
  async addProductReview(productId: number, data: any) {
    return j(fetch(`${base}/api/products/${productId}/reviews`, withCustomerAuth({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })));
  },
  async getCategories() {
    return j(fetch(`${base}/api/categories`));
  },
  async addCategory(c: any) {
    return j(fetch(`${base}/api/categories`, withAuth({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) })));
  },
  async updateCategory(id: string, c: any) {
    try {
      return await j(fetch(`${base}/api/categories/${encodeURIComponent(id)}`, withAuth({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) })));
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const status = Number(String(message).split("|")[0]);
      if (status !== 404 && status !== 502) throw err;
      return j(fetch(`${base}/api/categories`, withAuth({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...c }) })));
    }
  },
  async deleteCategory(id: string) {
    return j(fetch(`${base}/api/categories/${encodeURIComponent(id)}`, withAuth({ method: "DELETE" })));
  },
  async getArticles() {
    return j(fetch(`${base}/api/articles`));
  },
  async getArticle(slug: string) {
    return j(fetch(`${base}/api/articles/${slug}`));
  },
  async addArticle(a: any) {
    return j(fetch(`${base}/api/articles`, withAuth({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) })));
  },
  async updateArticle(id: number, a: any) {
    return j(fetch(`${base}/api/articles/${id}`, withAuth({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) })));
  },
  async deleteArticle(id: number) {
    return j(fetch(`${base}/api/articles/${id}`, withAuth({ method: "DELETE" })));
  },
  async createOrder(o: any) {
    return j(fetch(`${base}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) }));
  },
  async requestCustomerPassword(data: { phone?: string; email?: string }) {
    return j(fetch(`${base}/api/customer/request-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }));
  },
  async getCustomerOrders() {
    return j(fetch(`${base}/api/customer/orders`, withCustomerAuth()));
  },
  async changeCustomerPassword(currentPassword: string, newPassword: string) {
    return j(fetch(`${base}/api/customer/change-password`, withCustomerAuth({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) })));
  },
  async changePassword(currentPassword: string, newPassword: string) {
    return j(fetch(`${base}/api/auth/change-password`, withAuth({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) })));
  },
  async requestPasswordReset(email: string) {
    return j(fetch(`${base}/api/auth/request-reset`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }));
  },
  async resetPassword(email: string, token: string, password: string) {
    return j(fetch(`${base}/api/auth/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, token, password }) }));
  },
  async getReviews() {
    return j(fetch(`${base}/api/reviews`, withAuth()));
  },
  async addReview(data: any) {
    return j(fetch(`${base}/api/reviews`, withAuth({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })));
  },
  async updateReview(id: number, data: any) {
    return j(fetch(`${base}/api/reviews/${id}`, withAuth({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })));
  },
  async deleteReview(id: number) {
    return j(fetch(`${base}/api/reviews/${id}`, withAuth({ method: "DELETE" })));
  },
};
