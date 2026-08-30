/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 127.0.0.1 rather than the default localhost, which binds IPv6 only and so
  // would not match the site_url the Supabase stack is configured with.
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  test: {
    // Components are exercised against a synthetic DOM; there is no browser here.
    environment: 'happy-dom',
    include: ['test/**/*.test.{ts,tsx}'],
  },
})
