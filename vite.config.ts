import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/**
 * Fills __SITE_URL__ in index.html (share-card URLs) from VITE_SITE_URL, e.g. https://playbook.example.com.
 * Left empty the URLs stay relative, and server/index.mjs makes them absolute from the request host.
 */
function siteUrl(mode: string): Plugin {
  const url = (loadEnv(mode, process.cwd(), 'VITE_').VITE_SITE_URL ?? '').replace(/\/+$/, '');
  return { name: 'site-url', transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', url) };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), siteUrl(mode)],
  server: {
    proxy: { '/api': 'http://localhost:8787' },
  },
}));
