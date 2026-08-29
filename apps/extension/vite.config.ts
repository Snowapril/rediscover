import { defineConfig } from 'vite'

// The popup is an ES module page, so it builds the ordinary way.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: { popup: 'popup.html' },
      output: { entryFileNames: '[name].js', assetFileNames: '[name].[ext]' },
    },
  },
})
