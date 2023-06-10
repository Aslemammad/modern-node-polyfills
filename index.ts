import { resolve, join } from "node:path";
import { builtinModules } from "node:module";
import { resolve as resolveExports } from "resolve.exports";
import { loadPackageJSON, resolveModule } from "local-pkg";
import { parse as _parse } from "acorn";
import { build } from "esbuild";

import createInjectPlugin, { type RollupInjectOptions } from "./plugin";

async function polyfillPath(mod: string) {
  if (mod.startsWith("node:")) {
    mod = mod.replace("node:", "");
  }

  if (!builtinModules.includes(mod))
    throw new Error(`Node.js does not have ${mod} in its builtin modules`);

  const jspmPath = resolve(
    require.resolve(`@jspm/core/nodelibs/${mod}`),
    // ensure "fs/promises" is resolved properly
    "../../.." + (mod.includes('/') ? "/.." : "")
  );
  const jspmPackageJson = await loadPackageJSON(jspmPath);
  const exportPath = resolveExports(jspmPackageJson, `./nodelibs/${mod}`, {
    browser: true,
  });

  const exportFullPath = resolveModule(join(jspmPath, exportPath?.[0] || ""));

  if (!exportPath || !exportFullPath) {
    throw new Error(
      "resolving failed, please try creating an issue in github.com/aslemammad/modern-node-polyfills"
    );
  }
  return exportFullPath;
}

async function polyfillContent(mod: string) {
  const exportFullPath = await polyfillPath(mod);

  const content = (
    await build({
      write: false,
      format: "esm",
      bundle: true,
      entryPoints: [exportFullPath],
    })
  ).outputFiles[0]!.text;

  return content;
}

type Globals = { __filename?: string; __dirname?: string };

async function inject(
  content: string,
  options: RollupInjectOptions,
  id?: string
): Promise<string> {
  const injectPlugin = createInjectPlugin(options);

  const parse: typeof _parse = (input, opts) =>
    _parse(input, { ...opts, sourceType: "module", ecmaVersion: "latest" });

  const result = injectPlugin.transform!.call(
    { warn: console.warn, parse } as any,
    content,
    id ?? ""
  );
  return result?.code || content;
}

type InjectmentWithNull = string | [string, string] | null

type Modules = Partial<{
  process: InjectmentWithNull,
  Buffer: InjectmentWithNull,
  global: InjectmentWithNull,
  setImmediate: InjectmentWithNull,
  clearImmediate: InjectmentWithNull,
}>

async function polyfillGlobals(content: string, globals: Globals = {}, mods: Modules = {}) {
  return inject(
    content,
    {
      expressions: {
        __filename: globals?.__filename || "/",
        __dirname: globals?.__dirname || "/",
      },
      modules: removeEmpty({
        process: await polyfillPath("process"),
        Buffer: [await polyfillPath("buffer"), "Buffer"],
        global: require.resolve("modern-node-polyfills/global"),
        setImmediate: [await polyfillPath("timers"), "setImmediate"],
        clearImmediate: [await polyfillPath("timers"), "clearImmediate"],
        ...mods
      }),
    },
    globals.__filename
  );
}

function removeEmpty<T>(obj: Record<string, T>): Record<string, NonNullable<T>> {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v != null)) as Record<string, NonNullable<T>>;
}

export { polyfillPath, polyfillContent, inject, polyfillGlobals };
