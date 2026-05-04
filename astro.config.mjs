// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import AstroPWA from '@vite-pwa/astro';

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
    }),
    AstroPWA({
      mode: 'production',
      base: '/',
      scope: '/',
      registerType: 'autoUpdate',
      injectRegister: 'inline',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{html,js,css,woff2,svg,png,jpg,json}'],
        globIgnores: ['**/og/**', '**/screenshots/**'],
        navigateFallback: '/offline',
        navigateFallbackDenylist: [/^\/builder/, /^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/static\.cloudflareinsights\.com\/.*/,
            handler: 'NetworkOnly'
          },
          {
            urlPattern: /\/assets\/locales\/.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'locales',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          {
            urlPattern: /\.(?:woff2|woff|ttf)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  vite: {
    build: {
      sourcemap: true
    }
  }
});
