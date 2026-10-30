import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Le plugin du routeur doit passer AVANT celui de React :
  // il génère src/routeTree.gen.ts à partir de src/routes/.
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react()],
})
