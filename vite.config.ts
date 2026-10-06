import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5179,
    strictPort: true,
    // Netlify Functions run on their own server (npm run functions). Forward API calls to it,
    // so the browser only ever talks to http://localhost:5179.
    proxy: {
      '/.netlify/functions': 'http://localhost:8888',
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'netlify/**/*.test.ts'],
  },
});
