import { useState, useMemo, useEffect } from 'react';
import { Search } from 'lucide-react';
import { type Product, type Category, getProductBadgeIds } from './data';
import { useStore } from './useStore';
import ProductCard from './ProductCard';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

type SortKey = 'popular' | 'price_asc' | 'price_desc';
type BadgeFilter = 'all' | string;

interface ProductsProps {
  activeCategory: string | null;
  onAddToCart: (product: Product, qty?: number, packagingId?: string | null) => void;
  productsOverride?: Product[];
  applyCategoryFilter?: boolean;
  categoryFilterMode?: 'exact' | 'hierarchy';
  layout?: 'grid' | 'grouped';
  groupedCategories?: Category[];
  initialSearch?: string;
  initialBadge?: string;
  initialSort?: SortKey;
}

export default function Products({
  activeCategory,
  onAddToCart,
  productsOverride,
  applyCategoryFilter = true,
  categoryFilterMode = 'exact',
  layout = 'grid',
  groupedCategories,
  initialSearch,
  initialBadge,
  initialSort,
}: ProductsProps) {
  const { products, badges } = useStore();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('popular');
  const [badgeFilter, setBadgeFilter] = useState<BadgeFilter>('all');
  const activeBadges = useMemo(() => badges.filter(b => b.active), [badges]);

  const getCategories = useMemo(() => {
    return (p: Product) => {
      const anyP = p as any;
      const arr = Array.isArray(anyP?.categories) ? anyP.categories.filter(Boolean) : [];
      if (arr.length) return arr as string[];
      return anyP?.category ? [String(anyP.category)] : [];
    };
  }, []);

  const baseList = useMemo(() => {
    const list = [...(productsOverride ?? products)];
    return list.filter(p => p.active !== false);
  }, [productsOverride, products]);

  useEffect(() => {
    if (badgeFilter !== 'all' && !activeBadges.some(b => b.id === badgeFilter)) {
      setBadgeFilter('all');
    }
  }, [activeBadges, badgeFilter]);

  useEffect(() => {
    if (typeof initialSearch === 'string') {
      setSearch(initialSearch);
    }
  }, [initialSearch]);

  useEffect(() => {
    if (!initialBadge) return;
    if (initialBadge === 'all') { setBadgeFilter('all'); return; }
    if (activeBadges.some(b => b.id === initialBadge)) {
      setBadgeFilter(initialBadge);
    }
  }, [initialBadge, activeBadges]);

  useEffect(() => {
    if (!initialSort) return;
    setSort(initialSort);
  }, [initialSort]);

  const filtered = useMemo(() => {
    let list = [...baseList];

    if (applyCategoryFilter && activeCategory) {
      if (categoryFilterMode === 'hierarchy') {
        list = list.filter(p => getCategories(p).some(c => c === activeCategory || c.startsWith(`${activeCategory}/`)));
      } else {
        list = list.filter(p => getCategories(p).some(c => c === activeCategory));
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }

    if (badgeFilter !== 'all') {
      list = list.filter(p => getProductBadgeIds(p).includes(badgeFilter));
    }

    switch (sort) {
      case 'price_asc': list.sort((a, b) => a.price - b.price); break;
      case 'price_desc': list.sort((a, b) => b.price - a.price); break;
      default: list.sort((a, b) => b.popularity - a.popularity);
    }

    return list;
  }, [activeCategory, search, sort, badgeFilter, baseList, applyCategoryFilter, categoryFilterMode, getCategories]);

  const grouped = useMemo(() => {
    if (layout !== 'grouped') return [];
    const categories = groupedCategories ?? [];
    const groups = categories
      .map(cat => ({
        category: cat,
        products: baseList.filter(p => getCategories(p).some(c => c === cat.id)),
      }))
      .filter(group => group.products.length > 0);
    if (!activeCategory) return groups;
    return groups.filter(group => group.category.id === activeCategory);
  }, [layout, groupedCategories, baseList, getCategories, activeCategory]);

  const handleAdd = useMemo(() => {
    return (product: Product, packagingId?: string | null) => onAddToCart(product, 1, packagingId);
  }, [onAddToCart]);

  return (
    <section id="products" className="py-12 md:py-16 candy-pattern">
      <div className="container">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-center mb-8 reveal">
          Ассортимент
        </h2>

        {layout === 'grouped' ? (
          grouped.length > 0 ? (
            <div className="space-y-10">
              {grouped.map(group => (
                <div key={group.category.id} className="reveal">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">{group.category.emoji}</span>
                    <h3 className="font-display text-xl md:text-2xl font-semibold">
                      {group.category.name}
                    </h3>
                  </div>
                  <Carousel opts={{ align: 'start', dragFree: true }}>
                    <CarouselContent>
                      {group.products.map(p => (
                        <CarouselItem
                          key={p.id}
                          id={`product-${p.id}`}
                          className="basis-[220px] sm:basis-[240px] md:basis-[260px] lg:basis-[280px]"
                        >
                          <div className="h-full">
                            <ProductCard product={p} onAdd={handleAdd} />
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious className="hidden md:flex left-2" />
                    <CarouselNext className="right-2" />
                  </Carousel>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <span className="text-5xl mb-4 block">🔍</span>
              <p className="font-display text-lg text-muted-foreground">Ничего не найдено</p>
            </div>
          )
        ) : (
          <>
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

            {filtered.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {filtered.map(p => (
                  <div key={p.id} id={`product-${p.id}`} className="reveal">
                    <ProductCard product={p} onAdd={handleAdd} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <span className="text-5xl mb-4 block">🔍</span>
                <p className="font-display text-lg text-muted-foreground">Ничего не найдено</p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
