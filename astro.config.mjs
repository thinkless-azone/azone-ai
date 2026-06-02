import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';

const contactFunctionTarget =
  process.env.PUBLIC_CONTACT_FUNCTION_URL ||
  'https://functions.yandexcloud.net/d4erei6bq3unc5ficeqm';

export default defineConfig({
  site: 'https://azoneai.ru',
  output: 'static',
  trailingSlash: 'always',
  integrations: [
    tailwind({ applyBaseStyles: false }),
    sitemap({
      filter: (page) => !page.includes('/whitepaper/thanks'),
    }),
  ],
  build: { format: 'directory' },
  vite: {
    server: {
      proxy: {
        '/api/contact': {
          target: contactFunctionTarget,
          changeOrigin: true,
          secure: true,
          rewrite: () => new URL(contactFunctionTarget).pathname,
        },
      },
    },
  },
});
