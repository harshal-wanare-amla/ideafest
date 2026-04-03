import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { portCleanupPlugin } from './vite-plugins/port-cleanup.js';

export default defineConfig({
  plugins: [portCleanupPlugin(5173), react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/search': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/ai-search': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/autocomplete': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/seed': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/search/trending': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/search/analytics': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/track': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/keywords': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/generate-synonyms': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/update-synonyms': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
