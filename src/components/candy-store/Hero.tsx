import { useEffect, useMemo, useState } from 'react';
import { useStore } from './useStore';
import { resolveMediaUrl } from '@/lib/api';
import { Link } from 'react-router-dom';

export default function Hero() {
  const { heroImages } = useStore();
  const slides = useMemo(
    () => (heroImages || []).filter(i => i.active).sort((a, b) => a.position - b.position),
    [heroImages]
  );
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length]);
  const floatingCandies = [
    { emoji: '🍭', className: 'candy-float-1 top-[10%] left-[8%] text-4xl md:text-5xl' },
    { emoji: '🍬', className: 'candy-float-2 top-[20%] right-[12%] text-3xl md:text-4xl' },
    { emoji: '🧁', className: 'candy-float-3 bottom-[15%] left-[15%] text-3xl md:text-4xl' },
    { emoji: '🍩', className: 'candy-float-4 top-[60%] right-[8%] text-4xl md:text-5xl' },
    { emoji: '🍪', className: 'candy-float-2 top-[5%] right-[40%] text-2xl md:text-3xl' },
  ];

  return (
    <section className="relative overflow-hidden candy-gradient-bg candy-pattern min-h-[560px] md:min-h-[680px] flex items-center">
      {/* Floating candies */}
      {floatingCandies.map((c, i) => (
        <span
          key={i}
          className={`absolute pointer-events-none select-none opacity-60 ${c.className}`}
          aria-hidden="true"
        >
          {c.emoji}
        </span>
      ))}

      <div className="container relative z-10 flex flex-col lg:flex-row items-center gap-8 lg:gap-12 py-20">
        <div className="flex-1 text-center lg:text-left max-w-xl">
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-4">
            Сладкое счастье{' '}
            <span className="text-primary">для детей</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
            Натуральные конфеты, шоколад и подарочные наборы — с любовью для самых маленьких сладкоежек
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
            <Link
              to="/catalog"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-primary text-primary-foreground font-display font-semibold text-base hover:scale-105 active:scale-95 transition-transform duration-200 shadow-candy"
            >
              🎁 Выбрать набор
            </Link>
            <a
              href="/#categories"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-card text-foreground font-display font-semibold text-base border-2 border-primary/30 hover:border-primary/60 hover:scale-105 active:scale-95 transition-all duration-200"
            >
              Выбрать сладости
            </a>
          </div>
        </div>

        <div className="flex-1 max-w-lg lg:max-w-xl">
          <div className="relative w-full rounded-3xl shadow-candy-lg overflow-hidden">
            {(slides.length ? slides : [{ url: '/images/hero-sweets.jpg' } as any]).map((s, i) => {
              const isActive = i === (idx % (slides.length || 1));
              const link = typeof s.link === 'string' ? s.link.trim() : '';
              const isExternal = /^https?:\/\//i.test(link);
              const wrapperClass = `w-full aspect-[1600/893] transition-opacity duration-700 ${isActive ? 'opacity-100' : 'opacity-0 absolute inset-0'} ${link ? 'cursor-pointer' : ''}`;
              const img = (
                <img
                  src={resolveMediaUrl(s.url)}
                  alt="Ассортимент красочных детских сладостей"
                  className="w-full h-full object-cover"
                  loading={i === 0 ? 'eager' : 'lazy'}
                />
              );
              if (link) {
                return isExternal ? (
                  <a key={s.id ?? i} href={link} target="_blank" rel="noreferrer" className={wrapperClass}>
                    {img}
                  </a>
                ) : (
                  <Link key={s.id ?? i} to={link} className={wrapperClass}>
                    {img}
                  </Link>
                );
              }
              return (
                <div key={s.id ?? i} className={wrapperClass}>
                  {img}
                </div>
              );
            })}
            {slides.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-card/40 backdrop-blur rounded-full px-2 py-1">
                {slides.map((_, i) => (
                  <span key={i} className={`w-2 h-2 rounded-full ${i === idx ? 'bg-primary' : 'bg-white/60'}`} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
