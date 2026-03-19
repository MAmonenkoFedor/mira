import { X, Minus, Plus, Trash2, Tag } from 'lucide-react';
import { CartItem } from './useCart';
import { useState } from 'react';
import { resolveMediaUrl } from '@/lib/api';
import { useStore } from './useStore';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  promoCode: string | null;
  onUpdateQty: (id: number, qty: number) => void;
  onUpdatePackaging: (id: number, packagingId: string | null) => void;
  onRemove: (id: number) => void;
  onApplyPromo: (code: string) => boolean | Promise<boolean>;
  onCheckout: () => void;
}

export default function CartDrawer({
  open, onClose, items, subtotal, discount, total,
  promoCode, onUpdateQty, onUpdatePackaging, onRemove, onApplyPromo, onCheckout
}: CartDrawerProps) {
  const NONE_VALUE = '__none__';
  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState(false);
  const { packagingOptions } = useStore();
  const activePackaging = packagingOptions.filter(p => p.active);
  const getPackaging = (id?: string | null) => {
    if (!id) return null;
    return activePackaging.find(p => p.id === id) ?? null;
  };
  const getPackagingImage = (p?: { image?: string; images?: string[] }) => resolveMediaUrl(p?.image || p?.images?.[0] || '');
  const packagingChoices = [{ id: NONE_VALUE, name: 'Без упаковки', price: 0, image: '', images: [] as string[] }, ...activePackaging];

  const handlePromo = async () => {
    const ok = await onApplyPromo(promoInput.trim());
    setPromoError(!ok);
    if (ok) setPromoInput('');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55]" onClick={onClose}>
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" />
      <div
        className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-card shadow-candy-lg flex flex-col animate-in slide-in-from-right duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-display text-xl font-bold">🛒 Корзина</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:scale-110 transition-transform" aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-16">
              <span className="text-5xl mb-3 block">🍬</span>
              <p className="text-muted-foreground font-display">Корзина пуста</p>
            </div>
          ) : (
            items.map(item => {
              const resolvedPackagingMode = item.product.packagingMode ?? (item.product.standardPackagingId ? 'standard' : 'selectable');
              return (
              <div key={item.product.id} className="flex gap-3 p-3 rounded-2xl bg-muted/50">
                <img
                  src={resolveMediaUrl(item.product.images?.[0] || item.product.image)}
                  alt={item.product.name}
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-display font-medium text-sm truncate">{item.product.name}</h4>
                  <p className="font-display font-bold text-primary text-sm mt-0.5">{item.product.price} ₽</p>
                  {(resolvedPackagingMode && resolvedPackagingMode !== 'none') && (
                    <div className="mt-1.5">
                      {resolvedPackagingMode === 'selectable' ? (
                        <Carousel opts={{ align: 'start', dragFree: true }} className="w-full">
                          <CarouselContent className="-ml-2">
                            {packagingChoices.map(p => {
                              const imageUrl = getPackagingImage(p);
                              const active = (item.packagingId ?? NONE_VALUE) === p.id;
                              return (
                                <CarouselItem key={p.id} className="pl-2 basis-[70px]">
                                  <button
                                    type="button"
                                    onClick={() => onUpdatePackaging(item.product.id, p.id === NONE_VALUE ? null : p.id)}
                                    className={`w-full rounded-2xl border text-left p-2 transition ${
                                      active ? 'border-primary/60 bg-primary/10' : 'border-border bg-card hover:bg-muted/40'
                                    }`}
                                  >
                                    <div className="w-full h-8 rounded-xl bg-muted/40 overflow-hidden flex items-center justify-center">
                                      {imageUrl ? (
                                        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="text-[9px] text-muted-foreground">Без упаковки</span>
                                      )}
                                    </div>
                                    <div className="mt-1 text-[9px] font-medium line-clamp-2">{p.name}</div>
                                    <div className="text-[9px] text-primary font-semibold">{p.price} ₽</div>
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
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      onClick={() => onUpdateQty(item.product.id, item.quantity - 1)}
                      className="w-7 h-7 rounded-full bg-card flex items-center justify-center hover:scale-110 transition-transform"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-sm font-display font-semibold w-5 text-center">{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQty(item.product.id, item.quantity + 1)}
                      className="w-7 h-7 rounded-full bg-card flex items-center justify-center hover:scale-110 transition-transform"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      onClick={() => onRemove(item.product.id)}
                      className="ml-auto w-7 h-7 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
            })
          )}
        </div>

        {items.length > 0 && (
          <div className="p-5 border-t border-border space-y-4">
            {/* Promo */}
            {!promoCode ? (
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
                  {promoCode} применён
                </span>
              </div>
            )}

            {/* Totals */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Подытог</span>
                <span className="font-display font-medium">{subtotal} ₽</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-primary">
                  <span>Скидка</span>
                  <span className="font-display font-medium">−{discount} ₽</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-border text-base">
                <span className="font-display font-bold">Итого</span>
                <span className="font-display font-bold text-primary">{total} ₽</span>
              </div>
            </div>

            <button
              onClick={onCheckout}
              className="w-full py-3.5 rounded-full bg-primary text-primary-foreground font-display font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200"
            >
              Оформить заказ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
