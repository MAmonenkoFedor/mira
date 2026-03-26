import { type Category } from './data';
import { useStore } from './useStore';

interface CategoriesProps {
  activeCategory: string | null;
  onSelect: (id: string | null) => void;
  items?: Category[];
  title?: string;
  enableHierarchy?: boolean;
}

const colorMap: Record<string, string> = {
  'candy-pink': 'bg-candy-pink',
  'candy-mint': 'bg-candy-mint',
  'candy-lavender': 'bg-candy-lavender',
  'candy-blue': 'bg-candy-blue',
  'candy-banana': 'bg-candy-banana',
};

export default function Categories({ activeCategory, onSelect, items, title, enableHierarchy }: CategoriesProps) {
  const { categories: storeCategories } = useStore();
  const categories = items ?? storeCategories;
  const hierarchy = enableHierarchy ?? categories.some(c => c.id.includes('/'));
  const top = hierarchy ? categories.filter(c => !c.id.includes('/')) : categories;
  const activeTopId = activeCategory ? activeCategory.split('/')[0] : null;
  const activeSecondId = activeCategory && activeCategory.includes('/') ? activeCategory.split('/').slice(0, 2).join('/') : null;
  const second = hierarchy
    ? categories.filter(c => activeTopId ? (c.id.startsWith(`${activeTopId}/`) && c.id.split('/').length === 2) : false)
    : [];
  const third = hierarchy
    ? categories.filter(c => activeSecondId ? (c.id.startsWith(`${activeSecondId}/`) && c.id.split('/').length === 3) : false)
    : [];

  const handleClick = (cat: Category) => {
    const next = activeCategory === cat.id ? null : cat.id;
    onSelect(next);
    // Scroll to products
    setTimeout(() => {
      document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  return (
    <section id="categories" className="py-12 md:py-16">
      <div className="container">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-center mb-8 reveal">
          {title ?? 'Категории сладостей'}
        </h2>

        <div className="flex flex-wrap gap-2 justify-center reveal">
          <button
            onClick={() => onSelect(null)}
            className={`candy-chip ${!activeCategory ? 'active' : ''}`}
          >
            Все
          </button>
          {top.map(cat => (
            <button
              key={cat.id}
              onClick={() => handleClick(cat)}
              className={`candy-chip ${(activeCategory === cat.id || (hierarchy && activeTopId === cat.id)) ? 'active' : ''}`}
            >
              {cat.emoji} {cat.name}
            </button>
          ))}
        </div>

        {second.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center reveal mt-3">
            {second.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleClick(cat)}
                className={`candy-chip ${activeCategory === cat.id ? 'active' : ''}`}
              >
                {cat.emoji} {cat.name}
              </button>
            ))}
          </div>
        )}

        {third.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center reveal mt-3">
            {third.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleClick(cat)}
                className={`candy-chip ${activeCategory === cat.id ? 'active' : ''}`}
              >
                {cat.emoji} {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
