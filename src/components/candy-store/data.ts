export interface Product {
  id: number;
  name: string;
  price: number;
  oldPrice?: number;
  category?: string;
  categories?: string[];
  badge?: string;
  description: string;
  sku?: string;
  compositionShort?: string;
  shelfLife?: string;
  country?: string;
  compositionSet?: string;
  storageTemperature?: string;
  productFeatures?: string;
  setWeight?: string;
  packageDimensions?: string;
  descriptionLong?: string;
  image: string;
  images?: string[];
  popularity: number;
  active?: boolean;
  packagingMode?: 'none' | 'standard' | 'selectable';
  standardPackagingId?: string | null;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
  group?: 'set' | 'single';
  showOnHome?: boolean | null;
}

export interface PackagingOption {
  id: string;
  name: string;
  price: number;
  active: boolean;
}

export type BadgeTone = 'primary' | 'secondary' | 'destructive';
export interface Badge {
  id: string;
  label: string;
  tone: BadgeTone;
  active: boolean;
}

export type PromoScope = 'all' | 'category' | 'product';
export interface Promo {
  id: number;
  code: string;
  percent: number;
  scope: PromoScope;
  categories?: string[];
  products?: number[];
  active: boolean;
}

export interface FooterData {
  brandEmoji: string;
  brandName: string;
  description: string;
  deliveryTitle: string;
  deliveryItems: string[];
  contactsTitle: string;
  phone: string;
  email: string;
  address: string;
  socialItems: string[];
  copyright: string;
}

export const footerData: FooterData = {
  brandEmoji: '🍬',
  brandName: 'МираВкус',
  description: 'Интернет-магазин натуральных сладостей для детей. Только качественные ингредиенты и ручная работа.',
  deliveryTitle: 'Доставка и оплата',
  deliveryItems: [
    'Курьер по Москве — от 299 ₽',
    'ПВЗ по России — от 199 ₽',
    'Бесплатно от 3000 ₽',
    'Оплата картой или при получении',
  ],
  contactsTitle: 'Контакты',
  phone: '📞 +7 (495) 123-45-67',
  email: '✉️ hello@candyland.ru',
  address: '📍 Москва, ул. Сладкая, 15',
  socialItems: ['📱 Telegram', '📷 Instagram', '💬 VK'],
  copyright: '© 2026 МираВкус. Все права защищены.',
};

export const categories: Category[] = [
  { id: 'gift', name: 'Подарочные наборы', emoji: '🎁', color: 'candy-pink', group: 'set', showOnHome: true },
  { id: 'chocolate', name: 'Шоколад', emoji: '🍫', color: 'candy-mint', group: 'set', showOnHome: true },
  { id: 'truffles', name: 'Трюфели', emoji: '🟤', color: 'candy-lavender', group: 'set', showOnHome: true },
  { id: 'asian', name: 'Азиатские сладости', emoji: '🍡', color: 'candy-blue', group: 'set', showOnHome: false },
  { id: 'cookies', name: 'Печенье и вафли', emoji: '🍪', color: 'candy-banana', group: 'set', showOnHome: true },
  { id: 'lollipops', name: 'Леденцы', emoji: '🍭', color: 'candy-pink', group: 'single', showOnHome: true },
  { id: 'sour_lollipops', name: 'Кислые леденцы', emoji: '🍋', color: 'candy-mint', group: 'single', showOnHome: false },
  { id: 'chewy_candies', name: 'Жевательные конфеты', emoji: '🍬', color: 'candy-lavender', group: 'single', showOnHome: false },
  { id: 'marmalade_jelly', name: 'Мармелад и желе', emoji: '🍓', color: 'candy-blue', group: 'single', showOnHome: true },
  { id: 'marshmallow', name: 'Маршмеллоу', emoji: '☁️', color: 'candy-banana', group: 'single', showOnHome: true },
  { id: 'snacks', name: 'Снеки', emoji: '🥨', color: 'candy-mint', group: 'single', showOnHome: false },
  { id: 'chewing_gum', name: 'Жевательная резинка', emoji: '🫧', color: 'candy-blue', group: 'single', showOnHome: false },
  { id: 'refreshing_candies', name: 'Освежающие конфеты', emoji: '🌿', color: 'candy-lavender', group: 'single', showOnHome: false },
  { id: 'unique_sweets', name: 'Уникальные сладости', emoji: '✨', color: 'candy-pink', group: 'single', showOnHome: true },
];

export const badges: Badge[] = [
  { id: 'new', label: 'Новинка', tone: 'primary', active: true },
  { id: 'sale', label: 'Скидка', tone: 'destructive', active: true },
];

export const packagingOptions: PackagingOption[] = [
  { id: 'standard', name: 'Стандартная', price: 0, active: true },
  { id: 'gift_wrap', name: 'Подарочная упаковка', price: 149, active: true },
];

export const badgeToneClasses: Record<BadgeTone, string> = {
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
};

export const badgeToneSoftClasses: Record<BadgeTone, string> = {
  primary: 'bg-primary/10 text-primary',
  secondary: 'bg-secondary/20 text-foreground',
  destructive: 'bg-destructive/10 text-destructive',
};

export const products: Product[] = [
  {
    id: 1,
    name: 'Подарочный набор «Сказка»',
    price: 1490,
    category: 'gift',
    badge: 'new',
    description: 'Волшебный набор из 20 конфет ручной работы в красивой подарочной коробке с лентой.',
    image: '/images/gift-box.jpg',
    popularity: 10,
  },
  {
    id: 2,
    name: 'Подарочный набор «Детский праздник»',
    price: 2190,
    oldPrice: 2590,
    category: 'gift',
    badge: 'sale',
    description: 'Большой набор сладостей для детского праздника: шоколад, мармелад, печенье и леденцы.',
    image: '/images/gift-box.jpg',
    popularity: 9,
  },
  {
    id: 3,
    name: 'Молочный шоколад «Мишка»',
    price: 290,
    category: 'chocolate',
    description: 'Нежный молочный шоколад с весёлым мишкой на упаковке. 100г натурального какао.',
    image: '/images/chocolate.jpg',
    popularity: 8,
  },
  {
    id: 4,
    name: 'Шоколадные фигурки «Зоопарк»',
    price: 450,
    category: 'chocolate',
    badge: 'new',
    description: 'Набор из 6 шоколадных фигурок животных из бельгийского молочного шоколада.',
    image: '/images/chocolate.jpg',
    popularity: 7,
  },
  {
    id: 5,
    name: 'Трюфели «Нежность»',
    price: 590,
    category: 'truffles',
    description: 'Классические шоколадные трюфели с начинкой из сливочного ганаша. 9 штук.',
    image: '/images/truffles.jpg',
    popularity: 6,
  },
  {
    id: 6,
    name: 'Трюфели ассорти «Радуга»',
    price: 790,
    oldPrice: 990,
    category: 'truffles',
    badge: 'sale',
    description: 'Ассорти трюфелей: малина, фисташка, карамель, апельсин. 12 штук в коробке.',
    image: '/images/truffles.jpg',
    popularity: 8,
  },
  {
    id: 7,
    name: 'Моти манго-маракуйя',
    price: 350,
    category: 'asian',
    description: 'Японские рисовые пирожные моти с начинкой из манго и маракуйи. 6 штук.',
    image: '/images/mochi.jpg',
    popularity: 7,
  },
  {
    id: 8,
    name: 'Kit-Kat матча',
    price: 420,
    category: 'asian',
    badge: 'new',
    description: 'Оригинальные японские Kit-Kat со вкусом зелёного чая матча. Упаковка 12 мини-батончиков.',
    image: '/images/mochi.jpg',
    popularity: 9,
  },
  {
    id: 9,
    name: 'Печенье «Весёлые мордашки»',
    price: 320,
    category: 'cookies',
    description: 'Сливочное печенье с глазурью в виде забавных мордашек. 10 штук в упаковке.',
    image: '/images/cookies.jpg',
    popularity: 6,
  },
  {
    id: 10,
    name: 'Вафельные трубочки «Хрум»',
    price: 280,
    category: 'cookies',
    description: 'Хрустящие вафельные трубочки с кремовой начинкой. 8 штук.',
    image: '/images/cookies.jpg',
    popularity: 5,
  },
  {
    id: 11,
    name: 'Конфеты «Белочка»',
    price: 380,
    oldPrice: 450,
    category: 'chocolate',
    badge: 'sale',
    description: 'Классические шоколадные конфеты с ореховой начинкой. 200г.',
    image: '/images/chocolate.jpg',
    popularity: 8,
  },
  {
    id: 12,
    name: 'Подарочный набор «Сладкая радуга»',
    price: 1790,
    category: 'gift',
    badge: 'new',
    description: 'Яркий набор: моти, трюфели, печенье и шоколадные фигурки в радужной коробке.',
    image: '/images/gift-box.jpg',
    popularity: 10,
  },
];
