import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'index.ts',
    { 'lucid/*': 'src/lucid/*.ts' },
    { 'providers/*': 'providers/*.ts' },
  ],
  outDir: 'build',
  clean: true,
  format: ['esm'],
  minify: 'dce-only',
  fixedExtension: false,
  dts: true,
  target: 'esnext',
  exports: true,
  unbundle: true,
  deps: {
    neverBundle: ['luxon', '@adonisjs/core', '@adonisjs/lucid'],
  },
});
