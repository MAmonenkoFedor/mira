import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, RotateCcw, Package, FileText, Tag, Upload, X, Percent, Image as ImageIcon, ArrowUp, ArrowDown, BadgeCheck, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { useStore, type Article, type Order } from '@/components/candy-store/useStore';
import { resolveMediaUrl } from '@/lib/api';
import { badgeToneSoftClasses, badgeToneClasses } from '@/components/candy-store/data';
import type { Product, Category, Promo, PromoScope, Badge, BadgeTone } from '@/components/candy-store/data';

type Tab = 'products' | 'categories' | 'articles' | 'promos' | 'import' | 'hero' | 'badges' | 'orders' | 'footer';

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('read_error'));
  reader.readAsDataURL(file);
});

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

/* ─── Main Admin ─── */
export default function Admin() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>('products');
  const [pwdOpen, setPwdOpen] = useState(false);
  const [currPwd, setCurrPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');

  const tabs: { key: Tab; icon: typeof Package; label: string; count: number }[] = [
    { key: 'products', icon: Package, label: 'Товары', count: store.products.length },
    { key: 'categories', icon: Tag, label: 'Категории', count: store.categories.length },
    { key: 'badges', icon: BadgeCheck, label: 'Бейджи', count: store.badges.length },
    { key: 'articles', icon: FileText, label: 'Статьи', count: store.articles.length },
    { key: 'orders', icon: ClipboardList, label: 'Заказы', count: store.orders?.length || 0 },
    { key: 'promos', icon: Percent, label: 'Промокоды', count: store.promos?.length || 0 },
    { key: 'hero', icon: ImageIcon, label: 'Баннер', count: store.heroImages?.length || 0 },
    { key: 'footer', icon: ImageIcon, label: 'Футер', count: 0 },
    { key: 'import', icon: Upload, label: 'Импорт', count: 0 },
  ];

  return (
    <div className="min-h-screen bg-muted/30 pb-12">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border shadow-sm">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 rounded-xl hover:bg-muted/50 text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="font-display text-lg font-bold text-foreground">🍬 Админ-панель</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setPwdOpen(v => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Pencil size={14} /> Сменить пароль
            </button>
            <button onClick={() => { store.resetToDefaults(); toast.success('Данные сброшены'); }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors">
              <RotateCcw size={14} /> Сбросить
            </button>
          </div>
        </div>
      </header>

      <div className="container pt-4">
        {pwdOpen && (
          <div className="mb-4 p-4 border rounded-2xl bg-card">
            <div className="text-sm font-medium mb-2">Смена пароля</div>
            <div className="grid gap-2 sm:grid-cols-3">
              <input type="password" placeholder="Текущий пароль" className="admin-input" value={currPwd} onChange={e => setCurrPwd(e.target.value)} />
              <input type="password" placeholder="Новый пароль" className="admin-input" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
              <button
                onClick={async () => {
                  try {
                    const { api } = await import('@/lib/api');
                    await api.changePassword(currPwd, newPwd);
                    setCurrPwd(''); setNewPwd(''); setPwdOpen(false);
                    toast.success('Пароль обновлён');
                  } catch {
                    toast.error('Не удалось обновить пароль');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
                Обновить
              </button>
            </div>
          </div>
        )}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all whitespace-nowrap ${
                tab === t.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-card text-muted-foreground hover:text-foreground border border-border'
              }`}>
              <t.icon size={16} /> {t.label}
              <span className="ml-1 text-xs opacity-70">({t.count})</span>
            </button>
          ))}
        </div>

        {tab === 'products' && <ProductsTab store={store} />}
        {tab === 'categories' && <CategoriesTab store={store} />}
        {tab === 'badges' && <BadgesTab store={store} />}
        {tab === 'articles' && <ArticlesTab store={store} />}
        {tab === 'orders' && <OrdersTab store={store} />}
        {tab === 'promos' && <PromosTab store={store} />}
        {tab === 'import' && <ImportTab store={store} />}
        {tab === 'hero' && <HeroTab store={store} />}
        {tab === 'footer' && <FooterTab store={store} />}
      </div>
    </div>
  );
}

/* ─── Products Tab ─── */
function ProductsTab({ store }: { store: ReturnType<typeof useStore> }) {
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <button onClick={() => { setCreating(true); setEditing(null); }}
        className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-medium hover:scale-[1.02] active:scale-95 transition-transform">
        <Plus size={16} /> Добавить товар
      </button>

      {(creating || editing) && (
        <ProductForm
          product={editing}
          categories={store.categories}
          badges={store.badges}
          onSave={(data) => {
            if (editing) { store.updateProduct(editing.id, data); toast.success('Товар обновлён'); }
            else { store.addProduct(data as Omit<Product, 'id'>); toast.success('Товар добавлен'); }
            setEditing(null); setCreating(false);
          }}
          onCancel={() => { setEditing(null); setCreating(false); }}
        />
      )}

      <div className="grid gap-3">
        {store.products.map(p => (
          <div key={p.id} className="flex items-center gap-4 bg-card rounded-2xl p-4 border border-border/40 shadow-sm">
            <img src={resolveMediaUrl(p.images?.[0] || p.image)} alt={p.name} className="w-14 h-14 rounded-xl object-cover bg-muted" loading="lazy" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display font-semibold text-sm truncate">{p.name}</span>
                {p.badge && (() => {
                  const badge = store.badges.find(b => b.id === p.badge);
                  if (!badge) return null;
                  return (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badge.active ? badgeToneSoftClasses[badge.tone] : 'bg-muted text-muted-foreground'}`}>
                      {badge.label}{badge.active ? '' : ' (выключен)'}
                    </span>
                  );
                })()}
              </div>
              <div className="text-xs text-muted-foreground">
                {p.price} ₽ · {store.categories.find(c => c.id === p.category)?.name || p.category}
              </div>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => { setEditing(p); setCreating(false); }}
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                <Pencil size={15} />
              </button>
              <button onClick={() => { store.deleteProduct(p.id); toast.success('Удалено'); }}
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

/* ─── Hero Tab ─── */
function HeroTab({ store }: { store: ReturnType<typeof useStore> }) {
  const [val, setVal] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState('');
  const add = async () => {
    if (busy) return;
    let finalUrl = val.trim();
    if (!file && !finalUrl) { toast.error('Добавьте файл или URL'); return; }
    try {
      setBusy(true);
      const { api } = await import('@/lib/api');
      if (file || finalUrl.startsWith('data:image/')) {
        const dataUrl = file ? await readFileAsDataUrl(file) : finalUrl;
        const webpUrl = await toWebpDataUrl(dataUrl);
        const res = await api.uploadHeroImage(webpUrl) as { url: string };
        finalUrl = res.url;
      }
      await store.addHeroImage(finalUrl);
      setVal('');
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
          <div key={`${img.id}-${img.position}-${idx}`} className="flex items-center gap-4 bg-card rounded-2xl p-4 border border-border/40 shadow-sm">
            <img src={resolveMediaUrl(img.url)} alt="" className="w-20 h-16 object-cover rounded-xl border" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-display">pos: {img.position}</div>
              <div className="text-xs text-muted-foreground truncate">{img.url}</div>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={img.active} onChange={e => store.updateHeroImage(img.id, { active: e.target.checked })} />
              Активно
            </label>
            <div className="flex gap-1.5">
              <button onClick={() => {
                const newPos = Math.max(0, img.position - 1);
                store.updateHeroImage(img.id, { position: newPos });
              }} className="p-2 rounded-xl hover:bg-muted text-muted-foreground"><ArrowUp size={15} /></button>
              <button onClick={() => store.updateHeroImage(img.id, { position: img.position + 1 })} className="p-2 rounded-xl hover:bg-muted text-muted-foreground"><ArrowDown size={15} /></button>
              <button onClick={() => { store.deleteHeroImage(img.id); toast.success('Удалено'); }} className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
        {imgs.length === 0 && <div className="text-sm text-muted-foreground">Пока нет изображений. Добавьте первое!</div>}
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
    } catch {
      toast.error('Ошибка импорта категорий: ожидается JSON массив');
    }
  };
  const importProducts = async () => {
    try {
      const arr = JSON.parse(prodText);
      if (!Array.isArray(arr)) throw new Error();
      for (const p of arr) {
        if (!p.name || !p.price) continue;
        await store.addProduct({
          name: String(p.name).trim(),
          price: Number(p.price),
          oldPrice: p.oldPrice ? Number(p.oldPrice) : undefined,
          category: String(p.category || ''),
          badge: p.badge === 'new' || p.badge === 'sale' ? p.badge : undefined,
          description: String(p.description || ''),
          image: String(p.image || ''),
          popularity: Number(p.popularity || 5),
          active: p.active !== false,
        } as any);
      }
      toast.success('Товары импортированы');
    } catch {
      toast.error('Ошибка импорта товаров: ожидается JSON массив');
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
          placeholder='[{"name":"Шоколад","price":290,"category":"chocolate","description":"...","image":"/images/chocolate.jpg","badge":"new","popularity":8,"active":true}]'
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
function ProductForm({ product, categories: cats, badges, onSave, onCancel }: {
  product: Product | null;
  categories: Category[];
  badges: Badge[];
  onSave: (data: Partial<Product>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: product?.name || '',
    price: product?.price || 0,
    oldPrice: product?.oldPrice || 0,
    category: product?.category || cats[0]?.id || '',
    badge: product?.badge || '',
    description: product?.description || '',
    image: product?.image || '/images/gift-box.jpg',
    images: product?.images || (product?.image ? [product.image] : [] as string[]),
    popularity: product?.popularity || 5,
    active: product?.active !== false,
  });
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Введите название'); return; }
    if (form.price <= 0) { toast.error('Введите цену'); return; }
    let images: string[] = [];
    try {
      const { api } = await import('@/lib/api');
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
    onSave({
      name: form.name.trim(), price: form.price,
      oldPrice: form.oldPrice || undefined, category: form.category,
      badge: (form.badge as Product['badge']) || undefined,
      description: form.description.trim(), image: images[0] || form.image, images,
      popularity: form.popularity, active: Boolean(form.active),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm mb-6 grid gap-4 sm:grid-cols-2">
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
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Категория</label>
        <select value={form.category} onChange={e => set('category', e.target.value)} className="admin-input">
          {cats.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Бейдж</label>
        <select value={form.badge} onChange={e => set('badge', e.target.value)} className="admin-input">
          <option value="">Нет</option>
          {badges.map(b => (
            <option key={b.id} value={b.id}>{b.label}{b.active ? '' : ' (выключен)'}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Популярность (1-10)</label>
        <input type="number" value={form.popularity} onChange={e => set('popularity', +e.target.value)} className="admin-input" min={1} max={10} />
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

/* ─── Categories Tab ─── */
function CategoriesTab({ store }: { store: ReturnType<typeof useStore> }) {
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);

  const colorOptions = [
    { value: 'candy-pink', label: '🩷 Розовый' },
    { value: 'candy-mint', label: '🌿 Мятный' },
    { value: 'candy-lavender', label: '💜 Лавандовый' },
    { value: 'candy-blue', label: '💙 Голубой' },
    { value: 'candy-banana', label: '💛 Банановый' },
  ];

  return (
    <div>
      <button onClick={() => { setCreating(true); setEditing(null); }}
        className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-medium hover:scale-[1.02] active:scale-95 transition-transform">
        <Plus size={16} /> Добавить категорию
      </button>

      {(creating || editing) && (
        <CategoryForm
          category={editing}
          colorOptions={colorOptions}
          onSave={(data) => {
            if (editing) { store.updateCategory(editing.id, data); toast.success('Категория обновлена'); }
            else { store.addCategory(data as Omit<Category, 'id'> & { id?: string }); toast.success('Категория добавлена'); }
            setEditing(null); setCreating(false);
          }}
          onCancel={() => { setEditing(null); setCreating(false); }}
        />
      )}

      <div className="grid gap-3">
        {store.categories.map(c => (
          <div key={c.id} className="flex items-center gap-4 bg-card rounded-2xl p-4 border border-border/40 shadow-sm">
            <span className="text-2xl w-10 h-10 rounded-xl flex items-center justify-center bg-muted">{c.emoji}</span>
            <div className="flex-1 min-w-0">
              <span className="font-display font-semibold text-sm">{c.name}</span>
              <span className="text-xs text-muted-foreground ml-2">id: {c.id}</span>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => { setEditing(c); setCreating(false); }}
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                <Pencil size={15} />
              </button>
              <button onClick={() => { store.deleteCategory(c.id); toast.success('Удалено'); }}
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

/* ─── Category Form ─── */
function CategoryForm({ category, colorOptions, onSave, onCancel }: {
  category: Category | null;
  colorOptions: { value: string; label: string }[];
  onSave: (data: Partial<Category> & { id?: string }) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    id: category?.id || '',
    name: category?.name || '',
    emoji: category?.emoji || '🍬',
    color: category?.color || 'candy-pink',
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const isNew = !category;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Введите название'); return; }
    if (isNew && !form.id.trim()) { toast.error('Введите ID категории'); return; }
    onSave({
      ...(isNew ? { id: form.id.trim().toLowerCase().replace(/\s+/g, '_') } : {}),
      name: form.name.trim(),
      emoji: form.emoji,
      color: form.color,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm mb-6 grid gap-4 sm:grid-cols-2">
      {isNew && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">ID (латиница)</label>
          <input value={form.id} onChange={e => set('id', e.target.value)} maxLength={30}
            className="admin-input" placeholder="например: candy" />
        </div>
      )}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Название</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} maxLength={50}
          className="admin-input" placeholder="Название категории" />
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
    await store.updateOrder(id, data);
    toast.success('Заказ обновлён');
    setDrafts(prev => {
      const { [id]: _omit, ...rest } = prev;
      return rest;
    });
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
                {o.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{item.name} × {item.quantity}</span>
                    <span className="text-muted-foreground">{item.price} ₽</span>
                  </div>
                ))}
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
          const count = store.products.filter(p => p.badge === b.id).length;
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
                  className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                  <Pencil size={15} />
                </button>
                <button onClick={() => { store.deleteBadge(b.id); toast.success('Удалено'); }}
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

  return (
    <div>
      <button onClick={() => { setCreating(true); setEditing(null); }}
        className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-medium hover:scale-[1.02] active:scale-95 transition-transform">
        <Plus size={16} /> Добавить промокод
      </button>

      {(creating || editing) && (
        <PromoForm
          promo={editing}
          categories={store.categories}
          onSave={(data) => {
            if (editing) { store.updatePromo(editing.id, data); toast.success('Промокод обновлён'); }
            else { store.addPromo(data as any); toast.success('Промокод добавлен'); }
            setEditing(null); setCreating(false);
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
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                <Pencil size={15} />
              </button>
              <button onClick={() => { store.deletePromo(pr.id); toast.success('Удалено'); }}
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
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const isNew = !promo;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) { toast.error('Введите код'); return; }
    if (form.percent <= 0 || form.percent > 90) { toast.error('Процент 1–90'); return; }
    const payload: any = {
      code: form.code.trim().toUpperCase(),
      percent: Number(form.percent),
      scope: form.scope as PromoScope,
      active: Boolean(form.active),
    };
    if (form.scope === 'category') payload.categories = form.categories.filter(Boolean);
    if (form.scope === 'product') {
      const ids = form.products.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n > 0);
      payload.products = ids;
    }
    onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-5 border border-border/40 shadow-sm mb-6 grid gap-4 sm:grid-cols-2">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Код</label>
        <input value={form.code} onChange={e => set('code', e.target.value)} maxLength={30} className="admin-input" placeholder="например: SWEET15" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Скидка, %</label>
        <input type="number" value={form.percent} onChange={e => set('percent', +e.target.value)} className="admin-input" min={1} max={90} />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Область</label>
        <select value={form.scope} onChange={e => set('scope', e.target.value)} className="admin-input">
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
          article={editing}
          onSave={(data) => {
            if (editing) { store.updateArticle(editing.id, data); toast.success('Статья обновлена'); }
            else { store.addArticle(data as Omit<Article, 'id'>); toast.success('Статья добавлена'); }
            setEditing(null); setCreating(false);
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
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                <Pencil size={15} />
              </button>
              <button onClick={() => { store.deleteArticle(a.id); toast.success('Удалено'); }}
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
function ArticleForm({ article, onSave, onCancel, products }: {
  article: Article | null;
  onSave: (data: Partial<Article>) => void;
  onCancel: () => void;
  products: Product[];
}) {
  const [form, setForm] = useState({
    title: article?.title || '', excerpt: article?.excerpt || '',
    content: article?.content || '',
    tag: article?.tag || 'Советы', readTime: article?.readTime || '5 мин',
    image: article?.image || '', slug: article?.slug || '',
    productId: article?.productId ? String(article.productId) : '',
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Введите заголовок'); return; }
    if (!form.excerpt.trim()) { toast.error('Введите текст статьи'); return; }
    const slug = form.slug.trim() || toSlug(form.title);
    onSave({ title: form.title.trim(), excerpt: form.excerpt.trim(), content: form.content.trim() || undefined, tag: form.tag, readTime: form.readTime, image: form.image || undefined, slug, productId: form.productId ? Number(form.productId) : undefined });
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

function FooterTab({ store }: { store: ReturnType<typeof useStore> }) {
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
    socialItems: store.footer.socialItems.join('\n'),
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
      socialItems: store.footer.socialItems.join('\n'),
      copyright: store.footer.copyright,
    });
  }, [store.footer]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const deliveryItems = form.deliveryItems.split('\n').map(s => s.trim()).filter(Boolean);
    const socialItems = form.socialItems.split('\n').map(s => s.trim()).filter(Boolean);
    if (!form.brandName.trim()) { toast.error('Введите название магазина'); return; }
    if (!form.description.trim()) { toast.error('Введите описание'); return; }
    if (!form.deliveryTitle.trim()) { toast.error('Введите заголовок доставки'); return; }
    if (!deliveryItems.length) { toast.error('Добавьте пункты доставки'); return; }
    if (!form.contactsTitle.trim()) { toast.error('Введите заголовок контактов'); return; }
    if (!form.phone.trim()) { toast.error('Введите телефон'); return; }
    if (!form.email.trim()) { toast.error('Введите email'); return; }
    if (!form.address.trim()) { toast.error('Введите адрес'); return; }
    if (!form.copyright.trim()) { toast.error('Введите копирайт'); return; }
    store.updateFooter({
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
      copyright: form.copyright.trim(),
    });
    toast.success('Футер обновлён');
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
            className="admin-input" placeholder="Конфетная Страна" />
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
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Соцсети (по одному в строке)</label>
        <textarea value={form.socialItems} onChange={e => set('socialItems', e.target.value)} maxLength={200}
          rows={2} className="admin-input resize-y" placeholder="📱 Telegram" />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Копирайт</label>
        <input value={form.copyright} onChange={e => set('copyright', e.target.value)} maxLength={120}
          className="admin-input" placeholder="© 2026 Конфетная Страна. Все права защищены." />
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
