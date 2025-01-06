// vite.config.js
import { defineConfig } from 'vite';
import path from 'path';

// Import ESBuild polyfill plugins
import nodePolyfills from 'rollup-plugin-polyfill-node';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import inject from '@rollup/plugin-inject';

import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill'

export default defineConfig({
  // Define the root directory (default is the current working directory)
  root: process.cwd(),

  // Base public path when served in development or production
  base: './',

  worker: {
    format: 'es',
  },

  plugins: [
    // Inject global variables where needed
    nodeResolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs(),
    nodePolyfills(),
    inject({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
  ],

  // Configure the development server
  server: {
    port: 3000,       // Change the port if needed
    open: true,       // Automatically open the app in the browser
    // proxy: { ... }, // Set up proxy if you're making API calls
  },

  build: {
    outDir: 'dist',            // Output directory
    target: 'esnext',          // JavaScript language target
    sourcemap: true,           // Generate source maps
    minify: 'esbuild',         // Minifier to use ('esbuild', 'terser', or false)
    emptyOutDir: true,         // Empty the output directory before building
    rollupOptions: {
      
      input: path.resolve(__dirname, 'index.html'), // Entry point
      plugins: [
        /* // Inject plugin to handle globals during build
        inject({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer'],
        }), */
      ],
    },
    
  },

  resolve: {
    alias: {
      'process/browser': 'process/browser',
      global: 'globalThis',
      process: 'process/browser',
      buffer: 'buffer'
    },
  },

  define: {
    global: 'globalThis',
    'process.env': '{}',
  },

  // Optimize dependencies
  optimizeDeps: {
    include: [
      'three',
      'process',
      'buffer',
      'typedarray-pool',
      'box-intersect',
      'clean-pslg',
    ],
    esbuildOptions: {
      // Configure ESBuild to use the polyfill plugins
      define: {
        global: 'globalThis',
        'process.env': '{}',
      },
      alias: {
        'process/browser': 'process/browser',
        global: 'globalThis',
        process: 'process/browser',
        buffer: 'buffer'
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          process: true,
          buffer: true
        }),
        NodeModulesPolyfillPlugin()
      ],
      // Enable browser field in package.json to prefer browser-specific modules
      // This is enabled by default in Vite
    },
  },

  // Define how assets are handled
  assetsInclude: [
    '**/*.gltf',
    '**/*.glb',
    '**/*.hdr',
    '**/*.bin',
  ], // Include 3D model formats
});
