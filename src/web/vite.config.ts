// vite.config.ts
// @vitejs/plugin-react v4.0.0
// vite v4.4.0
// vite-tsconfig-paths v4.2.0

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

export default defineConfig(({ mode }) => {
  const isDevelopment = mode === 'development';

  return {
    // Plugin configuration with React Fast Refresh and TypeScript path resolution
    plugins: [
      react({
        // Enable Fast Refresh for rapid development
        fastRefresh: true,
        jsxRuntime: 'automatic',
        // Add Emotion for styled components support
        babel: {
          plugins: ['@emotion/babel-plugin']
        }
      }),
      tsconfigPaths({
        loose: false // Strict path resolution
      })
    ],

    // Development server configuration
    server: {
      port: parseInt(process.env.VITE_APP_PORT || '3000'),
      strictPort: true,
      host: true,
      // CORS configuration for API requests
      cors: {
        origin: ['http://localhost:3000'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: true
      },
      // Proxy configuration for API requests
      proxy: {
        '/api': {
          target: process.env.VITE_API_BASE_URL,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      },
      // Hot Module Replacement settings
      hmr: {
        overlay: true
      }
    },

    // Build configuration
    build: {
      outDir: 'dist',
      sourcemap: true,
      minify: 'terser',
      // Browser targets based on technical specifications
      target: ['chrome90', 'firefox88', 'safari14', 'edge90'],
      cssCodeSplit: true,
      chunkSizeWarningLimit: 1000,
      // Rollup specific options
      rollupOptions: {
        output: {
          // Manual chunk splitting for optimal loading
          manualChunks: {
            vendor: ['react', 'react-dom', '@mui/material'],
            redux: ['@reduxjs/toolkit', 'react-redux'],
            forms: ['react-hook-form', 'yup'],
            utils: ['date-fns', 'lodash'],
            charts: ['recharts', 'd3']
          }
        }
      },
      // Terser optimization options
      terserOptions: {
        compress: {
          drop_console: !isDevelopment,
          drop_debugger: !isDevelopment
        }
      }
    },

    // Module resolution configuration
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@pages': path.resolve(__dirname, './src/pages'),
        '@utils': path.resolve(__dirname, './src/utils'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@api': path.resolve(__dirname, './src/api'),
        '@store': path.resolve(__dirname, './src/store'),
        '@types': path.resolve(__dirname, './src/types'),
        '@constants': path.resolve(__dirname, './src/constants'),
        '@assets': path.resolve(__dirname, './src/assets'),
        '@styles': path.resolve(__dirname, './src/styles'),
        '@features': path.resolve(__dirname, './src/features'),
        '@layouts': path.resolve(__dirname, './src/layouts'),
        '@services': path.resolve(__dirname, './src/services')
      }
    },

    // CSS configuration
    css: {
      modules: {
        localsConvention: 'camelCase',
        scopeBehaviour: 'local',
        generateScopedName: '[name]__[local]___[hash:base64:5]'
      },
      preprocessorOptions: {
        scss: {
          additionalData: '@import "@styles/variables.scss";'
        }
      },
      devSourcemap: true
    },

    // ESBuild configuration
    esbuild: {
      jsxInject: "import React from 'react'",
      target: 'es2020',
      legalComments: 'none',
      treeShaking: true,
      minifyIdentifiers: true,
      minifySyntax: true
    },

    // Performance optimizations
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        '@mui/material',
        '@reduxjs/toolkit',
        'react-redux',
        'react-hook-form',
        'yup'
      ],
      exclude: ['@testing-library/jest-dom']
    },

    // Preview server configuration
    preview: {
      port: 3000,
      strictPort: true,
      host: true
    }
  };
});