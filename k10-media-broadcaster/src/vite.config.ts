import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'path'
import fs from 'fs'

// Serve static assets (images, modules/css) from the Electron app directory
// without using publicDir (which conflicts with outDir being the same folder).
function serveElectronAssets(): Plugin {
  const electronDir = path.resolve(__dirname, '../K10 Media Broadcaster')
  return {
    name: 'serve-electron-assets',
    configureServer(server) {
      server.middlewares.use((req: any, res: any, next: any) => {
        // Only serve known asset paths (images, modules/css)
        const url = req.url?.split('?')[0] || ''
        if (url.startsWith('/images/') || url.startsWith('/modules/')) {
          const filePath = path.join(electronDir, url)
          if (fs.existsSync(filePath)) {
            const ext = path.extname(filePath).toLowerCase()
            const mimeTypes: Record<string, string> = {
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.gif': 'image/gif',
              '.svg': 'image/svg+xml',
              '.webp': 'image/webp',
              '.css': 'text/css',
              '.js': 'application/javascript',
              '.json': 'application/json',
            }
            res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream')
            fs.createReadStream(filePath).pipe(res)
            return
          }
        }
        next()
      })
    },
  }
}

/**
 * Post-build plugin: clean up the built HTML for Electron compatibility.
 *
 * The React dashboard is now served via a local HTTP server in Electron,
 * so most file:// workarounds are no longer needed. We just clean up
 * invalid attributes that vite-plugin-singlefile copies from <link> to <style>.
 */
function electronCompatPlugin(): Plugin {
  return {
    name: 'electron-compat',
    enforce: 'post',
    closeBundle() {
      const outFile = path.resolve(__dirname, '../K10 Media Broadcaster/dashboard-react.html')
      if (!fs.existsSync(outFile)) return

      let html = fs.readFileSync(outFile, 'utf8')

      // Remove invalid attributes from inline <style> tags
      // (vite-plugin-singlefile copies rel/crossorigin from the original <link>)
      html = html.replace(/<style([^>]*)\s+crossorigin([^>]*)>/g, '<style$1$2>')
      html = html.replace(/<style([^>]*)\s+rel="stylesheet"([^>]*)>/g, '<style$1$2>')
      html = html.replace(/<style\s{2,}/g, '<style ')

      fs.writeFileSync(outFile, html)
      console.log('[electron-compat] Patched dashboard-react.html')
    },
  }
}

export default defineConfig({
  base: './',
  publicDir: false, // Disabled — we use the custom middleware instead
  plugins: [react(), viteSingleFile(), electronCompatPlugin(), serveElectronAssets()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@types': path.resolve(__dirname, './src/types'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../K10 Media Broadcaster'),
    emptyOutDir: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'dashboard-react.html'),
      output: {
        entryFileNames: 'dashboard-react.js',
        assetFileNames: 'dashboard-react.[ext]',
      },
    },
  },
  server: {
    port: 5173,
  },
})
