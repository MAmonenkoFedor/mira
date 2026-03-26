import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, Menu, X, Search, ChevronDown, Heart, User } from 'lucide-react';
import { useStore } from './useStore';

interface HeaderProps {
  cartCount: number;
  onCartClick: () => void;
}

const navLinks = [
  { label: 'Каталог', href: '/catalog' },
  { label: 'О нас', href: '/about' },
  { label: 'Категории', href: '/#categories' },
  { label: 'Товары', href: '/#products' },
  { label: 'Отзывы', href: '/#reviews' },
  { label: 'Преимущества', href: '/#benefits' },
  { label: 'Акция', href: '/#promo' },
  { label: 'Контакты', href: '/#footer' },
];

export default function Header({ cartCount, onCartClick }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const catalogRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { categories, products, badges } = useStore();
  const logoCandidates = useMemo(
    () => ['/logo.png', '/logo.webp', '/logo.svg', '/images/logo.png', '/images/logo.webp', '/images/logo.svg'],
    []
  );
  const [logoSrc, setLogoSrc] = useState(logoCandidates[0]);
  const [logoFailed, setLogoFailed] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const raw = location.hash;
    if (!raw) return;
    const id = decodeURIComponent(raw.replace('#', ''));
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [location.hash, location.pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!catalogRef.current) return;
      if (catalogRef.current.contains(e.target as Node)) return;
      setCatalogOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const next = params.get('search') || '';
    setQuery(next);
  }, [location.search]);

  const submitSearch = (value?: string) => {
    const q = (value ?? query).trim();
    navigate(q ? `/catalog?search=${encodeURIComponent(q)}` : '/catalog');
  };

  const productCategoryIds = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.active === false) continue;
      const anyP = p as any;
      const ids: string[] = Array.isArray(anyP?.categories) && anyP.categories.length
        ? anyP.categories.filter(Boolean).map((x: unknown) => String(x))
        : (anyP?.category ? [String(anyP.category)] : []);
      for (const id of ids) {
        const parts = id.split('/');
        for (let i = 0; i < parts.length; i += 1) {
          set.add(parts.slice(0, i + 1).join('/'));
        }
      }
    }
    return set;
  }, [products]);

  const catalogCategories = useMemo(() => {
    const list = categories || [];
    const withIndex = list.map((c, index) => ({ c, index }));
    return withIndex
      .filter(({ c }) => (c.showOnHome ?? (!c.id.includes('/') && c.id !== 'packaging')) && productCategoryIds.has(c.id))
      .sort((a, b) => {
        const ao = typeof a.c.homeOrder === 'number' ? a.c.homeOrder : Number.POSITIVE_INFINITY;
        const bo = typeof b.c.homeOrder === 'number' ? b.c.homeOrder : Number.POSITIVE_INFINITY;
        if (ao !== bo) return ao - bo;
        return a.index - b.index;
      })
      .map(({ c }) => c);
  }, [categories, productCategoryIds]);

  const hasNew = useMemo(() => badges.some(b => b.id === 'new' && b.active !== false), [badges]);
  const hasHit = useMemo(() => badges.some(b => b.id === 'hit' && b.active !== false), [badges]);

  return (
    <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-md border-b border-border/60 shadow-sm">
      <div className="container flex items-center gap-4 h-16 md:h-18">
        <Link to="/" className="font-display text-xl md:text-2xl font-bold text-primary flex items-center gap-2 shrink-0">
          {!logoFailed ? (
            <img
              src={logoSrc}
              alt="Логотип"
              className="h-8 w-8 md:h-9 md:w-9 object-contain"
              onError={() => {
                const idx = logoCandidates.indexOf(logoSrc);
                const next = logoCandidates[idx + 1];
                if (next) setLogoSrc(next);
                else setLogoFailed(true);
              }}
            />
          ) : (
            <span className="text-2xl">🍬</span>
          )}
          <span>МираВкус</span>
        </Link>

        <div className="hidden md:flex items-center gap-3 flex-1">
          <div ref={catalogRef} className="relative">
            <button
              type="button"
              onClick={() => setCatalogOpen(v => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary text-primary-foreground font-display font-medium text-sm hover:scale-[1.02] active:scale-95 transition-transform"
              aria-expanded={catalogOpen}
              aria-haspopup="menu"
            >
              <Menu size={16} />
              Меню
              <ChevronDown size={16} />
            </button>
            {catalogOpen && (
              <div className="absolute left-0 mt-2 w-[320px] rounded-3xl border border-border/60 bg-card shadow-lg p-4 z-50">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Разделы</div>
                <div className="grid grid-cols-1 gap-1 mb-3">
                  <Link
                    to="/catalog"
                    onClick={() => setCatalogOpen(false)}
                    className="px-3 py-2 rounded-2xl text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
                  >
                    Все товары
                  </Link>
                  {hasNew && (
                    <Link
                      to="/catalog?badge=new"
                      onClick={() => setCatalogOpen(false)}
                      className="px-3 py-2 rounded-2xl text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
                    >
                      Новинки
                    </Link>
                  )}
                  <Link
                    to={hasHit ? "/catalog?badge=hit" : "/catalog?sort=popular"}
                    onClick={() => setCatalogOpen(false)}
                    className="px-3 py-2 rounded-2xl text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
                  >
                    Хиты продаж
                  </Link>
                </div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Категории</div>
                <div className="grid grid-cols-1 gap-1">
                  {catalogCategories.map(c => (
                    <Link
                      key={c.id}
                      to={`/catalog?category=${encodeURIComponent(c.id)}`}
                      onClick={() => setCatalogOpen(false)}
                      className="px-3 py-2 rounded-2xl text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-border/40">
                  <Link
                    to="/about"
                    onClick={() => setCatalogOpen(false)}
                    className="px-3 py-2 rounded-2xl text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors block"
                  >
                    О нас
                  </Link>
                </div>
              </div>
            )}
          </div>
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitSearch(); }}
              placeholder="Найти сладости, подарки..."
              className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
              aria-label="Поиск по каталогу"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Link
            to="/account"
            className="hidden md:inline-flex p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
            aria-label="Избранное"
          >
            <Heart size={18} />
          </Link>
          <button
            onClick={onCartClick}
            className="relative p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
            aria-label="Открыть корзину"
          >
            <ShoppingCart size={18} />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-accent text-accent-foreground text-[11px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
          <Link
            to="/account"
            className="hidden md:inline-flex p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
            aria-label="Профиль"
          >
            <User size={18} />
          </Link>

          <button
            onClick={() => {
              setMobileOpen(true);
              requestAnimationFrame(() => mobileSearchRef.current?.focus());
            }}
            className="md:hidden p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
            aria-label="Поиск"
          >
            <Search size={20} />
          </button>
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="md:hidden p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
            aria-label="Открыть меню"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-border/40 bg-card/95 backdrop-blur-md animate-in slide-in-from-top-2 duration-200">
          <div className="container py-3 flex flex-col gap-1">
            <div className="px-2 pb-1">
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/account"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-2xl text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
                >
                  <Heart size={16} />
                  Избранное
                </Link>
                <Link
                  to="/account"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-2xl text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
                >
                  <User size={16} />
                  Кабинет
                </Link>
              </div>
            </div>
            <div className="px-2 pb-2">
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={mobileSearchRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { submitSearch(); setMobileOpen(false); } }}
                  placeholder="Найти сладости, подарки..."
                  className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                  aria-label="Поиск по каталогу"
                />
              </div>
            </div>
            {navLinks.map(l => (
              <Link
                key={l.href}
                to={l.href}
                onClick={() => setMobileOpen(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
