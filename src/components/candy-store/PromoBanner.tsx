import { useMemo } from 'react';
import { useStore } from './useStore';

interface PromoBannerProps {
  onApplyPromo: (code: string) => void;
}

export default function PromoBanner({ onApplyPromo }: PromoBannerProps) {
  const { promos } = useStore();
  const primaryPromo = useMemo(
    () =>
      [...(promos || [])]
        .filter(p => p.active)
        .sort((a, b) => b.percent - a.percent)
        .find(p => p.scope === 'all') ?? [...(promos || [])].filter(p => p.active).sort((a, b) => b.percent - a.percent)[0] ?? null,
    [promos]
  );

  return (
    <section id="promo" className="py-12 md:py-16">
      <div className="container">
        <div className="reveal candy-gradient-bg rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
          <span className="absolute -top-4 -left-4 text-7xl opacity-20 rotate-12">🎁</span>
          <span className="absolute -bottom-4 -right-4 text-7xl opacity-20 -rotate-12">🍬</span>

          <div className="relative z-10">
            <h2 className="font-display text-2xl md:text-4xl font-bold mb-3">
              {primaryPromo ? `−${primaryPromo.percent}% на сладости` : 'Скидки по промокодам'}
            </h2>
            <p className="text-muted-foreground mb-6 text-lg">
              {primaryPromo ? (
                <>
                  Используйте промокод <span className="font-display font-bold text-primary">{primaryPromo.code}</span> при оформлении
                </>
              ) : (
                <>Создайте активный промокод в админке, чтобы он появился здесь автоматически</>
              )}
            </p>
            <button
              onClick={() => {
                if (!primaryPromo) return;
                onApplyPromo(primaryPromo.code);
              }}
              disabled={!primaryPromo}
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
