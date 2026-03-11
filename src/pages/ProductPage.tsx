import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Minus, Plus, Tag } from 'lucide-react';
import Header from '@/components/candy-store/Header';
import Footer from '@/components/candy-store/Footer';
import CartDrawer from '@/components/candy-store/CartDrawer';
import Checkout from '@/components/candy-store/Checkout';
import { useCart } from '@/components/candy-store/useCart';
import { useStore } from '@/components/candy-store/useStore';
import { resolveMediaUrl } from '@/lib/api';
import NotFound from '@/pages/NotFound';
import { badgeToneClasses, type Product } from '@/components/candy-store/data';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export default function ProductPage() {
  const NONE_VALUE = '__none__';
  const { id } = useParams<{ id: string }>();
  const cart = useCart();
  const { products, categories, badges, packagingOptions } = useStore();

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

  useEffect(() => {
    setIdx(0);
    setQty(1);
    setSelectedPackagingId('');
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
    const title = `${product.name} — Конфетная Страна`;
    const description = product.description?.slice(0, 160) || 'Детские сладости с доставкой по России.';
    const url = `${window.location.origin}/product/${product.id}`;
    const image = slides[0] ? toAbs(slides[0]) : `${window.location.origin}/images/hero-sweets.jpg`;
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', 'index, follow');
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', 'product');
    setMeta('property', 'og:site_name', 'Конфетная Страна');
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
          brand: { '@type': 'Brand', name: 'Конфетная Страна' },
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

  const activePackaging = packagingOptions.filter(p => p.active);
  const standardPackaging = product.packagingMode === 'standard'
    ? (activePackaging.find(p => p.id === product.standardPackagingId) ?? null)
    : null;
  const selectedPackaging = product.packagingMode === 'selectable'
    ? (activePackaging.find(p => p.id === selectedPackagingId) ?? null)
    : null;
  const packagingPrice = (standardPackaging?.price ?? selectedPackaging?.price ?? 0) * qty;
  const lineTotal = product.price * qty + packagingPrice;

  return (
    <div className="min-h-screen bg-background">
      <Header cartCount={cart.count} onCartClick={() => cart.setIsCartOpen(true)} />

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
                    {slides.map((url: string, i: number) => (
                      <button
                        key={url + i}
                        type="button"
                        onClick={() => setIdx(i)}
                        className={`rounded-2xl overflow-hidden border transition ${
                          i === idx ? 'border-primary shadow-sm' : 'border-border/50 hover:border-border'
                        }`}
                        aria-label={`Фото ${i + 1}`}
                      >
                        <img src={url} alt="" className="w-full aspect-square object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                <div className="relative rounded-2xl overflow-hidden">
                  {slides.map((url: string, i: number) => (
                    <img
                      key={url + i}
                      src={url}
                      alt={product.name}
                      className={`w-full aspect-[3/4] max-h-[560px] object-cover transition-opacity duration-700 ${i === idx ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
                    />
                  ))}
                  {slides.length > 1 && (
                    <div className="md:hidden absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 bg-black/20 backdrop-blur rounded-full px-3 py-1.5">
                      {slides.map((_: string, i: number) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setIdx(i)}
                          className={`h-2 rounded-full transition-all ${i === idx ? 'w-6 bg-white' : 'w-2 bg-white/60 hover:bg-white/80'}`}
                          aria-label={`Фото ${i + 1}`}
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

            {(product.packagingMode && product.packagingMode !== 'none') && (
              <div className="mb-6">
                <div className="text-xs font-medium text-muted-foreground mb-2">Упаковка</div>
                {product.packagingMode === 'selectable' ? (
                  <Select
                    value={selectedPackagingId || NONE_VALUE}
                    onValueChange={(v) => setSelectedPackagingId(v === NONE_VALUE ? '' : v)}
                  >
                    <SelectTrigger className="h-auto w-full px-4 py-3 rounded-2xl bg-card border border-border text-sm focus:ring-2 focus:ring-primary/30">
                      <SelectValue placeholder="Выберите упаковку" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value={NONE_VALUE}>Без упаковки</SelectItem>
                      {activePackaging.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} · {p.price} ₽
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="px-4 py-3 rounded-2xl bg-muted text-sm">
                    {standardPackaging ? (
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-display font-medium">{standardPackaging.name}</span>
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

              <button
                onClick={() => {
                  cart.addItem(product, qty, product.packagingMode === 'selectable' ? (selectedPackagingId || null) : undefined);
                  toast.success('Добавлено!', { description: product.name, duration: 2000 });
                  cart.setIsCartOpen(true);
                }}
                className="flex-1 py-3.5 rounded-full bg-primary text-primary-foreground font-display font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200 shadow-soft"
              >
                Добавить — {lineTotal} ₽
              </button>
            </div>
          </div>
        </div>
      </main>

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
  );
}
