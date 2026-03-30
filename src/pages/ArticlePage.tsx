import { useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Clock, Tag } from 'lucide-react';
import { useStore } from '@/components/candy-store/useStore';
import Header from '@/components/candy-store/Header';
import Footer from '@/components/candy-store/Footer';
import { useCart } from '@/components/candy-store/useCart';
import { toast } from 'sonner';
import { resolveMediaUrl } from '@/lib/api';
import { badgeToneSoftClasses, getProductBadgeIds } from '@/components/candy-store/data';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const { articles, products, badges, categories } = useStore() as any;
  const cart = useCart();
  const navigate = useNavigate();
  const article = articles.find(a => a.slug === slug);
  const linked = article?.productId ? products.find((p: any) => p.id === article.productId && (p.active ?? true)) : null;
  const linkedCategory = article?.categoryId ? categories.find((c: any) => c.id === article.categoryId) : null;
  const linkedBadges = useMemo(() => {
    if (!linked) return [];
    return getProductBadgeIds(linked)
      .map(id => badges.find((b: any) => b.id === id && b.active))
      .filter(Boolean);
  }, [badges, linked]);
  const slides = useMemo(() => {
    if (!article) return [];
    const list = article.images && article.images.length ? article.images : (article.image ? [article.image] : []);
    const imageUrls = list.map((u: string) => resolveMediaUrl(u));
    const videoUrl = article.videoUrl ? resolveMediaUrl(article.videoUrl) : '';
    if (videoUrl) {
      return [{ type: 'video' as const, url: videoUrl }, ...imageUrls.map((url) => ({ type: 'image' as const, url }))];
    }
    return imageUrls.map((url) => ({ type: 'image' as const, url }));
  }, [article]);
  const posterUrl = useMemo(() => resolveMediaUrl(article?.image || article?.images?.[0]), [article]);
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
    const ogImage = slides.find(s => s.type === 'image');
    const image = ogImage ? toAbs(ogImage.url) : `${window.location.origin}/images/hero-sweets.jpg`;
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
  }, [article, slides]);

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
        <Header cartCount={cart.count} onCartClick={() => navigate('/cart')} />

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
          {slides.length > 0 && (
            <div className="rounded-2xl overflow-hidden mb-8 border border-border/40">
              <Carousel className="w-full">
                <CarouselContent>
                  {slides.map((slide, i) => (
                    <CarouselItem key={slide.url + i}>
                      {slide.type === 'video' ? (
                        <video
                          src={slide.url}
                          poster={posterUrl || undefined}
                          className="w-full h-auto object-cover max-h-[420px]"
                          muted
                          loop
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <img
                          src={slide.url}
                          alt={article.title}
                          className="w-full h-auto object-cover max-h-[420px]"
                        />
                      )}
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {slides.length > 1 && (
                  <>
                    <CarouselPrevious className="left-3" />
                    <CarouselNext className="right-3" />
                  </>
                )}
              </Carousel>
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
                    {linkedBadges.map((linkedBadge: any) => (
                      <span key={linkedBadge.id} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badgeToneSoftClasses[linkedBadge.tone]}`}>
                        {linkedBadge.label}
                      </span>
                    ))}
                  </div>
                  <div className="text-sm text-muted-foreground">{linked.description}</div>
                  <div className="mt-2 font-display font-bold text-primary">{linked.price} ₽</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => { cart.addItem(linked, 1); toast.success('Добавлено!', { description: linked.name }); }}
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
          {linkedCategory && (
            <div className="mt-6">
              <Link to={`/catalog?category=${encodeURIComponent(linkedCategory.id)}`} className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 text-sm font-medium text-primary hover:underline">
                <Tag size={14} />
                {linkedCategory.emoji ? `${linkedCategory.emoji} ` : ''}{linkedCategory.name}
              </Link>
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
