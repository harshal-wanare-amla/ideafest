import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/search': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/ai-search': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/autocomplete': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/seed': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/search/trending': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/search/analytics': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/keywords': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/generate-synonyms': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/update-synonyms': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
});
