import { useEffect, useMemo, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Product, badgeToneClasses } from './data';
import { resolveMediaUrl } from '@/lib/api';
import { useStore } from './useStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product, packagingId?: string | null) => void;
}

export default function ProductCard({ product, onAdd }: ProductCardProps) {
  const NONE_VALUE = '__none__';
  const { badges, packagingOptions } = useStore();
  const navigate = useNavigate();
  const slides = useMemo(() => {
    const list = product.images && product.images.length ? product.images : [product.image];
    return list.map((u) => resolveMediaUrl(u));
  }, [product]);
  const badge = useMemo(() => badges.find(b => b.id === product.badge && b.active), [badges, product.badge]);
  const activePackaging = useMemo(() => packagingOptions.filter(p => p.active), [packagingOptions]);
  const standardPackaging = useMemo(() => {
    if (product.packagingMode !== 'standard') return null;
    if (!product.standardPackagingId) return null;
    return activePackaging.find(p => p.id === product.standardPackagingId) ?? null;
  }, [activePackaging, product.packagingMode, product.standardPackagingId]);
  const [idx, setIdx] = useState(0);
  const [selectedPackagingId, setSelectedPackagingId] = useState<string>('');
  useEffect(() => { setIdx(0); }, [product.id]);
  useEffect(() => { setSelectedPackagingId(''); }, [product.id]);
  return (
    <article
      className="candy-card cursor-pointer group h-full flex flex-col min-h-[420px] md:min-h-[460px]"
      onClick={() => navigate(`/product/${product.id}`)}
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        {slides.map((url, i) => (
          <img
            key={url + i}
            src={url}
            alt={product.name}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${i === idx ? 'opacity-100' : 'opacity-0'}`}
            loading="lazy"
          />
        ))}
        {badge && (
          <span
            className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold font-display ${badgeToneClasses[badge.tone]}`}
          >
            {badge.label}
          </span>
        )}
        {slides.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 bg-black/20 backdrop-blur rounded-full px-3 py-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                className={`h-2 rounded-full transition-all ${i === idx ? 'w-6 bg-white' : 'w-2 bg-white/60 hover:bg-white/80'}`}
                aria-label={`Фото ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-display font-semibold text-sm md:text-base mb-2 line-clamp-2 leading-snug">
          {product.name}
        </h3>
        {product.packagingMode === 'selectable' && (
          <div className="mb-3" onClick={(e) => e.stopPropagation()}>
            <Select
              value={selectedPackagingId || NONE_VALUE}
              onValueChange={(v) => setSelectedPackagingId(v === NONE_VALUE ? '' : v)}
            >
              <SelectTrigger className="h-auto w-full px-3 py-2 rounded-2xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary/30">
                <SelectValue placeholder="Упаковка" />
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
          </div>
        )}
        {product.packagingMode === 'standard' && (
          <div className="mb-3 text-xs text-muted-foreground">
            Упаковка: {standardPackaging ? `${standardPackaging.name} · ${standardPackaging.price} ₽` : 'стандартная'}
          </div>
        )}
        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-baseline gap-2">
            <span className="font-display font-bold text-lg text-primary">{product.price} ₽</span>
            {product.oldPrice && (
              <span className="text-sm text-muted-foreground line-through">{product.oldPrice} ₽</span>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const packagingArg = product.packagingMode === 'selectable' ? (selectedPackagingId || null) : undefined;
              onAdd(product, packagingArg);
            }}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-110 active:scale-90 transition-transform duration-200"
            aria-label={`Добавить ${product.name} в корзину`}
          >
            <ShoppingCart size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}
