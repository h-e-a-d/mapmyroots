// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import AstroPWA from '@vite-pwa/astro';
import { sitemapFilter } from './src/config/sitemap-filter.mjs';

export default defineConfig({
  site: 'https://mapmyroots.com',
  output: 'static',
  // Astro 7 defaults to 'jsx', which drops spaces between adjacent inline elements. Keep the old output.
  compressHTML: true,
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
      filter: sitemapFilter,
      changefreq: 'weekly',
      priority: 0.7,
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'en',
          de: 'de',
          es: 'es',
          ru: 'ru'
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
        globPatterns: ['**/*.{html,css,woff2,svg,png,jpg,json}'],
        globIgnores: ['**/og/**', '**/screenshots/**'],
        navigateFallback: '/offline',
        navigateFallbackDenylist: [/^\/builder/, /^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /\/_astro\/.+\.m?js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'astro-js',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
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
      sourcemap: true,
      // Vite 8 raised the browser default to "baseline widely available" (e.g. Safari 16.4), which
      // emits range media queries (width<=1024px) that older iOS Safari ignores. Keep Vite 6's
      // targets. Astro emits CSS from its server build, so cssTarget has to be set here.
      cssTarget: ['edge88', 'firefox78', 'chrome87', 'safari14'],
      rolldownOptions: {
        treeshake: {
          // Mark info-level logging as pure so the production bundle drops it.
          // console.warn / console.error are intentionally kept. (Vite 8 bundles with Rolldown;
          // the old esbuild.pure setting is ignored.)
          manualPureFunctions: ['console.log', 'console.debug', 'console.info']
        }
      }
    },
    environments: {
      client: {
        build: {
          // Same browser targets for client JS. Client-only: Astro's server build sets its own.
          target: ['edge88', 'firefox78', 'chrome87', 'safari14']
        }
      }
    }
  }
});
