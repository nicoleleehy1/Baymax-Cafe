import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site from /Baymax-Cafe/; dev keeps the root path.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Baymax-Cafe/' : '/',
  plugins: [react()],
  worker: { format: 'es' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
}) as never);
