// vite.config.js
import { defineConfig } from 'vite';
import path from 'path';
import terser from '@rollup/plugin-terser';
import libAssetsPlugin from '@laynezh/vite-plugin-lib-assets'
// Import ESBuild polyfill plugins
import nodePolyfills from 'rollup-plugin-polyfill-node';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import inject from '@rollup/plugin-inject';

export default defineConfig({
  base: './',
  define: {
    global: 'globalThis',
    'process.env': '{}',
  },
  resolve: {
    alias: {
      'process/browser': 'process/browser',
      global: 'globalThis',
      process: 'process/browser',
      buffer: 'buffer'
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/entry.js'), // Library entry point
      name: 'ultraglobe',
      fileName: (format) => `ultraglobe.${format}.js`,
      formats: ['es', 'cjs', 'umd'], // Desired formats
    },
    outDir: 'dist',
    sourcemap: true,
    emptyOutDir: true,
    // Disable inlining of assets
    assetsInlineLimit: 1024 * 8,
    rollupOptions: {
      // Externalize only dependencies, not assets
      external: ['three', 'proj4', 'epsg-index'],
      output: {
        globals: {
          three: 'THREE',
        },
        // Output assets to the 'assets' folder
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  plugins: [
    // Inject global variables
    libAssetsPlugin({
      include: /\.(gltf|glb|hdr|png|jpe?g|svg|gif|ktx2)(\?.*)?$/,
      limit: 1024 * 8
    }),
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
    // Minify the output
    terser({
      maxWorkers: 4,
    }),
  ],
  assetsInclude: [
    '**/*.gltf',
    '**/*.glb',
    '**/*.hdr',
    '**/*.bin',
    '**/*.png',
    '**/*.jpe?g',
    '**/*.svg',
    '**/*.gif',
    '**/*.ktx2'
  ],
});
