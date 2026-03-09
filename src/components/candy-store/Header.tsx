import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, Menu, X } from 'lucide-react';

interface HeaderProps {
  cartCount: number;
  onCartClick: () => void;
}

const navLinks = [
  { label: 'Каталог', href: '/catalog' },
  { label: 'Категории', href: '/#categories' },
  { label: 'Товары', href: '/#products' },
  { label: 'Отзывы', href: '/#reviews' },
  { label: 'Преимущества', href: '/#benefits' },
  { label: 'Акция', href: '/#promo' },
  { label: 'Контакты', href: '/#footer' },
];

export default function Header({ cartCount, onCartClick }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const logoCandidates = useMemo(
    () => ['/logo.png', '/logo.webp', '/logo.svg', '/images/logo.png', '/images/logo.webp', '/images/logo.svg'],
    []
  );
  const [logoSrc, setLogoSrc] = useState(logoCandidates[0]);
  const [logoFailed, setLogoFailed] = useState(false);

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

  return (
    <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-md border-b border-border/60 shadow-sm">
      <div className="container flex items-center justify-between h-16 md:h-18">
        <Link to="/" className="font-display text-xl md:text-2xl font-bold text-primary flex items-center gap-2">
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
          <span>Конфетная Страна</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map(l => (
            <Link
              key={l.href}
              to={l.href}
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-200"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={onCartClick}
            className="relative flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground font-display font-medium text-sm hover:scale-105 active:scale-95 transition-transform duration-200"
            aria-label="Открыть корзину"
          >
            <ShoppingCart size={18} />
            <span className="hidden sm:inline">Корзина</span>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
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
