import { Star } from 'lucide-react';

const reviews = [
  {
    name: 'Анна М.',
    rating: 5,
    text: 'Заказывала подарочный набор на день рождения дочки — дети были в восторге! Красивая упаковка и очень вкусные конфеты.',
    date: '2 недели назад',
  },
  {
    name: 'Дмитрий К.',
    rating: 5,
    text: 'Моти с манго — это что-то невероятное! Теперь заказываем каждую неделю. Доставка быстрая, всё свежее.',
    date: '1 месяц назад',
  },
  {
    name: 'Елена С.',
    rating: 4,
    text: 'Отличный магазин! Трюфели «Радуга» стали любимым десертом всей семьи. Промокод SWEET15 — приятный бонус.',
    date: '3 недели назад',
  },
  {
    name: 'Ольга В.',
    rating: 5,
    text: 'Покупаю здесь шоколадные фигурки для детских праздников. Качество всегда на высоте, дети в восторге!',
    date: '1 неделю назад',
  },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={16}
          className={i < count ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}
        />
      ))}
    </div>
  );
}

export default function Reviews() {
  return (
    <section id="reviews" className="py-16 md:py-20">
      <div className="container">
        <div className="text-center mb-10">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">
            Отзывы наших покупателей ⭐
          </h2>
          <p className="text-muted-foreground text-sm md:text-base max-w-md mx-auto">
            Более 2 000 довольных клиентов уже попробовали наши сладости
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {reviews.map((r, i) => (
            <div
              key={i}
              className="reveal bg-card rounded-3xl p-5 shadow-soft border border-border/40 flex flex-col gap-3 hover:shadow-md transition-shadow duration-300"
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-full bg-primary/15 text-primary font-display font-bold text-sm flex items-center justify-center">
                  {r.name[0]}
                </div>
                <Stars count={r.rating} />
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed flex-1">«{r.text}»</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">{r.name}</span>
                <span>{r.date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
