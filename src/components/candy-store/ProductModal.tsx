import { useEffect, useMemo, useState } from 'react';
import { X, Minus, Plus } from 'lucide-react';
import { Product, badgeToneClasses } from './data';
import { resolveMediaUrl } from '@/lib/api';
import { useStore } from './useStore';

interface ProductModalProps {
  product: Product;
  onClose: () => void;
  onAdd: (product: Product, qty: number) => void;
}

export default function ProductModal({ product, onClose, onAdd }: ProductModalProps) {
  const [qty, setQty] = useState(1);
  const { badges } = useStore();
  const slides = useMemo(() => {
    const list = product.images && product.images.length ? product.images : [product.image];
    return list.map((u) => resolveMediaUrl(u));
  }, [product]);
  const badge = useMemo(() => badges.find(b => b.id === product.badge && b.active), [badges, product.badge]);
  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [product.id]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-md" />
      <div
        className="relative bg-card rounded-[28px] shadow-candy-lg max-w-md md:max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 border border-white/10"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-card/80 backdrop-blur flex items-center justify-center hover:scale-110 transition-transform shadow-soft"
          aria-label="Закрыть"
        >
          <X size={18} />
        </button>

        <div className="relative shrink-0">
          {slides.map((url, i) => (
            <img
              key={url + i}
              src={url}
              alt={product.name}
              className={`w-full aspect-[3/4] max-h-[320px] md:max-h-[360px] object-cover transition-opacity duration-700 ${i === idx ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
            />
          ))}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/30 to-transparent" />
          {slides.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 bg-black/20 backdrop-blur rounded-full px-3 py-1.5">
              {slides.map((_, i) => (
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

        <div className="p-6 pt-5 overflow-y-auto min-h-0">
          <div className="flex items-start gap-2 mb-2">
            {badge && (
              <span className={`px-3 py-1 rounded-full text-xs font-bold font-display ${badgeToneClasses[badge.tone]}`}>
                {badge.label}
              </span>
            )}
          </div>
          <h3 className="font-display text-xl md:text-2xl font-bold mb-2">{product.name}</h3>
          <p className="text-muted-foreground text-sm md:text-[15px] mb-5 leading-relaxed">{product.description}</p>

          <div className="flex items-baseline gap-2 mb-6">
            <span className="font-display font-bold text-2xl md:text-3xl text-primary">{product.price} ₽</span>
            {product.oldPrice && (
              <span className="text-base text-muted-foreground line-through">{product.oldPrice} ₽</span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-muted rounded-full px-3">
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
              onClick={() => { onAdd(product, qty); onClose(); }}
              className="flex-1 py-3.5 rounded-full bg-primary text-primary-foreground font-display font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200 shadow-soft"
            >
              Добавить — {product.price * qty} ₽
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
