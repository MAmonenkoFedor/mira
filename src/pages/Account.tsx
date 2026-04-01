import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/candy-store/Header';
import Footer from '@/components/candy-store/Footer';
import ProductCard from '@/components/candy-store/ProductCard';
import { useCart } from '@/components/candy-store/useCart';
import { useStore } from '@/components/candy-store/useStore';
import { api } from '@/lib/api';
import { clearCustomerToken, getCustomerToken, loginCustomer } from '@/lib/auth';
import { toast } from 'sonner';
import type { Order } from '@/components/candy-store/useStore';

export default function Account() {
  const cart = useCart();
  const { favoriteProducts } = useStore();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [requestLogin, setRequestLogin] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loadingRequest, setLoadingRequest] = useState(false);
  const [loadingChange, setLoadingChange] = useState(false);
  const [orderFilter, setOrderFilter] = useState<'all' | 'processing' | 'handed' | 'delivered' | 'cancelled'>('all');
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const setMeta = (attr: 'name' | 'property', key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.content = content;
    };
    const setLink = (rel: string, href: string) => {
      let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!el) {
        el = document.createElement('link');
        el.rel = rel;
        document.head.appendChild(el);
      }
      el.href = href;
    };
    const title = 'Личный кабинет — МираВкус';
    const description = 'История заказов и данные доставки.';
    const url = `${window.location.origin}/account`;
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', 'noindex, nofollow');
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:url', url);
    setLink('canonical', url);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const token = getCustomerToken();
      if (!token) {
        if (!active) return;
        setAuthed(false);
        setChecked(true);
        return;
      }
      try {
        const list = await api.getCustomerOrders();
        if (!active) return;
        setOrders(list as Order[]);
        setAuthed(true);
        setChecked(true);
      } catch {
        clearCustomerToken();
        if (!active) return;
        setAuthed(false);
        setChecked(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleRequestPassword = async () => {
    const raw = requestLogin.trim();
    if (!raw) {
      toast.error('Введите телефон или почту');
      return;
    }
    setLoadingRequest(true);
    try {
      const isEmail = raw.includes('@');
      await api.requestCustomerPassword(isEmail ? { email: raw } : { phone: raw });
      toast.success('Пароль отправлен');
    } catch {
      toast.error('Не удалось отправить пароль');
    } finally {
      setLoadingRequest(false);
    }
  };

  const handleLogin = async () => {
    const raw = login.trim();
    if (!raw || !password.trim()) {
      toast.error('Введите логин и пароль');
      return;
    }
    setLoadingLogin(true);
    try {
      const ok = await loginCustomer(raw, password);
      if (!ok) {
        toast.error('Неверный логин или пароль');
        return;
      }
      const list = await api.getCustomerOrders();
      setOrders(list as Order[]);
      setAuthed(true);
      setPassword('');
      toast.success('Вход выполнен');
    } catch {
      toast.error('Не удалось выполнить вход');
    } finally {
      setLoadingLogin(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword.trim() || !newPassword.trim()) {
      toast.error('Введите текущий и новый пароль');
      return;
    }
    setLoadingChange(true);
    try {
      await api.changeCustomerPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Пароль изменён');
    } catch {
      toast.error('Не удалось изменить пароль');
    } finally {
      setLoadingChange(false);
    }
  };

  const handleLogout = () => {
    clearCustomerToken();
    setAuthed(false);
    setOrders([]);
    setLogin('');
    setPassword('');
  };

  const statusLabels: Record<string, string> = useMemo(() => ({
    processing: 'В обработке',
    handed: 'В доставке',
    delivered: 'Доставлен',
    cancelled: 'Отменён',
  }), []);
  const sortedOrders = useMemo(() => {
    const list = [...orders];
    list.sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (at !== bt) return bt - at;
      return b.id - a.id;
    });
    return list;
  }, [orders]);
  const filteredOrders = useMemo(() => {
    if (orderFilter === 'all') return sortedOrders;
    return sortedOrders.filter(o => (o.status || 'processing') === orderFilter);
  }, [sortedOrders, orderFilter]);
  const orderStats = useMemo(() => {
    return {
      all: orders.length,
      processing: orders.filter(o => (o.status || 'processing') === 'processing').length,
      handed: orders.filter(o => (o.status || 'processing') === 'handed').length,
      delivered: orders.filter(o => (o.status || 'processing') === 'delivered').length,
      cancelled: orders.filter(o => (o.status || 'processing') === 'cancelled').length,
    };
  }, [orders]);

  if (!checked) {
    return (
      <div className="min-h-screen bg-background">
        <Header cartCount={cart.count} onCartClick={() => navigate('/cart')} />
        <main className="container py-10">
          <div className="max-w-4xl mx-auto">
            <div className="bg-card rounded-3xl border border-border/40 shadow-sm p-8 text-center text-muted-foreground">
              Загружаем кабинет...
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header cartCount={cart.count} onCartClick={() => navigate('/cart')} />

      <main className="container py-10">
        <div className="max-w-4xl mx-auto grid gap-6">
          <div className="bg-card rounded-3xl border border-border/40 shadow-sm p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl md:text-3xl font-bold">Личный кабинет</h1>
                <p className="text-sm text-muted-foreground mt-1">Заказы, доставка и безопасность аккаунта</p>
              </div>
              {authed && (
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted/50 transition-colors"
                >
                  Выйти
                </button>
              )}
            </div>
          </div>

          {!authed && (
            <div className="grid md:grid-cols-2 gap-6 items-stretch">
              <div className="bg-card rounded-3xl border border-border/40 shadow-sm p-6 flex flex-col gap-4 h-full">
                <div>
                  <h2 className="font-display text-lg font-bold">Получить пароль</h2>
                  <p className="text-sm text-muted-foreground">Пароль придёт по СМС или на почту</p>
                </div>
                <form
                  className="grid gap-4 h-full"
                  onSubmit={e => {
                    e.preventDefault();
                    handleRequestPassword();
                  }}
                >
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Телефон или почта</label>
                    <input
                      value={requestLogin}
                      onChange={e => setRequestLogin(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 border-border"
                      placeholder="+7 (___) ___-__-__ или email@example.com"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loadingRequest}
                    className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-display font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-60 mt-auto"
                  >
                    {loadingRequest ? 'Отправляем...' : 'Отправить пароль'}
                  </button>
                </form>
              </div>

              <div className="bg-card rounded-3xl border border-border/40 shadow-sm p-6 flex flex-col gap-4 h-full">
                <div>
                  <h2 className="font-display text-lg font-bold">Вход</h2>
                  <p className="text-sm text-muted-foreground">Телефон или почта в качестве логина</p>
                </div>
                <form
                  className="grid gap-4 h-full"
                  onSubmit={e => {
                    e.preventDefault();
                    handleLogin();
                  }}
                >
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Логин</label>
                    <input
                      value={login}
                      onChange={e => setLogin(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 border-border"
                      placeholder="+7 (___) ___-__-__ или email@example.com"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Пароль</label>
                    <input
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 border-border"
                      placeholder="******"
                      type="password"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loadingLogin}
                    className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-display font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-60 mt-auto"
                  >
                    {loadingLogin ? 'Входим...' : 'Войти'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {authed && (
            <>
              <div className="bg-card rounded-3xl border border-border/40 shadow-sm p-6 grid gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-lg font-bold">Избранное</h2>
                    <p className="text-sm text-muted-foreground">Товары, которые вы отметили сердечком</p>
                  </div>
                </div>
                {!favoriteProducts.length ? (
                  <div className="text-center py-8 text-muted-foreground grid gap-3">
                    <span>Пока пусто — добавьте товары в избранное</span>
                    <div>
                      <button
                        onClick={() => navigate('/catalog')}
                        className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted/50 transition-colors"
                      >
                        Перейти в каталог
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {favoriteProducts.map(p => (
                      <ProductCard key={p.id} product={p} onAdd={(prod, pack) => cart.addItem(prod, 1, pack ?? undefined)} />
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-card rounded-3xl border border-border/40 shadow-sm p-6 grid gap-4">
                <div>
                  <h2 className="font-display text-lg font-bold">История заказов</h2>
                  <p className="text-sm text-muted-foreground">Статус и данные доставки</p>
                </div>
                {!orders.length && (
                  <div className="text-center py-10 text-muted-foreground">Заказов пока нет</div>
                )}
                {!!orders.length && (
                  <div className="grid gap-3">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      <div className="rounded-2xl bg-muted/50 px-3 py-2 text-xs">Всего: {orderStats.all}</div>
                      <div className="rounded-2xl bg-muted/50 px-3 py-2 text-xs">В обработке: {orderStats.processing}</div>
                      <div className="rounded-2xl bg-muted/50 px-3 py-2 text-xs">В доставке: {orderStats.handed}</div>
                      <div className="rounded-2xl bg-muted/50 px-3 py-2 text-xs">Доставлены: {orderStats.delivered}</div>
                      <div className="rounded-2xl bg-muted/50 px-3 py-2 text-xs">Отменены: {orderStats.cancelled}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'all', label: 'Все' },
                        { id: 'processing', label: 'В обработке' },
                        { id: 'handed', label: 'В доставке' },
                        { id: 'delivered', label: 'Доставлены' },
                        { id: 'cancelled', label: 'Отменены' },
                      ].map(option => (
                        <button
                          key={option.id}
                          onClick={() => setOrderFilter(option.id as typeof orderFilter)}
                          className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${orderFilter === option.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted/50'}`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!filteredOrders.length && !!orders.length && (
                  <div className="text-center py-8 text-muted-foreground">По выбранному фильтру заказов нет</div>
                )}
                {filteredOrders.map(o => {
                  const created = o.createdAt ? new Date(o.createdAt).toLocaleString('ru-RU') : '';
                  const status = o.status ? (statusLabels[o.status] || o.status) : '—';
                  const deliveryVisible = o.status === 'handed' || Boolean(o.deliveryStatus || o.deliveryProvider || o.trackingNumber);
                  const isExpanded = Boolean(expandedOrderIds[o.id]);
                  const visibleItems = isExpanded ? o.items : o.items.slice(0, 2);
                  return (
                    <div key={o.id} className="rounded-2xl border border-border/40 p-4 grid gap-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-display font-semibold text-sm">Заказ #{o.id}</span>
                        {created && <span className="text-xs text-muted-foreground">{created}</span>}
                        <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">{status}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{o.contact.name} · {o.contact.phone}{o.contact.email ? ` · ${o.contact.email}` : ''}</div>
                      <div className="text-xs text-muted-foreground">{o.delivery.method} · {o.delivery.address}</div>
                      <div className="text-xs text-muted-foreground">Оплата: {o.delivery.payment}</div>
                      <div className="text-xs text-muted-foreground">Сумма: {o.total} ₽ · Скидка: {o.discount} ₽</div>
                      {o.promo && <div className="text-xs text-muted-foreground">Промо: {o.promo}</div>}
                      {deliveryVisible && (
                        <div className="text-xs text-muted-foreground">
                          {o.deliveryStatus ? `Статус доставки: ${o.deliveryStatus}. ` : ''}
                          {o.deliveryProvider ? `Служба: ${o.deliveryProvider}. ` : ''}
                          {o.trackingNumber ? `Трек: ${o.trackingNumber}` : ''}
                        </div>
                      )}
                      <div className="grid gap-1 mt-1">
                        {visibleItems.map(item => (
                          <div key={item.id} className="text-xs text-muted-foreground flex justify-between gap-3">
                            <span className="truncate">{item.name}</span>
                            <span>× {item.quantity}</span>
                          </div>
                        ))}
                      </div>
                      {o.items.length > 2 && (
                        <button
                          onClick={() => setExpandedOrderIds(prev => ({ ...prev, [o.id]: !prev[o.id] }))}
                          className="justify-self-start text-xs px-3 py-1 rounded-full border border-border hover:bg-muted/50 transition-colors"
                        >
                          {isExpanded ? 'Свернуть состав' : `Показать весь состав (${o.items.length})`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="bg-card rounded-3xl border border-border/40 shadow-sm p-6 grid gap-4 max-w-lg">
                <div>
                  <h2 className="font-display text-lg font-bold">Смена пароля</h2>
                  <p className="text-sm text-muted-foreground">Задайте новый пароль для входа</p>
                </div>
                <form
                  className="grid gap-4"
                  onSubmit={e => {
                    e.preventDefault();
                    handleChangePassword();
                  }}
                >
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Текущий пароль</label>
                    <input
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 border-border"
                      type="password"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Новый пароль</label>
                    <input
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 border-border"
                      type="password"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loadingChange}
                    className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-display font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-60"
                  >
                    {loadingChange ? 'Обновляем...' : 'Обновить пароль'}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />

    </div>
  );
}
