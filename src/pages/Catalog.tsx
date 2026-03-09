import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import Header from '@/components/candy-store/Header';
import Products from '@/components/candy-store/Products';
import CartDrawer from '@/components/candy-store/CartDrawer';
import Checkout from '@/components/candy-store/Checkout';
import Footer from '@/components/candy-store/Footer';
import { useStore } from '@/components/candy-store/useStore';
import { useCart } from '@/components/candy-store/useCart';
import { useReveal } from '@/components/candy-store/useReveal';
import type { Product, Category } from '@/components/candy-store/data';

const Catalog = () => {
  const cart = useCart();
  const revealRef = useReveal();
  const { products, categories } = useStore();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const handleAddToCart = useCallback((product: Product, qty = 1, packagingId?: string | null) => {
    cart.addItem(product, qty, packagingId);
    toast.success('Добавлено!', { description: product.name, duration: 2000 });
  }, [cart]);

  type Node = { category: Category; children: Node[] };

  const tree = useMemo(() => {
    const list = categories.filter(c => Boolean(c?.id));
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
  }, [categories]);

  const selectCategory = useCallback((id: string | null, toggle = true) => {
    setActiveCategory(prev => (toggle && prev === id ? null : id));
    setTimeout(() => {
      document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  const activeTopId = activeCategory ? activeCategory.split('/')[0] : null;
  const setIds = useMemo(() => new Set(['gift', 'chocolate', 'truffles', 'asian', 'cookies']), []);
  const isSetNode = useCallback((n: Node) => n.category.group === 'set' || (!n.category.group && setIds.has(n.category.id)), [setIds]);
  const setNodes = useMemo(() => tree.filter(n => isSetNode(n)), [tree, isSetNode]);
  const singleNodes = useMemo(() => tree.filter(n => !isSetNode(n)), [tree, isSetNode]);

  return (
    <div ref={revealRef} className="min-h-screen">
      <Header cartCount={cart.count} onCartClick={() => cart.setIsCartOpen(true)} />

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
                  <div className="font-display font-semibold mb-3">Категории</div>
                  <button
                    onClick={() => selectCategory(null)}
                    className={`w-full text-left px-3 py-2 rounded-2xl text-sm transition ${!activeCategory ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'}`}
                  >
                    Все товары
                  </button>
                  <div className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">Наборы</div>
                  <div className="mt-2 space-y-1">
                    {setNodes.map(node => {
                      const renderNode = (n: Node, depth: number) => (
                        <div key={n.category.id}>
                          <button
                            onClick={() => selectCategory(n.category.id)}
                            className={`w-full text-left rounded-2xl text-sm transition ${
                              (depth === 0 ? (activeTopId === n.category.id || activeCategory === n.category.id) : activeCategory === n.category.id)
                                ? 'bg-primary/10 text-primary'
                                : 'hover:bg-muted/50'
                            }`}
                            style={{ paddingLeft: `${12 + depth * 12}px`, paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px' }}
                          >
                            {n.category.emoji ? `${n.category.emoji} ` : ''}{n.category.name}
                          </button>
                          {n.children.length > 0 && (
                            <div className="mt-1 space-y-1">
                              {n.children.map(child => renderNode(child, depth + 1))}
                            </div>
                          )}
                        </div>
                      );

                      return renderNode(node, 0);
                    })}
                  </div>
                  <div className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">Штучные товары</div>
                  <div className="mt-2 space-y-1">
                    {singleNodes.map(node => {
                      const renderNode = (n: Node, depth: number) => (
                        <div key={n.category.id}>
                          <button
                            onClick={() => selectCategory(n.category.id)}
                            className={`w-full text-left rounded-2xl text-sm transition ${
                              (depth === 0 ? (activeTopId === n.category.id || activeCategory === n.category.id) : activeCategory === n.category.id)
                                ? 'bg-primary/10 text-primary'
                                : 'hover:bg-muted/50'
                            }`}
                            style={{ paddingLeft: `${12 + depth * 12}px`, paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px' }}
                          >
                            {n.category.emoji ? `${n.category.emoji} ` : ''}{n.category.name}
                          </button>
                          {n.children.length > 0 && (
                            <div className="mt-1 space-y-1">
                              {n.children.map(child => renderNode(child, depth + 1))}
                            </div>
                          )}
                        </div>
                      );

                      return renderNode(node, 0);
                    })}
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
                      {setNodes.flatMap(node => {
                        const out: { id: string; label: string }[] = [];
                        const walk = (n: Node, depth: number) => {
                          out.push({
                            id: n.category.id,
                            label: `${'— '.repeat(depth)}${n.category.emoji ? `${n.category.emoji} ` : ''}${n.category.name}`,
                          });
                          n.children.forEach(child => walk(child, depth + 1));
                        };
                        walk(node, 0);
                        return out;
                      }).map(c => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Штучные товары">
                      {singleNodes.flatMap(node => {
                        const out: { id: string; label: string }[] = [];
                        const walk = (n: Node, depth: number) => {
                          out.push({
                            id: n.category.id,
                            label: `${'— '.repeat(depth)}${n.category.emoji ? `${n.category.emoji} ` : ''}${n.category.name}`,
                          });
                          n.children.forEach(child => walk(child, depth + 1));
                        };
                        walk(node, 0);
                        return out;
                      }).map(c => (
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
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      <CartDrawer
        open={cart.isCartOpen}
        onClose={() => cart.setIsCartOpen(false)}
        items={cart.items}
        subtotal={cart.subtotal}
        discount={cart.discount}
        total={cart.total}
        promoCode={cart.promoCode}
        onUpdateQty={cart.updateQuantity}
        onUpdatePackaging={cart.updatePackaging}
        onRemove={cart.removeItem}
        onApplyPromo={cart.applyPromo}
        onCheckout={() => { cart.setIsCartOpen(false); cart.setIsCheckoutOpen(true); }}
      />

      <Checkout
        open={cart.isCheckoutOpen}
        onClose={() => cart.setIsCheckoutOpen(false)}
        total={cart.total}
        onPlaceOrder={cart.placeOrder}
      />
    </div>
  );
};

export default Catalog;
