import { useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface SeoProps {
  title?: string;
  description?: string;
  path?: string;
  type?: string;
  jsonLd?: Record<string, unknown>;
}

export function useSeo({ title, description, path, type = 'website', jsonLd }: SeoProps = {}) {
  const { language } = useLanguage();

  useEffect(() => {
    // Update <html lang> and dir
    const html = document.documentElement;
    html.lang = language;
    html.dir = language === 'ar' || language === 'he' ? 'rtl' : 'ltr';

    // Update title
    if (title) {
      document.title = title;
    }

    // Update or create meta tags
    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    if (description) {
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
      setMeta('name', 'twitter:description', description);
    }

    if (title) {
      setMeta('property', 'og:title', title);
      setMeta('name', 'twitter:title', title);
    }

    if (type) {
      setMeta('property', 'og:type', type);
    }

    if (path) {
      const url = `https://albayt.cloud${path}`;
      setMeta('property', 'og:url', url);

      // Update canonical
      let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      canonical.href = url;
    }

    // JSON-LD structured data
    const existingLd = document.querySelector('script[data-seo-jsonld]');
    if (existingLd) existingLd.remove();

    if (jsonLd) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-seo-jsonld', 'true');
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      const ld = document.querySelector('script[data-seo-jsonld]');
      if (ld) ld.remove();
    };
  }, [title, description, path, type, language, jsonLd]);
}
