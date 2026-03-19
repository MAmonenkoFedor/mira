import { useEffect, useMemo, useState } from 'react';
import { Heart, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Product, badgeToneClasses } from './data';
import { resolveMediaUrl } from '@/lib/api';
import { useStore } from './useStore';

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product, packagingId?: string | null) => void;
}

export default function ProductCard({ product, onAdd }: ProductCardProps) {
  const { badges, toggleFavorite, isFavorite } = useStore();
  const navigate = useNavigate();
  const favorite = isFavorite(product.id);
  const slides = useMemo(() => {
    const list = product.images && product.images.length ? product.images : [product.image];
    const imageUrls = list.map((u) => resolveMediaUrl(u));
    const videoUrl = product.videoUrl ? resolveMediaUrl(product.videoUrl) : '';
    if (videoUrl) {
      return [{ type: 'video' as const, url: videoUrl }, ...imageUrls.map((url) => ({ type: 'image' as const, url }))];
    }
    return imageUrls.map((url) => ({ type: 'image' as const, url }));
  }, [product]);
  const posterUrl = useMemo(() => resolveMediaUrl(product.image), [product.image]);
  const badge = useMemo(() => badges.find(b => b.id === product.badge && b.active), [badges, product.badge]);
  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [product.id]);
  return (
    <article
      className="candy-card cursor-pointer group h-full flex flex-col min-h-[420px] md:min-h-[460px]"
      onClick={() => navigate(`/product/${product.id}`)}
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        {slides.map((slide, i) => (
          slide.type === 'video' ? (
            <video
              key={slide.url + i}
              src={slide.url}
              poster={posterUrl || undefined}
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${i === idx ? 'opacity-100' : 'opacity-0'}`}
              muted
              loop
              playsInline
              preload="metadata"
              autoPlay={i === idx}
            />
          ) : (
            <img
              key={slide.url + i}
              src={slide.url}
              alt={product.name}
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${i === idx ? 'opacity-100' : 'opacity-0'}`}
              loading="lazy"
            />
          )
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
                aria-label={`Слайд ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-display font-semibold text-sm md:text-base mb-2 line-clamp-2 leading-snug">
          {product.name}
        </h3>
        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-baseline gap-2">
            <span className="font-display font-bold text-lg text-primary">{product.price} ₽</span>
            {product.oldPrice && (
              <span className="text-sm text-muted-foreground line-through">{product.oldPrice} ₽</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(product.id);
              }}
              className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors ${favorite ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-primary hover:bg-muted/60'}`}
              aria-label={favorite ? `Убрать ${product.name} из избранного` : `Добавить ${product.name} в избранное`}
            >
              <Heart size={16} fill={favorite ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAdd(product);
              }}
              className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-110 active:scale-90 transition-transform duration-200"
              aria-label={`Добавить ${product.name} в корзину`}
            >
              <ShoppingCart size={16} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
