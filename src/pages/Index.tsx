import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Header from '@/components/candy-store/Header';
import Hero from '@/components/candy-store/Hero';
import Categories from '@/components/candy-store/Categories';
import Products from '@/components/candy-store/Products';
import Reviews from '@/components/candy-store/Reviews';
import Benefits from '@/components/candy-store/Benefits';
import Articles from '@/components/candy-store/Articles';
import PromoBanner from '@/components/candy-store/PromoBanner';
import ContactForm from '@/components/candy-store/ContactForm';
import Footer from '@/components/candy-store/Footer';
import { useCart } from '@/components/candy-store/useCart';
import { useReveal } from '@/components/candy-store/useReveal';
import { useStore } from '@/components/candy-store/useStore';
import type { Product } from '@/components/candy-store/data';

const Index = () => {
  const cart = useCart();
  const store = useStore();
  const navigate = useNavigate();
  const revealRef = useReveal();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Listen for category filter from Hero
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setActiveCategory(detail);
    };
    window.addEventListener('filter-category', handler);
    return () => window.removeEventListener('filter-category', handler);
  }, []);

  const handleAddToCart = useCallback((product: Product, qty = 1, packagingId?: string | null) => {
    cart.addItem(product, qty, packagingId);
    toast.success('Добавлено!', {
      description: product.name,
      duration: 2000,
    });
  }, [cart]);

  useEffect(() => {
    const setMeta = (attr: 'name' | 'property', key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.content = content;
    };
    const setLink = (rel: string, href: string) => {
      let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!el) {
        el = document.createElement('link');
        el.rel = rel;
        document.head.appendChild(el);
      }
      el.href = href;
    };
    const setJsonLd = (id: string, data: unknown) => {
      let el = document.getElementById(id) as HTMLScriptElement | null;
      if (!el) {
        el = document.createElement('script');
        el.type = 'application/ld+json';
        el.id = id;
        document.head.appendChild(el);
      }
      el.textContent = JSON.stringify(data);
    };
    const title = 'МираВкус — Азиатские сладости';
    const description = 'Премиальные азиатские сладости, подарочные наборы и трюфели. Доставка по России.';
    const url = `${window.location.origin}/`;
    const image = `${window.location.origin}/images/hero-sweets.jpg`;
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', 'index, follow');
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:site_name', 'МираВкус');
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:image:alt', 'Сладости МираВкуса');
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);
    setLink('canonical', url);
    setJsonLd('ld-json-home', {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          name: 'МираВкус',
          url,
          logo: image,
        },
        {
          '@type': 'WebSite',
          name: 'МираВкус',
          url,
          potentialAction: {
            '@type': 'SearchAction',
            target: `${url}catalog?search={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        },
      ],
    });
  }, []);

  const handlePromoApply = useCallback((code: string) => {
    cart.applyPromo(code);
    toast.success(`Промокод ${code.toUpperCase()} применён!`);
    navigate('/cart');
  }, [cart, navigate]);

  const productCategoryIds = useMemo(() => {
    const set = new Set<string>();
    const list = store.products || [];
    for (const p of list) {
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
  }, [store.products]);

  const homeCategories = useMemo(() => {
    const list = store.categories || [];
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
  }, [store.categories, productCategoryIds]);

  return (
    <div ref={revealRef} className="min-h-screen">
      <Header cartCount={cart.count} onCartClick={() => navigate('/cart')} />

      <main>
        <Hero />
        <Categories
          items={homeCategories}
          enableHierarchy={false}
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
        />
        <Products
          activeCategory={activeCategory}
          onAddToCart={handleAddToCart}
          layout="grouped"
          groupedCategories={homeCategories}
          applyCategoryFilter={false}
        />
        <Reviews />
        <Benefits />
        <Articles />
        <PromoBanner onApplyPromo={handlePromoApply} />
        <ContactForm />
      </main>

      <Footer />

    </div>
  );
};

export default Index;
