import { getCustomerToken, getToken } from "./auth";

function resolveBase(): string {
  const envBase = (import.meta as any).env?.VITE_API_URL || "";
  if (typeof window !== "undefined") {
    const { hostname, port } = window.location;
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
    const isDevPort = ["8080", "8081", "8082", "5173"].includes(port);
    // В дев-окружении ходим напрямую на бекенд (3001), чтобы обойти сбои прокси
    if (isLocalHost && isDevPort) return "http://localhost:3001";
    if (!envBase) {
      return "";
    }
    try {
      const u = new URL(envBase);
      const envLocalhost = (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]") &&
        ["8080", "8081", "8082", "5173"].includes(u.port);
      if (envLocalhost) return "http://localhost:3001";
    } catch {}
  }
  return envBase;
}
const base = resolveBase();

export function resolveMediaUrl(url?: string | null) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  if (url.startsWith("/uploads/")) return base ? `${base}${url}` : url;
  return url;
}

async function j<T>(res: Response | Promise<Response>): Promise<T> {
  const r = await res;
  if (!r.ok) throw new Error(String(r.status));
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
  async getOrders() {
    return j(fetch(`${base}/api/orders`, withAuth()));
  },
  async getFooter() {
    return j(fetch(`${base}/api/footer`));
  },
  async updateFooter(p: any) {
    return j(fetch(`${base}/api/footer`, withAuth({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })));
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
  async deleteProduct(id: number) {
    return j(fetch(`${base}/api/products/${id}`, withAuth({ method: "DELETE" })));
  },
  async getCategories() {
    return j(fetch(`${base}/api/categories`));
  },
  async addCategory(c: any) {
    return j(fetch(`${base}/api/categories`, withAuth({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) })));
  },
  async updateCategory(id: string, c: any) {
    return j(fetch(`${base}/api/categories/${encodeURIComponent(id)}`, withAuth({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) })));
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
};
