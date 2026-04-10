const KEY = "auth_token";
const CUSTOMER_KEY = "customer_token";

function resolveBase(): string {
  const envBase = (import.meta as any).env?.VITE_API_URL || "";
  if (envBase) return envBase;
  return "";
}
const base = resolveBase();

function normalizeToken(raw: string | null): string | null {
  const token = (raw || "").trim();
  if (!token || token === "null" || token === "undefined") return null;
  return token;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    const payload = JSON.parse(json);
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  try {
    return normalizeToken(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function setToken(t: string) {
  try {
    localStorage.setItem(KEY, t);
  } catch {}
}

export function clearToken() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function getTokenExpirationMs(): number | null {
  const token = getToken();
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  const exp = typeof payload?.exp === "number" ? payload.exp : null;
  if (!exp) return null;
  return exp * 1000;
}

export function getCustomerToken(): string | null {
  try {
    return normalizeToken(localStorage.getItem(CUSTOMER_KEY));
  } catch {
    return null;
  }
}

export function setCustomerToken(t: string) {
  try {
    localStorage.setItem(CUSTOMER_KEY, t);
  } catch {}
}

export function clearCustomerToken() {
  try {
    localStorage.removeItem(CUSTOMER_KEY);
  } catch {}
}

export async function login(email: string, password: string): Promise<boolean> {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  if (data?.token) {
    setToken(data.token);
    return true;
  }
  return false;
}

export async function loginCustomer(login: string, password: string): Promise<boolean> {
  const res = await fetch(`${base}/api/customer/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, password }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  if (data?.token) {
    setCustomerToken(data.token);
    return true;
  }
  return false;
}
