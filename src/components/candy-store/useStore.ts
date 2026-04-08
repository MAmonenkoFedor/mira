/* store v2 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { footerData, heroTextData, featureBlocks as defaultFeatureBlocks, aboutData, headerData, getProductBadgeIds, type FeatureBlock, type FooterData, type HeroTextData, type AboutData, type HeaderData, type Product, type Category, type Promo, type Badge, type PackagingOption, type PromoBanner } from './data';

export interface Article {
  id: number;
  title: string;
  excerpt: string;
  content?: string;
  tag: string;
  readTime: string;
  image?: string;
  images?: string[];
  videoUrl?: string | null;
  slug: string;
  productId?: number;
  categoryId?: string;
}

export interface HeroImage { id: number; url: string; link?: string | null; position: number; active: boolean }
export interface OrderItem { id: number; productId?: number; name: string; quantity: number; price: number; packagingId?: string | null; packagingName?: string | null; packagingPrice?: number }
export interface Order {
  id: number;
  total: number;
  discount: number;
  promo?: string;
  contact: { name: string; phone: string; email?: string };
  delivery: { address: string; method: string; payment: string };
  createdAt?: string;
  status?: string;
  deliveryStatus?: string;
  deliveryProvider?: string;
  trackingNumber?: string;
  items: OrderItem[];
}

const defaultArticles: Article[] = [];

const normalizeArticles = (list: Article[]) => {
  const map = new Map<string, Article>();
  for (const a of list) {
    const slug = a.slug ? a.slug : `article-${a.id}`;
    map.set(slug, { ...a, slug });
  }
  for (const a of defaultArticles) {
    const slug = a.slug ? a.slug : `article-${a.id}`;
    if (!map.has(slug)) map.set(slug, a);
  }
  return Array.from(map.values());
};

const normalizeHeroText = (input: unknown): HeroTextData => {
  const data = input && typeof input === 'object' ? (input as Partial<HeroTextData>) : {};
  const floatingCandiesEnabled = typeof data.floatingCandiesEnabled === 'boolean'
    ? data.floatingCandiesEnabled
    : heroTextData.floatingCandiesEnabled;
  const rawCandies = Array.isArray(data.floatingCandies) ? data.floatingCandies : heroTextData.floatingCandies;
  const floatingCandies = rawCandies
    .map(v => String(v).trim())
    .filter(Boolean);
  return {
    ...heroTextData,
    ...data,
    floatingCandiesEnabled,
    floatingCandies: floatingCandies.length ? floatingCandies : heroTextData.floatingCandies,
  };
};

const normalizeAbout = (input: unknown): AboutData => {
  const data = input && typeof input === 'object' ? (input as Partial<AboutData>) : {};
  const rawImages = Array.isArray(data.images) ? data.images : aboutData.images;
  const images = rawImages.map(v => String(v).trim()).filter(Boolean);
  return {
    title: typeof data.title === 'string' ? data.title : aboutData.title,
    subtitle: typeof data.subtitle === 'string' ? data.subtitle : aboutData.subtitle,
    content: typeof data.content === 'string' ? data.content : aboutData.content,
    images: images.length ? images : aboutData.images,
  };
};

const normalizeHeader = (input: unknown): HeaderData => {
  const data = input && typeof input === 'object' ? (input as Partial<HeaderData>) : {};
  const hiddenSections = Array.isArray(data.hiddenSections)
    ? data.hiddenSections.map(v => String(v).trim()).filter(Boolean)
    : headerData.hiddenSections;
  return {
    brandName: typeof data.brandName === 'string' && data.brandName.trim() ? data.brandName.trim() : headerData.brandName,
    brandTextColor: typeof data.brandTextColor === 'string' && data.brandTextColor.trim() ? data.brandTextColor.trim() : headerData.brandTextColor,
    menuButtonBg: typeof data.menuButtonBg === 'string' && data.menuButtonBg.trim() ? data.menuButtonBg.trim() : headerData.menuButtonBg,
    menuButtonTextColor: typeof data.menuButtonTextColor === 'string' && data.menuButtonTextColor.trim() ? data.menuButtonTextColor.trim() : headerData.menuButtonTextColor,
    hiddenSections,
  };
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    const data = raw ? JSON.parse(raw) : fallback;
    if (Array.isArray(fallback) && !Array.isArray(data)) return fallback;
    return data;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function useStore() {
  const [products, setProducts] = useState<Product[]>(() => {
    const loadedRaw = load('candy_products', []);
    const loaded = Array.isArray(loadedRaw) ? loadedRaw : [];
    return loaded as Product[];
  });
  const [categories, setCategories] = useState<Category[]>(() => {
    const loadedRaw = load('candy_categories', []);
    const loaded = Array.isArray(loadedRaw) ? loadedRaw : [];
    return loaded as Category[];
  });
  const [articles, setArticles] = useState<Article[]>(() => {
    const loaded = load('candy_articles', []);
    return normalizeArticles(loaded as Article[]);
  });
  const [heroImages, setHeroImages] = useState<HeroImage[]>(() =>
    load('candy_hero_images', [{ id: 1, url: '/images/hero-sweets.jpg', position: 0, active: true }])
  );
  const [promoBanners, setPromoBanners] = useState<PromoBanner[]>(() =>
    load('candy_promo_banners', [])
  );
  const [badges, setBadges] = useState<Badge[]>(() => load('candy_badges', []));
  const [packagingOptions, setPackagingOptions] = useState<PackagingOption[]>(() => {
    const loadedRaw = load('candy_packaging', []);
    const loaded = Array.isArray(loadedRaw) ? loadedRaw : [];
    return loaded as PackagingOption[];
  });
  const [orders, setOrders] = useState<Order[]>(() => load('candy_orders', []));
  const [favorites, setFavorites] = useState<number[]>(() => {
    const loaded = load('candy_favorites', []);
    return Array.isArray(loaded) ? loaded.map((v: unknown) => Number(v)).filter(v => Number.isFinite(v)) : [];
  });
  const [footer, setFooter] = useState<FooterData>(() => load('candy_footer', footerData));
  const [header, setHeader] = useState<HeaderData>(() => normalizeHeader(load('candy_header', headerData)));
  const [heroText, setHeroText] = useState<HeroTextData>(() => normalizeHeroText(load('candy_hero_text', heroTextData)));
  const [featureBlocks, setFeatureBlocks] = useState<FeatureBlock[]>(() => load('candy_feature_blocks', defaultFeatureBlocks));
  const [about, setAbout] = useState<AboutData>(() => normalizeAbout(load('candy_about', aboutData)));
  const [apiReady, setApiReady] = useState<boolean>(false);
  const [promos, setPromos] = useState<Promo[]>([]);

  useEffect(() => save('candy_products', products), [products]);
  useEffect(() => save('candy_categories', categories), [categories]);
  useEffect(() => save('candy_articles', articles), [articles]);
  useEffect(() => save('candy_hero_images', heroImages), [heroImages]);
  useEffect(() => save('candy_promo_banners', promoBanners), [promoBanners]);
  useEffect(() => save('candy_badges', badges), [badges]);
  useEffect(() => save('candy_packaging', packagingOptions), [packagingOptions]);
  useEffect(() => save('candy_orders', orders), [orders]);
  useEffect(() => save('candy_favorites', favorites), [favorites]);
  useEffect(() => save('candy_footer', footer), [footer]);
  useEffect(() => save('candy_header', header), [header]);
  useEffect(() => save('candy_hero_text', heroText), [heroText]);
  useEffect(() => save('candy_feature_blocks', featureBlocks), [featureBlocks]);
  useEffect(() => save('candy_about', about), [about]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cats = await api.getCategories();
        const [prods, arts, prms, hImgs, ftr, hdr, packs, prBanners, hText, fBlocks, aboutDataApi] = await Promise.all([
          api.getProducts(),
          api.getArticles(),
          api.getPromos().catch(() => []),
          api.getHeroImages().catch(() => null),
          api.getFooter().catch(() => null),
          api.getHeader().catch(() => null),
          api.getPackagingOptions().catch(() => null),
          api.getPromoBanners().catch(() => null),
          api.getHeroText().catch(() => null),
          api.getFeatureBlocks().catch(() => null),
          api.getAbout().catch(() => null),
        ]);
        if (!active) return;
        if (Array.isArray(cats)) setCategories(cats as Category[]);
        if (Array.isArray(prods)) setProducts(prods as Product[]);
        if (Array.isArray(arts)) {
          setArticles(normalizeArticles(arts as Article[]));
        }
        setPromos(prms as Promo[]);
        if (Array.isArray(hImgs) && hImgs.length) {
          setHeroImages(hImgs);
        }
        if (Array.isArray(prBanners)) {
          setPromoBanners(prBanners);
        }
        if (ftr) {
          setFooter(ftr as FooterData);
        }
        if (hdr) {
          setHeader(normalizeHeader(hdr));
        }
        if (hText) {
          setHeroText(normalizeHeroText(hText));
        }
        if (Array.isArray(fBlocks) && fBlocks.length) {
          setFeatureBlocks(fBlocks as FeatureBlock[]);
        }
        if (aboutDataApi) {
          setAbout(normalizeAbout(aboutDataApi));
        }
        if (Array.isArray(packs)) {
          setPackagingOptions(packs as PackagingOption[]);
        }
        setApiReady(true);
      } catch {
        setApiReady(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!apiReady || !getToken()) return;
    (async () => {
      try {
        const list = await api.getOrders();
        setOrders(list as Order[]);
      } catch {}
    })();
  }, [apiReady]);

  const refreshArticlesFromApi = useCallback(async () => {
    const list = await api.getArticles();
    setArticles(list as Article[]);
  }, []);
  const refreshCategoriesFromApi = useCallback(async () => {
    const list = await api.getCategories();
    setCategories(list as Category[]);
  }, []);

  // Products
  const addProduct = useCallback(async (p: Omit<Product, 'id'>) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    const { id } = await api.addProduct(p) as { id: number };
    setProducts(prev => [...prev, { ...p, id }]);
  }, [apiReady]);
  const updateProduct = useCallback(async (id: number, data: Partial<Product>) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    await api.updateProduct(id, data);
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  }, [apiReady]);
  const deleteProduct = useCallback(async (id: number) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    await api.deleteProduct(id);
    setProducts(prev => prev.filter(p => p.id !== id));
  }, [apiReady]);

  // Categories
  const addCategory = useCallback(async (c: Omit<Category, 'id'> & { id?: string }) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    const id = c.id || `cat_${Date.now()}`;
    await api.addCategory({ ...c, id });
    await refreshCategoriesFromApi();
  }, [apiReady, refreshCategoriesFromApi]);
  const updateCategory = useCallback(async (id: string, data: Partial<Category>) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    await api.updateCategory(id, data);
    await refreshCategoriesFromApi();
  }, [apiReady, refreshCategoriesFromApi]);
  const deleteCategory = useCallback(async (id: string) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    await api.deleteCategory(id);
    await refreshCategoriesFromApi();
  }, [apiReady, refreshCategoriesFromApi]);

  // Packaging
  const addPackagingOption = useCallback(async (p: PackagingOption) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    await api.addPackagingOption(p);
    setPackagingOptions(prev => {
      if (prev.find(x => x.id === p.id)) return prev;
      return [...prev, p];
    });
  }, [apiReady]);
  const updatePackagingOption = useCallback(async (id: string, data: Partial<PackagingOption>) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    await api.updatePackagingOption(id, data);
    setPackagingOptions(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  }, [apiReady]);
  const deletePackagingOption = useCallback(async (id: string) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    await api.deletePackagingOption(id);
    setPackagingOptions(prev => prev.filter(p => p.id !== id));
  }, [apiReady]);

  // Articles
  const addArticle = useCallback(async (a: Omit<Article, 'id'>) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    await api.addArticle(a);
    await refreshArticlesFromApi();
  }, [apiReady, refreshArticlesFromApi]);
  const updateArticle = useCallback(async (id: number, data: Partial<Article>) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    await api.updateArticle(id, data);
    await refreshArticlesFromApi();
  }, [apiReady, refreshArticlesFromApi]);
  const deleteArticle = useCallback(async (id: number) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    await api.deleteArticle(id);
    await refreshArticlesFromApi();
  }, [apiReady, refreshArticlesFromApi]);

  // Hero images
  const addHeroImage = useCallback(async (data: { url: string; link?: string | null; active?: boolean }) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    const { id } = await api.addHeroImage({ ...data, position: heroImages.length }) as { id: number };
    setHeroImages(prev => [...prev, { id, url: data.url, link: data.link ?? null, position: prev.length, active: data.active ?? true }]);
  }, [apiReady, heroImages.length]);
  const updateHeroImage = useCallback(async (id: number, data: Partial<HeroImage>) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    await api.updateHeroImage(id, data);
    setHeroImages(prev => prev.map(h => h.id === id ? { ...h, ...data } : h).sort((a,b)=> a.position - b.position));
  }, [apiReady]);
  const deleteHeroImage = useCallback(async (id: number) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    await api.deleteHeroImage(id);
    setHeroImages(prev => prev.filter(h => h.id !== id).map((h,i)=> ({ ...h, position: i })));
  }, [apiReady]);

  const addPromoBanner = useCallback(async (data: { url: string; link?: string | null; active?: boolean }) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    const { id } = await api.addPromoBanner({ ...data, position: promoBanners.length }) as { id: number };
    setPromoBanners(prev => [...prev, { id, url: data.url, link: data.link ?? null, position: prev.length, active: data.active ?? true }]);
  }, [apiReady, promoBanners.length]);
  const updatePromoBanner = useCallback(async (id: number, data: Partial<PromoBanner>) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    await api.updatePromoBanner(id, data);
    setPromoBanners(prev => prev.map(h => h.id === id ? { ...h, ...data } : h).sort((a,b)=> a.position - b.position));
  }, [apiReady]);
  const deletePromoBanner = useCallback(async (id: number) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    await api.deletePromoBanner(id);
    setPromoBanners(prev => prev.filter(h => h.id !== id).map((h,i)=> ({ ...h, position: i })));
  }, [apiReady]);

  const resetToDefaults = useCallback(async () => {
    if (!apiReady) throw new Error('503|api_unavailable');
    await api.clearAdminData();
    setProducts([]);
    setCategories([]);
    setArticles([]);
    setHeroImages([]);
    setPromoBanners([]);
    setPromos([]);
    setOrders([]);
    setPackagingOptions([]);
    setFavorites([]);
    setFooter(footerData);
    setHeader(headerData);
    setHeroText(heroTextData);
    setFeatureBlocks(defaultFeatureBlocks);
    setAbout(aboutData);
  }, [apiReady]);

  const addBadge = useCallback((b: Badge) => {
    setBadges(prev => {
      if (prev.find(x => x.id === b.id)) return prev;
      return [...prev, b];
    });
  }, []);

  const updateBadge = useCallback((id: string, data: Partial<Badge>) => {
    setBadges(prev => prev.map(b => b.id === id ? { ...b, ...data } : b));
  }, []);

  const deleteBadge = useCallback((id: string) => {
    setBadges(prev => prev.filter(b => b.id !== id));
    setProducts(prev => prev.map(p => {
      const nextIds = getProductBadgeIds(p).filter(x => x !== id);
      return {
        ...p,
        badge: nextIds.join(',') || undefined,
        badgeIds: nextIds.length ? nextIds : undefined,
      };
    }));
  }, []);

  // Promos
  const addPromo = useCallback(async (p: Omit<Promo, 'id' | 'active'> & { active?: boolean }) => {
    const payload = { ...p, code: p.code.toUpperCase() };
    if (!apiReady) throw new Error('503|api_unavailable');
    const { id } = await api.addPromo(payload) as { id: number };
    setPromos(prev => [...prev, { ...payload, id, active: p.active ?? true } as Promo ]);
  }, [apiReady]);
  const updatePromo = useCallback(async (id: number, data: Partial<Promo>) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    await api.updatePromo(id, data);
    setPromos(prev => prev.map(pr => pr.id === id ? { ...pr, ...data } : pr));
  }, [apiReady]);
  const deletePromo = useCallback(async (id: number) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    await api.deletePromo(id);
    setPromos(prev => prev.filter(pr => pr.id !== id));
  }, [apiReady]);

  const updateOrder = useCallback(async (id: number, data: Partial<Order>) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    if (!getToken()) throw new Error('401|auth_required');
    await api.updateOrder(id, data);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...data } : o));
  }, [apiReady]);

  const toggleFavorite = useCallback((id: number) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(x => x !== id) : [id, ...prev]);
  }, []);

  const isFavorite = useCallback((id: number) => favorites.includes(id), [favorites]);

  const favoriteProducts = useMemo(() => {
    const map = new Map(products.map(p => [p.id, p]));
    return favorites
      .map(id => map.get(id))
      .filter((p): p is Product => Boolean(p && (p.active ?? true)));
  }, [favorites, products]);

  const updateFooter = useCallback(async (data: FooterData) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    await api.updateFooter(data);
    setFooter(data);
  }, [apiReady]);

  const updateHeader = useCallback(async (data: Partial<HeaderData>) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    await api.updateHeader(data);
    setHeader(prev => normalizeHeader({ ...prev, ...data }));
  }, [apiReady]);

  const updateHeroText = useCallback(async (data: HeroTextData) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    await api.updateHeroText(data);
    setHeroText(normalizeHeroText(data));
  }, [apiReady]);

  const updateFeatureBlocks = useCallback(async (blocks: FeatureBlock[]) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    await api.updateFeatureBlocks(blocks);
    setFeatureBlocks(blocks);
  }, [apiReady]);

  const updateAbout = useCallback(async (data: AboutData) => {
    if (!apiReady) throw new Error('503|api_unavailable');
    await api.updateAbout(data);
    setAbout(normalizeAbout(data));
  }, [apiReady]);

  return {
    products, categories, packagingOptions, articles, promos, heroImages, promoBanners, badges, orders, favorites, favoriteProducts, footer, header, heroText, featureBlocks, about,
    addProduct, updateProduct, deleteProduct,
    addCategory, updateCategory, deleteCategory,
    addPackagingOption, updatePackagingOption, deletePackagingOption,
    addArticle, updateArticle, deleteArticle,
    addPromo, updatePromo, deletePromo,
    addHeroImage, updateHeroImage, deleteHeroImage,
    addPromoBanner, updatePromoBanner, deletePromoBanner,
    addBadge, updateBadge, deleteBadge,
    updateOrder,
    toggleFavorite, isFavorite,
    updateFooter,
    updateHeader,
    updateHeroText,
    updateFeatureBlocks,
    updateAbout,
    resetToDefaults,
  };
}
