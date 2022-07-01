import { defineConfig } from 'tsup'

export default defineConfig({
  entryPoints: ['index.ts', 'global.ts'],
  splitting: true,
  legacyOutput: true,
  outDir: 'dist',
  format: ['esm', 'cjs'],
  tsconfig: './tsconfig.json',
  target: 'es2020',
  clean: true,
  dts: true,
})
