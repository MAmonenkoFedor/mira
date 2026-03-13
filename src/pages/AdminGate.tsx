import { useEffect, useState } from "react";
import Admin from "./Admin";
import LoginForm from "@/components/LoginForm";
import { clearToken, getToken } from "@/lib/auth";
import { api } from "@/lib/api";

export default function AdminGate() {
  const [authed, setAuthed] = useState<boolean>(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const setMeta = (attr: 'name' | 'property', key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.content = content;
    };
    const setLink = (rel: string, href: string) => {
      let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!el) {
        el = document.createElement('link');
        el.rel = rel;
        document.head.appendChild(el);
      }
      el.href = href;
    };
    const title = 'Админ-панель — МираВкус';
    const description = 'Вход в административную панель магазина.';
    const url = `${window.location.origin}/admin`;
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', 'noindex, nofollow');
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:url', url);
    setLink('canonical', url);
  }, []);

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
