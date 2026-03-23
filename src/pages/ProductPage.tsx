import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Heart, Minus, Plus, Tag, Star } from 'lucide-react';
import Header from '@/components/candy-store/Header';
import Footer from '@/components/candy-store/Footer';
import { useCart } from '@/components/candy-store/useCart';
import { useStore } from '@/components/candy-store/useStore';
import { api, resolveMediaUrl } from '@/lib/api';
import { getCustomerToken } from '@/lib/auth';
import NotFound from '@/pages/NotFound';
import { badgeToneClasses, type Product, type Review } from '@/components/candy-store/data';
import { toast } from 'sonner';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={16}
          className={i < count ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}
        />
      ))}
    </div>
  );
}

export default function ProductPage() {
  const NONE_VALUE = '__none__';
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const cart = useCart();
  const { products, categories, badges, packagingOptions, toggleFavorite, isFavorite } = useStore();

  const productId = Number(id);
  const product = useMemo<Product | null>(() => {
    if (!Number.isFinite(productId)) return null;
    return products.find(p => p.id === productId && (p.active ?? true)) ?? null;
  }, [products, productId]);

  const category = useMemo(() => {
    if (!product) return null;
    const anyP = product as any;
    const list: string[] = Array.isArray(anyP?.categories) && anyP.categories.length
      ? anyP.categories.filter(Boolean).map((x: unknown) => String(x))
      : (anyP?.category ? [String(anyP.category)] : []);
    const primary = list[0] ?? '';
    if (!primary) return null;
    return categories.find(c => c.id === primary) ?? null;
  }, [categories, product]);

  const badge = useMemo(() => {
    if (!product) return null;
    return badges.find(b => b.id === product.badge && b.active) ?? null;
  }, [badges, product]);

  const slides = useMemo(() => {
    if (!product) return [];
    const list = product.images && product.images.length ? product.images : [product.image];
    return list.map((u: string) => resolveMediaUrl(u));
  }, [product]);
  const favorite = product ? isFavorite(product.id) : false;
  const activePackaging = useMemo(() => packagingOptions.filter(p => p.active), [packagingOptions]);
  const resolvedPackagingMode = product?.packagingMode ?? (product?.standardPackagingId ? 'standard' : 'selectable');
  const getPackagingImage = (p?: { image?: string; images?: string[] }) => resolveMediaUrl(p?.image || p?.images?.[0] || '');
  const standardPackaging = useMemo(() => {
    if (resolvedPackagingMode !== 'standard') return null;
    if (!product?.standardPackagingId) return null;
    return activePackaging.find(p => p.id === product.standardPackagingId) ?? null;
  }, [activePackaging, resolvedPackagingMode, product?.standardPackagingId]);
  const packagingChoices = useMemo(() => {
    return [
      { id: NONE_VALUE, name: 'Без упаковки', price: 0, image: '', images: [] as string[] },
      ...activePackaging,
    ];
  }, [activePackaging]);

  const related = useMemo(() => {
    if (!product) return [];
    const anyP = product as any;
    const base: string[] = Array.isArray(anyP?.categories) && anyP.categories.length
      ? anyP.categories.filter(Boolean).map((x: unknown) => String(x))
      : (anyP?.category ? [String(anyP.category)] : []);
    const baseSet = new Set(base);
    return products
      .filter(p => {
        if (!(p.active ?? true) || p.id === product.id) return false;
        const anyR = p as any;
        const list: string[] = Array.isArray(anyR?.categories) && anyR.categories.length
          ? anyR.categories.filter(Boolean).map((x: unknown) => String(x))
          : (anyR?.category ? [String(anyR.category)] : []);
        return list.some(c => baseSet.has(c));
      })
      .slice(0, 24);
  }, [products, product]);

  const [idx, setIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [selectedPackagingId, setSelectedPackagingId] = useState<string>('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewSending, setReviewSending] = useState(false);
  const [reviewForm, setReviewForm] = useState({ name: '', rating: 5, text: '' });
  const [canReview, setCanReview] = useState(false);
  const [reviewEligibilityReady, setReviewEligibilityReady] = useState(false);

  useEffect(() => {
    if (!product?.id) return;
    const load = async () => {
      try {
        setReviewsLoading(true);
        const list = await api.getProductReviews(product.id);
        setReviews(Array.isArray(list) ? list as Review[] : []);
      } catch {
        setReviews([]);
      } finally {
        setReviewsLoading(false);
      }
    };
    load();
  }, [product?.id]);

  useEffect(() => {
    if (!product?.id) return;
    const token = getCustomerToken();
    if (!token) {
      setCanReview(false);
      setReviewEligibilityReady(true);
      return;
    }
    const check = async () => {
      try {
        const orders = await api.getCustomerOrders();
        const list = Array.isArray(orders) ? orders : [];
        const has = list.some((o: any) => Array.isArray(o.items) && o.items.some((i: any) => Number(i.productId) === product.id));
        setCanReview(has);
      } catch {
        setCanReview(false);
      } finally {
        setReviewEligibilityReady(true);
      }
    };
    check();
  }, [product?.id]);

  useEffect(() => {
    setIdx(0);
    setQty(1);
    setSelectedPackagingId('');
    setReviewForm({ name: '', rating: 5, text: '' });
    setCanReview(false);
    setReviewEligibilityReady(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [productId]);

  useEffect(() => {
    if (!product) return;
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
    const title = `${product.name} — МираВкус`;
    const description = product.description?.slice(0, 160) || 'Детские сладости с доставкой по России.';
    const url = `${window.location.origin}/product/${product.id}`;
    const image = slides[0] ? toAbs(slides[0]) : `${window.location.origin}/images/hero-sweets.jpg`;
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', 'index, follow');
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', 'product');
    setMeta('property', 'og:site_name', 'МираВкус');
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:image:alt', product.name);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);
    setLink('canonical', url);
    setJsonLd('ld-json-product', {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Product',
          name: product.name,
          image: [image],
          description: product.description,
          sku: product.sku || undefined,
          brand: { '@type': 'Brand', name: 'МираВкус' },
          offers: {
            '@type': 'Offer',
            priceCurrency: 'RUB',
            price: product.price,
            availability: product.active === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
            url,
          },
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Каталог',
              item: `${window.location.origin}/catalog`,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: category?.name || product.name,
              item: url,
            },
          ],
        },
      ],
    });
  }, [product, slides, category]);

  if (!product) return <NotFound />;
  const formatReviewDate = (value?: string) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header cartCount={cart.count} onCartClick={() => navigate('/cart')} />

      <main className="container py-10 md:py-14">
        <div className="mb-6 flex items-center gap-2 text-sm">
          <Link to="/catalog" className="text-primary hover:underline">← Назад в каталог</Link>
          {category && (
            <span className="text-muted-foreground">· {category.emoji ? `${category.emoji} ` : ''}{category.name}</span>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          <div className="rounded-3xl border border-border/50 bg-card overflow-hidden">
            <div className="p-3 md:p-4">
              <div className="grid md:grid-cols-[92px_1fr] gap-3 items-start">
                {slides.length > 1 && (
                  <div className="hidden md:flex flex-col gap-2 max-h-[560px] overflow-auto pr-1">
                    {slides.map((slide, i: number) => (
                      <button
                        key={slide + i}
                        type="button"
                        onClick={() => setIdx(i)}
                        className={`rounded-2xl overflow-hidden border transition ${
                          i === idx ? 'border-primary shadow-sm' : 'border-border/50 hover:border-border'
                        }`}
                        aria-label={`Слайд ${i + 1}`}
                      >
                        <img src={slide} alt="" className="w-full aspect-square object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                <div className="relative rounded-2xl overflow-hidden bg-muted/20">
                  {slides.map((slide, i: number) => (
                    <img
                      key={slide + i}
                      src={slide}
                      alt={product.name}
                      className={`w-full aspect-[3/4] max-h-[560px] object-contain transition-opacity duration-700 ${i === idx ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
                    />
                  ))}
                  {slides.length > 1 && (
                    <div className="md:hidden absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 bg-black/20 backdrop-blur rounded-full px-3 py-1.5">
                      {slides.map((_, i: number) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setIdx(i)}
                          className={`h-2 rounded-full transition-all ${i === idx ? 'w-6 bg-white' : 'w-2 bg-white/60 hover:bg-white/80'}`}
                          aria-label={`Слайд ${i + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {badge && (
                <span className={`px-3 py-1 rounded-full text-xs font-bold font-display ${badgeToneClasses[badge.tone]}`}>
                  {badge.label}
                </span>
              )}
              {category && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                  <Tag size={12} />
                  {category.name}
                </span>
              )}
            </div>

            <h1 className="font-display text-2xl md:text-4xl font-bold leading-tight mb-4">
              {product.name}
            </h1>

            {related.length > 0 && (
              <div className="mb-6">
                <div className="text-xs font-medium text-muted-foreground mb-2">Другие наборы в категории</div>
                <div className="relative">
                  <Carousel opts={{ align: 'start' }} className="w-full">
                    <CarouselContent className="-ml-2">
                      {related.map((p: any) => (
                        <CarouselItem key={p.id} className="pl-2 basis-1/3 sm:basis-1/4 lg:basis-1/5">
                          <Link
                            to={`/product/${p.id}`}
                            className="block rounded-2xl border border-border/50 bg-card overflow-hidden hover:border-border hover:shadow-sm transition"
                          >
                            <img
                              src={resolveMediaUrl((p.images && p.images.length ? p.images[0] : p.image) || '')}
                              alt={p.name}
                              className="w-full aspect-square object-cover"
                              loading="lazy"
                            />
                            <div className="p-2">
                              <div className="text-[11px] font-medium leading-snug line-clamp-2">{p.name}</div>
                              <div className="text-[11px] font-semibold text-primary mt-1">{p.price} ₽</div>
                            </div>
                          </Link>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious className="left-2 right-auto top-1/2 -translate-y-1/2 translate-x-0 bg-background/80 hover:bg-background" />
                    <CarouselNext className="right-2 left-auto top-1/2 -translate-y-1/2 translate-x-0 bg-background/80 hover:bg-background" />
                  </Carousel>
                </div>
              </div>
            )}

            <p className="text-muted-foreground text-sm md:text-[15px] leading-relaxed mb-6">
              {product.description}
            </p>

            <div className="flex items-baseline gap-3 mb-6">
              <span className="font-display font-bold text-2xl md:text-3xl text-primary">{product.price} ₽</span>
              {product.oldPrice && (
                <span className="text-base text-muted-foreground line-through">{product.oldPrice} ₽</span>
              )}
            </div>

            {(resolvedPackagingMode && resolvedPackagingMode !== 'none') && (
              <div className="mb-6">
                <div className="text-xs font-medium text-muted-foreground mb-2">Упаковка</div>
                {resolvedPackagingMode === 'selectable' ? (
                  <div>
                    <Carousel opts={{ align: 'start', dragFree: true }} className="w-full">
                      <CarouselContent className="-ml-3">
                        {packagingChoices.map(p => {
                          const imageUrl = getPackagingImage(p);
                          const active = (selectedPackagingId || NONE_VALUE) === p.id;
                          return (
                            <CarouselItem key={p.id} className="pl-3 basis-[90px] sm:basis-[100px]">
                              <button
                                type="button"
                                onClick={() => setSelectedPackagingId(p.id === NONE_VALUE ? '' : p.id)}
                                className={`w-full rounded-2xl border text-left p-2 transition ${
                                  active ? 'border-primary/60 bg-primary/10' : 'border-border bg-card hover:bg-muted/40'
                                }`}
                              >
                                <div className="w-full h-14 rounded-xl bg-muted/40 overflow-hidden flex items-center justify-center">
                                  {imageUrl ? (
                                    <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Без упаковки</span>
                                  )}
                                </div>
                                <div className="mt-1 text-[11px] font-medium line-clamp-2">{p.name}</div>
                                <div className="text-[11px] text-primary font-semibold">{p.price} ₽</div>
                              </button>
                            </CarouselItem>
                          );
                        })}
                      </CarouselContent>
                      <CarouselPrevious className="hidden sm:flex left-2" />
                      <CarouselNext className="hidden sm:flex right-2" />
                    </Carousel>
                  </div>
                ) : (
                  <div className="px-4 py-3 rounded-2xl bg-muted text-sm">
                    {standardPackaging ? (
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {getPackagingImage(standardPackaging) && (
                            <img src={getPackagingImage(standardPackaging)} alt="" className="w-10 h-10 rounded-xl object-cover" />
                          )}
                          <span className="font-display font-medium">{standardPackaging.name}</span>
                        </div>
                        <span className="font-display font-semibold text-primary">{standardPackaging.price} ₽</span>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">Стандартная</div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mb-6 rounded-3xl border border-border/50 bg-card p-4">
              <div className="grid gap-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">Артикул</span>
                    <span className="font-display font-medium text-right">{product.sku || '—'}</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">Состав</span>
                  <span className="font-display font-medium text-right line-clamp-2">
                      {product.compositionShort || product.compositionSet || '—'}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">Срок годности</span>
                    <span className="font-display font-medium text-right">{product.shelfLife || '—'}</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">Страна изготовления</span>
                    <span className="font-display font-medium text-right">{product.country || '—'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailsOpen(true)}
                  className="mt-1 w-full px-4 py-3 rounded-2xl bg-muted hover:bg-muted/80 transition text-sm font-display font-semibold"
                >
                  Характеристики и описание
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center gap-3 bg-muted rounded-full px-3 w-fit">
                <button
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="w-10 h-10 flex items-center justify-center hover:text-primary transition-colors"
                  aria-label="Уменьшить"
                >
                  <Minus size={16} />
                </button>
                <span className="font-display font-semibold w-7 text-center">{qty}</span>
                <button
                  onClick={() => setQty(q => q + 1)}
                  className="w-10 h-10 flex items-center justify-center hover:text-primary transition-colors"
                  aria-label="Увеличить"
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="flex flex-1 items-center gap-3">
                <button
                  onClick={() => {
                    const packagingArg = resolvedPackagingMode === 'selectable' ? (selectedPackagingId || null) : undefined;
                    cart.addItem(product, qty, packagingArg);
                    toast.success('Добавлено!', { description: product.name, duration: 2000 });
                  }}
                  className="flex-1 py-3.5 rounded-full bg-primary text-primary-foreground font-display font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200 shadow-soft"
                >
                  Заказать
                </button>
                <button
                  type="button"
                  onClick={() => toggleFavorite(product.id)}
                  className={`w-12 h-12 rounded-full border flex items-center justify-center transition-colors ${favorite ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-primary hover:bg-muted/60'}`}
                  aria-label={favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
                >
                  <Heart size={18} fill={favorite ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <section className="container pb-12 md:pb-16">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h2 className="font-display text-xl md:text-2xl font-bold">Отзывы о товаре</h2>
          <span className="text-sm text-muted-foreground">{reviews.length} отзывов</span>
        </div>

        {reviewsLoading ? (
          <div className="text-sm text-muted-foreground">Загрузка отзывов...</div>
        ) : (
          <div className="grid gap-4">
            {reviews.map(r => (
              <div key={r.id} className="bg-card rounded-3xl p-5 shadow-soft border border-border/40 grid gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-display font-semibold text-sm">{r.authorName}</div>
                    <div className="text-xs text-muted-foreground">{formatReviewDate(r.createdAt) || '—'}</div>
                  </div>
                  <Stars count={r.rating} />
                </div>
                <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">«{r.text}»</div>
              </div>
            ))}
            {reviews.length === 0 && (
              <div className="text-sm text-muted-foreground">Пока нет отзывов. Будьте первым!</div>
            )}
          </div>
        )}

        <div className="mt-8 bg-card rounded-3xl p-5 border border-border/40 shadow-soft">
          <div className="font-display font-semibold text-base mb-2">Оставить отзыв</div>
          {!reviewEligibilityReady && (
            <div className="text-xs text-muted-foreground mb-4">Проверяем покупку...</div>
          )}
          {reviewEligibilityReady && !getCustomerToken() && (
            <div className="text-xs text-muted-foreground mb-4">
              Чтобы оставить отзыв, войдите в аккаунт. <Link to="/account" className="text-primary hover:underline">Войти</Link>
            </div>
          )}
          {reviewEligibilityReady && getCustomerToken() && !canReview && (
            <div className="text-xs text-muted-foreground mb-4">
              Отзыв могут оставить только покупатели этого товара
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!canReview) { toast.error('Отзыв могут оставить только покупатели'); return; }
              if (!reviewForm.name.trim()) { toast.error('Введите имя'); return; }
              if (!reviewForm.text.trim()) { toast.error('Введите текст отзыва'); return; }
              if (!product?.id) return;
              try {
                setReviewSending(true);
                await api.addProductReview(product.id, {
                  authorName: reviewForm.name.trim(),
                  rating: Number(reviewForm.rating) || 5,
                  text: reviewForm.text.trim(),
                });
                setReviewForm({ name: '', rating: 5, text: '' });
                toast.success('Отзыв отправлен на модерацию');
              } catch {
                toast.error('Не удалось отправить отзыв');
              } finally {
                setReviewSending(false);
              }
            }}
            className="grid gap-3"
          >
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Имя</label>
                <input
                  value={reviewForm.name}
                  onChange={e => setReviewForm(f => ({ ...f, name: e.target.value }))}
                  className="admin-input"
                  disabled={!canReview}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Оценка</label>
                <select
                  value={reviewForm.rating}
                  onChange={e => setReviewForm(f => ({ ...f, rating: Number(e.target.value) }))}
                  className="admin-input"
                  disabled={!canReview}
                >
                  {[5, 4, 3, 2, 1].map(v => (
                    <option key={v} value={v}>{v} / 5</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Текст отзыва</label>
              <textarea
                value={reviewForm.text}
                onChange={e => setReviewForm(f => ({ ...f, text: e.target.value }))}
                rows={4}
                className="admin-input resize-none"
                disabled={!canReview}
              />
            </div>
            <div className="text-xs text-muted-foreground">Отзыв будет опубликован после модерации</div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={reviewSending || !canReview}
                className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-display font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                Отправить отзыв
              </button>
            </div>
          </form>
        </div>
      </section>

      <Footer />

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Характеристики и описание</SheetTitle>
          </SheetHeader>
          <div className="mt-6 grid gap-5 text-sm">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Состав набора</div>
              <div className="whitespace-pre-wrap">{product.compositionSet || '—'}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Температура хранения</div>
              <div className="whitespace-pre-wrap">{product.storageTemperature || '—'}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Особенности продукции</div>
              <div className="whitespace-pre-wrap">{product.productFeatures || '—'}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Вес набора</div>
              <div className="whitespace-pre-wrap">{product.setWeight || '—'}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Габариты упаковки</div>
              <div className="whitespace-pre-wrap">{product.packageDimensions || '—'}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Описание</div>
              <div className="whitespace-pre-wrap">{product.descriptionLong || product.description || '—'}</div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}
