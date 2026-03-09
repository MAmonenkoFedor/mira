import { useState, useCallback, useEffect } from 'react';
import { Product, type Promo } from './data';
import { api } from '@/lib/api';

export interface CartItem {
  product: Product;
  quantity: number;
  packagingId?: string | null;
  packagingName?: string | null;
  packagingPrice?: number | null;
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
const PACKAGING_KEY = 'candy_packaging';

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCart(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

function loadPackaging(): { id: string; name: string; price: number; active: boolean }[] {
  try {
    const raw = localStorage.getItem(PACKAGING_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function resolvePackagingById(id?: string | null) {
  if (!id) return null;
  const list = loadPackaging();
  const found = list.find(p => p && p.id === id);
  if (!found) return null;
  return { id: String(found.id), name: String(found.name), price: Math.round(Number(found.price) || 0) };
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(loadCart);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [selectedPromo, setSelectedPromo] = useState<Promo | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  useEffect(() => { saveCart(items); }, [items]);

  const addItem = useCallback((product: Product, qty = 1, packagingId?: string | null) => {
    const desiredPackagingId =
      packagingId !== undefined
        ? packagingId
        : product.packagingMode === 'standard'
          ? (product.standardPackagingId ?? null)
          : null;
    setItems(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        return prev.map(i => i.product.id === product.id ? {
          ...i,
          quantity: i.quantity + qty,
          packagingId: desiredPackagingId ?? null,
        } : i);
      }
      return [...prev, {
        product,
        quantity: qty,
        packagingId: desiredPackagingId ?? null,
      }];
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

  const updatePackaging = useCallback((productId: number, packagingId: string | null) => {
    setItems(prev => prev.map(i => i.product.id === productId ? {
      ...i,
      packagingId,
    } : i));
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

  const productsSubtotal = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const packagingSubtotal = items.reduce((s, i) => {
    const unit = i.packagingId ? (resolvePackagingById(i.packagingId)?.price ?? i.packagingPrice ?? 0) : 0;
    return s + unit * i.quantity;
  }, 0);
  const subtotal = productsSubtotal + packagingSubtotal;
  let eligible = 0;
  if (selectedPromo) {
    if (selectedPromo.scope === 'all') {
      eligible = productsSubtotal;
    } else if (selectedPromo.scope === 'category') {
      const cats = new Set(selectedPromo.categories || []);
      eligible = items.reduce((s, i) => {
        const anyP = i.product as any;
        const list: string[] = Array.isArray(anyP?.categories) && anyP.categories.length
          ? anyP.categories.filter(Boolean).map((x: unknown) => String(x))
          : (anyP?.category ? [String(anyP.category)] : []);
        const ok = list.some(c => cats.has(c));
        return s + (ok ? i.product.price * i.quantity : 0);
      }, 0);
    } else if (selectedPromo.scope === 'product') {
      const ids = new Set(selectedPromo.products || []);
      eligible = items.reduce((s, i) => s + (ids.has(i.product.id) ? i.product.price * i.quantity : 0), 0);
    }
  }
  const discount = selectedPromo ? Math.round(eligible * (selectedPromo.percent / 100)) : 0;
  const total = productsSubtotal + packagingSubtotal - discount;
  const count = items.reduce((s, i) => s + i.quantity, 0);

  const placeOrder = useCallback((contact: { name: string; phone: string }, delivery: { address: string; method: string; payment: string }) => {
    const itemsSnapshot: CartItem[] = items.map(i => {
      const pack = i.packagingId ? resolvePackagingById(i.packagingId) : null;
      if (!pack) {
        return {
          ...i,
          packagingId: null,
          packagingName: null,
          packagingPrice: 0,
        };
      }
      return {
        ...i,
        packagingId: pack.id,
        packagingName: pack.name,
        packagingPrice: pack.price,
      };
    });
    const localOrder: Order = {
      id: String(Math.floor(1000 + Math.random() * 9000)),
      items: itemsSnapshot,
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
          items: itemsSnapshot,
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
    addItem, removeItem, updateQuantity, updatePackaging, clearCart, applyPromo, placeOrder,
    isCartOpen, setIsCartOpen, isCheckoutOpen, setIsCheckoutOpen,
  };
}
