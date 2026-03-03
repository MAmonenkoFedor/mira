import { useState } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';

export default function ContactForm() {
  const [form, setForm] = useState({ name: '', phone: '', message: '' });
  const [sending, setSending] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const phone = form.phone.trim();
    const message = form.message.trim();

    if (!name || !phone) {
      toast.error('Заполните имя и телефон');
      return;
    }
    if (phone.length < 6 || phone.length > 20) {
      toast.error('Введите корректный номер телефона');
      return;
    }

    setSending(true);
    // Demo — simulate sending
    setTimeout(() => {
      setSending(false);
      setForm({ name: '', phone: '', message: '' });
      toast.success('Спасибо! Мы свяжемся с вами в ближайшее время 💌');
    }, 800);
  };

  return (
    <section id="contact-form" className="py-16 md:py-20">
      <div className="container max-w-lg">
        <div className="text-center mb-8">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">
            Напишите нам ✉️
          </h2>
          <p className="text-muted-foreground text-sm md:text-base">
            Остались вопросы? Оставьте заявку, и мы перезвоним!
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="reveal bg-card rounded-3xl p-6 md:p-8 shadow-soft border border-border/40 flex flex-col gap-4"
        >
          <div>
            <label htmlFor="cf-name" className="text-sm font-medium text-foreground mb-1 block">
              Имя <span className="text-destructive">*</span>
            </label>
            <input
              id="cf-name"
              type="text"
              maxLength={100}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ваше имя"
              className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
            />
          </div>

          <div>
            <label htmlFor="cf-phone" className="text-sm font-medium text-foreground mb-1 block">
              Телефон <span className="text-destructive">*</span>
            </label>
            <input
              id="cf-phone"
              type="tel"
              maxLength={20}
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+7 (___) ___-__-__"
              className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
            />
          </div>

          <div>
            <label htmlFor="cf-msg" className="text-sm font-medium text-foreground mb-1 block">
              Сообщение
            </label>
            <textarea
              id="cf-msg"
              maxLength={1000}
              rows={3}
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="Ваш вопрос или пожелание..."
              className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="mt-1 flex items-center justify-center gap-2 w-full rounded-full bg-primary text-primary-foreground font-display font-medium text-sm py-3 hover:scale-[1.02] active:scale-95 transition-transform duration-200 disabled:opacity-60"
          >
            <Send size={16} />
            {sending ? 'Отправка...' : 'Отправить'}
          </button>
        </form>
      </div>
    </section>
  );
}
