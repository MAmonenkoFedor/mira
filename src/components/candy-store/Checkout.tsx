import { useState } from 'react';
import { X, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import type { Order } from './useCart';

interface CheckoutProps {
  open: boolean;
  onClose: () => void;
  total: number;
  onPlaceOrder: (
    contact: { name: string; phone: string; email?: string },
    delivery: { address: string; method: string; payment: string }
  ) => Order;
}

export default function Checkout({ open, onClose, total, onPlaceOrder }: CheckoutProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [method, setMethod] = useState('courier');
  const [payment, setPayment] = useState('card');
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [order, setOrder] = useState<Order | null>(null);

  if (!open) return null;

  const validateStep1 = () => {
    const errs: Record<string, boolean> = {};
    if (!name.trim()) errs.name = true;
    if (!phone.trim()) errs.phone = true;
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

  const handleSubmit = () => {
    if (!validateStep2()) return;
    const o = onPlaceOrder({ name, phone, email: email.trim() || undefined }, { address, method, payment });
    setOrder(o);
    setStep(3);
  };

  const methodLabels: Record<string, string> = { courier: 'Курьер', pvz: 'ПВЗ', post: 'Почта' };
  const paymentLabels: Record<string, string> = { card: 'Карта', cash: 'При получении' };

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
          {step < 3 && (
            <div className="flex items-center gap-2 mb-6">
              {[1, 2].map(s => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-display font-bold ${
                    s <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {s < step ? <Check size={14} /> : s}
                  </div>
                  {s < 2 && <div className={`h-0.5 w-8 rounded ${s < step ? 'bg-primary' : 'bg-muted'}`} />}
                </div>
              ))}
              <span className="ml-2 text-sm text-muted-foreground font-display">
                {step === 1 ? 'Контакты' : 'Доставка'}
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
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className={`w-full px-4 py-3 rounded-2xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.phone ? 'border-destructive' : 'border-border'}`}
                  placeholder="+7 (___) ___-__-__"
                  type="tel"
                />
                {errors.phone && <p className="text-destructive text-xs mt-1">Укажите телефон</p>}
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
              <h3 className="font-display text-lg font-bold">Доставка и оплата</h3>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Адрес *</label>
                <input
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className={`w-full px-4 py-3 rounded-2xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.address ? 'border-destructive' : 'border-border'}`}
                  placeholder="Город, улица, дом, квартира"
                />
                {errors.address && <p className="text-destructive text-xs mt-1">Укажите адрес</p>}
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Способ доставки</label>
                <div className="flex gap-2">
                  {Object.entries(methodLabels).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => setMethod(k)}
                      className={`candy-chip text-xs flex-1 text-center ${method === k ? 'active' : ''}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Оплата</label>
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
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
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

          {step === 3 && order && (
            <div className="text-center py-6">
              <span className="text-6xl mb-4 block">🎉</span>
              <h3 className="font-display text-2xl font-bold mb-2">Спасибо!</h3>
              <p className="text-muted-foreground mb-1">Ваш заказ №{order.id} оформлен</p>
              <p className="text-sm text-muted-foreground mb-6">Мы свяжемся с вами для подтверждения</p>
              <button
                onClick={() => { onClose(); setStep(1); setOrder(null); setName(''); setPhone(''); setEmail(''); setAddress(''); }}
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
