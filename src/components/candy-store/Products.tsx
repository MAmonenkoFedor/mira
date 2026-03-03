import { useState, useMemo, useEffect } from 'react';
import { Search } from 'lucide-react';
import { type Product } from './data';
import { useStore } from './useStore';
import ProductCard from './ProductCard';

type SortKey = 'popular' | 'price_asc' | 'price_desc';
type BadgeFilter = 'all' | string;

interface ProductsProps {
  activeCategory: string | null;
  onAddToCart: (product: Product) => void;
  onProductClick: (product: Product) => void;
}

export default function Products({ activeCategory, onAddToCart, onProductClick }: ProductsProps) {
  const { products, badges } = useStore();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('popular');
  const [badgeFilter, setBadgeFilter] = useState<BadgeFilter>('all');
  const activeBadges = useMemo(() => badges.filter(b => b.active), [badges]);

  useEffect(() => {
    if (badgeFilter !== 'all' && !activeBadges.some(b => b.id === badgeFilter)) {
      setBadgeFilter('all');
    }
  }, [activeBadges, badgeFilter]);

  const filtered = useMemo(() => {
    let list = [...products];

    if (activeCategory) {
      list = list.filter(p => p.category === activeCategory);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }

    if (badgeFilter !== 'all') {
      list = list.filter(p => p.badge === badgeFilter);
    }

    switch (sort) {
      case 'price_asc': list.sort((a, b) => a.price - b.price); break;
      case 'price_desc': list.sort((a, b) => b.price - a.price); break;
      default: list.sort((a, b) => b.popularity - a.popularity);
    }

    return list;
  }, [activeCategory, search, sort, badgeFilter, products]);

  return (
    <section id="products" className="py-12 md:py-16 candy-pattern">
      <div className="container">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-center mb-8 reveal">
          Наши сладости
        </h2>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8 reveal">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Поиск по названию..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-full bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
            />
          </div>

          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            className="px-4 py-3 rounded-full bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
          >
            <option value="popular">Популярные</option>
            <option value="price_asc">Цена ↑</option>
            <option value="price_desc">Цена ↓</option>
          </select>

          <div className="flex gap-2">
            <button
              key="all"
              onClick={() => setBadgeFilter('all')}
              className={`candy-chip text-xs ${badgeFilter === 'all' ? 'active' : ''}`}
            >
              Все
            </button>
            {activeBadges.map(b => (
              <button
                key={b.id}
                onClick={() => setBadgeFilter(b.id)}
                className={`candy-chip text-xs ${badgeFilter === b.id ? 'active' : ''}`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {filtered.map(p => (
              <div key={p.id} id={`product-${p.id}`} className="reveal">
                <ProductCard product={p} onAdd={onAddToCart} onClick={onProductClick} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <span className="text-5xl mb-4 block">🔍</span>
            <p className="font-display text-lg text-muted-foreground">Ничего не найдено</p>
          </div>
        )}
      </div>
    </section>
  );
}
