import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://azoneai.ru',
  output: 'static',
  integrations: [tailwind({ applyBaseStyles: false }), sitemap()],
  build: { format: 'directory' },
});
