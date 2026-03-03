import { Truck, ShieldCheck, Gift, Heart } from 'lucide-react';

const benefits = [
  { icon: Truck, title: 'Быстрая доставка', desc: 'От 1 дня по Москве' },
  { icon: ShieldCheck, title: 'Натуральный состав', desc: 'Без вредных добавок' },
  { icon: Gift, title: 'Подарочная упаковка', desc: 'Бесплатно к каждому набору' },
  { icon: Heart, title: 'Сделано с любовью', desc: 'Ручная работа кондитеров' },
];

export default function Benefits() {
  return (
    <section id="benefits" className="py-12 md:py-16">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {benefits.map((b, i) => (
            <div key={i} className="reveal flex flex-col items-center text-center p-6 rounded-3xl bg-card border border-border/50">
              <div className="w-14 h-14 rounded-2xl bg-candy-pink flex items-center justify-center mb-3">
                <b.icon size={24} className="text-primary" />
              </div>
              <h3 className="font-display font-semibold text-sm mb-1">{b.title}</h3>
              <p className="text-xs text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
