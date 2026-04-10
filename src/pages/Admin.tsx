import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, RotateCcw, Package, FileText, Tag, Gift, Upload, X, Percent, Image as ImageIcon, ArrowUp, ArrowDown, BadgeCheck, ClipboardList, Star, Heart, Menu, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useStore, type Article, type Order } from '@/components/candy-store/useStore';
import { api, resolveMediaUrl } from '@/lib/api';
import { clearToken, getTokenExpirationMs, setToken } from '@/lib/auth';
import { badgeToneSoftClasses, badgeToneClasses, getProductBadgeIds } from '@/components/candy-store/data';
import type { Product, Category, Promo, PromoScope, Badge, BadgeTone, PackagingOption, Review, FeatureBlock } from '@/components/candy-store/data';

type Tab = 'products' | 'categories' | 'homeCategories' | 'packaging' | 'articles' | 'promos' | 'import' | 'hero' | 'badges' | 'orders' | 'header' | 'footer' | 'reviews' | 'benefits' | 'about' | 'integrations' | 'settings';

const ADMIN_TAB_META: { key: Tab; icon: typeof Package; label: string }[] = [
  { key: 'products', icon: Package, label: 'Товары' },
  { key: 'categories', icon: Tag, label: 'Категории' },
  { key: 'homeCategories', icon: Tag, label: 'Категории на главной' },
  { key: 'packaging', icon: Gift, label: 'Упаковка' },
  { key: 'badges', icon: BadgeCheck, label: 'Бейджи' },
  { key: 'articles', icon: FileText, label: 'Статьи' },
  { key: 'reviews', icon: Star, label: 'Отзывы' },
  { key: 'orders', icon: ClipboardList, label: 'Заказы' },
  { key: 'promos', icon: Percent, label: 'Промокоды' },
  { key: 'hero', icon: ImageIcon, label: 'Баннер' },
  { key: 'header', icon: Menu, label: 'Хедер' },
  { key: 'benefits', icon: Heart, label: 'Преимущества' },
  { key: 'about', icon: FileText, label: 'О нас' },
  { key: 'footer', icon: ImageIcon, label: 'Футер' },
  { key: 'integrations', icon: KeyRound, label: 'Интеграции' },
  { key: 'settings', icon: KeyRound, label: 'Настройки' },
  { key: 'import', icon: Upload, label: 'Импорт' },
];

const PRODUCT_VIEW_FILTER_OPTIONS: { key: 'all' | 'set' | 'single' | 'mixed' | 'inactive'; label: string }[] = [
  { key: 'all', label: 'Все товары' },
  { key: 'set', label: 'Только наборы' },
  { key: 'single', label: 'Только штучные' },
  { key: 'mixed', label: 'Смешанные' },
  { key: 'inactive', label: 'Снятые' },
];

const CATEGORY_LIST_FILTER_OPTIONS: { key: 'all' | 'root' | 'nested' | 'set' | 'single'; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'root', label: 'Корневые' },
  { key: 'nested', label: 'Вложенные' },
  { key: 'set', label: 'Наборы' },
  { key: 'single', label: 'Штучные' },
];

const getProductCategoryIds = (p: Product) => {
  const anyP = p as any;
  return Array.isArray(anyP?.categories) && anyP.categories.length
    ? anyP.categories.filter(Boolean).map((x: unknown) => String(x))
    : (anyP?.category ? [String(anyP.category)] : []);
};

const buildCategoryPathLabel = (id: string, categoriesById: Map<string, Category>) => {
  const parts = id.split('/').filter(Boolean);
  if (!parts.length) return id;
  const names: string[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const partialId = parts.slice(0, i + 1).join('/');
    names.push(categoriesById.get(partialId)?.name || parts[i]);
  }
  return names.join(' / ');
};

const getErrorStatus = (err: unknown): number | null => {
  if (!(err instanceof Error)) return null;
  const match = err.message.trim().match(/^(\d{3})(?:\b|[:|])/);
  return match ? Number(match[1]) : null;
};

const getErrorDetail = (err: unknown): string => {
  if (!(err instanceof Error)) return '';
  const raw = err.message.trim();
  const byDelimiter = raw.match(/^\d{3}[|:]\s*(.+)$/);
  if (byDelimiter?.[1]) return byDelimiter[1].trim();
  if (/^\d{3}$/.test(raw)) return '';
  return raw;
};

const getFriendlyActionError = (err: unknown, action: string) => {
  const status = getErrorStatus(err);
  const detail = getErrorDetail(err);
  if (status === 401 || status === 403) return 'Нет доступа. Перезайдите в админку.';
  if (status === 404) return `${action}: запись не найдена. Обновите страницу и попробуйте снова.`;
  if (status === 409) return `${action}: такая запись уже существует. Измените ID или код и повторите.`;
  if (status === 413) return `${action}: файл слишком большой. Уменьшите размер файла и повторите.`;
  if (status === 422 || status === 400) return `${action}: проверьте заполнение полей${detail ? ` (${detail})` : ''}.`;
  if (status === 429) return `${action}: слишком много запросов. Подождите пару секунд и повторите.`;
  if (status && status >= 500) return `${action}: временная ошибка сервера. Попробуйте снова чуть позже.`;
  if (detail) return `${action}: ${detail}`;
  return `${action}. Проверьте заполнение полей и интернет-соединение.`;
};

const toastActionError = (err: unknown, action: string) => {
  toast.error(getFriendlyActionError(err, action));
};

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('read_error'));
  reader.readAsDataURL(file);
});

type AppendValidatedImagesParams = {
  files: FileList | null;
  currentImages: string[];
  maxImages: number;
  maxImagesError: string;
};

const appendValidatedImages = async ({ files, currentImages, maxImages, maxImagesError }: AppendValidatedImagesParams) => {
  if (!files || !files.length) return null;
  if (currentImages.length >= maxImages) {
    toast.error(maxImagesError);
    return null;
  }
  const next: string[] = [];
  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/')) {
      toast.error('Только изображения');
      continue;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Макс. размер 5 МБ');
      continue;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      next.push(dataUrl);
    } catch {
      toast.error('Не удалось обработать изображение');
    }
  }
  if (!next.length) return null;
  const space = maxImages - currentImages.length;
  const slice = next.slice(0, space);
  if (slice.length < next.length) toast.error(maxImagesError);
  return [...currentImages, ...slice];
};

const toWebpDataUrl = (dataUrl: string) => new Promise<string>((resolve, reject) => {
  if (dataUrl.startsWith('data:image/webp')) { resolve(dataUrl); return; }
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { reject(new Error('canvas_error')); return; }
    ctx.drawImage(img, 0, 0);
    resolve(canvas.toDataURL('image/webp', 0.9));
  };
  img.onerror = () => reject(new Error('image_error'));
  img.src = dataUrl;
});

const headerFallback = {
  brandName: 'МираВкус',
  brandTextColor: '#db2777',
  menuButtonBg: '#db2777',
  menuButtonTextColor: '#ffffff',
};

/* ─── Image Upload Helper ─── */
function ImageUpload({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Только изображения'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Макс. размер 5 МБ'); return; }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const webpUrl = await toWebpDataUrl(dataUrl);
      onChange(webpUrl);
    } catch {
      toast.error('Не удалось обработать изображение');
    }
  };

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">Изображение</label>
      <div
        className={`relative rounded-xl border-2 border-dashed transition-colors p-3 ${
          dragging ? 'border-primary bg-primary/5' : 'border-border'
        }`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        <div className="flex items-center gap-3">
          {value ? (
            <div className="relative">
              <img src={resolveMediaUrl(value)} alt="" className="w-16 h-16 rounded-xl object-cover border border-border" />
              <button type="button" onClick={() => onChange('')}
                title="Удалить изображение"
                aria-label="Удалить изображение"
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                <X size={12} />
              </button>
            </div>
          ) : (
            <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
              <Upload size={20} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <button type="button" onClick={() => inputRef.current?.click()}
              className="text-sm font-medium text-primary hover:underline">
              Загрузить файл
            </button>
            <p className="text-[11px] text-muted-foreground mt-0.5">или перетащите сюда · JPG, PNG, WebP до 5 МБ</p>
            <input
              type="text"
              value={value.startsWith('data:') ? '' : value}
              onChange={e => onChange(e.target.value)}
              placeholder="или вставьте URL: /images/..."
              className="admin-input mt-1.5 text-xs"
            />
          </div>
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>
    </div>
  );
}

function VideoUpload({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('video/')) { toast.error('Только видео'); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error('Макс. размер 20 МБ'); return; }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      onChange(dataUrl);
    } catch {
      toast.error('Не удалось обработать видео');
    }
  };

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">Видеообложка</label>
      <div
        className={`relative rounded-xl border-2 border-dashed transition-colors p-3 ${
          dragging ? 'border-primary bg-primary/5' : 'border-border'
        }`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        <div className="flex items-center gap-3">
          {value ? (
            <div className="relative">
              <video
                src={resolveMediaUrl(value)}
                className="w-20 h-16 rounded-xl object-cover border border-border"
                muted
                playsInline
                preload="metadata"
              />
              <button type="button" onClick={() => onChange('')}
                title="Удалить видео"
                aria-label="Удалить видео"
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                <X size={12} />
              </button>
            </div>
          ) : (
            <div className="w-20 h-16 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
              <Upload size={20} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <button type="button" onClick={() => inputRef.current?.click()}
              className="text-sm font-medium text-primary hover:underline">
              Загрузить видео
            </button>
            <p className="text-[11px] text-muted-foreground mt-0.5">или перетащите сюда · MP4, WebM, OGG до 20 МБ</p>
            <input
              type="text"
              value={value.startsWith('data:') ? '' : value}
              onChange={e => onChange(e.target.value)}
              placeholder="или вставьте URL: /uploads/products/videos/..."
              className="admin-input mt-1.5 text-xs"
            />
          </div>
        </div>
        <input ref={inputRef} type="file" accept="video/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>
    </div>
  );
}

/* ─── Main Admin ─── */
export default function Admin() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>('products');
  const [sessionState, setSessionState] = useState<'checking' | 'active' | 'network_issue'>('checking');
  const [sessionEmail, setSessionEmail] = useState('');
  const [sessionNowMs, setSessionNowMs] = useState(() => Date.now());
  const sessionLogoutHandledRef = useRef(false);

  const forceLogoutBySession = useCallback((message: string) => {
    if (sessionLogoutHandledRef.current) return;
    sessionLogoutHandledRef.current = true;
    clearToken();
    toast.error(message);
    window.location.reload();
  }, []);

  const checkAdminSession = useCallback(async (silent = true) => {
    try {
      const data = await api.getAdminSession();
      setSessionState('active');
      setSessionEmail(data?.email || '');
    } catch (err) {
      const status = getErrorStatus(err);
      if (status === 401 || status === 403) {
        forceLogoutBySession('Сессия завершена. Войдите в админку снова.');
        return;
      }
      setSessionState('network_issue');
      if (!silent) {
        toast.error('Не удалось проверить состояние сессии');
      }
    }
  }, [forceLogoutBySession]);

  useEffect(() => {
    void checkAdminSession(true);
    const intervalId = window.setInterval(() => {
      void checkAdminSession(true);
    }, 300_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkAdminSession(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [checkAdminSession]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setSessionNowMs(Date.now());
    }, 30_000);
    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  const tokenExpiryLabel = useMemo(() => {
    const expiresAt = getTokenExpirationMs();
    if (!expiresAt) return 'до выхода: —';
    const diff = expiresAt - sessionNowMs;
    if (diff <= 0) return 'до выхода: истекла';
    const totalMinutes = Math.floor(diff / 60_000);
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `до выхода: ${days}д ${hours}ч`;
    if (hours > 0) return `до выхода: ${hours}ч ${minutes}м`;
    return `до выхода: ${minutes}м`;
  }, [sessionNowMs]);

  useEffect(() => {
    const expiresAt = getTokenExpirationMs();
    if (!expiresAt) return;
    if (expiresAt <= sessionNowMs) {
      forceLogoutBySession('Срок сессии истек. Войдите в админку снова.');
    }
  }, [forceLogoutBySession, sessionNowMs]);

  const tabs = useMemo(() => {
    const counts: Record<Tab, number> = {
      products: store.products.length,
      categories: store.categories.length,
      homeCategories: store.categories.filter(c => c.showOnHome).length,
      packaging: store.packagingOptions.length,
      badges: store.badges.length,
      articles: store.articles.length,
      reviews: 0,
      orders: store.orders?.length || 0,
      promos: store.promos?.length || 0,
      hero: store.heroImages?.length || 0,
      header: 1,
      footer: 0,
      benefits: store.featureBlocks?.length || 0,
      about: 1,
      integrations: 4,
      settings: 1,
      import: 0,
    };
    return ADMIN_TAB_META.map(meta => ({ ...meta, count: counts[meta.key] }));
  }, [
    store.products.length,
    store.categories,
    store.packagingOptions.length,
    store.badges.length,
    store.articles.length,
    store.orders?.length,
    store.promos?.length,
    store.heroImages?.length,
    store.featureBlocks?.length,
  ]);

  const activeTab = tabs.find(t => t.key === tab) || tabs[0];

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="flex min-h-screen">
        <aside className="hidden md:flex md:flex-col w-64 shrink-0 sticky top-0 h-screen bg-card/95 backdrop-blur-md border-r border-border shadow-sm">
          <div className="h-14 flex items-center gap-2 px-4 border-b border-border">
            <Link to="/" title="Вернуться на сайт" aria-label="Вернуться на сайт" className="p-2 -ml-2 rounded-xl hover:bg-muted/50 text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div className="font-display font-bold text-foreground">🍬 Админ</div>
          </div>
          <nav className="flex-1 p-3 overflow-y-auto">
            <div className="grid gap-1">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-2xl text-sm font-medium transition-colors ${
                    tab === t.key
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <t.icon size={16} />
                    <span className="truncate">{t.label}</span>
                  </span>
                  <span className={`text-xs tabular-nums ${tab === t.key ? 'opacity-80' : 'text-muted-foreground'}`}>
                    {t.count}
                  </span>
                </button>
              ))}
            </div>
          </nav>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border shadow-sm">
            <div className="flex items-center justify-between h-14 px-4 md:px-6">
              <div className="flex items-center gap-3 min-w-0">
                <Link to="/" title="Вернуться на сайт" aria-label="Вернуться на сайт" className="md:hidden p-2 rounded-xl hover:bg-muted/50 text-muted-foreground hover:text-primary transition-colors">
                  <ArrowLeft size={20} />
                </Link>
                <div className="min-w-0">
                  <div className="font-display text-base md:text-lg font-bold text-foreground truncate">
                    {activeTab?.label || 'Админ-панель'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full border border-border bg-background/70">
                  <span className={`h-2 w-2 rounded-full ${sessionState === 'active' ? 'bg-emerald-500' : sessionState === 'checking' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                  <span className="text-xs text-muted-foreground">
                    {sessionState === 'active'
                      ? `Вход выполнен${sessionEmail ? `: ${sessionEmail}` : ''} • ${tokenExpiryLabel}`
                      : sessionState === 'checking'
                        ? 'Проверка сессии...'
                        : 'Проблема связи с сервером'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    clearToken();
                    window.location.reload();
                  }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Выйти
                </button>
                <button
                  onClick={() => setTab('settings')}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Pencil size={14} /> Сменить пароль
                </button>
                <button
                  onClick={async () => {
                    const confirmText = 'Очистить БД? Будут удалены товары, категории, статьи, заказы и контент сайта.';
                    if (!window.confirm(confirmText)) return;
                    try {
                      await store.resetToDefaults();
                      toast.success('База очищена');
                    } catch (err) {
                      const code = err instanceof Error ? err.message : '';
                      if (code === '401' || code === '403') toast.error('Нет доступа. Перезайдите в админку.');
                      else toast.error('Не удалось очистить базу');
                    }
                  }}
                  title="Очистить БД"
                  aria-label="Очистить БД"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  <RotateCcw size={14} /> Очистить БД
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 md:px-6 pt-4 pb-12">
            <div className="max-w-6xl mx-auto">
              <div className="md:hidden flex gap-2 mb-6 overflow-x-auto">
                {tabs.map(t => (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all whitespace-nowrap ${
                      tab === t.key
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-card text-muted-foreground hover:text-foreground border border-border'
                    }`}
                  >
                    <t.icon size={16} /> {t.label}
                    <span className="ml-1 text-xs opacity-70">({t.count})</span>
                  </button>
                ))}
              </div>

              {tab === 'products' && <ProductsTab store={store} />}
              {tab === 'categories' && <CategoriesTab store={store} />}
              {tab === 'homeCategories' && <HomeCategoriesTab store={store} />}
              {tab === 'packaging' && <PackagingTab store={store} />}
              {tab === 'badges' && <BadgesTab store={store} />}
              {tab === 'articles' && <ArticlesTab store={store} />}
              {tab === 'reviews' && <ReviewsTab store={store} />}
              {tab === 'orders' && <OrdersTab store={store} />}
              {tab === 'promos' && <PromosTab store={store} />}
              {tab === 'import' && <ImportTab store={store} />}
              {tab === 'hero' && <HeroTab store={store} />}
              {tab === 'header' && <HeaderTab store={store} />}
              {tab === 'benefits' && <FeatureBlocksTab store={store} />}
              {tab === 'about' && <AboutTab store={store} />}
              {tab === 'footer' && <FooterTab store={store} />}
              {tab === 'integrations' && <IntegrationsTab />}
              {tab === 'settings' && <SettingsTab />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function SettingsTab() {
  const [securityLoading, setSecurityLoading] = useState(true);
  const [adminEmail, setAdminEmail] = useState('');
  const [recentLogins, setRecentLogins] = useState<Array<{ id: number; email: string; ip: string | null; userAgent: string | null; success: boolean; createdAt: string }>>([]);
  const [loginStatusFilter, setLoginStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [loginPeriodFilter, setLoginPeriodFilter] = useState<'all' | '24h' | '7d'>('all');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [emailPassword, setEmailPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [logoutPassword, setLogoutPassword] = useState('');
  const [logoutBusy, setLogoutBusy] = useState(false);

  const canSubmitPassword = currentPassword.trim().length >= 6 && newPassword.trim().length >= 6 && confirmPassword.trim().length >= 6 && !savingPassword;
  const canSubmitEmail = emailPassword.trim().length >= 6 && newEmail.trim().length >= 5 && !savingEmail;
  const canSubmitLogout = logoutPassword.trim().length >= 6 && !logoutBusy;
  const filteredRecentLogins = useMemo(() => {
    const now = Date.now();
    return recentLogins.filter((entry) => {
      if (loginStatusFilter === 'success' && !entry.success) return false;
      if (loginStatusFilter === 'failed' && entry.success) return false;
      if (loginPeriodFilter !== 'all') {
        const timestamp = new Date(entry.createdAt).getTime();
        if (!Number.isFinite(timestamp)) return false;
        const periodMs = loginPeriodFilter === '24h' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
        if (now - timestamp > periodMs) return false;
      }
      return true;
    });
  }, [loginPeriodFilter, loginStatusFilter, recentLogins]);

  const loadSecurity = useCallback(async () => {
    try {
      setSecurityLoading(true);
      const data = await api.getAdminSecurity();
      setAdminEmail(data.email || '');
      setRecentLogins(Array.isArray(data.recentLogins) ? data.recentLogins : []);
    } catch {
      toast.error('Не удалось загрузить настройки безопасности');
    } finally {
      setSecurityLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSecurity();
  }, [loadSecurity]);

  const submit = useCallback(async () => {
    const current = currentPassword.trim();
    const next = newPassword.trim();
    const confirm = confirmPassword.trim();
    if (!current || !next || !confirm) {
      toast.error('Заполните все поля');
      return;
    }
    if (next.length < 6) {
      toast.error('Новый пароль должен быть не короче 6 символов');
      return;
    }
    if (next !== confirm) {
      toast.error('Новый пароль и подтверждение не совпадают');
      return;
    }
    if (next === current) {
      toast.error('Новый пароль должен отличаться от текущего');
      return;
    }
    try {
      setSavingPassword(true);
      await api.changePassword(current, next);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Пароль администратора обновлён');
    } catch (err) {
      const status = getErrorStatus(err);
      const detail = getErrorDetail(err);
      if (status === 400 && detail.includes('invalid_password')) {
        toast.error('Текущий пароль введён неверно');
      } else {
        toast.error(getFriendlyActionError(err, 'Не удалось обновить пароль'));
      }
    } finally {
      setSavingPassword(false);
    }
  }, [confirmPassword, currentPassword, newPassword]);

  const submitEmail = useCallback(async () => {
    const pwd = emailPassword.trim();
    const email = newEmail.trim().toLowerCase();
    if (!pwd || !email) {
      toast.error('Введите новый email и текущий пароль');
      return;
    }
    try {
      setSavingEmail(true);
      const data = await api.changeAdminEmail(pwd, email);
      if (data?.token) setToken(data.token);
      setAdminEmail(data?.email || email);
      setEmailPassword('');
      setNewEmail('');
      toast.success('Email администратора обновлён');
      await loadSecurity();
    } catch (err) {
      const status = getErrorStatus(err);
      const detail = getErrorDetail(err);
      if (status === 400 && detail.includes('invalid_password')) {
        toast.error('Текущий пароль введён неверно');
      } else if (status === 409 && detail.includes('email_exists')) {
        toast.error('Этот email уже используется');
      } else if (status === 400 && detail.includes('same_email')) {
        toast.error('Новый email совпадает с текущим');
      } else {
        toast.error(getFriendlyActionError(err, 'Не удалось обновить email'));
      }
    } finally {
      setSavingEmail(false);
    }
  }, [emailPassword, loadSecurity, newEmail]);

  const submitLogoutAll = useCallback(async () => {
    const pwd = logoutPassword.trim();
    if (!pwd) {
      toast.error('Введите текущий пароль');
      return;
    }
    try {
      setLogoutBusy(true);
      await api.logoutAllAdminSessions(pwd);
      clearToken();
      toast.success('Все активные сессии закрыты. Войдите снова.');
      window.location.reload();
    } catch (err) {
      const status = getErrorStatus(err);
      const detail = getErrorDetail(err);
      if (status === 400 && detail.includes('invalid_password')) {
        toast.error('Текущий пароль введён неверно');
      } else {
        toast.error(getFriendlyActionError(err, 'Не удалось завершить сессии'));
      }
    } finally {
      setLogoutBusy(false);
    }
  }, [logoutPassword]);

  return (
    <div className="grid gap-4">
      <div className="bg-card rounded-2xl border border-border/40 shadow-sm p-5 max-w-xl">
        <div className="font-display text-lg font-semibold mb-1">Смена пароля администратора</div>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            await submit();
          }}
        >
          <input
            type="password"
            placeholder="Текущий пароль"
            className="admin-input"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
          <input
            type="password"
            placeholder="Новый пароль (минимум 6 символов)"
            className="admin-input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <input
            type="password"
            placeholder="Подтверждение нового пароля"
            className="admin-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          <button
            type="submit"
            disabled={!canSubmitPassword}
            className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
          >
            {savingPassword ? 'Сохраняем...' : 'Обновить пароль'}
          </button>
        </form>
      </div>

      <div className="bg-card rounded-2xl border border-border/40 shadow-sm p-5 max-w-xl">
        <div className="font-display text-lg font-semibold mb-1">Email администратора</div>
        <div className="text-sm text-muted-foreground mb-4">Текущий: {securityLoading ? 'Загрузка...' : (adminEmail || '—')}</div>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            await submitEmail();
          }}
        >
          <input
            type="email"
            placeholder="Новый email"
            className="admin-input"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Текущий пароль"
            className="admin-input"
            value={emailPassword}
            onChange={(e) => setEmailPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button
            type="submit"
            disabled={!canSubmitEmail}
            className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
          >
            {savingEmail ? 'Сохраняем...' : 'Обновить email'}
          </button>
        </form>
      </div>

      <div className="bg-card rounded-2xl border border-border/40 shadow-sm p-5 max-w-xl">
        <div className="font-display text-lg font-semibold mb-1">Завершить все сессии</div>
        <div className="text-sm text-muted-foreground mb-4">Выход со всех устройств и браузеров</div>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            await submitLogoutAll();
          }}
        >
          <input
            type="password"
            placeholder="Текущий пароль"
            className="admin-input"
            value={logoutPassword}
            onChange={(e) => setLogoutPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button
            type="submit"
            disabled={!canSubmitLogout}
            className="px-4 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium disabled:opacity-60"
          >
            {logoutBusy ? 'Выполняем...' : 'Выйти везде'}
          </button>
        </form>
      </div>

      <div className="bg-card rounded-2xl border border-border/40 shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <div className="font-display text-lg font-semibold">Последние входы</div>
            {!securityLoading && (
              <div className="text-xs text-muted-foreground mt-0.5">Показано: {filteredRecentLogins.length} из {recentLogins.length}</div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={loginStatusFilter}
              onChange={(e) => setLoginStatusFilter(e.target.value as 'all' | 'success' | 'failed')}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground"
            >
              <option value="all">Все статусы</option>
              <option value="success">Только успешные</option>
              <option value="failed">Только ошибки</option>
            </select>
            <select
              value={loginPeriodFilter}
              onChange={(e) => setLoginPeriodFilter(e.target.value as 'all' | '24h' | '7d')}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground"
            >
              <option value="all">За всё время</option>
              <option value="24h">За 24 часа</option>
              <option value="7d">За 7 дней</option>
            </select>
            <button
              onClick={() => { void loadSecurity(); }}
              className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Обновить
            </button>
          </div>
        </div>
        {securityLoading ? (
          <div className="text-sm text-muted-foreground">Загружаем историю входов...</div>
        ) : filteredRecentLogins.length === 0 ? (
          <div className="text-sm text-muted-foreground">История входов пока пуста.</div>
        ) : (
          <div className="grid gap-2">
            {filteredRecentLogins.map((entry) => (
              <div key={entry.id} className="border border-border/40 rounded-xl p-3 text-sm bg-background/40">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${entry.success ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {entry.success ? 'Успешно' : 'Ошибка'}
                  </span>
                  <span className="text-muted-foreground">{new Date(entry.createdAt).toLocaleString('ru-RU')}</span>
                </div>
                <div className="mt-1 break-all">{entry.email}</div>
                <div className="text-muted-foreground break-all">IP: {entry.ip || '—'}</div>
                <div className="text-muted-foreground break-all">User-Agent: {entry.userAgent || '—'}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Products Tab ─── */
function ProductsTab({ store }: { store: ReturnType<typeof useStore> }) {
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [badgeFilter, setBadgeFilter] = useState('all');
  const [sort, setSort] = useState<'popular' | 'name' | 'price_asc' | 'price_desc'>('popular');
  const [showInactive, setShowInactive] = useState(false);
  const [viewFilter, setViewFilter] = useState<'all' | 'set' | 'single' | 'mixed' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [showQuickNav, setShowQuickNav] = useState(false);
  const filtersRef = useRef<HTMLDivElement | null>(null);
  const pageSize = 20;
  const searchQuery = useMemo(() => search.trim().toLowerCase(), [search]);
  const closeEditor = useCallback(() => {
    setEditing(null);
    setCreating(false);
  }, []);
  const openCreate = useCallback(() => {
    setCreating(true);
    setEditing(null);
  }, []);
  const openEdit = useCallback((product: Product) => {
    setEditing(product);
    setCreating(false);
  }, []);
  const resetFilters = useCallback(() => {
    setSearch('');
    setCategoryFilter('all');
    setBadgeFilter('all');
    setSort('popular');
    setShowInactive(false);
    setViewFilter('all');
  }, []);

  const categoriesById = useMemo(() => {
    return new Map(store.categories.map(c => [c.id, c]));
  }, [store.categories]);
  const badgeById = useMemo(() => {
    return new Map(store.badges.map(b => [b.id, b]));
  }, [store.badges]);
  const getCategoryPathLabel = useCallback((id: string) => {
    return buildCategoryPathLabel(id, categoriesById);
  }, [categoriesById]);
  const categoriesSorted = useMemo(() => {
    return [...store.categories]
      .map(c => ({ ...c, depth: c.id.split('/').length - 1, pathLabel: getCategoryPathLabel(c.id) }))
      .sort((a, b) => a.pathLabel.localeCompare(b.pathLabel, 'ru'));
  }, [store.categories, getCategoryPathLabel]);

  const getCategories = useCallback((p: Product) => getProductCategoryIds(p), []);
  const getProductKind = useCallback((p: Product) => {
    const ids = getCategories(p);
    if (!ids.length) return 'mixed';
    const groups = new Set(ids.map(id => categoriesById.get(id)?.group).filter(Boolean));
    if (groups.size === 1) {
      if (groups.has('set')) return 'set';
      if (groups.has('single')) return 'single';
    }
    return 'mixed';
  }, [categoriesById, getCategories]);

  const filtered = useMemo(() => {
    let list = [...store.products];

    if (!showInactive) {
      list = list.filter(p => p.active !== false);
    }

    if (categoryFilter !== 'all') {
      list = list.filter(p => getCategories(p).some(c => c === categoryFilter || c.startsWith(`${categoryFilter}/`)));
    }

    if (badgeFilter !== 'all') {
      list = list.filter(p => {
        const ids = getProductBadgeIds(p);
        return badgeFilter === '' ? ids.length === 0 : ids.includes(badgeFilter);
      });
    }

    if (searchQuery) {
      list = list.filter(p => {
        const sku = (p.sku || '').toLowerCase();
        return p.name.toLowerCase().includes(searchQuery) || String(p.id).includes(searchQuery) || sku.includes(searchQuery);
      });
    }
    if (viewFilter === 'inactive') {
      list = list.filter(p => p.active === false);
    } else if (viewFilter !== 'all') {
      list = list.filter(p => getProductKind(p) === viewFilter);
    }

    switch (sort) {
      case 'name':
        list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        break;
      case 'price_asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        list.sort((a, b) => b.price - a.price);
        break;
      default:
        list.sort((a, b) => b.popularity - a.popularity);
    }

    return list;
  }, [store.products, showInactive, categoryFilter, badgeFilter, searchQuery, sort, viewFilter, getProductKind, getCategories]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, badgeFilter, sort, showInactive, store.products.length, viewFilter]);
  useEffect(() => {
    const onScroll = () => setShowQuickNav(window.scrollY > 700);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const visible = filtered.slice(0, page * pageSize);

  return (
    <div>
      <div ref={filtersRef} className="sticky top-16 z-20 mb-4 bg-muted/30 backdrop-blur-md rounded-2xl px-4 py-3 border border-border/40 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Поиск</label>
            <input value={search} onChange={e => setSearch(e.target.value)} className="admin-input" placeholder="Название, ID, SKU" />
          </div>
          <div className="min-w-[180px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Категория</label>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="admin-input">
              <option value="all">Все</option>
              {categoriesSorted.map(c => (
                <option key={c.id} value={c.id}>
                  {`${'— '.repeat(c.depth)}${c.emoji ? `${c.emoji} ` : ''}${c.pathLabel}`}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Бейдж</label>
            <select value={badgeFilter} onChange={e => setBadgeFilter(e.target.value)} className="admin-input">
              <option value="all">Все</option>
              <option value="">Без бейджа</option>
              {store.badges.map(b => (
                <option key={b.id} value={b.id}>{b.label}{b.active ? '' : ' (выключен)'}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Сортировка</label>
            <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="admin-input">
              <option value="popular">По популярности</option>
              <option value="name">По названию</option>
              <option value="price_asc">Сначала дешевле</option>
              <option value="price_desc">Сначала дороже</option>
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Статус</label>
            <select value={showInactive ? 'all' : 'active'} onChange={e => setShowInactive(e.target.value === 'all')} className="admin-input">
              <option value="active">В продаже</option>
              <option value="all">Все</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={resetFilters}
              className="h-10 px-3 rounded-xl text-sm border border-border text-muted-foreground hover:bg-muted transition-colors flex items-center gap-2">
              <RotateCcw size={14} /> Сбросить
            </button>
            <button onClick={openCreate}
              className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground text-sm font-medium hover:scale-[1.02] active:scale-95 transition-transform flex items-center gap-2">
              <Plus size={16} /> Добавить товар
            </button>
          </div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Показано {visible.length} из {filtered.length}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {PRODUCT_VIEW_FILTER_OPTIONS.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => setViewFilter(item.key as typeof viewFilter)}
            className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
              viewFilter === item.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-foreground border-border hover:bg-muted'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {(creating || editing) && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] p-4 sm:p-6 overflow-y-auto">
          <div className="max-w-5xl mx-auto">
            <div className="bg-background rounded-2xl border border-border/40 shadow-xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="font-display font-semibold text-base">
                  {editing ? `Редактирование: ${editing.name}` : 'Новый товар'}
                </div>
                <button
                  type="button"
                  onClick={closeEditor}
                  title="Закрыть окно товара"
                  aria-label="Закрыть окно товара"
                  className="p-2 rounded-xl hover:bg-muted text-muted-foreground"
                >
                  <X size={16} />
                </button>
              </div>
              <ProductForm
                product={editing}
                categories={store.categories}
                badges={store.badges}
                packagingOptions={store.packagingOptions}
                onSave={async (data) => {
                  try {
                    if (editing) { await store.updateProduct(editing.id, data); toast.success('Товар обновлён'); }
                    else { await store.addProduct(data as Omit<Product, 'id'>); toast.success('Товар добавлен'); }
                    closeEditor();
                  } catch (err) {
                    toast.error(getFriendlyActionError(err, 'Не удалось сохранить товар'));
                  }
                }}
                onCancel={closeEditor}
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {visible.map(p => (
          <div key={p.id} onClick={() => openEdit(p)}
            className={`flex items-center gap-4 bg-card rounded-2xl p-4 border border-border/40 shadow-sm cursor-pointer hover:border-primary/40 transition-colors ${
              p.active === false ? 'opacity-70' : ''
            }`}>
            <img src={resolveMediaUrl(p.images?.[0] || p.image)} alt={p.name} className="w-14 h-14 rounded-xl object-cover bg-muted" loading="lazy" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display font-semibold text-sm truncate">{p.name}</span>
                {p.active === false && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-destructive/10 text-destructive">снят</span>
                )}
                {getProductBadgeIds(p).map(id => {
                  const badge = badgeById.get(id);
                  if (!badge) return null;
                  return (
                    <span key={badge.id} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badge.active ? badgeToneSoftClasses[badge.tone] : 'bg-muted text-muted-foreground'}`}>
                      {badge.label}{badge.active ? '' : ' (выключен)'}
                    </span>
                  );
                })}
              </div>
              <div className="text-xs text-muted-foreground">
                {`${p.price} ₽ · id: ${p.id}${p.sku ? ` · ${p.sku}` : ''}`}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(() => {
                  const list = getCategories(p);
                  if (!list.length) return <span className="text-[11px] text-muted-foreground">Категории не заданы</span>;
                  return list.map(id => (
                    <span key={`${p.id}-cat-${id}`} className="px-2 py-0.5 rounded-full text-[11px] bg-muted text-muted-foreground">
                      {getCategoryPathLabel(id)}
                    </span>
                  ));
                })()}
              </div>
            </div>
            <div className="flex gap-1.5">
              <button onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                title="Редактировать товар"
                aria-label="Редактировать товар"
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                <Pencil size={15} />
              </button>
              <button onClick={async (e) => {
                e.stopPropagation();
                try {
                  await store.deleteProduct(p.id);
                  toast.success('Удалено');
                } catch (err) {
                  toastActionError(err, 'Не удалось удалить товар');
                }
              }}
                title="Удалить товар"
                aria-label="Удалить товар"
                className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="text-sm text-muted-foreground py-10 text-center">Ничего не найдено</div>
      )}
      {filtered.length > visible.length && (
        <div className="flex justify-center mt-4">
          <button onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-xl text-sm border border-border text-muted-foreground hover:bg-muted transition-colors">
            Показать ещё
          </button>
        </div>
      )}
      {showQuickNav && (
        <div className="fixed right-4 bottom-4 z-30 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => filtersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="px-3 py-2 rounded-xl border border-border bg-card/95 backdrop-blur text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            К фильтрам
          </button>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:scale-[1.02] active:scale-95 transition-transform"
          >
            Наверх
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Hero Tab ─── */
function HeroTab({ store }: { store: ReturnType<typeof useStore> }) {
  const [val, setVal] = useState('');
  const [linkVal, setLinkVal] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState('');
  const [textForm, setTextForm] = useState(() => ({
    title: store.heroText.title,
    accent: store.heroText.accent,
    subtitle: store.heroText.subtitle,
    floatingCandiesEnabled: store.heroText.floatingCandiesEnabled,
    floatingCandiesText: store.heroText.floatingCandies.join('\n'),
  }));
  useEffect(() => {
    setTextForm({
      title: store.heroText.title,
      accent: store.heroText.accent,
      subtitle: store.heroText.subtitle,
      floatingCandiesEnabled: store.heroText.floatingCandiesEnabled,
      floatingCandiesText: store.heroText.floatingCandies.join('\n'),
    });
  }, [store.heroText]);
  const add = async () => {
    if (busy) return;
    let finalUrl = val.trim();
    if (!file && !finalUrl) { toast.error('Добавьте файл или URL'); return; }
    try {
      setBusy(true);
      if (file || finalUrl.startsWith('data:image/')) {
        const dataUrl = file ? await readFileAsDataUrl(file) : finalUrl;
        const webpUrl = await toWebpDataUrl(dataUrl);
        const res = await api.uploadHeroImage(webpUrl) as { url: string };
        finalUrl = res.url;
      }
      await store.addHeroImage({ url: finalUrl, link: linkVal.trim() || null });
      setVal('');
      setLinkVal('');
      setFile(null);
      setPreview('');
      toast.success('Баннер добавлен');
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === '401' || code === '403') {
        toast.error('Нет доступа для загрузки. Перезайдите в админку.');
      } else if (code === '413') {
        toast.error('Файл слишком большой. Максимум 5 МБ.');
      } else if (code === 'read_error') {
        toast.error('Не удалось прочитать файл. Попробуйте другой.');
      } else if (code === '400') {
        toast.error('Неверный формат или размер файла. Попробуйте JPG/PNG/WebP до 5 МБ.');
      } else {
        toast.error('Не удалось загрузить изображение');
      }
    } finally {
      setBusy(false);
    }
  };
  const imgs = [...store.heroImages].sort((a,b)=> a.position - b.position);
  return (
    <div className="grid gap-4">
      <form onSubmit={async (e) => {
        e.preventDefault();
        const title = textForm.title.trim();
        const accent = textForm.accent.trim();
        const subtitle = textForm.subtitle.trim();
        const floatingCandies = textForm.floatingCandiesText
          .split(/[\s,]+/)
          .map(v => v.trim())
          .filter(Boolean);
        if (!title) { toast.error('Введите заголовок'); return; }
        if (!accent) { toast.error('Введите акцент'); return; }
        if (!subtitle) { toast.error('Введите подзаголовок'); return; }
        try {
          await store.updateHeroText({
            title,
            accent,
            subtitle,
            floatingCandiesEnabled: textForm.floatingCandiesEnabled,
            floatingCandies,
          });
          toast.success('Текст хиро обновлён');
        } catch (err) {
          toastActionError(err, 'Не удалось обновить текст');
        }
      }} className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm grid gap-4">
        <div className="font-display font-semibold">Текст хиро-блока</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Заголовок</label>
            <input
              value={textForm.title}
              onChange={e => setTextForm(v => ({ ...v, title: e.target.value }))}
              maxLength={80}
              className="admin-input"
              placeholder="Сладкое счастье"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Акцент</label>
            <input
              value={textForm.accent}
              onChange={e => setTextForm(v => ({ ...v, accent: e.target.value }))}
              maxLength={80}
              className="admin-input"
              placeholder="для детей"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Подзаголовок</label>
          <textarea
            value={textForm.subtitle}
            onChange={e => setTextForm(v => ({ ...v, subtitle: e.target.value }))}
            maxLength={220}
            rows={3}
            className="admin-input resize-none"
            placeholder="Натуральные конфеты, шоколад и подарочные наборы..."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={textForm.floatingCandiesEnabled}
              onChange={e => setTextForm(v => ({ ...v, floatingCandiesEnabled: e.target.checked }))}
            />
            Плавающие сладости
          </label>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Эмодзи для фона</label>
          <textarea
            value={textForm.floatingCandiesText}
            onChange={e => setTextForm(v => ({ ...v, floatingCandiesText: e.target.value }))}
            rows={3}
            className="admin-input resize-none"
            placeholder="🍭\n🍬\n🧁\n🍩\n🍪"
          />
        </div>
        <div className="flex justify-end">
          <button type="submit" className="px-4 py-2 rounded-xl text-sm bg-primary text-primary-foreground font-medium hover:scale-[1.02] active:scale-95 transition-transform">
            Сохранить
          </button>
        </div>
      </form>
      <div className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm">
        <div className="font-display font-semibold mb-3">Добавить изображение</div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-start">
          <div className="grid gap-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-muted/50 text-sm cursor-pointer hover:bg-muted">
                <Upload size={16} />
                <span>Выбрать файл</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0] || null;
                    if (!f) { setFile(null); setPreview(''); return; }
                    if (!f.type.startsWith('image/')) {
                      toast.error('Можно загрузить только изображение');
                      e.currentTarget.value = '';
                      setFile(null);
                      setPreview('');
                      return;
                    }
                    if (f.size > 5 * 1024 * 1024) {
                      toast.error('Файл слишком большой. Максимум 5 МБ.');
                      e.currentTarget.value = '';
                      setFile(null);
                      setPreview('');
                      return;
                    }
                    setFile(f);
                    setVal('');
                    setPreview(URL.createObjectURL(f));
                  }}
                />
              </label>
              {file && <span className="text-xs text-muted-foreground truncate">{file.name}</span>}
            </div>
            {preview && (
              <div className="w-full max-w-sm rounded-xl overflow-hidden border border-border/40">
                <img src={preview} alt="" className="w-full h-40 object-cover" />
              </div>
            )}
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">Или вставьте URL</label>
              <input
                type="text"
                value={val}
                onChange={e => { setVal(e.target.value); setFile(null); setPreview(''); }}
                placeholder="/images/hero.jpg или https://..."
                className="admin-input text-sm"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">Ссылка для перехода</label>
              <input
                type="text"
                value={linkVal}
                onChange={e => setLinkVal(e.target.value)}
                placeholder="/catalog или https://..."
                className="admin-input text-sm"
              />
            </div>
          </div>
          <button
            onClick={add}
            disabled={busy}
            className={`px-4 py-2 rounded-xl text-sm font-medium ${busy ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'}`}
          >
            {busy ? 'Загрузка...' : 'Добавить'}
          </button>
        </div>
        <div className="text-xs text-muted-foreground mt-2">JPG/PNG/WebP до 5 МБ. Файл загрузится на сервер, URL сохранится в базе.</div>
      </div>
      <div className="grid gap-3">
        {imgs.map((img, idx) => (
          <div key={`${img.id}-${img.position}-${idx}`} className="grid gap-3 bg-card rounded-2xl p-4 border border-border/40 shadow-sm">
            <div className="flex items-center gap-4">
              <img src={resolveMediaUrl(img.url)} alt="" className="w-20 h-16 object-cover rounded-xl border" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-display">pos: {img.position}</div>
                <div className="text-xs text-muted-foreground truncate">{img.url}</div>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={img.active}
                  onChange={async (e) => {
                    try {
                      await store.updateHeroImage(img.id, { active: e.target.checked });
                    } catch (err) {
                      toastActionError(err, 'Не удалось обновить баннер');
                    }
                  }}
                />
                Активно
              </label>
              <div className="flex gap-1.5">
                <button onClick={async () => {
                  try {
                    const newPos = Math.max(0, img.position - 1);
                    await store.updateHeroImage(img.id, { position: newPos });
                  } catch (err) {
                    toastActionError(err, 'Не удалось обновить баннер');
                  }
                }} title="Поднять баннер выше" aria-label="Поднять баннер выше" className="p-2 rounded-xl hover:bg-muted text-muted-foreground"><ArrowUp size={15} /></button>
                <button onClick={async () => {
                  try {
                    await store.updateHeroImage(img.id, { position: img.position + 1 });
                  } catch (err) {
                    toastActionError(err, 'Не удалось обновить баннер');
                  }
                }} title="Опустить баннер ниже" aria-label="Опустить баннер ниже" className="p-2 rounded-xl hover:bg-muted text-muted-foreground"><ArrowDown size={15} /></button>
                <button onClick={async () => {
                  try {
                    await store.deleteHeroImage(img.id);
                    toast.success('Удалено');
                  } catch (err) {
                    toastActionError(err, 'Не удалось удалить баннер');
                  }
                }} title="Удалить баннер" aria-label="Удалить баннер" className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={15} /></button>
              </div>
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">Ссылка</label>
              <input
                type="text"
                value={img.link || ''}
                onChange={e => store.updateHeroImage(img.id, { link: e.target.value })}
                placeholder="/catalog или https://..."
                className="admin-input text-sm"
              />
            </div>
          </div>
        ))}
        {imgs.length === 0 && <div className="text-sm text-muted-foreground">Пока нет изображений. Добавьте первое!</div>}
      </div>
    </div>
  );
}

/* ─── Promo Banners Tab ─── */
function PromoBannersTab({ store }: { store: ReturnType<typeof useStore> }) {
  const [val, setVal] = useState('');
  const [linkVal, setLinkVal] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState('');
  const add = async () => {
    if (busy) return;
    let finalUrl = val.trim();
    if (!file && !finalUrl) { toast.error('Добавьте файл или URL'); return; }
    try {
      setBusy(true);
      if (file || finalUrl.startsWith('data:image/')) {
        const dataUrl = file ? await readFileAsDataUrl(file) : finalUrl;
        const webpUrl = await toWebpDataUrl(dataUrl);
        const res = await api.uploadPromoBanner(webpUrl) as { url: string };
        finalUrl = res.url;
      }
      await store.addPromoBanner({ url: finalUrl, link: linkVal.trim() || null });
      setVal('');
      setLinkVal('');
      setFile(null);
      setPreview('');
      toast.success('Баннер добавлен');
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === '401' || code === '403') {
        toast.error('Нет доступа для загрузки. Перезайдите в админку.');
      } else if (code === '413') {
        toast.error('Файл слишком большой. Максимум 5 МБ.');
      } else if (code === 'read_error') {
        toast.error('Не удалось прочитать файл. Попробуйте другой.');
      } else if (code === '400') {
        toast.error('Неверный формат или размер файла. Попробуйте JPG/PNG/WebP до 5 МБ.');
      } else {
        toast.error('Не удалось загрузить изображение');
      }
    } finally {
      setBusy(false);
    }
  };
  const banners = [...store.promoBanners].sort((a,b)=> a.position - b.position);
  return (
    <div className="grid gap-4">
      <div className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm">
        <div className="font-display font-semibold mb-3">Добавить баннер акции</div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-start">
          <div className="grid gap-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-muted/50 text-sm cursor-pointer hover:bg-muted">
                <Upload size={16} />
                <span>Выбрать файл</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0] || null;
                    if (!f) { setFile(null); setPreview(''); return; }
                    if (!f.type.startsWith('image/')) {
                      toast.error('Можно загрузить только изображение');
                      e.currentTarget.value = '';
                      setFile(null);
                      setPreview('');
                      return;
                    }
                    if (f.size > 5 * 1024 * 1024) {
                      toast.error('Файл слишком большой. Максимум 5 МБ.');
                      e.currentTarget.value = '';
                      setFile(null);
                      setPreview('');
                      return;
                    }
                    setFile(f);
                    setVal('');
                    setPreview(URL.createObjectURL(f));
                  }}
                />
              </label>
              {file && <span className="text-xs text-muted-foreground truncate">{file.name}</span>}
            </div>
            {preview && (
              <div className="w-full max-w-sm rounded-xl overflow-hidden border border-border/40">
                <img src={preview} alt="" className="w-full h-40 object-cover" />
              </div>
            )}
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">Или вставьте URL</label>
              <input
                type="text"
                value={val}
                onChange={e => { setVal(e.target.value); setFile(null); setPreview(''); }}
                placeholder="/images/promo.jpg или https://..."
                className="admin-input text-sm"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">Ссылка для перехода</label>
              <input
                type="text"
                value={linkVal}
                onChange={e => setLinkVal(e.target.value)}
                placeholder="/catalog или https://..."
                className="admin-input text-sm"
              />
            </div>
          </div>
          <button
            onClick={add}
            disabled={busy}
            className={`px-4 py-2 rounded-xl text-sm font-medium ${busy ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'}`}
          >
            {busy ? 'Загрузка...' : 'Добавить'}
          </button>
        </div>
        <div className="text-xs text-muted-foreground mt-2">JPG/PNG/WebP до 5 МБ. Файл загрузится на сервер, URL сохранится в базе.</div>
      </div>
      <div className="grid gap-3">
        {banners.map((img, idx) => (
          <div key={`${img.id}-${img.position}-${idx}`} className="grid gap-3 bg-card rounded-2xl p-4 border border-border/40 shadow-sm">
            <div className="flex items-center gap-4">
              <img src={resolveMediaUrl(img.url)} alt="" className="w-20 h-16 object-cover rounded-xl border" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-display">pos: {img.position}</div>
                <div className="text-xs text-muted-foreground truncate">{img.url}</div>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={img.active}
                  onChange={async (e) => {
                    try {
                      await store.updatePromoBanner(img.id, { active: e.target.checked });
                    } catch (err) {
                      toastActionError(err, 'Не удалось обновить баннер');
                    }
                  }}
                />
                Активно
              </label>
              <div className="flex gap-1.5">
                <button onClick={async () => {
                  try {
                    const newPos = Math.max(0, img.position - 1);
                    await store.updatePromoBanner(img.id, { position: newPos });
                  } catch (err) {
                    toastActionError(err, 'Не удалось обновить баннер');
                  }
                }} title="Поднять баннер выше" aria-label="Поднять баннер выше" className="p-2 rounded-xl hover:bg-muted text-muted-foreground"><ArrowUp size={15} /></button>
                <button onClick={async () => {
                  try {
                    await store.updatePromoBanner(img.id, { position: img.position + 1 });
                  } catch (err) {
                    toastActionError(err, 'Не удалось обновить баннер');
                  }
                }} title="Опустить баннер ниже" aria-label="Опустить баннер ниже" className="p-2 rounded-xl hover:bg-muted text-muted-foreground"><ArrowDown size={15} /></button>
                <button onClick={async () => {
                  try {
                    await store.deletePromoBanner(img.id);
                    toast.success('Удалено');
                  } catch (err) {
                    toastActionError(err, 'Не удалось удалить баннер');
                  }
                }} title="Удалить баннер" aria-label="Удалить баннер" className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={15} /></button>
              </div>
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">Ссылка</label>
              <input
                type="text"
                value={img.link || ''}
                onChange={e => store.updatePromoBanner(img.id, { link: e.target.value })}
                placeholder="/catalog или https://..."
                className="admin-input text-sm"
              />
            </div>
          </div>
        ))}
        {banners.length === 0 && <div className="text-sm text-muted-foreground">Пока нет баннеров. Добавьте первый!</div>}
      </div>
    </div>
  );
}

/* ─── Import Tab ─── */
function ImportTab({ store }: { store: ReturnType<typeof useStore> }) {
  const [catText, setCatText] = useState('');
  const [prodText, setProdText] = useState('');
  const onFile = (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setter(String(reader.result || ''));
    reader.readAsText(f, 'utf-8');
  };
  const importCategories = async () => {
    try {
      const arr = JSON.parse(catText);
      if (!Array.isArray(arr)) throw new Error();
      for (const c of arr) {
        const id = (c.id && String(c.id)) || String(c.name || '').toLowerCase().replace(/\s+/g, '_').slice(0, 30);
        if (!id || !c.name) continue;
        await store.addCategory({ id, name: c.name, emoji: c.emoji || '🍬', color: c.color || 'candy-pink' } as any);
      }
      toast.success('Категории импортированы');
    } catch (err) {
      toastActionError(err, 'Ошибка импорта категорий: ожидается JSON массив');
    }
  };
  const importProducts = async () => {
    try {
      const arr = JSON.parse(prodText);
      if (!Array.isArray(arr)) throw new Error();
      for (const p of arr) {
        if (!p.name || !p.price) continue;
        const cats = Array.isArray(p.categories) && p.categories.length
          ? p.categories.map((x: unknown) => String(x)).filter(Boolean)
          : [String(p.category || '')].filter(Boolean);
        if (!cats.length) continue;
        const badgeIds = (
          Array.isArray(p.badgeIds) ? p.badgeIds : typeof p.badge === 'string' ? p.badge.split(',') : []
        )
          .map((x: unknown) => String(x).trim())
          .filter(Boolean);
        await store.addProduct({
          name: String(p.name).trim(),
          price: Number(p.price),
          oldPrice: p.oldPrice ? Number(p.oldPrice) : undefined,
          categories: cats,
          category: cats[0],
          badge: badgeIds.join(',') || undefined,
          badgeIds: badgeIds.length ? badgeIds : undefined,
          description: String(p.description || ''),
          image: String(p.image || ''),
          popularity: Number(p.popularity || 5),
          active: p.active !== false,
        } as any);
      }
      toast.success('Товары импортированы');
    } catch (err) {
      toastActionError(err, 'Ошибка импорта товаров: ожидается JSON массив');
    }
  };
  return (
    <div className="grid gap-6">
      <div className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="font-display font-semibold">Импорт категорий (JSON)</div>
          <input type="file" accept=".json,application/json" onChange={e => onFile(e, setCatText)} />
        </div>
        <textarea
          value={catText}
          onChange={e => setCatText(e.target.value)}
          rows={6}
          className="admin-input w-full resize-y"
          placeholder='[{"id":"gift","name":"Подарочные наборы","emoji":"🎁","color":"candy-pink"}]'
        />
        <div className="flex justify-end mt-3">
          <button onClick={importCategories} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
            Импортировать категории
          </button>
        </div>
      </div>
      <div className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="font-display font-semibold">Импорт товаров (JSON)</div>
          <input type="file" accept=".json,application/json" onChange={e => onFile(e, setProdText)} />
        </div>
        <textarea
          value={prodText}
          onChange={e => setProdText(e.target.value)}
          rows={10}
          className="admin-input w-full resize-y"
          placeholder='[{"name":"Шоколад","price":290,"category":"chocolate","description":"...","image":"/images/chocolate.jpg","badge":"new,sale","badgeIds":["new","sale"],"popularity":8,"active":true}]'
        />
        <div className="text-xs text-muted-foreground mt-2">Изображения кладите в /public/images и указывайте путь вида /images/filename.jpg</div>
        <div className="flex justify-end mt-3">
          <button onClick={importProducts} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
            Импортировать товары
          </button>
        </div>
      </div>
    </div>
  );
}
/* ─── Product Form ─── */
type ProductFormState = {
  name: string;
  price: number;
  oldPrice: number;
  categories: string[];
  badgeIds: string[];
  description: string;
  sku: string;
  compositionShort: string;
  shelfLife: string;
  country: string;
  compositionSet: string;
  storageTemperature: string;
  productFeatures: string;
  setWeight: string;
  packageDimensions: string;
  descriptionLong: string;
  image: string;
  images: string[];
  videoUrl: string;
  popularity: number;
  active: boolean;
  packagingMode: 'none' | 'standard' | 'selectable';
  standardPackagingId: string;
};

function ProductForm({ product, categories: cats, badges, packagingOptions, onSave, onCancel }: {
  product: Product | null;
  categories: Category[];
  badges: Badge[];
  packagingOptions: PackagingOption[];
  onSave: (data: Partial<Product>) => void;
  onCancel: () => void;
}) {
  const defaultStandardPackagingId = useMemo(() => {
    return (
      packagingOptions.find(p => p.active && p.id === 'standard')?.id ||
      packagingOptions.find(p => p.active)?.id ||
      packagingOptions[0]?.id ||
      ''
    );
  }, [packagingOptions]);
  const [form, setForm] = useState<ProductFormState>({
    name: product?.name || '',
    price: product?.price || 0,
    oldPrice: product?.oldPrice || 0,
    categories: (
      (product as any)?.categories?.length
        ? (product as any).categories
        : (product as any)?.category
          ? [(product as any).category]
          : (cats[0]?.id ? [cats[0].id] : [])
    ) as string[],
    badgeIds: getProductBadgeIds(product),
    description: product?.description || '',
    sku: product?.sku || '',
    compositionShort: product?.compositionShort || '',
    shelfLife: product?.shelfLife || '',
    country: product?.country || '',
    compositionSet: product?.compositionSet || '',
    storageTemperature: product?.storageTemperature || '',
    productFeatures: product?.productFeatures || '',
    setWeight: product?.setWeight || '',
    packageDimensions: product?.packageDimensions || '',
    descriptionLong: product?.descriptionLong || '',
    image: product?.image || '/images/gift-box.jpg',
    images: product?.images || (product?.image ? [product.image] : [] as string[]),
    videoUrl: (product as any)?.videoUrl || '',
    popularity: product?.popularity || 5,
    active: product?.active !== false,
    packagingMode: product?.packagingMode === 'none' ? 'selectable' : (product?.packagingMode || 'selectable'),
    standardPackagingId: product?.standardPackagingId || '',
  });
  const set = <K extends keyof ProductFormState>(k: K, v: ProductFormState[K]) => setForm(f => ({ ...f, [k]: v }));
  const [categorySearch, setCategorySearch] = useState('');
  const categorySearchQuery = useMemo(() => categorySearch.trim().toLowerCase(), [categorySearch]);
  const toggleCategory = (id: string) => {
    setForm(prev => {
      const has = prev.categories.includes(id);
      const next = has ? prev.categories.filter(x => x !== id) : [...prev.categories, id];
      return { ...prev, categories: next };
    });
  };
  const toggleBadge = (id: string) => {
    setForm(prev => {
      const has = prev.badgeIds.includes(id);
      const next = has ? prev.badgeIds.filter(x => x !== id) : [...prev.badgeIds, id];
      return { ...prev, badgeIds: next };
    });
  };
  const categoriesById = useMemo(() => new Map(cats.map(c => [c.id, c])), [cats]);
  const getCategoryPathLabel = useCallback((id: string) => {
    return buildCategoryPathLabel(id, categoriesById);
  }, [categoriesById]);
  const categoriesSorted = useMemo(() => {
    return [...cats]
      .map(c => ({ ...c, pathLabel: getCategoryPathLabel(c.id) }))
      .sort((a, b) => a.pathLabel.localeCompare(b.pathLabel, 'ru'));
  }, [cats, getCategoryPathLabel]);
  const filteredCategories = useMemo(() => {
    if (!categorySearchQuery) return categoriesSorted;
    return categoriesSorted.filter(c => (
      c.pathLabel.toLowerCase().includes(categorySearchQuery) ||
      c.id.toLowerCase().includes(categorySearchQuery) ||
      c.name.toLowerCase().includes(categorySearchQuery)
    ));
  }, [categoriesSorted, categorySearchQuery]);
  const selectedCategories = useMemo(() => {
    return [...form.categories]
      .map(id => ({ id, pathLabel: getCategoryPathLabel(id), emoji: categoriesById.get(id)?.emoji || '' }))
      .sort((a, b) => a.pathLabel.localeCompare(b.pathLabel, 'ru'));
  }, [form.categories, getCategoryPathLabel, categoriesById]);

  useEffect(() => {
    if (form.packagingMode !== 'standard') return;
    if (form.standardPackagingId) return;
    if (!defaultStandardPackagingId) return;
    set('standardPackagingId', defaultStandardPackagingId);
  }, [form.packagingMode, form.standardPackagingId, defaultStandardPackagingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Введите название товара'); return; }
    if (form.price <= 0) { toast.error('Введите цену больше 0 ₽'); return; }
    const categories = (Array.isArray(form.categories) ? form.categories : []).map(String).filter(Boolean);
    if (!categories.length) { toast.error('Выберите хотя бы одну категорию, чтобы товар появился в каталоге'); return; }
    let standardPackagingId = form.standardPackagingId;
    if (form.packagingMode === 'standard' && !standardPackagingId) {
      standardPackagingId = defaultStandardPackagingId;
      if (!standardPackagingId) {
        toast.error('Выберите стандартную упаковку или переключите режим на "На выбор"');
        return;
      }
    }
    let images: string[] = [];
    let videoUrl = form.videoUrl.trim();
    try {
      for (const u of form.images) {
        if (u.startsWith('data:image/')) {
          const webpUrl = await toWebpDataUrl(u);
          const res = await api.uploadProductImage(webpUrl) as { url: string };
          images.push(res.url);
        } else {
          images.push(u);
        }
      }
    } catch {
      images = form.images;
    }
    if (videoUrl.startsWith('data:video/')) {
      try {
        const res = await api.uploadProductVideo(videoUrl) as { url: string };
        videoUrl = res.url;
      } catch {
        toast.error('Не удалось загрузить видео. Проверьте формат и размер файла (до 20 МБ).');
        return;
      }
    }
    const badgeIds = (Array.isArray(form.badgeIds) ? form.badgeIds : []).map(String).filter(Boolean);
    onSave({
      name: form.name.trim(), price: form.price,
      oldPrice: form.oldPrice || undefined,
      categories,
      category: categories[0],
      badge: badgeIds.join(',') || undefined,
      badgeIds: badgeIds.length ? badgeIds : undefined,
      description: form.description.trim(), image: images[0] || form.image, images,
      videoUrl: videoUrl || null,
      sku: form.sku.trim() || undefined,
      compositionShort: form.compositionShort.trim() || undefined,
      shelfLife: form.shelfLife.trim() || undefined,
      country: form.country.trim() || undefined,
      compositionSet: form.compositionSet.trim() || undefined,
      storageTemperature: form.storageTemperature.trim() || undefined,
      productFeatures: form.productFeatures.trim() || undefined,
      setWeight: form.setWeight.trim() || undefined,
      packageDimensions: form.packageDimensions.trim() || undefined,
      descriptionLong: form.descriptionLong.trim() || undefined,
      popularity: form.popularity, active: Boolean(form.active),
      packagingMode: form.packagingMode,
      standardPackagingId: form.packagingMode === 'standard' ? (standardPackagingId || null) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Название</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} maxLength={200} className="admin-input" placeholder="Название товара" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Цена ₽</label>
        <input type="number" value={form.price} onChange={e => set('price', +e.target.value)} className="admin-input" min={0} />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Старая цена ₽</label>
        <input type="number" value={form.oldPrice} onChange={e => set('oldPrice', +e.target.value)} className="admin-input" min={0} />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Категории</label>
        <div className="admin-input min-h-[9.5rem] p-2 overflow-y-auto">
          {selectedCategories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedCategories.map(c => (
                <button
                  key={`selected-${c.id}`}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  className="px-2 py-1 rounded-full text-[11px] bg-primary/10 text-primary border border-primary/20"
                >
                  {c.emoji ? `${c.emoji} ` : ''}{c.pathLabel} ×
                </button>
              ))}
            </div>
          )}
          <input
            value={categorySearch}
            onChange={e => setCategorySearch(e.target.value)}
            className="admin-input mb-2 h-9"
            placeholder="Поиск по названию, пути или ID"
          />
          <div className="flex flex-wrap gap-2">
            {filteredCategories.map(c => {
              const selected = form.categories.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    selected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/60 text-foreground border-border hover:bg-muted'
                  }`}
                >
                  {c.emoji ? `${c.emoji} ` : ''}{c.pathLabel}
                </button>
              );
            })}
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">
          Выберите одну или несколько категорий, ориентируясь по полному пути
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Бейджи</label>
        <div className="admin-input min-h-[9.5rem] p-2 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {badges.map(b => {
              const selected = form.badgeIds.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggleBadge(b.id)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    selected
                      ? `${badgeToneSoftClasses[b.tone]} border-transparent`
                      : 'bg-muted/60 text-foreground border-border hover:bg-muted'
                  }`}
                >
                  {b.label}{b.active ? '' : ' (выключен)'}
                </button>
              );
            })}
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">
          Можно выбрать несколько бейджей
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Популярность (1-10)</label>
        <input type="number" value={form.popularity} onChange={e => set('popularity', +e.target.value)} className="admin-input" min={1} max={10} />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Упаковка</label>
        <select
          value={form.packagingMode}
          onChange={(e) => {
            const next = e.target.value as ProductFormState['packagingMode'];
            setForm(prev => {
              const nextStandard = next === 'standard' ? (prev.standardPackagingId || defaultStandardPackagingId) : '';
              return { ...prev, packagingMode: next, standardPackagingId: nextStandard };
            });
          }}
          className="admin-input"
        >
          <option value="standard">Стандартная</option>
          <option value="selectable">На выбор</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Стандартная упаковка</label>
        <select
          value={form.standardPackagingId}
          onChange={e => set('standardPackagingId', e.target.value)}
          className="admin-input"
          disabled={form.packagingMode !== 'standard'}
        >
          <option value="">Не выбрано</option>
          {packagingOptions.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.price} ₽{p.active ? '' : ' (выключена)'}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Статус товара</label>
        <select value={String(form.active)} onChange={e => set('active', e.target.value === 'true')} className="admin-input">
          <option value="true">В продаже</option>
          <option value="false">Снят с продажи</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Обложка</label>
        <ImageUpload value={form.image} onChange={v => set('image', v)} />
      </div>
      <div className="sm:col-span-2">
        <VideoUpload value={form.videoUrl} onChange={v => set('videoUrl', v)} />
      </div>
      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Галерея</label>
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            {form.images.map((u, i) => (
              <div key={i} className="relative">
                <img src={resolveMediaUrl(u)} alt="" className="w-20 h-20 object-cover rounded-xl border" />
                <div className="absolute -top-1 -right-1 flex gap-1">
                  <button type="button" onClick={() => set('images', form.images.filter((_, j) => j !== i))} className="w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <ImageUpload value={''} onChange={v => set('images', [...form.images, v])} />
        </div>
      </div>
      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Описание</label>
        <textarea value={form.description} onChange={e => set('description', e.target.value)} maxLength={500}
          rows={2} className="admin-input resize-none" placeholder="Краткое описание товара" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Артикул</label>
        <input value={form.sku} onChange={e => set('sku', e.target.value)} maxLength={50} className="admin-input" placeholder="SKU / артикул" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Страна изготовления</label>
        <input value={form.country} onChange={e => set('country', e.target.value)} maxLength={60} className="admin-input" placeholder="Япония" />
      </div>
      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Состав (кратко)</label>
        <input value={form.compositionShort} onChange={e => set('compositionShort', e.target.value)} maxLength={200} className="admin-input" placeholder="Краткая строка состава" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Срок годности</label>
        <input value={form.shelfLife} onChange={e => set('shelfLife', e.target.value)} maxLength={80} className="admin-input" placeholder="365 дней" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Температура хранения</label>
        <input value={form.storageTemperature} onChange={e => set('storageTemperature', e.target.value)} maxLength={120} className="admin-input" placeholder="0…25°C" />
      </div>
      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Особенности продукции</label>
        <input value={form.productFeatures} onChange={e => set('productFeatures', e.target.value)} maxLength={200} className="admin-input" placeholder="Без ГМО; без консервантов" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Вес набора</label>
        <input value={form.setWeight} onChange={e => set('setWeight', e.target.value)} maxLength={80} className="admin-input" placeholder="1030 г" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Габариты упаковки</label>
        <input value={form.packageDimensions} onChange={e => set('packageDimensions', e.target.value)} maxLength={120} className="admin-input" placeholder="30×20×10 см" />
      </div>
      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Состав набора</label>
        <textarea value={form.compositionSet} onChange={e => set('compositionSet', e.target.value)} maxLength={2000}
          rows={3} className="admin-input resize-y" placeholder="Подробный состав набора" />
      </div>
      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Описание (подробное)</label>
        <textarea value={form.descriptionLong} onChange={e => set('descriptionLong', e.target.value)} maxLength={4000}
          rows={4} className="admin-input resize-y" placeholder="Текст для окна «Характеристики и описание»" />
      </div>
      <div className="sm:col-span-2 flex gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm border border-border text-muted-foreground hover:bg-muted transition-colors">Отмена</button>
        <button type="submit"
          className="px-4 py-2 rounded-xl text-sm bg-primary text-primary-foreground font-medium hover:scale-[1.02] active:scale-95 transition-transform">
          {product ? 'Сохранить' : 'Добавить'}
        </button>
      </div>
    </form>
  );
}

/* ─── Packaging Tab ─── */
function PackagingTab({ store }: { store: ReturnType<typeof useStore> }) {
  const [editing, setEditing] = useState<PackagingOption | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <button onClick={() => { setCreating(true); setEditing(null); }}
        className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-medium hover:scale-[1.02] active:scale-95 transition-transform">
        <Plus size={16} /> Добавить упаковку
      </button>

      {(creating || editing) && (
        <PackagingForm
          option={editing}
          onSave={async (data) => {
            try {
              if (editing) {
                await store.updatePackagingOption(editing.id, data);
                toast.success('Упаковка обновлена');
              } else {
                if (!data.id) { toast.error('Введите ID упаковки (например: gift_wrap)'); return; }
                if (store.packagingOptions.some(p => p.id === data.id)) { toast.error('ID уже используется. Выберите другой, например gift_wrap_2'); return; }
                await store.addPackagingOption({ id: data.id, name: data.name!, price: data.price!, active: data.active ?? true, image: data.image, images: data.images });
                toast.success('Упаковка добавлена');
              }
              setEditing(null); setCreating(false);
            } catch (err) {
              toast.error(getFriendlyActionError(err, 'Не удалось сохранить упаковку'));
            }
          }}
          onCancel={() => { setEditing(null); setCreating(false); }}
        />
      )}

      <div className="grid gap-3">
        {store.packagingOptions.map(p => (
          <div key={p.id} className="flex items-center gap-4 bg-card rounded-2xl p-4 border border-border/40 shadow-sm">
            {p.image || p.images?.length ? (
              <img src={resolveMediaUrl(p.image || p.images?.[0] || '')} alt="" className="w-10 h-10 rounded-xl object-cover border border-border/50" />
            ) : (
              <span className="text-2xl w-10 h-10 rounded-xl flex items-center justify-center bg-muted">🎀</span>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-display font-semibold text-sm">{p.name}</div>
              <div className="text-xs text-muted-foreground">id: {p.id} · {p.price} ₽</div>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={p.active}
                onChange={async (e) => {
                  try {
                    await store.updatePackagingOption(p.id, { active: e.target.checked });
                  } catch (err) {
                    const code = err instanceof Error ? err.message : '';
                    if (code === '401' || code === '403') toast.error('Нет доступа. Перезайдите в админку.');
                    else toast.error('Не удалось обновить упаковку');
                  }
                }}
              />
              Активна
            </label>
            <div className="flex gap-1.5">
              <button onClick={() => { setEditing(p); setCreating(false); }}
                title="Редактировать упаковку"
                aria-label="Редактировать упаковку"
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                <Pencil size={15} />
              </button>
              <button onClick={async () => {
                try {
                  await store.deletePackagingOption(p.id);
                  toast.success('Удалено');
                } catch (err) {
                  const code = err instanceof Error ? err.message : '';
                  if (code === '401' || code === '403') toast.error('Нет доступа. Перезайдите в админку.');
                  else toast.error('Не удалось удалить упаковку');
                }
              }}
                title="Удалить упаковку"
                aria-label="Удалить упаковку"
                className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PackagingForm({ option, onSave, onCancel }: {
  option: PackagingOption | null;
  onSave: (data: Partial<PackagingOption> & { id?: string }) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    id: option?.id || '',
    name: option?.name || '',
    price: option?.price || 0,
    active: option?.active ?? true,
    image: option?.image || '',
  });
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const isNew = !option;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedId = form.id.trim().toLowerCase().replace(/\s+/g, '_');
    if (!form.name.trim()) { toast.error('Введите название упаковки'); return; }
    if (isNew && !normalizedId) { toast.error('Введите ID упаковки (например: gift_wrap)'); return; }
    if (isNew && !/^[a-z0-9_/-]+$/.test(normalizedId)) {
      toast.error('ID может содержать только латиницу, цифры, "_" и "/"');
      return;
    }
    if (form.price < 0) { toast.error('Цена не может быть отрицательной'); return; }
    let cover = form.image.trim();
    if (cover.startsWith('data:image/')) {
      try {
        const webpUrl = await toWebpDataUrl(cover);
        const res = await api.uploadProductImage(webpUrl) as { url: string };
        cover = res.url;
      } catch {
        toast.error('Не удалось загрузить обложку');
        return;
      }
    }
    onSave({
      ...(isNew ? { id: normalizedId } : {}),
      name: form.name.trim(),
      price: Math.round(Number(form.price) || 0),
      active: Boolean(form.active),
      image: cover || undefined,
      images: [],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm mb-6 grid gap-4 sm:grid-cols-2">
      {isNew && (
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">ID</label>
          <input value={form.id} onChange={e => set('id', e.target.value)} className="admin-input" placeholder="gift_wrap" />
          <div className="text-[11px] text-muted-foreground mt-1">Только латиница, цифры и "_". Пробелы автоматически заменяются на "_".</div>
        </div>
      )}
      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Название</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} maxLength={80} className="admin-input" placeholder="Подарочная упаковка" />
      </div>
      <div className="sm:col-span-2">
        <ImageUpload value={form.image} onChange={v => set('image', v)} />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Цена ₽</label>
        <input type="number" value={form.price} onChange={e => set('price', +e.target.value)} className="admin-input" min={0} />
      </div>
      <div className="flex items-end">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} />
          Активна
        </label>
      </div>
      <div className="sm:col-span-2 flex gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm border border-border text-muted-foreground hover:bg-muted transition-colors">Отмена</button>
        <button type="submit"
          className="px-4 py-2 rounded-xl text-sm bg-primary text-primary-foreground font-medium hover:scale-[1.02] active:scale-95 transition-transform">
          {option ? 'Сохранить' : 'Добавить'}
        </button>
      </div>
    </form>
  );
}

/* ─── Categories Tab ─── */
function CategoriesTab({ store }: { store: ReturnType<typeof useStore> }) {
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState<{
    parentId?: string;
    group?: 'set' | 'single';
    showOnHome?: boolean;
    name?: string;
    slug?: string;
  } | null>(null);
  const [groupBusyId, setGroupBusyId] = useState<string | null>(null);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<'all' | 'root' | 'nested' | 'set' | 'single'>('all');
  const [search, setSearch] = useState('');
  const searchQuery = useMemo(() => search.trim().toLowerCase(), [search]);

  const colorOptions = [
    { value: 'candy-pink', label: '🩷 Розовый' },
    { value: 'candy-mint', label: '🌿 Мятный' },
    { value: 'candy-lavender', label: '💜 Лавандовый' },
    { value: 'candy-blue', label: '💙 Голубой' },
    { value: 'candy-banana', label: '💛 Банановый' },
  ];
  const categoriesById = useMemo(() => {
    return new Map(store.categories.map(c => [c.id, c]));
  }, [store.categories]);
  const getPathLabel = useCallback((id: string) => {
    return buildCategoryPathLabel(id, categoriesById);
  }, [categoriesById]);
  const compareCategoriesByOrder = useCallback((a: Category, b: Category) => {
    const ao = typeof a.categoryOrder === 'number' ? a.categoryOrder : Number.POSITIVE_INFINITY;
    const bo = typeof b.categoryOrder === 'number' ? b.categoryOrder : Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return getPathLabel(a.id).localeCompare(getPathLabel(b.id), 'ru');
  }, [getPathLabel]);
  const childrenByParent = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const c of store.categories) {
      const parentId = c.id.includes('/') ? c.id.split('/').slice(0, -1).join('/') : '';
      const list = map.get(parentId) || [];
      list.push(c);
      map.set(parentId, list);
    }
    for (const list of map.values()) {
      list.sort(compareCategoriesByOrder);
    }
    return map;
  }, [store.categories, compareCategoriesByOrder]);
  const categoriesSorted = useMemo(() => {
    const ordered: Array<Category & { pathLabel: string; depth: number; parentId: string }> = [];
    const visited = new Set<string>();
    const appendChildren = (parentId: string, depth: number) => {
      const children = childrenByParent.get(parentId) || [];
      for (const child of children) {
        visited.add(child.id);
        ordered.push({
          ...child,
          pathLabel: getPathLabel(child.id),
          depth,
          parentId,
        });
        appendChildren(child.id, depth + 1);
      }
    };
    appendChildren('', 0);
    const orphaned = store.categories
      .filter((c) => !visited.has(c.id))
      .sort(compareCategoriesByOrder);
    for (const orphan of orphaned) {
      const parentId = orphan.id.includes('/') ? orphan.id.split('/').slice(0, -1).join('/') : '';
      ordered.push({
        ...orphan,
        pathLabel: getPathLabel(orphan.id),
        depth: Math.max(orphan.id.split('/').length - 1, 0),
        parentId,
      });
    }
    return ordered;
  }, [childrenByParent, compareCategoriesByOrder, getPathLabel, store.categories]);
  const parentIdByCategoryId = useMemo(() => {
    return new Map(categoriesSorted.map((category) => [category.id, category.parentId]));
  }, [categoriesSorted]);
  const siblingIndexById = useMemo(() => {
    const map = new Map<string, number>();
    for (const siblings of childrenByParent.values()) {
      siblings.forEach((item, index) => map.set(item.id, index));
    }
    return map;
  }, [childrenByParent]);
  const visibleCategories = useMemo(() => {
    return categoriesSorted.filter(c => {
      const matchesFilter =
        (listFilter === 'root' && !c.id.includes('/'))
        || (listFilter === 'nested' && c.id.includes('/'))
        || (listFilter === 'set' && c.group === 'set')
        || (listFilter === 'single' && c.group === 'single')
        || listFilter === 'all';
      if (!matchesFilter) return false;
      if (!searchQuery) return true;
      const text = `${c.id} ${c.name} ${c.pathLabel}`.toLowerCase();
      return text.includes(searchQuery);
    });
  }, [categoriesSorted, listFilter, searchQuery]);
  const rootCount = useMemo(() => store.categories.filter(c => !c.id.includes('/')).length, [store.categories]);
  const nestedCount = useMemo(() => store.categories.filter(c => c.id.includes('/')).length, [store.categories]);
  const resetFilters = useCallback(() => {
    setListFilter('all');
    setSearch('');
  }, []);
  const closeEditor = useCallback(() => {
    setEditing(null);
    setCreating(false);
    setCreateDraft(null);
  }, []);
  const getProductCategories = useCallback((p: Product) => getProductCategoryIds(p), []);
  const updateSiblingOrder = useCallback(async (siblings: Category[], fromIndex: number, toIndex: number) => {
    if (reorderBusy || fromIndex < 0 || toIndex < 0 || toIndex >= siblings.length || fromIndex === toIndex) return;
    try {
      setReorderBusy(true);
      const next = [...siblings];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      await Promise.all(next.map((item, idx) => store.updateCategory(item.id, { categoryOrder: idx + 1 })));
      toast.success('Порядок категорий обновлен');
    } catch (err) {
      toast.error(getFriendlyActionError(err, 'Не удалось изменить порядок категорий'));
    } finally {
      setReorderBusy(false);
    }
  }, [reorderBusy, store]);
  const deleteCategoryWithConfirm = useCallback(async (category: Category) => {
    const affectedCategoryIds = store.categories
      .filter((item) => item.id === category.id || item.id.startsWith(`${category.id}/`))
      .map((item) => item.id);
    const affectedCategoryIdSet = new Set(affectedCategoryIds);
    const affectedProducts = store.products.filter((product) => {
      const ids = getProductCategories(product);
      return ids.some((id) => affectedCategoryIdSet.has(id));
    });
    const message = [
      `Удалить категорию "${category.name}"?`,
      affectedCategoryIds.length > 1 ? `Будет удалено категорий: ${affectedCategoryIds.length}` : null,
      affectedProducts.length ? `Товаров с этой категорией: ${affectedProducts.length}` : null,
    ].filter(Boolean).join('\n');
    if (!window.confirm(message)) return;
    try {
      await store.deleteCategory(category.id);
      toast.success('Удалено');
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === '401' || code === '403') toast.error('Нет доступа. Перезайдите в админку.');
      else toast.error(getFriendlyActionError(err, 'Не удалось удалить категорию'));
    }
  }, [getProductCategories, store]);
  const openCreateChild = useCallback((parent: Category) => {
    setEditing(null);
    setCreateDraft({
      parentId: parent.id,
      group: parent.group,
      showOnHome: false,
    });
    setCreating(true);
  }, []);
  const moveCategoryByDrop = useCallback(async (siblings: Category[], fromId: string, toId: string) => {
    const fromIndex = siblings.findIndex((item) => item.id === fromId);
    const toIndex = siblings.findIndex((item) => item.id === toId);
    await updateSiblingOrder(siblings, fromIndex, toIndex);
  }, [updateSiblingOrder]);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button onClick={() => { setCreating(true); setEditing(null); setCreateDraft(null); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-medium hover:scale-[1.02] active:scale-95 transition-transform">
          <Plus size={16} /> Добавить категорию
        </button>
        <div className="px-3 py-2 rounded-2xl border border-border/50 bg-card text-xs text-muted-foreground">
          Всего: {store.categories.length}
        </div>
        <div className="px-3 py-2 rounded-2xl border border-border/50 bg-card text-xs text-muted-foreground">
          Корневые: {rootCount}
        </div>
        <div className="px-3 py-2 rounded-2xl border border-border/50 bg-card text-xs text-muted-foreground">
          Вложенные: {nestedCount}
        </div>
      </div>

      {(creating || editing) && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] p-4 sm:p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <div className="bg-background rounded-2xl border border-border/40 shadow-xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="font-display font-semibold text-base">
                  {editing ? `Редактирование: ${editing.name}` : 'Новая категория'}
                </div>
                <button
                  type="button"
                  onClick={closeEditor}
                  title="Закрыть окно категории"
                  aria-label="Закрыть окно категории"
                  className="p-2 rounded-xl hover:bg-muted text-muted-foreground"
                >
                  <X size={16} />
                </button>
              </div>
              <CategoryForm
                category={editing}
                draft={createDraft}
                categories={store.categories}
                colorOptions={colorOptions}
                onSave={async (data) => {
                  try {
                    if (editing) { await store.updateCategory(editing.id, data); toast.success('Категория обновлена'); }
                    else { await store.addCategory(data as Omit<Category, 'id'> & { id?: string }); toast.success('Категория добавлена'); }
                    closeEditor();
                  } catch (err) {
                    toast.error(getFriendlyActionError(err, 'Не удалось сохранить категорию'));
                  }
                }}
                onCancel={closeEditor}
              />
            </div>
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="admin-input max-w-sm"
          placeholder="Поиск по названию, id или пути"
        />
        {(search || listFilter !== 'all') && (
          <button
            type="button"
            onClick={resetFilters}
            className="px-3 py-2 rounded-xl text-xs border border-border text-muted-foreground hover:bg-muted transition-colors"
          >
            Сбросить фильтры
          </button>
        )}
        {CATEGORY_LIST_FILTER_OPTIONS.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => setListFilter(item.key)}
            className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
              listFilter === item.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-foreground border-border hover:bg-muted'
            }`}
          >
            {item.label}
          </button>
        ))}
        <div className="ml-auto text-xs text-muted-foreground">
          Показано: {visibleCategories.length}
        </div>
      </div>

      <div className="grid gap-3">
        {visibleCategories.map(c => {
          const depth = c.depth;
          const parentId = c.parentId;
          const parent = parentId ? categoriesById.get(parentId) : null;
          const children = childrenByParent.get(c.id) || [];
          const siblings = childrenByParent.get(parentId) || [];
          const siblingIndex = siblingIndexById.get(c.id) ?? -1;
          const canDropHere = Boolean(draggedCategoryId && draggedCategoryId !== c.id && parentIdByCategoryId.get(draggedCategoryId) === parentId);
          return (
          <div
            key={c.id}
            className={`flex items-center gap-4 bg-card rounded-2xl p-4 border shadow-sm transition-colors ${
              dragOverCategoryId === c.id && canDropHere
                ? 'border-primary/50 bg-primary/5'
                : 'border-border/40'
            }`}
            style={{ marginLeft: `${depth * 16}px` }}
            onDragOver={(e) => {
              if (!draggedCategoryId || !canDropHere) return;
              e.preventDefault();
              setDragOverCategoryId(c.id);
            }}
            onDragLeave={() => {
              if (dragOverCategoryId === c.id) setDragOverCategoryId(null);
            }}
            onDrop={async (e) => {
              e.preventDefault();
              if (!draggedCategoryId || !canDropHere) return;
              await moveCategoryByDrop(siblings, draggedCategoryId, c.id);
              setDraggedCategoryId(null);
              setDragOverCategoryId(null);
            }}
          >
            <button
              type="button"
              draggable={!reorderBusy}
              onDragStart={() => setDraggedCategoryId(c.id)}
              onDragEnd={() => {
                setDraggedCategoryId(null);
                setDragOverCategoryId(null);
              }}
              className="p-2 rounded-xl text-muted-foreground hover:bg-muted cursor-grab active:cursor-grabbing disabled:opacity-40"
              disabled={reorderBusy}
              title="Перетащите для сортировки внутри текущего уровня"
              aria-label="Перетащите для сортировки внутри текущего уровня"
            >
              <Menu size={15} />
            </button>
            <span className="text-2xl w-10 h-10 rounded-xl flex items-center justify-center bg-muted">{c.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="font-display font-semibold text-sm">{c.name}</div>
              <div className="text-xs text-muted-foreground">id: {c.id}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{c.pathLabel}</div>
              <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span className="px-2 py-0.5 rounded-full bg-muted">
                  Родитель: {parent ? `${parent.emoji ? `${parent.emoji} ` : ''}${parent.name}` : (parentId ? 'нет (сирота)' : 'нет')}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-muted">
                  Подкатегорий: {children.length}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="text-muted-foreground">Группа:</span>
                <button
                  type="button"
                  onClick={async () => {
                    if (groupBusyId || c.group === 'set') return;
                    try {
                      setGroupBusyId(c.id);
                      await store.updateCategory(c.id, { group: 'set' });
                      toast.success('Категория перенесена в "Наборы"');
                    } catch (err) {
                      toast.error(getFriendlyActionError(err, 'Не удалось изменить группу'));
                    } finally {
                      setGroupBusyId(null);
                    }
                  }}
                  disabled={Boolean(groupBusyId) || c.group === 'set'}
                  className={`px-2 py-0.5 rounded-full border transition-colors ${
                    c.group === 'set'
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  } disabled:opacity-60`}
                >
                  Наборы
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (groupBusyId || c.group === 'single') return;
                    try {
                      setGroupBusyId(c.id);
                      await store.updateCategory(c.id, { group: 'single' });
                      toast.success('Категория перенесена в "Штучные товары"');
                    } catch (err) {
                      toast.error(getFriendlyActionError(err, 'Не удалось изменить группу'));
                    } finally {
                      setGroupBusyId(null);
                    }
                  }}
                  disabled={Boolean(groupBusyId) || c.group === 'single'}
                  className={`px-2 py-0.5 rounded-full border transition-colors ${
                    c.group === 'single'
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  } disabled:opacity-60`}
                >
                  Штучные
                </button>
              </div>
              {(c.showOnHome || typeof c.homeOrder === 'number') && (
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  {c.showOnHome && (
                    <span className="px-2 py-0.5 rounded-full bg-muted">Главная</span>
                  )}
                  <span className="px-2 py-0.5 rounded-full bg-muted">
                    Порядок: {typeof c.homeOrder === 'number' ? c.homeOrder : '—'}
                  </span>
                </div>
              )}
              <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span className="px-2 py-0.5 rounded-full bg-muted">
                  Порядок категории: {typeof c.categoryOrder === 'number' ? c.categoryOrder : '—'}
                </span>
              </div>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => updateSiblingOrder(siblings, siblingIndex, siblingIndex - 1)}
                disabled={reorderBusy || siblingIndex <= 0}
                title="Поднять категорию выше"
                aria-label="Поднять категорию выше"
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground disabled:opacity-40"
              >
                <ArrowUp size={15} />
              </button>
              <button
                onClick={() => updateSiblingOrder(siblings, siblingIndex, siblingIndex + 1)}
                disabled={reorderBusy || siblingIndex < 0 || siblingIndex >= siblings.length - 1}
                title="Опустить категорию ниже"
                aria-label="Опустить категорию ниже"
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground disabled:opacity-40"
              >
                <ArrowDown size={15} />
              </button>
              <button onClick={() => { setEditing(c); setCreating(false); setCreateDraft(null); }}
                title="Редактировать категорию"
                aria-label="Редактировать категорию"
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                <Pencil size={15} />
              </button>
              <button
                onClick={() => openCreateChild(c)}
                title="Добавить подкатегорию"
                aria-label="Добавить подкатегорию"
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
              >
                <Plus size={15} />
              </button>
              <button onClick={() => deleteCategoryWithConfirm(c)}
                title="Удалить категорию"
                aria-label="Удалить категорию"
                className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        );
        })}
        {visibleCategories.length === 0 && (
          <div className="text-sm text-muted-foreground">По выбранному фильтру категорий нет</div>
        )}
      </div>
    </div>
  );
}

function HomeCategoriesTab({ store }: { store: ReturnType<typeof useStore> }) {
  const [reorderBusy, setReorderBusy] = useState(false);
  const [sectionToggleBusyId, setSectionToggleBusyId] = useState<string | null>(null);

  const homeOrderList = useMemo(() => {
    const list = store.categories.filter(c => c.showOnHome);
    return list
      .map((c, index) => ({ c, index }))
      .sort((a, b) => {
        const ao = typeof a.c.homeOrder === 'number' ? a.c.homeOrder : Number.POSITIVE_INFINITY;
        const bo = typeof b.c.homeOrder === 'number' ? b.c.homeOrder : Number.POSITIVE_INFINITY;
        if (ao !== bo) return ao - bo;
        return a.c.name.localeCompare(b.c.name, 'ru') || a.index - b.index;
      })
      .map(x => x.c);
  }, [store.categories]);
  const homeSectionItems = useMemo(() => ([
    { id: 'categories', label: 'Категории' },
    { id: 'products', label: 'Ассортимент' },
    { id: 'benefits', label: 'Преимущества' },
    { id: 'reviews', label: 'Отзывы' },
    { id: 'articles', label: 'Статьи' },
    { id: 'promo', label: 'Промо-баннер' },
    { id: 'contact', label: 'Форма контакта' },
  ]), []);
  const hiddenSectionSet = useMemo(() => new Set(store.header?.hiddenSections || []), [store.header?.hiddenSections]);

  return (
    <div className="grid gap-4">
      <div className="bg-card rounded-2xl p-4 border border-border/40 shadow-sm">
        <div className="font-display font-semibold mb-3">Секции на главной</div>
        <div className="grid gap-2">
          {homeSectionItems.map(section => {
            const isHidden = hiddenSectionSet.has(section.id);
            return (
              <div key={section.id} className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/10 px-3 py-2">
                <div className="text-sm font-medium">{section.label}</div>
                <button
                  onClick={async () => {
                    if (sectionToggleBusyId) return;
                    try {
                      setSectionToggleBusyId(section.id);
                      const next = [...hiddenSectionSet];
                      const index = next.indexOf(section.id);
                      if (index >= 0) next.splice(index, 1);
                      else next.push(section.id);
                      await store.updateHeader({ hiddenSections: next });
                      toast.success(isHidden ? 'Секция показана на главной' : 'Секция скрыта с главной');
                    } catch (err) {
                      toast.error(getFriendlyActionError(err, 'Не удалось обновить видимость секции'));
                    } finally {
                      setSectionToggleBusyId(null);
                    }
                  }}
                  disabled={Boolean(sectionToggleBusyId)}
                  className={`px-3 py-1.5 rounded-xl text-xs border transition-colors disabled:opacity-40 ${
                    isHidden
                      ? 'border-border text-muted-foreground hover:bg-muted'
                      : 'border-primary/30 text-primary hover:bg-primary/10'
                  }`}
                >
                  {isHidden ? 'Скрыто' : 'Показано'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <div className="bg-card rounded-2xl p-4 border border-border/40 shadow-sm">
        <div className="font-display font-semibold mb-3">Порядок категорий на главной</div>
        <div className="grid gap-2">
          {homeOrderList.map((c, i) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/20 px-3 py-2">
              <span className="text-xs text-muted-foreground w-5 text-center">{i + 1}</span>
              <span className="text-lg">{c.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{c.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{c.id}</div>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={async () => {
                    if (reorderBusy || i === 0) return;
                    try {
                      setReorderBusy(true);
                      const next = [...homeOrderList];
                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                      await Promise.all(next.map((item, idx) => store.updateCategory(item.id, { homeOrder: idx + 1 })));
                    } catch (err) {
                      const code = err instanceof Error ? err.message : '';
                      if (code === '401' || code === '403') toast.error('Нет доступа. Перезайдите в админку.');
                      else toast.error('Не удалось обновить порядок');
                    } finally {
                      setReorderBusy(false);
                    }
                  }}
                  disabled={reorderBusy || i === 0}
                  title="Поднять категорию выше"
                  aria-label="Поднять категорию выше"
                  className="p-2 rounded-xl hover:bg-muted text-muted-foreground disabled:opacity-40"
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  onClick={async () => {
                    if (reorderBusy || i === homeOrderList.length - 1) return;
                    try {
                      setReorderBusy(true);
                      const next = [...homeOrderList];
                      [next[i + 1], next[i]] = [next[i], next[i + 1]];
                      await Promise.all(next.map((item, idx) => store.updateCategory(item.id, { homeOrder: idx + 1 })));
                    } catch (err) {
                      const code = err instanceof Error ? err.message : '';
                      if (code === '401' || code === '403') toast.error('Нет доступа. Перезайдите в админку.');
                      else toast.error('Не удалось обновить порядок');
                    } finally {
                      setReorderBusy(false);
                    }
                  }}
                  disabled={reorderBusy || i === homeOrderList.length - 1}
                  title="Опустить категорию ниже"
                  aria-label="Опустить категорию ниже"
                  className="p-2 rounded-xl hover:bg-muted text-muted-foreground disabled:opacity-40"
                >
                  <ArrowDown size={15} />
                </button>
              </div>
            </div>
          ))}
          {homeOrderList.length === 0 && (
            <div className="text-sm text-muted-foreground">Нет категорий, показываемых на главной</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Category Form ─── */
function CategoryForm({ category, draft, categories, colorOptions, onSave, onCancel }: {
  category: Category | null;
  draft?: {
    parentId?: string;
    group?: 'set' | 'single';
    showOnHome?: boolean;
    name?: string;
    slug?: string;
  } | null;
  categories: Category[];
  colorOptions: { value: string; label: string }[];
  onSave: (data: Partial<Category> & { id?: string }) => void;
  onCancel: () => void;
}) {
  const defaultShowOnHome = (id: string) => !id.includes('/') && id !== 'packaging';
  const baseId = category?.id || '';
  const parts = baseId ? baseId.split('/') : [];
  const initialParentId = category ? (parts.length > 1 ? parts.slice(0, -1).join('/') : '') : (draft?.parentId || '');
  const initialSlug = category ? (parts.length ? parts[parts.length - 1] : '') : (draft?.slug || '');
  const fallbackSetIds = useMemo(() => new Set(['gift', 'chocolate', 'truffles', 'asian', 'cookies']), []);
  const initialGroup = category?.group ?? draft?.group
    ?? (initialParentId
      ? (categories.find(c => c.id === initialParentId)?.group || (fallbackSetIds.has(initialParentId) ? 'set' : 'single'))
      : (fallbackSetIds.has(baseId) ? 'set' : 'single'));
  const [form, setForm] = useState({
    parentId: initialParentId,
    slug: initialSlug,
    name: category?.name || draft?.name || '',
    emoji: category?.emoji || '🍬',
    color: category?.color || 'candy-pink',
    group: initialGroup,
    showOnHome: category?.showOnHome ?? draft?.showOnHome ?? (baseId ? defaultShowOnHome(baseId) : !initialParentId),
    homeOrder: category?.homeOrder ?? '',
  });
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const isNew = !category;
  const parentOptions = useMemo(() => {
    return categories
      .filter(c => c.id !== category?.id)
      .map(c => ({ ...c, depth: c.id.split('/').length - 1 }))
      .sort((a, b) => a.id.localeCompare(b.id, 'ru'));
  }, [categories, category?.id]);
  const parentById = useMemo(() => {
    return new Map(categories.map(c => [c.id, c]));
  }, [categories]);
  const getParentPathLabel = useCallback((id: string) => {
    const parts = id.split('/').filter(Boolean);
    if (!parts.length) return id;
    const names: string[] = [];
    for (let i = 0; i < parts.length; i += 1) {
      const partialId = parts.slice(0, i + 1).join('/');
      names.push(parentById.get(partialId)?.name || parts[i]);
    }
    return names.join(' / ');
  }, [parentById]);
  const derivedId = (form.parentId ? `${form.parentId}/${form.slug}` : form.slug).trim();
  const currentParent = useMemo(() => {
    if (!form.parentId) return null;
    return parentById.get(form.parentId) || null;
  }, [form.parentId, parentById]);
  const currentChildren = useMemo(() => {
    const base = (category?.id || derivedId).trim();
    if (!base) return [] as Category[];
    return categories
      .filter(c => c.id.startsWith(`${base}/`) && c.id.split('/').length === base.split('/').length + 1)
      .sort((a, b) => getParentPathLabel(a.id).localeCompare(getParentPathLabel(b.id), 'ru'));
  }, [categories, category?.id, derivedId, getParentPathLabel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Введите название категории'); return; }
    if (!form.slug.trim()) { toast.error('Введите ID категории (латиницей)'); return; }
    const normalizedSlug = form.slug.trim().toLowerCase().replace(/\s+/g, '_');
    if (!/^[a-z0-9_-]+$/.test(normalizedSlug)) {
      toast.error('ID категории может содержать только латиницу, цифры, "_" и "-"');
      return;
    }
    const normalizedParent = form.parentId.trim();
    const id = (normalizedParent ? `${normalizedParent}/${normalizedSlug}` : normalizedSlug);
    const parsedOrder = form.homeOrder === '' ? undefined : Number(form.homeOrder);
    const homeOrder = Number.isFinite(parsedOrder) ? parsedOrder : undefined;
    onSave({
      ...(id ? { id } : {}),
      name: form.name.trim(),
      emoji: form.emoji,
      color: form.color,
      group: form.group,
      showOnHome: Boolean(form.showOnHome),
      homeOrder,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm grid gap-4 sm:grid-cols-2">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Родитель</label>
        <select
          value={form.parentId}
          onChange={e => {
            const value = e.target.value;
            setForm(f => ({
              ...f,
              parentId: value,
              showOnHome: f.showOnHome,
            }));
          }}
          className="admin-input"
        >
          <option value="">Без родителя</option>
          {parentOptions.map(c => (
            <option key={c.id} value={c.id}>
              {`${'— '.repeat(c.depth)}${c.emoji ? `${c.emoji} ` : ''}${getParentPathLabel(c.id)}`}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">ID (латиница)</label>
        <input value={form.slug} onChange={e => set('slug', e.target.value)} maxLength={30}
          className="admin-input" placeholder="например: candy" />
        <div className="text-[11px] text-muted-foreground mt-1">Используйте короткий ID без пробелов: candy, gift_box, sugar-free.</div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Раздел</label>
        <select value={form.group} onChange={e => set('group', e.target.value)} className="admin-input">
          <option value="set">Наборы</option>
          <option value="single">Штучные товары</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Порядок на главной</label>
        <input
          type="number"
          value={form.homeOrder}
          onChange={e => set('homeOrder', e.target.value === '' ? '' : Number(e.target.value))}
          className="admin-input"
          min={0}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Название</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} maxLength={50}
          className="admin-input" placeholder="Название категории" />
      </div>
      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Полный ID</label>
        <input value={derivedId} readOnly className="admin-input bg-muted/40" />
      </div>
      <div className="sm:col-span-2 rounded-xl border border-border/40 bg-muted/20 p-3">
        <div className="text-xs font-medium mb-2">Связи в иерархии</div>
        <div className="text-xs text-muted-foreground">
          Родитель: {currentParent ? `${currentParent.emoji ? `${currentParent.emoji} ` : ''}${getParentPathLabel(currentParent.id)}` : 'нет'}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Подкатегории: {currentChildren.length ? currentChildren.map(c => getParentPathLabel(c.id)).join(' · ') : 'нет'}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Эмодзи</label>
        <input value={form.emoji} onChange={e => set('emoji', e.target.value)} maxLength={4}
          className="admin-input text-2xl text-center" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Цвет</label>
        <select value={form.color} onChange={e => set('color', e.target.value)} className="admin-input">
          {colorOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <label className="sm:col-span-2 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(form.showOnHome)}
          onChange={e => set('showOnHome', e.target.checked)}
        />
        Показывать на главной
      </label>
      <div className="sm:col-span-2 flex gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm border border-border text-muted-foreground hover:bg-muted transition-colors">Отмена</button>
        <button type="submit"
          className="px-4 py-2 rounded-xl text-sm bg-primary text-primary-foreground font-medium hover:scale-[1.02] active:scale-95 transition-transform">
          {category ? 'Сохранить' : 'Добавить'}
        </button>
      </div>
    </form>
  );
}

function ReviewsTab({ store }: { store: ReturnType<typeof useStore> }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'all'>('pending');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editingPhotoId, setEditingPhotoId] = useState<number | null>(null);
  const [editingPhotoValue, setEditingPhotoValue] = useState('');
  const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
  const [editingReviewForm, setEditingReviewForm] = useState({ authorName: '', rating: 5, text: '' });
  const productsSorted = useMemo(() => {
    return [...store.products].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [store.products]);
  const productMap = useMemo(() => {
    return new Map(productsSorted.map(p => [p.id, p.name]));
  }, [productsSorted]);
  const [form, setForm] = useState({
    productId: productsSorted[0]?.id ?? 0,
    authorName: '',
    rating: 5,
    text: '',
    image: '',
    approved: true,
    createdAt: '',
  });
  const setFormField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!form.productId && productsSorted.length) {
      setForm(f => ({ ...f, productId: productsSorted[0].id }));
    }
  }, [productsSorted, form.productId]);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const list = await api.getReviews();
      setReviews(Array.isArray(list) ? list as Review[] : []);
    } catch {
      toast.error('Не удалось загрузить отзывы');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const formatDate = (value?: string) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return reviews;
    if (filter === 'approved') return reviews.filter(r => r.approved);
    return reviews.filter(r => !r.approved);
  }, [filter, reviews]);

  return (
    <div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!form.productId) { toast.error('Выберите товар'); return; }
          if (!form.authorName.trim()) { toast.error('Введите имя'); return; }
          if (!form.text.trim()) { toast.error('Введите текст'); return; }
          try {
            let image = form.image.trim();
            if (image.startsWith('data:image/')) {
              const uploaded = await api.uploadReviewImage(image) as { url?: unknown };
              image = typeof uploaded?.url === 'string' ? uploaded.url : '';
            }
            await api.addReview({
              productId: form.productId,
              authorName: form.authorName.trim(),
              rating: Number(form.rating) || 5,
              text: form.text.trim(),
              ...(image ? { image } : {}),
              approved: Boolean(form.approved),
              ...(form.createdAt ? { createdAt: form.createdAt } : {}),
            });
            toast.success('Отзыв добавлен');
            setForm(f => ({ ...f, authorName: '', rating: 5, text: '', image: '', approved: true, createdAt: '' }));
            loadReviews();
          } catch (err) {
            const code = err instanceof Error ? err.message : '';
            if (code === '401' || code === '403') toast.error('Нет доступа. Перезайдите в админку.');
            else toast.error('Не удалось добавить отзыв');
          }
        }}
        className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm mb-6 grid gap-4 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Товар</label>
          <select
            value={form.productId || ''}
            onChange={e => setFormField('productId', Number(e.target.value))}
            className="admin-input"
          >
            <option value="" disabled>Выберите товар</option>
            {productsSorted.map(p => (
              <option key={p.id} value={p.id}>{p.name} · #{p.id}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Имя</label>
          <input
            value={form.authorName}
            onChange={e => setFormField('authorName', e.target.value)}
            className="admin-input"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Оценка</label>
          <select value={form.rating} onChange={e => setFormField('rating', Number(e.target.value))} className="admin-input">
            {[5, 4, 3, 2, 1].map(v => (
              <option key={v} value={v}>{v} / 5</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Текст отзыва</label>
          <textarea
            value={form.text}
            onChange={e => setFormField('text', e.target.value)}
            rows={4}
            className="admin-input resize-none"
          />
        </div>
        <div className="sm:col-span-2">
          <ImageUpload value={form.image} onChange={v => setFormField('image', v)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Дата</label>
          <input
            type="date"
            value={form.createdAt}
            onChange={e => setFormField('createdAt', e.target.value)}
            className="admin-input"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(form.approved)}
            onChange={e => setFormField('approved', e.target.checked)}
          />
          Сразу опубликовать
        </label>
        <div className="sm:col-span-2 flex gap-2 justify-end">
          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-sm bg-primary text-primary-foreground font-medium hover:scale-[1.02] active:scale-95 transition-transform"
          >
            Добавить отзыв
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)} className="admin-input text-sm w-fit">
          <option value="pending">На модерации</option>
          <option value="approved">Опубликованные</option>
          <option value="all">Все</option>
        </select>
        <button
          type="button"
          onClick={() => loadReviews()}
          className="px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted transition-colors flex items-center gap-2"
        >
          <RotateCcw size={14} />
          Обновить
        </button>
        {loading && <span className="text-xs text-muted-foreground">Загрузка...</span>}
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground bg-card rounded-2xl p-6 border border-border/40 shadow-sm">Отзывов нет</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(r => (
            <div key={r.id} className="bg-card rounded-2xl p-4 border border-border/40 shadow-sm grid gap-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-display font-semibold text-sm">{r.authorName}</div>
                  <div className="text-xs text-muted-foreground">
                    {productMap.get(r.productId) || r.productName || `Товар #${r.productId}`} · {formatDate(r.createdAt) || '—'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] ${r.approved ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {r.approved ? 'Опубликован' : 'На модерации'}
                  </span>
                  <span className="text-xs font-medium">{r.rating} / 5</span>
                </div>
              </div>
              <div className="text-sm text-foreground/80 whitespace-pre-wrap">{r.text}</div>
              {editingReviewId === r.id && (
                <div className="grid gap-2">
                  <div className="grid sm:grid-cols-2 gap-2">
                    <input
                      value={editingReviewForm.authorName}
                      onChange={e => setEditingReviewForm(prev => ({ ...prev, authorName: e.target.value }))}
                      className="admin-input"
                      placeholder="Имя автора"
                    />
                    <select
                      value={editingReviewForm.rating}
                      onChange={e => setEditingReviewForm(prev => ({ ...prev, rating: Number(e.target.value) }))}
                      className="admin-input"
                    >
                      {[5, 4, 3, 2, 1].map(v => (
                        <option key={v} value={v}>{v} / 5</option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={editingReviewForm.text}
                    onChange={e => setEditingReviewForm(prev => ({ ...prev, text: e.target.value }))}
                    rows={3}
                    className="admin-input resize-none"
                    placeholder="Текст отзыва"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={async () => {
                        if (!editingReviewForm.authorName.trim()) { toast.error('Введите имя'); return; }
                        if (!editingReviewForm.text.trim()) { toast.error('Введите текст отзыва'); return; }
                        try {
                          setBusyId(r.id);
                          await api.updateReview(r.id, {
                            authorName: editingReviewForm.authorName.trim(),
                            rating: Number(editingReviewForm.rating) || 5,
                            text: editingReviewForm.text.trim(),
                          });
                          setReviews(prev => prev.map(x => (
                            x.id === r.id
                              ? {
                                ...x,
                                authorName: editingReviewForm.authorName.trim(),
                                rating: Number(editingReviewForm.rating) || 5,
                                text: editingReviewForm.text.trim(),
                              }
                              : x
                          )));
                          setEditingReviewId(null);
                          toast.success('Отзыв обновлён');
                        } catch (err) {
                          const code = err instanceof Error ? err.message : '';
                          if (code === '401' || code === '403') toast.error('Нет доступа. Перезайдите в админку.');
                          else toast.error('Не удалось обновить отзыв');
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      className="px-3 py-2 rounded-xl text-xs bg-primary text-primary-foreground disabled:opacity-50"
                    >
                      Сохранить отзыв
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => setEditingReviewId(null)}
                      className="px-3 py-2 rounded-xl text-xs border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
              {r.image && (
                <img
                  src={resolveMediaUrl(r.image)}
                  alt=""
                  className="w-full max-w-sm h-40 rounded-xl object-cover border border-border/40"
                  loading="lazy"
                />
              )}
              {editingPhotoId === r.id && (
                <div className="grid gap-2 max-w-sm">
                  <ImageUpload value={editingPhotoValue} onChange={setEditingPhotoValue} />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={async () => {
                        try {
                          setBusyId(r.id);
                          let nextImage = editingPhotoValue.trim();
                          if (nextImage.startsWith('data:image/')) {
                            const uploaded = await api.uploadReviewImage(nextImage) as { url?: unknown };
                            nextImage = typeof uploaded?.url === 'string' ? uploaded.url : '';
                          }
                          const payload = nextImage ? { image: nextImage } : { image: null };
                          await api.updateReview(r.id, payload);
                          setReviews(prev => prev.map(x => x.id === r.id ? { ...x, image: nextImage || undefined } : x));
                          setEditingPhotoId(null);
                          setEditingPhotoValue('');
                          toast.success(nextImage ? 'Фото обновлено' : 'Фото удалено');
                        } catch (err) {
                          const code = err instanceof Error ? err.message : '';
                          if (code === '401' || code === '403') toast.error('Нет доступа. Перезайдите в админку.');
                          else toast.error('Не удалось сохранить фото');
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      className="px-3 py-2 rounded-xl text-xs bg-primary text-primary-foreground disabled:opacity-50"
                    >
                      Сохранить фото
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => setEditingPhotoValue('')}
                      className="px-3 py-2 rounded-xl text-xs border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      Удалить фото
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => {
                        setEditingPhotoId(null);
                        setEditingPhotoValue('');
                      }}
                      className="px-3 py-2 rounded-xl text-xs border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => {
                    setEditingReviewId(null);
                    setEditingPhotoId(r.id);
                    setEditingPhotoValue(r.image || '');
                  }}
                  className="px-3 py-2 rounded-xl text-xs border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {r.image ? 'Редактировать фото' : 'Добавить фото'}
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => {
                    setEditingPhotoId(null);
                    setEditingPhotoValue('');
                    setEditingReviewId(r.id);
                    setEditingReviewForm({
                      authorName: r.authorName || '',
                      rating: Number(r.rating) || 5,
                      text: r.text || '',
                    });
                  }}
                  className="px-3 py-2 rounded-xl text-xs border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Редактировать отзыв
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={async () => {
                    try {
                      setBusyId(r.id);
                      await api.updateReview(r.id, { approved: !r.approved });
                      setReviews(prev => prev.map(x => x.id === r.id ? { ...x, approved: !x.approved } : x));
                    } catch (err) {
                      const code = err instanceof Error ? err.message : '';
                      if (code === '401' || code === '403') toast.error('Нет доступа. Перезайдите в админку.');
                      else toast.error('Не удалось обновить отзыв');
                    } finally {
                      setBusyId(null);
                    }
                  }}
                  className="px-3 py-2 rounded-xl text-xs border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {r.approved ? 'Снять с публикации' : 'Одобрить'}
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={async () => {
                    try {
                      setBusyId(r.id);
                      await api.deleteReview(r.id);
                      setReviews(prev => prev.filter(x => x.id !== r.id));
                      toast.success('Удалено');
                    } catch (err) {
                      const code = err instanceof Error ? err.message : '';
                      if (code === '401' || code === '403') toast.error('Нет доступа. Перезайдите в админку.');
                      else toast.error('Не удалось удалить отзыв');
                    } finally {
                      setBusyId(null);
                    }
                  }}
                  className="px-3 py-2 rounded-xl text-xs border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OrdersTab({ store }: { store: ReturnType<typeof useStore> }) {
  const [drafts, setDrafts] = useState<Record<number, Partial<Order>>>({});
  const statusOptions: { value: string; label: string }[] = [
    { value: 'processing', label: 'В обработке' },
    { value: 'handed', label: 'Передан' },
    { value: 'delivered', label: 'Доставлен' },
    { value: 'cancelled', label: 'Отменён' },
  ];

  const updateDraft = (id: number, data: Partial<Order>) => {
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], ...data } }));
  };

  const save = async (id: number) => {
    const data = drafts[id];
    if (!data) return;
    try {
      await store.updateOrder(id, data);
      toast.success('Заказ обновлён');
      setDrafts(prev => {
        const { [id]: _omit, ...rest } = prev;
        return rest;
      });
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === '401' || code === '403') toast.error('Нет доступа. Перезайдите в админку.');
      else toast.error('Не удалось обновить заказ');
    }
  };

  const orders = store.orders || [];

  if (!orders.length) {
    return (
      <div className="text-center py-16 bg-card rounded-2xl border border-border/40 shadow-sm">
        <span className="text-5xl mb-4 block">🧾</span>
        <p className="font-display text-lg text-muted-foreground">Заказов пока нет</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {orders.map(o => {
        const draft = drafts[o.id] || {};
        const status = (draft.status ?? o.status ?? 'processing') as string;
        const deliveryStatus = (draft.deliveryStatus ?? o.deliveryStatus ?? '') as string;
        const deliveryProvider = (draft.deliveryProvider ?? o.deliveryProvider ?? '') as string;
        const trackingNumber = (draft.trackingNumber ?? o.trackingNumber ?? '') as string;
        const created = o.createdAt ? new Date(o.createdAt).toLocaleString('ru-RU') : '';
        const hasChanges = Boolean(drafts[o.id]);
        return (
          <div key={o.id} className="bg-card rounded-2xl p-4 border border-border/40 shadow-sm grid gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-semibold text-sm">Заказ #{o.id}</span>
                  {created && <span className="text-xs text-muted-foreground">{created}</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{o.contact.name} · {o.contact.phone}</div>
                <div className="text-xs text-muted-foreground mt-1">{o.delivery.method} · {o.delivery.address}</div>
                <div className="text-xs text-muted-foreground mt-1">Оплата: {o.delivery.payment}</div>
                <div className="text-xs text-muted-foreground mt-1">Сумма: {o.total} ₽ · Скидка: {o.discount} ₽</div>
                {o.promo && <div className="text-xs text-muted-foreground mt-1">Промо: {o.promo}</div>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => save(o.id)}
                  disabled={!hasChanges}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${hasChanges ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                >
                  Сохранить
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Статус</label>
                <select
                  value={status}
                  onChange={e => updateDraft(o.id, { status: e.target.value })}
                  className="admin-input text-xs"
                >
                  {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Доставка: статус</label>
                <input
                  value={deliveryStatus}
                  onChange={e => updateDraft(o.id, { deliveryStatus: e.target.value })}
                  placeholder="Передан курьеру"
                  className="admin-input text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Служба</label>
                <input
                  value={deliveryProvider}
                  onChange={e => updateDraft(o.id, { deliveryProvider: e.target.value })}
                  placeholder="CDEK, Boxberry"
                  className="admin-input text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Трек-номер</label>
                <input
                  value={trackingNumber}
                  onChange={e => updateDraft(o.id, { trackingNumber: e.target.value })}
                  placeholder="1234567890"
                  className="admin-input text-xs"
                />
              </div>
            </div>

            <div className="bg-muted/50 rounded-xl p-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">Состав заказа</div>
              <div className="grid gap-1">
                {o.items.map(item => {
                  const packagingPrice = item.packagingPrice || 0;
                  const unit = item.price + packagingPrice;
                  const line = unit * item.quantity;
                  return (
                    <div key={item.id} className="flex items-center justify-between text-xs gap-3">
                      <span className="text-foreground truncate">
                        {item.name} × {item.quantity}
                        {packagingPrice > 0 && item.packagingName ? ` · упаковка: ${item.packagingName} (+${packagingPrice} ₽)` : ''}
                      </span>
                      <span className="text-muted-foreground whitespace-nowrap">{line} ₽</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Badges Tab ─── */
function BadgesTab({ store }: { store: ReturnType<typeof useStore> }) {
  const [editing, setEditing] = useState<Badge | null>(null);
  const [creating, setCreating] = useState(false);

  const toneOptions: { value: BadgeTone; label: string }[] = [
    { value: 'primary', label: 'Основной' },
    { value: 'secondary', label: 'Вторичный' },
    { value: 'destructive', label: 'Акцент' },
  ];

  return (
    <div>
      <button onClick={() => { setCreating(true); setEditing(null); }}
        className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-medium hover:scale-[1.02] active:scale-95 transition-transform">
        <Plus size={16} /> Добавить бейдж
      </button>

      {(creating || editing) && (
        <BadgeForm
          badge={editing}
          toneOptions={toneOptions}
          onSave={(data) => {
            if (editing) {
              store.updateBadge(editing.id, data);
              toast.success('Бейдж обновлён');
            } else {
              if (data.id && store.badges.some(b => b.id === data.id)) {
                toast.error('ID уже используется');
                return;
              }
              store.addBadge(data as Badge);
              toast.success('Бейдж добавлен');
            }
            setEditing(null); setCreating(false);
          }}
          onCancel={() => { setEditing(null); setCreating(false); }}
        />
      )}

      <div className="grid gap-3">
        {store.badges.map(b => {
          const count = store.products.filter(p => getProductBadgeIds(p).includes(b.id)).length;
          return (
            <div key={b.id} className="flex items-center gap-4 bg-card rounded-2xl p-4 border border-border/40 shadow-sm">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${b.active ? badgeToneClasses[b.tone] : 'bg-muted text-muted-foreground'}`}>
                {b.label}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">id: {b.id} · {count} товаров</div>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={b.active} onChange={e => store.updateBadge(b.id, { active: e.target.checked })} />
                Активен
              </label>
              <div className="flex gap-1.5">
                <button onClick={() => { setEditing(b); setCreating(false); }}
                  title="Редактировать бейдж"
                  aria-label="Редактировать бейдж"
                  className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                  <Pencil size={15} />
                </button>
                <button onClick={() => { store.deleteBadge(b.id); toast.success('Удалено'); }}
                  title="Удалить бейдж"
                  aria-label="Удалить бейдж"
                  className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Badge Form ─── */
function BadgeForm({ badge, toneOptions, onSave, onCancel }: {
  badge: Badge | null;
  toneOptions: { value: BadgeTone; label: string }[];
  onSave: (data: Partial<Badge> & { id?: string }) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    id: badge?.id || '',
    label: badge?.label || '',
    tone: badge?.tone || 'primary',
    active: badge?.active ?? true,
  });
  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));
  const isNew = !badge;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label.trim()) { toast.error('Введите название'); return; }
    if (isNew && !form.id.trim()) { toast.error('Введите ID бейджа'); return; }
    onSave({
      ...(isNew ? { id: form.id.trim().toLowerCase().replace(/\s+/g, '_') } : {}),
      label: form.label.trim(),
      tone: form.tone as BadgeTone,
      active: Boolean(form.active),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm mb-6 grid gap-4 sm:grid-cols-2">
      {isNew && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">ID (латиница)</label>
          <input value={form.id} onChange={e => set('id', e.target.value)} maxLength={30}
            className="admin-input" placeholder="например: limited" />
        </div>
      )}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Название</label>
        <input value={form.label} onChange={e => set('label', e.target.value)} maxLength={40}
          className="admin-input" placeholder="Например: Хит" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Цвет</label>
        <select value={form.tone} onChange={e => set('tone', e.target.value)} className="admin-input">
          {toneOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Статус</label>
        <select value={String(form.active)} onChange={e => set('active', e.target.value === 'true')} className="admin-input">
          <option value="true">Активен</option>
          <option value="false">Выключен</option>
        </select>
      </div>
      <div className="sm:col-span-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Пример</span>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${badgeToneClasses[form.tone as BadgeTone]}`}>
          {form.label || 'Бейдж'}
        </span>
      </div>
      <div className="sm:col-span-2 flex gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm border border-border text-muted-foreground hover:bg-muted transition-colors">Отмена</button>
        <button type="submit"
          className="px-4 py-2 rounded-xl text-sm bg-primary text-primary-foreground font-medium hover:scale-[1.02] active:scale-95 transition-transform">
          {badge ? 'Сохранить' : 'Добавить'}
        </button>
      </div>
    </form>
  );
}

/* ─── Promos Tab ─── */
function PromosTab({ store }: { store: ReturnType<typeof useStore> }) {
  const [editing, setEditing] = useState<Promo | null>(null);
  const [creating, setCreating] = useState(false);
  const activeCount = store.promos?.filter(p => p.active).length || 0;

  return (
    <div>
      <div className="mb-4 rounded-2xl border border-border/40 bg-card p-4 text-sm">
        <div className="font-medium">Промокоды вместо акций</div>
        <div className="text-muted-foreground mt-1">
          Сейчас блок на главной использует активные промокоды автоматически. Активно: {activeCount}.
        </div>
      </div>
      <button onClick={() => { setCreating(true); setEditing(null); }}
        className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-medium hover:scale-[1.02] active:scale-95 transition-transform">
        <Plus size={16} /> Добавить промокод
      </button>

      {(creating || editing) && (
        <PromoForm
          promo={editing}
          categories={store.categories}
          onSave={async (data) => {
            try {
              if (editing) { await store.updatePromo(editing.id, data); toast.success('Промокод обновлён'); }
              else { await store.addPromo(data as any); toast.success('Промокод добавлен'); }
              setEditing(null); setCreating(false);
            } catch (err) {
              toast.error(getFriendlyActionError(err, 'Не удалось сохранить промокод'));
            }
          }}
          onCancel={() => { setEditing(null); setCreating(false); }}
        />
      )}

      <div className="grid gap-3">
        {store.promos?.map(pr => (
          <div key={pr.id} className="flex items-center gap-4 bg-card rounded-2xl p-4 border border-border/40 shadow-sm">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display font-semibold text-sm">{pr.code}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-primary/10 text-primary">{pr.percent}%</span>
                <span className="text-xs text-muted-foreground">· {pr.scope}</span>
                {!pr.active && <span className="text-xs text-destructive ml-2">выключен</span>}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {pr.scope === 'all' ? 'на все товары' : pr.scope === 'category' ? `категории: ${(pr.categories || []).join(', ')}` : `товары: ${(pr.products || []).join(', ')}`}
              </div>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => { setEditing(pr); setCreating(false); }}
                title="Редактировать промокод"
                aria-label="Редактировать промокод"
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                <Pencil size={15} />
              </button>
              <button onClick={async () => {
                try {
                  await store.deletePromo(pr.id);
                  toast.success('Удалено');
                } catch (err) {
                  const code = err instanceof Error ? err.message : '';
                  if (code === '401' || code === '403') toast.error('Нет доступа. Перезайдите в админку.');
                  else toast.error('Не удалось удалить промокод');
                }
              }}
                title="Удалить промокод"
                aria-label="Удалить промокод"
                className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PromoForm({ promo, categories, onSave, onCancel }: {
  promo: Promo | null;
  categories: Category[];
  onSave: (data: Partial<Promo> & { code: string; percent: number; scope: PromoScope; categories?: string[]; products?: number[]; active?: boolean }) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    code: promo?.code || '',
    percent: promo?.percent || 10,
    scope: promo?.scope || 'all',
    categories: promo?.categories ? [...promo.categories] : [] as string[],
    products: promo?.products ? promo.products.join(',') : '',
    active: promo?.active !== false,
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }));
  const isNew = !promo;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) { toast.error('Введите код промокода (например: SWEET15)'); return; }
    if (form.percent <= 0 || form.percent > 90) { toast.error('Скидка должна быть от 1% до 90%'); return; }
    const payload: Parameters<typeof onSave>[0] = {
      code: form.code.trim().toUpperCase(),
      percent: Number(form.percent),
      scope: form.scope as PromoScope,
      active: Boolean(form.active),
    };
    if (form.scope === 'category') {
      const categoryIds = form.categories.filter(Boolean);
      if (!categoryIds.length) { toast.error('Выберите хотя бы одну категорию для промокода'); return; }
      payload.categories = categoryIds;
    }
    if (form.scope === 'product') {
      const ids = form.products.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n > 0);
      if (!ids.length) { toast.error('Введите хотя бы один ID товара, например: 1,2,5'); return; }
      payload.products = ids;
    }
    onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm mb-6 grid gap-4 sm:grid-cols-2">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Код</label>
        <input value={form.code} onChange={e => set('code', e.target.value)} maxLength={30} className="admin-input" placeholder="например: SWEET15" />
        <div className="text-[11px] text-muted-foreground mt-1">Код сохранится в верхнем регистре. Избегайте пробелов.</div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Скидка, %</label>
        <input type="number" value={form.percent} onChange={e => set('percent', +e.target.value)} className="admin-input" min={1} max={90} />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Область</label>
        <select value={form.scope} onChange={e => set('scope', e.target.value as PromoScope)} className="admin-input">
          <option value="all">Все товары</option>
          <option value="category">Категории</option>
          <option value="product">Отдельные товары</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Статус</label>
        <select value={String(form.active)} onChange={e => set('active', e.target.value === 'true')} className="admin-input">
          <option value="true">Активен</option>
          <option value="false">Выключен</option>
        </select>
      </div>
      {form.scope === 'category' && (
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Категории</label>
          <div className="flex flex-wrap gap-2">
            {categories.map(c => (
              <label key={c.id} className={`px-3 py-1 rounded-full text-xs cursor-pointer ${form.categories.includes(c.id) ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                <input
                  type="checkbox"
                  checked={form.categories.includes(c.id)}
                  onChange={(e) => {
                    set('categories', e.target.checked ? [...form.categories, c.id] : form.categories.filter(x => x !== c.id));
                  }}
                  className="hidden"
                />
                {c.emoji} {c.name}
              </label>
            ))}
          </div>
        </div>
      )}
      {form.scope === 'product' && (
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">ID товаров (через запятую)</label>
          <input value={form.products} onChange={e => set('products', e.target.value)} className="admin-input" placeholder="например: 1,2,5" />
          <div className="text-[11px] text-muted-foreground mt-1">Посмотреть ID можно на вкладке «Товары»</div>
        </div>
      )}
      <div className="sm:col-span-2 flex gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm border border-border text-muted-foreground hover:bg-muted transition-colors">Отмена</button>
        <button type="submit"
          className="px-4 py-2 rounded-xl text-sm bg-primary text-primary-foreground font-medium hover:scale-[1.02] active:scale-95 transition-transform">
          {promo ? 'Сохранить' : 'Добавить'}
        </button>
      </div>
    </form>
  );
}

/* ─── Articles Tab ─── */
function ArticlesTab({ store }: { store: ReturnType<typeof useStore> }) {
  const [editing, setEditing] = useState<Article | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <button onClick={() => { setCreating(true); setEditing(null); }}
        className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-medium hover:scale-[1.02] active:scale-95 transition-transform">
        <Plus size={16} /> Добавить статью
      </button>

      {(creating || editing) && (
        <ArticleForm
          products={store.products}
          categories={store.categories}
          article={editing}
          onSave={async (data) => {
            try {
              if (editing) { await store.updateArticle(editing.id, data); toast.success('Статья обновлена'); }
              else { await store.addArticle(data as Omit<Article, 'id'>); toast.success('Статья добавлена'); }
              setEditing(null); setCreating(false);
            } catch (err) {
              toast.error(getFriendlyActionError(err, 'Не удалось сохранить статью'));
            }
          }}
          onCancel={() => { setEditing(null); setCreating(false); }}
        />
      )}

      <div className="grid gap-3">
        {store.articles.map(a => (
          <div key={a.id} className="flex items-center gap-4 bg-card rounded-2xl p-4 border border-border/40 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileText size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-display font-semibold text-sm truncate block">{a.title}</span>
              <span className="text-xs text-muted-foreground">{a.tag} · {a.readTime}</span>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => { setEditing(a); setCreating(false); }}
                title="Редактировать статью"
                aria-label="Редактировать статью"
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                <Pencil size={15} />
              </button>
              <button onClick={async () => {
                try {
                  await store.deleteArticle(a.id);
                  toast.success('Удалено');
                } catch (err) {
                  const code = err instanceof Error ? err.message : '';
                  if (code === '401' || code === '403') toast.error('Нет доступа. Перезайдите в админку.');
                  else toast.error('Не удалось удалить статью');
                }
              }}
                title="Удалить статью"
                aria-label="Удалить статью"
                className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── slug helper ─── */
function toSlug(text: string) {
  const ru: Record<string, string> = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };
  return text.toLowerCase().split('').map(c => ru[c] ?? c).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

/* ─── Article Form ─── */
function ArticleForm({ article, onSave, onCancel, products, categories }: {
  article: Article | null;
  onSave: (data: Partial<Article>) => void;
  onCancel: () => void;
  products: Product[];
  categories: Category[];
}) {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: article?.title || '', excerpt: article?.excerpt || '',
    content: article?.content || '',
    tag: article?.tag || 'Советы', readTime: article?.readTime || '5 мин',
    image: article?.image || '', slug: article?.slug || '',
    productId: article?.productId ? String(article.productId) : '',
    categoryId: article?.categoryId || '',
    images: article?.images || [],
    videoUrl: article?.videoUrl || '',
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setImages = (next: string[]) => setForm(f => ({ ...f, images: next }));
  const maxImages = 7;

  const addImages = async (files: FileList | null) => {
    const result = await appendValidatedImages({
      files,
      currentImages: form.images,
      maxImages,
      maxImagesError: 'Макс. 7 фото',
    });
    if (result) setImages(result);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Введите заголовок'); return; }
    if (!form.excerpt.trim()) { toast.error('Введите краткое описание для карточки статьи'); return; }
    const slug = form.slug.trim() || toSlug(form.title);
    if (!slug.trim()) { toast.error('Не удалось сформировать ссылку статьи. Добавьте заголовок латиницей или заполните slug вручную.'); return; }
    if (form.images.length > 7) { toast.error('Макс. 7 фото'); return; }
    let cover = form.image.trim();
    let images: string[] = [];
    try {
      for (const u of form.images) {
        if (u.startsWith('data:image/')) {
          const webpUrl = await toWebpDataUrl(u);
          const res = await api.uploadArticleImage(webpUrl) as { url: string };
          images.push(res.url);
        } else {
          images.push(u);
        }
      }
    } catch {
      images = form.images;
    }
    if (cover.startsWith('data:image/')) {
      try {
        const webpUrl = await toWebpDataUrl(cover);
        const res = await api.uploadArticleImage(webpUrl) as { url: string };
        cover = res.url;
      } catch {
        toast.error('Не удалось загрузить обложку');
        return;
      }
    }
    let videoUrl = form.videoUrl.trim();
    if (videoUrl.startsWith('data:video/')) {
      try {
        const res = await api.uploadArticleVideo(videoUrl) as { url: string };
        videoUrl = res.url;
      } catch {
        toast.error('Не удалось загрузить видео');
        return;
      }
    }
    const fallbackCover = cover || images[0] || '';
    onSave({
      title: form.title.trim(),
      excerpt: form.excerpt.trim(),
      content: form.content.trim() || undefined,
      tag: form.tag,
      readTime: form.readTime,
      image: fallbackCover || undefined,
      images: images.length ? images : undefined,
      videoUrl: videoUrl || undefined,
      slug,
      productId: form.productId ? Number(form.productId) : undefined,
      categoryId: form.categoryId || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm mb-6 grid gap-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Заголовок</label>
        <input value={form.title} onChange={e => set('title', e.target.value)} maxLength={200} className="admin-input" placeholder="Заголовок статьи" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Краткое описание (excerpt)</label>
        <textarea value={form.excerpt} onChange={e => set('excerpt', e.target.value)} maxLength={500}
          rows={2} className="admin-input resize-none" placeholder="Краткое описание для карточки..." />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Полный текст статьи</label>
        <textarea value={form.content} onChange={e => set('content', e.target.value)} maxLength={5000}
          rows={8} className="admin-input resize-y" placeholder="Полный текст статьи. Поддерживается: ## Заголовок, **жирный**, - список, 1. нумерация" />
      </div>
      <div>
        <ImageUpload value={form.image} onChange={v => set('image', v)} />
      </div>
      <div>
        <VideoUpload value={form.videoUrl} onChange={v => set('videoUrl', v)} />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Галерея (до 7 фото)</label>
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            {form.images.map((u, i) => (
              <div key={i} className="relative">
                <img src={resolveMediaUrl(u)} alt="" className="w-20 h-20 object-cover rounded-xl border" />
                <button type="button" onClick={() => setImages(form.images.filter((_, idx) => idx !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => galleryInputRef.current?.click()}
              className="px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted transition-colors flex items-center gap-2">
              <Upload size={14} />
              Добавить фото
            </button>
            <span className="text-[11px] text-muted-foreground">Добавлено: {form.images.length}/{maxImages}</span>
            <input
              ref={galleryInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={e => { addImages(e.target.files); e.currentTarget.value = ''; }}
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Тег</label>
          <select value={form.tag} onChange={e => set('tag', e.target.value)} className="admin-input">
            <option>Советы</option><option>Обзор</option><option>Здоровье</option><option>Рецепты</option><option>Новости</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Время чтения</label>
          <input value={form.readTime} onChange={e => set('readTime', e.target.value)} className="admin-input" placeholder="5 мин" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Связанный товар (опционально)</label>
        <select value={form.productId} onChange={e => set('productId', e.target.value)} className="admin-input">
          <option value="">— не выбрано —</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name} (id: {p.id})</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Связанная категория (опционально)</label>
        <select value={form.categoryId} onChange={e => set('categoryId', e.target.value)} className="admin-input">
          <option value="">— не выбрано —</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.name} (id: {c.id})</option>)}
        </select>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm border border-border text-muted-foreground hover:bg-muted transition-colors">Отмена</button>
        <button type="submit"
          className="px-4 py-2 rounded-xl text-sm bg-primary text-primary-foreground font-medium hover:scale-[1.02] active:scale-95 transition-transform">
          {article ? 'Сохранить' : 'Добавить'}
        </button>
      </div>
    </form>
  );
}

function FeatureBlocksTab({ store }: { store: ReturnType<typeof useStore> }) {
  const [blocks, setBlocks] = useState<FeatureBlock[]>(store.featureBlocks || []);
  const iconOptions = [
    { value: 'Truck', label: '🚚 Доставка' },
    { value: 'ShieldCheck', label: '🛡️ Состав' },
    { value: 'Gift', label: '🎁 Упаковка' },
    { value: 'Heart', label: '❤️ Любовь' },
  ];
  const colorOptions = [
    { value: 'bg-candy-pink', label: '🩷 Розовый' },
    { value: 'bg-candy-mint', label: '🌿 Мятный' },
    { value: 'bg-candy-lavender', label: '💜 Лавандовый' },
    { value: 'bg-candy-blue', label: '💙 Голубой' },
    { value: 'bg-candy-banana', label: '💛 Банановый' },
  ];

  useEffect(() => {
    setBlocks(store.featureBlocks || []);
  }, [store.featureBlocks]);

  const updateBlock = (id: string, patch: Partial<FeatureBlock>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
  };

  const handleSave = async () => {
    if (!blocks.length) { toast.error('Добавьте хотя бы один блок'); return; }
    try {
      await store.updateFeatureBlocks(blocks.map(b => ({
        ...b,
        title: b.title?.trim() || 'Без названия',
        description: b.description?.trim() || '',
        link: b.link?.trim() || '',
        icon: b.icon || 'Truck',
        bgColor: b.bgColor || 'bg-candy-pink',
      })));
      toast.success('Блоки обновлены');
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === '401' || code === '403') toast.error('Нет доступа. Перезайдите в админку.');
      else toast.error('Не удалось обновить блоки');
    }
  };

  return (
    <div className="grid gap-4">
      {blocks.map((b) => (
        <div key={b.id} className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm grid gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Заголовок</label>
              <input value={b.title} onChange={e => updateBlock(b.id, { title: e.target.value })} maxLength={60}
                className="admin-input" placeholder="Быстрая доставка" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Ссылка</label>
              <input value={b.link} onChange={e => updateBlock(b.id, { link: e.target.value })}
                className="admin-input" placeholder="/articles/..." />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Описание</label>
            <textarea value={b.description} onChange={e => updateBlock(b.id, { description: e.target.value })} maxLength={160}
              rows={2} className="admin-input resize-none" placeholder="Короткое описание" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Иконка</label>
              <select value={b.icon} onChange={e => updateBlock(b.id, { icon: e.target.value })} className="admin-input">
                {iconOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Цвет фона</label>
              <select value={b.bgColor} onChange={e => updateBlock(b.id, { bgColor: e.target.value })} className="admin-input">
                {colorOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      ))}
      <div className="flex justify-end">
        <button type="button" onClick={handleSave}
          className="px-4 py-2 rounded-xl text-sm bg-primary text-primary-foreground font-medium hover:scale-[1.02] active:scale-95 transition-transform">
          Сохранить
        </button>
      </div>
    </div>
  );
}

function HeaderTab({ store }: { store: ReturnType<typeof useStore> }) {
  const [form, setForm] = useState(() => ({
    brandName: store.header?.brandName || headerFallback.brandName,
    brandTextColor: store.header?.brandTextColor || headerFallback.brandTextColor,
    menuButtonBg: store.header?.menuButtonBg || headerFallback.menuButtonBg,
    menuButtonTextColor: store.header?.menuButtonTextColor || headerFallback.menuButtonTextColor,
  }));

  useEffect(() => {
    setForm({
      brandName: store.header?.brandName || headerFallback.brandName,
      brandTextColor: store.header?.brandTextColor || headerFallback.brandTextColor,
      menuButtonBg: store.header?.menuButtonBg || headerFallback.menuButtonBg,
      menuButtonTextColor: store.header?.menuButtonTextColor || headerFallback.menuButtonTextColor,
    });
  }, [store.header]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }));
  const isHex = (v: string) => /^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/.test(v.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brandName.trim()) { toast.error('Введите название в хедере'); return; }
    if (!isHex(form.brandTextColor)) { toast.error('Цвет текста возле лого должен быть HEX'); return; }
    if (!isHex(form.menuButtonBg)) { toast.error('Цвет кнопки должен быть HEX'); return; }
    if (!isHex(form.menuButtonTextColor)) { toast.error('Цвет текста кнопки должен быть HEX'); return; }
    try {
      await store.updateHeader({
        brandName: form.brandName.trim(),
        brandTextColor: form.brandTextColor.trim(),
        menuButtonBg: form.menuButtonBg.trim(),
        menuButtonTextColor: form.menuButtonTextColor.trim(),
      });
      toast.success('Хедер обновлён');
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === '401' || code === '403') toast.error('Нет доступа. Перезайдите в админку.');
      else toast.error('Не удалось обновить хедер');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm grid gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Название возле лого</label>
          <input value={form.brandName} onChange={e => set('brandName', e.target.value)} maxLength={60}
            className="admin-input" placeholder="МираВкус" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Цвет текста возле лого (HEX)</label>
          <div className="flex items-center gap-2">
            <input type="color" value={isHex(form.brandTextColor) ? form.brandTextColor : headerFallback.brandTextColor}
              onChange={e => set('brandTextColor', e.target.value)} className="h-10 w-12 rounded-lg border border-border bg-transparent p-1" />
            <input value={form.brandTextColor} onChange={e => set('brandTextColor', e.target.value)} className="admin-input" placeholder="#db2777" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Цвет кнопки «Меню» (HEX)</label>
          <div className="flex items-center gap-2">
            <input type="color" value={isHex(form.menuButtonBg) ? form.menuButtonBg : headerFallback.menuButtonBg}
              onChange={e => set('menuButtonBg', e.target.value)} className="h-10 w-12 rounded-lg border border-border bg-transparent p-1" />
            <input value={form.menuButtonBg} onChange={e => set('menuButtonBg', e.target.value)} className="admin-input" placeholder="#db2777" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Цвет текста кнопки (HEX)</label>
          <div className="flex items-center gap-2">
            <input type="color" value={isHex(form.menuButtonTextColor) ? form.menuButtonTextColor : headerFallback.menuButtonTextColor}
              onChange={e => set('menuButtonTextColor', e.target.value)} className="h-10 w-12 rounded-lg border border-border bg-transparent p-1" />
            <input value={form.menuButtonTextColor} onChange={e => set('menuButtonTextColor', e.target.value)} className="admin-input" placeholder="#ffffff" />
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-border/40 p-4 bg-muted/20">
        <div className="text-xs text-muted-foreground mb-2">Предпросмотр</div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-display font-bold text-lg" style={{ color: form.brandTextColor }}>{form.brandName || 'МираВкус'}</span>
          <button type="button" className="px-4 py-2 rounded-2xl text-sm font-medium" style={{ backgroundColor: form.menuButtonBg, color: form.menuButtonTextColor }}>
            Меню
          </button>
        </div>
      </div>
      <div className="flex justify-end">
        <button type="submit"
          className="px-4 py-2 rounded-xl text-sm bg-primary text-primary-foreground font-medium hover:scale-[1.02] active:scale-95 transition-transform">
          Сохранить
        </button>
      </div>
    </form>
  );
}

function AboutTab({ store }: { store: ReturnType<typeof useStore> }) {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(() => ({
    title: store.about.title,
    subtitle: store.about.subtitle,
    content: store.about.content,
    images: store.about.images || [],
  }));

  useEffect(() => {
    setForm({
      title: store.about.title,
      subtitle: store.about.subtitle,
      content: store.about.content,
      images: store.about.images || [],
    });
  }, [store.about]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }));
  const maxImages = 8;

  const addImages = async (files: FileList | null) => {
    const result = await appendValidatedImages({
      files,
      currentImages: form.images,
      maxImages,
      maxImagesError: 'Макс. 8 фото',
    });
    if (result) set('images', result);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Введите заголовок'); return; }
    if (!form.subtitle.trim()) { toast.error('Введите подзаголовок'); return; }
    if (!form.content.trim()) { toast.error('Введите текст'); return; }
    let images: string[] = [];
    try {
      for (const u of form.images) {
        if (u.startsWith('data:image/')) {
          const webpUrl = await toWebpDataUrl(u);
          const res = await api.uploadArticleImage(webpUrl) as { url: string };
          images.push(res.url);
        } else {
          images.push(u);
        }
      }
    } catch {
      images = form.images;
    }
    try {
      await store.updateAbout({
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        content: form.content.trim(),
        images,
      });
      toast.success('Блок "О нас" обновлён');
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === '401' || code === '403') toast.error('Нет доступа. Перезайдите в админку.');
      else toast.error('Не удалось сохранить блок');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Заголовок</label>
          <input value={form.title} onChange={e => set('title', e.target.value)} maxLength={80}
            className="admin-input" placeholder="О нас" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Подзаголовок</label>
          <input value={form.subtitle} onChange={e => set('subtitle', e.target.value)} maxLength={120}
            className="admin-input" placeholder="Короткая идея бренда" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Текст</label>
        <textarea value={form.content} onChange={e => set('content', e.target.value)} rows={8} maxLength={2000}
          className="admin-input resize-none" placeholder="История бренда, ценности, подход..." />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Галерея (до 8 фото)</label>
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            {form.images.map((u, i) => (
              <div key={i} className="relative">
                <img src={resolveMediaUrl(u)} alt="" className="w-20 h-20 object-cover rounded-xl border" />
                <button type="button" onClick={() => set('images', form.images.filter((_, idx) => idx !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => galleryInputRef.current?.click()}
              className="px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted transition-colors flex items-center gap-2">
              <Upload size={14} />
              Добавить фото
            </button>
            <span className="text-[11px] text-muted-foreground">Добавлено: {form.images.length}/{maxImages}</span>
            <input
              ref={galleryInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={e => { addImages(e.target.files); e.currentTarget.value = ''; }}
            />
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <button type="submit"
          className="px-4 py-2 rounded-xl text-sm bg-primary text-primary-foreground font-medium hover:scale-[1.02] active:scale-95 transition-transform">
          Сохранить
        </button>
      </div>
    </form>
  );
}

function IntegrationsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState({
    smtp: { host: '', port: '587', user: '', pass: '', from: '' },
    ozon: { apiKey: '', clientId: '' },
    cdek: { clientId: '', clientSecret: '', fromPostalCode: '' },
    russianPost: { apiKey: '', login: '', password: '', fromPostalCode: '' },
  });
  const [statusData, setStatusData] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, statusRes] = await Promise.all([
        api.getIntegrationSettings() as Promise<any>,
        api.getLogisticsStatus() as Promise<any>,
      ]);
      const resolved = settingsRes?.resolved || {};
      setSettings({
        smtp: {
          host: resolved?.smtp?.host || '',
          port: resolved?.smtp?.port || '587',
          user: resolved?.smtp?.user || '',
          pass: resolved?.smtp?.pass || '',
          from: resolved?.smtp?.from || '',
        },
        ozon: {
          apiKey: resolved?.ozon?.apiKey || '',
          clientId: resolved?.ozon?.clientId || '',
        },
        cdek: {
          clientId: resolved?.cdek?.clientId || '',
          clientSecret: resolved?.cdek?.clientSecret || '',
          fromPostalCode: resolved?.cdek?.fromPostalCode || '',
        },
        russianPost: {
          apiKey: resolved?.russianPost?.apiKey || '',
          login: resolved?.russianPost?.login || '',
          password: resolved?.russianPost?.password || '',
          fromPostalCode: resolved?.russianPost?.fromPostalCode || '',
        },
      });
      setStatusData(statusRes);
    } catch (err) {
      toast.error(getFriendlyActionError(err, 'Не удалось загрузить настройки интеграций'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const setField = (group: 'smtp' | 'ozon' | 'cdek' | 'russianPost', field: string, value: string) => {
    setSettings(prev => ({ ...prev, [group]: { ...(prev as any)[group], [field]: value } } as any));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.updateIntegrationSettings(settings);
      const statusRes = await api.getLogisticsStatus();
      setStatusData(statusRes);
      toast.success('Настройки интеграций сохранены');
    } catch (err) {
      toast.error(getFriendlyActionError(err, 'Не удалось сохранить настройки'));
    } finally {
      setSaving(false);
    }
  };

  const runTest = async (provider: 'smtp' | 'ozon' | 'cdek' | 'russianPost', mode: 'fake' | 'real') => {
    setTesting(true);
    try {
      const payload: any = { provider, mode };
      if (provider === 'smtp' && mode === 'real') payload.to = settings.smtp.user || settings.smtp.from;
      const result = await api.testIntegration(payload) as any;
      const missing = Array.isArray(result?.missing) ? result.missing.join(', ') : '';
      if (missing) toast.success(`Тест ${provider}: не хватает ${missing}`);
      else toast.success(`Тест ${provider}: успешно (${mode})`);
      const statusRes = await api.getLogisticsStatus();
      setStatusData(statusRes);
    } catch (err) {
      toast.error(getFriendlyActionError(err, `Тест ${provider} не прошёл`));
    } finally {
      setTesting(false);
    }
  };

  const loadPickupPoints = async (mode: 'fake' | 'real') => {
    setTesting(true);
    try {
      const city = settings.cdek.fromPostalCode || settings.russianPost.fromPostalCode || 'Москва';
      const result = await api.getPickupPoints({ provider: 'ozon', city, mode }) as any;
      const count = Array.isArray(result?.points) ? result.points.length : 0;
      toast.success(`Точки ПВЗ Ozon: найдено ${count}`);
    } catch (err) {
      toast.error(getFriendlyActionError(err, 'Не удалось получить точки ПВЗ'));
    } finally {
      setTesting(false);
    }
  };

  const statusMark = (ready?: boolean) => (
    <span className={`text-xs px-2 py-1 rounded-full ${ready ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
      {ready ? 'Готово' : 'Не готово'}
    </span>
  );

  if (loading) {
    return (
      <div className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm">
        Загрузка настроек интеграций...
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold">SMTP (письма)</h3>
          {statusMark(statusData?.status?.smtp?.ready)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={settings.smtp.host} onChange={e => setField('smtp', 'host', e.target.value)} className="admin-input" placeholder="SMTP host" />
          <input value={settings.smtp.port} onChange={e => setField('smtp', 'port', e.target.value)} className="admin-input" placeholder="SMTP port" />
          <input value={settings.smtp.user} onChange={e => setField('smtp', 'user', e.target.value)} className="admin-input" placeholder="SMTP user/login" />
          <input value={settings.smtp.pass} onChange={e => setField('smtp', 'pass', e.target.value)} className="admin-input" placeholder="SMTP password" />
          <input value={settings.smtp.from} onChange={e => setField('smtp', 'from', e.target.value)} className="admin-input sm:col-span-2" placeholder="SMTP from (email отправителя)" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => runTest('smtp', 'fake')} disabled={testing} className="px-3 py-2 rounded-xl border border-border text-xs hover:bg-muted transition-colors">Тест SMTP (fake)</button>
          <button type="button" onClick={() => runTest('smtp', 'real')} disabled={testing} className="px-3 py-2 rounded-xl border border-border text-xs hover:bg-muted transition-colors">Тест SMTP (real)</button>
        </div>
      </div>

      <div className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold">Ozon</h3>
          {statusMark(statusData?.status?.ozon?.ready)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={settings.ozon.apiKey} onChange={e => setField('ozon', 'apiKey', e.target.value)} className="admin-input" placeholder="Ozon API key" />
          <input value={settings.ozon.clientId} onChange={e => setField('ozon', 'clientId', e.target.value)} className="admin-input" placeholder="Ozon client id (опционально)" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => runTest('ozon', 'fake')} disabled={testing} className="px-3 py-2 rounded-xl border border-border text-xs hover:bg-muted transition-colors">Тест Ozon (fake)</button>
          <button type="button" onClick={() => runTest('ozon', 'real')} disabled={testing} className="px-3 py-2 rounded-xl border border-border text-xs hover:bg-muted transition-colors">Тест Ozon (real)</button>
          <button type="button" onClick={() => loadPickupPoints('fake')} disabled={testing} className="px-3 py-2 rounded-xl border border-border text-xs hover:bg-muted transition-colors">ПВЗ Ozon (fake)</button>
          <button type="button" onClick={() => loadPickupPoints('real')} disabled={testing} className="px-3 py-2 rounded-xl border border-border text-xs hover:bg-muted transition-colors">ПВЗ Ozon (real)</button>
        </div>
      </div>

      <div className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold">CDEK</h3>
          {statusMark(statusData?.status?.cdek?.ready)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={settings.cdek.clientId} onChange={e => setField('cdek', 'clientId', e.target.value)} className="admin-input" placeholder="CDEK client id" />
          <input value={settings.cdek.clientSecret} onChange={e => setField('cdek', 'clientSecret', e.target.value)} className="admin-input" placeholder="CDEK client secret" />
          <input value={settings.cdek.fromPostalCode} onChange={e => setField('cdek', 'fromPostalCode', e.target.value)} className="admin-input sm:col-span-2" placeholder="CDEK индекс отправки" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => runTest('cdek', 'fake')} disabled={testing} className="px-3 py-2 rounded-xl border border-border text-xs hover:bg-muted transition-colors">Тест CDEK (fake)</button>
          <button type="button" onClick={() => runTest('cdek', 'real')} disabled={testing} className="px-3 py-2 rounded-xl border border-border text-xs hover:bg-muted transition-colors">Тест CDEK (real)</button>
        </div>
      </div>

      <div className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold">Почта России</h3>
          {statusMark(statusData?.status?.russianPost?.ready)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={settings.russianPost.apiKey} onChange={e => setField('russianPost', 'apiKey', e.target.value)} className="admin-input" placeholder="Почта API key" />
          <input value={settings.russianPost.login} onChange={e => setField('russianPost', 'login', e.target.value)} className="admin-input" placeholder="Почта login" />
          <input value={settings.russianPost.password} onChange={e => setField('russianPost', 'password', e.target.value)} className="admin-input" placeholder="Почта password" />
          <input value={settings.russianPost.fromPostalCode} onChange={e => setField('russianPost', 'fromPostalCode', e.target.value)} className="admin-input" placeholder="Почта индекс отправки" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => runTest('russianPost', 'fake')} disabled={testing} className="px-3 py-2 rounded-xl border border-border text-xs hover:bg-muted transition-colors">Тест Почта (fake)</button>
          <button type="button" onClick={() => runTest('russianPost', 'real')} disabled={testing} className="px-3 py-2 rounded-xl border border-border text-xs hover:bg-muted transition-colors">Тест Почта (real)</button>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={saveSettings} disabled={saving}
          className="px-4 py-2 rounded-xl text-sm bg-primary text-primary-foreground font-medium hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-70">
          {saving ? 'Сохраняем...' : 'Сохранить интеграции'}
        </button>
      </div>
    </div>
  );
}

function FooterTab({ store }: { store: ReturnType<typeof useStore> }) {
  const toSocialLinksText = (links: Array<{ label: string; url?: string }>, fallbackItems: string[]) => {
    if (Array.isArray(links) && links.length) {
      return links
        .map((item) => {
          const label = String(item.label || '').trim();
          const url = String(item.url || '').trim();
          if (!label) return '';
          return url ? `${label} | ${url}` : label;
        })
        .filter(Boolean)
        .join('\n');
    }
    return fallbackItems.join('\n');
  };

  const [form, setForm] = useState(() => ({
    brandEmoji: store.footer.brandEmoji,
    brandName: store.footer.brandName,
    description: store.footer.description,
    deliveryTitle: store.footer.deliveryTitle,
    deliveryItems: store.footer.deliveryItems.join('\n'),
    contactsTitle: store.footer.contactsTitle,
    phone: store.footer.phone,
    email: store.footer.email,
    address: store.footer.address,
    socialItems: toSocialLinksText(store.footer.socialLinks || [], store.footer.socialItems),
    copyright: store.footer.copyright,
  }));

  useEffect(() => {
    setForm({
      brandEmoji: store.footer.brandEmoji,
      brandName: store.footer.brandName,
      description: store.footer.description,
      deliveryTitle: store.footer.deliveryTitle,
      deliveryItems: store.footer.deliveryItems.join('\n'),
      contactsTitle: store.footer.contactsTitle,
      phone: store.footer.phone,
      email: store.footer.email,
      address: store.footer.address,
      socialItems: toSocialLinksText(store.footer.socialLinks || [], store.footer.socialItems),
      copyright: store.footer.copyright,
    });
  }, [store.footer]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const deliveryItems = form.deliveryItems.split('\n').map(s => s.trim()).filter(Boolean);
    const socialRows = form.socialItems.split('\n').map(s => s.trim()).filter(Boolean);
    const socialLinks = socialRows
      .map((row) => {
        const [rawLabel, ...rawUrlParts] = row.split('|');
        const label = String(rawLabel || '').trim();
        const rawUrl = rawUrlParts.join('|').trim();
        if (!label) return null;
        if (!rawUrl) return { label } as { label: string; url?: string };
        const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
        return { label, url };
      })
      .filter((item): item is { label: string; url?: string } => Boolean(item));
    const socialItems = socialLinks.map((item) => item.label);
    if (!form.brandName.trim()) { toast.error('Введите название магазина'); return; }
    if (!form.description.trim()) { toast.error('Введите описание'); return; }
    if (!form.deliveryTitle.trim()) { toast.error('Введите заголовок доставки'); return; }
    if (!deliveryItems.length) { toast.error('Добавьте пункты доставки'); return; }
    if (!form.contactsTitle.trim()) { toast.error('Введите заголовок контактов'); return; }
    if (!form.phone.trim()) { toast.error('Введите телефон'); return; }
    if (!form.email.trim()) { toast.error('Введите email'); return; }
    if (!form.address.trim()) { toast.error('Введите адрес'); return; }
    if (!form.copyright.trim()) { toast.error('Введите копирайт'); return; }
    try {
      await store.updateFooter({
        brandEmoji: form.brandEmoji.trim() || '🍬',
        brandName: form.brandName.trim(),
        description: form.description.trim(),
        deliveryTitle: form.deliveryTitle.trim(),
        deliveryItems,
        contactsTitle: form.contactsTitle.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        socialItems,
        socialLinks,
        copyright: form.copyright.trim(),
      });
      toast.success('Футер обновлён');
    } catch (err) {
      toastActionError(err, 'Не удалось обновить футер');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm grid gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Эмодзи бренда</label>
          <input value={form.brandEmoji} onChange={e => set('brandEmoji', e.target.value)} maxLength={4}
            className="admin-input" placeholder="🍬" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Название магазина</label>
          <input value={form.brandName} onChange={e => set('brandName', e.target.value)} maxLength={60}
            className="admin-input" placeholder="МираВкус" />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Описание</label>
        <textarea value={form.description} onChange={e => set('description', e.target.value)} maxLength={300}
          rows={3} className="admin-input resize-none" placeholder="Описание магазина" />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Заголовок блока доставки</label>
        <input value={form.deliveryTitle} onChange={e => set('deliveryTitle', e.target.value)} maxLength={60}
          className="admin-input" placeholder="Доставка и оплата" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Пункты доставки (по одному в строке)</label>
        <textarea value={form.deliveryItems} onChange={e => set('deliveryItems', e.target.value)} maxLength={500}
          rows={4} className="admin-input resize-y" placeholder="Курьер по Москве — от 299 ₽" />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Заголовок блока контактов</label>
        <input value={form.contactsTitle} onChange={e => set('contactsTitle', e.target.value)} maxLength={60}
          className="admin-input" placeholder="Контакты" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Телефон</label>
          <input value={form.phone} onChange={e => set('phone', e.target.value)} maxLength={60}
            className="admin-input" placeholder="📞 +7 (495) 123-45-67" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
          <input value={form.email} onChange={e => set('email', e.target.value)} maxLength={80}
            className="admin-input" placeholder="✉️ hello@candyland.ru" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Адрес</label>
          <input value={form.address} onChange={e => set('address', e.target.value)} maxLength={120}
            className="admin-input" placeholder="📍 Москва, ул. Сладкая, 15" />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Соцсети (по одной в строке: Название | Ссылка)</label>
        <textarea value={form.socialItems} onChange={e => set('socialItems', e.target.value)} maxLength={200}
          rows={3} className="admin-input resize-y" placeholder="📱 Telegram | t.me/your_channel" />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Копирайт</label>
        <input value={form.copyright} onChange={e => set('copyright', e.target.value)} maxLength={120}
          className="admin-input" placeholder="© 2026 МираВкус. Все права защищены." />
      </div>

      <div className="flex justify-end">
        <button type="submit"
          className="px-4 py-2 rounded-xl text-sm bg-primary text-primary-foreground font-medium hover:scale-[1.02] active:scale-95 transition-transform">
          Сохранить
        </button>
      </div>
    </form>
  );
}
