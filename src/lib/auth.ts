const KEY = "auth_token";

function resolveBase(): string {
  const envBase = (import.meta as any).env?.VITE_API_URL || "";
  if (typeof window !== "undefined") {
    const { hostname, port } = window.location;
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
    const isDevPort = ["8080", "8081", "8082", "5173"].includes(port);
    if (isLocalHost && isDevPort) return "http://localhost:3001";
    if (!envBase) return "";
    try {
      const u = new URL(envBase);
      const envLocalhost =
        (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]") &&
        ["8080", "8081", "8082", "5173"].includes(u.port);
      if (envLocalhost) return "http://localhost:3001";
    } catch {}
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
