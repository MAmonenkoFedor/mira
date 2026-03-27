import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Admin from '@/pages/Admin';

const storeMock = {
  products: [
    {
      id: 1,
      name: 'Тестовый товар',
      price: 350,
      description: 'Описание',
      image: '/images/test.jpg',
      images: ['/images/test.jpg'],
      popularity: 5,
      category: 'chocolate',
      categories: ['chocolate'],
      active: true,
    },
  ],
  categories: [
    { id: 'chocolate', name: 'Категория тест', emoji: '🍫', color: 'candy-pink', group: 'single', showOnHome: true, homeOrder: 1 },
  ],
  packagingOptions: [
    { id: 'standard', name: 'Стандарт', price: 0, active: true, image: '/images/pack.jpg', images: [] },
  ],
  badges: [],
  articles: [
    { id: 1, slug: 'test-article', title: 'Тестовая статья', excerpt: 'Кратко', tag: 'Советы', readTime: '3 мин', image: '/images/a.jpg' },
  ],
  orders: [],
  promos: [
    { id: 1, code: 'TEST10', percent: 10, scope: 'all', active: true },
  ],
  promoBanners: [],
  heroImages: [],
  featureBlocks: [
    { id: 'f1', icon: 'Truck', title: 'Быстро', description: 'Описание', link: '/catalog', bgColor: 'bg-candy-pink' },
  ],
  about: {
    title: 'О нас',
    subtitle: 'Подзаголовок',
    content: 'Текст о компании',
    images: ['/images/about.jpg'],
  },
  footer: {
    brandEmoji: '🍬',
    brandName: 'МираВкус',
    description: 'Описание',
    deliveryTitle: 'Доставка',
    deliveryItems: ['Курьер'],
    contactsTitle: 'Контакты',
    phone: '+7 (999) 000-00-00',
    email: 'test@example.com',
    address: 'Москва',
    socialItems: ['Telegram'],
    copyright: '© Тест',
  },
  header: {
    brandName: 'МираВкус',
    brandTextColor: '#db2777',
    menuButtonBg: '#db2777',
    menuButtonTextColor: '#ffffff',
  },
  addProduct: vi.fn().mockResolvedValue(undefined),
  updateProduct: vi.fn().mockResolvedValue(undefined),
  deleteProduct: vi.fn().mockResolvedValue(undefined),
  addCategory: vi.fn().mockResolvedValue(undefined),
  updateCategory: vi.fn().mockResolvedValue(undefined),
  deleteCategory: vi.fn().mockResolvedValue(undefined),
  addPackagingOption: vi.fn().mockResolvedValue(undefined),
  updatePackagingOption: vi.fn().mockResolvedValue(undefined),
  deletePackagingOption: vi.fn().mockResolvedValue(undefined),
  addArticle: vi.fn().mockResolvedValue(undefined),
  updateArticle: vi.fn().mockResolvedValue(undefined),
  deleteArticle: vi.fn().mockResolvedValue(undefined),
  addPromo: vi.fn().mockResolvedValue(undefined),
  updatePromo: vi.fn().mockResolvedValue(undefined),
  deletePromo: vi.fn().mockResolvedValue(undefined),
  updateFeatureBlocks: vi.fn().mockResolvedValue(undefined),
  updateAbout: vi.fn().mockResolvedValue(undefined),
  updateFooter: vi.fn().mockResolvedValue(undefined),
  updateHeader: vi.fn().mockResolvedValue(undefined),
  resetToDefaults: vi.fn(),
};

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/api', () => ({
  api: {
    changePassword: vi.fn().mockResolvedValue(undefined),
  },
  resolveMediaUrl: (value: string) => value,
}));

vi.mock('@/components/candy-store/useStore', () => ({
  useStore: () => storeMock,
}));

const clickTab = (label: string) => {
  const buttons = screen.getAllByRole('button', { name: new RegExp(label, 'i') });
  fireEvent.click(buttons[0]);
};

const clickDeleteButton = (container: HTMLElement) => {
  const buttons = Array.from(container.querySelectorAll('button[class*="hover:bg-destructive/10"]'));
  const button = buttons[0] as HTMLButtonElement | undefined;
  if (!button) throw new Error('Delete button not found');
  fireEvent.click(button);
};

describe('admin ui crud wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls product crud methods from UI', async () => {
    const view = render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /добавить товар/i }));
    const productForm = screen.getByPlaceholderText('Название товара').closest('form') as HTMLElement;
    fireEvent.change(within(productForm).getByPlaceholderText('Название товара'), { target: { value: 'Новый товар' } });
    fireEvent.change(within(productForm).getByPlaceholderText('Краткое описание товара'), { target: { value: 'Текст' } });
    fireEvent.change(within(productForm).getAllByRole('spinbutton')[0], { target: { value: '500' } });
    fireEvent.click(within(productForm).getByRole('button', { name: /^добавить$/i }));
    expect(storeMock.addProduct).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByText('Тестовый товар')[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /сохранить/i })[0]);
    expect(storeMock.updateProduct).toHaveBeenCalledWith(1, expect.any(Object));

    clickDeleteButton(view.container);
    expect(storeMock.deleteProduct).toHaveBeenCalledWith(1);
  });

  it('calls categories and packaging crud methods from UI', async () => {
    const view = render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>,
    );

    clickTab('Категории');
    fireEvent.click(screen.getByRole('button', { name: /добавить категорию/i }));
    const categoryForm = screen.getByPlaceholderText('например: candy').closest('form') as HTMLElement;
    fireEvent.change(within(categoryForm).getByPlaceholderText('например: candy'), { target: { value: 'qa' } });
    fireEvent.change(within(categoryForm).getByPlaceholderText('Название категории'), { target: { value: 'QA Категория' } });
    fireEvent.click(within(categoryForm).getByRole('button', { name: /^добавить$/i }));
    expect(storeMock.addCategory).toHaveBeenCalledTimes(1);

    clickDeleteButton(view.container);
    expect(storeMock.deleteCategory).toHaveBeenCalledWith('chocolate');

    clickTab('Упаковка');
    fireEvent.click(screen.getByRole('button', { name: /добавить упаковку/i }));
    const packagingForm = screen.getByPlaceholderText('gift_wrap').closest('form') as HTMLElement;
    fireEvent.change(within(packagingForm).getByPlaceholderText('gift_wrap'), { target: { value: 'qa_pack' } });
    fireEvent.change(within(packagingForm).getByPlaceholderText('Подарочная упаковка'), { target: { value: 'QA Упаковка' } });
    fireEvent.change(within(packagingForm).getAllByRole('spinbutton')[0], { target: { value: '120' } });
    fireEvent.click(within(packagingForm).getByRole('button', { name: /^добавить$/i }));
    expect(storeMock.addPackagingOption).toHaveBeenCalledTimes(1);

    clickDeleteButton(view.container);
    expect(storeMock.deletePackagingOption).toHaveBeenCalledWith('standard');
  });

  it('calls articles and promos crud methods and saves update-only tabs', async () => {
    const view = render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>,
    );

    clickTab('Статьи');
    fireEvent.click(screen.getByRole('button', { name: /добавить статью/i }));
    const articleForm = screen.getByPlaceholderText('Заголовок статьи').closest('form') as HTMLElement;
    fireEvent.change(within(articleForm).getByPlaceholderText('Заголовок статьи'), { target: { value: 'Новая статья' } });
    fireEvent.change(within(articleForm).getByPlaceholderText('Краткое описание для карточки...'), { target: { value: 'Краткий текст' } });
    fireEvent.click(within(articleForm).getByRole('button', { name: /^добавить$/i }));
    expect(storeMock.addArticle).toHaveBeenCalledTimes(1);

    clickDeleteButton(view.container);
    expect(storeMock.deleteArticle).toHaveBeenCalledWith(1);

    clickTab('Промокоды');
    fireEvent.click(screen.getByRole('button', { name: /добавить промокод/i }));
    const promoForm = screen.getByPlaceholderText('например: SWEET15').closest('form') as HTMLElement;
    fireEvent.change(within(promoForm).getByPlaceholderText('например: SWEET15'), { target: { value: 'QA20' } });
    fireEvent.change(within(promoForm).getAllByRole('spinbutton')[0], { target: { value: '20' } });
    fireEvent.click(within(promoForm).getByRole('button', { name: /^добавить$/i }));
    expect(storeMock.addPromo).toHaveBeenCalledTimes(1);

    clickDeleteButton(view.container);
    expect(storeMock.deletePromo).toHaveBeenCalledWith(1);

    clickTab('Преимущества');
    fireEvent.click(screen.getByRole('button', { name: /сохранить/i }));
    expect(storeMock.updateFeatureBlocks).toHaveBeenCalledTimes(1);

    clickTab('О нас');
    fireEvent.click(screen.getByRole('button', { name: /сохранить/i }));
    expect(storeMock.updateAbout).toHaveBeenCalledTimes(1);

    clickTab('Футер');
    fireEvent.click(screen.getByRole('button', { name: /сохранить/i }));
    expect(storeMock.updateFooter).toHaveBeenCalledTimes(1);

    clickTab('Хедер');
    fireEvent.click(screen.getByRole('button', { name: /сохранить/i }));
    expect(storeMock.updateHeader).toHaveBeenCalledTimes(1);
  });
});
