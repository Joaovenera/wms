import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

// Verificar se os certificados existem
const certExists = fs.existsSync('./certs/cert.pem') && fs.existsSync('./certs/key.pem');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@pages": path.resolve(__dirname, "./src/pages"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@types": path.resolve(__dirname, "./src/types"),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    hmr: {
      host: '69.62.95.146',
      protocol: 'wss',
      port: 5174,
      path: '/ws',
    },
    ...(certExists && {
      https: {
        // Certificados auto-assinados para desenvolvimento
        key: fs.readFileSync('./certs/key.pem'),
        cert: fs.readFileSync('./certs/cert.pem'),
      },
    }),
    proxy: {
      // Proxy durante desenvolvimento
      '/api': {
        target: 'https://localhost:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
