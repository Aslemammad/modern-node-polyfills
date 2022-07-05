# modern-node-polyfills
A way to enable using Node native modules in non-node (Cloudflare, Deno,
...) environemnts with modern polyfills from [JSPM](https://github.com/jspm/jspm-core).

[Here](https://github.com/jspm/jspm-core/tree/main/nodelibs/browser) are the modules that are supported in modern-node-polyfills.

# Example
```ts
import { polyfillPath } from "modern-node-polyfills";

console.log(await polyfillPath("fs")) 
// /home/bagher/project/@jspm/core/nodelibs/browser/fs.js
```


