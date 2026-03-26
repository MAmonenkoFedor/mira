import { Link } from 'react-router-dom';
import { Truck, ShieldCheck, Gift, Heart } from 'lucide-react';
import { useStore } from './useStore';

const iconMap = {
  Truck,
  ShieldCheck,
  Gift,
  Heart,
} as const;

export default function Benefits() {
  const { featureBlocks } = useStore();

  return (
    <section id="benefits" className="py-12 md:py-16">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {featureBlocks.map((b) => {
            const Icon = iconMap[b.icon as keyof typeof iconMap] || Truck;
            const link = (b.link || '').trim();
            const isExternal = /^https?:\/\//i.test(link);
            const content = (
              <>
                <div className={`w-14 h-14 rounded-2xl ${b.bgColor || 'bg-candy-pink'} flex items-center justify-center mb-3`}>
                  <Icon size={24} className="text-primary" />
                </div>
                <h3 className="font-display font-semibold text-sm mb-1">{b.title}</h3>
                <p className="text-xs text-muted-foreground">{b.description}</p>
              </>
            );
            if (link) {
              return isExternal ? (
                <a key={b.id} href={link} target="_blank" rel="noreferrer" className="reveal flex flex-col items-center text-center p-6 rounded-3xl bg-card border border-border/50 hover:shadow-md transition-shadow">
                  {content}
                </a>
              ) : (
                <Link key={b.id} to={link} className="reveal flex flex-col items-center text-center p-6 rounded-3xl bg-card border border-border/50 hover:shadow-md transition-shadow">
                  {content}
                </Link>
              );
            }
            return (
              <div key={b.id} className="reveal flex flex-col items-center text-center p-6 rounded-3xl bg-card border border-border/50">
                {content}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
