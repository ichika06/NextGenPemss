import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  assetsInclude: ['**/*.zip'],
  // base: './',
  // build: {
  //   outDir: 'dist',
  //   emptyOutDir: true,
  //   rollupOptions: {
  //     input: {
  //       main: 'index.html',
  //       driverInstall: 'driver-install.html'
  //     },
  //     output: {
  //       // Keep ES format for better web performance
  //       format: 'es',
  //       entryFileNames: '[name].js',
  //       chunkFileNames: '[name].js',
  //       assetFileNames: '[name].[ext]'
  //     }
  //   }
  // },
  // resolve: {
  //   alias: {
  //     '@': path.resolve(__dirname, './src')
  //   }
  // }
})