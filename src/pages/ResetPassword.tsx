import { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export default function ResetPasswordPage() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const token = sp.get("token") || "";
  const emailParam = sp.get("email") || "";
  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!token) setError("Недействительная ссылка");
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError("Минимум 6 символов"); return; }
    if (password !== confirm) { setError("Пароли не совпадают"); return; }
    try {
      await api.resetPassword(email, token, password);
      setOk(true);
      setTimeout(() => nav("/admin"), 1200);
    } catch {
      setError("Ссылка недействительна или истекла");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm p-6 rounded-2xl border bg-card">
        <h1 className="font-display text-2xl font-bold mb-4 text-center">Сброс пароля</h1>
        {!ok ? (
          <form onSubmit={submit} className="space-y-3">
            <Input type="email" placeholder="E‑mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Новый пароль" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Input type="password" placeholder="Подтверждение" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            {error && <div className="text-sm text-red-600">{error}</div>}
            <Button type="submit" className="w-full">Сменить пароль</Button>
            <div className="text-xs text-muted-foreground text-center">
              <Link to="/admin" className="hover:underline">Вернуться ко входу</Link>
            </div>
          </form>
        ) : (
          <div className="text-center text-green-600">Пароль обновлён</div>
        )}
      </div>
    </div>
  );
}
