import { useMemo, useState } from 'react';
import { useStore } from './useStore';

type SocialLink = { label: string; url?: string };

export default function Footer() {
  const { footer } = useStore();
  const socialLinks: SocialLink[] = useMemo(() => {
    const footerWithLinks = footer as typeof footer & { socialLinks?: SocialLink[] };
    if (Array.isArray(footerWithLinks.socialLinks) && footerWithLinks.socialLinks.length > 0) {
      return footerWithLinks.socialLinks;
    }
    return footer.socialItems.map((item) => ({ label: item }));
  }, [footer]);
  const renderSocialItem = (item: SocialLink, i: number) => {
    if (!item.url) {
      return (
        <span key={`${item.label}-${i}`} className="hover:scale-110 transition-transform cursor-pointer">
          {item.label}
        </span>
      );
    }
    return (
      <a
        key={`${item.label}-${i}`}
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="hover:scale-110 transition-transform inline-block hover:text-foreground"
      >
        {item.label}
      </a>
    );
  };
  const logoCandidates = useMemo(
    () => ['/logo.png', '/logo.webp', '/logo.svg', '/images/logo.png', '/images/logo.webp', '/images/logo.svg'],
    []
  );
  const [logoSrc, setLogoSrc] = useState(logoCandidates[0]);
  const [logoFailed, setLogoFailed] = useState(false);
  return (
    <footer id="footer" className="bg-card border-t border-border py-10">
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
              {!logoFailed ? (
                <img
                  src={logoSrc}
                  alt={footer.brandName}
                  className="h-7 w-7 object-contain"
                  onError={() => {
                    const idx = logoCandidates.indexOf(logoSrc);
                    const next = logoCandidates[idx + 1];
                    if (next) setLogoSrc(next);
                    else setLogoFailed(true);
                  }}
                />
              ) : (
                <span>{footer.brandEmoji}</span>
              )}{' '}
              {footer.brandName}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {footer.description}
            </p>
          </div>

          <div>
            <h4 className="font-display font-semibold mb-3">{footer.deliveryTitle}</h4>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              {footer.deliveryItems.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-display font-semibold mb-3">{footer.contactsTitle}</h4>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li>{footer.phone}</li>
              <li>{footer.email}</li>
              <li>{footer.address}</li>
              <li className="flex gap-3 pt-2">
                {socialLinks.map(renderSocialItem)}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          {footer.copyright}
        </div>
      </div>
    </footer>
  );
}
