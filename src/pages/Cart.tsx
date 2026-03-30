import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Tag, Trash2 } from 'lucide-react';
import Header from '@/components/candy-store/Header';
import Footer from '@/components/candy-store/Footer';
import Checkout from '@/components/candy-store/Checkout';
import { useCart } from '@/components/candy-store/useCart';
import { useStore } from '@/components/candy-store/useStore';
import { resolveMediaUrl } from '@/lib/api';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';

export default function Cart() {
  const cart = useCart();
  const navigate = useNavigate();
  const { packagingOptions } = useStore();
  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState(false);
  const activePackaging = packagingOptions.filter(p => p.active);
  const getPackaging = (id?: string | null) => {
    if (!id) return null;
    return activePackaging.find(p => p.id === id) ?? null;
  };
  const getPackagingImage = (p?: { image?: string; images?: string[] }) => resolveMediaUrl(p?.image || p?.images?.[0] || '');
  const packagingChoices = useMemo(() => activePackaging, [activePackaging]);

  const handlePromo = async () => {
    const ok = await cart.applyPromo(promoInput.trim());
    setPromoError(!ok);
    if (ok) setPromoInput('');
  };

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
    const title = 'Корзина — МираВкус';
    const description = 'Корзина заказа МираВкус: проверка товаров, промокодов и оформление доставки.';
    const url = `${window.location.origin}/cart`;
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', 'noindex, nofollow');
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:url', url);
    setMeta('name', 'twitter:card', 'summary');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setLink('canonical', url);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header cartCount={cart.count} onCartClick={() => navigate('/cart')} />

      <main className="container py-10 md:py-14">
        <div className="flex items-center gap-2 text-sm mb-6">
          <Link to="/catalog" className="text-primary hover:underline">← Назад в каталог</Link>
          <span className="text-muted-foreground">· Корзина</span>
        </div>

        <div className="flex items-end justify-between gap-3 mb-6">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold">Корзина</h1>
            <div className="text-sm text-muted-foreground">Товаров: {cart.count}</div>
          </div>
          {cart.items.length > 0 && (
            <button
              onClick={() => cart.clearCart()}
              className="text-sm text-muted-foreground hover:text-destructive transition-colors"
            >
              Очистить корзину
            </button>
          )}
        </div>

        {cart.items.length === 0 ? (
          <div className="rounded-3xl border border-border/40 bg-card p-10 text-center">
            <div className="text-5xl mb-3">🍬</div>
            <div className="font-display font-semibold text-lg mb-2">Корзина пуста</div>
            <div className="text-sm text-muted-foreground mb-5">Добавьте товары из каталога</div>
            <Link to="/catalog" className="inline-flex px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-display font-semibold">
              Перейти в каталог
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
            <div className="space-y-4">
              {cart.items.map(item => {
                const resolvedPackagingMode = item.product.packagingMode ?? (item.product.standardPackagingId ? 'standard' : 'selectable');
                return (
                  <div key={item.product.id} className="rounded-3xl border border-border/40 bg-card p-4">
                    <div className="flex gap-4">
                      <img
                        src={resolveMediaUrl(item.product.images?.[0] || item.product.image)}
                        alt={item.product.name}
                        className="w-24 h-24 rounded-2xl object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-display font-semibold text-sm md:text-base line-clamp-2">{item.product.name}</div>
                            <div className="text-sm text-primary font-display font-bold mt-1">{item.product.price} ₽</div>
                          </div>
                          <button
                            onClick={() => cart.removeItem(item.product.id)}
                            className="w-8 h-8 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                            aria-label="Удалить"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {(resolvedPackagingMode && resolvedPackagingMode !== 'none') && (
                          <div className="mt-3">
                            {resolvedPackagingMode === 'selectable' ? (
                              <Carousel opts={{ align: 'start', dragFree: true }} className="w-full">
                                <CarouselContent className="-ml-2">
                                  {packagingChoices.map(p => {
                                    const imageUrl = getPackagingImage(p);
                                    const active = item.packagingId === p.id;
                                    return (
                                      <CarouselItem key={p.id} className="pl-2 basis-[90px]">
                                        <button
                                          type="button"
                                          onClick={() => cart.updatePackaging(item.product.id, p.id)}
                                          className={`w-full rounded-2xl border text-left p-2 transition ${
                                            active ? 'border-primary/60 bg-primary/10' : 'border-border bg-card hover:bg-muted/40'
                                          }`}
                                        >
                                          <div className="w-full h-10 rounded-xl bg-muted/40 overflow-hidden flex items-center justify-center">
                                            {imageUrl ? (
                                              <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                              <span className="text-[10px] text-muted-foreground">{p.name}</span>
                                            )}
                                          </div>
                                          <div className="mt-1 text-[10px] font-medium line-clamp-2">{p.name}</div>
                                          <div className="text-[10px] text-primary font-semibold">{p.price} ₽</div>
                                        </button>
                                      </CarouselItem>
                                    );
                                  })}
                                </CarouselContent>
                              </Carousel>
                            ) : (
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                {(() => {
                                  const p = getPackaging(item.packagingId ?? item.product.standardPackagingId ?? null);
                                  if (!p) return <span>Упаковка: стандартная</span>;
                                  const imageUrl = getPackagingImage(p);
                                  return (
                                    <>
                                      {imageUrl && <img src={imageUrl} alt="" className="w-7 h-7 rounded-lg object-cover" />}
                                      <span>Упаковка: {p.name}{p.price ? ` · ${p.price} ₽` : ''}</span>
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-4">
                          <button
                            onClick={() => cart.updateQuantity(item.product.id, item.quantity - 1)}
                            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:scale-110 transition-transform"
                            aria-label="Уменьшить"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="text-sm font-display font-semibold w-6 text-center">{item.quantity}</span>
                          <button
                            onClick={() => cart.updateQuantity(item.product.id, item.quantity + 1)}
                            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:scale-110 transition-transform"
                            aria-label="Увеличить"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-3xl border border-border/40 bg-card p-5 space-y-4">
              {!cart.promoCode ? (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Промокод"
                      value={promoInput}
                      onChange={e => { setPromoInput(e.target.value); setPromoError(false); }}
                      className={`w-full pl-9 pr-3 py-2.5 rounded-full border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                        promoError ? 'border-destructive' : 'border-border'
                      }`}
                    />
                  </div>
                  <button
                    onClick={handlePromo}
                    className="px-4 py-2.5 rounded-full bg-secondary text-secondary-foreground text-sm font-display font-medium hover:scale-105 active:scale-95 transition-transform"
                  >
                    Применить
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-secondary/50">
                  <Tag size={14} className="text-secondary-foreground" />
                  <span className="text-sm font-display font-medium text-secondary-foreground">
                    {cart.promoCode} применён
                  </span>
                </div>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Подытог</span>
                  <span className="font-display font-medium">{cart.subtotal} ₽</span>
                </div>
                {cart.discount > 0 && (
                  <div className="flex justify-between text-primary">
                    <span>Скидка</span>
                    <span className="font-display font-medium">−{cart.discount} ₽</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-border text-base">
                  <span className="font-display font-bold">Итого</span>
                  <span className="font-display font-bold text-primary">{cart.total} ₽</span>
                </div>
              </div>

              <button
                onClick={() => cart.setIsCheckoutOpen(true)}
                className="w-full py-3.5 rounded-full bg-primary text-primary-foreground font-display font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200"
              >
                Заказать
              </button>

              <div className="text-[11px] text-muted-foreground">
                Нажимая «Заказать», вы соглашаетесь с правилами магазина.
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />

      <Checkout
        open={cart.isCheckoutOpen}
        onClose={() => cart.setIsCheckoutOpen(false)}
        total={cart.total}
        onPlaceOrder={cart.placeOrder}
      />
    </div>
  );
}
