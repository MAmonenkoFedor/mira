import { Link } from 'react-router-dom';
import { useStore } from './useStore';

const tagColors: Record<string, string> = {
  'Советы': 'bg-primary/10 text-primary',
  'Обзор': 'bg-accent/20 text-accent-foreground',
  'Здоровье': 'bg-secondary text-secondary-foreground',
  'Рецепты': 'bg-primary/10 text-primary',
  'Новости': 'bg-accent/20 text-accent-foreground',
};

export default function Articles() {
  const { articles } = useStore();

  return (
    <section id="articles" className="py-16 md:py-20 bg-muted/30">
      <div className="container">
        <div className="text-center mb-10">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">
            Полезные статьи 📖
          </h2>
          <p className="text-muted-foreground text-sm md:text-base max-w-md mx-auto">
            Советы и обзоры для родителей, которые выбирают лучшее для своих детей
          </p>
        </div>

        {articles.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Статей пока нет</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {articles.map(a => (
              <article
                key={a.id}
                className="reveal bg-card rounded-3xl overflow-hidden shadow-soft border border-border/40 hover:shadow-md transition-shadow duration-300 flex flex-col"
              >
                <div className="h-2 bg-gradient-to-r from-primary/60 via-accent/40 to-secondary/50" />
                <div className="p-5 flex flex-col gap-3 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${tagColors[a.tag] || 'bg-muted text-muted-foreground'}`}>
                      {a.tag}
                    </span>
                    <span className="text-xs text-muted-foreground">{a.readTime}</span>
                  </div>
                  <h3 className="font-display font-semibold text-foreground leading-snug">{a.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">{a.excerpt}</p>
                  <Link to={`/articles/${a.slug}`} className="self-start text-sm font-medium text-primary hover:underline mt-1">
                    Читать далее →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
