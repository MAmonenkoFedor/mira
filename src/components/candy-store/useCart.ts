import { useState, useCallback, useEffect } from 'react';
import { Product, type Promo } from './data';
import { api } from '@/lib/api';

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  discount: number;
  promo: string | null;
  contact: { name: string; phone: string };
  delivery: { address: string; method: string; payment: string };
  date: string;
}

const CART_KEY = 'candy-store-cart';
const ORDER_KEY = 'candy-store-last-order';

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCart(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(loadCart);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [selectedPromo, setSelectedPromo] = useState<Promo | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  useEffect(() => { saveCart(items); }, [items]);

  const addItem = useCallback((product: Product, qty = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + qty } : i);
      }
      return [...prev, { product, quantity: qty }];
    });
  }, []);

  const removeItem = useCallback((productId: number) => {
    setItems(prev => prev.filter(i => i.product.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(i => i.product.id !== productId));
    } else {
      setItems(prev => prev.map(i => i.product.id === productId ? { ...i, quantity } : i));
    }
  }, []);

  const clearCart = useCallback(() => { setItems([]); setPromoCode(null); setSelectedPromo(null); }, []);

  const applyPromo = useCallback(async (code: string) => {
    const upper = code.toUpperCase();
    try {
      const list = await api.getPromos() as Promo[];
      const found = list.find(p => p.active && p.code.toUpperCase() === upper);
      if (found) {
        setPromoCode(found.code.toUpperCase());
        setSelectedPromo(found);
        return true;
      }
    } catch { /* ignore */ }
    if (upper === 'SWEET15') {
      setPromoCode('SWEET15');
      setSelectedPromo({ id: -1, code: 'SWEET15', percent: 15, scope: 'all', active: true } as any);
      return true;
    } else {
      setPromoCode(null);
      setSelectedPromo(null);
    }
    return false;
  }, []);

  const subtotal = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
  let eligible = 0;
  if (selectedPromo) {
    if (selectedPromo.scope === 'all') {
      eligible = subtotal;
    } else if (selectedPromo.scope === 'category') {
      const cats = new Set(selectedPromo.categories || []);
      eligible = items.reduce((s, i) => s + (cats.has(i.product.category) ? i.product.price * i.quantity : 0), 0);
    } else if (selectedPromo.scope === 'product') {
      const ids = new Set(selectedPromo.products || []);
      eligible = items.reduce((s, i) => s + (ids.has(i.product.id) ? i.product.price * i.quantity : 0), 0);
    }
  }
  const discount = selectedPromo ? Math.round(eligible * (selectedPromo.percent / 100)) : 0;
  const total = subtotal - discount;
  const count = items.reduce((s, i) => s + i.quantity, 0);

  const placeOrder = useCallback((contact: { name: string; phone: string }, delivery: { address: string; method: string; payment: string }) => {
    const localOrder: Order = {
      id: String(Math.floor(1000 + Math.random() * 9000)),
      items: [...items],
      total,
      discount,
      promo: promoCode,
      contact,
      delivery,
      date: new Date().toISOString(),
    };
    (async () => {
      try {
        const res = await api.createOrder({
          items,
          total,
          discount,
          promo: promoCode,
          contact,
          delivery,
        }) as { id?: string | number } | null;
        if (res?.id) {
          localOrder.id = String(res.id);
        }
      } catch (_e) { void 0; }
      localStorage.setItem(ORDER_KEY, JSON.stringify(localOrder));
    })();
    clearCart();
    return localOrder;
  }, [items, total, discount, promoCode, clearCart]);

  return {
    items, count, subtotal, discount, total, promoCode,
    addItem, removeItem, updateQuantity, clearCart, applyPromo, placeOrder,
    isCartOpen, setIsCartOpen, isCheckoutOpen, setIsCheckoutOpen,
  };
}
