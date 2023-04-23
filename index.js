import { createRequire } from 'node:module';

export * from './dist/index.js'
if (!globalThis.require) {
  const require = createRequire(import.meta.url);
  globalThis.require = require;
}
