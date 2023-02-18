# modern-node-polyfills
A way to enable using Node native modules in non-node (Browser, Cloudflare, Deno,
...) environemnts with modern polyfills from [JSPM](https://github.com/jspm/jspm-core).

[Here](https://github.com/jspm/jspm-core/tree/main/nodelibs/browser) are the modules that are supported in modern-node-polyfills.

# Example
```ts
import { polyfillPath } from "modern-node-polyfills";

console.log(await polyfillPath("fs")) 
// /home/bagher/project/@jspm/core/nodelibs/browser/fs.js
```

### `polyfillPath`
This function returns the path of the requested module.
```ts
await polyfillPath("fs");
await polyfillPath("node:fs") // Modules can have the `node` prefix
```

### `polyfillContent`
It returns the bundled content of a specific node module instead of a path.
```ts
console.log(await polyfillContent("fs"));
// the bundled source of `fs`
```

## `inject`
This function tries to do the work of [@rollup/plugin-inject](https://github.com/rollup/plugins/tree/master/packages/inject#readme) plugin! but it also adds a new option called `expressions` which is for replacing javascript expressions like `__filename`.

```ts
console.log(await inject("console.log(__filename);", {
  // replaces every global __filename with "/"
  expressions: { __filename: "/" },
  modules: {
    // replaces every global `Buffer` with the imported `Buffer` from the polyfill buffer
    Buffer: [await polyfillPath("buffer"), "Buffer"],
  }
}))
// logs `console.log("/")`
```

## `polyfillGlobals`
A way to polyfill all global node expressions, in this case, `process`,
`Buffer`, `global`, `setImmediate`, `clearImmediate`, `__dirname` and `__filename`. It's possible to customize the `__filename` and `__dirname` values in the second argument of this function.
```ts
console.log(await polyfillGlobals(`
    console.log(global);
    console.log(process);
    console.log(Buffer);
    console.log(setImmediate);
    console.log(clearImmediate);
`))
// shows the polyfilled content
```
As a third argument, it's possible to change the path of those global polyfills or
even disable them using `null`.

```ts
const content = await polyfillGlobals(
	`
	console.log(global)
	console.log(process);
	console.log(Buffer);
	console.log(setImmediate);
	console.log(clearImmediate);
`,
	{},
	{
		process: "/here/process.js",
		Buffer: null,
		global: null,
		setImmediate: null,
		clearImmediate: null,
	}
);
```

# Contribution
Feel free to let me know what you need for this package or what issue you have,
I'd be happy!

