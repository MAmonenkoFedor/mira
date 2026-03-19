const KEY = "auth_token";
const CUSTOMER_KEY = "customer_token";

function resolveBase(): string {
  const envBase = (import.meta as any).env?.VITE_API_URL || "";
  if (typeof window !== "undefined") {
    const { hostname, port } = window.location;
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
    const isDevPort = ["8080", "8081", "8082", "5173"].includes(port);
    if (envBase) return envBase;
    if (isLocalHost && isDevPort) return "http://localhost:3001";
    if (!envBase) return "";
  }
  return envBase;
}
const base = resolveBase();

export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY);
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

export function getCustomerToken(): string | null {
  try {
    return localStorage.getItem(CUSTOMER_KEY);
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
