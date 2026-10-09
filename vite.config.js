import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({ base: '/assets/', plugins: [react()], build: { outDir: resolve(__dirname, 'backend/static'), assetsDir: '', emptyOutDir: true } });
