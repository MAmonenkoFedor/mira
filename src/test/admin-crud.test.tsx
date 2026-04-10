import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { footerData, heroTextData, headerData, type FeatureBlock } from '@/components/candy-store/data';
import { useStore } from '@/components/candy-store/useStore';

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getCategories: vi.fn(),
    getProducts: vi.fn(),
    getArticles: vi.fn(),
    getPromos: vi.fn(),
    getHeroImages: vi.fn(),
    getFooter: vi.fn(),
    getHeader: vi.fn(),
    getPackagingOptions: vi.fn(),
    getPromoBanners: vi.fn(),
    getHeroText: vi.fn(),
    getFeatureBlocks: vi.fn(),
    getAbout: vi.fn(),
    addProduct: vi.fn(),
    updateProduct: vi.fn(),
    deleteProduct: vi.fn(),
    addCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    addPackagingOption: vi.fn(),
    updatePackagingOption: vi.fn(),
    deletePackagingOption: vi.fn(),
    addArticle: vi.fn(),
    updateArticle: vi.fn(),
    deleteArticle: vi.fn(),
    addPromo: vi.fn(),
    updatePromo: vi.fn(),
    deletePromo: vi.fn(),
    addHeroImage: vi.fn(),
    updateHeroImage: vi.fn(),
    deleteHeroImage: vi.fn(),
    addPromoBanner: vi.fn(),
    updatePromoBanner: vi.fn(),
    deletePromoBanner: vi.fn(),
    updateOrder: vi.fn(),
    updateFooter: vi.fn(),
    updateHeader: vi.fn(),
    updateHeroText: vi.fn(),
    updateFeatureBlocks: vi.fn(),
    updateAbout: vi.fn(),
    getOrders: vi.fn(),
    clearAdminData: vi.fn(),
  },
}));

const { getTokenMock } = vi.hoisted(() => ({
  getTokenMock: vi.fn(() => null),
}));

vi.mock('@/lib/api', () => ({ api: apiMock }));
vi.mock('@/lib/auth', () => ({ getToken: getTokenMock }));

describe('admin crud', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    getTokenMock.mockReturnValue(null);
    let nextProductId = 100;
    let nextArticleId = 100;
    let nextPromoId = 100;
    let nextHeroImageId = 100;
    let nextPromoBannerId = 100;
    let categoriesState: any[] = [];
    let productsState: any[] = [];
    let articlesState: any[] = [];
    let promosState: any[] = [];
    let heroImagesState: any[] = [];
    let promoBannersState: any[] = [];
    let packagingState: any[] = [];

    apiMock.getCategories.mockImplementation(async () => categoriesState);
    apiMock.getProducts.mockImplementation(async () => productsState);
    apiMock.getArticles.mockImplementation(async () => articlesState);
    apiMock.getPromos.mockImplementation(async () => promosState);
    apiMock.getHeroImages.mockImplementation(async () => heroImagesState);
    apiMock.getFooter.mockResolvedValue(null);
    apiMock.getHeader.mockResolvedValue(null);
    apiMock.getPackagingOptions.mockImplementation(async () => packagingState);
    apiMock.getPromoBanners.mockImplementation(async () => promoBannersState);
    apiMock.getHeroText.mockResolvedValue(null);
    apiMock.getFeatureBlocks.mockResolvedValue(null);
    apiMock.getAbout.mockResolvedValue(null);
    apiMock.getOrders.mockImplementation(async () => JSON.parse(localStorage.getItem('candy_orders') || '[]'));

    apiMock.addProduct.mockImplementation(async (payload: any) => {
      const next = { ...payload, id: nextProductId++ };
      productsState = [...productsState, next];
      return { id: next.id };
    });
    apiMock.updateProduct.mockImplementation(async (id: number, data: any) => {
      productsState = productsState.map((p) => (p.id === id ? { ...p, ...data } : p));
    });
    apiMock.deleteProduct.mockImplementation(async (id: number) => {
      productsState = productsState.filter((p) => p.id !== id);
    });

    apiMock.addCategory.mockImplementation(async (payload: any) => {
      categoriesState = [...categoriesState, payload];
    });
    apiMock.updateCategory.mockImplementation(async (id: string, data: any) => {
      categoriesState = categoriesState.map((c) => (c.id === id ? { ...c, ...data } : c));
    });
    apiMock.deleteCategory.mockImplementation(async (id: string) => {
      categoriesState = categoriesState.filter((c) => c.id !== id);
    });

    apiMock.addPackagingOption.mockImplementation(async (payload: any) => {
      packagingState = packagingState.find((p) => p.id === payload.id) ? packagingState : [...packagingState, payload];
    });
    apiMock.updatePackagingOption.mockImplementation(async (id: string, data: any) => {
      packagingState = packagingState.map((p) => (p.id === id ? { ...p, ...data } : p));
    });
    apiMock.deletePackagingOption.mockImplementation(async (id: string) => {
      packagingState = packagingState.filter((p) => p.id !== id);
    });

    apiMock.addArticle.mockImplementation(async (payload: any) => {
      const next = { ...payload, id: nextArticleId++ };
      articlesState = [...articlesState, next];
    });
    apiMock.updateArticle.mockImplementation(async (id: number, data: any) => {
      articlesState = articlesState.map((a) => (a.id === id ? { ...a, ...data } : a));
    });
    apiMock.deleteArticle.mockImplementation(async (id: number) => {
      articlesState = articlesState.filter((a) => a.id !== id);
    });

    apiMock.addPromo.mockImplementation(async (payload: any) => {
      const next = { ...payload, id: nextPromoId++, active: payload.active ?? true };
      promosState = [...promosState, next];
      return { id: next.id };
    });
    apiMock.updatePromo.mockImplementation(async (id: number, data: any) => {
      promosState = promosState.map((p) => (p.id === id ? { ...p, ...data } : p));
    });
    apiMock.deletePromo.mockImplementation(async (id: number) => {
      promosState = promosState.filter((p) => p.id !== id);
    });

    apiMock.addHeroImage.mockImplementation(async (payload: any) => {
      const next = { ...payload, id: nextHeroImageId++ };
      heroImagesState = [...heroImagesState, next];
      return { id: next.id };
    });
    apiMock.updateHeroImage.mockImplementation(async (id: number, data: any) => {
      heroImagesState = heroImagesState.map((h) => (h.id === id ? { ...h, ...data } : h));
    });
    apiMock.deleteHeroImage.mockImplementation(async (id: number) => {
      heroImagesState = heroImagesState.filter((h) => h.id !== id);
    });

    apiMock.addPromoBanner.mockImplementation(async (payload: any) => {
      const next = { ...payload, id: nextPromoBannerId++ };
      promoBannersState = [...promoBannersState, next];
      return { id: next.id };
    });
    apiMock.updatePromoBanner.mockImplementation(async (id: number, data: any) => {
      promoBannersState = promoBannersState.map((b) => (b.id === id ? { ...b, ...data } : b));
    });
    apiMock.deletePromoBanner.mockImplementation(async (id: number) => {
      promoBannersState = promoBannersState.filter((b) => b.id !== id);
    });

    apiMock.updateOrder.mockResolvedValue(undefined);
    apiMock.updateFooter.mockResolvedValue(undefined);
    apiMock.updateHeader.mockResolvedValue(undefined);
    apiMock.updateHeroText.mockResolvedValue(undefined);
    apiMock.updateFeatureBlocks.mockResolvedValue(undefined);
    apiMock.updateAbout.mockResolvedValue(undefined);
    apiMock.clearAdminData.mockResolvedValue(undefined);
  });

  it('handles add, update and delete for products, categories and packaging', async () => {
    const { result } = renderHook(() => useStore());

    await act(async () => {
      await result.current.addProduct({
        name: 'QA Product',
        price: 500,
        description: 'QA',
        image: '/images/qa.jpg',
        popularity: 5,
        active: true,
      });
    });

    const addedProduct = result.current.products.find(p => p.name === 'QA Product');
    expect(addedProduct).toBeTruthy();

    await act(async () => {
      await result.current.updateProduct(addedProduct!.id, { price: 700, name: 'QA Product Updated' });
    });
    expect(result.current.products.find(p => p.id === addedProduct!.id)?.price).toBe(700);

    await act(async () => {
      await result.current.deleteProduct(addedProduct!.id);
    });
    expect(result.current.products.some(p => p.id === addedProduct!.id)).toBe(false);

    await act(async () => {
      await result.current.addCategory({
        id: 'qa_category',
        name: 'QA Category',
        emoji: '🧪',
        color: 'candy-pink',
        group: 'single',
        showOnHome: true,
        homeOrder: 1,
      });
    });
    expect(result.current.categories.some(c => c.id === 'qa_category')).toBe(true);

    await act(async () => {
      await result.current.updateCategory('qa_category', { name: 'QA Category Updated', homeOrder: 2 });
    });
    expect(result.current.categories.find(c => c.id === 'qa_category')?.name).toBe('QA Category Updated');

    await act(async () => {
      await result.current.deleteCategory('qa_category');
    });
    expect(result.current.categories.some(c => c.id === 'qa_category')).toBe(false);

    await act(async () => {
      await result.current.addPackagingOption({
        id: 'qa_pack',
        name: 'QA Box',
        price: 120,
        active: true,
      });
    });
    expect(result.current.packagingOptions.some(p => p.id === 'qa_pack')).toBe(true);

    await act(async () => {
      await result.current.updatePackagingOption('qa_pack', { price: 160 });
    });
    expect(result.current.packagingOptions.find(p => p.id === 'qa_pack')?.price).toBe(160);

    await act(async () => {
      await result.current.deletePackagingOption('qa_pack');
    });
    expect(result.current.packagingOptions.some(p => p.id === 'qa_pack')).toBe(false);
  });

  it('handles add, update and delete for articles, promos, hero images and promo banners', async () => {
    const { result } = renderHook(() => useStore());

    await act(async () => {
      await result.current.addArticle({
        slug: 'qa-article',
        title: 'QA Article',
        excerpt: 'QA Excerpt',
        content: 'QA Content',
        tag: 'Советы',
        readTime: '3 мин',
        image: '/images/qa-article.jpg',
      });
    });
    const article = result.current.articles.find(a => a.slug === 'qa-article');
    expect(article).toBeTruthy();

    await act(async () => {
      await result.current.updateArticle(article!.id, { title: 'QA Article Updated' });
    });
    expect(result.current.articles.find(a => a.id === article!.id)?.title).toBe('QA Article Updated');

    await act(async () => {
      await result.current.deleteArticle(article!.id);
    });
    expect(result.current.articles.some(a => a.id === article!.id)).toBe(false);

    await act(async () => {
      await result.current.addPromo({
        code: 'qa15',
        percent: 15,
        scope: 'all',
      });
    });
    const promo = result.current.promos.find(p => p.code === 'QA15');
    expect(promo).toBeTruthy();

    await act(async () => {
      await result.current.updatePromo(promo!.id, { percent: 20 });
    });
    expect(result.current.promos.find(p => p.id === promo!.id)?.percent).toBe(20);

    await act(async () => {
      await result.current.deletePromo(promo!.id);
    });
    expect(result.current.promos.some(p => p.id === promo!.id)).toBe(false);

    await act(async () => {
      await result.current.addHeroImage({ url: '/images/hero-qa.jpg', active: true });
    });
    const hero = result.current.heroImages.find(h => h.url === '/images/hero-qa.jpg');
    expect(hero).toBeTruthy();

    await act(async () => {
      await result.current.updateHeroImage(hero!.id, { position: 0 });
    });
    expect(result.current.heroImages.some(h => h.id === hero!.id)).toBe(true);

    await act(async () => {
      await result.current.deleteHeroImage(hero!.id);
    });
    expect(result.current.heroImages.some(h => h.id === hero!.id)).toBe(false);

    await act(async () => {
      await result.current.addPromoBanner({ url: '/images/promo-qa.jpg', active: true });
    });
    const banner = result.current.promoBanners.find(b => b.url === '/images/promo-qa.jpg');
    expect(banner).toBeTruthy();

    await act(async () => {
      await result.current.updatePromoBanner(banner!.id, { active: false });
    });
    expect(result.current.promoBanners.find(b => b.id === banner!.id)?.active).toBe(false);

    await act(async () => {
      await result.current.deletePromoBanner(banner!.id);
    });
    expect(result.current.promoBanners.some(b => b.id === banner!.id)).toBe(false);
  });

  it('handles badges and dependent product cleanup', async () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.addBadge({ id: 'qa_badge', label: 'QA', tone: 'primary', active: true });
    });
    expect(result.current.badges.some(b => b.id === 'qa_badge')).toBe(true);

    await act(async () => {
      await result.current.addProduct({
        name: 'Badge Product',
        price: 300,
        description: 'Badge',
        image: '/images/badge.jpg',
        popularity: 3,
        badge: 'qa_badge,sale',
        badgeIds: ['qa_badge', 'sale'],
      });
    });
    const badgeProduct = result.current.products.find(p => p.name === 'Badge Product');
    expect(badgeProduct?.badge).toBe('qa_badge,sale');

    act(() => {
      result.current.updateBadge('qa_badge', { label: 'QA Updated' });
    });
    expect(result.current.badges.find(b => b.id === 'qa_badge')?.label).toBe('QA Updated');

    act(() => {
      result.current.deleteBadge('qa_badge');
    });
    expect(result.current.badges.some(b => b.id === 'qa_badge')).toBe(false);
    expect(result.current.products.find(p => p.id === badgeProduct!.id)?.badge).toBe('sale');
  });

  it('handles update-only admin sections and order update', async () => {
    getTokenMock.mockReturnValue('test-token');
    localStorage.setItem('candy_orders', JSON.stringify([
      {
        id: 1,
        total: 1000,
        discount: 0,
        promo: null,
        contact: { name: 'Test', phone: '+70000000000' },
        delivery: { address: 'Addr', method: 'courier', payment: 'card' },
        items: [],
        status: 'new',
      },
    ]));

    const { result } = renderHook(() => useStore());
    const nextFooter = { ...footerData, brandName: 'QA Brand' };
    const nextHeader = { ...headerData, brandName: 'QA Header', menuButtonBg: '#111111' };
    const nextHero = { ...heroTextData, title: 'QA Hero' };
    const nextBlocks: FeatureBlock[] = [
      { id: 'qa', icon: 'Truck', title: 'QA', description: 'QA Desc', link: '/qa', bgColor: 'bg-candy-pink' },
    ];
    const nextAbout = { title: 'О нас QA', subtitle: 'Подзаголовок QA', content: 'Контент QA', images: ['/images/qa-about.jpg'] };

    await act(async () => {
      await result.current.updateFooter(nextFooter);
      await result.current.updateHeader(nextHeader);
      await result.current.updateHeroText(nextHero);
      await result.current.updateFeatureBlocks(nextBlocks);
      await result.current.updateAbout(nextAbout);
      await result.current.updateOrder(1, { status: 'processing' });
    });

    await waitFor(() => {
      expect(result.current.footer.brandName).toBe('QA Brand');
      expect(result.current.header.brandName).toBe('QA Header');
      expect(result.current.heroText.title).toBe('QA Hero');
      expect(result.current.featureBlocks[0]?.id).toBe('qa');
      expect(result.current.about.title).toBe('О нас QA');
      expect(result.current.orders.find(o => o.id === 1)?.status).toBe('processing');
    });
  });
});
