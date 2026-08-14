import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '#': path.resolve(import.meta.dirname, './src'),
    },
  },
  plugins: [viteReact()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
})
