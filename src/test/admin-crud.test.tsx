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
    apiMock.getCategories.mockRejectedValue(new Error('offline'));
    apiMock.getProducts.mockRejectedValue(new Error('offline'));
    apiMock.getArticles.mockRejectedValue(new Error('offline'));
    apiMock.getPromos.mockRejectedValue(new Error('offline'));
    apiMock.getHeroImages.mockRejectedValue(new Error('offline'));
    apiMock.getFooter.mockRejectedValue(new Error('offline'));
    apiMock.getHeader.mockRejectedValue(new Error('offline'));
    apiMock.getPackagingOptions.mockRejectedValue(new Error('offline'));
    apiMock.getPromoBanners.mockRejectedValue(new Error('offline'));
    apiMock.getHeroText.mockRejectedValue(new Error('offline'));
    apiMock.getFeatureBlocks.mockRejectedValue(new Error('offline'));
    apiMock.getAbout.mockRejectedValue(new Error('offline'));
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
