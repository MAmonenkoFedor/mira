import { useState } from "react";
import { login } from "@/lib/auth";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const ok = await login(email, password);
    setLoading(false);
    if (ok) onSuccess();
    else setError("Неверный e‑mail или пароль");
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.requestPasswordReset(email);
      setInfo("Если такой e‑mail найден, письмо отправлено");
    } catch {
      setInfo("Если такой e‑mail найден, письмо отправлено");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm p-6 rounded-2xl border bg-card">
        <h1 className="font-display text-2xl font-bold mb-6 text-center">Вход в админку</h1>
        {!resetMode ? (
          <form onSubmit={submit} className="space-y-3">
            <Input type="email" placeholder="E‑mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <div className="text-sm text-red-600">{error}</div>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Входим..." : "Войти"}
            </Button>
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground underline" onClick={() => { setResetMode(true); setError(null); }}>
              Забыли пароль?
            </button>
          </form>
        ) : (
          <form onSubmit={reset} className="space-y-3">
            <Input type="email" placeholder="E‑mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
            {info && <div className="text-sm text-green-600">{info}</div>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Отправляем..." : "Отправить письмо для сброса"}
            </Button>
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground underline" onClick={() => { setResetMode(false); setInfo(null); }}>
              Вернуться ко входу
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
