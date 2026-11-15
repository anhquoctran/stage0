import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { syncAllMetadata } from './scripts/generate-about-info.mjs';

export default defineConfig(({ command }) => {
  // Dev/preview must leave the last build's tracked metadata untouched.
  if (command === 'build') {
    try {
      syncAllMetadata();
    } catch (e) {
      console.warn('Could not sync software about info:', e);
    }
  }
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './frontend'),
      },
    },
    clearScreen: false,
    server: {
      host: '127.0.0.1',
      port: 1420,
      strictPort: true,
      watch: {
        ignored: ['**/backend/**', '**/target/**', '**/.git/**'],
      },
    },
  };
});
