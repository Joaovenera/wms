import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

// Performance budget configuration
const PERFORMANCE_BUDGETS = {
  mainChunk: 250, // KB
  vendorChunk: 300, // KB
  totalJS: 800, // KB
  totalCSS: 100, // KB
  asyncChunk: 200 // KB
};

// Verificar se os certificados existem
const certExists = fs.existsSync('./certs/cert.pem') && fs.existsSync('./certs/key.pem');

export default defineConfig({
  plugins: [
    react()
  ],
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
        key: fs.readFileSync('./certs/key.pem'),
        cert: fs.readFileSync('./certs/cert.pem'),
      },
    }),
    proxy: {
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
    target: 'esnext',
    minify: 'esbuild', // Use esbuild for faster builds
    chunkSizeWarningLimit: PERFORMANCE_BUDGETS.asyncChunk * 1024,
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
    rollupOptions: {
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        unknownGlobalSideEffects: false
      },
      output: {
        manualChunks: (id) => {
          // Vendor chunk strategy with size optimization
          if (id.includes('node_modules')) {
            // Critical React core - separate chunk for optimal caching
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-core';
            }
            
            // Heavy Radix UI components - split by usage frequency
            if (id.includes('@radix-ui')) {
              // Frequently used UI primitives
              if (id.includes('dialog') || id.includes('button') || id.includes('input') || 
                  id.includes('toast') || id.includes('card') || id.includes('tabs')) {
                return 'radix-core';
              }
              // Less frequently used complex components
              if (id.includes('navigation-menu') || id.includes('dropdown-menu') || 
                  id.includes('context-menu') || id.includes('menubar')) {
                return 'radix-menu';
              }
              // Form and input components
              if (id.includes('select') || id.includes('checkbox') || id.includes('radio') ||
                  id.includes('slider') || id.includes('switch') || id.includes('form')) {
                return 'radix-forms';
              }
              // Layout and display components
              return 'radix-layout';
            }
            
            // Heavy animation and visualization libraries
            if (id.includes('framer-motion')) {
              return 'animations';
            }
            if (id.includes('recharts') || id.includes('chart')) {
              return 'charts';
            }
            
            // Icons - separate chunk for optimal tree-shaking
            if (id.includes('lucide-react') || id.includes('react-icons')) {
              return 'icons';
            }
            
            // Utility libraries
            if (id.includes('date-fns') || id.includes('zod') || id.includes('clsx') ||
                id.includes('class-variance-authority') || id.includes('tailwind-merge')) {
              return 'utilities';
            }
            
            // Query and state management
            if (id.includes('@tanstack/react-query') || id.includes('wouter')) {
              return 'state-routing';
            }
            
            // Media and QR libraries
            if (id.includes('qrcode') || id.includes('canvas')) {
              return 'media-libs';
            }
            
            // Remaining vendor dependencies
            return 'vendor-misc';
          }
          
          // Application code splitting by feature domains
          // UI Components - split by complexity and usage
          if (id.includes('/components/ui/')) {
            const component = id.split('/').pop()?.replace('.tsx', '');
            // Core UI components used across the app
            const coreComponents = ['button', 'input', 'card', 'dialog', 'toast', 'form'];
            if (coreComponents.some(comp => component?.includes(comp))) {
              return 'ui-core';
            }
            // Complex UI components
            return 'ui-extended';
          }
          
          // Feature-based chunks with lazy loading support
          if (id.includes('/pages/')) {
            const page = id.split('/').pop()?.replace('.tsx', '');
            // Core pages loaded on initial navigation
            if (['dashboard', 'auth', 'landing'].includes(page || '')) {
              return 'pages-core';
            }
            // Product and inventory management
            if (['products', 'pallets', 'positions', 'stock'].some(p => page?.includes(p))) {
              return 'pages-inventory';
            }
            // Transfer and logistics
            if (['transfer', 'vehicles', 'warehouse-tracking'].some(p => page?.includes(p))) {
              return 'pages-logistics';
            }
            // Mobile-specific pages
            if (id.includes('/mobile/') || page?.includes('mobile')) {
              return 'pages-mobile';
            }
            // Administrative pages
            return 'pages-admin';
          }
          
          // Heavy feature components - separate chunks for optimal loading
          if (id.includes('warehouse-map') || id.includes('warehouse-tracking')) {
            return 'features-warehouse';
          }
          if (id.includes('transfer-planning') || id.includes('transfer-report')) {
            return 'features-transfer';
          }
          if (id.includes('qr-scanner') || id.includes('camera-capture') || id.includes('packaging-scanner')) {
            return 'features-scanner';
          }
          if (id.includes('product-photo') || id.includes('packaging-manager') || id.includes('ucp-creation')) {
            return 'features-management';
          }
          
          // Hooks and utilities
          if (id.includes('/hooks/') || id.includes('/lib/') || id.includes('/utils/')) {
            return 'app-utilities';
          }
          
          // Types and configurations
          if (id.includes('/types/') || id.includes('/config/')) {
            return 'app-config';
          }
          
          // Default chunk for remaining app code
          return 'app-main';
        },
        // Enhanced chunk naming for better caching
        chunkFileNames: (chunkInfo) => {
          const name = chunkInfo.name;
          // Use content hash for vendor chunks (better caching)
          if (name?.includes('vendor') || name?.includes('react') || name?.includes('radix')) {
            return `js/vendor/[name]-[hash:8].js`;
          }
          // Use content hash for feature chunks
          if (name?.includes('features') || name?.includes('pages')) {
            return `js/features/[name]-[hash:8].js`;
          }
          // Default chunk naming
          return `js/chunks/[name]-[hash:8].js`;
        },
        entryFileNames: 'js/[name]-[hash:8].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name!.split('.');
          const extType = info[info.length - 1];
          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico|webp)$/i.test(assetInfo.name!)) {
            return `images/[name]-[hash:8].${extType}`;
          }
          if (/\.(css)$/i.test(assetInfo.name!)) {
            return `css/[name]-[hash:8].${extType}`;
          }
          if (/\.(woff|woff2|eot|ttf|otf)$/i.test(assetInfo.name!)) {
            return `fonts/[name]-[hash:8].${extType}`;
          }
          return `assets/[name]-[hash:8].${extType}`;
        },
        validate: true,
        format: 'es',
        interop: 'auto',
        experimentalMinChunkSize: 20000
      }
    },
  },
});