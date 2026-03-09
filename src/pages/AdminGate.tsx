import { useEffect, useState } from "react";
import Admin from "./Admin";
import LoginForm from "@/components/LoginForm";
import { clearToken, getToken } from "@/lib/auth";
import { api } from "@/lib/api";

export default function AdminGate() {
  const [authed, setAuthed] = useState<boolean>(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const token = getToken();
      if (!token) {
        if (!active) return;
        setAuthed(false);
        setChecked(true);
        return;
      }
      try {
        await api.getOrders();
        if (!active) return;
        setAuthed(true);
        setChecked(true);
      } catch (err) {
        const code = err instanceof Error ? err.message : "";
        if (code === "401" || code === "403") {
          clearToken();
          if (!active) return;
          setAuthed(false);
          setChecked(true);
          return;
        }
        if (!active) return;
        setAuthed(true);
        setChecked(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!checked) return null;
  if (!authed) return <LoginForm onSuccess={() => setAuthed(true)} />;
  return <Admin />;
}
