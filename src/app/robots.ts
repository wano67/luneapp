import type { MetadataRoute } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lune.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl.replace(/\/+$/, ''),
  };
}
