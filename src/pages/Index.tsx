import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import Header from '@/components/candy-store/Header';
import Hero from '@/components/candy-store/Hero';
import Categories from '@/components/candy-store/Categories';
import Products from '@/components/candy-store/Products';
import ProductModal from '@/components/candy-store/ProductModal';
import CartDrawer from '@/components/candy-store/CartDrawer';
import Checkout from '@/components/candy-store/Checkout';
import Reviews from '@/components/candy-store/Reviews';
import Benefits from '@/components/candy-store/Benefits';
import Articles from '@/components/candy-store/Articles';
import PromoBanner from '@/components/candy-store/PromoBanner';
import ContactForm from '@/components/candy-store/ContactForm';
import Footer from '@/components/candy-store/Footer';
import { useCart } from '@/components/candy-store/useCart';
import { useReveal } from '@/components/candy-store/useReveal';
import type { Product } from '@/components/candy-store/data';

const Index = () => {
  const cart = useCart();
  const revealRef = useReveal();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Listen for category filter from Hero
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setActiveCategory(detail);
    };
    window.addEventListener('filter-category', handler);
    return () => window.removeEventListener('filter-category', handler);
  }, []);

  const handleAddToCart = useCallback((product: Product, qty = 1) => {
    cart.addItem(product, qty);
    toast.success('Добавлено!', {
      description: product.name,
      duration: 2000,
    });
  }, [cart]);

  const handlePromoApply = useCallback(() => {
    cart.applyPromo('SWEET15');
    cart.setIsCartOpen(true);
    toast.success('Промокод SWEET15 применён!');
  }, [cart]);

  return (
    <div ref={revealRef} className="min-h-screen">
      <Header cartCount={cart.count} onCartClick={() => cart.setIsCartOpen(true)} />

      <main>
        <Hero />
        <Categories activeCategory={activeCategory} onSelect={setActiveCategory} />
        <Products
          activeCategory={activeCategory}
          onAddToCart={handleAddToCart}
          onProductClick={setSelectedProduct}
        />
        <Reviews />
        <Benefits />
        <Articles />
        <PromoBanner onApplyPromo={handlePromoApply} />
        <ContactForm />
      </main>

      <Footer />

      {/* Modals / Drawers */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAdd={handleAddToCart}
        />
      )}

      <CartDrawer
        open={cart.isCartOpen}
        onClose={() => cart.setIsCartOpen(false)}
        items={cart.items}
        subtotal={cart.subtotal}
        discount={cart.discount}
        total={cart.total}
        promoCode={cart.promoCode}
        onUpdateQty={cart.updateQuantity}
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

export default Index;
