/* store v2 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { products as defaultProducts, categories as defaultCategories, badges as defaultBadges, packagingOptions as defaultPackagingOptions, footerData, heroTextData, featureBlocks as defaultFeatureBlocks, aboutData, type FeatureBlock, type FooterData, type HeroTextData, type AboutData, type Product, type Category, type Promo, type Badge, type PackagingOption, type PromoBanner } from './data';

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

const defaultArticles: Article[] = [
  {
    id: 1, slug: 'kak-vybrat-sladosti-dlya-detskogo-prazdnika',
    title: 'Как выбрать сладости для детского праздника',
    excerpt: 'Рассказываем, на что обратить внимание при выборе конфет и шоколада для детей: состав, аллергены, возрастные рекомендации и идеи для подарочных наборов.',
    content: 'Детский праздник — это всегда радость, смех и, конечно, сладости. Но как выбрать конфеты и шоколад, которые будут не только вкусными, но и безопасными для ребёнка?\n\n## На что обратить внимание\n\n**Состав.** Читайте этикетки: избегайте продуктов с искусственными красителями (Е102, Е110, Е124), консервантами и трансжирами. Натуральные ингредиенты — залог качества.\n\n**Аллергены.** Орехи, молоко, глютен — самые частые аллергены в сладостях. Если среди гостей есть дети с аллергией, подготовьте безопасные альтернативы.\n\n**Возрастные рекомендации.** До 3 лет лучше избегать шоколада и карамели. Для малышей подойдут фруктовые пастилки и мармелад без сахара.\n\n## Идеи для подарочных наборов\n\n1. **Фруктовая корзинка** — мармелад, пастила, сухофрукты в шоколаде\n2. **Шоколадный сундучок** — молочный шоколад, какао-бобы, шоколадные фигурки\n3. **Мировые сладости** — моти, турецкий лукум, бельгийские трюфели\n\nВ нашем магазине вы найдёте готовые наборы для любого возраста и бюджета. Все сладости проходят контроль качества и имеют сертификаты безопасности.',
    tag: 'Советы', readTime: '5 мин',
  },
  {
    id: 2, slug: 'moti-kitkat-matcha-i-drugie-aziatskie-sladosti',
    title: 'Моти, KitKat матча и другие азиатские сладости',
    excerpt: 'Японские и корейские десерты покоряют Россию. Разбираемся, чем моти отличается от дайфуку и какие вкусы стоит попробовать первыми.',
    content: 'Азиатские сладости — один из главных трендов последних лет. Нежные текстуры, необычные вкусы и красивая подача делают их идеальным подарком и лакомством.\n\n## Моти vs Дайфуку\n\n**Моти** — это рисовое тесто из клейкого риса (мотигомэ). Само по себе оно нейтральное и мягкое, как зефир.\n\n**Дайфуку** — это моти с начинкой. Классическая начинка — паста из красных бобов (анко), но сегодня популярны:\n- Клубника в сливках\n- Манго\n- Матча с белым шоколадом\n- Арахисовая паста\n\n## KitKat по-японски\n\nВ Японии выпущено более 300 вкусов KitKat! Самые интересные:\n- **Матча** — горьковатый зелёный чай\n- **Саке** — с лёгким алкогольным послевкусием\n- **Клубничный чизкейк** — сладкий и сливочный\n- **Васаби** — для самых смелых\n\n## Что попробовать первым?\n\nЕсли вы новичок в азиатских сладостях, начните с клубничного моти и матча KitKat — это самые «дружелюбные» вкусы для европейского нёба.',
    tag: 'Обзор', readTime: '4 мин',
  },
  {
    id: 3, slug: 'shokolad-polza-ili-vred-dlya-rebyonka',
    title: 'Шоколад: польза или вред для ребёнка?',
    excerpt: 'Педиатры советуют вводить шоколад в рацион постепенно. Узнайте, с какого возраста, в каком количестве и какой шоколад лучше выбирать.',
    content: 'Шоколад — один из самых любимых десертов в мире. Но когда речь идёт о детях, у родителей возникает множество вопросов.\n\n## С какого возраста можно давать шоколад?\n\nБольшинство педиатров рекомендуют:\n- **До 1,5 лет** — никакого шоколада\n- **1,5–3 года** — можно попробовать белый шоколад (без кофеина)\n- **С 3 лет** — молочный шоколад в небольших количествах (до 25 г в день)\n- **С 7 лет** — можно пробовать тёмный шоколад\n\n## Польза шоколада\n\n**Тёмный шоколад (70%+ какао)** содержит:\n- Антиоксиданты (флавоноиды)\n- Магний и железо\n- Теобромин — мягко стимулирует нервную систему\n\n## Возможный вред\n\n- **Кариес** — сахар в молочном шоколаде опасен для зубов\n- **Аллергия** — какао-бобы могут вызвать реакцию\n- **Перевозбуждение** — кофеин и теобромин могут нарушать сон\n\n## Какой шоколад выбрать?\n\nИщите шоколад с коротким составом: какао-масло, какао тёртое, сахар. Без пальмового масла, без ароматизаторов. В нашем магазине все шоколадные изделия проходят строгий отбор по составу.',
    tag: 'Здоровье', readTime: '6 мин',
  },
  {
    id: 4, slug: 'dostavka',
    title: 'Доставка сладостей: быстро и удобно',
    excerpt: 'Сроки, варианты и правила доставки по Москве и России. Рассказываем, как всё организовано.',
    content: 'Мы доставляем заказы по Москве и регионам России — быстро и бережно.\n\n## Варианты доставки\n\n- **Курьер по Москве** — от 1 дня\n- **ПВЗ по России** — от 2–4 дней\n\n## Как мы упаковываем\n\nКаждый набор надёжно фиксируется, чтобы сладости доехали в идеальном виде. Для жаркого сезона добавляем термопакеты.\n\n## Отслеживание\n\nПосле отправки вы получаете трек-номер и можете следить за статусом посылки.',
    tag: 'Новости', readTime: '3 мин',
  },
  {
    id: 5, slug: 'naturalnyy-sostav',
    title: 'Натуральный состав и качество',
    excerpt: 'Без лишних добавок и искусственных красителей. В составе только качественные ингредиенты.',
    content: 'Мы выбираем ингредиенты, которые подходят детям и безопасны для ежедневных угощений.\n\n## Что внутри\n\n- натуральные ароматизаторы\n- качественное какао и молоко\n- минимум сахара там, где это возможно\n\n## Контроль качества\n\nПоставщики проходят отбор, а каждая партия проверяется на свежесть и соблюдение условий хранения.',
    tag: 'Советы', readTime: '4 мин',
  },
  {
    id: 6, slug: 'podarochnaya-upakovka',
    title: 'Подарочная упаковка',
    excerpt: 'Как мы оформляем наборы, чтобы подарок выглядел празднично и радовал получателя.',
    content: 'Подарочная упаковка — это часть впечатления. Мы используем плотные коробки, аккуратные ленты и тематические открытки.\n\n## Что входит\n\n- фирменная коробка\n- декоративная лента\n- открытка с пожеланием\n\nЕсли нужен особый стиль или цвет, напишите в комментарии к заказу.',
    tag: 'Обзор', readTime: '3 мин',
  },
  {
    id: 7, slug: 'sdelano-s-lyubovyu',
    title: 'Сделано с любовью',
    excerpt: 'Немного о ручной работе кондитеров и о том, почему это важно для вкуса.',
    content: 'Наши наборы собираются вручную: от подбора вкусов до финальной упаковки.\n\n## Почему это важно\n\nРучная работа позволяет контролировать качество каждой позиции и создавать красивые, гармоничные наборы. Мы уделяем внимание деталям и гарантируем свежесть каждого изделия.',
    tag: 'Рецепты', readTime: '2 мин',
  },
];

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
    const loadedRaw = load('candy_products', defaultProducts);
    const loaded = Array.isArray(loadedRaw) ? loadedRaw : defaultProducts;
    return loaded as Product[];
  });
  const [categories, setCategories] = useState<Category[]>(() => {
    const loadedRaw = load('candy_categories', defaultCategories);
    const loaded = Array.isArray(loadedRaw) ? loadedRaw : defaultCategories;
    const map = new Map<string, Category>();
    for (const c of loaded as Category[]) map.set(c.id, c);
    for (const c of defaultCategories) {
      if (!map.has(c.id)) map.set(c.id, c);
    }
    return Array.from(map.values());
  });
  const [articles, setArticles] = useState<Article[]>(() => {
    const loaded = load('candy_articles', defaultArticles);
    return normalizeArticles(loaded as Article[]);
  });
  const [heroImages, setHeroImages] = useState<HeroImage[]>(() =>
    load('candy_hero_images', [{ id: 1, url: '/images/hero-sweets.jpg', position: 0, active: true }])
  );
  const [promoBanners, setPromoBanners] = useState<PromoBanner[]>(() =>
    load('candy_promo_banners', [])
  );
  const [badges, setBadges] = useState<Badge[]>(() => load('candy_badges', defaultBadges));
  const [packagingOptions, setPackagingOptions] = useState<PackagingOption[]>(() => {
    const loadedRaw = load('candy_packaging', defaultPackagingOptions);
    const loaded = Array.isArray(loadedRaw) ? loadedRaw : defaultPackagingOptions;
    return loaded as PackagingOption[];
  });
  const [orders, setOrders] = useState<Order[]>(() => load('candy_orders', []));
  const [favorites, setFavorites] = useState<number[]>(() => {
    const loaded = load('candy_favorites', []);
    return Array.isArray(loaded) ? loaded.map((v: unknown) => Number(v)).filter(v => Number.isFinite(v)) : [];
  });
  const [footer, setFooter] = useState<FooterData>(() => load('candy_footer', footerData));
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
  useEffect(() => save('candy_hero_text', heroText), [heroText]);
  useEffect(() => save('candy_feature_blocks', featureBlocks), [featureBlocks]);
  useEffect(() => save('candy_about', about), [about]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [cats, prods, arts, prms, hImgs, ftr, packs, prBanners, hText, fBlocks, aboutDataApi] = await Promise.all([
          api.getCategories(),
          api.getProducts(),
          api.getArticles(),
          api.getPromos().catch(() => []),
          api.getHeroImages().catch(() => null),
          api.getFooter().catch(() => null),
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

  // Products
  const addProduct = useCallback(async (p: Omit<Product, 'id'>) => {
    if (apiReady) {
      const { id } = await api.addProduct(p) as { id: number };
      setProducts(prev => [...prev, { ...p, id }]);
    } else {
      setProducts(prev => {
        const id = prev.length ? Math.max(...prev.map(x => x.id)) + 1 : 1;
        return [...prev, { ...p, id }];
      });
    }
  }, [apiReady]);
  const updateProduct = useCallback(async (id: number, data: Partial<Product>) => {
    if (apiReady) {
      await api.updateProduct(id, data);
    }
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  }, [apiReady]);
  const deleteProduct = useCallback(async (id: number) => {
    if (apiReady) {
      await api.deleteProduct(id);
    }
    setProducts(prev => prev.filter(p => p.id !== id));
  }, [apiReady]);

  // Categories
  const addCategory = useCallback(async (c: Omit<Category, 'id'> & { id?: string }) => {
    const id = c.id || `cat_${Date.now()}`;
    if (apiReady) {
      await api.addCategory({ ...c, id });
    }
    setCategories(prev => {
      if (prev.find(x => x.id === id)) return prev;
      return [...prev, { ...c, id }];
    });
  }, [apiReady]);
  const updateCategory = useCallback(async (id: string, data: Partial<Category>) => {
    if (apiReady) {
      await api.updateCategory(id, data);
    }
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  }, [apiReady]);
  const deleteCategory = useCallback(async (id: string) => {
    if (apiReady) {
      await api.deleteCategory(id);
    }
    setCategories(prev => prev.filter(c => c.id !== id));
  }, [apiReady]);

  // Packaging
  const addPackagingOption = useCallback(async (p: PackagingOption) => {
    if (apiReady) {
      await api.addPackagingOption(p);
    }
    setPackagingOptions(prev => {
      if (prev.find(x => x.id === p.id)) return prev;
      return [...prev, p];
    });
  }, [apiReady]);
  const updatePackagingOption = useCallback(async (id: string, data: Partial<PackagingOption>) => {
    if (apiReady) {
      await api.updatePackagingOption(id, data);
    }
    setPackagingOptions(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  }, [apiReady]);
  const deletePackagingOption = useCallback(async (id: string) => {
    if (apiReady) {
      await api.deletePackagingOption(id);
    }
    setPackagingOptions(prev => prev.filter(p => p.id !== id));
  }, [apiReady]);

  // Articles
  const addArticle = useCallback(async (a: Omit<Article, 'id'>) => {
    if (apiReady) {
      await api.addArticle(a);
      const list = await api.getArticles();
      setArticles(list as Article[]);
    } else {
      setArticles(prev => {
        const id = prev.length ? Math.max(...prev.map(x => x.id)) + 1 : 1;
        return [...prev, { ...a, id }];
      });
    }
  }, [apiReady]);
  const updateArticle = useCallback(async (id: number, data: Partial<Article>) => {
    if (apiReady) {
      await api.updateArticle(id, data);
      const list = await api.getArticles();
      setArticles(list as Article[]);
    } else {
      setArticles(prev => prev.map(a => a.id === id ? { ...a, ...data } : a));
    }
  }, [apiReady]);
  const deleteArticle = useCallback(async (id: number) => {
    if (apiReady) {
      await api.deleteArticle(id);
      const list = await api.getArticles();
      setArticles(list as Article[]);
    } else {
      setArticles(prev => prev.filter(a => a.id !== id));
    }
  }, [apiReady]);

  // Hero images
  const addHeroImage = useCallback(async (data: { url: string; link?: string | null; active?: boolean }) => {
    if (apiReady) {
      const { id } = await api.addHeroImage({ ...data, position: heroImages.length }) as { id: number };
      setHeroImages(prev => [...prev, { id, url: data.url, link: data.link ?? null, position: prev.length, active: data.active ?? true }]);
    } else {
      setHeroImages(prev => {
        const id = prev.length ? Math.max(...prev.map(x => x.id)) + 1 : 1;
        return [...prev, { id, url: data.url, link: data.link ?? null, position: prev.length, active: data.active ?? true }];
      });
    }
  }, [apiReady, heroImages.length]);
  const updateHeroImage = useCallback(async (id: number, data: Partial<HeroImage>) => {
    if (apiReady) {
      await api.updateHeroImage(id, data);
    }
    setHeroImages(prev => prev.map(h => h.id === id ? { ...h, ...data } : h).sort((a,b)=> a.position - b.position));
  }, [apiReady]);
  const deleteHeroImage = useCallback(async (id: number) => {
    if (apiReady) {
      await api.deleteHeroImage(id);
    }
    setHeroImages(prev => prev.filter(h => h.id !== id).map((h,i)=> ({ ...h, position: i })));
  }, [apiReady]);

  const addPromoBanner = useCallback(async (data: { url: string; link?: string | null; active?: boolean }) => {
    if (apiReady) {
      const { id } = await api.addPromoBanner({ ...data, position: promoBanners.length }) as { id: number };
      setPromoBanners(prev => [...prev, { id, url: data.url, link: data.link ?? null, position: prev.length, active: data.active ?? true }]);
    } else {
      setPromoBanners(prev => {
        const id = prev.length ? Math.max(...prev.map(x => x.id)) + 1 : 1;
        return [...prev, { id, url: data.url, link: data.link ?? null, position: prev.length, active: data.active ?? true }];
      });
    }
  }, [apiReady, promoBanners.length]);
  const updatePromoBanner = useCallback(async (id: number, data: Partial<PromoBanner>) => {
    if (apiReady) {
      await api.updatePromoBanner(id, data);
    }
    setPromoBanners(prev => prev.map(h => h.id === id ? { ...h, ...data } : h).sort((a,b)=> a.position - b.position));
  }, [apiReady]);
  const deletePromoBanner = useCallback(async (id: number) => {
    if (apiReady) {
      await api.deletePromoBanner(id);
    }
    setPromoBanners(prev => prev.filter(h => h.id !== id).map((h,i)=> ({ ...h, position: i })));
  }, [apiReady]);

  const resetToDefaults = useCallback(() => {
    setProducts(defaultProducts);
    setCategories(defaultCategories);
    setArticles(defaultArticles);
    setHeroImages([{ id: 1, url: '/images/hero-sweets.jpg', position: 0, active: true }]);
    setPromoBanners([]);
    setBadges(defaultBadges);
    setOrders([]);
    setFavorites([]);
    setFooter(footerData);
    setHeroText(heroTextData);
    setFeatureBlocks(defaultFeatureBlocks);
    setAbout(aboutData);
  }, []);

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
    setProducts(prev => prev.map(p => p.badge === id ? { ...p, badge: undefined } : p));
  }, []);

  // Promos
  const addPromo = useCallback(async (p: Omit<Promo, 'id' | 'active'> & { active?: boolean }) => {
    const payload = { ...p, code: p.code.toUpperCase() };
    if (apiReady) {
      const { id } = await api.addPromo(payload) as { id: number };
      setPromos(prev => [...prev, { ...payload, id, active: p.active ?? true } as Promo ]);
    } else {
      setPromos(prev => {
        const id = prev.length ? Math.max(...prev.map(x => x.id)) + 1 : 1;
        return [...prev, { ...payload, id, active: p.active ?? true } as Promo];
      });
    }
  }, [apiReady]);
  const updatePromo = useCallback(async (id: number, data: Partial<Promo>) => {
    if (apiReady) {
      await api.updatePromo(id, data);
    }
    setPromos(prev => prev.map(pr => pr.id === id ? { ...pr, ...data } : pr));
  }, [apiReady]);
  const deletePromo = useCallback(async (id: number) => {
    if (apiReady) {
      await api.deletePromo(id);
    }
    setPromos(prev => prev.filter(pr => pr.id !== id));
  }, [apiReady]);

  const updateOrder = useCallback(async (id: number, data: Partial<Order>) => {
    if (apiReady && getToken()) {
      await api.updateOrder(id, data);
    }
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
    if (apiReady) {
      await api.updateFooter(data);
    }
    setFooter(data);
  }, [apiReady]);

  const updateHeroText = useCallback(async (data: HeroTextData) => {
    if (apiReady) {
      await api.updateHeroText(data);
    }
    setHeroText(normalizeHeroText(data));
  }, [apiReady]);

  const updateFeatureBlocks = useCallback(async (blocks: FeatureBlock[]) => {
    if (apiReady) {
      await api.updateFeatureBlocks(blocks);
    }
    setFeatureBlocks(blocks);
  }, [apiReady]);

  const updateAbout = useCallback(async (data: AboutData) => {
    if (apiReady) {
      await api.updateAbout(data);
    }
    setAbout(normalizeAbout(data));
  }, [apiReady]);

  return {
    products, categories, packagingOptions, articles, promos, heroImages, promoBanners, badges, orders, favorites, favoriteProducts, footer, heroText, featureBlocks, about,
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
    updateHeroText,
    updateFeatureBlocks,
    updateAbout,
    resetToDefaults,
  };
}
