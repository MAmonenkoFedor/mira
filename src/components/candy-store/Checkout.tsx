import { useRef, useState } from 'react';
import { X, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import type { Order } from './useCart';
import { api } from '@/lib/api';

interface CheckoutProps {
  open: boolean;
  onClose: () => void;
  total: number;
  onPlaceOrder: (
    contact: { name: string; phone: string; email?: string },
    delivery: { address: string; method: string; payment: string }
  ) => Order;
}

function normalizeRuPhone(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('8') && digits.length >= 11) return `7${digits.slice(1, 11)}`;
  if (digits.startsWith('7') && digits.length >= 11) return digits.slice(0, 11);
  if (digits.length === 10) return `7${digits}`;
  return digits.slice(0, 11);
}

function formatRuPhone(raw: string) {
  const normalized = normalizeRuPhone(raw);
  if (!normalized) return '';
  const local = normalized.startsWith('7') ? normalized.slice(1) : normalized;
  const p1 = local.slice(0, 3);
  const p2 = local.slice(3, 6);
  const p3 = local.slice(6, 8);
  const p4 = local.slice(8, 10);
  if (local.length <= 3) return `+7 (${p1}`;
  if (local.length <= 6) return `+7 (${p1}) ${p2}`;
  if (local.length <= 8) return `+7 (${p1}) ${p2}-${p3}`;
  return `+7 (${p1}) ${p2}-${p3}-${p4}`;
}

function isValidRuPhone(raw: string) {
  const normalized = normalizeRuPhone(raw);
  return normalized.length === 11 && normalized.startsWith('7');
}

function caretFromDigitCount(formatted: string, digitCount: number) {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    if (/\d/.test(formatted[i])) {
      seen += 1;
      if (seen >= digitCount) return i + 1;
    }
  }
  return formatted.length;
}

export default function Checkout({ open, onClose, total, onPlaceOrder }: CheckoutProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [method, setMethod] = useState('courier');
  const [payment, setPayment] = useState('card');
  const [pickupProvider, setPickupProvider] = useState<'ozon' | 'cdek' | 'russianPost'>('ozon');
  const [pickupMode, setPickupMode] = useState<'fake' | 'real'>('fake');
  const [pickupCity, setPickupCity] = useState('Москва');
  const [pickupPoints, setPickupPoints] = useState<Array<{ id: string; name: string; address: string; workHours?: string }>>([]);
  const [pickupSelectedId, setPickupSelectedId] = useState('');
  const [pickupLoading, setPickupLoading] = useState(false);
  const [pickupError, setPickupError] = useState('');
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [phoneError, setPhoneError] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const validateStep1 = () => {
    const errs: Record<string, boolean> = {};
    setPhoneError('');
    if (!name.trim()) errs.name = true;
    if (!phone.trim()) {
      errs.phone = true;
      setPhoneError('Укажите телефон');
    } else if (!isValidRuPhone(phone)) {
      errs.phone = true;
      setPhoneError('Введите корректный номер РФ в формате +7 (999) 123-45-67');
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs: Record<string, boolean> = {};
    if (!address.trim()) errs.address = true;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) { setStep(2); setErrors({}); }
  };

  const handleNextDelivery = () => {
    if (validateStep2()) { setStep(3); setErrors({}); }
  };

  const handleSubmit = () => {
    const phoneNormalized = normalizeRuPhone(phone);
    const o = onPlaceOrder({ name, phone: phoneNormalized ? `+${phoneNormalized}` : phone, email: email.trim() || undefined }, { address, method, payment });
    setOrder(o);
    setStep(4);
  };

  const methodLabels: Record<string, string> = { courier: 'Курьер', pvz: 'ПВЗ', post: 'Почта' };
  const paymentLabels: Record<string, string> = { card: 'Карта', cash: 'При получении' };

  const loadPickupPoints = async () => {
    setPickupLoading(true);
    setPickupError('');
    try {
      const city = pickupCity.trim() || 'Москва';
      const response = await api.getPickupPoints({ provider: pickupProvider, mode: pickupMode, city }) as { points?: Array<{ id: string; name: string; address: string; workHours?: string }> };
      const points = Array.isArray(response?.points) ? response.points : [];
      setPickupPoints(points);
      if (!points.length) {
        setPickupError('Точки не найдены');
        return;
      }
      const first = points[0];
      setPickupSelectedId(first.id);
      setAddress(first.address);
    } catch {
      setPickupPoints([]);
      setPickupError('Не удалось загрузить точки выдачи');
    } finally {
      setPickupLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" />
      <div
        className="relative bg-card rounded-3xl shadow-candy-lg max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:scale-110 transition-transform"
          aria-label="Закрыть"
        >
          <X size={18} />
        </button>

        <div className="p-6">
          {/* Stepper */}
          {step < 4 && (
            <div className="flex items-center gap-2 mb-6">
              {[1, 2, 3].map(s => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-display font-bold ${
                    s <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {s < step ? <Check size={14} /> : s}
                  </div>
                  {s < 3 && <div className={`h-0.5 w-8 rounded ${s < step ? 'bg-primary' : 'bg-muted'}`} />}
                </div>
              ))}
              <span className="ml-2 text-sm text-muted-foreground font-display">
                {step === 1 ? 'Контакты' : step === 2 ? 'Доставка' : 'Оплата'}
              </span>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-display text-lg font-bold">Контактные данные</h3>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Имя</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={`w-full px-4 py-3 rounded-2xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.name ? 'border-destructive' : 'border-border'}`}
                  placeholder="Ваше имя"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Телефон *</label>
                <input
                  ref={phoneInputRef}
                  value={phone}
                  onFocus={() => {
                    if (phone.trim()) return;
                    const next = '+7 (';
                    setPhone(next);
                    requestAnimationFrame(() => {
                      const input = phoneInputRef.current;
                      if (input && document.activeElement === input) input.setSelectionRange(next.length, next.length);
                    });
                  }}
                  onChange={e => {
                    const rawValue = e.target.value;
                    const rawCaret = e.target.selectionStart ?? rawValue.length;
                    const digitsBeforeCaret = rawValue.slice(0, rawCaret).replace(/\D/g, '');
                    const normalizedDigitsBeforeCaret = normalizeRuPhone(digitsBeforeCaret);
                    const formattedPhone = formatRuPhone(rawValue);
                    const nextCaret = caretFromDigitCount(formattedPhone, normalizedDigitsBeforeCaret.length);
                    setPhone(formattedPhone);
                    requestAnimationFrame(() => {
                      const input = phoneInputRef.current;
                      if (input && document.activeElement === input) input.setSelectionRange(nextCaret, nextCaret);
                    });
                    if (errors.phone) setErrors(prev => ({ ...prev, phone: false }));
                    if (phoneError) setPhoneError('');
                  }}
                  className={`w-full px-4 py-3 rounded-2xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.phone ? 'border-destructive' : 'border-border'}`}
                  placeholder="+7 (___) ___-__-__"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  maxLength={18}
                />
                {errors.phone && <p className="text-destructive text-xs mt-1">{phoneError}</p>}
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Почта</label>
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 border-border"
                  placeholder="email@example.com"
                  type="email"
                />
              </div>
              <button
                onClick={handleNext}
                className="w-full py-3.5 rounded-full bg-primary text-primary-foreground font-display font-semibold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                Далее <ArrowRight size={16} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-display text-lg font-bold">Доставка</h3>
              <div className="rounded-2xl border border-border p-3 space-y-3 bg-muted/20">
                <label className="text-sm text-muted-foreground block">Способ доставки</label>
                <div className="flex gap-2">
                  {Object.entries(methodLabels).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => {
                        setMethod(k);
                        if (k !== 'pvz') {
                          setPickupPoints([]);
                          setPickupSelectedId('');
                          setPickupError('');
                        }
                      }}
                      className={`candy-chip text-xs flex-1 text-center ${method === k ? 'active' : ''}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">{method === 'pvz' ? 'Адрес ПВЗ *' : 'Адрес *'}</label>
                  <input
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className={`w-full px-4 py-3 rounded-2xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.address ? 'border-destructive' : 'border-border'}`}
                    placeholder={method === 'pvz' ? 'Выберите ПВЗ ниже или введите адрес вручную' : 'Город, улица, дом, квартира'}
                  />
                  {errors.address && <p className="text-destructive text-xs mt-1">Укажите адрес</p>}
                </div>
              </div>
              {method === 'pvz' && (
                <div className="space-y-3 rounded-2xl border border-border p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Провайдер ПВЗ</label>
                      <select
                        value={pickupProvider}
                        onChange={e => setPickupProvider(e.target.value as 'ozon' | 'cdek' | 'russianPost')}
                        className="w-full px-3 py-2 rounded-xl border border-border text-sm bg-background"
                      >
                        <option value="ozon">Ozon</option>
                        <option value="cdek">CDEK</option>
                        <option value="russianPost">Почта России</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Режим</label>
                      <select
                        value={pickupMode}
                        onChange={e => setPickupMode(e.target.value as 'fake' | 'real')}
                        className="w-full px-3 py-2 rounded-xl border border-border text-sm bg-background"
                      >
                        <option value="fake">Тестовые данные</option>
                        <option value="real">Реальные ключи</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={pickupCity}
                      onChange={e => setPickupCity(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-border text-sm"
                      placeholder="Город для поиска ПВЗ"
                    />
                    <button
                      onClick={loadPickupPoints}
                      disabled={pickupLoading}
                      className="px-4 py-2 rounded-xl bg-muted text-sm font-medium disabled:opacity-60"
                    >
                      {pickupLoading ? 'Поиск…' : 'Найти ПВЗ'}
                    </button>
                  </div>
                  {!!pickupError && <p className="text-xs text-destructive">{pickupError}</p>}
                  {!!pickupPoints.length && (
                    <div className="grid gap-2 max-h-48 overflow-y-auto">
                      {pickupPoints.map(point => (
                        <button
                          key={point.id}
                          onClick={() => {
                            setPickupSelectedId(point.id);
                            setAddress(point.address);
                          }}
                          className={`text-left rounded-xl border px-3 py-2 transition-colors ${pickupSelectedId === point.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}
                        >
                          <div className="text-sm font-medium">{point.name}</div>
                          <div className="text-xs text-muted-foreground">{point.address}</div>
                          {!!point.workHours && <div className="text-[11px] text-muted-foreground mt-0.5">{point.workHours}</div>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="py-3.5 px-6 rounded-full border-2 border-border font-display font-medium text-sm hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center gap-1"
                >
                  <ArrowLeft size={14} /> Назад
                </button>
                <button
                  onClick={handleNextDelivery}
                  className="flex-1 py-3.5 rounded-full bg-primary text-primary-foreground font-display font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform"
                >
                  К оплате <ArrowRight size={16} className="inline ml-1" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-display text-lg font-bold">Оплата</h3>
              <div className="rounded-2xl border border-border p-3 bg-muted/20 space-y-3">
                <label className="text-sm text-muted-foreground block">Способ оплаты</label>
                <div className="flex gap-2">
                  {Object.entries(paymentLabels).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => setPayment(k)}
                      className={`candy-chip text-xs flex-1 text-center ${payment === k ? 'active' : ''}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-border p-3 bg-card">
                <div className="text-sm font-medium mb-2">Параметры заказа</div>
                <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
                  <div>Доставка: {methodLabels[method]}</div>
                  <div>Адрес: {address}</div>
                  <div>Оплата: {paymentLabels[payment]}</div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Итого</span>
                  <span className="font-display font-bold text-base">{total} ₽</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="py-3.5 px-6 rounded-full border-2 border-border font-display font-medium text-sm hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center gap-1"
                >
                  <ArrowLeft size={14} /> Назад
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-3.5 rounded-full bg-primary text-primary-foreground font-display font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform"
                >
                  Оплатить {total} ₽
                </button>
              </div>
            </div>
          )}

          {step === 4 && order && (
            <div className="text-center py-6">
              <span className="text-6xl mb-4 block">🎉</span>
              <h3 className="font-display text-2xl font-bold mb-2">Спасибо!</h3>
              <p className="text-muted-foreground mb-1">Ваш заказ №{order.id} оформлен</p>
              <p className="text-sm text-muted-foreground mb-6">Мы свяжемся с вами для подтверждения</p>
              <button
                onClick={() => { onClose(); setStep(1); setOrder(null); setName(''); setPhone(''); setEmail(''); setAddress(''); setPickupPoints([]); setPickupSelectedId(''); setPickupError(''); }}
                className="px-8 py-3 rounded-full bg-primary text-primary-foreground font-display font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                Продолжить покупки
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
