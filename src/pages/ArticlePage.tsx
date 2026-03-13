import { useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Tag } from 'lucide-react';
import { useStore } from '@/components/candy-store/useStore';
import Header from '@/components/candy-store/Header';
import Footer from '@/components/candy-store/Footer';
import CartDrawer from '@/components/candy-store/CartDrawer';
import Checkout from '@/components/candy-store/Checkout';
import { useCart } from '@/components/candy-store/useCart';
import { toast } from 'sonner';
import { resolveMediaUrl } from '@/lib/api';
import { badgeToneSoftClasses } from '@/components/candy-store/data';

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const { articles, products, badges } = useStore() as any;
  const cart = useCart();
  const nav = useNavigate();
  const article = articles.find(a => a.slug === slug);
  const linked = article?.productId ? products.find((p: any) => p.id === article.productId && (p.active ?? true)) : null;
  const linkedBadge = useMemo(() => linked ? badges.find((b: any) => b.id === linked.badge && b.active) : null, [badges, linked]);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [slug]);
  useEffect(() => {
    if (!article) return;
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
    const setJsonLd = (id: string, data: unknown) => {
      let el = document.getElementById(id) as HTMLScriptElement | null;
      if (!el) {
        el = document.createElement('script');
        el.type = 'application/ld+json';
        el.id = id;
        document.head.appendChild(el);
      }
      el.textContent = JSON.stringify(data);
    };
    const toAbs = (url: string) => {
      if (url.startsWith('http') || url.startsWith('data:')) return url;
      return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
    };
    const title = `${article.title} — МираВкус`;
    const baseDescription = (article.excerpt || article.content || '').trim();
    const description = baseDescription ? baseDescription.slice(0, 160) : 'Статья о сладостях, подарочных наборах и новинках магазина.';
    const url = `${window.location.origin}/articles/${article.slug}`;
    const image = article.image ? toAbs(article.image) : `${window.location.origin}/images/hero-sweets.jpg`;
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', 'index, follow');
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', 'article');
    setMeta('property', 'og:site_name', 'МираВкус');
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:image:alt', article.title);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);
    setLink('canonical', url);
    setJsonLd('ld-json-article', {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Article',
          headline: article.title,
          description,
          image: [image],
          mainEntityOfPage: url,
          author: { '@type': 'Organization', name: 'МираВкус' },
          publisher: { '@type': 'Organization', name: 'МираВкус' },
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Главная',
              item: `${window.location.origin}/`,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: article.title,
              item: url,
            },
          ],
        },
      ],
    });
  }, [article]);

  if (!article) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center px-4">
        <h1 className="font-display text-3xl font-bold text-foreground mb-3">Статья не найдена</h1>
        <p className="text-muted-foreground mb-6">Возможно, она была удалена или перемещена.</p>
        <Link to="/#articles" className="text-primary font-medium hover:underline">← Вернуться к статьям</Link>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background">
        <Header cartCount={cart.count} onCartClick={() => cart.setIsCartOpen(true)} />

        <main className="container max-w-2xl py-10 md:py-16">
          {/* Meta */}
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary">
              <Tag size={12} /> {article.tag}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock size={12} /> {article.readTime}
            </span>
          </div>

          {/* Title */}
          <h1 className="font-display text-2xl md:text-4xl font-bold text-foreground leading-tight mb-6">
            {article.title}
          </h1>

          {/* Hero image */}
          {article.image && (
            <div className="rounded-2xl overflow-hidden mb-8 border border-border/40">
              <img src={resolveMediaUrl(article.image)} alt={article.title} className="w-full h-auto object-cover max-h-[400px]" />
            </div>
          )}

          {/* Body */}
          <ArticleContent text={article.content || article.excerpt} />

          {linked && (
            <div className="mt-8">
              <div className="flex items-start gap-4 p-4 rounded-2xl border border-border/50 bg-card">
                <img src={resolveMediaUrl(linked.image)} alt={linked.name} className="w-24 h-24 rounded-xl object-cover bg-muted border border-border/40" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-semibold">{linked.name}</span>
                    {linkedBadge && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badgeToneSoftClasses[linkedBadge.tone]}`}>
                        {linkedBadge.label}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">{linked.description}</div>
                  <div className="mt-2 font-display font-bold text-primary">{linked.price} ₽</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => { cart.addItem(linked, 1); cart.setIsCartOpen(true); toast.success('Добавлено!', { description: linked.name }); }}
                      className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
                      Заказать: {linked.name}
                    </button>
                    <Link
                      to={`/product/${linked.id}`}
                      className="px-4 py-2 rounded-xl border border-border text-sm"
                    >
                      Открыть страницу товара
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Back link */}
          <div className="mt-12 pt-6 border-t border-border/40">
            <Link to="/#articles" className="text-sm font-medium text-primary hover:underline">
              ← Все статьи
            </Link>
          </div>
        </main>
        <Footer />
        <CartDrawer
          open={cart.isCartOpen}
          onClose={() => cart.setIsCartOpen(false)}
          items={cart.items}
          subtotal={cart.subtotal}
          discount={cart.discount}
          total={cart.total}
          promoCode={cart.promoCode}
          onUpdateQty={cart.updateQuantity}
          onUpdatePackaging={cart.updatePackaging}
          onRemove={cart.removeItem}
          onApplyPromo={cart.applyPromo}
          onCheckout={() => { cart.setIsCartOpen(false); cart.setIsCheckoutOpen(true); }}
        />
        <Checkout
          open={cart.isCheckoutOpen}
          onClose={() => cart.setIsCheckoutOpen(false)}
          total={cart.total}
          onPlaceOrder={cart.placeOrder}
        />
      </div>
    </>
  );
}

/* Simple markdown-like renderer for article content */
function ArticleContent({ text }: { text: string }) {
  const blocks = useMemo(() => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ')) return <h2 key={i} className="font-display text-xl font-bold text-foreground mt-8 mb-3">{line.slice(3)}</h2>;
      if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold text-foreground mt-4 mb-1">{line.slice(2, -2)}</p>;
      if (line.startsWith('- ')) return <li key={i} className="text-foreground/85 ml-4 list-disc">{renderBold(line.slice(2))}</li>;
      if (/^\d+\.\s/.test(line)) return <li key={i} className="text-foreground/85 ml-4 list-decimal">{renderBold(line.replace(/^\d+\.\s/, ''))}</li>;
      if (line.trim() === '') return <div key={i} className="h-3" />;
      return <p key={i} className="text-foreground/85 leading-relaxed">{renderBold(line)}</p>;
    });
  }, [text]);

  return <div className="space-y-1">{blocks}</div>;
}

function renderBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="font-semibold text-foreground">{part}</strong> : part);
}
