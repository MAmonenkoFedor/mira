import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/candy-store/Header';
import Footer from '@/components/candy-store/Footer';
import { useCart } from '@/components/candy-store/useCart';
import { useStore } from '@/components/candy-store/useStore';
import { resolveMediaUrl } from '@/lib/api';

export default function About() {
  const cart = useCart();
  const store = useStore();
  const navigate = useNavigate();
  const about = store.about;
  const images = useMemo(() => {
    return about.images && about.images.length ? about.images : ['/images/hero-sweets.jpg'];
  }, [about.images]);
  const paragraphs = useMemo(() => {
    const raw = (about.content || '').trim();
    if (!raw) return [];
    return raw.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  }, [about.content]);

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
    const toAbs = (url: string) => {
      if (url.startsWith('http') || url.startsWith('data:')) return url;
      return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
    };
    const title = `${about.title || 'О нас'} — МираВкус`;
    const baseDescription = (about.subtitle || about.content || '').trim();
    const description = baseDescription ? baseDescription.slice(0, 160) : 'О магазине сладостей МираВкус.';
    const url = `${window.location.origin}/about`;
    const image = toAbs(resolveMediaUrl(images[0]));
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', 'index, follow');
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:site_name', 'МираВкус');
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:image:alt', about.title || 'О нас');
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);
    setLink('canonical', url);
  }, [about.title, about.subtitle, about.content, images]);

  const [first, ...rest] = images;

  return (
    <div className="min-h-screen bg-background">
      <Header cartCount={cart.count} onCartClick={() => navigate('/cart')} />

      <main className="container py-10 md:py-16">
        <section className="grid lg:grid-cols-2 gap-10 items-start">
          <div className="space-y-5">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              О нас
            </div>
            <div className="space-y-3">
              <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">
                {about.title}
              </h1>
              <p className="text-muted-foreground text-base md:text-lg">
                {about.subtitle}
              </p>
            </div>
            <div className="space-y-3 text-sm md:text-base text-muted-foreground leading-relaxed">
              {paragraphs.map((p, idx) => (
                <p key={`${idx}-${p.slice(0, 8)}`}>{p}</p>
              ))}
              {!paragraphs.length && (
                <p>Скоро здесь появится история бренда и наши ценности.</p>
              )}
            </div>
          </div>

          <div className="grid gap-4">
            {first && (
              <div className="rounded-3xl overflow-hidden border border-border/50 bg-card shadow-sm">
                <img src={resolveMediaUrl(first)} alt="" className="w-full h-full object-cover max-h-[380px]" />
              </div>
            )}
            {rest.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {rest.map((img, idx) => (
                  <div key={`${idx}-${img}`} className="rounded-3xl overflow-hidden border border-border/50 bg-card shadow-sm">
                    <img src={resolveMediaUrl(img)} alt="" className="w-full h-full object-cover max-h-[180px]" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
