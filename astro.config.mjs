// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://mapmyroots.com',
  output: 'static',
  trailingSlash: 'ignore',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'de', 'es', 'ru'],
    routing: {
      prefixDefaultLocale: false
    },
    fallback: {
      de: 'en',
      es: 'en',
      ru: 'en'
    }
  },
  build: {
    format: 'directory',
    assets: '_astro'
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/offline'),
      changefreq: 'weekly',
      priority: 0.7,
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'en-US',
          de: 'de-DE',
          es: 'es-ES',
          ru: 'ru-RU'
        }
      }
    })
  ],
  vite: {
    build: {
      sourcemap: true
    }
  }
});
