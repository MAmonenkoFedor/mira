import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from './useStore';
import { resolveMediaUrl } from '@/lib/api';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

interface PromoBannerProps {
  onApplyPromo: () => void;
}

export default function PromoBanner({ onApplyPromo }: PromoBannerProps) {
  const { promoBanners } = useStore();
  const banners = useMemo(
    () => (promoBanners || []).filter(b => b.active).sort((a, b) => a.position - b.position),
    [promoBanners]
  );

  if (banners.length > 0) {
    return (
      <section id="promo" className="py-12 md:py-16">
        <div className="container">
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-6 text-center">Акции</h2>
          <div className="reveal rounded-3xl overflow-hidden border border-border/60 bg-card">
            {banners.length === 1 ? (
              <PromoBannerItem banner={banners[0]} />
            ) : (
              <Carousel opts={{ align: 'start' }} className="w-full">
                <CarouselContent className="-ml-0">
                  {banners.map(b => (
                    <CarouselItem key={b.id} className="pl-0">
                      <PromoBannerItem banner={b} />
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="left-3 right-auto top-1/2 -translate-y-1/2 translate-x-0 bg-background/80 hover:bg-background" />
                <CarouselNext className="right-3 left-auto top-1/2 -translate-y-1/2 translate-x-0 bg-background/80 hover:bg-background" />
              </Carousel>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="promo" className="py-12 md:py-16">
      <div className="container">
        <div className="reveal candy-gradient-bg rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
          <span className="absolute -top-4 -left-4 text-7xl opacity-20 rotate-12">🎁</span>
          <span className="absolute -bottom-4 -right-4 text-7xl opacity-20 -rotate-12">🍬</span>

          <div className="relative z-10">
            <h2 className="font-display text-2xl md:text-4xl font-bold mb-3">
              −15% на подарочные наборы
            </h2>
            <p className="text-muted-foreground mb-6 text-lg">
              Используйте промокод <span className="font-display font-bold text-primary">SWEET15</span> при оформлении
            </p>
            <button
              onClick={onApplyPromo}
              className="inline-flex items-center px-8 py-3.5 rounded-full bg-primary text-primary-foreground font-display font-semibold hover:scale-105 active:scale-95 transition-transform duration-200 shadow-candy"
            >
              Применить в корзине
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function PromoBannerItem({ banner }: { banner: { url: string; link?: string | null } }) {
  const link = typeof banner.link === 'string' ? banner.link.trim() : '';
  const isExternal = /^https?:\/\//i.test(link);
  const img = (
    <img
      src={resolveMediaUrl(banner.url)}
      alt="Баннер акции"
      className="w-full aspect-[1600/520] object-cover"
      loading="lazy"
    />
  );
  if (link) {
    return isExternal ? (
      <a href={link} target="_blank" rel="noreferrer" className="block">
        {img}
      </a>
    ) : (
      <Link to={link} className="block">
        {img}
      </Link>
    );
  }
  return img;
}
