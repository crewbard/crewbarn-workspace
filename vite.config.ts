import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

/**
 * Lists the files screens load on demand, as data at the end of index.html,
 * for src/lib/warmChunks.ts to fetch in the background. At the end, so the
 * update banner's search for the entry script still finds the real one first.
 * Left out: onnxruntime ("ort.*", the image cut-out model's runtime) and the
 * PDF reader's worker. They're large and only a few tools use them.
 */
function listLazyChunks(): Plugin {
  return {
    name: 'crewbarn-list-lazy-chunks',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return
        const inPage = new Set([...html.matchAll(/(?:src|href)="\/(assets\/[^"]+)"/g)].map((m) => m[1]))
        const files = Object.values(ctx.bundle)
          .map((file) => file.fileName)
          .filter((name) => /^assets\/[^/]+\.(js|css)$/.test(name) && !inPage.has(name) && !/^assets\/(ort\.|pdf\.worker)/.test(name))
          .sort()
          .map((name) => `/${name}`)
        return [{ tag: 'script', attrs: { type: 'application/json', id: 'crewbarn-chunks' }, children: JSON.stringify(files), injectTo: 'body' }]
      },
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    listLazyChunks(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})