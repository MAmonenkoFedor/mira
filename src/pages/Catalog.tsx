import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Header from '@/components/candy-store/Header';
import Products from '@/components/candy-store/Products';
import Footer from '@/components/candy-store/Footer';
import { useStore } from '@/components/candy-store/useStore';
import { useCart } from '@/components/candy-store/useCart';
import { useReveal } from '@/components/candy-store/useReveal';
import type { Product, Category } from '@/components/candy-store/data';

type Node = { category: Category; children: Node[] };

const getProductCategoryIds = (p: Product) => {
  const anyP = p as any;
  return Array.isArray(anyP?.categories) && anyP.categories.length
    ? anyP.categories.filter(Boolean).map((x: unknown) => String(x))
    : (anyP?.category ? [String(anyP.category)] : []);
};

const flattenCategoryTree = (nodes: Node[]) => {
  const out: { id: string; label: string }[] = [];
  const walk = (node: Node, depth: number) => {
    out.push({
      id: node.category.id,
      label: `${'— '.repeat(depth)}${node.category.emoji ? `${node.category.emoji} ` : ''}${node.category.name}`,
    });
    node.children.forEach(child => walk(child, depth + 1));
  };
  nodes.forEach(node => walk(node, 0));
  return out;
};

const Catalog = () => {
  const cart = useCart();
  const revealRef = useReveal();
  const { products, categories } = useStore();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedPath, setExpandedPath] = useState<string[]>([]);
  const [searchParams] = useSearchParams();

  const handleAddToCart = useCallback((product: Product, qty = 1, packagingId?: string | null) => {
    cart.addItem(product, qty, packagingId);
    toast.success('Добавлено!', { description: product.name, duration: 2000 });
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
    const title = 'Каталог сладостей — МираВкус';
    const description = 'Полный каталог сладостей: подарочные наборы и штучные товары. Выбирайте по категориям и оформляйте заказ онлайн.';
    const url = `${window.location.origin}/catalog`;
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
    setJsonLd('ld-json-catalog', {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description,
      url,
    });
  }, []);

  useEffect(() => {
    const c = searchParams.get('category');
    if (c) setActiveCategory(c);
  }, [searchParams]);

  const searchQuery = searchParams.get('search') || '';
  const badgeQuery = searchParams.get('badge') || undefined;
  const sortQuery = ((): 'popular' | 'price_asc' | 'price_desc' | undefined => {
    const s = searchParams.get('sort');
    if (s === 'popular' || s === 'price_asc' || s === 'price_desc') return s;
    return undefined;
  })();

  const productCategoryIds = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.active === false) continue;
      const ids = getProductCategoryIds(p);
      for (const id of ids) {
        const parts = id.split('/');
        for (let i = 0; i < parts.length; i += 1) {
          set.add(parts.slice(0, i + 1).join('/'));
        }
      }
    }
    return set;
  }, [products]);

  const tree = useMemo(() => {
    const list = categories.filter(c => Boolean(c?.id) && productCategoryIds.has(c.id));
    const map = new Map<string, Node>();

    const getNode = (c: Category) => {
      const existing = map.get(c.id);
      if (existing) return existing;
      const node: Node = { category: c, children: [] };
      map.set(c.id, node);
      return node;
    };

    for (const c of list) getNode(c);

    const roots: Node[] = [];
    for (const c of list) {
      const parts = c.id.split('/');
      if (parts.length === 1) {
        roots.push(getNode(c));
        continue;
      }
      const parentId = parts.slice(0, -1).join('/');
      const parent = map.get(parentId);
      if (parent) parent.children.push(getNode(c));
      else roots.push(getNode(c));
    }

    const sort = (nodes: Node[]) => {
      nodes.sort((a, b) => a.category.name.localeCompare(b.category.name, 'ru'));
      for (const n of nodes) sort(n.children);
    };
    sort(roots);
    return roots;
  }, [categories, productCategoryIds]);

  const selectCategory = useCallback((id: string | null, toggle = true) => {
    setActiveCategory(prev => (toggle && prev === id ? null : id));
    setTimeout(() => {
      document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);
  const handleTreeNodeClick = useCallback((id: string, hasChildren: boolean, ancestorIds: string[]) => {
    if (hasChildren) {
      const nextPath = [...ancestorIds, id];
      setExpandedPath(prev => (
        prev.length === nextPath.length && prev.every((v, idx) => v === nextPath[idx])
          ? ancestorIds
          : nextPath
      ));
      selectCategory(id, false);
      return;
    }
    setExpandedPath(ancestorIds);
    selectCategory(id);
  }, [selectCategory]);

  useEffect(() => {
    if (!activeCategory) {
      setExpandedPath([]);
      return;
    }
    const parts = activeCategory.split('/').filter(Boolean);
    if (parts.length <= 1) return;
    const nextPath: string[] = [];
    for (let i = 0; i < parts.length - 1; i += 1) {
      nextPath.push(parts.slice(0, i + 1).join('/'));
    }
    setExpandedPath(nextPath);
  }, [activeCategory]);

  const activeTopId = activeCategory ? activeCategory.split('/')[0] : null;
  const setIds = useMemo(() => new Set(['gift', 'chocolate', 'truffles', 'asian', 'cookies']), []);
  const isSetNode = useCallback((n: Node) => n.category.group === 'set' || (!n.category.group && setIds.has(n.category.id)), [setIds]);
  const setNodes = useMemo(() => tree.filter(n => isSetNode(n)), [tree, isSetNode]);
  const singleNodes = useMemo(() => tree.filter(n => !isSetNode(n)), [tree, isSetNode]);
  const setCategoryOptions = useMemo(() => flattenCategoryTree(setNodes), [setNodes]);
  const singleCategoryOptions = useMemo(() => flattenCategoryTree(singleNodes), [singleNodes]);
  const renderTreeNode = useCallback((node: Node, depth: number, ancestorIds: string[] = []): JSX.Element => (
    <div key={node.category.id}>
      <button
        onClick={() => handleTreeNodeClick(node.category.id, node.children.length > 0, ancestorIds)}
        className={`w-full text-left rounded-2xl text-sm transition ${
          (depth === 0 ? (activeTopId === node.category.id || activeCategory === node.category.id) : activeCategory === node.category.id)
            ? 'bg-primary/10 text-primary'
            : 'hover:bg-muted/50'
        }`}
        style={{ paddingLeft: `${12 + depth * 12}px`, paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px' }}
      >
        {node.category.emoji ? `${node.category.emoji} ` : ''}{node.category.name}
      </button>
      {node.children.length > 0 && expandedPath.includes(node.category.id) && (
        <div className="mt-1 space-y-1">
          {node.children.map(child => renderTreeNode(child, depth + 1, [...ancestorIds, node.category.id]))}
        </div>
      )}
    </div>
  ), [activeCategory, activeTopId, expandedPath, handleTreeNodeClick]);

  return (
    <div ref={revealRef} className="min-h-screen">
      <Header cartCount={cart.count} onCartClick={() => navigate('/cart')} />

      <main>
        <section className="py-10 md:py-12">
          <div className="container">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-center reveal">
              Каталог
            </h1>
          </div>
        </section>

        <section className="pb-12 md:pb-16">
          <div className="container">
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
              <aside className="hidden lg:block sticky top-24">
                <div className="rounded-3xl border bg-card/70 backdrop-blur p-4">
                  <button
                    onClick={() => selectCategory(null)}
                    className={`w-full text-left px-3 py-2 rounded-2xl text-sm transition ${!activeCategory ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'}`}
                  >
                    Все товары
                  </button>
                  <div className="mt-3 space-y-1">
                    {setNodes.map(node => {
                      return renderTreeNode(node, 0);
                    })}
                  </div>
                  <div className="mt-4 space-y-1">
                    {singleNodes.map(node => {
                      return renderTreeNode(node, 0);
                    })}
                  </div>
                  <div className="mt-4 pt-3 border-t border-border/60">
                    <button
                      onClick={() => navigate('/about')}
                      className="w-full text-left px-3 py-2 rounded-2xl text-sm transition hover:bg-muted/50"
                    >
                      О нас
                    </button>
                  </div>
                </div>
              </aside>

              <div>
                <div className="lg:hidden mb-4">
                  <select
                    value={activeCategory ?? ''}
                    onChange={(e) => selectCategory(e.target.value || null, false)}
                    className="w-full px-4 py-3 rounded-3xl bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                  >
                    <option value="">Все товары</option>
                    <optgroup label="Наборы">
                      {setCategoryOptions.map(c => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Штучные товары">
                      {singleCategoryOptions.map(c => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <Products
                  activeCategory={activeCategory}
                  categoryFilterMode="hierarchy"
                  onAddToCart={handleAddToCart}
                  productsOverride={products}
                  initialSearch={searchQuery}
                  initialBadge={badgeQuery}
                  initialSort={sortQuery}
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

    </div>
  );
};

export default Catalog;
