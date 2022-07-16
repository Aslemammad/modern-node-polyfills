import { defineConfig } from 'tsup'

export default defineConfig({
  entryPoints: ['index.ts', 'global.ts'],
  external: ['@rollup/pluginutils'],
  splitting: true,
  outDir: 'dist',
  format: ['esm'],
  tsconfig: './tsconfig.json',
  target: 'es2020',
  clean: true,
  dts: true,
})
