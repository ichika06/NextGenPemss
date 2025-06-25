import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  assetsInclude: ['**/*.zip'],
  define: {
    'process.env': {}
  },
  publicDir: 'public',
  build: {
    minify: 'terser', // 🔁 switch from esbuild to terser
    terserOptions: {
      compress: {
        drop_console: true,    // ✅ remove console.log, console.info, etc.
        drop_debugger: true,   // ✅ remove debugger statements
        pure_funcs: ['console.info', 'console.debug', 'console.warn'], // ✅ remove other specific functions
      },
      format: {
        comments: false        // ✅ remove all comments from production build
      }
    },
    rollupOptions: {
      input: {
        main: './index.html',
        sw: './sw.js'
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === 'sw' ? 'sw.js' : '[name]-[hash].js'
        }
      }
    }
  },
  server: {
    headers: {
      'Service-Worker-Allowed': '/'
    }
  }
})