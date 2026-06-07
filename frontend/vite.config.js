import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Frontend roda na porta 3000 (HClient). host:true permite acesso de fora do
// container durante o dev. Em produção o build estático é servido pelo nginx (:80).
export default defineConfig({
  plugins: [react()],
  server: { port: 3000, host: true },
  preview: { port: 3000, host: true },
})
