// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://mapmyroots.com',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
    assets: '_astro'
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/offline'),
      changefreq: 'weekly',
      priority: 0.7
    })
  ],
  vite: {
    build: {
      sourcemap: true
    }
  }
});
