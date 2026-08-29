import { defineConfig } from 'vite'

// Content scripts are not modules, so this one is built separately as an IIFE
// and written alongside the popup rather than replacing it.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/connect.content.ts',
      formats: ['iife'],
      name: 'rediscoverConnect',
      fileName: () => 'connect.js',
    },
  },
})
